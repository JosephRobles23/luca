// La plantilla oficial ("Luca Template") nunca guarda datos: si alguien ejecuta Luca dentro de ella, no se
// instalan triggers, no se escanea Gmail ni se aceptan eventos del iPhone o del MCP. Lo que se escriba ahí
// lo heredan todas las copias nuevas (incidente del 2026-10-06).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const TPL = '1kQWNaj9J29LRK-LsdCAxrplW06heaTvS3Hje3NV1htg';
const SID = 'sheet-1';
const EXEC = 'https://script.google.com/macros/s/TEST/exec';
const reciente = toGmailApi({ ...emails.bcp_card_purchase_pen, date: new Date(Date.now() - 3 * 86400 * 1000) });
const post = (h, sid, params, body) =>
  JSON.parse(h.api.webAction('post', { parameter: params, postData: { contents: JSON.stringify(body) } }, sid, configFor(h, sid)).getContent());
const plano = (x) => JSON.parse(JSON.stringify(x));

test('esPlantillaOficial_ reconoce solo el ID de la plantilla oficial', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  assert.equal(h.api.esPlantillaOficial_(TPL), true);
  assert.equal(h.api.esPlantillaOficial_(SID), false);
  assert.equal(h.api.esPlantillaOficial_(''), false);
  assert.equal(h.api.esPlantillaOficial_(undefined), false);
});

test('Autorizar en la plantilla: no instala el trigger, no importa Gmail y avisa que hay que crear una copia', () => {
  const h = makeHarness({ spreadsheets: { [TPL]: {} }, gmailMessages: [reciente] });
  let llamadas = 0;
  const r = h.api.menuAction('lucaMenu1', TPL, configFor(h, TPL), () => { llamadas++; });
  assert.equal(r.modo, 'plantilla');
  assert.equal(llamadas, 0, 'setupTriggers no se llama');
  assert.equal(h.gmail._calls.list.length, 0, 'no toca Gmail');
  assert.equal(h.tab(TPL, 'Movimientos'), undefined, 'no crea Movimientos');
  const a = configFor(h, TPL).ajustes;
  assert.equal(a['gmail.cursor'], '');
  assert.equal(a['triggers.installedAt'], '');
  assert.equal(h.alerts.length, 1);
  assert.match(h.alerts[0][1], /plantilla oficial/);
  assert.match(h.alerts[0][1], /lucaa\.lat/);
});

test('El trigger (runDispatcher) no hace nada en la plantilla, aunque ya tuviera cursor', () => {
  const h = makeHarness({ spreadsheets: { [TPL]: {} }, gmailMessages: [reciente] });
  h.api.setAjustes_(TPL, configFor(h, TPL), { 'gmail.cursor': String(Math.floor(Date.now() / 1000) - 86400) });
  const r = h.api.runDispatcher(TPL, configFor(h, TPL));
  assert.deepEqual(plano(r), { skipped: 'plantilla' });
  assert.equal(h.gmail._calls.list.length, 0);
  assert.equal(h.tab(TPL, 'Movimientos'), undefined);
});

test('Web App de la plantilla: GET responde, pero los POST (iPhone y MCP) se rechazan sin escribir', () => {
  const h = makeHarness({ execUrl: EXEC, spreadsheets: { [TPL]: {} } });
  h.api.setAjustes_(TPL, configFor(h, TPL), { 'conexiones.iphone.token': 'tok' });
  const get = JSON.parse(h.api.webAction('get', { parameter: {} }, TPL, configFor(h, TPL)).getContent());
  assert.equal(get.ok, true);
  const ev = { schema_version: '1', id: 'e-1', source: 'yape', token: 'tok', title: 'Confirmación de Pago',
    body: 'Yape! MARIA LOPEZ te envió un pago por S/ 1.5', device: 'iPhone' };
  assert.deepEqual(post(h, TPL, { events: '1' }, ev), { ok: false, error: 'template' });
  assert.deepEqual(post(h, TPL, { events: '1' }, { ...ev, source: 'test' }), { ok: false, error: 'template' });
  assert.deepEqual(post(h, TPL, { mcp: '1' }, { jsonrpc: '2.0', id: 1, method: 'tools/list' }), { ok: false, error: 'template' });
  assert.equal(h.tab(TPL, 'Movimientos'), undefined);
  const a = configFor(h, TPL).ajustes;
  assert.equal(a['conexiones.iphone.eventsCount'], '0');
  assert.equal(a['conexiones.iphone.lastTestAt'], '');
});

test('lucaRun en la plantilla: lo que escribe datos o conecta cuentas falla con un mensaje claro', () => {
  const h = makeHarness({ execUrl: EXEC, spreadsheets: { [TPL]: {} }, gmailMessages: [reciente] });
  for (const fn of ['escanearAhora', 'iniciarImportacion', 'conectarIphone', 'regenerarTokenIphone', 'generarPromptIphone',
    'guardarAjustes', 'guardarExecUrl', 'guardarLlmKey', 'recategorizar', 'categorizarPendientes', 'extraerDesconocidos']) {
    assert.throws(() => h.api.dispatch(fn, [{}], TPL, configFor(h, TPL)), /plantilla oficial/, fn);
  }
  // Las funciones de MCP (tabla aparte) tampoco pasan.
  const mcp = Object.keys(h.api.MCP_DISPATCH_ || {});
  assert.ok(mcp.length > 0);
  for (const fn of mcp) assert.throws(() => h.api.dispatch(fn, [], TPL, configFor(h, TPL)), /plantilla oficial/, fn);
  assert.equal(h.gmail._calls.list.length, 0);
  assert.equal(configFor(h, TPL).ajustes['conexiones.iphone.token'], '');
});

test('lucaRun en la plantilla: lectura, estilo y paneles siguen funcionando para mantenerla', () => {
  const h = makeHarness({ execUrl: EXEC, spreadsheets: { [TPL]: {} } });
  assert.equal(h.api.dispatch('estadoLedger', [], TPL, configFor(h, TPL)).total, 0);
  assert.ok(Array.isArray(h.api.dispatch('aplicarEstiloHojas', [], TPL, configFor(h, TPL)).hojas));
  const st = h.api.dispatch('estadoLuca', [], TPL, configFor(h, TPL));
  assert.equal(st.plantilla, true);
  assert.equal(st.execUrl, '', 'no expone la URL del Web App de la plantilla');
  assert.equal(configFor(h, TPL).ajustes['conexiones.execUrl'], '', 'ni la guarda en Ajustes (se copiaría)');
});

test('Una copia normal no cambia: estadoLuca dice plantilla:false y guarda su URL', () => {
  const h = makeHarness({ execUrl: EXEC, spreadsheets: { [SID]: {} } });
  const st = h.api.dispatch('estadoLuca', [], SID, configFor(h, SID));
  assert.equal(st.plantilla, false);
  assert.equal(st.execUrl, EXEC);
});

test('El sidebar muestra un aviso fijo cuando estadoLuca dice plantilla:true', () => {
  const html = fs.readFileSync(new URL('../gas/shared/Sidebar.html', import.meta.url), 'utf8');
  assert.match(html, /id="avisoPlantilla" hidden/);
  assert.match(html, /\$\('avisoPlantilla'\)\.hidden = !s\.plantilla;/);
});
