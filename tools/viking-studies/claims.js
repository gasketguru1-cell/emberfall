// Re-measures the album's headline claims on Flint across every DI, mashing and not.
const plat = { from: -40 }, far = { from: -20, face: 1 };
const rows = [['combo 0%', 'grab_f w20 rc fh w9 bair', { pct: 0, axe: plat }], ['combo 0% w7', 'grab_f w20 rc w7 fh w9 bair', { pct: 0, axe: plat }],
  ['kill 55 rc', 'grab_f w18 rc', { pct: 55, axe: plat }], ['kill 55 rc', 'grab_f w20 rc', { pct: 55, axe: plat }], ['kill 55 bair', 'grab_f w20 rc w7 fh w9 bair', { pct: 55, axe: plat }],
  ['bz usmash 25', 'usmash', { pct: 25, bz: true }], ['bz usmash 20', 'usmash', { pct: 20, bz: true }], ['bz fsmash 55', 'fsmash', { pct: 55, bz: true }], ['bz fsmash 50', 'fsmash', { pct: 50, bz: true }],
  ['rc fullrange 80', 'rc w40', { pct: 80, x0: -12, axe: far }]];
for (const [lab, route, s] of rows) for (const mash of [true, false]) { const row = [];
  for (const di of KLAB.DIS) { const o = Object.assign({ foe: [0], x0: -20, dist: 9 }, s); o.def = KLAB.defender(mash ? { di, esc: 'all', gate: true } : { di, gate: true });
    const r = KLAB.run(route, o); row.push(di + ':' + (r.ko ? 'KO' : '') + r.hits + '/' + Math.round(r.dmg)); }
  console.log((lab + ' ' + route + (mash ? ' M' : ' -')).padEnd(46), row.join(' ')); }
