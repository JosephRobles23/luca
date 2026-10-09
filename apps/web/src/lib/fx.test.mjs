// Tipo de cambio automático en la web (ADR-012): lectura de `_TipoCambio`, modo, tipo por fecha y conversión.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFx, fxContext, fxInfo, fxModo, parseTipoCambio, tcLabel, usdOn } from "./fx.ts";
import { rowsToTxs, summarize, toBase, LEDGER_HEADERS } from "./ledger.ts";
import { buildTipoCambio } from "./fixtures.ts";

const TABLA = [
  ["fecha", "usd_compra", "usd_venta", "eur_venta", "fuente", "leido_en"],
  ["2026-10-06", "3.431", "3.437", "3.879", "bcrp", ""],
  ["2026-10-02", "3.437", "3.442", "4.087", "bcrp", ""],
  ["2026-10-05", "3.423", "3,435", "", "bcrp", ""],
  ["basura", "1", "1", "1", "bcrp", ""],
  ["2026-10-07", "", "", "", "bcrp", ""],
];

test("parseTipoCambio: ordena, acepta coma decimal y descarta filas sin venta o sin fecha", () => {
  const t = parseTipoCambio(TABLA);
  assert.deepEqual(t.map((r) => [r.fecha, r.usdVenta]), [["2026-10-02", 3.442], ["2026-10-05", 3.435], ["2026-10-06", 3.437]]);
  assert.equal(t[1].eurVenta, null);
  assert.deepEqual(parseTipoCambio([]), []);
  assert.deepEqual(parseTipoCambio([["otra", "cosa"]]), []);
});

test("usdOn: día, día anterior con dato, más reciente → último, más antiguo → primero; null sin tabla", () => {
  const t = parseTipoCambio(TABLA);
  assert.equal(usdOn(t, "2026-10-05T12:00:00-05:00"), 3.435);
  assert.equal(usdOn(t, "2026-10-04"), 3.442);
  assert.equal(usdOn(t, "2026-10-09"), 3.437);
  assert.equal(usdOn(t, "2025-01-01"), 3.442);
  assert.equal(usdOn([], "2026-10-05"), null);
});

test("fxModo y fxContext: auto por defecto; manual si se eligió o se había cambiado el 3.50", () => {
  const t = parseTipoCambio(TABLA);
  assert.equal(fxModo({}), "auto");
  assert.equal(fxModo({ "fx.usd_pen": "3.50" }), "auto");
  assert.equal(fxModo({ "fx.usd_pen": "3.80" }), "manual");
  assert.equal(fxModo({ "fx.usd_pen": "3.80", "fx.modo": "auto" }), "auto");
  assert.equal(fxContext({}, t).respaldo, 3.437);
  assert.equal(fxContext({ "fx.modo": "manual", "fx.usd_pen": "3.9" }, t).respaldo, 3.9);
  assert.equal(fxContext({}, []).respaldo, 3.5);
});

const row = (o) => LEDGER_HEADERS.map((h) => String(o[h] ?? ""));
const MOVS = [[...LEDGER_HEADERS],
  row({ id: "a", fecha: "2026-10-05T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "USD" }),
  row({ id: "b", fecha: "2026-10-04T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "USD", tipo_cambio: "3.6" }),
  row({ id: "c", fecha: "2026-10-08T10:00:00-05:00", tipo: "expense", monto: 10, moneda: "PEN" })];

test("applyFx + toBase: TC del correo, si no el del día; en manual el fijo; cifras como el MCP/dashboard (80.35)", () => {
  const t = parseTipoCambio(TABLA);
  const auto = fxContext({}, t);
  const txs = applyFx(rowsToTxs(MOVS), t, auto);
  assert.equal(txs[0].tcAuto, 3.435);
  assert.equal(txs[1].tcAuto ?? null, null);
  assert.equal(Math.round(toBase(txs[0], auto.respaldo) * 100) / 100, 34.35);
  assert.equal(summarize(txs, { month: "2026-10", usdRate: auto.respaldo }).expense, 80.35);
  assert.deepEqual(tcLabel(txs[0], auto.respaldo), { tc: 3.435, origen: "del día" });
  assert.deepEqual(tcLabel(txs[1], auto.respaldo), { tc: 3.6, origen: "correo" });

  const man = fxContext({ "fx.modo": "manual", "fx.usd_pen": "4" }, t);
  const txm = applyFx(txs, t, man);
  assert.equal(txm[0].tcAuto, null);
  assert.equal(summarize(txm, { month: "2026-10", usdRate: man.respaldo }).expense, 86);
  assert.deepEqual(tcLabel(txm[0], man.respaldo), { tc: 4, origen: "Ajustes" });
});

test("fxInfo: fuente BCRP sin atribución; open.er-api con atribución; null sin datos", () => {
  const bcrp = fxInfo(fxContext({}, parseTipoCambio(TABLA)));
  assert.equal(bcrp.venta, 3.437);
  assert.match(bcrp.fuente, /BCRP/);
  assert.equal(bcrp.atribucion, false);
  const er = fxInfo(fxContext({}, parseTipoCambio([TABLA[0], ["2026-10-09", "3.44", "3.44", "", "er-api", ""]])));
  assert.equal(er.atribucion, true);
  assert.equal(fxInfo(fxContext({}, [])), null);
});

test("buildTipoCambio (mock): solo días hábiles, sin los 2 más recientes, parseable", () => {
  const now = new Date("2026-10-09T12:00:00-05:00");
  const t = parseTipoCambio(buildTipoCambio(now));
  assert.ok(t.length > 60);
  assert.ok(t[t.length - 1].fecha <= "2026-10-07");
  assert.ok(t.every((r) => ![0, 6].includes(new Date(`${r.fecha}T12:00:00Z`).getUTCDay())));
});
