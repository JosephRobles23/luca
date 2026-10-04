# Plan agente GAS — M1 (LucaLib v4)

Rama: `agent/gas-m1`. Archivos propios: `gas/shared/*` **excepto** `mcp-runtime.js` (pertenece al agente MCP), `gas/stub/*`, `tests/*` salvo `tests/mcp-runtime.test.mjs`. No ejecutar `clasp push` ni crear versiones: lo publica el integrador.

Leer antes: `CLAUDE.md`, `CONTEXT.md`, ADR-003/004/005/006, `docs/discovery/formatos-correos-bcp-yape.md`, `tests/gas-harness.mjs`.

## Entregables (cada uno con tests en Node)
1. **Autorizar completo** (ADR-006 §3.2): `menuAction('lucaMenu1')` → si no hay cursor: (a) instalar trigger, (b) importar último mes (`iniciarImportacion` con `since = hoy − 30 días`) y correr la primera pasada, (c) aviso con resumen. Si ya hay cursor: escaneo normal. El trigger se instala **desde el stub** (`setupTriggers` en `gas/stub/triggers.js`); la librería lo invoca pasando una función del stub como callback o el stub lo llama tras `menuAction` (elegir lo que funcione en GAS: los triggers deben apuntar a funciones del proyecto contenedor). Documentar la elección en el código.
2. **Pestaña `Categorías`** con taxonomía inicial (ADR-004 §5) creada en el primer escaneo si no existe; **pestaña `Comercios`** (`clave`, `nombre`, `categoria`, `categoria_origen`, `veces`, `actualizado_en`).
3. **Categorizador** `categorize_(tx, ctx)` en `categorize-runtime.js`: orden user → reglas → caché → (hook LLM `categorizeWithLlm_` que en M1 devuelve null si no hay key) → ''. Reglas iniciales deterministas (ADR-004). Escribe `categoria` y `categoria_origen` en el ledger y actualiza `Comercios` (`veces`). Función pública `recategorizar(sheetId, config, {id, categoria})` registrada en `DISPATCH_`: fija `categoria_origen=user`, actualiza `Comercios` y recategoriza los movimientos previos del mismo comercio que no tengan origen `user`.
4. **`transfer_in`** para `yape_push_income` (ADR-005): en `push-parsers-runtime.js` el yapeo recibido pasa a `kind: 'transfer_in'`; actualizar tests y `estadoLedger`.
5. **Dedupe difuso** push ↔ correo: al insertar, si existe otra fila con la misma `txFuzzyKey` y distinta fuente, marcar la nueva con flag `fuzzy_dup` (no descartar). Índice por clave en memoria por pasada.
6. **Telemetría y versión en `Ajustes`** (ADR-003/006): `luca.version` (constante `LUCA_VERSION = '4'` en `settings-runtime.js`), `conexiones.execUrl` (`ScriptApp.getService().getUrl()` o '' si no hay despliegue; envolver en try), `conexiones.iphone.{device,lastEventAt,eventsCount,lastError,lastTestAt,schemaVersion}`, `scan.lastRunAt`, `scan.lastStats` (JSON). Escribir en cada pasada del dispatcher.
7. **Eventos push** (`webapp-runtime.js`): `LockService.getUserLock()`, `schema_version` (aceptar '1'; otra → `{ok:false,error:'update-shortcut'}`), `source:'test'` → solo `lastTestAt`, sin ledger; token por dispositivo `deviceToken` en UserProperties (`secrets-runtime.js`: `deviceToken`); funciones `conectarIphone` (genera token, devuelve `{execUrl, token}`), `desconectarIphone`, `regenerarTokenIphone` en `DISPATCH_`.
8. **Sidebar**: secciones Estado (versión, cursor, último escaneo), API key, Importar historial, Conectar iPhone (muestra URL + token + enlace del atajo placeholder `https://www.icloud.com/shortcuts/PENDIENTE`), Desconectar. Sin botones muertos.
9. **Mock del harness**: añadir `ScriptApp.getService().getUrl()`, `LockService.getUserLock`, `Utilities.getUuid` ya existe. Mantener `npm test` verde.

## Criterios de aceptación
- `npm test` verde; cobertura de cada entregable con al menos un test.
- Ningún secreto en Script Properties; todo por usuario.
- Commits pequeños con mensaje en español y la línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Al terminar: resumen en el informe final con funciones nuevas, cambios de `DISPATCH_` y qué debe probar el usuario en el Sheet.
