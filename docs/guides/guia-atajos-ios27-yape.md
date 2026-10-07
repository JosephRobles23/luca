# Guía práctica: capturar notificaciones de Yape con Atajos (iOS 27)

- Fecha: 2026-10-04 · iOS de referencia: **27.0.1**
- Base: `docs/research/2026-10-ios-captura-notificaciones-yape.md`
- Objetivo: correr **3 experimentos** en el iPhone y llenar la plantilla de **Resultados** del final.
  1. ¿El disparador *Notificación* de Atajos captura los yapeos recibidos?
  2. ¿Funciona un buffer offline con las acciones de *Storage*?
  3. ¿Yape manda push cuando **envías** un yapeo?
- Fuera de alcance: Wallet / Transacción.

## Cómo leer esta guía

**Marcas de confianza:**

- **[V]** Verificado en documentación de Apple. Se cita la URL.
- **[S]** Viene de una fuente secundaria (MacStories, blogs). Es probable, pero no es oficial.
- **[I]** Inferido por mí, sin fuente. Hay que confirmarlo en el teléfono.

**Etiquetas de la interfaz.** Van en español de Latinoamérica, que es el que usa un iPhone configurado en Perú (dice "Configuración", no "Ajustes"), con el inglés entre paréntesis.

- El *Manual de uso del iPhone* en español ya tiene edición iOS 27, así que esas etiquetas están verificadas.
- El *Manual de uso de Atajos* en español **todavía muestra iOS 26** ([es-lamr](https://support.apple.com/es-lamr/guide/shortcuts/apdfbdbd7123/ios)). Las funciones nuevas de iOS 27 (disparador Notificación, Storage, "Allow Running When Locked") solo están documentadas en inglés. Esas etiquetas en español van marcadas **(etiqueta aprox.)**.

> **Cambio importante en iOS 27 [V].** Las automatizaciones ya no se crean en una pestaña aparte con "Crear automatización personal". Ahora se crean **dentro de un atajo**: "Tap an existing shortcut or create a new shortcut. Tap Edit, then Automation. Choose a trigger" ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)).
>
> - La pantalla **Automatización** sigue existiendo, pero solo sirve para **ver y filtrar** los atajos que tienen automatización (Turned On / Turned Off).
> - Según MacStories, el disparador también se puede agregar desde la biblioteca de acciones, en la categoría "Automation", y aparece arriba del todo en el atajo. Un mismo atajo puede tener **varios disparadores** [S] ([MacStories](https://www.macstories.net/stories/ios-and-ipados-27-review/13/)).
> - Si tu teléfono muestra el flujo antiguo (+ → nueva automatización), úsalo. Las acciones son las mismas.

---

## 0. Requisitos previos

### 0.1 iPhone

1. iPhone con **iOS 27.x**. Revísalo en Configuración (Settings) > General > Información (About).
2. App **Atajos (Shortcuts)** instalada. Viene de fábrica.
3. **Notificaciones de Yape** [V] ([Cambiar la configuración de las notificaciones, iOS 27](https://support.apple.com/es-lamr/guide/iphone/iph7c3d96bab/ios)). Entra a Configuración (Settings) > Notificaciones (Notifications) > Yape, debajo de "Estilo de notificaciones":
   - **Permitir notificaciones (Allow Notifications):** activado.
   - **Alertas (Alerts):** marca Pantalla bloqueada (Lock Screen), Centro de notificaciones (Notification Center) y Tiras (Banners).
   - **Previsualizar / Mostrar vistas previas (Show Previews):** **Siempre (Always)**. Las opciones son Siempre / Si desbloqueaste (When Unlocked) / Nunca (Never).
     - Es importante: con "Si desbloqueaste", la notificación llega sin contenido mientras el teléfono está bloqueado.
     - Si el atajo recibe el texto completo o un texto oculto en ese caso **no está documentado** [I]. Por eso se prueba aparte en la variante E5 de la matriz.
   - **Entrega de notificaciones (Notification Delivery):** si usas Resumen programado, elige **Entrega inmediata (Immediate Delivery)**. El resumen retrasa las notificaciones.
   - **Priorizar notificaciones (Prioritize Notifications):** desactivado para Yape. Es una función de Apple Intelligence; no debería afectar, pero así reduces variables.
4. **Resumen de notificaciones con Apple Intelligence** [V] ([Resumir notificaciones, iOS 27](https://support.apple.com/es-lamr/guide/iphone/iph1fbe7d2b9/ios)). Ve a Configuración > Notificaciones > **Resumen de notificaciones (Summarize Notifications)** y desactívalo, o quita Yape de "Seleccionar las notificaciones a resumir".
   - El resumen cambia lo que *ves*.
   - Si cambia lo que recibe el atajo es **[I] desconocido**. Lo descartamos para no contaminar los fixtures.
5. **Enfoque (Focus).** Apple dice: "Al usar un enfoque, se retrasa la entrega de notificaciones" [V] ([misma página](https://support.apple.com/es-lamr/guide/iphone/iph7c3d96bab/ios)).
   - Durante las pruebas, desactiva los enfoques o permite Yape en ellos.
   - No sabemos si una notificación silenciada por un enfoque dispara la automatización [I]. Se prueba en E6.
6. **Código / Face ID (Passcode).** En Configuración > Face ID y código (Face ID & Passcode) > **Solicitar código (Require Passcode)** (etiqueta aprox.), anota el valor que tienes.
   - Con "Inmediatamente (Immediately)", el iPhone descarta las claves de protección "Complete" unos 10 s después de bloquear [V] ([Apple Platform Security](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)).
   - En la práctica: **pantalla apagada = bloqueado**.
7. **Modo de bajo consumo (Low Power Mode):** apagado durante las pruebas base. Se prueba aparte en E7.
8. **Persona de confianza** que te pueda yapear **S/1** varias veces. Tú también vas a yapearle S/1 en el Experimento 3.

### 0.2 Endpoint de prueba

#### Opción rápida: webhook.site (solo para el primer humo)

1. Abre https://webhook.site. Te da una URL única al instante, sin cuenta.
2. Úsala como URL en el atajo. Verás cada POST en vivo.
3. **Privacidad:**
   - Las URLs sin cuenta **no tienen login**: cualquiera con el link ve los datos. Además expiran ([webhook.site](https://webhook.site)).
   - Úsala **solo** para verificar que el atajo dispara y para ver qué campos llegan. Para eso, haz que te yapeen S/1 y no dejes la automatización apuntando allí.
   - Después cambia al Apps Script.

#### Opción recomendada: Google Apps Script Web App (tu propia hoja)

Apps Script no expone las cabeceras HTTP. Por eso el token va **dentro del JSON**.

1. Crea una hoja nueva en Google Sheets, por ejemplo "Luca – pruebas iOS".
2. Abre **Extensiones > Apps Script (Extensions > Apps Script)**.
3. Borra el contenido de `Código.gs` y pega este código:

```javascript
/**
 * Luca – endpoint de prueba para Atajos de iOS 27.
 * Hoja "eventos". Propiedades del script:
 *   TOKEN     (obligatoria) secreto compartido con el atajo
 *   FAIL_MODE ("1" = simula caída del servidor para el Experimento 2)
 * Respuesta siempre HTTP 200 (Apps Script no permite elegir el código);
 * el atajo debe mirar el campo "status": OK_SAVED | OK_DUP | ERR_*.
 */
const SHEET_NAME = 'eventos';
const HEADERS = ['received_at', 'event_id', 'source', 'title', 'subtitle', 'body',
                 'notif_date', 'device_state_hint', 'raw_json'];

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const raw = (e && e.postData && e.postData.contents) || '';
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    return reply_({ ok: false, status: 'ERR_BAD_JSON' });
  }

  const expected = props.getProperty('TOKEN');
  if (!expected || !payload || payload.token !== expected) {
    return reply_({ ok: false, status: 'ERR_AUTH' });
  }
  if (props.getProperty('FAIL_MODE') === '1') {
    return reply_({ ok: false, status: 'ERR_FAIL_MODE' });
  }

  // Acepta {token, event_json: "<json>"}, {token, event: {...}} o campos planos.
  let ev = payload.event_json !== undefined ? payload.event_json
         : payload.event !== undefined ? payload.event
         : payload;
  if (typeof ev === 'string') {
    try { ev = JSON.parse(ev); } catch (err) { ev = { raw_text: ev }; }
  }
  ev = Object.assign({}, ev);
  delete ev.token; // nunca guardar el secreto en la hoja

  const id = String(ev.event_id || '').trim();
  if (!id) return reply_({ ok: false, status: 'ERR_NO_EVENT_ID' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // evita duplicados si llegan 2 POST a la vez
  try {
    const sh = getSheet_();
    // Dedupe barato: buscar el event_id exacto en la columna B.
    const hit = sh.getRange('B:B').createTextFinder(id).matchEntireCell(true).findNext();
    if (hit) return reply_({ ok: true, status: 'OK_DUP', event_id: id });

    sh.appendRow([
      new Date(), id, ev.source, ev.title, ev.subtitle, ev.body,
      ev.notif_date, ev.device_state_hint, JSON.stringify(ev)
    ].map(safe_));
    return reply_({ ok: true, status: 'OK_SAVED', event_id: id });
  } finally {
    lock.releaseLock();
  }
}

// Para probar la URL desde el navegador (no requiere token, no escribe nada).
function doGet() {
  return reply_({ ok: true, status: 'OK_ALIVE' });
}

// Ejecutar UNA vez desde el editor: crea la hoja y pide autorización.
function setup() {
  getSheet_();
}

// Ejecutar desde el editor para generar/rotar el token; míralo en "Registro de ejecución".
function newToken() {
  const t = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('TOKEN', t);
  Logger.log(t);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('@'); // event_id como texto plano
  }
  return sh;
}

// Evita inyección de fórmulas (=, +, -, @) y valores vacíos.
function safe_(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v;
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Guarda el proyecto. En el selector de funciones elige `setup` y pulsa **Ejecutar (Run)**. Acepta los permisos:
   - Te saldrá "Google no verificó esta app". Entra a **Configuración avanzada (Advanced)** y luego a **Ir a … (no seguro)**. Es tu propio script.
5. Ejecuta `newToken`. Copia el token desde **Registro de ejecución (Execution log)**.
   - Para verlo o cambiarlo después: **Configuración del proyecto (Project Settings) > Propiedades del script (Script Properties)**.
6. Despliega el script:
   1. **Implementar > Nueva implementación (Deploy > New deployment)**.
   2. En el engranaje, elige el tipo **App web (Web app)**.
   3. **Ejecutar como (Execute as): Yo (Me)**.
   4. **Quién tiene acceso (Who has access): Cualquier usuario (Anyone)**.
   5. Pulsa **Implementar (Deploy)** y copia la **URL de la app web** que termina en `/exec`.
   - Las etiquetas en español de Apps Script son aprox.
7. Prueba rápida desde el navegador: abre la URL `/exec` y debe responder `{"ok":true,"status":"OK_ALIVE"}`.
8. Prueba del POST desde una terminal. Usa `-d` **sin** `-X POST`, porque Apps Script responde con un 302 que hay que seguir con GET ([Tanaike](https://medium.com/google-cloud/understanding-flow-of-request-to-web-apps-created-by-google-apps-script-ac49e80f7c6b)):

   ```bash
   curl -sL -H 'Content-Type: application/json' \
     -d '{"token":"TU_TOKEN","event_json":"{\"event_id\":\"curl-001\",\"source\":\"curl\",\"title\":\"prueba\"}"}' \
     'https://script.google.com/macros/s/XXXX/exec'
   ```

   - Primera vez: `OK_SAVED` y aparece una fila en la hoja.
   - Segunda vez: `OK_DUP`, sin fila nueva.
9. **Si cambias el código:** entra a **Implementar > Gestionar implementaciones (Manage deployments)**, edita la implementación (✏️) y elige **Versión: Nueva versión (New version)**. Así se mantiene la misma URL `/exec`.
   - **No uses "Nueva implementación" para actualizar.** Crea una URL `/exec` distinta y la anterior sigue viva con el código viejo hasta que la archives. El atajo del iPhone y el conector MCP seguirían apuntando a la vieja.
   - Si ya lo hiciste: **Luca → ✅ Autorizar / Escanear ahora** (o "Comprobar Web App" en el panel) detecta la nueva y la guarda en `conexiones.execUrl`. Luego vuelve a copiar el prompt del atajo, porque `conexiones.iphone.execUrl` guarda la URL que lleva el atajo y solo cambia al regenerarlo. Si `ScriptApp.getService().getUrl()` no devuelve la nueva (bug conocido de Apps Script con varias implementaciones), pégala en **URL del Web App → Verificar y guardar URL** o archiva las viejas.

> **Nota sobre el 302.** Al recibir un POST, Apps Script ejecuta `doPost` y responde con un **302** hacia `script.googleusercontent.com`, donde se sirve el resultado. Google pide que el cliente siga redirecciones ([Content Service](https://developers.google.com/apps-script/guides/content)).
>
> - Que *Obtener contenido de URL* siga el 302 cambiando a GET (como hacen el navegador y `curl` sin `-X`) es **[I] probable pero no documentado**.
> - Por eso el atajo **no** confía en el código HTTP: revisa que la respuesta contenga `OK_`.
> - Si no lo contiene pero la fila sí está en la hoja, el problema es el redirect y no el envío. Ver Problemas frecuentes.

---

## Experimento 1: captura con el disparador Notificación

**Qué documenta Apple [V]** ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)):

- El disparador **Notification** tiene dos opciones: **App** ("the app a notification will be received from") y **Add Filter** (Message, Subtitle o Title).
- Apple **no documenta los campos de salida**.
- Fuentes secundarias:
  - MacStories describe una variable mágica "Notification" con texto del cuerpo, si es *time-sensitive* y fecha [S] ([MacStories](https://www.macstories.net/stories/ios-and-ipados-27-review/13/)).
  - WalletPal usa *Shortcut Input* con Title / Subtitle / Body [S] ([WalletPal](https://walletpalapp.github.io/apple-shortcuts-notification-trigger.html)).
- Por eso el paso 1.2 está pensado para **descubrir** los campos.

### 1.1 Crear el atajo con su automatización

1. Abre **Atajos (Shortcuts)** y crea un atajo nuevo con **+**. Ponle de nombre `Luca – Captura Yape`.
2. Toca **Editar (Edit)** y luego **Automatización (Automation)** [V].
   - Alternativa [S]: en la biblioteca de acciones, entra a la categoría **Automatización (Automation)** y busca **Notificación (Notification)** (etiqueta aprox.).
3. Elige el disparador **Notificación (Notification)** (etiqueta aprox.) [V].
4. Toca **App** y elige **Yape** [V].
5. **No pongas filtro todavía.**
   - En la beta 1 los filtros de título y mensaje impedían que se disparara [S] ([Derek Seaman](https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html)).
   - El filtro **Agregar filtro (Add Filter)** con Mensaje (Message) contiene "S/" se prueba al final (prueba F1).
6. Agrega las acciones de 1.2 y 1.3.
7. **Ejecutar sin preguntar** [V] ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)): en el editor toca **Editar (Edit)**, luego **ⓘ (Información / Info)**, luego **Privacidad (Privacy)**, y activa **Permitir ejecución con el dispositivo bloqueado (Allow Running When Locked)** (etiqueta aprox.).
   - Apple: "The automation will not notify you when it's triggered."
   - **Ojo [V/I]:** la lista oficial de automatizaciones que "can be run automatically" **no incluye Notification**. Creo que la lista no se actualizó desde iOS 26, pero eso es lo que vamos a comprobar.
   - Si en vez de esto ves las opciones antiguas **Ejecutar inmediatamente (Run Immediately)** y **Notificar al ejecutar (Notify When Run)** (etiquetas aprox.), elige Ejecutar inmediatamente y deja *Notificar al ejecutar* **activado** durante las pruebas.
   - Si no ves "Privacidad", ve a Problemas frecuentes, punto P3.
8. **Ejecuta el atajo una vez a mano** con ▶︎ antes de esperar un yapeo.
   - La primera vez que el atajo se conecta a un dominio nuevo, Atajos pide permiso con **Permitir una vez / Permitir siempre / No permitir (Allow Once / Always Allow / Don't Allow)** [V] ([Ajustar privacidad](https://support.apple.com/es-lamr/guide/shortcuts/apd961a4fc65/9.0/ios/26)).
   - Elige **Permitir siempre**. Si no lo haces, la automatización en segundo plano se quedará esperando tu respuesta [I].
   - Puede pedirlo dos veces: para `script.google.com` y para `script.googleusercontent.com` [I].
   - En la ejecución manual no hay notificación, así que los campos llegan vacíos. Es normal: solo pruebas la conexión.

### 1.2 Acciones (versión "descubrimiento + envío")

El trigger entrega la notificación como **Entrada de atajo (Shortcut Input)** [V, nombre de la variable especial en español] ([Tipos de variables](https://support.apple.com/es-lamr/guide/shortcuts/apdd2b316022/ios)) **o** como variable mágica **Notificación** [S]. Usa la que te ofrezca el selector **Seleccionar variable (Select Variable)**.

| # | Acción (Action) | Configuración |
|---|---|---|
| 1 | **Dar formato a fecha (Format Date)** | Fecha: **Fecha actual (Current Date)**. Formato: **Personalizado (Custom)** `yyyyMMdd-HHmmss-SSS` |
| 2 | **Número aleatorio (Random Number)** (etiqueta aprox.) | Mínimo 1000, máximo 9999 |
| 3 | **Texto (Text)** | `[Fecha con formato]-[Número aleatorio]`. Será el `event_id` |
| 4 | **Diccionario (Dictionary)** | Claves de tipo Texto (abajo) |
| 5 | **Obtener contenido de URL (Get Contents of URL)** [V] | URL `/exec`. **Mostrar más (Show More)** → Método **POST** → **Solicitar cuerpo (Request Body): JSON** [V] ([Solicitar tu primera API](https://support.apple.com/es-lamr/guide/shortcuts/apd58d46713f/ios)). Campos: `token` (Texto) = tu token; `event_json` (Texto) = variable **Diccionario** |
| 6 | **Texto (Text)** | `[Contenido de URL]`. Así se fuerza la respuesta a texto |
| 7 | *(solo depuración)* **Mostrar notificación (Show Notification)** [V] | `Luca: [Texto de 6]`. Quítala cuando termines las pruebas |

Claves del **Diccionario** (acción 4):

| Clave | Valor |
|---|---|
| `event_id` | Texto de la acción 3 |
| `source` | `yape_push` |
| `title` | Entrada de atajo / Notificación → propiedad **Título (Title)** |
| `subtitle` | → **Subtítulo (Subtitle)** |
| `body` | → **Cuerpo / Mensaje (Body / Message)** (el nombre exacto se confirma en el paso de descubrimiento) |
| `notif_date` | → **Fecha (Date)**, si existe |
| `app` | → **App**, si existe |
| `captured_at` | **Fecha actual**, con formato ISO 8601 |
| `device_state_hint` | Texto que cambias a mano antes de cada prueba (`E1`, `E2`…) |
| `raw` | **Entrada de atajo** completa, sin elegir propiedad. Es la representación en texto de lo que llegue |

**Descubrimiento de campos (hazlo una vez):**

1. En la acción 4, toca el valor de `title`, luego **Seleccionar variable**, y toca la píldora azul *Entrada de atajo* o *Notificación*. Aparece la lista de propiedades disponibles.
2. **Haz captura de esa lista** y anótala en la sección R1 de Resultados.
3. El campo `raw` sirve de red de seguridad: si una propiedad tiene otro nombre, el texto completo llega igual a la columna `raw_json`.

> **Por qué `event_json` es texto:** insertar un Diccionario dentro de un campo de texto lo convierte a JSON [I] (comportamiento común en Atajos, no documentado en la guía). El servidor acepta tanto el JSON como texto como campos planos. Si `event_json` llega raro, crea los campos directamente en el cuerpo JSON de la acción 5 (`event_id`, `title`, `body`…). El servidor también lo acepta.

### 1.3 Matriz de prueba

Pide un yapeo de **S/1** por cada fila. Yape no debe estar en primer plano: deja otra app en pantalla. Anota la hora exacta en que la otra persona envía el yapeo.

| ID | Estado del teléfono | Preparación |
|---|---|---|
| E1 | Desbloqueado, pantalla encendida | Otra app abierta (Notas, por ejemplo) |
| E2 | Bloqueado, pantalla apagada ~1 min | Botón lateral, esperar 60 s |
| E3 | Bloqueado > 10 min (repetir con > 1 h si puedes) | Sin tocar el teléfono |
| E4 | Tras reinicio, **antes del primer desbloqueo** | Apagar y encender, **no** desbloquear, recibir el yapeo y después desbloquear |
| E5 | Bloqueado, Yape con Mostrar vistas previas = **Si desbloqueaste** | Cambiar el ajuste, repetir E2 y después volver a "Siempre" |
| E6 | Enfoque activo que **no** permite Yape | Activar el enfoque No molestar |
| E7 | Modo de bajo consumo activado + bloqueado | |

Plantilla para anotar:

| ID | Hora envío | ¿Llegó la push? | ¿Fila en hoja? | received_at | Latencia (s) | ¿title/body completos? | ¿Pidió confirmación o mostró "se ejecutará al desbloquear"? | Notas |
|---|---|---|---|---|---|---|---|---|
| E1 | | | | | | | | |
| E2 | | | | | | | | |
| E3 | | | | | | | | |
| E4 | | | | | | | | |
| E5 | | | | | | | | |
| E6 | | | | | | | | |
| E7 | | | | | | | | |
| F1 (filtro "S/") | | | | | | | | |

---

## Experimento 2: buffer offline (Storage)

**Qué documenta Apple [V]:**

- iOS 27 añade las acciones **Get Stored Content, Store Content, Delete Stored Content** y **Add Item to List**: "preserve data each time you run a shortcut" ([New in iOS 27](https://support.apple.com/en-us/149045)).
- Los valores pueden ser propios del atajo o **globales**, compartidos entre atajos, y se sincronizan por iCloud ([WWDC26-310](https://developer.apple.com/videos/play/wwdc2026/310/)).

**Lo que agrega MacStories [S]** ([MacStories p.12](https://www.macstories.net/stories/ios-and-ipados-27-review/12/)):

- *Store Content* guarda la entrada "under a name you choose".
- Tiene un interruptor **Global Value**.
- En el inspector del atajo hay una vista **Storage** para ver y editar los valores.
- *Add Item to List* inserta en una **variable de lista**, al principio, al final o en una posición concreta.

**Manejo de errores.** No hay try/catch. Apple solo documenta **Si** y **Detener atajo** ([Lo que ocurre cuando se completa un atajo](https://support.apple.com/es-lamr/guide/shortcuts/apda9578f70f/ios)).

- Si *Obtener contenido de URL* falla por red (sin conexión, DNS, timeout), lo más probable es que **el atajo se detenga ahí** con un error [I].
- Por eso el patrón es **guardar primero, enviar después**: lo que se detenga después del guardado no pierde el evento.

**Una verdad incómoda sobre lo "offline":**

- Sin internet **tampoco llega la push**, así que no hay evento que capturar.
- APNs guarda **solo una notificación por app** mientras el teléfono está desconectado: "APNs stores only one notification per bundle ID… In most cases, the latest notification is stored" [V] ([Sending notification requests to APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)).
- Consecuencia: **si te yapean 3 veces estando en modo avión, al reconectar es probable que solo llegue la última push**. El buffer no puede recuperar eso. Para eso está la reconciliación por correo o por el historial de Yape.
- El buffer protege contra:
  - conectividad intermitente justo cuando corre el atajo (llegó la push por celular, pero el POST falló);
  - timeouts y arranques en frío de Apps Script;
  - errores del servidor y el redirect 302;
  - cuotas.

### 2.1 Valores globales (una sola vez)

Crea un atajo manual `Luca – Config` con estas acciones y ejecútalo una vez. También puedes crear los valores desde la vista **Almacenamiento (Storage)** del inspector [S].

1. **Texto**: tu URL `/exec`.
2. **Guardar contenido (Store Content)** (etiqueta aprox.): nombre `luca_endpoint`, **Valor global (Global Value)** activado.
3. **Texto**: tu token.
4. **Guardar contenido**: nombre `luca_token`, global.

### 2.2 Modificar `Luca – Captura Yape` (guardar primero)

Mantén las acciones 1–4 del Experimento 1 (el Diccionario). Reemplaza las acciones 5–7 por estas:

| # | Acción | Configuración |
|---|---|---|
| 5 | **Obtener contenido guardado (Get Stored Content)** (etiqueta aprox.) | `luca_pendientes`, global |
| 6 | **Si (If)** [V] | `[Contenido guardado]` **no tiene ningún valor (does not have any value)** (etiqueta aprox.) |
| 7 | → **Crear lista (List)** [V] | Un elemento: **Diccionario** |
| 8 | **De lo contrario (Otherwise)** [V] | |
| 9 | → **Agregar ítem a la lista (Add Item to List)** (etiqueta aprox.) | Ítem: **Diccionario**. Lista: **Contenido guardado**. Posición: **al final** |
| 10 | **Terminar si (End If)** [V] | La salida es la lista resultante (variable mágica *Si el resultado es*) |
| 11 | **Guardar contenido (Store Content)** | Entrada: salida de *Terminar si*. Nombre `luca_pendientes`, global |
| 12 | **Ejecutar atajo (Run Shortcut)** (etiqueta aprox.) | `Luca – Flush` |

El Si de los pasos 6–10 cubre el primer uso, cuando la lista todavía no existe. Que *Agregar ítem a la lista* falle con una lista vacía es **[I]**; el Si lo evita de todas formas.

### 2.3 Atajo `Luca – Flush`

| # | Acción | Configuración |
|---|---|---|
| 1 | **Obtener contenido guardado** | `luca_pendientes` (global) |
| 2 | **Si** … **no tiene ningún valor** → **Detener atajo (Stop Shortcut)** [V] → **Terminar si** | |
| 3 | **Obtener contenido guardado** `luca_endpoint` → **Establecer variable (Set Variable)** [V] `URL` | |
| 4 | **Obtener contenido guardado** `luca_token` → **Establecer variable** `TOKEN` | |
| 5 | **Repetir con cada (Repeat with Each)** [V] | Sobre el contenido del paso 1 |
| 6 | → **Obtener contenido de URL** | URL = `URL`, POST, JSON: `token` = `TOKEN`; `event_json` (Texto) = **Elemento de repetición (Repeat Item)** (etiqueta aprox.) |
| 7 | → **Texto** | `[Contenido de URL]` |
| 8 | → **Si** Texto **contiene (contains)** [V] `OK_` | `OK_SAVED` y `OK_DUP` cuentan como éxito |
| 9 | →→ **Obtener valor del diccionario (Get Dictionary Value)** [V] | Clave `event_id` de *Elemento de repetición* |
| 10 | →→ **Agregar a variable (Add to Variable)** [V] | `enviados` |
| 11 | → **Terminar si** | |
| 12 | **Terminar repetición (End Repeat)** | |
| 13 | **Obtener contenido guardado** `luca_pendientes` | Se relee para no perder eventos que llegaron mientras se enviaba |
| 14 | **Repetir con cada** sobre el paso 13 | |
| 15 | → **Obtener valor del diccionario** `event_id` del Elemento de repetición | |
| 16 | → **Si** `[enviados]` **no contiene** `[valor del diccionario]` → **Agregar a variable** `quedan` → **Terminar si** | |
| 17 | **Terminar repetición** | |
| 18 | **Si** `quedan` **tiene algún valor** → **Guardar contenido** `quedan` como `luca_pendientes` (global) | |
| 19 | **De lo contrario** → **Eliminar contenido guardado (Delete Stored Content)** (etiqueta aprox.) `luca_pendientes` → **Terminar si** | |
| 20 | *(depuración)* **Mostrar notificación** | `Flush: enviados [Contar enviados]` |

Notas:

- Si el POST del paso 6 **lanza error** (sin red), el atajo se detiene ahí y **no se borra nada**. Los eventos que sí se enviaron antes del error se reenviarán la próxima vez, y el servidor responderá `OK_DUP`. Es aceptable.
- **Carrera:** puede llegar un evento entre el paso 13 y el 18. La ventana es pequeña, pero existe. La deduplicación por `event_id` evita duplicados en la hoja, no pérdidas. Anota en R5 si alguna vez ves un evento perdido.
- Que solo **el iPhone** escriba en `luca_pendientes`: los valores globales se sincronizan por iCloud con tus otros dispositivos.

### 2.4 Disparadores del Flush

Dentro de `Luca – Flush`, entra a **Editar > Automatización** y agrega estos disparadores. Si iOS no deja juntar varios en un mismo atajo [S], crea atajos pequeños que solo hagan *Ejecutar atajo → Luca – Flush*.

1. **Wi‑Fi** → Red (Network): **Cualquier red (Any Network)** [V] ([Setting triggers](https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios); etiqueta ES verificada en la edición iOS 26).
2. **Cargador (Charger)** → **Esté conectado (Is Connected)** [V].
3. **Hora del día (Time of Day)** → por ejemplo 09:00, 13:00, 17:00, 21:00. **Repetición (Repeat): Diario (Daily)** [V] ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)). Hace falta un disparador por hora.
4. *(Opcional)* **App** → Yape → **Se abre (Is Opened)** (etiqueta aprox.).
5. **ⓘ > Privacidad > Allow Running When Locked** activado. Wi‑Fi, Charger, Time of Day y App **sí** están en la lista oficial de automatizaciones que pueden ejecutarse solas [V] ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)).

### 2.5 Cómo simular fallos de forma realista

| Método | Qué simula | Cómo |
|---|---|---|
| **M1. Servidor caído** (recomendado) | Error del endpoint, con push y red normales | En Apps Script, Propiedades del script → `FAIL_MODE` = `1`. Recibe S/1. Debe aparecer `ERR_FAIL_MODE`, ninguna fila nueva, y el evento queda en `luca_pendientes` (míralo en la vista Storage). Pon `FAIL_MODE` = `0` y conecta el cargador: aparece **una** fila |
| **M2. URL rota** | 404 / HTML inesperado (no hay error de red, la respuesta no contiene `OK_`) | Edita `luca_endpoint` y añade una `x` al final. Recibe S/1. Restaura y dispara el Flush |
| **M3. Host inalcanzable** | Error de red que **detiene** el atajo | `luca_endpoint` = `https://luca-no-existe.invalid/`. Comprueba que el evento quedó guardado aunque el atajo se cortó |
| **M4. Atajos sin datos** (el más realista) | El teléfono recibe la push, pero Atajos no tiene red | Wi‑Fi apagado, solo celular. **Configuración > Datos celulares (Cellular) > Atajos: desactivado**. Las push las recibe el sistema, no la app de Atajos, así que deberían seguir llegando [I]. Recibe S/1 (el evento queda en el buffer) y luego enciende el Wi‑Fi para que el disparador Wi‑Fi haga el Flush. Que el ajuste por app bloquee *Obtener contenido de URL* es **[I]** y se comprueba aquí |
| **M5. Modo avión** | Desconexión total | Activa el modo avión y pide **2 yapeos**. Desactívalo. Anota cuántas push llegan: se espera 1 por la regla de APNs. Sirve para medir la pérdida, no para probar el buffer |
| **M6. Ráfaga** | Concurrencia | 3 yapeos en < 30 s. ¿3 filas? ¿Se pisó la lista? |

Plantilla:

| Método | ¿Quedó en buffer? | ¿El atajo se detuvo con error? | ¿Qué disparó el Flush? | ¿Filas finales correctas (sin duplicados)? | Notas |
|---|---|---|---|---|---|
| M1 | | | | | |
| M2 | | | | | |
| M3 | | | | | |
| M4 | | | | | |
| M5 | push recibidas: _ / 2 | | | | |
| M6 | | | | | |

---

## Experimento 3: ¿Yape avisa cuando *envías*?

La ayuda oficial de Yape solo menciona notificaciones "cuando alguien te ha yapeado" o por ofertas ([Yape FAQ](https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/por-que-no-escucho-el-sonido-yape-cuando-me-yapean)).

1. Deja activo `Luca – Captura Yape` **sin filtro**, en la versión del Experimento 1 o del 2.
2. Yapea **S/1** a tu contacto de confianza.
3. Inmediatamente después:
   - Mira el Centro de notificaciones. ¿Hay una notificación de Yape del tipo "Yapeaste…"?
   - Mira la hoja. ¿Hay fila nueva con `source = yape_push`?
4. Repite con **S/12**. Por encima de tu umbral, Yape manda correo ("Notificaciones por yapeo": S/10, 50, 100, 500) ([Yape](https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/como-recibo-un-correo-de-aviso-cada-vez-que-envie-un-yapeo)). Anota si llega el correo.
5. **Captura de todo, durante 3–7 días:** deja la automatización corriendo sin filtro. Cada notificación de Yape (recibidos, enviados, promos, avisos de seguridad) queda en la hoja y te sirve para armar **fixtures del parser**.
   - Quita la acción *Mostrar notificación* de depuración para no duplicar avisos.

Muestras (**redacta los datos personales**: nombres → `<NOMBRE>`, últimos dígitos → `<NNN>`):

| # | Tipo (recibido / enviado / promo / otro) | title | subtitle | body (redactado) | ¿Disparó automatización? | Fecha |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

---

## Prompt extra: generar el atajo de prueba con Gmail desde el generador de Atajos

iOS 27 permite describir el atajo en lenguaje natural. Este prompt crea la versión de **prueba controlada**
(disparador con la app Gmail en vez de Yape) que se usó el 2026-10-04 para verificar que la automatización
corre sola y entrega `title`/`subtitle`/`body` (ver `prompt-atajo-ios27-yape.md` para las versiones de Yape y Flush).
Reemplaza `<URL_WEBHOOK>` por tu URL de webhook.site antes de pegarlo.

```text
Crea un atajo llamado "Luca – Captura Gmail (prueba)" pensado para ejecutarse como automatización
personal cuando llega una notificación de la app Gmail. Debe correr sin pedir confirmación, sin
abrirse en pantalla y sin mostrar ninguna alerta ni notificación propia.

Pasos exactos, en este orden:

1. Toma la entrada del atajo (la notificación que lo disparó) y guarda en variables separadas:
   - "titulo": el título de la notificación
   - "subtitulo": el subtítulo de la notificación (puede estar vacío)
   - "cuerpo": el texto o mensaje de la notificación
   - "fechaNotif": la fecha de la notificación
   - "raw": la entrada completa convertida a texto

2. Guarda la fecha y hora actual en la variable "ahora", formateada como ISO 8601 incluyendo la
   hora y la zona horaria (por ejemplo 2026-10-04T12:34:56-05:00), no solo la fecha.

3. Genera un identificador único "eventId" concatenando "ahora" con un número aleatorio entre
   100000 y 999999, separados por un guion.

4. Obtén el nombre del dispositivo y guárdalo en "dispositivo".

5. Comprueba si el dispositivo está bloqueado y guarda el resultado en "bloqueado" (si no existe
   una acción para saberlo, pon el texto "desconocido").

6. Construye un Diccionario con estas claves y valores:
   - "schema_version": "1"
   - "id": eventId
   - "source": "gmail-test"
   - "channel": "ios-notification"
   - "token": "luca-test-7f3a9c2e"
   - "title": titulo
   - "subtitle": subtitulo
   - "body": cuerpo
   - "notified_at": fechaNotif
   - "received_at": ahora
   - "device": dispositivo
   - "locked": bloqueado
   - "raw": raw

7. Haz una petición HTTP a "<URL_WEBHOOK>" con el método POST, tipo de cuerpo JSON, enviando el
   Diccionario del paso 6 como cuerpo.

8. Si la petición falla, guarda el Diccionario del paso 6 añadiéndolo a la lista "luca_pendientes"
   del almacenamiento persistente de Atajos (acción "Añadir elemento a la lista" del grupo
   Almacenamiento). No muestres nada en pantalla en ningún caso.
```

Después de generarlo:

1. Abre el atajo → **Editar** → **ⓘ** → **Privacidad** → activa **"Permitir ejecución con el equipo bloqueado"** (etiqueta aprox.).
2. **Editar** → **Automatización** → **Notificación** → App: **Gmail** → **Ejecutar inmediatamente** → Listo. Si el generador ya creó la automatización, solo verifica que esté en "Ejecutar inmediatamente".
3. **No lo ejecutes con el botón "Ejecutar"**: sin notificación de entrada, todos los campos llegan vacíos.
4. En Ajustes → Notificaciones → Gmail: **Entrega inmediata**, sin **Resumen programado**, previsualizar **Siempre**.
5. **Prueba desbloqueado:** envíate un correo con asunto `PRUEBA LUCA 123` → en webhook.site debe aparecer el JSON con `title` (remitente), `subtitle` (asunto) y `body` (inicio del mensaje). *(Verificado el 2026-10-04.)*
6. **Prueba bloqueado:** iPhone bloqueado con la pantalla apagada 1–2 min, envíate un correo con asunto `PRUEBA BLOQUEADO 456`. Anota si llegó, el valor de `locked` y si el iPhone mostró algún aviso de Atajos.
7. Cuando ambas pasen, cambia la app del disparador a **Yape** y sigue con el Experimento 1 (pruebas A/B/C).

## Problemas frecuentes

| # | Síntoma | Qué revisar |
|---|---|---|
| P1 | La automatización no se dispara | (a) ¿El atajo está **Activado** en la pantalla Automatización? El filtro (Filter) muestra Turned On / Turned Off [V] ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)). (b) ¿Hay un **filtro** de título o mensaje? Quítalo (bug de la beta 1 [S]). (c) ¿Llegó la notificación? Revisa el Centro de notificaciones. (d) Enfoque, Resumen programado o modo de bajo consumo activos. (e) Las automatizaciones "sync to other devices with the automation disabled" [V] ([Intro](https://support.apple.com/guide/shortcuts/intro-to-personal-automation-apd690170742/ios)): actívala en **este** iPhone. (f) Reinicia el iPhone y verifica que estás en 27.0.1 |
| P2 | Pide confirmación (aparece una notificación "¿Ejecutar…?") | Activa *Allow Running When Locked*. Si la opción existe y aun así pregunta, anótalo: confirma que Notification no está en la lista de ejecución automática. Revisa también los permisos por acción ("You also may need to set individual actions to run automatically" [V]) |
| P3 | No aparece **Privacidad** / *Allow Running When Locked* | En iOS 26 Apple indicaba: "si no ves la pestaña Privacidad, significa que el atajo no tiene acceso a tus datos" [V, iOS 26] ([Ajustar privacidad](https://support.apple.com/es-lamr/guide/shortcuts/apd961a4fc65/9.0/ios/26)). Agrega primero *Obtener contenido de URL*, ejecuta ▶︎ y elige *Permitir siempre*. Después vuelve a ⓘ [I] |
| P4 | Aparece "se ejecutará cuando desbloquees el iPhone" | Es comportamiento reportado [S] ([Apple Community](https://discussions.apple.com/thread/254478980)). Anota en qué estado (E2/E3/E4) pasa. Es el dato clave del Experimento 1 |
| P5 | Fila en la hoja, pero el atajo no ve `OK_` | El redirect 302 no se siguió bien o se repitió como POST [I]. Pon la respuesta en *Mostrar notificación* para ver qué llega (HTML de error, "Moved Temporarily", 405). Mientras tanto el buffer reenvía y el servidor responde `OK_DUP`, así que no se duplica nada. Si se confirma, la solución es un **Cloudflare Worker** que responda 200 directo y reenvíe a Apps Script o a Sheets API |
| P6 | `ERR_AUTH` | El token del atajo no coincide con la propiedad `TOKEN`. Busca espacios o saltos de línea al pegar |
| P7 | Cambié el código y no se refleja | Hay que crear **Nueva versión** en *Administrar implementaciones*. La URL `/exec` sirve la versión desplegada |
| P8 | `title`/`body` vacíos solo estando bloqueado | Probablemente Show Previews está en "Si desbloqueaste" (E5) o hay restricciones de Data Protection. Pon Yape en "Siempre" y repite |
| P9 | El texto llega "resumido" o distinto | Desactiva Resumen de notificaciones para Yape [V] y compáralo con `raw` |
| P10 | Retrasos de minutos u horas | Resumen programado (usa Entrega inmediata), Enfoque o modo de bajo consumo |

---

## Seguridad

- El **token** es la única barrera: la URL `/exec` con acceso "Cualquier usuario" es pública.
  - Genera uno largo con `newToken()`.
  - **Rótalo** si lo compartes por error. Ejecuta `newToken()` y actualiza `luca_token`; no hace falta redeploy, porque las propiedades se leen en cada request.
- **No subas a git** la URL `/exec` ni el token. Si alguno se filtra, ve a *Administrar implementaciones*, **archiva** esa implementación y crea otra: la URL cambia.
- El servidor **no guarda el token** en la hoja (`delete ev.token`) y neutraliza fórmulas (`safe_`).
- webhook.site es público: solo pruebas con S/1 y nada más.
- `luca_token` como valor global se sincroniza por iCloud a tus dispositivos. Para pruebas es aceptable.
- La hoja contiene nombres de contrapartes. No la compartas.
- Cuando termines los experimentos, desactiva las automatizaciones que no vayas a usar.

---

## Resultados (llenar)

**R0. Entorno**

- Modelo de iPhone:
- iOS:
- Solicitar código:
- Face ID: sí / no
- Apple Intelligence: sí / no
- Fecha de las pruebas:

**R1. Campos que ofrece el disparador.** Lista de propiedades vista en *Seleccionar variable*:

- Nombre de la variable: Entrada de atajo / Notificación / otro:
- Propiedades:
- Ejemplo de `raw_json` (redactado):

**R2. Ejecución sin confirmación**

- ¿Existe *Allow Running When Locked* para Notification? sí / no
- ¿Corrió sin tocar nada en E1? sí / no
- ¿En E2 y E3? sí / no

**R3. Matriz de estados.** Pega aquí la tabla 1.3.

**R4. Filtro "S/" en el mensaje funciona:** sí / no

**R5. Buffer.** Pega aquí la tabla 2.5.

- ¿Storage escribe estando bloqueado? sí / no
- ¿Se perdió algún evento? sí / no

**R6. Push al enviar**

- S/1 → ¿push? sí / no · ¿automatización? sí / no
- S/12 → ¿push? sí / no · ¿correo? sí / no

**R7. Muestras de texto.** Pega aquí la tabla del Experimento 3.

**R8. Latencia típica (s):** p50: ___ · máximo: ___

## Qué hacemos con los resultados

```
¿El disparador Notificación corre SIN confirmación con el iPhone bloqueado (E2/E3)?
├─ NO → La captura automática en iOS no es viable hoy.
│       → Plan B: correo + Gmail/Apps Script (servidor) y captura manual rápida
│         (Back Tap / botón de acción). Reprobar en cada iOS 27.x.
└─ SÍ → ¿Llegan title/body completos (R1, E2, E3)?
        ├─ NO (vacíos u ocultos) → ¿Se arregla con vistas previas en "Siempre" (E5)?
        │     ├─ SÍ → Exigir ese ajuste en el onboarding de Luca.
        │     └─ NO → Solo sirve como "aviso de que hubo un yapeo";
        │             reconciliar el monto por correo o con captura manual.
        └─ SÍ → ¿Funciona el buffer (M1–M4 sin pérdidas ni duplicados)?
                ├─ NO → Usar el POST directo y reconciliar diariamente con el correo.
                └─ SÍ → Adoptar Captura + Flush como vía principal de iOS.
                        Luego: ¿Yape notifica los ENVÍOS (R6)?
                        ├─ SÍ → Cobertura completa por push. Parser en servidor
                        │       con los fixtures de R7.
                        └─ NO → Recibidos por push. Envíos ≥ umbral por correo.
                                Envíos < umbral por captura manual rápida.
¿Hubo problemas con el 302 o la respuesta (P5)? → Poner un Cloudflare Worker idempotente
                                                 delante de Sheets.
```

---

## Fuentes (consultadas el 2026-10-04)

**Primarias**

- Apple – Add automations to Shortcuts (iOS 27; Edit > Automation; Privacy > Allow Running When Locked; lista auto-run): https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios
- Apple – Event triggers (Notification: App, Add Filter; Time of Day): https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios
- Apple – Setting triggers (Wi‑Fi Any Network; Charger Is Connected): https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios
- Apple – Intro to shortcuts with automations (sincronización desactivada en otros dispositivos): https://support.apple.com/guide/shortcuts/intro-to-personal-automation-apd690170742/ios
- Apple – New in iOS 27 (Storage actions, Notifications automation): https://support.apple.com/en-us/149045
- Apple – WWDC26 sesión 310 "What's new in Shortcuts": https://developer.apple.com/videos/play/wwdc2026/310/
- Apple – Manual de Atajos (ES, edición iOS 26; etiquetas de acciones):
  - Crear automatización: https://support.apple.com/es-lamr/guide/shortcuts/apdfbdbd7123/ios
  - Activadores de configuración: https://support.apple.com/es-lamr/guide/shortcuts/apde31e9638b/ios
  - Activadores de eventos: https://support.apple.com/es-lamr/guide/shortcuts/apd932ff833f/ios
  - Solicitar tu primera API: https://support.apple.com/es-lamr/guide/shortcuts/apd58d46713f/ios
  - Tipos de variables: https://support.apple.com/es-lamr/guide/shortcuts/apdd2b316022/ios
  - Usar acciones Si: https://support.apple.com/es-lamr/guide/shortcuts/apd83dcd1b51/ios
  - Usar acciones Repetir: https://support.apple.com/es-lamr/guide/shortcuts/apdc11deb2c1/9.0/ios/26
  - Mostrar notificación: https://support.apple.com/es-lamr/guide/shortcuts/apd2175adcab/9.0/ios/26
  - Lo que ocurre cuando se completa un atajo: https://support.apple.com/es-lamr/guide/shortcuts/apda9578f70f/ios
  - Ajustar privacidad: https://support.apple.com/es-lamr/guide/shortcuts/apd961a4fc65/9.0/ios/26
- Apple – Manual del iPhone (ES, iOS 27):
  - Cambiar la configuración de las notificaciones: https://support.apple.com/es-lamr/guide/iphone/iph7c3d96bab/ios
  - Resumir notificaciones con Apple Intelligence: https://support.apple.com/es-lamr/guide/iphone/iph1fbe7d2b9/ios
- Apple Developer – Sending notification requests to APNs (una notificación guardada por app): https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
- Apple Platform Security – Data Protection classes: https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web
- Google – Apps Script Content Service (seguir redirecciones): https://developers.google.com/apps-script/guides/content
- Yape – Notificaciones (sonido): https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/por-que-no-escucho-el-sonido-yape-cuando-me-yapean
- Yape – Correo de aviso al enviar un yapeo: https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/como-recibo-un-correo-de-aviso-cada-vez-que-envie-un-yapeo

**Secundarias**

- MacStories – iOS 27 review, Automations (p.13): https://www.macstories.net/stories/ios-and-ipados-27-review/13/
- MacStories – iOS 27 review, Storage / Add Item to List (p.12): https://www.macstories.net/stories/ios-and-ipados-27-review/12/
- 9to5Mac – iOS 27 Shortcuts new actions: https://9to5mac.com/2026/09/29/ios-27s-shortcuts-app-adds-35-new-improved-actions-heres-whats-new/
- Derek Seaman – Notification automation (beta 1, bug de filtros): https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html
- WalletPal – Notification trigger (Shortcut Input: title, subtitle, body): https://walletpalapp.github.io/apple-shortcuts-notification-trigger.html
- Matthew Cassinelli – iOS 27 filtros de automatizaciones: https://matthewcassinelli.com/ios-27-turn-automations-off-on-filters-shortcuts/
- Kanshi Tanaike – Flujo de requests a Web Apps de Apps Script (302): https://medium.com/google-cloud/understanding-flow-of-request-to-web-apps-created-by-google-apps-script-ac49e80f7c6b
- Apple Community – "will run once your iPhone is unlocked": https://discussions.apple.com/thread/254478980
- webhook.site: https://webhook.site
