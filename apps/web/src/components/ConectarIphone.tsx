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
import { useLedger } from "./LedgerProvider";
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

export default function ConectarIphone({ requestedStep, shortcutUrl }: { requestedStep: WizardStep; shortcutUrl: string }) {
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

  return (
    <div className="mx-auto grid w-full max-w-xl min-w-0 gap-4 [&>*]:min-w-0" data-testid="iphone-wizard" data-step={step}>
      <Progress step={step} />

      {step === 1 && (
        <StepCard title="Tu hoja responde" lead="El atajo manda cada yapeo a tu propio script (Web App). Primero comprobamos que está publicado.">
          {c.webAppReady ? (
            <>
              <Notice kind="ok">Tu Web App está publicada. El atajo enviará a:</Notice>
              <p className="break-all rounded-lg bg-panel-2 p-3 text-xs" data-testid="wiz-execurl">{c.execUrl}</p>
              <p className="text-xs text-muted">No la probamos desde aquí: la prueba real la hace tu iPhone en el paso 4.</p>
              <Nav onNext={next} />
            </>
          ) : (
            <>
              <Notice kind="warn">Tu Sheet todavía no tiene la Web App publicada (<code>conexiones.execUrl</code> vacío).</Notice>
              <ol className="grid gap-2 text-sm text-muted">
                <li><b className="text-text">1.</b> Abre tu Sheet → <b className="text-text">Extensiones → Apps Script</b>.</li>
                <li><b className="text-text">2.</b> Arriba a la derecha: <b className="text-text">Implementar → Nueva implementación</b>.</li>
                <li><b className="text-text">3.</b> ⚙️ Tipo: <b className="text-text">Aplicación web</b> · Ejecutar como: <b className="text-text">Yo</b> · Acceso: <b className="text-text">Cualquier usuario</b> → Implementar.</li>
                <li><b className="text-text">4.</b> Copia la URL que termina en <code>/exec</code> y pégala en tu Sheet → menú <b className="text-text">Luca → Activar conexiones</b>. Tu script la valida y la guarda.</li>
              </ol>
              <div className="flex flex-wrap gap-2">
                <a className="btn primary" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet ↗</a>
                <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Comprobando…" : "Ya lo hice → Actualizar"}</button>
              </div>
              <Nav onNext={next} nextDisabled nextHint="Se activa cuando tu script guarde la URL." />
            </>
          )}
        </StepCard>
      )}

      {step === 2 && (
        <StepCard title="Ábrelo en tu iPhone" lead="Los siguientes pasos se hacen en el iPhone (copiar el token, importar el atajo).">
          {onIOS ? (
            <>
              <Notice kind="ok">Ya estás en tu iPhone: puedes seguir directamente.</Notice>
              <Nav onBack={back} onNext={next} />
            </>
          ) : (
            <>
              <QrForStep3 />
              <p className="text-sm text-muted">Escanea el código con la cámara del iPhone (o cópiate el enlace y ábrelo allí). Entrarás con tu misma cuenta de Google y seguirás en el paso 3.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn" data-testid="copy-link" onClick={() => copy(`${window.location.origin}${WIZARD_PATH}?paso=3`, "Enlace")}>Copiar enlace</button>
              </div>
              <Nav onBack={back} onNext={next} nextLabel="Seguir aquí de todos modos" />
            </>
          )}
        </StepCard>
      )}

      {step === 3 && (
        <Step3Install token={token} execUrl={c.execUrl} shortcutUrl={shortcutUrl} onBack={back} onNext={next} copy={copy}
          ensureToken={() => saveAjustes(tokenWrites(newToken(), c.execUrl), "Token del iPhone generado y guardado en tu Sheet")} />
      )}

      {step === 4 && (
        <Step4Test ajustes={ajustes} refreshAjustes={refreshAjustes} onBack={back} onDone={() => go(5)} mock={mode === "mock"} />
      )}

      {step === 5 && (
        <StepCard title="Activa la automatización" lead="Último paso, en la app Atajos del iPhone. Después, cada yapeo que recibas aparecerá solo en tu hoja.">
          <ol className="grid gap-3 sm:grid-cols-3">
            <Figure n={1} caption={<><b>Automatización</b> → <b>+</b> → <b>Notificación</b> → App: <b>Yape</b></>}><SvgBell /></Figure>
            <Figure n={2} caption={<>Elige <b>Ejecutar inmediatamente</b> y el atajo <b>Luca – Captura Yape</b></>}><SvgBolt /></Figure>
            <Figure n={3} caption={<>En el atajo: <b>ⓘ → Privacidad → Permitir con el equipo bloqueado</b></>}><SvgLock /></Figure>
          </ol>
          <Notice kind="ok">Listo. Pide un yapeo de S/ 1 para verlo llegar: aparecerá como <b>Recibido por Yape</b> en Movimientos.</Notice>

          <section className="rounded-lg border border-border bg-panel-2 p-3" data-testid="iphone-final-status">
            <div className="flex items-center justify-between gap-2">
              <h3 className="label !mb-0">Estado del iPhone</h3>
              <span className="pill"><i className={`dot ${!c.iphone.connected ? "off" : c.iphone.silent ? "warn" : ""}`} /> {!c.iphone.connected ? "sin eventos aún" : c.iphone.silent ? "sin señales" : "conectado"}</span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Dispositivo</dt><dd>{c.iphone.device || "—"}</dd>
              <dt className="text-muted">Eventos</dt><dd>{c.iphone.eventsCount}</dd>
              <dt className="text-muted">Último yapeo</dt><dd>{c.iphone.lastEventAt ? `${fmtDateTime(c.iphone.lastEventAt)} (${timeAgo(c.iphone.lastEventAt)})` : "ninguno todavía"}</dd>
              <dt className="text-muted">Última prueba</dt><dd>{c.iphone.lastTestAt ? `${fmtDateTime(c.iphone.lastTestAt)} (${timeAgo(c.iphone.lastTestAt)})` : "—"}</dd>
              <dt className="text-muted">Token</dt><dd className="font-mono text-xs">{token ? maskToken(token) : "—"}</dd>
              {c.iphone.lastError && <><dt className="text-muted">Último error</dt><dd className="text-warn">{c.iphone.lastError}</dd></>}
            </dl>
            {regenerated && (
              <div className="mt-3">
                <Notice kind="warn" action={<button className="btn" onClick={() => go(3)}>Ir al paso 3</button>}>
                  Token nuevo guardado. El atajo actual ya no es válido: vuelve al paso 3, copia el token nuevo y vuelve a importar el atajo.
                </Notice>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="btn primary" href="/app">Ver datos</Link>
              <button className="btn" onClick={regenerate} disabled={!c.execUrl}>Regenerar token</button>
              <button className="btn" onClick={disconnect} disabled={!token && !c.iphone.connected}>Desconectar</button>
            </div>
          </section>
          <Nav onBack={back} />
        </StepCard>
      )}

      <p className="text-center text-xs text-muted"><Link href="/app/conexiones" className="underline">Volver a Conexiones</Link></p>
    </div>
  );
}

function Progress({ step }: { step: WizardStep }) {
  const cur = WIZARD_STEPS[step - 1];
  return (
    <header className="grid gap-2" aria-label="Progreso del asistente">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">Conectar iPhone</h1>
        <span className="text-xs text-muted">Paso {step} de 5</span>
      </div>
      <div className="track" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step} aria-label={cur.title}><div className="fill" style={{ width: `${(step / 5) * 100}%` }} /></div>
      <ol className="flex justify-between gap-1 text-[10.5px] text-muted">
        {WIZARD_STEPS.map((s) => (
          <li key={s.n} aria-current={s.n === step ? "step" : undefined} className={`flex items-center gap-1 ${s.n === step ? "font-semibold text-text" : ""}`}>
            <i className={`dot ${s.n < step ? "" : s.n === step ? "warn" : "off"}`} /> {s.short}
          </li>
        ))}
      </ol>
    </header>
  );
}

function StepCard({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="card grid min-w-0 gap-3 [&>*]:min-w-0">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Nav({ onBack, onNext, nextLabel = "Siguiente", nextDisabled, nextHint }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; nextHint?: string }) {
  return (
    <div className="mt-1 grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBack ? <button className="btn" onClick={onBack}>← Atrás</button> : <span />}
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
    <figure className="grid justify-items-center gap-2">
      <div className="w-[min(70vw,220px)] rounded-xl bg-white p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" data-testid="wiz-qr" aria-label="Código QR con el enlace a este asistente" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="break-all text-center text-[11px] text-muted">{href}</figcaption>
    </figure>
  );
}

function Step3Install({ token, execUrl, shortcutUrl, ensureToken, copy, onBack, onNext }: {
  token: string; execUrl: string; shortcutUrl: string; ensureToken: () => Promise<boolean>;
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
    <StepCard title="Instala el atajo" lead="El atajo necesita dos datos: la URL de tu hoja y tu token. Cópialos desde aquí cuando el atajo los pida.">
      {!execUrl && <Notice kind="warn">Falta la URL de tu Web App: vuelve al paso 1.</Notice>}
      {execUrl && !token && <p className="text-sm text-muted" role="status">Generando tu token y guardándolo en tu Sheet…</p>}
      <div className="grid gap-2">
        <Chip label="URL de tu Luca" value={url} display={url} onCopy={() => copy(url, "URL")} testId="copy-url" disabled={!url} />
        <Chip label="Token de tu iPhone" value={token} display={show ? token : maskToken(token)} onCopy={() => copy(token, "Token")} testId="copy-token" disabled={!token}
          extra={<button className="text-xs text-muted underline" type="button" onClick={() => setShow((v) => !v)} data-testid="toggle-token">{show ? "ocultar" : "mostrar"}</button>} />
      </div>
      <p className="text-xs text-muted">El token solo sirve para escribir en <i>tu</i> hoja. Puedes regenerarlo o desconectar el iPhone cuando quieras.</p>

      {shortcutUrl ? (
        <div className="grid gap-1">
          <a className="btn primary text-center" href={shortcutUrl} target="_blank" rel="noreferrer" data-testid="install-shortcut" aria-disabled={!ready}>Instalar atajo (iCloud) ↗</a>
          <p className="text-xs text-muted">Al importarlo, pega la URL y el token cuando los pida. Incluye el mini-atajo <b>Luca – Probar iPhone</b>.</p>
        </div>
      ) : (
        <Notice kind="info">El enlace de iCloud del atajo aún no está disponible: genera el atajo con una IA (abajo) en un minuto.</Notice>
      )}

      <details className="rounded-lg border border-border bg-panel-2 p-3" open={!shortcutUrl} data-testid="ai-prompt">
        <summary className="cursor-pointer text-sm font-semibold">Generarlo con IA</summary>
        <p className="mt-2 text-xs text-muted">Pega este prompt en ChatGPT, Claude o Gemini (en el iPhone) y sigue sus instrucciones. Ya lleva tu URL y tu token.</p>
        <textarea className="mt-2 h-48 w-full rounded-lg border border-border bg-panel p-2 font-mono text-[11px] leading-snug text-text" readOnly value={prompt} data-testid="prompt-text" aria-label="Prompt para generar el atajo" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn" data-testid="copy-prompt" onClick={() => copy(prompt, "Prompt")} disabled={!prompt}>Copiar prompt</button>
        </div>
      </details>
      <Nav onBack={onBack} onNext={onNext} nextLabel="Ya lo instalé" nextDisabled={!ready} />
    </StepCard>
  );
}

function Chip({ label, value, display, onCopy, testId, disabled, extra }: { label: string; value: string; display: string; onCopy: () => void; testId: string; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border bg-panel-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted">{label}{extra}</div>
        <div className="truncate font-mono text-xs" title={value} data-testid={`${testId}-value`}>{display || "—"}</div>
      </div>
      <button className="btn !px-3 !py-1.5 text-xs" type="button" onClick={onCopy} disabled={disabled} data-testid={testId}>Copiar</button>
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

  return (
    <StepCard title="Prueba la conexión" lead="En el iPhone, ejecuta a mano el atajo «Luca – Captura Yape» (botón ▶ en Atajos; sin notificación manda una prueba». Tu script anota la prueba en tu hoja y aquí la verás llegar.">
      {result ? (
        <div className="rounded-lg border border-ok bg-panel-2 p-4 text-center" role="status" data-testid="test-ok">
          <div className="text-2xl">✓</div>
          <p className="mt-1 font-semibold">{result.kind === "test" ? "Prueba recibida" : "¡Llegó un yapeo!"} hace {secondsSince(result.at)} s{result.device ? ` desde ${result.device}` : ""}</p>
          <p className="mt-1 text-xs text-muted">Pasando al último paso…</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-panel-2 p-4 text-center" role="status" aria-live="polite" data-testid="test-waiting">
          <div className="mx-auto flex h-10 w-10 items-center justify-center"><span className="relative flex h-4 w-4"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-4 w-4 rounded-full bg-accent" /></span></div>
          <p className="mt-2 font-semibold">Esperando tu prueba…</p>
          <p className="mt-1 text-xs text-muted">Revisamos tu hoja cada 5 s · {elapsed} s</p>
        </div>
      )}
      {!result && elapsed * 1000 >= TIMEOUT_MS && (
        <div data-testid="test-timeout">
          <Notice kind="warn">Todavía nada. Revisa en el iPhone:</Notice>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            <li>· ¿Ejecutaste a mano <b className="text-text">Luca – Captura Yape</b> (▶)? Debe mostrar <code>{"{\"ok\":true,\"test\":true}"}</code>.</li>
            <li>· Si muestra <code>unauthorized</code>: el <b className="text-text">token</b> no coincide; vuelve al paso 3 y cópialo de nuevo.</li>
            <li>· Si da error de red: la <b className="text-text">URL</b> debe terminar en <code>/exec?events=1</code> y la Web App debe estar publicada para «Cualquier usuario».</li>
            <li>· También vale un yapeo real: si te llega uno, lo detectamos igual.</li>
          </ul>
        </div>
      )}
      {mock && !result && <button className="btn text-xs" data-testid="mock-simulate-test" onClick={() => scheduleMockIphoneTest(1000)}>Simular prueba (modo mock)</button>}
      <Nav onBack={onBack} onNext={result ? onDone : undefined} nextLabel="Continuar" />
    </StepCard>
  );
}

function Figure({ n, caption, children }: { n: number; caption: ReactNode; children: ReactNode }) {
  return (
    <li className="grid gap-2 rounded-lg border border-dashed border-border bg-panel-2 p-3 text-center text-xs text-muted">
      <div className="mx-auto flex h-24 w-full max-w-[160px] items-center justify-center rounded-lg border border-border bg-panel text-accent" aria-hidden>{children}</div>
      <p><span className="font-semibold text-text">{n}.</span> {caption}</p>
    </li>
  );
}
const SvgBell = () => <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
const SvgBolt = () => <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
const SvgLock = () => <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><path d="M12 15v2" /></svg>;
