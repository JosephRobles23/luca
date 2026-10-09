// Tests de las series de los gráficos del Resumen: gasto diario, ritmo y proyección, delta al mismo día, radar y 6 meses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastDayOf, dailySpend, cumulative, dayExpenses, ritmoMes, deltaAlDia, radarData, sixMonthTotals, axisAmount } from "./graficos.ts";

const tx = (o) => ({ id: "x", fecha: "2026-10-04T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "PEN", tipoCambio: null, comercio: "", contraparte: "", contraparteKey: "", categoria: "", categoriaOrigen: "", medio: "", canal: "", fuente: "bcp_email", operacion: "", gmailId: "", flags: [], asunto: "", creadoEn: "", ...o });
const d = (ymd, o) => tx({ fecha: `${ymd}T10:00:00-05:00`, ...o });

const TXS = [
  d("2026-09-01", { monto: 1300, categoria: "Vivienda" }), d("2026-09-02", { monto: 100, categoria: "Supermercado" }),
  d("2026-09-05", { monto: 50, categoria: "Comidas fuera" }), d("2026-09-20", { monto: 200, categoria: "Supermercado" }),
  d("2026-10-01", { monto: 1300, categoria: "Vivienda" }), d("2026-10-02", { monto: 40, categoria: "Supermercado" }),
  d("2026-10-04", { monto: 20, moneda: "USD", tipoCambio: 3.5, categoria: "Suscripciones" }), d("2026-10-04", { monto: 10, categoria: "Comidas fuera" }),
  d("2026-10-03", { tipo: "income", monto: 6500 }), d("2026-10-06", { tipo: "transfer_in", monto: 25 }),
];

test("lastDayOf: hoy en el mes en curso, todos si cerró, 0 si es futuro", () => {
  assert.equal(lastDayOf("2026-10", "2026-10-08"), 8);
  assert.equal(lastDayOf("2026-09", "2026-10-08"), 30);
  assert.equal(lastDayOf("2026-11", "2026-10-08"), 0);
});

test("dailySpend y cumulative: USD convertido, sin Vivienda si se pide, null tras el último día", () => {
  const all = dailySpend(TXS, "2026-10", 3.7);
  assert.equal(all.length, 31);
  assert.deepEqual(all.slice(0, 4), [1300, 40, 0, 80]);
  assert.deepEqual(dailySpend(TXS, "2026-10", 3.7, false).slice(0, 4), [0, 40, 0, 80]);
  assert.deepEqual(cumulative([1, 2, 3, 4], 2), [1, 3, null, null]);
});

test("dayExpenses: fecha completa (no solo el día del mes), sin Vivienda, de mayor a menor y cuántos sobran", () => {
  const txs = [
    d("2026-09-08", { monto: 3, contraparte: "SEPTIEMBRE" }), d("2026-10-08", { monto: 1300, categoria: "Vivienda" }),
    d("2026-10-08", { monto: 5, comercio: "A" }), d("2026-10-08", { monto: 20, comercio: "B" }), d("2026-10-08", { monto: 8, comercio: "C" }),
    d("2026-10-08", { monto: 2, moneda: "USD", tipoCambio: 3.5, comercio: "D" }), d("2026-10-08", { monto: 1, comercio: "E" }),
    d("2026-10-08", { tipo: "income", monto: 999 }),
  ];
  const r = dayExpenses(txs, "2026-10", 8, 3.7);
  assert.deepEqual(r.top.map((x) => [x.tx.comercio, x.amount]), [["B", 20], ["C", 8], ["D", 7], ["A", 5]]);
  assert.equal(r.rest, 1);
  assert.deepEqual(dayExpenses(txs, "2026-09", 8, 3.7).top.map((x) => x.tx.contraparte), ["SEPTIEMBRE"]);
  assert.deepEqual(dayExpenses(txs, "2026-10", 9, 3.7), { top: [], rest: 0 });
});

test("ritmoMes: acumulado vs mes anterior, proyección sin el fijo y datos de apoyo", () => {
  const r = ritmoMes(TXS, "2026-10", "2026-10-08", 3.7);
  assert.equal(r.days, 31);
  assert.equal(r.lastDay, 8);
  assert.equal(r.fixed, 1300);
  assert.equal(r.cum[7], 1420);
  assert.equal(r.cum[8], null);
  assert.equal(r.prevCum[1], 1400);
  assert.equal(r.prevCum[29], 1650);
  assert.equal(r.prevCum[30], null); // septiembre tiene 30 días
  assert.equal(r.projection[6], null);
  assert.equal(r.projection[7], 1420); // en hoy la proyección parte del acumulado real
  assert.equal(r.projectionEnd, 1300 + (120 / 8) * 31);
  assert.equal(r.avgDaily, 15);
  assert.deepEqual(r.maxDay, { day: 4, amount: 80 });
  assert.equal(r.spentDays, 2);
  // Mes cerrado: sin proyección.
  assert.equal(ritmoMes(TXS, "2026-09", "2026-10-08", 3.7).projectionEnd, null);
});

test("deltaAlDia: compara con el mes anterior hasta el mismo día; mes cerrado contra el mes completo", () => {
  assert.deepEqual(deltaAlDia(TXS, "2026-10", "2026-10-08", 3.7), { pct: Math.round(((1420 - 1450) / 1450) * 100), day: 8, closed: false });
  assert.equal(deltaAlDia(TXS, "2026-09", "2026-10-08", 3.7), null); // agosto sin gasto
});

test("radarData: mismas categorías para las 3 series, sin Vivienda, una escala; % suma 100 por mes", () => {
  const pen = radarData(TXS, "2026-10", 3.7, "pen");
  assert.deepEqual(pen.cats, ["Supermercado", "Suscripciones", "Comidas fuera"]);
  assert.deepEqual(pen.series[0].values, [40, 70, 10]);
  assert.deepEqual(pen.series[1].values, [300, 0, 50]);
  assert.equal(pen.series[2].values[0], 100); // (0 + 0 + 300) / 3
  assert.ok(pen.max >= 300 && pen.max % 50 === 0);
  const pct = radarData(TXS, "2026-10", 3.7, "pct");
  assert.equal(Math.round(pct.series[0].values.reduce((s, v) => s + v, 0)), 100);
  assert.equal(pct.max % 5, 0);
});

test("sixMonthTotals: 6 meses que terminan en el elegido, con neto y Yape aparte", () => {
  const s = sixMonthTotals(TXS, "2026-10", 3.7);
  assert.deepEqual(s.map((x) => x.month), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(JSON.parse(JSON.stringify(s[5])), { month: "2026-10", income: 6500, expense: 1420, net: 5080, yape: 25 });
});

test("axisAmount: miles abreviados", () => {
  assert.equal(axisAmount(1500), "1.5 k");
  assert.equal(axisAmount(800), "800");
});
