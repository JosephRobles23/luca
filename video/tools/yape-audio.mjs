#!/usr/bin/env node
// Música y efectos de la edición vertical (tools/yape-edit.mjs): electrónica mínima y luminosa, 100 BPM, La menor
// (Am–F–C–G), con efectos de UI en cada señal de tools/yape-timeline.mjs (anillos, congelados, cortes, acelerados).
// Sin voz. Mismo enfoque que tools/audio.mjs (síntesis determinista, loudnorm de ffmpeg en dos pasadas a −16 LUFS).
//
//   node tools/yape-audio.mjs     # -> audio/yape-banda.m4a (luego node tools/yape-edit.mjs la mezcla en el video)
import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, FFMPEG } from './env.mjs';
import { layout } from './yape-timeline.mjs';

const OUT = join(root, 'audio');
mkdirSync(OUT, { recursive: true });
const { segs, cues, duration: DUR } = layout();
const SR = 48000, N = Math.round(DUR * SR), PI = Math.PI, TAU = 2 * PI;
const BAR = 2.4, BEAT = BAR / 4;
const at = (kind) => segs.find((s) => s.card === kind);
const INTRO_END = at('intro').end, OUTRO = at('outro').start;
const REAL = segs.find((s) => s.cap?.[0] === 'LA PRUEBA REAL').start; // respiro antes del yapeo real

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const rng = (n) => mulberry32(seedOf(n));
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MUS = [new Float32Array(N), new Float32Array(N)], SFX = [new Float32Array(N), new Float32Array(N)];
const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
function put(b, t0, sig, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR), a = ((clamp(pan, -1, 1) + 1) * PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
  for (let k = 0; k < sig.length; k++) { const i = i0 + k; if (i < 0 || i >= N) continue; b[0][i] += sig[k] * gl; b[1][i] += sig[k] * gr; }
}
function biquad(x, type, f, q = 0.707) {
  const w = (TAU * f) / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
const noise = (sec, name) => { const r = rng(name), x = buf(sec); for (let i = 0; i < x.length; i++) x[i] = r() * 2 - 1; return x; };

// ───────────── efectos (los mismos timbres que tools/audio.mjs) ─────────────
function pop(f = 880) { const x = buf(0.12); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(TAU * f * t * (1 - t * 2)) * Math.exp(-t * 38) + Math.sin(TAU * f * 2 * t) * 0.2 * Math.exp(-t * 70); } return x; }
function tick() { const x = noise(0.03, 'tick'); biquad(x, 'hp', 3000); for (let i = 0; i < x.length; i++) x[i] *= Math.exp((-i / SR) * 160); return x; }
function whoosh(sec, name, f0 = 400, f1 = 3000) {
  const x = noise(sec, name), y = buf(sec), M = 256;
  for (let s = 0; s < x.length; s += M) {
    const k = s / x.length, f = f0 * Math.pow(f1 / f0, k), chunk = x.slice(Math.max(0, s - 512), s + M);
    biquad(chunk, 'bp', f, 1.2);
    for (let i = 0; i < M && s + i < x.length; i++) y[s + i] = chunk[Math.min(chunk.length - 1, i + (s ? 512 : 0))] * Math.sin(PI * k);
  }
  return y;
}
function impact(deep = 1) {
  const x = buf(1.6), n = noise(0.3, 'imp'); biquad(n, 'lp', 900);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(TAU * (48 + 60 * Math.exp(-t * 18)) * t) * Math.exp(-t * 3.2 / deep) * 0.9 + (i < n.length ? n[i] * Math.exp(-t * 16) * 0.6 : 0); }
  return x;
}
function swish() { const x = noise(0.18, 'swish'); biquad(x, 'hp', 2500); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.sin(PI * clamp(t / 0.18)) ** 2; } return x; }
function chime(f = mtof(88)) { const x = buf(0.9); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.5 * t) * (t > 0.06 ? 1 : 0)) * Math.exp(-t * 6) * 0.5; } return x; }
function sparkle(name) { const r = rng(name), x = buf(1.0); for (let k = 0; k < 14; k++) { const t0 = r() * 0.8, f = mtof(84 + Math.floor(r() * 16)); for (let i = Math.round(t0 * SR); i < x.length; i++) { const t = i / SR - t0; if (t > 0.2) break; x[i] += Math.sin(TAU * f * t) * Math.exp(-t * 30) * 0.25; } } return x; }
// zumbido de cinta acelerada: ruido filtrado que sube durante el tramo
function whir(sec, name) { const x = noise(sec, name), y = buf(sec); biquad(x, 'bp', 1800, 0.8); for (let i = 0; i < y.length; i++) { const k = i / y.length, t = i / SR; y[i] = x[i] * Math.min(1, k * 8, (1 - k) * 8) * 0.35 + Math.sin(TAU * (300 + 500 * k) * t) * 0.05 * Math.min(1, k * 8, (1 - k) * 8); } return y; }

