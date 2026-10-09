import { test } from 'node:test';
import assert from 'node:assert/strict';
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b); // objetos del sandbox vm
import { makeHarness } from './gas-harness.mjs';
import { emails } from './fixtures/emails.mjs';

const h = makeHarness();
const api = h.api;

test('classifyEmail: remitente + asunto', () => {
  eq(api.classifyEmail(emails.bcp_card_purchase_pen.from, emails.bcp_card_purchase_pen.subject), { bank: 'bcp', type: 'bcp_card_purchase' });
  eq(api.classifyEmail(emails.yape_service.from, emails.yape_service.subject), { bank: 'yape', type: 'yape_service' });
  assert.equal(api.classifyEmail(emails.steam_other.from, emails.steam_other.subject).bank, null);
  // Marketing de Yape desde otra dirección @yape.pe → tipo desconocido, no transacción.
  assert.equal(api.classifyEmail(emails.yape_marketing.from, emails.yape_marketing.subject).type, 'yape_unknown');
  // Asunto en singular/plural y con acentos distintos.
  assert.equal(api.classifyEmail('x <a@notificacionesbcp.com.pe>', 'Constancia de Pago con QR - Servicio de Notificaciones BCP').type, 'bcp_qr_payment');
  assert.equal(api.classifyEmail('x <a@notificacionesbcp.com.pe>', 'Se rechazo tu compra por fondos insuficientes').type, 'bcp_rejected');
});

test('parseAmount: soles, dólares, miles y decimales', () => {
  eq(api.parseAmount('S/ 53.30'), { amount: 53.3, currency: 'PEN' });
  eq(api.parseAmount('$ 3.86'), { amount: 3.86, currency: 'USD' });
  eq(api.parseAmount('S/ 1,234.50'), { amount: 1234.5, currency: 'PEN' });
  eq(api.parseAmount('S/ 6.0'), { amount: 6, currency: 'PEN' });
  eq(api.parseAmount('US$ 17.00'), { amount: 17, currency: 'USD' });
  assert.equal(api.parseAmount('sin monto'), null);
});

test('parseDateEs: los 5 formatos observados → ISO Lima', () => {
  assert.equal(api.parseDateEs('02 de octubre de 2026 - 09:06 PM'), '2026-10-02T21:06:00-05:00');
  assert.equal(api.parseDateEs('02 de Octubre de 2026 - 02:58 PM'), '2026-10-02T14:58:00-05:00');
  assert.equal(api.parseDateEs('04 octubre 2026 - 02:35 a. m.'), '2026-10-04T02:35:00-05:00');
  assert.equal(api.parseDateEs('15 Set, 2026 - 08:20 pm'), '2026-09-15T20:20:00-05:00');
  assert.equal(api.parseDateEs('24 may. 2026 - 02:41 p. m.'), '2026-05-24T14:41:00-05:00');
  assert.equal(api.parseDateEs('12 de enero de 2026 - 12:05 AM'), '2026-01-12T00:05:00-05:00');
  assert.equal(api.parseDateEs('12 de enero de 2026 - 12:05 PM'), '2026-01-12T12:05:00-05:00');
  assert.equal(api.parseDateEs('fecha rara'), null);
});

test('htmlToText + extractFields: tablas etiqueta/valor y entidades', () => {
  const text = api.htmlToText(emails.bcp_card_purchase_pen.html);
  assert.match(text, /Total del consumo\tS\/ 53\.30/);
  assert.doesNotMatch(text, /<|\.x\{/);
  const f = api.extractFields(text);
  assert.equal(f['empresa'], 'CA012 AVIACION');
  assert.equal(f['numero de operacion'], '176424');
  assert.equal(f['fecha y hora'], '02 de octubre de 2026 - 09:06 PM');
});

test('BCP consumo con débito en soles', () => {
  const tx = api.parseEmail(emails.bcp_card_purchase_pen);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.amount, 53.3);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.merchant, 'CA012 AVIACION');
  assert.equal(tx.instrument, 'debito ****1816');
  assert.equal(tx.operation_id, '176424');
  assert.equal(tx.id, 'bcp:176424');
  assert.equal(tx.occurred_at, '2026-10-02T21:06:00-05:00');
  assert.equal(tx.source, 'bcp_email');
  eq(tx.flags, []);
});

