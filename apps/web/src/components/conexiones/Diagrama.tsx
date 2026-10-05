"use client";

/**
 * Diagrama del camino de las conexiones: iPhone / tu IA → tu script (Web App) → tu Sheet.
 * Cada nodo lleva su estado; los trazos activos se dibujan la primera vez (`.draw`) y, si hay una conexión
 * viva, un punto naranja recorre la rama hasta la Sheet. Con movimiento reducido todo queda quieto.
 */
import type { ReactNode } from "react";
import type { FlowState, Tone } from "@/lib/conexiones-ui";
import { IconIA, IconIphone, IconSheet, IconConexiones } from "../icons";
import { useFirstView } from "../motion";
import { useReducedMotion } from "./parts";

const STROKE: Record<Tone, string> = { ok: "var(--success)", warn: "var(--warning)", off: "var(--line-strong)" };
const R = 22;
const N = { iphone: [48, 38], mcp: [48, 120], script: [200, 79], sheet: [352, 79] } as const;
const W = {
  iphone: "M70,38 C130,38 140,79 178,79",
  mcp: "M70,120 C130,120 140,79 178,79",
  sheet: "M222,79 L330,79",
};

export default function Diagrama({ flow }: { flow: FlowState }) {
  const first = useFirstView("conexiones-diagrama");
  const reduced = useReducedMotion();
  const animate = first && !reduced;

  // Una rama solo transporta datos si la Web App está publicada.
  const branch = (t: Tone): Tone => (flow.script === "off" ? "off" : t);
  const wire = (d: string, tone: Tone, i: number) => tone === "off"
    ? <path key={d} d={d} fill="none" stroke={STROKE.off} strokeWidth={1.5} strokeDasharray="3 5" strokeLinecap="round" />
    : <path key={d} d={d} fill="none" stroke={STROKE[tone]} strokeWidth={2} strokeLinecap="round" pathLength={100}
      className={animate ? "draw" : undefined} style={{ ["--i" as string]: i }} />;

  const dot = (d: string, begin: string) => (
    <g key={d}>
      <circle r={7} fill="var(--primary)" opacity={0.18}>
        <animateMotion dur="3.2s" begin={begin} repeatCount="indefinite" path={d} />
      </circle>
      <circle r={3.5} fill="var(--primary)">
        <animateMotion dur="3.2s" begin={begin} repeatCount="indefinite" path={d} />
      </circle>
    </g>
  );

  return (
    <svg viewBox="0 0 400 166" className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={`Camino de tus datos. ${flow.summary}`} data-testid="conexiones-diagrama">
      {wire(W.iphone, branch(flow.iphone), 0)}
      {wire(W.mcp, branch(flow.mcp), 1)}
      {wire(W.sheet, flow.script, 2)}
      {!reduced && flow.iphoneLive && dot(`${W.iphone} L330,79`, "0s")}
      {!reduced && flow.mcpLive && dot(`${W.mcp} L330,79`, flow.iphoneLive ? "-1.6s" : "0s")}
      <Node at={N.iphone} tone={flow.iphone} label="iPhone" icon={<IconIphone size={20} />} />
      <Node at={N.mcp} tone={flow.mcp} label="Tu IA" icon={<IconIA size={20} />} />
      <Node at={N.script} tone={flow.script} label="Tu script" sub="Web App" icon={<IconConexiones size={20} />} />
      <Node at={N.sheet} tone="ok" label="Tu Sheet" sub="en tu Drive" icon={<IconSheet size={20} />} />
    </svg>
  );
}

function Node({ at: [cx, cy], tone, label, sub, icon }: { at: readonly [number, number]; tone: Tone; label: string; sub?: string; icon: ReactNode }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill="var(--card)" stroke={STROKE[tone]} strokeWidth={1.5} strokeDasharray={tone === "off" ? "3 4" : undefined} />
      <g transform={`translate(${cx - 10} ${cy - 10})`} style={{ color: tone === "off" ? "var(--muted)" : "var(--ink)" }}>{icon}</g>
      <circle cx={cx + 16} cy={cy - 16} r={5} fill={tone === "off" ? "var(--muted)" : STROKE[tone]} stroke="var(--card)" strokeWidth={2} className={tone === "ok" ? "pop" : undefined} />
      <text x={cx} y={cy + R + 15} textAnchor="middle" fontSize={13.5} fontWeight={500} fill="var(--ink)">{label}</text>
      {sub && <text x={cx} y={cy + R + 29} textAnchor="middle" fontSize={11} fill="var(--muted)">{sub}</text>}
    </g>
  );
}
