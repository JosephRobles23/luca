# Plan agente Web — M2 (apps/web)

Rama: `agent/web-m2`. Archivos propios: `apps/web/**`. Rol: frontend developer experto. Objetivo: **ningún botón sin función**, todo lo que se vea debe hacer algo real o no existir.

Leer antes: `CLAUDE.md`, `CONTEXT.md`, ADR-004/005/006/007, `docs/html/dashboard-mock.html` (referencia visual), `apps/web/src/lib/*.ts`.

## Base
- `cd apps/web && npm install` (el worktree no trae `node_modules`). Instalar `@playwright/test` y Chromium (`npx playwright install chromium --with-deps` o sin deps si falla).
- **Modo mock** para desarrollo y e2e sin Google: `LUCA_MOCK=1` → `auth()` devuelve una sesión falsa y `lib/google.ts` usa una implementación en memoria (`lib/google.mock.ts`) con una Sheet de fixtures (reutilizar el estilo de `tests/fixtures/emails.mjs`: 40–60 movimientos de 3 meses, PEN/USD, pendientes, `transfer_in`, `internal_transfer`, pestaña `Ajustes` con `luca.version`, `conexiones.*`, `Comercios`, `Categorías`). Selección por una factoría `getGoogleClient()`; cero ramas `if (mock)` dentro de los componentes.
- Playwright configurado para arrancar `next dev` con `LUCA_MOCK=1`; `npm run e2e`.

## Entregables
1. **Landing `/`**: propuesta de valor, cómo funciona (3 pasos), privacidad, botón Entrar. Enlaces a `/privacidad`, `/terminos`.
2. **Onboarding en 3 pasos** (ADR-006) como stepper persistente arriba del dashboard hasta completar: 1 Tu Sheet (Crear / Ya tengo una), 2 Autorizar (guía con capturas placeholder y botón "Ya autoricé → Actualizar"; se da por hecho cuando existe `Movimientos` o `Ajustes.luca.version`), 3 Activar conexiones (opcional: guía Web App, estado iPhone e IA leídos de `Ajustes.conexiones.*`, con "Omitir por ahora").
3. **Dashboard**: lo existente + tarjeta "Recibido por Yape" (`transfer_in`), conversión USD con `tipo_cambio` del correo o `Ajustes.fx.usd_pen`, selector de mes, estados vacíos útiles, aviso de versión (`Ajustes.luca.version` vs `NEXT_PUBLIC_LUCA_LIB_VERSION`), aviso de silencio del iPhone > 7 días.
4. **Movimientos**: lista con filtros (tipo, fuente, categoría, texto), **recategorizar** inline (select con `Categorías`; escribe `categoria` + `categoria_origen=user` en la fila y upsert en `Comercios`), **marcar como transferencia** (cambia `tipo` a `internal_transfer` o categoría Transferencias según ADR-005), ver detalle (asunto, fuente, flags).
5. **Agregar movimiento** (manual): monto, moneda, fecha, tipo (gasto/ingreso), comercio o contraparte, categoría, nota → fila con `id = manual:<uuid>`, `fuente = manual`.
6. **Ajustes** (`/app/ajustes`): tipo de cambio USD→PEN, remitentes, lote; estado de API key (solo lectura: "configurada / falta", con enlace "configúrala en tu Sheet"); importar historial desde fecha (escribe `import.since` e `import.status=running` en `Ajustes`); botón "Abrir mi Sheet"; "Cambiar Sheet"; "Cerrar sesión".
7. **Conexiones** (`/app/conexiones`): tarjetas iPhone e IA con estados (ADR-003 §Limitaciones): no configurado / conectado · último evento · contador / sin señales; botones solo si tienen efecto desde la web (los que requieren el Sheet enlazan al Sheet con instrucción exacta). Detección de `execUrl` cambiada.
8. **`/privacidad` y `/terminos`** (ADR-007 §5): texto en español, persona natural, gratuito, sin anuncios, arquitectura literal.
9. **Capa de escritura** en `lib/google.ts`: `updateCells`, `appendRow`, `upsertKeyValue` con `values:batchUpdate`; manejo de 401/403 (sesión caducada → re-login), 429 (reintento con backoff), errores visibles con toast.
10. **Calidad**: responsive (360 px), dark/light, accesibilidad básica (labels, focus), sin `any` nuevos, `npm run lint` y `tsc --noEmit` limpios, `npm run build` ok.
11. **E2E Playwright (modo mock)**: landing → entrar → dashboard con KPIs; recategorizar un movimiento y verlo reflejado; agregar movimiento manual; onboarding sin Sheet (Crear/Ya tengo) con el Picker mockeado; páginas legales; ajustes guardan.

## Criterios de aceptación
- Cada botón visible ejecuta una acción real o no existe. Nada de `TODO` visible en UI.
- `npm test` (raíz) sigue verde; añadir tests a `apps/web/src/lib/*.test.mjs` para toda lógica nueva (conversión, filtros, upsert).
- Commits pequeños en español con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Informe final: rutas, componentes, variables de entorno nuevas, cómo correr e2e, y qué queda para probar contra Google real.