test('BCP consumo en dólares', () => {
  const tx = api.parseEmail(emails.bcp_card_purchase_usd);
  assert.equal(tx.amount, 3.86);
  assert.equal(tx.currency, 'USD');
  assert.equal(tx.merchant, 'APPLE.COM/BILL');
  assert.equal(tx.occurred_at, '2026-10-03T07:54:00-05:00');
});

test('BCP transferencia entre mis cuentas → internal_transfer con tipo de cambio', () => {
  const tx = api.parseEmail(emails.bcp_internal_transfer);
  assert.equal(tx.kind, 'internal_transfer');
  assert.equal(tx.amount, 57.95);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.fx_rate, 3.409);
  assert.equal(tx.amount_charged, 17);
  assert.equal(tx.currency_charged, 'USD');
  assert.equal(tx.instrument, 'cuenta 7119');
  assert.equal(tx.occurred_at, '2026-10-02T14:58:00-05:00');
});

test('BCP retiro de wardadito → internal_transfer', () => {
  const tx = api.parseEmail(emails.bcp_wardadito);
  assert.equal(tx.kind, 'internal_transfer');
  assert.equal(tx.amount, 10);
  assert.equal(tx.merchant, 'Wardadito');
});

test('[.eml real] BCP retiro en un Agente BCP → expense de efectivo, sin LLM', () => {
  assert.equal(api.classifyEmail(emails.bcp_agent_withdrawal_real.from, emails.bcp_agent_withdrawal_real.subject).type, 'bcp_cash_withdrawal');
  const tx = api.parseEmail(emails.bcp_agent_withdrawal_real);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.channel, 'cash_withdrawal');
  assert.equal(tx.amount, 60);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.merchant, 'Agente BCP');
  assert.equal(tx.instrument, 'debito ****4321');
  assert.equal(tx.occurred_at, '2026-09-19T16:45:00-05:00');   // "16:45 PM" no suma 12
  assert.equal(tx.id, 'bcp:052446');
  assert.deepEqual(JSON.parse(JSON.stringify(tx.flags)), []);
  // El retiro del wardadito sigue siendo una transferencia propia.
  assert.equal(api.classifyEmail(emails.bcp_wardadito.from, emails.bcp_wardadito.subject).type, 'bcp_wardadito');
});

test('BCP pago con QR (yapeo de S/2 desde app BCP) → expense P2P con contraparte', () => {
  const tx = api.parseEmail(emails.bcp_qr_payment);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.channel, 'qr');
  assert.equal(tx.amount, 2);
  assert.equal(tx.counterparty_name, 'Maria Lop*');
  assert.equal(tx.counterparty_key, 'maria lop|261');
  assert.equal(tx.occurred_at, '2026-09-28T20:10:00-05:00');
});

test('BCP compra rechazada → ignorada', () => {
  const r = api.parseEmail(emails.bcp_rejected);
  assert.equal(r.ignored, true);
  assert.equal(r.reason, 'rejected_purchase');
});

test('Yape yapeo enviado P2P', () => {
  const tx = api.parseEmail(emails.yape_p2p_sent);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.channel, 'yape_p2p');
  assert.equal(tx.amount, 10);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.counterparty_name, 'Carlos Roj*');
  assert.equal(tx.counterparty_key, 'carlos roj|261');
  assert.equal(tx.operation_id, '3316121');
  assert.equal(tx.id, 'yape:3316121');
  assert.equal(tx.occurred_at, '2026-10-04T02:35:00-05:00');
});

