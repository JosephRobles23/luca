/**
 * triggers.js — Instalación de activadores (idempotente).
 *
 * Vive en el stub y NO en la librería porque un trigger solo puede apuntar a una función del proyecto
 * contenedor (`dispatcher`), y `ScriptApp` dentro de LucaLib es el de la librería. El stub pasa esta
 * función como callback a `LucaLib.menuAction('lucaMenu1', …, setupTriggers)` y la librería la invoca
 * en el primer "Autorizar" (ver LucaLib.autorizar).
 *
 * @return {{created:boolean}} true si se creó uno nuevo; false si ya existía.
 */
function setupTriggers() {
  var existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dispatcher'; });
  if (existe) return { created: false };
  // Escaneo incremental de Gmail cada 15 min (cuota consumer: 90 min/día de triggers; cada pasada dura segundos).
  ScriptApp.newTrigger('dispatcher').timeBased().everyMinutes(15).create();
  return { created: true };
}

/** Quita el trigger (para desactivar Luca en esta copia). Llamable a mano desde el editor. */
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dispatcher') ScriptApp.deleteTrigger(t);
  });
}
