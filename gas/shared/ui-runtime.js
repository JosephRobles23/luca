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

var AUTORIZAR_DIAS_ = 30;

function resumenScan_(st) {
  return 'Nuevos: ' + (st.added || 0) + ' · Ya existentes: ' + (st.skipped || 0) + ' · Ignorados: ' + (st.ignored || 0) + ' · Desconocidos: ' + (st.unknown || 0);
}

/**
 * Autorizar (ADR-006 §3.2). Primera vez (sin cursor): (a) instala el trigger, (b) importa el último mes
 * y corre la primera pasada, (c) muestra un resumen. Con cursor: escaneo normal.
 *
 * Triggers: en Apps Script un trigger solo puede apuntar a una función del PROYECTO CONTENEDOR (el stub),
 * y `ScriptApp` dentro de la librería es el de la librería. Por eso el stub pasa su propia función
 * `setupTriggers` como callback (`installTriggers`) y la librería solo la invoca: la creación del
 * trigger ocurre en el contexto del stub y apunta a su `dispatcher`. Un stub antiguo que no pase el
 * callback sigue funcionando (se avisa que falta el escaneo automático).
 */
function autorizar(sheetId, config, installTriggers) {
  var ui = SpreadsheetApp.getUi();
  if (config.gmail.cursor) {
    var st = escanearAhora(sheetId, config);
    ui.alert('Luca', 'Escaneo listo. ' + resumenScan_(st), ui.ButtonSet.OK);
    return { modo: 'scan', scan: st };
  }
  var trigger = { installed: false, error: '' };
  if (typeof installTriggers === 'function') {
    try { installTriggers(); trigger.installed = true; setAjustes_(sheetId, config, { 'triggers.installedAt': new Date().toISOString() }); }
    catch (e) { trigger.error = String(e && e.message || e); Logger.log('autorizar: no se pudo instalar el trigger: ' + trigger.error); }
  } else {
    trigger.error = 'stub sin setupTriggers';
  }
  var since = Math.floor(Date.now() / 1000) - AUTORIZAR_DIAS_ * 86400;
  // El cursor se fija en `since` antes de importar: así Autorizar es idempotente aunque el buzón esté
  // vacío, y el escaneo incremental arranca donde termina la importación (pasadaImportacion_ lo avanza).
  setAjustes_(sheetId, config, { 'gmail.cursor': String(since) });
  var imp = iniciarImportacion(sheetId, config, since);
  writeTelemetria_(sheetId, config, imp);
  var msg = 'Luca quedó activado.\n' +
    (trigger.installed ? 'Escaneo automático cada 15 min: instalado.\n' : 'Escaneo automático: NO se pudo instalar (' + trigger.error + ').\n') +
    'Importación del último mes: ' + resumenScan_(imp) + (imp.done ? '.' : '. Continúa en segundo plano.');
  ui.alert('Luca', msg, ui.ButtonSet.OK);
  return { modo: 'autorizar', trigger: trigger, import: imp };
}

var MENU_ACTIONS_ = {
  lucaMenu1: function (sheetId, config, extra) { return autorizar(sheetId, config, extra); },
  lucaMenu2: function (sheetId, config) {
    var d = buildDialog('dashboard');
    SpreadsheetApp.getUi().showModalDialog(d.html, d.titulo);
  }
};

/** `extra`: para lucaMenu1, la función `setupTriggers` del stub (ver autorizar). */
function menuAction(slot, sheetId, config, extra) {
  var fn = MENU_ACTIONS_[slot];
  if (!fn) throw new Error('Acción de menú no definida: ' + slot);
  return fn(sheetId, config, extra);
}

var DISPATCH_ = {
  cargarConfig:      function (sid, cfg, a) { return cargarConfig(sid, cfg); },
  estadoLedger:      function (sid, cfg, a) { return estadoLedger(sid, cfg); },
  estadoSecretos:    function (sid, cfg, a) { return estadoSecretos_(); },
  guardarLlmKey:     function (sid, cfg, a) { return guardarLlmKey(sid, cfg, a[0]); },
  guardarAjustes:    function (sid, cfg, a) { setAjustes_(sid, cfg, a[0] || {}); return cargarConfig(sid, construirConfig(sid, cfg)); },
  escanearAhora:     function (sid, cfg, a) { return escanearAhora(sid, cfg); },
  iniciarImportacion: function (sid, cfg, a) { return iniciarImportacion(sid, cfg, parseInt(a[0], 10)); },
  leerLedger:        function (sid, cfg, a) { return readLedger_(sid, cfg); },
  listarCategorias:  function (sid, cfg, a) { return listarCategorias(sid, cfg); },
  recategorizar:     function (sid, cfg, a) { return recategorizar(sid, cfg, a[0] || {}); },
  categorizarPendientes: function (sid, cfg, a) { return categorizarPendientes(sid, cfg, a[0] || {}); },
  probarLlm:         function (sid, cfg, a) { return probarLlm(sid, cfg); },
  conectarIphone:    function (sid, cfg, a) { return conectarIphone(sid, cfg); },
  regenerarTokenIphone: function (sid, cfg, a) { return regenerarTokenIphone(sid, cfg); },
  desconectarIphone: function (sid, cfg, a) { return desconectarIphone(sid, cfg); },
  estadoLuca:        function (sid, cfg, a) { return estadoLuca(sid, cfg); }
};

/** Estado completo para el sidebar en una sola llamada (versión, cursor, último escaneo, conexiones). */
function estadoLuca(sheetId, config) {
  var a = config.ajustes || {};
  var ledger = estadoLedger(sheetId, config);
  var stats = null;
  try { stats = a['scan.lastStats'] ? JSON.parse(a['scan.lastStats']) : null; } catch (e) { stats = null; }
  return {
    version: LUCA_VERSION,
    versionEnAjustes: a['luca.version'] || '',
    autorizado: !!config.gmail.cursor,
    cursor: config.gmail.cursor,
    cursorIso: config.gmail.cursor ? new Date(config.gmail.cursor * 1000).toISOString() : '',
    lastRunAt: a['scan.lastRunAt'] || '',
    lastStats: stats,
    triggerInstaladoEn: a['triggers.installedAt'] || '',
    importacion: { status: a['import.status'] || '', since: int_(a['import.since'], 0) },
    ledger: ledger,
    secretos: estadoSecretos_(),
    llm: {
      provider: (config.llm && config.llm.provider) || a['llm.provider'] || '',
      model: (config.llm && config.llm.model) || a['llm.model'] || '',
      lastTestAt: a['llm.lastTestAt'] || '', lastError: a['llm.lastError'] || '',
      proveedores: llmProveedores_(), defaults: LLM_DEFAULT_MODELS_
    },
    execUrl: a['conexiones.execUrl'] || execUrl_(config),
    iphone: telemetriaIphone_(a)
  };
}

function dispatch(fnName, args, sheetId, config) {
  // Módulos opcionales aportan su propia tabla (p. ej. MCP_DISPATCH_ en mcp-runtime.js).
  var fn = DISPATCH_[fnName] || (typeof MCP_DISPATCH_ !== 'undefined' ? MCP_DISPATCH_[fnName] : null);
  if (!fn) throw new Error('Función no permitida vía lucaRun: ' + fnName);
  return fn(sheetId, config, args || []);
}
