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
    execUrl: url, eventsUrl: eventsUrl_(url), token: token, conectado: !!token
  };
}

/**
 * generarPromptIphone: prompt listo para pegar en el generador de Atajos de iOS 27, con la URL de eventos
 * y el token ya puestos (no hace preguntas al importarse). Requiere el Web App desplegado.
 */
function generarPromptIphone(sheetId, config) {
  var res = resolverExecUrl_(sheetId, config);
  // Nunca generar un atajo con una URL que no responde (2026-10-05: se generó con una implementación rota).
  if (!res.verified && !res.candidatas.length) throw new Error('Despliega primero el Web App (Implementar → Nueva implementación → ⚙️ Aplicación web → ejecutar como yo, acceso: cualquiera) para obtener la URL /exec.');
  if (!res.verified) {
    throw new Error('Ninguna URL de tu aplicación web responde como Luca (' + res.candidatas.map(function (c) { return '…' + c.url.slice(-14); }).join(', ') +
      '). Pega la URL correcta en "URL de tu aplicación web" → "Verificar y guardar URL" y vuelve a copiar el prompt.');
  }
  var d = conectarIphone(sheetId, config);
  if (!d.execUrl) throw new Error('Despliega primero el Web App (Implementar → Aplicación web → ejecutar como yo, acceso: cualquiera) para obtener la URL /exec.');
  return { prompt: promptIphone_(d.execUrl, d.token), execUrl: d.execUrl, token: d.token, eventsUrl: d.eventsUrl };
}

/**
 * Texto del prompt (única plantilla). La web lo replica desde docs/guides/prompt-atajo-ios27-yape.md
 * ("Prompt 1 (generado por Luca)"), que debe ser exactamente promptIphone_('<EXEC_URL>', '<TOKEN>').
 */
function promptIphone_(execUrl, token) {
  // Un solo atajo (el generador de Atajos de iOS crea uno por prompt): si lo dispara una notificación
  // envía el yapeo; si se ejecuta a mano (sin entrada), envía una prueba y muestra la respuesta.
  var url = eventsUrl_(execUrl);
  return [
    'Crea UN solo atajo llamado "Luca – Captura Yape". Se usará de dos formas: como automatización',
    'personal cuando llega una notificación de la app Yape (sin pedir confirmación, sin abrirse y sin',
    'mostrar nada), y también ejecutándolo a mano desde la app Atajos para probar la conexión.',
    '',
    'Usa estos dos valores fijos (ya son los míos, no preguntes nada al importar):',
    '- URL de Luca: ' + url,
    '- Token de mi iPhone: ' + token,
    '',
    'Pasos exactos, en este orden:',
    '',
    '1. Guarda la fecha y hora actual en "ahora" formateada como ISO 8601 con hora y zona horaria',
    '   (ejemplo 2026-10-05T12:34:56-05:00), nunca solo la fecha. Obtén el nombre del dispositivo en',
    '   "dispositivo". Genera "eventId" concatenando "ahora", un guion y un número aleatorio entre 100000',
    '   y 999999.',
    '',
    '2. Si la entrada del atajo está VACÍA (lo ejecuté a mano, modo prueba):',
    '   a. Construye un Diccionario con "schema_version": "1", "id": "test-" + eventId, "source": "test",',
    '      "token": "' + token + '", "device": dispositivo, "received_at": ahora.',
    '   b. Haz una petición HTTP POST a la URL de Luca (' + url + ') con tipo de cuerpo JSON, enviando ese',
    '      Diccionario y siguiendo redirecciones.',
    '   c. Muestra el texto de la respuesta en una alerta y termina el atajo.',
    '',
    '3. Si la entrada NO está vacía (la disparó una notificación de Yape), guarda en variables: "titulo"',
    '   (título), "subtitulo" (subtítulo, puede estar vacío), "cuerpo" (texto o mensaje), "fechaNotif"',
    '   (fecha de la notificación) y "raw" (la entrada completa convertida a texto).',
    '',
    '4. Construye un Diccionario:',
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
    '5. Haz una petición HTTP a la URL de Luca (' + url + ') con método POST, tipo de cuerpo JSON,',
    '   enviando el Diccionario del paso 4. Debe seguir redirecciones. Guarda la respuesta en "respuesta".',
    '',
    '6. Si "respuesta" contiene el texto "\\"ok\\":true", termina sin mostrar nada. En cualquier otro caso',
    '   (error de red, respuesta vacía o sin "ok":true), añade el Diccionario del paso 4 a la lista',
    '   persistente "luca_pendientes" del almacenamiento de Atajos (acción "Añadir elemento a la lista").'
  ].join('\n');
}
