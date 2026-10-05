"use client";

/**
 * "Movimientos de {mes}": chips de filtro con contadores (en el cliente) y lista agrupada por día con el gasto del
 * día en el encabezado (pegajoso mientras su grupo está a la vista). Hasta LIMIT filas; el resto en Movimientos.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPEN, type Tx } from "@/lib/ledger";
import { groupByDay } from "@/lib/dias";
import { capGroups, filterMovements, movementCounts, type MovFilter } from "@/lib/resumen";
import TxRow from "../TxRow";

const LIMIT = 30;
const CHIPS: { id: MovFilter; label: string }[] = [
  { id: "all", label: "Todos" }, { id: "consumo", label: "Consumos" }, { id: "transferencia", label: "Transferencias" }, { id: "pendiente", label: "Por categorizar" },
];

type Props = { txs: Tx[]; month: string; name: string; today: string; usdRate: number; className?: string; style?: React.CSSProperties };

export default function MonthMovements({ txs, month, name, today, usdRate, className = "", style }: Props) {
  const [f, setF] = useState<MovFilter>("all");
  const counts = useMemo(() => movementCounts(txs), [txs]);
  const list = useMemo(() => filterMovements(txs, f), [txs, f]);
  const view = useMemo(() => capGroups(groupByDay(list, today, usdRate), LIMIT), [list, today, usdRate]);

  return (
    <section className={`card !p-0 ${className}`} style={style} aria-labelledby="mv-h">
      <div className="flex items-center justify-between gap-3 px-5 pt-[18px]">
        <h2 id="mv-h" className="card-title">Movimientos de {name}</h2>
        <Link className="text-[13px] font-medium text-body underline-offset-4 hover:text-ink hover:underline" href={`/app/movimientos?mes=${month}`}>Ver todos</Link>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-b border-line px-5 pb-3.5 pt-3 [scrollbar-width:none]" role="group" aria-label="Filtrar movimientos">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={f === c.id} onClick={() => setF(c.id)}>
            {c.label} <span className="num opacity-65">{counts[c.id]}</span>
          </button>
        ))}
      </div>

      <div data-testid="dashboard-movements">
        {view.groups.length === 0 && (
          <p className="px-5 py-7 text-center text-sm text-muted">{f === "pendiente" ? "Todo categorizado. Buen trabajo." : "No hay movimientos de este tipo en el mes."}</p>
        )}
        {view.groups.map((g) => (
          <div key={g.day}>
            <h3 className="sticky top-0 z-[1] flex justify-between gap-3 bg-card px-5 pb-1.5 pt-3 text-xs font-semibold text-muted">
              <span>{g.label}</span>
              {g.expense > 0 && <span className="num font-medium">−{fmtPEN(g.expense)}</span>}
            </h3>
            <ul className="px-2 pb-2">
              {g.txs.map((t) => <TxRow key={t.id} t={t} usdRate={usdRate} />)}
            </ul>
          </div>
        ))}
      </div>

      {view.shown < view.total && (
        <div className="flex justify-center border-t border-line px-5 pb-4 pt-3">
          <Link className="text-[13px] font-medium text-body underline underline-offset-4 hover:text-ink" href={`/app/movimientos?mes=${month}`}>Ver los {view.total} movimientos de {name}</Link>
        </div>
      )}
    </section>
  );
}
