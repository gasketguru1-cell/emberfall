// Knell's clips, from the owner's design document (Emberfall_Knell_Complete_Fighter_Design.pdf, sections 7, 8 and 12):
//   node tools/blender/knell/anim.js            writes assets/knell/work/rig.json, pack.json, contacts.json, expect.json
//                                               and his entry in assets/manifest.json
// Every attack is timed in the game's own frames (a key at frame n is the pose on frame n of the move: the manifest maps the
// clip one to one onto the move), and on every frame a dagger hit is out, the blade lies along that hit's capsule, read
// straight from sim.js: the point at the capsule's far end plus 0.6 of its radius, the grip a blade's length back along it.
// The poses are said as the document directs: a calibration twitch before each strike, a snap into a clear silhouette, a
// re-lock afterward like a clock escapement (a short hold, then a step back to the guard), the dagger kept short, the buckler
// working as hard as his face; no full-body spins. solve.js turns each pose into bone turns.
const fs = require('fs'), path = require('path');
const K = require('./knell.js');
const S = require('./solve.js');
const { add, sub, sc, unit, len, qrot, eul } = S;
const F = require('./simload.js')(), MV = F.moves;
const U = 13, MPU = U / 1.85;
const ROOT = path.join(__dirname, '..', '..', '..'), OUT = path.join(ROOT, 'assets', 'knell', 'work');
/* the dagger drawn at 0.76 of the model's size: grip to point 0.50 m, the document's "short recurved dagger" (its capsules run
   0.92 torso widths from the wrist) instead of the 0.66 m the sculpt came with */
const BS = 0.76, BL = len(sub(K.TIP, K.GRIP)) * BS;
const fr = n => n / 60;
const TURN = 0.35, TC = Math.cos(TURN), TS = Math.sin(TURN);   /* the game's turn toward the camera */
const depth = (x, fwd) => (fwd - x * TS) / TC;   /* model z drawn at a given screen-forward distance */

/* ---- the flips: how far he has turned on each of 20 frames, from Mixamo's Big Front Flip (assets/knell/mocap, made by
   mocap.py): the hips' pitch from its frame 15 to 49, scaled to one whole turn. sim.js holds the same table (FLIP) ---- */
const FLIP = (() => {
  const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'knell', 'mocap', 'Big_Front_Flip.json'), 'utf8'));
  let prev = null, acc = 0; const P = M.frames.map(k => { const up = qrot(k.q, [0, 1, 0]), a = Math.atan2(up[2], up[1]) * 180 / Math.PI;
    if (prev !== null) { let d = a - prev; if (d > 180) d -= 360; if (d < -180) d += 360; acc += d; } prev = a; return acc; });
  const m0 = 15, m1 = 49;
  return Array.from({ length: 20 }, (_, i) => { const mf = m0 + i / 19 * (m1 - m0), j = Math.floor(mf), t = mf - j, p = P[j] + (P[Math.min(j + 1, P.length - 1)] - P[j]) * t;
    return Math.round((p - P[m0]) / (P[m1] - P[m0]) * 360); });
})();
const flipAt = (n, f0) => FLIP[Math.max(0, Math.min(FLIP.length - 1, n - f0))];
/* a pose turned whole about the point c (metres) by q: the hips carry the turn (the root bone never reaches the game), the
   feet, the dagger and the buckler, all placed in the world, are carried round with it */
const rotAbout = (q, c, p) => add(c, qrot(q, sub(p, c)));
function spin(P, q, c) {
  const r = JSON.parse(JSON.stringify(P)), H0 = S.H('hips'), m = (r.hips && r.hips.m) || [0, 0, 0];
  r.hips = Object.assign({}, r.hips, { q, m: sub(rotAbout(q, c, add(H0, m)), H0) });
  for (const s of ['L', 'R']) { const f = r['f' + s]; if (f) { f.a = rotAbout(q, c, f.a || S.H('foot' + s)); f.q = q; } }
  if (r.armR) { r.armR.g = rotAbout(q, c, r.armR.g); r.armR.b = qrot(q, r.armR.b); if (r.armR.elbow) r.armR.elbow = qrot(q, r.armR.elbow); }
  if (r.armL) { r.armL.w = rotAbout(q, c, r.armL.w); r.armL.n = qrot(q, r.armL.n); if (r.armL.c) r.armL.c = rotAbout(q, c, r.armL.c); if (r.armL.elbow) r.armL.elbow = qrot(q, r.armL.elbow); }
  return r;
}
const pitch = deg => S.qaxis([1, 0, 0], deg), yaw = deg => S.qaxis([0, 1, 0], deg);
const hubM = h => [0, h[1] * U / MPU, depth(0, h[0] * U / MPU)];   /* a hub (H) as a point on the model */

/* ---- pose helpers ---- */
const clone = o => JSON.parse(JSON.stringify(o));
/* a pose changed: each named part replaced, or merged one level down for hips (m, r) and the arms */
const mod = (b, o) => { const r = clone(b); for (const [k, v] of Object.entries(o || {})) {
  if (v && typeof v === 'object' && !Array.isArray(v) && r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) && (k === 'hips')) r[k] = Object.assign(r[k], clone(v));
  else r[k] = v === null ? undefined : clone(v); } return r; };
const side = s => s === 'R' ? -1 : 1;
const BALL0 = s => sub(S.H('toe' + s), S.H('foot' + s));
/* a foot standing: the ball of the foot at (x, z) on the floor, turned yaw, the heel raised "heel" degrees (toes kept flat) */
const plant = (s, x, z, yaw = 0, heel = 0, lift = 0) => { const r = [heel, yaw, 0]; return { a: sub([x, 0.05 + lift, z], qrot(eul(r), BALL0(s))), r, toe: -heel }; };
/* a foot in the air: the ankle at p, turned r, the toes bent */
const foot = (p, r = [0, 0, 0], toe = 0) => ({ a: p, r, toe });
const dagger = (g, b) => ({ g, b });
const buckler = (w, n, o) => Object.assign({ w, n }, o || {});
/* the blade along a hit's capsule on frame f of move mv, its grip "x" metres to the side (his right is minus) */
const CONTACTS = [];
function cap(mv, f, x = -0.2, o = {}) {
  const hs = MV[mv].h.filter(h => h.f0 <= f && f <= h.f1 && !h.nb && !h.grab && h.pa !== undefined);
  if (!hs.length) throw new Error('no blade hit on ' + mv + ' frame ' + f);
  return aim(hs, mv, f, x, o, true);
}
/* the blade on a ring round his middle (the flips), on a frame with no hit: the same line a hit there would have */
function ringAt(n, f0, phi0, dir, hub, x = -0.2, len = 0.92 * 0.27) {
  const th = phi0 + dir * flipAt(n, f0), u = [Math.cos(th * Math.PI / 180), Math.sin(th * Math.PI / 180)], L = len * 1.15;
  const w = [hub[0] + u[0] * hub[2], hub[1] + u[1] * hub[2]];
  return aim([{ in: [w[0] * U, w[1] * U], x: (w[0] + u[0] * L) * U, y: (w[1] + u[1] * L) * U, r: 0.14 * 0.27 * 1.35 * U, pa: th }], 'ring', n, x, {}, false);
}
function aim(hs, mv, f, x, o, reg) {
  const pa = hs[0].pa * Math.PI / 180, u = [Math.cos(pa), Math.sin(pa)], pr = p => p[0] * u[0] + p[1] * u[1];
  let base = hs[0].in, tip = [hs[0].x, hs[0].y], r = 0;
  for (const h of hs) { if (pr(h.in) < pr(base)) base = h.in; if (pr([h.x, h.y]) > pr(tip)) tip = [h.x, h.y]; r = Math.max(r, h.r); }
  /* the game draws him turned 0.35 rad toward the camera (render3d: want = -0.35), so a point's place across the screen is
     z cos + x sin of that: the forward distance is solved for with the grip's side offset x, and the blade leans in z to match */
  const T = [tip[0] / MPU + u[0] * 0.6 * r / MPU, tip[1] / MPU + u[1] * 0.6 * r / MPU];
  const bz = u[0] / TC, bl = Math.hypot(bz, u[1]), b = [0, u[1] / bl, bz / bl];
  const Tm = [x, T[1], (T[0] - x * TS) / TC], Gm = sub(Tm, sc(b, BL));
  const id = mv + '@' + f;
  if (reg && !CONTACTS.some(c => c.id === id)) CONTACTS.push({ id, move: mv, frame: f, cap: [base[0] / U, base[1] / U, tip[0] / U, tip[1] / U, r / U], tip: [T[0], T[1]], grip: [T[0] - u[0] * BL, T[1] - u[1] * BL] });
  return Object.assign(dagger(Gm, b), o);
}
/* the buckler's hit (jab 3): its centre on that circle */
const shieldHit = (mv, f) => { const h = MV[mv].h.find(h => h.nb && h.f0 <= f && f <= h.f1); return [0.06, h.y / MPU, depth(0.06, h.x / MPU)]; };

/* ---- the guard: the buckler leads (left foot forward, his front turned a little toward the camera), the dagger chambered low
   at the right hip, point forward. Everything else is a change from here. ---- */
const GUARD = {
  hips: { m: [0, -0.075, 0], r: [5, -18, 0] }, chest: [6, -8, 0], head: [-8, 24, 0],
  fL: plant('L', 0.13, 0.20, -12), fR: plant('R', -0.17, -0.15, -48),
  armL: buckler([0.13, 0.97, 0.15], [-0.35, 0.12, 1]), armR: dagger([-0.25, 0.84, 0.09], [0, 0.42, 1]),
};
const G = o => mod(GUARD, o);
const LOW = o => G(Object.assign({ hips: { m: [0, -0.2, -0.02], r: [16, -22, 0] }, chest: [12, -6, 0], head: [-22, 26, 0],
  fL: plant('L', 0.15, 0.24, -14), fR: plant('R', -0.2, -0.2, -52, 25),
  armL: buckler([0.1, 0.82, 0.24], [-0.3, 0.2, 1]), armR: dagger([-0.26, 0.66, 0.06], [0, 0.35, 1]) }, o));
/* in the air: knees drawn up, the buckler out in front */
const AIR = {
  hips: { m: [0, 0.0, 0], r: [10, -14, 0] }, chest: [4, -6, 0], head: [-10, 20, 0],
  fL: foot([0.13, 0.30, 0.12], [-20, -10, 0], 10), fR: foot([-0.16, 0.18, -0.12], [20, -30, 0], 0),
  armL: buckler([0.15, 1.0, 0.16], [-0.3, 0.15, 1]), armR: dagger([-0.26, 0.86, 0.04], [0, 0.3, 1]),
};
const A_ = o => mod(AIR, o);
const shieldUp = (o) => G(Object.assign({ hips: { m: [0, -0.13, -0.02], r: [10, -26, 0] }, chest: [12, -14, 0], head: [-16, 32, 0],
  fL: plant('L', 0.15, 0.2, -16), fR: plant('R', -0.18, -0.18, -55, 15),
  armL: buckler([0.08, 1.06, 0.18], [-0.15, 0.1, 1]), armR: dagger([-0.22, 0.86, -0.02], [0, 0.6, 0.8]) }, o));

/* ---- clips: [frame, pose, { in, lag, eyes }] ---- */
const CLIPS = {}, LOOP = {};
const clip = (name, keys, o) => { CLIPS[name] = keys; if (o && o.loop) LOOP[name] = 1; };
const at = (f, p, o) => Object.assign({ f, p }, o || {});

/* Idle, by the document's keys 0 / 18 / 36 / 64: the lamp eyes pulse, the buckler sinks a little, the blade wrist sets itself */
clip('Idle', [at(0, G()),
  at(18, G({ hips: { m: [0, -0.083, 0] }, armL: buckler([0.13, 0.94, 0.15], [-0.35, 0.18, 1]), eyes: 1.12 })),
  at(36, G({ hips: { m: [0, -0.08, 0] }, armL: buckler([0.13, 0.95, 0.15], [-0.35, 0.16, 1]), armR: dagger([-0.25, 0.85, 0.1], [0, 0.55, 1]), eyes: 1.04 })),
  at(44, G({ armR: dagger([-0.25, 0.845, 0.095], [0, 0.4, 1]) }), { in: 'out' }),
  at(64, G())], { loop: 1 });
