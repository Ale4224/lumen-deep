/* Lumen Deep — tiny synthesized sound effects (WebAudio, no assets). */
(function () {
  'use strict';
  const PENTA = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  let ctx = null, master = null, echo = null, lastPulse = 0;

  function ensure() {
    if (ctx) return ctx.state === 'suspended' ? (ctx.resume(), ctx) : ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    // soft feedback delay for an underwater shimmer
    echo = ctx.createDelay(1);
    echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(master);
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, dur, opts) {
    if (!Sfx.on) return;
    const c = ensure(); if (!c) return;
    opts = opts || {};
    const t0 = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t0 + dur);
    const v = opts.vol || 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    if (opts.wet !== false) g.connect(echo);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const Sfx = {
    on: true,
    unlock() { ensure(); },
    pulse() {
      const now = performance.now();
      if (now - lastPulse < 45) return;
      lastPulse = now;
      const f = PENTA[(Math.random() * PENTA.length) | 0];
      tone(f, 0.45, { vol: 0.32 });
      tone(f * 2, 0.25, { vol: 0.08, type: 'triangle' });
    },
    buy() { tone(660, 0.12, { vol: 0.2, type: 'triangle', wet: false }); tone(990, 0.16, { vol: 0.14, delay: 0.05, type: 'triangle', wet: false }); },
    upgrade() { [523, 659, 784].forEach((f, k) => tone(f, 0.3, { vol: 0.18, delay: k * 0.05, type: 'triangle' })); },
    bloom() { [392, 523, 659, 784, 1046].forEach((f, k) => tone(f, 1.6, { vol: 0.2, delay: k * 0.07, attack: 0.15 })); },
    moon() { [1046, 1318, 1568, 2093].forEach((f, k) => tone(f, 0.6, { vol: 0.14, delay: k * 0.06 })); },
    ach() { [784, 988, 1175].forEach((f, k) => tone(f, 0.5, { vol: 0.18, delay: k * 0.09, type: 'triangle' })); },
    descend() { tone(330, 2.2, { vol: 0.35, slide: 0.5, attack: 0.3 }); tone(495, 2.2, { vol: 0.15, slide: 0.5, attack: 0.3 }); },
    surface() { tone(220, 2.4, { vol: 0.35, slide: 3, attack: 0.4 }); tone(330, 2.4, { vol: 0.2, slide: 3, attack: 0.4 }); },
    lantern() { [262, 392, 523, 659, 784, 1046].forEach((f, k) => tone(f, 2.5, { vol: 0.18, delay: k * 0.12, attack: 0.2 })); },
  };
  window.Sfx = Sfx;
})();
