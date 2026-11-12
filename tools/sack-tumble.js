// Potato Sack Tumble technology, measured in the real game headless: momentum into each cancel, the landing buffer's saved lag,
// reversals, cross-ups through a shield, platforms, edges and recovery. Testing only. node tools/sack-tumble.js out.json
require('./sack-probe.js');
const run = (route, sit, each) => KLAB.run(route, Object.assign({ me: SLAB.ME, foe: [0, 0], x0: -40, dist: 150, maxFrames: 260, tail: 160 }, sit), each);
const R = {};
/* 1. momentum: the slide's speed carried into whatever cancels it */
R.carry = [];
for (const X of ['jab', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'grab_f', 'sh', 'fh', 'wd_f', 'bomb', 'bag', 'uspecG', 'tum_b', 'tum_f', 'tum_u', 'tum_n']) {
  let start = null, x0 = 0, v0 = 0, end = null, n = 0, mv = '', airVx = null;
  run('tum_f ' + X, {}, (t, f) => { if (t < 0) return;
    if (start === null && t > 8 && !(f.state === 'attack' && f.mname === 'dspec' && f.mf > 0) && f.state !== 'idle') { start = t; x0 = f.x; v0 = f.vx; mv = f.state + ':' + (f.mname || ''); }
    if (start !== null && end === null) { n++; if (!f.grounded) airVx = Math.max(airVx || 0, Math.abs(f.vx));
      if (n > 1 && (f.state === 'idle' || (f.grounded && n > 3 && /^(sh|fh)$/.test(X)) || n > 60)) end = { t, x: f.x }; } });
  R.carry.push({ cancel: X, outAs: mv, firstFrameVx: +v0.toFixed(2), travelled: end ? +(end.x - x0).toFixed(1) : null, frames: end ? end.t - start : null, maxAirVx: airVx === null ? null : +airVx.toFixed(2) });
}
R.baseAirVx = (() => { let m = 0; run('run run fh', {}, (t, f) => { if (!f.grounded) m = Math.max(m, Math.abs(f.vx)); }); return +m.toFixed(2); })();
/* the same moves from a standstill, for comparison */
R.still = [];
for (const X of ['fsmash', 'usmash', 'dsmash', 'grab_f', 'jab', 'utilt']) { let x0 = null, x1 = 0; run('w2 ' + X, {}, (t, f) => { if (t === 0) x0 = f.x; x1 = f.x; }); R.still.push({ move: X, travelled: +(x1 - x0).toFixed(1) }); }
/* 2. landing lag: an aerial landed normally vs the same press out of a tumble (the landing buffer) */
R.landing = [];
for (const a of ['nair', 'fair', 'bair', 'uair', 'dair']) {
  const lagOf = route => { let lag = 0, seen = false, act = -1, l0 = -1; run(route, {}, (t, f) => { if (f.state === 'land') { if (l0 < 0) l0 = t; lag++; } if (l0 >= 0 && act < 0 && f.state !== 'land') act = t; }); return lag; };
  R.landing.push({ aerial: a, normalLandLag: lagOf('fh w20 ' + a + ' ff'), outOfTumble: lagOf('fh w6 tum_n w10 L' + ({ nair: 'jab', fair: 'ftilt', bair: 'ftilt', uair: 'utilt', dair: 'dtilt' })[a]) });
}
/* 3. reversal: slide one way, then the other (tum_b out of the frame-7 cancel), and a push back (tx, which ends it) */
R.reverse = [];
for (const [nm, rt] of [['slide, then back slide', 'tum_f tum_b'], ['slide, push back (ends it)', 'tum_f tx'], ['air dive, back dive (2nd air tumble?)', 'fh w6 tum_f tum_b'], ['air dive, push back (ends it)', 'fh w6 tum_f tx']]) {
  const vs = []; run(rt, { x0: 0 }, (t, f) => { if (t >= 0 && t < 40) vs.push(+f.vx.toFixed(2)); }); const flip = vs.findIndex((v, i) => i > 0 && Math.sign(v) !== Math.sign(vs[i - 1]) && Math.abs(v) > 0.3);
  R.reverse.push({ name: nm, route: rt, vxTrace: vs.filter((v, i) => i % 2 === 0).slice(0, 18), reversedAtFrame: flip });
}
/* 4. cross-up: slide at a shielding opponent: does he pass through, and where does he stop? */
R.crossup = [];
for (const d of [6, 10, 16, 24, 32]) for (const X of ['', ' grab_b', ' Lgrab_b', ' fsmash']) {
  const shield = (v, a) => { const i = blankIn(); i.shd = true; return i; };
  let side0 = 0, side1 = 0, grabbed = false, shHits = 0, passed = -1;
  const r = run('tum_f' + X, { x0: -10, dist: d, def: shield }, (t, f, v) => { if (t === 0) side0 = Math.sign(v.x - f.x); side1 = Math.sign(v.x - f.x); if (passed < 0 && side1 !== side0 && side1) passed = t; if (v.state === 'held') grabbed = true; if (v.hitlag > 0) shHits++; });
  R.crossup.push({ dist: d, then: X.trim() || '(nothing)', passedThrough: passed >= 0, passedAtFrame: passed, endedBehind: side1 !== side0, grabbedFromBehind: grabbed, hitShield: shHits > 0, endGap: +(r.vx - r.kx).toFixed(1) });
}
/* 5. platforms: slide on a platform with down (drops through, keeping speed), dive through a platform with down held */
R.platform = [];
for (const [nm, rt, sit] of [['tum_d on a platform', 'tum_d w30', { plat: 'foe', dist: -10 }], ['tum_f on a platform (off its end)', 'tum_f w40', { plat: 'foe', dist: -10 }], ['dive with down held, over a platform', 'fh w10 dj w8 tum_d w40', { x0: 10 }], ['dive, no down, over a platform', 'fh w10 dj w8 tum_f w40', { x0: 10 }]]) {
  const onP = sit.plat === 'foe'; const tr = []; const r = run(rt, onP ? { x0: -40, dist: -20 } : Object.assign({ dist: 100 }, sit), (t, f) => { if (t === -1 && onP) { const q = PLATS[2]; f.x = 30; f.y = q.y; f.plat = q; f.grounded = true; f.face = -1; }
    if (t >= 0 && t % 4 === 0 && t < 70) tr.push([+f.x.toFixed(0), +f.y.toFixed(0), f.grounded ? 'G' : 'A', +f.vx.toFixed(1)]); });
  R.platform.push({ name: nm, route: rt, trace: tr });
}
/* 6. edges and recovery: slide off the ledge (how far out does he go, can he get back), and his height from a double jump + lift + Hot Potato */
R.edge = [];
for (const [nm, rt, sit] of [['slide off the ledge, no input', 'tum_b w90', { x0: 45 }], ['slide off, jump back', 'tum_b w14 dj w60', { x0: 45 }], ['slide off, jump back, lift', 'tum_b w14 dj w10 tum_u w60', { x0: 45 }], ['slide off, dj, lift, Hot Potato', 'tum_b w14 dj w10 tum_u w14 uspec w60', { x0: 45 }], ['slide off, Hot Potato at once', 'tum_b w8 uspec w90', { x0: 45 }]]) {
  let maxX = -999, minY = 999, died = false, back = false; const r = run(rt, Object.assign({ dist: -90 }, sit), (t, f) => { if (t < 0) return; maxX = Math.max(maxX, f.x); minY = Math.min(minY, f.y); if (f.state === 'dead') died = true; if (t > 30 && f.grounded && Math.abs(f.x) < EDGE) back = true; });
  R.edge.push({ name: nm, route: rt, furthestX: +maxX.toFixed(1), lowestY: +minY.toFixed(1), died, backOnStage: back });
}
/* 7. recovery reach: from a point below and outside the ledge, which tools get him back (he can't hold the ledge) */
R.recovery = [];
for (const [ox, oy] of [[90, -10], [110, -20], [130, -30], [150, -40], [170, -50], [100, -60], [90, -80]]) for (const rt of ['dj w6 tum_u w12 uspec w90', 'tum_u w12 dj w12 uspec w90', 'dj w6 uspec w90', 'uspec w20 dj w6 tum_u w90']) {
  let back = false, died = false; KLAB.run(rt, { me: SLAB.ME, foe: [0, 0], x0: 0, dist: -30, maxFrames: 320, tail: 200, lead: 1 }, (t, f) => { if (t === -1) { f.x = ox; f.y = oy; f.grounded = false; f.plat = null; f.set('air'); f.face = -1; f.jumps = 1; f.vx = 0; f.vy = 0; }
    if (t > 0 && f.grounded && f.plat === PLATS[0]) back = true; if (f.state === 'dead') died = true; });
  R.recovery.push({ from: [ox, oy], route: rt, made: back && !died });
}
const out = process.argv[2]; if (out) require('fs').writeFileSync(out, JSON.stringify(R, null, 1));
for (const k in R) { console.log('== ' + k); for (const x of [].concat(R[k])) console.log('  ' + JSON.stringify(x).slice(0, 260)); }
