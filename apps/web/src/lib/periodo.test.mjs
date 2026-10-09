// Tests del selector de periodo de Movimientos: cuadrícula del calendario, meses por año y etiquetas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthMatrix, addMonths, monthsByYear, rangeLabel, periodLabel } from "./periodo.ts";

const plain = (x) => JSON.parse(JSON.stringify(x));

test("monthMatrix: semanas de lunes a domingo, con huecos fuera del mes", () => {
  const w = monthMatrix("2026-10"); // 1 oct 2026 es jueves
  assert.deepEqual(plain(w[0]), [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  assert.equal(w.at(-1).filter(Boolean).at(-1), "2026-10-31");
  assert.ok(w.every((r) => r.length === 7));
  assert.equal(monthMatrix("2026-02").flat().filter(Boolean).length, 28);
});

test("addMonths: cruza años en ambos sentidos", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", 0), "2026-10");
});

test("monthsByYear: años del más reciente al más antiguo, meses de enero a diciembre", () => {
  assert.deepEqual(plain(monthsByYear(["2026-10", "2026-09", "2025-12"])), [
    { year: "2026", months: ["2026-09", "2026-10"] }, { year: "2025", months: ["2025-12"] },
  ]);
});

test("rangeLabel y periodLabel", () => {
  assert.equal(rangeLabel("2026-10-01", "2026-10-15"), "1 – 15 oct 2026");
  assert.equal(rangeLabel("2026-09-15", "2026-10-04"), "15 sep – 4 oct 2026");
  assert.equal(rangeLabel("2025-12-20", "2026-01-05"), "20 dic 2025 – 5 ene 2026");
  assert.equal(rangeLabel("2026-10-04", "2026-10-04"), "4 oct 2026");
  assert.equal(rangeLabel("2026-10-04", ""), "Desde el 4 oct 2026");
  assert.equal(rangeLabel("", "2026-10-04"), "Hasta el 4 oct 2026");
  assert.equal(periodLabel({ mes: "", desde: "", hasta: "" }), "Todos los meses");
  assert.equal(periodLabel({ mes: "2026-10", desde: "", hasta: "" }), "Octubre 2026");
  assert.equal(periodLabel({ mes: "", desde: "2026-09-15", hasta: "2026-10-04" }), "15 sep – 4 oct 2026");
});
