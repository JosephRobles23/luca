# Plan de implementación de Luca v0

Fecha: 2026-10-04. Decisiones en ADR-001 … ADR-008. Detalle vivo en `docs/dev/status.md`.

**Estado al 2026-10-05:** LucaLib **v13** en la plantilla; 148 tests + 17 e2e en verde; web en https://lucaa.lat;
Worker en https://mcp.lucaa.lat. Falta la validación con Google real por el usuario y la primera conexión MCP.

| Hito | Estado |
|---|---|
| M1 correo → Sheet | ✅ |
| M2 web | ✅ código y desplegada en https://lucaa.lat · ⏳ validación con Google real (cliente OAuth "Luca Web" con URIs de producción) |
| M3 LLM opcional | ✅ código (más extractor opt-in, ADR-008) |
| M4 conexiones | ◐ UI de Conectar iPhone y Web App listas · ⏳ atajo iOS definitivo compartido por iCloud (`SHORTCUT_URL_`) |
| M5 MCP | ✅ infra en https://mcp.lucaa.lat (D1 + KV) · ⏳ 0 tenants: falta la primera conexión desde Claude/ChatGPT |
| M6 lanzamiento | ◐ skill de release `.claude/skills/deploy-luca` y aviso de versión hechos · ⏳ publicar consentimiento OAuth, rotar secretos, invitar amigos |

Leyenda: 🤖 lo hago yo · 🧑 lo haces tú (consola, dispositivo, cuentas) · ⏱ estimación en sesiones de trabajo.

## M1 — Cierre del circuito correo → Sheet ✅
- 🧑 Verificar punta a punta en la copia de prueba: menú Luca, Autorizar, escaneo, pestañas creadas. Reportar números y filas raras (sustituye a S6 mientras no haya `.eml`).
- 🤖 Ajustar el parser con el HTML real; convertir los correos problemáticos en fixtures anonimizados.
- 🤖 "Autorizar" = consentimiento + `setupTriggers` (desde el stub) + importar último mes (ADR-006).
- 🤖 Pestañas `Categorías` (taxonomía inicial) y `Comercios`; reglas deterministas; escritura de `luca.version` y `conexiones.*` en `Ajustes`.
- 🤖 `transfer_in` para push recibido; flag de duplicados push↔correo por clave difusa (ADR-005).
- 🤖 LucaLib v3 + bump del stub en la plantilla.

## M2 — Web usable ✅ código · ⏳ validación real
- 🧑 `.env.local`, cliente OAuth con orígenes/redirecciones de 3000, prueba de "Crear mi Sheet" en la workstation.
- 🤖 Dashboard: tarjeta "Recibido por Yape", conversión USD (correo → `Ajustes.fx.usd_pen`), filtros, estados vacíos.
- 🤖 Escritura desde la web: recategorizar (actualiza `Comercios`), alta manual, marcar transferencia, "Importar historial desde…" (escribe `import.since` en `Ajustes`).
- 🤖 Onboarding de 3 pasos con estado leído de `Ajustes`; guía visual de "app no verificada" (capturas de S3).
- 🤖 Páginas `/privacidad` y `/terminos` (ADR-007).
- ✅ DNS en Cloudflare y web en Vercel con `lucaa.lat`. ⏳ Publicar el cliente OAuth "Luca Web" en producción (guía `docs/guides/guia-dns-vercel-oauth.md`). Original: en Spaceship cambiar nameservers a los de Cloudflare; en Cloudflare añadir `lucaa.lat`; en Vercel añadir dominio y crear el CNAME que indique. Variables de entorno en Vercel (mismas de `.env.local`). Publicar el cliente OAuth en producción.

## M3 — Categorización con LLM opcional ✅ código
- 🤖 Adapter `callLLM_` (Gemini/OpenAI/Anthropic) con `responseSchema`, reintentos y presupuesto por pasada; solo comercios sin resolver; escritura en `Comercios`.
- 🤖 Sidebar: proveedor + modelo + key; botón "Categorizar pendientes ahora".
- 🤖 Tests con mock de `UrlFetchApp`.

## M4 — Conexiones: Web App, iPhone directo ◐
- 🤖 Paso "Activar conexiones": validación de `/exec` desde el sidebar, `deviceToken`, pantalla con enlace del atajo + QR; `eventsAction_` con token por dispositivo, `LockService`, `schema_version` y dedupe (ADR-003).
- 🤖 Telemetría del canal en `Ajustes.conexiones.iphone.*` + tarjeta de estado (Probar / Regenerar token / Desconectar) en web y sidebar; aviso de URL cambiada y de silencio > 7 días.
- 🧑 Crear el atajo definitivo en iOS 27 (prompt de la guía con URL y token como preguntas de importación), compartirlo por enlace de iCloud y probar con un yapeo recibido.
- 🤖 Guía visual del despliegue del Web App (video de 40 s lo grabas 🧑).

## M5 — MCP `luca-mcp` ✅ infra · ⏳ primer tenant
- 🤖 Fork de Vera-MCP: `/enroll` (challenge HMAC), pairing desde el sidebar, `/authorize`, `/token`, `GET /meta` (última versión), `accessTokenTTL` 24 h. Tools v0: `get_summary`, `category_breakdown`, `top_merchants`, `list_transactions`, `budget_status` (vacío hasta v1), `add_expense`. Ops correspondientes en `mcp-runtime.js` del Apps Script.
- ✅ `wrangler login` en la cuenta compartida; D1 y KV creados; dominio `mcp.lucaa.lat` activo.
- 🧑 Conectar desde Claude y ChatGPT; medir Writes de KV.

## M6 — Lanzamiento con amigos ⏳
- ✅ Checklist de release: `.claude/skills/deploy-luca/SKILL.md` + `npm run release:check`.
- 🧑 Rotar secretos expuestos; invitar 3–5 personas; recoger `.eml` de sus bancos solo si son BCP/Yape.
- ✅ Aviso de "versión nueva" en web y sidebar (`/meta` + `Ajustes.luca.version`).

## Dependencias
M1 → M2 (la web necesita `Ajustes.conexiones` y `Categorías`). M3 y M4 son independientes tras M1. M5 necesita M4 (Web App). M6 al final.

## Riesgos abiertos
- HTML real de los correos distinto a los fixtures (se resuelve en M1 con tu reporte).
- Publicación del cliente OAuth: `lucaa.lat` ya está en línea; falta publicar el consentimiento (M6).
- Fricción del despliegue del Web App (M4): medir abandono con los primeros 5 usuarios; si es alto, evaluar add-on.
- KV writes compartidas con Vera (ADR-007): revisar en M5.
