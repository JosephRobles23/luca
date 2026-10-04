/**
 * gmail-scan-runtime.js — Escaneo incremental de Gmail con el servicio avanzado (scope gmail.readonly).
 *
 * Se itera por MENSAJE (no por hilo: Gmail agrupa varias notificaciones en un hilo).
 * Cursor en Ajustes (`gmail.cursor`, epoch segundos) con 1 día de solape; el dedupe lo absorbe.
 * Presupuesto por pasada: `gmail.batch` mensajes o ~200 s, para no chocar con los 6 min.
 *
 * Sin import/export: runtime de Apps Script.
 */

var SCAN_BUDGET_MS_ = 200 * 1000;
var SCAN_OVERLAP_S_ = 24 * 3600;

/** Construye la query de Gmail a partir de los remitentes y el cursor. */
function gmailQuery_(senders, afterEpoch, beforeEpoch) {
  var q = 'from:(' + senders.join(' OR ') + ')';
  if (afterEpoch) q += ' after:' + Math.max(0, afterEpoch - SCAN_OVERLAP_S_);
  if (beforeEpoch) q += ' before:' + beforeEpoch;
  return q;
}

/** Lista ids de mensajes que cumplen la query (pagina hasta `max`). */
function gmailListIds_(query, max) {
  var ids = [], token = null;
  do {
    var res = Gmail.Users.Messages.list('me', { q: query, maxResults: Math.min(100, max - ids.length), pageToken: token || undefined });
    (res.messages || []).forEach(function (m) { ids.push(m.id); });
    token = res.nextPageToken || null;
  } while (token && ids.length < max);
  return ids.slice(0, max);
}

/**
 * base64url (Gmail API) → string UTF-8. Tolerante: normaliza alfabeto y padding y prueba ambos
 * decodificadores; si aun así falla devuelve '' en vez de abortar el escaneo.
 */
function b64urlToString_(data) {
  if (!data) return '';
  var s = String(data).replace(/\s+/g, '');
  var std = s.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4) std += '=';
  var attempts = [
    function () { return Utilities.base64Decode(std); },
    function () { return Utilities.base64DecodeWebSafe(s); },
    function () { return Utilities.base64DecodeWebSafe(s + '=='.slice(0, (4 - s.length % 4) % 4)); }
  ];
  for (var i = 0; i < attempts.length; i++) {
    try { return Utilities.newBlob(attempts[i]()).getDataAsString('UTF-8'); } catch (e) { /* siguiente */ }
  }
  Logger.log('b64urlToString_: no se pudo decodificar una parte (%s chars)', s.length);
  return '';
}

/** Recorre las partes MIME y devuelve { html, plain }. */
function gmailBodies_(payload) {
  var out = { html: '', plain: '' };
  function walk(p) {
    if (!p) return;
    var mime = String(p.mimeType || '');
    if (p.body && p.body.data) {
      if (mime === 'text/html' && !out.html) out.html = b64urlToString_(p.body.data);
      else if (mime === 'text/plain' && !out.plain) out.plain = b64urlToString_(p.body.data);
    }
    (p.parts || []).forEach(walk);
  }
  walk(payload);
  return out;
}

/** Mensaje de la Gmail API (format=full) → { id, from, subject, date, html, plain, epoch }. */
function gmailMessageToEmail(msg) {
  var headers = {};
  ((msg.payload && msg.payload.headers) || []).forEach(function (h) { headers[String(h.name).toLowerCase()] = h.value; });
  var bodies = gmailBodies_(msg.payload);
  var epoch = Math.floor(parseInt(msg.internalDate || '0', 10) / 1000);
  return {
    id: msg.id,
    from: headers['from'] || '',
    subject: headers['subject'] || '',
    date: epoch ? new Date(epoch * 1000) : null,
    epoch: epoch,
    html: bodies.html,
    plain: bodies.plain
  };
}

function gmailGetEmail_(id) {
  return gmailMessageToEmail(Gmail.Users.Messages.get('me', id, { format: 'full' }));
}

/**
 * Pasada de escaneo. opts: { afterEpoch, beforeEpoch, max } (por defecto usa el cursor y el batch de config).
 * @return {{listed:number, processed:number, added:number, skipped:number, ignored:number, unknown:number, cursor:number, done:boolean}}
 */
