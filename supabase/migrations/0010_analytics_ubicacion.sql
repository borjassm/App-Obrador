-- 0010_analytics_ubicacion.sql
--
-- ANALÍTICA: filtro opcional de ubicación (p_location, null = todas) en todas
-- las funciones analytics_*, y dos series nuevas para el explorador de
-- gráficas (merma por fecha y serie de un producto concreto).
-- Se hace DROP + CREATE para no dejar sobrecargas ambiguas en PostgREST.

drop function if exists public.analytics_overview(date, date);
create or replace function public.analytics_overview(
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

drop function if exists public.analytics_daily_series(date, date);
create or replace function public.analytics_daily_series(
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

drop function if exists public.analytics_top_products(date, date, int);
create or replace function public.analytics_top_products(
  p_start date, p_end date, p_limit int default 10, p_location uuid default null
)
returns table(product_id uuid, name text, family text, units numeric, revenue numeric, revenue_share numeric)
language sql stable as $$
  with tot as (
    select nullif(sum(revenue),0) t from public.sales_daily
    where sale_date between p_start and p_end
      and (p_location is null or location_id = p_location)
  )
  select s.product_id, p.name, coalesce(p.family,'otros'),
         sum(s.sold_qty), round(sum(s.revenue),2),
         round(sum(s.revenue) / (select t from tot) * 100, 1)
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_start and p_end
    and (p_location is null or s.location_id = p_location)
  group by 1,2,3
  order by sum(s.revenue) desc
  limit p_limit;
$$;

drop function if exists public.analytics_family_breakdown(date, date);
create or replace function public.analytics_family_breakdown(
  p_start date, p_end date, p_location uuid default null
)
returns table(family text, units numeric, revenue numeric, revenue_share numeric)
language sql stable as $$
  with tot as (
    select nullif(sum(revenue),0) t from public.sales_daily
    where sale_date between p_start and p_end
      and (p_location is null or location_id = p_location)
  )
  select coalesce(p.family,'otros'), sum(s.sold_qty), round(sum(s.revenue),2),
         round(sum(s.revenue) / (select t from tot) * 100, 1)
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_start and p_end
    and (p_location is null or s.location_id = p_location)
  group by 1
  order by sum(s.revenue) desc;
$$;

drop function if exists public.analytics_weekday_pattern(date, date);
create or replace function public.analytics_weekday_pattern(
  p_start date, p_end date, p_location uuid default null
)
returns table(weekday int, avg_revenue numeric, avg_units numeric)
language sql stable as $$
  select extract(dow from sale_date)::int,
         round(avg(day_rev),2), round(avg(day_units),1)
  from (
    select sale_date, sum(revenue) day_rev, sum(sold_qty) day_units
    from public.sales_daily
    where sale_date between p_start and p_end
      and (p_location is null or location_id = p_location)
    group by sale_date
  ) d
  group by 1 order by 1;
$$;

drop function if exists public.analytics_waste(date, date, int);
create or replace function public.analytics_waste(
  p_start date, p_end date, p_limit int default 15, p_location uuid default null
)
returns table(product_id uuid, name text, family text, discarded numeric, saved numeric,
              waste_cost numeric, lost_revenue numeric)
language sql stable as $$
  select p.id, p.name, coalesce(p.family,'otros'),
         sum(dpe.discarded_qty),
         sum(dpe.saved_qty),
         round(sum(dpe.discarded_qty * coalesce(pc.unit_cost, 0)), 2),
         round(sum(dpe.discarded_qty * coalesce(p.sale_price, 0)), 2)
  from public.daily_product_entries dpe
  join public.daily_sessions ds on ds.id = dpe.daily_session_id
  join public.products p on p.id = dpe.product_id
  left join lateral (
    select c.unit_cost from public.product_costs c
    where c.product_id = p.id and c.valid_from <= ds.session_date
    order by c.valid_from desc limit 1
  ) pc on true
  where ds.session_date between p_start and p_end
    and (p_location is null or ds.location_id = p_location)
  group by p.id, p.name, p.family
  having sum(dpe.discarded_qty) > 0 or sum(dpe.saved_qty) > 0
  order by sum(dpe.discarded_qty * coalesce(pc.unit_cost, 0)) desc
  limit p_limit;
$$;

drop function if exists public.analytics_profitability(date, date, int);
create or replace function public.analytics_profitability(
  p_start date, p_end date, p_limit int default 15, p_location uuid default null
)
returns table(product_id uuid, name text, family text, units numeric, revenue numeric,
              unit_cost numeric, est_margin numeric, margin_pct numeric)
language sql stable as $$
  select p.id, p.name, coalesce(p.family,'otros'),
         sum(s.sold_qty), round(sum(s.revenue),2),
         pc.unit_cost,
         round(sum(s.revenue) - sum(s.sold_qty) * pc.unit_cost, 2),
         case when sum(s.revenue) = 0 then 0
              else round((sum(s.revenue) - sum(s.sold_qty)*pc.unit_cost) / sum(s.revenue) * 100, 1) end
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  join lateral (
    select c.unit_cost from public.product_costs c
    where c.product_id = p.id
    order by c.valid_from desc limit 1
  ) pc on true
  where s.sale_date between p_start and p_end
    and (p_location is null or s.location_id = p_location)
  group by p.id, p.name, p.family, pc.unit_cost
  order by (sum(s.revenue) - sum(s.sold_qty)*pc.unit_cost) desc
  limit p_limit;
$$;

-- Serie de merma por fecha (explorador de gráficas)
create or replace function public.analytics_waste_series(
  p_start date, p_end date, p_location uuid default null
)
returns table(session_date date, waste_qty numeric, waste_cost numeric)
language sql stable as $$
  select ds.session_date,
         sum(dpe.discarded_qty),
         round(sum(dpe.discarded_qty * coalesce(pc.unit_cost, 0)), 2)
  from public.daily_product_entries dpe
  join public.daily_sessions ds on ds.id = dpe.daily_session_id
  left join lateral (
    select c.unit_cost from public.product_costs c
    where c.product_id = dpe.product_id and c.valid_from <= ds.session_date
    order by c.valid_from desc limit 1
  ) pc on true
  where ds.session_date between p_start and p_end
    and (p_location is null or ds.location_id = p_location)
  group by 1 order by 1;
$$;

-- Serie diaria de un producto concreto (explorador de gráficas)
create or replace function public.analytics_product_series(
  p_start date, p_end date, p_product uuid, p_location uuid default null
)
returns table(sale_date date, revenue numeric, units numeric)
language sql stable as $$
  select sale_date, round(sum(revenue),2), sum(sold_qty)
  from public.sales_daily
  where sale_date between p_start and p_end
    and product_id = p_product
    and (p_location is null or location_id = p_location)
  group by 1 order by 1;
$$;
