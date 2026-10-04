# Estado de desarrollo

Actualizado: 2026-10-04 (tarde). Fuente de verdad de qué está hecho, en curso y pendiente. Commits en `main`.

## Hecho y publicado
- LucaLib **v3** (`gas/shared`): parsers correo (9 tipos) y push, ledger + `_Procesados`, escaneo incremental con cursor y lotes, importación histórica reanudable, Ajustes/UserProperties, router Web App (`?events=1`, `?mcp=1` stub), UI mínima (menú, sidebar, dashboard placeholder). 37 tests.
- Stub en la plantilla `1FMx…` apuntando a LucaLib v3.
- Web v0 (`apps/web`): Auth.js Google, Picker→copia, dashboard leyendo la Sheet, lógica pura con tests. Compila. No probada aún contra Google real por el usuario.
- Infra: GCP `luca-510610` (APIs, API key Picker, cliente OAuth con orígenes 5173/3000), dominio `lucaa.lat` comprado.
- Spikes S1–S5, S7 resueltos (ver `spikes/README.md`). S6 (`.eml` reales) pendiente del usuario.
- Decisiones: ADR-001…007, `plan-implementacion.md`, `CLAUDE.md`, `CONTEXT.md`.

## En curso (agentes en worktrees, ramas `agent/*`)
| Rama | Plan | Alcance |
|---|---|---|
| `agent/gas-m1` | `docs/dev/plan-gas-m1.md` | Autorizar completo, Categorías/Comercios/reglas, `transfer_in`, dedupe difuso, telemetría en Ajustes, eventos con lock y schema_version, sidebar |
| `agent/web-m2` | `docs/dev/plan-web-m2.md` | Modo mock para desarrollo y e2e, todos los botones funcionales, escritura en la Sheet, onboarding 3 pasos, estado de conexiones, legales, Playwright |
| `agent/mcp-m5` | `docs/dev/plan-mcp-m5.md` | Fork de Vera-MCP → `services/luca-mcp`, tools v0, `/meta`, TTL 24 h, `gas/shared/mcp-runtime.js` con ops, tests |

## Pendiente del usuario
- Actualizar su copia a LucaLib v3 y repetir Autorizar/Escanear; reportar números y filas raras; `.eml` de correos problemáticos y **del correo de abono BCP** (captura o `.eml`) a `spikes/eml-raw/`.
- `apps/web/.env.local`, prueba de la web en la workstation (puerto 3000).
- DNS `lucaa.lat` → Cloudflare; proyecto en Vercel (root `apps/web`).
- `wrangler login` cuando `services/luca-mcp` exista en `main`.
- Writes (24h) de `OAUTH_KV` (opcional).

## Bloqueos conocidos
- No hay `.eml` reales: el parser está validado solo contra fixtures sintéticos y una ejecución real que falló por decodificación (corregido en v3).
- Correo de abono BCP: formato desconocido; `income` desde correo queda pendiente hasta ver una muestra.
