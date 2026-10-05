"use client";

/** "En qué se fue": barra apilada por categoría (pasteles de catColor) y lista con %, monto y enlace a Movimientos. */
import Link from "next/link";
import { fmtPEN } from "@/lib/ledger";
import { catColor } from "@/lib/categorias";
import CategoryIcon from "../CategoryIcon";
import { categoryHref } from "@/lib/resumen";

type Props = { data: { name: string; amount: number; pct: number }[]; total: number; month: string; anim: boolean; className?: string; style?: React.CSSProperties };

export default function CategoryBreakdown({ data, total, month, anim, className = "", style }: Props) {
  return (
    <section className={`card ${className}`} style={style} aria-labelledby="cat-h">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="cat-h" className="card-title">En qué se fue</h2>
        <span className="num text-[13px] text-muted">{fmtPEN(total)}</span>
      </div>
      {data.length ? (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={data.map((c) => `${c.name} ${c.pct} %`).join(", ")}>
            {data.map((c, i) => (
              <i key={c.name} className={`block h-full ${anim ? "grow-x" : ""}`} style={{ width: `${total ? (c.amount / total) * 100 : 0}%`, background: catColor(c.name), ["--i" as string]: i }} />
            ))}
          </div>
          <ul className="mt-3 grid">
            {data.map((c) => (
              <li key={c.name} className="border-t border-line-soft first:border-t-0">
                <Link href={categoryHref(c.name, month)} className="-mx-2 grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-sunken">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${c.name === "Sin categoría" ? "text-body" : "text-[#1d1a17]"}`} style={{ background: catColor(c.name) }} aria-hidden><CategoryIcon categoria={c.name} size={15} /></span>
                  <span className="truncate">{c.name}</span>
                  <span className="num min-w-[38px] text-right text-[12.5px] text-muted">{c.pct} %</span>
                  <span className="num min-w-[84px] text-right font-medium">{fmtPEN(c.amount)}</span>
                </Link>
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
