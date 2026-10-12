-- 0016 — Catálogo de sobrantes, ronda 1 (reunión con Jaime, 12-oct-2026)
--
-- 1) leftovers_sections: secciones del registro de sobrantes y su orden, en BD
--    (antes estaban en constants/families.ts y cambiarlas exigía una build).
--    products.leftovers_family pasa a ser FK con ON UPDATE CASCADE: renombrar
--    una sección es un UPDATE de una fila.
-- 2) products.show_in_leftovers: oculta un producto SOLO en sobrantes, sin
--    tocar producción/plan/stock (que siguen filtrando por is_obrador).
-- 3) product_aliases + merge_product(): fusiona duplicados "nombre TPV" /
--    "nombre plantilla Excel" sumando todos sus datos. El nombre que desaparece
--    queda como alias para que el importador del ERP lo siga reconociendo.
-- 4) Reclasificación, ocultación y fusiones acordadas en el acta.
-- Copia previa en el esquema backup (tablas *_20261012).

-- ── 1) Secciones ──────────────────────────────────────────────────────────
create table if not exists public.leftovers_sections (
  name text primary key,
  sort_order integer not null,
  -- familia de producción que recibe un producto creado a mano en la sección
  production_family text,
  is_active boolean not null default true
);

alter table public.leftovers_sections enable row level security;
drop policy if exists auth_read_leftovers_sections on public.leftovers_sections;
create policy auth_read_leftovers_sections on public.leftovers_sections
  for select to authenticated using (true);
drop policy if exists admin_write_leftovers_sections on public.leftovers_sections;
create policy admin_write_leftovers_sections on public.leftovers_sections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.leftovers_sections (name, sort_order, production_family) values
  ('Pan', 1, 'panaderia'),
  ('Pasteles', 2, 'bolleria'),
  ('Salados', 3, 'salado'),
  ('Tartas y brownies', 4, 'dulce'),
  ('Bizcochos y cookies', 5, 'dulce'),
  ('Quiche', 6, 'salado'),
  ('Otros', 7, null),
  ('Navidad', 8, 'navidad')
on conflict (name) do update
  set sort_order = excluded.sort_order, production_family = excluded.production_family;

update public.products set leftovers_family = 'Tartas y brownies' where leftovers_family = 'Tartas';
update public.products set leftovers_family = 'Otros' where leftovers_family is null and is_obrador;

alter table public.products drop constraint if exists products_leftovers_family_fkey;
alter table public.products add constraint products_leftovers_family_fkey
  foreign key (leftovers_family) references public.leftovers_sections(name) on update cascade;

-- ── 2) Visibilidad en sobrantes ───────────────────────────────────────────
alter table public.products add column if not exists show_in_leftovers boolean not null default true;

