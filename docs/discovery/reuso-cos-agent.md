# Inventario de reuso: CoS-Agent → Luca

Fecha: 2026-10-04. Base analizada: `/home/user/Projects/CoS-Agent` (CoSLib v56, Worker `services/vera-mcp`).
Referencias `archivo:línea` apuntan al repo de CoS-Agent.

## Resumen

| Verdicto | Módulos |
|---|---|
| **COPIAR tal cual** | `ui-runtime.js` (dispatch + whitelist + registro de diálogos), `sheets-runtime.js`, `brain-drive-runtime.js`, `DialogMcp.html`, stub (`stub.js:1-56`, `config.js`, `triggers.js`, `appsscript.json` del stub), todo `services/vera-mcp/src/{index,auth,storage,crypto,gasClient}.ts`, `wrangler.toml`/`schema.sql`/`package.json`, `tests/gas-harness.mjs` (estructura), skill `deploy-cos` |
| **ADAPTAR** | `mcp-runtime.js` (router + secreto + HMAC sí; switch de ops no), `webapp-runtime.js` (solo router `:31-40`, `:201-204`), `settings-runtime.js` (primitivas KV `:153-215` + `construirConfig`), `gemini-runtime.js` → adapter multi-proveedor, `dispatcher-runtime.js` (solo caché `:315-345`), `brain-ingest-runtime.js` (pipeline raw→wiki→log→index), `brain-embeddings-runtime.js` (toda la matemática; inyectar `embedBatch_`), `brain-backfill-runtime.js` (job reanudable con cursor → importación de correos), `brain-admin-runtime.js:19-100`, `tools.ts` (`resolveTenant` + `proxy`) |
| **NO** | follow-up de `webapp-runtime`, `Sidebar.html` (salvo `runB`), forms, calendar, telegram, meet-notes, deepprep, briefing, consolidación, `diag-correos.js` |

## Tabla por archivo

