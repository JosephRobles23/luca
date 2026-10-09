"use client";

/**
 * App instalable (ADR-011). `PwaRegister` (en el layout raíz) registra `/sw.js` solo en producción. El diálogo de
 * instalación del navegador (`beforeinstallprompt`, Chrome/Edge/Android) se captura al cargar este módulo, antes de
 * que ningún componente lo pida; `useInstall()` dice qué ofrecer (`lib/pwa.ts`) y abre ese diálogo.
 */
import { useEffect, useSyncExternalStore } from "react";
import { installMode, type InstallMode } from "@/lib/pwa";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: PromptEvent | null = null;
let justInstalled = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  addEventListener("appinstalled", () => { deferred = null; justInstalled = true; emit(); });
}

const standalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function subscribe(cb: () => void) {
  subs.add(cb);
  const m = matchMedia("(display-mode: standalone)");
  m.addEventListener("change", cb);
  return () => { subs.delete(cb); m.removeEventListener("change", cb); };
}
const snapshot = (): InstallMode =>
  installMode({ ua: navigator.userAgent, touchPoints: navigator.maxTouchPoints, standalone: justInstalled || standalone(), canPrompt: !!deferred });

/** Qué ofrecer para instalar (`null` en el servidor, antes de hidratar) y la acción que abre el diálogo. */
export function useInstall(): { mode: InstallMode | null; prompt: () => Promise<boolean> } {
  const mode = useSyncExternalStore(subscribe, snapshot, () => null);
  const prompt = async () => {
    if (!deferred) return false;
    const e = deferred;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { mode, prompt };
}

/** Envía un mensaje al service worker activo ("warm"); sin service worker, no hace nada. */
export function postToSw(msg: { type: "warm" }) {
  try {
    navigator.serviceWorker?.ready.then((r) => r.active?.postMessage(msg)).catch(() => {});
  } catch { /* sin service worker */ }
}

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* la web funciona igual sin él */ });
  }, []);
  return null;
}
