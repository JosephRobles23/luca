# Discovery: formatos de correos BCP y Yape

Fuente: capturas reales de Gmail en `docs/img/Screenshot_1.png` … `Screenshot_7.png` (oct 2026).
Datos personales reemplazados por placeholders (`<NOMBRE>`, `****1234`, etc.).

> Siguiente paso: exportar 2–3 correos reales de cada tipo como `.eml` (Gmail → ⋮ → "Descargar mensaje"),
> anonimizarlos y guardarlos en `tests/fixtures/` para escribir los parsers contra el HTML real.

---

## Remitentes

| Remitente | Dirección | Uso |
|---|---|---|
| BCP Notificaciones | `notificaciones@notificacionesbcp.com.pe` | Transaccional ✅ |
| YAPE Notificaciones | `notificaciones@yape.pe` | Transaccional ✅ |
| Notificaciones Pay-me | (no visible en captura) | Pasarela de pago — **duplica** cargos ya notificados por BCP |
| `dte_<RUC>@pap…` | — | Boleta electrónica (DTE), p.ej. de YAPE MARKET — **duplica** la constancia de Yape |
| BCP Comunica / Yape | — | Marketing ❌ ignorar |

Query Gmail inicial:

```text
from:(notificaciones@notificacionesbcp.com.pe OR notificaciones@yape.pe) after:<último_procesado>
```

**Gotcha:** Gmail agrupa varios correos en un mismo hilo ("BCP Notificaciones 4"). Hay que iterar
**mensajes**, no hilos, y deduplicar por `messageId`.

---

## Catálogo de tipos

### BCP

| # | Asunto | Frase clave del cuerpo | Tipo Luca |
|---|---|---|---|
| B1 | `Realizaste un consumo con tu Tarjeta de Débito BCP - Servicio de Notificaciones BCP` | `Realizaste un consumo de S/ 53.30 con tu Tarjeta de Débito BCP en CA012 AVIACION.` | `expense` |
| B2 | `Constancia de Transferencia Entre mis Cuentas - Servicio de Notificaciones BCP` | `Realizaste una transferencia de S/ 57.95 desde tu Clasica.` | `internal_transfer` (no es gasto) |
| B3 | `Realizaste un retiro de tu wardadito.` | `Realizaste un retiro de S/ 10.00 en tu wardadito Ahorro libre.` | `internal_transfer` |
| B4 | `Constancia de Pago con QR - Servicios de Notificaciones BCP` | `Realizaste un yapeo a celular de S/ 2.00 desde tu Clasica Soles.` | `expense` (P2P) |
| B6 | `Realizaste un retiro en un Agente BCP - Servicio de Notificaciones BCP` | `Realizaste un retiro de S/ 60.00 con tu Tarjeta de Débito BCP en un Agente BCP.` | `expense`, canal `cash_withdrawal` → categoría "Retiro de Agente" (regla) |
| B5 | `Se rechazó tu compra por fondos insuficientes - Servicio de Notificaciones BCP` | `tu compra fue rechazada debido a que tu cuenta no tiene saldo suficiente` | `rejected` (no registrar; opcional alerta) |

Nota: en B4 hay un yapeo de **S/ 2.00** con correo. Los pagos con QR / yapeos desde la app BCP
parecen no tener el umbral de S/10 de Yape. Hay que confirmarlo con más muestras.

**Campos B6 (retiro en Agente BCP):** etiqueta y valor en filas separadas: `Monto retirado`, `Comisión por operación`
(`GRATIS`), `Operación realizada` (`Retiro`), `Fecha y hora` (`19 de septiembre de 2026 - 16:45 PM`: hora de 24 h
con un `PM` sobrante), `Número de Tarjeta de Débito`, `Cuenta de cargo`, `Canal` (`Agente BCP`), `Código de agente`,
`Número de operación`. Aún no hay muestra del retiro en cajero automático.

**Campos B1 (consumo con débito):** tabla de pares etiqueta → valor

| Etiqueta | Ejemplo |
|---|---|
| Total del consumo | `S/ 53.30` · `$ 3.86` (**dos monedas**) |
| Operación realizada | `Consumo Tarjeta de Débito` |
| Fecha y hora | `02 de octubre de 2026 - 09:06 PM` |
| Número de Tarjeta de Débito | `************1234` |
| Empresa | `CA012 AVIACION` · `APPLE.COM/BILL` · `DLC*SPOTIFY` · `Amazon web services` · `YAPE` |

**Campos B2 (transferencia entre mis cuentas):**

| Etiqueta | Ejemplo |
|---|---|
| Monto transferido | `S/ 57.95` |
| Tipo de cambio | `S/ 3.4090` |
| Total cobrado al tipo de cambio | `$ 17.00` |
| Operación realizada | `Transferencia entre mis cuentas` |
| Fecha y hora | `02 de Octubre de 2026 - 02:58 PM` (mayúscula) |
| Desde / Enviado a | `Clasica **** 1234` |

### Yape

| # | Asunto | Tipo Luca |
|---|---|---|
| Y1 | `Por tu seguridad, te notificaremos por cada yapeo que realices` | `expense` (P2P enviado) |
| Y2 | `Tu yapeo de servicio ha sido confirmado` | `expense` (pago de servicio) |
| Y3 | `Tu recarga en Yape ha sido confirmada` | `expense` (recarga celular) |
| Y4 | `Envío Automático - Constancia de Transferencia - Yape` | `expense` (p.ej. compra Yape Promos) |

