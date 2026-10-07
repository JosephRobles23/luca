# Luca · Pitch animado

Pitch de producto (2:22, 1920×1080, 30 fps) estilo keynote de Silicon Valley: presenta Luca, la arquitectura
"tu Sheet es la base de datos, tu Google es el backend, la web solo renderiza", el conector MCP y que es gratis.
Cada cuadro lo dibuja `film.js` en Canvas con `draw(ctx, t)`: sin imágenes ni librerías, sin `Math.random` ni
relojes (todo sale de `t` y de hashes sembrados). Mismo motor que el corto "Del deseo al video"
(`ia-academy/docs/new-architecture`), con lenguaje visual nítido y la paleta oscura de la web.
Proyecto personal: logos de Yape, BCP, Gmail, Sheets, Apps Script, Claude, ChatGPT y MCP dibujados por código.
Guion y línea de tiempo: `storyboard.md`. Narración: `narracion.json`, en dos versiones de voz:

| Versión | Voz | Video | Página |
|---|---|---|---|
| original | Charon (Chirp 3 HD), masculina, grave y pausada | `luca-pitch.mp4` | `index.html` |
| `mujer` | Sulafat (Gemini-TTS `gemini-2.5-pro-tts`), femenina, cálida, dirigida con instrucciones de estilo | `luca-pitch-mujer.mp4` | `index.html?voz=mujer` |

Las herramientas eligen la versión con `VOICE_SET` (sin definir = original): `VOICE_SET=mujer node tools/…`.

## Ver

`index.html` necesita servirse por HTTP (las fuentes y el audio no cargan bien con `file://`):

```sh
npx serve video        # o: python3 -m http.server -d video 8080
```

Botón ▶ (o espacio) reproduce con banda sonora; el scroll mueve el tiempo y pausa; capítulos, CC y sonido.
Si el equipo tarda más de 30 ms por cuadro, la página pasa sola a modo ligero (`Film.setQuality(0)`).

## Herramientas

Viven fuera del repo en `/tmp/anim-tools` (o `ANIM_TOOLS=/ruta/package.json`):

```sh
mkdir -p /tmp/anim-tools && cd /tmp/anim-tools && npm init -y && npm i canvas@3 ffmpeg-static ffprobe-static
```

Si hay `/usr/bin/ffmpeg` y `/usr/bin/ffprobe` se usan esos.

```sh
node tools/render-frames.mjs 30.5 41.2         # cuadros sueltos → frames/t-XXX.XX.png
node tools/render-frames.mjs --sheet --n 9     # hoja de contacto por escena → frames/sheet-*.png
node tools/render-frames.mjs --grid 30 40 50   # varias marcas en una imagen → frames/grid.png
node tools/render-frames.mjs --debug logos     # piezas: logos | dashboard | sheet
node tools/narrate.mjs                         # voz Charon → audio/narr/*.wav + manifest.json + captions.js
node tools/audio.mjs                           # música + efectos + voz → audio/banda-sonora.m4a
node tools/export-mp4.mjs                      # → luca-pitch.mp4 (h264 crf 18 + AAC si hay banda sonora)
node tools/export-mp4.mjs --no-captions --out luca-pitch-sin-subtitulos.mp4
VOICE_SET=mujer node tools/narrate.mjs && VOICE_SET=mujer node tools/audio.mjs && VOICE_SET=mujer node tools/export-mp4.mjs
```

## Narración (Google Cloud TTS)

`tools/narrate.mjs` llama a la API REST con el token de `gcloud auth print-access-token` y el proyecto de
cuota `GCP_PROJECT` (por defecto `luca-510610`, con `texttospeech.googleapis.com` y, para Gemini-TTS,
`aiplatform.googleapis.com` habilitadas). Errores transitorios (403 de propagación, 429, 5xx) se reintentan.

- **Charon** (`es-US-Chirp3-HD-Charon`): `speakingRate` 0.95; si una línea no cabe en su ventana sube hasta 1.1.
  `say` es la grafía para siglas y palabras en inglés (BCP → "be ce pe", Claude → "Clod").
- **Sulafat** (`VOICE_SET=mujer`, Gemini-TTS): recibe una instrucción de estilo común (fundadora presentando
  su producto en un keynote, cálida, cercana, sin sonar leída; `STYLE` en `tools/narrate.mjs`) más el matiz de
  cada línea (`tone`). Entiende las marcas, así que usa `text` o `sayG`. Si una línea no cabe, primero pide un
  ritmo más ágil y después sube `speakingRate`. Gemini-TTS no es determinista: cada corrida suena un poco
  distinta, y a veces cambia una palabra. Conviene transcribir los clips y resintetizar los que fallen con
  `--only <id>` (así se corrigieron "Nada." y "yapeo").

