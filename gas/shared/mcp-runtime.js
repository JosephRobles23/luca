/**
 * mcp-runtime.js — API privada JSON que consume el Worker `luca-mcp` (services/luca-mcp).
 *
 * El Worker resuelve token→tenant y hace POST al /exec de ESTE usuario con `?mcp=1` y un body
 * `{ op, secret, args }` (o `{ op:'challenge', nonce }` durante el enrolamiento). Aquí se valida el
 * secreto por usuario y se ejecuta la op reusando el ledger (`readLedger_`, `appendTransactions_`).
 * El `sheetId` nunca viaja: es implícito en cuál /exec se llamó → aislamiento por copia.
 *
 * Secreto por USUARIO en PropertiesService.getUserProperties() vía secrets-runtime.js
 * (`getSecret_('mcpSecret')`). Nada en Script Properties de la librería (CLAUDE.md).
 *
 * Contrato de salida (siempre HTTP 200 — limitación de Apps Script): JSON `{ ok:true, … }` o
 * `{ ok:false, error:'…' }`; el Worker lo traduce a errores de tool MCP.
 *
 * Entra por `webAction` (webapp-runtime.js) cuando `e.parameter.mcp` está presente. Las funciones
 * del sidebar se exportan en `MCP_DISPATCH_` para fusionarlas en `DISPATCH_` (ui-runtime.js).
 *
 * Sin import/export: runtime de Apps Script. Privados con sufijo "_".
 */

var MCP_WORKER_URL_DEFAULT_ = 'https://mcp.lucaa.lat';
var MCP_FX_DEFAULT_ = 3.5;              // ADR-005: USD→PEN si el correo no trae tipo de cambio
var MCP_LIMA_OFFSET_ = '-05:00';
var MCP_LIST_LIMIT_ = 50;
var MCP_LIST_MAX_ = 200;
var MCP_TOP_DEFAULT_ = 10;
var MCP_TOP_MAX_ = 50;
var MCP_TIPOS_ = { expense: 1, income: 1, transfer_in: 1, internal_transfer: 1 };

// --- Respuestas ---

function mcpJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function mcpError_(msg) { return mcpJson_({ ok: false, error: String(msg == null ? 'error' : msg) }); }

// --- Secreto por usuario ---

function mcpSecret_() { return getSecret_('mcpSecret'); }

/** Genera y guarda el secreto si no existe (64 hex). Lo usa iniciarConexionMcp y los tests. */
function ensureMcpSecret_() {
  var cur = mcpSecret_();
  if (cur) return cur;
  var secret = (String(Utilities.getUuid()) + String(Utilities.getUuid())).replace(/-/g, '');
  setSecret_('mcpSecret', secret);
  return secret;
}

// --- Router ---

/**
 * Dispatcher del lado GAS. Entra por webAction cuando `e.parameter.mcp` está presente (POST).
 * @return {ContentService.TextOutput} JSON.
 */
function mcpAction(e, sheetId, config) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return mcpError_('bad-request'); }

  var op = String(body.op || '');
  var args = (body.args && typeof body.args === 'object') ? body.args : {};

  var stored = mcpSecret_();
  if (!stored) return mcpError_('not-enrolled');

  // challenge: prueba de enrolamiento. Firma el nonce con el secreto guardado; el Worker lo
  // verifica con el secreto que recibió en /enroll (challenge-response, sin exponer el secreto).
  if (op === 'challenge') {
    var nonce = String(body.nonce || '');
    if (!nonce) return mcpError_('missing-nonce');
    var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(nonce, stored));
    return mcpJson_({ ok: true, sig: sig });
  }

  if (String(body.secret || '') !== stored) return mcpError_('unauthorized');

  var fn = MCP_OPS_[op];
  if (!fn) return mcpError_('unknown-op');
  try {
    var out = fn(sheetId, config, args) || {};
    out.ok = true;
    return mcpJson_(out);
  } catch (err) {
    return mcpError_(err && err.message ? err.message : err);
  }
}

