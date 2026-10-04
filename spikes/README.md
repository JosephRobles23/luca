# Spikes de validación (S1–S7)

Experimentos cortos que deciden la arquitectura antes de escribir producto. Ver `docs/architecture/arquitectura-base.md` §8.

Infraestructura de Luca (nuestra, no del usuario final):
- Proyecto GCP **`luca-510610`** (número `334287534871`), cuenta `gavynenita@gmail.com`.
- APIs habilitadas: Drive, Sheets, Picker.
- Cuenta de prueba "usuario final @gmail.com" para S3: cuenta Gmail personal secundaria (no la de Workspace).

Orden sugerido: **S1 → S5 → S4 → S3 → S2** (S1 decide si S2 hace falta).

---

## Configuración única en la consola GCP (manual, ~10 min)

`gcloud` no puede crear la pantalla de consentimiento ni clientes OAuth web; se hace en la consola con `gavynenita@gmail.com`:

1. **Pantalla de consentimiento** → https://console.cloud.google.com/auth/overview?project=luca-510610
   - Tipo de usuario: **Externo**. Nombre: `Luca`. Correo de soporte y de contacto: `gavynenita@gmail.com`.
   - Alcances: añadir `.../auth/drive.file` (no sensible) y los de identidad (`openid`, `email`, `profile`). **No** añadir Gmail ni Sheets completos.
   - Estado de publicación: **En producción** (en "Prueba" los refresh tokens caducan a los 7 días). Con solo scopes no sensibles no pide revisión.
2. **Cliente OAuth** → https://console.cloud.google.com/auth/clients?project=luca-510610 → Crear cliente → **Aplicación web** → nombre `Luca Web (spikes)`.
   - Orígenes de JavaScript autorizados: `http://localhost:5173`
   - URIs de redirección: (ninguna para el flujo de token en el navegador)
   - Copiar el **Client ID** (termina en `.apps.googleusercontent.com`).
3. **API key del Picker**: ya creada por `gcloud` ("Luca Picker (spikes)", restringida a Picker API). Opcional: restringirla también por referrer `http://localhost:5173/*` en https://console.cloud.google.com/apis/credentials?project=luca-510610.

---

## S1 — `files.copy` de la plantilla con solo `drive.file`

**Pregunta:** ¿la web puede crear la copia del Sheet-plantilla sin pedir scopes sensibles?

Dos formas:

