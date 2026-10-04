/**
 * M3 — LLM opcional (ADR-004): adapter callLLM_ (Gemini/OpenAI/Anthropic) con mock de UrlFetchApp,
 * categorizeWithLlm_ (umbral, lista blanca, presupuesto, errores) y categorizarPendientes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness, configFor } from './gas-harness.mjs';
import { emails } from './fixtures/emails.mjs';

const SID = 'sheet-1';
const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';
const col = (data, name) => data[0].indexOf(name);
const plain = (x) => JSON.parse(JSON.stringify(x));

const http = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const geminiOk = (obj) => http(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
const openaiOk = (obj) => http(200, { choices: [{ message: { role: 'assistant', content: JSON.stringify(obj) } }] });
const anthropicOk = (obj) => http(200, { content: [{ type: 'tool_use', id: 't1', name: 'responder', input: obj }] });

const LEDGER_HEADERS = ['id', 'fecha', 'tipo', 'monto', 'moneda', 'tipo_cambio', 'comercio', 'contraparte', 'contraparte_key', 'categoria', 'categoria_origen', 'medio', 'canal', 'fuente', 'operacion', 'gmail_id', 'flags', 'asunto', 'creado_en'];
function ledgerRow(o) {
  return LEDGER_HEADERS.map((h) => (o[h] == null ? '' : o[h]));
}

/** Harness con key guardada y Ajustes de proveedor; `fetch` recibe (url, options) y devuelve http(...). */
function harnessLlm({ provider = 'gemini', model = '', fetch, spreadsheets, withKey = true } = {}) {
  const ajustes = [['key', 'value'], ['llm.provider', provider]];
  if (model) ajustes.push(['llm.model', model]);
  const h = makeHarness({ spreadsheets: { [SID]: { Ajustes: ajustes, ...(spreadsheets || {}) } }, fetch });
  if (withKey) h.api.setSecret_('llmKey', KEY);
  return h;
}
const payloadOf = (call) => JSON.parse(call.options.payload);
const req = { system: 'sistema', user: 'Comercio: X\nMonto: 10 PEN', schema: { type: 'object', properties: { categoria: { type: 'string', enum: ['A', 'B'] }, confianza: { type: 'number' } }, required: ['categoria', 'confianza'] } };

// --- callLLM_: forma del request y parseo por proveedor ---

