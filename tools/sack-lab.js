// Potato Sack lab: the route tokens for Potato Sack, on top of tools/knell-lab.js (its executor, defenders, watch and run, with
// o.me = his roster index). Loaded after knell-lab.js: in node by tools/knell-search.js / knell-verify.js / sack-probe.js, in the
// browser by tools/knell-record.js. Testing only: it changes nothing in the game. Every token only presses buttons and sticks
// (nothing here turns him round or moves him: a grab facing the wrong way just misses).
//
// A move token is over once its move has made contact (the game's own combo counter went up, or the opponent is in hitlag, i.e.
// a shield was hit) or has ended without any; the next token is then pressed on the first frame the game allows it, which for
// Tumble is its frame-7 cancel.
//   ground  jab ftilt utilt dtilt fsmash usmash dsmash dash grab_f grab_b grab_u grab_d bomb b<n> bag uspecG
//           sh fh run wd_f wd_b dd (one dash-dance: dash toward, then away)
//   air     nair fair bair uair dair dj ff ad_n ad_f ad_b ad_d ad_df ad_db ad_u bombA bA<n> bagA uspec uspec_f uspec_b
//   Tumble  tum_f tum_b tum_u tum_n tum_d tum_db (down special, the stick toward / away / up / centred / down-toward / down-away
//           held through its frame 6; on a soft platform tum_d holds down and drops through) tx (a push the other way: ends it)
//           tdn (a fresh push down in the air: ends it)
//   landing L<token> (a ground token pressed in the air in the last 3 frames before he lands out of a tumble: the game does it
//           on the landing frame with no landing lag), e.g. Lusmash Lgrab_u Lsh Ltum_f
//   other   w<n> d+ d- d0 (as in knell-lab)
(function () {
  const KL = typeof window !== 'undefined' ? window.KLAB : globalThis.KLAB, A = KL.A;
  const SL = {}; SL.ME = ROSTER.findIndex(d => d.name === 'Potato Sack');
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
  const cut = f => f.state === 'attack' && f.move && f.move.cancel && f.mf >= f.move.cancel;   /* Tumble from frame 7 */
  const ready = f => !!FREE[f.state] || cut(f);
  const gOK = f => f.grounded && ready(f), aOK = f => !f.grounded && ready(f);
  SL.ready = ready;
  /* frames until he touches a floor at this speed (falling only), or 99 */
  SL.landIn = function (f) {
    if (f.grounded) return 0; let y = f.y, vy = f.vy; const g = f.st.grav, cap = f.ff ? f.st.ffall : f.st.fall;
    for (let k = 1; k <= 30; k++) { vy = Math.max(vy - g, -cap); const ny = y + vy;
      for (const p of PLATS) if (f.x >= p.x0 && f.x <= p.x1 && y >= p.y && ny <= p.y && vy <= 0 && !(p.soft && f.dropT > 0 && p === f.dropPlat)) return k;
      y = ny; }
    return 99;
  };
  /* ---- a move token: pressed on k = 0 .. press-1; over at contact, at the end of the move it started, or after 90 frames ---- */
  const mv = (ok, set, press) => ({ atk: 1, ok, inp(i, k, f, o, e) { if (k === 0) { e.h0 = COMBO[0].hits; e.m0 = f.move; e.f0 = f.mf; e.st = 0; } if (k < (press || 3)) set(i, f, o, k); },
    done(k, f, e) { if (k > 90) return true;
      if (!e.st && f.state === 'attack' && (f.move !== e.m0 || f.mf < e.f0 || k > 1 && f.mf <= 2)) { e.st = 1; e.ms = f.move; }
      if (!e.st && (f.state === 'hold' || f.state === 'throw' || f.state === 'land' && k > 1)) e.st = 2;
      const hit = COMBO[0].hits > e.h0 || F[1].hitlag > 0 || F[1].state === 'held';
      return e.st ? hit || f.state !== 'attack' && f.state !== 'hold' && f.state !== 'throw' || e.st === 1 && f.move !== e.ms : k > 12 && hit; } });
  A.jab = mv(gOK, (i, f, o, k) => { i.lx = 0; i.ly = 0; if (k === 0) i.atk = true; });
  const tilt = (lx, ly) => mv(gOK, (i, f, o, k) => { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.atk = true; });
  A.ftilt = tilt(0.6, 0); A.utilt = tilt(0, 0.6); A.dtilt = tilt(0, -0.6);
  const smash = (lx, ly) => mv(gOK, (i, f, o, k) => { i.lx = lx * toward(f, o); i.ly = ly; if (k === 0) { i.atk = true; i.spc = true; } }, 1);
  A.fsmash = smash(1, 0); A.usmash = smash(0, 1); A.dsmash = smash(0, -1);
  A.dash = { atk: 1, ok: f => f.grounded && !!FREE[f.state], inp(i, k, f, o, e) { i.lx = toward(f, o); if (k === 0) { e.p = 0; e.h0 = COMBO[0].hits; } if (!e.p && k >= 7 && (f.state === 'run' || f.state === 'dash')) { i.atk = true; e.p = 1; } if (e.p === 1 && f.state === 'attack') { e.p = 2; e.ms = f.move; } },
    done: (k, f, e) => k > 90 || (e.p === 2 && (COMBO[0].hits > e.h0 || F[1].hitlag > 0 || f.state !== 'attack')) };
  A.run = { ok: f => f.grounded && !!FREE[f.state], inp(i, k, f, o) { i.lx = toward(f, o); }, done: k => k >= 10 };
  A.dd = { ok: f => f.grounded && !!FREE[f.state], inp(i, k, f, o, e) { if (k === 0) e.dx = toward(f, o); i.lx = k < 6 ? e.dx : k < 8 ? 0 : -e.dx; }, done: k => k >= 14 };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ok: gOK, inp(i, k, f) { if (k === 0) i.grb = true;
    if (f.state === 'hold' && f.sf > 1) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } },
    done: (k, f) => (k > 3 && f.state !== 'hold' && f.state !== 'throw' && f.state !== 'attack') || (f.state === 'throw' && f.sf > 0 && F[1].state === 'hurt') || k > 90 };
  const spec = (ok, lx, ly, n) => mv(ok, (i, f, o, k) => { if (k === 0) i.spc = true; i.lx = lx * toward(f, o); i.ly = ly; }, n || 3);
  A.bomb = spec(gOK, 0, 0, 1); A.bombA = spec(aOK, 0, 0, 1); A.bag = spec(gOK, 1, 0); A.bagA = spec(aOK, 1, 0);
  A.uspec = spec(aOK, 0, 1, 20); A.uspec_f = spec(aOK, 0.6, 1, 20); A.uspec_b = spec(aOK, -0.6, 1, 20); A.uspecG = spec(gOK, 0, 1, 20);
  /* jumps: sh lets go at once, fh holds it */
  A.sh = { ok: gOK, inp(i, k) { if (k === 0) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 1) || k > 20 };
  A.fh = { ok: gOK, inp(i, k) { if (k < 10) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 6) || k > 20 };
  A.dj = { ok: f => aOK(f) && f.jumps > 0, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  const aer = (sx, sy) => mv(aOK, (i, f, o, k) => { i.lx = sx * f.face; i.ly = sy; if (k === 0) i.atk = true; });
  A.nair = aer(0, 0); A.fair = aer(1, 0); A.bair = aer(-1, 0); A.uair = aer(0, 1); A.dair = aer(0, -1);
  A.ff = { ok: f => !f.grounded && f.vy <= 0 && (ready(f) || f.state === 'attack'), inp(i, k) { if (k === 0) i.ly = -1; }, done: k => k >= 1 };
  for (const [nm, dx, dy] of [['ad_n', 0, 0], ['ad_f', 1, 0], ['ad_b', -1, 0], ['ad_d', 0, -1], ['ad_df', 0.7, -0.7], ['ad_db', -0.7, -0.7], ['ad_u', 0, 1]])
    A[nm] = { ok: aOK, inp(i, k, f) { i.shd = k === 0; i.lx = dx * f.face; i.ly = dy; }, done: k => k >= 2 };
  for (const [nm, dx] of [['wd_f', 1], ['wd_b', -1]]) A[nm] = { ok: gOK, inp(i, k, f) { if (k === 0) i.jmp = true; if (k >= 3) { i.shd = k === 3; i.lx = dx * f.face; i.ly = -0.6; } }, done: (k, f) => (k >= 6 && f.grounded) || k > 30 };
  /* ---- Tumble: down + special, then the stick held through frame 6 (where it picks its way); over at its cancel frame ---- */
  const TUM = { f: [1, 0], b: [-1, 0], u: [0, 1], n: [0, 0], d: [1, -1], db: [-1, -1] };
  for (const [nm, [dx, dy]] of Object.entries(TUM)) A['tum_' + nm] = { ok: f => (f.grounded ? gOK(f) : aOK(f) && !f.burstUsed),
    inp(i, k, f, o, e) { if (k === 0) { e.tw = toward(f, o); i.lx = 0; i.ly = -1; i.spc = true; return; } i.lx = dx * e.tw; i.ly = dy; },
    done: (k, f) => (f.state === 'attack' && f.mname === 'dspec' && f.mf >= 7) || k > 14 };
  A.tx = { ok: cut, inp(i, k, f, o) { i.lx = f.burstX ? -f.burstX : toward(f, o); }, done: k => k >= 1 };
  A.tdn = { ok: f => cut(f) && !f.grounded, inp(i) { i.ly = -1; }, done: k => k >= 1 };
  /* ---- the landing buffer out of a tumble: L<ground token> ---- */
  const BTN = ['atk', 'spc', 'jmp', 'shd', 'grb'];
  SL.landTok = function (nm) {
    const b = KL.tok(nm); if (!b) return null;
    return { atk: b.atk, ok: f => !f.grounded && f.tumbled && (ready(f) || f.state === 'attack') && SL.landIn(f) <= 3,
      inp(i, k, f, o, e) { if (k === 0) { i.lx = 0; i.ly = 0; b.inp(i, 0, f, o, e); e.lk = Object.assign({}, i); return; }
        if (!f.grounded || k < 2) { Object.assign(i, e.lk); for (const x of BTN) i[x] = false; if (nm === 'fh') i.jmp = true; } else b.inp(i, Math.max(1, k - 1), f, o, e); },
      done: (k, f, e) => k > 40 || (f.grounded && k >= 1 && b.done(k, f, e)) };
  };
  const tok0 = KL.tok, LT = {};
  KL.tok = t => { const a = tok0(t); if (a) return a; let m;
    if ((m = /^(bA?)(\d+)$/.exec(t))) { const n = +m[2]; return LT[t] || (LT[t] = mv(m[1] === 'b' ? gOK : aOK, (i, f, o, k) => { i.spc = k < n; }, n + 1)); }
    if (t[0] === 'L' && t.length > 1) return LT[t] || (LT[t] = SL.landTok(t.slice(1)));
    return undefined; };
  if (typeof window !== 'undefined') window.SLAB = SL; else globalThis.SLAB = SL;
})();
