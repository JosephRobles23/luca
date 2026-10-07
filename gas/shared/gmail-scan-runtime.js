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
function b64urlToString_(data, charset) {
  if (!data) return '';
  // Servicio avanzado de Gmail en Apps Script: los campos "bytes" (body.data, raw) llegan YA
  // decodificados como Byte[] (array de enteros con signo), no como base64. En Node/tests son strings.
  if (typeof data !== 'string' && data.length != null) return bytesToString_(data, charset);
  var s = String(data).replace(/\s+/g, '');
  var std = s.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4) std += '=';
  var attempts = [
    function () { return Utilities.base64Decode(std); },
    function () { return Utilities.base64DecodeWebSafe(s); },
    function () { return Utilities.base64DecodeWebSafe(s + '=='.slice(0, (4 - s.length % 4) % 4)); }
  ];
  for (var i = 0; i < attempts.length; i++) {
    try { return bytesToString_(attempts[i](), charset); } catch (e) { /* siguiente */ }
  }
  Logger.log('b64urlToString_: no se pudo decodificar una parte (%s chars)', s.length);
  return '';
}

/** Byte[] → string respetando el charset de la parte (ISO-8859-1 en muchos correos de bancos). */
function bytesToString_(bytes, charset) {
  var blob = Utilities.newBlob(bytes);
  var cs = String(charset || '').toLowerCase();
  if (/8859|latin|1252/.test(cs)) { try { return blob.getDataAsString('ISO-8859-1'); } catch (e) { /* cae a utf-8 */ } }
  return blob.getDataAsString('UTF-8');
}

/** charset declarado en las cabeceras de una parte (Content-Type: text/html; charset=...). */
function partCharset_(p) {
  var hs = (p && p.headers) || [];
  for (var i = 0; i < hs.length; i++) {
    if (String(hs[i].name).toLowerCase() === 'content-type') { var m = /charset="?([^";]+)"?/i.exec(String(hs[i].value || '')); if (m) return m[1]; }
  }
  return '';
}

