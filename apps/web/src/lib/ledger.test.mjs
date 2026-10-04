// Tests de la lógica pura del dashboard (se compila TS al vuelo con node --experimental-strip-types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsToTxs, summarize, lastMonths, monthOf } from "./ledger.ts";

const H = ["id", "fecha", "tipo", "monto", "moneda", "tipo_cambio", "comercio", "contraparte", "contraparte_key", "categoria", "categoria_origen", "medio", "canal", "fuente", "operacion", "gmail_id", "flags", "asunto", "creado_en"];
const row = (o) => H.map((k) => o[k] ?? "");
const rows = [
  H,
  row({ id: "bcp:1", fecha: "2026-10-02T21:06:00-05:00", tipo: "expense", monto: "53.30", moneda: "PEN", comercio: "CA012 AVIACION", categoria: "Transporte", fuente: "bcp_email" }),
  row({ id: "bcp:2", fecha: "2026-10-03T07:54:00-05:00", tipo: "expense", monto: "3.86", moneda: "USD", comercio: "APPLE.COM/BILL", categoria: "Suscripciones", fuente: "bcp_email" }),
  row({ id: "yape:3", fecha: "2026-10-04T02:35:00-05:00", tipo: "expense", monto: "10", moneda: "PEN", contraparte: "Carlos Roj*", canal: "yape_p2p", fuente: "yape_email" }),
  row({ id: "bcp:4", fecha: "2026-10-02T14:58:00-05:00", tipo: "internal_transfer", monto: "57.95", moneda: "PEN", tipo_cambio: "3.409", fuente: "bcp_email" }),
  row({ id: "bcp:5", fecha: "2026-09-15T20:20:00-05:00", tipo: "expense", monto: "10", moneda: "PEN", comercio: "Metropolitano y Corredores", categoria: "Transporte", fuente: "yape_email" }),
  row({ id: "in:6", fecha: "2026-10-01T09:00:00-05:00", tipo: "income", monto: "6500", moneda: "PEN", comercio: "Sueldo", categoria: "Ingreso" }),
];

test("rowsToTxs mapea por encabezado y tolera columnas ausentes", () => {
  const txs = rowsToTxs(rows);
  assert.equal(txs.length, 6);
  assert.equal(txs[0].monto, 53.3);
  assert.equal(txs[3].tipoCambio, 3.409);
  assert.deepEqual(rowsToTxs([]), []);
  assert.equal(rowsToTxs([["id", "monto"], ["x", "1,5"]])[0].monto, 1.5);
});

test("summarize: KPIs, categorías, transferencias internas fuera, pendientes y 6 meses", () => {
  const s = summarize(rowsToTxs(rows), { month: "2026-10", usdRate: 3.5 });
  assert.equal(s.income, 6500);
  assert.equal(s.expense, Math.round((53.3 + 3.86 * 3.5 + 10) * 100) / 100);   // la transferencia interna no cuenta
  assert.equal(s.net, Math.round((6500 - s.expense) * 100) / 100);
  assert.equal(s.byCategory[0].name, "Transporte");
  assert.equal(s.byCategory.find((c) => c.name === "Sin categoría").amount, 10);
  assert.equal(s.pending.length, 1);
  assert.equal(s.pending[0].id, "yape:3");
  assert.equal(s.last6.length, 6);
  assert.equal(s.last6.at(-1).month, "2026-10");
  assert.equal(s.last6.at(-2).expense, 10);        // septiembre
  assert.equal(s.prevExpense, 10);
  assert.equal(s.movements[0].id, "yape:3");       // más reciente primero
  assert.equal(s.topMerchants[0].name, "CA012 AVIACION");
});

test("lastMonths cruza el año; monthOf toma el mes de la cadena ISO (ya en Lima)", () => {
  assert.deepEqual(lastMonths("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(monthOf("2026-10-02T21:06:00-05:00"), "2026-10");
});
