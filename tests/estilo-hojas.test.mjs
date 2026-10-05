/**
 * Estilo de las pestañas (estilo-hojas-runtime.js): encabezado y filas alternas con la marca, color de pestaña,
 * formatos, colores de categoría idénticos a la web, columnas técnicas plegadas y reaplicación por versión.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHarness, configFor } from './gas-harness.mjs';
import { CAT_PALETTE, catVar } from '../apps/web/src/lib/categorias.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function hoja(api) {
  return { Movimientos: [api.LEDGER_HEADERS_.slice(), ['bcp:1', '2026-10-04T10:00:00-05:00', 'expense', 12.5, 'PEN']] };
}

function setup() {
  const h0 = makeHarness();
  const tabs = hoja(h0.api);
  tabs['Categorías'] = [['categoria', 'tipo', 'descripcion'], ['Mascotas', 'gasto', ''], ['Comidas fuera', 'gasto', '']];
  tabs['Ajustes'] = [['key', 'value']];
  tabs['Notas'] = [['lo que quiera el usuario']];
  const h = makeHarness({ spreadsheets: { S: tabs } });
  return { h, cfg: configFor(h, 'S') };
}

test('aplicarEstiloHojas: Movimientos con encabezado, filas alternas, pestaña naranja y formatos', () => {
  const { h, cfg } = setup();
  const r = JSON.parse(JSON.stringify(h.api.aplicarEstiloHojas('S', cfg)));
  assert.deepEqual(r.hojas.sort(), ['Ajustes', 'Categorías', 'Movimientos']);

  const mov = h.getSpreadsheet('S').getSheetByName('Movimientos');
  const est = mov._estilo;
  const map = h.api.getHeaderMap_(mov);
  assert.equal(est.tabColor, '#d9623b');
  assert.equal(est.frozenRows, 1);
  assert.equal(est.hiddenGridlines, true);
  assert.equal(est.rowHeights[1], 32);
  const enc = est.ops.filter((o) => o.row === 1 && o.nr === 1);
  assert.ok(enc.some((o) => o.op === 'background' && o.arg === '#ebe4d9'), 'encabezado en strong');
  assert.ok(enc.some((o) => o.op === 'fontWeight' && o.arg === 'bold'));
  assert.equal(est.bandings.length, 1);
  assert.deepEqual(est.bandings[0].colors, { header: '#ebe4d9', first: '#fffdf9', second: '#f4efe8' });
  assert.equal(est.widths[map.comercio], 220);
  const fmt = (c) => est.ops.filter((o) => o.col === c && o.nc === 1 && o.op === 'numberFormat').map((o) => o.arg);
  assert.deepEqual(fmt(map.monto), ['#,##0.00']);
  assert.deepEqual(fmt(map.tipo_cambio), ['0.000']);
  assert.ok(est.ops.some((o) => o.col === map.monto && o.op === 'fontFamily' && o.arg === 'Geist Mono'));

  // Pestañas no reconocidas no se tocan.
  assert.equal(h.getSpreadsheet('S').getSheetByName('Notas')._estilo.ops.length, 0);
  assert.equal(h.getSpreadsheet('S').getSheetByName('Ajustes')._estilo.tabColor, '#d3c8b8');
});

test('aplicarEstiloHojas: categorías con el pastel de la web (fijas + personalizadas) y transferencias propias atenuadas', () => {
  const { h, cfg } = setup();
  h.api.aplicarEstiloHojas('S', cfg);
  const mov = h.getSpreadsheet('S').getSheetByName('Movimientos');
  const map = h.api.getHeaderMap_(mov);
  const rules = mov._estilo.rules;
  const porTexto = Object.fromEntries(rules.filter((r) => r.text).map((r) => [r.text, r.background]));
  assert.equal(porTexto['Comidas fuera'], '#dfa88f');
  assert.ok(porTexto['Mascotas'], 'la categoría personalizada de la pestaña Categorías también se colorea');
  // La regla de atenuado va al final (en Sheets gana la primera regla verdadera).
  const ultima = rules[rules.length - 1];
  assert.equal(ultima.formula, '=$' + h.api.letraColumna_(map.tipo) + '2="internal_transfer"');
  assert.equal(ultima.fontColor, '#716a60');
});

test('colorCategoria_ coincide con catVar de la web para fijas, personalizadas y "Sin categoría"', () => {
  const h = makeHarness();
  const css = fs.readFileSync(path.join(HERE, '..', 'apps', 'web', 'src', 'app', 'globals.css'), 'utf8');
  const hex = (v) => css.match(new RegExp(v + ':\\s*(#[0-9a-f]{6})', 'i'))[1].toLowerCase();
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.CAT_PALETA_)), CAT_PALETTE.map(hex));
  for (const c of ['Vivienda', 'Comidas fuera', 'Transferencias', 'Ingreso', 'Mascotas', 'Viajes', 'Regalos 🎁', '', 'Sin categoría']) {
    assert.equal(h.api.colorCategoria_(c), hex(catVar(c)), c || '(vacía)');
  }
});

test('columnas técnicas: se agrupan por tramos contiguos y se pliegan una sola vez', () => {
  const { h, cfg } = setup();
  h.api.aplicarEstiloHojas('S', cfg);
  const mov = h.getSpreadsheet('S').getSheetByName('Movimientos');
  const map = h.api.getHeaderMap_(mov);
  const est = mov._estilo;
  for (const c of ['id', 'contraparte_key', 'gmail_id', 'creado_en']) assert.equal(est.groups[map[c]], 1, c);
  for (const c of ['fecha', 'monto', 'comercio', 'categoria']) assert.equal(est.groups[map[c]] || 0, 0, c);
  const plegadas = est.collapsed.length;
  // Reaplicar no profundiza los grupos ni re-pliega (el usuario pudo desplegarlos) y no duplica filas alternas.
  h.api.aplicarEstiloHojas('S', cfg);
  assert.equal(est.groups[map.gmail_id], 1);
  assert.equal(est.collapsed.length, plegadas);
  assert.equal(est.bandings.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.tramos_([16, 1, 9, 15, 17, 9]))), [[1, 1], [9, 1], [15, 3]]);
});

test('copias existentes: writeTelemetria_ aplica el estilo una vez por versión (ui.estiloVersion)', () => {
  const { h } = setup();
  h.api.writeTelemetria_('S', configFor(h, 'S'), { added: 0 });
  const kv = () => Object.fromEntries(h.tab('S', 'Ajustes').slice(1));
  assert.equal(kv()['ui.estiloVersion'], h.api.ESTILO_HOJAS_VERSION_);
  const est = h.getSpreadsheet('S').getSheetByName('Movimientos')._estilo;
  const ops = est.ops.length;
  assert.ok(ops > 0);
  h.api.writeTelemetria_('S', configFor(h, 'S'), { added: 1 });
  assert.equal(est.ops.length, ops, 'con la versión al día no vuelve a estilizar');
});

test('pestaña nueva: ensureSheet_ la crea ya estilizada; menú 🎨 reaplica y avisa con un toast', () => {
  const h = makeHarness({ spreadsheets: { S: {} } });
  const cfg = configFor(h, 'S');
  h.api.ledgerSheet_('S', cfg);
  assert.equal(h.getSpreadsheet('S').getSheetByName('Movimientos')._estilo.tabColor, '#d9623b');
  assert.equal(h.getSpreadsheet('S').getSheetByName('Ajustes')._estilo.tabColor, '#d3c8b8');
  h.api.menuAction('lucaMenu3', 'S', cfg);
  assert.match(h.toasts[0][0], /Estilo aplicado a: .*Movimientos/);
  assert.ok(h.api.DISPATCH_.aplicarEstiloHojas);
});
