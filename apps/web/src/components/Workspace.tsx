"use client";

import { useCallback, useEffect, useState } from "react";
import { copyTemplate, findLedgerFiles, GoogleApiError, pickSpreadsheet, readRange, tagAsLedger, type LedgerFile } from "@/lib/google";
import { rowsToTxs, type Tx } from "@/lib/ledger";
import Dashboard from "./Dashboard";

type Props = {
  accessToken: string;
  user: { name: string; email: string; image: string };
  cfg: { apiKey: string; appId: string; templateId: string };
  signOutAction: () => Promise<void>;
};

type Stage =
  | { kind: "loading" }
  | { kind: "onboarding"; error?: string; busy?: string }
  | { kind: "ready"; file: LedgerFile; txs: Tx[]; needsAuth: boolean; error?: string; refreshing?: boolean };

const LS_KEY = "luca.sheetId";

export default function Workspace({ accessToken, user, cfg, signOutAction }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  const loadLedger = useCallback(async (file: LedgerFile) => {
    try {
      const rows = await readRange(accessToken, file.id, "Movimientos!A:S");
      try { localStorage.setItem(LS_KEY, file.id); } catch { /* sin storage */ }
      setStage({ kind: "ready", file, txs: rowsToTxs(rows), needsAuth: false });
    } catch (e) {
      // La pestaña Movimientos la crea el Apps Script al autorizar: si no existe, falta ese paso.
      const notYet = e instanceof GoogleApiError && e.status === 400 && /Unable to parse range/i.test(e.message);
      setStage({ kind: "ready", file, txs: [], needsAuth: notYet, error: notYet ? undefined : String((e as Error).message) });
    }
  }, [accessToken]);

  // Al entrar: busca la Sheet de Luca en el Drive del usuario (sin base de datos nuestra).
  useEffect(() => {
    (async () => {
      try {
        const files = await findLedgerFiles(accessToken);
        let cached: string | null = null;
        try { cached = localStorage.getItem(LS_KEY); } catch { /* sin storage */ }
        const file = files.find((f) => f.id === cached) ?? files[0];
        if (file) await loadLedger(file);
        else setStage({ kind: "onboarding" });
      } catch (e) {
        setStage({ kind: "onboarding", error: (e as Error).message });
      }
    })();
  }, [accessToken, loadLedger]);

  async function crearSheet() {
    setStage({ kind: "onboarding", busy: "Elige la plantilla de Luca en el selector…" });
    try {
      // Elegir la plantilla en el Picker la mete en alcance de drive.file (validado en S1).
      const picked = await pickSpreadsheet({ token: accessToken, apiKey: cfg.apiKey, appId: cfg.appId, title: 'Elige "Luca — Plantilla" para crear tu copia' });
      if (!picked) return setStage({ kind: "onboarding" });
      setStage({ kind: "onboarding", busy: "Creando tu Sheet…" });
      const file = await copyTemplate(accessToken, picked.id, `Luca Ledger — ${user.name || user.email}`);
      await loadLedger(file);
    } catch (e) {
      setStage({ kind: "onboarding", error: (e as Error).message });
    }
  }

  async function elegirExistente() {
    setStage({ kind: "onboarding", busy: "Elige tu Sheet de Luca…" });
    try {
      const picked = await pickSpreadsheet({ token: accessToken, apiKey: cfg.apiKey, appId: cfg.appId, title: "Elige tu Sheet de Luca" });
      if (!picked) return setStage({ kind: "onboarding" });
      const file = await tagAsLedger(accessToken, picked.id);
      await loadLedger(file);
    } catch (e) {
      setStage({ kind: "onboarding", error: (e as Error).message });
    }
  }

  async function refrescar() {
    if (stage.kind !== "ready") return;
    setStage({ ...stage, refreshing: true });
    await loadLedger(stage.file);
  }

  function cambiarSheet() {
    try { localStorage.removeItem(LS_KEY); } catch { /* sin storage */ }
    setStage({ kind: "onboarding" });
  }

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-extrabold tracking-tight">luca<span className="text-accent">.</span></div>
        <div className="flex flex-wrap items-center gap-2">
          {stage.kind === "ready" && (
            <>
              <span className="pill"><i className="dot" /> Sheet conectada</span>
              <span className="pill"><i className={`dot ${stage.needsAuth ? "warn" : ""}`} /> Apps Script {stage.needsAuth ? "sin autorizar" : "activo"}</span>
              <span className="pill"><i className="dot off" /> MCP · próximamente</span>
              <a className="btn" href={stage.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${stage.file.id}/edit`} target="_blank" rel="noreferrer">Abrir Sheet ↗</a>
              <button className="btn" onClick={refrescar} disabled={stage.refreshing}>{stage.refreshing ? "Actualizando…" : "Actualizar"}</button>
              <button className="btn" onClick={cambiarSheet}>Cambiar Sheet</button>
            </>
          )}
          <span className="pill">{user.email}</span>
          <form action={signOutAction}><button className="btn" type="submit">Salir</button></form>
        </div>
      </header>

      {stage.kind === "loading" && <p className="text-muted">Buscando tu Sheet de Luca en tu Drive…</p>}

      {stage.kind === "onboarding" && (
        <section className="card mx-auto max-w-xl">
          <div className="label">Paso 1 de 3 · Tu Sheet</div>
          <h2 className="text-2xl font-bold">Crea tu Sheet de Luca</h2>
          <p className="mt-2 text-sm text-muted">
            Luca guarda tus movimientos en una hoja de cálculo <b className="text-text">de tu propiedad</b>, en tu Google Drive.
            Nosotros solo pedimos permiso sobre ese archivo (y ningún otro).
          </p>
          <ol className="mt-4 space-y-2 text-sm text-muted">
            <li>1. Pulsa <b className="text-text">Crear mi Sheet</b>. Se abrirá el selector de Google: elige <b className="text-text">&quot;Luca — Plantilla&quot;</b> (está en &quot;Compartidos conmigo&quot; o búscala por nombre).</li>
            <li>2. Hacemos una copia a tu nombre con el script de Luca incluido.</li>
            <li>3. Abres la copia y, en el menú <b className="text-text">Luca → Autorizar</b>, le das permiso para leer tus correos de BCP/Yape. Ese permiso se lo das a <i>tu propio</i> script, no a nosotros.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn primary" onClick={crearSheet} disabled={!!stage.busy}>Crear mi Sheet</button>
            <button className="btn" onClick={elegirExistente} disabled={!!stage.busy}>Ya tengo una</button>
          </div>
          {stage.busy && <p className="mt-3 text-sm text-muted">{stage.busy}</p>}
          {stage.error && <p className="mt-3 text-sm text-warn">Error: {stage.error}</p>}
          {!cfg.apiKey || !cfg.appId ? <p className="mt-3 text-xs text-warn">Falta configurar NEXT_PUBLIC_GOOGLE_PICKER_KEY / NEXT_PUBLIC_GOOGLE_APP_ID.</p> : null}
        </section>
      )}

      {stage.kind === "ready" && stage.needsAuth && (
        <section className="card mb-4 border-accent">
          <div className="label">Paso 2 de 3 · Autorizar tu script</div>
          <p className="text-sm">
            Tu Sheet existe pero todavía no tiene movimientos. Ábrela, espera a que aparezca el menú <b>Luca</b> y pulsa
            <b> Autorizar / Escanear ahora</b>. Google te mostrará una pantalla de &quot;app no verificada&quot; porque el script es tuyo
            y nuevo: pulsa <i>Avanzado → Ir a Luca</i> y acepta. Después vuelve aquí y pulsa <b>Actualizar</b>.
          </p>
          <a className="btn primary mt-3 inline-block" href={`https://docs.google.com/spreadsheets/d/${stage.file.id}/edit`} target="_blank" rel="noreferrer">Abrir mi Sheet y autorizar ↗</a>
        </section>
      )}

      {stage.kind === "ready" && stage.error && <p className="mb-4 text-sm text-warn">No pude leer la hoja: {stage.error}</p>}
      {stage.kind === "ready" && <Dashboard txs={stage.txs} />}
    </div>
  );
}
