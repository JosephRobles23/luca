# Política de seguridad

## Reportar una vulnerabilidad

**No abras un issue público.** Repórtala en privado mediante
[GitHub Security Advisories](https://github.com/JosephRobles23/luca/security/advisories/new).

Incluye, si puedes:

- componente afectado (`gas/shared`, `gas/stub`, `apps/web`, `services/luca-mcp`);
- pasos para reproducirlo con datos de prueba;
- impacto que observaste y versión de LucaLib (la ves en la pestaña `Ajustes`, clave `luca.version`).

Responderemos en un plazo de 7 días y te mantendremos al tanto hasta publicar la corrección. Agradeceremos tu
reporte en el aviso de seguridad, salvo que prefieras quedar en el anonimato.

**No pruebes contra cuentas, Sheets o Web Apps de otras personas**, ni contra `lucaa.lat` o `mcp.lucaa.lat` con
cargas que afecten su disponibilidad. Usa tu propia copia de la plantilla y un Worker local (`wrangler dev`).

## Versiones soportadas

Solo la última versión de LucaLib recibe correcciones. Las copias de los usuarios no se actualizan solas: si una
corrección afecta a LucaLib, la web y el panel de la Sheet avisan de la versión nueva.

## Modelo de amenazas en resumen

| Frontera | Control |
|---|---|
| Web ↔ Google | OAuth de Google con `drive.file`; tokens solo en la cookie JWT cifrada del usuario |
| Cliente MCP ↔ Worker | OAuth 2.1 (`workers-oauth-provider`) y código de pairing de un solo uso con TTL |
| Worker ↔ Apps Script del usuario | Secreto por tenant enviado en cada llamada a `/exec` y lista blanca de operaciones |
| iPhone ↔ Apps Script del usuario | Token por dispositivo, regenerable y revocable desde la Sheet |
| UI de la Sheet ↔ LucaLib | `lucaRun` → `dispatch` con lista blanca de funciones |
| Apps Script ↔ LLM | Opcional, key del usuario; solo `comercio + monto` (extractor opt-in con texto enmascarado) |

Las decisiones de diseño están en [`docs/architecture/`](docs/architecture/).
