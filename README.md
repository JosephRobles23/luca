# Luca

Gestión de gastos personales sobre la infraestructura de Google del propio usuario: Apps Script lee las notificaciones de BCP y Yape que llegan a Gmail, las normaliza y categoriza en un Google Sheet; una web con dominio propio muestra el dashboard leyendo la Sheet directamente desde el navegador; un servidor MCP permite consultar e ingresar movimientos desde Claude o ChatGPT.

Principio rector: **los datos viven y se procesan en el Google del usuario.** Luca no almacena transacciones.

## Documentación

- `docs/architecture/arquitectura-base.md` — propuesta de arquitectura v0
- `docs/architecture/adr-001-acceso-mcp-a-datos.md` — cómo llega el MCP a los datos
- `docs/research/` — investigaciones con fuentes (hosting, provisioning, iOS 27)
- `docs/discovery/` — formatos de correos BCP/Yape, reuso de CoS-Agent, captura por iOS
- `docs/guides/guia-atajos-ios27-yape.md` — experimentos en iPhone
- `docs/html/dashboard-mock.html` — mockup del dashboard