/* now and then: he lifts the dagger to his eyes, checks its edge, taps it twice on the buckler's rim, and sets back */
const LOOK = G({ chest: [2, -14, 0], head: [6, 18, -10], armR: dagger([-0.14, 1.2, 0.26], [0.3, 0.75, 0.6]), armL: buckler([0.14, 1.0, 0.2], [-0.4, 0.2, 1]) });
clip('Idle2', [at(0, G()), at(22, LOOK), at(40, mod(LOOK, { head: [10, 12, 6], armR: dagger([-0.13, 1.21, 0.27], [0.5, 0.7, 0.5]) })),
  at(58, G({ chest: [8, -2, 0], head: [-8, 18, 0], armL: buckler([0.12, 1.0, 0.26], [-0.6, 0.15, 1]), armR: dagger([-0.08, 1.14, 0.30], [0.9, 0.1, 0.5]) }), { in: 'snap' }),
  at(64, G({ chest: [8, -2, 0], head: [-8, 18, 0], armL: buckler([0.12, 1.0, 0.26], [-0.6, 0.15, 1]), armR: dagger([-0.12, 1.2, 0.27], [0.9, 0.3, 0.5]) }), { in: 'out' }),
  at(70, G({ chest: [8, -2, 0], head: [-8, 18, 0], armL: buckler([0.12, 1.0, 0.26], [-0.6, 0.15, 1]), armR: dagger([-0.08, 1.14, 0.30], [0.9, 0.1, 0.5]), eyes: 1.2 }), { in: 'snap' }),
  at(78, G({ chest: [8, -2, 0], head: [-8, 18, 0], armR: dagger([-0.14, 1.12, 0.24], [0.6, 0.3, 0.6]), eyes: 1.05 }), { in: 'out' }),
  at(104, G({ hips: { m: [0, -0.08, 0] } })), at(140, G())]);

/* Walk: a short, quick clockwork step (his legs are short: the stance runs 0.4 m under him); heel down, roll, push off the toe */
const walkKeys = (n, cyc, A, opt) => {
  const keys = [];
  for (let k = 0; k <= n; k++) {
    const ph = k / n, P = mod(GUARD, opt.base);
    for (const s of ['L', 'R']) {
      const q = (ph + (s === 'R' ? 0.5 : 0)) % 1, x = (s === 'L' ? 1 : -1) * opt.w, yaw = s === 'L' ? opt.yawL : opt.yawR;
      if (q < opt.stance) {   /* planted: the ankle carried back at the body's speed */
        const u = q / opt.stance, z = A - 2 * A * u + opt.dz, heel = u > 0.7 ? (u - 0.7) / 0.3 * opt.push : u < 0.15 ? -opt.strike * (1 - u / 0.15) : 0;
        P['f' + s] = plant(s, x, z, yaw, heel);
        if (heel < 0) { const r = [heel, yaw, 0], b = sub(S.H('toe' + s), S.H('foot' + s)); P['f' + s] = { a: sub([x, 0.05 - Math.sin(-heel * Math.PI / 180) * 0.0, z], qrot(eul(r), b)), r, toe: 0 }; }
      } else {   /* swinging through, the foot lifted and brought forward */
        const u = (q - opt.stance) / (1 - opt.stance), e = 0.5 - 0.5 * Math.cos(Math.PI * u), z = -A + 2 * A * e + opt.dz;
        const lift = Math.sin(Math.PI * u) * opt.lift, pitch = opt.push * (1 - u) * 1.2 - opt.strike * u;
        P['f' + s] = foot([x, 0.14 + lift + Math.max(0, pitch) * 0.002, z - Math.max(0, pitch) * 0.001], [pitch, yaw, 0], -Math.max(0, pitch) * 0.4);
      }
    }
    const c = Math.cos(2 * Math.PI * ph), s2 = Math.cos(4 * Math.PI * ph);
    P.hips = { m: [0, opt.y + opt.bob * (s2 > 0 ? -s2 : -s2 * 0.6), opt.lean[2] || 0], r: [opt.lean[0], opt.lean[1] + opt.turn * c, opt.roll * Math.sin(2 * Math.PI * ph)] };
    P.chest = [opt.chest[0], opt.chest[1] - opt.turn * 1.4 * c, -opt.roll * 0.5 * Math.sin(2 * Math.PI * ph)];
    P.head = [opt.head[0], opt.head[1] + opt.turn * 0.4 * c, 0];
    const sw = Math.cos(2 * Math.PI * ph);
    P.armR = dagger(add(opt.grip, [0, opt.armY * Math.abs(sw), -opt.armSwing * sw]), opt.blade);
    P.armL = buckler(add(opt.wrist, [0, opt.bucklerBob * s2, opt.bucklerSwing * sw]), opt.face);
    keys.push(at(Math.round(ph * cyc), P, { in: 'lin' }));
  }
  return keys;
};
const WALK = { w: 0.13, stance: 0.62, lift: 0.07, push: 26, strike: 12, dz: 0.0, y: -0.095, bob: 0.012, turn: 7, roll: 3, yawL: -6, yawR: -22,
  lean: [8, -14], chest: [6, -6], head: [-12, 20], grip: [-0.24, 0.84, 0.05], armY: 0.01, armSwing: 0.05, blade: [0, 0.35, 1],
  wrist: [0.13, 0.97, 0.17], bucklerBob: 0.008, bucklerSwing: 0.025, face: [-0.35, 0.12, 1] };
const WALK_A = 0.2;
clip('Walk', walkKeys(8, 40, WALK_A, WALK), { loop: 1 });
const WALK_STRIDE = 2 * WALK_A / WALK.stance;   /* metres a cycle: the planted foot's 0.4 m over 62% of it */
/* Run: low and long, a skitter of short contacts and long bounds, the boots striking hard; the buckler carried ahead, the dagger back */
const RUN = { w: 0.11, stance: 0.24, lift: 0.2, push: 40, strike: 8, dz: 0.04, y: -0.1, bob: 0.03, turn: 9, roll: 2, yawL: -4, yawR: -12,
  lean: [20, -10, 0.04], chest: [10, -6], head: [-26, 14], grip: [-0.26, 0.8, -0.1], armY: 0.02, armSwing: 0.08, blade: [0, 0.2, 1],
  wrist: [0.13, 1.0, 0.24], bucklerBob: 0.01, bucklerSwing: 0.03, face: [-0.3, 0.05, 1] };
const RUN_A = 0.24;
clip('Run', walkKeys(8, 24, RUN_A, RUN), { loop: 1 });
const RUN_STRIDE = 2 * RUN_A / RUN.stance;

/* Brake: the run's lean thrown back, the front boot skidding ahead, the buckler up */
clip('Brake', [at(0, G({ hips: { m: [0, -0.12, 0.04], r: [16, -12, 0] } })),
  at(5, G({ hips: { m: [0, -0.17, -0.06], r: [-6, -22, 0] }, chest: [-4, -10, 0], head: [-4, 26, 0], fL: plant('L', 0.13, 0.36, -10, -14), fR: plant('R', -0.17, -0.2, -50, 20), armL: buckler([0.12, 1.0, 0.24], [-0.25, 0.2, 1]) }), { in: 'out' }),
  at(12, G({ hips: { m: [0, -0.11, -0.02] } })), at(24, G())]);
/* Squat (three frames in the game), Rise and the air */
const SQUAT = G({ hips: { m: [0, -0.2, -0.02], r: [14, -16, 0] }, chest: [10, -6, 0], head: [-18, 22, 0], fL: plant('L', 0.13, 0.18, -12), fR: plant('R', -0.17, -0.12, -40, 10),
  armL: buckler([0.13, 0.86, 0.2], [-0.35, 0.3, 1]), armR: dagger([-0.26, 0.7, 0.0], [0, 0.2, 1]) });
clip('Squat', [at(0, G()), at(6, SQUAT, { in: 'out' })]);
clip('Rise', [at(0, mod(SQUAT, { hips: { m: [0, 0.02, 0.02], r: [-4, -14, 0] }, fL: foot([0.12, 0.08, 0.1], [40, -8, 0], -10), fR: foot([-0.15, 0.06, -0.1], [45, -30, 0], -10),
  armL: buckler([0.16, 1.14, 0.18], [-0.3, 0.4, 1]), armR: dagger([-0.28, 1.0, -0.06], [0, 0.6, 0.9]) })),
  at(10, A_({ fL: foot([0.13, 0.26, 0.1], [0, -10, 0], 0), fR: foot([-0.16, 0.16, -0.1], [30, -30, 0], 0) }), { in: 'out' }),
  at(24, A_())]);
clip('Fall', [at(0, A_()), at(20, A_({ hips: { m: [0, 0.01, 0] }, fL: foot([0.13, 0.26, 0.1], [-14, -10, 0], 8), fR: foot([-0.16, 0.2, -0.1], [24, -30, 0], 0), armL: buckler([0.16, 1.03, 0.16], [-0.3, 0.2, 1]) })), at(40, A_())], { loop: 1 });
const FF = A_({ hips: { m: [0, 0.04, 0], r: [-2, -12, 0] }, chest: [-4, -6, 0], head: [-6, 18, 0], fL: foot([0.12, 0.08, 0.05], [30, -6, 0], 0), fR: foot([-0.14, 0.1, -0.05], [34, -20, 0], 0),
  armL: buckler([0.2, 1.28, 0.12], [-0.3, 0.6, 1]), armR: dagger([-0.3, 1.24, -0.02], [0, 0.85, 0.5]) });
clip('FastFall', [at(0, FF), at(10, mod(FF, { hips: { m: [0, 0.035, 0] } })), at(20, FF)], { loop: 1 });
/* the air jump, Brand's new one (the owner, 2026-11-12), 50 frames: a kick off nothing, one full spin round (1-14) with the
   dagger held out level at his right side so it sweeps a circle at hip height, then one forward somersault laid out long
   (15-40) that also turns once round the upright axis as it goes (a twisting flip), all about his middle; open by 46.
   Every frame of the turns is keyed (the feet and the dagger are placed in the world, so they must be carried round each frame) */
const AJC = [0, 0.8, 0], AJE = k => k * k * (3 - 2 * k);
const AJSPIN = A_({ hips: { m: [0, 0.04, 0], r: [8, -10, 0] }, chest: [6, -4, 0], head: [-10, 10, 0],
  fL: foot([0.14, 0.34, 0.12], [-20, -8, 0], 6), fR: foot([-0.2, 0.2, -0.1], [24, -30, 0], 0),
  armL: buckler([0.24, 1.02, 0.16], [-0.2, 0.2, 1], { loose: 1 }), armR: dagger([-0.52, 0.86, 0.06], [-1, 0, 0.25]) });
const AJLAY = A_({ hips: { m: [0, 0.02, 0], r: [16, -10, 0] }, chest: [10, -4, 0], head: [-14, 10, 0],
  fL: foot([0.12, 0.08, -0.06], [30, -6, 0], -10), fR: foot([-0.14, 0.12, -0.16], [40, -20, 0], -10),
  armL: buckler([0.3, 1.02, 0.18], [-0.1, 0.4, 1], { loose: 1 }), armR: dagger([-0.3, 0.84, -0.12], [0, -0.55, -0.8]) });
const AJY = [[1, 0], [3, 18], [5, 85], [7, 160], [9, 235], [11, 300], [13, 345], [15, 360]];
const ajYaw = n => { for (let i = 1; i < AJY.length; i++) if (n <= AJY[i][0]) { const [f0, y0] = AJY[i - 1], [f1, y1] = AJY[i]; return y0 + (y1 - y0) * (n - f0) / (f1 - f0); } return 360; };
clip('AirJump', [at(0, A_({ hips: { m: [0, 0.1, 0], r: [16, -12, 0] }, fL: foot([0.12, 0.4, 0.16], [-30, -8, 0], 0), fR: foot([-0.14, 0.34, 0.08], [-20, -20, 0], 0) })),
  at(1, A_({ hips: { m: [0, 0.02, 0], r: [-4, -12, 0] }, fL: foot([0.12, 0.06, 0.04], [36, -6, 0], -10), fR: foot([-0.15, 0.08, -0.1], [40, -24, 0], -10) }), { in: 'snap' }),
  ...Array.from({ length: 13 }, (_, i) => i + 2).map(n => at(n, spin(AJSPIN, yaw(-ajYaw(n)), AJC))),
  ...Array.from({ length: 25 }, (_, i) => i + 15).map(n => { const k = AJE((n - 15) / 25);
    return at(n, spin(AJLAY, S.qmul(yaw(-360 * k), pitch(360 * k)), AJC)); }),
  at(40, A_({ hips: { m: [0, 0.04, 0], r: [10, -12, 0] }, armR: dagger([-0.28, 0.9, 0.0], [0, 0.4, 1]) })),
  at(46, A_(), { in: 'out' }), at(50, A_())]);
