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

test('Sidebar: cada onclick tiene su función definida y hay secciones Estado / API key / Importar / iPhone', () => {
  const handlers = [...html.matchAll(/onclick="([A-Za-z_]+)\(\)"/g)].map((m) => m[1]);
  assert.ok(handlers.length >= 6);
  for (const fn of handlers) assert.match(html, new RegExp('function ' + fn + '\\('), 'handler sin función: ' + fn);
  for (const sec of ['Estado', 'API key', 'Importar historial', 'Conectar iPhone']) assert.match(html, new RegExp('<h3>' + sec));
  assert.match(html, /Desconectar iPhone/);
  assert.match(html, /Regenerar token/);
  assert.match(html, /Versión LucaLib/);
  // Extractor opt-in (ADR-008): casilla que guarda llm.extractUnknown y botón de reintento.
  assert.match(html, /id="llmExtract"[^>]*onchange="guardarExtraer\(\)"/);
  assert.match(html, /Extraer con IA los correos que Luca no reconoce \(envía el texto del correo con nombres y números enmascarados\)/);
  assert.match(html, /'llm\.extractUnknown': on \? 'true' : 'false'/);
  assert.match(html, /Reintentar desconocidos con IA/);
});

test('Sidebar: Conectar iPhone es un mini-wizard (Web App → URL/token con Copiar → prompt → estado)', () => {
  assert.match(html, /onclick="probarWebAppIphone\(\)"/);
  assert.match(html, /Comprobar Web App/);
  assert.match(html, /id="btnCopiarUrl"[^>]*onclick="copiarUrlIphone\(\)"/);
  assert.match(html, /id="btnCopiarToken"[^>]*onclick="copiarTokenIphone\(\)"/);
  assert.match(html, /id="btnPrompt"[^>]*onclick="copiarPromptIphone\(\)"/);
  assert.match(html, /Copiar prompt para Atajos/);
  // Portapapeles: navigator.clipboard con fallback a textarea seleccionado + execCommand('copy').
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /document\.execCommand\('copy'\)/);
  assert.match(html, /<textarea id="clip"/);
  // El enlace de iCloud solo se muestra si el servidor dice que el atajo está disponible (no el placeholder).
  assert.match(html, /iphoneDatos\.shortcutDisponible && iphoneDatos\.shortcutUrl/);
  assert.match(html, /Instalar atajo \(iCloud\)/);
  // Estado con telemetría y acciones.
  for (const t of ['Última prueba', 'Último evento', 'Eventos recibidos', 'Regenerar token', 'Desconectar iPhone']) assert.ok(html.includes(t), 'falta ' + t);
  assert.match(html, /tele\.lastTestAt/); assert.match(html, /tele\.lastEventAt/);
});

test('Sidebar: el enlace del atajo placeholder lo entrega el servidor (conectarIphone), no está cableado en el HTML', () => {
  assert.doesNotMatch(html, /icloud\.com\/shortcuts/);
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { s: {} } });
  const cfg = h.api.construirConfig('s', {});
  const d = h.api.conectarIphone('s', cfg);
  assert.equal(d.shortcutUrl, 'https://www.icloud.com/shortcuts/PENDIENTE');
  assert.equal(d.shortcutDisponible, false);
});
