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
  const FL = [0, 0], NIB = [1, 0], LOOM = [1, 1], HOD = [1, 2];
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

  /* ---- Armour: Hod's forward smash takes a weak hit without flinching, and a strong one breaks it ---- */
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); const win = hod.form.moves.fsmash.armor; let during = null;
    SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.cx = 1; };
    SCRIPT[1] = (i, tt) => { if (tap(win[0] - 2)(tt)) i.atk = true; };
    run(80, () => { if (hod.pct > 0 && during === null) during = hod.state + ':' + hod.mname + ' at move frame ' + hod.mf; });
    check('armour: weak hit is absorbed', hod.pct > 0 && during !== null && during.startsWith('attack:fsmash'), 'Hod took ' + hod.pct.toFixed(1) + '% while ' + during + ' (armour frames ' + win.join('-') + ')');
    check('armour: the smash still comes out and hits', fl.pct > 0, 'Flint took ' + fl.pct.toFixed(1) + '%');
  }
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); hod.pct = 200; let state = null;
    SCRIPT[0] = (i, tt) => { if (tap(4)(tt)) i.cx = 1; };
    SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) i.cx = -1; };
    run(60, () => { if (hod.pct > 200 && state === null) state = hod.state; });
    check('armour: a strong hit breaks through', state === 'hurt', 'Hod at 200% hit by a forward smash -> ' + state);
  }
  {
    const [hod, fl] = setup(HOD, FL, 0, 14); let state = null;   /* outside the armour window the same weak hit interrupts */
    SCRIPT[0] = (i, tt) => { if (tap(3)(tt)) i.cx = 1; };
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
      SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.cx = 1; };
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
      const [fl, nib] = setup(FL, NIB, -40, 0); airborne(nib, 100, -12); nib.launch(110, Math.PI, 1); let seen = null;
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
      const [a, b] = setup(P, FL, -40, 0); airborne(a, 80 + a.st.w / 2 + 0.3, -26); let best = -9, touched = false;
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
    SCRIPT[0] = (i, tt) => { if (tap(0)(tt)) i.cx = 1; }; SCRIPT[1] = (i, tt) => { if (tap(0)(tt)) i.cx = -1; };
    run(50, () => { if (a.state === 'rebound' && b.state === 'rebound') both = true; });
    check('clank: equal smashes cancel, nobody is hurt', both && a.pct === 0 && b.pct === 0, 'both recoiled: ' + both + ', damage ' + a.pct + ' / ' + b.pct);
  }

  /* ---- Ledge protection: more after a long time in the air, less when damaged ---- */
  {
    const grab = (airT, pct) => { const [f] = setup(FL, FL, 0, -40); airborne(f, 80 + f.st.w / 2 + 3, -6); f.vy = -0.5; f.airT = airT; f.pct = pct; let inv = null; run(6, () => { if (f.state === 'ledge' && inv === null) { inv = f.invuln; return false; } }); return inv; };
    const short = grab(20, 0), long = grab(300, 0), worn = grab(20, 120);
    check('ledge: protection grows with air time, shrinks with damage', short !== null && long > short + 15 && worn < short - 10 && worn >= 7, 'frames protected: short hop ' + short + ', long fall ' + long + ', at 120% ' + worn);
  }
  /* ---- Ledge get-ups are slower above 100% ---- */
  {
    const climb = (pct, how) => { const [f] = setup(FL, FL, 0, -40); f.x = 80 + f.st.w / 2 + 0.5; f.y = -f.st.h + 1; f.grounded = false; f.plat = null; f.pct = pct; f.set('ledge'); let n = 0, done = null, hitAt = null;
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
  /* ---- Tap jump: only when switched on; held is a full hop, flicked is a short hop ---- */
  {
    const hop = (on, hold) => { const [f] = setup(FL, FL, 0, 60); TAPJUMP.cpu = on; let top = 0;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < (hold ? 30 : 4)) i.ly = 1; };
      run(60, () => { top = Math.max(top, f.y); }); TAPJUMP.cpu = false; return top; };
    const off = hop(false, true), full = hop(true, true), short = hop(true, false);
    check('tap jump: off by default, on jumps', off === 0 && full > 30 && short > 8 && short < full - 10, 'height reached: off ' + off.toFixed(1) + ', held ' + full.toFixed(1) + ', flicked ' + short.toFixed(1));
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
    const onPlat = (script, solid) => { const [f] = setup(FL, FL, 0, 60); if (!solid) { f.y = 24; f.plat = PLATS[1]; } let low = f.y; const seen = [];
      SCRIPT[0] = script; run(50, () => { low = Math.min(low, f.y); if (seen[seen.length - 1] !== f.state) seen.push(f.state); }); return { y: Math.round(f.y), states: seen.join('>') }; };
    const flick = onPlat((i, tt) => { if (tt >= 4 && tt < 7) i.ly = -1; }), slow = onPlat((i, tt) => { if (tt >= 4) i.ly = -0.5; });
    check('platform: a down flick drops through, a slow tilt crouches', flick.y === 0 && slow.y === 24, 'flick ends at height ' + flick.y + ' (' + flick.states + '), slow tilt stays at ' + slow.y);
    const sd = onPlat((i, tt) => { if (tt < 14) i.shd = true; if (tt >= 10 && tt < 13) i.ly = -1; }), sm = onPlat((i, tt) => { if (tt < 14) i.shd = true; if (tt >= 10 && tt < 13) i.ly = -1; }, true);
    check('shield drop: down in shield drops through a platform, spot-dodges on the stage', sd.y === 0 && /shield>air/.test(sd.states) && /shield>spot/.test(sm.states), 'on a platform: ' + sd.states + ' | on the stage: ' + sm.states);
    const fall = hold => { const [f] = setup(FL, FL, 0, 60); airborne(f, 0, 44); SCRIPT[0] = i => { if (hold) i.ly = -1; }; let landed = null; run(80, () => { if (f.grounded && landed === null) landed = Math.round(f.y); }); return landed; };
    check('platform: holding down in the air falls through it', fall(false) === 24 && fall(true) === 0, 'lands at height ' + fall(false) + ' normally, ' + fall(true) + ' holding down');
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

  /* ---- Movement model: jumps are given as heights; a full hop pops off the floor; fast fall is instant; speeds ramp ---- */
  for (const [name, A] of [['Flint', FL], ['Nib', NIB], ['Loom', LOOM], ['Hod', HOD]]) {
    const jump = script => { const [f] = setup(A, FL, -70, 70); const st = f.st, ys = []; SCRIPT[0] = (i, tt) => script(i, tt, f); run(160, () => { ys.push(f.y); }); const up = ys.findIndex(y => y > 0); return { st, top: Math.max(...ys), y4: ys[up + 3], air: ys.slice(up).findIndex(y => y === 0) }; };
    const full = jump((i, tt) => { i.jmp = tt >= 2; }), short = jump((i, tt) => { i.jmp = tt === 2 || tt === 3; }), st = full.st;
    const twice = jump((i, tt, f) => { i.jmp = (tt >= 2 && tt < 8) || (tt > 10 && tt < 70 && !f.grounded && f.vy <= 0 && f.jumps === (st.jumps || 1)); });
    const ff = jump((i, tt, f) => { i.jmp = tt >= 2; if (!f.grounded && f.vy <= 0) i.ly = -1; });
    const near = (v, w) => Math.abs(v - w) < 0.15;
    check(name + ': hop heights match the numbers', near(full.top, st.jumpH) && near(short.top, st.hopH) && near(twice.top, st.jumpH + st.airJumpH), 'full ' + full.top.toFixed(1) + ' (' + st.jumpH + '), short ' + short.top.toFixed(1) + ' (' + st.hopH + '), with air jump ' + twice.top.toFixed(1) + ' (' + (st.jumpH + st.airJumpH) + ')');
    check(name + ': a full hop pops off the floor', near(full.y4, st.jumpInit), full.y4.toFixed(1) + ' high after four frames (' + st.jumpInit + ')');
    check(name + ': fast fall drops at full speed at once', ff.air < full.air - 8, 'air time ' + full.air + ' frames, ' + ff.air + ' with a fast fall from the top');
    { /* dash burst, settle to run speed, slide to a stop; walking is slower and follows the stick */
      const [f] = setup(A, FL, -70, 70); let peak = 0, runV = 0, walkV = 0;
      SCRIPT[0] = (i, tt) => { if (tt >= 2 && tt < 50) i.lx = 1; };
      run(49, () => { if (t <= 12) peak = Math.max(peak, f.vx); }); runV = f.vx; run(40); const stopped = f.vx === 0 && f.state === 'idle';
      const [g] = setup(A, FL, -70, 70); SCRIPT[0] = (i, tt) => { i.lx = tt < 2 ? 0 : tt < 9 ? 0.4 : 0.6; }; run(70); walkV = g.vx;
      check(name + ': dash, run, walk and stop speeds', near(peak, st.dash) && near(runV, st.run) && near(walkV, st.walk * 0.6) && stopped, 'dash ' + peak.toFixed(2) + ' (' + st.dash + '), run ' + runV.toFixed(2) + ' (' + st.run + '), walk at 60% stick ' + walkV.toFixed(2) + ' (' + (st.walk * 0.6).toFixed(2) + '), stopped ' + stopped);
    }
  }
  { /* air: drift tops out at the fighter's air speed; a running jump carries ground speed, capped */
    const [f] = setup(FL, FL, -70, 70), st = f.st; let top = 0, atJump = null;
    SCRIPT[0] = (i, tt) => { if (tt >= 2) i.lx = 1; i.jmp = tt >= 30; };
    run(60, () => { if (!f.grounded) { if (atJump === null) atJump = f.vx; else if (t > 50) top = Math.max(top, f.vx); } });
    check('air: a running jump carries speed, then settles to air speed', Math.abs(atJump - st.jumpXMax) < 0.01 && Math.abs(top - st.airSpeed) < 0.12, 'left the ground at ' + atJump.toFixed(2) + ' (cap ' + st.jumpXMax + '), ' + top.toFixed(2) + ' later (air speed ' + st.airSpeed + ')');
  }

  let bad = 0; for (const [ok, name, detail] of results) { if (!ok) bad++; console.log((ok ? 'pass  ' : 'FAIL  ') + name.padEnd(48) + detail); }
  console.log(bad ? bad + ' of ' + results.length + ' checks failed' : 'all ' + results.length + ' rule checks pass');
  if (bad) process.exitCode = 1;
})();
`);
