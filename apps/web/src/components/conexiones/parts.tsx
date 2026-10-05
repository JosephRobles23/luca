"use client";

/** Piezas de presentación de Conexiones, Ajustes y el asistente del iPhone (DESIGN.md §Layout: tarjetas con estado en pastilla). */
import { useSyncExternalStore, type ReactNode } from "react";
import type { Pill, Tone } from "@/lib/conexiones-ui";

const PILL_TONE: Record<Tone, string> = { ok: "bg-success-soft text-success", warn: "bg-warning-soft text-warning", off: "" };

/** Pastilla de estado con punto: verde conectado, ámbar pendiente, gris apagado. */
export function StatusPill({ pill, testId }: { pill: Pill; testId?: string }) {
  return (
    <span className={`pill ${PILL_TONE[pill.tone]}`} data-testid={testId}>
      <i className={`dot ${pill.tone === "ok" ? "" : pill.tone}`} aria-hidden /> {pill.label}
    </span>
  );
}

/** Cabecera de tarjeta: icono en cuadro hundido · título y subtítulo · pastilla a la derecha. */
export function CardHead({ icon, title, sub, pill, id }: { icon?: ReactNode; title: string; sub?: ReactNode; pill?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="grid size-10 flex-none place-items-center rounded-[10px] bg-sunken text-body" aria-hidden>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <h2 className="card-title text-ink" id={id}>{title}</h2>
          {pill}
        </div>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/** Lista de pasos numerados (instrucciones que se hacen en la Sheet o en el iPhone). */
export function NumSteps({ children, className = "" }: { children: ReactNode[]; className?: string }) {
  return (
    <ol className={`grid gap-2 ${className}`}>
      {children.map((c, i) => (
        <li key={i} className="sunken grid grid-cols-[24px_1fr] items-start gap-3 px-3.5 py-3 text-sm text-body">
          <span className="num grid size-6 place-items-center rounded-full border border-line-strong bg-card text-[12px] text-ink" aria-hidden>{i + 1}</span>
          <span className="min-w-0 pt-0.5 [&_b]:font-medium [&_b]:text-ink">{c}</span>
        </li>
      ))}
    </ol>
  );
}

/** Telemetría en filas etiqueta / valor sobre fondo hundido. */
export function Telemetry({ rows }: { rows: [string, ReactNode, string?][] }) {
  return (
    <dl className="sunken grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 px-4 py-3 text-sm">
      {rows.map(([k, v, cls]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className={`min-w-0 break-words text-ink ${cls ?? ""}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const mq = () => window.matchMedia("(prefers-reduced-motion: reduce)");
function subscribeMotion(cb: () => void) { const m = mq(); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }

/** true si el usuario pidió menos movimiento (para SMIL y Web Animations, que no respetan la regla CSS global). */
export const useReducedMotion = () => useSyncExternalStore(subscribeMotion, () => mq().matches, () => true);
