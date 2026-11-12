// Zero-to-death hunter for Furious Fowls, in the real simulation with snapshots (run through tools/fowls-node.js):
//   node tools/fowls-node.js tools/fowls-ztd.js BIRD FOE(r,f) POLICIES(e.g. 0-8) [x0] [out.json]
// For each defender policy (FL.QUICK) on its own: from 0%, every starter is tried; then, from each surviving state (the combo
// still counting), every action that fits is tried next. States that keep the chain go on, best first (most damage dealt, the
// opponent nearest a blast line), until the chain carries them out (a KO counted inside the combo) or nothing extends it.
{
// The attacker sees the defender's policy (as a player sees DI); the defender keeps one policy for the whole run.
const BIRD = +(ARGS[0] || 0), FOE = (ARGS[1] || '0,0').split(',').map(Number);
const POL = (() => { const s = ARGS[2] || '0'; if (s.includes('-')) { const [a, b] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); } return s.split(',').map(Number); })();
const X0 = +(ARGS[3] || -30), OUTF = ARGS[4] || ROOT + '/playtest-results/furious-fowls/ztd-b' + BIRD + '-f' + FOE.join('') + '.json';
const W = +(process.env.W || 24), DEPTH = +(process.env.DEPTH || 45), PER = +(process.env.PER || 4), TLIM = +(process.env.TLIM || 600) * 1000;
const DISTS = (process.env.DISTS || '4,7,10,13').split(',').map(Number);
const AIRN = ['nair', 'fair', 'bair', 'uair', 'dair'];
const UPS = ['up:0:tu', 'up:0:t', 'up:0:u', 'up:15:tu', 'up:15:t', 'up:30:tu', 'up:30:t', 'up:30:u', 'up:45:tu', 'up:45:t', 'up:45:u', 'up:45:bu', 'up:45:b'];
const SG = ['jab', 'jab3', 'ftilt', 'utilt', 'dtilt', 'dash_attack', 'fsmash', 'usmash', 'dsmash', 'grab_f', 'grab_b', 'grab_u', 'grab_d', 'dashgrab_f', 'dn', 'dntap', 'dnj', 'dnpull', 'seltap', 'sel:0', 'sel:1', 'sel:2', 'sel:3', 'sel:4']
  .concat(...['', ':4:n', ':7', ':7:n', ':11', ':11:n', ':4:g', ':8:f', ':8:g'].map(v => AIRN.map(a => 'sh_' + a + v)), ...['', ':9:n', ':16', ':16:n', ':16:g'].map(v => AIRN.map(a => 'fh_' + a + v)), ['sb:-1', 'sb:0', 'sb:1', 'sbr:0'], UPS);
const SA = AIRN.concat(AIRN.map(a => 'dj_' + a), AIRN.map(a => 'ff_' + a), AIRN.map(a => 'nd_' + a), ['sb:-1', 'sb:0', 'sb:1', 'dn', 'dntap', 'seltap'], UPS);
const MG = ['wait:1', 'wait:2', 'wait:4', 'wait:6', 'wait:9', 'wait:13', 'dash', 'dashback', 'hop', 'jump'], MA = ['land', 'dj', 'ff', 'drift:2', 'drift:4', 'drift:7', 'drift:10', 'wait:3', 'wait:6'];
const FLY = ['fly', 'flyn', 'flyfor:6', 'flyfor:14', 'boltfix', 'dive'].concat(AIRN, ['bnspec', 'bsspec', 'buspec']);
const BG = ['jab', 'jab3', 'ftilt', 'utilt', 'dtilt', 'dash_attack', 'fsmash', 'usmash', 'dsmash', 'grab_f', 'grab_u', 'grab_d', 'bnspec', 'bnspec:18', 'bsspec', 'buspec', 'buspec2', 'rejoin'].concat(...['', ':4:n', ':8:g', ':7'].map(v => AIRN.map(a => 'sh_' + a + v)), AIRN.map(a => 'fh_' + a));
const BA = AIRN.concat(AIRN.map(a => 'dj_' + a), ['bnspec', 'bnspec:18', 'bsspec', 'buspec', 'buspec2', 'flap', 'rejoin']);
const MOVES = new Set(MG.concat(MA, ['flyn', 'flyfor:6', 'flyfor:14', 'seltap', 'sel:0', 'sel:1', 'sel:2', 'sel:3', 'sel:4', 'flap']));
const acts = n => n.fly ? FLY : n.fi >= 5 ? (n.g ? BG.concat(MG) : BA.concat(MA)) : (n.g ? SG.concat(MG) : SA.concat(MA));
const results = [];
/* keep the beam varied: at most a few states from each starter, and from each last action */
const diverse = (xs, w) => { const a = new Map(), b = new Map(), out = [];
  for (const x of xs) { const k1 = x.route.slice(0, 2).join(), k2 = x.route[x.route.length - 1]; if ((a.get(k1) || 0) >= Math.max(3, w / 6) || (b.get(k2) || 0) >= Math.max(3, w / 5)) continue;
    a.set(k1, (a.get(k1) || 0) + 1); b.set(k2, (b.get(k2) || 0) + 1); out.push(x); if (out.length >= w) break; }
  return out; };
