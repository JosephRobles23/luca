"use client";

import Link from "next/link";
import { connectionsStatus } from "@/lib/ajustes";
import { flowState, iphoneAction, iphonePending, iphonePill, mcpPill, webAppPill } from "@/lib/conexiones-ui";
import { scanFreshness } from "@/lib/dias";
import Diagrama from "./conexiones/Diagrama";
import { CardHead, NumSteps, StatusPill, Telemetry } from "./conexiones/parts";
import { IconActualizar, IconConexiones, IconExterno, IconIA, IconIphone } from "./icons";
import { useFirstView } from "./motion";
import { useLedger } from "./LedgerProvider";
import { CopyButton, Notice, fmtDateTime, timeAgo } from "./ui";

/** "Última lectura del correo…" con la hora actual (fuera del render para no romper la pureza). */
const freshness = (scanAt: string | undefined) => scanFreshness(scanAt, Date.now());

/**
 * Estado de las conexiones (ADR-003 §Limitaciones, ADR-006 §4) leído de `Ajustes.conexiones.*`.
 * Regla: solo hay botón si tiene efecto desde la web; lo que requiere el Apps Script enlaza al Sheet con la instrucción exacta.
 */
export default function Conexiones() {
  const { state, refresh, refreshing, connectionsSkipped, skipConnections } = useLedger();
  const first = useFirstView("conexiones");
  if (state.phase !== "ready") return null;
  const rise = first ? "rise" : "";
  const a = state.data.ajustes;
  const c = connectionsStatus(a);
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  const pending = iphonePending(c, a);
  const flow = flowState(c, pending);
  const action = iphoneAction(c, pending);

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-4">
      <header className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${rise}`}>
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="page-title">Conexiones</h1>
          <p className="mt-1.5 text-sm text-body">
            Los eventos del iPhone y las preguntas de tu IA van directo a <i>tu</i> script (Web App). Luca no los ve: aquí solo se muestra la telemetría que tu script escribe en <b className="font-medium text-ink">Ajustes</b>.
          </p>
          <p className="mt-1 text-[13px] text-muted">{freshness(a["scan.lastRunAt"])}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn sm" onClick={refresh} disabled={refreshing}>
            <IconActualizar size={15} className={refreshing ? "animate-spin" : undefined} />{refreshing ? "Actualizando…" : "Actualizar estado"}
          </button>
          {connectionsSkipped && <button className="btn sm ghost" onClick={() => skipConnections(false)}>Retomar la guía</button>}
        </div>
      </header>

      {c.iphone.execUrlChanged && (
        <Notice kind="warn" action={<CopyButton text={c.execUrl} label="Copiar URL nueva" className="btn sm" />}>
          La URL de tu Web App cambió (volviste a publicar la implementación). El atajo del iPhone sigue apuntando a la anterior: <b>reimporta el atajo</b> con la nueva URL desde <Link href="/app/conexiones/iphone?paso=3" className="underline underline-offset-2">Conectar iPhone</Link>.
        </Notice>
      )}

      <section className={`card grid gap-3 ${rise}`} style={{ ["--i" as string]: 1 }} aria-labelledby="camino-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow" id="camino-h">El camino de tus datos</h2>
          <span className="num text-[12px] text-muted">{flow.count}/3 activas</span>
        </div>
        <Diagrama flow={flow} />
        <p className="text-center text-[12.5px] text-muted">Todo ocurre en tu cuenta de Google. Luca no está en este camino.</p>
      </section>

      <section className={`card grid gap-4 ${rise}`} style={{ ["--i" as string]: 2 }} data-testid="card-webapp">
        <CardHead icon={<IconConexiones />} title="Web App del script" sub="La puerta de entrada a tu Sheet para el iPhone y tu IA." pill={<StatusPill pill={webAppPill(c)} />} />
        {c.webAppReady ? (
          <>
            <div className="sunken flex min-w-0 flex-wrap items-center gap-2 px-3.5 py-2.5">
              <code className="min-w-0 flex-1 break-all !bg-transparent !p-0 text-[12px] text-body">{c.execUrl}</code>
              <CopyButton text={c.execUrl} label="Copiar URL /exec" className="btn sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <a className="btn sm" href={c.execUrl} target="_blank" rel="noreferrer">Probar en el navegador <IconExterno size={14} /></a>
              <p className="text-xs text-muted">Debe responder <code>{"{ok:true, app:'luca'}"}</code>.</p>
            </div>
          </>
        ) : (
          <>
            <NumSteps>{[
              <>En tu Sheet: <b>Extensiones → Apps Script → Implementar → Nueva implementación</b>.</>,
              <>Tipo <b>Aplicación web</b> · Ejecutar como <b>Yo</b> · Acceso <b>Cualquier usuario</b>.</>,
              <>Copia la URL que termina en <code>/exec</code> y pégala en tu Sheet → menú <b>Luca → Activar conexiones</b>. Tu script la valida y la guarda.</>,
            ]}</NumSteps>
            <div><a className="btn primary" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet <IconExterno size={15} /></a></div>
          </>
        )}
      </section>

      <section className={`card grid gap-4 ${rise}`} style={{ ["--i" as string]: 3 }} data-testid="card-iphone">
        <CardHead icon={<IconIphone />} title="iPhone" sub="Yapeos recibidos y los menores a S/ 10." pill={<StatusPill pill={iphonePill(c, pending)} />} />
        {c.iphone.connected ? (
          <Telemetry rows={[
            ["Dispositivo", c.iphone.device || "—"],
            ["Último evento", c.iphone.lastEventAt ? `${fmtDateTime(c.iphone.lastEventAt)} (${timeAgo(c.iphone.lastEventAt)})` : "ninguno todavía"],
            ["Eventos", <span key="n" className="num">{c.iphone.eventsCount}</span>],
            ["Última prueba", c.iphone.lastTestAt ? fmtDateTime(c.iphone.lastTestAt) : "—"],
            ...(c.iphone.lastError ? [["Último error", c.iphone.lastError, "text-warning"] as [string, string, string]] : []),
            ...(c.iphone.schemaVersion ? [["Esquema", `v${c.iphone.schemaVersion}`] as [string, string]] : []),
          ]} />
        ) : pending ? (
          <p className="text-sm text-body">Ya tienes un token generado pero tu iPhone aún no ha enviado nada. Termina el asistente: instala el atajo y ejecuta la prueba.</p>
        ) : (
          <p className="text-sm text-body">Yape no envía correo por los yapeos que recibes ni por los menores a S/ 10. Con un atajo de iOS 27, tu iPhone reenvía esas notificaciones a tu script. El asistente te guía en 5 pasos (ábrelo en el iPhone).</p>
        )}
        {c.iphone.silent && c.iphone.connected && (
          <Notice kind="warn">Sin eventos en más de 7 días. Si sigues recibiendo yapeos, revisa que la automatización del atajo esté activa y ejecuta <b>Luca – Probar iPhone</b>.</Notice>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link className={`btn h-auto whitespace-normal py-2.5 ${action.primary ? "primary" : ""}`} data-testid="iphone-configurar" href={action.href}>{action.label}</Link>
          {!c.webAppReady && <p className="text-xs text-muted">Requiere la Web App publicada (arriba); el asistente lo explica en su primer paso.</p>}
        </div>
      </section>

      <section className={`card grid gap-4 ${rise}`} style={{ ["--i" as string]: 4 }} data-testid="card-mcp">
        <CardHead icon={<IconIA />} title="IA (Claude, ChatGPT…)" sub="Pregúntale a tu IA por tus gastos." pill={<StatusPill pill={mcpPill(c)} />} />
        {c.mcp.connected ? (
          <Telemetry rows={[
            ["Cliente", c.mcp.client || "—"],
            ["Conectada", c.mcp.connectedAt ? fmtDateTime(c.mcp.connectedAt) : "—"],
            ["Última consulta", c.mcp.lastCallAt ? `${fmtDateTime(c.mcp.lastCallAt)} (${timeAgo(c.mcp.lastCallAt)})` : "ninguna todavía"],
            ["Consultas", <span key="n" className="num">{c.mcp.callsCount}</span>],
          ]} />
        ) : (
          <p className="text-sm text-body">El servidor MCP de Luca solo transita tus datos a petición tuya, sin guardarlos (ADR-001).</p>
        )}
        <div className="grid gap-1.5">
          <span className="eyebrow">Servidor MCP</span>
          <div className="sunken flex min-w-0 flex-wrap items-center gap-2 px-3.5 py-2.5">
            <code className="min-w-0 flex-1 break-all !bg-transparent !p-0 text-[12.5px] text-ink">{c.mcp.workerUrl}</code>
            <CopyButton text={c.mcp.workerUrl} label="Copiar" className="btn sm" />
          </div>
        </div>
        <div className="grid gap-2">
          <div><a className="btn h-auto whitespace-normal py-2.5 text-left" href={sheetUrl} target="_blank" rel="noreferrer">{c.mcp.connected ? "Desconectar IA" : "Conectar IA (código de 8 caracteres)"} en tu Sheet → menú Luca <IconExterno size={15} className="flex-none" /></a></div>
          <p className="text-xs text-muted">{c.webAppReady ? "El código de pairing lo genera tu script; se usa una sola vez y caduca en 10 min." : "Requiere la Web App publicada (arriba)."}</p>
        </div>
      </section>
    </div>
  );
}
