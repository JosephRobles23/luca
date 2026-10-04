import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const DAY = 86400;

// Fechas relativas a hoy para que el "último mes" tenga sentido.
const hace = (dias) => new Date(Date.now() - dias * DAY * 1000);
const reciente = toGmailApi({ ...emails.bcp_card_purchase_pen, date: hace(3) });

test('Autorizar (primera vez): instala el trigger vía callback del stub, importa el último mes y avisa', () => {
  // El mock de Gmail no filtra por fecha: lo que se comprueba es la query (after ≈ hoy − 31 d).
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [reciente] });
  const llamadas = [];
  const setupTriggers = () => { llamadas.push('setupTriggers'); return { created: true }; };
  const r = h.api.menuAction('lucaMenu1', SID, configFor(h, SID), setupTriggers);
  assert.equal(r.modo, 'autorizar');
  assert.deepEqual(llamadas, ['setupTriggers']);
  assert.equal(r.trigger.installed, true);
  // La query de importación pide ~30 días (con el solape de 1 día).
  const since = Math.floor(Date.now() / 1000) - 30 * DAY;
  const after = parseInt(/after:(\d+)/.exec(h.gmail._calls.list[0].q)[1], 10);
  assert.ok(Math.abs(after - (since - DAY)) < 5, 'after≈hoy−31d');
  assert.equal(r.import.done, true);
  const a = configFor(h, SID).ajustes;
  assert.equal(a['import.status'], 'done');
  assert.match(a['triggers.installedAt'], /^\d{4}-/);
  assert.equal(a['luca.version'], h.api.LUCA_VERSION);
  assert.ok(configFor(h, SID).gmail.cursor >= since, 'el cursor queda fijado');
  assert.equal(h.alerts.length, 1);
  assert.match(h.alerts[0][1], /activado/);
  assert.match(h.alerts[0][1], /instalado/);
  assert.match(h.alerts[0][1], /Nuevos: 1/);
});

test('Autorizar (ya autorizado): no reinstala el trigger ni reimporta; escaneo normal', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [reciente] });
  let n = 0;
  h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => { n++; });
  const r = h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => { n++; });
  assert.equal(n, 1);
  assert.equal(r.modo, 'scan');
  assert.equal(r.scan.added, 0);
  assert.equal(h.tab(SID, 'Movimientos').length, 2);
  assert.match(h.alerts[1][1], /Escaneo listo/);
});

test('Autorizar: si el callback falla o el stub no lo pasa, la importación igual se hace y el aviso lo dice', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [reciente] });
  const r = h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => { throw new Error('sin permiso'); });
  assert.equal(r.trigger.installed, false);
  assert.match(r.trigger.error, /sin permiso/);
  assert.equal(r.import.added, 1);
  assert.match(h.alerts[0][1], /NO se pudo instalar/);
  assert.equal(configFor(h, SID).ajustes['triggers.installedAt'], '');

  const h2 = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [reciente] });
  const r2 = h2.api.menuAction('lucaMenu1', SID, configFor(h2, SID));
  assert.equal(r2.trigger.installed, false);
  assert.equal(r2.import.added, 1);
});

test('Autorizar con buzón vacío sigue siendo idempotente: la segunda vez escanea', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [] });
  let n = 0;
  h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => { n++; });
  assert.ok(configFor(h, SID).gmail.cursor > 0);
  const r = h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => { n++; });
  assert.equal(r.modo, 'scan');
  assert.equal(n, 1);
});

test('estadoLuca resume versión, cursor, último escaneo, importación y conexiones en una llamada', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { [SID]: {} }, gmailMessages: [reciente] });
  const antes = h.api.dispatch('estadoLuca', [], SID, configFor(h, SID));
  assert.equal(antes.autorizado, false);
  assert.equal(antes.version, h.api.LUCA_VERSION);
  h.api.menuAction('lucaMenu1', SID, configFor(h, SID), () => {});
  const st = h.api.dispatch('estadoLuca', [], SID, configFor(h, SID));
  assert.equal(st.autorizado, true);
  assert.match(st.cursorIso, /^\d{4}-/);
  assert.equal(st.lastStats.added, 1);
  assert.equal(st.importacion.status, 'done');
  assert.equal(st.ledger.total, 1);
  assert.equal(st.secretos.iphone, false);
  assert.equal(st.iphone.eventsCount, 0);
  assert.equal(st.execUrl, 'https://script.google.com/macros/s/TEST/exec');
});

test('stub viejo: estadoLuca y Autorizar avisan que hay que actualizar el stub', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [] });
  const cfgViejo = { ...configFor(h, SID), stubVersion: '1' };
  const st = h.api.estadoLuca(SID, cfgViejo);
  assert.match(st.stubUpdate, /actualizarse/);
  const cfgNuevo = { ...configFor(h, SID), stubVersion: '2' };
  assert.equal(h.api.estadoLuca(SID, cfgNuevo).stubUpdate, '');
});
