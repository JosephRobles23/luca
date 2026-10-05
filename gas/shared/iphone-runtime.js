/**
 * iphone-runtime.js — Canal iPhone (ADR-003): token del atajo, URL de eventos y prompt para Atajos.
 *
 * Fuente de verdad del token: `Ajustes.conexiones.iphone.token` (addendum ADR-003, 2026-10-05). La web
 * solo puede leer la hoja, y el token solo permite insertar filas en esa misma hoja, así que guardarlo
 * ahí no baja la seguridad y permite que la web muestre URL + token sin pasar por el sidebar.
 * Las copias anteriores lo tenían en UserProperties (`luca.iphone.deviceToken`): conectarIphone lo
 * migra una vez y eventsAction_ sigue aceptándolo como respaldo mientras no haya token en Ajustes.
 *
 * Sin import/export: runtime de Apps Script.
 */

var SHORTCUT_URL_ = 'https://www.icloud.com/shortcuts/PENDIENTE';
var IPHONE_TOKEN_KEY_ = 'conexiones.iphone.token';

/** `<execUrl>?events=1`: la URL exacta a la que el atajo hace POST (webapp-runtime.js). */
function eventsUrl_(execUrl) {
  var u = str_(execUrl).trim();
  return u ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'events=1' : '';
}

/**
 * Token vigente. Lee la hoja (no el snapshot `config.ajustes`) porque un evento puede llegar en la misma
 * ejecución en que se generó. Respaldo: UserProperties de copias anteriores.
 */
function iphoneToken_(sheetId, config) {
  var t = str_(getAjustes_(sheetId, config)[IPHONE_TOKEN_KEY_]).trim();
  return t || getSecret_('deviceToken');
}

/** Escribe el token en Ajustes y retira la UserProperty antigua (deja de ser fuente). */
function setIphoneToken_(sheetId, config, token) {
  setAjustes_(sheetId, config, { 'conexiones.iphone.token': str_(token) });
  if (config && config.ajustes) config.ajustes[IPHONE_TOKEN_KEY_] = str_(token);
  if (getSecret_('deviceToken')) setSecret_('deviceToken', '');
}

/**
 * conectarIphone: asegura el token en Ajustes (migra el de UserProperties si existía; si no, genera uno)
 * y guarda la URL /exec con la que se generará el atajo. Volver a llamarlo no rota el token.
 */
function conectarIphone(sheetId, config) {
  var url = syncExecUrl_(sheetId, config);
  if (!str_(getAjustes_(sheetId, config)[IPHONE_TOKEN_KEY_]).trim()) {
    setIphoneToken_(sheetId, config, getSecret_('deviceToken') || Utilities.getUuid());
  }
  setAjustes_(sheetId, config, { 'conexiones.iphone.execUrl': url });
  return datosIphoneFor_(sheetId, config);
}

/** regenerarTokenIphone: invalida el token anterior (hay que regenerar/editar el atajo). */
function regenerarTokenIphone(sheetId, config) {
  var url = syncExecUrl_(sheetId, config);
  setIphoneToken_(sheetId, config, Utilities.getUuid());
  setAjustes_(sheetId, config, { 'conexiones.iphone.lastError': '', 'conexiones.iphone.execUrl': url });
  return datosIphoneFor_(sheetId, config);
}

/** desconectarIphone: borra el token (Ajustes y UserProperties) y limpia la telemetría del dispositivo. */
function desconectarIphone(sheetId, config) {
  setIphoneToken_(sheetId, config, '');
  setAjustes_(sheetId, config, {
    'conexiones.iphone.device': '', 'conexiones.iphone.lastEventAt': '', 'conexiones.iphone.eventsCount': '0',
    'conexiones.iphone.lastError': '', 'conexiones.iphone.lastTestAt': '', 'conexiones.iphone.schemaVersion': '', 'conexiones.iphone.execUrl': ''
  });
  return datosIphoneFor_(sheetId, config);
}

