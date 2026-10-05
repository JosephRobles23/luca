/**
 * Presentación de Conexiones (`/app/conexiones`): estado de cada tarjeta en pastilla, la acción del iPhone y
 * el estado del diagrama del camino (iPhone/IA → tu script → tu Sheet). Lógica pura; el componente solo pinta.
 */
import type { Ajustes, ConnectionsStatus } from "./ajustes.ts";

export type Tone = "ok" | "warn" | "off";
export type Pill = { tone: Tone; label: string };

export const webAppPill = (c: ConnectionsStatus): Pill =>
  c.webAppReady ? { tone: "ok", label: "publicada" } : { tone: "off", label: "sin publicar" };

/** `pending`: hay token generado pero el iPhone aún no envió nada (asistente a medias). */
export function iphonePill(c: ConnectionsStatus, pending: boolean): Pill {
  if (c.iphone.connected) return c.iphone.silent ? { tone: "warn", label: "sin señales" } : { tone: "ok", label: "conectado" };
  return pending ? { tone: "warn", label: "falta la prueba" } : { tone: "off", label: "no configurado" };
}

export const mcpPill = (c: ConnectionsStatus): Pill =>
  c.mcp.connected ? { tone: "ok", label: "conectada" } : { tone: "off", label: "no configurada" };

/** Token generado sin prueba ni eventos todavía. */
export const iphonePending = (c: ConnectionsStatus, a: Ajustes) => !c.iphone.connected && !!(a["conexiones.iphone.token"] ?? "");

/** Botón de la tarjeta iPhone: a dónde lleva el asistente según el estado. */
export function iphoneAction(c: ConnectionsStatus, pending: boolean): { href: string; label: string; primary: boolean } {
  if (c.iphone.connected) return { href: "/app/conexiones/iphone?paso=5", label: "Gestionar (probar, regenerar token, desconectar)", primary: false };
  if (pending) return { href: "/app/conexiones/iphone?paso=3", label: "Continuar la configuración", primary: true };
  return { href: "/app/conexiones/iphone", label: "Configurar", primary: true };
}

export type FlowState = {
  script: Tone;
  iphone: Tone;
  mcp: Tone;
  /** hay datos circulando por la rama (fuente conectada y Web App publicada) → punto que recorre el trazo */
  iphoneLive: boolean;
  mcpLive: boolean;
  /** conexiones activas sobre 3 (Web App, iPhone, IA) */
  count: number;
  summary: string;
};

/** Estado del diagrama del camino. Sin Web App publicada ninguna rama transporta datos. */
export function flowState(c: ConnectionsStatus, pending = false): FlowState {
  const ip = iphonePill(c, pending), mc = mcpPill(c), wa = webAppPill(c);
  const iphoneLive = c.webAppReady && c.iphone.connected && !c.iphone.silent;
  const mcpLive = c.webAppReady && c.mcp.connected;
  const count = [c.webAppReady, c.iphone.connected, c.mcp.connected].filter(Boolean).length;
  return {
    script: wa.tone, iphone: ip.tone, mcp: mc.tone, iphoneLive, mcpLive, count,
    summary: `Web App ${wa.label}; iPhone ${ip.label}; IA ${mc.label}.`,
  };
}
