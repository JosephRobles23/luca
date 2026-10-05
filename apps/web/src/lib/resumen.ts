/**
 * Lógica del Resumen (/app): meses disponibles y navegación ‹ ›, delta vs mes anterior, textos de la barra de
 * ritmo, filtros de "Movimientos del mes", escala del gráfico de 6 meses y enlaces a Movimientos.
 * Pura y sin React (DESIGN.md §Components · Gasto del mes).
 */
import { lastMonths, monthOf, type Tx } from "./ledger.ts";
import type { DayGroup, Pace } from "./dias.ts";

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Primer nombre para el saludo; sin nombre, la parte local del correo; sin nada, "". */
export function firstName(name: string, email = ""): string {
  const n = (name || "").trim().split(/\s+/)[0];
  if (n) return n;
  return (email.split("@")[0] ?? "").trim();
}

/** "octubre" (mismo año que `today`) u "octubre 2025". */
export function monthName(month: string, today: string): string {
  const [y, m] = month.split("-");
  const name = MESES_LARGOS[Number(m) - 1] ?? month;
  return y === today.slice(0, 4) ? name : `${name} ${y}`;
}

/** "Octubre 2026" para la lista del selector. */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-");
  const name = MESES_LARGOS[Number(m) - 1] ?? month;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

/**
 * Meses que ofrece el selector, del más reciente al más antiguo: los que tienen movimientos más los últimos
 * 3 hasta `current` (para poder mirar un mes vacío reciente) y `include` (el mes elegido, aunque no tenga datos:
 * se llega a él desde las barras de 6 meses). Nunca meses posteriores a `current`.
 */
export function monthOptions(txs: Tx[], current: string, include?: string): string[] {
  const set = new Set(txs.map((t) => monthOf(t.fecha)).filter((m) => /^\d{4}-\d{2}$/.test(m) && m <= current));
  lastMonths(current, 3).forEach((m) => set.add(m));
  if (include) set.add(include);
  return Array.from(set).sort().reverse();
}

/**
 * Mes vecino en `months` (orden descendente): `-1` = anterior (más antiguo), `1` = siguiente (más reciente).
 * null si no hay más en esa dirección.
 */
export function stepMonth(months: string[], month: string, dir: -1 | 1): string | null {
  const asc = months.slice().sort();
  const i = asc.indexOf(month);
  if (i < 0) return null;
  return asc[i + dir] ?? null;
}

export type Delta = { pct: number; dir: "up" | "down" | "same" };

/** Variación del gasto vs el mes anterior en % entero. null si el mes anterior no tuvo gasto. */
export function deltaVsPrev(expense: number, prevExpense: number): Delta | null {
  if (!(prevExpense > 0)) return null;
  const pct = Math.round(((expense - prevExpense) / prevExpense) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? "up" : pct < 0 ? "down" : "same" };
}

/** Leyenda de la barra de ritmo: a la izquierda cuánto llevas, a la derecha dónde va el mes. */
export function paceLegend(p: Pace, prevName: string): { left: string; right: string } {
  const right = p.closed ? `${p.days} de ${p.days} días` : p.day === 0 ? "El mes aún no empieza" : `Día ${p.day} de ${p.days} · la marca es hoy`;
  if (p.spentPct == null) return { left: `Sin gasto en ${prevName} con qué comparar`, right };
  if (p.closed) return { left: `Mes cerrado · ${p.spentPct} % de lo gastado en ${prevName}`, right };
  return { left: `${p.spentPct} % de lo gastado en ${prevName}`, right };
}

/* ---------- movimientos del mes ---------- */

export type MovFilter = "all" | "consumo" | "transferencia" | "pendiente";

/**
 * Clase de un movimiento para los chips: transferencia = entre cuentas, Yape recibido, pago a una persona
 * (sin comercio, con contraparte: yapeos, Plin) o categoría "Transferencias"; consumo = el resto de gastos.
 * Ingresos y rechazados no son ni lo uno ni lo otro (solo aparecen en "Todos").
 */
