/**
 * mime-runtime.js — Parser MIME mínimo para el camino `format: 'raw'` de la Gmail API.
 * Port del script Node validado con .eml reales (scripts/eml-check.mjs). Maneja multipart anidado,
 * quoted-printable, base64 y charsets ISO-8859-1/UTF-8. Devuelve { html, plain, from, subject, date }.
 *
 * Sin import/export: runtime de Apps Script.
 */

function mimeDecodeQp_(s) {
  return String(s).replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
}

/** Bytes (latin1 "string") → texto según charset. */
function mimeBytesToText_(binStr, charset) {
  var cs = String(charset || 'utf-8').toLowerCase();
  var bytes = [];
  for (var i = 0; i < binStr.length; i++) { var c = binStr.charCodeAt(i) & 255; bytes.push(c > 127 ? c - 256 : c); }
  var blob = Utilities.newBlob(bytes);
  if (/8859|latin|1252/.test(cs)) {
    try { return blob.getDataAsString('ISO-8859-1'); } catch (e) { /* cae a utf-8 */ }
  }
  try { return blob.getDataAsString('UTF-8'); } catch (e2) { return binStr; }
}

function mimeDecodeBody_(raw, enc, charset) {
  var e = String(enc || '7bit').toLowerCase();
  if (e.indexOf('base64') >= 0) {
    var bytes = Utilities.base64Decode(String(raw).replace(/\s+/g, ''));
    var bin = ''; for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] & 255);
    return mimeBytesToText_(bin, charset);
  }
  if (e.indexOf('quoted-printable') >= 0) return mimeBytesToText_(mimeDecodeQp_(raw), charset);
  return mimeBytesToText_(raw, charset);
}

/** Cabeceras RFC 2047 (=?utf-8?Q?...?=) → texto. */
function mimeDecodeHeader_(v) {
  return String(v || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, function (_, cs, t, data) {
    var bin;
    if (t.toUpperCase() === 'B') { var b = Utilities.base64Decode(data); bin = ''; for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i] & 255); }
    else bin = mimeDecodeQp_(data.replace(/_/g, ' '));
    return mimeBytesToText_(bin, cs);
  }).replace(/\s+/g, ' ').trim();
}

function mimeParseHeaders_(block) {
  var h = {};
  String(block).replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(function (line) {
    var m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m) h[m[1].toLowerCase()] = m[2];
  });
  return h;
}

function mimeEscapeRe_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Recorre partes (recursivo) → { html, plain }. */
function mimeParts_(rawMsg) {
  var m = /\r?\n\r?\n/.exec(rawMsg);
  var idx = m ? m.index : rawMsg.length;
  var headers = mimeParseHeaders_(rawMsg.slice(0, idx));
  var body = rawMsg.slice(idx).replace(/^\r?\n\r?\n/, '');
  var ct = headers['content-type'] || 'text/plain';
  var out = { html: '', plain: '' };
  var bm = /boundary="?([^";]+)"?/i.exec(ct);
  if (/multipart\//i.test(ct) && bm) {
    var parts = body.split(new RegExp('--' + mimeEscapeRe_(bm[1]) + '(?:--)?\\r?\\n?'));
    for (var i = 1; i < parts.length; i++) {
      if (!parts[i].trim()) continue;
      var sub = mimeParts_(parts[i]);
      if (sub.html && !out.html) out.html = sub.html;
      if (sub.plain && !out.plain) out.plain = sub.plain;
    }
    return out;
  }
  var cm = /charset="?([^";]+)"?/i.exec(ct);
  var text = mimeDecodeBody_(body, headers['content-transfer-encoding'], cm ? cm[1] : '');
  if (/text\/html/i.test(ct)) out.html = text; else if (/text\/plain/i.test(ct)) out.plain = text;
  return out;
}

/**
 * Mensaje RFC 822 completo (string "binario" latin1) → { from, subject, date, html, plain }.
 */
function mimeParseMessage(rawMsg) {
  var m = /\r?\n\r?\n/.exec(rawMsg);
  var h = mimeParseHeaders_(rawMsg.slice(0, m ? m.index : rawMsg.length));
  var bodies = mimeParts_(rawMsg);
  var d = h['date'] ? new Date(h['date']) : null;
  return {
    from: mimeDecodeHeader_(h['from']),
    subject: mimeDecodeHeader_(h['subject']),
    date: d && !isNaN(d.getTime()) ? d : null,
    html: bodies.html,
    plain: bodies.plain
  };
}

/** base64url (campo `raw` de la Gmail API) → string "binario" latin1 (1 char = 1 byte). */
function b64urlToBinary_(data) {
  var bytes;
  if (data && typeof data !== 'string' && data.length != null) bytes = data;   // Byte[] del servicio avanzado
  else {
    var s = String(data || '').replace(/\s+/g, '');
    var std = s.replace(/-/g, '+').replace(/_/g, '/');
    while (std.length % 4) std += '=';
    bytes = Utilities.base64Decode(std);
  }
  var out = [];
  for (var i = 0; i < bytes.length; i += 8192) {
    var chunk = [];
    for (var j = i; j < Math.min(i + 8192, bytes.length); j++) chunk.push(bytes[j] & 255);
    out.push(String.fromCharCode.apply(null, chunk));
  }
  return out.join('');
}
