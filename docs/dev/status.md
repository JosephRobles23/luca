# Estado de desarrollo

Skill de release: `.claude/skills/deploy-luca/SKILL.md`

Actualizado: 2026-10-05. Fuente de verdad de qué está hecho, en curso y pendiente. Commits en `main`.

## Hecho y publicado
- LucaLib **v20** — **Dashboard de la Sheet** rediseñado: `dashboard-runtime.js` (`resumenDashboard`, paridad con `summarize` de la web)
  + `DialogDashboard` con pestañas Resumen / Categorías / Tendencias / Movimientos, selector de mes y gráficos SVG
  (dona, barras de 6 meses, líneas por categoría, barras apiladas, ritmo del mes). Vista previa: botón Dashboard en
  `docs/html/preview-sidebar.html` (datos calculados con el `resumenDashboard` real). 213 tests.
- LucaLib **v19** — fix: en v18 el sidebar llegaba sin estilos ni `_Ui` (se quedaba en "cargando…"). Los
  marcadores de parciales eran comentarios HTML y HtmlService los elimina; ahora son `<luca-parcial nombre="_X">`
  y los archivos se leen sin procesar (`createTemplateFromFile(...).getRawContent()`). El harness ya elimina los
  comentarios como HtmlService, así que el test de parciales reproduce el bug.
- LucaLib **v18** — UI de la Sheet con la identidad de DESIGN.md (210 tests):
  - Parciales `_Estilos`/`_Ui`/`_Logo` insertados en el servidor (`htmlConParciales_`): tokens, Geist, botones con
    estado de carga, toasts arriba, esqueletos.
  - Sidebar rediseñado: pestañas Estado/IA/iPhone/MCP con iconos SVG, iPhone en 3 pasos, código MCP con cuenta
    atrás, **Modo avanzado** por usuario (UserProperties). Maqueta: `docs/html/preview-sidebar.html` (monta el real).
  - **Guía** (`DialogGuia`, modeless) con pasos auto-detectados; abre el panel en su pestaña.
  - **Estilo de las hojas** (`estilo-hojas-runtime.js`): encabezado, filas alternas, colores de categoría (paridad
    con la web), columnas técnicas plegadas; se aplica solo una vez por `ui.estiloVersion` y desde Luca → 🎨.
  - Pendiente: verificar en una Sheet real (fuente Geist en Sheets, diálogos desde el panel).
- LucaLib **v17** (`gas/shared`), 164 tests unitarios en total (GAS + web + Worker):
  - Parsers correo (9 tipos + avisos ignorados) validados con 8 `.eml` reales; parser push (yapeo recibido → `transfer_in`).
  - **Autorizar** = consentimiento + trigger (callback `setupTriggers` del stub) + importación del último mes + telemetría.
  - Categorización `user → reglas → caché Comercios → LLM (hook, null sin key)`; pestañas `Categorías` (13) y `Comercios`; `recategorizar` aprende y arrastra.
  - Dedupe difuso push↔correo (`fuzzy_dup`); telemetría en `Ajustes` (`luca.version`, `conexiones.*`, `scan.*`).
  - Eventos iPhone en `/exec?events=1`: token por dispositivo, lock, `schema_version`, `source:test`; `conectarIphone`/`regenerarTokenIphone`/`desconectarIphone`.
  - **MCP** (`mcp-runtime.js`): `mcpAction` con challenge HMAC y secreto por usuario; ops `get_summary`, `category_breakdown`, `top_merchants`, `list_transactions`, `budget_status`, `add_expense`; `cargarMcp`/`iniciarConexionMcp`/`desconectarMcp`.
  - Sidebar completo: estado, API key, importar, Conectar iPhone, **Conectar IA** (código de pairing).
  - **LLM opcional** (`llm-runtime.js`): Gemini/OpenAI/Anthropic con JSON schema, reintentos, presupuesto por pasada; `categorizarPendientes`, `probarLlm`; auto al final de cada pasada si hay key. Solo viaja comercio + monto.
  - **Extractor LLM opt-in** (`llm-extract-runtime.js`, ADR-008): correos BCP/Yape no reconocidos → JSON estricto con PII enmascarada; `extraerDesconocidos`; casilla en sidebar.
  - Telemetría en `Ajustes` alineada con la web: `conexiones.iphone.execUrl`, `conexiones.mcp*`, `llm.apiKey.configured`.
