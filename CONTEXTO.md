# OpenCode Mobile — contexto completo

> Cliente iOS **personal** para hablar con mi propio servidor de OpenCode desde el iPhone.
> No es para la App Store: es una app mía, para mi uso, instalada con Apple ID gratuito.
>
> Documento generado al terminar la primera sesión (madrugada del 12/10/2026).
> **Sin datos personales a propósito** (este repo es público): Apple ID, IPs, UDID y
> topics de ntfy se escriben aquí como huecos `<...>`.

---

## 1. Qué es

Una app de chat para mi agente de OpenCode: escribirle desde el móvil, ver cómo
trabaja en tiempo real, aprobar permisos y revisar cambios, sin estar delante del PC.

- **App:** React Native + **Expo SDK 57**, `expo-router`, TypeScript
- **Servidor:** OpenCode corriendo en el PC (Windows), escuchando en la red local
- **Auth:** HTTP Basic (`usuario: opencode`, contraseña: token de emparejamiento)
- **Nombre/bundle:** `OpenCode` / `com.nixer.opencode`

---

## 2. Cómo funciona la conexión

1. En el PC, el **helper** asegura que el servidor está arrancado (`0.0.0.0:49374`) y
   genera un **QR de emparejamiento** (Wi-Fi local y/o Tailscale).
2. El QR contiene una URL del tipo `http://<TU-IP>:49374/auth/connect/<codigo>`.
   El código es de **un solo uso** y caduca en ~5 minutos.
3. La app canjea esa URL con `GET`, recibe un **token** y lo guarda en el llavero
   (`expo-secure-store`, claves `oc.baseUrl`, `oc.baseUrls` y `oc.token`).
4. A partir de ahí, todas las llamadas llevan `Authorization: Basic base64("opencode:"+token)`.
5. **Varias direcciones (anti-cambio de IP):** en cuanto conecta, la app lee
   `GET /api/info` (que devuelve `urls` con **todas** las direcciones del servidor,
   Wi‑Fi **y Tailscale**) y las guarda. En cada petición prueba la activa primero y,
   si falla a nivel de red, pasa a las demás; la que responde queda como activa.
   Así, si el DHCP le mueve la IP al PC, la app se cura sola (Tailscale no cambia).

> ⚠️ `/api/info` devuelve **401 sin autenticación**: eso es normal, no es un fallo.
> ⚠️ Un error **HTTP** (401, 404…) NO hace probar otra dirección: significa que el
> host es el correcto. Solo se cambia de dirección ante un fallo de **red**.

---

## 3. Estructura de ficheros

```
src/
  app/                    rutas (expo-router) — cada fichero es una pantalla
    index.tsx             splash + onboarding + chat
    conectar.tsx          escáner QR + emparejamiento
    proyectos.tsx         proyectos → sesiones
    sesion/[id].tsx       el chat de una sesión
    ajustes/              menú, servidor, modelo, apariencia, rápidas, acerca
  components/
    chat-view.tsx         pantalla principal del chat (grande)
    form-card.tsx         responder las *questions* (formularios) del agente
    drawer.tsx            menú lateral + búsqueda
    md.tsx                markdown + copiar código
    sheet.tsx             panel inferior (Diff / Herramientas / Permisos)
    toast.tsx             aviso emergente al terminar el agente
    quick-actions.tsx     chips de acciones rápidas
    model-picker.tsx      selector de modelo y razonamiento
    session-menu.tsx      renombrar / fork / compactar / borrar
    animated-icon.tsx     logo animado del splash
  lib/
    api.ts                TODAS las llamadas HTTP
    events.ts             una sola conexión SSE compartida + estado de conexión
    prefs.tsx             preferencias persistentes (SecureStore)
    attachments.ts        fotos y archivos → data: URL
    haptics.ts            vibración (se puede apagar)
  theme/
    palettes.ts           20 paletas
    theme.tsx             proveedor + acento + densidad + mensajes planos
tools/
  oc-helper/              helper del PC en Go (bandeja del sistema)
  oc-notify.mjs           publicador de avisos ntfy
.github/workflows/ios.yml compilación del IPA sin firmar
```

