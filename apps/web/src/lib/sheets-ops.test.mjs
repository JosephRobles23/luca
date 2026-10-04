// Tests de la planificación de escrituras (recategorizar, Comercios, alta manual, transferencias, Ajustes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsToTxs, LEDGER_HEADERS, filterTxs, summarize, toBase } from "./ledger.ts";
import {
  colLetter, findRowById, planRowFields, planKeyValueUpsert, merchantKey, planMerchantUpsert, planRecategorize,
  planMarkTransfer, buildManualRow, validateManual, backoffDelay,
} from "./sheets-ops.ts";

const H = [...LEDGER_HEADERS];
const row = (o) => H.map((k) => o[k] ?? "");
const rows = [
  H,
  row({ id: "bcp:1", fecha: "2026-10-02T21:06:00-05:00", tipo: "expense", monto: "53.30", moneda: "PEN", comercio: "CA012 AVIACION", categoria: "Transporte", categoria_origen: "rule", fuente: "bcp_email" }),
  row({ id: "yape:3", fecha: "2026-10-04T02:35:00-05:00", tipo: "expense", monto: "10", moneda: "PEN", contraparte: "Carlos Roj*", contraparte_key: "Carlos Roj*|123", canal: "yape_p2p", fuente: "yape_email" }),
  row({ id: "bcp:4", fecha: "2026-10-02T14:58:00-05:00", tipo: "expense", monto: "57.95", moneda: "USD", tipo_cambio: "3.409", comercio: "AMAZON", fuente: "bcp_email" }),
  row({ id: "push:5", fecha: "2026-10-05T10:00:00-05:00", tipo: "transfer_in", monto: "120", moneda: "PEN", contraparte: "María Qui*", canal: "yape_push", fuente: "yape_push" }),
];
const txs = rowsToTxs(rows);

test("colLetter y findRowById", () => {
  assert.equal(colLetter(0), "A");
  assert.equal(colLetter(25), "Z");
  assert.equal(colLetter(26), "AA");
  assert.equal(findRowById(rows, "yape:3"), 3);
  assert.equal(findRowById(rows, "nope"), -1);
  assert.equal(findRowById([], "x"), -1);
});

test("planRowFields apunta a la celda exacta (columna por encabezado, fila por id)", () => {
  const u = planRowFields("Movimientos", rows, "yape:3", { categoria: "Transferencias", categoria_origen: "user" });
  assert.deepEqual(u, [
    { range: "'Movimientos'!J3", values: [["Transferencias"]] },
    { range: "'Movimientos'!K3", values: [["user"]] },
  ]);
  assert.throws(() => planRowFields("Movimientos", rows, "nope", { categoria: "x" }), /No encuentro/);
});

test("planKeyValueUpsert: actualiza existentes y añade nuevas", () => {
  const aj = [["key", "value"], ["fx.usd_pen", "3.50"], ["gmail.batch", "40"]];
  const p = planKeyValueUpsert("Ajustes", aj, { "fx.usd_pen": "3.70", "import.since": "2026-01-01", "import.status": "running" });
  assert.deepEqual(p.updates, [{ range: "'Ajustes'!B2", values: [["3.70"]] }]);
  assert.deepEqual(p.appends, [["import.since", "2026-01-01"], ["import.status", "running"]]);
});

test("merchantKey normaliza acentos, mayúsculas y espacios", () => {
  assert.equal(merchantKey("  Menú  El Rincón "), "menu el rincon");
  assert.equal(merchantKey("APPLE.COM/BILL"), "apple.com/bill");   // igual que GAS
  assert.equal(merchantKey("Carlos Roj*"), "carlos roj*");
});

