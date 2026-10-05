/**
 * Presentación de categorías: color estable por categoría, las más usadas (chips de categorización rápida)
 * y sugerencia por comercio o persona ya categorizados. Lógica pura, sin React (DESIGN.md §Colors).
 */
import { txLabel, type Tx } from "./ledger.ts";

/** Variables CSS de los pasteles de categoría (globals.css). */
export const CAT_PALETTE = ["--cat-peach", "--cat-mint", "--cat-blue", "--cat-lavender", "--cat-gold", "--cat-rose", "--cat-sand", "--cat-teal"] as const;

/** Color fijo para la taxonomía por defecto (DEFAULT_CATEGORIAS); las demás caen al hash. */
const FIXED: Record<string, (typeof CAT_PALETTE)[number]> = {
  Vivienda: "--cat-sand", Supermercado: "--cat-mint", "Comidas fuera": "--cat-peach", Transporte: "--cat-teal",
  Servicios: "--cat-gold", Suscripciones: "--cat-lavender", Salud: "--cat-rose", "Educación": "--cat-blue",
  Ropa: "--cat-rose", Ocio: "--cat-peach", Transferencias: "--cat-blue", Otros: "--cat-sand", Ingreso: "--cat-mint",
};

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** Nombre de la variable CSS del color de una categoría ("" o "Sin categoría" → --cat-none). */
export function catVar(categoria: string): string {
  if (!categoria || categoria === "Sin categoría") return "--cat-none";
  return FIXED[categoria] ?? CAT_PALETTE[hash(categoria) % CAT_PALETTE.length];
}

/** `var(--cat-…)` listo para `style`. */
export const catColor = (categoria: string) => `var(${catVar(categoria)})`;

/** Inicial para el avatar de un movimiento. */
export function txInitial(tx: Tx): string {
  if (tx.tipo === "internal_transfer") return "⇄";
  const s = txLabel(tx).replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]+/, "");
  return (s[0] ?? "·").toUpperCase();
}

/**
 * Las `n` categorías más usadas en los movimientos categorizados (gastos e ingresos), en orden de uso.
 * Solo incluye categorías vigentes; si faltan, completa con las primeras de la lista del usuario.
 */
export function topCategories(txs: Tx[], categorias: string[], n = 4): string[] {
  const valid = new Set(categorias);
  const count = new Map<string, number>();
  txs.forEach((t) => { if (t.categoria && valid.has(t.categoria) && t.categoria !== "Ingreso") count.set(t.categoria, (count.get(t.categoria) ?? 0) + 1); });
  const ranked = Array.from(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  for (const c of categorias) { if (ranked.length >= n) break; if (c !== "Ingreso" && !ranked.includes(c)) ranked.push(c); }
  return ranked.slice(0, n);
}

/**
 * Categoría sugerida para un pendiente: la más reciente asignada a otro movimiento del mismo comercio
 * o de la misma persona (`contraparte_key`, si no el nombre). Sin coincidencias → null. Sin LLM (ADR-004).
 */
export function suggestCategory(tx: Tx, txs: Tx[]): string | null {
  const key = (t: Tx) => (t.comercio ? `c:${t.comercio.trim().toLowerCase()}` : t.contraparteKey ? `k:${t.contraparteKey}` : t.contraparte ? `p:${t.contraparte.trim().toLowerCase()}` : "");
  const k = key(tx);
  if (!k) return null;
  const hit = txs.filter((t) => t.id !== tx.id && t.categoria && key(t) === k).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
  return hit ? hit.categoria : null;
}
