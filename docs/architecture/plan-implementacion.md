# Plan de implementación de Luca v0

Fecha: 2026-10-04. Decisiones en ADR-001 … ADR-007. Estado actual: LucaLib v2 publicada y apuntada desde la plantilla; parser de correo y push con 36 tests; web v0 compilando (login, Picker→copia, dashboard).

Leyenda: 🤖 lo hago yo · 🧑 lo haces tú (consola, dispositivo, cuentas) · ⏱ estimación en sesiones de trabajo.

## M1 — Cierre del circuito correo → Sheet (⏱ 1)
- 🧑 Verificar punta a punta en la copia de prueba: menú Luca, Autorizar, escaneo, pestañas creadas. Reportar números y filas raras (sustituye a S6 mientras no haya `.eml`).
- 🤖 Ajustar el parser con el HTML real; convertir los correos problemáticos en fixtures anonimizados.
- 🤖 "Autorizar" = consentimiento + `setupTriggers` (desde el stub) + importar último mes (ADR-006).
- 🤖 Pestañas `Categorías` (taxonomía inicial) y `Comercios`; reglas deterministas; escritura de `luca.version` y `conexiones.*` en `Ajustes`.
- 🤖 `transfer_in` para push recibido; flag de duplicados push↔correo por clave difusa (ADR-005).
- 🤖 LucaLib v3 + bump del stub en la plantilla.

## M2 — Web usable (⏱ 2)
- 🧑 `.env.local`, cliente OAuth con orígenes/redirecciones de 3000, prueba de "Crear mi Sheet" en la workstation.
- 🤖 Dashboard: tarjeta "Recibido por Yape", conversión USD (correo → `Ajustes.fx.usd_pen`), filtros, estados vacíos.
- 🤖 Escritura desde la web: recategorizar (actualiza `Comercios`), alta manual, marcar transferencia, "Importar historial desde…" (escribe `import.since` en `Ajustes`).
- 🤖 Onboarding de 3 pasos con estado leído de `Ajustes`; guía visual de "app no verificada" (capturas de S3).
- 🤖 Páginas `/privacidad` y `/terminos` (ADR-007).
- 🧑 DNS: en Spaceship cambiar nameservers a los de Cloudflare; en Cloudflare añadir `lucaa.lat`; en Vercel añadir dominio y crear el CNAME que indique. Variables de entorno en Vercel (mismas de `.env.local`). Publicar el cliente OAuth en producción.

## M3 — Categorización con LLM opcional (⏱ 1)
- 🤖 Adapter `callLLM_` (Gemini/OpenAI/Anthropic) con `responseSchema`, reintentos y presupuesto por pasada; solo comercios sin resolver; escritura en `Comercios`.
- 🤖 Sidebar: proveedor + modelo + key; botón "Categorizar pendientes ahora".
- 🤖 Tests con mock de `UrlFetchApp`.

## M4 — Conexiones: Web App, iPhone directo (⏱ 1)
- 🤖 Paso "Activar conexiones": validación de `/exec` desde el sidebar, `deviceToken`, pantalla con enlace del atajo + QR; `eventsAction_` con token por dispositivo y dedupe (ADR-003).
- 🧑 Crear el atajo definitivo en iOS 27 (prompt de la guía con URL y token como preguntas de importación), compartirlo por enlace de iCloud y probar con un yapeo recibido.
- 🤖 Guía visual del despliegue del Web App (video de 40 s lo grabas 🧑).

## M5 — MCP `luca-mcp` (⏱ 2)
- 🤖 Fork de Vera-MCP: `/enroll` (challenge HMAC), pairing desde el sidebar, `/authorize`, `/token`, `GET /meta` (última versión), `accessTokenTTL` 24 h. Tools v0: `get_summary`, `category_breakdown`, `top_merchants`, `list_transactions`, `budget_status` (vacío hasta v1), `add_expense`. Ops correspondientes en `mcp-runtime.js` del Apps Script.
- 🧑 `wrangler login` en la cuenta compartida; crear D1 y KV; dominio `mcp.lucaa.lat`.
- 🧑 Conectar desde Claude y ChatGPT; medir Writes de KV.

## M6 — Lanzamiento con amigos (⏱ 1)
- 🤖 Checklist de release (skill de deploy: tests → push lib → versión → bump stub → wrangler deploy → Vercel).
- 🧑 Rotar secretos expuestos; invitar 3–5 personas; recoger `.eml` de sus bancos solo si son BCP/Yape.
- 🤖 Aviso de "versión nueva" en web y sidebar.

## Dependencias
M1 → M2 (la web necesita `Ajustes.conexiones` y `Categorías`). M3 y M4 son independientes tras M1. M5 necesita M4 (Web App). M6 al final.

## Riesgos abiertos
- HTML real de los correos distinto a los fixtures (se resuelve en M1 con tu reporte).
- Publicación del cliente OAuth bloqueada por la marca hasta tener `lucaa.lat` en línea (M2).
- Fricción del despliegue del Web App (M4): medir abandono con los primeros 5 usuarios; si es alto, evaluar add-on.
- KV writes compartidas con Vera (ADR-007): revisar en M5.
