#!/usr/bin/env node
// Exporta el pitch a MP4 (1920×1080, 30 fps, h264 yuv420p crf 18) con node-canvas + ffmpeg, en paralelo
// (worker_threads) enviando cuadros BGRA en orden. Si existe audio/banda-sonora.m4a, la incluye.
//
//   node tools/export-mp4.mjs                              # -> luca-pitch.mp4
//   VOICE_SET=mujer node tools/export-mp4.mjs              # -> luca-pitch-mujer.mp4 (banda-sonora-mujer.m4a)
//   node tools/export-mp4.mjs --from 22 --to 50 --out prueba.mp4 --workers 4
//   node tools/export-mp4.mjs --no-captions --out luca-pitch-sin-subtitulos.mp4
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, createCanvas, initFilm, FFMPEG, SUFFIX, SOUNDTRACK } from './env.mjs';

if (!isMainThread) {
  const Film = initFilm();
  Film.setCaptions(workerData.captions);
  const cv = createCanvas(Film.W, Film.H), ctx = cv.getContext('2d');
  parentPort.on('message', (i) => {
    if (i < 0) process.exit(0);
    Film.draw(ctx, i / Film.FPS);
    const buf = cv.toBuffer('raw'); // BGRA (cairo ARGB32 little-endian)
    parentPort.postMessage({ i, buf }, [buf.buffer]);
  });
} else {
  const Film = initFilm();
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const from = Number(arg('--from', 0)), to = Number(arg('--to', Film.DURATION));
  const out = arg('--out', join(root, `luca-pitch${SUFFIX}.mp4`));
  const captions = !process.argv.includes('--no-captions');
  const nW = Number(arg('--workers', Math.max(1, Math.min(8, availableParallelism() - 1))));
  const f0 = Math.round(from * Film.FPS), f1 = Math.round(to * Film.FPS), total = f1 - f0;
  const audio = SOUNDTRACK;
  const withAudio = existsSync(audio) && !process.argv.includes('--no-audio');
  const ffArgs = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${Film.W}x${Film.H}`, '-r', String(Film.FPS), '-i', '-'];
  if (withAudio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'copy', '-shortest');
  ffArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
  const ff = spawn(FFMPEG, ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const pending = new Map();
  let next = f0, queued = f0, written = 0;
  const t0 = Date.now();
  const workers = Array.from({ length: nW }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { captions } }));
  const feed = (w) => { if (queued < f1) w.postMessage(queued++); };
  const flush = async () => {
    while (pending.has(next)) {
      const buf = pending.get(next); pending.delete(next); next++; written++;
      if (!ff.stdin.write(Buffer.from(buf))) await new Promise((r) => ff.stdin.once('drain', r));
      if (written % 150 === 0 || written === total) {
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(`\r${written}/${total} cuadros · ${(written / el).toFixed(1)} fps · ETA ${Math.round(((total - written) * el) / written)} s   `);
      }
    }
    if (written === total) { workers.forEach((w) => w.postMessage(-1)); ff.stdin.end(); }
  };
  let flushing = Promise.resolve();
  workers.forEach((w) => {
    w.on('message', ({ i, buf }) => { pending.set(i, buf); flushing = flushing.then(flush); feed(w); });
    w.on('error', (e) => { console.error(e); process.exit(1); });
    feed(w); feed(w);
  });
  ff.on('close', (code) => { console.log(`\nffmpeg terminó (${code}) → ${out}${withAudio ? ' (con banda sonora)' : ''}`); process.exit(code); });
}
