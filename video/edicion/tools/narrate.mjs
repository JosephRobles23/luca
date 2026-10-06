// Voz del demo narrado: Sulafat (Gemini-TTS), la misma de luca-pitch-mujer.mp4, línea por línea de narracion-demo.json.
//   node tools/narrate.mjs              # → public/narr/<id>.wav + src/narr-manifest.json (duraciones reales)
//   node tools/narrate.mjs --only b07   # resintetiza una línea
// Token de `gcloud auth print-access-token`; proyecto de cuota GCP_PROJECT (por defecto luca-510610).
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root = join(import.meta.dirname, '..');
const FFMPEG = existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : '/tmp/anim-tools/node_modules/ffmpeg-static/ffmpeg';
const STYLE = 'Eres una fundadora latinoamericana mostrando un demo de su producto. Habla en español latinoamericano neutro, '
  + 'con calidez, seguridad y una sonrisa en la voz; cercana y natural, como si guiaras a una persona por la pantalla. '
  + 'Varía la entonación, usa pausas expresivas y nunca suenes leída ni robótica.';
const project = process.env.GCP_PROJECT || 'luca-510610';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const outDir = join(root, 'public/narr');
const mf = join(root, 'src/narr-manifest.json');
mkdirSync(outDir, {recursive: true});

const {beats} = JSON.parse(readFileSync(join(root, 'narracion-demo.json'), 'utf8'));
const token = process.env.GOOGLE_TTS_TOKEN || spawnSync('gcloud', ['auth', 'print-access-token'], {encoding: 'utf8'}).stdout.trim();
if (!token) { console.error('Sin token: ejecuta `gcloud auth login` o define GOOGLE_TTS_TOKEN'); process.exit(1); }

async function synth(text, prompt) {
  let r, j;
  for (let attempt = 0; ; attempt++) { // reintenta errores transitorios
    r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        input: {text, prompt},
        voice: {languageCode: 'es-US', name: 'Sulafat', modelName: 'gemini-2.5-pro-tts'},
        audioConfig: {audioEncoding: 'LINEAR16', sampleRateHertz: 48000, speakingRate: 1.0},
      }),
    });
    j = await r.json();
    if (r.ok || attempt >= 5 || ![403, 429, 500, 502, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 10000 * (attempt + 1)));
  }
  if (!r.ok) throw new Error(`TTS ${r.status}: ${j.error?.message}`);
  const wav = Buffer.from(j.audioContent, 'base64');
  let o = 12; while (o < wav.length && wav.toString('ascii', o, o + 4) !== 'data') o += 8 + wav.readUInt32LE(o + 4);
  return wav.subarray(o + 8);
}

const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : {};
for (const b of beats) {
  if (only && b.id !== only) continue;
  const pcm = await synth(b.sayG || b.text, [STYLE, b.tone].filter(Boolean).join(' '));
  const f = join(outDir, b.id + '.wav');
  // recorta silencios de los bordes y aplica la misma ecualización suave que el pitch
  const ff = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '48000', '-ac', '1', '-i', '-',
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,'
      + 'highpass=f=70,equalizer=f=180:t=q:w=1.0:g=1.5,equalizer=f=3200:t=q:w=1.2:g=1.5,equalizer=f=6500:t=q:w=1.5:g=-1.5',
    '-c:a', 'pcm_s16le', f], {input: pcm});
  if (ff.status !== 0) throw new Error('ffmpeg: ' + ff.stderr);
  const dur = (readFileSync(f).length - 44) / 2 / 48000;
  manifest[b.id] = +dur.toFixed(3);
  console.log(`${b.id}  ${dur.toFixed(2).padStart(5)} s  ${b.text.slice(0, 70)}`);
}
writeFileSync(mf, JSON.stringify(manifest, null, 1) + '\n');
