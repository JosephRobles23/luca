/**
 * llm-extract-runtime.js — Extractor OPT-IN con LLM para correos transaccionales que el clasificador
 * determinista no reconoce (`bcp_unknown` / `yape_unknown`). Decisión del 2026-10-05 (ADR-008).
 *
 * Contrato:
 *  - Solo corre si hay API key (`llmDisponible_`) Y `Ajustes.llm.extractUnknown` = 'true'. Por defecto
 *    está apagado: ADR-004 sigue vigente (al LLM solo viajan comercio + monto) salvo que el usuario
 *    active esta casilla en el sidebar.
 *  - Antes de enviar, `maskPii_` enmascara el texto: toda secuencia de ≥7 dígitos → '#######',
 *    correos → '<EMAIL>', la línea de saludo ("Hola <Nombre>,") y los valores de etiquetas de persona
 *    (Yapero, Beneficiario, Nombre, Titular, Destinatario, Remitente…) → '<NOMBRE>'.
 *    Límites (mejor esfuerzo): nombres que aparecen fuera de un saludo o de una etiqueta conocida
 *    (p. ej. en una frase libre) no se detectan; números de operación de ≥7 dígitos también quedan
 *    enmascarados, así que esos movimientos reciben id `gmail:<id>`; montos ≥ 1 000 000 se enmascaran.
 *  - Respuesta JSON estricta (LLM_EXTRACT_SCHEMA_). Se acepta solo si confidence >= 0.7 y amount > 0;
 *    `not_transaction` / `rejected` con confianza suficiente → { ignored, reason: 'llm_not_transaction' }.
 *  - Presupuesto: el mismo ctx de categorización (`categorizeContext_`: llmBudget / llmDeadline), así
 *    extracción + categorización comparten las 15 llamadas por pasada.
 *  - Nunca se loguea el texto del correo (ni crudo ni enmascarado): solo motivos técnicos.
 *
 * Sin import/export: runtime de Apps Script. Privadas con sufijo "_".
 */

var LLM_EXTRACT_MIN_CONFIANZA_ = 0.7;
var LLM_EXTRACT_MAX_CHARS_ = 4000;
var LLM_EXTRACT_KINDS_ = ['expense', 'income', 'internal_transfer', 'rejected', 'not_transaction'];
var LLM_EXTRACT_NAME_LABELS_ = /(yapero|beneficiari[oa]|nombre|titular|destinatari[oa]|remitente|ordenante|cliente|enviado a|recibido de)/i;

var LLM_EXTRACT_SCHEMA_ = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: LLM_EXTRACT_KINDS_ },
    amount: { type: 'number' },
    currency: { type: 'string', enum: ['PEN', 'USD'] },
    occurred_at: { type: 'string' },
    merchant: { type: 'string' },
    counterparty: { type: 'string' },
    operation_id: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['kind', 'amount', 'currency', 'occurred_at', 'merchant', 'counterparty', 'operation_id', 'confidence']
};

/** True si el usuario activó la casilla (Ajustes `llm.extractUnknown`). La key se comprueba aparte. */
function llmExtractEnabled_(config) {
  if (!config) return false;
  if (config.llm && config.llm.extractUnknown != null) return !!config.llm.extractUnknown;
  return bool_(config.ajustes && config.ajustes['llm.extractUnknown']);
}

/** Contexto con presupuesto compartido con la categorización (misma forma que categorizeContext_). */
function llmExtractContext_(sheetId, config, opts) {
  return categorizeContext_(sheetId, config, opts);
}

// --- Enmascarado ---

/**
 * Enmascara PII en el texto del correo antes de enviarlo al LLM. Ver límites en la cabecera.
 *  - correos → '<EMAIL>'
 *  - saludo "Hola <Nombre>," / "Estimado <Nombre>:" → 'Hola <NOMBRE>,'
 *  - "Etiqueta<TAB>valor", "Etiqueta: valor" o "Etiqueta\nvalor" cuando la etiqueta es de persona → '<NOMBRE>'
 *  - secuencias de ≥7 dígitos (aunque lleven espacios, puntos o guiones entre medio) → '#######'
 */
