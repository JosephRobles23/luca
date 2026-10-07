// Línea de tiempo de la edición de grabacion/yape-luca.mp4 (grabación de pantalla del iPhone, 384×832, 30 fps).
// La comparten tools/yape-edit.mjs (video) y tools/yape-audio.mjs (música y efectos).
//
// Segmentos, en orden:
//   { card: 'intro' | 'outro', dur }       placa animada sin grabación
//   { src: [a, b], speed }                 tramo de la grabación (segundos de la grabación), acelerado ×speed
//   { hold: t, dur }                       cuadro congelado en t
// Opcionales: cap: [kicker, título] (se queda hasta el siguiente cap), cam: { z, f: [x, y] } (zoom hacia un punto),
// note: texto de una píldora al entrar, fx: efectos con tiempos relativos al inicio del segmento (s de salida).
// Rectángulos [x, y, w, h] en píxeles de la grabación (384×832). La lectura de la grabación es secuencial:
// cada segmento empieza donde terminó el anterior o después (layout() lo verifica).

export const SRC_W = 384, SRC_H = 832, FPS = 30;

// Zonas difuminadas (URL del Web App y token del iPhone en el prompt pegado en Atajos), en segundos de la grabación
export const BLUR = [
  { from: 33.3, to: 38.7, rect: [12, 536, 360, 268] },
];

const ring = (rect, at, label, o = {}) => ({ type: 'ring', rect, at, label, ...o });

export const TIMELINE = [
  { card: 'intro', dur: 3.4 },

  // Paso 1: la web genera el prompt del atajo
  { src: [19.5, 23.0], speed: 1.75, cap: ['PASO 1 · LUCAA.LAT', 'Conectar iPhone, desde la web'] },
  { src: [23.0, 27.0], speed: 1.3, cap: ['PASO 1 · LUCAA.LAT', 'Copias el prompt del atajo'],
    fx: [ring([40, 538, 146, 46], 0.15, 'Copiar prompt', { until: 1.6 }), ring([14, 680, 356, 50], 1.7, 'Listo, copiado', { color: 'success' })] },
  { src: [27.0, 31.2], speed: 3 },

  // Paso 2: Atajos arma el atajo solo
  { src: [33.6, 37.8], speed: 1.4, cap: ['PASO 2 · ATAJOS', 'Lo pegas y Atajos lo arma'], flash: true,
    fx: [{ type: 'lock', rect: [12, 536, 360, 268], at: 0.3 }] },
  { src: [38.5, 53.0], speed: 8 },
  { src: [53.0, 58.0], speed: 1.4, fx: [ring([30, 138, 330, 384], 0.4, 'Atajo creado', { color: 'success' })] },

  // Paso 3: prueba
  { src: [58.0, 74.0], speed: 4, cap: ['PASO 3 · PRUEBA', 'Lo ejecutas una vez'] },
  { src: [74.0, 81.6], speed: 2.2 },
  { src: [81.6, 82.1], speed: 1 },
  { hold: 82.1, dur: 1.3, fx: [ring([14, 58, 356, 136], 0.05, 'El script respondió ok', { color: 'success' })] },
  { src: [82.1, 86.0], speed: 2.6 },
  { src: [86.0, 87.0], speed: 1, cap: ['PASO 3 · PRUEBA', 'La web la recibe al instante'] },
  { hold: 87.0, dur: 3.0, cam: { z: 1.32, f: [193, 440] },
    fx: [ring([26, 350, 332, 172], 0.25, null, { color: 'success', width: 7 }),
      { type: 'badge', at: 0.55, text: 'Conectado', color: 'success' },
      { type: 'burst', at: 0.55, at2: [193, 400] }] },

  // Paso 4: automatización
  { src: [87.0, 93.0], speed: 2.4, cap: ['PASO 4 · AUTOMATIZACIÓN', 'Cada yapeo la dispara solo'] },
  { hold: 93.0, dur: 1.8, fx: [ring([26, 72, 334, 94], 0.1, 'Listo para tu primer yapeo', { color: 'success' })] },

  // El yapeo real
  { src: [142.0, 146.2], speed: 2, cap: ['LA PRUEBA REAL', 'Nolberto me yapea S/ 1.50'], flash: true,
    fx: [ring([12, 188, 152, 38], 0.3, 'Aún 0 yapeos')] },
  { src: [146.2, 149.6], speed: 1, fx: [ring([6, 50, 374, 90], 0.5, 'Nolberto me manda su captura')] },
  { src: [212.2, 213.5], speed: 1, cap: ['PUSH DE YAPE', 'El atajo lee la notificación'], flash: true, note: '1 minuto después' },
  { hold: 213.5, dur: 3.8, cam: { z: 1.12, f: [192, 330] },
    fx: [{ type: 'spot', rect: [16, 220, 358, 72], at: 0.1 },
      ring([16, 220, 358, 72], 0.25, null, { color: 'yape', width: 6 }),
      { type: 'lift', rect: [16, 220, 358, 72], at: 0.7, y: 450, scale: 2.4 }] },
  { src: [228.0, 233.2], speed: 1.6, cap: ['EN LUCAA.LAT', 'Y ya está en tus movimientos'], flash: true },
  { hold: 233.2, dur: 3.0,
    fx: [ring([12, 127, 94, 30], 0.1, null, { width: 5 }),
      { type: 'counter', at: 0.2, from: 113, to: 114, rect: [12, 127, 94, 30] },
      ring([12, 163, 148, 30], 0.9, null, { color: 'yape', width: 5 }),
      ring([14, 486, 358, 64], 1.3, 'Nolberto Roj* · + S/ 1.50', { color: 'success', side: 'up' })] },
  { src: [233.2, 236.0], speed: 2 },
  { src: [244.0, 247.0], speed: 1.2, cap: ['EN LUCAA.LAT', 'Con su origen: push de Yape'] },
  { hold: 247.0, dur: 3.0, cam: { z: 1.22, f: [200, 330] },
    fx: [ring([34, 244, 344, 58], 0.1, '+ S/ 1.50 recibido', { color: 'success', side: 'up' }),
      ring([40, 404, 336, 34], 0.8, 'Fuente: Yape push', { color: 'yape', side: 'down' })] },

  { card: 'outro', dur: 4.2 },
];

