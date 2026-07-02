-- 0004_analytics_engine.sql
--
-- MOTOR ANALÍTICO: funciones RPC para el dashboard de analítica, la
-- planificación de producción y la predicción con mejora continua.
-- Todas son STABLE y se ejecutan con los permisos del invocador (RLS aplica).

-- Fechas de último dato disponible (para que la UI ancle los periodos a datos reales)
create or replace function public.analytics_latest_dates()
returns table(latest_sale date, latest_session date, latest_production date)
language sql stable as $$
  select (select max(sale_date) from public.sales_daily),
         (select max(session_date) from public.daily_sessions),
         (select max(production_date) from public.production_entries);
$$;

-- Resumen de un periodo (ventas)
create or replace function public.analytics_overview(p_start date, p_end date)
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
  where sale_date between p_start and p_end;
$$;

-- Serie diaria de ingresos (para gráfico de tendencia)
create or replace function public.analytics_daily_series(p_start date, p_end date)
returns table(sale_date date, revenue numeric, units numeric)
language sql stable as $$
  select sale_date, round(sum(revenue),2), sum(sold_qty)
  from public.sales_daily
  where sale_date between p_start and p_end
  group by 1 order by 1;
$$;

-- Top productos por ingresos
create or replace function public.analytics_top_products(p_start date, p_end date, p_limit int default 10)
returns table(product_id uuid, name text, family text, units numeric, revenue numeric, revenue_share numeric)
language sql stable as $$
  with tot as (
    select nullif(sum(revenue),0) t from public.sales_daily where sale_date between p_start and p_end
  )
  select s.product_id, p.name, coalesce(p.family,'otros'),
         sum(s.sold_qty), round(sum(s.revenue),2),
         round(sum(s.revenue) / (select t from tot) * 100, 1)
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_start and p_end
  group by 1,2,3
  order by sum(s.revenue) desc
  limit p_limit;
$$;

-- Desglose por familia
create or replace function public.analytics_family_breakdown(p_start date, p_end date)
returns table(family text, units numeric, revenue numeric, revenue_share numeric)
language sql stable as $$
  with tot as (
    select nullif(sum(revenue),0) t from public.sales_daily where sale_date between p_start and p_end
  )
  select coalesce(p.family,'otros'), sum(s.sold_qty), round(sum(s.revenue),2),
         round(sum(s.revenue) / (select t from tot) * 100, 1)
  from public.sales_daily s
  join public.products p on p.id = s.product_id
  where s.sale_date between p_start and p_end
  group by 1
  order by sum(s.revenue) desc;
$$;

-- Patrón por día de la semana (0=domingo … 6=sábado)
create or replace function public.analytics_weekday_pattern(p_start date, p_end date)
returns table(weekday int, avg_revenue numeric, avg_units numeric)
language sql stable as $$
  select extract(dow from sale_date)::int,
         round(avg(day_rev),2), round(avg(day_units),1)
  from (
    select sale_date, sum(revenue) day_rev, sum(sold_qty) day_units
    from public.sales_daily
    where sale_date between p_start and p_end
    group by sale_date
  ) d
  group by 1 order by 1;
$$;

-- Mermas valoradas en € (coste tirado y venta perdida)
create or replace function public.analytics_waste(p_start date, p_end date, p_limit int default 15)
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
  group by p.id, p.name, p.family
  having sum(dpe.discarded_qty) > 0 or sum(dpe.saved_qty) > 0
  order by sum(dpe.discarded_qty * coalesce(pc.unit_cost, 0)) desc
  limit p_limit;
$$;

-- Rentabilidad estimada por producto (solo productos con coste conocido)
create or replace function public.analytics_profitability(p_start date, p_end date, p_limit int default 15)
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
  group by p.id, p.name, p.family, pc.unit_cost
  order by (sum(s.revenue) - sum(s.sold_qty)*pc.unit_cost) desc
  limit p_limit;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PLANIFICACIÓN Y PREDICCIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Sugerencias de producción para una fecha: demanda por día de la semana
-- (media reciente ponderada con la histórica según trend_weight por producto),
-- +5% de seguridad, descontando lo guardado ayer (carryover).
create or replace function public.planning_suggestions(p_date date)
returns table(product_id uuid, name text, family text, suggested_qty int,
              base_recent numeric, base_hist numeric, carryover numeric,
              trend_weight numeric, confidence text, samples int)
