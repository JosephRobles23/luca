/**
 * estilo-hojas-runtime.js — Las pestañas con la marca de Luca (DESIGN.md): encabezado, filas alternas, color de
 * pestaña, formatos numéricos, colores de categoría y columnas técnicas plegadas.
 *
 * Cada pestaña se reconoce por su PRIMER encabezado, no por el nombre (configurable). Se aplica al crear la
 * pestaña (ensureSheet_, ensureKeyValueTab_) y, en las copias existentes, una vez por ESTILO_HOJAS_VERSION_:
 * writeTelemetria_ lo reaplica en la siguiente pasada si `ui.estiloVersion` no coincide. Subir la versión
 * cuando cambie el estilo.
 *
 * Reaplicar pisa anchos de columna, filas alternas y las reglas de formato condicional de las pestañas con
 * colores de categoría (las escribe Luca, no el usuario).
 *
 * Sin import/export: runtime de Apps Script.
 */

var ESTILO_HOJAS_VERSION_ = '1';

var COLORES_HOJA_ = {
  primary: '#d9623b', ink: '#1d1a17', muted: '#716a60', lineStrong: '#d3c8b8',
  canvas: '#f4efe8', card: '#fffdf9', strong: '#ebe4d9'
};

// Pasteles cat-* de DESIGN.md y el mismo reparto que apps/web/src/lib/categorias.ts (fijo + hash del nombre).
var CAT_PALETA_ = ['#dfa88f', '#9fc9a2', '#9fbbe0', '#c0a8dd', '#c08532', '#e3a3b4', '#d8c08f', '#8ec5c0'];
var CAT_NINGUNA_ = '#cfc6b8';
var CAT_FIJAS_ = {
  Vivienda: 6, Supermercado: 1, 'Comidas fuera': 0, Transporte: 7, Servicios: 4, Suscripciones: 3, Salud: 5,
  'Educación': 2, Ropa: 5, Ocio: 0, Transferencias: 2, 'Retiro de Agente': 4, Otros: 6, Ingreso: 1
};

function colorCategoria_(categoria) {
  if (!categoria || categoria === 'Sin categoría') return CAT_NINGUNA_;
  if (CAT_FIJAS_.hasOwnProperty(categoria)) return CAT_PALETA_[CAT_FIJAS_[categoria]];
  var h = 0;
  for (var i = 0; i < categoria.length; i++) h = (h * 31 + categoria.charCodeAt(i)) | 0;
  return CAT_PALETA_[Math.abs(h) % CAT_PALETA_.length];
}

/**
 * Perfil por primer encabezado. pestana: color de la pestaña · anchos: px por encabezado · mono: Geist Mono ·
 * montos/cambio: formato numérico · categoria: columna pintada con su pastel · propias: atenuar
 * `internal_transfer` · tenues: texto muted · recortar: sin desbordar · tecnicas: columnas plegadas.
 */
var PERFILES_HOJA_ = {
  id: { // Movimientos
    pestana: 'primary',
    anchos: { fecha: 150, tipo: 120, monto: 96, moneda: 64, tipo_cambio: 88, comercio: 220, contraparte: 180, categoria: 140, medio: 130, canal: 80, fuente: 100 },
    mono: ['fecha', 'monto', 'tipo_cambio'], montos: ['monto'], cambio: ['tipo_cambio'],
    categoria: 'categoria', propias: true,
    tecnicas: ['id', 'contraparte_key', 'categoria_origen', 'operacion', 'gmail_id', 'flags', 'asunto', 'creado_en']
  },
  gmail_id: { // _Procesados
    pestana: 'lineStrong',
    anchos: { gmail_id: 170, resultado: 120, tipo: 120, fecha: 150, asunto: 320, remitente: 240 },
    mono: ['gmail_id', 'fecha'], tenues: ['gmail_id'], recortar: ['asunto']
  },
  clave: { // Comercios
    pestana: 'lineStrong',
    anchos: { clave: 200, nombre: 220, categoria: 140, categoria_origen: 110, veces: 70, actualizado_en: 170 },
    mono: ['veces', 'actualizado_en'], categoria: 'categoria', tenues: ['clave']
  },
  categoria: { // Categorías
    pestana: 'lineStrong', anchos: { categoria: 160, tipo: 100, descripcion: 420 }, categoria: 'categoria'
  },
  key: { // Ajustes
    pestana: 'lineStrong', anchos: { key: 260, value: 360 }, mono: ['key'], tenues: ['key'], recortar: ['value']
  }
};

function perfilDeHoja_(sh) {
  if (sh.getLastColumn() < 1) return null;
  var a1 = String(sh.getRange(1, 1).getValue()).trim();
  return PERFILES_HOJA_.hasOwnProperty(a1) ? PERFILES_HOJA_[a1] : null;
}

function columnas_(map, encabezados) {
  return (encabezados || []).map(function (h) { return map[h]; }).filter(Boolean);
}

/** 1 → A, 27 → AA. */
function letraColumna_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Columnas sueltas → tramos contiguos [inicio, largo]. */
function tramos_(cols) {
  var orden = cols.slice().sort(function (a, b) { return a - b; });
  var out = [];
  orden.forEach(function (c) {
    var u = out[out.length - 1];
    if (u && c === u[0] + u[1]) u[1]++;
    else if (!u || c > u[0] + u[1]) out.push([c, 1]); // repetidas: ya cubiertas
  });
  return out;
}

