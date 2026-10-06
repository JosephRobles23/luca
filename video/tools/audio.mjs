#!/usr/bin/env node
// Banda sonora procedural: música electrónica mínima + efectos de UI sintetizados (sin muestras), narración
// (audio/narr, de tools/narrate.mjs), ducking bajo la voz, limitador y loudnorm (ffmpeg, 2 pasadas, −16 LUFS).
//
//   node tools/audio.mjs                  # -> audio/{music,sfx,narration,mix}.wav, audio/banda-sonora.m4a, audio/cues.json
//   VOICE_SET=mujer node tools/audio.mjs  # misma música y efectos con audio/narr-mujer → audio/banda-sonora-mujer.m4a
//
// Determinista: toda aleatoriedad sale de mulberry32 sembrado por nombre. Los golpes salen de Film.TIMING.
// Música: 96 BPM (compás de 2.5 s desde t=0), La menor, Am–F–C–G. Silencio antes de "Nada." (escena 6).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, Film, FFMPEG, SUFFIX, NARR_DIR, SOUNDTRACK } from './env.mjs';

const OUT = join(root, 'audio');
mkdirSync(OUT, { recursive: true });
const SR = 48000, DUR = Film.DURATION, N = Math.round(DUR * SR), TM = Film.TIMING;
const S = Object.fromEntries(Film.SCENES.map((s) => [s.id, s.start]));
const PI = Math.PI, TAU = 2 * PI;
const BAR = 2.5, BEAT = BAR / 4;

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const rng = (n) => mulberry32(seedOf(n));
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const db = (d) => Math.pow(10, d / 20);
const bus = () => [new Float32Array(N), new Float32Array(N)];
const MUS = bus(), SFX = bus(), NAR = bus();
const CUES = [];
const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
function put(b, t0, sig, gain = 1, pan = 0) {
  const i0 = Math.round(t0 * SR), a = ((clamp(pan, -1, 1) + 1) * PI) / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
  for (let k = 0; k < sig.length; k++) { const i = i0 + k; if (i < 0 || i >= N) continue; b[0][i] += sig[k] * gl; b[1][i] += sig[k] * gr; }
}
const sfx = (t, name, sig, gain, pan = 0) => { CUES.push({ t: +t.toFixed(3), name }); put(SFX, t, sig, gain, pan); };
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

// ───────────── efectos ─────────────
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
function riser(sec) { const x = noise(sec, 'riser'), y = buf(sec); biquad(x, 'hp', 800); for (let i = 0; i < y.length; i++) { const k = i / y.length, t = i / SR; y[i] = x[i] * k * k * 0.5 + Math.sin(TAU * (200 + 600 * k * k) * t) * k * 0.12; } return y; }

