// Writes the skeleton and animation spec for Vargan the Ashbound (assets/vargan/work/rig.json), which tools/blender/rig.py
// turns into a rigged, animated model, and adds his entry to the game's manifest.
//   node tools/blender/vargan.js
//   bash tools/blender/build-vargan.sh [shots.json outdir]
// The owner's two Meshy sculpts (Drive folder Ironhide): the body in an A-pose with open hands, and Runebreaker, the axe,
// a separate model. tools/blender/vargan-prep.py reduces them, tools/blender/vargan-join.py puts the axe through his
// right fist for the bind pose (haft straight ahead, edge down), and rig.py makes the axe rigid on its own bone.
// Directions: x is his left, y is up, z is forward; metres, feet on y = 0. Hands and feet follow targets (c_hand*, c_foot*)
// that hang from the root: a pose says where a wrist or an ankle is in the model's space and the elbow or knee works itself
// out. The axe is aimed directly (c_axe): a pose says which way the haft points and which way the edge faces.
// In the game he is seen from his right side (the axe hand is nearer the camera): z runs across the screen, y up it.
// Motion follows the owner's "Nordic Berserker" atlas (its six-beat descriptions of every move); poses are original. The
// axe strikes' shapes come from the game itself (sim.js, the "ax" of each axe hit): on those frames the drawn axe is where
// the hit is.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'assets', 'vargan', 'work');
/* ---- the game's own numbers: load sim.js as the tests do and take Vargan's moves ---- */
const MV = (() => {
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
  const g = { document: { getElementById: () => ({ getContext: () => ctx }) }, addEventListener() {}, requestAnimationFrame() {}, navigator: { getGamepads: () => [] }, localStorage: { getItem: () => null, setItem() {} }, console, Math, performance: { now: () => 0 } };
  g.window = g; vm.createContext(g);
  for (const f of ['hitboxes.js', 'sim.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), g, { filename: f });
  return vm.runInContext('ROSTER.find(d => d.name === "Vargan").forms[0].moves', g);
})();
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] });
const add = (a, b, k) => a.map((v, i) => v + b[i] * (k === undefined ? 1 : k)), sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(...a), unit = a => { const l = len(a) || 1; return a.map(v => v / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mir = p => [-p[0], p[1], p[2]];
const HMOD = 1.902;   /* his height in the model, metres: one H in the game */
const fr = n => n / 60;
const cat = (...a) => Object.assign({}, ...a);

/* ---- the skeleton: joint places read off gridded views and the hands' own vertices ---- */
const J = {
  pelvis: [0, 0.93, 0.0], waist: [0, 1.1, 0.0], ribs: [0, 1.32, -0.01], neck: [0, 1.6, 0.0], top: [0, 1.92, 0.03],
  sho: [-0.25, 1.5, -0.01], elb: [-0.47, 1.28, -0.01], wri: [-0.715, 1.06, 0.1],
  knu: [-0.775, 0.95, 0.14], mid: [-0.79, 0.88, 0.145], tip: [-0.79, 0.815, 0.13], thb: [-0.715, 1.02, 0.17], tht: [-0.718, 1.0, 0.3],
  hip: [-0.13, 0.9, 0.0], knee: [-0.2, 0.52, 0.06], ankle: [-0.27, 0.12, 0.04], toe: [-0.29, 0.03, 0.22] };
/* the axe in the bind pose: through the right fist (G), haft straight ahead, edge down; held 0.22 m up from the pommel */
const G = [-0.74, 0.915, 0.14], HOLD = 0.22, H0 = [0, 0, 1], E0 = [0, -1, 0];
const AXHEAD = add(G, H0, 1.0), AXTIP = add(add(G, H0, 1.13), E0, 0.33);   /* where the blade starts on the haft, and the middle of its edge */
const side = (s, k) => { const P = p => k ? mir(p) : p; return [
  { name: 'arm' + s, head: P(J.sho), tail: P(J.elb), parent: 'chest' },
  { name: 'fore' + s, head: P(J.elb), tail: P(J.wri), parent: 'arm' + s, connect: true },
  { name: 'hand' + s, head: P(J.wri), tail: P(J.knu), parent: 'fore' + s, connect: true },
  { name: 'fing' + s + '1', head: P(J.knu), tail: P(J.mid), parent: 'hand' + s, connect: true },
  { name: 'fing' + s + '2', head: P(J.mid), tail: P(J.tip), parent: 'fing' + s + '1', connect: true },
  { name: 'thumb' + s, head: P(J.thb), tail: P(J.tht), parent: 'hand' + s },
  { name: 'c_hand' + s, head: P(J.wri), tail: add(P(J.wri), [0, 0, 0.12]), parent: 'all', deform: false },
  { name: 'thigh' + s, head: P(J.hip), tail: P(J.knee), parent: 'hips' },
  { name: 'shin' + s, head: P(J.knee), tail: P(J.ankle), parent: 'thigh' + s, connect: true },
  { name: 'foot' + s, head: P(J.ankle), tail: P(J.toe), parent: 'shin' + s },
  { name: 'c_foot' + s, head: P(J.ankle), tail: add(P(J.ankle), [0, 0, 0.12]), parent: 'all', deform: false }]; };
const spec = {
  note: 'Vargan the Ashbound: metres, feet on y = 0, facing +Z, his right is -X. Joint positions measured from the owner\'s A-pose sculpt.',
  prep: { yaw: 0, translate: [0, 0, 0] },
  parts: [{ object: 'Axe', bone: 'axe' }],
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'hips', head: J.pelvis, tail: J.waist, parent: 'all' },
    { name: 'spine', head: J.waist, tail: J.ribs, parent: 'hips', connect: true },
    { name: 'chest', head: J.ribs, tail: J.neck, parent: 'spine', connect: true },
    { name: 'head', head: J.neck, tail: J.top, parent: 'chest' },
    ...side('R', 0), ...side('L', 1),
    { name: 'axe', head: G, tail: add(G, H0, 0.3), parent: 'handR' },
    { name: 'axeHead', head: AXHEAD, tail: add(AXHEAD, H0, 0.05), parent: 'axe' },   /* for the blade's arc in the game (render3d bladeArc) */
    { name: 'axeTip', head: AXTIP, tail: add(AXTIP, H0, 0.05), parent: 'axe' },
    { name: 'c_axe', head: G, tail: add(G, H0, 0.3), parent: 'all', deform: false }],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
  copyrot: [{ bone: 'axe', from: 'c_axe' }],
  rigid: [{ bone: 'head', box: [[-0.15, 1.62, -0.17], [0.15, 1.96, 0.22]] }, { bone: 'axe', part: 'Axe', only: true }],
  poses: {}, clips: {} };

/* ---- targets: absolute places in the model, as moves from where each control rests ---- */
const HR = (z, y, x) => M((x === undefined ? -0.34 : x) - J.wri[0], y - J.wri[1], z - J.wri[2]);
const HL = (z, y, x) => M((x === undefined ? 0.34 : x) + J.wri[0], y - J.wri[1], z - J.wri[2]);
const FR = (z, y, x) => M((x === undefined ? -0.19 : x) - J.ankle[0], y || 0, z - J.ankle[2]);
const FL = (z, y, x) => M((x === undefined ? 0.19 : x) + J.ankle[0], y || 0, z - J.ankle[2]);
/* The axe: haft direction d and edge e (model space) as an aim and a twist. rig.py turns the bind direction to d the short
   way round, then twists about d; the twist is worked out so the bind edge (down) lands on e. */
function AIMT(d, e) {
  d = unit(d); if (dot(d, H0) < -0.995) d = unit(add(d, [0, 0.06, 0]));
  const ax = cross(H0, d), s = len(ax), c = dot(H0, d); let e1 = E0;
  if (s > 1e-6) { const k = unit(ax), ang = Math.atan2(s, c); e1 = add(add(E0.map(v => v * Math.cos(ang)), cross(k, E0).map(v => v * Math.sin(ang))), k.map(v => v * dot(k, E0) * (1 - Math.cos(ang)))); }
  const ew = unit(sub(e, d.map(v => v * dot(e, d)))), tw = Math.atan2(dot(cross(e1, ew), d), dot(e1, ew)) * 180 / Math.PI;
  return { aim: d, twist: +tw.toFixed(2) };
}
/* where the right (or left) wrist goes so that the fist's middle is at P: back along the line from the shoulder */
const SHO = s => s ? mir(J.sho) : J.sho;
function wrist(P, s, hip) { const S = add(SHO(s), hip || [0, 0, 0]), u = unit(sub(P, S)); return add(P, u, -0.14); }
/* Hold the axe: fist at P (absolute), haft at ang degrees in the picture's plane (0 ahead, 90 up), edge es (1 to the haft's
   left, -1 right, 0 across the picture toward his left), or e given. two: the left fist on the haft too, 0.3 m further up.
   hip: the hips' move this pose (the shoulders go with it). */
