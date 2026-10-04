# Luca · web (`lucaa.lat`)

Next.js 16 (App Router) sin base de datos: el navegador lee y escribe la Sheet del usuario con su propio token (ADR-006).

## Correr

```bash
npm install
cp .env.example .env.local        # credenciales reales de Google
npm run dev                       # http://localhost:3000
npm run dev:mock                  # LUCA_MOCK=1: sesión falsa + Sheet en memoria, sin Google
```

En modo mock, `?mock=full|authorized|empty` en la URL resiembra el escenario (Sheet completa con iPhone+IA · autorizada
sin conexiones · sin Sheet para probar el onboarding). El estado vive en `localStorage` (`luca.mock.*`).

## Calidad

```bash
npm run lint && npm run typecheck
npm run build                     # necesita AUTH_* (valen dummies)
npm test                          # desde la raíz del repo: tests Node de src/lib/*.test.mjs
npm run e2e                       # Playwright en modo mock (arranca next dev en :3100); capturas en e2e/screenshots/
```

## Mapa

| Qué | Dónde |
|---|---|
| Rutas | `src/app` (`/`, `/privacidad`, `/terminos`, `/app`, `/app/movimientos`, `/app/agregar`, `/app/conexiones`, `/app/ajustes`) |
| Auth (Google o mock) | `src/auth.ts` |
| Contrato y factoría del cliente de Google | `src/lib/google-types.ts`, `src/lib/google-client.ts` |
| Implementaciones | `src/lib/google.ts` (real), `src/lib/google.mock.ts` + `src/lib/fixtures.ts` (mock) |
| Lógica pura (testeada) | `src/lib/ledger.ts`, `sheets-ops.ts`, `ajustes.ts`, `onboarding.ts` |
| Estado compartido de /app | `src/components/LedgerProvider.tsx` |
