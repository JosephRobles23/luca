import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const post = (h, cfg, body, params = { events: '1' }) =>
  JSON.parse(h.api.webAction('post', { parameter: params, postData: { contents: JSON.stringify(body) } }, SID, cfg).getContent());

const evento = (token, extra = {}) => ({
  schema_version: '1', id: '2026-10-04T08:49:00-0001', source: 'yape', channel: 'ios-notification', token,
  title: 'Confirmación de Pago', subtitle: '', body: 'Yape! MARIA LOPEZ te envió un pago por S/ 1.5',
  raw: 'Confirmación de Pago\nYape! MARIA LOPEZ te envió un pago por S/ 1.5',
  notified_at: '2026-10-04T08:49:00-05:00', received_at: '2026-10-04T08:49:05-05:00', device: 'iPhone de Prueba', ...extra
});

test('GET /exec responde ok con la versión de la librería', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const r = JSON.parse(h.api.webAction('get', { parameter: {} }, SID, configFor(h, SID)).getContent());
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { ok: true, app: 'luca', version: h.api.LUCA_VERSION });
});

test('conectarIphone genera el token en Ajustes (conexiones.iphone.token), no en UserProperties, y devuelve execUrl + eventsUrl + token', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  assert.equal(h.api.estadoSecretos_(cfg).iphone, false);
  const r = h.api.dispatch('conectarIphone', [], SID, cfg);
  assert.equal(r.execUrl, 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(r.eventsUrl, 'https://script.google.com/macros/s/TEST/exec?events=1');
  assert.equal(r.token, 'uuid-1');
  assert.equal(r.shortcutUrl, 'https://www.icloud.com/shortcuts/PENDIENTE');
  assert.deepEqual([r.shortcutDisponible, r.conectado], [false, true]);
  const a = configFor(h, SID).ajustes;
  assert.equal(a['conexiones.iphone.token'], 'uuid-1');
  assert.equal(a['conexiones.execUrl'], 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(a['conexiones.iphone.execUrl'], 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(h.userProps.has('luca.iphone.deviceToken'), false);
  assert.equal(h.api.PropertiesService.getScriptProperties().getProperty('luca.iphone.deviceToken'), null);
  assert.equal(h.api.estadoSecretos_(configFor(h, SID)).iphone, true);
  // Volver a llamar no rota el token (sirve para volver a ver los datos).
  assert.equal(h.api.conectarIphone(SID, cfg).token, 'uuid-1');
  // Regenerar sí lo cambia (en Ajustes); desconectar lo borra y limpia la telemetría.
  assert.equal(h.api.dispatch('regenerarTokenIphone', [], SID, cfg).token, 'uuid-2');
  assert.equal(configFor(h, SID).ajustes['conexiones.iphone.token'], 'uuid-2');
  const d = h.api.dispatch('desconectarIphone', [], SID, cfg);
  assert.deepEqual([d.token, d.conectado], ['', false]);
  const a2 = configFor(h, SID).ajustes;
  assert.deepEqual([a2['conexiones.iphone.token'], a2['conexiones.iphone.execUrl'], a2['conexiones.iphone.eventsCount']], ['', '', '0']);
  assert.equal(h.api.estadoSecretos_(configFor(h, SID)).iphone, false);
});

test('migración: el deviceToken de UserProperties pasa a Ajustes una sola vez y sigue valiendo para eventos mientras tanto', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { [SID]: {} }, userProperties: { 'luca.iphone.deviceToken': 'viejo-token' } });
  const cfg = configFor(h, SID);
  // Copia vieja sin token en Ajustes: eventsAction_ acepta el de UserProperties (respaldo).
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-0', source: 'test', token: 'viejo-token', device: 'iPhone' }), { ok: true, test: true });
  assert.equal(h.api.estadoSecretos_(cfg).iphone, true);
  // conectarIphone migra: mismo token, ahora en Ajustes; la UserProperty se limpia.
  const r = h.api.conectarIphone(SID, cfg);
  assert.equal(r.token, 'viejo-token');
  assert.equal(configFor(h, SID).ajustes['conexiones.iphone.token'], 'viejo-token');
  assert.equal(h.userProps.has('luca.iphone.deviceToken'), false);
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-1', source: 'test', token: 'viejo-token', device: 'iPhone' }), { ok: true, test: true });
  // Regenerar invalida el viejo aunque alguien lo vuelva a poner en UserProperties (Ajustes manda).
  h.api.regenerarTokenIphone(SID, cfg);
  h.userProps.set('luca.iphone.deviceToken', 'viejo-token');
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-2', source: 'test', token: 'viejo-token', device: 'iPhone' }), { ok: false, error: 'unauthorized' });
  // Tras desconectar no queda token en ningún sitio.
  h.api.desconectarIphone(SID, cfg);
  assert.equal(h.userProps.has('luca.iphone.deviceToken'), false);
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-3', source: 'test', token: 'viejo-token', device: 'iPhone' }), { ok: false, error: 'unauthorized' });
});