function axe(P, ang, es, o) {
  o = o || {}; const a = ang * Math.PI / 180, d = [o.dx || 0, Math.sin(a), Math.cos(a)];
  const e = o.e || (es ? [0, Math.cos(a) * es, -Math.sin(a) * es] : [1, 0, 0]);
  const w = wrist(P, 0, o.hip), out = { c_axe: AIMT(d, e), c_handR: HR(w[2], w[1], w[0]) };
  if (o.two) { const P2 = add(P, unit(d), 0.3), w2 = wrist([P2[0] + 0.12, P2[1], P2[2]], 1, o.hip); out.c_handL = HL(w2[2], w2[1], w2[0]); }
  return out;
}
/* an axe hit from the game: its grip (H, from his feet) and angle, at depth x */
const AXHIT = (move, i, x, o) => { const h = MV[move].h[i], [gx, gy, ang, es] = h.ax; return axe([x === undefined ? -0.28 : x, gy * HMOD, gx * HMOD], ang, es, o); };
const HIP = (x, y, z) => ({ hips: M(x, y, z) });

/* ---- poses ---- */
const P = spec.poses, C = spec.clips;
/* the carry: the axe upright at his right side, head above his shoulder, edge forward (the owner's concept picture) */
const CARRY = axe([-0.36, 0.98, 0.16], 84, -1);
P.stand = { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {}, c_axe: {} };
/* the guard: wide and low, left foot leading, the axe's head up in front of his right shoulder, the left fist up */
const GUARD = cat(HIP(0, -0.07, 0), { spine: R(4), chest: R(4, -12), head: R(-4, 10), c_footL: FL(0.2, 0, 0.2), c_footR: FR(-0.16, 0, -0.24), c_handL: HL(0.34, 1.3, 0.12) }, axe([-0.34, 1.0, 0.28], 66, -1, { hip: [0, -0.07, 0] }));
P.guard = GUARD;
P.crouch = cat(HIP(0, -0.36, 0.02), { spine: R(20), chest: R(10, -12), head: R(-18, 10), c_footL: FL(0.2, 0, 0.24), c_footR: FR(-0.16, 0, -0.26), c_handL: HL(0.36, 0.95, 0.14) }, axe([-0.36, 0.66, 0.34], 30, -1, { hip: [0, -0.36, 0.02] }));
P.air = cat(HIP(0, 0.02, 0), { chest: R(2, -8), head: R(-2, 6), c_footL: FL(0.12, 0.2, 0.18), c_footR: FR(-0.08, 0.1, -0.2), c_handL: HL(0.28, 1.25, 0.2) }, axe([-0.38, 1.02, 0.18], 70, -1));
P.tuck = cat(HIP(0, 0.06, 0), { spine: R(26), chest: R(18), head: R(10), c_footL: FL(0.16, 0.36, 0.16), c_footR: FR(0.12, 0.36, -0.16), c_handL: HL(0.3, 1.0, 0.16) }, axe([-0.34, 1.0, 0.3], 30, -1));
const GD = ['stand', 'guard'], AIR = ['stand', 'air'], back = { reset: true, use: GD }, backAir = { reset: true, use: AIR };
const keys = (list, fps) => ({ fps: fps || 60, keys: list });

/* ---- standing, moving ---- */
C.Idle = keys([{ t: 0, use: GD }, { t: 0.8, pose: { hips: M(0, -0.08, 0), chest: R(6, -12), head: R(-2, 8), c_handL: HL(0.34, 1.28, 0.12) } }, { t: 1.6, pose: { hips: M(0, -0.07, 0), chest: R(4, -12), head: R(-4, 12), c_handL: HL(0.34, 1.3, 0.12) } },
  { t: 2.4, pose: { hips: M(0, -0.08, 0), chest: R(6, -12), head: R(-3, 8) } }, { t: 3.2, use: GD }]);   /* heavy breathing in a heavy guard */
/* now and then: the axe rolled up onto his shoulder and back down, a look at the opponent */
C.Idle2 = keys([{ t: 0, use: GD }, { t: 0.5, pose: cat({ chest: R(0, -6), head: R(-6, 4) }, axe([-0.3, 1.38, 0.12], 150, 1)) }, { t: 1.4, pose: cat({ head: R(-10, 20) }, axe([-0.3, 1.36, 0.1], 155, 1)) }, { t: 2.0, pose: { head: R(-4, 4) } }, { t: 2.6, use: GD }]);
{ const st = (a, lean, lift, axeAng) => [
    cat({ hips: M(0, -0.09, 0), chest: R(lean, -10), c_footL: FL(a, 0, 0.19), c_footR: FR(-a, lift * 0.3, -0.19) }, axe([-0.38, 0.98, 0.2], axeAng, -1, { hip: [0, -0.09, 0] })),
    cat({ hips: M(0, -0.05, 0), chest: R(lean, -12), c_footL: FL(0.02, 0, 0.19), c_footR: FR(0, lift, -0.19) }, axe([-0.38, 1.0, 0.2], axeAng + 3, -1, { hip: [0, -0.05, 0] })),
    cat({ hips: M(0, -0.09, 0), chest: R(lean, -14), c_footL: FL(-a, lift * 0.3, 0.19), c_footR: FR(a, 0, -0.19) }, axe([-0.38, 0.98, 0.2], axeAng, -1, { hip: [0, -0.09, 0] })),
    cat({ hips: M(0, -0.05, 0), chest: R(lean, -12), c_footL: FL(0, lift, 0.19), c_footR: FR(0.02, 0, -0.19) }, axe([-0.38, 1.0, 0.2], axeAng + 3, -1, { hip: [0, -0.05, 0] }))];
  const w = st(0.22, 6, 0.1, 70);
  C.Walk = keys([{ t: 0, use: GD, pose: w[0] }, { t: 0.32, pose: w[1] }, { t: 0.64, pose: w[2] }, { t: 0.96, pose: w[3] }, { t: 1.28, pose: w[0] }], 30);
  /* the run: leaning in, the axe trailing low behind him, the left arm pumping */
  const run = (a, lift, arm) => [
    cat({ hips: M(0, -0.12, 0.06), spine: R(10), chest: R(10, -6), head: R(-12, 4), c_footL: FL(a, 0, 0.18), c_footR: FR(-a * 0.9, lift * 0.4, -0.18), c_handL: HL(-arm * 0.5 + 0.18, 1.18, 0.2) }, axe([-0.4, 0.9, -0.12], 200, 1, { hip: [0, -0.12, 0.06] })),
    cat({ hips: M(0, -0.06, 0.06), c_footL: FL(0.02, 0, 0.18), c_footR: FR(0.05, lift, -0.18), c_handL: HL(0.18, 1.2, 0.2) }, axe([-0.4, 0.92, -0.1], 196, 1, { hip: [0, -0.06, 0.06] })),
    cat({ hips: M(0, -0.12, 0.06), c_footL: FL(-a * 0.9, lift * 0.4, 0.18), c_footR: FR(a, 0, -0.18), c_handL: HL(arm * 0.5 + 0.18, 1.18, 0.2) }, axe([-0.4, 0.9, -0.12], 200, 1, { hip: [0, -0.12, 0.06] })),
    cat({ hips: M(0, -0.06, 0.06), c_footL: FL(0.05, lift, 0.18), c_footR: FR(0.02, 0, -0.18), c_handL: HL(0.18, 1.2, 0.2) }, axe([-0.4, 0.92, -0.1], 196, 1, { hip: [0, -0.06, 0.06] }))];
  const r = run(0.42, 0.26, 0.5);
  C.Run = keys([{ t: 0, use: GD, pose: r[0] }, { t: 0.18, pose: r[1] }, { t: 0.36, pose: r[2] }, { t: 0.54, pose: r[3] }, { t: 0.72, pose: r[0] }], 30); }
