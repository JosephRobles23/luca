/**
 * Instalación de la app (ADR-011): qué ofrecer en cada navegador. Lógica pura; el componente `Pwa.tsx` le pasa el
 * user agent, si la app ya corre instalada (`display-mode: standalone`) y si el navegador ofreció su diálogo
 * (`beforeinstallprompt`, Chrome/Edge/Android).
 */

export type InstallMode = "installed" | "prompt" | "ios" | "unsupported";

/** iPhone/iPad. El iPad con Safari se presenta como Mac: se distingue por la pantalla táctil. */
export const isIos = (ua: string, touchPoints: number) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

/**
 * En iOS no hay diálogo: se instala desde Compartir → Añadir a pantalla de inicio (Safari y, desde iOS 16.4,
 * también Chrome y Edge).
 */
export function installMode(p: { ua: string; touchPoints: number; standalone: boolean; canPrompt: boolean }): InstallMode {
  if (p.standalone) return "installed";
  if (p.canPrompt) return "prompt";
  if (isIos(p.ua, p.touchPoints)) return "ios";
  return "unsupported";
}
