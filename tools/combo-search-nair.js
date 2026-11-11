// Third pass for Potato Sack, after his neutral air became three carrying hits and a finisher (2026-11-10): routes that use
// the neutral air as a starter or in the middle. Same rule as the other searches: a step survives only if the game's own
// true-combo counter went up without resetting. Every kept route is then replayed against DI and three weights.
//   node tools/combo-search-nair.js   -> playtest-results/potato-sack/search-nair.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 2468; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'tools/combo-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
global.OUT = path.join(root, 'playtest-results', 'potato-sack', 'search-nair.json'); global.FS = fs;
vm.runInThisContext(`
(function () {
  const ATK = ['nair', 'uair', 'fair', 'bair', 'dair', 'upb', 'upb_b', 'bag_it', 'bomb_tap'];
  const steps = ['nair', 'uair', 'fair', 'bair', 'dair', 'dj_nair', 'dj_uair', 'dj_dair', 'ff_nair', 'sh_nair', 'fh_nair', 'sh_uair', 'fh_uair', 'sh_double_nair', 'upb', 'upb_b', 'bag_it', 'bomb_tap', 'utilt', 'dtilt', 'jab', 'grab_u', 'grab_d', 'usmash', 'fsmash'];
  for (const m of ['tum_fwd', 'tum_up', 'tum_stall', 'jump', 'ff']) for (const a of ATK.concat(['grab_u', 'grab_d', 'sh_nair'])) steps.push(m + '+' + a);
  const STARTERS = ['sh_nair', 'fh_nair', 'sh_double_nair', 'tum_fwd+nair', 'tum_stall+nair', 'jump+nair', 'dash+sh_nair'];
  const S = [];
  for (const pct of [0, 30, 60, 90, 120]) S.push({ pct, dist: 9, x0: -20 });
  for (const pct of [60, 100]) S.push({ pct, dist: 9, x0: 46, edge: 1 });
  for (const pct of [30, 70]) S.push({ pct, dist: 8, foeOnPlat: 1, plat: 1 });
  const found = [], hasNair = r => r.join(' ').includes('nair');
  const score = x => (x.r.ko ? 100 : 0) + x.r.hits * 6 + x.r.dmg / 5;
  for (const sit of S) {
    let beam = [];
    for (const s of STARTERS) { const r = LAB.run([s], sit); if (r.hits >= 1) beam.push({ route: [s], r }); }
    const all = beam.slice();
    for (let depth = 1; depth < 4 && beam.length; depth++) {
      const nxt = [];
      for (const b of beam) for (const a of steps) { const route = b.route.concat(a), r = LAB.run(route, sit); if (r.hits > b.r.hits || (r.ko && !b.r.ko && r.hits >= b.r.hits)) nxt.push({ route, r }); }
      nxt.sort((x, y) => score(y) - score(x));
      const seen = new Set(); beam = nxt.filter(x => { const k = x.r.hits + ':' + x.r.dmg + ':' + x.r.ko; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
      all.push(...beam);
    }
    all.sort((x, y) => score(y) - score(x));
    const top = all.filter(x => x.r.hits >= 5 && hasNair(x.route)).slice(0, 6);
    for (const x of top) { const e = Object.assign({ situation: sit, route: x.route }, x.r); e.di = {}; for (const di of ['in', 'out', 'up', 'down', 'cpu8']) { const r = LAB.run(x.route, Object.assign({}, sit, { di })); e.di[di] = { hits: r.hits, ko: r.ko }; }
      e.weights = {}; for (const [nm, foe] of [['Nib (72)', [1, 0]], ['Hod (121)', [1, 2]], ['Sprocket (103)', [3, 0]]]) { const r = LAB.run(x.route, Object.assign({}, sit, { foe })); e.weights[nm] = { hits: r.hits, ko: r.ko }; } found.push(e); }
    console.log(JSON.stringify(sit) + ': ' + top.slice(0, 3).map(x => x.route.join(' > ') + ' [' + x.r.hits + ' hits ' + x.r.dmg + '%' + (x.r.ko ? ' KO' : '') + ']').join('  |  '));
  }
  FS.writeFileSync(OUT, JSON.stringify(found, null, 1)); console.log('wrote ' + found.length);
})();
`, { filename: 'search-nair' });
