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
  // Token del atajo del iPhone de copias anteriores a v14. Hoy vive en Ajustes (iphone-runtime.js);
  // conectarIphone lo migra y eventsAction_ lo acepta como respaldo.
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

/** Estado para la UI: qué hay configurado, sin revelar valores. `config` (opcional) aporta el token del iPhone en Ajustes. */
function estadoSecretos_(config) {
  var a = (config && config.ajustes) || {};
  return {
    llmKey: !!getSecret_('llmKey'),
    mcp: !!getSecret_('tenantId'),
    iphone: !!(String(a['conexiones.iphone.token'] || '').trim() || getSecret_('deviceToken')),
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