Si una línea no cabe ni así, el script falla y hay que acortar el texto. El guion está duplicado en
`film.js` (`NARRATION`, para los subtítulos) y el script verifica que ambos coincidan.

## Audio

`tools/audio.mjs` (~25 s): música electrónica mínima (96 BPM, La menor, Am–F–C–G; pad, pulso, arpegio, bombo
y bajo por secciones; drop tras "Aquí está la idea central" y silencio antes de "Nada."), unos 180 efectos
de UI sintetizados (notificaciones, tachados, partículas, clics, tecleo, idas y vueltas MCP) leídos de
`Film.TIMING`, ducking bajo la voz (música −9 dB, efectos −4 dB), saturación suave y `loudnorm` de ffmpeg en
dos pasadas a −16 LUFS / −1.5 dBTP. Stems: `audio/{music,sfx,narration}.wav` (en `.gitignore`).

## Demo vertical: atajo de iPhone + yapeo real

`grabacion/yape-luca.mp4` (grabación de pantalla del iPhone, 4:11, 384×832) → `yape-luca-edit.mp4` (~65 s,
1080×1920, para Reels/Stories/LinkedIn). La grabación va dentro de un iPhone dibujado y encima van motion graphics
hechos con las piezas de `film.js` (`Film.art`: paleta, Geist, logos): títulos por paso, anillos con etiqueta,
foco que oscurece el resto, zoom de cámara, congelados, insignia "Conectado", la notificación push de Yape
ampliada y flotando con el flujo Push → Atajo → Sheet → lucaa.lat, el contador 113 → 114 y una placa de cierre.
Lo que solo es espera (el atajo "ensamblándose", la navegación hasta que llega el yapeo) se acelera o se corta.

La URL del Web App y el token del iPhone, que se ven en claro en el prompt pegado en Atajos, se difuminan solo
dentro de su rectángulo (`BLUR` en la línea de tiempo). Ese token quedó grabado: conviene regenerarlo en
Conexiones antes de publicar el video original.

```sh
node tools/yape-edit.mjs --sheet 30            # hoja de contacto → frames/yape-sheet.png
node tools/yape-edit.mjs --frames 31.5 46      # cuadros sueltos (segundos de salida) → frames/yape-XX.XX.png
node tools/yape-audio.mjs                      # música + efectos sincronizados → audio/yape-banda.m4a (~15 s)
node tools/yape-edit.mjs                       # → yape-luca-edit.mp4 (h264 crf 17 + la banda si existe)
```

Todo lo editable vive en `tools/yape-timeline.mjs`: segmentos (tramo de la grabación y su velocidad, congelados,
placas), títulos, cámara, efectos (con tiempos relativos al segmento) y rectángulos en píxeles de la grabación.
La música lee de ahí mismo las señales (anillos, cortes, congelados, tramos acelerados) para colocar sus efectos.

## Archivos

| Archivo | Qué es |
|---|---|
| `film.js` | Motor (primitivas, cámara, estelas, partículas, fundidos), logos, iPhone, Google Sheet, resumen de lucaa.lat (SpentCard, PendingCard, CategoryBreakdown, SixMonths, TopMerchants, MonthMovements), chat y 8 escenas. UMD |
| `index.html` | Reproductor: canvas 16:9, scroll → tiempo, ▶, capítulos, CC, sonido, subtítulos accesibles |
| `storyboard.md` | Plan: dirección visual, voz y línea de tiempo |
| `narracion.json` | Guion de la narración (tiempos, texto, grafía para la voz) |
| `captions.js` | Fin real de cada subtítulo (generado por `narrate.mjs`) |
| `fonts/` | Geist y Geist Mono (OFL), las tipografías de la web |
| `tools/` | `env.mjs` (canvas + fuentes + ffmpeg), `render-frames`, `export-mp4`, `narrate`, `audio`; demo vertical: `yape-timeline`, `yape-edit`, `yape-audio` |
| `audio/` | `banda-sonora.m4a`, `narr/` (voz), `cues.json`, `mix-info.json` |

Datos del video: sintéticos (octubre 2026), coherentes entre escenas (el yapeo de S/ 45.00 de "María T."
que llega al iPhone es la fila nueva de la hoja y la fila resaltada del resumen).
