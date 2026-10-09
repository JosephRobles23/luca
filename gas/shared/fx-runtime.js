/**
 * fx-runtime.js — Tipo de cambio automático (ADR-012): BCRP (sistema bancario SBS) con respaldo open.er-api,
 * guardado en la pestaña oculta `_TipoCambio` de la copia del usuario, y tipo USD→PEN por fecha.
 *
 * Lo llama runDispatcher (trigger de 15 min) como máximo una vez al día; la petición solo lleva fechas.
 * Quién aplica qué tipo a un movimiento en USD (ADR-012 §4): TC del correo → manual → venta BCRP de su día
 * (o del anterior con dato) → último dato → fx.usd_pen. Misma lógica en apps/web/src/lib/fx.ts.
 *
 * Sin import/export: runtime de Apps Script.
 */

var FX_SHEET_ = '_TipoCambio';
var FX_HEADERS_ = ['fecha', 'usd_compra', 'usd_venta', 'eur_venta', 'fuente', 'leido_en'];
// Compra USD, venta USD, venta EUR (S/ por divisa), series diarias del BCRP.
var FX_BCRP_URL_ = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04639PD-PD04640PD-PD04648PD/json/';
var FX_ERAPI_URL_ = 'https://open.er-api.com/v6/latest/USD';
var FX_DEFAULT_ = 3.5;
var FX_INTENTOS_ = 3;
var FX_VENTANA_DIAS_ = 30;          // primera lectura sin tabla
var FX_REINTENTO_MS_ = 3600 * 1000; // tras un fallo
var FX_HISTORICO_MAX_ANIOS_ = 10;
var FX_MESES_ = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12 };

// --- Fechas (Lima = UTC−5, sin horario de verano) ---

function fxYmd_(ms) { return new Date(ms - 5 * 3600 * 1000).toISOString().slice(0, 10); }
function fxMs_(ymd) { return Date.parse(ymd + 'T00:00:00-05:00'); }
/** "2026-10-06" → "2026-10-6" (formato de la URL del BCRP para series diarias). */
function fxYmdBcrp_(ymd) { var p = ymd.split('-'); return +p[0] + '-' + +p[1] + '-' + +p[2]; }

/** "06.Oct.26" → "2026-10-06"; '' si no se entiende. */
function fxFechaBcrp_(name) {
  var m = /^(\d{1,2})\.([A-Za-z]{3})\.(\d{2})$/.exec(String(name || '').trim());
  var mes = m && FX_MESES_[m[2].toLowerCase()];
  if (!mes) return '';
  return '20' + m[3] + '-' + pad2_(mes) + '-' + pad2_(+m[1]);
}

function fxNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) && n > 0 ? n : null;
}

// --- Fuentes ---

/**
 * Cuerpo de BCRPData → filas con venta USD. null si no es el JSON esperado: el desafío de Imperva llega con
 * HTTP 200 y HTML (spike S8), así que la validez se decide por el cuerpo y no por el status.
 */
function fxParseBcrp_(text) {
  var d;
  try { d = JSON.parse(text); } catch (e) { return null; }
  if (!d || !Array.isArray(d.periods)) return null;
  var out = [];
  d.periods.forEach(function (p) {
    var v = p && p.values || [];
    var fecha = fxFechaBcrp_(p && p.name), venta = fxNum_(v[1]);
    if (!fecha || venta == null) return;   // "n.d." (feriado o aún sin publicar)
    out.push({ fecha: fecha, usd_compra: fxNum_(v[0]) || '', usd_venta: venta, eur_venta: fxNum_(v[2]) || '' });
  });
  return out;
}

