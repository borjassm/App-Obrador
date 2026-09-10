-- 0013_envios.sql
--
-- BLOQUE D: envíos de producto entre lugares (la nave produce y reparte a
-- las tiendas; el Excel del cliente registra hasta 2 "viajes" por día).
-- Flujo: el repartidor crea el envío desde el origen; en el destino se
-- confirma la recepción cantidad a cantidad y las diferencias quedan a la
-- vista.

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_date date not null default current_date,
  origin_location_id uuid not null references public.locations(id),
  dest_location_id uuid not null references public.locations(id),
  trip smallint not null default 1 check (trip in (1, 2)),
  status text not null default 'enviado' check (status in ('enviado', 'recibido')),
  notes text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);
create index if not exists idx_shipments_date on public.shipments (shipment_date desc);

create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty_sent numeric(12,2) not null,
  qty_received numeric(12,2),
  comment text,
  unique (shipment_id, product_id)
);

alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;

-- Enviar y recibir es trabajo de los empleados: lectura y escritura para
-- cualquier usuario autenticado; borrar, solo admin
drop policy if exists auth_read_shipments on public.shipments;
create policy auth_read_shipments on public.shipments
  for select to authenticated using (true);
drop policy if exists auth_insert_shipments on public.shipments;
create policy auth_insert_shipments on public.shipments
  for insert to authenticated with check (true);
drop policy if exists auth_update_shipments on public.shipments;
create policy auth_update_shipments on public.shipments
  for update to authenticated using (true) with check (true);
drop policy if exists admin_delete_shipments on public.shipments;
create policy admin_delete_shipments on public.shipments
  for delete to authenticated using (public.is_admin());

drop policy if exists auth_read_shipment_items on public.shipment_items;
create policy auth_read_shipment_items on public.shipment_items
  for select to authenticated using (true);
drop policy if exists auth_insert_shipment_items on public.shipment_items;
create policy auth_insert_shipment_items on public.shipment_items
  for insert to authenticated with check (true);
drop policy if exists auth_update_shipment_items on public.shipment_items;
create policy auth_update_shipment_items on public.shipment_items
  for update to authenticated using (true) with check (true);
drop policy if exists admin_delete_shipment_items on public.shipment_items;
create policy admin_delete_shipment_items on public.shipment_items
  for delete to authenticated using (public.is_admin());
