// Knell, the Angle Thief: scripted checks against the owner's design bible v1.0 (frames, damage, blade paths and launch,
// movement, Crossline / Thread, Hinge Cancel, Clink, the blade clock's three tracks, Rimskip, Turnkey Ascent, Deadbolt).
// Usage: node tests/knell.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 11; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'movelist.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const KI = ROSTER.findIndex(d => d.name === 'Knell'), KN_ = [KI, 0], FL = [0, 0], BR = [ROSTER.findIndex(d => d.name === 'Brand'), 0];
  const KF = ROSTER[KI].forms[0], mv = KF.moves, st = KF.st, H = st.h, MPU = H / 1.85;
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
  /* Knell starts a move directly against a Flint standing gap away (and holds the stick as i0 says on its first frames) */
  function swing(name, gap, o) {
    o = o || {}; const [k, f] = setup(KN_, FL, 0, gap); if (o.air) { airborne(k, 0, o.air); if (o.tAir !== undefined) airborne(f, gap, o.tAir); }
    if (o.shield) SCRIPT[1] = i => { i.shd = true; }; if (o.flip) k.face = -k.face;
    if (o.ly !== undefined) SCRIPT[0] = (i, tt) => { if (tt < 3) i.ly = o.ly; };
    k.startMove(name); const out = { first: 0, hits: 0, pct: 0, vy: 0, vx: 0, name: '' }; let p = 0;
    run(o.frames || mv[name].t + 20, () => { if (!out.name && k.state === 'attack') out.name = k.mname; if (f.pct > p + 0.01) { out.hits++; if (!out.first) { out.first = k.mf; out.vy = f.vy; out.vx = f.vx; } p = f.pct; } });
    out.pct = f.pct; out.k = k; out.f = f; return out;
  }

  /* ---- the numbers are the document's ---- */
  {
    /* move, first active, last active, damage, launch, first free frame (FAF) */
    const rows = [['jab', 3, 4, 2.3, 45, 15], ['jab2', 4, 5, 2.4, 72, 17], ['jab3', 6, 8, 4.5, 55, 28], ['ftilt', 6, 8, 7, 42, 25], ['ftiltL', 6, 8, 7, 28, 25], ['ftiltH', 6, 8, 7, 75, 25],
      ['utilt', 5, 6, 2.5, 90, 26], ['dtilt', 4, 6, 5.1, 82, 21], ['dash', 6, 6, 1.5, 70, 37], ['dsmash', 10, 11, 6, 32, 46], ['nair', 5, 5, 1.4, 70, 35],
      ['fair', 6, 8, 7.2, 48, 32], ['fairL', 6, 8, 7.2, 32, 32], ['fairH', 6, 8, 7.2, 78, 32], ['uair', 5, 5, 6.3, 88, 29], ['sspec', 12, 15, 9.2, 40, 40], ['uspec', 7, 10, 4.5, 76, 34]];
    const main = m => mv[m].h.find(h => !h.nb && h.f1 > h.f0 || mv[m].h.length === 1) || mv[m].h[0];
    const bad = rows.filter(([m, a, b, d, ang, faf]) => { const h = mv[m].h.filter(x => !x.nb).slice(-1)[0], h0 = mv[m].h.filter(x => !x.nb)[0], hs = mv[m].h;
      return !(Math.min(...hs.map(x => x.f0)) === a && hs.some(x => !x.nb && x.f0 === a && x.f1 === b && x.d === d && x.a === ang) && mv[m].t + 1 === faf); }).map(r => r[0]);
    check('document: first active frame, damage, launch and FAF of ' + rows.length + ' moves', !bad.length, bad.length ? 'differs: ' + bad.join(', ') : 'all as the tables list');
    const ut = mv.utilt.h, ds = mv.dsmash.h, n = mv.nair.h, da = mv.dash.h, fs2 = mv.fsmash.h, us = mv.usmash.h, dr = mv.dair.h, ba = mv.bair.h, w = mv.nspec.h;
    check('document: multi-part moves', ut[0].f0 === 5 && ut[0].f1 === 6 && ut[1].f0 === 7 && ut[1].f1 === 9 && ds[1].f0 === 17 && ds[1].d === 8 && ds[1].a === 145 && ds[1].g === 1 && n.filter(h => !h.nb && h.g < 3 && h.d === 1.4 && h.link).length === 10 && n.filter(h => !h.nb && h.g === 3 && h.d === 5.5).map(h => h.f0).join() === '15,16,17,18,19,20'
      && da.filter(h => !h.nb && h.g < 4 && h.d === 1.5 && h.link).length === 19 && da.filter(h => !h.nb && h.g === 4 && h.d === 4.5 && h.a === 85).map(h => h.f0).join() === '25,26,27,28' && fs2.some(h => h.d === 17 && h.f0 === 16) && fs2.some(h => h.d === 12) && fs2.some(h => h.d === 15 && h.f0 === 18) && us.filter(h => h.d === 2 && h.link).length === 2 && us.some(h => h.d === 13 && h.g === 2) && us.some(h => h.d === 11 && h.g === 2)
      && dr.some(h => h.a === 270 && h.f0 === 10 && h.f1 === 11) && dr.some(h => h.a === 65 && h.f1 === 12) && ba.some(h => h.d === 10.5) && ba.some(h => h.d === 8.5)
      && w.map(h => h.f0 + '-' + h.f1 + ':' + h.d).join(' ') === '9-11:2.2 16-18:2.2 23-25:5.3' && mv.nspec.t + 1 === 44 && mv.fsmash.t + 1 === 46 && mv.usmash.t + 1 === 44 && mv.bair.t + 1 === 36 && mv.dair.t + 1 === 42 && mv.dspec.t === 42,
      'Keyturn in front then over, Split Seconds 6 + 8, Pendulum (a flip) 1.4 x 3 + 5.5, Slipstitch a roll, 1.5 x 4 + 4.5 (owner), Guillotine 17 / 15 / 12, Clockstrike 2 + 2 + 13 tip (owner), Deadfall tip spike f10-11, Backhand 10.5 / 8.5, Needlewheel 2.2 + 2.2 + 5.3');
    const T = mv.throws, g = mv.grab.h[0], dg = mv.dgrab.h[0], pg = mv.pgrab.h[0];
    check('document: grabs, pummel and throws', g.f0 === 6 && mv.grab.t === 31 && dg.f0 === 9 && mv.dgrab.t === 41 && pg.f0 === 10 && mv.pgrab.t === 40 && st.pummel === 1.1 && st.pumT === 17
      && T.f.d === 6.5 && T.f.a === 42 && T.b.d === 8.2 && T.b.a === 142 && T.u.d === 5.8 && T.u.a === 88 && T.d.d === 5 && T.d.a === 77, 'grab f6, dash f9, pivot f10; throws 6.5 / 8.2 / 5.8 / 5%');
    const hw = { jab: [8, 11], jab2: [9, 12], ftilt: [10, 13], utilt: [11, 14], dtilt: [8, 11], nair: [21, 24], fair: [10, 13] }, wrong = Object.keys(hw).filter(k => !mv[k].hinge || mv[k].hinge.join() !== hw[k].join());
    const none = ['jab3', 'dash', 'fsmash', 'usmash', 'dsmash', 'bair', 'uair', 'dair', 'grab', 'nspec', 'sspec', 'uspec', 'dspec', 'ledgeatk'].filter(k => mv[k].hinge);
    check('document: Hinge windows', !wrong.length && !none.length, wrong.length || none.length ? 'wrong: ' + wrong.concat(none).join(', ') : 'jab 8-11, jab 2 9-12, f-tilt 10-13, u-tilt 11-14, d-tilt 8-11, n-air 21-24, f-air 10-13; none elsewhere');
    /* blade paths: each dagger hit's direction and its class */
    const pa = [['jab', 10, 'M'], ['jab2', -35, 'L'], ['jab3', 65, 'H'], ['ftiltL', -55, 'L'], ['ftilt', 0, 'M'], ['ftiltH', 55, 'H'], ['dtilt', -72, 'L'], ['uair', 34, 'H'], ['fairL', -55, 'L'], ['fairH', 55, 'H'], ['nspecL', -60, 'L'], ['nspecH', 10, 'M']];
    const pbad = pa.filter(([m, a, c]) => { const h = mv[m].h.find(x => x.cl); const ang = Math.atan2(h.y - h.in[1], h.x - h.in[0]) * 180 / Math.PI; return !(Math.abs(ang - a) <= 8 && h.cl === c); }).map(r => r[0]);
    check('document: blade paths within 8 degrees, and their classes', !pbad.length, pbad.length ? 'off: ' + pbad.join(', ') : pa.map(r => r[0] + ' ' + r[2]).join(', '));
    const L = Math.hypot(mv.ftilt.h[0].x - mv.ftilt.h[0].in[0], mv.ftilt.h[0].y - mv.ftilt.h[0].in[1]) / H, sh = shieldCircle({ x: 0, y: 0, shieldHp: SHIELD.hp, ctl: { c: blankIn() }, st })[2];
    check('document: a short dagger, a small shield (hitboxes 1.15 x longer, 1.35 x thicker, by the owner)', near(L / 1.15, 0.92 * 0.27, 0.005) && near(mv.ftilt.h[0].r / H / 1.35, 0.15 * 0.27, 0.002) && near(sh, 10 * 0.9, 0.01), 'dagger ' + (L / 1.15 / 0.27).toFixed(2) + ' torso widths, radius ' + (mv.ftilt.h[0].r / H / 1.35 / 0.27).toFixed(2) + '; shield ' + (sh / 10).toFixed(2) + ' the usual');
    check('document: movement', st.weight === 89 && st.walk === 0.78 && st.run === 1.88 && st.trac === 0.112 && st.airSpeed === 1.05 && st.grav === 0.112 && st.fall === 1.7 && st.ffall === 2.15 && st.jsq === 3 && st.jumps === 1 && st.dashF === 10 && near(st.jumpH / MPU, 3.15 * 1.4) && near(st.hopH / MPU, 1.55 * 1.4) && near(st.airJumpH / MPU, 3.15 * 1.4),
      'weight 89, walk 0.78, run 1.88, air 1.05, gravity 0.112, fall 1.70 / 2.15, hops (the document x 1.4, by the owner) ' + (st.jumpH / MPU).toFixed(2) + ' / ' + (st.hopH / MPU).toFixed(2) + ' m');
  }
  /* ---- the blade clock: the stick on the first frames picks the track ---- */
  {
    const lo = swing('ftilt', 9, { ly: -0.6 }), mid = swing('ftilt', 9, { ly: 0 }), hi = swing('ftilt', 9, { ly: 0.6 });
    check('blade clock: Dial Cut LOW / MID / HIGH from the stick on frames 1 and 2', lo.name === 'ftiltL' && mid.name === 'ftilt' && hi.name === 'ftiltH' && lo.hits === 1 && mid.hits === 1 && lo.vy < mid.vy && mid.vy < hi.vy,
      lo.name + ' / ' + mid.name + ' / ' + hi.name + ', launch rising ' + lo.vy.toFixed(2) + ' < ' + mid.vy.toFixed(2) + ' < ' + hi.vy.toFixed(2));
    const fl = swing('fair', 9, { air: 20, tAir: 20, ly: -0.6 }), fh = swing('fair', 9, { air: 20, tAir: 20, ly: 0.6 });
    check('blade clock: Prismatic Fang aims too', fl.name === 'fairL' && fh.name === 'fairH' && fl.hits === 1 && fh.hits === 1, fl.name + ', ' + fh.name);
    const nw = swing('nspec', 8, { ly: 0.6 });
    check('blade clock: Needlewheel on the HIGH line, three ticks', nw.name === 'nspecH' && nw.hits === 3, nw.name + ', ' + nw.hits + ' hits, ' + nw.pct.toFixed(1) + '%');
    const reach = g => swing('ftilt', g).hits; let far = 0; for (let g = 6; g < 20; g += 0.5) if (reach(g)) far = g;
    const bfar = (() => { let r = 0; for (let g = 6; g < 26; g += 0.5) { const [b, f] = setup(BR, FL, 0, g); b.startMove('ftilt'); let hit = false; run(30, () => { if (f.pct > 0) hit = true; }); if (hit) r = g; } return r; })();
    check('stubby: Dial Cut reaches well short of Brand\\'s Ember Cut', far > 0 && far < bfar * 0.8, 'Knell reaches a Flint ' + far + ' away, Brand ' + bfar);
  }
  /* ---- Crossline: a change of class earns a Thread ---- */
  function chain(moves, o) {
    o = o || {}; const [k, f] = setup(KN_, FL, 0, o.gap || 8); if (o.shield) SCRIPT[1] = i => { i.shd = true; };
    const log = [];
    for (const m of moves) { f.x = k.x + (o.gap || 8); f.y = 0; f.vx = f.vy = 0; f.grounded = true; f.plat = MAIN; if (!o.shield) { f.set('idle'); f.hitstun = 0; } f.pct = Math.min(f.pct, 30); k.x = 0; k.y = 0; k.grounded = true; k.plat = MAIN; k.set('idle');
      const ly = /H$/.test(m) ? 0.6 : /L$/.test(m) ? -0.6 : 0; SCRIPT[0] = (i, tt, ff) => { if (ff.state === 'attack') i.ly = ly; };   /* the stick picks the track */
      k.startMove(m); run(mv[m].t + 2); log.push(k.thread); if (o.wait) run(o.wait); }
    return { log, k };
  }
  {
    const a = chain(['ftiltH', 'ftiltL', 'ftilt']), same = chain(['ftiltH', 'ftiltH', 'ftiltH']), cap = chain(['ftiltH', 'ftiltL', 'ftiltH', 'ftiltL', 'ftiltH', 'ftiltL', 'ftiltH']);
    check('Thread: HIGH then LOW earns one, then MID another', a.log.join() === '0,1,2', 'after each cut: ' + a.log.join(', '));
    check('Thread: the same class three times earns nothing', same.log.join() === '0,0,0', same.log.join(', '));
    check('Thread: five at most (the owner raised it from two)', cap.log.join() === '0,1,2,3,4,5,5', cap.log.join(', '));
    const late = chain(['ftiltH', 'ftiltL'], { wait: 95 });
    check('Thread: the class is kept 90 frames after a hit', late.log.join() === '0,0', 'a cut 95 frames after the last: ' + late.log.join(', '));
    const sh = chain(['ftiltH', 'ftiltL'], { shield: 1 }), shLate = chain(['ftiltH', 'ftiltL'], { shield: 1, wait: 30 });
    check('Thread: on shield it counts, for 45 frames', sh.log.join() === '0,1' && shLate.log.join() === '0,0', 'shielded: ' + sh.log.join(', ') + '; with 30 more frames between: ' + shLate.log.join(', '));
    const sm = chain(['ftiltH', 'fsmash']); const wh = chain(['ftiltH', 'ftiltL'], { gap: 40 });
    check('Thread: a smash counts like any move (the owner: any two linked moves), never a whiff', sm.log.join() === '0,1' && wh.log.join() === '0,0', 'smash ' + sm.log.join(', ') + '; whiffs ' + wh.log.join(', '));
    const nr = (() => { const [k, f] = setup(KN_, FL, 0, 7); airborne(k, 0, 15); airborne(f, 7, 15); k.startMove('nair'); run(30); const one = k.thread; k.knLast = 'd'; k.knExp = frame + 90; k.thrGot = -1;
      airborne(k, 0, 15); airborne(f, 7, 15); f.pct = 0; k.startMove('nair'); run(30); return one + '/' + k.thread; })();
    check('Thread: a multi-hit alone earns none, and one at most after another input', nr === '0/1', 'Pendulum alone, then after a down input: ' + nr);
    /* the owner's rework (2026-11-12): two linked moves of different directional inputs */
    const du = (a, b, gap) => { const [k, f] = setup(KN_, FL, 0, gap); k.startMove(a); run(mv[a].t + 1); k.startMove(b); run(30); return k.thread; };
    check('Thread: down tilt into up tilt earns one; down tilt twice none', du('dtilt', 'utilt', 6) === 1 && du('dtilt', 'utilt', 8) === 1 && du('dtilt', 'dtilt', 6) === 0,
      'd>u ' + du('dtilt', 'utilt', 6) + ' / ' + du('dtilt', 'utilt', 8) + ', d>d ' + du('dtilt', 'dtilt', 6));
    /* the dash attack sets up up tilt: a true follow-up from 0 to 120%, a Thread each time */
    const dashUt = p0 => { const [k, f] = setup(KN_, FL, 0, 14); f.pct = p0; k.vx = st.run; k.startMove('dash'); let ph = 0, pd = 0, stun = false;
      run(90, () => { if (ph === 0 && k.state !== 'attack') { ph = 1; pd = f.pct; stun = f.state === 'hurt'; k.startMove('utilt'); } else if (ph === 1 && f.pct > pd + 0.01) ph = 2; }); return ph === 2 && stun && k.thread === 1; };
    const dus = [0, 30, 60, 90, 120].filter(p => !dashUt(p));
    check('dash attack leads into up tilt (still in hitstun), and earns a Thread', !dus.length, dus.length ? 'misses from ' + dus.join(', ') + '%' : '0, 30, 60, 90 and 120%');
    /* the acrobatic airs (the owner, 2026-11-12): Pendulum is a whole front flip, the blade going all the way round him */
    const nb = mv.nair.h.filter(h => !h.nb), turn = nb.map(h => h.pa), span = Math.max(...turn.map((a, i) => i ? ((turn[i - 1] - a) + 360) % 360 : 0).reduce((acc, d) => (acc.push(acc[acc.length - 1] + d), acc), [0]));
    const nf = swing('nair', 6, { air: 20, tAir: 20 }), nbk = swing('nair', 5, { air: 20, tAir: 20, flip: 1 }), nlo = swing('nair', 1, { air: 20, tAir: 8 });
    check('Pendulum: a full flip, the dagger round him, all four hits in front, behind or below', span >= 300 && nf.hits === 4 && nbk.hits === 4 && nlo.hits === 4,
      'blade turns ' + span.toFixed(0) + ' degrees while it can hit (the body the whole 360); hits in front ' + nf.hits + ', behind ' + nbk.hits + ', below ' + nlo.hits + ' (' + nf.pct.toFixed(1) + '%)');
    const ua = mv.uair.h.map(h => h.pa), ub = swing('uair', 1, { air: 20, tAir: 30 });
    check('Bell Needle: a back flip, the blade raking over his head front to back', ua[0] < 45 && ua[ua.length - 1] > 130 && ub.hits === 1, 'blade ' + ua.map(a => a.toFixed(0)).join(' > ') + ' degrees; hits above: ' + ub.hits);
  }
  /* ---- the Hinge Cancel ---- */
  {
    const hinge = (dir, o) => { o = o || {}; const [k, f] = setup(KN_, FL, 0, o.gap || 8); if (o.shield) SCRIPT[1] = i => { i.shd = true; }; k.thread = o.thread === undefined ? 1 : o.thread; k.hingeUsed = !!o.used;
      k.startMove('ftilt'); let x0 = 0, y0 = 0, at = -1, act = -1, slow = 0;
      SCRIPT[0] = (i, tt, ff) => { if (ff.state === 'attack' && ff.mname === 'ftilt' && ff.mf === (o.at || 10)) { i.spc = true; i.lx = dir === 'f' ? ff.face : dir === 'b' ? -ff.face : 0; i.ly = dir === 'u' ? 1 : 0; }
        if (o.atk && (ff.mname === 'hinge' || ff.mname === 'hingeS')) i.atk = ff.mf >= 2; };
      run(40, () => { if (k.mname && (k.mname === 'hinge' || k.mname === 'hingeS') && at < 0) { at = t; x0 = k.x; y0 = k.y; } if (at >= 0 && act < 0 && k.mname !== 'hinge' && k.mname !== 'hingeS') act = t - at; slow = Math.max(slow, f.slowT || 0); });
      const dx = (k.x - x0) * k.face; return { ok: at >= 0, dx, dy: k.y - y0, k, f, act, slow, shield: o.shield };
    };
    const fw = hinge('f'), bk = hinge('b'), up = hinge('u', { gap: 8 });
    check('Hinge: spends a Thread for a pivot of 0.8 m forward, 0.65 m back, 0.45 m up', fw.ok && near(fw.dx / MPU, 0.8, 0.06) && near(bk.dx / MPU, -0.65, 0.06) && up.ok && fw.k.thread === 0 && fw.k.hingeUsed,
      'forward ' + (fw.dx / MPU).toFixed(2) + ' m, back ' + (bk.dx / MPU).toFixed(2) + ' m, up started: ' + up.ok + '; Thread left ' + fw.k.thread);
    const none = hinge('f', { thread: 0 }), whiff = hinge('f', { gap: 40 }), used = hinge('f', { used: true }), early = hinge('f', { at: 7 });
    check('Hinge: needs a Thread, contact and the window, but no once-a-string limit', !none.ok && !whiff.ok && used.ok && !early.ok, 'no Thread ' + none.ok + ', whiff ' + whiff.ok + ', second in a string ' + used.ok + ', before the window ' + early.ok);
    const atk = hinge('f', { atk: 1 }), atkS = hinge('f', { atk: 1, shield: 1 });
    check('Hinge: after a clean hit the opponent is slowed for 30 frames; not after a shielded one', fw.slow >= 29 && atkS.slow === 0, 'slow frames ' + fw.slow + ' / shielded ' + atkS.slow);
    const sl = (() => { const [k, f] = setup(KN_, FL, -30, 30); run(5); const s0 = f.sf; f.slowT = 30; f.slowAc = 0; run(30); const a = f.sf - s0; const s1 = f.sf; run(30); return [a, f.sf - s1]; })();
    check('Hinge slow: a quarter speed for half a second, then normal', sl[0] >= 7 && sl[0] <= 8 && sl[1] === 30, 'state frames over 30 game frames: ' + sl[0] + ' slowed, ' + sl[1] + ' after');
    check('Hinge: attack from its frame 5, frame 9 after a shielded hit', atk.ok && atkS.ok && atk.act === 5 && atkS.act === 9, 'attacked on frame ' + atk.act + ' / ' + atkS.act);
  }
  /* ---- stinging multi-hits (the owner, 2026-11-12) ---- */
  {
    const best = (m, o) => { let b = null; for (const flip of [false, true]) for (let g = 2; g <= 14; g += 1) { const r = swing(m, g, Object.assign({ flip }, o)); if (!b || r.hits > b.hits) b = Object.assign(r, { g, flip }); } return b; };
    const j3 = best('jab3'), ut = best('utilt'), da = best('dash'), us = best('usmash');
    check('multi-hits: jab 3 two, up tilt two, dash attack five (the roll), up smash three', j3.hits === 2 && ut.hits === 2 && da.hits === 5 && us.hits === 3,
      'jab 3 ' + j3.hits + ' (' + j3.pct.toFixed(1) + '%), up tilt ' + ut.hits + ' (' + ut.pct.toFixed(1) + '%), dash ' + da.hits + ' (' + da.pct.toFixed(1) + '%), up smash ' + us.hits + ' (' + us.pct.toFixed(1) + '%)');
  }
  /* ---- Clink: a perfect block strengthens the next grounded dagger hit ---- */
  {
    const [k, f] = setup(KN_, FL, 0, 8); k.set('shieldoff'); k.sf = 1; f.startMove('jab'); run(8);
    const got = k.clinkUntil > frame; let p0 = f.pct; k.set('idle'); k.move = null; run(6); p0 = f.pct; f.set('idle'); f.move = null; f.x = 8; k.startMove('ftilt'); run(12);
    const plain = (() => { const [k2, f2] = setup(KN_, FL, 0, 8); k2.startMove('ftilt'); run(12); return f2.pct; })();
    check('Clink: a parry gives it, the next dagger hit does 1.5% more, once', got && near(f.pct - p0 - plain, 1.5, 0.05) && k.clinkUntil === 0, 'parried: ' + got + '; ' + (f.pct - p0).toFixed(2) + '% against ' + plain.toFixed(2) + '%');
  }
  /* ---- Deadbolt ---- */
  {
    const bolt = (atkMove, o) => { o = o || {}; const [k, f] = setup(KN_, o.att || FL, 0, o.behind ? -9 : 9); if (o.behind) k.face = 1; k.thread = o.thread || 0;
      k.startMove('dspec'); run(4); f.startMove(atkMove); let caught = false, hurt = 0; const p0 = k.pct;
      run(50, () => { if (k.mname === 'dspecR') caught = true; }); return { caught, kp: k.pct - p0, fp: f.pct, thread: k.thread }; };
    const front = bolt('jab'), back = bolt('jab', { behind: 1 }), big = bolt('fsmash'), gr = bolt('grab'), have = bolt('jab', { thread: 2 });
    check('Deadbolt: catches a light strike from in front and ripostes', front.caught && front.kp === 0 && front.fp > 0 && front.thread === 1, 'caught ' + front.caught + ', Knell took ' + front.kp.toFixed(1) + '%, riposte ' + front.fp.toFixed(1) + '%, Thread ' + front.thread);
    check('Deadbolt: not from behind, not over 12%, not a grab; no Thread when he has one', !back.caught && !big.caught && !gr.caught && have.thread === 2, 'behind ' + back.caught + ', a 16% smash ' + big.caught + ', grab ' + gr.caught + ', Thread kept at ' + have.thread);
  }
  /* ---- Rimskip, Turnkey Ascent ---- */
  {
    const [k] = setup(KN_, FL, -40, 60); const x0 = k.x; k.startMove('sspec'); run(45);
    check('Rimskip: 3.0 m along the ground', near((k.x - x0) / MPU, 3.0, 0.15), ((k.x - x0) / MPU).toFixed(2) + ' m');
    const [k2] = setup(KN_, FL, 0, 60); airborne(k2, 0, 70); const ax = k2.x; k2.startMove('sspec'); run(24);
    check('Rimskip: over 4 m in the air (was 2.0), no special fall (the owner)', (k2.x - ax) / MPU > 4 && (run(mv.sspec.t + 2 - 24), k2.state !== 'helpless'), ((k2.x - ax) / MPU).toFixed(2) + ' m, then ' + k2.state);
    const [k3] = setup(KN_, FL, 0, 60); airborne(k3, -(EDGE + 14), -20); k3.face = 1; k3.startMove('sspec'); let wall = false, vy = 0; run(30, () => { if (k3.mname === 'sspecW' && !wall) { wall = true; vy = k3.vy; } });
    run(30); const st3 = k3.state;
    k3.startMove('sspec'); const again = k3.mname; airborne(k3, -(EDGE + 14), -20); k3.sideUsed = true; k3.ctl.c.lx = 1; k3.doSpecial();
    check('Rimskip: into the stage wall it rebounds up, no special fall, once a trip', wall && vy > 0.8 && st3 !== 'helpless' && k3.mname !== 'sspec', 'rebound ' + wall + ' (rising ' + vy.toFixed(2) + '), then ' + st3 + '; a second side special in the same trip gives ' + k3.mname);
    const [k4] = setup(KN_, FL, 0, 60); airborne(k4, 0, 30); const y0 = k4.y; k4.startMove('uspec'); let top = y0; run(40, () => { top = Math.max(top, k4.y); });
    check('Turnkey Ascent: about 5.5 m up (the document 2.6 x 2.1), helpless after', near((top - y0) / MPU, 5.5, 0.35) && k4.state === 'helpless', ((top - y0) / MPU).toFixed(2) + ' m, then ' + k4.state);
    const [k5, f5] = setup(KN_, FL, 0, 3); airborne(f5, 2, 2); k5.startMove('uspec'); let hits = 0, p = 0; run(30, () => { if (f5.pct > p + 0.01) { hits++; p = f5.pct; } });
    check('Turnkey Ascent: two beats, both can hit', hits === 2, hits + ' hits, ' + p.toFixed(1) + '%');
  }
  /* ---- the move list documents everything ---- */
  { const miss = mlMissing(ROSTER[KI]); check('move list: every move has its words', !miss.length, miss.length ? miss.join(', ') : mlSections(ROSTER[KI]).reduce((n, s) => n + s.pages.length, 0) + ' pages'); }

  let bad = 0; for (const [ok, name, detail] of results) { console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); if (!ok) bad++; }
  console.log(results.length + ' checks, ' + (bad ? bad + ' failed' : 'all pass'));
  if (bad) process.exitCode = 1;
})();
`);