// ───────────── cues desde Film.TIMING ─────────────
sfx(TM.lineIn, 'línea', whoosh(1.4, 'line', 300, 2500), 0.35);
sfx(TM.logo, 'logo', impact(1.4), 0.55); sfx(TM.logo + 0.05, 'brillo', sparkle('logo'), 0.25);
TM.notifs.forEach((t, i) => sfx(t, 'notif', pop(820 + (i % 3) * 110), 0.22 + 0.006 * i, (i % 2 ? 0.15 : -0.15)));
TM.floats.forEach((t, i) => sfx(t, 'notif-flot', pop(1300 + (i % 4) * 90), 0.1, i % 2 ? 0.6 : -0.6));
sfx(TM.freeze, 'congela', whoosh(0.9, 'freeze', 3000, 200), 0.35);
sfx(TM.counter, 'contador', impact(0.8), 0.35);
for (let i = 0; i < 14; i++) sfx(TM.counter + i * 0.08 * (1 + i * 0.05), 'conteo', tick(), 0.25);
sfx(TM.zeroReg, 'cero', impact(1.2), 0.5);
sfx(TM.heroNotif, 'notif-yape', pop(880), 0.45);
sfx(TM.shortcut, 'atajo', chime(mtof(81)), 0.35);
sfx(TM.morph, 'morph', whoosh(0.8, 'morph', 600, 4000), 0.3);
sfx(TM.serverStrike, 'tachado', swish(), 0.4); sfx(TM.serverStrike + 0.05, 'tachado-golpe', impact(0.5), 0.3);
sfx(TM.travel, 'viaje', whoosh(3.6, 'travel', 250, 2200), 0.35, -0.3);
TM.stages.forEach((t, i) => sfx(t, 'etapa', chime(mtof(i < 3 ? 76 + i * 2 : 83 + (i - 3) * 2)), 0.25, 0.1));
TM.chips.forEach((t) => sfx(t, 'chip', pop(1200), 0.3));
sfx(TM.gmail, 'correo', pop(700), 0.4, -0.4);
sfx(TM.travel2, 'viaje2', whoosh(1.8, 'travel2', 300, 2600), 0.3, -0.2);
TM.rows.forEach((t) => { sfx(t, 'fila', tick(), 0.5, 0.5); sfx(t + 0.1, 'fila-ok', chime(mtof(88)), 0.22, 0.5); });
TM.strikes3.forEach((t) => { sfx(t, 'tachado3', swish(), 0.45); sfx(t + 0.05, 'golpe3', impact(0.6), 0.35); });
TM.bursts3.forEach((t, i) => sfx(t, 'particulas', sparkle('burst' + i), 0.35));
TM.absorb3.forEach((t) => sfx(t - 0.2, 'absorbe', whoosh(0.6, 'abs', 3000, 400), 0.25));
TM.rows3.forEach((t, i) => sfx(t, 'afirma', impact(0.5), 0.22 + i * 0.05));
sfx(TM.branch3, 'ramas', whoosh(1.8, 'branch', 200, 3000), 0.3, 0.4);
TM.rise4.forEach((t, i) => sfx(t, 'rise', tick(), 0.35, -0.2 + i * 0.07));
TM.focus4.forEach((t) => sfx(t, 'zoom', whoosh(0.9, 'zoom' + t, 300, 1800), 0.18));
sfx(TM.click4, 'clic', tick(), 0.8); sfx(TM.click4 + 0.2, 'guardado', chime(mtof(88)), 0.35);
sfx(TM.glass4, 'vidrio', riser(1.6), 0.35); sfx(TM.glass4 + 1.6, 'vidrio-golpe', impact(1.2), 0.45);
TM.typing5.forEach(([a, b, n]) => { for (let i = 0; i < n; i++) sfx(a + ((b - a) * i) / n, 'tecla', tick(), 0.18, 0.05); });
TM.send5.forEach((t) => sfx(t, 'enviar', whoosh(0.4, 'send' + t, 800, 3000), 0.3));
TM.go5.forEach((t) => sfx(t, 'mcp-ida', whoosh(2.4, 'go' + t, 300, 2000), 0.28, -0.4));
TM.back5.forEach((t) => sfx(t, 'mcp-vuelta', whoosh(1.6, 'back' + t, 2000, 400), 0.25, 0.4));
TM.done5.forEach((t) => sfx(t, 'mcp-ok', chime(mtof(86)), 0.3));
sfx(TM.switch5, 'cambio', swish(), 0.3);
sfx(TM.row5, 'fila-ia', chime(mtof(88)), 0.3, 0.5);
TM.strikes6.forEach((t) => { sfx(t, 'tachado6', swish(), 0.5); sfx(t + 0.04, 'golpe6', impact(0.5), 0.35); });
TM.prices6.forEach((t) => sfx(t, 'precio', tick(), 0.4));
sfx(TM.zero6, 'cero-golpe', impact(2.2), 0.8); sfx(TM.zero6 + 0.05, 'cero-brillo', sparkle('zero'), 0.3);
TM.cols6.forEach((t, i) => sfx(t, 'columna', chime(mtof(81 + i * 3)), 0.25));
sfx(TM.logo7, 'logo-final', impact(1.8), 0.5); sfx(TM.logo7 + 0.1, 'brillo-final', sparkle('end'), 0.3);

// ───────────── música ─────────────
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const chordAt = (t) => CHORDS[Math.floor(t / BAR) % 4];
// intensidad por sección: [pad, pulso, arpegio, bombo, bajo]
function mixAt(t) {
  if (t < S.problema) return [seg(t, 0, 3), 0, 0, 0, 0];
  if (t < S.viaje) { const f = 1 - seg(t, TM.freeze - 0.2, TM.freeze + 0.6); return [0.8, seg(t, S.problema, S.problema + 6) * f, 0, 0, 0.5 * f]; }
  if (t < S.hoja) return [0.7, 0.6, 0.8, 0.6, 0.7];
  if (t < 52.5) return [1, 0, 0, 0, 0];
  if (t < S.ia) return [0.7, 0.8, 0.9, 1, 1];
  if (t < S.gratis) return [0.8, 0.8, 1, 1, 1];
  if (t < TM.zero6 - 0.55) return [0.9 * (1 - seg(t, TM.zero6 - 1.4, TM.zero6 - 0.55)), 0, 0, 0, 0];
  if (t < TM.zero6) return [0, 0, 0, 0, 0];
  if (t < S.cierre) return [0.9, 0.4 * seg(t, 127.5, 128), 0.6 * seg(t, 127.5, 128), 0.5 * seg(t, 127.5, 128), 0.8];
  return [1 - seg(t, DUR - 4, DUR - 0.5), 0, 0.4 * (1 - seg(t, 137.5, 140)), 0, 0.6 * (1 - seg(t, 138, 141))];
}
// pad: sierras suaves (aditivas) desafinadas, por bloques de compás
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
// pulso, arpegio, bombo, bajo por eventos
const kick = (() => { const x = buf(0.45); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.sin(TAU * (45 + 110 * Math.exp(-t * 30)) * t) * Math.exp(-t * 7); } return x; })();
const hat = (() => { const x = noise(0.06, 'hat'); biquad(x, 'hp', 7000); for (let i = 0; i < x.length; i++) x[i] *= Math.exp((-i / SR) * 70); return x; })();
function pluck(f, dur = 0.35) { const x = buf(dur); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * Math.exp(-t * 9); } return x; }
function bassNote(f, dur) { const x = buf(dur); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = Math.tanh(Math.sin(TAU * f * t) * 1.6) * Math.min(1, t * 80) * Math.exp(-t * 2.5); } return biquad(x, 'lp', 400); }
for (let b = 0; b * BEAT < DUR; b++) {
  const t = b * BEAT, mx = mixAt(t + 0.001), ch = chordAt(t);
  if (mx[1] > 0) put(MUS, t, pluck(mtof(ch[0] - 12), 0.3), 0.18 * mx[1]);
  if (mx[3] > 0 && (b % 2 === 0 || mx[3] > 0.8)) put(MUS, t, kick, 0.45 * mx[3]);
  if (mx[3] > 0.5) put(MUS, t + BEAT / 2, hat, 0.08 * mx[3], 0.3);
  if (mx[4] > 0 && b % 2 === 0) put(MUS, t, bassNote(mtof(ch[0] - 24), BEAT * 1.9), 0.22 * mx[4]);
  if (mx[2] > 0) for (let e = 0; e < 2; e++) {
    const k = b * 2 + e, note = ch[(k % 3)] + 12 + (k % 6 >= 3 ? 12 : 0);
    put(MUS, t + e * BEAT / 2, pluck(mtof(note)), 0.06 * mx[2], (k % 2 ? 0.35 : -0.35));
  }
}

