"use client";

import Link from "next/link";
import { connectionsStatus } from "@/lib/ajustes";
import { IPHONE_KEYS } from "@/lib/iphone-wizard";
import { useLedger } from "./LedgerProvider";
import { CopyButton, Notice, fmtDateTime, timeAgo } from "./ui";

/**
 * Estado de las conexiones (ADR-003 §Limitaciones, ADR-006 §4) leído de `Ajustes.conexiones.*`.
 * Regla: solo hay botón si tiene efecto desde la web; lo que requiere el Apps Script enlaza al Sheet con la instrucción exacta.
 */
export default function Conexiones() {
  const { state, refresh, refreshing, connectionsSkipped, skipConnections } = useLedger();
  if (state.phase !== "ready") return null;
  const c = connectionsStatus(state.data.ajustes);
  const sheetUrl = state.file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${state.file.id}/edit`;
  const scanAt = state.data.ajustes["scan.lastRunAt"];
  const iphoneToken = state.data.ajustes[IPHONE_KEYS.token] ?? "";
  const iphonePending = !c.iphone.connected && !!iphoneToken; // token generado, sin prueba ni eventos todavía

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="label !mb-0">Conexiones</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={refresh} disabled={refreshing}>{refreshing ? "Actualizando…" : "Actualizar estado"}</button>
          {connectionsSkipped && <button className="btn" onClick={() => skipConnections(false)}>Retomar la guía</button>}
        </div>
      </div>
      <p className="text-sm text-muted">Los eventos del iPhone y las preguntas de tu IA van directo a <i>tu</i> script (Web App). Luca no los ve: aquí solo se muestra la telemetría que tu script escribe en <b className="text-text">Ajustes</b>{scanAt ? ` (último escaneo ${timeAgo(scanAt)})` : ""}.</p>

      {c.iphone.execUrlChanged && (
        <Notice kind="warn" action={<CopyButton text={c.execUrl} label="Copiar URL nueva" />}>
          La URL de tu Web App cambió (volviste a publicar la implementación). El atajo del iPhone sigue apuntando a la anterior: <b>reimporta el atajo</b> con la nueva URL desde <Link href="/app/conexiones/iphone?paso=3" className="underline">Conectar iPhone</Link>.
        </Notice>
      )}

      <section className="card grid gap-3" data-testid="card-webapp">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="label !mb-0">Web App del script</h2>
          <span className="pill"><i className={`dot ${c.webAppReady ? "" : "off"}`} /> {c.webAppReady ? "publicada" : "sin publicar"}</span>
        </div>
        {c.webAppReady ? (
          <>
            <p className="break-all text-xs text-muted">{c.execUrl}</p>
            <div className="flex flex-wrap gap-2"><CopyButton text={c.execUrl} label="Copiar URL /exec" /><a className="btn" href={c.execUrl} target="_blank" rel="noreferrer">Probar en el navegador ↗</a></div>
            <p className="text-xs text-muted">Debe responder <code>{"{ok:true, app:'luca'}"}</code>.</p>
          </>
        ) : (
          <>
            <ol className="grid gap-1 text-sm text-muted">
              <li>1. En tu Sheet: <b className="text-text">Extensiones → Apps Script → Implementar → Nueva implementación</b>.</li>
              <li>2. Tipo <b className="text-text">Aplicación web</b> · Ejecutar como <b className="text-text">Yo</b> · Acceso <b className="text-text">Cualquier usuario</b>.</li>
              <li>3. Copia la URL que termina en <code>/exec</code> y pégala en tu Sheet → menú <b className="text-text">Luca → Activar conexiones</b>. Tu script la valida y la guarda.</li>
            </ol>
            <div><a className="btn primary" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet ↗</a></div>
          </>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card grid content-start gap-3" data-testid="card-iphone">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="label !mb-0">iPhone (yapeos recibidos)</h2>
            <span className="pill"><i className={`dot ${!c.iphone.connected ? "off" : c.iphone.silent ? "warn" : ""}`} /> {!c.iphone.connected ? "no configurado" : c.iphone.silent ? "sin señales" : "conectado"}</span>
          </div>
          {c.iphone.connected ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Dispositivo</dt><dd>{c.iphone.device || "—"}</dd>
              <dt className="text-muted">Último evento</dt><dd>{c.iphone.lastEventAt ? `${fmtDateTime(c.iphone.lastEventAt)} (${timeAgo(c.iphone.lastEventAt)})` : "ninguno todavía"}</dd>
              <dt className="text-muted">Eventos</dt><dd>{c.iphone.eventsCount}</dd>
              <dt className="text-muted">Última prueba</dt><dd>{c.iphone.lastTestAt ? fmtDateTime(c.iphone.lastTestAt) : "—"}</dd>
              {c.iphone.lastError && <><dt className="text-muted">Último error</dt><dd className="text-warn">{c.iphone.lastError}</dd></>}
              {c.iphone.schemaVersion && <><dt className="text-muted">Esquema</dt><dd>v{c.iphone.schemaVersion}</dd></>}
            </dl>
          ) : iphonePending ? (
            <p className="text-sm text-muted">Ya tienes un token generado pero tu iPhone aún no ha enviado nada. Termina el asistente: instala el atajo y ejecuta la prueba.</p>
          ) : (
            <p className="text-sm text-muted">Yape no envía correo por los yapeos que recibes ni por los menores a S/ 10. Con un atajo de iOS 27, tu iPhone reenvía esas notificaciones a tu script. El asistente te guía en 5 pasos (ábrelo en el iPhone).</p>
          )}
          {c.iphone.silent && c.iphone.connected && <p className="text-xs text-warn">Sin eventos en más de 7 días. Si sigues recibiendo yapeos, revisa que la automatización del atajo esté activa y ejecuta <b>Luca – Probar iPhone</b>.</p>}
          <div className="flex flex-wrap gap-2">
            <Link className={`btn ${c.iphone.connected ? "" : "primary"}`} data-testid="iphone-configurar"
              href={c.iphone.connected ? "/app/conexiones/iphone?paso=5" : iphonePending ? "/app/conexiones/iphone?paso=3" : "/app/conexiones/iphone"}>
              {c.iphone.connected ? "Gestionar (probar, regenerar token, desconectar)" : iphonePending ? "Continuar la configuración" : "Configurar"}
            </Link>
          </div>
          {!c.webAppReady && <p className="text-xs text-muted">Requiere la Web App publicada (arriba); el asistente lo explica en su primer paso.</p>}
        </section>

        <section className="card grid content-start gap-3" data-testid="card-mcp">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="label !mb-0">IA (Claude, ChatGPT…)</h2>
            <span className="pill"><i className={`dot ${c.mcp.connected ? "" : "off"}`} /> {c.mcp.connected ? "conectada" : "no configurada"}</span>
          </div>
          {c.mcp.connected ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Cliente</dt><dd>{c.mcp.client || "—"}</dd>
              <dt className="text-muted">Conectada</dt><dd>{c.mcp.connectedAt ? fmtDateTime(c.mcp.connectedAt) : "—"}</dd>
              <dt className="text-muted">Última consulta</dt><dd>{c.mcp.lastCallAt ? `${fmtDateTime(c.mcp.lastCallAt)} (${timeAgo(c.mcp.lastCallAt)})` : "ninguna todavía"}</dd>
              <dt className="text-muted">Consultas</dt><dd>{c.mcp.callsCount}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted">Pregúntale a tu IA por tus gastos. El servidor MCP de Luca solo transita tus datos a petición tuya, sin guardarlos (ADR-001).</p>
          )}
          <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2"><span className="text-muted">Servidor MCP:</span><code className="break-all text-xs">{c.mcp.workerUrl}</code><CopyButton text={c.mcp.workerUrl} label="Copiar" className="btn !py-1 text-xs" /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn" href={sheetUrl} target="_blank" rel="noreferrer">{c.mcp.connected ? "Desconectar IA" : "Conectar IA (código de 8 caracteres)"} en tu Sheet → menú Luca ↗</a>
          </div>
          <p className="text-xs text-muted">{c.webAppReady ? "El código de pairing lo genera tu script; se usa una sola vez y caduca en 10 min." : "Requiere la Web App publicada (arriba)."}</p>
        </section>
      </div>
    </div>
  );
}
