/**
 * dashboard-runtime.js — Agregados del Dashboard de la Sheet (DialogDashboard): el diálogo recibe todo calculado
 * en una llamada y solo dibuja.
 *
 * Misma semántica que apps/web/src/lib/ledger.ts (summarize, lastMonths, toBase, txLabel) — test de paridad en
 * tests/dashboard.test.mjs: gasto = `expense`; ingresos = `income`; `transfer_in` (yapeos recibidos) va aparte y
 * nunca suma a ingresos; `internal_transfer` no cuenta como gasto. USD → PEN con el tipo de cambio del propio
 * correo o `Ajustes.fx.usd_pen` (ADR-005).
 *
 * Sin import/export: runtime de Apps Script.
 */

var DASH_MESES_ = 6;
var DASH_SERIES_ = 5;          // categorías con línea propia en Tendencias
var DASH_MAX_MOVIMIENTOS_ = 400;

function redondear2_(n) { return Math.round(n * 100) / 100; }

function numDash_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}

/** La fecha del ledger es un ISO con offset de Lima; si Sheets la convirtió a Date, se vuelve a ISO. */
function fechaDash_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz || 'America/Lima', "yyyy-MM-dd'T'HH:mm:ssXXX");
  return String(v == null ? '' : v);
}

function txsDashboard_(sheetId, config) {
  return readLedger_(sheetId, config).filter(function (r) { return str_(r.id); }).map(function (r) {
    var tc = str_(r.tipo_cambio);
    return {
      fecha: fechaDash_(r.fecha, config.timezone), tipo: str_(r.tipo), monto: numDash_(r.monto),
      moneda: str_(r.moneda) || 'PEN', tipoCambio: tc ? numDash_(tc) : null,
      comercio: str_(r.comercio), contraparte: str_(r.contraparte), categoria: str_(r.categoria),
      canal: str_(r.canal), fuente: str_(r.fuente)
    };
  });
}

function mesDash_(iso) { return String(iso).slice(0, 7); }

function aBase_(t, usd) { return t.moneda === 'USD' ? t.monto * (t.tipoCambio || usd) : t.monto; }

/** Nombre a mostrar (txLabel de la web). */
function etiquetaTx_(t) {
  return t.comercio || t.contraparte || (t.tipo === 'internal_transfer' ? 'Transferencia entre cuentas' : t.canal === 'yape_p2p' ? 'Yapeo' : '—');
}

/** ["2026-05", …, "2026-10"] terminando en `mes` (lastMonths de la web). */
function ultimosMeses_(mes, n) {
  var p = mes.split('-'), y = +p[0], m = +p[1], out = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2));
  }
  return out;
}

