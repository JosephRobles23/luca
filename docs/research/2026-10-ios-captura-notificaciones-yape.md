# Research: captura automática de notificaciones de Yape en iOS (y comparación con Android)

- Fecha: 2026-10-04
- Contexto: `docs/discovery/discovery-ios-yape.md` (hipótesis: usar la notificación push de Yape como evento → Atajos de iOS → POST a Apps Script `doPost` / Cloudflare Worker → Google Sheet).
- Método: cada afirmación se cita con su fuente. **Primaria** = Apple Support / Apple Developer / WWDC / Android Developers / sitio oficial de Yape o Apple Pay. **Secundaria** = prensa, blogs, foros; se usan solo como pistas o reportes de comportamiento real y se marcan como tales. Lo que no se pudo confirmar se marca **no verificado**.

---

## TL;DR

**Versión de iOS de referencia.** La última versión es **iOS 27.0.1**, publicada el 28 sep 2026. iOS 27 salió el 14 sep 2026, y la rama 26 sigue con 26.7.1 ([Apple security releases](https://support.apple.com/en-us/100100)). La guía oficial de Atajos ya está en su edición "iOS 27" ([Shortcuts User Guide](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)).

| Pregunta | Veredicto |
|---|---|
| ¿Existe un disparador "cuando recibo una notificación de Yape"? | **Sí, pero solo desde iOS 27.** La guía oficial documenta un disparador **Notification**. Tiene la opción *App* y un filtro opcional por *Message*, *Subtitle* o *Title* ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)). En iOS 26 no existía ([Event triggers, iOS 26](https://support.apple.com/guide/shortcuts/apd932ff833f/9.0/ios/26)). Apple también lo anuncia en [New in iOS 27](https://support.apple.com/en-us/149045) y en la [sesión 310 de WWDC26](https://developer.apple.com/videos/play/wwdc2026/310/). |
| ¿El atajo recibe título y cuerpo? | **Sí — verificado en dispositivo el 2026-10-04 (iOS 27, disparador con Mail, desbloqueado):** llegan `title`, `subtitle`, `body`, la entrada completa como texto y la fecha de la notificación. Apple sigue sin documentar los campos. Apple solo documenta los filtros (Title, Subtitle, Message). Según fuentes secundarias hay una variable mágica "Notification" con cuerpo, fecha y si es *time-sensitive* ([MacStories](https://www.macstories.net/stories/ios-and-ipados-27-review/13/)). Otro reporte secundario usa *Shortcut Input* con Title, Subtitle y Body ([WalletPal](https://walletpalapp.github.io/apple-shortcuts-notification-trigger.html)). **Campos exactos: no verificado.** |
| ¿Puede capturar en segundo plano y sin confirmación? | **Sí — verificado en dispositivo el 2026-10-04:** con "Allow Running When Locked", la automatización Notificación corrió con el iPhone bloqueado y la pantalla apagada 1–2 min, sin confirmación, y entregó el contenido (~28 s de latencia). La documentación sigue siendo ambigua: En iOS 27, para correr sin preguntar se activa *Privacy → Allow Running When Locked*, y Apple dice que "la automatización no te notificará" ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)). Pero la lista oficial de automatizaciones que pueden correr solas **no incluye Notification** (tampoco Screenshot ni Keyboard). Esa lista parece heredada de iOS 26 sin cambios ([iOS 26](https://support.apple.com/guide/shortcuts/apd602971e63/9.0/ios/26)). Un reporte secundario de la beta 1 dice que "corre incluso con el dispositivo bloqueado" ([Derek Seaman](https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html)). **Hay que probarlo en el dispositivo.** |
| ¿Funciona desbloqueado con la pantalla apagada? | En iOS, pantalla apagada (auto-lock o botón lateral) = **bloqueado**. Con *Require Passcode: Immediately*, las claves de la clase "Complete Protection" se descartan unos 10 s después de bloquear ([Apple Platform Security](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)). No hay un estado oficial "desbloqueado con pantalla apagada" que debamos esperar. Ver la tabla de estados. |
| ¿Yape manda push de *todos* los movimientos? | **No verificado, y hay una alerta.** La ayuda oficial de Yape dice que las notificaciones aparecen "cuando tenemos ofertas especiales o cuando alguien te ha yapeado" ([Yape](https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/por-que-no-escucho-el-sonido-yape-cuando-me-yapean)). No menciona push para yapeos **enviados**. Los ejemplos tipo "Yapeaste S/12.50 a María" del discovery no tienen respaldo y hay que probarlos. |
| ¿Existe una cola offline? | **No hay cola ni reintento documentado en "Get Contents of URL"** (no verificado; no encontré documentación oficial). Sí se puede construir un buffer. iOS 27 trae acciones nativas de **Storage** (*Store Content*, *Get Stored Content*, *Delete Stored Content*, *Add Item to List*) que persisten entre ejecuciones y sincronizan por iCloud ([New in iOS 27](https://support.apple.com/en-us/149045); [WWDC26-310](https://developer.apple.com/videos/play/wwdc2026/310/)). Para vaciar el buffer sirven los disparadores Wi‑Fi, Charger, Time of Day y App, que están en la lista oficial de "pueden correr automáticamente" ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)). |
| ¿Hay API oficial para leer notificaciones de otra app? | **No.** `UNUserNotificationCenter` gestiona las notificaciones "for your app or app extension" ([Apple Developer](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter)). `UNNotificationServiceExtension` solo modifica pushes de tu propia app ([Apple Developer](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension)). El único camino en iOS es el disparador de Atajos de iOS 27. |
| ¿Existe un disparador de captura de pantalla? | **Sí, en iOS 27.** El disparador *Screenshot* se activa al guardar una captura en Photos, en Files o en el portapapeles ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)). Que corra sin confirmación: no verificado (tampoco aparece en la lista de auto-run). |
| ¿Sirve el disparador Wallet Transaction para Yape? | **No.** Solo se dispara al **tocar con una tarjeta de Wallet** ("When I tap: Select a card…") ([Transaction trigger](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)). Sí sirve para compras con Apple Pay de tarjetas BCP, Interbank, BBVA, Scotiabank y otras en Perú ([Apple – bancos LatAm](https://support.apple.com/en-us/109524)). |

**Recomendación corta:** en iOS 27, el disparador **Notification (Yape)** con *Allow Running When Locked*, más un **buffer con Storage** y vaciado por Wi‑Fi o cargador, es la vía principal *candidata*. Antes de construir sobre ella hay que validar tres cosas en el dispositivo: (1) que corre sin confirmación estando bloqueado, (2) que entrega el texto completo, (3) que Yape notifica también los envíos. Si falla (3), los envíos ≥ S/10 se cubren con correo y Gmail, y los menores con captura manual rápida.

---

## Tabla: estado del dispositivo × qué funciona

Leyenda: ✅ documentado · ⚠️ documentado con matices o solo con reporte secundario · ❓ no verificado (probar) · ❌ documentado que no.

| Estado | Llega la push de Yape | Se dispara la automatización Notification (iOS 27) | Corre sin confirmación | "Get Contents of URL" (red) | Leer/escribir archivos o Storage | Extract Text from Image |
|---|---|---|---|---|---|---|
| **Desbloqueado, pantalla encendida** | ✅ (comportamiento normal de APNs) | ✅ disparador documentado ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)) | ⚠️ con *Allow Running When Locked* ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)); la lista de auto-run no menciona Notification | ✅ si hay red | ✅ | ✅ on-device (ver §4) |
| **"Desbloqueado con pantalla apagada"** | En la práctica es el estado *bloqueado*: con passcode "Immediately", la clase A se descarta a unos 10 s ([Platform Security](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)) | igual que bloqueado | igual que bloqueado | igual que bloqueado | igual que bloqueado | — |
| **Bloqueado (después del primer desbloqueo)** | ✅ | ⚠️ reporte secundario: "corre incluso bloqueado" (beta 1) ([Derek Seaman](https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html)) | ⚠️/❓ secundario: hay automatizaciones que muestran "Automations will run once your iPhone is unlocked" ([Apple Community](https://discussions.apple.com/thread/254478980)) | ❓ secundario: unas veces funciona y otras no ([Apple Dev Forums](https://developer.apple.com/forums/thread/665845)) | ⚠️ los datos de apps de terceros tienen por defecto la clase C, accesible tras el primer desbloqueo ([Platform Security](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)); que Shortcuts/Storage use clase C: no verificado | n/a (necesitas tomar la captura) |
| **Antes del primer desbloqueo (tras reinicio)** | ❓ (APNs entrega, pero las apps no pueden leer sus datos de clase C) | ❓ muy probablemente no útil | ❓ | ❓ | ❌ la clase C "cannot be accessed until after the device has booted [and unlocked]" ([Apple Developer](https://developer.apple.com/documentation/foundation/fileprotectiontype/completeuntilfirstuserauthentication)) | ❌ |
| **Sin internet (cualquier estado)** | La push no llega hasta reconectar (APNs) — no verificado para Yape | ❓ se dispara cuando llega la push | — | ❓ falla; no hay reintento documentado | ✅ Storage persiste localmente y sincroniza después ([WWDC26-310](https://developer.apple.com/videos/play/wwdc2026/310/)) | ✅ on-device |

---

## Hallazgos detallados

### 1. Disparador por notificación de una app de terceros

**1.1 Existe en iOS 27 (y no en iOS 26).**
- La guía de Atajos (edición iOS 27) dice textualmente: "The Notification trigger has the following options: **App**: Specify the app a notification will be received from. **Add Filter**: Specify the Message, Subtitle, or Title to filter for a notification event." En la misma página aparece el nuevo disparador *Screenshot* (Photos / Files / Clipboard) y *Keyboard* ([Event triggers – iOS 27, primaria](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)).
- La misma página en su edición iOS 26 no tiene Notification, Screenshot ni Keyboard ([Event triggers – iOS 26, primaria](https://support.apple.com/guide/shortcuts/apd932ff833f/9.0/ios/26)).
- Apple, "New in iOS 27": "Notifications ('When I receive a notification from News')", "Keyboard (…)", "Screenshot ('When a screenshot is saved', iOS, iPadOS, and macOS)". También: "Automations are now built directly into shortcuts, including shared shortcuts" y "Automations now sync between devices" ([support.apple.com/en-us/149045, primaria](https://support.apple.com/en-us/149045)).
- WWDC26, sesión 310 "What's new in Shortcuts": "the notification automation, which runs when a notification is received from a specific app". El ejemplo filtra por la palabra "arriving" y recomienda a los desarrolladores escribir notificaciones "easy to parse and interpret within a shortcut" ([WWDC26-310, primaria](https://developer.apple.com/videos/play/wwdc2026/310/)). *Nota:* el resumen del capítulo en esa página dice "In iOS 26", pero todo lo demás habla de las versiones 27. Lo interpreto como errata.
- En iOS 27 la automatización ya no se crea en una pestaña aparte. Se añade dentro del atajo ("Tap Edit, then Automation. Choose a trigger…") ([Add automations, primaria](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)).

**1.2 Qué datos recibe el atajo.**
- **Primaria:** Apple solo documenta los filtros: *Title*, *Subtitle*, *Message* y la *App* ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)). No encontré una página oficial con los campos de la salida (Shortcut Input). **No verificado.**
- **Secundaria:** MacStories describe una variable mágica "Notification" que permite comparar "its body text, time-sensitive nature, or date" ([MacStories, secundaria](https://www.macstories.net/stories/ios-and-ipados-27-review/13/)). WalletPal mapea Title, Subtitle y Body desde *Shortcut Input* ([WalletPal, secundaria](https://walletpalapp.github.io/apple-shortcuts-notification-trigger.html)).
- Datos esperables, todos por confirmar: **app, title, subtitle, body/message, fecha, time-sensitive**. El timestamp también se puede generar con *Current Date* dentro del atajo.
- Problema conocido en beta: en la beta 1 los filtros de título y mensaje estaban rotos, y la automatización solo se disparaba sin filtros ([Derek Seaman, secundaria](https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html)). No sé si se corrigió en la versión final, así que hay que probarlo.

**1.3 Vías oficiales para leer notificaciones de otra app (fuera de Atajos): no hay.**
- `UNUserNotificationCenter`: "The central object for managing notification-related activities for your app or app extension". `getDeliveredNotifications` devuelve "all of your app's delivered notifications" ([UNUserNotificationCenter, primaria](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter); [getDeliveredNotifications, primaria](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getdeliverednotifications(completionhandler:))).
- `UNNotificationServiceExtension`: se carga "When your app receives a remote notification for your app" ([primaria](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension)).
- Resúmenes de notificaciones de Apple Intelligence: son una función de presentación (Settings → Notifications → Summarize Notifications) y no exponen datos a Atajos ni a terceros según la página oficial ([iPhone User Guide, primaria](https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios)). No encontré ninguna acción ni App Intent que lea esos resúmenes (**no verificado** que no exista; no aparece en Apple ni en las sesiones de WWDC26 revisadas).
- App Intents: una app solo puede exponer *sus* intents. Según un resumen secundario del Group Lab de WWDC26, no hay API para que una app invoque intents de otra; Siri y Atajos orquestan ([WWDC26-8011](https://developer.apple.com/videos/play/wwdc2026/8011/), contenido sin verificar en la página).
- En consecuencia, una app propia de Luca para iOS **no** podría leer las notificaciones de Yape. El único punto de entrada es Atajos.

**1.4 Disparadores oficiales de automatización (iOS 27).**
- Event: Time of Day (incluye Sunrise/Sunset), Alarm, Sleep, **Keyboard**, **Screenshot**, **Notification**, Apple Watch Workout, Sound Recognition ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)).
- Travel: Arrive, Leave, CarPlay ([Travel triggers](https://support.apple.com/guide/shortcuts/travel-triggers-apd8ebfc4e8e/ios)).
- Communication: Email (Sender, Subject Contains, Account, Recipient) y Message (Sender, Message Contains) ([Communication triggers](https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios)).
- Transaction: "When I tap: Select a card" ([Transaction trigger](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)).
- Setting: Wi‑Fi, Bluetooth, Focus, Low Power Mode, Battery Level, Charger, NFC, App (Is Opened / Is Closed), Airplane Mode ([Setting triggers](https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios)).

### 2. Ejecutar sin confirmación y en segundo plano

- **iOS 27 (primaria):** "Some personal automations can run without asking you for confirmation when they're triggered… Tap Edit, then [Info]. Tap Privacy then enable **Allow Running When Locked**. The automation will not notify you when it's triggered." La lista de las que "can be run automatically" es: Time of Day, Alarm, Sleep, Arrive, Leave, CarPlay, Email, Message, Transaction, Wi‑Fi, Bluetooth, Apple Watch Workout, NFC, App, Airplane Mode, Do Not Disturb, Low Power Mode, Battery Level, Charger, Sound Recognition. Añade: "You also may need to set individual actions to run automatically" ([Add automations, primaria](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)).
- **Lectura crítica:** esa lista es la misma que en la guía de iOS 26, que además decía que "Before I Commute" no puede correr automáticamente ([iOS 26, primaria](https://support.apple.com/guide/shortcuts/apd602971e63/9.0/ios/26)). Todavía dice "Do Not Disturb" en lugar de Focus. Por eso creo que la lista **no se actualizó** para Notification, Screenshot y Keyboard. Su ausencia no prueba que no se puedan ejecutar solas, pero tampoco hay confirmación oficial. **No verificado.**
- **Nombres en la interfaz:** desde iOS 17 la interfaz muestra "Run Immediately / Run After Confirmation" y el interruptor "Notify When Run", que solo aparece con Run Immediately ([iDownloadBlog, secundaria](https://www.idownloadblog.com/2022/02/01/run-shortcuts-automations-without-notifications-tutorial/)). La guía de Apple usa otros términos ("Ask Before Running" en iOS 26, "Allow Running When Locked" en iOS 27). Cómo se llama exactamente en iOS 27 hay que verlo en el dispositivo.
- **Segundo plano:** Apple dice que al correr un atajo fuera del editor "no preview of the output is shown… you're returned to where you left off" ([Shortcut completion, primaria](https://support.apple.com/guide/shortcuts/shortcut-completion-apda9578f70f/ios)). Que la automatización por notificación no abra la app de Atajos: secundario ("silently runs the shortcut in the background", [Beard.fm](https://wiki.beard.fm/whats-new-ios-27/how-to-use-ios-27s-notification-triggers-for-advanced-cross-)). **No verificado** con fuente primaria.

### 3. Comportamiento según estado del dispositivo

- **Clases de Data Protection (primaria, [Apple Platform Security](https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web)):**
  - Clase A (Complete): "Shortly after the user locks a device (10 seconds, if the Require Password setting is Immediately), the decrypted class key is discarded".
  - Clase B (Complete Unless Open): permite escribir archivos con el dispositivo bloqueado, por ejemplo un adjunto de correo descargándose.
  - Clase C (Until First User Authentication): "This is the default class for all third-party app data not otherwise assigned". Se mantiene accesible tras el primer desbloqueo aunque se vuelva a bloquear.
  - Antes del primer desbloqueo, la clase C no es accesible ([FileProtectionType, primaria](https://developer.apple.com/documentation/foundation/fileprotectiontype/completeuntilfirstuserauthentication)).
- **Pantalla apagada:** en el iPhone, apagar la pantalla con el botón lateral o por auto-lock bloquea el dispositivo. El caso "desbloqueado con pantalla apagada" solo existe durante el periodo de gracia de "Require Passcode" (con Face ID normalmente es inmediato). Para el diseño hay que tratar pantalla apagada como **bloqueado**.
- **Qué acciones requieren desbloqueo:** Apple no publica una lista. La guía solo advierte que puede hacer falta permitir acciones individuales ([Add automations](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)) y que existen diálogos de privacidad *Allow Once / Always Allow* por atajo ([Adjust privacy settings](https://support.apple.com/guide/shortcuts/adjust-privacy-settings-apd961a4fc65/ios)). Lo que reportan los usuarios (secundario):
  - "There are actions that can only run when the device is unlocked", sobre todo de apps de terceros, y no hay lista maestra ([Automators Talk 2025](https://talk.automators.fm/t/why-do-some-time-triggered-shortcuts-run-on-a-locked-iphone-and-others-fail/18608)).
  - Leer y escribir un .txt funcionó bloqueado en la prueba de un usuario; "It tends to be interactions with apps, not files, that create locked device issues" ([Automators Talk 2024](https://talk.automators.fm/t/how-run-file-actions-while-phone-is-locked/17646)).
  - Time of Day + Get Contents of URL falló de madrugada con el teléfono inactivo ([Apple Developer Forums](https://developer.apple.com/forums/thread/665845)).
  - El mensaje "Automations will run once your iPhone is unlocked" aparece en hilos de la comunidad ([Apple Community](https://discussions.apple.com/thread/254478980)).
- **Vista previa de la notificación bloqueado:** la opción Show Previews tiene los valores Always, When Unlocked y Never ([iPhone User Guide, primaria](https://support.apple.com/guide/iphone/access-features-from-the-lock-screen-iphcd5c65ccf/ios); [Apple 108781, primaria](https://support.apple.com/en-us/108781)). Si la automatización recibe el cuerpo completo cuando la vista previa de Yape está en "When Unlocked" y el teléfono está bloqueado: **no verificado**. Para la prueba, configurar Yape en "Always".

### 4. Captura de pantalla + "Extract Text from Image"

- **El disparador existe (iOS 27):** "The Screenshot trigger has the following options: Photos… Files… Clipboard" ([Event triggers, primaria](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)). La captura en sí sigue siendo manual (botones), así que exige que el dispositivo esté desbloqueado y que el usuario actúe. Que corra sin confirmación: no verificado (no está en la lista de auto-run).
- **Alternativas de un gesto:** Back Tap ejecuta un atajo con doble o triple toque (Settings → Accessibility → Touch → Back Tap) ([primaria](https://support.apple.com/guide/shortcuts/run-shortcuts-tapping-iphone-apd897693606/ios)). El Action button lo hace en iPhone 15 Pro o posterior ([primaria](https://support.apple.com/guide/shortcuts/run-shortcuts-with-the-action-button-apdfea15680b/ios)). Un atajo con "Take Screenshot → Extract Text from Image → POST" lanzado por Back Tap es una **captura manual rápida** viable (las acciones concretas no están verificadas en la guía; hay que probarlas).
- **OCR sin internet:** según Apple Developer, en Vision "all of Vision's processing happens on the user's device" ([Recognizing text in images, primaria](https://developer.apple.com/documentation/vision/recognizing-text-in-images)). Que la acción *Extract Text from Image* use Vision o Live Text en el dispositivo es una inferencia razonable, pero **no verificada** con documentación de la acción. 9to5Mac (secundaria) informa que en iOS 27 "Extract Text From Image can now extract tables or lists" ([9to5Mac](https://9to5mac.com/2026/09/29/ios-27s-shortcuts-app-adds-35-new-improved-actions-heres-whats-new/)).

### 5. Sin internet: errores, cola y diseño del buffer

- **Get Contents of URL sin red:** Apple no documenta reintentos ni cola. La guía solo trata los límites de APIs (OAuth no soportado, rate limits) ([API limitations, primaria](https://support.apple.com/guide/shortcuts/api-limitations-apd891a6c84e/ios)). Comportamiento esperado: error y fin del atajo, **no verificado**. En foros se menciona un timeout de unos 25 s, pero no encontré una fuente concreta y lo dejo como **no verificado** (se mide en T8).
- **Control de flujo disponible (primaria):**
  - *If / Otherwise If / Otherwise* con condiciones como "contains" sobre texto y "If Result" ([Use If actions](https://support.apple.com/guide/shortcuts/use-if-actions-apd83dcd1b51/ios)).
  - *Stop Shortcut* y *Stop and Output* ("Stop actions are similar to a return or break statement in Swift") ([Shortcut completion](https://support.apple.com/guide/shortcuts/shortcut-completion-apda9578f70f/ios)).
  - No hay try/catch documentado. Si la acción de red lanza un error, lo más probable es que el atajo termine antes de llegar al If (no verificado).
- **Almacenamiento persistente nativo (iOS 27, primaria):** "New storage actions allow you to preserve data each time you run a shortcut… Get Stored Content, Store Content, Delete Stored Content, Add Item to List" ([New in iOS 27](https://support.apple.com/en-us/149045)). WWDC26-310: los valores pueden ser locales a un atajo o globales y compartidos entre atajos; "its stored values sync across my devices" ([WWDC26-310](https://developer.apple.com/videos/play/wwdc2026/310/)).
  - **Riesgo:** la sincronización iCloud puede causar conflictos si dos dispositivos escriben a la vez. Conviene que solo el iPhone escriba en el buffer.
- **Alternativas al Storage nativo:**
  - Archivo de texto en iCloud Drive / On My iPhone con acciones de archivos (nombres exactos como "Append to Text File": no verificados en la guía).
  - **Data Jar**, app gratuita de terceros: "Data Store for Shortcuts", guarda JSON localmente y sincroniza por iCloud ([datajar.app, secundaria](https://datajar.app)).
- **Disparadores para vaciar el buffer (todos documentados y en la lista de auto-run):**
  - Wi‑Fi ("Any Network") ([Setting triggers](https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios)).
  - Charger "Is Connected".
  - Time of Day (diario o varias veces al día) ([Event triggers](https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios)).
  - App "Is Opened" (por ejemplo, al abrir Yape u otra app de uso frecuente).
  - Ojo: no hay disparador "volvió la conexión de datos móviles". Wi‑Fi solo cubre la conexión a una red Wi‑Fi.

**Diseño propuesto (write-ahead log):**
1. **Automatización A (Notification: Yape).** Arma `{id, ts, app, title, subtitle, body}`, donde `id` es un hash de ts+body o un UUID. Primero lo **añade al buffer** (*Get Stored Content "pending"* → *Add Item to List* → *Store Content "pending"*). Después llama al atajo **Flush**.
2. **Atajo Flush.** Lee `pending`. Si está vacío, hace *Stop Shortcut*. Si no, envía **todo el lote** en un solo POST JSON al Worker o a Apps Script. Solo si la respuesta contiene `"ok":true` (If), borra el buffer o guarda la lista sin los ids confirmados. Si el POST falla, el atajo termina y los eventos siguen guardados.
3. **Automatizaciones B (Wi‑Fi any / Charger connected / Time of Day cada 3 h / App opened)** que solo ejecutan Flush.
4. **Servidor idempotente:** el Worker o Apps Script descarta los `id` que ya existen. Esto cubre reenvíos tras timeouts ambiguos.

### 6. Alternativas totalmente en segundo plano

> **Decisión (2026-10-04):** Wallet Transaction queda **fuera de alcance por ahora**. Las compras con tarjeta BCP ya llegan por correo (consumo con Tarjeta de Débito) y se capturan vía Gmail + Apps Script. Se conserva el hallazgo abajo solo como referencia.

- **Wallet Transaction:**
  - El disparador es "When I tap: Select a card to trigger an automation whenever it's tapped" ([primaria](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)) y está en la lista de auto-run ([primaria](https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios)).
  - Los datos (secundaria): card or pass, merchant y amount vía "Receive Transaction As Input". Funciona con pases Payment, Transit, Access e Identity, y se puede filtrar por categoría y comercio ([Matthew Cassinelli, secundaria](https://matthewcassinelli.com/shortcuts-automations-ios-ipados-transaction-display-stage-manager/)). Según guías de usuarios, el monto llega como texto y solo funciona con pagos NFC, no web ([búsqueda; p. ej. Graham Haley, secundaria](https://grahamhaley.co.uk/2024/11/19/apple-pay-automation/)).
  - **Apple Pay en Perú:** Perú figura entre los países soportados ([Apple 102775, primaria](https://support.apple.com/en-us/102775)). Bancos participantes: AstroPay, Banco BBVA, Banco de Crédito del Perú, Interbank, Bybit, Financiera Efectiva, iO, Lemon, Maximo, PicPay, Rappi Bank Peru, Scotiabank Peru, Sociiz ([Apple 109524, primaria](https://support.apple.com/en-us/109524)).
  - **No captura yapeos**, porque Yape no es un toque con una tarjeta de Wallet. Es útil para que Luca registre las compras con tarjeta.
- **Email trigger:**
  - Filtros: Sender, Subject Contains, Account, Recipient ([primaria](https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios)). Está en la lista de auto-run.
  - Funciona con cuentas configuradas en **Apple Mail**, no con la app de Gmail (secundaria: [Apple Community](https://discussions.apple.com/thread/253159089)).
  - Que el cuerpo del correo llegue al atajo es **dudoso**. Un usuario dice que solo actúa como disparador ([Automators Talk, secundaria](https://talk.automators.fm/t/automating-e-mail-content/16537)). Otro, que bloqueado solo obtenía el asunto ([Automators Talk 2024, secundaria](https://talk.automators.fm/t/how-run-file-actions-while-phone-is-locked/17646)).
  - **Para Luca es mejor procesar los correos en el servidor** (Gmail + Apps Script con trigger de tiempo) que en el teléfono.
- **Correos de Yape (primaria):** Yape envía correos automáticos al usar otros servicios (compras, recargas, pagos de servicios) y al yapear fuera de Yape. Para yapeos a Yape con BCP y Yape con DNI el correo depende del "monto mínimo que elijas": "S/ 10, S/ 50, S/ 100 y S/ 500" (Ajustes → "Notificaciones por yapeo") ([Yape, primaria](https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/como-recibo-un-correo-de-aviso-cada-vez-que-envie-un-yapeo)). Esto confirma el umbral de S/10 del discovery.
- **Message trigger (SMS del banco):** filtros Sender y Message Contains, y está en la lista de auto-run ([primaria](https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios)). Sirve si el banco manda SMS por consumo. Qué datos expone el SMS al atajo: no verificado.
- **Focus filters:** solo sirven para *on/off* de Focus como disparador ([Setting triggers](https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios)). No exponen contenido de notificaciones, así que no son útiles aquí.

### 7. Comparación con Android

- **NotificationListenerService (primaria, [Android Developers](https://developer.android.com/reference/android/service/notification/NotificationListenerService)):**
  - Es "A service that receives calls from the system when new notifications are posted or removed". Se declara con el permiso `BIND_NOTIFICATION_LISTENER_SERVICE` y un intent-filter `android.service.notification.NotificationListenerService`.
  - "Notification listeners cannot get notification access or be bound by the system on low-RAM devices running Android Q (and below)".
  - Se ignoran los listeners en perfiles de trabajo.
- **Datos que expone (primaria, [Notification](https://developer.android.com/reference/android/app/Notification)):** `EXTRA_TITLE` ("android.title"), `EXTRA_TEXT` ("android.text", "the main text payload"), `EXTRA_BIG_TEXT`, `EXTRA_SUB_TEXT`, además del paquete de origen y el `postTime` del `StatusBarNotification`.
- **Permiso:** el usuario lo concede a mano en Ajustes. La app puede abrir la pantalla con `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS` ("In some cases, a matching Activity may not exist") ([Settings, primaria](https://developer.android.com/reference/android/provider/Settings)).
- **Doze (primaria, [Doze/App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)):**
  - En Doze el sistema "Suspends network access", ignora wake locks y difiere JobScheduler/WorkManager hasta las ventanas de mantenimiento.
  - Las apps de "Task automation" son un caso aceptable para la exención de optimización de batería.
  - Implicación: el listener puede recibir el evento, pero el POST puede quedar diferido. También en Android hace falta un buffer local con envío diferido (o la exención de batería).
- **Android 15, redacción de OTP (primaria, [Behavior changes: all apps, Android 15](https://developer.android.com/about/versions/15/behavior-changes-all)):** "Android will stop untrusted apps that implement a NotificationListenerService from reading unredacted content from notifications where an OTP has been detected". Las asociaciones de companion device están exentas. El permiso `RECEIVE_SENSITIVE_NOTIFICATIONS` "Allows apps with a NotificationListenerService to receive notifications with sensitive information" ([Manifest.permission, primaria](https://developer.android.com/reference/android/Manifest.permission)). Según secundarias, su nivel de protección es signature|role y no está al alcance de apps normales ([Android Police, secundaria](https://www.androidpolice.com/android-16-subtle-change-keeps-otps-safe/)).
  - Para Yape solo afectaría si el clasificador de OTP marca una notificación de pago (poco probable, no verificado).
- **Android 16 y 17:** no encontré cambios específicos del listener en las páginas de cambios de comportamiento. Android 17 amplía la protección OTP a **SMS**, con un retraso de 3 h para la mayoría de apps que apunten a API 37 ([Android 17 behavior changes, primaria](https://developer.android.com/about/versions/17/behavior-changes-17)). Esto afectaría la captura de SMS bancarios con OTP, no las notificaciones de Yape.
- **Apps existentes (secundaria):**
  - MacroDroid tiene un trigger *Notification* (filtra título, texto, subtexto y big text, con variables `{not_title}`, `{notification}`) y una acción *HTTP Request* con cuerpo JSON. Su wiki advierte del bloqueo de OTP en Android 15 ([MacroDroid Wiki – Trigger: Notification](https://wiki.macrodroid.com/wiki/index.php/Trigger:_Notification); [HTTP Request](https://wiki.macrodroid.com/wiki/index.php?title=Action%3A_HTTP_Request)).
  - Tasker con el plugin AutoNotification (*Intercept*, variables `%antitle`, `%antext`) ([Google Play](https://play.google.com/store/apps/details?id=com.joaomgcd.autonotification)).
- **Conclusión Android:** la captura en segundo plano de título y texto de las notificaciones de Yape está **documentada y madura**. Solo requiere un permiso del usuario. Las únicas salvedades son Doze, que se resuelve con buffer, y la redacción de OTP.

---

## Arquitectura recomendada para Luca (ranking)

1. **iOS 27: Notification trigger (Yape) + buffer Storage + Flush** (candidata principal, pendiente de pruebas).
   - Automatización A (Yape) → buffer → Flush → Cloudflare Worker (idempotente por `id`) → Google Sheets API, o Apps Script `doPost`.
   - Flush también por Wi‑Fi, cargador, hora y apertura de app.
   - Requisitos: iOS 27, *Allow Running When Locked*, Show Previews de Yape en "Always" mientras se valida.
   - Riesgos: auto-run no confirmado oficialmente para Notification; campos de salida no documentados; Yape podría no notificar los envíos.
2. **Gmail + Apps Script (servidor)** para todo lo que Yape manda por correo: yapeos enviados ≥ S/10 (umbral configurable), pagos de servicios, recargas y yapeos fuera de Yape ([Yape](https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/como-recibo-un-correo-de-aviso-cada-vez-que-envie-un-yapeo)). No depende del teléfono. Es el respaldo y la fuente de reconciliación: si el mismo yapeo llega por push y por correo, se deduplica por monto, contraparte y ventana de tiempo.
3. **Android: listener propio, MacroDroid o Tasker** para usuarios con Android. Es la vía técnicamente más sólida. Hace falta buffer por Doze.
4. **Captura manual rápida** (Back Tap / Action button / widget / Siri). Un atajo pide monto y contraparte, u OCR de una captura con Extract Text, y lo encola en el mismo buffer. Es la red de seguridad para los yapeos enviados < S/10 si Yape no manda push de envíos.

**Contrato del payload (sugerido):** `{"id": "...", "source": "yape", "channel": "ios-notification|email|manual|android", "ts_device": "ISO-8601", "title": "...", "subtitle": "...", "body": "...", "raw": "..."}`. El parsing va en el servidor, como sugería el discovery.

---

## Preguntas abiertas y plan de pruebas en el dispositivo

Dispositivo: iPhone con **iOS 27.0.1**, Yape instalado, Show Previews de Yape = Always (Settings → Apps → Yape → Notifications). Endpoint de prueba que registre cada request, por ejemplo un Worker que loguea y responde `{"ok":true}`.

| # | Pregunta | Pasos | Resultado esperado / qué registrar |
|---|---|---|---|
| T1 | ¿Qué campos entrega el disparador Notification? | Crear un atajo con el disparador Notification (App = Yape, sin filtros) y la acción "Get Contents of URL" POST con `Shortcut Input` completo y cada propiedad disponible (title, subtitle, body, date, app). Pedir a otra persona un yapeo de S/1. | Lista exacta de propiedades en el selector de variables y el JSON recibido. |
| T2 | ¿Corre sin confirmación? | En el atajo: Info → Privacy → *Allow Running When Locked* ON. Buscar también "Run Immediately" o "Notify When Run". | ¿Aparece la opción para el disparador Notification? ¿Llega el POST sin tocar nada? |
| T3 | Desbloqueado y pantalla encendida | Con Yape cerrado y otra app en primer plano, recibir S/1. | POST recibido, latencia (ts del servidor − ts de la notificación), si se abrió Atajos. |
| T4 | Bloqueado tras el primer desbloqueo | Bloquear, esperar más de 1 min (y otra vez más de 30 min), recibir S/1. | ¿POST? ¿Aparece "will run once your iPhone is unlocked"? ¿El body viene completo o vacío/redactado? Repetir con Show Previews = When Unlocked. |
| T5 | Antes del primer desbloqueo | Reiniciar sin desbloquear y recibir S/1. Luego desbloquear. | ¿Se ejecuta al desbloquear o se pierde el evento? |
| T6 | ¿Yape notifica los envíos? | Yapear S/1 a un contacto y también S/12. | ¿Hay push local o remota de "Yapeaste…"? ¿Se dispara la automatización? ¿Llega el correo de S/12 con umbral S/10? |
| T7 | Filtros | Añadir el filtro Message contains "S/". | ¿Funciona en la versión final (estaba roto en la beta 1)? |
| T8 | Offline | Modo avión con Wi‑Fi apagado; recibir el yapeo al reconectar o usar una notificación de prueba. Con el atajo de buffer: forzar el POST sin red. | ¿Get Contents of URL da error y detiene el atajo? ¿Cuánto tarda? ¿El item quedó en Storage? |
| T9 | Flush | Reconectar a Wi‑Fi y conectar el cargador. | ¿Se disparan Wi‑Fi/Charger sin confirmación y bloqueado? ¿El lote llega y se vacía el buffer? |
| T10 | Storage bloqueado | Con el teléfono bloqueado, que la automatización escriba en Storage. | ¿Escribe o falla por Data Protection? |
| T11 | Ráfagas | Recibir 3 yapeos en menos de 30 s. | ¿Se ejecutan las 3 automatizaciones? ¿Hay escrituras concurrentes que pisen el buffer? (De ahí el valor de la deduplicación y de un `id` por evento.) |
| T12 | Atajo manual con Back Tap | Back Tap → Take Screenshot → Extract Text from Image → encolar. Probar en modo avión. | ¿OCR offline? ¿Calidad del texto con "S/"? |
| T14 | Email trigger | Cuenta Gmail en Apple Mail, disparador Email Sender = correo de Yape. | ¿Se expone el cuerpo? (Solo informativo; la vía recomendada es servidor.) |

---

## Fuentes (consultadas el 2026-10-04)

**Primarias**
- Apple – Apple security releases (última versión iOS 27.0.1): https://support.apple.com/en-us/100100
- Apple – iOS 27: https://www.apple.com/os/ios/
- Apple – New in iOS, iPadOS, macOS, watchOS, and visionOS 27: https://support.apple.com/en-us/149045
- Apple Shortcuts User Guide (iOS 27):
  - Intro to automation shortcuts: https://support.apple.com/guide/shortcuts/intro-to-personal-automation-apd690170742/ios
  - Add automations (Allow Running When Locked, lista auto-run): https://support.apple.com/guide/shortcuts/create-a-new-personal-automation-apdfbdbd7123/ios
  - Event triggers (Notification, Screenshot, Keyboard): https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios
  - Travel triggers: https://support.apple.com/guide/shortcuts/travel-triggers-apd8ebfc4e8e/ios
  - Communication triggers: https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios
  - Transaction trigger: https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios
  - Setting triggers: https://support.apple.com/guide/shortcuts/setting-triggers-apde31e9638b/ios
  - Adjust privacy settings: https://support.apple.com/guide/shortcuts/adjust-privacy-settings-apd961a4fc65/ios
  - Shortcut completion (Stop and Output): https://support.apple.com/guide/shortcuts/shortcut-completion-apda9578f70f/ios
  - Use If actions: https://support.apple.com/guide/shortcuts/use-if-actions-apd83dcd1b51/ios
  - API limitations: https://support.apple.com/guide/shortcuts/api-limitations-apd891a6c84e/ios
  - Back Tap: https://support.apple.com/guide/shortcuts/run-shortcuts-tapping-iphone-apd897693606/ios
  - Action button: https://support.apple.com/guide/shortcuts/run-shortcuts-with-the-action-button-apdfea15680b/ios
- Apple Shortcuts User Guide (iOS 26, para comparar):
  - Event triggers: https://support.apple.com/guide/shortcuts/apd932ff833f/9.0/ios/26
  - Enable or disable a personal automation: https://support.apple.com/guide/shortcuts/apd602971e63/9.0/ios/26
- WWDC26 – What's new in Shortcuts (sesión 310): https://developer.apple.com/videos/play/wwdc2026/310/
- Apple Developer – UNUserNotificationCenter: https://developer.apple.com/documentation/usernotifications/unusernotificationcenter
- Apple Developer – getDeliveredNotifications: https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/getdeliverednotifications(completionhandler:)
- Apple Developer – UNNotificationServiceExtension: https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension
- Apple Developer – FileProtectionType.completeUntilFirstUserAuthentication: https://developer.apple.com/documentation/foundation/fileprotectiontype/completeuntilfirstuserauthentication
- Apple Developer – Recognizing text in images (Vision, on-device): https://developer.apple.com/documentation/vision/recognizing-text-in-images
- Apple Platform Security – Data Protection classes: https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web
- Apple iPhone User Guide – Summarize notifications (Apple Intelligence): https://support.apple.com/guide/iphone/summarize-notifications-reduce-interruptions-iph1fbe7d2b9/ios
- Apple iPhone User Guide – Lock Screen / Show Previews: https://support.apple.com/guide/iphone/access-features-from-the-lock-screen-iphcd5c65ccf/ios
- Apple – Use notifications on your iPhone or iPad: https://support.apple.com/en-us/108781
- Apple – Countries and regions that support Apple Pay: https://support.apple.com/en-us/102775
- Apple – Apple Pay participating banks in Latin America: https://support.apple.com/en-us/109524
- Yape – ¿Cómo recibo un correo de aviso cada vez que envíe un yapeo?: https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/como-recibo-un-correo-de-aviso-cada-vez-que-envie-un-yapeo
- Yape – ¿Cómo activo o desactivo las notificaciones de sonido de Yape?: https://www.yape.com.pe/preguntas-frecuentes/sobre-tu-cuenta-yape/por-que-no-escucho-el-sonido-yape-cuando-me-yapean
- Android Developers – NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Android Developers – Notification (extras): https://developer.android.com/reference/android/app/Notification
- Android Developers – Settings (ACTION_NOTIFICATION_LISTENER_SETTINGS): https://developer.android.com/reference/android/provider/Settings
- Android Developers – Manifest.permission (RECEIVE_SENSITIVE_NOTIFICATIONS): https://developer.android.com/reference/android/Manifest.permission
- Android Developers – Doze and App Standby: https://developer.android.com/training/monitoring-device-state/doze-standby
- Android Developers – Android 15 behavior changes (all apps): https://developer.android.com/about/versions/15/behavior-changes-all
- Android Developers – Android 17 behavior changes (apps targeting 17): https://developer.android.com/about/versions/17/behavior-changes-17

**Secundarias (pistas / comportamiento reportado)**
- MacStories – iOS and iPadOS 27 review (Shortcuts): https://www.macstories.net/stories/ios-and-ipados-27-review/13/
- 9to5Mac – iOS 27 Shortcuts new actions: https://9to5mac.com/2026/09/29/ios-27s-shortcuts-app-adds-35-new-improved-actions-heres-whats-new/
- MacRumors – iOS 27 Shortcuts guide: https://www.macrumors.com/guide/ios-27-shortcuts/
- Derek Seaman – Home Assistant notifications that run Apple Shortcuts (beta 1): https://www.derekseaman.com/2026/06/home-assistant-notifications-that-run-apple-shortcuts-yes-really.html
- Beard.fm – iOS 27 notification triggers: https://wiki.beard.fm/whats-new-ios-27/how-to-use-ios-27s-notification-triggers-for-advanced-cross-
- WalletPal – Notification trigger guide: https://walletpalapp.github.io/apple-shortcuts-notification-trigger.html
- Matthew Cassinelli – iOS 27 automation filters: https://matthewcassinelli.com/ios-27-turn-automations-off-on-filters-shortcuts/
- Matthew Cassinelli – iOS 17 Transaction automation: https://matthewcassinelli.com/shortcuts-automations-ios-ipados-transaction-display-stage-manager/
- Graham Haley – Apple Pay automation: https://grahamhaley.co.uk/2024/11/19/apple-pay-automation/
- iDownloadBlog – Run Immediately / Notify When Run: https://www.idownloadblog.com/2022/02/01/run-shortcuts-automations-without-notifications-tutorial/
- Automators Talk – shortcuts bloqueado (2025): https://talk.automators.fm/t/why-do-some-time-triggered-shortcuts-run-on-a-locked-iphone-and-others-fail/18608
- Automators Talk – file actions bloqueado (2024): https://talk.automators.fm/t/how-run-file-actions-while-phone-is-locked/17646
- Automators Talk – email content: https://talk.automators.fm/t/automating-e-mail-content/16537
- Apple Developer Forums – Time of Day + Get Contents of URL: https://developer.apple.com/forums/thread/665845
- Apple Community – "will run once your iPhone is unlocked": https://discussions.apple.com/thread/254478980
- Apple Community – email trigger: https://discussions.apple.com/thread/253159089
- Data Jar: https://datajar.app
- Android Police – OTP / RECEIVE_SENSITIVE_NOTIFICATIONS: https://www.androidpolice.com/android-16-subtle-change-keeps-otps-safe/
- MacroDroid Wiki – Trigger: Notification: https://wiki.macrodroid.com/wiki/index.php/Trigger:_Notification
- MacroDroid Wiki – Action: HTTP Request: https://wiki.macrodroid.com/wiki/index.php?title=Action%3A_HTTP_Request
- AutoNotification (Google Play): https://play.google.com/store/apps/details?id=com.joaomgcd.autonotification
