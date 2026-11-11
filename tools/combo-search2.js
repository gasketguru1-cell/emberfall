// Second pass for Potato Sack: movement-plus-attack steps (Tumble cancels, Tumble through a platform, jumps, fast falls), up special
// kill confirms near the ledge and in the middle, Spud Bomb, and platform starts. Same rules as tools/combo-search.js: a step
// survives only if the game's true-combo counter went up without resetting.   node tools/combo-search2.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4321; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'tools/combo-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
global.OUT = path.join(root, 'playtest-results', 'potato-sack', 'search2.json'); global.FS = fs;
vm.runInThisContext(`
(function () {
  const ATK = ['nair', 'uair', 'fair', 'bair', 'dair', 'upb', 'upb_f', 'upb_b', 'bag_it', 'bomb_tap'];
  const MOVE = ['tum_fwd', 'tum_up', 'tum_stall', 'tum_back', 'tum_thru', 'jump', 'ff', 'dash', 'wait4'];
  const steps = Object.keys(LAB.ACTIONS).filter(n => !/^bomb_(60|120)$/.test(n) && !/^tum_|^wait|^jump$|^dash$|^ff$/.test(n));
  for (const m of MOVE) for (const a of ATK.concat(['utilt', 'dtilt', 'grab_u', 'grab_d', 'usmash', 'sh_nair', 'sh_uair', 'fh_uair'])) steps.push(m + '+' + a);
  const STARTERS = ['dtilt', 'utilt', 'jab', 'grab_d', 'grab_u', 'grab_b', 'sh_nair', 'sh_double_nair', 'sh_dair', 'sh_uair', 'bomb_tap', 'dash_attack', 'tum_fwd+nair', 'tum_fwd+bag_it', 'tum_stall+dair', 'tum_up+uair'];
  const S = [];
  for (const pct of [0, 25, 50, 75, 100]) S.push({ pct, dist: 9, x0: -20 });
  for (const pct of [50, 80, 110]) S.push({ pct, dist: 9, x0: 46, edge: 1 });
  for (const pct of [20, 60]) S.push({ pct, dist: 8, foeOnPlat: 1, plat: 1 });
  for (const pct of [30, 70]) S.push({ pct, dist: 9, sackOnPlat: 1, plat: 1 });
  const found = [];
  for (const sit of S) {
    let beam = [];
    for (const s of STARTERS) { const r = LAB.run([s], sit); if (r.hits >= 1) beam.push({ route: [s], r }); }
    const all = beam.slice();
    for (let depth = 1; depth < 5 && beam.length; depth++) {
      const nxt = [];
      for (const b of beam) for (const a of steps) { const route = b.route.concat(a), r = LAB.run(route, sit); if (r.hits > b.r.hits || (r.ko && !b.r.ko && r.hits >= b.r.hits)) nxt.push({ route, r }); }
      const score = x => (x.r.ko ? 100 : 0) + x.r.hits * 10 + x.r.dmg / 10 + x.route.join().split('tum_').length * 3 + x.route.join().split('upb').length * 2;   /* the owner asked for creative up B and down B use */
      nxt.sort((x, y) => score(y) - score(x));
      const seen = new Set(); beam = nxt.filter(x => { const k = x.r.hits + ':' + x.r.dmg + ':' + x.r.ko; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
      all.push(...beam);
    }
    const score = x => (x.r.ko ? 100 : 0) + x.r.hits * 10 + x.r.dmg / 10 + x.route.join().split('tum_').length * 3 + x.route.join().split('upb').length * 2;
    all.sort((x, y) => score(y) - score(x));
    const top = all.filter(x => x.r.hits >= 2).slice(0, 8);
    for (const x of top) { const e = Object.assign({ situation: sit, route: x.route }, x.r); e.di = {}; for (const di of ['in', 'out', 'up', 'down', 'cpu8']) { const r = LAB.run(x.route, Object.assign({}, sit, { di })); e.di[di] = { hits: r.hits, ko: r.ko }; }
      e.weights = {}; for (const [nm, foe] of [['Nib (72)', [1, 0]], ['Hod (121)', [1, 2]], ['Sprocket (103)', [3, 0]]]) { const r = LAB.run(x.route, Object.assign({}, sit, { foe })); e.weights[nm] = { hits: r.hits, ko: r.ko }; } found.push(e); }
    console.log(JSON.stringify(sit) + ': ' + top.slice(0, 3).map(x => x.route.join(' > ') + ' [' + x.r.hits + ' hits ' + x.r.dmg + '%' + (x.r.ko ? ' KO' : '') + ']').join('  |  '));
  }
  FS.writeFileSync(OUT, JSON.stringify(found, null, 1)); console.log('wrote ' + found.length);
})();
`, { filename: 'search2' });
