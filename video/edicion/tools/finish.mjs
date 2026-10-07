// Audio final: quita graves y ruido de fondo de la voz y normaliza a -16 LUFS (el video se copia sin recodificar).
// node tools/finish.mjs [entrada] [salida]
// --tts: voz sintetizada + música (ya limpias): solo normaliza, sin filtro de ruido
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const ffmpeg = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : '/tmp/anim-tools/node_modules/ffmpeg-static/ffmpeg';
const tts = process.argv.includes('--tts');
const [input = 'out/luca-demo-raw.mp4', output = '../luca-demo.mp4'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
execFileSync(ffmpeg, [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', input,
  '-c:v', 'copy',
  '-af', (tts ? '' : 'highpass=f=80,afftdn=nf=-25,') + 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart', output,
], {stdio: 'inherit'});
console.log(output);
