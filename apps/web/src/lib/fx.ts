/**
 * Tipo de cambio USD→PEN (ADR-012). La copia del usuario guarda en `_TipoCambio` la venta diaria del BCRP
 * (sistema bancario SBS) o, si falló, el tipo medio de open.er-api; aquí solo se lee y se aplica.
 * Misma lógica que gas/shared/fx-runtime.js (fxModo_, fxUsdEn_, fxContexto_): test de paridad en tests/fx.test.mjs.
 *
 * Orden para un movimiento en USD: TC del correo → (manual) `fx.usd_pen` → venta BCRP de su día o del anterior
 * con dato → último dato → `fx.usd_pen`.
 */
import type { Tx } from "./ledger.ts";

export type FxFuente = "bcrp" | "er-api" | string;
export type FxRow = { fecha: string; usdCompra: number | null; usdVenta: number; eurVenta: number | null; fuente: FxFuente; leidoEn: string };
export type FxModo = "auto" | "manual";
export type FxContext = { modo: FxModo; respaldo: number; ultimo: FxRow | null };

export const FX_DEFAULT = 3.5;

const num = (v: string | undefined): number | null => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Matriz de `_TipoCambio` (fila 1 = encabezados) → filas válidas ordenadas por fecha. */
export function parseTipoCambio(rows: string[][]): FxRow[] {
  if (!rows.length) return [];
  const head = rows[0].map((h) => String(h).trim());
  const col = (name: string) => head.indexOf(name);
  const [cF, cC, cV, cE, cS, cL] = ["fecha", "usd_compra", "usd_venta", "eur_venta", "fuente", "leido_en"].map(col);
  if (cF < 0 || cV < 0) return [];
  return rows.slice(1)
    .map((r) => ({
      fecha: String(r[cF] ?? "").trim().slice(0, 10),
      usdCompra: cC < 0 ? null : num(r[cC]),
      usdVenta: num(r[cV]) ?? 0,
      eurVenta: cE < 0 ? null : num(r[cE]),
      fuente: cS < 0 ? "" : String(r[cS] ?? "").trim(),
      leidoEn: cL < 0 ? "" : String(r[cL] ?? "").trim(),
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) && r.usdVenta > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Sin elección explícita, manual solo si el usuario ya había cambiado el 3.50 (ADR-012 §5). */
export function fxModo(a: Record<string, string>): FxModo {
  const m = (a["fx.modo"] ?? "").trim().toLowerCase();
  if (m === "auto" || m === "manual") return m;
  const v = num(a["fx.usd_pen"]);
  return v != null && v !== FX_DEFAULT ? "manual" : "auto";
}

/** Venta USD del día de `fecha` (ISO o YYYY-MM-DD) o del último anterior con dato; el primero si es más antigua. */
export function usdOn(tabla: FxRow[], fecha: string): number | null {
  if (!tabla.length) return null;
  const d = fecha.slice(0, 10);
  let lo = 0, hi = tabla.length - 1, hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tabla[mid].fecha <= d) { hit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return tabla[hit < 0 ? 0 : hit].usdVenta;
}

export function fxContext(a: Record<string, string>, tabla: FxRow[]): FxContext {
  const modo = fxModo(a);
  const manual = num(a["fx.usd_pen"]) ?? FX_DEFAULT;
  const ultimo = tabla.length ? tabla[tabla.length - 1] : null;
  return { modo, ultimo, respaldo: modo === "manual" || !ultimo ? manual : ultimo.usdVenta };
}

/** Pone `tcAuto` (venta BCRP de su día) a los USD sin TC del correo; en modo manual lo quita. */
export function applyFx(txs: Tx[], tabla: FxRow[], ctx: FxContext): Tx[] {
  return txs.map((t) => {
    const tcAuto = ctx.modo === "auto" && t.moneda === "USD" && !t.tipoCambio ? usdOn(tabla, t.fecha) : null;
    return (t.tcAuto ?? null) === tcAuto ? t : { ...t, tcAuto };
  });
}

/** Etiqueta del origen del TC con que se muestra un movimiento en USD (fila de Movimientos). */
export function tcLabel(t: Tx, respaldo: number): { tc: number; origen: "correo" | "del día" | "Ajustes" } {
  if (t.tipoCambio) return { tc: t.tipoCambio, origen: "correo" };
  if (t.tcAuto) return { tc: t.tcAuto, origen: "del día" };
  return { tc: respaldo, origen: "Ajustes" };
}

export type FxInfo = { venta: number; fecha: string; fuente: string; atribucion: boolean } | null;

/** Lo que muestra Ajustes en modo automático: último dato y de dónde salió (open.er-api exige atribución). */
export function fxInfo(ctx: FxContext): FxInfo {
  const u = ctx.ultimo;
  if (!u) return null;
  const fecha = new Date(`${u.fecha}T12:00:00-05:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" });
  const er = u.fuente === "er-api";
  return { venta: u.usdVenta, fecha, fuente: er ? "tipo medio de mercado" : "BCRP · sistema bancario SBS (venta)", atribucion: er };
}
