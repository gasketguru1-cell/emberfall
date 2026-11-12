// Beam search for Furious Fowls' true combos in the real simulation (run through tools/fowls-node.js):
//   node tools/fowls-node.js tools/fowls-search.js [out.json] [birds e.g. 01234]
// From every starter, each action that fits the state Fowls is left in is tried next; a route survives if it added a hit to
// the same combo, or if it was a move (wait, land, dash, jump, steer) that kept the combo alive. Survivors are ranked by KO in
// the chain, hits, then damage. Nothing in the game is changed.
{
const OUTF = ARGS[0] || ROOT + '/playtest-results/furious-fowls/search.json', BIRDS = (ARGS[1] || '01234').split('').map(Number);
const AIRN = ['nair', 'fair', 'bair', 'uair', 'dair'];
const SLING_G = ['jab', 'jab3', 'ftilt', 'utilt', 'dtilt', 'dash_attack', 'fsmash', 'usmash', 'dsmash', 'grab_f', 'grab_b', 'grab_u', 'grab_d', 'dashgrab_f', 'dn', 'dntap', 'dnj', 'dnpull', 'seltap']
  .concat(AIRN.map(a => 'sh_' + a), AIRN.map(a => 'fh_' + a), ['sb:-1', 'sb:0', 'sb:1', 'up:0:tu', 'up:0:t', 'up:0:u', 'up:12:tu', 'up:25:tu', 'up:25:t', 'up:25:u', 'up:45:tu', 'up:45:t', 'up:45:u']);
const SLING_A = AIRN.concat(AIRN.map(a => 'dj_' + a), AIRN.map(a => 'ff_' + a), AIRN.map(a => 'nd_' + a), ['sb:-1', 'sb:0', 'sb:1', 'up:0:tu', 'up:0:t', 'up:0:u', 'up:12:tu', 'up:25:tu', 'up:25:t', 'up:45:tu', 'up:45:t', 'up:45:u', 'dn', 'dntap']);
const MOVE_G = ['wait:3', 'wait:8', 'dash', 'dashback', 'hop', 'jump'], MOVE_A = ['land', 'dj', 'ff', 'drift:4', 'drift:10'];
const FLY = ['fly', 'flyn', 'flyfor:6', 'flyfor:14', 'boltfix', 'dive'];
const BIRD_G = ['jab', 'ftilt', 'utilt', 'dtilt', 'dash_attack', 'fsmash', 'usmash', 'dsmash', 'grab_f', 'grab_u', 'bnspec', 'bnspec:18', 'bsspec', 'buspec', 'buspec2', 'rejoin'].concat(AIRN.map(a => 'sh_' + a));
const BIRD_A = AIRN.concat(AIRN.map(a => 'dj_' + a), ['bnspec', 'bnspec:18', 'bsspec', 'buspec', 'buspec2', 'flap', 'rejoin']);
const MOVES = new Set(MOVE_G.concat(MOVE_A, FLY.filter(x => x !== 'fly' && x !== 'dive'), ['seltap']));
function nextActs(r) {
  const e = r.end || {}; if (e.fly) return FLY.concat(AIRN, ['bnspec', 'bsspec', 'buspec']);
  const solo = (e.fi || 0) >= 5;
  if (solo) return e.g ? BIRD_G.concat(MOVE_G) : BIRD_A.concat(MOVE_A);
  return e.g ? SLING_G.concat(MOVE_G) : SLING_A.concat(MOVE_A);
}
const situations = [];
for (const bird of BIRDS) { for (const pct of [0, 25, 50, 80, 110]) for (const dist of [9, 16]) situations.push({ bird, pct, dist, x0: -20 });
  for (const pct of [40, 80, 120]) situations.push({ bird, pct, dist: 10, x0: 40 }); for (const pct of [0, 60]) situations.push({ bird, pct, dist: 30, x0: -40 }); }
const found = [], t0 = Date.now(); let runs = 0;
const sc = r => (r.chainKO ? 100000 : 0) + r.hits * 100 + r.dmg;
for (const S of situations) {
  let beam = [];
  for (const s of SLING_G) { const r = FL.run([s], S); runs++; if (r.hits >= 1) beam.push({ route: [s], r }); }
  const all = beam.slice();
  for (let depth = 1; depth < 7 && beam.length; depth++) {
    const nxt = [];
    for (const b of beam) { if (b.r.chainKO) continue; if (!(b.r.end && b.r.end.alive)) continue;
      for (const a of nextActs(b.r)) { const route = b.route.concat(a), r = FL.run(route, S); runs++;
        if (r.hits > b.r.hits || r.chainKO) nxt.push({ route, r });
        else if (MOVES.has(a) && r.end && r.end.alive && r.hits === b.r.hits && b.route.filter(x => MOVES.has(x)).length < 2) nxt.push({ route, r, mv: 1 }); } }
    nxt.sort((x, y) => sc(y.r) - sc(x.r));
    const seen = new Set(); beam = nxt.filter(x => { const k = x.r.hits + ':' + x.r.dmg.toFixed(0) + ':' + x.r.chainKO + ':' + x.route[0] + ':' + (x.mv || 0); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16);
    all.push(...beam.filter(x => !x.mv));
  }
  all.sort((x, y) => sc(y.r) - sc(x.r));
  const top = all.filter(x => x.r.hits >= 2 || x.r.chainKO).slice(0, 10);
  for (const x of top) found.push({ situation: S, route: x.route, hits: x.r.hits, dmg: x.r.dmg, chainKO: x.r.chainKO, ko: x.r.ko, endPct: x.r.endPct });
  console.log('bird ' + S.bird + ' pct ' + S.pct + ' dist ' + S.dist + ' x0 ' + S.x0 + ': ' + top.slice(0, 3).map(x => x.route.join(' > ') + ' [' + x.r.hits + 'h ' + x.r.dmg + '%' + (x.r.chainKO ? ' KO' : '') + ']').join('  |  ') + '   (' + runs + ' runs, ' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
}
FS.mkdirSync(require('path').dirname(OUTF), { recursive: true }); FS.writeFileSync(OUTF, JSON.stringify(found, null, 1)); console.log('wrote ' + found.length + ' to ' + OUTF + ', ' + runs + ' runs');
}
