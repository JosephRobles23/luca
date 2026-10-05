/**
 * Extractor opt-in con LLM (ADR-008): enmascarado de PII, umbral de aceptación, presupuesto, hook en
 * scanGmail_ y reintento manual (extraerDesconocidos). Todo con mock de UrlFetchApp: nunca hay red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails, toGmailApi } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';
const col = (data, name) => data[0].indexOf(name);
const plain = (x) => JSON.parse(JSON.stringify(x));
const http = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const geminiOk = (obj) => http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const payloadOf = (call) => JSON.parse(call.options.payload);
const userText = (call) => payloadOf(call).contents[0].parts[0].text;

/** Correo BCP sintético que el clasificador NO reconoce (asunto nuevo) con PII de todo tipo. */
const bcpUnknown = {
  id: 'm-bcp-unk-1', from: 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>', date: new Date('2026-10-04T15:30:00Z'),
  subject: 'Realizaste un pago de servicio con tu cuenta BCP',
  html: `<html><body><p>Hola <b>Juan Carlos Pérez</b>,</p>
  <p>Realizaste un pago de <b>S/ 45.00</b> a <b>LUZ DEL SUR</b>.</p>
  <table>
    <tr><td>Monto</td><td>S/ 45.00</td></tr>
    <tr><td>Fecha y hora</td><td>04 de octubre de 2026 - 10:30 AM</td></tr>
    <tr><td>Empresa</td><td>LUZ DEL SUR</td></tr>
    <tr><td>Beneficiario</td><td>Maria Fernanda Lopez</td></tr>
    <tr><td>Celular</td><td>987 654 321</td></tr>
    <tr><td>Cuenta de cargo</td><td>191-98765432-0-11</td></tr>
    <tr><td>N&uacute;mero de operaci&oacute;n</td><td>12345678</td></tr>
  </table>
  <p>Consultas: ayuda@viabcp.com</p></body></html>`
};
const yapeUnknown = {
  id: 'm-yape-unk-1', from: 'YAPE Notificaciones <notificaciones@yape.pe>', date: new Date('2026-10-04T20:00:00Z'),
  subject: 'Recibiste un pago por tu negocio',
  html: `<html><body><h2>Hola NOMBRE,</h2><p>Te yapearon</p><p><span>S/</span> <span>120.00</span></p>
  <table><tr><td>Yapero</td><td>Pedro Quispe H.</td></tr><tr><td>Fecha y hora</td><td>04 oct 2026 - 03:00 p. m.</td></tr><tr><td>N° de operaci&oacute;n</td><td>55512345</td></tr></table></body></html>`
};

function harnessExtract({ fetch, flag = 'true', withKey = true, spreadsheets, gmailMessages } = {}) {
  const ajustes = [['key', 'value'], ['llm.provider', 'gemini'], ['llm.extractUnknown', flag]];
  const h = makeHarness({ spreadsheets: { [SID]: { Ajustes: ajustes, ...(spreadsheets || {}) } }, fetch, gmailMessages });
  if (withKey) h.api.setSecret_('llmKey', KEY);
  return h;
}
const respuestaOk = { kind: 'expense', amount: 45, currency: 'PEN', occurred_at: '2026-10-04T10:30:00-05:00', merchant: 'LUZ DEL SUR', counterparty: '', operation_id: '', confidence: 0.92 };

// --- Enmascarado ---

