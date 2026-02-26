# App Obrador (tablet-first)

App móvil para control operativo diario en obrador/pastelería, diseñada para crecer a plataforma SaaS.

## Cambios clave aplicados según tu operativa real

- Arquitectura mantenida en **Expo Router + Tabs**.
- `login` fuera de tabs con **guard de sesión**.
- Ubicaciones reales incorporadas:
  - `LOS URQUIZA 17` (nave/producción)
  - `SANTA FELICIANA 10` (tienda + registro principal de leftovers)
- Cierre diario por producto con:
  - `saved_qty` (nuevo)
  - `discarded_qty` (actual negocio)
- Selección de **fecha** (default hoy) y **ubicación** en UI de cierre.
- Modelo preparado para:
  - productos especiales fin de semana
  - campaña de Navidad
  - `reason_code` futuro en merma
  - `product_costs` y predicción

## Estructura

- `app/login.tsx` login
- `app/(tabs)/index.tsx` inicio
- `app/(tabs)/close/index.tsx` cierre diario operativo
- `app/(tabs)/dashboard/index.tsx` analítica y predicción inicial
- `app/(tabs)/planning/index.tsx` planificación día anterior
- `app/(tabs)/settings/index.tsx` logout
- `supabase/migrations/0001_init_schema.sql` esquema reproducible
- `scripts/init.sql` seed con ubicaciones/equipos/productos base

## Arranque rápido

1) Instalar deps:

```bash
npm install
```

2) Variables:

```bash
cp .env.example .env
```

> Ya contiene tu proyecto Supabase (`yjdctletbgmqiutnibwn`).

3) Ejecutar SQL en Supabase SQL Editor:
- `supabase/migrations/0001_init_schema.sql`
- `scripts/init.sql`

4) Lanzar app:

```bash
npm run start
```

5) Abrir en tablet (Expo Go) o emulador.

## Esquema mínimo MVP (implementado)

- `locations (id, name, kind, is_leftovers_primary)`
- `products (id, name, family)`
- `sales_daily (sale_date, location_id/name, product_id/name, sold_qty, revenue)`
- `daily_sessions (id, location_id, session_date, status)`
- `daily_product_entries (daily_session_id, product_id, saved_qty, discarded_qty)`

Constraints:
- `daily_sessions unique(location_id, session_date)`
- `daily_product_entries unique(daily_session_id, product_id)`

## Nota ETL

Si ya tienes `sales_tidy`, puedes mapear a `sales_daily` manteniendo ids o nombres, y usar `sales_raw` como staging reproducible para nuevas cargas CSV (`;`).
