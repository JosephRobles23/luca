"use client";

/**
 * Resumen (/app), DESIGN.md §Layout · Resumen: saludo + frescura del escaneo + selector de mes → fila superior
 * (gasto del mes + comercios principales 1.5fr · por categorizar 1fr) → fila media (en qué se fue + últimos 6
 * meses) → movimientos del mes agrupados por día. La lógica vive en lib/resumen, lib/dias y lib/ledger.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isoLima, summarize } from "@/lib/ledger";
import { iphoneStatus } from "@/lib/ajustes";
import { scanFreshness } from "@/lib/dias";
import { firstName, monthName, monthOptions } from "@/lib/resumen";
import { useLedger } from "./LedgerProvider";
import { useFirstView } from "./motion";
import { Notice } from "./ui";
import MonthPicker from "./resumen/MonthPicker";
import SpentCard from "./resumen/SpentCard";
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
  const setMonth = (m: string) => { setMonthState(m); setPicked(true); };

  const txs = useMemo(() => (state.phase === "ready" ? state.data.txs : []), [state]);
  const usdRate = state.phase === "ready" ? state.data.usdRate : undefined;
  const ajustes = useMemo(() => (state.phase === "ready" ? state.data.ajustes : {}), [state]);
  const months = monthOptions(txs, current, month);
  const s = useMemo(() => summarize(txs, { month, usdRate }), [txs, month, usdRate]);
  const iphone = useMemo(() => iphoneStatus(ajustes, now), [ajustes, now]);

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

      {iphone.silent && (
        <Notice kind="warn" action={<Link className="btn sm" href="/app/conexiones">Ver conexiones</Link>}>
          {iphone.silentDays == null ? "Tu iPhone está conectado pero nunca ha enviado un evento." : `Tu iPhone lleva ${iphone.silentDays} días sin enviar eventos.`} Si sigues recibiendo yapeos, revisa la automatización del atajo.
        </Notice>
      )}

      {/* Fila superior: gasto (+ comercios debajo) 1.5fr · por categorizar 1fr. En móvil el orden es gasto,
          pendientes, comercios: la columna izquierda se disuelve (`contents`) y manda `order`. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:grid lg:content-start lg:gap-4">
          <SpentCard s={s} month={month} name={name} prevName={prevName} today={today} anim={anim} {...rise(1, "order-1 lg:order-none")} />
          {s.movements.length > 0 && <TopMerchants key={`mer-${month}`} data={s.topMerchants} month={month} anim={anim} {...rise(3, "order-3 lg:order-none")} />}
        </div>
        <PendingCard key={`pend-${month}`} pending={s.pending} month={month} {...rise(2, "order-2 lg:order-none")} />
      </div>

      {s.movements.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <CategoryBreakdown key={`cat-${month}`} data={s.byCategory} total={s.expense} month={month} anim={anim} {...rise(4)} />
            <SixMonths key={`m6-${month}`} data={s.last6} current={month} onPick={setMonth} anim={anim} {...rise(5)} />
          </div>
          <MonthMovements txs={s.movements} month={month} name={name} today={today} usdRate={usdRate ?? 0} {...rise(6)} />
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
          <SixMonths key={`m6-${month}`} data={s.last6} current={month} onPick={setMonth} anim={anim} {...rise(4)} />
        </div>
      )}
    </div>
  );
}
