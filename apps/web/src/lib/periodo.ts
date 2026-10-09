/**
 * Selector de periodo de Movimientos (DESIGN.md §Components · Selector de periodo): cuadrícula del calendario,
 * meses agrupados por año y etiquetas del periodo ("Todos los meses", "Octubre 2026", "15 sep – 4 oct 2026").
 * Lógica pura, sin React. Fechas como "YYYY-MM-DD" y meses como "YYYY-MM" (hora de Lima, como `Tx.fecha`).
 */
import { daysInMonth } from "./dias.ts";
import { monthTitle } from "./resumen.ts";

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Semanas del mes de lunes a domingo; `null` en los huecos antes del día 1 y después del último. */
export function monthMatrix(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth(month); d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/** "YYYY-MM" desplazado `n` meses. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

/** Meses con datos agrupados por año: años del más reciente al más antiguo, meses de enero a diciembre. */
export function monthsByYear(months: string[]): { year: string; months: string[] }[] {
  const by = new Map<string, string[]>();
  months.slice().sort().forEach((m) => { const y = m.slice(0, 4); by.set(y, [...(by.get(y) ?? []), m]); });
  return Array.from(by, ([year, ms]) => ({ year, months: ms })).sort((a, b) => b.year.localeCompare(a.year));
}

/** Nombre corto del mes en minúsculas ("oct"). */
export const shortMonth = (month: string) => MESES_CORTOS[Number(month.slice(5, 7)) - 1] ?? month;

const dayParts = (ymd: string) => ({ d: Number(ymd.slice(8, 10)), m: shortMonth(ymd.slice(0, 7)), y: ymd.slice(0, 4) });

/** "1 – 15 oct 2026", "15 sep – 4 oct 2026", "20 dic 2025 – 5 ene 2026"; con un extremo abierto, "Desde el…" / "Hasta el…". */
export function rangeLabel(desde: string, hasta: string): string {
  const full = (ymd: string) => { const p = dayParts(ymd); return `${p.d} ${p.m} ${p.y}`; };
  if (desde && !hasta) return `Desde el ${full(desde)}`;
  if (!desde && hasta) return `Hasta el ${full(hasta)}`;
  if (!desde) return "";
  if (desde === hasta) return full(desde);
  const a = dayParts(desde), b = dayParts(hasta);
  if (a.y !== b.y) return `${full(desde)} – ${full(hasta)}`;
  if (a.m !== b.m) return `${a.d} ${a.m} – ${full(hasta)}`;
  return `${a.d} – ${full(hasta)}`;
}

/** Etiqueta del botón de periodo. */
export function periodLabel(f: { mes: string; desde: string; hasta: string }): string {
  if (f.desde || f.hasta) return rangeLabel(f.desde, f.hasta);
  if (/^\d{4}-\d{2}$/.test(f.mes)) return monthTitle(f.mes);
  return "Todos los meses";
}
