#!/usr/bin/env node
// Edición vertical de grabacion/yape-luca.mp4 → yape-luca-edit.mp4 (1080×1920, 30 fps, h264 + música).
// La grabación va dentro de un iPhone dibujado; encima, motion graphics con las piezas de film.js (paleta,
// Geist, logos). Cortes, velocidades, congelados y efectos: tools/yape-timeline.mjs.
//
//   node tools/yape-edit.mjs                   # video completo (+ audio/yape-banda.m4a si existe)
//   node tools/yape-edit.mjs --frames 5 12.3   # cuadros sueltos → frames/yape-XX.XX.png
//   node tools/yape-edit.mjs --sheet 30        # hoja de contacto de N cuadros → frames/yape-sheet.png
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, createCanvas, FFMPEG, initFilm } from './env.mjs';
import { BLUR, SRC_W, SRC_H, FPS, layout } from './yape-timeline.mjs';

const { C, E, T, tw, rr, box, glow, hexA, clamp, seg, lerp, hash, drawLucaMark, drawWordmark, drawYape, drawShortcuts, drawSheetsIcon } = initFilm().art;
const SRC = join(root, 'grabacion', 'yape-luca.mp4');
const OUT = join(root, 'yape-luca-edit.mp4');
const AUDIO = join(root, 'audio', 'yape-banda.m4a');
const W = 1080, H = 1920, K = 2, SW = SRC_W * K, SH = SRC_H * K, FB = SW * SH * 4;
const PS = 1.8, PCX = W / 2, PCY = 1066; // grabación → salida con zoom 1; centro del teléfono
const HOME = { z: 1, f: [SRC_W / 2, SRC_H / 2] };
const COLORS = { primary: C.primary2, success: C.success, yape: C.yape2 };
const { segs, duration } = layout();
const NF = Math.round(duration * FPS);