C.Crouch = keys([{ t: 0, use: GD }, { t: 0.18, use: 'crouch' }], 30);
C.Squat = keys([{ t: 0, use: GD }, { t: 0.1, pose: cat(HIP(0, -0.2, 0), { spine: R(12), c_handL: HL(0.2, 1.0, 0.2) }, axe([-0.38, 0.8, 0.12], 40, -1, { hip: [0, -0.2, 0] })) }], 30);
C.Rise = keys([{ t: 0, use: AIR, pose: { chest: R(-4, -8), head: R(-8, 6), c_footR: FR(-0.1, 0.26, -0.2), c_footL: FL(0.06, 0.04, 0.18) } }, { t: 0.4, pose: { c_footR: FR(-0.08, 0.16, -0.2), c_footL: FL(0.1, 0.14, 0.18) } }], 30);
C.Fall = keys([{ t: 0, use: AIR, pose: cat({ chest: R(6, -8), c_handL: HL(0.2, 1.4, 0.3) }, axe([-0.4, 1.15, 0.12], 100, -1)) }, { t: 0.3, pose: { c_footR: FR(-0.06, 0.14, -0.2), c_footL: FL(0.14, 0.24, 0.18) } }, { t: 0.6, pose: { c_footR: FR(-0.08, 0.1, -0.2), c_footL: FL(0.12, 0.2, 0.18) } }], 30);
C.FastFall = keys([{ t: 0, use: AIR, pose: cat({ chest: R(-4, -8), head: R(-6, 6), c_footR: FR(-0.04, 0.04, -0.2), c_footL: FL(0.04, 0.04, 0.18), c_handL: HL(0.0, 1.6, 0.3) }, axe([-0.4, 1.4, 0.0], 110, -1)) }], 30);
C.AirJump = keys([{ t: 0, use: AIR, pose: { c_footR: FR(-0.1, 0.4, -0.2), c_footL: FL(0.1, 0.42, 0.18), spine: R(20) } }, { t: 0.2, pose: { spine: R(-4), c_footR: FR(-0.14, 0.02, -0.2), c_footL: FL(0.04, 0.04, 0.18) } }, { t: 0.48, use: AIR }], 30);
C.Helpless = keys([{ t: 0, use: AIR, pose: cat({ head: R(-8, 0, 6), c_handL: HL(-0.1, 1.55, 0.4) }, axe([-0.42, 1.2, 0.0], 130, -1)) }, { t: 0.25, pose: { head: R(-8, 0, -6), c_footR: FR(0.12, 0.2, -0.2), c_footL: FL(-0.04, 0.06, 0.18) } }, { t: 0.5, pose: { head: R(-8, 0, 6), c_footR: FR(-0.06, 0.06, -0.2), c_footL: FL(0.12, 0.22, 0.18) } }], 30);
C.Land = keys([{ t: 0, use: ['stand', 'crouch'] }, { t: 0.2, pose: cat(HIP(0, -0.2, 0), { spine: R(10), chest: R(6, -12) }, axe([-0.38, 0.82, 0.3], 40, -1, { hip: [0, -0.2, 0] })) }, { t: 0.42, ...back }], 30);
C.LandHard = keys([{ t: 0, use: ['stand', 'crouch'] }, { t: 0.15, pose: cat(HIP(0, -0.42, 0.02), { spine: R(28), chest: R(14, -12), head: R(-24) }, axe([-0.38, 0.5, 0.45], 10, -1, { hip: [0, -0.42, 0.02] })) }, { t: 0.6, ...back }], 30);
/* the shield: braced behind the haft held crossways in both fists */
C.Shield = keys([{ t: 0, use: GD }, { t: 0.12, pose: cat(HIP(0, -0.14, -0.02), { spine: R(10), chest: R(6, -20), head: R(6, 14) }, axe([-0.2, 1.05, 0.34], 100, -1, { two: true, hip: [0, -0.14, -0.02], dx: 0.25 })) }], 30);
C.ShieldHit = keys([{ t: 0, use: GD, pose: cat(HIP(0, -0.14, -0.06), { spine: R(4), chest: R(0, -20) }, axe([-0.2, 1.05, 0.26], 100, -1, { two: true, hip: [0, -0.14, -0.06], dx: 0.25 })) }, { t: 0.3, pose: cat(HIP(0, -0.14, -0.02), { spine: R(10), chest: R(6, -20) }, axe([-0.2, 1.05, 0.34], 100, -1, { two: true, hip: [0, -0.14, -0.02], dx: 0.25 })) }], 30);
/* ---- being hit ---- */
C.Hit = keys([{ t: 0, use: GD, pose: cat(HIP(0, -0.04, -0.1), { spine: R(-14), chest: R(-12, -12), head: R(-18), c_handL: HL(0.0, 1.3, 0.4), c_footL: FL(0.3, 0.06, 0.2) }, axe([-0.44, 1.1, 0.0], 120, -1, { hip: [0, -0.04, -0.1] })) }, { t: 0.3, pose: { spine: R(-8), chest: R(-6, -12), head: R(-6) } }, { t: 0.6, ...back }], 30);
C.HitHeavy = keys([{ t: 0, use: GD, pose: cat(HIP(0, -0.06, -0.16), { spine: R(-22), chest: R(-18, -6), head: R(-26), c_handL: HL(-0.1, 1.45, 0.45), c_footL: FL(0.36, 0.1, 0.2) }, axe([-0.48, 1.2, -0.08], 140, -1, { hip: [0, -0.06, -0.16] })) }, { t: 0.4, pose: { spine: R(-10), chest: R(-8, -10), head: R(-10) } }, { t: 0.8, ...back }], 30);
C.Launch = keys([{ t: 0, use: AIR, pose: cat({ spine: R(-24), chest: R(-18), head: R(-26), c_handL: HL(-0.2, 1.5, 0.5), c_footL: FL(0.3, 0.3, 0.2), c_footR: FR(0.2, 0.2, -0.2) }, axe([-0.5, 1.3, -0.1], 150, -1)) }, { t: 0.5, pose: { spine: R(-10), chest: R(-8) } }], 30);
C.LaunchUp = keys([{ t: 0, use: AIR, pose: cat({ spine: R(-10), chest: R(-12), head: R(-30), c_handL: HL(0.0, 1.0, 0.5), c_footL: FL(0.0, 0.0, 0.25), c_footR: FR(0.0, 0.0, -0.25) }, axe([-0.5, 0.9, 0.0], -60, -1)) }, { t: 0.6, pose: { spine: R(0), head: R(-10) } }], 30);
C.Spike = keys([{ t: 0, use: AIR, pose: cat({ spine: R(30), chest: R(20), head: R(20), c_handL: HL(0.0, 1.7, 0.4), c_footL: FL(-0.1, 0.4, 0.2), c_footR: FR(-0.2, 0.3, -0.2) }, axe([-0.44, 1.6, -0.1], 110, -1)) }, { t: 0.6, pose: { spine: R(14), chest: R(10) } }], 30);
C.Tumble = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(32), chest: R(22) } }, { t: 0.6, pose: { spine: R(26), chest: R(18) } }], 30);
C.Down = keys([{ t: 0, use: 'stand', pose: cat({ all: R(-50) }, axe([-0.4, 0.98, 0.2], 60, -1)) }, { t: 0.3, pose: cat({ all: { rot: [-90, 0, 0], move: [0, 0.3, 0.95] }, c_handL: HL(-0.05, 1.05, 0.5), head: R(-8) }, axe([-0.5, 1.0, 0.1], 30, 1)) }], 30);
/* ---- dodges, ledge, grabs ---- */
C.Dodge = keys([{ t: 0, use: GD }, { t: 0.14, pose: cat({ all: R(0, 30), hips: M(0, -0.1, -0.2), spine: R(-12), chest: R(-8, -12) }, axe([-0.4, 1.1, 0.0], 110, -1, { hip: [0, -0.1, -0.2] })) }, { t: 0.42, ...back }], 30);
C.Roll = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.5, pose: { spine: R(30) } }, { t: 0.9, pose: { spine: R(26) } }, { t: 1.05, ...back }], 30);
C.AirDodge = keys([{ t: 0, use: AIR }, { t: 0.12, pose: cat({ spine: R(16), chest: R(10), head: R(10), c_footL: FL(0.1, 0.32, 0.18), c_footR: FR(0.06, 0.3, -0.18), c_handL: HL(0.2, 1.2, 0.12) }, axe([-0.34, 1.0, 0.2], 30, -1)) }, { t: 0.5, pose: { spine: R(10) } }, { t: 0.66, ...backAir }], 30);
C.Ledge = keys([{ t: 0, use: 'stand', pose: cat({ chest: R(-4), head: R(-12), c_handL: HL(0.25, 2.0, 0.15), c_footL: FL(0.06, 0, 0.18), c_footR: FR(-0.04, 0.06, -0.18) }, axe([-0.4, 0.8, 0.05], -80, -1)) },
  { t: 0.7, pose: { c_footL: FL(-0.04, 0.06, 0.18), c_footR: FR(0.04, 0, -0.18) } }, { t: 1.4, pose: { c_footL: FL(0.06, 0, 0.18), c_footR: FR(-0.04, 0.06, -0.18) } }], 30);   /* one hand on the lip, the axe hanging */
const HOLDP = cat({ chest: R(6, 10), c_handL: HL(0.62, 1.12, 0.06) }, axe([-0.4, 0.98, 0.1], 80, -1));
C.Hold = keys([{ t: 0, use: GD, pose: HOLDP }, { t: 0.3, pose: { chest: R(8, 12) } }, { t: 0.6, pose: { chest: R(6, 10) } }], 30);
C.Pummel = keys([{ t: 0, use: GD, pose: HOLDP }, { t: 0.08, pose: cat({ chest: R(4, -6) }, axe([-0.36, 1.12, 0.06], 80, -1)) }, { t: 0.14, in: 'snap', pose: cat({ chest: R(10, 22) }, axe([-0.2, 1.1, 0.42], 80, -1)) }, { t: 0.3, use: GD, pose: HOLDP }], 30);   /* a short knuckle-and-haft blow, the grip kept */
C.Held = keys([{ t: 0, use: AIR, pose: { hips: M(0, 0.06, 0), head: R(-10), c_handL: HL(0.15, 1.4, 0.3) } }, { t: 0.25, pose: { c_footL: FL(0.1, 0.16, 0.18), c_footR: FR(-0.05, 0.06, -0.18) } }, { t: 0.5, pose: { c_footL: FL(-0.06, 0.08, 0.18), c_footR: FR(0.12, 0.16, -0.18) } }], 30);
C.ThrowF = keys([{ t: 0, use: GD, pose: HOLDP }, { t: fr(8), pose: cat(HIP(0, -0.1, -0.06), { c_footR: FR(-0.3, 0, -0.24), chest: R(4, 20), c_handL: HL(0.4, 1.05, 0.06) }) }, { t: fr(13), in: 'snap', pose: cat(HIP(0, -0.12, 0.16), { spine: R(12), chest: R(10, -20), c_handL: HL(0.85, 1.15, 0.06) }) }, { t: fr(39), ...back }]);   /* Iron Heave */
C.ThrowB = keys([{ t: 0, use: GD, pose: HOLDP }, { t: fr(8), pose: { all: R(0, -60), chest: R(4, 30), c_handL: HL(0.4, 1.2, 0.0) } }, { t: fr(14), in: 'snap', pose: { all: R(0, -170), spine: R(-10), chest: R(-12, -10), c_handL: HL(-0.2, 1.65, 0.1) } }, { t: fr(30), pose: { all: R(0, -180) } }, { t: fr(49), ...back }]);   /* Shoulder Sling */
C.ThrowU = keys([{ t: 0, use: GD, pose: HOLDP }, { t: fr(8), pose: cat(HIP(0, -0.26, 0), { spine: R(14), c_handL: HL(0.35, 0.9, 0.06) }) }, { t: fr(13), in: 'snap', pose: cat(HIP(0, 0.04, 0), { spine: R(-8), head: R(-30), c_handL: HL(0.15, 2.05, 0.06) }, axe([-0.36, 1.6, 0.05], 110, -1)) }, { t: fr(22), pose: { head: R(-20) } }, { t: fr(43), ...back }]);   /* Sky Hurl */
C.ThrowD = keys([{ t: 0, use: GD, pose: HOLDP }, { t: fr(10), pose: cat(HIP(0, -0.04, 0), { c_handL: HL(0.5, 1.65, 0.06), chest: R(-8, 6) }) }, { t: fr(23), in: 'snap', pose: cat(HIP(0, -0.42, 0.06), { spine: R(34), chest: R(16), head: R(-30), c_handL: HL(0.62, 0.15, 0.06) }) }, { t: fr(39), ...back }]);   /* Stonebreaker */
C.Respawn = keys([{ t: 0, use: GD, pose: cat({ head: R(-6, 10) }, axe([-0.3, 1.38, 0.12], 150, 1)) }, { t: 1.2, pose: { head: R(-8, -6) } }, { t: 2.4, pose: { head: R(-6, 10) } }], 30);

