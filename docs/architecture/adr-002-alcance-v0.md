# ADR-002 — Alcance de v0 y v1

Fecha: 2026-10-04 · Estado: **aceptado** (sesión de grilling)

## Decisión

**v0 (usable por amigos):**
- Ingesta por correo BCP/Yape (parser determinista) con trigger cada 15 min e importación inicial de **1 mes** al autorizar; historial más antiguo opt-in desde la web.
- Canal iPhone (atajo iOS 27) para yapeos recibidos.
- Categorización: reglas → caché `Comercios` → LLM opcional (ADR-004).
- Web `lucaa.lat`: login, onboarding de 3 pasos, dashboard, recategorizar, alta manual, estado de conexiones.
- Dashboard en el Sheet como extra (misma lógica, adaptador `google.script.run`).
- MCP (`luca-mcp`, `mcp.lucaa.lat`): tools de **solo lectura** + `add_expense`.
- Solo iOS. Solo BCP + Yape (parser con registro por banco para crecer).

**v1:** wiki en Drive + `search_wiki`, ingesta desde la IA (`propose_import` / `commit_import`), presupuestos, atajo de carga rápida, API key desde la web, Android (MacroDroid con el mismo contrato de evento), otros bancos, tipo de cambio diario.

## Consecuencias
- `drive.file` se mantiene en el manifiesto del Apps Script desde v0 aunque la wiki sea v1, para no forzar una reautorización masiva después.
- Las tools de escritura con confirmación (import) no se diseñan todavía; `add_expense` sí, con validación de esquema y dedupe.
