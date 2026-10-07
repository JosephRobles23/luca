#!/usr/bin/env node
// Renderiza cuadros de film.js a PNG y hojas de contacto por escena.
//
//   node tools/render-frames.mjs 0 12.5 38.5          # cuadros sueltos -> frames/t-012.50.png
//   node tools/render-frames.mjs --sheet              # hoja de contacto por escena (6 miniaturas)
//   node tools/render-frames.mjs --sheet 2 --n 12     # solo la escena 2, 12 miniaturas
//   node tools/render-frames.mjs --grid 30 40 50      # varias marcas en una imagen -> frames/grid.png
//   node tools/render-frames.mjs --range 36 40 0.5    # de 36 a 40 s cada 0.5 s
//   node tools/render-frames.mjs --debug logos        # piezas sueltas (logos | dashboard | sheet)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, createCanvas, initFilm } from './env.mjs';

const Film = initFilm();
const out = join(root, 'frames');
mkdirSync(out, { recursive: true });
const cv = createCanvas(Film.W, Film.H);
const ctx = cv.getContext('2d');
const args = process.argv.slice(2);
const pad = (t) => t.toFixed(2).padStart(6, '0');
function renderAt(t) {
  const t0 = process.hrtime.bigint();
  Film.draw(ctx, t);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
function label(sc, x, y, t, w = 130) {
  sc.fillStyle = 'rgba(0,0,0,.65)'; sc.fillRect(x, y, w, 32);
  sc.fillStyle = '#f08a5d'; sc.font = '22px monospace'; sc.fillText(`t=${t}`, x + 8, y + 23);
}
if (args[0] === '--debug') {
  Film.debugDraw(ctx, args[1] || 'logos');
  const f = join(out, `debug-${args[1] || 'logos'}.png`);
  writeFileSync(f, cv.toBuffer('image/png'));
  console.log(f);
} else if (args[0] === '--grid') {
  const times = args.slice(1).map(Number);
  const cols = times.length > 4 ? 3 : 2, tw = 960, th = 540;
  const sheet = createCanvas(cols * tw, Math.ceil(times.length / cols) * th);
  const sc = sheet.getContext('2d');
  times.forEach((t, k) => { renderAt(t); sc.drawImage(cv, (k % cols) * tw, Math.floor(k / cols) * th, tw, th); label(sc, (k % cols) * tw, Math.floor(k / cols) * th, t); });
  const f = join(out, 'grid.png');
  writeFileSync(f, sheet.toBuffer('image/png'));
  console.log(f);
} else if (args[0] === '--sheet') {
  const only = args[1] && !args[1].startsWith('--') ? Number(args[1]) : null;
  const ni = args.indexOf('--n');
  const n = ni >= 0 ? Number(args[ni + 1]) : 6;
  const cols = n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), tw = 640, th = 360;
  Film.SCENES.forEach((s, i) => {
    if (only != null && only !== i) return;
    const sheet = createCanvas(cols * tw, rows * th);
    const sc = sheet.getContext('2d');
    sc.fillStyle = '#000'; sc.fillRect(0, 0, sheet.width, sheet.height);
    let total = 0;
    for (let k = 0; k < n; k++) {
      const t = s.start + ((k + 0.5) / n) * (s.end - s.start);
      total += renderAt(t);
      sc.drawImage(cv, (k % cols) * tw, Math.floor(k / cols) * th, tw, th);
      label(sc, (k % cols) * tw, Math.floor(k / cols) * th, t.toFixed(1), 110);
    }
    const f = join(out, `sheet-${i}-${s.id}.png`);
    writeFileSync(f, sheet.toBuffer('image/png'));
    console.log(f, `avg ${(total / n).toFixed(1)} ms/frame`);
  });
} else {
  let times = args.map(Number).filter((x) => !Number.isNaN(x));
  if (args[0] === '--range') {
    const [a, b, st] = args.slice(1).map(Number);
    times = []; for (let t = a; t <= b + 1e-9; t += st) times.push(+t.toFixed(3));
  }
  for (const t of times) {
    const ms = renderAt(t);
    const f = join(out, `t-${pad(t)}.png`);
    writeFileSync(f, cv.toBuffer('image/png'));
    console.log(f, `${ms.toFixed(1)} ms`);
  }
}
