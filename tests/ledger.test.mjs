import { test } from 'node:test';
import assert from 'node:assert/strict';
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b); // objetos del sandbox vm
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails } from './fixtures/emails.mjs';

const SID = 'sheet-1';

test('construirConfig crea Ajustes con defaults y expone gmail/llm tipados', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  eq(cfg.gmail.senders, ['notificaciones@notificacionesbcp.com.pe', 'notificaciones@yape.pe']);
  assert.equal(cfg.gmail.cursor, 0);
  assert.equal(cfg.gmail.batch, 40);
  assert.equal(cfg.llm.provider, 'gemini');
  assert.ok(h.tab(SID, 'Ajustes'));
  // Un valor editado en la hoja pisa el default.
  h.api.setAjustes_(SID, cfg, { 'gmail.batch': '10' });
  assert.equal(configFor(h, SID).gmail.batch, 10);
});

test('appendTransactions_ crea Movimientos, añade y deduplica por id y gmail_id', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const txs = [emails.bcp_card_purchase_pen, emails.yape_p2p_sent, emails.bcp_internal_transfer].map((e) => h.api.parseEmail(e));
  const r1 = h.api.appendTransactions_(SID, cfg, txs);
  assert.deepEqual([r1.added, r1.skipped], [3, 0]);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[0][0], 'id');
  assert.equal(data.length, 4);
  // Fila de la compra: columnas por encabezado.
  const hdr = data[0];
  const fila = data[1];
  assert.equal(fila[hdr.indexOf('monto')], 53.3);
  assert.equal(fila[hdr.indexOf('comercio')], 'CA012 AVIACION');
  assert.equal(fila[hdr.indexOf('tipo')], 'expense');
  // Reinsertar → todo saltado; un tx distinto con el mismo gmail_id también se salta.
  const r2 = h.api.appendTransactions_(SID, cfg, txs.concat([{ ...txs[0], id: 'otro', gmail_message_id: txs[0].gmail_message_id }]));
  assert.deepEqual([r2.added, r2.skipped], [0, 4]);
  assert.equal(h.api.estadoLedger(SID, cfg).total, 3);
});

test('markProcessed_ es idempotente', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  assert.equal(h.api.markProcessed_(SID, cfg, [{ gmail_id: 'a', resultado: 'tx' }, { gmail_id: 'b', resultado: 'ignored:x' }]), 2);
  assert.equal(h.api.markProcessed_(SID, cfg, [{ gmail_id: 'a', resultado: 'tx' }]), 0);
  assert.deepEqual(Object.keys(h.api.processedSet_(SID, cfg)).sort(), ['a', 'b']);
});

test('secretos por usuario: la key no toca Script Properties', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  assert.throws(() => h.api.guardarLlmKey(SID, cfg, 'corta'));
  const st = h.api.guardarLlmKey(SID, cfg, 'AIza-una-key-de-prueba-suficientemente-larga');
  assert.equal(st.llmKey, true);
  assert.equal(h.userProps.get('luca.llm.apiKey'), 'AIza-una-key-de-prueba-suficientemente-larga');
  assert.equal(h.api.PropertiesService.getScriptProperties().getProperty('luca.llm.apiKey'), null);
});

test('dispatch solo permite funciones de la lista blanca', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  assert.ok(h.api.dispatch('cargarConfig', [], SID, cfg).ajustes);
  assert.throws(() => h.api.dispatch('appendTransactions_', [], SID, cfg), /no permitida/);
});

test('estadoLedger: transfer_in (yapeo recibido) se cuenta aparte y no como income', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const push = h.api.parsePushEvent({ id: 'p1', body: 'ANA te yapeó S/ 20', notified_at: '2026-10-04T10:00:00-05:00' });
  const compra = h.api.parseEmail(emails.bcp_card_purchase_pen);
  h.api.appendTransactions_(SID, cfg, [push, compra]);
  const st = h.api.estadoLedger(SID, cfg);
  assert.equal(st.total, 2);
  assert.equal(st.porTipo.transfer_in, 1);
  assert.equal(st.porTipo.income, 0);
  assert.equal(st.recibidoYape, 1);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[1][data[0].indexOf('tipo')], 'transfer_in');
});
