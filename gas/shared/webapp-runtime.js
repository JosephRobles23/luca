/**
 * webapp-runtime.js — Router del Web App (doGet/doPost del stub). Patrón CoS-Agent:
 * GET nunca muta; POST con `?mcp=1` va al MCP (mcp-runtime.js); POST con `?events=1` recibe los
 * eventos push que el atajo del iPhone envía DIRECTO al `/exec` del usuario (ADR-003, sin Worker).
 * Siempre responde HTTP 200 con JSON { ok, ... } (limitación de GAS).
 *
 * Sin import/export: runtime de Apps Script.
 */

/** Versiones del payload del atajo que esta librería entiende (ADR-003 §limitaciones). */
var EVENT_SCHEMA_VERSIONS_ = { '1': true };

function webJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function webAction(metodo, e, sheetId, config) {
  var p = (e && e.parameter) || {};
  if (metodo === 'get') return webJson_({ ok: true, app: 'luca', version: LUCA_VERSION });
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return webJson_({ ok: false, error: 'bad-json' }); }

  if (p.mcp) return typeof mcpAction === 'function' ? mcpAction(e, sheetId, config) : webJson_({ ok: false, error: 'mcp-not-available' });
  if (p.events) return eventsAction_(body, sheetId, config);
  return webJson_({ ok: false, error: 'unknown-route' });
}

/**
 * Evento push del iPhone. Contrato (ADR-003):
 *   { schema_version:'1', id, source:'yape'|'test', channel, token, title, subtitle, body, raw, notified_at, received_at, device }
 * - `token` se compara con `Ajustes.conexiones.iphone.token` (respaldo: UserProperties de copias viejas). Sin token válido → unauthorized.
 * - `schema_version` desconocida → { ok:false, error:'update-shortcut' } (el atajo debe actualizarse).
 * - `source:'test'` (botón Probar) solo escribe `conexiones.iphone.lastTestAt`; no toca el ledger.
 * - Ráfagas: LockService.getUserLock() serializa las escrituras.
 * - Telemetría en Ajustes: device, lastEventAt, eventsCount, lastError, schemaVersion.
 */
function eventsAction_(body, sheetId, config) {
  body = body || {};
  var token = iphoneToken_(sheetId, config);
  if (!token || String(body.token || '') !== token) return webJson_({ ok: false, error: 'unauthorized' });

  var lock = LockService.getUserLock();
  try { lock.waitLock(10000); } catch (e) { return webJson_({ ok: false, error: 'busy' }); }
  try {
    var schema = String(body.schema_version || '');
    var tele = { 'conexiones.iphone.device': String(body.device || ''), 'conexiones.iphone.schemaVersion': schema };
    if (!EVENT_SCHEMA_VERSIONS_[schema]) {
      tele['conexiones.iphone.lastError'] = 'update-shortcut:' + (schema || 'sin schema_version');
      setAjustes_(sheetId, config, tele);
      return webJson_({ ok: false, error: 'update-shortcut' });
    }
    if (String(body.source || '') === 'test') {
      tele['conexiones.iphone.lastTestAt'] = new Date().toISOString();
      tele['conexiones.iphone.lastError'] = '';
      setAjustes_(sheetId, config, tele);
      return webJson_({ ok: true, test: true });
    }

    var count = int_(config.ajustes && config.ajustes['conexiones.iphone.eventsCount'], 0) + 1;
    tele['conexiones.iphone.eventsCount'] = String(count);
    tele['conexiones.iphone.lastEventAt'] = new Date().toISOString();

    var r = parsePushEvent(body);
    if (r.unknown) {
      markProcessed_(sheetId, config, [{ gmail_id: 'push:' + (body.id || ''), resultado: 'unknown', tipo: 'push' }]);
      tele['conexiones.iphone.lastError'] = 'no_pattern: ' + String(r.text || r.reason || '').slice(0, 80);
      setAjustes_(sheetId, config, tele);
      return webJson_({ ok: true, stored: false, reason: r.reason });
    }
    var res = appendTransactions_(sheetId, config, [r]);
    markProcessed_(sheetId, config, [{ gmail_id: 'push:' + (body.id || ''), resultado: res.added ? 'tx' : 'dup', tipo: r.type }]);
    tele['conexiones.iphone.lastError'] = '';
    setAjustes_(sheetId, config, tele);
    return webJson_({ ok: true, stored: res.added === 1, id: r.id, kind: r.kind, amount: r.amount, fuzzy: res.fuzzy || 0 });
  } catch (err) {
    try { setAjustes_(sheetId, config, { 'conexiones.iphone.lastError': String(err && err.message || err).slice(0, 120) }); } catch (e2) {}
    return webJson_({ ok: false, error: 'internal', message: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
