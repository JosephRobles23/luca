/**
 * secrets-runtime.js — Secretos por USUARIO en PropertiesService.getUserProperties().
 *
 * Decisión de diseño (ver docs/discovery/reuso-cos-agent.md §3): nada de Script Properties de la
 * librería como almacén multi-tenant. Cada copia/usuario guarda lo suyo en su propio espacio.
 *
 * Sin import/export: runtime de Apps Script.
 */

var SECRET_KEYS_ = {
  llmKey: 'luca.llm.apiKey',
  mcpSecret: 'luca.mcp.secret',
  tenantId: 'luca.mcp.tenantId',
  workerUrl: 'luca.worker.url',
  // Token del atajo del iPhone (ADR-003): lo genera conectarIphone y lo valida eventsAction_.
  deviceToken: 'luca.iphone.deviceToken'
};

function userProps_() { return PropertiesService.getUserProperties(); }

function getSecret_(name) {
  var k = SECRET_KEYS_[name];
  if (!k) throw new Error('Secreto desconocido: ' + name);
  return userProps_().getProperty(k) || '';
}

function setSecret_(name, value) {
  var k = SECRET_KEYS_[name];
  if (!k) throw new Error('Secreto desconocido: ' + name);
  if (value == null || value === '') userProps_().deleteProperty(k);
  else userProps_().setProperty(k, String(value));
}

/** Estado para la UI: qué hay configurado, sin revelar valores. */
function estadoSecretos_() {
  return {
    llmKey: !!getSecret_('llmKey'),
    mcp: !!getSecret_('tenantId'),
    iphone: !!getSecret_('deviceToken'),
    workerUrl: getSecret_('workerUrl') || ''
  };
}

/** Guarda la API key del LLM pegada a mano en el sidebar (alternativa al pairing). */
function guardarLlmKey(sheetId, config, apiKey) {
  var k = String(apiKey || '').trim();
  if (k.length < 20) throw new Error('La API key parece incompleta.');
  setSecret_('llmKey', k);
  // Flag NO sensible para que la web muestre "configurada" sin ver la key.
  setAjustes_(sheetId, config, { 'llm.apiKey.configured': '1' });
  return estadoSecretos_();
}

// --- iPhone (ADR-003) ---

var SHORTCUT_URL_ = 'https://www.icloud.com/shortcuts/PENDIENTE';

/**
 * conectarIphone: genera el deviceToken si no existe (si ya hay uno lo devuelve, para volver a verlo)
 * y entrega { execUrl, token, shortcutUrl }. El token vive solo en UserProperties del usuario.
 */
function conectarIphone(sheetId, config) {
  if (!getSecret_('deviceToken')) setSecret_('deviceToken', Utilities.getUuid());
  // conexiones.iphone.execUrl = URL con la que se importó el atajo (la web avisa si el /exec cambia).
  setAjustes_(sheetId, config, { 'conexiones.execUrl': execUrl_(config), 'conexiones.iphone.execUrl': execUrl_(config) });
  return datosIphoneFor_(sheetId, config);
}

/** regenerarTokenIphone: invalida el token anterior (hay que reimportar/editar el atajo). */
function regenerarTokenIphone(sheetId, config) {
  setSecret_('deviceToken', Utilities.getUuid());
  setAjustes_(sheetId, config, { 'conexiones.iphone.lastError': '', 'conexiones.execUrl': execUrl_(config), 'conexiones.iphone.execUrl': execUrl_(config) });
  return datosIphoneFor_(sheetId, config);
}

/** desconectarIphone: borra el token y limpia la telemetría del dispositivo. */
function desconectarIphone(sheetId, config) {
  setSecret_('deviceToken', '');
  setAjustes_(sheetId, config, {
    'conexiones.iphone.device': '', 'conexiones.iphone.lastEventAt': '', 'conexiones.iphone.eventsCount': '0',
    'conexiones.iphone.lastError': '', 'conexiones.iphone.lastTestAt': '', 'conexiones.iphone.schemaVersion': '', 'conexiones.iphone.execUrl': ''
  });
  return datosIphoneFor_(sheetId, config);
}

/** Datos que el usuario pega en el atajo. Sin despliegue del Web App, `execUrl` viene vacía. */
function datosIphoneFor_(sheetId, config) {
  var token = getSecret_('deviceToken');
  return { execUrl: execUrl_(config), token: token, shortcutUrl: SHORTCUT_URL_, conectado: !!token };
}
