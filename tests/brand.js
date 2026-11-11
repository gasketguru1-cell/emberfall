// Brand, the night-watch captain: scripted checks against the owner's document for fighter 03 (frames, damage, shapes,
// movement, the guard on Stove Door Bash, linking hits, landing rules, recovery).
// Usage: node tests/brand.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const BI = ROSTER.findIndex(d => d.name === 'Brand'), BR = [BI, 0], FL = [0, 0], HOD = [1, 2];
  const BF = ROSTER[BI].forms[0], mv = BF.moves, st = BF.st, fl = ROSTER[0].forms[0].st, H = fl.h, B = DMG_1V1 * FRESH, NIB = [1, 0];
  let SCRIPT = [null, null], t = 0; const results = [];
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
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.012 : tol);
  const tap = (at, len) => tt => tt >= at && tt < at + (len || 2);
  const pct = v => v.toFixed(1) + '%';
  /* Brand starts a move directly (so the frame count is exact) against a Flint standing gap away; returns what happened */
  function swing(name, gap, o) {
    o = o || {}; const [b, f] = setup(BR, FL, 0, gap); if (o.air) { airborne(b, 0, o.air); if (o.tAir !== undefined) airborne(f, gap, o.tAir); else f.y = 0; }
    if (o.back) b.face = -1; if (o.face) { b.face = o.face; f.face = -Math.sign(gap) || 1; }
    b.startMove(name); const out = { first: 0, hits: 0, pct: 0, vy: 0, vx: 0, last: 0 }; let p = 0;
    run(o.frames || mv[name].t + 30, () => { if (f.pct > p + 0.01) { out.hits++; if (!out.first) { out.first = b.mf; out.vy = f.vy; out.vx = f.vx; } p = f.pct; } });
    out.pct = f.pct; out.b = b; out.f = f; return out;
  }

  /* ---- the numbers are the document's ---- */
  {
    const h = k => mv[k].h[0], rows = [
      ['jab', 4, 5, 2.5, 60, 15, 25, 17], ['jab2', 5, 6, 2.5, 66, 17, 27, 20], ['jab3', 7, 9, 4.5, 42, 34, 59, 27], ['dash', 9, 12, 10, 54, 34, 67, 34], ['ftilt', 7, 9, 9, 36, 34, 67, 25],
      ['utilt', 7, 8, 8, 83, 27, 61, 26], ['dtilt', 6, 8, 7, 69, 24, 51, 24], ['fsmash', 16, 19, 17, 38, 40, 104, 48], ['dsmash', 12, 13, 13, 30, 40, 86, 43],
      ['fair', 7, 10, 9, 43, 32, 70, 31], ['bair', 8, 10, 13, 144, 39, 95, 35], ['uair', 6, 9, 8, 86, 25, 62, 28], ['nspec', 14, 16, 11, 40, 36, 72, 39], ['nspecH', 24, 26, 15, 37, 40, 88, 53],
      ['sspec', 12, 14, 10, 53, 35, 70, 39], ['uspec', 7, 9, 8, 76, 35, 62, 26], ['dspec', 15, 17, 11, 41, 37, 72, 40], ['ledgeatk', 20, 22, 8, 39, 42, 59, 47], ['getup', 19, 20, 7, 43, 45, 56, 48]];
    const bad = rows.filter(r => { const x = h(r[0]); return !(x.f0 === r[1] && x.f1 === r[2] && x.d === r[3] && x.a === r[4] && x.b === r[5] && x.k === Math.round(r[6] * (TUNE.Brand.kb || 1)) && mv[r[0]].t + 1 === r[7]); }).map(r => r[0]);
    check('document: active frames, damage, angle, launch and first free frame of ' + rows.length + ' moves', !bad.length, bad.length ? 'differs: ' + bad.join(', ') : 'all as listed (growth scaled by the balance setting ' + (TUNE.Brand.kb || 1) + ')');
    const u = mv.usmash.h, n = mv.nair.h, d = mv.dair.h, ds = mv.dsmash.h[1], ut = mv.utilt.h[1];
    check('document: two-part moves', u[0].f0 === 13 && u[0].d === 3 && u[1].f0 === 15 && u[1].f1 === 17 && u[1].d === 12 && n[0].f0 === 6 && n[0].d === 4 && n[1].f0 === 13 && n[1].d === 7 && d[0].d === 13 && d[0].a === 275 && d[1].d === 9 && d[3].f0 === 16 && d[3].d === 7 && ds.f0 === 17 && ds.d === 12 && ds.a === 149 && ut.f0 === 9 && ut.a === 96,
      'up smash 3% then 12%, neutral air 4% then 7%, down air 13% point / 9% blade / 7% late, down smash rear f17 12%, up tilt arc f9');
    const g = mv.grab.h[0], dg = mv.dgrab.h[0], pg = mv.pgrab.h[0], T = mv.throws;
    check('document: grabs, pummel and throws', g.f0 === 7 && mv.grab.t === 30 && dg.f0 === 10 && mv.dgrab.t === 38 && pg.f0 === 11 && mv.pgrab.t === 36 && st.pummel === 1.3 && T.f.d === 8 && T.f.a === 40 && T.f.f === 10 && T.b.d === 8 && T.b.a === 143 && T.b.f === 13 && T.u.d === 7 && T.u.f === 14 && T.d.d === 6 && T.d.a === 71 && T.d.f === 16,
      'grab f7, dash grab f10, turnaround f11; throws 8 / 8 / 7 / 6% released on f10 / 13 / 14 / 16');
    const ft = mv.ftilt.h[0], fs2 = mv.fsmash.h[0];
    check('document: shapes are in units of Flint\\u2019s height', near(ft.x / H, 0.90, 0.001) && near(ft.y / H, 0.59, 0.001) && near(ft.r / H, 0.14, 0.001) && near(ft.in[0] / H, 0.31, 0.001) && near(fs2.x / H, 1.04, 0.001) && near(fs2.r / H, 0.19, 0.001),
      'forward tilt S(' + (ft.in[0] / H).toFixed(2) + ',' + (ft.in[1] / H).toFixed(2) + ' > ' + (ft.x / H).toFixed(2) + ',' + (ft.y / H).toFixed(2) + ' / ' + (ft.r / H).toFixed(2) + ')');
    check('document: weight and movement against Flint', near(st.weight / fl.weight, 1.08) && near(st.walk / fl.walk, 1.06) && near(st.run / fl.run, 0.95) && near(st.dash / fl.dash, 1.02) && near(st.airSpeed / fl.airSpeed, 0.96) && near(st.grav / fl.grav, 1.02) && near(st.ffall / fl.ffall, 1.02) && near(st.hopH / fl.hopH, 1) && near(st.jumpH / fl.jumpH, 0.98) && near(st.airJumpH / fl.airJumpH, 0.97) && near(st.airMul / fl.airMul, 0.94) && near(st.runMul / fl.runMul, 1.02) && st.jsq === fl.jsq && st.jumps === 1,
      'weight ' + (st.weight / fl.weight * 100).toFixed(0) + ', walk ' + (st.walk / fl.walk * 100).toFixed(0) + ', run ' + (st.run / fl.run * 100).toFixed(0) + ', dash ' + (st.dash / fl.dash * 100).toFixed(0) + ', air drift ' + (st.airSpeed / fl.airSpeed * 100).toFixed(0) + ', gravity ' + (st.grav / fl.grav * 100).toFixed(0) + ', full hop ' + (st.jumpH / fl.jumpH * 100).toFixed(0) + ', air jump ' + (st.airJumpH / fl.airJumpH * 100).toFixed(0));
    const [b] = setup(BR, FL, 0, 60), stand = hurtRect(b); SCRIPT[0] = i => { i.ly = -1; }; run(6); const cr = hurtRect(b);
    check('document: body 1.03 x 0.56 H standing, 0.72 x 0.62 H crouching', near((stand[3] - stand[1]) / H, 1.03, 0.005) && near((stand[2] - stand[0]) / H, 0.56, 0.005) && near((cr[3] - cr[1]) / H, 0.72, 0.005) && near((cr[2] - cr[0]) / H, 0.62, 0.005),
      'standing ' + ((stand[3] - stand[1]) / H).toFixed(2) + ' x ' + ((stand[2] - stand[0]) / H).toFixed(2) + ', crouching ' + ((cr[3] - cr[1]) / H).toFixed(2) + ' x ' + ((cr[2] - cr[0]) / H).toFixed(2));
  }

  /* ---- every attack connects where its shape says, on its first active frame, for its damage ---- */
  {
    const fw = fl.w / 2, list = [['jab', 6], ['jab2', 9], ['jab3', 10], ['ftilt', 13], ['dtilt', 12], ['fsmash', 15], ['dash', 8], ['nspec', 14], ['nspecH', 18], ['dspec', 12], ['sspec', 9]], bad = [];
    for (const [k, gap] of list) { const r = swing(k, gap), h = mv[k].h[0]; if (!(r.hits === 1 && near(r.pct, h.d * B, 0.05) && r.first === h.f0)) bad.push(k + ' (' + r.hits + ' hits, ' + pct(r.pct) + ', frame ' + r.first + ')'); }
    check('ground attacks and specials hit once, on their first active frame, for their damage', !bad.length, bad.length ? bad.join('; ') : list.map(q => q[0]).join(', '));
    /* sword spacing: the blade's end reaches a Flint whose own forward tilt cannot reach back */
    const tip = mv.ftilt.h[0].x + mv.ftilt.h[0].r + fw - 0.3, r = swing('ftilt', tip), miss = swing('ftilt', tip + 1.2);
    const [b2, f2] = setup(BR, FL, 0, tip); f2.startMove('ftilt'); run(40);
    check('spacing: the end of the blade hits; Flint\\u2019s forward tilt from the same spot does not reach', r.hits === 1 && miss.hits === 0 && b2.pct === 0, 'at ' + (tip / H).toFixed(2) + ' H apart: Brand hit ' + r.hits + ', Flint hit ' + (b2.pct > 0 ? 1 : 0) + '; ' + ((tip + 1.2) / H).toFixed(2) + ' H: Brand hit ' + miss.hits);
    const inner = swing('ftilt', 5), outer = swing('ftilt', tip);
    check('the blade hits the same along its length', near(inner.pct, outer.pct, 0.01) && near(inner.pct, 9 * B, 0.05), 'close ' + pct(inner.pct) + ', at the end ' + pct(outer.pct));
    /* jab chain by pressing attack */
    { const [b, f] = setup(BR, FL, 0, 7); SCRIPT[0] = (i, tt) => { i.atk = tt % 6 < 2; }; let seen = new Set(); run(70, () => { if (b.state === 'attack') seen.add(b.mname); });
      check('jab: three presses give Hilt Rap, Quick Cut, Watch Cut', seen.has('jab') && seen.has('jab2') && seen.has('jab3') && f.pct > 9 * B && f.pct < 12, [...seen].join(' > ') + ', target at ' + pct(f.pct) + ' (9.5% before the one-on-one bonus)'); }
    /* two-phase moves that hit once */
    const ut = swing('utilt', 6), utb = swing('utilt', -5, { face: 1 }), ds = swing('dsmash', 9), dsb = swing('dsmash', -9, { face: 1 }), gu = swing('getup', 7), gub = swing('getup', -7, { face: 1 });
    check('up tilt, down smash and floor attack: one hit a target, front or behind', ut.hits === 1 && ut.first === 7 && utb.hits === 1 && utb.first >= 9 && ds.hits === 1 && ds.first === 12 && dsb.hits === 1 && dsb.first === 17 && dsb.vx < 0 && gu.hits === 1 && gub.hits === 1 && gub.first === 24,
      'up tilt front f' + ut.first + ' / behind f' + utb.first + '; down smash front f' + ds.first + ' / behind f' + dsb.first + ' (sent ' + (dsb.vx < 0 ? 'backward' : 'forward') + '); floor attack front f' + gu.first + ' / behind f' + gub.first);
    /* linking hits */
    const us = swing('usmash', 6), us2 = swing('usmash', 6, {}); const high = (() => { const [b, f] = setup(BR, FL, 0, 6); f.pct = 120; b.startMove('usmash'); let n = 0, p = 120; run(60, () => { if (f.pct > p + 0.01) { n++; p = f.pct; } }); return n; })();
    check('up smash: the scoop lifts the target a set distance into the cleave, at 0% and at 120%', us.hits === 2 && near(us.pct, 15 * B, 0.3) && high === 2, 'at 0%: ' + us.hits + ' hits, ' + pct(us.pct) + ' (15% before the bonus); at 120%: ' + high + ' hits');
    const na = swing('nair', 5, { air: 20, tAir: 20 }), naHigh = (() => { const [b, f] = setup(BR, FL, 0, 5); airborne(b, 0, 20); airborne(f, 5, 20); f.pct = 120; b.startMove('nair'); let n = 0, p = 120; run(40, () => { if (f.pct > p + 0.01) { n++; p = f.pct; } }); return n; })();
    check('neutral air: hilt then blade both hit a close target, at 0% and at 120%', na.hits === 2 && near(na.pct, 11 * B, 0.3) && naHigh === 2, 'at 0%: ' + na.hits + ' hits, ' + pct(na.pct) + ' (11% before the bonus); at 120%: ' + naHigh + ' hits');
  }

  /* ---- air: spacing, the down air's point, landing ---- */
  {
    const fa = swing('fair', 13, { air: 12, tAir: 12 }), ba = swing('bair', 13, { air: 12, tAir: 12, back: 1 }), ua = swing('uair', 0, { air: 4, tAir: 20 });
    check('forward, back and up air hit for 9%, 13% and 8%', fa.hits === 1 && near(fa.pct, 9 * B, 0.1) && ba.hits === 1 && near(ba.pct, 13 * B, 0.1) && ba.vx > 0 && ua.hits === 1 && near(ua.pct, 8 * B, 0.1), 'forward ' + pct(fa.pct) + ', back ' + pct(ba.pct) + ' (sent behind her), up ' + pct(ua.pct));
    const sp = swing('dair', 1.5, { air: 30, tAir: 24.5 }), gnd = swing('dair', 1.5, { air: 20 });
    check('down air: the point sends an airborne target down; a standing one is popped up', sp.hits === 1 && near(sp.pct, 13 * B, 0.1) && sp.vy < -0.5 && gnd.hits === 1 && near(gnd.pct, 9 * B, 0.1) && gnd.vy > 0, 'in the air: ' + pct(sp.pct) + ', sent ' + (sp.vy < 0 ? 'down' : 'up') + '; standing: ' + pct(gnd.pct) + ', sent ' + (gnd.vy > 0 ? 'up' : 'down'));
    /* landing lag: Brand is dropped onto the floor at a chosen frame of each aerial */
    const lagAt = (name, mf) => { const [b] = setup(BR, FL, 0, 60); airborne(b, 0, 0.6); b.startMove(name); b.mf = mf - 1; b.vy = -1; let lag = -1; run(3, () => { if (b.state === 'land' && lag < 0) lag = b.lag; }); return lag; };
    const rows = [['nair', 10, 4, 32], ['fair', 9, 4, 26], ['bair', 12, 5, 31], ['uair', 8, 4, 25], ['dair', 15, 5, 38]], bad = [];
    for (const [k, ll, a0, a1] of rows) { const e = lagAt(k, a0), m1 = lagAt(k, a0 + 1), m2 = lagAt(k, a1 - 1), l = lagAt(k, a1); if (!(e <= 4 && m1 === ll && m2 === ll && l <= 4)) bad.push(k + ': f' + a0 + ' ' + e + ', f' + (a0 + 1) + ' ' + m1 + ', f' + (a1 - 1) + ' ' + m2 + ', f' + a1 + ' ' + l); }
    check('landing lag and auto-cancel windows of the five aerials', !bad.length, bad.length ? bad.join('; ') : 'neutral 10 (free 1-4, 32+), forward 9 (1-4, 26+), back 12 (1-5, 31+), up 8 (1-4, 25+), down 15 (1-5, 38+)');
  }

  /* ---- Hot Iron Thrust ---- */
  {
    const thrust = (hold, gap) => { const [b, f] = setup(BR, FL, 0, gap); SCRIPT[0] = (i, tt) => { if (tt >= 1 && tt < 1 + hold) i.spc = true; }; let first = 0, name = ''; run(80, () => { if (!first && f.pct > 0) { first = b.mf; name = b.mname; } }); return { first, pct: f.pct, name }; };
    const tapT = thrust(3, 14), held = thrust(14, 14), far = thrust(14, 21), farTap = thrust(3, 21);
    check('thrust: a tap strikes on frame 14 for 11%; held through frame 9 it strikes on frame 24 for 15% and reaches further', tapT.first === 14 && near(tapT.pct, 11 * B, 0.05) && held.first === 24 && near(held.pct, 15 * B, 0.05) && far.first === 24 && farTap.first === 0,
      'tap: f' + tapT.first + ' ' + pct(tapT.pct) + '; held: f' + held.first + ' ' + pct(held.pct) + '; at 1.5 H the held one hits and the tap ' + (farTap.first ? 'hits' : 'misses'));
  }

  /* ---- Stove Door Bash ---- */
  {
    /* Brand is put on a chosen frame of the bash and Flint strikes with a real hitbox from where he stands */
    const bash = (o) => { const [b, f] = setup(BR, FL, 0, o.gap === undefined ? 7 : o.gap); if (o.air) { airborne(b, 0, 20); airborne(f, 7, 20); } b.face = 1; b.startMove('sspec'); b.mf = o.mf === undefined ? 6 : o.mf; const hp = b.shieldHp;
      if (o.grab) { f.startMove('grab'); f.mf = f.form.moves.grab.h[0].f0 - 1; run(2); return { held: b.state === 'held' }; }
      const at = [b.x + (o.gap < 0 ? -4 : 4), b.y + (o.y === undefined ? 7.5 : o.y), 3];
      applyHit(f, b, { d: o.d, a: 45, b: 20, k: 30, id: 'test:' + o.d }, f.face, f.x, !!o.proj, false, o.proj ? undefined : at);
      const r = { took: b.pct, state: b.state, cost: hp - b.shieldHp, lagB: b.hitlag, lagF: f.hitlag }; let hit = 0; run(40, () => { if (f.pct > 0 && !hit) hit = b.mf; }); r.bashHit = hit; r.fpct = f.pct; return r; };
    const light = bash({ d: 7 }), heavy = bash({ d: 12 }), behind = bash({ d: 7, gap: -7 }), above = bash({ d: 7, y: 20 }), early = bash({ d: 7, mf: 4 }), late = bash({ d: 7, mf: 9 }), proj = bash({ d: 5, proj: 1 }), air = bash({ d: 7, air: 1 }), grabbed = bash({ grab: 1 });
    check('bash: a 7% strike from the front on frames 5 to 8 is stopped, costs shield, and the bash still lands on frame 12', light.took === 0 && light.state === 'attack' && near(light.cost, 7 * B * SHIELD.dmg, 0.01) && light.lagB > 0 && light.lagB === light.lagF && light.bashHit === 12 && near(light.fpct, 10 * B, 0.05),
      'took ' + pct(light.took) + ', shield -' + light.cost.toFixed(1) + ', both frozen ' + light.lagB + ' frames, bash hit on f' + light.bashHit + ' for ' + pct(light.fpct));
    check('bash: a 12% swing, a hit from behind, from above, a grab, a projectile and any hit in the air all get through', heavy.took > 0 && behind.took > 0 && above.took > 0 && grabbed.held && proj.took > 0 && air.took > 0,
      '12%: ' + pct(heavy.took) + '; behind: ' + pct(behind.took) + '; above: ' + pct(above.took) + '; grab: ' + (grabbed.held ? 'caught' : 'missed') + '; projectile: ' + pct(proj.took) + '; in the air: ' + pct(air.took));
    check('bash: no guard before frame 5 or after frame 8', early.took > 0 && late.took > 0, 'frame 4: ' + pct(early.took) + '; frame 9: ' + pct(late.took));
    const two = (() => { const [b, f] = setup(BR, FL, 0, 7); b.startMove('sspec'); b.mf = 6; const at = [4, 7.5, 3]; applyHit(f, b, { d: 3, a: 45, b: 20, k: 30, id: 'test:a' }, f.face, f.x, false, false, at); b.hitlag = 0; applyHit(f, b, { d: 3, a: 45, b: 20, k: 30, id: 'test:b' }, f.face, f.x, false, false, at); return b.pct; })();
    check('bash: the guard stops one strike only', two > 0, 'a second 3% strike in the window: ' + pct(two));
    const step = (() => { const [b] = setup(BR, FL, 0, 60); b.startMove('sspec'); const x0 = b.x; run(20); return b.x - x0; })(), stepAir = (() => { const [b] = setup(BR, FL, 0, 60); airborne(b, 0, 30); b.startMove('sspec'); const x0 = b.x; run(15); return b.x - x0; })();
    check('bash: steps 0.32 H on the ground, at most 0.18 H in the air', near(step / H, 0.32, 0.02) && stepAir / H <= 0.19 && stepAir > 0, 'ground ' + (step / H).toFixed(2) + ' H, air ' + (stepAir / H).toFixed(2) + ' H');
    const airHit = swing('sspec', 8, { air: 20, tAir: 20 });
    check('bash: in the air it hits for 8%', airHit.hits === 1 && near(airHit.pct, 8 * B, 0.05), pct(airHit.pct));
    /* through the real game: Flint's 7% forward tilt into the guard */
    const [b, f] = setup(BR, NIB, 0, 8); b.startMove('sspec'); f.startMove('ftilt'); let guard = false; run(45, () => { if (b.guarded) guard = true; });
    check('bash: played for real, a 7% forward tilt (Nib) is stopped and the bash hits back', guard && b.pct === 0 && f.pct > 0, 'guarded: ' + guard + ', Brand ' + pct(b.pct) + ', Nib ' + pct(f.pct));
  }

  /* ---- Watchfire Rise ---- */
  {
    const up = (lx) => { const [b] = setup(BR, FL, 0, 60); airborne(b, 0, 30); let top = 30, st0 = '', f25 = 0; SCRIPT[0] = (i, tt) => { if (tap(1)(tt)) { i.ly = 1; i.spc = true; } else i.lx = lx; }; run(34, () => { top = Math.max(top, b.y); if (b.state === 'attack' && b.mf === 24) f25 = b.y; if (!st0 && b.state !== 'attack' && b.state !== 'air') st0 = b.state; }); return { top, dx: b.x, st0, by: f25 }; };
    const a = up(0), s = up(1);
    const [b2] = setup(BR, FL, 0, 60); SCRIPT[0] = (i, tt) => { if (tap(1)(tt)) { i.ly = 1; i.spc = true; } }; let lag = 0, was = ''; run(140, () => { if (b2.state === 'land' && was === 'helpless') lag = b2.lag; was = b2.state; });
    check('rise: 2.05 H straight up, special fall after, 20 frames on landing', near((a.top - 30) / H, 2.05, 0.03) && a.st0 === 'helpless' && lag === 20, 'rose ' + ((a.top - 30) / H).toFixed(2) + ' H, then ' + a.st0 + ', landing ' + lag + ' frames');
    const [b3] = setup(BR, FL, 0, 60); airborne(b3, 0, 30); b3.startMove('uspec'); SCRIPT[0] = i => { i.lx = 1; }; run(25); const steer = b3.x;
    check('rise: steering moves it at most 0.46 H', steer / H <= 0.47 && steer / H > 0.35, (steer / H).toFixed(2) + ' H with the stick held over');
    const cut = swing('uspec', 4, { frames: 30 });
    check('rise: the cut hits on frame 7 for 8%', cut.hits === 1 && cut.first === 7 && near(cut.pct, 8 * B, 0.05), 'f' + cut.first + ', ' + pct(cut.pct));
    /* recovery: from under and beside the ledge */
    const rec = (x, y) => { const [b] = setup(BR, FL, 0, 0); airborne(b, x, y); b.jumps = 0; SCRIPT[0] = (i, tt) => { if (tap(1)(tt)) { i.ly = 1; i.spc = true; } else i.lx = -0.5; }; let ok = false; run(120, () => { if (b.state === 'ledge' || (b.grounded && b.plat === MAIN)) { ok = true; return false; } }); return ok; };
    const below = rec(EDGE + 6, -24), beside = rec(EDGE + 10, -12), deep = rec(EDGE + 6, -60), wide = rec(EDGE + 60, -20);
    check('rise: reaches the ledge from below and beside it; too deep or too far out it does not', below && beside && !deep && !wide, 'below ' + below + ', beside ' + beside + ', 4.3 H under ' + deep + ', 4.3 H out ' + wide);
  }

  /* ---- Night Step ---- */
  {
    const [b] = setup(BR, FL, 0, 60); b.startMove('dspec'); const x0 = b.x; let back = 0; run(39, () => { if (b.mf === 8) back = b.x - x0; }); const net = b.x - x0, free = b.state;
    check('step: back 0.28 H by frame 8, in again 0.16 H by frame 15, free on frame 40', near(back / H, -0.28, 0.01) && near(net / H, -0.12, 0.01) && free !== 'attack', 'back ' + (back / H).toFixed(2) + ' H, ends ' + (net / H).toFixed(2) + ' H from the start, ' + free + ' after 39 frames');
    const [e] = setup(BR, FL, -EDGE + 1, 0); e.startMove('dspec'); run(20);
    check('step: never backs off the stage', e.grounded && e.x >= -EDGE, 'started 1 from the edge, ended at ' + (e.x + EDGE).toFixed(1) + ' from it, ' + (e.grounded ? 'standing' : 'fell'));
    /* it slips a swing: Flint's jab reaches where she stood, not where she steps to */
    const [b4, f4] = setup(BR, FL, 0, 14.5); f4.startMove('ftilt'); f4.mf = 2; b4.startMove('dspec'); b4.mf = 2; run(45);
    const [b5, f5] = setup(BR, FL, 0, 14.5); f5.startMove('ftilt'); f5.mf = 2; run(45);
    check('step: steps out of a swing that would have hit, then cuts', b5.pct > 0 && b4.pct === 0 && f4.pct > 0, 'standing still she took ' + pct(b5.pct) + '; stepping she took ' + pct(b4.pct) + ' and hit back for ' + pct(f4.pct));
    const whiff = (() => { const [b6, f6] = setup(BR, FL, 0, 30); b6.startMove('dspec'); let shieldAt = 0; SCRIPT[0] = i => { i.shd = true; }; run(60, () => { if (!shieldAt && b6.state === 'shield') shieldAt = t; }); return shieldAt; })();
    check('step: a miss leaves her open until frame 40', whiff >= 39, 'first frame in shield after a miss: ' + (whiff + 1));
  }

  /* ---- grabs, throws, dash attack, ledge ---- */
  {
    const thr = (k, lx, ly) => { const [b, f] = setup(BR, FL, 0, 6); b.startMove('grab'); let rel = 0, dmg = 0, end = 0, sx = 0; SCRIPT[0] = (i, tt) => { if (b.state === 'hold' || b.state === 'throw') { i.lx = lx; i.ly = ly; } };
      run(120, () => { if (b.state === 'throw' && !rel && f.state !== 'held') { rel = b.sf; dmg = f.pct; sx = f.vx; } if (rel && !end && b.state !== 'throw') { end = t; return false; } }); return { rel, dmg, sx, held: rel > 0 }; };
    const f = thr('f', 1, 0), bk = thr('b', -1, 0), u = thr('u', 0, 1), d = thr('d', 0, -1);
    check('throws: released on frames 10, 13, 14 and 16 for 8, 8, 7 and 6%', f.rel === 10 && bk.rel === 13 && u.rel === 14 && d.rel === 16 && near(f.dmg, 8 * B, 0.05) && near(bk.dmg, 8 * B, 0.05) && near(u.dmg, 7 * B, 0.05) && near(d.dmg, 6 * B, 0.05) && f.sx > 0 && bk.sx < 0,
      'forward f' + f.rel + ' ' + pct(f.dmg) + ', back f' + bk.rel + ' ' + pct(bk.dmg) + ', up f' + u.rel + ' ' + pct(u.dmg) + ', down f' + d.rel + ' ' + pct(d.dmg));
    const reach = g => { const [b, fx] = setup(BR, FL, 0, g); b.startMove('grab'); let got = false; run(12, () => { if (fx.state === 'held') got = true; }); return got; };
    const gmax = mv.grab.h[0].x + mv.grab.h[0].r + fl.w / 2;
    check('grab: a short reach', reach(gmax - 0.4) && !reach(gmax + 0.6) && gmax / H < 1, 'catches to ' + (gmax / H).toFixed(2) + ' H between the two fighters, not beyond');
    const [b2] = setup(BR, FL, 0, 60); b2.startMove('dash'); const x0 = b2.x; let d10 = 0; run(12, () => { if (b2.mf === 10) d10 = b2.x - x0; });
    const [b3] = setup(BR, FL, 0, 60); b3.startMove('dgrab'); let d11 = 0; run(13, () => { if (b3.mf === 11) d11 = b3.x; });
    check('dash attack carries 0.39 H by frame 10, dash grab 0.33 H by frame 11', near(d10 / H, 0.39, 0.02) && near(d11 / H, 0.33, 0.02), 'dash attack ' + (d10 / H).toFixed(2) + ' H, dash grab ' + (d11 / H).toFixed(2) + ' H');
    const [b4, f4] = setup(BR, FL, 0, EDGE - 14); b4.x = EDGE + 5; b4.y = -st.h + 1; b4.grounded = false; b4.plat = null; b4.face = -1; b4.set('ledge'); f4.face = 1; let name = ''; SCRIPT[0] = (i, tt) => { if (tt >= 12 && tt < 14) i.atk = true; }; run(60, () => { if (b4.state === 'attack') name = b4.mname; });
    check('ledge attack: its own cut (8%, frames 20 to 22)', name === 'ledgeatk' && near(f4.pct, 8 * B, 0.05), 'move ' + name + ', target at ' + pct(f4.pct));
  }

  let fail = 0;
  for (const [ok, name, detail] of results) { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '\\n       ' + detail : '')); }
  console.log(results.length + ' checks, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})();
`);
