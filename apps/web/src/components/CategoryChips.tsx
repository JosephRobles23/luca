"use client";

/**
 * Categorización con un toque (DESIGN.md §Components · Por categorizar): 4 chips (sugerencia por comercio/persona,
 * Transferencias si la contraparte es una persona, y las más usadas) y "+N más" con el resto (`Dropdown`,
 * `data-testid=cat-{id}`).
 * Escribe `categoria` + `categoria_origen=user` y aprende en `Comercios` (vía recategorize).
 */
import { useMemo, useState } from "react";
import type { Tx } from "@/lib/ledger";
import { catColor, isPersonTx, quickCategories, suggestCategory } from "@/lib/categorias";
import Dropdown from "./Dropdown";
import { useLedger } from "./LedgerProvider";
import { DrawCheck } from "./motion";

export default function CategoryChips({ tx, onSaved }: { tx: Tx; onSaved?: (categoria: string) => void }) {
  const { state, recategorize } = useLedger();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const categorias = useMemo(() => (state.phase === "ready" ? state.data.categorias : []), [state]);
  const suggestion = useMemo(() => suggestCategory(tx, txs), [tx, txs]);
  const chips = useMemo(() => quickCategories(txs, categorias, { persona: isPersonTx(tx), suggestion }, 4), [tx, txs, categorias, suggestion]);
  const opts = tx.categoria && !categorias.includes(tx.categoria) ? [tx.categoria, ...categorias] : categorias;
  const rest = opts.filter((c) => !chips.includes(c));

  async function pick(c: string) {
    if (!c || saving) return;
    setSaving(c);
    try { if (await recategorize(tx, c)) { setSaved(c); onSaved?.(c); } } finally { setSaving(null); }
  }

  const current = saved ?? tx.categoria;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Categoría de ${tx.comercio || tx.contraparte || tx.id}`}>
        {chips.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={current === c} disabled={!!saving} onClick={() => pick(c)}>
            <i className="sw" style={{ background: catColor(c) }} aria-hidden />{c}{saving === c ? "…" : ""}
          </button>
        ))}
        {rest.length > 0 && (
          <Dropdown value={rest.includes(current) ? current : ""} onChange={pick} disabled={!!saving} testId={`cat-${tx.id}`}
            options={rest.map((c) => ({ value: c, label: c, color: catColor(c) }))} placeholder={`+${rest.length} más`}
            ariaLabel={`Más categorías (${rest.length})`} header={`${rest.length} categorías más`}
            className={`chip more ${rest.includes(current) ? "on" : ""}`}>
            {rest.includes(current) ? <><i className="sw" style={{ background: catColor(current) }} aria-hidden />{current}</> : undefined}
          </Dropdown>
        )}
      </div>
      {saved ? (
        <span className="flex items-center gap-2 text-[13px] font-medium text-success" role="status"><DrawCheck size={18} />Guardado en tu Sheet. Los próximos de este comercio irán solos.</span>
      ) : suggestion && !tx.categoria ? (
        <span className="text-[12.5px] text-muted">Sugerencia por movimientos anteriores: <b className="font-medium text-body">{suggestion}</b></span>
      ) : null}
    </div>
  );
}
