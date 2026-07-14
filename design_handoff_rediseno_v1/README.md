# Handoff: Rediseño App Obrador v1

## Overview
Rediseño visual completo de App Obrador (borjassm/App-Obrador, Expo SDK 54 + React Native + TypeScript + Expo Router). Objetivos: aspecto más pulido/profesional (producto SaaS vendible), mejor usabilidad en tablet, jerarquía de datos más clara, sustituir emojis por iconos reales, y evolucionar la paleta cálida actual.

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** (`App Obrador Redesign.dc.html`) — prototipos que muestran el aspecto e intención, NO código de producción. La tarea es **recrear estos diseños en el codebase Expo/React Native existente**, usando sus patrones actuales: componentes en `components/`, tema en `constants/theme.ts`, rutas Expo Router en `app/`.

## Fidelity
**High-fidelity (hifi)**: colores, tipografía, espaciados y layout son finales. Recrear con precisión usando StyleSheet de React Native.

## Cambios estructurales clave (en orden de impacto)

1. **Navegación tablet: sidebar lateral en vez de tabs inferiores.** En pantallas anchas (>= 768px), reemplazar la tab bar inferior de `app/(tabs)/_layout.tsx` por un rail lateral izquierdo de 92px (fondo blanco, borde derecho `#EDE3D3`): logo arriba, items de nav (icono 23px + label 10px, item 66×58px radius 14; activo = fondo `#F1E7D9` + color primario), abajo Ajustes + avatar circular teal con iniciales. En móvil (< 768px) mantener tabs inferiores. Usar `useWindowDimensions` para decidir.
2. **Iconos: sustituir TODOS los emojis por `@expo/vector-icons` (MaterialIcons / MaterialCommunityIcons).** Mapa de tabs: Inicio=home, Stock=inventory-2 (MaterialIcons "inventory-2" o MCI "package-variant"), Producción=MCI "stove"/"bread-slice", Analítica=MaterialIcons "monitoring"/"insert-chart", Plan=MaterialIcons "event-note", Ajustes=settings. Eliminar `getProductEmoji` de las cabeceras de producto (sustituir por chip de familia).
3. **Registro de sobrantes: master-detail en una pantalla (tablet).** Fusionar `location/[locationId]/close.tsx` + `product/[productId].tsx` en un layout de dos paneles: lista de productos a la izquierda (400px, blanco) con estado por producto (✓ guardado·tirado / Pendiente / seleccionado), y panel contador a la derecha con dos tarjetas (Guardado / Tirado) con steppers −5/−1/+1/+5 de 60×60px, chip "Guardado automático", y botones Anterior / Siguiente producto. En móvil mantener flujo por pantallas (ver 1h).
4. **Tipografía: Manrope** (expo-google-fonts: `@expo-google-fonts/manrope`, pesos 400–800) en toda la app, con `fontVariant: ['tabular-nums']` en todos los números.
5. **Eliminar la pantalla `close/index.tsx` antigua** (sin estilos) — queda reemplazada por el flujo de 1c.

## Design Tokens — nuevo `constants/theme.ts`

Reemplazar los valores de `Colors` (mantener la misma API para no romper imports):

```ts
export const Colors = {
  // Primary — espresso
  primary: '#6F4A26',
  primaryLight: '#8A6239',
  primaryDark: '#5A3B1E',
  primaryTint: '#F1E7D9',      // NUEVO: fondos suaves / estado activo

  // Secondary — teal refinado
  secondary: '#17766B',
  secondaryLight: '#7BC4A8',
  secondaryTint: '#E1F0ED',    // NUEVO

  // Background
  bgBase: '#F6F1E9',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgDark: '#2A1F14',

  // Text
  textPrimary: '#2A1F14',
  textSecondary: '#6E5D4B',
  textMuted: '#A3927D',
  textOnDark: '#F6F1E9',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#2E7D4F',  successLight: '#E4F2E9',
  warning: '#C77B21',  warningLight: '#FBF0DF',
  danger:  '#C24B33',  dangerLight:  '#F9E8E3',
  info:    '#17766B',  infoLight:    '#E1F0ED',

  // Familias de producto
  familyPanaderia: '#C99B62',
  familyLaminado:  '#DDBE6C',
  familyNavidad:   '#B34A44',

  // Bordes
  border: '#E7DCCC',
  borderLight: '#EDE3D3',
  divider: '#F1E9DC',

  overlay: 'rgba(42, 31, 20, 0.5)',
} as const;
```

