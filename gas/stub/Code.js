/**
 * Code.js — Stub ligado a la plantilla de Sheet (uno por usuario, copiado con files.copy).
 * Bootloader DELGADO y ESTABLE: toda la lógica y la UI viven en la librería `LucaLib`.
 * Solo expone lo que la plataforma obliga a tener en el proyecto contenedor.
 *
 * Sin import/export: runtime de Apps Script (namespace global del stub).
 */

// onOpen es un simple trigger: solo pinta el menú (no puede usar servicios con autorización).
function onOpen() {
  LucaLib.construirMenu(SpreadsheetApp.getUi());
}

function abrirSidebar() {
  SpreadsheetApp.getUi().showSidebar(LucaLib.buildSidebar());
}

function abrirDialogo(nombre) {
  var d = LucaLib.buildDialog(nombre);
  SpreadsheetApp.getUi().showModalDialog(d.html, d.titulo);
}

// Puente único del server-API (google.script.run resuelve SIEMPRE en el stub).
function lucaRun(fnName, argsJson) {
  return LucaLib.dispatch(fnName, JSON.parse(argsJson || '[]'), getSheetId_(), getConfig_());
}

// Slots de menú: el menú lo arma la librería; la acción se define en LucaLib.menuAction.
// lucaMenu1 = Autorizar: pasa `setupTriggers` (triggers.js) para que el trigger se cree en este proyecto.
function lucaMenu1() { return LucaLib.menuAction('lucaMenu1', getSheetId_(), getConfig_(), setupTriggers); }
function lucaMenu2() { return LucaLib.menuAction('lucaMenu2', getSheetId_(), getConfig_()); }
function lucaMenu3() { return LucaLib.menuAction('lucaMenu3', getSheetId_(), getConfig_()); }

// Web App (necesario para el iPhone, ADR-003, y para "Conectar con tu IA", ADR-001). GET nunca muta.
function doGet(e)  { return LucaLib.webAction('get', e, getSheetId_(), getConfig_()); }
function doPost(e) { return LucaLib.webAction('post', e, getSheetId_(), getConfig_()); }

// Trigger temporal instalado por setupTriggers.
function dispatcher() {
  return LucaLib.runDispatcher(getSheetId_(), getConfig_());
}
