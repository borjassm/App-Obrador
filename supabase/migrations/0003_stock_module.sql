-- 0003_stock_module.sql
--
-- Módulo de Stock (Fase 1-B): control de stock de materia prima (ingredientes)
-- y de producto terminado. (Ya aplicada en la BD real.)

-- Stock de ingredientes: último recuento por ingrediente + alerta de mínimo
create or replace view public.v_ingredient_stock
with (security_invoker = on) as
select
  i.id,
  i.name,
  i.unit,
  i.category,
  i.min_stock_level,
  coalesce(le.quantity, 0)                                  as current_stock,
  le.entry_date                                             as last_count_date,
  (le.entry_date is not null
     and coalesce(le.quantity, 0) < coalesce(i.min_stock_level, 0)) as is_low
from public.ingredients i
left join lateral (
  select e.quantity, e.entry_date
  from public.inventory_entries e
  where e.ingredient_id = i.id
  order by e.entry_date desc
  limit 1
) le on true
where i.is_active is distinct from false;

-- Recuentos manuales de stock de PRODUCTO TERMINADO
create table if not exists public.product_stock_counts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  count_date date not null default current_date,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, count_date)
);

alter table public.product_stock_counts enable row level security;
drop policy if exists auth_rw_product_stock_counts on public.product_stock_counts;
create policy auth_rw_product_stock_counts on public.product_stock_counts
  for all to authenticated using (true) with check (true);

-- Stock de producto terminado: último recuento manual por producto
create or replace view public.v_product_stock
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.family,
  coalesce(lc.quantity, 0) as current_stock,
  lc.count_date            as last_count_date
from public.products p
left join lateral (
  select c.quantity, c.count_date
  from public.product_stock_counts c
  where c.product_id = p.id
  order by c.count_date desc
  limit 1
) lc on true
where p.is_active is distinct from false;
