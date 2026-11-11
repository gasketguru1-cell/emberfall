// Combat audit: numbers to compare before and after a change to how fights feel.   node tests/combat-audit.js
//  1. movement: frames to reach walk, dash and air speed, to stop, to turn round, hop air times
//  2. coverage: for every ground and air attack, the nearest and farthest a standing target can be and still be hit
//  3. gaps: attacks and shots that move fast enough to pass through a target between two frames
//  4. combos: frames the attacker is free before the victim is, after each fighter's usual starters, at 20% and 60%
//  5. edge: how far outside the ledge a recovering fighter can be reached by someone standing at the edge
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0, 'Flint'], [1, 0, 'Nib'], [1, 1, 'Loom'], [1, 2, 'Hod'], [2, 0, 'Potato Sack'], [3, 0, 'Sprocket'], [4, 0, 'Scuttle']].concat(ROSTER[5].forms.map((fm, k) => [5, k, fm.label || fm.name]));   /* and the ten Furious Fowls forms */
  let SCRIPT = [null, null], t = 0; cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  function setup(A, B, xa, xb) { slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: B[0], ready: true }; startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = A[1]; F[1].fi = B[1]; F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0; return F; }
  const run = (n, each) => { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } };
  const air = (f, x, y) => { f.x = x; f.y = y; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); };
  const out = {};
  /* 1. movement */
  out.movement = forms.map(A => { const st = ROSTER[A[0]].forms[A[1]].st, r = { fighter: A[2] };
    const until = (script, done, max) => { const [f] = setup(A, [0, 0], -50, 60); SCRIPT[0] = (i, tt) => { if (tt >= 2) script(i, tt - 2, f); }; let n = 0; run((max || 200) + 2, () => { n++; return n <= 2 || !done(f, n - 2); }); return n - 2; };   /* two neutral frames first, so a held stick is a flick (a stick already held when the match starts is a walk) */
    r['walk full (f)'] = until((i) => { i.lx = 0.55; }, f => Math.abs(f.vx) >= st.walk * 0.55 - 0.01);
    r['dash to run speed (f)'] = until((i) => { i.lx = 1; }, f => f.state === 'run');
    r['stop from run (f)'] = until((i, tt) => { i.lx = tt < 40 ? 1 : 0; }, (f, n) => n > 41 && f.vx === 0) - 40;
    r['turn from run (f)'] = until((i, tt) => { i.lx = tt < 40 ? 1 : -1; }, (f, n) => n > 41 && f.vx <= -st.run * 0.9, 120) - 40;
    r['air drift full (f)'] = (() => { const [f] = setup(A, [0, 0], 0, 60); air(f, 0, 100);   /* below the ceiling (140 since 2026-11-10) */ SCRIPT[0] = (i) => { i.lx = 1; }; let n = 0; run(80, () => { n++; return f.vx < st.airSpeed - 0.01; }); return n; })();
    const hop = (hold) => { const [f] = setup(A, [0, 0], 0, 60); PLATS.length = 1; SCRIPT[0] = (i, tt) => { i.jmp = hold ? tt >= 2 && tt < 20 : tt === 2 || tt === 3; }; let n = 0, up = false; run(200, () => { if (!f.grounded) { up = true; n++; } return !(up && f.grounded); }); return n; };
    const plats = PLATS.slice(); r['short hop air (f)'] = hop(false); r['full hop air (f)'] = hop(true); PLATS.length = 0; plats.forEach(q => PLATS.push(q)); return r; });
  /* 2. coverage and 3. gaps: a standing Flint at every distance; the attack hits or it does not */
  const NORMALS = ['jab', 'ftilt', 'utilt', 'dtilt', 'dash', 'fsmash', 'usmash', 'dsmash', 'nair', 'fair', 'bair', 'uair', 'dair', 'nspec', 'sspec', 'dspec'];
  out.coverage = []; out.gaps = [];
  for (const A of forms) for (const name of NORMALS) { const mv = ROSTER[A[0]].forms[A[1]].moves[name]; if (!mv || !mv.h || mv.swap) continue; const aerial = !!mv.air, hits = [];
    for (let d = -24; d <= 40; d += 1) { const [f, o] = setup(A, [0, 0], 0, d); f.face = 1; o.face = -1; o.ctl = new Ctl('none'); if (aerial) { air(f, 0, name === 'dair' ? 18 : 4); f.vy = name === 'dair' ? 0 : 0.6; }   /* a down air is tried from above the target's head */ if (name === 'dash') { f.vx = f.st.run; f.x -= 10; o.x = d; }
      const x0 = f.x; f.startMove(name); run(Math.min(mv.t + 4, 70), () => o.pct === 0 && PROJ.length < 9); if (o.pct > 0) hits.push(d - (name === 'dash' ? 0 : 0)); }
    if (!hits.length) { out.coverage.push({ fighter: A[2], move: name, nearest: '-', farthest: '-', holes: 'never hits a standing target' }); continue; }
    const fwd = hits.filter(d => d >= 0), holes = []; for (let d = Math.min(...hits); d <= Math.max(...hits); d++) if (!hits.includes(d)) holes.push(d);
    out.coverage.push({ fighter: A[2], move: name, nearest: Math.min(...hits.map(Math.abs)), farthest: Math.max(...hits), behind: Math.min(...hits) < 0 ? Math.min(...hits) : '', holes: holes.join(' ') });
    if (holes.length) out.gaps.push(A[2] + ' ' + name + ': misses at ' + holes.join(', ') + ' inside its own reach'); }
  /* 4. combos: the attacker's free frame against the end of the victim's hitstun */
  out.combos = [];
  for (const A of forms) for (const name of ['dtilt', 'utilt', 'ftilt', 'nair', 'uair', 'throw d', 'throw u']) for (const pct of [20, 60]) {
    const mvs = ROSTER[A[0]].forms[A[1]].moves, thr = name.startsWith('throw'), mv = thr ? mvs.grab : mvs[name], h = mv.h[0], d = Math.max(2, Math.min(Math.abs(h.x), 9));
    /* an aerial is tried against a target at a few spacings in front (spinning and arcing aerials do not hit inside the body) */
    const spots = mv.air ? (name === 'uair' ? [[1, 12], [4, 12], [6, 10], [8, 14]] : [[1, 3], [4, 3], [7, 3], [10, 4]]) : [null];
    let hitAt = -1, freeA = -1, freeV = -1, sep = 0;
    for (const sp of spots) { const [f, o] = setup(A, [0, 0], 0, name === 'utilt' || name === 'uair' ? 1 : d); o.ctl = new Ctl('none'); o.pct = pct; if (sp) { air(f, 0, 20); air(o, sp[0], sp[1] + 17); }   /* high enough that slower aerials come out before landing */
    if (thr) SCRIPT[0] = (i, tt) => { if (tt < 2) i.grb = true; if (f.state === 'hold' && f.sf > 3) i.ly = name === 'throw d' ? -1 : 1; }; else f.startMove(name);
    hitAt = -1; freeA = -1; freeV = -1; sep = 0; run(160, () => { if (hitAt < 0 && o.state === 'hurt') hitAt = t; if (hitAt >= 0) { if (freeA < 0 && f.state !== 'attack' && f.state !== 'throw' && f.state !== 'land' && f.state !== 'hold') freeA = t; if (freeV < 0 && o.state !== 'hurt') { freeV = t; sep = Math.hypot(o.x - f.x, o.y - f.y); } } return freeA < 0 || freeV < 0; }); if (hitAt >= 0) break; }
    out.combos.push({ fighter: A[2], move: name, 'at %': pct, 'attacker ahead by (f)': hitAt < 0 ? 'no hit' : freeV - freeA, 'apart then': hitAt < 0 ? '' : +sep.toFixed(0) }); }
  /* 5. edge: a recovering Flint hangs just outside the ledge; how far out and how low can each fighter's edge attacks reach from the lip? */
  out.edge = forms.map(A => { const r = { fighter: A[2] }; for (const name of ['dtilt', 'fsmash', 'dsmash']) { let far = -1, low = 1;
      for (let dx = 2; dx <= 26; dx += 2) for (let dy = 0; dy >= -22; dy -= 2) { const [f, o] = setup(A, [0, 0], EDGE - 3, 0); o.ctl = new Ctl('none'); air(o, EDGE + dx, dy - o.st.h * 0.5); o.vy = 0; f.face = 1; f.startMove(name); const y0 = o.y;
        run(40, () => { o.y = y0; o.vy = 0; o.vx = 0; o.ledgeCd = 99; return o.pct === 0; }); if (o.pct > 0) { far = Math.max(far, dx); low = Math.min(low, dy); } }
      r[name + ' out'] = far; r[name + ' below lip'] = low > 0 ? '-' : -low;
      /* and someone actually hanging on the ledge, once their protection has run out */
      const [f, o] = setup(A, [0, 0], EDGE - 4, 0); o.ctl = new Ctl('none'); air(o, EDGE + 6, -8); o.vy = -0.5; run(12); const hung = o.state === 'ledge'; o.invuln = 0; f.face = 1; f.startMove(name); run(40, () => { o.invuln = 0; o.sf = 3; return o.pct === 0; }); r[name + ' hits a hanger'] = hung ? (o.pct > 0 ? 'yes' : 'no') : '?'; } return r; });
  const only = process.argv[2];
  for (const k of ['movement', 'coverage', 'combos', 'edge']) if (!only || only === k) { console.log('== ' + k); console.table(out[k]); }
  if (!only || only === 'gaps') { console.log('== gaps (' + out.gaps.length + ')'); out.gaps.forEach(g => console.log('  ' + g)); }
})();
`);
