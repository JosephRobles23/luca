---
name: deploy-luca
description: Publica una release de Luca — nueva versión de LucaLib (clasp push + create-version), bump del stub de la plantilla, versión anunciada por el Worker y la web, wrangler deploy, commit y push. Usar cuando el usuario pida "release", "publicar LucaLib", "subir la librería", "nueva versión", "deploy" o "desplegar Luca".
---

# Release de Luca

Una release = **un número** `N` de LucaLib repetido en cuatro sitios (lo verifica `npm run release:check`):

| Sitio | Qué cambia |
|---|---|
| `gas/shared/settings-runtime.js` | `var LUCA_VERSION = 'N'` (lo que la copia del usuario escribe en `Ajustes.luca.version`) |
| `gas/stub/appsscript.json` | `dependencies.libraries[0].version = "N"` (lo que toman las copias nuevas de la plantilla) |
| `services/luca-mcp/wrangler.toml` | `LUCA_LIB_VERSION = "N"` (lo que `GET /meta` anuncia al sidebar y la web) |
| `apps/web/.env.example` | `NEXT_PUBLIC_LUCA_LIB_VERSION=N` (la web avisa "tu copia usa vM, hay vN"; el valor real vive en Vercel) |

`N` lo asigna Apps Script en `lib:version`: es el número de versión anterior + 1 (confírmalo con
`clasp list-versions --project gas/shared | head -3`). El orden de los pasos importa: `create-version`
fotografía el HEAD del servidor, así que siempre `lib:push` → `lib:version`.

## Pre-release (verificar antes de tocar nada)
- [ ] `npm test` en verde. Si falla, detente y reporta.
- [ ] `clasp show-authorized-user` muestra sesión (si no: `clasp login`).
- [ ] `git status --short` sin ruido inesperado; cambios de `gas/shared` ya commiteados o en este commit.
- [ ] Si cambió algo en `gas/stub/*.js` (no solo el manifiesto): subir `STUB_VERSION` en `gas/stub/config.js`.
- [ ] `docs/dev/status.md` actualizado con lo que entra en esta release (versión, tests, pendientes).
- [ ] Si hay un ADR nuevo o cambia una regla, `CLAUDE.md`/`CONTEXT.md` lo reflejan.

## Pasos

```bash
# 1) Tests
npm test

# 2) Librería: subir LUCA_VERSION a N y publicar
sed -i "s/^var LUCA_VERSION = '[0-9]*';/var LUCA_VERSION = 'N';/" gas/shared/settings-runtime.js
npm run lib:push                                   # clasp push --project gas/shared
npm run lib:version -- "vN — <resumen del cambio>" # clasp create-version; anota el número que asigna
clasp list-versions --project gas/shared | head -3 # debe ser N; si no, corrige los 4 sitios con el real

# 3) Stub de la plantilla: apuntar a la versión N
#    gas/stub/appsscript.json → "version": "N"
npm run stub:push                                  # clasp push --project gas/stub

# 4) Versión anunciada por Worker y web
#    services/luca-mcp/wrangler.toml → LUCA_LIB_VERSION = "N"
#    apps/web/.env.example          → NEXT_PUBLIC_LUCA_LIB_VERSION=N
#    Recordatorio 🧑: Vercel → proyecto luca-sand → Environment Variables →
#    NEXT_PUBLIC_LUCA_LIB_VERSION=N → Redeploy (sin esto la web sigue anunciando la anterior).
npm run release:check                              # los 4 números coinciden

# 5) Worker
(cd services/luca-mcp && npx wrangler deploy)      # publica mcp.lucaa.lat con el nuevo /meta

# 6) Git
git add -A
git commit -m "release: LucaLib vN — <resumen>"    # + trailer Co-Authored-By habitual
git push
```

## Qué cambia para los usuarios existentes (ADR-006 §5)
Las copias ya creadas **no se actualizan solas**. Al terminar, dile al usuario qué aplica:
- **Cambio solo en LucaLib** (lo habitual): cada usuario sube la versión de la librería en su copia
  (Extensiones → Apps Script → Bibliotecas → LucaLib → versión N). La web y el sidebar ya le avisan
  "hay vN" leyendo `/meta` y `Ajustes.luca.version`.
- **Cambio en `gas/stub/*.js`**: `stub:push` solo actualiza la **plantilla**; una copia existente necesita
  copia nueva desde la web ("Crear mi Sheet") o pegar a mano los archivos del stub en su proyecto.
- **Cambio en `doGet/doPost` o en lo que ve el Web App**: el usuario debe crear una **nueva versión del
  despliegue** (Implementar → Administrar implementaciones → editar → Nueva versión); si no, `/exec`
  (iPhone y MCP) sigue ejecutando el código viejo.

## Reporta al final
Número `N` real asignado, salida de `release:check`, URL del deploy del Worker, y la lista de acciones
que les toca a los usuarios existentes según la sección anterior.