| path | funciones clave | verdicto | acoplamiento CoS a quitar | notas Luca |
|---|---|---|---|---|
| `shared/mcp-runtime.js` | `mcpAction` (router doPost `?mcp=1`, :44), `ensureMcpSecret_` (:26), `mcpSearchWiki_`+`wikiRankCmp_` (:139,:153), `cargarMcp`/`iniciarConexionMcp`/`desconectarMcp` (:417-458), `mcpJson_`/`mcpError_` | ADAPTAR | switch de ops de tareas/calendar/reportes (:69-97); `telegramWebAppStatus_` reutilizado para validar /exec; secreto en Script Properties de la librería `mcp:<sheetId>:secret` (:22); `MCP_WORKER_URL` global | Copiar :20-66 y :410-458; reemplazar el switch por ops Luca. Secreto en `UserProperties` del usuario. |
| `shared/webapp-runtime.js` | `webAction` (:201) con desvío MCP en :204, `urlWebApp_` (:31), tokens de un solo uso en `_Tokens` (:41-95), `LockService` anti-doble-POST (:228-243) | ADAPTAR (solo :31-40 y :201-204) | todo el flujo de follow-up | Patrón "GET nunca muta / POST con lock" + router por `e.parameter`. |
| `shared/ui-runtime.js` | `construirMenu` (:36), `buildSidebar` (:50), `DIALOGOS_` (:57), `buildDialog` (:172), `MENU_ACTIONS_`/`menuAction` (:186,:221), `DISPATCH_`/`dispatch` (:237,:315) | COPIAR (estructura) | nombres de diálogos/menú, ~60 entradas del whitelist | Núcleo del patrón Library+stub. `DIALOGOS_ = { dashboard, importar, categorias, mcp, config }`. |
| `shared/settings-runtime.js` | `ensureKeyValueTab_`/`readKeyValueTab_`/`setKeyValueTab_` (:153-194), `getAjustes_` (:242) + `AJUSTES_DEFAULTS_` (:13), `setAjustes_` (:341), `construirConfig` (:358), `cargarConfig` (:382) | ADAPTAR | `AJUSTES_DEFAULTS_` entero, objeto tipado CoS de `getAjustes_` | Copiar :153-215 (KV + `str_`/`bool_`/`int_`/`parseJsonArray_`). Defaults Luca: `llm.provider`, `llm.model`, `gmail.senders`, `import.since`, `moneda`, `brain.folderId`. |
| `shared/gemini-runtime.js` | `getGeminiKey_` (:16), `callGemini_` (:34, retry 429/5xx, `responseSchema`), `callGeminiEmbedBatch_` (:107), `extractGeminiText_` (:181) | ADAPTAR → envolver | key compartida en Script Properties de la librería; endpoint único | Adapter `callLLM_(cfg, system, user, opts)` con providers gemini/openai/anthropic; key desde `cfg.llm.apiKey` (per-user). Conservar retry, schema JSON, "200 sin texto" = fallo. |
| `shared/dispatcher-runtime.js` | `runDispatcher` (:22), guardas `yaEnviado_`/`marcarEnviado_` (:291-303), `cacheGetJson_`/`cachePutJson_`/`cacheInvalidar_` (:319-345) | ADAPTAR (solo :315-345) | invitaciones/consolidados/silencios; guardas en Script Properties | Para "ya importé este mail": columna `messageId` en el ledger, no Script Properties. |
| `shared/brain-drive-runtime.js` | `ensureBrainFolder_` (:85), `leerArchivoBrain_`/`escribirArchivoBrain_`/`appendArchivoBrain_`/`listarArchivosBrain_` (:140-190), `regenerarIndexBrain_` (:193), `serializarFrontmatter_`/`parsearYamlPlano_`/`parsearPagina_`/`componerPagina_` (:283-340) | COPIAR | `BRAIN_ROOT_NAME_='CoS-Brain'`, subcarpetas `people/projects/meetings`, `BRAIN_SCHEMA_MD_` | Raíz `Luca-Wiki`, subcarpetas `merchants/categories/months/notes`. Frontmatter YAML plano basta. |
| `shared/brain-ingest-runtime.js` | `escribirBrain_` (:232: raw → páginas → log → index), `guardarRaw_` (:269), `mergeFrontmatter_` (:408), `parseBodySections_`/`renderBodySections_`/`upsertLineaSeccion_` (:369-406) | ADAPTAR | `INGEST_SCHEMA_`, telegram, roster, persona/proyecto | Reusar pipeline y secciones `##` con upsert. Schema LLM → `{merchant, monto, moneda, categoria, fecha, medio}`. |
| `shared/brain-embeddings-runtime.js` | `embeddingsRefresh_`/`embeddingsRefreshTipo_` (:161-225), `cuantizarInt8Base64_` (:87), `leerIndiceEmbeddings_` (:108, reset por cambio de modelo), `embeddingsQueryVector_` (:337), `embeddingsFusion_` RRF (:450), `embeddingsTfLigero_` (:418) | ADAPTAR | `EMBEDDINGS_TIPOS_`, `telegramSafePage_`, `gemini-embedding-2` | Matemática (int8, L2, dot, RRF k=60) es agnóstica: inyectar `embedBatch_(cfg, texts)`. |
| `shared/brain-backfill-runtime.js` | `iniciarBackfill`/`estadoBackfill`/`cancelarBackfill` (:33-80), `runBackfillPass_` (:98, presupuesto 210s + tope 30 filas), estado en Ajustes `brain.backfill.*` | ADAPTAR | fuentes Daily/Weekly | **Job reanudable con cursor en Ajustes + pasada por trigger** = importación de correos por rango (cursor = fecha/pageToken de Gmail). |
| `shared/brain-admin-runtime.js` | `listarWikiPaginas`/`leerWikiPagina` (:52,:75), `nombreArchivoPaginaSeguro_` (:31, anti path-traversal) | ADAPTAR (:19-100) | merge/olvidar personas | — |
| `shared/sheets-runtime.js` | `getSpreadsheet_`, `getSheet_`, `getHeaderMap_`, `ensureColumn_` | COPIAR | — | Base para el ledger. |
| `shared/DialogMcp.html` | `run(method)` puente `cosRun` (:51), botones guardarWebApp/generar/desconectar (:73-76) | COPIAR | textos; `guardarUrlWebApp` vive en telegram-runtime | Mover `guardarUrlWebApp`+`telegramValidWebAppUrl_` (telegram-runtime.js:20-45) a `webapp-url-runtime.js`. |
| `shared/Sidebar.html` | `runB(method)` (:468, vía `cosRun`) | NO (solo `runB`) | 819 líneas de paneles CoS | Todas las llamadas por `cosRun`; sin wrappers nombrados en el stub. |
| `shared/appsscript.json` | scopes | ADAPTAR | `forms`, `calendar`, `drive` completo, `send_mail` | Luca: `spreadsheets`, `script.external_request`, `drive.file`, `gmail.readonly` (restringido), `script.container.ui`, `script.scriptapp`. |
| `workflows/CLEVEL-REPORTS/stub.js` | `onOpen`, `abrirSidebar`, `abrirDialogo`, `cosRun` (:35), `cosMenu1..5`, `doGet`/`doPost` (:52-56), `dispatcher` | COPIAR (:1-56, :70-72) | `onFormSubmit`, wrappers :76-81, helpers :85-161, rama `tg` | Stub Luca ≈ 50 líneas. |
| `workflows/CLEVEL-REPORTS/config.js` | `CONFIG_STATIC` (:11), `getSheetId_` (:34), `getConfig_` (:39) | COPIAR | pestañas y modelos | `sheets: { ledger:'Movimientos', settings:'Ajustes', categorias:'Categorías' }`. |
| `workflows/CLEVEL-REPORTS/triggers.js` | `setupTriggers` idempotente (:9) | COPIAR | trigger `onFormSubmit` | Solo time-based `dispatcher` (cada 15–30 min). |
| `workflows/CLEVEL-REPORTS/appsscript.json` | librería pinneada v56, `developmentMode:false` | COPIAR | ids | Versión fija = contrato de release. |
| `services/vera-mcp/src/index.ts` | `OAuthProvider({apiRoute:'/mcp', …})` | COPIAR | nombre | — |
| `services/vera-mcp/src/auth.ts` | `POST /enroll` (:48), `GET/POST /authorize` (:64-87) | COPIAR | textos, TTL | Añadir revocación y pairing inverso web→GAS. |
| `services/vera-mcp/src/storage.ts` | `createPairing`/`consumePairing`, `createTenant`/`getTenant`/`deleteTenant` | COPIAR | — | Columnas `user_email`, `llm_provider` si aplica. |
| `services/vera-mcp/src/crypto.ts` | `hmacBase64`, `timingSafeEqual`, `pairingCode` | COPIAR | — | — |
| `services/vera-mcp/src/gasClient.ts` | `callGas` (:28), `verifyDeployment` (:41), `redirect:'follow'` | COPIAR | — | Único acoplamiento al contrato `mcpAction`. |
| `services/vera-mcp/src/tools.ts` | `resolveTenant` (:16), `proxy` (:30), `registerTool` con zod raw shapes | ADAPTAR | 13 tools CoS | Mantener `resolveTenant`+`proxy`. |
| `tests/gas-harness.mjs` | `makeHarness` (:312), mocks `PropertiesService`, `CacheService`, `UrlFetchApp`, `DriveApp` (:170), `SpreadsheetApp`, `HtmlService`; `vm.createContext` (:476-480) | ADAPTAR | `RUNTIME_FILES` (:22), Calendar/FormApp, `geminiOk` | Añadir mock `GmailApp` y `getUserProperties`. |
| `tests/mcp-runtime.test.mjs` | `call(h, op, extra)` arma `e={parameter:{mcp:'1'}, postData}` (:40) | COPIAR (patrón) | — | — |
| `.claude/skills/deploy-cos/SKILL.md` | test → push → `clasp push --project shared` → `create-version` → bump en template | COPIAR | nombres | Añadir `wrangler deploy` como paso 4. |

