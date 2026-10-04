/**
 * sheets-runtime.js — Acceso a hojas por NOMBRE de encabezado (fila 1), no por posición.
 * Copiado de CoS-Agent (shared/sheets-runtime.js).
 *
 * Sin import/export: runtime de Apps Script. Privados con sufijo "_".
 */

/** Abre el Spreadsheet del usuario por su ID. */
function getSpreadsheet_(sheetId) {
  if (!sheetId) throw new Error('getSpreadsheet_: falta sheetId.');
  return SpreadsheetApp.openById(sheetId);
}

/** Devuelve la hoja `name`. Falla si no existe. */
function getSheet_(sheetId, name) {
  var sh = getSpreadsheet_(sheetId).getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja: ' + name);
  return sh;
}

/** Devuelve la hoja `name`, creándola con `headers` si no existe. */
function ensureSheet_(sheetId, name, headers) {
  var ss = getSpreadsheet_(sheetId);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      try { sh.setFrozenRows(1); } catch (e) {}
    }
  } else if (headers && headers.length) {
    headers.forEach(function (h) { ensureColumn_(sh, h); });
  }
  return sh;
}

/** Mapa { encabezado -> columna 1-based } usando la fila 1. */
function getHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    var key = String(h).trim();
    if (key) map[key] = i + 1;
  });
  return map;
}

/** Garantiza que exista la columna `headerName` (la crea al final si falta). Devuelve col 1-based. */
function ensureColumn_(sheet, headerName) {
  var map = getHeaderMap_(sheet);
  if (map[headerName]) return map[headerName];
  var col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(headerName);
  return col;
}

/** Lee todas las filas de datos como objetos { encabezado: valor }. */
function readRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var map = getHeaderMap_(sheet);
  var keys = Object.keys(map);
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  return rows.map(function (r) {
    var o = {};
    keys.forEach(function (k) { o[k] = r[map[k] - 1]; });
    return o;
  });
}

/** Añade filas (objetos { encabezado: valor }) respetando el orden de columnas de la hoja. */
function appendRows_(sheet, objs) {
  if (!objs.length) return 0;
  var map = getHeaderMap_(sheet);
  var ncols = sheet.getLastColumn();
  var values = objs.map(function (o) {
    var row = [];
    for (var c = 0; c < ncols; c++) row.push('');
    Object.keys(o).forEach(function (k) {
      if (map[k]) row[map[k] - 1] = o[k] == null ? '' : o[k];
    });
    return row;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, ncols).setValues(values);
  return values.length;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
