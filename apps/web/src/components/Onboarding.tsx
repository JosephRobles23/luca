"use client";

/**
 * Onboarding en 3 pasos (ADR-006 §3): persistente arriba del dashboard hasta completar.
 * Pasos 1 y 2: tarjetas centradas con anillo de progreso, stepper e ilustración. Paso 3: la "configuración
 * plegable" de DESIGN.md (anillo n/3 + checklist), que desaparece al completar u omitir.
 */
import Link from "next/link";
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { connectionsStatus, isAuthorized } from "@/lib/ajustes";
import { currentStep, STEP_TITLES, type OnboardingStep } from "@/lib/onboarding";
import { IconChevron, IconExterno } from "./icons";
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

/** Anillo de progreso n/3; el arco se dibuja al aparecer. */
function ProgressRing({ done, total = 3, size = 44 }: { done: number; total?: number; size?: number }) {
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

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Progreso del onboarding">
      {([1, 2, 3] as const).map((n) => {
        const st = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li key={n} className="grid min-w-0 gap-2" aria-current={n === step ? "step" : undefined}>
            <span className="block h-1 overflow-hidden rounded-full bg-strong" aria-hidden>
              {st !== "next" && <span className={`grow-x block h-full rounded-full ${st === "done" ? "bg-success" : "bg-primary"}`} style={{ "--i": n } as CSSProperties} />}
            </span>
            <span className={`flex min-w-0 items-start gap-1.5 text-[12.5px] [&>i]:mt-[3px] [&>svg]:mt-px ${st === "next" ? "text-muted" : "text-ink"} ${st === "now" ? "font-semibold" : ""}`}>
              {st === "done" ? <CheckDisc /> : <i aria-hidden className={`block size-3 flex-none rounded-full border-2 ${st === "now" ? "border-primary bg-primary-soft" : "border-line-strong"}`} />}
              <span className="min-w-0 leading-snug">{n}. {STEP_TITLES[n]}{n === 3 ? " (opcional)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Cabecera común de los pasos 1 y 2: anillo + "Paso n de 3" + título. */
function StepHead({ done, title, children }: { done: number; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <ProgressRing done={done} />
      <div className="min-w-0">
        <p className="eyebrow">Paso {done + 1} de 3</p>
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

export function Step1Sheet() {
  const { state, crearSheet, elegirExistente, mode, templateFolderId } = useLedger();
  const carpeta = `https://drive.google.com/drive/folders/${templateFolderId || "18aQXOYlyznY6xZm3ViRdVrFWILLXsHQL"}?usp=sharing`;
  const busy = state.phase === "nofile" ? state.busy : undefined;
  const error = state.phase === "nofile" ? state.error : undefined;
  const pasos: ReactNode[] = [
    <>Abre la <a className="font-semibold text-ink underline underline-offset-2" href={carpeta} target="_blank" rel="noopener noreferrer" data-testid="template-folder-link">carpeta LUCA</a>: ahí está la plantilla <b className="font-semibold text-ink">&quot;Luca Template&quot;</b>.</>,
    <>Pulsa <b className="font-semibold text-ink">Crear mi Sheet</b>: el selector de Google se abre en esa carpeta; elige &quot;Luca Template&quot; y hacemos una copia a tu nombre con el script de Luca incluido. (También puedes abrirla y hacer <b className="font-semibold text-ink">Archivo → Hacer una copia</b>, y luego pulsar &quot;Ya tengo una&quot;.)</>,
    <>En la copia, menú <b className="font-semibold text-ink">Luca → Autorizar</b>: le das permiso a <i>tu propio</i> script para leer tus correos de BCP/Yape. No a nosotros.</>,
  ];
  return (
    <section className="card rise mx-auto grid w-full max-w-xl gap-5 sm:p-7" data-testid="onboarding-step1">
      <Stepper step={1} />
      <div className="sunken grid place-items-center px-4 py-5"><SheetCopyArt /></div>
      <StepHead done={0} title="Crea tu Sheet de Luca">
        Luca guarda tus movimientos en una hoja de cálculo <b className="font-semibold text-ink">de tu propiedad</b>, en tu Google Drive.
        Solo pedimos permiso sobre ese archivo (y ningún otro).
      </StepHead>
      <ol className="grid gap-2 text-sm text-body">
        {pasos.map((t, n) => (
          <li key={n} className="sunken grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3">
            <span className="num grid size-6 place-items-center rounded-full bg-card text-xs text-muted ring-1 ring-line" aria-hidden>{n + 1}</span>
            <span><span className="sr-only">{n + 1}. </span>{t}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <button className="btn primary lg" onClick={crearSheet} disabled={!!busy}>Crear mi Sheet</button>
        <button className="btn lg" onClick={elegirExistente} disabled={!!busy}>Ya tengo una</button>
        <a className="btn lg ghost" href={carpeta} target="_blank" rel="noopener noreferrer">Abrir carpeta LUCA ↗</a>
      </div>
      {busy && <p className="flex items-center gap-2 text-sm text-muted" role="status"><i className="dot warn skeleton" aria-hidden /> {busy}</p>}
      {error && <p className="notice warn" role="alert">Error: {error}</p>}
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
  if (state.phase !== "ready") return null;
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  return (
    <section className="card rise mx-auto grid w-full max-w-3xl gap-5 border-[color-mix(in_srgb,var(--primary)_35%,var(--line))] sm:p-7" data-testid="onboarding-step2">
      <Stepper step={2} />
      <StepHead done={1} title="Autoriza tu script en el Sheet">
        Tu Sheet existe pero el script todavía no ha escrito nada. Ábrela, espera a que aparezca el menú <b className="font-semibold text-ink">Luca</b> y pulsa
        <b className="font-semibold text-ink"> Autorizar</b>. Al terminar, importa automáticamente tu último mes de correos.
      </StepHead>
      <AuthArt />
      <div className="flex flex-wrap gap-3">
        <a className="btn primary lg" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet y autorizar <IconExterno size={16} /></a>
        <button className="btn lg" onClick={refresh} disabled={refreshing}>{refreshing ? "Comprobando…" : "Ya autoricé → Actualizar"}</button>
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

export function Step3Connections() {
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
    <section className="card rise overflow-hidden p-0!" data-testid="onboarding-step3">
      <h2>
        <button type="button" className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-4 text-left sm:px-5"
          aria-expanded={open} aria-controls={`${id}-c`} onClick={() => setOpen((o) => !o)}>
          <ProgressRing done={2} size={40} />
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
            <CheckItem done>Crear tu Sheet</CheckItem>
            <CheckItem done>Autorizar tu script</CheckItem>
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
