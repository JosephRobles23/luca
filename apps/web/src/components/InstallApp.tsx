"use client";

/**
 * Instalar la app (ADR-011, DESIGN.md §Components · App en tu celular). `InstallCard` va en Ajustes y dice qué hacer
 * en este navegador: ya instalada, botón "Instalar app" (diálogo del navegador) o los pasos de iPhone (iOS no tiene
 * diálogo). `InstallNotice` es el aviso discreto del Resumen: solo en teléfonos, se oculta para siempre con la X.
 */
import Link from "next/link";
import { useState } from "react";
import type { InstallMode } from "@/lib/pwa";
import { useCoarsePointer } from "./Dropdown";
import { CardHead, StatusPill } from "./conexiones/parts";
import { IconAnadir, IconCerrar, IconCompartir, IconIphone } from "./icons";
import { useInstall } from "./Pwa";

const HIDDEN_KEY = "luca.installNotice.hidden";

function IosSteps() {
  return (
    <ol className="grid gap-2.5 text-[14px] text-body" data-testid="install-ios-steps">
      <li className="flex items-center gap-3"><span className="grid size-8 flex-none place-items-center rounded-[9px] bg-sunken text-ink"><IconCompartir size={17} /></span>
        <span>En Safari, toca <b className="font-medium text-ink">Compartir</b> (abajo, o arriba en iPad).</span></li>
      <li className="flex items-center gap-3"><span className="grid size-8 flex-none place-items-center rounded-[9px] bg-sunken text-ink"><IconAnadir size={17} /></span>
        <span>Elige <b className="font-medium text-ink">Añadir a pantalla de inicio</b> y luego <b className="font-medium text-ink">Añadir</b>.</span></li>
      <li className="flex items-center gap-3"><span className="grid size-8 flex-none place-items-center rounded-[9px] bg-sunken text-ink"><IconIphone size={17} /></span>
        <span>Abre Luca desde el ícono y entra con Google una vez: la app guarda su propia sesión.</span></li>
    </ol>
  );
}

export function InstallCard({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { mode, prompt } = useInstall();
  const [busy, setBusy] = useState(false);
  const pill = mode === "installed" ? { tone: "ok" as const, label: "instalada" } : { tone: "off" as const, label: "sin instalar" };
  return (
    <section className={`card grid gap-4 ${className ?? ""}`} style={style} aria-labelledby="app-h" id="app" data-testid="install-card" data-mode={mode ?? ""}>
      <CardHead id="app-h" icon={<IconIphone />} title="App en tu celular"
        sub="Ábrela desde un ícono, a pantalla completa. Sin internet verás tus últimos datos guardados en el dispositivo (solo lectura)."
        pill={mode && <StatusPill pill={pill} testId="install-pill" />} />
      {mode === "installed" && <p className="text-[14px] text-body">Ya la usas como app en este dispositivo.</p>}
      {mode === "prompt" && (
        <div>
          <button type="button" className="btn primary" disabled={busy} data-testid="install-button"
            onClick={async () => { setBusy(true); try { await prompt(); } finally { setBusy(false); } }}>
            <IconAnadir size={17} />{busy ? "Abriendo…" : "Instalar app"}
          </button>
        </div>
      )}
      {mode === "ios" && <IosSteps />}
      {mode === "unsupported" && (
        <p className="text-[14px] text-body" data-testid="install-unsupported">Para instalarla, abre lucaa.lat en tu celular: <b className="font-medium text-ink">Safari</b> en iPhone o <b className="font-medium text-ink">Chrome</b> en Android.</p>
      )}
    </section>
  );
}

const offered = (m: InstallMode | null) => m === "prompt" || m === "ios";

export function InstallNotice() {
  const { mode, prompt } = useInstall();
  const phone = useCoarsePointer();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; } });
  if (!phone || hidden || !offered(mode)) return null;
  const hide = () => { try { localStorage.setItem(HIDDEN_KEY, "1"); } catch { /* sin storage */ } setHidden(true); };
  return (
    <div className="notice fade-in" role="status" data-testid="install-notice">
      <span className="min-w-[200px] flex-1"><b className="font-semibold">Lleva Luca en tu celular.</b> Instálala como app y mira tus últimos datos aunque no tengas internet.</span>
      <span className="flex items-center gap-1.5">
        {mode === "prompt"
          ? <button type="button" className="btn sm" onClick={() => void prompt()}>Instalar</button>
          : <Link className="btn sm" href="/app/ajustes#app">Cómo instalar</Link>}
        <button type="button" className="btn ghost icon sm !w-8" aria-label="Ocultar este aviso" onClick={hide}><IconCerrar size={16} /></button>
      </span>
    </div>
  );
}