/* ---- attacks: keyed on the game's frames (n / 60); each maps one to one onto its move ---- */
const lunge = (dz, drop, fl) => ({ hips: M(0, -drop, dz), c_footL: FL(0.2 + (fl === undefined ? dz * 1.3 : fl), 0, 0.2) });
const hp = (dz, drop) => [0, -drop, dz];
const AF = (clip, a0, a1, t, extra) => Object.assign({ clip, start: 0, contact: [fr(a0), fr(a1 + 1)], end: fr(t) }, extra || {});
/* Iron Straight: the left (rear) fist straight down the middle, 7 and 8; the axe tucked upright in the right */
C.Jab = keys([{ t: 0, use: GD }, { t: fr(4), pose: { chest: R(2, -20), c_handL: HL(0.22, 1.3, 0.14) } },
  { t: fr(7), in: 'snap', pose: cat(lunge(0.08, 0.08), { chest: R(6, 18), head: R(-4, -8), c_handL: HL(0.98, 1.27, 0.0) }, axe([-0.34, 1.0, 0.18], 86, -1, { hip: hp(0.08, 0.08) })) },
  { t: fr(9), pose: { c_handL: HL(0.96, 1.26, 0.0) } }, { t: fr(15), pose: { chest: R(4, -4), c_handL: HL(0.5, 1.3, 0.1) } }, { t: fr(26), ...back }]);
/* the push kick: the lead (left) leg chambers and drives the boot straight out at hip height, 10 to 12 */
C.Ftilt = keys([{ t: 0, use: GD }, { t: fr(4), pose: cat(HIP(0, -0.06, -0.06), { spine: R(-4), c_footL: FL(0.22, 0.42, 0.16) }) },
  { t: fr(10), in: 'snap', pose: cat(HIP(0, -0.04, -0.08), { spine: R(-14), chest: R(-8, -16), head: R(4, 12), c_footL: FL(1.42, 0.68, 0.12), c_footR: FR(-0.2, 0, -0.22) }) },
  { t: fr(12), pose: { c_footL: FL(1.44, 0.7, 0.12) } }, { t: fr(18), pose: cat(HIP(0, -0.06, -0.04), { spine: R(-4), c_footL: FL(0.4, 0.4, 0.16) }) }, { t: fr(39), ...back }]);
/* Technical Uppercut: knees load, hips and trunk turn up, the bent left arm drives up the middle (7 to 9), the right still guarding */
C.Utilt = keys([{ t: 0, use: GD }, { t: fr(4), pose: cat(HIP(0, -0.18, 0.02), { spine: R(10), chest: R(6, 16), head: R(4, -10), c_handL: HL(0.3, 1.0, 0.1) }) },
  { t: fr(7), in: 'snap', pose: cat(HIP(0, -0.02, 0.06), { spine: R(-6), chest: R(-8, -24), head: R(-16, 14), c_handL: HL(0.5, 1.72, 0.04), c_footR: FR(-0.1, 0.04, -0.22) }) },
  { t: fr(9), pose: { c_handL: HL(0.5, 1.82, 0.04) } }, { t: fr(16), pose: cat(HIP(0, -0.08, 0.02), { chest: R(0, -12), c_handL: HL(0.4, 1.4, 0.1) }) }, { t: fr(31), ...back }]);
/* the low kick: hips drop, the lead boot sweeps out along the floor, 10 to 12 */
C.Dtilt = keys([{ t: 0, use: GD }, { t: fr(5), use: 'crouch' },
  { t: fr(10), in: 'snap', pose: cat(HIP(0, -0.42, -0.06), { spine: R(14), chest: R(4, -16), head: R(-10, 12), c_footL: FL(1.55, 0.06, 0.16), c_footR: FR(-0.2, 0, -0.24), c_handL: HL(0.1, 0.95, 0.26) }) },
  { t: fr(12), pose: { c_footL: FL(1.58, 0.06, 0.16) } }, { t: fr(22), use: 'crouch' }, { t: fr(35), ...back }]);
/* Charging Forearm: hips low, the lead shoulder rolls forward and the body slams in, early 10 to 12, late 13 to 19 */
C.Dash = keys([{ t: 0, use: GD, pose: { spine: R(10) } }, { t: fr(6), pose: cat(HIP(0, -0.16, 0.06), { spine: R(20), chest: R(12, 40), head: R(-14, -30), c_handL: HL(0.2, 1.15, 0.24) }, axe([-0.42, 0.92, -0.1], 200, 1, { hip: [0, -0.16, 0.06] })) },
  { t: fr(10), in: 'snap', pose: cat(HIP(0, -0.12, 0.26), { spine: R(24), chest: R(14, 55), head: R(-16, -42), c_footL: FL(0.62, 0, 0.18), c_footR: FR(-0.2, 0.1, -0.2), c_handL: HL(0.48, 1.18, 0.12) }) },
  { t: fr(19), pose: cat(HIP(0, -0.14, 0.3), { c_footL: FL(0.66, 0, 0.18) }) }, { t: fr(28), pose: cat(HIP(0, -0.1, 0.12), { spine: R(8), chest: R(6, 0) }) }, { t: fr(37), ...back }]);
/* ---- smashes ---- */
/* Axe Execution: the axe lowered behind the rear shoulder, knees compressed, then hips turn and pull the blade across the
   chest (24 to 27, both hands on the haft), the torso over-rotating after it */
{ const h0 = hp(0.24, 0.14);
  C.Fsmash = keys([{ t: 0, use: GD },
    { t: fr(8), pose: cat(HIP(0, -0.12, -0.12), { spine: R(-4), chest: R(-6, -60), head: R(-4, 50), c_footL: FL(0.26, 0, 0.22), c_footR: FR(-0.3, 0, -0.26) }, axe([-0.2, 1.3, -0.3], 160, -1, { two: true, hip: [0, -0.12, -0.12] })) },
    { t: fr(15), pose: cat(HIP(0, -0.14, -0.14), { chest: R(-8, -70), head: R(-4, 58) }, axe([-0.2, 1.3, -0.34], 168, -1, { two: true, hip: [0, -0.14, -0.14] })) },
    { t: fr(21), pose: cat(HIP(0, -0.13, 0.04), { chest: R(2, -30), head: R(-4, 26) }, axe([-0.5, 1.2, 0.1], 120, -1, { two: true, dx: -0.3, hip: [0, -0.13, 0.04] })) },
    { t: fr(24), in: 'snap', pose: cat(lunge(0.24, 0.14), { spine: R(14), chest: R(14, 16), head: R(-10, -12), c_footR: FR(-0.36, 0, -0.26) }, AXHIT('fsmash', 0, -0.12, { two: true, hip: h0 })) },
    { t: fr(27), pose: cat({ chest: R(14, 30) }, AXHIT('fsmash', 0, -0.06, { two: true, hip: h0 })) },
    { t: fr(36), pose: cat({ chest: R(10, 70), head: R(-8, -50) }, axe([0.2, 1.1, 0.6], 20, -1, { two: true, dx: 0.4, hip: h0 })) },
    { t: fr(50), pose: cat(HIP(0, -0.1, 0.1), { chest: R(6, 20) }, axe([-0.1, 1.15, 0.45], 50, -1, { two: true })) }, { t: fr(66), ...back }]); }
