# Prompts para generar los atajos de Luca en iOS 27 (Experimentos S7)

iOS 27 permite describir un atajo en lenguaje natural y que Atajos lo genere. Estos prompts están
pensados para pegarse tal cual en ese generador (o en el Asistente de Atajos). Si el generador **no
crea el disparador de automatización**, crea el atajo con el prompt y luego añade el disparador a
mano: abre el atajo → **Editar** → **Automatización** → **Notificación** → App: **Yape** (ver
`guia-atajos-ios27-yape.md` §1.1).

Antes de empezar, reemplaza en los prompts:
- `<URL_ENDPOINT>`: para la prueba, una URL de https://webhook.site (botón "Copy to clipboard" de "Your unique URL"). Más adelante será el endpoint de Luca.
- `<TOKEN>`: cualquier texto aleatorio largo, p. ej. `luca-test-7f3a9c2e`.

---

## Prompt 1 — Atajo "Luca – Captura Yape" (Experimento 1: ¿llega el contenido y corre solo?)

```text
Crea un atajo llamado "Luca – Captura Yape" pensado para ejecutarse como automatización personal
cuando llega una notificación de la app Yape. Debe correr sin pedir confirmación y sin abrirse en
pantalla.

Pasos exactos, en este orden:

1. Toma la entrada del atajo (la notificación que lo disparó). Guarda en variables separadas:
   - "titulo": el título de la notificación
   - "subtitulo": el subtítulo de la notificación (puede estar vacío)
   - "cuerpo": el texto o mensaje de la notificación
   - "fechaNotif": la fecha de la notificación
   - "app": el nombre de la app que la envió
   Si el tipo de entrada no expone estos campos por separado, guarda la entrada completa convertida
   a texto en la variable "raw".

2. Genera un identificador único "eventId" concatenando la fecha actual en formato ISO 8601 con un
   número aleatorio entre 100000 y 999999, separados por un guion.

3. Obtén el nombre del dispositivo y guárdalo en "dispositivo".

4. Construye un Diccionario con estas claves y valores:
   - "schema_version": "1"
   - "id": eventId
   - "source": "yape"
   - "channel": "ios-notification"
   - "token": "<TOKEN>"
   - "title": titulo
   - "subtitle": subtitulo
   - "body": cuerpo
   - "notified_at": fechaNotif
   - "received_at": la fecha y hora actual formateada como ISO 8601 INCLUYENDO la hora (p. ej. 2026-10-04T12:34:56-05:00), no solo la fecha
   - "device": dispositivo
   - "raw": raw (o el texto completo de la entrada)

5. Haz una petición HTTP a "<URL_ENDPOINT>" con el método POST, tipo de cuerpo JSON, enviando el
   Diccionario del paso 4 como cuerpo. Guarda la respuesta en "respuesta".

6. Si "respuesta" contiene el texto "OK" o la petición no falló, no hagas nada más. Si falló,
   guarda el Diccionario del paso 4 en el almacenamiento persistente de Atajos añadiéndolo a una
   lista llamada "luca_pendientes" (acción "Añadir elemento a la lista" del grupo Almacenamiento).

No muestres ninguna alerta ni notificación propia. No uses acciones que requieran interacción.
```

Después de generarlo:
0. **No lo pruebes con el botón "Ejecutar":** sin una notificación de entrada, todos los campos llegan vacíos (es normal). Solo vale cuando lo dispara la automatización.
1. Ábrelo → **Editar** → **ⓘ** → **Privacidad** → activa **"Permitir ejecución con el equipo bloqueado"** (etiqueta aprox.).
2. **Editar** → **Automatización** → **Notificación** → App: **Yape** → **Ejecutar inmediatamente** → Listo.
3. Prueba 0 (controlada, sin Yape): cambia temporalmente la app del disparador a **Mail** o **Mensajes**, bloquea el iPhone y envíate un correo/SMS con asunto `PRUEBA LUCA 123`. Si `title`/`body` llegan con ese texto, iOS 27 entrega el contenido y corre bloqueado. Vuelve a poner **Yape**.
4. Prueba A: con el iPhone **desbloqueado y la app Yape cerrada**, pide a alguien que te yapee S/1. En webhook.site debe aparecer un POST con el JSON.
5. Prueba B: con el iPhone **bloqueado y la pantalla apagada** durante al menos 1 minuto, repite el yapeo de S/1.
6. Prueba C (ingreso vs. envío): yapea tú S/1 a alguien. ¿Llegó una notificación de Yape? ¿Se disparó el atajo?

Lo que anotar por cada prueba: ¿llegó el POST a webhook.site? ¿`title` y `body` traen texto real o vacío? ¿Apareció algún aviso o pregunta en el iPhone? ¿Cuántos segundos tardó?

---

## Prompt 1 (producción) — "Luca – Captura Yape" contra tu propia Sheet

Diferencias con la versión de prueba: la URL es **tu `/exec` con `?events=1`**, el token es el que muestra el sidebar en **Conectar iPhone**, `received_at` lleva hora, y el atajo pregunta URL y token al importarse (así se comparte por iCloud sin incluir tus datos). Cómo viaja el dato y qué lo protege: `docs/architecture/adr-003-canal-iphone-directo.md`.

