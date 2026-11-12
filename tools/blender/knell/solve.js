// The pose solver for Knell's clips (anim.js). A pose is said the way an animator thinks of it: where the hips are and how
// they turn, how the torso and head turn on top, where each foot stands, where the dagger's grip is and which way its blade
// points, where the buckler is and which way it faces. This works out every bone's turn from that (forward kinematics down
// the spine, two-bone reach for the arms and legs, the wrist and grip roll that keep the wrist easiest, the collarbones
// following the reach), checks the result, and writes rig.py keys: plain turns ("qb", Blender axes) and the hips' move.
// Model axes throughout: metres, x his left, y up, z forward. Quaternions are [w, x, y, z].
const K = require('./knell.js');

/* ---- vectors and quaternions ---- */
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const D2R = Math.PI / 180;
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qinv = q => [q[0], -q[1], -q[2], -q[3]];
const qrot = (q, v) => { const p = qmul(qmul(q, [0, v[0], v[1], v[2]]), qinv(q)); return [p[1], p[2], p[3]]; };
const qaxis = (ax, deg) => { const a = unit(ax), h = deg * D2R / 2, s = Math.sin(h); return [Math.cos(h), a[0] * s, a[1] * s, a[2] * s]; };
const QI = [1, 0, 0, 0];
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(x => x / l); };
const qfrom2 = (a, b) => {   /* the shortest turn taking direction a to direction b */
  a = unit(a); b = unit(b); const d = dot(a, b);
  if (d < -0.999999) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); return qaxis(ax, 180); }
  const c = cross(a, b); return qnorm([1 + d, c[0], c[1], c[2]]);
};
const qangle = q => 2 * Math.acos(Math.min(1, Math.abs(q[0]))) / D2R;
const qslerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
  if (d > 0.9995) return qnorm(a.map((x, i) => x + (b[i] - x) * t));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((x, i) => (x * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
};
const qpow = (q, t) => qslerp(QI, q, t);
const qmat = m => {   /* rows m[r][c] */
  const tr = m[0][0] + m[1][1] + m[2][2]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = [(m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s]; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s]; }
  return qnorm(q);
};
/* the turn taking direction a0 to a1 and, as near as can be, b0 to b1 */
const frameMap = (a0, b0, a1, b1) => {
  const basis = (a, b) => { const e = unit(a), f = unit(sub(b, sc(e, dot(b, e)))); return [e, f, cross(e, f)]; };
  const [e0, f0, g0] = basis(a0, b0), [e1, f1, g1] = basis(a1, b1), m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const [u, v] of [[e1, e0], [f1, f0], [g1, g0]]) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r][c] += u[r] * v[c];
  return qmat(m);
};
/* the model's own axes as rig.py reads "rot": [pitch, yaw, roll] = about x (top forward), y (front to his left), z (left side up) */
const eul = r => r ? qmul(qaxis([0, 1, 0], r[1] || 0), qmul(qaxis([1, 0, 0], r[0] || 0), qaxis([0, 0, 1], r[2] || 0))) : QI;
/* how far q turns about axis a (the twist), and the rest (the swing) */
/* (wrapped to -180..180: a quaternion and its negative are the same turn, which a whole-body turn brings up) */
const twistOf = (q, a) => { a = unit(a); const p = dot([q[1], q[2], q[3]], a); let t = 2 * Math.atan2(p, q[0]) / D2R; if (t > 180) t -= 360; if (t < -180) t += 360; return t; };
const swingOf = (q, a) => { const b = qrot(q, a); return Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / D2R; };
/* to Blender's axes (x, -z, y) for rig.py's "qb" */
const qb = q => { const r = q[0] < 0 ? q.map(x => -x) : q; return [r[0], r[1], -r[3], r[2]].map(x => Math.round(x * 1e6) / 1e6); };

/* ---- the skeleton at rest ---- */
const B = {}; for (const b of K.bones) B[b.name] = { head: b.head, tail: b.tail, parent: b.parent };
const ORDER = K.bones.map(b => b.name);
const H = n => B[n].head, DIR = n => unit(sub(B[n].tail, B[n].head));
const LEN = n => len(sub(B[n].tail, B[n].head));
const SIDES = ['R', 'L'];
const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

/* forward kinematics: local turns D (model axes, rest frame), moves M and uniform scales S -> each bone's world turn and head */
function fk(D, M, S) {
  const W = {}, P = {}, Z = {};
  for (const n of ORDER) {
    const p = B[n].parent, d = D[n] || QI, m = M[n] || [0, 0, 0], s = S[n] || 1;
    if (!p) { W[n] = d; P[n] = add(H(n), m); Z[n] = s; continue; }
    W[n] = qmul(W[p], d); Z[n] = Z[p] * s;
    P[n] = add(P[p], sc(qrot(W[p], add(sub(H(n), H(p)), m)), Z[p]));
  }
  return { W, P, Z, at: (n, local) => add(P[n], sc(qrot(W[n], sub(local, H(n))), Z[n])) };
}

