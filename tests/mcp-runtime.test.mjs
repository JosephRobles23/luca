/**
 * mcp-runtime.test.mjs — API JSON del lado GAS que consume el Worker luca-mcp (gas/shared/mcp-runtime.js).
 * El Worker entra por webAction con ?mcp=1; aquí se prueba mcpAction directo y vía webAction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeHarness, configFor } from './gas-harness.mjs';

const SID = 'sheet-mcp';
const SECRET = 'S3CRET-de-prueba';
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b); // objetos del sandbox vm

const HEADERS = [
  'id', 'fecha', 'tipo', 'monto', 'moneda', 'tipo_cambio', 'comercio', 'contraparte', 'contraparte_key',
  'categoria', 'categoria_origen', 'medio', 'canal', 'fuente', 'operacion', 'gmail_id', 'flags', 'asunto', 'creado_en'
];
const row = (o) => HEADERS.map((h) => (o[h] === undefined ? '' : o[h]));

/** Ledger sintético: septiembre y octubre 2026, PEN y USD, todos los tipos. */
const LEDGER = [
  row({ id: 'bcp:1', fecha: '2026-10-01T09:00:00-05:00', tipo: 'expense', monto: 100, moneda: 'PEN', comercio: 'WONG', categoria: 'Supermercado', categoria_origen: 'rule', canal: 'qr', fuente: 'bcp_email' }),
  row({ id: 'bcp:2', fecha: '2026-10-02T12:30:00-05:00', tipo: 'expense', monto: 10, moneda: 'USD', tipo_cambio: 3.6, comercio: 'DLC*SPOTIFY', categoria: 'Suscripciones', fuente: 'bcp_email' }),
  row({ id: 'bcp:3', fecha: '2026-10-03T20:00:00-05:00', tipo: 'expense', monto: 20, moneda: 'USD', comercio: 'NETFLIX', fuente: 'bcp_email' }),                 // sin tipo_cambio → fx
  row({ id: 'yape:4', fecha: '2026-10-04T08:15:00-05:00', tipo: 'expense', monto: 50, moneda: 'PEN', contraparte: 'María P.', canal: 'yape_p2p', fuente: 'yape_email' }), // por categorizar
  row({ id: 'push:5', fecha: '2026-10-04T08:49:00-05:00', tipo: 'transfer_in', monto: 1.5, moneda: 'PEN', contraparte: 'GAVY R.', canal: 'yape_push', fuente: 'yape_push' }),
  row({ id: 'bcp:6', fecha: '2026-10-05T10:00:00-05:00', tipo: 'internal_transfer', monto: 500, moneda: 'PEN', fuente: 'bcp_email' }),
  row({ id: 'manual:7', fecha: '2026-10-06T00:00:00-05:00', tipo: 'income', monto: 3000, moneda: 'PEN', comercio: 'Sueldo', fuente: 'manual' }),
  row({ id: 'bcp:8', fecha: '2026-09-15T13:00:00-05:00', tipo: 'expense', monto: 80, moneda: 'PEN', comercio: 'WONG', categoria: 'Supermercado', fuente: 'bcp_email' })
];

function harness(opts = {}) {
  const h = makeHarness({
    spreadsheets: { [SID]: { Movimientos: [HEADERS, ...(opts.ledger || LEDGER)], Ajustes: opts.ajustes || [['key', 'value']] } },
    userProperties: opts.noSecret ? {} : { 'luca.mcp.secret': SECRET },
    fetch: opts.fetch
  });
  return h;
}

function call(h, op, extra = {}) {
  const body = Object.assign({ op }, extra);
  const e = { parameter: { mcp: '1' }, postData: { contents: JSON.stringify(body) } };
  return JSON.parse(h.api.mcpAction(e, SID, configFor(h, SID)).getContent());
}
const auth = (h, op, args = {}) => call(h, op, { secret: SECRET, args });

// --- Auth ---

