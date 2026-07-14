-- 0005 — Saneado de catálogo y ubicaciones (Fase 1 del rediseño funcional, 2026-07-14)
--
-- 1) products.is_obrador: distingue lo que se hornea en la nave (panes, bollería,
--    dulce, salado, focaccia, navidad) de los artículos de venta del ERP (cafés,
--    bebidas, extras, descuentos del TPV). Las pantallas de sobrantes, producción
--    y plan filtran por este flag.
-- 2) Fusión de los 5 duplicados por mayúsculas (BARRA/Barra, CROISSANT/Croissant,
--    PAIN AU CHOCOLAT/Pain au chocolat, LATTE/Latte, LIMONADA/Limonada). Las ventas
--    del ERP vivían en la variante en mayúsculas y la producción/sobrantes en la
--    otra: se remapea todo al canónico sumando en los conflictos, y se renombra a
--    capitalización normal (el importador casa por UPPER(name), no se rompe).
-- 3) Ubicaciones: se desactivan los duplicados vacíos de enero ("Deolavide - Tienda",
--    "Nave - Punto venta"; los datos reales viven en SANTA FELICIANA 10 y
--    LOS URQUIZA 17) y se da de alta NUEVA TIENDA (tercer punto de venta, nombre
--    pendiente de confirmar).

-- ── 1. Flag de producto de obrador ─────────────────────────────────────────
alter table public.products
  add column if not exists is_obrador boolean not null default false;

update public.products set is_obrador = (family is not null);

-- ── 2. Fusión de duplicados por mayúsculas ────────────────────────────────
do $$
declare
  pair record;
  canon uuid;
  dup uuid;
begin
  for pair in
    select * from (values
      ('BARRA', 'Barra'),
      ('CROISSANT', 'Croissant'),
      ('PAIN AU CHOCOLAT', 'Pain au chocolat'),
      ('LATTE', 'Latte'),
      ('LIMONADA', 'Limonada')
    ) as t(upper_name, nice_name)
  loop
    select id into canon from public.products where name = pair.upper_name;
    select id into dup from public.products where name = pair.nice_name;
    if canon is null or dup is null then
      continue;
    end if;

    -- Ventas: sumar donde chocan (location, fecha, source), remapear el resto
    update public.sales_daily s
      set sold_qty = s.sold_qty + d.sold_qty, revenue = s.revenue + d.revenue
      from public.sales_daily d
      where s.product_id = canon and d.product_id = dup
        and s.location_id = d.location_id and s.sale_date = d.sale_date and s.source = d.source;
    delete from public.sales_daily d
      using public.sales_daily s
      where d.product_id = dup and s.product_id = canon
        and s.location_id = d.location_id and s.sale_date = d.sale_date and s.source = d.source;
    update public.sales_daily set product_id = canon where product_id = dup;

    -- Producción: sumar donde choca la fecha, remapear el resto
    update public.production_entries s
      set quantity = s.quantity + d.quantity
      from public.production_entries d
      where s.product_id = canon and d.product_id = dup and s.production_date = d.production_date;
    delete from public.production_entries d
      using public.production_entries s
      where d.product_id = dup and s.product_id = canon and s.production_date = d.production_date;
    update public.production_entries set product_id = canon where product_id = dup;

    -- Sobrantes: sumar donde choca la sesión, remapear el resto
    update public.daily_product_entries s
      set saved_qty = s.saved_qty + d.saved_qty, discarded_qty = s.discarded_qty + d.discarded_qty
      from public.daily_product_entries d
      where s.product_id = canon and d.product_id = dup and s.daily_session_id = d.daily_session_id;
    delete from public.daily_product_entries d
      using public.daily_product_entries s
      where d.product_id = dup and s.product_id = canon and s.daily_session_id = d.daily_session_id;
    update public.daily_product_entries set product_id = canon where product_id = dup;

    -- Plan de producción (conserva la fila del canónico en conflicto)
    delete from public.production_plans d
      using public.production_plans s
      where d.product_id = dup and s.product_id = canon and s.plan_date = d.plan_date;
    update public.production_plans set product_id = canon where product_id = dup;

    -- Costes (unique product_id + valid_from)
    delete from public.product_costs d
      using public.product_costs s
      where d.product_id = dup and s.product_id = canon and s.valid_from = d.valid_from;
    update public.product_costs set product_id = canon where product_id = dup;

    -- Stock de producto terminado (unique product_id + count_date)
    delete from public.product_stock_counts d
      using public.product_stock_counts s
      where d.product_id = dup and s.product_id = canon and s.count_date = d.count_date;
    update public.product_stock_counts set product_id = canon where product_id = dup;

    -- Pesos de predicción y config de proceso (PK product_id)
    delete from public.prediction_weights d
      where d.product_id = dup
        and exists (select 1 from public.prediction_weights s where s.product_id = canon);
    update public.prediction_weights set product_id = canon where product_id = dup;

    delete from public.product_process_config d
      where d.product_id = dup
        and exists (select 1 from public.product_process_config s where s.product_id = canon);
    update public.product_process_config set product_id = canon where product_id = dup;

    -- Histórico de precisión (sin unique por producto: remapeo directo)
    update public.prediction_accuracy set product_id = canon where product_id = dup;

    -- El canónico hereda familia/atributos del duplicado si le faltaban
    update public.products c set
      family = coalesce(c.family, d.family),
      leftovers_family = coalesce(c.leftovers_family, d.leftovers_family),
      sale_price = coalesce(c.sale_price, d.sale_price),
      display_order = coalesce(c.display_order, d.display_order),
      is_obrador = c.is_obrador or d.is_obrador
      from public.products d
      where c.id = canon and d.id = dup;

    -- Eliminar duplicado y renombrar el canónico a capitalización normal
    delete from public.products where id = dup;
    update public.products set name = pair.nice_name where id = canon;
  end loop;
end $$;

-- ── 3. Ubicaciones ────────────────────────────────────────────────────────
alter table public.locations
  add column if not exists is_active boolean not null default true;

-- Borrar las sesiones vacías (0 entradas) de las ubicaciones duplicadas de enero
delete from public.daily_sessions ds
  using public.locations l
  where ds.location_id = l.id
    and l.name in ('Deolavide - Tienda', 'Nave - Punto venta')
    and not exists (select 1 from public.daily_product_entries e where e.daily_session_id = ds.id);

update public.locations set is_active = false
  where name in ('Deolavide - Tienda', 'Nave - Punto venta');

-- Tercer punto de venta, nombre pendiente de confirmar
insert into public.locations (name) values ('NUEVA TIENDA')
  on conflict (name) do nothing;
