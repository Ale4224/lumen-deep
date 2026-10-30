/* Lumen Deep — UI controller: loop, DOM panels, input, save/load. */
(function () {
  'use strict';
  const C = window.Core, Scene = window.Scene, Sfx = window.Sfx;
  const $ = id => document.getElementById(id);
  const fmt = (x, d) => C.fmt(x, d);
  const KEY = 'lumen-deep-save-v1';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  // ------------------------------------------------------------------ state
  let isNew = false;
  let S = load();
  let D = C.derive(S);
  let buyAmt = 1;
  let tab = 'creatures';
  let built = { key: null };
  const tabEls = {};

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return C.hydrate(JSON.parse(raw));
    } catch (e) { console.warn('save load failed', e); }
    isNew = true;
    return C.newState();
  }
  function save() {
    S.lastSave = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
  }
  function applySettings() {
    C.setNotation(S.settings.notation);
    Sfx.on = !!S.settings.sound;
    Scene.quality = S.settings.quality;
  }
  function refresh() { D = C.derive(S); }

  // ------------------------------------------------------------------ toasts / modal / tooltip
  function toast(title, body, color, ms) {
    const t = el('div', 'toast', `<b>${title}</b>${body ? `<span>${body}</span>` : ''}`);
    if (color) t.style.setProperty('--tc', color);
    $('toasts').appendChild(t);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms || 4200);
  }
  function modal(html, buttons, cls) {
    const body = $('modal-body');
    body.innerHTML = html;
    body.parentElement.className = 'modal-card ' + (cls || '');
    const row = el('div', 'btnrow');
    (buttons || [{ label: 'OK', primary: true }]).forEach(b => {
      const btn = el('button', 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), b.label);
      btn.onclick = () => { if (b.action && b.action() === false) return; closeModal(); };
      row.appendChild(btn);
    });
    body.appendChild(row);
    $('modal').classList.remove('hidden');
  }
  function closeModal() { $('modal').classList.add('hidden'); }
  $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal')) closeModal(); });

  const tip = $('tooltip');
  let tipTarget = null;
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip], .has-tip');
    tipTarget = t;
    if (!t) { tip.classList.add('hidden'); return; }
    const html = t._tip ? t._tip() : t.dataset.tip;
    if (!html) { tip.classList.add('hidden'); return; }
    tip.innerHTML = html;
    tip.classList.remove('hidden');
  });
  document.addEventListener('mousemove', e => {
    if (tip.classList.contains('hidden')) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 16, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 12;
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  // ------------------------------------------------------------------ tabs
  const TABS = [
    { id: 'creatures', label: 'Creatures', show: () => true, build: buildCreatures, update: updateCreatures },
    { id: 'evolve', label: 'Evolve', show: () => S.stats.clicks >= 10 || S.totalEarned > 40, build: buildEvolve, update: updateEvolve },
    { id: 'descend', label: 'Descend', show: () => S.totalEarned >= 400 || S.maxDepth > 0, build: buildDescend, update: updateDescend },
    { id: 'surface', label: 'Surface', show: () => S.maxDepth >= 3 || S.stats.prestiges > 0, build: buildSurface, update: updateSurface },
    { id: 'lantern', label: 'Lantern', show: () => S.maxDepth >= 5 || S.lantern.stage > 0, build: buildLantern, update: updateLantern },
    { id: 'records', label: 'Records', show: () => true, build: buildRecords, update: updateRecords },
    { id: 'options', label: 'Options', show: () => true, build: buildOptions, update: () => {} },
  ];
  const seen = new Set(JSON.parse(localStorage.getItem(KEY + '-tabs') || '["creatures","records","options"]'));

  function renderTabs() {
    const nav = $('tabs');
    const vis = TABS.filter(t => t.show());
    const key = vis.map(t => t.id).join();
    if (nav.dataset.key !== key) {
      nav.dataset.key = key;
      nav.innerHTML = '';
      for (const t of vis) {
        const b = el('button', 'tab', `${t.label}<span class="badge hidden"></span>`);
        b.onclick = () => selectTab(t.id);
        if (!seen.has(t.id)) {
          b.classList.add('new');
          if (S.stats.playTime > 2) toast(`New: ${t.label}`, tabHint(t.id), '#7ff9ff');
        }
        tabEls[t.id] = b;
        nav.appendChild(b);
      }
      if (!vis.find(t => t.id === tab)) tab = 'creatures';
    }
    for (const t of vis) tabEls[t.id].classList.toggle('active', t.id === tab);
  }
  function tabHint(id) {
    return {
      evolve: 'Upgrades that make your creatures glow brighter.',
      descend: 'Dive deeper to discover new creatures.',
      surface: 'Trade this dive for Pearls — permanent power.',
      lantern: 'Build the Great Lantern and light the abyss.',
    }[id] || '';
  }
  function selectTab(id) {
    tab = id;
    seen.add(id);
    localStorage.setItem(KEY + '-tabs', JSON.stringify([...seen]));
    if (tabEls[id]) tabEls[id].classList.remove('new');
    built.key = null;
    renderTabs();
    $('tab-body').scrollTop = 0;
  }
  function setBadge(id, val) {
    const b = tabEls[id]; if (!b) return;
    const badge = b.querySelector('.badge');
    if (!val) { badge.classList.add('hidden'); return; }
    badge.classList.remove('hidden');
    badge.classList.toggle('dot', val === true);
    badge.textContent = val === true ? '' : val;
  }
  function updateBadges() {
    let n = 0;
    for (const u of C.UPGRADES) if (C.upgradeVisible(S, u) && u.cost <= S.lumen) n++;
    setBadge('evolve', n > 0 ? (n > 99 ? '99+' : n) : 0);
    setBadge('descend', C.canDescend(S));
    const pend = C.pendingPearls(S);
    const relicAff = C.RELICS.some(r => (S.relics[r.id] || 0) < r.max && C.relicCost(r, S.relics[r.id] || 0) <= S.pearls);
    setBadge('surface', relicAff || (pend >= 1 && pend >= S.pearlsEarned));
    setBadge('lantern', C.lanternOpen(S) && S.lumen >= (C.LANTERN[S.lantern.stage].cost - S.lantern.fill) * 0.1);
  }

  function renderTab() {
    const t = TABS.find(x => x.id === tab);
    const key = tab + '|' + t.build.keyFn();
    if (built.key !== key) {
      const body = $('tab-body');
      const st = body.scrollTop;
      body.innerHTML = '';
      t.build(body);
      built.key = key;
      body.scrollTop = st;
    }
    t.update();
  }

  // ------------------------------------------------------------------ creatures tab
  let crows = [];
  buildCreatures.keyFn = () => `${S.depth}|${buyAmt}`;
  function buildCreatures(body) {
    const bar = el('div', 'toolbar');
    const seg = el('div', 'seg');
    [1, 10, 100, 'max'].forEach(a => {
      const b = el('button', a === buyAmt ? 'on' : '', a === 'max' ? 'Max' : '×' + a);
      b.onclick = () => { buyAmt = a; built.key = null; };
      seg.appendChild(b);
    });
    bar.appendChild(el('span', 'mini', 'Buy amount'));
    bar.appendChild(seg);
    body.appendChild(bar);
    crows = [];
    for (let i = 0; i < C.N; i++) {
      const zone = C.zoneOf(i);
      if (zone > S.depth + 1) break;
      const c = C.CREATURES[i], locked = zone > S.depth;
      const row = el('div', 'crow' + (locked ? ' locked' : ''));
      const cv = document.createElement('canvas');
      cv.width = cv.height = 104;
      window.drawCreatureIcon(cv, i, 0.5);
      row.appendChild(cv);
      const mid = el('div');
      if (locked) {
        mid.innerHTML = `<div class="cname">???</div><div class="cinfo">Lives in the <b>${C.ZONES[zone].name}</b> (${C.ZONES[zone].depth.toLocaleString()} m). Descend to discover it.</div>`;
        row.appendChild(mid);
        row.appendChild(el('div'));
        body.appendChild(row);
        continue;
      }
      mid.innerHTML = `<div class="cname">${c.name}<span class="ccount">0</span></div><div class="cinfo"></div><div class="cbar"><i style="background:${c.color}"></i></div><div class="next-ms"></div>`;
      row.appendChild(mid);
      const btn = el('button', 'buy', '');
      btn.onclick = () => buyC(i);
      row.appendChild(btn);
      row.dataset.tip = '1';
      row._tip = () => {
        const n = S.creatures[i], r = C.creatureRate(S, D, i);
        return `<b>${c.name}</b><i>${c.desc}</i><br><br>Each produces <b style="display:inline">${fmt(r)}</b>/s` +
          `<br>Upgrade multiplier: ×${fmt(D.tierMult[i])}` + (n ? `<br>Total: ${fmt(r * n)}/s` : '');
      };
      body.appendChild(row);
      crows[i] = { row, count: mid.querySelector('.ccount'), info: mid.querySelector('.cinfo'), bar: mid.querySelector('.cbar i'), ms: mid.querySelector('.next-ms'), btn };
    }
  }
  function amountFor(i) {
    if (buyAmt === 'max') return Math.max(1, C.maxAffordable(S, D, i));
    return buyAmt;
  }
  function buyC(i) {
    const n = C.buyCreature(S, i, amountFor(i));
    if (n) { Sfx.buy(); refresh(); }
  }
  function updateCreatures() {
    const total = C.lpsBase(S, D) || 1;
    for (let i = 0; i < C.N; i++) {
      const r = crows[i];
      if (!r) continue;
      const n = S.creatures[i], rate = C.creatureRate(S, D, i);
      r.count.textContent = n;
      const share = n * rate / total;
      r.info.innerHTML = `<b>${fmt(rate)}</b>/s each` + (n ? ` · <b>${fmt(rate * n)}</b>/s total · ${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%` : '');
      r.bar.style.width = (share * 100).toFixed(1) + '%';
      let next = null;
      for (const u of C.UPGRADES) if (u.kind === 'tier' && u.tier === i && !S.upgrades[u.id] && u.need > n) { next = u.need; break; }
      r.ms.textContent = next ? `Next evolution unlocks at ${next} owned` : '';
      const amt = amountFor(i), cost = C.bulkCost(S, D, i, amt);
      const label = `Buy ×${amt}<small>${fmt(cost)}</small>`;
      if (r.btn._l !== label) { r.btn.innerHTML = label; r.btn._l = label; }
      r.btn.disabled = cost > S.lumen;
    }
  }

  // ------------------------------------------------------------------ evolve tab
  const KIND_COLOR = { chain: '#6dffb5', swarm: '#7ff9ff', global: '#ffd36b', clickMult: '#9fd8ff', clickPct: '#9fd8ff',
    resRate: '#c49cff', bloomDur: '#c49cff', bloomMult: '#c49cff', echo: '#c49cff', moonFreq: '#ffe08a', moonStay: '#ffe08a', moonPower: '#ffe08a' };
  let ucards = [];
  function visibleUpgrades() { return C.UPGRADES.filter(u => C.upgradeVisible(S, u)).sort((a, b) => a.cost - b.cost); }
  buildEvolve.keyFn = () => visibleUpgrades().map(u => u.id).join();
  function buildEvolve(body) {
    const list = visibleUpgrades();
    const bar = el('div', 'toolbar');
    bar.appendChild(el('span', 'mini', `${Object.keys(S.upgrades).length} owned this dive`));
    const all = el('button', 'btn primary', 'Buy all affordable');
    all.onclick = buyAllUpgrades;
    bar.appendChild(all);
    body.appendChild(bar);
    if (!list.length) {
      body.appendChild(el('div', 'empty', 'No upgrades available right now.<br>Own more creatures, earn more lumen, or pulse more to reveal new ones.'));
      ucards = [];
      return;
    }
    const grid = el('div', 'ugrid');
    ucards = list.map(u => {
      const color = u.kind === 'tier' ? C.CREATURES[u.tier].color : KIND_COLOR[u.kind] || '#7ff9ff';
      const b = el('button', 'ucard', `<div class="un">${u.name}</div><div class="us">${u.sub}</div><div class="ud">${u.desc}</div><div class="uc">${fmt(u.cost)} lumen</div>`);
      b.style.setProperty('--kc', color);
      b.onclick = () => { if (C.buyUpgrade(S, u.id)) { Sfx.upgrade(); refresh(); } };
      grid.appendChild(b);
      return { u, b };
    });
    body.appendChild(grid);
  }
  function updateEvolve() {
    for (const { u, b } of ucards) {
      const ok = u.cost <= S.lumen;
      b.disabled = !ok;
      b.classList.toggle('afford', ok);
    }
  }
  function buyAllUpgrades() {
    let n = 0;
    for (const u of visibleUpgrades()) if (C.buyUpgrade(S, u.id)) n++;
    if (n) { Sfx.upgrade(); refresh(); toast(`Bought ${n} upgrade${n > 1 ? 's' : ''}`, '', '#6dffb5', 2000); }
  }

  // ------------------------------------------------------------------ descend tab
  let descendBtn = null;
  const ZONE_SWATCH = ['#2a8fb5', '#155a80', '#0b2147', '#1a1f4a', '#4a1830', '#3a1060'];
  buildDescend.keyFn = () => `${S.depth}`;
  function buildDescend(body) {
    body.appendChild(el('p', 'section-note', `Each zone deeper multiplies <b>all production by ×${C.ZONE_MULT}</b> and reveals two new creatures. Depth resets when you surface.`));
    descendBtn = null;
    C.ZONES.forEach((z, k) => {
      const cls = k < S.depth ? 'passed' : k === S.depth ? 'current' : k === S.depth + 1 ? 'next' : 'unknown';
      const box = el('div', 'zone ' + cls);
      const known = k <= S.depth + 1;
      const crs = [C.CREATURES[2 * k], C.CREATURES[2 * k + 1]];
      box.innerHTML = `<div class="zd">${z.depth.toLocaleString()} m</div><div><div class="zn">${known || S.maxDepth >= k ? z.name : '???'}</div>` +
        `<div class="zx">${known ? z.desc : 'Too deep to see.'}${known ? `<br>Home of: <b>${k <= S.depth || S.maxDepth >= k ? crs.map(c => c.name).join(', ') : '???, ???'}</b>` : ''}</div>` +
        `<div class="zone-swatch" style="background:linear-gradient(90deg, ${ZONE_SWATCH[k]}, transparent)"></div></div>`;
      if (k === S.depth + 1) {
        const b = el('button', 'buy pink big', '');
        b.onclick = doDescend;
        box.lastChild.appendChild(b);
        descendBtn = b;
      }
      body.appendChild(box);
    });
  }
  function updateDescend() {
    if (!descendBtn) return;
    const z = C.ZONES[S.depth + 1];
    const label = `Descend to ${z.depth.toLocaleString()} m<small>${fmt(z.cost)} lumen</small>`;
    if (descendBtn._l !== label) { descendBtn.innerHTML = label; descendBtn._l = label; }
    descendBtn.disabled = !C.canDescend(S);
  }
  function doDescend() {
    if (!C.descend(S)) return;
    refresh();
    Sfx.descend();
    const z = C.ZONES[S.depth];
    toast(`Descended: ${z.name}`, `${z.depth.toLocaleString()} m · production ×${C.ZONE_MULT} · new creatures discovered`, '#ff7ad9', 5000);
    flashZone();
    tickerNow();
  }

  // ------------------------------------------------------------------ surface tab (prestige + relics)
  let sEls = {};
  buildSurface.keyFn = () => `${S.stats.prestiges}|${JSON.stringify(S.relics)}`;
  function buildSurface(body) {
    sEls = {};
    body.appendChild(el('p', 'section-note', `Return to the surface to turn this dive into <b>Pearls</b>. You lose lumen, creatures, upgrades and depth — ` +
      `but keep pearls, relics, achievements and the Great Lantern. Pearls found grow with the <b>cube root</b> of lumen earned this dive.`));
    const card = el('div', 'prestige-card');
    card.innerHTML = `<div class="pl">Pearls waiting at the surface</div><div class="pp" id="s-pend">0</div><div class="pn" id="s-next"></div>`;
    const btn = el('button', 'buy gold big', 'Surface');
    btn.onclick = askPrestige;
    card.appendChild(btn);
    sEls.btn = btn;
    body.appendChild(card);
    body.appendChild(el('h3', '', 'Your pearls'));
    const st = el('div');
    st.innerHTML = `<div class="statline"><span>Pearls held</span><span id="s-have"></span></div>` +
      `<div class="statline"><span>Bonus from unspent pearls (+2% each)</span><span id="s-bonus"></span></div>` +
      `<div class="statline"><span>Total pearls ever found</span><span id="s-ever"></span></div>`;
    body.appendChild(st);
    body.appendChild(el('h3', '', 'Relics'));
    body.appendChild(el('p', 'section-note', 'Relics are permanent. Spending pearls removes their +2% bonus — choose wisely.'));
    const grid = el('div', 'rgrid');
    sEls.relics = C.RELICS.map(r => {
      const l = S.relics[r.id] || 0;
      const box = el('div', 'relic' + (l >= r.max ? ' maxed' : ''));
      box.innerHTML = `<div class="rn">${r.name}<span class="rl">${l}/${r.max}</span></div><div class="rd">${r.info}<br>` +
        `<span class="reff">${l ? r.eff(l) : 'not owned'}${l < r.max ? ` → <b>${r.eff(l + 1)}</b>` : ''}</span></div>`;
      const b = el('button', 'buy gold', '');
      b.onclick = () => { if (C.buyRelic(S, r.id)) { Sfx.upgrade(); refresh(); built.key = null; } };
      box.appendChild(b);
      grid.appendChild(box);
      return { r, b };
    });
    body.appendChild(grid);
  }
  function updateSurface() {
    const p = C.pendingPearls(S);
    $('s-pend').textContent = '+' + fmt(p);
    const mul = 1 + 0.1 * (S.relics.diver || 0);
    const needE = Math.pow((p + 1) / mul, 3) * 1e10;
    $('s-next').textContent = `Lumen earned this dive: ${fmt(S.runEarned)} · next pearl at ${fmt(needE)}`;
    sEls.btn.disabled = p < 1;
    sEls.btn.innerHTML = p < 1 ? `Surface<small>reach ${fmt(Math.pow(1 / mul, 3) * 1e10)} lumen this dive</small>` : `Surface for ${fmt(p)} pearl${p > 1 ? 's' : ''}<small>restart the dive · keep permanent progress</small>`;
    $('s-have').textContent = fmt(S.pearls);
    $('s-bonus').textContent = '×' + fmt(1 + 0.02 * S.pearls, 2);
    $('s-ever').textContent = fmt(S.pearlsEarned);
    for (const { r, b } of sEls.relics) {
      const l = S.relics[r.id] || 0;
      if (l >= r.max) { b.textContent = 'MAXED'; b.disabled = true; continue; }
      const c = C.relicCost(r, l);
      const label = `Buy · ${fmt(c)} pearl${c > 1 ? 's' : ''}`;
      if (b._l !== label) { b.textContent = label; b._l = label; }
      b.disabled = S.pearls < c;
    }
  }
  function askPrestige() {
    const p = C.pendingPearls(S);
    if (p < 1) return;
    const go = () => {
      C.prestige(S);
      refresh();
      Sfx.surface();
      Scene.burst(Scene.W / 2, Scene.H / 2, '#ffe08a', 90);
      toast(`Surfaced with ${fmt(p)} pearls`, 'A new dive begins.', '#ffd36b', 5000);
      built.key = null;
      flashZone();
      save();
    };
    if (!S.settings.confirmPrestige) return go();
    modal(`<h2>Return to the surface?</h2><div class="big-num">+${fmt(p)} <i class="pearl"></i></div>` +
      `<p>Your creatures, lumen, upgrades and depth will be lost. Pearls, relics, achievements and the Great Lantern stay forever.</p>` +
      `<p>After surfacing you'll hold <b>${fmt(S.pearls + p)}</b> pearls (production ×${fmt(1 + 0.02 * (S.pearls + p), 2)} before relics).</p>`,
    [{ label: 'Stay down here' }, { label: 'Surface', primary: true, action: go }]);
  }

  // ------------------------------------------------------------------ lantern tab
  let lEls = {};
  buildLantern.keyFn = () => `${S.lantern.stage}|${C.lanternOpen(S)}|${S.depth >= 5}`;
  function buildLantern(body) {
    lEls = {};
    body.appendChild(el('p', 'section-note', `At the bottom of the Hollow lies the frame of the <b>Great Lantern</b>. Pour lumen into it. ` +
      `Progress is <b>permanent</b> — it survives surfacing — and each finished stage multiplies all production by <b>×${C.LANTERN_MULT}</b> forever. Kindle all five to light the abyss.`));
    C.LANTERN.forEach((st, k) => {
      const cls = k < S.lantern.stage ? 'done' : k === S.lantern.stage ? 'cur' : '';
      const box = el('div', 'lstage ' + cls);
      box.innerHTML = `<div class="lnum">${k + 1}</div><div class="lbody"><div class="ln">${st.name}</div><div class="lc">${k < S.lantern.stage ? 'Complete · ×' + C.LANTERN_MULT : fmt(st.cost) + ' lumen'}</div></div>`;
      if (k === S.lantern.stage) {
        const pb = el('div', 'pbar', '<i></i>');
        box.querySelector('.lbody').appendChild(pb);
        const lc = el('div', 'lc', '');
        box.querySelector('.lbody').appendChild(lc);
        lEls.bar = pb.firstChild; lEls.txt = lc;
      }
      body.appendChild(box);
    });
    if (S.lantern.stage >= C.LANTERN.length) {
      body.appendChild(el('div', 'empty', '✦ The Great Lantern burns. The abyss is lit. ✦<br><br>You may keep diving for as long as you like.'));
      return;
    }
    if (S.depth < C.ZONES.length - 1) {
      body.appendChild(el('div', 'empty', `The lantern can only be fed from <b>The Hollow</b>.<br>Descend there in this dive to continue building.`));
      return;
    }
    const row = el('div', 'feed-row');
    lEls.btns = [[0.1, 'Feed 10%'], [0.5, 'Feed 50%'], [1, 'Feed all']].map(([f, label]) => {
      const b = el('button', 'buy gold', label);
      b.onclick = () => feed(f);
      row.appendChild(b);
      return b;
    });
    body.appendChild(row);
  }
  function feed(f) {
    const r = C.feedLantern(S, S.lumen * f);
    if (!r) return;
    if (r === 2) {
      refresh();
      Sfx.lantern();
      const k = S.lantern.stage;
      toast(`Lantern stage complete: ${C.LANTERN[k - 1].name}`, `All production ×${C.LANTERN_MULT}, forever.`, '#ffd36b', 6000);
      Scene.burst(Scene.W / 2, Scene.H * 0.7, '#ffe08a', 120);
      built.key = null;
      save();
    } else Sfx.buy();
  }
  function updateLantern() {
    if (!lEls.bar) return;
    const st = C.LANTERN[S.lantern.stage];
    lEls.bar.style.width = (S.lantern.fill / st.cost * 100).toFixed(2) + '%';
    lEls.txt.textContent = `${fmt(S.lantern.fill)} / ${fmt(st.cost)} · ${(S.lantern.fill / st.cost * 100).toFixed(1)}%`;
    if (lEls.btns) lEls.btns.forEach(b => { b.disabled = S.lumen <= 0; });
  }

  // ------------------------------------------------------------------ records tab
  let rEls = {};
  buildRecords.keyFn = () => Object.keys(S.ach).length;
  function buildRecords(body) {
    rEls = {};
    body.appendChild(el('h3', '', 'Multipliers'));
    rEls.mult = el('div'); body.appendChild(rEls.mult);
    body.appendChild(el('h3', '', 'Statistics'));
    rEls.stats = el('div'); body.appendChild(rEls.stats);
    const n = Object.keys(S.ach).length;
    body.appendChild(el('h3', '', `Achievements — ${n} / ${C.ACHIEVEMENTS.length} (+${n * 2}% production)`));
    const grid = el('div', 'agrid');
    for (const a of C.ACHIEVEMENTS) {
      const got = !!S.ach[a.id];
      const t = el('div', 'ach' + (got ? ' got' : '') + (a.secret ? ' secret' : ''), got ? '✦' : a.secret ? '?' : '✧');
      t.dataset.tip = got || !a.secret ? `<b>${a.name}</b>${a.desc}${got ? '' : '<br><i>Locked</i>'}` : '<b>Secret</b><i>Keep exploring…</i>';
      grid.appendChild(t);
    }
    body.appendChild(grid);
  }
  function updateRecords() {
    const P = D.parts;
    const lines = [
      ['Depth', P.depth], ['Biochemistry upgrades', P.upgrades], ['Achievements', P.achievements],
      ['Unspent pearls', P.pearls], ['Lantern Heart relic', P.relic], ['Great Lantern', P.lantern],
    ];
    const b = C.buffMult(S, D);
    let html = lines.map(([k, v]) => `<div class="statline"><span>${k}</span><span>×${fmt(v, 2)}</span></div>`).join('');
    if (b > 1) html += `<div class="statline"><span>Active buffs</span><span>×${fmt(b)}</span></div>`;
    html += `<div class="statline"><span><b style="color:#fff">Global multiplier</b></span><span><b>×${fmt(D.global * b, 2)}</b></span></div>`;
    rEls.mult.innerHTML = html;
    const st = S.stats;
    const rows = [
      ['Lumen this dive', fmt(S.runEarned)], ['Lumen all time', fmt(S.totalEarned)], ['Best lumen/sec', fmt(st.maxLps)],
      ['Pulse value', fmt(C.clickValue(S, D))], ['Hand pulses', fmt(st.clicks)], ['Lumen from pulses', fmt(st.totalClickLumen)],
      ['Echoes per second', fmt(D.echoRate)], ['Blooms', fmt(st.blooms)], ['Moon Pearl Jellies caught', fmt(st.moons)],
      ['Surfacings', fmt(st.prestiges)], ['Fastest dive', st.fastestRun ? C.fmtTime(st.fastestRun) : '—'],
      ['Current dive', C.fmtTime(st.runTime)], ['Time played', C.fmtTime(st.playTime)],
      ['Lumen earned offline', fmt(st.offlineGain)], ['Offline efficiency', Math.round(D.offlineEff * 100) + '% up to ' + (D.offlineCap / 3600) + 'h'],
    ];
    rEls.stats.innerHTML = rows.map(([k, v]) => `<div class="statline"><span>${k}</span><span>${v}</span></div>`).join('');
  }

  // ------------------------------------------------------------------ options tab
  buildOptions.keyFn = () => JSON.stringify(S.settings);
  function buildOptions(body) {
    const opt = (label, sub, choices, key) => {
      const row = el('div', 'opt', `<div>${label}<small>${sub}</small></div>`);
      const seg = el('div', 'seg');
      for (const [v, l] of choices) {
        const b = el('button', S.settings[key] === v ? 'on' : '', l);
        b.onclick = () => { S.settings[key] = v; applySettings(); built.key = null; save(); };
        seg.appendChild(b);
      }
      row.appendChild(seg);
      body.appendChild(row);
    };
    opt('Number format', 'How big numbers are written', [['short', '1.5M'], ['sci', '1.5e6']], 'notation');
    opt('Sound', 'Soft synthesized chimes', [[true, 'On'], [false, 'Off']], 'sound');
    opt('Graphics', 'Lower this if the scene stutters', [['high', 'High'], ['low', 'Low']], 'quality');
    opt('Confirm surfacing', 'Ask before trading a dive for pearls', [[true, 'On'], [false, 'Off']], 'confirmPrestige');
    const row = el('div', 'btnrow');
    const mk = (label, cls, fn) => { const b = el('button', 'btn ' + cls, label); b.onclick = fn; row.appendChild(b); };
    mk('Save now', 'primary', () => { save(); toast('Game saved', '', '#6dffb5', 1600); });
    mk('Export save', '', () => {
      const str = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      modal(`<h2>Export save</h2><p>Copy this text somewhere safe.</p><textarea readonly id="exp">${str}</textarea>`,
        [{ label: 'Copy', action: () => { navigator.clipboard && navigator.clipboard.writeText(str); toast('Copied to clipboard', '', '#6dffb5', 1600); } }, { label: 'Close', primary: true }]);
      setTimeout(() => { const t = $('exp'); if (t) t.select(); }, 30);
    });
    mk('Import save', '', () => {
      modal(`<h2>Import save</h2><p>Paste an exported save. This replaces your current game.</p><textarea id="imp"></textarea>`,
        [{ label: 'Cancel' }, { label: 'Import', primary: true, action: () => {
          try {
            const obj = JSON.parse(decodeURIComponent(escape(atob($('imp').value.trim()))));
            S = C.hydrate(obj); refresh(); applySettings(); built.key = null; save();
            toast('Save imported', '', '#6dffb5');
          } catch (e) { toast('Import failed', 'That text is not a valid save.', '#ff6b8a'); return false; }
        } }]);
    });
    mk('How to play', '', showHelp);
    mk('Hard reset', 'danger', () => {
      modal(`<h2>Erase everything?</h2><p>This deletes your save, pearls, relics, achievements and the Great Lantern. There is no undo.</p>`,
        [{ label: 'Cancel', primary: true }, { label: 'Erase my game', danger: true, action: () => {
          localStorage.removeItem(KEY); localStorage.removeItem(KEY + '-tabs');
          S = C.newState(); refresh(); applySettings(); built.key = null; seen.clear(); ['creatures', 'records', 'options'].forEach(x => seen.add(x));
          Scene.actors = C.CREATURES.map(() => []); $('tabs').dataset.key = ''; save(); showHelp();
        } }]);
    });
    body.appendChild(row);
    body.appendChild(el('p', 'section-note', '<br>Lumen Deep autosaves every 15 seconds and when you close the tab. Progress continues while you are away (at reduced efficiency).'));
  }

  function showHelp() {
    modal(`<h2>Lumen Deep</h2>
      <p>You are a spark of living light at the top of a very deep ocean. Grow a glowing reef and sink into the dark.</p>
      <ul>
        <li><b>Click the water</b> to pulse light and earn lumen.</li>
        <li>Spend lumen on <b>creatures</b> — they glow for you, even while you're away.</li>
        <li><b>Evolve</b> them with upgrades, and <b>Descend</b> to find new species.</li>
        <li>Pulsing by hand fills <b>Resonance</b>. When full, your reef <b>Blooms</b> for a big boost.</li>
        <li>Catch the golden <b>Moon Pearl Jellies</b> that drift by for gifts.</li>
        <li>Later, <b>Surface</b> to trade a dive for Pearls and permanent Relics.</li>
        <li>Your final goal: kindle the <b>Great Lantern</b> at the bottom of the Hollow.</li>
      </ul>`, [{ label: 'Dive in', primary: true }]);
  }

  // ------------------------------------------------------------------ HUD
  const ZONE_POS = C.ZONES.map(z => Math.sqrt(z.depth / C.ZONES[C.ZONES.length - 1].depth));
  function buildDepthMeter() {
    const box = $('dm-ticks');
    box.innerHTML = '';
    C.ZONES.forEach((z, k) => {
      const t = el('div', 'dm-tick', `${z.depth.toLocaleString()} m`);
      t.style.top = (ZONE_POS[k] * 100) + '%';
      t.dataset.k = k;
      box.appendChild(t);
    });
  }
  function updateDepthMeter() {
    const p = ZONE_POS[S.depth] * 100;
    $('dm-marker').style.top = p + '%';
    $('dm-fill').style.height = p + '%';
    for (const t of $('dm-ticks').children) t.classList.toggle('reached', +t.dataset.k <= S.depth);
    const z = C.ZONES[S.depth];
    $('zone-name').textContent = z.name;
    $('zone-depth').textContent = z.depth.toLocaleString() + ' m';
  }
  function flashZone() {
    const zt = $('zone-title');
    zt.classList.remove('flash'); void zt.offsetWidth; zt.classList.add('flash');
  }

  let lastBuffKey = '';
  function updateHud() {
    $('lumen').textContent = fmt(S.lumen);
    const l = C.lps(S, D);
    $('lps').textContent = fmt(l);
    const bm = C.buffMult(S, D);
    $('lps-mult').textContent = bm > 1 ? `×${fmt(bm)}` : '';
    const chips = [];
    if (S.buffs.frenzy > 0) chips.push(['frenzy', `Spawning Frenzy ×5 · ${Math.ceil(S.buffs.frenzy)}s`]);
    if (S.buffs.hands > 0) chips.push(['hands', `Bright Hands ×10 pulses · ${Math.ceil(S.buffs.hands)}s`]);
    const key = chips.map(c => c[0]).join();
    if (key !== lastBuffKey) {
      lastBuffKey = key;
      $('buffs').innerHTML = chips.map(([c]) => `<span class="buff ${c}"></span>`).join('');
    }
    const spans = $('buffs').children;
    chips.forEach(([, t], k) => { if (spans[k].textContent !== t) spans[k].textContent = t; });
    const res = $('res');
    if (S.buffs.bloom > 0) {
      res.classList.add('blooming');
      $('res-fill').style.width = (S.buffs.bloom / D.bloomDur * 100) + '%';
      $('res-label').textContent = 'Blooming';
      $('res-pct').textContent = Math.ceil(S.buffs.bloom) + 's';
    } else {
      res.classList.remove('blooming');
      $('res-fill').style.width = Math.min(100, S.resonance) + '%';
      $('res-label').textContent = 'Resonance';
      $('res-pct').textContent = Math.floor(S.resonance) + '%';
    }
    $('pearl-chip').classList.toggle('hidden', !(S.pearlsEarned > 0));
    $('pearl-count').textContent = fmt(S.pearls);
  }

  // ------------------------------------------------------------------ ticker
  const TICK = [
    ['Sunlight ripples overhead. Your glow is barely noticeable.', 'A curious fish nibbles at your plankton, then thinks better of it.', 'The surface is so close. Not for long.', 'Gulls cry somewhere far above.'],
    ['The light fades to indigo.', 'Your comb jellies throw rainbows nobody can see.', 'Something large passes overhead, blotting out the last of the sun.', 'Lanternfish migrate past, glancing at your shrimp with professional envy.'],
    ['Total darkness. Every light here is alive.', 'An anglerfish mistakes your pulse for a mate. Awkward.', 'The pressure would crush a submarine. Your jellies do not mind.', 'A siphonophore drifts by, forty metres of festival lights.'],
    ['Silt drifts like snow on a windless night.', 'The plain stretches forever in every direction.', 'Sonar reports: nothing. Then: something.', 'A vampire squid turns inside out. It is fine. It meant to do that.'],
    ['The vents sing in a key older than whales.', 'Sulfur and heat. Life thrives anyway.', 'The trench walls glitter with your colonies.', 'Your coral dreams of a sun it has never seen.'],
    ['Below the bottom, the water hums.', 'The Hollow Heart beats, and the sea brightens.', 'They say the Great Lantern could light the whole ocean.', 'A Tidewyrm coils past. It is in three trenches at once.'],
  ];
  const TIPS = [
    'Tip: pulsing by hand builds Resonance. A full bar makes your reef Bloom.',
    'Tip: golden Moon Pearl Jellies drift by now and then — click them!',
    'Tip: Food Web upgrades let predators feed on the creatures below them.',
    `Tip: every zone deeper multiplies all production by ×${C.ZONE_MULT}.`,
    'Tip: hover a creature to see exactly how much it produces.',
    'Tip: unspent pearls boost production by +2% each. Relics are often worth more.',
  ];
  let tickerT = 0;
  function tickerNow() { tickerT = 999; }
  function updateTicker(dt) {
    tickerT += dt;
    if (tickerT < 14) return;
    tickerT = 0;
    let pool = TICK[S.depth].slice();
    if (S.stats.playTime < 3600 || Math.random() < 0.25) pool = pool.concat(TIPS.slice(0, S.stats.prestiges ? 6 : 5));
    if (S.victory) pool.push('The abyss is lit. Somewhere above, the moon looks down, confused.', 'Fish who have never seen light are holding a meeting about it.');
    const t = $('ticker-text');
    t.style.opacity = 0;
    setTimeout(() => { t.textContent = pool[(Math.random() * pool.length) | 0]; t.style.opacity = 1; }, 600);
  }

  // ------------------------------------------------------------------ input
  const canvas = $('scene');
  canvas.addEventListener('pointerdown', e => {
    Sfx.unlock();
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.moon && Scene.moonHit(x, y)) {
      const out = C.catchMoon(S, D);
      refresh();
      Scene.burst(x, y, '#ffe08a', 50);
      Scene.pulse(x, y, out.text, true);
      Sfx.moon();
      toast(`Moon Pearl Jelly: ${out.name}`, out.text, '#ffe08a');
      if (out.id === 'bloom') onBloom();
      return;
    }
    const res = C.pulse(S, D, false);
    Scene.pulse(x, y, '+' + fmt(res.v));
    Sfx.pulse();
    if (res.bloomed) onBloom();
    if (S.stats.clicks >= 12) $('hint').classList.add('gone');
  });
  function onBloom() {
    Sfx.bloom();
    Scene.burst(Scene.W / 2, Scene.H / 2, '#c49cff', 70);
    toast('Bloom!', `Production ×${D.bloomMult} for ${Math.round(S.buffs.bloom)}s`, '#c49cff', 2500);
  }

  // ------------------------------------------------------------------ main loop
  let lastLogic = Date.now(), lastFrame = performance.now(), achAcc = 0, saveAcc = 0;
  function logic() {
    const now = Date.now();
    let dt = (now - lastLogic) / 1000;
    lastLogic = now;
    if (dt <= 0) return;
    if (dt > 600) { // came back from a long sleep (computer suspended): treat as offline time
      offlineGain(dt, true);
      dt = 0.05;
    }
    // background tabs are throttled to ~1 tick/s or slower: split big steps so buffs & timers stay accurate
    const steps = Math.ceil(dt / 5), ev = [];
    for (let k = 0; k < steps; k++) ev.push(...C.tick(S, dt / steps));
    refresh();
    for (const e of ev) {
      if (e.type === 'bloom') onBloom();
      else if (e.type === 'echo') Scene.echo('+' + fmt(e.v));
      else if (e.type === 'moon') toast('A Moon Pearl Jelly drifts by…', 'Click it before it rises out of reach!', '#ffe08a', 3500);
    }
    achAcc += dt;
    if (achAcc > 1) {
      achAcc = 0;
      const got = C.checkAchievements(S);
      if (got.length) {
        refresh();
        Sfx.ach();
        got.slice(0, 3).forEach(a => toast(`Achievement: ${a.name}`, a.desc + ' (+2% production)', '#7ff9ff'));
        if (got.length > 3) toast(`…and ${got.length - 3} more achievements`, '', '#7ff9ff');
      }
      if (S.victory && !S.victorySeen) showVictory();
    }
    saveAcc += dt;
    if (saveAcc > 15) { saveAcc = 0; save(); }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now; lastRaf = now;
    logic();
    Scene.frame(dt, S, D);
    updateHud();
    requestAnimationFrame(frame);
  }
  function uiTick() {
    logic();
    renderTabs();
    renderTab();
    updateBadges();
    updateDepthMeter();
    updateTicker(0.15);
    document.title = `${fmt(S.lumen)} lumen · Lumen Deep`;
    if (document.hidden || !rafAlive()) updateHud();
  }
  let lastRaf = 0;
  const rafAlive = () => performance.now() - lastRaf < 500;
  setInterval(uiTick, 150);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('beforeunload', save);

  function offlineGain(sec, quiet) {
    const d = C.derive(S);
    const t = Math.min(sec, d.offlineCap);
    const g = C.lpsBase(S, d) * t * d.offlineEff;
    S.buffs = { bloom: 0, frenzy: 0, hands: 0 };
    S.moon = null;
    if (g <= 0) return;
    C.gain(S, g);
    S.stats.offlineGain += g;
    if (quiet) toast('While you were away', `+${fmt(g)} lumen (${C.fmtTime(t)})`, '#6dffb5', 6000);
    else modal(`<h2>Welcome back</h2><p>You were away for <b>${C.fmtTime(sec)}</b>${sec > d.offlineCap ? ` (capped at ${C.fmtTime(d.offlineCap)})` : ''}. Your reef kept glowing at ${Math.round(d.offlineEff * 100)}% efficiency.</p>` +
      `<div class="big-num">+${fmt(g)} lumen</div>`, [{ label: 'Lovely', primary: true }]);
  }

  function showVictory() {
    S.victorySeen = true;
    save();
    Sfx.lantern();
    modal(`<h2>The Abyss is Lit</h2>
      <p style="text-align:center">The Great Lantern takes the light of every creature you ever raised and throws it into the dark.
      For the first time since the ocean began, the bottom of the world can see.</p>
      <div class="statline"><span>Time played</span><span>${C.fmtTime(S.stats.playTime)}</span></div>
      <div class="statline"><span>Lumen created</span><span>${fmt(S.totalEarned)}</span></div>
      <div class="statline"><span>Surfacings</span><span>${S.stats.prestiges}</span></div>
      <div class="statline"><span>Achievements</span><span>${Object.keys(S.ach).length} / ${C.ACHIEVEMENTS.length}</span></div>
      <p style="text-align:center">Thank you for playing. The sea is yours — keep diving as long as you like.</p>`,
    [{ label: 'Keep glowing', primary: true }], 'victory');
  }

  // ------------------------------------------------------------------ boot
  Scene.init(canvas);
  applySettings();
  buildDepthMeter();
  updateDepthMeter();
  const hashTab = location.hash.slice(1);
  if (TABS.some(t => t.id === hashTab && t.show())) tab = hashTab;
  renderTabs();
  if (isNew) showHelp();
  else {
    const away = (Date.now() - S.lastSave) / 1000;
    if (away > 60) offlineGain(away, false);
    if (S.stats.clicks >= 12) $('hint').classList.add('gone');
  }
  lastLogic = Date.now();
  tickerNow();
  uiTick();
  requestAnimationFrame(frame);

  // debug/console helpers
  window.LD = { get state() { return S; }, save, Core: C };
})();