test('sin secreto guardado → not-enrolled (y no se mira Script Properties)', () => {
  const h = harness({ noSecret: true });
  assert.deepEqual(call(h, 'get_summary', { secret: 'x', args: { month: '2026-10' } }), { ok: false, error: 'not-enrolled' });
  assert.equal(h.api.PropertiesService.getScriptProperties().getProperty('luca.mcp.secret'), null);
});

test('secreto que no cuadra → unauthorized; body no JSON → bad-request; op desconocida → unknown-op', () => {
  const h = harness();
  assert.deepEqual(call(h, 'get_summary', { secret: 'wrong', args: { month: '2026-10' } }), { ok: false, error: 'unauthorized' });
  const e = { parameter: { mcp: '1' }, postData: { contents: '{nope' } };
  assert.deepEqual(JSON.parse(h.api.mcpAction(e, SID, configFor(h, SID)).getContent()), { ok: false, error: 'bad-request' });
  assert.deepEqual(auth(h, 'drop_tables'), { ok: false, error: 'unknown-op' });
  assert.deepEqual(auth(h, 'appendTransactions_'), { ok: false, error: 'unknown-op' });
});

test('challenge firma el nonce con el secreto guardado (igual que hmacBase64 del Worker)', () => {
  const h = harness();
  const expected = Buffer.from(crypto.createHmac('sha256', SECRET).update('nonce-123').digest()).toString('base64');
  const r1 = call(h, 'challenge', { nonce: 'nonce-123' });
  assert.deepEqual(r1, { ok: true, sig: expected });
  assert.equal(call(h, 'challenge', { nonce: 'nonce-123' }).sig, expected);
  assert.notEqual(call(h, 'challenge', { nonce: 'otro' }).sig, expected);
  assert.deepEqual(call(h, 'challenge', {}), { ok: false, error: 'missing-nonce' });
});

test('webAction enruta POST ?mcp=1 a mcpAction', () => {
  const h = harness();
  const e = { parameter: { mcp: '1' }, postData: { contents: JSON.stringify({ op: 'challenge', nonce: 'n' }) } };
  const r = JSON.parse(h.api.webAction('post', e, SID, configFor(h, SID)).getContent());
  assert.equal(r.ok, true);
  assert.ok(r.sig);
});

// --- Ops de lectura ---

test('get_summary: transfer_in aparte, internal_transfer fuera, USD convertido', () => {
  const h = harness();
  const r = auth(h, 'get_summary', { month: '2026-10' });
  assert.equal(r.ok, true);
  assert.equal(r.month, '2026-10');
  // 100 + 10*3.6 + 20*3.5 + 50 = 256
  assert.equal(r.expense, 256);
  assert.equal(r.income, 3000);
  assert.equal(r.transferIn, 1.5);
  assert.equal(r.net, 2744);
  assert.equal(r.count, 7);
  assert.equal(r.pendingCount, 2); // NETFLIX y el yapeo enviado
  // NETFLIX (70) + yapeo (50) sin categoría; 100 Supermercado; 36 Suscripciones.
  eq(r.byCategory, [
    { name: 'Sin categoría', amount: 120, pct: 47, count: 2 },
    { name: 'Supermercado', amount: 100, pct: 39, count: 1 },
    { name: 'Suscripciones', amount: 36, pct: 14, count: 1 }
  ]);
  eq(r.topMerchants[0], { name: 'WONG', amount: 100, count: 1 });
  assert.ok(r.topMerchants.some((m) => m.name === 'María P.' && m.amount === 50));
  assert.equal(r.last6.length, 6);
  assert.equal(r.last6[5].month, '2026-10');
  assert.equal(r.last6[4].expense, 80);
  assert.equal(r.prevExpense, 80);
  assert.deepEqual(auth(h, 'get_summary', { month: '2026-13' }), { ok: false, error: 'invalid-month' });
});

