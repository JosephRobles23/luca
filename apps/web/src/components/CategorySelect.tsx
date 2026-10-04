"use client";

import { useState } from "react";
import type { Tx } from "@/lib/ledger";
import { useLedger } from "./LedgerProvider";

/** Select inline para recategorizar: escribe `categoria` + `categoria_origen=user` y aprende en `Comercios`. */
export default function CategorySelect({ tx, compact }: { tx: Tx; compact?: boolean }) {
  const { state, recategorize } = useLedger();
  const [saving, setSaving] = useState(false);
  const categorias = state.phase === "ready" ? state.data.categorias : [];
  const opts = tx.categoria && !categorias.includes(tx.categoria) ? [tx.categoria, ...categorias] : categorias;
  return (
    <select
      className={`input ${compact ? "!py-1 !text-xs" : ""} ${!tx.categoria ? "border-warn" : ""}`}
      aria-label={`Categoría de ${tx.comercio || tx.contraparte || tx.id}`}
      data-testid={`cat-${tx.id}`}
      value={tx.categoria}
      disabled={saving}
      onChange={async (e) => { setSaving(true); try { await recategorize(tx, e.target.value); } finally { setSaving(false); } }}
    >
      <option value="">Por categorizar</option>
      {opts.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
