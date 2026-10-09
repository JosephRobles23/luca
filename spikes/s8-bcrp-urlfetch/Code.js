// S8: ¿UrlFetchApp (IPs de Google) pasa el filtro Imperva del BCRP?
var BCRP_URL_ = 'https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04639PD-PD04640PD-PD04648PD/json/';

function bcrpUrl_() {
  var hoy = new Date(), desde = new Date(hoy.getTime() - 14 * 864e5);
  var f = function (d) { return Utilities.formatDate(d, 'America/Lima', 'yyyy-M-d'); };
  return BCRP_URL_ + f(desde) + '/' + f(hoy) + '/esp';
}

function intento_(url, headers) {
  var t0 = Date.now();
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: headers || {} });
    var body = r.getContentText();
    var h = r.getAllHeaders();
    var out = {
      status: r.getResponseCode(), ms: Date.now() - t0,
      contentType: h['Content-Type'] || h['content-type'], cdn: h['x-cdn'] || h['X-CDN'] || '',
      imperva: /Incapsula|_Incapsula_Resource|Request unsuccessful/i.test(body),
      bytes: body.length, head: body.slice(0, 160)
    };
    try {
      var d = JSON.parse(body);
      var ult = d.periods.filter(function (p) { return p.values[0] !== 'n.d.'; }).pop();
      out.json = true; out.ultimo = ult;
    } catch (e) { out.json = false; }
    return out;
  } catch (e) {
    return { error: String(e), ms: Date.now() - t0 };
  }
}

// Una "ronda" = lo que haría un trigger diario: hasta 4 intentos con espera creciente.
// conCookies: reenvía las cookies de Imperva (visid_incap_*, incap_ses_*) que devuelve cada respuesta.
function ronda_(url, conCookies, jar) {
  for (var k = 0; k < 4; k++) {
    if (k) Utilities.sleep(1500 * k);
    var headers = conCookies && jar.c ? { Cookie: jar.c } : {};
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: headers });
    if (conCookies) {
      var sc = r.getAllHeaders()['Set-Cookie'];
      sc = sc ? [].concat(sc) : [];
      if (sc.length) jar.c = sc.map(function (x) { return x.split(';')[0]; }).join('; ');
    }
    try { JSON.parse(r.getContentText()); return k + 1; } catch (e) { /* desafío Imperva: HTML con 200 */ }
  }
  return 0;
}

function probar() {
  var url = bcrpUrl_(), res = { url: url, at: new Date().toISOString() };
  ['sinCookies', 'conCookies'].forEach(function (modo) {
    var jar = {}, intentos = [];
    for (var i = 0; i < 10; i++) { intentos.push(ronda_(url, modo === 'conCookies', jar)); Utilities.sleep(800); }
    res[modo] = {
      intentosPorRonda: intentos.join(','),           // 1 = a la primera; 0 = falló las 4
      aLaPrimera: intentos.filter(function (n) { return n === 1; }).length + '/10',
      rondasFallidas: intentos.filter(function (n) { return n === 0; }).length
    };
  });
  res.muestra = intento_(url);
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify(probar(), null, 2)).setMimeType(ContentService.MimeType.JSON);
}
