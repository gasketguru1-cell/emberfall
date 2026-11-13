// Chomp Chomp's level-10 CPU (chompcpu.js) in whole matches, headless: how long its combos run, how often a planned link lands,
// how often it follows the playtest's routes, and how it does, against the plain level-10 brain for comparison.
// Opponents: a CPU at a level (cpu9, cpu10), or 'human': the level-9 brain moving and attacking, but read by the planner as a
// person (it can't see their next input) and holding a DI picked at random from the nine for each hit, with SDI and escape mashing.
// Usage: node tools/chomp-cpu-test.js [matches per opponent, default 4] [foes, default flint,sack,sprocket,knell] [kinds, default human,cpu9] [off]
//   'off' as the 4th argument plays the plain level-10 brain (the planner switched off) for the comparison.
const fs = require('fs'), path = require('path'), vm = require('vm');
try { const os = require('os'); os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { /* fine */ }
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 977; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'knellcpu.js', 'chompcpu.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const per = +process.argv[2] || 4, foes = (process.argv[3] || 'flint,sack,sprocket,knell').split(','), kinds = (process.argv[4] || 'human,cpu9').split(','), off = process.argv[5] === 'off';
global.FS = fs; global.ARGS = { per, foes, kinds, off, out: process.env.OUT || '', dump: !!process.env.DUMP, why: !!process.env.WHY };
vm.runInThisContext(`(function () {
  CCPU.ms = 0; CCPU.off = ARGS.off; CCPU.log = []; if (ARGS.why) CCPU.why = {};
  const idx = n => ROSTER.findIndex(d => d.name === n);
  const FOE = { flint: idx('Flint'), sack: idx('Potato Sack'), sprocket: idx('Sprocket'), knell: idx('Knell'), joey: ROSTER.findIndex(d => /Joey/.test(d.name)), fyrd: ROSTER.findIndex(d => /Fyrd/.test(d.name)) };
  const CI = idx('Chomp Chomp');
  const DIV = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  /* the person: the level-9 brain, with its own DI swapped for a random one each hit */
  let di = DIV[0], lastHit = -1;
  const ai = { lv: 9 };
  const origRead = readDev;
  readDev = function (dev) {
    if (dev !== 'bot') return origRead(dev);
    const v = F[1], a = F[0], i = cpuInput(v, a, ai), tw = sgn(a.x - v.x) || 1, hurt = v.state === 'hurt' || v.hitlag > 0 || v.state === 'held';
    if (v.hitlag > 0 && lastHit !== v.lastHitF) { lastHit = v.lastHitF; }
    if (hurt) {
      if (v.hitlag > 0 && v.hitlag >= (v.hlMax || 0)) {}
      i.lx = di[0] * tw; i.ly = di[1];
      if (v.hitlag > 0 && frame % 2) { i.lx = 0; i.ly = 0; }
    }
    if (!hurt && frame % 2 === 0 && v.state !== 'idle' && v.state !== 'run' && v.state !== 'hold') i[['jmp', 'shd', 'atk'][Math.floor(frame / 2) % 3]] = true;
    return i;
  };
  const rows = {}, all = [];
  for (const kind of ARGS.kinds) for (const fn of ARGS.foes) {
    const r = { games: 0, wins: 0, stockLead: 0, combos: 0, hits: 0, dmg: 0, long: 0, max: 0, kos: 0, frames: 0, routeLinks: 0, picks: 0, landed: 0, dropped: 0, routes: {} };
    for (let g = 0; g < ARGS.per; g++) {
      slots[0] = { dev: 'kb', pick: CI, ready: true }; slots[1] = { dev: 'kb', pick: FOE[fn], ready: true };
      startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl(kind === 'human' ? 'bot' : 'cpu'); F[0].noSwap = F[1].noSwap = true;
      F[0].ctl.ai.lv = 10; if (kind !== 'human') F[1].ctl.ai.lv = +kind.slice(3);
      const st0 = Object.assign({}, CCPU.stats); CCPU.log.length = 0;
      let prev = 0, best = 0, bd = 0, n = 0, prevH = 0;
      const combos = [];
      while (mode !== 'over' && n < 8 * 3600 + 400) {
        step(); n++;
        const c = COMBO[0];
        if (c.hits > prevH && c.hits === 1) di = DIV[Math.floor(Math.random() * 9)];   /* a fresh combo: they pick a DI for it */
        else if (c.hits > prevH && Math.random() < 0.35) di = DIV[Math.floor(Math.random() * 9)];   /* and now and then change it mid-combo */
        if (c.hits > best) { best = c.hits; bd = c.dmg; }
        if (c.hits < prevH || (mode === 'over')) { if (best >= 2) combos.push([best, bd]); best = 0; bd = 0; }
        prevH = c.hits;
      }
      if (best >= 2) combos.push([best, bd]);
      const w = F[0].stocks !== F[1].stocks ? (F[0].stocks > F[1].stocks ? 0 : 1) : F[0].pct < F[1].pct ? 0 : 1;
      r.games++; if (w === 0) r.wins++; r.stockLead += F[0].stocks - F[1].stocks; r.frames += n; r.kos += F[0].kos;
      for (const [h, d] of combos) { r.combos++; r.hits += h; r.dmg += d; if (h >= 4) r.long++; r.max = Math.max(r.max, h); }
      for (const L of CCPU.log) { if (!L.best) continue; r.picks++; if (L.route) r.routeLinks++; if (L.route) r.routes[L.best] = (r.routes[L.best] || 0) + 1; }
      r.landed += CCPU.stats.landed - st0.landed; r.dropped += CCPU.stats.dropped - st0.dropped;
      all.push({ kind, fn, g, win: w === 0, combos }); if (ARGS.dump) for (const L of CCPU.log) console.log(JSON.stringify(L));
    }
    rows[kind + ' ' + fn] = { 'win %': Math.round(r.wins / r.games * 100), 'stock lead': +(r.stockLead / r.games).toFixed(2), 'combos/game': +(r.combos / r.games).toFixed(1), 'avg hits': +(r.hits / Math.max(1, r.combos)).toFixed(2), 'avg %': +(r.dmg / Math.max(1, r.combos)).toFixed(1), '4+ hits': r.long, 'longest': r.max,
      'landed %': r.landed + r.dropped ? Math.round(r.landed / (r.landed + r.dropped) * 100) : '-', 'on route %': r.picks ? Math.round(r.routeLinks / r.picks * 100) : '-', 'secs': Math.round(r.frames / r.games / 60) };
    rows[kind + ' ' + fn].top = Object.entries(r.routes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' x' + v).join('; ');
    console.log(kind, fn, JSON.stringify(rows[kind + ' ' + fn]));
  }
  console.table(Object.fromEntries(Object.entries(rows).map(([k, v]) => { const o = Object.assign({}, v); delete o.top; return [k, o]; })));
  console.log(JSON.stringify(CCPU.stats)); if (ARGS.why) { const by = {}; for (const [k, n] of Object.entries(CCPU.why)) { const r = k.split(" => ")[1].replace(/@.*/, "@"); by[r] = (by[r] || 0) + n; } console.log(by); }
  if (ARGS.out) FS.writeFileSync(ARGS.out, JSON.stringify({ rows, all, stats: CCPU.stats }, null, 1));
})();`);
