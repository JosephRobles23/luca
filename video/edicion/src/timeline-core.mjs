// Línea de tiempo del demo narrado, compartida por Remotion (src/timeline.ts) y tools/music.mjs.
// Cada tramo de narracion-demo.json dura lo que su línea de voz más un respiro; el video del tramo se acelera
// para caber (tiempos muertos fuera) o, si la voz es más larga que el tramo, se congela el último cuadro.

export const LEAD = 0.35; // silencio antes de cada línea
export const TAIL = 0.7; // respiro después de cada línea
export const MAX_SPEED = 8;
export const MIN_SPEED = 0.85; // más lento que esto se ve en cámara lenta: mejor 1× y congelar

// → { pieces: [{srcFrom, srcTo, outFrom, playDur, hold}], lines: [{id, text, start, dur}], duration }
export function buildTimeline({cuts = [], beats}, durations) {
  const pieces = [];
  const lines = [];
  let out = 0;
  for (const b of beats) {
    // el rango del tramo menos los cortes
    let ranges = [b.src];
    for (const [ca, cb] of cuts)
      ranges = ranges.flatMap(([a, z]) => (cb <= a || ca >= z ? [[a, z]] : [[a, ca], [cb, z]].filter(([x, y]) => y - x > 0.05)));
    const srcLen = ranges.reduce((s, [a, z]) => s + z - a, 0);
    const voice = durations[b.id] ?? 0;
    const lead = lines.length ? LEAD : 0.6;
    const outDur = Math.max(lead + voice + TAIL, srcLen / MAX_SPEED);
    let speed = srcLen / outDur;
    let hold = 0;
    if (speed < MIN_SPEED) {
      speed = 1;
      hold = outDur - srcLen;
    }
    lines.push({id: b.id, text: b.text, start: out + lead, dur: voice});
    for (const [i, [a, z]] of ranges.entries()) {
      const playDur = (z - a) / speed;
      pieces.push({srcFrom: a, srcTo: z, outFrom: out, playDur, hold: i === ranges.length - 1 ? hold : 0});
      out += playDur;
    }
    out += hold;
  }
  return {pieces, lines, duration: out};
}

// Tiempo del original → tiempo de salida (los instantes dentro de un corte caen al inicio del siguiente tramo)
export function toOut(tl, s) {
  for (const p of tl.pieces) {
    if (s < p.srcFrom) return p.outFrom;
    if (s <= p.srcTo) return p.outFrom + ((s - p.srcFrom) / (p.srcTo - p.srcFrom)) * p.playDur;
  }
  return tl.duration;
}
