// Fowls lab: drives Furious Fowls through scripted routes inside the real game simulation (sim.js), against a training dummy
// or a defending bot, and reads the game's own true-combo counter (COMBO). Loaded after sim.js: in node by tools/fowls-search.js
// and friends, in the browser by tools/fowls-rec.js. It changes nothing in the game: it only supplies inputs (by wrapping
// cpuInput) and reads state. A testing tool only.
//
// A route is a list of action names; each action presses buttons on frame k of itself and ends when Fowls is free to act again
// (or after its own max). "a+b" is one step of two actions. Actions written "name:arg" take a number (a charge or a wait).
//
// The defender (F[1]) is scripted by `def`: { di: 'none'|'in'|'out'|'up'|'down'|'upin'|'upout'|'downin'|'downout',
//   sdi: 'none'|'in'|'out'|'up'|'down', esc: 'none'|'ad'|'adaway'|'jump'|'jumpaway'|'nair'|'shield'|'cpu8' }
// DI is held whenever it is in hitstun or frozen by a hit; SDI is a flick on every second frame of a freeze; esc is what it does
// the first frame it can act (out of hitstun, or at the hitstun cancels from frame 40 and 45).
(function () {
  const FL = {};
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const actionable = f => {
    const s = f.state;
    if (s === 'idle' || s === 'air' || s === 'run' || s === 'dash' || s === 'brake' || s === 'wd') return true;
    if (s === 'attack' && f.move && f.mname === 'launch' && f.mf > 6) return true;   /* flying as the bird: any action ends the flight */
    return false;
  };
  FL.actionable = actionable;
  const press = (k, at, n) => k >= at && k < at + (n || 1);
  const drift = (i, f, o, dir) => { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * (dir || 1) : 0; };
  const A = {};
  /* how a hop's aerial drifts (sh_X:J:M): M undefined toward the opponent, 'n' no drift, 'b' away, 'f' toward and fast-fall at the
     peak, 'g' no drift and fast-fall at the peak. The attack press overrides the stick on its frame. */
  const hopDrift = (i, k, f, o, m) => { if (m === undefined || m === 'f') drift(i, f, o); else if (m === 'b') drift(i, f, o, -1);
    if ((m === 'f' || m === 'g') && f.vy <= 0 && !f.ff && k % 2 === 0) i.ly = -1; };
  /* ---- on the ground ---- */
  const ground = (name, set, opt) => { A[name] = Object.assign({ ground: 1, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0)) { i.atk = true; set(i, f, o); } } }, opt || {}); };
  const cstick = (name, set) => { A[name] = { ground: 1, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0)) set(i, f, o); } }; };
  ground('jab', () => {});
  A.jab3 = { ground: 1, max: 60, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (k % 4 === 0 && k < 24) i.atk = true; } };
  cstick('ftilt', (i, f, o) => { i.cx = toward(f, o); }); cstick('utilt', i => { i.cy = 1; }); cstick('dtilt', i => { i.cy = -1; });
  ground('fsmash', (i, f, o) => { i.lx = toward(f, o); i.spc = true; }); ground('usmash', i => { i.ly = 1; i.spc = true; }); ground('dsmash', i => { i.ly = -1; i.spc = true; });
  A.dash_attack = { ground: 1, min: 6, inp(i, k, f, o) { if (k < 6) i.lx = toward(f, o); if (press(k, 4)) { i.atk = true; i.lx = toward(f, o); } } };
  A.dash = { ground: 1, min: 8, max: 8, inp(i, k, f, o) { if (k < 8) i.lx = toward(f, o); } };
  A.dashback = { ground: 1, min: 8, max: 8, inp(i, k, f, o) { if (k < 8) i.lx = -toward(f, o); } };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ground: 1, max: 90, inp(i, k, f, o) { if (k === 0) f.face = toward(f, o); if (press(k, 0)) i.grb = true; if (f.state === 'hold' && f.sf > 2) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } } };
  A.dashgrab_f = { ground: 1, max: 90, inp(i, k, f, o) { if (k < 6) i.lx = toward(f, o); if (press(k, 4)) i.grb = true; if (f.state === 'hold' && f.sf > 2) i.lx = f.face; } };
  /* ---- in the air ---- */
  const aerial = st => (i, f, o) => { if (st === 'n') { i.lx = 0; i.ly = 0; } else if (st === 'f') i.lx = f.face; else if (st === 'b') i.lx = -f.face; else if (st === 'u') i.ly = 1; else if (st === 'd') i.ly = -1; i.atk = true; };
  for (const [nm, st] of [['nair', 'n'], ['fair', 'f'], ['bair', 'b'], ['uair', 'u'], ['dair', 'd']]) {
    A['sh_' + nm] = { min: 7, max: 70, inp(i, k, f, o, arg, arg2) { if (k === 0) f.face = st === 'b' ? -toward(f, o) : toward(f, o); if (press(k, 0, 2)) i.jmp = true; if (k > 1) hopDrift(i, k, f, o, arg2); if (press(k, arg === undefined ? 4 : arg)) aerial(st)(i, f, o); } };   /* sh_X:J presses the attack J frames after the jump */
    A['fh_' + nm] = { min: 12, max: 80, inp(i, k, f, o, arg, arg2) { if (k === 0) f.face = st === 'b' ? -toward(f, o) : toward(f, o); if (k < 12) i.jmp = true; if (k > 1) hopDrift(i, k, f, o, arg2); if (press(k, arg === undefined ? 9 : arg)) aerial(st)(i, f, o); } };
    A[nm] = { air: 1, max: 70, inp(i, k, f, o) { if (k === 0 && st === 'b') f.face = -toward(f, o); drift(i, f, o); if (press(k, 0)) aerial(st)(i, f, o); } };
    A['nd_' + nm] = { air: 1, max: 70, inp(i, k, f, o) { if (press(k, 0)) aerial(st)(i, f, o); } };   /* no drift */
    A['dj_' + nm] = { air: 1, min: 6, max: 70, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) i.jmp = true; if (press(k, 3)) aerial(st)(i, f, o); } };
    A['ff_' + nm] = { air: 1, max: 70, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) aerial(st)(i, f, o); if (k > 3 && f.vy <= 0 && k < 9) i.ly = k % 2 ? -1 : 0; } };
  }
  A.wait = { min: 1, inp() {} };   /* wait:N */
  A.jump = { min: 6, max: 6, inp(i, k, f, o) { if (k < 4) i.jmp = true; drift(i, f, o); } };
  A.hop = { min: 3, max: 3, inp(i, k, f, o) { if (k < 1) i.jmp = true; drift(i, f, o); } };
  A.dj = { air: 1, min: 4, max: 4, inp(i, k, f, o) { if (k < 1) i.jmp = true; drift(i, f, o); } };
  A.ff = { air: 1, min: 6, max: 50, inp(i, k, f, o) { i.ly = k % 3 === 0 ? -1 : 0; drift(i, f, o); }, done: f => f.grounded };
  A.drift = { air: 1, min: 4, max: 4, inp(i, k, f, o) { drift(i, f, o); } };   /* drift:N */
  A.land = { air: 1, min: 1, max: 80, inp(i, k, f, o) { drift(i, f, o); }, done: f => f.grounded && actionable(f) };
  /* ---- the slingshot's specials ---- */
  /* Neutral B: tap for the next bird; sel:K holds the wheel and points at bird K (0 Flint, 1 Bolt, 2 Cinder, 3 Pip, 4 Pearl) */
  A.seltap = { max: 50, inp(i, k) { if (press(k, 0, 2)) i.spc = true; } };
  A.sel = { max: 60, inp(i, k, f, o, arg) { if (k < 14) i.spc = true; if (k >= 9 && k < 14) { const a = arg * Math.PI * 2 / 5; i.lx = Math.sin(a); i.ly = Math.cos(a); } } };
  /* Side B: sb:AIM with AIM -1 (down) .. 1 (up); the bird then flies, steered toward the opponent, until it hits or lands */
  A.sb = { max: 30, inp(i, k, f, o, arg) { if (press(k, 0, 1)) { i.lx = toward(f, o); i.spc = true; } else if (f.state === 'attack' && f.mname === 'sspec') { i.ly = arg === undefined ? 0 : arg; } }, done: f => f.flying };
  A.sbr = { max: 30, inp(i, k, f, o, arg) { if (press(k, 0, 1)) { i.lx = -toward(f, o); i.spc = true; } else if (f.state === 'attack' && f.mname === 'sspec') { i.ly = arg === undefined ? 0 : arg; } }, done: f => f.flying };   /* fired away from the opponent */
  A.fly = { max: 70, inp(i, k, f, o) { const dx = o.x - f.x; i.lx = Math.abs(dx) > 1 ? sgn(dx) : 0; if (i.lx * f.vx > 0 && Math.abs(dx) > 30) i.lx *= 0.5; }, done: f => !f.flying };   /* steer the flying bird into the opponent */
  A.flyn = { max: 70, inp() {}, done: f => !f.flying };   /* no steering */
  A.flyfor = { max: 70, min: 1, inp() {} };   /* flyfor:N, no steering for N frames */
  A.boltfix = { max: 3, min: 1, inp(i, k, f, o) { if (press(k, 0)) { i.spc = true; const dx = o.x - f.x, dy = o.y + o.st.h / 2 - f.y, m = Math.hypot(dx, dy) || 1; i.lx = dx / m; i.ly = dy / m; } } };   /* Bolt's one correction, aimed at the opponent */
  A.dive = { max: 70, inp(i) { i.ly = -1; }, done: f => !f.flying };   /* Cinder's dive */
  /* Up B, the Cyclone: up:C:DIR, held C frames (0..45), then let go with the stick pointing DIR: t toward, tu up-toward, u up, td down-toward, b back */
  A.up = { max: 160, inp(i, k, f, o, arg, arg2) { const hold = arg || 0, d = toward(f, o); if (k === 0) { i.ly = 1; i.spc = true; return; }
      const dir = arg2 || 'tu', v = dir === 't' ? [d, 0] : dir === 'tu' ? [d * 0.7, 0.7] : dir === 'u' ? [0, 1] : dir === 'td' ? [d * 0.7, -0.7] : dir === 'b' ? [-d, 0] : dir === 'bu' ? [-d * 0.7, 0.7] : [0, -1];
      if (k < 8 + hold) i.spc = true; i.lx = v[0]; i.ly = v[1]; } };
  /* Down B: each bird's own; dn holds special 12 frames (Brace stays braced), dnj jumps out of Skitter Step */
  A.dn = { max: 70, inp(i, k) { if (k === 0) { i.ly = -1; i.spc = true; } else if (k < 12) i.spc = true; } };
  A.dntap = { max: 70, inp(i, k) { if (k === 0) { i.ly = -1; i.spc = true; } } };
  A.dnj = { max: 70, inp(i, k) { if (k === 0) { i.ly = -1; i.spc = true; } if (k >= 13 && k <= 15) i.jmp = k === 13; } };
  A.dnpull = { max: 70, inp(i, k) { if (k === 0) { i.ly = -1; i.spc = true; } if (k === 14) { i.ly = -1; i.spc = true; } } };   /* Pip: pull the parade in */
  /* ---- the bird alone ---- */
  A.bnspec = { max: 140, inp(i, k, f, o, arg) { if (press(k, 0)) i.spc = true; else if (arg && k < arg) i.spc = true; } };   /* bnspec:HOLD */
  A.bsspec = { max: 70, inp(i, k, f, o) { if (press(k, 0)) { i.lx = toward(f, o); i.spc = true; } else drift(i, f, o); } };
  A.buspec = { max: 70, inp(i, k, f, o) { if (press(k, 0)) { i.ly = 1; i.spc = true; } drift(i, f, o); } };
  A.buspec2 = { max: 70, inp(i, k, f, o) { if (press(k, 0) || press(k, 19)) { i.ly = 1; i.spc = true; } drift(i, f, o); } };   /* the vault / ladder's second step */
  A.rejoin = { max: 30, inp(i, k) { if (press(k, 0)) { i.ly = -1; i.spc = true; } } };
  A.flap = { air: 1, min: 3, max: 3, inp(i, k, f, o) { if (press(k, 0)) i.jmp = true; drift(i, f, o); } };
  A.home = { max: 200, inp(i, k, f) { const s = f.sling; if (!s) return; const dx = s.x - f.x; i.lx = Math.abs(dx) > 1 ? sgn(dx) : 0; if (s.y > f.y + 4 && k % 6 === 0 && !f.grounded) i.jmp = true; }, done: f => !f.sling || Math.hypot(f.x - f.sling.x, f.y - f.sling.y) < 1.4 * FW };
  /* ---- movement, for the movement clips: wd:l / wd:s (wavedash long or short, toward the opponent unless arg2 is b), dd (dash dance) ---- */
  A.wd = { min: 5, max: 60, inp(i, k, f, o, arg, arg2) { if (k === 0) { f.wdT = -1; i.jmp = true; } if (!f.grounded && f.wdT < 0) { f.wdT = k; i.shd = true; i.lx = (arg2 === 'b' ? -1 : 1) * toward(f, o); i.ly = arg === 's' ? -0.8 : -0.35; } }, done: f => f.grounded && (f.state === 'idle' || f.state === 'run' || f.state === 'dash') };
  A.dd = { min: 48, max: 48, inp(i, k, f, o) { i.lx = (Math.floor(k / 8) % 2 ? -1 : 1) * toward(f, o); } };   /* six 8-frame dash-dance turns */
  FL.ACTIONS = A;

  /* ---- the defender ---- */
  const DIV = { in: (f, o) => [sgn(o.x - f.x), 0], out: (f, o) => [-sgn(o.x - f.x), 0], up: () => [0, 1], down: () => [0, -1],
    upin: (f, o) => [sgn(o.x - f.x) * 0.7, 0.7], upout: (f, o) => [-sgn(o.x - f.x) * 0.7, 0.7], downin: (f, o) => [sgn(o.x - f.x) * 0.7, -0.7], downout: (f, o) => [-sgn(o.x - f.x) * 0.7, -0.7] };
  let script = null, def = {}, orig = null, dt = 0;
  function defender(v, a) {
    const i = blankIn(); dt++;
    if (def.esc === 'cpu8') { v.ctl.ai.lv = 8; return null; }
    const stunned = v.state === 'hurt' || v.hitlag > 0;
    if (stunned && DIV[def.di]) { const d = DIV[def.di](v, a); i.lx = d[0]; i.ly = d[1]; }
    if (v.hitlag > 0 && def.sdi && def.sdi !== 'none' && dt % 2 === 0) { const d = (DIV[def.sdi] || (() => [0, 0]))(v, a); i.lx = d[0]; i.ly = d[1]; }
    else if (v.hitlag > 0 && def.sdi && def.sdi !== 'none') { i.lx = 0; i.ly = 0; }
    const e = def.esc || 'none', away = -sgn(a.x - v.x) || 1;
    if (stunned) { def.hit = true; def.freeT = 0; } else if (def.hit) def.freeT = (def.freeT || 0) + 1;
    const free = v.state === 'air' || v.state === 'idle' || v.state === 'land' || v.state === 'run' || v.state === 'dash' || v.state === 'brake';
    if (e !== 'none' && v.hitlag === 0 && def.hit) {
      const cancel = v.state === 'hurt' && !v.grounded && v.sf >= 39, early = free && def.freeT <= 4;
      if (cancel || early) {
        if (e === 'ad' || e === 'adaway') { if (dt % 2) i.shd = true; if (e === 'adaway') { i.lx = away; i.ly = 0.5; } }
        else if (e === 'jump' || e === 'jumpaway') { if (v.sf >= 44 || free) { if (dt % 2) i.jmp = true; if (e === 'jumpaway') i.lx = away; } }
        else if (e === 'nair') { if (v.sf >= 44 || free) { if (dt % 2) i.atk = true; } }
        else if (e === 'shield') { if (v.grounded) i.shd = true; else if (dt % 2) i.shd = true; }
        return i;
      }
    }
    /* offstage and free: it comes back (jump, then its up special toward the stage); a dummy that never recovers would give false KOs */
    if (def.recover !== false && (free || v.state === 'helpless') && !v.grounded && (Math.abs(v.x) > EDGE - 2 || v.y < -2)) {
      i.lx = -sgn(v.x) || 1;
      if (free && v.jumps > 0 && v.vy < 0 && dt % 2) i.jmp = true;
      else if (free && v.jumps === 0 && v.vy < 0 && v.y < 12 && dt % 3 === 0) { i.ly = 1; i.lx *= 0.5; i.spc = true; }
    }
    return i;
  }
  function input(f, o, m) {
    if (script && f === F[0]) return script(f, o);
    if (f === F[1] && script) { const r = defender(f, o); if (r) return r; return orig(f, o, m); }
    return orig(f, o, m);
  }
  FL.install = function () { if (!orig) { orig = cpuInput; cpuInput = input; } };
  /* A fresh training-room situation. o: { bird 0..4, foe [roster, form], pct, dist, x0, foeY, fowlPct, plat, def } */
  FL.setup = function (o) {
    FL.install(); TRAINING = true;
    slots[0] = { dev: 'kb', pick: 5, ready: true }; slots[1] = { dev: 'kb', pick: o.foe ? o.foe[0] : 0, ready: true }; startMatch();
    mode = 'play'; countdown = 0;
    const f = F[0], v = F[1]; f.ctl = new Ctl('cpu'); f.ctl.cFall = true; v.ctl = new Ctl('cpu'); if (o.foe) v.fi = o.foe[1]; v.noSwap = true;
    f.fi = o.bird || 0; f.jumps = f.st.jumps ?? 1;
    f.x = o.x0 || 0; v.x = f.x + (o.dist === undefined ? 12 : o.dist);
    if (o.foeY) { v.y = o.foeY; v.grounded = false; v.plat = null; v.set('air'); }
    if (o.foePlat) { const q = PLATS[o.foePlat]; v.x = (q.x0 + q.x1) / 2 + (o.dx || 0); v.y = q.y; v.plat = q; v.grounded = true; }
    if (o.fowlY) { f.y = o.fowlY; f.grounded = false; f.plat = null; f.set('air'); }
    f.face = sgn(v.x - f.x) || 1; v.face = -f.face; v.pct = o.pct || 0; f.pct = o.fowlPct || 0; f.invuln = v.invuln = 0; PROJ.length = 0;
    for (const c of COMBO) Object.assign(c, { hits: 0, dmg: 0, last: null, best: null, t: 0 });
    if (o.settleCam && typeof stepFx === 'function') for (let k = 0; k < 240; k++) stepFx();
    def = Object.assign({}, o.def || {}); dt = 0; return [f, v];
  };
  const parse = s => { const p = s.split(':'); return [p[0], p[1] === undefined ? undefined : isNaN(+p[1]) ? p[1] : +p[1], p[2] === undefined ? undefined : isNaN(+p[2]) ? p[2] : +p[2]]; };
  /* Runs the route. Returns what the counter showed, the hits in order, and whether and when the opponent was KO'd.
     each(t) is called after every frame (the recorder draws there). */
  FL.run = function (route, o, each) {
    route = [].concat(...route.map(r => r.split('+')));
    const [f, v] = FL.setup(o); let k = 0, idx = 0, act = null, arg, arg2, best = 0, dmg = 0, prev = 0, ko = false, koT = -1, koHits = 0, chainKO = false, kos0 = f.kos, startPct = v.pct, log = [], resets = 0, selfKO = false, stocks0 = f.stocks;
    const next = () => { if (idx < route.length) { const [n, a1, a2] = parse(route[idx++]); act = A[n]; if (!act) throw new Error('no action ' + n); act.n = n; arg = a1; arg2 = a2; } else act = null; k = 0; };
    next();
    script = () => { const i = blankIn(); if (act) act.inp(i, k, f, v, arg, arg2); return i; };
    const lead = o.lead || 4; let tail = o.tail || 60; const hitN = { n: 0 };
    let lastPct = v.pct, endInfo = null;
    for (let t = 0; t < (o.maxFrames || 900); t++) {
      if (t < lead) { const s = script; script = () => blankIn(); step(); script = s; if (each) each(t); continue; }
      step(); k++; if (each) each(t);
      const c = COMBO[0];
      if (v.pct > lastPct + 1e-6) { log.push({ t, d: +(v.pct - lastPct).toFixed(2), chain: c.hits, by: f.mname, st: f.state, fi: f.fi, proj: f.state !== 'attack' }); lastPct = v.pct; }
      if (c.hits > best) { best = c.hits; dmg = c.dmg; } const was = prev; if (c.hits < prev && prev > 0 && !(f.kos > kos0) && act) resets++; prev = c.hits;
      if (f.kos > kos0 && !ko) { ko = true; koT = t; koHits = c.hits || was; chainKO = ((c.hits || 0) > 0 || was > 0) && !resets; }
      if (f.stocks < stocks0) selfKO = true;
      if (act) {
        const wantGround = act.ground && !f.grounded, wantAir = act.air && f.grounded;
        const mn = /^(sh|fh)_/.test(act.n) && arg !== undefined ? Math.max(act.min || 2, arg + 2) : (act.min || 2);
        const done = act.done ? (k >= (act.min || 1) && act.done(f)) || k >= (act.max || 70) : act.n === 'wait' || act.n === 'drift' || act.n === 'flyfor' ? k >= (arg || 1) : (k >= mn && actionable(f)) || k >= (act.max || 70);
        if (done) { if (idx >= route.length) { endInfo = { alive: (COMBO[0].hits || 0) > 0, adv: v.state === 'hurt' ? v.hitstun - v.sf : v.hitlag > 0 ? 99 : 0, g: f.grounded, fly: !!f.flying, fi: f.fi, t }; } next(); }
      } else if (tail-- <= 0) break;
    }
    script = null;
    const c = COMBO[0], final = c.best || { hits: 0, dmg: 0 };
    return { hits: Math.max(final.hits, best), dmg: +Math.max(final.dmg, dmg).toFixed(1), ko, koT, koHits, chainKO, selfKO, resets, startPct, endPct: +v.pct.toFixed(1), endX: +v.x.toFixed(0), endY: +v.y.toFixed(0), fx: +f.x.toFixed(0), fy: +f.y.toFixed(0), fi: f.fi, end: endInfo, log };
  };

  /* ---- step by step, with snapshots (for deep searches): begin, then act() one action at a time; save()/load() branch ---- */
  let cur = null;   /* the action now running for act() */
  FL.begin = function (o) {
    const [f, v] = FL.setup(o); cur = null;
    script = () => { const i = blankIn(); if (cur) cur.a.inp(i, cur.k, f, v, cur.arg, cur.arg2); return i; };
    for (let t = 0; t < (o.lead || 4); t++) step();
    return [f, v];
  };
  FL.save = () => ({ n: NET.save(), def: Object.assign({}, def), dt });
  FL.load = s => { NET.load(s.n); def = Object.assign({}, s.def); dt = s.dt; };
  /* Runs one action from where the match stands. Returns { hits (the counter now), alive, ko, chainKO, t (frames), g, fly, fi } */
  FL.act = function (name) {
    const f = F[0], v = F[1], [n, a1, a2] = parse(name), a = A[n]; if (!a) throw new Error('no action ' + n);
    cur = { a, k: 0, arg: a1, arg2: a2 }; const kos0 = f.kos, st0 = f.stocks; let ko = false, chainKO = false, t = 0, prevHits = COMBO[0].hits || 0, maxHits = prevHits, broke = false;
    for (;;) {
      step(); cur.k++; t++;
      const c = COMBO[0]; if ((c.hits || 0) > maxHits) maxHits = c.hits;
      if ((c.hits || 0) < prevHits && !(f.kos > kos0)) broke = true;
      if (f.kos > kos0) { ko = true; chainKO = !broke && ((c.hits || 0) > 0 || prevHits > 0); break; }
      prevHits = c.hits || 0;
      if (f.stocks < st0) break;
      const k = cur.k;
      const mn = /^(sh|fh)_/.test(n) && a1 !== undefined ? Math.max(a.min || 2, a1 + 2) : (a.min || 2);
      const done = a.done ? (k >= (a.min || 1) && a.done(f)) || k >= (a.max || 70) : n === 'wait' || n === 'drift' || n === 'flyfor' ? k >= (a1 || 1) : (k >= mn && actionable(f)) || k >= (a.max || 70);
      if (done) break;
    }
    cur = null; const c = COMBO[0];
    return { hits: c.hits || 0, maxHits, broke, dmg: +(c.dmg || 0).toFixed(1), alive: (c.hits || 0) > 0, ko, chainKO, selfKO: f.stocks < st0, t, g: f.grounded, fly: !!f.flying, fi: f.fi, pct: +v.pct.toFixed(1), vs: v.state, vx: +v.x.toFixed(1), vy: +v.y.toFixed(1) };
  };
  /* Lets go of everything until the combo ends: did the last hit carry them out as part of the chain? */
  FL.settle = function (max) {
    const f = F[0], kos0 = f.kos; let prev = COMBO[0].hits || 0;
    for (let t = 0; t < (max || 200); t++) { step(); const h = COMBO[0].hits || 0; if (f.kos > kos0) return { ko: true, chainKO: prev > 0 || h > 0, t }; if (h === 0 && prev > 0) return { ko: false, t }; prev = h; }
    return { ko: false, t: max };
  };
  /* Every way the defender can fight a route: 9 DI x 5 SDI x the hitstun cancels. */
  FL.DEFS = (function () { const out = []; for (const di of ['none', 'in', 'out', 'up', 'down', 'upin', 'upout', 'downin', 'downout']) for (const sdi of ['none', 'in', 'out', 'up', 'down']) for (const esc of ['none', 'ad', 'jumpaway']) out.push({ di, sdi, esc }); return out; })();
  FL.QUICK = [{ di: 'none' }, { di: 'in' }, { di: 'out' }, { di: 'up' }, { di: 'down' }, { di: 'upout', sdi: 'up', esc: 'ad' }, { di: 'downin', sdi: 'down', esc: 'jumpaway' }, { di: 'out', sdi: 'out', esc: 'ad' }, { di: 'in', sdi: 'in', esc: 'jumpaway' }];
  /* The worst the defender can do to a route: the least hits chained and whether a KO still lands as part of the chain. */
  FL.verify = function (route, o, defs) {
    let worst = null;
    for (const d of defs || FL.DEFS) { const r = FL.run(route, Object.assign({}, o, { def: d })); const score = r.hits * 10 + (r.chainKO ? 1000 : 0);
      if (!worst || score < worst.score) worst = { score, def: d, hits: r.hits, dmg: r.dmg, ko: r.ko, chainKO: r.chainKO }; }
    return worst;
  };
  if (typeof window !== 'undefined') window.FL = FL; else globalThis.FL = FL;
})();