/* two-bone reach: root S, target T, lengths, the way the middle joint should point; returns the joint and what was reached */
function ik2(S, T, L1, L2, pole) {
  const v = sub(T, S), d = len(v), u = unit(v), dd = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let p = sub(pole, sc(u, dot(pole, u))); if (len(p) < 1e-6) p = cross(u, [1, 0, 0]); p = unit(p);
  const E = add(add(S, sc(u, a)), sc(p, h)), Tr = add(S, sc(u, dd));
  return { E, Tr, miss: Math.max(0, d - dd), u, p, n: unit(cross(p, u)) };
}
/* a limb's two bones turned to a reach: the upper keeps its rest bend axis on the new bend axis, the lower swings after it */
function limb(up, lo, d1, f1, n1, n0) {
  const Wu = frameMap(DIR(up), n0, d1, n1);
  const Wl = qmul(qfrom2(qrot(Wu, DIR(lo)), f1), Wu);
  return { Wu, Wl };
}
/* the rest bend axes: knees bend forward, elbows fold forward (the T-pose's palms face down) */
const BEND = { legR: [1, 0, 0], legL: [1, 0, 0], armR: [0, 1, 0], armL: [0, -1, 0] };

/* ---- the dagger in the right fist and the buckler on the left forearm ---- */
const WRIST = s => H('hand' + s);
const GRIP_OFF = sub(K.GRIP, WRIST('R'));   /* the grip from the wrist, at rest */
const HAND0 = s => DIR('hand' + s), FORE0 = s => DIR('fore' + s);
const BLADE = unit(sub(K.TIP, K.GRIP));   /* the blade's direction at rest, grip to point (the line the game's blade arc reads) */
const SHIELD_OFF = sub(K.SC, H('foreL'));   /* the buckler's centre from the left elbow, at rest */

