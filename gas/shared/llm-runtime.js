/**
 * llm-runtime.js — Adapter único hacia el LLM (ADR-004 §3): Gemini (por defecto), OpenAI, Anthropic.
 *
 * Contrato:
 *  - Nadie más llama a UrlFetchApp para el LLM; todo pasa por callLLM_(cfg, { system, user, schema }).
 *  - La API key es POR USUARIO: getSecret_('llmKey') (UserProperties). Nunca en Script Properties,
 *    nunca en la URL, nunca en logs ni en mensajes de error.
 *  - Proveedor y modelo vienen de `config.llm` (Ajustes `llm.provider`, `llm.model`); si el modelo
 *    está vacío o pertenece a otro proveedor, se usa el default del proveedor (LLM_DEFAULT_MODELS_).
 *  - Salida siempre JSON contra un esquema: Gemini responseSchema, OpenAI json_schema estricto,
 *    Anthropic tool-use forzado. callLLM_ devuelve el objeto ya parseado.
 *  - Reintento con backoff ante 429/5xx (máx. LLM_MAX_RETRIES_); 4xx no se reintenta.
 *  - Lo que viaja al LLM lo decide el caller (categorize-runtime.js): solo comercio + monto + moneda + canal.
 *
 * Sin import/export: runtime de Apps Script. Privados con sufijo "_".
 */

var LLM_DEFAULT_PROVIDER_ = 'gemini';
var LLM_DEFAULT_MODELS_ = {
  gemini: 'gemini-3.7-flash',
  openai: 'gpt-5-mini',
  anthropic: 'claude-haiku-4-5-20251001'
};
var LLM_ENDPOINTS_ = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages'
};
var LLM_ANTHROPIC_VERSION_ = '2023-06-01';
var LLM_TIMEOUT_MS_ = 20 * 1000;
var LLM_MAX_RETRIES_ = 2;                 // intentos totales = 1 + LLM_MAX_RETRIES_
var LLM_BACKOFF_MS_ = [1000, 3000];
var LLM_MAX_TOKENS_ = 256;               // respuestas JSON cortas ({categoria, confianza})

function llmProveedores_() { return Object.keys(LLM_DEFAULT_MODELS_); }

/** Modelo efectivo: el de Ajustes salvo que esté vacío o sea el default de OTRO proveedor. */
function llmModel_(provider, model) {
  var m = str_(model).trim();
  if (!m) return LLM_DEFAULT_MODELS_[provider];
  var deOtro = llmProveedores_().some(function (p) { return p !== provider && LLM_DEFAULT_MODELS_[p] === m; });
  return deOtro ? LLM_DEFAULT_MODELS_[provider] : m;
}

/**
 * Resuelve { provider, model, key } a partir del CONFIG (o de un objeto ya resuelto).
 * `cfg.llmKey` permite inyectar la key ya leída (el ctx de categorización la lee una vez por pasada).
 */
function llmConfig_(cfg) {
  cfg = cfg || {};
  var llm = cfg.llm || cfg;
  var provider = str_(llm.provider).trim().toLowerCase() || LLM_DEFAULT_PROVIDER_;
  if (!LLM_DEFAULT_MODELS_[provider]) throw new Error('Proveedor de LLM no soportado: ' + provider);
  var key = cfg.llmKey || getSecret_('llmKey');
  return { provider: provider, model: llmModel_(provider, llm.model), key: key };
}

// --- Esquemas ---

/** Copia profunda del esquema sin `additionalProperties` (Gemini lo rechaza con 400). */
function llmSchemaGemini_(schema) {
  var s = JSON.parse(JSON.stringify(schema || {}));
  (function limpiar(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(limpiar); return; }
    delete o.additionalProperties;
    Object.keys(o).forEach(function (k) { limpiar(o[k]); });
  })(s);
  return s;
}

/** Esquema estricto para OpenAI: todo objeto con additionalProperties:false y todas sus propiedades requeridas. */
function llmSchemaStrict_(schema) {
  var s = JSON.parse(JSON.stringify(schema || {}));
  (function cerrar(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(cerrar); return; }
    if (o.type === 'object' && o.properties) {
      o.additionalProperties = false;
      o.required = Object.keys(o.properties);
    }
    Object.keys(o).forEach(function (k) { cerrar(o[k]); });
  })(s);
  return s;
}

// --- Request por proveedor ---

