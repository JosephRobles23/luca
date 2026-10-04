# ADR-007 — Infraestructura, dominio, cuotas y marco legal

Fecha: 2026-10-04 · Estado: **aceptado**

## Decisiones
1. **Dominio `lucaa.lat`** (registrador: Spaceship). **DNS en Cloudflare** (cuenta compartida con CoS-Agent). Subdominios: `lucaa.lat` y `www` → Vercel (CNAME); `mcp.lucaa.lat` → Worker `luca-mcp` (ruta/custom domain de Cloudflare); `api.lucaa.lat` reservado.
2. **Web en Vercel Hobby.** Luca es **gratuito, sin anuncios ni analítica**, lo que encaja en la cláusula de uso no comercial. Disparador de migración: cualquier cobro o promoción de servicios.
3. **Worker `luca-mcp` en la misma cuenta de Cloudflare que Vera-MCP.** Tokens y datos no se mezclan (Worker, KV, D1 y proveedor OAuth propios), pero el free tier es por cuenta. Mitigaciones: `accessTokenTTL` = 24 h en el proveedor OAuth de Luca; **si Writes (24h) de KV > 600 → Workers Paid ($5/mes)**. Estimación S5: 3–5 escrituras por conexión, ~2 por refresh.
4. **Cliente OAuth "Luca Web"** en el proyecto GCP `luca-510610`: pasar a **producción** una vez publicadas `https://lucaa.lat`, `/privacidad` y `/terminos` y completada la marca. Hasta entonces, usuarios de prueba a mano. Scopes: `openid email profile drive.file` (no sensibles). Nunca Gmail en nuestro cliente.
5. **Responsable del tratamiento:** el autor como persona natural, contacto `gavynenita@gmail.com`. Las páginas legales describen literalmente la arquitectura: datos en el Google del usuario; Luca no almacena transacciones; el MCP y la web transitan datos solo a petición del usuario y sin retención; logs del Worker sin payloads; el canal iPhone va directo al Apps Script del usuario sin pasar por Luca.
6. **Scopes del Apps Script del usuario** (su propio proyecto por defecto, uso personal, sin verificación ni CASA): `openid`, `userinfo.email`, `spreadsheets`, `gmail.readonly`, `drive.file`, `script.external_request`, `script.scriptapp`, `script.container.ui`.
7. **Secretos**: nunca en el repo ni en el chat. `.env.local`, `.dev.vars` y credenciales de clasp ignorados por git; `.clasp.json` (solo scriptIds) sí se versiona. Token de Cloudflare expuesto el 2026-10-04 → rotar.

## Fuera de alcance explícito
Wallet Transaction (Apple Pay), Android (por ahora), otros bancos, GCP/Oracle como hosting, cualquier configuración de nube por parte del usuario final.
