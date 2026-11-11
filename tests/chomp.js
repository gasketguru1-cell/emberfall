// Chomp Chomp's hot coal, rope and ant, checked against the owner's design v2 (2026-11-10), in the real game code.
//   node tests/chomp.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const CH = ROSTER.findIndex(d => d.name === 'Chomp Chomp'), FL = 0;
  let SCRIPT = [null, null], t = 0; const results = [];
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  function setup(xa, xb, pct) {
    TRAINING = true; slots[0] = { dev: 'kb', pick: CH, ready: true }; slots[1] = { dev: 'kb', pick: FL, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    for (const f of F) f.ctl = new Ctl('cpu'); F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; F[1].pct = pct || 0;
    PROJ.length = 0; SCRIPT = [null, null]; t = 0; return F;
  }
  const run = (n, each) => { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } };
  const check = (name, ok, detail) => results.push([ok, name, detail || '']);
  const coal = () => PROJ.find(p => p.tag === 'coal' && p.life > 0), ant = () => PROJ.find(p => p.tag === 'ant' && p.life > 0);
  /* press special for 1 frame at time tt (and stick from opt) */
  const B = (at, o) => (i, tt) => { if (tt === at) { i.spc = true; Object.assign(i, o || {}); } };

  /* 1. the throw: on frame 13, swinging on a rope, hits from frame 18 */
  { const [c, o] = setup(-40, 60); let born = -1; SCRIPT[0] = B(1); run(40, () => { const p = coal(); if (p && born < 0) born = t; });
    const p = coal(); check('Neutral B: the hot coal comes out on frame 13, swinging on a rope', born >= 13 && born <= 15 && p && (p.st === 'swing' || p.st === 'fly'), 'appeared on frame ' + born + ', state ' + (p && p.st)); }
  /* 2. relays: pressed on the mark they carry it further; three at most */
  /* a run that presses special on the listed frames; returns the coal as it ends up */
  const pressRun = sched => { setup(-70, 120); SCRIPT[0] = (i, tt) => { if (sched.includes(tt)) i.spc = true; }; let x = null;
    run(500, () => { const p = coal(); if (p && p.st === 'ground') return false; });
    const p = coal(); return { relays: p ? p.relay : -1, offs: p ? p.offs || [] : [], x: p ? p.x : null, st: p && p.st }; };
  /* find each relay press by search: the first press frame after the last that gives a relay of the wanted timing */
  const relayChain = (want, n) => { const sched = [1]; for (let k = 0; k < n; k++) { let got = false; const from = sched[sched.length - 1] + 3;
      for (let d = from; d < from + 120 && !got; d++) { const r = pressRun(sched.concat(d)); if (r.relays === k + 1 && want(r.offs[k])) { sched.push(d); got = true; } } if (!got) break; }
    return { sched, r: pressRun(sched) }; };
  const none = pressRun([1]), perfect = relayChain(o => o <= 1, 3), late2 = relayChain(o => o === 2, 3);
  const four = pressRun(perfect.sched.concat(perfect.sched[3] + 25));
  check('Relays: three perfect presses carry the coal much further than none', perfect.r.relays === 3 && perfect.r.x - none.x > 40, 'no relay: landed at x ' + (none.x || 0).toFixed(0) + '; three perfect relays (presses on frames ' + perfect.sched.slice(1).join(', ') + '): x ' + (perfect.r.x || 0).toFixed(0));
  check('Relays: presses 2 frames off still relay; a fourth press only lets go', late2.r.relays === 3 && late2.r.offs.every(o => o === 2) && four.relays === 3, 'two frames off: ' + late2.r.relays + ' relays (offsets ' + late2.r.offs.join(', ') + '); with a fourth press: ' + four.relays + ' relays, ' + four.st);
  { let missOk = true; for (const d of [5, 6, 7]) { const r = pressRun(perfect.sched.slice(0, 1).concat(perfect.sched[1] + d)); if (r.relays !== 0) missOk = false; }
    check('Relays: a press 5 or more frames late is a miss: it lets go', missOk, missOk ? 'no relay' : 'a late press still relayed'); }
  { const [c] = setup(-60, 120); SCRIPT[0] = (i, tt) => { if (tt === 1) i.spc = true; }; let rel = null;
    run(200, () => { const p = coal(); if (p && p.st === 'swing' && p.age === 8 && !rel) { SCRIPT[0] = (i, tt) => { if (tt === t) i.spc = true; }; rel = true; } if (p && p.st === 'ground') return false; });
    const p = coal(); check('A mistimed press lets go: the coal flies on and lands as a placed coal that stays 8 seconds', p && p.st === 'ground' && p.relay === 0 && p.life > 440 && p.life <= 480, p ? 'state ' + p.st + ', ' + p.relay + ' relays, ' + p.life + ' frames left' : 'no coal'); }
  /* 3. the ant: a rope from the coal to Chomp, the ant walking from the coal to him while he walks away; only the ant hurts */
  { const [c, o] = setup(-10, 90, 0); o.ctl = new Ctl('none');
    PROJ.push({ x: -50, y: 2.4, vx: 0, vy: 0, grav: 0, life: 360, owner: 0, face: 1, dir: 1, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st: 'ground', landAge: 0, age: 30, relay: 0, hits: 99, rehit: 45, cool: 9999, h: { d: 3, a: 75, b: 30, k: 20, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone });
    const p = coal(), cx = p ? p.x : null; let startAt = null, seen = [], ropeEnd = [], home = false, pctAt = o.pct;
    /* Chomp walks away from the coal while the ant crawls, then turns back */
    SCRIPT[0] = (i, tt, f) => { if (tt === t0 + 1) i.spc = true; else if (tt > t0 + 12 && tt < t0 + 70) i.lx = -sgn(cx - f.x) || -1; else if (tt >= t0 + 70) i.lx = sgn(cx - f.x); };
    const t0 = t;
    run(400, () => { const a = ant(); if (a) { if (startAt === null) startAt = [a.x, a.y, Math.hypot(a.x - p.x, a.y - p.y)]; seen.push([a.s, Math.hypot(a.rope[2] - c.x - c.face * 3, a.rope[3] - c.y - 5)]); }
      if (startAt && !a) { home = !coal(); return false; } });
    const grows = seen.every((q, k) => k === 0 || q[0] >= seen[k - 1][0]), follows = seen.every(q => q[1] < 2.5);
    check('Ant: starts at the coal, never at Chomp', !!startAt && startAt[2] <= COAL.antV + 0.05, startAt ? 'first seen ' + startAt[2].toFixed(2) + ' from the coal' : 'no ant');
    check('Ant: the rope end follows Chomp every frame, and the ant only moves forward', seen.length > 20 && grows && follows, seen.length + ' frames; always forward: ' + grows + '; rope end on Chomp: ' + follows);
    check('Ant: reaching Chomp hands the coal back', home, 'coal back: ' + home); }
  { const [c, o] = setup(-30, 0, 0); o.ctl = new Ctl('none');
    /* a coal placed on the floor at x -30... ant runs to Chomp at x 30 through the opponent standing at 0 */
    PROJ.push({ x: -30, y: 2.4, vx: 0, vy: 0, grav: 0, life: 360, owner: 0, face: 1, dir: 1, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st: 'ground', landAge: 0, age: 30, relay: 0, hits: 99, rehit: 45, cool: 9999, h: { d: 3, a: 75, b: 30, k: 20, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone });
    c.x = 30; c.face = -1; SCRIPT[0] = B(1); let hits = 0, was = 0, hitstun = 0;
    run(200, () => { if (o.pct > was + 0.1) { hits++; was = o.pct; } if (o.state === 'hurt') hitstun++; });
    check('Ant: hits the opponent in its path for 7%, once a trip', hits === 1 && o.pct > 7 && o.pct < 10, hits + ' hit(s), ' + o.pct.toFixed(1) + '% (7% before the one-on-one bonus)'); }
  { const [c, o] = setup(-30, 0, 0); o.ctl = new Ctl('none');
    PROJ.push({ x: -30, y: 2.4, vx: 0, vy: 0, grav: 0, life: 360, owner: 0, face: 1, dir: 1, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st: 'ground', landAge: 0, age: 30, relay: 0, hits: 99, rehit: 45, cool: 9999, h: { d: 3, a: 75, b: 30, k: 20, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone });
    c.x = 30; c.face = -1; SCRIPT[0] = B(1);
    /* the opponent walks back and forth across the rope while the ant is still near the coal: rope contact only */
    SCRIPT[1] = (i, tt, f) => { i.lx = Math.sin(tt / 8) > 0 ? 1 : -1; i.jmp = tt % 40 === 5; };
    let pct0 = o.pct, hurt = 0, lag = 0, snags = 0;   /* snags: times the rope stopped a crossing */
    run(30, () => { const a = ant(); if (a) snags = a.blocks || 0; if (o.state === 'hurt') hurt++; if (o.hitlag > 0) lag++; });
    check('Rope: crossing it never hurts (no damage, hitstun, freeze or launch)', o.pct === pct0 && hurt === 0 && lag === 0, 'damage ' + (o.pct - pct0).toFixed(1) + ', hitstun frames ' + hurt + ', freeze frames ' + lag + ', frames held back ' + snags); }
  { const [c, o] = setup(-30, 0, 0);
    PROJ.push({ x: -30, y: 2.4, vx: 0, vy: 0, grav: 0, life: 360, owner: 0, face: 1, dir: 1, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st: 'ground', landAge: 0, age: 30, relay: 0, hits: 99, rehit: 45, cool: 9999, h: { d: 3, a: 75, b: 30, k: 20, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone });
    c.x = 30; c.face = -1; o.x = 10; o.face = 1; SCRIPT[0] = B(1); let cut = false;
    SCRIPT[1] = (i, tt) => { if (tt === 16) { i.cy = -1; } };   /* a down tilt into the rope ahead of the ant */
    run(60, () => { if (c.ropeCuts > 0) cut = true; });
    check('Rope: an attack cuts it; the coal stays', cut && !!coal() && !ant(), 'cut: ' + cut + ', coal still there: ' + !!coal()); }
  /* 4. the other specials */
  { const [c, o] = setup(0, 80); c.y = 40; c.grounded = false; c.plat = null; c.set('air'); SCRIPT[0] = (i, tt) => { if (tt < 50) i.spc = true; i.lx = tt < 3 ? 1 : 0; }; let maxX = 0, swung = false;
    run(120, () => { if (c.rsGo) swung = true; maxX = Math.max(maxX, c.x); });
    check('Side B: hooks a rope and swings him forward', swung && maxX > 20, 'swung: ' + swung + ', carried to x ' + maxX.toFixed(0)); }
  { const [c, o] = setup(0, 80); c.y = 20; c.grounded = false; c.plat = null; c.set('air'); SCRIPT[0] = (i, tt) => { if (tt === 1) { i.spc = true; i.ly = 1; } }; let top = 0, bub = false;
    run(150, () => { top = Math.max(top, c.y); if (c.bubble) bub = true; });
    check('Up B: a bubble carries him up', bub && top - 20 > 45, 'rose ' + (top - 20).toFixed(0)); }
  { const [c, o] = setup(0, 9); o.ctl = new Ctl('none'); SCRIPT[0] = (i, tt) => { if (tt === 1) { i.spc = true; i.ly = -1; } }; const x0 = o.x; run(40);
    check('Down B: the gust pushes the opponent away for 3%', o.x - x0 > 3 && o.pct > 2.5 && o.pct < 4.5, 'pushed ' + (o.x - x0).toFixed(1) + ', ' + o.pct.toFixed(1) + '%'); }
  /* 5. the 2026-11-11 changes: side B from the ground and in a chain, the coal stopped off the stage, the rope in the way */
  const coalAt = (x, y, st, extra) => { const p = Object.assign({ x, y, vx: 0, vy: 0, grav: 0, life: st === 'ground' ? COAL.ground : 9999, owner: 0, face: 1, dir: 1, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st, landAge: 0, age: 30, relay: 0, hits: 99, rehit: 45, cool: 9999, h: { d: 3, a: 75, b: 30, k: 20, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone }, extra || {}); PROJ.push(p); return p; };
  { const [c, o] = setup(-40, 60); SCRIPT[0] = (i, tt) => { if (tt === 1) { i.spc = true; i.lx = 1; } }; let swung = 0, low = 99, maxX = -99, bit = false;
    run(140, () => { if (c.rsGo) { swung++; low = Math.min(low, c.y); } if (c.mname === 'swingBite' && c.state === 'attack') bit = true; maxX = Math.max(maxX, c.x); });
    check('Side B from the ground: he swings clear of the floor, and a rope left alone ends in the bite', swung > 60 && low > 0.3 && bit && maxX > -20, 'swung ' + swung + ' frames, lowest ' + low.toFixed(1) + ' above the floor, carried from x -40 to ' + maxX.toFixed(0) + ', bite: ' + bit); }
  { const chain = presses => { const [c, o] = setup(-60, 66); SCRIPT[0] = (i, tt) => { if (tt === 1) { i.spc = true; i.lx = 1; } else if (presses.includes(tt)) i.spc = true; }; let n = 0, maxX = -99, bitAt = null;
      run(400, () => { n = Math.max(n, c.rsN || 0); if (c.state === 'attack' && (c.mname === 'sspec' || c.mname === 'swingBite')) maxX = Math.max(maxX, c.x); if (bitAt === null && c.mname === 'swingBite' && c.state === 'attack') bitAt = t; if (bitAt !== null && c.state !== 'attack') return false; });
      return { n, maxX, bitAt }; };
    const one = chain([]), three = chain([40, 70]), many = chain([40, 70, 100, 130, 160, 190]);
    check('Side B: special again strings ropes together, each carrying him further', one.n === 1 && three.n === 3 && three.maxX - one.maxX > 25, 'one rope: to x ' + one.maxX.toFixed(0) + '; three ropes: to x ' + three.maxX.toFixed(0));
    check('Side B: no more than ' + ROPE.max + ' ropes in one go', many.n === ROPE.max, 'six more presses gave ' + many.n + ' ropes'); }
  { const [c, o] = setup(-40, -8); o.ctl = new Ctl('none'); SCRIPT[0] = (i, tt) => { if (tt === 1) { i.spc = true; i.lx = 1; } if (tt === 36) i.atk = true; }; let bitAt = null;
    run(80, () => { if (bitAt === null && c.mname === 'swingBite' && c.state === 'attack') bitAt = t; });
    check('Side B: attack lets go into the bite', bitAt !== null && bitAt <= 38 && o.pct > 5, 'bite on frame ' + bitAt + ', opponent at ' + o.pct.toFixed(1) + '%'); }
  { const [c, o] = setup(40, -60); o.ctl = new Ctl('none'); c.face = 1; const p = coalAt(EDGE + 14, 20, 'fly', { vx: 0.6, vy: 0 });
    let y0 = null, moved = 0, hung = 0, home = false; SCRIPT[0] = (i, tt) => { if (tt === 12) i.spc = true; };
    run(300, () => { if (p.st === 'hang') { hung++; if (y0 === null) y0 = [p.x, p.y]; moved = Math.max(moved, Math.hypot(p.x - y0[0], p.y - y0[1])); } if (hung && !coal()) { home = !!p.picked; return false; } });
    check('Coal off the stage: B stops it where it is while the ant brings it home', hung > 20 && moved < 0.01 && home, 'stopped ' + hung + ' frames, drifted ' + moved.toFixed(2) + ', back with Chomp: ' + home); }
  { const [c, o] = setup(40, 52); c.face = 1; const p = coalAt(EDGE + 14, 20, 'fly', { vx: 0.2, vy: 0 }); o.face = 1;
    let hung = 0, fell = false; SCRIPT[0] = (i, tt) => { if (tt === 12) i.spc = true; }; SCRIPT[1] = (i, tt) => { if (tt === 40) i.atk = true; };
    run(200, () => { if (p.st === 'hang') hung++; else if (hung && p.st === 'fly') fell = true; if (hung && !coal()) return false; });
    check('Coal off the stage: cut the rope and it falls again', hung > 5 && fell && !p.picked, 'stopped ' + hung + ' frames, fell again: ' + fell + ', rope cuts: ' + (c.ropeCuts || 0)); }
  { const [c, o] = setup(0, 30); const p = coalAt(-20, 30, 'fly', { vx: 0, vy: 0 }); SCRIPT[0] = (i, tt) => { if (tt === 3) i.spc = true; }; let hung = false; run(30, () => { if (p.st === 'hang') hung = true; });
    check('Coal over the stage: B does not stop it', !hung, 'stopped: ' + hung); }
  { /* a coal stopped high off the right edge, Chomp far along the stage: the rope slants up across the stage, and the opponent falls onto it and then pushes into it */
    const tryIt = rope => { const [c, o] = setup(-20, 56); c.face = 1; coalAt(EDGE + 30, 44, 'fly', { vx: 0, vy: 0 }); if (rope) SCRIPT[0] = (i, tt) => { if (tt === 2) i.spc = true; };
      o.y = 40; o.grounded = false; o.plat = null; o.set('air'); o.vx = 0; o.vy = 0; let pct0 = o.pct, hurt = 0, st = 0, y = 0, x = 0;
      run(32, () => { if (o.state === 'hurt') hurt++; if (ant()) st = ant().blocks || 0; }); return { y: o.y, x: o.x, hurt, dmg: o.pct - pct0, st }; };
    const free = tryIt(false), wall = tryIt(true);
    check('Rope: it is in the way of an opponent moving through it, and never hurts', wall.st > 0 && wall.y - free.y > 6 && wall.hurt === 0 && wall.dmg === 0, 'no rope: fell to height ' + free.y.toFixed(0) + ' at x ' + free.x.toFixed(0) + '; with the rope: held at height ' + wall.y.toFixed(0) + ', x ' + wall.x.toFixed(0) + ' (frames held back ' + wall.st + ', damage ' + wall.dmg.toFixed(1) + ', hitstun frames ' + wall.hurt + ')'); }
  { /* on the floor: the rope slants down to a coal on the floor from Chomp on a platform; the opponent runs at it */
    const tryIt = rope => { const [c, o] = setup(0, -60); o.face = 1; const q = PLATS.filter(q => q !== MAIN).sort((a, b) => b.y - a.y)[0]; c.x = (q.x0 + q.x1) / 2; c.y = q.y; c.plat = q; c.face = -1;
      const p = coalAt(c.x - 34, 2.4, 'ground'); if (rope) SCRIPT[0] = (i, tt) => { if (tt === 2) i.spc = true; };
      o.x = p.x + 20; o.face = -1; SCRIPT[1] = (i, tt) => { if (tt > 30) i.lx = -1; }; let maxX = 999, hurt = 0, st = 0; const pct0 = o.pct;
      run(49, () => { maxX = Math.min(maxX, o.x); if (o.state === 'hurt') hurt++; if (ant()) st = ant().blocks || 0; }); return { maxX, hurt, st, dmg: o.pct - pct0, cx: p.x, top: q.y }; };
    const free = tryIt(false), wall = tryIt(true);
    check('Rope: a walking opponent is stopped by a rope slanting up from the floor', wall.st > 0 && wall.maxX - free.maxX > 5 && wall.dmg === 0, 'coal at x ' + wall.cx.toFixed(0) + ', Chomp on the platform at height ' + wall.top + '; no rope: walked to x ' + free.maxX.toFixed(0) + '; with the rope: stopped at x ' + wall.maxX.toFixed(0) + ' (damage ' + wall.dmg.toFixed(1) + ')'); }
  const bad = results.filter(r => !r[0]);
  for (const r of results) console.log((r[0] ? 'pass  ' : 'FAIL  ') + r[1] + '   ' + r[2]);
  console.log(bad.length ? bad.length + ' of ' + results.length + ' Chomp Chomp checks FAILED' : 'all ' + results.length + ' Chomp Chomp checks pass');
  if (bad.length) process.exitCode = 1;
})();
`);
