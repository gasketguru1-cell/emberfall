// Potato Sack kill percents: for each kill move (sack-lab tokens) and each opponent, the lowest percent at which it KOs against
// all 9 DI directions (each with SDI out), from centre stage and from near the ledge. Testing only. node tools/sack-kill.js out.json
require('./sack-probe.js');
const DI = KLAB.DIS;
const MOVES = [['Hot Potato (ground)', 'uspecG', 4], ['Hot Potato (short hop)', 'sh uspec', 4], ['up smash', 'usmash', 9], ['forward smash', 'fsmash', 11], ['down smash', 'dsmash', 9],
  ['Spud Bomb (tap)', 'bomb', 3], ['Spud Bomb (60f hold)', 'b60', 3], ['back throw', 'grab_b', 6], ['up throw', 'grab_u', 6], ['forward throw', 'grab_f', 6], ['Tumble slide into usmash', 'tum_f usmash', 30], ['sh bair (Spud Drill)', 'sh bair', 9]];
const FOES = [[0, 0, 'Flint 92'], [8, 0, 'Joey 72'], [3, 0, 'Sprocket 103'], [1, 2, 'Hod 121'], [9, 0, 'Fyrdsman 118']];
const kills = (route, foe, pct, x0, dist) => DI.every(di => { const r = KLAB.run(route, { me: SLAB.ME, foe, pct, x0, dist, def: KLAB.defender({ di, sdi: 'out' }), maxFrames: 400, tail: 260, koTail: 2 }); return r.ko && r.koHurt; });
const out = [];
for (const [mname, route, dist] of MOVES) for (const [fi, ff, fname] of FOES) for (const [pos, x0] of [['centre', -5], ['ledge', 52]]) {
  const dd = pos === 'ledge' ? dist : dist; let lo = 0, hi = 220;
  /* does it even connect? */
  const c = KLAB.run(route, { me: SLAB.ME, foe: [fi, ff], pct: 100, x0: pos === 'ledge' ? x0 - dd : x0, dist: dd, maxFrames: 300, tail: 100 });
  if (!c.hits) { out.push({ move: mname, route, foe: fname, pos, pct: null, note: 'does not connect from ' + dd }); continue; }
  if (!kills(route, [fi, ff], hi, pos === 'ledge' ? x0 - dd : x0, dd)) { out.push({ move: mname, route, foe: fname, pos, pct: '>220' }); continue; }
  while (hi - lo > 2) { const m = (lo + hi) >> 1; if (kills(route, [fi, ff], m, pos === 'ledge' ? x0 - dd : x0, dd)) hi = m; else lo = m; }
  out.push({ move: mname, route, foe: fname, pos, pct: hi });
  console.log(mname.padEnd(28), fname.padEnd(14), pos.padEnd(7), hi + '%');
}
require('fs').writeFileSync(process.argv[2] || 'kill.json', JSON.stringify(out, null, 1));
