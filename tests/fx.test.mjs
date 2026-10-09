/**
 * Tipo de cambio automático (ADR-012, fx-runtime.js): lectura del BCRP con desafío de Imperva, respaldo
 * open.er-api, pestaña `_TipoCambio`, tipo por fecha y su uso en el MCP y el dashboard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';

const plain = (x) => JSON.parse(JSON.stringify(x));
const SID = 'S';
const AHORA = Date.parse('2026-10-09T10:00:00-05:00');

/** Respuesta sintética con la forma real de BCRPData (series compra, venta, EUR). */
function bcrpJson(periods) {
  return JSON.stringify({
    config: { title: 'Tipo de cambio', series: [{ name: 'Compra' }, { name: 'Venta' }, { name: 'EUR' }] },
    periods: periods.map(([name, c, v, e]) => ({ name, values: [c, v, e] }))
  });
}
const BCRP_OK = bcrpJson([
  ['02.Oct.26', '3.437', '3.442', '4.087'],
  ['05.Oct.26', '3.423', '3.435', '4.001'],
  ['06.Oct.26', '3.431', '3.437', '3.879'],
  ['07.Oct.26', 'n.d.', 'n.d.', 'n.d.']
]);
// El desafío de Imperva llega con HTTP 200 y HTML (S8): el status no sirve para detectarlo.
const IMPERVA = '<!DOCTYPE html>\n<html>\n<head><script src="/oly-Almost-That" async></script>\n<title></title>\n</head>\n<body>\n</body>\n</html>';
const ERAPI_OK = JSON.stringify({ result: 'success', time_last_update_utc: 'Fri, 09 Oct 2026 00:02:31 +0000', rates: { USD: 1, PEN: 3.4433, EUR: 0.8929 } });

function resp(body, code = 200) { return { getResponseCode: () => code, getContentText: () => body }; }

/** fetch que responde según la URL: `bcrp` es una lista de cuerpos que se consumen en orden. */
function fetchMock({ bcrp = [BCRP_OK], erapi = ERAPI_OK } = {}) {
  const cola = bcrp.slice();
  return (url) => {
    if (url.indexOf('estadisticas.bcrp.gob.pe') >= 0) {
      const b = cola.length > 1 ? cola.shift() : cola[0];
      if (b instanceof Error) throw b;
      return resp(b);
    }
    if (url.indexOf('open.er-api.com') >= 0) { if (erapi instanceof Error) throw erapi; return resp(erapi); }
    throw new Error('URL no esperada ' + url);
  };
}

function harness({ fetch, ajustes = [['key', 'value']], tipoCambio, movimientos } = {}) {
  const h0 = makeHarness();
  const headers = h0.api.LEDGER_HEADERS_.slice();
  const tabs = { Ajustes: ajustes, Movimientos: [headers, ...(movimientos || []).map((m) => headers.map((k) => (m[k] == null ? '' : m[k])))] };
  if (tipoCambio) tabs._TipoCambio = tipoCambio;
  return makeHarness({ spreadsheets: { [SID]: tabs }, fetch });
}
const FX_HEAD = ['fecha', 'usd_compra', 'usd_venta', 'eur_venta', 'fuente', 'leido_en'];

// --- Parseo ---

test('fxFechaBcrp_: DD.Mmm.YY con meses en español (y en inglés por si acaso)', () => {
  const h = makeHarness();
  assert.equal(h.api.fxFechaBcrp_('06.Oct.26'), '2026-10-06');
  assert.equal(h.api.fxFechaBcrp_('28.Set.26'), '2026-09-28');
  assert.equal(h.api.fxFechaBcrp_('03.Ene.25'), '2025-01-03');
  assert.equal(h.api.fxFechaBcrp_('15.Dic.24'), '2024-12-15');
  assert.equal(h.api.fxFechaBcrp_('15.Aug.24'), '2024-08-15');
  assert.equal(h.api.fxFechaBcrp_('basura'), '');
});

