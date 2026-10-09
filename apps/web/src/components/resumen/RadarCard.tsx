"use client";

/**
 * "Perfil de gasto" (DESIGN.md §Components · Perfil de gasto): radar por categoría de este mes contra el anterior y
 * el promedio de los 3 anteriores, en soles o en % del gasto de cada mes. Sin el gasto fijo (Vivienda). Una sola
 * escala para todos los ejes; la leyenda oculta series (siempre queda al menos una).
 */
import { useCallback, useMemo, useState } from "react";
import type { Tx } from "@/lib/ledger";
import { radarData, type RadarUnit } from "@/lib/graficos";
import EChart, { tooltipBase, type ChartTheme } from "../charts/EChart";

const num = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUnit = (v: number, unit: RadarUnit) => (unit === "pct" ? `${v.toFixed(1)} %` : `S/ ${num(v)}`);
const SHORT: Record<string, string> = { "Comidas fuera": "Comidas", Supermercado: "Súper", Suscripciones: "Suscrip.", Transferencias: "Transf.", Transporte: "Transp.", "Sin categoría": "Sin cat." };
const SERIES = [
  { key: "cur", label: "Este mes", color: "--chart-1", dash: "solid" },
  { key: "prev", label: "Mes anterior", color: "--chart-2", dash: [5, 4] },
  { key: "avg", label: "Promedio 3 meses", color: "--chart-3", dash: [2, 3] },
] as const;

type Props = { txs: Tx[]; month: string; usdRate: number; className?: string; style?: React.CSSProperties };

export default function RadarCard({ txs, month, usdRate, className = "", style }: Props) {
  const [unit, setUnit] = useState<RadarUnit>("pen");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const data = useMemo(() => radarData(txs, month, usdRate, unit), [txs, month, usdRate, unit]);
  const fmt = (v: number) => fmtUnit(v, unit);

  const build = useCallback((T: ChartTheme) => {
    const fmt = (v: number) => fmtUnit(v, unit);
    const shown = SERIES.filter((s) => !hidden[s.key]);
    return {
      animation: !T.still, animationDuration: 700,
      tooltip: {
        ...tooltipBase(T), trigger: "item",
        formatter: (p: { seriesName: string; name: string; value: number[] }) => `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>` +
          data.cats.map((c, i) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${T.body}">${c}</span><b style="font-family:${T.mono}">${fmt(p.value[i])}</b></div>`).join(""),
      },
      radar: {
        radius: "60%", center: ["50%", "52%"], splitNumber: 4, shape: "polygon",
        indicator: data.cats.map((c) => ({ name: SHORT[c] ?? c, max: data.max })),
        axisName: { color: T.body, fontFamily: T.font, fontSize: 12.5 },
        splitLine: { lineStyle: { color: T.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: T.grid } },
      },
      series: [{
        type: "radar", symbol: "circle", symbolSize: 6, emphasis: { lineStyle: { width: 3 } },
        data: shown.map((s) => {
          const c = T.cssVar(s.color);
          const values = data.series.find((x) => x.key === s.key)?.values ?? [];
          return { name: s.label, value: values, lineStyle: { color: c, width: s.key === "cur" ? 2.5 : 2, type: s.dash }, itemStyle: { color: c, borderColor: T.card, borderWidth: 2 }, areaStyle: s.key === "cur" ? { color: c, opacity: 0.18 } : { opacity: 0 } };
        }),
      }],
    };
  }, [data, hidden, unit]);

  const toggle = (k: string) => {
    const visible = SERIES.filter((s) => !hidden[s.key]).length;
    if (!hidden[k] && visible <= 1) return;
    setHidden((h) => ({ ...h, [k]: !h[k] }));
  };
  const cur = data.series[0].values;
  const label = data.cats.length ? `Perfil de gasto de este mes: ${data.cats.map((c, i) => `${c} ${fmt(cur[i])}`).join(", ")}` : "Sin gastos variables para comparar";

  return (
    <section className={`card grid content-start gap-3 ${className}`} style={style} aria-labelledby="radar-h" data-testid="radar-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="radar-h" className="card-title">Perfil de gasto</h2>
          <p className="mt-0.5 text-[12.5px] text-muted" data-testid="radar-sub">{unit === "pct" ? "Porcentaje del gasto de cada mes" : "Soles por categoría"}, sin Vivienda (gasto fijo)</p>
        </div>
        <div className="segmented" role="group" aria-label="Unidad del radar">
          <button type="button" aria-pressed={unit === "pen"} onClick={() => setUnit("pen")}>S/</button>
          <button type="button" aria-pressed={unit === "pct"} onClick={() => setUnit("pct")}>% del mes</button>
        </div>
      </div>
      {data.cats.length >= 3
        ? <EChart build={build} className="h-[380px] w-full" ariaLabel={label} testId="radar-chart" />
        : <p className="grid h-[380px] place-items-center rounded-xl border border-dashed border-line-strong text-center text-sm text-muted">Hacen falta gastos en al menos 3 categorías para dibujar el perfil.</p>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series del radar">
        {SERIES.map((s) => (
          <button key={s.key} type="button" className="legend-chip" aria-pressed={!hidden[s.key]} onClick={() => toggle(s.key)}>
            <i className={`block ${s.key === "cur" ? "h-2.5 w-2.5 rounded-[3px]" : "h-[3px] w-3 rounded-sm"}`} style={{ background: `var(${s.color})` }} />{s.label}
          </button>
        ))}
      </div>
    </section>
  );
}
