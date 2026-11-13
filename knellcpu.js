'use strict';
/* Knell as the CPU at level 10. Level 10 is the sharpest set of numbers (sim.js: CPU_LV[10]); for Knell it adds a planner on
   top of that brain. It only ever chooses inputs, the same buttons and stick a player has: nothing about Knell, his moves
   or the rules is changed, and it reads nothing a player could not see on screen.

   How it chooses: the moment one of his moves connects cleanly, it saves the game (net.js's rollback snapshot), plays every
   follow-up it knows out a few dozen frames ahead (a Hinge in each direction, then each ground move, short-hop or full-hop
   aerial, air jump aerial; or a plain link with no Hinge), with the opponent doing what it is doing now (a person: holding what
   they hold; a CPU: its own brain), and puts the game back. A follow-up counts only if the game's own true-combo counter goes up
   without resetting, so every hit it picks is a true combo against that prediction. Of those it takes the best for damage, the
   Thread he keeps, the frames he is left ahead and above all a KO with the opponent still in hitstun. The work is spread over the
   frames of hitlag and the Hinge, when Knell could not press anything anyway, so the choice is made before his first chance to act.
   He is hungry for spikes: carrying them out past a ledge, getting above them, and a Dair whose tip drives them down off the
   stage all score well, and a spike that takes the stock beats any other KO.
   In neutral, whenever the level-9 brain decides to attack, the planner picks which opener to throw the same way.
   The route tokens are the ones of tools/knell-lab.js (the routes in playtest-results/knell/README.md).
   Needs net.js (the snapshots); without it Knell at level 10 is level 9. */
