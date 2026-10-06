#!/usr/bin/env node
// Narración con Google Cloud TTS, ajustada a la ventana de cada línea. Dos versiones de voz:
//   - original: Charon (es-US-Chirp3-HD-Charon), grave y pausada.
//   - VOICE_SET=mujer: Sulafat con Gemini-TTS (gemini-2.5-pro-tts), cálida, dirigida con instrucciones de estilo
//     (STYLE) y un matiz por línea (`tone` en narracion.json).
//
//   node tools/narrate.mjs                         # -> audio/narr/<id>.wav + manifest.json + captions.js
//   VOICE_SET=mujer node tools/narrate.mjs         # -> audio/narr-mujer/… + captions-mujer.js
//   node tools/narrate.mjs --only v2               # resintetiza una línea
//
// narracion.json: { id, start, text, say?, sayG?, tone?, rate? }. `text` = subtítulo; `say` = grafía para Chirp
// (BCP → "be ce pe", Claude → "Clod"); Gemini-TTS entiende las marcas, así que usa `sayG` o, si no hay, `text`.
// La ventana de una línea termina 0.25 s antes de la siguiente o 0.15 s antes del final de su escena. Chirp:
// speakingRate 0.95 → hasta 1.1. Gemini: se reintenta pidiendo un ritmo más ágil y luego con speakingRate.
// Si ni así cabe, el script falla y hay que acortar el texto.
//
// Autenticación: token de `gcloud auth print-access-token` (o GOOGLE_TTS_TOKEN) y proyecto de cuota
// GCP_PROJECT (por defecto luca-510610) con texttospeech.googleapis.com (y aiplatform.googleapis.com para
// Gemini-TTS) habilitadas.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, Film, FFMPEG, FFPROBE, SET, SUFFIX, NARR_DIR } from './env.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const STYLE = 'Eres una fundadora latinoamericana presentando su producto en un keynote. Habla en español latinoamericano neutro, '
  + 'con calidez, seguridad y una sonrisa en la voz; cercana y natural, como si le contaras algo que te emociona a una persona del público. '
  + 'Varía la entonación, usa pausas expresivas y nunca suenes leída ni robótica.';
const VOICES = {
  '': { name: 'es-US-Chirp3-HD-Charon' },
  mujer: { name: 'Sulafat', model: 'gemini-2.5-pro-tts', style: STYLE },
};
const V = { ...(VOICES[SET] || VOICES['']) };
if (arg('--voice', null)) V.name = arg('--voice');
const voice = V.name;
const project = process.env.GCP_PROJECT || 'luca-510610';
const only = arg('--only', null);
const outDir = NARR_DIR;
mkdirSync(outDir, { recursive: true });

const lines = JSON.parse(readFileSync(join(root, 'narracion.json'), 'utf8'));
// el guion vive en narracion.json y su copia en film.js (subtítulos): deben coincidir
const film = Film.NARRATION;
const diff = lines.filter((l, i) => !film[i] || film[i][0] !== l.id || film[i][1] !== l.start || film[i][2] !== l.text);
if (diff.length || film.length !== lines.length) { console.error('narracion.json y film.js (NARRATION) no coinciden: ' + diff.map((l) => l.id).join(', ')); process.exit(1); }

const token = process.env.GOOGLE_TTS_TOKEN || spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).stdout.trim();
if (!token) { console.error('Sin token: ejecuta `gcloud auth login` o define GOOGLE_TTS_TOKEN'); process.exit(1); }
const sceneOf = (t) => Film.SCENES.find((s) => t >= s.start && t < s.end) || Film.SCENES[Film.SCENES.length - 1];

