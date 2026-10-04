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

## Estructura

```text
gas/shared/      LucaLib (librería Apps Script): parsers de correo, ledger, escaneo Gmail, ajustes, UI
gas/stub/        script ligado a la plantilla de Sheet (bootloader delgado; copiado con files.copy)
services/        luca-mcp (Worker Cloudflare, fork de Vera-MCP) — pendiente
spikes/          experimentos de validación S1–S7 y resultados
tests/           harness vm de Node con mocks de Apps Script + fixtures sintéticos
docs/            arquitectura, ADRs, research, discovery, guías
```

## Desarrollo

```bash
npm test            # 29 tests en Node (sin tocar Google)
npm run lib:push    # clasp push de LucaLib (requiere gas/shared/.clasp.json)
npm run stub:push   # clasp push del stub a la plantilla
```
