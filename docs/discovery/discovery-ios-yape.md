# Discovery: Captura automática de movimientos de Yape usando iOS Shortcuts

## Contexto

Uno de los principales problemas para automatizar el control de gastos con Yape es que Yape no ofrece una API pública orientada a obtener movimientos personales en tiempo real.

Además, las notificaciones por correo de Yape tienen ciertas restricciones. Para yapeos enviados, el monto mínimo configurable para recibir un correo es actualmente de **S/10**.

Esto deja fuera movimientos pequeños como:

- S/1
- S/3.50
- S/5
- S/8

También existe el problema de capturar automáticamente los **yapeos recibidos**, ya que estos no necesariamente generan un correo que pueda ser procesado mediante Gmail + Apps Script.

Durante el discovery se encontró una alternativa interesante utilizando las capacidades de automatización de **iOS Shortcuts**.

---

# Hipótesis

Utilizar las notificaciones push de Yape como fuente de eventos financieros.

La idea consiste en interceptar una notificación de Yape desde una automatización de iOS y enviar su contenido hacia un endpoint de Google Apps Script.

Esto permitiría registrar automáticamente movimientos financieros en Google Sheets sin depender de:

- API oficial de Yape
- backend propio
- Cloud Run
- servidores persistentes
- polling continuo
- scraping de la aplicación
- infraestructura administrada por Luca

---

# Arquitectura propuesta

```text
┌──────────────────────────┐
│          Yape            │
└────────────┬─────────────┘
             │
             │ Push Notification
             ▼
┌──────────────────────────┐
│         iPhone           │
│                          │
│      iOS Shortcuts       │
└────────────┬─────────────┘
             │
             │ HTTP POST
             ▼
┌──────────────────────────┐
│ Google Apps Script       │
│ Web App / doPost()       │
└────────────┬─────────────┘
             │
             │ Parse + Normalize
             ▼
┌──────────────────────────┐
│      Google Sheets       │
│       Luca Ledger        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        Luca MCP          │
└────────────┬─────────────┘
             │
      ┌──────┼───────┐
      ▼      ▼       ▼
   Claude  Gemini  ChatGPT
```

---

# Flujo

## 1. Yape genera una notificación

Por ejemplo:

```text
Juan te yapeó S/20
```

o:

```text
Yapeaste S/12.50 a María
```

La notificación contiene potencialmente información suficiente para reconstruir la transacción.

Dependiendo del contenido expuesto por Yape, podríamos obtener:

```text
App
Title
Subtitle
Body
Timestamp
```

---

# 2. iOS Shortcuts detecta la notificación

La automatización se configura para reaccionar cuando llega una notificación de:

```text
App = Yape
```

Conceptualmente:

```text
When notification arrives
        ↓
Application = Yape
        ↓
Execute Shortcut
```

El Shortcut recibe el contenido de la notificación.

---

# 3. Extracción de información

Ejemplo de notificación:

```text
Yapeaste S/3.50 a Juan Pérez
```

Podría convertirse inicialmente en:

```json
{
  "source": "yape",
  "raw_notification": "Yapeaste S/3.50 a Juan Pérez",
  "timestamp": "2026-10-04T02:30:00-05:00"
}
```

No es estrictamente necesario hacer todo el parsing desde el iPhone.

Una mejor alternativa sería enviar el mensaje raw hacia Apps Script.

---

# 4. Envío hacia Google Apps Script

El Shortcut utiliza una acción similar a:

```text
Get Contents of URL
```

con método:

```text
POST
```

hacia un Web App de Apps Script.

Ejemplo:

```text
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

Payload:

```json
{
  "source": "yape",
  "message": "Yapeaste S/3.50 a Juan Pérez",
  "device": "ios",
  "timestamp": "2026-10-04T02:30:00-05:00"
}
```

---

# 5. Apps Script procesa la transacción

Apps Script recibe el request mediante:

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents);

  // Parse notification
  // Normalize transaction
  // Store in Google Sheets

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

# 6. Parsing de movimientos

## Caso: egreso

Input:

```text
Yapeaste S/12 a María
```

Resultado:

```json
{
  "type": "expense",
  "amount": 12,
  "currency": "PEN",
  "counterparty": "María",
  "source": "yape"
}
```

---

## Caso: ingreso

Input:

```text
María te yapeó S/20
```

Resultado:

```json
{
  "type": "income",
  "amount": 20,
  "currency": "PEN",
  "counterparty": "María",
  "source": "yape"
}
```

---

# 7. Persistencia en Google Sheets

La información podría almacenarse inicialmente utilizando una tabla como:

| Timestamp | Tipo | Monto | Moneda | Persona | Fuente | Categoría |
|---|---|---:|---|---|---|---|
| 2026-10-04 02:30 | expense | 12.00 | PEN | María | Yape | Pendiente |
| 2026-10-04 03:14 | income | 20.00 | PEN | Juan | Yape | Transferencia |

---

# Principal ventaja

El principal descubrimiento es que esta arquitectura permite capturar potencialmente movimientos menores al límite de correo de Yape.

Por ejemplo:

```text
S/1
S/2
S/3.50
S/5
```

Ya no dependemos de:

```text
Yape
  ↓
Email
  ↓
Gmail
```

sino de:

```text
Yape
  ↓
Push Notification
  ↓
iOS Shortcuts
  ↓
Apps Script
```

Por lo tanto, el umbral de **S/10** configurado por Yape para notificaciones por correo deja de ser relevante.

---

# Captura de ingresos

Otro beneficio importante es la posibilidad de capturar **dinero recibido**.

Actualmente, los ingresos recibidos mediante Yape pueden generar una notificación push.

Si dicha notificación contiene información como:

```text
Juan te yapeó S/25
```

Luca podría registrarla automáticamente como:

```json
{
  "type": "income",
  "amount": 25,
  "counterparty": "Juan"
}
```

Esto permitiría construir un ledger bastante completo de movimientos Yape.

---

# Uso de iPhone como Event Listener

Una forma útil de pensar esta arquitectura es considerar al iPhone como un pequeño:

```text
Financial Event Listener
```

El teléfono ya recibe los eventos financieros.

Luca simplemente reutiliza ese flujo:

```text
Financial App
     ↓
Push Notification
     ↓
iPhone
     ↓
Shortcut
     ↓
Luca
```

Esto evita integrar individualmente cada aplicación financiera mediante