// Combo lab: drives Potato Sack through scripted routes inside the real game, against the training dummy or a CPU, and reads the
// game's own true-combo counter (COMBO). Loaded after sim.js: in node by tools/combo-search.js, in the browser by tools/record.js.
// It changes nothing in the game: it only supplies inputs (by wrapping cpuInput) and reads state.
(function () {
  const LAB = {};
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const actionable = f => {
    const s = f.state;
    if (s === 'idle' || s === 'air' || s === 'run' || s === 'dash' || s === 'brake' || s === 'wd') return true;
    if (s === 'attack' && f.move && f.move.cancel && f.mf >= f.move.cancel) return true;   /* a tumble from its cancel frame */
    return false;
  };
  /* ---- actions: each says what to press on frame k of the action, and when it is over ---- */
  const press = (k, at, n) => k >= at && k < at + (n || 2);
  const drift = (i, f, o, dir) => { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * (dir || 1) : 0; };
  const A = {};
  const ground = (name, set) => { A[name] = { ground: 1, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0)) { i.atk = true; set(i, f, o); } } }; };
  /* tilts come from the right stick and smashes from attack + special together, exactly as a player can press them */
  const cstick = (name, set) => { A[name] = { ground: 1, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0, 1)) set(i, f, o); } }; };
  ground('jab', () => {}); cstick('ftilt', (i, f, o) => { i.cx = toward(f, o); }); cstick('utilt', i => { i.cy = 1; }); cstick('dtilt', i => { i.cy = -1; });
  ground('fsmash', (i, f, o) => { i.lx = toward(f, o); i.spc = true; }); ground('usmash', i => { i.ly = 1; i.spc = true; }); ground('dsmash', i => { i.ly = -1; i.spc = true; });
  A.dash_attack = { ground: 1, min: 6, inp(i, k, f, o) { if (k < 6) i.lx = toward(f, o); if (press(k, 4)) { i.atk = true; i.lx = toward(f, o); } } };
  A.dash = { ground: 1, min: 8, inp(i, k, f, o) { if (k < 8) i.lx = toward(f, o); } };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ground: 1, max: 80, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0)) i.grb = true; if (f.state === 'hold' && f.sf > 2) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } } };
  A.bag_it = { min: 3, max: 80, inp(i, k, f, o) { if (press(k, 0)) { i.lx = toward(f, o); i.spc = true; } } };
  const aerial = (stick, back) => (i, f, o) => { const d = toward(f, o); if (stick === 'n') { i.lx = 0; i.ly = 0; } else if (stick === 'f') i.lx = f.face; else if (stick === 'b') i.lx = -f.face; else if (stick === 'u') i.ly = 1; else if (stick === 'd') i.ly = -1; i.atk = true; };
  for (const [nm, st] of [['nair', 'n'], ['fair', 'f'], ['bair', 'b'], ['uair', 'u'], ['dair', 'd']]) {
    A['sh_' + nm] = { min: 7, max: 60, inp(i, k, f, o) { if (k === 0) f.face = st === 'b' ? -toward(f, o) : toward(f, o); if (press(k, 0)) i.jmp = true; if (k > 1) drift(i, f, o); if (press(k, 4)) aerial(st)(i, f, o); } };
    A['fh_' + nm] = { min: 12, max: 70, inp(i, k, f, o) { if (k === 0) f.face = st === 'b' ? -toward(f, o) : toward(f, o); if (k < 12) i.jmp = true; if (k > 1) drift(i, f, o); if (press(k, 9)) aerial(st)(i, f, o); } };
    A[nm] = { air: 1, max: 60, inp(i, k, f, o) { if (k === 0 && st === 'b') f.face = -toward(f, o); drift(i, f, o); if (press(k, 0)) aerial(st)(i, f, o); } };
    A['dj_' + nm] = { air: 1, min: 6, max: 60, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) i.jmp = true; if (press(k, 3)) aerial(st)(i, f, o); } };
    A['ff_' + nm] = { air: 1, max: 60, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) aerial(st)(i, f, o); if (k > 3 && f.vy <= 0 && k < 8) i.ly = k % 2 ? -1 : 0; } };
  }
  A.sh_double_nair = { min: 22, max: 60, inp(i, k, f, o) { if (press(k, 0)) i.jmp = true; if (k > 1) drift(i, f, o); if (press(k, 4) || press(k, 19)) { i.atk = true; i.lx = 0; i.ly = 0; } } };   /* the stick centred on the press, or it is a forward air */
  A.wait4 = { min: 4, max: 4, inp() {} }; A.wait10 = { min: 10, max: 10, inp() {} };
  A.jump = { min: 6, max: 6, inp(i, k, f, o) { if (k < 4) i.jmp = true; drift(i, f, o); } };
  A.ff = { air: 1, min: 6, max: 40, inp(i, k, f, o) { i.ly = k % 3 === 0 ? -1 : 0; drift(i, f, o); }, done: f => f.grounded };
  for (const [nm, lx] of [['upb', 0], ['upb_f', 1], ['upb_b', -1]]) A[nm] = { max: 120, inp(i, k, f, o) { if (press(k, 0)) { i.ly = 1; i.spc = true; i.lx = lx ? toward(f, o) * lx * 0.4 : 0; } else i.lx = lx ? toward(f, o) * lx : 0; } };
  for (const [nm, dir] of [['tum_up', 'u'], ['tum_fwd', 'f'], ['tum_back', 'b'], ['tum_dive', 'f'], ['tum_stall', 'n'], ['tum_thru', 'd']]) A[nm] = { max: 40, inp(i, k, f, o) {
      if (press(k, 0)) { i.ly = -1; i.spc = true; }
      const d = toward(f, o); if (k >= 2 && k <= 8) { if (dir === 'u') i.ly = 1; else if (dir === 'f') i.lx = d; else if (dir === 'b') i.lx = -d; else if (dir === 'd') { i.lx = d; i.ly = -1; } }
      if (dir === 'd' && k > 8) i.ly = -1; } };
  for (const [nm, hold] of [['bomb_tap', 1], ['bomb_30', 30], ['bomb_60', 60], ['bomb_120', 120]]) A[nm] = { max: hold + 40, inp(i, k) { if (k < hold) i.spc = true; } };
  LAB.ACTIONS = A;

  /* ---- running a route ---- */
  const BLANK = () => blankIn();
  let script = null, foeMode = 'none', orig = null;
  const DI = { in: (f, o) => ({ lx: sgn(o.x - f.x) }), out: (f, o) => ({ lx: -sgn(o.x - f.x) }), up: () => ({ ly: 1 }), down: () => ({ ly: -1 }) };
  function input(f, o, m) {
    if (script && f === F[0]) return script(f, o);
    if (f === F[1]) { if (foeMode === 'cpu8') { f.ctl.ai.lv = 8; return orig(f, o, m); } const i = BLANK(); if (DI[foeMode] && (f.state === 'hurt' || f.hitlag > 0)) Object.assign(i, DI[foeMode](f, o)); return i; }
    return orig(f, o, m);
  }
  LAB.install = function () { if (!orig) { orig = cpuInput; cpuInput = input; } };
  /* A fresh training-room situation: Potato Sack at x0 facing the opponent `dist` away, the opponent at `pct`. */
  LAB.setup = function (o) {
    LAB.install(); TRAINING = true;
    slots[0] = { dev: 'kb', pick: 2, ready: true }; slots[1] = { dev: 'kb', pick: o.foe ? o.foe[0] : 0, ready: true }; startMatch();
    if (!o.countdown) { mode = 'play'; countdown = 0; }
    const f = F[0], v = F[1]; f.ctl = new Ctl('cpu'); v.ctl = new Ctl('cpu'); if (o.foe) v.fi = o.foe[1]; v.noSwap = true;
    f.x = o.x0 || 0; v.x = f.x + (o.dist || 9);
    if (o.foeOnPlat) { const q = PLATS[1]; v.x = (q.x0 + q.x1) / 2 + (o.dx || 0); v.y = q.y; v.plat = q; v.grounded = true; f.x = v.x - (o.dist || 9); }   /* the opponent standing on the left platform */
    if (o.sackAbove) { const q = PLATS[1]; f.x = (q.x0 + q.x1) / 2; f.y = q.y; f.plat = q; f.grounded = true; v.x = f.x + (o.dist || 9); v.y = 0; v.plat = MAIN; v.grounded = true; }   /* Potato Sack on the platform, the opponent on the stage below */
    if (o.sackOnPlat) { const q = PLATS[1]; f.x = (q.x0 + q.x1) / 2; f.y = q.y; f.plat = q; f.grounded = true; v.x = f.x + (o.dist || 9); v.y = q.y; v.plat = q; v.grounded = true; }   /* both on the platform */ f.face = sgn(v.x - f.x); v.face = -f.face; v.pct = o.pct || 0; f.pct = o.sackPct || 0; f.invuln = v.invuln = 0; PROJ.length = 0;
    for (const c of COMBO) Object.assign(c, { hits: 0, dmg: 0, last: null, best: null, t: 0 });
    if (o.settleCam && typeof stepFx === 'function') for (let k = 0; k < 240; k++) stepFx();   /* recording: let the camera finish closing in before the clip starts (visual only) */
    foeMode = o.di || 'none'; return [f, v];
  };
  /* Runs the actions in order; each starts the frame after the last one leaves Potato Sack free to act. each(frame) is called
     after every frame (the recorder uses it). Returns what the counter showed. */
  LAB.run = function (route, o, each) {
    route = [].concat(...route.map(r => r.split('+')));   /* "a+b" is one search step made of two actions */
    const [f, v] = LAB.setup(o); let n = 0, k = 0, idx = 0, act = null, best = 0, dmg = 0, resets = 0, prev = 0, ko = false, koHits = 0, koT = -1, kos0 = f.kos, startPct = v.pct, hitsAt = [];
    const next = () => { act = idx < route.length ? A[route[idx++]] : null; k = 0; };
    next();
    script = () => { const i = BLANK(); if (act) act.inp(i, k, f, v); return i; };
    const lead = o.lead || 6; let tail = o.tail || 50;
    for (let t = 0; t < (o.maxFrames || 600); t++) {
      if (t < lead) { const s = script; script = () => BLANK(); step(); script = s; if (each) each(t); continue; }
      step(); n++; k++; if (each) each(t);
      const c = COMBO[0]; if (c.hits > best) { best = c.hits; dmg = c.dmg; hitsAt.push(t); } if (c.hits < prev && prev > 0 && c.hits > 0) resets++; prev = c.hits;
      if (f.kos > kos0 && !ko) { ko = true; koHits = COMBO[0].hits || (COMBO[0].last ? COMBO[0].last.hits : 0); koT = t; }   /* how many hits the counter showed when the KO landed */
      if (act) { const done = act.done ? act.done(f) : (k >= (act.min || 2) && actionable(f)) || k >= (act.max || 70); if (done) next(); }
      else if (!act && (tail-- <= 0)) break;
    }
    script = null;
    const c = COMBO[0], final = c.best || { hits: 0, dmg: 0 };
    return { koHits, koT, hits: Math.max(final.hits, best), dmg: +Math.max(final.dmg, dmg).toFixed(1), ko, startPct, endPct: +v.pct.toFixed(1), endX: +v.x.toFixed(0), sackX: +f.x.toFixed(0), frames: n, last: hitsAt[hitsAt.length - 1] || 0 };
  };
  if (typeof window !== 'undefined') window.LAB = LAB; else globalThis.LAB = LAB;
})();
