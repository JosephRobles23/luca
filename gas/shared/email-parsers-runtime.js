/**
 * email-parsers-runtime.js — Parser determinista de correos transaccionales de BCP y Yape.
 *
 * Diseño (docs/discovery/formatos-correos-bcp-yape.md):
 *  1) clasificar por remitente + asunto (estable),
 *  2) convertir el HTML a texto conservando celdas (tab) y filas (salto de línea),
 *  3) extraer pares etiqueta → valor de las tablas,
 *  4) normalizar monto/moneda/fecha a un esquema único.
 * Nada sale del Apps Script del usuario: sin LLM en esta etapa.
 *
 * Entrada: { id, from, subject, date: Date, html, plain }.
 * Salida:  ver buildTx_() — o { ignored: true, reason } / { unknown: true, type }.
 *
 * Sin import/export: runtime de Apps Script. Funciones públicas sin "_" para tests.
 */

var BCP_SENDER_ = 'notificacionesbcp.com.pe';
var YAPE_SENDER_ = 'yape.pe';
var LIMA_OFFSET_ = '-05:00';   // Perú no tiene horario de verano.

// --- 1) Clasificación ---

/** Quita acentos y pasa a minúsculas (para comparar asuntos/etiquetas). */
function fold_(s) {
  var t = String(s == null ? '' : s).toLowerCase();
  return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
}

var EMAIL_TYPES_ = [
  // BCP
  { bank: 'bcp',  type: 'bcp_card_purchase',     re: /realizaste un consumo con tu tarjeta/ },
  { bank: 'bcp',  type: 'bcp_internal_transfer', re: /transferencia entre mis cuentas/ },
  { bank: 'bcp',  type: 'bcp_wardadito',         re: /retiro de tu wardadito/ },
  { bank: 'bcp',  type: 'bcp_qr_payment',        re: /constancia de pago con qr/ },
  { bank: 'bcp',  type: 'bcp_rejected',          re: /se rechazo tu compra/ },
  // Avisos no transaccionales (se ignoran, no quedan como desconocidos)
  { bank: 'yape', type: 'yape_notice',           re: /ingresaste a yape|cambio de clave|nuevo dispositivo|bienvenid/ },
  { bank: 'bcp',  type: 'bcp_notice',            re: /ingresaste|clave|bienvenid|actualiza tus datos|no te olvides|recordatorio|vence|promoci/ },
  // Yape
  { bank: 'yape', type: 'yape_p2p_sent',         re: /te notificaremos por cada yapeo/ },
  { bank: 'yape', type: 'yape_service',          re: /yapeo de servicio ha sido confirmado/ },
  { bank: 'yape', type: 'yape_topup',            re: /recarga en yape ha sido confirmada/ },
  { bank: 'yape', type: 'yape_auto_transfer',    re: /constancia de transferencia/ }
];

/** @return {{bank:string|null, type:string}} */
function classifyEmail(from, subject) {
  var f = fold_(from), s = fold_(subject);
  var bank = f.indexOf(BCP_SENDER_) >= 0 ? 'bcp' : (f.indexOf('@' + YAPE_SENDER_) >= 0 ? 'yape' : null);
  if (!bank) return { bank: null, type: 'not_transactional' };
  for (var i = 0; i < EMAIL_TYPES_.length; i++) {
    if (EMAIL_TYPES_[i].bank === bank && EMAIL_TYPES_[i].re.test(s)) return { bank: bank, type: EMAIL_TYPES_[i].type };
  }
  return { bank: bank, type: bank + '_unknown' };
}

// --- 2) HTML → texto con estructura ---

var HTML_ENTITIES_ = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", iexcl: '¡', iquest: '¿', ordm: 'º', ordf: 'ª', deg: '°',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ' };

function decodeEntities_(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
    if (e[0] === '#') {
      var code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(code) ? m : String.fromCharCode(code);
    }
    return HTML_ENTITIES_[e] != null ? HTML_ENTITIES_[e] : m;
  });
}

