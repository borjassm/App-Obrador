-- 0007 — El stock de producto terminado solo muestra productos de obrador (2026-07-14)
-- v_product_stock listaba los 281 productos activos, incluidos cafés y bebidas
-- del ERP que no tienen sentido en un recuento de producto terminado.
-- Única diferencia con 0003: `and p.is_obrador` en el WHERE.

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
where p.is_active is distinct from false
  and p.is_obrador;
