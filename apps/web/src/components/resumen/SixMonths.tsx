"use client";

/**
 * "Últimos 6 meses": barras en SVG a escala con línea de promedio punteada; el mes elegido en primary.
 * Cada columna es un botón (aria-pressed) encima del dibujo para elegir ese mes.
 */
import { fmtPEN, MESES_ES } from "@/lib/ledger";
import { monthTitle, niceMax, shortAmount, sixMonthAverage } from "@/lib/resumen";

const W = 340, H = 170, X0 = 34, BASE = 140, TOP = 20, COL = (W - X0) / 6, BAR = 30;

type Props = { data: { month: string; expense: number }[]; current: string; onPick: (m: string) => void; anim: boolean; className?: string; style?: React.CSSProperties };

export default function SixMonths({ data, current, onPick, anim, className = "", style }: Props) {
  const avg = sixMonthAverage(data);
  const max = niceMax(Math.max(0, ...data.map((d) => d.expense)));
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const label = data.map((d) => `${monthTitle(d.month)} ${fmtPEN(d.expense)}`).join(", ") + (avg != null ? `; promedio ${fmtPEN(avg)}` : "");
  return (
    <section className={`card ${className}`} style={style} aria-labelledby="m6-h">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="m6-h" className="card-title">Últimos 6 meses</h2>
        {avg != null && <span className="text-[13px] text-muted">Promedio <span className="num">{fmtPEN(Math.round(avg))}</span></span>}
      </div>
      <div className="relative">
        <svg className="block h-auto w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          <g stroke="var(--line)">
            <line x1={X0} y1={TOP} x2={W} y2={TOP} strokeDasharray="2 4" />
            <line x1={X0} y1={(TOP + BASE) / 2} x2={W} y2={(TOP + BASE) / 2} strokeDasharray="2 4" />
            <line x1={X0} y1={BASE} x2={W} y2={BASE} />
          </g>
          <g className="num" fontSize="10" fill="var(--muted)">
            <text x="0" y={TOP + 4}>{shortAmount(max)}</text>
            <text x="0" y={(TOP + BASE) / 2 + 4}>{shortAmount(max / 2)}</text>
            <text x="0" y={BASE + 4}>0</text>
          </g>
          {/* Promedio detrás de las barras; las etiquetas llevan un halo del color de la tarjeta para leerse encima. */}
          {avg != null && <line x1={X0} y1={y(avg)} x2={W} y2={y(avg)} stroke="var(--muted)" strokeDasharray="4 3" />}
          {data.map((d, i) => {
            const on = d.month === current;
            const cx = X0 + COL * i + COL / 2;
            const top = y(d.expense);
            const h = BASE - top;
            return (
              <g key={d.month}>
                {d.expense > 0
                  ? <rect className={anim ? "grow-y" : ""} style={{ ["--i" as string]: i }} x={cx - BAR / 2} y={top} width={BAR} height={h} rx={Math.min(6, h / 2)} fill={on ? "var(--primary)" : "var(--strong)"} />
                  : <rect x={cx - BAR / 2} y={BASE - 2} width={BAR} height="2" rx="1" fill="var(--strong)" />}
                {d.expense > 0 && <text className="num" x={cx} y={top - 6} fontSize="10.5" textAnchor="middle" fill={on ? "var(--primary)" : "var(--body)"} fontWeight={on ? 500 : 400} stroke="var(--card)" strokeWidth={3} paintOrder="stroke">{shortAmount(d.expense)}</text>}
                <text x={cx} y={H - 10} fontSize="11.5" textAnchor="middle" fill={on ? "var(--ink)" : "var(--muted)"} fontWeight={on ? 600 : 400}>{MESES_ES[Number(d.month.slice(5, 7)) - 1]}</text>
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-y-0 flex" style={{ left: `${(X0 / W) * 100}%`, right: 0 }}>
          {data.map((d) => (
            <button key={d.month} type="button" onClick={() => onPick(d.month)} aria-pressed={d.month === current}
              aria-label={`Ver ${monthTitle(d.month)}: ${fmtPEN(d.expense)}`}
              className="h-full flex-1 rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]" />
          ))}
        </div>
      </div>
    </section>
  );
}
