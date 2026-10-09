"use client";

/**
 * "Ritmo del mes" (DESIGN.md §Components · Ritmo del mes): acumulado del mes contra el anterior y proyección a fin
 * de mes (misma escala) sobre las barras de gasto diario sin el gasto fijo. Ambos comparten puntero; la leyenda
 * oculta o muestra cada serie. Diario y acumulado van en gráficos separados: un solo gráfico necesitaría dos ejes.
 */
import { useCallback, useState } from "react";
import { MESES_ES, txLabel, type Tx } from "@/lib/ledger";
import { axisAmount, dayExpenses, type Ritmo } from "@/lib/graficos";
import EChart, { alpha, tooltipBase, type ChartTheme } from "../charts/EChart";

const num = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 0 });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

type Key = "cur" | "prev" | "proj";
const dayNumbers = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
type Props = { r: Ritmo; txs: Tx[]; name: string; usdRate: number; hasPrev: boolean; className?: string; style?: React.CSSProperties };

export default function PaceCard({ r, txs, name, usdRate, hasPrev, className = "", style }: Props) {
  const [hidden, setHidden] = useState<Record<Key, boolean>>({ cur: false, prev: false, proj: false });
  const short = MESES_ES[Number(r.month.slice(5, 7)) - 1];
  const legend: { key: Key; label: string; dash?: boolean; faint?: boolean }[] = [
    { key: "cur", label: "Este mes" },
    ...(hasPrev ? [{ key: "prev" as Key, label: "Mes anterior", dash: true }] : []),
    ...(r.projectionEnd != null ? [{ key: "proj" as Key, label: "Proyección", dash: true, faint: true }] : []),
  ];

  const buildCum = useCallback((T: ChartTheme) => ({
    animation: !T.still, animationDuration: 700, animationEasing: "cubicOut",
    grid: { left: 48, right: 14, top: 12, bottom: 4 },
    tooltip: {
      ...tooltipBase(T), trigger: "axis", axisPointer: { type: "line", lineStyle: { color: T.axis, type: "dashed" } },
      formatter: (ps: { axisValue: string; value: number | null; marker: string; seriesName: string }[]) =>
        `<div style="font-weight:600;margin-bottom:4px">${ps[0].axisValue} de ${name}</div>` +
        ps.filter((p) => p.value != null).map((p) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker}${p.seriesName}</span><b style="font-family:${T.mono}">S/ ${num(p.value as number)}</b></div>`).join(""),
    },
    xAxis: { type: "category", data: dayNumbers(r.days), boundaryGap: false, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "value", splitNumber: 4, splitLine: { lineStyle: { color: T.grid } }, axisLabel: { color: T.muted, fontFamily: T.mono, fontSize: 11, formatter: axisAmount } },
    series: [
      {
        name: "Este mes", type: "line", data: hidden.cur ? [] : r.cum, smooth: 0.25, showSymbol: false, symbol: "circle", symbolSize: 6,
        lineStyle: { width: 2.5, color: T.s1 }, itemStyle: { color: T.s1, borderColor: T.card, borderWidth: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: alpha(T.s1, 0.25) }, { offset: 1, color: alpha(T.s1, 0) }] } },
        markPoint: r.projectionEnd != null && !hidden.cur && r.lastDay > 0
          ? { symbol: "circle", symbolSize: 10, itemStyle: { color: T.s1, borderColor: T.card, borderWidth: 3 }, label: { show: false }, data: [{ coord: [r.lastDay - 1, r.cum[r.lastDay - 1]] }] }
          : undefined,
      },
      { name: "Mes anterior", type: "line", data: hidden.prev || !hasPrev ? [] : r.prevCum, smooth: 0.25, symbol: "none", lineStyle: { width: 2, type: [5, 4], color: T.s2 }, itemStyle: { color: T.s2 } },
      { name: "Proyección", type: "line", data: hidden.proj ? [] : r.projection, symbol: "none", lineStyle: { width: 2, type: [2, 4], color: T.s1, opacity: 0.7 }, itemStyle: { color: T.s1 } },
    ],
  }), [r, hidden, hasPrev, name]);

  const buildDaily = useCallback((T: ChartTheme) => {
    const [y, m] = r.month.split("-").map(Number);
    const weekend = (d: number) => [0, 6].includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
    return {
      animation: !T.still, animationDuration: 600,
      grid: { left: 48, right: 14, top: 8, bottom: 22 },
      tooltip: {
        ...tooltipBase(T), trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: T.strong, opacity: 0.6 } },
        formatter: (ps: { dataIndex: number; value: number | null }[]) => {
          const d = ps[0].dataIndex + 1;
          const { top, rest } = dayExpenses(txs, r.month, d, usdRate);
          const list = top.map(({ tx, amount }) => `<div style="display:flex;justify-content:space-between;gap:14px;color:${T.body}"><span>${esc(txLabel(tx))}</span><span style="font-family:${T.mono}">${num(amount)}</span></div>`).join("")
            + (rest ? `<div style="color:${T.muted};margin-top:2px">+${rest} más</div>` : "");
          return `<div style="font-weight:600">${d} de ${name} · <span style="font-family:${T.mono}">S/ ${num(ps[0].value ?? 0)}</span></div>${list}`;
        },
      },
      xAxis: { type: "category", data: dayNumbers(r.days), axisLine: { lineStyle: { color: T.axis } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontFamily: T.mono, fontSize: 10.5, interval: (i: number) => i === 0 || (i + 1) % 5 === 0 } },
      yAxis: { type: "value", splitNumber: 2, splitLine: { lineStyle: { color: T.grid } }, axisLabel: { color: T.muted, fontFamily: T.mono, fontSize: 10.5, formatter: axisAmount } },
      series: [{
        name: "Gasto del día", type: "bar", barMaxWidth: 12,
        data: r.daily.map((v, i) => ({ value: i < r.lastDay ? v : null, itemStyle: { color: weekend(i + 1) ? T.primary2 : T.s1, opacity: weekend(i + 1) ? 1 : 0.55, borderRadius: [4, 4, 0, 0] } })),
        emphasis: { itemStyle: { opacity: 1 } },
      }],
    };
  }, [r, txs, name, usdRate]);

  const facts: [string, string][] = [
    [`S/ ${num(r.avgDaily)}`, "Promedio diario sin alquiler"],
    r.projectionEnd != null ? [`S/ ${int(r.projectionEnd)}`, "Proyección a fin de mes"] : [`S/ ${int((r.cum[r.days - 1] ?? 0) as number)}`, "Total del mes cerrado"],
    r.maxDay ? [`${r.maxDay.day} ${short} · S/ ${int(r.maxDay.amount)}`, `Día más caro · gasto en ${r.spentDays} de ${r.lastDay} días`] : ["—", "Sin gastos variables todavía"],
  ];

  return (
    <section className={`card grid content-start gap-3 ${className}`} style={style} aria-labelledby="ritmo-h" data-testid="pace-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ritmo-h" className="card-title">Ritmo del mes</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Gasto acumulado contra el mes anterior y gasto de cada día (barras sin el alquiler; fines de semana más intensos)</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series del acumulado">
          {legend.map((l) => (
            <button key={l.key} type="button" className="legend-chip" aria-pressed={!hidden[l.key]}
              onClick={() => setHidden((h) => ({ ...h, [l.key]: !h[l.key] }))}>
              <i className={`block ${l.dash ? "h-[3px] w-3 rounded-sm" : "h-2.5 w-2.5 rounded-[3px]"}`} style={{ background: l.key === "prev" ? "var(--chart-2)" : "var(--chart-1)", opacity: l.faint ? 0.55 : 1 }} />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <EChart build={buildCum} group="ritmo" className="h-[230px] w-full" testId="pace-cumulative"
        ariaLabel={`Gasto acumulado de ${name}: S/ ${num((r.cum[Math.max(0, r.lastDay - 1)] ?? 0) as number)} al día ${r.lastDay}${r.projectionEnd != null ? `; proyección S/ ${int(r.projectionEnd)}` : ""}`} />
      <EChart build={buildDaily} group="ritmo" className="-mt-1.5 h-[110px] w-full" testId="pace-daily"
        ariaLabel={`Gasto de cada día de ${name}, sin alquiler`} />
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3" data-testid="pace-facts">
        {facts.map(([v, k]) => (
          <p key={k} className="grid bg-card px-3 py-2.5">
            <b className="num text-[15px] font-medium">{v}</b>
            <span className="text-[11.5px] text-muted">{k}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
