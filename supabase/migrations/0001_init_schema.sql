create extension if not exists "pgcrypto";

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'hybrid' check (kind in ('production', 'store', 'hybrid')),
  is_leftovers_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.production_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location_id uuid references public.locations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  family text,
  unit text not null default 'unit',
  is_weekend_special boolean not null default false,
  is_christmas_special boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_raw (
  id bigserial primary key,
  source_file text not null,
  row_data jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.sales_daily (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  location_id uuid references public.locations(id) on delete set null,
  location_name text,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  sold_qty numeric(12,2) not null,
  revenue numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_sales_daily_dedup
on public.sales_daily (sale_date, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(location_name, ''), coalesce(product_name, ''));


create table if not exists public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  session_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, session_date)
);

create table if not exists public.daily_product_entries (
  id uuid primary key default gen_random_uuid(),
  daily_session_id uuid not null references public.daily_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  saved_qty numeric(12,2) not null default 0,
  discarded_qty numeric(12,2) not null default 0,
  reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_session_id, product_id)
);

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  valid_from date not null,
  unit_cost numeric(12,4) not null,
  created_at timestamptz not null default now(),
  unique (product_id, valid_from)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_sessions_updated_at on public.daily_sessions;
create trigger trg_daily_sessions_updated_at
before update on public.daily_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_product_entries_updated_at on public.daily_product_entries;
create trigger trg_daily_product_entries_updated_at
before update on public.daily_product_entries
for each row execute function public.set_updated_at();

create or replace view public.v_product_operational_dashboard as
select
  sd.sale_date,
  coalesce(sd.product_id::text, p.id::text) as product_key,
  coalesce(sd.product_name, p.name) as product_name,
  sum(sd.sold_qty) as sold_qty,
  sum(coalesce(dpe.saved_qty, 0)) as saved_qty,
  sum(coalesce(dpe.discarded_qty, 0)) as discarded_qty,
  case when sum(sd.sold_qty + coalesce(dpe.discarded_qty, 0)) = 0 then 0
       else sum(coalesce(dpe.discarded_qty, 0)) / sum(sd.sold_qty + coalesce(dpe.discarded_qty, 0))
  end as waste_ratio
from public.sales_daily sd
left join public.products p on p.id = sd.product_id
left join public.daily_sessions ds on ds.location_id = sd.location_id and ds.session_date = sd.sale_date
left join public.daily_product_entries dpe on dpe.daily_session_id = ds.id and dpe.product_id = coalesce(sd.product_id, p.id)
group by 1,2,3;

create or replace view public.v_product_profitability as
select
  sd.sale_date,
  coalesce(sd.product_name, p.name) as product_name,
  sd.sold_qty,
  sd.revenue,
  coalesce(pc.unit_cost, 0) as unit_cost,
  (sd.revenue - (sd.sold_qty * coalesce(pc.unit_cost, 0))) as gross_margin
from public.sales_daily sd
left join public.products p on p.id = sd.product_id
left join lateral (
  select c.unit_cost
  from public.product_costs c
  where c.product_id = sd.product_id and c.valid_from <= sd.sale_date
  order by c.valid_from desc
  limit 1
) pc on true;

alter table public.locations enable row level security;
alter table public.production_teams enable row level security;
alter table public.products enable row level security;
alter table public.sales_raw enable row level security;
alter table public.sales_daily enable row level security;
alter table public.daily_sessions enable row level security;
alter table public.daily_product_entries enable row level security;
alter table public.product_costs enable row level security;

create policy auth_read_locations on public.locations for select to authenticated using (true);
create policy auth_read_teams on public.production_teams for select to authenticated using (true);
create policy auth_read_products on public.products for select to authenticated using (true);
create policy auth_rw_sales_raw on public.sales_raw for all to authenticated using (true) with check (true);
create policy auth_rw_sales_daily on public.sales_daily for all to authenticated using (true) with check (true);
create policy auth_rw_daily_sessions on public.daily_sessions for all to authenticated using (true) with check (true);
create policy auth_rw_daily_entries on public.daily_product_entries for all to authenticated using (true) with check (true);
create policy auth_rw_product_costs on public.product_costs for all to authenticated using (true) with check (true);
