// Kestrel, the wandering blade: scripted checks of his moves as built (frames from the swordsman benchmark, hitboxes measured
// from his clips): every attack lands on its frames at a fitting spacing, the point is stronger than the edge, Wind Dance
// chains on fresh presses, Sundering Edge charges, Still Water answers, Kestrel Rise climbs, and CPU matches run clean.
// Usage: node tests/kestrel.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'movelist.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const KI = ROSTER.findIndex(d => d.name === 'Kestrel'), KS = [KI, 0], FL = [0, 0];
  const mv = ROSTER[KI].forms[0].moves;
  let SCRIPT = [null, null], t = 0; const results = []; const AI = cpuInput, SCR = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  function setup(A, Bp, xa, xb) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: Bp[0], ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = A[1]; F[1].fi = Bp[1];
    F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0;
    return F;
  }
  function run(n, each) { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } }
  function airborne(f, x, y) { f.x = x; f.y = y; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); }
  function check(name, ok, detail) { results.push([ok, name, detail || '']); }
  /* Kestrel starts a move directly against a Flint standing gap away (both hanging at o.air when given); what happened */
  function swing(name, gap, o) {
    o = o || {}; const [k, f] = setup(KS, FL, 0, gap); if (o.air) { airborne(k, 0, o.air); airborne(f, gap, o.tAir === undefined ? o.air : o.tAir); }
    if (o.dy) f.y += o.dy; if (o.back) { k.face = -Math.sign(gap); f.face = k.face; }
    k.startMove(name); const out = { first: 0, hits: 0, pct: 0, vy: 0 }; let p = 0;
    run(o.frames || mv[name].t + 4, () => { if (o.air && f.y > 0) { f.vy = 0; if (!f.grounded && f.state === 'air') f.y = o.tAir === undefined ? o.air : o.tAir; } if (f.pct > p + 0.01) { out.hits++; if (!out.first) { out.first = k.mf; out.vy = f.vy; } p = f.pct; } });
    out.pct = f.pct; out.k = k; out.f = f; return out;
  }
  /* the spacing at which a move lands at all, found by stepping Flint out from the body */
  function reach(name, o) { let best = 0; for (let g = 4; g <= 40; g += 1) { const r = swing(name, g, o); if (r.hits) best = g; } return best; }

  /* ---- every attack lands, on its own active frames ---- */
  const G = [['jab', 4], ['jab2', 5], ['ftilt', 7], ['utilt', 6, { dy: 0 }], ['dtilt', 7], ['dash', 12], ['fsmash', 10], ['usmash', 13], ['dsmash', 5],
    ['getup', 22], ['ledgeatk', 24]];
  const A = [['nair', 6], ['fair', 4], ['bair', 7], ['uair', 5], ['dair', 6]];
  const bad = [], rows = [];
  for (const [n, f0, o] of G) { let r = null; for (const g of [8, 10, 12, 14, 6]) { r = swing(n, n === 'dsmash' || n === 'getup' ? g : g, o); if (r.hits) break; } if (!r.hits || r.first < f0) bad.push(n); rows.push(n + ' f' + r.first + ' ' + r.pct.toFixed(1) + '%'); }
  for (const [n, f0] of A) { let r = null; for (const g of [8, 10, 12, 6, 4]) { const back = n === 'bair' ? -g : g, dy = n === 'uair' ? 12 : n === 'dair' ? -10 : 0; r = swing(n, back, { air: 40, tAir: 40 + dy, back: n === 'bair' }); if (r.hits) break; } if (!r.hits || r.first < f0) bad.push(n); rows.push(n + ' f' + r.first + ' ' + r.pct.toFixed(1) + '%'); }
  check('every normal lands on its active frames', !bad.length, bad.length ? 'missed or early: ' + bad.join(', ') + ' (' + rows.join(', ') + ')' : rows.join(', '));
  /* ---- the point is the strong part ---- */
  { const near = swing('fsmash', 9), far = swing('fsmash', reach('fsmash') - 1);
    check('forward smash: the point does more than the edge', far.hits && near.hits && far.pct > near.pct, 'close ' + near.pct.toFixed(1) + '%, spaced ' + far.pct.toFixed(1) + '% (reach ' + reach('fsmash') + ')'); }
  /* ---- Wind Dance chains on fresh presses, each direction its own ---- */
  { const [k, f] = setup(KS, FL, 0, 10); k.startMove('sspec'); const seen = [];
    SCRIPT[0] = (i, tt, ff) => { if (ff.state === 'attack' && ff.mf === 20) { i.spc = true; i.ly = ff.mname === 'sspec2s' ? -1 : ff.mname === 'sspec3d' ? -1 : 0; } };
    run(200, () => { if (k.state === 'attack' && seen[seen.length - 1] !== k.mname) seen.push(k.mname); });
    check('Wind Dance: four cuts on presses (level, then down twice)', seen.join(' ') === 'sspec sspec2s sspec3d sspec4d', seen.join(' > ') + ', ' + f.pct.toFixed(1) + '%');
    const [k2] = setup(KS, FL, 0, 10); k2.startMove('sspec'); const s2 = []; run(80, () => { if (k2.state === 'attack' && s2[s2.length - 1] !== k2.mname) s2.push(k2.mname); });
    check('Wind Dance: no press, no second cut', s2.join(' ') === 'sspec', s2.join(' > ')); }
  /* ---- Sundering Edge: tap for the plain thrust, hold for a stronger one ---- */
  { const tap = swing('nspec', 12);
    const [k, f] = setup(KS, FL, 0, 12); SCRIPT[0] = (i, tt) => { i.spc = tt < 40; }; k.startMove('nspec'); let p = 0, seen = new Set(); run(110, () => { seen.add(k.mname); });
    check('Sundering Edge: held, it charges and hits harder', seen.has('nspecC') && seen.has('nspecR') && f.pct > tap.pct + 4, 'tap ' + tap.pct.toFixed(1) + '%, held ' + f.pct.toFixed(1) + '%'); }
  /* ---- Still Water answers a strike from either side ---- */
  for (const side of [1, -1]) { const [k, f] = setup(KS, FL, 0, 10 * side); k.face = 1; f.face = -side; k.startMove('dspec'); let answered = false;
    run(70, () => { if (k.mf === 3 && f.state === 'attack' && !f.move) {} if (t === 2) f.startMove('ftilt'); if (k.mname === 'dspecHit') answered = true; });
    check('Still Water answers a forward tilt from ' + (side > 0 ? 'in front' : 'behind'), answered && k.pct === 0 && f.pct > 0, 'Kestrel ' + k.pct.toFixed(1) + '%, Flint ' + f.pct.toFixed(1) + '%'); }
  /* ---- Kestrel Rise climbs and ends in special fall ---- */
  { const [k] = setup(KS, FL, 0, 60); airborne(k, -30, 10); k.startMove('uspec'); const y0 = k.y; let top = y0, state = '';
    run(60, () => { top = Math.max(top, k.y); if (k.mf === 0 || k.state === 'helpless') state = state || k.state; });
    check('Kestrel Rise: climbs about two of his heights, then special fall', top - y0 > 22 && top - y0 < 36 && state === 'helpless', 'rose ' + (top - y0).toFixed(1) + ', then ' + state); }
  /* ---- CPU matches against the roster run clean ---- */
  { let badN = 0, done = 0; const msg = [];
    for (let o = 0; o < ROSTER.length; o++) { setup(KS, [o, 0], -30, 30); cpuInput = AI;
      let n = 0; while (mode === 'play' && n++ < 30000) { step(); for (const f of F) if (!isFinite(f.x) || !isFinite(f.y)) badN++; }
      done++; msg.push(ROSTER[o].name + ' ' + (mode === 'play' ? 'timeout' : 'ok')); cpuInput = SCR; }
    check('CPU Kestrel against every fighter: no broken numbers', badN === 0, msg.join(', ')); }

  let fail = 0; for (const [ok, name, d] of results) { if (!ok) fail++; console.log((ok ? 'pass  ' : 'FAIL  ') + name.padEnd(56) + d); }
  console.log(fail ? fail + ' of ' + results.length + ' Kestrel checks fail' : 'all ' + results.length + ' Kestrel checks pass'); if (fail) process.exitCode = 1;
})();
`);
