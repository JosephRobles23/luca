/**
 * categorize-runtime.js — Categorización de movimientos (ADR-004) y pestañas `Categorías` / `Comercios`.
 *
 * Orden de resolución por movimiento: (1) corrección del usuario en `Comercios` (`categoria_origen=user`,
 * gana siempre) → (2) reglas deterministas → (3) caché `Comercios` → (4) LLM solo si hay API key y solo
 * con comercio + monto + moneda (hook `categorizeWithLlm_`, en M1 devuelve null) → (5) '' = por categorizar.
 *
 * `Comercios` es la memoria: una fila por clave de comercio/contraparte con la categoría aprendida y
 * cuántas veces se vio. Todo vive en el Sheet del usuario; nada en Script Properties.
 *
 * Sin import/export: runtime de Apps Script.
 */

var CATEGORIAS_HEADERS_ = ['categoria', 'tipo', 'descripcion'];
var MERCHANTS_HEADERS_ = ['clave', 'nombre', 'categoria', 'categoria_origen', 'veces', 'actualizado_en'];

/** Taxonomía inicial editable (ADR-004 §5). */
var CATEGORIAS_INICIALES_ = [
  ['Vivienda', 'gasto', 'Alquiler, condominio, mantenimiento'],
  ['Supermercado', 'gasto', 'Compras del hogar'],
  ['Comidas fuera', 'gasto', 'Restaurantes, delivery, cafés'],
  ['Transporte', 'gasto', 'Taxi, Metropolitano, combustible'],
  ['Servicios', 'gasto', 'Luz, agua, internet, celular, recargas'],
  ['Suscripciones', 'gasto', 'Streaming, software, membresías'],
  ['Salud', 'gasto', 'Farmacia, consultas, seguros'],
  ['Educación', 'gasto', 'Universidad, cursos, libros'],
  ['Ropa', 'gasto', 'Ropa y calzado'],
  ['Ocio', 'gasto', 'Cine, salidas, viajes'],
  ['Transferencias', 'gasto', 'Yapeos a personas y movimientos entre cuentas propias'],
  ['Otros', 'gasto', 'Lo que no encaja en otra'],
  ['Ingreso', 'ingreso', 'Sueldo, abonos']
];

/**
 * Reglas deterministas (ADR-004 §1.2). Se evalúan en orden sobre `comercio` normalizado (minúsculas,
 * sin acentos), `canal` y `tipo`. La primera que coincide gana.
 */
var REGLAS_CATEGORIA_ = [
  { re: /metropolitano|corredor|linea 1|metro de lima|uber|cabify|indrive|didi|beat\b|taxi|petroperu|primax|repsol|grifo/, categoria: 'Transporte' },
  { re: /spotify|netflix|disney|hbo|\bmax\b|prime video|amazon prime|youtube|apple\.com\/bill|itunes|google \*|google one|icloud|openai|chatgpt|anthropic|claude\.ai|github|amazon web services|aws emea|microsoft\*|office 365|canva|notion/, categoria: 'Suscripciones' },
  { re: /inkafarma|mifarma|boticas|farmacia|botica|clinica|clínica|hospital|laboratorio|dentista|optica/, categoria: 'Salud' },
  { re: /universidad|colegio|instituto|academia|udemy|coursera|platzi|crehana/, categoria: 'Educación' },
  { re: /plaza vea|tottus|wong|vivanda|metro\b|makro|tambo|oxxo|mass\b|flora y fauna|listo\b/, categoria: 'Supermercado' },
  { re: /rappi|pedidosya|didi food|restaurante|pizza|burger|chifa|polleria|pollería|starbucks|kfc|mcdonald|bembos|cafe\b|café/, categoria: 'Comidas fuera' },
  { re: /luz del sur|enel|pluz|sedapal|calidda|movistar|claro|entel|bitel|win\b|america movil|telefonica/, categoria: 'Servicios' },
  { re: /zara|h&m|saga|falabella|ripley|oechsle|adidas|nike|marathon/, categoria: 'Ropa' },
  { re: /cineplanet|cinemark|cine\b|teleticket|joinnus|steam|playstation|nintendo|xbox/, categoria: 'Ocio' },
  { canal: 'yape_topup', categoria: 'Servicios' },
  { canal: 'yape_service', categoria: 'Servicios' },
  { tipo: 'internal_transfer', categoria: 'Transferencias' }
];

// --- Pestañas ---

