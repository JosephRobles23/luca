// Video del pitch en la portada: dónde vive, sus capítulos y cuál está sonando. Lo usan la sección de la portada
// (components/portada/PitchVideo.tsx) y el VideoObject del JSON-LD (seo.ts). El video se genera en video/ (film.js).

export const PITCH_VIDEO = {
  // MP4 en el bucket R2 público (no en Vercel: pesa ~64 MB). preload="none": solo se descarga al darle play.
  src: "https://pub-9c0cbd6f24354fc589d1b895be70355d.r2.dev/luca-video/luca-pitch-mujer.mp4",
  poster: "/video/pitch-poster.jpg",
  seconds: 142,
  name: "Luca en 2 minutos",
  description:
    "Cómo funciona Luca: un yapeo que llega al iPhone, tu Google Sheet como base de datos, lucaa.lat que solo la muestra y tu IA respondiendo por MCP. Sin servidores que guarden tus datos.",
  uploadDate: "2026-10-05",
} as const;

// Inicio de cada escena del pitch (Film.SCENES en video/film.js).
export const PITCH_CHAPTERS: ReadonlyArray<{ t: number; label: string }> = [
  { t: 22, label: "El viaje de un yapeo" },
  { t: 50, label: "Tu Sheet es la base de datos" },
  { t: 68, label: "La web solo la muestra" },
  { t: 98, label: "Pregúntale a tu IA" },
  { t: 122, label: "Gratis" },
];

/** Índice del capítulo que contiene el segundo `t`; -1 antes del primero. */
export function capituloActivo(t: number, caps: ReadonlyArray<{ t: number }> = PITCH_CHAPTERS): number {
  let on = -1;
  caps.forEach((c, i) => { if (t >= c.t) on = i; });
  return on;
}

/** 82 → "1:22". */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Duración ISO 8601 para schema.org: 142 → "PT2M22S". */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds)), m = Math.floor(s / 60);
  return `PT${m ? `${m}M` : ""}${s % 60}S`;
}