test('callLLM_ gemini: generateContent v1beta, key en header, responseSchema JSON sin additionalProperties, modelo por defecto', () => {
  const h = harnessLlm({ provider: 'gemini', fetch: () => geminiOk({ categoria: 'A', confianza: 0.9 }) });
  const out = h.api.callLLM_(configFor(h, SID), req);
  assert.deepEqual(plain(out), { categoria: 'A', confianza: 0.9 });
  assert.equal(h.fetchCalls.length, 1);
  const c = h.fetchCalls[0];
  assert.equal(c.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent');
  assert.equal(c.options.headers['x-goog-api-key'], KEY);
  assert.doesNotMatch(c.url, new RegExp(KEY));
  assert.equal(c.options.muteHttpExceptions, true);
  assert.equal(c.options.timeout, 20000);
  const p = payloadOf(c);
  assert.equal(p.systemInstruction.parts[0].text, 'sistema');
  assert.equal(p.contents[0].parts[0].text, req.user);
  assert.equal(p.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(p.generationConfig.responseSchema.properties.categoria.enum, ['A', 'B']);
  assert.equal('additionalProperties' in p.generationConfig.responseSchema, false);
});

test('callLLM_ openai: chat completions con response_format json_schema estricto y Bearer', () => {
  const h = harnessLlm({ provider: 'openai', fetch: () => openaiOk({ categoria: 'B', confianza: 0.7 }) });
  const out = h.api.callLLM_(configFor(h, SID), req);
  assert.deepEqual(plain(out), { categoria: 'B', confianza: 0.7 });
  const c = h.fetchCalls[0];
  assert.equal(c.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(c.options.headers.Authorization, 'Bearer ' + KEY);
  const p = payloadOf(c);
  assert.equal(p.model, 'gpt-5-mini');                       // el default de Ajustes es de gemini → se usa el de openai
  assert.deepEqual(p.messages.map((m) => m.role), ['system', 'user']);
  assert.equal(p.response_format.type, 'json_schema');
  assert.equal(p.response_format.json_schema.strict, true);
  assert.equal(p.response_format.json_schema.schema.additionalProperties, false);
  assert.deepEqual(p.response_format.json_schema.schema.required, ['categoria', 'confianza']);
});

test('callLLM_ anthropic: messages API con tool-use forzado; parsea tool_use.input y, si no, texto JSON', () => {
  const h = harnessLlm({ provider: 'anthropic', model: 'claude-sonnet-4-5', fetch: () => anthropicOk({ categoria: 'A', confianza: 0.8 }) });
  const out = h.api.callLLM_(configFor(h, SID), req);
  assert.deepEqual(plain(out), { categoria: 'A', confianza: 0.8 });
  const c = h.fetchCalls[0];
  assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(c.options.headers['x-api-key'], KEY);
  assert.equal(c.options.headers['anthropic-version'], '2023-06-01');
  const p = payloadOf(c);
  assert.equal(p.model, 'claude-sonnet-4-5');                // modelo explícito en Ajustes se respeta
  assert.equal(p.system, 'sistema');
  assert.equal(p.messages[0].content, req.user);
  assert.equal(p.tools[0].name, 'responder');
  assert.deepEqual(p.tools[0].input_schema.properties.categoria.enum, ['A', 'B']);
  assert.deepEqual(p.tool_choice, { type: 'tool', name: 'responder' });
  assert.ok(p.max_tokens > 0);
  // Fallback: bloque de texto con JSON (incluso envuelto en ```json).
  const h2 = harnessLlm({ provider: 'anthropic', fetch: () => http(200, { content: [{ type: 'text', text: '```json\n{"categoria":"B","confianza":0.65}\n```' }] }) });
  assert.deepEqual(plain(h2.api.callLLM_(configFor(h2, SID), req)), { categoria: 'B', confianza: 0.65 });
});

test('callLLM_ reintenta 429/5xx con backoff (máx. 2 reintentos), no reintenta 4xx y nunca expone la key', () => {
  let n = 0;
  const h = harnessLlm({ fetch: () => { n++; return n === 1 ? http(429, { error: { message: 'rate' } }) : n === 2 ? http(503, 'upstream') : geminiOk({ categoria: 'A', confianza: 1 }); } });
  assert.equal(plain(h.api.callLLM_(configFor(h, SID), req)).categoria, 'A');
  assert.equal(h.fetchCalls.length, 3);

  const h2 = harnessLlm({ fetch: () => http(429, { error: { message: 'quota ' + KEY } }) });
  assert.throws(() => h2.api.callLLM_(configFor(h2, SID), req), (e) => /HTTP 429/.test(e.message) && !e.message.includes(KEY));
  assert.equal(h2.fetchCalls.length, 3);

  const h3 = harnessLlm({ fetch: () => http(401, { error: { message: 'API key not valid' } }) });
  assert.throws(() => h3.api.callLLM_(configFor(h3, SID), req), /HTTP 401: API key not valid/);
  assert.equal(h3.fetchCalls.length, 1);
  assert.ok(!h3.logs.some((l) => JSON.stringify(l).includes(KEY)), 'la key no aparece en los logs');

  const h4 = harnessLlm({ fetch: () => http(200, { candidates: [{ content: { parts: [{ text: 'no json' }] } }] }) });
  assert.throws(() => h4.api.callLLM_(configFor(h4, SID), req), /no es JSON/);
  assert.equal(h4.fetchCalls.length, 1);

  const h5 = harnessLlm({ withKey: false, fetch: () => geminiOk({}) });
  assert.throws(() => h5.api.callLLM_(configFor(h5, SID), req), /No hay API key/);
  assert.equal(h5.fetchCalls.length, 0);
  assert.throws(() => h.api.callLLM_({ llm: { provider: 'otro' }, llmKey: KEY }, req), /no soportado/);
});

// --- categorizeWithLlm_ dentro del escaneo ---

test('categorizeWithLlm_: envía solo comercio + monto + moneda + canal + categorías; acepta confianza >= 0.6 y escribe origen llm en Movimientos y Comercios', () => {
  const h = harnessLlm({ fetch: () => geminiOk({ categoria: 'Comidas fuera', confianza: 0.82 }) });
  const cfg = configFor(h, SID);
  const tx = h.api.parseEmail(emails.bcp_card_purchase_pen);      // CA012 AVIACION, sin regla ni caché
  h.api.appendTransactions_(SID, cfg, [tx]);
  assert.equal(h.fetchCalls.length, 1);
  const p = payloadOf(h.fetchCalls[0]);
  const user = p.contents[0].parts[0].text;
  assert.match(user, /Comercio: CA012 AVIACION/);
  assert.match(user, /Monto: 53\.3 PEN/);
  assert.doesNotMatch(user, /1816|176424|Tarjeta|m-bcp/);          // ni tarjeta, ni operación, ni ids
  assert.doesNotMatch(p.systemInstruction.parts[0].text, /1816|CA012/);
  assert.ok(p.generationConfig.responseSchema.properties.categoria.enum.includes('Comidas fuera'));
  assert.ok(!p.generationConfig.responseSchema.properties.categoria.enum.includes('Ingreso'), 'gasto: no ofrece Ingreso');
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], 'Comidas fuera');
  assert.equal(data[1][col(data, 'categoria_origen')], 'llm');
  const com = h.tab(SID, 'Comercios');
  const fila = com.slice(1).find((r) => r[col(com, 'clave')] === 'ca012 aviacion');
  assert.equal(fila[col(com, 'categoria')], 'Comidas fuera');
  assert.equal(fila[col(com, 'categoria_origen')], 'llm');
  // Segunda vez el mismo comercio: caché, sin llamada.
  h.api.appendTransactions_(SID, configFor(h, SID), [{ ...tx, id: 'bcp:2', operation_id: '2', gmail_message_id: 'm-2' }]);
  assert.equal(h.fetchCalls.length, 1);
  assert.equal(h.tab(SID, 'Movimientos')[2][col(data, 'categoria_origen')], 'cache');
});

test('categorizeWithLlm_: rechaza confianza < 0.6 y categorías fuera de la lista (queda por categorizar)', () => {
  const tx = (h) => h.api.parseEmail(emails.bcp_card_purchase_pen);
  const h1 = harnessLlm({ fetch: () => geminiOk({ categoria: 'Comidas fuera', confianza: 0.55 }) });
  h1.api.appendTransactions_(SID, configFor(h1, SID), [tx(h1)]);
  let data = h1.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], '');
  assert.equal(data[1][col(data, 'categoria_origen')], '');

  const h2 = harnessLlm({ fetch: () => geminiOk({ categoria: 'Aviación', confianza: 0.99 }) });
  h2.api.appendTransactions_(SID, configFor(h2, SID), [tx(h2)]);
  data = h2.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], '');
  const com = h2.tab(SID, 'Comercios');
  assert.equal(com.slice(1).find((r) => r[col(com, 'clave')] === 'ca012 aviacion')[col(com, 'categoria')], '');
});

