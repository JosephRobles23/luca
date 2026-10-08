"use client";

/**
 * "En qué se fue": dona por categoría (pasteles de catColor) con el total al centro y lista con %, monto e icono.
 * Tocar una categoría (en la lista o en la dona) filtra los movimientos del mes; tocarla otra vez quita el filtro.
 */
import Link from "next/link";
import { useCallback } from "react";
import { fmtPEN } from "@/lib/ledger";
import { catColor, catVar } from "@/lib/categorias";
import { categoryHref } from "@/lib/resumen";
import CategoryIcon from "../CategoryIcon";
import EChart, { tooltipBase, type ChartTheme } from "../charts/EChart";

const int = (n: number) => n.toLocaleString("es-PE", { maximumFractionDigits: 0 });

type Props = {
  data: { name: string; amount: number; pct: number }[]; total: number; month: string;
  selected: string; onPick: (name: string) => void;
  className?: string; style?: React.CSSProperties;
};

export default function CategoryBreakdown({ data, total, month, selected, onPick, className = "", style }: Props) {
  const build = useCallback((T: ChartTheme) => ({
    animation: !T.still, animationDuration: 700,
    tooltip: { ...tooltipBase(T), trigger: "item", formatter: (p: { name: string; value: number; percent: number }) => `<b>${p.name}</b><br><span style="font-family:${T.mono}">${fmtPEN(p.value)} · ${Math.round(p.percent)} %</span>` },
    series: [{
      type: "pie", radius: ["64%", "90%"], padAngle: 2, label: { show: false }, emphasis: { scale: true, scaleSize: 4 },
      itemStyle: { borderRadius: 5, borderColor: T.card, borderWidth: 2 },
      data: data.map((c) => ({ name: c.name, value: c.amount, itemStyle: { color: T.cssVar(catVar(c.name)), opacity: selected && selected !== c.name ? 0.3 : 1 } })),
    }],
  }), [data, selected]);
  const onClick = useCallback((p: { name: string }) => onPick(p.name), [onPick]);

  return (
    <section className={`card grid content-start gap-3 ${className}`} style={style} aria-labelledby="cat-h" data-testid="category-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="cat-h" className="card-title">En qué se fue</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">Toca una categoría para filtrar los movimientos</p>
        </div>
        {selected && <Link className="text-[13px] font-medium text-body underline-offset-4 hover:text-ink hover:underline" href={categoryHref(selected, month)}>Ver en Movimientos</Link>}
      </div>
      {data.length ? (
        <>
          <div className="relative mx-auto h-[170px] w-full max-w-[220px]">
            <EChart build={build} onClick={onClick} className="h-full w-full" ariaLabel={data.map((c) => `${c.name} ${c.pct} %`).join(", ")} testId="category-donut" />
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <span className="num text-[15px] font-medium">S/ {int(total)}</span>
              <span className="text-[11px] text-muted">{selected || "gasto total"}</span>
            </div>
          </div>
          <ul className="grid gap-0.5" aria-label="Categorías del mes">
            {data.map((c) => (
              <li key={c.name}>
                <button type="button" aria-pressed={selected === c.name} onClick={() => onPick(c.name)}
                  className="grid w-full grid-cols-[26px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-sunken aria-pressed:bg-sunken">
                  <span className={`grid h-[26px] w-[26px] place-items-center rounded-lg ${c.name === "Sin categoría" ? "text-body" : "text-[#1d1a17]"}`} style={{ background: catColor(c.name) }} aria-hidden><CategoryIcon categoria={c.name} size={14} /></span>
                  <span className="truncate">{c.name}</span>
                  <span className="num whitespace-nowrap text-[12px] text-muted">{c.pct} %</span>
                  <span className="num whitespace-nowrap text-right text-[13px] font-medium">{fmtPEN(c.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted">Sin gastos este mes.</p>
      )}
    </section>
  );
}
