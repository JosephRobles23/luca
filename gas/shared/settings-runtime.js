/**
 * settings-runtime.js — Pestaña `Ajustes` (key/value) + CONFIG = estático (stub) ⊕ editable (hoja).
 * Primitivas KV copiadas de CoS-Agent (settings-runtime.js:153-215). Defaults propios de Luca.
 *
 * Secretos (API key del LLM, secreto MCP) NO van aquí: van a PropertiesService.getUserProperties()
 * del usuario (ver secrets-runtime.js). Ajustes solo guarda configuración no sensible.
 *
 * Sin import/export: runtime de Apps Script.
 */

/**
 * Versión de LucaLib que se escribe en `Ajustes.luca.version` en cada pasada (ADR-006 §5): la web y el
 * sidebar comparan con la última publicada para avisar "hay una versión nueva". Subirla en cada release.
 */
var LUCA_VERSION = '3';
// Versión mínima del stub que esta librería necesita (stub v2 = pasa setupTriggers y execUrl/stubVersion).
var STUB_MIN_VERSION_ = '2';

/**
 * Sheets plantilla oficiales ("Luca Template"): cada usuario recibe una COPIA y todo lo que la plantilla
 * contenga viaja en ella (pestañas y Ajustes, incluido el token del iPhone). Por eso Luca nunca escribe
 * datos ahí: sin triggers, sin escaneo de Gmail, sin eventos del iPhone ni del MCP (ADR-010). Cada copia
 * tiene otro ID, así que esto no afecta a nadie más. Debe coincidir con NEXT_PUBLIC_TEMPLATE_SHEET_ID.
 */
var PLANTILLAS_OFICIALES_ = { '1kQWNaj9J29LRK-LsdCAxrplW06heaTvS3Hje3NV1htg': true };
var PLANTILLA_MSG_ = 'Esta es la plantilla oficial de Luca: aquí no se escanea Gmail ni se guardan movimientos, ' +
  'porque todo lo que tenga se copiaría a cada usuario nuevo. Crea tu propia copia desde https://lucaa.lat';

function esPlantillaOficial_(sheetId) {
  return Object.prototype.hasOwnProperty.call(PLANTILLAS_OFICIALES_, String(sheetId || ''));
}
function assertNoPlantilla_(sheetId) {
  if (esPlantillaOficial_(sheetId)) throw new Error(PLANTILLA_MSG_);
}

/** '' si el stub está al día; mensaje si hay que actualizar los archivos del stub en la copia. */
function stubUpdateMessage_(config) {
  var v = parseInt((config && config.stubVersion) || '1', 10) || 1;
  if (v >= parseInt(STUB_MIN_VERSION_, 10)) return '';
  return 'Tu script necesita actualizarse (stub v' + v + ' < v' + STUB_MIN_VERSION_ + '): haz una copia nueva de la plantilla o reemplaza los archivos del stub (Extensiones → Apps Script).';
}

var AJUSTES_DEFAULTS_ = {
  // Fuentes de correo (remitentes transaccionales). Separados por coma.
  'gmail.senders': 'notificaciones@notificacionesbcp.com.pe,notificaciones@yape.pe',
  // Cursor incremental del escaneo (epoch segundos). Vacío = nunca escaneado.
  'gmail.cursor': '',
  // Tamaño de lote por pasada del trigger (límite de 6 min por ejecución).
  'gmail.batch': '40',
  // Importación histórica: epoch segundos desde donde importar; vacío = sin job activo.
  'import.since': '',
  'import.status': '',
  // Moneda base del dashboard.
  'moneda': 'PEN',
  // LLM (la key va en UserProperties).
  'llm.provider': 'gemini',
  'llm.model': 'gemini-3.7-flash',
  // Resultado de "Probar key" (sidebar); la web lo muestra. No editar a mano.
  'llm.lastTestAt': '',
  'llm.lastError': '',
  // Opt-in (ADR-008): extraer con el LLM los correos `*_unknown` enviando el texto ENMASCARADO. Solo con key.
  'llm.extractUnknown': 'false',
  // Tipo de cambio de respaldo para mostrar USD en PEN (ADR-005).
  'fx.usd_pen': '3.50',
  // Wiki en Drive.
  'brain.folderId': '',
  // Telemetría que escribe el Apps Script y leen la web y el sidebar (ADR-003/006). No editar a mano.
  'luca.version': '',
  'scan.lastRunAt': '',
  'scan.lastStats': '',
  'triggers.installedAt': '',
  // Versión del estilo aplicado a las pestañas (estilo-hojas-runtime.js). Vaciarla fuerza a reaplicarlo.
  'ui.estiloVersion': '',
  'conexiones.execUrl': '',
  'conexiones.execUrl.manual': '',
  'conexiones.mcp.execUrl': '',
  'conexiones.execUrl.verifiedAt': '',
  // iPhone (ADR-003, addendum 2026-10-05): el token del atajo vive AQUÍ (la web solo lee la hoja y el token
  // solo permite insertar filas en esta misma hoja). `iphone.execUrl` = URL con la que se generó el atajo.
  'conexiones.iphone.token': '',
  'conexiones.iphone.execUrl': '',
  'conexiones.iphone.device': '',
  'conexiones.iphone.lastEventAt': '',
  'conexiones.iphone.eventsCount': '0',
  'conexiones.iphone.lastError': '',
  'conexiones.iphone.lastTestAt': '',
  'conexiones.iphone.schemaVersion': ''
};