function scanGmail_(sheetId, config, opts) {
  opts = opts || {};
  var t0 = Date.now();
  var after = opts.afterEpoch != null ? opts.afterEpoch : config.gmail.cursor;
  var max = opts.max || config.gmail.batch;
  var query = gmailQuery_(config.gmail.senders, after, opts.beforeEpoch);
  var ids = gmailListIds_(query, max * 3);         // se listan de más porque muchos ya estarán procesados
  ensureCategorizacion_(sheetId, config);          // `Categorías` y `Comercios` nacen en el primer escaneo
  var yaVistos = processedSet_(sheetId, config);
  var pendientes = ids.filter(function (id) { return !yaVistos[id]; });

  var txs = [], procesados = [], maxEpoch = after || 0, n = 0;
  var stats = { listed: ids.length, processed: 0, added: 0, skipped: 0, ignored: 0, unknown: 0 };
  for (var i = 0; i < pendientes.length && n < max; i++) {
    if (Date.now() - t0 > SCAN_BUDGET_MS_) break;
    var email;
    try { email = gmailGetEmail_(pendientes[i]); }
    catch (err) {
      n++;
      procesados.push({ gmail_id: pendientes[i], resultado: 'error:' + String(err && err.message || err).slice(0, 80), tipo: '' });
      stats.unknown++;
      continue;
    }
    n++;
    if (email.epoch > maxEpoch) maxEpoch = email.epoch;
    var r = parseEmail(email);
    if (r.ignored) { stats.ignored++; procesados.push({ gmail_id: email.id, resultado: 'ignored:' + r.reason, tipo: r.type || '', asunto: email.subject, remitente: email.from }); continue; }
    if (r.unknown) { stats.unknown++; procesados.push({ gmail_id: email.id, resultado: 'unknown', tipo: r.type, asunto: email.subject, remitente: email.from }); continue; }
    txs.push(r);
    procesados.push({ gmail_id: email.id, resultado: 'tx', tipo: r.type });
  }
  stats.processed = n;
  var res = appendTransactions_(sheetId, config, txs);
  stats.added = res.added; stats.skipped = res.skipped;
  markProcessed_(sheetId, config, procesados);

  var done = n >= pendientes.length;
  // El cursor solo avanza cuando se agotó lo pendiente; si no, la siguiente pasada retoma.
  if (done && maxEpoch && opts.afterEpoch == null) setAjustes_(sheetId, config, { 'gmail.cursor': String(maxEpoch) });
  stats.cursor = done ? maxEpoch : after;
  stats.done = done;
  return stats;
}

/** Acción de menú/sidebar: una pasada ahora (también deja telemetría en Ajustes). */
function escanearAhora(sheetId, config) {
  var st = scanGmail_(sheetId, config, {});
  writeTelemetria_(sheetId, config, st);
  return st;
}

/**
 * Importación histórica: desde `sinceEpoch` hasta hoy, en pasadas sucesivas (la llama el dispatcher
 * mientras `import.status` = 'running'). Primera llamada: inicia el job.
 */
function iniciarImportacion(sheetId, config, sinceEpoch) {
  setAjustes_(sheetId, config, { 'import.since': String(sinceEpoch), 'import.status': 'running' });
  return pasadaImportacion_(sheetId, construirConfig(sheetId, config));
}

function pasadaImportacion_(sheetId, config) {
  var since = int_(config.ajustes['import.since'], 0);
  if (!since || config.ajustes['import.status'] !== 'running') return { done: true, idle: true };
  var st = scanGmail_(sheetId, config, { afterEpoch: since, max: config.gmail.batch });
  if (st.done) {
    var upd = { 'import.status': 'done' };
    // Al terminar, el cursor incremental avanza hasta lo último importado (si estaba más atrás).
    if (st.cursor && st.cursor > config.gmail.cursor) upd['gmail.cursor'] = String(st.cursor);
    setAjustes_(sheetId, config, upd);
  }
  return st;
}

/** Trigger temporal: importación en curso (si la hay) y luego escaneo incremental. Deja telemetría en Ajustes. */
function runDispatcher(sheetId, config) {
  var lock = LockService.getUserLock();
  try { lock.waitLock(5000); } catch (e) { return { skipped: 'locked' }; }
  try {
    var imp = pasadaImportacion_(sheetId, config);
    var out;
    if (imp && !imp.idle && !imp.done) out = { import: imp };
    else {
      out = { import: imp, scan: scanGmail_(sheetId, config, {}) };
      // LLM opcional (ADR-004): categoriza lo pendiente al final de la pasada, solo si hay key y con presupuesto.
      var llm = categorizarPendientesAuto_(sheetId, config);
      if (llm) { out.llm = llm; out.scan.llm = llm; }
    }
    writeTelemetria_(sheetId, config, out.scan || out.import);
    return out;
  } finally {
    lock.releaseLock();
  }
}