/** Convierte HTML a líneas de texto; celdas separadas por TAB, filas por salto de línea. */
function htmlToText(html) {
  var s = String(html || '');
  s = s.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\/(td|th)>/gi, '\t');
  s = s.replace(/<br[^>]*>/gi, ' ');
  s = s.replace(/<(\/tr|\/p|\/div|\/li|\/h[1-6]|\/table)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities_(s);
  s = s.replace(/ /g, ' ');
  return s.split('\n')
    .map(function (line) {
      // Normaliza espacios dentro de cada celda y elimina celdas vacías.
      var cells = line.split('\t').map(function (c) { return c.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      return cells.join('\t');
    })
    .filter(Boolean)
    .join('\n');
}

/** Texto plano del mensaje: HTML si existe, si no el cuerpo plano. */
function emailText_(email) {
  if (email.html) return htmlToText(email.html);
  return String(email.plain || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).join('\n');
}

// --- 3) Pares etiqueta → valor ---

function labelKey_(s) {
  return fold_(s).replace(/[*:º°]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Devuelve { etiquetaNormalizada: valor } a partir de líneas "etiqueta<TAB>valor",
 * "etiqueta: valor" o "etiqueta" seguida del valor en la línea siguiente.
 */
function extractFields(text) {
  var lines = String(text || '').split('\n');
  var out = {};
  for (var i = 0; i < lines.length; i++) {
    var cells = lines[i].split('\t');
    if (cells.length >= 2) {
      var k = labelKey_(cells[0]);
      if (k && out[k] == null) out[k] = cells.slice(1).join(' ').trim();
      // Tablas con 4 celdas (etiqueta, valor, etiqueta, valor).
      if (cells.length >= 4) { var k2 = labelKey_(cells[2]); if (k2 && out[k2] == null) out[k2] = cells.slice(3).join(' ').trim(); }
      continue;
    }
    var m = /^([^:]{3,60}):\s*(.+)$/.exec(lines[i]);
    if (m && !/\d{1,2}:\d{2}/.test(m[1])) {
      var k3 = labelKey_(m[1]);
      if (k3 && out[k3] == null) out[k3] = m[2].trim();
      continue;
    }
    // "etiqueta" sola + valor en la siguiente línea (cuerpos en texto plano).
    var k4 = labelKey_(lines[i]);
    if (k4 && k4.length <= 40 && i + 1 < lines.length && out[k4] == null && !/\d/.test(k4)) {
      var next = lines[i + 1];
      if (next && next.indexOf('\t') < 0 && next.length <= 80) {
        var val = next.trim();
        // "S/" solo en una línea y el número en la siguiente (layout de Yape).
        if (/^(S\/\.?|US\$|\$)$/.test(val) && lines[i + 2]) val = val + ' ' + lines[i + 2].trim();
        out[k4] = val;
      }
    }
  }
  return out;
}

/** Primer valor cuyo campo coincide con alguna de las claves (normalizadas) dadas. */
function field_(fields, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = labelKey_(keys[i]);
    if (fields[k] != null && fields[k] !== '') return fields[k];
  }
  // Coincidencia por prefijo (p. ej. "n de operacion yape" vs "n de operacion").
  var all = Object.keys(fields);
  for (var j = 0; j < keys.length; j++) {
    var kk = labelKey_(keys[j]);
    for (var a = 0; a < all.length; a++) if (all[a].indexOf(kk) === 0 && fields[all[a]] !== '') return fields[all[a]];
  }
  return '';
}

// --- 4) Normalización ---

/** "S/ 1,234.50" → {amount:1234.5, currency:'PEN'}; "$ 3.86" → USD. null si no hay monto. */
function parseAmount(s) {
  var m = /(S\/\.?|US\$|USD|\$)\s*([\d.,]+)/.exec(String(s || ''));
  if (!m) return null;
  var cur = m[1].indexOf('S') === 0 ? 'PEN' : 'USD';
  var raw = m[2].replace(/\.$/, '');
  var num;
  if (raw.indexOf(',') >= 0 && raw.indexOf('.') >= 0) num = raw.replace(/,/g, '');               // 1,234.50
  else if (/,\d{2}$/.test(raw)) num = raw.replace(/\./g, '').replace(',', '.');                   // 1.234,50
  else num = raw.replace(/,/g, '');                                                                // 1234.5 / 6.0
  var n = parseFloat(num);
  return isNaN(n) ? null : { amount: Math.round(n * 10000) / 10000, currency: cur };
}

var MESES_ = { ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, setiembre: 9, septiembre: 9,
  oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12 };

/**
 * Fechas en español como las envían BCP/Yape → ISO 8601 con offset de Lima. null si no parsea.
 *  "02 de octubre de 2026 - 09:06 PM" · "04 octubre 2026 - 02:35 a. m." · "15 Set, 2026 - 08:20 pm" · "24 may. 2026 - 02:41 p. m."
 */
function parseDateEs(s) {
  var t = fold_(s).replace(/\s+/g, ' ');
  var m = /(\d{1,2})\s*(?:de\s+)?([a-z]+)\.?,?\s*(?:de\s+)?(\d{4})(?:\s*[-,]?\s*(\d{1,2}):(\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm|hrs?\.?)?)?/.exec(t);
  if (!m) return null;
  var mon = MESES_[m[2]];
  if (!mon) return null;
  var d = parseInt(m[1], 10), y = parseInt(m[3], 10);
  var hh = m[4] != null ? parseInt(m[4], 10) : 0, mm = m[5] != null ? parseInt(m[5], 10) : 0;
  var ap = (m[6] || '').replace(/[\s.]/g, '');
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  if (d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  return y + '-' + pad2_(mon) + '-' + pad2_(d) + 'T' + pad2_(hh) + ':' + pad2_(mm) + ':00' + LIMA_OFFSET_;
}

/** Fecha del correo (Date) → ISO con offset de Lima, como respaldo. */
function dateToIsoLima_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  var t = new Date(date.getTime() - 5 * 3600 * 1000);
  return t.getUTCFullYear() + '-' + pad2_(t.getUTCMonth() + 1) + '-' + pad2_(t.getUTCDate()) + 'T' +
    pad2_(t.getUTCHours()) + ':' + pad2_(t.getUTCMinutes()) + ':00' + LIMA_OFFSET_;
}

/** Últimos N dígitos de un número enmascarado ("************1816" → "1816"). */
function lastDigits_(s, n) {
  var d = String(s || '').replace(/\D/g, '');
  return d.slice(-n);
}

/** Normaliza nombre de comercio para agrupar ("DLC*SPOTIFY" → "DLC*SPOTIFY", trims, un espacio). */
function normalizeMerchant(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

/** Clave estable de contraparte P2P a partir de nombre truncado + últimos 3 dígitos del celular. */
function counterpartyKey(name, phone) {
  var n = fold_(name).replace(/\*+$/, '').trim();
  var p = lastDigits_(phone, 3);
  if (!n && !p) return '';
  return n + '|' + p;
}

/** Monto del titular en la frase destacada ("Realizaste un consumo de S/ 53.30 con…"). */
function headlineAmount_(text) {
  var m = /(?:consumo|transferencia|retiro|yapeo a celular|recarga|pago)\s+de\s+((?:S\/\.?|US\$|\$)\s*[\d.,]+)/i.exec(text);
  return m ? parseAmount(m[1]) : null;
}

/** Comercio en la frase destacada ("… Tarjeta de Débito BCP en CA012 AVIACION."). */
function headlineMerchant_(text) {
  var m = /BCP en ([^\n]+?)\.?(?:\n|$)/.exec(String(text || ''));
  return m ? normalizeMerchant(m[1]) : '';
}

// --- 5) Construcción de la transacción normalizada ---

/**
 * Parsea un correo. Devuelve una transacción normalizada, o
 * { ignored:true, reason } para correos no transaccionales / rechazos, o { unknown:true, type, bank }.
 */
function parseEmail(email) {
  var cls = classifyEmail(email.from, email.subject);
  if (!cls.bank) return { ignored: true, reason: 'not_transactional' };
  var text = emailText_(email);
  var f = extractFields(text);
  var base = {
    gmail_message_id: email.id || '',
    raw_subject: String(email.subject || ''),
    source: cls.bank + '_email',
    type: cls.type,
    flags: []
  };
  var handler = TX_BUILDERS_[cls.type];
  if (!handler) return { unknown: true, type: cls.type, bank: cls.bank, gmail_message_id: email.id || '' };
  var tx = handler(f, text, email, base);
  if (!tx) return { unknown: true, type: cls.type, bank: cls.bank, gmail_message_id: email.id || '' };
  if (tx.ignored) return tx;
  return finalizeTx_(tx, email);
}

function finalizeTx_(tx, email) {
  if (!tx.occurred_at) { tx.occurred_at = dateToIsoLima_(email.date); if (tx.occurred_at) tx.flags.push('date_from_header'); }
  if (!tx.occurred_at) tx.flags.push('no_date');
  if (tx.amount == null) tx.flags.push('no_amount');
  tx.operation_id = String(tx.operation_id || '').trim().replace(/[.,;\s]+$/, '');
  tx.id = tx.operation_id ? (tx.source.split('_')[0] + ':' + tx.operation_id) : ('gmail:' + tx.gmail_message_id);
  tx.merchant = normalizeMerchant(tx.merchant);
  tx.counterparty_name = String(tx.counterparty_name || '').trim();
  tx.counterparty_key = tx.counterparty_key || '';
  tx.instrument = tx.instrument || '';
  tx.fx_rate = tx.fx_rate == null ? '' : tx.fx_rate;
  tx.category = '';
  tx.category_source = '';
  return tx;
}

var TX_BUILDERS_ = {
  bcp_card_purchase: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['total del consumo', 'monto'])) || headlineAmount_(text);
    var merchant = field_(f, ['empresa']) || headlineMerchant_(text);
    var tx = Object.assign(base, {
      kind: 'expense',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: merchant,
      instrument: 'debito ****' + lastDigits_(field_(f, ['numero de tarjeta de debito', 'numero de tarjeta']), 4),
      operation_id: field_(f, ['numero de operacion'])
    });
    if (/^yape$/i.test(merchant)) tx.flags.push('possible_yape_duplicate');
    // "PLIN-<NOMBRE>": transferencia P2P por Plin pagada con la tarjeta → contraparte, no comercio.
    var plin = /^PLIN[\s-]+(.+)$/i.exec(merchant);
    if (plin) { tx.channel = 'plin'; tx.counterparty_name = plin[1].trim(); tx.counterparty_key = counterpartyKey(plin[1], ''); tx.merchant = ''; }
    return tx;
  },
  bcp_internal_transfer: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['monto transferido'])) || headlineAmount_(text);
    var fx = parseAmount(field_(f, ['tipo de cambio']));
    var total = parseAmount(field_(f, ['total cobrado al tipo de cambio', 'total cobrado']));
    return Object.assign(base, {
      kind: 'internal_transfer',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      fx_rate: fx ? fx.amount : null,
      amount_charged: total ? total.amount : null, currency_charged: total ? total.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: '',
      instrument: field_(f, ['desde']) ? 'cuenta ' + lastDigits_(field_(f, ['desde']), 4) : '',
      operation_id: field_(f, ['numero de operacion'])
    });
  },
  bcp_wardadito: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['total retirado', 'monto'])) || headlineAmount_(text);
    return Object.assign(base, {
      kind: 'internal_transfer',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: 'Wardadito',
      operation_id: field_(f, ['numero de operacion'])
    });
  },
  bcp_qr_payment: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['monto total', 'monto'])) || headlineAmount_(text);
    var name = field_(f, ['nombre del beneficiario', 'beneficiario', 'enviado a']);
    var phone = field_(f, ['celular del beneficiario', 'celular']);
    return Object.assign(base, {
      kind: 'expense', channel: 'qr',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: '',
      counterparty_name: name, counterparty_key: counterpartyKey(name, phone),
      instrument: field_(f, ['desde']) ? 'cuenta ' + lastDigits_(field_(f, ['desde']), 4) : '',
      operation_id: field_(f, ['numero de operacion'])
    });
  },
  yape_notice: function (f, text, email, base) { return { ignored: true, reason: 'notice', gmail_message_id: email.id || '', type: base.type }; },
  bcp_notice:  function (f, text, email, base) { return { ignored: true, reason: 'notice', gmail_message_id: email.id || '', type: base.type }; },
  bcp_rejected: function (f, text, email, base) {
    return { ignored: true, reason: 'rejected_purchase', gmail_message_id: email.id || '', type: base.type };
  },
  yape_p2p_sent: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['monto de yapeo', 'monto']));
    var name = field_(f, ['nombre del beneficiario']);
    var phone = field_(f, ['celular del beneficiario']);
    return Object.assign(base, {
      kind: 'expense', channel: 'yape_p2p',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora de la operacion', 'fecha y hora'])),
      merchant: '',
      counterparty_name: name, counterparty_key: counterpartyKey(name, phone),
      instrument: 'yape',
      operation_id: field_(f, ['n de operacion', 'numero de operacion'])
    });
  },
  yape_service: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['monto total', 'monto']));
    return Object.assign(base, {
      kind: 'expense', channel: 'yape_service',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: field_(f, ['empresa']),
      service: field_(f, ['servicio']),
      instrument: 'yape',
      operation_id: field_(f, ['n de operacion yape', 'n de operacion', 'numero de operacion'])
    });
  },
  yape_topup: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['recarga efectiva', 'monto total', 'monto'])) || headlineAmount_(text);
    var company = field_(f, ['empresa']) || (/([A-Z][A-Z .&]+S\.?A\.?C?\.?)/.exec(text) || [])[1] || 'Recarga celular';
    return Object.assign(base, {
      kind: 'expense', channel: 'yape_topup',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: company,
      instrument: 'yape',
      operation_id: field_(f, ['n de operacion', 'numero de operacion'])
    });
  },
  yape_auto_transfer: function (f, text, email, base) {
    var amt = parseAmount(field_(f, ['monto total', 'monto']));
    return Object.assign(base, {
      kind: 'expense', channel: 'yape_auto',
      amount: amt ? amt.amount : null, currency: amt ? amt.currency : '',
      occurred_at: parseDateEs(field_(f, ['fecha y hora'])),
      merchant: field_(f, ['empresa', 'comercio']) || 'Yape',
      instrument: 'yape',
      operation_id: field_(f, ['n de operacion', 'numero de operacion'])
    });
  }
};

/** Clave de deduplicación entre fuentes: monto + moneda + minuto. Útil para cruzar push ↔ correo. */
function txFuzzyKey(tx) {
  if (tx.amount == null || !tx.occurred_at) return '';
  return [tx.currency, tx.amount.toFixed(2), String(tx.occurred_at).slice(0, 16)].join('|');
}