/** Lista blanca de ops. Una op ↔ una tool del Worker con el mismo nombre y los mismos args. */
var MCP_OPS_ = {
  get_summary: function (sheetId, config, a) {
    return resumenMes_(mcpTxs_(sheetId, config), mcpMonth_(a.month), mcpFx_(config));
  },
  category_breakdown: function (sheetId, config, a) {
    var month = mcpMonth_(a.month), fx = mcpFx_(config);
    var exp = mcpDelMes_(mcpTxs_(sheetId, config), month).filter(function (t) { return t.tipo === 'expense'; });
    var total = mcpSuma_(exp, fx);
    return { month: month, moneda: 'PEN', expense: total, categories: mcpPorCategoria_(exp, total, fx) };
  },
  top_merchants: function (sheetId, config, a) {
    var month = mcpMonth_(a.month), fx = mcpFx_(config);
    var limit = mcpLimit_(a.limit, MCP_TOP_DEFAULT_, MCP_TOP_MAX_);
    var exp = mcpDelMes_(mcpTxs_(sheetId, config), month).filter(function (t) { return t.tipo === 'expense'; });
    return { month: month, moneda: 'PEN', expense: mcpSuma_(exp, fx), merchants: mcpPorComercio_(exp, fx).slice(0, limit) };
  },
  list_transactions: function (sheetId, config, a) { return mcpListTransactions_(sheetId, config, a); },
  budget_status: function (sheetId, config, a) {
    return { month: mcpMonth_(a.month), available: false, reason: 'Los presupuestos llegan en v1.' };
  },
  add_expense: function (sheetId, config, a) { return mcpAddExpense_(sheetId, config, a); }
};

// --- Validación de args ---

function mcpMonth_(m) {
  var s = String(m || '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Error('invalid-month');
  return s;
}
/** "YYYY-MM-DD" existente de verdad (Date haría rodar 2026-02-30 a marzo). */
function mcpValidYmd_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
function mcpDate_(d, name) {
  var s = String(d || '').trim();
  if (!mcpValidYmd_(s)) throw new Error('invalid-' + name);
  return s;
}
function mcpLimit_(v, def, max) {
  var n = parseInt(v, 10);
  if (isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}
function mcpFx_(config) {
  var a = (config && config.ajustes) || {};
  var v = parseFloat(a['fx.usd_pen']);
  return v > 0 ? v : MCP_FX_DEFAULT_;
}
function mcpFold_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// --- Filas del ledger → transacciones tipadas (misma forma que apps/web/src/lib/ledger.ts) ---

function mcpNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function mcpRound_(n) { return Math.round(n * 100) / 100; }
function mcpStr_(v) { return v == null ? '' : String(v); }

/** `fecha` puede volver como Date si Sheets la interpretó; se normaliza a ISO Lima. */
function mcpIso_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    var t = new Date(v.getTime() - 5 * 3600 * 1000);
    return t.getUTCFullYear() + '-' + pad2_(t.getUTCMonth() + 1) + '-' + pad2_(t.getUTCDate()) + 'T' +
      pad2_(t.getUTCHours()) + ':' + pad2_(t.getUTCMinutes()) + ':' + pad2_(t.getUTCSeconds()) + MCP_LIMA_OFFSET_;
  }
  return mcpStr_(v).trim();
}

function mcpRowToTx_(r) {
  var tc = r.tipo_cambio;
  return {
    id: mcpStr_(r.id).trim(),
    fecha: mcpIso_(r.fecha),
    tipo: mcpStr_(r.tipo).trim(),
    monto: mcpNum_(r.monto),
    moneda: mcpStr_(r.moneda).trim() || 'PEN',
    tipo_cambio: (tc == null || tc === '') ? null : mcpNum_(tc),
    comercio: mcpStr_(r.comercio).trim(),
    contraparte: mcpStr_(r.contraparte).trim(),
    categoria: mcpStr_(r.categoria).trim(),
    categoria_origen: mcpStr_(r.categoria_origen).trim(),
    medio: mcpStr_(r.medio).trim(),
    canal: mcpStr_(r.canal).trim(),
    fuente: mcpStr_(r.fuente).trim(),
    flags: mcpStr_(r.flags).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  };
}

function mcpTxs_(sheetId, config) {
  return readLedger_(sheetId, config).map(mcpRowToTx_).filter(function (t) { return !!t.id; });
}

/** Lo que ve el modelo por cada movimiento (añade `monto_pen` ya convertido). */
function mcpPublicTx_(t, fx) {
  return {
    id: t.id, fecha: t.fecha, tipo: t.tipo, monto: t.monto, moneda: t.moneda, tipo_cambio: t.tipo_cambio,
    monto_pen: mcpRound_(mcpToBase_(t, fx)),
    comercio: t.comercio, contraparte: t.contraparte, categoria: t.categoria, categoria_origen: t.categoria_origen,
    medio: t.medio, canal: t.canal, fuente: t.fuente, flags: t.flags
  };
}

