# Edición del demo grabado

Dos montajes de la misma grabación (`src/Root.tsx`):

| Composición | Salida | Voz | Duración |
|---|---|---|---|
| `LucaDemo` | `../luca-demo.mp4` | la tuya, completa (sin cortes) | 9:51 |
| `LucaNarrado` | `../luca-demo-narrado.mp4` | Sulafat (Gemini-TTS), la de `luca-pitch-mujer.mp4`, + música | ~3:50 |

## LucaDemo

Toma `../grabacion/Ajustes - Google Chrome 2026-10-05 13-39-30.mp4` (9:48, 1920×1140, voz en vivo) y produce
`../luca-demo.mp4` (1920×1080, 30 fps): marco con sombra sobre fondo oscuro, zooms de cámara con easing
(power3.inOut, como GSAP), resaltados con foco y etiqueta, rótulos de capítulo, subtítulos breves y cierre.
La voz se conserva entera y sincronizada; no hay cortes.

Hecho con Remotion (React → cuadros): cada cuadro sale de `t`, así que el render es determinista.

```sh
cd video/edicion
npm install
ln "../grabacion/Ajustes - Google Chrome 2026-10-05 13-39-30.mp4" public/grabacion.mp4   # enlace duro: Remotion no copia symlinks
npm run studio                 # previsualizar y ajustar en el navegador
node tools/stills.mjs          # un cuadro por resaltado → out/stills/ (o: node tools/stills.mjs 44 160.5)
npm run render                 # → out/luca-demo-raw.mp4 (~20-30 min)
node tools/finish.mjs          # limpia y normaliza la voz → ../luca-demo.mp4
```

Todo lo editable está en `src/cues.ts` (tiempos en segundos del original, rectángulos en píxeles de la grabación):
`SHOTS` (cámara), `HIGHLIGHTS` (foco + etiqueta), `CAPTIONS` y `CHAPTERS`. El aspecto, en `src/LucaDemo.tsx`. Las fuentes Geist van incrustadas en `src/fonts.ts` como `@font-face` con data URL
(cargarlas con `FontFace` + `delayRender` se colgaba en las pestañas del render bajo carga).

## LucaNarrado

El guion está en `narracion-demo.json`: tramos `{id, src: [desde, hasta], text, sayG?, tone?}` sobre el original y
`cuts` (rangos que se eliminan; aquí, la desinstalación del conector anterior). Cada tramo dura lo que su línea de voz
más un respiro: el video del tramo se acelera hasta 8× para caber o, si la voz es más larga, se congela el último
cuadro (`src/timeline-core.mjs`). Cámara, resaltados y capítulos se reutilizan de `src/cues.ts`, convertidos al nuevo
tiempo; los resaltados que quedan por debajo de 1 s se omiten. Lleva subtítulos de la narración.

```sh
node tools/narrate.mjs            # voz → public/narr/*.wav + src/narr-manifest.json  (--only b07 para una línea)
node tools/music.mjs              # cama musical (Am–F–C–G, baja bajo la voz) → public/musica.wav
node tools/stills.mjs --narrado   # un cuadro por resaltado → out/stills-narrado/
npm run render:narrado            # → out/luca-narrado-raw.mp4 (~30 min)
node tools/finish.mjs --tts out/luca-narrado-raw.mp4 ../luca-demo-narrado.mp4
```

Si cambias el texto de una línea: `narrate.mjs --only <id>`, luego `music.mjs` (el ducking depende de los tiempos) y render.
Gemini-TTS no es determinista; conviene transcribir los clips y rehacer los que cambien una palabra.
