// Entorno compartido de las herramientas: node-canvas con las fuentes Geist registradas, film.js y binarios.
// node-canvas y ffmpeg/ffprobe estáticos viven fuera del repo (ANIM_TOOLS, por defecto /tmp/anim-tools):
//   mkdir -p /tmp/anim-tools && cd /tmp/anim-tools && npm init -y && npm i canvas@3 ffmpeg-static ffprobe-static
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const toolsReq = createRequire(process.env.ANIM_TOOLS || '/tmp/anim-tools/package.json');
const canvas = toolsReq('canvas');
for (const w of [300, 400, 500, 600, 700]) {
  canvas.registerFont(join(root, 'fonts', `Geist-${w}.ttf`), { family: 'Geist', weight: String(w) });
  canvas.registerFont(join(root, 'fonts', `GeistMono-${w}.ttf`), { family: 'Geist Mono', weight: String(w) });
}
export const { createCanvas } = canvas;
export const FFMPEG = process.env.FFMPEG || (existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : toolsReq('ffmpeg-static'));
export const FFPROBE = process.env.FFPROBE || (existsSync('/usr/bin/ffprobe') ? '/usr/bin/ffprobe' : toolsReq('ffprobe-static').path);
export const Film = createRequire(import.meta.url)(join(root, 'film.js'));
// Versión de voz: VOICE_SET=mujer → audio/narr-mujer, banda-sonora-mujer.m4a, captions-mujer.js, luca-pitch-mujer.mp4.
// Sin VOICE_SET: la versión original (Charon).
export const SET = process.env.VOICE_SET || '';
export const SUFFIX = SET ? '-' + SET : '';
export const NARR_DIR = join(root, 'audio', 'narr' + SUFFIX);
export const SOUNDTRACK = join(root, 'audio', `banda-sonora${SUFFIX}.m4a`);
// Si ya hay narración, los subtítulos usan sus duraciones reales
const mf = join(NARR_DIR, 'manifest.json');
if (existsSync(mf)) Film.setCaptionTimes(JSON.parse((await import('node:fs')).readFileSync(mf, 'utf8')).lines);
export function initFilm() { Film.init({ makeCanvas: (w, h) => createCanvas(w, h) }); return Film; }
