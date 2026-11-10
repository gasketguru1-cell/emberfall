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
  const FL = [0, 0], NIB = [1, 0], LOOM = [1, 1], HOD = [1, 2], SACK = [2, 0];
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

  /* ---- Armour: Hod's forward smash takes a weak hit without flinching, and a strong one breaks it ---- */
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); const win = hod.form.moves.fsmash.armor; let during = null;
    SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) smash(i, 1); };
    SCRIPT[1] = (i, tt) => { if (tap(win[0] - 2)(tt)) i.atk = true; };
    run(80, () => { if (hod.pct > 0 && during === null) during = hod.state + ':' + hod.mname + ' at move frame ' + hod.mf; });
    check('armour: weak hit is absorbed', hod.pct > 0 && during !== null && during.startsWith('attack:fsmash'), 'Hod took ' + hod.pct.toFixed(1) + '% while ' + during + ' (armour frames ' + win.join('-') + ')');
    check('armour: the smash still comes out and hits', fl.pct > 0, 'Flint took ' + fl.pct.toFixed(1) + '%');
  }
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); hod.pct = 200; let state = null;
    SCRIPT[0] = (i, tt) => { if (tap(4)(tt)) smash(i, 1); };
    SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) smash(i, -1); };
    run(60, () => { if (hod.pct > 200 && state === null) state = hod.state; });
    check('armour: a strong hit breaks through', state === 'hurt', 'Hod at 200% hit by a forward smash -> ' + state);
  }
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); let state = null;   /* outside the armour window the same weak hit interrupts */
    SCRIPT[0] = (i, tt) => { if (tap(3)(tt)) smash(i, 1); };
    SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) i.atk = true; };
    run(40, () => { if (hod.pct > 0 && state === null) state = hod.state + ' at move frame ' + hod.mf; });
    check('armour: no protection before the window', state !== null && state.startsWith('hurt'), 'jab landed first -> Hod ' + state);
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
    const [nib, fl] = setup(NIB, FL, -34, 0); SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.spc = true; }; run(60);
    check('projectile: it hits when nothing meets it', fl.pct > 0, 'Flint took ' + fl.pct.toFixed(1) + '%');
  }
  {
    let out = 0, hit = 0, tries = 0;
    for (let d = 10; d <= 44; d += 2) {
      const [hod, nib] = setup(HOD, NIB, -30, 0); let had = false, gone = false;
      SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.spc = true; };
      SCRIPT[1] = (i, tt) => { if (tap(d)(tt)) i.atk = true; };
      run(110, () => { if (PROJ.length) had = true; else if (had) gone = true; });
      tries++; if (nib.pct > 0) hit++; else if (gone) out++;
    }
    check('projectile: a jab cannot stop a boulder', hit > 0 && out === 0, hit + ' of ' + tries + ' timings were hit, ' + out + ' stopped it (jab ' + F[1].form.moves.jab.h[0].d + ' dmg against 12)');
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
    const grab = (airT, pct) => { const [f] = setup(FL, FL, 0, -40); airborne(f, EDGE + f.st.w / 2 + 3, -6); f.vy = -0.5; f.airT = airT; f.pct = pct; let inv = null; run(6, () => { if (f.state === 'ledge' && inv === null) { inv = f.invuln; return false; } }); return inv; };
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
    const [nib, b] = setup(NIB, FL, 0, 9); const seen = []; let loops = 0, last = -1;
    SCRIPT[0] = (i, tt) => { if (tt < 60) i.atk = true; };
    run(110, () => { if (nib.state === 'attack') { if (seen[seen.length - 1] !== nib.mname) seen.push(nib.mname); if (nib.mname === 'jabr' && nib.mf === 1) loops++; } });
    check('rapid jab: Nib keeps hitting while attack is held', seen.join('>') === 'jab>jabr>jab3' && loops >= 6 && b.pct > 8, seen.join(' > ') + ', ' + loops + ' flurry hits thrown, target at ' + b.pct.toFixed(1) + '%');
    const [nib2, b2] = setup(NIB, FL, 0, 9); const seen2 = []; let loops2 = 0;
    SCRIPT[0] = (i, tt) => { if (tt < 2 || (tt >= 8 && tt < 10)) i.atk = true; };
    run(80, () => { if (nib2.state === 'attack') { if (seen2[seen2.length - 1] !== nib2.mname) seen2.push(nib2.mname); if (nib2.mname === 'jabr' && nib2.mf === 1) loops2++; } });
    check('rapid jab: two taps give the shortest flurry and the finisher', seen2.join('>') === 'jab>jabr>jab3' && loops2 === 3, seen2.join(' > ') + ', ' + loops2 + ' flurry hits');
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
  for (const [name, A, len] of [['Flint', FL, 56], ['Wren (Nib)', NIB, 34]]) {
    const [f] = setup(A, FL, 0, 50); airborne(f, 0, 60); f.vy = -1; const fi0 = f.fi; let y0 = null, drop1 = 0, frames1 = 0, drop2 = 0, second = false, n = 0;
    SCRIPT[0] = (i, tt) => { if ((tt >= 2 && tt < 4) || (tt >= len + 12 && tt < len + 14)) { i.ly = -1; i.spc = true; } };
    run(len + 30, () => { n++; if (f.state === 'attack' && f.mname === 'dspec') { if (n < len + 8) { if (y0 === null) y0 = f.y; drop1 = Math.max(drop1, y0 - f.y); frames1++; } else { if (!second) { second = true; y0 = f.y; } drop2 = Math.max(drop2, y0 - f.y); } } });
    check(name + ': down special hangs in the air, once', frames1 >= len - 2 && drop1 < 0.01 && second && drop2 > 5 && (A === FL || f.fi !== fi0), 'first use: ' + frames1 + ' frames, fell ' + drop1.toFixed(1) + '; second use before landing: fell ' + drop2.toFixed(1));
  }

  /* ---- Under the island: nothing to hit a head on. An up special from anywhere beneath it slides out and takes the ledge ---- */
  {
    const res = [];
    for (const [name, A] of [['Flint', FL], ['Nib', NIB], ['Loom', LOOM], ['Hod', HOD]]) for (const x of [6, 30, 55, -42]) {
      const [f] = setup(A, FL, 0, 0); F[1].x = -10; airborne(f, x, -58); f.jumps = 0; let stuck = 0, end = null, lastY = f.y;
      SCRIPT[0] = (i, tt) => { if (tt >= 1 && tt < 3) { i.ly = 1; i.spc = true; } };
      run(260, () => { if (f.vy > 0.5 && f.y <= lastY + 0.01) stuck++; lastY = f.y; if (end === null && (f.state === 'ledge' || f.grounded)) end = f.state === 'ledge' ? 'ledge' : 'stage'; if (f.state === 'dead' && end === null) end = 'lost'; });
      res.push({ name, x, end, stuck });
    }
    const failed = res.filter(r => r.end !== 'ledge' && r.end !== 'stage'), blocked = res.filter(r => r.stuck > 0);
    check('island: an up special from underneath always gets out', failed.length === 0, failed.length ? failed.map(r => r.name + ' from x ' + r.x + ' -> ' + r.end).join(', ') : res.length + ' starts beneath the island, all reached the ledge or the stage');
    check('island: rising under it is never stopped', blocked.length === 0, blocked.length ? blocked.map(r => r.name + ' from x ' + r.x + ' held for ' + r.stuck + ' frames').join(', ') : 'no frame with upward speed and no upward movement');
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
    const tum = (air, dirs, extra, n) => { const [f, o] = setup(SACK, FL, -40, 50); if (air) airborne(f, -40, 40); const x0 = f.x, y0 = f.y; let top = y0, seen = [], hurt = false, cut = null;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) { i.ly = -1; i.spc = true; } else if (tt >= 4 && tt < 12) { i.lx = dirs[0]; i.ly = dirs[1]; } if (extra) extra(i, tt, f); };
      run(n || 70, () => { top = Math.max(top, f.y); if (seen[seen.length - 1] !== f.state) seen.push(f.state); if (o.pct > 0) hurt = true; if (cut === null && f.state === 'attack' && f.mname !== 'dspec') cut = { move: f.mname, vx: +Math.abs(f.vx).toFixed(2), at: t }; });
      return { dx: f.x - x0, rise: top - y0, seen: seen.join('>'), hurt, cut, used: f.burstUsed, kind: f.burstKind }; };
    const slide = tum(false, [1, 0]), lift = tum(true, [0, 1]), dive = tum(true, [1, 0]), hang = tum(true, [0, 0]);
    check('Potato Sack: tumble slides along the floor without hurting', slide.kind === 'slide' && slide.dx > 28 && !slide.hurt, 'slid ' + slide.dx.toFixed(1) + ' units (' + slide.seen + ')');
    check('Potato Sack: tumble lifts straight up in the air', lift.kind === 'lift' && lift.rise > 26 && lift.rise < 34 && Math.abs(lift.dx) < 4, 'rose ' + lift.rise.toFixed(1) + ', drifted ' + lift.dx.toFixed(1));
    check('Potato Sack: a tumble dive that lands early ends flat on its back', dive.kind === 'dive' && /attack>down/.test(dive.seen), dive.seen);
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
    const [nf] = setup(SACK, FL, 0, 55); SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 4) i.spc = true; }; let ember = false; run(40, () => { if (PROJ.some(q => q.kind === 'ember' && q.owner === 0)) ember = true; });
    check('Potato Sack: neutral special is Flint\u2019s ember toss', ember && ROSTER[2].forms[0].moves.nspec === ROSTER[0].forms[0].moves.nspec, 'ember thrown: ' + ember);
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
