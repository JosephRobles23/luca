# ADR-004 — Categorización: reglas → caché → LLM opcional; API key solo en el Sheet

Fecha: 2026-10-04 · Estado: **aceptado**

## Decisión
1. **Orden de resolución** por movimiento: (1) corrección previa del usuario en `Comercios` (`categoria_origen=user`, gana siempre) → (2) reglas deterministas (`Metropolitano`→Transporte, `SPOTIFY|NETFLIX`→Suscripciones, `INKAFARMA|MIFARMA`→Salud, recargas→Servicios, `yape_service` usa Empresa/Servicio) → (3) caché `Comercios` por comercio normalizado → (4) **LLM solo si hay API key** y solo con `comercio + monto + moneda` (nunca el correo) pidiendo JSON `{categoria, confianza}` → (5) sin resultado: `categoria=''` ("por categorizar").
2. **Modo sin API key es completo**: todo funciona; lo no resuelto queda por categorizar y el usuario lo asigna desde la web o el Sheet. La key es una mejora.
3. **Proveedores** vía un adapter único `callLLM_(cfg, prompt, schema)`: Gemini (por defecto, free tier), OpenAI, Anthropic. Modelo por defecto configurable en `Ajustes.llm.model`.
4. **La API key se ingresa solo en el sidebar del Sheet** y vive en `PropertiesService.getUserProperties()` del usuario. En v0 **no** hay pairing web → Apps Script para la key; la web solo muestra "configurada / falta". El pairing se reserva para la conexión MCP.
5. **Taxonomía inicial** (pestaña `Categorías`, editable): Vivienda, Supermercado, Comidas fuera, Transporte, Servicios, Suscripciones, Salud, Educación, Ropa, Ocio, Transferencias, Otros, más `Ingreso`.
6. Cada corrección del usuario (web o Sheet) actualiza `Comercios` y, si el comercio se repite, recategoriza los movimientos previos sin categoría (nunca los ya corregidos a mano).

## Consecuencias
- Costo de LLM casi nulo tras las primeras semanas (solo comercios nuevos).
- Privacidad: al LLM solo viajan nombres de comercio y montos.
- La web necesita escribir `categoria` y `Comercios` vía Sheets API (ADR-006).
