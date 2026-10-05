"use client";

/**
 * Onboarding por fases (ADR-009, sustituye ADR-006 §3): persistente arriba del dashboard hasta completar.
 * 1 Tu copia ("Copiar a mi Drive" + "Elegir mi copia") · 2 Autorizar (se detecta solo) · 3 Importación (en vivo,
 * solo mientras corre) · 4 Conexiones (opcional): la "configuración plegable" de DESIGN.md, que desaparece al
 * completar u omitir. Cada fase avanza sola leyendo la Sheet; el estado se deduce de ella (se retoma donde quedó).
 */
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { connectionsStatus, importStatus, isAuthorized } from "@/lib/ajustes";
import { COPY_QUERY, currentStep, POLL_MS, STEP_OPTIONAL, STEP_TITLES, templateCopyUrl, type OnboardingStep } from "@/lib/onboarding";
import { IconChevron, IconCopiar, IconExterno } from "./icons";
import { useLedger } from "./LedgerProvider";

export function useOnboardingStep(): OnboardingStep {
  const { state, connectionsSkipped, importDismissed } = useLedger();
  return useMemo(() => {
    if (state.phase === "loading") return null;
    if (state.phase === "nofile") return 1;
    const c = connectionsStatus(state.data.ajustes);
    return currentStep({
      hasFile: true,
      authorized: isAuthorized(state.data.ajustes, state.data.hasMovimientos),
      importRunning: importStatus(state.data.ajustes).running,
      importDismissed,
      connectionsActive: c.webAppReady || c.iphone.connected || c.mcp.connected,
      connectionsSkipped,
    });
  }, [state, connectionsSkipped, importDismissed]);
}

/** Vuelve a leer la Sheet cada POLL_MS (solo con la pestaña visible) y al volver a ella: así cada fase avanza sola. */
function usePoll(fn: () => void, on: boolean) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!on) return;
    const tick = () => { if (document.visibilityState === "visible") ref.current(); };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(id); window.removeEventListener("focus", tick); };
  }, [on]);
}

const TOTAL = 4;

/** Anillo de progreso n/3; el arco se dibuja al aparecer. */
function ProgressRing({ done, total = TOTAL, size = 44 }: { done: number; total?: number; size?: number }) {
  const pct = Math.round((done / total) * 1000) / 10;
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" role="img" aria-label={`${done} de ${total} pasos completados`} className="flex-none">
      <circle cx="19" cy="19" r="15" fill="none" stroke="var(--strong)" strokeWidth="4" />
      {done > 0 && (
        <circle cx="19" cy="19" r="15" fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round" pathLength={100}
          transform="rotate(-90 19 19)" className="draw" style={{ strokeDasharray: `${pct} 200`, "--len": pct } as CSSProperties} />
      )}
      <text x="19" y="22.5" textAnchor="middle" fontFamily="var(--font-geist-mono), ui-monospace, monospace" fontSize="10" fill="var(--ink)">{done}/{total}</text>
    </svg>
  );
}

