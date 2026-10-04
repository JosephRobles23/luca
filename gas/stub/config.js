/**
 * config.js — CONFIG estático del stub (no editable en runtime).
 * Lo editable vive en la pestaña `Ajustes`; getConfig_() mezcla ambos con LucaLib.construirConfig.
 */

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
  return cfg;
}
