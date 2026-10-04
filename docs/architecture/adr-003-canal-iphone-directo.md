# ADR-003 — Canal iPhone: el atajo envía directo al Web App del usuario

Fecha: 2026-10-04 · Estado: **aceptado** · Sustituye a `arquitectura-base.md` §5.2 (que proponía pasar por el Worker)

## Contexto
S7 validó (2026-10-04) que en iOS 27 una automatización "Notificación → Yape" corre con el iPhone bloqueado, sin confirmación, y entrega `title`/`body` ("Yape! <Nombre> te envió un pago por S/ 1.5"). Yape no envía push al **enviar**; sí correo (≥ S/10, o BCP si el destino es otro banco). El canal cubre ingresos P2P y montos pequeños recibidos.

## Opciones
- (a) Atajo → Worker → `/exec` del usuario: token por dispositivo revocable desde la web, URL estable, reintentos; el evento transita por Luca.
- (b) Atajo → Worker con cola cifrada ≤ 24 h → el Apps Script la recoge cada 15 min: sin Web App, pero el evento reposa en Luca y hay latencia.
- **(c) Atajo → `/exec` directo**, sin Worker.

## Decisión
**(c).** Máxima privacidad: el evento nunca pasa por infraestructura de Luca. Requiere el Web App desplegado (igual que el MCP).

## Diseño
- Paso de onboarding **"Activar conexiones"** (3 de 3, opcional): guía visual para desplegar el Web App ("Ejecutar como: yo", "Acceso: cualquiera") → pegar la URL `/exec` en el sidebar → el Apps Script la valida (GET `/exec` responde `{ok:true, app:'luca'}`) y la guarda en `Ajustes.conexiones.execUrl`.
- **"Conectar iPhone"** (sidebar o web): el Apps Script genera un `deviceToken` (UUID) en `UserProperties`, y muestra el enlace de iCloud del atajo + URL + token (y un QR). El atajo se importa con 2 preguntas (URL, token).
- Contrato del POST: `{"schema_version":"1","id":"<ISO>-<rand>","source":"yape","channel":"ios-notification","token":"<deviceToken>","title":"…","subtitle":"…","body":"…","raw":"…","notified_at":"…","received_at":"<ISO con hora>","device":"…"}` a `POST <execUrl>?events=1`.
- El Apps Script (`webapp-runtime.js` → `eventsAction_`) valida `token` contra `deviceToken`, parsea con `push-parsers-runtime.js`, deduplica por `id` y por clave difusa (monto + minuto) contra los correos, y responde `{ok:true}` siempre con HTTP 200.
- Cola offline en el atajo (`luca_pendientes` + atajo "Flush" por Wi‑Fi/cargador/hora), ya que `Get Contents of URL` no reintenta. Nota: sin red tampoco llega el push; APNs guarda solo la última notificación por app.
- Revocación: "Desconectar iPhone" borra `deviceToken`. Si el usuario recrea la implementación del Web App, la URL `/exec` puede cambiar y debe reimportar el atajo (la web lo detecta comparando `Ajustes.conexiones.execUrl`).

## Consecuencias
- El Worker **no tiene** endpoint `/events`; solo MCP y pairing.
- El Web App pasa a ser necesario para iPhone y para IA; sin él, Luca funciona con correo + web.
- El evento push lleva el nombre del remitente del yapeo: se guarda en la Sheet del usuario, en ningún otro sitio.