test('get_summary respeta Ajustes.fx.usd_pen', () => {
  const h = harness({ ajustes: [['key', 'value'], ['fx.usd_pen', '4']] });
  // 100 + 10*3.6 (del correo) + 20*4 + 50 = 266
  assert.equal(auth(h, 'get_summary', { month: '2026-10' }).expense, 266);
});

test('category_breakdown y top_merchants', () => {
  const h = harness();
  const c = auth(h, 'category_breakdown', { month: '2026-10' });
  assert.equal(c.expense, 256);
  eq(c.categories, [
    { name: 'Sin categoría', amount: 120, pct: 47, count: 2 },
    { name: 'Supermercado', amount: 100, pct: 39, count: 1 },
    { name: 'Suscripciones', amount: 36, pct: 14, count: 1 }
  ]);
  const t = auth(h, 'top_merchants', { month: '2026-10', limit: 2 });
  eq(t.merchants, [{ name: 'WONG', amount: 100, count: 1 }, { name: 'NETFLIX', amount: 70, count: 1 }]);
  assert.equal(auth(h, 'top_merchants', { month: '2026-10' }).merchants.length, 4);
  assert.equal(auth(h, 'top_merchants', { month: '2026-10', limit: 999 }).merchants.length, 4);
});

test('list_transactions: filtros, orden descendente, límite y monto_pen', () => {
  const h = harness();
  const all = auth(h, 'list_transactions', {});
  assert.equal(all.total, 8);
  assert.equal(all.transactions[0].id, 'manual:7');
  assert.equal(all.transactions[7].id, 'bcp:8');

  const oct = auth(h, 'list_transactions', { month: '2026-10', tipo: 'expense' });
  assert.deepEqual(oct.transactions.map((t) => t.id), ['yape:4', 'bcp:3', 'bcp:2', 'bcp:1']);
  assert.equal(oct.transactions.find((t) => t.id === 'bcp:2').monto_pen, 36);
  assert.deepEqual(oct.transactions.find((t) => t.id === 'yape:4').flags, []);

  const rango = auth(h, 'list_transactions', { from: '2026-10-02', to: '2026-10-04' });
  assert.deepEqual(rango.transactions.map((t) => t.id), ['push:5', 'yape:4', 'bcp:3', 'bcp:2']);

  assert.deepEqual(auth(h, 'list_transactions', { categoria: 'supermercado' }).transactions.map((t) => t.id), ['bcp:1', 'bcp:8']);
  assert.deepEqual(auth(h, 'list_transactions', { texto: 'maría' }).transactions.map((t) => t.id), ['yape:4']);
  assert.deepEqual(auth(h, 'list_transactions', { texto: 'wong', limit: 1 }), { ok: true, total: 2, returned: 1, transactions: [JSON.parse(JSON.stringify(auth(h, 'list_transactions', { texto: 'wong' }).transactions[0]))] });

  assert.deepEqual(auth(h, 'list_transactions', { tipo: 'rejected' }), { ok: false, error: 'invalid-tipo' });
  assert.deepEqual(auth(h, 'list_transactions', { from: '2026-10' }), { ok: false, error: 'invalid-from' });
});

test('budget_status responde available:false en v0', () => {
  const r = auth(harness(), 'budget_status', { month: '2026-10' });
  assert.equal(r.ok, true);
  assert.equal(r.available, false);
  assert.equal(r.month, '2026-10');
});

// --- add_expense ---

