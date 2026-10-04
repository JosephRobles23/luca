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

/** Fecha de una celda del ledger (ISO string o Date si Sheets la convirtió) → 'YYYY-MM-DDTHH:MM' Lima. */
function rowMinute_(v) {
  if (v instanceof Date) { var iso = dateToIsoLima_(v); return iso ? iso.slice(0, 16) : ''; }
  return str_(v).slice(0, 16);
}

/** Clave difusa de una fila ya escrita (misma forma que txFuzzyKey). '' si falta monto o fecha. */
function rowFuzzyKey_(r) {
  var n = parseFloat(r.monto);
  if (isNaN(n) || !r.fecha) return '';
  return [str_(r.moneda), n.toFixed(2), rowMinute_(r.fecha)].join('|');
}

/**
 * Índice en memoria por pasada: ids, gmail_ids y clave difusa → fuentes (ADR-005 dedupe entre canales).
 */
function ledgerIndex_(sh) {
  var idx = { ids: {}, gmailIds: {}, fuzzy: {} };
  readRows_(sh).forEach(function (r) {
    var id = str_(r.id).trim(); if (id) idx.ids[id] = true;
    var g = str_(r.gmail_id).trim(); if (g) idx.gmailIds[g] = true;
    var k = rowFuzzyKey_(r);
    if (k) (idx.fuzzy[k] = idx.fuzzy[k] || {})[str_(r.fuente)] = true;
  });
  return idx;
}

/**
 * Añade transacciones al ledger, saltando las ya existentes (por id o por gmail_id), categorizándolas
 * (categorize-runtime.js) y marcando `fuzzy_dup` cuando otra fila de distinta fuente comparte la clave
 * difusa `moneda|monto|minuto` (push ↔ correo). No se descarta: el usuario decide.
 * @return {{added:number, skipped:number, fuzzy:number, ids:string[]}}
 */
function appendTransactions_(sheetId, config, txs) {
  var sh = ledgerSheet_(sheetId, config);
  var idx = ledgerIndex_(sh);
  var ctx = null;
  var nuevas = [], skipped = 0, fuzzy = 0;
  (txs || []).forEach(function (tx) {
    if (!tx || !tx.id) return;
    if (idx.ids[tx.id] || (tx.gmail_message_id && idx.gmailIds[tx.gmail_message_id])) { skipped++; return; }
    idx.ids[tx.id] = true;
    if (tx.gmail_message_id) idx.gmailIds[tx.gmail_message_id] = true;
    var fk = txFuzzyKey(tx);
    if (fk) {
      var fuentes = idx.fuzzy[fk] || {};
      var otra = Object.keys(fuentes).some(function (f) { return f && f !== tx.source; });
      if (otra) { tx.flags = (tx.flags || []).concat(['fuzzy_dup']); fuzzy++; }
      fuentes[tx.source] = true; idx.fuzzy[fk] = fuentes;
    }
    if (!ctx) ctx = categorizeContext_(sheetId, config);
    categorize_(tx, ctx);
    nuevas.push(txToRow_(tx));
  });
  appendRows_(sh, nuevas);
  if (ctx) flushMerchants_(ctx);
  return { added: nuevas.length, skipped: skipped, fuzzy: fuzzy, ids: nuevas.map(function (r) { return r.id; }) };
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

/**
 * Resumen rápido para la UI. `porTipo` cuenta filas por `tipo` (ADR-005): `transfer_in` (yapeos
 * recibidos) se reporta aparte (`recibidoYape`) y nunca se suma a `income`.
 */
function estadoLedger(sheetId, config) {
  var rows = readLedger_(sheetId, config);
  var porTipo = { expense: 0, income: 0, transfer_in: 0, internal_transfer: 0 };
  var sinCategoria = 0;
  rows.forEach(function (r) {
    porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1;
    if (r.tipo === 'expense' && !str_(r.categoria)) sinCategoria++;
  });
  return { total: rows.length, porTipo: porTipo, sinCategoria: sinCategoria, recibidoYape: porTipo.transfer_in, cursor: config.gmail.cursor };
}
