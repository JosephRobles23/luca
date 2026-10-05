# Contribuir a Luca

Gracias por tu interés. Esta guía resume cómo proponer cambios sin romper las reglas que hacen que Luca sea Luca.

## Reglas que no se negocian

1. **Los datos viven y se procesan en el Google del usuario.** Ningún cambio puede persistir transacciones, tokens
   de Google ni claves de usuarios en infraestructura de Luca. La web no tiene base de datos
   ([ADR-006](docs/architecture/adr-006-web-y-onboarding.md)).
2. **El usuario final no configura GCP ni ninguna nube.** Si un cambio pide un paso manual nuevo, debe documentarse
   en un ADR y en la guía de onboarding.
3. **Secretos nunca en el repositorio.** `.env*`, `.dev.vars` y `.clasprc.json` están ignorados. Si subes un
   secreto por error, avísanos para rotarlo; borrarlo del historial no basta.
4. **Datos reales nunca en el repositorio.** Los fixtures de correo son sintéticos y anonimizados
   (`tests/fixtures`). Los `.eml` reales van a `spikes/eml-raw/`, que está ignorado.
5. **Las decisiones de arquitectura se registran.** Antes de proponer algo estructural, lee
   [`docs/architecture/`](docs/architecture/). Si una decisión cambia, se escribe un ADR nuevo que la sustituye; no
   se edita el anterior en silencio.

## Flujo de trabajo

1. Abre un issue describiendo el problema o la propuesta (para cambios pequeños puedes ir directo al PR).
2. Crea una rama desde `main` con un nombre descriptivo (`fix/parser-yape-qr`, `feat/web-presupuestos`).
3. Haz el cambio con tests. Corre `npm test` (y `npm run mcp:typecheck` si tocas el Worker).
4. Si tocas la web, corre también `npm run e2e --prefix apps/web`.
5. Abre el PR explicando el qué y el porqué, y enlaza el issue o el ADR relacionado.

Usamos mensajes de commit al estilo [Conventional Commits](https://www.conventionalcommits.org/es/):
`feat(gas): …`, `fix(web): …`, `docs: …`, `release: LucaLib vN — …`.

## Convenciones de código

- **Apps Script** (`gas/shared`, `gas/stub`): sin `import/export`; declaraciones de nivel superior con
  `var`/`function`; funciones privadas con sufijo `_`. Toda llamada de la UI pasa por `lucaRun` → `dispatch`
  (lista blanca). Convención `fn(sheetId, config, ...args)`. Un archivo nuevo en `gas/shared` se añade a
  `RUNTIME_FILES` en `tests/gas-harness.mjs`.
- **Estado por usuario** en `PropertiesService.getUserProperties()` o en pestañas de la Sheet, nunca en las Script
  Properties de la librería.
- **Parsers deterministas primero.** El LLM solo recibe `comercio + monto`
  ([ADR-004](docs/architecture/adr-004-categorizacion-y-llm.md)), salvo el extractor opt-in de
  [ADR-008](docs/architecture/adr-008-extractor-llm-opt-in.md).
- **Web**: lógica pura en `apps/web/src/lib/*.ts` con tests `.test.mjs`; los componentes solo presentan.
- Al comparar objetos del sandbox `vm` en tests, usa `JSON.parse(JSON.stringify(x))` (distinto realm).

El detalle completo está en [CLAUDE.md](CLAUDE.md) y el vocabulario del dominio en [CONTEXT.md](CONTEXT.md).

## Nuevos formatos de correo

Si tu banco cambió el formato de un correo o quieres soportar uno nuevo:

1. Guarda el `.eml` real en `spikes/eml-raw/` (no se versiona).
2. Crea un fixture anonimizado en `tests/fixtures` (nombres, montos, números de operación y tarjetas inventados).
3. Añade el caso al parser en `gas/shared/email-parsers-runtime.js` y su test.
4. Documenta el formato en [`docs/discovery/formatos-correos-bcp-yape.md`](docs/discovery/formatos-correos-bcp-yape.md).

## Reportar vulnerabilidades

No abras un issue público. Sigue [SECURITY.md](SECURITY.md).
