/**
 * triggers.js — Instalación de activadores (idempotente). La llama la librería tras "Autorizar".
 */

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dispatcher') ScriptApp.deleteTrigger(t);
  });
  // Escaneo incremental de Gmail cada 15 min (cuota consumer: 90 min/día de triggers; cada pasada dura segundos).
  ScriptApp.newTrigger('dispatcher').timeBased().everyMinutes(15).create();
}
