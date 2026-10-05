"use client";

/**
 * Categorización con un toque (DESIGN.md §Components · Por categorizar): chips de las 4 categorías más usadas,
 * la sugerencia por comercio/persona y "Otra…" (select nativo con la lista completa, `data-testid=cat-{id}`).
 * Escribe `categoria` + `categoria_origen=user` y aprende en `Comercios` (vía recategorize).
 */
import { useMemo, useState } from "react";
import type { Tx } from "@/lib/ledger";
import { catColor, suggestCategory, topCategories } from "@/lib/categorias";
import { useLedger } from "./LedgerProvider";
import { DrawCheck } from "./motion";

export default function CategoryChips({ tx, onSaved }: { tx: Tx; onSaved?: (categoria: string) => void }) {
  const { state, recategorize } = useLedger();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const categorias = useMemo(() => (state.phase === "ready" ? state.data.categorias : []), [state]);
  const suggestion = useMemo(() => suggestCategory(tx, txs), [tx, txs]);
  const chips = useMemo(() => {
    const top = topCategories(txs, categorias, 4);
    return suggestion && !top.includes(suggestion) ? [suggestion, ...top.slice(0, 3)] : top;
  }, [txs, categorias, suggestion]);
  const opts = tx.categoria && !categorias.includes(tx.categoria) ? [tx.categoria, ...categorias] : categorias;

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
        <select className="chip appearance-none pr-3" aria-label="Otra categoría" data-testid={`cat-${tx.id}`} value={current} disabled={!!saving}
          onChange={(e) => pick(e.target.value)}>
          <option value="">Otra…</option>
          {opts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {saved ? (
        <span className="flex items-center gap-2 text-[13px] font-medium text-success" role="status"><DrawCheck size={18} />Guardado en tu Sheet. Los próximos de este comercio irán solos.</span>
      ) : suggestion && !tx.categoria ? (
        <span className="text-[12.5px] text-muted">Sugerencia por movimientos anteriores: <b className="font-medium text-body">{suggestion}</b></span>
      ) : null}
    </div>
  );
}
