-- 0008_ventas_por_periodo.sql
--
-- PESTAÑA VENTAS: consultas de ventas por periodo arbitrario con filtro
-- opcional de ubicación. Mismo estilo que 0004: funciones STABLE, ejecutadas
-- con los permisos del invocador (RLS aplica).

-- Resumen de ventas de un periodo (opcionalmente de una sola ubicación)
create or replace function public.sales_period_summary(
  p_start date, p_end date, p_location uuid default null
)
returns table(total_revenue numeric, total_units numeric, active_products bigint,
              days_with_sales bigint, avg_daily_revenue numeric)
language sql stable as $$
  select coalesce(sum(revenue),0),
         coalesce(sum(sold_qty),0),
         count(distinct product_id),
         count(distinct sale_date),
         case when count(distinct sale_date)=0 then 0
              else round(sum(revenue)/count(distinct sale_date),2) end
  from public.sales_daily
  where sale_date between p_start and p_end
    and (p_location is null or location_id = p_location);
$$;

-- Serie diaria del periodo (para el gráfico de facturación)
create or replace function public.sales_period_series(
  p_start date, p_end date, p_location uuid default null
)
returns table(sale_date date, revenue numeric, units numeric)
language sql stable as $$
  select sale_date, round(sum(revenue),2), sum(sold_qty)
  from public.sales_daily
  where sale_date between p_start and p_end
    and (p_location is null or location_id = p_location)
  group by 1 order by 1;
$$;

-- Productos del periodo ordenados por facturación (tabla completa de Ventas)
create or replace function public.sales_period_products(
  p_start date, p_end date, p_location uuid default null, p_limit int default 200
)
returns table(product_id uuid, name text, family text, units numeric, revenue numeric,
              avg_units_per_day numeric, revenue_share numeric)
language sql stable as $$
  with tot as (
    select nullif(sum(revenue),0) t from public.sales_daily
    where sale_date between p_start and p_end
      and (p_location is null or location_id = p_location)
  )
  select s.product_id, p.name, coalesce(p.family,'otros'),
         sum(s.sold_qty), round(sum(s.revenue),2),
         round(sum(s.sold_qty) / count(distinct s.sale_date), 1),
         round(sum(s.revenue) / (select t from tot) * 100, 1)
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_start and p_end
    and (p_location is null or s.location_id = p_location)
  group by 1,2,3
  order by sum(s.revenue) desc
  limit p_limit;
$$;

-- Primera fecha con ventas (para el rango del modo "todo")
create or replace function public.sales_first_date()
returns date
language sql stable as $$
  select min(sale_date) from public.sales_daily;
$$;