/** Filas del BCRP entre dos "YYYY-MM-DD", o null si los intentos fallan. */
function fxLeerBcrp_(desde, hasta) {
  var url = FX_BCRP_URL_ + fxYmdBcrp_(desde) + '/' + fxYmdBcrp_(hasta) + '/esp';
  for (var k = 0; k < FX_INTENTOS_; k++) {
    if (k) Utilities.sleep(1500 * k);
    try {
      var filas = fxParseBcrp_(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      if (filas) return filas;
    } catch (e) { /* red o timeout: siguiente intento */ }
  }
  return null;
}

/** Tipo medio de mercado del día (open.er-api, sin token): compra = venta; EUR por cruce. null si falla. */
function fxLeerErApi_(hoy) {
  try {
    var r = UrlFetchApp.fetch(FX_ERAPI_URL_, { muteHttpExceptions: true });
    var d = JSON.parse(r.getContentText());
    var pen = d && d.result === 'success' && fxNum_(d.rates && d.rates.PEN);
    if (!pen) return null;
    var eur = fxNum_(d.rates.EUR);
    return { fecha: hoy, usd_compra: pen, usd_venta: pen, eur_venta: eur ? Math.round(pen / eur * 10000) / 10000 : '' };
  } catch (e) { return null; }
}

// --- Pestaña `_TipoCambio` ---

/** Filas guardadas, ordenadas por fecha. [] si la pestaña no existe. */
function fxTabla_(sheetId) {
  var sh = getSpreadsheet_(sheetId).getSheetByName(FX_SHEET_);
  if (!sh) return [];
  return readRows_(sh).map(function (r) {
    var f = r.fecha instanceof Date ? fxYmd_(r.fecha.getTime()) : str_(r.fecha).trim().slice(0, 10);
    return { fecha: f, usd_compra: fxNum_(r.usd_compra) || '', usd_venta: fxNum_(r.usd_venta), eur_venta: fxNum_(r.eur_venta) || '',
      fuente: str_(r.fuente), leido_en: str_(r.leido_en) };
  }).filter(function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) && r.usd_venta; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : 0); });
}

/** Mezcla `filas` en la pestaña (una por día). Una fila `bcrp` reemplaza a una `er-api`; nunca al revés. */
function fxGuardar_(sheetId, filas, fuente, ahora) {
  if (!filas.length) return;
  var porFecha = {};
  fxTabla_(sheetId).forEach(function (r) { porFecha[r.fecha] = r; });
  var leido = new Date(ahora || Date.now()).toISOString();
  filas.forEach(function (f) {
    var prev = porFecha[f.fecha];
    if (prev && prev.fuente === 'bcrp' && fuente !== 'bcrp') return;
    porFecha[f.fecha] = { fecha: f.fecha, usd_compra: f.usd_compra, usd_venta: f.usd_venta, eur_venta: f.eur_venta, fuente: fuente, leido_en: leido };
  });
  var ss = getSpreadsheet_(sheetId);
  var sh = ss.getSheetByName(FX_SHEET_);
  if (!sh) {
    sh = ensureSheet_(sheetId, FX_SHEET_, FX_HEADERS_);
    try { sh.getRange(1, 1, sh.getMaxRows(), 1).setNumberFormat('@'); } catch (e) {}   // fechas como texto
    try { sh.hideSheet(); } catch (e) {}
  }
  var values = Object.keys(porFecha).sort().map(function (k) {
    var r = porFecha[k];
    return FX_HEADERS_.map(function (h) { return r[h] == null ? '' : r[h]; });
  });
  sh.clearContents();
  sh.getRange(1, 1, 1, FX_HEADERS_.length).setValues([FX_HEADERS_]);
  sh.getRange(2, 1, values.length, FX_HEADERS_.length).setValues(values);
}

/** Fecha (YYYY-MM-DD) del movimiento en USD sin tipo de cambio más antiguo, o ''. */
function fxUsdMasAntiguo_(sheetId, config) {
  var min = '';
  try {
    readLedger_(sheetId, config).forEach(function (r) {
      if (str_(r.moneda).trim() !== 'USD' || str_(r.tipo_cambio).trim()) return;
      var f = r.fecha instanceof Date ? fxYmd_(r.fecha.getTime()) : str_(r.fecha).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(f) && (!min || f < min)) min = f;
    });
  } catch (e) { /* sin Movimientos todavía */ }
  return min;
}

// --- Actualización (desde runDispatcher) ---

/**
 * Trae el tipo de cambio si hace falta. Nunca lanza. `opts.ahora` solo para tests.
 * @return {{fuente?:string, filas?:number, skipped?:string, error?:string}}
 */
