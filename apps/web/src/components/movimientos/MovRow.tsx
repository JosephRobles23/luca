"use client";

/**
 * Fila de la lista de Movimientos: `TxRow` con flags como etiqueta, equivalencia en soles con el tipo de cambio
 * usado y un detalle desplegable (categoría con un toque, marcar como transferencia y la ficha completa).
 */
import { useState, type CSSProperties } from "react";
import { fmtPEN, toBase, type Tx } from "@/lib/ledger";
import { planMarkTransfer } from "@/lib/sheets-ops";
import { canMarkTransfer } from "@/lib/movimientos";
import TxRow from "../TxRow";
import CategoryChips from "../CategoryChips";
import { useLedger } from "../LedgerProvider";
import { DrawCheck } from "../motion";
import { SRC_LABEL } from "../ui";

export default function MovRow({ t, usdRate, highlight, className, style }: { t: Tx; usdRate: number; highlight?: string; className?: string; style?: CSSProperties }) {
  const amountSub = t.moneda === "USD"
    ? <>≈ {fmtPEN(toBase(t, usdRate))}<span className="block">TC {t.tipoCambio ?? usdRate}{t.tipoCambio ? "" : " (Ajustes)"}</span></>
    : undefined;
  const meta = t.flags.length ? t.flags.map((fl) => <span key={fl} className="tag text-warning" title="Señal del parser">{fl}</span>) : undefined;
  return (
    <TxRow t={t} usdRate={usdRate} testId={`mov-${t.id}`} amountSub={amountSub} meta={meta} style={style} highlight={highlight}
      className={`rounded-xl transition-colors has-[>button[aria-expanded=true]]:bg-sunken ${className ?? ""}`}
      detail={<MovDetail t={t} />} />
  );
}

function MovDetail({ t }: { t: Tx }) {
  const { markTransfer } = useLedger();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const plan = planMarkTransfer(t);
  const canTransfer = canMarkTransfer(t, plan);
  const categorizable = t.tipo === "expense" || t.tipo === "income";

  async function onTransfer() {
    setBusy(true);
    try {
      if (await markTransfer(t)) setDone(plan.kind === "category" ? "Categorizado como Transferencias en tu Sheet." : "Marcado como movimiento entre tus cuentas.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3">
      {categorizable ? <CategoryChips tx={t} /> : (
        <p className="text-[13px] text-muted">{t.tipo === "internal_transfer" ? "No cuenta en tus KPIs." : "Yapeo recibido · no cuenta como ingreso."}</p>
      )}
      {(canTransfer || done) && (
        <div className="flex flex-wrap items-center gap-3">
          {canTransfer && (
            <button type="button" className="btn sm" disabled={busy} data-testid={`transfer-${t.id}`}
              title={plan.kind === "category" ? "Lo categoriza como Transferencias y lo aprende para esta persona" : "Lo marca como movimiento entre tus cuentas: sale de los gastos"}
              onClick={onTransfer}>
              {busy ? "Guardando…" : "Marcar como transferencia"}
            </button>
          )}
          {done && <span className="flex items-center gap-2 text-[13px] font-medium text-success" role="status"><DrawCheck size={18} />{done}</span>}
        </div>
      )}
      <dl className="grid rounded-xl border border-line bg-card grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3.5 py-3 text-[12.5px]">
        <Dt k="Id" v={t.id} mono /><Dt k="Fecha" v={t.fecha} mono />
        <Dt k="Fuente" v={`${SRC_LABEL[t.fuente] ?? t.fuente}${t.canal ? ` · canal ${t.canal}` : ""}`} />
        <Dt k="Medio" v={t.medio} /><Dt k="Asunto" v={t.asunto} /><Dt k="Comercio" v={t.comercio} />
        <Dt k="Contraparte" v={t.contraparte ? `${t.contraparte}${t.contraparteKey ? ` (${t.contraparteKey})` : ""}` : ""} />
        <Dt k="Categoría" v={t.categoria ? `${t.categoria} (origen: ${t.categoriaOrigen || "—"})` : "por categorizar"} />
        <Dt k="Tipo de cambio" v={t.tipoCambio ? String(t.tipoCambio) : ""} mono /><Dt k="Operación" v={t.operacion} mono />
        <Dt k="Gmail id" v={t.gmailId} mono /><Dt k="Flags" v={t.flags.join(", ")} /><Dt k="Creado" v={t.creadoEn} mono />
      </dl>
    </div>
  );
}

function Dt({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  if (!v) return null;
  return <><dt className="text-muted">{k}</dt><dd className={`break-all text-body ${mono ? "num text-[12px]" : ""}`}>{v}</dd></>;
}
