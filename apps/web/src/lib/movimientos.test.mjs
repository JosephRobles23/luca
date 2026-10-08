// Tests de la lógica de Movimientos y Agregar: filtros ↔ URL, contadores por tipo, chips activos y monto manual.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFilters, filtersToQuery, hasFilters, moreFiltersCount, applyFilters, countByTipo, expenseTotal, countLabel,
  activeFilterChips, monthsOf, fuentesOf, canMarkTransfer, parseAmount, sanitizeAmountInput, quickDates, firstError, EMPTY_FILTERS,
  sortTxs, filterTotals, barsMonth, dailyBars, highlightParts, toCsv,
} from "./movimientos.ts";

const tx = (o) => ({ id: "x", fecha: "2026-10-04T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "PEN", tipoCambio: null, comercio: "", contraparte: "", contraparteKey: "", categoria: "", categoriaOrigen: "", medio: "", canal: "", fuente: "bcp_email", operacion: "", gmailId: "", flags: [], asunto: "", creadoEn: "", ...o });
const plain = (x) => JSON.parse(JSON.stringify(x));

const TXS = [
  tx({ id: "a", fecha: "2026-10-04T09:00:00-05:00", comercio: "PLAZA VEA", categoria: "Supermercado" }),
  tx({ id: "b", fecha: "2026-10-03T09:00:00-05:00", comercio: "UDEMY", moneda: "USD", monto: 10 }),
  tx({ id: "c", fecha: "2026-10-05T09:00:00-05:00", tipo: "transfer_in", contraparte: "Ana", fuente: "yape_email" }),
  tx({ id: "d", fecha: "2026-09-20T09:00:00-05:00", tipo: "income", categoria: "Ingreso", monto: 100 }),
  tx({ id: "e", fecha: "2026-09-21T09:00:00-05:00", tipo: "internal_transfer", monto: 30 }),
];

test("parseFilters / filtersToQuery: ida y vuelta, solo claves conocidas y no vacías", () => {
  const f = parseFilters(new URLSearchParams("q=plaza vea&tipo=expense&otro=1&mes="));
  assert.deepEqual(plain(f), { tipo: "expense", fuente: "", categoria: "", q: "plaza vea", mes: "" });
  assert.equal(filtersToQuery(f), "tipo=expense&q=plaza+vea");
  assert.equal(filtersToQuery(EMPTY_FILTERS), "");
  assert.equal(hasFilters(EMPTY_FILTERS), false);
  assert.equal(hasFilters(f), true);
  assert.equal(moreFiltersCount({ ...f, mes: "2026-10", categoria: "__pending__" }), 2);
});

test("applyFilters: mes + tipo + texto, ordenado del más reciente", () => {
  assert.deepEqual(applyFilters(TXS, EMPTY_FILTERS).map((t) => t.id), ["c", "a", "b", "e", "d"]);
  assert.deepEqual(applyFilters(TXS, { ...EMPTY_FILTERS, mes: "2026-10" }).map((t) => t.id), ["c", "a", "b"]);
  assert.deepEqual(applyFilters(TXS, { ...EMPTY_FILTERS, categoria: "__pending__", tipo: "expense" }).map((t) => t.id), ["b"]);
  assert.deepEqual(applyFilters(TXS, { ...EMPTY_FILTERS, q: "plaza" }).map((t) => t.id), ["a"]);
});

test("countByTipo: ignora el tipo elegido pero respeta los demás filtros", () => {
  assert.deepEqual(plain(countByTipo(TXS, { ...EMPTY_FILTERS, tipo: "income" })), { "": 5, expense: 2, income: 1, transfer_in: 1, internal_transfer: 1 });
  assert.deepEqual(plain(countByTipo(TXS, { ...EMPTY_FILTERS, mes: "2026-10" })), { "": 3, expense: 2, income: 0, transfer_in: 1, internal_transfer: 0 });
});

test("expenseTotal y countLabel", () => {
  assert.equal(expenseTotal(TXS, 3.8), 48); // 10 + 10·3.8; ingresos y transferencias no suman
  assert.equal(countLabel(1), "1 movimiento");
  assert.equal(countLabel(0), "0 movimientos");
});

test("activeFilterChips: etiquetas legibles por filtro", () => {
  const chips = activeFilterChips({ tipo: "transfer_in", fuente: "yape_email", categoria: "__pending__", q: " plaza ", mes: "2026-10" }, { yape_email: "Yape email" });
  assert.deepEqual(plain(chips), [
    { key: "q", label: "“plaza”" }, { key: "tipo", label: "Recibido por Yape" }, { key: "mes", label: "Oct 2026" },
    { key: "fuente", label: "Yape email" }, { key: "categoria", label: "Por categorizar" },
  ]);
  assert.deepEqual(activeFilterChips(EMPTY_FILTERS), []);
});

test("monthsOf / fuentesOf", () => {
  assert.deepEqual(monthsOf(TXS), ["2026-10", "2026-09"]);
  assert.deepEqual(fuentesOf(TXS), ["bcp_email", "yape_email"]);
});

test("canMarkTransfer: solo gastos; no un yapeo ya en Transferencias", () => {
  assert.equal(canMarkTransfer(tx({}), { kind: "internal" }), true);
  assert.equal(canMarkTransfer(tx({ categoria: "Transferencias" }), { kind: "category" }), false);
  assert.equal(canMarkTransfer(tx({ categoria: "Transferencias" }), { kind: "internal" }), true);
  assert.equal(canMarkTransfer(tx({ tipo: "income" }), { kind: "internal" }), false);
});

test("parseAmount: coma o punto decimal, miles, inválidos → NaN", () => {
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("12.50"), 12.5);
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount(" S/ 8 "), 8);
  assert.ok(Number.isNaN(parseAmount("")));
  assert.ok(Number.isNaN(parseAmount("abc")));
  assert.ok(Number.isNaN(parseAmount("1.2.3")));
});