test('categorizeWithLlm_: respeta el presupuesto de llamadas (ctx.llmBudget) y no repite un comercio ya preguntado', () => {
  const h = harnessLlm({ fetch: () => geminiOk({ categoria: 'Otros', confianza: 0.3 }) });   // nunca acepta → no cachea
  const cfg = configFor(h, SID);
  const ctx = h.api.categorizeContext_(SID, cfg, { llmBudget: 2 });
  assert.equal(ctx.llmBudget, 2);
  for (const m of ['TIENDA UNO', 'TIENDA DOS', 'TIENDA TRES', 'TIENDA CUATRO']) h.api.categorize_({ merchant: m, amount: 5, currency: 'PEN', kind: 'expense', source: 'bcp_email' }, ctx);
  assert.equal(h.fetchCalls.length, 2);
  assert.equal(ctx.llmCalls, 2);
  // Mismo comercio dos veces en una pasada = una sola pregunta.
  const ctx2 = h.api.categorizeContext_(SID, cfg, { llmBudget: 10 });
  h.api.categorize_({ merchant: 'TIENDA X', amount: 5, currency: 'PEN', kind: 'expense' }, ctx2);
  h.api.categorize_({ merchant: 'TIENDA X', amount: 7, currency: 'PEN', kind: 'expense' }, ctx2);
  assert.equal(ctx2.llmCalls, 1);
  // Presupuesto de tiempo agotado → ninguna llamada.
  const ctx3 = h.api.categorizeContext_(SID, cfg, { llmBudgetMs: 0 });
  h.api.categorize_({ merchant: 'TIENDA Y', amount: 5, currency: 'PEN', kind: 'expense' }, ctx3);
  assert.equal(ctx3.llmCalls, 0);
  // El default es 15.
  assert.equal(h.api.categorizeContext_(SID, cfg).llmBudget, 15);
});