/* helpless after Turnkey and Rimskip: the lamps dimmed, arms loose above, legs apart */
const HELP = A_({ hips: { m: [0, 0.02, 0], r: [-8, -10, 0] }, chest: [-10, -4, 0], head: [-16, 12, 0], eyes: 0.8, curlL: 30,
  fL: foot([0.16, 0.12, 0.12], [20, 0, 0], 0), fR: foot([-0.18, 0.16, -0.12], [28, -30, 0], 0),
  armL: buckler([0.36, 1.28, 0.06], [0.2, 0.7, 0.6], { loose: 1 }), armR: dagger([-0.42, 1.24, -0.02], [-0.2, 0.9, 0.3]) });
clip('Helpless', [at(0, HELP), at(18, mod(HELP, { hips: { m: [0, 0.03, 0], r: [-4, -14, 0] }, armL: buckler([0.34, 1.32, 0.1], [0.2, 0.7, 0.6], { loose: 1 }), armR: dagger([-0.4, 1.28, 0.02], [-0.1, 0.9, 0.4]) })), at(36, HELP)], { loop: 1 });
/* landing: the knees take it, the buckler dips; a hard landing drops him to a knee */
clip('Land', [at(0, G({ hips: { m: [0, -0.22, 0.0], r: [18, -16, 0] }, chest: [14, -6, 0], head: [-22, 22, 0], fL: plant('L', 0.15, 0.18, -12), fR: plant('R', -0.18, -0.13, -42, 12),
  armL: buckler([0.15, 0.82, 0.2], [-0.35, 0.35, 1]), armR: dagger([-0.3, 0.68, 0.02], [0, 0.1, 1]), eyes: 1.1 })),
  at(9, G({ hips: { m: [0, -0.12, 0] } }), { in: 'out' }), at(24, G())]);
const KNEEL = G({ hips: { m: [0, -0.33, 0.02], r: [22, -14, 0] }, chest: [18, -4, 0], head: [-26, 20, 0], fL: plant('L', 0.15, 0.28, -12), fR: plant('R', -0.18, -0.24, -40, 45),
  armL: buckler([0.18, 0.5, 0.36], [-0.3, 0.8, 0.6], { loose: 1 }), armR: dagger([-0.32, 0.6, -0.04], [0, 0.0, 1]), eyes: 1.2 });
clip('LandHard', [at(0, mod(KNEEL, { hips: { m: [0, -0.26, 0.02] } })), at(6, KNEEL, { in: 'out' }), at(20, KNEEL), at(36, G({ hips: { m: [0, -0.12, 0] } })), at(48, G())]);
/* crouch: low behind the buckler (the game holds 0.18 s) */
const CROUCH = LOW({ hips: { m: [0, -0.27, -0.03], r: [20, -22, 0] }, chest: [14, -8, 0], head: [-26, 28, 0], fL: plant('L', 0.15, 0.22, -14), fR: plant('R', -0.2, -0.22, -52, 34),
  armL: buckler([0.1, 0.74, 0.22], [-0.3, 0.2, 1]), armR: dagger([-0.27, 0.58, 0.02], [0, 0.25, 1]) });
clip('Crouch', [at(0, G()), at(11, CROUCH, { in: 'out' }), at(40, mod(CROUCH, { hips: { m: [0, -0.275, -0.03] }, eyes: 1.08 })), at(70, CROUCH)]);
/* shield: the buckler up and square, hunched behind it; struck, it rattles */
clip('Shield', [at(0, G()), at(7, shieldUp(), { in: 'out' })]);
clip('ShieldHit', [at(0, shieldUp()), at(3, shieldUp({ hips: { m: [0, -0.14, -0.06] }, armL: buckler([0.07, 1.07, 0.1], [-0.05, 0.25, 1]), eyes: 1.25 }), { in: 'out' }),
  at(6, shieldUp({ armL: buckler([0.09, 1.04, 0.2], [-0.25, 0.0, 1]) })), at(9, shieldUp({ armL: buckler([0.08, 1.06, 0.17], [-0.12, 0.14, 1]) })), at(18, shieldUp())]);

/* struck: the head and chest snap away from the blow, the buckler rattles on the arm, then re-locks */
const hurt = (dir, big) => { const k = big ? 1.5 : 1, b = dir;
  return [at(0, G()),
    at(4, G({ hips: { m: [0, -0.1, -0.06 * b * k], r: [-12 * b * k, -24, 6] }, chest: [-16 * b * k, -18, -6], head: [-18 * b * k, 34, 12], eyes: 1.3,
      fR: plant('R', -0.17, -0.18, -48, 14), armL: buckler([0.22, 1.08, 0.04 - 0.05 * b], [0.1, 0.5, 1], { loose: 1 }), armR: dagger([-0.36, 0.98, -0.14 * b], [-0.2, 0.7, 0.6]) }), { in: 'out' }),
    at(9, G({ hips: { m: [0, -0.12, -0.04 * b * k], r: [-6 * b * k, -20, -3] }, chest: [-8 * b * k, -12, 4], head: [-10 * b * k, 28, -6],
      armL: buckler([0.18, 1.02, 0.08], [-0.2, 0.2, 1]), armR: dagger([-0.33, 0.92, -0.08 * b], [0, 0.5, 0.8]) })),
    at(14, G({ hips: { m: [0, -0.11, -0.03 * b * k], r: [-8 * b * k, -21, 2] }, chest: [-10 * b * k, -14, -3], armL: buckler([0.2, 1.05, 0.06], [0, 0.35, 1]) })),
    at(big ? 34 : 24, G({ hips: { m: [0, -0.1, 0] } }), { in: 'out' }), at(big ? 48 : 36, G())]; };
clip('Hit', hurt(1, false)); clip('HitHeavy', hurt(1, true)); clip('HitBack', hurt(-1, false)); clip('HitHeavyBack', hurt(-1, true));
/* sent flying: flung back, limbs trailing; up; down */
const FLUNG = A_({ hips: { m: [0, 0.06, -0.05], r: [-30, -10, 0] }, chest: [-24, -8, 0], head: [-20, 16, 0], eyes: 1.3, curlL: 30,
  fL: foot([0.15, 0.26, 0.24], [-30, 0, 0], 0), fR: foot([-0.17, 0.2, 0.18], [-20, -20, 0], 0),
  armL: buckler([0.4, 1.14, -0.12], [0.6, 0.3, -0.2], { loose: 1 }), armR: dagger([-0.44, 1.1, -0.16], [-0.3, 0.3, -0.9]) });
clip('Launch', [at(0, G()), at(5, FLUNG, { in: 'out' }), at(18, mod(FLUNG, { hips: { r: [-36, -14, 6] } })), at(30, mod(FLUNG, { hips: { r: [-28, -10, -4] } }))]);
const UPF = A_({ hips: { m: [0, 0.04, 0], r: [-6, -10, 0] }, chest: [-14, -6, 0], head: [-26, 10, 0], eyes: 1.3, curlL: 30,
  fL: foot([0.14, 0.06, 0.04], [36, 0, 0], -10), fR: foot([-0.16, 0.08, -0.06], [40, -20, 0], -10),
  armL: buckler([0.3, 0.86, -0.06], [0.7, -0.2, 0.2], { loose: 1 }), armR: dagger([-0.36, 0.8, -0.04], [-0.3, -0.6, -0.3]) });
clip('LaunchUp', [at(0, G()), at(5, UPF, { in: 'out' }), at(24, mod(UPF, { hips: { r: [-10, -14, 4] } })), at(40, mod(UPF, { hips: { r: [-4, -10, -2] } }))]);
const SPK = A_({ hips: { m: [0, 0.1, 0], r: [30, -10, 0] }, chest: [20, -6, 0], head: [10, 14, 0], eyes: 1.3, curlL: 30,
  fL: foot([0.14, 0.4, -0.08], [-40, 0, 0], 0), fR: foot([-0.16, 0.34, -0.16], [-30, -20, 0], 0),
  armL: buckler([0.3, 1.4, 0.0], [0.4, 0.8, 0.2], { loose: 1 }), armR: dagger([-0.32, 1.38, -0.04], [-0.2, 0.9, -0.2]) });
clip('Spike', [at(0, G()), at(5, SPK, { in: 'out' }), at(40, mod(SPK, { hips: { r: [24, -12, 0] } }))]);
/* tumbling: curled round the buckler, rocking (played back and forth) */
const CURL = A_({ hips: { m: [0, 0.14, 0], r: [26, -12, 0] }, chest: [22, -6, 0], head: [-6, 16, 0], fL: foot([0.13, 0.46, 0.2], [-40, -8, 0], 0), fR: foot([-0.15, 0.4, 0.12], [-34, -24, 0], 0),
  armL: buckler([0.12, 0.98, 0.3], [-0.2, 0.4, 1]), armR: dagger([-0.22, 0.9, 0.22], [0, -0.3, 1]) });
clip('Tumble', [at(0, mod(CURL, { all: { r: [-30, 0, 0], m: [0, 0.1, 0] } })), at(30, mod(CURL, { all: { r: [30, 0, 0], m: [0, 0.3, 0] } }))]);
/* down: on his back, the buckler over his chest */
const FLAT = { all: { r: [-82, 0, 0], m: [0, 0.18, 0.4] }, hips: { m: [0, 0, 0], r: [0, -10, 0] }, chest: [6, -4, 0], head: [-24, 20, 0], eyes: 0.85,
  fL: foot([0.15, 0.2, 0.18], [-40, -10, 0], 0), fR: foot([-0.17, 0.14, 0.06], [-20, -30, 0], 0),
  armL: buckler([0.08, 1.02, 0.3], [-0.2, 0.2, 1]), armR: dagger([-0.38, 0.8, 0.06], [-0.3, 0.2, 1]) };
clip('Down', [at(0, G({ hips: { m: [0, -0.18, -0.04], r: [-14, -16, 0] }, chest: [-12, -6, 0] })), at(9, mod(FLAT, { all: { r: [-60, 0, 0], m: [0, 0.2, 0.2] } }), { in: 'snap' }), at(18, FLAT, { in: 'back' })]);
/* the spot dodge: a slip behind the buckler, away from the camera and back */
clip('Dodge', [at(0, G()), at(5, LOW({ hips: { m: [0.16, -0.24, -0.08], r: [18, -40, -8] }, chest: [10, -20, 0], head: [-16, 50, 0], fL: plant('L', 0.2, 0.16, -20), fR: plant('R', -0.1, -0.2, -55, 30),
  armL: buckler([0.15, 0.95, 0.12], [-0.6, 0.2, 0.9]), armR: dagger([-0.1, 0.7, -0.12], [0, 0.4, 1]), eyes: 0.8 }), { in: 'out' }),
  at(15, LOW({ hips: { m: [0.14, -0.22, -0.06], r: [16, -36, -6] }, chest: [10, -18, 0], fL: plant('L', 0.2, 0.16, -20), fR: plant('R', -0.1, -0.2, -55, 30), eyes: 0.8 })),
  at(22, G({ hips: { m: [0, -0.1, 0] } }), { in: 'out' }), at(25, G())]);
/* the roll: a low skating scuttle behind the buckler (no somersault) */
const SCUT = LOW({ hips: { m: [0, -0.3, 0], r: [26, -20, 0] }, chest: [16, -10, 0], head: [-30, 28, 0], armL: buckler([0.12, 0.66, 0.26], [-0.3, 0.3, 1]), armR: dagger([-0.28, 0.5, -0.04], [0, 0.2, 1]), eyes: 0.8 });
clip('Roll', [at(0, G()), at(4, SCUT, { in: 'out' }),
  at(10, mod(SCUT, { fL: plant('L', 0.15, 0.3, -14, 20), fR: plant('R', -0.2, -0.1, -52, 10) })), at(16, mod(SCUT, { fL: plant('L', 0.15, 0.14, -14), fR: plant('R', -0.2, -0.28, -52, 40) })),
  at(22, SCUT), at(28, G(), { in: 'out' })]);
