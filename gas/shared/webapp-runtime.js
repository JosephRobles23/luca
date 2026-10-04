/**
 * webapp-runtime.js — Router del Web App (doGet/doPost del stub). Patrón CoS-Agent:
 * GET nunca muta; POST con `?mcp=1` va al MCP (pendiente: mcp-runtime.js, fork de CoS);
 * POST con `?events=1` recibe eventos del iPhone reenviados por el Worker.
 * Siempre responde HTTP 200 con JSON { ok, ... } (limitación de GAS).
 *
 * Sin import/export: runtime de Apps Script.
 */

function webJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function webAction(metodo, e, sheetId, config) {
  var p = (e && e.parameter) || {};
  if (metodo === 'get') return webJson_({ ok: true, app: 'luca', version: 2 });
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return webJson_({ ok: false, error: 'bad-json' }); }

  if (p.mcp) return typeof mcpAction === 'function' ? mcpAction(e, sheetId, config) : webJson_({ ok: false, error: 'mcp-not-available' });
  if (p.events) return eventsAction_(body, sheetId, config);
  return webJson_({ ok: false, error: 'unknown-route' });
}

/** Evento push del iPhone (vía Worker, que ya validó el token del dispositivo y firma con el secreto del tenant). */
function eventsAction_(body, sheetId, config) {
  var secret = getSecret_('mcpSecret');
  if (!secret || String(body.secret || '') !== secret) return webJson_({ ok: false, error: 'unauthorized' });
  var ev = body.event || {};
  var r = parsePushEvent(ev);
  if (r.unknown) {
    markProcessed_(sheetId, config, [{ gmail_id: 'push:' + (ev.id || ''), resultado: 'unknown', tipo: 'push' }]);
    return webJson_({ ok: true, stored: false, reason: r.reason });
  }
  var res = appendTransactions_(sheetId, config, [r]);
  return webJson_({ ok: true, stored: res.added === 1, id: r.id, kind: r.kind, amount: r.amount });
}
