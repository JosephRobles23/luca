/**
 * Series de los gráficos del Resumen (DESIGN.md §Components · Ritmo del mes, Perfil de gasto, KPIs): gasto por día,
 * acumulado contra el mes anterior, proyección, radar por categoría y series de 6 meses. Lógica pura, sin React ni
 * ECharts: los componentes solo convierten esto en opciones de gráfico.
 */
import { lastMonths, monthOf, toBase, type Tx } from "./ledger.ts";
import { daysInMonth } from "./dias.ts";

/** Gasto fijo que se excluye de las barras diarias, la proyección y el radar (aplastaría al resto). */
export const FIXED_CATEGORY = "Vivienda";

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (iso: string) => Number(iso.slice(8, 10));
const expensesOf = (txs: Tx[], month: string) => txs.filter((t) => t.tipo === "expense" && monthOf(t.fecha) === month);

/** Último día con datos del mes: hoy si es el mes en curso, todos si ya cerró, 0 si es futuro. */
export function lastDayOf(month: string, today: string): number {
  const cur = today.slice(0, 7);
  if (month < cur) return daysInMonth(month);
  if (month > cur) return 0;
  return dayOf(today);
}

/** Gasto por día del mes en soles (índice 0 = día 1). `withFixed: false` quita el gasto fijo. */
export function dailySpend(txs: Tx[], month: string, usdRate: number, withFixed = true): number[] {
  const out = Array.from({ length: daysInMonth(month) }, () => 0);
  expensesOf(txs, month).forEach((t) => {
    if (!withFixed && t.categoria === FIXED_CATEGORY) return;
    const d = dayOf(t.fecha);
    if (d >= 1 && d <= out.length) out[d - 1] += toBase(t, usdRate);
  });
  return out.map(r2);
}

/** Acumulado día a día; `null` desde `upTo + 1` (días que aún no pasan). */
export function cumulative(daily: number[], upTo = daily.length): (number | null)[] {
  let acc = 0;
  return daily.map((v, i) => (i < upTo ? r2((acc += v)) : null));
}

/**
 * Gastos de un día concreto (`month` + `day`, fecha completa) sin el gasto fijo, de mayor a menor monto: los `limit`
 * primeros y cuántos quedan fuera (tooltip de las barras diarias).
 */
export function dayExpenses(txs: Tx[], month: string, day: number, usdRate: number, limit = 4): { top: { tx: Tx; amount: number }[]; rest: number } {
  const ymd = `${month}-${String(day).padStart(2, "0")}`;
  const all = txs
    .filter((t) => t.tipo === "expense" && t.fecha.slice(0, 10) === ymd && t.categoria !== FIXED_CATEGORY)
    .map((tx) => ({ tx, amount: r2(toBase(tx, usdRate)) }))
    .sort((a, b) => b.amount - a.amount);
  return { top: all.slice(0, limit), rest: Math.max(0, all.length - limit) };
}

export type Ritmo = {
  month: string;
  days: number;
  /** Último día con datos (hoy en el mes en curso). */
  lastDay: number;
  /** Gasto de cada día sin el gasto fijo (barras). */
  daily: number[];
  /** Acumulado del mes con todo el gasto. */
  cum: (number | null)[];
  /** Acumulado del mes anterior, alineado por día (más corto si ese mes tuvo menos días). */
  prevCum: (number | null)[];
  /** Proyección lineal a fin de mes (solo mes en curso); `null` antes de hoy. */
  projection: (number | null)[];
  fixed: number;
  avgDaily: number;
  projectionEnd: number | null;
  maxDay: { day: number; amount: number } | null;
  spentDays: number;
};

/** Ritmo del mes: acumulado contra el mes anterior, proyección sin el gasto fijo y datos de apoyo. */
export function ritmoMes(txs: Tx[], month: string, today: string, usdRate: number): Ritmo {
  const days = daysInMonth(month);
  const lastDay = lastDayOf(month, today);
  const all = dailySpend(txs, month, usdRate, true);
  const daily = dailySpend(txs, month, usdRate, false);
  const fixed = r2(expensesOf(txs, month).filter((t) => t.categoria === FIXED_CATEGORY).reduce((s, t) => s + toBase(t, usdRate), 0));
  const cum = cumulative(all, lastDay);
  const prevMonth = lastMonths(month, 2)[0];
  const prevAll = dailySpend(txs, prevMonth, usdRate, true);
  const prevCum = cumulative(prevAll).concat(Array.from({ length: Math.max(0, days - prevAll.length) }, () => null)).slice(0, days);

  const variable = r2(daily.slice(0, lastDay).reduce((s, v) => s + v, 0));
  const current = lastDay > 0 && lastDay < days;
  const projection = Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return current && d >= lastDay ? r2(fixed + (variable / lastDay) * d) : null;
  });
  let maxDay: Ritmo["maxDay"] = null;
  daily.slice(0, lastDay).forEach((v, i) => { if (v > 0 && (!maxDay || v > maxDay.amount)) maxDay = { day: i + 1, amount: v }; });
  return {
    month, days, lastDay, daily, cum, prevCum, projection, fixed,
    avgDaily: lastDay ? r2(variable / lastDay) : 0,
    projectionEnd: current ? projection[days - 1] : null,
    maxDay,
    spentDays: daily.slice(0, lastDay).filter((v) => v > 0).length,
  };
}

