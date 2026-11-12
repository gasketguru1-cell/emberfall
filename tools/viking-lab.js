// Viking lab: the route tokens for Fyrdsman the Ashbound (the Viking axe fighter), on top of tools/knell-lab.js (its executor,
// defenders, watch and run, with o.me = his roster index). Loaded after knell-lab.js: in node by tools/viking-search.js and
// tools/viking-verify.js, in the browser by tools/viking-record.js. Testing only: it changes nothing in the game. Every token only
// presses buttons and sticks, and the axe is only ever placed by a real throw.
//
// A move token is over once its move has made contact (the game's own combo counter went up, or the opponent is in hitlag) or has
// ended without any; the next token is then pressed on the first frame the game allows it.
//   ground  jab ftilt utilt dtilt fsmash usmash dsmash (smash: attack with the stick and the smash flag, never attack + special,
//           which is Berserker) dash grab_f grab_b grab_u grab_d throw (neutral special: the axe throw) sspec dspec uspecG
//           sh fh run wd_f wd_b bz (attack and special on one frame: Berserker on or off) wf<n> wb<n> (walk n frames toward/away)
//   air     nair fair bair uair dair dj ff ad_n ad_f ad_b ad_d ad_df ad_db ad_u throwA sspecA dspecA uspec uspec_f uspec_b bzA
//   axe     rc (special pressed and held 10 frames: the recall, with the beckon if he is free) hs (from now on special is held
//           10 frames, whatever he is doing: a recall started inside another move) wstuck (wait until the axe is stuck) wret (until the
//           homing or recalled axe has hit something or is home)
//           wax<n> (wait until the axe is within n units of the opponent) wpast (wait until the opponent is between him and the axe,
//           in x) sspecR uspecR (the special pressed and kept held: the recall fires 8 frames into it)
//   other   w<n> d+ d- d0 (as in knell-lab)
// Setup extras (VLAB.setup): o.axe = { from: x, air: height (0 = from the floor), face: 1 | -1 } throws the axe for real from there
// (his real throw, run on the axe's own physics until it sticks or 400 frames pass) before the situation starts; o.bz = true starts
// him in Berserker (the toggle move run for real); o.human = true gives him a person's controller (B-reverse allowed).
(function () {
  const KL = typeof window !== 'undefined' ? window.KLAB : globalThis.KLAB, A = KL.A;
  const VL = {}; VL.ME = ROSTER.findIndex(d => d.name === 'Fyrdsman');
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
  const ready = f => !!FREE[f.state];
  const gOK = f => f.grounded && ready(f), aOK = f => !f.grounded && ready(f);
  const axe = f => f.axeAway && f.axe ? f.axe : null;
  VL.axe = axe;
  /* ---- a move token (as in tools/sack-lab.js) ---- */
  const mv = (ok, set, press) => ({ atk: 1, ok, inp(i, k, f, o, e) { if (k === 0) { e.h0 = COMBO[0].hits; e.m0 = f.move; e.f0 = f.mf; e.st = 0; } if (k < (press || 3)) set(i, f, o, k); },
    done(k, f, e) { if (k > 90) return true;
      if (!e.st && f.state === 'attack' && (f.move !== e.m0 || f.mf < e.f0 || k > 1 && f.mf <= 2)) { e.st = 1; e.ms = f.move; }
      if (!e.st && (f.state === 'hold' || f.state === 'throw' || f.state === 'land' && k > 1)) e.st = 2;
      const hit = COMBO[0].hits > e.h0 || F[1].hitlag > 0 || F[1].state === 'held';
      return e.st ? hit || f.state !== 'attack' && f.state !== 'hold' && f.state !== 'throw' || e.st === 1 && f.move !== e.ms : k > 12 && hit; } });
  A.jab = mv(gOK, (i, f, o, k) => { if (k === 0) i.atk = true; });
  const tilt = (lx, ly) => mv(gOK, (i, f, o, k) => { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.atk = true; });
  A.ftilt = tilt(0.6, 0); A.utilt = tilt(0, 0.6); A.dtilt = tilt(0, -0.6);
  /* smashes: the stick and attack with the smash flag (a C-stick-style smash); attack + special would be Berserker */
  const smash = (lx, ly) => mv(gOK, (i, f, o, k) => { i.lx = lx * toward(f, o); i.ly = ly; i.sm = true; if (k === 0) i.atk = true; }, 2);
  A.fsmash = smash(1, 0); A.usmash = smash(0, 1); A.dsmash = smash(0, -1);
  A.dash = { atk: 1, ok: gOK, inp(i, k, f, o, e) { i.lx = toward(f, o); if (k === 0) { e.p = 0; e.h0 = COMBO[0].hits; } if (!e.p && k >= 7 && (f.state === 'run' || f.state === 'dash')) { i.atk = true; e.p = 1; } if (e.p === 1 && f.state === 'attack') { e.p = 2; e.ms = f.move; } },
    done: (k, f, e) => k > 90 || (e.p === 2 && (COMBO[0].hits > e.h0 || F[1].hitlag > 0 || f.state !== 'attack')) };
  A.run = { ok: gOK, inp(i, k, f, o) { i.lx = toward(f, o); }, done: k => k >= 10 };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ok: gOK, inp(i, k, f, o) { if (k === 0) i.grb = true;
    if (f.state === 'hold' && f.sf > 1) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } },
    done: (k, f) => (k > 3 && f.state !== 'hold' && f.state !== 'throw' && f.state !== 'attack') || (f.state === 'throw' && f.sf > 0 && F[1].state === 'hurt') || k > 90 };
  const spec = (ok, lx, ly, n, hold) => mv(ok, (i, f, o, k) => { if (k === 0 || (hold && k < hold)) i.spc = true; i.lx = lx * toward(f, o); i.ly = ly; }, Math.max(n || 3, hold || 0));
  /* the throw: the axe leaves on frame 30, so the token is over then (or at contact) */
  const thr = ok => ({ atk: 1, ok: f => ok(f) && !f.axeAway, inp(i, k, f, o, e) { i.lx = 0; i.ly = 0; if (k === 0) { i.spc = true; e.h0 = COMBO[0].hits; } },   /* the stick centred, or the air drift would make it Side-B */
    done: (k, f, e) => k > 80 || f.axeAway && (f.state !== 'attack' || f.mf >= 31) || COMBO[0].hits > e.h0 });
  A.throw = thr(gOK); A.throwA = thr(aOK); A.nspec = A.throw; A.nspecA = A.throwA;
  A.sspec = spec(gOK, 1, 0); A.sspecA = spec(aOK, 1, 0); A.dspec = spec(gOK, 0, -1); A.dspecA = spec(aOK, 0, -1);
  A.sspecR = spec(f => ready(f), 1, 0, 3, 11); A.uspecR = spec(aOK, 0, 1, 20, 11);
  A.uspec = spec(aOK, 0, 1, 20); A.uspec_f = spec(aOK, 0.6, 1, 20); A.uspec_b = spec(aOK, -0.6, 1, 20); A.uspecG = spec(gOK, 0, 1, 20);
  /* Berserker: attack and special on the same frame */
  const bz = ok => ({ ok, inp(i, k) { if (k === 0) { i.atk = true; i.spc = true; } }, done: (k, f) => k >= 2 && !(f.state === 'attack' && f.mname === 'berserk') || k > 14 });
  A.bz = bz(gOK); A.bzA = bz(aOK);
  /* the recall: special pressed and held; over once the axe is coming home (or 14 frames) */
  A.rc = { ok: f => { const p = axe(f); return !!p && (p.st === 'fly' || p.st === 'stuck') && !f.ctl.c.spc; }, inp(i, k) { if (k < 10) i.spc = true; if (k < 2) { i.lx = 0; i.ly = 0; } }, done: (k, f) => k >= 10 || (k > 1 && !(axe(f) && (axe(f).st === 'fly' || axe(f).st === 'stuck'))) };
  A.hs = { ok: () => true, inp(i, k, f, o, e) { if (k === 0) e.hs = 10; }, done: k => k >= 1 };
  A.wstuck = { ok: () => true, inp() {}, done: (k, f) => k > 400 || !axe(f) || axe(f).st === 'stuck', wait: 1 };
  A.wret = { ok: () => true, inp() {}, done: (k, f) => k > 300 || !axe(f) || (axe(f).st !== 'home' && axe(f).st !== 'recall') || axe(f).ghost, wait: 1 };   /* wait until the homing or recalled axe has hit (or is home) */
  A.wpast = { ok: () => true, inp() {}, done: (k, f) => { const p = axe(f), v = F[1]; return k > 300 || !p || sgn(v.x - f.x) === sgn(p.x - v.x); }, wait: 1 };
  /* jumps */
  A.sh = { ok: gOK, inp(i, k) { if (k === 0) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 1) || k > 20 };
  A.fh = { ok: gOK, inp(i, k) { if (k < 10) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 6) || k > 20 };
  A.dj = { ok: f => aOK(f) && f.jumps > 0, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  const aer = (sx, sy) => mv(aOK, (i, f, o, k) => { i.lx = sx * f.face; i.ly = sy; if (k === 0) i.atk = true; });
  A.nair = aer(0, 0); A.fair = aer(1, 0); A.bair = aer(-1, 0); A.uair = aer(0, 1); A.dair = aer(0, -1);
  A.ff = { ok: f => !f.grounded && f.vy <= 0 && (ready(f) || f.state === 'attack'), inp(i, k) { if (k === 0) i.ly = -1; }, done: k => k >= 1 };
  for (const [nm, dx, dy] of [['ad_n', 0, 0], ['ad_f', 1, 0], ['ad_b', -1, 0], ['ad_d', 0, -1], ['ad_df', 0.7, -0.7], ['ad_db', -0.7, -0.7], ['ad_u', 0, 1]])
    A[nm] = { ok: aOK, inp(i, k, f) { i.shd = k === 0; i.lx = dx * f.face; i.ly = dy; }, done: k => k >= 2 };
  for (const [nm, dx] of [['wd_f', 1], ['wd_b', -1]]) A[nm] = { ok: gOK, inp(i, k, f) { if (k === 0) i.jmp = true; if (k >= 3) { i.shd = k === 3; i.lx = dx * f.face; i.ly = -0.6; } }, done: (k, f) => (k >= 6 && f.grounded) || k > 30 };
  A.turn = { ok: gOK, inp(i, k, f) { if (k === 0) i.lx = -f.face * 0.5; }, done: k => k >= 2 };
  /* parameterised tokens: wf<n> wb<n> walk, rf<n> rb<n> run, wax<n> */
  const P = {};
  const tokP = t => { let m;
    if (P[t]) return P[t];
    if ((m = /^(w|r)(f|b)(\d+)$/.exec(t))) { const n = +m[3], s = m[1] === 'w' ? 0.5 : 1, d = m[2] === 'f' ? 1 : -1; return P[t] = { ok: gOK, inp(i, k, f, o) { i.lx = s * d * toward(f, o); }, done: k => k >= n }; }
    if ((m = /^wax(\d+)$/.exec(t))) { const n = +m[1]; return P[t] = { ok: () => true, inp() {}, wait: 1, done: (k, f) => { const p = axe(f), v = F[1]; return k > 300 || !p || Math.hypot(p.x - v.x, p.y - (v.y + v.st.h / 2)) < n; } }; }
    return undefined; };
  const tok0 = KL.tok;
  KL.tok = t => tok0(t) || tokP(t);
  for (const t of ['wf', 'wb', 'rf', 'rb']) for (const n of [2, 4, 6, 8, 10, 12, 16, 20, 30, 40]) A[t + n] = tokP(t + n);   /* for a knell-lab whose tok reads A only */
  for (const n of [4, 6, 8, 10, 12, 15, 20, 25, 30, 40]) A['wax' + n] = tokP('wax' + n);
  /* a held special running beside the route (hs) */
  const in0 = KL.input;
  KL.input = function (e, f, o) { const i = in0(e, f, o); if (e.hs > 0) { if (e.hs >= 9 && !i.spc) { i.lx = 0; i.ly = 0; } i.spc = true; e.hs--; } return i; };   /* the press itself with the stick centred */
  /* ---- the situation: knell-lab's, plus a real axe throw beforehand, Berserker and a person's controller ---- */
  const setup0 = KL.setup;
  VL.setup = function (o) {
    const r = setup0(Object.assign({ me: VL.ME }, o)), f = r[0], v = r[1];
    if (o.human) f.ctl.cFall = true;
    if (o.axe) {   /* his real throw (vThrow) from there, flown on the axe's own step until it sticks; then he is put back */
      const x = f.x, y = f.y, fc = f.face, gr = f.grounded, pl = f.plat; f.x = o.axe.from; f.y = o.axe.air || 0; f.face = o.axe.face || fc;
      vThrow(f); const p = f.axe; f.x = x; f.y = y; f.face = fc; f.grounded = gr; f.plat = pl;
      for (let k = 0; k < 400 && p.st === 'fly' && !p.gone; k++) { vAxeStep(p); if (p.y < -150 || Math.abs(p.x) > 260) { p.gone = true; vAxeGone(p); } }
      f.recallArm = true; f.recallN = 0;
    }
    if (o.bz) { const ki = KL.kIn, vi = KL.vIn; KL.kIn = KL.vIn = () => blankIn(); f.startMove('berserk'); for (let k = 0; k < 10 && f.state === 'attack'; k++) step(); KL.kIn = ki; KL.vIn = vi; }
    return r;
  };
  KL.setup = VL.setup; VL.run = KL.run;   /* with this lab loaded, knell-lab's run, knell-search and knell-verify all set up the Viking */
  /* the axe in the search's state signature (tools/knell-search.js reads LABSIG if there is one) */
  globalThis.LABSIG = () => { const p = axe(F[0]); return (p ? p.st[0] + Math.round(p.x / 3) + ':' + Math.round(p.y / 3) : '-') + (F[0].berserk ? 'B' : ''); };
  /* The defender, held early: knell-lab's defender only holds its DI once hurt, but the game reads the stick on the frame the hit
     lands, so a first hit was never DI'd. With pre (the default here) the DI stick is also held whenever a hit may be coming: the
     axe within 16 units of the target, or the Viking attacking within 30, and only while the target is airborne (on the ground the stick
     would walk it out of range or crouch). Buttons still wait for the gate. */
  const def0 = KL.defender, DV = { n: [0, 0], in: [1, 0], out: [-1, 0], up: [0, 1], down: [0, -1], ui: [0.7, 0.7], uo: [-0.7, 0.7], di: [0.7, -0.7], do: [-0.7, -0.7] };
  KL.defender = function (d) {
    d = d || {}; const g = def0(d); if (d.pre === false) return g;
    const fn = function (v, a) { const i = g(v, a); if (v.state === 'hurt' || v.hitlag > 0 || v.state === 'held' || v.grounded) return i;   /* on the ground a held stick walks or crouches, so only an airborne target holds it early */
      const p = axe(a), near = (p && p.st !== 'stuck' && Math.hypot(p.x - v.x, p.y - (v.y + v.st.h / 2)) < 16) || (a.state === 'attack' && Math.abs(a.x - v.x) < 30 && Math.abs(a.y - v.y) < 30);
      if (near) { const tw = sgn(a.x - v.x) || 1, dv = DV[d.di || 'n']; i.lx = dv[0] * tw; i.ly = dv[1]; }
      return i; };
    fn.desc = g.desc + (d.pre === false ? '' : '/pre'); return fn;
  };
  /* the axe's state for a log line */
  VL.axeInfo = f => { const p = axe(f); return p ? { st: p.st, x: +p.x.toFixed(1), y: +p.y.toFixed(1), t: p.t !== undefined ? +p.t.toFixed(2) : null } : null; };
  if (typeof window !== 'undefined') window.VLAB = VL; else globalThis.VLAB = VL;
})();
