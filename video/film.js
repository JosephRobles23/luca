/*
 * "Luca — Tus finanzas. Tu Google." — pitch animado procedural (Canvas 2D).
 * Todo cuadro sale de draw(ctx, t) con t = segundos absolutos. Sin Math.random ni relojes: la aleatoriedad
 * sale de hashes enteros sembrados. Sin imágenes: logos y componentes se dibujan por código.
 * Funciona en navegador (window.Film) y en Node (require). Proyecto personal: usa los logos de Yape, BCP,
 * Gmail, Google Sheets, Apps Script, Claude, ChatGPT y MCP.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Film = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────────── constantes ─────────────────────────────
  const W = 1920, H = 1080, FPS = 30, DURATION = 142;
  const PI = Math.PI, TAU = PI * 2;
  const XF = 0.8; // fundido cruzado entre escenas

  const SANS = 'Geist, "DejaVu Sans", Arial, sans-serif';
  const MONO = '"Geist Mono", "DejaVu Sans Mono", ui-monospace, monospace';

  // Tokens del modo oscuro de apps/web/src/app/globals.css
  const C = {
    bg: '#0b0b0b', card: '#171717', raised: '#1f1f1f', strong: '#242424', sunken: '#111111',
    line: '#272727', lineSoft: '#1d1d1d', lineStrong: '#333333',
    ink: '#ede7dd', body: '#c4bdb3', muted: '#8b857c',
    primary: '#d9623b', primary2: '#f08a5d', primarySoft: '#2e1710', navLine: '#4a2516',
    success: '#6fbf8a', successSoft: '#13241a', warning: '#e2b25a', warningSoft: '#2a2110', error: '#ef6b8a',
    peach: '#dfa88f', mint: '#9fc9a2', blue: '#9fbbe0', lavender: '#c0a8dd', gold: '#c08532',
    rose: '#e3a3b4', sand: '#d8c08f', teal: '#8ec5c0', none: '#3d3d3d',
    sheets: '#0f9d58', sheetsDark: '#0b8043',
    yape: '#742284', yape2: '#a23aa8', yapeTeal: '#10cbb4',
    bcp: '#002a8d', bcp2: '#0b3fb5', bcpOrange: '#ff7800',
    gBlue: '#4285f4', gRed: '#ea4335', gYellow: '#fbbc04', gGreen: '#34a853',
    claude: '#d97757', claudeBg: '#262624', claudeBubble: '#3a3935', gptBg: '#212121', gptBubble: '#303030',
  };
  const CAT = {
    'Comidas fuera': C.peach, Supermercado: C.mint, Transporte: C.teal, Servicios: C.gold,
    Suscripciones: C.lavender, Ocio: C.peach, Salud: C.rose, Otros: C.sand, 'Recibido Yape': C.blue,
  };

  // ───────────────────────────── utilidades ─────────────────────────────
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (k) => k * k * (3 - 2 * k);
  const E = {
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: (k) => 1 - Math.pow(1 - k, 3),
    in: (k) => k * k * k,
    expo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    quint: (k) => 1 - Math.pow(1 - k, 5),
    sine: (k) => -(Math.cos(PI * k) - 1) / 2,
    back: (k) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    spring: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.exp(-6.5 * k) * Math.cos(10.5 * k)),
  };
  // 0→1→0 entre a y b, con bordes de ancho f
  const pulse = (t, a, b, f = 0.3) => clamp(Math.min((t - a) / f, (b - t) / f));

  function hash(a, b = 0, c = 0) {
    let h = Math.imul((a | 0) ^ 0x27d4eb2d, 0x9e3779b1);
    h ^= Math.imul((b | 0) + 0x165667b1, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h ^= Math.imul((c | 0) + 0x7f4a7c15, 0xc2b2ae3d);
    h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(+a || 0).toFixed(3)})`; // sin notación exponencial (CSS la rechaza)
  }
  function mix(h1, h2, k) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k));
    const bl = Math.round(lerp(a & 255, b & 255, k));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  // S/ con miles y 2 decimales, como fmtPEN de la web (es-PE)
  function money(n, dec = 2) {
    const s = Math.abs(n).toFixed(dec), [i, d] = s.split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  const pen = (n) => 'S/ ' + money(n);
  function shortAmount(n) {
    if (!n) return '0';
    if (Math.abs(n) < 1000) return String(Math.round(n));
    const k = n / 1000;
    const s = Math.abs(k) >= 100 ? k.toFixed(0) : Math.abs(k) >= 10 ? k.toFixed(1) : k.toFixed(2);
    return `${s.replace(/\.?0+$/, '')}k`;
  }
  const typed = (s, k) => s.slice(0, Math.round(clamp(k) * s.length));

  // ───────────────────────────── estado global ─────────────────────────────
  const G = { t: 0, makeCanvas: null, tex: {}, ready: false, bufs: [], depth: 0, lite: false, captions: true };
  function buffer(depth) {
    if (!G.bufs[depth]) { const cv = G.makeCanvas(W, H); G.bufs[depth] = { cv, ctx: cv.getContext('2d') }; }
    return G.bufs[depth];
  }
  // Dibuja fn en un buffer limpio y lo devuelve (para desenfoques y opacidad de grupo)
  function offscreen(fn) {
    const b = buffer(G.depth++);
    b.ctx.setTransform(1, 0, 0, 1, 0, 0);
    b.ctx.globalAlpha = 1; b.ctx.globalCompositeOperation = 'source-over';
    b.ctx.clearRect(0, 0, W, H);
    b.ctx.save(); fn(b.ctx); b.ctx.restore();
    G.depth--;
    return b.cv;
  }
  // Desenfoque barato: reduce y vuelve a ampliar con suavizado (k 0..1)
  function blurred(ctx, cv, k) {
    if (k <= 0.001) { ctx.drawImage(cv, 0, 0); return; }
    const f = Math.max(1, Math.round(1 + k * 14));
    const key = 'blur' + f;
    if (!G.tex[key]) G.tex[key] = G.makeCanvas(Math.ceil(W / f), Math.ceil(H / f));
    const sm = G.tex[key], sc = sm.getContext('2d');
    sc.clearRect(0, 0, sm.width, sm.height);
    sc.imageSmoothingEnabled = true;
    sc.drawImage(cv, 0, 0, sm.width, sm.height);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(sm, 0, 0, W, H); ctx.restore();
  }

  // ───────────────────────────── primitivas ─────────────────────────────
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
    rr(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function shadowBox(ctx, x, y, w, h, r, fill, blur = 40, oy = 18, a = 0.55) {
    ctx.save();
    ctx.shadowColor = hexA('#000000', a); ctx.shadowBlur = blur; ctx.shadowOffsetY = oy;
    box(ctx, x, y, w, h, r, fill);
    ctx.restore();
  }
  function setFont(ctx, o) { ctx.font = `${o.w || 400} ${o.size || 24}px ${o.mono ? MONO : SANS}`; }
  function tw(ctx, s, o) { setFont(ctx, o); return ctx.measureText(s).width + (o.track ? o.track * (s.length - 1) : 0); }
  // Texto. o: size, w (peso), c, align, mono, track (espaciado en px), base, a (alfa)
  function T(ctx, s, x, y, o = {}) {
    if (!s) return 0;
    setFont(ctx, o);
    ctx.fillStyle = o.c || C.ink;
    ctx.textBaseline = o.base || 'alphabetic';
    const pa = ctx.globalAlpha;
    if (o.a != null) ctx.globalAlpha = pa * o.a;
    let wdt;
    if (o.track) {
      wdt = tw(ctx, s, o);
      let cx = o.align === 'center' ? x - wdt / 2 : o.align === 'right' ? x - wdt : x;
      ctx.textAlign = 'left';
      for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + o.track; }
    } else {
      ctx.textAlign = o.align || 'left';
      ctx.fillText(s, x, y);
      wdt = ctx.measureText(s).width;
    }
    ctx.globalAlpha = pa;
    return wdt;
  }
  // Titular palabra por palabra: cada palabra sube y aparece con desfase
  function words(ctx, s, x, y, o, k0, t, st = 0.07, dur = 0.55) {
    const parts = s.split(' ');
    setFont(ctx, o);
    const sp = ctx.measureText(' ').width, ws = parts.map((p) => ctx.measureText(p).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (parts.length - 1);
    let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    parts.forEach((p, i) => {
      const k = E.expo(seg(t, k0 + i * st, k0 + i * st + dur));
      if (k > 0) T(ctx, p, cx, y + (1 - k) * (o.size || 24) * 0.45, { ...o, align: 'left', a: (o.a == null ? 1 : o.a) * k, c: (o.hl && o.hl[i]) || o.c });
      cx += ws[i] + sp;
    });
    return total;
  }
  function glow(ctx, x, y, r, color, a = 1) {
    if (a <= 0 || r <= 0) return;
    G.tex.glows = G.tex.glows || {};
    let spr = G.tex.glows[color];
    if (!spr) {
      const S = 256; spr = G.makeCanvas(S, S);
      const c = spr.getContext('2d');
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, hexA(color, 0.5)); g.addColorStop(0.4, hexA(color, 0.16)); g.addColorStop(1, hexA(color, 0));
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      G.tex.glows[color] = spr;
    }
    ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function cam(ctx, x, y, z) { ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-x, -y); }
  // Cámara por claves [[t, x, y, z], …] con transiciones inOut
  function camAt(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      if (t <= b[0]) {
        const k = E.inOut(seg(t, a[0], b[0]));
        return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
      }
    }
    return keys[keys.length - 1].slice(1);
  }
  // Bézier cúbica
  function bz(P, k) {
    const m = 1 - k;
    return [m * m * m * P[0][0] + 3 * m * m * k * P[1][0] + 3 * m * k * k * P[2][0] + k * k * k * P[3][0],
      m * m * m * P[0][1] + 3 * m * m * k * P[1][1] + 3 * m * k * k * P[2][1] + k * k * k * P[3][1]];
  }
  function strokeBz(ctx, P, k0, k1, color, w = 2, dash = null, off = 0) {
    if (k1 <= k0) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off; }
    ctx.beginPath();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const p = bz(P, lerp(k0, k1, i / n));
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  // Estela luminosa detrás de un punto que recorre P (cabeza en k)
  function trail(ctx, P, k, len, color, w = 3) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = k - len + (len * i) / n, b = k - len + (len * (i + 1)) / n;
      if (b <= 0) continue;
      ctx.save(); ctx.globalAlpha *= (i + 1) / n;
      strokeBz(ctx, P, Math.max(0, a), Math.min(1, b), color, w * (0.4 + (0.6 * (i + 1)) / n));
      ctx.restore();
    }
    const p = bz(P, clamp(k));
    glow(ctx, p[0], p[1], 34, color, 0.9);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], w * 0.9, 0, TAU); ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2, c, w = 1, dash = null, off = 0) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
    if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off; }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  // Tachado animado (k 0..1) de izquierda-abajo a derecha-arriba
  function strike(ctx, x, y, w, h, k, c = C.primary, lw = 5) {
    if (k <= 0) return;
    const e = E.expo(k);
    ctx.save();
    ctx.shadowColor = hexA(c, 0.6); ctx.shadowBlur = 16;
    line(ctx, x, y + h, lerp(x, x + w, e), lerp(y + h, y, e), c, lw);
    ctx.restore();
  }
  // Desintegración en partículas. Si o.to existe, las partículas convergen hacia ese punto.
  function particles(ctx, cx, cy, w, h, k, o = {}) {
    if (k <= 0 || k >= 1) return;
    const n = G.lite ? 70 : o.n || 160, s = o.seed || 1, col = o.c || C.body;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const px = cx - w / 2 + hash(i, 1, s) * w, py = cy - h / 2 + hash(i, 2, s) * h;
      const d = hash(i, 3, s) * 0.35, kk = clamp((k - d) / (1 - d));
      if (kk <= 0) { ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); continue; }
      let x, y;
      if (o.to) {
        const e = E.inOut(kk), ang = hash(i, 4, s) * TAU, sw = Math.sin(e * PI) * (60 + hash(i, 5, s) * 120);
        x = lerp(px, o.to[0] + (hash(i, 6, s) - 0.5) * 60, e) + Math.cos(ang) * sw;
        y = lerp(py, o.to[1] + (hash(i, 7, s) - 0.5) * 40, e) + Math.sin(ang) * sw;
        ctx.globalAlpha = 1 - E.in(kk) * 0.9;
      } else {
        const ang = hash(i, 4, s) * TAU, dist = 60 + hash(i, 5, s) * 260, e = E.out(kk);
        x = px + Math.cos(ang) * dist * e; y = py + Math.sin(ang) * dist * e - e * 40;
        ctx.globalAlpha = 1 - kk;
      }
      const sz = 1.5 + hash(i, 8, s) * 3;
      ctx.fillStyle = hash(i, 9, s) < 0.25 ? C.primary2 : col;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.restore();
  }
  function check(ctx, x, y, s, c, k = 1) {
    if (k <= 0) return;
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const p1 = [x - s * 0.35, y], p2 = [x - s * 0.1, y + s * 0.26], p3 = [x + s * 0.38, y - s * 0.28];
    const k1 = clamp(k * 2), k2 = clamp(k * 2 - 1);
    ctx.moveTo(p1[0], p1[1]); ctx.lineTo(lerp(p1[0], p2[0], k1), lerp(p1[1], p2[1], k1));
    if (k2 > 0) ctx.lineTo(lerp(p2[0], p3[0], k2), lerp(p2[1], p3[1], k2));
    ctx.stroke(); ctx.restore();
  }
  function spinner(ctx, x, y, r, t, c) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, t * 7, t * 7 + PI * 1.3); ctx.stroke(); ctx.restore();
  }
  // Cursor de flecha (macOS)
  function cursor(ctx, x, y, s = 1, press = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - press * 0.12), s * (1 - press * 0.12));
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(7.5, 23); ctx.lineTo(12.5, 34); ctx.lineTo(17, 32); ctx.lineTo(12, 21.5); ctx.lineTo(22, 21.5); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function ripple(ctx, x, y, k, c = C.primary2) {
    if (k <= 0 || k >= 1) return;
    ctx.save(); ctx.strokeStyle = c; ctx.globalAlpha *= 1 - k; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 8 + E.out(k) * 46, 0, TAU); ctx.stroke(); ctx.restore();
  }

  // ───────────────────────────── logos ─────────────────────────────
  // Luca: facetas del logo de apps/web/public/luca-logo.webp (coordenadas del original, caja 145–430 × 32–383)
  const LUCA_FACETS = [
    { p: [[145, 122], [268, 32], [268, 205]], c1: '#55524d', c2: '#34322f' },
    { p: [[145, 122], [268, 304], [145, 383]], c1: '#3d3b38', c2: '#262523' },
    { p: [[145, 122], [268, 205], [268, 304]], c1: '#e8743f', c2: '#cf5a2f' },
    { p: [[268, 205], [352, 262], [268, 304]], c1: '#f7a070', c2: '#f08a5d' },
    { p: [[352, 262], [430, 304], [268, 304]], c1: '#2f2d2b', c2: '#1f1e1c' },
    { p: [[145, 383], [268, 304], [430, 304], [330, 383]], c1: '#4a4743', c2: '#2b2a28' },
  ];
  function drawLucaMark(ctx, x, y, size, k = 1, o = {}) {
    const s = size / 351;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-287.5, -207.5);
    LUCA_FACETS.forEach((f, i) => {
      const kk = o.stagger === false ? clamp(k) : E.back(seg(k, i * 0.09, i * 0.09 + 0.5));
      if (kk <= 0) return;
      const cx = f.p.reduce((a, p) => a + p[0], 0) / f.p.length, cy = f.p.reduce((a, p) => a + p[1], 0) / f.p.length;
      ctx.save();
      ctx.globalAlpha *= clamp(kk);
      ctx.translate(cx, cy); ctx.scale(kk, kk); ctx.translate(-cx, -cy);
      if (o.flat) ctx.translate((1 - clamp(kk)) * (i % 2 ? 40 : -40), 0);
      const g = ctx.createLinearGradient(145, 32, 430, 383);
      g.addColorStop(0, f.c1); g.addColorStop(1, f.c2);
      ctx.beginPath(); f.p.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.6 / s * 0.6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }
  // Wordmark "LUCA" con la A como chevrón terracota
  function drawWordmark(ctx, x, y, size, k = 1, color = C.ink) {
    const track = size * 0.32, letters = ['L', 'U', 'C'];
    setFont(ctx, { size, w: 600 });
    const ws = letters.map((l) => ctx.measureText(l).width), aw = size * 0.78;
    const total = ws.reduce((a, b) => a + b, 0) + track * 3 + aw;
    let cx = x - total / 2;
    letters.forEach((l, i) => {
      const kk = E.expo(seg(k, i * 0.12, i * 0.12 + 0.5));
      T(ctx, l, cx, y + (1 - kk) * size * 0.3, { size, w: 600, c: color, a: kk });
      cx += ws[i] + track;
    });
    const kk = E.expo(seg(k, 0.36, 0.86));
    if (kk > 0) {
      ctx.save(); ctx.globalAlpha *= kk;
      const yy = y + (1 - kk) * size * 0.3, hgt = size * 0.72;
      ctx.beginPath();
      ctx.moveTo(cx, yy); ctx.lineTo(cx + aw * 0.5, yy - hgt); ctx.lineTo(cx + aw, yy);
      ctx.lineTo(cx + aw - size * 0.19, yy); ctx.lineTo(cx + aw * 0.5, yy - hgt + size * 0.3); ctx.lineTo(cx + size * 0.19, yy);
      ctx.closePath(); ctx.fillStyle = C.primary; ctx.fill();
      ctx.restore();
    }
    return total;
  }
  function drawYape(ctx, x, y, s) {
    ctx.save();
    const g = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
    g.addColorStop(0, C.yape2); g.addColorStop(1, C.yape);
    box(ctx, x - s / 2, y - s / 2, s, s, s * 0.24, null);
    ctx.fillStyle = g; ctx.fill();
    T(ctx, 'yape', x, y + s * 0.11, { size: s * 0.33, w: 700, c: '#fff', align: 'center' });
    ctx.fillStyle = C.yapeTeal; ctx.beginPath(); ctx.arc(x + s * 0.27, y - s * 0.22, s * 0.065, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawBCP(ctx, x, y, s) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y - s / 2, x, y + s / 2);
    g.addColorStop(0, C.bcp2); g.addColorStop(1, C.bcp);
    box(ctx, x - s / 2, y - s / 2, s, s, s * 0.24, null); ctx.fillStyle = g; ctx.fill();
    T(ctx, 'BCP', x - s * 0.08, y + s * 0.12, { size: s * 0.31, w: 700, c: '#fff', align: 'center' });
    ctx.fillStyle = C.bcpOrange; ctx.beginPath();
    const ax = x + s * 0.24, ay = y + s * 0.01;
    ctx.moveTo(ax - s * 0.03, ay - s * 0.12); ctx.lineTo(ax + s * 0.11, ay); ctx.lineTo(ax - s * 0.03, ay + s * 0.12); ctx.lineTo(ax + s * 0.02, ay);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawGmail(ctx, x, y, s, bg = true) {
    ctx.save(); ctx.translate(x - s / 2, y - s / 2);
    if (bg) box(ctx, 0, 0, s, s, s * 0.24, '#ffffff');
    const L = s * 0.17, R = s * 0.83, Tt = s * 0.28, B = s * 0.74, bw = s * 0.13;
    ctx.fillStyle = C.gBlue; box(ctx, L, Tt, bw, B - Tt, bw * 0.3, C.gBlue);
    box(ctx, R - bw, Tt, bw, B - Tt, bw * 0.3, C.gGreen);
    ctx.strokeStyle = C.gRed; ctx.lineWidth = bw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L + bw / 2, Tt + bw / 2); ctx.lineTo(s / 2, s * 0.52); ctx.lineTo(R - bw / 2, Tt + bw / 2); ctx.stroke();
    ctx.strokeStyle = C.gYellow; ctx.beginPath(); ctx.moveTo(R - bw / 2, Tt + bw / 2); ctx.lineTo(R - bw / 2 - s * 0.06, Tt + bw / 2 + s * 0.045); ctx.stroke();
    ctx.restore();
  }
  function drawSheetsIcon(ctx, x, y, s) {
    ctx.save(); ctx.translate(x - s * 0.36, y - s / 2);
    const w = s * 0.72, h = s, f = s * 0.22;
    ctx.beginPath(); ctx.moveTo(s * 0.06, 0); ctx.lineTo(w - f, 0); ctx.lineTo(w, f); ctx.lineTo(w, h - s * 0.06);
    ctx.arcTo(w, h, w - s * 0.06, h, s * 0.06); ctx.lineTo(s * 0.06, h); ctx.arcTo(0, h, 0, h - s * 0.06, s * 0.06);
    ctx.lineTo(0, s * 0.06); ctx.arcTo(0, 0, s * 0.06, 0, s * 0.06); ctx.closePath();
    ctx.fillStyle = C.sheets; ctx.fill();
    ctx.beginPath(); ctx.moveTo(w - f, 0); ctx.lineTo(w - f, f); ctx.lineTo(w, f); ctx.closePath(); ctx.fillStyle = '#87ceac'; ctx.fill();
    const gx = w * 0.2, gy = h * 0.44, gw = w * 0.6, gh = h * 0.36;
    ctx.fillStyle = '#fff'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = C.sheets;
    ctx.fillRect(gx + gw * 0.36, gy + gh * 0.0, Math.max(1, s * 0.03), gh);
    ctx.fillRect(gx, gy + gh * 0.31, gw, Math.max(1, s * 0.03));
    ctx.fillRect(gx, gy + gh * 0.64, gw, Math.max(1, s * 0.03));
    ctx.restore();
  }
  function drawAppsScript(ctx, x, y, s, bg = true) {
    ctx.save(); ctx.translate(x, y);
    if (bg) box(ctx, -s / 2, -s / 2, s, s, s * 0.24, '#ffffff');
    const cap = (ang, col, ox, oy) => {
      ctx.save(); ctx.translate(ox * s, oy * s); ctx.rotate(ang);
      box(ctx, -s * 0.27, -s * 0.085, s * 0.54, s * 0.17, s * 0.085, col); ctx.restore();
    };
    cap(-PI / 4, C.gBlue, -0.09, -0.08);
    cap(PI / 4, C.gYellow, 0.09, -0.08);
    cap(0, C.gGreen, 0, 0.17);
    ctx.restore();
  }
  const SPARK = (() => {
    const lens = [1.0, 0.74, 0.92, 0.68, 0.97, 0.8, 0.7, 0.95, 0.76, 0.9, 0.66, 0.86], out = [];
    for (let i = 0; i < 12; i++) out.push({ a: (i / 12) * TAU - PI / 2 + (hash(i, 77) - 0.5) * 0.2, l: lens[i], w: 0.85 + hash(i, 78) * 0.35 });
    return out;
  })();
  function drawClaude(ctx, x, y, R, col = C.claude) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col;
    for (const ray of SPARK) {
      const a = ray.a, L = R * ray.l, w0 = R * 0.05, w1 = R * 0.09 * ray.w;
      const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
      ctx.beginPath();
      ctx.moveTo(ca * R * 0.1 + px * w0, sa * R * 0.1 + py * w0);
      ctx.lineTo(ca * (L - w1) + px * w1, sa * (L - w1) + py * w1);
      ctx.arc(ca * (L - w1), sa * (L - w1), w1, a + PI / 2, a - PI / 2, true);
      ctx.lineTo(ca * R * 0.1 - px * w0, sa * R * 0.1 - py * w0);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawChatGPT(ctx, x, y, R, col = '#ffffff') {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = col; ctx.lineWidth = R * 0.14; ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate((i * PI) / 3);
      rr(ctx, -R * 0.2, -R * 0.92, R * 0.56, R * 1.12, R * 0.28);
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  function drawMCP(ctx, x, y, R, col = C.ink) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = R * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const hook = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(-R * 0.75 + ox, R * 0.15 + oy);
      ctx.lineTo(R * 0.05 + ox, -R * 0.65 + oy);
      ctx.arc(R * 0.27 + ox, -R * 0.43 + oy, R * 0.31, -PI * 0.75, PI * 0.25);
      ctx.lineTo(-R * 0.15 + ox, R * 0.55 + oy);
      ctx.stroke();
    };
    hook(0, 0); hook(R * 0.32, R * 0.32);
    ctx.restore();
  }
  function drawShortcuts(ctx, x, y, s) {
    ctx.save();
    const g = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
    g.addColorStop(0, '#ff5f8f'); g.addColorStop(0.5, '#a855f7'); g.addColorStop(1, '#3b82f6');
    box(ctx, x - s / 2, y - s / 2, s, s, s * 0.24, null); ctx.fillStyle = g; ctx.fill();
    ctx.translate(x, y); ctx.rotate(PI / 4);
    ctx.globalAlpha *= 0.55; box(ctx, -s * 0.2, -s * 0.05, s * 0.3, s * 0.3, s * 0.07, '#fff');
    ctx.globalAlpha /= 0.55 / 0.95; box(ctx, -s * 0.1, -s * 0.25, s * 0.3, s * 0.3, s * 0.07, '#fff');
    ctx.restore();
  }
  const APP_ICON = { yape: drawYape, bcp: drawBCP, gmail: (c, x, y, s) => drawGmail(c, x, y, s) };

  // ───────────────────────────── piezas de UI ─────────────────────────────
  // iPhone. Diseño 400×830 centrado en (x, y); screen(ctx, w, h) dibuja en coordenadas de pantalla.
  function drawPhone(ctx, x, y, s, screen, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const w = 400, h = 830;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 40;
    box(ctx, -w / 2, -h / 2, w, h, 66, '#2b2b2e'); ctx.restore();
    const fg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    fg.addColorStop(0, '#5a5a5f'); fg.addColorStop(0.5, '#2a2a2d'); fg.addColorStop(1, '#5a5a5f');
    box(ctx, -w / 2, -h / 2, w, h, 66, null, fg, 3);
    box(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 58, '#000');
    const sx = -w / 2 + 16, sy = -h / 2 + 16, sw = w - 32, sh = h - 32;
    ctx.save();
    rr(ctx, sx, sy, sw, sh, 50); ctx.clip();
    const bg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    bg.addColorStop(0, '#1d1424'); bg.addColorStop(0.55, '#120f17'); bg.addColorStop(1, '#0c0b0f');
    ctx.fillStyle = bg; ctx.fillRect(sx, sy, sw, sh);
    glow(ctx, sx + sw * 0.15, sy + sh * 0.2, 260, '#7a2f8a', 0.55);
    glow(ctx, sx + sw * 0.9, sy + sh * 0.75, 280, C.primary, 0.35);
    ctx.translate(sx, sy);
    if (screen) screen(ctx, sw, sh);
    ctx.restore();
    // isla dinámica y barra de estado
    box(ctx, -62, -h / 2 + 28, 124, 36, 18, '#000');
    T(ctx, '9:41', -w / 2 + 64, -h / 2 + 52, { size: 17, w: 600, c: '#fff', align: 'center' });
    box(ctx, w / 2 - 80, -h / 2 + 40, 28, 13, 4, null, 'rgba(255,255,255,0.8)', 1.4);
    box(ctx, w / 2 - 78, -h / 2 + 42, 20, 9, 2, '#fff');
    ctx.restore();
  }
  // Notificación iOS (ancho w, alto 92)
  function drawNotif(ctx, x, y, w, n, o = {}) {
    const h = 92;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    box(ctx, x, y, w, h, 24, o.solid ? '#2c2a30' : 'rgba(64,60,70,0.82)');
    ctx.restore();
    box(ctx, x, y, w, h, 24, null, 'rgba(255,255,255,0.08)');
    APP_ICON[n.app](ctx, x + 38, y + h / 2, 46);
    T(ctx, n.title, x + 72, y + 38, { size: 17, w: 600, c: '#fff' });
    T(ctx, n.time || 'ahora', x + w - 18, y + 38, { size: 14, c: 'rgba(255,255,255,0.55)', align: 'right' });
    T(ctx, n.body, x + 72, y + 64, { size: 16, c: 'rgba(255,255,255,0.86)' });
  }
  // Paquete JSON
  function drawPacket(ctx, x, y, s, lines, a = 1, accent = C.primary2) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
    const w = 330, h = 40 + lines.length * 30;
    ctx.save(); ctx.shadowColor = hexA(accent, 0.45); ctx.shadowBlur = 40;
    box(ctx, -w / 2, -h / 2, w, h, 16, '#141414'); ctx.restore();
    box(ctx, -w / 2, -h / 2, w, h, 16, null, hexA(accent, 0.7), 1.5);
    lines.forEach((l, i) => {
      const yy = -h / 2 + 34 + i * 30;
      if (l[1] == null) { T(ctx, l[0], -w / 2 + 22, yy, { size: 19, mono: true, c: C.muted }); return; }
      const kw = T(ctx, `"${l[0]}": `, -w / 2 + 40, yy, { size: 19, mono: true, c: C.body });
      T(ctx, l[1], -w / 2 + 40 + kw, yy, { size: 19, mono: true, c: typeof l[2] === 'string' ? l[2] : accent });
    });
    ctx.restore();
  }
  function chip(ctx, x, y, label, col, o = {}) {
    const size = o.size || 15, h = o.h || 30;
    const w = tw(ctx, label, { size, w: 500 }) + (o.dot === false ? 24 : 40);
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    box(ctx, x0, y - h / 2, w, h, h / 2, o.bg || hexA(col, 0.16), o.border ? hexA(col, 0.6) : null);
    if (o.dot !== false) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + 16, y, 5, 0, TAU); ctx.fill(); }
    T(ctx, label, x0 + (o.dot === false ? 12 : 28), y + size * 0.35, { size, w: 500, c: o.c || C.ink });
    return w;
  }
  function tag(ctx, x, y, s, o = {}) {
    const w = tw(ctx, s, { size: 11.5, mono: true, w: 500 }) + 12;
    box(ctx, x, y - 10, w, 20, 5, C.strong);
    T(ctx, s, x + 6, y + 4, { size: 11.5, mono: true, w: 500, c: o.c || C.muted });
    return w;
  }
  // Navegador de vidrio. Devuelve el rectángulo de contenido.
  function drawBrowser(ctx, x, y, w, h, url, o = {}) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30;
    box(ctx, x, y, w, h, 20, hexA('#0e0e0e', o.glass == null ? 0.96 : o.glass));
    ctx.restore();
    box(ctx, x, y, w, h, 20, null, 'rgba(255,255,255,0.12)', 1.5);
    ctx.save(); rr(ctx, x, y, w, 52, 20); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x, y, w, 52); ctx.restore();
    line(ctx, x, y + 52, x + w, y + 52, 'rgba(255,255,255,0.08)');
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 26 + i * 22, y + 26, 6.5, 0, TAU); ctx.fill(); });
    const uw = 380;
    box(ctx, x + w / 2 - uw / 2, y + 12, uw, 28, 9, 'rgba(255,255,255,0.06)');
    // candado
    ctx.save(); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.6;
    const lx = x + w / 2 - tw(ctx, url, { size: 15 }) / 2 - 16, ly = y + 26;
    ctx.beginPath(); ctx.arc(lx, ly - 3, 3.5, PI, 0); ctx.stroke(); ctx.fillStyle = C.muted; ctx.fillRect(lx - 5, ly - 2, 10, 8);
    ctx.restore();
    T(ctx, url, x + w / 2 + 4, y + 31, { size: 15, c: C.body, align: 'center' });
    return { x: x, y: y + 52, w: w, h: h - 52 };
  }

  // ───────────────────────────── Google Sheet ─────────────────────────────
  // Diseño de 560 de ancho; columnas: nº, Fecha, Comercio, Monto, Categoría, Fuente
  const SHC = [36, 70, 118, 92, 140, 104];
  const SHX = SHC.reduce((acc, w, i) => (acc.push((acc[i - 1] || 0) + (i ? SHC[i - 1] : 0)), acc), []);
  const SH_TOP = 98, SH_ROW = 32;
  const sheetH = (n) => SH_TOP + SH_ROW * (n + 1) + 34;
  function sheetCell(x, y, w, row, col) {
    const s = w / 560;
    return [x + (SHX[col + 1] + SHC[col + 1] / 2) * s, y + (SH_TOP + SH_ROW * (row + 1) + SH_ROW / 2) * s];
  }
  // rows: [fecha, comercio, monto, categoría, fuente]; o.row(i) → { a, fill, flash, cat, hl }
  function drawSheet(ctx, x, y, w, rows, o = {}) {
    const s = w / 560, n = rows.length, h = sheetH(n);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (o.a != null) ctx.globalAlpha *= o.a;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    box(ctx, 0, 0, 560, h, 12, '#ffffff'); ctx.restore();
    if (o.glow) { ctx.save(); ctx.shadowColor = hexA(C.sheets, 0.6 * o.glow); ctx.shadowBlur = 60; box(ctx, 0, 0, 560, h, 12, '#ffffff'); ctx.restore(); }
    ctx.save(); rr(ctx, 0, 0, 560, h, 12); ctx.clip();
    // barra superior
    ctx.fillStyle = '#f9fbfd'; ctx.fillRect(0, 0, 560, 64);
    drawSheetsIcon(ctx, 24, 24, 26);
    T(ctx, o.title || 'Luca', 46, 24, { size: 15, w: 600, c: '#1f1f1f' });
    T(ctx, 'Archivo  Editar  Ver  Insertar  Formato  Datos  Extensiones', 46, 46, { size: 11.5, c: '#5f6368' });
    box(ctx, 470, 12, 74, 26, 13, '#c2e7ff');
    T(ctx, 'Compartir', 507, 29.5, { size: 11.5, w: 600, c: '#001d35', align: 'center' });
    // letras de columna
    ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 70, 560, 28);
    ['', 'A', 'B', 'C', 'D', 'E'].forEach((l, i) => T(ctx, l, SHX[i] + SHC[i] / 2, 89, { size: 11.5, c: '#5f6368', align: 'center' }));
    // encabezado
    const hy = SH_TOP;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, hy, 560, SH_ROW);
    ['1', 'Fecha', 'Comercio', 'Monto', 'Categoría', 'Fuente'].forEach((l, i) => {
      if (i === 0) T(ctx, l, SHC[0] / 2, hy + 21, { size: 11.5, c: '#5f6368', align: 'center' });
      else T(ctx, l, SHX[i] + 8, hy + 21, { size: 13, w: 700, c: '#1f1f1f' });
    });
    // filas
    for (let r = 0; r < n; r++) {
      const st = o.row ? o.row(r) : {}, ry = SH_TOP + SH_ROW * (r + 1);
      const a = st.a == null ? 1 : st.a;
      T(ctx, String(r + 2), SHC[0] / 2, ry + 21, { size: 11.5, c: '#5f6368', align: 'center' });
      if (a <= 0) continue;
      ctx.save(); ctx.globalAlpha *= a;
      if (st.flash) { ctx.fillStyle = hexA('#34a853', 0.22 * st.flash); ctx.fillRect(SHC[0], ry, 560 - SHC[0], SH_ROW); }
      if (st.hl) { ctx.strokeStyle = C.gBlue; ctx.lineWidth = 2; ctx.strokeRect(SHX[st.hl.col + 1] + 1, ry + 1, SHC[st.hl.col + 1] - 2, SH_ROW - 2); }
      const vals = rows[r].slice();
      if (st.cat != null) vals[3] = st.cat;
      const fill = st.fill == null ? 1 : st.fill;
      vals.forEach((v, c) => {
        const ck = clamp(fill * 5 - c);
        if (ck <= 0 || !v) return;
        const col = c === 2 ? (v[0] === '+' ? '#188038' : '#1f1f1f') : c === 4 ? '#5f6368' : '#1f1f1f';
        const isNum = c === 2;
        T(ctx, v, isNum ? SHX[c + 1] + SHC[c + 1] - 8 : SHX[c + 1] + 8, ry + 21, { size: 13, c: col, align: isNum ? 'right' : 'left', a: ck, mono: c === 4 && false });
      });
      if (st.catFlash) { ctx.fillStyle = hexA('#34a853', 0.3 * st.catFlash); ctx.fillRect(SHX[4], ry, SHC[4], SH_ROW); }
      ctx.restore();
    }
    // rejilla
    ctx.strokeStyle = '#e1e3e1'; ctx.lineWidth = 1;
    for (let r = 0; r <= n + 1; r++) { const ry = SH_TOP + SH_ROW * r; ctx.beginPath(); ctx.moveTo(0, ry + 0.5); ctx.lineTo(560, ry + 0.5); ctx.stroke(); }
    for (let i = 1; i < SHC.length; i++) { ctx.beginPath(); ctx.moveTo(SHX[i] + 0.5, 70); ctx.lineTo(SHX[i] + 0.5, SH_TOP + SH_ROW * (n + 1)); ctx.stroke(); }
    // pestañas
    const ty = h - 34;
    ctx.fillStyle = '#f9fbfd'; ctx.fillRect(0, ty, 560, 34);
    line(ctx, 0, ty + 0.5, 560, ty + 0.5, '#e1e3e1');
    box(ctx, 12, ty + 4, 112, 26, 6, '#e1f3e8');
    T(ctx, 'Movimientos', 68, ty + 21, { size: 12.5, w: 600, c: C.sheetsDark, align: 'center' });
    ['Categorías', 'Comercios', 'Ajustes'].forEach((l, i) => T(ctx, l, 150 + i * 92, ty + 21, { size: 12.5, c: '#5f6368' }));
    ctx.restore();
    ctx.restore();
    return h * s;
  }

  // ───────────────────────────── datos sintéticos ─────────────────────────────
  const D = {
    expense: 2847.30, prev: 3105.80, income: 4200.00, yape: 645.00,
    cats: [['Comidas fuera', 812.40], ['Supermercado', 604.10], ['Transporte', 398.60], ['Servicios', 356.00],
      ['Suscripciones', 214.90], ['Ocio', 186.30], ['Salud', 148.00], ['Otros', 127.00]],
    six: [['May', 2640], ['Jun', 3020], ['Jul', 2780], ['Ago', 3410], ['Sep', 3105.80], ['Oct', 2847.30]],
    merchants: [['Wong', 412.30, 6], ['Rappi', 286.90, 9], ['Uber', 241.50, 14]],
  };
  const ROWS0 = [
    ['26/10', 'Wong', '−126.40', 'Supermercado', 'correo'],
    ['27/10', 'Uber', '−14.50', 'Transporte', 'correo'],
    ['27/10', 'Netflix', '−44.90', 'Suscripciones', 'correo'],
    ['28/10', 'Starbucks', '−16.50', '', 'correo'],
  ];
  const ROW_YAPE = ['28/10', 'María T.', '+45.00', 'Recibido Yape', 'iphone'];
  const ROW_RAPPI = ['28/10', 'Rappi', '−38.90', 'Comidas fuera', 'correo'];
  const ROW_TAXI = ['28/10', 'Taxi', '−18.00', 'Transporte', 'mcp'];
  const ROWS1 = [...ROWS0, ROW_YAPE, ROW_RAPPI];

  // ───────────────────────────── dashboard (resumen de lucaa.lat) ─────────────────────────────
  // Coordenadas de diseño 1240×850 (≈1.25× los px de la web) dentro del contenido del navegador.
  function card(ctx, x, y, w, h, o = {}) {
    box(ctx, x, y, w, h, 18, C.card, o.hl ? hexA(C.primary, 0.8 * o.hl) : C.line, o.hl ? 1 + o.hl : 1);
    if (o.hl) { ctx.save(); ctx.shadowColor = hexA(C.primary, 0.35 * o.hl); ctx.shadowBlur = 40; box(ctx, x, y, w, h, 18, null, hexA(C.primary, 0.01)); ctx.restore(); }
  }
  const eyebrow = (ctx, s, x, y, o = {}) => T(ctx, s.toUpperCase(), x, y, { size: 13, w: 600, c: C.muted, track: 1.1, ...o });
  // rise(): como la entrada escalonada del Resumen (sube 16 px y aparece)
  function rise(ctx, k, fn) {
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= E.out(k); ctx.translate(0, (1 - E.expo(k)) * 22); fn(); ctx.restore();
  }
  function navBar(ctx, w) {
    drawLucaMark(ctx, 22, 28, 30, 1, { stagger: false });
    T(ctx, 'Luca', 44, 36, { size: 19, w: 600 });
    const tabs = ['Resumen', 'Movimientos', 'Agregar', 'Conexiones', 'Ajustes'];
    let x = 140;
    tabs.forEach((tb, i) => {
      const ww = tw(ctx, tb, { size: 15, w: 500 }) + 28;
      if (i === 0) box(ctx, x, 12, ww, 34, 17, C.primarySoft, C.navLine);
      T(ctx, tb, x + 14, 34, { size: 15, w: 500, c: i === 0 ? C.primary2 : C.body });
      x += ww + 6;
    });
    box(ctx, w - 230, 10, 230, 38, 12, C.card, C.line);
    T(ctx, '‹', w - 212, 35, { size: 18, c: C.muted });
    T(ctx, 'Octubre 2026', w - 115, 35, { size: 15, w: 600, align: 'center' });
    T(ctx, '›', w - 20, 35, { size: 18, c: C.muted, align: 'right' });
  }
  function spentCard(ctx, x, y, w, h, kc, kb, o = {}) {
    card(ctx, x, y, w, h, o);
    eyebrow(ctx, 'Gastado en octubre', x + 26, y + 40);
    T(ctx, 'Ver detalle', x + w - 26, y + 40, { size: 15, w: 500, c: C.body, align: 'right' });
    T(ctx, 'S/', x + 26, y + 92, { size: 30, w: 500, c: C.muted, mono: true });
    T(ctx, money(D.expense * E.quint(kc)), x + 74, y + 116, { size: 66, w: 500, mono: true });
    const pill = '↓ 8 % vs septiembre', pw = tw(ctx, pill, { size: 15, w: 600 }) + 26;
    box(ctx, x + 26, y + 134, pw, 30, 15, C.successSoft);
    T(ctx, pill, x + 39, y + 154, { size: 15, w: 600, c: C.success });
    const bx = x + 26, bw = w - 52, by = y + 186;
    box(ctx, bx, by, bw, 12, 6, C.strong);
    const fw = bw * 0.917 * E.expo(kb);
    if (fw > 1) box(ctx, bx, by, fw, 12, 6, C.primary);
    if (kb > 0.6) box(ctx, bx + bw * 0.903 - 1.5, by - 6, 3, 24, 1.5, C.primary2);
    const lw = T(ctx, '92 %', bx, by + 40, { size: 15, w: 600 });
    T(ctx, ' de lo gastado en septiembre', bx + lw, by + 40, { size: 15, c: C.muted });
    T(ctx, 'Día 28 de 31', bx + bw, by + 40, { size: 15, c: C.muted, align: 'right' });
    const ty = y + 236, th = h - 236 - 20, cw = (bw - 2) / 3;
    box(ctx, bx, ty, bw, th, 14, C.line);
    const cells = [['Ingresos', D.income, 'solo tipo ingreso'], ['Te queda', D.income - D.expense, '32 % de tus ingresos'], ['Yape recibido', D.yape, '9 yapeos · no cuenta como ingreso']];
    cells.forEach((cl, i) => {
      const cx = bx + i * (cw + 1);
      ctx.save(); rr(ctx, bx, ty, bw, th, 14); ctx.clip();
      ctx.fillStyle = C.card; ctx.fillRect(cx + (i ? 0 : 1), ty + 1, cw - (i === 2 ? 1 : 0), th - 2); ctx.restore();
      eyebrow(ctx, cl[0], cx + 16, ty + 22, { size: 11.5 });
      T(ctx, 'S/ ' + money(cl[1] * E.quint(kc)), cx + 16, ty + 46, { size: 20, w: 500, mono: true });
      T(ctx, cl[2], cx + 16, ty + 64, { size: 12.5, c: C.muted });
    });
  }
  const PENDING = [['Starbucks', 16.50], ['Plaza Vea', 54.20], ['Transferencia a Luis G.', 80.00]];
  // st.saved: 0..1 confirmación de la 1.ª fila; st.collapse: 0..1; st.chipHover: 0..1
  function pendingCard(ctx, x, y, w, h, st = {}) {
    card(ctx, x, y, w, h);
    T(ctx, 'Por categorizar', x + 26, y + 42, { size: 19, w: 600 });
    const count = st.saved > 0.5 ? 2 : 3;
    box(ctx, x + 196, y + 24, 30, 24, 12, C.warningSoft);
    T(ctx, String(count), x + 211, y + 41, { size: 14, w: 700, c: C.warning, align: 'center' });
    T(ctx, 'Ver todos', x + w - 26, y + 42, { size: 15, w: 500, c: C.body, align: 'right' });
    T(ctx, 'Un toque y queda guardado en tu hoja.', x + 26, y + 70, { size: 14, c: C.muted });
    ctx.save(); rr(ctx, x, y, w, h, 18); ctx.clip();
    const col = E.inOut(clamp(st.collapse || 0));
    let ry = y + 92;
    // fila 1 (con chips)
    const r1h = 124 * (1 - col);
    if (r1h > 2) {
      ctx.save(); ctx.globalAlpha *= 1 - col;
      line(ctx, x + 26, ry, x + w - 26, ry, C.lineSoft);
      if (st.saved > 0) {
        const k = clamp(st.saved * 3);
        box(ctx, x + 14, ry + 8, w - 28, 112, 12, hexA(C.success, 0.08 * k));
      }
      T(ctx, 'Starbucks', x + 26, ry + 34, { size: 17, w: 600 });
      T(ctx, '− S/ 16.50', x + w - 26, ry + 34, { size: 16, w: 500, mono: true, align: 'right' });
      tag(ctx, x + 26, ry + 58, 'CORREO'); T(ctx, '28 oct', x + 104, ry + 62, { size: 13, c: C.muted });
      if (st.saved > 0) {
        const k = clamp(st.saved * 3);
        ctx.save(); ctx.globalAlpha *= k;
        check(ctx, x + 40, ry + 96, 22, C.success, k);
        T(ctx, 'Guardado · Comidas fuera', x + 60, ry + 102, { size: 15, w: 600, c: C.success });
        ctx.restore();
      } else {
        let cx = x + 26;
        ['Comidas fuera', 'Supermercado', 'Ocio'].forEach((c, i) => {
          const hov = i === 0 ? st.chipHover || 0 : 0;
          cx += chip(ctx, cx, ry + 98, c, CAT[c], { size: 14, h: 32, border: hov > 0.5, bg: hov ? hexA(CAT[c], 0.16 + 0.2 * hov) : null }) + 8;
        });
      }
      ctx.restore();
    }
    ry += r1h;
    for (let i = 1; i < 3; i++) {
      line(ctx, x + 26, ry, x + w - 26, ry, C.lineSoft);
      const nw = T(ctx, PENDING[i][0], x + 26, ry + 36, { size: 16, w: 600 });
      tag(ctx, x + 36 + nw, ry + 31, 'CORREO');
      T(ctx, '− S/ ' + money(PENDING[i][1]), x + w - 26, ry + 36, { size: 16, w: 500, mono: true, align: 'right' });
      ry += 56;
    }
    ctx.restore();
    return { chip: [x + 26 + 70, y + 92 + 98] };
  }
  function categoryCard(ctx, x, y, w, h, k, o = {}) {
    card(ctx, x, y, w, h, o);
    T(ctx, 'En qué se fue', x + 26, y + 42, { size: 19, w: 600 });
    T(ctx, pen(D.expense), x + w - 26, y + 42, { size: 15, mono: true, c: C.muted, align: 'right' });
    const bx = x + 26, bw = w - 52, by = y + 62;
    let cx = bx;
    ctx.save(); rr(ctx, bx, by, bw, 14, 7); ctx.clip();
    D.cats.forEach((c, i) => {
      const ww = (bw - 2 * 7) * (c[1] / D.expense) * E.expo(seg(k, i * 0.05, i * 0.05 + 0.6));
      ctx.fillStyle = CAT[c[0]]; ctx.fillRect(cx, by, ww, 14);
      cx += ww + 2;
    });
    ctx.restore();
    D.cats.forEach((c, i) => {
      const ry = y + 96 + i * 41, kk = E.out(seg(k, 0.1 + i * 0.05, 0.5 + i * 0.05));
      if (kk <= 0) return;
      ctx.save(); ctx.globalAlpha *= kk;
      if (i) line(ctx, bx, ry, bx + bw, ry, C.lineSoft);
      box(ctx, bx, ry + 6, 30, 30, 8, CAT[c[0]]);
      T(ctx, c[0][0], bx + 15, ry + 27, { size: 14, w: 700, c: '#1d1a17', align: 'center' });
      T(ctx, c[0], bx + 44, ry + 27, { size: 15.5 });
      T(ctx, Math.round((c[1] / D.expense) * 100) + ' %', bx + bw - 120, ry + 27, { size: 14, mono: true, c: C.muted, align: 'right' });
      T(ctx, pen(c[1]), bx + bw, ry + 27, { size: 15, w: 500, mono: true, align: 'right' });
      ctx.restore();
    });
  }
  function sixMonthsCard(ctx, x, y, w, h, k, o = {}) {
    card(ctx, x, y, w, h, o);
    T(ctx, 'Últimos 6 meses', x + 26, y + 40, { size: 19, w: 600 });
    const avg = D.six.reduce((a, b) => a + b[1], 0) / 6;
    T(ctx, 'Promedio ' + pen(Math.round(avg)).replace('.00', ''), x + w - 26, y + 40, { size: 13.5, c: C.muted, align: 'right' });
    const X0 = x + 60, base = y + h - 40, top = y + 70, max = 4000, col = (x + w - 20 - X0) / 6;
    [[top, '4k'], [(top + base) / 2, '2k'], [base, '0']].forEach(([yy, l], i) => {
      line(ctx, X0, yy, x + w - 20, yy, C.line, 1, i < 2 ? [2, 4] : null);
      T(ctx, l, x + 26, yy + 4, { size: 12, mono: true, c: C.muted });
    });
    const yv = (v) => base - (v / max) * (base - top);
    line(ctx, X0, yv(avg), x + w - 20, yv(avg), C.muted, 1, [4, 3]);
    D.six.forEach((m, i) => {
      const on = i === 5, cx = X0 + col * i + col / 2;
      const kk = E.expo(seg(k, i * 0.07, i * 0.07 + 0.6));
      const hh = (base - yv(m[1])) * kk;
      if (hh > 1) box(ctx, cx - 17, base - hh, 34, hh, Math.min(7, hh / 2), on ? C.primary : C.strong);
      if (kk > 0.6) T(ctx, shortAmount(m[1]), cx, base - hh - 8, { size: 12.5, mono: true, c: on ? C.primary2 : C.body, align: 'center', a: seg(kk, 0.6, 1) });
      T(ctx, m[0], cx, y + h - 14, { size: 13.5, w: on ? 600 : 400, c: on ? C.ink : C.muted, align: 'center' });
    });
  }
  function merchantsCard(ctx, x, y, w, h, k) {
    card(ctx, x, y, w, h);
    T(ctx, 'Comercios principales', x + 26, y + 40, { size: 19, w: 600 });
    D.merchants.forEach((m, i) => {
      const ry = y + 70 + i * 46, bw = w - 52;
      T(ctx, m[0], x + 26, ry + 12, { size: 15, w: 600 });
      T(ctx, pen(m[1]), x + w - 26, ry + 12, { size: 15, w: 500, mono: true, align: 'right' });
      box(ctx, x + 26, ry + 22, bw, 7, 3.5, C.strong);
      const fw = bw * (m[1] / D.merchants[0][1]) * E.expo(seg(k, i * 0.08, i * 0.08 + 0.6));
      if (fw > 1) box(ctx, x + 26, ry + 22, fw, 7, 3.5, C.primary);
    });
  }
  const MOVES = [
    { l: 'María T.', s: 'Recibido por Yape', src: 'IPHONE', a: '+ S/ 45.00', c: C.blue, g: 'Y' },
    { l: 'Rappi', s: 'Comidas fuera', src: 'CORREO', a: '− S/ 38.90', c: C.peach, g: 'C' },
    { l: 'Starbucks', s: 'Por categorizar', src: 'CORREO', a: '− S/ 16.50', c: C.none, g: '?' },
    { l: 'Netflix', s: 'Suscripciones', src: 'CORREO', a: '− S/ 44.90', c: C.lavender, g: 'S' },
    { l: 'Uber', s: 'Transporte', src: 'CORREO', a: '− S/ 14.50', c: C.teal, g: 'T' },
    { l: 'Wong', s: 'Supermercado', src: 'CORREO', a: '− S/ 126.40', c: C.mint, g: 'S' },
  ];
  function movesCard(ctx, x, y, w, h, k, st = {}) {
    card(ctx, x, y, w, h);
    T(ctx, 'Movimientos de octubre', x + 26, y + 42, { size: 19, w: 600 });
    T(ctx, 'Ver todos', x + w - 26, y + 42, { size: 15, w: 500, c: C.body, align: 'right' });
    MOVES.forEach((m, i) => {
      const ry = y + 66 + i * 58, kk = E.out(seg(k, i * 0.07, i * 0.07 + 0.5));
      if (kk <= 0) return;
      ctx.save(); ctx.globalAlpha *= kk; ctx.translate((1 - kk) * 16, 0);
      if (i === 0 && st.hl) {
        box(ctx, x + 12, ry + 2, w - 24, 54, 12, hexA(C.primary, 0.1 * st.hl), hexA(C.primary, 0.55 * st.hl), 1.5);
      }
      const recat = i === 2 && st.recat > 0;
      const col = recat ? mix(C.none, C.peach, st.recat) : m.c;
      box(ctx, x + 24, ry + 9, 40, 40, 11, col);
      T(ctx, recat ? 'C' : m.g, x + 44, ry + 35, { size: 15, w: 700, c: i === 2 && !recat ? C.body : '#1d1a17', align: 'center' });
      T(ctx, m.l, x + 78, ry + 26, { size: 15.5, w: 600 });
      const sub = recat ? 'Comidas fuera' : m.s;
      const sw = T(ctx, sub, x + 78, ry + 47, { size: 13, w: i === 2 && !recat ? 600 : 400, c: i === 2 && !recat ? C.warning : C.muted });
      tag(ctx, x + 86 + sw, ry + 43, m.src);
      T(ctx, m.a, x + w - 24, ry + 34, { size: 15.5, w: 500, mono: true, align: 'right', c: m.a[0] === '+' ? C.success : C.ink });
      ctx.restore();
    });
  }
  // Rectángulos del resumen (coordenadas de diseño)
  const DB = {
    spent: [0, 76, 760, 330], pending: [780, 76, 460, 330],
    cats: [0, 426, 400, 424], six: [420, 426, 380, 204], merch: [420, 646, 380, 204], moves: [820, 426, 420, 424],
  };
  // st: { rise: [k nav, spent, pending, cats, six, merch, moves], count, bar, cats, six, merch, moves, hl{}, pending{}, moveHl, recat }
  function drawDashboard(ctx, st) {
    const R = st.rise;
    rise(ctx, R[0], () => navBar(ctx, 1240));
    rise(ctx, R[1], () => spentCard(ctx, ...DB.spent, st.count, st.bar, { hl: st.hl.spent }));
    let chipPos = null;
    rise(ctx, R[2], () => { chipPos = pendingCard(ctx, ...DB.pending, st.pending).chip; });
    rise(ctx, R[3], () => categoryCard(ctx, ...DB.cats, st.cats, { hl: st.hl.cats }));
    rise(ctx, R[4], () => sixMonthsCard(ctx, ...DB.six, st.six, { hl: st.hl.six }));
    rise(ctx, R[5], () => merchantsCard(ctx, ...DB.merch, st.merch));
    rise(ctx, R[6], () => movesCard(ctx, ...DB.moves, st.moves, { hl: st.moveHl, recat: st.recat }));
    return { chip: chipPos || [DB.pending[0] + 96, DB.pending[1] + 190] };
  }

  // ───────────────────────────── fondo y nodos ─────────────────────────────
  function background(ctx, o = {}) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    if (!G.tex.grid) {
      const g = G.makeCanvas(W, H), c = g.getContext('2d');
      c.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = 24; y < H; y += 48) for (let x = 24; x < W; x += 48) c.fillRect(x - 1, y - 1, 2, 2);
      G.tex.grid = g;
    }
    if (o.grid !== 0) { ctx.save(); ctx.globalAlpha = o.grid == null ? 1 : o.grid; ctx.drawImage(G.tex.grid, o.gx || 0, o.gy || 0); ctx.restore(); }
    if (o.glow) glow(ctx, o.glow[0], o.glow[1], o.glow[2], o.glow[3] || C.primary, o.glow[4] == null ? 0.35 : o.glow[4]);
  }
  // Nodo: tarjeta con icono, título y subtítulo (centro x,y)
  function node(ctx, x, y, w, h, icon, title, sub, o = {}) {
    const a = o.a == null ? 1 : o.a;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    if (o.lit) glow(ctx, x, y, w * 0.9, o.litColor || C.primary, 0.5 * o.lit);
    shadowBox(ctx, x - w / 2, y - h / 2, w, h, 18, C.card, 30, 12, 0.5);
    box(ctx, x - w / 2, y - h / 2, w, h, 18, null, o.lit ? mix(C.line, o.litColor || C.primary, o.lit) : C.lineStrong, 1.5);
    if (icon) icon(ctx, x - w / 2 + 44, y);
    T(ctx, title, x - w / 2 + 82, y - (sub ? 4 : -6), { size: o.ts || 19, w: 600 });
    if (sub) T(ctx, sub, x - w / 2 + 82, y + 22, { size: 13.5, mono: true, c: C.muted });
    ctx.restore();
  }
  // Cilindro de base de datos
  function dbIcon(ctx, x, y, s, c = C.body) {
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = s * 0.06; ctx.fillStyle = C.raised;
    const w = s * 0.8, h = s, ry = s * 0.14;
    ctx.beginPath(); ctx.ellipse(x, y - h / 2 + ry, w / 2, ry, 0, PI, 0); ctx.lineTo(x + w / 2, y + h / 2 - ry);
    ctx.ellipse(x, y + h / 2 - ry, w / 2, ry, 0, 0, PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - h / 2 + ry, w / 2, ry, 0, 0, TAU); ctx.stroke();
    for (const f of [0.38, 0.66]) { ctx.beginPath(); ctx.ellipse(x, y - h / 2 + ry + (h - 2 * ry) * f, w / 2, ry, 0, 0, PI); ctx.stroke(); }
    ctx.restore();
  }
  function serverIcon(ctx, x, y, s, c = C.body) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const yy = y - s / 2 + i * s * 0.36;
      box(ctx, x - s * 0.45, yy, s * 0.9, s * 0.28, s * 0.06, C.raised, c, s * 0.05);
      ctx.fillStyle = i === 0 ? C.success : c; ctx.beginPath(); ctx.arc(x + s * 0.3, yy + s * 0.14, s * 0.035, 0, TAU); ctx.fill();
      line(ctx, x - s * 0.32, yy + s * 0.14, x + s * 0.05, yy + s * 0.14, c, s * 0.04);
    }
    ctx.restore();
  }

  // ═══════════════════════════════ ESCENAS ═══════════════════════════════

  // ── 0 · Apertura (0–8) ──
  function scene0(ctx, lt) {
    background(ctx, { grid: 0.5 * seg(lt, 1, 3), glow: [960, 470, 700, C.primary, 0.25 * seg(lt, 1.4, 3.5)] });
    ctx.save();
    const z = 1 + lt * 0.006;
    cam(ctx, 960, 540, z);
    // línea que cruza y se pliega
    const kl = E.expo(seg(lt, 0.3, 1.5)), kf = E.inOut(seg(lt, 1.5, 2.3));
    if (kl > 0 && kf < 1) {
      const half = 900 * kl * (1 - kf);
      ctx.save(); ctx.shadowColor = C.primary; ctx.shadowBlur = 18;
      line(ctx, 960 - half, 470 - kf * 60, 960 + half, 470 + kf * 40, C.primary, 2 + kf * 2);
      ctx.restore();
      glow(ctx, 960, 470, 120 * (1 - kf) + 40, C.primary2, 0.8 * kl);
    }
    drawLucaMark(ctx, 960, 430, 300, seg(lt, 1.9, 3.4));
    drawWordmark(ctx, 960, 690, 76, seg(lt, 3.0, 4.2));
    words(ctx, 'Finanzas personales, sin servidores.', 960, 776, { size: 30, w: 400, c: C.body, align: 'center' }, 4.6, lt, 0.08);
    ctx.restore();
  }

  // ── 1 · El problema (8–22) ──
  const N1 = [
    { app: 'yape', title: 'Yape', body: 'Recibiste S/ 45.00 de María T.' },
    { app: 'bcp', title: 'BCP', body: 'Consumo de S/ 38.90 en RAPPI' },
    { app: 'yape', title: 'Yape', body: 'Yapeaste S/ 12.00 a Carlos R.' },
    { app: 'gmail', title: 'Gmail · BCP', body: 'Constancia de transferencia' },
    { app: 'bcp', title: 'BCP', body: 'Consumo de S/ 126.40 en WONG' },
    { app: 'yape', title: 'Yape', body: 'Recibiste S/ 20.00 de Ana P.' },
    { app: 'bcp', title: 'BCP', body: 'Pago de servicio: Luz del Sur' },
    { app: 'bcp', title: 'BCP', body: 'Consumo de S/ 14.50 en UBER' },
    { app: 'yape', title: 'Yape', body: 'Yapeaste S/ 8.50 a Bodega Lucho' },
    { app: 'gmail', title: 'Gmail · BCP', body: 'Consumo con tu tarjeta de débito' },
    { app: 'bcp', title: 'BCP', body: 'Consumo de S/ 44.90 en NETFLIX' },
    { app: 'yape', title: 'Yape', body: 'Recibiste S/ 150.00 de Jorge L.' },
  ];
  const S1N = 24, S1T = (i) => 0.7 + 8.4 * Math.pow(i / S1N, 0.6);
  const S1_FREEZE = 9.6;
  const S1_FLOAT = Array.from({ length: 16 }, (_, i) => {
    const side = i % 2 ? 1 : -1, r = hash(i, 11);
    return { t: 4.6 + i * 0.3, x: side > 0 ? 1230 + r * 420 : 110 + r * 400, y: 130 + hash(i, 12) * 760, s: 0.72 + hash(i, 13) * 0.25, n: N1[(i * 5 + 3) % N1.length], d: hash(i, 14) };
  });
  function s1content(ctx, lt) {
    const tl = Math.min(lt, S1_FREEZE);
    background(ctx, { glow: [960, 560, 700, '#7a2f8a', 0.18] });
    ctx.save();
    cam(ctx, 960, 540, 1.0 + tl * 0.006);
    // notificaciones que desbordan alrededor del teléfono
    S1_FLOAT.forEach((f, i) => {
      const k = seg(tl, f.t, f.t + 0.5);
      if (k <= 0) return;
      ctx.save();
      ctx.translate(f.x + 186 * f.s, f.y + (tl - f.t) * (8 + f.d * 10));
      ctx.scale(f.s * (0.9 + 0.1 * E.spring(k)), f.s * (0.9 + 0.1 * E.spring(k)));
      ctx.globalAlpha *= clamp(k * 2) * 0.85;
      drawNotif(ctx, -186, -46, 372, { ...f.n, time: `${(i % 4) + 1} min` }, { solid: true });
      ctx.restore();
    });
    drawPhone(ctx, 960, 548, 1.0, (c, sw, sh) => {
      T(c, 'martes 28 de octubre', sw / 2, 104, { size: 19, w: 500, c: 'rgba(255,255,255,0.8)', align: 'center' });
      T(c, '9:41', sw / 2, 196, { size: 96, w: 600, c: 'rgba(255,255,255,0.92)', align: 'center' });
      for (let i = 0; i < S1N; i++) {
        const t0 = S1T(i);
        const k = seg(tl, t0, t0 + 0.45);
        if (k <= 0) continue;
        let slot = 0;
        for (let j = i + 1; j < S1N; j++) slot += E.out(seg(tl, S1T(j), S1T(j) + 0.35));
        const y = 236 + slot * 102 - (1 - E.spring(k)) * 60;
        if (y > sh) continue;
        c.save(); c.globalAlpha *= clamp(k * 2.5);
        const n = N1[i % N1.length];
        drawNotif(c, 12, y, sw - 24, { ...n, time: slot < 0.5 ? 'ahora' : `${Math.round(slot)} min` });
        c.restore();
      }
    });
    ctx.restore();
  }
  function scene1(ctx, lt) {
    const kb = E.inOut(seg(lt, S1_FREEZE, S1_FREEZE + 0.9));
    if (kb <= 0 || G.lite) { s1content(ctx, lt); if (kb <= 0) return; }
    else blurred(ctx, offscreen((c) => s1content(c, lt)), kb);
    ctx.fillStyle = hexA('#080808', 0.62 * kb); ctx.fillRect(0, 0, W, H);
    const kc = seg(lt, 10.2, 11.6);
    if (kc > 0) {
      const a = E.out(seg(lt, 10.2, 10.7));
      T(ctx, String(Math.round(37 * E.quint(kc))), 960, 500, { size: 200, w: 600, mono: true, align: 'center', a });
      T(ctx, 'movimientos este mes', 960, 576, { size: 38, w: 400, c: C.body, align: 'center', a });
    }
    words(ctx, '0 registrados.', 960, 690, { size: 64, w: 600, c: C.primary, align: 'center' }, 11.8, lt, 0.12);
  }

  // ── 2 · El viaje de un yapeo (22–50) ──
  const PH2 = { x: 330, y: 470, s: 0.78 };
  const HERO = { app: 'yape', title: 'Yape', body: 'Recibiste S/ 45.00 de María T.' };
  const HERO_Y = PH2.y + (-415 + 16 + 236 + 46) * PH2.s; // centro de la notificación en el mundo
  const AS = { x: 960, y: 560, w: 440, h: 340 };
  const SH2 = { x: 1300, y: 300, w: 560 };
  const T2 = {
    notif: 0.5, shortcut: 2.6, morph: 3.6, pull: [4.6, 6.4], travel: [6.2, 9.8],
    stages: [10.4, 11.4, 12.4], chip: 12.9, out1: [13.8, 15.0],
    gmail: 16.2, travel2: [17.6, 19.4], stages2: [19.5, 20.0, 20.5], out2: [21.0, 22.2], push: [22.4, 27.5],
  };
  const P2A = [[PH2.x, HERO_Y], [560, HERO_Y + 40], [560, 700], [AS.x - AS.w / 2, AS.y + 40]];
  const P2G = [[600, 940], [780, 940], [AS.x, 880], [AS.x, AS.y + AS.h / 2]];
  const JSON_YAPE = [['{'], ['app', '"Yape"', C.primary2], ['monto', '45.00', C.success], ['de', '"María T."', C.primary2], ['tipo', '"transfer_in"', C.blue], ['}']];
  const JSON_BCP = [['{'], ['banco', '"BCP"', C.primary2], ['monto', '38.90', C.success], ['comercio', '"RAPPI"', C.primary2], ['}']];
  const STAGES = [['Parser', 'correo · push → movimiento'], ['Dedupe', 'id + monto/minuto'], ['Categoría', 'tú → reglas → caché → LLM']];
  function outPath(row) {
    const p = sheetCell(SH2.x, SH2.y, SH2.w, row, 0);
    return [[AS.x + AS.w / 2, AS.y], [1200, AS.y], [1220, p[1]], [p[0] - 34, p[1]]];
  }
  function appsScriptBox(ctx, x, y, w, h, st) {
    shadowBox(ctx, x - w / 2, y - h / 2, w, h, 22, C.card, 50, 20, 0.6);
    box(ctx, x - w / 2, y - h / 2, w, h, 22, null, st.lit ? mix(C.lineStrong, C.primary, st.lit) : C.lineStrong, 1.5);
    drawAppsScript(ctx, x - w / 2 + 44, y - h / 2 + 46, 40);
    T(ctx, 'Tu Apps Script', x - w / 2 + 80, y - h / 2 + 42, { size: 20, w: 600 });
    T(ctx, 'corre con tu identidad · en tu Google', x - w / 2 + 80, y - h / 2 + 64, { size: 13.5, c: C.muted });
    STAGES.forEach((sg, i) => {
      const yy = y - h / 2 + 100 + i * 66, on = st.on[i];
      box(ctx, x - w / 2 + 22, yy, w - 44, 54, 14, on ? hexA(C.primary, 0.1 * on) : C.raised, on ? hexA(C.primary, 0.3 + 0.5 * on) : C.line, 1.2);
      T(ctx, sg[0], x - w / 2 + 44, yy + 24, { size: 17, w: 600 });
      T(ctx, sg[1], x - w / 2 + 44, yy + 44, { size: 12.5, mono: true, c: C.muted });
      if (st.done[i] > 0) check(ctx, x + w / 2 - 50, yy + 27, 22, C.success, st.done[i]);
      else if (on > 0) spinner(ctx, x + w / 2 - 50, yy + 27, 8, G.t, C.primary2);
    });
  }
  function scene2(ctx, lt) {
    background(ctx, { glow: [960, 540, 900, C.primary, 0.12] });
    ctx.save();
    const kp = E.inOut(seg(lt, T2.pull[0], T2.pull[1])), kpush = E.inOut(seg(lt, T2.push[0], T2.push[1]));
    const cx = lerp(PH2.x + 40, 960, kp) + kpush * 80, cy = lerp(HERO_Y + 20, 560, kp) - kpush * 10;
    cam(ctx, cx, cy, lerp(2.15, 1.0, kp) + kpush * 0.07);
    // teléfono con la notificación protagonista
    const morph = E.inOut(seg(lt, T2.morph, T2.morph + 1.0));
    drawPhone(ctx, PH2.x, PH2.y, PH2.s, (c, sw) => {
      T(c, '9:41', sw / 2, 196, { size: 96, w: 600, c: 'rgba(255,255,255,0.92)', align: 'center' });
      T(c, 'martes 28 de octubre', sw / 2, 104, { size: 19, w: 500, c: 'rgba(255,255,255,0.8)', align: 'center' });
      const k = seg(lt, T2.notif, T2.notif + 0.6);
      if (k > 0 && morph < 1) {
        c.save(); c.globalAlpha *= clamp(k * 2) * (1 - morph);
        drawNotif(c, 12, 236 - (1 - E.spring(k)) * 60, sw - 24, HERO);
        c.restore();
      }
      // atajo de iOS
      const ks = pulse(lt, T2.shortcut, T2.morph + 0.6, 0.25);
      if (ks > 0) {
        c.save(); c.globalAlpha *= ks;
        box(c, sw / 2 - 120, 352, 240, 50, 25, 'rgba(40,36,48,0.9)');
        drawShortcuts(c, sw / 2 - 90, 377, 30);
        T(c, 'Atajo · Luca', sw / 2 - 64, 383, { size: 16, w: 600, c: '#fff' });
        c.restore();
        const kr = seg(lt, T2.shortcut, T2.shortcut + 0.9);
        c.save(); c.strokeStyle = hexA('#a855f7', 1 - kr); c.lineWidth = 3;
        rr(c, 12 - kr * 14, 236 - kr * 14, sw - 24 + kr * 28, 92 + kr * 28, 24 + kr * 10); c.stroke(); c.restore();
      }
    });
    // camino "esperado" por servidores de Luca (tachado)
    const kb = E.out(seg(lt, 6.0, 6.6)), kst = seg(lt, 7.0, 7.6);
    if (kb > 0) {
      ctx.save(); ctx.globalAlpha *= kb * (1 - 0.5 * seg(lt, 12, 14));
      line(ctx, PH2.x + 160, HERO_Y - 40, 520, 260, C.lineStrong, 2, [6, 8]);
      line(ctx, 780, 250, AS.x - 120, AS.y - AS.h / 2, C.lineStrong, 2, [6, 8]);
      box(ctx, 520, 196, 260, 108, 18, C.sunken, C.lineStrong, 1.5);
      serverIcon(ctx, 572, 250, 44, C.muted);
      T(ctx, 'Servidores', 610, 244, { size: 18, w: 600, c: C.muted });
      T(ctx, 'de Luca', 610, 268, { size: 18, w: 600, c: C.muted });
      strike(ctx, 524, 200, 252, 100, kst, C.primary, 5);
      ctx.restore();
    }
    // trazo real
    const kt = seg(lt, T2.travel[0], T2.travel[1]);
    if (kt > 0) {
      strokeBz(ctx, P2A, 0, E.inOut(kt), hexA(C.primary2, 0.35), 2, [2, 8], -lt * 30);
      const lbl = E.out(seg(lt, 7.4, 8.2));
      if (lbl > 0) T(ctx, 'POST /exec · directo a tu Apps Script', 520, 760, { size: 16, mono: true, c: C.primary2, a: lbl * (1 - seg(lt, 15, 16)) });
    }
    // Apps Script
    const kas = E.out(seg(lt, 5.4, 6.4));
    if (kas > 0) {
      ctx.save(); ctx.globalAlpha *= kas;
      const on = [0, 1, 2].map((i) => Math.max(seg(lt, T2.stages[i] - 0.4, T2.stages[i]) * (1 - seg(lt, T2.stages[i] + 1.4, T2.stages[i] + 2)), seg(lt, T2.stages2[i] - 0.3, T2.stages2[i]) * (1 - seg(lt, T2.stages2[i] + 1.2, T2.stages2[i] + 1.8))));
      const done = [0, 1, 2].map((i) => Math.max(seg(lt, T2.stages[i], T2.stages[i] + 0.35) * (1 - seg(lt, 15.5, 16)), seg(lt, T2.stages2[i], T2.stages2[i] + 0.3)));
      appsScriptBox(ctx, AS.x, AS.y, AS.w, AS.h, { on, done, lit: Math.max(pulse(lt, 9.6, 13.6, 0.5), pulse(lt, 19.2, 21.4, 0.4)) });
      // chip de categoría
      [[T2.chip, 'Recibido Yape', C.blue, 1], [T2.stages2[2] + 0.4, 'Comidas fuera', C.peach, 2]].forEach(([t0, l, c, n]) => {
        const k = E.spring(seg(lt, t0, t0 + 0.7)), out = seg(lt, t0 + 0.9, t0 + 1.3);
        if (k > 0 && out < 1) {
          ctx.save(); ctx.globalAlpha *= 1 - out;
          chip(ctx, AS.x, AS.y + AS.h / 2 + 34 - (1 - k) * 30, l, c, { align: 'center', size: 16, h: 34, border: true });
          ctx.restore();
        }
      });
      ctx.restore();
    }
    // paquete: morph en el teléfono y viaje
    const ka = E.inOut(kt);
    if (morph > 0 && ka < 1) {
      const p = kt > 0 ? bz(P2A, ka) : [PH2.x, HERO_Y];
      if (kt > 0) trail(ctx, P2A, ka, 0.18, C.primary2, 3);
      drawPacket(ctx, p[0], p[1], lerp(0.78, 0.5, ka) * lerp(0.9, 1, morph), JSON_YAPE, morph * (1 - seg(ka, 0.9, 1)));
    }
    // Gmail con el correo del BCP
    const kg = E.out(seg(lt, T2.gmail, T2.gmail + 0.8));
    if (kg > 0) {
      ctx.save(); ctx.globalAlpha *= kg; ctx.translate(-(1 - kg) * 40, 0);
      drawGmail(ctx, 140, 940, 64);
      box(ctx, 190, 900, 400, 80, 16, C.card, C.lineStrong);
      drawBCP(ctx, 226, 940, 40);
      T(ctx, 'BCP · Consumo con tarjeta', 258, 932, { size: 16, w: 600 });
      T(ctx, 'S/ 38.90 en RAPPI', 258, 956, { size: 15, c: C.body });
      ctx.restore();
      const kt2 = seg(lt, T2.travel2[0], T2.travel2[1]);
      if (kt2 > 0 && kt2 < 1) {
        const e = E.inOut(kt2), p = bz(P2G, e);
        strokeBz(ctx, P2G, 0, e, hexA(C.gBlue, 0.35), 2, [2, 8], -lt * 30);
        trail(ctx, P2G, e, 0.2, C.gBlue, 3);
        drawPacket(ctx, p[0], p[1], 0.48, JSON_BCP, 1 - seg(e, 0.9, 1), C.gBlue);
      }
    }
    // salida hacia la hoja
    [[T2.out1, 4, C.blue], [T2.out2, 5, C.peach]].forEach(([tt, row, c]) => {
      const k = seg(lt, tt[0], tt[1]);
      if (k > 0 && k < 1) { const P = outPath(row); strokeBz(ctx, P, 0, E.inOut(k), hexA(c, 0.4), 2); trail(ctx, P, E.inOut(k), 0.25, c, 3); }
    });
    // la hoja
    const ksh = E.out(seg(lt, 5.8, 6.8));
    if (ksh > 0) {
      drawSheet(ctx, SH2.x, SH2.y + (1 - ksh) * 30, SH2.w, ROWS1, {
        a: ksh,
        glow: Math.max(pulse(lt, T2.out1[1] - 0.2, T2.out1[1] + 1.4, 0.4), pulse(lt, T2.out2[1] - 0.2, T2.out2[1] + 1.4, 0.4), 0.6 * seg(lt, T2.push[0], T2.push[0] + 1)),
        row: (r) => {
          if (r < 4) return {};
          const t0 = r === 4 ? T2.out1[1] : T2.out2[1];
          return { a: seg(lt, t0 - 0.1, t0 + 0.1), fill: seg(lt, t0, t0 + 0.8), flash: pulse(lt, t0, t0 + 1.8, 0.3) };
        },
      });
      const kl = E.out(seg(lt, T2.push[0], T2.push[0] + 1));
      if (kl > 0) {
        T(ctx, 'Tu Google Sheet', SH2.x, SH2.y + sheetH(6) + 52, { size: 26, w: 600, a: kl });
        T(ctx, 'pestaña Movimientos · en tu Drive', SH2.x, SH2.y + sheetH(6) + 82, { size: 17, c: C.muted, a: kl });
      }
    }
    ctx.restore();
  }

  // ── 3 · La hoja es el centro (50–68) ──
  const T3 = { center: [0.2, 2.4], db: 3.4, dbStrike: 4.6, dbBurst: [5.0, 6.6], srv: 5.6, srvStrike: 6.6, srvBurst: [7.0, 8.6], rows: [9.8, 11.4, 13.0], branch: [14.6, 16.4] };
  const SH3 = { x: 960 - 320, y: 210, w: 640 };
  function scene3(ctx, lt) {
    background(ctx, { glow: [960, 400, 800, C.sheets, 0.12 * seg(lt, 1, 4)] });
    ctx.save();
    cam(ctx, 960, 540, 1 + lt * 0.004);
    const kc = E.inOut(seg(lt, T3.center[0], T3.center[1]));
    const kside = E.inOut(seg(lt, T3.branch[0] - 0.6, T3.branch[0] + 0.8));
    const sx = lerp(lerp(SH2.x, SH3.x, kc), 240, kside), sy = lerp(lerp(SH2.y, SH3.y, kc), 300, kside), sw = lerp(lerp(SH2.w, SH3.w, kc), 560, kside);
    const sheetH3 = sheetH(6) * (sw / 560);
    // cilindro y servidores que se tachan y convergen en la hoja
    const target = [sx + sw / 2, sy + sheetH3 / 2];
    [[T3.db, T3.dbStrike, T3.dbBurst, 420, 'Base de datos', dbIcon, 11], [T3.srv, T3.srvStrike, T3.srvBurst, 1500, 'Servidores', serverIcon, 23]].forEach(([t0, ts, tb, x, label, icon, seed]) => {
      const k = E.out(seg(lt, t0, t0 + 0.6));
      if (k <= 0) return;
      const gone = seg(lt, tb[0], tb[0] + 0.15);
      if (gone < 1) {
        ctx.save(); ctx.globalAlpha *= k * (1 - gone);
        ctx.translate(0, (1 - k) * 20);
        box(ctx, x - 130, 380, 260, 220, 22, C.card, C.lineStrong, 1.5);
        icon(ctx, x, 470, 96, C.body);
        T(ctx, label, x, 566, { size: 22, w: 600, align: 'center', c: C.body });
        strike(ctx, x - 150, 370, 300, 240, seg(lt, ts, ts + 0.5), C.primary, 6);
        ctx.restore();
      }
      particles(ctx, x, 490, 260, 220, seg(lt, tb[0], tb[1]), { to: target, seed, c: C.body, n: 180 });
    });
    drawSheet(ctx, sx, sy, sw, ROWS1, { glow: 0.4 + 0.6 * Math.max(pulse(lt, T3.dbBurst[1] - 0.3, T3.dbBurst[1] + 0.8, 0.3), pulse(lt, T3.srvBurst[1] - 0.3, T3.srvBurst[1] + 0.8, 0.3)) });
    // afirmaciones
    const rows = [['Base de datos', 'tu Google Sheet', C.sheets], ['Backend', 'tu cuenta de Google · Apps Script', C.gBlue], ['Datos en servidores de Luca', '0 bytes', C.primary2]];
    const ra = 1 - seg(lt, T3.branch[0] - 0.8, T3.branch[0]);
    rows.forEach((r, i) => {
      const k = E.expo(seg(lt, T3.rows[i], T3.rows[i] + 0.7));
      if (k <= 0 || ra <= 0) return;
      const y = 770 + i * 62;
      ctx.save(); ctx.globalAlpha *= k * ra;
      T(ctx, r[0], 930 - (1 - k) * 30, y, { size: 26, w: 400, c: C.muted, align: 'right' });
      T(ctx, '→', 960, y, { size: 26, c: C.lineStrong, align: 'center' });
      T(ctx, r[1], 990 + (1 - k) * 30, y, { size: 28, w: 600, c: i === 2 ? C.primary2 : C.ink });
      ctx.restore();
    });
    // ramas hacia la web y la IA
    const kb = seg(lt, T3.branch[0], T3.branch[1]);
    if (kb > 0) {
      const from = [sx + sw + 10, sy + sheetH3 / 2];
      const targets = [[1380, 330, 'Web', 'lucaa.lat · solo muestra', (c, x, y) => drawLucaMark(c, x, y, 40, 1, { stagger: false })],
        [1380, 760, 'Tu IA', 'Claude · ChatGPT vía MCP', (c, x, y) => { drawClaude(c, x - 8, y - 8, 15); drawChatGPT(c, x + 10, y + 10, 12, C.ink); }]];
      targets.forEach((tg, i) => {
        const P = [from, [from[0] + 200, from[1]], [tg[0] - 360, tg[1]], [tg[0] - 170, tg[1]]];
        const k = E.inOut(seg(kb, i * 0.15, 0.7 + i * 0.15));
        strokeBz(ctx, P, 0, k, hexA(C.primary2, 0.6), 2.5);
        if (k > 0 && k < 1) trail(ctx, P, k, 0.2, C.primary2, 3);
        if (k > 0.85) node(ctx, tg[0] + 30, tg[1], 400, 100, tg[4], tg[2], tg[3], { a: seg(k, 0.85, 1), lit: pulse(lt, 16.2, 18, 0.4), ts: 24 });
      });
    }
    ctx.restore();
  }

  // ── 4 · La web, una ventana (68–98) ──
  const SH4 = { x: 60, y: 330, w: 470 };
  const BR = { x: 600, y: 62, w: 1272, h: 956 };
  const DSC = 1240 / 1240; // escala del resumen dentro del navegador
  const T4 = {
    enter: [0.2, 1.8], pulses: [1.6, 4.0], rise0: 3.6, count: [4.6, 6.8],
    focus: [[10.0, 'spent'], [12.0, 'cats'], [14.2, 'six']], focusEnd: 16.6,
    cur: [17.4, 18.7], click: 18.9, saved: [19.1, 20.1], collapse: [20.4, 21.0], link: [19.0, 20.0], glass: [23.6, 25.2],
  };
  const DBX = BR.x + 16, DBY = BR.y + 52 + 18; // origen del resumen en el mundo
  const dbw = (r) => [DBX + (r[0] + r[2] / 2) * DSC, DBY + (r[1] + r[3] / 2) * DSC];
  function scene4(ctx, lt) {
    background(ctx, {});
    ctx.save();
    // cámara: enfoque por tarjeta
    // va de una tarjeta a la siguiente sin volver al plano general
    const fk = [[0, 960, 540, 1], [T4.focus[0][0], 960, 540, 1]];
    T4.focus.forEach(([t0, id], i) => { const p = dbw(DB[id]); const z = id === 'spent' ? 1.5 : 1.75; fk.push([t0 + 0.9, p[0], p[1], z], [(T4.focus[i + 1] ? T4.focus[i + 1][0] : T4.focusEnd - 0.6), p[0], p[1], z * 1.03]); });
    fk.push([T4.focusEnd + 0.4, 960, 540, 1]);
    const [cx, cy, z] = camAt(fk, lt);
    cam(ctx, cx, cy, z * (1 + lt * 0.0015));
    // la hoja a la izquierda
    const ke = E.inOut(seg(lt, T4.enter[0], T4.enter[1]));
    const sx = lerp(240, SH4.x, ke), sy = lerp(300, SH4.y, ke), sw = lerp(560, SH4.w, ke);
    const catK = seg(lt, T4.link[0] + 0.4, T4.link[0] + 0.7);
    drawSheet(ctx, sx, sy, sw, ROWS1, {
      glow: 0.3 + 0.7 * pulse(lt, T4.link[0] + 0.3, T4.link[1] + 0.8, 0.3),
      row: (r) => (r === 3 ? { cat: catK > 0 ? 'Comidas fuera' : '', catFlash: pulse(lt, T4.link[0] + 0.4, T4.link[1] + 1.2, 0.3), hl: catK > 0 && lt < T4.link[1] + 1.4 ? { col: 3 } : null } : {}),
    });
    T(ctx, 'Tu hoja', SH4.x, SH4.y - 24, { size: 20, w: 600, c: C.body, a: ke });
    // pulsos de datos hacia el navegador
    const sheetMid = [sx + sw, sy + 140];
    const PP = [sheetMid, [sheetMid[0] + 60, sheetMid[1]], [BR.x - 60, BR.y + 300], [BR.x + 2, BR.y + 300]];
    const kpz = seg(lt, T4.pulses[0], T4.pulses[1]);
    if (kpz > 0) {
      strokeBz(ctx, PP, 0, 1, hexA(C.primary2, 0.35 * (1 - seg(lt, 9, 10))), 2, [3, 7], -lt * 40);
      for (let i = 0; i < 3; i++) {
        const k = seg(kpz, i * 0.2, 0.6 + i * 0.2);
        if (k > 0 && k < 1) trail(ctx, PP, E.inOut(k), 0.15, C.primary2, 3);
      }
      T(ctx, 'Sheets API · desde tu navegador', 300, sy + sheetH(6) * (sw / 560) + 50, { size: 15, mono: true, c: C.primary2, a: E.out(seg(lt, 2, 2.6)) * (1 - seg(lt, 9, 10)), align: 'center' });
    }
    // navegador y resumen
    const kbr = E.out(seg(lt, T4.enter[0] + 0.3, T4.enter[1] + 0.2));
    const glass = E.inOut(seg(lt, T4.glass[0], T4.glass[1]));
    if (kbr > 0) {
      ctx.save(); ctx.globalAlpha *= kbr;
      const s = 0.97 + 0.03 * kbr;
      ctx.translate(BR.x + BR.w / 2, BR.y + BR.h / 2); ctx.scale(s, s); ctx.translate(-(BR.x + BR.w / 2), -(BR.y + BR.h / 2));
      drawBrowser(ctx, BR.x, BR.y, BR.w, BR.h, 'lucaa.lat/app', { glass: lerp(0.96, 0.25, glass) });
      ctx.save(); ctx.globalAlpha *= 1 - glass * 0.88;
      ctx.translate(DBX, DBY); ctx.scale(DSC, DSC);
      const R = [0, 1, 2, 3, 4, 5, 6].map((i) => seg(lt, T4.rise0 + i * 0.32, T4.rise0 + i * 0.32 + 0.7));
      const hl = {};
      T4.focus.forEach(([t0, id], i) => { hl[id] = pulse(lt, t0 + 0.5, (T4.focus[i + 1] ? T4.focus[i + 1][0] : T4.focusEnd) + 0.2, 0.4); });
      const curK = E.inOut(seg(lt, T4.cur[0], T4.cur[1]));
      const press = pulse(lt, T4.click - 0.08, T4.click + 0.12, 0.08);
      const dash = drawDashboard(ctx, {
        rise: R, count: seg(lt, T4.count[0], T4.count[1]), bar: seg(lt, T4.count[0] + 0.4, T4.count[1] + 0.4),
        cats: seg(lt, T4.rise0 + 1.0, T4.rise0 + 2.6), six: seg(lt, T4.rise0 + 1.3, T4.rise0 + 2.9), merch: seg(lt, T4.rise0 + 1.6, T4.rise0 + 3.2), moves: seg(lt, T4.rise0 + 1.9, T4.rise0 + 3.6),
        hl, pending: { chipHover: seg(lt, T4.cur[1] - 0.3, T4.cur[1]), saved: seg(lt, T4.saved[0], T4.saved[1]), collapse: seg(lt, T4.collapse[0], T4.collapse[1]) },
        moveHl: pulse(lt, T4.rise0 + 3.4, 9.6, 0.5), recat: seg(lt, T4.saved[0] + 0.2, T4.saved[0] + 0.8),
      });
      // cursor
      if (lt > T4.cur[0] - 0.3 && lt < T4.collapse[1] + 0.8) {
        const c0 = [900, 760], c1 = [dash.chip[0] + 10, dash.chip[1] + 6];
        ripple(ctx, c1[0] - 4, c1[1] - 4, seg(lt, T4.click, T4.click + 0.6));
        ctx.save(); ctx.globalAlpha *= pulse(lt, T4.cur[0] - 0.3, T4.collapse[1] + 0.8, 0.3);
        cursor(ctx, lerp(c0[0], c1[0], curK), lerp(c0[1], c1[1], curK) + Math.sin(curK * PI) * -40, 1.25, press);
        ctx.restore();
      }
      ctx.restore();
      // vidrio: "0 bytes"
      if (glass > 0) {
        const cxB = BR.x + BR.w / 2, cyB = BR.y + BR.h / 2;
        T(ctx, '0 bytes', cxB, cyB - 10, { size: 130, w: 600, align: 'center', a: glass, c: C.ink });
        T(ctx, 'de tus datos guardados en lucaa.lat', cxB, cyB + 56, { size: 30, c: C.body, align: 'center', a: glass });
        const ka = E.out(seg(lt, T4.glass[1], T4.glass[1] + 1.0));
        if (ka > 0) T(ctx, '← todo lo que ves vive en tu hoja', cxB, cyB + 130, { size: 24, w: 500, c: C.primary2, align: 'center', a: ka });
      }
      ctx.restore();
    }
    // enlace celda ↔ chip (en coordenadas de mundo)
    const kl = seg(lt, T4.link[0], T4.link[1]);
    if (kl > 0 && kl < 1 || pulse(lt, T4.link[0], T4.link[1] + 0.8, 0.3) > 0) {
      const a = sheetCell(sx, sy, sw, 3, 3), b = [DBX + (DB.pending[0] + 96) * DSC, DBY + (DB.pending[1] + 190) * DSC];
      const P = [b, [b[0] - 260, b[1] + 120], [a[0] + 240, a[1] + 40], a];
      ctx.save(); ctx.globalAlpha *= pulse(lt, T4.link[0], T4.link[1] + 0.8, 0.3);
      strokeBz(ctx, P, 0, E.inOut(kl), hexA(C.success, 0.6), 2.5);
      if (kl < 1) trail(ctx, P, E.inOut(kl), 0.25, C.success, 3.5);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 5 · Pregúntale a tu IA (98–122) ──
  const CW = { x: 300, y: 64, w: 1320, h: 640 };
  const RN = [[380, 'ai'], [800, 'mcp'], [1200, 'as'], [1560, 'sheet']]; // nodos de la ruta (y = 860)
  const RY = 860;
  const T5 = {
    win: [0.4, 1.2], type1: [1.6, 3.0], send1: 3.2, tool1: 3.6, go1: [3.8, 6.4], back1: [6.6, 8.4], ans1: [8.6, 10.6], bars1: [10.2, 11.6],
    sw: [12.3, 12.9], type2: [13.1, 14.2], send2: 14.4, tool2: 14.8, go2: [15.0, 16.8], back2: [17.0, 18.4], ans2: [18.6, 19.6], row: [19.6, 23.4],
  };
  const Q1 = '¿En qué gasté más este mes?', Q2 = 'Agrega 18 soles de taxi';
  const A1 = 'Este mes llevas S/ 2,847.30. Lo que más pesa:';
  const A2 = 'Listo. Registré Taxi · S/ 18.00 · Transporte, hoy.';
  function chatWindow(ctx, lt) {
    const gpt = E.inOut(seg(lt, T5.sw[0], T5.sw[1]));
    const bg = mix(C.claudeBg, C.gptBg, gpt);
    const { x, y, w, h } = CW;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30;
    box(ctx, x, y, w, h, 22, bg); ctx.restore();
    box(ctx, x, y, w, h, 22, null, 'rgba(255,255,255,0.10)', 1.5);
    // cabecera: selector Claude | ChatGPT y conector
    const sx = x + 24, sy = y + 18;
    box(ctx, sx, sy, 340, 44, 14, 'rgba(255,255,255,0.05)');
    box(ctx, sx + 4 + gpt * 166, sy + 4, 166, 36, 11, 'rgba(255,255,255,0.11)');
    drawClaude(ctx, sx + 34, sy + 22, 11);
    T(ctx, 'Claude', sx + 54, sy + 28, { size: 17, w: 600, c: gpt < 0.5 ? C.ink : C.muted });
    drawChatGPT(ctx, sx + 200, sy + 22, 10, gpt > 0.5 ? C.ink : C.muted);
    T(ctx, 'ChatGPT', sx + 220, sy + 28, { size: 17, w: 600, c: gpt > 0.5 ? C.ink : C.muted });
    const cw = 250;
    box(ctx, x + w - cw - 24, sy + 4, cw, 36, 18, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)');
    drawLucaMark(ctx, x + w - cw, sy + 22, 20, 1, { stagger: false });
    T(ctx, 'Conector Luca · MCP', x + w - cw + 18, sy + 28, { size: 14.5, w: 500, c: C.body });
    ctx.fillStyle = C.success; ctx.beginPath(); ctx.arc(x + w - 42, sy + 22, 5, 0, TAU); ctx.fill();
    line(ctx, x, y + 80, x + w, y + 80, 'rgba(255,255,255,0.07)');
    // conversaciones (crossfade al cambiar de asistente)
    const convo = (c, which) => {
      const isG = which === 1, Q = isG ? Q2 : Q1, tt = isG ? T5.type2 : T5.type1, ts = isG ? T5.send2 : T5.send1;
      const tool = isG ? T5.tool2 : T5.tool1, go = isG ? T5.go2 : T5.go1, back = isG ? T5.back2 : T5.back1, ans = isG ? T5.ans2 : T5.ans1;
      const bub = isG ? C.gptBubble : C.claudeBubble;
      // burbuja del usuario
      const kb = E.expo(seg(lt, ts, ts + 0.5));
      if (kb > 0) {
        const bw = tw(c, Q, { size: 21 }) + 48;
        c.save(); c.globalAlpha *= kb; c.translate(0, (1 - kb) * 20);
        box(c, x + w - 60 - bw, y + 112, bw, 56, 22, bub);
        T(c, Q, x + w - 60 - bw + 24, y + 148, { size: 21 });
        c.restore();
      }
      // llamada a herramienta
      const kt = E.out(seg(lt, tool, tool + 0.4));
      if (kt > 0) {
        c.save(); c.globalAlpha *= kt;
        const ay = y + 210;
        if (isG) drawChatGPT(c, x + 84, ay + 4, 14, C.ink); else drawClaude(c, x + 84, ay + 4, 16);
        box(c, x + 116, ay - 18, 470, 44, 12, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.09)');
        const doneK = seg(lt, back[1] - 0.1, back[1] + 0.2);
        if (doneK > 0) check(c, x + 142, ay + 4, 18, C.success, doneK); else spinner(c, x + 142, ay + 4, 8, G.t, C.primary2);
        T(c, doneK > 0 ? 'Usó' : 'Usando', x + 162, ay + 10, { size: 16, c: C.muted });
        T(c, 'luca · ' + (isG ? 'add_expense' : 'category_breakdown'), x + 162 + (doneK > 0 ? 40 : 66), ay + 10, { size: 16, mono: true, c: C.ink });
        c.restore();
      }
      // respuesta
      const ka = seg(lt, ans[0], ans[1]);
      if (ka > 0) {
        T(c, typed(isG ? A2 : A1, ka), x + 116, y + 290, { size: 22, c: C.ink });
        if (!isG) {
          const k2 = seg(lt, T5.bars1[0], T5.bars1[1]);
          if (k2 > 0) {
            const bx = x + 116, bw = 760;
            let cx = bx;
            c.save(); rr(c, bx, y + 318, bw, 14, 7); c.clip();
            D.cats.forEach((ct, i) => { const ww = (bw - 14) * (ct[1] / D.expense) * E.expo(seg(k2, i * 0.04, 0.6 + i * 0.04)); c.fillStyle = CAT[ct[0]]; c.fillRect(cx, y + 318, ww, 14); cx += ww + 2; });
            c.restore();
            D.cats.slice(0, 3).forEach((ct, i) => {
              const kk = E.out(seg(k2, 0.2 + i * 0.15, 0.6 + i * 0.15));
              if (kk <= 0) return;
              const ry = y + 376 + i * 46;
              c.save(); c.globalAlpha *= kk;
              box(c, bx, ry - 22, 28, 28, 8, CAT[ct[0]]);
              T(c, ct[0][0], bx + 14, ry - 2, { size: 14, w: 700, c: '#1d1a17', align: 'center' });
              T(c, ct[0], bx + 44, ry, { size: 20 });
              T(c, pen(ct[1]), bx + 420, ry, { size: 20, mono: true, w: 500, align: 'right' });
              T(c, Math.round((ct[1] / D.expense) * 100) + ' %', bx + 500, ry, { size: 18, mono: true, c: C.muted, align: 'right' });
              c.restore();
            });
          }
        } else {
          const k2 = E.spring(seg(lt, ans[1], ans[1] + 0.6));
          if (k2 > 0) {
            c.save(); c.globalAlpha *= clamp(k2);
            box(c, x + 116, y + 322, 520, 64, 14, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.09)');
            box(c, x + 134, y + 336, 36, 36, 10, C.teal);
            T(c, 'T', x + 152, y + 360, { size: 15, w: 700, c: '#1d1a17', align: 'center' });
            T(c, 'Taxi', x + 186, y + 352, { size: 17, w: 600 });
            T(c, 'Transporte · hoy', x + 186, y + 374, { size: 14, c: C.muted });
            T(c, '− S/ 18.00', x + 616, y + 362, { size: 18, mono: true, w: 500, align: 'right' });
            c.restore();
          }
        }
      }
      // caja de texto
      const typing = seg(lt, tt[0], tt[1]), sent = lt >= ts;
      box(c, x + 60, y + h - 92, w - 120, 64, 20, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.10)');
      if (!sent && typing > 0) {
        const s = typed(Q, typing);
        const ww = T(c, s, x + 88, y + h - 52, { size: 20 });
        if (Math.floor(lt * 2.5) % 2 === 0) c.fillRect(x + 90 + ww, y + h - 72, 2, 26);
      } else T(c, isG ? 'Pregúntale a ChatGPT' : 'Pregúntale a Claude', x + 88, y + h - 52, { size: 20, c: C.muted });
      box(c, x + w - 112, y + h - 82, 44, 44, 13, sent || typing > 0.95 ? (isG ? '#ffffff' : C.claude) : 'rgba(255,255,255,0.12)');
      c.save(); c.strokeStyle = isG && (sent || typing > 0.95) ? '#000' : '#fff'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + w - 90, y + h - 48); c.lineTo(x + w - 90, y + h - 70); c.moveTo(x + w - 99, y + h - 62); c.lineTo(x + w - 90, y + h - 71); c.lineTo(x + w - 81, y + h - 62); c.stroke(); c.restore();
    };
    ctx.save(); rr(ctx, x, y + 81, w, h - 81, 22); ctx.clip();
    if (gpt < 1) { ctx.save(); ctx.globalAlpha *= 1 - gpt; ctx.translate(-gpt * 60, 0); convo(ctx, 0); ctx.restore(); }
    if (gpt > 0) { ctx.save(); ctx.globalAlpha *= gpt; ctx.translate((1 - gpt) * 60, 0); convo(ctx, 1); ctx.restore(); }
    ctx.restore();
  }
  function scene5(ctx, lt) {
    background(ctx, { glow: [960, 400, 900, C.claude, 0.08] });
    ctx.save();
    cam(ctx, 960, 540, 1.0 + lt * 0.002);
    const kw = E.out(seg(lt, T5.win[0], T5.win[1]));
    ctx.save(); ctx.globalAlpha *= kw; ctx.translate(0, (1 - kw) * 30); chatWindow(ctx, lt); ctx.restore();
    // ruta MCP
    const kr = E.out(seg(lt, 2.4, 3.4));
    if (kr > 0) {
      ctx.save(); ctx.globalAlpha *= kr;
      const gpt = seg(lt, T5.sw[0], T5.sw[1]);
      // "Tu Google"
      box(ctx, 1010, RY - 82, 720, 164, 26, hexA(C.gGreen, 0.04), hexA(C.gGreen, 0.45), 1.5);
      ctx.save(); ctx.setLineDash([6, 6]); box(ctx, 1010, RY - 82, 720, 164, 26, null, hexA(C.gGreen, 0.0)); ctx.restore();
      box(ctx, 1030, RY - 96, 116, 28, 14, C.bg);
      T(ctx, 'Tu Google', 1088, RY - 76, { size: 16, w: 600, c: C.gGreen, align: 'center' });
      const lit = (i) => Math.max(pulse(lt, T5.go1[0] + i * 0.8, T5.back1[1] - (3 - i) * 0.5, 0.25), pulse(lt, T5.go2[0] + i * 0.6, T5.back2[1] - (3 - i) * 0.4, 0.25));
      line(ctx, 510, RY, 1430, RY, C.lineStrong, 2, [4, 8], -lt * 20);
      node(ctx, RN[0][0], RY, 250, 92, (c, x, y) => (gpt > 0.5 ? drawChatGPT(c, x, y, 16, C.ink) : drawClaude(c, x, y, 20)), gpt > 0.5 ? 'ChatGPT' : 'Claude', 'tu asistente', { lit: lit(0), litColor: C.claude });
      node(ctx, RN[1][0], RY, 300, 92, (c, x, y) => drawMCP(c, x, y, 18), 'Conector MCP', 'mcp.lucaa.lat · enruta', { lit: lit(1) });
      node(ctx, RN[2][0], RY, 290, 92, (c, x, y) => drawAppsScript(c, x, y, 40), 'Apps Script', 'tu identidad', { lit: lit(2), litColor: C.gBlue });
      node(ctx, RN[3][0], RY, 250, 92, (c, x, y) => drawSheetsIcon(c, x, y, 40), 'Tu hoja', 'Movimientos', { lit: lit(3), litColor: C.sheets });
      // paquetes de ida (naranja) y vuelta (verde)
      [[T5.go1, T5.back1], [T5.go2, T5.back2]].forEach(([go, back], j) => {
        const kg = seg(lt, go[0], go[1]), kb = seg(lt, back[0], back[1]);
        const xs = RN.map((r) => r[0]);
        const along = (k, rev) => { const e = E.inOut(k); const pos = rev ? lerp(xs[3], xs[0], e) : lerp(xs[0], xs[3], e); return pos; };
        if (kg > 0 && kg < 1) {
          const px = along(kg, false);
          glow(ctx, px, RY - 62, 40, C.primary2, 0.8);
          box(ctx, px - 92, RY - 80, 184, 34, 17, '#141414', hexA(C.primary2, 0.8), 1.5);
          T(ctx, j ? 'add_expense' : 'category_breakdown', px, RY - 57, { size: 13.5, mono: true, c: C.primary2, align: 'center' });
        }
        if (kb > 0 && kb < 1) {
          const px = along(kb, true);
          glow(ctx, px, RY + 64, 40, C.success, 0.8);
          box(ctx, px - 70, RY + 46, 140, 34, 17, '#141414', hexA(C.success, 0.8), 1.5);
          T(ctx, j ? '{ ok: true }' : '{ resumen }', px, RY + 69, { size: 13.5, mono: true, c: C.success, align: 'center' });
        }
      });
      ctx.restore();
    }
    // mini hoja con la fila nueva
    const kr2 = E.spring(seg(lt, T5.row[0], T5.row[0] + 0.8)), out = seg(lt, T5.row[1] - 0.4, T5.row[1]);
    if (kr2 > 0 && out < 1) {
      ctx.save(); ctx.globalAlpha *= clamp(kr2) * (1 - out);
      const w = 500, x = 1370, y = 400 + (1 - kr2) * 40;
      const rows = [ROWS1[4], ROWS1[5], ROW_TAXI];
      ctx.save(); ctx.shadowColor = hexA(C.sheets, 0.5); ctx.shadowBlur = 50;
      drawSheet(ctx, x, y, w, rows, { row: (r) => (r === 2 ? { fill: seg(lt, T5.row[0] + 0.3, T5.row[0] + 1.1), flash: pulse(lt, T5.row[0] + 0.3, T5.row[1], 0.4) } : {}) });
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 6 · Gratis (122–134) ──
  const T6 = { map: [0, 1.4], dim: [1.2, 1.9], p1: 1.5, s1: 2.0, p2: 2.2, s2: 2.7, zero: 3.2, cols: [6.0, 6.5, 7.0] };
  const MAP6 = [
    [-150, 'iPhone', (c, x, y) => drawYape(c, x, y, 56)], [150, 'Gmail', (c, x, y) => drawGmail(c, x, y, 56)],
    [-90, 'Apps Script', (c, x, y) => drawAppsScript(c, x, y, 56)], [-30, 'lucaa.lat', (c, x, y) => drawLucaMark(c, x, y, 52, 1, { stagger: false })],
    [30, 'Claude', (c, x, y) => drawClaude(c, x, y, 26)], [90, 'ChatGPT', (c, x, y) => drawChatGPT(c, x, y, 22, C.ink)],
  ];
  function scene6(ctx, lt) {
    background(ctx, { glow: [960, 520, 700, C.primary, 0.2 * seg(lt, T6.zero, T6.zero + 1)] });
    const dim = E.inOut(seg(lt, T6.dim[0], T6.dim[1]));
    if (dim < 1) {
      ctx.save(); ctx.globalAlpha *= 1 - dim;
      cam(ctx, 960, 540, 1 + lt * 0.02);
      const k0 = E.out(seg(lt, 0, 0.6));
      MAP6.forEach(([deg, label, icon], i) => {
        const a = (deg * PI) / 180, x = 960 + Math.cos(a) * 520, y = 540 + Math.sin(a) * 330;
        line(ctx, 960, 540, lerp(960, x, k0), lerp(540, y, k0), hexA(C.primary2, 0.4), 2);
        for (let p = 0; p < 3; p++) {
          const kk = ((lt * 0.9 + p / 3 + i * 0.13) % 1);
          const inbound = i < 3, e = inbound ? kk : 1 - kk;
          glow(ctx, lerp(x, 960, e), lerp(y, 540, e), 20, C.primary2, 0.9);
        }
        ctx.save(); ctx.globalAlpha *= k0;
        box(ctx, x - 50, y - 50, 100, 100, 26, C.card, C.lineStrong, 1.5);
        icon(ctx, x, y);
        T(ctx, label, x, y + 82, { size: 18, w: 500, c: C.body, align: 'center' });
        ctx.restore();
      });
      glow(ctx, 960, 540, 200, C.sheets, 0.6);
      box(ctx, 900, 480, 120, 120, 30, C.card, C.sheets, 2);
      drawSheetsIcon(ctx, 960, 540, 64);
      ctx.restore();
    }
    // precios
    ctx.save();
    cam(ctx, 960, 540, 1 + lt * 0.006);
    [[T6.p1, T6.s1, 'S/ 29.90', '/mes'], [T6.p2, T6.s2, 'S/ 9.90', '/mes']].forEach(([tp, ts, p, u], i) => {
      const k = E.expo(seg(lt, tp, tp + 0.4)), out = seg(lt, ts + 0.15, ts + 0.45);
      if (k <= 0 || out >= 1) return;
      ctx.save(); ctx.globalAlpha *= k * (1 - out);
      const ww = T(ctx, p, 960, 520, { size: 130, w: 600, align: 'center', c: C.body });
      T(ctx, u, 960 + ww / 2 + 10, 520, { size: 40, c: C.muted });
      strike(ctx, 960 - ww / 2 - 20, 440, ww + 40, 100, seg(lt, ts, ts + 0.25), C.primary, 7);
      ctx.restore();
    });
    const kz = seg(lt, T6.zero, T6.zero + 0.9);
    if (kz > 0) {
      const s = 0.85 + 0.15 * E.spring(kz) + 0.012 * Math.sin((lt - T6.zero) * 2.2) * seg(lt, T6.zero + 1, T6.zero + 2);
      ctx.save(); ctx.translate(960, 470); ctx.scale(s, s);
      glow(ctx, 0, -60, 420, C.primary, 0.6 * clamp(kz * 1.5));
      T(ctx, 'S/ 0', 0, 0, { size: 260, w: 600, align: 'center', a: clamp(kz * 2), c: C.ink });
      ctx.restore();
    }
    const cols = [['Sin tarjeta', 'ni suscripción'], ['Sin configurar nubes', 'solo tu cuenta de Google'], ['Código abierto', 'licencia MIT']];
    cols.forEach((c, i) => {
      const k = E.expo(seg(lt, T6.cols[i], T6.cols[i] + 0.6));
      if (k <= 0) return;
      const x = 960 + (i - 1) * 470, y = 690 + (1 - k) * 24;
      ctx.save(); ctx.globalAlpha *= k;
      box(ctx, x - 200, y, 400, 140, 22, C.card, C.line);
      check(ctx, x - 150, y + 52, 30, C.success, seg(lt, T6.cols[i] + 0.2, T6.cols[i] + 0.6));
      T(ctx, c[0], x - 116, y + 62, { size: 26, w: 600 });
      T(ctx, c[1], x - 116, y + 96, { size: 18, c: C.muted });
      ctx.restore();
    });
    ctx.restore();
  }

  // ── 7 · Cierre (134–142) ──
  const ORBIT = [
    ['yape', '+ S/ 45.00', 'María T.'], ['bcp', '− S/ 38.90', 'Rappi'], ['gmail', '− S/ 126.40', 'Wong'],
    ['yape', '+ S/ 20.00', 'Ana P.'], ['bcp', '− S/ 14.50', 'Uber'], ['gmail', '− S/ 44.90', 'Netflix'],
  ];
  function scene7(ctx, lt) {
    background(ctx, { glow: [960, 430, 760, C.primary, 0.22] });
    ctx.save();
    cam(ctx, 960, 540, 1.04 - lt * 0.004);
    // filas ordenadas que orbitan
    ORBIT.forEach((o, i) => {
      const a = (i / ORBIT.length) * TAU + lt * 0.16, k = E.out(seg(lt, 0.4 + i * 0.1, 1.4 + i * 0.1));
      if (k <= 0) return;
      const x = 960 + Math.cos(a) * 820, y = 470 + Math.sin(a) * 420, depth = 0.55 + 0.45 * (Math.sin(a) * 0.5 + 0.5);
      ctx.save(); ctx.globalAlpha *= k * 0.5 * depth; ctx.translate(x, y); ctx.scale(depth, depth);
      box(ctx, -140, -30, 280, 60, 16, C.card, C.line);
      APP_ICON[o[0]](ctx, -108, 0, 36);
      T(ctx, o[2], -80, 6, { size: 17, w: 600 });
      T(ctx, o[1], 124, 6, { size: 16, mono: true, align: 'right', c: o[1][0] === '+' ? C.success : C.ink });
      ctx.restore();
    });
    drawLucaMark(ctx, 960, 380, 260, seg(lt, 0.2, 1.6));
    drawWordmark(ctx, 960, 620, 70, seg(lt, 0.8, 2.0));
    const ku = seg(lt, 1.4, 2.4);
    if (ku > 0) T(ctx, typed('lucaa.lat', ku), 960, 700, { size: 30, mono: true, c: C.primary2, align: 'center' });
    words(ctx, 'Tus finanzas. Tu Google.', 960, 790, { size: 44, w: 500, c: C.ink, align: 'center', hl: [null, null, C.primary2, C.primary2] }, 1.9, lt, 0.12);
    ctx.restore();
  }

  // ───────────────────────────── narración y subtítulos ─────────────────────────────
  // Copia de narracion.json (fuente del guion); tools/narrate.mjs verifica que coincidan.
  const NARRATION = [
    ['a0', 2.2, 'Esto es Luca.'],
    ['p1', 9.0, 'Tu dinero se mueve todos los días.'],
    ['p2', 12.6, 'Un yapeo aquí. Un consumo con tarjeta allá.'],
    ['p3', 16.8, 'Y toda esa información… muere en tu bandeja de entrada.'],
    ['v1', 23.0, 'Llega un yapeo a tu iPhone.'],
    ['v2', 26.4, 'Un atajo lo envía directo a tu propio Google. Sin pasar por nuestros servidores.'],
    ['v3', 33.4, 'Tu Apps Script lo interpreta, descarta duplicados y lo categoriza.'],
    ['v4', 39.4, 'Lo mismo con cada correo del BCP que llega a tu Gmail.'],
    ['v5', 44.6, 'Todo termina en una hoja de cálculo. La tuya.'],
    ['s1', 51.0, 'Aquí está la idea central.'],
    ['s2', 53.8, 'Luca no tiene base de datos. Ni servidores que guarden tu información.'],
    ['s3', 60.0, 'Tu hoja de cálculo es la base de datos. Tu cuenta de Google es el backend.'],
    ['w1', 69.0, 'Y la web… es solo una ventana.'],
    ['w2', 72.6, 'Lee tu hoja desde tu navegador y la convierte en un panel claro.'],
    ['w3', 78.4, 'Cuánto gastaste. En qué se fue. Cómo vas frente a los últimos seis meses.'],
    ['w4', 85.6, 'Si cambias una categoría en la web, cambia en tu hoja. Al instante.'],
    ['w5', 92.6, 'Detrás del vidrio, no hay nada nuestro.'],
    ['i1', 99.0, 'Y si prefieres conversar, conecta Luca a Claude o a ChatGPT.'],
    ['i2', 104.0, 'Con un conector MCP, tu asistente consulta tu hoja… y responde con tus números.'],
    ['i3', 112.6, 'También puede registrar un gasto por ti.'],
    ['i4', 117.6, 'Tus datos nunca salen de tu Google.'],
    ['g1', 122.8, '¿Cuánto cuesta?'],
    ['g2', 125.4, 'Nada.'],
    ['g3', 127.4, 'Sin servidores, no hay nada que cobrarte.'],
    ['g4', 131.0, 'Gratis. Y de código abierto.'],
    ['c1', 135.6, 'Luca. Tus finanzas. Tu Google.'],
  ];
  // Fin de cada subtítulo: estimado por longitud (≈15 caracteres/s), sin pisar la línea siguiente.
  // tools/narrate.mjs escribe audio/narr/manifest.json con las duraciones reales; si existe captions.js lo usa.
  const CAPTIONS = NARRATION.map(([id, start, text], i) => {
    const next = NARRATION[i + 1];
    const est = start + 0.6 + text.length / 15;
    return { id, start, end: Math.min(next ? next[1] - 0.15 : DURATION - 1, est), text };
  });
  function setCaptionTimes(list) { // [{id, end}] desde el manifiesto de narración
    for (const c of CAPTIONS) { const m = list.find((l) => l.id === c.id); if (m) c.end = Math.max(c.end, m.end + 0.35); }
    CAPTIONS.forEach((c, i) => { const n = CAPTIONS[i + 1]; if (n) c.end = Math.min(c.end, n.start - 0.1); });
  }
  function captionAt(t) {
    for (const c of CAPTIONS) if (t >= c.start && t < c.end) return c.text;
    return '';
  }
  function drawCaption(ctx, t) {
    if (!G.captions) return;
    let cur = null;
    for (const c of CAPTIONS) if (t >= c.start - 0.05 && t < c.end) { cur = c; break; }
    if (!cur) return;
    const a = clamp(Math.min((t - cur.start + 0.05) / 0.25, (cur.end - t) / 0.25));
    if (a <= 0) return;
    const size = 30, ww = tw(ctx, cur.text, { size, w: 500 });
    ctx.save(); ctx.globalAlpha = a;
    box(ctx, W / 2 - ww / 2 - 26, H - 92, ww + 52, 56, 14, 'rgba(0,0,0,0.62)');
    T(ctx, cur.text, W / 2, H - 53, { size, w: 500, c: '#f4efe8', align: 'center' });
    ctx.restore();
  }

  // ───────────────────────────── escenas y tiempos ─────────────────────────────
  const SCENE_DEFS = [
    { id: 'apertura', title: 'Apertura', start: 0, end: 8, draw: scene0 },
    { id: 'problema', title: 'El problema', start: 8, end: 22, draw: scene1 },
    { id: 'viaje', title: 'El viaje de un yapeo', start: 22, end: 50, draw: scene2 },
    { id: 'hoja', title: 'La hoja es el centro', start: 50, end: 68, draw: scene3 },
    { id: 'web', title: 'La web, una ventana', start: 68, end: 98, draw: scene4 },
    { id: 'ia', title: 'Pregúntale a tu IA', start: 98, end: 122, draw: scene5 },
    { id: 'gratis', title: 'Gratis', start: 122, end: 134, draw: scene6 },
    { id: 'cierre', title: 'Cierre', start: 134, end: 142, draw: scene7 },
  ];
  const SCENES = SCENE_DEFS.map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end }));
  const S = Object.fromEntries(SCENES.map((s) => [s.id, s.start]));
  // Golpes para la banda sonora (tools/audio.mjs), en segundos absolutos, de las mismas constantes que usa draw()
  const TIMING = {
    lineIn: 0.3, logo: 1.9, wordmark: 3.0,
    notifs: Array.from({ length: S1N }, (_, i) => S.problema + S1T(i)), floats: S1_FLOAT.map((f) => S.problema + f.t),
    freeze: S.problema + S1_FREEZE, counter: S.problema + 10.2, zeroReg: S.problema + 11.8,
    heroNotif: S.viaje + T2.notif, shortcut: S.viaje + T2.shortcut, morph: S.viaje + T2.morph,
    travel: S.viaje + T2.travel[0], arrive: S.viaje + T2.travel[1], serverStrike: S.viaje + 7.0,
    stages: [...T2.stages, ...T2.stages2].map((x) => S.viaje + x), chips: [S.viaje + T2.chip, S.viaje + T2.stages2[2] + 0.4],
    gmail: S.viaje + T2.gmail, travel2: S.viaje + T2.travel2[0], rows: [S.viaje + T2.out1[1], S.viaje + T2.out2[1]],
    strikes3: [S.hoja + T3.dbStrike, S.hoja + T3.srvStrike], bursts3: [S.hoja + T3.dbBurst[0], S.hoja + T3.srvBurst[0]],
    absorb3: [S.hoja + T3.dbBurst[1], S.hoja + T3.srvBurst[1]], rows3: T3.rows.map((x) => S.hoja + x), branch3: S.hoja + T3.branch[0],
    rise4: [0, 1, 2, 3, 4, 5, 6].map((i) => S.web + T4.rise0 + i * 0.32), click4: S.web + T4.click, glass4: S.web + T4.glass[0],
    focus4: T4.focus.map((f) => S.web + f[0]),
    send5: [S.ia + T5.send1, S.ia + T5.send2], go5: [S.ia + T5.go1[0], S.ia + T5.go2[0]], back5: [S.ia + T5.back1[0], S.ia + T5.back2[0]],
    done5: [S.ia + T5.back1[1], S.ia + T5.back2[1]], switch5: S.ia + T5.sw[0], row5: S.ia + T5.row[0],
    typing5: [[S.ia + T5.type1[0], S.ia + T5.type1[1], Q1.length], [S.ia + T5.type2[0], S.ia + T5.type2[1], Q2.length]],
    strikes6: [S.gratis + T6.s1, S.gratis + T6.s2], prices6: [S.gratis + T6.p1, S.gratis + T6.p2], zero6: S.gratis + T6.zero,
    cols6: T6.cols.map((x) => S.gratis + x), logo7: S.cierre + 0.2, end: DURATION,
  };

  // ───────────────────────────── API ─────────────────────────────
  function init(opts = {}) {
    G.makeCanvas = opts.makeCanvas || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
    // acabado: grano fino + viñeta
    const f = G.makeCanvas(W, H), c = f.getContext('2d');
    const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    const gw = 960, gh = 540, g = G.makeCanvas(gw, gh), gc = g.getContext('2d'), img = gc.createImageData(gw, gh);
    for (let i = 0; i < gw * gh; i++) { const n = hash(i, 4242) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n; img.data[i * 4 + 3] = 255; }
    gc.putImageData(img, 0, 0);
    G.tex.grain = g; G.tex.finish = f;
    G.ready = true;
  }
  function drawScene(ctx, i, t) {
    const sc = SCENE_DEFS[i];
    ctx.save(); sc.draw(ctx, t - sc.start, t); ctx.restore();
  }
  function draw(ctx, t) {
    if (!G.ready) init();
    t = clamp(t, 0, DURATION);
    G.t = t; G.depth = 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let idx = SCENE_DEFS.length - 1;
    for (let i = 0; i < SCENE_DEFS.length; i++) if (t < SCENE_DEFS[i].end) { idx = i; break; }
    const cur = SCENE_DEFS[idx];
    let other = -1, k = 0;
    if (idx < SCENE_DEFS.length - 1 && t > cur.end - XF / 2) { other = idx + 1; k = (t - (cur.end - XF / 2)) / XF; }
    else if (idx > 0 && t < cur.start + XF / 2) { other = idx - 1; k = 1 - (t - (cur.start - XF / 2)) / XF; }
    if (other < 0) drawScene(ctx, idx, t);
    else {
      const a = Math.min(idx, other), b = Math.max(idx, other);
      drawScene(ctx, a, t);
      const buf = buffer(0);
      buf.ctx.setTransform(1, 0, 0, 1, 0, 0); buf.ctx.globalAlpha = 1; buf.ctx.globalCompositeOperation = 'source-over';
      buf.ctx.fillStyle = '#000'; buf.ctx.fillRect(0, 0, W, H);
      drawScene(buf.ctx, b, t);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = smooth(clamp(k)); ctx.drawImage(buf.cv, 0, 0); ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(G.tex.finish, 0, 0);
    if (!G.lite) {
      ctx.save(); ctx.globalAlpha = 0.03; ctx.globalCompositeOperation = 'soft-light';
      const ox = Math.floor(hash(Math.floor(t * FPS), 1) * 4) * 60;
      ctx.drawImage(G.tex.grain, -ox, 0, W + 240, H + 135);
      ctx.restore();
    }
    drawCaption(ctx, t);
    const fi = 1 - seg(t, 0, 0.5), fo = seg(t, DURATION - 1.6, DURATION - 0.1);
    const fade = Math.max(fi, fo);
    if (fade > 0) { ctx.globalAlpha = E.sine(fade); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  // Hoja de piezas (logos, componentes) para revisión
  function debugDraw(ctx, name) {
    if (!G.ready) init();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    background(ctx, {});
    if (name === 'logos') {
      const L = [[drawYape, 'Yape'], [drawBCP, 'BCP'], [(c, x, y, s) => drawGmail(c, x, y, s), 'Gmail'], [drawSheetsIcon, 'Sheets'], [(c, x, y, s) => drawAppsScript(c, x, y, s), 'Apps Script'], [(c, x, y, s) => drawClaude(c, x, y, s / 2), 'Claude'], [(c, x, y, s) => drawChatGPT(c, x, y, s / 2.4, C.ink), 'ChatGPT'], [(c, x, y, s) => drawMCP(c, x, y, s / 2.6), 'MCP'], [drawShortcuts, 'Atajos']];
      L.forEach(([fn, l], i) => { const x = 160 + (i % 5) * 340, y = 200 + Math.floor(i / 5) * 260; fn(ctx, x, y, 120); T(ctx, l, x, y + 110, { size: 22, align: 'center', c: C.body }); });
      drawLucaMark(ctx, 1500, 760, 260); drawWordmark(ctx, 1500, 1000, 60);
      drawNotif(ctx, 100, 760, 372, HERO); drawPacket(ctx, 860, 860, 1, JSON_YAPE);
    } else if (name === 'dashboard') {
      ctx.translate(40, 40);
      drawDashboard(ctx, { rise: [1, 1, 1, 1, 1, 1, 1], count: 1, bar: 1, cats: 1, six: 1, merch: 1, moves: 1, hl: {}, pending: {}, moveHl: 1, recat: 0 });
    } else if (name === 'sheet') {
      drawSheet(ctx, 100, 100, 560, ROWS1, {}); drawSheet(ctx, 800, 100, 900, [...ROWS1, ROW_TAXI], {});
      drawPhone(ctx, 400, 700, 0.5, null);
    }
    ctx.restore();
  }
  function setQuality(q) { G.lite = q < 1; }
  function setCaptions(on) { G.captions = !!on; }
  // Piezas sueltas para otras piezas de video (tools/yape-edit.mjs)
  const art = { C, E, T, tw, rr, box, shadowBox, glow, hexA, clamp, seg, lerp, pulse, hash, drawLucaMark, drawWordmark, drawYape, drawShortcuts, drawSheetsIcon };
  return { W, H, FPS, DURATION, SCENES, CAPTIONS, NARRATION, TIMING, captionAt, setCaptionTimes, init, draw, setQuality, setCaptions, debugDraw, art };
});
