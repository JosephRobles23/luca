/**
 * Spike S3/S4 — stub mínimo ligado a un Sheet plantilla.
 * S3: observar la pantalla de consentimiento con gmail.readonly en una copia propia.
 * S4: inspeccionar ScriptApp.getIdentityToken() (aud/sub) por copia.
 *
 * onOpen es un simple trigger: no puede usar servicios con auth, solo pintar el menú.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Luca (spike)')
    .addItem('1. Autorizar Gmail', 'autorizarGmail')
    .addItem('2. Ver identity token', 'verIdentityToken')
    .addItem('3. Ver scopes concedidos', 'verScopes')
    .addToUi();
}

/** S3: primera llamada a un servicio con scope restringido → dispara el consentimiento. */
function autorizarGmail() {
  // Servicio avanzado Gmail (habilitado en appsscript.json) con scope explícito gmail.readonly.
  var res = Gmail.Users.Messages.list('me', {
    q: 'from:(notificaciones@notificacionesbcp.com.pe OR notificaciones@yape.pe)',
    maxResults: 5
  });
  var n = (res.messages || []).length;
  SpreadsheetApp.getUi().alert('OK: Gmail autorizado. Mensajes BCP/Yape encontrados en la muestra: ' + n);
}

/** S4: muestra el ID token para decodificarlo en local con spikes/s4-decode-jwt.mjs. */
function verIdentityToken() {
  var token = ScriptApp.getIdentityToken(); // requiere scope "openid"
  var html = HtmlService.createHtmlOutput(
    '<p style="font:13px system-ui">Copia el token (no lo pegues en sitios web; decodifícalo en local):</p>' +
    '<textarea style="width:100%;height:220px;font:11px monospace">' + token + '</textarea>'
  ).setWidth(520).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, 'Identity token');
}

function verScopes() {
  var scopes = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizedScopes();
  SpreadsheetApp.getUi().alert('Scopes concedidos:\n' + scopes.join('\n'));
}
