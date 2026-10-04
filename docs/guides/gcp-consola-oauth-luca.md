# Guía: configurar la pantalla de consentimiento y el cliente OAuth de Luca en GCP

Proyecto: `luca-510610` · Cuenta: `gavynenita@gmail.com` · Fecha: 2026-10-04

Desde 2025 la consola agrupa todo esto bajo **"Google Auth Platform"** (antes "Pantalla de consentimiento de OAuth" dentro de APIs y servicios). Las etiquetas en español pueden variar ligeramente; se indica la inglesa entre paréntesis.

> Antes de empezar: en la esquina superior izquierda verifica que el selector de proyecto diga **luca-510610** y que la sesión (avatar arriba a la derecha) sea `gavynenita@gmail.com`.

## Parte 1 — Pantalla de consentimiento (una sola vez)

1. Abre https://console.cloud.google.com/auth/overview?project=luca-510610
2. Como el proyecto nunca se configuró, verás una tarjeta **"Google Auth Platform aún no está configurado"** con el botón **Comenzar (Get started)**. Púlsalo. Se abre un asistente de 4 pasos:
   1. **Información de la app (App Information)**
      - Nombre de la app (App name): `Luca`
      - Correo de asistencia al usuario (User support email): `gavynenita@gmail.com`
      - **Siguiente (Next)**
   2. **Público (Audience)**
      - Selecciona **Externo (External)**. (Interno solo existe para organizaciones Workspace; con una cuenta Gmail no aparece habilitado.)
      - **Siguiente**
   3. **Información de contacto (Contact Information)**
      - Direcciones de correo: `gavynenita@gmail.com`
      - **Siguiente**
   4. **Finalizar (Finish)**
      - Marca la casilla **Acepto la Política de datos del usuario de los servicios de API de Google**.
      - **Continuar (Continue)** → **Crear (Create)**.
3. Vuelves a **Descripción general (Overview)**. Ahora el menú lateral de Google Auth Platform muestra: Descripción general · Marca · Público · Clientes · Acceso a los datos · Centro de verificación.

### 1.a Alcances (Acceso a los datos / Data Access)

4. Menú lateral → **Acceso a los datos (Data Access)** → botón **Agregar o quitar permisos (Add or remove scopes)**. Se abre un panel lateral con una tabla de alcances.
5. En el filtro de la tabla escribe `drive.file` y marca la fila:
   - `https://www.googleapis.com/auth/drive.file` — "Ver y administrar los archivos de Google Drive que abriste o creaste con esta app".
6. Borra el filtro y marca también las tres de identidad (están al inicio de la tabla, sin API asociada):
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
7. Si algún alcance no aparece en la tabla, pégalo en el cuadro **Agregar permisos manualmente (Manually add scopes)** al final del panel y pulsa **Agregar a la tabla**.
8. Pulsa **Actualizar (Update)** abajo del panel. Verifica que las cuatro filas queden bajo **"Tus permisos no sensibles (non-sensitive scopes)"** y que las secciones de **sensibles** y **restringidos** estén vacías. Luego **Guardar (Save)**.

   ⚠️ No agregues Gmail, Sheets ni Drive completo aquí. Esos permisos los pide el script de cada usuario con su propio proyecto, no el nuestro. Si aparecieran como sensibles/restringidos, publicar exigiría verificación.

### 1.b Publicar en producción (Público / Audience)

