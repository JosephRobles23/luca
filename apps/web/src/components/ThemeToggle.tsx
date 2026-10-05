"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "luca.theme";
const EVT = "luca:theme";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Tema: sistema", light: "Tema: claro", dark: "Tema: oscuro" };
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

/** Script inline para aplicar el tema guardado antes del primer pintado (evita el parpadeo). */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

function read(): Theme {
  try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}
function write(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", t);
  try { localStorage.setItem(KEY, t); } catch { /* sin storage */ }
  window.dispatchEvent(new Event(EVT));
}

export type { Theme };
export const useTheme = () => useSyncExternalStore(subscribe, read, () => "system" as Theme);
export const setTheme = write;

/** Selector de tema de tres posiciones (menú de usuario y Ajustes). */
export function ThemeSegmented() {
  const theme = useTheme();
  const opts: [Theme, string][] = [["system", "Sistema"], ["light", "Claro"], ["dark", "Oscuro"]];
  return (
    <div className="segmented" role="radiogroup" aria-label="Tema">
      {opts.map(([t, l]) => <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => write(t)}>{l}</button>)}
    </div>
  );
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <button type="button" className="btn icon" onClick={() => write(NEXT[theme])} aria-label={`${LABEL[theme]}. Cambiar tema`} title={LABEL[theme]} data-testid="theme-toggle">
      <span aria-hidden>{ICON[theme]}</span>
    </button>
  );
}