// --- Agregación (misma semántica que apps/web/src/lib/ledger.ts) ---

function mcpMonthOf_(fecha) { return mcpStr_(fecha).slice(0, 7); }
function mcpDelMes_(txs, month) { return txs.filter(function (t) { return mcpMonthOf_(t.fecha) === month; }); }

/** Importe en PEN: USD con el tipo de cambio del correo o el de Ajustes; el resto se asume PEN. */
function mcpToBase_(t, fx) {
  if (t.moneda === 'USD') return t.monto * (t.tipo_cambio || fx);
  return t.monto;
}
function mcpSuma_(txs, fx) {
  return mcpRound_(txs.reduce(function (s, t) { return s + mcpToBase_(t, fx); }, 0));
}
function mcpLabel_(t) { return t.comercio || t.contraparte || (t.canal === 'yape_p2p' ? 'Yapeo' : '—'); }

function mcpPorCategoria_(expenses, total, fx) {
  var acc = {};
  expenses.forEach(function (t) {
    var k = t.categoria || 'Sin categoría';
    if (!acc[k]) acc[k] = { name: k, amount: 0, count: 0 };
    acc[k].amount += mcpToBase_(t, fx);
    acc[k].count++;
  });
  return Object.keys(acc).map(function (k) {
    var c = acc[k];
    return { name: c.name, amount: mcpRound_(c.amount), pct: total ? Math.round((c.amount / total) * 100) : 0, count: c.count };
  }).sort(function (a, b) { return b.amount - a.amount; });
}

function mcpPorComercio_(expenses, fx) {
  var acc = {};
  expenses.forEach(function (t) {
    var k = mcpLabel_(t);
    if (!acc[k]) acc[k] = { name: k, amount: 0, count: 0 };
    acc[k].amount += mcpToBase_(t, fx);
    acc[k].count++;
  });
  return Object.keys(acc).map(function (k) {
    var c = acc[k];
    return { name: c.name, amount: mcpRound_(c.amount), count: c.count };
  }).sort(function (a, b) { return b.amount - a.amount; });
}

/** ["2026-05", …, "2026-10"] terminando en `month`. */
function mcpLastMonths_(month, n) {
  var y = parseInt(month.slice(0, 4), 10), m = parseInt(month.slice(5, 7), 10);
  var out = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1));
  }
  return out;
}

/**
 * Resumen de un mes. `transfer_in` (yapeos recibidos) va aparte y NO suma a ingresos;
 * `internal_transfer` no cuenta en ningún KPI; USD se convierte con tipo_cambio o `fx`.
 * @param {Array} txs  transacciones tipadas (mcpTxs_)
 * @param {string} month  "YYYY-MM"
 * @param {number} fx  USD→PEN de respaldo
 */
function resumenMes_(txs, month, fx) {
  var inMonth = mcpDelMes_(txs, month);
  var expenses = inMonth.filter(function (t) { return t.tipo === 'expense'; });
  var incomes = inMonth.filter(function (t) { return t.tipo === 'income'; });
  var transfersIn = inMonth.filter(function (t) { return t.tipo === 'transfer_in'; });
  var expense = mcpSuma_(expenses, fx);
  var income = mcpSuma_(incomes, fx);
  var months = mcpLastMonths_(month, 6);
  var last6 = months.map(function (m) {
    return { month: m, expense: mcpSuma_(txs.filter(function (t) { return t.tipo === 'expense' && mcpMonthOf_(t.fecha) === m; }), fx) };
  });
  return {
    month: month,
    moneda: 'PEN',
    fx_usd_pen: fx,
    income: income,
    expense: expense,
    transferIn: mcpSuma_(transfersIn, fx),
    net: mcpRound_(income - expense),
    count: inMonth.length,
    pendingCount: expenses.filter(function (t) { return !t.categoria; }).length,
    byCategory: mcpPorCategoria_(expenses, expense, fx),
    topMerchants: mcpPorComercio_(expenses, fx).slice(0, 8),
    last6: last6,
    prevExpense: last6.length >= 2 ? last6[last6.length - 2].expense : 0
  };
}

// --- Ops de lectura ---

