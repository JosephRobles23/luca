# Research: APIs gratuitas de tipo de cambio (USD, PEN, EUR) para Luca

- Fecha: 2026-10-09
- Contexto: hoy los movimientos en USD sin tipo de cambio en el correo se convierten con `Ajustes.fx.usd_pen`, un
  valor fijo (3.50 por defecto) que el usuario edita a mano (ADR-005). Se busca una fuente **gratuita, sin token y
  confiable** del tipo de cambio real (idealmente el bancario peruano) para que la conversión no dependa de un número
  fijo. Restricciones de Luca: nada de secretos nuevos que custodiar, nada que el usuario final configure, y los datos
  del usuario no salen de su Google (ADR-006).
- Método: documentación oficial de cada proveedor y **llamadas reales** desde esta máquina (2026-10-08) y desde Apps
  Script con `UrlFetchApp` (spike S8, 2026-10-09). Lo no confirmado se marca **no verificado**.

---

## TL;DR

| Fuente | Qué da | Token | CORS (navegador) | Histórico | Veredicto |
|---|---|---|---|---|---|
| **BCRP – BCRPData API** (oficial) | Tipo de cambio del **sistema bancario SBS**: USD compra/venta, EUR venta. Diario | No | **No** (sin `Access-Control-Allow-Origin`) | Sí, por rango de fechas | **Fuente principal**, leída desde LucaLib |
| **open.er-api.com** (ExchangeRate-API, nivel abierto) | Tipo medio de mercado, ~160 monedas, 1 vez al día | No | Sí (`*`) | No (solo `latest`) | **Respaldo** |
| fawazahmed0/currency-api (jsDelivr) | Tipo medio diario | No | Sí | Por fecha en la ruta | Alternativa de respaldo; proyecto comunitario sin SLA |
| Frankfurter (BCE) | Tipo de referencia del BCE | No | Sí | Sí | **No sirve**: no publica PEN |
| apis.net.pe/Decolecta, MIGO, eApi | Copias de las páginas de SBS/SUNAT | **Sí** | No (Decolecta: CORS deshabilitado) | Sí | Descartadas: token = secreto a custodiar |
| Pizarra de cada banco (BCP, etc.) | Tipo propio del banco | — | — | — | **No existe API pública**; scraping frágil y contra términos probables. Lo más cercano: el tipo que el banco ya pone en el correo (`tipo_cambio`) |

---

## BCRP – BCRPData

