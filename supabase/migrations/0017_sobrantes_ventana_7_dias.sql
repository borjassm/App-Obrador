-- 0017 — Sobrantes: solo se pueden modificar los últimos 7 días
--
-- Petición de Jaime (Alma Nomad, 16 y 27-oct-2026): poder volver a un día
-- anterior para corregirlo o rellenarlo, pero sin que se puedan cambiar datos
-- antiguos. La pantalla limita el selector a hoy + 7 días atrás; aquí se
-- aplica el mismo límite en la BD para que no dependa solo de la app.
--
-- Reglas (daily_sessions y daily_product_entries):
--   - Lectura: libre para autenticados.
--   - Insertar / modificar / borrar: solo si el día está entre
--     leftovers_today() - 7 y leftovers_today().
--   - Admin (is_admin()): sin límite, para correcciones excepcionales.
--   - service_role (importaciones) no pasa por RLS.
--
-- El 7 es el espejo de LEFTOVERS_EDIT_WINDOW_DAYS en lib/workday.ts: si cambia
-- uno, cambiar el otro.
--
-- La BD real tenía policies con nombres distintos a la 0001 (consultado en
-- pg_policies el 2026-10-27): "auth read|write|update sessions|entries",
-- todas permisivas con true y sin policy de DELETE. Se borran todas, con los
-- nombres reales y con los del repo.

-- ── Día de trabajo de sobrantes, igual que leftoversDayISO() de la app ─────
-- Hora de Madrid; hasta las 5:00 cuenta como el día anterior.
create or replace function public.leftovers_today()
returns date
language sql stable set search_path = public as $$
  select ((now() at time zone 'Europe/Madrid') - interval '5 hours')::date;
$$;

-- ¿Se puede escribir en el registro de sobrantes de ese día?
create or replace function public.leftovers_day_editable(d date)
returns boolean
language sql stable set search_path = public as $$
  select public.is_admin()
      or d between public.leftovers_today() - 7 and public.leftovers_today();
$$;

-- ── Quitar las policies antiguas (nombres reales y del repo) ───────────────
drop policy if exists "auth read sessions"   on public.daily_sessions;
drop policy if exists "auth write sessions"  on public.daily_sessions;
drop policy if exists "auth update sessions" on public.daily_sessions;
drop policy if exists auth_rw_daily_sessions on public.daily_sessions;

drop policy if exists "auth read entries"    on public.daily_product_entries;
drop policy if exists "auth write entries"   on public.daily_product_entries;
drop policy if exists "auth update entries"  on public.daily_product_entries;
drop policy if exists auth_rw_daily_entries  on public.daily_product_entries;

alter table public.daily_sessions enable row level security;
alter table public.daily_product_entries enable row level security;

-- ── daily_sessions ─────────────────────────────────────────────────────────
create policy leftovers_sessions_read on public.daily_sessions
  for select to authenticated using (true);

create policy leftovers_sessions_insert on public.daily_sessions
  for insert to authenticated
  with check (public.leftovers_day_editable(session_date));

-- using y with check: tampoco se puede mover un día a una fecha fuera de la ventana
create policy leftovers_sessions_update on public.daily_sessions
  for update to authenticated
  using (public.leftovers_day_editable(session_date))
  with check (public.leftovers_day_editable(session_date));

create policy leftovers_sessions_delete on public.daily_sessions
  for delete to authenticated
  using (public.leftovers_day_editable(session_date));

-- ── daily_product_entries: manda la fecha del día al que pertenece la línea ─
create policy leftovers_entries_read on public.daily_product_entries
  for select to authenticated using (true);

create policy leftovers_entries_insert on public.daily_product_entries
  for insert to authenticated
  with check (exists (
    select 1 from public.daily_sessions s
    where s.id = daily_session_id and public.leftovers_day_editable(s.session_date)
  ));

create policy leftovers_entries_update on public.daily_product_entries
  for update to authenticated
  using (exists (
    select 1 from public.daily_sessions s
    where s.id = daily_session_id and public.leftovers_day_editable(s.session_date)
  ))
  with check (exists (
    select 1 from public.daily_sessions s
    where s.id = daily_session_id and public.leftovers_day_editable(s.session_date)
  ));

create policy leftovers_entries_delete on public.daily_product_entries
  for delete to authenticated
  using (exists (
    select 1 from public.daily_sessions s
    where s.id = daily_session_id and public.leftovers_day_editable(s.session_date)
  ));