/* the air dodge: tucked tight behind the buckler, then open */
clip('AirDodge', [at(0, A_()), at(4, mod(CURL, { eyes: 0.75 }), { in: 'out' }), at(24, mod(CURL, { eyes: 0.8 })), at(40, A_(), { in: 'out' })]);
/* on the ledge: the dagger driven into the lip as a hook, the left hand over the edge, boots against the wall */
const HANG = { hips: { m: [0, 0.34, 0.1], r: [-6, 0, 0] }, chest: [-8, 0, 0], head: [-26, 0, 0],
  fL: foot([0.13, 0.36, 0.3], [-20, 0, 0], 10), fR: foot([-0.15, 0.3, 0.32], [-30, 0, 0], 10),
  armL: buckler([0.18, 1.72, 0.44], [-0.2, 0.3, -1], { loose: 1 }), armR: dagger([-0.18, 1.76, 0.42], [0, -0.6, 0.8]), curlL: 75 };
clip('Ledge', [at(0, HANG), at(40, mod(HANG, { hips: { m: [0, 0.33, 0.1] }, fR: foot([-0.15, 0.32, 0.31], [-30, 0, 0], 10), eyes: 1.08 })), at(80, HANG)], { loop: 1 });
/* holding a grab: the left hand hooked on them (0.6 m out), the dagger cocked at the hip */
const HOLD = G({ hips: { m: [0, -0.1, 0.03], r: [6, -26, 0] }, chest: [6, -16, 0], head: [-10, 40, 0], armL: buckler([0.04, 0.98, 0.42], [0.8, 0.3, 0.4], { loose: 1 }), curlL: 80,
  armR: dagger([-0.26, 0.92, -0.06], [0, 0.85, 0.5]) });
clip('Hold', [at(0, HOLD), at(30, mod(HOLD, { hips: { m: [0, -0.11, 0.03] }, eyes: 1.08 })), at(60, HOLD)], { loop: 1 });
/* the pummel: the buckler's knuckle-rim tapped into the ribs (14 frames) */
clip('Pummel', [at(0, HOLD), at(3, mod(HOLD, { armL: buckler([0.06, 0.98, 0.32], [0.8, 0.3, 0.4], { loose: 1 }), chest: [4, -22, 0] }), { in: 'out' }),
  at(5, mod(HOLD, { armL: buckler([0.03, 1.0, 0.5], [0.9, 0.2, 0.3], { loose: 1 }), chest: [8, -8, 0], eyes: 1.25 }), { in: 'snap' }), at(10, HOLD, { in: 'out' }), at(18, HOLD)]);
/* held by someone: hanging, kicking, the buckler pushing at them */
const HELD = A_({ hips: { m: [0, 0.06, 0], r: [-4, -10, 0] }, chest: [-8, -6, 0], head: [-12, 20, 0], fL: foot([0.14, 0.1, 0.06], [30, 0, 0], 0), fR: foot([-0.16, 0.12, -0.04], [20, -20, 0], 0),
  armL: buckler([0.14, 1.12, 0.26], [-0.2, 0.3, 1]), armR: dagger([-0.3, 0.98, -0.1], [0, 0.6, 0.8]) });
clip('Held', [at(0, HELD), at(15, mod(HELD, { fL: foot([0.14, 0.18, 0.14], [0, 0, 0], 0), fR: foot([-0.16, 0.06, -0.08], [40, -20, 0], 0), armL: buckler([0.15, 1.14, 0.3], [-0.2, 0.3, 1]) })), at(30, HELD)], { loop: 1 });
/* respawn platform: the guard, lamps waking */
clip('Respawn', [at(0, G({ eyes: 0.7 })), at(30, G({ eyes: 1.2 })), at(60, G({ eyes: 0.9 }))], { loop: 1 });

/* ---- throws (26 frames each in the game's picture; the release frames are the game's) ---- */
/* Slip Knot (forward, release 11): the buckler driven up under the sternum */
clip('ThrowF', [at(0, HOLD), at(6, mod(HOLD, { hips: { m: [0, -0.18, -0.04], r: [12, -30, 0] }, chest: [10, -26, 0], armL: buckler([0.08, 0.82, 0.3], [0.2, 0.4, 1]), eyes: 1.1 }), { in: 'out' }),
  at(11, G({ hips: { m: [0, -0.1, 0.14], r: [-4, -10, 0] }, chest: [-8, -4, 0], head: [-14, 20, 0], fL: plant('L', 0.13, 0.36, -10), fR: plant('R', -0.17, -0.12, -40, 30),
    armL: buckler([0.12, 1.2, 0.46], [0, 0.7, 0.8]), eyes: 1.3 }), { in: 'snap' }),
  at(16, G({ hips: { m: [0, -0.1, 0.12] }, fL: plant('L', 0.13, 0.36, -10), armL: buckler([0.12, 1.14, 0.42], [-0.2, 0.5, 1]) }), { in: 'out' }), at(26, G())]);
/* Rewind (back, 13): swung round the buckler's handle, the hips ratcheting a half turn and back */
clip('ThrowB', [at(0, HOLD), at(5, mod(HOLD, { hips: { m: [0, -0.12, 0.03], r: [6, -50, 0] }, chest: [6, -30, 0], armL: buckler([0.0, 1.0, 0.4], [0.8, 0.3, 0.4], { loose: 1 }) })),
  at(10, mod(HOLD, { hips: { m: [0, -0.14, 0], r: [8, 40, 0] }, chest: [6, 50, 0], head: [-10, 30, 0], fR: plant('R', -0.17, -0.15, -20, 20), armL: buckler([0.34, 1.06, -0.02], [0.9, 0.2, -0.3], { loose: 1 }) }), { in: 'snap' }),
  at(13, mod(HOLD, { hips: { m: [0, -0.12, 0], r: [6, 70, 0] }, chest: [4, 60, 0], head: [-6, 10, 0], fR: plant('R', -0.17, -0.15, -10, 20), armL: buckler([0.44, 1.12, -0.24], [0.6, 0.4, -0.8]), eyes: 1.3 }), { in: 'snap' }),
  at(17, mod(HOLD, { hips: { m: [0, -0.11, 0], r: [6, 40, 0] }, chest: [4, 30, 0], armL: buckler([0.34, 1.04, -0.06], [0.5, 0.3, 0.2]) }), { in: 'out' }), at(26, G(), { in: 'out' })]);
/* Open Clock (up, 12): the knife ratcheted twice against the buckler's rim, then driven up */
const TU = G({ hips: { m: [0, -0.12, 0.02] }, armL: buckler([0.06, 1.12, 0.38], [0, 0.8, 0.5]), armR: dagger([-0.14, 0.98, 0.26], [0.6, 0.6, 0.4]) });
clip('ThrowU', [at(0, HOLD), at(4, TU, { in: 'out' }), at(6, mod(TU, { armR: dagger([-0.1, 1.04, 0.28], [0.6, 0.75, 0.2]), eyes: 1.15 }), { in: 'snap' }), at(8, TU, { in: 'snap' }),
  at(10, mod(TU, { armR: dagger([-0.1, 1.04, 0.28], [0.6, 0.75, 0.2]), eyes: 1.15 }), { in: 'snap' }),
  at(12, G({ hips: { m: [0, -0.04, 0.04], r: [-4, -12, 0] }, chest: [-10, -4, 0], head: [-30, 20, 0], fL: plant('L', 0.13, 0.2, -12, 10), fR: plant('R', -0.17, -0.15, -48, 25),
    armL: buckler([0.1, 1.3, 0.28], [0, 1, 0.3]), armR: dagger([-0.14, 1.58, 0.16], [0, 1, 0.1]), eyes: 1.3 }), { in: 'snap' }),
  at(17, G({ hips: { m: [0, -0.08, 0.02] }, armR: dagger([-0.16, 1.4, 0.16], [0, 0.9, 0.3]) }), { in: 'out' }), at(26, G())]);
/* Set the Tooth (down, 12): the buckler's rim pins the ankle, then the boot */
clip('ThrowD', [at(0, HOLD), at(6, LOW({ hips: { m: [0, -0.3, 0.06], r: [30, -24, 0] }, chest: [22, -12, 0], head: [-10, 30, 0], armL: buckler([0.08, 0.36, 0.46], [0, 0.8, 0.6], { loose: 1 }), eyes: 1.1 }), { in: 'snap' }),
  at(9, LOW({ hips: { m: [0, -0.22, 0.0], r: [10, -24, 0] }, chest: [14, -10, 0], fR: foot([-0.15, 0.26, 0.04], [-10, -20, 0], 0), armL: buckler([0.08, 0.4, 0.46], [0, 0.8, 0.6], { loose: 1 }) })),
  at(12, LOW({ hips: { m: [0, -0.16, -0.04], r: [-6, -20, 0] }, chest: [4, -8, 0], fR: foot([-0.12, 0.14, 0.46], [50, -10, 0], 0), armL: buckler([0.12, 0.62, 0.36], [-0.2, 0.5, 1]), eyes: 1.3 }), { in: 'snap' }),
  at(17, G({ hips: { m: [0, -0.12, 0] }, fR: foot([-0.15, 0.18, 0.1], [20, -30, 0], 0) }), { in: 'out' }), at(26, G())]);

/* ---- attacks ---- */
/* a strike's skeleton: the guard, the calibration twitch (a small turn against the coming cut, the lamps flaring), the
   wind-up, the contact frames (each on its capsule), the re-lock (held a beat, then stepped back) and the guard */
const twitch = (p, o) => mod(p, Object.assign({ eyes: 1.18 }, o));
const strike = (start, keys) => [at(0, start), ...keys];
/* the lunge: hips forward and down, the right side turned in, the front foot stepped out */
const lunge = (dz, dy, yaw, o) => G(Object.assign({ hips: { m: [0, -0.075 - dy, dz], r: [8, yaw, 0] }, chest: [10, yaw * 0.6, 0], head: [-10, -yaw * 1.2 + 6, 0],
  fL: plant('L', 0.13, 0.2 + dz * 1.6, -10), fR: plant('R', -0.17, -0.15 + dz * 0.2, -48 + yaw * 0.5, 18 + dz * 60),
  armL: buckler([0.18, 0.98, 0.04 + dz * 0.5], [-0.7, 0.15, 0.7], { loose: 1 }) }, o));

/* Needle (jab 1, 3-4): the point poked straight out at chest height */
clip('Jab', strike(G(), [at(1, twitch(G(), { armR: dagger([-0.25, 0.84, 0.06], [0, 0.2, 1]) })),
  at(3, lunge(0.12, 0.04, 22, { armR: cap('jab', 3, -0.12) }), { in: 'snap' }), at(4, lunge(0.13, 0.04, 23, { armR: cap('jab', 4, -0.12) })),
  at(8, lunge(0.1, 0.04, 18, { armR: dagger([-0.14, 0.98, 0.32], [0, 0.18, 1]) }), { in: 'out' }), at(14, G({ hips: { m: [0, -0.08, 0.02] } }))]));
/* Reversal (jab 2, 4-5): the wrist turned over and the point raked down through shin height */
const J2 = lunge(0.1, 0.07, 18, {});
clip('Cut2', strike(lunge(0.08, 0.04, 16, { armR: dagger([-0.14, 0.98, 0.3], [0, 0.18, 1]) }), [
  at(2, mod(J2, { armR: dagger([-0.12, 1.12, 0.24], [0, 0.95, 0.3]), eyes: 1.18 }), { in: 'out' }),
  at(4, mod(J2, { hips: { m: [0, -0.15, 0.1] }, armR: cap('jab2', 4, -0.12) }), { in: 'snap' }), at(5, mod(J2, { hips: { m: [0, -0.155, 0.1] }, armR: cap('jab2', 5, -0.12) })),
  at(9, mod(J2, { hips: { m: [0, -0.13, 0.08] }, armR: dagger([-0.14, 0.72, 0.36], [0, -0.5, 0.86]) }), { in: 'out' }), at(16, G({ hips: { m: [0, -0.08, 0.02] } }))]));
/* Buckle (jab 3, 6-8): the buckler's rim clips forward at the hip as the dagger rakes up past it */
const J3 = lunge(0.12, 0.1, 20, { armL: buckler([0.12, 0.8, 0.3], [-0.3, 0.1, 1], { c: shieldHit('jab3', 6) }) });
clip('Cut3', strike(lunge(0.08, 0.06, 16, { armR: dagger([-0.14, 0.72, 0.36], [0, -0.5, 0.86]) }), [
  at(3, lunge(0.06, 0.12, 6, { armR: dagger([-0.22, 0.62, 0.1], [0, -0.3, 1]), armL: buckler([0.16, 0.9, 0.06], [-0.6, 0.1, 0.8]), eyes: 1.18 }), { in: 'out' }),
  ...[6, 7, 8].map(f => at(f, mod(J3, { armR: cap('jab3', f, -0.14) }), f === 6 ? { in: 'snap' } : {})),
  at(14, mod(J3, { armR: dagger([-0.16, 1.24, 0.3], [0, 0.95, 0.3]) }), { in: 'out' }), at(18, mod(J3, { armR: dagger([-0.16, 1.22, 0.3], [0, 0.95, 0.3]) })), at(27, G())]));

