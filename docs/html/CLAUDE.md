# Maquetas HTML (`docs/html/`)

Maquetas y previews de un solo archivo que el usuario abre con **Live Server** de VS Code (puerto 55xx, en su
Cloud Workstation). Live Server inyecta su `<script>` de recarga antes de `</body>`; si el archivo no lo tiene, lo
inyecta antes del primer `</svg>` o `</head>`, aunque esté dentro de un string de JS, y eso cierra el `<script>` de
la página: el código sale pintado como texto.

## Reglas
- **Documento completo**: `<!doctype html>`, `<html lang="es">`, `<head>` con `<meta charset="utf-8">`, viewport y
  `<title>`, y `<body>…</body></html>`. (El esqueleto implícito de los Artifacts de claude.ai no aplica aquí.)
- **En el JS, todo cierre de etiqueta dentro de un string va como `<\/`** (`<\/svg>`, `<\/div>`): así ningún
  `</script` ni `</svg>` literal queda dentro del `<script>`.
- **Escapes Unicode como clase de propiedad** (`/\p{M}/gu` para quitar tildes), sin rangos de caracteres
  combinantes literales en el archivo.
- Tokens de color y tipografía copiados de `apps/web/src/app/globals.css`, con tema claro y oscuro.

## Verificación (antes de entregar)
Abrirla **a través de Live Server** con Playwright (`apps/web/node_modules/playwright`), no solo con `file://`:
`http://localhost:<puerto>/Projects/luca/docs/html/<archivo>.html`. Pasa cuando no hay errores de consola,
`document.body.innerText` no contiene `${` y la interacción principal responde. Si Live Server no está corriendo,
pedirle al usuario el puerto.