const sfx = (t, sig, gain, pan = 0) => put(SFX, t, sig, gain, pan);
cues.forEach((c, i) => {
  const ok = c.color === 'success';
  switch (c.kind) {
    case 'intro': sfx(c.t + 0.15, impact(1.4), 0.5); sfx(c.t + 0.2, sparkle('intro'), 0.25); break;
    case 'outro': sfx(c.t + 0.6, whoosh(0.9, 'outro', 2500, 300), 0.3); sfx(c.t + 1.0, impact(1.8), 0.5); sfx(c.t + 1.05, sparkle('end'), 0.3); break;
    case 'caption': sfx(c.t, whoosh(0.5, 'cap' + i, 600, 2600), 0.16, -0.2); break;
    case 'cut': sfx(c.t, swish(), 0.35); break;
    case 'freeze': sfx(c.t, whoosh(0.6, 'frz' + i, 2600, 300), 0.22); break;
    case 'fast': sfx(c.t, whir(c.dur, 'fast' + i), 0.5, 0.15); break;
    case 'ring': sfx(c.t + 0.1, ok ? chime(mtof(88)) : pop(1000 + (i % 3) * 120), ok ? 0.3 : 0.32, i % 2 ? 0.25 : -0.25); break;
    case 'spot': sfx(c.t, whoosh(0.8, 'spot', 1500, 250), 0.2); break;
    case 'lift': sfx(c.t, pop(880), 0.45); sfx(c.t + 0.05, impact(0.9), 0.35); sfx(c.t + 0.1, sparkle('lift'), 0.3);
      [1.1, 1.28, 1.46, 1.64].forEach((d, k) => sfx(c.t + d, pop(1100 + k * 140), 0.22)); break;
    case 'badge': sfx(c.t, impact(1.1), 0.45); sfx(c.t + 0.02, chime(mtof(91)), 0.35); break;
    case 'burst': sfx(c.t + 0.03, sparkle('burst'), 0.4); break;
    case 'counter': for (let k = 0; k < 8; k++) sfx(c.t + 0.3 + k * 0.06, tick(), 0.3); sfx(c.t + 0.8, chime(mtof(88)), 0.35); break;
    case 'lock': sfx(c.t, pop(600), 0.25); break;
  }
});

