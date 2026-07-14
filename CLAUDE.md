# App Obrador — instrucciones para Claude

## Regla nº 1 — UBICACIÓN DEL PROYECTO (crítica)
- Este proyecto vive en `C:\Borja\El Obrador\App-Obrador`. **SIEMPRE aquí.**
- **PROHIBIDO trabajar, crear o mover archivos a ninguna ruta dentro de OneDrive**
  (`C:\Users\Borja Saenz\OneDrive - REOLUM\...`). OneDrive ya corrompió y revirtió
  trabajo de este proyecto (2026-07-02): borró archivos, dejó placeholders ilegibles
  y rompió node_modules. Si el usuario abre una sesión en una ruta de OneDrive,
  avísale y trabaja en `C:\Borja\El Obrador`.
- Los datos originales del ERP (CSV/Excel) siguen en OneDrive → `...\El Obrador\Datos`
  (solo-nube). Sus datos ya están cargados en Supabase; no depender de esos archivos.

## Qué es
App móvil tablet-first (Expo SDK 54 + React Native + TypeScript + Expo Router) para
gestión de un obrador/pastelería: analítica de ventas, stock (ingredientes + producto),
producción, planificación con predicción y mejora continua, e importador de ventas ERP.
Objetivo: venderla al obrador. GitHub: `borjassm/App-Obrador` (rama de trabajo:
`fase0-fase1-stock-perdidas`; `main` se mantiene sincronizada para Claude Design).

## Backend — Supabase
- Proyecto: **"Obrador App"** = `yjdctletbgmqiutnibwn` (eu-west-2). Plan free:
  **se pausa solo**; si la BD no responde, restaurarla y esperar 1-2 min
  (ojo: justo tras restaurar, `list_tables` puede devolver vacío — reconsultar).
- Datos reales cargados: ventas 2025 completas (51.508 filas en `sales_daily`,
  ~2,58 M€), 286+ productos, 50 costes, sobrantes, producción, 15 ingredientes.
  **NUNCA reimportar a ciegas** (riesgo de duplicados); el importador de la app es
  idempotente por `(location_id, sale_date, product_id, source)`.
- El esquema del repo se mantiene con migraciones en `supabase/migrations/`
  (0001–0004). La 0004 contiene el motor analítico (funciones RPC `analytics_*`
  y `planning_*`). Cambios de BD SIEMPRE vía migración versionada + archivo en repo.

## Entorno de desarrollo (Windows)
- Node portable en `C:\Users\Borja Saenz\nodejs\node-v24.18.0-win-x64` (está en el
  PATH de usuario; en shells nuevos puede hacer falta anteponerlo al PATH).
- Python: usar el lanzador `py` (el comando `python` choca con el alias de MS Store).
- Verificar con `npm run typecheck`. Web: `npx expo start --web` → http://localhost:8081.
- Login app: borjassm@gmail.com (único usuario en Supabase Auth).

## Reglas de trabajo
- **Commitear con frecuencia** (el usuario lo aprobó como protección); preguntar antes de push.
- Identidad git: borjassm / borjassm@gmail.com.
- `.env` (no versionado) se genera copiando `.env.example`.
- UI en español, tablet-first; reutilizar componentes de `components/` y el tema de
  `constants/theme.ts`.
- **Estilo visual (obligatorio en toda UI nueva o modificada):** seguir el rediseño v1
  (`design_handoff_rediseno_v1/README.md`). En la práctica: tokens de `constants/theme.ts`
  (paleta espresso/teal, fuente Manrope, Radius, Shadows casi planas), NUNCA emojis
  (iconos de `@expo/vector-icons`), números tabulares, touch targets >= 56px,
  segmented controls (FilterPills), sidebar lateral en tablet (>= 768px,
  `TABLET_BREAKPOINT`), pressed = opacity 0.85 + scale 0.98.
