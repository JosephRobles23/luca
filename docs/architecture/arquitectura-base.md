# Luca — Arquitectura base (propuesta v0)

Fecha: 2026-10-04. Estado: **propuesta para discutir en /wayfinder**, no decisión final.

Insumos:
- `docs/research/2026-10-hosting-y-provisioning-gas.md` (hosting free-tier, provisioning, scopes)
- `docs/research/2026-10-ios-captura-notificaciones-yape.md` (captura push iOS 27)
- `docs/discovery/reuso-cos-agent.md` (qué se recicla de CoS-Agent)
- `docs/discovery/formatos-correos-bcp-yape.md` (formatos reales de correos)
- `docs/guides/guia-atajos-ios27-yape.md` (pruebas en iPhone pendientes)

## 1. Principios

1. **Los datos viven en el Google del usuario** (Sheet + carpeta `Luca-Wiki` en Drive). Luca no almacena transacciones; solo `cuenta ↔ sheetId` y lo mínimo para autenticar.
2. **Cero configuración de infraestructura para el usuario.** Nada de GCP, billing ni consolas. La única acción fuera de la web es autorizar su propio script dentro del Sheet y pegar un código.
3. **Todo lo que toca correos o montos corre en el Apps Script del usuario**, bajo su identidad. El Worker solo autentica y traduce MCP; la web solo pinta.
4. **API key del LLM por usuario**, en `PropertiesService` de su script. Nunca compartida, nunca persistida en nuestro lado más allá del TTL de un código.
5. **Dos superficies de UI sobre la misma lógica:** la **web con dominio propio** es el producto; el **menú/sidebar/modal dentro del Sheet** es un complemento opcional (salvo el paso de autorización, que solo puede ocurrir ahí).
6. **Free tier primero**, con disparadores de migración documentados.

## 2. Componentes

```text
┌──────────────────────┐   drive.file (token del usuario, en el navegador)   ┌──────────────────────────────┐
│  Web Next.js         │ ───────────────────────────────────────────────────▶ │  Google del usuario          │
│  dominio propio      │                                                       │  ├─ Sheet "Luca Ledger"      │
│  (Vercel Hobby v0)   │ ── pairing code ──┐                                   │  │   └─ stub (script ligado) │
└──────────────────────┘                   │                                   │  │       └─ LucaLib (lib)    │
                                           ▼                                   │  ├─ Drive/Luca-Wiki/         │
┌──────────────────────┐   /pair, /mcp     ┌─────────────────┐  UrlFetch /pair │  └─ Gmail (gmail.readonly)   │
│  Claude / ChatGPT    │ ◀── OAuth 2.1 ──▶ │ Worker Cloudflare│ ◀──────────────│                              │
│  (conector MCP)      │                   │ (fork Vera-MCP)  │ ── doPost ────▶│  Web App /exec (opcional v0) │
└──────────────────────┘                   │ D1 + KV          │                 └──────────────────────────────┘
                                           └─────────────────┘                          ▲
┌──────────────────────┐                                                                │ POST evento (token por dispositivo)
│ iPhone (Atajos iOS27)│ ───────────────────────────────────────────────────────────────┘
└──────────────────────┘
```