/* Dial Cut (forward tilt, 6-8, three tracks): F1 anticipation, F4 the wrist set on its track, F6-8 the cut, F12 settle */
const ft = (mv, name, o) => clip(name, strike(G(), [
  at(1, twitch(G({ chest: [4, -16, 0], armR: dagger([-0.27, 0.88, -0.04], [0, o.wb, 1]) }))),
  at(4, lunge(0.08, o.dy * 0.6, 14, { armR: dagger([-0.18, o.wy, 0.16], [0, o.wb, 1]) }), { in: 'out' }),
  ...[6, 7, 8].map(f => at(f, lunge(0.2, o.dy, 26 + o.yaw, Object.assign({ armR: cap(mv, f, o.x) }, o.body || {})), f === 6 ? { in: 'snap' } : {})),
  at(12, lunge(0.17, o.dy, 22 + o.yaw, Object.assign({ armR: cap(mv, 8, o.x) }, o.body || {})), { in: 'out' }),
  at(15, lunge(0.12, o.dy * 0.8, 16, { armR: dagger([-0.2, o.wy, 0.18], [0, o.wb, 1]) }), { in: 'hold' }), at(24, G(), { in: 'out' })]));
ft('ftilt', 'Dial', { x: -0.12, dy: 0.06, yaw: 0, wy: 0.98, wb: 0.0 });
ft('ftiltL', 'DialLow', { x: -0.14, dy: 0.2, yaw: -2, wy: 0.7, wb: -0.8, body: { chest: [24, 12, 0], head: [-4, -20, 0] } });
ft('ftiltH', 'DialHigh', { x: -0.12, dy: 0.0, yaw: -4, wy: 1.2, wb: 0.9, body: { chest: [-4, 12, 0], head: [-20, -16, 0], fR: plant('R', -0.17, -0.11, -40, 30) } });
/* Keyturn (up tilt): F1 coil, F5 behind the helm, F7 overhead, F9 in front: a narrow hook over his own helm */
const UT = (m, extra) => G(Object.assign({ hips: { m: [0, -0.02, 0.02], r: [-4, -8, 0] }, chest: [-12, 0, 0], head: [-14, 10, 0],
  fL: plant('L', 0.13, 0.17, -12, 22), fR: plant('R', -0.17, -0.12, -40, 34), armL: buckler([0.18, 1.0, 0.18], [-0.3, 0.4, 1]) }, extra));
clip('Keyturn', strike(G(), [at(1, twitch(LOW({ armR: dagger([-0.22, 0.76, 0.12], [0, 0.6, 0.8]) }))),
  at(3, UT(0, { hips: { m: [0, -0.06, 0] }, armR: dagger([-0.18, 1.28, 0.06], [0, 0.8, -0.6]) }), { in: 'out' }),
  at(5, UT(0, { chest: [-18, -6, 0], head: [-20, 14, 0], armR: cap('utilt', 5, -0.12) }), { in: 'snap' }), at(6, UT(0, { chest: [-18, -4, 0], head: [-22, 14, 0], armR: cap('utilt', 6, -0.12) })),
  ...[7, 8, 9].map(f => at(f, UT(0, { chest: [-14, 4, 0], head: [-26, 6, 0], armR: cap('utilt', f, -0.06) }))),
  at(13, UT(0, { armR: dagger([-0.12, 1.2, 0.36], [0, 0.2, 1]) }), { in: 'out' }), at(16, UT(0, { armR: dagger([-0.14, 1.16, 0.34], [0, 0.2, 1]) })), at(25, G(), { in: 'out' })]));
/* Ankle Tick (down tilt): F1 crouch, F4 the undercut (the arm almost on the floor), F6 drawn back */
const DT = o => LOW(Object.assign({ hips: { m: [0, -0.3, 0.14], r: [30, 18, 0] }, chest: [26, 14, 0], head: [-34, -12, 0], fL: plant('L', 0.15, 0.4, -12), fR: plant('R', -0.2, -0.16, -40, 40),
  armL: buckler([0.18, 0.66, 0.2], [-0.5, 0.4, 0.8]) }, o));
clip('AnkleTick', strike(G(), [at(1, twitch(CROUCH)),
  at(4, DT({ armR: cap('dtilt', 4, -0.16) }), { in: 'snap' }), at(5, DT({ armR: cap('dtilt', 5, -0.16) })), at(6, DT({ armR: cap('dtilt', 6, -0.16) })),
  at(10, DT({ hips: { m: [0, -0.26, 0.08] }, armR: dagger([-0.24, 0.6, 0.3], [0, 0.1, 1]) }), { in: 'out' }), at(20, G(), { in: 'out' })]));
/* Guillotine Arc (forward smash): the knife raised to the eyebrow line (held there while charged, frame 10), the buckler bracing
   the wrist, then dragged down in a hook, 16-18; the step forward is the game's (frames 13-17) */
const FSW = G({ hips: { m: [0, -0.1, -0.06], r: [0, -28, 0] }, chest: [-8, -22, 0], head: [-10, 30, 0], fR: plant('R', -0.17, -0.18, -50, 12),
  armR: dagger([-0.16, 1.42, -0.04], [0, 0.85, -0.5]), armL: buckler([0.0, 1.22, 0.14], [-0.6, 0.3, 0.8]) });
const FSH = (dz, o) => lunge(dz, 0.1, 28, Object.assign({ chest: [12, 18, 0], fR: plant('R', -0.17, -0.22, -40, 30) }, o));
clip('Guillotine', strike(G(), [at(2, twitch(G({ armR: dagger([-0.26, 0.82, 0.02], [0, -0.2, 1]) }))),
  at(10, FSW, { in: 'out' }), at(13, mod(FSW, { hips: { m: [0, -0.11, -0.04] }, armR: dagger([-0.15, 1.46, -0.02], [0, 0.9, -0.4]), eyes: 1.3 })),
  at(16, FSH(0.16, { chest: [0, 10, 0], armR: cap('fsmash', 16, -0.1), armL: buckler([0.04, 1.1, 0.2], [-0.6, 0.2, 0.8]) }), { in: 'snap' }),
  at(17, FSH(0.2, { chest: [8, 16, 0], armR: cap('fsmash', 17, -0.1) })), at(18, FSH(0.22, { chest: [14, 20, 0], armR: cap('fsmash', 18, -0.12) })),
  at(23, FSH(0.2, { chest: [18, 20, 0], hips: { m: [0, -0.2, 0.2] }, armR: dagger([-0.18, 0.56, 0.38], [0, -0.8, 0.5]) }), { in: 'out' }),
  at(28, FSH(0.18, { chest: [16, 18, 0], hips: { m: [0, -0.19, 0.18] }, armR: dagger([-0.18, 0.58, 0.36], [0, -0.8, 0.5]) }), { in: 'hold' }),
  at(45, G(), { in: 'out' })]));
/* Clockstrike (up smash): crouched over the buckler (charged on frame 8), the buckler lifts and the dagger thrusts up through
   four clock positions, 12-15 */
const US = o => G(Object.assign({ hips: { m: [0, -0.04, 0.04], r: [-6, -10, 0] }, chest: [-12, 0, 0], head: [-26, 12, 0],
  fL: plant('L', 0.13, 0.2, -12, 24), fR: plant('R', -0.17, -0.12, -44, 34), armL: buckler([0.12, 1.32, 0.3], [-0.1, 0.9, 0.5]) }, o));
clip('Clockstrike', strike(G(), [at(2, twitch(G())),
  at(8, LOW({ hips: { m: [0, -0.28, 0], r: [22, -16, 0] }, armL: buckler([0.12, 0.7, 0.34], [-0.1, 0.5, 1]), armR: dagger([-0.24, 0.6, 0.12], [0, -0.3, 1]), eyes: 1.25 }), { in: 'out' }),
  at(12, US({ hips: { m: [0, -0.12, 0.06], r: [6, -12, 0] }, chest: [0, 4, 0], armR: cap('usmash', 12, -0.12) }), { in: 'snap' }),
  at(13, US({ hips: { m: [0, -0.08, 0.05] }, chest: [-6, 4, 0], armR: cap('usmash', 13, -0.12) })),
  at(14, US({ chest: [-12, 4, 0], armR: cap('usmash', 14, -0.1) })), at(15, US({ chest: [-18, 2, 0], head: [-34, 10, 0], armR: cap('usmash', 15, -0.08) })),
  at(20, US({ chest: [-18, 0, 0], head: [-30, 12, 0], armR: dagger([-0.1, 1.5, -0.06], [0, 0.6, -0.8]) }), { in: 'out' }),
  at(26, US({ chest: [-14, 0, 0], armR: dagger([-0.1, 1.48, -0.06], [0, 0.6, -0.8]) }), { in: 'hold' }), at(43, G(), { in: 'out' })]));
/* Split Seconds (down smash): the front ankle cut (10-11), the torso ratcheted round almost half a turn, the second cut snapped
   behind (17-18) */
const DS = (yaw, o) => LOW(Object.assign({ hips: { m: [0, -0.3, 0.0], r: [24, yaw * 0.45, 0] }, chest: [22, yaw * 0.55, 0], head: [-30, -yaw * 0.3, 0],
  fL: plant('L', 0.17, 0.28, -14), fR: plant('R', -0.2, -0.24, -48, 30), armL: buckler([0.16, 0.7, 0.2], [-0.3, 0.4, 1]) }, o));
clip('SplitSeconds', strike(G(), [at(2, twitch(CROUCH)),
  at(6, DS(-30, { armR: dagger([-0.3, 0.62, -0.04], [0, 0.4, 1]), eyes: 1.25 }), { in: 'out' }),
  at(10, DS(20, { armR: cap('dsmash', 10, -0.2) }), { in: 'snap' }), at(11, DS(22, { armR: cap('dsmash', 11, -0.2) })),
  at(13, DS(70, { armR: dagger([-0.34, 0.5, 0.0], [0, -0.4, -1]) }), { in: 'hold' }),
  at(15, DS(110, { armR: dagger([-0.3, 0.6, -0.3], [0, -0.3, -1]) }), { in: 'out' }),
  at(17, DS(150, { armR: cap('dsmash', 17, 0.05) }), { in: 'snap' }), at(18, DS(152, { armR: cap('dsmash', 18, 0.05) })),
  at(24, DS(140, { armR: dagger([-0.3, 0.6, -0.42], [0, 0.2, -1]) }), { in: 'out' }), at(30, DS(80, {}), { in: 'hold' }), at(45, G(), { in: 'out' })]));

/* ---- air ---- */
/* Pendulum (neutral air), a full front flip (the owner, 2026-11-12): tucked tight, the dagger held out from a hub at his middle
   goes once round him with the body (sim.js NAIR: three stinging passes, in front, under and behind, then the finisher over
   the top). Every frame of the turn is keyed, the body's turn from the Mixamo flip curve */
const NHUB = [0.02, 0.45, 0.22], UHUB = [0.02, 0.55, 0.3];
/* the old Pendulum's air guard (the buckler as the hub), still the wheel's base below */
const NA = o => A_(Object.assign({ hips: { m: [0, 0.04, 0], r: [8, 10, 0] }, chest: [6, 10, 0], head: [-8, -4, 0], armL: buckler([0.1, 1.0, 0.24], [-0.4, 0.1, 1]) }, o));
const TUCK = o => A_(Object.assign({ hips: { m: [0, 0.14, 0.02], r: [24, -10, 0] }, chest: [24, -6, 0], head: [-4, 14, 0], eyes: 1.15,
  fL: foot([0.13, 0.5, 0.24], [-46, -8, 0], 0), fR: foot([-0.15, 0.46, 0.16], [-40, -22, 0], 0),
  armL: buckler([0.14, 0.96, 0.3], [-0.2, 0.3, 1], { loose: 1 }) }, o));