/* poses: see anim.js. Returns the keys for rig.py and a report (misses, wrist bends) */
function solve(P, opt = {}) {
  const D = {}, M = {}, S = {}, notes = [];
  /* the spine: the hips turn and move; the torso's turn is spread up the vertebrae, the head's over the neck */
  /* hips.q: a whole-body turn put before the hips' own (a flip or a spin: the root bone does not reach the game) */
  D.hips = P.hips && P.hips.q ? qmul(P.hips.q, eul(P.hips.r)) : eul(P.hips && P.hips.r); M.hips = (P.hips && P.hips.m) || [0, 0, 0];
  const T = eul(P.chest), Hd = eul(P.head);
  D.spine = qpow(T, 0.2); D.spine2 = qpow(T, 0.2); D.spine3 = qpow(T, 0.25); D.chest = qpow(T, 0.35);
  D.neck = qpow(Hd, 0.4); D.head = qpow(Hd, 0.6);
  if (P.crest) D.crest = eul(P.crest);
  if (P.crestTip) D.crestTip = eul(P.crestTip);
  if (P.crestBack) D.crestBack = eul(P.crestBack);
  for (const s of SIDES) if (P['clav' + s]) D['clav' + s] = eul(P['clav' + s]);
  S.sword = P.bladeScale || opt.bladeScale || 1;
  if (P.eyes) { S.eyeL = S.eyeR = P.eyes; }
  let F = fk(D, M, S);
  /* the legs: each foot placed (ankle and turn), the knee toward where the foot points */
  for (const s of SIDES) {
    /* ft.q: the whole-body turn the foot shares (see hips.q); the knee's way is turned with it */
    const ft = (P['f' + s]) || {}, W0 = eul(ft.r), Wf = ft.q ? qmul(ft.q, W0) : W0, A = ft.a || H('foot' + s);
    const hip = F.P['thigh' + s], fwd = qrot(W0, [0, 0, 1]), out = s === 'R' ? [-1, 0, 0] : [1, 0, 0];
    const pole0 = unit(add(add(fwd, out, ft.out === undefined ? 0.25 : ft.out), [0, 0.1, 0])), pole = ft.q ? qrot(ft.q, pole0) : pole0;
    const L1 = len(sub(H('shin' + s), H('thigh' + s))), L2 = len(sub(H('foot' + s), H('shin' + s)));
    const k = ik2(hip, A, L1, L2, ft.knee || pole);
    if (k.miss > 0.005) notes.push('foot' + s + ' short ' + (k.miss * 100).toFixed(1) + 'cm');
    const d1 = unit(sub(k.E, hip)), f1 = unit(sub(k.Tr, k.E));
    const { Wu, Wl } = limb('thigh' + s, 'shin' + s, d1, f1, k.n, BEND['leg' + s]);
    const Wh = F.W.hips;
    D['thigh' + s] = qmul(qinv(Wh), Wu); D['shin' + s] = qmul(qinv(Wu), Wl); D['foot' + s] = qmul(qinv(Wl), Wf);
    D['toe' + s] = qaxis([1, 0, 0], ft.toe || 0);
  }
  /* the arms, a few rounds: the collarbones follow the reach, which moves the shoulders */
  const arms = {};
  for (let it = 0; it < 3; it++) {
    F = fk(D, M, S);
    for (const s of SIDES) {
      const a = P['arm' + s] || P[s]; if (!a) continue;
      const r = s === 'R' ? rightArm(F, a, D, notes, it === 2) : leftArm(F, a, D, notes, it === 2);
      arms[s] = r;
      D['arm' + s] = qmul(qinv(F.W['clav' + s]), r.Wa); D['fore' + s] = qmul(qinv(r.Wa), r.Wf); D['hand' + s] = qmul(qinv(r.Wf), r.Wh);
      if (!P['clav' + s] && it < 2) {   /* the collarbone turns a fifth of the way toward the reach, as the chest at rest sees it */
        const C = F.P['clav' + s], Wc = F.W[B['clav' + s].parent];
        const want = qrot(qinv(Wc), sub(r.W, C)), rest = sub(WRIST(s), H('clav' + s));
        const q = qfrom2(rest, want), ang = Math.min(qangle(q) * 0.22, 16);
        D['clav' + s] = qangle(q) > 0.1 ? qpow(q, ang / qangle(q)) : QI;
      }
    }
  }
  /* fingers: the right fist round the dagger's handle, the left a fist in the buckler's strap (or spread when open) */
  for (const s of SIDES) {
    const c = K.curl(s, P['curl' + s] !== undefined ? P['curl' + s] : (s === 'R' ? 78 : 70), s === 'R' ? 1.2 : 1);
    for (const [n, v] of Object.entries(c)) D[n] = eul(v.rot);
  }
  F = fk(D, M, S);
  const keys = {};
  const animated = ['hips', 'spine', 'spine2', 'spine3', 'chest', 'neck', 'head', 'crest', 'crestTip', 'crestBack', 'eyeL', 'eyeR', 'sword',
    ...SIDES.flatMap(s => ['clav' + s, 'arm' + s, 'fore' + s, 'hand' + s, 'thigh' + s, 'shin' + s, 'foot' + s, 'toe' + s, ...FINGERS.flatMap(f => [1, 2, 3].map(k => f + k + s))])];
  for (const n of animated) {
    const k = { qb: qb(D[n] || QI) };
    if (M[n] && n === 'hips') k.move = M[n].map(x => Math.round(x * 1e5) / 1e5);
    if (S[n] && S[n] !== 1) k.scale = [S[n], S[n], S[n]];
    keys[n] = k;
  }
  return { keys, F, arms, notes };
}

