import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness } from './gas-harness.mjs';

const h = makeHarness();
const api = h.api;

// Payload real del atajo de iOS 27 (2026-10-04), con el nombre cambiado.
const recibido = {
  id: '2026-10-04-648320', source: 'yape', channel: 'ios-notification',
  title: 'Confirmación de Pago', subtitle: '',
  body: 'Yape! MARIA LOPEZ te envió un pago por S/ 1.5',
  raw: 'Confirmación de Pago\nYape! MARIA LOPEZ te envió un pago por S/ 1.5',
  notified_at: '4 oct. 2026, 8:49 a. m.', received_at: '2026-10-04', device: 'iPhone X'
};

test('push Yape: yapeo recibido → income con contraparte, monto < S/10 y fecha de la notificación', () => {
  const tx = api.parsePushEvent(recibido);
  assert.equal(tx.kind, 'income');
  assert.equal(tx.amount, 1.5);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.counterparty_name, 'MARIA LOPEZ');
  assert.equal(tx.counterparty_key, 'maria lopez|');
  assert.equal(tx.occurred_at, '2026-10-04T08:49:00-05:00');
  assert.equal(tx.id, 'push:2026-10-04-648320');
  assert.equal(tx.source, 'yape_push');
  assert.deepEqual(JSON.parse(JSON.stringify(tx.flags)), []);
});

test('push Yape: variantes previstas de envío y pago (no verificadas en dispositivo)', () => {
  const a = api.parsePushEvent({ id: 'a', body: 'Yapeaste S/ 12.50 a Juan Perez', notified_at: '2026-10-04T10:00:00-05:00' });
  assert.equal(a.kind, 'expense'); assert.equal(a.amount, 12.5); assert.equal(a.counterparty_name, 'Juan Perez');
  const b = api.parsePushEvent({ id: 'b', body: 'Pagaste S/ 5.00 en Bodega Don Lucho', received_at: '2026-10-04T10:00:00-05:00' });
  assert.equal(b.kind, 'expense'); assert.equal(b.merchant, 'Bodega Don Lucho'); assert.equal(b.counterparty_name, '');
  const c = api.parsePushEvent({ id: 'c', body: 'PEDRO te yapeó S/ 20' });
  assert.equal(c.kind, 'income'); assert.equal(c.amount, 20); assert.ok(c.flags.includes('no_date'));
});

test('push: sin body usa raw sin la primera línea (título); texto desconocido → unknown', () => {
  const tx = api.parsePushEvent({ id: 'r', raw: 'Confirmación de Pago\nYape! ANA te envió un pago por S/ 3', notified_at: '4 oct. 2026, 8:49 a. m.' });
  assert.equal(tx.amount, 3);
  const u = api.parsePushEvent({ id: 'u', body: '¡Tienes S/100 de descuento en la Tienda Yape!' });
  assert.equal(u.unknown, true);
  assert.equal(u.reason, 'no_pattern');
  assert.equal(api.parsePushEvent({ id: 'e' }).reason, 'empty');
});

test('push y correo del mismo yapeo comparten clave difusa (monto + minuto)', () => {
  const push = api.parsePushEvent({ id: 'p', body: 'LUIS te yapeó S/ 10', notified_at: '2026-10-04T02:35:00-05:00' });
  assert.equal(api.txFuzzyKey(push), 'PEN|10.00|2026-10-04T02:35');
});
