/**
 * Fechas para la interfaz: agrupar movimientos por día ("Hoy · sáb 4 oct"), ritmo del mes y frescura del
 * escaneo. Lógica pura; las fechas de la Sheet vienen en ISO con offset de Lima.
 */
import { toBase, type Tx } from "./ledger.ts";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const dayOf = (iso: string) => iso.slice(0, 10);

/** Día anterior a `ymd` (YYYY-MM-DD). */
export function prevDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

/** "Hoy · sáb 4 oct", "Ayer · vie 3 oct" o "jue 2 oct" (con año si no es el de `today`). */
export function dayLabel(ymd: string, today: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${wd} ${d} ${MESES[m - 1]}${String(y) !== today.slice(0, 4) ? ` ${y}` : ""}`;
  if (ymd === today) return `Hoy · ${base}`;
  if (ymd === prevDay(today)) return `Ayer · ${base}`;
  return base;
}

export type DayGroup = { day: string; label: string; txs: Tx[]; expense: number };

/**
 * Agrupa por día (más reciente primero), conservando el orden recibido dentro de cada día.
 * `expense` = suma en soles de los gastos del día (lo que se muestra a la derecha del encabezado).
 */
export function groupByDay(txs: Tx[], today: string, usdRate: number): DayGroup[] {
  const map = new Map<string, Tx[]>();
  txs.forEach((t) => { const k = dayOf(t.fecha); map.set(k, [...(map.get(k) ?? []), t]); });
  return Array.from(map.keys()).sort().reverse().map((day) => {
    const list = map.get(day)!;
    const expense = Math.round(list.filter((t) => t.tipo === "expense").reduce((s, t) => s + toBase(t, usdRate), 0) * 100) / 100;
    return { day, label: dayLabel(day, today), txs: list, expense };
  });
}

/** Días del mes `YYYY-MM`. */
export const daysInMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

export type Pace = {
  /** Gasto del mes / gasto del mes anterior, 0..1 (tope 1). null si no hay mes anterior con gasto. */
  spentRatio: number | null;
  /** Porcentaje entero de lo anterior, sin tope (puede pasar de 100). */
  spentPct: number | null;
  /** Día de hoy / días del mes (1 si el mes ya cerró, 0 si es futuro). */
  dayRatio: number;
  day: number;
  days: number;
  closed: boolean;
};

/** Ritmo del mes para la barra del Resumen (DESIGN.md §Components · Gasto del mes). */
export function pace(month: string, expense: number, prevExpense: number, today: string): Pace {
  const days = daysInMonth(month);
  const cur = today.slice(0, 7);
  const closed = month < cur;
  const day = closed ? days : month > cur ? 0 : Number(today.slice(8, 10));
  const spentPct = prevExpense > 0 ? Math.round((expense / prevExpense) * 100) : null;
  return {
    spentRatio: prevExpense > 0 ? Math.min(1, expense / prevExpense) : null,
    spentPct, dayRatio: days ? day / days : 0, day, days, closed,
  };
}

/** Minutos desde `iso` hasta `now` (null si no es fecha). */
export function minutesSince(iso: string | undefined, now: number): number | null {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : null;
}

/** "Última lectura del correo hace 6 min · próxima en 9 min" (el escaneo corre cada 15 min). */
export function scanFreshness(lastRunAt: string | undefined, now: number, everyMin = 15): string {
  const m = minutesSince(lastRunAt, now);
  if (m == null) return "Tu script aún no ha leído el correo";
  const ago = m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 48 * 60 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
  if (m >= everyMin * 4) return `Última lectura del correo ${ago} · revisa tu script`;
  const next = Math.max(0, everyMin - (m % everyMin));
  return `Última lectura del correo ${ago} · próxima en ${next || everyMin} min`;
}