C.FsmashE = keys([{ t: 0, use: GD },   /* the haymaker: hands up, hips coil against the braced heel, the right fist hooks across */
  { t: fr(10), pose: cat(HIP(0, -0.1, -0.1), { chest: R(-4, -50), head: R(-4, 40), c_handL: HL(0.3, 1.35, 0.16), c_handR: HR(-0.3, 1.3, -0.4), c_footR: FR(-0.3, 0, -0.26) }) },
  { t: fr(20), pose: cat(HIP(0, -0.12, -0.14), { chest: R(-6, -64), head: R(-4, 52), c_handR: HR(-0.36, 1.3, -0.42) }) },
  { t: fr(27), in: 'snap', pose: cat(lunge(0.22, 0.12), { spine: R(14), chest: R(14, 40), head: R(-10, -30), c_handR: HR(1.08, 1.18, 0.0), c_handL: HL(0.2, 1.2, 0.3), c_footR: FR(0.0, 0, -0.24) }) },
  { t: fr(29), pose: { c_handR: HR(1.1, 1.16, 0.06) } }, { t: fr(40), pose: cat(HIP(0, -0.1, 0.16), { chest: R(10, 60), c_handR: HR(0.6, 1.0, 0.3) }) }, { t: fr(63), ...back }]);
/* Rising Axe Cleave: the head low by the rear knee, both hands tighten, then up through the front (20, 22) to overhead (24) */
C.Usmash = keys([{ t: 0, use: GD },
  { t: fr(8), pose: cat(HIP(0, -0.3, 0), { spine: R(18), chest: R(10, -30), head: R(-16, 24) }, axe([-0.3, 0.6, -0.12], 225, -1, { two: true, hip: [0, -0.3, 0] })) },
  { t: fr(14), pose: cat(HIP(0, -0.34, 0), { spine: R(20) }, axe([-0.3, 0.56, -0.15], 232, -1, { two: true, hip: [0, -0.34, 0] })) },
  { t: fr(20), in: 'snap', pose: cat(HIP(0, -0.16, 0.06), { spine: R(6), chest: R(2, -6), head: R(-20) }, AXHIT('usmash', 0, -0.14, { two: true, hip: [0, -0.16, 0.06] })) },
  { t: fr(22), pose: cat(HIP(0, -0.04, 0.04), { spine: R(-4), chest: R(-8, 0), head: R(-28) }, AXHIT('usmash', 1, -0.14, { two: true, hip: [0, -0.04, 0.04] })) },
  { t: fr(24), pose: cat(HIP(0, 0.02, 0), { spine: R(-10), chest: R(-14, 6), head: R(-32), c_footR: FR(-0.2, 0.06, -0.24) }, AXHIT('usmash', 2, -0.14, { two: true, hip: [0, 0.02, 0] })) },
  { t: fr(32), pose: cat({ spine: R(-14), chest: R(-16) }, axe([-0.14, 1.85, -0.2], 160, 1, { two: true })) }, { t: fr(46), pose: cat(HIP(0, -0.08, 0), { chest: R(2, -10) }, axe([-0.3, 1.5, 0.05], 110, -1)) }, { t: fr(61), ...back }]);
C.UsmashE = keys([{ t: 0, use: GD },   /* the rising hammer: a loaded squat, fists by the ribs, then both forearms drive up (19 to 22) */
  { t: fr(9), pose: cat(HIP(0, -0.38, 0), { spine: R(18), chest: R(12), head: R(-16), c_handR: HR(0.18, 0.95, -0.24), c_handL: HL(0.18, 0.95, 0.24) }) },
  { t: fr(19), in: 'snap', pose: cat(HIP(0, 0.04, 0.02), { spine: R(-8), chest: R(-10), head: R(-28), c_handR: HR(0.24, 2.0, -0.16), c_handL: HL(0.24, 2.0, 0.16), c_footR: FR(-0.16, 0.06, -0.22) }) },
  { t: fr(22), pose: { c_handR: HR(0.26, 2.08, -0.16), c_handL: HL(0.26, 2.08, 0.16) } }, { t: fr(36), pose: cat(HIP(0, -0.1, 0), { c_handR: HR(0.3, 1.4, -0.4), c_handL: HL(0.3, 1.4, 0.4) }) }, { t: fr(54), ...back }]);
/* Ground Reaper: low in front (16 to 19), the weight carried round behind him, low behind (25 to 28), feet planted */
C.Dsmash = keys([{ t: 0, use: GD },
  { t: fr(8), pose: cat(HIP(0, -0.3, 0), { spine: R(16), chest: R(10, -50), head: R(-12, 40) }, axe([-0.4, 0.62, -0.1], 200, 1, { two: true, hip: [0, -0.3, 0] })) },
  { t: fr(16), in: 'snap', pose: cat(HIP(0, -0.42, 0.04), { spine: R(26), chest: R(16, 10), head: R(-20) }, AXHIT('dsmash', 0, -0.18, { two: true, hip: [0, -0.42, 0.04] })) },
  { t: fr(19), pose: cat({ chest: R(16, 30) }, AXHIT('dsmash', 0, -0.1, { two: true, hip: [0, -0.42, 0.04] })) },
  { t: fr(22), pose: cat(HIP(0, -0.4, 0), { chest: R(12, 90), head: R(-16, -60) }, axe([0.1, 0.55, 0.0], 270, 1, { two: true, dx: 0.5, hip: [0, -0.4, 0] })) },
  { t: fr(25), in: 'snap', pose: cat(HIP(0, -0.42, -0.04), { spine: R(24), chest: R(14, 160), head: R(-18, -150) }, AXHIT('dsmash', 1, 0.1, { two: true, hip: [0, -0.42, -0.04] })) },
  { t: fr(28), pose: cat({ chest: R(14, 170) }, AXHIT('dsmash', 1, 0.16, { two: true, hip: [0, -0.42, -0.04] })) },
  { t: fr(42), pose: cat(HIP(0, -0.2, 0), { chest: R(8, 40), head: R(-8, -20) }, axe([-0.3, 0.8, 0.3], 30, -1, { hip: [0, -0.2, 0] })) }, { t: fr(61), ...back }]);
C.DsmashE = keys([{ t: 0, use: GD },   /* two-sided boot sweep: the lead heel forward (16 to 18), round across the base, the other boot behind (25 to 27) */
  { t: fr(8), pose: cat(HIP(0, -0.3, 0), { spine: R(16), chest: R(10) }) },
  { t: fr(16), in: 'snap', pose: cat(HIP(0, -0.46, -0.04), { spine: R(20), chest: R(10, -10), c_footL: FL(1.3, 0.05, 0.18), c_footR: FR(-0.1, 0, -0.24), c_handL: HL(0.0, 0.7, 0.4) }) },
  { t: fr(18), pose: { c_footL: FL(1.32, 0.05, 0.18) } },
  { t: fr(25), in: 'snap', pose: cat(HIP(0, -0.46, 0.04), { spine: R(20), chest: R(10, 20), c_footL: FL(0.1, 0, 0.2), c_footR: FR(-1.28, 0.05, -0.2) }) },
  { t: fr(27), pose: { c_footR: FR(-1.3, 0.05, -0.2) } }, { t: fr(40), use: 'crouch' }, { t: fr(55), ...back }]);
/* ---- air ---- */
/* the double kick: the first boot out on 7 and 8 (lingering to 12), the knee back, the other boot out on 17 and 18 (to 26) */
C.Nair = keys([{ t: 0, use: AIR, pose: { c_footL: FL(0.14, 0.42, 0.18), c_footR: FR(0.08, 0.38, -0.18) } },
  { t: fr(7), in: 'snap', pose: { spine: R(-10), chest: R(-6, -10), c_footR: FR(0.96, 0.6, -0.16), c_footL: FL(0.08, 0.44, 0.18) } }, { t: fr(12), pose: { c_footR: FR(0.94, 0.58, -0.16) } },
  { t: fr(15), pose: { spine: R(0), c_footR: FR(0.1, 0.42, -0.16), c_footL: FL(0.2, 0.5, 0.18) } },
  { t: fr(17), in: 'snap', pose: { spine: R(-12), chest: R(-6, 10), c_footL: FL(1.12, 0.78, 0.16), c_footR: FR(0.0, 0.36, -0.18) } }, { t: fr(26), pose: { c_footL: FL(1.1, 0.76, 0.16) } }, { t: fr(32), pose: { spine: R(4), c_footL: FL(0.2, 0.4, 0.18) } }, { t: fr(40), ...backAir }]);
/* Axe Crusher: feet under the hips, the axe high behind the shoulder, the ribs turn and the blade comes over and down through the front (17 to 20) */
C.Fair = keys([{ t: 0, use: AIR },
  { t: fr(8), pose: cat({ spine: R(-10), chest: R(-12, -24), head: R(-6, 16) }, axe([-0.24, 1.75, -0.2], 140, -1, { two: true })) },
  { t: fr(14), pose: cat({ spine: R(-14), chest: R(-14, -28) }, axe([-0.24, 1.85, -0.25], 125, -1, { two: true })) },
  { t: fr(17), in: 'snap', pose: cat({ spine: R(6), chest: R(6, 10), head: R(-2, -6), c_footL: FL(0.3, 0.3, 0.18) }, AXHIT('fair', 0, -0.12, { two: true })) },
  { t: fr(19), pose: cat({ spine: R(16), chest: R(14, 16) }, AXHIT('fair', 1, -0.12, { two: true })) }, { t: fr(20), pose: AXHIT('fair', 1, -0.12, { two: true }) },
  { t: fr(28), pose: cat({ spine: R(22), chest: R(18, 14), head: R(-14) }, axe([-0.14, 0.75, 0.55], -60, -1, { two: true })) }, { t: fr(48), ...backAir }]);
