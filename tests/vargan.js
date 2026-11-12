// Fyrdsman the Ashbound: scripted checks against the owner's "Nordic Berserker" atlas v1.0 (its frame tables, movement and
// its own acceptance tests: the axe as one persistent object, slow fall past the ledge, the 8-frame recall, no swap mid-move,
// the counter's homing and its distance power, no false homing, the 0.30 W meteor, Berserker's x1.5 and its 5% a second).
// Usage: node tests/vargan.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'anim.js', 'movelist.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const VI = ROSTER.findIndex(d => d.name === 'Fyrdsman'), VF = ROSTER[VI].forms[0], mv = VF.moves, st = VF.st, W = vW(), B = DMG_1V1 * FRESH;
  let SCRIPT = [null, null], t = 0; const results = [], CPU0 = cpuInput;
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  function setup(xa, xb, other) {
    slots[0] = { dev: 'kb', pick: VI, ready: true }; slots[1] = { dev: 'kb', pick: other || 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].x = xa; F[1].x = xb; F[0].face = xb >= xa ? 1 : -1; F[1].face = -F[0].face; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0;
    return F;
  }
  function run(n, each) { for (let k = 0; k < n; k++) { step(); t++; if (each && each() === false) break; } }
  function check(name, ok, detail) { results.push([ok, name, detail || '']); }
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.012 : tol);
  const axes = () => PROJ.filter(p => p.kind === 'vaxe');
  /* Fyrdsman starts a move directly against a Flint standing gap away; returns the first hit's frame and the damage */
  function swing(name, gap, o) { o = o || {}; const [v, f] = setup(0, gap); if (o.away) { v.axeAway = true; } if (o.bz) v.berserk = true; v.startMove(name); const out = { first: 0, hits: 0, pct: 0, name: v.mname }; let p = 0;
    run(mv[v.mname].t + 20, () => { if (f.pct > p + 0.01) { out.hits++; if (!out.first) out.first = v.mf; p = f.pct; } }); out.pct = f.pct; return out; }

  /* ---- the atlas's frame budget ---- */
  { const rows = [['jab', 7, 8, 26, 11], ['ftilt', 10, 12, 39, 13], ['utilt', 7, 9, 31, 9], ['dtilt', 10, 12, 35, 14], ['dash', 10, 12, 37, 15], ['fsmash', 24, 27, 66, 24], ['fsmashE', 27, 29, 63, 22],
      ['usmash', 20, 21, 61, 22], ['usmashE', 19, 22, 54, 19], ['dsmash', 16, 19, 61, 12], ['dsmashE', 16, 18, 55, 12], ['nair', 7, 8, 40, 7], ['fair', 17, 18, 48, 18], ['fairE', 14, 19, 44, 17],
      ['bair', 12, 14, 39, 19], ['bairE', 10, 12, 35, 17], ['uair', 11, 12, 39, 15], ['uairE', 11, 12, 33, 13], ['dair', 16, 18, 44, 19], ['grab', 8, 10, 38, 0], ['dgrab', 11, 13, 46, 0], ['pgrab', 12, 14, 41, 0],
      ['sspec', 15, 24, 57, 18], ['dspecHit', 4, 5, 34, 8]];
    const bad = rows.filter(r => { const h = mv[r[0]].h[0]; return !(h.f0 === r[1] && h.f1 === r[2] && mv[r[0]].t === r[3] && h.d === r[4]); }).map(r => r[0]);
    const late = mv.dsmash.h[2].f0 === 25 && mv.dsmash.h[2].d === 15 && mv.nair.h[2].f0 === 17 && mv.nair.h[2].d === 12 && mv.dash.h[1].f0 === 13 && mv.dash.h[1].f1 === 19 && mv.dash.h[1].d === 11 && mv.sspec.h[1].f1 === 40 && mv.sspec.h[1].d === 12;
    const ll = mv.nair.ll === 10 && mv.fair.ll === 14 && mv.fairE.ll === 13 && mv.bair.ll === 12 && mv.bairE.ll === 11 && mv.uair.ll === 12 && mv.uairE.ll === 11 && mv.dair.ll === 16;
    const T = mv.throws, thr = T.f.d + T.f.hits[0][1] === 13 && T.f.f === 13 && T.f.t === 39 && T.b.d + T.b.hits[0][1] === 10 && T.b.f === 14 && T.b.t === 49 && T.u.d + T.u.hits[0][1] === 13 && T.u.t === 43 && T.d.d === 7 && T.d.f === 7 && T.d.t === 12 && st.pummel === 1.6;
    check('atlas: start, active, total and damage of ' + rows.length + ' moves, the second hits, landing lags and throws', !bad.length && late && ll && thr, bad.length ? 'differs: ' + bad.join(', ') : 'all as tabled (nspec releases f' + 30 + ', counter window ' + mv.dspec.vCounter.join('-') + ')');
    check('atlas: locomotion', st.weight === 118 && st.walk === 0.767 && st.run === 1.34 && st.dash === 1.87 && st.airSpeed === 0.83 && near(st.airMul + st.airAdd, 0.04, 1e-9) && st.grav === 0.108 && st.fall === 1.65 && st.ffall === 2.64 && st.jsq === 3,
      'weight 118, walk 0.767, run 1.34, dash 1.87, air 0.83 / 0.04, gravity 0.108, fall 1.65 / 2.64, squat 3'); }

  /* ---- every attack connects on its first active frame for its damage, armed and not ---- */
  { const list = [['jab', 9], ['ftilt', 12], ['utilt', 5], ['dtilt', 12], ['dash', 8], ['fsmash', 15], ['dsmash', 14], ['dspecHit', 6], ['sspec', 6]], bad = [];
    for (const [k, gap] of list) { const r = swing(k, gap), h = mv[k].h[0]; if (!(r.hits >= 1 && r.first === h.f0)) bad.push(k + ' (' + r.hits + ' hits, frame ' + r.first + ')'); }
    for (const [k, gap] of [['fsmash', 8], ['dsmash', 9]]) { const r = swing(k, gap, { away: true }), h = mv[k + 'E'].h[0]; if (!(r.name === k + 'E' && r.hits >= 1 && r.first === h.f0)) bad.push(k + ' unarmed (' + r.name + ', ' + r.hits + ' hits, frame ' + r.first + ')'); }
    check('ground attacks hit on their first active frame; with the axe away the unarmed versions are chosen', !bad.length, bad.length ? bad.join('; ') : list.map(q => q[0]).join(', ') + '; fsmashE, dsmashE');
    const fs1 = swing('fsmash', 15), fsB = swing('fsmash', 15, { bz: true });
    check('Berserker: +50% damage', near(fsB.pct / fs1.pct, 1.5, 0.01), (fs1.pct / B).toFixed(1) + '% -> ' + (fsB.pct / B).toFixed(1) + '% (before the one-on-one bonus)');
    /* (owner) every axe hit has a handle sour spot: 60% of the blade, same frames and group, listed after the blade */
    const axeMoves = ['fsmash', 'usmash', 'dsmash', 'fair', 'bair', 'uair', 'uspec', 'uspecL'], badS = [];
    for (const k of axeMoves) { const h = mv[k].h; for (let i = 0; i < h.length; i++) if (h[i].ax) { const s = h[i + 1];
      if (!(s && s.haft && s.f0 === h[i].f0 && s.f1 === h[i].f1 && (s.g || 0) === (h[i].g || 0) && near(s.d, Math.max(0.5, Math.round(h[i].d * 1.2) / 2), 1e-9) && s.k <= h[i].k && s.b <= h[i].b)) badS.push(k + ' #' + i); } }
    const close = swing('fsmash', 3), mid = swing('fsmash', 9);
    check('axe sweet and sour spots: the handle hits for 60%, the blade wins when both touch, one hit per swing', !badS.length && near(close.pct / fs1.pct, 0.6, 0.03) && close.hits === 1 && near(mid.pct, fs1.pct, 0.01) && mid.hits === 1,
      (badS.length ? 'no handle on ' + badS.join(', ') + '; ' : '') + 'forward smash at 3: ' + (close.pct / B).toFixed(1) + '%, at 9: ' + (mid.pct / B).toFixed(1) + '%, at 15: ' + (fs1.pct / B).toFixed(1) + '%'); }

  /* ---- the axe is a world object ---- */
  { const [v] = setup(-30, 40); v.startMove('nspec'); let at = 0; run(200, () => { if (!at && axes().length) at = v.mf || 30; });
    const a = axes(); const stuck = a.length === 1 && a[0].st === 'stuck' && !!a[0].plat; run(600); const still = axes().length === 1 && axes()[0].st === 'stuck';
    check('axe persistence: thrown on frame 30, it lands on what it meets and stays there, the only one', at === 30 && stuck && still && v.axeAway, 'released f' + at + ', stuck at x ' + (a[0] ? a[0].x.toFixed(1) : '?') + '; 800 frames later ' + axes().length + ' axe, ' + (axes()[0] ? axes()[0].st : 'none'));
    /* onto a platform */
    { const [v2] = setup(-44, 60); v2.y = 26; v2.plat = PLATS[1]; v2.x = -40; v2.startMove('nspec'); run(220); const q = axes()[0];
      check('axe persistence: a pass-through platform holds it too', q && q.st === 'stuck' && q.plat !== MAIN && q.plat.soft, q ? 'stuck on the platform at height ' + q.plat.y : 'no axe'); }
    /* past the ledge it falls at 0.55 of its gravity */
    { const [v3] = setup(-40, 60); vThrow(v3); const q = axes()[0], g = x => { q.st = 'fly'; q.x = x; q.y = 60; q.vx = 0; q.vy = 0; vAxeStep(q); return -q.vy; }, on = g(EDGE - 10), off = g(EDGE + 20);
      check('offstage slow fall: 0.55 x gravity past the ledge', near(off / on, 0.55, 1e-9), 'a frame\u2019s fall speed ' + on.toFixed(4) + ' over the stage, ' + off.toFixed(4) + ' past the ledge'); }
    /* one axe: throwing is impossible while it is away (neutral special is the beckon) */
    { const [v4] = setup(-30, 40); v4.startMove('nspec'); run(120); v4.startMove('nspec'); run(80);
      check('only one axe ever exists: neutral special with it away does not throw again', axes().length === 1 && v4.mname === 'nspecE', axes().length + ' axe, the move was ' + v4.mname); } }

  /* ---- recall: 8 ticks of special held, after letting go of the throw's press ---- */
  { const [v] = setup(-30, 60); SCRIPT[0] = (i, tt) => { i.spc = tt < 140; }; v.startMove('nspec'); run(140);
    const held = axes()[0] && axes()[0].st === 'stuck';
    SCRIPT[0] = null; run(3); let n = 0, rec = 0; SCRIPT[0] = i => { i.spc = true; }; run(12, () => { n++; if (!rec && axes()[0] && axes()[0].st === 'recall') rec = n; });
    let back = 0; run(300, () => { back++; if (!v.axeAway) return false; });
    check('manual recall: holding the throw\\u2019s own press never recalls; a new hold recalls after exactly 8 frames, and it flies home', held && rec === 8 && !v.axeAway && axes().length === 0, 'kept the press 110 frames: ' + (held ? 'still stuck' : 'recalled') + '; new hold recalled on frame ' + rec + ', in hand ' + back + ' frames later'); }
  /* no cancellation: a move in progress keeps its version when the axe comes back */
  { const [v] = setup(-60, 60); v.startMove('nspec'); run(150); const p = axes()[0]; p.x = v.x + 30; p.y = v.y + 30; p.st = 'fly'; p.vx = p.vy = 0; vRecall(v, p); v.y = 40; v.vy = 0; v.grounded = false; v.plat = null; v.set('air'); v.startMove('fair');
    const name = v.mname; let caught = -1, swapped = false; run(48, () => { if (!v.axeAway && caught < 0) caught = v.mf; if (v.state === 'attack' && v.mname !== name) swapped = true; if (v.state !== 'attack') return false; });
    check('no attack cancellation: catching the axe mid-move keeps the move as it started', name === 'fairE' && caught > 0 && !swapped, 'started ' + name + ', axe caught on its frame ' + caught + ', still ' + name); }

  /* ---- the counter ---- */
  function counterAt(D, setAxe) {
    const [v, f] = setup(0, 9); v.face = 1; f.face = -1; vThrow(v); const p = axes()[0]; v.x = 0; v.y = 0; v.grounded = true; v.plat = MAIN; v.vx = 0; v.face = 1; v.set('idle');
    f.x = 9; f.y = 0; f.pct = 0; f.set('idle'); f.vx = f.vy = 0; f.face = -1;
    if (setAxe) setAxe(p, v); else { p.st = 'stuck'; p.ghost = true; p.x = -D; p.y = v.y + v.st.h * 0.5; p.plat = null; }   /* as vStick leaves it: a stuck axe hurts nobody */
    v.startMove('dspec'); run(9); f.startMove('ftilt'); let home = null, homeHit = 0, pct0 = 0;
    run(260, () => { const q = axes()[0]; if (q && q.st === 'home' && !home) { home = q.h.d; pct0 = f.pct; } if (q && home && !homeHit && f.pct > pct0 + 0.01 && q.st !== 'home') homeHit = f.pct - pct0; });
    return { home, homeHit, v, f, p: axes()[0] };
  }
  { const r0 = counterAt(0), r1 = counterAt(0.25 * W), r2 = counterAt(0.6 * W);
    check('counter power by distance: 12%, about 16.1% and 21% at 0, 0.25 W and 0.55 W or more', near(r0.home, 12, 0.01) && near(r1.home, 12 + 9 * 0.25 / 0.55, 0.01) && near(r2.home, 21, 0.01), r0.home + '% / ' + r1.home + '% / ' + r2.home + '%');
    check('correct counter trigger: axe stuck in the stage, opponent strikes, it homes in with no special held, and hits', r2.home > 0 && r2.homeHit > 0, 'launcher and homing strike together ' + (r2.homeHit / B).toFixed(1) + '% before the one-on-one bonus; the launcher alone ' + mv.dspecHit.h[0].d + '%');
    const r3 = counterAt(0, (p, v) => { p.st = 'fly'; p.x = v.x - 50; p.y = 60; p.vx = -1; p.vy = 1; });
    check('no false homing: a counter while the axe is still flying only pops (the unarmed uppercut)', !r3.home && r3.v.mname === 'dspecHitE', 'axe ' + (r3.p ? r3.p.st : 'none') + ', move ' + r3.v.mname); }

  /* ---- the meteor ---- */
  function meteor(bz, x0) { const [v] = setup(x0 === undefined ? -40 : x0, 60); v.face = 1; v.berserk = !!bz; v.startMove('sspec'); let end = 0; const x = v.x; run(60, () => { if (!end && v.mf > 15 && Math.abs(v.vx) < 1e-9) end = v.mf; if (v.state !== 'attack') return false; }); return { d: v.x - x, end }; }
  { const a = meteor(false), b = meteor(true);
    check('meteor shoulder charge: exactly 0.30 W of travel, and Berserker covers it sooner, never further', near(a.d, 0.3 * W, 0.05) && near(b.d, 0.3 * W, 0.05) && b.end < a.end, 'W = ' + W + ': ' + a.d.toFixed(2) + ' (done by frame ' + a.end + '), Berserker ' + b.d.toFixed(2) + ' (by frame ' + b.end + ')'); }

  /* ---- Berserker ---- */
  { const [v] = setup(-40, 60); SCRIPT[0] = (i, tt) => { i.atk = i.spc = tt === 2; }; run(14); const on = v.berserk; const sB = v.st;
    check('A + B together toggles Berserker (no jab, no special)', on && v.state !== 'attack' && !axes().length, 'Berserker ' + (on ? 'on' : 'off'));
    check('Berserker: walk, run, dash and air speed and acceleration x 1.5; gravity, jumps and frame counts the same', near(sB.walk / st.walk, 1.5, 1e-9) && near(sB.run / st.run, 1.5, 1e-9) && near(sB.dash / st.dash, 1.5, 1e-9) && near(sB.airSpeed / st.airSpeed, 1.5, 1e-9) && near(sB.airMul / st.airMul, 1.5, 1e-9) && sB.grav === st.grav && sB.vJump === st.vJump && sB.ffall === st.ffall && mv.fsmash.t === 66,
      'run ' + st.run + ' -> ' + sB.run.toFixed(3) + ', air ' + st.airSpeed + ' -> ' + sB.airSpeed.toFixed(3));
    SCRIPT[0] = null; v.pct = 0; v.bzAcc = 0; run(60); const p60 = v.pct; run(540); const p600 = v.pct;
    v.pct = 0; v.bzAcc = 0; SCRIPT[0] = i => { i.shd = true; }; run(60); const pSh = v.pct; SCRIPT[0] = null;
    check('mode drain: 5% at 60 frames, 50% at 600, in shield too', p60 === 5 && p600 === 50 && pSh === 5, '60 frames ' + p60 + '%, 600 frames ' + p600 + '%, 60 frames shielding ' + pSh + '%');
    v.ko(); run(60); check('a lost stock ends Berserker and puts the axe back in his hand', !v.berserk && !v.axeAway, 'after the KO: Berserker ' + v.berserk + ', axe away ' + v.axeAway); }

  /* ---- (owner, 2026-11-12) the axe throw: begun in the air it carries on through a landing; super armour with a SUPER ARMOR pop ---- */
  { const [v] = setup(-30, 40); v.y = 6; v.vy = 0; v.grounded = false; v.plat = null; v.set('air'); v.startMove('nspec'); let landAt = 0, thrown = 0;
    run(80, () => { if (!landAt && v.grounded) landAt = v.mf; if (!thrown && axes().length) thrown = v.mf || -1; if (v.state !== 'attack') return false; });
    check('air axe throw: landing mid-wind-up does not cancel it, the axe still flies', landAt > 0 && landAt < 30 && thrown === 30 && axes().length === 1, 'landed on frame ' + landAt + ', axe out on frame ' + thrown);
    const [w, f] = setup(0, 8); w.startMove('nspec'); run(12); POPS.length = 0; const p0 = w.pct; f.face = -1; f.startMove('ftilt'); let st2 = '', popped = '';
    run(30, () => { if (w.pct > p0 && !st2) { st2 = w.state + '/' + w.mname; } for (const q of POPS) if (q.text === 'SUPER ARMOR') popped = q.text; });
    check('axe throw has super armour: a hit lands for damage, he keeps throwing, SUPER ARMOR pops up', w.pct > p0 && st2 === 'attack/nspec' && popped === 'SUPER ARMOR', 'took ' + ((w.pct - p0) / B).toFixed(1) + '%, then ' + st2 + ', pop ' + (popped || 'none')); }

  /* ---- up special: rises, hangs, dives, lands with a strike ---- */
  { const [v] = setup(-30, 60); v.startMove('uspec'); let top = 0, landed = 0; run(200, () => { top = Math.max(top, v.y); if (v.mname === 'uspecL' && !landed) landed = t; });
    check('Soaring Plunge: rises about 2.25 H, dives back and lands into its landing strike', top > 2.0 * st.h && top < 2.5 * st.h && landed > 0 && v.grounded, 'peak ' + top.toFixed(1) + ' (H ' + st.h + '), landing strike at tick ' + landed); }

  /* ---- CPU matches: nothing breaks, the axe and Berserker get used ---- */
  { let bad = 0, used = new Set(); for (let k = 0; k < 3; k++) { slots[0] = { dev: 'kb', pick: VI, ready: true }; slots[1] = { dev: 'kb', pick: [0, 7, 8][k], ready: true }; startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu');
      cpuInput = CPU0; let n = 0; while (mode !== 'over' && n < 3 * 3600) { step(); n++; for (const f of F) { if (!isFinite(f.x) || !isFinite(f.y)) bad++; const a = animState(f); if (!a || !isFinite(a.v)) bad++; } if (F[0].axe) used.add(F[0].axe.st); if (F[0].berserk) used.add('berserk'); } }
    check('CPU matches: no broken states; the CPU throws, recalls and uses Berserker', !bad && used.has('stuck') && used.has('recall') && used.has('berserk'), 'seen: ' + [...used].join(', ') + (bad ? '; ' + bad + ' bad frames' : '')); }

  let fails = 0; for (const [ok, name, detail] of results) { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  (' + detail + ')' : '')); }
  console.log(results.length - fails + ' of ' + results.length + ' checks pass'); if (fails) process.exitCode = 1;
})();
`);
