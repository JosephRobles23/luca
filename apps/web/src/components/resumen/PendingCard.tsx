"use client";

/**
 * "Por categorizar" (DESIGN.md §Components · Por categorizar): los primeros pendientes del mes con chips de un toque.
 * Al guardar, el provider recarga el dato y el pendiente deja de existir; aquí se conserva un momento para que se
 * vea la confirmación y sale con colapso de altura. El contador baja al instante.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney, txLabel, type Tx } from "@/lib/ledger";
import { pendingMeta } from "@/lib/resumen";
import CategoryChips from "../CategoryChips";
import { SRC_LABEL } from "../ui";

const SHOW = 3;   // a la vista en el Resumen; el resto en Movimientos
const HOLD_MS = 1100;   // confirmación visible antes de colapsar
const COLLAPSE_MS = 240;

type Leaving = { tx: Tx; index: number; collapsing: boolean };

type Props = { pending: Tx[]; month: string; className?: string; style?: React.CSSProperties };

export default function PendingCard({ pending, month, className = "", style }: Props) {
  const [leaving, setLeaving] = useState<Record<string, Leaving>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const visible = useMemo(() => {
    const list = pending.slice(0, SHOW).filter((t) => !leaving[t.id]).map((t) => ({ tx: t, leaving: null as Leaving | null }));
    Object.values(leaving).sort((a, b) => a.index - b.index).forEach((l) => {
      list.splice(Math.min(l.index, list.length), 0, { tx: l.tx, leaving: l });
    });
    return list;
  }, [pending, leaving]);

  function onSaved(tx: Tx, index: number) {
    setLeaving((m) => ({ ...m, [tx.id]: { tx, index, collapsing: false } }));
    timers.current.push(window.setTimeout(() => setLeaving((m) => (m[tx.id] ? { ...m, [tx.id]: { ...m[tx.id], collapsing: true } } : m)), HOLD_MS));
    timers.current.push(window.setTimeout(() => setLeaving((m) => { const { [tx.id]: _gone, ...rest } = m; void _gone; return rest; }), HOLD_MS + COLLAPSE_MS));
  }

  const n = pending.length;
  return (
    <section className={`card grid content-start gap-3.5 ${className}`} style={style} data-testid="pending-card" aria-labelledby="pend-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pend-h" className="card-title flex items-center gap-2">
          Por categorizar
          <span className={`num inline-grid h-[22px] min-w-[22px] place-items-center rounded-full px-[7px] text-[11.5px] ${n ? "bg-primary-strong text-white" : "bg-strong text-muted"}`} aria-label={`${n} pendientes`}>{n}</span>
        </h2>
      </div>

      {visible.length === 0 ? (
        <div className="sunken grid justify-items-start gap-1.5 p-4" role="status">
          <span className="flex items-center gap-2 text-[14.5px] font-semibold text-success">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="11" fill="var(--success)" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--card)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Todo categorizado
          </span>
          <span className="text-[13px] text-muted">Cada gasto del mes tiene su categoría. Los nuevos aparecerán aquí.</span>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {visible.map(({ tx, leaving: l }, i) => (
            <li key={tx.id} className={`sunken grid gap-3 p-3.5 ${l?.collapsing ? "collapse-out" : ""}`} style={l?.collapsing ? ({ "--h": "360px" } as React.CSSProperties) : undefined}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <b className="block truncate font-semibold">{txLabel(tx)}</b>
                  <small className="mt-0.5 block text-[12.5px] text-muted">{pendingMeta(tx, (f) => SRC_LABEL[f] ?? f)}</small>
                </div>
                <span className="num whitespace-nowrap font-medium"><span className="cur">{tx.moneda === "USD" ? "$" : "S/"}</span> {fmtMoney(tx.monto, tx.moneda).replace(/^\S+\s/, "")}</span>
              </div>
              <CategoryChips tx={tx} onSaved={() => onSaved(tx, i)} />
            </li>
          ))}
        </ul>
      )}

      {n > SHOW && <Link className="btn sm justify-self-start" href={`/app/movimientos?categoria=__pending__&mes=${month}`}>Ver los {n} pendientes</Link>}
    </section>
  );
}
