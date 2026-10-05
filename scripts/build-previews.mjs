// Genera docs/html/preview-*.html a partir de docs/html/src/*.src.html: sustituye los marcadores
// <!-- @incluir _X --> por los parciales reales de gas/shared (igual que htmlConParciales_ en ui-runtime.js)
// y __LOGO__ por el logo de la web. Uso: node scripts/build-previews.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'docs', 'html', 'src');
const logo = fs.readFileSync(path.join(ROOT, 'docs', 'html', 'preview-diseno-moderno.html'), 'utf8').match(/src="(data:image\/png;base64,[^"]+)"/)[1];

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.src.html'))) {
  const html = fs.readFileSync(path.join(SRC, f), 'utf8')
    .replace(/<!--\s*@incluir\s+(_[A-Za-z]+)\s*-->/g, (m, n) => fs.readFileSync(path.join(ROOT, 'gas', 'shared', n + '.html'), 'utf8'))
    .replace(/__LOGO__/g, logo);
  const out = path.join(ROOT, 'docs', 'html', f.replace('.src.html', '.html'));
  fs.writeFileSync(out, html);
  console.log('→', path.relative(ROOT, out));
}
