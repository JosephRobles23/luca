/**
 * Planificación pura de escrituras en la Sheet (ADR-004/005/006). Devuelve rangos A1 y valores;
 * quien escribe es el GoogleClient (`values:batchUpdate` / `append`). Sin React ni fetch.
 */
import type { Tx } from "./ledger.ts";

export type CellUpdate = { range: string; values: string[][] };
export type WritePlan = { updates: CellUpdate[]; appends: string[][] };

/** Índice de columna (0 = A) → letra A1. */
export function colLetter(i: number): string {
  let n = i + 1, s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const a1 = (tab: string, col: number, row1: number) => `'${tab.replace(/'/g, "''")}'!${colLetter(col)}${row1}`;

/** Fila (1-based, como en la Sheet) cuyo `id` coincide; -1 si no está. `rows[0]` son los encabezados. */
export function findRowById(rows: string[][], id: string): number {
  if (!rows.length) return -1;
  const idCol = rows[0].indexOf("id");
  if (idCol < 0) return -1;
  for (let i = 1; i < rows.length; i++) if ((rows[i][idCol] ?? "") === id) return i + 1;
  return -1;
}

/** Celdas a escribir para fijar `fields` en la fila con ese `id`. Lanza si falta la fila o una columna. */
export function planRowFields(tab: string, rows: string[][], id: string, fields: Record<string, string>): CellUpdate[] {
  const row1 = findRowById(rows, id);
  if (row1 < 0) throw new Error(`No encuentro el movimiento ${id} en la Sheet`);
  const headers = rows[0];
  return Object.entries(fields).map(([k, v]) => {
    const col = headers.indexOf(k);
    if (col < 0) throw new Error(`La pestaña ${tab} no tiene la columna ${k}`);
    return { range: a1(tab, col, row1), values: [[v]] };
  });
}

/** Upsert de pares key/value en una pestaña de 2 columnas: actualiza valores existentes, añade los nuevos. */
export function planKeyValueUpsert(tab: string, rows: string[][], updates: Record<string, string>): WritePlan {
  const plan: WritePlan = { updates: [], appends: [] };
  const index = new Map<string, number>();
  rows.forEach((r, i) => { if (i > 0 && r[0]) index.set(r[0], i + 1); });
  for (const [k, v] of Object.entries(updates)) {
    const row1 = index.get(k);
    if (row1) plan.updates.push({ range: a1(tab, 1, row1), values: [[v]] });
    else plan.appends.push([k, v]);
  }
  return plan;
}

/** Clave normalizada de comercio/contraparte (misma idea que `normalizeMerchant` en GAS: sin acentos, minúsculas, espacios colapsados). */
export function merchantKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9|*]+/g, " ").trim().replace(/\s+/g, " ");
}

export const COMERCIOS_HEADERS = ["clave", "nombre", "categoria", "categoria_origen", "veces", "actualizado_en"] as const;

/** Upsert en `Comercios` con `categoria_origen=user` (ADR-004 §6). Si falta el encabezado, lo añade. */
export function planMerchantUpsert(tab: string, rows: string[][], m: { key: string; nombre: string; categoria: string; now: string }): WritePlan {
  const plan: WritePlan = { updates: [], appends: [] };
  if (!m.key) return plan;
  const hasHeader = rows.length > 0 && rows[0].includes("clave");
  const headers = hasHeader ? rows[0] : [...COMERCIOS_HEADERS];
  if (!hasHeader) plan.appends.push([...COMERCIOS_HEADERS]);
  const col = (h: string) => headers.indexOf(h);
  const found = hasHeader ? rows.findIndex((r, i) => i > 0 && (r[col("clave")] ?? "") === m.key) : -1;
  if (found > 0) {
    const row1 = found + 1;
    const veces = parseInt(rows[found][col("veces")] ?? "0", 10) || 0;
    const set = (h: string, v: string) => { const c = col(h); if (c >= 0) plan.updates.push({ range: a1(tab, c, row1), values: [[v]] }); };
    set("categoria", m.categoria);
    set("categoria_origen", "user");
    set("veces", String(veces + 1));
    set("actualizado_en", m.now);
    if (!rows[found][col("nombre")]) set("nombre", m.nombre);
  } else {
    const row = headers.map(() => "");
    const put = (h: string, v: string) => { const c = col(h); if (c >= 0) row[c] = v; };
    put("clave", m.key); put("nombre", m.nombre); put("categoria", m.categoria); put("categoria_origen", "user"); put("veces", "1"); put("actualizado_en", m.now);
    plan.appends.push(row);
  }
  return plan;
}