-- ── 3) Alias y fusión ─────────────────────────────────────────────────────
create table if not exists public.product_aliases (
  alias text primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.product_aliases enable row level security;
drop policy if exists auth_read_product_aliases on public.product_aliases;
create policy auth_read_product_aliases on public.product_aliases
  for select to authenticated using (true);
drop policy if exists admin_write_product_aliases on public.product_aliases;
create policy admin_write_product_aliases on public.product_aliases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suma de dos cantidades que pueden ser null (null solo si ambas lo son)
create or replace function public._sum_nullable(a numeric, b numeric) returns numeric
language sql immutable as $$
  select case when a is null and b is null then null else coalesce(a, 0) + coalesce(b, 0) end
$$;

-- Fusiona el producto src en dst: mueve todos sus datos (sumando cuando ambos
-- tienen fila para la misma clave), guarda el nombre de src como alias de dst
-- y borra src. Solo para administración vía migración/SQL.
create or replace function public.merge_product(src uuid, dst uuid) returns void
language plpgsql as $$
declare
  src_name text;
begin
  if src = dst then raise exception 'merge_product: src = dst'; end if;
  select name into src_name from public.products where id = src;
  if src_name is null then raise exception 'merge_product: src % no existe', src; end if;
  perform 1 from public.products where id = dst;
  if not found then raise exception 'merge_product: dst % no existe', dst; end if;

  -- Sobrantes (por día y local)
  update public.daily_product_entries d set
    saved_qty = d.saved_qty + s.saved_qty,
    discarded_qty = d.discarded_qty + s.discarded_qty,
    discard_reason = coalesce(d.discard_reason, s.discard_reason),
    comment = nullif(concat_ws(' | ', nullif(d.comment, ''), nullif(s.comment, '')), '')
  from public.daily_product_entries s
  where s.product_id = src and d.product_id = dst and d.daily_session_id = s.daily_session_id;
  delete from public.daily_product_entries s where s.product_id = src
    and exists (select 1 from public.daily_product_entries d
                where d.product_id = dst and d.daily_session_id = s.daily_session_id);
  update public.daily_product_entries set product_id = dst where product_id = src;

  -- Ventas
  update public.sales_daily d set
    sold_qty = d.sold_qty + s.sold_qty,
    revenue = d.revenue + s.revenue
  from public.sales_daily s
  where s.product_id = src and d.product_id = dst and d.location_id = s.location_id
    and d.sale_date = s.sale_date and d.source = s.source;
  delete from public.sales_daily s where s.product_id = src
    and exists (select 1 from public.sales_daily d where d.product_id = dst
                and d.location_id = s.location_id and d.sale_date = s.sale_date and d.source = s.source);
  update public.sales_daily set product_id = dst where product_id = src;

  -- Producción
  update public.production_entries d set
    quantity = d.quantity + s.quantity,
    notes = nullif(concat_ws(' | ', nullif(d.notes, ''), nullif(s.notes, '')), '')
  from public.production_entries s
  where s.product_id = src and d.product_id = dst and d.production_date = s.production_date;
  delete from public.production_entries s where s.product_id = src
    and exists (select 1 from public.production_entries d
                where d.product_id = dst and d.production_date = s.production_date);
  update public.production_entries set product_id = dst where product_id = src;

  -- Plan
  update public.production_plans d set
    suggested_qty = public._sum_nullable(d.suggested_qty, s.suggested_qty)::integer,
    override_qty = public._sum_nullable(d.override_qty, s.override_qty)::integer,
    nave_qty = public._sum_nullable(d.nave_qty, s.nave_qty)::integer,
    tienda_qty = public._sum_nullable(d.tienda_qty, s.tienda_qty)::integer
  from public.production_plans s
  where s.product_id = src and d.product_id = dst and d.plan_date = s.plan_date;
  delete from public.production_plans s where s.product_id = src
    and exists (select 1 from public.production_plans d
                where d.product_id = dst and d.plan_date = s.plan_date);
  update public.production_plans set product_id = dst where product_id = src;

  -- Stock de producto
  update public.product_stock_counts d set quantity = d.quantity + s.quantity
  from public.product_stock_counts s
  where s.product_id = src and d.product_id = dst and d.count_date = s.count_date;
  delete from public.product_stock_counts s where s.product_id = src
    and exists (select 1 from public.product_stock_counts d
                where d.product_id = dst and d.count_date = s.count_date);
  update public.product_stock_counts set product_id = dst where product_id = src;

  -- Envíos
  update public.shipment_items d set
    qty_sent = public._sum_nullable(d.qty_sent, s.qty_sent),
    qty_received = public._sum_nullable(d.qty_received, s.qty_received),
    comment = nullif(concat_ws(' | ', nullif(d.comment, ''), nullif(s.comment, '')), '')
  from public.shipment_items s
  where s.product_id = src and d.product_id = dst and d.shipment_id = s.shipment_id;
  delete from public.shipment_items s where s.product_id = src
    and exists (select 1 from public.shipment_items d
                where d.product_id = dst and d.shipment_id = s.shipment_id);
  update public.shipment_items set product_id = dst where product_id = src;

  -- Datos derivados/configuración: si dst ya tiene, se queda el de dst
  delete from public.product_costs s where s.product_id = src
    and exists (select 1 from public.product_costs d where d.product_id = dst and d.valid_from = s.valid_from);
  update public.product_costs set product_id = dst where product_id = src;
  delete from public.prediction_accuracy s where s.product_id = src
    and exists (select 1 from public.prediction_accuracy d where d.product_id = dst and d.target_date = s.target_date);
  update public.prediction_accuracy set product_id = dst where product_id = src;
  delete from public.prediction_weights where product_id = src
    and exists (select 1 from public.prediction_weights where product_id = dst);
  update public.prediction_weights set product_id = dst where product_id = src;
  delete from public.product_process_config where product_id = src
    and exists (select 1 from public.product_process_config where product_id = dst);
  update public.product_process_config set product_id = dst where product_id = src;

  update public.team_production_items set product_id = dst where product_id = src;
  update public.product_aliases set product_id = dst where product_id = src;

  -- dst hereda lo que le falte de src
  update public.products d set
    sale_price = coalesce(d.sale_price, s.sale_price),
    family = coalesce(d.family, s.family),
    is_obrador = d.is_obrador or s.is_obrador,
    is_active = true
  from public.products s
  where d.id = dst and s.id = src;

  delete from public.products where id = src;
  insert into public.product_aliases (alias, product_id) values (src_name, dst)
    on conflict (alias) do update set product_id = excluded.product_id;
end;
$$;

revoke all on function public.merge_product(uuid, uuid) from public, anon, authenticated;

-- ── 4) Datos de la ronda 1 ────────────────────────────────────────────────
do $$
declare
  r record;
  sid uuid;
  did uuid;
  n integer;