test('add_expense valida, escribe una fila manual y la devuelve', () => {
  const h = harness();
  const r = auth(h, 'add_expense', { monto: 12.5, fecha: '2026-10-07T13:05', comercio: ' Bodega  Don Lucho ', categoria: 'Comida', nota: 'menú' });
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
  assert.equal(r.duplicate, false);
  assert.match(r.id, /^manual:uuid-/);
  assert.equal(r.transaction.fecha, '2026-10-07T13:05:00-05:00');
  assert.equal(r.transaction.comercio, 'Bodega Don Lucho');
  assert.equal(r.transaction.categoria_origen, 'user');
  assert.equal(r.transaction.fuente, 'manual');
  const data = h.tab(SID, 'Movimientos');
  const fila = data[data.length - 1];
  assert.equal(fila[HEADERS.indexOf('asunto')], 'menú');
  assert.equal(fila[HEADERS.indexOf('monto')], 12.5);
  assert.equal(auth(h, 'get_summary', { month: '2026-10' }).expense, 268.5);

  assert.deepEqual(auth(h, 'add_expense', { monto: 0, fecha: '2026-10-07' }), { ok: false, error: 'invalid-monto' });
  assert.deepEqual(auth(h, 'add_expense', { monto: 5, moneda: 'EUR', fecha: '2026-10-07' }), { ok: false, error: 'invalid-moneda' });
  assert.deepEqual(auth(h, 'add_expense', { monto: 5, fecha: 'ayer' }), { ok: false, error: 'invalid-fecha' });
  assert.deepEqual(auth(h, 'add_expense', { monto: 5, fecha: '2026-02-30' }), { ok: false, error: 'invalid-fecha' });
});

test('add_expense: dedupe por clave difusa (minuto) y force', () => {
  const h = harness();
  // Mismo monto/moneda/minuto que yape:4 (50 PEN, 08:15)
  const dup = auth(h, 'add_expense', { monto: 50, fecha: '2026-10-04T08:15:30-05:00', contraparte: 'María' });
  assert.equal(dup.ok, true);
  assert.equal(dup.added, 0);
  assert.equal(dup.duplicate, true);
  assert.deepEqual(dup.similar.map((t) => t.id), ['yape:4']);
  assert.equal(h.tab(SID, 'Movimientos').length, LEDGER.length + 1);
  // Otro minuto → no es duplicado.
  assert.equal(auth(h, 'add_expense', { monto: 50, fecha: '2026-10-04T08:16', contraparte: 'María' }).added, 1);
  // Con force se escribe igual.
  const forced = auth(h, 'add_expense', { monto: 50, fecha: '2026-10-04T08:15', contraparte: 'María', force: true });
  assert.equal(forced.added, 1);
  assert.equal(forced.transaction.contraparte, 'María');
});

test('add_expense con solo fecha: dedupe por día, flag date_only, USD', () => {
  const h = harness();
  const dup = auth(h, 'add_expense', { monto: 10, moneda: 'USD', fecha: '2026-10-02', comercio: 'Spotify' });
  assert.equal(dup.duplicate, true);
  assert.deepEqual(dup.similar.map((t) => t.id), ['bcp:2']);
  const ok = auth(h, 'add_expense', { monto: 10, moneda: 'USD', fecha: '2026-10-09', comercio: 'Spotify' });
  assert.equal(ok.added, 1);
  assert.deepEqual(ok.transaction.flags, ['date_only']);
  assert.equal(ok.transaction.monto_pen, 35);
  assert.equal(ok.transaction.fecha, '2026-10-09T00:00:00-05:00');
});

// --- Sidebar ---

test('cargarMcp: default del Worker, Web App pendiente, no conectado', () => {
  const h = harness({ noSecret: true });
  const st = h.api.cargarMcp(SID, configFor(h, SID));
  assert.equal(st.workerUrl, 'https://mcp.lucaa.lat');
  assert.equal(st.connectorUrl, 'https://mcp.lucaa.lat/mcp');
  assert.equal(st.connected, false);
  assert.equal(st.webApp.ready, false);
  assert.throws(() => h.api.iniciarConexionMcp(SID, configFor(h, SID)), /Web App/);
  assert.equal(h.fetchCalls.length, 0);
});