## 1. Mecanismos reutilizables

**(a) Stub→librería con whitelist** (`stub.js:35`, `ui-runtime.js:237,315`)
```js
function cosRun(fnName, argsJson) {
  return CoSLib.dispatch(fnName, JSON.parse(argsJson || '[]'), getSheetId_(), getConfig_());
}
var DISPATCH_ = { cargarMcp: function (sid, cfg) { return cargarMcp(sid, cfg); }, /* … */ };
function dispatch(fnName, args, sheetId, config) {
  var fn = DISPATCH_[fnName];
  if (!fn) throw new Error('Función no permitida vía cosRun: ' + fnName);
  return fn(sheetId, config, args || []);
}
```
Cliente: `google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).cosRun(method, JSON.stringify(args))`. Convención: `fn(sheetId, config, ...args)`.

**(b) doPost + mcpAction + HMAC** (`webapp-runtime.js:204`, `mcp-runtime.js:52-65`)
```js
if (metodo === 'post' && e && e.parameter && e.parameter.mcp) return mcpAction(e, sheetId, config);
// …
var stored = mcpSecret_(sheetId);
if (!stored) return mcpError_('not-enrolled');
if (op === 'challenge') {
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(String(body.nonce || ''), stored));
  return mcpJson_({ ok: true, sig: sig });
}
if (String(body.secret || '') !== stored) return mcpError_('unauthorized');
```
Siempre HTTP 200 con `{ok:false,error}`; el Worker lo traduce a error de tool.

