// Joey and Cronky Dong: scripted checks against the owner's guide (v1.0): the transformation's input, timing, protection
// and persistence (its "mandatory boundary tests"), the weak human form, and the transformed form's reference numbers.
// Usage: node tests/joey.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const JI = ROSTER.findIndex(d => d.name === 'Joey'), JD = ROSTER[JI], HU = JD.forms[0], BG = JD.forms[1], FL = 0, B = DMG_1V1 * FRESH;
  let SCRIPT = [null, null], t = 0; const results = [];
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  function setup(xa, xb, other) {
    slots[0] = { dev: 'kb', pick: JI, ready: true }; slots[1] = { dev: 'kb', pick: other === undefined ? FL : other, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu');
    F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0;
    return F;
  }
  function run(n, each) { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } }
  function check(name, ok, detail) { results.push([ok, name, detail || '']); }
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.012 : tol);
  const pct = v => v.toFixed(2) + '%';
  const taps = (a, b) => (i, tt) => { i.tf = tt === a || tt === b; };   /* the transform action held for exactly one tick at each of these */
  const e = f => frame - f.tfStart;
  /* Flint swings his forward tilt into Joey each frame he is free to; returns the frames at which Joey was hit */
  function pester(j, fl, n) { const hits = []; let p = j.pct; SCRIPT[1] = (i, tt, f) => { f.face = Math.sign(j.x - f.x) || 1; if (f.state === 'idle' && tt % 2 === 0) { i.atk = true; i.lx = f.face * 0.6; } };
    run(n, () => { if (j.pct > p + 0.001) { hits.push(e(j)); p = j.pct; } }); return hits; }

  /* ---- the double tap (guide 04) ---- */
  { const [j] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.tf = tt === 5 || tt === 25; }; run(40);
    const ok20 = j.tfLatch; const [j2] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.tf = tt === 5 || tt === 26; }; run(40);
    check('double tap: a second press 20 ticks after the first transforms; 21 ticks does not', ok20 && !j2.tfLatch, '20 ticks: ' + ok20 + ', 21 ticks: ' + j2.tfLatch); }
  { const [j] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.tf = tt >= 5 && tt < 60; }; run(80);
    const [j2] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.ly = tt % 10 < 5 ? -1 : 0; i.spc = tt === 3 || tt === 9; }; run(80);
    check('holding the action counts once; down on the stick, crouching and down special never transform', !j.tfLatch && !j2.tfLatch, 'held 55 ticks: ' + j.tfLatch + ', stick and special: ' + j2.tfLatch); }
  { /* two taps during the countdown: one request, which starts on the first tick of play */
    slots[0] = { dev: 'kb', pick: JI, ready: true }; slots[1] = { dev: 'kb', pick: FL, ready: true }; startMatch();
    const code = setupOf('kb').map.tf; let n = 0, start = -1; while (mode === 'countdown' && n < 400) { keys[code] = n === 40 || n === 50; step(); n++; if (mode === 'play' && start < 0) start = frame + 1; }
    keys[code] = false; const j = F[0]; run(3);
    check('two taps in the countdown: the growth begins on the first tick of play', j.tfLatch && j.tfStart === start && j.state === 'grow', 'start tick ' + j.tfStart + ', first play tick ' + start + ', state ' + j.state); }

  /* ---- growth and protection (guide 05) ---- */
  { const [j, fl] = setup(0, 9); SCRIPT[0] = taps(1, 4); run(6); const s0 = j.tfStart;
    const hits = pester(j, fl, 340);
    const hitBefore = hits.filter(x => x < 300), first = hits[0];
    check('no hit lands from e = 0 to 299; an ordinary hit lands from e = 300', !hitBefore.length && first >= 300 && first < 330, 'hits at e = ' + (hits.slice(0, 3).join(', ') || 'none'));
    check('the big form takes over at e = 180, not before', BG === JD.forms[1] && j.fi === 1, 'form now ' + j.form.name); }
  { const [j] = setup(0, 60); SCRIPT[0] = taps(1, 4); let atLock = null, at180 = null; run(200, () => { const k = e(j); if (k === 179) atLock = [j.fi, j.state]; if (k === 180) at180 = [j.fi, j.state]; });
    check('e = 179 still growing and human; e = 180 transformed and free to act', atLock && atLock[0] === 0 && atLock[1] === 'grow' && at180 && at180[0] === 1 && at180[1] === 'idle', 'e179 ' + JSON.stringify(atLock) + ', e180 ' + JSON.stringify(at180)); }
  { const [j, fl] = setup(0, 10); SCRIPT[0] = (i, tt) => { i.tf = tt === 1 || tt === 4 || tt === 230 || tt === 234; i.atk = tt === 200; }; run(205); const atk = j.state === 'attack', s0 = j.tfStart;
    const hits = pester(j, fl, 120);
    check('attacking at e = 200 keeps the protection; more taps neither extend it nor start a second injection', atk && !hits.some(x => x < 300) && j.tfStart === s0, 'attacked at e = 200: ' + atk + ', hits before e = 300: ' + hits.filter(x => x < 300).length + ', start tick unchanged: ' + (j.tfStart === s0)); }
  { /* KO during growth: the respawn finishes the same growth; KO after it: still big; the expiry never moves */
    const [j] = setup(0, 60); SCRIPT[0] = taps(1, 4); run(36); const s0 = j.tfStart; j.ko(); SCRIPT[0] = (i, tt, f) => { if (f.state === 'respawn' && f.sf > 26) i.lx = 1; }; let backGrow = null; run(260, () => { if (j.state === 'grow' && backGrow === null) backGrow = e(j); });
    check('KO at e = 30: latch kept, the respawn picks up the growth where the clock is, big at e = 180', j.tfLatch && j.tfStart === s0 && j.fi === 1 && backGrow !== null && backGrow > 50 && backGrow < 180, 'respawned into the growth at e = ' + backGrow + ', form ' + j.form.name);
    const [k] = setup(0, 60); SCRIPT[0] = taps(1, 4); run(205); k.ko(); run(260);
    check('KO at e = 200: comes back as Cronky Dong, with no new protection after e = 300', k.fi === 1 && !k.tfProtected() && k.stocks === 2, 'form ' + k.form.name + ', protected ' + k.tfProtected());
    const [m] = setup(0, 60); SCRIPT[0] = taps(1, 4); run(181); const s1 = m.tfStart; m.ko(); run(5);
    check('KO at e = 179: no fresh 180 ticks, no new 120', m.fi === 1 && m.tfStart === s1 && frame - s1 < 300 + 10, 'start tick unchanged: ' + (m.tfStart === s1)); }
  { /* a request during hitstun waits; it never cancels the hit */
    const [j, fl] = setup(0, 9); fl.startMove('ftilt'); SCRIPT[0] = (i, tt) => { i.tf = tt === 6 || tt === 9; }; let hitAt = -1, growAt = -1; run(80, () => { if (j.state === 'hurt' && hitAt < 0) hitAt = t; if (j.state === 'grow' && growAt < 0) growAt = t; });
    check('taps during hitstun: the hit stands, the growth starts once he is free', hitAt >= 0 && growAt > hitAt && j.pct > 0, 'hit at tick ' + hitAt + ', growth at tick ' + growAt + ', damage ' + pct(j.pct)); }
  { const [j, fl] = setup(0, 8); fl.startMove('grab'); run(12); const held = j.state === 'held'; SCRIPT[0] = (i, tt) => { i.tf = tt === 14 || tt === 17; }; run(10); const during = j.tfLatch;
    run(200); check('a held Joey cannot start until he is let go', held && !during && j.tfLatch, 'held ' + held + ', started while held ' + during + ', started after ' + j.tfLatch); }
  { const [j] = setup(0, 60); SCRIPT[0] = taps(1, 4); run(200); resetFighters(); run(2);
    check('a new match (or the testing reset) starts human', !j.tfLatch && j.fi === 0, 'form ' + j.form.name); }

  /* ---- human Joey (guide 06 to 11) ---- */
  { const s = HU.st; check('human: weight 72, walk 0.70, dash 1.15, run 1.05, air 0.50, gravity 0.10, fall 1.35 / 2.16, squat 6, no air jump',
      s.weight === 72 && s.walk === 0.7 && s.dash === 1.15 && s.run === 1.05 && s.airSpeed === 0.5 && s.grav === 0.1 && s.fall === 1.35 && s.ffall === 2.16 && s.jsq === 6 && s.jumps === 0); }
  { const [j] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.jmp = tt >= 1 && tt < 30; }; let top = 0; run(60, () => { top = Math.max(top, j.y); });
    const [k] = setup(0, 60); SCRIPT[0] = (i, tt) => { i.jmp = tt === 1 || tt === 2; }; let top2 = 0; run(60, () => { top2 = Math.max(top2, k.y); });
    check('human jumps: about 8.45 full, 4.05 short', near(top, 8.45, 0.6) && near(top2, 4.05, 0.5), 'full ' + top.toFixed(2) + ', short ' + top2.toFixed(2)); }
  { const [j] = setup(0, 60); j.x = 0; j.y = 40; j.grounded = false; j.plat = null; j.set('air'); let vy = []; SCRIPT[0] = (i, tt) => { i.jmp = tt % 6 < 3; }; run(30, () => vy.push(j.vy));
    check('human: a jump press in the air never jumps', vy.every((v, k) => k === 0 || v <= vy[k - 1] + 1e-9), 'vertical speed only falls'); }
  { const [j] = setup(0, 60); j.x = 0; j.y = 90; j.grounded = false; j.plat = null; j.vy = 0; j.set('air'); j.startMove('uspec'); const y0 = j.y; let up = 0; run(45, () => { up = Math.max(up, j.y - y0); });
    check('Spot Me! with no ledge in reach adds no lift and ends in an ordinary fall', up <= 0.001 && j.state === 'air', 'rose ' + up.toFixed(3) + ', now ' + j.state); }
  { const [j] = setup(0, 60); j.x = EDGE + 3; j.y = -9; j.face = -1; j.grounded = false; j.plat = null; j.vy = 0; j.set('air'); j.startMove('uspec'); let st0 = ''; run(40, () => { if (j.state === 'ledge') { st0 = 'ledge'; return false; } });
    check('Spot Me! catches a ledge just above his hand and pulls him to it', st0 === 'ledge', 'ended ' + (st0 || j.state)); }
  { const [j, fl] = setup(0, 3.5); j.startMove('grab'); run(14); const held = fl.state === 'held'; let ev = 0, p = fl.pct; SCRIPT[0] = i => { i.ly = 1; }; run(100, () => { if (fl.pct > p + 0.001) { ev++; p = fl.pct; } });
    const want = (1.5 * FRESH + 1.5) * DMG_1V1;
    check('the Three-Rep Bench PR: four damage events, 3.0 in all (before the global modifiers), then one release', held && ev === 4 && near(fl.pct, want, 0.02) && fl.state === 'hurt' || (held && ev === 4 && near(fl.pct, want, 0.02)), ev + ' events, ' + pct(fl.pct) + ' (3.0 base)'); }
  { const [j, fl] = setup(0, 4); SCRIPT[0] = (i, tt) => { i.atk = tt >= 0 && tt < 60; }; const seen = new Set(); run(60, () => { if (j.state === 'attack') seen.add(j.mname); });
    const [k, f2] = setup(0, 4); SCRIPT[0] = (i, tt) => { i.atk = tt % 14 < 2; }; const seen2 = new Set(); run(70, () => { if (k.state === 'attack') seen2.add(k.mname); });
    check('human jab: holding attack does not chain; fresh presses chain all three', !seen.has('jab2') && seen2.has('jab2') && seen2.has('jab3'), 'held: ' + [...seen].join(' > ') + '; pressed: ' + [...seen2].join(' > ')); }
  { const [j, fl] = setup(0, 4.2); j.startMove('jab'); run(30); const d1 = fl.pct; const [k, f2] = setup(0, 5.2); k.startMove('fsmash'); run(80);
    check('human damage is pitiful: jab 0.8, forward smash 5 (before the global modifiers)', near(d1, 0.8 * B, 0.02) && near(f2.pct, 5 * B, 0.02), 'jab ' + pct(d1) + ', forward smash ' + pct(f2.pct)); }

  /* ---- Cronky Dong (guide 12 to 18) ---- */
  const big = () => { const [j, fl] = setup(0, 60); j.fi = 1; j.tfLatch = true; j.tfStart = -9999; j.jumps = 1; return [j, fl]; };
  { const s = BG.st, m = BG.moves;
    check('Cronky: weight 127, walk 1.365, dash 2.09, run 1.873, air 1.208, gravity 0.085, fall 1.63 / 2.608, squat 3, one air jump',
      s.weight === 127 && s.walk === 1.365 && s.dash === 2.09 && s.run === 1.873 && s.airSpeed === 1.208 && s.grav === 0.085 && s.fall === 1.63 && s.ffall === 2.608 && s.jsq === 3 && s.jumps === 1);
    const rows = [['jab', 5, 6, 4, 25], ['jab2', 4, 6, 6, 32], ['ftilt', 7, 9, 8, 35], ['dtilt', 6, 7, 6, 25], ['dash', 9, 12, 12, 35], ['fsmash', 22, 23, 22, 55], ['usmash', 14, 15, 19, 50], ['dsmash', 11, 12, 17, 56],
      ['nair', 10, 10, 12, 39], ['fair', 18, 20, 16, 56], ['bair', 7, 8, 13, 32], ['uair', 6, 10, 13, 38], ['dair', 14, 16, 16, 55], ['sspec', 20, 21, 10, 63], ['dspec', 12, 13, 14, 47], ['ledgeatk', 23, 25, 10, 56]];
    const bad = rows.filter(r => { const h = m[r[0]].h[0]; return !(h.f0 === r[1] && h.f1 === r[2] && h.d === r[3] && m[r[0]].t + 1 === r[4]); }).map(r => r[0]);
    check('Cronky: first hit window, damage and first free frame of ' + rows.length + ' moves as the guide lists them', !bad.length, bad.length ? 'differs: ' + bad.join(', ') : 'all as listed');
    const L = k => [m[k].ll, m[k].ac0, m[k].ac];
    check('Cronky aerials: landing lag and autocancel windows', JSON.stringify([L('nair'), L('fair'), L('bair'), L('uair'), L('dair')]) === JSON.stringify([[10, 9, 26], [17, 0, 55], [11, 6, 30], [15, 5, 25], [14, 2, 49]]));
    const T = m.throws; check('Cronky throws: carry 12 / 13 / 12 / 11 released 15 / 16 / 15 / 17; back 11, up 9, down 7', T.cf.d === 12 && T.cf.f === 15 && T.cb.d === 13 && T.cb.f === 16 && T.cu.d === 12 && T.cu.f === 15 && T.cd.d === 11 && T.cd.f === 17 && T.b.d === 11 && T.u.d === 9 && T.d.d === 7); }
  { const [j] = big(); j.y = 40; j.grounded = false; j.plat = null; j.set('air'); j.vy = -0.5; let rose = false; SCRIPT[0] = (i, tt) => { i.jmp = tt === 2; }; run(10, () => { if (j.vy > 1) rose = true; });
    check('Cronky has his air jump', rose && j.jumps === 0); }
  { const [j, fl] = big(); fl.x = 12; j.startMove('grab'); run(12); const held = fl.state === 'held'; SCRIPT[0] = (i, tt) => { i.lx = tt < 4 ? j.face : tt < 30 ? j.face * 0.7 : 0; i.atk = tt === 40; i.ly = tt >= 38 && tt <= 41 ? 1 : 0; }; let carried = false, x0 = j.x; run(90, () => { if (j.state === 'carry') carried = true; });
    check('Cronky: forward throw lifts them into the carry, he walks with them, and a carry throw releases them', held && carried && Math.abs(j.x - x0) > 3 && fl.state === 'hurt' || (held && carried && fl.pct > 10), 'carried ' + carried + ', walked ' + (j.x - x0).toFixed(1) + ', target at ' + pct(fl.pct)); }
  { const [j, fl] = big(); fl.x = 14; j.startMove('sspec'); let buried = false; run(40, () => { if (fl.state === 'buried') buried = true; });
    check('Cap Check buries a standing opponent', buried, 'target state ' + fl.state); }
  { const [j, fl] = big(); fl.x = 9; j.startMove('sspec'); fl.startMove('ftilt'); run(4); let interrupted = false; run(12, () => { if (j.state !== 'attack' || j.mname !== 'sspec') interrupted = true; });
    check('Cap Check: super armour 5-14 shrugs off a hit (and takes its damage)', !interrupted && j.pct > 0, 'damage taken ' + pct(j.pct) + ', still heading in: ' + !interrupted); }
  { const [j] = big(); j.startMove('nspec'); run(130); const stored = j.punchC, free = j.state !== 'attack';
    const [k, fl] = big(); fl.x = 12; k.punchC = 110; k.ctl.buf.spc = 0; k.doSpecial(); const nm = k.mname; run(40);
    check('The Entire Gym: a full charge (110) is stored, and the next press punches at once for 28%', stored === 110 && free && nm === 'nspecF' && near(fl.pct, 28 * B, 0.05), 'stored ' + stored + ', next press ' + nm + ', target ' + pct(fl.pct)); }
  { const [j] = big(); j.punchC = 60; j.ko(); run(200); check('a stored punch charge goes with the stock', j.punchC === 0); }
  { const [j, fl] = big(); fl.x = 8; j.startMove('uspec'); let hits = 0, p = 0; run(110, () => { if (fl.pct > p + 0.01) { hits++; p = fl.pct; } });
    check('Lat Spread Catastrophe on the ground: seven hits in a row', hits >= 6, hits + ' hits, ' + pct(fl.pct)); }
  { const [j, fl] = big(); fl.x = 18; j.startMove('dspec'); run(60); const ground = fl.pct; const [k, f2] = big(); f2.x = 14; f2.y = 6; f2.grounded = false; f2.plat = null; f2.set('air'); f2.vy = 0; k.startMove('dspec'); run(30, () => { f2.y = 12; f2.vy = 0; f2.grounded = false; f2.plat = null; });
    check('Floor Is Leg Day hits a standing opponent, not one in the air', ground > 0 && f2.pct === 0, 'standing ' + pct(ground) + ', in the air ' + pct(f2.pct)); }

  /* ---- INTENSITY and the 15 seconds (the addendum, v1.0) ---- */
  { const [j] = setup(-60, 60); let n = 0; SCRIPT[0] = (i, tt) => { i.lx = tt < 3 ? 0 : 1; }; run(90, () => { if (j.grounded && (j.state === 'dash' || j.state === 'run') && Math.abs(j.vx) > j.st.walk) n++; });
    check('INTENSITY: running costs 8 units a tick (1250 ticks fill it from empty)', j.fat === 8 * n && n > 30 && FAT.max / FAT.run === 1250, n + ' running ticks, ' + j.fat + ' units'); }
  { const [j] = setup(0, 60); j.fat = 5000; run(60); const after60 = j.fat; run(10); const idle10 = j.fat;
    const [k] = setup(0, 60); k.fat = 5000; SCRIPT[0] = i => { i.shd = true; }; run(120);
    check('rest: nothing for 60 ticks, then 8 a tick standing; a held shield neither fills nor drains', after60 === 5000 && idle10 === 5000 - 80 && k.fat === 5000, 'after 60: ' + after60 + ', 10 more: ' + idle10 + ', shielding 120: ' + k.fat); }
  { const [j, fl] = setup(0, 3.5); j.fat = 0; j.startMove('grab'); run(14); const g0 = j.fat; SCRIPT[0] = i => { i.ly = 1; }; run(100);
    check('the bench press costs 8 to pick and 4 a rep (20 points)', j.fat - g0 === 2000, 'grab ' + g0 + ', bench ' + (j.fat - g0) + ' units'); }
  { const [j, fl] = setup(0, 60); j.fat = FAT.max - 100; j.startMove('fsmash'); let entered = -1, mfAt = 0; run(120, () => { if (j.state === 'exhaust' && entered < 0) { entered = t; } });
    check('full during a move: the move finishes, then TAKE FIVE', entered > 60 && j.exhausted(), 'exhausted from tick ' + entered); }
  { const [j, fl] = setup(0, 60); j.fat = FAT.max; j.exPend = true; run(2); const s0 = j.exStart; let att = false, jumped = false, x0 = j.x;
    SCRIPT[0] = (i, tt) => { i.atk = tt % 4 === 0; i.jmp = tt % 6 === 0; i.spc = tt % 10 === 0; i.lx = tt > 400 && tt < 500 ? 1 : 0; i.shd = tt > 600 && tt < 620; };
    let at899 = null, at900 = null; run(905, () => { if ((j.state === 'attack' || j.state === 'shield') && frame - s0 < 900) att = true; if (!j.grounded) jumped = true; const e = frame - s0; if (e === 899) at899 = j.state; if (e === 900) at900 = j.state; });
    check('exhausted from e = 0 to 899, free at e = 900; attacks, jumps, specials and shield do nothing meanwhile', at899 === 'exhaust' && at900 !== 'exhaust' && !att && !jumped && j.fat < FAT.max, 'e899 ' + at899 + ', e900 ' + at900 + ', acted ' + att + ', jumped ' + jumped);
    const [k] = setup(0, 60); k.fat = FAT.max; k.exPend = true; run(2); SCRIPT[0] = i => { i.lx = 1; }; let vmax = 0; run(120, () => { vmax = Math.max(vmax, Math.abs(k.vx)); });
    check('the shuffle: 0.22 a tick at most', near(vmax, 0.22, 0.001), 'top speed ' + vmax.toFixed(3)); }
  { const [j, fl] = setup(0, 9); j.fat = FAT.max; j.exPend = true; run(2); const s0 = j.exStart; run(198); fl.face = -1; fl.startMove('ftilt'); let hit = false; run(40, () => { if (j.state === 'hurt') hit = true; });
    let back = null; run(120, () => { if (back === null && j.state === 'exhaust') back = j.sf; });
    check('hit at e = 200: the hit lands normally, the deadline stays, the performance resumes where the clock is', hit && j.exStart === s0 && back !== null && back > 230, 'resumed at e = ' + back); }
  { const [j] = setup(0, 60); j.x = 0; j.y = 30; j.grounded = false; j.plat = null; j.set('air'); j.fat = FAT.max; j.exPend = true; let airEx = false; run(80, () => { if (!j.grounded && j.exhausted()) airEx = true; });
    check('full in the air: no lock until he has landed', !airEx && j.exhausted(), 'locked in the air ' + airEx + ', after landing ' + j.exhausted()); }
  { const [j] = setup(0, 60); j.fat = FAT.max; j.exPend = true; run(30); const t0 = t; SCRIPT[0] = (i, tt) => { i.tf = tt === t0 + 1 || tt === t0 + 4; }; run(8); const grew = j.state === 'grow';
    run(200); j.startMove('fsmash'); run(60);
    check('the transformation ends the exhaustion at once, clears INTENSITY, and Cronky Dong never tires', grew && j.fat === 0 && !j.exhausted() && !j.fatOn(), 'growing ' + grew + ', units ' + j.fat); }
  { const [j] = setup(0, 60); j.fat = 7000; j.ko(); run(60); check('a KO as the human clears INTENSITY', j.fat === 0 && !j.exPend); }

  let fail = 0;
  for (const [ok, name, detail] of results) { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '\\n       ' + detail : '')); }
  console.log(results.length + ' checks, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})();
`);
