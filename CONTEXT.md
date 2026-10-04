# CONTEXT — modelo de dominio de Luca

Vocabulario compartido entre código, docs y conversación. Si un término del código no está aquí, o aquí
significa otra cosa, el que está mal es el código o este archivo: arreglar uno de los dos.

## Actores y lugares
- **Usuario**: persona con cuenta Google que usa Luca. Dueño de todos sus datos.
- **Sheet (Luca Ledger)**: hoja de cálculo del usuario, copia de la **Plantilla**, marcada con
  `appProperties {luca: ledger}`. Contiene las pestañas del ledger. Es la única fuente de verdad.
- **Plantilla**: Sheet de Luca con el **Stub** ligado; se copia con `files.copy` tras elegirla en el Picker.
- **Stub**: script ligado a la Sheet del usuario (~60 líneas). Solo delega en **LucaLib**. Expone `onOpen`,
  `lucaRun`, slots de menú, `doGet/doPost`, `setupTriggers`.
- **LucaLib**: librería Apps Script compartida en solo lectura, versionada. Toda la lógica y la UI del Sheet.
- **Web** (`lucaa.lat`): producto principal. Login Google, onboarding, dashboard, escritura en la Sheet.
  Sin base de datos.
- **Worker** (`luca-mcp`, `mcp.lucaa.lat`): servidor MCP + pairing. Sin datos de usuarios salvo el tenant.
- **Web App** (`/exec`): la copia del usuario desplegada como aplicación web ("ejecutar como yo", "cualquiera").
  Opcional; necesaria para iPhone y para la IA. Se activa en el paso **Activar conexiones**.
- **Tenant**: registro en el Worker que vincula un conector de IA con el `/exec` de un usuario
  (`execUrl`, hash del secreto, `aud`+`sub` del identity token).

## Pestañas del Sheet
| Pestaña | Contenido |
|---|---|
| `Movimientos` | el ledger (una fila por movimiento) |
| `_Procesados` | ids de correos/eventos ya vistos y su resultado (`tx`, `ignored:*`, `unknown`) |
| `Ajustes` | key/value de configuración no sensible (`gmail.*`, `import.*`, `fx.usd_pen`, `llm.provider`, `conexiones.*`, `luca.version`) |
| `Categorías` | taxonomía editable |
| `Comercios` | caché comercio/contraparte → categoría, con `categoria_origen` |

## Movimiento (fila de `Movimientos`)
- **id**: `bcp:<nº operación>` · `yape:<nº operación>` · `push:<id del atajo>` · `manual:<uuid>` · si no hay nº: `gmail:<messageId>`.
- **tipo**: `expense` (gasto) · `income` (ingreso) · `transfer_in` (yapeo recibido; no cuenta como ingreso) ·
  `internal_transfer` (entre cuentas propias; no cuenta en nada) · `rejected` (no se registra).
- **fuente**: `bcp_email` · `yape_email` · `yape_push` · `manual` · `ai_import` (v1).
- **canal**: `qr`, `yape_p2p`, `yape_service`, `yape_topup`, `yape_auto`, `yape_push`.
- **comercio** vs **contraparte**: comercio es un negocio; contraparte es una persona (P2P), identificada por
  `contraparte_key = nombre_truncado|últimos 3 dígitos del celular`.
- **monto/moneda** originales; `tipo_cambio` si el correo lo trae. La conversión a PEN es solo para mostrar.
- **categoria / categoria_origen**: `user` (corrección manual, gana siempre) · `rule` · `cache` · `llm` · vacío
  = **por categorizar**.
- **flags**: `date_from_header`, `no_amount`, `no_date`, `possible_yape_duplicate`, `fuzzy_dup`.

## Procesos
- **Escaneo**: pasada del trigger (cada 15 min) que lista correos nuevos de los remitentes transaccionales
  desde el **cursor** (`gmail.cursor`, con 1 día de solape), los parsea, deduplica y escribe.
- **Importación**: escaneo acotado por fecha (`import.since`), reanudable por lotes hasta `done`.
  Al **Autorizar** se importa automáticamente el **último mes**.
- **Clasificar** (correo): remitente + asunto → `type` (`bcp_card_purchase`, `bcp_internal_transfer`,
  `bcp_wardadito`, `bcp_qr_payment`, `bcp_rejected`, `yape_p2p_sent`, `yape_service`, `yape_topup`,
  `yape_auto_transfer`, `*_unknown`).
- **Parsear**: HTML → texto con celdas (tab) y filas (salto) → pares etiqueta→valor → movimiento normalizado.
- **Categorizar**: user → reglas → caché `Comercios` → LLM (opcional, solo comercio+monto) → por categorizar.
- **Dedupe**: por `id`, por `gmail_id`, y entre canales por **clave difusa** `moneda|monto|minuto`.
- **Pairing**: código de 8 caracteres, un solo uso, 10 min, generado desde el sidebar para conectar la IA.
- **Evento push**: POST del atajo de iOS 27 a `/exec?events=1` con `deviceToken`; formato en ADR-003.

## Reglas de negocio
- Yapeo recibido → `transfer_in`. Yapeo enviado → `expense` por categorizar (el usuario puede marcar
  "Transferencias"). Transferencias entre cuentas propias y wardadito → `internal_transfer`.
- Compras rechazadas no se registran. Marketing de los bancos se ignora.
- Nada de lo que escribe el usuario a mano se sobrescribe automáticamente.
- "Ingresos" en el dashboard solo suma `income`.

## Fuera del dominio (por ahora)
Wallet/Apple Pay, Android, otros bancos, wiki y `search_wiki` (v1), ingesta desde la IA con confirmación (v1),
presupuestos (v1).

## Referencias
ADR-001…007 en `docs/architecture/`; formatos reales en `docs/discovery/formatos-correos-bcp-yape.md`;
reuso de CoS-Agent en `docs/discovery/reuso-cos-agent.md`.
