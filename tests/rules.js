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

  let bad = 0; for (const [ok, name, detail] of results) { if (!ok) bad++; console.log((ok ? 'pass  ' : 'FAIL  ') + name.padEnd(48) + detail); }
  console.log(bad ? bad + ' of ' + results.length + ' checks failed' : 'all ' + results.length + ' rule checks pass');
  if (bad) process.exitCode = 1;
})();
`);
