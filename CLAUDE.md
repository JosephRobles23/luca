# Luca — guía para agentes

Luca: gastos personales sobre el Google del usuario. Apps Script (LucaLib + stub en una Sheet plantilla) lee
correos BCP/Yape y eventos push del iPhone → `Movimientos`; web Next.js (`apps/web`, lucaa.lat) lee la Sheet
desde el navegador; Worker Cloudflare (`services/luca-mcp`) expone MCP. Vocabulario en `CONTEXT.md`.

## Reglas que no se negocian
- **Los datos viven y se procesan en el Google del usuario.** Nada de persistir transacciones, tokens de Google
  ni claves de usuarios en nuestra infraestructura. La web no tiene base de datos (ADR-006).
- **El usuario final no configura GCP ni ninguna nube.** Toda configuración manual que se le pida debe estar en
  un ADR y en la guía de onboarding.
- **Secretos nunca en el repo ni en el chat.** `.env*`, `.dev.vars`, `.clasprc.json` están ignorados. Si un
  secreto aparece en el chat, decir que se rote.
- **Antes de decidir algo nuevo de arquitectura, leer `docs/architecture/`.** Las decisiones viven en
  ADR-001…009; si una cambia, se escribe un ADR que la sustituye, no se edita el anterior en silencio.
- Estado multi-tenant **nunca** en Script Properties de la librería (deuda de CoS-Agent que no se hereda).
  Por usuario: `PropertiesService.getUserProperties()` o pestañas del Sheet.

## Comandos
```bash
npm test                 # 154 tests Node (harness vm con mocks de Apps Script, stub, lógica web y Worker)
npm run release:check    # LUCA_VERSION, stub, wrangler.toml y .env.example en la misma versión
npm run lib:push         # clasp push de LucaLib (gas/shared)
npm run lib:version      # nueva versión de LucaLib → luego subir "version" en gas/stub/appsscript.json
npm run stub:push        # clasp push del stub a la plantilla (gas/stub)
npm run web:dev          # Next.js en apps/web (necesita apps/web/.env.local); e2e: npm run e2e --prefix apps/web
```
Release: skill `.claude/skills/deploy-luca/SKILL.md` (`/deploy-luca`): tests → `LUCA_VERSION` → `lib:push` →
`lib:version` → bump en `gas/stub/appsscript.json` → `stub:push` → `LUCA_LIB_VERSION` (wrangler) y
`NEXT_PUBLIC_LUCA_LIB_VERSION` (.env.example + Vercel) → `wrangler deploy` → commit. Las copias existentes de
los usuarios no se actualizan solas (ADR-006 §5).

## Convenciones de código
- **Apps Script (`gas/shared`, `gas/stub`)**: sin `import/export`; declaraciones de nivel superior con
  `var`/`function` (así quedan en el sandbox de tests). Privadas con sufijo `_`. Públicas sin sufijo solo si
  las llama el stub, la UI (`DISPATCH_`) o los tests. Toda llamada de UI pasa por `lucaRun` → `dispatch`
  (lista blanca). Convención `fn(sheetId, config, ...args)`.
- Nuevo runtime en `gas/shared` ⇒ añadirlo a `RUNTIME_FILES` en `tests/gas-harness.mjs`.
- Triggers y `ScriptApp.getService().getUrl()` solo desde el stub (apuntan al proyecto contenedor): el stub
  pasa `setupTriggers` como callback a `menuAction` y `config.execUrl` en `getConfig_()`.
- Al publicar una versión nueva de LucaLib, subir `LUCA_VERSION` en `settings-runtime.js`.
- Parsers deterministas primero; el LLM solo recibe `comercio + monto` (ADR-004). Única excepción: el extractor
  opt-in de correos no reconocidos (ADR-008), que envía el texto **enmascarado** y solo si `llm.extractUnknown`.
- Web: lógica pura en `apps/web/src/lib/*.ts` con tests `.test.mjs`; componentes solo presentan.
- Al comparar objetos del sandbox vm en tests usar `JSON.parse(JSON.stringify(x))` (distinto realm).
- Fixtures de correo **sintéticos y anonimizados** en `tests/fixtures`; los `.eml` reales van a
  `spikes/eml-raw/` (ignorado) y se anonimizan antes de convertirse en fixtures.

## Dónde está cada cosa
| Qué | Dónde |
|---|---|
| Decisiones y plan | `docs/architecture/` (ADR-001…009, `plan-implementacion.md`) |
| Formatos reales de correos | `docs/discovery/formatos-correos-bcp-yape.md` |
| Qué se reutiliza de CoS-Agent (`/home/user/Projects/CoS-Agent`) | `docs/discovery/reuso-cos-agent.md` |
| Research con fuentes | `docs/research/` |
| Spikes y resultados | `spikes/README.md` |
| Guías de usuario/operador (GCP, iOS 27) | `docs/guides/` |

## Infraestructura (no es del usuario final)
- **GCP** `luca-510610` (cuenta `gavynenita@gmail.com`). Dos clientes OAuth: **"Luca Web"**
  (producción: `AUTH_GOOGLE_ID/SECRET` de `apps/web/.env.local` y de Vercel; URIs de lucaa.lat, luca-sand.vercel.app
  y localhost:3000) y "Luca Web (spikes)" (solo la página de spikes del puerto 5173; no tocar).
- **Apps Script** (dueño `petter.chuquipiondo.r@gmail.com`, la sesión de clasp; carpeta Drive "LUCA"
  `18aQXOYlyznY6xZm3ViRdVrFWILLXsHQL`, cualquiera con el enlace = lector): LucaLib
  `1DI_WQYKlD2hw0_18sIHOwd-exl8F5i4Y2-YFSr-WJRfl3Z2NaYm0gUGa` · plantilla Sheet "Luca Template"
  `1kQWNaj9J29LRK-LsdCAxrplW06heaTvS3Hje3NV1htg` (stub `1J1OqLSkpbWQu6gD3nKrFM0BeciUKv3H3A8C4mD4Q33x42ebvyUkNfp5M`).
  La numeración de LucaLib se reinició en esta librería (v1 sin usar; v2 = código de la v22 anterior). La librería
  y la plantilla antiguas de gavynenita (`1gU08…`, `1FMx…`, hasta v22) siguen vivas para las copias existentes; ya
  no reciben releases.
- **Web**: https://lucaa.lat → Vercel proyecto `luca-sand` (https://luca-sand.vercel.app, Root Directory `apps/web`).
- **Worker**: https://mcp.lucaa.lat (respaldo https://luca-mcp.chif-of-staff.workers.dev), cuenta de Cloudflare de
  CoS-Agent; D1 `luca-mcp` id `6fa4bc8d-628c-4b4a-85e5-f98cb07f19bb`; KV `LUCA_OAUTH_KV` (binding `OAUTH_KV`).
- **Dominio** `lucaa.lat`: DNS en Cloudflare. Guía: `docs/guides/guia-dns-vercel-oauth.md`.
- Cuenta de prueba "usuario final": `petter.chuquipiondo.r@gmail.com` (también dueña de LucaLib y la plantilla).
