// Genera docs/html/preview-*.html a partir de docs/html/src/*.src.html:
//  - <luca-parcial nombre="_X"></luca-parcial> → el parcial gas/shared/_X.html (igual que htmlConParciales_ en ui-runtime.js);
//  - /*@html Pagina*/      → gas/shared/Pagina.html ya compuesta, como literal JS (para montarla en un iframe);
//  - /*@datos dashboard*/  → resumenDashboard REAL (dashboard-runtime.js vía el harness) sobre un ledger sintético.
// Uso: node scripts/build-previews.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHarness, configFor } from '../tests/gas-harness.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.join(ROOT, 'gas', 'shared');
const SRC = path.join(ROOT, 'docs', 'html', 'src');

const leer = (nombre) => fs.readFileSync(path.join(SHARED, nombre + '.html'), 'utf8');
const conParciales = (html) => html.replace(/<luca-parcial\s+nombre="(_[A-Za-z]+)"\s*><\/luca-parcial>/g, (m, n) => leer(n));
// `</` escapado para que el literal no cierre el <script> que lo contiene.
const literal = (html) => JSON.stringify(html).replace(/<\//g, '<\\/');

// Ledger sintético y determinista (6 meses hasta 2026-10-05) para la vista previa del Dashboard.
function datosDashboard() {
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const GASTOS = [
    ['Comidas fuera', ['RAPPI SAC', 'QUOKKA COFFEE SHOP', 'SHIMAYA RAMEN', 'DLC*RAPPI PERU', 'YEN YEN'], 12, 90],
    ['Transporte', ['Metropolitano y Corredores', 'CA012 AVIACION', 'UBER *TRIP', 'CABIFY'], 4, 60],
    ['Supermercado', ['WONG', 'PLAZA VEA', 'TAMBO+'], 25, 180],
    ['Suscripciones', ['DLC*SPOTIFY', 'OPENAI *CHATGPT SUBSCR', 'Google CLOUD', 'APPLE.COM/BILL'], 3, 25, 'USD'],
    ['Servicios', ['LUZ DEL SUR', 'SEDAPAL', 'CLARO PERU'], 40, 140],
    ['Ocio', ['CINEPLANET', 'JOINNUS'], 20, 80],
    ['Salud', ['INKAFARMA', 'CLINICA SAN FELIPE'], 15, 120]
  ];
  const meses = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const filas = [];
  let id = 0;
  const f2 = (n) => String(n).padStart(2, '0');
  meses.forEach((m, mi) => {
    const dias = m === '2026-10' ? 5 : 28;
    filas.push({ tipo: 'income', fecha: m + '-01T09:00:00-05:00', monto: 4200, comercio: 'PLANILLA', categoria: 'Ingreso' });
    for (let k = 0; k < (m === '2026-10' ? 14 : 38 + mi * 2); k++) {
      const g = GASTOS[Math.floor(azar() * GASTOS.length)];
      const monto = Math.round((g[2] + azar() * (g[3] - g[2])) * 100) / 100;
      filas.push({ tipo: 'expense', fecha: m + '-' + f2(1 + Math.floor(azar() * dias)) + 'T' + f2(8 + Math.floor(azar() * 14)) + ':' + f2(Math.floor(azar() * 60)) + ':00-05:00',
        monto, moneda: g[4] || 'PEN', tipo_cambio: g[4] ? 3.4 : '', comercio: g[1][Math.floor(azar() * g[1].length)], categoria: k % 11 === 5 ? '' : g[0], fuente: 'bcp_email' });
    }
    filas.push({ tipo: 'transfer_in', fecha: m + '-0' + (2 + (mi % 3)) + 'T20:10:00-05:00', monto: 35, contraparte: 'Nolberto Roj*', canal: 'yape_p2p', fuente: 'yape_email' });
    filas.push({ tipo: 'internal_transfer', fecha: m + '-03T10:00:00-05:00', monto: 300, categoria: 'Transferencias', fuente: 'bcp_email' });
  });
  const h0 = makeHarness();
  const H = h0.api.LEDGER_HEADERS_.slice();
  const rows = filas.map((o) => H.map((k) => (k === 'id' ? 'demo:' + ++id : o[k] ?? (k === 'moneda' ? 'PEN' : ''))));
  const h = makeHarness({ spreadsheets: { S: { Movimientos: [H, ...rows], Ajustes: [['key', 'value'], ['fx.usd_pen', '3.75']] } } });
  const cfg = configFor(h, 'S');
  const out = {};
  meses.forEach((m) => { out[m] = JSON.parse(JSON.stringify(h.api.resumenDashboard('S', cfg, { mes: m, hoy: '2026-10-05' }))); });
  return out;
}

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.src.html'))) {
  const html = conParciales(fs.readFileSync(path.join(SRC, f), 'utf8'))
    .replace(/\/\*@html ([A-Za-z]+)\*\//g, (m, n) => literal(conParciales(leer(n))))
    .replace('/*@datos dashboard*/', () => JSON.stringify(datosDashboard()).replace(/<\//g, '<\\/'));
  const out = path.join(ROOT, 'docs', 'html', f.replace('.src.html', '.html'));
  fs.writeFileSync(out, html);
  console.log('→', path.relative(ROOT, out));
}
