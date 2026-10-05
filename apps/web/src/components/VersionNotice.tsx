"use client";

/** Aviso de nueva versión de LucaLib (ADR-006 §5: las copias no se actualizan solas). Descartable por versión. */
import { useState } from "react";
import { versionStatus } from "@/lib/ajustes";
import { useLedger } from "./LedgerProvider";
import { IconCerrar } from "./icons";

const VERSION_KEY = "luca.versionNotice.hidden";

export default function VersionNotice() {
  const { state, libVersion } = useLedger();
  const [hidden, setHidden] = useState<string | null>(() => { try { return localStorage.getItem(VERSION_KEY); } catch { return null; } });
  if (state.phase !== "ready") return null;
  const v = versionStatus(state.data.ajustes, libVersion);
  if (!v.outdated || hidden === v.latest) return null;
  const url = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  return (
    <div className="notice fade-in" role="status" data-testid="version-notice">
      <span className="min-w-[220px] flex-1"><b className="font-semibold">LucaLib v{v.latest} disponible.</b> Tu copia usa v{v.current}. En tu Sheet: <b className="font-semibold">Extensiones → Apps Script → Bibliotecas → LucaLib → versión {v.latest} → Guardar</b>.</span>
      <span className="flex items-center gap-1.5">
        <a className="btn sm" href={url} target="_blank" rel="noreferrer">Abrir mi Sheet ↗</a>
        <button type="button" className="btn ghost icon sm !w-8" aria-label="Ocultar este aviso" onClick={() => { try { localStorage.setItem(VERSION_KEY, v.latest); } catch { /* sin storage */ } setHidden(v.latest); }}><IconCerrar size={16} /></button>
      </span>
    </div>
  );
}
