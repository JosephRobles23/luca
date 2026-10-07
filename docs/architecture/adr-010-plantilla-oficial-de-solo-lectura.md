# ADR-010 — La plantilla oficial nunca guarda datos

Fecha: 2026-10-06 · Estado: **aceptado** · Complementa ADR-009 (el usuario copia la plantilla).

## Contexto
Con ADR-009 cada usuario hace su copia de la plantilla "Luca Template"
(`1kQWNaj9J29LRK-LsdCAxrplW06heaTvS3Hje3NV1htg`) con "Hacer una copia". Esa copia arrastra **todo** el contenido de
la Sheet: pestañas (`Movimientos`, `Comercios`, `_Procesados`, `Categorías`) y `Ajustes`, que guarda el token del
iPhone y la URL `/exec` (ADR-003). No arrastra triggers, implementaciones del Web App ni UserProperties.

El 2026-10-06 la cuenta operadora ejecutó "Autorizar" dentro de la plantilla: se instaló el trigger de 15 min, se
importó su Gmail y el atajo de su iPhone quedó apuntando ahí. Cada copia nueva salió con los movimientos, los
comercios y el token del operador, y como la plantilla es pública de lectura (ADR-009), cualquiera con el enlace
también los veía.

## Decisión
LucaLib reconoce la plantilla oficial por su ID (`PLANTILLAS_OFICIALES_` en `settings-runtime.js`, el mismo valor que
`NEXT_PUBLIC_TEMPLATE_SHEET_ID`) y, dentro de ella:

- **Autorizar** solo avisa ("crea tu copia desde lucaa.lat"): no llama a `setupTriggers`, no fija cursor ni importa.
- **`runDispatcher`** (un trigger que haya quedado instalado) devuelve `{ skipped: 'plantilla' }` sin tocar Gmail.
- **Web App**: el GET sigue respondiendo (versión); todo POST (`?events=1` del iPhone y `?mcp=1`) responde
  `{ ok:false, error:'template' }` sin escribir.
- **`lucaRun`** solo acepta una lista blanca (`DISPATCH_PLANTILLA_`): leer, estado, dashboard, categorías, aplicar
  estilo, preferencias de UI y abrir paneles. El resto (escanear, importar, conectar iPhone/MCP, guardar Ajustes,
  API key, categorizar) falla con el mensaje de plantilla.
- `estadoLuca` devuelve `plantilla: true`, no sincroniza `conexiones.execUrl` (quedaría en Ajustes y se copiaría) y el
  sidebar muestra un aviso fijo.

Las copias tienen otro ID, así que su comportamiento no cambia.

## Consecuencias
- Mantener la plantilla (estilo, encabezados, categorías base) sigue siendo posible desde el menú y editando a mano.
- Si se crea otra plantilla oficial, su ID se añade a `PLANTILLAS_OFICIALES_` en la misma release que cambia
  `NEXT_PUBLIC_TEMPLATE_SHEET_ID`.
- La protección llega con la release de LucaLib que la incluye; la plantilla usa la versión fijada en
  `gas/stub/appsscript.json`, así que hay que publicar y subir esa versión (`/deploy-luca`).
- Las copias hechas antes de limpiar la plantilla conservan los datos copiados: no se pueden borrar desde aquí
  (son del usuario). Por eso, además de la protección, la plantilla se limpia a mano y el token se regenera.