9. Menú lateral → **Público (Audience)**.
10. En **Estado de publicación (Publishing status)** dice **En prueba (Testing)**. Pulsa **Publicar app (Publish app)**.
11. Aparece un diálogo **"¿Quieres publicar en producción?"** que, al tener solo permisos no sensibles, **no** debería listar requisitos de verificación. Pulsa **Confirmar (Confirm)**. El estado pasa a **En producción (In production)**.

    Por qué importa: en "Prueba" los refresh tokens caducan a los 7 días y solo pueden entrar los correos de la lista de **Usuarios de prueba**. En producción cualquiera inicia sesión y los tokens duran.

    Si el diálogo pidiera verificación, es que algún alcance quedó como sensible: vuelve a 1.a y quítalo.

    **Si el botón "Publicar app" está deshabilitado** con el texto *"debes completar la configuración en la página de desarrollo de la marca"* (ocurrió el 2026-10-04): faltan campos obligatorios en **Información de la marca** (correo de asistencia, contacto del desarrollador y, a veces, página principal + dominio autorizado, que exigen un dominio propio). Dos salidas:
    - Completar la marca y volver a publicar, o
    - **Quedarse en "Prueba"** y añadir en **Usuarios de prueba** las cuentas que usarán la app (`gavynenita@gmail.com`, `petter.chuquipiondo.r@gmail.com`). Es suficiente para los spikes S1/S2 (tokens de acceso de corta duración). Publicar en producción cuando exista el dominio de Luca, antes de que la web guarde sesiones.

### 1.c Marca (Branding) — qué NO tocar todavía

12. Menú lateral → **Marca (Branding)**. Comprueba que el nombre sea `Luca` y el correo de asistencia el correcto. **No subas logo** ni rellenes dominios autorizados / enlaces de política de privacidad por ahora: subir logo dispara el proceso de verificación de marca y no lo necesitamos para los spikes.

## Parte 2 — Cliente OAuth web

13. Menú lateral → **Clientes (Clients)** → **+ Crear cliente (Create client)**.
14. **Tipo de aplicación (Application type):** **Aplicación web (Web application)**.
15. **Nombre (Name):** `Luca Web (spikes)`.
16. **Orígenes de JavaScript autorizados (Authorized JavaScript origins)** → **+ Agregar URI**:
    - `http://localhost:5173`
    (Sin barra final. Más adelante se añadirá el dominio real de la web.)
17. **URIs de redireccionamiento autorizados (Authorized redirect URIs):** déjalo **vacío**. El spike usa el flujo de token en el navegador (Google Identity Services), que no redirige. Cuando montemos Next.js con Auth.js añadiremos `https://<dominio>/api/auth/callback/google`.
18. **Crear (Create)**. Se muestra un diálogo con **ID de cliente (Client ID)** y **Secreto del cliente (Client secret)**.
    - Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégamelo. No es secreto.
    - El **secreto** no hace falta para los spikes; no lo compartas por chat. Si quieres guardarlo, descarga el JSON y déjalo fuera del repo (está ignorado por `.gitignore` como `*.local.json` si lo nombras así, p. ej. `oauth-client.local.json`).

## Parte 3 — Verificación rápida

19. https://console.cloud.google.com/auth/audience?project=luca-510610 → estado **En producción**.
20. https://console.cloud.google.com/auth/scopes?project=luca-510610 → cuatro alcances, todos no sensibles.
21. https://console.cloud.google.com/auth/clients?project=luca-510610 → `Luca Web (spikes)` con origen `http://localhost:5173`.
22. https://console.cloud.google.com/apis/credentials?project=luca-510610 → en **Claves de API** debe aparecer `Luca Picker (spikes)` (ya creada por `gcloud`). Opcional: Editar → **Restricciones de aplicaciones** → Sitios web → `http://localhost:5173/*`.

## Problemas frecuentes

- **No veo "Google Auth Platform" sino "Pantalla de consentimiento de OAuth" dentro de APIs y servicios:** es la vista antigua; los mismos pasos aplican (pestañas "Pantalla de consentimiento", "Permisos", "Credenciales").
- **"Publicar app" pide verificación:** hay un alcance sensible/restringido en Acceso a los datos. Quítalo.
- **Al autorizar desde la página del spike sale `redirect_uri_mismatch` o `origin_mismatch`:** el origen debe ser exactamente `http://localhost:5173` (sin `/`, sin `127.0.0.1`), y hay que servir la página desde ese puerto. Los cambios en el cliente tardan hasta 5 minutos en aplicarse.
- **Sale "Esta app no está verificada" al autorizar con nuestro cliente:** no debería con solo `drive.file`. Si aparece, revisa que la app esté en producción y sin alcances sensibles.
