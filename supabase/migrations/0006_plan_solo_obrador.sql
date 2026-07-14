-- 0006 — El plan de producción solo sugiere productos de obrador (2026-07-14)
--
-- planning_suggestions calculaba demanda sobre TODAS las ventas, con lo que
-- sugería planificar cafés, bebidas y otros artículos del ERP que no se
-- producen en la nave. Se filtra por products.is_obrador (introducido en 0005).
-- Única diferencia con la versión de 0004: `and p.is_obrador` en el WHERE final.

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
  where p.is_active and p.is_obrador and coalesce(h.a,0) > 0
  order by 4 desc;
$$;
