"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Campo con etiqueta accesible. */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-warn" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Notice({ kind = "info", children, action }: { kind?: "info" | "warn" | "ok"; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={kind === "warn" ? "alert" : "status"} className={`notice fade-in ${kind === "warn" ? "warn" : kind === "ok" ? "ok" : ""}`}>
      <i className={`dot flex-none ${kind === "warn" ? "warn" : kind === "info" ? "off" : ""}`} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** Botón que copia texto al portapapeles y confirma en línea. */
export function CopyButton({ text, label = "Copiar", className = "btn" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t); }, [done]);
  return (
    <button type="button" className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); } catch { window.prompt("Copia este texto:", text); }
    }}>{done ? "Copiado ✓" : label}</button>
  );
}

export const SRC_LABEL: Record<string, string> = { bcp_email: "BCP email", yape_email: "Yape email", yape_push: "Yape push", ios_push: "Yape push", manual: "Manual", ai_import: "IA" };
export const TIPO_LABEL: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer_in: "Recibido por Yape", internal_transfer: "Entre cuentas", rejected: "Rechazado" };

export function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
