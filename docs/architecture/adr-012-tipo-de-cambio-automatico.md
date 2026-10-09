# ADR-012 — Tipo de cambio automático (BCRP) en vez de un valor fijo

Fecha: 2026-10-09 · Estado: **aceptado** · Sustituye la parte "Multi-moneda → conversión" de
[ADR-005](adr-005-modelo-de-movimientos.md); el resto de ADR-005 sigue vigente.

## Contexto
ADR-005 convierte los movimientos en USD a PEN **al mostrar**: (1) el `tipo_cambio` del propio correo y, si no lo
trae, (2) `Ajustes.fx.usd_pen`, un valor fijo (3.50 por defecto) que el usuario edita a mano. ADR-005 ya dejaba
"tipo de cambio diario (SUNAT/API)" para más adelante. Con un valor fijo, los gastos de meses pasados quedan mal
valorados y, si el usuario lo actualiza, **cambian todos los meses a la vez**.

La investigación ([2026-10-tipo-de-cambio-apis](../research/2026-10-tipo-de-cambio-apis.md)) y el spike S8
(`spikes/README.md`) concluyen:
- La fuente oficial, gratuita y sin token del tipo **bancario** es la API del BCRP (series SBS `PD04639PD` compra,
  `PD04640PD` venta, `PD04648PD` EUR venta), con histórico por rango. No admite CORS: solo se puede leer desde un
  servidor o desde Apps Script.
- Desde `UrlFetchApp`, Imperva desafía ~7 % de las llamadas con **HTTP 200 + HTML**; reintentando, 0 rondas perdidas.
- Publica con 1–3 días hábiles de retraso y `n.d.` en feriados.
- Respaldo sin token: open.er-api.com (tipo medio de mercado, solo el del día, **exige atribución**).
- No existe API pública del tipo de pizarra de cada banco.

## Decisión
1. **Quién lo trae: LucaLib, en la copia del usuario.** Una función `actualizarTipoCambio_(sheetId, config)` corre al
   final de `runDispatcher` (el trigger de 15 min que ya existe), como máximo una lectura correcta al día y un
   reintento por hora si falla. No hay trigger nuevo, ni scope nuevo (el stub ya declara
   `script.external_request`), ni pasos para el usuario. Nuestra infraestructura (Worker, Vercel) **no participa**.
   La petición solo lleva fechas, ningún dato del usuario.
2. **Dónde se guarda: pestaña oculta `_TipoCambio`** en la Sheet del usuario, una fila por día con dato:
   `fecha | usd_compra | usd_venta | eur_venta | fuente | leido_en`. `fuente` = `bcrp` o `er-api`.
   - Ventana de cada lectura: desde el último día guardado (o 30 días atrás si está vacía) hasta hoy, en una sola
     llamada con las tres series.
   - **Histórico bajo demanda**: si hay movimientos en USD anteriores al primer día guardado (importación
     histórica), la misma pasada pide el rango que falta. Es una llamada por rango, no por movimiento.
   - Una fila `bcrp` reemplaza a una `er-api` del mismo día; nunca al revés.
3. **Cómo se lee la API del BCRP** (lecciones de S8):
   - Éxito = **el cuerpo es JSON válido** con `periods`. El status HTTP no sirve para detectar el desafío.
   - Hasta 3 intentos con espera creciente (1,5 s, 3 s); si todos fallan, una llamada a
     `open.er-api.com/v6/latest/USD` guarda **solo el día de hoy** con `fuente = er-api` (venta = compra = tipo
     medio; EUR por cruce PEN/EUR).
   - Se descartan los `n.d.`; las fechas `DD.Mmm.YY` se leen con los meses abreviados en español.
   - Nunca lanza: un fallo deja `fx.lastError` en `Ajustes` y el escaneo sigue.
4. **Qué tipo se aplica a un movimiento en USD**, en este orden:
   1. el `tipo_cambio` del correo (lo que cobró el banco; sigue siendo la verdad);
   2. si `Ajustes.fx.modo = manual`, el valor fijo `fx.usd_pen`;
   3. la **venta** de `_TipoCambio` del día del movimiento o, si ese día no tiene dato, del último día anterior que
      lo tenga;
   4. el último valor de `_TipoCambio`, si el movimiento es más reciente que el último dato publicado;
   5. `fx.usd_pen` (3.50), si `_TipoCambio` está vacía.

   Se usa la **venta** porque es la referencia del MEF/SUNAT y lo que paga quien compra dólares para pagar una
   tarjeta. La conversión **sigue haciéndose al mostrar** (como en ADR-005): `Movimientos` no se reescribe y
   `tipo_cambio` sigue significando "lo trajo el correo". Como cada movimiento usa el tipo de **su** fecha, los
   meses pasados ya no cambian cuando se mueve el dólar.
