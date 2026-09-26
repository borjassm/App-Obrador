# Paso a App Store "no listada" (unlisted)

Objetivo: dejar TestFlight (builds que caducan a los 90 días y pensado solo para
pruebas) y distribuir App Obrador por la App Store **sin que aparezca en búsquedas**:
solo se instala con un enlace privado. No caduca y se actualiza sola.

Cuándo: cuando la app lleve 1-2 meses estable en el obrador.

## Checklist

| # | Paso | Quién |
|---|------|-------|
| 1 | Publicar la política de privacidad: en GitHub → repo `borjassm/App-Obrador` → Settings → Pages → *Deploy from a branch* → `main` / carpeta `/docs`. Quedará en `https://borjassm.github.io/App-Obrador/privacidad` | Borja |
| 2 | En App Store Connect → App Obrador → **Información de la app**: categoría *Empresa*, URL de privacidad (paso 1), URL de soporte (puede ser la misma o un `mailto:`) | Borja |
| 3 | **Privacidad de la app** (cuestionario de Apple): ver respuestas abajo | Borja |
| 4 | Capturas de pantalla (iPhone 6,7" y 6,5"; iPad si se marca compatible): Inicio, sobrantes, Obrador por equipos, Plan | Claude las prepara desde el simulador/web cuando toque |
| 5 | Crear la versión 1.x para App Store con la build que esté en TestFlight y rellenar descripción + notas de revisión (textos abajo) | Borja (Claude puede guiar) |
| 6 | Enviar a **revisión de App Store** | Borja |
| 7 | Solicitar distribución no listada: https://developer.apple.com/contact/request/unlisted-app/ (textos abajo). Apple responde en días | Borja |
| 8 | Al aprobarse: pasar el enlace privado al obrador; dejar de usar TestFlight | Borja |

## Textos listos para copiar

### Descripción (es)
App Obrador es la herramienta interna de Alma Nomad Bakery para el día a día del
obrador y sus tiendas: registro de sobrantes al cierre, hoja de producción por
equipos (panadería, pastelería, laminado y horno), plan de producción y envíos entre
tiendas con confirmación de recepción. Uso exclusivo del personal del negocio.

### Notas para el revisor (en)
```
App Obrador is an internal operations tool for a single bakery business (Alma Nomad
Bakery) and its shops. It is used only by the business's own staff; accounts are
created by the business administrator, and there is no public sign-up in the app
(so account-deletion-in-app is not applicable; deletion requests go to
info@almanomadbakery.com as stated in the privacy policy).

Demo account (admin, full access):
  user: info@almanomadbakery.com
  password: <poner la contraseña vigente>

Suggested path: Home → pick a shop → record leftovers with the −/+ buttons → Save.
Obrador tab → pick a team → see today's production sheet.
```

### Solicitud de distribución no listada (en)
```
App name: App Obrador
Apple ID: 6794038258
Bundle ID: com.borjassm.appobrador

Why unlisted: App Obrador is a private operations tool used exclusively by the
staff of one bakery business (Alma Nomad Bakery) across its production kitchen and
two shops. It is of no use to the general public: all content requires an account
issued by the business. We need a stable distribution channel for this small,
known group of employees on their own devices, without the app being discoverable
in App Store search.
```

### Cuestionario "Privacidad de la app"
- ¿Recopila datos? **Sí**.
- Tipos: **Información de contacto → Correo electrónico** (para iniciar sesión) y
  **Contenido del usuario → Otro contenido del usuario** (registros operativos del negocio).
- Uso: **Funcionalidad de la app**. No vinculado a publicidad.
- ¿Vinculado a la identidad? **Sí** (cuenta de trabajo). ¿Rastreo? **No**.

## Antes de enviar
- Confirmar que en Supabase → Authentication → *Sign In / Providers* está
  desactivado **"Allow new users to sign up"** (la app no permite registro, y así
  nadie puede crearse cuenta con la clave pública).
- Revisar que la contraseña de la cuenta demo es la vigente.