| Componente | Tecnología | Qué hace | Qué guarda |
|---|---|---|---|
| **Web** | Next.js (App Router), Auth.js con Google, Vercel Hobby | Login, "Crear mi Sheet", guía de autorización, generar código de pairing, dashboard, gestión de conexiones (MCP, iPhone), ajustes (proveedor LLM + key) | `sub ↔ sheetId`, estado de onboarding. Opcional: refresh token cifrado con `drive.file` si el Worker lee la Sheet directo |
| **Worker** | Cloudflare Workers + `workers-oauth-provider` + D1 + KV (fork de `services/vera-mcp`) | Servidor MCP (OAuth 2.1, Streamable HTTP), `/pair` (canje de código → config + key), `/events` (ingesta desde iPhone), verificación de ID tokens de GAS | D1: tenants `(sub, sheetId, aud, subGoogle, execUrl?, secretHash)`, pairings con TTL. KV: estado OAuth |
| **LucaLib** (librería GAS, solo lectura para usuarios) | Apps Script + clasp, `shared/` | Parsers BCP/Yape, categorización, ledger, wiki, importación histórica, adapter LLM, ops MCP, UI HtmlService | Nada (toda la persistencia es del usuario) |
| **Stub** (script ligado a la plantilla) | Apps Script, `workflows/luca/` | `onOpen` → menú Luca; `lucaRun` → `LucaLib.dispatch`; `doPost` → router; `setupTriggers` | `PropertiesService` del usuario: llmKey, tenantId, secret, cursores |
| **Sheet del usuario** | Google Sheets | Pestañas `Movimientos`, `Categorías`, `Comercios` (caché comercio→categoría), `Presupuestos`, `Ajustes`, `_Procesados` | Todo el ledger |
| **Luca-Wiki** | Carpeta Drive creada por el script (`drive.file`) | `wiki/merchants/`, `wiki/categories/`, `wiki/months/`, `wiki/notes/`, `index.md`, `log.md`, `_embeddings.json` | Conocimiento financiero del usuario |

## 3. Decisiones tomadas en esta propuesta

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| D1 | **MCP en Cloudflare Workers** reutilizando Vera-MCP | Ya existe, OAuth 2.1 resuelto, 100k req/día free, sin tope de duración de pared, dominio propio gratis. Presupuesto de salida: $5/mes si KV supera 1k escrituras/día | GCP (exige tarjeta/billing), Oracle Always Free (A1 bajó a 2 OCPU/12 GB, reclamación por inactividad, ops 24/7), Vercel (300 s máx por función, cron 1/día) |
| D2 | **Web Next.js en Vercel Hobby para v0** | DX, Auth.js, cero ops. Cláusula "no comercial" encaja mientras sea gratis para amigos | Cloudflare (vinext en beta, OpenNext en mantenimiento; límites de tamaño contradictorios). Migrar si se monetiza o si Vercel bloquea |
| D3 | **Lectura del dashboard web: navegador → Sheets API con `drive.file`** | Los datos nunca pasan por nuestro servidor; scope no sensible; sin verificación de Google | Web → Worker → GAS (más latencia, pasa por nosotros) |
| D4 | **Acceso del MCP a datos: Opción A, Worker → Web App `/exec` del usuario**, con onboarding progresivo (ver `adr-001-acceso-mcp-a-datos.md`) | Única opción donde toda la lógica corre en el Apps Script del usuario y no custodiamos tokens de Google. El Web App solo se pide al "Conectar con tu IA" | B (Worker → Sheets API con refresh token): custodia de token + lógica fuera de Google + sin Gmail/wiki. C (híbrido): fricción de A + custodia de B |
| D5 | **API key: modelo pull con código de pairing** | GAS canjea el código en el Worker con `getIdentityToken`; la key viaja una vez y vive en `PropertiesService`. Ningún Web App necesario para esto | Push desde la web al `/exec` (no existe aún); `scripts.run` (exige proyecto GCP estándar: descartado) |
| D6 | **Parsing determinista primero, LLM solo para categorizar comercios nuevos** | Correos de BCP/Yape son tablas etiqueta→valor estables; costo y privacidad | LLM sobre todo el correo (solo como respaldo para formatos desconocidos) |
| D7 | **Scopes del GAS: `spreadsheets`, `gmail.readonly`, `drive.file`, `script.external_request`, `openid`** | Mínimos. `drive.file` basta para la wiki creada por la app (mejora sobre CoS). `gmail.readonly` es restringido pero el script es del propio usuario (uso personal, sin CASA) | `mail.google.com` (GmailApp por defecto), `drive` completo |
| D8 | **Librería versionada + stub**, no add-on | Add-on con `gmail.readonly` implica verificación + CASA anual | Add-on (reconsiderar si supera ~100 usuarios o se publica) |
| D9 | **Wallet Transaction fuera de alcance** | Compras con tarjeta ya llegan por correo BCP | — |

## 4. Flujo de alta (onboarding)

