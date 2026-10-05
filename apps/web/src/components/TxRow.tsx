"use client";

/** Fila de movimiento compartida por Resumen y Movimientos (DESIGN.md §Components · Fila de movimiento). */
import { useId, useState, type ReactNode } from "react";
import { fmtMoney, fmtPEN, toBase, txLabel, type Tx } from "@/lib/ledger";
import { catColor } from "@/lib/categorias";
import CategoryIcon from "./CategoryIcon";
import { SRC_LABEL } from "./ui";

/** Texto secundario por tipo: categoría, pendiente o explicación de por qué no cuenta. */
export function txKind(t: Tx): ReactNode {
  if (t.tipo === "internal_transfer") return "Entre cuentas · no cuenta como gasto";
  if (t.tipo === "transfer_in") return "Recibido por Yape";
  if (t.categoria) return t.categoria;
  if (t.tipo === "expense") return <span className="font-semibold text-warning">Por categorizar</span>;
  return t.tipo;
}

export const txSign = (t: Tx) => (t.tipo === "income" || t.tipo === "transfer_in" ? "+ " : t.tipo === "internal_transfer" ? "" : "− ");

type Props = {
  t: Tx;
  usdRate: number;
  /** Contenido desplegable (detalle, acciones). Si existe, la fila es un botón que lo abre. */
  detail?: ReactNode;
  /** Etiqueta del botón de despliegue para lectores de pantalla. */
  detailLabel?: string;
  /** Texto bajo el importe; por defecto "≈ S/ …" en USD. */
  amountSub?: ReactNode;
  /** Extra al final de la línea secundaria (flags, etc.). */
  meta?: ReactNode;
  testId?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function TxRow({ t, usdRate, detail, detailLabel = "Ver detalle", amountSub, meta, testId, className = "", style }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const dim = t.tipo === "internal_transfer";
  const neutral = dim || !t.categoria;
  const sub = amountSub ?? (t.moneda === "USD" ? <>≈ {fmtPEN(toBase(t, usdRate))}</> : null);

  const head = (
    <>
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[13px] font-semibold ${neutral ? "text-body" : "text-[#1d1a17]"}`}
        style={{ background: dim ? "var(--strong)" : catColor(t.categoria) }} aria-hidden><CategoryIcon categoria={t.categoria} tipo={t.tipo} /></span>
      <span className="min-w-0">
        <span className={`block truncate text-[14.5px] ${dim ? "font-medium text-muted" : "font-semibold"}`}>{txLabel(t)}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
          {txKind(t)}<span className="tag">{SRC_LABEL[t.fuente] ?? t.fuente}</span>{meta}
        </span>
      </span>
      <span className="text-right">
        <span className={`num block whitespace-nowrap text-[14.5px] font-medium ${t.tipo === "income" ? "text-success" : dim ? "text-muted" : ""}`}>{txSign(t)}{fmtMoney(t.monto, t.moneda)}</span>
        {sub && <span className="num block text-[11.5px] text-muted">{sub}</span>}
      </span>
    </>
  );

  const grid = "grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left";
  return (
    <li className={className} style={style} data-testid={testId}>
      {detail ? (
        <>
          <button type="button" className={`${grid} transition-colors hover:bg-sunken`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} aria-label={`${txLabel(t)}. ${detailLabel}`}>
            {head}
          </button>
          <div id={id} className="expand" data-open={open}>
            <div>{open && <div className="px-3 pb-3 pt-1">{detail}</div>}</div>
          </div>
        </>
      ) : (
        <div className={grid}>{head}</div>
      )}
    </li>
  );
}