const OPEN = o => A_(Object.assign({ hips: { m: [0, 0.06, 0], r: [12, -10, 0] }, chest: [10, -6, 0], head: [-8, 16, 0], eyes: 1.1 }, o));
/* a flip clip: frames a..b keyed one by one, body(n) turned by turn(n) about the point c, the dagger from dag(n) */
const flipKeys = (a, b, body, turn, c, dagOf) => Array.from({ length: b - a + 1 }, (_, i) => { const n = a + i, p = spin(body(n), turn(n), c); p.armR = dagOf(n); return at(n, p); });
clip('Pendulum', [at(0, A_()), at(2, twitch(OPEN({ armR: ringAt(2, 3, 20, -1, NHUB, -0.18) })), { in: 'out' }),
  ...flipKeys(3, 22, n => n < 5 || n > 19 ? OPEN() : TUCK(), n => pitch(flipAt(n, 3)), hubM(NHUB), n => n >= 5 && n <= 20 ? cap('nair', n, -0.18) : ringAt(n, 3, 20, -1, NHUB, -0.18)),
  at(27, OPEN({ armR: dagger([-0.22, 1.08, 0.24], [0, 0.6, 0.8]) }), { in: 'out' }), at(34, A_(), { in: 'out' })]);
/* Prismatic Fang (forward air, three tracks): F1 torso twist, F4 aim, F6-8 the stab, F12 the recoil bracket */
const fa = (mv, name, o) => clip(name, strike(A_(), [at(1, twitch(A_({ chest: [4, -24, 0], armR: dagger([-0.26, 0.9, -0.08], [0, o.wb, 1]) }))),
  at(4, A_({ hips: { r: [10, 6, 0] }, chest: [6, 4, 0], armR: dagger([-0.18, o.wy, 0.12], [0, o.wb, 1]) }), { in: 'out' }),
  ...[6, 7, 8].map(f => at(f, A_(Object.assign({ hips: { m: [0, 0.02, 0.06], r: [12, 22, 0] }, chest: [8, 18, 0], head: [-12, -18, 0], armR: cap(mv, f, o.x),
    armL: buckler([0.16, 1.0, 0.04], [-0.7, 0.15, 0.7], { loose: 1 }), fL: foot([0.13, 0.22, 0.2], [-10, -10, 0], 0), fR: foot([-0.16, 0.22, -0.2], [30, -30, 0], 0) }, o.body || {})), f === 6 ? { in: 'snap' } : {})),
  at(12, A_({ hips: { r: [6, -10, 0] }, chest: [0, -16, 0], armR: dagger([-0.22, o.wy + 0.08, 0.06], [0, o.wb + 0.9, 0.6]) }), { in: 'out' }),
  at(16, A_({ hips: { r: [6, -10, 0] }, chest: [0, -14, 0], armR: dagger([-0.22, o.wy + 0.06, 0.06], [0, o.wb + 0.9, 0.6]) }), { in: 'hold' }), at(31, A_(), { in: 'out' })]));
fa('fair', 'Fang', { x: -0.12, wy: 1.0, wb: 0 });
fa('fairL', 'FangLow', { x: -0.14, wy: 0.76, wb: -0.8, body: { chest: [22, 16, 0], head: [-2, -20, 0] } });
fa('fairH', 'FangHigh', { x: -0.12, wy: 1.24, wb: 0.9, body: { chest: [-8, 14, 0], head: [-22, -14, 0] } });
/* Backhand Ratchet (back air), now a spinning backhand: he turns whole on the spot, his back to the target as the blade lashes
   out behind (8-10), and comes all the way round. The turn's pace is the flip curve's */
const BA = o => A_(Object.assign({ hips: { r: [6, -10, 0] }, chest: [2, -6, 0], head: [-10, 6, 0], armL: buckler([0.14, 1.0, 0.18], [-0.3, 0.1, 1]),
  fL: foot([0.13, 0.26, 0.14], [-16, -10, 0], 6), fR: foot([-0.15, 0.16, -0.16], [26, -30, 0], 0) }, o));
clip('Backhand', [at(0, A_()),
  ...flipKeys(1, 20, n => BA(), n => yaw(-flipAt(n, 1)), [0, 0.83, 0], n => n >= 8 && n <= 10 ? cap('bair', n, 0.12) : spin(BA({ armR: dagger([-0.2, 1.0, 0.24], [0, 0.3, 1]) }), yaw(-flipAt(n, 1)), [0, 0.83, 0]).armR),
  at(26, BA({ armR: dagger([-0.26, 0.9, 0.1], [0, 0.4, 1]) }), { in: 'out' }), at(35, A_(), { in: 'out' })]);
/* Bell Needle (up air), a back flip: tucked, the dagger out at arm's length rakes over his head from in front to behind (5-8) */
clip('BellNeedle', [at(0, A_()), at(1, twitch(OPEN({ armR: ringAt(1, 2, -10, 1, UHUB, -0.04, 0.87 * 0.27) })), { in: 'out' }),
  ...flipKeys(2, 21, n => n < 4 || n > 18 ? OPEN() : TUCK({ chest: [16, -4, 0] }), n => pitch(-flipAt(n, 2)), hubM(UHUB), n => n >= 5 && n <= 8 ? cap('uair', n, -0.04) : ringAt(n, 2, -10, 1, UHUB, -0.04, 0.87 * 0.27)),
  at(28, A_(), { in: 'out' })]);
/* Deadfall (down air), a dive: he pitches forward till he hangs head-down, the dagger driven straight down at arm's length
   (the spike on 10-11), holds there a beat, then rolls on round to land upright */
const DIVE = o => A_(Object.assign({ hips: { m: [0, 0.02, 0], r: [-6, -8, 0] }, chest: [-4, -4, 0], head: [-30, 8, 0], eyes: 1.25,
  fL: foot([0.1, 0.15, -0.02], [16, -6, 0], 0), fR: foot([-0.12, 0.16, -0.06], [20, -20, 0], 0),
  armL: buckler([0.18, 1.0, 0.22], [-0.2, 0.2, 1], { loose: 1 }) }, o));
const DPIV = [0, 0.95, 0.02];
const dTurn = n => n <= 3 ? 0 : n <= 10 ? flipAt(n, 3) * 180 / flipAt(10, 3) : n <= 13 ? 180 + (n - 10) * 4 : n >= 26 ? 360 : 192 + 168 * (t => t * t * (3 - 2 * t))((n - 13) / 13);
clip('Deadfall', [at(0, A_()),
  ...flipKeys(2, 26, n => n > 20 ? OPEN() : n > 14 ? TUCK() : DIVE(), n => pitch(dTurn(n)), DPIV,
    n => n >= 10 && n <= 12 ? cap('dair', n, -0.02) : spin(DIVE({ armR: dagger([-0.1, 1.62, 0.08], [0, 1, 0.1]) }), pitch(dTurn(n)), DPIV).armR),
  at(32, OPEN(), { in: 'out' }), at(41, A_(), { in: 'out' })]);

/* (the dash attack sits here, after the air clips, for TUCK and OPEN)
   Slipstitch (dash attack), from Mixamo's Big Jump (the owner, 2026-11-12): out of the run he leaps into a forward roll along
   the floor, the dagger held out from his middle going once round with him and slashing the whole way (sim.js DASH: four
   linked passes, then the finisher that sets up the up tilt as he comes up). DROLL and DLIFT are sim.js's tables: the roll's
   turn on frames 4 to 28 and his middle's rise and drop (metres) from the capture */
const DROLL = [0, 12, 20, 34, 47, 62, 77, 91, 106, 118, 129, 139, 149, 160, 172, 184, 206, 238, 266, 290, 311, 327, 342, 353, 360];
const DLIFT = [0.01, 0.12, 0.22, 0.29, 0.35, 0.39, 0.41, 0.41, 0.39, 0.34, 0.27, 0.19, 0.1, -0.01, -0.13, -0.24, -0.36, -0.46, -0.49, -0.48, -0.47, -0.46, -0.43, -0.36, -0.32];
const DHUB = [0.06, 0.45, 0.24];
const dIx = n => Math.max(0, Math.min(DROLL.length - 1, n - 4));
const dLift = n => (Math.max(0.2, DHUB[1] + DLIFT[dIx(n)] / 1.85) - DHUB[1]) * 1.85;   /* the hub's rise, metres, as the game has it */
/* the body for the roll: lifted with the hub (the hips and both feet), tucked through the turn */
const lifted = (P, dy) => { const r = clone(P); r.hips = Object.assign({}, r.hips, { m: add((r.hips && r.hips.m) || [0, 0, 0], [0, dy, 0]) });
  for (const s of ['L', 'R']) if (r['f' + s]) r['f' + s].a = add(r['f' + s].a, [0, dy, 0]); return r; };
const DBODY = n => n <= 6 ? OPEN({ hips: { m: [0, -0.02, 0.04], r: [26, -10, 0] }, chest: [20, -6, 0], head: [-20, 14, 0],
    fL: foot([0.13, 0.12, 0.2], [-10, -8, 0], 0), fR: foot([-0.15, 0.2, -0.22], [40, -22, 0], 0) })
  : n >= 26 ? OPEN({ fL: foot([0.13, 0.16, 0.16], [-20, -8, 0], 0), fR: foot([-0.15, 0.2, -0.04], [-10, -22, 0], 0) }) : TUCK();
const DC = n => add(hubM(DHUB), [0, dLift(n), 0]);
const dBlade = n => { const th = (((60 - DROLL[dIx(n)]) % 360) + 360) % 360, h = [DHUB[0], DHUB[1] + dLift(n) / 1.85, DHUB[2]];
  const u = [Math.cos(th * Math.PI / 180), Math.sin(th * Math.PI / 180)], L = 0.92 * 0.27 * 1.15, w = [h[0] + u[0] * h[2], h[1] + u[1] * h[2]];
  return aim([{ in: [w[0] * U, w[1] * U], x: (w[0] + u[0] * L) * U, y: (w[1] + u[1] * L) * U, r: 0.14 * 0.27 * 1.35 * U, pa: th }], 'ring', n, -0.18, {}, false); };
clip('Slipstitch', [at(0, G({ hips: { m: [0, -0.12, 0.04], r: [18, -12, 0] } })),
  at(2, twitch(LOW({ hips: { m: [0, -0.24, 0.08], r: [24, -14, 0] }, armR: dagger([-0.24, 0.66, 0.1], [0, 0.2, 1]) })), { in: 'out' }),
  ...Array.from({ length: 25 }, (_, i) => i + 4).map(n => { const p = spin(lifted(DBODY(n), dLift(n)), pitch(DROLL[dIx(n)]), DC(n)); p.armR = n >= 6 ? cap('dash', n, -0.18) : dBlade(n); return at(n, p); }),
  at(31, LOW({ hips: { m: [0, -0.22, 0.06], r: [20, -16, 0] }, armR: dagger([-0.2, 0.9, 0.3], [0, 0.6, 0.8]) }), { in: 'out' }),
  at(36, G(), { in: 'out' })]);

/* ---- grabs: the left hand hooks out past the buckler (0.87 of the usual reach) ---- */
const grabClip = (name, mv, f0, step) => { const g = MV[mv].h[0], reach = [0.08, g.y / MPU, depth(0.08, g.x / MPU) + 0.02];
  const out = G({ hips: { m: [0, -0.12, 0.04 + step], r: [8, -34, 0] }, chest: [8, -22, 0], head: [-10, 44, 0], fL: plant('L', 0.13, 0.26 + step * 1.2, -12), fR: plant('R', -0.17, -0.15, -48, 22),
    armL: buckler(reach, [0.9, 0.3, 0.3], { loose: 1 }), curlL: 20, armR: dagger([-0.28, 0.92, -0.1], [0, 0.85, 0.5]) });
  clip(name, strike(name === 'GrabPivot' ? G({ hips: { m: [0, -0.1, 0], r: [6, 160, 0] }, chest: [6, 10, 0], head: [-6, 0, 0] }) : G(), [
    at(f0 - 3, mod(out, { armL: buckler(add(reach, [0, 0.04, -0.2]), [0.6, 0.3, 0.7], { loose: 1 }), curlL: 10, hips: { m: [0, -0.11, 0.02 + step * 0.6] } }), { in: 'out' }),
    at(f0, out, { in: 'snap' }), at(f0 + 2, mod(out, { curlL: 80 })), at(f0 + 10, mod(out, { curlL: 80, armL: buckler(add(reach, [0, 0, -0.08]), [0.9, 0.3, 0.3], { loose: 1 }) }), { in: 'hold' }),
    at(MV[mv].t, G(), { in: 'out' })])); };
