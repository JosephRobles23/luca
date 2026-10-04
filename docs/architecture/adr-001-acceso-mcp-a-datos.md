# ADR-001 — ¿Cómo llega el servidor MCP a los datos del usuario?

Fecha: 2026-10-04. Estado: **propuesto** (pendiente de /wayfinder y de los spikes S1–S4).

## Contexto

El MCP corre en nuestro Worker (Cloudflare) y debe responder tool calls de Claude/ChatGPT con datos que viven en el Sheet, la wiki en Drive y Gmail del usuario. Restricción fijada por producto: **la lógica de negocio (parsers, categorización, agregaciones, wiki, LLM) corre en el Apps Script del usuario**, para que el procesamiento ocurra dentro de su Google.

Precisión importante sobre la promesa de privacidad: cualquier dato que el usuario *pida* a su IA sale de Google hacia Claude/ChatGPT pasando por nuestro Worker; eso es inherente al MCP. Lo que sí podemos prometer y auditar es:

1. **Reposo:** los datos solo se guardan en el Google del usuario.
2. **Procesamiento:** todo cálculo con sus movimientos ocurre en su Apps Script.
3. **Tránsito:** el Worker es un relevo sin estado; no registra payloads.
4. **Credenciales:** qué guardamos nosotros y qué podríamos hacer con ello si nos comprometen. Aquí es donde las tres opciones difieren de verdad.

## Opciones

### A — Worker → Web App `/exec` del usuario (modelo CoS-Agent / Vera-MCP)

El usuario despliega su copia como Web App ("Ejecutar como: yo", "Acceso: cualquiera"). El Worker guarda `execUrl` + un secreto por tenant y llama `POST /exec?mcp=1 {op, secret, args}`. El Apps Script despacha `op` contra una lista blanca y responde JSON.

| Pros | Contras |
|---|---|
| Toda la lógica en Apps Script: Sheet, Gmail, Drive/wiki y LLM accesibles con los scopes del propio usuario. **Única opción compatible con la restricción de producto.** | **Despliegue manual del Web App** (~8 clics en el editor de Apps Script: Implementar → Nueva implementación → App web → Yo / Cualquiera → Autorizar → copiar URL → pegar en el sidebar). Fue el paso más difícil del onboarding de CoS. No se puede automatizar sin que el usuario active la Apps Script API y conceda `script.deployments` (y aun así la autorización inicial es manual). |
| Nosotros no guardamos ningún token de Google. Si nuestra D1 se filtra, el atacante solo puede invocar las ops de la lista blanca, y el usuario lo corta **desde su lado** ("Desconectar" borra el secreto en su `PropertiesService`; o desactiva la implementación). | **Cada actualización de LucaLib que cambie la versión fijada en el stub exige que el usuario cree una nueva versión de su implementación** (Administrar implementaciones → Editar → Versión nueva). La URL no cambia, pero es fricción recurrente. Cambios de scope además obligan a reautorizar. |
| Código ya escrito y probado: `mcp-runtime.js`, `gasClient.ts`, challenge HMAC, pairing, tools. | Latencia 1–4 s por llamada (arranque de GAS + redirección 302). Aceptable para tool calls, incómodo para UI web. |
| El `sheetId` nunca viaja: queda implícito en la URL `/exec`. | El `/exec` es una URL pública protegida solo por el secreto en el body (GAS no expone headers). Mitigable con firma HMAC + timestamp anti-replay. |
| Lista blanca de ops auditable por el usuario (está en su propio script). | Cuotas de GAS: 30 ejecuciones simultáneas por usuario, 6 min por ejecución. Suficiente para uso personal. |

**Revocación:** el usuario, sin depender de nosotros. **Superficie si nos comprometen:** solo las ops expuestas, y hasta que el usuario desconecte.

### B — Worker → Sheets API con refresh token `drive.file` del usuario

Al crear o elegir el Sheet desde la web, pedimos acceso offline con `drive.file`. El Worker guarda el refresh token cifrado y lee/escribe la Sheet directamente.

