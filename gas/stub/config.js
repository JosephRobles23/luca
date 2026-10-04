/**
 * config.js — CONFIG estático del stub (no editable en runtime).
 * Lo editable vive en la pestaña `Ajustes`; getConfig_() mezcla ambos con LucaLib.construirConfig.
 */

// Versión del STUB (no de la librería). La librería la compara con STUB_MIN_VERSION_ y avisa si hay que
// actualizar los archivos del stub en la copia (ADR-006 §5). Subirla solo cuando cambie gas/stub/*.
var STUB_VERSION = '2';

var CONFIG_STATIC = {
  sheets: {
    ledger:     'Movimientos',
    processed:  '_Procesados',
    merchants:  'Comercios',
    categories: 'Categorías',
    settings:   'Ajustes'
  },
  timezone: 'America/Lima'
};

function getSheetId_() {
  return SpreadsheetApp.getActive().getId();
}

/**
 * URL `/exec` del Web App de ESTA copia ('' si no está desplegado). Se resuelve aquí y no en la librería
 * porque `ScriptApp.getService()` devuelve el servicio del proyecto donde corre el código.
 */
function getExecUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function getConfig_() {
  var cfg = LucaLib.construirConfig(getSheetId_(), CONFIG_STATIC);
  cfg.execUrl = getExecUrl_();
  cfg.stubVersion = STUB_VERSION;
  return cfg;
}
