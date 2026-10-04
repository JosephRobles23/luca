# Plan agente MCP — M5 (services/luca-mcp + gas/shared/mcp-runtime.js)

Rama: `agent/mcp-m5`. Archivos propios: `services/luca-mcp/**`, `gas/shared/mcp-runtime.js`, `tests/mcp-runtime.test.mjs`, y una línea en `tests/gas-harness.mjs` (añadir `mcp-runtime.js` a `RUNTIME_FILES`). No tocar otros runtimes de GAS. No desplegar (no hay `wrangler login`); sí `wrangler deploy --dry-run` y tests.

Leer antes: `CLAUDE.md`, `CONTEXT.md`, ADR-001/003/005/007, `docs/discovery/reuso-cos-agent.md` §1(b)(c)(d), y el código fuente de `/home/user/Projects/CoS-Agent/services/vera-mcp/` y `/home/user/Projects/CoS-Agent/shared/mcp-runtime.js`.

## Entregables
1. **Fork literal** de `vera-mcp` → `services/luca-mcp` (package.json, tsconfig, wrangler.toml con `name = "luca-mcp"`, recursos D1/KV **sin ids** (placeholders y README con los comandos `wrangler d1 create luca-mcp` / `wrangler kv namespace create OAUTH_KV`), `schema.sql`, `src/*`). Quitar todo lo de CoS (tools, textos "Vera").
2. **Sin `/events`** (ADR-003). Endpoints: `/enroll` (challenge HMAC), `/authorize` (GET página + POST canje de código), `/token`, `/register`, `/mcp`, nuevo **`GET /meta`** → `{ lucaLibVersion, minShortcutSchema: '1' }` leyendo de variables de entorno (`LUCA_LIB_VERSION`).
3. `accessTokenTTL` = 24 h en `OAuthProvider` (ADR-007 §3). Documentar en README el disparador de $5.
4. **Tools v0** (zod raw shapes, `registerTool`): `get_summary({month})`, `category_breakdown({month})`, `top_merchants({month, limit})`, `list_transactions({month?, from?, to?, tipo?, categoria?, texto?, limit})`, `budget_status({month})` (devuelve `{available:false}` hasta v1), `add_expense({monto, moneda, fecha, comercio?, contraparte?, categoria?, nota?})` con validación y dedupe por clave difusa. Cada tool → `proxy(env, op, args)` → `callGas(execUrl, secret, op, args)`.
5. **`gas/shared/mcp-runtime.js`**: `mcpAction(e, sheetId, config)` con challenge HMAC y secreto por usuario (`getSecret_('mcpSecret')` de `secrets-runtime.js`, NO Script Properties), switch de ops que llama a `readLedger_`/`appendTransactions_` y a una función de agregación propia `resumenMes_(rows, month, fx)` (misma semántica que `apps/web/src/lib/ledger.ts`: `transfer_in` aparte, `internal_transfer` fuera, USD con tipo de cambio). Funciones para el sidebar en `DISPATCH_`-compatible (exportar un objeto `MCP_DISPATCH_` que el agente integrador fusionará en `DISPATCH_`): `cargarMcp`, `iniciarConexionMcp` (genera secreto, `POST WORKER/enroll {webAppUrl, secret}`, devuelve código), `desconectarMcp`. URL del Worker en `Ajustes.conexiones.workerUrl` con default `https://mcp.lucaa.lat`.
6. **Tests**: Node para `mcp-runtime.js` con el harness (challenge, unauthorized, cada op, add_expense dedupe). Para el Worker: tests unitarios de `tools.ts` (schemas) y `crypto.ts` con `node --test` o vitest si ya está en el fork; no es necesario miniflare.
7. README de `services/luca-mcp`: despliegue paso a paso (crear D1/KV, `wrangler secret`, dominio `mcp.lucaa.lat`), cómo conectar desde Claude y ChatGPT, cómo medir Writes de KV.

## Criterios de aceptación
- `npm test` (raíz) verde con los tests nuevos; `npx tsc --noEmit` en el Worker limpio; `wrangler deploy --dry-run` ok.
- Ningún secreto en el repo; `.dev.vars.example` con las variables.
- Commits pequeños en español con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Informe final: lista de ops GAS ↔ tools, contrato JSON de cada una, pasos de despliegue que requieren al usuario.