test('eventos: valida el token contra Ajustes (editar la celda cambia el token aceptado)', () => {
  const h = makeHarness({ spreadsheets: { [SID]: { Ajustes: [['key', 'value'], ['conexiones.iphone.token', 'token-en-hoja']] } } });
  const cfg = configFor(h, SID);
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-1', source: 'test', token: 'token-en-hoja' }), { ok: true, test: true });
  assert.deepEqual(post(h, cfg, { schema_version: '1', id: 't-2', source: 'test', token: 'otro' }), { ok: false, error: 'unauthorized' });
});

test('generarPromptIphone: prompt con la URL ?events=1 y el token literales, sin preguntas de importación', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const r = h.api.dispatch('generarPromptIphone', [], SID, cfg);
  assert.equal(r.execUrl, 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(r.eventsUrl, 'https://script.google.com/macros/s/TEST/exec?events=1');
  assert.equal(r.token, 'uuid-1');
  assert.equal(r.shortcutUrl, 'https://www.icloud.com/shortcuts/PENDIENTE');
  assert.ok(r.prompt.includes('https://script.google.com/macros/s/TEST/exec?events=1'));
  assert.ok(r.prompt.includes('"token": "uuid-1"'));
  assert.ok(r.prompt.includes('Luca – Captura Yape'));
  assert.ok(r.prompt.includes('modo prueba') && !r.prompt.includes('Probar iPhone')); // un solo atajo
  assert.ok(r.prompt.includes('luca_pendientes'));
  assert.doesNotMatch(r.prompt, /preguntas de configuración|Al importarse/);
  assert.equal(r.prompt, h.api.promptIphone_(r.execUrl, r.token));
  // Es idempotente respecto al token (no lo rota) y deja el token en Ajustes.
  assert.equal(h.api.generarPromptIphone(SID, cfg).token, 'uuid-1');
  assert.equal(configFor(h, SID).ajustes['conexiones.iphone.token'], 'uuid-1');
  // Sin Web App desplegado no hay prompt útil: error claro.
  const h2 = makeHarness({ spreadsheets: { [SID]: {} } });
  assert.throws(() => h2.api.generarPromptIphone(SID, configFor(h2, SID)), /Web App/);
});

test('generarPromptIphone: la guía docs/guides contiene exactamente la plantilla con placeholders', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const guia = fs.readFileSync(new URL('../docs/guides/prompt-atajo-ios27-yape.md', import.meta.url), 'utf8');
  assert.ok(guia.includes('## Prompt 1 (generado por Luca)'));
  assert.ok(guia.includes(h.api.promptIphone_('<EXEC_URL>', '<TOKEN>')), 'la guía debe contener promptIphone_(\'<EXEC_URL>\', \'<TOKEN>\') tal cual');
});

test('execUrl: la URL viva gana sobre la guardada y Ajustes se refresca (conectarIphone, estadoLuca, mcpWebAppStatus_)', () => {
  const OLD = 'https://script.google.com/macros/s/VIEJA/exec', NEW = 'https://script.google.com/macros/s/NUEVA/exec';
  const h = makeHarness({ execUrl: NEW, spreadsheets: { [SID]: { Ajustes: [['key', 'value'], ['conexiones.execUrl', OLD]] } } });
  const cfg = configFor(h, SID);
  assert.equal(h.api.execUrl_(cfg), NEW);
  const st = h.api.mcpWebAppStatus_(cfg, SID);
  assert.deepEqual([st.ready, st.url], [true, NEW]);
  assert.equal(configFor(h, SID).ajustes['conexiones.execUrl'], NEW);
  const r = h.api.conectarIphone(SID, cfg);
  assert.deepEqual([r.execUrl, r.eventsUrl], [NEW, NEW + '?events=1']);
  assert.equal(h.api.estadoLuca(SID, configFor(h, SID)).execUrl, NEW);
  assert.equal(h.api.cargarMcp(SID, configFor(h, SID)).webApp.url, NEW);
  // Sin URL viva (stub viejo / sin servicio) la guardada sigue sirviendo de respaldo y no se borra.
  const h2 = makeHarness({ execUrl: null, spreadsheets: { [SID]: { Ajustes: [['key', 'value'], ['conexiones.execUrl', OLD]] } } });
  const cfg2 = configFor(h2, SID);
  assert.equal(h2.api.mcpWebAppStatus_(cfg2, SID).url, OLD);
  assert.equal(h2.api.estadoLuca(SID, cfg2).execUrl, OLD);
  assert.equal(configFor(h2, SID).ajustes['conexiones.execUrl'], OLD);
});

