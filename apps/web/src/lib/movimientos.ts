/**
 * Lógica de las páginas Movimientos y Agregar: filtros (URL ↔ estado), contadores por tipo, chips de filtros
 * activos, total filtrado y helpers del formulario manual (monto, atajos de fecha). Lógica pura, sin React.
 */
import { filterTxs, monthLabel, monthOf, toBase, type Tx } from "./ledger.ts";
import { prevDay } from "./dias.ts";

export type Filters = { tipo: string; fuente: string; categoria: string; q: string; mes: string };
export const FILTER_KEYS = ["tipo", "fuente", "categoria", "q", "mes"] as const;
export const EMPTY_FILTERS: Filters = { tipo: "", fuente: "", categoria: "", q: "", mes: "" };
export const PENDING = "__pending__";

/** Lee los filtros de la URL (cualquier objeto con `get`, p. ej. URLSearchParams). */
export function parseFilters(params: { get(k: string): string | null }): Filters {
  const f = { ...EMPTY_FILTERS };
  FILTER_KEYS.forEach((k) => { f[k] = params.get(k) ?? ""; });
  return f;
}

/** Query string (sin "?") con los filtros no vacíos, en orden estable. */
export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  FILTER_KEYS.forEach((k) => { if (f[k]) p.set(k, f[k]); });
  return p.toString();
}

export const hasFilters = (f: Filters) => FILTER_KEYS.some((k) => !!f[k]);

/** Cuántos filtros de "Más filtros" (mes, fuente, categoría) están activos. */
export const moreFiltersCount = (f: Filters) => [f.mes, f.fuente, f.categoria].filter(Boolean).length;

/** Chips de tipo, en orden de lectura. `""` = todos. */
export const TIPO_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer_in", label: "Recibido por Yape" },
  { value: "internal_transfer", label: "Entre cuentas" },
];

/** Filtra (mes + filtros de ledger) y ordena del más reciente al más antiguo. */
export function applyFilters(txs: Tx[], f: Filters): Tx[] {
  const base = f.mes ? txs.filter((t) => monthOf(t.fecha) === f.mes) : txs;
  return filterTxs(base, f).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/**
 * Contadores de los chips de tipo: aplican todos los filtros salvo el tipo, para que cada chip diga cuántos
 * verías al elegirlo. `""` es el total.
 */
export function countByTipo(txs: Tx[], f: Filters): Record<string, number> {
  const list = applyFilters(txs, { ...f, tipo: "" });
  const out: Record<string, number> = { "": list.length };
  TIPO_CHIPS.forEach((c) => { if (c.value) out[c.value] = 0; });
  list.forEach((t) => { out[t.tipo] = (out[t.tipo] ?? 0) + 1; });
  return out;
}

/** Suma en soles de los gastos de la lista (redondeada a céntimos). */
export function expenseTotal(txs: Tx[], usdRate: number): number {
  return Math.round(txs.filter((t) => t.tipo === "expense").reduce((s, t) => s + toBase(t, usdRate), 0) * 100) / 100;
}

/** "1 movimiento" / "N movimientos". */
export const countLabel = (n: number) => `${n} ${n === 1 ? "movimiento" : "movimientos"}`;

export type ActiveChip = { key: keyof Filters; label: string };

/** Filtros activos como chips descartables ("Gastos", "Oct 2026", "BCP email", "Por categorizar", "“plaza”"). */
export function activeFilterChips(f: Filters, srcLabel: Record<string, string> = {}): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.q.trim()) out.push({ key: "q", label: `“${f.q.trim()}”` });
  if (f.tipo) out.push({ key: "tipo", label: TIPO_CHIPS.find((c) => c.value === f.tipo)?.label ?? f.tipo });
  if (f.mes) out.push({ key: "mes", label: /^\d{4}-\d{2}$/.test(f.mes) ? monthLabel(f.mes) : f.mes });
  if (f.fuente) out.push({ key: "fuente", label: srcLabel[f.fuente] ?? f.fuente });
  if (f.categoria) out.push({ key: "categoria", label: f.categoria === PENDING ? "Por categorizar" : f.categoria });
  return out;
}

/** Meses con movimientos (YYYY-MM), del más reciente al más antiguo. */
export const monthsOf = (txs: Tx[]) => Array.from(new Set(txs.map((t) => monthOf(t.fecha)))).sort().reverse();

/** Fuentes presentes, ordenadas. */
export const fuentesOf = (txs: Tx[]) => Array.from(new Set(txs.map((t) => t.fuente).filter(Boolean))).sort();

/** Se puede marcar como transferencia: gasto que no sea ya un yapeo categorizado como Transferencias. */
export function canMarkTransfer(t: Tx, plan: { kind: string }): boolean {
  return t.tipo === "expense" && !(plan.kind === "category" && t.categoria === "Transferencias");
}

/**
 * Texto del input de monto → número. Acepta "12,50", "12.50", "1,234.50" y "1.234,50". Vacío o inválido → NaN.
 */
export function parseAmount(s: string): number {
  const v = s.replace(/\s|S\/|\$/g, "");
  if (!v) return NaN;
  let norm = v;
  if (v.includes(",") && v.includes(".")) norm = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  else if (v.includes(",")) norm = v.replace(",", ".");
  return /^\d*\.?\d+$|^\d+\.$/.test(norm) ? parseFloat(norm) : NaN;
}

/** Limpia lo que se teclea en el monto: solo dígitos y separadores, máx. 2 decimales tras el último separador. */
export function sanitizeAmountInput(s: string): string {
  const v = s.replace(/[^\d.,]/g, "");
  const m = /^(.*[.,])(\d*)$/.exec(v);
  return m ? m[1] + m[2].slice(0, 2) : v;
}

/** Atajos de fecha del formulario manual. */
export const quickDates = (today: string) => ({ hoy: today, ayer: prevDay(today) });

/** Orden de los campos para enfocar el primer error de `validateManual`. */
export const MANUAL_FIELD_ORDER = ["tipo", "monto", "moneda", "comercio", "fecha"] as const;
export const firstError = (errs: Record<string, string>) => MANUAL_FIELD_ORDER.find((k) => errs[k]) ?? null;
