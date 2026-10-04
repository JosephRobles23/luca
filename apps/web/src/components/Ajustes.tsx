"use client";

import { useMemo, useState } from "react";
import { apiKeyConfigured, importStatus, usdRate } from "@/lib/ajustes";
import { todayLima } from "@/lib/ledger";
import { useLedger } from "./LedgerProvider";
import { Field, Notice, fmtDateTime } from "./ui";

export default function Ajustes() {
  const { state } = useLedger();
  if (state.phase !== "ready") return null;
  // `key` por lectura: al recargar la Sheet el formulario se vuelve a inicializar con los valores nuevos.
  return <AjustesForm key={state.data.loadedAt} />;
}

function AjustesForm() {
  const { state, saveAjustes, cambiarSheet, signOutAction } = useLedger();
  const a = useMemo(() => (state.phase === "ready" ? state.data.ajustes : {}), [state]);
  const [fx, setFx] = useState(() => a["fx.usd_pen"] || String(usdRate(a)));
  const [senders, setSenders] = useState(() => a["gmail.senders"] ?? "");
  const [batch, setBatch] = useState(() => a["gmail.batch"] || "40");
  const [since, setSince] = useState(() => a["import.since"] || "");
  const [busy, setBusy] = useState<string | null>(null);

  if (state.phase !== "ready") return null;
  const file = state.file;
  const sheetUrl = file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
  const imp = importStatus(a);
  const hasKey = apiKeyConfigured(a);

  async function run(label: string, fn: () => Promise<boolean>) { setBusy(label); try { await fn(); } finally { setBusy(null); } }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="label !mb-0">Ajustes</h1>
      <p className="text-sm text-muted">Todo se guarda en la pestaña <b className="text-text">Ajustes</b> de tu Sheet; tu script lo lee en el siguiente escaneo (cada 15 min).</p>

      <form className="card grid gap-4" onSubmit={(e) => { e.preventDefault(); run("lectura", () => saveAjustes({ "fx.usd_pen": fx.replace(",", "."), "gmail.senders": senders.trim(), "gmail.batch": String(parseInt(batch, 10) || 40) })); }} data-testid="ajustes-form">
        <h2 className="label !mb-0">Lectura y conversión</h2>
        <Field label="Tipo de cambio USD → PEN" htmlFor="a-fx" hint="Se usa solo para mostrar cuando el correo no trae su propio tipo de cambio (ADR-005).">
          <input id="a-fx" className="input" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} data-testid="a-fx" />
        </Field>
        <Field label="Remitentes transaccionales" htmlFor="a-senders" hint="Separados por coma. Tu script solo lee correos de estas direcciones.">
          <textarea id="a-senders" className="input" rows={2} value={senders} onChange={(e) => setSenders(e.target.value)} />
        </Field>
        <Field label="Correos por lote" htmlFor="a-batch" hint="Cuántos correos procesa cada pasada del escaneo.">
          <input id="a-batch" className="input !w-28" inputMode="numeric" value={batch} onChange={(e) => setBatch(e.target.value)} />
        </Field>
        <div><button className="btn primary" type="submit" disabled={busy === "lectura"}>{busy === "lectura" ? "Guardando…" : "Guardar"}</button></div>
      </form>

      <section className="card grid gap-3">
        <h2 className="label !mb-0">Categorización con IA (opcional)</h2>
        <p className="text-sm">
          API key: <span className="pill"><i className={`dot ${hasKey ? "" : "off"}`} /> {hasKey ? "configurada" : "falta"}</span>
          {a["llm.provider"] && <span className="ml-2 text-muted">proveedor {a["llm.provider"]}{a["llm.model"] ? ` · ${a["llm.model"]}` : ""}</span>}
        </p>
        <p className="text-xs text-muted">La clave vive solo en tu Apps Script (propiedades de usuario), nunca en Luca ni en esta web (ADR-004). Sin clave todo funciona: lo que no se resuelva queda por categorizar.</p>
        <div><a className="btn" href={sheetUrl} target="_blank" rel="noreferrer">{hasKey ? "Cambiarla" : "Configúrala"} en tu Sheet → menú Luca → Ajustes ↗</a></div>
      </section>

      <form className="card grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!since) return; run("import", () => saveAjustes({ "import.since": since, "import.status": "running" }, "Importación pedida: tu script la hará por lotes en los próximos minutos")); }} data-testid="import-form">
        <h2 className="label !mb-0">Importar historial</h2>
        <p className="text-sm text-muted">Al autorizar se importó tu último mes. Para traer más atrás, elige desde qué fecha: tu script lo hará por lotes en cada pasada.</p>
        {imp.status && (
          <Notice kind={imp.running ? "info" : "ok"}>
            {imp.running ? `Importación en curso desde ${fmtDateTime(imp.since)}.` : imp.done ? `Última importación completada (desde ${fmtDateTime(imp.since)}).` : `Estado: ${imp.status}`}
          </Notice>
        )}
        <Field label="Desde" htmlFor="a-since">
          <input id="a-since" type="date" className="input !w-auto" value={since} max={todayLima()} onChange={(e) => setSince(e.target.value)} data-testid="a-since" />
        </Field>
        <div><button className="btn primary" type="submit" disabled={!since || busy === "import" || imp.running}>{busy === "import" ? "Guardando…" : imp.running ? "Ya hay una importación en curso" : "Importar desde esa fecha"}</button></div>
      </form>

      <section className="card grid gap-3" data-testid="sheet-card">
        <h2 className="label !mb-0">Tu Sheet</h2>
        <p className="text-sm"><b>{file.name}</b><br /><span className="text-xs text-muted">id {file.id}{a["luca.version"] ? ` · LucaLib v${a["luca.version"]}` : ""}{a["scan.lastRunAt"] ? ` · último escaneo ${fmtDateTime(a["scan.lastRunAt"])}` : ""}</span></p>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet ↗</a>
          <button type="button" className="btn" onClick={cambiarSheet}>Cambiar Sheet</button>
          <form action={signOutAction}><button className="btn" type="submit">Cerrar sesión</button></form>
        </div>
      </section>
    </div>
  );
}