function categoriasSheet_(sheetId, config) {
  var name = (config.sheets && config.sheets.categories) || 'Categorías';
  var ss = getSpreadsheet_(sheetId);
  var existed = !!ss.getSheetByName(name);
  var sh = ensureSheet_(sheetId, name, CATEGORIAS_HEADERS_);
  if (!existed || sh.getLastRow() < 2) {
    appendRows_(sh, CATEGORIAS_INICIALES_.map(function (c) { return { categoria: c[0], tipo: c[1], descripcion: c[2] }; }));
  }
  return sh;
}

function merchantsSheet_(sheetId, config) { return ensureSheet_(sheetId, config.sheets.merchants, MERCHANTS_HEADERS_); }

/** Crea `Categorías` y `Comercios` si no existen (se llama en el primer escaneo). */
function ensureCategorizacion_(sheetId, config) {
  categoriasSheet_(sheetId, config);
  merchantsSheet_(sheetId, config);
}

/** Lista de categorías vigentes (para la UI). */
function listarCategorias(sheetId, config) {
  return readRows_(categoriasSheet_(sheetId, config)).map(function (r) { return str_(r.categoria); }).filter(Boolean);
}

// --- Clave de comercio ---

/** Clave de caché: comercio normalizado (negocio) o `contraparte_key` (persona). '' si no hay con qué. */
function merchantKey_(tx) {
  var m = normalizeMerchant(tx.merchant || tx.comercio || '');
  if (m) return fold_(m).replace(/\s+/g, ' ').trim();
  var ck = str_(tx.counterparty_key || tx.contraparte_key);
  return ck ? 'p2p:' + ck : '';
}

/** Nombre legible para la fila de `Comercios`. */
function merchantLabel_(tx) {
  return normalizeMerchant(tx.merchant || tx.comercio || '') || str_(tx.counterparty_name || tx.contraparte);
}

// --- Contexto por pasada ---

/**
 * Carga `Comercios` una vez por pasada. ctx = { merchants: {clave→fila}, dirty: {clave→true}, llmKey }.
 * Las filas se modifican en memoria y se vuelcan con flushMerchants_.
 */
function categorizeContext_(sheetId, config) {
  var sh = merchantsSheet_(sheetId, config);
  var merchants = {};
  readRows_(sh).forEach(function (r, i) {
    var k = str_(r.clave).trim();
    if (!k) return;
    merchants[k] = { row: i + 2, clave: k, nombre: str_(r.nombre), categoria: str_(r.categoria), categoria_origen: str_(r.categoria_origen), veces: int_(r.veces, 0), actualizado_en: str_(r.actualizado_en) };
  });
  return { sheetId: sheetId, config: config, merchants: merchants, dirty: {}, nuevos: [], llmKey: getSecret_('llmKey') };
}

function reglaCategoria_(tx) {
  var m = fold_(normalizeMerchant(tx.merchant || tx.comercio || ''));
  var canal = str_(tx.channel || tx.canal), tipo = str_(tx.kind || tx.tipo);
  for (var i = 0; i < REGLAS_CATEGORIA_.length; i++) {
    var r = REGLAS_CATEGORIA_[i];
    if (r.re && m && r.re.test(m)) return r.categoria;
    if (r.canal && r.canal === canal) return r.categoria;
    if (r.tipo && r.tipo === tipo) return r.categoria;
  }
  return '';
}

/**
 * Hook LLM (ADR-004 §1.4). En M1 no llama a ningún proveedor: devuelve null si no hay key o si el
 * adapter `callLLM_` aún no existe. Solo recibiría { comercio, monto, moneda }.
 */
function categorizeWithLlm_(tx, ctx) {
  if (!ctx || !ctx.llmKey) return null;
  if (typeof callLLM_ !== 'function') return null;
  return null;
}

/**
 * Resuelve la categoría de `tx` (muta `category`/`category_source`) y registra el comercio en el ctx.
 * @return {{categoria:string, origen:string}}
 */
function categorize_(tx, ctx) {
  var key = merchantKey_(tx);
  var cached = key ? ctx.merchants[key] : null;
  var categoria = '', origen = '';
  if (cached && cached.categoria && cached.categoria_origen === 'user') { categoria = cached.categoria; origen = 'user'; }
  if (!categoria) { categoria = reglaCategoria_(tx); if (categoria) origen = 'rule'; }
  if (!categoria && cached && cached.categoria) { categoria = cached.categoria; origen = 'cache'; }
  if (!categoria && key) {
    var llm = categorizeWithLlm_(tx, ctx);
    if (llm && llm.categoria) { categoria = llm.categoria; origen = 'llm'; }
  }
  tx.category = categoria;
  tx.category_source = origen;
  if (key) touchMerchant_(ctx, key, merchantLabel_(tx), categoria, origen);
  return { categoria: categoria, origen: origen };
}

