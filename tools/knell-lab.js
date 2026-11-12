// Knell lab: drives Knell through scripted routes inside the real game (the training room, Knell against any fighter) and reads
// the game's own true-combo counter (COMBO), his Thread, the Hinge and the slow. Loaded after sim.js and net.js: in node by
// tools/knell-search.js, in the browser by tools/knell-record.js. It changes nothing in the game: it only supplies inputs (by
// wrapping cpuInput, for both fighters) and reads state.
//
// A route is a list of tokens, pressed in order. Each waits until it is legal (frame-perfect: the first frame it is; with `late`
// that many frames later, the way a person is late) and then presses what a player would press. An attack token is over once
// its move has made contact (or has ended without any), so the next token is timed from the contact.
//   ground   jab jab2 jab3 ftilt ftiltH ftiltL utilt dtilt fsmash usmash dsmash dash grab_f grab_b grab_u grab_d
//            nspec nspecH nspecL sspec dspec uspecG   sh fh (short hop, full hop: the jump press only)  run wd_f wd_b
//   air      nair fair fairH fairL bair uair dair dj ff ad_n ad_f ad_b ad_d ad_df ad_db ad_u sspecA nspecA dspecA uspec uspec_f uspec_b
//   Hinge    hf hb hu (special + the stick forward, back or up, inside the window after contact and after hitlag; costs a Thread)
//   other    w<n> (wait n frames)  d+ d- d0 (from now on drift toward the opponent, away, or not at all)
// Defenders (F[1]): KLAB.defender({ di, sdi, esc }): di one of n in out up down ui uo di do (held while hurt, relative to Knell),
// sdi one of the same (a fresh flick on every other hitlag frame), esc one of none jump ad atk shield all (mashed every other
// frame, so the game's buffer always holds a press the moment one is allowed). 'cpu9' is the game's own CPU at level 9.
(function () {
  const KL = {};
  const KI = () => ROSTER.findIndex(d => d.name === 'Knell');
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
  const free = f => !!FREE[f.state];
  /* after a Hinge, Knell may attack from frame 5 (9 after a shielded hit) */
  const hingeReady = f => f.state === 'attack' && (f.mname === 'hinge' ? f.mf >= 4 : f.mname === 'hingeS' ? f.mf >= 8 : false);
  /* the Hinge itself: contact made, hitlag over (a press during hitlag runs out of buffer), inside the window, a Thread to spend */
  const hingeable = f => f.state === 'attack' && f.hitlag <= 0 && f.move && f.move.hinge && f.knC && f.mf + 1 >= f.move.hinge[0] && f.mf + 1 <= f.move.hinge[1] && f.thread > 0;
  const jabNext = (f, nm) => f.state === 'attack' && f.mname === nm && f.hitlag <= 0 && f.move.chain && f.mf + 1 >= f.move.chain && f.mf + 1 <= (f.move.chainEnd || 99);
  const gOK = f => f.grounded && (free(f) || hingeReady(f));
  const aOK = f => !f.grounded && (free(f) || hingeReady(f));
  /* an attack token is over when the move it started has made contact, or has ended, or after 90 frames */
  const atkDone = (k, f, e) => k > 90 || (f.knAct !== e.a0 && (f.knC || f.state !== 'attack' || (k > 2 && f.knAct !== e.a1)));
  const A = {};
  const atk = (ok, set, press) => ({ atk: 1, ok, inp(i, k, f, o, e) { if (k === 0) { e.a0 = f.knAct; e.a1 = -1; } if (k === 1) e.a1 = f.knAct; if (k < (press || 3)) set(i, f, o, k); }, done: atkDone });
  A.jab = atk(gOK, (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.jab2 = atk(f => jabNext(f, 'jab'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.jab3 = atk(f => jabNext(f, 'jab2'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  /* tilts: the main stick part way (no smash flick) and attack; the aimed forward tilts lean the stick up or down */
  const tilt = (lx, ly) => atk(gOK, (i, f, o, k) => { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.atk = true; });
  A.ftilt = tilt(0.6, 0); A.ftiltH = tilt(0.6, 0.32); A.ftiltL = tilt(0.6, -0.32); A.utilt = tilt(0, 0.6); A.dtilt = tilt(0, -0.6);
  /* smashes: attack and special together, with the stick */
  const smash = (lx, ly) => atk(gOK, (i, f, o, k) => { i.lx = lx * toward(f, o); i.ly = ly; if (k === 0) { i.atk = true; i.spc = true; } }, 1);
  A.fsmash = smash(1, 0); A.usmash = smash(0, 1); A.dsmash = smash(0, -1);
  A.dash = { atk: 1, ok: f => f.grounded && free(f), inp(i, k, f, o, e) { i.lx = toward(f, o); if (k === 0) { e.p = 0; e.a0 = f.knAct; e.a1 = -1; } if (!e.p && k >= 7 && (f.state === 'run' || f.state === 'dash')) { i.atk = true; e.p = 1; } if (e.p === 1 && f.state === 'attack') { e.p = 2; e.a1 = f.knAct; } },
    done: (k, f, e) => k > 90 || (e.p === 2 && f.knAct !== e.a0 && (f.knC || f.state !== 'attack')) };
  A.run = { ok: f => f.grounded && free(f), inp(i, k, f, o) { i.lx = toward(f, o); }, done: k => k >= 10 };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ok: f => f.grounded && free(f), inp(i, k, f, o) { if (k === 0) { f.face = toward(f, o); i.grb = true; }
    if (f.state === 'hold' && f.sf > 1) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } },
    done: (k, f) => (k > 3 && f.state !== 'hold' && f.state !== 'throw' && f.state !== 'attack') || (f.state === 'throw' && f.sf > 0 && F[1].state === 'hurt') || k > 90 };
  const spec = (ok, lx, ly, n) => atk(ok, (i, f, o, k) => { if (k === 0) i.spc = true; i.lx = lx * toward(f, o); i.ly = ly; }, n || 3);
  A.nspec = spec(gOK, 0, 0); A.nspecH = spec(gOK, 0, 0.4); A.nspecL = spec(gOK, 0, -0.4); A.sspec = spec(gOK, 1, 0); A.dspec = spec(gOK, 0, -1);
  A.nspecA = spec(aOK, 0, 0); A.nspecAH = spec(aOK, 0, 0.4); A.nspecAL = spec(aOK, 0, -0.4); A.sspecA = spec(aOK, 1, 0); A.dspecA = spec(aOK, 0, -1);
  A.uspec = spec(aOK, 0, 1, 20); A.uspec_f = spec(aOK, 0.6, 1, 20); A.uspec_b = spec(aOK, -0.6, 1, 20); A.uspecG = spec(gOK, 0, 1, 20);
  /* jumps: sh releases at once, fh holds the button */
  A.sh = { ok: f => f.grounded && (free(f) || hingeReady(f)), inp(i, k) { if (k === 0) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 1) || k > 20 };
  A.fh = { ok: f => f.grounded && (free(f) || hingeReady(f)), inp(i, k) { if (k < 10) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 6) || k > 20 };
  A.dj = { ok: f => !f.grounded && (free(f) || hingeReady(f)) && f.jumps > 0, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  /* aerials: the main stick and attack; the aimed forward airs lean it */
  const aer = (sx, sy) => atk(aOK, (i, f, o, k) => { i.lx = sx * f.face; i.ly = sy; if (k === 0) i.atk = true; });
  A.nair = aer(0, 0); A.fair = aer(1, 0); A.fairH = aer(1, 0.4); A.fairL = aer(1, -0.4); A.bair = aer(-1, 0); A.uair = aer(0, 1); A.dair = aer(0, -1);
  /* the Hinge: special with the stick held in its direction until it starts */
  const hinge = (lx, ly) => ({ ok: hingeable, inp(i, k, f) { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.spc = true; }, done: (k, f) => f.mname === 'hinge' || f.mname === 'hingeS' || k > 6 });
  A.hf = hinge(1, 0); A.hb = hinge(-1, 0); A.hu = hinge(0, 1);
  A.ff = { ok: f => !f.grounded && f.vy <= 0 && (free(f) || f.state === 'attack'), inp(i, k) { if (k === 0) i.ly = -1; }, done: (k, f) => k >= 1 };
  for (const [nm, dx, dy] of [['ad_n', 0, 0], ['ad_f', 1, 0], ['ad_b', -1, 0], ['ad_d', 0, -1], ['ad_df', 0.7, -0.7], ['ad_db', -0.7, -0.7], ['ad_u', 0, 1]])
    A[nm] = { ok: f => !f.grounded && free(f), inp(i, k, f) { i.shd = k === 0; i.lx = dx * f.face; i.ly = dy; }, done: k => k >= 2 };
  for (const [nm, dx] of [['wd_f', 1], ['wd_b', -1]]) A[nm] = { ok: f => f.grounded && free(f), inp(i, k, f) { if (k === 0) i.jmp = true; if (k >= 3) { i.shd = k === 3; i.lx = dx * f.face; i.ly = -0.6; } }, done: (k, f) => (k >= 6 && f.grounded) || k > 30 };
  KL.A = A;
  const WAIT = {};
  const tok = t => { if (/^w\d+$/.test(t)) { if (!WAIT[t]) { const n = +t.slice(1); WAIT[t] = { ok: () => true, inp() {}, done: k => k >= n, wait: 1 }; } return WAIT[t]; } return A[t]; };
  KL.tok = tok;

  /* ---- the executor: where Knell is in his route. A plain object, so a search can copy it with a game snapshot. ---- */
  KL.exec = (toks, o) => ({ toks: toks.slice(), idx: 0, cur: null, k: -1, wait: 0, holdT: 0, drift: 1, failed: -1, late: o && o.late, patience: (o && o.patience) || 120, a0: 0, a1: 0, p: 0 });
  const lateOf = (e, j) => typeof e.late === 'function' ? e.late(j) : typeof e.late === 'number' ? e.late : 0;
  function nextTok(e) {
    while (e.idx < e.toks.length) {
      const t = e.toks[e.idx++];
      if (t === 'd+' || t === 'd-' || t === 'd0') { e.drift = t === 'd+' ? 1 : t === 'd-' ? -1 : 0; continue; }
      if (!tok(t)) throw new Error('unknown token ' + t);
      e.cur = t; e.k = -1; e.wait = lateOf(e, e.idx - 1); e.holdT = 0; return;
    }
    e.cur = null;
  }
  KL.input = function (e, f, o) {
    const i = blankIn();
    if (e.drift && !f.grounded) { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * e.drift : 0; }
    if (e.cur === null && e.idx < e.toks.length) nextTok(e);
    if (e.cur !== null) {
      const a = tok(e.cur);
      if (e.k < 0) { if (a.ok(f, o)) { if (e.wait > 0) e.wait--; else e.k = 0; } else if (++e.holdT > e.patience) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; } }
      if (e.cur !== null && e.k >= 0) a.inp(i, e.k, f, o, e);
    }
    return i;
  };
  /* after the frame: count the token on, and move to the next once it is done. Returns true if a token finished. */
  KL.after = function (e, f) {
    if (e.cur === null || e.k < 0) return false;
    e.k++; if (tok(e.cur).done(e.k, f, e)) { e.cur = null; e.k = -1; if (e.idx < e.toks.length) nextTok(e); return true; }
    return false;
  };
  KL.finished = e => e.cur === null && e.idx >= e.toks.length;

  /* ---- the defender ---- */
  const DIV = { n: [0, 0], in: [1, 0], out: [-1, 0], up: [0, 1], down: [0, -1], ui: [0.7, 0.7], uo: [-0.7, 0.7], di: [0.7, -0.7], do: [-0.7, -0.7] };
  KL.DIS = Object.keys(DIV);
  KL.defender = function (d) {
    d = d || {};
    const fn = function (v, a) {
      const i = blankIn(), tw = sgn(a.x - v.x) || 1, dv = DIV[d.di || 'n'];
      if (d.gate && !COMBO[0].hits && !(v.hitlag > 0) && v.state !== 'hurt') return i;   /* gate: stand still until the first hit lands (escapes are tested inside the combo, not against the opener) */
      const hurt = v.state === 'hurt' || v.hitlag > 0 || v.state === 'held';
      if (hurt) { i.lx = dv[0] * tw; i.ly = dv[1]; }
      if (d.sdi && v.hitlag > 0) { if (frame % 2) { const s = DIV[d.sdi]; i.lx = s[0] * tw; i.ly = s[1]; } else { i.lx = 0; i.ly = 0; } }
      const e = d.esc || 'none';
      if (e !== 'none') {
        const pick = e === 'all' ? ['jmp', 'shd', 'atk'][Math.floor(frame / 2) % 3] : { jump: 'jmp', ad: 'shd', atk: 'atk', shield: 'shd' }[e];
        if (frame % 2 === 0) i[pick] = true;   /* a fresh press every other frame */
        if (v.state === 'held') { i.atk = frame % 2 === 0; i.jmp = frame % 2 === 1; i.lx = frame % 4 < 2 ? 1 : -1; }
        if (pick === 'shd' && !hurt && v.grounded) i.shd = true;
        if (pick === 'shd' && !v.grounded && !(v.hitlag > 0)) { i.lx = -tw; i.ly = 0.5; }   /* the air dodge away and up */
        if (pick === 'jmp' && !(v.hitlag > 0) && v.state !== 'hurt') i.lx = -tw;   /* jump away */
      }
      return i;
    };
    fn.desc = (d.di || 'n') + (d.sdi ? '/sdi-' + d.sdi : '') + (d.esc && d.esc !== 'none' ? '/' + d.esc : '');
    return fn;
  };

  /* ---- inputs for both fighters ---- */
  let orig = null; KL.kIn = null; KL.vIn = null;
  function input(f, o, m) {
    if (f === F[0] && KL.kIn) return KL.kIn(f, o);
    if (f === F[1] && KL.vIn) { if (KL.vIn === 'cpu9') { f.ctl.ai.lv = 9; return orig(f, o, m); } return KL.vIn(f, o); }
    return orig(f, o, m);
  }
  KL.install = function () { if (!orig) { orig = cpuInput; cpuInput = input; } };

  /* ---- a situation ----
     o: foe [roster index, form], pct, kPct, x0 (Knell), dist (opponent ahead of him), foeAir (the opponent this high), foeFace,
     thread (Knell's Thread to start with; 0 unless said), stage, plat 'foe' (the opponent on the left platform) */
  KL.setup = function (o) {
    KL.install(); TRAINING = true; if (o.stage !== undefined && typeof OPT !== 'undefined') OPT.stage = o.stage;
    slots[0] = { dev: 'kb', pick: KI(), ready: true }; slots[1] = { dev: 'kb', pick: o.foe ? o.foe[0] : 0, ready: true }; startMatch();
    mode = 'play'; countdown = 0;
    const f = F[0], v = F[1]; f.ctl = new Ctl('cpu'); v.ctl = new Ctl('cpu'); if (o.foe && o.foe[1]) v.fi = o.foe[1]; v.noSwap = true;
    f.x = o.x0 !== undefined ? o.x0 : -20; v.x = f.x + (o.dist !== undefined ? o.dist : 9);
    if (o.plat === 'foe') { const q = PLATS[1]; v.x = (q.x0 + q.x1) / 2; v.y = q.y; v.plat = q; v.grounded = true; f.x = v.x - (o.dist || 9); }
    if (o.foeAir) { v.y = o.foeAir; v.grounded = false; v.plat = null; v.set('air'); }
    f.face = sgn(v.x - f.x) || 1; v.face = o.foeFace || -f.face; v.pct = o.pct || 0; f.pct = o.kPct || 0; f.invuln = v.invuln = 0; PROJ.length = 0;
    f.thread = o.thread || 0;
    for (const c of COMBO) Object.assign(c, { hits: 0, dmg: 0, last: null, best: null, t: 0 });
    if (o.settleCam && typeof stepFx === 'function') for (let k = 0; k < 240; k++) stepFx();
    return [f, v];
  };

  /* A watch on one run: the counter, KO, Thread, Hinges, every hit. Call w.frame() after each step. */
  KL.watch = function () {
    const f = F[0], v = F[1];
    const w = { best: 0, dmg: 0, prev: COMBO[0].hits, resets: 0, firstReset: -1, ko: false, koT: -1, koHits: 0, koHurt: false, kos0: f.kos, hinges: 0, maxThread: f.thread, log: [], t: 0, lastHit: -1, slowed: 0 };
    w.frame = function () {
      const c = COMBO[0];
      if (c.hits > w.prev) { w.log.push({ t: w.t, mv: f.mname, pct: +v.pct.toFixed(1), thr: f.thread, hits: c.hits }); w.lastHit = w.t; }
      if (c.hits > w.best) { w.best = c.hits; w.dmg = +c.dmg.toFixed(1); }
      if (c.hits < w.prev && w.prev > 0 && !w.ko) { w.resets++; if (w.firstReset < 0) w.firstReset = w.t; }
      w.prev = c.hits;
      if ((f.mname === 'hinge' || f.mname === 'hingeS') && f.state === 'attack' && f.mf === 1) w.hinges++;
      if (v.slowT > 0) w.slowed++;
      w.maxThread = Math.max(w.maxThread, f.thread);
      if (f.kos > w.kos0 && !w.ko) { w.ko = true; w.koT = w.t; w.koHits = c.hits || (c.last ? c.last.hits : 0); w.koHurt = w.vState === 'hurt'; }
      w.vState = v.state; w.t++;
    };
    return w;
  };

  /* Runs a whole route from a fresh situation. o.def: the defender. o.late: frames late per token. each(t, f, v) after every frame. */
  KL.run = function (route, o, each) {
    if (typeof route === 'string') route = route.split(/\s+/).filter(Boolean);
    const [f, v] = KL.setup(o);
    const e = KL.exec(route, o); KL.kIn = (ff, oo) => KL.input(e, ff, oo); KL.vIn = o.def || (() => blankIn());
    const lead = o.lead || 2; for (let t = 0; t < lead; t++) { const s = KL.kIn; KL.kIn = () => blankIn(); step(); KL.kIn = s; if (each) each(-1, f, v); }
    const w = KL.watch(), maxF = o.maxFrames || 1500; let tail = o.tail || 60;
    for (let t = 0; t < maxF; t++) {
      step(); KL.after(e, f); w.frame(); if (each) each(t, f, v);
      if (w.ko && w.t - w.koT > (o.koTail || 10)) break;
      if (KL.finished(e) && tail-- <= 0) break;
    }
    KL.kIn = null; KL.vIn = null;
    return { hits: w.best, dmg: w.dmg, ko: w.ko, koT: w.koT, koHits: w.koHits, koHurt: w.koHurt, resets: w.resets, firstReset: w.firstReset, hinges: w.hinges, thread: f.thread, maxThread: w.maxThread,
      startPct: o.pct || 0, endPct: +v.pct.toFixed(1), vx: +v.x.toFixed(1), vy: +v.y.toFixed(1), kx: +f.x.toFixed(1), ky: +f.y.toFixed(1), frames: w.t, failedAt: e.failed, done: KL.finished(e) && e.failed < 0, log: w.log };
  };
  if (typeof window !== 'undefined') window.KLAB = KL; else globalThis.KLAB = KL;
})();
