/**
 * config.js — CONFIG estático del stub (no editable en runtime).
 * Lo editable vive en la pestaña `Ajustes`; getConfig_() mezcla ambos con LucaLib.construirConfig.
 */

var CONFIG_STATIC = {
  sheets: {
    ledger:    'Movimientos',
    processed: '_Procesados',
    merchants: 'Comercios',
    settings:  'Ajustes'
  },
  timezone: 'America/Lima'
};

function getSheetId_() {
  return SpreadsheetApp.getActive().getId();
}

function getConfig_() {
  return LucaLib.construirConfig(getSheetId_(), CONFIG_STATIC);
}