/* the unarmed forward air: the shoulder loads, the spine turns and the right fist drives to full stretch (14 to 19) */
C.FairE = keys([{ t: 0, use: AIR }, { t: fr(8), pose: { spine: R(-8), chest: R(-6, -40), head: R(-4, 30), c_handR: HR(-0.3, 1.35, -0.42), c_handL: HL(0.3, 1.3, 0.2) } },
  { t: fr(14), in: 'snap', pose: { spine: R(10), chest: R(10, 30), head: R(-8, -22), c_handR: HR(1.25, 1.2, -0.02), c_handL: HL(-0.1, 1.25, 0.35), c_footL: FL(-0.1, 0.32, 0.18), c_footR: FR(0.25, 0.3, -0.18) } },
  { t: fr(19), pose: { c_handR: HR(1.27, 1.18, -0.02) } }, { t: fr(28), pose: { chest: R(4, 10), c_handR: HR(0.5, 1.2, -0.3) } }, { t: fr(44), ...backAir }]);
/* Axe Backhand: elbows in round the haft, the torso turns away, the blade flashes out behind at shoulder height (12 to 14) */
C.Bair = keys([{ t: 0, use: AIR }, { t: fr(6), pose: cat({ chest: R(0, 30), head: R(0, -20) }, axe([-0.1, 1.15, 0.36], 20, -1, { two: true })) },
  { t: fr(12), in: 'snap', pose: cat({ spine: R(-6), chest: R(-8, -70), head: R(2, 30), c_footL: FL(0.32, 0.26, 0.18), c_footR: FR(0.2, 0.22, -0.18) }, AXHIT('bair', 0, -0.1, { two: true })) },
  { t: fr(14), pose: AXHIT('bair', 0, -0.06, { two: true }) }, { t: fr(22), pose: cat({ chest: R(-4, -40) }, axe([-0.2, 1.2, -0.3], 150, 1, { two: true })) }, { t: fr(39), ...backAir }]);
/* the unarmed backfist: knees tuck, the right fist snaps out behind across the shoulder (10 to 12) */
C.BairE = keys([{ t: 0, use: AIR }, { t: fr(5), pose: { chest: R(0, 30), c_handR: HR(0.2, 1.4, 0.0), c_footL: FL(0.14, 0.4, 0.18), c_footR: FR(0.1, 0.4, -0.18) } },
  { t: fr(10), in: 'snap', pose: { spine: R(-4), chest: R(-4, -40), head: R(0, 26), c_handR: HR(-1.25, 1.18, -0.3) } }, { t: fr(12), pose: { c_handR: HR(-1.27, 1.2, -0.3) } }, { t: fr(22), pose: { chest: R(0, -10), c_handR: HR(-0.2, 1.3, -0.4) } }, { t: fr(35), ...backAir }]);
/* Axe Skyhook: the axe across the belly, then a circle up and over from in front (11) through the top (13) to behind (15) */
C.Uair = keys([{ t: 0, use: AIR }, { t: fr(5), pose: cat({ spine: R(10), c_footL: FL(0.14, 0.4, 0.18), c_footR: FR(0.1, 0.4, -0.18) }, axe([-0.2, 0.95, 0.35], -10, 1, { two: true })) },
  { t: fr(11), in: 'snap', pose: cat({ spine: R(-6), chest: R(-10), head: R(-22) }, AXHIT('uair', 0, -0.12, { two: true })) }, { t: fr(12), pose: AXHIT('uair', 0, -0.12, { two: true }) },
  { t: fr(13), pose: cat({ spine: R(-10), chest: R(-16), head: R(-30) }, AXHIT('uair', 1, -0.12, { two: true })) },
  { t: fr(14), pose: cat({ spine: R(-12), chest: R(-20) }, AXHIT('uair', 2, -0.12, { two: true })) }, { t: fr(15), pose: AXHIT('uair', 2, -0.12, { two: true }) },
  { t: fr(24), pose: cat({ spine: R(0), chest: R(-4), head: R(-6), c_footL: FL(0.2, 0.2, 0.25), c_footR: FR(-0.1, 0.1, -0.25) }, axe([-0.3, 1.2, -0.2], 200, 1)) }, { t: fr(39), ...backAir }]);
/* the unarmed flip kick: the torso leans back, the leg snaps up over the front (8 to 10), across the top and down behind (to 16) */
C.UairE = keys([{ t: 0, use: AIR }, { t: fr(4), pose: { spine: R(-10), c_footR: FR(0.3, 0.45, -0.16) } },
  { t: fr(8), in: 'snap', pose: { spine: R(-22), chest: R(-12), head: R(-18), c_footR: FR(0.85, 1.75, -0.12) } }, { t: fr(11), pose: { spine: R(-28), c_footR: FR(0.15, 2.25, -0.12) } },
  { t: fr(14), pose: { spine: R(-24), c_footR: FR(-0.7, 1.85, -0.12) } }, { t: fr(16), pose: { c_footR: FR(-0.75, 1.7, -0.12) } }, { t: fr(24), pose: { spine: R(0), c_footR: FR(-0.08, 0.2, -0.18) } }, { t: fr(33), ...backAir }]);
/* the two-foot stomp: knees to the chest, arms out for balance, both boots driven straight down (16 to 18) */
C.Dair = keys([{ t: 0, use: AIR }, { t: fr(9), pose: cat({ hips: M(0, 0.2, 0), spine: R(14), c_footL: FL(0.08, 0.62, 0.16), c_footR: FR(0.06, 0.62, -0.16), c_handL: HL(0.0, 1.45, 0.62) }, axe([-0.62, 1.4, 0.0], 60, -1)) },
  { t: fr(16), in: 'snap', pose: { hips: M(0, 0.1, 0), spine: R(-4), chest: R(-4), head: R(10), c_footL: FL(0.08, -0.62, 0.12), c_footR: FR(0.08, -0.62, -0.12) } }, { t: fr(18), pose: { c_footL: FL(0.08, -0.64, 0.12), c_footR: FR(0.08, -0.64, -0.12) } },
  { t: fr(30), pose: { hips: M(0, 0.14, 0), spine: R(8), c_footL: FL(0.1, 0.3, 0.16), c_footR: FR(0.06, 0.3, -0.16) } }, { t: fr(44), ...backAir }]);
/* ---- grabs, get-ups ---- */
C.Grab = keys([{ t: 0, use: GD }, { t: fr(4), pose: { c_handL: HL(0.3, 1.25, 0.2) } }, { t: fr(8), in: 'snap', pose: cat(lunge(0.1, 0.06), { chest: R(8, 20), c_handL: HL(0.98, 1.12, 0.06) }) }, { t: fr(10), pose: { c_handL: HL(0.98, 1.12, 0.06) } }, { t: fr(38), ...back }]);
C.GrabRun = keys([{ t: 0, use: GD, pose: { spine: R(10) } }, { t: fr(6), pose: cat(lunge(0.2, 0.14), { c_handL: HL(0.5, 1.15, 0.2) }) }, { t: fr(11), in: 'snap', pose: cat(lunge(0.26, 0.12), { chest: R(10, 26), c_handL: HL(1.12, 1.1, 0.06) }) }, { t: fr(13), pose: {} }, { t: fr(46), ...back }]);
C.GrabTurn = keys([{ t: 0, use: GD }, { t: fr(6), pose: { all: R(0, 120), chest: R(4, -20) } }, { t: fr(12), in: 'snap', pose: cat({ all: R(0, 180) }, lunge(0.1, 0.06), { chest: R(8, 30), c_handL: HL(1.2, 1.12, 0.06) }) }, { t: fr(14), pose: {} }, { t: fr(41), reset: true, use: GD, pose: { all: R(0, 180) } }]);
C.Getup = keys([{ t: 0, use: 'crouch', pose: { hips: M(0, -0.55, 0) } }, { t: fr(12), use: 'crouch' },
  { t: fr(16), in: 'snap', pose: cat(HIP(0, -0.5, 0), { spine: R(30), c_footL: FL(1.15, 0.04, 0.16), c_footR: FR(-1.15, 0.04, -0.16), c_handL: HL(0.0, 0.3, 0.45) }) }, { t: fr(19), pose: {} }, { t: fr(40), ...back }]);
C.LedgeAtk = keys([{ t: 0, use: 'crouch' }, { t: fr(18), pose: { c_footL: FL(0.2, 0.3, 0.16) } }, { t: fr(23), in: 'snap', pose: cat(HIP(0, -0.12, -0.06), { spine: R(-12), c_footL: FL(1.35, 0.6, 0.12) }) }, { t: fr(25), pose: {} }, { t: fr(55), ...back }]);
/* ---- specials ---- */
/* Axe Throw: the axe pulled back behind the shoulder, front foot forward, slung through and let go on frame 30 */
C.Throw = keys([{ t: 0, use: GD },
  { t: fr(14), pose: cat(HIP(0, -0.08, -0.12), { spine: R(-10), chest: R(-10, -40), head: R(-4, 30), c_footL: FL(0.3, 0, 0.2), c_handL: HL(0.5, 1.4, 0.12) }, axe([-0.4, 1.7, -0.4], 200, 1, { hip: [0, -0.08, -0.12] })) },
  { t: fr(24), pose: cat(HIP(0, -0.1, -0.16), { chest: R(-14, -50) }, axe([-0.42, 1.75, -0.45], 210, 1, { hip: [0, -0.1, -0.16] })) },
  { t: fr(30), in: 'snap', pose: cat(lunge(0.24, 0.12), { spine: R(14), chest: R(14, 20), head: R(-10, -10), c_handL: HL(0.1, 1.15, 0.36) }, axe([-0.32, 1.45, 0.62], 40, -1, { hip: hp(0.24, 0.12) })) },
  { t: fr(40), pose: cat({ chest: R(16, 26), c_handR: HR(0.7, 0.95, -0.2) }) }, { t: fr(66), reset: true, use: GD, pose: { c_handR: HR(0.25, 1.25, -0.3), c_handL: HL(0.34, 1.3, 0.12) } }]);
