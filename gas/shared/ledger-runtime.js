/**
 * ledger-runtime.js — Pestaña `Movimientos` (el ledger) y `_Procesados` (correos ya vistos).
 *
 * Dedupe por `id` de transacción (operación del banco cuando existe; si no, el id de Gmail) y
 * por `gmail_id`. "Ya importé este correo" vive en el Sheet del usuario, no en Script Properties.
 *
 * Sin import/export: runtime de Apps Script.
 */

var LEDGER_HEADERS_ = [
  'id', 'fecha', 'tipo', 'monto', 'moneda', 'tipo_cambio', 'comercio', 'contraparte', 'contraparte_key',
  'categoria', 'categoria_origen', 'medio', 'canal', 'fuente', 'operacion', 'gmail_id', 'flags', 'asunto', 'creado_en'
];
var PROCESSED_HEADERS_ = ['gmail_id', 'resultado', 'tipo', 'fecha'];

function ledgerSheet_(sheetId, config) { return ensureSheet_(sheetId, config.sheets.ledger, LEDGER_HEADERS_); }
function processedSheet_(sheetId, config) { return ensureSheet_(sheetId, config.sheets.processed, PROCESSED_HEADERS_); }

/** Conjunto de valores de una columna (para dedupe rápido). */
function columnSet_(sheet, header) {
  var map = getHeaderMap_(sheet);
  var col = map[header];
  var set = {};
  if (!col || sheet.getLastRow() < 2) return set;
  var vals = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  vals.forEach(function (r) { var v = String(r[0]).trim(); if (v) set[v] = true; });
  return set;
}

/** Transacción normalizada → fila del ledger. */
function txToRow_(tx) {
  return {
    id: tx.id,
    fecha: tx.occurred_at || '',
    tipo: tx.kind,
    monto: tx.amount == null ? '' : tx.amount,
    moneda: tx.currency || '',
    tipo_cambio: tx.fx_rate == null ? '' : tx.fx_rate,
    comercio: tx.merchant || '',
    contraparte: tx.counterparty_name || '',
    contraparte_key: tx.counterparty_key || '',
    categoria: tx.category || '',
    categoria_origen: tx.category_source || '',
    medio: tx.instrument || '',
    canal: tx.channel || '',
    fuente: tx.source,
    operacion: tx.operation_id || '',
    gmail_id: tx.gmail_message_id || '',
    flags: (tx.flags || []).join(','),
    asunto: tx.raw_subject || '',
    creado_en: new Date().toISOString()
  };
}

/**
 * Añade transacciones al ledger, saltando las ya existentes (por id o por gmail_id).
 * @return {{added:number, skipped:number, ids:string[]}}
 */
function appendTransactions_(sheetId, config, txs) {
  var sh = ledgerSheet_(sheetId, config);
  var ids = columnSet_(sh, 'id');
  var gmailIds = columnSet_(sh, 'gmail_id');
  var nuevas = [], skipped = 0, seen = {};
  (txs || []).forEach(function (tx) {
    if (!tx || !tx.id) return;
    if (ids[tx.id] || seen[tx.id] || (tx.gmail_message_id && gmailIds[tx.gmail_message_id])) { skipped++; return; }
    seen[tx.id] = true;
    nuevas.push(txToRow_(tx));
  });
  appendRows_(sh, nuevas);
  return { added: nuevas.length, skipped: skipped, ids: nuevas.map(function (r) { return r.id; }) };
}

/** Marca correos como procesados (incluidos ignorados/desconocidos) para no releerlos. */
function markProcessed_(sheetId, config, entries) {
  var sh = processedSheet_(sheetId, config);
  var done = columnSet_(sh, 'gmail_id');
  var rows = [];
  (entries || []).forEach(function (e) {
    if (!e.gmail_id || done[e.gmail_id]) return;
    done[e.gmail_id] = true;
    rows.push({ gmail_id: e.gmail_id, resultado: e.resultado, tipo: e.tipo || '', fecha: new Date().toISOString() });
  });
  appendRows_(sh, rows);
  return rows.length;
}

function processedSet_(sheetId, config) {
  return columnSet_(processedSheet_(sheetId, config), 'gmail_id');
}

/** Lee el ledger completo como objetos (para dashboard/MCP). */
function readLedger_(sheetId, config) {
  return readRows_(ledgerSheet_(sheetId, config));
}

/** Resumen rápido para la UI. */
function estadoLedger(sheetId, config) {
  var rows = readLedger_(sheetId, config);
  var porTipo = {};
  rows.forEach(function (r) { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1; });
  return { total: rows.length, porTipo: porTipo, cursor: config.gmail.cursor };
}