**(c) Enroll → pairing → OAuth** (`mcp-runtime.js:438-451`, `auth.ts:56-85`, `gasClient.ts:41-47`, `tools.ts:16-23`)
```ts
const ok = await verifyDeployment(webAppUrl, secret).catch(() => false);
if (!ok) return json({ ok: false, error: 'challenge-failed' }, 400);
const code = pairingCode();
await createPairing(env, code, webAppUrl, secret, PAIRING_TTL_MS);
// /authorize POST: consumePairing → createTenant(uuid) →
env.OAUTH_PROVIDER.completeAuthorization({ userId: tenantId, props: { tenantId } });
// tools:
const tenantId = getMcpAuthContext()?.props?.tenantId; const tenant = await getTenant(env, tenantId);
```
`callGas` postea a `<exec>?mcp=1` con `redirect:'follow'`. El sheetId nunca viaja: va implícito en la URL /exec.

**(d) Tools** (`tools.ts:50-56`): `@modelcontextprotocol/server` + `createMcpHandler(() => buildServer(env))`, servidor fresco por request (stateless), zod raw shapes, validación de negocio en GAS.

**(e) Brain** (`brain-drive-runtime.js:85-128`, `brain-embeddings-runtime.js:450`): `<Root>/_schema.md`, `raw/` inmutable, `wiki/index.md`, `wiki/log.md` append-only, `wiki/<tipo>/<slug>.md`, `wiki/<tipo>/_embeddings.json` `{model, dim, updated, pages:{file:{v:<int8 b64>, last_updated}}}`. Búsqueda híbrida: léxica + semántica fusionadas con RRF (`k=60`, 20 candidatos), caché en CacheService, body recortado a 3000 chars.

**(f) Tests** (`gas-harness.mjs:476-480`): `vm.createContext(sandbox)` + `vm.runInContext` de cada runtime; globales `var/function` quedan en `h.api`. `makeHarness({spreadsheets:{SID:{Tab:[HEADERS,…]}}, scriptProperties:{…}})`.

**(g) Settings KV**: pestaña `Ajustes` `key|value` (texto `@`), `readKeyValueTab_`/`setKeyValueTab_` upsert, defaults + tipado, claves con puntos.

**(h) Registro de diálogos**: `DIALOGOS_ = { mcp: { archivo:'DialogMcp', titulo, ancho, alto, modeless } }`; HTML vive en la librería; el stub solo hace `showModalDialog`.

## 2. Lo que Luca necesita y CoS no tiene

1. **Lectura de Gmail** (CoS solo envía con `MailApp`): búsqueda por remitente, parseo HTML, dedup por `messageId`, mock de `GmailApp`.
2. **Propiedades per-user**: `getUserProperties()` o pestaña `_Secrets` para API key del LLM y secreto MCP.
3. **Adapter multi-proveedor LLM** (`callLLM_`, `embed_`) con key inyectada desde config.
4. **Pairing web→GAS** para inyectar provider/key: op inversa `set_config` firmada, o modelo pull (GAS canjea código en el Worker).
5. **Capa de datos Sheets para la web**: Worker→`callGas('query_ledger')` o Sheets API con OAuth del usuario.
6. **Ingesta write-after-confirm**: `preview_import` (lote en CacheService) → `commit_import(loteId)`. Germen: `create_task` con `{duplicate, similar}` + `force` (`mcp-runtime.js:249`).
7. **Importación por rango de fechas**: `brain-backfill` con cursor `after:/before:` de Gmail.
8. **Dashboards genéricos**: sin capa de agregación en CoS.

## 3. Deuda a NO heredar

- Script Properties de la librería como estado multi-tenant (límite 500KB, compartido, invisible desde la copia).
- Key LLM compartida entre tenants (`gemini-runtime.js:16`, 429 global).
- Scope `drive` completo por `DriveApp.searchFiles(fullText)` → `drive.file` + índice léxico propio.
- Gemini-only y modelos hardcodeados.
- Distribución manual a copias (`clasp push` por scriptId).
- Wrappers nombrados duplicados en stub + `run()` legacy en Sidebar.
- Acoplamiento cruzado `mcp-runtime`/`brain-embeddings` → `telegram-runtime`; separar `webapp-url`, `wiki-search`, `wiki-pages`.
- KV writes del OAuthProvider (Free 1k/día): monitorear o mover a D1/DO.
- `escribirArchivoBrain_` = trash + create (pierde versiones, llena papelera) → `setContent()`/Drive `update`.
- `webapp-runtime` mezcla router + follow-up; `DISPATCH_` monolítico de 60+ entradas → componer por módulo.
- Diagnósticos en producción fuera de la librería publicada.
