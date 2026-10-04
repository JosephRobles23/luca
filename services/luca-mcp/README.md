# luca-mcp — servidor MCP de Luca (Cloudflare Worker)

Servidor MCP remoto **multi-tenant** que conecta Luca con Claude/ChatGPT en `https://mcp.lucaa.lat`.
Es un **relevo sin estado**: resuelve `token → tenant` y reenvía cada tool call al **Web App `/exec`
del usuario** (`LucaLib.mcpAction`, en `gas/shared/mcp-runtime.js`). Los movimientos viven y se
procesan en el Google del usuario; aquí no hay transacciones, tokens de Google ni claves (ADR-001).

Fork casi literal de `CoS-Agent/services/vera-mcp` (ver `docs/discovery/reuso-cos-agent.md`), sin
`/events` (ADR-003: el iPhone habla directo con el `/exec`).

## Arquitectura

```
Claude/ChatGPT ──OAuth (DCR+PKCE)──▶ /authorize (código de pairing)
      │                                    │  props.tenantId → token (TTL 24 h)
      └──── tool call /mcp ───────────────▶ tools.ts → gasClient ──POST ?mcp=1──▶ GAS /exec (mcpAction)
                                                      (tenantId → D1 {execUrl, secret})
```

| Archivo | Qué hace |
|---|---|
| `src/index.ts` | `OAuthProvider` (+ `accessTokenTTL` 24 h) + `createMcpHandler` |
| `src/auth.ts` | `POST /enroll`, `GET/POST /authorize`, `GET /meta` |
| `src/tools.ts` | registra las tools: una tool = una op de GAS con el mismo nombre |
| `src/schemas.ts` | módulo puro: zod shapes, descripciones, `isExecUrl` (testeado con `node --test`) |
| `src/gasClient.ts` | puente al `/exec` (**calza exacto con `mcpAction`**) |
| `src/storage.ts` | D1: tenants + pairings (`schema.sql`) |
| `src/crypto.ts` | HMAC (debe casar con `Utilities.computeHmacSha256Signature` de GAS) |

## Endpoints

| Método y ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /enroll` | LucaLib (`iniciarConexionMcp`) | `{webAppUrl, secret}` → challenge HMAC contra el `/exec` → `{ok, code, expiresInSeconds}` (código de 8 caracteres, un solo uso, 10 min) |
| `GET /authorize` | navegador del usuario (abierto por Claude/ChatGPT) | página para pegar el código |
| `POST /authorize` | formulario anterior | consume el código, crea el tenant, completa el OAuth con `props.tenantId` |
| `POST /token`, `POST /register` | cliente MCP | los maneja `workers-oauth-provider` |
| `POST /mcp` | cliente MCP (Bearer) | JSON-RPC MCP → tools |
| `GET /meta` | web y sidebar | `{ lucaLibVersion, minShortcutSchema }` desde `[vars]` |

## Tools v0 ↔ ops de GAS

Cada tool envía `POST <execUrl>?mcp=1` con `{ op, secret, args }`. GAS responde siempre HTTP 200
con `{ ok:true, … }` o `{ ok:false, error }` (el Worker lo convierte en error de tool).

| Tool / op | Args | Respuesta (`ok:true` +) |
|---|---|---|
| `get_summary` | `{month}` | `{month, moneda:'PEN', fx_usd_pen, income, expense, transferIn, net, count, pendingCount, byCategory:[{name,amount,pct,count}], topMerchants:[{name,amount,count}] (8), last6:[{month,expense}], prevExpense}` |
| `category_breakdown` | `{month}` | `{month, moneda, expense, categories:[{name,amount,pct,count}]}` |
| `top_merchants` | `{month, limit?}` (def. 10, máx. 50) | `{month, moneda, expense, merchants:[{name,amount,count}]}` |
| `list_transactions` | `{month?, from?, to?, tipo?, categoria?, texto?, limit?}` (def. 50, máx. 200) | `{total, returned, transactions:[{id,fecha,tipo,monto,moneda,tipo_cambio,monto_pen,comercio,contraparte,categoria,categoria_origen,medio,canal,fuente,flags}]}` |
| `budget_status` | `{month}` | `{month, available:false, reason}` (v1) |
| `add_expense` | `{monto, moneda?, fecha, comercio?, contraparte?, categoria?, nota?, force?}` | `{added, duplicate:false, id:'manual:<uuid>', transaction}` o `{added:0, duplicate:true, similar:[…]}` |

Semántica (ADR-005): `transfer_in` va aparte y no suma a ingresos; `internal_transfer` no cuenta en
ningún KPI; USD se convierte con `tipo_cambio` del correo o `Ajustes.fx.usd_pen` (3.50). Errores de
validación: `invalid-month`, `invalid-from|to`, `invalid-tipo`, `invalid-monto`, `invalid-moneda`,
`invalid-fecha`; de auth: `not-enrolled`, `unauthorized`, `unknown-op`, `bad-request`.
`add_expense` deduplica por clave difusa `moneda|monto|minuto` (por día si solo vino la fecha) y
guarda la `nota` en la columna `asunto`.

## Enrolamiento (challenge HMAC)

1. Sidebar → `iniciarConexionMcp` genera el secreto por usuario (`UserProperties`, nunca el navegador) y hace `POST /enroll {webAppUrl, secret}`.
2. Worker → `POST <webAppUrl>?mcp=1 {op:'challenge', nonce}`; GAS responde `HMAC(nonce, secretoGuardado)`.
3. Si cuadra, el Worker crea el código (TTL 10 min) y lo devuelve; el sidebar lo muestra junto a `connectorUrl` (`…/mcp`).
4. El usuario añade el conector en Claude/ChatGPT → el cliente abre `/authorize` → pega el código → tenant creado.
5. "Desconectar" borra el secreto en GAS: toda llamada del Worker pasa a `not-enrolled` (el usuario corta desde su lado).

## Despliegue (requiere la cuenta de Cloudflare; no lo hace el usuario final)

```bash
cd services/luca-mcp
npm install
npx wrangler login                              # cuenta compartida con Vera-MCP (ADR-007 §3)

