# ADR-011 — App instalable (PWA) con copia local de solo lectura

Fecha: 2026-10-09 · Estado: **aceptado** · Complementa [ADR-006](adr-006-web-y-onboarding.md) (web sin base de datos).

## Contexto
Se pidió tener lucaa.lat como app en el celular y, sin conexión, **ver los últimos datos**. Hoy la web no guarda
nada: `/app` se arma en el servidor con la sesión en cada visita (`app/app/layout.tsx`) y `LedgerProvider` lee la
Sheet desde el navegador cada vez. Sin red no hay página ni datos. ADR-006 fija que **nuestra infraestructura** no
persiste nada por usuario; guardar datos financieros en el **dispositivo del usuario** es una decisión nueva.

## Decisión
1. **La web es una PWA instalable**: `manifest` (standalone, `id: /app`, atajos) + service worker propio
   (`public/sw.js`, sin librería). En iPhone se instala desde Safari → Compartir → Añadir a pantalla de inicio; en
   navegadores que lo permiten, con el botón "Instalar app" de Ajustes. Un aviso discreto en el panel lo sugiere en
   teléfonos y se oculta para siempre al cerrarlo.
2. **Qué se guarda en el dispositivo** (nunca en nuestros servidores):
   - Cache Storage `luca-static`: archivos del build (`/_next/static`, íconos).
   - Cache Storage `luca-pages`: las páginas de `/app/*` ya visitadas o precargadas tras una lectura correcta. Ese
     HTML lleva nombre, email y el token de acceso de Google de corta duración que ya viaja en la página.
   - IndexedDB `luca` / `snapshots`: **copia de la última lectura correcta** de la Sheet (movimientos, categorías,
     comercios y `Ajustes`), asociada al email y al id de la Sheet, con la hora en que se guardó.
3. **Sin secretos en la copia**: antes de guardar se quitan de `Ajustes` el token del atajo de iPhone
   (`conexiones.iphone.token`) y las URLs `/exec` (`conexiones.execUrl`, `conexiones.iphone.execUrl`).
4. **Sin conexión = solo lectura.** Si la red falla al abrir o al recargar, la web muestra la copia con el aviso
   "Sin conexión · datos de hace X". Las escrituras (recategorizar, agregar, marcar transferencia, Ajustes) se
   bloquean con aviso; no hay cola de escrituras. Al volver la conexión, la web recarga sola desde la Sheet.
   Errores que no son de red (permisos, hoja borrada) siguen como hasta ahora.
5. **Borrado**: al **cerrar sesión** se vacían `luca-pages` y la IndexedDB; si entra **otra cuenta**, la copia de
   la anterior se descarta.
6. **Fuera de alcance**: notificaciones push, sincronización en segundo plano y escritura sin conexión.

## Consecuencias
- Quien tenga el teléfono desbloqueado ve la copia; es el mismo riesgo que hoy con la sesión abierta.
- El login con Google dentro de la app instalada en iOS sale del ámbito de la PWA y la app tiene almacenamiento
  separado de Safari: hay que entrar una vez dentro de la app. Se valida en un iPhone real tras publicar.
- El service worker solo se registra en producción; en `next dev` (e2e) la copia local se prueba con el mock.
- Sin configuración nueva para el usuario final: instalar es opcional.
