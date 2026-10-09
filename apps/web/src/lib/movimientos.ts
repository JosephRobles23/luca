/**
 * Lógica de las páginas Movimientos y Agregar: filtros (URL ↔ estado), contadores por tipo, chips de filtros
 * activos, total filtrado y helpers del formulario manual (monto, atajos de fecha). Lógica pura, sin React.
 */
import { filterTxs, monthLabel, monthOf, toBase, type Tx } from "./ledger.ts";
import { prevDay } from "./dias.ts";
import { rangeLabel } from "./periodo.ts";

/** `mes` ("YYYY-MM") y el rango `desde`/`hasta` ("YYYY-MM-DD", inclusivo) son el periodo: uno u otro, nunca ambos. */
export type Filters = { tipo: string; fuente: string; categoria: string; q: string; mes: string; desde: string; hasta: string };
export const FILTER_KEYS = ["tipo", "fuente", "categoria", "q", "mes", "desde", "hasta"] as const;
export const EMPTY_FILTERS: Filters = { tipo: "", fuente: "", categoria: "", q: "", mes: "", desde: "", hasta: "" };
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

/** Cuántos filtros de "Más filtros" (fuente, categoría) están activos; el periodo tiene su propio selector. */
export const moreFiltersCount = (f: Filters) => [f.fuente, f.categoria].filter(Boolean).length;

/** Patch de filtros para un periodo: un mes, un rango (ordenado) o, vacío, todos los meses. */
export function setPeriod(p: { mes?: string; desde?: string; hasta?: string }): Pick<Filters, "mes" | "desde" | "hasta"> {
  if (p.mes) return { mes: p.mes, desde: "", hasta: "" };
  const [desde, hasta] = p.desde && p.hasta && p.desde > p.hasta ? [p.hasta, p.desde] : [p.desde ?? "", p.hasta ?? ""];
  return { mes: "", desde, hasta };
}

/** Chips de tipo, en orden de lectura. `""` = todos. */
export const TIPO_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
  { value: "transfer_in", label: "Recibido por Yape" },
  { value: "internal_transfer", label: "Entre cuentas" },
];

/** Filtra (periodo + filtros de ledger) y ordena del más reciente al más antiguo. */
export function applyFilters(txs: Tx[], f: Filters): Tx[] {
  const day = (t: Tx) => t.fecha.slice(0, 10);
  const base = txs.filter((t) => (!f.mes || monthOf(t.fecha) === f.mes) && (!f.desde || day(t) >= f.desde) && (!f.hasta || day(t) <= f.hasta));
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

/** Chip de filtro activo; `clear` es el patch que lo quita (por defecto, vaciar `key`). */
export type ActiveChip = { key: keyof Filters; label: string; clear?: Partial<Filters> };

/** Filtros activos como chips descartables ("Gastos", "Oct 2026", "BCP email", "Por categorizar", "“plaza”"). */
export function activeFilterChips(f: Filters, srcLabel: Record<string, string> = {}): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.q.trim()) out.push({ key: "q", label: `“${f.q.trim()}”` });
  if (f.tipo) out.push({ key: "tipo", label: TIPO_CHIPS.find((c) => c.value === f.tipo)?.label ?? f.tipo });
  if (f.mes) out.push({ key: "mes", label: /^\d{4}-\d{2}$/.test(f.mes) ? monthLabel(f.mes) : f.mes });
  if (f.desde || f.hasta) out.push({ key: "desde", label: rangeLabel(f.desde, f.hasta), clear: { desde: "", hasta: "" } });
  if (f.fuente) out.push({ key: "fuente", label: srcLabel[f.fuente] ?? f.fuente });
  if (f.categoria) out.push({ key: "categoria", label: f.categoria === PENDING ? "Por categorizar" : f.categoria });
  return out;
}

/** Filas por página en la lista ("Mostrar más" suma otra página). */
export const PAGE_SIZE = 40;

export type Sort = "fecha" | "monto";

/** Orden de la lista: más recientes primero, o mayor monto en soles primero (empate: más reciente). */
export function sortTxs(txs: Tx[], sort: Sort, usdRate: number): Tx[] {
  const byDate = (a: Tx, b: Tx) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
  return txs.slice().sort(sort === "monto" ? (a, b) => toBase(b, usdRate) - toBase(a, usdRate) || byDate(a, b) : byDate);
}

export type FilterTotals = { expense: number; expenseCount: number; income: number; incomeCount: number; yape: number; yapeCount: number };

/** Totales de lo filtrado para la banda de Movimientos. Entre cuentas no suma en ningún lado. */
export function filterTotals(txs: Tx[], usdRate: number): FilterTotals {
  const of = (tipo: string) => txs.filter((t) => t.tipo === tipo);
  const sum = (xs: Tx[]) => Math.round(xs.reduce((s, t) => s + toBase(t, usdRate), 0) * 100) / 100;
  const e = of("expense"), i = of("income"), y = of("transfer_in");
  return { expense: sum(e), expenseCount: e.length, income: sum(i), incomeCount: i.length, yape: sum(y), yapeCount: y.length };
}

/** Mes de las barras de la banda: el filtrado, el del final del rango, o el de hoy. */
export const barsMonth = (f: Filters, today: string) =>
  (/^\d{4}-\d{2}$/.test(f.mes) ? f.mes : /^\d{4}-\d{2}-\d{2}$/.test(f.hasta) ? f.hasta.slice(0, 7) : today.slice(0, 7));

/**
 * Gasto por día de `month` dentro de lo filtrado, sin Vivienda (el alquiler aplastaría el resto). `future` marca
 * los días que aún no pasan en el mes en curso.
 */
export function dailyBars(txs: Tx[], month: string, today: string, usdRate: number): { day: number; amount: number; future: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: 0, future: month === today.slice(0, 7) && i + 1 > Number(today.slice(8, 10)) }));
  txs.forEach((t) => {
    if (t.tipo !== "expense" || monthOf(t.fecha) !== month || t.categoria === "Vivienda") return;
    const d = Number(t.fecha.slice(8, 10));
    if (d >= 1 && d <= days) out[d - 1].amount += toBase(t, usdRate);
  });
  return out.map((b) => ({ ...b, amount: Math.round(b.amount * 100) / 100 }));
}

/** Texto partido para resaltar la búsqueda (sin acentos ni mayúsculas): `[antes, coincidencia, después]` o `null`. */
export function highlightParts(text: string, q: string): [string, string, string] | null {
  const needle = fold(q.trim());
  if (!needle || !text) return null;
  const i = fold(text).indexOf(needle);
  if (i < 0) return null;
  return [text.slice(0, i), text.slice(i, i + needle.length), text.slice(i + needle.length)];
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