test('categorizeWithLlm_: un error del proveedor devuelve null y el escaneo sigue (fila añadida, por categorizar)', () => {
  const h = harnessLlm({ fetch: () => { throw new Error('DNS error'); } });
  const cfg = configFor(h, SID);
  const txs = [h.api.parseEmail(emails.bcp_card_purchase_pen), h.api.parseEmail(emails.yape_service)];
  const r = h.api.appendTransactions_(SID, cfg, txs);
  assert.equal(r.added, 2);
  const data = h.tab(SID, 'Movimientos');
  assert.equal(data[1][col(data, 'categoria')], '');
  assert.equal(data[2][col(data, 'categoria')], 'Transporte');     // la regla no depende del LLM
  assert.ok(!h.logs.some((l) => JSON.stringify(l).includes('CA012')), 'el log no lleva el nombre del comercio');
  // HTTP 500 persistente también → null sin romper.
  const h2 = harnessLlm({ fetch: () => http(500, 'boom') });
  assert.equal(h2.api.appendTransactions_(SID, configFor(h2, SID), [h2.api.parseEmail(emails.bcp_card_purchase_pen)]).added, 1);
});

// --- categorizarPendientes ---

test('categorizarPendientes: reglas → caché → LLM sobre filas sin categoría, escribe en lote y respeta limit', () => {
  const h = harnessLlm({
    fetch: () => geminiOk({ categoria: 'Supermercado', confianza: 0.9 }),
    spreadsheets: {
      Movimientos: [LEDGER_HEADERS,
        ledgerRow({ id: 'bcp:1', tipo: 'expense', monto: 12, moneda: 'PEN', comercio: 'UBER TRIP', fuente: 'bcp_email' }),
        ledgerRow({ id: 'bcp:2', tipo: 'expense', monto: 53.3, moneda: 'PEN', comercio: 'CA012 AVIACION', fuente: 'bcp_email' }),
        ledgerRow({ id: 'bcp:3', tipo: 'expense', monto: 80, moneda: 'PEN', comercio: 'MINIMARKET LA ESQUINA', fuente: 'bcp_email' }),
        ledgerRow({ id: 'bcp:4', tipo: 'expense', monto: 9, moneda: 'PEN', comercio: 'CINEPLANET', categoria: 'Ocio', categoria_origen: 'user' }),
        ledgerRow({ id: 'bcp:5', tipo: 'expense', monto: 15, moneda: 'PEN', comercio: 'BODEGA DON PEPE', fuente: 'bcp_email' })
      ],
      Comercios: [['clave', 'nombre', 'categoria', 'categoria_origen', 'veces', 'actualizado_en'], ['ca012 aviacion', 'CA012 AVIACION', 'Comidas fuera', 'llm', 3, '']]
    }
  });
  const cfg = configFor(h, SID);
  const r = plain(h.api.dispatch('categorizarPendientes', [{ limit: 3 }], SID, cfg));
  assert.deepEqual(r, { procesadas: 3, categorizadas: 3, llmCalls: 1, llmErrores: 0, restantes: 1 });
  const data = h.tab(SID, 'Movimientos');
  const porId = Object.fromEntries(data.slice(1).map((row) => [row[col(data, 'id')], [row[col(data, 'categoria')], row[col(data, 'categoria_origen')]]]));
  assert.deepEqual(porId['bcp:1'], ['Transporte', 'rule']);
  assert.deepEqual(porId['bcp:2'], ['Comidas fuera', 'cache']);
  assert.deepEqual(porId['bcp:3'], ['Supermercado', 'llm']);
  assert.deepEqual(porId['bcp:4'], ['Ocio', 'user']);               // no se toca
  assert.deepEqual(porId['bcp:5'], ['', '']);                      // fuera del limit
  const com = h.tab(SID, 'Comercios');
  const esquina = com.slice(1).find((row) => row[col(com, 'clave')] === 'minimarket la esquina');
  assert.equal(esquina[col(com, 'categoria')], 'Supermercado');
  assert.equal(esquina[col(com, 'categoria_origen')], 'llm');
  assert.equal(com.slice(1).find((row) => row[col(com, 'clave')] === 'ca012 aviacion')[col(com, 'veces')], 3, 'recategorizar no infla veces');
  // Segunda pasada: solo queda bcp:5 → una llamada más, nada pendiente.
  const r2 = plain(h.api.categorizarPendientes(SID, configFor(h, SID), {}));
  assert.deepEqual(r2, { procesadas: 1, categorizadas: 1, llmCalls: 1, llmErrores: 0, restantes: 0 });
  assert.equal(h.fetchCalls.length, 2);
  // Sin key: reglas y caché siguen funcionando, sin red.
  const h2 = harnessLlm({ withKey: false, spreadsheets: { Movimientos: [LEDGER_HEADERS, ledgerRow({ id: 'x', tipo: 'expense', monto: 1, moneda: 'PEN', comercio: 'NETFLIX.COM' }), ledgerRow({ id: 'y', tipo: 'expense', monto: 1, moneda: 'PEN', comercio: 'ALGO RARO' })] } });
  assert.deepEqual(plain(h2.api.categorizarPendientes(SID, configFor(h2, SID), {})), { procesadas: 2, categorizadas: 1, llmCalls: 0, llmErrores: 0, restantes: 1 });
  assert.equal(h2.fetchCalls.length, 0);
  // Ledger vacío.
  const h3 = harnessLlm({});
  assert.equal(plain(h3.api.categorizarPendientes(SID, configFor(h3, SID), {})).procesadas, 0);
});

