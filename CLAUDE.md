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
  ADR-001…007; si una cambia, se escribe un ADR que la sustituye, no se edita el anterior en silencio.
- Estado multi-tenant **nunca** en Script Properties de la librería (deuda de CoS-Agent que no se hereda).
  Por usuario: `PropertiesService.getUserProperties()` o pestañas del Sheet.

## Comandos
```bash
npm test                 # 69+ tests Node (harness vm con mocks de Apps Script, stub y lógica web)
npm run lib:push         # clasp push de LucaLib (gas/shared)
npm run lib:version      # nueva versión de LucaLib → luego subir "version" en gas/stub/appsscript.json
npm run stub:push        # clasp push del stub a la plantilla (gas/stub)
npm run web:dev          # Next.js en apps/web (necesita apps/web/.env.local)
```
Release: tests → `lib:push` → `lib:version` → bump en `gas/stub/appsscript.json` → `stub:push` → (Worker)
`wrangler deploy` → Vercel. Las copias existentes de los usuarios no se actualizan solas (ADR-006 §5).

## Convenciones de código
- **Apps Script (`gas/shared`, `gas/stub`)**: sin `import/export`; declaraciones de nivel superior con
  `var`/`function` (así quedan en el sandbox de tests). Privadas con sufijo `_`. Públicas sin sufijo solo si
  las llama el stub, la UI (`DISPATCH_`) o los tests. Toda llamada de UI pasa por `lucaRun` → `dispatch`
  (lista blanca). Convención `fn(sheetId, config, ...args)`.
- Nuevo runtime en `gas/shared` ⇒ añadirlo a `RUNTIME_FILES` en `tests/gas-harness.mjs`.
- Triggers y `ScriptApp.getService().getUrl()` solo desde el stub (apuntan al proyecto contenedor): el stub
  pasa `setupTriggers` como callback a `menuAction` y `config.execUrl` en `getConfig_()`.
- Al publicar una versión nueva de LucaLib, subir `LUCA_VERSION` en `settings-runtime.js`.
- Parsers deterministas primero; el LLM solo recibe `comercio + monto` (ADR-004).
- Web: lógica pura en `apps/web/src/lib/*.ts` con tests `.test.mjs`; componentes solo presentan.
- Al comparar objetos del sandbox vm en tests usar `JSON.parse(JSON.stringify(x))` (distinto realm).
- Fixtures de correo **sintéticos y anonimizados** en `tests/fixtures`; los `.eml` reales van a
  `spikes/eml-raw/` (ignorado) y se anonimizan antes de convertirse en fixtures.

## Dónde está cada cosa
| Qué | Dónde |
|---|---|
| Decisiones y plan | `docs/architecture/` (ADR-001…007, `plan-implementacion.md`) |
| Formatos reales de correos | `docs/discovery/formatos-correos-bcp-yape.md` |
| Qué se reutiliza de CoS-Agent (`/home/user/Projects/CoS-Agent`) | `docs/discovery/reuso-cos-agent.md` |
| Research con fuentes | `docs/research/` |
| Spikes y resultados | `spikes/README.md` |
| Guías de usuario/operador (GCP, iOS 27) | `docs/guides/` |

## Infraestructura (no es del usuario final)
GCP `luca-510610` (cuenta `gavynenita@gmail.com`; clasp ya autenticado) · LucaLib
`1gU08ZAJ0EAmi59WgPSWHVjzQ-FZAhBWMxb01XXjaYsdH06Td19z27tuU` · plantilla Sheet
`1FMxSE00KcD68JdClICcWayMxdqvSROYr6tuL-va5KWA` (stub `1UmA2ZK8Ho7X9V3nR1qb8udDURa6dkojCW7gY5nGOx1OLYq9LmM6oXMoK`)
· dominio `lucaa.lat` (DNS Cloudflare, web Vercel, Worker en la cuenta de Cloudflare de CoS-Agent).
Cuenta de prueba "usuario final": `petter.chuquipiondo.r@gmail.com`.
