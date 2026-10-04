/**
 * Tests del stub (gas/stub): el bootloader que vive en la copia del usuario. Se carga en un vm con
 * `LucaLib` y `ScriptApp` mockeados para comprobar que delega bien y que los triggers se crean
 * desde el proyecto contenedor (ver ADR-006 §3.2 y gas/stub/triggers.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
const eq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b); // objetos del sandbox vm
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB = path.join(HERE, '..', 'gas', 'stub');
const STUB_FILES = ['config.js', 'triggers.js', 'Code.js'];

function makeStub(opts = {}) {
  const calls = [];
  const triggers = (opts.triggers || []).map((fn) => ({ getHandlerFunction: () => fn }));
  const sandbox = {
    console,
    LucaLib: new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return opts.lib?.[name]?.(...args) ?? { lib: name }; } }),
    SpreadsheetApp: { getActive: () => ({ getId: () => 'SHEET-ID' }), getUi: () => ({ showSidebar() {}, showModalDialog() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: (m) => ({ create: () => { triggers.push({ getHandlerFunction: () => fn, minutes: m }); } }) }) }),
      getService: () => ({ getUrl: () => { if (opts.execUrl === null) throw new Error('sin despliegue'); return opts.execUrl ?? 'https://script.google.com/macros/s/STUB/exec'; } })
    }
  };
  vm.createContext(sandbox);
  for (const f of STUB_FILES) vm.runInContext(fs.readFileSync(path.join(STUB, f), 'utf8'), sandbox, { filename: f });
  return { api: sandbox, calls, triggers };
}

test('setupTriggers crea el trigger `dispatcher` cada 15 min una sola vez (idempotente)', () => {
  const s = makeStub();
  eq(s.api.setupTriggers(), { created: true });
  eq(s.api.setupTriggers(), { created: false });
  assert.equal(s.triggers.length, 1);
  assert.equal(s.triggers[0].getHandlerFunction(), 'dispatcher');
  assert.equal(s.triggers[0].minutes, 15);
  s.api.removeTriggers();
  assert.equal(s.triggers.length, 0);
});

test('lucaMenu1 (Autorizar) pasa setupTriggers del stub como callback a LucaLib.menuAction', () => {
  const s = makeStub({ lib: { construirConfig: () => ({ sheets: {} }) } });
  s.api.lucaMenu1();
  const call = s.calls.find((c) => c[0] === 'menuAction');
  assert.equal(call[1], 'lucaMenu1');
  assert.equal(call[2], 'SHEET-ID');
  assert.equal(typeof call[4], 'function');
  // Ese callback es el setupTriggers real del stub: al invocarlo se crea el trigger en este proyecto.
  call[4]();
  assert.equal(s.triggers.length, 1);
});

test('getConfig_ añade execUrl resuelta en el contexto del stub (vacía sin despliegue); CONFIG_STATIC incluye Categorías', () => {
  const s = makeStub({ lib: { construirConfig: (sid, st) => ({ sheets: st.sheets }) } });
  assert.equal(s.api.getConfig_().execUrl, 'https://script.google.com/macros/s/STUB/exec');
  assert.equal(s.api.CONFIG_STATIC.sheets.categories, 'Categorías');
  const s2 = makeStub({ execUrl: null, lib: { construirConfig: () => ({}) } });
  assert.equal(s2.api.getConfig_().execUrl, '');
});

test('lucaRun y dispatcher delegan en LucaLib con sheetId y config', () => {
  const s = makeStub({ lib: { construirConfig: () => ({ sheets: {} }), dispatch: () => 'ok' } });
  assert.equal(s.api.lucaRun('estadoLuca', '[]'), 'ok');
  const d = s.calls.find((c) => c[0] === 'dispatch');
  eq(d.slice(1, 3), ['estadoLuca', []]);
  s.api.dispatcher();
  assert.ok(s.calls.some((c) => c[0] === 'runDispatcher' && c[1] === 'SHEET-ID'));
});
