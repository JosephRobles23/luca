import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const col = (data, name) => data[0].indexOf(name);
const rowsBy = (data, name) => data.slice(1).map((r) => r[col(data, name)]);

test('primer escaneo crea Categorías (taxonomía ADR-004) y Comercios con sus encabezados', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [toGmailApi(emails.bcp_card_purchase_pen)] });
  h.api.scanGmail_(SID, configFor(h, SID), {});
  const cats = h.tab(SID, 'Categorías');
  assert.deepEqual(cats[0], ['categoria', 'tipo', 'descripcion']);
  const nombres = rowsBy(cats, 'categoria');
  for (const c of ['Vivienda', 'Supermercado', 'Comidas fuera', 'Transporte', 'Servicios', 'Suscripciones', 'Salud', 'Educación', 'Ropa', 'Ocio', 'Transferencias', 'Otros', 'Ingreso']) {
    assert.ok(nombres.includes(c), 'falta ' + c);
  }
  assert.deepEqual(h.tab(SID, 'Comercios')[0], ['clave', 'nombre', 'categoria', 'categoria_origen', 'veces', 'actualizado_en']);
  // Segundo escaneo no duplica la taxonomía.
  h.api.scanGmail_(SID, configFor(h, SID), {});
  assert.equal(h.tab(SID, 'Categorías').length, cats.length);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.listarCategorias(SID, configFor(h, SID)))).slice(0, 2), ['Vivienda', 'Supermercado']);
});

test('reglas deterministas: Metropolitano → Transporte, recarga → Servicios, APPLE.COM/BILL → Suscripciones, entre cuentas → Transferencias', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const txs = [emails.yape_service, emails.yape_topup, emails.bcp_card_purchase_usd, emails.bcp_internal_transfer, emails.bcp_card_purchase_pen].map((e) => h.api.parseEmail(e));
  h.api.appendTransactions_(SID, cfg, txs);
  const data = h.tab(SID, 'Movimientos');
  const cats = rowsBy(data, 'categoria'), orig = rowsBy(data, 'categoria_origen');
  assert.deepEqual(cats.slice(0, 4), ['Transporte', 'Servicios', 'Suscripciones', 'Transferencias']);
  assert.deepEqual(orig.slice(0, 4), ['rule', 'rule', 'rule', 'rule']);
  // CA012 AVIACION no coincide con ninguna regla ni caché: queda por categorizar.
  assert.equal(cats[4], '');
  assert.equal(orig[4], '');
  // Comercios registra cada clave con veces=1 y la categoría aprendida.
  const com = h.tab(SID, 'Comercios');
  const fila = com.slice(1).find((r) => r[col(com, 'clave')] === 'ca012 aviacion');
  assert.ok(fila);
  assert.equal(fila[col(com, 'veces')], 1);
  assert.equal(fila[col(com, 'categoria')], '');
  const metro = com.slice(1).find((r) => r[col(com, 'clave')] === 'metropolitano y corredores');
  assert.equal(metro[col(com, 'categoria')], 'Transporte');
  assert.equal(metro[col(com, 'categoria_origen')], 'rule');
});

test('caché Comercios: una categoría previa se reutiliza (origen cache) y veces se incrementa', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {
    Comercios: [['clave', 'nombre', 'categoria', 'categoria_origen', 'veces', 'actualizado_en'], ['ca012 aviacion', 'CA012 AVIACION', 'Comidas fuera', 'llm', 3, '']]
  } } });
  const cfg = configFor(h, SID);
  h.api.appendTransactions_(SID, cfg, [h.api.parseEmail(emails.bcp_card_purchase_pen)]);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], 'Comidas fuera');
  assert.equal(data[1][col(data, 'categoria_origen')], 'cache');
  assert.equal(h.tab(SID, 'Comercios')[1][4], 4);
});

test('corrección del usuario en Comercios gana sobre las reglas', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {
    Comercios: [['clave', 'nombre', 'categoria', 'categoria_origen', 'veces', 'actualizado_en'], ['metropolitano y corredores', 'Metropolitano', 'Otros', 'user', 1, '']]
  } } });
  h.api.appendTransactions_(SID, configFor(h, SID), [h.api.parseEmail(emails.yape_service)]);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], 'Otros');
  assert.equal(data[1][col(data, 'categoria_origen')], 'user');
});

