# Luca

Gestión de gastos personales sobre la infraestructura de Google del propio usuario: Apps Script lee las notificaciones de BCP y Yape que llegan a Gmail, las normaliza y categoriza en un Google Sheet; una web con dominio propio muestra el dashboard leyendo la Sheet directamente desde el navegador; un servidor MCP permite consultar e ingresar movimientos desde Claude o ChatGPT.

Principio rector: **los datos viven y se procesan en el Google del usuario.** Luca no almacena transacciones.

| Producción | URL |
|---|---|
| Web | https://lucaa.lat |
| Servidor MCP (conector para Claude/ChatGPT) | https://mcp.lucaa.lat/mcp |

## Empezar como usuario (3 pasos)

1. Entra en https://lucaa.lat con tu cuenta de Google y pulsa **Crear mi Sheet**: se copia la plantilla a tu Drive.
2. Abre la Sheet → menú **Luca → Autorizar**: acepta los permisos (Gmail solo lectura) y Luca importa el último mes y queda escaneando cada 15 min.
3. Vuelve a la web para ver el dashboard. Opcional: **Activar conexiones** para el iPhone (yapeos recibidos, `docs/guides/guia-atajos-ios27-yape.md`) y para la IA (código de pairing → conector MCP).

## Documentación

- `docs/architecture/` — `arquitectura-base.md`, ADR-001…008, `plan-implementacion.md` (estado por hito)
- `docs/dev/status.md` — qué está hecho, en curso y pendiente (fuente de verdad)
- `docs/guides/guia-dns-vercel-oauth.md` — DNS Cloudflare, Vercel, clientes OAuth y variables de producción
- `docs/guides/gcp-consola-oauth-luca.md` — consola GCP (APIs, Picker, consentimiento)
- `docs/guides/guia-atajos-ios27-yape.md` — captura de yapeos en iPhone (iOS 27) y experimentos
- `docs/guides/prompt-atajo-ios27-yape.md` — prompt para generar el atajo de iOS con URL y token
- `docs/research/` — investigaciones con fuentes (hosting, provisioning, iOS 27)
- `docs/discovery/` — formatos de correos BCP/Yape, reuso de CoS-Agent, captura por iOS
- `services/luca-mcp/README.md` — endpoints, tools, enrolamiento y despliegue del Worker
- `.claude/skills/deploy-luca/SKILL.md` — procedimiento de release

## Estructura

```text
gas/shared/      LucaLib (librería Apps Script): parsers, ledger, escaneo Gmail, LLM opcional, MCP, UI
gas/stub/        script ligado a la plantilla de Sheet (bootloader delgado; copiado con files.copy)
apps/web/        web Next.js (lucaa.lat): login, onboarding, dashboard, conexiones; sin base de datos
services/        luca-mcp (Worker Cloudflare, mcp.lucaa.lat): OAuth + pairing + tools MCP
scripts/         eml-check.mjs (parser contra .eml reales), release-check.mjs (versiones consistentes)
spikes/          experimentos de validación S1–S7 y resultados
tests/           harness vm de Node con mocks de Apps Script + fixtures sintéticos
docs/            arquitectura, ADRs, research, discovery, guías, estado
```

## Desarrollo

```bash
npm test                  # tests Node: GAS (harness vm), lógica web y Worker; sin tocar Google
npm run web:dev           # Next.js en apps/web (necesita apps/web/.env.local)
npm run e2e --prefix apps/web   # 17 e2e Playwright con LUCA_MOCK=1 (también `npm run dev:mock`)
npm run mcp:typecheck     # tsc del Worker
npm run release:check     # LUCA_VERSION, stub, wrangler.toml y .env.example en la misma versión
npm run lib:push          # clasp push de LucaLib (requiere gas/shared/.clasp.json)
npm run lib:version       # clasp create-version de LucaLib
npm run stub:push         # clasp push del stub a la plantilla
```

Release completa: `.claude/skills/deploy-luca/SKILL.md`.