// --- Utilidades de pestaña key/value ---

function ensureKeyValueTab_(sheetId, name) {
  var ss = getSpreadsheet_(sheetId);
  var sh = ss.getSheetByName(name);
  var nueva = !sh;
  if (!sh) sh = ss.insertSheet(name);
  var map = getHeaderMap_(sh);
  if (!map['key'] || !map['value']) sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  if (nueva) estilizarNueva_(sh);
  // Fuerza la columna 'value' a TEXTO: evita que Sheets convierta "22:05" en Date.
  try { sh.getRange(2, 2, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@'); } catch (e) {}
  return sh;
}

function readKeyValueTab_(sh) {
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var map = getHeaderMap_(sh);
  if (!map['key'] || !map['value']) return out;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  rows.forEach(function (r) {
    var k = String(r[map['key'] - 1]).trim();
    if (k) out[k] = r[map['value'] - 1];
  });
  return out;
}

function setKeyValueTab_(sh, updates) {
  var map = getHeaderMap_(sh);
  var colK = map['key'], colV = map['value'];
  var existing = {};
  if (sh.getLastRow() >= 2) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < rows.length; i++) existing[String(rows[i][colK - 1]).trim()] = i + 2;
  }
  Object.keys(updates).forEach(function (k) {
    var row = existing[k];
    if (!row) { row = sh.getLastRow() + 1; sh.getRange(row, colK).setValue(k); existing[k] = row; }
    sh.getRange(row, colV).setValue(updates[k]);
  });
}

