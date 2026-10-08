/**
 * schemas.test.mjs — Formas de entrada de las tools v0 (src/schemas.ts), sin Workers ni miniflare.
 * Node ≥ 22.18 ejecuta .ts por type-stripping. Requiere `npm install` en services/luca-mcp (zod);
 * si falta, los tests se marcan como omitidos para no romper `npm test` en la raíz.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let mod = null;
try { mod = await import('../src/schemas.ts'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const skip = mod ? false : 'falta `npm install` en services/luca-mcp';

const ok = (name, args) => { const r = mod.toolSchemas[name].safeParse(args); assert.equal(r.success, true, JSON.stringify(r.error?.issues)); return r.data; };
const bad = (name, args) => assert.equal(mod.toolSchemas[name].safeParse(args).success, false, `${name} debería rechazar ${JSON.stringify(args)}`);

test('las 6 tools v0 existen con descripción', { skip }, () => {
  assert.deepEqual(mod.TOOL_NAMES.sort(), ['add_expense', 'budget_status', 'category_breakdown', 'get_summary', 'list_transactions', 'top_merchants']);
  for (const n of mod.TOOL_NAMES) assert.ok(mod.toolDescriptions[n].length > 20, n);
});

test('cada tool declara título y readOnlyHint explícito: solo add_expense escribe, ninguna destruye', { skip }, () => {
  for (const n of mod.TOOL_NAMES) {
    assert.ok(mod.toolTitles[n], n);
    const a = mod.toolAnnotations[n];
    assert.equal(typeof a.readOnlyHint, 'boolean', n);
    assert.equal(a.openWorldHint, false, n);
    assert.equal(a.readOnlyHint, n !== 'add_expense', n);
  }
  assert.equal(mod.toolAnnotations.add_expense.destructiveHint, false);
  assert.equal(mod.toolAnnotations.add_expense.idempotentHint, false);
});

test('month: YYYY-MM estricto', { skip }, () => {
  ok('get_summary', { month: '2026-10' });
  ok('category_breakdown', { month: '2026-01' });
  ok('budget_status', { month: '2026-12' });
  bad('get_summary', { month: '2026-13' });
  bad('get_summary', { month: '2026-1' });
  bad('get_summary', { month: '10/2026' });
  bad('get_summary', {});
});

test('top_merchants: limit entero positivo ≤ 50', { skip }, () => {
  ok('top_merchants', { month: '2026-10' });
  ok('top_merchants', { month: '2026-10', limit: 5 });
  bad('top_merchants', { month: '2026-10', limit: 0 });
  bad('top_merchants', { month: '2026-10', limit: 51 });
  bad('top_merchants', { month: '2026-10', limit: 2.5 });
});

test('list_transactions: todos opcionales, enums y fechas', { skip }, () => {
  ok('list_transactions', {});
  ok('list_transactions', { month: '2026-10', tipo: 'expense', categoria: 'Comida', texto: 'wong', limit: 200 });
  ok('list_transactions', { from: '2026-10-01', to: '2026-10-31' });
  bad('list_transactions', { tipo: 'rejected' });
  bad('list_transactions', { from: '2026-10' });
  bad('list_transactions', { limit: 201 });
  bad('list_transactions', { categoria: '' });
});

test('add_expense: monto > 0, moneda PEN/USD, fecha día o ISO', { skip }, () => {
  const d = ok('add_expense', { monto: 12.5, fecha: '2026-10-07' });
  assert.equal(d.moneda, undefined); // el default PEN lo pone GAS
  ok('add_expense', { monto: 1, moneda: 'USD', fecha: '2026-10-07T13:05', comercio: 'Bodega', categoria: 'Comida', nota: 'x', force: true });
  ok('add_expense', { monto: 1, fecha: '2026-10-07T13:05:00-05:00', contraparte: 'María' });
  ok('add_expense', { monto: 1, fecha: '2026-10-07T13:05:00Z' });
  bad('add_expense', { monto: 0, fecha: '2026-10-07' });
  bad('add_expense', { monto: -3, fecha: '2026-10-07' });
  bad('add_expense', { monto: '12', fecha: '2026-10-07' });
  bad('add_expense', { monto: 5, moneda: 'EUR', fecha: '2026-10-07' });
  bad('add_expense', { monto: 5, fecha: 'ayer' });
  bad('add_expense', { monto: 5, fecha: '07/10/2026' });
  bad('add_expense', { monto: 5 });
});

test('isExecUrl acepta solo Web Apps de Apps Script', { skip }, () => {
  assert.equal(mod.isExecUrl('https://script.google.com/macros/s/AKfycb-xyz/exec'), true);
  assert.equal(mod.isExecUrl('https://script.google.com/a/macros/empresa.com/s/AKfycb/exec'), true);
  assert.equal(mod.isExecUrl('https://script.google.com/macros/s/AKfycb-xyz/dev'), false);
  assert.equal(mod.isExecUrl('https://evil.example/macros/s/x/exec'), false);
  assert.equal(mod.isExecUrl('http://script.google.com/macros/s/x/exec'), false);
  assert.equal(mod.isExecUrl(''), false);
});