/** Recorre las partes MIME y devuelve { html, plain }. */
function gmailBodies_(payload) {
  var out = { html: '', plain: '' };
  function walk(p) {
    if (!p) return;
    var mime = String(p.mimeType || '');
    if (p.body && p.body.data) {
      if (mime === 'text/html' && !out.html) out.html = b64urlToString_(p.body.data, partCharset_(p));
      else if (mime === 'text/plain' && !out.plain) out.plain = b64urlToString_(p.body.data, partCharset_(p));
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
  var email = gmailMessageToEmail(Gmail.Users.Messages.get('me', id, { format: 'full' }));
  if (!email.html && !email.plain) {
    // Camino alternativo: mensaje RFC 822 completo y parser MIME propio (mime-runtime.js).
    var rawEmail = gmailGetEmailRaw_(id);
    if (rawEmail) { rawEmail.epoch = email.epoch; rawEmail.date = email.date || rawEmail.date; rawEmail.viaRaw = true; return rawEmail; }
    email.emptyBody = true;
  }
  return email;
}

/** format=raw → { id, from, subject, date, html, plain } o null si falla. */
function gmailGetEmailRaw_(id) {
  try {
    var msg = Gmail.Users.Messages.get('me', id, { format: 'raw' });
    if (!msg || !msg.raw) return null;
    var parsed = mimeParseMessage(b64urlToBinary_(msg.raw));   // acepta Byte[] o base64url
    var epoch = Math.floor(parseInt(msg.internalDate || '0', 10) / 1000);
    return { id: id, from: parsed.from, subject: parsed.subject, date: parsed.date || (epoch ? new Date(epoch * 1000) : null), epoch: epoch, html: parsed.html, plain: parsed.plain };
  } catch (e) {
    Logger.log('gmailGetEmailRaw_ falló: %s', e && e.message);
    return null;
  }
}

/**
 * Diagnóstico de un correo sin exponer su contenido: estructura de partes, resultado de cada
 * decodificador, camino raw, longitud del texto y campos detectados. Para pegar en soporte.
 */
function diagnosticarCorreo(sheetId, config, gmailId) {
  var out = { id: gmailId, parts: [], raw: null, text: null, parse: null };
  var msg;
  try { msg = Gmail.Users.Messages.get('me', gmailId, { format: 'full' }); }
  catch (e) { out.error = 'get(full): ' + (e && e.message); return out; }
  (function walk(p, depth) {
    if (!p) return;
    var info = { depth: depth, mime: String(p.mimeType || ''), dataType: p.body && p.body.data != null ? (typeof p.body.data === 'string' ? 'string' : 'bytes[]') : 'none', charset: partCharset_(p), hasData: !!(p.body && p.body.data), dataLen: p.body && p.body.data ? String(p.body.data).length : 0, attachmentId: !!(p.body && p.body.attachmentId), size: p.body ? p.body.size : null, attempts: [] };
    if (info.hasData && typeof p.body.data !== 'string') {
      try { var t0 = bytesToString_(p.body.data, partCharset_(p)); info.attempts.push({ via: 'bytes[] directo', chars: t0.length, startsWithTag: /^\s*</.test(t0) }); } catch (e0) { info.attempts.push({ via: 'bytes[] directo', error: String(e0 && e0.message || e0).slice(0, 120) }); }
    } else if (info.hasData) {
      var s = String(p.body.data).replace(/\s+/g, ''); var std = s.replace(/-/g, '+').replace(/_/g, '/'); while (std.length % 4) std += '=';
      [['base64Decode(std)', function () { return Utilities.base64Decode(std); }], ['base64DecodeWebSafe(s)', function () { return Utilities.base64DecodeWebSafe(s); }]].forEach(function (a) {
        try { var b = a[1](); var t = Utilities.newBlob(b).getDataAsString('UTF-8'); info.attempts.push({ via: a[0], bytes: b.length, chars: t.length, startsWithTag: /^\s*</.test(t) }); }
        catch (err) { info.attempts.push({ via: a[0], error: String(err && err.message || err).slice(0, 120) }); }
      });
    }
    out.parts.push(info);
    (p.parts || []).forEach(function (c) { walk(c, depth + 1); });
  })(msg.payload, 0);
  try {
    var r = Gmail.Users.Messages.get('me', gmailId, { format: 'raw' });
    var bin = b64urlToBinary_(r.raw || '');
    var parsed = mimeParseMessage(bin);
    out.raw = { rawLen: String(r.raw || '').length, binLen: bin.length, htmlLen: parsed.html.length, plainLen: parsed.plain.length, subjectOk: !!parsed.subject };
  } catch (e2) { out.raw = { error: String(e2 && e2.message || e2).slice(0, 160) }; }
  try {
    var email = gmailGetEmail_(gmailId);
    var text = emailText_(email);
    var fields = extractFields(text);
    out.text = { viaRaw: !!email.viaRaw, htmlLen: (email.html || '').length, plainLen: (email.plain || '').length, textLen: text.length, lines: text.split('\n').length, fieldKeys: Object.keys(fields).slice(0, 25) };
    var res = parseEmail(email);
    out.parse = res.ignored || res.unknown ? res : { type: res.type, kind: res.kind, amount: res.amount, currency: res.currency, hasMerchant: !!res.merchant, hasCounterparty: !!res.counterparty_name, operation_id: res.operation_id ? 'sí' : 'no', occurred_at: res.occurred_at, flags: res.flags };
  } catch (e3) { out.text = { error: String(e3 && e3.message || e3).slice(0, 160) }; }
  return out;
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

  // Extractor opt-in (ADR-008): solo con key y `llm.extractUnknown`; comparte presupuesto con la categorización.
  var extractor = llmExtractEnabled_(config) && getSecret_('llmKey') ? llmExtractContext_(sheetId, config) : null;
  var txs = [], procesados = [], maxEpoch = after || 0, n = 0;
  var stats = { listed: ids.length, processed: 0, added: 0, skipped: 0, ignored: 0, unknown: 0, llmExtracted: 0, emptyBody: 0, viaRaw: 0 };
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
    if (email.emptyBody) stats.emptyBody++;
    if (email.viaRaw) stats.viaRaw++;
    var r = parseEmail(email);
    if (r.ignored) { stats.ignored++; procesados.push({ gmail_id: email.id, resultado: 'ignored:' + r.reason, tipo: r.type || '', asunto: email.subject, remitente: email.from }); continue; }
    if (r.unknown) {
      var ex = extractor ? extractWithLlm_(email, extractor) : null;
      if (ex && ex.ignored) { stats.ignored++; procesados.push({ gmail_id: email.id, resultado: 'ignored:' + ex.reason, tipo: ex.type || '', asunto: email.subject, remitente: email.from }); continue; }
      if (ex) { stats.llmExtracted++; txs.push(ex); procesados.push({ gmail_id: email.id, resultado: 'tx:llm', tipo: ex.type, asunto: email.subject, remitente: email.from }); continue; }
      stats.unknown++; procesados.push({ gmail_id: email.id, resultado: 'unknown', tipo: r.type, asunto: email.subject, remitente: email.from }); continue;
    }
    // Parse degradado: el asunto se reconoce pero el cuerpo no dio monto (p. ej. BCP cambió la plantilla).
    // Con el extractor activo, el LLM rellena; conserva el tipo determinista y marca la fila.
    if (extractor && r.amount == null && (r.flags || []).indexOf('no_amount') >= 0) {
      var ex2 = extractWithLlm_(email, extractor);
      if (ex2 && !ex2.ignored && ex2.amount != null) {
        ex2.type = r.type; ex2.kind = ex2.kind || r.kind;
        if ((ex2.flags || []).indexOf('llm_extracted') < 0) ex2.flags = (ex2.flags || []).concat(['llm_extracted']);
        ex2.flags.push('deterministic_degraded');
        stats.llmExtracted++; txs.push(ex2);
        procesados.push({ gmail_id: email.id, resultado: 'tx:llm', tipo: r.type, asunto: email.subject, remitente: email.from });
        continue;
      }
    }
    txs.push(r);
    procesados.push({ gmail_id: email.id, resultado: 'tx', tipo: r.type });
  }
  stats.processed = n;
  var res = appendTransactions_(sheetId, config, txs, extractor);
  if (extractor) stats.llmCalls = extractor.llmCalls;
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
  // Trigger que quedó instalado en la plantilla oficial: no escanea (ver PLANTILLAS_OFICIALES_).
  if (esPlantillaOficial_(sheetId)) return { skipped: 'plantilla' };
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
