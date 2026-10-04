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
  for (const fn of usadas) assert.ok(h.api.DISPATCH_[fn], 'falta en DISPATCH_: ' + fn);
  for (const fn of ['estadoLuca', 'escanearAhora', 'guardarLlmKey', 'iniciarImportacion', 'conectarIphone', 'regenerarTokenIphone', 'desconectarIphone']) {
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
});

test('Sidebar: el enlace del atajo placeholder lo entrega el servidor (conectarIphone), no está cableado en el HTML', () => {
  assert.doesNotMatch(html, /icloud\.com\/shortcuts/);
  const h = makeHarness({ execUrl: 'https://script.google.com/macros/s/TEST/exec', spreadsheets: { s: {} } });
  const cfg = h.api.construirConfig('s', {});
  assert.equal(h.api.conectarIphone('s', cfg).shortcutUrl, 'https://www.icloud.com/shortcuts/PENDIENTE');
});
