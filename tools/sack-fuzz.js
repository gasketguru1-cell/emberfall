// Potato Sack glitch fuzzer: random, replayable input for Potato Sack (raw sticks and buttons, biased toward Tumble, its cancels,
// the landing buffer, platforms and ledges) against several opponents and defenders, on every stage, with the game's state checked
// each frame for things that shouldn't happen. Every finding keeps its seed so it can be replayed exactly. Testing only.
//   node tools/sack-fuzz.js runs seed0 out.json
require('./sack-probe.js');
const N = +process.argv[2] || 200, S0 = +process.argv[3] || 1, OUT = process.argv[4];
function rng(s) { return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; }
const FOES = [[0, 0], [8, 0], [1, 2], [3, 0], [2, 0], [4, 0], [9, 0], [1, 0]];
function program(R, len) {   /* a list of [frames, input] chunks */
  const P = []; let t = 0;
  while (t < len) {
    const n = 1 + Math.floor(R() * (R() < 0.5 ? 4 : 14)), i = {}; const c = R();
    const st = () => { const a = Math.floor(R() * 9); return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]][a]; };
    let [lx, ly] = st();
    if (c < 0.22) { i.spc = 1; ly = -1; lx = 0; P.push([1, Object.assign({ lx, ly }, i)]); t++; const [ax, ay] = st(); P.push([6, { lx: ax, ly: ay }]); t += 6; continue; }   /* a Tumble with a chosen direction */
    if (c < 0.35) i.atk = 1; else if (c < 0.45) i.jmp = 1; else if (c < 0.52) i.shd = 1; else if (c < 0.6) i.spc = 1; else if (c < 0.64) i.grb = 1; else if (c < 0.68) { i.atk = 1; i.spc = 1; }
    else if (c < 0.72) { i.cx = st()[0]; i.cy = st()[1]; }
    P.push([n, Object.assign({ lx, ly, hold: R() < 0.3 }, i)]); t += n;
  }
  return P;
}
function play(seed) {
  const R = rng(seed * 7919 + 13), stage = Math.floor(R() * 3), foe = FOES[Math.floor(R() * FOES.length)], pct = Math.floor(R() * 160), x0 = -60 + R() * 120, dist = (R() < 0.5 ? -1 : 1) * (5 + R() * 40);
  const defKind = Math.floor(R() * 4), P = program(R, 900);
  const def = defKind === 0 ? 'cpu9' : defKind === 1 ? null : KLAB.defender({ di: KLAB.DIS[Math.floor(R() * 9)], esc: ['none', 'jump', 'ad', 'all'][Math.floor(R() * 4)] });
  const sit = { me: SLAB.ME, foe, pct, x0, dist, stage, kPct: Math.floor(R() * 120) };
  const [f, v] = KLAB.setup(sit); let pi = 0, left = P[0][0], fr = 0; const finds = []; const note = (k, d) => { if (!finds.some(x => x.k === k)) finds.push({ k, t: fr, d }); };
  KLAB.kIn = () => { const c = P[pi]; const i = blankIn(); if (!c) return i; const q = c[1]; i.lx = q.lx || 0; i.ly = q.ly || 0;
    const first = left === c[0]; for (const b of ['atk', 'spc', 'jmp', 'shd', 'grb']) if (q[b]) i[b] = q.hold || first; if (q.cx !== undefined) { i.cx = q.cx; i.cy = q.cy; } return i; };
  KLAB.vIn = def ? (def === 'cpu9' ? 'cpu9' : def) : () => blankIn();
  let tumLog = [], same = 0, last = '', airTum = 0, wasG = true, prevKos = [f.kos, v.kos], lastHitBy = -1, sdCount = 0;
  try {
    for (fr = 0; fr < 900; fr++) {
      step(); if (--left <= 0) { pi++; left = P[pi] ? P[pi][0] : 1e9; }
      for (const [nm, q] of [['sack', f], ['foe', v]]) {
        if (![q.x, q.y, q.vx, q.vy, q.pct].every(Number.isFinite)) note('NaN-' + nm, { x: q.x, y: q.y, vx: q.vx, vy: q.vy });
        if (q.state !== 'dead' && q.state !== 'respawn' && q.state !== 'hurt') { if (Math.abs(q.vx) > 4.5) note('fast-x-' + nm, { vx: +q.vx.toFixed(2), st: q.state, mv: q.mname, bk: q.burstKind }); if (q.vy > 7 || q.vy < -4) note('fast-y-' + nm, { vy: +q.vy.toFixed(2), st: q.state, mv: q.mname }); }
        const h = stageHalf(q.y); if (h > 0 && Math.abs(q.x) < h - 1.5 && q.y < -2 && q.state !== 'dead' && q.state !== 'respawn') note('inside-rock-' + nm, { x: +q.x.toFixed(1), y: +q.y.toFixed(1), st: q.state, mv: q.mname });
        if (q.grounded && q.plat && Math.abs(q.y - q.plat.y) > 0.01) note('floating-' + nm, { y: q.y, plat: q.plat.y });
        if (q.grounded && q.plat && (q.x < q.plat.x0 - 3 || q.x > q.plat.x1 + 3)) note('grounded-off-plat-' + nm, { x: +q.x.toFixed(1), plat: [q.plat.x0, q.plat.x1], st: q.state, mv: q.mname });
      }
      const key = f.state + ':' + (f.mname || '') + ':' + f.mf + ':' + f.x.toFixed(1) + ':' + f.y.toFixed(1);
      same = key === last ? same + 1 : 0; last = key; if (same > 240 && f.state !== 'idle' && f.state !== 'dead' && f.state !== 'respawn' && f.state !== 'shield') note('stuck-sack', { key });
      if (f.grounded || f.state === 'hurt' || f.state === 'held' || f.state === 'ledge' || f.state === 'dead' || f.state === 'respawn') { airTum = 0; tumLog = []; } if (f.state === 'attack' && f.mname === 'dspec' && f.mf === 1 && !f.grounded) { airTum++; tumLog.push(fr + ':' + f.y.toFixed(1)); } if (airTum > 1) note('two-air-tumbles', { airTum, tumLog: tumLog.slice() });
      wasG = f.grounded;
      if (v.hitlag > 90 || f.hitlag > 90) note('long-hitlag', { v: v.hitlag, f: f.hitlag });
      if (PROJ.length > 12) note('projectile-pileup', { n: PROJ.length, kinds: PROJ.map(p => p.kind).join(',') });
      if (PROJ.filter(p => p.owner === f.idx && p.kind === 'sackglow').length > 1) note('double-bomb-glow', { n: PROJ.length });
      if (f.state === 'hurt' || f.hitlag > 0 || f.state === 'held') lastHitBy = fr;
      if (v.kos > prevKos[1]) { if (fr - lastHitBy > 200) note('sack-SD', { fr, x: +f.x.toFixed(1) }); prevKos[1] = v.kos; }
      if (v.pct > 999 || f.pct > 999) note('pct-overflow', {});
    }
  } catch (e) { note('EXCEPTION', { msg: String(e && e.stack || e).slice(0, 400) }); }
  KLAB.kIn = null; KLAB.vIn = null;
  return { seed, stage, foe, pct, x0: +x0.toFixed(1), dist: +dist.toFixed(1), def: def === 'cpu9' ? 'cpu9' : def ? def.desc : 'still', finds };
}
module.exports = { play, program };
if (require.main === module) {
  const res = [], tally = {};
  for (let s = S0; s < S0 + N; s++) { const r = play(s); if (r.finds.length) { res.push(r); for (const x of r.finds) tally[x.k] = (tally[x.k] || 0) + 1; } }
  console.log(JSON.stringify(tally)); if (OUT) require('fs').writeFileSync(OUT, JSON.stringify({ N, S0, tally, res }, null, 1));
}
