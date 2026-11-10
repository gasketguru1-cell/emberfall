// Scripted checks of individual rules: each one sets two fighters up, feeds exact inputs, and tests the outcome.
// Usage: node tests/rules.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const FL = [0, 0], NIB = [1, 0], LOOM = [1, 1], HOD = [1, 2], SACK = [2, 0], SPR = [3, 0], SCU = [4, 0], FOW = [5, 0];
  let SCRIPT = [null, null], t = 0; const results = [];
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  /* Two fighters standing on the main stage, facing each other, both driven by scripts. */
  function setup(A, B, xa, xb) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: B[0], ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = A[1]; F[1].fi = B[1];
    F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0;
    return F;
  }
  function run(n, each) { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } }
  function airborne(f, x, y) { f.x = x; f.y = y; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); }
  function check(name, ok, detail) { results.push([ok, name, detail || '']); }
  const tap = (at, len) => tt => tt >= at && tt < at + (len || 2);
  const smash = (i, x, y) => { i.lx = x || 0; i.ly = y || 0; i.atk = true; i.sm = true; };   /* a forward (or up / down) smash, as the CPU inputs it */

  /* ---- Armour: Hod's Ram Plate takes one light strike on the ground during frames 13 to 19, and nothing more ---- */
  {
    /* Hod is put into Ram Plate at a chosen frame and struck directly, so the timing is exact */
    const ram = (mf, air, hits) => { const [hod, fl] = setup(HOD, FL, 0, 50); hod.startMove('sspec'); hod.mf = mf; if (air) { hod.grounded = false; hod.plat = null; hod.y = 20; } const p0 = hod.pct, out = [];
      for (const d of hits) { applyHit(fl, hod, { d, a: 45, b: 20, k: 30, id: 'test:' + d + ':' + out.length }, 1, fl.x, true); out.push(hod.state === 'attack' ? 'kept going' : hod.state); } return { out: out.join(', '), took: hod.pct - p0 }; };
    const win = ROSTER[1].forms[2].moves.sspec.armor, light = ram(15, false, [8]), two = ram(15, false, [3, 3]), heavy = ram(15, false, [9]), early = ram(win[0] - 1, false, [3]), air = ram(15, true, [3]);
    check('armour: Ram Plate takes one light strike, and the damage', light.out === 'kept going' && light.took > 8, 'an 8% strike on frame 15: ' + light.out + ', Hod took ' + light.took.toFixed(1) + '% (armour frames ' + win.join('-') + ')');
    check('armour: a second strike gets through', two.out === 'kept going, hurt', 'two 3% strikes: ' + two.out);
    check('armour: a stronger hit stops the charge', heavy.out === 'hurt', 'a 9% strike: ' + heavy.out);
    check('armour: none before the window, none in the air', early.out === 'hurt' && air.out === 'hurt', 'frame ' + (win[0] - 1) + ': ' + early.out + '; in the air: ' + air.out);
    const [hod, fl] = setup(HOD, FL, 0, 20); SCRIPT[0] = (i, tt) => { if (tap(1)(tt)) { i.lx = 1; i.spc = true; } }; run(60);
    check('armour: the charge itself hits for 13%', fl.pct > 13 && fl.pct < 18, 'Flint took ' + fl.pct.toFixed(1) + '%');
  }

  /* ---- Projectiles: an attack puts out a projectile no more than 9 stronger than itself ---- */
  {
    let out = 0, hit = 0, tries = 0;
    for (let d = 0; d <= 16; d++) {
      const [nib, fl] = setup(NIB, FL, -34, 0); let gone = false, had = false;
      SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.spc = true; };
      SCRIPT[1] = (i, tt) => { if (tap(d)(tt)) { i.lx = -0.5; i.atk = true; } };
      run(60, () => { if (PROJ.length) had = true; else if (had) gone = true; });
      tries++; if (fl.pct > 0) hit++; else if (gone) out++;
    }
    check('projectile: a tilt puts a weak shot out', out > 0, out + ' of ' + tries + ' timings stopped the bolt, ' + hit + ' were hit by it');
    const [nib, fl] = setup(NIB, FL, -20, 0); SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.spc = true; }; run(60);   /* inside the bolt's short range */
    check('projectile: it hits when nothing meets it', fl.pct > 0, 'Flint took ' + fl.pct.toFixed(1) + '%');
  }
  {
    const stone = hold => { let out = 0, hit = 0, tries = 0;
      for (let d = 10; d <= 60; d += 2) {
        const [hod, nib] = setup(HOD, NIB, -30, 0); let had = false, gone = false;
        SCRIPT[0] = (i, tt) => { if (tt < (hold ? 20 : 2)) i.spc = true; };
        SCRIPT[1] = (i, tt) => { if (tap(d)(tt)) i.atk = true; };
        run(130, () => { if (PROJ.length) had = true; else if (had) gone = true; });
        tries++; if (nib.pct > 0) hit++; else if (gone) out++;
      }
      return { out, hit, tries }; };
    const small = stone(false), big = stone(true);
    check('projectile: a jab can knock out the tapped stone', small.out > 0, small.out + ' of ' + small.tries + ' timings stopped the 7% stone, ' + small.hit + ' were hit by it');
    check('projectile: a jab cannot stop the held stone', big.hit > 0 && big.out === 0, big.hit + ' of ' + big.tries + ' timings were hit by the 11% stone, ' + big.out + ' stopped it');
  }

  /* ---- Hitlag nudges: up to three stick flicks during the freeze shift the victim ---- */
  {
    const xs = [];
    for (const flick of [0, 1, -1]) {
      const [fl, nib] = setup(FL, NIB, 0, 10); let k = 0, x = null, n = 0;
      SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) smash(i, 1); };
      SCRIPT[1] = (i, tt, f) => { if (flick && f.state === 'hurt' && f.hitlag > 0) { if (k++ % 2 === 1) i.lx = flick; } };
      run(70, () => { if (nib.state === 'hurt' && nib.hitlag === 0 && x === null) { x = nib.x; n = nib.sdi; return false; } });
      xs.push([x, n]);
    }
    const right = xs[1][0] - xs[0][0], left = xs[2][0] - xs[0][0];
    check('hitlag nudge: three flicks move 3.3 units', Math.abs(right - 3.3) < 0.2 && Math.abs(left + 3.3) < 0.2 && xs[1][1] === 3, 'toward ' + right.toFixed(2) + ', away ' + left.toFixed(2) + ', nudges counted ' + xs[1][1]);
  }

  /* ---- Wall tech: launched into the stage wall; shield just before impact stops it, jump springs off ---- */
  {
    const out = {};
    for (const mode2 of ['none', 'tech', 'jump', 'late']) {
      const [fl, nib] = setup(FL, NIB, -40, 0); airborne(nib, EDGE + 20, -12); nib.launch(110, Math.PI, 1); let seen = null;
      SCRIPT[1] = (i, tt) => { if (mode2 === 'tech' && tap(0)(tt)) i.shd = true; if (mode2 === 'jump') { if (tap(0)(tt)) i.shd = true; i.jmp = true; } };
      if (mode2 === 'late') nib.techLock = 40;   /* a shield press already spent: mashing must not tech */
      if (mode2 === 'late') SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) i.shd = true; };
      run(14, () => { if ((nib.vx >= 0 || nib.state !== 'hurt') && seen === null) seen = { state: nib.state, vx: +nib.vx.toFixed(2), vy: +nib.vy.toFixed(2), inv: nib.invuln }; });
      out[mode2] = seen;
    }
    const d = k => JSON.stringify(out[k]);
    check('wall: no input bounces off', out.none && out.none.state === 'hurt' && out.none.vx > 0.5, d('none'));
    check('wall tech: shield stops dead with protection', out.tech && out.tech.state === 'air' && out.tech.vx === 0 && out.tech.inv > 0, d('tech'));
    check('wall tech: holding jump springs off', out.jump && out.jump.state === 'air' && out.jump.vy > 1.5 && out.jump.vx > 0.5, d('jump'));
    check('wall tech: a spent shield press does not tech', out.late && out.late.state === 'hurt' && out.late.vx > 0.5, d('late'));
  }

  /* ---- Wall jump: Nib only ---- */
  {
    const res = {};
    for (const [name, P] of [['Nib', NIB], ['Flint', FL]]) {
      const [a, b] = setup(P, FL, -40, 0); airborne(a, stageHalf(Math.min(-26 + a.st.h, 0)) + a.st.w / 2 + 0.3, -26); let best = -9, touched = false;   /* beside the sloping rock, below the ledge's reach */
      SCRIPT[0] = (i, tt) => { if (tt < 8) i.lx = -1; else if (tt === 8) i.lx = 0; else if (tt < 12) i.lx = 1; };
      run(16, () => { best = Math.max(best, a.vy); if (a.wallT > 0) touched = true; });
      res[name] = best; res[name + 'Touched'] = touched;
    }
    check('wall jump: Nib kicks off the wall', res.Nib > 2, 'best upward speed ' + res.Nib.toFixed(2) + ', touched the wall: ' + res.NibTouched);
    check('wall jump: Flint cannot', res.FlintTouched && res.Flint < 0.5, 'best upward speed ' + res.Flint.toFixed(2) + ', touched the wall: ' + res.FlintTouched);
  }

  /* ---- Clank: two equal ground attacks meeting cancel out ---- */
  {
    const [a, b] = setup(FL, FL, -12, 12); let both = false;
    SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) smash(i, 1); }; SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) smash(i, -1); };
    run(50, () => { if (a.state === 'rebound' && b.state === 'rebound') both = true; });
    check('clank: equal smashes cancel, nobody is hurt', both && a.pct === 0 && b.pct === 0, 'both recoiled: ' + both + ', damage ' + a.pct + ' / ' + b.pct);
  }

  /* ---- Ledge protection: more after a long time in the air, less when damaged ---- */
  {
    const grab = (airT, pct) => { const [f] = setup(FL, FL, 0, -40); airborne(f, EDGE + f.st.w / 2 + 3, -6); f.vy = -0.5; f.airT = airT; f.pct = pct; let inv = null; let open = 0; run(12, () => { if (f.state === 'ledge') { if (f.invuln === 0 && f.sf <= 2) open++; if (f.sf === 2 && inv === null) { inv = f.invuln + 2; return false; } } }); grab.open = open; return inv; };
    const short = grab(20, 0), long = grab(300, 0), worn = grab(20, 120);
    check('ledge: protection grows with air time, shrinks with damage', short !== null && long > short + 15 && worn < short - 10 && worn >= 7, 'frames protected: short hop ' + short + ', long fall ' + long + ', at 120% ' + worn);
  }
  /* ---- Ledge get-ups are slower above 100% ---- */
  {
    const climb = (pct, how) => { const [f] = setup(FL, FL, 0, -40); f.x = EDGE + f.st.w / 2 + 0.5; f.y = -f.st.h + 1; f.grounded = false; f.plat = null; f.pct = pct; f.set('ledge'); let n = 0, done = null, hitAt = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 12 && tt < 14) { if (how === 'climb') i.lx = -1; else i.atk = true; } };
      run(90, () => { if (t >= 12) n++; if (how === 'attack' && hitAt === null && f.state === 'attack' && f.mf >= f.move.h[0].f0) { hitAt = n; return false; } if (how === 'climb' && f.state === 'idle') { done = n; return false; } });
      return how === 'climb' ? done : hitAt; };
    const c0 = climb(0, 'climb'), c1 = climb(120, 'climb'), a0 = climb(0, 'attack'), a1 = climb(120, 'attack');
    check('ledge: climbing up is slower above 100%', c0 !== null && c1 === c0 + 8, 'frames to stand: ' + c0 + ' fresh, ' + c1 + ' at 120%');
    check('ledge: get-up attack comes out later above 100%', a0 !== null && a1 === a0 + 8, 'first active frame after ' + a0 + ' fresh, ' + a1 + ' at 120%');
  }
  /* ---- Jabs: holding attack runs the chain; Nib's becomes a flurry that ends when the button is let go ---- */
  {
    const [fl, b] = setup(FL, FL, 0, 11); const seen = [];
    SCRIPT[0] = (i, tt) => { if (tt < 70) i.atk = true; };
    run(90, () => { if (fl.state === 'attack' && seen[seen.length - 1] !== fl.mname) seen.push(fl.mname); });
    check('jab: holding attack runs all three', seen.join('>') === 'jab>jab2>jab3', seen.join(' > '));
  }
  {
    const [nib, b] = setup(NIB, FL, 0, 8); const seen = [];
    SCRIPT[0] = (i, tt) => { if (tt < 60) i.atk = true; };
    run(90, () => { if (nib.state === 'attack' && seen[seen.length - 1] !== nib.mname) seen.push(nib.mname); });
    check('jab: Nib has three hits, 2% 2% 3%', seen.join('>') === 'jab>jab2>jab3' && Math.abs(b.pct - 7 * DMG_1V1) < 0.8, seen.join(' > ') + ', target at ' + b.pct.toFixed(1) + '% (7% before the one-on-one bonus)');
  }
  /* ---- Angled forward tilt: a slight up or down on the stick moves the hit ---- */
  {
    const tilt = (lx, ly) => { const [f] = setup(FL, FL, 0, 60); let got = null;
      SCRIPT[0] = (i, tt) => { if (tt < 10) { i.lx = 0.4; i.ly = ly * 0.4; } else { i.lx = lx; i.ly = ly; } if (tt >= 12 && tt < 14) i.atk = true; };
      run(24, () => { if (f.state === 'attack' && got === null) got = f.mname + ' aim ' + f.aim + ' y ' + hitY(f, f.move.h[0]).toFixed(1); }); return got; };
    const flat = tilt(0.6, 0), up = tilt(0.6, 0.35), down = tilt(0.6, -0.35), steep = tilt(0.9, 0.55), high = tilt(0.4, 0.9);
    check('angled tilt: up, level and down', /^ftilt aim 0 /.test(flat) && /^ftilt aim 1 /.test(up) && /^ftilt aim -1 /.test(down), 'level: ' + flat + ' | up: ' + up + ' | down: ' + down);
    check('angled tilt: a mostly sideways diagonal is still a forward tilt', /^ftilt aim 1 /.test(steep) && /^utilt/.test(high), 'steep diagonal: ' + steep + ' | mostly up: ' + high);
  }
  /* ---- No tap jump: pushing the stick up never jumps, held or flicked ---- */
  {
    const up = hold => { const [f] = setup(FL, FL, 0, 60); let top = 0, states = new Set(); SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < (hold ? 30 : 4)) i.ly = 1; }; run(60, () => { top = Math.max(top, f.y); states.add(f.state); }); return { top, jumped: states.has('jsq') || states.has('air') }; };
    const held = up(true), flick = up(false);
    check('stick up never jumps', held.top === 0 && flick.top === 0 && !held.jumped && !flick.jumped, 'height reached: held ' + held.top.toFixed(1) + ', flicked ' + flick.top.toFixed(1));
  }

  /* ---- Shield: a worn shield leaves the feet open to a low attack unless it is tilted down to cover them ---- */
  {
    const low = (hp, tilt) => { const [a, v] = setup(FL, FL, 0, 9); v.shieldHp = hp; let res = null;
      SCRIPT[1] = (i, tt) => { i.shd = true; i.ly = tilt; };
      SCRIPT[0] = (i, tt) => { if (tt < 12) i.ly = -1; if (tt >= 10 && tt < 12) i.atk = true; };
      run(40, () => { if (res === null && (v.pct > 0 || v.state === 'shieldstun' || v.state === 'broken')) res = v.state + (v.pct > 0 ? ' hit' : v.state === 'broken' ? ' shield broke' : ' blocked'); }); return res + ' (' + a.mname + ')'; };
    const full = low(50, 0), worn = low(14, 0), tilted = low(14, -0.5);
    check('shield: a full shield blocks a low attack', /blocked/.test(full), full);
    check('shield: a worn shield gets poked at the feet', /hurt hit/.test(worn), worn);
    check('shield: tilting the worn shield down covers them', /blocked/.test(tilted), tilted);
  }
  /* ---- Attacking while turning out of a run gives a turnaround tilt or smash, not a dash attack ---- */
  {
    const turn = back => { const [f] = setup(FL, FL, -40, 60); let got = null;
      SCRIPT[0] = (i, tt) => { if (tt < 30) i.lx = 1; else if (tt < 32) { i.lx = back; i.atk = true; } };
      run(40, () => { if (got === null && f.state === 'attack') got = f.mname + ' facing ' + (f.face > 0 ? 'right' : 'left'); }); return got; };
    const tilt = turn(-0.7), smash = turn(-1);
    check('run: back + attack is a turnaround tilt or smash', tilt === 'ftilt facing left' && smash === 'fsmash facing left', 'gentle: ' + tilt + ' | hard: ' + smash);
  }

  /* ---- The player's own movement rules (numbers from platforms.ini). These must not drift. ---- */
  {
    const wd = (lx, ly, attackAt) => { const [f] = setup(FL, FL, 0, 60); let first = null, inWd = 0, acted = null; const x0 = f.x;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) i.jmp = true; if (tt >= 4 && tt < 9) { i.shd = true; i.lx = lx; i.ly = ly; } if (attackAt && tt >= attackAt && tt < attackAt + 2) i.atk = true; };
      run(70, () => { if (f.state === 'wd') { inWd++; if (first === null) first = +Math.abs(f.vx).toFixed(2); } else if (inWd && acted === null) acted = f.state + ' after ' + inWd + ' frames'; });
      return { speed: first, dist: +(f.x - x0).toFixed(1), acted }; };
    const long = wd(1, -0.2), short = wd(0.7, -0.7), inPlace = wd(0.1, -1), act = wd(1, -0.2, 7);
    check('wavedash: long, short and in place', long.speed === T.wd_long_speed && short.speed === T.wd_short_speed && inPlace.speed === 0 && long.dist > short.dist * 2.5,
      'start speeds ' + long.speed + ' / ' + short.speed + ' / ' + inPlace.speed + ', slides ' + long.dist + ' and ' + short.dist + ' units');
    check('wavedash: can act on frame ' + T.wd_actionable_frame, act.acted === 'attack after ' + T.wd_actionable_frame + ' frames', 'attack buffered during the slide -> ' + act.acted);
  }
  {
    const P = PLATS[1], px = (P.x0 + P.x1) / 2;   /* a soft platform and its middle */
    const onPlat = (script, solid) => { const [f] = setup(FL, FL, solid ? 0 : px, 60); if (!solid) { f.y = P.y; f.plat = P; } let low = f.y; const seen = [];
      SCRIPT[0] = script; run(50, () => { low = Math.min(low, f.y); if (seen[seen.length - 1] !== f.state) seen.push(f.state); }); return { y: Math.round(f.y), states: seen.join('>') }; };
    const flick = onPlat((i, tt) => { if (tt >= 4 && tt < 7) i.ly = -1; }), slow = onPlat((i, tt) => { if (tt >= 4) i.ly = -0.5; });
    check('platform: a down flick drops through, a slow tilt crouches', flick.y === 0 && slow.y === P.y, 'flick ends at height ' + flick.y + ' (' + flick.states + '), slow tilt stays at ' + slow.y);
    const sd = onPlat((i, tt) => { if (tt < 14) i.shd = true; if (tt >= 10 && tt < 13) i.ly = -1; }), sm = onPlat((i, tt) => { if (tt < 14) i.shd = true; if (tt >= 10 && tt < 13) i.ly = -1; }, true);
    check('shield drop: down in shield drops through a platform, spot-dodges on the stage', sd.y === 0 && /shield>air/.test(sd.states) && /shield>spot/.test(sm.states), 'on a platform: ' + sd.states + ' | on the stage: ' + sm.states);
    const fall = hold => { const [f] = setup(FL, FL, px, 60); airborne(f, px, P.y + 20); SCRIPT[0] = i => { if (hold) i.ly = -1; }; let landed = null; run(80, () => { if (f.grounded && landed === null) landed = Math.round(f.y); }); return landed; };
    check('platform: holding down in the air falls through it', fall(false) === P.y && fall(true) === 0, 'lands at height ' + fall(false) + ' normally, ' + fall(true) + ' holding down');
  }
  {
    const guard = release => { const [a, v] = setup(FL, FL, 0, 11); let lag = 0, st = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 10 && tt < 12) i.atk = true; }; SCRIPT[1] = (i, tt) => { if (release !== null && tt < release) i.shd = true; };
      run(40, () => { lag = Math.max(lag, a.hitlag); if (st === null && (v.pct > 0 || v.state === 'shieldstun')) st = v.state; }); return { pct: +v.pct.toFixed(1), lag, st }; };
    const open = guard(null), held = guard(99), timed = guard(12);
    check('parry: releasing shield just before the hit', open.pct > 0 && held.pct === 0 && held.st === 'shieldstun' && timed.pct === 0 && timed.st === null && timed.lag >= 16,
      'no shield: ' + open.pct + '% | held: ' + held.st + ' | released in time: ' + timed.pct + '%, attacker frozen ' + timed.lag + ' frames');
  }
  {
    const floor = (shield, lx) => { const [a, v] = setup(FL, FL, -60, 0); airborne(v, 0, 22); v.launch(120, -Math.PI / 2, 1); const seen = [];
      SCRIPT[1] = (i, tt) => { if (shield && tt < 2) i.shd = true; i.lx = lx; }; run(30, () => { if (seen[seen.length - 1] !== v.state) seen.push(v.state); }); return seen.join('>'); };
    const none = floor(false, 0), tech = floor(true, 0), roll = floor(true, 1);
    check('tech: shield before hitting the floor', /hurt>down/.test(none) && /hurt>land/.test(tech) && /hurt>roll/.test(roll), 'nothing: ' + none + ' | shield: ' + tech + ' | shield + direction: ' + roll);
  }
  {
    const [a, v] = setup(FL, FL, 0, 11); const got = []; let last = 0;
    SCRIPT[0] = (i, tt) => { if (tt % 45 >= 2 && tt % 45 < 4) i.atk = true; };
    run(140, () => { if (v.pct > last + 0.01) { got.push(+(v.pct - last).toFixed(2)); last = v.pct; } });
    check('stale moves: the same attack weakens when repeated', got.length >= 3 && got[0] > got[1] && got[1] > got[2], 'three jabs did ' + got.slice(0, 3).join(', ') + '%');
  }
  {
    const hop = (hold, withAttack) => { const [f] = setup(FL, FL, 0, 60); let top = 0, sh = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < (hold ? 30 : 4)) i.jmp = true; if (withAttack && tt >= 2 && tt < 4) i.atk = true; };
      run(60, () => { top = Math.max(top, f.y); if (f.state === 'attack' && sh === null) sh = f.mname + (f.moveSH ? ' (short-hop, weaker)' : '') + (f.grounded ? ' on the ground' : ' in the air'); }); return { top: +top.toFixed(1), sh }; };
    const full = hop(true), short = hop(false), macro = hop(false, true);
    check('jump: tap for a short hop, hold for a full one', short.top > 8 && short.top < full.top * 0.6, 'heights ' + short.top + ' and ' + full.top);
    check('jump + attack together: a short-hop aerial', macro.sh === 'nair (short-hop, weaker) in the air', String(macro.sh));
  }

  /* ---- The match clock: 3 stocks, 8 minutes; time-out goes to more stocks, then less damage, then sudden death ---- */
  {
    const [a0, b0] = setup(FL, NIB, -30, 30);
    check('match: starts with 3 stocks and 8 minutes', a0.stocks === 3 && b0.stocks === 3 && STOCKS === 3 && MATCH_FRAMES === 8 * 60 * 60 && timer > MATCH_FRAMES - 30, a0.stocks + ' stocks each, ' + (MATCH_FRAMES / 3600) + ' minutes');
    const clock = (sa, sb, pa, pb) => { const [a, b] = setup(FL, NIB, -30, 30); a.stocks = sa; b.stocks = sb; a.pct = pa; b.pct = pb; timer = 2; run(4); return { mode, result, sudden, pct: [a.pct, b.pct], stocks: [a.stocks, b.stocks] }; };
    const byStock = clock(2, 3, 0, 150), byPct = clock(2, 2, 40, 90), tie = clock(2, 2, 50, 50);
    check('time-out: more stocks wins, then less damage', byStock.mode === 'over' && byStock.result === 'WREN WINS' && byPct.mode === 'over' && byPct.result === 'FLINT WINS', 'stocks 2 v 3: ' + byStock.result + ' | 40% v 90%: ' + byPct.result);
    check('time-out: a full tie goes to sudden death', tie.mode === 'play' && tie.sudden && tie.pct[0] === 300 && tie.pct[1] === 300 && tie.stocks.join() === '1,1', 'mode ' + tie.mode + ', both at ' + tie.pct.join(' / ') + '%, stocks ' + tie.stocks.join(' / '));
  }

  /* ---- Fighters block and push each other on the ground ---- */
  {
    const into = (A, B, script, n, from) => { const [a, b] = setup(A, B, from || -30, 0); const b0 = b.x; SCRIPT[0] = script; let passed = false; run(n || 70, () => { if (a.x > b.x) passed = true; }); return { passed, gap: b.x - a.x, shove: b.x - b0, ax: a.x }; };
    const dashIn = (i, tt) => { if (tt >= 2) i.lx = 1; };
    const fl = into(FL, FL, dashIn), heavy = into(FL, HOD, dashIn), light = into(FL, NIB, dashIn);
    check('push: running into a standing fighter does not pass through', !fl.passed && fl.gap > 3 && !heavy.passed && !light.passed, 'Flint ends ' + fl.gap.toFixed(1) + ' behind the other, who was shoved ' + fl.shove.toFixed(1));
    check('push: the one run into is shoved along, a heavy one less', fl.shove > 3 && fl.shove < 25 && light.shove > heavy.shove * 1.15, 'Flint shoves in 70 frames: Flint ' + fl.shove.toFixed(1) + ', Nib ' + light.shove.toFixed(1) + ', Hod ' + heavy.shove.toFixed(1));
    const roll = into(FL, FL, (i, tt) => { if (tt >= 2 && tt < 40) i.shd = true; if (tt >= 8 && tt < 12) i.lx = 1; }, 60, -12);
    const [ja, jb] = setup(FL, FL, -30, 0); SCRIPT[0] = (i, tt) => { if (tt >= 2) i.lx = 1; i.jmp = tt >= 6 && tt < 30; }; let over = false; run(60, () => { if (ja.x > jb.x) over = true; });
    check('push: a roll goes through and a jump goes over', roll.passed && over, 'roll passed: ' + roll.passed + ', jump passed: ' + over);
    const [ea, eb] = setup(FL, FL, EDGE - 20, EDGE - 2); SCRIPT[0] = dashIn; run(80);
    check('push: nobody standing still is shoved off the stage', eb.grounded && eb.x <= EDGE && ea.x < eb.x, 'the one at the edge is at ' + eb.x.toFixed(1) + ' of ' + EDGE + (eb.grounded ? ', standing' : ', FELL'));
    const [la, lb] = setup(FL, FL, 0, 0.5); lb.face = -1; run(30);
    check('push: fighters standing inside each other slide apart', Math.abs(lb.x - la.x) >= la.st.jf + lb.st.jf - 0.01, 'apart by ' + Math.abs(lb.x - la.x).toFixed(1) + ' after 30 frames');
  }

  /* ---- Grabs and throws: a grab always holds long enough to throw, and either stick throws, held or flicked ---- */
  {
    const grab = after => { const [a, v] = setup(FL, FL, 0, 9); let held = 0, thrown = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) i.grb = true; if (a.state === 'hold' && after) after(i); };
      SCRIPT[1] = (i, tt, f) => { if (f.state !== 'held') return; i.grb = tt % 2 === 0; i.atk = tt % 2 === 1; i.lx = tt % 4 < 2 ? 1 : -1; };   /* the victim mashes as hard as anything can, at 0% */
      run(140, () => { if (a.state === 'hold') held++; if (a.state === 'throw' && thrown === null) thrown = a.throwK; }); return { held, thrown, pct: v.pct }; };
    const idle = grab(null), stick = grab(i => { i.ly = 1; }), cf = grab(i => { i.cx = 1; }), cb = grab(i => { i.cx = -1; }), cu = grab(i => { i.cy = 1; }), cd = grab(i => { i.cy = -1; });
    check('grab: holds at least ' + GRAB_MIN + ' frames at 0% against any mashing', idle.thrown === null && idle.held >= GRAB_MIN - 1 && idle.held < 60, 'held for ' + idle.held + ' frames');
    check('throw: a held left stick throws at 0%', stick.thrown === 'u' && stick.pct > 0 && stick.held < 12, 'threw ' + stick.thrown + ' after ' + stick.held + ' frames of holding, ' + stick.pct.toFixed(1) + '% dealt');
    check('throw: the right stick throws in all four directions', cf.thrown === 'f' && cb.thrown === 'b' && cu.thrown === 'u' && cd.thrown === 'd' && cf.pct > 0, 'right stick forward / back / up / down -> ' + [cf, cb, cu, cd].map(q => q.thrown).join(' / '));
  }

  /* ---- Right stick is a tilt stick; smashes come from a flick with attack or attack + special; attack held charges ---- */
  {
    const act = (script, n) => { const [f] = setup(FL, FL, 0, 50); let name = null, face = 0, air = false, charge = 0, hold = 0; SCRIPT[0] = script;
      run(n || 30, () => { if (f.state === 'attack') { if (name === null) { name = f.mname; face = f.face; air = !f.grounded; } charge = Math.max(charge, f.charge); if (f.move && f.move.chg && f.mf === f.move.chg) hold++; } }); return { name, face, air, charge, hold }; };
    const at = (k, v) => (i, tt) => { if (tt >= 2 && tt < 4) i[k] = v; };
    const cr = act(at('cx', 1)), cl = act(at('cx', -1)), cu = act(at('cy', 1)), cd = act(at('cy', -1));
    check('right stick: tilts on the ground', cr.name === 'ftilt' && cr.face === 1 && cl.name === 'ftilt' && cl.face === -1 && cu.name === 'utilt' && cd.name === 'dtilt', 'right / left / up / down -> ' + [cr, cl, cu, cd].map(q => q.name + (q.face < 0 ? ' (turned)' : '')).join(', '));
    const flick = act((i, tt) => { if (tt >= 2 && tt < 4) { i.lx = 1; i.atk = true; } }), slow = act((i, tt) => { if (tt >= 2) i.lx = 0.5; if (tt >= 12 && tt < 14) i.atk = true; });
    const flickUp = act((i, tt) => { if (tt >= 2 && tt < 4) { i.ly = 1; i.atk = true; } }), ab = act((i, tt) => { if (tt >= 2 && tt < 4) { i.atk = true; i.spc = true; } }), abUp = act((i, tt) => { if (tt >= 2 && tt < 4) { i.ly = 1; i.atk = true; i.spc = true; } });
    check('smash: a flick with attack smashes, a held stick tilts', flick.name === 'fsmash' && flickUp.name === 'usmash' && slow.name === 'ftilt', 'flick + attack -> ' + flick.name + ', flick up + attack -> ' + flickUp.name + ', stick held then attack -> ' + slow.name);
    check('smash: attack + special together', ab.name === 'fsmash' && abUp.name === 'usmash', 'no direction -> ' + ab.name + ', up -> ' + abUp.name);
    const tapped = act((i, tt) => { if (tt >= 2 && tt < 4) { i.lx = 1; i.atk = true; } }, 80), half = act((i, tt) => { if (tt >= 2 && tt < 4) i.lx = 1; if (tt >= 2 && tt < 40) i.atk = true; }, 120), full = act((i, tt) => { if (tt >= 2 && tt < 4) i.lx = 1; if (tt >= 2) i.atk = true; }, 300);
    check('smash: holding attack charges for a second, holds for two more', tapped.charge === 0 && half.charge > 20 && half.charge < 40 && full.charge === 60 && full.hold === SMASH_HOLD + 1, 'charge: tapped ' + tapped.charge + ', held 38 frames ' + half.charge + ', held throughout ' + full.charge + ' (released after ' + (full.hold - 1) + ' frames)');
    const hopAir = act((i, tt) => { if (tt >= 2 && tt < 8) i.jmp = true; if (tt >= 3 && tt < 5) i.cx = 1; }, 20);
    check('right stick: in the start-up of a jump it gives an aerial', hopAir.name === 'fair' && hopAir.air, String(hopAir.name) + (hopAir.air ? ' in the air' : ' on the ground'));
  }

  /* ---- Flint's and Wren's down specials hang in the air until they finish, once per time off the ground ---- */
  for (const [name, A, len, y0s, again] of [['Flint', FL, 49, 60, 61], ['Wren (Nib)', NIB, 32, 125, 70]]) {   /* again: when the second press comes (Wren must wait out the swap lockout) */
    const [f] = setup(A, FL, 0, 50); airborne(f, 0, y0s); f.vy = -1; const fi0 = f.fi; let y0 = null, drop1 = 0, frames1 = 0, drop2 = 0, second = false, n = 0;
    SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= again && tt < again + 2)) { i.ly = -1; i.spc = true; } };
    run(again + 24, () => { n++; if (f.state === 'attack' && f.mname === 'dspec') { if (n < again - 2) { if (y0 === null) y0 = f.y; drop1 = Math.max(drop1, y0 - f.y); frames1++; } else { if (!second) { second = true; y0 = f.y; } drop2 = Math.max(drop2, y0 - f.y); } } });
    check(name + ': down special hangs in the air, once', frames1 >= len - 2 && drop1 < 0.01 && second && drop2 > 5 && (A === FL || f.fi !== fi0), 'first use: ' + frames1 + ' frames, fell ' + drop1.toFixed(1) + '; second use before landing: fell ' + drop2.toFixed(1));
  }

  /* ---- Under the island: nothing to hit a head on. An up special from anywhere beneath it slides out and takes the ledge ---- */
  {
    const res = [];
    for (const [name, A] of [['Flint', FL], ['Nib', NIB], ['Loom', LOOM], ['Hod', HOD]]) for (const x of [6, 30, 55, -42]) {
      const [f] = setup(A, FL, 0, 0); F[1].x = -10; airborne(f, x, -Math.round(f.form.aiRise * 0.7)); f.jumps = 0;   /* as deep as its up special can climb out of */ let stuck = 0, end = null, lastY = f.y;
      SCRIPT[0] = (i, tt) => { if (tt >= 1 && tt < 3) { i.ly = 1; i.spc = true; } };
      run(260, () => { if (f.vy > 0.5 && f.y <= lastY + 0.01) stuck++; lastY = f.y; if (end === null && (f.state === 'ledge' || f.grounded)) end = f.state === 'ledge' ? 'ledge' : 'stage'; if (f.state === 'dead' && end === null) end = 'lost'; });
      res.push({ name, x, end, stuck });
    }
    const failed = res.filter(r => r.end !== 'ledge' && r.end !== 'stage'), blocked = res.filter(r => r.stuck > 0);
    check('island: an up special from underneath always gets out', failed.length === 0, failed.length ? failed.map(r => r.name + ' from x ' + r.x + ' -> ' + r.end).join(', ') : res.length + ' starts beneath the island, all reached the ledge or the stage');
    check('island: rising under it is never stopped', blocked.length === 0, blocked.length ? blocked.map(r => r.name + ' from x ' + r.x + ' held for ' + r.stuck + ' frames').join(', ') : 'no frame with upward speed and no upward movement');
  }

  /* ---- The owner's moveset document: numbers and specials for Flint, Nib, Loom and Hod ---- */
  {
    /* every listed attack has the document's first active frame and damage; late and near parts, throws, pummel and grab too */
    const wrong = [];
    for (const def of ROSTER) for (const fm of def.forms) { const K = KIT[fm.name]; if (!K) continue;
      for (const k in K) { const q = K[k], m = fm.moves[k]; if (!Array.isArray(q)) continue; const h = m.h[0], o = q[2] || {};
        if (h.f0 !== q[0] || h.d !== q[1]) wrong.push(fm.name + ' ' + k + ' is f' + h.f0 + ' / ' + h.d + '%');
        if (o.rear && (m.h[1].f0 !== o.rear[0] || m.h[1].d !== o.rear[1])) wrong.push(fm.name + ' ' + k + ' rear');
        if (o.late !== undefined && !m.h.some(x => x.part === 'late' && x.d === o.late && x.f0 > h.f1 - 1)) wrong.push(fm.name + ' ' + k + ' late');
        const mid = fm.st.h / 2; if (o.sour !== undefined && !m.h.some(x => x.part === 'near' && x.d === o.sour && Math.hypot(x.x, x.y - mid) < Math.hypot(h.x, h.y - mid))) wrong.push(fm.name + ' ' + k + ' near');
        if (m.chg && m.chg >= h.f0) wrong.push(fm.name + ' ' + k + ' charges after it hits');
      }
      if (fm.moves.grab.h[0].f0 !== K.grab || fm.st.pummel !== K.pummel) wrong.push(fm.name + ' grab or pummel');
      for (const k in K.throws) if (fm.moves.throws[k].d !== K.throws[k]) wrong.push(fm.name + ' throw ' + k);
    }
    check('document: every attack has its listed frame and damage', wrong.length === 0, wrong.length ? wrong.slice(0, 6).join('; ') : 'checked ' + Object.keys(KIT).length + ' fighters against the table');
  }
  {
    /* helpers: one fighter does one special; what happened to it and to a target placed at a distance */
    const cast = (A, input, dist, n, opt) => { opt = opt || {}; const [f, v] = setup(A, FL, 0, dist); if (opt.air) airborne(f, 0, opt.air); if (opt.vAir) airborne(v, dist, opt.vAir); const x0 = f.x, y0 = f.y; let top = y0, far = 0, back = 0, firstHit = null, vState = '';
      SCRIPT[0] = (i, tt) => input(i, tt, f); if (opt.v) SCRIPT[1] = opt.v;
      run(n, () => { top = Math.max(top, f.y); far = Math.max(far, (f.x - x0) * (opt.dir || 1)); back = Math.min(back, f.x - x0); if (opt.vAir && v.state === 'air') { v.y = opt.vAir; v.vy = 0; } if (v.pct > 0 && firstHit === null) { firstHit = { at: t, pct: v.pct / DMG_1V1 }; vState = v.state; } if (opt.each) opt.each(f, v); });
      return { rise: top - y0, far, back, hit: firstHit, vState, vPct: v.pct / DMG_1V1, f, v }; };
    const spc = (lx, ly, hold) => (i, tt) => { if (tt >= 2 && tt < (hold || 4)) { i.spc = true; i.lx = lx; i.ly = ly; } };
    const near = (v, w, tol) => Math.abs(v - w) <= tol, r1 = v => v === null || v === undefined ? 'none' : v.toFixed(1), fr = d => d * FRESH;   /* fr: a move's first use hits 5% harder */

    /* Flint */
    let patch = null, patchLife = 0; { const [f] = setup(FL, FL, -50, 60); SCRIPT[0] = spc(0, 0); run(130, () => { const q = PROJ.find(x => x.patch); if (q) { patch = q; patchLife++; } }); }   /* thrown from far enough that it lands before reaching anyone */
    const two = (() => { const [f] = setup(FL, FL, 0, 60); let most = 0; SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= 44 && tt < 46)) i.spc = true; }; run(100, () => { most = Math.max(most, PROJ.filter(x => x.owner === 0).length); }); return most; })();
    check('Flint: Banked Coal leaves one ember for 45 frames, and a new coal clears the old', patch !== null && near(patchLife, 45, 2) && patch.h.d === 4 && two === 1, 'ember lasted ' + patchLife + ' frames at ' + (patch ? patch.h.d : '?') + '%; most of his shots alive at once: ' + two);
    const rush = cast(FL, spc(1, 0), 60, 60), rushClean = cast(FL, spc(1, 0), 16, 60), rushLate = cast(FL, spc(1, 0), 30, 60);
    check('Flint: Lamp Rush lunges about 1.1 H, 10% clean and 7% late', near(rush.far, 15.4, 2.5) && near(rushClean.vPct, fr(10), 0.3) && near(rushLate.vPct, fr(7), 0.3), 'travelled ' + r1(rush.far) + ' (15.4); close target ' + r1(rushClean.vPct) + '%, far target ' + r1(rushLate.vPct) + '%');
    const up = cast(FL, spc(0, 1), 60, 90);
    check('Flint: Updraft lifts about 2 H', near(up.rise, 28, 2.5), 'rose ' + r1(up.rise) + ' (28)');
    const cone = cast(FL, spc(0, -1), 12, 70), miss = cast(FL, spc(0, -1), 30, 70);
    const wave = (() => { const [f, v] = setup(FL, FL, -50, 60); let embers = 0, left = -1; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) i.spc = true; if (tt >= 64 && tt < 66) { i.ly = -1; i.spc = true; } };
      run(112, () => { const q = PROJ.find(x => x.patch); if (t === 62 && q) { embers = 1; f.x = q.x - 14; v.x = q.x + 16; }   /* Flint steps up to his ember; the target stands beyond the cone */
        if (t === 96) left = PROJ.filter(x => x.patch).length; }); return { embers, pct: v.pct / DMG_1V1, left }; })();
    check('Flint: Bellows Burst hits for 15% in a short cone', near(cone.vPct, fr(15), 0.3) && cone.hit && cone.hit.at >= 24 && cone.hit.at <= 29 && miss.vPct === 0, 'in the cone: ' + r1(cone.vPct) + '% on frame ' + (cone.hit ? cone.hit.at - 1 : '?') + '; at 30 away: ' + r1(miss.vPct) + '%');
    check('Flint: Bellows Burst uses up his ember and sends a flame further', wave.embers === 1 && wave.left === 0 && near(wave.pct, fr(8), 0.3), 'ember there before: ' + wave.embers + ', after: ' + wave.left + '; a target beyond the cone took ' + r1(wave.pct) + '%');

    /* Nib */
    const boltIn = cast(NIB, spc(0, 0), 20, 40), boltOut = cast(NIB, spc(0, 0), 36, 40);
    check('Nib: Quick Bolt is fast, weak and short (about 1.8 H)', near(boltIn.vPct, fr(4), 0.2) && boltIn.hit.at <= 18 && boltOut.vPct === 0, 'at 20 away: ' + r1(boltIn.vPct) + '% on frame ' + (boltIn.hit ? boltIn.hit.at : '?') + '; at 36 away: ' + r1(boltOut.vPct) + '%');
    const pounce = cast(NIB, spc(1, 0), 60, 60), pounceHit = cast(NIB, spc(1, 0), 16, 60); let freeAt = null;
    const brake = cast(NIB, spc(1, 0, 16), 16, 60, { each: f => { if (freeAt === null && t > 6 && f.state !== 'attack') freeAt = t; } });
    check('Nib: False Start let go is a pounce of about 1.3 H for 9%', near(pounce.far, 18.2, 3) && near(pounceHit.vPct, fr(9), 0.3), 'travelled ' + r1(pounce.far) + ' (18.2), ' + r1(pounceHit.vPct) + '%');
    check('Nib: False Start held stops short at about 0.55 H, with no hit', near(brake.far, 7.7, 2) && brake.vPct === 0 && freeAt !== null && freeAt <= 27, 'travelled ' + r1(brake.far) + ' (7.7), ' + r1(brake.vPct) + '%, free on frame ' + (freeAt === null ? 'never' : freeAt - 2));
    const steep = cast(NIB, spc(0, 1), 60, 80), diag = cast(NIB, (i, tt) => { if (tt >= 2 && tt < 4) { i.ly = 1; i.spc = true; } else if (tt >= 4 && tt < 14) i.lx = 1; }, 60, 80);   /* the direction is chosen during the start-up, after the press */
    check('Nib: Spring Vault goes steep, or diagonal with the stick', near(steep.rise, 38, 3) && steep.far < 6 && diag.far > 25 && diag.rise < steep.rise && diag.rise > 20, 'steep: up ' + r1(steep.rise) + ', across ' + r1(steep.far) + '; diagonal: up ' + r1(diag.rise) + ', across ' + r1(diag.far));

    /* Loom */
    const gustIn = cast(LOOM, spc(0, 0), 10, 50), gustAir = cast(LOOM, spc(0, 0), 24, 50, { air: 30, vAir: 30 }), gustGnd = cast(LOOM, spc(0, 0), 24, 50), gustShield = cast(LOOM, spc(0, 0), 24, 50, { v: i => { i.shd = true; } });
    const pushAir = gustAir.v.x - 24, pushGnd = gustGnd.v.x - 24, pushSh = gustShield.v.x - 24;
    check('Loom: Crossbreeze deals 3% up close and only pushes further out', near(gustIn.vPct, fr(3), 0.2) && gustAir.vPct === 0 && gustGnd.vPct === 0 && pushAir > 6 && pushGnd > 1 && pushGnd < pushAir, 'close: ' + r1(gustIn.vPct) + '%; pushed in the air ' + r1(pushAir) + ', on the ground ' + r1(pushGnd) + ', no damage');
    check('Loom: a shield blocks the gust', Math.abs(pushSh) < 0.5, 'a shielding target moved ' + r1(pushSh));
    const tip = cast(LOOM, spc(1, 0), 16, 60), inner = cast(LOOM, spc(1, 0), 8, 60);
    const slingAir = (() => { const [f] = setup(LOOM, FL, 0, 60); airborne(f, 0, 90); const xs = []; SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= 52 && tt < 54)) { i.lx = 1; i.spc = true; } }; let x0 = 0; run(100, () => { if (t === 20) x0 = f.x; if (t === 30) xs.push(f.x - x0); if (t === 70) x0 = f.x; if (t === 80) xs.push(f.x - x0); }); return xs; })();
    check('Loom: Ribbon Sling is 11% at the weight and 6% on the inner ribbon', near(tip.vPct, fr(11), 0.3) && near(inner.vPct, fr(6), 0.3), 'well spaced ' + r1(tip.vPct) + '%, close ' + r1(inner.vPct) + '%');
    check('Loom: the sling recoils about 0.3 H, once per time off the ground', near(-tip.back, 4.2, 1.5) && slingAir[0] < -2.5 && slingAir[1] > -1.5, 'on the ground ' + r1(-tip.back) + ' (4.2); in the air first ' + r1(slingAir[0]) + ', second ' + r1(slingAir[1]));
    const tap = cast(LOOM, spc(0, 1), 60, 100), held = cast(LOOM, spc(0, 1, 40), 60, 100);
    check('Loom: Thermal is a short lift on a tap, about 2.4 H held', near(held.rise, 33.6, 3.5) && tap.rise > 6 && tap.rise < held.rise * 0.6, 'tapped: ' + r1(tap.rise) + '; held: ' + r1(held.rise) + ' (33.6)');

    /* Hod */
    const stone = hold => { const [f, v] = setup(HOD, FL, 0, 30); let at = null, most = 0, began = null, first = null; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < (hold ? 22 : 4)) i.spc = true; if (!hold && tt >= 50 && tt < 52) i.spc = true; };
      run(120, () => { if (began === null && f.state === 'attack') began = t; const mine = PROJ.filter(x => x.owner === 0); most = Math.max(most, mine.length); if (mine.length && at === null) at = t - began; if (first === null && v.pct > 0) first = v.pct / DMG_1V1; }); return { at, most, pct: first }; };
    const small = stone(false), big = stone(true);
    check('Hod: Boulder Roll is a 7% stone on a tap and an 11% stone held', near(small.pct, fr(7), 0.3) && near(big.pct, fr(11), 0.3) && small.at === 21 && big.at === 35, 'tap: ' + r1(small.pct) + '% released on frame ' + small.at + '; held: ' + r1(big.pct) + '% on frame ' + big.at);
    check('Hod: one stone at a time', small.most === 1, 'most stones alive at once from two taps: ' + small.most);
    const step = cast(HOD, spc(0, 1), 60, 90);
    check('Hod: Stone Step climbs about 1.65 H', near(step.rise, 23.1, 2.5), 'rose ' + r1(step.rise) + ' (23.1)');

    /* Wren's swap */
    const swap = (hitAt) => { const [f, v] = setup(NIB, FL, 0, 40); let changed = null, freeOn = null, second = null;
      SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= 40 && tt < 42) || (tt >= 70 && tt < 72)) { i.ly = -1; i.spc = true; } };
      run(110, () => { if (hitAt && t === hitAt) applyHit(v, f, { d: 5, a: 45, b: 30, k: 40, id: 'test' }, -1, v.x, true); if (changed === null && f.fi !== 0) changed = f.mf; if (changed !== null && freeOn === null && f.state !== 'attack') freeOn = t; if (t === 60) second = f.fi; });
      return { changed, freeOn, second, end: f.fi }; };
    const clean = swap(0), early = swap(10);
    check('Wren: the swap hands over on frame 16 and frees her on frame 33', clean.changed === 16 && clean.freeOn !== null && clean.freeOn <= 37, 'changed on move frame ' + clean.changed + ', free on frame ' + (clean.freeOn === null ? 'never' : clean.freeOn - 2));
    check('Wren: 60 frames must pass before the next swap', clean.second === 1 && clean.end === 2, 'pressed again 38 frames later: still companion ' + clean.second + '; after 68 frames: companion ' + clean.end);
    check('Wren: a hit before the handover keeps the old companion', early.changed === null || early.second === 0, 'hit on frame 8 of the swap: companion ' + early.second + ' is still in');
  }

  /* ---- Potato Sack ---- */
  {
    /* hops: with the stick held it moves in bursts and stands still between them */
    const hop = (script, n) => { const [f] = setup(SACK, FL, -55, 60); let moving = 0, still = 0, bursts = 0, was = false; SCRIPT[0] = script;
      run(n, () => { if (t < 30) return; const mv = Math.abs(f.vx) > 0.3; if (mv) moving++; else if (f.vx === 0) still++; if (mv && !was) bursts++; was = mv; }); return { moving, still, bursts, x: f.x + 55, state: f.state }; };
    const walk = hop((i, tt) => { i.lx = tt < 2 ? 0 : tt < 9 ? 0.4 : 0.9; }, 110), runs = hop((i, tt) => { i.lx = tt < 2 ? 0 : 1; }, 70);
    check('Potato Sack: walks and runs in hops with a stop between', walk.bursts >= 3 && walk.still >= 12 && runs.bursts >= 2 && runs.still >= 4 && runs.x > walk.x * 0.9, 'walking: ' + walk.bursts + ' hops, ' + walk.still + ' frames stopped of ' + (walk.moving + walk.still) + '; running: ' + runs.bursts + ' hops, ' + runs.still + ' stopped');
  }
  {
    /* tumble: slide on the ground, lift, dive, and cutting it short */
    const tum = (air, dirs, extra, n) => { const [f, o] = setup(SACK, FL, -40, 50); if (air) airborne(f, -40, air === true ? 40 : air); const x0 = f.x, y0 = f.y; let top = y0, seen = [], hurt = false, cut = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) { i.ly = -1; i.spc = true; } else if (tt >= 4 && tt < 12) { i.lx = dirs[0]; i.ly = dirs[1]; } if (extra) extra(i, tt, f); };
      run(n || 70, () => { top = Math.max(top, f.y); if (seen[seen.length - 1] !== f.state) seen.push(f.state); if (o.pct > 0) hurt = true; if (cut === null && f.state === 'attack' && f.mname !== 'dspec') cut = { move: f.mname, vx: +Math.abs(f.vx).toFixed(2), at: t }; });
      return { dx: f.x - x0, rise: top - y0, seen: seen.join('>'), hurt, cut, used: f.burstUsed, kind: f.burstKind }; };
    const slide = tum(false, [1, 0]), lift = tum(true, [0, 1]), dive = tum(true, [1, 0]), hang = tum(true, [0, 0]);
    check('Potato Sack: tumble slides along the floor without hurting', slide.kind === 'slide' && slide.dx > 28 && !slide.hurt, 'slid ' + slide.dx.toFixed(1) + ' units (' + slide.seen + ')');
    check('Potato Sack: tumble lifts straight up in the air', lift.kind === 'lift' && lift.rise > 26 && lift.rise < 34 && Math.abs(lift.dx) < 4, 'rose ' + lift.rise.toFixed(1) + ', drifted ' + lift.dx.toFixed(1));
    const low = tum(3, [1, 0]), lands = [dive, low, tum(12, [1, 0]), tum(25, [1, 0]), tum(8, [0, 1]), tum(6, [0, 0])];
    check('Potato Sack: a tumble dive that reaches the floor carries on as a slide', dive.kind === 'slide' && dive.dx > 30 && low.kind === 'slide' && low.dx > 20, 'from 40 up: went ' + dive.dx.toFixed(1) + ' (' + dive.seen + '); from 3 up: went ' + low.dx.toFixed(1) + ' (' + low.seen + ')');
    check('Potato Sack: a tumble never ends on its back, from any height', lands.every(q => !/down/.test(q.seen)), lands.map(q => q.seen).join(' / '));
    const quick = tum(false, [1, 0], (i, tt) => { if (tt >= 9 && tt < 11) i.atk = true; }), jumpOut = tum(false, [1, 0], (i, tt) => { if (tt >= 9 && tt < 11) i.jmp = true; }), shieldOut = tum(false, [1, 0], (i, tt) => { if (tt >= 9) i.shd = true; }, 24);
    check('Potato Sack: any action comes out the frame after the burst', quick.cut && quick.cut.at <= 12 && quick.cut.vx > 2 && /attack>jsq/.test(jumpOut.seen) && /attack>shield/.test(shieldOut.seen), (quick.cut ? quick.cut.move + ' on frame ' + quick.cut.at + ' moving at ' + quick.cut.vx : 'no attack') + '; jump: ' + jumpOut.seen + '; shield: ' + shieldOut.seen);
    const after = tum(12, [1, 0], (i, tt, f) => { if (f.grounded && f.burstKind === 'slide' && tt > 6) i.atk = true; }, 40);
    check('Potato Sack: can act the moment a dive touches down', after.cut && !/down|land/.test(after.seen), after.cut ? after.cut.move + ' on frame ' + after.cut.at + ' (' + after.seen + ')' : 'no attack came out (' + after.seen + ')');
    const turn = tum(false, [1, 0], (i, tt) => { if (tt >= 14) i.lx = -1; }, 30), keep = tum(false, [1, 0], (i, tt) => { if (tt >= 12) i.lx = 1; }, 30);
    check('Potato Sack: a push the other way ends a slide, holding the same way does not', turn.dx < keep.dx - 8 && turn.kind === 'slide', 'turned back after ' + turn.dx.toFixed(1) + ' units, kept going for ' + keep.dx.toFixed(1));
    check('Potato Sack: tumble with no direction hangs in the air', hang.kind === 'stall' && hang.rise < 1, 'kind ' + hang.kind + ', rose ' + hang.rise.toFixed(1));
    const cut = tum(false, [1, 0], (i, tt) => { if (tt >= 19 && tt < 21) i.atk = true; });
    check('Potato Sack: a slide can be cut short into an attack, keeping speed', cut.cut && cut.cut.at < 30 && cut.cut.vx > 1, cut.cut ? cut.cut.move + ' on frame ' + cut.cut.at + ' still moving at ' + cut.cut.vx : 'no attack came out');
    const twice = tum(true, [0, 1], (i, tt) => { if (tt >= 40 && tt < 42) { i.ly = -1; i.spc = true; } else if (tt >= 42 && tt < 50) i.ly = 1; }, 60);
    check('Potato Sack: one tumble per time off the ground', twice.rise < 34 && !/attack>air>attack/.test(twice.seen), 'rose ' + twice.rise.toFixed(1) + ' in all (' + twice.seen + ')');
  }
  {
    /* no ledge: where Flint catches the ledge, the sack falls past it */
    const drop = A => { const [f] = setup(A, FL, 0, -40); airborne(f, EDGE + f.st.w / 2 + 3, -4); f.vy = -0.5; let ledge = false; run(40, () => { if (f.state === 'ledge') ledge = true; }); return { ledge, y: f.y }; };
    const fl = drop(FL), sk = drop(SACK);
    check('Potato Sack: cannot hold the ledge', fl.ledge && !sk.ledge && sk.y < -20, 'Flint caught it: ' + fl.ledge + '; the sack fell to ' + sk.y.toFixed(0));
  }
  {
    /* Bag It: a leaping grab that takes a shielding fighter and flings them; it catches in the air too */
    const bag = (shield, air) => { const [f, v] = setup(SACK, FL, 0, 26); if (air) { airborne(f, 0, 30); airborne(v, 26, 30); v.vy = 0; } let flung = false, held = false;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) { i.lx = 1; i.spc = true; } }; SCRIPT[1] = i => { if (shield) i.shd = true; };
      run(70, () => { if (air && v.state === 'air' && !held) { v.y = 30; v.vy = 0; } if (v.state === 'held') held = true; if (v.state === 'hurt' && v.hitstun > 10) flung = true; }); return { held, flung, pct: v.pct }; };
    const ground = bag(true, false), air = bag(false, true);
    check('Potato Sack: Bag It grabs through a shield and flings', ground.held && ground.flung && ground.pct > 8, 'caught: ' + ground.held + ', flung: ' + ground.flung + ', ' + ground.pct.toFixed(1) + '% dealt');
    check('Potato Sack: Bag It catches in the air', air.held && air.flung, 'caught: ' + air.held + ', flung: ' + air.flung);
  }
  {
    /* Hot Potato: the blast throws the sack upward, costs it damage, flies further the more hurt it is, and hits a neighbour */
    const pop = (pct, lx, near) => { const [f, o] = setup(SACK, FL, 0, near ? 7 : 55); f.pct = pct; const y0 = f.y, p0 = f.pct; let top = y0, launched = false, right = 0;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) { i.ly = 1; i.spc = true; } else if (tt >= 4 && tt < 30) i.lx = lx; };
      run(150, () => { top = Math.max(top, f.y); if (f.state === 'hurt' && f.vy > 0) launched = true; if (f.y > 20) right = Math.max(right, f.x); }); return { rise: top - y0, cost: f.pct - p0, launched, right, opp: o.pct, used: f.blastUsed }; };
    const fresh = pop(0, 0, false), worn = pop(100, 0, false), steer = pop(0, 1, false), close = pop(0, 0, true);
    check('Potato Sack: Hot Potato launches it and costs damage', fresh.launched && fresh.cost === 12 && fresh.rise > 28 && fresh.rise < 60, 'rose ' + fresh.rise.toFixed(1) + ' for ' + fresh.cost + '%');
    check('Potato Sack: the more hurt, the further the blast throws it', worn.rise > fresh.rise * 1.6, 'at 0%: ' + fresh.rise.toFixed(1) + ', at 100%: ' + worn.rise.toFixed(1));
    check('Potato Sack: the blast is steered with the stick and hurts a neighbour', steer.right > 8 && close.opp > 10, 'held right: carried ' + steer.right.toFixed(1) + ' sideways; a neighbour took ' + close.opp.toFixed(1) + '%');
    const again = (() => { const [f] = setup(SACK, FL, 0, 55); airborne(f, 0, 110); let blasts = 0, last = f.pct, landed = false; SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= 70 && tt < 72)) { i.ly = 1; i.spc = true; } }; run(90, () => { if (f.pct > last) { blasts++; last = f.pct; } if (f.grounded) landed = true; }); return landed ? -1 : blasts; })();   /* started high enough that both presses come before it lands */
    check('Potato Sack: one Hot Potato per time off the ground', again === 1, again + ' blast(s) from two presses in the air');
    /* Spud Bomb: tapped it is small; held it grows without limit, and hits harder */
    const bomb = (hold, d, pct) => { const [s, o] = setup(SACK, FL, 0, d); o.ctl = new Ctl('none'); o.pct = pct; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 2 + hold) i.spc = true; }; run(hold + 240, () => o.stocks === 3); return { dead: o.stocks < 3, pct: o.pct }; };
    const tapNear = bomb(1, 6, 0), tapFar = bomb(1, 22, 0), bigFar = bomb(240, 22, 0), tapKO = bomb(1, 6, 150), heldKO = bomb(90, 6, 50);
    check('Potato Sack: Spud Bomb grows the longer it is held', tapNear.pct > 8 && tapFar.pct === 0 && bigFar.pct > tapNear.pct * 3, 'tapped: ' + tapNear.pct.toFixed(1) + '% up close, nothing at 22 away; held 4 seconds: ' + (bigFar.dead ? 'a KO' : bigFar.pct.toFixed(1) + '%') + ' at 22 away');
    check('Potato Sack: Spud Bomb is a kill move', tapKO.dead && heldKO.dead, 'tapped at 150%: ' + (tapKO.dead ? 'KO' : 'survives') + '; held 1.5 s at 50%: ' + (heldKO.dead ? 'KO' : 'survives'));
    /* two neutral airs in one short hop */
    { const [s] = setup(SACK, FL, -40, 60); let nairs = 0, last = ''; SCRIPT[0] = (i, tt) => { if (tt === 2 || tt === 3) i.jmp = true; if (tt === 6 || tt === 7 || tt === 22 || tt === 23) i.atk = true; }; run(60, () => { const tag = s.state === 'attack' ? s.mname + s.mf : ''; if (s.state === 'attack' && s.mname === 'nair' && s.mf === 1) nairs++; });
      check('Potato Sack: two neutral airs fit in one short hop', nairs === 2, nairs + ' neutral airs before landing'); }
    /* up special bursts on frame 5 */
    { const [s] = setup(SACK, FL, 0, 60); let at = -1; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = 1; i.spc = true; } }; run(20, () => { if (at < 0 && PROJ.some(p => p.kind === 'blast')) at = s.mf; });
      check('Potato Sack: Hot Potato bursts on frame 5', at === 5, 'burst on frame ' + at); }
    /* tumble with down held goes through a soft platform; without it he lands as before */
    { const thru = down => { const [s] = setup(SACK, FL, 0, 60); airborne(s, -42, 36); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } else if (tt >= 4 && tt < 9) { i.lx = 1; } if (down && tt >= 9) i.ly = -1; }; let onPlat = false; run(60, () => { if (s.plat && s.plat.soft) onPlat = true; }); return onPlat; };
      const held = thru(true), plain = thru(false);
      check('Potato Sack: a tumble with down held passes through a platform', !held && plain, 'with down held: ' + (held ? 'touched the platform' : 'went straight through') + '; without: ' + (plain ? 'landed on it and slid' : 'went through')); }
  }

  /* ---- Sprocket: the handyman from the owner's moveset document ---- */
  {
    const SP = ROSTER[3].forms[0], mvs = SP.moves, fl = ROSTER[0].forms[0].st, st = SP.st, near = (a, b, tol) => Math.abs(a - b) <= (tol || 0.011);
    check('Sprocket: frames and damage are the document\u2019s', mvs.jab.h[0].f0 === 5 && mvs.ftilt.h[0].f0 === 8 && mvs.ftilt.h[0].d === 10 && mvs.ftilt.h.some(h => h.part === 'near' && h.d === 7) && mvs.fsmash.h[0].f0 === 21 && mvs.fsmash.h[0].d === 20 && mvs.usmash.h[0].d === 17 && mvs.grab.h[0].f0 === 7 && mvs.throws.b.d === 11 && st.pummel === 1.5,
      'jab f' + mvs.jab.h[0].f0 + ', forward tilt f' + mvs.ftilt.h[0].f0 + ' ' + mvs.ftilt.h[0].d + '% (handle ' + (mvs.ftilt.h.find(h => h.part === 'near') || {}).d + '%), forward smash f' + mvs.fsmash.h[0].f0 + ' ' + mvs.fsmash.h[0].d + '%, grab f' + mvs.grab.h[0].f0);
    check('Sprocket: weight and movement against Flint', near(st.weight / fl.weight, 1.12) && near(st.run / fl.run, 0.88) && near(st.airSpeed / fl.airSpeed, 0.82) && near(st.grav / fl.grav, 1.1),
      'weight ' + (st.weight / fl.weight * 100).toFixed(0) + ', ground speed ' + (st.run / fl.run * 100).toFixed(0) + ', air drift ' + (st.airSpeed / fl.airSpeed * 100).toFixed(0) + ', gravity ' + (st.grav / fl.grav * 100).toFixed(0) + ' (targets 112, 88, 82, 110)');
    /* Tape Roll */
    { const [s] = setup(SPR, FL, -40, 60); let born = -1, x0 = 0, out = 0, last = 0, most = 0;
      SCRIPT[0] = (i, tt) => { if (tap(2)(tt) || tap(125)(tt)) i.spc = true; };
      run(124, () => { const tp = PROJ.filter(q => q.kind === 'tape'); most = Math.max(most, tp.length); if (tp[0]) { if (born < 0) { born = t; x0 = tp[0].x; } out = Math.max(out, tp[0].x - x0); last = tp[0].x - x0; } });
      const gone = !PROJ.some(q => q.kind === 'tape'); run(60, () => { most = Math.max(most, PROJ.filter(q => q.kind === 'tape').length); });
      check('Sprocket: the tape rolls out, curls back and ends where it was let go', born >= 17 && born <= 20 && out > 22 && Math.abs(last) < 6 && gone, 'thrown on frame ' + (born - 2) + ', ran out ' + out.toFixed(1) + ', last seen ' + last.toFixed(1) + ' from the start, gone: ' + gone);
      check('Sprocket: one tape at a time', most === 1, most + ' at once after two throws');
      const [s2, o2] = setup(SPR, FL, 0, 24); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) i.spc = true; }; run(80);
      check('Sprocket: the tape hits for 6% and breaks', o2.pct > 6.5 && o2.pct < 8.5 && !PROJ.some(q => q.kind === 'tape'), 'target at ' + o2.pct.toFixed(1) + '% (6% before the one-on-one bonus)'); }
    /* Hook Wrench */
    { const hook = (x, y) => { const [s, o2] = setup(SPR, FL, 0, x); if (y) airborne(o2, x, y); let vx = null; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } };
        run(40, () => { if (vx === null && o2.pct > 0) vx = o2.vx; }); return { pct: o2.pct, vx }; };
      const head = hook(15.5, 24), handle = hook(6.5, 0);
      check('Sprocket: the wrench head hooks for 9% and tugs inward', head.pct > 10 && head.pct < 12.5 && head.vx < 0, 'target above and ahead: ' + head.pct.toFixed(1) + '%, sent ' + (head.vx < 0 ? 'toward him' : 'away'));
      check('Sprocket: the handle hits for 7% and pushes outward', handle.pct > 7.8 && handle.pct < 9.8 && handle.vx > 0, 'target close in: ' + handle.pct.toFixed(1) + '%, sent ' + (handle.vx > 0 ? 'away' : 'toward him')); }
    /* Ratchet Spin */
    { const spin = lx => { const [s] = setup(SPR, FL, 0, 60); airborne(s, 0, 30); const y0 = s.y; let top = y0; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = 1; i.spc = true; } else if (tt >= 4 && tt < 16) i.lx = lx; };
        run(70, () => { top = Math.max(top, s.y); }); return { rise: top - y0, dx: s.x, helpless: s.state === 'helpless' || s.grounded }; };
      const up = spin(0), diag = spin(1), flintUp = ROSTER[0].forms[0].st.upH;
      check('Sprocket: Ratchet Spin goes straight up or on a diagonal', up.rise > 20 && up.rise < flintUp && Math.abs(up.dx) < 3 && diag.dx > 30 && diag.rise < up.rise && up.helpless,
        'straight: rose ' + up.rise.toFixed(1) + ' (Flint\u2019s Updraft ' + flintUp + '), drifted ' + up.dx.toFixed(1) + '; diagonal: rose ' + diag.rise.toFixed(1) + ', carried ' + diag.dx.toFixed(1)); }
    /* Bench Vise */
    { const vise = (their, air) => { const [s, o2] = setup(SPR, FL, 0, 11); if (air) { airborne(s, 0, 30); airborne(o2, 10, 30); } let held = false, behind = false; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } }; SCRIPT[1] = their;
        run(110, () => { if (o2.state === 'held') held = true; if (held && o2.x < s.x - 4) behind = true; }); return { held, behind, pct: o2.pct }; };
      const shield = vise((i, tt) => { i.shd = true; }), jump = vise((i, tt) => { if (tt >= 12 && tt < 16) i.jmp = true; }), air = vise(null, true), m = mvs.dspec;
      check('Sprocket: the vise takes a shielding opponent and throws them behind for 12%', shield.held && shield.behind && shield.pct > 13.5 && shield.pct < 16, 'caught: ' + shield.held + ', thrown behind: ' + shield.behind + ', ' + shield.pct.toFixed(1) + '% (12% before the one-on-one bonus)');
      check('Sprocket: a jump beats the vise, and it catches nothing in the air', !jump.held && jump.pct === 0 && !air.held, 'jumped: caught ' + jump.held + '; both in the air: caught ' + air.held);
      check('Sprocket: a missed vise leaves 30 frames', m.t - m.h[0].f1 === 30 && m.h[0].f0 === 18 && m.h[0].f1 === 19, 'active ' + m.h[0].f0 + ' to ' + m.h[0].f1 + ', ' + (m.t - m.h[0].f1) + ' frames after'); }
  }

  /* ---- Scuttle: the coal crab (numbers from the owner's document for fighter 01) ---- */
  {
    const SC = ROSTER[4].forms[0], mvs = SC.moves, fl = ROSTER[0].forms[0].st, st = SC.st, near = (a, b, tol) => Math.abs(a - b) <= (tol || 0.012);
    check('Scuttle: frames and damage are the document\u2019s', mvs.jab.h[0].f0 === 3 && mvs.ftilt.h[0].f0 === 6 && mvs.ftilt.h[0].d === 7 && mvs.fsmash.h[0].f0 === 16 && mvs.fsmash.h[0].d === 17 && mvs.usmash.h[0].d === 13 && mvs.bair.h[0].d === 12 && mvs.grab.h[0].f0 === 6 && mvs.throws.b.d === 10,
      'jab f' + mvs.jab.h[0].f0 + ', forward tilt f' + mvs.ftilt.h[0].f0 + ' ' + mvs.ftilt.h[0].d + '%, forward smash f' + mvs.fsmash.h[0].f0 + ' ' + mvs.fsmash.h[0].d + '%, up smash ' + mvs.usmash.h[0].d + '%, grab f' + mvs.grab.h[0].f0);
    check('Scuttle: weight and movement against Flint', near(st.weight / fl.weight, 0.82) && near(st.run / fl.run, 1.16) && near(st.dash / fl.dash, 1.27) && near(st.airSpeed / fl.airSpeed, 1.1) && near(st.grav / fl.grav, 1.07) && st.h < fl.h * 0.8,
      'weight ' + (st.weight / fl.weight * 100).toFixed(0) + ', run ' + (st.run / fl.run * 100).toFixed(0) + ', dash ' + (st.dash / fl.dash * 100).toFixed(0) + ', air drift ' + (st.airSpeed / fl.airSpeed * 100).toFixed(0) + ', gravity ' + (st.grav / fl.grav * 100).toFixed(0) + ', height ' + (st.h / fl.h).toFixed(2) + ' H');
    /* Tongs Snatch */
    { const snatch = (their, air) => { const [s, o2] = setup(SCU, FL, 0, 10); if (air) { airborne(s, 0, 30); airborne(o2, 9, 31); } let held = false; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) i.spc = true; }; SCRIPT[1] = their; run(90, () => { if (o2.state === 'held') held = true; }); return { held, pct: o2.pct }; };
      const shield = snatch((i) => { i.shd = true; }), air = snatch(null, true);
      check('Scuttle: the tongs take a shielding opponent and fling them for 8%', shield.held && shield.pct > 9 && shield.pct < 11, 'caught: ' + shield.held + ', ' + shield.pct.toFixed(1) + '% (8% before the one-on-one bonus)');
      check('Scuttle: in the air the tongs swipe for 5% instead', !air.held && air.pct > 5.5 && air.pct < 7.2, 'caught: ' + air.held + ', ' + air.pct.toFixed(1) + '%'); }
    /* Scuttle Roll */
    { const roll = air => { const [s] = setup(SCU, FL, -40, 60); if (air) airborne(s, -40, 40); const x0 = s.x; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } }; let x24 = 0; run(27, () => { if (s.state === 'attack' && s.mf === 24) x24 = s.x - x0; }); return x24 || s.x - x0; };
      const g = roll(false), a = roll(true), H = fl.h;
      check('Scuttle: the roll covers about 1.65 H on the floor and 0.9 H in the air', near(g / H, 1.65, 0.12) && near(a / H, 0.9, 0.12), 'floor ' + (g / H).toFixed(2) + ' H, air ' + (a / H).toFixed(2) + ' H');
      const [s2, o2] = setup(SCU, FL, 0, 9); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } }; run(50);
      check('Scuttle: the roll hits once, 10% clean', o2.pct > 11.5 && o2.pct < 13.5, 'target at ' + o2.pct.toFixed(1) + '% (10% before the one-on-one bonus)'); }
    /* Steam Pop */
    { const [s] = setup(SCU, FL, 0, 60); airborne(s, 0, 30); let top = 30; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = 1; i.spc = true; } }; run(60, () => { top = Math.max(top, s.y); });
      check('Scuttle: Steam Pop lifts about 2.15 H', near((top - 30) / fl.h, 2.15, 0.15), 'rose ' + ((top - 30) / fl.h).toFixed(2) + ' H'); }
    /* Bucket Drop */
    { const [s, o2] = setup(SCU, FL, 0, 4); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } }; run(60);
      const ground = o2.pct;
      const dive = (targetY) => { const [s3, o3] = setup(SCU, FL, 0, targetY ? 0.5 : 10); airborne(s3, 0, 40); if (targetY) airborne(o3, 0.5, targetY); let maxDown = 0, vyHit = null, landed = -1; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } };
        run(80, () => { maxDown = Math.max(maxDown, -s3.vy); if (vyHit === null && o3.pct > 0) vyHit = o3.vy; if (landed < 0 && s3.grounded) landed = t; }); return { maxDown, pct: o3.pct, vyHit, lag: s3.state, again: s3.blastUsed }; };
      const d1 = dive(0), d2 = dive(22);
      check('Scuttle: Bucket Drop on the floor hits for 13%', ground > 14.5 && ground < 17, 'target at ' + ground.toFixed(1) + '%');
      check('Scuttle: the air dive falls at 1.4 times fast fall and thumps where it lands', near(d1.maxDown / st.ffall, 1.4, 0.03) && d1.pct > 11 && d1.pct < 13.5, 'fell at ' + (d1.maxDown / st.ffall).toFixed(2) + ' times fast fall; a target standing beside the landing took ' + d1.pct.toFixed(1) + '% (10% before the bonus)');
      check('Scuttle: the dive sends an airborne target straight down', d2.pct > 13 && d2.pct < 16.5 && d2.vyHit < -1, 'target in the air took ' + d2.pct.toFixed(1) + '%, sent ' + (d2.vyHit < 0 ? 'down' : 'up')); }
  }

  /* ---- Potato Sack's Hot Potato burst: sweet spot KOs around 70%, sour spot around 100 to 125%, from the victim's damage ---- */
  {
    const ko = (pct, d, sackPct) => { const [s, o2] = setup(SACK, FL, 0, d); o2.pct = pct; s.pct = sackPct || 0; s.startMove('uspec'); let hits = 0, was = o2.pct; run(320, () => { if (o2.pct > was) { hits++; was = o2.pct; } return o2.stocks === 3; }); return { dead: o2.stocks < 3, hits }; };
    const sw60 = ko(60, 1.5), sw80 = ko(80, 1.5), so90 = ko(90, 6 + 4 + 2), so125 = ko(125, 6 + 4 + 2), heavySack = ko(60, 1.5, 150);
    check('Potato Sack: the hot middle of the burst KOs Flint at about 70%', !sw60.dead && sw80.dead && sw60.hits === 1, 'at 60%: ' + (sw60.dead ? 'KO' : 'survives') + ', at 80%: ' + (sw80.dead ? 'KO' : 'survives') + ', ' + sw60.hits + ' hit');
    check('Potato Sack: the edge of the burst KOs Flint at about 100 to 125%', !so90.dead && so125.dead, 'at 90%: ' + (so90.dead ? 'KO' : 'survives') + ', at 125%: ' + (so125.dead ? 'KO' : 'survives'));
    check('Potato Sack: the burst scales with the target’s damage, not the sack’s', !heavySack.dead, 'Flint at 60% with the sack at 150%: ' + (heavySack.dead ? 'KO' : 'survives'));
  }

  /* ---- Furious Fowls: five birds and a slingshot (the owner's overhaul v3 and special-moves bible) ---- */
  {
    const FM = ROSTER[5].forms, BIRD = n => [5, n], bird = (f, n) => { f.fi = n; };
    /* normals are the overhaul's tables */
    const nm = (n, k) => FM[n].moves[k].h[0], ok1 = nm(0, 'ftilt').f0 === 8 && nm(0, 'ftilt').d === 8 && nm(1, 'fsmash').f0 === 15 && nm(1, 'fsmash').d === 14 && nm(2, 'fsmash').f0 === 24 && nm(2, 'fsmash').d === 21 && nm(3, 'dtilt').f0 === 6 && nm(3, 'dtilt').d === 6 && nm(4, 'fair').f0 === 8 && nm(4, 'fair').d === 8;
    const ok2 = FM[2].moves.bair.ll === 17 && FM[1].moves.uair.ll === 8 && FM[0].moves.jab3.h[0].d === 4 && FM[2].moves.jab3.h[0].f0 === 11 && FM[2].moves.throws.b.d === 12 && FM[1].moves.grab.h[0].f0 === 7;
    check('Furious Fowls: each bird’s slingshot normals are the overhaul’s', ok1 && ok2, 'Flint forward tilt f' + nm(0, 'ftilt').f0 + ' ' + nm(0, 'ftilt').d + '%, Bolt forward smash f' + nm(1, 'fsmash').f0 + ' ' + nm(1, 'fsmash').d + '%, Cinder forward smash f' + nm(2, 'fsmash').f0 + ' ' + nm(2, 'fsmash').d + '%, Cinder back air landing ' + FM[2].moves.bair.ll + ', Bolt grab f' + FM[1].moves.grab.h[0].f0);
    check('Furious Fowls: the bird is called Flint on screen', FM[0].label === 'Flint' && FM[5].label === 'Flint alone', FM[0].label + ' / ' + FM[5].label);
    /* Neutral B: the selector, never a shot */
    { const [f] = setup(FOW, FL, 0, 60); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) i.spc = true; }; let shots = 0; run(30, () => { shots = Math.max(shots, PROJ.length); }); const tapped = f.form.label;
      const [g] = setup(FOW, FL, 0, 60); let open = false; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 30) { i.spc = true; if (tt > 12) { i.lx = -0.6; i.ly = -0.8; } } }; run(50, () => { if (g.selOpen) open = true; });
      check('Furious Fowls: neutral special taps to the next bird, or opens a wheel to point at one', tapped === 'Bolt' && open && g.form.label === 'Pip' && shots === 0, 'tap: ' + tapped + '; held and pointed down-left: ' + g.form.label + ' (wheel opened: ' + open + '); shots fired: ' + shots); }
    /* Side B: the living bird, no flight timer, the slingshot left behind */
    { const [f] = setup(FOW, FL, -40, 60); f.pct = 37; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } }; let flew = 0, left = null, endedBy = ''; run(150, () => { if (f.flying) flew++; if (f.sling && !left) left = f.sling.x; if (!endedBy && flew && !f.flying) endedBy = f.grounded ? 'landing' : f.state; });
      check('Furious Fowls: side special fires the bird, which flies until it lands', left !== null && Math.abs(left + 40) < 1 && f.fi === 5 && flew > 25 && endedBy === 'landing' && f.pct === 37, 'slingshot stayed at ' + (left === null ? '-' : left.toFixed(0)) + '; the bird flew ' + flew + ' frames and stopped by ' + endedBy + '; damage still ' + f.pct + '%');
      const [g] = setup(BIRD(1), FL, -40, 60); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } if (tt > 16 && tt < 20) { i.ly = 1; i.lx = 0; i.spc = true; } }; let turned = false; run(40, () => { if (g.flying && g.vy > 1.5 && Math.abs(g.vx) < 0.5) turned = true; });
      check('Furious Fowls: Bolt’s flight takes one sharp correction', turned && g.flyFix, 'turned straight up mid-flight: ' + turned); }
    /* back into the pouch only when close */
    { const [f] = setup(FOW, FL, -40, 60); f.sling = { x: -40, y: 0, face: 1, vy: 0, plat: MAIN, lost: 0 }; bird(f, 5); f.x = -15; let t0 = t; SCRIPT[0] = (i, tt) => { if (tap(t0 + 1)(tt)) { i.ly = -1; i.spc = true; } }; run(14); const far = f.fi;
      f.x = -28; f.set('idle'); t0 = t; SCRIPT[0] = (i, tt) => { if (tap(t0 + 1)(tt)) { i.ly = -1; i.spc = true; } }; run(14);
      check('Furious Fowls: down special alone hops back into the slingshot only when close', far === 5 && f.fi === 0 && !f.sling, '25 away: ' + (far === 5 ? 'stays out' : 'rejoined') + '; 12 away: ' + (f.sling ? 'stays out' : 'back in the pouch')); }
    /* Sling Spin: end-over-end, both ends hit, dragging hits then a finisher */
    { const spin = (n, dx, dy) => { const [f, o] = setup(BIRD(n), FL, 0, dx); airborne(f, 0, 30); airborne(o, dx, 30 + dy); o.ctl = new Ctl('none'); let hits = 0, was = 0, x0 = o.x; f.startMove('nair'); const oy = o.y; run(60, () => { f.vy = 0; f.y = 30; if (!hits) { o.y = oy; o.vy = 0; o.vx = 0; } if (o.pct > was + 0.01) { hits++; was = o.pct; } }); return { hits, pct: o.pct, moved: o.x - x0 }; };
      const fl = spin(0, 6, 0), bo = spin(1, 6, 0), ci = spin(2, 6, 0), under = spin(0, 0, -12), bar = SPIN.Rusty;
      check('Furious Fowls: Sling Spin lands its light hits and a finisher, per bird', fl.hits === 5 && bo.hits === 6 && ci.hits === 4, 'Flint ' + fl.hits + ' hits for ' + fl.pct.toFixed(1) + '%, Bolt ' + bo.hits + ' for ' + bo.pct.toFixed(1) + '%, Cinder ' + ci.hits + ' for ' + ci.pct.toFixed(1) + '% (4+1, 5+1, 3+1 expected)');
      check('Furious Fowls: the handle end of the spin hits too', under.hits >= 2, 'a target below the rig was hit ' + under.hits + ' times');
      const a0 = FM[0].moves.nair.spinAt(null, bar.s), a1 = FM[0].moves.nair.spinAt(null, bar.w0 + bar.n * bar.re + 1);
      check('Furious Fowls: the rig turns end over end, twice round for Flint', Math.abs(a1 - a0 - Math.PI * 4) < 0.01, 'turned ' + ((a1 - a0) / Math.PI / 2).toFixed(2) + ' times'); }
    /* Catapult Cyclone: charge tiers set the hit count and damage */
    { const cy = hold => { const [f, o] = setup(FOW, FL, 0, 0.5); airborne(o, 0.5, 12); o.ctl = new Ctl('none'); let hits = 0, was = 0, y0 = o.y; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 9 + hold) { i.ly = 1; i.spc = true; } else if (tt >= 9 + hold) i.ly = 1; }; run(220, () => { if (o.pct > was + 0.01) { hits++; was = o.pct; } if (hits < 2) { o.y = y0 + Math.max(0, f.y - 2); o.x = f.x + 0.5; o.vx = o.vy = 0; } }); return { hits, pct: o.pct }; };
      const tapC = cy(1), full = cy(60);
      check('Furious Fowls: Catapult Cyclone hits more and harder the longer it is charged', full.hits > tapC.hits && full.pct > tapC.pct * 2, 'tapped: ' + tapC.hits + ' hits, ' + tapC.pct.toFixed(1) + '%; full charge: ' + full.hits + ' hits, ' + full.pct.toFixed(1) + '%');
      const [f] = setup(FOW, FL, 0, 60); let stuck = 0; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 62) { i.ly = 1; i.spc = true; } }; run(240, () => { if (f.state === 'attack' && t > 150) stuck++; });
      check('Furious Fowls: a full Cyclone ends in an ordinary fall and stays under the ceiling', stuck === 0 && f.stocks === 3 && f.grounded, (stuck ? 'still in the move' : 'fell and landed') + ', stocks ' + f.stocks); }
    /* Down B: five different techniques */
    { const [f, o] = setup(FOW, FL, 0, 10); o.face = -1; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 30) { i.ly = -1; i.spc = true; } }; SCRIPT[1] = (i, tt) => { if (tap(9)(tt)) i.atk = true; }; let braced = false; run(40, () => { if (f.mname === 'dcounter') braced = true; });
      check('Furious Fowls: Flint’s Brace & Break answers a light frontal hit', braced && f.pct === 0 && o.pct > 10, 'countered: ' + braced + '; Flint took ' + f.pct.toFixed(1) + '%, the attacker ' + o.pct.toFixed(1) + '%'); }
    { const [f] = setup(BIRD(1), FL, -40, 60); const x0 = f.x; let low = false; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } }; run(40, () => { const r = hurtRect(f); if (r[3] - r[1] < f.st.h * 0.6) low = true; });
      check('Furious Fowls: Bolt’s Skitter Step is a low, quick skid', f.x - x0 > 20 && low, 'skidded ' + (f.x - x0).toFixed(0) + ' units, low: ' + low); }
    { const [f, o] = setup(BIRD(2), FL, 0, 9); o.face = -1; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } }; run(60);
      check('Furious Fowls: Cinder’s Anvil Drop shocks the floor beside him', o.pct > 5 && o.pct < 11, 'a neighbour 9 away took ' + o.pct.toFixed(1) + '%'); }
    { const [f, o] = setup(BIRD(3), FL, 0, 9); o.ctl = new Ctl('none'); let mates = 0; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = -1; i.spc = true; } }; run(60, () => { mates = Math.max(mates, PROJ.filter(p => p.kind === 'pipmate').length); });
      check('Furious Fowls: Pip’s Orbit Parade circles two doubles that hit at most twice each', mates === 2 && o.pct > 0 && o.pct <= 4 * 1.5 * DMG_1V1 + 0.1, mates + ' doubles; the target took ' + o.pct.toFixed(1) + '%'); }
    { const [f, o] = setup(BIRD(4), FL, 0, 40); o.ctl = new Ctl('none'); SCRIPT[0] = (i, tt) => { if (tap(2)(tt) || tap(40)(tt)) { i.ly = -1; i.spc = true; } }; let nests = 0; run(60, () => { nests = Math.max(nests, PROJ.filter(p => p.kind === 'nest').length); });
      const nest = PROJ.find(p => p.kind === 'nest'); o.x = nest ? nest.x + 6 : 40; SCRIPT[1] = (i) => { i.lx = -0.6; }; let lifted = false; run(60, () => { if (o.vy > 0.5 && o.pct > 0) lifted = true; });
      check('Furious Fowls: Pearl’s Nest Marker plants one nest that lifts whoever walks in', nests === 1 && lifted, nests + ' nest after two presses; the opponent walking in was lifted: ' + lifted); }
    /* bird-alone specials */
    { const vault = second => { const [f] = setup(FOW, FL, 0, 60); bird(f, 5); airborne(f, 0, 20); let top = 20; SCRIPT[0] = (i, tt) => { if (tap(2)(tt) || (second && tap(24)(tt))) { i.ly = 1; i.spc = true; } }; run(60, () => { top = Math.max(top, f.y); }); return top - 20; };
      const one = vault(false), two = vault(true);
      check('Furious Fowls: Flint alone gets a second hop only on a second press', two > one + 8, 'one press: rose ' + one.toFixed(0) + '; two presses: ' + two.toFixed(0)); }
    { const [f] = setup(FOW, FL, 0, 60); bird(f, 6); airborne(f, 0, 40); f.vx = 1.2; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.spc = true; i.lx = -1; } else if (tt < 12) i.lx = -1; }; run(14);
      check('Furious Fowls: Bolt alone brakes and bursts the other way', f.vx < -1, 'moving at ' + f.vx.toFixed(2) + ' after drifting forward at 1.2'); }
    { const cook = hold => { const [f, o] = setup(FOW, FL, 0, 6); bird(f, 7); o.ctl = new Ctl('none'); SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 2 + hold) i.spc = true; }; run(70); return o.pct; };
      const tp = cook(1), fu = cook(30);
      check('Furious Fowls: Cinder’s Pressure Cooker grows from 6% to 11% with the hold', tp > 6.5 && tp < 8 && fu > 12.5 && fu < 14, 'tapped ' + tp.toFixed(1) + '%, held ' + fu.toFixed(1) + '% (6 and 11 before the one-on-one bonus)'); }
    { const [f] = setup(FOW, FL, 0, 60); bird(f, 8); const x0 = f.x; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) i.spc = true; else if (tt >= 4 && tt < 14) i.lx = -1; }; let mates = 0; run(20, () => { mates = Math.max(mates, PROJ.filter(p => p.kind === 'pipmate').length); });
      check('Furious Fowls: Pip alone swaps places with a double', Math.abs(f.x - x0 + 14) < 1 && mates === 2, 'moved ' + (f.x - x0).toFixed(0) + ' units; ' + mates + ' doubles shown'); }
    { const fall = useIt => { const [f] = setup(FOW, FL, 0, 60); bird(f, 9); airborne(f, 0, 80); SCRIPT[0] = (i, tt) => { if (useIt && tt >= 2 && tt < 30) i.spc = true; }; run(30); return 80 - f.y; };
      const plain = fall(false), braked = fall(true);
      check('Furious Fowls: Pearl’s Feather Brake slows her fall', braked < plain * 0.6, 'fell ' + plain.toFixed(0) + ' normally, ' + braked.toFixed(0) + ' with the brake, in 30 frames'); }
    { const ups = [5, 6, 7, 8, 9].map(n => { const [f] = setup(FOW, FL, 0, 60); bird(f, n); airborne(f, 0, 10); let top = 10; SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.ly = 1; i.spc = true; } else i.ly = 1; }; run(80, () => { top = Math.max(top, f.y); }); return top - 10; });
      check('Furious Fowls: each bird’s own recovery; Pearl climbs highest', ups.every(u => u > 12) && ups[4] === Math.max(...ups), ['Flint', 'Bolt', 'Cinder', 'Pip', 'Pearl'].map((b, k) => b + ' ' + ups[k].toFixed(0)).join(', ')); }
    /* a lost stock puts the bird back in the pouch; the same inputs give the same game */
    { const [f] = setup(FOW, FL, 0, 60); SCRIPT[0] = (i, tt) => { if (tap(2)(tt)) { i.lx = 1; i.spc = true; } }; run(30); airborne(f, 400, 50); run(80, () => f.state !== 'respawn' && f.stocks === 3);
      check('Furious Fowls: losing a stock alone puts the bird back in the pouch', f.stocks === 2 && f.fi < 5 && !f.sling, 'stocks ' + f.stocks + ', form ' + f.form.label + ', slingshot ' + (f.sling ? 'still out' : 'gone')); }
    { const play = () => { const [f, o] = setup(FOW, FL, -20, 20); const S = [(i, tt) => { if (tt % 40 === 2) { i.lx = 1; i.spc = true; } if (tt % 40 === 20) { i.ly = -1; i.spc = true; } if (tt % 40 === 30) i.atk = true; }, (i, tt) => { if (tt % 25 === 5) i.atk = true; }]; SCRIPT[0] = S[0]; SCRIPT[1] = S[1]; run(400); return [f.x, f.y, f.pct, o.x, o.y, o.pct, PROJ.length].map(v => v.toFixed(4)).join(','); };
      const a = play(), b = play();
      check('Furious Fowls: the same inputs give the same game (ready for rollback)', a === b, a === b ? 'two runs of 400 frames ended identically' : a + '  vs  ' + b); }
  }

  /* ---- Training mode: endless stocks, no clock, and a true-combo counter ---- */
  {
    const was = TRAINING; TRAINING = true;
    const [f, o] = setup(FL, FL, 0, 9); o.ctl = new Ctl('none'); o.pct = 70; const tm = timer;   /* at 70% each jab still holds the target in hitstun for the next */ let most = 0; SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 40) i.atk = true; }; run(70, () => { most = Math.max(most, COMBO[0].hits); });
    const chain = COMBO[0].last; SCRIPT[0] = (i, tt) => { if (tap(120)(tt)) i.atk = true; }; run(80); const lone = COMBO[0].last;
    check('training: a jab string counts as one true combo, with its damage', chain && chain.hits >= 2 && Math.abs(chain.dmg - (o.pct - 70) + (lone ? lone.dmg : 0)) < 0.01 && most === chain.hits, chain ? chain.hits + ' hits for ' + chain.dmg.toFixed(1) + '%' : 'nothing counted');
    check('training: a hit after the target recovers starts a new combo', lone && lone.hits === 1 && COMBO[0].best.hits === chain.hits, lone ? 'next hit: ' + lone.hits + ' hit, best kept at ' + COMBO[0].best.hits : 'nothing counted');
    airborne(o, 400, 50); run(20); check('training: no clock, and stocks never run out', o.stocks === STOCKS && timer === tm, 'stocks ' + o.stocks + ' after a KO; clock ' + (timer === tm ? 'stopped' : 'running'));
    TRAINING = was;
  }

  /* ---- Combat audit (2026-11-10): strike shapes, sweeping, the ledge's open frames, the run turnaround ---- */
  {
    const [sp, o1] = setup(SPR, FL, 0, 7); sp.startMove('utilt'); run(30); const [sp2, o2] = setup(SPR, FL, 0, 30); sp2.startMove('utilt'); run(30);
    check('audit: an up tilt hits someone standing beside the attacker, and still misses out of reach', o1.pct > 0 && o2.pct === 0, 'beside: ' + o1.pct.toFixed(1) + '%, 30 away: ' + o2.pct.toFixed(1) + '%');
    const reach = name => { let far = 0; for (let d = 6; d <= 30; d++) { const [a, b] = setup(FL, FL, 0, d); a.startMove(name); run(30); if (b.pct > 0) far = d; } return far; };
    check('audit: covering the limb does not lengthen an attack', reach('ftilt') <= 16 && reach('fsmash') <= 19, 'Flint forward tilt reaches ' + reach('ftilt') + ', forward smash ' + reach('fsmash'));
    const [fa, fb] = setup(FL, FL, 0, 30); PROJ.push({ x: 20, y: 7, vx: 14, vy: 0, grav: 0, life: 5, owner: 0, face: 1, r: 1.5, ground: 'die', plat: null, kind: 'bolt', h: { d: 3, a: 45, b: 10, k: 10, id: 'test' } }); run(3);
    check('audit: a fast shot cannot pass through a body between frames', fb.pct > 0, 'a shot moving 14 a frame at a body 8 wide: ' + (fb.pct > 0 ? 'hit' : 'passed through'));
    const [g1] = setup(FL, FL, 0, -40); airborne(g1, EDGE + g1.st.w / 2 + 3, -6); g1.vy = -0.5; let open = 0, shut = 0; run(14, () => { if (g1.state === 'ledge') { if (g1.invuln === 0) open++; else shut++; } });
    check('audit: a ledge grab can be hit for its first two frames', open === 2 && shut > 5, open + ' open frames, then protected');
    const [r1] = setup(FL, FL, -50, 60); let back = -1; SCRIPT[0] = (i, tt) => { i.lx = tt < 2 ? 0 : tt < 50 ? 1 : tt === 50 ? 0 : -1; }; run(110, () => { if (back < 0 && t > 51 && r1.vx <= -r1.st.run * 0.9) back = t - 51; });
    check('audit: turning round out of a full run takes a skid', back >= 14 && back <= 30, back + ' frames to be running the other way');
  }

  const softPlats = PLATS.splice(1);   /* the movement checks run on the bare main stage, so no jump lands on a platform */
  /* ---- Movement model: jumps are given as heights; a full hop pops off the floor; fast fall is instant; speeds ramp ---- */
  for (const [name, A] of [['Flint', FL], ['Nib', NIB], ['Loom', LOOM], ['Hod', HOD]]) {
    const jump = script => { const [f] = setup(A, FL, -60, 60); const st = f.st, ys = []; SCRIPT[0] = (i, tt) => script(i, tt, f); run(160, () => { ys.push(f.y); }); const up = ys.findIndex(y => y > 0); return { st, top: Math.max(...ys), y4: ys[up + 3], air: ys.slice(up).findIndex(y => y === 0) }; };
    const full = jump((i, tt) => { i.jmp = tt >= 2; }), short = jump((i, tt) => { i.jmp = tt === 2 || tt === 3; }), st = full.st;
    const twice = jump((i, tt, f) => { i.jmp = (tt >= 2 && tt < 8) || (tt > 10 && tt < 70 && !f.grounded && f.vy <= 0 && f.jumps === (st.jumps || 1)); });
    const ff = jump((i, tt, f) => { i.jmp = tt >= 2; if (!f.grounded && f.vy <= 0) i.ly = -1; });
    const near = (v, w) => Math.abs(v - w) < 0.15;
    check(name + ': hop heights match the numbers', near(full.top, st.jumpH) && near(short.top, st.hopH) && near(twice.top, st.jumpH + st.airJumpH), 'full ' + full.top.toFixed(1) + ' (' + st.jumpH + '), short ' + short.top.toFixed(1) + ' (' + st.hopH + '), with air jump ' + twice.top.toFixed(1) + ' (' + (st.jumpH + st.airJumpH) + ')');
    check(name + ': a full hop pops off the floor', near(full.y4, st.jumpInit), full.y4.toFixed(1) + ' high after four frames (' + st.jumpInit + ')');
    check(name + ': fast fall drops at full speed at once', ff.air < full.air - 8, 'air time ' + full.air + ' frames, ' + ff.air + ' with a fast fall from the top');
    { /* dash burst, settle to run speed, slide to a stop; walking is slower and follows the stick */
      const [f] = setup(A, FL, -60, 60); let peak = 0, runV = 0, walkV = 0;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 50) i.lx = 1; };
      run(49, () => { if (t <= 12) peak = Math.max(peak, f.vx); }); runV = f.vx; run(40); const stopped = f.vx === 0 && f.state === 'idle';
      const [g] = setup(A, FL, -60, 60); SCRIPT[0] = (i, tt) => { i.lx = tt < 2 ? 0 : tt < 9 ? 0.4 : 0.6; }; run(70); walkV = g.vx;
      check(name + ': dash, run, walk and stop speeds', near(peak, st.dash) && near(runV, st.run) && near(walkV, st.walk * 0.6) && stopped, 'dash ' + peak.toFixed(2) + ' (' + st.dash + '), run ' + runV.toFixed(2) + ' (' + st.run + '), walk at 60% stick ' + walkV.toFixed(2) + ' (' + (st.walk * 0.6).toFixed(2) + '), stopped ' + stopped);
    }
  }
  { /* air: drift tops out at the fighter's air speed; a running jump carries ground speed, capped */
    const [f] = setup(FL, FL, -60, 60), st = f.st; let top = 0, atJump = null;
    SCRIPT[0] = (i, tt) => { if (tt >= 2) i.lx = 1; i.jmp = tt >= 30; };
    run(60, () => { if (!f.grounded) { if (atJump === null) atJump = f.vx; else if (t > 50) top = Math.max(top, f.vx); } });
    check('air: a running jump carries speed, then settles to air speed', Math.abs(atJump - st.jumpXMax) < 0.01 && Math.abs(top - st.airSpeed) < 0.12, 'left the ground at ' + atJump.toFixed(2) + ' (cap ' + st.jumpXMax + '), ' + top.toFixed(2) + ' later (air speed ' + st.airSpeed + ')');
  }

  PLATS.push(...softPlats);
  let bad = 0; for (const [ok, name, detail] of results) { if (!ok) bad++; console.log((ok ? 'pass  ' : 'FAIL  ') + name.padEnd(48) + detail); }
  console.log(bad ? bad + ' of ' + results.length + ' checks failed' : 'all ' + results.length + ' rule checks pass');
  if (bad) process.exitCode = 1;
})();
`);