test("sanitizeAmountInput: solo dígitos y separadores, 2 decimales", () => {
  assert.equal(sanitizeAmountInput("12,509"), "12,50");
  assert.equal(sanitizeAmountInput("S/ 7a.5"), "7.5");
  assert.equal(sanitizeAmountInput("100"), "100");
});

test("quickDates y firstError", () => {
  assert.deepEqual(plain(quickDates("2026-10-01")), { hoy: "2026-10-01", ayer: "2026-09-30" });
  assert.equal(firstError({ comercio: "x", monto: "y" }), "monto");
  assert.equal(firstError({}), null);
});

test("sortTxs: recientes primero o mayor monto en soles (USD convertido); no muta la lista", () => {
  const a = tx({ id: "a", fecha: "2026-10-01T10:00:00-05:00", monto: 50 });
  const b = tx({ id: "b", fecha: "2026-10-03T10:00:00-05:00", monto: 20, moneda: "USD", tipoCambio: 3.7 });
  const c = tx({ id: "c", fecha: "2026-10-02T10:00:00-05:00", monto: 90 });
  const list = [a, b, c];
  assert.deepEqual(sortTxs(list, "fecha", 3.5).map((t) => t.id), ["b", "c", "a"]);
  assert.deepEqual(sortTxs(list, "monto", 3.5).map((t) => t.id), ["c", "b", "a"]);
  assert.deepEqual(list.map((t) => t.id), ["a", "b", "c"]);
});

test("filterTotals: gastos, ingresos y Yape aparte; entre cuentas no suma", () => {
  const t = filterTotals([
    tx({ monto: 10 }), tx({ monto: 5, moneda: "USD", tipoCambio: 4 }), tx({ tipo: "income", monto: 100 }),
    tx({ tipo: "transfer_in", monto: 30 }), tx({ tipo: "internal_transfer", monto: 500 }),
  ], 3.5);
  assert.deepEqual(plain(t), { expense: 30, expenseCount: 2, income: 100, incomeCount: 1, yape: 30, yapeCount: 1 });
});

test("barsMonth y dailyBars: mes filtrado u hoy; sin Vivienda; días futuros marcados", () => {
  assert.equal(barsMonth({ ...EMPTY_FILTERS, mes: "2026-09" }, "2026-10-08"), "2026-09");
  assert.equal(barsMonth(EMPTY_FILTERS, "2026-10-08"), "2026-10");
  const bars = dailyBars([
    tx({ fecha: "2026-10-01T09:00:00-05:00", monto: 1300, categoria: "Vivienda" }),
    tx({ fecha: "2026-10-02T09:00:00-05:00", monto: 12.5 }), tx({ fecha: "2026-10-02T19:00:00-05:00", monto: 7.5 }),
    tx({ fecha: "2026-10-03T09:00:00-05:00", tipo: "income", monto: 99 }), tx({ fecha: "2026-09-02T09:00:00-05:00", monto: 40 }),
  ], "2026-10", "2026-10-08", 3.5);
  assert.equal(bars.length, 31);
  assert.equal(bars[0].amount, 0);
  assert.equal(bars[1].amount, 20);
  assert.equal(bars[2].amount, 0);
  assert.equal(bars[7].future, false);
  assert.equal(bars[8].future, true);
});

test("highlightParts: ignora acentos y mayúsculas; null si no hay coincidencia", () => {
  assert.deepEqual(highlightParts("Menú El Rincón", "rincon"), ["Menú El ", "Rincón", ""]);
  assert.deepEqual(highlightParts("PLAZA VEA", "plaza"), ["", "PLAZA", " VEA"]);
  assert.equal(highlightParts("RAPPI", "uber"), null);
  assert.equal(highlightParts("RAPPI", "  "), null);
});

test("toCsv: encabezado, comillas escapadas y monto en soles", () => {
  const csv = toCsv([tx({ id: "t1", comercio: 'Café "Bueno"', monto: 2, moneda: "USD", tipoCambio: 3.75 })], 3.5).split("\n");
  assert.equal(csv[0], '"id","fecha","tipo","comercio","contraparte","categoria","moneda","monto","monto_pen","fuente","medio"');
  assert.match(csv[1], /^"t1",.*"Café ""Bueno""",.*"USD","2","7.5","bcp_email",""$/);
});