/* with the axe away: an open hand held out toward it, calling */
C.Beckon = keys([{ t: 0, use: GD, pose: { c_handR: HR(0.3, 1.2, -0.3) } }, { t: fr(8), pose: { chest: R(0, -30), head: R(-6, 20), c_handR: HR(0.85, 1.45, -0.3) } }, { t: fr(24), pose: { c_handR: HR(0.82, 1.42, -0.3) } }]);
/* Meteor Shoulder Charge: shoulder sinks into a crouch (1 to 14), explodes forward on 15 shoulder-first and head tucked,
   carries through the travel (to 40), then the boots skid and the shoulders recoil */
C.Meteor = keys([{ t: 0, use: GD },
  { t: fr(10), pose: cat(HIP(0, -0.3, -0.12), { spine: R(24), chest: R(14, 60), head: R(-20, -45), c_footL: FL(0.3, 0, 0.2), c_footR: FR(-0.42, 0, -0.24), c_handL: HL(0.2, 0.95, 0.28) }, axe([-0.44, 0.8, -0.3], 200, 1, { hip: [0, -0.3, -0.12] })) },
  { t: fr(15), in: 'snap', pose: cat(HIP(0, -0.24, 0.22), { spine: R(38), chest: R(16, 70), head: R(-30, -50), c_footL: FL(0.5, 0.16, 0.2), c_footR: FR(-0.6, 0.12, -0.24), c_handL: HL(0.36, 1.05, 0.2) }, axe([-0.44, 0.92, -0.32], 200, 1, { hip: [0, -0.24, 0.22] })) },
  { t: fr(28), pose: { hips: M(0, -0.22, 0.24), c_footL: FL(0.3, 0.3, 0.2), c_footR: FR(-0.5, 0.2, -0.24) } }, { t: fr(40), pose: { hips: M(0, -0.24, 0.22), c_footL: FL(0.5, 0.16, 0.2), c_footR: FR(-0.6, 0.12, -0.24) } },
  { t: fr(46), pose: cat(HIP(0, -0.3, -0.06), { spine: R(10), chest: R(4, 20), head: R(-6, -10), c_footL: FL(0.4, 0, 0.2), c_footR: FR(-0.3, 0, -0.24) }, axe([-0.4, 0.9, 0.2], 50, -1, { hip: [0, -0.3, -0.06] })) }, { t: fr(57), ...back }]);
/* Soaring Plunge, played by the game from frame 0 to 60 of the move and held there: gather (1 to 9), the rising slash and
   climb (10 to 38), the hang with the axe overhead (39 to 47), the turn over (48 to 53), the dive head-first behind the axe */
const upClip = fist => keys([{ t: 0, use: GD },
  { t: fr(8), pose: cat(HIP(0, -0.3, 0), { spine: R(18), chest: R(10, -10), head: R(-14) }, fist ? { c_handR: HR(0.25, 0.95, -0.25), c_handL: HL(0.25, 0.95, 0.25) } : axe([-0.3, 0.7, 0.4], -20, 1, { two: true, hip: [0, -0.3, 0] })) },
  { t: fr(10), in: 'snap', pose: cat(HIP(0, 0.0, 0.02), { spine: R(-8), chest: R(-10), head: R(-26), c_footL: FL(0.1, 0.2, 0.2), c_footR: FR(-0.1, -0.1, -0.2) }, fist ? { c_handR: HR(0.45, 1.85, -0.2), c_handL: HL(0.2, 1.3, 0.3) } : AXHIT('uspec', 0, -0.2, { two: true, hip: [0, 0, 0.02] })) },
  { t: fr(30), pose: cat({ spine: R(-10), c_footL: FL(0.0, -0.1, 0.18), c_footR: FR(-0.05, -0.15, -0.18) }, fist ? { c_handR: HR(0.2, 2.1, -0.2), c_handL: HL(0.2, 2.05, 0.2) } : axe([-0.2, 1.95, 0.1], 85, 1, { two: true })) },
  { t: fr(39), pose: cat({ spine: R(-4), chest: R(-4), head: R(-14), c_footL: FL(0.2, 0.2, 0.18), c_footR: FR(-0.1, 0.1, -0.18) }, fist ? { c_handR: HR(0.4, 1.95, -0.24), c_handL: HL(0.35, 1.9, 0.24) } : AXHIT('uspec', 1, -0.2, { two: true })) },
  { t: fr(47), pose: cat({ chest: R(-2), head: R(-10) }, fist ? {} : axe([-0.2, 1.92, 0.25], 60, 1, { two: true })) },
  { t: fr(53), pose: cat({ all: R(30), spine: R(16), chest: R(10), head: R(10) }, fist ? { c_handR: HR(0.5, 1.7, -0.2), c_handL: HL(0.5, 1.7, 0.2) } : axe([-0.2, 1.5, 0.45], 10, -1, { two: true })) },
  { t: fr(57), in: 'snap', pose: cat({ all: R(12), spine: R(20), chest: R(12), head: R(20), c_footL: FL(-0.1, 0.4, 0.18), c_footR: FR(-0.2, 0.3, -0.18) }, fist ? { c_handR: HR(0.35, 0.65, -0.18), c_handL: HL(0.35, 0.65, 0.18) } : AXHIT('uspec', 6, -0.2, { two: true })) },
  { t: fr(60), pose: {} }]);
C.UpB = upClip(false); C.UpBE = upClip(true);
/* the plunge's landing: the axe driven into the floor ahead, a hard compression, then up again (36) */
C.UpLand = keys([{ t: 0, use: ['stand', 'crouch'], pose: cat(HIP(0, -0.4, 0.06), { spine: R(30), chest: R(16), head: R(-16) }, AXHIT('uspecL', 0, -0.2, { two: true, hip: [0, -0.4, 0.06] })) },
  { t: fr(4), pose: { hips: M(0, -0.44, 0.06) } }, { t: fr(20), pose: cat(HIP(0, -0.3, 0.02), { spine: R(20) }, axe([-0.3, 0.75, 0.42], 0, -1, { two: true, hip: [0, -0.3, 0.02] })) }, { t: fr(36), ...back }]);
C.UpLandE = keys([{ t: 0, use: ['stand', 'crouch'], pose: cat(HIP(0, -0.4, 0.06), { spine: R(30), chest: R(16), head: R(-16), c_handR: HR(0.65, 0.35, -0.18), c_handL: HL(0.65, 0.35, 0.18) }) },
  { t: fr(4), pose: { hips: M(0, -0.44, 0.06) } }, { t: fr(36), ...back }]);
/* Counter: weight down, forearms set behind the haft as a compact guard (window 8 to 29), then back */
C.Counter = keys([{ t: 0, use: GD }, { t: fr(8), pose: cat(HIP(0, -0.18, -0.04), { spine: R(8), chest: R(6, -24), head: R(4, 18), c_handL: HL(0.36, 1.2, 0.0) }, axe([-0.24, 1.0, 0.36], 95, -1, { hip: [0, -0.18, -0.04], dx: 0.3 })) },
  { t: fr(29), pose: { hips: M(0, -0.2, -0.04), chest: R(8, -24) } }, { t: fr(67), ...back }]);
/* the counter's answer: the haft's butt snaps up under the attacker (4 and 5) */
C.CounterHit = keys([{ t: 0, use: GD, pose: cat(HIP(0, -0.2, -0.04), { spine: R(8), chest: R(6, -24), c_handL: HL(0.36, 1.2, 0.0) }, axe([-0.24, 1.0, 0.36], 95, -1, { hip: [0, -0.2, -0.04], dx: 0.3 })) },
  { t: fr(4), in: 'snap', pose: cat(HIP(0, 0.0, 0.1), { spine: R(-8), chest: R(-10, 10), head: R(-20), c_footR: FR(-0.1, 0.06, -0.22) }, axe([-0.2, 1.62, 0.5], -100, -1, { dx: 0.15 })) },
  { t: fr(5), pose: {} }, { t: fr(20), pose: cat(HIP(0, -0.04, 0.04), { chest: R(-2, -6) }, axe([-0.3, 1.2, 0.4], 70, -1)) }, { t: fr(34), ...back }]);
C.CounterHitE = keys([{ t: 0, use: GD, pose: cat(HIP(0, -0.2, -0.04), { spine: R(8), chest: R(6, -24), c_handL: HL(0.36, 1.2, 0.0), c_handR: HR(0.3, 1.2, -0.2) }) },
  { t: fr(4), in: 'snap', pose: cat(HIP(0, 0.0, 0.1), { spine: R(-8), chest: R(-10, 10), head: R(-20), c_handR: HR(0.7, 1.75, -0.12), c_footR: FR(-0.1, 0.06, -0.22) }) }, { t: fr(5), pose: {} }, { t: fr(34), ...back }]);
/* Berserker on or off: arms flung wide and a roar */
C.Berserk = keys([{ t: 0, use: GD }, { t: fr(4), in: 'snap', pose: cat(HIP(0, -0.12, 0), { spine: R(-12), chest: R(-14), head: R(-20), c_handL: HL(0.1, 1.5, 0.75) }, axe([-0.75, 1.5, 0.1], 120, -1)) }, { t: fr(8), pose: {} }]);

