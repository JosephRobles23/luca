"use client";

/**
 * Asistente "Conectar iPhone" en 5 pasos (ADR-003). Pensado para abrirse EN el iPhone (mobile-first).
 * Lee y escribe solo `Ajustes.conexiones.*`; la lógica pura vive en `lib/iphone-wizard.ts` y
 * `lib/shortcut-prompt.ts`. No llama al `/exec` desde el navegador: la prueba la confirma el script
 * escribiendo `conexiones.iphone.lastTestAt` (o `lastEventAt` si llega un yapeo real).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import QRCode from "qrcode";
import { connectionsStatus } from "@/lib/ajustes";
import { scheduleMockIphoneTest } from "@/lib/google.mock";
import {
  IPHONE_KEYS, WIZARD_STEPS, baselineFrom, detectSignal, disconnectWrites, initialStep, isIOS, maskToken, newToken, secondsSince,
  tokenWrites, type TestBaseline, type TestResult, type WizardStep,
} from "@/lib/iphone-wizard";
import { buildShortcutPrompt, eventsUrl } from "@/lib/shortcut-prompt";
import { CardHead, NumSteps, StatusPill, Telemetry, useReducedMotion } from "./conexiones/parts";
import { IconCopiar, IconExterno, IconIphone } from "./icons";
import { useLedger } from "./LedgerProvider";
import { DrawCheck } from "./motion";
import { useToast } from "./Toast";
import { Notice, fmtDateTime, timeAgo } from "./ui";

const POLL_MS = 5000;
const TIMEOUT_MS = 60_000;
const WIZARD_PATH = "/app/conexiones/iphone";
const noSubscribe = () => () => {};
/** Origen de la página (solo en cliente; "" en el servidor para no romper la hidratación). */
const useOrigin = () => useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");

/** Copia con `navigator.clipboard` y, si falla (http, permisos, iOS antiguo), con un textarea + execCommand. Avisa con toast. */
function useCopy() {
  const { toast } = useToast();
  return useCallback(async (text: string, what: string) => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fallback abajo */ }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); document.body.removeChild(ta);
      } catch { ok = false; }
    }
    toast(ok ? `${what} copiado` : `No pude copiar ${what.toLowerCase()}: selecciónalo y cópialo a mano`, ok ? "ok" : "error");
    return ok;
  }, [toast]);
}