function str_(v) { return v == null ? '' : String(v); }
function bool_(v) { return String(v).trim().toLowerCase() === 'true'; }
function int_(v, def) { var n = parseInt(str_(v), 10); return isNaN(n) ? def : n; }
function lista_(v) {
  return str_(v).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// --- Ajustes ---

/** Lee Ajustes como mapa plano key→string con defaults aplicados. */
function getAjustes_(sheetId, config) {
  var sh = ensureKeyValueTab_(sheetId, config.sheets.settings);
  var raw = readKeyValueTab_(sh);
  var out = {};
  Object.keys(AJUSTES_DEFAULTS_).forEach(function (k) {
    out[k] = (raw[k] == null || str_(raw[k]) === '') ? AJUSTES_DEFAULTS_[k] : str_(raw[k]);
  });
  Object.keys(raw).forEach(function (k) { if (!(k in out)) out[k] = str_(raw[k]); });
  return out;
}

function setAjustes_(sheetId, config, updates) {
  var sh = ensureKeyValueTab_(sheetId, config.sheets.settings);
  setKeyValueTab_(sh, updates);
}

/**
 * CONFIG completo para el resto de la librería. El stub llama construirConfig(sheetId, CONFIG_STATIC).
 * Devuelve el estático + `ajustes` (mapa plano) + accesos tipados usados con frecuencia.
 */
function construirConfig(sheetId, staticConfig) {
  var cfg = JSON.parse(JSON.stringify(staticConfig || {}));
  cfg.sheets = cfg.sheets || {};
  cfg.sheets.settings = cfg.sheets.settings || 'Ajustes';
  cfg.sheets.ledger = cfg.sheets.ledger || 'Movimientos';
  cfg.sheets.processed = cfg.sheets.processed || '_Procesados';
  cfg.sheets.merchants = cfg.sheets.merchants || 'Comercios';
  cfg.sheets.categories = cfg.sheets.categories || 'Categorías';
  cfg.timezone = cfg.timezone || 'America/Lima';
  var a = getAjustes_(sheetId, cfg);
  cfg.ajustes = a;
  cfg.gmail = { senders: lista_(a['gmail.senders']), cursor: int_(a['gmail.cursor'], 0), batch: int_(a['gmail.batch'], 40) };
  cfg.moneda = a['moneda'] || 'PEN';
  cfg.llm = { provider: a['llm.provider'], model: a['llm.model'], extractUnknown: bool_(a['llm.extractUnknown']) };
  return cfg;
}

/** Para el sidebar/web: config visible (sin secretos). */
function cargarConfig(sheetId, config) {
  return { ajustes: config.ajustes, sheets: config.sheets, timezone: config.timezone, version: LUCA_VERSION };
}

// --- Telemetría ---

/**
 * URL `/exec` VIVA del Web App de la copia del usuario, o '' si no hay despliegue.
 * El stub la resuelve en su propio contexto (`config.execUrl`, ver gas/stub/config.js): `ScriptApp`
 * dentro de la librería apunta al proyecto de la librería, no al contenedor. Si el stub no la trae
 * (stub antiguo), se intenta igual y se tolera el fallo.
 */
function execUrlLive_(config) {
  if (config && config.execUrl) return String(config.execUrl).trim();
  try { return String(ScriptApp.getService().getUrl() || '').trim(); } catch (e) { return ''; }
}

/** URL guardada en `Ajustes.conexiones.execUrl` (la que vio la última pasada / "Activar conexiones"). */
function execUrlGuardada_(config) {
  return str_(config && config.ajustes && config.ajustes['conexiones.execUrl']).trim();
}

/**
 * URL `/exec` efectiva SIN red (para escaneos): si hay una URL verificada (respondió `{app:'luca'}`),
 * gana siempre; si no, la viva; si no, la guardada. Nota (2026-10-05): con varias implementaciones,
 * `ScriptApp.getService().getUrl()` puede devolver una implementación vieja/rota, por eso la viva ya no
 * pisa a una URL verificada.
 */
function execUrl_(config) {
  var a = (config && config.ajustes) || {};
  if (str_(a['conexiones.execUrl.verifiedAt']) && execUrlGuardada_(config)) return execUrlGuardada_(config);
  return execUrlLive_(config) || execUrlGuardada_(config);
}

/** Igual que execUrl_, y si no hay URL verificada y la viva difiere de la guardada, actualiza Ajustes. */
function syncExecUrl_(sheetId, config) {
  var a = (config && config.ajustes) || {};
  var saved = execUrlGuardada_(config);
  if (str_(a['conexiones.execUrl.verifiedAt']) && saved) return saved;
  var live = execUrlLive_(config);
  if (live && live !== saved) {
    setAjustes_(sheetId, config, { 'conexiones.execUrl': live });
    if (config && config.ajustes) config.ajustes['conexiones.execUrl'] = live;
  }
  return live || saved;
}

/** ¿La URL responde como el Web App de Luca? GET /exec → JSON {ok:true, app:'luca'}. */
function execUrlResponde_(url) {
  if (!/^https:\/\/script\.google\.com\/[^?#]*\/exec$/i.test(String(url || ''))) return false;
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (r.getResponseCode() !== 200) return false;
    var j = JSON.parse(r.getContentText());
    return !!(j && j.ok === true && j.app === 'luca');
  } catch (e) { return false; }
}

/**
 * Resuelve CON red la URL buena: prueba candidatas (manual, viva, MCP, guardada), se queda con la primera que
 * responde y la guarda como verificada. Solo se usa en acciones del usuario (no en cada escaneo).
 * La viva va antes que la guardada: tras una "Nueva implementación" la anterior sigue respondiendo (no se
 * archiva sola) y, si fuera primero, la URL nunca avanzaría. Si getUrl() da una rota, no responde y se cae
 * a la siguiente (2026-10-07).
 * @return {{url:string, verified:boolean, candidatas:Array<{url:string, ok:boolean}>}}
 */
function resolverExecUrl_(sheetId, config) {
  var a = (config && config.ajustes) || {};
  var cands = [];
  // Candidatas: la que pegó el usuario, la que da Google, la última que funcionó con el MCP y la guardada.
  [str_(a['conexiones.execUrl.manual']).trim(), execUrlLive_(config), str_(a['conexiones.mcp.execUrl']).trim(), execUrlGuardada_(config)].forEach(function (u) {
    if (u && cands.indexOf(u) < 0) cands.push(u);
  });
  var probadas = [];
  for (var i = 0; i < cands.length; i++) {
    var ok = execUrlResponde_(cands[i]);
    probadas.push({ url: cands[i], ok: ok });
    if (ok) {
      var upd = { 'conexiones.execUrl': cands[i], 'conexiones.execUrl.verifiedAt': new Date().toISOString() };
      setAjustes_(sheetId, config, upd);
      if (config && config.ajustes) { config.ajustes['conexiones.execUrl'] = cands[i]; config.ajustes['conexiones.execUrl.verifiedAt'] = upd['conexiones.execUrl.verifiedAt']; }
      if (config) config.execUrl = cands[i];
      return { url: cands[i], verified: true, candidatas: probadas };
    }
  }
  return { url: cands[0] || '', verified: false, candidatas: probadas };
}

/** Sidebar: el usuario pega la URL de su aplicación web; se valida antes de guardarla. */
function guardarExecUrl(sheetId, config, url) {
  var u = String(url || '').trim();
  if (!/^https:\/\/script\.google\.com\/[^?#]*\/exec$/i.test(u)) throw new Error('La URL debe ser la de la aplicación web y terminar en /exec.');
  if (!execUrlResponde_(u)) throw new Error('Esa URL no responde como Luca. Revisa que sea una implementación de tipo "Aplicación web", ejecutar como "Yo" y acceso "Cualquiera".');
  var upd = { 'conexiones.execUrl.manual': u, 'conexiones.execUrl': u, 'conexiones.execUrl.verifiedAt': new Date().toISOString() };
  setAjustes_(sheetId, config, upd);
  return { ok: true, url: u };
}

/** Resumen de telemetría del iPhone leído de Ajustes (para sidebar/web). */
function telemetriaIphone_(ajustes) {
  var a = ajustes || {};
  return {
    device: a['conexiones.iphone.device'] || '',
    // URL con la que se generó el atajo: si difiere de la viva, hay que regenerar el atajo.
    execUrl: a['conexiones.iphone.execUrl'] || '',
    lastEventAt: a['conexiones.iphone.lastEventAt'] || '',
    eventsCount: int_(a['conexiones.iphone.eventsCount'], 0),
    lastError: a['conexiones.iphone.lastError'] || '',
    lastTestAt: a['conexiones.iphone.lastTestAt'] || '',
    schemaVersion: a['conexiones.iphone.schemaVersion'] || ''
  };
}

/**
 * Escribe versión, URL del Web App y resultado de la pasada en Ajustes (ADR-003 §limitaciones, ADR-006 §4).
 * Se llama en cada pasada del dispatcher y en "Escanear ahora". Nunca lanza: la telemetría no rompe un escaneo.
 */
function writeTelemetria_(sheetId, config, stats) {
  try {
    var upd = { 'luca.version': LUCA_VERSION, 'stub.version': String((config && config.stubVersion) || '1'), 'conexiones.execUrl': execUrl_(config), 'scan.lastRunAt': new Date().toISOString() };
    if (stats !== undefined) upd['scan.lastStats'] = JSON.stringify(stats || {});
    setAjustes_(sheetId, config, upd);
  } catch (e) { Logger.log('writeTelemetria_: ' + (e && e.message || e)); }
  // Copias existentes: reciben el estilo de las pestañas en la primera pasada con una versión nueva.
  try { aplicarEstiloSiCorresponde_(sheetId, config); } catch (e) { Logger.log('estilo de hojas: ' + (e && e.message || e)); }
}
