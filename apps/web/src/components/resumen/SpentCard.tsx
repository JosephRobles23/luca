"use client";

/**
 * "Gastado en {mes}" (DESIGN.md §Components · Gasto del mes): cifra que cuenta, delta vs el mes anterior,
 * barra de ritmo (relleno = gasto / gasto anterior; marca = hoy / días del mes) y trío Ingresos · Te queda · Yape.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { Summary } from "@/lib/ledger";
import { pace } from "@/lib/dias";
import { deltaVsPrev, paceLegend } from "@/lib/resumen";
import { CountUp } from "../motion";

const num = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = { s: Summary; month: string; name: string; prevName: string; today: string; anim: boolean; className?: string; style?: React.CSSProperties };

export default function SpentCard({ s, month, name, prevName, today, anim, className = "", style }: Props) {
  const delta = deltaVsPrev(s.expense, s.prevExpense);
  const p = pace(month, s.expense, s.prevExpense, today);
  const legend = paceLegend(p, prevName);
  const negative = s.net < 0;
  return (
    <section className={`card ${className}`} style={style} aria-labelledby="spent-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="spent-h" className="eyebrow">Gastado en {name}</h2>
        <Link className="text-[13px] font-medium text-body underline-offset-4 hover:text-ink hover:underline" href={`/app/movimientos?mes=${month}&tipo=expense`}>Ver detalle</Link>
      </div>

      <div data-testid="kpi-expense">
        <div className="amount-hero mt-3" data-testid="kpi-value">
          <span className="cur mr-1 align-[.55em] text-[.5em] tracking-normal">S/</span> <CountUp value={s.expense} format={num} />
        </div>
        {delta && (
          <span className={`mt-3 inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold ${delta.dir === "down" ? "bg-success-soft text-success" : delta.dir === "up" ? "bg-primary-soft text-primary" : "bg-strong text-body"}`}>
            {delta.dir === "same" ? `= igual que ${prevName}` : `${delta.dir === "down" ? "↓" : "↑"} ${delta.pct} % vs ${prevName}`}
          </span>
        )}
      </div>

      <div className="mb-5 mt-5 grid gap-2">
        <div className="relative h-2.5 rounded-full bg-strong" role="img"
          aria-label={p.spentPct == null ? `Sin gasto en ${prevName} con qué comparar. ${legend.right}` : `Llevas el ${p.spentPct} % de lo gastado en ${prevName}${p.closed ? "; mes cerrado" : ` y va el ${Math.round(p.dayRatio * 100)} % del mes`}`}>
          {p.spentRatio != null && (
            <span className={`absolute inset-y-0 left-0 rounded-full bg-primary ${anim ? "grow-x" : ""}`} style={{ width: `${Math.max(p.spentRatio * 100, p.spentRatio > 0 ? 1.5 : 0)}%` }} />
          )}
          {!p.closed && p.day > 0 && (
            <span className="absolute -inset-y-[5px] w-0.5 -translate-x-1/2 rounded-sm bg-primary-2" style={{ left: `${p.dayRatio * 100}%` }} />
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span>{p.closed ? <><b className="font-semibold text-ink">Mes cerrado</b>{p.spentPct != null ? ` · ${p.spentPct} % de lo gastado en ${prevName}` : ` · sin gasto en ${prevName} con qué comparar`}</> : p.spentPct != null ? <><b className="font-semibold text-ink">{p.spentPct} %</b> de lo gastado en {prevName}</> : legend.left}</span>
          <span>{legend.right}</span>
        </div>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        <TrioCell testId="kpi-income" label="Ingresos" value={<><span className="cur">S/</span> <CountUp value={s.income} format={num} /></>}
          sub={s.income ? "solo tipo ingreso" : "sin ingresos registrados"} />
        <TrioCell testId="kpi-net" label="Te queda" tone={negative ? "text-primary" : ""}
          value={<>{negative ? "−" : ""}<span className={negative ? "" : "cur"}>S/</span> <CountUp value={Math.abs(s.net)} format={num} /></>}
          sub={s.income ? `${Math.round((s.net / s.income) * 100)} % de tus ingresos` : "sin ingresos este mes"} />
        <TrioCell testId="kpi-yape" label="Yape recibido" value={<><span className="cur">S/</span> <CountUp value={s.receivedYape} format={num} /></>}
          sub={s.receivedYapeCount ? `${s.receivedYapeCount} ${s.receivedYapeCount === 1 ? "yapeo" : "yapeos"} · no cuenta como ingreso` : "sin yapeos recibidos"} />
      </div>
    </section>
  );
}

function TrioCell({ label, value, sub, tone = "", testId }: { label: string; value: ReactNode; sub: string; tone?: string; testId: string }) {
  return (
    // En móvil cada celda es una fila (etiqueta a la izquierda, cifra a la derecha); desde sm, columnas.
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 bg-card px-3.5 py-3 sm:block" data-testid={testId}>
      <span className="eyebrow">{label}</span>
      <div className={`num row-span-2 whitespace-nowrap text-[17px] font-medium sm:mt-1 ${tone}`} data-testid="kpi-value">{value}</div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{sub}</div>
    </div>
  );
}
