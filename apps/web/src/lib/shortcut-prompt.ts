/**
 * Prompt para que una IA genere el atajo "Luca – Captura Yape" (y el mini-atajo "Luca – Probar iPhone").
 * Espejo de `docs/guides/prompt-atajo-ios27-yape.md` → "Prompt 1 (producción)", con la URL `/exec` y el token
 * del usuario ya inyectados (así el atajo no necesita preguntas al importarse). Lógica pura, sin React.
 */

/** URL a la que el atajo hace POST (ADR-003): `<execUrl>?events=1`. */
export function eventsUrl(execUrl: string): string {
  const base = execUrl.trim();
  if (!base) return "";
  return base.includes("?") ? `${base}&events=1` : `${base}?events=1`;
}

export function buildShortcutPrompt(o: { execUrl: string; token: string }): string {
  // Copia EXACTA de promptIphone_ (gas/shared/iphone-runtime.js). tests/prompt-parity.test.mjs falla si divergen.
  const url = eventsUrl(o.execUrl);
  const token = o.token.trim();
  return `Crea un atajo llamado "Luca – Captura Yape" pensado para ejecutarse como automatización personal
cuando llega una notificación de la app Yape. Debe correr sin pedir confirmación, sin abrirse en
pantalla y sin mostrar alertas ni notificaciones propias.

Usa estos dos valores fijos (ya son los míos, no preguntes nada al importar):
- URL de Luca: ${url}
- Token de mi iPhone: ${token}

Pasos exactos, en este orden:

1. Toma la entrada del atajo (la notificación) y guarda en variables: "titulo" (título), "subtitulo"
   (subtítulo, puede estar vacío), "cuerpo" (texto o mensaje), "fechaNotif" (fecha de la notificación)
   y "raw" (la entrada completa convertida a texto).

2. Guarda la fecha y hora actual en "ahora" formateada como ISO 8601 con hora y zona horaria
   (ejemplo 2026-10-05T12:34:56-05:00), nunca solo la fecha.

3. Genera "eventId" concatenando "ahora", un guion y un número aleatorio entre 100000 y 999999.

4. Obtén el nombre del dispositivo en "dispositivo".

5. Construye un Diccionario:
   - "schema_version": "1"
   - "id": eventId
   - "source": "yape"
   - "channel": "ios-notification"
   - "token": "${token}"
   - "title": titulo
   - "subtitle": subtitulo
   - "body": cuerpo
   - "raw": raw
   - "notified_at": fechaNotif
   - "received_at": ahora
   - "device": dispositivo

6. Haz una petición HTTP a la URL de Luca (${url}) con método POST, tipo de cuerpo JSON,
   enviando el Diccionario del paso 5. Debe seguir redirecciones. Guarda la respuesta en "respuesta".

7. Si "respuesta" contiene el texto "\\"ok\\":true", termina. En cualquier otro caso (error de red,
   respuesta vacía o sin "ok":true), añade el Diccionario del paso 5 a la lista persistente
   "luca_pendientes" del almacenamiento de Atajos (acción "Añadir elemento a la lista").

8. Incluye además un segundo atajo pequeño llamado "Luca – Probar iPhone" que envíe a la misma URL de
   Luca un Diccionario con "schema_version": "1", "id": "test-" + ahora, "source": "test", "token":
   "${token}", "device": dispositivo, y muestre el texto de la respuesta en pantalla. Sirve para
   verificar la conexión sin esperar un yapeo: el sidebar de Luca mostrará "Última prueba".`;
}
