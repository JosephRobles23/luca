/**
 * Lógica pura del dashboard: filas de `Movimientos` → transacciones → agregados.
 * Sin dependencias de React ni de Google, para poder testearla y reutilizarla en el modal de Sheets.
 */

export type Tx = {
  id: string;
  fecha: string;          // ISO con offset
  tipo: "expense" | "income" | "internal_transfer" | "rejected" | string;
  monto: number;
  moneda: string;
  tipoCambio: number | null;
  comercio: string;
  contraparte: string;
  categoria: string;
  medio: string;
  canal: string;
  fuente: string;
  flags: string[];
};

const NUM = (v: string) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

/** Convierte la matriz (fila 1 = encabezados) en transacciones tipadas. */
export function rowsToTxs(rows: string[][]): Tx[] {
  if (!rows.length) return [];
  const h = rows[0].map((x) => x.trim());
  const col = (name: string) => h.indexOf(name);
  const c = {
    id: col("id"), fecha: col("fecha"), tipo: col("tipo"), monto: col("monto"), moneda: col("moneda"), tc: col("tipo_cambio"),
    comercio: col("comercio"), contraparte: col("contraparte"), categoria: col("categoria"), medio: col("medio"), canal: col("canal"), fuente: col("fuente"), flags: col("flags"),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "") : "");
  return rows.slice(1).filter((r) => get(r, c.id)).map((r) => ({
    id: get(r, c.id),
    fecha: get(r, c.fecha),
    tipo: get(r, c.tipo),
    monto: NUM(get(r, c.monto)),
    moneda: get(r, c.moneda) || "PEN",
    tipoCambio: get(r, c.tc) ? NUM(get(r, c.tc)) : null,
    comercio: get(r, c.comercio),
    contraparte: get(r, c.contraparte),
    categoria: get(r, c.categoria),
    medio: get(r, c.medio),
    canal: get(r, c.canal),
    fuente: get(r, c.fuente),
    flags: get(r, c.flags) ? get(r, c.flags).split(",").filter(Boolean) : [],
  }));
}

/** Mes "YYYY-MM" en hora de Lima a partir del ISO con offset (la cadena ya viene en Lima). */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** Importe en moneda base. v0: USD → PEN con un tipo de cambio fijo configurable; el resto se asume PEN. */
export function toBase(tx: Tx, usdRate: number): number {
  if (tx.moneda === "USD") return tx.monto * (tx.tipoCambio || usdRate);
  return tx.monto;
}

export type Period = { month: string; usdRate?: number };

export type Summary = {
  month: string;
  income: number;
  expense: number;
  net: number;
  byCategory: { name: string; amount: number; pct: number }[];
  topMerchants: { name: string; amount: number; count: number }[];
  last6: { month: string; expense: number }[];
  pending: Tx[];
  movements: Tx[];
  prevExpense: number;
};

const label = (tx: Tx) => tx.comercio || tx.contraparte || (tx.canal === "yape_p2p" ? "Yapeo" : "—");

export function summarize(all: Tx[], p: Period): Summary {
  const usdRate = p.usdRate ?? 3.5;
  const inMonth = all.filter((t) => monthOf(t.fecha) === p.month);
  const expenses = inMonth.filter((t) => t.tipo === "expense");
  const incomes = inMonth.filter((t) => t.tipo === "income");
  const sum = (xs: Tx[]) => Math.round(xs.reduce((s, t) => s + toBase(t, usdRate), 0) * 100) / 100;

  const expense = sum(expenses);
  const income = sum(incomes);

  const cat = new Map<string, number>();
  expenses.forEach((t) => { const k = t.categoria || "Sin categoría"; cat.set(k, (cat.get(k) ?? 0) + toBase(t, usdRate)); });
  const byCategory = Array.from(cat, ([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100, pct: expense ? Math.round((amount / expense) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const mer = new Map<string, { amount: number; count: number }>();
  expenses.forEach((t) => { const k = label(t); const m = mer.get(k) ?? { amount: 0, count: 0 }; m.amount += toBase(t, usdRate); m.count++; mer.set(k, m); });
  const topMerchants = Array.from(mer, ([name, m]) => ({ name, amount: Math.round(m.amount * 100) / 100, count: m.count })).sort((a, b) => b.amount - a.amount).slice(0, 8);

  const months = lastMonths(p.month, 6);
  const last6 = months.map((m) => ({ month: m, expense: sum(all.filter((t) => t.tipo === "expense" && monthOf(t.fecha) === m)) }));
  const prevExpense = last6.length >= 2 ? last6[last6.length - 2].expense : 0;

  return {
    month: p.month, income, expense, net: Math.round((income - expense) * 100) / 100,
    byCategory, topMerchants, last6,
    pending: expenses.filter((t) => !t.categoria),
    movements: inMonth.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    prevExpense,
  };
}

/** ["2026-05", …, "2026-10"] terminando en `month`. */
export function lastMonths(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const monthLabel = (m: string) => { const [y, mm] = m.split("-"); return `${MESES_ES[Number(mm) - 1]} ${y}`; };
export const fmtPEN = (n: number) => "S/ " + n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const currentMonthLima = () => { const d = new Date(Date.now() - 5 * 3600 * 1000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
