/** Iconos de trazo (24×24, currentColor). Decorativos: van con texto visible o aria-label en el control. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 18, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>{children}</svg>
);

export const IconResumen = (p: P) => <S {...p}><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></S>;
export const IconLista = (p: P) => <S {...p}><path d="M4 6h16M4 12h16M4 18h10" /></S>;
export const IconMas = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconConexiones = (p: P) => <S {...p}><path d="M9 7H7a5 5 0 0 0 0 10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></S>;
export const IconAjustes = (p: P) => <S {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></S>;
export const IconSheet = (p: P) => <S {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></S>;
export const IconBuscar = (p: P) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>;
export const IconActualizar = (p: P) => <S {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></S>;
export const IconChevron = ({ dir = "down", ...p }: P & { dir?: "down" | "up" | "left" | "right" }) => {
  const d = { down: "m6 9 6 6 6-6", up: "m6 15 6-6 6 6", left: "m15 6-6 6 6 6", right: "m9 6 6 6-6 6" }[dir];
  return <S {...p}><path d={d} /></S>;
};
export const IconSol = (p: P) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></S>;
export const IconLuna = (p: P) => <S {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></S>;
export const IconSistema = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></S>;
export const IconSalir = (p: P) => <S {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></S>;
export const IconExterno = (p: P) => <S {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></S>;
export const IconCerrar = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const IconDescargar = (p: P) => <S {...p}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" /></S>;
export const IconIphone = (p: P) => <S {...p}><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></S>;
export const IconIA = (p: P) => <S {...p}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></S>;
export const IconCorreo = (p: P) => <S {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></S>;
export const IconCopiar = (p: P) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></S>;
