// Tests de presentación: colores y uso de categorías, sugerencia por comercio, agrupación por día y ritmo del mes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { catVar, catColor, txInitial, topCategories, suggestCategory, quickCategories, isPersonTx } from "./categorias.ts";
import { dayLabel, groupByDay, pace, daysInMonth, prevDay, scanFreshness } from "./dias.ts";

const tx = (o) => ({ id: "x", fecha: "2026-10-04T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "PEN", tipoCambio: null, comercio: "", contraparte: "", contraparteKey: "", categoria: "", categoriaOrigen: "", medio: "", canal: "", fuente: "bcp_email", operacion: "", gmailId: "", flags: [], asunto: "", creadoEn: "", ...o });

test("catVar: fijo para la taxonomía por defecto, estable para las personalizadas, neutro sin categoría", () => {
  assert.equal(catVar("Supermercado"), "--cat-mint");
  assert.equal(catVar(""), "--cat-none");
  assert.equal(catVar("Sin categoría"), "--cat-none");
  assert.equal(catVar("Mascotas"), catVar("Mascotas"));
  assert.match(catVar("Mascotas"), /^--cat-/);
  assert.equal(catColor("Salud"), "var(--cat-rose)");
});

test("txInitial: inicial del comercio o persona; ⇄ para transferencias propias", () => {
  assert.equal(txInitial(tx({ comercio: "spaceship.com" })), "S");
  assert.equal(txInitial(tx({ comercio: "*APPLE" })), "A");
  assert.equal(txInitial(tx({ tipo: "internal_transfer" })), "⇄");
});

test("topCategories: por uso, solo vigentes, sin Ingreso y completando con la lista", () => {
  const cats = ["Vivienda", "Supermercado", "Comidas fuera", "Transporte", "Ingreso"];
  const txs = [tx({ categoria: "Transporte" }), tx({ categoria: "Transporte" }), tx({ categoria: "Supermercado" }), tx({ categoria: "Borrada" }), tx({ categoria: "Ingreso", tipo: "income" })];
  assert.deepEqual(topCategories(txs, cats, 4), ["Transporte", "Supermercado", "Vivienda", "Comidas fuera"]);
  assert.deepEqual(topCategories([], cats, 2), ["Vivienda", "Supermercado"]);
});

test("quickCategories: sugerencia primero, Transferencias si es una persona, luego las más usadas", () => {
  const cats = ["Vivienda", "Supermercado", "Comidas fuera", "Transporte", "Transferencias", "Salud"];
  const txs = [tx({ categoria: "Comidas fuera" }), tx({ categoria: "Comidas fuera" }), tx({ categoria: "Supermercado" }), tx({ categoria: "Transporte" })];
  assert.deepEqual(quickCategories(txs, cats, {}, 4), ["Comidas fuera", "Supermercado", "Transporte", "Vivienda"]);
  assert.deepEqual(quickCategories(txs, cats, { persona: true }, 4), ["Transferencias", "Comidas fuera", "Supermercado", "Transporte"]);
  assert.deepEqual(quickCategories(txs, cats, { persona: true, suggestion: "Salud" }, 4), ["Salud", "Transferencias", "Comidas fuera", "Supermercado"]);
  // Sin duplicar lo que ya está entre las más usadas, ni ofrecer Transferencias si el usuario la borró.
  assert.deepEqual(quickCategories(txs, cats, { suggestion: "Supermercado" }, 4), ["Comidas fuera", "Supermercado", "Transporte", "Vivienda"]);
  assert.deepEqual(quickCategories(txs, cats.filter((c) => c !== "Transferencias"), { persona: true }, 3), ["Comidas fuera", "Supermercado", "Transporte"]);
});

test("isPersonTx: contraparte sin comercio (Yape P2P o transferencia a una persona)", () => {
  assert.equal(isPersonTx(tx({ contraparte: "COSME RODRIGO QUIS" })), true);
  assert.equal(isPersonTx(tx({ contraparteKey: "51999" })), true);
  assert.equal(isPersonTx(tx({ comercio: "PLAZA VEA", contraparte: "x" })), false);
  assert.equal(isPersonTx(tx({})), false);
});

test("suggestCategory: la más reciente del mismo comercio o persona; null sin coincidencias", () => {
  const p = tx({ id: "p", comercio: "CA012 AVIACION" });
  const txs = [p,
    tx({ id: "a", comercio: "ca012 aviacion ", categoria: "Transporte", fecha: "2026-09-01T00:00:00-05:00" }),
    tx({ id: "b", comercio: "CA012 AVIACION", categoria: "Viajes", fecha: "2026-09-20T00:00:00-05:00" })];
  assert.equal(suggestCategory(p, txs), "Viajes");
  assert.equal(suggestCategory(tx({ id: "q", comercio: "Otro" }), txs), null);
  const y = tx({ id: "y", contraparte: "María Q", contraparteKey: "mq" });
  assert.equal(suggestCategory(y, [y, tx({ id: "z", contraparte: "Maria Quispe", contraparteKey: "mq", categoria: "Transferencias" })]), "Transferencias");
});

test("dayLabel y prevDay: Hoy/Ayer, día de la semana y año si cambia", () => {
  assert.equal(prevDay("2026-10-01"), "2026-09-30");
  assert.equal(dayLabel("2026-10-04", "2026-10-04"), "Hoy · dom 4 oct");
  assert.equal(dayLabel("2026-10-03", "2026-10-04"), "Ayer · sáb 3 oct");
  assert.equal(dayLabel("2026-10-01", "2026-10-04"), "jue 1 oct");
  assert.equal(dayLabel("2025-12-31", "2026-10-04"), "mié 31 dic 2025");
});

test("groupByDay: días descendentes, orden interno conservado y gasto del día en soles", () => {
  const txs = [
    tx({ id: "1", fecha: "2026-10-04T12:00:00-05:00", monto: 1.24, moneda: "USD" }),
    tx({ id: "2", fecha: "2026-10-04T09:00:00-05:00", monto: 10 }),
    tx({ id: "3", fecha: "2026-10-03T09:00:00-05:00", monto: 30, tipo: "internal_transfer" }),
  ];
  const g = groupByDay(txs, "2026-10-04", 3.5);
  assert.deepEqual(g.map((d) => d.day), ["2026-10-04", "2026-10-03"]);
  assert.deepEqual(g[0].txs.map((t) => t.id), ["1", "2"]);
  assert.equal(g[0].expense, 14.34);
  assert.equal(g[1].expense, 0);
});

test("pace: ratio con tope, día del mes, mes cerrado y sin mes anterior", () => {
  assert.equal(daysInMonth("2026-02"), 28);
  const p = pace("2026-10", 101.59, 1480.2, "2026-10-04");
  assert.equal(p.spentPct, 7);
  assert.equal(p.day, 4);
  assert.equal(p.days, 31);
  assert.ok(Math.abs(p.dayRatio - 4 / 31) < 1e-9);
  assert.equal(pace("2026-09", 2000, 1000, "2026-10-04").spentRatio, 1);
  assert.equal(pace("2026-09", 2000, 1000, "2026-10-04").closed, true);
  assert.equal(pace("2026-10", 50, 0, "2026-10-04").spentRatio, null);
});

test("scanFreshness: hace X · próxima en Y; aviso si lleva mucho sin leer", () => {
  const now = Date.parse("2026-10-04T15:00:00-05:00");
  assert.equal(scanFreshness("2026-10-04T14:54:00-05:00", now), "Última lectura del correo hace 6 min · próxima en 9 min");
  assert.match(scanFreshness("2026-10-04T10:00:00-05:00", now), /revisa tu script/);
  assert.equal(scanFreshness(undefined, now), "Tu script aún no ha leído el correo");
});

test("catIconKey: taxonomía fija, palabras clave, tipos especiales y etiqueta por defecto (paridad con la Sheet)", async () => {
  const { catIconKey } = await import("./categorias.ts");
  assert.equal(catIconKey("Supermercado"), "carrito");
  assert.equal(catIconKey("Educación"), "birrete");
  assert.equal(catIconKey("Mascotas"), "huella");
  assert.equal(catIconKey("Viajes de trabajo"), "avion");
  assert.equal(catIconKey("Gasolina"), "auto");
  assert.equal(catIconKey("Cosas raras"), "etiqueta");
  assert.equal(catIconKey(""), "duda");
  assert.equal(catIconKey("", "internal_transfer"), "flechas");
  assert.equal(catIconKey("", "transfer_in"), "recibir");
  assert.equal(catIconKey("", "income"), "billetera");
});
