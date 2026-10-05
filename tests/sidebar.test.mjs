/**
 * Sidebar sin botones muertos: toda llamada `run('x')` del HTML debe existir en DISPATCH_, y todo
 * `onclick="fn()"` debe estar definido en el script del propio sidebar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHarness } from './gas-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', 'Sidebar.html'), 'utf8');

test('Sidebar: cada run(...) apunta a una función de DISPATCH_', () => {
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec' });
  const usadas = [...html.matchAll(/run\('([A-Za-z_]+)'/g)].map((m) => m[1]);
  assert.ok(usadas.length >= 7, 'el sidebar llama a varias funciones');
  for (const fn of usadas) assert.ok(h.api.DISPATCH_[fn] || (h.api.MCP_DISPATCH_ && h.api.MCP_DISPATCH_[fn]), 'falta en DISPATCH_/MCP_DISPATCH_: ' + fn);
  for (const fn of ['estadoLuca', 'escanearAhora', 'guardarLlmKey', 'guardarAjustes', 'probarLlm', 'categorizarPendientes', 'extraerDesconocidos', 'iniciarImportacion', 'conectarIphone', 'regenerarTokenIphone', 'desconectarIphone', 'generarPromptIphone', 'probarWebApp']) {
    assert.ok(usadas.includes(fn), 'el sidebar no usa ' + fn);
  }
});

test('Sidebar: cada onclick tiene su función definida; pestañas Estado / IA / iPhone / MCP con icono SVG', () => {
  const handlers = [...html.matchAll(/onclick="([A-Za-z_]+)\(\)"/g)].map((m) => m[1]);
  assert.ok(handlers.length >= 12);
  for (const fn of handlers) assert.match(html, new RegExp('function ' + fn + '\\('), 'handler sin función: ' + fn);
  for (const [tab, icon] of [['estado', 'actividad'], ['ia', 'chispas'], ['iphone', 'iphone'], ['mcp', 'enchufe']]) {
    assert.match(html, new RegExp('data-tab="' + tab + '"><i data-icon="' + icon + '"></i>'), 'pestaña ' + tab);
    assert.match(html, new RegExp('id="p-' + tab + '"'));
  }
  for (const sec of ['Resumen', 'Conexiones', 'Categorización con IA', 'Yapeos desde el iPhone', 'Claude o ChatGPT']) assert.match(html, new RegExp('<h3>' + sec));
  assert.match(html, /Importar historial/);
  assert.match(html, /Desconectar iPhone/);
  assert.match(html, /Regenerar token/);
  assert.match(html, /Versión LucaLib/);
  // Extractor opt-in (ADR-008): interruptor que guarda llm.extractUnknown y avisa del enmascarado.
  assert.match(html, /id="llmExtract" onchange="guardarExtraer\(\)"/);
  assert.match(html, /Extraer con IA los correos que Luca no reconoce<small>Envía el texto del correo con nombres y números enmascarados/);
  assert.match(html, /'llm\.extractUnknown': on \? 'true' : 'false'/);
  assert.match(html, /Reintentar desconocidos con IA/);
});

test('Sidebar: modo avanzado por usuario (UserProperties), Guía y Dashboard desde la cabecera', () => {
  assert.match(html, /id="avanzado" onchange="cambiarAvanzado\(\)"/);
  assert.match(html, /run\('guardarPrefUi', \{ avanzado: on \}\)/);
  assert.match(html, /class="avz"/);
  assert.match(html, /onclick="abrirGuia\(\)"/);
  assert.match(html, /run\('abrirGuia'\)/);
  assert.match(html, /run\('abrirDashboard'\)/);
  const h = makeHarness({ spreadsheets: { s: {} } });
  const cfg = h.api.construirConfig('s', {});
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.dispatch('guardarPrefUi', [{ avanzado: true }], 's', cfg))), { avanzado: true });
  assert.equal(h.userProps.get('luca.ui.avanzado'), 'true');
  assert.equal(h.api.estadoLuca('s', h.api.construirConfig('s', {})).ui.avanzado, true);
  h.api.dispatch('abrirGuia', [], 's', cfg);
  h.api.dispatch('abrirDashboard', [], 's', cfg);
  h.api.dispatch('abrirSidebar', ['iphone'], 's', cfg);
  const [guia, dash, sb] = h.uiCalls;
  assert.equal(guia.kind, 'modeless'); assert.equal(guia.titulo, 'Luca — Guía');
  assert.equal(dash.kind, 'modal');
  assert.equal(sb.kind, 'sidebar'); assert.match(sb.html.getContent(), /<body data-tab="iphone">/);
  // Pestaña desconocida → la de por defecto, sin inyectar nada.
  assert.match(h.api.buildSidebar('<script>').getContent(), /<body>/);
});

test('Guía: pasos detectados con estadoLuca y acciones que abren el panel en su pestaña', () => {
  const guia = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', 'DialogGuia.html'), 'utf8');
  assert.match(guia, /run\('estadoLuca'\)/);
  assert.match(guia, /run\('abrirSidebar', a\.slice\(6\)\)/);
  for (const t of ['Autorizar Luca', 'Revisar tus movimientos', 'IA para categorizar', 'Conectar el iPhone', 'Claude o ChatGPT']) assert.ok(guia.includes(t), t);
  const h = makeHarness();
  for (const fn of [...guia.matchAll(/run\('([A-Za-z_]+)'/g)].map((m) => m[1])) assert.ok(h.api.DISPATCH_[fn], 'falta en DISPATCH_: ' + fn);
  assert.doesNotMatch(h.api.buildDialog('guia').html.getContent(), /luca-parcial/);
});

test('Sidebar: Conectar iPhone son tres pasos (Web App → URL/token con Copiar → prompt) y estado', () => {
  assert.match(html, /onclick="probarWebAppIphone\(\)"/);
  assert.match(html, /Comprobar Web App/);
  assert.match(html, /id="btnCopiarUrl"[^>]*onclick="copiarUrlIphone\(\)"/);
  assert.match(html, /id="btnCopiarToken"[^>]*onclick="copiarTokenIphone\(\)"/);
  assert.match(html, /id="btnPrompt"[^>]*onclick="copiarPromptIphone\(\)"/);
  assert.match(html, /Copiar prompt para Atajos/);
  for (const t of ['Web App desplegado', 'Datos del atajo', 'Crear el atajo en iOS 27']) assert.ok(html.includes(t), t);
  // Portapapeles: navigator.clipboard con fallback a textarea seleccionado + execCommand('copy').
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /document\.execCommand\('copy'\)/);
  assert.match(html, /<textarea id="clip"/);
  // El enlace de iCloud solo se muestra si el servidor dice que el atajo está disponible (no el placeholder).
  assert.match(html, /iphoneDatos\.shortcutDisponible && iphoneDatos\.shortcutUrl/);
  assert.match(html, /Instalar atajo \(iCloud\)/);
  for (const t of ['Última prueba', 'Último evento', 'Eventos recibidos', 'Regenerar token', 'Desconectar iPhone']) assert.ok(html.includes(t), 'falta ' + t);
  assert.match(html, /tele\.lastTestAt/); assert.match(html, /tele\.lastEventAt/);
});

test('Sidebar: el enlace del atajo placeholder lo entrega el servidor (conectarIphone), no está cableado en el HTML', () => {
  assert.doesNotMatch(html, /icloud\.com\/shortcuts/);
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { s: {} } });
  const cfg = h.api.construirConfig('s', {});
  const d = h.api.conectarIphone('s', cfg);
  assert.equal(d.shortcutUrl, 'https://www.icloud.com/shortcuts/4466a87c439a40b1a3e193d6777ccd38');
  assert.equal(d.shortcutDisponible, true);
});

test('Parciales: buildSidebar y buildDialog insertan _Estilos y _Ui en el servidor (sin marcadores sueltos)', () => {
  const h = makeHarness();
  const sb = h.api.buildSidebar();
  const dash = h.api.buildDialog('dashboard').html;
  for (const out of [sb, dash, h.api.buildDialog('guia').html]) {
    const c = out.getContent();
    assert.doesNotMatch(c, /luca-parcial/);
    assert.match(c, /--primary-strong: #bf5230/, 'tokens de DESIGN.md');
    assert.match(c, /family=Geist/);
    assert.match(c, /<div id="toasts" role="status" aria-live="polite">/);
    assert.match(c, /\.lucaRun\(method, JSON\.stringify\(args\)\)/, 'puente único lucaRun');
    // _Ui va antes del script propio de la página (que usa run/toast/esc).
    assert.ok(c.indexOf('function toast(') < c.lastIndexOf('<script>'));
  }
  assert.match(sb.getContent(), /<img class="logo" alt="" src="data:image\/png;base64,/, 'logo (_Logo)');
  assert.equal(sb._title, 'Luca — Configuración');
  assert.equal(dash._width, 1100);
});

test('UI común: toasts arriba y breves, botones con estado de carga, sin spinners ni pesos 700', () => {
  const ui = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', '_Ui.html'), 'utf8');
  const css = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', '_Estilos.html'), 'utf8');
  assert.match(css, /#toasts \{ position: fixed; top: 10px;/);
  assert.match(ui, /setTimeout\(cerrar, tipo === 'error' \? 7000 : 2800\)/);
  assert.match(ui, /cargando\(btn, true\)/);
  assert.match(ui, /data-cargando/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css + html, /font-weight:\s*700|@keyframes (spin|girar)|rotate\(360deg\)/);
  // El sidebar ya no escribe mensajes en <pre>: usa toast/fallo; el <pre> queda solo para detalle técnico.
  assert.doesNotMatch(html, /function show\(/);
  assert.match(html, /function salida\(/);
  assert.match(html, /id="btnEscanear" data-cargando="Escaneando…"/);
});

