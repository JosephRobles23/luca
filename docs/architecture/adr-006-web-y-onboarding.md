# ADR-006 — Web sin base de datos, escritura desde el navegador y onboarding en 3 pasos

Fecha: 2026-10-04 · Estado: **aceptado**

## Decisiones
1. **Sin base de datos.** El vínculo usuario ↔ Sheet lo resuelve Drive: la copia lleva `appProperties {luca: ledger}` y se localiza con `files.list` bajo `drive.file`. Los tokens de Google viven solo en la cookie JWT cifrada del usuario; el servidor únicamente los refresca. Luca no persiste nada por usuario.
2. **La web escribe** en la Sheet desde el navegador (Sheets API, `drive.file`): recategorizar, alta manual (incluye el hueco de yapeos < S/10 enviados), marcar transferencia, editar `Ajustes` (p. ej. pedir importación histórica, que el trigger recoge). Toda escritura actualiza `Comercios` cuando aplica.
3. **Onboarding en 3 pasos:**
   - **1. Tu Sheet:** Picker sobre la plantilla (la mete en alcance) → `files.copy` (validado S1) o "Ya tengo una".
   - **2. Autorizar:** en el Sheet, menú Luca → Autorizar = consentimiento + instalar trigger (desde el stub) + **importar el último mes**. La web muestra guía con capturas de la pantalla "app no verificada" (S3).
   - **3. Activar conexiones (opcional):** desplegar el Web App → pegar `/exec` → "Conectar iPhone" / "Conectar IA" (ADR-003, ADR-001).
4. **Estado de conexiones** visible en la web leyendo `Ajustes` (`conexiones.execUrl`, `conexiones.iphone`, `conexiones.mcp`, `luca.version`), que escribe el Apps Script.
5. **Actualización de copias:** la librería expone `LUCA_VERSION`; el Worker publica la última en `GET /meta`. Web y sidebar muestran "Hay una versión nueva" con los 3 clics (versión de la librería en la copia y, si existe, nueva versión de la implementación del Web App). Releases agrupadas, máximo mensuales. Vía add-on solo si se superan ~50 usuarios.
6. **Carga manual** desde la web en v0; atajo de carga rápida en v1.
7. Sin analítica ni rastreadores en v0.