| Paso | Dónde | Qué pasa | Fricción |
|---|---|---|---|
| 1 | Web | Login con Google (`openid email profile`) | 1 clic |
| 2 | Web | "Crear mi Sheet": pedir `drive.file` → abrir el **Picker** apuntando a la plantilla (elegirla la mete en alcance) → `files.copy(plantilla)` → guardamos `sub ↔ sheetId`. **Validado en S1 (2026-10-04):** copia directa 404, tras Picker 200, sin scopes sensibles | 2 clics |
| 3 | Sheet | Abrir el Sheet; `onOpen` pinta el menú **Luca** | — |
| 4 | Sheet | Menú Luca → **Autorizar**: consentimiento del proyecto por defecto del script. Cuentas @gmail.com verán "Google no ha verificado esta app" → Avanzado → Ir a Luca. La web muestra guía con capturas | **El punto de abandono.** Mitigar con video/capturas |
| 5 | Web → Sheet | La web muestra un **código de 8 caracteres** (TTL 10 min, un uso). Menú Luca → **Conectar** → pegar código. GAS llama `WORKER/pair {code, idToken}`; Worker verifica y devuelve `{llmKey?, config, tenantId, secret}`. Si el usuario prefiere, pega la key a mano en el sidebar | 1 pegado |
| 6 | Sheet (auto) | `setupTriggers`: dispatcher cada 15–30 min para escanear Gmail | — |
| 7 | Web | "Importar historial": últimos 30/90/365 días → job con cursor en el GAS del usuario, progreso visible en la web | 1 clic |
| 8 | Web | "Conectar con Claude/ChatGPT": URL del MCP + código; en el conector, login → pegar código | 3 clics |
| 9 (opc.) | Sheet | Desplegar Web App `/exec` solo si se quiere ingesta desde iPhone directo al GAS o modo sin-Worker | Solo usuarios avanzados |

## 5. Flujos de datos

### 5.1 Ingesta por correo (automática)
`Trigger (15 min)` → `Gmail API: from:(BCP|Yape) after:<cursor>` → por mensaje: clasificar por remitente+asunto → extraer tabla etiqueta→valor → normalizar (fecha ≥4 formatos, S/ vs $, tipo de cambio) → descartar transferencias internas y rechazos → dedupe (`messageId`, `Nº operación`, monto+Δt≤5 min) → categorizar: reglas → caché `Comercios` → LLM (solo comercio+monto, JSON estructurado) → fila en `Movimientos` → (async) actualizar wiki `merchants/<slug>.md` y `months/<yyyy-mm>.md`.

### 5.2 Ingesta desde iPhone (si las pruebas de iOS 27 pasan)
`Atajo (Notificación Yape)` → `POST WORKER/events {deviceToken, id, title, body, ts}` → Worker valida token del dispositivo → reenvía al `/exec` del usuario (o encola si no responde) → mismo pipeline de normalización en GAS (parser de texto de push) → dedupe contra correos.

### 5.3 Consulta desde la IA (MCP, solo lectura)
Tools: `get_summary(period)`, `category_breakdown(period)`, `top_merchants(period)`, `list_transactions(filters)`, `search_wiki(query)`, `budget_status()`. Worker → GAS `op` vía `/exec` (todas las tools). Respuestas sin PII innecesaria.

### 5.4 Ingesta desde la IA (MCP, escritura con confirmación)
El usuario sube a Claude/ChatGPT un Excel de flujo de caja o fotos de un cuaderno → **el modelo extrae** (Luca no procesa archivos) → `propose_import(rows[])` → GAS valida esquema, detecta duplicados, guarda lote en `CacheService` (TTL 30 min), devuelve vista previa + `batchId` → el usuario confirma en el chat → `commit_import(batchId)` → filas a `Movimientos` con `source: "ai_import"` + nota en wiki. Límite por lote (p. ej. 200 filas). `add_expense` para casos sueltos (boletas).

### 5.5 Wiki
Mismo patrón CoS-Brain: `raw/` inmutable, páginas markdown con frontmatter plano, `index.md`, `log.md` append-only, `_embeddings.json` int8 por tipo, búsqueda híbrida léxica + semántica con RRF. Embeddings vía adapter (`gemini`/`openai`; si el usuario usa Anthropic, solo léxica). Páginas: por comercio, por categoría, por mes (resumen generado), notas libres del usuario.