5. **Ajustes**:
   - `fx.modo` = `auto` (por defecto) | `manual`. Al actualizar la librería, si `fx.usd_pen` es distinto del 3.50 por
     defecto, se pone `manual` para respetar a quien ya lo había fijado.
   - `fx.usd_pen` queda como valor manual y como último respaldo.
   - Telemetría (no editar a mano): `fx.ultimo` (fecha y venta del último dato), `fx.fuente`, `fx.lastRunAt`,
     `fx.lastError`.
6. **Quién consume `_TipoCambio`**: la web (`apps/web/src/lib`, una lectura más de rango junto con `Ajustes`), el
   dashboard del Sheet (`dashboard-runtime.js`) y el MCP (`mcp-runtime.js`). Los tres aplican el mismo orden del
   punto 4, cada uno con su implementación, cubierta por tests con los mismos casos.
7. **Visible para el usuario**: en Ajustes de la web, "Tipo de cambio: S/ 3.437 por US$ · BCRP (sistema bancario
   SBS), 06-oct" con el interruptor automático/manual. Si el dato vino de open.er-api se muestra "Rates By Exchange
   Rate API" con enlace (condición de su nivel gratuito).
8. **EUR**: se guarda `eur_venta` desde ya (sale en la misma llamada), pero los parsers, el extractor LLM (ADR-008)
   y `Movimientos` siguen aceptando solo PEN/USD. Aceptar movimientos en EUR es otra decisión.

## Alternativas descartadas
- **Leer la API desde el navegador**: el BCRP no admite CORS. open.er-api sí, pero no da histórico ni tipo
  bancario.
- **Proxy con caché en el Worker** (`mcp.lucaa.lat`): funcionaría y Cloudflare no tiene el problema de Imperva con
  IPs de Google, pero añade una dependencia de nuestra infraestructura a cada copia, y un dato público no lo
  justifica. Queda como plan B si Imperva empieza a bloquear a Google de forma sistemática.
- **Escribir el tipo en `tipo_cambio` al registrar cada movimiento**: daba la misma estabilidad histórica, pero
  reescribe el ledger, mezcla el tipo del banco con el del BCRP en una columna y obliga a migrar las filas viejas.
- **APIs peruanas con token** (apis.net.pe/Decolecta, MIGO): un secreto más que custodiar para el mismo dato.
- **Scraping de la pizarra de cada banco**: frágil y probablemente contra sus términos.

## Consecuencias
- Cero configuración nueva para el usuario final; las copias existentes lo reciben al actualizar la librería
  (ADR-006 §5). Hasta entonces siguen con `fx.usd_pen`.
- Una llamada HTTP al día por copia (más el histórico una vez). Cuota de URL Fetch consumer: 20.000/día; irrelevante.
- Dependemos de que el BCRP mantenga el formato y de que Imperva siga dejando pasar a Google. Si se rompe, el
  respaldo y el valor manual mantienen la conversión, y `fx.lastError` lo deja visible.
- Los totales de meses pasados **cambian una vez** al activar esto (pasan de 3.50 al tipo real de cada día). Hay que
  decirlo en las notas de la versión.
- Pendiente de verificar: los términos de uso de BCRPData (la página de condiciones no se pudo leer). Por prudencia
  se cita "Fuente: BCRP".

## Plan de implementación (resumen)
1. `gas/shared/fx-runtime.js` (nuevo; añadirlo a `RUNTIME_FILES`): lectura del BCRP con validación, reintento y
   respaldo; parseo de fechas; escritura en `_TipoCambio`; `tipoCambioPara_(fecha)`. Tests con respuestas
   sintéticas: JSON correcto, desafío HTML con 200, `n.d.`, feriado, respaldo, histórico.
2. `runDispatcher` llama a `actualizarTipoCambio_`; defaults y migración de `fx.modo` en `settings-runtime.js`.
3. `mcp-runtime.js` y `dashboard-runtime.js` usan el orden del punto 4.
4. Web: leer `_TipoCambio`; `toBase` recibe una función de tipo por fecha en vez de un número; Ajustes muestra la
   fuente, el interruptor y la atribución condicional.
5. Release con `/deploy-luca` y nota de que los totales de meses pasados se recalculan.