/**
 * Variación del gasto contra el mes anterior **al mismo día** (justo para un mes en curso). Porcentaje entero;
 * null si el mes anterior no tuvo gasto hasta ese día.
 */
export function deltaAlDia(txs: Tx[], month: string, today: string, usdRate: number): { pct: number; day: number; closed: boolean } | null {
  const day = lastDayOf(month, today);
  const closed = day === daysInMonth(month);
  const sum = (m: string, upTo: number) => dailySpend(txs, m, usdRate).slice(0, upTo).reduce((s, v) => s + v, 0);
  const prevMonth = lastMonths(month, 2)[0];
  const prev = sum(prevMonth, closed ? daysInMonth(prevMonth) : day);
  if (prev <= 0) return null;
  return { pct: Math.round(((sum(month, day) - prev) / prev) * 100), day, closed };
}

export type RadarUnit = "pen" | "pct";
export type RadarSerie = { key: "cur" | "prev" | "avg"; values: number[] };

/** Gasto por categoría de un mes (sin el gasto fijo), en soles o en % del gasto de ese mes. */
function byCategory(txs: Tx[], month: string, usdRate: number, unit: RadarUnit): Map<string, number> {
  const m = new Map<string, number>();
  let total = 0;
  expensesOf(txs, month).forEach((t) => {
    if (t.categoria === FIXED_CATEGORY) return;
    const v = toBase(t, usdRate);
    total += v;
    const k = t.categoria || "Sin categoría";
    m.set(k, (m.get(k) ?? 0) + v);
  });
  m.forEach((v, k) => m.set(k, r2(unit === "pct" ? (total ? (v / total) * 100 : 0) : v)));
  return m;
}

/**
 * Radar "Perfil de gasto": este mes, el anterior y el promedio de los 3 anteriores sobre las mismas categorías
 * (las `n` con más gasto en esos 4 meses, sin el gasto fijo). Una sola escala para todos los ejes.
 */
export function radarData(txs: Tx[], month: string, usdRate: number, unit: RadarUnit, n = 8): { cats: string[]; series: RadarSerie[]; max: number } {
  const months = lastMonths(month, 4);
  const maps = months.map((m) => byCategory(txs, m, usdRate, unit));
  const weight = new Map<string, number>();
  const raw = months.map((m) => byCategory(txs, m, usdRate, "pen"));
  raw.forEach((mp) => mp.forEach((v, k) => weight.set(k, (weight.get(k) ?? 0) + v)));
  const cats = Array.from(weight).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
  const val = (mp: Map<string, number>) => cats.map((c) => mp.get(c) ?? 0);
  const cur = val(maps[3]);
  const prev = val(maps[2]);
  const avg = cats.map((c) => r2(maps.slice(0, 3).reduce((s, mp) => s + (mp.get(c) ?? 0), 0) / 3));
  const top = Math.max(0, ...cur, ...prev, ...avg);
  const step = unit === "pct" ? 5 : top > 600 ? 200 : top > 150 ? 50 : 10;
  return { cats, series: [{ key: "cur", values: cur }, { key: "prev", values: prev }, { key: "avg", values: avg }], max: Math.max(step, Math.ceil(top / step) * step) };
}

export type MonthTotals = { month: string; income: number; expense: number; net: number; yape: number };

/** Totales de cada uno de los 6 meses que terminan en `month` (minicurvas de los KPIs). */
export function sixMonthTotals(txs: Tx[], month: string, usdRate: number): MonthTotals[] {
  return lastMonths(month, 6).map((m) => {
    const inM = txs.filter((t) => monthOf(t.fecha) === m);
    const sum = (tipo: string) => r2(inM.filter((t) => t.tipo === tipo).reduce((s, t) => s + toBase(t, usdRate), 0));
    const income = sum("income"), expense = sum("expense");
    return { month: m, income, expense, net: r2(income - expense), yape: sum("transfer_in") };
  });
}

/** "1.2 k" para ejes; enteros por debajo de 1000. */
export const axisAmount = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} k` : String(Math.round(v)));