### 5.6 Importación histórica
Job reanudable (patrón `brain-backfill`): cursor `before:/after:` + `pageToken` en `PropertiesService`, presupuesto 210 s por pasada, trigger cada minuto hasta terminar, estado consultable desde la web vía Worker→GAS o desde el sidebar.

## 6. Capa compartida de UI

El dashboard (`docs/html/dashboard-mock.html`) es HTML/JS sin dependencias con una interfaz de datos única:

```ts
interface LedgerSource {
  transactions(period): Promise<Tx[]>;
  budgets(): Promise<Budget[]>;
  categories(): Promise<Category[]>;
  recategorize(id, category): Promise<void>;
}
// Web:   SheetsApiSource (fetch a sheets.googleapis.com con token GIS)
// Modal: GasSource (google.script.run.lucaRun)
```
Las agregaciones (totales, por categoría, 6 meses, presupuestos) viven en un módulo puro compartido y testeado en Node.

## 7. Estructura de repo propuesta

```text
luca/
├─ apps/web/            Next.js (Vercel)
├─ services/luca-mcp/   Worker (fork vera-mcp): oauth, pair, events, tools
├─ gas/shared/          LucaLib (clasp): parsers/, ledger/, wiki/, llm/, mcp/, ui/ (HTML)
├─ gas/stub/            script ligado a la plantilla
├─ packages/core/       lógica pura compartida (agregaciones, parsers de texto) con tests Node
├─ tests/               harness GAS (vm) + fixtures .eml anonimizados
└─ docs/
```

## 8. Spikes del día 1 (antes de /wayfinder o como primeros tickets)

| Spike | Pregunta | Si falla |
|---|---|---|
| S1 | ~~`files.copy` con `drive.file`~~ **Resuelto:** directo 404; con Picker previo 200 | — |
| S2 | ~~Picker + `drive.file` → Sheets API~~ **Resuelto:** 200/200 | — |
| S3 | UX real de "app no verificada" en la propia copia (cuenta @gmail.com) | Video guía; evaluar add-on más adelante |
| S4 | `getIdentityToken` desde GAS: ¿`aud` estable por copia? ¿se puede anclar en el pairing? | Volver a secreto compartido como Vera |
| S5 | Escrituras KV por flujo OAuth del Worker (medir con `wrangler tail`) | Paid $5 o mover estado a D1/DO |
| S6 | Parsers contra 2–3 `.eml` reales de cada tipo | — (es trabajo, no riesgo) |
| S7 | iOS 27: Experimentos 1–3 de la guía | Solo correo + carga manual rápida |

## 9. Preguntas abiertas para /wayfinder

1. ~~Acceso del MCP a datos~~ → resuelto en ADR-001 (Opción A). Queda: ¿el Web App puede seguir el HEAD del stub para no-propietarios, o cada release de LucaLib exige que el usuario cree una versión nueva de su implementación?
2. (Lógica de negocio en Apps Script: **decidido**, ver ADR-001.) ¿Proveedores LLM soportados en v0? (Gemini tiene free tier y embeddings; OpenAI tiene embeddings; Anthropic no tiene embeddings.)
3. ¿Multi-moneda en el ledger: convertir a PEN al ingresar o guardar ambas y convertir al mostrar?
4. ¿Qué pasa cuando actualizamos LucaLib? (versión fija en el stub ⇒ copias viejas no se actualizan solas; `developmentMode` solo funciona para el dueño). ¿Pedir al usuario "Actualizar" desde la web vía Worker→GAS?
5. ¿Android en v0 (listener de notificaciones) o solo iOS/correo?
6. Modelo de datos de la wiki: ¿páginas por comercio y por mes bastan, o también por "proyecto/negocio" para los flujos de caja importados?
7. Política de privacidad y términos: qué prometemos exactamente ("solo pasa, no se guarda") y cómo lo auditamos (logs del Worker sin payloads).
8. Nombre del repo, licencia, y si `luca` será monorepo (pnpm workspaces) o dos repos (web + gas/worker).