Tipografía (mismos roles, fuente Manrope):
- display: 30/800 letterSpacing -0.5 (títulos de pantalla) · 38/800 (login hero)
- heading: 19/800 (títulos de card) · 15–16/800 (títulos de sección de card)
- section label: 13–14/800, uppercase, letterSpacing 0.4, color textMuted
- body: 14–15/600–700 · sub/meta: 12–13/600 color textMuted
- números grandes: 24–26/800 tabular (KPIs) · 56–72/800 (contadores)

Radius: cards 16–20 · botones/inputs 14 · icon-tiles 12–13 · pills/badges 999.
Sombras: casi planas — cards `0 1px 2px rgba(42,31,20,.05)` + borde 1px; CTA primario `0 6px 16px rgba(111,74,38,.25)`.
Touch targets: botones 56–58px alto, steppers 56–60px, filas de lista >= 56px.

## Screens / Views

### 1a Login
- Split: panel izquierdo 460px fondo `bgDark #2A1F14` (logo tile 44px espresso con icono bakery, wordmark "Obrador" 19/800, claim 38/800 crema, subclaim 16 en crema 60%); panel derecho fondo `bgBase` con formulario centrado max 420px.
- Inputs: 58px, blanco, borde 1.5px `#E7DCCC`, radius 14, label 12/700 uppercase; focus: borde primary + halo `rgba(111,74,38,.12)`; icono visibility en contraseña.
- CTA "Entrar": 58px, primary, radius 14, texto 16/700 blanco + icono arrow_forward, sombra CTA.
- En móvil: una sola columna, branding compacto arriba.

### 1b Inicio (tablet)
- Header: fecha 14/600 muted encima de "Buenas tardes, {nombre}" 30/800; a la derecha chip "Ventas al día · {fecha}" (44px, blanco, borde, icono sync teal).
- Grid 2 columnas de tarjetas de ubicación (radius 20, padding 28): icon-tile 52px (storefront primary-tint / factory teal-tint), nombre 19/800, subtítulo 13/600 muted, badge de estado (En curso warning / Registrado success con check), barra de progreso "Sobrantes registrados X de Y" (8px, track `#F1E7D9`, fill primary o success), CTA 58px (primario "Continuar registro" / secundario borde "Ver resumen del día").
- Sección "HOY EN EL OBRADOR" (label uppercase): 3 tarjetas horizontales icono + número 20/800 + descripción 12.5/600 (plan de producción, ingredientes bajo mínimo, ventas de ayer).

### 1c Registro de sobrantes (tablet, master-detail)
- Panel izquierdo 400px blanco: cabecera con back + "Sobrantes · {ubicación}" 18/800 + progreso; lista de productos: barra de familia 8×36px redondeada, nombre 15/700, familia 12/600 muted; estado derecha: verde con check "{guardado} · {tirado}" si registrado, "Pendiente" 12/700 muted si no; ítem activo: fondo `#F1E7D9` + borde 1.5px primary + icono edit. Footer: botón teal 56px "Cerrar el día (X/Y)".
- Panel derecho: chip de familia (fondo familia al 25%, texto 12/800 uppercase), nombre 30/800, chip "Guardado automático" (cloud_done, verde). Dos tarjetas iguales: cabecera icono+título (Guardado espresso archive / Tirado rojo delete) + hint, número 72/800 tabular + "uds", steppers fila −5 −1 +1 +5 (60×60, radius 16; negativos blanco borde, positivos color de la tarjeta). Abajo: Anterior (1fr, blanco borde) / Siguiente producto (2fr, primary).
- Comportamiento: seleccionar producto en lista carga el detalle; autosave con debounce 500ms (ya existe en `useProductEntries`/`sessionService.upsertSingleEntry`); "Siguiente" avanza al siguiente pendiente.

### 1d Stock (tablet)
- Header: "Stock" 30/800 + segmented control derecha (track `#EFE6D8` radius 999, activo blanco con sombra, 44px).
- Banner de alerta (solo si hay bajos): fondo dangerLight, borde `rgba(194,75,51,.25)`, icono warning, texto 14.5/700 rojo oscuro `#8F3421`, botón pill rojo "Ver solo bajos".
- Filas (cards radius 16, padding 18×24): icon-tile 46px por categoría (grain, science, breakfast_dining, cookie, egg — dangerLight/rojo si bajo, primaryTint/espresso si ok), nombre 16/800, meta 13/600 "categoría · mín. X · contado ...", badge BAJO (pill rojo, 11.5/800), cantidad 26/800 tabular + unidad, botón "Contar" (48px, primaryTint, icono edit). Fila baja: borde 1.5px `rgba(194,75,51,.4)`.

