-- 0011_roles_admin_empleado.sql
--
-- ROLES: admin (dueño/gestor) vs empleado (usuario genérico del obrador).
-- El empleado registra el día a día (sobrantes, producción) y consulta el
-- plan, pero no ve ventas, costes ni gestiona el plan/predicción.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'empleado' check (role in ('admin', 'empleado')),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Cada usuario puede leer su propio rol (la app lo consulta al arrancar)
create policy user_roles_self_read on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- Helper para las policies: ¿el usuario actual es admin?
-- SECURITY DEFINER para poder leer user_roles saltando su propia RLS.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'admin' from public.user_roles where user_id = auth.uid()),
    false
  );
$$;

-- Seed de roles para los usuarios existentes (si el usuario aún no existe en
-- auth.users, habrá que insertar su fila al crearlo)
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where email in ('borjassm@gmail.com', 'info@almanomadbakery.com')
on conflict (user_id) do update set role = excluded.role, updated_at = now();

insert into public.user_roles (user_id, role)
select id, 'empleado' from auth.users
where email = 'tienda@almanomadbakery.com'
on conflict (user_id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Endurecer RLS: lo sensible pasa a solo-admin
-- ═══════════════════════════════════════════════════════════════════════════

-- Ventas: solo admin (el empleado no ve facturación; las RPC analytics_* y
-- sales_period_* corren como invocador, así que quedan vacías para empleados)
drop policy if exists "auth read sales" on public.sales_daily;
drop policy if exists "auth update sales" on public.sales_daily;
drop policy if exists "auth write sales" on public.sales_daily;
create policy admin_all_sales_daily on public.sales_daily
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_rw_sales_raw on public.sales_raw;
create policy admin_all_sales_raw on public.sales_raw
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_rw_leftovers_raw on public.leftovers_raw;
create policy admin_all_leftovers_raw on public.leftovers_raw
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Costes: solo admin
drop policy if exists auth_rw_product_costs on public.product_costs;
create policy admin_all_product_costs on public.product_costs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Predicción y configuración del plan: leer todos, escribir solo admin
drop policy if exists "Authenticated users can manage prediction_accuracy" on public.prediction_accuracy;
create policy admin_all_prediction_accuracy on public.prediction_accuracy
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can manage prediction_weights" on public.prediction_weights;
create policy admin_all_prediction_weights on public.prediction_weights
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists auth_rw_process_config on public.product_process_config;
create policy auth_read_process_config on public.product_process_config
  for select to authenticated using (true);
create policy admin_write_process_config on public.product_process_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Plan de producción: el empleado lo LEE (es su hoja de trabajo), solo el
-- admin lo escribe
drop policy if exists auth_rw_production_plans on public.production_plans;
create policy auth_read_production_plans on public.production_plans
  for select to authenticated using (true);
create policy admin_write_production_plans on public.production_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
