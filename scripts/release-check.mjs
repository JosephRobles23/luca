#!/usr/bin/env node
/**
 * Verifica que la versión de LucaLib sea la misma en los cuatro sitios que la anuncian
 * (ver .claude/skills/deploy-luca/SKILL.md). Sale con código 1 si difieren o falta alguna.
 *   npm run release:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const sources = [
  {
    label: 'gas/shared/settings-runtime.js LUCA_VERSION',
    get: () => read('gas/shared/settings-runtime.js').match(/^var LUCA_VERSION = '(\d+)';/m)?.[1],
  },
  {
    label: 'gas/stub/appsscript.json libraries[LucaLib].version',
    get: () => JSON.parse(read('gas/stub/appsscript.json')).dependencies?.libraries
      ?.find((l) => l.userSymbol === 'LucaLib')?.version,
  },
  {
    label: 'services/luca-mcp/wrangler.toml LUCA_LIB_VERSION',
    get: () => read('services/luca-mcp/wrangler.toml').match(/^LUCA_LIB_VERSION\s*=\s*"(\d+)"/m)?.[1],
  },
  {
    label: 'apps/web/.env.example NEXT_PUBLIC_LUCA_LIB_VERSION',
    get: () => read('apps/web/.env.example').match(/^NEXT_PUBLIC_LUCA_LIB_VERSION=(\d+)\s*$/m)?.[1],
  },
];

let failed = false;
const found = sources.map(({ label, get }) => {
  let value;
  try { value = get(); } catch (e) { value = undefined; }
  if (!value) failed = true;
  console.log(`${value ? 'v' + value : 'FALTA'}\t${label}`);
  return value;
});

const distinct = new Set(found.filter(Boolean));
if (distinct.size > 1) failed = true;

if (failed) {
  console.error('\nrelease:check FALLÓ: las versiones de LucaLib no coinciden (o falta alguna).');
  process.exit(1);
}
console.log(`\nrelease:check OK: LucaLib v${[...distinct][0]} en los 4 sitios.`);