### 1e Analítica (tablet)
- Header: título + subtítulo fechas; segmented periodos (7/30/90 días, 1 año).
- Fila de 4 KPI cards (radius 16): label 12.5/700 muted, valor 26/800 tabular (margen verde, merma rojo), chip de tendencia (pill successLight, trending_up, 12/800) o meta 12/600.
- Grid 3fr/2fr: (izq) card "Ingresos por día" con barras CSS (normal `#E4D5C0`, destacadas `#C99B62`, pico `#6F4A26`, radius 5 arriba) + eje de fechas 11/600; (dcha) card "Potenciales de mejora": filas icon-tile 36px (delete/dangerLight, star/successLight, calendar_month/tealTint) + título 13.5/800 + detalle 12/500. **Sin emojis.**
- Card "Top productos por ingresos": ranking nº 14/800 muted, nombre (210px), barra de cuota (10px, track `#F1E9DC`, fill color de familia), importe 14/800 tabular, % 12/600 muted.

### 1f Planificación (tablet)
- Header + segmented Hoy/Mañana/Pasado.
- Card "Precisión del modelo" en fondo oscuro `#2A1F14` radius 16: icon-tile target verde-agua `#7BC4A8`, título 15/800 crema, detalle 12.5/500 crema 60%, número grande 34/800 `#7BC4A8` a la derecha.
- Secciones por familia (label uppercase). Filas (cards radius 16): nombre 15.5/800 + explicación 12.5/600 muted ("Media martes: reciente X · histórica Y · guardado ayer Z"), badge de confianza (Alta successLight / Media warningLight, pill 28px), cantidad 24/800 tabular con sublabel "sugerido" (muted) o "ajustado" (teal, número teal), botón edit 48×48 primaryTint.
- Footer fijo blanco con borde superior: resumen "24 productos · 640 uds totales · 1 ajustado por ti" + CTA primary 56px "Guardar plan de producción" con icono save. Reemplaza el modal de ajuste por edición inline o sheet, manteniendo Stepper.

### 1g Inicio (móvil)
- Igual que 1b en una columna: header con avatar, tarjeta Santa Feliciana (progreso + CTA 56px), tarjeta Los Urquiza compacta, grid 2×1 de mini-KPIs de hoy.
- Tab bar inferior 84px (blanco, borde superior): 5 tabs icono 24px + label 10px, activo primary, inactivo muted.

### 1h Registro de producto (móvil)
- Top bar: back circular 44px, contador "8 de 12" centrado, chip "Guardado" verde.
- Chip familia + nombre 24/800 centrado; dos cards apiladas (Guardado / Tirado) con número 56/800 y steppers 56×56.
- Footer: back (1fr) + "Siguiente" (3fr, primary, 58px).

## Interactions & Behavior
- Pressed state botones: opacity 0.85 + scale 0.98 (como el actual).
- Autosave contadores: debounce 500ms, chip pasa "Guardando…" → "Guardado" (cloud_done) 1.5s.
- Master-detail 1c: al tocar "Siguiente producto" salta al siguiente sin registrar; "Cerrar el día" habilitado siempre, muestra progreso X/Y.
- Segmented controls sustituyen a FilterPills (misma API `options/selected/onSelect`, nuevo estilo pill sobre track).
- Sidebar activo: fondo `#F1E7D9`, icono+label primary; inactivo muted.
- Loading/empty: mantener los actuales, sin emojis (usar iconos muted 48px).

## State Management
Sin cambios de datos: reutilizar hooks existentes (`useLocationStatus`, `useStock`, `useAnalytics`, `usePlanningData`, `useProductEntries`, `useSession`). El master-detail 1c necesita un estado local `selectedProductId` en la pantalla de cierre.

## Assets
- Fuente: Manrope vía `@expo-google-fonts/manrope` (400,500,600,700,800).
- Iconos: `@expo/vector-icons` (MaterialIcons + MaterialCommunityIcons) — sin assets nuevos.
- Los mocks HTML usan Material Symbols Rounded (web); en RN usar los equivalentes de @expo/vector-icons más cercanos.

## Files
- `App Obrador Redesign.dc.html` — mockups hifi (1a–1h). Abrir en navegador; cada pantalla lleva su id (1a login, 1b inicio, 1c sobrantes master-detail, 1d stock, 1e analítica, 1f planificación, 1g inicio móvil, 1h registro móvil).

## Orden de implementación sugerido
1. `constants/theme.ts` (tokens) + fuente Manrope en `app/_layout.tsx`
2. Iconos en `_layout.tsx` (tabs) y sidebar responsive
3. Componentes base: Button, Card, Badge, FilterPills→Segmented, Stepper, KPICard
4. Pantallas: Inicio → Sobrantes (master-detail) → Stock → Analítica → Planificación → Login
5. Borrar `close/index.tsx` antiguo. Verificar con `npm run typecheck`.