function maskPii_(text) {
  var s = String(text || '');
  s = s.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<EMAIL>');
  // Saludo: "Hola Juan Pérez," · "Estimada María:" · "Querido cliente Juan" (hasta fin de celda/línea).
  s = s.replace(/\b(hola|estimad[oa]s?|querid[oa]s?)\s+[^\n\t,:;!.]{1,80}/gi, function (m, g) { return cap_(g) + ' <NOMBRE>'; });
  var lines = s.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var cells = lines[i].split('\t');
    if (cells.length >= 2) {
      // Tabla etiqueta<TAB>valor (también 4 celdas: etiqueta, valor, etiqueta, valor).
      for (var c = 0; c + 1 < cells.length; c += 2) if (esEtiquetaPersona_(cells[c])) cells[c + 1] = '<NOMBRE>';
      lines[i] = cells.join('\t');
      continue;
    }
    var m = /^([^:\n]{3,60}):\s*(.+)$/.exec(lines[i]);
    if (m && esEtiquetaPersona_(m[1])) { lines[i] = m[1] + ': <NOMBRE>'; continue; }
    // Etiqueta sola y el valor en la línea siguiente (cuerpos en texto plano).
    if (lines[i].length <= 40 && esEtiquetaPersona_(lines[i]) && !/\d/.test(lines[i]) && i + 1 < lines.length && lines[i + 1].indexOf('\t') < 0 && lines[i + 1].length <= 80) {
      lines[i + 1] = '<NOMBRE>';
      i++;
    }
  }
  s = lines.join('\n');
  // ≥7 dígitos (con espacios, puntos o guiones entre medio); las fechas ISO (2026-10-04[T10:30]) se conservan.
  s = s.replace(/(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?)|\d(?:[ .\-]?\d){6,}/g, function (m, iso) { return iso ? iso : '#######'; });
  return s;
}

/** Etiqueta cuyo valor es una persona. Ignora el marcador <NOMBRE> ya puesto y las líneas de saludo. */
function esEtiquetaPersona_(label) {
  var l = String(label || '').replace(/<NOMBRE>/g, '');
  return LLM_EXTRACT_NAME_LABELS_.test(l) && !/^\s*(hola|estimad|querid)/i.test(l);
}