/** Suma una vista al comercio y aprende la categoría si la fila no tenía (nunca pisa `user`). */
function touchMerchant_(ctx, key, nombre, categoria, origen) {
  var m = ctx.merchants[key];
  var ahora = new Date().toISOString();
  if (!m) {
    m = { row: 0, clave: key, nombre: nombre, categoria: categoria, categoria_origen: categoria ? origen : '', veces: 0, actualizado_en: ahora };
    ctx.merchants[key] = m;
    ctx.nuevos.push(key);
  }
  m.veces++;
  m.actualizado_en = ahora;
  if (!m.nombre && nombre) m.nombre = nombre;
  if (categoria && m.categoria_origen !== 'user' && (!m.categoria || origen === 'user')) { m.categoria = categoria; m.categoria_origen = origen; }
  ctx.dirty[key] = true;
}

/** Vuelca al Sheet las filas de `Comercios` tocadas en el ctx. */
function flushMerchants_(ctx) {
  var keys = Object.keys(ctx.dirty);
  if (!keys.length) return 0;
  var sh = merchantsSheet_(ctx.sheetId, ctx.config);
  var map = getHeaderMap_(sh);
  var nuevos = [];
  keys.forEach(function (k) {
    var m = ctx.merchants[k];
    var vals = { clave: m.clave, nombre: m.nombre, categoria: m.categoria, categoria_origen: m.categoria_origen, veces: m.veces, actualizado_en: m.actualizado_en };
    if (!m.row) { nuevos.push(vals); return; }
    Object.keys(vals).forEach(function (h) { if (map[h]) sh.getRange(m.row, map[h]).setValue(vals[h]); });
  });
  if (nuevos.length) {
    var first = sh.getLastRow() + 1;
    appendRows_(sh, nuevos);
    nuevos.forEach(function (v, i) { ctx.merchants[v.clave].row = first + i; });
  }
  ctx.dirty = {};
  ctx.nuevos = [];
  return keys.length;
}

// --- Corrección del usuario ---

/**
 * recategorizar(sheetId, config, { id, categoria }) — corrección manual desde el sidebar/web.
 * Fija `categoria_origen=user` en esa fila, aprende el comercio en `Comercios` (origen user) y
 * recategoriza los movimientos previos del mismo comercio que no tengan origen `user` (quedan `cache`).
 * @return {{id:string, categoria:string, clave:string, actualizados:number}}
 */
function recategorizar(sheetId, config, args) {
  args = args || {};
  var id = str_(args.id).trim(), categoria = str_(args.categoria).trim();
  if (!id) throw new Error('recategorizar: falta id.');
  var sh = ledgerSheet_(sheetId, config);
  var map = getHeaderMap_(sh);
  var rows = readRows_(sh);
  var target = null, targetRow = 0;
  rows.forEach(function (r, i) { if (!target && str_(r.id) === id) { target = r; targetRow = i + 2; } });
  if (!target) throw new Error('recategorizar: no existe el movimiento ' + id);

  function setCat(row, cat, origen) {
    sh.getRange(row, map['categoria']).setValue(cat);
    sh.getRange(row, map['categoria_origen']).setValue(origen);
  }
  setCat(targetRow, categoria, 'user');

  var key = merchantKey_(target);
  var actualizados = 0;
  if (key) {
    var ctx = categorizeContext_(sheetId, config);
    var m = ctx.merchants[key];
    if (!m) { touchMerchant_(ctx, key, merchantLabel_(target), categoria, 'user'); ctx.merchants[key].veces = 0; }
    m = ctx.merchants[key];
    m.categoria = categoria; m.categoria_origen = categoria ? 'user' : ''; m.actualizado_en = new Date().toISOString();
    ctx.dirty[key] = true;
    flushMerchants_(ctx);
    rows.forEach(function (r, i) {
      if (i + 2 === targetRow || merchantKey_(r) !== key || str_(r.categoria_origen) === 'user') return;
      setCat(i + 2, categoria, 'cache');
      actualizados++;
    });
  }
  return { id: id, categoria: categoria, clave: key, actualizados: actualizados };
}
