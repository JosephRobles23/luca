// Tests del Resumen: meses y navegación, delta, leyenda del ritmo, filtros de movimientos, escala de 6 meses y enlaces.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstName, monthName, monthTitle, monthOptions, stepMonth, deltaVsPrev, paceLegend, movementKind, filterMovements,
  movementCounts, capGroups, sixMonthAverage, niceMax, shortAmount, categoryHref, merchantHref, pendingMeta,
} from "./resumen.ts";
import { pace } from "./dias.ts";

const tx = (o) => ({ id: "x", fecha: "2026-10-04T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "PEN", tipoCambio: null, comercio: "", contraparte: "", contraparteKey: "", categoria: "", categoriaOrigen: "", medio: "", canal: "", fuente: "bcp_email", operacion: "", gmailId: "", flags: [], asunto: "", creadoEn: "", ...o });
const plain = (x) => JSON.parse(JSON.stringify(x));

test("firstName: primer nombre, si no la parte local del correo", () => {
  assert.equal(firstName("Joseph Robles", "j@x.com"), "Joseph");
  assert.equal(firstName("  ", "ana.luz@gmail.com"), "ana.luz");
  assert.equal(firstName("", ""), "");
});

test("monthName / monthTitle: nombre largo, con año solo si no es el actual", () => {
  assert.equal(monthName("2026-10", "2026-10-04"), "octubre");
  assert.equal(monthName("2025-12", "2026-10-04"), "diciembre 2025");
  assert.equal(monthTitle("2026-09"), "Septiembre 2026");
});

test("monthOptions: meses con datos + últimos 3, descendente, sin meses futuros", () => {
  const txs = [tx({ fecha: "2026-03-02T10:00:00-05:00" }), tx({ fecha: "2026-10-01T10:00:00-05:00" }), tx({ fecha: "2026-11-01T10:00:00-05:00" }), tx({ fecha: "" })];
  assert.deepEqual(monthOptions(txs, "2026-10"), ["2026-10", "2026-09", "2026-08", "2026-03"]);
  assert.deepEqual(monthOptions(txs, "2026-10", "2026-05"), ["2026-10", "2026-09", "2026-08", "2026-05", "2026-03"]);
});

test("stepMonth: ‹ va al más antiguo, › al más reciente; null en los extremos", () => {
  const months = ["2026-10", "2026-09", "2026-03"];
  assert.equal(stepMonth(months, "2026-10", -1), "2026-09");
  assert.equal(stepMonth(months, "2026-09", -1), "2026-03");
  assert.equal(stepMonth(months, "2026-03", -1), null);
  assert.equal(stepMonth(months, "2026-09", 1), "2026-10");
  assert.equal(stepMonth(months, "2026-10", 1), null);
  assert.equal(stepMonth(months, "2020-01", 1), null);
});

test("deltaVsPrev: % entero con dirección; null sin mes anterior", () => {
  assert.deepEqual(deltaVsPrev(101.59, 1480.2), { pct: 93, dir: "down" });
  assert.deepEqual(deltaVsPrev(1480.2, 1072), { pct: 38, dir: "up" });
  assert.deepEqual(deltaVsPrev(50, 50), { pct: 0, dir: "same" });
  assert.equal(deltaVsPrev(50, 0), null);
});

test("paceLegend: en curso, mes cerrado y sin mes anterior", () => {
  assert.deepEqual(paceLegend(pace("2026-10", 101.59, 1480.2, "2026-10-04"), "septiembre"), { left: "7 % de lo gastado en septiembre", right: "Día 4 de 31 · la marca es hoy" });
  assert.deepEqual(paceLegend(pace("2026-09", 1480, 1000, "2026-10-04"), "agosto"), { left: "Mes cerrado · 148 % de lo gastado en agosto", right: "30 de 30 días" });
  assert.equal(paceLegend(pace("2026-10", 20, 0, "2026-10-04"), "septiembre").left, "Sin gasto en septiembre con qué comparar");
});

test("movementKind y filtros: consumos, transferencias (propias, recibidas, a personas) y pendientes", () => {
  const txs = [
    tx({ id: "a", comercio: "PLAZA VEA", categoria: "Supermercado" }),
    tx({ id: "b", contraparte: "Carlos Roj*", canal: "yape_p2p" }),
    tx({ id: "c", tipo: "internal_transfer" }),
    tx({ id: "d", tipo: "transfer_in", contraparte: "María" }),
    tx({ id: "e", comercio: "LA LUCHA" }),
    tx({ id: "f", tipo: "income", comercio: "Sueldo", categoria: "Ingreso" }),
    tx({ id: "g", comercio: "Transferencia a tercero", categoria: "Transferencias" }),
  ];
  assert.equal(movementKind(txs[0]), "consumo");
  assert.equal(movementKind(txs[1]), "transferencia");
  assert.equal(movementKind(txs[5]), "otro");
  assert.deepEqual(filterMovements(txs, "consumo").map((t) => t.id), ["a", "e"]);
  assert.deepEqual(filterMovements(txs, "transferencia").map((t) => t.id), ["b", "c", "d", "g"]);
  assert.deepEqual(filterMovements(txs, "pendiente").map((t) => t.id), ["b", "e"]);
  assert.equal(filterMovements(txs, "all").length, 7);
  assert.deepEqual(plain(movementCounts(txs)), { all: 7, consumo: 2, transferencia: 4, pendiente: 2 });
});

test("capGroups: corta por días completos hasta el límite; el primer día siempre entra", () => {
  const g = (day, n) => ({ day, label: day, txs: Array.from({ length: n }, (_, i) => tx({ id: `${day}-${i}` })), expense: 0 });
  const r = capGroups([g("d3", 2), g("d2", 3), g("d1", 4)], 6);
  assert.deepEqual(r.groups.map((x) => x.day), ["d3", "d2"]);
  assert.equal(r.shown, 5);
  assert.equal(r.total, 9);
  const big = capGroups([g("d1", 10)], 4);
  assert.equal(big.shown, 4);
  assert.equal(big.groups[0].txs.length, 4);
});

test("sixMonthAverage: desde el primer mes con gasto; null sin datos", () => {
  const m = (e) => e.map((expense, i) => ({ month: `2026-0${i + 1}`, expense }));
  assert.equal(sixMonthAverage(m([0, 0, 0, 0, 1480.2, 101.6])), 790.9);
  assert.equal(sixMonthAverage(m([100, 0, 200, 0, 0, 300])), 100);
  assert.equal(sixMonthAverage(m([0, 0, 0, 0, 0, 0])), null);
});

test("niceMax y shortAmount: eje redondo y etiquetas cortas", () => {
  assert.equal(niceMax(1480), 1500);
  assert.equal(niceMax(2600), 3000);
  assert.equal(niceMax(101), 150);
  assert.equal(niceMax(0), 100);
  assert.equal(shortAmount(101.59), "102");
  assert.equal(shortAmount(1480.2), "1.48k");
  assert.equal(shortAmount(1500), "1.5k");
  assert.equal(shortAmount(12500), "12.5k");
  assert.equal(shortAmount(0), "0");
});

test("enlaces: categoría (Sin categoría → pendientes), comercio por texto y meta del pendiente", () => {
  assert.equal(categoryHref("Comidas fuera", "2026-10"), "/app/movimientos?categoria=Comidas%20fuera&mes=2026-10");
  assert.equal(categoryHref("Sin categoría", "2026-10"), "/app/movimientos?categoria=__pending__&mes=2026-10");
  assert.equal(merchantHref("RAPPI & CO", "2026-09"), "/app/movimientos?q=RAPPI%20%26%20CO&mes=2026-09");
  assert.equal(pendingMeta(tx({ fecha: "2026-10-01T09:00:00-05:00" }), () => "BCP email"), "01 oct · BCP email");
});
