# Cómo funciona la conexión iPhone → tu Sheet

Guía conceptual (sin pasos de configuración; para eso: `prompt-atajo-ios27-yape.md` y el asistente en `lucaa.lat → Conexiones → iPhone`).

## 1. La idea en una frase

Tu Sheet tiene una **dirección web propia** (el Web App, URL que termina en `/exec`). El atajo del iPhone, cuando Yape te notifica un pago, **envía el texto de esa notificación a esa dirección** por HTTPS. Tu propio Apps Script la recibe, la convierte en una fila y responde "ok". Luca (nuestros servidores) no participa.

## 2. Las tres piezas

| Pieza | Dónde vive | Qué es |
|---|---|---|
| **Web App** (`…/exec`) | Tu cuenta de Google | La "puerta" de tu Sheet hacia internet. La crea el paso *Implementar → Aplicación web*. Es la misma puerta que usa la IA (MCP). |
| **Token del iPhone** | `Ajustes → conexiones.iphone.token` en tu Sheet, y dentro del atajo | La "llave" de esa puerta. Sin ella, la puerta rechaza todo. |
| **Atajo "Luca – Captura Yape"** | App Atajos de tu iPhone | El "cartero": escucha a Yape y lleva la notificación a la puerta con la llave. |

## 3. Qué pasa cuando alguien te yapea

```text
┌─────────┐   1. push "Confirmación de Pago / Ana te envió S/ 1.5"
│  Yape   │ ────────────────────────────────────────────┐
└─────────┘                                              ▼
                                              ┌────────────────────┐
                                              │ iPhone (bloqueado) │
                                              │ Automatización iOS │
                                              │ "Notificación→Yape"│
                                              └─────────┬──────────┘
            2. el atajo arma un JSON:                    │
            { token, title, body, id, notified_at, … }   │
                                                         │ 3. HTTPS POST
                                                         ▼   https://script.google.com/macros/s/TU_ID/exec?events=1
                                              ┌────────────────────┐
                                              │ Google (tu Web App)│ 4. ejecuta TU script, como tú
                                              │ LucaLib.eventsAction_
                                              │  - ¿token correcto? ──── no → {"ok":false,"error":"unauthorized"}
                                              │  - lee "Ana … S/ 1.5"
                                              │  - ¿ya existe? (dedupe)
                                              │  - escribe fila en Movimientos (transfer_in)
                                              │  - anota telemetría en Ajustes
                                              └─────────┬──────────┘
                                                         │ 5. {"ok":true}
                                                         ▼
                                              ┌────────────────────┐
                                              │ iPhone: listo.     │  (si falló: guarda en luca_pendientes
                                              │                    │   y "Luca – Flush" lo reenvía luego)
                                              └────────────────────┘
```

- **HTTPS** cifra el viaje completo: nadie en la red ve el contenido.
- **No hay servidor de Luca en medio.** Ni el Worker (`mcp.lucaa.lat`) ni la web (`lucaa.lat`) ven el evento.
- Tarda ~1–30 s (lo que tarde iOS en ejecutar el atajo y Google en arrancar tu script).

## 4. ¿Por qué una URL pública es segura aquí?

La URL `/exec` es pública (cualquiera que la conozca puede enviarle algo), pero:

1. **Sin el token no se escribe nada.** Responde `unauthorized`.
2. **Con el token lo máximo que se puede hacer es añadir filas a tu propia Sheet.** No permite leer tus datos, ni tu Gmail, ni nada de tu cuenta.
3. **Regenerar token** (sidebar o web) invalida el anterior al instante. **Desconectar** lo borra.
4. Duplicados y reenvíos se descartan (mismo `id` o mismo monto + minuto).

Por eso **el atajo con tu URL y tu token es personal: no se comparte con nadie.** Compartirlo sería dar tu llave.

## 5. Dos maneras de instalar el atajo (y qué significa "compartir")

Aquí estaba la confusión. Hay **dos tipos de atajo**:

### A) Atajo personal (lo que haces hoy)

