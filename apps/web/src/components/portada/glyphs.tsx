/** Iconos propios de la portada (24×24, currentColor), complementan components/icons.tsx. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 20, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>{children}</svg>
);

export const GlyphScript = (p: P) => <S {...p}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></S>;
export const GlyphBrowser = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01" /></S>;
export const GlyphTag = (p: P) => <S {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.3" /></S>;
export const GlyphTable = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16" /></S>;
export const GlyphFlechaAbajo = (p: P) => <S {...p}><path d="M12 5v14M6 13l6 6 6-6" /></S>;

/** Marca de Google en un solo color (va sobre el botón principal). */
export const GlyphGoogle = ({ size = 18, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.19-1.79 4.13-1.15 1.15-2.93 2.4-6.05 2.4-4.83 0-8.6-3.89-8.6-8.72s3.77-8.72 8.6-8.72c2.6 0 4.51 1.03 5.91 2.35l2.31-2.31C18.75 1.44 16.13 0 12.48 0 5.87 0 .31 5.39.31 12s5.56 12 12.17 12c3.57 0 6.27-1.17 8.37-3.36 2.16-2.16 2.84-5.21 2.84-7.67 0-.76-.05-1.47-.17-2.05H12.48Z" />
  </svg>
);