---

## 4. Las 11 funciones de la primera tanda

1. **Adjuntar archivos** — cámara, galería (hasta 4) y documentos. Las fotos se
   reescalan a JPEG en el móvil y se envían como `data:image/jpeg;base64,...`.
   El servidor las materializa (`mime`, `source: inline`).
2. **Copiar con un toque** — bloques de código con cabecera y botón, código en
   línea al tocarlo, y rutas/comandos en el panel.
3. **Valores por defecto reales** — agente, modelo y razonamiento elegidos en
   Ajustes se usan al crear sesiones (drawer y proyectos).
4. **Estado de conexión** — puntito con texto en la cabecera
   (`conectado / conectando / sin conexión`) y recarga sola al reconectar.
5. **Buscar dentro de los mensajes** — además del título, busca en el contenido
   de las sesiones y muestra un fragmento.
6. **Cargar historial** — mensajes paginados de 40 en 40, con botón "ver anteriores".
7. **Aviso emergente** — banner al terminar (o fallar) el agente, con la sesión.
8. **Acciones rápidas** — chips configurables encima del teclado.
9. **Vibración** — al enviar, aprobar, elegir modelo o fallar.
10. **Arranque automático del helper** — registro `HKCU\...\Run` (no hace falta admin).
11. **Log del helper** — `%LOCALAPPDATA%\OpenCodeHelper\helper.log`, con rotación a 1 MB.

### Añadido después

12. **Responder las *questions*** — cuando el agente llama a `question`, la app
    pinta el formulario (`components/form-card.tsx`) encima del compositor, con
    chips/opciones, texto, número, sí/no y multiselección, y lo envía al endpoint
    de *forms*. Sin esto, la herramienta se quedaba con el spinner girando y no
    había forma de contestar desde el móvil.

---

## 5. La API de OpenCode que usamos

Servidor v2. La especificación completa está en `GET /openapi.json`.

| Qué | Endpoint |
|---|---|
| Sesiones | `GET /api/session` |
| Info del servidor (¡direcciones!) | `GET /api/info` |
| Proyectos | `GET /api/project` |
| Mensajes | `GET /api/session/{id}/message` |
| Enviar mensaje | `POST /api/session/{id}/prompt` |
| Interrumpir | `POST /api/session/{id}/interrupt` |
| Permisos | `GET /api/session/{id}/permission`, `POST .../{reqID}/reply` |
| Formularios (*questions*) | `GET /api/session/{id}/form` |
| Responder formulario | `POST /api/session/{id}/form/{formID}/reply` |
| Cancelar formulario | `DELETE /api/session/{id}/form/{formID}` |
| Diff | `GET /api/session/{id}/diff` |
| Modelos | `GET /api/model` |
| Agentes | `GET /api/agent` |
| Eventos (SSE) | `GET /api/event` |
| Crear sesión | `POST /api/session` |

### Detalles que nos costó descubrir

- **Paginación:** `?limit=40&order=desc` devuelve los **más nuevos primero**, y
  para tirar hacia atrás se sigue **`cursor.next`** (no `cursor.previous`).
  No se puede combinar `cursor` con `order`.
- **Crear sesión exige** `agent` y `model` explícitos; el modelo por defecto
  (`opencode/exo-free`) está obsoleto y devuelve 410.
- **Adjuntos:** `files: [{ uri, name }]` donde `uri` acepta `file://` (ruta del PC)
  o `data:<mime>;base64,...`. **No** acepta URLs http(s). Máximo ~20 MB decodificados.
- **SSE:** el servidor manda `session.text.delta`, `session.reasoning.started`,
  `session.execution.succeeded/failed`, etc.