const CheckDisc = ({ size = 16, label }: { size?: number; label?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="flex-none" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
    <circle cx="12" cy="12" r="11" fill="var(--success)" />
    <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="var(--card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Progreso del onboarding">
      {([1, 2, 3, 4] as const).map((n) => {
        const st = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li key={n} className="grid min-w-0 gap-2" aria-current={n === step ? "step" : undefined}>
            <span className="block h-1 overflow-hidden rounded-full bg-strong" aria-hidden>
              {st !== "next" && <span className={`grow-x block h-full rounded-full ${st === "done" ? "bg-success" : "bg-primary"}`} style={{ "--i": n } as CSSProperties} />}
            </span>
            <span className={`flex min-w-0 items-start gap-1.5 text-[12.5px] [&>i]:mt-[3px] [&>svg]:mt-px ${st === "next" ? "text-muted" : "text-ink"} ${st === "now" ? "font-semibold" : ""}`}>
              {st === "done" ? <CheckDisc /> : <i aria-hidden className={`block size-3 flex-none rounded-full border-2 ${st === "now" ? "border-primary bg-primary-soft" : "border-line-strong"}`} />}
              <span className="min-w-0 leading-snug">{n}. {STEP_TITLES[n]}{n === STEP_OPTIONAL ? <span className="hidden sm:inline"> (opcional)</span> : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Cabecera común de las fases 1 a 3: anillo + "Paso n de 4" + título. */
function StepHead({ done, title, children }: { done: number; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <ProgressRing done={done} />
      <div className="min-w-0">
        <p className="eyebrow">Paso {done + 1} de {TOTAL}</p>
        <h2 className="page-title mt-1">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">{children}</p>
      </div>
    </div>
  );
}

/** Ilustración del paso 1: la plantilla se copia a tu Drive y tu Sheet se llena de filas. */
function SheetCopyArt() {
  const rows = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 320 120" className="h-auto w-full max-w-[340px]" aria-hidden>
      <g opacity=".75">
        <rect x="14" y="14" width="96" height="92" rx="10" fill="var(--card)" stroke="var(--line-strong)" strokeDasharray="4 4" />
        <text x="62" y="36" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--font-geist-mono), monospace">PLANTILLA</text>
        {rows.map((r) => <rect key={r} x="28" y={48 + r * 13} width={r % 2 ? 52 : 68} height="5" rx="2.5" fill="var(--line-strong)" />)}
      </g>
      <path d="M122 60h66" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" pathLength={100} className="draw" style={{ animationDelay: "150ms" }} />
      <path d="M187 54l7 6-7 6" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle r="4.5" fill="var(--primary)" className="motion-reduce:hidden"><animateMotion dur="2.4s" repeatCount="indefinite" path="M124 60h60" /></circle>
      <rect x="208" y="10" width="100" height="100" rx="12" fill="var(--card)" stroke="color-mix(in srgb, var(--success) 50%, var(--line))" />
      <text x="222" y="32" fontSize="10" fill="var(--success)" fontFamily="var(--font-geist-mono), monospace">TU SHEET</text>
      {rows.map((r) => (
        <rect key={r} x="222" y={46 + r * 14} width={r % 2 ? 56 : 72} height="6" rx="3" fill="var(--strong)" className="grow-x" style={{ "--i": r + 4, transformBox: "fill-box" } as CSSProperties} />
      ))}
      <g className="pop" style={{ animationDelay: "650ms", transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx="300" cy="16" r="11" fill="var(--success)" />
        <path d="M295 16.5l3.2 3.2 6-6.4" fill="none" stroke="var(--card)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

const LS_COPIADO = "luca.onboarding.copiado";
const leerCopiado = () => { try { return !!localStorage.getItem(LS_COPIADO); } catch { return false; } };

/** Una sub-fase numerada del paso 1: número → check al completarse; resaltada si es la siguiente acción. */
function Fase({ n, title, done, active, children, actions }: { n: number; title: string; done?: boolean; active?: boolean; children: ReactNode; actions: ReactNode }) {
  return (
    <li className={`sunken grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 px-4 py-3.5 transition-shadow duration-200 ${active ? "shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_45%,transparent)]" : ""}`}
      aria-current={active ? "step" : undefined}>
      {done ? <CheckDisc size={28} label="Hecho" /> : (
        <span className={`num grid size-7 place-items-center rounded-full text-[13px] ${active ? "bg-primary-strong text-white" : "bg-card text-muted ring-1 ring-line"}`} aria-hidden>{n}</span>
      )}
      <div className="grid min-w-0 gap-2.5">
        <div>
          <b className="block text-[15px] font-semibold text-ink"><span className="sr-only">{n}. </span>{title}</b>
          <p className="mt-0.5 text-sm leading-relaxed text-body">{children}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </li>
  );
}

export function Step1Sheet() {
  const { state, crearSheet, elegirExistente, elegirCopia, mode, templateId, templateFolderId } = useLedger();
  const busy = state.phase === "nofile" ? state.busy : undefined;
  const error = state.phase === "nofile" ? state.error : undefined;
  const plantilla = templateId || "1kQWNaj9J29LRK-LsdCAxrplW06heaTvS3Hje3NV1htg";
  const carpeta = `https://drive.google.com/drive/folders/${templateFolderId || "18aQXOYlyznY6xZm3ViRdVrFWILLXsHQL"}?usp=sharing`;
  const [copiado, setCopiado] = useState(leerCopiado);
  const [volvio, setVolvio] = useState(false);
  // Tras abrir la copia en otra pestaña, al volver a esta resaltamos "Elegir mi copia".
  useEffect(() => {
    if (!copiado) return;
    const f = () => setVolvio(true);
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [copiado]);
  const marcarCopiado = () => {
    setCopiado(true); setVolvio(false);
    try { localStorage.setItem(LS_COPIADO, "1"); } catch { /* sin storage */ }
  };
  return (
    <section className="card rise mx-auto grid w-full max-w-xl gap-5 sm:p-7" data-testid="onboarding-step1">
      <Stepper step={1} />
      <div className="sunken grid place-items-center px-4 py-5"><SheetCopyArt /></div>
      <StepHead done={0} title="Copia la plantilla a tu Drive">
        Luca guarda tus movimientos en una hoja de cálculo <b className="font-semibold text-ink">de tu propiedad</b>. La copia la haces tú,
        en tu Google Drive, y luego nos das permiso solo sobre ese archivo (y ningún otro).
      </StepHead>
      <ol className="grid gap-2.5">
        <Fase n={1} title="Haz tu copia" done={copiado} active={!copiado}
          actions={
            <a className={`btn lg ${copiado ? "" : "primary"}`} href={templateCopyUrl(plantilla)} target="_blank" rel="noopener noreferrer" onClick={marcarCopiado} data-testid="copy-template">
              <IconCopiar size={16} />{copiado ? "Copiar otra vez" : "Copiar a mi Drive"}<IconExterno size={15} />
            </a>
          }>
          Se abre Google Sheets: pulsa <b className="font-semibold text-ink">Hacer una copia</b>. Queda a tu nombre, con el script de Luca incluido.
        </Fase>
        <Fase n={2} title="Elige tu copia" active={copiado}
          actions={<button className={`btn lg ${copiado ? "primary" : ""}`} onClick={elegirCopia} disabled={!!busy} data-testid="pick-copy">Elegir mi copia</button>}>
          {copiado && volvio
            ? <>¿Ya tienes tu copia? Elígela en el selector de Google: se llama <b className="font-semibold text-ink">&quot;Copia de {COPY_QUERY}&quot;</b>.</>
            : <>Vuelve aquí y elígela en el selector de Google: se llama <b className="font-semibold text-ink">&quot;Copia de {COPY_QUERY}&quot;</b>. Así Luca solo puede abrir ese archivo.</>}
        </Fase>
      </ol>
      {busy && <p className="flex items-center gap-2 text-sm text-muted" role="status"><i className="dot warn skeleton" aria-hidden /> {busy}</p>}
      {error && <p className="notice warn" role="alert">Error: {error}</p>}
      <details className="group rounded-xl border border-line px-4 py-3 text-sm" data-testid="otras-formas">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink [&::-webkit-details-marker]:hidden">
          Otras formas de empezar <IconChevron size={16} className="text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3 text-body">
          <p>La plantilla <b className="font-semibold text-ink">&quot;Luca Template&quot;</b> está en la <a className="font-semibold text-ink underline underline-offset-2" href={carpeta} target="_blank" rel="noopener noreferrer" data-testid="template-folder-link">carpeta LUCA</a>.
            Puedes abrirla, hacer <b className="font-semibold text-ink">Archivo → Hacer una copia</b> y luego pulsar &quot;Ya tengo una&quot;.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={crearSheet} disabled={!!busy}>Crear mi Sheet</button>
            <button className="btn" onClick={elegirExistente} disabled={!!busy}>Ya tengo una</button>
            <a className="btn ghost" href={carpeta} target="_blank" rel="noopener noreferrer">Abrir carpeta LUCA <IconExterno size={15} /></a>
          </div>
          <p className="text-xs text-muted">&quot;Crear mi Sheet&quot; abre el selector en la carpeta LUCA para elegir la plantilla y la copiamos por ti.</p>
        </div>
      </details>
      {mode === "mock" && <p className="text-xs text-muted">Modo de prueba: el selector de Google está simulado.</p>}
    </section>
  );
}

/** Mini ilustraciones de lo que verá en Google al autorizar (esquemas, no capturas reales). */
function AuthFrame({ n, caption, children }: { n: number; caption: string; children: ReactNode }) {
  return (
    <figure className="rise grid content-start gap-2.5" style={{ "--i": n + 2 } as CSSProperties}>
      <div className="sunken grid h-[108px] place-items-center overflow-hidden px-3" aria-hidden>{children}</div>
      <figcaption className="text-[12.5px] leading-snug text-muted">{caption}</figcaption>
    </figure>
  );
}

function AuthArt() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <AuthFrame n={0} caption="1 · Menú Luca → Autorizar">
        <div className="w-full max-w-[170px] text-[11px]">
          <div className="flex gap-2.5 border-b border-line pb-1 text-muted"><span>Archivo</span><span>Ver</span><b className="font-semibold text-primary">Luca</b></div>
          <div className="ml-[60px] mt-1.5 w-[104px] rounded-lg border border-line bg-card p-1 shadow-[var(--halo)]">
            <div className="rounded-md bg-primary-soft px-2 py-1 font-medium text-ink">Autorizar</div>
            <div className="px-2 py-1 text-muted">Importar</div>
          </div>
        </div>
      </AuthFrame>
      <AuthFrame n={1} caption={'2 · "Google no ha verificado esta app": Avanzado → Ir a Luca'}>
        <div className="w-full max-w-[170px] rounded-lg border border-line bg-card p-2.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-ink"><span className="grid size-4 place-items-center rounded-full bg-warning-soft text-[10px] text-warning">!</span>App no verificada</div>
          <div className="mt-1.5 h-1.5 w-[85%] rounded-full bg-strong" />
          <div className="mt-2.5 flex justify-between text-muted"><span className="underline">Avanzado</span><span className="font-medium text-primary">Ir a Luca ›</span></div>
        </div>
      </AuthFrame>
      <AuthFrame n={2} caption="3 · Permitir. El script es tuyo: el permiso se lo das a tu propia copia">
        <div className="w-full max-w-[170px] rounded-lg border border-line bg-card p-2.5 text-[11px]">
          <div className="font-semibold text-ink">Tu script quiere:</div>
          <div className="mt-1.5 h-1.5 w-[70%] rounded-full bg-strong" />
          <div className="mt-1 h-1.5 w-[55%] rounded-full bg-strong" />
          <div className="mt-2 flex justify-end"><span className="pop rounded-md bg-primary-strong px-2 py-0.5 font-medium text-white" style={{ animationDelay: "500ms" }}>Permitir</span></div>
        </div>
      </AuthFrame>
    </div>
  );
}

export function Step2Authorize() {
  const { state, refresh, refreshing } = useLedger();
  usePoll(() => { if (!refreshing) void refresh(); }, state.phase === "ready");
  if (state.phase !== "ready") return null;
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  return (
    <section className="card rise mx-auto grid w-full max-w-3xl gap-5 border-[color-mix(in_srgb,var(--primary)_35%,var(--line))] sm:p-7" data-testid="onboarding-step2">
      <Stepper step={2} />
      <StepHead done={1} title="Autoriza tu script">
        Abre tu copia, espera a que aparezca el menú <b className="font-semibold text-ink">Luca</b> y pulsa <b className="font-semibold text-ink">Autorizar</b>.
        No tienes que volver a pulsar nada aquí: esta página avanza sola en cuanto tu script escribe en la hoja.
      </StepHead>
      <AuthArt />
      <p className="sunken flex items-center gap-2.5 px-3.5 py-3 text-sm text-body" role="status" data-testid="auth-waiting">
        <i className="dot warn skeleton" aria-hidden /> Esperando tu autorización… lo comprobamos cada pocos segundos.
      </p>
      <div className="flex flex-wrap gap-3">
        <a className="btn primary lg" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi copia y autorizar <IconExterno size={16} /></a>
        <button className="btn lg" onClick={refresh} disabled={refreshing}>{refreshing ? "Comprobando…" : "Comprobar ahora"}</button>
      </div>
      <details className="group rounded-xl border border-line px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink [&::-webkit-details-marker]:hidden">
          ¿No ves el menú Luca o Google te advierte? <IconChevron size={16} className="text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-body">
          <li>El menú <b className="font-semibold text-ink">Luca</b> aparece unos segundos después de abrir la hoja. Si no, recarga la página de la Sheet.</li>
          <li>&quot;Google no ha verificado esta app&quot; es normal: el script es tu propia copia. Pulsa <b className="font-semibold text-ink">Configuración avanzada → Ir a Luca</b>.</li>
          <li>Al terminar, Luca importa tu último mes de correos del BCP y Yape y deja el escaneo automático cada 15 minutos.</li>
        </ul>
      </details>
    </section>
  );
}

const fechaCorta = (epoch: string) => {
  const n = Number(epoch);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "";
};

/** Fase 3: solo mientras la primera importación corre; avanza sola al terminar. */
export function Step3Import() {
  const { state, refresh, refreshing, dismissImport } = useLedger();
  usePoll(() => { if (!refreshing) void refresh(); }, state.phase === "ready");
  if (state.phase !== "ready") return null;
  const n = state.data.txs.length;
  const desde = fechaCorta(importStatus(state.data.ajustes).since);
  return (
    <section className="card rise mx-auto grid w-full max-w-xl gap-5 sm:p-7" data-testid="onboarding-step3">
      <Stepper step={3} />
      <StepHead done={2} title="Importando tus correos">
        Tu script está leyendo tus correos del BCP y Yape{desde ? <> desde el <b className="font-semibold text-ink">{desde}</b></> : null}.
        Sigue solo, en segundo plano: puedes cerrar esta página.
      </StepHead>
      <div className="sunken flex items-center gap-4 px-4 py-4" role="status" aria-live="polite">
        <span className="num text-[38px] font-medium leading-none tracking-[-0.04em] text-ink">{n}</span>
        <span className="text-sm leading-snug text-body">{n === 1 ? "movimiento" : "movimientos"} en tu Sheet<br /><small className="text-muted">Se actualiza solo cada pocos segundos</small></span>
        <i className="dot warn skeleton ml-auto" aria-hidden />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn primary lg" onClick={dismissImport}>Seguir al panel</button>
      </div>
    </section>
  );
}

function CheckItem({ done, children, action }: { done: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="sunken grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3 text-sm sm:grid-cols-[20px_minmax(0,1fr)_auto]">
      <span className="mt-px">{done ? <CheckDisc size={20} label="Hecho" /> : <i className="block size-5 rounded-full border-[1.5px] border-line-strong" role="img" aria-label="Pendiente" />}</span>
      <div className={`min-w-0 ${done ? "text-muted line-through decoration-line-strong" : "text-ink"}`}>{children}</div>
      {action && <div className="col-start-2 sm:col-start-3">{action}</div>}
    </li>
  );
}

export function Step4Connections() {
  const { state, skipConnections } = useLedger();
  const [open, setOpen] = useState(true);
  const id = useId();
  if (state.phase !== "ready") return null;
  const c = connectionsStatus(state.data.ajustes);
  const status: [boolean, string][] = [
    [c.webAppReady, `Web App ${c.webAppReady ? "publicada" : "sin publicar"}`],
    [c.iphone.connected, `iPhone ${c.iphone.connected ? "conectado" : "no configurado"}`],
    [c.mcp.connected, `IA ${c.mcp.connected ? "conectada" : "no configurada"}`],
  ];
  return (
    <section className="card rise overflow-hidden p-0!" data-testid="onboarding-step4">
      <h2>
        <button type="button" className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-4 text-left sm:px-5"
          aria-expanded={open} aria-controls={`${id}-c`} onClick={() => setOpen((o) => !o)}>
          <ProgressRing done={3} size={40} />
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold">Activa las conexiones (opcional)</span>
            <span className="block text-[13px] font-normal text-muted">Te falta un paso opcional: conecta el iPhone o tu IA cuando quieras</span>
          </span>
          <IconChevron size={18} className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <div className="expand" data-open={open} id={`${id}-c`} inert={!open}>
        <div>
          <ul className="grid gap-2 px-4 pb-4 sm:px-5">
            <CheckItem done>Copiar la plantilla a tu Drive</CheckItem>
            <CheckItem done>Autorizar tu script</CheckItem>
            <CheckItem done>Importar tus correos</CheckItem>
            <CheckItem done={false} action={<Link className="btn primary sm" href="/app/conexiones">Ver la guía de conexiones</Link>}>
              <span className="font-medium">Activar conexiones</span>
              <small className="mt-0.5 block text-[12.5px] leading-snug text-muted">
                Con el correo ya tienes tus gastos. Si además quieres los yapeos que recibes en el iPhone o preguntarle a tu IA, publica el script
                como Web App desde tu Sheet. Luca nunca ve esos datos: van de tu teléfono o tu IA a <i>tu</i> script.
              </small>
              <span className="mt-2 flex flex-wrap gap-1.5">
                {status.map(([ok, label]) => <span key={label} className="pill"><i className={`dot ${ok ? "" : "off"}`} /> {label}</span>)}
              </span>
            </CheckItem>
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
            <Link className="btn sm" href="/app/conexiones/iphone">Conectar iPhone</Link>
            <button className="btn ghost sm" onClick={() => skipConnections(true)}>Omitir por ahora</button>
          </div>
        </div>
      </div>
    </section>
  );
}