// ───────────── narración ─────────────
const mf = join(NARR_DIR, 'manifest.json');
if (!existsSync(mf)) { console.error('Falta audio/narr: ejecuta primero node tools/narrate.mjs'); process.exit(1); }
for (const l of JSON.parse(readFileSync(mf, 'utf8')).lines) {
  const wav = readFileSync(join(NARR_DIR, l.file));
  let o = 12; while (wav.toString('ascii', o, o + 4) !== 'data') o += 8 + wav.readUInt32LE(o + 4);
  const pcm = wav.subarray(o + 8), x = new Float32Array(pcm.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  put(NAR, l.start, x, 1.0);
}
// ducking: envolvente de la voz suavizada (ataque 40 ms, relajación 400 ms) → música −9 dB, efectos −4 dB
const env = new Float32Array(N);
{ let e = 0; const at = Math.exp(-1 / (0.04 * SR)), rl = Math.exp(-1 / (0.4 * SR));
  for (let i = 0; i < N; i++) { const v = Math.min(1, Math.abs(NAR[0][i]) * 6); e = v > e ? at * e + (1 - at) * v : rl * e + (1 - rl) * v; env[i] = Math.min(1, e * 2.2); } }
const mix = bus();
for (let i = 0; i < N; i++) {
  const gm = 1 - (1 - db(-9)) * env[i], gs = 1 - (1 - db(-4)) * env[i];
  for (let c = 0; c < 2; c++) mix[c][i] = Math.tanh((MUS[c][i] * gm * 0.57 + SFX[c][i] * gs * 0.8 + NAR[c][i] * 0.85) * 1.1) / 1.1;
}
function writeWav(path, b) {
  const data = Buffer.alloc(N * 2 * 3), hdr = Buffer.alloc(44);
  for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) data.writeIntLE(Math.max(-8388607, Math.min(8388607, Math.round(b[c][i] * 8388607))), (i * 2 + c) * 3, 3);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 6, 28); hdr.writeUInt16LE(6, 32); hdr.writeUInt16LE(24, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
}
writeWav(join(OUT, 'music.wav'), MUS); writeWav(join(OUT, 'sfx.wav'), SFX); writeWav(join(OUT, `narration${SUFFIX}.wav`), NAR);
const pre = join(OUT, `premix${SUFFIX}.wav`), mixWav = join(OUT, `mix${SUFFIX}.wav`); writeWav(pre, mix);
// loudnorm en dos pasadas → −16 LUFS, pico real ≤ −1.5 dBTP
const p1 = spawnSync(FFMPEG, ['-hide_banner', '-i', pre, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
const js = p1.stderr.slice(p1.stderr.lastIndexOf('{')), m = JSON.parse(js.slice(0, js.indexOf('}') + 1));
const ln = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', pre, '-af', ln, '-ar', String(SR), '-c:a', 'pcm_s24le', mixWav]);
spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', mixWav, '-c:a', 'aac', '-b:a', '192k', SOUNDTRACK]);
writeFileSync(join(OUT, 'cues.json'), JSON.stringify(CUES.sort((a, b) => a.t - b.t), null, 1));
writeFileSync(join(OUT, `mix-info${SUFFIX}.json`), JSON.stringify(m, null, 1));
console.log(`listo: ${CUES.length} efectos · medido ${m.input_i} LUFS → −16 LUFS · ${SOUNDTRACK}`);