export function movementKind(t: Tx): "consumo" | "transferencia" | "otro" {
  if (t.tipo === "internal_transfer" || t.tipo === "transfer_in") return "transferencia";
  if (t.tipo !== "expense") return "otro";
  if (t.categoria === "Transferencias" || (!t.comercio && !!t.contraparte)) return "transferencia";
  return "consumo";
}

const matches = (t: Tx, f: MovFilter) =>
  f === "all" ? true : f === "pendiente" ? t.tipo === "expense" && !t.categoria : movementKind(t) === f;

/** Filtra los movimientos del mes según el chip elegido (conserva el orden). */
export function filterMovements(txs: Tx[], f: MovFilter): Tx[] {
  return txs.filter((t) => matches(t, f));
}

/** Contador de cada chip. */
export function movementCounts(txs: Tx[]): Record<MovFilter, number> {
  const out: Record<MovFilter, number> = { all: 0, consumo: 0, transferencia: 0, pendiente: 0 };
  txs.forEach((t) => { (["all", "consumo", "transferencia", "pendiente"] as MovFilter[]).forEach((f) => { if (matches(t, f)) out[f]++; }); });
  return out;
}

/**
 * Recorta los grupos por día a `limit` movimientos en total (sin partir un día a medias salvo el primero),
 * para que el Resumen no pinte meses enteros: el resto está en "Ver todos".
 */
export function capGroups(groups: DayGroup[], limit: number): { groups: DayGroup[]; shown: number; total: number } {
  const total = groups.reduce((s, g) => s + g.txs.length, 0);
  const out: DayGroup[] = [];
  let shown = 0;
  for (const g of groups) {
    if (shown >= limit) break;
    if (out.length && shown + g.txs.length > limit) break;
    const txs = g.txs.slice(0, limit);
    out.push(txs.length === g.txs.length ? g : { ...g, txs });
    shown += txs.length;
  }
  return { groups: out, shown, total };
}

/* ---------- últimos 6 meses ---------- */

/**
 * Promedio mensual de gasto en la ventana: desde el primer mes con gasto hasta el último de la ventana
 * (los meses previos a que existieran datos no bajan el promedio). null si no hay gasto en ninguno.
 */
export function sixMonthAverage(last6: { month: string; expense: number }[]): number | null {
  const first = last6.findIndex((d) => d.expense > 0);
  if (first < 0) return null;
  const xs = last6.slice(first);
  return Math.round((xs.reduce((s, d) => s + d.expense, 0) / xs.length) * 100) / 100;
}

/** Techo "redondo" del eje (1, 1.5, 2, 2.5, 3, 4, 5, 7.5 × 10^k) para que las marcas sean legibles. */
export function niceMax(n: number): number {
  if (!(n > 0)) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((s) => s * p >= n) ?? 10;
  return step * p;
}

/** Cifra corta para etiquetas del gráfico: "102", "1.48k", "12.5k", "0". */
export function shortAmount(n: number): string {
  if (!n) return "0";
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const k = n / 1000;
  const s = Math.abs(k) >= 100 ? k.toFixed(0) : Math.abs(k) >= 10 ? k.toFixed(1) : k.toFixed(2);
  return `${s.replace(/\.?0+$/, "")}k`;
}

/* ---------- enlaces a Movimientos ---------- */

/** Movimientos de una categoría en el mes ("Sin categoría" → pendientes). */
export function categoryHref(name: string, month: string): string {
  const c = !name || name === "Sin categoría" ? "__pending__" : name;
  return `/app/movimientos?categoria=${encodeURIComponent(c)}&mes=${month}`;
}

/** Movimientos de un comercio o persona en el mes (búsqueda por texto). */
export function merchantHref(name: string, month: string): string {
  return `/app/movimientos?q=${encodeURIComponent(name)}&mes=${month}`;
}

/** Línea secundaria de un pendiente: "01 oct · BCP email". */
export function pendingMeta(t: Tx, srcLabel: (fuente: string) => string): string {
  const [, m, d] = t.fecha.slice(0, 10).split("-");
  const mes = MESES_LARGOS[Number(m) - 1]?.slice(0, 3) ?? "";
  return `${d} ${mes} · ${srcLabel(t.fuente)}`;
}
