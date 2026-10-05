"use client";

/** "Comercios principales": top 6 del mes con barra relativa al primero; cada uno abre Movimientos filtrado por texto. */
import Link from "next/link";
import { fmtPEN } from "@/lib/ledger";
import { merchantHref } from "@/lib/resumen";

type Props = { data: { name: string; amount: number; count: number }[]; month: string; anim: boolean; className?: string; style?: React.CSSProperties };

export default function TopMerchants({ data, month, anim, className = "", style }: Props) {
  const top = data.slice(0, 6);
  const max = top[0]?.amount || 1;
  return (
    <section className={`card ${className}`} style={style} aria-labelledby="mer-h">
      <h2 id="mer-h" className="card-title mb-3">Comercios principales</h2>
      {top.length ? (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {top.map((m, i) => (
            <li key={m.name}>
              <Link href={merchantHref(m.name, month)} className="-mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-sunken">
                <span className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="num whitespace-nowrap font-medium">{fmtPEN(m.amount)}</span>
                </span>
                <span className="track mt-1.5 block"><span className={`fill block ${anim ? "grow-x" : ""}`} style={{ width: `${(m.amount / max) * 100}%`, ["--i" as string]: i }} /></span>
                <small className="mt-1 block text-[11.5px] text-muted">{m.count} {m.count === 1 ? "movimiento" : "movimientos"}</small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aún no hay comercios este mes.</p>
      )}
    </section>
  );
}