grabClip('Grab', 'grab', 6, 0); grabClip('GrabDash', 'dgrab', 9, 0.1); grabClip('GrabPivot', 'pgrab', 10, 0.04);

/* ---- get-ups and the ledge attack ---- */
/* Floor Tick (get-up attack): from his back, up to a crouch: a cut along the floor ahead (19-20), then behind (24-25) */
const GU = (yaw, o) => LOW(Object.assign({ hips: { m: [0, -0.33, 0], r: [22, yaw * 0.45, 0] }, chest: [20, yaw * 0.55, 0], head: [-26, -yaw * 0.3, 0],
  fL: plant('L', 0.2, 0.22, -14), fR: plant('R', -0.22, -0.2, -50, 40), armL: buckler([0.18, 0.66, 0.16], [-0.3, 0.5, 1]) }, o));
clip('FloorTick', [at(0, FLAT), at(8, mod(FLAT, { all: { r: [-40, 0, 0], m: [0, 0.16, 0.12] }, armR: dagger([-0.34, 0.6, 0.16], [0, -0.3, 1]) }), { in: 'out' }),
  at(15, GU(-20, { armR: dagger([-0.3, 0.5, 0.0], [0, 0.0, 1]) })),
  at(19, GU(16, { armR: cap('getup', 19, -0.22) }), { in: 'snap' }), at(20, GU(18, { armR: cap('getup', 20, -0.22) })),
  at(22, GU(80, { armR: dagger([-0.34, 0.44, -0.1], [0, -0.1, -1]) }), { in: 'out' }),
  at(24, GU(150, { armR: cap('getup', 24, 0.05) }), { in: 'snap' }), at(25, GU(152, { armR: cap('getup', 25, 0.05) })),
  at(31, GU(120, { armR: dagger([-0.3, 0.5, -0.3], [0, 0.2, -1]) }), { in: 'out' }), at(36, GU(60, {}), { in: 'hold' }), at(47, G(), { in: 'out' })]);
/* Lip Cut (ledge attack): up over the edge low, a flat cut along the floor (20-22) */
clip('LipCut', [at(0, mod(KNEEL, { hips: { m: [0, -0.36, -0.1] }, armR: dagger([-0.3, 0.5, 0.1], [0, -0.6, 0.8]) })), at(12, CROUCH),
  at(17, LOW({ hips: { m: [0, -0.26, -0.04], r: [18, -30, 0] }, armR: dagger([-0.3, 0.6, 0.0], [0, 0.0, 1]), eyes: 1.25 }), { in: 'out' }),
  ...[20, 21, 22].map(f => at(f, lunge(0.16, 0.2, 26, { armR: cap('ledgeatk', f, -0.16), chest: [18, 16, 0] }), f === 20 ? { in: 'snap' } : {})),
  at(28, lunge(0.14, 0.18, 22, { armR: dagger([-0.16, 0.66, 0.42], [0, 0.1, 1]) }), { in: 'out' }), at(46, G(), { in: 'out' })]);

/* ---- specials ---- */
/* Needlewheel: the buckler's rim spun across in front while the dagger ticks round three clock positions, the wrist set at its
   line (low, level or high) */
const nw = (mv, name, line) => { const base = NA, y = { L: 0.74, M: 0.96, H: 1.12 }[line];
  const B0 = o => G(Object.assign({ hips: { m: [0, -0.1 - (line === 'L' ? 0.1 : 0), 0.06], r: [8, 20, 0] }, chest: [6, 14, 0], head: [-10, -10, 0], fR: plant('R', -0.17, -0.12, -40, 20) }, o));
  const rim = k => buckler([0.08, y + 0.1 - k * 0.06, 0.3], [Math.sin(k * 1.4) * 0.5, Math.cos(k * 1.4) * 0.4, 1]);
  clip(name, [at(0, G()), at(3, twitch(G({ armR: dagger([-0.24, 0.9, 0.0], [0, 0.3, 1]) }))),
    at(6, B0({ armL: rim(0), armR: dagger([-0.1, y - 0.04, 0.26], [0, -0.4, 1]) }), { in: 'out' }),
    ...[9, 10, 11].map(f => at(f, B0({ armL: rim(1), armR: cap(mv, f, -0.1) }), f === 9 ? { in: 'snap' } : { in: 'hold' })),
    at(13, B0({ armL: rim(1.5), armR: cap(mv, 11, -0.1) }), { in: 'hold' }),
    ...[16, 17, 18].map(f => at(f, B0({ armL: rim(2), armR: cap(mv, f, -0.1) }), f === 16 ? { in: 'snap' } : { in: 'hold' })),
    at(20, B0({ armL: rim(2.5), armR: cap(mv, 18, -0.1) }), { in: 'hold' }),
    ...[23, 24, 25].map(f => at(f, B0({ armL: rim(3), armR: cap(mv, f, -0.1), eyes: f === 23 ? 1.3 : 1.15 }), f === 23 ? { in: 'snap' } : { in: 'hold' })),
    at(30, B0({ armL: rim(3.2), armR: cap(mv, 25, -0.1) }), { in: 'out' }), at(43, G(), { in: 'out' })]); };
nw('nspec', 'Needlewheel', 'M'); nw('nspecL', 'NeedlewheelLow', 'L'); nw('nspecH', 'NeedlewheelHigh', 'H');
/* Rimskip: F5 the buckler planted on the floor ahead, F10-12 the vault over it, the dagger dragged through (12-15), F15 the
   snap, F20 down, F25 the skid */
clip('Rimskip', [at(0, G()), at(2, twitch(G())),
  at(5, LOW({ hips: { m: [0, -0.24, 0.1], r: [26, -20, 0] }, chest: [26, -10, 0], head: [-30, 24, 0], armL: buckler([0.12, 0.28, 0.6], [0, 0.4, 1], { loose: 1 }), armR: dagger([-0.28, 0.66, -0.04], [0, 0.2, 1]) }), { in: 'out' }),
  at(9, LOW({ hips: { m: [0, -0.28, 0.16], r: [30, -16, 0] }, chest: [30, -8, 0], armL: buckler([0.12, 0.3, 0.56], [0, 0.4, 1], { loose: 1 }), armR: dagger([-0.28, 0.62, -0.06], [0, 0.2, 1]) })),
  at(12, A_({ hips: { m: [0, 0.16, 0.06], r: [26, 10, 0] }, chest: [16, 14, 0], head: [-26, -10, 0], fL: foot([0.13, 0.5, 0.06], [-40, -10, 0], 0), fR: foot([-0.15, 0.46, -0.06], [-30, -20, 0], 0),
    armL: buckler([0.16, 0.78, 0.16], [-0.4, -0.4, 1], { loose: 1 }), armR: cap('sspec', 12, -0.14) }), { in: 'snap' }),
  ...[13, 14, 15].map(f => at(f, A_({ hips: { m: [0, 0.16 - (f - 12) * 0.03, 0.06], r: [24 - (f - 12) * 4, 12, 0] }, chest: [14, 16, 0], head: [-24, -10, 0], fL: foot([0.13, 0.46, 0.08], [-36, -10, 0], 0), fR: foot([-0.15, 0.42, -0.04], [-26, -20, 0], 0),
    armL: buckler([0.16, 0.8, 0.14], [-0.4, -0.3, 1], { loose: 1 }), armR: cap('sspec', f, -0.14), eyes: 1.2 }))),
  at(20, LOW({ hips: { m: [0, -0.3, 0.06], r: [24, -10, 0] }, fL: plant('L', 0.15, 0.3, -14), fR: plant('R', -0.2, -0.24, -50, 40), armR: dagger([-0.24, 0.6, 0.4], [0, -0.2, 1]) }), { in: 'out' }),
  at(25, LOW({ hips: { m: [0, -0.28, -0.04], r: [10, -16, 0] }, fL: plant('L', 0.15, 0.44, -14, -10), fR: plant('R', -0.2, -0.16, -50, 30), armR: dagger([-0.26, 0.6, 0.3], [0, 0.0, 1]) })),
  at(39, G(), { in: 'out' })]);
/* off a wall (Rimskip's rebound): the buckler punched against it, sprung away up */
clip('RimskipWall', [at(0, A_({ hips: { m: [0, 0.1, 0], r: [26, -8, 0] }, fL: foot([0.13, 0.46, 0.24], [-60, 0, 0], 0), fR: foot([-0.15, 0.4, 0.2], [-50, -10, 0], 0), armL: buckler([0.12, 1.0, 0.34], [0, 0.1, 1]), eyes: 1.3 })),
  at(6, A_({ hips: { m: [0, 0.02, -0.04], r: [-10, -10, 0] }, fL: foot([0.13, 0.12, 0.18], [30, 0, 0], 0), fR: foot([-0.15, 0.1, 0.1], [36, -20, 0], 0), armL: buckler([0.16, 1.16, 0.08], [-0.3, 0.6, 1]) }), { in: 'snap' }),
  at(18, A_(), { in: 'out' })]);
/* stopped by a shield (Rimskip blocked): knocked back off it, rocking on his heels */
clip('RimskipBlocked', [at(0, A_({ armR: cap('sspec', 15, -0.14) })), at(5, G({ hips: { m: [0, -0.12, -0.12], r: [-14, -20, 0] }, chest: [-14, -10, 0], head: [-6, 30, 0], fL: plant('L', 0.13, 0.3, -12, -16), fR: plant('R', -0.17, -0.28, -48),
  armL: buckler([0.22, 1.06, 0.06], [-0.1, 0.5, 1], { loose: 1 }), armR: dagger([-0.36, 1.0, -0.2], [0, 0.6, -0.8]), eyes: 0.8 }), { in: 'out' }),
  at(12, G({ hips: { m: [0, -0.12, -0.06], r: [-6, -20, 0] }, chest: [-6, -8, 0] })), at(20, G({ hips: { m: [0, -0.1, 0] } }), { in: 'out' })]);
/* Turnkey Ascent: the blade driven up into a gear's arc round the buckler, the lever thrown in two beats (7-10, 14-16) */
const TK = (k, o) => A_(Object.assign({ hips: { m: [0, 0.08 + k * 0.04, 0.02], r: [-6 - k * 4, -6, 0] }, chest: [-10 - k * 4, 4, 0], head: [-30, 8, 0],
  fL: foot([0.12, 0.14, 0.04], [30, -6, 0], 0), fR: foot([-0.14, 0.18, -0.06], [36, -20, 0], 0), armL: buckler([0.16, 1.26 + k * 0.06, 0.24], [-0.2, 0.6, 0.8]) }, o));
clip('Turnkey', [at(0, G()), at(2, twitch(LOW({ armR: dagger([-0.26, 0.6, 0.0], [0, 0.3, 1]) }))),
  at(5, LOW({ hips: { m: [0, -0.3, 0], r: [24, -14, 0] }, armL: buckler([0.12, 0.84, 0.3], [-0.1, 0.6, 1]), armR: dagger([-0.24, 0.62, 0.1], [0, 0.6, 0.8]), eyes: 1.3 }), { in: 'out' }),
  ...[7, 8, 9, 10].map(f => at(f, TK(0, { armR: cap('uspec', f, -0.08) }), f === 7 ? { in: 'snap' } : {})),
  at(12, TK(0.5, { armR: dagger([-0.14, 1.3, 0.14], [0, 0.6, 0.8]) }), { in: 'out' }),
  ...[14, 15, 16].map(f => at(f, TK(1, { armR: cap('uspec', f, -0.06) }), f === 14 ? { in: 'snap' } : {})),
  at(21, TK(1, { armR: dagger([-0.1, 1.62, 0.1], [0, 1, 0.1]) }), { in: 'out' }), at(33, HELP, { in: 'out' })]);
/* Deadbolt: F1 the buckler's rim set, F5 the catch held narrow and square to the front through 14, then let go */
const DB = o => G(Object.assign({ hips: { m: [0, -0.16, -0.03], r: [10, -30, 0] }, chest: [10, -16, 0], head: [-18, 40, 0], fL: plant('L', 0.15, 0.24, -16), fR: plant('R', -0.18, -0.18, -56, 20),
  armL: buckler([0.04, 1.06, 0.3], [0, 0.05, 1]), armR: dagger([-0.18, 1.06, -0.1], [0, 0.6, -0.8]) }, o));
