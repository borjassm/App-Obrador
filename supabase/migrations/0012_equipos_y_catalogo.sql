-- 0012_equipos_y_catalogo.sql
--
-- BLOQUE C (1/2): equipos de producción y catálogo de items por equipo,
-- validado por el cliente en sept 2026 (Excel "Catálogo por equipos").
-- Equipos: Panadería, Pastelería (incluye Double Bakes), Laminado, Horno y
-- Cocina (vacío, items pendientes). Los items pueden vincular a un producto
-- de venta (para plan/analítica) o ser tareas intermedias (masas, cremas…).

-- ── Esquema ──────────────────────────────────────────────────────────────

create table if not exists public.production_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team_production_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.production_teams(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  item_type text not null default 'final' check (item_type in ('final','tarea')),
  unit text not null default 'ud',
  display_order integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

create table if not exists public.team_item_locations (
  item_id uuid not null references public.team_production_items(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (item_id, location_id)
);

-- Hoja de trabajo diaria: el admin fija planned_qty desde Plan; el equipo
-- apunta produced_qty y comment desde Obrador. Misma fila = sync trivial.
create table if not exists public.team_production_entries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.team_production_items(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  production_date date not null,
  planned_qty numeric(12,2),
  produced_qty numeric(12,2),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, location_id, production_date)
);
create index if not exists idx_tpe_date_loc
  on public.team_production_entries (production_date, location_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_tpe_updated_at on public.team_production_entries;
create trigger trg_tpe_updated_at
  before update on public.team_production_entries
  for each row execute function public.set_updated_at();

-- Solo el admin puede fijar o cambiar el plan (planned_qty); el empleado
-- solo toca produced_qty y comment
create or replace function public.guard_planned_qty()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if (tg_op = 'INSERT' and new.planned_qty is not null)
       or (tg_op = 'UPDATE' and new.planned_qty is distinct from old.planned_qty) then
      raise exception 'Solo el administrador puede modificar el plan';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_tpe_guard_planned on public.team_production_entries;
create trigger trg_tpe_guard_planned
  before insert or update on public.team_production_entries
  for each row execute function public.guard_planned_qty();

-- RLS
alter table public.production_teams enable row level security;
alter table public.team_production_items enable row level security;
alter table public.team_item_locations enable row level security;
alter table public.team_production_entries enable row level security;

drop policy if exists auth_read_teams on public.production_teams;
create policy auth_read_teams on public.production_teams
  for select to authenticated using (true);
drop policy if exists admin_write_teams on public.production_teams;
create policy admin_write_teams on public.production_teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_read_team_items on public.team_production_items;
create policy auth_read_team_items on public.team_production_items
  for select to authenticated using (true);
drop policy if exists admin_write_team_items on public.team_production_items;
create policy admin_write_team_items on public.team_production_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_read_item_locations on public.team_item_locations;
create policy auth_read_item_locations on public.team_item_locations
  for select to authenticated using (true);
drop policy if exists admin_write_item_locations on public.team_item_locations;
create policy admin_write_item_locations on public.team_item_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_read_tpe on public.team_production_entries;
create policy auth_read_tpe on public.team_production_entries
  for select to authenticated using (true);
drop policy if exists auth_insert_tpe on public.team_production_entries;
create policy auth_insert_tpe on public.team_production_entries
  for insert to authenticated with check (true);
drop policy if exists auth_update_tpe on public.team_production_entries;
create policy auth_update_tpe on public.team_production_entries
  for update to authenticated using (true) with check (true);
drop policy if exists admin_delete_tpe on public.team_production_entries;
create policy admin_delete_tpe on public.team_production_entries
  for delete to authenticated using (public.is_admin());

-- Realtime para la sincronización Plan ↔ Obrador
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'team_production_entries'
     ) then
    alter publication supabase_realtime add table public.team_production_entries;
  end if;
end $$;

-- ── Seed: productos de venta nuevos ──────────────────────────────────────

insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Integral hogaza', 'panaderia', true, true, false, 50)
on conflict (name) do nothing;
insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Cheesecake maracuyá', 'dulce', true, true, false, 50)
on conflict (name) do nothing;
insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Coquito', 'dulce', true, true, false, 50)
on conflict (name) do nothing;
insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Marmolado', 'dulce', true, true, false, 50)
on conflict (name) do nothing;
insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Double bakes brioche', 'bolleria', true, true, false, 50)
on conflict (name) do nothing;
insert into public.products (name, family, is_active, is_obrador, is_custom, display_order)
values ('Brioche maitake setas', 'bolleria', true, true, false, 50)
on conflict (name) do nothing;

-- ── Seed: equipos ────────────────────────────────────────────────────────

insert into public.production_teams (name, display_order) values ('Panadería', 10)
on conflict (name) do update set display_order = excluded.display_order, is_active = true;
insert into public.production_teams (name, display_order) values ('Pastelería', 20)
on conflict (name) do update set display_order = excluded.display_order, is_active = true;
insert into public.production_teams (name, display_order) values ('Laminado', 30)
on conflict (name) do update set display_order = excluded.display_order, is_active = true;
insert into public.production_teams (name, display_order) values ('Horno', 40)
on conflict (name) do update set display_order = excluded.display_order, is_active = true;
insert into public.production_teams (name, display_order) values ('Cocina', 50)
on conflict (name) do update set display_order = excluded.display_order, is_active = true;

-- ── Seed: items por equipo y lugares ─────────────────────────────────────
-- locs: N = La Nave, O = Olavide Shop, J = Jorge Juan Shop

with data(team, product, item, tipo, unit, ord, nota, locs) as (
 values
  ('Panadería', 'Barra', 'Barra', 'final', 'ud', 10, null, 'N'),
  ('Panadería', 'PANCITO', 'Pancito', 'final', 'ud', 20, null, 'N'),
  ('Panadería', 'TRIGO BLANCO', 'Trigo blanco', 'final', 'ud', 30, null, 'N'),
  ('Panadería', 'Molde blanco', 'Molde blanco', 'final', 'ud', 40, null, 'N'),
  ('Panadería', 'SEMI INTEGRAL', 'Semi integral', 'final', 'ud', 50, null, 'N'),
  ('Panadería', 'SEMILLAS', 'Semillas', 'final', 'ud', 60, null, 'N'),
  ('Panadería', 'Molde integral', 'Molde integral', 'final', 'ud', 70, null, 'N'),
  ('Panadería', 'CENTENO', 'Centeno', 'final', 'ud', 80, null, 'N'),
  ('Panadería', 'PASAS Y NUECES', 'Pasas y nueces', 'final', 'ud', 90, null, 'N'),
  ('Panadería', 'Molde Pasas y Nueces', 'Molde pasas y nueces', 'final', 'ud', 100, null, 'N'),
  ('Panadería', 'Molde centeno', 'Molde centeno', 'final', 'ud', 110, null, 'N'),
  ('Panadería', 'Espelta semillas', 'Espelta semillas', 'final', 'ud', 120, null, 'N'),
  ('Panadería', 'Espelta simple', 'Espelta simple', 'final', 'ud', 130, null, 'N'),
  ('Panadería', 'Kalamata', 'Kalamata', 'final', 'ud', 140, null, 'N'),
  ('Panadería', 'Avena miel', 'Avena y miel', 'final', 'ud', 150, 'Mapeado al producto existente ''Avena miel''', 'N'),
  ('Panadería', 'Focaccia Entera Pedidos Tomate', 'Focaccia', 'final', 'ud', 160, 'Match corregido por el cliente', 'N'),
  ('Panadería', 'Goloso', 'Goloso', 'final', 'ud', 170, null, 'N'),
  ('Panadería', 'PAN TURCO', 'Turco', 'final', 'ud', 180, null, 'N'),
  ('Panadería', 'MOLDE TRIGO INTEGRAL 100%', 'Integral molde 100%', 'final', 'ud', 190, 'Mapeado al existente ''MOLDE TRIGO INTEGRAL 100%''', 'N'),
  ('Panadería', 'Integral hogaza', 'Integral hogaza', 'final', 'ud', 200, 'Producto nuevo', 'N'),
  ('Pastelería', 'Cookie', 'Avellana cookie', 'final', 'ud', 10, null, 'N'),
  ('Pastelería', 'Cookie', 'Avellana y tahini cookie', 'final', 'ud', 20, null, 'N'),
  ('Pastelería', 'BANANA BREAD CON NUECES Y CHOCOLATE', 'Banana bread', 'final', 'ud', 30, null, 'NO'),
  ('Pastelería', 'BIZCOCHO DE CALABACÍN Y CHOCOLATE. ENTERO.', 'Bizcocho calabacín', 'final', 'ud', 40, 'Mapeado al bizcocho de calabacín existente', 'NO'),
  ('Pastelería', 'ORANGE CAKE GLUTEN FREE. ENTERO.', 'Bizcochón de naranja', 'final', 'ud', 50, 'Mapeado al orange cake existente (confirmar)', 'NO'),
  ('Pastelería', 'BROWNIE con cheesecake', 'Brownies cheesecake', 'final', 'ud', 60, 'Mapeado al brownie existente', 'NO'),
  ('Pastelería', 'brownie avellana tahini caramelo', 'Brownies tahini', 'final', 'ud', 70, 'Mapeado al brownie existente', 'NO'),
  ('Pastelería', 'CARROT CAKE DE ESPELTA, MIEL Y FRUTAS', 'Carrot cake', 'final', 'ud', 80, null, 'NO'),
  ('Pastelería', 'TARTA DE QUESO ENTERA', 'Cheesecake', 'final', 'ud', 90, 'Match corregido: el Excel apuntaba a ''BROWNIE con cheesecake''', 'NO'),
  ('Pastelería', 'Cheesecake maracuyá', 'Cheesecake maracuyá', 'final', 'ud', 100, 'Producto nuevo. El cliente lo marcó sin lugar: provisional en La Nave', 'N'),
  ('Pastelería', 'Cookie', 'Choco cookie', 'final', 'ud', 110, null, 'N'),
  ('Pastelería', 'Cookie banana', 'Cookie banana', 'final', 'ud', 120, null, 'N'),
  ('Pastelería', 'Cookie', 'Cookie vegano', 'final', 'ud', 130, 'El cliente lo marcó sin lugar: provisional en La Nave', 'N'),
  ('Pastelería', 'Coquito', 'Coquito', 'final', 'ud', 140, 'Producto nuevo', 'NO'),
  ('Pastelería', 'Bostock', 'Double bakes: bostock', 'final', 'placa (12)', 150, null, 'N'),
  ('Pastelería', 'Double bakes brioche', 'Double bakes: brioche', 'final', 'ud', 160, 'Producto nuevo', 'N'),
  ('Pastelería', 'Croissant almendra', 'Double bakes: croissant almendra', 'final', 'placa (20)', 170, null, 'N'),
  ('Pastelería', 'Croissant', 'Double bakes: croissant avellana', 'final', 'placa (20)', 180, null, 'N'),
  ('Pastelería', 'Croissant pistacho', 'Double bakes: croissant pistacho', 'final', 'placa (20)', 190, null, 'N'),
  ('Pastelería', 'LIMON Y AMAPOLA', 'Limón y amapola', 'final', 'ud', 200, null, 'NO'),
  ('Pastelería', 'Marmolado', 'Marmolado', 'final', 'ud', 210, 'Producto nuevo', 'N'),
  ('Pastelería', 'Nanterre', 'Nanterre', 'final', 'ud', 220, 'La masa y el boleado los hace Laminado', 'N'),
  ('Pastelería', 'NAPOLEÓN', 'Napoleón', 'final', 'ud', 230, null, 'NO'),
  ('Pastelería', 'Cookie', 'Pistacho cookie', 'final', 'ud', 240, null, 'NO'),
  ('Pastelería', 'Quiche boniato', 'Quiche boniato', 'final', 'ud', 250, null, 'N'),
  ('Pastelería', 'Quiche Lorraine', 'Quiche lorraine', 'final', 'ud', 260, null, 'NO'),
  ('Pastelería', 'Quiche', 'Quiche tomate', 'final', 'ud', 270, null, 'NO'),
  ('Pastelería', 'TARTA DE CHOCOLATE CON CARAMELO SALADO ENTERA', 'Tarta de choco', 'final', 'ud', 280, null, 'NO'),
  ('Pastelería', 'Tarta de limón', 'Tarta de limón', 'final', 'ud', 290, null, 'NO'),
  ('Pastelería', 'TARTA ESPECIAL', 'Tarta especial', 'final', 'ud', 300, null, 'NO'),
  ('Pastelería', 'TARTE TATIN', 'Tarte tatin', 'final', 'ud', 310, null, 'NO'),
  ('Pastelería', null, 'Arándanos confitura', 'tarea', 'kg', 320, null, 'NO'),
  ('Pastelería', null, 'Bacon prep para quiche', 'tarea', 'kg', 330, 'Antes ''Jamón prep'': el cliente aclara que es bacon', 'N'),
  ('Pastelería', null, 'Caramelo', 'tarea', 'kg', 340, 'Alimenta tarta de choco, brownies, kouign amann, napoleón y cookies', 'NO'),
  ('Pastelería', null, 'Cortar invert p/ chausson', 'tarea', 'ud', 350, null, 'N'),
  ('Pastelería', null, 'Crema pastelera', 'tarea', 'kg', 360, null, 'NO'),
  ('Pastelería', null, 'Cremeux de queso crema', 'tarea', 'kg', 370, null, 'NO'),
  ('Pastelería', null, 'Frambuesa confitura', 'tarea', 'kg', 380, null, 'N'),
  ('Pastelería', null, 'Frangipane almendra', 'tarea', 'kg', 390, null, 'N'),
  ('Pastelería', null, 'Frangipane avellana', 'tarea', 'kg', 400, null, 'N'),
  ('Pastelería', null, 'Frangipane pistacho', 'tarea', 'kg', 410, null, 'NO'),
  ('Pastelería', null, 'Frosting carrot', 'tarea', 'kg', 420, null, 'NO'),
  ('Pastelería', null, 'Frosting cheesecake', 'tarea', 'kg', 430, null, 'N'),
  ('Pastelería', null, 'Galette blanca masa', 'tarea', 'batch', 440, null, 'N'),
  ('Pastelería', null, 'Galette espelta masa', 'tarea', 'batch', 450, null, 'N'),
  ('Pastelería', null, 'Ganache para mármol', 'tarea', 'kg', 460, null, 'NO'),
  ('Pastelería', null, 'Laminar quiche', 'tarea', 'ud', 470, null, 'N'),
  ('Pastelería', null, 'Laminar y cortar galette blanca', 'tarea', 'ud', 480, null, 'N'),
  ('Pastelería', null, 'Laminar y cortar galette espelta', 'tarea', 'ud', 490, null, 'N'),
  ('Pastelería', null, 'Lemon curd', 'tarea', 'kg', 500, null, 'NO'),
  ('Pastelería', null, 'Montar chausson', 'tarea', 'ud', 510, null, 'N'),
  ('Pastelería', null, 'Montar galette de cereza', 'tarea', 'ud', 520, null, 'N'),
  ('Pastelería', null, 'Montar galette de tomate', 'tarea', 'ud', 530, null, 'N'),
  ('Pastelería', null, 'Pastelera para Napoleón', 'tarea', 'kg', 540, null, 'NO'),
  ('Pastelería', null, 'Pate sucrée masa', 'tarea', 'batch', 550, null, 'N'),
  ('Pastelería', null, 'Praliné', 'tarea', 'kg', 560, null, 'NO'),
  ('Pastelería', null, 'Puerro prep para quiche', 'tarea', 'kg', 570, null, 'N'),
  ('Pastelería', null, 'Quiche masa', 'tarea', 'batch', 580, 'Las masas se hacen solo en la nave y se mandan a Olavide', 'N'),
  ('Pastelería', null, 'Relleno de empanada', 'tarea', 'kg', 590, null, 'N'),
  ('Pastelería', null, 'Relleno manzana', 'tarea', 'kg', 600, null, 'N'),
  ('Pastelería', null, 'Syrope double bakes', 'tarea', 'kg', 610, null, 'NO'),
  ('Pastelería', null, 'Syrope vainilla', 'tarea', 'kg', 620, null, 'NO'),
  ('Laminado', 'Croissant', 'Croissant', 'final', 'ud', 10, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Pain au chocolat', 'Pain au chocolat', 'final', 'ud', 20, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'CANELA ROLL', 'Canela roll', 'final', 'ud', 30, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'CROISSANT DE JAMON Y QUESO', 'Jamón y queso', 'final', 'ud', 40, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'CARACOLA DE CHOCOLATE', 'Caracola de chocolate', 'final', 'ud', 50, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Caracola de pistacho', 'Caracola pistacho', 'final', 'ud', 60, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Danish', 'Danish', 'final', 'ud', 70, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Danish mini', 'Mini danish', 'final', 'ud', 80, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Mimolette', 'Mimolette', 'final', 'ud', 90, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Flan Parisien', 'Flan', 'final', 'ud', 100, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'PAIN SUISSE', 'Pain suisse', 'final', 'ud', 110, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'pain suisse cafe', 'Pain suisse café', 'final', 'ud', 120, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Kouign Amann', 'Kouign amann', 'final', 'ud', 130, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'ricotta bun', 'Ricotta bun', 'final', 'ud', 140, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Nanterre', 'Nanterre', 'final', 'ud', 150, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Brioche croissant', 'Brioche croissant', 'final', 'ud', 160, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', 'Brioche tonka', 'Brioche tonka', 'final', 'ud', 170, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', null, 'Brioche normal', 'final', 'ud', 180, 'Unidad por confirmar por el cliente (¿bandejas?)', 'N'),
  ('Laminado', null, 'Flip flop', 'tarea', 'ud', 190, null, 'N'),
  ('Laminado', null, 'Masa invert', 'tarea', 'ud', 200, null, 'N'),
  ('Laminado', null, 'Bolear brioche hamburguesa', 'tarea', 'ud', 210, 'Antes en Pastelería: lo hace Laminado', 'N'),
  ('Laminado', null, 'Bolear tonka', 'tarea', 'ud', 220, 'Antes en Pastelería: lo hace Laminado', 'N'),
  ('Horno', 'Croissant', 'Croissant', 'final', 'ud', 10, null, 'NO'),
  ('Horno', 'Pain au chocolat', 'PAC (pain au chocolat)', 'final', 'ud', 20, null, 'NO'),
  ('Horno', 'CROISSANT DE JAMON Y QUESO', 'Jamón y queso', 'final', 'ud', 30, null, 'NO'),
  ('Horno', 'Mimolette', 'Mimolette piparra', 'final', 'ud', 40, null, 'NO'),
  ('Horno', 'Danish', 'Danish lemon curd', 'final', 'ud', 50, 'Las danish se terminan individualmente en cada local', 'NO'),
  ('Horno', 'Danish', 'Danish flip flop', 'final', 'ud', 60, 'Las danish se terminan individualmente en cada local', 'NO'),
  ('Horno', 'Danish patata', 'Danish patatas', 'final', 'ud', 70, 'Las danish se terminan individualmente en cada local', 'NO'),
  ('Horno', 'Danish', 'Danish con setas', 'final', 'ud', 80, 'Brioche de setas. Las danish se terminan individualmente en cada local', 'NO'),
  ('Horno', 'ricotta bun', 'Ricotta vainilla bun', 'final', 'ud', 90, 'Mapeado al ''ricotta bun'' existente', 'NO'),
  ('Horno', 'CANELA ROLL', 'Canela roll', 'final', 'placa', 100, null, 'NO'),
  ('Horno', 'CARACOLA DE CHOCOLATE', 'Caracola de choco', 'final', 'ud', 110, null, 'NO'),
  ('Horno', 'Caracola de pistacho', 'Caracola pistacho', 'final', 'ud', 120, 'Mapeado a ''Caracola de pistacho'' existente', 'NO'),
  ('Horno', 'PAIN SUISSE', 'Pain suisse clásico', 'final', 'ud', 130, null, 'NO'),
  ('Horno', 'pain suisse cafe', 'Pain suisse café', 'final', 'ud', 140, null, 'NO'),
  ('Horno', 'KOUIGN AMANN CARDAMOMO', 'Kouign amann cardamomo', 'final', 'ud', 150, null, 'NO'),
  ('Horno', 'GALETTE DE CEREZA ÁCIDA Y ESPELTA', 'Galette de cereza', 'final', 'ud', 160, null, 'NO'),
  ('Horno', 'Galette de tomate', 'Galette de tomate', 'final', 'ud', 170, null, 'NO'),
  ('Horno', 'Cardamom bun', 'Cardamom bun', 'final', 'ud', 180, 'A Olavide llega horneado de la nave', 'N'),
  ('Horno', 'CESTA CON CREMA DE VAINILLA Y FRAMBUESA', 'Cesta', 'final', 'ud', 190, null, 'NO'),
  ('Horno', 'Brioche tonka', 'Brioche tonka', 'final', 'ud', 200, null, 'NO'),
  ('Horno', 'BRIOCHE HAMBURGUESA', 'Brioche hamburguesa', 'final', 'ud', 210, null, 'NO'),
  ('Horno', 'Brioche maitake setas', 'Brioche maitake setas', 'final', 'ud', 220, 'Producto nuevo', 'NO'),
  ('Horno', 'Danish', 'Mango danish', 'final', 'ud', 230, null, 'NO'),
  ('Horno', 'Chausson aux pommes', 'Chausson', 'final', 'ud', 240, 'Mapeado a ''Chausson aux pommes'' existente', 'N'),
  ('Horno', 'Nanterre', 'Nanterre', 'final', 'ud', 250, null, 'NO'),
  ('Horno', 'Brioche croissant', 'Brioche croissant', 'final', 'ud', 260, null, 'NO'),
  ('Horno', null, 'Quiche masa (hornear)', 'tarea', 'ud', 270, null, 'NO'),
  ('Horno', null, 'Invert masa', 'tarea', 'ud', 280, null, 'NO')
)
insert into public.team_production_items (team_id, product_id, name, item_type, unit, display_order, notes)
select t.id, p.id, d.item, d.tipo, d.unit, d.ord, d.nota
from data d
join public.production_teams t on t.name = d.team
left join public.products p on p.name = d.product
on conflict (team_id, name) do update set product_id = excluded.product_id,
  item_type = excluded.item_type, unit = excluded.unit,
  display_order = excluded.display_order, notes = excluded.notes, is_active = true;

with data(team, item, locs) as (
 values
  ('Panadería', 'Barra', 'N'),
  ('Panadería', 'Pancito', 'N'),
  ('Panadería', 'Trigo blanco', 'N'),
  ('Panadería', 'Molde blanco', 'N'),
  ('Panadería', 'Semi integral', 'N'),
  ('Panadería', 'Semillas', 'N'),
  ('Panadería', 'Molde integral', 'N'),
  ('Panadería', 'Centeno', 'N'),
  ('Panadería', 'Pasas y nueces', 'N'),
  ('Panadería', 'Molde pasas y nueces', 'N'),
  ('Panadería', 'Molde centeno', 'N'),
  ('Panadería', 'Espelta semillas', 'N'),
  ('Panadería', 'Espelta simple', 'N'),
  ('Panadería', 'Kalamata', 'N'),
  ('Panadería', 'Avena y miel', 'N'),
  ('Panadería', 'Focaccia', 'N'),
  ('Panadería', 'Goloso', 'N'),
  ('Panadería', 'Turco', 'N'),
  ('Panadería', 'Integral molde 100%', 'N'),
  ('Panadería', 'Integral hogaza', 'N'),
  ('Pastelería', 'Avellana cookie', 'N'),
  ('Pastelería', 'Avellana y tahini cookie', 'N'),
  ('Pastelería', 'Banana bread', 'NO'),
  ('Pastelería', 'Bizcocho calabacín', 'NO'),
  ('Pastelería', 'Bizcochón de naranja', 'NO'),
  ('Pastelería', 'Brownies cheesecake', 'NO'),
  ('Pastelería', 'Brownies tahini', 'NO'),
  ('Pastelería', 'Carrot cake', 'NO'),
  ('Pastelería', 'Cheesecake', 'NO'),
  ('Pastelería', 'Cheesecake maracuyá', 'N'),
  ('Pastelería', 'Choco cookie', 'N'),
  ('Pastelería', 'Cookie banana', 'N'),
  ('Pastelería', 'Cookie vegano', 'N'),
  ('Pastelería', 'Coquito', 'NO'),
  ('Pastelería', 'Double bakes: bostock', 'N'),
  ('Pastelería', 'Double bakes: brioche', 'N'),
  ('Pastelería', 'Double bakes: croissant almendra', 'N'),
  ('Pastelería', 'Double bakes: croissant avellana', 'N'),
  ('Pastelería', 'Double bakes: croissant pistacho', 'N'),
  ('Pastelería', 'Limón y amapola', 'NO'),
  ('Pastelería', 'Marmolado', 'N'),
  ('Pastelería', 'Nanterre', 'N'),
  ('Pastelería', 'Napoleón', 'NO'),
  ('Pastelería', 'Pistacho cookie', 'NO'),
  ('Pastelería', 'Quiche boniato', 'N'),
  ('Pastelería', 'Quiche lorraine', 'NO'),
  ('Pastelería', 'Quiche tomate', 'NO'),
  ('Pastelería', 'Tarta de choco', 'NO'),
  ('Pastelería', 'Tarta de limón', 'NO'),
  ('Pastelería', 'Tarta especial', 'NO'),
  ('Pastelería', 'Tarte tatin', 'NO'),
  ('Pastelería', 'Arándanos confitura', 'NO'),
  ('Pastelería', 'Bacon prep para quiche', 'N'),
  ('Pastelería', 'Caramelo', 'NO'),
  ('Pastelería', 'Cortar invert p/ chausson', 'N'),
  ('Pastelería', 'Crema pastelera', 'NO'),
  ('Pastelería', 'Cremeux de queso crema', 'NO'),
  ('Pastelería', 'Frambuesa confitura', 'N'),
  ('Pastelería', 'Frangipane almendra', 'N'),
  ('Pastelería', 'Frangipane avellana', 'N'),
  ('Pastelería', 'Frangipane pistacho', 'NO'),
  ('Pastelería', 'Frosting carrot', 'NO'),
  ('Pastelería', 'Frosting cheesecake', 'N'),
  ('Pastelería', 'Galette blanca masa', 'N'),
  ('Pastelería', 'Galette espelta masa', 'N'),
  ('Pastelería', 'Ganache para mármol', 'NO'),
  ('Pastelería', 'Laminar quiche', 'N'),
  ('Pastelería', 'Laminar y cortar galette blanca', 'N'),
  ('Pastelería', 'Laminar y cortar galette espelta', 'N'),
  ('Pastelería', 'Lemon curd', 'NO'),
  ('Pastelería', 'Montar chausson', 'N'),
  ('Pastelería', 'Montar galette de cereza', 'N'),
  ('Pastelería', 'Montar galette de tomate', 'N'),
  ('Pastelería', 'Pastelera para Napoleón', 'NO'),
  ('Pastelería', 'Pate sucrée masa', 'N'),
  ('Pastelería', 'Praliné', 'NO'),
  ('Pastelería', 'Puerro prep para quiche', 'N'),
  ('Pastelería', 'Quiche masa', 'N'),
  ('Pastelería', 'Relleno de empanada', 'N'),
  ('Pastelería', 'Relleno manzana', 'N'),
  ('Pastelería', 'Syrope double bakes', 'NO'),
  ('Pastelería', 'Syrope vainilla', 'NO'),
  ('Laminado', 'Croissant', 'N'),
  ('Laminado', 'Pain au chocolat', 'N'),
  ('Laminado', 'Canela roll', 'N'),
  ('Laminado', 'Jamón y queso', 'N'),
  ('Laminado', 'Caracola de chocolate', 'N'),
  ('Laminado', 'Caracola pistacho', 'N'),
  ('Laminado', 'Danish', 'N'),
  ('Laminado', 'Mini danish', 'N'),
  ('Laminado', 'Mimolette', 'N'),
  ('Laminado', 'Flan', 'N'),
  ('Laminado', 'Pain suisse', 'N'),
  ('Laminado', 'Pain suisse café', 'N'),
  ('Laminado', 'Kouign amann', 'N'),
  ('Laminado', 'Ricotta bun', 'N'),
  ('Laminado', 'Nanterre', 'N'),
  ('Laminado', 'Brioche croissant', 'N'),
  ('Laminado', 'Brioche tonka', 'N'),
  ('Laminado', 'Brioche normal', 'N'),
  ('Laminado', 'Flip flop', 'N'),
  ('Laminado', 'Masa invert', 'N'),
  ('Laminado', 'Bolear brioche hamburguesa', 'N'),
  ('Laminado', 'Bolear tonka', 'N'),
  ('Horno', 'Croissant', 'NO'),
  ('Horno', 'PAC (pain au chocolat)', 'NO'),
  ('Horno', 'Jamón y queso', 'NO'),
  ('Horno', 'Mimolette piparra', 'NO'),
  ('Horno', 'Danish lemon curd', 'NO'),
  ('Horno', 'Danish flip flop', 'NO'),
  ('Horno', 'Danish patatas', 'NO'),
  ('Horno', 'Danish con setas', 'NO'),
  ('Horno', 'Ricotta vainilla bun', 'NO'),
  ('Horno', 'Canela roll', 'NO'),
  ('Horno', 'Caracola de choco', 'NO'),
  ('Horno', 'Caracola pistacho', 'NO'),
  ('Horno', 'Pain suisse clásico', 'NO'),
  ('Horno', 'Pain suisse café', 'NO'),
  ('Horno', 'Kouign amann cardamomo', 'NO'),
  ('Horno', 'Galette de cereza', 'NO'),
  ('Horno', 'Galette de tomate', 'NO'),
  ('Horno', 'Cardamom bun', 'N'),
  ('Horno', 'Cesta', 'NO'),
  ('Horno', 'Brioche tonka', 'NO'),
  ('Horno', 'Brioche hamburguesa', 'NO'),
  ('Horno', 'Brioche maitake setas', 'NO'),
  ('Horno', 'Mango danish', 'NO'),
  ('Horno', 'Chausson', 'N'),
  ('Horno', 'Nanterre', 'NO'),
  ('Horno', 'Brioche croissant', 'NO'),
  ('Horno', 'Quiche masa (hornear)', 'NO'),
  ('Horno', 'Invert masa', 'NO')
)
insert into public.team_item_locations (item_id, location_id)
select i.id, l.id
from data d
join public.production_teams t on t.name = d.team
join public.team_production_items i on i.team_id = t.id and i.name = d.item
join public.locations l on (
  (position('N' in d.locs) > 0 and l.name = 'LOS URQUIZA 17') or
  (position('O' in d.locs) > 0 and l.name = 'SANTA FELICIANA 10') or
  (position('J' in d.locs) > 0 and l.name = 'NUEVA TIENDA')
)
on conflict do nothing;