```text
Sidebar o web → "Copiar prompt" (ya trae TU URL y TU token)
   → lo pegas en el generador de Atajos de tu iPhone
   → iOS crea el atajo con tus datos dentro
   → activas la automatización → listo
```
- No se comparte. No hay enlace. Cada usuario lo genera para sí mismo.
- Inconveniente: depende de que el generador de Atajos interprete bien el prompt; puede variar entre personas.

### B) Atajo plantilla (para que tus amigos no tengan que generar nada)

Lo construyes **tú una sola vez**, sin datos personales, con **dos preguntas al importar** ("URL de tu Luca" y "Token de tu iPhone"). Es el "Prompt 1 (producción)" de la guía.

```text
TÚ (una vez, como dueño de Luca):
   genera el atajo plantilla (con preguntas, sin URL ni token)
   → en Atajos: mantén pulsado el atajo → Compartir → "Copiar enlace de iCloud"
   → obtienes https://www.icloud.com/shortcuts/abc123…
   → ese enlace se configura en Luca (NEXT_PUBLIC_SHORTCUT_URL en Vercel)

CADA USUARIO (en su iPhone):
   lucaa.lat → Conexiones → iPhone → paso 3 → botón "Instalar atajo"
   → se abre el enlace de iCloud → "Añadir atajo"
   → iOS le hace las dos preguntas → pega su URL y su token (botones "Copiar" al lado)
   → activa la automatización → lo ejecuta a mano una vez (prueba) → listo
```

- El enlace de iCloud es una **copia del atajo vacío**: no contiene tus datos y no puede usarse para escribir en tu Sheet.
- Cada usuario termina con su propio atajo, con **su** URL y **su** token.
- Si cambias la plantilla, generas un enlace nuevo y actualizas la variable.

> Corrección: antes te pedí "compártelo por iCloud y pásame el enlace" refiriéndome al atajo generado con *Copiar prompt*. Ese atajo tiene tu token dentro: **no lo compartas**. El enlace que sirve es el del atajo **plantilla** (B).

## 6. ¿Para qué sirven las variables de entorno?

### `NEXT_PUBLIC_SHORTCUT_URL`
Es el enlace de iCloud del **atajo plantilla** (B).
- Si existe, el asistente muestra el botón **"Instalar atajo"** (camino fácil) y deja el prompt como alternativa.
- Si está vacía, el asistente solo ofrece **"Copiar prompt"** (camino A).
- Se configura una vez y solo cambia si rehaces la plantilla. No cambia con las versiones de Luca.

### `NEXT_PUBLIC_LUCA_LIB_VERSION`
Le dice a la web cuál es **la última versión publicada de LucaLib**. La web la compara con `Ajustes → luca.version` de la Sheet del usuario y, si la del usuario es menor, muestra *"Hay una versión nueva de Luca: actualiza la biblioteca en tu hoja"*.
- Importa porque las copias de los usuarios **no se actualizan solas** (deciden en su hoja qué versión de la biblioteca usan). Sin este aviso, alguien se quedaría en una versión con errores ya corregidos.
- **Hoy sí hay que actualizarla en cada release.** En el repo lo hace la skill `/deploy-luca` (y `npm run release:check` verifica que los 4 números coincidan), pero **en Vercel es manual**: Settings → Environment Variables → editar → Redeploy.

**Propuesta para eliminar ese paso manual:** la web puede leer la versión de `https://mcp.lucaa.lat/meta` (el Worker ya la anuncia y se despliega en cada release), así `NEXT_PUBLIC_LUCA_LIB_VERSION` deja de ser necesaria en Vercel.

## 7. Resumen de flujos

| Flujo | Origen → destino | Transporte | Pasa por Luca |
|---|---|---|---|
| Yapeo recibido | iPhone → tu Web App → tu Sheet | HTTPS POST | No |
| Correos BCP/Yape | Gmail → tu Apps Script (trigger) → tu Sheet | Interno de Google | No |
| Dashboard web | Tu navegador → Sheets API → tu Sheet | HTTPS (token de Google en tu navegador) | No |
| Pregunta a tu IA | ChatGPT/Claude → `mcp.lucaa.lat` → tu Web App → tu Sheet | HTTPS | Solo de tránsito, sin guardar |
| Instalar atajo plantilla | iCloud → tu iPhone | HTTPS | No (es de Apple) |
