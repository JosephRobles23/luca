import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const inbox = [emails.bcp_card_purchase_pen, emails.yape_p2p_sent, emails.yape_marketing, emails.bcp_rejected, emails.bcp_card_purchase_usd].map(toGmailApi);

test('gmailMessageToEmail decodifica cabeceras y cuerpo HTML (base64url)', () => {
  const h = makeHarness();
  const e = h.api.gmailMessageToEmail(toGmailApi(emails.bcp_card_purchase_pen));
  assert.equal(e.id, 'm-bcp-1');
  assert.match(e.from, /notificacionesbcp/);
  assert.match(e.html, /CA012 AVIACION/);
  assert.equal(e.plain, '(versión texto)');
  assert.equal(e.epoch, Math.floor(emails.bcp_card_purchase_pen.date.getTime() / 1000));
});

test('gmailQuery_ usa remitentes, cursor con solape y before opcional', () => {
  const h = makeHarness();
  assert.equal(h.api.gmailQuery_(['a@x', 'b@y'], 0), 'from:(a@x OR b@y)');
  assert.equal(h.api.gmailQuery_(['a@x'], 1000000), 'from:(a@x) after:913600');
  assert.equal(h.api.gmailQuery_(['a@x'], 1000000, 2000000), 'from:(a@x) after:913600 before:2000000');
});

test('scanGmail_: primera pasada importa, marca procesados y avanza el cursor; segunda pasada no repite', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox });
  const cfg = configFor(h, SID);
  const st = h.api.scanGmail_(SID, cfg, {});
  assert.equal(st.processed, 5);
  assert.equal(st.added, 3);        // 2 compras + 1 yapeo
  assert.equal(st.ignored, 1);      // rechazo
  assert.equal(st.unknown, 1);      // marketing @yape.pe
  assert.equal(st.done, true);
  assert.equal(h.tab(SID, 'Movimientos').length, 4);
  assert.equal(h.tab(SID, '_Procesados').length, 6);
  const maxEpoch = Math.max(...inbox.map((m) => Math.floor(parseInt(m.internalDate, 10) / 1000)));
  assert.equal(st.cursor, maxEpoch);
  assert.equal(configFor(h, SID).gmail.cursor, maxEpoch);

  const cfg2 = configFor(h, SID);
  const st2 = h.api.scanGmail_(SID, cfg2, {});
  assert.equal(st2.processed, 0);
  assert.equal(st2.added, 0);
  assert.match(h.gmail._calls.list.at(-1).q, /after:/);
  assert.equal(h.tab(SID, 'Movimientos').length, 4);
});

test('scanGmail_ respeta el lote (batch) y no avanza el cursor hasta terminar', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox });
  const cfg = configFor(h, SID);
  const st = h.api.scanGmail_(SID, cfg, { max: 2 });
  assert.equal(st.processed, 2);
  assert.equal(st.done, false);
  assert.equal(configFor(h, SID).gmail.cursor, 0);
  const st2 = h.api.scanGmail_(SID, configFor(h, SID), { max: 10 });
  assert.equal(st2.processed, 3);
  assert.equal(st2.done, true);
  assert.equal(h.tab(SID, 'Movimientos').length, 4);
});

test('importación histórica: iniciarImportacion → pasadas por el dispatcher hasta done', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox });
  const cfg = configFor(h, SID);
  const since = Math.floor(new Date('2026-09-01T00:00:00Z').getTime() / 1000);
  h.api.setAjustes_(SID, cfg, { 'gmail.batch': '2' });
  const r = h.api.iniciarImportacion(SID, configFor(h, SID), since);
  assert.equal(r.done, false);
  assert.equal(configFor(h, SID).ajustes['import.status'], 'running');
  const d1 = h.api.runDispatcher(SID, configFor(h, SID));
  assert.ok(d1.import && !d1.scan);                 // mientras importa no escanea
  const d2 = h.api.runDispatcher(SID, configFor(h, SID));
  assert.equal(configFor(h, SID).ajustes['import.status'], 'done');
  assert.ok(d2.scan);                                // terminado el job, vuelve el escaneo normal
  assert.equal(h.tab(SID, 'Movimientos').length, 4);
  assert.match(h.gmail._calls.list[0].q, new RegExp('after:' + (since - 86400)));
});

test('escanearAhora vía dispatch y menú', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox });
  const cfg = configFor(h, SID);
  const st = h.api.dispatch('escanearAhora', [], SID, cfg);
  assert.equal(st.added, 3);
  h.api.menuAction('lucaMenu1', SID, configFor(h, SID));
  assert.equal(h.alerts.length, 1);
  assert.match(h.alerts[0][1], /Nuevos: 0/);
});

test('b64urlToString_ tolera base64 estándar, sin padding y basura; un mensaje corrupto no aborta la pasada', () => {
  const h = makeHarness();
  const txt = 'Hola <b>Luca</b> ñ';
  assert.equal(h.api.b64urlToString_(Buffer.from(txt).toString('base64url')), txt);
  assert.equal(h.api.b64urlToString_(Buffer.from(txt).toString('base64')), txt);
  assert.equal(h.api.b64urlToString_(''), '');
  // Mensaje cuyo get lanza: se marca como error en _Procesados y el resto se importa.
  const broken = { id: 'm-broken', threadId: 't', internalDate: '1791100000000', payload: null };
  const h2 = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [toGmailApi(emails.bcp_card_purchase_pen), broken] });
  const origGet = h2.gmail.Users.Messages.get;
  h2.gmail.Users.Messages.get = (u, id) => { if (id === 'm-broken') throw new Error('No se ha podido descodificar la cadena.'); return origGet(u, id); };
  const st = h2.api.scanGmail_(SID, configFor(h2, SID), {});
  assert.equal(st.added, 1);
  const proc = h2.tab(SID, '_Procesados').slice(1).map((r) => r[1]);
  assert.ok(proc.some((r) => String(r).startsWith('error:')));
});
