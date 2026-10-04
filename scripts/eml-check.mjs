#!/usr/bin/env node
/**
 * Pasa correos .eml reales por el parser de LucaLib (sin tocar Google).
 *   node scripts/eml-check.mjs docs/gmails/*.eml            # resumen por correo
 *   node scripts/eml-check.mjs --text archivo.eml           # además imprime el texto extraído
 *   node scripts/eml-check.mjs --fixture archivo.eml        # imprime un fixture anonimizable (JSON)
 * Los .eml y su salida contienen PII: no commitear.
 */
import fs from 'node:fs';
import { makeHarness } from '../tests/gas-harness.mjs';

const args = process.argv.slice(2);
const showText = args.includes('--text');
const asFixture = args.includes('--fixture');
const files = args.filter((a) => !a.startsWith('--'));

function decodeQP(s) {
  return s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function decodeBody(raw, enc, charset) {
  let buf;
  if (/base64/i.test(enc)) buf = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  else if (/quoted-printable/i.test(enc)) buf = Buffer.from(decodeQP(raw), 'latin1');
  else buf = Buffer.from(raw, 'latin1');
  try { return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
}
function decodeHeader(v) {
  return String(v || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, t, data) => {
    const buf = t.toUpperCase() === 'B' ? Buffer.from(data, 'base64') : Buffer.from(decodeQP(data.replace(/_/g, ' ')), 'latin1');
    try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
  }).replace(/\s+/g, ' ').trim();
}
function parseHeaders(block) {
  const h = {};
  block.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((line) => {
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m) h[m[1].toLowerCase()] = m[2];
  });
  return h;
}
/** Devuelve { html, plain } recorriendo multipart recursivamente. */
function parts(rawMsg) {
  const idx = rawMsg.search(/\r?\n\r?\n/);
  const headers = parseHeaders(rawMsg.slice(0, idx));
  const body = rawMsg.slice(idx).replace(/^\r?\n\r?\n/, '');
  const ct = headers['content-type'] || 'text/plain';
  const out = { html: '', plain: '' };
  const boundary = /boundary="?([^";]+)"?/i.exec(ct)?.[1];
  if (/multipart\//i.test(ct) && boundary) {
    body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\r?\\n?`)).slice(1).forEach((p) => {
      if (!p.trim()) return;
      const sub = parts(p);
      if (sub.html && !out.html) out.html = sub.html;
      if (sub.plain && !out.plain) out.plain = sub.plain;
    });
    return out;
  }
  const charset = /charset="?([^";]+)"?/i.exec(ct)?.[1];
  const text = decodeBody(body, headers['content-transfer-encoding'] || '7bit', charset);
  if (/text\/html/i.test(ct)) out.html = text; else if (/text\/plain/i.test(ct)) out.plain = text;
  return out;
}

export function emlToEmail(path) {
  const raw = fs.readFileSync(path, 'latin1');
  const idx = raw.search(/\r?\n\r?\n/);
  const h = parseHeaders(raw.slice(0, idx));
  const { html, plain } = parts(raw);
  return {
    id: 'eml:' + (h['message-id'] || path).replace(/[<>]/g, ''),
    from: decodeHeader(h['from']),
    subject: decodeHeader(h['subject']),
    date: new Date(h['date']),
    html, plain,
  };
}

const h = makeHarness();
for (const f of files) {
  const email = emlToEmail(f);
  const cls = h.api.classifyEmail(email.from, email.subject);
  const r = h.api.parseEmail(email);
  console.log('\n═══', f.split('/').pop());
  console.log('from   :', email.from, '| subject:', email.subject, '| date:', email.date.toISOString());
  console.log('class  :', cls, '| html:', email.html.length, 'chars | plain:', email.plain.length, 'chars');
  if (r.ignored || r.unknown) console.log('result :', r);
  else console.log('result :', { id: r.id, kind: r.kind, amount: r.amount, currency: r.currency, occurred_at: r.occurred_at, merchant: r.merchant, counterparty: r.counterparty_name, instrument: r.instrument, op: r.operation_id, fx: r.fx_rate, flags: r.flags });
  if (showText) { console.log('--- texto ---'); console.log(h.api.htmlToText(email.html)); console.log('--- campos ---'); console.log(h.api.extractFields(h.api.htmlToText(email.html))); }
  if (asFixture) console.log(JSON.stringify({ from: email.from, subject: email.subject, date: email.date, html: email.html }, null, 2));
}
