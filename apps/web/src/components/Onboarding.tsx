"use client";

/** Onboarding en 3 pasos (ADR-006 §3): stepper persistente arriba del dashboard hasta completar. */
import Link from "next/link";
import { useMemo } from "react";
import { connectionsStatus, isAuthorized } from "@/lib/ajustes";
import { currentStep, STEP_TITLES, type OnboardingStep } from "@/lib/onboarding";
import { useLedger } from "./LedgerProvider";

export function useOnboardingStep(): OnboardingStep {
  const { state, connectionsSkipped } = useLedger();
  return useMemo(() => {
    if (state.phase === "loading") return null;
    if (state.phase === "nofile") return 1;
    const c = connectionsStatus(state.data.ajustes);
    return currentStep({
      hasFile: true,
      authorized: isAuthorized(state.data.ajustes, state.data.hasMovimientos),
      connectionsActive: c.webAppReady || c.iphone.connected || c.mcp.connected,
      connectionsSkipped,
    });
  }, [state, connectionsSkipped]);
}

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="mb-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Progreso del onboarding">
      {([1, 2, 3] as const).map((n) => (
        <li key={n} className={`pill ${n === step ? "border-accent text-text" : ""}`} aria-current={n === step ? "step" : undefined}>
          <i className={`dot ${n < step ? "" : n === step ? "warn" : "off"}`} /> {n}. {STEP_TITLES[n]}{n === 3 ? " (opcional)" : ""}
        </li>
      ))}
    </ol>
  );
}

export function Step1Sheet() {
  const { state, crearSheet, elegirExistente, mode } = useLedger();
  const busy = state.phase === "nofile" ? state.busy : undefined;
  const error = state.phase === "nofile" ? state.error : undefined;
  return (
    <section className="card mx-auto max-w-xl" data-testid="onboarding-step1">
      <Stepper step={1} />
      <h2 className="text-2xl font-bold">Crea tu Sheet de Luca</h2>
      <p className="mt-2 text-sm text-muted">
        Luca guarda tus movimientos en una hoja de cálculo <b className="text-text">de tu propiedad</b>, en tu Google Drive.
        Solo pedimos permiso sobre ese archivo (y ningún otro).
      </p>
      <ol className="mt-4 space-y-2 text-sm text-muted">
        <li>1. Pulsa <b className="text-text">Crear mi Sheet</b>. Se abre el selector de Google: elige <b className="text-text">&quot;Luca — Plantilla&quot;</b> (está en &quot;Compartidos conmigo&quot; o búscala por nombre).</li>
        <li>2. Hacemos una copia a tu nombre con el script de Luca incluido.</li>
        <li>3. En la copia, menú <b className="text-text">Luca → Autorizar</b>: le das permiso a <i>tu propio</i> script para leer tus correos de BCP/Yape. No a nosotros.</li>
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn primary" onClick={crearSheet} disabled={!!busy}>Crear mi Sheet</button>
        <button className="btn" onClick={elegirExistente} disabled={!!busy}>Ya tengo una</button>
      </div>
      {busy && <p className="mt-3 text-sm text-muted" role="status">{busy}</p>}
      {error && <p className="mt-3 text-sm text-warn" role="alert">Error: {error}</p>}
      {mode === "mock" && <p className="mt-3 text-xs text-muted">Modo de prueba: el selector de Google está simulado.</p>}
    </section>
  );
}

function Screenshot({ caption }: { caption: string }) {
  return (
    <figure className="rounded-lg border border-dashed border-border bg-panel-2 p-3 text-center text-[11px] text-muted">
      <div className="mx-auto mb-2 flex h-20 w-full max-w-[220px] items-center justify-center rounded border border-border bg-panel text-[10px]">captura de pantalla</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Step2Authorize() {
  const { state, refresh, refreshing } = useLedger();
  if (state.phase !== "ready") return null;
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  return (
    <section className="card mb-4 border-accent" data-testid="onboarding-step2">
      <Stepper step={2} />
      <h2 className="text-xl font-bold">Autoriza tu script en el Sheet</h2>
      <p className="mt-2 text-sm text-muted">
        Tu Sheet existe pero el script todavía no ha escrito nada. Ábrela, espera a que aparezca el menú <b className="text-text">Luca</b> y pulsa
        <b className="text-text"> Autorizar</b>. Al terminar, importa automáticamente tu último mes de correos.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Screenshot caption="1 · Menú Luca → Autorizar" />
        <Screenshot caption='2 · "Google no ha verificado esta app": Avanzado → Ir a Luca' />
        <Screenshot caption="3 · Permitir. El script es tuyo: el permiso se lo das a tu propia copia" />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="btn primary" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet y autorizar ↗</a>
        <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Comprobando…" : "Ya autoricé → Actualizar"}</button>
      </div>
    </section>
  );
}

export function Step3Connections() {
  const { state, skipConnections } = useLedger();
  if (state.phase !== "ready") return null;
  const c = connectionsStatus(state.data.ajustes);
  return (
    <section className="card mb-4" data-testid="onboarding-step3">
      <Stepper step={3} />
      <h2 className="text-xl font-bold">Activa las conexiones (opcional)</h2>
      <p className="mt-2 text-sm text-muted">
        Con el correo ya tienes tus gastos. Si además quieres los yapeos que recibes en el iPhone o preguntarle a tu IA, publica el script
        como Web App desde tu Sheet. Luca nunca ve esos datos: van de tu teléfono o tu IA a <i>tu</i> script.
      </p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <li className="pill"><i className={`dot ${c.webAppReady ? "" : "off"}`} /> Web App {c.webAppReady ? "publicada" : "sin publicar"}</li>
        <li className="pill"><i className={`dot ${c.iphone.connected ? "" : "off"}`} /> iPhone {c.iphone.connected ? "conectado" : "no configurado"}</li>
        <li className="pill"><i className={`dot ${c.mcp.connected ? "" : "off"}`} /> IA {c.mcp.connected ? "conectada" : "no configurada"}</li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link className="btn primary" href="/app/conexiones">Ver la guía de conexiones</Link>
        <button className="btn" onClick={() => skipConnections(true)}>Omitir por ahora</button>
      </div>
    </section>
  );
}