async function synth(text, rate, prompt) {
  const input = V.model ? { text, prompt } : { text };
  const vo = V.model ? { languageCode: 'es-US', name: voice, modelName: V.model } : { languageCode: voice.slice(0, 5), name: voice };
  let r, j;
  for (let attempt = 0; ; attempt++) { // reintenta errores transitorios (propagación de APIs, cuota, 5xx)
    r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, voice: vo, audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 48000, speakingRate: rate } }),
    });
    j = await r.json();
    if (r.ok || attempt >= 5 || ![403, 429, 500, 502, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 10000 * (attempt + 1)));
  }
  if (!r.ok) throw new Error(`TTS ${r.status}: ${j.error?.message}`);
  const wav = Buffer.from(j.audioContent, 'base64');
  // WAV LINEAR16: busca el bloque "data"
  let o = 12; while (o < wav.length && wav.toString('ascii', o, o + 4) !== 'data') o += 8 + wav.readUInt32LE(o + 4);
  const pcm = wav.subarray(o + 8), x = new Float32Array(pcm.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  return x;
}
// recorta silencio inicial/final (−45 dBFS, ventanas de 10 ms) y deja 30 ms de margen
function trim(x, sr) {
  const win = Math.round(sr * 0.01), thr = Math.pow(10, -45 / 20);
  const loud = (i) => { let m = 0; for (let k = i; k < Math.min(x.length, i + win); k++) m = Math.max(m, Math.abs(x[k])); return m > thr; };
  let a = 0; while (a < x.length && !loud(a)) a += win;
  let b = x.length - win; while (b > a && !loud(b)) b -= win;
  a = Math.max(0, a - Math.round(sr * 0.03)); b = Math.min(x.length, b + win + Math.round(sr * 0.03));
  return x.subarray(a, b);
}

const SR = 48000, manifest = [];
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  if (only && L.id !== only) continue;
  const sc = sceneOf(L.start), next = lines[i + 1];
  const limit = Math.min(next ? next.start - 0.25 : Infinity, sc.end - 0.15);
  let rate = L.rate || (V.model ? 1.0 : 0.95), pcm, dur, tries = 0;
  const say = V.model ? L.sayG || L.text : L.say || L.text;
  for (;;) {
    // Gemini: primero pide un ritmo más ágil en la instrucción; después recurre a speakingRate
    const prompt = V.model ? [V.style, L.tone, tries ? 'Ritmo un poco más ágil, sin perder naturalidad.' : ''].filter(Boolean).join(' ') : undefined;
    pcm = trim(await synth(say, rate, prompt), SR);
    dur = pcm.length / SR;
    if (L.start + dur <= limit || rate >= 1.1 - 1e-9 || tries > 4) break;
    tries++;
    if (!V.model || tries > 2) rate = Math.min(1.1, Math.max(rate + 0.025, Math.ceil(((rate * dur) / (limit - L.start)) * 40) / 40));
  }
  const raw = Buffer.alloc(pcm.length * 2);
  for (let k = 0; k < pcm.length; k++) raw.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[k] * 32767))), k * 2);
  const f = join(outDir, L.id + '.wav');
  // ecualización suave de voz grave: limpia graves, un poco de presencia
  const ff = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', '-',
    '-af', 'highpass=f=70,equalizer=f=180:t=q:w=1.0:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,equalizer=f=6500:t=q:w=1.5:g=-1.5',
    '-ar', String(SR), '-ac', '1', '-c:a', 'pcm_s16le', f], { input: raw });
  if (ff.status !== 0) throw new Error('ffmpeg: ' + ff.stderr);
  const probed = Number(spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString());
  const fits = L.start + probed <= limit;
  manifest.push({ id: L.id, start: L.start, text: L.text, file: L.id + '.wav', duration: +probed.toFixed(3), end: +(L.start + probed).toFixed(3), windowEnd: +limit.toFixed(3), scene: sc.id, rate, fits });
  console.log(`${L.id.padEnd(4)} ${L.start.toFixed(2).padStart(7)} → ${(L.start + probed).toFixed(2).padStart(7)}  dur ${probed.toFixed(2).padStart(5)}  ventana ${limit.toFixed(2).padStart(7)}  rate ${rate.toFixed(3)}  ${fits ? 'cabe' : 'NO CABE'}`);
}
const mf = join(outDir, 'manifest.json');
if (only && existsSync(mf)) {
  const old = JSON.parse(readFileSync(mf, 'utf8'));
  old.lines = old.lines.map((l) => manifest.find((m) => m.id === l.id) || l);
  writeFileSync(mf, JSON.stringify(old, null, 1));
} else writeFileSync(mf, JSON.stringify({ voice, model: V.model || null, sampleRate: SR, lines: manifest }, null, 1));
// subtítulos con duraciones reales para la página (index.html carga captions.js si existe)
const all = JSON.parse(readFileSync(mf, 'utf8')).lines;
writeFileSync(join(root, `captions${SUFFIX}.js`), '// Generado por tools/narrate.mjs: fin real de cada línea de narración\nwindow.FILM_CAPTION_TIMES = ' + JSON.stringify(all.map((l) => ({ id: l.id, end: l.end }))) + ';\n');
const bad = manifest.filter((m) => !m.fits);
if (bad.length) { console.error('No caben: ' + bad.map((m) => m.id).join(', ')); process.exit(1); }