clip('Deadbolt', [at(0, G()), at(1, twitch(G({ armL: buckler([0.13, 0.97, 0.12], [-0.6, 0.12, 1]) }))),
  at(5, DB({ eyes: 1.3 }), { in: 'snap' }), at(9, DB({ eyes: 1.15, armL: buckler([0.04, 1.065, 0.305], [0, 0.06, 1]) })), at(14, DB({ eyes: 1.2 })),
  at(18, DB({ hips: { m: [0, -0.13, -0.02] } }), { in: 'hold' }), at(42, G(), { in: 'out' })]);
/* the riposte: out from behind the catch, the dagger round the attack, +120 hooking down to +30 (frames 6-8) */
clip('Riposte', [at(0, DB({ eyes: 1.3 })), at(3, DB({ armR: dagger([-0.14, 1.34, -0.14], [0, 0.6, -0.8]), eyes: 1.4 }), { in: 'out' }),
  at(6, lunge(0.08, 0.06, 18, { armR: cap('dspecR', 6, -0.06), armL: buckler([0.08, 1.04, 0.26], [-0.2, 0.05, 1]) }), { in: 'snap' }),
  at(7, lunge(0.12, 0.07, 24, { armR: cap('dspecR', 7, -0.08), armL: buckler([0.12, 1.0, 0.22], [-0.4, 0.05, 1]) })),
  at(8, lunge(0.16, 0.08, 28, { armR: cap('dspecR', 8, -0.1) })),
  at(13, lunge(0.14, 0.08, 24, { armR: dagger([-0.16, 0.92, 0.42], [0, -0.3, 1]) }), { in: 'out' }), at(17, lunge(0.13, 0.08, 22, { armR: dagger([-0.16, 0.92, 0.4], [0, -0.3, 1]) }), { in: 'hold' }),
  at(32, G(), { in: 'out' })]);
/* Hinge Cancel: F1 the buckler's rim set to pivot on, F3 the move (the game carries him), F5 ready, F7 at rest */
clip('Hinge', [at(0, G({ hips: { m: [0, -0.1, 0.06] } })), at(1, G({ hips: { m: [0, -0.13, 0], r: [10, -36, 0] }, chest: [8, -20, 0], armL: buckler([0.06, 1.0, 0.1], [-0.9, 0.1, 0.4]), eyes: 1.4 }), { in: 'snap' }),
  at(3, LOW({ hips: { m: [0, -0.18, 0], r: [16, 10, 0] }, chest: [10, 14, 0], head: [-16, -4, 0], armL: buckler([0.18, 0.96, 0.08], [-0.4, 0.2, 1]), armR: dagger([-0.2, 0.9, 0.18], [0, 0.3, 1]) }), { in: 'out' }),
  at(5, G({ armR: dagger([-0.2, 0.9, 0.16], [0, 0.35, 1]), eyes: 1.2 }), { in: 'out' }), at(7, G())]);

/* ---- the clips that go in: names checked ---- */
const SPRING = [{ bones: ['crest', 'crestTip'], k: 0.22, d: 0.72, max: 0.35, drag: 0.1 }, { bones: ['crestBack'], k: 0.25, d: 0.7, max: 0.3, drag: 0.1 }];
function build() {
  const clips = {}, expect = [], report = [];
  const PTS = ['sword', 'swordTip', 'shield', 'handR', 'handL', 'footL', 'footR', 'head', 'toeL', 'toeR'];
  for (const [name, list] of Object.entries(CLIPS)) {
    const keys = [];
    for (const k of list) {
      const r = solveKey(k.p);
      if (r.notes.length) report.push(name + ' @' + k.f + ': ' + r.notes.join(', '));
      const key = { t: fr(k.f), pose: r.keys };
      if (k.in) key.in = k.in;
      keys.push(key);
      const pts = {}; for (const n of PTS) pts[n] = r.F.P[n].map(v => Math.round(v * 1e4) / 1e4);
      expect.push({ clip: name, f: k.f, pts });
    }
    clips[name] = { fps: 60, keys };
  }
  return { clips, expect, report };
}
/* a pose solved, with two helps: the buckler hand moved until its centre sits where asked (c), and when the dagger cannot
   reach, the hips carried toward it (up to 0.3 m, the feet staying where they stand) */
function solveKey(P0) {
  let P = clone(P0), r = S.solve(P, { bladeScale: BS }), shift = [0, 0, 0];
  for (let i = 0; i < 6; i++) {
    let again = false;
    if (P.armL && P.armL.c) { const d = sub(P.armL.c, r.F.P.shield); if (len(d) > 0.004) { P.armL.w = add(P.armL.w, d); again = true; } }
    const side = r.arms.R && r.arms.R.miss > 0.003 ? 'R' : r.arms.L && r.arms.L.miss > 0.008 ? 'L' : null;
    if (side && len(shift) < 0.3) {
      const W = r.arms[side].W, Sh = r.F.P['arm' + side], u = unit(sub(W, Sh)), m = sc(u, r.arms[side].miss * 1.05);
      shift = add(shift, m); P.hips = Object.assign({}, P.hips, { m: add((P.hips && P.hips.m) || [0, 0, 0], m) }); again = true;
    }
    if (!again) break;
    r = S.solve(P, { bladeScale: BS });
  }
  if (len(shift) > 0.01) r.notes.push('hips carried ' + shift.map(v => v.toFixed(2)).join(','));
  /* the root's own turn (lying down, tumbling): a turn of everything about the floor under him */
  if (P.all) { r.keys.all = { qb: qbOf(eul(P.all.r)), move: P.all.m || [0, 0, 0] };
    const q = eul(P.all.r), m = P.all.m || [0, 0, 0]; for (const n of Object.keys(r.F.P)) r.F.P[n] = add(qrot(q, r.F.P[n]), m); }
  else r.keys.all = { qb: [1, 0, 0, 0] };
  return r;
}
const qbOf = q => { const v = q[0] < 0 ? q.map(x => -x) : q; return [v[0], v[1], -v[3], v[2]].map(x => Math.round(x * 1e6) / 1e6); };

if (require.main === module) {
  const { clips, expect, report } = build();
  const spec = Object.assign({}, K.spec, { clips });
  delete spec.poses;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'rig.json'), JSON.stringify(spec));
  fs.writeFileSync(path.join(OUT, 'pack.json'), JSON.stringify({ base: 'work/knell-rigged.glb', texture: 1024, out: 'export/knell-v1.glb' }, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'contacts.json'), JSON.stringify(CONTACTS) + '\n');
  fs.writeFileSync(path.join(OUT, 'expect.json'), JSON.stringify(expect) + '\n');
  if (report.length) console.log('notes:\n  ' + report.join('\n  '));
  console.log('knell: ' + Object.keys(clips).length + ' clips, ' + expect.length + ' keys, ' + CONTACTS.length + ' blade contacts');
  writeManifest();
}

/* ---- the game's manifest entry ---- */
function writeManifest() {
  const span = (c, end) => ({ clip: c, from: 0, to: end });
  const AF = (clip, mv, extra) => { const m = MV[mv], hs = m.h.filter(h => !h.nb || true);
    const a0 = hs.length ? Math.min(...hs.map(h => h.f0)) : 0, a1 = hs.length ? Math.max(...hs.map(h => h.f1)) : -1;
    return Object.assign({ clip, start: 0, contact: [fr(a0), fr(a1 + 1)], end: fr(m.t) }, extra || {}); };
  const end = n => fr(CLIPS[n][CLIPS[n].length - 1].f);
  const entry = { file: 'assets/knell/export/knell-v1.glb', height: +(1.835 * MPU).toFixed(3),
    blendIn: { Idle: 6, Walk: 5, Run: 4 },
    clips: { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: { clip: 'Walk', stride: +(WALK_STRIDE * MPU).toFixed(2) }, run: { clip: 'Run', stride: +(RUN_STRIDE * MPU).toFixed(2) },
      crouch: { clip: 'Crouch', at: fr(11) }, brake: span('Brake', fr(12)), jumpsquat: span('Squat', fr(6)), rise: span('Rise', fr(24)), fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' },
      airjump: span('AirJump', fr(50)), helpless: { clip: 'Helpless' }, land: span('Land', fr(24)), landHard: span('LandHard', fr(48)),
      shield: span('Shield', fr(7)), shieldHit: span('ShieldHit', fr(18)), hit: span('Hit', fr(36)), hitHeavy: span('HitHeavy', fr(48)), hitBack: span('HitBack', fr(36)), hitHeavyBack: span('HitHeavyBack', fr(48)),
      launch: span('Launch', fr(30)), launchUp: span('LaunchUp', fr(40)), spike: span('Spike', fr(40)), tumble: { clip: 'Tumble', bounce: true }, down: span('Down', fr(18)),
      dizzy: { clip: 'Hit', from: fr(4), to: fr(14), bounce: true }, airdodge: span('AirDodge', fr(40)), dodge: span('Dodge', fr(22)), roll: span('Roll', fr(28)),
      ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, pummel: span('Pummel', fr(14)), respawn: { clip: 'Respawn' },
      throw: span('ThrowF', fr(26)), throw_f: span('ThrowF', fr(26)), throw_b: span('ThrowB', fr(26)), throw_u: span('ThrowU', fr(26)), throw_d: span('ThrowD', fr(26)), swap: { clip: 'Tumble', bounce: true } },
    /* the dagger's arc and its point while a cut is out (render3d bladeArc), from a fifth of the way up the blade */
    blade: { base: 'sword', tip: 'swordTip', at: 0.2, dot: 0.6, col: 0xffc46a, col2: 0xff7a2a },
    strikers: [{ bone: 'swordTip', ext: 0.4 }, { bone: 'shield', ext: 2.2 }, { bone: 'handL', ext: 1.0 }, { bone: 'handR', ext: 1.0 }, { bone: 'footR', ext: 1.4 }],
    springs: SPRING,
    attacks: { jab: AF('Jab', 'jab'), jab2: AF('Cut2', 'jab2'), jab3: AF('Cut3', 'jab3'),
      ftilt: AF('Dial', 'ftilt'), ftiltL: AF('DialLow', 'ftiltL'), ftiltH: AF('DialHigh', 'ftiltH'), utilt: AF('Keyturn', 'utilt'), dtilt: AF('AnkleTick', 'dtilt'), dash: AF('Slipstitch', 'dash'),
      fsmash: AF('Guillotine', 'fsmash'), usmash: AF('Clockstrike', 'usmash'), dsmash: AF('SplitSeconds', 'dsmash'),
      nair: AF('Pendulum', 'nair'), fair: AF('Fang', 'fair'), fairL: AF('FangLow', 'fairL'), fairH: AF('FangHigh', 'fairH'), bair: AF('Backhand', 'bair'), uair: AF('BellNeedle', 'uair'), dair: AF('Deadfall', 'dair'),
      grab: AF('Grab', 'grab'), dgrab: AF('GrabDash', 'dgrab'), pgrab: AF('GrabPivot', 'pgrab'),
      getup: AF('FloorTick', 'getup'), getupB: AF('FloorTick', 'getupB', { flip: true }), ledgeatk: AF('LipCut', 'ledgeatk'),
      nspec: AF('Needlewheel', 'nspec'), nspecL: AF('NeedlewheelLow', 'nspecL'), nspecH: AF('NeedlewheelHigh', 'nspecH'),
      sspec: AF('Rimskip', 'sspec'), sspecW: { clip: 'RimskipWall', start: 0, contact: [0, 0], end: end('RimskipWall') }, sspecB: { clip: 'RimskipBlocked', start: 0, contact: [0, 0], end: end('RimskipBlocked') },
      uspec: AF('Turnkey', 'uspec'), dspec: { clip: 'Deadbolt', start: 0, contact: [0, 0], end: fr(42) }, dspecR: AF('Riposte', 'dspecR'),
      hinge: { clip: 'Hinge', start: 0, contact: [0, 0], end: fr(7) }, hingeS: { clip: 'Hinge', start: 0, contact: [0, 0], end: fr(7) },
      '*': AF('Cut2', 'jab2') } };
  const mf = path.join(ROOT, 'assets', 'manifest.json'), cur = JSON.parse(fs.readFileSync(mf, 'utf8'));
  cur.Knell = entry; fs.writeFileSync(mf, JSON.stringify(cur, null, 1) + '\n');
  console.log('manifest: Knell (' + Object.keys(entry.attacks).length + ' attacks, ' + Object.keys(entry.clips).length + ' states)');
}
module.exports = { build, CLIPS, CONTACTS, BS };
