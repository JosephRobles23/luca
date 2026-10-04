# Estado de desarrollo

Actualizado: 2026-10-04 (noche). Fuente de verdad de qué está hecho, en curso y pendiente. Commits en `main`.

## Hecho y publicado
- LucaLib **v5** (`gas/shared`), 97 tests:
  - Parsers correo (9 tipos + avisos ignorados) validados con 8 `.eml` reales; parser push (yapeo recibido → `transfer_in`).
  - **Autorizar** = consentimiento + trigger (callback `setupTriggers` del stub) + importación del último mes + telemetría.
  - Categorización `user → reglas → caché Comercios → LLM (hook, null sin key)`; pestañas `Categorías` (13) y `Comercios`; `recategorizar` aprende y arrastra.
  - Dedupe difuso push↔correo (`fuzzy_dup`); telemetría en `Ajustes` (`luca.version`, `conexiones.*`, `scan.*`).
  - Eventos iPhone en `/exec?events=1`: token por dispositivo, lock, `schema_version`, `source:test`; `conectarIphone`/`regenerarTokenIphone`/`desconectarIphone`.
  - **MCP** (`mcp-runtime.js`): `mcpAction` con challenge HMAC y secreto por usuario; ops `get_summary`, `category_breakdown`, `top_merchants`, `list_transactions`, `budget_status`, `add_expense`; `cargarMcp`/`iniciarConexionMcp`/`desconectarMcp`.
  - Sidebar completo (estado, key, importar, iPhone). Falta en sidebar: botones de "Conectar IA" (ops ya existen).
- **Worker `services/luca-mcp`** (fork de Vera-MCP): `/enroll`, `/authorize`, `/token`, `/register`, `/mcp`, `GET /meta`; TTL 24 h; tools v0; typecheck y `wrangler deploy --dry-run` OK. **No desplegado** (falta `wrangler login`, D1, KV).
- Stub en la plantilla `1FMx…` apuntando a LucaLib v5 (`lucaMenu1` pasa `setupTriggers`; `getConfig_` añade `execUrl`).
- Parser validado contra **8 `.eml` reales** (`docs/gmails/`, ignorados por git) con `scripts/eml-check.mjs`: 100 % correctos tras ajustar el layout de Yape (una celda por fila), `PLIN-<nombre>` y avisos de seguridad. 40 tests.
- Web v0 (`apps/web`): Auth.js Google, Picker→copia, dashboard leyendo la Sheet, lógica pura con tests. Compila. No probada aún contra Google real por el usuario.
- Infra: GCP `luca-510610` (APIs, API key Picker, cliente OAuth con orígenes 5173/3000), dominio `lucaa.lat` comprado.
- Spikes S1–S5, S7 resueltos (ver `spikes/README.md`). S6 (`.eml` reales) pendiente del usuario.
- Decisiones: ADR-001…007, `plan-implementacion.md`, `CLAUDE.md`, `CONTEXT.md`.

## En curso (agentes en worktrees, ramas `agent/*`)
Integrados en `main`: `agent/mcp-m5`, `agent/gas-m1`.
| Rama | Plan | Alcance |
|---|---|---|
| `agent/web-m2` | `docs/dev/plan-web-m2.md` | Modo mock para desarrollo y e2e, todos los botones funcionales, escritura en la Sheet, onboarding 3 pasos, estado de conexiones, legales, Playwright |

## Pendiente del usuario
- Actualizar su copia a LucaLib **v5** (o hacer una copia nueva de la plantilla) y repetir Autorizar/Escanear; reportar números y filas raras; `.eml` de correos problemáticos y **del correo de abono BCP** (captura o `.eml`) a `spikes/eml-raw/`.
- `apps/web/.env.local`, prueba de la web en la workstation (puerto 3000).
- DNS `lucaa.lat` → Cloudflare; proyecto en Vercel (root `apps/web`).
- `wrangler login` en `services/luca-mcp` + crear D1/KV (README del Worker) para desplegar `mcp.lucaa.lat`.
- Writes (24h) de `OAUTH_KV` (opcional).

## Bloqueos conocidos
- Faltan `.eml` de: transferencia entre mis cuentas, compra rechazada, yapeo de servicio, recarga, envío automático y **abono BCP**. Los tipos con `.eml` real ya están validados.
- Correo de abono BCP: formato desconocido; `income` desde correo queda pendiente hasta ver una muestra.