// ───────────── música ─────────────
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const chordAt = (t) => CHORDS[Math.floor(t / BAR) % 4];
// intensidad por sección: [pad, pulso, arpegio, bombo, bajo]
function mixAt(t) {
  if (t < INTRO_END) return [seg(t, 0, 1.5), 0, 0.5 * seg(t, 1.2, 2.2), 0, 0];
  if (t < 10) return [0.7, 0.8, 0.7, 0.5, 0.6];
  if (t < REAL - 0.6) return [0.7, 0.8, 0.9, 1, 1];
  if (t < REAL + BAR) return [1, 0, 0.5, 0, 0.4]; // respiro: llega el yapeo
  if (t < OUTRO) return [0.8, 0.9, 1, 1, 1];
  return [1 - seg(t, DUR - 2.5, DUR), 0, 0.5 * (1 - seg(t, OUTRO + 1.5, OUTRO + 3)), 0, 0.7 * (1 - seg(t, OUTRO + 1, OUTRO + 3))];
}
{
  const L = MUS[0], R = MUS[1];
  for (let i = 0; i < N; i++) {
    const t = i / SR, m = mixAt(t)[0]; if (m <= 0) continue;
    const ch = chordAt(t), bt = (t % BAR) / BAR, env = Math.min(1, bt * 6) * (0.85 + 0.15 * Math.cos(bt * PI));
    let l = 0, r = 0;
    for (let n = 0; n < 3; n++) {
      const f = mtof(ch[n]);
      for (let h = 1; h <= 4; h++) { const a = 1 / (h * h); l += Math.sin(TAU * f * h * t * 1.002) * a; r += Math.sin(TAU * f * h * t * 0.998) * a; }
    }
    const lo = Math.sin(TAU * mtof(ch[0] - 12) * t) * 0.6;
    L[i] += (l * 0.035 + lo * 0.04) * m * env; R[i] += (r * 0.035 + lo * 0.04) * m * env;
  }
}
const kick = (() => { const x = buf(0.45); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(TAU * (45 + 110 * Math.exp(-t * 30)) * t) * Math.exp(-t * 7); } return x; })();
const hat = (() => { const x = noise(0.06, 'hat'); biquad(x, 'hp', 7000); for (let i = 0; i < x.length; i++) x[i] *= Math.exp((-i / SR) * 70); return x; })();
const clap = (() => { const x = noise(0.2, 'clap'); biquad(x, 'bp', 1500, 0.9); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.exp(-t * 22) * (t < 0.012 ? 0.6 : 1); } return x; })();
function pluck(f, dur = 0.35) { const x = buf(dur); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * 9); } return x; }
function bassNote(f, dur) { const x = buf(dur); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.tanh(Math.sin(TAU * f * t) * 1.6) * Math.min(1, t * 80) * Math.exp(-t * 2.5); } return biquad(x, 'lp', 400); }
for (let b = 0; b * BEAT < DUR; b++) {
  const t = b * BEAT, mx = mixAt(t + 0.001), ch = chordAt(t);
  if (mx[1] > 0) put(MUS, t, pluck(mtof(ch[0] - 12), 0.3), 0.18 * mx[1]);
  if (mx[3] > 0 && (b % 2 === 0 || mx[3] > 0.8)) put(MUS, t, kick, 0.45 * mx[3]);
  if (mx[3] > 0.8 && b % 4 === 2) put(MUS, t, clap, 0.12 * mx[3], 0.1);
  if (mx[3] > 0.4) put(MUS, t + BEAT / 2, hat, 0.08 * mx[3], 0.3);
  if (mx[4] > 0 && b % 2 === 0) put(MUS, t, bassNote(mtof(ch[0] - 24), BEAT * 1.9), 0.22 * mx[4]);
  if (mx[2] > 0) for (let e = 0; e < 2; e++) {
    const k = b * 2 + e, note = ch[k % 3] + 12 + (k % 6 >= 3 ? 12 : 0);
    put(MUS, t + (e * BEAT) / 2, pluck(mtof(note)), 0.06 * mx[2], k % 2 ? 0.35 : -0.35);
  }
}

// ───────────── mezcla ─────────────
const mix = [new Float32Array(N), new Float32Array(N)];
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) mix[c][i] = Math.tanh((MUS[c][i] * 0.75 + SFX[c][i] * 0.8) * 1.1) / 1.1;
function writeWav(path, b) {
  const data = Buffer.alloc(N * 2 * 3), hdr = Buffer.alloc(44);
  for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) data.writeIntLE(Math.max(-8388607, Math.min(8388607, Math.round(b[c][i] * 8388607))), (i * 2 + c) * 3, 3);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 6, 28); hdr.writeUInt16LE(6, 32); hdr.writeUInt16LE(24, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
}
const pre = join(OUT, 'yape-premix.wav'), out = join(OUT, 'yape-banda.m4a');
writeWav(pre, mix);
const p1 = spawnSync(FFMPEG, ['-hide_banner', '-i', pre, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const js = p1.stderr.slice(p1.stderr.lastIndexOf('{')), m = JSON.parse(js.slice(0, js.indexOf('}') + 1));
const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', pre, '-af', `${ln},afade=t=out:st=${(DUR - 1.2).toFixed(2)}:d=1.2`, '-ar', String(SR), '-c:a', 'aac', '-b:a', '192k', out]);
unlinkSync(pre);
console.log(`listo: ${cues.length} señales · ${DUR.toFixed(1)} s · medido ${m.input_i} LUFS → −16 LUFS · ${out}`);