```text
Crea un atajo llamado "Luca – Captura Yape" pensado para ejecutarse como automatización personal
cuando llega una notificación de la app Yape. Debe correr sin pedir confirmación, sin abrirse en
pantalla y sin mostrar alertas ni notificaciones propias.

Al importarse, el atajo debe hacer dos preguntas de configuración y guardarlas como valores fijos:
- "URL de tu Luca" (texto; ejemplo: https://script.google.com/macros/s/XXXX/exec)
- "Token de tu iPhone" (texto)

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
   - "token": el valor de "Token de tu iPhone"
   - "title": titulo
   - "subtitle": subtitulo
   - "body": cuerpo
   - "raw": raw
   - "notified_at": fechaNotif
   - "received_at": ahora
   - "device": dispositivo

6. Construye la URL destino concatenando "URL de tu Luca" con el texto "?events=1".

7. Haz una petición HTTP a esa URL con método POST, tipo de cuerpo JSON, enviando el Diccionario del
   paso 5. Debe seguir redirecciones. Guarda la respuesta en "respuesta".

8. Si "respuesta" contiene el texto "\"ok\":true", termina. En cualquier otro caso (error de red,
   respuesta vacía o sin "ok":true), añade el Diccionario del paso 5 a la lista persistente
   "luca_pendientes" del almacenamiento de Atajos (acción "Añadir elemento a la lista").

9. Incluye además un segundo atajo pequeño llamado "Luca – Probar iPhone" que envíe a la misma URL
   un Diccionario con "schema_version": "1", "id": "test-" + ahora, "source": "test", "token": el
   token, "device": dispositivo, y muestre el texto de la respuesta en pantalla. Sirve para verificar
   la conexión sin esperar un yapeo: el sidebar de Luca mostrará "Última prueba".
```

Después de generarlo:
1. **Editar** → **ⓘ** → **Privacidad** → activa **"Permitir ejecución con el equipo bloqueado"** (etiqueta aprox.).
2. **Editar** → **Automatización** → **Notificación** → App: **Yape** → **Ejecutar inmediatamente**.
3. Ejecuta **"Luca – Probar iPhone"**: debe mostrar `{"ok":true,"test":true}` y en el sidebar aparecer "Última prueba: hace unos segundos".
4. Pide un yapeo de S/1: en el sidebar sube "Eventos recibidos" y en `Movimientos` aparece una fila `transfer_in`.
5. Para compartirlo: **⋯ → Compartir → Copiar enlace de iCloud**; ese enlace es el que va en el sidebar (`SHORTCUT_URL_`). Quien lo importe responderá las dos preguntas con sus propios datos.

Seguridad en una línea: el `/exec` es público pero solo acepta tu token; el daño máximo con el token es insertar filas en tu propia hoja; "Regenerar token" lo invalida; nada de esto pasa por servidores de Luca.

## Prompt 2 — Atajo "Luca – Flush" (Experimento 2: cola offline)

```text
Crea un atajo llamado "Luca – Flush" para reenviar eventos pendientes. Debe correr sin pedir
confirmación y sin abrirse en pantalla.

Pasos exactos:

1. Lee del almacenamiento persistente de Atajos la lista llamada "luca_pendientes" (acción "Obtener
   contenido almacenado" del grupo Almacenamiento). Si no existe o está vacía, termina el atajo.

2. Para cada elemento de la lista, repite:
   a. Haz una petición HTTP a "<URL_ENDPOINT>" con el método POST, tipo de cuerpo JSON, enviando el
      elemento como cuerpo.
   b. Si la respuesta contiene "OK", añade el valor de la clave "id" del elemento a una lista
      temporal "enviados".

3. Al terminar el bucle, si "enviados" tiene elementos, vuelve a guardar en el almacenamiento la
   lista "luca_pendientes" conteniendo solo los elementos cuyo "id" NO esté en "enviados".

No muestres alertas ni notificaciones.
```

Automatizaciones a añadir (**Editar → Automatización**), todas con "Ejecutar inmediatamente":
- **Wi‑Fi** → Al conectarse → Cualquier red.
- **Cargador** → Al conectarse.
- **Hora del día** → cada día a una hora fija (p. ej. 21:00) — la hora exacta no importa, es la red de seguridad.

Prueba: en el atajo "Luca – Captura Yape", cambia temporalmente `<URL_ENDPOINT>` por una URL inválida (p. ej. `https://invalido.luca.test`), recibe un yapeo de S/1, verifica que `luca_pendientes` tenga un elemento (abre el atajo "Luca – Flush" y ejecútalo a mano: no debe enviar nada porque la URL sigue inválida). Restaura la URL correcta en ambos atajos, conecta el cargador: el evento debe aparecer en webhook.site y la lista quedar vacía.

---

## Prompt 3 — Atajo "Luca – Registrar todo Yape" (recolectar muestras de texto unos días)

```text
Crea un atajo llamado "Luca – Registrar todo Yape" para ejecutarse como automatización cuando
llega cualquier notificación de la app Yape, sin confirmación. Debe añadir una línea al final de un
archivo de texto llamado "luca-notificaciones.txt" en la carpeta de Atajos de iCloud Drive, con este
formato en una sola línea: fecha y hora actual en ISO 8601, una barra vertical, el título de la
notificación, otra barra vertical, el subtítulo, otra barra vertical y el cuerpo. Si el archivo no
existe, créalo. No muestres nada en pantalla.
```

Déjalo activo 3–5 días y pásame el archivo (quita nombres de personas antes). Con eso armamos el parser de notificaciones push igual que hicimos con los correos.

---

## Qué hacemos con los resultados

| Resultado | Decisión |
|---|---|
| Prueba B llega a webhook.site con `body` real | Canal iPhone entra en v0 (ingresos + yapeos < S/10). Construimos `/events` en el Worker. |
| Prueba A sí, Prueba B no | Solo captura con el teléfono en uso. Canal iPhone queda como "mejor esfuerzo"; Gmail sigue siendo la fuente principal. |
| `body` vacío o solo "Yape" | iOS no expone el contenido a Atajos. Descartamos el canal; queda la carga manual rápida. |
| Prueba C: no hay push al enviar | Confirmado el hueco de yapeos < S/10 enviados desde Yape; solo carga manual o captura de pantalla. |