- **SSE en el build de release (¡ojo!):** el SSE arranca al abrir la app (lo lanza
  `ToastHost`, montado siempre en `_layout.tsx`). Si arrancaba **sin credenciales**
  (app recién instalada, antes de emparejar), `connect()` se rendía y **no volvía a
  intentarlo nunca** (`started` se quedaba en `true`) → **sin streaming** en el IPA,
  mientras que en Expo Go un *reload* lo tapaba. Ahora **reintenta siempre**, vuelve
  a conectar al pasar a primer plano, y pasa por `ping()` (probando todas las
  direcciones) antes de abrir el stream. Además el parser aguanta líneas partidas.
  Si vuelve a fallar el streaming en un build, mirar en el log del servidor si la
  app abre `/api/event`.
- **Forms = las *questions*:** la herramienta `question` **no** se contesta con un
  prompt. El servidor crea un **formulario**; la app lo lee con
  `GET /api/session/{id}/form`, lo responde con `POST .../form/{formID}/reply`
  (`{ answer: { clave: valor } }`) y lo cancela con `DELETE .../form/{formID}?message=`.
  El valor puede ser texto, número, booleano o lista de textos. Campos:
  `string`, `number`, `integer`, `boolean`, `multiselect`, `external`
  (con `options` → `value`/`label`/`description`, `required`, `default`, `when`, `hidden`).
  Eventos SSE: `form.created`, `form.replied`, `form.cancelled`.
  Si no se responde, la herramienta se queda con el **spinner girando** para siempre.
- Los mensajes vienen del **más nuevo al más viejo**: hay que darles la vuelta.

---

## 6. El helper del PC (Go)

`tools/oc-helper` — binario `oc-helper-tray.exe`:

- **Bandeja del sistema** con menú: mostrar QR (Wi-Fi / Tailscale), estado del
  servidor, reiniciar, arranque automático, abrir carpeta de logs, salir.
- Vigila los **permisos pendientes** y avisa por **ntfy** al iPhone.
- **Log** a fichero con rotación.
- **La IP se redetecta en cada QR** (antes se calculaba solo al arrancar y, si el
  router cambiaba la IP por DHCP, seguía generando QRs hacia una dirección muerta).
- **Arranque automático** por registro de usuario (una tarea programada exigiría
  permisos de administrador, y el usuario no los tiene).

Compilar el helper (`go` está en `C:\Program Files\Go\bin`):

```powershell
cd tools\oc-helper
go build -ldflags="-H windowsgui" -o oc-helper-tray.exe .   # bandeja
```

Detalles de compilación: necesita `app.manifest` + `rsrc.syso` (controles comunes)
o la UI falla con `TTM_ADDTOOL failed`. El `.exe` en marcha bloquea el fichero:
hay que parar el proceso antes de recompilar encima.

---

## 7. Cómo se compila (GitHub Actions)

No se puede compilar iOS en Windows: el Mac lo pone GitHub.

`.github/workflows/ios.yml`, en un runner **`macos-26`**:

1. `npm ci`
2. `npx expo prebuild --platform ios --clean`
3. `pod install`
4. Averigua el esquema (nombre del `.xcodeproj`) y compila **sin firmar**
5. Empaqueta `Payload/` en un `.ipa` y lo sube como artifact

### Tres trampas que costaron varios intentos

1. **El esquema de Xcode**: hay que usar el de la app (`OpenCode`), no el primero
   de la lista — aparecen esquemas de los Pods (`EXConstants`) que no se pueden archivar.
2. **`swift-tools-version 6.2`**: `expo-modules-jsi` exige Swift 6.2. El runner
   `macos-15` trae Xcode 16.4 (Swift 6.1) y falla. Hay que usar **`macos-26`**.
3. **Logs**: con `| tail -n` te quedas sin el error de verdad. Mejor volcar a fichero
   y sacar el contexto del primer `error:`.

---

## 8. Cómo se instala en el iPhone (Sideloadly)