function mcpListTransactions_(sheetId, config, a) {
  var fx = mcpFx_(config);
  var month = a.month != null && a.month !== '' ? mcpMonth_(a.month) : '';
  var from = a.from ? mcpDate_(a.from, 'from') : '';
  var to = a.to ? mcpDate_(a.to, 'to') : '';
  var tipo = mcpStr_(a.tipo).trim();
  if (tipo && !MCP_TIPOS_[tipo]) throw new Error('invalid-tipo');
  var categoria = mcpFold_(a.categoria);
  var texto = mcpFold_(a.texto);
  var limit = mcpLimit_(a.limit, MCP_LIST_LIMIT_, MCP_LIST_MAX_);

  var rows = mcpTxs_(sheetId, config).filter(function (t) {
    var day = t.fecha.slice(0, 10);
    if (month && mcpMonthOf_(t.fecha) !== month) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (tipo && t.tipo !== tipo) return false;
    if (categoria && mcpFold_(t.categoria) !== categoria) return false;
    if (texto && mcpFold_([t.comercio, t.contraparte, t.categoria, t.canal].join(' ')).indexOf(texto) < 0) return false;
    return true;
  }).sort(function (x, y) { return x.fecha < y.fecha ? 1 : (x.fecha > y.fecha ? -1 : 0); });

  return {
    total: rows.length,
    returned: Math.min(rows.length, limit),
    transactions: rows.slice(0, limit).map(function (t) { return mcpPublicTx_(t, fx); })
  };
}

// --- add_expense ---

/** fecha del modelo → { iso, dateOnly }. Acepta "YYYY-MM-DD" o ISO con hora (offset opcional → Lima). */
function mcpParseFecha_(v) {
  var s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (!mcpValidYmd_(s)) throw new Error('invalid-fecha');
    return { iso: s + 'T00:00:00' + MCP_LIMA_OFFSET_, dateOnly: true };
  }
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-]\d{2}:\d{2}|Z)?$/.exec(s);
  if (!m || !mcpValidYmd_(m[1]) || +m[2] > 23 || +m[3] > 59 || +(m[4] || 0) > 59) throw new Error('invalid-fecha');
  var iso = m[1] + 'T' + m[2] + ':' + m[3] + ':' + (m[4] || '00') + (m[5] === 'Z' ? '+00:00' : (m[5] || MCP_LIMA_OFFSET_));
  return { iso: iso, dateOnly: false };
}

/**
 * Registra un gasto manual. Dedupe por clave difusa (ADR-005): moneda + monto + minuto; si solo
 * vino la fecha, por día. Con duplicado y sin `force` no escribe y devuelve `{duplicate:true, similar}`.
 */
function mcpAddExpense_(sheetId, config, a) {
  var monto = mcpRound_(Number(a.monto));
  if (!(monto > 0)) throw new Error('invalid-monto');
  var moneda = String(a.moneda || 'PEN').trim().toUpperCase();
  if (moneda !== 'PEN' && moneda !== 'USD') throw new Error('invalid-moneda');
  var f = mcpParseFecha_(a.fecha);
  var comercio = normalizeMerchant(a.comercio);
  var contraparte = mcpStr_(a.contraparte).replace(/\s+/g, ' ').trim();
  var categoria = mcpStr_(a.categoria).trim();
  var nota = mcpStr_(a.nota).trim();
  var fx = mcpFx_(config);

  var lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    var existing = mcpTxs_(sheetId, config);
    var similar = existing.filter(function (t) {
      if (t.moneda !== moneda || mcpRound_(t.monto) !== monto) return false;
      return f.dateOnly ? t.fecha.slice(0, 10) === f.iso.slice(0, 10) : t.fecha.slice(0, 16) === f.iso.slice(0, 16);
    });
    if (similar.length && !a.force) {
      return { added: 0, duplicate: true, similar: similar.slice(0, 5).map(function (t) { return mcpPublicTx_(t, fx); }) };
    }
    var tx = {
      id: 'manual:' + Utilities.getUuid(),
      gmail_message_id: '',
      raw_subject: nota,                     // la columna `asunto` guarda la nota en movimientos manuales
      source: 'manual',
      type: 'manual_expense',
      kind: 'expense',
      channel: '',
      amount: monto, currency: moneda,
      occurred_at: f.iso,
      merchant: comercio,
      counterparty_name: contraparte,
      counterparty_key: contraparte ? counterpartyKey(contraparte, '') : '',
      instrument: '',
      operation_id: '',
      fx_rate: '',
      category: categoria,
      category_source: categoria ? 'user' : '',
      flags: f.dateOnly ? ['date_only'] : []
    };
    var res = appendTransactions_(sheetId, config, [tx]);
    return { added: res.added, duplicate: false, id: tx.id, transaction: mcpPublicTx_(mcpRowToTx_(txToRow_(tx)), fx) };
  } finally {
    lock.releaseLock();
  }
}

