/**
 * Dashboard de la Sheet (dashboard-runtime.js): mismas cifras que la web (summarize de apps/web/src/lib/ledger.ts),
 * ritmo del mes, tendencia por categoría y movimientos listos para pintar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHarness, configFor } from './gas-harness.mjs';
import { rowsToTxs, summarize } from '../apps/web/src/lib/ledger.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const plain = (x) => JSON.parse(JSON.stringify(x));

// id, fecha, tipo, monto, moneda, tipo_cambio, comercio, contraparte, categoria, canal
const FILAS = [
  ['a1', '2026-10-02T21:06:00-05:00', 'expense', 53.3, 'PEN', '', 'CA012 AVIACION', '', 'Transporte', ''],
  ['a2', '2026-10-03T19:07:00-05:00', 'internal_transfer', 30, 'PEN', 3.409, '', '', 'Transferencias', ''],
  ['a3', '2026-10-04T16:05:00-05:00', 'expense', 1.24, 'USD', 3.4, 'SPACESHIP.COM* OJF3CV', '', 'Suscripciones', ''],
  ['a4', '2026-10-04T08:47:00-05:00', 'expense', 0.96, 'USD', '', '', 'GAVY ROBLES', '', 'plin'],
  ['a5', '2026-10-05T00:20:00-05:00', 'transfer_in', 1.5, 'PEN', '', '', 'Nolberto Roj*', 'Transferencias', 'yape_p2p'],
  ['a6', '2026-10-01T09:00:00-05:00', 'income', 2500, 'PEN', '', 'PLANILLA', '', 'Ingreso', ''],
  ['a7', '2026-10-01T18:57:00-05:00', 'expense', 66.68, 'PEN', '', 'RAPPI SAC', '', 'Comidas fuera', ''],
  ['b1', '2026-09-29T19:34:00-05:00', 'expense', 66.68, 'PEN', '', 'RAPPI SAC', '', 'Comidas fuera', ''],
  ['b2', '2026-09-14T11:02:00-05:00', 'expense', 7.96, 'USD', '', 'IZI*NAPOLEON PARIS', '', 'Comidas fuera', ''],
  ['b3', '2026-09-07T17:51:00-05:00', 'expense', 12, 'PEN', '', 'Metropolitano', '', 'Transporte', ''],
  ['c1', '2026-08-20T10:00:00-05:00', 'expense', 120, 'PEN', '', 'WONG', '', 'Supermercado', ''],
  ['d1', '2026-03-10T10:00:00-05:00', 'expense', 999, 'PEN', '', 'FUERA DE VENTANA', '', 'Ocio', '']
];
const COLS = ['id', 'fecha', 'tipo', 'monto', 'moneda', 'tipo_cambio', 'comercio', 'contraparte', 'categoria', 'canal'];

function setup() {
  const h0 = makeHarness();
  const headers = h0.api.LEDGER_HEADERS_.slice();
  const rows = FILAS.map((f) => headers.map((hd) => { const i = COLS.indexOf(hd); return i < 0 ? '' : f[i]; }));
  const h = makeHarness({ spreadsheets: { S: { Movimientos: [headers, ...rows], Ajustes: [['key', 'value'], ['fx.usd_pen', '3.75']] } } });
  return { h, cfg: configFor(h, 'S'), matriz: [headers, ...rows.map((r) => r.map(String))] };
}

test('resumenDashboard: mismas cifras que summarize() de la web (gasto, ingresos, Yape, categorías, 6 meses)', () => {
  const { h, cfg, matriz } = setup();
  const r = plain(h.api.resumenDashboard('S', cfg, { mes: '2026-10', hoy: '2026-10-05' }));
  const web = summarize(rowsToTxs(matriz), { month: '2026-10', usdRate: 3.75 });
  assert.equal(r.resumen.gasto, web.expense);
  assert.equal(r.resumen.ingresos, web.income);
  assert.equal(r.resumen.teQueda, web.net);
  assert.equal(r.resumen.yape, web.receivedYape);
  assert.equal(r.resumen.yapeN, web.receivedYapeCount);
  assert.equal(r.resumen.gastoAnterior, web.prevExpense);
  assert.deepEqual(r.categorias.map((c) => [c.nombre, c.monto, c.pct]), web.byCategory.map((c) => [c.name, c.amount, c.pct]));
  assert.deepEqual(r.porMes.map((m) => [m.mes, m.gasto]), web.last6.map((m) => [m.month, m.expense]));
  assert.deepEqual(r.comercios.map((c) => [c.nombre, c.monto, c.n]), web.topMerchants.map((c) => [c.name, c.amount, c.count]));
  assert.equal(r.resumen.porCategorizar, web.pending.length);
  assert.equal(r.movimientos.length, web.movements.length);
});

test('resumenDashboard: USD con el tipo de cambio del correo o el de Ajustes; transferencias propias y Yape no son gasto', () => {
  const { h, cfg } = setup();
  const r = plain(h.api.resumenDashboard('S', cfg, { mes: '2026-10', hoy: '2026-10-05' }));
  // 53.3 + 1.24×3.4 + 0.96×3.75 + 66.68
  assert.equal(r.resumen.gasto, Math.round((53.3 + 1.24 * 3.4 + 0.96 * 3.75 + 66.68) * 100) / 100);
  const usd = r.movimientos.find((m) => m.etiqueta === 'SPACESHIP.COM* OJF3CV');
  assert.equal(usd.base, Math.round(1.24 * 3.4 * 100) / 100);
  assert.equal(r.movimientos.find((m) => m.tipo === 'internal_transfer').etiqueta, 'Transferencia entre cuentas');
  assert.ok(!r.categorias.some((c) => c.nombre === 'Transferencias'), 'la transferencia propia no aparece en "en qué se fue"');
  assert.equal(r.categorias.find((c) => c.nombre === 'Sin categoría').color, '#cfc6b8');
  assert.equal(r.movimientos[0].fecha, '2026-10-05T00:20:00-05:00', 'más recientes primero');
  assert.equal(r.comercios.find((c) => c.nombre === 'RAPPI SAC').categoria, 'Comidas fuera');
});

test('resumenDashboard: ritmo (día/días, cerrado), delta vs mes anterior, meses con datos y tendencia por categoría', () => {
  const { h, cfg } = setup();
  const oct = plain(h.api.resumenDashboard('S', cfg, { mes: '2026-10', hoy: '2026-10-05' }));
  assert.deepEqual(oct.resumen.ritmo.dia, 5); assert.equal(oct.resumen.ritmo.dias, 31); assert.equal(oct.resumen.ritmo.cerrado, false);
  assert.equal(oct.resumen.delta, Math.round((oct.resumen.gasto - oct.resumen.gastoAnterior) / oct.resumen.gastoAnterior * 100));
  assert.deepEqual(oct.meses.slice(0, 4), ['2026-10', '2026-09', '2026-08', '2026-03']);
  assert.deepEqual(oct.tendencia.meses, ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  const comidas = oct.tendencia.series.find((s) => s.nombre === 'Comidas fuera');
  assert.equal(comidas.valores[5], 66.68);
  assert.equal(comidas.valores[4], Math.round((66.68 + 7.96 * 3.75) * 100) / 100);
  assert.ok(oct.tendencia.series.length <= 6);
  assert.ok(!oct.tendencia.series.some((s) => s.nombre === 'Ocio'), 'marzo queda fuera de la ventana de 6 meses');

  const sep = plain(h.api.resumenDashboard('S', cfg, { mes: '2026-09', hoy: '2026-10-05' }));
  assert.deepEqual([sep.resumen.ritmo.dia, sep.resumen.ritmo.dias, sep.resumen.ritmo.cerrado], [30, 30, true]);
  // Mes inválido → el actual.
  assert.equal(plain(h.api.resumenDashboard('S', cfg, { mes: 'x', hoy: '2026-10-05' })).mes, '2026-10');
});

test('Dashboard: el diálogo pide resumenDashboard (en DISPATCH_), tiene 4 pestañas y escapa lo que viene de la Sheet', () => {
  const html = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', 'DialogDashboard.html'), 'utf8');
  const h = makeHarness();
  for (const fn of [...html.matchAll(/run\('([A-Za-z_]+)'/g)].map((m) => m[1])) assert.ok(h.api.DISPATCH_[fn], 'falta en DISPATCH_: ' + fn);
  assert.match(html, /run\('resumenDashboard', \{ mes: m \}\)/);
  for (const t of ['resumen', 'categorias', 'tendencias', 'movimientos']) assert.match(html, new RegExp('data-tab="' + t + '"'));
  assert.match(html, /esc\(m\.etiqueta\)/);
  assert.match(html, /esc\(c\.nombre\)/);
  assert.doesNotMatch(h.api.buildDialog('dashboard').html.getContent(), /luca-parcial/);
});

test('Iconos de categoría: cada categoría por defecto tiene su SVG propio; las propias se reconocen por palabra clave', async () => {
  const vm = await import('node:vm');
  const ui = fs.readFileSync(path.join(HERE, '..', 'gas', 'shared', '_Ui.html'), 'utf8');
  const script = ui.slice(ui.indexOf('<script>') + 8, ui.lastIndexOf('</script>'));
  const doc = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
  const ctx = vm.createContext({ document: doc, setTimeout, window: {} });
  vm.runInContext(script, ctx);
  const h = makeHarness();
  const defecto = plain(h.api.CATEGORIAS_INICIALES_).map((c) => c[0]);
  const claves = new Set();
  for (const c of defecto) {
    const k = ctx.claveIconoCategoria(c);
    assert.ok(ctx.ICONOS_CAT_[k] || ctx.ICONOS_[k], c + ' → ' + k + ' no existe');
    if (c !== 'Otros') assert.notEqual(k, 'etiqueta', c + ' usa el icono genérico');
    claves.add(k);
  }
  assert.equal(claves.size, defecto.length, 'cada categoría por defecto con un icono distinto');
  for (const [nombre, k] of [['Mascotas', 'huella'], ['Viajes', 'avion'], ['Gimnasio', 'pesa'], ['Cafés', 'cafe'], ['Impuestos SUNAT', 'recibo'], ['', 'duda'], ['Sin categoría', 'duda'], ['Cosas raras', 'etiqueta']]) {
    assert.equal(ctx.claveIconoCategoria(nombre), k, nombre || '(vacía)');
  }
  for (const [cat, tipo, k] of [['', 'internal_transfer', 'flechas'], ['', 'transfer_in', 'recibir'], ['', 'income', 'billetera']]) {
    assert.ok(ctx.iconoCategoria(cat, tipo).includes(ctx.ICONOS_CAT_[k]), tipo);
  }
  for (const k of ctx.ICONO_PALABRAS_.map((x) => x[1])) assert.ok(ctx.ICONOS_CAT_[k] || ctx.ICONOS_[k], 'falta el icono ' + k);
});
