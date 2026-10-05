"use client";

import { useEffect, useMemo, useState } from "react";
import { apiKeyConfigured, importStatus, usdRate } from "@/lib/ajustes";
import { todayLima } from "@/lib/ledger";
import { CardHead, StatusPill } from "./conexiones/parts";
import { IconExterno, IconIA, IconSheet, IconSistema } from "./icons";
import { useLedger } from "./LedgerProvider";
import { DrawCheck, useFirstView } from "./motion";
import { ThemeSegmented } from "./ThemeToggle";
import { Field, Notice, fmtDateTime } from "./ui";

type Saved = { what: string; at: number } | null;

export default function Ajustes() {
  const { state } = useLedger();
  // La confirmación vive aquí y no en el formulario: guardar recarga la Sheet y el formulario se vuelve a montar.
  const [saved, setSaved] = useState<Saved>(null);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(null), 3200); return () => clearTimeout(t); }, [saved]);
  const first = useFirstView("ajustes");
  if (state.phase !== "ready") return null;
  // `key` por lectura: al recargar la Sheet el formulario se vuelve a inicializar con los valores nuevos.
  return <AjustesForm key={state.data.loadedAt} saved={saved} onSaved={(what) => setSaved({ what, at: Date.now() })} rise={first ? "rise" : ""} />;
}

