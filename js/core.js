/* Lumen Deep — core game model.
 * Pure data + rules, no DOM. Shared by the browser game and tools/sim.js (balance simulator). */
(function (root) {
  'use strict';

  const VERSION = 1;
  const COST_GROWTH = 1.15;

  // ---------------------------------------------------------------- creatures
  const CREATURES = [
    { id: 'plankton', name: 'Glimmer Plankton', short: 'Plankton', cost: 10, prod: 0.15, color: '#7ff9ff',
      desc: 'Specks of living light. Individually useless. Collectively, a galaxy.' },
    { id: 'comb', name: 'Comb Jelly', short: 'Comb Jellies', cost: 125, prod: 1.2, color: '#c49cff',
      desc: 'Rows of beating cilia scatter rainbows through the dark.' },
    { id: 'shrimp', name: 'Lantern Shrimp', short: 'Shrimp', cost: 1500, prod: 9, color: '#5cf2b0',
      desc: 'When startled they spit clouds of glowing ink. They are always startled.' },
    { id: 'moon', name: 'Moon Jelly', short: 'Moon Jellies', cost: 1.8e4, prod: 65, color: '#9fd8ff',
      desc: 'Drifts on slow currents, pulsing like an enormous heartbeat.' },
    { id: 'angler', name: 'Anglerfish', short: 'Anglers', cost: 2.2e5, prod: 480, color: '#ffd36b',
      desc: 'Dangles a lure of pure light. Sometimes it catches lumen instead of prey.' },
    { id: 'siphon', name: 'Siphonophore', short: 'Siphonophores', cost: 2.6e6, prod: 3500, color: '#ff7ad9',
      desc: 'Not one animal but a colony, strung out like festival lights for forty metres.' },
    { id: 'squid', name: 'Vampire Squid', short: 'Squid', cost: 3.2e7, prod: 2.6e4, color: '#ff5468',
      desc: 'Neither vampire nor squid. Turns itself inside out to shine brighter.' },
    { id: 'leviathan', name: 'Hadal Leviathan', short: 'Leviathans', cost: 4e8, prod: 1.9e5, color: '#62a8ff',
      desc: 'Something vast passes beneath you. Its scales hold very old light.' },
    { id: 'vent', name: 'Vent Choir', short: 'Vents', cost: 5e9, prod: 1.4e6, color: '#ff9a3d',
      desc: 'Hydrothermal chimneys that hum, and glow, and hum.' },
    { id: 'coral', name: 'Dreaming Coral', short: 'Coral', cost: 6.5e10, prod: 1.05e7, color: '#ff8ac8',
      desc: 'A reef that grows in perfect darkness and dreams of a sun it has never seen.' },
    { id: 'wyrm', name: 'Tidewyrm', short: 'Tidewyrms', cost: 9e11, prod: 8e7, color: '#4dffd2',
      desc: 'A serpent made of current, coiled through every trench at once.' },
    { id: 'heart', name: 'Hollow Heart', short: 'Hearts', cost: 1.3e13, prod: 6.5e8, color: '#f0c4ff',
      desc: 'At the bottom of everything, something beats. Each beat is a dawn.' },
  ];
  const N = CREATURES.length;

  // ---------------------------------------------------------------- depth zones
  const ZONES = [
    { name: 'Sunlit Shallows', depth: 0, cost: 0,
      desc: 'Warm, bright water. Hard to tell your light from the sun\'s.' },
    { name: 'Twilight Zone', depth: 200, cost: 2000,
      desc: 'The sun fades to a rumour. Your glow starts to matter.' },
    { name: 'Midnight Zone', depth: 1000, cost: 1e6,
      desc: 'No sunlight has ever reached here. Every light is alive.' },
    { name: 'Abyssal Plain', depth: 4000, cost: 5e8,
      desc: 'A silent desert of silt beneath crushing pressure.' },
    { name: 'Hadal Trench', depth: 8000, cost: 2.5e11,
      desc: 'A wound in the sea floor. The vents sing here.' },
    { name: 'The Hollow', depth: 11000, cost: 1.5e14,
      desc: 'Below the bottom. Something enormous is waiting to be lit.' },
  ];
  const ZONE_MULT = 1.25;

  // ---------------------------------------------------------------- upgrades
  const UPGRADES = [];
  const TIER_THRESH = [1, 10, 25, 50, 100, 150, 200, 250];
  const TIER_NAMES = ['Brighter Photophores', 'Shoal Harmony', 'Pulse Synchrony', 'Glow Glands',
    'Radiant Brood', 'Luminous Lineage', 'Ancient Light', 'Primordial Glow'];
  CREATURES.forEach((c, i) => {
    TIER_THRESH.forEach((thr, k) => {
      UPGRADES.push({
        id: `t${i}_${k}`, kind: 'tier', tier: i, need: thr,
        name: `${TIER_NAMES[k]}`, sub: c.name,
        desc: `${c.name} glow twice as bright.`,
        cost: c.cost * Math.pow(COST_GROWTH, thr) * 15,
        req: s => s.creatures[i] >= thr,
      });
    });
  });
  // food web: predators feed on the tier below
  for (let i = 1; i < N; i++) {
    const pred = CREATURES[i], prey = CREATURES[i - 1];
    UPGRADES.push({
      id: `fw${i}`, kind: 'chain', tier: i,
      name: 'Food Web', sub: `${pred.short} ← ${prey.short}`,
      desc: `${pred.name} gain +1% production for each ${prey.name} you own.`,
      cost: pred.cost * 400,
      req: s => s.creatures[i] >= 15 && s.creatures[i - 1] >= 40,
    });
  }
  // plankton swarm: plankton benefit from everything else
  [[25, 'Swarm Instinct', 0.1, 4e3], [75, 'Living Galaxy', 0.5, 4e6], [150, 'Plankton Nebula', 2.5, 4e10],
    [250, 'Infinite Motes', 12, 4e16]].forEach(([need, name, v, cost], k) => {
    UPGRADES.push({
      id: `sw${k}`, kind: 'swarm', v, name, sub: 'Glimmer Plankton',
      desc: `Each Glimmer Plankton gains +${v} base glow for every non-plankton creature you own.`,
      cost, req: s => s.creatures[0] >= need,
    });
  });
  // global biochemistry
  ['Luciferin Synthesis', 'Luciferase Catalyst', 'Photophore Lenses', 'Reflector Plates', 'Chromatophore Patterns',
    'Counter-illumination', 'Bioluminous Ink', 'Coherent Glow', 'Abyssal Spectrum', 'Living Lasers',
    'Starlight Memory', 'The First Light'].forEach((name, k) => {
    const cost = 2.5e4 * Math.pow(30, k);
    UPGRADES.push({
      id: `g${k}`, kind: 'global', mult: 1.25, name, sub: 'Biochemistry',
      desc: 'All creatures produce +25% lumen.',
      cost, req: s => s.runEarned >= cost * 0.4,
    });
  });
  // pulse (click)
  const clickUps = [
    ['Sharper Pulse', 'clickMult', 2, 60, 15],
    ['Echolocation', 'clickMult', 2, 800, 100],
    ['Phosphor Fingertips', 'clickPct', 0.01, 1.2e4, 300],
    ['Strobe Reflex', 'clickMult', 3, 5e4, 600],
    ['Resonant Touch', 'clickPct', 0.01, 3e6, 1000],
    ['Abyssal Tap', 'clickPct', 0.01, 1e9, 2000],
    ['Tidal Palm', 'clickPct', 0.01, 3e12, 3500],
    ['Hand of the Deep', 'clickPct', 0.01, 1e16, 5000],
    ['Touch of Dawn', 'clickPct', 0.01, 3e19, 7500],
  ];
  clickUps.forEach(([name, kind, v, cost, clicks], k) => {
    UPGRADES.push({
      id: `p${k}`, kind, v, name, sub: 'Pulse',
      desc: kind === 'clickMult' ? `Pulses are ${v}× stronger.` : `Pulses also give ${v * 100}% of your lumen/sec.`,
      cost, req: s => s.stats.clicks >= clicks,
    });
  });
  // resonance & bloom
  const resUps = [
    ['Tuning-fork Coral', 'resRate', 0.3, 5e3, 'Pulses build +30% more Resonance.'],
    ['Long Bloom', 'bloomDur', 5, 4e5, 'Blooms last 5 seconds longer.'],
    ['Echoing Chamber', 'echo', 0.5, 2e6, 'An echo pulses for you every 2 seconds.'],
    ['Chorus Bloom', 'bloomMult', 1, 3e8, 'Blooms multiply production by +1×.'],
    ['Twin Echo', 'echo', 0.5, 5e9, 'Another echo pulses every 2 seconds.'],
    ['Sustained Song', 'bloomDur', 10, 5e11, 'Blooms last 10 seconds longer.'],
    ['Harmonic Lattice', 'resRate', 0.3, 5e13, 'Pulses build +30% more Resonance.'],
    ['Echo Choir', 'echo', 1, 5e15, 'Echoes pulse one more time per second.'],
    ['Endless Chorus', 'bloomMult', 1, 5e18, 'Blooms multiply production by +1×.'],
  ];
  resUps.forEach(([name, kind, v, cost, desc], k) => {
    UPGRADES.push({ id: `r${k}`, kind, v, name, sub: 'Resonance', desc, cost, req: s => s.runEarned >= cost * 0.3 });
  });
  // moon jellies
  const moonUps = [
    ['Silver Lure', 'moonFreq', 0.25, 3e4, 1, 'Moon Pearl Jellies appear 25% more often.'],
    ['Lingering Shine', 'moonStay', 0.5, 4e6, 3, 'Moon Pearl Jellies linger 50% longer.'],
    ['Tidal Fortune', 'moonPower', 0.3, 3e9, 7, 'Moon Pearl Jelly gifts are 30% stronger and last 30% longer.'],
    ['Pearl Current', 'moonFreq', 0.25, 2e12, 15, 'Moon Pearl Jellies appear 25% more often.'],
    ['Lunar Covenant', 'moonPower', 0.3, 2e15, 30, 'Moon Pearl Jelly gifts are 30% stronger and last 30% longer.'],
  ];
  moonUps.forEach(([name, kind, v, cost, caught, desc], k) => {
    UPGRADES.push({ id: `m${k}`, kind, v, name, sub: 'Moon Pearl', desc, cost, req: s => s.stats.moons >= caught });
  });
  const UPG = {};
  UPGRADES.forEach(u => { UPG[u.id] = u; });

  // ---------------------------------------------------------------- relics (bought with pearls)
  const RELICS = [
    { id: 'heart', name: 'Lantern Heart', max: 30, base: 2, growth: 2.2,
      info: 'All production ×1.25 per level.', eff: l => `×${fmtPlain(Math.pow(1.25, l))} production` },
    { id: 'memory', name: 'Tidal Memory', max: 5, costs: [5, 20, 75, 250, 1000],
      info: 'Start every dive one zone deeper per level.', eff: l => `start in ${ZONES[l].name}` },
    { id: 'seed', name: 'Starting Glow', max: 6, base: 3, growth: 4,
      info: 'Begin every dive with a stash of lumen.', eff: l => `start with ${fmt(startGlow(l))}` },
    { id: 'brood', name: 'Brood Memory', max: 10, base: 3, growth: 1.6,
      info: 'Creatures cost 5% less per level (compounding).', eff: l => `-${Math.round((1 - Math.pow(0.95, l)) * 100)}% creature cost` },
    { id: 'echo', name: 'Echo Shell', max: 10, base: 3, growth: 1.6,
      info: 'A shell that echoes your pulses: +1 automatic pulse per second per level.', eff: l => `${l} echo${l === 1 ? '' : 'es'}/s` },
    { id: 'bloom', name: 'Deep Resonance', max: 5, base: 4, growth: 2,
      info: 'Blooms multiply production by +1× per level.', eff: l => `+${l}× bloom` },
    { id: 'gild', name: 'Gilded Bell', max: 5, base: 3, growth: 2,
      info: 'Moon Pearl Jellies appear 20% more often per level.', eff: l => `+${l * 20}% frequency` },
    { id: 'hull', name: 'Pressure Hull', max: 5, base: 2, growth: 2,
      info: 'Better offline gains: +10% efficiency and +4h cap per level.', eff: l => `${50 + l * 10}% for ${8 + l * 4}h` },
    { id: 'diver', name: 'Pearl Diver', max: 10, base: 5, growth: 1.7,
      info: '+10% pearls from each surfacing per level.', eff: l => `+${l * 10}% pearls` },
  ];
  const RELIC = {};
  RELICS.forEach(r => { RELIC[r.id] = r; });
  function relicCost(r, lvl) {
    if (r.costs) return r.costs[lvl];
    return Math.ceil(r.base * Math.pow(r.growth, lvl));
  }
  function startGlow(l) { return l ? Math.pow(10, 1 + 2 * l) : 0; }

  // ---------------------------------------------------------------- the Great Lantern (permanent endgame project)
  const LANTERN = [
    { name: 'Foundation of Bone', cost: 1e18 },
    { name: 'Pillar of Coral', cost: 1e21 },
    { name: 'Lens of Pressure', cost: 1e23 },
    { name: 'Wick of the Heart', cost: 1e25 },
    { name: 'The Kindling', cost: 1e27 },
  ];
  const LANTERN_MULT = 2;

  // ---------------------------------------------------------------- number formatting
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc'];
  let notation = 'short';
  function setNotation(n) { notation = n; }
  function fmt(x, dec) {
    if (!isFinite(x)) return '∞';
    if (x < 0) return '-' + fmt(-x, dec);
    if (x < 1000) {
      if (dec === undefined) dec = x % 1 === 0 ? 0 : x < 1 ? 2 : x < 10 ? 1 : 0;
      return x.toFixed(dec).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }
    const e = Math.floor(Math.log10(x));
    if (notation === 'sci' || e >= SUFFIX.length * 3) {
      const m = x / Math.pow(10, e);
      return m.toFixed(2) + 'e' + e;
    }
    const g = Math.floor(e / 3);
    const v = x / Math.pow(1000, g);
    return (v >= 100 ? v.toFixed(1) : v.toFixed(2)) + SUFFIX[g];
  }
  function fmtPlain(x) { return x < 1e6 ? (Math.round(x * 100) / 100).toLocaleString('en-US') : fmt(x); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // ---------------------------------------------------------------- state
  function newState() {
    return {
      v: VERSION,
      lumen: 0, runEarned: 0, totalEarned: 0,
      creatures: new Array(N).fill(0),
      upgrades: {},
      depth: 0, maxDepth: 0,
      pearls: 0, pearlsEarned: 0, relics: {},
      ach: {},
      lantern: { stage: 0, fill: 0 },
      resonance: 0, idleClick: 99,
      buffs: { bloom: 0, frenzy: 0, hands: 0 },
      moon: null, moonTimer: 75,
      echoAcc: 0,
      stats: { clicks: 0, blooms: 0, moons: 0, prestiges: 0, playTime: 0, runTime: 0, maxLps: 0,
        offlineGain: 0, fastestRun: 0, bestRunPearls: 0, totalClickLumen: 0, flags: {} },
      victory: false, victorySeen: false,
      created: Date.now(), lastSave: Date.now(),
      settings: { sound: true, notation: 'short', quality: 'high', confirmPrestige: true },
    };
  }

  // Merge a loaded save onto a fresh state (forward-compatible with new fields).
  function hydrate(obj) {
    const s = newState();
    if (!obj || typeof obj !== 'object') return s;
    for (const k of Object.keys(s)) {
      if (obj[k] === undefined) continue;
      if (k === 'creatures') { for (let i = 0; i < N; i++) s.creatures[i] = +obj.creatures[i] || 0; }
      else if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && k !== 'moon') Object.assign(s[k], obj[k]);
      else s[k] = obj[k];
    }
    s.stats.flags = Object.assign({}, obj.stats && obj.stats.flags);
    return s;
  }

  const has = (s, id) => !!s.upgrades[id];
  const rl = (s, id) => s.relics[id] || 0;

  // ---------------------------------------------------------------- derived multipliers
  function derive(s) {
    const d = {
      tierMult: new Array(N).fill(1), base: CREATURES.map(c => c.prod),
      global: 1, clickMult: 1, clickPct: 0, resRate: 1, bloomDur: 15, bloomMult: 3,
      moonFreq: 1, moonStay: 1, moonPower: 1, echoRate: 0,
      costMult: Math.pow(0.95, rl(s, 'brood')),
      offlineEff: 0.5 + 0.1 * rl(s, 'hull'), offlineCap: (8 + 4 * rl(s, 'hull')) * 3600,
      parts: {},
    };
    let swarm = 0, upgGlobal = 1;
    for (const id in s.upgrades) {
      const u = UPG[id];
      if (!u) continue;
      switch (u.kind) {
        case 'tier': d.tierMult[u.tier] *= 2; break;
        case 'chain': d.tierMult[u.tier] *= 1 + 0.01 * s.creatures[u.tier - 1]; break;
        case 'swarm': swarm += u.v; break;
        case 'global': upgGlobal *= u.mult; break;
        case 'clickMult': d.clickMult *= u.v; break;
        case 'clickPct': d.clickPct += u.v; break;
        case 'resRate': d.resRate += u.v; break;
        case 'bloomDur': d.bloomDur += u.v; break;
        case 'bloomMult': d.bloomMult += u.v; break;
        case 'echo': d.echoRate += u.v; break;
        case 'moonFreq': d.moonFreq += u.v; break;
        case 'moonStay': d.moonStay += u.v; break;
        case 'moonPower': d.moonPower += u.v; break;
      }
    }
    if (swarm) {
      let others = 0;
      for (let i = 1; i < N; i++) others += s.creatures[i];
      d.base[0] += swarm * others;
    }
    d.echoRate += rl(s, 'echo');
    d.bloomMult += rl(s, 'bloom');
    d.moonFreq += 0.2 * rl(s, 'gild');

    const achN = Object.keys(s.ach).length;
    d.parts = {
      depth: Math.pow(ZONE_MULT, s.depth),
      upgrades: upgGlobal,
      achievements: 1 + 0.02 * achN,
      pearls: 1 + 0.02 * s.pearls,
      relic: Math.pow(1.25, rl(s, 'heart')),
      lantern: Math.pow(LANTERN_MULT, s.lantern.stage),
    };
    for (const k in d.parts) d.global *= d.parts[k];
    return d;
  }

  function creatureRate(s, d, i) { return d.base[i] * d.tierMult[i] * d.global; } // per creature
  function lpsBase(s, d) {
    let t = 0;
    for (let i = 0; i < N; i++) if (s.creatures[i]) t += creatureRate(s, d, i) * s.creatures[i];
    return t;
  }
  function buffMult(s, d) {
    let m = 1;
    if (s.buffs.bloom > 0) m *= d.bloomMult;
    if (s.buffs.frenzy > 0) m *= 5;
    return m;
  }
  function lps(s, d) { return lpsBase(s, d) * buffMult(s, d); }
  function clickValue(s, d, total) {
    let v = d.clickMult + (total === undefined ? lps(s, d) : total) * d.clickPct;
    if (s.buffs.hands > 0) v *= 10;
    return v;
  }

  // ---------------------------------------------------------------- buying
  function zoneOf(i) { return Math.floor(i / 2); }
  function creatureUnlocked(s, i) { return zoneOf(i) <= s.depth; }
  function bulkCost(s, d, i, amt) {
    const c = CREATURES[i].cost * d.costMult * Math.pow(COST_GROWTH, s.creatures[i]);
    return c * (Math.pow(COST_GROWTH, amt) - 1) / (COST_GROWTH - 1);
  }
  function maxAffordable(s, d, i) {
    const c = CREATURES[i].cost * d.costMult * Math.pow(COST_GROWTH, s.creatures[i]);
    if (s.lumen < c) return 0;
    return Math.floor(Math.log(s.lumen * (COST_GROWTH - 1) / c + 1) / Math.log(COST_GROWTH));
  }
  function buyCreature(s, i, amt) {
    if (!creatureUnlocked(s, i) || amt <= 0) return 0;
    const d = derive(s);
    const cost = bulkCost(s, d, i, amt);
    if (cost > s.lumen * (1 + 1e-9)) return 0;
    s.lumen = Math.max(0, s.lumen - cost);
    s.creatures[i] += amt;
    return amt;
  }
  function upgradeVisible(s, u) {
    if (s.upgrades[u.id]) return false;
    if ((u.kind === 'tier' || u.kind === 'chain') && !creatureUnlocked(s, u.tier)) return false;
    return u.req(s);
  }
  function buyUpgrade(s, id) {
    const u = UPG[id];
    if (!u || s.upgrades[id] || !u.req(s) || s.lumen < u.cost) return false;
    s.lumen -= u.cost;
    s.upgrades[id] = 1;
    return true;
  }
  function canDescend(s) { return s.depth < ZONES.length - 1 && s.lumen >= ZONES[s.depth + 1].cost; }
  function descend(s) {
    if (!canDescend(s)) return false;
    s.lumen -= ZONES[s.depth + 1].cost;
    s.depth++;
    s.maxDepth = Math.max(s.maxDepth, s.depth);
    if (s.depth >= 3 && s.stats.runTime < 1200) s.stats.flags.fastAbyss = 1;
    return true;
  }

  // ---------------------------------------------------------------- prestige
  const PEARL_DIV = 1e10;
  function pearlsFor(s, earned) {
    return Math.floor(Math.cbrt(earned / PEARL_DIV) * (1 + 0.1 * rl(s, 'diver')));
  }
  function pendingPearls(s) { return pearlsFor(s, s.runEarned); }
  function prestige(s) {
    const p = pendingPearls(s);
    if (p < 1) return 0;
    s.pearls += p;
    s.pearlsEarned += p;
    s.stats.prestiges++;
    s.stats.bestRunPearls = Math.max(s.stats.bestRunPearls, p);
    if (!s.stats.fastestRun || s.stats.runTime < s.stats.fastestRun) s.stats.fastestRun = s.stats.runTime;
    resetRun(s);
    return p;
  }
  function resetRun(s) {
    s.creatures = new Array(N).fill(0);
    s.upgrades = {};
    s.depth = Math.min(rl(s, 'memory'), ZONES.length - 1);
    s.maxDepth = Math.max(s.maxDepth, s.depth);
    s.lumen = startGlow(rl(s, 'seed'));
    s.runEarned = 0;
    s.resonance = 0;
    s.buffs = { bloom: 0, frenzy: 0, hands: 0 };
    s.echoAcc = 0;
    s.stats.runTime = 0;
  }
  function buyRelic(s, id) {
    const r = RELIC[id], l = rl(s, id);
    if (!r || l >= r.max) return false;
    const c = relicCost(r, l);
    if (s.pearls < c) return false;
    s.pearls -= c;
    s.relics[id] = l + 1;
    if (id === 'memory' && s.depth < l + 1) { s.depth = l + 1; s.maxDepth = Math.max(s.maxDepth, s.depth); }
    return true;
  }

  // ---------------------------------------------------------------- lantern
  function lanternOpen(s) { return s.depth >= ZONES.length - 1 && s.lantern.stage < LANTERN.length; }
  function feedLantern(s, amount) {
    if (!lanternOpen(s)) return 0;
    const st = LANTERN[s.lantern.stage];
    amount = Math.min(amount, s.lumen, st.cost - s.lantern.fill);
    if (amount <= 0) return 0;
    s.lumen -= amount;
    s.lantern.fill += amount;
    if (s.lantern.fill >= st.cost * (1 - 1e-9)) {
      s.lantern.stage++;
      s.lantern.fill = 0;
      if (s.lantern.stage >= LANTERN.length) s.victory = true;
      return 2; // stage complete
    }
    return 1;
  }

  // ---------------------------------------------------------------- active play
  function gain(s, v) { s.lumen += v; s.runEarned += v; s.totalEarned += v; }
  function pulse(s, d, echo) {
    const v = clickValue(s, d);
    gain(s, v);
    if (!echo) { s.stats.clicks++; s.idleClick = 0; s.stats.totalClickLumen += v; }
    let bloomed = false;
    if (s.buffs.bloom <= 0) {
      s.resonance += (echo ? 0.2 : 0.8) * d.resRate;
      if (s.resonance >= 100) { bloomed = true; startBloom(s, d); }
    }
    return { v, bloomed };
  }
  function startBloom(s, d) {
    s.resonance = 0;
    s.buffs.bloom = d.bloomDur;
    s.stats.blooms++;
    if (s.buffs.frenzy > 0) s.stats.flags.doubleBuff = 1;
  }

  const MOON_EFFECTS = [
    { id: 'cache', w: 40, name: 'Lumen Cache' },
    { id: 'frenzy', w: 35, name: 'Spawning Frenzy' },
    { id: 'hands', w: 15, name: 'Bright Hands' },
    { id: 'bloom', w: 10, name: 'Sudden Bloom' },
  ];
  function catchMoon(s, d, rnd) {
    if (!s.moon) return null;
    s.moon = null;
    s.stats.moons++;
    let r = (rnd === undefined ? Math.random() : rnd) * 100, eff = MOON_EFFECTS[0];
    for (const e of MOON_EFFECTS) { if (r < e.w) { eff = e; break; } r -= e.w; }
    const out = { id: eff.id, name: eff.name, text: '' };
    if (eff.id === 'cache') {
      const v = lpsBase(s, d) * 480 * d.moonPower + 50;
      gain(s, v);
      out.value = v;
      out.text = `+${fmt(v)} lumen`;
    } else if (eff.id === 'frenzy') {
      s.buffs.frenzy = 40 * d.moonPower;
      if (s.buffs.bloom > 0) s.stats.flags.doubleBuff = 1;
      out.text = `Production ×5 for ${Math.round(s.buffs.frenzy)}s`;
    } else if (eff.id === 'hands') {
      s.buffs.hands = 15 * d.moonPower;
      out.text = `Pulses ×10 for ${Math.round(s.buffs.hands)}s`;
    } else {
      startBloom(s, d);
      out.text = `Bloom! ×${d.bloomMult} for ${d.bloomDur}s`;
    }
    return out;
  }

  // ---------------------------------------------------------------- tick
  // Advances the simulation. Returns a list of events for the UI.
  function tick(s, dt, rnd) {
    rnd = rnd || Math.random;
    const ev = [];
    let d = derive(s);
    const p = lps(s, d);
    gain(s, p * dt);
    if (p > s.stats.maxLps) s.stats.maxLps = p;
    s.stats.playTime += dt;
    s.stats.runTime += dt;
    s.idleClick += dt;

    for (const k in s.buffs) if (s.buffs[k] > 0) s.buffs[k] = Math.max(0, s.buffs[k] - dt);
    if (s.idleClick > 6 && s.buffs.bloom <= 0 && s.resonance > 0) s.resonance = Math.max(0, s.resonance - 2 * dt);

    // echoes (automatic pulses)
    if (d.echoRate > 0) {
      s.echoAcc += d.echoRate * dt;
      let n = Math.floor(s.echoAcc);
      s.echoAcc -= n;
      const maxEcho = Math.min(n, 20); // cap per tick; extra are folded into value
      for (let k = 0; k < maxEcho; k++) {
        const r = pulse(s, d, true);
        if (r.bloomed) ev.push({ type: 'bloom' });
        ev.push({ type: 'echo', v: r.v });
      }
      if (n > maxEcho) gain(s, clickValue(s, d) * (n - maxEcho));
    }

    // moon pearl jelly
    if (s.moon) {
      s.moon.life -= dt;
      if (s.moon.life <= 0) { s.moon = null; ev.push({ type: 'moonGone' }); }
    } else {
      s.moonTimer -= dt;
      if (s.moonTimer <= 0) {
        const life = 13 * d.moonStay;
        s.moon = { life, max: life, seed: rnd() };
        s.moonTimer = (60 + rnd() * 90) / d.moonFreq;
        ev.push({ type: 'moon' });
      }
    }
    return ev;
  }

  // ---------------------------------------------------------------- achievements
  const ACHIEVEMENTS = [];
  const A = (id, name, desc, check, secret) => ACHIEVEMENTS.push({ id, name, desc, check, secret: !!secret });
  [[100, 'First Light'], [1e4, 'A Faint Glow'], [1e6, 'Lamplighter'], [1e8, 'Beacon'], [1e10, 'Lighthouse of the Deep'],
    [1e12, 'Aurora Below'], [1e15, 'Second Sun'], [1e18, 'Stellar Abyss'], [1e21, 'Galactic Trench'],
    [1e24, 'Light Unending']].forEach(([v, n], k) =>
    A(`earn${k}`, n, `Earn ${fmt(v)} lumen in total.`, s => s.totalEarned >= v));
  [[10, 'Flicker'], [1e3, 'Steady Glow'], [1e5, 'Floodlight'], [1e7, 'Searchlight'], [1e9, 'Lightning in a Bottle'],
    [1e12, 'Supernova Reef'], [1e15, 'Quasar Current'], [1e18, 'Brighter Than Day']].forEach(([v, n], k) =>
    A(`lps${k}`, n, `Reach ${fmt(v)} lumen per second.`, s => s.stats.maxLps >= v));
  CREATURES.forEach((c, i) => {
    A(`c50_${i}`, `${c.short} Shoal`, `Own 50 ${c.name}.`, s => s.creatures[i] >= 50);
    A(`c150_${i}`, `${c.short} Legion`, `Own 150 ${c.name}.`, s => s.creatures[i] >= 150);
  });
  [[100, 'Tapping the Glass'], [1000, 'Pulse Pounder'], [10000, 'Living Metronome']].forEach(([v, n], k) =>
    A(`clk${k}`, n, `Pulse ${fmt(v)} times by hand.`, s => s.stats.clicks >= v));
  [[1, 'First Bloom'], [25, 'Bloom Season'], [150, 'Perpetual Spring']].forEach(([v, n], k) =>
    A(`blm${k}`, n, `Trigger ${v} Bloom${v > 1 ? 's' : ''}.`, s => s.stats.blooms >= v));
  [[1, 'Moon Catcher'], [10, 'Pearl Hunter'], [50, 'Tidemaster']].forEach(([v, n], k) =>
    A(`mn${k}`, n, `Catch ${v} Moon Pearl Jell${v > 1 ? 'ies' : 'y'}.`, s => s.stats.moons >= v));
  ZONES.forEach((z, k) => { if (k) A(`z${k}`, `Into the ${z.name.replace(/^The /, '')}`, `Descend to the ${z.name}.`, s => s.maxDepth >= k); });
  [[1, 'Surfacing'], [3, 'Diving Rhythm'], [10, 'Tide Itself']].forEach(([v, n], k) =>
    A(`pr${k}`, n, `Return to the surface ${v} time${v > 1 ? 's' : ''}.`, s => s.stats.prestiges >= v));
  [[100, 'String of Pearls'], [2500, 'Pearl Hoard']].forEach(([v, n], k) =>
    A(`pe${k}`, n, `Earn ${fmt(v)} pearls in total.`, s => s.pearlsEarned >= v));
  LANTERN.forEach((l, k) => A(`ln${k}`, l.name, `Complete stage ${k + 1} of the Great Lantern.`, s => s.lantern.stage > k));
  [[25, 'Tinkerer'], [75, 'Bioengineer'], [150, 'Architect of Light']].forEach(([v, n], k) =>
    A(`up${k}`, n, `Own ${v} upgrades in a single dive.`, s => Object.keys(s.upgrades).length >= v));
  A('fast', 'Deep Breath', 'Reach the Abyssal Plain within 20 minutes of a dive.', s => !!s.stats.flags.fastAbyss, true);
  A('away', 'Welcome Back', 'Earn lumen while away.', s => s.stats.offlineGain > 0, true);
  A('dbl', 'Double Tide', 'Have a Bloom and a Spawning Frenzy active at once.', s => !!s.stats.flags.doubleBuff, true);
  A('all', 'Full Spectrum', 'Own at least one of every creature.', s => s.creatures.every(c => c > 0), true);
  A('hoard', 'Dragon of the Deep', 'Hold 1e15 unspent lumen.', s => s.lumen >= 1e15, true);

  function checkAchievements(s) {
    const got = [];
    for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.check(s)) { s.ach[a.id] = Date.now(); got.push(a); }
    return got;
  }

  const api = {
    VERSION, COST_GROWTH, CREATURES, N, ZONES, ZONE_MULT, UPGRADES, UPG, RELICS, RELIC, LANTERN, LANTERN_MULT,
    ACHIEVEMENTS, MOON_EFFECTS,
    fmt, fmtPlain, fmtTime, setNotation,
    newState, hydrate, derive, creatureRate, lpsBase, lps, buffMult, clickValue,
    creatureUnlocked, zoneOf, bulkCost, maxAffordable, buyCreature, upgradeVisible, buyUpgrade, canDescend, descend,
    pearlsFor, pendingPearls, prestige, relicCost, buyRelic, startGlow,
    lanternOpen, feedLantern, pulse, catchMoon, tick, checkAchievements, gain,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
