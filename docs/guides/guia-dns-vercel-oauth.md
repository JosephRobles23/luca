# Guía paso a paso: dominio lucaa.lat, Vercel y login con Google

> Para quien opera sin ser experto. Hazlo en orden (A → G). Los nombres de botones están en el idioma en que suele aparecer cada panel; si tu panel está traducido, el texto en paréntesis es el original en inglés. Lo marcado "(etiqueta aprox.)" no pudimos verificar letra por letra. Verificado contra documentación oficial en octubre 2026.

**Datos fijos de este proyecto**

| Cosa | Valor |
|---|---|
| Dominio | `lucaa.lat` (registrado en Spaceship) |
| DNS | Cloudflare, la misma cuenta donde vive el Worker `luca-mcp` |
| Web | Vercel, proyecto `luca-sand` (https://luca-sand.vercel.app, Root Directory `apps/web`) |
| Dominios finales web | `lucaa.lat` y `www.lucaa.lat` |
| MCP | hoy https://luca-mcp.chif-of-staff.workers.dev → luego `mcp.lucaa.lat` |
| Proyecto GCP | `luca-510610`, cliente OAuth "Luca Web (spikes)" |

---

## Parte A — DNS: Cloudflare + Spaceship

### A1. Agregar el dominio en Cloudflare

1. Entra a https://dash.cloudflare.com con la cuenta donde está el Worker `luca-mcp`.
2. Menú lateral **Dominios** (*Domains*) → botón **Incorporar un dominio** (*Onboard a domain*).
3. Escribe `lucaa.lat` (sin `www`, sin `https://`). Deja marcada la opción de escaneo automático de registros DNS (*quick scan*) y pulsa **Continuar** (*Continue*).
4. Elige el plan **Free** y continúa.
5. Pantalla "Revisar registros DNS": si aparece algo que no reconoces (registros de "parking" de Spaceship) puedes borrarlo; los registros web los crearemos en la Parte B. Pulsa **Continuar**.
6. Cloudflare te muestra **dos nameservers** del tipo `xxxx.ns.cloudflare.com` y `yyyy.ns.cloudflare.com`. Cópialos tal cual (también los verás luego en la pestaña **Información general** (*Overview*) del dominio).
   Fuente: https://developers.cloudflare.com/fundamentals/manage-domains/add-site/ y https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/

### A2. Cambiar nameservers en Spaceship

1. Entra a https://www.spaceship.com → **Domains** → haz clic en `lucaa.lat`.
2. Si tienes **DNSSEC** activado, desactívalo primero (Cloudflare advierte que cambiar nameservers con DNSSEC activo puede dejar el dominio inaccesible).
3. Ve a la sección **Advanced DNS** (etiqueta aprox.: también puede llamarse **Nameservers**) y, en la ventana que se abre, elige **Custom nameservers**.
4. Borra los nameservers de Spaceship y pega los dos de Cloudflare. Si falta un campo, pulsa **+ Add nameserver**.
5. Pulsa **Save nameserver settings**. Si aparece el aviso de que las conexiones con productos Spaceship se terminarán, confirma con **Yes, change to Custom DNS**.
   Fuente: https://www.spaceship.com/knowledgebase/connect-domain-custom-nameservers/

### A3. Verificar activación

- Cloudflare dice "hasta 24 h"; Spaceship dice "hasta 48 h". Normalmente son minutos.
- En Cloudflare, el dominio pasa de **Pendiente** (*Pending Nameserver Update*) a **Activo** (*Active*) y **recibes un correo** "lucaa.lat is now active on Cloudflare". Puedes acelerar con el botón **Comprobar nameservers ahora** (*Check nameservers now*) (etiqueta aprox.) en Overview.
- Desde tu terminal:

```bash
dig ns lucaa.lat +short        # debe mostrar los dos *.ns.cloudflare.com
nslookup -type=ns lucaa.lat    # alternativa en Windows
```

- Error común: pegaste los nameservers con un espacio o letra de más → el estado nunca cambia a Activo. Vuelve a A2 y copia exacto.

---

## Parte B — Dominio en Vercel

### B1. Agregar los dominios al proyecto

1. https://vercel.com/dashboard → proyecto **luca-sand** → **Settings** → **Domains** (barra lateral).
2. Botón **Add Domain**. Escribe `lucaa.lat` y confirma.
3. Vercel te ofrecerá agregar también `www.lucaa.lat` con una opción de redirección. Elige la que redirige **www → lucaa.lat** (opción tipo "Add www.lucaa.lat and redirect it to lucaa.lat", etiqueta aprox.). Si no aparece, agrega `www.lucaa.lat` por separado con **Add Domain** y luego en esa fila pulsa **Edit** → desplegable **Redirect to** → `lucaa.lat` → guardar.
   Fuente: https://vercel.com/docs/domains/working-with-domains/add-a-domain y https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting
4. Ambos dominios mostrarán **Invalid Configuration** en rojo. Es normal: Vercel te muestra la **tarjeta con los valores DNS exactos** a crear. Deja esa pestaña abierta.

### B2. Crear los registros en Cloudflare

En Cloudflare → `lucaa.lat` → **DNS** → **Registros** (*Records*) → **Agregar registro** (*Add record*) → rellenar → **Guardar** (*Save*).
Fuente: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/

| Tipo | Nombre | Contenido | Estado de proxy |
|---|---|---|---|
| **A** | `@` | la IP que muestra la tarjeta de Vercel (normalmente `76.76.21.21`; proyectos nuevos pueden mostrar `216.198.79.1`) | **Solo DNS** (*DNS only*, nube **gris**) |
| **CNAME** | `www` | el destino que muestra la tarjeta de Vercel (p. ej. `xxxxxxxx.vercel-dns-0xx.com`; cópialo completo) | **Solo DNS** (nube gris) |

Importante:

- **Apaga el proxy naranja** (haz clic en la nube para que quede gris). Vercel pide "for Cloudflare, use **DNS only**" para poder emitir el certificado SSL (https://vercel.com/docs/domains/troubleshooting). No hace falta "CNAME flattening": en el apex usamos registro A.
- Si en el apex Cloudflare ya tenía un registro **A**, **AAAA** o **CNAME** (del escaneo), bórralo: Vercel no soporta AAAA y los registros en conflicto causan "Invalid Configuration".
- No cambies otra cosa (TTL "Auto" está bien).

### B3. Verificar

1. Vuelve a Vercel → Settings → Domains → botón **Refresh** (etiqueta aprox.). En unos minutos ambos dominios pasan a **Valid Configuration** con el check azul y Vercel emite el certificado.
2. Terminal:

```bash
dig a lucaa.lat +short          # → la IP de la tarjeta
dig cname www.lucaa.lat +short  # → el destino *.vercel-dns-*.com
```

3. Abre https://lucaa.lat y https://www.lucaa.lat (la segunda debe redirigir a la primera).

Errores comunes: "Invalid Configuration" persistente = nube naranja encendida o registro duplicado; certificado que no sale tras 1 h = igual causa, o registro CAA restrictivo (`dig caa lucaa.lat`).

---

## Parte C — Variables de entorno en Vercel y redeploy

1. Proyecto **luca-sand** → **Settings** → **Environment Variables**.
2. En el formulario "Add New": campo **Key** (puede decir *Name*), campo **Value**, y las casillas de entorno. Marca **Production** y **Preview** (Development no hace falta). Pulsa **Save**. Repite por cada variable:

| Key | Value |
|---|---|
| `AUTH_SECRET` | genera con `openssl rand -base64 32` en tu terminal y pega el resultado. Marca **Sensitive** si la opción aparece. |
| `AUTH_GOOGLE_ID` | `334287534871-9v2rvalbfm53uq8v7t93f0vhc9808b0i.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | el "Client secret" del cliente OAuth (Parte D). Nunca lo pegues en documentos. |
| `AUTH_TRUST_HOST` | `true` |
| `NEXT_PUBLIC_GOOGLE_PICKER_KEY` | la API key del Picker (GCP → APIs y servicios → Credenciales) |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | `334287534871` |
| `NEXT_PUBLIC_TEMPLATE_SHEET_ID` | `1FMxSE00KcD68JdClICcWayMxdqvSROYr6tuL-va5KWA` |
| `NEXT_PUBLIC_LUCA_LIB_VERSION` | `12` |

Notas de Auth.js v5: `AUTH_SECRET` es "la única variable estrictamente requerida"; `AUTH_URL` **no** hace falta (el host se infiere de la petición) y en Vercel `AUTH_TRUST_HOST` se autodetecta, pero ponerlo en `true` no estorba (https://authjs.dev/getting-started/deployment).

3. **Redeploy obligatorio**: las variables solo aplican a despliegues nuevos. Ve a la pestaña **Deployments**, en el último despliegue de Production pulsa el menú **⋯** → **Redeploy** → confirma **Redeploy** (https://vercel.com/docs/environment-variables/managing-environment-variables).
4. Espera a que el estado diga **Ready** y abre https://lucaa.lat.

---

## Parte D — Cliente OAuth en Google Cloud

1. https://console.cloud.google.com → selector de proyecto arriba → **luca-510610**.
2. Menú ☰ → **Google Auth Platform** → **Clientes** (*Clients*). Enlace directo: https://console.cloud.google.com/auth/clients?project=luca-510610
3. Haz clic en el nombre **Luca Web (spikes)** (ID termina en `...808b0i`). Se abre la página de detalles del cliente.
4. Sección **Orígenes autorizados de JavaScript** (*Authorized JavaScript origins*) → **+ Agregar URI** (*Add URI*) por cada uno (sin barra final, sin rutas):

```
http://localhost:3000
https://3000-joseph-chuquipiondo.cluster-2uoayl5we5fp4xtdiw2el4x2aq.cloudworkstations.dev
https://luca-sand.vercel.app
https://lucaa.lat
https://www.lucaa.lat
```

5. Sección **URI de redireccionamiento autorizados** (*Authorized redirect URIs*) → **+ Agregar URI**, uno por uno, exactos:

```
http://localhost:3000/api/auth/callback/google
https://3000-joseph-chuquipiondo.cluster-2uoayl5we5fp4xtdiw2el4x2aq.cloudworkstations.dev/api/auth/callback/google
https://luca-sand.vercel.app/api/auth/callback/google
https://lucaa.lat/api/auth/callback/google
https://www.lucaa.lat/api/auth/callback/google
```

6. Pulsa **Guardar** (*Save*) abajo. Google avisa: "los cambios pueden tardar de 5 minutos a unas horas en aplicarse" (https://support.google.com/cloud/answer/15549257).
7. Si necesitas el secreto para la Parte C y no lo tienes guardado: en la misma página, sección **Secretos del cliente** → **Agregar secreto** (*Add Secret*); cópialo en ese momento (luego solo se ven los últimos 4 caracteres) y deshabilita el viejo.

Error común: `redirect_uri_mismatch` = falta la URI exacta de la lista anterior (revisa `http` vs `https`, `www`, y que no sobre una `/`). `origin_mismatch` = falta el origen.

---

## Parte E — Publicar la pantalla de consentimiento

Mientras el estado sea **En prueba** (*Testing*) solo entran los usuarios de prueba. Para abrirlo:

1. **Google Auth Platform** → **Marca** (*Branding*). Completa:
   - **Nombre de la app**: Luca
   - **Correo de asistencia al usuario**: elige del desplegable.
   - **Dominio de la app**: Página principal `https://lucaa.lat`, Política de privacidad `https://lucaa.lat/privacidad`, Condiciones del servicio `https://lucaa.lat/terminos`. Las tres páginas deben existir y responder en producción.
   - **Dominios autorizados**: `lucaa.lat` (y `vercel.app` si quieres seguir usando luca-sand.vercel.app). Deben agregarse **antes** que las URLs anteriores.
   - **Información de contacto del desarrollador**: tu correo.
   - **Guardar**.
2. **Google Auth Platform** → **Público** (*Audience*). Tipo de usuario **Externo**. En "Estado de publicación" pulsa **Publicar app** (*Publish app*) → confirmar.
3. Como solo pedimos `openid`, `email`, `profile`, no hace falta verificación de permisos para iniciar sesión. Si la pantalla sigue mostrando "app no verificada" o quieres que aparezca nombre/logo, en **Marca** pulsa **Verificar marca** (*Verify Branding*) y luego **Publicar marca** (*Publish branding*).
   Fuentes: https://support.google.com/cloud/answer/10311615 y https://support.google.com/cloud/answer/15549945

---

## Parte F — Activar mcp.lucaa.lat (Worker)

Requiere que la Parte A esté en **Activo**. El operador ejecuta en su máquina:

1. Edita `services/luca-mcp/wrangler.toml` y descomenta:

```toml
routes = [
  { pattern = "mcp.lucaa.lat", custom_domain = true }
]
```

2. En la terminal: `cd services/luca-mcp && npx wrangler deploy`.
3. Cloudflare crea el registro DNS y el certificado automáticamente ("Cloudflare will create DNS records and issue necessary certificates on your behalf"). Condición: **no debe existir** ya un registro `mcp` en el DNS; si lo hay, bórralo antes.
4. Verifica en el panel: **Workers & Pages** → `luca-mcp` → **Settings** → **Domains & Routes** debe listar `mcp.lucaa.lat`. Prueba `curl -s https://mcp.lucaa.lat/meta`.
   Fuente: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

---

## Parte G — Verificación final

- [ ] `dig ns lucaa.lat +short` devuelve dos `*.ns.cloudflare.com`; Cloudflare muestra **Activo** y llegó el correo.
- [ ] Cloudflare: registro A `@` y CNAME `www`, ambos con nube **gris**.
- [ ] Vercel: `lucaa.lat` y `www.lucaa.lat` en **Valid Configuration**; `www` redirige al apex.
- [ ] https://lucaa.lat carga con candado (HTTPS válido).
- [ ] Las 8 variables existen en Production y Preview y se hizo **Redeploy** después.
- [ ] Botón "Entrar con Google" en https://lucaa.lat completa el login sin `redirect_uri_mismatch`.
- [ ] Lo mismo en https://luca-sand.vercel.app y en `http://localhost:3000`.
- [ ] Pantalla de consentimiento en **En producción**; `/privacidad` y `/terminos` responden 200.
- [ ] `https://mcp.lucaa.lat/meta` responde.

---

## Caja de problemas: "Server error — There is a problem with the server configuration" (Auth.js)

Ese mensaje genérico aparece en el navegador; la causa real está en la **terminal donde corre `npm run dev`**, en líneas que empiezan con `[auth][error]`.

| Línea en terminal | Causa | Arreglo |
|---|---|---|
| `MissingSecret` | No hay `AUTH_SECRET` | Añádelo en `apps/web/.env.local` (no en la raíz del repo): `AUTH_SECRET=<openssl rand -base64 32>` |
| `InvalidProvider` / provider sin `clientId` | `AUTH_GOOGLE_ID` o `AUTH_GOOGLE_SECRET` vacías | Rellénalas en `.env.local`; sin comillas ni espacios |
| `Configuration` + `redirect_uri_mismatch` en la pantalla de Google | La URL/puerto actual no está en el cliente OAuth | Parte D, paso 4–5 (incluye `localhost:3000` y la URL de la workstation) |
| `UntrustedHost` | Host no confiado (workstation, proxy) | `AUTH_TRUST_HOST=true` en `.env.local` |

Siempre: después de tocar `.env.local` **detén y vuelve a arrancar** el servidor de desarrollo (Ctrl+C, `npm run dev`); Next.js no recarga esas variables en caliente. Comprueba que el archivo está en `apps/web/.env.local` y que copiaste todas las claves de `apps/web/.env.example`.