for (const pi of POL) {
  const D = FL.QUICK[pi], S = { bird: BIRD, foe: FOE, pct: +(process.env.PCT || 0), dist: 11, x0: X0, def: D };
  const t0 = Date.now(); let sims = 0, wins = [], bestN = null;
  const score = n => n.hits * 12 + n.pct * 6 + Math.max(Math.abs(n.vx) - 60, 0) * 4 + Math.max(n.vy - 40, 0) * 4 + n.hits;
  let beam = [];
  for (const dist of DISTS) { FL.begin(Object.assign({}, S, { dist })); const root = FL.save();
    for (const a of SG) { FL.load(root); const r = FL.act(a); sims++; const route = ['@' + dist, a];
      if (r.chainKO) wins.push({ route, r }); else if (r.alive && !r.broke) beam.push(Object.assign({ route, snap: FL.save(), mv: 0, h: NET.hash() }, r)); } }
  { const seen = new Set(); beam.sort((x, y) => score(y) - score(x)); beam = diverse(beam.filter(k => { if (seen.has(k.h)) return false; seen.add(k.h); return true; }), W * 2); }
  for (let d = 1; d < DEPTH && beam.length && Date.now() - t0 < TLIM && wins.length < 6; d++) {
    const kids = [];
    for (const n of beam) { const ch = [];
      for (const a of acts(n)) { const isMv = MOVES.has(a); if (isMv && n.mv >= 3) continue;
        FL.load(n.snap); const r = FL.act(a); sims++;
        if (r.selfKO) continue;
        if (r.chainKO) { wins.push({ route: n.route.concat(a), r }); continue; }
        if (!r.alive || r.broke) continue;
        if (r.hits > n.hits || isMv) ch.push(Object.assign({ route: n.route.concat(a), snap: FL.save(), mv: r.hits > n.hits ? 0 : n.mv + 1, h: NET.hash() }, r)); }
      ch.sort((x, y) => score(y) - score(x)); kids.push(...ch.slice(0, PER)); }
    const seen = new Set(); kids.sort((x, y) => score(y) - score(x));
    beam = diverse(kids.filter(k => { if (seen.has(k.h)) return false; seen.add(k.h); return true; }), W);
    for (const x of beam) if (!bestN || x.hits * 2 + x.pct > bestN.hits * 2 + bestN.pct) bestN = x;
  }
  wins.sort((x, y) => x.route.length - y.route.length);
  const rec = { bird: BIRD, foe: FOE, pct: S.pct, policy: D, x0: X0, sims, sec: (Date.now() - t0) / 1000, ztd: wins.slice(0, 6).map(w => ({ route: w.route, hits: w.r.hits, pct: w.r.pct })), best: bestN && { route: bestN.route, hits: bestN.hits, pct: bestN.pct } };
  results.push(rec);
  console.log(JSON.stringify(D) + ': ' + (wins.length ? 'ZTD ' + wins[0].route.join(' > ') + ' [' + wins[0].r.hits + 'h]' : 'none; best ' + (bestN ? bestN.route.join(' > ') + ' [' + bestN.hits + 'h ' + bestN.pct + '%]' : '-')) + '  (' + sims + ' sims ' + rec.sec.toFixed(0) + 's)');
}
FS.mkdirSync(require('path').dirname(OUTF), { recursive: true }); FS.writeFileSync(OUTF, JSON.stringify(results, null, 1));
}