| Pros | Contras |
|---|---|
| **Cero pasos manuales:** el login en la web ya alcanza. No hay Web App ni redeploys. | **Incompatible con la restricción de producto:** agregaciones, dedupe de escrituras y validaciones tendrían que reimplementarse en el Worker, es decir, los movimientos se procesan fuera del Google del usuario. |
| Latencia 200–500 ms. | **No llega a Gmail, ni a la wiki en Drive, ni al LLM del usuario**: esos scopes pertenecen al cliente OAuth del script del usuario, no al nuestro. `search_wiki`, `import_emails`, `propose_import` con categorización… no serían posibles por esta vía. |
| Independiente de cuotas y arranques de GAS. | **Custodiamos un token de Google.** Cifrado y limitado a `drive.file`, pero si nuestra D1 + clave se filtran, un atacante lee y escribe la Sheet **sin que el usuario haga nada y sin pasar por ninguna lista blanca**. Es exactamente lo contrario de la confianza que queremos transmitir. |
| | Revocar depende de nosotros (borrar el token) o de que el usuario entre a la configuración de su cuenta de Google. |
| | Nuestro cliente OAuth debe estar "en producción" (en Testing los refresh tokens caducan a los 7 días). `drive.file` también abarca cualquier otro archivo que el usuario haya abierto alguna vez con nuestro Picker. |

### C — Híbrido: lecturas por Sheets API (B), Gmail/wiki/LLM/escrituras por `/exec` (A)

| Pros | Contras |
|---|---|
| El dashboard web y las tools de solo lectura funcionan antes de desplegar el Web App. | **Hereda la fricción de A** (el Web App sigue siendo obligatorio para `search_wiki`, importación y toda ingesta desde la IA) **y la custodia de token de B**. Peor de ambos mundos en confianza. |
| Lecturas rápidas. | Lógica dividida en dos runtimes: las agregaciones del dashboard tendrían que existir en el Worker o en el navegador además de en GAS. Dos fuentes de verdad para el mismo cálculo. |
| | Dos modelos de credenciales que explicar al usuario. |

### Descartadas de plano

- **`scripts.run` de la Apps Script API:** exige que el script del usuario esté ligado a un proyecto GCP estándar compartido con nuestra app → el usuario tendría que configurar GCP.
- **Cola de comandos en una pestaña del Sheet** (el Worker escribe un comando por Sheets API, un trigger `onChange` lo procesa y el Worker hace polling del resultado): latencia de segundos a minutos y sin garantías; inviable para tool calls interactivas.
- **Web App desplegado desde nuestra librería** ("ejecutar como usuario que accede"): requeriría que el usuario autorice *nuestro* cliente OAuth con `gmail.readonly` → scope restringido en un solo cliente → verificación + CASA.

## Decisión propuesta

**Opción A**, con tres medidas para que su costo no mate el onboarding:

1. **Onboarding progresivo.** El Web App no es requisito para empezar. Sin él ya funcionan: ingesta automática de correos (triggers), categorización, wiki, dashboard web (el navegador lee la Sheet con `drive.file`, sin tocar nuestro servidor) y dashboard en el Sheet. El despliegue se pide solo al pulsar **"Conectar con tu IA"**, con guía visual paso a paso y verificación automática por challenge HMAC al pegar la URL. Las órdenes de la web hacia el script (p. ej. "importar 90 días") se transmiten escribiendo en la pestaña `Ajustes` vía `drive.file`; el dispatcher las recoge en su siguiente pasada.
2. **Minimizar los redeploys.** Stub ultradelgado cuya única razón de cambio sea la versión de la librería; contrato de ops MCP estable y versionado (`op`, `v`); releases de LucaLib poco frecuentes y agrupadas; el sidebar y la web detectan "tu conexión usa LucaLib vN, hay vN+1" y muestran los 4 clics para actualizar la implementación. Spike pendiente: confirmar si hay alguna forma de que la implementación siga el HEAD del stub para no-propietarios (se asume que no).
3. **Endurecer el canal.** Además del secreto por tenant: firma HMAC del body con timestamp y nonce (ventana de 5 min) para evitar replay; lista blanca de ops con permisos por tool (lectura / escritura-con-confirmación); `Desconectar` en ambos lados; logs del Worker sin payloads.

Si los spikes muestran que la fricción del Web App es inaceptable para el público objetivo, la alternativa no es B sino **convertir el stub en un Editor Add-on** publicado, lo que elimina el despliegue manual y la actualización de copias, a costa de verificación de Google + CASA por `gmail.readonly`.

## Consecuencias

- El Worker no guarda tokens de Google de usuarios. Solo `execUrl`, hash del secreto, `sub` de Google (del pairing) y el tenant OAuth del conector.
- La web nunca lee datos a través de nuestro servidor: va directo a Sheets API desde el navegador.
- `services/luca-mcp` es un fork casi literal de `services/vera-mcp`; el trabajo nuevo está en las ops de GAS y en las tools.
- Hay que diseñar el contrato de ops con versionado desde el día 1.
- La pregunta abierta nº 4 de `arquitectura-base.md` (actualización de copias) pasa a ser prioritaria: es el costo recurrente de esta decisión.
