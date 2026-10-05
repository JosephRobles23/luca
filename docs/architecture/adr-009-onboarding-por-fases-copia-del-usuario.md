# ADR-009 — Onboarding por fases: el usuario copia la plantilla y la web detecta cada paso

Fecha: 2026-10-05 · Estado: **aceptado** · Sustituye el punto 3 de ADR-006 ("Onboarding en 3 pasos"). El resto de
ADR-006 (sin base de datos, escritura desde el navegador, `drive.file`, actualización de copias) sigue vigente.

## Contexto
ADR-006 §3 creaba la Sheet así: el usuario elige la plantilla en el Picker (eso la mete en el alcance de
`drive.file`) y la web la copia con `files.copy`. En la práctica, un usuario al que no le compartimos la plantilla
**no la encuentra** en el Picker ("Compartidos conmigo" solo lista lo compartido explícitamente), así que no puede
empezar (observación obs-1). Además el paso 2 dependía de que el usuario volviera y pulsara "Ya autoricé".

Desde 2026-10-05 la plantilla "Luca Template" y LucaLib viven en la carpeta Drive "LUCA" de la cuenta operadora,
compartidas con "cualquiera con el enlace: lector".

## Decisión
1. **Fase 1 · Tu copia.** El botón principal **"Copiar a mi Drive"** abre la página nativa de Google
   `docs.google.com/spreadsheets/d/<plantilla>/copy`: el propio usuario hace la copia en su Drive (con el stub y la
   referencia a LucaLib incluidos). Funciona para cualquiera porque la plantilla es pública de lectura. Después,
   **"Elegir mi copia"** abre el Picker buscando "Luca Template" y solo con archivos del usuario: elegirla la mete en
   el alcance de `drive.file` y la web la etiqueta (`appProperties`) como su ledger. Seguimos sin pedir acceso a
   ningún otro archivo.
   "Otras formas" conserva el flujo anterior (Picker abierto en la carpeta LUCA → `files.copy`), "Ya tengo una" y el
   enlace a la carpeta.
2. **Fase 2 · Autorizar.** La web relee la Sheet cada ~6 s (solo con la pestaña visible) y al volver a la pestaña;
   avanza sola cuando aparecen `Movimientos` o `Ajustes.luca.version`. "Comprobar ahora" queda como respaldo.
3. **Fase 3 · Importación** (solo mientras `Ajustes.import.status = running`): muestra en vivo cuántos movimientos
   hay y avanza sola al terminar; "Seguir al panel" la omite (por Sheet, en el navegador).
4. **Fase 4 · Conexiones** (opcional), igual que el antiguo paso 3.

El estado de cada fase se deduce de la Sheet, no de nuestra infraestructura: el usuario retoma donde lo dejó.

## Consecuencias
- Un paso manual más para el usuario (Hacer una copia en la pantalla de Google), a cambio de que funcione sin
  compartirle nada. Queda documentado aquí y en el propio onboarding (regla de CLAUDE.md).
- La copia hecha por el usuario se llama "Copia de Luca Template"; la web no la renombra.
- La lectura periódica usa la Sheets API del usuario mientras espera (unas pocas lecturas por minuto, solo en esas
  fases).
- Pendiente de validar con una cuenta externa: `DocsView.setFileIds` permitiría mostrar la plantilla directamente
  en el Picker (un clic). Si funciona, puede convertirse en el botón principal sin cambiar esta decisión.
