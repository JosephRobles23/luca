/**
 * ui-runtime.js — Menú, diálogos y el despachador con lista blanca (patrón CoS-Agent).
 *
 * El stub expone UN solo puente `lucaRun(fnName, argsJson)` → dispatch(). Toda función nueva para
 * la UI se registra en DISPATCH_ y llega al usuario por versión de librería, sin tocar el stub.
 * Convención: fn(sheetId, config, ...args).
 *
 * Sin import/export: runtime de Apps Script.
 */

function construirMenu(ui) {
  ui.createMenu('Luca')
    .addItem('✅ Autorizar / Escanear ahora', 'lucaMenu1')
    .addItem('📊 Dashboard', 'lucaMenu2')
    .addItem('⚙️ Configuración', 'abrirSidebar')
    .addToUi();
}

function buildSidebar() {
  return HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Luca — Configuración');
}

var DIALOGOS_ = {
  dashboard: { archivo: 'DialogDashboard', titulo: 'Luca — Dashboard', ancho: 1100, alto: 760 }
};

function buildDialog(nombre) {
  var d = DIALOGOS_[nombre];
  if (!d) throw new Error('Diálogo desconocido: ' + nombre);
  var html = HtmlService.createHtmlOutputFromFile(d.archivo).setWidth(d.ancho).setHeight(d.alto);
  return { html: html, titulo: d.titulo };
}

var MENU_ACTIONS_ = {
  lucaMenu1: function (sheetId, config) {
    var st = escanearAhora(sheetId, config);
    SpreadsheetApp.getUi().alert('Luca', 'Escaneo listo. Nuevos: ' + st.added + ' · Ya existentes: ' + st.skipped +
      ' · Ignorados: ' + st.ignored + ' · Desconocidos: ' + st.unknown, SpreadsheetApp.getUi().ButtonSet.OK);
    return st;
  },
  lucaMenu2: function (sheetId, config) {
    var d = buildDialog('dashboard');
    SpreadsheetApp.getUi().showModalDialog(d.html, d.titulo);
  }
};

function menuAction(slot, sheetId, config) {
  var fn = MENU_ACTIONS_[slot];
  if (!fn) throw new Error('Acción de menú no definida: ' + slot);
  return fn(sheetId, config);
}

var DISPATCH_ = {
  cargarConfig:      function (sid, cfg, a) { return cargarConfig(sid, cfg); },
  estadoLedger:      function (sid, cfg, a) { return estadoLedger(sid, cfg); },
  estadoSecretos:    function (sid, cfg, a) { return estadoSecretos_(); },
  guardarLlmKey:     function (sid, cfg, a) { return guardarLlmKey(sid, cfg, a[0]); },
  guardarAjustes:    function (sid, cfg, a) { setAjustes_(sid, cfg, a[0] || {}); return cargarConfig(sid, construirConfig(sid, cfg)); },
  escanearAhora:     function (sid, cfg, a) { return escanearAhora(sid, cfg); },
  iniciarImportacion: function (sid, cfg, a) { return iniciarImportacion(sid, cfg, parseInt(a[0], 10)); },
  leerLedger:        function (sid, cfg, a) { return readLedger_(sid, cfg); }
};

function dispatch(fnName, args, sheetId, config) {
  var fn = DISPATCH_[fnName];
  if (!fn) throw new Error('Función no permitida vía lucaRun: ' + fnName);
  return fn(sheetId, config, args || []);
}
