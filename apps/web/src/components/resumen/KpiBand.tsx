"use client";

/**
 * Banda de indicadores del mes (DESIGN.md §Components · Gasto del mes): gasto con delta contra el mes anterior al
 * mismo día y barra de ritmo, más Ingresos · Te queda · Yape recibido con su minicurva de 6 meses.
 */
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import type { Summary } from "@/lib/ledger";
import { MESES_ES } from "@/lib/ledger";
import { pace } from "@/lib/dias";
import { paceLegend } from "@/lib/resumen";
import type { MonthTotals } from "@/lib/graficos";
import { CountUp } from "../motion";
import EChart, { alpha, tooltipBase, type ChartTheme } from "../charts/EChart";

const num = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  s: Summary; month: string; name: string; prevName: string; today: string; anim: boolean;
  totals: MonthTotals[];
  delta: { pct: number; day: number; closed: boolean } | null;
  className?: string; style?: React.CSSProperties;
};

export default function KpiBand({ s, month, name, prevName, today, anim, totals, delta, className = "", style }: Props) {
  const p = pace(month, s.expense, s.prevExpense, today);
  const legend = paceLegend(p, prevName);
  const negative = s.net < 0;
  const prevShort = MESES_ES[Number((totals[totals.length - 2]?.month ?? month).slice(5, 7)) - 1];
  return (
    <section className={`card grid overflow-hidden !p-0 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))] ${className}`} style={style} aria-label="Indicadores del mes" data-testid="kpi-band">
      <div className="grid content-start gap-3 p-[18px] sm:col-span-3 lg:col-span-1" data-testid="kpi-expense">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow">Gastado en {name}</h2>
          {delta && (
            <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${delta.pct > 0 ? "bg-primary-soft text-primary" : delta.pct < 0 ? "bg-success-soft text-success" : "bg-strong text-body"}`} data-testid="kpi-delta">
              {delta.pct === 0 ? `= igual que ${prevShort}` : `${delta.pct > 0 ? "↑" : "↓"} ${Math.abs(delta.pct)} % vs ${prevShort}${delta.closed ? "" : ` al día ${delta.day}`}`}
            </span>
          )}
        </div>
        <div className="amount-hero !text-[clamp(34px,4.4vw,48px)]" data-testid="kpi-value">
          <span className="cur mr-1 align-[.5em] text-[.5em] tracking-normal">S/</span> <CountUp value={s.expense} format={num} />
        </div>
        <div className="grid gap-1.5">
          <div className="relative h-2 rounded-full bg-strong" role="img"
            aria-label={p.spentPct == null ? `Sin gasto en ${prevName} con qué comparar. ${legend.right}` : `Llevas el ${p.spentPct} % de lo gastado en ${prevName}${p.closed ? "; mes cerrado" : ` y va el ${Math.round(p.dayRatio * 100)} % del mes`}`}>
            {p.spentRatio != null && <span className={`absolute inset-y-0 left-0 rounded-full bg-primary ${anim ? "grow-x" : ""}`} style={{ width: `${Math.max(p.spentRatio * 100, p.spentRatio > 0 ? 1.5 : 0)}%` }} />}
            {!p.closed && p.day > 0 && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-sm bg-primary-2" style={{ left: `${p.dayRatio * 100}%` }} />}
          </div>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px] text-muted">
            <span>{p.spentPct != null ? <><b className="font-semibold text-ink">{p.spentPct} %</b> de lo gastado en {prevName}</> : legend.left}</span>
            <span>{p.closed ? "Mes cerrado" : legend.right}</span>
          </div>
        </div>
        <Link className="w-fit text-[12.5px] font-medium text-body underline-offset-4 hover:text-ink hover:underline" href={`/app/movimientos?mes=${month}&tipo=expense`}>Ver los gastos</Link>
      </div>

      <Kpi testId="kpi-income" label="Ingresos" value={<><span className="cur">S/</span> <CountUp value={s.income} format={num} /></>}
        sub={s.income ? "solo tipo ingreso" : "sin ingresos registrados"} totals={totals} field="income" color="s3" />
      <Kpi testId="kpi-net" label="Te queda" tone={negative ? "text-primary" : ""}
        value={<>{negative ? "−" : ""}<span className={negative ? "" : "cur"}>S/</span> <CountUp value={Math.abs(s.net)} format={num} /></>}
        sub={s.income ? `${Math.round((s.net / s.income) * 100)} % de tus ingresos` : "sin ingresos este mes"} totals={totals} field="net" color="s2" />
      <Kpi testId="kpi-yape" label="Yape recibido" value={<><span className="cur">S/</span> <CountUp value={s.receivedYape} format={num} /></>}
        sub={s.receivedYapeCount ? `${s.receivedYapeCount} ${s.receivedYapeCount === 1 ? "yapeo" : "yapeos"} · no cuenta como ingreso` : "sin yapeos recibidos · no cuenta como ingreso"}
        totals={totals} field="yape" color="s1" />
    </section>
  );
}

type Field = "income" | "net" | "yape";

function Kpi({ label, value, sub, tone = "", testId, totals, field, color }: {
  label: string; value: ReactNode; sub: string; tone?: string; testId: string; totals: MonthTotals[]; field: Field; color: "s1" | "s2" | "s3";
}) {
  return (
    <div className="grid min-w-0 content-start gap-1 border-t border-line p-[18px] sm:border-l sm:[&:nth-child(2)]:border-l-0 lg:border-t-0 lg:[&:nth-child(2)]:border-l" data-testid={testId}>
      <span className="eyebrow">{label}</span>
      <div className={`num whitespace-nowrap text-[22px] font-medium tracking-[-0.03em] ${tone}`} data-testid="kpi-value">{value}</div>
      <div className="text-[12px] leading-snug text-muted">{sub}</div>
      <Sparkline totals={totals} field={field} color={color} label={`${label}, últimos 6 meses`} />
    </div>
  );
}

function Sparkline({ totals, field, color, label }: { totals: MonthTotals[]; field: Field; color: "s1" | "s2" | "s3"; label: string }) {
  const values = totals.map((t) => t[field]);
  const build = useCallback((T: ChartTheme) => {
    const values = totals.map((t) => t[field]);
    const months = totals.map((t) => t.month);
    const c = T[color];
    const min = Math.min(...values), max = Math.max(...values);
    return {
      animation: !T.still, animationDuration: 600,
      grid: { left: 2, right: 6, top: 6, bottom: 2 },
      xAxis: { type: "category", show: false, boundaryGap: false, data: months.map((m) => MESES_ES[Number(m.slice(5, 7)) - 1]) },
      yAxis: { type: "value", show: false, min: min - (max - min || 1) * 0.15, max: max + (max - min || 1) * 0.1 },
      tooltip: { ...tooltipBase(T), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: T.axis } },
        formatter: (ps: { name: string; value: number }[]) => `${ps[0].name}<br><b style="font-family:${T.mono}">S/ ${num(ps[0].value)}</b>` },
      series: [{
        type: "line", data: values, smooth: 0.35, symbol: "circle", showSymbol: true,
        symbolSize: (_: number, p: { dataIndex: number }) => (p.dataIndex === values.length - 1 ? 7 : 0),
        lineStyle: { width: 2, color: c }, itemStyle: { color: c, borderColor: T.card, borderWidth: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: alpha(c, 0.22) }, { offset: 1, color: alpha(c, 0) }] } },
      }],
    };
  }, [totals, field, color]);
  return <EChart build={build} className="mt-auto h-[46px] w-full" ariaLabel={`${label}: ${values.map((v) => `S/ ${num(v)}`).join(", ")}`} />;
}