/** "YYYY-MM-DD" de hoy en Lima (UTC−5, sin horario de verano). */
function hoyLima_(ahora) {
  return new Date((ahora || Date.now()) - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

function diasDelMes_(mes) { var p = mes.split('-'); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }

/**
 * Resumen del mes `opts.mes` ("YYYY-MM"; por defecto el actual en Lima). Público (DISPATCH_ resumenDashboard).
 * `opts.hoy` solo para tests.
 */
function resumenDashboard(sheetId, config, opts) {
  opts = opts || {};
  var usd = parseFloat((config.ajustes || {})['fx.usd_pen']) || 3.5;
  var hoy = /^\d{4}-\d{2}-\d{2}$/.test(opts.hoy || '') ? opts.hoy : hoyLima_();
  var mesHoy = hoy.slice(0, 7);
  var mes = /^\d{4}-\d{2}$/.test(opts.mes || '') ? opts.mes : mesHoy;
  var txs = txsDashboard_(sheetId, config);
  function suma(xs) { return redondear2_(xs.reduce(function (s, t) { return s + aBase_(t, usd); }, 0)); }
  function delTipo(xs, tipo) { return xs.filter(function (t) { return t.tipo === tipo; }); }

  var enMes = txs.filter(function (t) { return mesDash_(t.fecha) === mes; });
  var gastos = delTipo(enMes, 'expense');
  var gasto = suma(gastos), ingresos = suma(delTipo(enMes, 'income'));
  var recibidos = delTipo(enMes, 'transfer_in');

  // En qué se fue
  var porCat = {};
  gastos.forEach(function (t) { var k = t.categoria || 'Sin categoría'; porCat[k] = (porCat[k] || 0) + aBase_(t, usd); });
  var categorias = Object.keys(porCat).map(function (k) {
    return { nombre: k, monto: redondear2_(porCat[k]), pct: gasto ? Math.round(porCat[k] / gasto * 100) : 0, color: colorCategoria_(k),
      n: gastos.filter(function (t) { return (t.categoria || 'Sin categoría') === k; }).length };
  }).sort(function (a, b) { return b.monto - a.monto; });

  var porCom = {};
  gastos.forEach(function (t) {
    var k = etiquetaTx_(t), c = porCom[k] || (porCom[k] = { monto: 0, n: 0, categoria: '' });
    c.monto += aBase_(t, usd); c.n++;
    if (!c.categoria && t.categoria) c.categoria = t.categoria;   // icono/color: la primera categoría conocida
  });
  var comercios = Object.keys(porCom).map(function (k) {
    return { nombre: k, monto: redondear2_(porCom[k].monto), n: porCom[k].n, categoria: porCom[k].categoria, color: colorCategoria_(porCom[k].categoria) };
  }).sort(function (a, b) { return b.monto - a.monto; }).slice(0, 8);

  // Últimos meses y tendencia por categoría
  var meses = ultimosMeses_(mes, DASH_MESES_);
  var gastosVentana = txs.filter(function (t) { return t.tipo === 'expense' && meses.indexOf(mesDash_(t.fecha)) > -1; });
  var porMes = meses.map(function (m) {
    return { mes: m, gasto: suma(gastosVentana.filter(function (t) { return mesDash_(t.fecha) === m; })) };
  });
  var gastoAnterior = porMes[porMes.length - 2].gasto;
  var totalCat = {};
  gastosVentana.forEach(function (t) { var k = t.categoria || 'Sin categoría'; totalCat[k] = (totalCat[k] || 0) + aBase_(t, usd); });
  var top = Object.keys(totalCat).sort(function (a, b) { return totalCat[b] - totalCat[a]; }).slice(0, DASH_SERIES_);
  function serie(nombre, filtro) {
    return { nombre: nombre, color: nombre === 'Otras' ? CAT_NINGUNA_ : colorCategoria_(nombre), valores: meses.map(function (m) {
      return suma(gastosVentana.filter(function (t) { return mesDash_(t.fecha) === m && filtro(t.categoria || 'Sin categoría'); }));
    }) };
  }
  var series = top.map(function (k) { return serie(k, function (c) { return c === k; }); });
  if (Object.keys(totalCat).length > top.length) series.push(serie('Otras', function (c) { return top.indexOf(c) < 0; }));

  // Ritmo del mes (pace de la web): relleno = gasto / gasto del mes anterior; marca = día / días del mes.
  var dias = diasDelMes_(mes);
  var cerrado = mes < mesHoy;
  var dia = cerrado ? dias : mes > mesHoy ? 0 : +hoy.slice(8, 10);

  var mesesConDatos = {};
  mesesConDatos[mesHoy] = true;
  txs.forEach(function (t) { if (/^\d{4}-\d{2}/.test(t.fecha)) mesesConDatos[mesDash_(t.fecha)] = true; });

  return {
    mes: mes, hoy: hoy, moneda: 'PEN', usd: usd,
    meses: Object.keys(mesesConDatos).sort().reverse(),
    resumen: {
      gasto: gasto, gastoAnterior: gastoAnterior, ingresos: ingresos, teQueda: redondear2_(ingresos - gasto),
      yape: suma(recibidos), yapeN: recibidos.length, n: gastos.length,
      porCategorizar: gastos.filter(function (t) { return !t.categoria; }).length,
      delta: gastoAnterior > 0 ? Math.round((gasto - gastoAnterior) / gastoAnterior * 100) : null,
      ritmo: { gastado: gastoAnterior > 0 ? Math.min(1, gasto / gastoAnterior) : null, dia: dia, dias: dias, cerrado: cerrado }
    },
    categorias: categorias,
    comercios: comercios,
    porMes: porMes,
    tendencia: { meses: meses, series: series },
    movimientos: enMes.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, DASH_MAX_MOVIMIENTOS_).map(function (t) {
      return { fecha: t.fecha, tipo: t.tipo, etiqueta: etiquetaTx_(t), categoria: t.categoria, color: colorCategoria_(t.categoria),
        monto: t.monto, moneda: t.moneda, base: redondear2_(aBase_(t, usd)), fuente: t.fuente, canal: t.canal };
    })
  };
}