begin
  -- Fusiones: (nombre que desaparece, nombre que se queda, nombre final)
  for r in select * from (values
    ('BOCATA salami', 'Bocata de Salami', null),
    ('BRIOCHE BOSTOCK CON FRAMBUESA Y CREMA DE PISTACHO', 'Bostock', null),
    ('CARACOLA DE PISTACHO Y NUECES', 'Caracola de pistacho', null),
    ('CESTA CON CREMA DE VAINILLA Y FRAMBUESA', 'Cesta vainilla', null),
    ('COOKIE DE CHOCOLATE', 'Cookie choco', null),
    ('COOKIE CHOCO Y AVELLANA', 'Cookie avellana', null),
    ('cookie pistacho chocolate', 'Cookie pistacho', null),
    ('CROISSANT DE ALMENDRAS', 'Croissant almendra', null),
    ('CROISSANT DE AVELLANAS Y GIANDUJA', 'Cr. avellana gianduja', null),
    ('CROISSANT DE JAMON Y QUESO', 'Croissant jamón', null),
    ('CROISSANT DE PISTACHO Y CHOCOLATE', 'Croissant pistacho', null),
    ('FOCACCIA CON TOMATE', 'Focaccia tomate', null),
    ('GALETTE DE TOMATE Y MOZZARELLA', 'Galette de tomate', null),
    ('pain suisse cafe', 'Pain suisse Caffé', null),
    ('TONKA Y CHOCO BRIOCHE', 'Brioche tonka', null),
    ('MOLDE TRIGO BLANCO', 'Molde blanco', null),
    ('KOUIGN AMANN CARDAMOMO', 'Kouign Amann', 'Kouign Amann cardamomo'),
    ('ESPELTA', 'Espelta simple', 'Espelta'),
    ('FOCACCIA ACEITUNAS', 'Focaccia kalamata', null),
    ('MORTADELLA FOCACCIA', 'Bocata de mortadella', 'Focaccia de mortadella'),
    ('TARTA DE LIMÓN, RICOTTA Y MERINGUE', 'Tarta de limón', null),
    ('MOLDE INTEGRAL CENT Y ESPELTA SEMILLAS', 'Molde integral', 'Molde integral cent y espelta semillas')
  ) as v(src, dst, final_name)
  loop
    select id into sid from public.products where name = r.src;
    select id into did from public.products where name = r.dst;
    if sid is null or did is null then
      raise exception 'Fusión: no encontrado % → %', r.src, r.dst;
    end if;
    perform public.merge_product(sid, did);
    if r.final_name is not null then
      update public.products set name = r.final_name where id = did;
      insert into public.product_aliases (alias, product_id) values (r.dst, did)
        on conflict (alias) do update set product_id = excluded.product_id;
    end if;
  end loop;

  -- Ocultar en sobrantes (no se borra nada)
  update public.products set show_in_leftovers = false
  where is_obrador and name in (
    'Aguacate huevo', 'BIZCOCHO DE BANANA. ENTERO.', 'BIZCOCHO DE CALABACÍN Y CHOCOLATE. ENTERO.',
    'BIZCOCHO DE LIMÓN Y AMAPOLA. ENTERO.', 'CARACOLA DE PASAS Y VAINILLA', 'CHALLAH', 'CILBIR',
    'Croissant plancha', 'Double bakes brioche', 'EMPANADILLA', 'Focaccia Entera Pedidos',
    'Focaccia Entera Pedidos Tomate', 'GRANOLA 300GR', 'HOGAZA BAGAZO', 'Hojaldre 1 kg',
    'Integral hogaza', 'madeleines', 'mallorquín sobrasada', 'MILHOJAS', 'MINI PAIN AU CHOCOLAT',
    'Molde Ajo Romero', 'nan', 'Napoleón 20 personas', 'ORANGE CAKE GLUTEN FREE. ENTERO.',
    'pan centeno huevo', 'PAN TURCO', 'Panecillo', 'PISTACHO MASAPAN',
    'Puchero Crema Choco y Avellana Piemonte', 'salmon bun', 'SEMILLAS',
    'TARTA DE CHOCOLATE CON CARAMELO SALADO ENTERA', 'TARTA DE LIMÓN Y RICOTTA ENTERA',
    'TARTA DE MORA Y PISTACHO ENTERA', 'TARTA DE QUESO ENTERA', 'tartaleta', 'TARTE TATIN ENTERA',
    'Torte Eszterhazy', 'Tropézienne',
    'Goloso', 'Sobrasada', 'caja panettone', 'PANETTONE 500 GR. CLASICO', 'PANETTONE CHOCO 500 GR.',
    -- cereza y ciruela se registran por separado a partir de ahora
    'Galette cereza / ciruela'
  );
  get diagnostics n = row_count;
  if n <> 45 then raise exception 'Ocultar: esperados 45, actualizados %', n; end if;

  -- Reclasificar. Al cambiar de sección pierden su posición de plantilla y
  -- van al final de la nueva, por nombre.
  for r in select * from (values
    ('Pan', 'CHAPATA espelta 15%'), ('Pan', 'ESPELTA Y AVENA'), ('Pan', 'MOLDE TRIGO INTEGRAL 100%'),
    ('Pasteles', 'Chausson aux pommes'), ('Pasteles', 'Danish'), ('Pasteles', 'Danish mini'),
    ('Pasteles', 'GALETTE DE CEREZA ÁCIDA Y ESPELTA'), ('Pasteles', 'Galette de ciruela'),
    ('Pasteles', 'GALETTE DE MANZANA'), ('Pasteles', 'galette pistacho ruibarbo'),
    ('Pasteles', 'Brioche tonka'), ('Pasteles', 'Danish pera y gorgonzola'),
    ('Salados', 'CESTA CON SETAS Y QUESO COMTE'), ('Salados', 'Danish Salado'),
    ('Salados', 'EMPANADA DE setas'), ('Salados', 'FOCACCIA ESPECIAL'),
    ('Salados', 'Focaccia sobrasada ricotta'),
    ('Tartas y brownies', 'brownie avellana tahini caramelo'), ('Tartas y brownies', 'BROWNIE con cheesecake'),
    ('Tartas y brownies', 'CARROT CAKE DE ESPELTA, MIEL Y FRUTAS'), ('Tartas y brownies', 'Cheesecake maracuyá'),
    ('Tartas y brownies', 'Marmolado'), ('Tartas y brownies', 'Matcha cheesecake'),
    ('Tartas y brownies', 'TARTA DE CHOCOLATE Y CARAMELO SALADO'), ('Tartas y brownies', 'TARTA DE PISTACHO Y MORAS'),
    ('Tartas y brownies', 'TARTA DE QUESO'), ('Tartas y brownies', 'TARTA ESPECIAL'),
    ('Tartas y brownies', 'Tarta ganache'), ('Tartas y brownies', 'TARTE TATIN'),
    ('Bizcochos y cookies', 'BANANA BREAD CON NUECES Y CHOCOLATE'), ('Bizcochos y cookies', 'CHOCOLATE, CALABACíN Y AOVE'),
    ('Bizcochos y cookies', 'LIMON Y AMAPOLA'), ('Bizcochos y cookies', 'ORANGE CAKE GLUTEN FREE, LACTOSE FREE'),
    ('Bizcochos y cookies', 'Cookie'), ('Bizcochos y cookies', 'Cookie avellana'),
    ('Bizcochos y cookies', 'Cookie banana'), ('Bizcochos y cookies', 'Cookie choco'),
    ('Bizcochos y cookies', 'Cookie pistacho'),
    ('Quiche', 'Quiche boniato'), ('Quiche', 'QUICHE BROCOLI'), ('Quiche', 'QUICHE de tomate y espinaca'),
    ('Quiche', 'Quiche Lorraine'), ('Quiche', 'quiche parmigiano brocoli cebollino'), ('Quiche', 'quiche verano'),
    ('Otros', 'Nanterre')
  ) as v(section, name)
  loop
    update public.products set leftovers_family = r.section, leftovers_order = null
    where name = r.name and is_obrador;
    if not found then raise exception 'Reclasificar: no encontrado %', r.name; end if;
  end loop;
end;
$$;
