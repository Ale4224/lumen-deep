// Balance simulator: plays Lumen Deep with a greedy bot and prints a progression timeline.
// usage: node tools/sim.js [hours=12] [clicksPerSec=3] [moonCatchRate=0.7]
const C = require('../js/core.js');
const HOURS = +process.argv[2] || 12;
const CPS = process.argv[3] !== undefined ? +process.argv[3] : 3;
const CATCH = process.argv[4] !== undefined ? +process.argv[4] : 0.7;
const MODE = process.argv[5] || 'double';

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const s = C.newState();
const log = (t, msg) => console.log(`${C.fmtTime(t).padStart(8)}  ${msg}`);
let bestRate = 0, catchThis = false;
const UTIL = { cache: 0 };

function bestCandidate(d) {
  const base = C.lpsBase(s, d);
  let best = null;
  const consider = (score, cost, act, label) => { if (!best || score < best.score) best = { score, cost, act, label }; };
  for (let i = 0; i < C.N; i++) {
    if (!C.creatureUnlocked(s, i)) continue;
    const cost = C.bulkCost(s, d, i, 1);
    s.creatures[i]++;
    const gain = C.lpsBase(s, C.derive(s)) - base;
    s.creatures[i]--;
    if (gain <= 0) continue;
    consider(cost / Math.max(base, 1) + cost / gain, cost, () => C.buyCreature(s, i, 1), C.CREATURES[i].short);
  }
  for (const u of C.UPGRADES) {
    if (!C.upgradeVisible(s, u)) continue;
    if (['tier', 'chain', 'swarm', 'global'].includes(u.kind)) {
      s.upgrades[u.id] = 1;
      const gain = C.lpsBase(s, C.derive(s)) - base;
      delete s.upgrades[u.id];
      if (gain <= 0) continue;
      consider(u.cost / Math.max(base, 1) + u.cost / gain, u.cost, () => C.buyUpgrade(s, u.id), u.name);
    } else if (u.cost <= s.lumen && u.cost < Math.max(base, 1) * 90) {
      C.buyUpgrade(s, u.id); // cheap utility upgrades: just buy
    }
  }
  return best;
}

function buyRelics() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of C.RELICS) {
      const l = s.relics[r.id] || 0;
      if (l >= r.max) continue;
      const c = C.relicCost(r, l);
      if (c > s.pearls) continue;
      let ok;
      if (r.id === 'heart') ok = 1.25 * (1 + 0.02 * (s.pearls - c)) > 1 + 0.02 * s.pearls;
      else if (r.id === 'hull' || r.id === 'gild') ok = c <= s.pearls * 0.1;
      else ok = c <= s.pearls * 0.3;
      if (ok) { C.buyRelic(s, r.id); changed = true; }
    }
  }
}

const marks = new Set();
let nextReport = 0;
for (let t = 0; t < HOURS * 3600; t++) {
  const ev = C.tick(s, 1, rnd);
  if (ev.some(e => e.type === 'moon')) catchThis = rnd() < CATCH;
  let d = C.derive(s);
  if (s.moon && catchThis && s.moon.life < s.moon.max - 2) { const r = C.catchMoon(s, d, rnd()); UTIL[r.id] = (UTIL[r.id] || 0) + 1; }
  for (let k = 0; k < CPS; k++) C.pulse(s, d, false);

  for (let n = 0; n < 200; n++) {
    d = C.derive(s);
    if (C.canDescend(s)) { C.descend(s); log(t, `→ zone ${s.depth} ${C.ZONES[s.depth].name}  (run ${C.fmtTime(s.stats.runTime)}, lps ${C.fmt(C.lpsBase(s, C.derive(s)))})`); continue; }
    const b = bestCandidate(d);
    if (b && b.cost <= s.lumen) { b.act(); continue; }
    break;
  }
  if (C.lanternOpen(s)) {
    const before = s.lantern.stage;
    C.feedLantern(s, C.lps(s, C.derive(s)) * 0.5);
    if (s.lantern.stage > before) log(t, `★ LANTERN stage ${s.lantern.stage} complete`);
  }
  for (const a of C.checkAchievements(s)) if (!marks.has(a.id)) marks.add(a.id);

  // prestige heuristic: pearls/sec of this run has peaked
  const pend = C.pendingPearls(s);
  if (pend >= 1 && s.stats.runTime > 300) {
    const rate = pend / s.stats.runTime;
    if (rate > bestRate) bestRate = rate;
    else if (MODE === 'rate' ? (rate < bestRate * 0.85 && (pend >= 0.5 * s.pearlsEarned || s.stats.runTime > 4 * 3600)) : (pend >= Math.max(20, 1.5 * s.pearlsEarned) && s.stats.runTime > 1800)) {
      const lp = C.lpsBase(s, C.derive(s));
      const got = C.prestige(s);
      buyRelics();
      log(t, `⟳ PRESTIGE #${s.stats.prestiges}: +${got} pearls (have ${s.pearls}, relics ${JSON.stringify(s.relics)}) lps was ${C.fmt(lp)}`);
      bestRate = 0;
    }
  }
  if (t >= nextReport) {
    const d2 = C.derive(s);
    log(t, `lumen ${C.fmt(s.lumen)}  lps ${C.fmt(C.lpsBase(s, d2))}  depth ${s.depth}  cr [${s.creatures.join(',')}]  upg ${Object.keys(s.upgrades).length}  ach ${Object.keys(s.ach).length}  pend ${pend}`);
    nextReport = t < 3600 ? t + 600 : t + 3600;
  }
  if (s.victory && !marks.has('victory')) { marks.add('victory'); log(t, '=== VICTORY ==='); }
}
console.log('moon effects', UTIL, 'achievements', Object.keys(s.ach).length, '/', C.ACHIEVEMENTS.length, 'blooms', s.stats.blooms);
