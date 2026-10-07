// Cama musical del demo narrado: la armonía del pitch (La menor, Am–F–C–G, 96 BPM) en versión tranquila —pad,
// arpegio suave y bajo, sin batería— que baja ~10 dB mientras habla la voz. Determinista (sin Math.random).
//   node tools/music.mjs   # → public/musica.wav (dura lo mismo que LucaNarrado)
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildTimeline} from '../src/timeline-core.mjs';

const root = join(import.meta.dirname, '..');
const OUTRO = Number(/export const OUTRO = ([\d.]+)/.exec(readFileSync(join(root, 'src/cues.ts'), 'utf8'))[1]);
const tl = buildTimeline(
  JSON.parse(readFileSync(join(root, 'narracion-demo.json'), 'utf8')),
  JSON.parse(readFileSync(join(root, 'src/narr-manifest.json'), 'utf8')),
);
const SR = 48000, DUR = tl.duration + OUTRO, N = Math.ceil(DUR * SR);
const TAU = 2 * Math.PI, BAR = 2.5, STEP = BAR / 8;
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const L = new Float32Array(N), R = new Float32Array(N);

// pad: dos compases por acorde, notas desafinadas apenas entre canales, con fundido cruzado
const CHORD_LEN = 2 * BAR;
for (let i = 0; i < N; i++) {
  const t = i / SR, k = Math.floor(t / CHORD_LEN), u = (t % CHORD_LEN) / CHORD_LEN;
  const cur = CHORDS[k % 4], nxt = CHORDS[(k + 1) % 4];
  const x = u > 0.85 ? (u - 0.85) / 0.15 : 0; // fundido hacia el siguiente acorde
  let l = 0, r = 0;
  for (const [notes, g] of [[cur, 1 - x], [nxt, x]]) {
    if (g <= 0) continue;
    for (const m of [...notes, notes[0] + 12]) {
      const f = mtof(m);
      l += g * (Math.sin(TAU * f * 0.999 * t) + 0.25 * Math.sin(TAU * f * 2 * t));
      r += g * (Math.sin(TAU * f * 1.001 * t) + 0.25 * Math.sin(TAU * f * 2.002 * t));
    }
  }
  const lfo = 0.85 + 0.15 * Math.sin(TAU * t / 7);
  L[i] += l * 0.05 * lfo;
  R[i] += r * 0.05 * lfo;
}
// bajo: raíz en cada compás
for (let b = 0; b * BAR < DUR; b++) {
  const f = mtof(CHORDS[Math.floor((b * BAR) / CHORD_LEN) % 4][0] - 12), i0 = Math.round(b * BAR * SR);
  for (let j = 0; j < SR * BAR && i0 + j < N; j++) {
    const t = j / SR, v = Math.sin(TAU * f * t) * Math.min(1, t * 40) * Math.exp(-t * 1.2) * 0.16;
    L[i0 + j] += v; R[i0 + j] += v;
  }
}
// arpegio: corcheas sobre el acorde, alternando canales; entra a los 4 s
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
for (let s = Math.ceil(4 / STEP); s * STEP < DUR - 1; s++) {
  const t0 = s * STEP, notes = CHORDS[Math.floor(t0 / CHORD_LEN) % 4];
  const n = ARP[s % 8], m = n === 3 ? notes[0] + 24 : notes[n] + 12, f = mtof(m), i0 = Math.round(t0 * SR);
  const pan = s % 2 ? 0.7 : 0.3;
  for (let j = 0; j < SR * 0.6 && i0 + j < N; j++) {
    const t = j / SR, v = (Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * f * 3 * t)) * Math.exp(-t * 7) * Math.min(1, t * 300) * 0.05;
    L[i0 + j] += v * (1 - pan); R[i0 + j] += v * pan;
  }
}
// eco estéreo sencillo para dar aire
const D = Math.round(STEP * 3 * SR);
for (let i = D; i < N; i++) { L[i] += R[i - D] * 0.22; R[i] += L[i - D] * 0.22; }

// nivel: RMS a −30 dBFS; ducking bajo la voz; fundidos de entrada y salida
let sum = 0; for (let i = 0; i < N; i++) sum += L[i] * L[i] + R[i] * R[i];
const gain = Math.pow(10, -30 / 20) / Math.sqrt(sum / (2 * N));
const DUCK = Math.pow(10, -10 / 20);
const duckAt = (t) => {
  let g = 1;
  for (const l of tl.lines) {
    const a = l.start - 0.25, b = l.start + l.dur + 0.4;
    if (t > a - 0.3 && t < b + 0.6) g = Math.min(g, t < a ? 1 - (1 - DUCK) * (t - (a - 0.3)) / 0.3 : t > b ? DUCK + (1 - DUCK) * (t - b) / 0.6 : DUCK);
  }
  return g;
};
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const t = i / SR, g = gain * duckAt(t) * Math.min(1, t / 1.5) * Math.min(1, (DUR - t) / 2.5);
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(Math.tanh(L[i] * g) * 32767))), i * 4);
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(Math.tanh(R[i] * g) * 32767))), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28);
h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
writeFileSync(join(root, 'public/musica.wav'), Buffer.concat([h, pcm]));
console.log(`public/musica.wav  ${DUR.toFixed(1)} s`);