test("planMerchantUpsert: nuevo → append; existente → categoría user y veces+1; sin encabezado lo crea", () => {
  const now = "2026-10-04T10:00:00-05:00";
  const com = [["clave", "nombre", "categoria", "categoria_origen", "veces", "actualizado_en"], ["rappi", "RAPPI", "Comidas fuera", "cache", "3", "x"]];
  const nuevo = planMerchantUpsert("Comercios", com, { key: "amazon", nombre: "AMAZON", categoria: "Ocio", now });
  assert.deepEqual(nuevo.updates, []);
  assert.deepEqual(nuevo.appends, [["amazon", "AMAZON", "Ocio", "user", "1", now]]);
  const existente = planMerchantUpsert("Comercios", com, { key: "rappi", nombre: "RAPPI", categoria: "Otros", now });
  assert.deepEqual(existente.appends, []);
  assert.deepEqual(existente.updates.map((u) => [u.range, u.values[0][0]]), [
    ["'Comercios'!C2", "Otros"], ["'Comercios'!D2", "user"], ["'Comercios'!E2", "4"], ["'Comercios'!F2", now],
  ]);
  const vacio = planMerchantUpsert("Comercios", [], { key: "x", nombre: "X", categoria: "Otros", now });
  assert.equal(vacio.appends.length, 2);
  assert.equal(vacio.appends[0][0], "clave");
});

test("planRecategorize: fila + Comercios (comercio o contraparte_key)", () => {
  const now = "2026-10-04T10:00:00-05:00";
  const r1 = planRecategorize(txs[2], "Ocio", rows, [], now);
  assert.equal(r1.ledger.length, 2);
  assert.equal(r1.merchants.appends.at(-1)[0], "amazon");
  const r2 = planRecategorize(txs[1], "Transferencias", rows, [], now);
  assert.equal(r2.merchants.appends.at(-1)[0], "p2p:Carlos Roj*|123"); // misma clave que GAS (merchantKey_)
  const r3 = planRecategorize(txs[1], "", rows, [], now); // quitar categoría no aprende nada
  assert.deepEqual(r3.ledger.map((u) => u.values[0][0]), ["", ""]);
  assert.deepEqual(r3.merchants.appends, []);
});

test("planMarkTransfer según ADR-005", () => {
  assert.deepEqual(planMarkTransfer(txs[1]), { kind: "category", categoria: "Transferencias" }); // yapeo P2P
  assert.deepEqual(planMarkTransfer(txs[0]), { kind: "internal" });                             // consumo con tarjeta
});

test("buildManualRow y validateManual", () => {
  const r = buildManualRow(H, { monto: 15.5, moneda: "PEN", fecha: "2026-10-04", tipo: "expense", comercio: "Menú", categoria: "Comidas fuera", nota: "almuerzo" }, "uuid-1", "2026-10-04T13:00:00-05:00");
  const tx = rowsToTxs([H, r])[0];
  assert.equal(tx.id, "manual:uuid-1");
  assert.equal(tx.fuente, "manual");
  assert.equal(tx.fecha, "2026-10-04T12:00:00-05:00");
  assert.equal(tx.categoriaOrigen, "user");
  assert.equal(tx.asunto, "almuerzo");
  assert.deepEqual(validateManual({ monto: 15.5, moneda: "PEN", fecha: "2026-10-04", tipo: "expense", comercio: "x" }), {});
  const e = validateManual({ monto: 0, moneda: "EUR", fecha: "", tipo: "x" });
  assert.deepEqual(Object.keys(e).sort(), ["comercio", "fecha", "moneda", "monto", "tipo"]);
});

test("backoffDelay exponencial con tope", () => {
  assert.deepEqual([0, 1, 2, 3, 10].map((a) => backoffDelay(a)), [500, 1000, 2000, 4000, 8000]);
});

test("ledger: transfer_in aparte, conversión USD (correo > Ajustes), filtros", () => {
  const s = summarize(txs, { month: "2026-10", usdRate: 3.7 });
  assert.equal(s.receivedYape, 120);
  assert.equal(s.receivedYapeCount, 1);
  assert.equal(s.income, 0);
  assert.equal(toBase(txs[2], 3.7), 57.95 * 3.409);       // trae tipo_cambio
  assert.equal(toBase({ ...txs[2], tipoCambio: null }, 3.7), 57.95 * 3.7); // cae a Ajustes
  assert.equal(filterTxs(txs, { tipo: "expense" }).length, 3);
  assert.equal(filterTxs(txs, { categoria: "__pending__" }).length, 3);
  assert.equal(filterTxs(txs, { q: "maria" })[0].id, "push:5");
  assert.equal(filterTxs(txs, { fuente: "yape_email", categoria: "Transporte" }).length, 0);
});
