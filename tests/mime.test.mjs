import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const b64url = (s) => Buffer.from(s, 'latin1').toString('base64url');

/** Codifica texto UTF-8 como quoted-printable (suficiente para tests). */
function qp(s) {
  const bytes = Buffer.from(s, 'utf8');
  let out = '', line = '';
  for (const b of bytes) {
    const ch = (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0');
    if (line.length + ch.length > 72) { out += line + '=\r\n'; line = ''; }
    line += ch;
  }
  return out + line;
}

/** Mensaje RFC 822 multipart/alternative con plain en base64 y html en quoted-printable UTF-8. */
function rfc822(e, { htmlEnc = 'qp' } = {}) {
  const b = 'B0UNDARY';
  const htmlPart = htmlEnc === 'qp'
    ? `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${qp(e.html)}\r\n`
    : `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(e.html, 'utf8').toString('base64')}\r\n`;
  return [
    `From: ${e.from}`,
    `Subject: =?UTF-8?B?${Buffer.from(e.subject, 'utf8').toString('base64')}?=`,
    `Date: ${e.date.toUTCString()}`,
    `Content-Type: multipart/alternative; boundary="${b}"`,
    '', `--${b}`,
    'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
    Buffer.from('(texto)', 'utf8').toString('base64'),
    `--${b}`, htmlPart.trimEnd(), `--${b}--`, '',
  ].join('\r\n');
}

test('mimeParseMessage: multipart, quoted-printable UTF-8 y cabecera RFC 2047', () => {
  const h = makeHarness();
  const e = emails.yape_p2p_sent_real;
  const parsed = h.api.mimeParseMessage(rfc822(e));
  assert.equal(parsed.subject, e.subject);
  assert.match(parsed.from, /notificaciones@yape\.pe/);
  assert.equal(parsed.plain, '(texto)');
  assert.match(parsed.html, /Nombre del Beneficiario/);
  assert.match(parsed.html, /operaci&oacute;n|operación/);
  // El parser de correo extrae lo mismo que con el HTML directo.
  const tx = h.api.parseEmail({ id: 'x', from: parsed.from, subject: parsed.subject, date: parsed.date, html: parsed.html, plain: parsed.plain });
  assert.equal(tx.amount, 10);
  assert.equal(tx.operation_id, '3316121');
});

test('mimeParseMessage: html en base64 y latin1', () => {
  const h = makeHarness();
  const e = emails.bcp_card_purchase_pen;
  const parsed = h.api.mimeParseMessage(rfc822(e, { htmlEnc: 'b64' }));
  assert.match(parsed.html, /CA012 AVIACION/);
  const latin = Buffer.from('<p>Número de operación</p>', 'utf8').toString('latin1');
  const msg = `Content-Type: text/html; charset="ISO-8859-1"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${latin}`;
  // En el harness, getDataAsString ignora el charset: solo comprobamos que no rompe y conserva la estructura.
  assert.match(h.api.mimeParseMessage(msg).html, /mero de operaci/);
});

test('scanGmail_: si format=full no trae cuerpo, usa format=raw y el parser MIME (viaRaw)', () => {
  const e = emails.bcp_card_purchase_pen;
  const sinCuerpo = {
    id: 'm-sin-cuerpo', threadId: 't', internalDate: String(e.date.getTime()),
    payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: e.from }, { name: 'Subject', value: e.subject }], parts: [{ mimeType: 'text/html', body: { attachmentId: 'att-1', size: 16000 } }] },
    raw: b64url(rfc822(e)),
  };
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [sinCuerpo] });
  const st = h.api.scanGmail_(SID, configFor(h, SID), {});
  assert.equal(st.added, 1);
  assert.equal(st.viaRaw, 1);
  assert.equal(st.emptyBody, 0);
  const data = h.tab(SID, 'Movimientos');
  const hdr = data[0], fila = data[1];
  assert.equal(fila[hdr.indexOf('monto')], 53.3);
  assert.equal(fila[hdr.indexOf('operacion')], '176424');
  assert.ok(!String(fila[hdr.indexOf('flags')]).includes('no_amount'));
});

test('scanGmail_: sin cuerpo ni raw → emptyBody y flags no_amount, pero el escaneo sigue', () => {
  const e = emails.bcp_card_purchase_pen;
  const vacio = { id: 'm-vacio', threadId: 't', internalDate: String(e.date.getTime()), payload: { mimeType: 'text/html', headers: [{ name: 'From', value: e.from }, { name: 'Subject', value: e.subject }], body: {} } };
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [vacio] });
  const st = h.api.scanGmail_(SID, configFor(h, SID), {});
  assert.equal(st.emptyBody, 1);
  assert.equal(st.added, 1);
});

test('diagnosticarCorreo devuelve estructura sin contenido', () => {
  const e = emails.bcp_card_purchase_pen;
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: [{ ...toGmail(e), raw: b64url(rfc822(e)) }] });
  const d = h.api.dispatch('diagnosticarCorreo', [e.id], SID, configFor(h, SID));
  assert.equal(d.id, e.id);
  assert.ok(d.parts.length >= 2);
  assert.ok(d.raw.htmlLen > 100);
  assert.ok(d.text.fieldKeys.includes('empresa'));
  assert.equal(d.parse.amount, 53.3);
  assert.doesNotMatch(JSON.stringify(d), /CA012 AVIACION/);
});

function toGmail(e) {
  const b = (s) => Buffer.from(s, 'utf8').toString('base64url');
  return { id: e.id, threadId: 't-' + e.id, internalDate: String(e.date.getTime()), payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: e.from }, { name: 'Subject', value: e.subject }], parts: [{ mimeType: 'text/plain', body: { data: b('(t)') } }, { mimeType: 'text/html', body: { data: b(e.html) } }] } };
}
