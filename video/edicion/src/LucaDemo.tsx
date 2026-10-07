import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CAPTIONS,
  CHAPTERS,
  HIGHLIGHTS,
  OUTRO,
  Rect,
  SHOTS,
  SRC_H,
  SRC_W,
  Shot,
} from './cues';
import {FONTS} from './fonts';
import {NARRADO, ORIGINAL, Timeline, toOut} from './timeline';

const W = 1920;
const H = 1080;
const BASE = 0.88; // escala del video en plano completo (deja un marco alrededor)
const MAX_Z = 2.2;
const PRIMARY = '#d9623b';
const FONT = 'Geist, system-ui, sans-serif';
const MONO = 'Geist Mono, ui-monospace, monospace';

// Curvas tipo GSAP: power3.inOut para la cámara, power3.out para entradas
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.22, 1, 0.36, 1);

// @font-face con data URL: sin delayRender (FontFace.load() se colgaba en pestañas del render bajo carga)
const FONT_CSS = FONTS.map(
  ([family, weight, b64]) =>
    `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${b64}) format('truetype');}`,
).join('');

type Cam = {cx: number; cy: number; z: number};
const FULL: Cam = {cx: SRC_W / 2, cy: SRC_H / 2, z: 1};

function shotCam(s: Shot): Cam {
  if (s.rect) {
    const [x, y, w, h] = s.rect;
    const z = s.z ?? Math.min((W * 0.92) / (w * BASE), (H * 0.88) / (h * BASE));
    return {cx: x + w / 2, cy: y + h / 2, z: Math.max(1, Math.min(MAX_Z, z))};
  }
  if (s.center) return {cx: s.center[0], cy: s.center[1], z: s.z ?? 1.5};
  return FULL;
}

// Evita que la cámara muestre fuera de la grabación cuando hay zoom
function clampCam(c: Cam): Cam {
  const s = BASE * c.z;
  const hw = W / 2 / s;
  const hh = H / 2 / s;
  const cx = hw >= SRC_W / 2 ? SRC_W / 2 : Math.min(Math.max(c.cx, hw), SRC_W - hw);
  const cy = hh >= SRC_H / 2 ? SRC_H / 2 : Math.min(Math.max(c.cy, hh), SRC_H - hh);
  return {cx, cy, z: c.z};
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// zoom en escala logarítmica: el acercamiento se siente uniforme
function mixCam(a: Cam, b: Cam, p: number): Cam {
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p);
  return clampCam({cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p, z});
}

// Los planos se definen en tiempo del original; la duración del movimiento es en tiempo de salida.
// Si un plano arranca antes de que termine el anterior, parte desde donde iba la cámara.
function cameraAt(tl: Timeline, t: number): Cam {
  let from = FULL;
  let to = FULL;
  let start = 0;
  let dur = 1;
  for (const shot of SHOTS) {
    const ts = toOut(tl, shot.t);
    if (ts > t) break;
    from = mixCam(from, to, inOut(clamp01((ts - start) / dur)));
    to = clampCam(shotCam(shot));
    start = ts;
    dur = shot.dur ?? 0.9;
  }
  return mixCam(from, to, inOut(clamp01((t - start) / dur)));
}

function toScreen(cam: Cam, [x, y, w, h]: Rect, pad: number) {
  const s = BASE * cam.z;
  return {
    x: (x - cam.cx) * s + W / 2 - pad,
    y: (y - cam.cy) * s + H / 2 - pad,
    w: w * s + pad * 2,
    h: h * s + pad * 2,
  };
}

function fade(t: number, from: number, to: number, inDur = 0.45, outDur = 0.35) {
  const a = out(Math.min(1, Math.max(0, (t - from) / inDur)));
  const b = Math.min(1, Math.max(0, (to - t) / outDur));
  return Math.min(a, b);
}

const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(1200px 700px at 50% -10%, #2a1710 0%, rgba(42,23,16,0) 70%),' +
        'radial-gradient(900px 600px at 100% 110%, #1d1411 0%, rgba(29,20,17,0) 70%), #0b0a0a',
    }}
  />
);

// Resaltados en tiempo de salida; los que quedan muy cortos por la aceleración se omiten
function highlightsAt(tl: Timeline, t: number) {
  return HIGHLIGHTS.map((h) => ({...h, from: toOut(tl, h.from), to: toOut(tl, h.to)})).filter(
    (h) => h.to - h.from >= 1 && t >= h.from && t <= h.to,
  );
}