test('Yape yapeo de servicio con empresa y servicio', () => {
  const tx = api.parseEmail(emails.yape_service);
  assert.equal(tx.amount, 10);
  assert.equal(tx.merchant, 'Metropolitano y Corredores');
  assert.equal(tx.service, 'Recarga de Tarjetas');
  assert.equal(tx.operation_id, '05388814');
  assert.equal(tx.occurred_at, '2026-09-15T20:20:00-05:00');
});

test('Yape recarga de celular (cuerpo con "etiqueta: valor")', () => {
  const tx = api.parseEmail(emails.yape_topup);
  assert.equal(tx.amount, 6);
  assert.equal(tx.operation_id, '00624363');
  assert.match(tx.merchant, /AMERICA MOVIL/);
  assert.equal(tx.occurred_at, '2026-08-08T10:00:00-05:00');
});

test('Yape envío automático (Yape Promos)', () => {
  const tx = api.parseEmail(emails.yape_auto_transfer);
  assert.equal(tx.amount, 27.8);
  assert.equal(tx.occurred_at, '2026-05-24T14:41:00-05:00');
  assert.equal(tx.operation_id, '8812233');
});

test('No transaccionales: marketing y otros remitentes', () => {
  assert.equal(api.parseEmail(emails.steam_other).ignored, true);
  const r = api.parseEmail(emails.yape_marketing);
  assert.equal(r.unknown, true);
  assert.equal(r.type, 'yape_unknown');
});

test('Sin fecha en el cuerpo → cae a la fecha del correo con flag', () => {
  const e = { ...emails.bcp_card_purchase_pen, id: 'm-x', html: emails.bcp_card_purchase_pen.html.replace('02 de octubre de 2026 - 09:06 PM', '—') };
  const tx = api.parseEmail(e);
  assert.ok(tx.flags.includes('date_from_header'));
  assert.equal(tx.occurred_at, '2026-10-02T21:06:00-05:00'); // 02:06Z → 21:06 Lima del día anterior
});

test('Consumo con Empresa = YAPE se marca como posible duplicado', () => {
  const e = { ...emails.bcp_card_purchase_pen, id: 'm-y', html: emails.bcp_card_purchase_pen.html.replace(/CA012 AVIACION/g, 'YAPE') };
  const tx = api.parseEmail(e);
  assert.ok(tx.flags.includes('possible_yape_duplicate'));
});

test('txFuzzyKey para cruzar push ↔ correo', () => {
  const tx = api.parseEmail(emails.yape_p2p_sent);
  assert.equal(api.txFuzzyKey(tx), 'PEN|10.00|2026-10-04T02:35');
});

test('[.eml real] Yape P2P con una celda por fila y monto partido "S/" + número', () => {
  const tx = api.parseEmail(emails.yape_p2p_sent_real);
  assert.equal(tx.amount, 10);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.counterparty_name, 'Carlos Roj*');
  assert.equal(tx.operation_id, '3316121');
  assert.equal(tx.occurred_at, '2026-10-04T02:35:00-05:00');
  eq(tx.flags, []);
});

test('[.eml real] consumo con tarjeta "PLIN-<nombre>" → P2P por Plin con contraparte', () => {
  const tx = api.parseEmail(emails.bcp_card_plin);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.channel, 'plin');
  assert.equal(tx.merchant, '');
  assert.equal(tx.counterparty_name, 'MARIA LOPEZ');
  assert.equal(tx.amount, 0.96);
  assert.equal(tx.currency, 'USD');
});

test('[.eml real] avisos de seguridad se ignoran; wardadito sin nº de operación usa id de Gmail y fecha 24h', () => {
  const n = api.parseEmail(emails.yape_login_notice);
  assert.equal(n.ignored, true); assert.equal(n.reason, 'notice');
  const w = api.parseEmail(emails.bcp_wardadito_real);
  assert.equal(w.kind, 'internal_transfer');
  assert.equal(w.amount, 10);
  assert.equal(w.occurred_at, '2026-10-02T21:05:00-05:00');
  assert.equal(w.id, 'gmail:m-bcp-ward-real');
});