const KCPU = (() => {
  if (typeof NET === 'undefined') return undefined;
  /* budget: frames of play-ahead per frame of the match; ms: and no more than this long (in a browser), so the game keeps its 60 fps */
  const K = { budget: 140, ms: typeof window !== 'undefined' ? 5 : 0, stats: { plans: 0, openers: 0, picked: 0, none: 0, sims: 0, frames: 0, kos: 0, spikes: 0, spikeKOs: 0, edges: 0, edgeKOs: 0, tails: 0, dull: 0, late: 0, landed: 0, dropped: 0, fragile: 0 }, log: null };

  /* ---- tokens: what a player presses for each step of a route (as in tools/knell-lab.js) ---- */
  const toward = (f, o) => sgn(o.x - f.x) || f.face;
  const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
  const free = f => !!FREE[f.state];
  const hingeReady = f => f.state === 'attack' && (f.mname === 'hinge' ? f.mf >= 4 : f.mname === 'hingeS' ? f.mf >= 8 : !!(f.move && f.move.cancel && f.mf >= f.move.cancel));
  const hingeable = f => f.state === 'attack' && f.hitlag <= 0 && f.move && f.move.hinge && f.knC && f.mf + 1 >= f.move.hinge[0] && f.mf + 1 <= f.move.hinge[1] && f.thread > 0;
  const jabNext = (f, nm) => f.state === 'attack' && f.mname === nm && f.hitlag <= 0 && f.move.chain && f.mf + 1 >= f.move.chain && f.mf + 1 <= (f.move.chainEnd || 99);
  const gOK = f => f.grounded && (free(f) || hingeReady(f));
  const aOK = f => !f.grounded && (free(f) || hingeReady(f));
  const atkDone = (k, f, e) => k > 90 || (f.knAct !== e.a0 && (f.knC || f.state !== 'attack' || (k > 2 && f.knAct !== e.a1)));
  const A = {};
  const atk = (ok, set, press) => ({ ok, inp(i, k, f, o, e) { if (k === 0) { e.a0 = f.knAct; e.a1 = -1; } if (k === 1) e.a1 = f.knAct; if (k < (press || 3)) set(i, f, o, k); }, done: atkDone });
  A.jab = atk(gOK, (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.jab2 = atk(f => jabNext(f, 'jab'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  A.jab3 = atk(f => jabNext(f, 'jab2'), (i, f, o, k) => { if (k === 0) i.atk = true; });
  const tilt = (lx, ly) => atk(gOK, (i, f, o, k) => { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.atk = true; });
  A.ftilt = tilt(0.6, 0); A.ftiltH = tilt(0.6, 0.32); A.ftiltL = tilt(0.6, -0.32); A.utilt = tilt(0, 0.6); A.dtilt = tilt(0, -0.6);
  const smash = (lx, ly) => atk(gOK, (i, f, o, k) => { i.lx = lx * toward(f, o); i.ly = ly; if (k === 0) { i.atk = true; i.spc = true; } }, 1);
  A.fsmash = smash(1, 0); A.usmash = smash(0, 1); A.dsmash = smash(0, -1);
  A.dash = { ok: f => f.grounded && free(f), inp(i, k, f, o, e) { i.lx = toward(f, o); if (k === 0) { e.p = 0; e.a0 = f.knAct; e.a1 = -1; } if (!e.p && k >= 7 && (f.state === 'run' || f.state === 'dash')) { i.atk = true; e.p = 1; } if (e.p === 1 && f.state === 'attack') { e.p = 2; e.a1 = f.knAct; } },
    done: (k, f, e) => k > 90 || (e.p === 2 && f.knAct !== e.a0 && (f.knC || f.state !== 'attack')) };
  for (const t of ['f', 'b', 'u', 'd']) A['grab_' + t] = { ok: f => f.grounded && free(f), inp(i, k, f, o) { if (k === 0) { i.lx = toward(f, o) * 0.2; i.grb = true; }
    if (f.state === 'hold' && f.sf > 1) { if (t === 'f') i.lx = f.face; else if (t === 'b') i.lx = -f.face; else if (t === 'u') i.ly = 1; else i.ly = -1; } },
    done: (k, f, e) => (k > 3 && f.state !== 'hold' && f.state !== 'throw' && f.state !== 'attack') || (f.state === 'throw' && f.sf > 0 && opp(f) && opp(f).state === 'hurt') || k > 90 };
  const spec = (ok, lx, ly, n) => atk(ok, (i, f, o, k) => { if (k === 0) i.spc = true; i.lx = lx * toward(f, o); i.ly = ly; }, n || 3);
  A.nspec = spec(gOK, 0, 0); A.sspec = spec(gOK, 1, 0); A.nspecA = spec(aOK, 0, 0); A.sspecA = spec(aOK, 1, 0);
  A.sh = { ok: f => f.grounded && (free(f) || hingeReady(f)), inp(i, k) { if (k === 0) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 1) || k > 20 };
  A.fh = { ok: f => f.grounded && (free(f) || hingeReady(f)), inp(i, k) { if (k < 10) i.jmp = true; }, done: (k, f) => (!f.grounded && k >= 6) || k > 20 };
  A.dj = { ok: f => !f.grounded && (free(f) || hingeReady(f)) && f.jumps > 0, inp(i, k) { if (k === 0) i.jmp = true; }, done: k => k >= 1 };
  const aer = (sx, sy) => atk(aOK, (i, f, o, k) => { i.lx = sx * f.face; i.ly = sy; if (k === 0) i.atk = true; });
  A.nair = aer(0, 0); A.fair = aer(1, 0); A.fairH = aer(1, 0.4); A.fairL = aer(1, -0.4); A.bair = aer(-1, 0); A.uair = aer(0, 1); A.dair = aer(0, -1);
  const hinge = (lx, ly) => ({ ok: hingeable, inp(i, k, f) { i.lx = lx * f.face; i.ly = ly; if (k === 0) i.spc = true; }, done: (k, f) => f.mname === 'hinge' || f.mname === 'hingeS' || k > 6 });
  A.hf = hinge(1, 0); A.hb = hinge(-1, 0); A.hu = hinge(0, 1);
  A.ff = { ok: f => !f.grounded && f.vy <= 0 && (free(f) || f.state === 'attack'), inp(i, k) { if (k === 0) i.ly = -1; }, done: k => k >= 1 };
  const WAIT = {};
  const tok = t => { if (/^w\d+$/.test(t)) { if (!WAIT[t]) { const n = +t.slice(1); WAIT[t] = { ok: () => true, inp() {}, done: k => k >= n }; } return WAIT[t]; }
    if (/^g\d+$/.test(t)) { if (!WAIT[t]) { const n = +t.slice(1); WAIT[t] = { ok: () => true, inp(i, k, f, o) { i.lx = toward(f, o); }, done: k => k >= n }; } return WAIT[t]; }   /* gN: run (or drift) toward them for N frames */
    if (/^c\d+$/.test(t)) { if (!WAIT[t]) { const n = +t.slice(1); WAIT[t] = { ok: () => true, inp: home, done: (k, f, e) => k >= n || e.p === 9 }; } return WAIT[t]; }   /* cN: home in over them for the Dair's tip, up to N frames */
    return A[t]; };
  /* the homing step of Funny mode: steer for the spot the Dair's tip will meet them (where they will be when it comes out,
     DT frames on), running off and jumping, and the air jump when below it; done the frame they will be in reach of the tip */
  const DT = 9;
  function home(i, k, f, o, e) {
    if (k === 0) { e.p = 0; e.a0 = -99; }
    const px = o.x + o.vx * DT, py = o.y + o.vy * DT - (o.grounded ? 0 : 0.5 * (o.st ? o.st.grav : 0.1) * DT * DT);
    const qx = f.x + f.vx * DT, qy = f.y + f.vy * DT - (f.grounded ? 0 : 0.5 * (f.st ? f.st.grav : 0.1) * DT * DT);
    const dx = px - qx, dy = qy - py;
    if (!f.grounded && Math.abs(dx) < 5 && dy > 3 && dy < 18 && (free(f) || f.state === 'air')) { e.p = 9; return; }
    i.lx = Math.abs(dx) > 1.5 ? sgn(dx) : 0;
    if (f.grounded) { if (Math.abs(o.x - f.x) < 36 && free(f)) { i.jmp = true; e.a0 = k; } }
    else if (e.a0 >= k - 9 && e.a0 >= 0 && f.vy > 0) i.jmp = true;   /* the full hop: still holding jump */
    else if (dy < 4 && f.vy < 0.4 && f.jumps > 0 && free(f) && e.p < 1) { i.jmp = true; e.p = 1; }   /* below where the tip should be: the air jump */
  }

  /* ---- the executor: where Knell is in the steps he chose. A plain object, so it is copied along with a snapshot. ---- */
  const exec = (toks, late, patience) => ({ toks: toks.slice(), idx: 0, cur: null, k: -1, wait: 0, holdT: 0, drift: 1, failed: -1, late: late || 0, patience: patience || 40, a0: 0, a1: 0, p: 0 });
  const cpE = e => Object.assign({}, e, { toks: e.toks.slice() });
  function nextTok(e) {
    while (e.idx < e.toks.length) { const t = e.toks[e.idx++]; if (!tok(t)) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; return; } e.cur = t; e.k = -1; e.wait = e.idx === 1 ? e.late : 0; e.holdT = 0; return; }
    e.cur = null;
  }
  function input(e, f, o) {
    const i = blankIn();
    if (e.drift && !f.grounded) { const dx = o.x - f.x; i.lx = Math.abs(dx) > 2 ? sgn(dx) * e.drift : 0; }
    if (e.cur === null && e.idx < e.toks.length) nextTok(e);
    if (e.cur !== null) {
      const a = tok(e.cur);
      if (e.k < 0) { if (a.ok(f, o)) { if (e.wait > 0) e.wait--; else e.k = 0; } else if (++e.holdT > e.patience) { e.failed = e.idx - 1; e.cur = null; e.idx = e.toks.length; } }
      if (e.cur !== null && e.k >= 0) a.inp(i, e.k, f, o, e);
    }
    return i;
  }
  function after(e, f) { if (e.cur === null || e.k < 0) return; e.k++; if (tok(e.cur).done(e.k, f, e)) { e.cur = null; e.k = -1; if (e.idx < e.toks.length) nextTok(e); } }
  const finished = e => e.cur === null && e.idx >= e.toks.length;

  /* ---- playing ahead: the game run on from a snapshot with every sound, spark, pop and rumble off ---- */
  /* Sounds, sparks, pops and rumble are kept quiet while playing ahead. Wrapped once here (swapping the functions every frame
     would make the browser throw away its compiled code each time); net.js already keeps sounds and pops quiet while NET.resim. */
  const G = globalThis; let hush = false;
  for (const nm of ['spark', 'rumble', 'sfx', 'beep', 'thwack', 'pop']) { const fn = G[nm]; if (typeof fn === 'function') G[nm] = function () { if (!hush) return fn.apply(this, arguments); }; }
  let quietSave = null;
  function quiet() { quietSave = { shake, resim: NET.resim, sparkOff }; hush = true; NET.resim = true; }
  function loud() { const q = quietSave; shake = q.shake; NET.resim = q.resim; sparkOff = q.sparkOff; hush = false; quietSave = null; }
  /* one frame, as step() runs it in a match. first: the frame the snapshot was taken in, part way through pollMatch, where the
     fighters before Knell have already been read. Knell plays e; the other side is predicted. */
  /* A person's next inputs can't be read, so the top picks are played again against the two ways out of a combo: DI and SDI
     held away from Knell, and toward him (the escape buttons mashed as hitstun ends). A pick that only works if they hold still
     is marked fragile. */
  let pol = null; const POLS = [{ name: 'out', d: -1 }, { name: 'in', d: 1 }];
  function polIn(v, a) {
    const i = blankIn(), tw = sgn(a.x - v.x) || 1, hurt = v.state === 'hurt' || v.hitlag > 0 || v.state === 'held';
    if (hurt) i.lx = pol.d * tw;
    if (v.hitlag > 0 && frame % 2) i.lx = 0;   /* SDI: a fresh flick every other frame */
    if (!hurt && frame % 2 === 0) i[['jmp', 'shd', 'atk'][Math.floor(frame / 2) % 3]] = true;
    return i;
  }
  /* a hard stop inside a play-ahead, so one long one can't hold up a frame of the real game: it is dropped and tried again later */
  const CLOCK = typeof performance !== 'undefined' ? performance : Date, LATE = { late: true }; let deadline = 0, dn = 0;
  function simFrame(ki, e, first) {
    if (deadline && (++dn & 7) === 0 && CLOCK.now() > deadline) throw LATE;
    for (const g of F) {
      if (first && g.idx < ki) continue;
      const i = g.idx === ki ? input(e, g, F[1 - ki]) : g.ctl.dev === 'cpu' ? cpuInput(g, F[1 - g.idx], g.ctl.ai) : pol ? polIn(g, F[ki]) : Object.assign({}, g.ctl.c);
      g.ctl.poll(i);
    }
    if (!paused) tick++;
    stepPlay(); K.stats.frames++;
    after(e, F[ki]);
  }

  /* The follow-ups to try, best first. A Hinge only when it has a Thread to spend and the move that hit has its window. */
  const GROUND = ['ftiltH', 'usmash', 'fsmash', 'utilt', 'dtilt', 'ftilt', 'ftiltL', 'jab', 'dsmash', 'sh nair', 'sh fairH', 'sh fair', 'sh uair', 'sh dair', 'sh bair', 'fh uair', 'fh nair', 'dash'];
  const AIR = ['fairH', 'dair', 'bair', 'nair', 'uair', 'fair', 'fairL', 'dj uair', 'dj fairH', 'dj nair', 'dj bair', 'dj fair', 'dj dair',
    'ff usmash', 'ff fsmash', 'ff ftiltH', 'ff utilt', 'ff dtilt', 'ff dsmash'];   /* the last: drop to the floor and hit from there (the way out of an air loop into a finisher) */
  /* chase links: let the launch carry them, then run, jump or drift after them and hit again. These are what make a combo travel. */
  const CHASE_G = ['w8 dash', 'w14 dash', 'w12 sh fairH'];
  const CHASE_A = ['w8 fairH', 'w14 fairH', 'w12 nair', 'w10 dj fairH', 'w16 dj fairH', 'w14 dj fair', 'w20 dj uair', 'w6 dair', 'w10 dj dair', 'w16 dj dair'];   /* the last three: follow them out and come down on top with the Dair's tip */
  /* the edge-guard: they are off the stage after a launch; run off after them, jump and come down on top with the Dair's tip.
     Each starts with EW frames of waiting: Knell holds still (drifting toward them in the air) while these are played ahead. */
  const EW = 8;
  const EDGE_G = ['g6 fh dair', 'g12 fh dair', 'g12 fh w8 dair', 'g20 fh w6 dair', 'g6 fh dj dair', 'g12 fh dj dair', 'g20 fh w8 dj dair', 'g6 fh w12 dj dair',
    'g28 dair', 'g28 w8 dair', 'g24 dj dair', 'g30 w6 dj dair', 'sh dair', 'fh w14 dj dair'];
  const EDGE_A = ['dair', 'w6 dair', 'w12 dair', 'w20 dair', 'dj dair', 'w6 dj dair', 'w12 dj dair', 'w20 dj dair', 'ff dair', 'g10 dair', 'g10 dj dair'];
  /* Funny mode adds more: higher and farther out, for opponents coming back high (a full hop, the air jump, then the Dair) */
  const EDGE_GF = ['fh dj dair', 'fh w4 dj dair', 'fh w8 dj w4 dair', 'g6 fh w4 dj w8 dair', 'g6 fh w10 dj dair', 'fh w12 dj w8 dair', 'g12 fh w16 dair',
    'g4 fh w6 dj w14 dair', 'g16 fh w4 dj dair', 'fh w18 dair', 'g8 fh dj w10 dair', 'fh w6 dj w18 dair'];
  const EDGE_C = ['c50 dair', 'c70 dair', 'w6 c60 dair', 'g8 c60 dair', 'c50 w2 dair'];
  const EDGE_AF = ['w4 dair', 'w8 dair', 'w16 dair', 'w28 dair', 'w4 dj dair', 'w8 dj w6 dair', 'dj w10 dair', 'g6 w6 dair', 'g20 dair', 'g20 dj dair'];
  const offStage = o => !o.grounded && (Math.abs(o.x) > EDGE + 6 || (Math.abs(o.x) > EDGE && o.y < -6)) && o.state !== 'dead' && o.state !== 'respawn' && o.state !== 'ledge';
  const edgeList = (f, fun) => (f.grounded ? EDGE_G.concat(fun ? EDGE_C.concat(EDGE_GF) : []) : EDGE_A.concat(fun ? EDGE_C.concat(EDGE_AF) : [])).map(r => ({ pre: '', rest: ['w' + EW].concat(r.split(' ')), key: 'edge|' + r, pri: 0 }));
  const OPEN = ['dtilt', 'jab', 'ftiltH', 'ftilt', 'utilt', 'sh nair', 'ftiltL', 'grab_f', 'grab_b', 'dash'];
  const OPEN_KILL = ['fsmash', 'usmash', 'dsmash'];
  const learn = new Map();   /* how often each follow-up has worked after each move: tried in that order next time */
  function followUps(f) {
    const out = [], mv = f.mname, grounded = f.grounded;
    const hinges = f.move && f.move.hinge && f.thread > 0 ? ['hf', 'hb', 'hu'] : [];
    if (mv === 'jab' || mv === 'jab2') out.push({ pre: '', rest: [mv === 'jab' ? 'jab2' : 'jab3'] });
    for (const h of hinges) for (const r of (grounded ? GROUND : AIR)) out.push({ pre: h, rest: r.split(' ') });
    for (const r of (grounded ? GROUND : AIR)) out.push({ pre: '', rest: r.split(' ') });
    for (const r of (grounded ? CHASE_G : CHASE_A)) { out.push({ pre: '', rest: r.split(' ') }); if (hinges.length) out.push({ pre: 'hf', rest: r.split(' ') }); }
    if (!grounded) for (const r of ['nair', 'uair', 'fairH', 'bair', 'dair']) out.push({ pre: 'ff', rest: [r] });
    if (fun) for (const h of [''].concat(hinges)) for (const r of ['c30 dair', 'c50 dair']) out.push({ pre: h, rest: r.split(' ') });   /* Funny mode: home in for the spike */
    if (fun && opp(f) && opp(f).pct >= FUN.lpct && opp(f).pct < anyKO(f)) for (let n = out.length - 1; n >= 0; n--) if (/smash/.test(out[n].rest[out[n].rest.length - 1])) out.splice(n, 1);   /* Funny mode: no smash to finish a combo with */
    const key = c => mv + '|' + c.pre + ' ' + c.rest.join(' ');
    out.forEach((c, n) => { c.key = key(c); const l = learn.get(c.key); c.pri = (l ? l.ok * 3 - l.bad * 0.15 : 0) - n * 0.01; });
    return out.sort((a, b) => b.pri - a.pri);
  }

  /* ---- one plan: the snapshot, the follow-ups and what each came to ---- */
  function newPlan(f, o, list, kind, hist) {
    const s = NET.save();
    if (!hist) hist = newHist(f, o);
    return { hist, vx0: o.x, fx0: f.x, kind, root: s, shake, ki: f.idx, list, n: 0, pre: new Map(), res: [], tails: null, pct0: o.pct, hits0: COMBO[f.idx].hits, kos0: f.kos, dies0: o.kos, age: 0, human: o.ctl.dev !== 'cpu', fun, anyKO: fun ? anyKO(f) : 0 };
  }
  /* runs the shared first step (a Hinge, an air jump) once and keeps a snapshot of the moment it is done */
  function prefix(P, pre) {
    const pk = (pol ? pol.name : '') + '|' + pre; if (P.pre.has(pk)) return P.pre.get(pk);
    let r = null;
    if (!pre) r = { snap: P.root, e: exec([], 0), t: 0, first: true };
    else {
      NET.load(P.root); const e = exec([pre], 0, 30); let ok = false, t = 0;
      for (; t < 40; t++) { simFrame(P.ki, e, t === 0); if (e.failed >= 0 || bad(P)) break; if (finished(e)) { ok = true; t++; break; } }
      r = ok ? { snap: NET.save(), e: cpE(e), t, first: false } : null;
    }
    P.pre.set(pk, r); return r;
  }
  const bad = P => { const f = F[P.ki], o = F[1 - P.ki]; return o.kos > P.dies0 || f.state === 'hurt' || f.state === 'held' || f.state === 'dead' || f.state === 'respawn'; };
  /* plays one follow-up to its hit; null if it misses, is shielded, lets the combo drop or gets Knell hit */
  function leaf(P, c) {
    const p = prefix(P, c.pre); if (!p) return null;
    NET.load(p.snap); const e = cpE(p.e); e.toks.push(...c.rest); if (!c.pre) e.late = c.late || 0;
    const f = F[P.ki], v = F[1 - P.ki], ci = P.ki; K.stats.sims++;
    let prev = COMBO[ci].hits, vs = v.state, t = p.t, spk = false, landed = false; const eg = P.fun && P.kind === 'edge';
    const why = K.why && /w[0-9]/.test(c.key) ? r => { K.why[r] = (K.why[r] || 0) + 1; return null; } : () => null;   /* testing */
    for (let k = 0; k < 100; k++, t++) {
      simFrame(ci, e, p.first && k === 0);
      if (f.kos > P.kos0) return spk || (vs === 'hurt' || v.state === 'hurt') && (!P.fun || P.pct0 >= P.anyKO) ? { c, ko: true, t, spike: spk, score: 1000 - t + (spk ? sk(P) : 0) } : null;   /* in Funny mode only a spike kills (until they are very high) */
      if (bad(P)) return why('bad'); if (e.failed >= 0) return why('failed:' + e.toks[e.failed]);
      const h = COMBO[ci].hits;
      if (h < prev) { if (!eg) return why('dropped@' + e.cur + ':' + k); prev = h; }   /* an edge-guard in Funny mode starts after the combo: its counter running out is no miss */
      if (h > prev) landed = true;
      if (h > prev && spiked(v)) spk = true; else if (h > prev) spk = false;
      prev = h; vs = v.state;
      if (finished(e)) {
        if ((eg ? !landed : h <= P.hits0) || f.knCS) return why(f.knCS ? 'shield' : 'missed');
        const adv = v.state === 'hurt' ? (v.hitstun - v.sf) - (f.state === 'attack' && f.move ? (f.move.hinge && f.thread > 0 ? Math.max(0, f.move.hinge[0] - f.mf) : f.move.t - f.mf) : 0) : -10;
        let sc = (v.pct - P.pct0) * (P.fun ? FUN.dmg : 1) + f.thread * 7 + clamp(adv, -10, 30) * 0.35;
        /* past kill percents, carrying them toward a blast zone (out past a ledge, or up) counts too: the setup for the kill */
        const kp = clamp((v.pct - 70) / 80, 0, 1); sc += kp * (Math.max(0, Math.abs(v.x) - 20) * 0.25 + Math.max(0, v.y - 20) * 0.15);
        if (!f.grounded && Math.abs(f.x) > EDGE + 6 && f.y < 4) sc -= f.jumps > 0 ? (Math.abs(v.x) > EDGE && v.state === 'hurt' ? 0 : 6) : 20;   /* following them out for the spike, with a jump left, is fine */   /* chasing out past the ledge low, with nothing to come back on */
        sc += style(P, c, v);
        if (K.why && /w[0-9]/.test(c.key)) K.why.OK = (K.why.OK || 0) + 1;
        if (spk) sc += P.fun ? FUN.base + spikeDepth(v) * FUN.hit : spikeDepth(v) * SPIKE_HIT;   /* Funny mode: every spike is a treat, a deep one more so */
        else if (P.fun && v.pct >= FUN.lpct && v.pct < P.anyKO) sc -= Math.max(0, Math.hypot(v.vx, v.vy) - FUN.soft) * FUN.launch + dullRisk(v) * FUN.dull;   /* Funny mode: a hard launch that is not a spike might take the stock the dull way */   /* a spike that hasn't taken the stock yet is worth as much as it is deep (at the ledge they just come back) */   /* a spike off the stage that has not taken the stock yet still leaves them low and out of reach */
        return { c, ko: false, t, score: sc, snap: v.pct >= 50 || spk, spike: spk, e: cpE(e), speed: Math.hypot(v.vx, v.vy), pct: v.pct };
      }
    }
    return null;
  }
  /* The combo's shape. Knell should travel: links that carry the opponent across the stage (away from where the combo began)
     score, and a move not yet used in this combo scores a little. The Dair/Bair Thread loop is an extension only: one pass of it
     is fine, every further pass costs more, so he leaves it for a carry or a finisher. */
  const LOOP = { dair: 1, bair: 1 };
  const newHist = (f, o) => ({ moves: [], x0: o.x, dir: Math.abs(o.x) > 10 ? sgn(o.x) : (sgn(o.x - f.x) || f.face || 1) });   /* toward the nearer ledge (the spike is off it); from the middle, the way he is hitting them */
  const last = c => c.rest[c.rest.length - 1];
  function style(P, c, v) {
    if (K.plain) return 0;   /* testing: the old scoring, for comparison */
    const H = P.hist.moves, mv = last(c); let sc = 0;
    if (LOOP[mv] && LOOP[H[H.length - 1]]) {   /* a Dair/Bair loop link: the first one in a combo is free, each after costs more */
      let n = 0; for (let k = 1; k < H.length; k++) if (LOOP[H[k]] && LOOP[H[k - 1]]) n++;
      sc -= n * 16; }
    const used = H.filter(m => m === mv).length; sc += used ? -4 * used : 4;
    /* travel: the combo has a heading (across the stage, toward the nearer ledge, where the spike is); ground gained along it scores,
       for the opponent carried and for Knell following */
    const d = P.hist.dir, f = F[P.ki];
    sc += (Math.max(-10, (v.x - P.vx0) * d) * 0.8 + Math.max(-6, (f.x - P.fx0) * d) * 0.3) * (P.fun ? FUN.travel : 1);
    if (K.trav) K.trav.push([c.pre + ' ' + c.rest.join(' '), (v.x - P.vx0) * d, (f.x - P.fx0) * d]);
    /* at kill percents a long combo should cash in: a hard launch and a carry out toward a blast zone count for more the longer
       it has run, so a finisher wins out over circling the middle of the stage */
    if (v.pct >= 100 && (!P.fun || v.pct >= P.anyKO)) { const w = clamp((v.pct - 100) / 50, 0.3, 1) * (1 + Math.max(0, H.length - 8) * 0.2);
      sc += w * (Math.hypot(v.vx, v.vy) * 2 + Math.max(0, Math.abs(v.x) - 30) * 0.3 + Math.max(0, v.y - 30) * 0.2); }
    /* the spike setup: what he is hungry for is a chain that ends with the Dair's tip driving them down off a ledge. Carrying
       them out past the ledge, still in hitstun and in the air, scores; more with Knell above them and a jump left to get there
       and back (the Dair has to come down on top of them) */
    const off = Math.abs(v.x) - EDGE;
    if (off > 2 && !v.grounded && v.state === 'hurt') {
      sc += Math.min(off, 40) / 40 * (P.fun ? FUN.off : SETUP_OFF);
      if (f.y > v.y + 2 && Math.abs(f.x - v.x) < 14 && (f.jumps > 0 || f.y > 0)) sc += (P.fun ? FUN.above : SETUP_ABOVE) * (0.3 + 0.7 * spikeDepth(v));   /* above them, most of all where a spike would kill */
    }
    return sc;
  }
  /* the Dair's tip sent them down, off the stage (over the stage they would only bounce off the floor) */
  const SPIKE_KO = 200, SPIKE_HIT = 40, SETUP_OFF = 12, SETUP_ABOVE = 16;
  /* Funny mode (CPU level 11): the same planner, wildly hungrier. Every spike number is several times bigger, and a KO that is
     not a spike is worth no more than an ordinary hit until they are at FUN.anyKO percent (he would rather carry them out and
     spike them). The edge-guard is tried for any opponent off the stage, and sooner again after one comes to nothing. */
  const FUN = { grab: 90, tame: 30, base: 90, dull: 400, lpct: 70, tails: 8, tailT: 170, dmg: 0.5, soft: 2.2, launch: 10, ko: 700, hit: 160, off: 45, above: 60, travel: 2.2, anyKO: 300, behind: 110, last: 1, nograb: 180, down: 9, quota: 2, depth: -1, every: 12, reach: 140 };
  /* the percent past which Funny mode takes any KO: FUN.anyKO, or FUN.behind when he is down a stock or on his last (spikes are the fun, but he still plays to win) */
  const anyKO = f => { const o = opp(f); return o && (st(f).spk >= FUN.quota || f.stocks < o.stocks && f.stocks <= FUN.down || FUN.last && f.stocks <= 1 && o.stocks > 1) ? FUN.behind : FUN.anyKO; };
  const sk = P => P.fun ? FUN.ko : SPIKE_KO; K.FUN = FUN;   /* (open to tests) */
  /* 0 at the ledge at stage height, 1 when they are 20 below it or 30 out: deep enough that a spike kills (measured: a Dair spike from there took the stock of Joey, Potato Sack and Sprocket at any damage) */
  /* Funny mode's quick look at a launch that is not a spike: where its hitstun would carry them (roughly), against the blast zones.
     0 well inside, 1 at or past one: a KO the dull way */
  const dullRisk = v => { if (v.state !== 'hurt') return 0; const h = Math.max(0, v.hitstun - v.sf);
    const px = Math.abs(v.x + v.vx * h * 0.8), py = v.y + Math.max(0, v.vy) * h * 0.55;
    return clamp(Math.max((px - (BLAST.r - 45)) / 35, (py - (BLAST.t - 40)) / 30), 0, 1); };
  const spikeDepth = v => clamp(Math.max((-v.y - 2) / 18, (Math.abs(v.x) - EDGE - 8) / 22), 0, 1);
  const spiked = v => !v.grounded && v.state === 'hurt' && v.vy < -0.8 && Math.abs(v.x) > EDGE + 3;
  /* after the best few: does the launch alone take the stock, still in hitstun? Nothing more is pressed. */
  function tail(P, r) {
    /* replayed from the shared start rather than kept as a snapshot of its own: a snapshot copies the whole match, and many of
       them each frame make the browser stop to clear memory */
    let r2, e, prev, vs, k0 = 0; const f = F[P.ki], v = F[1 - P.ki];
    if (r.tres) { const q = r.tres; NET.load(q.snap); r2 = q.r2; e = q.e; prev = q.prev; vs = q.vs; k0 = q.k; }   /* Funny mode's long look: carried on from where the last frame's time ran out */
    else { r2 = leaf(P, r.c); if (!r2 || r2.ko) return !!(r2 && r2.ko); e = cpE(r2.e); e.drift = 0; prev = COMBO[P.ki].hits; vs = v.state; }
    for (let k = k0, n = P.fun ? FUN.tailT : 110; k < n; k++) {
      if (P.fun && k > k0 && k % 20 === 0 && deadline && CLOCK.now() > deadline - K.ms * 0.4) { r.tres = { snap: NET.save(), r2, e: cpE(e), prev, vs, k }; throw LATE; }   /* one snapshot to go on from next frame */
      simFrame(P.ki, e, false);
      if (f.kos > P.kos0) return !!r2.spike || (P.fun ? P.pct0 >= P.anyKO && vs === 'hurt' || 'dull' : vs === 'hurt');   /* Funny mode: a KO that is not a spike is 'dull' */   /* a spike off stage counts even once hitstun is over: too low to come back */
      if (bad(P)) return false;
      const h = COMBO[P.ki].hits; if (h < prev && !P.fun) return false; prev = h; vs = v.state;   /* Funny mode looks on past the combo's end: do they get back, or die the dull way */
    }
    return false;
  }
  /* works on the plan for up to n frames of play-ahead; true when there is nothing left to try */
  function work(P, n) {
    const now = P.age === 0 ? P.root : NET.save();   /* the game as it stands this frame, put back after */
    quiet(); const fr0 = K.stats.frames, clock = CLOCK, t0 = clock.now(); deadline = K.ms ? t0 + K.ms * 1.6 : 0;
    try {
      while (K.stats.frames - fr0 < n && !(K.ms && clock.now() - t0 > K.ms)) {
        if (P.n < P.list.length) { P.cur = { q: 'leaf', it: P.list[P.n] }; const r = leaf(P, P.list[P.n++]); if (r) P.res.push(r); continue; }
        /* the kill check: the hardest-hitting few (every smash among them), more of them the higher the damage */
        if (!P.tails) { const smash = r => /smash/.test(r.c.rest[r.c.rest.length - 1]) ? 50 : 0;
          const spikes = P.res.filter(r => !r.ko && r.spike).sort((a, b) => b.score - a.score).slice(0, 4);   /* every spike gets its kill check, whatever the damage */
          P.tails = spikes.concat(P.res.filter(r => !r.ko && (r.snap || P.fun && r.pct >= 40) && !r.spike).sort(P.fun ? (a, b) => b.score - a.score : (a, b) => (b.speed + smash(b)) - (a.speed + smash(a))).slice(0, P.fun && P.pct0 >= 40 ? FUN.tails : P.pct0 >= 150 ? 10 : P.pct0 >= 100 ? 6 : 3)); }
        if (P.tails.length) { const r = P.tails.shift(); P.cur = { q: 'tail', it: r, r }; const tk = tail(P, r); K.stats.tails++; if (tk === 'dull') { r.score -= FUN.dull; K.stats.dull++; } else if (tk) { r.ko = true; r.score = 900 - r.t + (r.spike ? sk(P) : 0); } continue; }
        if (P.human) {   /* the fragility check, best first, until one holds up against both */
          if (!P.rob) P.rob = P.res.slice().sort((a, b) => b.score - a.score).slice(0, 5).flatMap(r => POLS.map(p => ({ r, p })));
          if (P.rob.length) { const q = P.rob.shift(); if (q.r.fragile) continue; P.cur = { q: 'rob', it: q, r: q };
            pol = q.p; try { if (!leaf(P, q.r.c)) { q.r.fragile = true; K.stats.fragile++; } } finally { pol = null; }
            if (!q.r.fragile && q.p === POLS[POLS.length - 1]) P.rob = [];   /* the best that holds: done */
            continue; }
        }
        return true;
      }
      return false;
    } catch (x) {
      if (x !== LATE) throw x;
      const c = P.cur;   /* put the late one back to finish next frame; one that runs late twice is dropped */
      if (c && c.q === 'tail' && c.r.tres && (c.r.tn = (c.r.tn || 0) + 1) < 12) P.tails.unshift(c.r);   /* a resumable look: back in the queue */
      else if (c && !c.it.late2) { c.it.late2 = true; K.stats.late++; if (c.q === 'leaf') P.n--; else if (c.q === 'tail') P.tails.unshift(c.r); else P.rob.unshift(c.r); }
      pol = null; return false;
    } finally { deadline = 0; P.cur = null; NET.load(now); loud(); }
  }
  function pick(P) {
    const sc = r => r.score - (r.fragile ? 60 : 0);   /* a sure follow-up beats a better one they can DI out of */
    let best = null; for (const r of P.res) if ((P.kind !== 'edge' || r.ko || P.fun && r.spike) && (!best || sc(r) > sc(best))) best = r;   /* an edge-guard only for a spike that takes the stock (in Funny mode, for any spike at all) */
    for (const r of P.res) { const l = learn.get(r.c.key) || { ok: 0, bad: 0 }; l.ok++; learn.set(r.c.key, l); }
    for (let n = 0; n < P.n; n++) { const c = P.list[n]; if (!P.res.some(r => r.c === c)) { const l = learn.get(c.key) || { ok: 0, bad: 0 }; l.bad++; learn.set(c.key, l); } }
    if (best && P.kind === 'edge') K.stats.edgeKOs++;
    if (best) { K.stats.picked++; if (best.ko) K.stats.kos++; if (best.spike) { K.stats.spikes++; if (best.ko) K.stats.spikeKOs++; } } else K.stats.none++;
    if (K.log) K.log.push({ frame, kind: P.kind, mv: F[P.ki].mname, tried: P.n, of: P.list.length, ok: P.res.length, vpct: +F[1 - P.ki].pct.toFixed(0), vx: +F[1 - P.ki].x.toFixed(0), vy: +F[1 - P.ki].y.toFixed(0), res: K.dbg ? P.res.map(r => r.c.key.split('|')[1].trim() + ' ' + r.score.toFixed(0) + (r.ko ? ' KO' : '') + ' v' + (r.speed || 0).toFixed(1)).join(', ') : undefined, best: best && (best.c.pre + ' ' + best.c.rest.join(' ')).trim(), ko: best && best.ko, fragile: best && !!best.fragile, spike: best && !!best.spike, score: best && +best.score.toFixed(1) });
    P.chosen = best ? last(best.c) : null;
    return best ? exec((best.c.pre ? [best.c.pre] : []).concat(best.c.rest), best.c.pre ? 0 : best.c.late || 0) : null;
  }

  /* ---- each frame, from cpuInput ---- */
  const S = new WeakMap();
  const st = f => { let s = S.get(f.ctl); if (!s) S.set(f.ctl, s = { e: null, issued: false, plan: null, act: -1, freeKey: -1, hist: null, hh: 0, edgeAt: 0, spk: 0, spAt: -999, ko0: 0, hl: 0 }); return s; };
  let busy = false;
  let fun = false;   /* this frame's CPU is at Funny mode */
  const isFun = m => { const L = CPU_LV[m.lv || CPU_LEVEL]; return !!(L && L.funny); };
  K.input = function (f, o, m) {
    if (busy || NET.resim || F.length !== 2) return null;
    fun = isFun(m);
    const s = st(f);
    if (s.e && s.issued) after(s.e, f);
    s.issued = false;
    if (f.kos < s.ko0) s.spk = 0; if (o.hitlag > 0 && s.hl <= 0 && f.hitlag > 0 && f.mname === 'dair' && !o.grounded && Math.abs(o.x) > EDGE + 3) s.spPend = true; if (s.spPend && o.hitlag <= 0) { s.spPend = false; if (o.state === 'hurt' && o.vy < -0.8) s.spAt = frame; } s.hl = o.hitlag; if (f.kos > s.ko0 && frame - s.spAt < 150) s.spk++; s.ko0 = f.kos;   /* spike KOs this match (Funny mode's quota) */
    if (f.state === 'hurt' || f.state === 'held' || f.state === 'dead' || f.state === 'respawn' || o.state === 'dead' || o.state === 'respawn') { s.e = null; s.plan = null; return null; }
    if (s.e && (finished(s.e) || s.e.failed >= 0)) { if (s.e.h0 !== undefined) { if (COMBO[f.idx].hits > s.e.h0 && s.e.failed < 0) K.stats.landed++; else K.stats.dropped++; } s.e = null; }   /* did the chosen follow-up land in the real game */
    if (s.e) { s.issued = true; return input(s.e, f, o); }
    const hurt = o.state === 'hurt' || o.hitlag > 0, hits = COMBO[f.idx].hits;
    if (!s.hist || hits < s.hh) s.hist = newHist(f, o); s.hh = hits;   /* this combo's moves; a new one when the counter resets */
    /* a clean hit: plan the follow-up (once per move); or a hit that left him free with them still in hitstun (a throw) */
    if (!s.plan && hurt && hits > 0) {
      if (f.state === 'attack' && f.knC && !f.knCS && s.act !== f.knAct && f.move && !f.move.burst) { s.act = f.knAct; s.plan = newPlan(f, o, followUps(f), 'confirm', s.hist); K.stats.plans++; }
      else if (free(f) && s.freeKey !== hits) { s.freeKey = hits; const l = followUps(f).filter(c => !c.pre); for (const c of l.slice()) l.push(Object.assign({}, c, { late: 6, key: c.key + '+6' })); s.plan = newPlan(f, o, l, 'free', s.hist); K.stats.plans++; }
    }
    /* they are off the stage, low or far enough out that a spike would kill, and Knell is free: plan the edge-guard (not too often: he holds still while it is worked out, and each one is a few hundred frames of play-ahead) */
    if (!s.plan && free(f) && frame >= s.edgeAt && offStage(o) && spikeDepth(o) > (fun ? FUN.depth : 0.25) && Math.abs(o.x - f.x) < (fun ? FUN.reach : 60) && (f.grounded || f.y > -12 || f.jumps > 0) && o.invuln <= 0) {
      s.edgeAt = frame + (fun ? FUN.every : 40); s.plan = newPlan(f, o, edgeList(f, fun), 'edge', s.hist); K.stats.edges++; }
    if (s.plan) {
      const P = s.plan; busy = true; let done;
      try { done = work(P, K.budget); } finally { busy = false; }
      P.age++;
      /* choose once everything is tried, or as soon as Knell could act (the next frame would be too late) */
      const could = hingeable(f) || hingeReady(f) || free(f) || jabNext(f, 'jab') || jabNext(f, 'jab2') || f.state !== 'attack';
      if (P.kind === 'edge' ? (done || P.age >= EW) : (done || could || P.age > 45)) {
        s.plan = null; busy = true; let e; try { e = pick(P); } finally { busy = false; }
        if (e && P.kind === 'edge') { const left = EW + 1 - P.age; if (left > 0) e.toks[0] = 'w' + left; else e.toks.shift(); }   /* the frames already held while it was worked out */
        if (P.chosen) P.hist.moves.push(P.chosen);
        if (e) { s.e = e; e.h0 = COMBO[f.idx].hits; s.issued = true; return input(s.e, f, o); }
        return null;
      }
      const hold = exec([], 0); return input(hold, f, o);
    }
    return null;
  };
  /* neutral: the level-9 brain decided to attack this frame (it pressed attack, special or grab, on the ground and close in):
     the planner picks the opener, among those that would land a clean hit, by the same reckoning. */
  K.opener = function (f, o, m, i) {
    fun = isFun(m); const r = opener(f, o, m, i);
    return fun && r === i ? tame(f, o, i) : r;
  };
  /* Funny mode: past 30% the level-9 brain's own attacks would kill the dull way (smashes, aerials that launch hard), so it keeps
     only what sets up a spike: its tilts and jabs (and grabs, to 90%) on the stage, specials only to recover, and in the air a Dair from above */
  function tame(f, o, i) {
    if (o.pct < FUN.tame || o.pct >= anyKO(f)) return i;
    i.sm = false; i.cx = i.cy = 0;
    if (i.atk) { i.spc = false; i.lx = clamp(i.lx, -0.6, 0.6); i.ly = clamp(i.ly, -0.6, 0.6); }   /* a tilt, never a smash (a full flick with Attack is one) */
    if (f.grounded || Math.abs(f.x) < EDGE && f.y > 0) i.spc = false;   /* specials only to get back to the stage */
    if (o.pct >= FUN.grab) { i.grb = false; if (f.state === 'shield') i.atk = false; }   /* (Attack from shield is a grab too) */   /* a throw at these percents is a dull KO; the planner still grabs when it sees a spike in it */
    if (!f.grounded && i.atk && !(i.ly < -0.5 && o.y < f.y)) i.atk = false;
    return i;
  }
  function opener(f, o, m, i) {
    if (busy || NET.resim || F.length !== 2 || !f.grounded || !free(f) || !(i.atk || i.spc || i.grb)) return i;
    const s = st(f); if (s.e || s.plan) return i;
    if (Math.abs(o.x - f.x) > 22 || Math.abs(o.y - f.y) > 12 || o.state === 'hurt' || o.state === 'dead' || o.state === 'respawn' || o.invuln > 0) return i;
    const l = OPEN.filter(r => !fun || !/^grab/.test(r) || o.pct < FUN.nograb || o.pct >= anyKO(f)).concat(o.pct >= 70 && (!fun || o.pct >= anyKO(f)) ? OPEN_KILL : []).map((r, n) => ({ pre: '', rest: r.split(' '), key: 'open|' + r, pri: -n }));
    s.hist = newHist(f, o); s.hh = 0; const P = newPlan(f, o, l, 'open', s.hist); P.hits0 = COMBO[f.idx].hits; K.stats.openers++;
    busy = true; try { work(P, 160); } finally { busy = false; }
    /* an opener only has to connect: there is no combo yet, so the counter's starting point is its value now */
    const e = (() => { busy = true; try { return pick(P); } finally { busy = false; } })();
    if (!e) return i;
    if (P.chosen) s.hist.moves.push(P.chosen);
    s.e = e; s.issued = true; return input(s.e, f, o);
  }
  return K;
})();
