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
var LUCA_VERSION = '5';

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
  // Tipo de cambio de respaldo para mostrar USD en PEN (ADR-005).
  'fx.usd_pen': '3.50',
  // Wiki en Drive.
  'brain.folderId': '',
  // Telemetría que escribe el Apps Script y leen la web y el sidebar (ADR-003/006). No editar a mano.
  'luca.version': '',
  'scan.lastRunAt': '',
  'scan.lastStats': '',
  'triggers.installedAt': '',
  'conexiones.execUrl': '',
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
  if (!sh) sh = ss.insertSheet(name);
  var map = getHeaderMap_(sh);
  if (!map['key'] || !map['value']) sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
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
  cfg.llm = { provider: a['llm.provider'], model: a['llm.model'] };
  return cfg;
}

/** Para el sidebar/web: config visible (sin secretos). */
function cargarConfig(sheetId, config) {
  return { ajustes: config.ajustes, sheets: config.sheets, timezone: config.timezone, version: LUCA_VERSION };
}

// --- Telemetría ---

/**
 * URL `/exec` del Web App de la copia del usuario, o '' si no hay despliegue.
 * El stub la resuelve en su propio contexto (`config.execUrl`, ver gas/stub/config.js): `ScriptApp`
 * dentro de la librería apunta al proyecto de la librería, no al contenedor. Si el stub no la trae
 * (stub antiguo), se intenta igual y se tolera el fallo.
 */
function execUrl_(config) {
  if (config && config.execUrl) return String(config.execUrl);
  try { return String(ScriptApp.getService().getUrl() || ''); } catch (e) { return ''; }
}

/** Resumen de telemetría del iPhone leído de Ajustes (para sidebar/web). */
function telemetriaIphone_(ajustes) {
  var a = ajustes || {};
  return {
    device: a['conexiones.iphone.device'] || '',
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
    var upd = { 'luca.version': LUCA_VERSION, 'conexiones.execUrl': execUrl_(config), 'scan.lastRunAt': new Date().toISOString() };
    if (stats !== undefined) upd['scan.lastStats'] = JSON.stringify(stats || {});
    setAjustes_(sheetId, config, upd);
  } catch (e) { Logger.log('writeTelemetria_: ' + (e && e.message || e)); }
}