test('iniciarConexionMcp genera el secreto por usuario, llama /enroll y devuelve el código', () => {
  const EXEC = 'https://script.google.com/macros/s/AKfycb-xyz/exec';
  const h = harness({
    noSecret: true,
    ajustes: [['key', 'value'], ['conexiones.execUrl', EXEC], ['conexiones.workerUrl', 'https://mcp.ejemplo.test/']],
    fetch: (url, options) => {
      const body = JSON.parse(options.payload);
      assert.equal(url, 'https://mcp.ejemplo.test/enroll');
      assert.equal(body.webAppUrl, EXEC);
      assert.match(body.secret, /^[0-9a-z]+$/); // dos UUID sin guiones (en el mock: 'uuid1uuid2')
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true, code: 'ABCD2345', expiresInSeconds: 600 }) };
    }
  });
  const cfg = configFor(h, SID);
  assert.equal(h.api.cargarMcp(SID, cfg).webApp.ready, true);
  const r = h.api.MCP_DISPATCH_.iniciarConexionMcp(SID, cfg, []);
  eq(r, { code: 'ABCD2345', expiresInSeconds: 600, connectorUrl: 'https://mcp.ejemplo.test/mcp', authorizeUrl: 'https://mcp.ejemplo.test/authorize' });
  const secret = h.userProps.get('luca.mcp.secret');
  assert.ok(secret && secret.length >= 8);
  assert.equal(h.api.PropertiesService.getScriptProperties().getProperty('luca.mcp.secret'), null);
  // El secreto generado es el que firma el challenge.
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update('n1').digest()).toString('base64');
  assert.equal(call(h, 'challenge', { nonce: 'n1' }).sig, expected);
  // Reintentar no cambia el secreto.
  h.api.MCP_DISPATCH_.iniciarConexionMcp(SID, cfg, []);
  assert.equal(h.userProps.get('luca.mcp.secret'), secret);
  assert.equal(h.api.cargarMcp(SID, cfg).connected, true);
  // Desconectar → not-enrolled.
  eq(h.api.MCP_DISPATCH_.desconectarMcp(SID, cfg, []), { ok: true, connected: false });
  assert.equal(h.userProps.has('luca.mcp.secret'), false);
  assert.deepEqual(call(h, 'challenge', { nonce: 'n1' }), { ok: false, error: 'not-enrolled' });
});

test('iniciarConexionMcp traduce el rechazo del Worker', () => {
  const EXEC = 'https://script.google.com/macros/s/AKfycb-xyz/exec';
  const h = harness({
    ajustes: [['key', 'value'], ['conexiones.execUrl', EXEC]],
    fetch: () => ({ getResponseCode: () => 400, getContentText: () => JSON.stringify({ ok: false, error: 'challenge-failed' }) })
  });
  assert.throws(() => h.api.iniciarConexionMcp(SID, configFor(h, SID)), /challenge-failed/);
  // Antes del /enroll, Luca verifica qué URL /exec responde (GET a la candidata).
  assert.ok(h.fetchCalls.some((c) => c.url === 'https://mcp.lucaa.lat/enroll'));
});

test('MCP_DISPATCH_ tiene la forma de DISPATCH_ (fn(sid, cfg, args))', () => {
  const h = harness({ noSecret: true });
  assert.deepEqual(Object.keys(h.api.MCP_DISPATCH_).sort(), ['cargarMcp', 'desconectarMcp', 'iniciarConexionMcp', 'probarWebApp']);
  Object.values(h.api.MCP_DISPATCH_).forEach((fn) => assert.equal(typeof fn, 'function'));
  assert.equal(h.api.MCP_DISPATCH_.cargarMcp(SID, configFor(h, SID), []).connected, false);
});