// Tiempos de salida de cada segmento y señales para el audio
export function layout(tl = TIMELINE) {
  let t = 0, lastSrc = 0, cap = null;
  const segs = tl.map((s, i) => {
    const dur = s.card || s.hold != null ? s.dur : (s.src[1] - s.src[0]) / s.speed;
    if (s.src) {
      if (s.src[0] < lastSrc - 1e-6) throw new Error(`segmento ${i}: la grabación retrocede (${s.src[0]} < ${lastSrc})`);
      lastSrc = s.src[1];
    } else if (s.hold != null) {
      if (s.hold < lastSrc - 1e-6) throw new Error(`segmento ${i}: hold ${s.hold} antes de ${lastSrc}`);
      lastSrc = s.hold;
    }
    const newCap = !!s.cap && s.cap.join() !== cap?.join();
    if (s.cap) cap = s.cap;
    const o = { ...s, i, start: t, end: t + dur, dur, cap: s.card ? null : cap, newCap };
    t += dur;
    return o;
  });
  const cues = [];
  for (const s of segs) {
    if (s.card) cues.push({ t: s.start, kind: s.card });
    if (s.flash) cues.push({ t: s.start, kind: 'cut' });
    if (s.hold != null) cues.push({ t: s.start, kind: 'freeze' });
    if (s.speed >= 2) cues.push({ t: s.start, kind: 'fast', dur: s.dur });
    if (s.newCap) cues.push({ t: s.start + 0.1, kind: 'caption' });
    for (const f of s.fx || []) cues.push({ t: s.start + f.at, kind: f.type, color: f.color });
  }
  return { segs, duration: t, cues: cues.sort((a, b) => a.t - b.t) };
}