test('fxParseBcrp_: descarta n.d., valores a número; HTML de Imperva → null', () => {
  const h = makeHarness();
  assert.deepEqual(plain(h.api.fxParseBcrp_(BCRP_OK)), [
    { fecha: '2026-10-02', usd_compra: 3.437, usd_venta: 3.442, eur_venta: 4.087 },
    { fecha: '2026-10-05', usd_compra: 3.423, usd_venta: 3.435, eur_venta: 4.001 },
    { fecha: '2026-10-06', usd_compra: 3.431, usd_venta: 3.437, eur_venta: 3.879 }
  ]);
  assert.equal(h.api.fxParseBcrp_(IMPERVA), null);
  assert.equal(h.api.fxParseBcrp_('{"config":{}}'), null);
  // Solo el EUR sin dato: la fila vale (el EUR queda vacío).
  assert.deepEqual(plain(h.api.fxParseBcrp_(bcrpJson([['06.Oct.26', '3.431', '3.437', 'n.d.']]))),
    [{ fecha: '2026-10-06', usd_compra: 3.431, usd_venta: 3.437, eur_venta: '' }]);
  // Todo n.d. (fin de semana largo): respuesta válida pero sin filas.
  assert.deepEqual(plain(h.api.fxParseBcrp_(bcrpJson([['07.Oct.26', 'n.d.', 'n.d.', 'n.d.']]))), []);
});

// --- Lectura con reintento y respaldo ---

test('actualizarTipoCambio_: lee el BCRP y guarda `_TipoCambio` ordenada; telemetría en Ajustes', () => {
  const h = harness({ fetch: fetchMock() });
  const r = plain(h.api.actualizarTipoCambio_(SID, configFor(h, SID), { ahora: AHORA }));
  assert.equal(r.fuente, 'bcrp');
  assert.equal(r.filas, 3);
  const url = h.fetchCalls[0].url;
  assert.match(url, /\/series\/api\/PD04639PD-PD04640PD-PD04648PD\/json\/2026-9-9\/2026-10-9\/esp$/);
  const tab = h.tab(SID, '_TipoCambio');
  assert.deepEqual(tab[0], FX_HEAD);
  assert.deepEqual(tab.slice(1).map((f) => [f[0], f[2], f[4]]), [['2026-10-02', 3.442, 'bcrp'], ['2026-10-05', 3.435, 'bcrp'], ['2026-10-06', 3.437, 'bcrp']]);
  const a = h.api.getAjustes_(SID, configFor(h, SID));
  assert.equal(a['fx.ultimo'], '3.437 (2026-10-06)');
  assert.equal(a['fx.fuente'], 'bcrp');
  assert.equal(a['fx.lastError'], '');
  assert.ok(a['fx.lastRunAt']);
});

test('actualizarTipoCambio_: el desafío de Imperva (200 + HTML) se reintenta', () => {
  const h = harness({ fetch: fetchMock({ bcrp: [IMPERVA, BCRP_OK] }) });
  const r = plain(h.api.actualizarTipoCambio_(SID, configFor(h, SID), { ahora: AHORA }));
  assert.equal(r.fuente, 'bcrp');
  assert.equal(h.fetchCalls.filter((c) => c.url.indexOf('bcrp') >= 0).length, 2);
  assert.equal(h.fetchCalls.filter((c) => c.url.indexOf('er-api') >= 0).length, 0);
});

test('actualizarTipoCambio_: si el BCRP falla 3 veces, guarda solo hoy desde open.er-api y anota el error', () => {
  const h = harness({ fetch: fetchMock({ bcrp: [IMPERVA] }) });
  const r = plain(h.api.actualizarTipoCambio_(SID, configFor(h, SID), { ahora: AHORA }));
  assert.equal(r.fuente, 'er-api');
  assert.equal(h.fetchCalls.filter((c) => c.url.indexOf('bcrp') >= 0).length, 3);
  const tab = h.tab(SID, '_TipoCambio');
  assert.equal(tab.length, 2);
  assert.deepEqual([tab[1][0], tab[1][1], tab[1][2], tab[1][3], tab[1][4]], ['2026-10-09', 3.4433, 3.4433, 3.8563, 'er-api']);
  const a = h.api.getAjustes_(SID, configFor(h, SID));
  assert.equal(a['fx.fuente'], 'er-api');
  assert.match(a['fx.lastError'], /BCRP/);
});

test('actualizarTipoCambio_: sin ninguna fuente no lanza y deja el error', () => {
  const h = harness({ fetch: fetchMock({ bcrp: [new Error('timeout')], erapi: new Error('dns') }) });
  const r = plain(h.api.actualizarTipoCambio_(SID, configFor(h, SID), { ahora: AHORA }));
  assert.equal(r.fuente, '');
  assert.equal(h.tab(SID, '_TipoCambio'), undefined);
  assert.match(h.api.getAjustes_(SID, configFor(h, SID))['fx.lastError'], /er-api/);
});

