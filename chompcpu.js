'use strict';
/* Chomp Chomp as the CPU at level 10. Level 10 is the sharpest set of numbers (sim.js: CPU_LV[10]); for Chomp it adds a planner
   on top of that brain, built the way knellcpu.js is. It only ever chooses inputs, the same buttons and stick a player has:
   nothing about Chomp, his moves or the rules is changed, and it reads nothing a player could not see on screen.

   The combos it knows are the ones found in the Chomp playtest (playtest-results/chomp/README.md): the zero-to-deaths, the kill
   confirms and the coal-already-down openers, cut into links. Each link is one hit (or a coal or ant hit and the move after it).

   In a combo: the moment one of his hits connects, it saves the game (net.js's rollback snapshot), plays every link that could
   come next a few dozen frames ahead, with the opponent doing what it is doing now (a person: holding what they hold, then
   checked again against DI away and DI toward; a CPU: its own brain), and puts the game back. A link counts only if the game's
   own true-combo counter goes up without resetting. Of those it takes the best for damage, the frames he is left ahead, a KO
   with the opponent still in hitstun, and the playtest's routes: a link that carries on a known route scores more.
   It looks further than one link:
     - each known route that carries on from here is played to its end, and its next link is credited with where it really got;
     - from where each of the best few links ends, every next link is tried, and a link is worth what it leads to. The one it
       expected to follow with is tried first at the next hit, so a path it chose is carried through;
     - a throw is planned while it plays; free with them still tumbling, it also tries each link after a short wait and keeps
       looking while he waits.
   Openers are a route's first link only (the next is chosen once it hits, in the throw's or swing's time). In spare neutral
   frames it plays one known route ahead from where they both stand and keeps what it came to for this opponent and percent
   band, so at 110% it opens with a kill confirm and at 0% with a zero-to-death starter.
   Hungry for the spike: a kill by down air (straight down) with them out past the ledge or under the stage is worth more than any
   other kill, enough that a spike two links away outbids a plain kill now; on the way, a link that leaves them tumbling near or
   past the ledge, low, heading out, scores a little more. The aimed down air (aim, aimL) steers to where they will be when its hit
   comes out and presses then. Every kill it plans counts only if the level-10 brain then gets him back to the stage or the ledge.

   Getting there (neutral):
     - close in, it plays out its openers (the coal starters, the kill confirms, plain hits, the ant when a coal is down) and
       throws the best one that lands. If none would, the level-10 brain plays as it does for everyone.
     - at range with no coal out, it tosses the coal (straight, high or low, with or without relays) to land it past the opponent,
       then walks round so the opponent stands between him and the coal, and calls the ant into its follow-up.
     - the opponent on the ledge: the coal goes to the ledge and he waits 48 units back; the ant is called 12 frames after they
       let go of the ledge (the playtest's ledgetrap). Recovering below or beside the stage: he stands at the ledge and throws
       the forward smash when it would connect, or runs or jumps off after them into an aimed down air when that would
       take the stock and he would get back.
   Needs net.js (the snapshots); without it Chomp at level 10 is the plain level-10 brain. Offline only. */