test('categorizeWithLlm_ devuelve null sin API key y no llama a la red (modo sin key es completo)', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const ctx = h.api.categorizeContext_(SID, configFor(h, SID));
  assert.equal(h.api.categorizeWithLlm_({ merchant: 'X', amount: 1, currency: 'PEN' }, ctx), null);
  assert.equal(h.fetchCalls.length, 0);
  // Con key pero sin red (fetch falla): también null, sin lanzar.
  h.api.setSecret_('llmKey', 'una-key-de-prueba-suficientemente-larga');
  const ctx2 = h.api.categorizeContext_(SID, configFor(h, SID));
  assert.equal(ctx2.llmKey.length > 0, true);
  assert.equal(h.api.categorizeWithLlm_({ merchant: 'X', amount: 1, currency: 'PEN' }, ctx2), null);
  assert.equal(h.fetchCalls.length, 1);
  assert.equal(ctx2.llmErrores, 1);
});

test('recategorizar: fija user, aprende en Comercios y arrastra los previos del mismo comercio salvo los corregidos a mano', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const a = h.api.parseEmail(emails.bcp_card_purchase_pen);                                   // CA012 AVIACION
  const b = { ...a, id: 'bcp:222', operation_id: '222', gmail_message_id: 'm-2', occurred_at: '2026-10-03T10:00:00-05:00' };
  const c = { ...a, id: 'bcp:333', operation_id: '333', gmail_message_id: 'm-3', occurred_at: '2026-10-02T10:00:00-05:00' };
  const otro = h.api.parseEmail(emails.yape_service);
  h.api.appendTransactions_(SID, cfg, [a, b, c, otro]);
  // c fue corregido a mano antes.
  h.api.recategorizar(SID, cfg, { id: 'bcp:333', categoria: 'Ocio' });
  const r = h.api.dispatch('recategorizar', [{ id: a.id, categoria: 'Comidas fuera' }], SID, cfg);
  assert.equal(r.clave, 'ca012 aviacion');
  assert.equal(r.actualizados, 1);                                                             // solo b
  const data = h.tab(SID, 'Movimientos');
  const porId = Object.fromEntries(data.slice(1).map((row) => [row[col(data, 'id')], { cat: row[col(data, 'categoria')], o: row[col(data, 'categoria_origen')] }]));
  assert.deepEqual(porId[a.id], { cat: 'Comidas fuera', o: 'user' });
  assert.deepEqual(porId['bcp:222'], { cat: 'Comidas fuera', o: 'cache' });
  assert.deepEqual(porId['bcp:333'], { cat: 'Ocio', o: 'user' });
  assert.deepEqual(porId[otro.id], { cat: 'Transporte', o: 'rule' });
  const com = h.tab(SID, 'Comercios');
  const fila = com.slice(1).find((row) => row[col(com, 'clave')] === 'ca012 aviacion');
  assert.equal(fila[col(com, 'categoria')], 'Comidas fuera');
  assert.equal(fila[col(com, 'categoria_origen')], 'user');
  assert.equal(fila[col(com, 'veces')], 3);
  // Un movimiento nuevo del mismo comercio hereda la corrección (origen user).
  const d = { ...a, id: 'bcp:444', operation_id: '444', gmail_message_id: 'm-4' };
  h.api.appendTransactions_(SID, cfg, [d]);
  const data2 = h.tab(SID, 'Movimientos');
  assert.equal(data2.at(-1)[col(data2, 'categoria')], 'Comidas fuera');
  assert.equal(data2.at(-1)[col(data2, 'categoria_origen')], 'user');
  assert.throws(() => h.api.recategorizar(SID, cfg, { id: 'nope', categoria: 'X' }), /no existe/);
});

test('contrapartes P2P se aprenden por contraparte_key (clave p2p:)', () => {
  const h = makeHarness({ spreadsheets: { [SID]: {} } });
  const cfg = configFor(h, SID);
  const y = h.api.parseEmail(emails.yape_p2p_sent);
  h.api.appendTransactions_(SID, cfg, [y]);
  h.api.recategorizar(SID, cfg, { id: y.id, categoria: 'Transferencias' });
  const com = h.tab(SID, 'Comercios');
  const fila = com.slice(1).find((row) => String(row[col(com, 'clave')]).startsWith('p2p:'));
  assert.ok(fila, 'debe existir la clave p2p');
  assert.equal(fila[col(com, 'categoria')], 'Transferencias');
  const y2 = { ...y, id: 'yape:999', operation_id: '999', gmail_message_id: 'm-9' };
  h.api.appendTransactions_(SID, cfg, [y2]);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data.at(-1)[col(data, 'categoria')], 'Transferencias');
});
