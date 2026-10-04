"use client";

import { useMemo, useState } from "react";
import { currentMonthLima, fmtPEN, lastMonths, monthLabel, summarize, type Tx } from "@/lib/ledger";

const PALETTE = ["#d9623b", "#f08a5d", "#b54a2a", "#e8a07f", "#8f3a22", "#f3c2a9", "#6e2c1a", "#c9b8a8"];
const SRC: Record<string, string> = { bcp_email: "BCP email", yape_email: "Yape email", ios_push: "Yape push", manual: "Manual", ai_import: "IA" };

export default function Dashboard({ txs }: { txs: Tx[] }) {
  const [month, setMonth] = useState(currentMonthLima());
  const months = useMemo(() => {
    const set = new Set(txs.map((t) => t.fecha.slice(0, 7)).filter(Boolean));
    lastMonths(currentMonthLima(), 3).forEach((m) => set.add(m));
    return Array.from(set).sort().reverse();
  }, [txs]);
  const s = useMemo(() => summarize(txs, { month }), [txs, month]);
  const delta = s.prevExpense ? Math.round(((s.expense - s.prevExpense) / s.prevExpense) * 100) : null;

  if (!txs.length) {
    return <p className="text-muted text-sm">Aún no hay movimientos. Cuando tu script escanee el correo (cada 15 min) aparecerán aquí.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="label !mb-0">Resumen</div>
          <select className="btn" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Ingresos del mes" value={fmtPEN(s.income)} />
          <Kpi label="Gastos del mes" value={fmtPEN(s.expense)} sub={delta == null ? "sin mes anterior" : `${delta > 0 ? "+" : ""}${delta}% vs mes anterior`} />
          <Kpi label="Te queda" value={fmtPEN(s.net)} highlight sub={s.income ? `${Math.round((s.net / s.income) * 100)}% de tus ingresos` : ""} />
        </section>

        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="card">
            <div className="label">Gastos por categoría</div>
            <div className="flex flex-wrap items-center gap-5">
              <Donut data={s.byCategory} total={s.expense} />
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 text-sm" style={{ minWidth: 220 }}>
                {s.byCategory.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <i className="h-2 w-2 flex-none rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate">{c.name}</span>
                    <b className="ml-auto font-medium text-muted">{c.pct}%</b>
                  </div>
                ))}
                {!s.byCategory.length && <span className="text-muted">Sin gastos este mes.</span>}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="label">Últimos 6 meses</div>
            <Bars data={s.last6} current={month} />
          </div>
        </section>

        <section className="card">
          <div className="label">Comercios principales</div>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {s.topMerchants.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between text-sm"><span className="truncate">{m.name}</span><span>{fmtPEN(m.amount)}</span></div>
                <div className="track mt-1"><div className="fill" style={{ width: `${s.topMerchants[0].amount ? (m.amount / s.topMerchants[0].amount) * 100 : 0}%` }} /></div>
                <small className="text-muted text-[10.5px]">{m.count} {m.count === 1 ? "movimiento" : "movimientos"}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="card">
        <div className="flex items-center justify-between">
          <div className="label">Movimientos · {monthLabel(month)}</div>
          {s.pending.length > 0 && <span className="pill"><i className="dot warn" /> {s.pending.length} por categorizar</span>}
        </div>
        <ul className="max-h-[720px] overflow-auto">
          {s.movements.map((t) => (
            <li key={t.id} className="grid grid-cols-[8px_1fr_auto] items-center gap-2.5 border-t border-border py-2.5 first:border-t-0">
              <i className="dot" style={{ background: t.tipo === "income" ? "var(--ok)" : t.tipo === "internal_transfer" ? "var(--muted)" : "var(--accent)" }} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.comercio || t.contraparte || (t.tipo === "internal_transfer" ? "Transferencia entre cuentas" : "—")}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  {t.fecha.slice(5, 10)} · {t.categoria ? t.categoria : t.tipo === "expense" ? <span className="text-warn">Pendiente</span> : t.tipo}
                  <span className="src">{SRC[t.fuente] ?? t.fuente}</span>
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${t.tipo === "income" ? "text-ok" : ""}`}>
                {t.tipo === "income" ? "+ " : t.tipo === "internal_transfer" ? "" : "− "}{t.moneda === "USD" ? "$ " : "S/ "}{t.monto.toFixed(2)}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "border-accent bg-accent-soft" : ""}`}>
      <div className="label">{label}</div>
      <div className={`text-2xl font-extrabold tracking-tight ${highlight ? "text-accent-2" : ""}`}>{value}</div>
      {sub ? <div className="mt-1 text-[11.5px] text-muted">{sub}</div> : null}
    </div>
  );
}

function Donut({ data, total }: { data: { name: string; amount: number }[]; total: number }) {
  const r = 58, C = 2 * Math.PI * r;
  // Arcos acumulados calculados de antemano (sin mutar durante el render).
  const arcs = data.reduce<{ name: string; len: number; offset: number }[]>((acc, c) => {
    const len = total ? (c.amount / total) * C : 0;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
    return [...acc, { name: c.name, len, offset }];
  }, []);
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Gastos por categoría">
      {arcs.map((a, i) => (
        <circle key={a.name} cx="75" cy="75" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="18"
          strokeDasharray={`${Math.max(0, a.len - 1.5)} ${C - a.len + 1.5}`} strokeDashoffset={-a.offset} transform="rotate(-90 75 75)" />
      ))}
      <text x="75" y="74" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="800">{fmtPEN(total)}</text>
      <text x="75" y="91" textAnchor="middle" fill="var(--muted)" fontSize="10">gastado</text>
    </svg>
  );
}

function Bars({ data, current }: { data: { month: string; expense: number }[]; current: string }) {
  const max = Math.max(1, ...data.map((d) => d.expense));
  return (
    <div className="flex h-[150px] items-end gap-3 pt-4">
      {data.map((d) => (
        <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[10.5px] text-muted">{d.expense ? (d.expense / 1000).toFixed(1) + "k" : ""}</span>
          <div className="w-full max-w-7 rounded-t" style={{ height: `${(d.expense / max) * 100}%`, background: "var(--accent)", opacity: d.month === current ? 1 : 0.55 }} />
          <small className="text-[10.5px] text-muted">{monthLabel(d.month).slice(0, 3)}</small>
        </div>
      ))}
    </div>
  );
}