const CCPU = (() => {
  if (typeof NET === 'undefined') return undefined;
  /* budget: frames of play-ahead per frame of the match in a combo; open: per neutral decision; ms: and no more than this long
     per frame (in a browser), so the game keeps its 60 fps. A test sets ms to 0, so the frame counts alone decide. */
  const K = { budget: 900, open: 1800, ms: typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' && typeof process === 'undefined' ? 6 : 0,
    stats: { plans: 0, openers: 0, picked: 0, none: 0, sims: 0, frames: 0, kos: 0, landed: 0, dropped: 0, fragile: 0, routed: 0, tosses: 0, traps: 0, guards: 0, ants: 0, bg: 0, spikes: 0, chases: 0 }, log: null };

  /* ---- tokens: what a player presses for each step (as in tools/chomp-lab.js, without its test-only turns) ---- */
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
  const free = f => !!FREE[f.state];
  const gOK = f => f.grounded && free(f);
  const aOK = f => !f.grounded && free(f);
  const coalOf = f => PROJ.find(p => p.owner === f.idx && p.tag === 'coal' && p.life > 0);
  const antOf = f => PROJ.find(p => p.owner === f.idx && p.tag === 'ant' && p.life > 0);
  const atkDone = (k, f, e) => {
    if (k > 90) return true;
    if (!e.mv && f.state === 'attack' && k >= 1) e.mv = f.move;
    if (!e.mv) return k > 6;
    return f.move !== e.mv || f.state !== 'attack' || (f.hitG && f.hitG.size > 0);
  };
  const A = {};
  /* face: on the ground it turns toward the opponent first (a light tap of the stick, as a player turns), when the move does not turn him itself */
  const atk = (ok, set, press, face) => ({ atk: 1, face, ok, inp(i, k, f, o, e) { if (k === 0) e.mv = null; if (k < (press || 3)) set(i, f, o, k); }, done: atkDone });
  A.jab = atk(gOK, (i, f, o, k) => { if (k === 0) i.atk = true; }, 3, 1);
  const jabNext = (f, nm) => f.state === 'attack' && f.mname === nm && f.hitlag <= 0 && f.move.chain && f.mf + 1 >= f.move.chain && f.mf + 1 <= (f.move.chainEnd || 99);
  A.jab2 = atk(f => jabNext(f, 'jab'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.jab3 = atk(f => jabNext(f, 'jab2'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.ftilt = atk(gOK, (i, f, o, k) => { i.lx = 0.6 * toward(f, o); if (k === 0) i.atk = true; });   /* a sideways tilt turns him to it */
  A.utilt = atk(gOK, (i, f, o, k) => { i.ly = 0.6; if (k === 0) i.atk = true; }, 3, 1);
  A.dtilt = atk(gOK, (i, f, o, k) => { i.ly = -0.6; if (k === 0) i.atk = true; }, 3, 1);
  const smash = (lx, ly, face) => atk(gOK, (i, f, o, k) => { i.lx = lx * toward(f, o); i.ly = ly; if (k === 0) { i.atk = true; i.spc = true; } }, 1, face);
  A.fsmash = smash(1, 0); A.usmash = smash(0, 1, 1); A.dsmash = smash(0, -1, 1);
  A.dash = { atk: 1, ok: f => f.grounded && free(f), inp(i, k, f, o, e) { i.lx = toward(f, o); if (k === 0) { e.p = 0; e.mv = null; } if (!e.p && k >= 7 && (f.state === 'run' || f.state === 'dash')) { i.atk = true; e.p = 1; } },
    done: (k, f, e) => k > 90 || (e.p === 1 && k > 8 && atkDone(k, f, e)) };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { face: 1, ok: f => f.grounded && free(f), inp(i, k, f, o) { if (k === 0) i.grb = true;
    if (f.state === 'hold' && f.sf > 1) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } },
    done: (k, f) => (k > 3 && f.state !== 'hold' && f.state !== 'throw' && f.state !== 'attack') || (f.state === 'throw' && f.sf > 0 && opp(f) && opp(f).state === 'hurt') || k > 90 };
  A.sh = { ok: gOK, inp(i, k) { if (k === 0) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 1) || k > 20 };
  A.fh = { ok: gOK, inp(i, k) { if (k < 10) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 6) || k > 20 };
  A.dj = { ok: f => aOK(f) && f.jumps > 0, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  const aer = (sx, sy) => atk(aOK, (i, f, o, k) => { i.lx = sx * f.face; i.ly = sy; if (k === 0) i.atk = true; });
  A.nair = aer(0, 0); A.fair = aer(1, 0); A.bair = aer(-1, 0); A.uair = aer(0, 1); A.dair = aer(0, -1);
  A.ff = { ok: f => !f.grounded && f.vy <= 0 && (free(f) || f.state === 'attack'), inp(i, k) { if (k === 0) i.ly = -1; }, done: k => k >= 1 };
  /* the coal: the toss (a light tap toward the opponent turns him; the stick tilts it once Neutral B has started) */
  const relayOff = p => {
    if (!p || p.st !== 'swing' || p.relay >= COAL.relays) return null;
    if (p.markAge !== undefined) { const o = p.age + 1 - p.markAge; return o <= COAL.win ? o : null; }
    let th = p.th, w = p.w; for (let k = 1; k <= COAL.win + 1; k++) { w += -(COAL.g / p.L) * Math.sin(th); th += w; if (sgn(w) === p.dir && th * p.dir >= COAL.mark) return k - 1; }
    return null;
  };
  const coalDone = (k, f) => k > 1 && f.state !== 'attack' || k > 40;
  const toss = ly => ({ ok: f => free(f) && !coalOf(f) && frame >= (f.coalReady || 0), inp(i, k, f, o) { if (k === 0) { i.spc = true; if (f.grounded) i.lx = 0.4 * toward(f, o); } else if (k >= 2 && k < 15) i.ly = ly; }, done: coalDone });
  A.coal = toss(0); A.coalH = toss(1); A.coalL = toss(-1);
  A.relay = { ok: f => free(f) && f.ctl && !f.ctl.c.spc && (() => { const o = relayOff(coalOf(f)); return o !== null && o <= 1; })(), inp(i, k) { if (k === 0) i.spc = true; }, done: k => k >= 1 };
  A.ant = { ok: f => free(f) && !antOf(f) && (() => { const p = coalOf(f); return p && (p.st === 'ground' || (p.st === 'fly' && (Math.abs(p.x) > EDGE || p.y < 0))); })(), inp(i, k) { if (k === 0) i.spc = true; }, done: k => k >= 1 };
  /* the Rope Swing */
  A.rs = { ok: f => free(f) && (f.grounded || !f.airUse.rope), inp(i, k, f, o) { if (k === 0) { i.spc = true; i.lx = toward(f, o); } }, done: (k, f) => (f.mname === 'sspec' && f.rsGo) || k > 30 };
  A.bite = { atk: 1, ok: f => f.mname === 'sspec' && f.rsGo && f.rsT > ROPE.off, inp(i, k, f, o, e) { if (k === 0) { i.atk = true; e.mv = null; } }, done: (k, f, e) => k > 1 && atkDone(k, f, e) };
  A.hop = { ok: f => f.mname === 'sspec' && f.rsGo && f.rsT > ROPE.off, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  const roOK = f => f.state === 'attack' && f.hitG && f.hitG.size > 0 && f.hitlag <= 0 && f.mname !== 'sspec' && f.mname !== 'swingBite' && !(f.move && f.move.h[0] && f.move.h[0].grab) && (f.grounded || !f.airUse.rope) && f.ctl && !f.ctl.c.spc;
  const ro = dir => ({ ok: roOK, inp(i, k, f) { if (k === 0) { i.spc = true; i.lx = dir * f.face; } }, done: (k, f) => (f.mname === 'sspec' && f.rsGo) || k > 20 });
  A.ro_f = ro(1); A.ro_b = ro(-1);
  A.cush = atk(f => free(f), (i, f, o, k) => { if (k === 0) { i.spc = true; i.ly = -1; } });
  /* the aimed spike: off the ground (running, then off the ledge or up with a jump) and through the air, he steers to where they
     will be when the down air's hit comes out (frame 12) and presses it once they will be under it. Its double jump if he is
     below them. aimL presses a little later (them lower). The play-ahead decides if it is any good. */
  const DAIR_F = 12;
  const aimT = lo => ({ atk: 1, ok: f => free(f), inp(i, k, f, o, e) {
    if (k === 0) { e.p = 0; e.mv = null; e.dj = 0; e.ff = 0; }
    if (e.p) return;
    const px = o.x + o.vx * DAIR_F, py = o.y + o.vy * DAIR_F, fx = f.x + f.vx * DAIR_F, fy = f.y + f.vy * DAIR_F, dx = px - fx, dy = py - fy;
    if (f.grounded) { i.lx = sgn(o.x - f.x) || f.face; return; }   /* run on: off the ledge he goes */
    i.lx = Math.abs(dx) > 1.5 ? clamp(dx / 6, -1, 1) : 0;
    if (!e.dj && f.jumps > 0 && dy > 2 && f.vy < 0.5) { i.jmp = true; e.dj = 1; return; }
    if (!e.ff && dy < -16 && f.vy <= 0 && f.vy > -2.5) { i.ly = -1; e.ff = 1; return; }   /* far below: fast-fall down to them */
    if (Math.abs(dx) < 6 && dy < (lo ? -6 : -1) && dy > (lo ? -20 : -14)) { i.atk = true; i.ly = -1; i.lx = 0; e.p = 1; e.pk = k; }
  }, done: (k, f, e) => k > 80 || (e.p === 1 && k > e.pk + 1 && atkDone(k, f, e)) });
  A.aim = aimT(false); A.aimL = aimT(true);
  /* steering for the chase: toward where they will be when a down air's hit comes out (sN: N frames of it), and the down air with
     a fast-fall flicked in once he is falling (dairF), still steering */
  const steer = (i, f, o) => { const dx = (o.x + o.vx * DAIR_F) - (f.x + f.vx * DAIR_F); i.lx = Math.abs(dx) > 1.5 ? clamp(dx / 6, -1, 1) : 0; };
  A.dairF = { atk: 1, ok: aOK, inp(i, k, f, o, e) { if (k === 0) { e.mv = null; e.fq = 0; } steer(i, f, o);
    if (k < 3) { i.ly = -1; if (k === 0) { i.atk = true; i.lx = 0; } return; }
    if (e.fq === 0 && f.vy <= 0) { e.fq = 1; return; } if (e.fq === 1) { i.ly = -1; e.fq = 2; } }, done: atkDone };
  const NUM = {};
  const tok = t => {
    if (A[t]) return A[t]; if (NUM[t]) return NUM[t];
    let m;
    if ((m = /^w(\d+)$/.exec(t))) NUM[t] = { ok: () => true, inp() {}, done: k => k >= +m[1], wait: 1 };
    else if ((m = /^s(\d+)$/.exec(t))) NUM[t] = { ok: () => true, inp(i, k, f, o) { if (!f.grounded) steer(i, f, o); }, done: k => k >= +m[1], wait: 1 };
    else if ((m = /^([wr])([fb])(\d+)$/.exec(t))) { const run = m[1] === 'r', s = m[2] === 'f' ? 1 : -1, n = +m[3];
      NUM[t] = { ok: f => f.grounded && free(f), inp(i, k, f, o) { i.lx = s * toward(f, o) * (run ? 1 : 0.5); }, done: k => k >= n }; }
    return NUM[t];
  };

  /* ---- the executor: where Chomp is in the steps he chose. A plain object, so it is copied along with a snapshot. ---- */
  const exec = (toks, late, patience) => ({ toks: toks.slice(), idx: 0, cur: null, k: -1, wait: 0, holdT: 0, drift: 1, failed: -1, late: late || 0, patience: patience || 40, mv: null, p: 0 });
  const cpE = e => Object.assign({}, e, { toks: e.toks.slice() });
  function nextTok(e) {
    while (e.idx < e.toks.length) { const t = e.toks[e.idx++]; if (!tok(t)) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; return; } e.cur = t; e.k = -1; e.wait = e.idx === 1 && t !== 'relay' ? e.late : 0; e.holdT = 0; return; }
    e.cur = null;
  }
  function input(e, f, o) {
    const i = blankIn();
    if (e.drift && !f.grounded) { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * e.drift : 0; }
    if (e.cur === null && e.idx < e.toks.length) nextTok(e);
    if (e.cur !== null) {
      const a = tok(e.cur);
      if (e.k < 0) {
        if (a.ok(f, o)) {
          if (a.face && f.grounded && f.face !== toward(f, o) && Math.abs(o.x - f.x) > 1 && f.state === 'idle') { i.lx = 0.3 * toward(f, o); if (++e.holdT > e.patience) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; } return i; }
          if (e.wait > 0) e.wait--; else e.k = 0;
        } else if (++e.holdT > e.patience) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; }
      }
      if (e.cur !== null && e.k >= 0) a.inp(i, e.k, f, o, e);
    }
    return i;
  }
  function after(e, f) { if (e.cur === null || e.k < 0) return; e.k++; if (tok(e.cur).done(e.k, f, e)) { e.cur = null; e.k = -1; if (e.idx < e.toks.length) nextTok(e); } }
  const finished = e => e.cur === null && e.idx >= e.toks.length;

  /* ---- the playtest's routes, cut into links (a link ends with the press that hits) ---- */
  const ROUTES = [
    /* zero-to-deaths */
    'coalH grab_f ant sh fair ro_f w4 hop fair ff w9 bair ro_b w9 hop nair fair rf12 grab_u fh uair dj dair',
    'coalH grab_f ant rs w4 bite rf6 utilt ftilt ro_f w3 hop w6 fair dash ro_f hop uair dj dair',
    'coalH grab_f ant sh fair ro_f hop fair ff w9 bair ro_b w4 hop uair utilt fh nair ro_b hop dair',
    'coalH grab_f ant w28 ftilt ro_f w9 bite rf6 grab_u fh fair w3 dj nair ro_f hop dair',
    'coalH grab_f ant w28 sh fair ro_f bite grab_f rf12 dtilt dtilt ro_f hop dair',
    'coal grab_f ant w28 dash ro_f w3 hop w6 fair fh nair ro_f w2 bite dj dair',
    'coalH grab_f ant sh fair ro_f w2 bite grab_u fh nair ro_f hop dair',
    'coalH grab_f ant sh fair ro_f w2 bite ftilt ro_f hop dair',
    /* with a coal already down */
    'ant w28 fsmash ro_f hop fair ff cush ro_f w5 bite rf6 grab_u fh nair ro_f hop dair',
    'ant w28 fsmash ro_f w9 bite dtilt ro_f w5 bite rf6 jab ro_f hop dair',
    'ant fsmash ro_f w5 bite rf6 dtilt ro_f w5 bite wf4 ftilt ro_f hop dair',
    'ant fsmash ro_f w5 bite wf4 ftilt ro_f w9 hop fair ff cush ro_f hop dair',
    /* kill confirms */
    'coalH grab_d fsmash', 'coalH dtilt usmash', 'coalH dtilt fsmash', 'coalH dtilt wf4 usmash', 'coalH grab_u fh w4 nair ro_f w9 hop fair',
    'coalL dtilt ant w28 dash', 'coalH utilt fh w4 bair ro_b w9 hop dair', 'coalH ftilt rf6 sh fair ro_f w4 hop dair', 'coalH grab_u wf4 fh fair rf6 sh dair'];
  const HIT = new Set(['aim', 'aimL', 'dairF', 'jab', 'jab2', 'jab3', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'dash', 'grab_f', 'grab_b', 'grab_u', 'grab_d', 'nair', 'fair', 'bair', 'uair', 'dair', 'bite', 'cush']);
  const cut = r => { const out = []; let cur = []; for (const t of r.split(' ')) { cur.push(t); if (HIT.has(t)) { out.push(cur.join(' ')); cur = []; } } if (cur.length) out.push(cur.join(' ')); return out; };
  const RL = ROUTES.map(cut);
  /* how many known routes carry on with this link after the links so far (and the most links that still follow) */
  function onRoute(hist, link) {
    let n = 0, more = 0; const L = hist.length;
    for (const r of RL) { if (r.length <= L || r[L] !== link) continue; let ok = true; for (let k = 0; k < L; k++) if (r[k] !== hist[k]) { ok = false; break; } if (ok) { n++; more = Math.max(more, r.length - L - 1); } }
    return n ? { n, more } : null;
  }
  const LINKS = [...new Set(RL.flat())];
  /* the links tried beyond the playtest's: each plain hit, each aerial off a hop, run or wait, and each rope-out ending */
  const GEN_G = ['jab', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'dash', 'grab_f', 'grab_b', 'grab_u', 'grab_d',
    'sh nair', 'sh fair', 'sh bair', 'sh uair', 'sh dair', 'fh nair', 'fh fair', 'fh uair', 'fh w4 nair', 'fh w4 bair',
    'rf6 sh fair', 'rf6 sh dair', 'rf6 grab_u', 'rf12 grab_u', 'rf6 dtilt', 'rf6 jab', 'wf4 ftilt', 'wf4 usmash', 'rf6 usmash', 'rf6 fsmash',
    'fh w4 dair', 'fh w9 dair', 'sh w4 dair', 'rf6 fh w4 dair', 'rf10 sh w4 dair'];   /* the last five: up and over to a spike */
  const GEN_A = ['nair', 'fair', 'bair', 'uair', 'dair', 'dj nair', 'dj fair', 'dj uair', 'dj dair', 'dj bair', 'w3 dj nair', 'ff nair', 'ff fair', 'ff bair', 'w9 bair', 'w6 fair',
    'w4 dair', 'w8 dair', 'w14 dair', 'dj w4 dair', 'dj w9 dair', 'ff dair', 'aim', 'aimL'];   /* the last eight: chasing down to a spike */
  const GEN_RO = [];
  for (const d of ['ro_f', 'ro_b']) for (const t of ['bite', 'w2 bite', 'w5 bite', 'w9 bite', 'hop aim', 'hop aimL', 'hop fair', 'hop nair', 'hop dair', 'hop uair', 'hop bair', 'w4 hop fair', 'w9 hop fair', 'w4 hop dair', 'w9 hop dair', 'w14 hop dair', 'hop w6 dair', 'w9 hop nair', 'w4 hop uair', 'w3 hop w6 fair']) GEN_RO.push(d + ' ' + t);
  const GEN_ANT = ['ant sh fair', 'ant w28 ftilt', 'ant w28 sh fair', 'ant w28 fsmash', 'ant fsmash', 'ant w28 dash', 'ant rs w4 bite', 'ant w20 fsmash', 'ant w14 fsmash', 'ant w20 grab_f', 'ant dtilt', 'ant w28 usmash'];
  /* can this link start from here? (the first press only: the rest the play-ahead finds out) */
  function startable(link, f) {
    const t0 = link.split(' ')[0], c = coalOf(f);
    if (t0 === 'ro_f' || t0 === 'ro_b') return f.state === 'attack' && f.hitG && f.hitG.size > 0 && f.mname !== 'sspec' && f.mname !== 'swingBite' && !(f.move && f.move.h[0] && f.move.h[0].grab) && (f.grounded || !f.airUse.rope);
    if (t0 === 'ant') return !!c && !antOf(f);   /* a coal still in the air counts: the plan plays on until it lands */
    if (/^coal/.test(t0)) return !c && frame + 24 >= (f.coalReady || 0);
    if (t0 === 'rs') return f.grounded || !f.airUse.rope;
    if (/^(nair|fair|bair|uair|dair|dj|ff)$/.test(t0)) return !f.grounded;
    if (t0 === 'cush') return true;
    if (/^w\d+$/.test(t0)) return true;
    return f.grounded || f.y < 10;   /* a ground move: from the ground, or once he lands */
  }

  /* ---- playing ahead: the game run on from a snapshot with every sound, spark, pop and rumble off (as knellcpu.js) ---- */
  const G = globalThis; let hush = false;
  for (const nm of ['spark', 'rumble', 'sfx', 'beep', 'thwack', 'pop']) { const fn = G[nm]; if (typeof fn === 'function' && !fn.__ccHush) { const w = function () { if (!hush) return fn.apply(this, arguments); }; w.__ccHush = 1; G[nm] = w; } }
  let quietSave = null;
  function quiet() { quietSave = { shake, resim: NET.resim, sparkOff }; hush = true; NET.resim = true; }
  function loud() { const q = quietSave; shake = q.shake; NET.resim = q.resim; sparkOff = q.sparkOff; hush = false; quietSave = null; }
  /* A person's next inputs can't be read: the best picks are played again against DI and SDI held away from Chomp and toward him
     (with the escape buttons mashed as hitstun ends). A pick that only works if they hold still is marked fragile. */
  let pol = null; const POLS = [{ name: 'out', d: -1 }, { name: 'in', d: 1 }];
  function polIn(v, a) {
    const i = blankIn(), tw = sgn(a.x - v.x) || 1, hurt = v.state === 'hurt' || v.hitlag > 0 || v.state === 'held';
    if (hurt) i.lx = pol.d * tw;
    if (v.hitlag > 0 && frame % 2) i.lx = 0;
    if (!hurt && frame % 2 === 0) i[['jmp', 'shd', 'atk'][Math.floor(frame / 2) % 3]] = true;
    return i;
  }
  const CLOCK = typeof performance !== 'undefined' ? performance : Date, LATE = { late: true }; let deadline = 0, dn = 0;
  function simFrame(ci, e, first) {
    if (deadline && (++dn & 7) === 0 && CLOCK.now() > deadline) throw LATE;
    for (const g of F) {
      if (first && g.idx < ci) continue;
      const i = g.idx === ci ? input(e, g, F[1 - ci]) : g.ctl.dev === 'cpu' ? cpuInput(g, F[1 - g.idx], g.ctl.ai) : pol ? polIn(g, F[ci]) : Object.assign({}, g.ctl.c);
      g.ctl.poll(i);
    }
    if (!paused) tick++;
    stepPlay(); K.stats.frames++;
    after(e, F[ci]);
  }

  /* ---- one plan: the snapshot, the links to try and what each came to ---- */
  const learn = new Map();
  function newPlan(f, o, list, kind, hist) {
    const s = NET.save();
    return { hist: hist || [], kind, root: s, ki: f.idx, list, n: 0, res: [], tails: null, pct0: o.pct, hits0: COMBO[f.idx].hits, kos0: f.kos, dies0: o.kos, age: 0, human: o.ctl.dev !== 'cpu', vx0: o.x };
  }
  const bad = P => { const f = F[P.ki], o = F[1 - P.ki]; return o.kos > P.dies0 || f.state === 'hurt' || f.state === 'held' || f.state === 'dead' || f.state === 'respawn'; };
  /* ---- the spike: a down air (straight down) landing with them out past the ledge or under the stage. Chomp is hungry for it:
     a kill by spike is worth SPIKE more than any other kill (so a route that ends in one beats one that ends in a smash), and a
     link that leaves them tumbling near or past the ledge, low enough to chase, is worth a little more on the way (hunger).
     Any kill counts only if the level-10 brain then gets him back to the stage or the ledge. ---- */
  const SPIKE = 400;   /* enough that a spike two links away outbids a plain kill now, when it lands about as surely */
  /* Funny mode (CPU level 11): every bit as careful, but ravenous. A spike is worth far more, any other kill is turned down until
     they are past BORED %, links that carry them out toward the ledge and keep the string going are worth much more, and he will
     go deep off the stage after them (still only when the level-10 brain then gets him back). */
  let FUN = false;
  const SPIKE_F = 1600, BORED = 190, KILLP = 70;
  const spikeV = () => FUN ? SPIKE_F : SPIKE;
  const dull = (sp, v) => FUN && !sp && v.pct < BORED;   /* a kill Funny mode will not take */
  const hurtNow = v => v.state === 'hurt' || v.hitlag > 0 || v.state === 'held';
  const sunk = v => v.y < (v.jumps > 0 ? -55 : -35);   /* out of the spike's hitstun this far under the stage: they are not coming back */
  const spiked = (f, v) => f.mname === 'dair' && (Math.abs(v.x) > EDGE + 1 || v.y < -3);
  function hunger(f, v) {
    if (v.state !== 'hurt' || v.pct < (FUN ? 15 : 40)) return 0;
    const edge = clamp((Math.abs(v.x) - (EDGE - 30)) / 34, 0, 1);   /* nearer the ledge, and past it, the better */
    const out = sgn(v.vx) === sgn(v.x) || Math.abs(v.x) > EDGE ? 1 : 0.35;   /* heading out, not back in */
    const low = v.y < 55 ? 1 : 0.4;   /* low enough that a down air from above still sends them under */
    const up = !f.grounded || f.y + 4 >= v.y ? 1 : 0.6;
    if (FUN) {   /* carried toward the ledge from mid-stage on, and best of all low and past it, not flying up, with him above them */
      const carry = clamp((Math.abs(v.x) - 10) / (EDGE + 10 - 10), 0, 1);
      const flat = v.vy < 1.5 && v.y < 45 ? 1 : v.vy < 3 ? 0.5 : 0.2;
      const over = f.y + 6 >= v.y ? 1 : 0.5;
      return (25 * carry + 70 * edge * flat * over) * out * clamp((v.pct - 15) / 40, 0.5, 1);
    }
    return 12 * edge * out * low * up * clamp((v.pct - 40) / 30, 0.3, 1);
  }
  /* after a kill: the level-10 brain flies him home. False if he is hit or falls before he reaches the stage or the ledge. */
  function home(P) {
    const f = F[P.ki], ci = P.ki;
    if (f.grounded && Math.abs(f.x) < EDGE) return true;
    for (let k = 0; k < 200; k++) {
      if (deadline && (++dn & 7) === 0 && CLOCK.now() > deadline) throw LATE;
      for (const g of F) g.ctl.poll(g.idx === ci ? cpuInput(g, F[1 - ci], g.ctl.ai) : blankIn());
      if (!paused) tick++;
      stepPlay(); K.stats.frames++;
      if (f.state === 'dead' || f.state === 'respawn' || f.state === 'hurt') return false;
      if ((f.grounded && Math.abs(f.x) < EDGE + 1) || f.state === 'ledge') return true;
    }
    return false;
  }
  /* a chase that misses: the same steps with them out of reach of the hit, then the level-10 brain. Does he still get back? */
  function whiff(P, c) {
    NET.load(P.root); const e = exec(c.toks, c.late || 0, c.patience || 40), f = F[P.ki], v = F[1 - P.ki];
    for (let k = 0; k < 160 && !finished(e); k++) { v.invuln = 99; simFrame(P.ki, e, k === 0); if (bad(P)) return false; }
    v.invuln = 0; return home(P);
  }
  /* Funny mode: does this launch take the stock by itself, with nothing more pressed? (the game is put back as it was) */
  function dies(P, e0) {
    const now = NET.save(), e = cpE(e0), f = F[P.ki], v = F[1 - P.ki]; e.drift = 0; let out = false;
    try { for (let k = 0; k < 120; k++) { simFrame(P.ki, e, false); if (f.kos > P.kos0) { out = true; break; } if (bad(P) || (v.state !== 'hurt' && v.hitlag <= 0 && k > 4)) break; } }
    finally { NET.load(now); }
    return out;
  }
  /* plays one candidate to its last hit; null if it misses, is shielded, lets the combo drop or gets Chomp hit */
  function leaf(P, c, keep) {
    NET.load(P.root); const e = exec(c.toks, c.late || 0, c.patience || 40);
    const f = F[P.ki], v = F[1 - P.ki], ci = P.ki; K.stats.sims++;
    let prev = COMBO[ci].hits, vs = v.state, t = 0, settle = -1, sp = false, h0 = P.hits0, got = false, deep = false;
    const fresh = !hurtNow(v);   /* they are not in a combo: the counter of the last one may still run down to nothing first */
    const lim = c.lim || 140;
    for (let k = 0; k < (deep ? lim + 120 : lim); k++, t++) {
      simFrame(ci, e, k === 0);
      if (f.kos > P.kos0) {
        /* a kill counts with them still tumbling; a spike's also once they are free, when they came out of it sunk too deep to
           come back (sunk), or when it is a CPU's own recovery that failed */
        if (vs !== 'hurt' && v.state !== 'hurt' && !(sp && (deep || (!P.human && !pol)))) return why(c, 'ko-free');
        if (dull(sp, v)) return why(c, 'dull-ko');
        if (!home(P)) return why(c, 'no-way-back');   /* a kill he falls after is not one he wants */
        return { c, ko: true, spike: sp, t, score: 1000 - t + (sp ? spikeV() : 0) };
      }
      if (bad(P) || e.failed >= 0) return why(c, bad(P) ? 'bad' : 'failed:' + e.toks[e.failed]);
      const h = COMBO[ci].hits;
      if (h < prev) { if (sp && got && sunk(v)) { deep = true; prev = h; } else if ((fresh || P.kind === 'open') && !got) { h0 = 0; prev = 0; } else return why(c, 'dropped@' + e.cur); }   /* spiked under, or a new combo: not a dropped one */
      if (h > prev) { sp = spiked(f, v); got = true; } prev = h; vs = v.state;
      if (deep) continue;   /* spiked too deep to come back: play on to the blast line */
      if (finished(e)) {
        /* a link that ends in a coal or ant on its way (a toss): give it a little longer to land */
        if (h <= h0 && c.settle && settle < c.settle) { settle++; continue; }
        if (h <= h0) return why(c, 'missed');
        const adv = v.state === 'hurt' ? (v.hitstun - v.sf) - (f.state === 'attack' && f.move ? Math.max(0, f.move.t - f.mf) : 0) : -10;
        let sc = (v.pct - P.pct0) + clamp(adv, -10, 30) * 0.35;
        const kp = clamp((v.pct - 70) / 80, 0, 1); sc += kp * (Math.max(0, Math.abs(v.x) - 20) * 0.25 + Math.max(0, v.y - 20) * 0.15);
        if (!f.grounded && Math.abs(f.x) > EDGE + 6 && f.y < 4 && !(FUN && f.jumps > 0)) sc -= f.jumps > 0 ? 6 : 20;   /* chasing out past the ledge low, with nothing to come back on */
        if (v.pct >= 100) sc += clamp((v.pct - 100) / 50, 0.3, 1) * (Math.hypot(v.vx, v.vy) * 2 + Math.max(0, Math.abs(v.x) - 30) * 0.3 + Math.max(0, v.y - 30) * 0.2);
        sc += hunger(f, v) + (sp ? 6 : 0);
        if (FUN) sc += 4 * Math.min(h - P.hits0, 10) + (sp ? 30 : 0);   /* the longer the string, the funnier */
        sc += c.bonus || 0;
        if (FUN && !sp && v.pct >= KILLP && v.pct < BORED && v.state === 'hurt' && dies(P, e)) return why(c, 'dull-ko');   /* it would take the stock the dull way, later */
        if (keep) keep.snap = NET.save();
        return { c, ko: false, t, score: sc, h, vp: v.pct, snap: v.pct >= 50 || sp, speed: Math.hypot(v.vx, v.vy) + (sp ? 40 : 0), sp, e: cpE(e) };
      }
    }
    return why(c, 'long');
  }
  /* the rest of a known route played out in full: how far it gets against this opponent (it stops where the combo drops) */
  function roll(P, toks) {
    NET.load(P.root); const e = exec(toks, 0, 40); const f = F[P.ki], v = F[1 - P.ki], ci = P.ki; K.stats.sims++;
    let prev = COMBO[ci].hits, best = 0, dmg = 0, vs = v.state, sp = false, h0 = P.hits0, got = false, deep = false;
    const fresh = !hurtNow(v);
    for (let k = 0; k < 700; k++) {
      simFrame(ci, e, k === 0);
      if (f.kos > P.kos0) return { hits: best, dmg, ko: (vs === 'hurt' || v.state === 'hurt' || (sp && deep)) && !dull(sp, v), spike: sp };
      if (bad(P) || e.failed >= 0) break;
      const h = COMBO[ci].hits;
      if (h < prev) { if (sp && got && sunk(v)) { deep = true; prev = h; } else if ((fresh || P.kind === 'open') && !got) { h0 = 0; prev = 0; } else break; }
      if (deep) { if (k > 400) break; continue; }
      if (h > prev) { sp = spiked(f, v); got = true; } prev = h; vs = v.state;
      if (h - h0 > best) { best = h - h0; dmg = v.pct - P.pct0; }
      if (finished(e) && k > 0) { if (v.state !== 'hurt' && v.hitlag <= 0) break; }
    }
    return { hits: best, dmg, ko: false };
  }
  const fut = r => { if (r.base === undefined) r.base = r.score; r.score = r.base + Math.max(r.fd || 0, r.fr || 0); };
  const why = (c, r) => { if (K.why) { const k = c.link + ' => ' + r; K.why[k] = (K.why[k] || 0) + 1; } return null; };
  /* after the best few: does the launch alone take the stock, still in hitstun? Nothing more is pressed. */
  function tail(P, r) {
    const r2 = leaf(P, r.c); if (!r2 || r2.ko) return !!(r2 && r2.ko);
    const e = cpE(r2.e); e.drift = 0; const f = F[P.ki], v = F[1 - P.ki]; let prev = COMBO[P.ki].hits, vs = v.state, deep = false;
    for (let k = 0; k < (deep ? 230 : 110); k++) {
      simFrame(P.ki, e, false);
      if (f.kos > P.kos0) return (vs === 'hurt' || deep) && !dull(r2.sp, v) && home(P);
      if (bad(P)) return false;
      const h = COMBO[P.ki].hits;
      if (h < prev) { if (r2.sp && sunk(v)) deep = true; else return false; }   /* out of a spike's hitstun too deep to come back */
      prev = h; vs = v.state;
    }
    return false;
  }
  function work(P, n) {
    const now = P.age === 0 ? P.root : NET.save();
    quiet(); const fr0 = K.stats.frames, t0 = CLOCK.now(); deadline = K.ms ? t0 + K.ms * 1.6 : 0;
    try {
      while (K.stats.frames - fr0 < n && !(K.ms && CLOCK.now() - t0 > K.ms)) {
        if (P.chase && P.n < P.list.length && (P.list[P.n].late || 0) < P.age) { P.n++; continue; }
        if (P.n < P.list.length) { P.cur = { q: 'leaf' }; const r = leaf(P, P.list[P.n++]); if (r) P.res.push(r); continue; }
        /* each known route that carries on from here, played to its end: its next link is credited with where it really leads */
        if (!P.rq) { P.rq = []; const L = P.hist.length;
          for (const rt of RL) { if (rt.length <= L + 1) continue; let ok = true; for (let k = 0; k < L; k++) if (rt[k] !== P.hist[k]) { ok = false; break; }
            if (!ok) continue; const rs = P.res.filter(r => !r.ko && r.c.links.every((l, n) => rt[L + n] === l));
            if (rs.length) P.rq.push({ rs, toks: rt.slice(L).join(' ').split(' ') }); } }
        if (P.rq.length) { const j = P.rq[0]; P.cur = { q: 'roll' }; const o = roll(P, j.toks); P.rq.shift();
          for (const r of j.rs) { const own = r.vp - P.pct0, v = (o.ko ? 400 + (o.spike ? spikeV() * 0.7 : 0) : 0) + 0.8 * Math.max(0, o.dmg - own) + 2 * Math.max(0, o.hits - (r.h - P.hits0));
            if (v > (r.fr || 0)) { r.fr = v; r.rolled = o; fut(r); } }
          continue; }
        if (!P.tails) { const sm = r => /smash/.test(r.c.last) ? 50 : 0;
          P.tails = P.res.filter(r => !r.ko && r.snap && !(FUN && !r.sp && P.pct0 < BORED)).sort((a, b) => (b.speed + sm(b)) - (a.speed + sm(a))).slice(0, P.pct0 >= 150 || FUN ? 10 : P.pct0 >= 90 ? 6 : 3); }
        if (P.tails.length) { const r = P.tails.shift(); P.cur = { q: 'tail', r }; if (tail(P, r)) { r.ko = true; r.spike = r.sp; r.score = 900 - r.t + (r.c.bonus || 0) + (r.sp ? spikeV() : 0); } continue; }
        /* a second link from where each of the best few ends: a link is worth what it leads to (the planner looks two links ahead) */
        /* a chase: each kill on offer, best first, played again as a miss; one he would not get back from is dropped */
        if (P.chase && !P.sq) P.sq = P.res.filter(r => r.ko).sort((a, b) => b.score - a.score).slice(0, 6);
        if (P.sq && P.sq.length) { const r = P.sq.shift(); P.cur = { q: 'safe', r }; if (whiff(P, r.c)) r.safe = true; else { r.ko = false; K.stats.unsafe = (K.stats.unsafe || 0) + 1; } continue; }
        if (!P.dq) { P.dq = [];
          const top = P.res.filter(r => !r.ko).sort((a, b) => b.score - a.score).slice(0, P.kind === 'open' ? 4 : 3);
          for (const r of top) P.dq.push({ r, q: 'init' }); }
        if (P.dq.length) { const j = P.dq[0]; P.cur = { q: 'deep', j };
          if (j.q === 'init') { const k = {}; const r2 = leaf(P, j.r.c, k);
            P.dq.shift();
            if (r2 && k.snap) { const hist = P.hist.concat(j.r.c.links);
              const C = { root: k.snap, ki: P.ki, kind: 'confirm', hits0: r2.h, pct0: r2.vp, kos0: P.kos0, dies0: P.dies0, human: P.human, hist };
              NET.load(k.snap); const list = followUps(F[P.ki], F[1 - P.ki], hist, 'confirm').slice(0, 28);
              j.r.kids = { C, n: list.length, best: null };
              for (const c of list) P.dq.push({ r: j.r, q: 'kid', c, C }); }
            continue; }
          P.dq.shift(); const r3 = leaf(j.C, j.c); const kd = j.r.kids;
          if (r3 && (!kd.best || r3.score > kd.best.score)) kd.best = r3;
          if (--kd.n === 0 && kd.best) { j.r.fd = 0.7 * kd.best.score; fut(j.r); j.r.next = kd.best.c.link; }
          continue; }
        /* the fragility check, best first, until one holds up against both ways out (for a CPU too: its brain rolls dice) */
        if (!P.rob) P.rob = P.res.slice().sort((a, b) => b.score - a.score).slice(0, 5).flatMap(r => POLS.map(p => ({ r, p })));
        if (P.rob.length) { const q = P.rob.shift(); if (q.r.fragile) continue; P.cur = { q: 'rob', r: q };
          if (P.human || P.kind !== 'open') { pol = q.p; try { if (!leaf(P, q.r.c)) { q.r.fragile = true; K.stats.fragile++; } } finally { pol = null; } }
          if (!q.r.fragile && q.p === POLS[POLS.length - 1]) P.rob = [];
          continue; }
        return true;
      }
      return false;
    } catch (x) {
      if (x !== LATE) throw x;
      const c = P.cur; if (c && c.q === 'leaf') P.n--; else if (c && c.q === 'tail') P.tails.unshift(c.r); else if (c && c.q === 'rob') P.rob.unshift(c.r); else if (c && c.q === 'safe') P.sq.unshift(c.r);
      /* a deep job stays at the head of its queue and runs again */
      pol = null; return false;
    } finally { deadline = 0; P.cur = null; NET.load(now); loud(); }
  }
  function pick(P) {
    const sc = r => r.score - (r.fragile ? 60 : 0);   /* a sure link beats a better one they can DI out of */
    const live = r => (!P.chase || (r.ko && r.safe)) && (P.kind !== 'free' || (r.c.late || 0) >= P.age);   /* a wait that has already gone by is no longer on offer; a chase is for the kill only */
    let best = null; for (const r of P.res) if (live(r) && (!best || sc(r) > sc(best))) best = r;
    for (const r of P.res) { const l = learn.get(r.c.key) || { ok: 0, bad: 0 }; l.ok++; learn.set(r.c.key, l); }
    for (let n = 0; n < P.n; n++) { const c = P.list[n]; if (!P.res.some(r => r.c === c)) { const l = learn.get(c.key) || { ok: 0, bad: 0 }; l.bad++; learn.set(c.key, l); } }
    if (best) { K.stats.picked++; if (P.chase) K.stats.chases++; if (best.ko) K.stats.kos++; if (best.ko && best.spike) K.stats.spikes++; if (best.c.route) K.stats.routed++; } else K.stats.none++;
    if (K.log) K.log.push({ frame, kind: P.chase ? 'chase' : P.kind, mv: F[P.ki].mname, tried: P.n, of: P.list.length, ok: P.res.length, vpct: +F[1 - P.ki].pct.toFixed(0), vx: Math.round(F[1 - P.ki].x), vy: Math.round(F[1 - P.ki].y), best: best && best.c.link, route: best && !!best.c.route, ko: best && best.ko, spike: best && !!best.spike, fragile: best && !!best.fragile, score: best && +best.score.toFixed(1),
      res: K.dbg ? P.res.map(r => r.c.link + ' ' + r.score.toFixed(0) + (r.ko ? ' KO' : '') + (r.fragile ? ' f' : '')).join(', ') : undefined });
    P.chosen = best ? best.c : null; P.best = best; P.next = best && best.next || null;
    return best ? exec(best.c.toks, Math.max(0, (best.c.late || 0) - (P.kind === 'free' ? P.age : 0)), best.c.patience || 40) : null;
  }
  /* a candidate: a link (or links, for an opener), and what makes it worth more */
  function cand(link, hist, kind, extra) {
    const toks = link.split(' '), last = toks.filter(t => HIT.has(t)).pop() || toks[toks.length - 1];
    let bonus = 0, route = null;
    const links = cut(link); let h = hist.slice();
    for (const l of links) { const on = onRoute(h, l); if (!on) { route = null; break; } route = on; h.push(l); }
    if (route) bonus += 8 + 2 * Math.min(route.more, 6) + 2 * links.length;   /* the playtest's routes: carry on along one */
    const key = kind + '|' + (hist.length ? hist[hist.length - 1] : '') + '>' + link;
    return Object.assign({ link, toks, last, bonus, route: !!route, links, key, settle: /^(coal|ant)/.test(toks[toks.length - 1]) ? 50 : 0 }, extra || {});
  }
  function order(list) {
    list.forEach((c, n) => { const l = learn.get(c.key); c.pri = (c.route ? 20 : 0) + (l ? l.ok * 3 - l.bad * 0.15 : 0) - n * 0.01; });
    return list.sort((a, b) => b.pri - a.pri);
  }
  const LATES = [0, 4, 9, 15];
  /* the link the last plan expected to follow with: tried first and worth a little more, so a path he chose is carried through */
  function aim(list, next) {
    if (!next) return list; const hit = [], rest = [];
    for (const c of list) (c.link === next ? hit : rest).push(c);
    for (const c of hit) { c.bonus = (c.bonus || 0) + 6; }
    return hit.concat(rest);
  }
  function followUps(f, o, hist, kind) {
    const seen = new Set(), out = [];
    const add = l => { if (seen.has(l) || !startable(l, f)) return; seen.add(l); out.push(cand(l, hist, kind)); };
    for (const l of LINKS) add(l);
    for (const l of (f.grounded ? GEN_G : GEN_A)) add(l);
    if (f.state === 'attack') for (const l of GEN_RO) add(l);
    if (!f.grounded && f.state === 'attack' && f.y < 14) for (const l of GEN_G) add(l);   /* an aerial that lands: a ground move after */
    for (const l of GEN_ANT) add(l);
    if (kind !== 'free') return order(out);
    /* free with them still in hitstun: the same links after a wait, so he can let them fall to him (the plan keeps looking while he waits) */
    const base = order(out), all = [];
    for (const c of base) for (const L of LATES) all.push(L ? Object.assign({}, c, { late: L, key: c.key + '+' + L }) : c);
    return all;
  }
  /* openers: the playtest's starters (two or three links, so it knows where they lead), the kill confirms, plain hits, and the ant */
  function openers(f, o) {
    const out = [], seen = new Set(), c = coalOf(f), add = (l, x) => { if (seen.has(l) || !startable(l, f)) return; seen.add(l); out.push(cand(l, [], 'open', x)); };
    for (const r of RL) add(r[0]);   /* the first link only: the next is chosen once it hits, with time to look ahead (a throw's or swing's length) */
    for (const l of ['coalH grab_f', 'coalH grab_d', 'coalH grab_u', 'coalH dtilt', 'coalH utilt', 'coalH ftilt', 'coal grab_f', 'coalL dtilt', 'coalH', 'coal']) add(l);
    for (const l of ['dtilt', 'jab', 'ftilt', 'utilt', 'grab_f', 'grab_d', 'grab_u', 'grab_b', 'dash', 'sh fair', 'sh nair', 'sh bair']) add(l);
    if (o.pct >= 70 && !(FUN && o.pct < BORED)) for (const l of ['fsmash', 'usmash', 'dsmash']) add(l);
    for (const c of out) { const v = rcFor(o, c.link); if (v >= 0) c.bonus = 4 + 0.6 * v; }   /* where the route it starts has been seen to lead */
    if (c && c.st === 'ground') for (const l of GEN_ANT.concat(['ant w8 fsmash', 'ant w34 fsmash', 'ant w28 grab_f', 'ant w28 dtilt'])) add(l);
    return order(out);
  }

  /* ---- what each known route is worth from here, learnt in spare frames ----
     In neutral, on a frame with nothing else to plan, one route is played ahead in full from where they both stand. What it came to
     (damage, and a KO) is kept for this opponent and percent band, and an opener is credited with the best route its first link starts. */
  const RC = new Map();
  const band = o => Math.min(9, Math.floor(o.pct / 20));
  const rkey = (o, ri) => o.def.name + '|' + band(o) + '|' + ri;
  function bg(f, o, s) {
    const L = []; for (let ri = 0; ri < RL.length; ri++) if (RL[ri].length > 1 && startable(RL[ri][0], f)) L.push(ri);
    if (!L.length) return;
    s.bi = ((s.bi || 0) + 1) % L.length; const ri = L[s.bi], P = newPlan(f, o, [], 'open', []); P.hits0 = COMBO[f.idx].hits;
    let r = null; busy = true; quiet(); deadline = K.ms ? CLOCK.now() + K.ms : 0;
    try { r = roll(P, RL[ri].join(' ').split(' ')); } catch (x) { if (x !== LATE) throw x; } finally { deadline = 0; NET.load(P.root); loud(); busy = false; }
    K.stats.bg++;
    if (!r || r.hits < 1) return;   /* the first link missed from here: it says nothing about the route */
    const v = r.dmg + (r.ko ? 400 + (r.spike ? spikeV() * 0.7 : 0) : 0), k = rkey(o, ri), old = RC.get(k);
    RC.set(k, old === undefined ? v : old * 0.6 + v * 0.4);
  }
  K.run = { exec, input, after, finished };   /* tests: drive Chomp through tokens by hand */
  K.warm = (f, o, n) => { const s = st(f); for (let k = 0; k < n; k++) bg(f, o, s); };   /* tests: what a match's spare frames would have learnt */
  K.rc = RC;
  function rcFor(o, link) { let best = -1; for (let ri = 0; ri < RL.length; ri++) if (RL[ri][0] === link) { const v = RC.get(rkey(o, ri)); if (v !== undefined && v > best) best = v; } return best; }

  /* ---- each frame, from cpuInput ---- */
  const S = new WeakMap();
  const st = f => { let s = S.get(f.ctl); if (!s) S.set(f.ctl, s = { e: null, issued: false, plan: null, key: '', hist: [], hh: 0, nt: 0, ledgeT: -1, wasLedge: false, goal: null }); return s; };
  let busy = false;
  const online = () => typeof NET !== 'undefined' && NET.session && NET.session();
  const gone = v => v.state === 'dead' || v.state === 'respawn';
  const funnyLv = m => { const L = typeof CPU_LV !== 'undefined' && CPU_LV[m.lv || CPU_LEVEL]; return !!(L && L.funny); };
  K.input = function (f, o, m) {
    if (K.off || busy || NET.resim || F.length !== 2 || online() || mode !== 'play') return null;
    FUN = funnyLv(m);
    const s = st(f);
    if (s.e && s.issued) after(s.e, f);
    s.issued = false;
    if (f.state === 'hurt' || f.state === 'held' || gone(f) || gone(o)) { s.e = null; s.plan = null; s.goal = null; return null; }
    if (s.e && (finished(s.e) || s.e.failed >= 0)) { if (s.e.h0 !== undefined) { if (COMBO[f.idx].hits > s.e.h0 && s.e.failed < 0) K.stats.landed++; else K.stats.dropped++; } s.e = null; }
    if (s.e) { s.issued = true; return input(s.e, f, o); }
    const hits = COMBO[f.idx].hits, hurt = o.state === 'hurt' || o.hitlag > 0;
    if (hits < s.hh || hits === 0) s.hist = []; s.hh = hits;
    /* a fresh hit: plan the next link, once per hit (out of a move that hit, or free with them still in hitstun) */
    if (!s.plan && hurt && hits > 0) {
      const key = hits + ':' + f.mname + ':' + f.state;
      const inMove = (f.state === 'attack' && f.hitG && f.hitG.size > 0) || f.state === 'throw', isFree = free(f);
      if ((inMove || isFree || f.state === 'land') && s.key !== key) { s.key = key; s.plan = newPlan(f, o, aim(followUps(f, o, s.hist, isFree ? 'free' : 'confirm'), s.next), isFree ? 'free' : 'confirm', s.hist); s.next = null; K.stats.plans++; }
    }
    if (s.plan) {
      const P = s.plan; busy = true; let done;
      try { done = work(P, K.budget); } finally { busy = false; }
      P.age++;
      const could = roOK(f) || free(f) || jabNext(f, 'jab') || jabNext(f, 'jab2') || (f.state !== 'attack' && f.state !== 'land' && f.state !== 'hold' && f.state !== 'throw');
      let go = done || P.age > (P.chase ? P.cap : 45);
      if (!go && P.chase) {   /* a chase: go once the best kill still on offer is due, or nothing later is left to try */
        let b = null; for (const r of P.res) if (r.ko && r.safe && (r.c.late || 0) >= P.age && (!b || r.score > b.score)) b = r;
        let more = false; for (let n = P.n; n < P.list.length && !more; n++) if ((P.list[n].late || 0) > P.age) more = true;
        go = (!more && P.tails && !P.tails.length && P.sq && !P.sq.length) || (b && (b.c.late || 0) <= P.age);
      } else if (!go && P.kind === 'free') {   /* free: pick once the best still on offer is due now, or nothing later is left to try */
        let b = null; for (const r of P.res) if ((r.c.late || 0) >= P.age && (!b || r.score - (r.fragile ? 60 : 0) > b.score - (b.fragile ? 60 : 0))) b = r;
        let more = false; for (let n = P.n; n < P.list.length && !more; n++) if ((P.list[n].late || 0) > P.age) more = true;
        go = !more || (b && (b.c.late || 0) <= P.age) || o.state !== 'hurt' && o.hitlag <= 0;
      } else if (!go) go = could;
      if (go) {
        s.plan = null; busy = true; let e; try { e = pick(P); } finally { busy = false; }
        if (P.chosen) s.hist = s.hist.concat(P.chosen.links); s.next = P.next;
        if (e) { s.e = e; e.h0 = COMBO[f.idx].hits; s.issued = true; return input(s.e, f, o); }
        return null;
      }
      return input(exec([], 0), f, o);
    }
    return null;
  };

  /* ---- neutral: the level-10 brain has chosen this frame's input; the planner may put a better one in its place ---- */
  const MAINX = EDGE - 2;
  const onMain = f => f.grounded && f.plat === MAIN;
  function runOpen(f, o, s, list, budget) {
    if (!list.length) return null;
    s.hist = []; s.hh = COMBO[f.idx].hits;
    const P = newPlan(f, o, list, 'open', []); P.hits0 = COMBO[f.idx].hits; P.first = true; K.stats.openers++;
    busy = true; try { work(P, budget || K.open); } finally { busy = false; }
    const e = (() => { busy = true; try { return pick(P); } finally { busy = false; } })();
    if (!e) return null;
    s.hist = P.chosen.links.slice(); s.next = P.next; s.e = e; e.h0 = COMBO[f.idx].hits; s.issued = true; return input(s.e, f, o);
  }
  /* off the stage after them: the run-offs and jumps to a down air, kept only if it kills (the way back checked too) */
  const CHASE = ['aim', 'aimL', 'fh aim', 'fh aimL', 'sh aim', 'sh aimL', 'rf2 fh aim', 'rf2 sh aim', 'wf3 fh aimL', 'w6 aim', 'w12 aim', 'w12 fh aim'];
  const CHASE_F = ['rf4 w8 aim', 'rf6 w14 aimL', 'w20 aim', 'w20 fh aimL', 'fh w10 aimL', 'rf2 fh w8 aimL', 'sh w8 aimL', 'w30 aim'];   /* Funny mode: later and deeper */
  /* Funny mode's chase: the same down airs after waits, planned over the next frames (as the free plan is) so the play-ahead
     has the time to see each one through to the blast line; only a kill he comes back from is taken. While it plans he holds
     still on the ground or drifts after them in the air, as the waits do. */
  const CH_G = ['sh dairF', 'sh s4 dairF', 'sh s8 dairF', 'sh s14 dairF', 'sh s20 dairF', 'fh dairF', 'fh s6 dairF', 'fh s12 dairF', 'fh s18 dairF', 'fh s24 dairF',
    'sh s6 dair', 'fh s12 dair', 'fh dj s6 dairF', 'fh s10 dj s4 dairF', 'aim', 'aimL', 'sh aim', 'fh aim', 'fh aimL', 'rf3 aim', 'rf3 aimL'];
  const CH_A = ['dairF', 's3 dairF', 's6 dairF', 's10 dairF', 's14 dairF', 's20 dairF', 'ff s6 dairF', 'ff s12 dairF', 'dj dairF', 'dj s4 dairF', 'dj s10 dairF', 'dj s16 dairF', 'aim', 'aimL', 'dair'];
  function startChase(f, o, s) {
    if (s.plan || frame < (s.chaseT || 0)) return false;
    const gr = f.grounded, lates = gr ? [0, 5, 10, 15, 20, 26, 32] : [0, 4, 8, 12];
    const base = (gr ? CH_G : CH_A).filter(x => startable(x, f)).map(x => cand(x, [], 'chase', { lim: 220 }));
    if (!base.length) return false;
    const list = []; for (const L of lates) for (const c of base) list.push(L ? Object.assign({}, c, { late: L, key: c.key + '+' + L }) : c);
    const P = newPlan(f, o, list, 'free', []); P.chase = true; P.cap = gr ? 34 : 14; P.rq = []; P.dq = []; P.rob = [];   /* the tails stay: a spike's link ends at the hit, the tail plays it on to the blast line */
    s.plan = P; s.hist = []; s.hh = COMBO[f.idx].hits; s.key = ''; s.chaseT = frame + (gr ? 4 : 24); K.stats.plans++;
    return true;
  }
  function runChase(f, o, s, list) {
    if (!list.length) return null;
    const P = newPlan(f, o, list, 'open', []); P.hits0 = COMBO[f.idx].hits; K.stats.openers++;
    busy = true; quiet(); const now = NET.save(); let best = null; deadline = K.ms ? CLOCK.now() + K.ms : 0;
    try { for (const c of list) { const r = leaf(P, Object.assign({}, c, { lim: FUN ? 200 : 160 })); if (r && r.ko && (!best || r.score > best.score)) best = r; } }
    catch (x) { if (x !== LATE) throw x; }   /* out of time this frame: what it found so far */
    finally { deadline = 0; NET.load(now); loud(); busy = false; }
    if (!best) return null;
    K.stats.picked++; K.stats.kos++; if (best.spike) K.stats.spikes++;
    if (K.log) K.log.push({ frame, kind: 'chase', best: best.c.link, ko: true, spike: !!best.spike, score: +best.score.toFixed(1), vpct: +o.pct.toFixed(0) });
    s.hist = []; s.next = null; s.e = exec(best.c.toks, 0, 40); s.e.h0 = COMBO[f.idx].hits; s.issued = true; return input(s.e, f, o);
  }
  /* where a toss would leave the coal: each way of throwing it played out, scored for landing just past the opponent (or hitting them) */
  function placeCoal(f, o, s) {
    const TOSS = ['coal', 'coalH', 'coalL', 'coal relay', 'coalH relay', 'coalH relay relay', 'coalH relay relay relay', 'coal relay relay'];
    const root = NET.save(), dir = toward(f, o); let best = null;
    busy = true; quiet();
    try {
      for (const r of TOSS) {
        NET.load(root); const e = exec(r.split(' '), 0, 30), h0 = COMBO[f.idx].hits; let hit = false, c = null;
        for (let k = 0; k < 170; k++) {
          simFrame(f.idx, e, k === 0);
          if (bad({ ki: f.idx, dies0: o.kos })) break;
          if (COMBO[f.idx].hits > h0) { hit = true; break; }
          c = coalOf(f); if (finished(e) && (!c || c.st === 'ground')) break;
        }
        const live = F[1 - f.idx];
        let sc = -1e9;
        if (hit) sc = 40;
        else if (c && c.st === 'ground' && Math.abs(c.x) < MAINX) {
          const past = (c.x - live.x) * dir;   /* how far beyond them it lies (ahead of Chomp, behind the opponent) */
          sc = past > 2 && past < 40 ? 30 - Math.abs(past - 14) : past >= -6 ? 4 - Math.abs(past) * 0.3 : -20;
        }
        if (!best || sc > best.sc) best = { r, sc };
      }
    } finally { NET.load(root); loud(); busy = false; }
    return best && best.sc > 5 ? best.r : null;
  }
  /* Funny mode: in kill range the brain's own swings are held back (they would take the stock the dull way); only the planner's
     picks, which turn down a dull kill, and the spike chases go out. Shields, jumps, dodges, grabs and movement still go through. */
  K.opener = function (f, o, m, i) {
    const r = opener0(f, o, m, i);
    if (!FUN || r !== i || o.pct < KILLP || o.pct >= BORED) return r;
    const s = st(f); if (s.e) return r;
    const j = Object.assign({}, i); j.atk = j.spc = j.sm = false; j.cx = j.cy = 0; return j;
  };
  function opener0(f, o, m, i) {
    if (K.off || busy || NET.resim || F.length !== 2 || online() || mode !== 'play') return i;
    FUN = funnyLv(m);
    const s = st(f); if (s.e || s.plan) return i;
    if (f.state === 'hurt' || f.state === 'held' || gone(f) || gone(o)) return i;
    s.nt++;
    const dx = o.x - f.x, ad = Math.abs(dx), dy = o.y - f.y, c = coalOf(f), a = antOf(f);
    const threat = o.state === 'attack' && ad < 26 && Math.abs(dy) < 20;   /* something coming at him: the brain shields and dodges as it does */
    /* the ledgetrap: they hang on the ledge. Coal to the ledge from 48 back; the ant called 12 frames after they let go. */
    const side = sgn(o.x) || 1;
    if (o.state === 'ledge') { if (!s.wasLedge) s.ledgeT = -1; s.wasLedge = true; }
    else if (s.wasLedge) { s.wasLedge = false; s.ledgeT = frame; }
    if (onMain(f) && free(f)) {
      if (s.ledgeT >= 0 && frame - s.ledgeT === 12 && c && c.st === 'ground' && !a && Math.abs(c.x - side * EDGE) < 18) {
        s.e = exec(['ant'], 0, 6); s.e.h0 = COMBO[f.idx].hits; s.issued = true; K.stats.traps++; s.hist = []; return input(s.e, f, o);
      }
      if (s.ledgeT >= 0 && frame - s.ledgeT > 40) s.ledgeT = -1;
      if (o.state === 'ledge') {
        const spot = side * 20;
        if (!c && frame >= (f.coalReady || 0)) {
          if (Math.abs(f.x - spot) > 2.5) { const j = blankIn(); j.lx = sgn(spot - f.x) * (Math.abs(f.x - spot) > 12 ? 1 : 0.5); return j; }
          s.e = exec(['coalH'], 0, 20); s.e.h0 = COMBO[f.idx].hits; s.issued = true; K.stats.tosses++; return input(s.e, f, o);
        }
        if (c && c.st === 'ground' && Math.abs(c.x - side * EDGE) < 18) {   /* the coal is at the ledge: wait back at the spot, facing it */
          if (Math.abs(f.x - spot) > 2.5) { const j = blankIn(); j.lx = sgn(spot - f.x) * 0.5; return j; }
          if (f.face !== side) { const j = blankIn(); j.lx = 0.3 * side; return j; }
          return blankIn();
        }
        if (c && c.st !== 'ground') return blankIn();   /* the coal on its way */
      }
      /* the edgeguard: they are below or beside the stage, coming back. He stands at the ledge and swings when it would land. */
      const off = !o.grounded && o.state !== 'ledge' && (Math.abs(o.x) > EDGE + 2 || o.y < -4) && Math.abs(o.x) < EDGE + (FUN ? 110 : 70);
      if (off && o.pct >= (FUN ? 0 : 40)) {
        const spot = side * (EDGE - 5);
        if (Math.abs(f.x - spot) > 3) { const j = blankIn(); j.lx = sgn(spot - f.x); return j; }
        if (!(FUN && o.pct < BORED) && s.nt % 2 === 0 && Math.abs(o.x - f.x) < 40 && o.y > -30) {
          const l = ['fsmash', 'dsmash', 'ftilt', 'dtilt', 'jab', 'usmash'].filter(x => startable(x, f)).map(x => cand(x, [], 'guard'));
          const r = runOpen(f, o, s, order(l), 600); if (r) { K.stats.guards++; return r; }
        }
        if (FUN ? s.nt % 2 === 1 && Math.abs(o.x - f.x) < 125 && o.y > -95 && o.y < 70 : s.nt % 6 === 3 && o.pct >= 50 && Math.abs(o.x - f.x) < 75 && o.y > -45 && o.y < 50) {   /* or off after them: a spike, if it kills and he gets back */
          if (FUN) { if (startChase(f, o, s)) return blankIn(); }
          else { const l = CHASE.filter(x => startable(x, f)).map(x => cand(x, [], 'guard'));
          const r = runChase(f, o, s, l); if (r) { K.stats.chases++; return r; } }
        }
        if (f.face !== side) { const j = blankIn(); j.lx = 0.3 * side; return j; }
        return blankIn();
      }
    }
    /* Funny mode, in the air with them off the stage and no combo on: after them for the spike, as deep as he can come back from */
    if (FUN && !f.grounded && free(f) && f.jumps > 0 && !o.grounded && o.state !== 'ledge' && (Math.abs(o.x) > EDGE + 2 || o.y < -4) && Math.abs(o.x - f.x) < 90 && Math.abs(o.y - f.y) < 90) {
      if (startChase(f, o, s)) return i;
    }
    if (!f.grounded || !free(f) || o.invuln > 0 || threat) return i;
    /* a coal lying down: stand so they are between him and the coal, then the ant and what follows */
    if (c && c.st === 'ground' && !a && o.grounded && Math.abs(c.x - o.x) < 70) {
      const csd = sgn(c.x - o.x) || 1, far = -csd;   /* the side of them away from the coal */
      if (sgn(f.x - o.x) === far && ad < 46 && Math.abs(dy) < 8) {
        if (s.nt % 3 === 0) { const r = runOpen(f, o, s, openers(f, o)); if (r) { K.stats.ants++; return r; } }
        if (ad > 26) { const j = blankIn(); j.lx = sgn(dx) * 0.5; return j; }
      }
    }
    /* close in: the opener that lands best */
    if (ad < 28 && Math.abs(dy) < 14 && (i.atk || i.spc || i.grb || s.nt % 3 === 0)) {
      const r = runOpen(f, o, s, openers(f, o)); if (r) return r;
    } else if (ad < 70 && Math.abs(dy) < 30 && s.nt % 2) bg(f, o, s);
    /* at range with no coal out: put it down past them */
    if (!c && frame >= (f.coalReady || 0) && ad > 34 && ad < 105 && o.grounded && s.nt % 20 === 0 && Math.abs(o.x) < EDGE - 4) {
      const r = placeCoal(f, o, s);
      if (r) { s.e = exec(r.split(' '), 0, 30); s.e.h0 = COMBO[f.idx].hits; s.issued = true; s.hist = []; K.stats.tosses++; return input(s.e, f, o); }
    }
    /* holding a coal position: keep the coal between, not walking over it (walking over it picks it up) */
    if (c && c.st === 'ground' && !a && f.grounded && Math.abs(c.x - f.x) < 7 && sgn(o.x - f.x) === sgn(c.x - f.x) && i.lx && sgn(i.lx) === sgn(c.x - f.x) && ad > 20) { const j = Object.assign({}, i); j.lx = 0; return j; }
    return i;
  }
  return K;
})();