function cap_(w) { w = String(w || ''); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

// --- Prompt ---

/** Texto enmascarado y recortado que viaja al LLM (asunto + cuerpo). */
function llmExtractInput_(email) {
  var cuerpo = maskPii_(emailText_(email)).slice(0, LLM_EXTRACT_MAX_CHARS_);
  var asunto = maskPii_(str_(email.subject)).slice(0, 200);
  return { subject: asunto, body: cuerpo };
}

function llmExtractPrompt_(bank, input) {
  var system = 'Extraes datos de correos de notificación bancaria de Perú (' + (bank === 'yape' ? 'Yape' : 'BCP') + '). ' +
    'El texto llega con nombres y números largos enmascarados (<NOMBRE>, #######); no intentes reconstruirlos. ' +
    'Responde solo JSON con: kind (expense = gasto o pago hecho por el titular; income = abono recibido; ' +
    'internal_transfer = entre cuentas propias del titular; rejected = operación rechazada; not_transaction = aviso, ' +
    'publicidad o cualquier correo sin un movimiento de dinero concreto), amount (número > 0; 0 si no hay), ' +
    'currency (PEN o USD), occurred_at (ISO 8601 con offset -05:00, p. ej. 2026-10-02T21:06:00-05:00, o "" si no aparece), ' +
    'merchant (nombre del negocio/empresa o ""), counterparty (persona receptora si es P2P, "" si está enmascarada o no hay), ' +
    'operation_id (número de operación tal cual o "" si no aparece o está enmascarado), ' +
    'confidence (0 a 1; usa menos de ' + LLM_EXTRACT_MIN_CONFIANZA_ + ' si dudas del tipo o del monto).';
  var user = 'Asunto: ' + input.subject + '\n---\n' + input.body;
  return { system: system, user: user, schema: LLM_EXTRACT_SCHEMA_ };
}

// --- Normalización de la respuesta ---

function llmExtractIso_(v) {
  var s = str_(v).trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?$/.test(s) ? (s.length === 16 ? s + ':00' + LIMA_OFFSET_ : s) : null;
}

function llmExtractOpId_(v) {
  var s = str_(v).trim();
  return /^[A-Za-z0-9-]{3,30}$/.test(s) && !/#/.test(s) ? s : '';
}

/**
 * Respuesta del LLM → transacción normalizada (misma forma que parseEmail), { ignored } o null si no se acepta.
 * Expuesta sin "_" para los tests (sin red).
 */
function llmExtractToTx(out, email, bank) {
  if (!out || typeof out !== 'object') return null;
  var kind = str_(out.kind).trim();
  var conf = Number(out.confidence);
  if (LLM_EXTRACT_KINDS_.indexOf(kind) < 0 || !(conf >= LLM_EXTRACT_MIN_CONFIANZA_)) return null;
  if (kind === 'not_transaction' || kind === 'rejected') {
    return { ignored: true, reason: 'llm_not_transaction', type: bank + '_llm', gmail_message_id: email.id || '' };
  }
  var amount = Number(out.amount);
  if (!(amount > 0)) return null;
  var currency = str_(out.currency).trim().toUpperCase();
  if (currency !== 'PEN' && currency !== 'USD') return null;
  var merchant = normalizeMerchant(out.merchant);
  var counterparty = str_(out.counterparty).replace(/<NOMBRE>|#+/g, '').trim();
  if (/<NOMBRE>|#/.test(merchant)) merchant = '';
  var tx = {
    gmail_message_id: email.id || '',
    raw_subject: str_(email.subject),
    source: bank + '_email',
    type: bank + '_llm',
    flags: ['llm_extracted'],
    kind: kind,
    amount: Math.round(amount * 100) / 100,
    currency: currency,
    occurred_at: llmExtractIso_(out.occurred_at),
    merchant: merchant,
    counterparty_name: counterparty,
    counterparty_key: counterparty ? counterpartyKey(counterparty, '') : '',
    instrument: '',
    channel: '',
    operation_id: llmExtractOpId_(out.operation_id)
  };
  return finalizeTx_(tx, email);
}

// --- Extractor ---

/**
 * extractWithLlm_(email, ctx) → tx normalizada (flags ['llm_extracted'], type `<bank>_llm`),
 * { ignored:true, reason:'llm_not_transaction' } o null (sin presupuesto, sin key, baja confianza o error).
 * Nunca lanza. `ctx` es el de categorizeContext_ / llmExtractContext_.
 */
function extractWithLlm_(email, ctx) {
  if (!email || !llmDisponible_(ctx)) return null;
  var cls = classifyEmail(email.from, email.subject);
  if (!cls.bank) return null;
  try {
    var input = llmExtractInput_(email);
    if (!input.body.trim()) return null;
    var p = llmExtractPrompt_(cls.bank, input);
    ctx.llmCalls++;
    var out = callLLM_({ llm: ctx.config.llm, llmKey: ctx.llmKey }, p);
    return llmExtractToTx(out, email, cls.bank);
  } catch (e) {
    ctx.llmErrores++;
    // Solo el motivo técnico: nunca el texto del correo ni la key.
    Logger.log('extractWithLlm_: ' + String(e && e.message || e).slice(0, 200));
    return null;
  }
}

// --- Reintento manual desde el sidebar ---

/** Cuenta filas `unknown` en `_Procesados` (para el sidebar). */
function contarDesconocidos_(sheetId, config) {
  var n = 0;
  readRows_(processedSheet_(sheetId, config)).forEach(function (r) { if (str_(r.resultado) === 'unknown') n++; });
  return n;
}

/**
 * extraerDesconocidos(sheetId, config, { limit, llmBudget }) — relee los correos marcados `unknown` en
 * `_Procesados`, los pasa por el extractor y añade los movimientos. La fila pasa a `tx:llm`
 * (o `ignored:llm_not_transaction`); si el LLM no se decide, se queda `unknown`.
 * @return {{procesados:number, extraidos:number, ignorados:number, llmCalls:number, llmErrores:number, restantes:number}}
 */
function extraerDesconocidos(sheetId, config, args) {
  args = args || {};
  if (!getSecret_('llmKey')) throw new Error('Configura primero una API key del LLM.');
  if (!llmExtractEnabled_(config)) throw new Error('Activa primero la casilla "Extraer con IA los correos que Luca no reconoce".');
  var limit = int_(args.limit, 20);
  var sh = processedSheet_(sheetId, config);
  var map = getHeaderMap_(sh);
  var rows = readRows_(sh);
  var ctx = llmExtractContext_(sheetId, config, { llmBudget: args.llmBudget, llmBudgetMs: args.llmBudgetMs });
  var out = { procesados: 0, extraidos: 0, ignorados: 0, llmCalls: 0, llmErrores: 0, restantes: 0 };
  var txs = [], filas = {};
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i].resultado) !== 'unknown') continue;
    var id = str_(rows[i].gmail_id).trim();
    if (!id || out.procesados >= limit || !llmDisponible_(ctx)) { out.restantes++; continue; }
    out.procesados++;
    var email = null;
    try { email = gmailGetEmail_(id); } catch (e) { Logger.log('extraerDesconocidos: no se pudo leer un correo: ' + String(e && e.message || e).slice(0, 120)); }
    var r = email ? extractWithLlm_(email, ctx) : null;
    if (r && r.ignored) {
      out.ignorados++;
      setProcesadoRow_(sh, map, i + 2, 'ignored:' + r.reason, r.type);
    } else if (r) {
      txs.push(r);
      filas[id] = i + 2;
    } else {
      out.restantes++;
    }
  }
  if (txs.length) {
    appendTransactions_(sheetId, config, txs, ctx);
    txs.forEach(function (tx) { out.extraidos++; setProcesadoRow_(sh, map, filas[tx.gmail_message_id], 'tx:llm', tx.type); });
  }
  out.llmCalls = ctx.llmCalls;
  out.llmErrores = ctx.llmErrores;
  return out;
}

function setProcesadoRow_(sh, map, row, resultado, tipo) {
  if (!row) return;
  if (map['resultado']) sh.getRange(row, map['resultado']).setValue(resultado);
  if (map['tipo'] && tipo) sh.getRange(row, map['tipo']).setValue(tipo);
  if (map['fecha']) sh.getRange(row, map['fecha']).setValue(new Date().toISOString());
}