/** Agrupa y pliega las columnas técnicas. Un tramo ya agrupado se respeta (el usuario pudo desplegarlo). */
function plegarColumnas_(sh, cols) {
  tramos_(cols).forEach(function (t) {
    if (sh.getColumnGroupDepth(t[0]) > 0) return;
    sh.getRange(1, t[0], 1, t[1]).shiftColumnGroupDepth(1);
    sh.getColumnGroup(t[0], 1).collapse();
  });
}

/** Aplica el perfil a una pestaña. `categorias`: nombres a colorear (fijos + los de la pestaña Categorías). */
function estilizarHoja_(sh, perfil, categorias) {
  var C = COLORES_HOJA_;
  var ncol = sh.getLastColumn();
  var nfil = Math.max(sh.getMaxRows(), 2);
  var map = getHeaderMap_(sh);
  var todo = sh.getRange(1, 1, nfil, ncol);
  var datos = sh.getRange(2, 1, nfil - 1, ncol);
  function col(c) { return sh.getRange(2, c, nfil - 1, 1); }

  todo.setFontFamily('Geist').setFontColor(C.ink).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, ncol).setBackground(C.strong).setFontWeight('bold')
    .setBorder(null, null, true, null, null, null, C.lineStrong, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1);
  sh.setHiddenGridlines(true);
  sh.setTabColor(C[perfil.pestana]);

  sh.getBandings().forEach(function (b) { b.remove(); });
  todo.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(C.strong).setFirstRowColor(C.card).setSecondRowColor(C.canvas);

  Object.keys(perfil.anchos || {}).forEach(function (h) { if (map[h]) sh.setColumnWidth(map[h], perfil.anchos[h]); });
  columnas_(map, perfil.mono).forEach(function (c) { col(c).setFontFamily('Geist Mono'); });
  columnas_(map, perfil.montos).forEach(function (c) { col(c).setNumberFormat('#,##0.00').setHorizontalAlignment('right'); });
  columnas_(map, perfil.cambio).forEach(function (c) { col(c).setNumberFormat('0.000').setHorizontalAlignment('right'); });
  columnas_(map, perfil.tenues).forEach(function (c) { col(c).setFontColor(C.muted); });
  columnas_(map, perfil.recortar).forEach(function (c) { col(c).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP); });

  if (perfil.categoria && map[perfil.categoria]) {
    // Primero las categorías: en Sheets gana la primera regla verdadera, así la celda de categoría conserva
    // su pastel aunque la fila sea una transferencia propia atenuada.
    var rangoCat = col(map[perfil.categoria]);
    var reglas = categorias.map(function (cat) {
      return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(cat)
        .setBackground(colorCategoria_(cat)).setFontColor(C.ink).setRanges([rangoCat]).build();
    });
    if (perfil.propias && map.tipo) {
      reglas.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=$' + letraColumna_(map.tipo) + '2="internal_transfer"')
        .setFontColor(C.muted).setRanges([datos]).build());
    }
    sh.setConditionalFormatRules(reglas);
  }

  if (perfil.tecnicas) plegarColumnas_(sh, columnas_(map, perfil.tecnicas));
}

/** Nombres a colorear: los fijos de la web + los que el usuario tenga en la pestaña Categorías. */
function categoriasParaEstilo_(hojas) {
  var set = {};
  Object.keys(CAT_FIJAS_).forEach(function (c) { set[c] = true; });
  hojas.forEach(function (sh) {
    if (perfilDeHoja_(sh) !== PERFILES_HOJA_.categoria || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var c = String(r[0]).trim();
      if (c) set[c] = true;
    });
  });
  return Object.keys(set);
}

/** Estiliza todas las pestañas reconocidas y anota la versión en Ajustes. Público (menú/sidebar/tests). */
function aplicarEstiloHojas(sheetId, config) {
  var hojas = getSpreadsheet_(sheetId).getSheets();
  var categorias = categoriasParaEstilo_(hojas);
  var hechas = [];
  hojas.forEach(function (sh) {
    var perfil = perfilDeHoja_(sh);
    if (!perfil) return;
    estilizarHoja_(sh, perfil, categorias);
    hechas.push(sh.getName());
  });
  setAjustes_(sheetId, config, { 'ui.estiloVersion': ESTILO_HOJAS_VERSION_ });
  return { version: ESTILO_HOJAS_VERSION_, hojas: hechas };
}

/** Lo llama writeTelemetria_ en cada pasada: solo trabaja si la copia tiene una versión de estilo anterior. */
function aplicarEstiloSiCorresponde_(sheetId, config) {
  if (((config && config.ajustes) || {})['ui.estiloVersion'] === ESTILO_HOJAS_VERSION_) return null;
  return aplicarEstiloHojas(sheetId, config);
}

/** Pestaña recién creada (ensureSheet_, ensureKeyValueTab_). Nunca lanza: el estilo no rompe un escaneo. */
function estilizarNueva_(sh) {
  try {
    var perfil = perfilDeHoja_(sh);
    if (perfil) estilizarHoja_(sh, perfil, Object.keys(CAT_FIJAS_));
  } catch (e) { Logger.log('estilizarNueva_: ' + (e && e.message || e)); }
}