/* how far the upper arm rolls about its own line, from the shoulder (the swing taken out) */
const armTwist = (Wc, Wu, n) => { const Dl = qmul(qinv(Wc), Wu), sw = qfrom2(DIR(n), qrot(Dl, DIR(n))); return Math.abs(twistOf(qmul(qinv(sw), Dl), DIR(n))); };
/* the right arm: the grip at g, the blade along b; the fist's roll on the handle and the elbow's way chosen for the easiest wrist */
function rightArm(F, a, D, notes, last) {
  const s = 'R', Sh = F.P['armR'], Wc = F.W['clavR'], L1 = LEN('armR'), L2 = len(sub(WRIST(s), H('foreR')));
  const b = unit(a.b), base = qfrom2(BLADE, b);
  let best = null;
  const poles = [];
  for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; poles.push([Math.cos(t), Math.sin(t)]); }
  for (let th = 0; th < 360; th += 10) {
    const q = qmul(qaxis(b, th), base), Wt = sub(a.g, qrot(q, GRIP_OFF));
    const u = unit(sub(Wt, Sh)), e1 = unit(cross(u, [0, 1, 0])), e2 = cross(e1, u);
    for (const [c1, c2] of poles) {
      const pole = add(sc(e1, c1), e2, c2), k = ik2(Sh, Wt, L1, L2, pole);
      const d1 = unit(sub(k.E, Sh)), f1 = unit(sub(k.Tr, k.E)), { Wu, Wl } = limb('armR', 'foreR', d1, f1, k.n, BEND.armR);
      const Dh = qmul(qinv(Wl), q), sw = swingOf(Dh, HAND0(s)), tw = Math.abs(twistOf(Dh, HAND0(s)));
      const at = armTwist(Wc, Wu, 'armR');
      let cost = sw * sw + 0.15 * Math.max(0, tw - 60) ** 2 + 0.25 * Math.max(0, at - 70) ** 2 + 4e4 * k.miss;
      const loc = qrot(qinv(F.W.chest), sub(k.E, F.P.chest));   /* the elbow as the chest sees it: not into the body or up past the ear */
      if (loc[0] > -0.16 && Math.abs(loc[2]) < 0.16 && loc[1] < 0.3) cost += 2000;
      if (loc[1] > 0.25) cost += 800 * (loc[1] - 0.25) * 10;
      if (a.elbow) cost += 400 * (1 - dot(unit(sub(k.E, Sh)), unit(a.elbow)));
      if (!best || cost < best.cost) best = { cost, q, Wt, k, Wu, Wl, sw, tw };
    }
  }
  if (last) {
    if (best.k.miss > 0.01) notes.push('dagger short ' + (best.k.miss * 100).toFixed(1) + 'cm');
    if (best.sw > 70) notes.push('right wrist bent ' + best.sw.toFixed(0));
  }
  return { Wa: best.Wu, Wf: best.Wl, Wh: best.q, W: best.Wt, miss: best.k.miss, sw: best.sw };
}
/* the left arm: the wrist at w and the buckler facing n (its rim up as far as it can); the elbow's way and the forearm's roll
   chosen so it faces n most nearly */
function leftArm(F, a, D, notes, last) {
  const s = 'L', Sh = F.P['armL'], Wc = F.W['clavL'], L1 = LEN('armL'), L2 = len(sub(WRIST(s), H('foreL')));
  const n = unit(a.n);
  let best = null;
  for (let i = 0; i < 24; i++) {
    const t = i / 24 * Math.PI * 2, u = unit(sub(a.w, Sh)), e1 = unit(cross(u, [0, 1, 0])), e2 = cross(e1, u);
    const pole = add(sc(e1, Math.cos(t)), e2, Math.sin(t)), k = ik2(Sh, a.w, L1, L2, pole);
    const d1 = unit(sub(k.E, Sh)), f1 = unit(sub(k.Tr, k.E)), { Wu, Wl } = limb('armL', 'foreL', d1, f1, k.n, BEND.armL);
    /* the forearm's roll: the buckler's face (up at rest) turned toward n about the forearm */
    const cur = qrot(Wl, K.SN), cp = sub(cur, sc(f1, dot(cur, f1))), np = sub(n, sc(f1, dot(n, f1)));
    let roll = 0; if (len(cp) > 1e-4 && len(np) > 1e-4) roll = Math.atan2(dot(cross(unit(cp), unit(np)), f1), dot(unit(cp), unit(np))) / D2R;
    roll = Math.max(-100, Math.min(100, roll));
    const Wf = qmul(qaxis(f1, roll), Wl), face = Math.acos(Math.max(-1, Math.min(1, dot(qrot(Wf, K.SN), n)))) / D2R;
    const at = armTwist(Wc, Wu, 'armL');
    let cost = face * face + 0.3 * roll * roll * 0.1 + 0.25 * Math.max(0, at - 70) ** 2 + 4e4 * k.miss;
    const loc = qrot(qinv(F.W.chest), sub(k.E, F.P.chest));
    if (loc[0] < 0.16 && Math.abs(loc[2]) < 0.16 && loc[1] < 0.3) cost += 2000;
    if (loc[1] > 0.25) cost += 800 * (loc[1] - 0.25) * 10;
    if (a.elbow) cost += 400 * (1 - dot(unit(sub(k.E, Sh)), unit(a.elbow)));
    if (!best || cost < best.cost) best = { cost, k, Wu, Wf, face };
  }
  if (last) {
    if (best.k.miss > 0.01) notes.push('buckler hand short ' + (best.k.miss * 100).toFixed(1) + 'cm');
    if (best.face > 35 && !a.loose) notes.push('buckler off its facing by ' + best.face.toFixed(0));
  }
  const Wh = qmul(best.Wf, eul(a.hand || [0, 0, 0]));
  return { Wa: best.Wu, Wf: best.Wf, Wh, W: a.w, miss: best.k.miss };
}

module.exports = { solve, fk, add, sub, sc, dot, cross, len, unit, qmul, qinv, qrot, qaxis, qfrom2, eul, H, DIR, LEN, B, GRIP_OFF, SHIELD_OFF, BLADE, QI };