npx wrangler d1 create luca-mcp                 # → pegar database_id en wrangler.toml
npx wrangler kv namespace create OAUTH_KV       # → pegar id en wrangler.toml
npm run db:init                                 # aplica schema.sql en la D1 remota

npm run typecheck
npx wrangler deploy --dry-run                   # sin login; valida bundle y bindings
npm run deploy                                  # publica y crea el custom domain mcp.lucaa.lat
```

- **Dominio**: `routes = [{ pattern = "mcp.lucaa.lat", custom_domain = true }]` crea el registro DNS
  automáticamente porque la zona `lucaa.lat` ya está en la misma cuenta de Cloudflare. Si no
  aparece, Workers → luca-mcp → Settings → Domains & Routes → Add → Custom domain.
- **Secretos**: hoy no hay ninguno (`wrangler secret put` no es necesario). `.dev.vars.example`
  documenta las variables para `wrangler dev`.
- **Variables**: al publicar una nueva versión de LucaLib, subir `LUCA_LIB_VERSION` en
  `wrangler.toml` y redesplegar (es lo que `GET /meta` anuncia).
- Local: `cp .dev.vars.example .dev.vars && npx wrangler dev` (D1/KV locales con `--local` por defecto).

## Conectar desde los clientes

- **Claude** (web/desktop): Ajustes → Conectores → *Añadir conector personalizado* → URL
  `https://mcp.lucaa.lat/mcp` → se abre `/authorize` → pegar el código del sidebar.
- **ChatGPT** (modo desarrollador / Apps): Ajustes → Conectores → *Crear* → MCP Server URL
  `https://mcp.lucaa.lat/mcp`, autenticación OAuth → mismo flujo.
- Claude Code: `claude mcp add --transport http luca https://mcp.lucaa.lat/mcp`.

El token de acceso dura 24 h; el refresh lo hace el cliente solo.

## Cuotas (plan Free compartido con Vera-MCP; ADR-007 §3)

- KV: 1 000 writes/día por **cuenta**. Estimación S5: 3–5 writes por conexión nueva, ~2 por refresh.
  `accessTokenTTL` = 24 h reduce los refreshes a ~2 writes/usuario/día.
- **Disparador de Workers Paid ($5/mes): Writes (24h) de KV > 600.** Cómo medirlo:
  dashboard de Cloudflare → Storage & Databases → KV → namespace `OAUTH_KV` → *Metrics* →
  "Writes" en ventana de 24 h; o `npx wrangler kv namespace list` + la pestaña de analytics del
  namespace. Para ver tráfico en vivo sin payloads: `npx wrangler tail luca-mcp --format pretty`.
- Logs: el Worker no registra payloads de tools (solo errores del runtime).

## Tests

```bash
npm test                      # test/*.test.mjs: schemas (zod) y crypto (HMAC, pairing) con node --test
```
El lado GAS se prueba en la raíz con el harness: `tests/mcp-runtime.test.mjs` (challenge, auth, cada op,
dedupe de `add_expense`, sidebar). `npm test` en la raíz ejecuta ambos.

## Pendiente de validar en runtime (`wrangler dev`)

El puente **props del token ↔ `getMcpAuthContext()`**: que `props.tenantId` seteado en
`completeAuthorization` llegue a los tools. Es la integración documentada
OAuthProvider → createMcpHandler (verificada en Vera-MCP con las mismas versiones).
