// Searches for Potato Sack's true combos by running routes in the real game simulation (sim.js) with the combo lab, and keeps
// the ones the game's true-combo counter confirms.   node tools/combo-search.js [out.json]
// A beam search: from each starter, every action is tried after it; a route survives only if the new action added a hit to the
// same combo (the counter went up and never reset). Then every survivor is replayed against DI in, out, up, down, a level 8
// CPU, and three weights. Nothing in the game is changed.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = undefined; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'tools/combo-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const out = process.argv[2] || path.join(root, 'playtest-results', 'potato-sack', 'search.json'); global.OUT = out; global.FS = fs;
vm.runInThisContext(`
(function () {
  const A = LAB.ACTIONS, names = Object.keys(A).filter(n => !/^bomb_(60|120)$/.test(n));
  const STARTERS = ['jab', 'ftilt', 'utilt', 'dtilt', 'dash_attack', 'grab_d', 'grab_u', 'grab_f', 'grab_b', 'bag_it', 'sh_nair', 'sh_double_nair', 'sh_fair', 'sh_uair', 'sh_dair', 'sh_bair', 'tum_fwd', 'upb', 'bomb_tap', 'usmash', 'dsmash', 'fsmash'];
  const situations = [];
  for (const pct of [0, 20, 40, 60, 80, 100, 130]) for (const dist of [8, 14]) situations.push({ pct, dist, x0: -20 });
  for (const pct of [60, 90, 120]) situations.push({ pct, dist: 9, x0: 48, edge: 1 });   /* near the ledge, facing out */
  const found = [];
  const key = r => r.join('>');
  for (const S of situations) {
    let beam = [];
    for (const s of STARTERS) { const r = LAB.run([s], S); if (r.hits >= 1) beam.push({ route: [s], r }); }
    const all = beam.slice();
    for (let depth = 1; depth < 6 && beam.length; depth++) {
      const nxt = [];
      for (const b of beam) for (const a of names) {
        const route = b.route.concat(a), r = LAB.run(route, S);
        if (r.hits > b.r.hits) nxt.push({ route, r });   /* the new action added a hit to the same combo */
      }
      nxt.sort((x, y) => (y.r.ko - x.r.ko) || (y.r.hits - x.r.hits) || (y.r.dmg - x.r.dmg));
      const seen = new Set(); beam = nxt.filter(x => { const k = x.r.hits + ':' + x.r.dmg + ':' + x.r.ko + ':' + x.route[0]; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 14);
      all.push(...beam);
    }
    all.sort((x, y) => (y.r.ko - x.r.ko) || (y.r.hits - x.r.hits) || (y.r.dmg - x.r.dmg));
    const top = all.filter(x => x.r.hits >= 2 || x.r.ko).slice(0, 8);
    for (const x of top) found.push(Object.assign({ situation: S, route: x.route }, x.r));
    console.log('pct ' + S.pct + ' dist ' + S.dist + (S.edge ? ' ledge' : '') + ': ' + top.slice(0, 3).map(x => x.route.join(' > ') + ' [' + x.r.hits + ' hits, ' + x.r.dmg + '%' + (x.r.ko ? ', KO' : '') + ']').join('  |  '));
  }
  /* robustness: DI, a level 8 CPU, and weight */
  const uniq = []; const seenR = new Set(); for (const x of found) { const k = key(x.route) + '@' + x.situation.pct + x.situation.dist + (x.situation.edge || ''); if (!seenR.has(k)) { seenR.add(k); uniq.push(x); } }
  for (const x of uniq) {
    x.di = {}; for (const di of ['in', 'out', 'up', 'down', 'cpu8']) { const r = LAB.run(x.route, Object.assign({}, x.situation, { di })); x.di[di] = { hits: r.hits, ko: r.ko }; }
    x.weights = {}; for (const [nm, foe] of [['Nib (72)', [1, 0]], ['Hod (121)', [1, 2]], ['Sprocket (103)', [3, 0]]]) { const r = LAB.run(x.route, Object.assign({}, x.situation, { foe })); x.weights[nm] = { hits: r.hits, ko: r.ko }; }
  }
  FS.writeFileSync(OUT, JSON.stringify(uniq, null, 1));
  console.log('wrote ' + uniq.length + ' routes to ' + OUT);
})();
`, { filename: 'search' });