/** Qué se escribe al recategorizar: la fila y el aprendizaje en `Comercios`. */
export function planRecategorize(tx: Tx, categoria: string, ledgerRows: string[][], comerciosRows: string[][], now: string, tabs = { ledger: "Movimientos", merchants: "Comercios" }) {
  const ledger = planRowFields(tabs.ledger, ledgerRows, tx.id, { categoria, categoria_origen: categoria ? "user" : "" });
  const name = tx.comercio || tx.contraparte;
  const key = tx.comercio ? merchantKey(tx.comercio) : tx.contraparteKey || (tx.contraparte ? merchantKey(tx.contraparte) : "");
  const merchants = categoria && name ? planMerchantUpsert(tabs.merchants, comerciosRows, { key, nombre: name, categoria, now }) : { updates: [], appends: [] };
  return { ledger, merchants };
}

export type TransferPlan = { kind: "category"; categoria: "Transferencias" } | { kind: "internal" };

/**
 * ADR-005: un yapeo P2P enviado se marca con la categoría "Transferencias" (y se aprende para esa contraparte);
 * cualquier otro gasto marcado como transferencia pasa a `internal_transfer` (entre cuentas propias) y sale de los KPIs.
 */
export function planMarkTransfer(tx: Tx): TransferPlan {
  const p2p = tx.canal === "yape_p2p" || (!tx.comercio && !!tx.contraparte);
  return p2p ? { kind: "category", categoria: "Transferencias" } : { kind: "internal" };
}

export type ManualInput = {
  monto: number; moneda: "PEN" | "USD"; fecha: string; tipo: "expense" | "income";
  comercio?: string; contraparte?: string; categoria?: string; nota?: string;
};

/** Fila nueva de `Movimientos` para alta manual (`id = manual:<uuid>`, `fuente = manual`). */
export function buildManualRow(headers: readonly string[], input: ManualInput, uuid: string, now: string): string[] {
  const row = headers.map(() => "");
  const put = (h: string, v: string) => { const c = headers.indexOf(h); if (c >= 0) row[c] = v; };
  put("id", `manual:${uuid}`);
  put("fecha", input.fecha.length === 10 ? `${input.fecha}T12:00:00-05:00` : input.fecha);
  put("tipo", input.tipo);
  put("monto", String(input.monto));
  put("moneda", input.moneda);
  put("comercio", input.comercio ?? "");
  put("contraparte", input.contraparte ?? "");
  put("contraparte_key", input.contraparte ? merchantKey(input.contraparte) : "");
  put("categoria", input.categoria ?? "");
  put("categoria_origen", input.categoria ? "user" : "");
  put("medio", "manual");
  put("canal", "");
  put("fuente", "manual");
  put("asunto", input.nota ?? "");
  put("creado_en", now);
  return row;
}

/** Valida la entrada manual; devuelve mensajes por campo (vacío = ok). */
export function validateManual(i: Partial<ManualInput>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!(typeof i.monto === "number" && Number.isFinite(i.monto) && i.monto > 0)) e.monto = "Ingresa un monto mayor a 0";
  if (!i.fecha || !/^\d{4}-\d{2}-\d{2}/.test(i.fecha)) e.fecha = "Elige una fecha";
  if (i.tipo !== "expense" && i.tipo !== "income") e.tipo = "Elige gasto o ingreso";
  if (i.moneda !== "PEN" && i.moneda !== "USD") e.moneda = "Moneda no soportada";
  if (!(i.comercio?.trim() || i.contraparte?.trim())) e.comercio = "Indica el comercio o la persona";
  return e;
}

/** Espera antes del reintento n (0-based) para un 429: 500 ms, 1 s, 2 s, 4 s… con tope. */
export function backoffDelay(attempt: number, base = 500, max = 8000): number {
  return Math.min(max, base * 2 ** attempt);
}