test('eventos: sin token o token incorrecto → unauthorized y nada en el ledger', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  assert.deepEqual(post(h, cfg, evento('lo-que-sea')), { ok: false, error: 'unauthorized' });
  h.api.conectarIphone(SID, cfg);
  assert.deepEqual(post(h, cfg, evento('otro')), { ok: false, error: 'unauthorized' });
  assert.equal(h.api.estadoLedger(SID, cfg).total, 0);
});

test('eventos: yapeo recibido se guarda como transfer_in, con telemetría y dedupe por id', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const { token } = h.api.conectarIphone(SID, cfg);
  const r = post(h, cfg, evento(token));
  assert.equal(r.ok, true);
  assert.equal(r.stored, true);
  assert.equal(r.kind, 'transfer_in');
  assert.equal(r.amount, 1.5);
  const a = configFor(h, SID).ajustes;
  assert.equal(a['conexiones.iphone.device'], 'iPhone de Prueba');
  assert.equal(a['conexiones.iphone.eventsCount'], '1');
  assert.equal(a['conexiones.iphone.schemaVersion'], '1');
  assert.match(a['conexiones.iphone.lastEventAt'], /^\d{4}-/);
  assert.equal(a['conexiones.iphone.lastError'], '');
  // Reenvío del mismo evento (cola offline del atajo): ok pero no duplica.
  const r2 = post(h, configFor(h, SID), evento(token));
  assert.deepEqual([r2.ok, r2.stored], [true, false]);
  assert.equal(h.api.estadoLedger(SID, cfg).total, 1);
  assert.equal(configFor(h, SID).ajustes['conexiones.iphone.eventsCount'], '2');
});

test('eventos: schema_version desconocida → update-shortcut; texto sin patrón → stored:false y lastError', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const { token } = h.api.conectarIphone(SID, cfg);
  assert.deepEqual(post(h, cfg, evento(token, { schema_version: '2' })), { ok: false, error: 'update-shortcut' });
  assert.deepEqual(post(h, cfg, evento(token, { schema_version: undefined })), { ok: false, error: 'update-shortcut' });
  assert.match(configFor(h, SID).ajustes['conexiones.iphone.lastError'], /update-shortcut/);
  const u = post(h, configFor(h, SID), evento(token, { id: 'x-2', body: '¡Tienes S/100 de descuento!', raw: '' }));
  assert.deepEqual([u.ok, u.stored, u.reason], [true, false, 'no_pattern']);
  assert.match(configFor(h, SID).ajustes['conexiones.iphone.lastError'], /no_pattern/);
  assert.equal(h.api.estadoLedger(SID, cfg).total, 0);
  assert.ok(h.api.processedSet_(SID, cfg)['push:x-2']);
});

test('eventos: source:test solo escribe lastTestAt (botón Probar), sin tocar el ledger', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const { token } = h.api.conectarIphone(SID, cfg);
  const r = post(h, cfg, { schema_version: '1', id: 't-1', source: 'test', token, device: 'iPhone X' });
  assert.deepEqual(r, { ok: true, test: true });
  const a = configFor(h, SID).ajustes;
  assert.match(a['conexiones.iphone.lastTestAt'], /^\d{4}-/);
  assert.equal(a['conexiones.iphone.device'], 'iPhone X');
  assert.equal(a['conexiones.iphone.eventsCount'], '0');
  assert.equal(a['conexiones.iphone.lastEventAt'], '');
  assert.equal(h.api.estadoLedger(SID, cfg).total, 0);
});

test('eventos: usa el lock de usuario y lo libera; si está ocupado responde busy', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const { token } = h.api.conectarIphone(SID, cfg);
  const calls = [];
  h.api.LockService.getUserLock = () => ({ waitLock: (ms) => calls.push(['wait', ms]), releaseLock: () => calls.push(['release']) });
  post(h, cfg, evento(token));
  assert.deepEqual(calls.map((c) => c[0]), ['wait', 'release']);
  h.api.LockService.getUserLock = () => ({ waitLock: () => { throw new Error('ocupado'); }, releaseLock: () => {} });
  assert.deepEqual(post(h, cfg, evento(token, { id: 'otro' })), { ok: false, error: 'busy' });
});

test('eventos: push y correo del mismo yapeo quedan ambos con flag fuzzy_dup en el segundo', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const { token } = h.api.conectarIphone(SID, cfg);
  h.api.appendTransactions_(SID, cfg, [h.api.parseEmail(emails.yape_p2p_sent)]);     // S/ 10 · 02:35
  const r = post(h, cfg, evento(token, { id: 'f-1', body: 'Yapeaste S/ 10 a Carlos', notified_at: '2026-10-04T02:35:10-05:00' }));
  assert.deepEqual([r.stored, r.fuzzy], [true, 1]);
});