// ───────────── grabación ─────────────
const srcCv = createCanvas(SW, SH), srcCtx = srcCv.getContext('2d');
const srcImg = srcCtx.createImageData(SW, SH);
const scaleArgs = ['-vf', `scale=${SW}:${SH}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'rgba'];
// Lectura secuencial (render completo): un solo ffmpeg, cuadro a cuadro
class Reader {
  constructor(a, b) {
    this.a = a; this.b = b;
    this.p = spawn(FFMPEG, ['-v', 'error', '-ss', String(a), '-t', String(b - a + 0.2), '-i', SRC, ...scaleArgs, '-']);
    this.chunks = []; this.len = 0; this.idx = -1; this.frame = null; this.done = false; this.waiters = [];
    this.p.stdout.on('data', (c) => { this.chunks.push(c); this.len += c.length; if (this.len > FB * 6) this.p.stdout.pause(); this.wake(); });
    this.p.stdout.on('end', () => { this.done = true; this.wake(); });
  }
  wake() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  async next() {
    while (this.len < FB) { if (this.done) return null; this.p.stdout.resume(); await new Promise((r) => this.waiters.push(r)); }
    const buf = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks);
    const rest = buf.subarray(FB);
    this.chunks = rest.length ? [rest] : []; this.len = rest.length;
    if (this.len < FB * 3) this.p.stdout.resume();
    return (this.frame = buf.subarray(0, FB));
  }
  async get(ts) { const idx = Math.round((ts - this.a) * FPS); while (this.idx < idx) { if (!(await this.next())) break; this.idx++; } return this.frame; }
  close() { this.p.kill(); }
}
// Acceso suelto (vistas previas)
function frameAt(ts) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-ss', String(ts), '-i', SRC, '-frames:v', '1', ...scaleArgs, '-'], { maxBuffer: FB * 2 });
  return r.stdout.length >= FB ? r.stdout : null;
}
// Difuminado de zonas privadas: reduce y vuelve a ampliar dos veces (solo dentro del rectángulo)
const blurTmp = [createCanvas(SW, SH), createCanvas(SW, SH)];
function blurRect([x, y, w, h]) {
  [x, y, w, h] = [x * K, y * K, w * K, h * K];
  const f1 = 10, f2 = 3, a = blurTmp[0].getContext('2d'), b = blurTmp[1].getContext('2d');
  const w1 = Math.ceil(w / f1), h1 = Math.ceil(h / f1), w2 = Math.ceil(w1 / f2), h2 = Math.ceil(h1 / f2);
  for (const c of [a, b]) { c.imageSmoothingEnabled = true; c.clearRect(0, 0, SW, SH); }
  a.drawImage(srcCv, x, y, w, h, 0, 0, w1, h1);
  b.drawImage(blurTmp[0], 0, 0, w1, h1, 0, 0, w2, h2);
  a.clearRect(0, 0, SW, SH); a.drawImage(blurTmp[1], 0, 0, w2, h2, 0, 0, w1, h1);
  srcCtx.save(); rr(srcCtx, x, y, w, h, 14 * K); srcCtx.clip();
  srcCtx.imageSmoothingEnabled = true; srcCtx.drawImage(blurTmp[0], 0, 0, w1, h1, x, y, w, h);
  srcCtx.fillStyle = 'rgba(20,20,24,0.35)'; srcCtx.fillRect(x, y, w, h);
  srcCtx.restore();
}
function loadSource(rgba, ts) {
  srcImg.data.set(rgba); srcCtx.putImageData(srcImg, 0, 0);
  for (const b of BLUR) if (ts >= b.from && ts <= b.to) blurRect(b.rect);
}
function srcTime(t) {
  const s = segAt(t);
  if (s.card) return null;
  if (s.hold != null) return s.hold;
  return Math.min(s.src[1], s.src[0] + (t - s.start) * s.speed);
}
const segAt = (t) => segs.find((s) => t < s.end) || segs[segs.length - 1];
// Tramos continuos de la grabación: un lector por tramo, así no se decodifica lo que se corta
const SPANS = [];
for (const s of segs) {
  if (s.card) continue;
  const [a, b] = s.src || [s.hold, s.hold], last = SPANS[SPANS.length - 1];
  if (last && a - last[1] < 0.5) last[1] = Math.max(last[1], b); else SPANS.push([a, b]);
}

// ───────────── piezas ─────────────
function background(ctx, t) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  glow(ctx, 160 + Math.sin(t * 0.21) * 90, 260 + Math.cos(t * 0.17) * 70, 900, C.primary, 0.22);
  glow(ctx, 940 + Math.cos(t * 0.19) * 80, 1650 + Math.sin(t * 0.23) * 90, 900, C.yape, 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 40; y < H; y += 48) for (let x = 36; x < W; x += 48) ctx.fillRect(x, y, 2, 2);
}
// Cámara: zoom hacia el objetivo del segmento, suavizado al entrar
function camAt(t) {
  const s = segAt(t), prev = segs[s.i - 1], to = s.cam || HOME, from = (prev && !prev.card && prev.cam) || HOME;
  const k = E.inOut(seg(t - s.start, 0, 0.7));
  return { z: lerp(from.z, to.z, k), f: [lerp(from.f[0], to.f[0], k), lerp(from.f[1], to.f[1], k)] };
}
function makeView(cam, extra = {}) {
  const S = PS * cam.z * (extra.s || 1), oy = extra.oy || 0;
  const v = { S, x: (x) => PCX + (x - cam.f[0]) * S, y: (y) => PCY + oy + (y - cam.f[1]) * S };
  v.rect = ([x, y, w, h], pad = 0) => [v.x(x) - pad, v.y(y) - pad, w * S + pad * 2, h * S + pad * 2];
  return v;
}
function drawPhone(ctx, v, a = 1) {
  const [x, y, w, h] = v.rect([0, 0, SRC_W, SRC_H]), bz = 13 * v.S / PS;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 40;
  box(ctx, x - bz, y - bz, w + bz * 2, h + bz * 2, 50 * v.S / PS + bz, '#1b1b1e'); ctx.restore();
  const g = ctx.createLinearGradient(x - bz, y, x + w + bz, y + h);
  g.addColorStop(0, '#5b5b60'); g.addColorStop(0.5, '#2a2a2e'); g.addColorStop(1, '#55555a');
  box(ctx, x - bz, y - bz, w + bz * 2, h + bz * 2, 50 * v.S / PS + bz, null, g, 3);
  ctx.save(); rr(ctx, x, y, w, h, 46 * v.S / PS); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.quality = 'best';
  ctx.drawImage(srcCv, 0, 0, SW, SH, x, y, w, h);
  ctx.restore(); ctx.restore();
}
function pill(ctx, cx, cy, text, o = {}) {
  const size = o.size || 30, padX = size * 0.75, icon = o.icon ? size * 1.15 : 0;
  const w = tw(ctx, text, { size, w: 600 }) + padX * 2 + icon, h = size * 1.9;
  const x = o.align === 'left' ? cx : o.align === 'right' ? cx - w : cx - w / 2, y = cy - h / 2;
  ctx.save();
  ctx.shadowColor = hexA(o.bg || '#000000', o.bg ? 0.55 : 0.5); ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  box(ctx, x, y, w, h, h / 2, o.bg || 'rgba(24,24,26,0.92)'); ctx.restore();
  if (!o.bg) box(ctx, x, y, w, h, h / 2, null, 'rgba(255,255,255,0.14)', 1.5);
  if (o.icon) o.icon(ctx, x + padX + size * 0.4, cy, size * 0.8);
  T(ctx, text, x + padX + icon, cy + 1, { size, w: 600, c: o.fg || C.ink, base: 'middle' });
  return [x, y, w, h];
}
function checkIcon(ctx, x, y, s, col = C.bg) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.32, y + s * 0.02); ctx.lineTo(x - s * 0.08, y + s * 0.26); ctx.lineTo(x + s * 0.36, y - s * 0.24); ctx.stroke(); ctx.restore();
}
function lockIcon(ctx, x, y, s) {
  ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = s * 0.13;
  ctx.beginPath(); ctx.arc(x, y - s * 0.12, s * 0.22, Math.PI, 0); ctx.stroke();
  box(ctx, x - s * 0.34, y - s * 0.12, s * 0.68, s * 0.5, s * 0.1, C.ink); ctx.restore();
}
function ffIcon(ctx, x, y, s) {
  ctx.fillStyle = C.ink;
  for (const dx of [-s * 0.32, s * 0.02]) { ctx.beginPath(); ctx.moveTo(x + dx, y - s * 0.3); ctx.lineTo(x + dx + s * 0.34, y); ctx.lineTo(x + dx, y + s * 0.3); ctx.closePath(); ctx.fill(); }
}
function clockIcon(ctx, x, y, s) {
  ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.24); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.18, y + s * 0.08); ctx.stroke(); ctx.restore();
}

// Anillo que se dibuja alrededor del objetivo, late y lleva una etiqueta
function fxRing(ctx, v, f, k, left) {
  const col = COLORS[f.color || 'primary'], [x, y, w, h] = v.rect(f.rect, 8), r = 18;
  const a = clamp(k / 0.15) * clamp(left / 0.25), draw = E.out(clamp(k / 0.5)), lw = f.width || 5;
  const per = 2 * (w + h);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.shadowColor = col; ctx.shadowBlur = 26;
  ctx.setLineDash([per * draw, per]); ctx.lineDashOffset = 0;
  ctx.strokeStyle = col; ctx.lineWidth = lw * (1 + 0.18 * Math.sin(Math.max(0, k - 0.5) * 6));
  rr(ctx, x, y, w, h, r); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
  const e = clamp((k - 0.45) / 0.6);
  if (e > 0 && e < 1) { const g = 1 + e * 0.08; ctx.globalAlpha *= (1 - e) * 0.7; ctx.lineWidth = 3;
    rr(ctx, x + w / 2 - (w * g) / 2, y + h / 2 - (h * g) / 2, w * g, h * g, r * g); ctx.stroke(); }
  ctx.restore();
  if (!f.label) return;
  const p = E.back(clamp((k - 0.3) / 0.45));
  if (p <= 0) return;
  const up = f.side ? f.side === 'up' : y > 520, cy = up ? y - 44 : y + h + 44;
  ctx.save(); ctx.globalAlpha *= clamp(p) * a;
  ctx.translate(PCX, cy); ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p); ctx.translate(-PCX, -cy);
  const fg = f.color === 'success' ? C.bg : '#ffffff';
  pill(ctx, PCX, cy, f.label, { bg: col, fg, size: 32, icon: f.color === 'success' ? (c, xx, yy, s) => checkIcon(c, xx, yy, s, fg) : null });
  ctx.fillStyle = col; ctx.beginPath();
  const ay = up ? cy + 30 : cy - 30, d = up ? 1 : -1;
  ctx.moveTo(PCX - 14, ay); ctx.lineTo(PCX + 14, ay); ctx.lineTo(PCX, ay + 14 * d); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Oscurece todo menos el objetivo
function fxSpot(ctx, v, f, k, left) {
  const a = 0.72 * E.out(clamp(k / 0.4)) * clamp(left / 0.3), [x, y, w, h] = v.rect(f.rect, 8), ph = v.rect([0, 0, SRC_W, SRC_H]);
  ctx.save(); rr(ctx, ph[0], ph[1], ph[2], ph[3], 46 * v.S / PS); ctx.clip();
  ctx.fillStyle = `rgba(4,4,6,${a.toFixed(3)})`;
  ctx.fillRect(0, 0, W, y); ctx.fillRect(0, y + h, W, H - y - h); ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, W - x - w, h);
  ctx.restore();
}
// Saca una copia de la notificación del teléfono, ampliada, flotando sobre la escena
function fxLift(ctx, v, f, k, left) {
  const p = E.spring(clamp(k / 0.9)), a = clamp(k / 0.12) * clamp(left / 0.3);
  if (a <= 0) return;
  const [sx, sy, sw, sh] = v.rect(f.rect), tw0 = f.rect[2] * f.scale * 1.12, th0 = f.rect[3] * f.scale * 1.12;
  const w = lerp(sw, tw0, p), h = lerp(sh, th0, p), cx = lerp(sx + sw / 2, PCX, p), cy = lerp(sy + sh / 2, f.y, p);
  const bob = Math.sin(Math.max(0, k - 0.9) * 2.4) * 6;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, bob);
  glow(ctx, cx, cy, w * 0.8, C.yape2, 0.55 * clamp(p));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  box(ctx, cx - w / 2, cy - h / 2, w, h, 22 * w / sw, '#26222a'); ctx.restore();
  ctx.save(); rr(ctx, cx - w / 2, cy - h / 2, w, h, 22 * w / sw); ctx.clip();
  const [rx, ry, rw, rh] = f.rect.map((n) => n * K);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(srcCv, rx, ry, rw, rh, cx - w / 2, cy - h / 2, w, h); ctx.restore();
  box(ctx, cx - w / 2, cy - h / 2, w, h, 22 * w / sw, null, hexA(C.yape2, 0.9 * clamp(p)), 4);
  ctx.restore();
  // Flujo: Yape → Atajo → Sheet → lucaa.lat
  const fk = clamp((k - 1.1) / 1.2);
  if (fk <= 0) return;
  const fy = f.y + th0 / 2 + 115, xs = [190, 420, 650, 880];
  ctx.save(); ctx.globalAlpha *= a;
  const pk = E.out(clamp(fk / 0.25));
  ctx.save(); ctx.globalAlpha *= pk; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40;
  box(ctx, 100, fy - 78, 880, 212, 32, 'rgba(16,16,19,0.94)'); ctx.restore();
  ctx.save(); ctx.globalAlpha *= pk; box(ctx, 100, fy - 78, 880, 212, 32, null, 'rgba(255,255,255,0.10)', 1.5); ctx.restore();
  xs.forEach((x, i) => {
    const kk = E.back(clamp((fk - i * 0.18) / 0.35));
    if (kk <= 0) return;
    if (i) {
      const lk = clamp((fk - i * 0.18 + 0.1) / 0.3);
      ctx.strokeStyle = hexA(C.ink, 0.35); ctx.lineWidth = 4; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xs[i - 1] + 62, fy); ctx.lineTo(lerp(xs[i - 1] + 62, x - 62, lk), fy); ctx.stroke(); ctx.setLineDash([]);
      const dk = ((k * 1.1 + i * 0.3) % 1);
      if (fk >= 1) { ctx.fillStyle = C.primary2; ctx.beginPath(); ctx.arc(lerp(xs[i - 1] + 62, x - 62, dk), fy, 7, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.save(); ctx.translate(x, fy); ctx.scale(kk, kk);
    if (i === 0) drawYape(ctx, 0, 0, 96);
    if (i === 1) drawShortcuts(ctx, 0, 0, 96);
    if (i === 2) { box(ctx, -48, -48, 96, 96, 23, '#ffffff'); drawSheetsIcon(ctx, 0, 0, 62); }
    if (i === 3) { box(ctx, -48, -48, 96, 96, 23, '#161616', C.lineStrong, 2); drawLucaMark(ctx, 0, 2, 70, 1, { stagger: false }); }
    ctx.restore();
    T(ctx, ['Push', 'Atajo', 'Tu Sheet', 'lucaa.lat'][i], x, fy + 92, { size: 26, w: 500, c: C.body, align: 'center', a: clamp(kk) });
  });
  ctx.restore();
}
function fxBadge(ctx, f, k, left) {
  const p = E.spring(clamp(k / 0.8)), a = clamp(k / 0.1) * clamp(left / 0.3), col = COLORS[f.color || 'primary'];
  const cy = 1520;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(PCX, cy); ctx.scale(p, p); ctx.translate(-PCX, -cy);
  glow(ctx, PCX, cy, 420, col, 0.35);
  const tw1 = tw(ctx, f.text, { size: 66, w: 600 }), w = tw1 + 190, h = 132, x = PCX - w / 2;
  ctx.save(); ctx.shadowColor = hexA(col, 0.6); ctx.shadowBlur = 50; box(ctx, x, cy - h / 2, w, h, h / 2, col); ctx.restore();
  ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x + 70, cy, 38, 0, Math.PI * 2); ctx.fill();
  checkIcon(ctx, x + 70, cy, 46, col);
  T(ctx, f.text, x + 130, cy + 2, { size: 66, w: 600, c: C.bg, base: 'middle' });
  ctx.restore();
  if (f.sub) T(ctx, f.sub, PCX, cy + 118, { size: 32, w: 500, c: C.ink, align: 'center', a: a * clamp((k - 0.4) / 0.3), mono: true });
}
function fxBurst(ctx, v, f, k) {
  if (k > 1.6) return;
  const x0 = v.x(f.at2[0]), y0 = v.y(f.at2[1]), cols = [C.success, C.primary2, C.ink, C.mint, C.sand];
  for (let i = 0; i < 34; i++) {
    const ang = hash(i, 1) * Math.PI * 2, sp = 340 + hash(i, 2) * 620, life = 0.9 + hash(i, 3) * 0.6, kk = k / life;
    if (kk >= 1) continue;
    const d = sp * E.out(kk), x = x0 + Math.cos(ang) * d, y = y0 + Math.sin(ang) * d + 240 * kk * kk;
    ctx.save(); ctx.globalAlpha = 1 - kk; ctx.fillStyle = cols[i % cols.length];
    ctx.translate(x, y); ctx.rotate(kk * 8 + i); ctx.fillRect(-7, -3.5, 14, 7); ctx.restore();
  }
}
function fxCounter(ctx, v, f, k, left) {
  const [x, y, w, h] = v.rect(f.rect, 8), a = clamp(k / 0.15) * clamp(left / 0.25), cx = x + w + 120, cy = y + h / 2;
  const roll = E.inOut(clamp((k - 0.35) / 0.5));
  ctx.save(); ctx.globalAlpha *= a;
  ctx.save(); ctx.shadowColor = hexA(C.primary2, 0.6); ctx.shadowBlur = 30; box(ctx, cx - 92, cy - 44, 184, 88, 44, C.primary); ctx.restore();
  ctx.save(); rr(ctx, cx - 92, cy - 44, 184, 88, 44); ctx.clip();
  T(ctx, String(f.from), cx, cy + 2 - roll * 80, { size: 52, w: 700, c: '#fff', align: 'center', base: 'middle', mono: true });
  T(ctx, String(f.to), cx, cy + 2 + (1 - roll) * 80, { size: 52, w: 700, c: '#fff', align: 'center', base: 'middle', mono: true });
  ctx.restore();
  const pk = clamp((k - 0.7) / 0.9);
  if (pk > 0 && pk < 1) T(ctx, '+1', cx + 110, cy - 20 - pk * 70, { size: 46, w: 700, c: C.success, a: 1 - pk });
  ctx.restore();
}
function fxLock(ctx, v, f, k, left) {
  const [x, y, w, h] = v.rect(f.rect), a = clamp(k / 0.3) * clamp(left / 0.3);
  ctx.save(); ctx.globalAlpha *= a;
  pill(ctx, x + w / 2, y + h / 2, 'URL y token ocultos', { size: 28, icon: lockIcon });
  ctx.restore();
}

function caption(ctx, t) {
  const s = segAt(t);
  if (!s.cap) return;
  let i = s.i; while (!segs[i].newCap) i--;
  const k = t - segs[i].start, prevCap = segs[i - 1]?.cap;
  const draw = (cap, kk, out) => {
    const e = out ? 1 - E.in(kk) : E.quint(kk), dy = out ? -24 * E.in(kk) : 34 * (1 - e);
    ctx.save(); ctx.globalAlpha *= clamp(e);
    T(ctx, cap[0], PCX, 152 + dy, { size: 26, w: 500, c: C.primary2, align: 'center', mono: true, track: 4 });
    T(ctx, cap[1], PCX, 232 + dy * 1.3, { size: 60, w: 600, c: C.ink, align: 'center' });
    ctx.restore();
  };
  if (prevCap && k < 0.25) draw(prevCap, k / 0.25, true);
  else draw(s.cap, clamp((k - (prevCap ? 0.2 : 0)) / 0.5), false);
}

// ───────────── placas ─────────────
function flowRow(ctx, y, k) {
  const items = [[200, drawYape, 'Yape'], [420, drawShortcuts, 'Atajos'], [640, null, 'Tu Sheet'], [860, 'luca', 'lucaa.lat']];
  items.forEach(([x, fn, label], i) => {
    const kk = E.back(clamp((k - i * 0.15) / 0.4));
    if (kk <= 0) return;
    if (i) {
      const lk = clamp((k - i * 0.15 + 0.08) / 0.3);
      ctx.strokeStyle = hexA(C.ink, 0.3); ctx.lineWidth = 4; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(items[i - 1][0] + 64, y); ctx.lineTo(lerp(items[i - 1][0] + 64, x - 64, lk), y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(kk, kk);
    if (fn === null) { box(ctx, -50, -50, 100, 100, 24, '#ffffff'); drawSheetsIcon(ctx, 0, 0, 64); }
    else if (fn === 'luca') { box(ctx, -50, -50, 100, 100, 24, '#161616', C.lineStrong, 2); drawLucaMark(ctx, 0, 2, 72, 1, { stagger: false }); }
    else fn(ctx, 0, 0, 100);
    ctx.restore();
    T(ctx, label, x, y + 96, { size: 28, w: 500, c: C.body, align: 'center', a: clamp(kk) });
  });
}
function introCard(ctx, k, dur) {
  const out = clamp((k - (dur - 0.45)) / 0.45), a = 1 - E.in(out);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(0, -80 * E.in(out));
  glow(ctx, PCX, 700, 520, C.primary, 0.3 * clamp(k / 0.8));
  drawLucaMark(ctx, PCX, 660, 250, clamp(k / 1.1));
  drawWordmark(ctx, PCX, 930, 92, clamp((k - 0.35) / 0.9));
  const tk = E.quint(clamp((k - 0.9) / 0.6));
  T(ctx, 'Conecta tu iPhone en un minuto', PCX, 1080 + (1 - tk) * 30, { size: 54, w: 600, c: C.ink, align: 'center', a: tk });
  T(ctx, 'y cada yapeo llega solo a tu Sheet', PCX, 1150 + (1 - tk) * 30, { size: 40, w: 400, c: C.body, align: 'center', a: tk });
  flowRow(ctx, 1380, clamp((k - 1.3) / 1.2));
  ctx.restore();
}
function outroCard(ctx, k) {
  const a = E.out(clamp((k - 0.5) / 0.6));
  ctx.fillStyle = `rgba(11,11,11,${(0.88 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  if (a <= 0) return;
  ctx.save();
  glow(ctx, PCX, 760, 560, C.primary, 0.32 * a);
  drawLucaMark(ctx, PCX, 640, 220, clamp((k - 0.6) / 1.0));
  drawWordmark(ctx, PCX, 880, 84, clamp((k - 0.9) / 0.9));
  const lines = [['Configuras el atajo una vez.', 54, 600, C.ink], ['Cada yapeo llega solo a tu Sheet.', 54, 600, C.ink], ['Tus datos, en tu Google · Gratis', 36, 400, C.body]];
  lines.forEach(([s, size, w, c], i) => {
    const kk = E.quint(clamp((k - 1.4 - i * 0.25) / 0.6));
    T(ctx, s, PCX, 1060 + i * 80 + (i === 2 ? 20 : 0) + (1 - kk) * 30, { size, w, c, align: 'center', a: kk });
  });
  const uk = E.back(clamp((k - 2.3) / 0.6));
  if (uk > 0) { ctx.save(); ctx.translate(PCX, 1420); ctx.scale(uk, uk); ctx.translate(-PCX, -1420);
    pill(ctx, PCX, 1420, 'lucaa.lat', { size: 48, bg: C.primary, fg: '#fff' }); ctx.restore(); }
  ctx.restore();
}

// ───────────── cuadro ─────────────
const FX = { ring: fxRing, spot: fxSpot, lift: fxLift, burst: fxBurst, counter: fxCounter, lock: fxLock };
function drawFrame(ctx, t) {
  const s = segAt(t), lt = t - s.start;
  background(ctx, t);
  if (s.card === 'intro') { introCard(ctx, lt, s.dur); return; }
  const first = segs.find((x) => !x.card);
  const inK = E.quint(clamp((t - first.start) / 0.75));
  const outK = s.card === 'outro' ? E.inOut(clamp(lt / 0.9)) : 0;
  const punch = s.flash ? 0.035 * (1 - E.out(clamp(lt / 0.35))) : 0;
  const v = makeView(camAt(t), { oy: (1 - inK) * 1300 + outK * 160, s: (1 + punch) * (1 - outK * 0.12) });
  drawPhone(ctx, v, 1 - outK * 0.5);
  if (s.card === 'outro') { outroCard(ctx, lt); return; }
  // efectos dentro del teléfono primero (foco), luego los que flotan encima
  const order = ['spot', 'ring', 'lock', 'counter', 'burst', 'lift', 'badge'];
  const active = (s.fx || []).filter((f) => lt >= f.at && (f.until == null || lt < f.until)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const f of active) {
    const left = Math.min(s.end - t, f.until != null ? s.start + f.until - t : Infinity);
    if (f.type === 'badge') fxBadge(ctx, f, lt - f.at, left);
    else FX[f.type](ctx, v, f, lt - f.at, left);
  }
  if (s.speed >= 2) {
    const a = clamp(lt / 0.15) * clamp((s.end - t) / 0.15);
    ctx.save(); ctx.globalAlpha *= a;
    pill(ctx, v.x(SRC_W) - 26, v.y(SRC_H * 0.09), `×${s.speed}`, { size: 34, align: 'right', icon: ffIcon });
    ctx.restore();
  }
  if (s.note) {
    const a = clamp(lt / 0.2) * clamp((1.8 - lt) / 0.3);
    if (a > 0) { ctx.save(); ctx.globalAlpha *= a; pill(ctx, PCX, v.y(SRC_H * 0.5), s.note, { size: 40, icon: clockIcon }); ctx.restore(); }
  }
  if (s.flash && lt < 0.25) { ctx.fillStyle = `rgba(255,255,255,${(0.28 * (1 - lt / 0.25)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  // velo superior para que el título se lea cuando el teléfono crece hacia arriba
  const top = v.y(0) - 13 * v.S / PS;
  if (top < 330) {
    const g = ctx.createLinearGradient(0, 0, 0, 330), a = clamp((330 - top) / 120);
    g.addColorStop(0, hexA(C.bg, 0.96 * a)); g.addColorStop(0.72, hexA(C.bg, 0.85 * a)); g.addColorStop(1, hexA(C.bg, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
  }
  caption(ctx, t);
  T(ctx, 'lucaa.lat', PCX, 1878, { size: 24, w: 500, c: C.muted, align: 'center', mono: true, a: inK });
}

// ───────────── salida ─────────────
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
const args = process.argv.slice(2);
mkdirSync(join(root, 'frames'), { recursive: true });
function renderAt(t) {
  const ts = srcTime(t);
  if (ts != null) { const f = frameAt(ts); if (f) loadSource(f, ts); }
  else if (segAt(t).card === 'outro') { const lastSrc = [...segs].reverse().find((x) => !x.card); const ts2 = lastSrc.hold ?? lastSrc.src[1]; loadSource(frameAt(ts2), ts2); }
  ctx.save(); drawFrame(ctx, t); ctx.restore();
}
if (args[0] === '--frames') {
  for (const a of args.slice(1)) { renderAt(+a); const p = join(root, 'frames', `yape-${(+a).toFixed(2)}.png`); writeFileSync(p, cv.toBuffer('image/png')); console.log(p); }
} else if (args[0] === '--sheet') {
  const n = +args[1] || 30, cols = 10, tw0 = 216, th0 = 384, sheet = createCanvas(cols * tw0, Math.ceil(n / cols) * (th0 + 30)), sc = sheet.getContext('2d');
  sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height);
  const ts = args[2] ? args.slice(2).map(Number) : Array.from({ length: n }, (_, i) => (i + 0.5) * duration / n);
  ts.forEach((t, i) => {
    renderAt(t); const x = (i % cols) * tw0, y = Math.floor(i / cols) * (th0 + 30);
    sc.drawImage(cv, x, y, tw0, th0); sc.fillStyle = '#fff'; sc.font = '20px sans-serif'; sc.fillText(t.toFixed(1) + 's', x + 6, y + th0 + 22);
  });
  const p = join(root, 'frames', 'yape-sheet.png'); writeFileSync(p, sheet.toBuffer('image/png')); console.log(p);
} else {
  const hasAudio = existsSync(AUDIO);
  const enc = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    ...(hasAudio ? ['-i', AUDIO] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  let reader = null, loaded = null;
  const t0 = Date.now();
  for (let i = 0; i < NF; i++) {
    const t = i / FPS, ts = srcTime(t);
    if (ts != null && ts !== loaded) {
      if (!reader || ts > reader.b + 1e-6) { reader?.close(); const sp = SPANS.find(([a, b]) => ts >= a - 1e-6 && ts <= b + 1e-6); reader = new Reader(sp[0], sp[1]); }
      const f = await reader.get(ts); if (f) loadSource(f, ts); loaded = ts;
    }
    ctx.save(); drawFrame(ctx, t); ctx.restore();
    if (!enc.stdin.write(cv.toBuffer('raw'))) await new Promise((r) => enc.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`\r${i}/${NF} cuadros · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  reader?.close(); enc.stdin.end();
  await new Promise((r) => enc.on('close', r));
  console.log(`\nlisto: ${OUT} · ${duration.toFixed(1)} s${hasAudio ? ' · con música' : ' · sin audio (node tools/yape-audio.mjs)'}`);
}