/** @return {{url:string, headers:Object, payload:Object}} */
function llmBuildRequest_(resolved, req) {
  var system = str_(req.system), user = str_(req.user), schema = req.schema || { type: 'object' };
  if (resolved.provider === 'gemini') {
    return {
      url: LLM_ENDPOINTS_.gemini + '/' + encodeURIComponent(resolved.model) + ':generateContent',
      headers: { 'x-goog-api-key': resolved.key },
      payload: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: llmSchemaGemini_(schema) }
      }
    };
  }
  if (resolved.provider === 'openai') {
    return {
      url: LLM_ENDPOINTS_.openai,
      headers: { Authorization: 'Bearer ' + resolved.key },
      payload: {
        model: resolved.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_schema', json_schema: { name: 'respuesta', strict: true, schema: llmSchemaStrict_(schema) } }
      }
    };
  }
  // anthropic: tool-use forzado = el modelo solo puede responder con el JSON del esquema.
  return {
    url: LLM_ENDPOINTS_.anthropic,
    headers: { 'x-api-key': resolved.key, 'anthropic-version': LLM_ANTHROPIC_VERSION_ },
    payload: {
      model: resolved.model,
      max_tokens: LLM_MAX_TOKENS_,
      system: system,
      messages: [{ role: 'user', content: user }],
      tools: [{ name: 'responder', description: 'Devuelve la respuesta estructurada.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'responder' }
    }
  };
}

// --- Parse por proveedor ---

function llmParseJson_(text) {
  var s = str_(text).trim();
  if (!s) throw new Error('respuesta vacía');
  // Tolera ```json ... ``` si algún modelo lo envuelve.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch (e) { throw new Error('respuesta no es JSON válido'); }
}

/** Cuerpo HTTP 200 → objeto parseado. Lanza si no hay contenido utilizable. */
function llmParseResponse_(provider, body) {
  var json;
  try { json = JSON.parse(body); } catch (e) { throw new Error('cuerpo no-JSON'); }
  if (provider === 'gemini') {
    if (json.promptFeedback && json.promptFeedback.blockReason) throw new Error('prompt bloqueado: ' + json.promptFeedback.blockReason);
    var cand = json.candidates && json.candidates[0];
    var parts = cand && cand.content && cand.content.parts || [];
    return llmParseJson_(parts.map(function (p) { return p && p.text || ''; }).join(''));
  }
  if (provider === 'openai') {
    var msg = json.choices && json.choices[0] && json.choices[0].message;
    if (!msg) throw new Error('sin choices');
    if (msg.refusal) throw new Error('rechazado por el modelo');
    return llmParseJson_(msg.content);
  }
  var content = json.content || [];
  for (var i = 0; i < content.length; i++) {
    if (content[i] && content[i].type === 'tool_use' && content[i].input && typeof content[i].input === 'object') return content[i].input;
  }
  var texto = content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('');
  return llmParseJson_(texto);
}

/** Mensaje de error legible y SIN secretos: código + `error.message` recortado, con la key tachada si el proveedor la eco. */
function llmErrorSummary_(code, body, key) {
  var detalle = '';
  try {
    var j = JSON.parse(body);
    var e = j.error || j;
    detalle = str_(e && (e.message || e.type || e.status));
  } catch (err) { detalle = str_(body).slice(0, 120); }
  detalle = detalle.replace(/\s+/g, ' ').slice(0, 160);
  if (key) detalle = detalle.split(key).join('•••');
  return 'HTTP ' + code + (detalle ? ': ' + detalle : '');
}

/**
 * callLLM_(cfg, { system, user, schema }) → objeto JSON ya parseado según `schema`.
 * `cfg` es el CONFIG (usa cfg.llm y, si viene, cfg.llmKey). Lanza Error con mensaje sin secretos.
 */
function callLLM_(cfg, req) {
  req = req || {};
  var resolved = llmConfig_(cfg);
  if (!resolved.key) throw new Error('No hay API key del LLM configurada.');
  var r = llmBuildRequest_(resolved, req);
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: r.headers,
    payload: JSON.stringify(r.payload),
    muteHttpExceptions: true,
    timeout: LLM_TIMEOUT_MS_
  };
  var lastErr = '';
  for (var intento = 0; intento <= LLM_MAX_RETRIES_; intento++) {
    if (intento > 0) Utilities.sleep(LLM_BACKOFF_MS_[Math.min(intento - 1, LLM_BACKOFF_MS_.length - 1)]);
    var res = UrlFetchApp.fetch(r.url, options);
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code === 200) return llmParseResponse_(resolved.provider, body);
    lastErr = llmErrorSummary_(code, body, resolved.key);
    Logger.log('callLLM_ %s/%s intento %s: %s', resolved.provider, resolved.model, intento + 1, lastErr);
    if (code === 429 || code >= 500) continue;
    break;
  }
  throw new Error('LLM (' + resolved.provider + ') falló: ' + lastErr);
}

/**
 * probarLlm(sheetId, config) — "Probar key" del sidebar: una llamada mínima con el proveedor/modelo
 * configurados. Nunca lanza: devuelve { ok, provider, model, ms, mensaje } y deja el resultado en
 * Ajustes (`llm.lastTestAt`, `llm.lastError`) para que la web lo muestre.
 */
function probarLlm(sheetId, config) {
  var t0 = Date.now();
  var resolved = null, out;
  try {
    resolved = llmConfig_(config);
    if (!resolved.key) throw new Error('Pega primero tu API key y guárdala.');
    var r = callLLM_(config, {
      system: 'Responde únicamente con JSON.',
      user: 'Devuelve {"ok": true}.',
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }
    });
    if (!r || r.ok !== true) throw new Error('El modelo respondió algo inesperado.');
    out = { ok: true, provider: resolved.provider, model: resolved.model, ms: Date.now() - t0, mensaje: 'Conexión correcta con ' + resolved.provider + ' (' + resolved.model + ').' };
  } catch (e) {
    out = { ok: false, provider: resolved && resolved.provider || '', model: resolved && resolved.model || '', ms: Date.now() - t0, mensaje: String(e && e.message || e) };
  }
  try { setAjustes_(sheetId, config, { 'llm.lastTestAt': new Date().toISOString(), 'llm.lastError': out.ok ? '' : out.mensaje }); } catch (e2) {}
  return out;
}
