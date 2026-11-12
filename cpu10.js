/* Level 10 CPU, as Furious Fowls: it plans.
   At every point where it could act next in a combo (and every few frames in neutral when it is close), it saves the match,
   plays each option it has out ahead of time in that copy (the same step() the game runs, with sounds and effects off, as the
   online rollback does), loads the match back, and takes the option that scored best. In a combo every short-listed option is
   played against four ways the opponent can defend (the stick as they hold it now, DI away, DI toward, and DI away then a
   jump or air dodge out at the first chance) and is judged by its worst result, so it picks the follow-ups that still connect
   whatever they do. How much it plays out per decision is a count of frames, not time, so it plays the same on any machine.
   It presses only buttons and the stick, like a player: nothing here moves a fighter or changes a move. Other fighters at
   level 10 use the normal CPU at level 10's settings. Offline only: in an online match it plays as the normal CPU. */
(function () {
  const sgnd = (v, d) => sgn(v) || d;
  const toward = (f, o) => sgnd(o.x - f.x, f.face);
  const actionable = f => {
    const s = f.state;
    return s === 'idle' || s === 'air' || s === 'run' || s === 'dash' || s === 'brake' || s === 'wd';
  };
  const press = (k, at, n) => k >= at && k < at + (n || 1);
  const drift = (i, f, o, d) => { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * (d || 1) : 0; };
  const hopDrift = (i, k, f, o, m) => { if (m === undefined || m === 'f') drift(i, f, o); else if (m === 'b') drift(i, f, o, -1);
    if ((m === 'f' || m === 'g') && f.vy <= 0 && !f.ff && k % 2 === 0) i.ly = -1; };
  const aerial = (i, f, st) => { i.lx = 0; i.ly = 0; if (st === 'f') i.lx = f.face; else if (st === 'b') i.lx = -f.face; else if (st === 'u') i.ly = 1; else if (st === 'd') i.ly = -1; i.atk = true; };
  /* Each action: want(f, o) is the way it must face before it starts on the ground (a one-frame walk turn first if not);
     inp(i, k, f, o, a1, a2) the buttons on its frame k; done(f) or the usual "free to act again" ends it. */
  const A = {};
  const ground = (name, set, opt) => { A[name] = Object.assign({ ground: 1, want: toward, inp(i, k, f, o) { if (k === 0) set(i, f, o); } }, opt || {}); };
  ground('jab', i => { i.atk = true; });
  ground('ftilt', (i, f) => { i.cx = f.face; }); ground('utilt', i => { i.cy = 1; }); ground('dtilt', i => { i.cy = -1; });
  ground('fsmash', (i, f) => { i.lx = f.face; i.atk = i.spc = true; i.sm = true; });
  ground('usmash', i => { i.ly = 1; i.atk = i.spc = true; i.sm = true; });
  ground('dsmash', i => { i.ly = -1; i.atk = i.spc = true; i.sm = true; });
  A.dash_attack = { ground: 1, min: 6, inp(i, k, f, o) { if (k < 6) i.lx = toward(f, o); if (press(k, 4)) { i.atk = true; i.lx = toward(f, o); } } };
  for (const t of ['f', 'b', 'u', 'd']) {
    const thr = (i, f) => { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; };
    A['grab_' + t] = { ground: 1, want: toward, max: 90, inp(i, k, f) { if (k === 0) i.grb = true; if (f.state === 'hold' && f.sf > 2) thr(i, f); } };
    A['dashgrab_' + t] = { ground: 1, max: 90, inp(i, k, f, o) { if (k < 6) i.lx = toward(f, o); if (press(k, 4)) i.grb = true; if (f.state === 'hold' && f.sf > 2) { i.lx = 0; thr(i, f); } } };
    A['thr_' + t] = { max: 60, inp(i, k, f) { if (f.state === 'hold' && f.sf > 2) thr(i, f); } };
  }
  for (const [nm, st] of [['nair', 'n'], ['fair', 'f'], ['bair', 'b'], ['uair', 'u'], ['dair', 'd']]) {
    const want = st === 'b' ? (f, o) => -toward(f, o) : toward;
    A['sh_' + nm] = { ground: 1, want, min: 7, max: 70, inp(i, k, f, o, a1, a2) { if (press(k, 0, 2)) i.jmp = true; if (k > 1) hopDrift(i, k, f, o, a2); if (press(k, a1 === undefined ? 4 : a1)) aerial(i, f, st); } };
    A['fh_' + nm] = { ground: 1, want, min: 12, max: 80, inp(i, k, f, o, a1, a2) { if (k < 12) i.jmp = true; if (k > 1) hopDrift(i, k, f, o, a2); if (press(k, a1 === undefined ? 9 : a1)) aerial(i, f, st); } };
    A[nm] = { air: 1, max: 70, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) aerial(i, f, st); } };
    A['dj_' + nm] = { air: 1, min: 6, max: 70, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) i.jmp = true; if (press(k, 3)) aerial(i, f, st); } };
    A['ff_' + nm] = { air: 1, max: 70, inp(i, k, f, o) { drift(i, f, o); if (press(k, 0)) aerial(i, f, st); if (k > 3 && f.vy <= 0 && k < 9) i.ly = k % 2 ? -1 : 0; } };
  }
  A.wait = { min: 1, inp() {} };
  A.ff = { air: 1, min: 6, max: 50, inp(i, k, f, o) { i.ly = k % 3 === 0 ? -1 : 0; drift(i, f, o); }, done: f => f.grounded };
  A.land = { air: 1, min: 1, max: 80, inp(i, k, f, o) { drift(i, f, o); }, done: f => f.grounded && actionable(f) };
  A.up = { max: 160, inp(i, k, f, o, a1, a2) { const d = toward(f, o); if (k === 0) { i.ly = 1; i.spc = true; return; }
    const v = a2 === 't' ? [d, 0] : a2 === 'u' ? [0, 1] : [d * 0.7, 0.7]; if (k < 8 + (a1 || 0)) i.spc = true; i.lx = v[0]; i.ly = v[1]; } };
  A.sel = { max: 60, inp(i, k, f, o, a1) { if (k < 14) i.spc = true; if (k >= 9 && k < 14) { const a = a1 * Math.PI * 2 / 5; i.lx = Math.sin(a); i.ly = Math.cos(a); } } };

  const parse = s => { const p = s.split(':'), num = v => v === undefined ? undefined : isNaN(+v) ? v : +v; return { n: p[0], a1: num(p[1]), a2: num(p[2]), k: 0, off: -1 }; };
  /* the input for an action on its frame r.k (a walk turn first, on the ground, when it needs the other facing) */
  function actIn(r, f, o) {
    const a = A[r.n], i = blankIn();
    if (r.off < 0) { r.off = 0; if (a.want && f.grounded && f.state === 'idle') { const w = a.want(f, o); if (w !== f.face) { r.off = 1; i.lx = w * 0.4; return i; } } }
    const k = r.k - r.off; if (k >= 0) a.inp(i, k, f, o, r.a1, r.a2); return i;
  }
  function actDone(r, f) {
    const a = A[r.n], k = r.k - Math.max(0, r.off);
    if (k < 1) return false;
    if (a.done) return (k >= (a.min || 1) && a.done(f)) || k >= (a.max || 70);
    if (r.n === 'wait') return k >= (r.a1 || 1);
    const mn = /^(sh|fh)_/.test(r.n) && r.a1 !== undefined ? Math.max(a.min || 2, r.a1 + 2) : (a.min || 2);
    return (k >= mn && actionable(f)) || k >= (a.max || 70);
  }

  /* what the opponent does in the copy: holds the stick as now ('hold'), DIs away from Fowls ('out') or toward ('in'),
     or holds shield ('shield', for openers) */
  function oppIn(pol, o, f) {
    const i = blankIn(), stun = o.state === 'hurt' || o.hitlag > 0;
    if (pol === 'shield') { if (!stun && o.grounded) i.shd = true; return i; }
    if (pol === 'hold') { i.lx = o.ctl.c.lx; i.ly = o.ctl.c.ly; i.shd = !!o.ctl.c.shd && !stun; return i; }
    const d = sgnd(o.x - f.x, 1);
    if (pol === 'esc') {   /* DI away, then out at the first chance: a jump away if it has one, an air dodge if not */
      const free = o.state === 'air' || o.state === 'idle' || o.state === 'land' || o.state === 'run' || o.state === 'dash';
      if (o.hitlag > 0 || (o.state === 'hurt' && o.sf < 39 && !free)) { i.lx = d; return i; }
      if (!o.grounded && (o.state === 'hurt' || free)) { if (o.jumps > 0) { i.jmp = (o.sf & 1) === 1; i.lx = d; } else { i.shd = (o.sf & 1) === 1; i.lx = d; i.ly = 0.5; } }
      else if (o.grounded && free) i.shd = true;
      return i;
    }
    if (stun) i.lx = pol === 'out' ? d : -d;
    return i;
  }

  const SET = {
    comboG: ['sh_nair:4', 'sh_nair:7', 'sh_nair:4:n', 'sh_nair:11:n', 'sh_nair:4:f', 'sh_uair', 'sh_fair', 'sh_bair', 'sh_dair:8:f', 'fh_nair', 'fh_uair', 'fh_fair',
      'grab_u', 'grab_f', 'grab_b', 'dashgrab_u', 'utilt', 'usmash', 'fsmash', 'dsmash', 'ftilt', 'dash_attack', 'jab', 'wait:3'],
    comboA: ['nair', 'uair', 'fair', 'bair', 'dair', 'dj_nair', 'dj_uair', 'dj_fair', 'dj_bair', 'ff', 'ff_nair', 'land', 'up:15:tu', 'up:0:u'],
    hold: ['thr_u', 'thr_f', 'thr_b', 'thr_d'],
    openG: ['sh_nair:4', 'sh_nair:7', 'grab_u', 'dashgrab_u', 'dash_attack', 'ftilt', 'utilt', 'dtilt', 'jab', 'dsmash', 'usmash', 'fsmash', 'sh_bair', 'sh_fair'],
    openA: ['nair', 'fair', 'bair', 'uair', 'dair', 'ff_nair'],
  };
  /* a cheap first cut by distance, so only options that could plausibly reach get played out */
  function reach(n, dx, dy, live) {
    const adx = Math.abs(dx);
    if (/^(jab|ftilt|utilt|dtilt|usmash|dsmash|fsmash|grab_)/.test(n)) return adx < 20 && dy > -8 && dy < (live ? 30 : 16);
    if (/^dash/.test(n)) return adx < 40 && dy > -8 && dy < 14;
    if (/^sh_/.test(n)) return adx < 34 && dy > -10 && dy < 40;
    if (/^fh_/.test(n)) return adx < 40 && dy > -6 && dy < 70;
    if (/^up:/.test(n)) return adx < 60 && dy > -10 && dy < 90;
    if (n === 'wait:3') return true;
    return adx < 40 && Math.abs(dy) < 50;
  }

  const P = { seen: {}, maxSims: 48, comboSteps: 700, openSteps: 500, safetyMs: 25, stats: { plans: 0, sims: 0, ms: 0, maxMs: 0 } };
  const clock = () => (typeof performance !== 'undefined' ? performance : Date).now();
  /* plays one option out from the saved match S against one way of defending; returns its score */
  function play(S, me, name, pol, live) {
    NET.load(S);
    const f = F[me], o = F[1 - me], h0 = live ? (COMBO[me].hits || 0) : 0, p0 = o.pct, st0 = f.stocks, os0 = o.stocks, kos0 = f.kos;
    const r = parse(name); let hits = h0, broke = false, ko = false, t = 0;
    PRO_SIM = x => x === f ? actIn(r, f, o) : oppIn(pol, o, f);
    for (;;) {
      step(); r.k++; t++; P.used++; P.stats.steps = (P.stats.steps || 0) + 1;
      const h = COMBO[me].hits || 0;
      if (h < hits && !(f.kos > kos0)) { broke = true; break; }   /* the combo dropped: nothing more to learn */
      if (h > hits) { hits = h; if (!broke && wouldKO(o)) ko = true; }
      if (f.kos > kos0 || o.stocks < os0) { ko = ko || !broke; break; }
      if (f.stocks < st0 || f.state === 'dead') return -10000;
      if (mode !== 'play' || actDone(r, f) || t > 90) break;
      if (!live && t > 30 && hits === h0 && o.state !== 'hurt' && o.hitlag <= 0 && f.state !== 'hold' && f.state !== 'attack' && f.state !== 'grab') break;   /* an opener that has missed and is over */
      if (P.used > P.lim * 1.25 || (P.safetyMs && (t & 7) === 0 && clock() - P.t0 > P.safetyMs)) return null;   /* over the allowance: this one is not counted */
    }
    const got = hits - h0;
    let s = got * 30 + (o.pct - p0) * 2 + (ko ? 4000 : 0);
    if (got > 0 && !broke) {
      const adv = o.state === 'hurt' ? o.hitstun - o.sf : o.hitlag > 0 || f.state === 'hold' ? 15 : -4;
      s += 20 + clamp(adv, -10, 25);
    } else if (!got) s -= live ? 30 + t * 0.3 : 10 + t * 0.6;   /* a whiff: the longer it is stuck, the worse */
    if (f.y < -8 || Math.abs(f.x) > EDGE + 6) s -= 80;
    if (f.y < -35 || Math.abs(f.x) > EDGE + 40) s -= 600;
    return s;
  }
  /* the best option from here: every candidate against the opponent's held stick, then the best few against the other DIs,
     judged by their worst result. Returns [name, score] or null. */
  function plan(f, o, live) {
    const me = F.indexOf(f), t0 = P.t0 = clock(), dx = o.x - f.x, dy = o.y - f.y;
    let list = f.state === 'hold' ? SET.hold : live ? (f.grounded ? SET.comboG : SET.comboA) : (f.grounded ? SET.openG : SET.openA);
    if (f.state !== 'hold') list = list.filter(n => reach(n, dx, dy, live));
    /* options that have scored well before go first, so if time runs out it is the weak ones left unplayed */
    const key = n => (live ? 'c' : 'o') + (f.grounded ? 'g' : 'a') + n, avg = n => { const q = P.seen[key(n)]; return q ? q[0] / q[1] : 0; };
    list = list.slice().sort((a, b) => avg(b) - avg(a));
    if (!list.length) return null;
    const S = NET.save(), sf = sparkOff, fx = stepFx, rs = NET.resim; let sims = 0;
    sparkOff = true; stepFx = () => {}; NET.resim = true;
    P.lim = live ? P.comboSteps : P.openSteps; P.used = 0;   /* the allowance is in frames played out, not in time, so it plays the same on any machine */
    const over = () => sims >= P.maxSims || P.used >= P.lim || (P.safetyMs && clock() - t0 > P.safetyMs);
    let res = [];
    try {
      for (const n of list) { if (over()) break; const v = play(S, me, n, 'hold', live); sims++; if (v !== null) res.push([n, v]); }
      for (const [n, v] of res) { const q = P.seen[key(n)] || (P.seen[key(n)] = [0, 0]); q[0] += clamp(v, -200, 400); q[1]++; }
      res.sort((a, b) => b[1] - a[1]);
      const away = sgnd(o.x - f.x, 1), held = o.ctl.c.lx * away;   /* a DI the opponent is already holding was played as 'hold' */
      const pols = live ? ['out', 'in', 'esc'].filter(p => !(p === 'out' ? held > 0.7 : p === 'in' ? held < -0.7 : false)) : ['shield'], top = res.slice(0, live ? 4 : 3);
      for (const c of top) for (const p of pols) { const v = over() ? null : play(S, me, c[0], p, live); sims++; if (v === null) { c.part = true; break; } c[1] = Math.min(c[1], v); }
      res = top.filter(c => !c.part).sort((a, b) => b[1] - a[1]);
    } finally {
      PRO_SIM = null; NET.load(S); sparkOff = sf; stepFx = fx; NET.resim = rs;
    }
    const ms = clock() - t0; P.stats.plans++; P.stats.sims += sims; P.stats.ms += ms; P.stats.maxMs = Math.max(P.stats.maxMs, ms); if (P.hist) P.hist.push([live ? 1 : 0, P.used, sims, list.length]); if (ms > 20) (P.slow = P.slow || []).push(ms);
    return res[0] || null;
  }

  function online() { return typeof NET !== 'undefined' && NET.session && NET.session(); }
  /* Called by cpuInput at level 10. Returns this frame's input, or null to let the normal CPU play this frame. */
  function cpuPro(f, o, m) {
    if (!f.def.fowl || PRO_SIM || online() || mode !== 'play') return null;
    if (m.pro) {
      const r = m.pro;
      if (!actDone(r, f) && !(r.k > 4 && f.state === 'hurt')) { const i = actIn(r, f, o); r.k++; return i; }
      m.pro = null;
    }
    m.pt = (m.pt || 0) + 1;
    if (f.fi >= 5 || o.state === 'dead' || o.state === 'respawn' || o.invuln > 0) return null;   /* the bird alone, or nothing to hit */
    if (f.y < -10 || Math.abs(f.x) > EDGE + 20) return null;   /* getting back is the normal CPU's job */
    const live = (COMBO[F.indexOf(f)].hits || 0) > 0 || f.state === 'hold';
    if (!(actionable(f) || f.state === 'hold')) return null;
    const ad = Math.abs(o.x - f.x);
    if (!live) {
      /* Pip has the longest true combos: switch to Pip when there is room to */
      if (f.fi % 5 !== 3 && f.grounded && ad > 40 && f.state === 'idle') { m.pro = parse('sel:3'); const i = actIn(m.pro, f, o); m.pro.k++; return i; }
      if (ad > 42 || m.pt % 3) return null;
    }
    const best = plan(f, o, live);
    if (!best || best[1] < (live ? 1 : 25)) return null;
    m.pro = parse(best[0]); m.proLast = best[0];
    const i = actIn(m.pro, f, o); m.pro.k++; return i;
  }
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.cpuPro = cpuPro; root.CPU10 = P;
})();
