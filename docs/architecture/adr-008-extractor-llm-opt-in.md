# ADR-008 — Extractor opt-in con LLM para correos no reconocidos

Fecha: 2026-10-05 · Estado: **aceptado** · Complementa ADR-004 (no lo sustituye: el default sigue siendo "solo comercio + monto").

## Contexto
Cuando BCP o Yape cambian una plantilla o envían un tipo nuevo, el clasificador determinista lo deja como
`bcp_unknown` / `yape_unknown` en `_Procesados` y el movimiento no entra al ledger hasta que publiquemos un parser.
Varios usuarios tienen API key configurada y prefieren que la IA lo intente antes que esperar.

## Decisión
1. **Opt-in explícito**: `Ajustes.llm.extractUnknown` (default `'false'`), casilla en el sidebar que explica qué viaja.
   Solo activo con API key. Sin la casilla, nada del correo sale del Apps Script (ADR-004 intacto).
2. **Alcance**: únicamente correos de remitentes BCP/Yape clasificados `*_unknown`. Nunca correos ya parseados ni de otros remitentes.
3. **Enmascarado antes de enviar** (`maskPii_`, mejor esfuerzo): secuencias de ≥7 dígitos (aunque lleven espacios/puntos/guiones)
   → `#######`; correos → `<EMAIL>`; línea de saludo ("Hola <Nombre>,") y valores de etiquetas de persona (Yapero, Beneficiario,
   Nombre, Titular, Destinatario, Remitente, Ordenante, Cliente) → `<NOMBRE>`. Límites conocidos: nombres en frases libres no se
   detectan; números de operación de ≥7 dígitos se pierden (el id queda `gmail:<id>`); montos ≥ 1 000 000 se enmascaran.
4. **Respuesta estricta** `{kind, amount, currency, occurred_at, merchant, counterparty, operation_id, confidence}`.
   Se acepta con `confidence >= 0.7` y `amount > 0`; `not_transaction`/`rejected` con confianza → `ignored:llm_not_transaction`;
   si duda → sigue `unknown`. La tx lleva `type <banco>_llm`, flag `llm_extracted`, categoría por el flujo normal.
5. **Presupuesto compartido** con la categorización (mismo ctx: 15 llamadas / 60 s por pasada). `_Procesados` marca `tx:llm`.
6. **Reintento manual**: botón "Reintentar desconocidos con IA" → `extraerDesconocidos` relee los `unknown` y los pasa por el extractor.

## Consecuencias
- Privacidad: con la casilla apagada no cambia nada. Encendida, viaja texto del correo enmascarado; el usuario lo acepta a sabiendas.
- Los movimientos `llm_extracted` son revisables en la web/Sheet; nunca se loguea el texto del correo (ni enmascarado).