**Campos Y1 (yapeo enviado):**

| Etiqueta | Ejemplo |
|---|---|
| Monto de yapeo* | `S/ 10.00` |
| Yapero | `<Nombre> <Ap>*` (enmascarado) |
| Tu número de celular | `XXXXXXXXX623` |
| Fecha y Hora de la operación | `04 octubre 2026 - 02:35 a. m.` |
| Celular del Beneficiario | `XXXXXXXXX261` |
| Nombre del Beneficiario | `Nombre Ape*` (**truncado + asterisco**) |
| Nº de operación | `3316121` |

**Campos Y2 (yapeo de servicio):** `Monto total`, `Yapero(a)`, `Número de celular`,
`Fecha y hora: 15 Set, 2026 - 08:20 pm`, `Nº de operación Yape`, y un bloque **Detalle del servicio**
con `Empresa` (`Metropolitano y Corredores`, `Universidad Nacional de Ingeniería`), `Servicio`
(`Recarga de Tarjetas`, `Pago Estudiantes`) y `Código de usuario`.
Se puede categorizar con reglas, sin LLM: Metropolitano → Transporte, Universidad → Educación.

**Campos Y3 (recarga):** `Nº de operación`, empresa + RUC (`AMERICA MOVIL PERU S.A.C. RUC: 20467534026`),
`Nro Control`, `Recarga Efectiva: S/ 6.0`.

**Campos Y4:** `Monto total: S/ 27.80`, `Fecha y hora: 24 may. 2026 - 02:41 p. m.`

### Lo que **no** aparece

- **Yapeos recibidos (ingresos):** no hay ningún correo. Esto confirma el hueco que describe `discovery-ios-yape.md`.
- **Yapeos enviados menores a S/10:** no llegan desde Yape (umbral), aunque sí desde la app BCP (B4).

---

## Implicancias para el parser

1. **Clasificar por remitente + asunto** (estable) y después extraer del cuerpo. Los asuntos de BCP
   llevan el sufijo `- Servicio(s) de Notificaciones BCP`; hay que aceptar ambas variantes (singular y plural).
2. **Extractor genérico de pares etiqueta → valor.** Ambos bancos renderizan tablas de 2 columnas, así
   que es más robusto convertir el HTML en filas `{label: value}` y mapear etiquetas por tipo que
   escribir una regex por frase. Usar la frase destacada (`Realizaste un consumo de … en …`) solo como respaldo.
3. **Fechas: al menos 4 formatos distintos.**
   - `02 de octubre de 2026 - 09:06 PM`
   - `02 de Octubre de 2026 - 02:58 PM`
   - `04 octubre 2026 - 02:35 a. m.`
   - `15 Set, 2026 - 08:20 pm` (`Set` = septiembre en Perú)
   - `24 may. 2026 - 02:41 p. m.`

   El parser debe ser insensible a mayúsculas, aceptar `de` opcional, abreviaturas con o sin punto
   y `AM/PM/a. m./p. m.`. Zona horaria `America/Lima`. Si falla, usar la fecha interna del mensaje de Gmail.
4. **Moneda:** `S/` → PEN, `$` → USD. Guardar `amount`, `currency` y, si existe, `fx_rate`.
   El dashboard convierte a PEN para los totales.
5. **Transferencias internas fuera de los gastos:** B2, B3 y probablemente B1 con `Empresa = YAPE`
   (recarga de Yape con tarjeta) son movimientos entre cuentas propias. Si se cuentan, se duplica el gasto.
6. **Deduplicación entre fuentes:**
   - Pago con Yape vía Pay-me ↔ BCP B1 (misma tarjeta `****1234`)
   - DTE de YAPE MARKET ↔ Yape Y4
   - Yape Y1 ↔ evento push del iPhone (para montos ≥ S/10)

   Clave: `monto + moneda + |Δt| ≤ 5 min`; preferir la fuente con más campos.
   Además, usar `Nº de operación` como clave natural cuando exista.
7. **Contrapartes enmascaradas:** `Nombre Ape*` + `XXXXXXXXX261` → clave de contraparte
   `nombre ape|261`. Sirve para la tabla aprendida persona → categoría.
8. **Categorización sin LLM primero:** Y2/Y3 ya traen empresa y servicio. Comercios como `DLC*SPOTIFY` o
   `APPLE.COM/BILL` se resuelven con reglas y caché. El LLM queda solo para comercios nuevos.
9. **Privacidad:** guardar solo los últimos 4 dígitos de la tarjeta y los últimos 3 del celular; no guardar el nombre completo del titular.

## Esquema normalizado propuesto (fila en `Gastos`)

```json
{
  "id": "bcp:176424",
  "source": "bcp_email",
  "kind": "expense",
  "amount": 53.30,
  "currency": "PEN",
  "occurred_at": "2026-10-02T21:06:00-05:00",
  "merchant": "CA012 AVIACION",
  "counterparty_key": null,
  "instrument": "debito ****1234",
  "category": null,
  "category_source": null,
  "gmail_message_id": "<id>",
  "raw_subject": "Realizaste un consumo con tu Tarjeta de Débito BCP - …"
}
```