/* ---- the hands: how closed each hand is (0 open, 1 a fist), [t, right, left] points eased between. The right fist holds
   the axe through nearly everything; the left closes for punches, grabs and two-handed swings. ---- */
const GRIP = { '*': [[0, 1, 0.75]], Grab: [[0, 1, 0.4], [fr(7), 1, 0.05], [fr(10), 1, 0.9]], GrabRun: [[0, 1, 0.4], [fr(10), 1, 0.05], [fr(13), 1, 0.9]], GrabTurn: [[0, 1, 0.4], [fr(11), 1, 0.05], [fr(14), 1, 0.9]],
  Hold: [[0, 1, 0.85]], Pummel: [[0, 1, 0.85]], ThrowF: [[0, 1, 0.85], [fr(13), 1, 0.1]], ThrowB: [[0, 1, 0.85], [fr(14), 1, 0.1]], ThrowU: [[0, 1, 0.85], [fr(13), 1, 0.1]], ThrowD: [[0, 1, 0.85], [fr(23), 1, 0.1]],
  Throw: [[0, 1, 0.75], [fr(30), 1, 0.75], [fr(31), 0.1, 0.75], [fr(66), 0.6, 0.75]], Beckon: [[0, 0.3, 0.75], [fr(8), 0.05, 0.75]], Ledge: [[0, 1, 0.85]],
  FsmashE: [[0, 1, 1]], UsmashE: [[0, 1, 1]], FairE: [[0, 1, 1]], BairE: [[0, 1, 1]], UpBE: [[0, 1, 1]], UpLandE: [[0, 1, 1]], CounterHitE: [[0, 1, 1]], Berserk: [[0, 1, 0.75], [fr(4), 1, 0.05], [fr(8), 1, 0.4]],
  Launch: [[0, 1, 0.3]], LaunchUp: [[0, 1, 0.3]], Spike: [[0, 1, 0.3]], Tumble: [[0, 1, 0.5]], Helpless: [[0, 1, 0.2]], Held: [[0, 1, 0.3]], Down: [[0, 1, 0.3]] };
for (const k of ['Fsmash', 'Usmash', 'Dsmash', 'Fair', 'Bair', 'Uair', 'Shield', 'ShieldHit', 'UpB', 'UpLand']) GRIP[k] = [[0, 1, 1]];
const deg = { f1: 78, f2: 82, tp: 0, ty: 40 };
const hand = (c, sd) => ({ ['fing' + sd + '1']: R(0, 0, (sd === 'R' ? 1 : -1) * deg.f1 * c), ['fing' + sd + '2']: R(0, 0, (sd === 'R' ? 1 : -1) * deg.f2 * c), ['thumb' + sd]: R(deg.tp * c, (sd === 'R' ? 1 : -1) * deg.ty * c, 0) });
const lerp = (a, b, u) => a + (b - a) * u;
for (const [nm, clip] of Object.entries(C)) {
  const pts = GRIP[nm] || GRIP['*'], at = t => { const v = i => [pts[i][1], pts[i].length > 2 ? pts[i][2] : pts[i][1]];
    if (t <= pts[0][0]) return v(0); for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const u = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]), a = v(i - 1), c = v(i); return [lerp(a[0], c[0], u), lerp(a[1], c[1], u)]; } return v(pts.length - 1); };
  for (const key of clip.keys) { const [r, l] = at(key.t); key.pose = Object.assign({}, key.pose || {}, hand(r, 'R'), hand(l, 'L')); }
}
if (process.argv[2] === 'test') { for (const k of Object.keys(C)) delete C[k]; C.Test = keys([{ t: 0, use: 'stand' }, { t: 1, use: GD }, { t: 2, use: 'crouch' }, { t: 3, reset: true, use: AIR }], 30); }

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'rig.json'), JSON.stringify(spec, null, 1));
fs.writeFileSync(path.join(OUT, 'pack.json'), JSON.stringify({ base: 'work/vargan-rigged.glb', texture: 2048, out: 'export/vargan-v1.glb' }, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'pack-axe.json'), JSON.stringify({ base: 'work/axe.glb', texture: 1024, out: 'export/runebreaker.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + spec.bones.length + ' bones, ' + Object.keys(C).length + ' clips');
if (process.argv[2] === 'test') process.exit(0);

/* ---- the game's manifest entry ---- */
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const entry = { file: 'assets/vargan/export/vargan-v1.glb', height: 16, axe: { file: 'assets/vargan/export/runebreaker.glb', bone: 'axe', len: 1.55, hold: HOLD },
  clips: { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.18 }, brake: { clip: 'Land', from: 0.05, to: 0.42 }, jumpsquat: { clip: 'Squat', from: 0, to: 0.1 },
    rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' }, airjump: { clip: 'AirJump', from: 0, to: 0.48 }, helpless: { clip: 'Helpless' }, land: { clip: 'Land', from: 0, to: 0.42 }, landHard: { clip: 'LandHard', from: 0, to: 0.6 },
    shield: { clip: 'Shield', from: 0, to: 0.12 }, shieldHit: { clip: 'ShieldHit', from: 0, to: 0.3 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, hitHeavy: { clip: 'HitHeavy', from: 0, to: 0.8 }, launch: { clip: 'Launch', from: 0, to: 0.5 }, launchUp: { clip: 'LaunchUp', from: 0, to: 0.6 }, spike: { clip: 'Spike', from: 0, to: 0.6 },
    tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true }, airdodge: { clip: 'AirDodge', from: 0, to: 0.66 }, dodge: { clip: 'Dodge', from: 0, to: 0.42 }, roll: { clip: 'Roll', from: 0, to: 1.05 },
    ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, pummel: { clip: 'Pummel', from: 0, to: 0.3 }, respawn: { clip: 'Respawn' },
    throw: { clip: 'ThrowF', from: 0, to: fr(39) }, throw_f: { clip: 'ThrowF', from: 0, to: fr(39) }, throw_b: { clip: 'ThrowB', from: 0, to: fr(49) }, throw_u: { clip: 'ThrowU', from: 0, to: fr(43) }, throw_d: { clip: 'ThrowD', from: 0, to: fr(39) },
    upb: { clip: 'UpB', from: 0, to: 1 }, upbE: { clip: 'UpBE', from: 0, to: 1 } },
  /* the axe's arc while a blade hit is out (render3d bladeArc): from where the blade starts on the haft to the middle of its edge */
  blade: { base: 'axeHead', tip: 'axeTip', at: 0, dot: 0, col: 0xffa040, col2: 0xff3a10 },
  fire: { aura: ['chest', 'armR', 'armL', 'shinR', 'shinL', 'head'], fists: ['handR', 'handL'], feet: ['footR', 'footL'], shoulder: 'armR', axe: ['axeHead', 'axeTip'] },
  strikers: [{ bone: 'axeTip', ext: 0.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'handR', ext: 1.2 }, { bone: 'footR', ext: 1.6 }, { bone: 'footL', ext: 1.6 }],
  springs: [],
  attacks: { jab: AF('Jab', 7, 8, 26), ftilt: AF('Ftilt', 10, 12, 39), utilt: AF('Utilt', 7, 9, 31), dtilt: AF('Dtilt', 10, 12, 35), dash: AF('Dash', 10, 19, 37),
    fsmash: AF('Fsmash', 24, 27, 66), fsmashE: AF('FsmashE', 27, 29, 63), usmash: AF('Usmash', 20, 24, 61), usmashE: AF('UsmashE', 19, 22, 54), dsmash: AF('Dsmash', 16, 28, 61), dsmashE: AF('DsmashE', 16, 27, 55),
    nair: AF('Nair', 7, 26, 40), fair: AF('Fair', 17, 20, 48), fairE: AF('FairE', 14, 19, 44), bair: AF('Bair', 12, 14, 39), bairE: AF('BairE', 10, 12, 35), uair: AF('Uair', 11, 15, 39), uairE: AF('UairE', 8, 16, 33), dair: AF('Dair', 16, 18, 44),
    grab: AF('Grab', 8, 10, 38), dgrab: AF('GrabRun', 11, 13, 46), pgrab: AF('GrabTurn', 12, 14, 41), getup: AF('Getup', 16, 19, 40), ledgeatk: AF('LedgeAtk', 23, 25, 55),
    nspec: AF('Throw', 30, 30, 66), nspecE: AF('Beckon', 8, 8, 24), sspec: AF('Meteor', 15, 40, 57), uspec: AF('UpB', 10, 60, 60), uspecE: AF('UpBE', 10, 60, 60), uspecL: AF('UpLand', 1, 4, 36), uspecLE: AF('UpLandE', 1, 4, 36),
    dspec: AF('Counter', 8, 29, 67), dspecHit: AF('CounterHit', 4, 5, 34), dspecHitE: AF('CounterHitE', 4, 5, 34), berserk: AF('Berserk', 4, 4, 8), '*': AF('Jab', 7, 8, 26) } };
const mf = path.join(ROOT, 'assets', 'manifest.json'), cur = JSON.parse(fs.readFileSync(mf, 'utf8'));
cur.Vargan = entry; fs.writeFileSync(mf, JSON.stringify(cur, null, 1) + '\n'); console.log('manifest: ' + Object.keys(cur).join(', '));
