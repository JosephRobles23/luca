# Storyboard · "Luca — Tus finanzas. Tu Google." (2:22)

Pitch de producto estilo keynote de Silicon Valley para un público profesional (emprendedores de tecnología).
Mismo motor que `ia-academy/docs/new-architecture` (corto "Del deseo al video"): cada cuadro lo dibuja
`film.js` en Canvas 2D con `draw(ctx, t)`, determinista (sin `Math.random` ni relojes, sin imágenes; los
logos se dibujan por código). 1920×1080, 30 fps, 142 s. Proyecto personal: usa los logos de Yape, BCP,
Gmail, Google Sheets, Apps Script, Claude, ChatGPT y MCP.

## Dirección visual

- **Lenguaje**: vectorial nítido, sin temblor. Curvas *ease-out expo* y *springs* amortiguados; la cámara
  nunca está quieta (dolly de 2–3 %). Una idea por pantalla.
- **Paleta**: los tokens del modo oscuro de la web (`apps/web/src/app/globals.css`): fondo `#0b0b0b`,
  tarjetas `#171717`/`#1f1f1f`, líneas `#272727`, tinta `#ede7dd`, cuerpo `#c4bdb3`, apagado `#8b857c`,
  acento `#d9623b`/`#f08a5d`, pasteles de categoría (`--cat-*`). Verde Sheets `#0f9d58` solo cuando aparece
  la hoja.
- **Tipografía**: Geist y Geist Mono (las de la web), incluidas en `fonts/`.
- **Componentes**: el dashboard se redibuja en Canvas con las proporciones de `SpentCard`, `PendingCard`,
  `CategoryBreakdown`, `SixMonths`, `TopMerchants` y `MonthMovements`.
- **Leitmotiv**: lo que Luca *no* tiene (base de datos, servidores, cobro) se tacha y se desintegra en
  partículas.
- **Acabado**: grano fino + viñeta. Subtítulos en el cuadro, desactivables (`Film.setCaptions(false)`).
- **Datos**: sintéticos (octubre 2026). Gasto S/ 2,847.30, 8 categorías, 6 meses, yapeo de S/ 45.00 de
  "María T.", consumo BCP de S/ 38.90 en Rappi, taxi de S/ 18.00 registrado por la IA.

## Voz

Dos versiones, mismo guion (`narracion.json`) y misma música y efectos:

- **Original**: Google Cloud TTS `es-US-Chirp3-HD-Charon` (masculina, grave, pausada), `speakingRate` 0.95
  (sube hasta 1.1 si una línea no cabe en su ventana) → `luca-pitch.mp4`.
- **Mujer**: Gemini-TTS `gemini-2.5-pro-tts`, voz Sulafat (femenina, cálida), dirigida como una fundadora en
  un keynote, con un matiz por línea (`tone`) → `luca-pitch-mujer.mp4`.

## Línea de tiempo

| # | Escena | t (s) | Qué pasa | Idea |
|---|---|---|---|---|
| 0 | Apertura | 0–8 | Negro. Una línea terracota de 1 px cruza la pantalla y se pliega en las facetas del logo de Luca; aparece el wordmark y "Finanzas personales, sin servidores." | Presentación |
| 1 | El problema | 8–22 | Un iPhone. Caen notificaciones de Yape y BCP cada vez más rápido, se apilan, se desenfocan. Contador: "37 movimientos este mes · 0 registrados". | El dato existe pero se pierde |
| 2 | El viaje de un yapeo | 22–50 | Plano secuencia: zoom a "Recibiste S/ 45.00", el atajo de iOS se dispara, la notificación se vuelve un paquete JSON y viaja por un trazo con estela, esquivando una caja tachada "servidores de Luca", hasta "Tu Apps Script · tu identidad": Parser → Dedupe → Categoría. Por un segundo carril llega un correo BCP de Gmail. Ambos aterrizan como filas nuevas en la Google Sheet. | Ingesta directa, en el Google del usuario |
| 3 | La hoja es el centro | 50–68 | La cámara recentra la Sheet como núcleo. Un cilindro "base de datos" y un rack "servidores" se tachan y se desintegran. Rótulos: Base de datos → tu Sheet · Backend → tu Google · Datos en Luca → 0 bytes. Salen dos ramas: Web e IA. | Arquitectura sin backend propio |
| 4 | La web, una ventana | 68–98 | Los datos suben desde la hoja a un navegador de vidrio (lucaa.lat). El dashboard se arma con `rise()`: SpentCard (cifra que cuenta, delta, barra de ritmo, trío), PendingCard, CategoryBreakdown, SixMonths, TopMerchants, MonthMovements con el yapeo resaltado. Un cursor recategoriza "Starbucks" → la celda de la hoja cambia al instante. Al final el contenido se vuelve transparente: "0 bytes de tus datos". | La web solo renderiza la hoja |
| 5 | Pregúntale a tu IA | 98–122 | Ventana de chat con selector Claude/ChatGPT. Claude: "¿En qué gasté más este mes?" → herramienta `category_breakdown` vía MCP (diagrama IA → mcp.lucaa.lat → Apps Script → Sheet, ida y vuelta) → respuesta con mini barra de categorías. ChatGPT: "Agrega 18 soles de taxi" → `add_expense` → fila nueva en la hoja. | Conector MCP |
| 6 | Gratis | 122–134 | Todo el sistema encendido a la vez; se oscurece salvo "S/ 0". Precios S/ 29.90 y S/ 9.90 tachados. Tres columnas: Sin tarjeta · Sin configurar nubes · Código abierto (MIT). | Gratis por diseño |
| 7 | Cierre | 134–142 | Logo, lucaa.lat, "Tus finanzas. Tu Google." Las notificaciones del inicio orbitan, ya ordenadas. Fundido a negro. | Cierre |

## Técnica

- `film.js`: motor + logos + componentes + 8 escenas. UMD (`window.Film` / `require`). Exporta `TIMING`
  con los golpes que usa `tools/audio.mjs`.
- `index.html`: canvas 16:9, scroll → `t`, ▶, capítulos, CC, sonido, subtítulos accesibles.
- `tools/render-frames.mjs`: cuadros y hojas de contacto. `tools/export-mp4.mjs`: MP4 (h264 crf 18).
- `tools/narrate.mjs`: Charon vía REST de Cloud TTS con el token de `gcloud`.
- `tools/audio.mjs`: música electrónica mínima y efectos (UI ticks, whoosh, impactos) procedurales,
  ducking bajo la voz, loudnorm −16 LUFS → `audio/banda-sonora.m4a`.