test('probarWebApp: diagnostica HTML (acceso incorrecto), versión vieja y OK', () => {
  const exec = 'https://script.google.com/macros/s/TEST/exec';
  const mk = (fetch) => { const h = makeHarness({ execUrl: exec, spreadsheets: { [SID]: {} }, fetch }); return h; };
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  // HTML de login → no JSON
  let h = mk(() => resp(200, '<html>Google Accounts</html>'));
  let r = h.api.probarWebApp(SID, configFor(h, SID));
  assert.match(r.veredicto, /Cualquiera/);
  // versión vieja
  h = mk((url) => url.indexOf('mcp=1') > -1 ? resp(200, { ok: false, error: 'mcp-not-available' }) : resp(200, { ok: true }));
  r = h.api.probarWebApp(SID, configFor(h, SID));
  assert.match(r.veredicto, /versión vieja/);
  // OK: el mock firma con el secreto guardado (lo generamos antes para conocerlo)
  h = mk(() => resp(200, { ok: true }));
  h.api.setSecret_('mcpSecret', 'secreto-fijo');
  h.setFetch?.(() => {});
  const h2 = makeHarness({ execUrl: exec, spreadsheets: { [SID]: {} }, userProperties: { 'luca.mcp.secret': 'secreto-fijo' }, fetch: (url, o) => {
    if (url.indexOf('mcp=1') < 0) return resp(200, { ok: true, app: 'luca' });
    const body = JSON.parse(o.payload); const sig = Buffer.from(Uint8Array.from(h2.api.Utilities.computeHmacSha256Signature(body.nonce, 'secreto-fijo'))).toString('base64');
    return resp(200, { ok: true, sig });
  } });
  r = h2.api.probarWebApp(SID, configFor(h2, SID));
  assert.match(r.veredicto, /^OK/);
  assert.equal(h2.userProps.get('luca.mcp.secret'), 'secreto-fijo');
});

test('URL del Web App: con varias implementaciones gana la que responde, aunque getService() devuelva la rota', () => {
  const rota = 'https://script.google.com/macros/s/ROTA/exec';
  const buena = 'https://script.google.com/macros/s/BUENA/exec';
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const fetch = (url) => url.startsWith(buena) ? resp(200, { ok: true, app: 'luca', version: '14' }) : resp(404, '<html>Not Found</html>');
  const h = makeHarness({ execUrl: rota, spreadsheets: { [SID]: { Ajustes: [['key', 'value'], ['conexiones.execUrl', buena]] } }, fetch });
  const r = h.api.resolverExecUrl_(SID, configFor(h, SID));
  assert.equal(r.url, buena); assert.equal(r.verified, true);
  // Tras verificar, la URL viva (rota) ya no pisa a la verificada, ni en el escaneo.
  const cfg2 = configFor(h, SID);
  assert.equal(h.api.execUrl_(cfg2), buena);
  assert.equal(h.api.syncExecUrl_(SID, cfg2), buena);
  // Guardado manual: valida y rechaza URLs que no responden.
  assert.throws(() => h.api.guardarExecUrl(SID, cfg2, rota), /no responde/);
  assert.equal(h.api.guardarExecUrl(SID, cfg2, buena).ok, true);
});

test('URL del Web App: tras una "Nueva implementación" gana la nueva aunque la vieja (verificada) siga respondiendo', () => {
  const vieja = 'https://script.google.com/macros/s/VIEJA/exec';
  const nueva = 'https://script.google.com/macros/s/NUEVA/exec';
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  // Las dos responden: las implementaciones viejas no se archivan solas.
  const fetch = () => resp(200, { ok: true, app: 'luca' });
  const h = makeHarness({ execUrl: nueva, spreadsheets: { [SID]: { Ajustes: [['key', 'value'],
    ['conexiones.execUrl', vieja], ['conexiones.mcp.execUrl', vieja], ['conexiones.execUrl.verifiedAt', '2026-10-01T00:00:00Z']] } }, fetch });
  const r = h.api.resolverExecUrl_(SID, configFor(h, SID));
  assert.equal(r.url, nueva); assert.equal(r.verified, true);
  assert.equal(configFor(h, SID).ajustes['conexiones.execUrl'], nueva);
  // La que pegó el usuario a mano sigue mandando sobre la viva.
  h.api.guardarExecUrl(SID, configFor(h, SID), vieja);
  assert.equal(h.api.resolverExecUrl_(SID, configFor(h, SID)).url, vieja);
});