/** Confirmación en el mismo lugar donde se guardó (DESIGN.md: además del toast). */
function SavedInline({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="fade-in inline-flex items-center gap-1.5 text-[13px] font-medium text-success" role="status"><DrawCheck size={18} /> Guardado en tu Sheet</span>;
}

function AjustesForm({ saved, onSaved, rise }: { saved: Saved; onSaved: (what: string) => void; rise: string }) {
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

  async function run(label: string, fn: () => Promise<boolean>) {
    setBusy(label);
    try { if (await fn()) onSaved(label); } finally { setBusy(null); }
  }
  const delay = (i: number) => ({ ["--i" as string]: i });

  return (
    <div className="mx-auto grid w-full max-w-[760px] gap-4">
      <header className={rise}>
        <h1 className="page-title">Ajustes</h1>
        <p className="mt-1.5 text-sm text-body">Todo se guarda en la pestaña <b className="font-medium text-ink">Ajustes</b> de tu Sheet; tu script lo lee en el siguiente escaneo (cada 15 min).</p>
      </header>

      <section className={`card grid gap-4 ${rise}`} style={delay(1)} aria-labelledby="ap-h">
        <CardHead id="ap-h" icon={<IconSistema />} title="Apariencia" sub="Claro crema, oscuro negro, o lo que diga tu sistema. Se guarda en este navegador." />
        <div><ThemeSegmented /></div>
      </section>

      <form className={`card grid gap-4 ${rise}`} style={delay(2)} onSubmit={(e) => { e.preventDefault(); run("lectura", () => saveAjustes({ "fx.usd_pen": fx.replace(",", "."), "gmail.senders": senders.trim(), "gmail.batch": String(parseInt(batch, 10) || 40) })); }} data-testid="ajustes-form">
        <CardHead title="Lectura y conversión" sub="Cómo lee tu script los correos del banco." />
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Tipo de cambio USD → PEN" htmlFor="a-fx" hint="Se usa solo para mostrar cuando el correo no trae su propio tipo de cambio (ADR-005).">
            <input id="a-fx" className="input num sm:!w-40" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} data-testid="a-fx" />
          </Field>
          <Field label="Correos por lote" htmlFor="a-batch" hint="Por pasada del escaneo.">
            <input id="a-batch" className="input num !w-28" inputMode="numeric" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </Field>
        </div>
        <Field label="Remitentes transaccionales" htmlFor="a-senders" hint="Separados por coma. Tu script solo lee correos de estas direcciones.">
          <textarea id="a-senders" className="input font-mono !text-[12.5px]" rows={2} value={senders} onChange={(e) => setSenders(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn primary" type="submit" disabled={busy === "lectura"}>{busy === "lectura" ? "Guardando…" : "Guardar"}</button>
          <SavedInline key={saved?.at} show={saved?.what === "lectura"} />
        </div>
      </form>

      <section className={`card grid gap-4 ${rise}`} style={delay(3)} aria-labelledby="ia-h">
        <CardHead id="ia-h" icon={<IconIA />} title="Categorización con IA" sub="Opcional. Sin clave todo funciona: lo que no se resuelva queda por categorizar." />
        <div className="sunken flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 text-body">API key: <StatusPill pill={hasKey ? { tone: "ok", label: "configurada" } : { tone: "warn", label: "falta" }} /></p>
          {a["llm.provider"] && <span className="text-[13px] text-muted">proveedor <span className="text-ink">{a["llm.provider"]}</span>{a["llm.model"] ? <> · <span className="num">{a["llm.model"]}</span></> : null}</span>}
        </div>
        <p className="text-xs text-muted">La clave vive solo en tu Apps Script (propiedades de usuario), nunca en Luca ni en esta web (ADR-004).</p>
        <div><a className="btn h-auto whitespace-normal py-2.5 text-left" href={sheetUrl} target="_blank" rel="noreferrer">{hasKey ? "Cambiarla" : "Configúrala"} en tu Sheet → menú Luca → Ajustes <IconExterno size={15} className="flex-none" /></a></div>
      </section>

      <form className={`card grid gap-4 ${rise}`} style={delay(4)} onSubmit={(e) => { e.preventDefault(); if (!since) return; run("import", () => saveAjustes({ "import.since": since, "import.status": "running" }, "Importación pedida: tu script la hará por lotes en los próximos minutos")); }} data-testid="import-form">
        <CardHead title="Importar historial" sub="Al autorizar se importó tu último mes. Para traer más atrás, elige desde qué fecha: tu script lo hará por lotes en cada pasada." />
        {imp.status && (
          <Notice kind={imp.running ? "info" : "ok"}>
            {imp.running ? `Importación en curso desde ${fmtDateTime(imp.since)}.` : imp.done ? `Última importación completada (desde ${fmtDateTime(imp.since)}).` : `Estado: ${imp.status}`}
          </Notice>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde" htmlFor="a-since">
            <input id="a-since" type="date" className="input num !w-auto" value={since} max={todayLima()} onChange={(e) => setSince(e.target.value)} data-testid="a-since" />
          </Field>
          <button className="btn primary" type="submit" disabled={!since || busy === "import" || imp.running}>{busy === "import" ? "Guardando…" : imp.running ? "Ya hay una importación en curso" : "Importar desde esa fecha"}</button>
        </div>
        <SavedInline key={saved?.at} show={saved?.what === "import"} />
      </form>

      <section className={`card grid gap-4 ${rise}`} style={delay(5)} data-testid="sheet-card" aria-labelledby="sh-h">
        <CardHead id="sh-h" icon={<IconSheet />} title="Tu Sheet" sub="Tus datos viven aquí, en tu Google Drive." />
        <div className="sunken grid gap-1 px-4 py-3">
          <b className="break-words text-sm font-medium text-ink">{file.name}</b>
          <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
            <span className="num break-all">id {file.id}</span>
            {a["luca.version"] && <span className="tag">LucaLib v{a["luca.version"]}</span>}
            {a["scan.lastRunAt"] && <span>último escaneo {fmtDateTime(a["scan.lastRunAt"])}</span>}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={sheetUrl} target="_blank" rel="noreferrer">Abrir mi Sheet <IconExterno size={15} /></a>
          <button type="button" className="btn" onClick={cambiarSheet}>Cambiar Sheet</button>
          <form action={signOutAction} className="sm:ml-auto"><button className="btn ghost" type="submit">Cerrar sesión</button></form>
        </div>
      </section>
    </div>
  );
}