function actualizarTipoCambio_(sheetId, config, opts) {
  try {
    var ahora = (opts && opts.ahora) || Date.now();
    var hoy = fxYmd_(ahora);
    var a = config.ajustes || {};
    var ultimaVez = Date.parse(str_(a['fx.lastRunAt']));
    if (ultimaVez && !str_(a['fx.lastError']) && fxYmd_(ultimaVez) === hoy) return { skipped: 'al-dia' };
    if (ultimaVez && str_(a['fx.lastError']) && ahora - ultimaVez < FX_REINTENTO_MS_) return { skipped: 'reintento-luego' };

    var tabla = fxTabla_(sheetId);
    var desde = tabla.length ? tabla[tabla.length - 1].fecha : fxYmd_(ahora - FX_VENTANA_DIAS_ * 864e5);
    var antiguo = fxUsdMasAntiguo_(sheetId, config);
    if (antiguo && (!tabla.length || antiguo < tabla[0].fecha) && antiguo < desde) desde = antiguo;
    var tope = fxYmd_(ahora - FX_HISTORICO_MAX_ANIOS_ * 365 * 864e5);
    if (desde < tope) desde = tope;

    var out, error = '';
    var filas = fxLeerBcrp_(desde, hoy);
    if (filas) {
      fxGuardar_(sheetId, filas, 'bcrp', ahora);
      out = { fuente: 'bcrp', filas: filas.length };
    } else {
      var er = fxLeerErApi_(hoy);
      if (er) { fxGuardar_(sheetId, [er], 'er-api', ahora); out = { fuente: 'er-api', filas: 1 }; error = 'BCRP no respondió; se usó open.er-api'; }
      else { out = { fuente: '', filas: 0 }; error = 'Sin tipo de cambio: fallaron BCRP y open.er-api'; }
    }
    var ult = fxTabla_(sheetId).pop();
    var upd = { 'fx.lastRunAt': new Date(ahora).toISOString(), 'fx.lastError': error };
    if (out.fuente) upd['fx.fuente'] = out.fuente;
    if (ult) upd['fx.ultimo'] = ult.usd_venta + ' (' + ult.fecha + ')';
    setAjustes_(sheetId, config, upd);
    if (error) out.error = error;
    return out;
  } catch (e) {
    try { setAjustes_(sheetId, config, { 'fx.lastRunAt': new Date().toISOString(), 'fx.lastError': String(e && e.message || e) }); } catch (e2) {}
    return { fuente: '', error: String(e && e.message || e) };
  }
}

// --- Qué tipo se aplica ---

/** 'auto' | 'manual'. Sin elección explícita, manual solo si el usuario ya había cambiado el 3.50 (ADR-012 §5). */
function fxModo_(a) {
  var m = str_(a && a['fx.modo']).trim().toLowerCase();
  if (m === 'auto' || m === 'manual') return m;
  var v = fxNum_(a && a['fx.usd_pen']);
  return v != null && v !== FX_DEFAULT_ ? 'manual' : 'auto';
}

/** Venta USD del día de `fecha` (ISO o YYYY-MM-DD) o del último anterior con dato; el primero si es más antigua. */
function fxUsdEn_(tabla, fecha) {
  if (!tabla || !tabla.length) return null;
  var d = String(fecha || '').slice(0, 10), lo = 0, hi = tabla.length - 1, hit = -1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    if (tabla[mid].fecha <= d) { hit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return tabla[hit < 0 ? 0 : hit].usd_venta;
}

/**
 * Contexto de conversión de una ejecución: `respaldo` (número) y `usdEn(fecha)` (número o null en modo manual).
 * Se memoriza en `config` para no releer la pestaña en cada op.
 */
function fxContexto_(sheetId, config) {
  if (config && config._fx) return config._fx;
  var a = (config && config.ajustes) || {};
  var modo = fxModo_(a);
  var tabla = [];
  if (modo === 'auto') { try { tabla = fxTabla_(sheetId); } catch (e) { tabla = []; } }
  var manual = fxNum_(a['fx.usd_pen']) || FX_DEFAULT_;
  var ctx = {
    modo: modo,
    respaldo: modo === 'manual' || !tabla.length ? manual : tabla[tabla.length - 1].usd_venta,
    usdEn: function (fecha) { return modo === 'auto' ? fxUsdEn_(tabla, fecha) : null; }
  };
  if (config) config._fx = ctx;
  return ctx;
}