const Spotlight: React.FC<{t: number; cam: Cam; tl: Timeline}> = ({t, cam, tl}) => {
  const active = highlightsAt(tl, t);
  if (!active.length) return null;
  return (
    <AbsoluteFill>
      {active.map((h, i) => {
        const a = fade(t, h.from, h.to);
        const r = toScreen(cam, h.rect, 10);
        const radius = 14;
        const per = 2 * (r.w + r.h);
        const draw = out(Math.min(1, Math.max(0, (t - h.from) / 0.7)));
        const above = h.place === 'above' || (h.place !== 'below' && r.y + r.h + 70 > H - 20);
        const labelY = above ? r.y - 58 : r.y + r.h + 14;
        const labelW = (h.label?.length ?? 0) * 14 + 40; // ancho aproximado de la etiqueta
        const labelX = Math.min(Math.max(r.x, 24), W - 24 - labelW);
        return (
          <React.Fragment key={i}>
            <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
              <path
                fillRule="evenodd"
                fill={`rgba(8,6,5,${0.55 * a})`}
                d={`M0 0H${W}V${H}H0Z M${r.x + radius} ${r.y}H${r.x + r.w - radius}Q${r.x + r.w} ${r.y} ${r.x + r.w} ${r.y + radius}V${r.y + r.h - radius}Q${r.x + r.w} ${r.y + r.h} ${r.x + r.w - radius} ${r.y + r.h}H${r.x + radius}Q${r.x} ${r.y + r.h} ${r.x} ${r.y + r.h - radius}V${r.y + radius}Q${r.x} ${r.y} ${r.x + radius} ${r.y}Z`}
              />
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={radius}
                fill="none"
                stroke={PRIMARY}
                strokeWidth={3.5}
                strokeDasharray={per}
                strokeDashoffset={per * (1 - draw)}
                opacity={a}
                style={{filter: `drop-shadow(0 0 14px ${PRIMARY}aa)`}}
              />
            </svg>
            {h.label && (
              <div
                style={{
                  position: 'absolute',
                  left: labelX,
                  top: labelY,
                  opacity: a,
                  transform: `translateY(${(1 - a) * (above ? 10 : -10)}px)`,
                  background: PRIMARY,
                  color: '#fff',
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 26,
                  letterSpacing: -0.2,
                  padding: '8px 18px',
                  borderRadius: 999,
                  boxShadow: '0 10px 30px rgba(0,0,0,.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h.label}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const ChapterTag: React.FC<{t: number; tl: Timeline}> = ({t, tl}) => {
  const c = CHAPTERS.map((c) => ({...c, t: toOut(tl, c.t)})).find((c) => t >= c.t && t <= c.t + 4.4);
  if (!c) return null;
  const a = fade(t, c.t, c.t + 4.4, 0.6, 0.5);
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        top: 34,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: a,
        transform: `translateX(${(1 - a) * -24}px)`,
        background: 'rgba(14,12,11,.82)',
        border: '1px solid rgba(255,255,255,.12)',
        backdropFilter: 'blur(10px)',
        borderRadius: 16,
        padding: '12px 22px 12px 16px',
        boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      }}
    >
      <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 22, color: PRIMARY}}>{c.n}</span>
      <span style={{width: 1, height: 26, background: 'rgba(255,255,255,.18)'}} />
      <span style={{fontFamily: FONT, fontWeight: 600, fontSize: 30, color: '#f4efe9', letterSpacing: -0.4}}>
        {c.title}
      </span>
    </div>
  );
};

const CaptionPill: React.FC<{t: number; tl: Timeline}> = ({t, tl}) => {
  const c = CAPTIONS.map((c) => ({...c, from: toOut(tl, c.from), to: toOut(tl, c.to)})).find((c) => t >= c.from && t <= c.to);
  if (!c) return null;
  const a = fade(t, c.from, c.to);
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54}}>
      <div
        style={{
          opacity: a,
          transform: `translateY(${(1 - a) * 14}px)`,
          background: 'rgba(14,12,11,.86)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 999,
          padding: '12px 28px',
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 30,
          color: '#f4efe9',
          boxShadow: '0 12px 40px rgba(0,0,0,.5)',
        }}
      >
        <span style={{color: PRIMARY, marginRight: 12}}>●</span>
        {c.text}
      </div>
    </AbsoluteFill>
  );
};

// Subtítulos de la narración, abajo y centrados. Si un resaltado ocupa la franja inferior se apartan a un lado
// (resaltado a la derecha → subtítulo a la izquierda y viceversa) o, si no hay lado libre, suben arriba.
const Subtitles: React.FC<{t: number; tl: Timeline; cam: Cam}> = ({t, tl, cam}) => {
  const l = tl.lines.find((l) => t >= l.start - 0.1 && t <= l.start + l.dur + 0.3);
  if (!l) return null;
  const a = fade(t, l.start - 0.1, l.start + l.dur + 0.3, 0.25, 0.25);
  const busy = highlightsAt(tl, t)
    .map((h) => toScreen(cam, h.rect, 10))
    .filter((r) => r.y + r.h + 60 > H - 200);
  let pos: React.CSSProperties = {justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 48px'};
  let maxWidth = 1480;
  if (busy.length) {
    const left = Math.min(...busy.map((r) => r.x));
    const right = Math.max(...busy.map((r) => r.x + r.w));
    if (left - 100 >= 640) {
      pos = {justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 0 48px 48px'};
      maxWidth = left - 100;
    } else if (W - right - 100 >= 640) {
      pos = {justifyContent: 'flex-end', alignItems: 'flex-end', padding: '0 48px 48px 0'};
      maxWidth = W - right - 100;
    } else pos = {justifyContent: 'flex-start', alignItems: 'center', padding: '120px 0 0'};
  }
  return (
    <AbsoluteFill style={pos}>
      <div
        style={{
          opacity: a,
          maxWidth: Math.min(1480, maxWidth),
          textAlign: 'center',
          background: 'rgba(12,10,9,.82)',
          borderRadius: 18,
          padding: '12px 26px',
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.3,
          color: '#f7f2ec',
          boxShadow: '0 12px 40px rgba(0,0,0,.45)',
        }}
      >
        {l.text}
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{t: number; end: number}> = ({t, end}) => {
  const a = out(Math.min(1, Math.max(0, (t - (end - 0.3)) / 0.8)));
  if (a <= 0) return null;
  const b = out(Math.min(1, Math.max(0, (t - end) / 0.9)));
  return (
    <AbsoluteFill style={{opacity: a, justifyContent: 'center', alignItems: 'center'}}>
      <Background />
      <div style={{textAlign: 'center', transform: `translateY(${(1 - b) * 20}px)`, opacity: b}}>
        <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 150, color: '#f4efe9', letterSpacing: -6}}>
          luca<span style={{color: PRIMARY}}>.</span>
        </div>
        <div style={{fontFamily: FONT, fontWeight: 500, fontSize: 36, color: '#b9aea5', marginTop: 4}}>
          Tus gastos, en tu propio Google
        </div>
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 30, color: PRIMARY, marginTop: 28}}>lucaa.lat</div>
      </div>
    </AbsoluteFill>
  );
};

export const TIMELINES = {original: ORIGINAL, narrado: NARRADO};
export type Variant = keyof typeof TIMELINES;
export const totalSeconds = (v: Variant) => TIMELINES[v].duration + OUTRO;

const SrcVideo: React.FC<{muted: boolean; from: number; rate?: number}> = ({muted, from, rate = 1}) => (
  <OffthreadVideo
    src={staticFile('grabacion.mp4')}
    muted={muted}
    trimBefore={from}
    playbackRate={rate}
    style={{width: SRC_W, height: SRC_H}}
  />
);

export const LucaDemo: React.FC<{variant: Variant}> = ({variant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tl = TIMELINES[variant];
  const t = frame / fps;
  const cam = cameraAt(tl, t);
  const s = BASE * cam.z;
  const intro = interpolate(t, [0, 0.5], [0, 1], {extrapolateRight: 'clamp'});
  const endFrame = Math.round(tl.duration * fps);
  const lastSrc = Math.floor(tl.pieces[tl.pieces.length - 1].srcTo * fps) - 2;

  return (
    <AbsoluteFill style={{background: '#0b0a0a'}}>
      <style>{FONT_CSS}</style>
      <Background />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SRC_W,
          height: SRC_H,
          transformOrigin: '0 0',
          transform: `translate(${W / 2 - cam.cx * s}px, ${H / 2 - cam.cy * s}px) scale(${s})`,
          borderRadius: 14 / BASE,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)',
          opacity: intro,
        }}
      >
        {tl.pieces.map((p, i) => {
          const start = Math.round(p.outFrom * fps);
          const play = Math.round((p.outFrom + p.playDur) * fps) - start;
          const rate = (p.srcTo - p.srcFrom) / p.playDur;
          const srcFrom = Math.round(p.srcFrom * fps);
          return (
            <React.Fragment key={i}>
              <Sequence from={start} durationInFrames={Math.min(play, endFrame - start - 1)} layout="none">
                <SrcVideo muted={tl.narrated} from={srcFrom} rate={rate} />
              </Sequence>
              {p.hold > 0 && (
                <Sequence from={start + play} durationInFrames={Math.round(p.hold * fps)} layout="none">
                  <Freeze frame={0}>
                    <SrcVideo muted from={Math.floor(p.srcTo * fps) - 1} />
                  </Freeze>
                </Sequence>
              )}
            </React.Fragment>
          );
        })}
        {/* último cuadro congelado bajo el cierre */}
        <Sequence from={endFrame - 1} layout="none">
          <Freeze frame={0}>
            <SrcVideo muted from={lastSrc} />
          </Freeze>
        </Sequence>
      </div>
      {tl.lines.map((l) => (
        <Sequence key={l.id} from={Math.round(l.start * fps)} layout="none">
          <Audio src={staticFile(`narr/${l.id}.wav`)} />
        </Sequence>
      ))}
      {tl.narrated && <Audio src={staticFile('musica.wav')} />}
      <Spotlight t={t} cam={cam} tl={tl} />
      {tl.narrated ? <Subtitles t={t} tl={tl} cam={cam} /> : <CaptionPill t={t} tl={tl} />}
      <ChapterTag t={t} tl={tl} />
      <Outro t={t} end={tl.duration} />
    </AbsoluteFill>
  );
};
