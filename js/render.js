/* Lumen Deep — procedural deep-sea scene renderer (canvas 2D). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const C = window.Core;

  // ------------------------------------------------------------- helpers
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgba = (rgb, a) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  const rand = (a, b) => a + Math.random() * (b - a);

  const ZONE_PAL = [
    { top: '#2a8fb5', bot: '#0b3a5c', ray: 0.32, snow: 0.18 },
    { top: '#155a80', bot: '#06213f', ray: 0.14, snow: 0.3 },
    { top: '#0b2147', bot: '#030a1f', ray: 0.03, snow: 0.42 },
    { top: '#080d2c', bot: '#01030d', ray: 0, snow: 0.5 },
    { top: '#14071f', bot: '#040007', ray: 0, snow: 0.45 },
    { top: '#100326', bot: '#020009', ray: 0, snow: 0.4 },
  ].map(z => ({ ...z, topC: hexRgb(z.top), botC: hexRgb(z.bot) }));

  const glowCache = {};
  function glowSprite(color) {
    let c = glowCache[color];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rgb = hexRgb(color);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba([255, 255, 255], 1));
    gr.addColorStop(0.12, rgba(rgb, 0.9));
    gr.addColorStop(0.35, rgba(rgb, 0.35));
    gr.addColorStop(0.7, rgba(rgb, 0.08));
    gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    glowCache[color] = c;
    return c;
  }
  function glow(ctx, color, x, y, r, a) {
    if (a <= 0.003 || r <= 0) return;
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a * pa);
    ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa;
  }

  // ------------------------------------------------------------- creature drawing
  // Each draws centred on (0,0), facing +x, at scale s (≈ body radius in px). `lit` = 'lighter' pass.
  const DRAW = [];

  DRAW[0] = function plankton(ctx, s, t, ph, lit) { // glimmer plankton
    const tw = 0.55 + 0.45 * Math.sin(t * 3 + ph * 9);
    if (lit) { glow(ctx, '#7ff9ff', 0, 0, s * 5, 0.85 * tw); return; }
    ctx.fillStyle = `rgba(210,255,255,${0.6 + 0.4 * tw})`;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, TAU); ctx.fill();
  };

  DRAW[1] = function comb(ctx, s, t, ph, lit) { // comb jelly
    const rx = s * 0.62, ry = s;
    if (!lit) {
      ctx.fillStyle = 'rgba(190,200,255,0.10)';
      ctx.strokeStyle = 'rgba(210,225,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // trailing tentacles
      ctx.strokeStyle = 'rgba(200,180,255,0.25)';
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(side * rx * 0.3, ry * 0.2);
        for (let k = 1; k <= 8; k++) ctx.lineTo(side * (rx * 0.3 + Math.sin(t * 2 + k * 0.8 + ph) * 3), ry * 0.2 + k * s * 0.22);
      }
      ctx.stroke();
      return;
    }
    // shimmering comb rows (rainbow)
    for (let k = 0; k < 8; k++) {
      const u = (k + 0.5) / 8 * 2 - 1;
      for (let j = 0; j < 7; j++) {
        const v = (j / 6) * 1.6 - 0.8;
        const x = u * rx * Math.sqrt(Math.max(0, 1 - v * v)) * 0.95, y = v * ry;
        const hue = (t * 160 + j * 45 + k * 25 + ph * 300) % 360;
        ctx.fillStyle = `hsla(${hue},100%,70%,0.85)`;
        ctx.fillRect(x - 1, y - 1, 2.2, 2.2);
      }
    }
    glow(ctx, '#c49cff', 0, 0, s * 2.4, 0.25);
  };

  DRAW[2] = function shrimp(ctx, s, t, ph, lit) { // lantern shrimp
    const seg = 7;
    const pts = [];
    for (let k = 0; k < seg; k++) {
      const a = -0.3 + k * 0.32 + Math.sin(t * 6 + ph) * 0.05 * k;
      pts.push([Math.cos(a) * s * 0.9 - k * s * 0.18, Math.sin(a) * s * 0.55 + k * s * 0.05, s * (0.42 - k * 0.04)]);
    }
    if (!lit) {
      ctx.strokeStyle = 'rgba(255,140,120,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); // antennae
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.quadraticCurveTo(s * 2, -s * 0.8, -s * 1.5, -s * 1.2 + Math.sin(t * 2 + ph) * 3);
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.quadraticCurveTo(s * 2.2, -s * 0.2, -s * 1.8, -s * 0.4 + Math.sin(t * 2.3 + ph) * 3);
      ctx.stroke();
      ctx.fillStyle = '#b8413a';
      for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], p[2], 0, TAU); ctx.fill(); }
      const tl = pts[seg - 1];
      ctx.beginPath(); ctx.moveTo(tl[0], tl[1]); ctx.lineTo(tl[0] - s * 0.6, tl[1] - s * 0.35); ctx.lineTo(tl[0] - s * 0.6, tl[1] + s * 0.4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,150,0.5)'; // legs
      ctx.beginPath();
      for (let k = 1; k < 5; k++) { const p = pts[k]; ctx.moveTo(p[0], p[1] + p[2]); ctx.lineTo(p[0] + Math.sin(t * 14 + k) * 2, p[1] + p[2] + s * 0.4); }
      ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(pts[0][0] + s * 0.18, pts[0][1] - s * 0.12, s * 0.12, 0, TAU); ctx.fill();
      return;
    }
    for (let k = 0; k < seg; k += 2) glow(ctx, '#5cf2b0', pts[k][0], pts[k][1] + pts[k][2] * 0.6, s * 0.9, 0.7);
    const ink = Math.pow(Math.max(0, Math.sin(t * 0.7 + ph * 6)), 40);
    if (ink > 0.02) glow(ctx, '#5cf2b0', -s * 2, s * 0.2, s * 3.5 * (1 + ink), ink * 0.6);
  };

  DRAW[3] = function moon(ctx, s, t, ph, lit, gold) { // moon jelly (also the golden event jelly)
    const p = Math.sin(t * 2.2 + ph * 7);
    const rx = s * (1 + 0.12 * p), ry = s * 0.72 * (1 - 0.12 * p);
    const col = gold ? [255, 220, 140] : [170, 215, 255];
    if (!lit) {
      ctx.strokeStyle = rgba(col, 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath(); // tentacles
      for (let k = 0; k < 12; k++) {
        const x0 = (k / 11 * 2 - 1) * rx * 0.95;
        ctx.moveTo(x0, 0);
        for (let j = 1; j <= 6; j++) ctx.lineTo(x0 + Math.sin(t * 2 + j * 0.9 + k) * 2.5, j * s * 0.32);
      }
      ctx.stroke();
      ctx.strokeStyle = rgba(col, 0.4); // oral arms
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const x0 = (k - 1.5) * rx * 0.18;
        ctx.moveTo(x0, 0);
        for (let j = 1; j <= 5; j++) ctx.lineTo(x0 + Math.sin(t * 1.5 + j * 0.7 + k * 2) * 4, j * s * 0.38);
      }
      ctx.stroke();
      const gr = ctx.createRadialGradient(0, -ry * 0.3, 1, 0, 0, rx);
      gr.addColorStop(0, rgba(col, 0.35)); gr.addColorStop(1, rgba(col, 0.08));
      ctx.fillStyle = gr;
      ctx.strokeStyle = rgba(col, 0.55);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = gold ? 'rgba(255,240,200,0.8)' : 'rgba(225,190,255,0.7)'; // four gonad rings
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI - Math.PI * 0.88;
        ctx.beginPath(); ctx.arc(Math.cos(a + 0.4) * rx * 0.33, -ry * 0.4 + Math.sin(a) * ry * 0.06, s * 0.13, 0, TAU); ctx.stroke();
      }
      return;
    }
    glow(ctx, gold ? '#ffe08a' : '#9fd8ff', 0, -ry * 0.3, s * (gold ? 3.6 : 2.4), gold ? 0.75 : 0.3 + 0.12 * p);
    if (gold) {
      for (let k = 0; k < 6; k++) {
        const a = t * 1.3 + k * TAU / 6;
        glow(ctx, '#fff2c0', Math.cos(a) * s * 1.6, Math.sin(a) * s * 1.1, s * 0.45, 0.7 + 0.3 * Math.sin(t * 5 + k));
      }
    }
  };

  DRAW[4] = function angler(ctx, s, t, ph, lit) { // anglerfish
    const lureX = s * 1.75 + Math.sin(t * 1.3 + ph) * s * 0.15, lureY = -s * 1.15 + Math.cos(t * 1.7 + ph) * s * 0.12;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 + ph * 5);
    if (!lit) {
      ctx.fillStyle = '#1a2033';
      ctx.strokeStyle = 'rgba(120,140,200,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); // body
      ctx.moveTo(s * 1.0, -s * 0.15);
      ctx.bezierCurveTo(s * 0.8, -s * 1.05, -s * 0.8, -s * 0.95, -s * 1.15, -s * 0.15);
      ctx.lineTo(-s * 1.75, -s * 0.6 + Math.sin(t * 4 + ph) * s * 0.1);
      ctx.lineTo(-s * 1.7, s * 0.55 + Math.sin(t * 4 + ph) * s * 0.1);
      ctx.lineTo(-s * 1.1, s * 0.15);
      ctx.bezierCurveTo(-s * 0.6, s * 0.95, s * 0.7, s * 1.0, s * 1.15, s * 0.45);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0a0d16'; // mouth
      ctx.beginPath(); ctx.moveTo(s * 1.0, -s * 0.15); ctx.lineTo(s * 0.35, s * 0.1); ctx.lineTo(s * 1.15, s * 0.45); ctx.fill();
      ctx.fillStyle = '#dfe6ff'; // teeth
      for (let k = 0; k < 4; k++) {
        const x = s * (0.55 + k * 0.14);
        ctx.beginPath(); ctx.moveTo(x, -s * 0.08 + k * s * 0.02); ctx.lineTo(x + s * 0.05, s * 0.12); ctx.lineTo(x + s * 0.1, -s * 0.06 + k * s * 0.02); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, s * 0.32 + k * 0.01); ctx.lineTo(x + s * 0.05, s * 0.12); ctx.lineTo(x + s * 0.1, s * 0.34); ctx.fill();
      }
      ctx.fillStyle = '#9fb3ff'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.45, s * 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(160,170,210,0.7)'; ctx.lineWidth = 1.3; // illicium
      ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.85); ctx.quadraticCurveTo(s * 1.0, -s * 1.9, lureX, lureY); ctx.stroke();
      return;
    }
    glow(ctx, '#ffd36b', lureX, lureY, s * 2.2 * pulse, 0.95);
    glow(ctx, '#ffd36b', lureX, lureY, s * 0.5, 1);
    glow(ctx, '#6f86ff', s * 0.45, -s * 0.45, s * 0.4, 0.5);
  };

  DRAW[5] = function siphon(ctx, s, t, ph, lit) { // siphonophore
    const n = 13, gap = s * 0.75;
    if (!lit) {
      ctx.strokeStyle = 'rgba(255,170,230,0.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const x = -k * gap, y = Math.sin(t * 1.4 + ph - k * 0.45) * s * 0.6 * (k / n);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath(); // dangling tentacles
      for (let k = 2; k < n; k += 2) {
        const x = -k * gap, y = Math.sin(t * 1.4 + ph - k * 0.45) * s * 0.6 * (k / n);
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.sin(t + k) * 4, y + s * 1.2, x - 3 + Math.sin(t * 1.3 + k) * 6, y + s * 2.4);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,240,0.25)'; ctx.strokeStyle = 'rgba(255,200,240,0.5)';
      ctx.beginPath(); ctx.ellipse(s * 0.3, 0, s * 0.55, s * 0.35, 0, 0, TAU); ctx.fill(); ctx.stroke();
      return;
    }
    for (let k = 1; k < n; k++) {
      const x = -k * gap, y = Math.sin(t * 1.4 + ph - k * 0.45) * s * 0.6 * (k / n);
      const b = 0.5 + 0.5 * Math.sin(t * 4 - k * 0.7 + ph);
      glow(ctx, k % 2 ? '#ff7ad9' : '#a98bff', x, y, s * (0.55 + 0.3 * b), 0.55 + 0.4 * b);
    }
    glow(ctx, '#ffc4ee', s * 0.3, 0, s * 1.2, 0.4);
  };

  DRAW[6] = function squid(ctx, s, t, ph, lit) { // vampire squid
    const flare = 0.5 + 0.5 * Math.sin(t * 1.6 + ph * 4);
    if (!lit) {
      ctx.fillStyle = 'rgba(120,20,40,0.85)';
      ctx.beginPath(); // webbed cloak behind
      ctx.moveTo(-s * 0.3, -s * 0.4);
      for (let k = 0; k <= 8; k++) {
        const a = -0.9 + k / 8 * 1.8;
        const r = s * (1.3 + 0.5 * flare) * (k % 2 ? 0.85 : 1);
        ctx.lineTo(-s * 0.3 - Math.cos(a) * r, Math.sin(a) * r * (0.7 + 0.5 * flare));
      }
      ctx.lineTo(-s * 0.3, s * 0.4); ctx.closePath(); ctx.fill();
      const gr = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
      gr.addColorStop(0, '#c2304a'); gr.addColorStop(1, '#5a0a1c');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(s * 0.4, 0, s * 0.85, s * 0.48, 0, 0, TAU); ctx.fill(); // mantle
      ctx.fillStyle = '#a3263d'; // ear-like fins
      const f = Math.sin(t * 5 + ph) * 0.3;
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(s * 0.95, sd * s * 0.45, s * 0.3, s * 0.12, sd * (0.7 + f), 0, TAU); ctx.fill();
      }
      return;
    }
    glow(ctx, '#5fb7ff', -s * 0.1, -s * 0.12, s * 0.5, 0.95); // eye
    for (let k = 0; k <= 8; k += 2) {
      const a = -0.9 + k / 8 * 1.8, r = s * (1.3 + 0.5 * flare);
      glow(ctx, '#bfe4ff', -s * 0.3 - Math.cos(a) * r, Math.sin(a) * r * (0.7 + 0.5 * flare), s * 0.35, 0.55 * flare + 0.2);
    }
    glow(ctx, '#ff5468', s * 0.4, 0, s * 2.2, 0.12);
  };

  function spine(n, len, amp, t, ph, freq) {
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      pts.push([-u * len, Math.sin(t * freq + ph - u * 6) * amp * (0.2 + u)]);
    }
    return pts;
  }
  function body(ctx, pts, widthFn) {
    const n = pts.length - 1, top = [], bot = [];
    for (let k = 0; k <= n; k++) {
      const p = pts[k], q = pts[Math.min(n, k + 1)], o = pts[Math.max(0, k - 1)];
      let dx = q[0] - o[0], dy = q[1] - o[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = widthFn(k / n);
      top.push([p[0] - dy * w, p[1] + dx * w]); bot.push([p[0] + dy * w, p[1] - dx * w]);
    }
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(bot[k][0], bot[k][1]);
    ctx.closePath();
  }

  DRAW[7] = function leviathan(ctx, s, t, ph, lit) { // hadal leviathan (huge, background)
    const len = s * 9, pts = spine(28, len, s * 0.5, t, ph, 0.7);
    if (!lit) {
      ctx.fillStyle = 'rgba(8,16,40,0.92)';
      ctx.strokeStyle = 'rgba(80,130,255,0.18)';
      body(ctx, pts, u => s * (u < 0.12 ? 0.4 + u * 6 : 1.12 * Math.pow(1 - (u - 0.12) / 0.88, 0.7)) + 1);
      ctx.fill(); ctx.stroke();
      const tl = pts[pts.length - 1];
      ctx.beginPath(); ctx.moveTo(tl[0] + s * 0.3, tl[1]); ctx.lineTo(tl[0] - s * 0.9, tl[1] - s * 0.9); ctx.lineTo(tl[0] - s * 0.6, tl[1]); ctx.lineTo(tl[0] - s * 0.9, tl[1] + s * 0.9); ctx.closePath(); ctx.fill();
      return;
    }
    for (let k = 2; k < pts.length - 2; k++) {
      const b = 0.5 + 0.5 * Math.sin(t * 2 - k * 0.5 + ph);
      glow(ctx, '#62a8ff', pts[k][0], pts[k][1] - s * 0.25, s * 0.28, 0.35 + 0.5 * b);
      glow(ctx, '#62a8ff', pts[k][0], pts[k][1] + s * 0.3, s * 0.2, 0.25 + 0.4 * (1 - b));
    }
    glow(ctx, '#dcefff', -s * 0.25, -s * 0.2, s * 0.5, 0.9);
  };

  DRAW[10] = function wyrm(ctx, s, t, ph, lit) { // tidewyrm
    const len = s * 8, pts = spine(36, len, s * 1.1, t, ph, 2.2);
    if (!lit) {
      ctx.fillStyle = 'rgba(10,60,60,0.9)';
      ctx.strokeStyle = 'rgba(77,255,210,0.35)';
      body(ctx, pts, u => s * 0.55 * (u < 0.06 ? 0.7 + u * 5 : Math.pow(1 - u, 0.5)) + 0.6);
      ctx.fill(); ctx.stroke();
      return;
    }
    for (let k = 1; k < pts.length - 1; k += 2) {
      const b = 0.5 + 0.5 * Math.sin(t * 5 - k * 0.6 + ph);
      glow(ctx, '#4dffd2', pts[k][0], pts[k][1] - s * 0.45 * (1 - k / pts.length), s * 0.5, 0.25 + 0.6 * b);
    }
    glow(ctx, '#d6fff4', s * 0.1, -s * 0.12, s * 0.45, 1);
    glow(ctx, '#4dffd2', 0, 0, s * 2.5, 0.2);
  };

  // ------------------------------------------------------------- static/floor creatures
  function makeCoral(seed) {
    let r = seed * 9301 + 49297;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const segs = [], tips = [];
    (function br(x, y, a, len, w, d) {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      segs.push([x, y, x2, y2, w]);
      if (d >= 5 || len < 4) { tips.push([x2, y2, rnd() * TAU]); return; }
      const n = d < 1 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const na = a + (k - (n - 1) / 2) * (0.38 + rnd() * 0.3) + (rnd() - 0.5) * 0.25;
        br(x2, y2, na * 0.8 + (-Math.PI / 2) * 0.2, len * (0.74 + rnd() * 0.16), w * 0.72, d + 1); // bias growth upward
      }
    })(0, 0, -Math.PI / 2, 17, 5.5, 0);
    return { segs, tips };
  }

  // ------------------------------------------------------------- the scene
  const VIS_CAP = [70, 10, 12, 8, 5, 4, 4, 2, 6, 7, 2, 1];
  const BANDS = [[0.03, 0.97], [0.1, 0.75], [0.2, 0.85], [0.12, 0.65], [0.4, 0.8], [0.15, 0.6], [0.3, 0.75], [0.25, 0.55], [0, 0], [0, 0], [0.18, 0.62], [0, 0]];
  const SIZE = [2.8, 12, 9, 15, 16, 7, 14, 26, 0, 0, 12, 0];
  const SPEED = [6, 10, 22, 6, 9, 14, 16, 10, 0, 0, 30, 0];

  const Scene = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1, t: 0,
    actors: [], snow: [], bubbles: [], pulses: [], floats: [], sparks: [],
    zoneVis: 0, floorVis: 0, floor: [], coralShapes: [], quality: 'high',
    moonPos: null, bloomVis: 0, frenzyVis: 0, lanternVis: 0, lanternGlow: 0,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.actors = C.CREATURES.map(() => []);
      for (let k = 0; k < 8; k++) this.coralShapes.push(makeCoral(k + 1));
      this.resize();
      window.addEventListener('resize', () => this.resize());
      for (let k = 0; k < 120; k++) this.snow.push({ x: Math.random(), y: Math.random(), r: rand(0.4, 1.6), v: rand(4, 14), ph: rand(0, TAU) });
    },
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = Math.max(200, r.width); this.H = Math.max(200, r.height);
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.buildFloor();
    },
    buildFloor() {
      const pts = [], n = 60;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const y = 0.5 + 0.25 * Math.sin(u * 9.3 + 1) + 0.15 * Math.sin(u * 23.1) + 0.1 * Math.sin(u * 51.7 + 2);
        pts.push([u, y]);
      }
      this.floor = pts;
    },
    floorY(x) {
      const u = clamp(x / this.W, 0, 1) * (this.floor.length - 1), k = Math.floor(u), f = u - k;
      const a = this.floor[k][1], b = this.floor[Math.min(this.floor.length - 1, k + 1)][1];
      return this.H - (24 + lerp(a, b, f) * 34) * this.floorVis;
    },

    visibleCount(i, n) {
      if (!n) return 0;
      if (i === 0) return Math.min(VIS_CAP[0], 4 + Math.floor(n * 0.6));
      return Math.min(VIS_CAP[i], Math.ceil(Math.sqrt(n) * (i < 4 ? 1.3 : 0.8)));
    },
    spawnActor(i) {
      const W = this.W, H = this.H, b = BANDS[i];
      const z = i === 7 ? rand(0.45, 0.65) : rand(0.6, 1);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const a = { i, z, dir, ph: Math.random(), x: rand(0, W), y: rand(b[0], b[1]) * H, by: 0, alpha: 0, dying: false, slot: 0 };
      a.by = a.y;
      if (i === 8 || i === 9) {
        const used = this.actors[i].map(o => o.slot);
        let slot = 0; while (used.includes(slot)) slot++;
        a.slot = slot;
        const order = i === 8 ? [0.12, 0.88, 0.3, 0.7, 0.04, 0.96] : [0.22, 0.78, 0.4, 0.6, 0.08, 0.92, 0.5];
        a.x = order[slot % order.length] * W + rand(-15, 15);
        a.scale = i === 8 ? rand(0.8, 1.2) : rand(0.9, 1.4);
        a.shape = this.coralShapes[slot % this.coralShapes.length];
      }
      if (i === 11) { a.x = W / 2; a.y = H * 0.52; }
      return a;
    },
    syncActors(s) {
      for (let i = 0; i < C.N; i++) {
        const want = this.visibleCount(i, s.creatures[i]);
        const list = this.actors[i];
        const alive = list.filter(a => !a.dying);
        if (alive.length < want) {
          for (let k = alive.length; k < want; k++) list.push(this.spawnActor(i));
        } else if (alive.length > want) {
          for (let k = want; k < alive.length; k++) alive[k].dying = true;
        }
      }
    },

    // ---- effects api
    pulse(x, y, text, big) {
      this.pulses.push({ x, y, t: 0, big: !!big });
      if (text) this.floats.push({ x: x + rand(-8, 8), y: y - 10, t: 0, text, big: !!big });
      if (this.pulses.length > 40) this.pulses.shift();
      if (this.floats.length > 30) this.floats.shift();
    },
    echo(text) {
      if (this.quality === 'low' || this.pulses.length > 25) return;
      const x = rand(this.W * 0.1, this.W * 0.9), y = rand(this.H * 0.2, this.H * 0.8);
      this.pulses.push({ x, y, t: 0, echo: true });
      if (text && Math.random() < 0.3) this.floats.push({ x, y, t: 0, text, echo: true });
    },
    burst(x, y, color, n) {
      for (let k = 0; k < n; k++) {
        const a = rand(0, TAU), v = rand(40, 220);
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.6, 1.4), color });
      }
    },
    moonHit(x, y) {
      const m = this.moonPos;
      return m && Math.hypot(x - m.x, y - m.y) < 46;
    },

    // ---- main frame
    frame(dt, s, d) {
      const ctx = this.ctx, W = this.W, H = this.H;
      this.t += dt;
      const t = this.t, hq = this.quality !== 'low';
      this.syncActors(s);
      this.zoneVis += (s.depth - this.zoneVis) * Math.min(1, dt * 0.8);
      const wantFloor = s.depth >= 3 || s.creatures[8] || s.creatures[9] ? 1 : 0;
      this.floorVis += (wantFloor - this.floorVis) * Math.min(1, dt * 0.6);
      this.bloomVis += ((s.buffs.bloom > 0 ? 1 : 0) - this.bloomVis) * Math.min(1, dt * 3);
      this.frenzyVis += ((s.buffs.frenzy > 0 ? 1 : 0) - this.frenzyVis) * Math.min(1, dt * 3);
      const showLantern = s.lantern.stage > 0 || s.depth >= 5;
      this.lanternVis += ((showLantern ? 1 : 0) - this.lanternVis) * Math.min(1, dt);

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      // background gradient
      const zi = clamp(Math.floor(this.zoneVis), 0, ZONE_PAL.length - 1), zf = this.zoneVis - zi;
      const za = ZONE_PAL[zi], zb = ZONE_PAL[Math.min(ZONE_PAL.length - 1, zi + 1)];
      const top = za.topC.map((v, k) => lerp(v, zb.topC[k], zf)), bot = za.botC.map((v, k) => lerp(v, zb.botC[k], zf));
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, rgba(top, 1)); bg.addColorStop(1, rgba(bot, 1));
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const rayA = lerp(za.ray, zb.ray, zf), snowA = lerp(za.snow, zb.snow, zf);

      ctx.globalCompositeOperation = 'lighter';
      // god rays
      if (rayA > 0.005) {
        for (let k = 0; k < 6; k++) {
          const x = W * (k / 5) + Math.sin(t * 0.15 + k * 1.7) * 60;
          const w = 40 + 30 * Math.sin(k * 2.3 + t * 0.2);
          const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
          const a = rayA * (0.45 + 0.35 * Math.sin(t * 0.4 + k));
          g.addColorStop(0, `rgba(190,240,255,${a * 0.5})`); g.addColorStop(1, 'rgba(190,240,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - w / 2, 0); ctx.lineTo(x + w / 2, 0); ctx.lineTo(x + w * 1.5 - 120, H * 0.9); ctx.lineTo(x - w * 1.5 - 120, H * 0.9); ctx.fill();
        }
      }
      // the hollow heart (deep background)
      this.drawHeart(ctx, s, t);
      ctx.globalCompositeOperation = 'source-over';

      // marine snow
      ctx.fillStyle = `rgba(220,235,255,${snowA})`;
      const snowN = hq ? this.snow.length : 50;
      for (let k = 0; k < snowN; k++) {
        const p = this.snow[k];
        p.y += p.v * dt / H; if (p.y > 1.02) { p.y = -0.02; p.x = Math.random(); }
        const x = p.x * W + Math.sin(t * 0.5 + p.ph) * 8;
        ctx.fillRect(x, p.y * H, p.r, p.r);
      }

      // creatures: background layer (leviathan) then the rest by depth
      this.updateActors(dt, s);
      const order = [7, 0, 5, 1, 3, 2, 6, 4, 10];
      for (const i of order) this.drawActors(ctx, i, t);

      // seafloor
      if (this.floorVis > 0.01) this.drawFloor(ctx, t);
      if (this.lanternVis > 0.01) this.drawLantern(ctx, s, t);

      // moon pearl jelly
      this.drawMoonEvent(ctx, s, t);

      // pulses / floats / sparks
      this.drawEffects(ctx, dt, s, d);

      // bloom & frenzy ambience
      ctx.globalCompositeOperation = 'lighter';
      if (this.bloomVis > 0.01) {
        const hue = (t * 40) % 360;
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, `hsla(${hue},90%,60%,0)`); g.addColorStop(1, `hsla(${hue},90%,60%,${0.22 * this.bloomVis})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (hq && Math.random() < dt * 30) this.sparks.push({ x: rand(0, W), y: H + 5, vx: rand(-10, 10), vy: rand(-80, -30), t: 0, life: rand(2, 4), color: `hsl(${(hue + rand(0, 120)) % 360},90%,70%)` });
      }
      if (this.frenzyVis > 0.01 && hq && Math.random() < dt * 25) {
        this.sparks.push({ x: rand(0, W), y: rand(0, H), vx: 0, vy: rand(-30, -10), t: 0, life: rand(1, 2), color: '#ffe08a' });
      }
      ctx.globalCompositeOperation = 'source-over';

      // vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },

    updateActors(dt, s) {
      const W = this.W, H = this.H, t = this.t;
      for (let i = 0; i < C.N; i++) {
        const list = this.actors[i];
        for (let k = list.length - 1; k >= 0; k--) {
          const a = list[k];
          a.alpha = clamp(a.alpha + (a.dying ? -dt : dt) * 0.8, 0, 1);
          if (a.dying && a.alpha <= 0) { list.splice(k, 1); continue; }
          if (i === 8 || i === 9 || i === 11) continue;
          const sp = SPEED[i] * (0.7 + a.z * 0.5) * (s.buffs.frenzy > 0 ? 1.8 : 1);
          if (i === 3) { // moon jellies pulse upward then sink
            a.by -= Math.max(0, Math.sin(t * 2.2 + a.ph * 7)) * 14 * dt - 3 * dt;
            a.x += a.dir * sp * 0.4 * dt;
          } else {
            a.x += a.dir * sp * dt;
            if (i === 0) a.by += Math.sin(t * 0.7 + a.ph * 20) * 4 * dt;
          }
          const b = BANDS[i];
          if (a.by < b[0] * H - 40) a.by = b[1] * H; if (a.by > b[1] * H + 40) a.by = b[0] * H;
          a.y = a.by + Math.sin(t * (i === 0 ? 1.3 : 0.6) + a.ph * TAU) * (i === 7 ? 18 : 8);
          const margin = (SIZE[i] || 10) * (i === 7 ? 12 : i === 10 ? 10 : i === 5 ? 12 : 3);
          if (a.dir > 0 && a.x > W + margin) { a.x = -margin; a.by = rand(b[0], b[1]) * H; }
          if (a.dir < 0 && a.x < -margin) { a.x = W + margin; a.by = rand(b[0], b[1]) * H; }
        }
      }
    },

    drawActors(ctx, i, t) {
      const list = this.actors[i];
      if (!list.length) return;
      const fn = DRAW[i];
      const bloom = 1 + this.bloomVis * 0.6;
      for (const lit of [false, true]) {
        ctx.globalCompositeOperation = lit ? 'lighter' : 'source-over';
        for (const a of list) {
          const sc = SIZE[i] * a.z;
          ctx.save();
          ctx.translate(a.x, a.y);
          if (i !== 3 && i !== 0) ctx.scale(a.dir, 1);
          withAlpha(ctx, a.alpha * (lit ? bloom : 1), () => fn(ctx, sc, t, a.ph, lit));
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    drawFloor(ctx, t) {
      const W = this.W, H = this.H, fv = this.floorVis;
      // vents & coral sit on the floor
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(6,6,14,${0.96 * fv})`;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 60) ctx.lineTo(x, this.floorY(x));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(90,110,170,${0.25 * fv})`; ctx.lineWidth = 1;
      ctx.beginPath(); for (let x = 0; x <= W; x += W / 60) ctx.lineTo(x, this.floorY(x)); ctx.stroke();

      for (const a of this.actors[8]) this.drawVent(ctx, a, t);
      for (const a of this.actors[9]) this.drawCoral(ctx, a, t);
    },
    drawVent(ctx, a, t) {
      const base = this.floorY(a.x) + 6, h = 70 * a.scale, w = 16 * a.scale;
      ctx.globalAlpha = a.alpha;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1b0f12';
      ctx.beginPath();
      ctx.moveTo(a.x - w, base);
      ctx.lineTo(a.x - w * 0.55, base - h * 0.5); ctx.lineTo(a.x - w * 0.7, base - h * 0.7); ctx.lineTo(a.x - w * 0.35, base - h);
      ctx.lineTo(a.x + w * 0.35, base - h); ctx.lineTo(a.x + w * 0.6, base - h * 0.6); ctx.lineTo(a.x + w * 0.5, base - h * 0.35); ctx.lineTo(a.x + w, base);
      ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(t * 2 + a.ph * 9);
      ctx.strokeStyle = `rgba(255,140,60,${0.55 * pulse})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x - w * 0.2, base - h * 0.95); ctx.lineTo(a.x + w * 0.1, base - h * 0.6); ctx.lineTo(a.x - w * 0.15, base - h * 0.3); ctx.lineTo(a.x + w * 0.2, base - 4); ctx.stroke();
      glow(ctx, '#ff9a3d', a.x, base - h, w * 2.4, 0.6 * pulse);
      for (let k = 0; k < 7; k++) { // shimmering plume
        const u = ((t * 0.35 + k / 7 + a.ph) % 1);
        glow(ctx, '#ff7a2d', a.x + Math.sin(t * 1.5 + k * 2 + u * 5) * (6 + u * 25), base - h - u * h * 1.8, w * (0.8 + u * 2.2), 0.28 * (1 - u));
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    drawCoral(ctx, a, t) {
      const base = this.floorY(a.x) + 4, sc = a.scale;
      ctx.save();
      ctx.translate(a.x, base); ctx.scale(sc, sc);
      ctx.globalAlpha = a.alpha;
      ctx.strokeStyle = '#4a1838'; ctx.lineCap = 'round';
      for (const sg of a.shape.segs) { ctx.lineWidth = sg[4]; ctx.beginPath(); ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter';
      for (const tp of a.shape.tips) {
        const b = 0.5 + 0.5 * Math.sin(t * 1.4 + tp[2] + a.ph * 5);
        glow(ctx, '#ff8ac8', tp[0], tp[1], 3 + 2.5 * b, 0.45 + 0.55 * b);
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    },
    drawHeart(ctx, s, t) {
      const list = this.actors[11];
      if (!list.length) return;
      const a = list[0], W = this.W, H = this.H;
      const n = s.creatures[11];
      const R = Math.min(W, H) * (0.07 + 0.03 * Math.min(1, Math.log10(n + 1) / 2.5));
      const ph = (t * 1.1) % 1;
      const beat = Math.pow(Math.max(0, Math.sin(ph * TAU)), 10) + 0.7 * Math.pow(Math.max(0, Math.sin(ph * TAU - 0.9)), 10);
      const x = W / 2, y = H * 0.5;
      ctx.globalAlpha = a.alpha;
      glow(ctx, '#b06cff', x, y, R * (6 + beat * 1.5), 0.25 + 0.2 * beat);
      glow(ctx, '#f0c4ff', x, y, R * (1.8 + beat * 0.4), 0.7 + 0.3 * beat);
      ctx.strokeStyle = `rgba(230,190,255,${0.35 * (1 - ph)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, R * (1 + ph * 5), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    },
    drawLantern(ctx, s, t) {
      const W = this.W, H = this.H, x = W / 2, base = (this.floorVis > 0.05 ? this.floorY(x) : H) + 4;
      const st = s.lantern.stage, a = this.lanternVis;
      const ghost = (k) => st <= k;
      ctx.globalAlpha = a;
      const sc = Math.min(1.2, H / 520);
      ctx.save(); ctx.translate(x, base); ctx.scale(sc, sc);
      const draw = (k, fn) => {
        if (ghost(k)) { ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(200,220,255,0.18)'; ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.lineWidth = 1.2; fn(true); ctx.setLineDash([]); }
        else fn(false);
      };
      // 1 foundation of bone
      draw(0, g => {
        if (!g) { ctx.strokeStyle = '#d9d2bf'; ctx.lineWidth = 4; }
        for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(k * 18, 0, 10, 26 - Math.abs(k) * 3, 0, Math.PI, TAU); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-70, -2); ctx.lineTo(70, -2); ctx.stroke();
      });
      // 2 coral pillar
      draw(1, g => {
        if (!g) { const gr = ctx.createLinearGradient(-14, 0, 14, 0); gr.addColorStop(0, '#5a1d48'); gr.addColorStop(0.5, '#b34b8f'); gr.addColorStop(1, '#5a1d48'); ctx.fillStyle = gr; }
        ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-10, -120); ctx.lineTo(10, -120); ctx.lineTo(16, -6); ctx.closePath();
        g ? ctx.stroke() : ctx.fill();
      });
      // 3 lens
      draw(2, g => {
        if (!g) {
          const gr = ctx.createRadialGradient(-8, -158, 2, 0, -150, 32);
          gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(140,200,255,0.12)');
          ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(200,235,255,0.8)'; ctx.lineWidth = 2;
        }
        ctx.beginPath(); ctx.arc(0, -150, 30, 0, TAU); if (!g) ctx.fill(); ctx.stroke();
      });
      // 4 wick
      draw(3, g => {
        if (!g) { ctx.strokeStyle = '#fff2c9'; ctx.lineWidth = 3; }
        ctx.beginPath(); ctx.moveTo(0, -124); ctx.quadraticCurveTo(6, -140, 0, -158); ctx.stroke();
      });
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      const lx = x, ly = base - 150 * sc;
      if (st >= 4) glow(ctx, '#fff2c9', lx, ly, 40 * sc, 0.8 + 0.2 * Math.sin(t * 7));
      if (st >= 5) { // kindled: the abyss is lit
        const fl = 0.85 + 0.15 * Math.sin(t * 3) * Math.sin(t * 7.3);
        glow(ctx, '#ffe08a', lx, ly, Math.max(W, H) * 0.9, 0.35 * fl);
        glow(ctx, '#fff6dc', lx, ly, 90 * sc * fl, 1);
        for (let k = 0; k < 12; k++) {
          const ang = t * 0.1 + k * TAU / 12;
          const g = ctx.createLinearGradient(lx, ly, lx + Math.cos(ang) * W, ly + Math.sin(ang) * W);
          g.addColorStop(0, 'rgba(255,230,160,0.16)'); g.addColorStop(1, 'rgba(255,230,160,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(ang - 0.05) * W * 1.5, ly + Math.sin(ang - 0.05) * W * 1.5); ctx.lineTo(lx + Math.cos(ang + 0.05) * W * 1.5, ly + Math.sin(ang + 0.05) * W * 1.5); ctx.fill();
        }
      } else if (st >= 1) {
        glow(ctx, '#ffe0a0', lx, base - 20 * sc, 60 * sc * st, 0.12 * st);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
    drawMoonEvent(ctx, s, t) {
      if (!s.moon) { this.moonPos = null; return; }
      const W = this.W, H = this.H, m = s.moon;
      const prog = 1 - m.life / m.max;
      const x = W * (0.15 + 0.7 * m.seed) + Math.sin(prog * TAU * 1.5 + m.seed * 6) * 60;
      const y = H * 0.88 - prog * H * 0.72;
      this.moonPos = { x, y };
      const fade = Math.min(1, m.life / 1.5, (m.max - m.life) / 0.8);
      ctx.save(); ctx.translate(x, y);
      withAlpha(ctx, fade, () => {
        DRAW[3](ctx, 22, t, m.seed, false, true);
        ctx.globalCompositeOperation = 'lighter';
        DRAW[3](ctx, 22, t, m.seed, true, true);
      });
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    },
    drawEffects(ctx, dt, s, d) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = this.pulses.length - 1; k >= 0; k--) {
        const p = this.pulses[k];
        p.t += dt;
        const life = p.echo ? 0.8 : 0.7;
        if (p.t > life) { this.pulses.splice(k, 1); continue; }
        const u = p.t / life;
        const r = (p.echo ? 30 : p.big ? 140 : 80) * (1 - Math.pow(1 - u, 3));
        ctx.strokeStyle = p.echo ? `rgba(160,200,255,${0.35 * (1 - u)})` : `rgba(140,255,255,${0.8 * (1 - u)})`;
        ctx.lineWidth = p.echo ? 1 : 2.5 * (1 - u) + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
        if (!p.echo && u < 0.3) glow(ctx, '#7ff9ff', p.x, p.y, 30, 0.7 * (1 - u / 0.3));
      }
      for (let k = this.sparks.length - 1; k >= 0; k--) {
        const p = this.sparks[k];
        p.t += dt;
        if (p.t > p.life) { this.sparks.splice(k, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 1.5;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 1 - p.t / p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      for (let k = this.floats.length - 1; k >= 0; k--) {
        const f = this.floats[k];
        f.t += dt;
        const life = f.big ? 2.2 : 1.1;
        if (f.t > life) { this.floats.splice(k, 1); continue; }
        const u = f.t / life;
        ctx.globalAlpha = (1 - u) * (f.echo ? 0.45 : 1);
        ctx.font = `${f.big ? 700 : 600} ${f.big ? 20 : f.echo ? 11 : 15}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillStyle = f.big ? '#ffe9a8' : '#e8ffff';
        ctx.shadowColor = f.big ? '#ffb400' : '#00e5ff'; ctx.shadowBlur = 8;
        ctx.fillText(f.text, f.x, f.y - u * (f.big ? 60 : 40));
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    },
  };

  function withAlpha(ctx, a, fn) {
    // Draws fn with the given base alpha (glow() multiplies onto it).
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a);
    fn();
    ctx.globalAlpha = prevAlpha;
  }

  // ------------------------------------------------------------- icons for the UI
  const ICON_SCALE = [3.2, 11, 10, 13, 9, 5.5, 9, 5, 0, 0, 5, 0];
  function drawIcon(canvas, i, t) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const k = w / 48;
    g.save();
    g.scale(k, k);
    t = t || 0;
    if (i === 8) { // vent icon
      g.fillStyle = '#1b0f12';
      g.beginPath(); g.moveTo(12, 44); g.lineTo(19, 20); g.lineTo(29, 20); g.lineTo(36, 44); g.fill();
      g.globalCompositeOperation = 'lighter';
      glow(g, '#ff9a3d', 24, 20, 14, 0.9);
      for (let j = 0; j < 4; j++) glow(g, '#ff7a2d', 24 + Math.sin(j * 2) * 4, 14 - j * 4, 6 + j * 2, 0.35);
    } else if (i === 9) { // coral icon
      const sh = makeCoral(3);
      g.translate(24, 44); g.scale(0.7, 0.7);
      g.strokeStyle = '#7a2a5e'; g.lineCap = 'round';
      for (const sg of sh.segs) { g.lineWidth = sg[4]; g.beginPath(); g.moveTo(sg[0], sg[1]); g.lineTo(sg[2], sg[3]); g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (const tp of sh.tips) glow(g, '#ff8ac8', tp[0], tp[1], 7, 0.9);
    } else if (i === 11) { // heart icon
      g.globalCompositeOperation = 'lighter';
      glow(g, '#b06cff', 24, 24, 24, 0.6);
      glow(g, '#f0c4ff', 24, 24, 12, 1);
      g.strokeStyle = 'rgba(230,190,255,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(24, 24, 15, 0, TAU); g.stroke();
    } else {
      const off = { 0: [24, 24], 3: [24, 20], 5: [36, 24], 7: [40, 24], 10: [40, 24], 4: [22, 26], 2: [26, 24] }[i] || [24, 24];
      g.translate(off[0], off[1]);
      if (i === 7 || i === 10) g.scale(1, 1);
      if (i === 0) { // a little cluster
        for (const [dx, dy, s] of [[-8, -6, 1], [6, -9, 0.8], [0, 4, 1.2], [9, 8, 0.7], [-9, 9, 0.9]]) {
          g.save(); g.translate(dx, dy);
          DRAW[0](g, ICON_SCALE[0] * s, t, dx * 0.1, false);
          g.globalCompositeOperation = 'lighter'; DRAW[0](g, ICON_SCALE[0] * s, t, dx * 0.1, true);
          g.restore();
        }
      } else {
        DRAW[i](g, ICON_SCALE[i], t, 0.3, false);
        g.globalCompositeOperation = 'lighter';
        DRAW[i](g, ICON_SCALE[i], t, 0.3, true);
      }
    }
    g.restore();
    g.globalCompositeOperation = 'source-over';
  }

  window.Scene = Scene;
  window.drawCreatureIcon = drawIcon;
  window.drawMoonIcon = function (canvas) {
    const g = canvas.getContext('2d');
    const k = canvas.width / 48;
    g.save(); g.scale(k, k); g.translate(24, 22);
    DRAW[3](g, 12, 0, 0.2, false, true);
    g.globalCompositeOperation = 'lighter';
    DRAW[3](g, 12, 0, 0.2, true, true);
    g.restore();
  };
})();
