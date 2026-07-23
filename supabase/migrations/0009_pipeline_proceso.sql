-- 0009_pipeline_proceso.sql
--
-- PIPELINE DE PRODUCCIÓN (Plan por fases amasar → fermentar → hornear).
-- 1) Completa product_process_config para los productos de obrador que no
--    tienen días de proceso, usando el valor ya establecido en su familia
--    (panaderia=1, bolleria=3, focaccia=2, salado=2, dulce=2, navidad=3).
--    No toca los valores existentes.
-- 2) RPC planning_location_split: reparto histórico Nave/Tienda por producto.

insert into public.product_process_config (product_id, process_days, notes)
select p.id,
       case p.family
         when 'panaderia' then 1
         when 'bolleria'  then 3
         when 'focaccia'  then 2
         when 'salado'    then 2
         when 'dulce'     then 2
         when 'navidad'   then 3
         else 2
       end,
       'default por familia'
from public.products p
where p.is_active and p.is_obrador
on conflict (product_id) do nothing;

-- Cuota histórica de la Nave por producto (último año de datos), para
-- repartir las cantidades del plan entre Nave y Tienda.
create or replace function public.planning_location_split()
returns table(product_id uuid, nave_share numeric)
language sql stable as $$
  with latest as (select max(sale_date) d from public.sales_daily)
  select s.product_id,
         round(sum(case when l.name = 'LOS URQUIZA 17' then s.sold_qty else 0 end)
               / nullif(sum(s.sold_qty), 0), 3)
  from public.sales_daily s
  join public.locations l on l.id = s.location_id, latest
  where s.sale_date > latest.d - 365
  group by s.product_id
  having sum(s.sold_qty) > 0;
$$;