language sql stable as $$
  with params as (
    select extract(dow from p_date)::int as dow,
           (select max(sale_date) from public.sales_daily) as latest
  ),
  recent as (
    select x.product_id, avg(x.q) a, count(*) n, coalesce(stddev_pop(x.q),0) sd
    from (
      select s.product_id, s.sale_date, sum(s.sold_qty) q
      from public.sales_daily s, params
      where extract(dow from s.sale_date)::int = params.dow
        and s.sale_date > params.latest - 70
      group by 1,2
    ) x group by 1
  ),
  hist as (
    select x.product_id, avg(x.q) a, count(*) n
    from (
      select s.product_id, s.sale_date, sum(s.sold_qty) q
      from public.sales_daily s, params
      where extract(dow from s.sale_date)::int = params.dow
      group by 1,2
    ) x group by 1
  ),
  carry as (
    select dpe.product_id, sum(dpe.saved_qty) saved
    from public.daily_product_entries dpe
    join public.daily_sessions ds on ds.id = dpe.daily_session_id
    where ds.session_date = (
      select max(session_date) from public.daily_sessions where session_date < p_date
    )
    group by 1
  )
  select p.id, p.name, coalesce(p.family,'otros'),
         greatest(0, round(
           ( coalesce(w.trend_weight,0.6) * coalesce(r.a, h.a, 0)
           + (1-coalesce(w.trend_weight,0.6)) * coalesce(h.a, 0) ) * 1.05
           - coalesce(c.saved, 0)
         ))::int,
         round(coalesce(r.a,0),1),
         round(coalesce(h.a,0),1),
         coalesce(c.saved,0),
         coalesce(w.trend_weight,0.6),
         case when coalesce(h.n,0) >= 20 and coalesce(r.n,0) >= 4 then 'high'
              when coalesce(h.n,0) >= 8 then 'medium'
              else 'low' end,
         coalesce(h.n,0)
  from public.products p
  left join recent r on r.product_id = p.id
  left join hist h on h.product_id = p.id
  left join carry c on c.product_id = p.id
  left join public.prediction_weights w on w.product_id = p.id
  where p.is_active and coalesce(h.a,0) > 0
  order by 4 desc;
$$;

-- Registrar precisión del plan (plan vs ventas reales) y MEJORA CONTINUA:
-- ajusta trend_weight hacia la base (reciente/histórica) que hubiese acertado más.
create or replace function public.planning_record_accuracy(p_date date)
returns integer
language plpgsql as $$
declare
  v_n integer := 0;
begin
  insert into public.prediction_weights (product_id)
  select id from public.products where is_active
  on conflict (product_id) do nothing;

  insert into public.prediction_accuracy (product_id, target_date, predicted_qty, actual_qty)
  select pl.product_id, pl.plan_date,
         coalesce(pl.override_qty, pl.suggested_qty),
         coalesce(sum(s.sold_qty), 0)::int
  from public.production_plans pl
  left join public.sales_daily s
    on s.product_id = pl.product_id and s.sale_date = pl.plan_date
  where pl.plan_date = p_date
  group by pl.product_id, pl.plan_date, coalesce(pl.override_qty, pl.suggested_qty)
  on conflict (product_id, target_date)
  do update set predicted_qty = excluded.predicted_qty, actual_qty = excluded.actual_qty;

  get diagnostics v_n = row_count;

  update public.prediction_weights w
  set trend_weight = least(0.90, greatest(0.20,
        w.trend_weight + case when t.recent_err < t.hist_err then 0.05 else -0.05 end)),
      updated_at = now()
  from (
    select pa.product_id,
           abs(coalesce(r.a,0) - pa.actual_qty) as recent_err,
           abs(coalesce(h.a,0) - pa.actual_qty) as hist_err
    from public.prediction_accuracy pa
    left join lateral (
      select avg(x.q) a from (
        select s.sale_date, sum(s.sold_qty) q
        from public.sales_daily s
        where extract(dow from s.sale_date) = extract(dow from pa.target_date)
          and s.product_id = pa.product_id
          and s.sale_date > (select max(sale_date) from public.sales_daily) - 70
        group by s.sale_date
      ) x
    ) r on true
    left join lateral (
      select avg(x.q) a from (
        select s.sale_date, sum(s.sold_qty) q
        from public.sales_daily s
        where extract(dow from s.sale_date) = extract(dow from pa.target_date)
          and s.product_id = pa.product_id
        group by s.sale_date
      ) x
    ) h on true
    where pa.target_date = p_date
  ) t
  where w.product_id = t.product_id
    and abs(t.recent_err - t.hist_err) > 0.5;

  return v_n;
end;
$$;

-- Estadísticas de precisión de las predicciones (para mostrar en Planificación)
create or replace function public.planning_accuracy_stats(p_days int default 60)
returns table(n bigint, mape numeric, hit_rate numeric)
language sql stable as $$
  with e as (
    select case when actual_qty = 0 and predicted_qty = 0 then 0
                when actual_qty = 0 then 100
                else abs(predicted_qty - actual_qty)::numeric / actual_qty * 100 end as err
    from public.prediction_accuracy
    where target_date > current_date - p_days
  )
  select count(*), round(avg(err),1),
         round(100.0 * avg(case when err <= 20 then 1 else 0 end), 1)
  from e;
$$;