export default function ConectarIphone({ requestedStep }: { requestedStep: WizardStep }) {
  const { state, mode, refresh, refreshing, refreshAjustes, saveAjustes } = useLedger();
  const router = useRouter();
  const copy = useCopy();
  const [chosen, setStep] = useState<WizardStep | null>(null);
  const [regenerated, setRegenerated] = useState(false);
  const onIOS = useSyncExternalStore(noSubscribe, () => isIOS(navigator.userAgent), () => false);

  const ajustes = state.phase === "ready" ? state.data.ajustes : null;
  // Paso actual: el elegido por el usuario o, al entrar, el pedido en la URL (o el estado final si ya está conectado).
  const step: WizardStep | null = chosen ?? (ajustes ? initialStep(ajustes, requestedStep) : null);

  // La URL refleja el paso: así el QR del paso 2 abre el iPhone directamente en el paso 3.
  useEffect(() => {
    if (step === null) return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("paso") !== String(step)) { u.searchParams.set("paso", String(step)); window.history.replaceState(window.history.state, "", u.toString()); }
  }, [step]);

  if (state.phase !== "ready" || !ajustes || step === null) return <p className="text-muted" role="status">Leyendo tu Sheet…</p>;

  const c = connectionsStatus(ajustes);
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  const token = ajustes[IPHONE_KEYS.token] ?? "";
  const go = (n: WizardStep) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => step < 5 && go((step + 1) as WizardStep);
  const back = () => step > 1 && go((step - 1) as WizardStep);

  const regenerate = async () => {
    if (!window.confirm("¿Generar un token nuevo? El atajo que ya tienes dejará de funcionar hasta que lo vuelvas a importar con el token nuevo.")) return;
    if (await saveAjustes(tokenWrites(newToken(), c.execUrl), "Token nuevo guardado en tu Sheet")) setRegenerated(true);
  };
  const disconnect = async () => {
    if (!window.confirm("¿Desconectar el iPhone? Se borra el token: el atajo dejará de poder escribir en tu hoja.")) return;
    if (await saveAjustes(disconnectWrites(), "iPhone desconectado")) router.push("/app/conexiones");
  };

  const iphonePill = !c.iphone.connected ? { tone: "off" as const, label: "sin eventos aún" } : c.iphone.silent ? { tone: "warn" as const, label: "sin señales" } : { tone: "ok" as const, label: "conectado" };

  return (
    <div className="mx-auto grid w-full max-w-xl min-w-0 gap-4 [&>*]:min-w-0" data-testid="iphone-wizard" data-step={step}>
      <Progress step={step} />

      <StepTransition step={step}>
        {step === 1 && (
          <StepCard step={1} title="Tu hoja responde" lead="El atajo manda cada yapeo a tu propio script (Web App). Primero comprobamos que está publicado.">
            {c.webAppReady ? (
              <>
                <Notice kind="ok">Tu Web App está publicada. El atajo enviará a:</Notice>
                <p className="sunken break-all px-3.5 py-3 font-mono text-[12px] text-ink" data-testid="wiz-execurl">{c.execUrl}</p>
                <p className="text-xs text-muted">No la probamos desde aquí: la prueba real la hace tu iPhone en el paso 4.</p>
                <Nav onNext={next} />
              </>
            ) : (
              <>
                <Notice kind="warn">Tu Sheet todavía no tiene la Web App publicada (<code>conexiones.execUrl</code> vacío).</Notice>
                <NumSteps>{[
                  <>Abre tu Sheet → <b>Extensiones → Apps Script</b>.</>,
                  <>Arriba a la derecha: <b>Implementar → Nueva implementación</b>.</>,
                  <>⚙️ Tipo: <b>Aplicación web</b> · Ejecutar como: <b>Yo</b> · Acceso: <b>Cualquier usuario</b> → Implementar.</>,
                  <>Copia la URL que termina en <code>/exec</code> y pégala en tu Sheet → menú <b>Luca → Activar conexiones</b>. Tu script la valida y la guarda.</>,
                  <>Para publicar cambios más adelante no crees otra: <b>Gestionar implementaciones → ✏️ → Versión: Nueva versión</b> mantiene la misma URL (y el atajo sigue funcionando).</>,
                ]}</NumSteps>
                <div className="flex flex-wrap gap-2">
                  <a className="btn primary" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet <IconExterno size={15} /></a>
                  <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Comprobando…" : "Ya lo hice → Actualizar"}</button>
                </div>
                <Nav onNext={next} nextDisabled nextHint="Se activa cuando tu script guarde la URL." />
              </>
            )}
          </StepCard>
        )}

        {step === 2 && (
          <StepCard step={2} title="Ábrelo en tu iPhone" lead="Los siguientes pasos se hacen en el iPhone (copiar el token, importar el atajo).">
            {onIOS ? (
              <>
                <Notice kind="ok">Ya estás en tu iPhone: puedes seguir directamente.</Notice>
                <Nav onBack={back} onNext={next} />
              </>
            ) : (
              <>
                <QrForStep3 />
                <p className="text-center text-sm text-body">Escanea el código con la cámara del iPhone (o cópiate el enlace y ábrelo allí). Entrarás con tu misma cuenta de Google y seguirás en el paso 3.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button className="btn sm" data-testid="copy-link" onClick={() => copy(`${window.location.origin}${WIZARD_PATH}?paso=3`, "Enlace")}><IconCopiar size={15} />Copiar enlace</button>
                </div>
                <Nav onBack={back} onNext={next} nextLabel="Seguir aquí de todos modos" />
              </>
            )}
          </StepCard>
        )}

        {step === 3 && (
          <Step3Install token={token} execUrl={c.execUrl} onBack={back} onNext={next} copy={copy}
            ensureToken={() => saveAjustes(tokenWrites(newToken(), c.execUrl), "Token del iPhone generado y guardado en tu Sheet")} />
        )}

        {step === 4 && (
          <Step4Test ajustes={ajustes} refreshAjustes={refreshAjustes} onBack={back} onDone={() => go(5)} mock={mode === "mock"} />
        )}

        {step === 5 && (
          <StepCard step={5} title="Activa la automatización" lead="Último paso, en la app Atajos del iPhone. Después, cada yapeo que recibas aparecerá solo en tu hoja.">
            <ol className="grid gap-2.5 sm:grid-cols-3">
              <Figure n={1} caption={<><b>Automatización</b> → <b>+</b> → <b>Notificación</b> → App: <b>Yape</b></>}><SvgBell /></Figure>
              <Figure n={2} caption={<>Elige <b>Ejecutar inmediatamente</b> y el atajo <b>Luca – Captura Yape</b></>}><SvgBolt /></Figure>
              <Figure n={3} caption={<>En el atajo: <b>(i) → Privacidad → Permitir con el equipo bloqueado</b></>}><SvgLock /></Figure>
            </ol>
            <Notice kind="ok">Listo. Pide un yapeo de S/ 1 para verlo llegar: aparecerá como <b>Recibido por Yape</b> en Movimientos.</Notice>

            <section className="grid gap-3 rounded-[14px] border border-line p-4" data-testid="iphone-final-status" aria-labelledby="estado-h">
              <CardHead id="estado-h" icon={<IconIphone />} title="Estado del iPhone" pill={<StatusPill pill={iphonePill} />} />
              <Telemetry rows={[
                ["Dispositivo", c.iphone.device || "—"],
                ["Eventos", <span key="n" className="num">{c.iphone.eventsCount}</span>],
                ["Último yapeo", c.iphone.lastEventAt ? `${fmtDateTime(c.iphone.lastEventAt)} (${timeAgo(c.iphone.lastEventAt)})` : "ninguno todavía"],
                ["Última prueba", c.iphone.lastTestAt ? `${fmtDateTime(c.iphone.lastTestAt)} (${timeAgo(c.iphone.lastTestAt)})` : "—"],
                ["Token", token ? maskToken(token) : "—", "font-mono text-xs"],
                ...(c.iphone.lastError ? [["Último error", c.iphone.lastError, "text-warning"] as [string, string, string]] : []),
              ]} />
              {regenerated && (
                <Notice kind="warn" action={<button className="btn sm" onClick={() => go(3)}>Ir al paso 3</button>}>
                  Token nuevo guardado. El atajo actual ya no es válido: vuelve al paso 3, copia el token nuevo y vuelve a importar el atajo.
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                <Link className="btn primary" href="/app">Ver datos</Link>
                <button className="btn" onClick={regenerate} disabled={!c.execUrl}>Regenerar token</button>
                <button className="btn ghost" onClick={disconnect} disabled={!token && !c.iphone.connected}>Desconectar</button>
              </div>
            </section>
            <Nav onBack={back} />
          </StepCard>
        )}
      </StepTransition>

      <p className="text-center text-[13px] text-muted"><Link href="/app/conexiones" className="underline underline-offset-2 hover:text-ink">Volver a Conexiones</Link></p>
    </div>
  );
}

/** Entrada corta del paso nuevo: se desliza desde el lado hacia el que se avanza (Web Animations; quieto con movimiento reducido). */
function StepTransition({ step, children }: { step: WizardStep; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(step);
  const reduced = useReducedMotion();
  useEffect(() => {
    const from = prev.current;
    prev.current = step;
    if (from === step || reduced || !ref.current?.animate) return;
    const dx = step > from ? 18 : -18;
    ref.current.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
  }, [step, reduced]);
  return <div ref={ref} className="min-w-0">{children}</div>;
}

/** Cabecera del asistente: anillo n/5 + título, y la fila de pasos numerados unidos por una línea de progreso. */
function Progress({ step }: { step: WizardStep }) {
  const cur = WIZARD_STEPS[step - 1];
  const pct = (step / 5) * 100;
  return (
    <header className="card grid gap-4" aria-label="Progreso del asistente">
      <div className="flex items-center gap-3.5">
        <svg className="size-12 flex-none" viewBox="0 0 48 48" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-label={cur.title}>
          <circle cx="24" cy="24" r="19" fill="none" stroke="var(--strong)" strokeWidth="5" />
          <circle cx="24" cy="24" r="19" fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" pathLength={100}
            strokeDasharray={`${pct} 100`} transform="rotate(-90 24 24)" style={{ transition: "stroke-dasharray .6s var(--ease-out)" }} />
          <text x="24" y="28" textAnchor="middle" className="num" fontSize="12" fill="var(--ink)">{step}/5</text>
        </svg>
        <div className="min-w-0">
          <h1 className="page-title !text-[22px]">Conectar iPhone</h1>
          <p className="text-[13px] text-muted">Paso {step} de 5 · <span className="text-body">{cur.title}</span></p>
        </div>
      </div>
      <ol className="relative grid grid-cols-5">
        <span className="absolute left-[10%] right-[10%] top-[13px] h-0.5 rounded-full bg-strong" aria-hidden />
        <span className="absolute left-[10%] top-[13px] h-0.5 rounded-full bg-success" style={{ width: `${((step - 1) / 4) * 80}%`, transition: "width .4s var(--ease-out)" }} aria-hidden />
        {WIZARD_STEPS.map((s) => {
          const done = s.n < step, now = s.n === step;
          return (
            <li key={s.n} aria-current={now ? "step" : undefined} className="relative grid justify-items-center gap-1.5 text-center">
              <span className={`num grid size-7 place-items-center rounded-full border text-[12px] transition-colors ${done ? "border-success bg-success text-card" : now ? "border-primary bg-primary-soft text-primary ring-4 ring-primary/15" : "border-line-strong bg-card text-muted"}`}>
                {done ? <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : s.n}
              </span>
              <span className={`text-[11px] leading-tight ${now ? "font-medium text-ink" : "text-muted"}`}>{s.short}</span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function StepCard({ step, title, lead, children }: { step: WizardStep; title: string; lead: string; children: ReactNode }) {
  return (
    <section className="card grid min-w-0 gap-4 [&>*]:min-w-0" aria-labelledby={`paso-${step}-h`}>
      <div>
        <span className="eyebrow">Paso {step}</span>
        <h2 className="mt-1 text-[20px] font-medium tracking-[-0.02em] text-ink" id={`paso-${step}-h`}>{title}</h2>
        <p className="mt-1 text-sm text-body">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Nav({ onBack, onNext, nextLabel = "Siguiente", nextDisabled, nextHint }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; nextHint?: string }) {
  return (
    <div className="mt-1 grid gap-1.5 border-t border-line-soft pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBack ? <button className="btn ghost" onClick={onBack}>← Atrás</button> : <span />}
        {onNext && <button className="btn primary" data-testid="wiz-next" onClick={onNext} disabled={nextDisabled}>{nextLabel} →</button>}
      </div>
      {nextHint && <p className="text-right text-xs text-muted">{nextHint}</p>}
    </div>
  );
}

/** QR (SVG generado en el cliente) con el enlace a este asistente en el paso 3. */
function QrForStep3() {
  const [svg, setSvg] = useState("");
  const origin = useOrigin();
  const href = origin ? `${origin}${WIZARD_PATH}?paso=3` : "";
  useEffect(() => {
    if (!href) return;
    let alive = true;
    QRCode.toString(href, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((s) => { if (alive) setSvg(s); }).catch(() => { if (alive) setSvg(""); });
    return () => { alive = false; };
  }, [href]);
  return (
    <figure className="sunken grid justify-items-center gap-3 px-4 py-5">
      <div className="relative">
        <div className={`w-[min(64vw,208px)] rounded-xl border border-line bg-white p-2.5 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${svg ? "pop" : "skeleton aspect-square"}`} data-testid="wiz-qr" aria-label="Código QR con el enlace a este asistente" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border border-line bg-card text-primary" aria-hidden><IconIphone size={16} /></span>
      </div>
      <figcaption className="break-all text-center font-mono text-[11px] text-muted">{href}</figcaption>
    </figure>
  );
}

function Step3Install({ token, execUrl, ensureToken, copy, onBack, onNext }: {
  token: string; execUrl: string; ensureToken: () => Promise<boolean>;
  copy: (text: string, what: string) => Promise<boolean>; onBack: () => void; onNext: () => void;
}) {
  const [show, setShow] = useState(false);
  const tried = useRef(false); // una sola vez por visita al paso (StrictMode y re-renders no deben escribir dos veces)
  useEffect(() => {
    if (token || !execUrl || tried.current) return;
    tried.current = true;
    void ensureToken();
  }, [token, execUrl, ensureToken]);

  const url = eventsUrl(execUrl);
  const prompt = useMemo(() => (token && execUrl ? buildShortcutPrompt({ execUrl, token }) : ""), [execUrl, token]);
  const ready = !!token && !!execUrl;

  return (
    <StepCard step={3} title="Instala el atajo" lead="El atajo necesita dos datos: la URL de tu hoja y tu token. Cópialos desde aquí cuando el atajo los pida.">
      {!execUrl && <Notice kind="warn">Falta la URL de tu Web App: vuelve al paso 1.</Notice>}
      {execUrl && !token && <p className="flex items-center gap-2 text-sm text-muted" role="status"><span className="skeleton inline-block size-3 rounded-full" aria-hidden />Generando tu token y guardándolo en tu Sheet…</p>}
      <div className="grid gap-2">
        <Chip n={1} label="URL de tu Luca" value={url} display={url} onCopy={() => copy(url, "URL")} testId="copy-url" disabled={!url} />
        <Chip n={2} label="Token de tu iPhone" value={token} display={show ? token : maskToken(token)} onCopy={() => copy(token, "Token")} testId="copy-token" disabled={!token}
          extra={<button className="rounded px-1 text-[11px] font-medium normal-case tracking-normal text-primary underline-offset-2 hover:underline" type="button" onClick={() => setShow((v) => !v)} data-testid="toggle-token">{show ? "ocultar" : "mostrar"}</button>} />
      </div>
      <p className="text-xs text-muted">El token solo sirve para escribir en <i>tu</i> hoja. Puedes regenerarlo o desconectar el iPhone cuando quieras.</p>

      <section className="grid gap-2 rounded-[14px] border border-line px-4 pb-4 pt-3" data-testid="ai-prompt">
        <h3 className="text-sm font-medium text-ink">Genera el atajo con IA</h3>
        <p className="text-xs text-muted">Pega este prompt en ChatGPT, Claude o Gemini (en el iPhone) y sigue sus instrucciones. Ya lleva tu URL y tu token: no compartas el atajo que generes.</p>
        <textarea className="input h-48 resize-y font-mono !text-[11px] leading-snug" readOnly value={prompt} data-testid="prompt-text" aria-label="Prompt para generar el atajo" />
        <div className="flex flex-wrap gap-2">
          <button className="btn sm" data-testid="copy-prompt" onClick={() => copy(prompt, "Prompt")} disabled={!prompt}><IconCopiar size={15} />Copiar prompt</button>
        </div>
      </section>
      <Nav onBack={onBack} onNext={onNext} nextLabel="Ya lo instalé" nextDisabled={!ready} />
    </StepCard>
  );
}

function Chip({ n, label, value, display, onCopy, testId, disabled, extra }: { n: number; label: string; value: string; display: string; onCopy: () => void; testId: string; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="sunken flex min-w-0 items-center gap-3 overflow-hidden px-3.5 py-2.5">
      <span className="num grid size-6 flex-none place-items-center rounded-full border border-line-strong bg-card text-[11px] text-muted" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <div className="eyebrow flex flex-wrap items-center gap-x-1.5"><span className="whitespace-nowrap">{label}</span>{extra}</div>
        <div className="mt-0.5 truncate font-mono text-[12.5px] text-ink" title={value} data-testid={`${testId}-value`}>{display || "—"}</div>
      </div>
      <button className="btn sm flex-none" type="button" onClick={onCopy} disabled={disabled} data-testid={testId} aria-label={`Copiar ${label}`}><IconCopiar size={14} /><span className="max-[400px]:hidden">Copiar</span></button>
    </div>
  );
}

function Step4Test({ ajustes, refreshAjustes, onBack, onDone, mock }: {
  ajustes: Record<string, string>; refreshAjustes: () => Promise<unknown>; onBack: () => void; onDone: () => void; mock: boolean;
}) {
  const [baseline] = useState<TestBaseline>(() => baselineFrom(ajustes, Date.now()));
  const [elapsed, setElapsed] = useState(0);
  // Señal derivada de Ajustes frente a la foto de apertura: una vez llega, no "des-llega" (el valor sigue siendo más nuevo).
  const result: TestResult = useMemo(() => detectSignal(ajustes, baseline), [ajustes, baseline]);
  const done = !!result;
  const poll = useEffectEvent(() => { void refreshAjustes(); });
  const finish = useEffectEvent(() => onDone());

  // Sondeo ligero (solo Ajustes) cada 5 s mientras no haya señal, y contador para la ayuda a los 60 s.
  useEffect(() => {
    if (done) return;
    const p = setInterval(poll, POLL_MS);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { clearInterval(p); clearInterval(tick); };
  }, [done]);
  useEffect(() => { if (!done) return; const t = setTimeout(finish, 1800); return () => clearTimeout(t); }, [done]);
  // En modo mock, `?mock=iphone-test` ya programó la prueba al cargar la página.

  const wait = Math.min(1, (elapsed * 1000) / TIMEOUT_MS);
  return (
    <StepCard step={4} title="Prueba la conexión" lead="En el iPhone, ejecuta a mano el atajo «Luca – Captura Yape» (botón ▶ en Atajos; sin notificación manda una prueba». Tu script anota la prueba en tu hoja y aquí la verás llegar.">
      {result ? (
        <div className="fade-in grid justify-items-center gap-2 rounded-[14px] border border-success/40 bg-success-soft px-4 py-6 text-center" role="status" data-testid="test-ok">
          <DrawCheck size={44} />
          <p className="font-medium text-ink">{result.kind === "test" ? "Prueba recibida" : "¡Llegó un yapeo!"} hace {secondsSince(result.at)} s{result.device ? ` desde ${result.device}` : ""}</p>
          <p className="text-xs text-muted">Pasando al último paso…</p>
        </div>
      ) : (
        <div className="sunken grid justify-items-center gap-2 px-4 py-6 text-center" role="status" aria-live="polite" data-testid="test-waiting">
          <span className="relative flex size-11 items-center justify-center" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-25" />
            <span className="relative grid size-9 place-items-center rounded-full bg-primary-soft text-primary"><IconIphone size={18} /></span>
          </span>
          <p className="mt-1 font-medium text-ink">Esperando tu prueba…</p>
          <p className="text-xs text-muted">Revisamos tu hoja cada 5 s · <span className="num">{elapsed} s</span></p>
          <div className="track mt-1 w-full max-w-[220px]" aria-hidden><div className="fill" style={{ width: `${wait * 100}%`, transition: "width 1s linear" }} /></div>
        </div>
      )}
      {!result && elapsed * 1000 >= TIMEOUT_MS && (
        <div className="fade-in grid gap-2" data-testid="test-timeout">
          <Notice kind="warn">Todavía nada. Revisa en el iPhone:</Notice>
          <ul className="grid gap-1.5 text-sm text-body [&_b]:font-medium [&_b]:text-ink">
            <li className="sunken px-3.5 py-2.5">¿Ejecutaste a mano <b>Luca – Captura Yape</b> (▶)? Debe mostrar <code>{"{\"ok\":true,\"test\":true}"}</code>.</li>
            <li className="sunken px-3.5 py-2.5">Si muestra <code>unauthorized</code>: el <b>token</b> no coincide; vuelve al paso 3 y cópialo de nuevo.</li>
            <li className="sunken px-3.5 py-2.5">Si da error de red: la <b>URL</b> debe terminar en <code>/exec?events=1</code> y la Web App debe estar publicada para «Cualquier usuario».</li>
            <li className="sunken px-3.5 py-2.5">También vale un yapeo real: si te llega uno, lo detectamos igual.</li>
          </ul>
        </div>
      )}
      {mock && !result && <div><button className="btn sm" data-testid="mock-simulate-test" onClick={() => scheduleMockIphoneTest(1000)}>Simular prueba (modo mock)</button></div>}
      <Nav onBack={onBack} onNext={result ? onDone : undefined} nextLabel="Continuar" />
    </StepCard>
  );
}

function Figure({ n, caption, children }: { n: number; caption: ReactNode; children: ReactNode }) {
  return (
    <li className="sunken grid grid-cols-[auto_1fr] items-center gap-3 p-3 text-[13px] text-body sm:grid-cols-1 sm:content-start sm:justify-items-center sm:text-center [&_b]:font-medium [&_b]:text-ink">
      <div className="relative grid size-14 place-items-center rounded-xl border border-line bg-card text-primary sm:size-20" aria-hidden>
        {children}
        <span className="num absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-[10.5px] text-card">{n}</span>
      </div>
      <p>{caption}</p>
    </li>
  );
}
const SvgBell = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
const SvgBolt = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const SvgLock = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><path d="M12 15v2" /></svg>;