- Estructura: `https://estadisticas.bcrp.gob.pe/estadisticas/series/api/[códigos]/[formato]/[inicio]/[fin]/[idioma]`.
  Solo el código es obligatorio; de 1 a 10 códigos separados por guion, todos de la misma frecuencia; formatos
  `json`, `jsonp`, `xml`, `csv`, `txt`, `xls`, `html`; idioma `esp`/`ing`. "Solo es necesario utilizar correctamente
  los parámetros y contar con acceso a Internet" (sin login ni key)
  ([API para desarrolladores](https://estadisticas.bcrp.gob.pe/estadisticas/series/ayuda/api);
  [guía PDF](https://estadisticas.bcrp.gob.pe/estadisticas/series/documentos/bcrpdataapi.pdf)).
- Series diarias útiles (códigos terminados en `PD`):
  - `PD04639PD` — TC Sistema bancario SBS (S/ por US$) – Compra
  - `PD04640PD` — TC Sistema bancario SBS (S/ por US$) – **Venta** (la que usa el MEF como referencia:
    [MEF](https://www.mef.gob.pe/bda/index.php/actualizacion-del-valor/datos);
    [serie](https://estadisticas.bcrp.gob.pe/estadisticas/series/diarias/resultados/PD04640PD))
  - `PD04648PD` — TC Euro (S/ por Euro) – Venta
  - `PD04638PD` — interbancario venta (no se usa: el usuario paga al tipo bancario)
- Formato de fecha en la URL para series diarias: `YYYY-M-D` sin ceros (probado: `2026-9-28`).
- Respuesta real (2026-10-08):
  ```json
  {"config":{"title":"Tipo de cambio","series":[{"name":"… - Compra","dec":"3"}, …]},
   "periods":[{"name":"06.Oct.26","values":["3.431","3.437","3.879"]},
              {"name":"07.Oct.26","values":["n.d.","n.d.","n.d."]}]}
  ```
  - `name` del periodo = `DD.Mmm.YY` con **mes abreviado en español** (`Set`, `Oct`, …). Valores como **texto**.
  - Días sin dato (fines de semana, feriados, y los 1–3 días hábiles más recientes) llegan como `"n.d."` o no
    aparecen.
  - `Content-Type: text/html` aunque el cuerpo sea JSON.
- Detrás de **Imperva** (`x-cdn: Imperva`, cookies `visid_incap_*`/`incap_ses_*`). Sin `Access-Control-Allow-Origin`:
  **no se puede llamar desde el navegador**.
- Términos de uso: la página de condiciones no devolvió contenido estático; **no verificado**. Son estadísticas
  públicas del banco central; citar la fuente ("Fuente: BCRP") es lo prudente.

### Spike S8: `UrlFetchApp` desde las IPs de Google (ver `spikes/README.md`)
- Corrida 1, 6 llamadas sueltas sin reintento: 4 JSON y **2 desafíos de Imperva**. El desafío llega como
  **HTTP 200 con HTML** (un `<script src="/…">` de Imperva), y uno de ellos **no contenía** "Incapsula".
- Corrida 2, 20 rondas de hasta 4 intentos (10 sin cookies y 10 reenviando las cookies de Imperva): **20/20 a la
  primera**.
- Total: 25 de 27 llamadas OK (~7 % de desafío), ninguna ronda perdida. Latencia típica 200–600 ms (un pico de 3 s).
- Conclusión: viable desde LucaLib **validando que el cuerpo sea JSON** (no fiarse del status), con reintento con
  espera y respaldo. Reenviar cookies no aporta.

## open.er-api.com (ExchangeRate-API, nivel abierto)
- `GET https://open.er-api.com/v6/latest/USD`, "No API Key", "Updates Once Per Day"; con límite de tasa sin cifra,
  pero "you could still request once every hour and never get rate limited"; al pasarse, 429 durante 20 min
  ([docs](https://www.exchangerate-api.com/docs/free)).
- Uso comercial permitido; se puede cachear; **no se puede redistribuir** el feed.
- **Exige atribución** en la página que muestre las tasas: `<a href="https://www.exchangerate-api.com">Rates By
  Exchange Rate API</a>` (puede ser discreta).
- Solo `latest`: **sin histórico** en el nivel abierto.
- Probado 2026-10-08: CORS `*`; USD→PEN 3.4433, USD→EUR 0.8929 (EUR→PEN por cruce ≈ 3.856). Es tipo medio de
  mercado: queda entre la compra y la venta bancarias (3.431 / 3.437 del 06-oct).

## Otras
- **fawazahmed0/currency-api** vía jsDelivr
  (`cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json`): sin token, probado 2026-10-08,
  USD→PEN 3.4399. Proyecto comunitario, sin garantías.
- **Frankfurter** (`api.frankfurter.dev`): datos del BCE, sin token, CORS `*`; probado con `symbols=PEN,EUR` →
  **solo devolvió EUR**. El BCE no publica PEN.
- **Terceros peruanos con token** ([apis.net.pe](https://apis.net.pe/api-tipo-cambio-sbs.html),
  [Decolecta](https://decolecta.com/services/4-api-tipo-de-cambio-sbs.html),
  [MIGO](https://docs.migo.pe/v2/tipo-de-cambio/tipo-de-cambio-sbs),
  [eApi](https://docs.e-api.net.pe/free/tipo-cambio.html)): toman los datos de las páginas de la SBS
  ([SBS](https://www.sbs.gob.pe/estadisticas/tipo-de-cambio)). Añaden un token que habría que custodiar y no
  aportan nada sobre el BCRP.

## Implicaciones para Luca
1. La lectura va en **LucaLib** (`UrlFetchApp`, scope `script.external_request` que el stub ya declara): el BCRP no
   admite CORS y así no se toca nuestra infraestructura. La petición no lleva datos del usuario, solo fechas.
2. Hay que tolerar el desafío intermitente de Imperva, los `n.d.` y el retraso de 1–3 días.
3. Si se muestra un tipo que vino de open.er-api, la web debe poner la atribución.
4. Decisión en [ADR-012](../architecture/adr-012-tipo-de-cambio-automatico.md).
