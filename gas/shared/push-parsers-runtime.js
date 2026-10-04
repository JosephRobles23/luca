/**
 * push-parsers-runtime.js — Parser de notificaciones push de Yape capturadas por el atajo de iOS 27.
 *
 * Payload del atajo (docs/guides/prompt-atajo-ios27-yape.md):
 *   { id, source:'yape', channel:'ios-notification', title, subtitle, body, raw, notified_at, received_at, device }
 * Formatos observados (2026-10-04, iOS 27):
 *   title "Confirmación de Pago" · body "Yape! GAVY R. te envió un pago por S/ 1.5"   → transfer_in
 *
 * Un yapeo recibido es `transfer_in` (ADR-005): se muestra aparte ("Recibido por Yape") y NO infla
 * Ingresos. El `type` conserva el nombre `yape_push_income` para `_Procesados` y telemetría.
 * Formatos previstos (no verificados aún): "Yapeaste S/ 12 a María", "Pagaste S/ 5 en Bodega".
 *
 * Sin import/export: runtime de Apps Script.
 */

var PUSH_PATTERNS_ = [
  // Yapeo recibido: "<NOMBRE> te envió un pago por S/ 1.5" / "<NOMBRE> te yapeó S/ 20"
  { kind: 'transfer_in', type: 'income', channel: 'yape_push', re: /^(?:yape!?\s*)?(.+?)\s+te\s+(?:envi[oó]\s+un\s+pago\s+por|yape[oó])\s+((?:S\/\.?|US\$|\$)\s*[\d.,]+)/i, name: 1, amount: 2 },
  // Egreso P2P: "Yapeaste S/ 12.50 a María" / "Le yapeaste S/ 12 a María" / "Enviaste un pago de S/ 12 a María"
  { kind: 'expense', type: 'expense', channel: 'yape_push', re: /^(?:le\s+)?(?:yapeaste|enviaste(?:\s+un\s+pago\s+de)?)\s+((?:S\/\.?|US\$|\$)\s*[\d.,]+)\s+a\s+(.+?)[.!]?$/i, amount: 1, name: 2 },
  // Egreso comercio: "Pagaste S/ 5.00 en Bodega Don Lucho"
  { kind: 'expense', type: 'expense', channel: 'yape_push', re: /^pagaste\s+((?:S\/\.?|US\$|\$)\s*[\d.,]+)\s+(?:en|a)\s+(.+?)[.!]?$/i, amount: 1, name: 2 }
];

/** Fecha del atajo ("4 oct. 2026, 8:49 a. m." o ISO) → ISO Lima. */
function parsePushDate_(s) {
  var t = String(s || '').replace(/ /g, ' ').trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.length >= 25 ? t : null;
  return parseDateEs(t.replace(',', ''));
}

/**
 * Parsea un evento push. Devuelve una transacción normalizada (misma forma que parseEmail) o
 * { unknown:true, reason } si el texto no coincide con ningún patrón conocido.
 */
function parsePushEvent(ev) {
  ev = ev || {};
  var body = String(ev.body || '').replace(/\s+/g, ' ').trim();
  var raw = String(ev.raw || '').replace(/\s+/g, ' ').trim();
  var text = body || raw.replace(/^[^\n]*\n/, '');
  if (!text) return { unknown: true, reason: 'empty', push_id: ev.id || '' };

  for (var i = 0; i < PUSH_PATTERNS_.length; i++) {
    var p = PUSH_PATTERNS_[i];
    var m = p.re.exec(text);
    if (!m) continue;
    var amt = parseAmount(m[p.amount]);
    if (!amt) continue;
    var name = String(m[p.name] || '').trim();
    var tx = {
      id: 'push:' + String(ev.id || ''),
      push_id: String(ev.id || ''),
      gmail_message_id: '',
      raw_subject: String(ev.title || ''),
      source: 'yape_push',
      type: 'yape_push_' + p.type,
      kind: p.kind,
      channel: p.channel,
      amount: amt.amount, currency: amt.currency,
      occurred_at: parsePushDate_(ev.notified_at) || parsePushDate_(ev.received_at),
      merchant: p.kind === 'expense' && /pagaste/i.test(text) ? normalizeMerchant(name) : '',
      counterparty_name: p.kind === 'expense' && /pagaste/i.test(text) ? '' : name,
      counterparty_key: p.kind === 'expense' && /pagaste/i.test(text) ? '' : counterpartyKey(name, ''),
      instrument: 'yape',
      operation_id: '',
      fx_rate: '', category: '', category_source: '',
      flags: []
    };
    if (!tx.occurred_at) tx.flags.push('no_date');
    return tx;
  }
  return { unknown: true, reason: 'no_pattern', push_id: ev.id || '', text: text.slice(0, 120) };
}