test('maskPii_: sin secuencias de 7+ dígitos, saludo y etiquetas de persona → <NOMBRE>, correos → <EMAIL>', () => {
  const h = makeHarness();
  const text = h.api.emailText_(bcpUnknown);
  assert.match(text, /Juan Carlos Pérez/);                              // el texto crudo sí lo tiene
  const m = h.api.maskPii_(text);
  assert.doesNotMatch(m, /\d(?:[ .\-]?\d){6,}/, 'quedan 7+ dígitos: ' + m);
  assert.doesNotMatch(m, /Juan|Pérez|Maria|Lopez|viabcp/);
  assert.match(m, /^Hola <NOMBRE>,/m);
  assert.match(m, /Beneficiario\t<NOMBRE>/);
  assert.match(m, /<EMAIL>/);
  assert.match(m, /Celular\t#######/);
  assert.match(m, /Cuenta de cargo\t#######/);
  assert.match(m, /Número de operación\t#######/);
  assert.match(m, /S\/ 45\.00/);                                        // montos y fechas sobreviven
  assert.match(m, /04 de octubre de 2026 - 10:30 AM/);
  assert.match(m, /LUZ DEL SUR/);
  // Yape: "Yapero" y saludo en línea propia; números de operación de 8 dígitos también se enmascaran.
  const y = h.api.maskPii_(h.api.emailText_(yapeUnknown));
  assert.match(y, /Yapero\t<NOMBRE>/);
  assert.doesNotMatch(y, /Quispe|55512345/);
  assert.match(y, /120\.00/);
  assert.match(y, /Hola <NOMBRE>,\nTe yapearon/, 'el saludo no arrastra la línea siguiente');
  // Formas "etiqueta: valor" y "etiqueta\nvalor" (texto plano), saludo en medio de una frase, 4 celdas.
  assert.equal(h.api.maskPii_('Nombre del beneficiario: Ana Torres'), 'Nombre del beneficiario: <NOMBRE>');
  assert.equal(h.api.maskPii_('Yapero\nAna Torres\nMonto\nS/ 5'), 'Yapero\n<NOMBRE>\nMonto\nS/ 5');
  assert.equal(h.api.maskPii_('Estimado Luis Soto: tu pago fue exitoso'), 'Estimado <NOMBRE>: tu pago fue exitoso');
  assert.equal(h.api.maskPii_('Monto\tS/ 10\tTitular\tRosa Díaz'), 'Monto\tS/ 10\tTitular\t<NOMBRE>');
  assert.equal(h.api.maskPii_('1,234.50 y 2026-10-04 y 999 888 777'), '1,234.50 y 2026-10-04 y #######');
  assert.equal(h.api.maskPii_(''), '');
});

// --- extractWithLlm_ ---

test('extractWithLlm_: envía asunto + cuerpo enmascarados con esquema estricto y devuelve una tx normalizada con flag llm_extracted', () => {
  const h = harnessExtract({ fetch: () => geminiOk(respuestaOk) });
  const cfg = configFor(h, SID);
  assert.equal(cfg.llm.extractUnknown, true);
  const ctx = h.api.llmExtractContext_(SID, cfg);
  const email = h.api.gmailMessageToEmail(toGmailApi(bcpUnknown));
  assert.ok(h.api.parseEmail(email).unknown, 'el fixture debe ser desconocido para el parser determinista');
  const tx = plain(h.api.extractWithLlm_(email, ctx));
  assert.equal(h.fetchCalls.length, 1);
  const p = payloadOf(h.fetchCalls[0]);
  const u = userText(h.fetchCalls[0]);
  assert.match(u, /^Asunto: Realizaste un pago de servicio/);
  assert.doesNotMatch(u, /Juan|Pérez|Lopez|12345678|98765432|viabcp/);
  assert.match(u, /<NOMBRE>/);
  assert.match(u, /#######/);
  assert.match(p.systemInstruction.parts[0].text, /not_transaction/);
  assert.deepEqual(p.generationConfig.responseSchema.properties.kind.enum, ['expense', 'income', 'internal_transfer', 'rejected', 'not_transaction']);
  assert.deepEqual(p.generationConfig.responseSchema.properties.currency.enum, ['PEN', 'USD']);
  assert.deepEqual(p.generationConfig.responseSchema.required.sort(), ['amount', 'confidence', 'counterparty', 'currency', 'kind', 'merchant', 'occurred_at', 'operation_id'].sort());
  // Forma de parseEmail: id gmail:<id> (sin nº de operación), fuente/tipo del banco, categoría vacía.
  assert.equal(tx.id, 'gmail:m-bcp-unk-1');
  assert.equal(tx.source, 'bcp_email');
  assert.equal(tx.type, 'bcp_llm');
  assert.deepEqual(tx.flags, ['llm_extracted']);
  assert.equal(tx.kind, 'expense');
  assert.equal(tx.amount, 45);
  assert.equal(tx.currency, 'PEN');
  assert.equal(tx.occurred_at, '2026-10-04T10:30:00-05:00');
  assert.equal(tx.merchant, 'LUZ DEL SUR');
  assert.equal(tx.gmail_message_id, 'm-bcp-unk-1');
  assert.equal(tx.raw_subject, bcpUnknown.subject);
  assert.equal(tx.category, '');
  assert.equal(tx.category_source, '');
  assert.equal(tx.operation_id, '');
  assert.equal(ctx.llmCalls, 1);
  assert.ok(!h.logs.some((l) => /Juan|LUZ DEL SUR|45\.00/.test(JSON.stringify(l))), 'el log nunca lleva el texto del correo');
});

test('llmExtractToTx: operation_id válido → id bcp:<op>; fecha ausente → cabecera + date_from_header; respuestas sucias se sanean', () => {
  const h = makeHarness();
  const email = { id: 'g1', from: bcpUnknown.from, subject: bcpUnknown.subject, date: new Date('2026-10-04T15:30:00Z'), html: '' };
  const tx = plain(h.api.llmExtractToTx({ ...respuestaOk, operation_id: '176424', occurred_at: '' }, email, 'bcp'));
  assert.equal(tx.id, 'bcp:176424');
  assert.equal(tx.occurred_at, '2026-10-04T10:30:00-05:00');
  assert.deepEqual(tx.flags, ['llm_extracted', 'date_from_header']);
  // El modelo "reconstruye" lo enmascarado: se descarta.
  const sucio = plain(h.api.llmExtractToTx({ ...respuestaOk, operation_id: '#######', merchant: '<NOMBRE>', counterparty: '<NOMBRE>' }, email, 'yape'));
  assert.equal(sucio.operation_id, '');
  assert.equal(sucio.id, 'gmail:g1');
  assert.equal(sucio.merchant, '');
  assert.equal(sucio.counterparty_name, '');
  assert.equal(sucio.type, 'yape_llm');
  // Contraparte P2P → counterparty_key.
  const p2p = plain(h.api.llmExtractToTx({ ...respuestaOk, kind: 'income', merchant: '', counterparty: 'Pedro Q.' }, email, 'yape'));
  assert.equal(p2p.kind, 'income');
  assert.equal(p2p.counterparty_name, 'Pedro Q.');
  assert.equal(p2p.counterparty_key, 'pedro q.|');
  // Fecha sin offset ni segundos se completa con Lima; moneda desconocida → null.
  assert.equal(h.api.llmExtractToTx({ ...respuestaOk, occurred_at: '2026-10-04T10:30' }, email, 'bcp').occurred_at, '2026-10-04T10:30:00-05:00');
  assert.equal(h.api.llmExtractToTx({ ...respuestaOk, currency: 'EUR' }, email, 'bcp'), null);
});

test('extractWithLlm_: rechaza confianza < 0.7 o monto <= 0; not_transaction/rejected → ignored llm_not_transaction; errores → null', () => {
  const email = (h) => h.api.gmailMessageToEmail(toGmailApi(bcpUnknown));
  const casos = [
    [{ ...respuestaOk, confidence: 0.69 }, null],
    [{ ...respuestaOk, amount: 0 }, null],
    [{ ...respuestaOk, amount: -5 }, null],
    [{ ...respuestaOk, kind: 'desconocido' }, null],
    [{ ...respuestaOk, kind: 'not_transaction', amount: 0, confidence: 0.95 }, { ignored: true, reason: 'llm_not_transaction', type: 'bcp_llm', gmail_message_id: 'm-bcp-unk-1' }],
    [{ ...respuestaOk, kind: 'rejected', confidence: 0.9 }, { ignored: true, reason: 'llm_not_transaction', type: 'bcp_llm', gmail_message_id: 'm-bcp-unk-1' }],
    [{ ...respuestaOk, kind: 'not_transaction', confidence: 0.4 }, null]      // duda → sigue unknown
  ];
  for (const [resp, esperado] of casos) {
    const h = harnessExtract({ fetch: () => geminiOk(resp) });
    const ctx = h.api.llmExtractContext_(SID, configFor(h, SID));
    const r = h.api.extractWithLlm_(email(h), ctx);
    assert.deepEqual(r == null ? null : plain(r), esperado, JSON.stringify(resp));
    assert.equal(h.fetchCalls.length, 1);
  }
  // Error del proveedor: null, llmErrores++, sin texto del correo en el log.
  const h2 = harnessExtract({ fetch: () => http(500, 'boom') });
  const ctx2 = h2.api.llmExtractContext_(SID, configFor(h2, SID));
  assert.equal(h2.api.extractWithLlm_(email(h2), ctx2), null);
  assert.equal(ctx2.llmErrores, 1);
  assert.ok(!h2.logs.some((l) => /Juan|LUZ DEL SUR/.test(JSON.stringify(l))));
  // Remitente que no es banco → null sin llamada.
  const h3 = harnessExtract({ fetch: () => geminiOk(respuestaOk) });
  assert.equal(h3.api.extractWithLlm_(h3.api.gmailMessageToEmail(toGmailApi(emails.steam_other)), h3.api.llmExtractContext_(SID, configFor(h3, SID))), null);
  assert.equal(h3.fetchCalls.length, 0);
});

test('extractWithLlm_: respeta el presupuesto compartido (llamadas y tiempo) y no corre sin key', () => {
  const h = harnessExtract({ fetch: () => geminiOk(respuestaOk) });
  const cfg = configFor(h, SID);
  const email = h.api.gmailMessageToEmail(toGmailApi(bcpUnknown));
  const ctx = h.api.llmExtractContext_(SID, cfg, { llmBudget: 1 });
  assert.ok(h.api.extractWithLlm_(email, ctx));
  assert.equal(h.api.extractWithLlm_(email, ctx), null);
  assert.equal(h.fetchCalls.length, 1);
  // Mismo ctx para categorizar: ya no quedan llamadas.
  h.api.categorize_({ merchant: 'TIENDA RARA', amount: 5, currency: 'PEN', kind: 'expense' }, ctx);
  assert.equal(h.fetchCalls.length, 1);
  const ctxT = h.api.llmExtractContext_(SID, cfg, { llmBudgetMs: 0 });
  assert.equal(h.api.extractWithLlm_(email, ctxT), null);
  assert.equal(h.api.llmExtractContext_(SID, cfg).llmBudget, 15);
  const sinKey = harnessExtract({ withKey: false, fetch: () => geminiOk(respuestaOk) });
  assert.equal(sinKey.api.extractWithLlm_(email, sinKey.api.llmExtractContext_(SID, configFor(sinKey, SID))), null);
  assert.equal(sinKey.fetchCalls.length, 0);
});

// --- Hook en scanGmail_ ---

test('scanGmail_ con llm.extractUnknown=true: el correo desconocido se convierte en movimiento (flag llm_extracted) y _Procesados queda tx:llm', () => {
  const inbox = [emails.bcp_card_purchase_pen, bcpUnknown, yapeUnknown, emails.yape_marketing].map(toGmailApi);
  const fetch = (url, opt) => {
    const u = JSON.parse(opt.payload).contents[0].parts[0].text;
    if (/pago de servicio/.test(u)) return geminiOk(respuestaOk);
    if (/Recibiste un pago/.test(u)) return geminiOk({ kind: 'income', amount: 120, currency: 'PEN', occurred_at: '2026-10-04T15:00:00-05:00', merchant: '', counterparty: '', operation_id: '', confidence: 0.85 });
    if (/DSCTO/.test(u)) return geminiOk({ kind: 'not_transaction', amount: 0, currency: 'PEN', occurred_at: '', merchant: '', counterparty: '', operation_id: '', confidence: 0.99 });
    return geminiOk({ categoria: 'Servicios', confianza: 0.9 });        // categorización (ya la resuelve la regla)
  };
  const h = harnessExtract({ fetch, gmailMessages: inbox });
  const st = plain(h.api.scanGmail_(SID, configFor(h, SID), {}));
  assert.equal(st.processed, 4);
  assert.equal(st.added, 3);
  assert.equal(st.llmExtracted, 2);
  assert.equal(st.unknown, 0);
  assert.equal(st.ignored, 1);
  assert.equal(st.llmCalls, 4, '3 extracciones + 1 categorización (CA012 AVIACION) comparten el presupuesto');
  const data = h.tab(SID, 'Movimientos');
  const porId = Object.fromEntries(data.slice(1).map((r) => [r[col(data, 'id')], r]));
  const luz = porId['gmail:m-bcp-unk-1'];
  assert.equal(luz[col(data, 'flags')], 'llm_extracted');
  assert.equal(luz[col(data, 'fuente')], 'bcp_email');
  assert.equal(luz[col(data, 'comercio')], 'LUZ DEL SUR');
  assert.equal(luz[col(data, 'monto')], 45);
  assert.equal(luz[col(data, 'categoria')], 'Servicios');              // la regla categoriza igual que a cualquier tx
  assert.equal(luz[col(data, 'categoria_origen')], 'rule');
  assert.equal(porId['gmail:m-yape-unk-1'][col(data, 'tipo')], 'income');
  const proc = h.tab(SID, '_Procesados');
  const porGmail = Object.fromEntries(proc.slice(1).map((r) => [r[col(proc, 'gmail_id')], [r[col(proc, 'resultado')], r[col(proc, 'tipo')]]]));
  assert.deepEqual(porGmail['m-bcp-unk-1'], ['tx:llm', 'bcp_llm']);
  assert.deepEqual(porGmail['m-yape-unk-1'], ['tx:llm', 'yape_llm']);
  assert.deepEqual(porGmail['m-yape-5'], ['ignored:llm_not_transaction', 'yape_llm']);
  assert.deepEqual(porGmail['m-bcp-1'], ['tx', 'bcp_card_purchase']);
  // Si el LLM duda, el correo queda unknown como hoy.
  const h2 = harnessExtract({ fetch: () => geminiOk({ ...respuestaOk, confidence: 0.2 }), gmailMessages: [toGmailApi(bcpUnknown)] });
  const st2 = plain(h2.api.scanGmail_(SID, configFor(h2, SID), {}));
  assert.equal(st2.unknown, 1);
  assert.equal(st2.llmExtracted, 0);
  assert.equal(h2.tab(SID, '_Procesados')[1][1], 'unknown');
});

test('scanGmail_ con la casilla apagada (default) o sin key: ningún correo viaja al LLM y los desconocidos quedan unknown', () => {
  const inbox = [bcpUnknown, yapeUnknown].map(toGmailApi);
  const off = harnessExtract({ flag: 'false', fetch: () => geminiOk(respuestaOk), gmailMessages: inbox });
  const st = plain(off.api.scanGmail_(SID, configFor(off, SID), {}));
  assert.equal(st.unknown, 2);
  assert.equal(st.llmExtracted, 0);
  assert.equal(off.fetchCalls.length, 0);
  // Sin la clave en Ajustes (instalaciones previas): default 'false'.
  const h = makeHarness({ spreadsheets: { [SID]: {} }, gmailMessages: inbox, fetch: () => geminiOk(respuestaOk) });
  h.api.setSecret_('llmKey', KEY);
  assert.equal(configFor(h, SID).ajustes['llm.extractUnknown'], 'false');
  assert.equal(configFor(h, SID).llm.extractUnknown, false);
  assert.equal(plain(h.api.scanGmail_(SID, configFor(h, SID), {})).unknown, 2);
  assert.equal(h.fetchCalls.length, 0);
  // Casilla activa pero sin key: tampoco.
  const sinKey = harnessExtract({ withKey: false, fetch: () => geminiOk(respuestaOk), gmailMessages: inbox });
  assert.equal(plain(sinKey.api.scanGmail_(SID, configFor(sinKey, SID), {})).unknown, 2);
  assert.equal(sinKey.fetchCalls.length, 0);
});

// --- extraerDesconocidos ---

test('extraerDesconocidos (dispatch): relee los unknown de _Procesados, añade movimientos, actualiza la fila a tx:llm y respeta limit', () => {
  const PROC = ['gmail_id', 'resultado', 'tipo', 'fecha', 'asunto', 'remitente'];
  const procesados = [PROC,
    ['m-bcp-1', 'tx', 'bcp_card_purchase', '', '', ''],
    ['m-bcp-unk-1', 'unknown', 'bcp_unknown', '', bcpUnknown.subject, bcpUnknown.from],
    ['m-yape-5', 'unknown', 'yape_unknown', '', '', ''],
    ['m-yape-unk-1', 'unknown', 'yape_unknown', '', '', ''],
    ['m-perdido', 'unknown', 'bcp_unknown', '', '', '']
  ];
  const fetch = (url, opt) => {
    const u = JSON.parse(opt.payload).contents[0].parts[0].text;
    if (/pago de servicio/.test(u)) return geminiOk(respuestaOk);
    if (/DSCTO/.test(u)) return geminiOk({ kind: 'not_transaction', amount: 0, currency: 'PEN', occurred_at: '', merchant: '', counterparty: '', operation_id: '', confidence: 0.99 });
    if (/Recibiste un pago/.test(u)) return geminiOk({ ...respuestaOk, confidence: 0.3 });   // duda → sigue unknown
    return geminiOk({ categoria: 'Servicios', confianza: 0.9 });
  };
  const h = harnessExtract({ fetch, spreadsheets: { _Procesados: procesados }, gmailMessages: [emails.bcp_card_purchase_pen, bcpUnknown, yapeUnknown, emails.yape_marketing].map(toGmailApi) });
  const cfg = configFor(h, SID);
  assert.equal(h.api.estadoLuca(SID, cfg).llm.desconocidos, 4);
  assert.equal(h.api.estadoLuca(SID, cfg).llm.extractUnknown, true);
  const r = plain(h.api.dispatch('extraerDesconocidos', [{ limit: 3 }], SID, cfg));
  assert.deepEqual(r, { procesados: 3, extraidos: 1, ignorados: 1, llmCalls: 3, llmErrores: 0, restantes: 2 });
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data.length, 2);
  assert.equal(data[1][col(data, 'id')], 'gmail:m-bcp-unk-1');
  assert.equal(data[1][col(data, 'flags')], 'llm_extracted');
  const proc = h.tab(SID, '_Procesados');
  const porGmail = Object.fromEntries(proc.slice(1).map((row) => [row[0], [row[1], row[2]]]));
  assert.deepEqual(porGmail['m-bcp-unk-1'], ['tx:llm', 'bcp_llm']);
  assert.deepEqual(porGmail['m-yape-5'], ['ignored:llm_not_transaction', 'yape_llm']);
  assert.deepEqual(porGmail['m-yape-unk-1'], ['unknown', 'yape_unknown']);
  assert.deepEqual(porGmail['m-perdido'], ['unknown', 'bcp_unknown']);           // fuera del limit
  assert.deepEqual(porGmail['m-bcp-1'], ['tx', 'bcp_card_purchase']);
  assert.equal(proc.length, 6, 'no se añaden filas: se actualizan');
  // Segunda pasada: solo quedan 2 unknown; el mensaje que Gmail ya no tiene no rompe la pasada.
  const r2 = plain(h.api.extraerDesconocidos(SID, configFor(h, SID), {}));
  assert.equal(r2.procesados, 2);
  assert.equal(r2.extraidos, 0);
  assert.equal(r2.restantes, 2);
  assert.equal(h.api.estadoLuca(SID, configFor(h, SID)).llm.desconocidos, 2);
  // Idempotente respecto al ledger: un unknown ya extraído antes no se duplica.
  const h3 = harnessExtract({ fetch, spreadsheets: { _Procesados: [PROC, ['m-bcp-unk-1', 'unknown', 'bcp_unknown', '', '', '']] }, gmailMessages: [toGmailApi(bcpUnknown)] });
  h3.api.extraerDesconocidos(SID, configFor(h3, SID), {});
  h3.api.setProcesadoRow_(h3.api.processedSheet_(SID, configFor(h3, SID)), { resultado: 2 }, 2, 'unknown');
  h3.api.extraerDesconocidos(SID, configFor(h3, SID), {});
  assert.equal(h3.tab(SID, 'Movimientos').length, 2);
  // Guardas: sin key / casilla apagada → error claro y ninguna llamada.
  const sinKey = harnessExtract({ withKey: false, spreadsheets: { _Procesados: procesados } });
  assert.throws(() => sinKey.api.extraerDesconocidos(SID, configFor(sinKey, SID), {}), /API key/);
  const off = harnessExtract({ flag: 'false', spreadsheets: { _Procesados: procesados } });
  assert.throws(() => off.api.extraerDesconocidos(SID, configFor(off, SID), {}), /casilla/);
  assert.equal(off.fetchCalls.length, 0);
});

test('guardarAjustes desde el sidebar persiste llm.extractUnknown y construirConfig lo refleja', () => {
  const h = harnessExtract({ flag: 'false' });
  h.api.dispatch('guardarAjustes', [{ 'llm.extractUnknown': 'true' }], SID, configFor(h, SID));
  assert.equal(configFor(h, SID).llm.extractUnknown, true);
  h.api.dispatch('guardarAjustes', [{ 'llm.extractUnknown': 'false' }], SID, configFor(h, SID));
  assert.equal(configFor(h, SID).llm.extractUnknown, false);
});
