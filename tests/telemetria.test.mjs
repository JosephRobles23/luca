import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const SID = 'sheet-1';

test('runDispatcher escribe luca.version, conexiones.execUrl, scan.lastRunAt y scan.lastStats en Ajustes', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { [SID]: {} }, gmailMessages: [toGmailApi(emails.bcp_card_purchase_pen)] });
  assert.match(h.api.LUCA_VERSION, /^\d+$/);
  h.api.runDispatcher(SID, configFor(h, SID));
  const a = configFor(h, SID).ajustes;
  assert.equal(a['luca.version'], h.api.LUCA_VERSION);
  assert.equal(a['conexiones.execUrl'], 'https://script.google.com/macros/s/TEST/exec');
  assert.match(a['scan.lastRunAt'], /^\d{4}-\d{2}-\d{2}T/);
  const stats = JSON.parse(a['scan.lastStats']);
  assert.equal(stats.added, 1);
  assert.equal(stats.done, true);
});

test('execUrl: prioriza la que trae el stub en config; sin despliegue queda vacía y no rompe la pasada', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, execUrl: null });
  const cfg = configFor(h, SID);
  h.api.escanearAhora(SID, cfg);
  assert.equal(configFor(h, SID).ajustes['conexiones.execUrl'], '');
  cfg.execUrl = 'https://script.google.com/macros/s/DEL-STUB/exec';
  h.api.escanearAhora(SID, cfg);
  assert.equal(configFor(h, SID).ajustes['conexiones.execUrl'], 'https://script.google.com/macros/s/DEL-STUB/exec');
  assert.equal(h.api.cargarConfig(SID, cfg).version, h.api.LUCA_VERSION);
});

test('la importación histórica, al terminar, avanza el cursor incremental hasta lo último importado', () => {
  const inbox = [emails.bcp_card_purchase_pen, emails.yape_p2p_sent].map(toGmailApi);
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox });
  const since = Math.floor(new Date('2026-09-04T00:00:00Z').getTime() / 1000);
  const r = h.api.iniciarImportacion(SID, configFor(h, SID), since);
  assert.equal(r.done, true);
  const maxEpoch = Math.max(...inbox.map((m) => Math.floor(parseInt(m.internalDate, 10) / 1000)));
  assert.equal(configFor(h, SID).gmail.cursor, maxEpoch);
  assert.equal(configFor(h, SID).ajustes['import.status'], 'done');
});
