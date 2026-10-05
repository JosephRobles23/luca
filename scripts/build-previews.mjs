// Genera docs/html/preview-*.html a partir de docs/html/src/*.src.html:
//  - <luca-parcial nombre="_X"></luca-parcial> → el parcial gas/shared/_X.html (igual que htmlConParciales_ en ui-runtime.js);
//  - /*@html Pagina*/      → gas/shared/Pagina.html ya compuesta, como literal JS (para montarla en un iframe).
// Uso: node scripts/build-previews.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.join(ROOT, 'gas', 'shared');
const SRC = path.join(ROOT, 'docs', 'html', 'src');

const leer = (nombre) => fs.readFileSync(path.join(SHARED, nombre + '.html'), 'utf8');
const conParciales = (html) => html.replace(/<luca-parcial\s+nombre="(_[A-Za-z]+)"\s*><\/luca-parcial>/g, (m, n) => leer(n));
// `</` escapado para que el literal no cierre el <script> que lo contiene.
const literal = (html) => JSON.stringify(html).replace(/<\//g, '<\\/');

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.src.html'))) {
  const html = conParciales(fs.readFileSync(path.join(SRC, f), 'utf8'))
    .replace(/\/\*@html ([A-Za-z]+)\*\//g, (m, n) => literal(conParciales(leer(n))));
  const out = path.join(ROOT, 'docs', 'html', f.replace('.src.html', '.html'));
  fs.writeFileSync(out, html);
  console.log('→', path.relative(ROOT, out));
}