test('actualizarTipoCambio_: una lectura correcta al día; tras un error, reintenta pasada la hora', () => {
  const ok = harness({ fetch: fetchMock() });
  ok.api.actualizarTipoCambio_(SID, configFor(ok, SID), { ahora: AHORA });
  const r2 = plain(ok.api.actualizarTipoCambio_(SID, configFor(ok, SID), { ahora: AHORA + 3 * 3600e3 }));
  assert.equal(r2.skipped, 'al-dia');
  assert.equal(ok.fetchCalls.length, 1);
  // Al día siguiente vuelve a leer, desde el último día guardado.
  ok.api.actualizarTipoCambio_(SID, configFor(ok, SID), { ahora: AHORA + 24 * 3600e3 });
  assert.match(ok.fetchCalls[1].url, /\/2026-10-6\/2026-10-10\/esp$/);

  const ko = harness({ fetch: fetchMock({ bcrp: [new Error('x')], erapi: new Error('y') }) });
  ko.api.actualizarTipoCambio_(SID, configFor(ko, SID), { ahora: AHORA });
  const n = ko.fetchCalls.length;
  assert.equal(plain(ko.api.actualizarTipoCambio_(SID, configFor(ko, SID), { ahora: AHORA + 20 * 60e3 })).skipped, 'reintento-luego');
  assert.equal(ko.fetchCalls.length, n);
  ko.api.actualizarTipoCambio_(SID, configFor(ko, SID), { ahora: AHORA + 61 * 60e3 });
  assert.ok(ko.fetchCalls.length > n);
});