- **Worker `services/luca-mcp`** (fork de Vera-MCP): `/enroll`, `/authorize`, `/token`, `/register`, `/mcp`, `GET /meta`; TTL 24 h; tools v0; typecheck y `wrangler deploy --dry-run` OK. **Desplegado** en https://mcp.lucaa.lat (y workers.dev), D1 + KV propios. Aún **0 tenants**: falta la primera conexión real desde Claude/ChatGPT.
- Stub en la plantilla `1FMx…` apuntando a LucaLib v17 (stub v2 con STUB_VERSION) (`lucaMenu1` pasa `setupTriggers`; `getConfig_` añade `execUrl`).
- Parser validado contra **8 `.eml` reales** (`docs/gmails/`, ignorados por git) con `scripts/eml-check.mjs`: 100 % correctos tras ajustar el layout de Yape (una celda por fila), `PLIN-<nombre>` y avisos de seguridad. 40 tests.
- **Asistente Conectar iPhone** en la web (`/app/conexiones/iphone`): 5 pasos, QR, copiar URL/token/prompt (idéntico al del sidebar, test de paridad), espera de la prueba en vivo. Falta `NEXT_PUBLIC_SHORTCUT_URL` cuando exista el enlace de iCloud.
- **Web completa** (`apps/web`): landing, onboarding de 3 pasos, dashboard (4 KPIs incl. Recibido por Yape, USD con TC), movimientos con filtros/recategorizar/marcar transferencia/detalle, agregar manual, ajustes, conexiones (iPhone/IA/Web App con telemetría), `/privacidad`, `/terminos`, tema claro/oscuro, 360 px. Modo `LUCA_MOCK=1` y **17 e2e Playwright** en verde. `merchantKey` alineada con GAS. **No probada aún contra Google real** por el usuario.
- Infra: GCP `luca-510610` (APIs, API key Picker, cliente OAuth con orígenes 5173/3000), dominio `lucaa.lat` comprado.
- Spikes S1–S5, S7 resueltos (ver `spikes/README.md`). S6 (`.eml` reales) pendiente del usuario.
- Decisiones: ADR-001…007, `plan-implementacion.md`, `CLAUDE.md`, `CONTEXT.md`.

## En curso (agentes en worktrees, ramas `agent/*`)
Integrados en `main`: `agent/mcp-m5`, `agent/gas-m1`, `agent/web-m2`, `agent/gas-m3`, `agent/gas-llm-extract`. No hay agentes en curso.
| Rama | Plan | Alcance |
|---|---|---|

## Pendiente del usuario
- Actualizar su copia a LucaLib **v17** y reimportar (limpiar Movimientos/_Procesados/cursor) (o hacer una copia nueva de la plantilla) y repetir Autorizar/Escanear; reportar números y filas raras; `.eml` de correos problemáticos y **del correo de abono BCP** (captura o `.eml`) a `spikes/eml-raw/`.
- `apps/web/.env.local`, prueba de la web en la workstation (puerto 3000).
- ~~DNS~~ ✅ `lucaa.lat` en Cloudflare; web en https://lucaa.lat (Vercel). Pendiente: cliente OAuth "Luca Web" con las URIs y publicar el consentimiento (guía Parte D/E).
- Conectar el MCP de punta a punta: Web App desplegado → sidebar "Generar código" → conector en Claude.
- Writes (24h) de `OAUTH_KV` (opcional).

## Siguiente (M3/M4/M6)
- M4: atajo definitivo de iOS compartido por iCloud (reemplazar `SHORTCUT_URL_` placeholder); capturas reales de "app no verificada" en el paso 2 de la web.
- M6: skill de release; aviso de versión ya implementado en web y sidebar.

## Bloqueos conocidos
- Faltan `.eml` de: transferencia entre mis cuentas, compra rechazada, yapeo de servicio, recarga, envío automático y **abono BCP**. Los tipos con `.eml` real ya están validados.
- Correo de abono BCP: formato desconocido; `income` desde correo queda pendiente hasta ver una muestra.

## Incidente abierto (2026-10-04 noche)
- En GAS real, las 92 filas importadas quedaron con `no_amount,date_from_header`: el cuerpo llega vacío al parser (decodificación de `payload.parts[].body.data`), aunque el mismo parser acierta 100 % con los `.eml` en Node. v9 añade fallback `format=raw` + parser MIME propio, contadores `emptyBody`/`viaRaw` en `scan.lastStats` y `diagnosticarCorreo` (sidebar → Diagnóstico). **Causa raíz encontrada con el diagnóstico (2026-10-05):** el servicio avanzado de Gmail en Apps Script entrega `body.data` y `raw` ya decodificados como `Byte[]` (dataLen ≈ 3.5× size), no como base64. v10 acepta `Byte[]` y respeta el charset de la parte. Pendiente: confirmar con la reimportación del usuario.