/** Datos que el usuario pega en el atajo. Sin despliegue del Web App, `execUrl` y `eventsUrl` vienen vacías. */
function datosIphoneFor_(sheetId, config) {
  var token = iphoneToken_(sheetId, config);
  var url = execUrl_(config);
  return {
    execUrl: url, eventsUrl: eventsUrl_(url), token: token, shortcutUrl: SHORTCUT_URL_,
    shortcutDisponible: SHORTCUT_URL_.indexOf('PENDIENTE') < 0, conectado: !!token
  };
}

/**
 * generarPromptIphone: prompt listo para pegar en el generador de Atajos de iOS 27, con la URL de eventos
 * y el token ya puestos (no hace preguntas al importarse). Requiere el Web App desplegado.
 */
function generarPromptIphone(sheetId, config) {
  var d = conectarIphone(sheetId, config);
  if (!d.execUrl) throw new Error('Despliega primero el Web App (Implementar → Aplicación web → ejecutar como yo, acceso: cualquiera) para obtener la URL /exec.');
  return { prompt: promptIphone_(d.execUrl, d.token), execUrl: d.execUrl, token: d.token, shortcutUrl: d.shortcutUrl, eventsUrl: d.eventsUrl };
}

/**
 * Texto del prompt (única plantilla). La web lo replica desde docs/guides/prompt-atajo-ios27-yape.md
 * ("Prompt 1 (generado por Luca)"), que debe ser exactamente promptIphone_('<EXEC_URL>', '<TOKEN>').
 */
function promptIphone_(execUrl, token) {
  var url = eventsUrl_(execUrl);
  return [
    'Crea un atajo llamado "Luca – Captura Yape" pensado para ejecutarse como automatización personal',
    'cuando llega una notificación de la app Yape. Debe correr sin pedir confirmación, sin abrirse en',
    'pantalla y sin mostrar alertas ni notificaciones propias.',
    '',
    'Usa estos dos valores fijos (ya son los míos, no preguntes nada al importar):',
    '- URL de Luca: ' + url,
    '- Token de mi iPhone: ' + token,
    '',
    'Pasos exactos, en este orden:',
    '',
    '1. Toma la entrada del atajo (la notificación) y guarda en variables: "titulo" (título), "subtitulo"',
    '   (subtítulo, puede estar vacío), "cuerpo" (texto o mensaje), "fechaNotif" (fecha de la notificación)',
    '   y "raw" (la entrada completa convertida a texto).',
    '',
    '2. Guarda la fecha y hora actual en "ahora" formateada como ISO 8601 con hora y zona horaria',
    '   (ejemplo 2026-10-05T12:34:56-05:00), nunca solo la fecha.',
    '',
    '3. Genera "eventId" concatenando "ahora", un guion y un número aleatorio entre 100000 y 999999.',
    '',
    '4. Obtén el nombre del dispositivo en "dispositivo".',
    '',
    '5. Construye un Diccionario:',
    '   - "schema_version": "1"',
    '   - "id": eventId',
    '   - "source": "yape"',
    '   - "channel": "ios-notification"',
    '   - "token": "' + token + '"',
    '   - "title": titulo',
    '   - "subtitle": subtitulo',
    '   - "body": cuerpo',
    '   - "raw": raw',
    '   - "notified_at": fechaNotif',
    '   - "received_at": ahora',
    '   - "device": dispositivo',
    '',
    '6. Haz una petición HTTP a la URL de Luca (' + url + ') con método POST, tipo de cuerpo JSON,',
    '   enviando el Diccionario del paso 5. Debe seguir redirecciones. Guarda la respuesta en "respuesta".',
    '',
    '7. Si "respuesta" contiene el texto "\\"ok\\":true", termina. En cualquier otro caso (error de red,',
    '   respuesta vacía o sin "ok":true), añade el Diccionario del paso 5 a la lista persistente',
    '   "luca_pendientes" del almacenamiento de Atajos (acción "Añadir elemento a la lista").',
    '',
    '8. Incluye además un segundo atajo pequeño llamado "Luca – Probar iPhone" que envíe a la misma URL de',
    '   Luca un Diccionario con "schema_version": "1", "id": "test-" + ahora, "source": "test", "token":',
    '   "' + token + '", "device": dispositivo, y muestre el texto de la respuesta en pantalla. Sirve para',
    '   verificar la conexión sin esperar un yapeo: el sidebar de Luca mostrará "Última prueba".'
  ].join('\n');
}
