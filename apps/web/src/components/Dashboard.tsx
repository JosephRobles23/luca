"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { currentMonthLima, fmtMoney, fmtPEN, lastMonths, monthLabel, summarize, txLabel, type Tx } from "@/lib/ledger";
import { iphoneStatus } from "@/lib/ajustes";
import { useLedger } from "./LedgerProvider";
import CategorySelect from "./CategorySelect";
import { Kpi, Notice, SRC_LABEL } from "./ui";

const PALETTE = ["#d9623b", "#f08a5d", "#b54a2a", "#e8a07f", "#8f3a22", "#f3c2a9", "#6e2c1a", "#c9b8a8"];

export default function Dashboard() {
  const { state } = useLedger();
  const [month, setMonth] = useState(currentMonthLima());
  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const usdRate = state.phase === "ready" ? state.data.usdRate : undefined;
  const months = useMemo(() => {
    const set = new Set(txs.map((t) => t.fecha.slice(0, 7)).filter(Boolean));
    lastMonths(currentMonthLima(), 3).forEach((m) => set.add(m));
    return Array.from(set).sort().reverse();
  }, [txs]);
  const s = useMemo(() => summarize(txs, { month, usdRate }), [txs, month, usdRate]);
  const delta = s.prevExpense ? Math.round(((s.expense - s.prevExpense) / s.prevExpense) * 100) : null;
  const iphone = state.phase === "ready" ? iphoneStatus(state.data.ajustes) : null;

  if (state.phase !== "ready") return null;

  if (!state.data.hasMovimientos) {
    return (
      <section className="card" data-testid="empty-ledger">
        <div className="label">Resumen</div>
        <p className="text-sm text-muted">Tu Sheet todavía no tiene la pestaña <b className="text-text">Movimientos</b>: la crea tu script al autorizar (paso 2). Mientras tanto puedes revisar los <Link className="underline" href="/app/ajustes">ajustes</Link>.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="grid content-start gap-4">
        {iphone?.silent && (
          <Notice kind="warn" action={<Link className="btn" href="/app/conexiones">Ver conexiones</Link>}>
            {iphone.silentDays == null ? "Tu iPhone está conectado pero nunca ha enviado un evento." : `Tu iPhone lleva ${iphone.silentDays} días sin enviar eventos.`} Si sigues recibiendo yapeos, revisa la automatización del atajo.
          </Notice>
        )}

        <div className="flex items-center justify-between gap-3">
          <h1 className="label !mb-0">Resumen</h1>
          <label className="flex items-center gap-2 text-xs text-muted">Mes
            <select className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes" data-testid="month-select">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </label>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores del mes">
          <Kpi testId="kpi-income" label="Ingresos del mes" value={fmtPEN(s.income)} sub={s.income ? "solo tipo ingreso" : "sin ingresos registrados"} />
          <Kpi testId="kpi-expense" label="Gastos del mes" value={fmtPEN(s.expense)} sub={delta == null ? "sin mes anterior" : `${delta > 0 ? "+" : ""}${delta}% vs mes anterior`} />
          <Kpi testId="kpi-net" label="Te queda" value={fmtPEN(s.net)} highlight sub={s.income ? `${Math.round((s.net / s.income) * 100)}% de tus ingresos` : "sin ingresos este mes"} />
          <Kpi testId="kpi-yape" label="Recibido por Yape" value={fmtPEN(s.receivedYape)} sub={s.receivedYapeCount ? `${s.receivedYapeCount} ${s.receivedYapeCount === 1 ? "yapeo" : "yapeos"} · no cuenta como ingreso` : "sin yapeos recibidos"} />
        </section>

        {!s.movements.length && (
          <section className="card" data-testid="empty-month">
            <p className="text-sm text-muted">No hay movimientos en {monthLabel(month)}. Si falta algo, <Link className="underline" href="/app/agregar">agrégalo a mano</Link> o pide una <Link className="underline" href="/app/ajustes">importación histórica</Link>.</p>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="card">
            <h2 className="label">Gastos por categoría</h2>
            <div className="flex flex-wrap items-center gap-5">
              <Donut data={s.byCategory} total={s.expense} />
              <ul className="grid flex-1 grid-cols-1 gap-2 text-sm sm:grid-cols-2" style={{ minWidth: 200 }}>
                {s.byCategory.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <i className="h-2 w-2 flex-none rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
                    <Link href={`/app/movimientos?categoria=${encodeURIComponent(c.name === "Sin categoría" ? "__pending__" : c.name)}&mes=${month}`} className="truncate hover:underline">{c.name}</Link>
                    <b className="ml-auto font-medium text-muted">{c.pct}%</b>
                  </li>
                ))}
                {!s.byCategory.length && <li className="text-muted">Sin gastos este mes.</li>}
              </ul>
            </div>
          </div>
          <div className="card">
            <h2 className="label">Últimos 6 meses</h2>
            <Bars data={s.last6} current={month} onPick={setMonth} />
          </div>
        </section>

        <section className="card">
          <h2 className="label">Comercios principales</h2>
          {!s.topMerchants.length && <p className="text-sm text-muted">Aún no hay comercios este mes.</p>}
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {s.topMerchants.map((m) => (
              <div key={m.name}>
                <div className="flex justify-between gap-2 text-sm"><Link href={`/app/movimientos?q=${encodeURIComponent(m.name)}&mes=${month}`} className="truncate hover:underline">{m.name}</Link><span className="tabular-nums">{fmtPEN(m.amount)}</span></div>
                <div className="track mt-1"><div className="fill" style={{ width: `${s.topMerchants[0].amount ? (m.amount / s.topMerchants[0].amount) * 100 : 0}%` }} /></div>
                <small className="text-muted text-[10.5px]">{m.count} {m.count === 1 ? "movimiento" : "movimientos"}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-4">
        {s.pending.length > 0 && (
          <section className="card border-warn" data-testid="pending-card">
            <div className="flex items-center justify-between">
              <h2 className="label !mb-0">Por categorizar · {s.pending.length}</h2>
            </div>
            <ul className="mt-2">
              {s.pending.slice(0, 5).map((t) => (
                <li key={t.id} className="grid gap-1 border-t border-border py-2 first:border-t-0">
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{txLabel(t)}</span><span className="tabular-nums text-muted">{fmtMoney(t.monto, t.moneda)}</span></div>
                  <CategorySelect tx={t} compact />
                </li>
              ))}
            </ul>
            {s.pending.length > 5 && <Link className="mt-2 inline-block text-xs underline" href={`/app/movimientos?categoria=__pending__&mes=${month}`}>Ver los {s.pending.length} pendientes</Link>}
          </section>
        )}

        <section className="card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="label !mb-0">Movimientos · {monthLabel(month)}</h2>
            <Link className="text-xs underline" href={`/app/movimientos?mes=${month}`}>Ver todos</Link>
          </div>
          <ul className="mt-2 max-h-[640px] overflow-auto" data-testid="dashboard-movements">
            {s.movements.map((t) => <MovementRow key={t.id} t={t} />)}
          </ul>
          <Link className="btn mt-3 inline-block w-full text-center" href="/app/agregar">+ Agregar movimiento</Link>
        </section>
      </aside>
    </div>
  );
}

function MovementRow({ t }: { t: Tx }) {
  const dim = t.tipo === "internal_transfer";
  const color = t.tipo === "income" ? "var(--ok)" : t.tipo === "transfer_in" ? "var(--accent-2)" : dim ? "var(--muted)" : "var(--accent)";
  const sign = t.tipo === "income" || t.tipo === "transfer_in" ? "+ " : dim ? "" : "− ";
  return (
    <li className={`grid grid-cols-[8px_1fr_auto] items-center gap-2.5 border-t border-border py-2.5 first:border-t-0 ${dim ? "opacity-60" : ""}`}>
      <i className="dot" style={{ background: color }} aria-hidden />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{txLabel(t)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          {t.fecha.slice(8, 10)}/{t.fecha.slice(5, 7)} · {t.categoria ? t.categoria : t.tipo === "expense" ? <span className="text-warn">Pendiente</span> : t.tipo === "transfer_in" ? "Recibido" : dim ? "Entre cuentas" : t.tipo}
          <span className="src">{SRC_LABEL[t.fuente] ?? t.fuente}</span>
        </div>
      </div>
      <div className={`text-sm font-semibold tabular-nums ${t.tipo === "income" ? "text-ok" : ""}`}>{sign}{fmtMoney(t.monto, t.moneda)}</div>
    </li>
  );
}

function Donut({ data, total }: { data: { name: string; amount: number }[]; total: number }) {
  const r = 58, C = 2 * Math.PI * r;
  const arcs = data.reduce<{ name: string; len: number; offset: number }[]>((acc, c) => {
    const len = total ? (c.amount / total) * C : 0;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
    return [...acc, { name: c.name, len, offset }];
  }, []);
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`Gastos por categoría: ${fmtPEN(total)}`}>
      {!arcs.length && <circle cx="75" cy="75" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="18" />}
      {arcs.map((a, i) => (
        <circle key={a.name} cx="75" cy="75" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="18"
          strokeDasharray={`${Math.max(0, a.len - 1.5)} ${C - a.len + 1.5}`} strokeDashoffset={-a.offset} transform="rotate(-90 75 75)" />
      ))}
      <text x="75" y="74" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="800">{fmtPEN(total)}</text>
      <text x="75" y="91" textAnchor="middle" fill="var(--muted)" fontSize="10">gastado</text>
    </svg>
  );
}

function Bars({ data, current, onPick }: { data: { month: string; expense: number }[]; current: string; onPick: (m: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.expense));
  return (
    <div className="flex h-[150px] items-end gap-2 pt-4">
      {data.map((d) => (
        <button type="button" key={d.month} onClick={() => onPick(d.month)} aria-label={`${monthLabel(d.month)}: ${fmtPEN(d.expense)}`} aria-pressed={d.month === current}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1.5 rounded hover:bg-panel-2">
          <span className="text-[10.5px] text-muted">{d.expense ? (d.expense / 1000).toFixed(1) + "k" : ""}</span>
          <div className="w-full max-w-7 rounded-t" style={{ height: `${(d.expense / max) * 100}%`, background: "var(--accent)", opacity: d.month === current ? 1 : 0.55 }} />
          <small className="text-[10.5px] text-muted">{monthLabel(d.month).slice(0, 3)}</small>
        </button>
      ))}
    </div>
  );
}