- **Rápida (sin cliente propio):** [OAuth Playground](https://developers.google.com/oauthplayground) → Step 1 pegar `https://www.googleapis.com/auth/drive.file` → Authorize (con la cuenta "usuario final") → Step 2 Exchange → Step 3: `POST https://www.googleapis.com/drive/v3/files/<TEMPLATE_ID>/copy`, body `{"name":"Luca Ledger (spike)"}`.
- **Representativa (con nuestro cliente):** página `spikes/s1-s2-picker/index.html`, botón **"S1: copiar plantilla"**.

`TEMPLATE_ID` = un Sheet compartido como "Cualquiera con el enlace: Lector" (puede ser la copia de `spikes/s3-s4-gas-stub` ya ligada a un Sheet).

| Resultado | Significado |
|---|---|
| `200` + `id` nuevo | Onboarding de 1 clic. S2 solo confirma lectura. |
| `404 File not found` | Esperado según la doc: la plantilla no está "en alcance" del app. Plan B = enlace `/copy` + Picker (S2 obligatorio). |
| `403 insufficientPermissions` | Igual que 404 a efectos prácticos. |

---

## S2 — Picker + `drive.file` → lectura con Sheets API desde el navegador

**Pregunta:** si el usuario elige su copia en el Picker (lo que la mete en alcance de `drive.file`), ¿el navegador puede leerla con Sheets API sin scopes sensibles?

1. `cd spikes/s1-s2-picker && python3 -m http.server 5173`
2. Abrir http://localhost:5173, pegar Client ID, API key del Picker y App ID (`334287534871`).
3. **Autorizar** (`drive.file`) → **Elegir Sheet** (Picker) → **Leer A1:C5**.

| Resultado | Significado |
|---|---|
| Valores en pantalla | Dashboard web viable con `drive.file`. |
| `403` en Sheets API tras elegir en Picker | Falta `setAppId` correcto o el archivo no entró en alcance; si persiste, haría falta `spreadsheets.readonly` (sensible → verificación). |

---

## S3 — UX real de "Google no ha verificado esta app" en la propia copia

**Pregunta:** ¿qué ve exactamente un usuario @gmail.com al autorizar su copia con `gmail.readonly`?

1. Con `gavynenita@gmail.com`: crear un Sheet "Luca Template (spike)", Extensiones → Apps Script, pegar `spikes/s3-s4-gas-stub/Code.gs` y el `appsscript.json` (activar "Mostrar el archivo de manifiesto" en Configuración del proyecto). Compartir el Sheet como "Cualquiera con el enlace: Lector".
2. Con la **cuenta de usuario final @gmail.com** (sesión aparte/incógnito): abrir `https://docs.google.com/spreadsheets/d/<ID>/copy` → "Hacer una copia".
3. En la copia: menú **Luca (spike) → 1. Autorizar Gmail**. **Grabar la pantalla** desde aquí.
4. Anotar: número de clics, textos exactos de cada pantalla, si aparece "Avanzado → Ir a Luca (no seguro)", y si tras aceptar se muestra "OK: N mensajes".

| Resultado | Significado |
|---|---|
| Aviso "no verificada" → Avanzado → aceptar → OK | Esperado. Material para la guía visual del onboarding. |
| Bloqueo sin opción "Avanzado" | Replantear (add-on verificado). Improbable para scripts propios. |

---

## S4 — `ScriptApp.getIdentityToken()`: ¿`aud` estable por copia?

**Pregunta:** ¿podemos autenticar GAS → Worker sin secreto compartido, anclando `aud` + `sub` en el pairing?

1. En la **misma copia de S3**: menú **Luca (spike) → 2. Ver identity token** (requiere scope `openid`, ya en el manifiesto). Copiar el token del diálogo. Repetir 3 veces (minutos de diferencia).
2. Hacer una **segunda copia** del template y repetir.
3. Decodificar en local (no pegar el token en sitios web): `node spikes/s4-decode-jwt.mjs "<token>"`.

| Campo | Esperado |
|---|---|
| `iss` | `https://accounts.google.com` |
| `aud` | Igual en las 3 ejecuciones de la misma copia; **distinto** entre copias (es el client ID del proyecto por defecto de cada script). |
| `sub` | Id de la cuenta del usuario (igual en ambas copias). |
| `email` / `email_verified` | Presentes solo si el manifiesto incluye `userinfo.email`. |
| `exp - iat` | ~3600 s. |

Si `aud` cambia entre ejecuciones de la misma copia → no se puede anclar; volver a secreto compartido (modelo Vera).

---

## S5 — Escrituras KV por flujo OAuth del Worker (medir con Vera-MCP existente)

**Pregunta:** ¿cuántas escrituras KV cuesta conectar un conector y cada refresh? (Free: 1.000/día.)

Sin tocar código, sobre el `vera-mcp` desplegado de CoS-Agent:

1. Dashboard Cloudflare → Workers & Pages → KV → namespace `OAUTH_KV` → anotar **Writes** del día.
2. `cd /home/user/Projects/CoS-Agent/services/vera-mcp && npx wrangler tail vera-mcp --format pretty` en una terminal.
3. En Claude: añadir el conector (flujo completo: DCR + authorize + token). Contar requests a `/register`, `/authorize`, `/token`.
4. Dejar pasar 1–2 h de uso normal y volver a leer **Writes**.

| Resultado | Significado |
|---|---|
| ≤ 10 escrituras por conexión y ≈ 1 por refresh | Free aguanta decenas de usuarios. |
| Más | Presupuestar Workers Paid ($5/mes) o mover estado OAuth a D1/DO desde el inicio. |

---

## S6 — Parsers contra correos reales

Exportar 2–3 `.eml` por tipo (Gmail → ⋮ → "Descargar mensaje") a `spikes/eml-raw/` (ignorado por git). Se anonimizan y pasan a `tests/fixtures/`. Catálogo de tipos: `docs/discovery/formatos-correos-bcp-yape.md`.

## S7 — iOS 27

`docs/guides/guia-atajos-ios27-yape.md`, experimentos 1–3.

---

## Resultados

| Spike | Fecha | Resultado | Evidencia | Decisión |
|---|---|---|---|---|
| S1 | 2026-10-04 | `files.copy` directo → **404**; tras elegir la plantilla en el Picker (`setAppId`) → **200** | Resumen pegado en chat; copia `1Xyv…oGlM` creada por `petter…@gmail.com` con solo `drive.file` | Onboarding = Picker → copiar. Sin `/copy`, sin scopes sensibles. Confirmado: la copia trae el script ligado (menú "Luca (spike)" visible) |
| S2 | 2026-10-04 | `spreadsheets.get` **200**, `values.get` **200** sobre la copia, con `drive.file` | Resumen pegado en chat | Dashboard web lee la Sheet desde el navegador sin pasar por nuestro servidor ✅ |
| S3 | 2026-10-04 | Flujo exactamente como se describía: "Google no ha verificado esta app" → Avanzado → Ir a Luca (no seguro) → permisos → "OK: Gmail autorizado" | Grabación del usuario (local) | No bloquea. Guía visual del onboarding obligatoria |
| S4 | 2026-10-04 | `iss` correcto; `aud` constante en 3 tokens de la misma copia y **distinto** en una segunda copia; `sub` igual en ambas; `email_verified=true`; 3600 s | 4 tokens decodificados en local con `s4-decode-jwt.mjs` | Pairing ancla `aud`+`sub`; después, auth GAS→Worker solo con la firma de Google (sin secreto compartido) |
| S5 | | | | |
| S6 | | | | |
| S7 | 2026-10-04 | Atajo generado por prompt; POST llega a webhook.site con la estructura correcta. Campos vacíos porque se ejecutó a mano (sin notificación): **no concluyente**. Pendiente prueba 0 (Mail/Mensajes bloqueado) y A/B/C con Yape | JSON en chat | — |