Sin Mac y con Apple ID **gratuito** (la app caduca a los 7 días, pero el daemon de
Sideloadly la re-firma sola si el PC está encendido).

1. **Requisitos en el PC** (versión **web** de Apple, *no* la de la Microsoft Store):
   - Apple Devices (drivers del iPhone)
   - iTunes
   - iCloud
   - **Sideloadly** (altstore.io / sideloadly.io)
2. Abrir Sideloadly → arrastrar el `.ipa` → Apple ID → **Start**
3. En el iPhone:
   - **Ajustes → General → VPN y gestión de dispositivos** → confiar en el perfil
     (`iPhone Developer: <TU-APPLE-ID> (<EQUIPO>)`) → en iOS 18+ el botón es
     **"Permitir y reiniciar"**
   - **Ajustes → Privacidad y seguridad → Modo desarrollador** → activar y reiniciar
4. Abrir la app → escanear el QR del helper → ya estás dentro.

### Dos confesiones útiles

- **"VPN" en Ajustes** (raíz) NO es **"VPN y gestión de dispositivos"** (dentro de
  General). El perfil del desarrollador está en el segundo. Es fácil confundirse.
- Si la instalación **no termina del todo**, iOS **no crea** la entrada de confianza.
  Señal de que ha ido bien: en Sideloadly el contador de App IDs baja y pone
  `updates Nd`.

---

## 9. Cómo actualizar la app

```powershell
# 1. subir cambios
git add -A
git commit -m "lo que sea"
git push

# 2. esperar a que el Mac compile y bajar el IPA
gh run watch
gh run download -n OpenCode-unsigned-ipa -D "$env:USERPROFILE\Downloads\oc-ipa"

# 3. firmar e instalar
#    abrir Sideloadly con el .ipa y pulsar Start
```

> Se puede automatizar todo en un `.cmd` de doble clic.

---

## 10. Notas del entorno

- El servidor escucha en `0.0.0.0:49374` y hay reglas de firewall
  ("OpenCode Mobile") para 49374 y 8081.
- `service.json` (en `%USERPROFILE%\.local\state\opencode\`) guarda la URL y la
  contraseña del servidor.
- Para desarrollo en el móvil: `npx expo start --lan` y abrir en **Expo Go**.
  **Fast Refresh no detecta imports nuevos** → reiniciar con `--clear`.
- `npx tsc --noEmit` limpio. `npx expo lint` está roto en este proyecto.

---

## 11. Cronología de la primera noche

| Hora | Hito |
|---|---|
| 01:44 | Primeras maquetas del plan (drawer, tabs, feed) |
| 01:58 | `plan.md` |
| 02:35–02:40 | Maquetas de ntfy, identidad e icono |
| 04:20 | Nace la carpeta del proyecto |
| 05:12 | Primer código de la API |
| 07:02 | Primer commit |
| 07:17–07:25 | Pelea con el CI (esquema, Swift 6.2) |
| 07:45 | `.ipa` compilado |
| 07:59 | Firmado e instalado en el iPhone |

≈ 6 horas y cuarto, de un tirón.

---

## 12. Pendiente / ideas

- **Actualizador de un clic** (`.cmd`: push → compilar → descargar → abrir Sideloadly)
- **i18n (ES/EN)** — valorado como innecesario para uso personal
- **Notificaciones con la app cerrada** (ntfy ya está montado en el PC)
- **Tailscale** para usarlo desde fuera de casa (el helper ya genera ese QR)
- **Alinear los iconos** con la referencia de `iconos.html` del plan
- **Drawer** agrupado en Activos / Hoy / Proyectos, con píldora de conexión con latencia
- **IP del servidor:** ✅ resuelto. La dirección ya no está *hardcodeada*: se
  rellena sola desde el enlace pegado y la app prueba **varias direcciones** que
  aprende de `/api/info` (incluida Tailscale), así que un cambio de IP del PC ya
  no obliga a re-emparejar. En *Ajustes → Servidor* se ven y se pueden añadir.