test('runDispatcher: al final de la pasada categoriza pendientes solo si hay key (y un fallo no rompe la pasada)', () => {
  const ledger = () => [LEDGER_HEADERS, ledgerRow({ id: 'bcp:9', tipo: 'expense', monto: 20, moneda: 'PEN', comercio: 'ALGO RARO', fuente: 'bcp_email' })];
  const sin = harnessLlm({ withKey: false, spreadsheets: { Movimientos: ledger() } });
  const out1 = plain(sin.api.runDispatcher(SID, configFor(sin, SID)));
  assert.equal(out1.llm, undefined);
  assert.equal(sin.fetchCalls.length, 0);

  const con = harnessLlm({ fetch: () => geminiOk({ categoria: 'Otros', confianza: 0.75 }), spreadsheets: { Movimientos: ledger() } });
  const out2 = plain(con.api.runDispatcher(SID, configFor(con, SID)));
  assert.equal(out2.llm.categorizadas, 1);
  assert.equal(out2.llm.llmCalls, 1);
  assert.equal(con.fetchCalls.length, 1);
  const data = con.tab(SID, 'Movimientos');
  assert.deepEqual([data[1][col(data, 'categoria')], data[1][col(data, 'categoria_origen')]], ['Otros', 'llm']);
  const stats = JSON.parse(con.api.getAjustes_(SID, configFor(con, SID))['scan.lastStats']);
  assert.equal(stats.llm.categorizadas, 1);

  const roto = harnessLlm({ fetch: () => { throw new Error('sin red'); }, spreadsheets: { Movimientos: ledger() } });
  const out3 = plain(roto.api.runDispatcher(SID, configFor(roto, SID)));
  assert.ok(out3.scan, 'la pasada termina');
  assert.equal(out3.llm.categorizadas, 0);
  assert.equal(out3.llm.llmErrores, 1);
});

// --- probarLlm y estado para el sidebar ---

test('probarLlm: una llamada mínima; devuelve ok/error sin lanzar y deja llm.lastTestAt / llm.lastError en Ajustes', () => {
  const h = harnessLlm({ fetch: () => geminiOk({ ok: true }) });
  const r = plain(h.api.dispatch('probarLlm', [], SID, configFor(h, SID)));
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'gemini');
  assert.equal(r.model, 'gemini-3.7-flash');
  assert.equal(h.fetchCalls.length, 1);
  let a = h.api.getAjustes_(SID, configFor(h, SID));
  assert.ok(a['llm.lastTestAt']);
  assert.equal(a['llm.lastError'], '');

  const h2 = harnessLlm({ provider: 'openai', fetch: () => http(401, { error: { message: 'Incorrect API key provided' } }) });
  const r2 = plain(h2.api.probarLlm(SID, configFor(h2, SID)));
  assert.equal(r2.ok, false);
  assert.match(r2.mensaje, /HTTP 401: Incorrect API key/);
  assert.ok(!r2.mensaje.includes(KEY));
  a = h2.api.getAjustes_(SID, configFor(h2, SID));
  assert.match(a['llm.lastError'], /401/);

  const h3 = harnessLlm({ withKey: false });
  assert.equal(plain(h3.api.probarLlm(SID, configFor(h3, SID))).ok, false);
  assert.equal(h3.fetchCalls.length, 0);

  // estadoLuca expone proveedor/modelo/defaults para el sidebar, nunca la key.
  const st = plain(h.api.estadoLuca(SID, configFor(h, SID)));
  assert.equal(st.llm.provider, 'gemini');
  assert.deepEqual(st.llm.proveedores, ['gemini', 'openai', 'anthropic']);
  assert.equal(st.llm.defaults.anthropic, 'claude-haiku-4-5-20251001');
  assert.ok(!JSON.stringify(st).includes(KEY));
});
