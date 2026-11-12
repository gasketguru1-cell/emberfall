'use strict';
/* ---------- Online play: deterministic rollback over any packet transport ----------
   The game already steps a fixed 60 times a second and, given the same inputs, always does the same thing (randomness only
   touches particles and the CPU, neither of which runs online). So each machine runs the whole match itself, and the two
   only exchange inputs:
   - Every frame each side sends its own input for frame n + DELAY, plus the last few frames again (lost packets cost nothing).
   - The other side's input for a frame not yet received is guessed (the last one received). When the real one arrives and
     differs, the game is put back to the snapshot taken before that frame and played forward again with the real inputs.
   - Every CHECK frames each side sends a checksum of a confirmed frame; a mismatch is reported as a desync.
   Snapshots copy every changing object reachable from the match (fighters, projectiles, timers), and leave alone the fixed
   tables (rosters, moves, stage) and functions. During a replay sounds and particle effects are switched off.
   A transport is anything with send(object) and an onMessage(handler) hook: EOS peer-to-peer in the desktop build
   (desktop/eos-transport.js), or the simulated network used by the tests (tests/net.js). */
const NET = (function () {
  const N = {};
  N.DELAY = 2;          /* frames of input delay: hides that much latency with no rollback at all */
  N.MAX_ROLL = 10;      /* the furthest back a correction may reach; beyond it the game waits for the other side */
  N.REDUNDANT = 8;      /* how many past frames of input ride along in every packet */
  N.CHECK = 30;         /* how often checksums are compared */
  N.resim = false;      /* true while frames are being replayed */

  /* ---- inputs: packed into one small integer array, the same on both machines (sticks to 1/127 steps) ---- */
  const BTN = ['atk', 'spc', 'jmp', 'shd', 'grb', 'sel', 'jmp2', 'tf'];   /* tf: the transform action */   /* jmp2: two jump buttons at once (a short hop) */
  const q = v => Math.max(-127, Math.min(127, Math.round(v * 127)));
  N.pack = i => { let b = 0; BTN.forEach((k, n) => { if (i[k]) b |= 1 << n; }); return [q(i.lx), q(i.ly), q(i.cx), q(i.cy), b]; };
  N.unpack = a => { const i = blankIn(); i.lx = a[0] / 127; i.ly = a[1] / 127; i.cx = a[2] / 127; i.cy = a[3] / 127; BTN.forEach((k, n) => { i[k] = !!(a[4] & (1 << n)); }); return i; };   /* no Start online: pausing would stop both games */
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
  const ZERO = [0, 0, 0, 0, 0];

  /* ---- snapshots ---- */
  let fixed = null;   /* objects that never change during a match: rosters, moves, stage */
  function markFixed() {
    fixed = new WeakSet(); const walk = o => { if (!o || typeof o !== 'object' || fixed.has(o)) return; fixed.add(o); for (const k in o) walk(o[k]); };
    walk(ROSTER); if (typeof PLATS !== 'undefined') walk(PLATS); if (typeof MAIN !== 'undefined') walk(MAIN); walk(T);
    if (typeof HITBOXES !== 'undefined') walk(HITBOXES);
  }
  function copyGraph(roots) {
    const map = new Map(), pairs = [];
    const cp = o => {
      if (o === null || typeof o !== 'object' || fixed.has(o)) return o;   /* numbers, strings, functions, fixed tables: shared */
      if (map.has(o)) return map.get(o);
      let c;
      if (Array.isArray(o)) { c = new Array(o.length); map.set(o, c); pairs.push([o, c]); for (let i = 0; i < o.length; i++) c[i] = cp(o[i]); return c; }
      if (o instanceof Set) { c = new Set(); map.set(o, c); pairs.push([o, c]); for (const v of o) c.add(cp(v)); return c; }
      if (o instanceof Map) { c = new Map(); map.set(o, c); pairs.push([o, c]); for (const [k, v] of o) c.set(cp(k), cp(v)); return c; }
      c = Object.create(Object.getPrototypeOf(o)); map.set(o, c); pairs.push([o, c]);
      for (const k of Object.keys(o)) c[k] = cp(o[k]);
      return c;
    };
    return { roots: roots.map(cp), pairs };
  }
  N.save = () => {
    if (!fixed) markFixed();
    const g = copyGraph([F, PROJ, COMBO]);
    return { g, timer, sudden, slowT, focus, finalT, FINAL: FINAL && Object.assign({}, FINAL), frame, mode, countdown, overT, result, paused, tick };
  };
  N.load = s => {
    /* write each copy back into the very object it was taken from, so outside references (the renderer's) stay good */
    let back = s.back; if (!back) { back = s.back = new Map(); for (const [live, c] of s.g.pairs) back.set(c, live); }   /* kept with the snapshot: level 10's planner loads one snapshot many times */
    const tr = v => (v !== null && typeof v === 'object' && back.has(v)) ? back.get(v) : v;
    for (const [live, c] of s.g.pairs) {
      if (Array.isArray(live)) { live.length = c.length; for (let i = 0; i < c.length; i++) live[i] = tr(c[i]); }
      else if (live instanceof Set) { live.clear(); for (const v of c) live.add(tr(v)); }
      else if (live instanceof Map) { live.clear(); for (const [k, v] of c) live.set(tr(k), tr(v)); }
      else { for (const k of Object.keys(live)) if (!(k in c)) delete live[k]; for (const k of Object.keys(c)) live[k] = tr(c[k]); }
    }
    F = back.get(s.g.roots[0]); PROJ = back.get(s.g.roots[1]);
    timer = s.timer; sudden = s.sudden; slowT = s.slowT; finalT = s.finalT || 0; FINAL = s.FINAL && Object.assign({}, s.FINAL); focus = s.focus && back.has(s.focus) ? back.get(s.focus) : s.focus; frame = s.frame; mode = s.mode; countdown = s.countdown; overT = s.overT; result = s.result; paused = s.paused; tick = s.tick;
  };
  /* a checksum of what decides the match: every fighter's numbers and state, every projectile's position */
  N.hash = () => {
    let h = 2166136261 >>> 0; const mix = v => { const s = typeof v === 'number' ? v.toFixed(4) : String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
    for (const f of F) { mix(f.x); mix(f.y); mix(f.vx); mix(f.vy); mix(f.pct); mix(f.stocks); mix(f.state); mix(f.mname || ''); mix(f.mf); mix(f.hitlag); mix(f.hitstun); mix(f.face); mix(f.fi); mix(f.shieldHp); }
    for (const p of PROJ) { mix(p.x); mix(p.y); mix(p.kind); }
    mix(timer); mix(frame);
    return h;
  };

  /* ---- the session ---- */
  let S = null;
  /* Start a session. me: 0 or 1 (which fighter this machine plays). transport: { send(obj), onMessage(fn) }. */
  N.start = (me, transport, opt) => {
    opt = opt || {};
    S = { me, tr: transport, f: 0, inp: [new Map(), new Map()], used: new Map(), snaps: new Map(), conf: -1, peerAck: -1, rem: -1,
      hashes: new Map(), peerHashes: new Map(), prov: new Map(), desync: null, stats: { rollbacks: 0, frames: 0, maxDepth: 0, resimMs: 0, waits: 0, lastRtt: 0, sent: 0, got: 0 },
      local: opt.local || (() => readDev(opt.dev || 'kb')) };
    for (let k = 0; k < N.DELAY; k++) { S.inp[0].set(k, ZERO); S.inp[1].set(k, ZERO); }   /* the first frames, before any input can arrive */
    S.rem = N.DELAY - 1;
    for (const f of F) { f.ctl.dev = 'net' + f.idx; }
    transport.onMessage(onMsg);
    return S;
  };
  N.session = () => S;
  N.stop = () => { if (S) for (const f of F) f.ctl.dev = 'cpu'; S = null; };
  function onMsg(m) {
    if (!S) return;
    if (m.t === 'in') {
      S.stats.got++;
      const other = 1 - S.me; let earliestWrong = Infinity;
      m.i.forEach((a, k) => {
        const fr = m.f - (m.i.length - 1) + k; if (S.inp[other].has(fr)) return;
        S.inp[other].set(fr, a);
        const guess = S.used.get(fr); if (guess && !same(guess, a) && fr < S.f) earliestWrong = Math.min(earliestWrong, fr);
      });
      while (S.inp[other].has(S.rem + 1)) S.rem++;
      S.remF = Math.max(S.remF || 0, m.f - N.DELAY);   /* the frame the other machine is playing now */
      if (typeof m.adv === 'number') S.peerAdv = m.adv;
      S.peerAck = Math.max(S.peerAck, m.ack);
      if (earliestWrong < Infinity) rollback(earliestWrong);
      if (m.ts) S.tr.send({ t: 'pong', ts: m.ts });
    } else if (m.t === 'pong') S.stats.lastRtt = Date.now() - m.ts;
    else if (m.t === 'hash') { S.peerHashes.set(m.f, m.h); checkHash(m.f); }
  }
  function checkHash(fr) { const a = S.hashes.get(fr), b = S.peerHashes.get(fr); if (a !== undefined && b !== undefined && a !== b && !S.desync) S.desync = { frame: fr, mine: a, theirs: b }; }
  /* the input both machines use for a player at a frame: the real one when known, else the last real one (a guess) */
  function inputAt(p, fr) { if (S.inp[p].has(fr)) return S.inp[p].get(fr); for (let k = fr - 1; k >= fr - 60; k--) if (S.inp[p].has(k)) return S.inp[p].get(k); return ZERO; }
  /* one game step with the given packed inputs: what pollMatch would do with real devices */
  function simulate(fr) {
    const a = [inputAt(0, fr), inputAt(1, fr)]; S.used.set(fr, a[1 - S.me]);
    S.snaps.set(fr, N.save());
    N._in = [N.unpack(a[0]), N.unpack(a[1])];
    step();
    if (fr % N.CHECK === 0) S.prov.set(fr, N.hash());   /* provisional until the other side's inputs up to fr are all in */
    S.snaps.delete(fr - N.MAX_ROLL - 2); S.used.delete(fr - N.MAX_ROLL - 2);
  }
  function rollback(from) {
    const depth = S.f - from; if (depth > N.MAX_ROLL + 1 || !S.snaps.has(from)) return;
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    N.load(S.snaps.get(from)); N.resim = true; const sf = sparkOff, fx = stepFx; sparkOff = true; stepFx = () => {};   /* no camera or particle steps while replaying */
    for (let fr = from; fr < S.f; fr++) simulate(fr);
    sparkOff = sf; stepFx = fx; N.resim = false;
    S.stats.rollbacks++; S.stats.maxDepth = Math.max(S.stats.maxDepth, depth); S.stats.resimMs += (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  }
  /* Called once per 1/60 s instead of step(). Returns false when it had to wait for the other machine. */
  N.tick = () => {
    if (!S) return false;
    /* too far ahead of what the other side has confirmed: wait (the other machine is slow or packets are late) */
    if (S.f - S.rem > N.MAX_ROLL) { S.stats.waits++; send(); return false; }
    /* time sync: a machine running ahead of the other (it started first, or its clock is faster) skips one step in eight
       until they are level, so neither keeps forcing the other into deep corrections */
    /* each side's view of its lead includes the same travel time, so half the difference between the two is the real lead */
    const lead = ((S.f - (S.remF || 0)) - (S.peerAdv || 0)) / 2;
    if (lead >= 1.5 && S.stats.frames % 8 === 0 && !S.skipped) { S.skipped = true; S.stats.slowed = (S.stats.slowed || 0) + 1; send(); return false; }
    S.skipped = false;
    const mine = N.pack(S.local()), fr = S.f + N.DELAY;
    S.inp[S.me].set(fr, mine);
    send();
    simulate(S.f); S.f++; S.stats.frames++;
    /* checksums: a frame's hash is final once the other side's inputs up to it are all in */
    for (const [fr, h] of S.prov) if (fr <= S.rem) { S.prov.delete(fr); S.hashes.set(fr, h); S.tr.send({ t: 'hash', f: fr, h }); checkHash(fr); }
    for (const k of S.inp[0].keys()) if (k < S.f - 120) { S.inp[0].delete(k); S.inp[1].delete(k); }
    return true;
  };
  function send() {
    /* only inputs this machine has really read: a frame it has not reached yet must not go out as a blank (the other side keeps the first copy it gets) */
    let fr = S.f + N.DELAY; while (fr >= 0 && !S.inp[S.me].has(fr)) fr--; if (fr < 0) return;
    const list = [];
    for (let k = Math.max(0, fr - N.REDUNDANT + 1); k <= fr; k++) list.push(S.inp[S.me].get(k) || ZERO);
    S.tr.send({ t: 'in', f: fr, i: list, ack: S.rem, adv: S.f - (S.remF || 0), ts: S.stats.frames % 30 === 0 ? Date.now() : 0 }); S.stats.sent++;
  }
  /* devices named net0 / net1 read the session's inputs */
  const readDev0 = readDev;
  readDev = dev => (dev.startsWith('net') && N._in) ? N._in[+dev.slice(3)] : readDev0(dev);
  /* no sounds or popups while replaying frames that were already heard and seen */
  const beep0 = beep, thwack0 = thwack, pop0 = pop, sfx0 = sfx;
  sfx = function () { if (!N.resim) return sfx0.apply(this, arguments); };
  beep = function () { if (!N.resim) return beep0.apply(this, arguments); };
  thwack = function () { if (!N.resim) return thwack0.apply(this, arguments); };
  pop = function () { if (!N.resim) return pop0.apply(this, arguments); };
  return N;
})();
if (typeof window !== 'undefined') window.NET = NET;
