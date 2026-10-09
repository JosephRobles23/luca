# ADR-005 — Modelo de movimientos: tipos, P2P y multi-moneda

Fecha: 2026-10-04 · Estado: **aceptado**

## Tipos (`tipo` en `Movimientos`)
| tipo | Qué es | KPI donde cuenta |
|---|---|---|
| `expense` | Consumos, servicios, yapeos enviados, pagos QR | Gastos |
| `income` | Sueldo, abonos, lo que el usuario marque como ingreso | Ingresos |
| `transfer_in` | **Yapeo recibido** (push) | Tarjeta aparte "Recibido por Yape"; **no** infla Ingresos |
| `internal_transfer` | Entre cuentas propias, wardadito, recarga de Yape con tarjeta | Ninguno (se muestra en la lista, atenuado) |
| `rejected` | Compras rechazadas | No se registra (solo `_Procesados`) |

- Yapeo **enviado** = `expense` por categorizar; el usuario puede marcarlo "Transferencias" (y queda aprendido para esa contraparte).
- Consumo con Empresa = `YAPE` entra como `expense` con flag `possible_yape_duplicate` hasta tener `.eml` reales que confirmen el caso.
- Supuesto pendiente de verificar en el buzón del usuario: **BCP no envía correo por abonos**. Si es así, `income` nace solo de la carga manual (campo de sueldo recurrente) y la UI lo declara ("Ingresos registrados a mano").

## Multi-moneda
> La conversión (segundo punto) la sustituye [ADR-012](adr-012-tipo-de-cambio-automatico.md): tipo de cambio diario del BCRP.

- Se guardan siempre `monto` y `moneda` originales (PEN/USD) y `tipo_cambio` si el correo lo trae.
- Conversión **solo al mostrar**: (1) tipo de cambio del propio correo, (2) si no, `Ajustes.fx.usd_pen` (3.50 por defecto, editable). Tipo de cambio diario (SUNAT/API) en v1.

## Identidad y dedupe
- `id` = `bcp:<nº operación>` / `yape:<nº operación>` / `push:<id del atajo>` / `manual:<uuid>`.
- Dedupe en el ledger por `id` y `gmail_id`; entre canales por clave difusa `moneda|monto|minuto` (push ↔ correo).
- Contrapartes P2P: `contraparte_key = nombre_truncado|últimos 3 dígitos`.
