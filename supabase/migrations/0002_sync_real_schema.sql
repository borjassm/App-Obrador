-- 0002_sync_real_schema.sql
--
-- Sincroniza el esquema del repo con la base de datos REAL ("Obrador App",
-- yjdctletbgmqiutnibwn), que evolucionó por fuera de la migración 0001.
-- Esta migración es la fuente de verdad del esquema actual.
--
-- Es idempotente: sobre la BD real todas las sentencias son no-ops salvo la
-- activación de RLS al final. Sobre un despliegue limpio (tras 0001) reconcilia
-- las diferencias y crea las tablas que faltaban.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reconciliar tablas que ya existían en 0001 pero con columnas distintas
-- ─────────────────────────────────────────────────────────────────────────────

-- locations: la real solo tiene (id, name, created_at)
alter table public.locations drop column if exists kind;
alter table public.locations drop column if exists is_leftovers_primary;

-- products: columnas reales (family, is_active, display_order, is_custom, leftovers_family, sale_price)
alter table public.products drop column if exists unit;
alter table public.products drop column if exists is_weekend_special;
alter table public.products drop column if exists is_christmas_special;
alter table public.products add column if not exists display_order integer default 0;
alter table public.products add column if not exists is_custom boolean default false;
alter table public.products add column if not exists leftovers_family text;
alter table public.products add column if not exists sale_price numeric;

-- sales_daily: la real usa product_id/location_id (sin *_name) y añade source
alter table public.sales_daily drop column if exists location_name;
alter table public.sales_daily drop column if exists product_name;
alter table public.sales_daily add column if not exists source text not null default 'erp_import';

-- sales_raw: la real es staging plano (no JSONB)
alter table public.sales_raw drop column if exists source_file;
alter table public.sales_raw drop column if exists row_data;
alter table public.sales_raw drop column if exists imported_at;
alter table public.sales_raw add column if not exists sale_date date;
alter table public.sales_raw add column if not exists location_name text;
alter table public.sales_raw add column if not exists product_name text;
alter table public.sales_raw add column if not exists sold_qty numeric;
alter table public.sales_raw add column if not exists revenue numeric;
alter table public.sales_raw add column if not exists created_at timestamptz not null default now();

-- daily_sessions: real tiene notes/closed_at/closed_by y NO updated_at
alter table public.daily_sessions drop column if exists updated_at;
alter table public.daily_sessions add column if not exists notes text;
alter table public.daily_sessions add column if not exists closed_at timestamptz;
alter table public.daily_sessions add column if not exists closed_by uuid;

-- daily_product_entries: real usa discard_reason/comment, NO reason_code/updated_at
alter table public.daily_product_entries drop column if exists reason_code;
alter table public.daily_product_entries drop column if exists updated_at;
alter table public.daily_product_entries add column if not exists discard_reason text;
alter table public.daily_product_entries add column if not exists comment text;

-- production_teams existía en 0001 pero NO en la BD real
drop table if exists public.production_teams cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tablas que faltaban en el repo (producción, inventario, predicción, staging)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null default 'kg',
  min_stock_level numeric default 0,
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.inventory_entries (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id),
  entry_date date not null default current_date,
  quantity numeric not null,
  notes text,
  created_at timestamptz default now(),
  unique (ingredient_id, entry_date)
);

create table if not exists public.production_entries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  production_date date not null,
  quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, production_date)
);

create table if not exists public.production_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  product_id uuid not null references public.products(id),
  suggested_qty integer not null default 0,
  override_qty integer,
  override_at timestamptz,
  phase text not null default 'pending'
    check (phase = any (array['pending','amasado','fermentacion','horneado','completed'])),
  nave_qty integer not null default 0,
  tienda_qty integer not null default 0,
  confidence text check (confidence = any (array['low','medium','high'])),
  weather_factor numeric default 1.0,
  holiday_factor numeric default 1.0,
  created_at timestamptz default now(),
  unique (plan_date, product_id)
);

create table if not exists public.product_process_config (
  product_id uuid primary key references public.products(id),
  process_days integer not null default 3,
  notes text,
  updated_at timestamptz default now()
);

create table if not exists public.prediction_weights (
  product_id uuid primary key references public.products(id),
  trend_weight numeric not null default 0.60,
  updated_at timestamptz default now()
);

create table if not exists public.prediction_accuracy (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  target_date date not null,
  predicted_qty integer not null,
  actual_qty integer not null,
  error_pct numeric generated always as (
    case
      when predicted_qty = 0 and actual_qty = 0 then 0
      when predicted_qty = 0 then 100
      else round((abs(actual_qty - predicted_qty)::numeric / predicted_qty::numeric) * 100, 2)
    end
  ) stored,
  weather_factor numeric default 1.0,
  holiday_factor numeric default 1.0,
  created_at timestamptz default now(),
  unique (product_id, target_date)
);

create table if not exists public.leftovers_raw (
  id bigserial primary key,
  date date not null,
  product_name text not null,
  discarded_qty numeric not null,
  location_name text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seguridad: activar RLS en las tablas de staging (estaban expuestas) y
--    darles políticas equivalentes al resto (lectura/escritura autenticada).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sales_raw     enable row level security;
alter table public.leftovers_raw enable row level security;

drop policy if exists auth_rw_sales_raw     on public.sales_raw;
drop policy if exists auth_rw_leftovers_raw on public.leftovers_raw;

create policy auth_rw_sales_raw     on public.sales_raw     for all to authenticated using (true) with check (true);
create policy auth_rw_leftovers_raw on public.leftovers_raw for all to authenticated using (true) with check (true);

-- RLS + políticas para las tablas nuevas (mismo patrón que el resto del esquema)
alter table public.ingredients            enable row level security;
alter table public.inventory_entries      enable row level security;
alter table public.production_entries     enable row level security;
alter table public.production_plans       enable row level security;
alter table public.product_process_config enable row level security;
alter table public.prediction_weights     enable row level security;
alter table public.prediction_accuracy    enable row level security;

drop policy if exists auth_rw_ingredients            on public.ingredients;
drop policy if exists auth_rw_inventory_entries      on public.inventory_entries;
drop policy if exists auth_rw_production_entries     on public.production_entries;
drop policy if exists auth_rw_production_plans       on public.production_plans;
drop policy if exists auth_rw_product_process_config on public.product_process_config;
drop policy if exists auth_rw_prediction_weights     on public.prediction_weights;
drop policy if exists auth_rw_prediction_accuracy    on public.prediction_accuracy;

create policy auth_rw_ingredients            on public.ingredients            for all to authenticated using (true) with check (true);
create policy auth_rw_inventory_entries      on public.inventory_entries      for all to authenticated using (true) with check (true);
create policy auth_rw_production_entries     on public.production_entries     for all to authenticated using (true) with check (true);
create policy auth_rw_production_plans       on public.production_plans       for all to authenticated using (true) with check (true);
create policy auth_rw_product_process_config on public.product_process_config for all to authenticated using (true) with check (true);
create policy auth_rw_prediction_weights     on public.prediction_weights     for all to authenticated using (true) with check (true);
create policy auth_rw_prediction_accuracy    on public.prediction_accuracy    for all to authenticated using (true) with check (true);

commit;
