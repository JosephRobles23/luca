// Renderiza fotogramas sueltos para revisar encuadres: node tools/stills.mjs 44.0 160 ...  (sin args: punto medio de cada resaltado)
// --narrado: usa LucaNarrado; los tiempos sueltos son de salida, y sin args se convierten los resaltados a su tiempo.
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

import {buildTimeline, toOut} from '../src/timeline-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const narrado = process.argv.includes('--narrado');
let times = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number);
if (!times.length) {
  const src = fs.readFileSync(path.join(root, 'src/cues.ts'), 'utf8');
  const tl = narrado && buildTimeline(JSON.parse(fs.readFileSync(path.join(root, 'narracion-demo.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(root, 'src/narr-manifest.json'), 'utf8')));
  const map = (s) => (tl ? toOut(tl, s) : s);
  times = [...src.matchAll(/from: ([\d.]+), to: ([\d.]+), rect/g)].map((m) => +((map(+m[1]) + map(+m[2])) / 2).toFixed(1));
}
fs.mkdirSync(path.join(root, narrado ? 'out/stills-narrado' : 'out/stills'), {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const composition = await selectComposition({serveUrl, id: narrado ? 'LucaNarrado' : 'LucaDemo'});
for (const t of times) {
  const output = path.join(root, `out/stills${narrado ? '-narrado' : ''}/t${String(t.toFixed(1)).padStart(5, '0')}.jpg`);
  await renderStill({serveUrl, composition, frame: Math.round(t * composition.fps), output, imageFormat: 'jpeg', jpegQuality: 70, scale: 0.5});
  console.log(output);
}