test('actualizarTipoCambio_: pide el histórico si hay USD sin tipo de cambio anteriores a la tabla', () => {
  const h = harness({
    fetch: fetchMock(),
    tipoCambio: [FX_HEAD, ['2026-10-01', 3.44, 3.45, 4.0, 'bcrp', '']],
    movimientos: [
      { id: 'u1', fecha: '2025-03-15T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'USD' },
      { id: 'u2', fecha: '2024-01-15T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'USD', tipo_cambio: 3.7 }, // trae su TC
      { id: 'p1', fecha: '2023-01-15T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'PEN' }
    ]
  });
  h.api.actualizarTipoCambio_(SID, configFor(h, SID), { ahora: AHORA });
  assert.match(h.fetchCalls[0].url, /\/2025-3-15\/2026-10-9\/esp$/);
});

test('fxGuardar_: una fila bcrp reemplaza a una er-api del mismo día, nunca al revés', () => {
  const h = harness({ tipoCambio: [FX_HEAD, ['2026-10-06', 3.44, 3.44, 3.85, 'er-api', ''], ['2026-10-08', 3.43, 3.43, 3.9, 'bcrp', '']] });
  h.api.fxGuardar_(SID, [{ fecha: '2026-10-06', usd_compra: 3.431, usd_venta: 3.437, eur_venta: 3.879 }], 'bcrp', AHORA);
  h.api.fxGuardar_(SID, [{ fecha: '2026-10-08', usd_compra: 9, usd_venta: 9, eur_venta: 9 }], 'er-api', AHORA);
  const tab = h.tab(SID, '_TipoCambio').slice(1);
  assert.deepEqual(tab.map((f) => [f[0], f[2], f[4]]), [['2026-10-06', 3.437, 'bcrp'], ['2026-10-08', 3.43, 'bcrp']]);
});

// --- Qué tipo se aplica ---

const TABLA = [FX_HEAD, ['2026-10-02', 3.437, 3.442, 4.087, 'bcrp', ''], ['2026-10-05', 3.423, 3.435, 4.001, 'bcrp', ''], ['2026-10-06', 3.431, 3.437, 3.879, 'bcrp', '']];

test('fxUsdEn_: venta del día, del día anterior con dato, el primero si es más antiguo; null sin tabla', () => {
  const h = harness({ tipoCambio: TABLA });
  const t = h.api.fxTabla_(SID);
  assert.equal(h.api.fxUsdEn_(t, '2026-10-05T12:00:00-05:00'), 3.435);
  assert.equal(h.api.fxUsdEn_(t, '2026-10-04'), 3.442);     // domingo → viernes 02
  assert.equal(h.api.fxUsdEn_(t, '2026-10-09'), 3.437);     // más reciente que el último dato
  assert.equal(h.api.fxUsdEn_(t, '2026-01-01'), 3.442);     // antes del primero → el primero
  assert.equal(h.api.fxUsdEn_([], '2026-10-05'), null);
});

test('fxTabla_: tolera fechas que Sheets convirtió a Date', () => {
  const h = harness({ tipoCambio: [FX_HEAD, [new Date('2026-10-06T00:00:00-05:00'), 3.431, 3.437, 3.879, 'bcrp', '']] });
  assert.equal(plain(h.api.fxTabla_(SID))[0].fecha, '2026-10-06');
});

test('fxModo_: auto por defecto; manual si se eligió o si fx.usd_pen se había cambiado del 3.50', () => {
  const h = makeHarness();
  assert.equal(h.api.fxModo_({ 'fx.usd_pen': '3.50' }), 'auto');
  assert.equal(h.api.fxModo_({}), 'auto');
  assert.equal(h.api.fxModo_({ 'fx.usd_pen': '3.80' }), 'manual');
  assert.equal(h.api.fxModo_({ 'fx.usd_pen': '3.80', 'fx.modo': 'auto' }), 'auto');
  assert.equal(h.api.fxModo_({ 'fx.modo': 'manual' }), 'manual');
});

test('fxContexto_: respaldo = manual, último dato o fx.usd_pen; en manual no hay tipo por fecha', () => {
  const auto = harness({ tipoCambio: TABLA });
  const ca = auto.api.fxContexto_(SID, configFor(auto, SID));
  assert.equal(ca.respaldo, 3.437);
  assert.equal(ca.usdEn('2026-10-05T09:00:00-05:00'), 3.435);
  const man = harness({ tipoCambio: TABLA, ajustes: [['key', 'value'], ['fx.modo', 'manual'], ['fx.usd_pen', '3.9']] });
  const cm = man.api.fxContexto_(SID, configFor(man, SID));
  assert.equal(cm.respaldo, 3.9);
  assert.equal(cm.usdEn('2026-10-05'), null);
  const vacio = harness({});
  assert.equal(vacio.api.fxContexto_(SID, configFor(vacio, SID)).respaldo, 3.5);
});

// --- Consumidores ---

const MOVS = [
  { id: 'a', fecha: '2026-10-05T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'USD' },                    // BCRP 05 → 34.35
  { id: 'b', fecha: '2026-10-04T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'USD', tipo_cambio: 3.6 },  // TC del correo → 36
  { id: 'c', fecha: '2026-10-08T10:00:00-05:00', tipo: 'expense', monto: 10, moneda: 'PEN' }
];

test('MCP: monto_pen usa el TC del correo y si no, el BCRP del día; fx_usd_pen = último dato', () => {
  const h = harness({ tipoCambio: TABLA, movimientos: MOVS });
  const cfg = configFor(h, SID);
  const s = plain(h.api.MCP_OPS_.get_summary(SID, cfg, { month: '2026-10' }));
  assert.equal(s.expense, 80.35);
  assert.equal(s.fx_usd_pen, 3.437);
  const l = plain(h.api.MCP_OPS_.list_transactions(SID, cfg, { month: '2026-10' }));
  assert.equal(l.transactions.find((t) => t.id === 'a').monto_pen, 34.35);
});

test('Dashboard de la Sheet: mismo criterio', () => {
  const h = harness({ tipoCambio: TABLA, movimientos: MOVS });
  const r = plain(h.api.resumenDashboard(SID, configFor(h, SID), { mes: '2026-10', hoy: '2026-10-09' }));
  assert.equal(r.resumen.gasto, 80.35);
});

test('runDispatcher actualiza el tipo de cambio y un fallo no rompe la pasada', () => {
  const h = harness({ fetch: fetchMock({ bcrp: [new Error('x')], erapi: new Error('y') }) });
  const out = plain(h.api.runDispatcher(SID, configFor(h, SID)));
  assert.ok(out.fx);
  assert.equal(out.fx.fuente, '');
});

// --- Paridad con la web (apps/web/src/lib/fx.ts) ---

test('Paridad: fxModo_/fxUsdEn_/respaldo del script = fxModo/usdOn/fxContext de la web', async () => {
  const web = await import('../apps/web/src/lib/fx.ts');
  const h = harness({ tipoCambio: TABLA });
  const gas = h.api.fxTabla_(SID);
  const w = web.parseTipoCambio(TABLA.map((r) => r.map(String)));
  for (const f of ['2025-01-01', '2026-10-02', '2026-10-04', '2026-10-05T23:59:00-05:00', '2026-10-06', '2026-12-31']) {
    assert.equal(h.api.fxUsdEn_(gas, f), web.usdOn(w, f), f);
  }
  for (const a of [{}, { 'fx.usd_pen': '3.50' }, { 'fx.usd_pen': '3.8' }, { 'fx.modo': 'manual' }, { 'fx.modo': 'auto', 'fx.usd_pen': '4' }]) {
    assert.equal(h.api.fxModo_(a), web.fxModo(a), JSON.stringify(a));
  }
  assert.equal(h.api.fxContexto_(SID, configFor(h, SID)).respaldo, web.fxContext({}, w).respaldo);
});