// --- Sidebar: Conectar / Desconectar (vía dispatch) ---

function mcpAjustes_(config) { return (config && config.ajustes) || {}; }

/** URL del Worker: `Ajustes.conexiones.workerUrl`, con default al dominio de producción. */
function mcpWorkerUrl_(config) {
  var u = mcpStr_(mcpAjustes_(config)['conexiones.workerUrl']).trim() || MCP_WORKER_URL_DEFAULT_;
  return u.replace(/\/+$/, '');
}

/** URL /exec de esta copia: la guardada en "Activar conexiones" (ADR-003) o la que reporta ScriptApp. */
function mcpWebAppUrl_(config) {
  var saved = mcpStr_(mcpAjustes_(config)['conexiones.execUrl']).trim();
  if (saved) return saved;
  try { return mcpStr_(ScriptApp.getService().getUrl()).trim(); } catch (e) { return ''; }
}

function mcpWebAppStatus_(config) {
  var url = mcpWebAppUrl_(config);
  if (!url) return { ready: false, url: '', message: 'Primero activa las conexiones: despliega la Web App ("Ejecutar como: yo", "Acceso: cualquiera") y guarda su URL /exec.' };
  if (!/^https:\/\/script\.google\.com\/[^?#]*\/exec$/i.test(url)) return { ready: false, url: url, message: 'La URL guardada no parece una Web App de Apps Script (debe terminar en /exec).' };
  return { ready: true, url: url, message: '' };
}

/** Estado para el sidebar. No expone el secreto. */
function cargarMcp(sheetId, config) {
  var workerUrl = mcpWorkerUrl_(config);
  return {
    webApp: mcpWebAppStatus_(config),
    workerUrl: workerUrl,
    connectorUrl: workerUrl + '/mcp',       // lo que el usuario pega en Claude/ChatGPT
    connected: !!mcpSecret_()
  };
}

/**
 * Arranca la conexión: asegura el secreto por usuario y lo registra en el Worker (/enroll) junto a
 * la URL /exec. El Worker verifica por challenge HMAC y devuelve un código que el usuario pega en
 * /authorize. El secreto NUNCA llega al navegador (solo viaja en este UrlFetch).
 * @return {{code:string, expiresInSeconds:number, connectorUrl:string, authorizeUrl:string}}
 */
function iniciarConexionMcp(sheetId, config) {
  var estado = cargarMcp(sheetId, config);
  if (!estado.webApp.ready) throw new Error(estado.webApp.message);

  var secret = ensureMcpSecret_();
  var res = UrlFetchApp.fetch(estado.workerUrl + '/enroll', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ webAppUrl: estado.webApp.url, secret: secret }),
    muteHttpExceptions: true
  });
  var json;
  try { json = JSON.parse(res.getContentText()); } catch (e) { json = null; }
  if (res.getResponseCode() !== 200 || !json || json.ok !== true || !json.code) {
    throw new Error(json && json.error
      ? 'El servidor MCP rechazó la conexión (' + json.error + ').'
      : 'No se pudo contactar al servidor MCP. Revisa que la Web App esté publicada y la URL del Worker.');
  }
  return {
    code: String(json.code),
    expiresInSeconds: json.expiresInSeconds || 600,
    connectorUrl: estado.connectorUrl,
    authorizeUrl: estado.workerUrl + '/authorize'
  };
}

/** Desconecta: borra el secreto → toda llamada Worker→GAS pasa a 'not-enrolled'. */
function desconectarMcp(sheetId, config) {
  setSecret_('mcpSecret', '');
  setSecret_('tenantId', '');
  return { ok: true, connected: false };
}

/** Entradas para `DISPATCH_` (ui-runtime.js). El integrador las fusiona; convención fn(sid, cfg, args). */
var MCP_DISPATCH_ = {
  cargarMcp:          function (sid, cfg, a) { return cargarMcp(sid, cfg); },
  iniciarConexionMcp: function (sid, cfg, a) { return iniciarConexionMcp(sid, cfg); },
  desconectarMcp:     function (sid, cfg, a) { return desconectarMcp(sid, cfg); }
};
