"use client";

/**
 * Resumen (/app), DESIGN.md §Layout · Resumen: saludo + frescura del escaneo + selector de mes → banda de
 * indicadores → rejilla de 12 columnas sin huecos: ritmo del mes (8) + perfil de gasto (4) · en qué se fue,
 * comercios y por categorizar (4 + 4 + 4) · últimos 6 meses (5) + movimientos del mes (7). La lógica vive en
 * lib/resumen, lib/graficos, lib/dias y lib/ledger.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isoLima, summarize } from "@/lib/ledger";
import { iphoneStatus } from "@/lib/ajustes";
import { scanFreshness } from "@/lib/dias";
import { firstName, monthName, monthOptions } from "@/lib/resumen";
import { useLedger } from "./LedgerProvider";
import VersionNotice from "./VersionNotice";
import { useFirstView } from "./motion";
import { Notice } from "./ui";
import MonthPicker from "./resumen/MonthPicker";
import { deltaAlDia, ritmoMes, sixMonthTotals } from "@/lib/graficos";
import KpiBand from "./resumen/KpiBand";
import PaceCard from "./resumen/PaceCard";
import RadarCard from "./resumen/RadarCard";
import PendingCard from "./resumen/PendingCard";
import CategoryBreakdown from "./resumen/CategoryBreakdown";
import SixMonths from "./resumen/SixMonths";
import TopMerchants from "./resumen/TopMerchants";
import MonthMovements from "./resumen/MonthMovements";

/** Reloj de la página: se renueva cada minuto (frescura del escaneo, "Hoy", ritmo del mes). */
function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}

export default function Dashboard() {
  const { state, user } = useLedger();
  const now = useNow();
  const today = isoLima(new Date(now)).slice(0, 10);
  const current = today.slice(0, 7);
  const [month, setMonthState] = useState(current);
  // Las tarjetas entran (.rise) solo en la primera vista; los gráficos se dibujan entonces y al cambiar de mes.
  const first = useFirstView("resumen");
  const [picked, setPicked] = useState(false);
  // Categoría elegida en "En qué se fue": filtra los movimientos del mes. Se limpia al cambiar de mes.
  const [cat, setCat] = useState("");
  const setMonth = (m: string) => { setMonthState(m); setPicked(true); setCat(""); };
  const pickCat = useCallback((c: string) => setCat((cur) => (cur === c ? "" : c)), []);

  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const usdRate = state.phase === "ready" ? state.data.usdRate : undefined;
  const ajustes = useMemo(() => (state.phase === "ready" ? state.data.ajustes : {}), [state]);
  const months = monthOptions(txs, current, month);
  const s = useMemo(() => summarize(txs, { month, usdRate }), [txs, month, usdRate]);
  const iphone = useMemo(() => iphoneStatus(ajustes, now), [ajustes, now]);
  const rate = usdRate ?? 3.5;
  const ritmo = useMemo(() => ritmoMes(txs, month, today, rate), [txs, month, today, rate]);
  const totals = useMemo(() => sixMonthTotals(txs, month, rate), [txs, month, rate]);
  const delta = useMemo(() => deltaAlDia(txs, month, today, rate), [txs, month, today, rate]);

  if (state.phase !== "ready") return null;

  const hello = firstName(user.name, user.email);
  const title = <h1 className="page-title">{hello ? `Hola, ${hello}` : "Hola"}</h1>;

  if (!state.data.hasMovimientos) {
    return (
      <section className="card grid justify-items-start gap-2 py-8" data-testid="empty-ledger">
        <span className="eyebrow">Resumen</span>
        {title}
        <p className="max-w-[60ch] text-[15px] text-body">Tu Sheet todavía no tiene la pestaña <b className="font-semibold text-ink">Movimientos</b>: la crea tu script al autorizarlo (paso 2). Cuando lea tu primer correo verás aquí el gasto del mes.</p>
        <Link className="btn mt-2" href="/app/ajustes">Revisar ajustes</Link>
      </section>
    );
  }

  const name = monthName(month, today);
  const prevName = monthName(s.last6[s.last6.length - 2]?.month ?? month, today);
  const anim = first || picked;
  const rise = (i: number, extra = "") => ({ className: `${first ? "rise" : ""} ${extra}`.trim(), style: first ? ({ "--i": i } as React.CSSProperties) : undefined });

  return (
    <div className="grid min-w-0 gap-4">
      <div {...rise(0, "flex flex-wrap items-end justify-between gap-3.5 pt-1")}>
        <div className="min-w-0">
          {title}
          <p className="mt-0.5 text-sm text-muted">{scanFreshness(ajustes["scan.lastRunAt"], now)}</p>
        </div>
        <MonthPicker months={months} month={month} onChange={setMonth} />
      </div>

      <VersionNotice />

      {iphone.silent && (
        <Notice kind="warn" action={<Link className="btn sm" href="/app/conexiones">Ver conexiones</Link>}>
          {iphone.silentDays == null ? "Tu iPhone está conectado pero nunca ha enviado un evento." : `Tu iPhone lleva ${iphone.silentDays} días sin enviar eventos.`} Si sigues recibiendo yapeos, revisa la automatización del atajo.
        </Notice>
      )}

      <KpiBand s={s} month={month} name={name} prevName={prevName} today={today} anim={anim} totals={totals} delta={delta} {...rise(1)} />

      {s.movements.length ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <PaceCard key={`ritmo-${month}`} r={ritmo} txs={txs} name={name} usdRate={rate} hasPrev={s.prevExpense > 0} {...rise(2, "xl:col-span-7")} />
            <RadarCard key={`radar-${month}`} txs={txs} month={month} usdRate={rate} {...rise(3, "xl:col-span-5")} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            <CategoryBreakdown data={s.byCategory} total={s.expense} month={month} selected={cat} onPick={pickCat} {...rise(4, "lg:col-span-4")} />
            <TopMerchants key={`mer-${month}`} data={s.topMerchants} month={month} anim={anim} {...rise(5, "lg:col-span-4")} />
            <PendingCard key={`pend-${month}`} pending={s.pending} month={month} {...rise(6, "md:col-span-2 lg:col-span-4")} />
          </div>
          <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
            <SixMonths key={`m6-${month}`} data={s.last6} current={month} onPick={setMonth} anim={anim} {...rise(7, "lg:col-span-5")} />
            <MonthMovements txs={s.movements} month={month} name={name} today={today} usdRate={rate} categoria={cat} onClearCategoria={() => setCat("")} {...rise(8, "lg:col-span-7")} />
          </div>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <section {...rise(3, "card grid justify-items-start gap-2")} data-testid="empty-month">
            <h2 className="card-title">Sin movimientos en {name}</h2>
            <p className="text-sm text-body">Si falta algo, agrégalo a mano o pide una importación histórica desde Ajustes.</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Link className="btn primary sm" href="/app/agregar">Agregar movimiento</Link>
              <Link className="btn sm" href="/app/ajustes">Importación histórica</Link>
            </div>
          </section>
          <PendingCard key={`pend-${month}`} pending={s.pending} month={month} {...rise(4)} />
          <SixMonths key={`m6-${month}`} data={s.last6} current={month} onPick={setMonth} anim={anim} {...rise(5, "md:col-span-2")} />
        </div>
      )}
    </div>
  );
}
