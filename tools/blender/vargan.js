// Writes the skeleton and animation spec for Fyrdsman the Ashbound (assets/vargan/work/rig.json), which tools/blender/rig.py
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
/* ---- the game's own numbers: load sim.js as the tests do and take Fyrdsman's moves ---- */
const MV = (() => {
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
  const g = { document: { getElementById: () => ({ getContext: () => ctx }) }, addEventListener() {}, requestAnimationFrame() {}, navigator: { getGamepads: () => [] }, localStorage: { getItem: () => null, setItem() {} }, console, Math, performance: { now: () => 0 } };
  g.window = g; vm.createContext(g);
  for (const f of ['hitboxes.js', 'sim.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), g, { filename: f });
  return vm.runInContext('ROSTER.find(d => d.name === "Fyrdsman").forms[0].moves', g);
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
const G = [-0.74, 0.915, 0.14], HOLD = 0.286, H0 = [0, 0, 1], E0 = [0, -1, 0];   /* the axe is 2.015 m (the owner asked for a bigger one: 1.3 x the first 1.55) */
const AXHEAD = add(G, H0, 1.3), AXTIP = add(add(G, H0, 1.47), E0, 0.43);   /* where the blade starts on the haft, and the middle of its edge */
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
  { name: 'c_foot' + s, head: P(J.ankle), tail: add(P(J.ankle), unit(sub(P(J.toe), P(J.ankle))).map(v => v * 0.12)), parent: 'all', deform: false }]; };   /* along the foot, so the foot can copy its turn (heel and toe) */
const spec = {
  note: 'Fyrdsman the Ashbound: metres, feet on y = 0, facing +Z, his right is -X. Joint positions measured from the owner\'s A-pose sculpt.',
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
    { name: 'c_axe', head: G, tail: add(G, H0, 0.3), parent: 'all', deform: false },
    /* secondary motion (render3d springs): the hair down the back of his head, the fur on his left shoulder, and the front
       and back flaps of his leather kilt. Each takes only the vertices in its own box (rigid, below), so the sculpt is not
       re-weighted anywhere else. */
    { name: 'hair', head: [0, 1.68, -0.15], tail: [0, 1.5, -0.2], parent: 'head' },
    { name: 'fur', head: [0.14, 1.6, -0.02], tail: [0.44, 1.6, -0.04], parent: 'chest' },
    { name: 'flapF', head: [0, 0.93, 0.17], tail: [0, 0.64, 0.21], parent: 'hips' },
    { name: 'flapB', head: [0, 0.9, -0.2], tail: [0, 0.64, -0.27], parent: 'hips' }],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
  copyrot: [{ bone: 'axe', from: 'c_axe' }, { bone: 'footR', from: 'c_footR' }, { bone: 'footL', from: 'c_footL' }],   /* the feet keep the sole where the pose puts it (flat unless turned), whatever the shin does */
  rigid: [{ bone: 'head', box: [[-0.15, 1.62, -0.17], [0.15, 1.96, 0.22]] }, { bone: 'axe', part: 'Axe', only: true },
    { bone: 'hair', box: [[-0.16, 1.5, -0.34], [0.16, 1.68, -0.13]], only: true }, { bone: 'fur', box: [[0.13, 1.56, -0.32], [0.5, 1.72, 0.2]], only: true },
    { bone: 'flapF', box: [[-0.08, 0.6, 0.11], [0.08, 0.9, 0.34]], only: true }, { bone: 'flapB', box: [[-0.12, 0.6, -0.36], [0.12, 0.86, -0.18]], only: true }],
  poses: {}, clips: {} };

/* ---- targets: absolute places in the model, as moves from where each control rests ---- */
const HR = (z, y, x) => M((x === undefined ? -0.34 : x) - J.wri[0], y - J.wri[1], z - J.wri[2]);
const HL = (z, y, x) => M((x === undefined ? 0.34 : x) + J.wri[0], y - J.wri[1], z - J.wri[2]);
/* feet: p turns the sole about the ankle, degrees (+ the toes down, - the toes up: a heel strike) */
const FR = (z, y, x, p) => Object.assign(M((x === undefined ? -0.19 : x) - J.ankle[0], y || 0, z - J.ankle[2]), p ? { rot: [p, 0, 0] } : {});
const FL = (z, y, x, p) => Object.assign(M((x === undefined ? 0.19 : x) + J.ankle[0], y || 0, z - J.ankle[2]), p ? { rot: [p, 0, 0] } : {});
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
/* the whole body turned (all: { p pitch, y yaw, m move }, as a pose's "all" does): a place in the world, given in the body's
   own frame, so a hold stays where the game's hit is however the body is turned (rot: yaw about up, then pitch) */
const rotX = (v, p) => { const c = Math.cos(p * Math.PI / 180), s = Math.sin(p * Math.PI / 180); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const rotY = (v, a) => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return [v[0] * c + v[2] * s, v[1], v[2] * c - v[0] * s]; };
const toBody = (q, A, pt) => rotX(rotY(pt && A.m ? sub(q, A.m) : q, -(A.y || 0)), -(A.p || 0));
/* the whole body pitched p degrees about a point cy up (its middle), and lifted: an "all" pose and the A for toBody */
const SPIN = (p, cy, up) => { const r = p * Math.PI / 180, m = [0, +(cy - cy * Math.cos(r) + (up || 0)).toFixed(4), +(-cy * Math.sin(r)).toFixed(4)]; return { rot: [p, 0, 0], move: m, A: { p, m } }; };
function axe(P, ang, es, o) {
  o = o || {}; const a = ang * Math.PI / 180; let d = [o.dx || 0, Math.sin(a), Math.cos(a)];
  let e = o.e || (es ? [0, Math.cos(a) * es, -Math.sin(a) * es] : [1, 0, 0]);
  if (o.all) { P = toBody(P, o.all, true); d = toBody(d, o.all); e = toBody(e, o.all); }
  const w = wrist(P, 0, o.hip), out = { c_axe: AIMT(d, e), c_handR: HR(w[2], w[1], w[0]) };
  if (o.two) { const P2 = add(P, unit(d), 0.3), w2 = wrist([P2[0] + 0.12, P2[1], P2[2]], 1, o.hip); out.c_handL = HL(w2[2], w2[1], w2[0]); }
  return out;
}
/* an axe hit from the game: its grip (H, from his feet) and angle, at depth x */
const AXHIT = (move, i, x, o) => { const h = MV[move].h.filter(q => q.ax)[i], [gx, gy, ang, es] = h.ax; return axe([x === undefined ? -0.28 : x, gy * HMOD, gx * HMOD], ang, es, o); };

/* ---- poses ---- */
const P = spec.poses, C = spec.clips;
/* Where Runebreaker rides when it is not in his hand: across his back, the pommel up behind his right shoulder (so the near
   hand takes it over the shoulder) and the head down behind his left hip, the blade flat to his back, edge out to his left.
   The game hangs its own copy of the axe there (render3d axeShow, manifest axe.back); the drawn axe takes over from it at
   the clip time each axe move gives (axe.armed), on a key where his hand is exactly at this grip. */
const BACK = { pommel: [-0.36, 2.08, -0.34], d: unit([0.6, -0.8, 0]), e: unit([0.8, 0.6, 0]) };
const BGRIP = add(BACK.pommel, BACK.d, HOLD);
const BG = hip => ({ c_axe: AIMT(BACK.d, BACK.e), c_handR: (w => HR(w[2], w[1], w[0]))(wrist(BGRIP, 0, hip)) });
/* B: a pose from short names. hp/hr the hips' move and turn, sp/ch/hd the spine, chest and head turns, R/L the wrists
   [z, y, x], fr/fl the ankles [z, y, x, sole pitch], ax an axe hold (axe(), AXHIT(), BG()), all the whole body. */
const B = o => {
  const r = {};
  if (o.hp || o.hr) r.hips = { move: o.hp || [0, 0, 0], rot: o.hr || [0, 0, 0] };
  if (o.sp) r.spine = R(...o.sp); if (o.ch) r.chest = R(...o.ch); if (o.hd) r.head = R(...o.hd);
  if (o.R) r.c_handR = HR(...o.R); if (o.L) r.c_handL = HL(...o.L);
  if (o.fr) r.c_footR = FR(...o.fr); if (o.fl) r.c_footL = FL(...o.fl);
  if (o.all) r.all = Array.isArray(o.all) ? R(...o.all) : { rot: o.all.rot, move: o.all.move };
  return Object.assign(r, o.ax || {});
};
const K = (t, o, e) => Object.assign({ t, pose: B(o) }, e ? { in: e } : {});
const keys = (list, fps) => ({ fps: fps || 60, keys: list });
P.stand = { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {}, c_axe: AIMT(BACK.d, BACK.e) };
/* the guard: a brawler's stance, wide and low, left foot and left fist leading, the right fist by the jaw, the axe on his back */
const GUARD_O = { hp: [0, -0.08, 0], hr: [0, -10, 0], sp: [6], ch: [6, -10], hd: [-6, 18], fl: [0.22, 0, 0.21], fr: [-0.2, 0, -0.25], L: [0.36, 1.36, 0.16], R: [0.16, 1.26, -0.22] };
P.guard = B(GUARD_O);
P.crouch = B({ hp: [0, -0.38, 0.02], hr: [8, -10, 0], sp: [18], ch: [10, -10], hd: [-20, 16], fl: [0.24, 0, 0.22], fr: [-0.2, 0, -0.27, 10], L: [0.4, 0.98, 0.16], R: [0.26, 0.92, -0.24] });
const AIR_O = { hp: [0, 0.02, 0], hr: [0, -6, 0], sp: [4], ch: [2, -6], hd: [-2, 8], fl: [0.12, 0.2, 0.18, 25], fr: [-0.08, 0.1, -0.2, 30], L: [0.3, 1.3, 0.22], R: [0.12, 1.22, -0.26] };
P.air = B(AIR_O);
P.tuck = B({ hp: [0, 0.06, 0], sp: [28], ch: [18], hd: [12], fl: [0.18, 0.4, 0.16, 20], fr: [0.14, 0.4, -0.16, 20], L: [0.32, 1.0, 0.2], R: [0.3, 0.98, -0.22] });
const GD = ['stand', 'guard'], AIR = ['stand', 'air'], back = { reset: true, use: GD }, backAir = { reset: true, use: AIR };
const GDK = (t, o, e) => Object.assign({ t, use: GD, pose: B(o || {}) }, e ? { in: e } : {});
const AIRK = (t, o, e) => Object.assign({ t, use: AIR, pose: B(o || {}) }, e ? { in: e } : {});
const BK = (t, e) => Object.assign({ t, ...back }, { in: e || 'quad' }), BKA = (t, e) => Object.assign({ t, ...backAir }, { in: e || 'quad' });

/* ---- polish helpers (pass 2): overlap, moving holds, settles, a carried draw ---- */
/* overlap: on a key with lag, the hips arrive on time and the trunk, head, arms and axe head that many frames later (the
   clip's own frames: 60 a second for attacks, 30 for the loops). Never on a contact key: the hit is where the hips are. */
const LAG = { spine: 1, chest: 1, head: 2, c_handR: 2, c_handL: 2, c_axe: 3 };
const LAG30 = { spine: 1, chest: 1, head: 1, c_handR: 1, c_handL: 1 };
const FT = (t, o, e, lag) => Object.assign(K(t, o, e), { lag: lag || LAG });
/* a recovery that lands: the weight drops through the guard (a dip, the arms a beat behind) and comes up into it with a
   little overshoot, instead of one glide back */
const DIP = { hp: [0, -0.15, 0.02], hr: [3, -9, 0], sp: [11], ch: [9, -9], hd: [-10, 16], L: [0.34, 1.3, 0.16], R: [0.16, 1.2, -0.22], fl: [0.22, 0, 0.21], fr: [-0.2, 0, -0.25] };
const SETTLE = (t0, t1, o) => [FT(t0, cat(DIP, o || {}), 'quad'), BK(t1, 'back')];
const DIPA = cat(AIR_O, { sp: [12], ch: [7, -6], hd: [-6, 8], fl: [0.16, 0.32, 0.18, 25], fr: [-0.02, 0.24, -0.2, 30], L: [0.3, 1.22, 0.24], R: [0.12, 1.14, -0.26] });
const SETTLEA = (t0, t1, o) => [FT(t0, cat(DIPA, o || {}), 'quad'), BKA(t1, 'back')];
/* the draw, carried: the hand pulls the pommel up off his back, the head swings back behind his shoulders (MIDAX), then up
   past his head (CARRY) into the move; the stow is the same in reverse. The swap from the back's axe to the hand's is on
   DRAW, where the hand's axe is exactly where the back's hangs. */
const MIDAX = hip => axe([-0.3, 1.8, -0.26], 180, 0, { e: unit([0.8, 0.6, 0]), dx: 0.3, hip });
const CARRY = hip => axe([-0.3, 1.9, 0.0], 100, -1, { hip });
const DRAWS = (t, o) => [DRAW(t, o), K(t + fr(2), cat(o && o.hp ? { hp: o.hp } : {}, { ax: MIDAX(o && o.hp) }), 'out')];
const STOW = (t0, t1, t2, o) => [K(t0, cat(o || {}, { ax: CARRY(o && o.hp) }), 'quad'), K(t1, { ch: [0, -4], hd: [-6, 12], ax: MIDAX(o && o.hp) }), DRAW(t2, o && o.hp ? { hp: o.hp } : undefined)];

/* ---- standing, moving ---- */
/* the idle: he breathes, the weight rolls onto the lead foot and back, a shoulder rolls, the fists re-grip (GRIP.Idle) */
C.Idle = keys([GDK(0),
  K(0.5, { hp: [0, -0.07, 0.005], hr: [0, -9, 0], ch: [3, -10], hd: [-8, 18], L: [0.37, 1.39, 0.16], R: [0.17, 1.29, -0.22] }),
  FT(1.0, { hp: [0.03, -0.09, 0], hr: [1, -14, 2], sp: [7], ch: [7, -12, -3], hd: [-5, 14], L: [0.36, 1.34, 0.18], R: [0.15, 1.23, -0.2] }, null, LAG30),
  K(1.5, { ch: [6, -8, 4], hd: [-6, 20, 2] }),
  K(1.9, { hp: [0, -0.07, 0.005], hr: [0, -9, 0], ch: [3, -10, 0], L: [0.37, 1.38, 0.15], R: [0.17, 1.28, -0.21] }),
  FT(2.5, { hp: [-0.03, -0.095, 0], hr: [-1, -6, -2], sp: [6], ch: [6, -7, 3], hd: [-7, 24], L: [0.35, 1.35, 0.17], R: [0.16, 1.25, -0.23] }, null, LAG30),
  K(3.1, { hd: [-4, 12, -2], ch: [4, -11, 0] }),
  K(3.6, GUARD_O)], 30);
/* now and then: the neck rolled, one fist ground into the other palm, a look at the opponent */
C.Idle2 = keys([GDK(0),
  K(0.4, { hd: [-2, 16, 14], ch: [4, -8] }), K(0.8, { hd: [-12, 22, -10] }),
  K(1.2, { hd: [-6, 18], L: [0.32, 1.22, 0.06], R: [0.3, 1.24, -0.06], ch: [8, -4] }),
  K(1.5, { R: [0.31, 1.23, -0.05], ch: [9, -2] }), K(1.8, { R: [0.3, 1.25, -0.07], ch: [8, -5] }),
  K(2.2, { hd: [-10, 30] }), K(2.8, GUARD_O)], 30);
/* walk and run: cycles keyed from the planted foot. The game turns one cycle per `stride` units walked (manifest), so the
   foot on the floor moves back exactly as fast as he moves forward. A: the foot that lands at the start (his right).
   zs stretches the stride (the feet's forward and back places). */
{ const cycle = (T, half, zs) => {   /* half: [u, poseA, poseB, rest] for 0 <= u < 0.5; the second half swaps the feet and the arms */
    const out = [];
    for (const side of [0, 1]) for (const [u, a, b, o] of half) {
      const fa = side ? 'fl' : 'fr', fb = side ? 'fr' : 'fl', xA = side ? 0.19 : -0.19, xB = -xA;
      const q = Object.assign({}, o); q[fa] = [a[0] * zs, a[1], xA, a[2]]; q[fb] = [b[0] * zs, b[1], xB, b[2]];
      if (side) { q.hr = [q.hr[0], -q.hr[1], q.hr[2]]; q.ch = [q.ch[0], -q.ch[1] + 2 * (o.chBase || 0), -(q.ch[2] || 0)]; const r = q.R, l = q.L; q.R = [l[0], l[1], -0.3]; q.L = [r[0], r[1], 0.3]; }
      delete q.chBase; out.push(K((u + side * 0.5) * T, q));
    }
    out.push(Object.assign({}, out[0], { t: T })); return out;
  };
  /* the walk: a long, heavy, rolling stride (a giant covers ground); the hips drop as the foot takes the weight and rise
     through the passing pose, the shoulders counter-turn and roll, the head holds level */
  C.Walk = keys(cycle(1.0, [
    [0.0, [0.36, 0, -18], [-0.34, 0.03, 28], { hp: [0, -0.08, 0], hr: [2, 9, 0], sp: [6], ch: [4, -9, -3], hd: [-3, 4], R: [-0.1, 1.05, -0.3], L: [0.34, 1.12, 0.3] }],
    [0.125, [0.18, 0, 0], [-0.12, 0.16, 22], { hp: [0, -0.13, 0], hr: [3, 6, 0], sp: [7], ch: [5, -6, -2], hd: [-1, 3], R: [-0.03, 1.02, -0.3], L: [0.29, 1.1, 0.3] }],
    [0.25, [0.0, 0, 0], [0.06, 0.19, 4], { hp: [0, -0.04, 0], hr: [1, 0, 0], sp: [5], ch: [3, 0, 0], hd: [-5, 0], R: [0.12, 1.06, -0.3], L: [0.14, 1.08, 0.3] }],
    [0.375, [-0.18, 0.02, 10], [0.28, 0.09, -14], { hp: [0, -0.05, 0], hr: [1, -5, 0], sp: [5], ch: [3, 5, 2], hd: [-5, -3], R: [0.27, 1.1, -0.3], L: [0.0, 1.04, 0.3] }]], 1.35), 30);
  /* the run: a big man's run, the lean coming from the hips, each landing taken through the knee, short heavy arm strokes,
     the shoulders rolling, the head steady */
  C.Run = keys(cycle(0.6, [
    [0.0, [0.42, 0, -10], [-0.3, 0.3, 40], { hp: [0, -0.15, 0.08], hr: [12, 10, 0], sp: [18], ch: [6, -12, -5], hd: [-22, 6], R: [-0.16, 1.06, -0.3], L: [0.36, 1.3, 0.3] }],
    [0.075, [0.08, 0, 0], [-0.05, 0.38, 30], { hp: [0, -0.23, 0.08], hr: [13, 6, 0], sp: [21], ch: [8, -8, -4], hd: [-24, 4], R: [-0.1, 1.02, -0.3], L: [0.32, 1.24, 0.3] }],
    [0.15, [-0.3, 0.04, 35], [0.3, 0.32, -5], { hp: [0, -0.08, 0.08], hr: [11, 0, 0], sp: [17], ch: [6, 0, 0], hd: [-21, 0], R: [0.1, 1.12, -0.3], L: [0.1, 1.12, 0.3] }],
    [0.3, [-0.42, 0.3, 45], [0.5, 0.16, -12], { hp: [0, -0.05, 0.08], hr: [11, -8, 0], sp: [17], ch: [6, 10, 5], hd: [-21, -5], R: [0.34, 1.3, -0.3], L: [-0.14, 1.06, 0.3] }]], 1), 30); }
C.Crouch = keys([GDK(0), Object.assign({ t: 0.18, use: 'crouch' }, { in: 'out' })], 30);
C.Squat = keys([GDK(0), K(0.1, { hp: [0, -0.26, 0], hr: [10, -6, 0], sp: [16], ch: [9, -6], hd: [-12, 10], L: [0.24, 1.0, 0.22], R: [0.12, 0.96, -0.26], fr: [-0.2, 0, -0.25, 0] }, 'out')], 30);
C.Rise = keys([AIRK(0, { hp: [0, 0.04, 0], sp: [-4], ch: [-6, -6], hd: [-10, 8], fr: [-0.14, 0.04, -0.2, 45], fl: [0.08, 0.06, 0.18, 35], L: [0.26, 1.5, 0.24], R: [0.1, 1.42, -0.28] }),
  K(0.22, { sp: [2], fr: [-0.1, 0.18, -0.2, 35], fl: [0.12, 0.24, 0.18, 25], L: [0.3, 1.36, 0.22], R: [0.12, 1.28, -0.26] }), K(0.4, { fr: [-0.08, 0.12, -0.2, 30], fl: [0.12, 0.22, 0.18, 25] })], 30);
/* falling: a slow loop, the arms paddling for balance and the legs cycling a little */
C.Fall = keys([AIRK(0, { ch: [6, -6], L: [0.24, 1.42, 0.32], R: [0.04, 1.36, -0.34] }),
  K(0.3, { ch: [4, -3, 3], fr: [-0.06, 0.14, -0.2, 30], fl: [0.14, 0.26, 0.18, 20], L: [0.32, 1.52, 0.4], R: [-0.02, 1.3, -0.36] }),
  K(0.6, { ch: [7, -9, -3], fr: [-0.1, 0.08, -0.2, 34], fl: [0.1, 0.18, 0.18, 24], L: [0.18, 1.34, 0.3], R: [0.1, 1.46, -0.4] }),
  K(0.9, { ch: [6, -6, 0], L: [0.24, 1.42, 0.32], R: [0.04, 1.36, -0.34], fr: [-0.08, 0.1, -0.2, 30], fl: [0.12, 0.2, 0.18, 25] })], 30);
C.FastFall = keys([AIRK(0, { sp: [-4], ch: [-4, -6], hd: [-8, 6], fr: [-0.04, 0.04, -0.2, 40], fl: [0.04, 0.04, 0.18, 40], L: [0.0, 1.62, 0.34], R: [-0.06, 1.58, -0.34] }),
  K(0.15, { L: [0.04, 1.68, 0.38], R: [-0.1, 1.54, -0.36], ch: [-4, -4, 2] }), K(0.3, { L: [0.0, 1.62, 0.34], R: [-0.06, 1.58, -0.34], ch: [-4, -6, 0] })], 30);
C.AirJump = keys([AIRK(0, { sp: [22], ch: [12, -4], fr: [-0.06, 0.44, -0.2, 20], fl: [0.12, 0.46, 0.18, 20], L: [0.32, 1.0, 0.22], R: [0.28, 0.98, -0.24] }),
  K(0.16, { sp: [-6], ch: [-6, -6], hd: [-10, 6], fr: [-0.16, 0.0, -0.2, 50], fl: [0.02, 0.04, 0.18, 45], L: [0.2, 1.62, 0.3], R: [0.02, 1.55, -0.32] }, 'out'), Object.assign(AIRK(0.48), { in: 'quad' })], 30);
C.Helpless = keys([AIRK(0, { hd: [-8, 0, 6], L: [-0.1, 1.55, 0.42], R: [-0.14, 1.5, -0.42] }), K(0.25, { hd: [-8, 0, -6], fr: [0.12, 0.2, -0.2, 20], fl: [-0.04, 0.06, 0.18, 40] }), K(0.5, { hd: [-8, 0, 6], fr: [-0.06, 0.06, -0.2, 40], fl: [0.12, 0.22, 0.18, 20] })], 30);
/* landings: the hips take the weight a frame after the feet, sink past the guard, and come back up through it with a settle */
C.Land = keys([Object.assign({ t: 0, use: ['stand', 'crouch'] }), K(0.07, { hp: [0, -0.32, 0.02], hr: [10, -8, 0], sp: [17], ch: [11, -10], hd: [-16, 14] }, 'out'), FT(0.2, { hp: [0, -0.17, 0], hr: [4, -10, 0], sp: [10], ch: [7, -10] }, null, LAG30), BK(0.42, 'back')], 30);
C.LandHard = keys([Object.assign({ t: 0, use: ['stand', 'crouch'] }), K(0.08, { hp: [0, -0.5, 0.04], hr: [14, -8, 0], sp: [32], ch: [17, -10], hd: [-26, 12], L: [0.5, 0.48, 0.28], R: [0.4, 0.4, -0.3] }, 'out'), FT(0.3, { hp: [0, -0.3, 0.02], sp: [20], ch: [12, -10], L: [0.42, 0.9, 0.2], R: [0.3, 0.86, -0.26] }, null, LAG30), BK(0.6, 'back')], 30);
/* the shield: forearms crossed in front of his face, braced low */
const SH = { hp: [0, -0.16, -0.02], hr: [4, -14, 0], sp: [12], ch: [8, -16], hd: [6, 20], L: [0.42, 1.48, 0.0], R: [0.4, 1.42, -0.06], fr: [-0.24, 0, -0.27, 0], fl: [0.24, 0, 0.22] };
C.Shield = keys([GDK(0), K(0.1, SH, 'out')], 30);
C.ShieldHit = keys([GDK(0, Object.assign({}, SH, { hp: [0, -0.18, -0.1], sp: [2], ch: [0, -16], L: [0.34, 1.5, 0.0], R: [0.32, 1.44, -0.06] })), K(0.3, SH)], 30);
/* ---- being hit: the head and chest snap first, the arms fly after them, then he gathers himself. From the front he is
   driven back; from behind (anim.js hitBack) he is thrown forward over his own hips, arms flung back ---- */
C.Hit = keys([GDK(0, { hp: [0, -0.04, -0.1], hr: [-6, -10, 0], sp: [-14], ch: [-12, -14], hd: [-20, 10], L: [0.0, 1.34, 0.42], R: [-0.06, 1.3, -0.4], fl: [0.32, 0.06, 0.2, -20] }),
  K(0.1, { sp: [-16], hd: [-24, 14], L: [-0.08, 1.4, 0.46], R: [-0.12, 1.36, -0.44] }, 'out'), FT(0.32, { sp: [-6], ch: [-4, -12], hd: [-8, 16], L: [0.2, 1.3, 0.3], R: [0.08, 1.24, -0.3] }, null, LAG30), BK(0.6, 'back')], 30);
C.HitHeavy = keys([GDK(0, { hp: [0, -0.06, -0.16], hr: [-10, -10, 0], sp: [-22], ch: [-18, -8], hd: [-28, 6], L: [-0.12, 1.5, 0.5], R: [-0.16, 1.44, -0.5], fl: [0.38, 0.1, 0.2, -25] }),
  K(0.12, { sp: [-26], hd: [-32, 8], L: [-0.2, 1.58, 0.52], R: [-0.24, 1.5, -0.52] }, 'out'), K(0.3, { hp: [0, -0.12, -0.12], sp: [-14], fr: [-0.42, 0, -0.25, -15] }), FT(0.5, { hp: [0, -0.16, -0.04], sp: [4], ch: [-2, -10], hd: [-10, 12], L: [0.24, 1.2, 0.3], R: [0.1, 1.14, -0.3] }, null, LAG30), BK(0.8, 'back')], 30);
C.HitBack = keys([GDK(0, { hp: [0, -0.06, 0.1], hr: [8, 10, 0], sp: [20], ch: [14, 10], hd: [18, -10], L: [-0.3, 1.3, 0.45], R: [-0.36, 1.24, -0.45], fr: [-0.34, 0.06, -0.22, -20] }),
  K(0.1, { sp: [24], hd: [22, -12], L: [-0.4, 1.38, 0.48], R: [-0.44, 1.32, -0.48] }, 'out'), FT(0.32, { sp: [10], ch: [6, -4], hd: [-4, 10], L: [0.2, 1.3, 0.3], R: [0.08, 1.24, -0.3] }, null, LAG30), BK(0.6, 'back')], 30);
C.HitHeavyBack = keys([GDK(0, { hp: [0, -0.1, 0.18], hr: [12, 12, 0], sp: [30], ch: [20, 8], hd: [24, -8], L: [-0.42, 1.36, 0.52], R: [-0.48, 1.3, -0.52], fr: [-0.42, 0.1, -0.22, -25] }),
  K(0.12, { sp: [34], hd: [28, -8], L: [-0.5, 1.46, 0.54], R: [-0.56, 1.4, -0.54] }, 'out'), K(0.3, { hp: [0, -0.16, 0.14], sp: [22], fl: [0.46, 0, 0.21, -15] }), FT(0.5, { hp: [0, -0.16, 0.04], sp: [10], ch: [6, -8], hd: [-8, 12], L: [0.24, 1.2, 0.3], R: [0.1, 1.14, -0.3] }, null, LAG30), BK(0.8, 'back')], 30);
/* launched: arms and legs flailing as he flies */
C.Launch = keys([AIRK(0, { sp: [-24], ch: [-18], hd: [-28], L: [-0.24, 1.55, 0.52], R: [-0.28, 1.5, -0.52], fl: [0.3, 0.3, 0.2, 30], fr: [0.2, 0.2, -0.2, 30] }),
  K(0.1, { sp: [-28], hd: [-32], L: [-0.1, 1.75, 0.5], R: [-0.4, 1.3, -0.56], fl: [0.4, 0.4, 0.2, 20], fr: [0.0, 0.1, -0.2, 40] }, 'out'),
  K(0.2, { L: [-0.4, 1.3, 0.56], R: [-0.1, 1.72, -0.5], fl: [0.1, 0.12, 0.2, 40], fr: [0.38, 0.42, -0.2, 20], ch: [-14, 6] }),
  K(0.32, { sp: [-16], L: [-0.08, 1.7, 0.5], R: [-0.36, 1.36, -0.54], fl: [0.36, 0.38, 0.2, 25], fr: [0.04, 0.12, -0.2, 40], ch: [-12, -6] }),
  K(0.5, { sp: [-10], ch: [-8, 0] })], 30);
C.LaunchUp = keys([AIRK(0, { sp: [-10], ch: [-12], hd: [-30], L: [0.0, 1.0, 0.52], R: [0.0, 0.96, -0.52], fl: [0.0, 0.0, 0.25, 45], fr: [0.0, 0.0, -0.25, 45] }), K(0.3, { L: [0.1, 1.2, 0.56], R: [-0.1, 0.9, -0.5], hd: [-20] }), K(0.6, { sp: [0], hd: [-10] })], 30);
C.Spike = keys([AIRK(0, { sp: [30], ch: [20], hd: [20], L: [0.0, 1.72, 0.42], R: [-0.04, 1.68, -0.42], fl: [-0.1, 0.4, 0.2, 30], fr: [-0.2, 0.3, -0.2, 30] }), K(0.6, { sp: [14], ch: [10] })], 30);
/* tumbling: tucked, turning end over end about his middle */
{ const T = AIRK(0, { sp: [30], ch: [20], hd: [12], fl: [0.18, 0.42, 0.16, 20], fr: [0.14, 0.4, -0.16, 20], L: [0.32, 1.0, 0.2], R: [0.3, 0.98, -0.22] });
  T.pose.all = (s => ({ rot: s.rot, move: s.move }))(SPIN(0, 1.0));
  C.Tumble = keys([T, ...[1, 2, 3, 4].map(k => K(0.22 * k, { all: SPIN(-90 * k, 1.0) }, 'lin'))], 30); }
C.Down = keys([{ t: 0, use: 'stand', pose: B({ all: [-50] }) }, K(0.3, { all: { rot: [-90, 0, 0], move: [0, 0.3, 0.95] }, L: [-0.05, 1.05, 0.52], R: [-0.05, 1.0, -0.52], hd: [-8] }, 'out')], 30);
/* ---- dodges, ledge, grabs ---- */
C.Dodge = keys([GDK(0), K(0.12, { all: [0, 30], hp: [0, -0.12, -0.2], hr: [0, -10, 0], sp: [-12], ch: [-8, -12], L: [0.2, 1.5, 0.2], R: [0.0, 1.45, -0.3] }, 'out'), BK(0.42, 'back')], 30);
C.Roll = keys([{ t: 0, use: ['stand', 'tuck'] }, K(0.5, { sp: [32] }), K(0.9, { sp: [26] }), BK(1.05, 'back')], 30);
C.AirDodge = keys([AIRK(0), K(0.1, { sp: [18], ch: [12], hd: [12], fl: [0.1, 0.34, 0.18, 30], fr: [0.06, 0.32, -0.18, 30], L: [0.24, 1.18, 0.14], R: [0.22, 1.14, -0.16] }, 'out'), K(0.5, { sp: [10] }), BKA(0.66)], 30);
C.Ledge = keys([{ t: 0, use: 'stand', pose: B({ ch: [-4], hd: [-12], L: [0.25, 2.0, 0.15], R: [0.1, 0.9, -0.36], fl: [0.06, 0, 0.18, 20], fr: [-0.04, 0.06, -0.18, 30] }) },
  K(0.7, { fl: [-0.04, 0.06, 0.18, 30], fr: [0.04, 0, -0.18, 20], R: [0.12, 0.92, -0.36] }), K(1.4, { fl: [0.06, 0, 0.18, 20], fr: [-0.04, 0.06, -0.18, 30], R: [0.1, 0.9, -0.36] })], 30);   /* one hand on the lip, the other hanging */
/* holding: his right hand on the opponent's collar, the left fist cocked */
const HOLD_O = { hr: [0, 6, 0], ch: [6, 12], R: [0.62, 1.16, -0.08], L: [0.1, 1.3, 0.24] };
C.Hold = keys([GDK(0, HOLD_O), K(0.3, { ch: [8, 14] }), K(0.6, { ch: [6, 12] })], 30);
/* Knuckle Crush: the left fist hooks in short, the grip kept */
C.Pummel = keys([GDK(0, HOLD_O), K(0.06, { ch: [4, -6], L: [-0.02, 1.34, 0.3] }), K(0.12, { ch: [10, 26], L: [0.6, 1.2, 0.02] }, 'snap'), K(0.16, { L: [0.58, 1.22, 0.04] }), K(0.3, HOLD_O, 'quad')], 30);
C.Held = keys([AIRK(0, { hp: [0, 0.06, 0], hd: [-10], L: [0.15, 1.42, 0.3], R: [0.15, 1.4, -0.3] }), K(0.25, { fl: [0.1, 0.16, 0.18, 30], fr: [-0.05, 0.06, -0.18, 30] }), K(0.5, { fl: [-0.06, 0.08, 0.18, 30], fr: [0.12, 0.16, -0.18, 30] })], 30);
/* Iron Heave: a step in and both palms drive him away */
C.ThrowF = keys([GDK(0, HOLD_O), K(fr(8), { hp: [0, -0.12, -0.06], hr: [0, -18, 0], ch: [4, -16], fr: [-0.32, 0, -0.25, 15], R: [0.36, 1.12, -0.12], L: [0.38, 1.1, 0.12] }),
  K(fr(13), { hp: [0, -0.14, 0.18], hr: [4, 14, 0], sp: [14], ch: [10, 18], hd: [-12, -10], R: [0.95, 1.15, -0.1], L: [0.95, 1.13, 0.1], fr: [-0.32, 0.02, -0.25, 30] }, 'snap'),
  K(fr(16), { R: [0.98, 1.16, -0.1], L: [0.98, 1.14, 0.1] }), FT(fr(24), { hp: [0, -0.1, 0.1], ch: [8, 6], R: [0.5, 1.15, -0.2], L: [0.5, 1.15, 0.2], fr: [-0.2, 0, -0.25] }, 'out'), ...SETTLE(fr(30), fr(39))]);
/* Shoulder Sling: he hauls him round over his shoulder and hurls him behind, the turn spread so it reads */
C.ThrowB = keys([GDK(0, HOLD_O), K(fr(6), { all: [0, -30], hp: [0, -0.1, 0], ch: [4, 24], R: [0.45, 1.3, -0.06], L: [0.38, 1.28, 0.1] }),
  K(fr(9), { all: [0, -70], hp: [0, -0.12, 0], ch: [2, 30], R: [0.4, 1.45, -0.06], L: [0.35, 1.4, 0.1] }),
  K(fr(12), { all: [0, -120], hp: [0, -0.08, 0], sp: [-6], ch: [-6, 10], hd: [-10], R: [0.1, 1.7, -0.1], L: [0.1, 1.66, 0.1] }),
  K(fr(14), { all: [0, -170], hp: [0, -0.06, 0], sp: [-10], ch: [-12, -16], hd: [-14], R: [-0.2, 1.75, -0.12], L: [-0.15, 1.7, 0.1] }, 'snap'),
  FT(fr(19), { all: [0, -178], R: [-0.4, 1.4, -0.12], L: [-0.35, 1.35, 0.1], sp: [8] }, 'out'), K(fr(30), { all: [0, -180], sp: [4] }), BK(fr(49))]);
/* Sky Hurl: a deep squat, then both arms heave him straight up and the head follows him */
C.ThrowU = keys([GDK(0, HOLD_O), K(fr(8), { hp: [0, -0.3, 0], sp: [16], ch: [8], R: [0.4, 0.88, -0.1], L: [0.4, 0.88, 0.1] }),
  K(fr(13), { hp: [0, 0.04, 0], sp: [-8], ch: [-10], hd: [-32], R: [0.18, 2.05, -0.1], L: [0.18, 2.05, 0.1], fr: [-0.2, 0.04, -0.25, 30], fl: [0.22, 0.04, 0.21, 30] }, 'snap'),
  K(fr(17), { R: [0.18, 2.1, -0.1], L: [0.18, 2.1, 0.1] }), FT(fr(24), { hd: [-24], fr: [-0.2, 0, -0.25], fl: [0.22, 0, 0.21], R: [0.3, 1.7, -0.14], L: [0.3, 1.7, 0.14] }, 'out'), ...SETTLE(fr(33), fr(43))]);
/* Stonebreaker: both fists lifted together overhead, then a hammer blow driving him into the floor */
C.ThrowD = keys([GDK(0, HOLD_O), K(fr(10), { hp: [0, -0.04, 0], ch: [-10, 0], hd: [-12], R: [0.35, 1.85, -0.06], L: [0.35, 1.85, 0.06] }),
  K(fr(20), { hp: [0, 0, -0.04], ch: [-14], R: [0.25, 2.0, -0.06], L: [0.25, 2.0, 0.06] }),
  K(fr(23), { hp: [0, -0.44, 0.06], hr: [12, 0, 0], sp: [34], ch: [16], hd: [-30], R: [0.62, 0.2, -0.06], L: [0.62, 0.2, 0.06] }, 'snap'),
  K(fr(27), { hp: [0, -0.46, 0.06] }), FT(fr(31), { hp: [0, -0.3, 0.02], sp: [20], R: [0.5, 0.5, -0.12], L: [0.5, 0.5, 0.12] }, 'out'), BK(fr(39), 'back')]);
C.Respawn = keys([GDK(0, { hd: [-6, 10], L: [0.3, 1.24, 0.08], R: [0.3, 1.26, -0.08] }), K(1.2, { hd: [-8, -6] }), K(2.4, { hd: [-6, 10] })], 30);

/* ---- attacks: keyed on the game's frames (n / 60); each maps one to one onto its move ---- */
const AF = (clip, a0, a1, t, extra) => Object.assign({ clip, start: 0, contact: [fr(a0), fr(a1 + 1)], end: fr(t) }, extra || {});
/* the draw: the right hand goes up over his shoulder (reach), takes the axe exactly where it rides (draw), and the stow puts it back */
const REACH = { R: [-0.12, 1.66, -0.24], ch: [0, -4], hd: [-6, 12] };
const DRAW = (t, o) => K(t, Object.assign({ hp: [0, -0.06, 0], hr: [0, 0, 0], sp: [0], ch: [0], ax: BG([0, -0.06, 0]) }, o || {}));
/* Iron Straight: the rear (right) fist straight down the middle on 7 and 8, the rear heel turning, the lead fist guarding the
   chin; the fist carries a little past, the shoulder rolls back and he steps back into his guard */
C.Jab = keys([GDK(0),
  K(fr(3), { hr: [0, -18, 0], ch: [6, -20], R: [0.1, 1.28, -0.22], fr: [-0.2, 0, -0.25, 0] }),
  K(fr(5), { hp: [0, -0.1, 0.06], hr: [2, 0, 0], ch: [8, 4], R: [0.5, 1.3, -0.14], L: [0.3, 1.42, 0.14] }),
  K(fr(7), { hp: [0, -0.12, 0.14], hr: [4, 18, 0], sp: [10], ch: [10, 26], hd: [-8, -20], R: [1.0, 1.28, -0.02], L: [0.28, 1.44, 0.14], fr: [-0.24, 0.03, -0.25, 25] }, 'snap'),
  K(fr(9), { ch: [12, 30], R: [1.04, 1.27, 0.0] }),
  FT(fr(11), { ch: [13, 33], hd: [-8, -23], R: [1.06, 1.26, 0.02] }, 'out'),
  FT(fr(14), { hr: [3, 10, 0], ch: [9, 12, -4], R: [0.6, 1.32, -0.14], L: [0.32, 1.42, 0.15] }, 'quad'),
  K(fr(18), { hp: [0, -0.1, 0.0], hr: [1, -6, 0], ch: [7, -8, 0], R: [0.22, 1.3, -0.2], fr: [-0.24, 0, -0.25, -8], L: [0.37, 1.38, 0.16] }),
  ...SETTLE(fr(21), fr(26))]);
/* Iron Push Kick: the weight rocks onto the lead foot, the near (rear) knee chambers and the boot drives out sole-first at
   hip height (10 to 12), held out with the planted leg working to 19, rechambered and set down behind with a heel strike */
C.Ftilt = keys([GDK(0),
  K(fr(3), { hp: [0, -0.06, -0.06], hr: [-4, 10, 0], sp: [-4], ch: [-4, -4], hd: [0, 20], fl: [0.24, 0, 0.21, 0], R: [-0.1, 1.5, -0.38], L: [0.36, 1.46, 0.2] }),
  K(fr(7), { hp: [0, -0.02, -0.06], hr: [-6, 18, 0], sp: [-10], fr: [0.4, 0.58, -0.2, -15], R: [-0.24, 1.4, -0.4] }, 'out'),
  K(fr(10), { hp: [0, -0.04, -0.08], hr: [-8, 30, 0], sp: [-20], ch: [-10, -10], hd: [6, 16], fr: [1.4, 0.8, -0.14, -70], R: [-0.36, 1.32, -0.42], L: [0.42, 1.36, 0.26] }, 'snap'),
  K(fr(12), { fr: [1.46, 0.82, -0.14, -70] }),
  K(fr(15), { hp: [0, -0.05, -0.08], sp: [-19], ch: [-9, -12], fr: [1.43, 0.8, -0.14, -66], L: [0.44, 1.34, 0.25], fl: [0.24, 0, 0.21, 4] }),
  K(fr(19), { hr: [-7, 28, 0], sp: [-17], fr: [1.36, 0.74, -0.14, -60], fl: [0.24, 0, 0.21, 0] }),
  FT(fr(25), { hp: [0, -0.06, -0.04], hr: [-2, 12, 0], sp: [-8], ch: [-4, -6], fr: [0.46, 0.44, -0.2, -10], R: [-0.08, 1.36, -0.32] }, 'out'),
  K(fr(30), { hp: [0, -0.15, 0.0], hr: [4, -8, 0], sp: [8], fr: [-0.2, 0, -0.25, -12], R: [0.1, 1.24, -0.24] }, 'quad'),
  ...SETTLE(fr(33), fr(39))]);
/* Technical Uppercut: the knees load and the hips wind, then foot, hips and trunk turn up together and the bent rear arm
   drives the fist up the middle (7 to 9) onto his toes; he comes down onto his heels */
C.Utilt = keys([GDK(0),
  K(fr(3), { hp: [0, -0.2, 0.02], hr: [8, -18, 0], sp: [12], ch: [12, -18], hd: [-6, 20], R: [0.26, 0.98, -0.24] }),
  K(fr(5), { hp: [0, -0.12, 0.04], hr: [4, -4, 0], sp: [6], ch: [4, 0], R: [0.42, 1.24, -0.16] }),
  K(fr(7), { hp: [0, -0.01, 0.06], hr: [-4, 18, 0], sp: [-8], ch: [-10, 24], hd: [-22, -8], R: [0.5, 1.86, -0.06], L: [0.3, 1.42, 0.16], fr: [-0.22, 0.04, -0.25, 30] }, 'snap'),
  K(fr(9), { R: [0.48, 1.93, -0.05], hd: [-26, -8] }),
  FT(fr(12), { hp: [0, 0.02, 0.06], ch: [-12, 28], hd: [-28, -10], R: [0.46, 1.98, -0.04], fr: [-0.22, 0.07, -0.25, 42], fl: [0.22, 0.03, 0.21, 20] }, 'out'),
  FT(fr(17), { hp: [0, -0.06, 0.04], hr: [-2, 10, 0], ch: [-6, 14], R: [0.42, 1.6, -0.1], fr: [-0.22, 0.02, -0.25, 15] }, 'quad'),
  K(fr(21), { hp: [0, -0.14, 0.02], ch: [3, -2], R: [0.28, 1.34, -0.18], fr: [-0.2, 0, -0.25, -6], fl: [0.22, 0, 0.21, 0] }),
  ...SETTLE(fr(24), fr(31))]);
/* Low Sweep Kick: he drops and turns into it, the right hand planted on the floor behind, the lead boot sweeping out along
   the floor (10 to 12) and held there with the hips and the planted hand still working, then scraped back through the crouch */
C.Dtilt = keys([GDK(0),
  K(fr(4), { hp: [0, -0.3, -0.04], hr: [10, -30, 0], sp: [20], ch: [12, -26], hd: [-10, 30], R: [-0.3, 0.4, -0.42], L: [0.3, 0.95, 0.3] }),
  K(fr(7), { hp: [0, -0.46, -0.08], fl: [0.42, 0.16, 0.2, -10], R: [-0.44, 0.13, -0.46] }),
  K(fr(10), { hp: [0, -0.5, -0.1], hr: [-6, -24, 0], sp: [-6], ch: [-4, -20], hd: [8, 24], fl: [1.52, 0.1, 0.16, -50], fr: [-0.24, 0, -0.27, 20], R: [-0.46, 0.13, -0.48], L: [0.42, 0.92, 0.32] }, 'snap'),
  K(fr(12), { fl: [1.57, 0.08, 0.16, -50] }),
  K(fr(17), { hp: [0.02, -0.52, -0.1], ch: [-3, -23], hd: [8, 27], L: [0.44, 0.88, 0.34], fl: [1.54, 0.09, 0.16, -48], R: [-0.47, 0.13, -0.47] }),
  K(fr(24), { hp: [0, -0.49, -0.08], hr: [-4, -20, 0], ch: [-5, -18], hd: [6, 22], fl: [1.42, 0.1, 0.16, -40] }),
  FT(fr(29), { hp: [0, -0.44, -0.04], hr: [4, -18, 0], sp: [10], fl: [0.8, 0.02, 0.18, -25], R: [-0.3, 0.32, -0.42] }, 'quad'),
  Object.assign({ t: fr(33), use: 'crouch', in: 'quad' }), BK(fr(37), 'back')]);
/* Charging Forearm: he drops his weight and runs in low, right shoulder first with the forearm across his chest, slams in
   (10 to 12), keeps driving with the legs churning (to 19), and skids two steps to a stop on his heels */
C.Dash = keys([GDK(0, { sp: [10], hp: [0, -0.1, 0.04] }),
  K(fr(4), { hp: [0, -0.18, 0.06], hr: [10, 20, 0], sp: [28], ch: [12, 34], hd: [-24, -40], R: [0.32, 1.26, 0.06], L: [-0.28, 1.1, 0.34], fr: [-0.46, 0.06, -0.2, 35], fl: [0.34, 0.12, 0.2, 0] }),
  K(fr(10), { hp: [0, -0.18, 0.3], hr: [12, 26, 0], sp: [36], ch: [14, 44], hd: [-30, -48], R: [0.62, 1.22, 0.04], L: [-0.36, 1.06, 0.36], fl: [0.68, 0, 0.18, 0], fr: [-0.52, 0.2, -0.2, 45] }, 'snap'),
  K(fr(13), { hp: [0, -0.2, 0.34], R: [0.66, 1.2, 0.04] }),
  K(fr(16), { hp: [0, -0.17, 0.34], fl: [0.5, 0.14, 0.18, 10], fr: [-0.1, 0, -0.2, 0] }),
  K(fr(19), { hp: [0, -0.22, 0.32], fl: [0.7, 0, 0.18, 0], fr: [-0.5, 0.16, -0.2, 40] }),
  FT(fr(23), { hp: [0, -0.26, 0.2], hr: [10, 12, 0], sp: [26], ch: [10, 18], hd: [-20, -14], fl: [0.72, 0, 0.18, -25], fr: [-0.3, 0.05, -0.22, 10], R: [0.5, 1.05, -0.16], L: [0.3, 1.0, 0.34] }, 'out'),
  K(fr(27), { hp: [0, -0.22, 0.14], sp: [18], fl: [0.64, 0, 0.18, -20], fr: [-0.24, 0, -0.22, 0] }),
  ...SETTLE(fr(31), fr(37))]);
/* ---- smashes ---- */
/* Axe Execution: the axe carried off his back over the shoulder and lowered behind it, base wide, knees compressed (held while
   charging, 15, with a shake: manifest chargeShake); the hips turn first and pull the chest, the chest pulls the arms and the
   blade comes last on a real arc across the chest (24 to 27); the torso over-rotates after it with the axe dragging, and the
   follow-through flows straight into the stow */
{ const h0 = [0, -0.14, 0.24];
  C.Fsmash = keys([GDK(0),
    K(fr(3), REACH), ...DRAWS(fr(5)),
    K(fr(10), { hp: [0, -0.12, -0.12], hr: [0, -24, 0], sp: [-4], ch: [-6, -40], hd: [-4, 52], fl: [0.3, 0, 0.24], fr: [-0.34, 0, -0.29], ax: axe([-0.2, 1.3, -0.3], 160, -1, { two: true, hip: [0, -0.12, -0.12] }) }),
    K(fr(15), { hp: [0, -0.17, -0.14], hr: [4, -28, 0], ch: [-8, -46], hd: [-4, 58], ax: axe([-0.2, 1.3, -0.34], 170, -1, { two: true, hip: [0, -0.17, -0.14] }) }, 'out'),
    K(fr(19), { hp: [0, -0.15, -0.06], hr: [3, -2, 0], ch: [-6, -42], ax: axe([-0.24, 1.32, -0.3], 165, -1, { two: true, hip: [0, -0.15, -0.06] }) }),
    K(fr(22), { hp: [0, -0.14, 0.08], hr: [4, 20, 0], sp: [6], ch: [2, -14], hd: [-6, 20], ax: axe([-0.5, 1.2, 0.1], 120, -1, { two: true, dx: -0.3, hip: [0, -0.14, 0.08] }) }, 'snap'),
    K(fr(23), { hp: [0, -0.14, 0.18], hr: [5, 26, 0], sp: [10], ch: [8, 4], hd: [-8, -6], ax: axe([-0.36, 1.18, 0.5], 60, -1, { two: true, dx: -0.15, hip: [0, -0.14, 0.18] }) }),
    K(fr(24), { hp: h0, hr: [6, 30, 0], sp: [14], ch: [14, 16], hd: [-10, -26], fl: [0.46, 0, 0.24], fr: [-0.38, 0.04, -0.29, 30], ax: AXHIT('fsmash', 0, -0.12, { two: true, hip: h0 }) }, 'snap'),
    K(fr(27), { ch: [14, 32], ax: AXHIT('fsmash', 0, -0.06, { two: true, hip: h0 }) }),
    FT(fr(31), { hr: [6, 40, 0], ch: [12, 58], hd: [-8, -50], ax: axe([0.2, 1.1, 0.6], 20, -1, { two: true, dx: 0.4, hip: h0 }) }, 'out'),
    K(fr(37), { ch: [11, 64], ax: axe([0.26, 1.08, 0.56], 12, -1, { two: true, dx: 0.45, hip: h0 }) }),
    FT(fr(45), { hp: [0, -0.12, 0.08], hr: [2, 6, 0], sp: [8], ch: [7, 10], hd: [-6, 4], fr: [-0.3, 0, -0.27], ax: axe([-0.1, 1.25, 0.4], 70, -1, { two: true, hip: [0, -0.12, 0.08] }) }, 'quad'),
    ...STOW(fr(50), fr(54), fr(58), { hp: [0, -0.1, 0.04], L: [0.36, 1.36, 0.16] }),
    ...SETTLE(fr(61), fr(66))]); }
/* Rising Axe Cleave: drawn, then the head low by the rear knee in both hands (held, 12), up through the front (20, 22) to
   overhead (24) fast, up onto his toes with the trunk arching after it; the axe drops down in front with his weight, then
   back over his shoulder */
C.Usmash = keys([GDK(0),
  K(fr(2), REACH), ...DRAWS(fr(4)),
  K(fr(8), { hp: [0, -0.3, 0], hr: [8, -14, 0], sp: [18], ch: [10, -24], hd: [-16, 30], ax: axe([-0.52, 0.8, -0.1], 198, -1, { two: true, hip: [0, -0.3, 0] }) }),
  K(fr(12), { hp: [0, -0.36, 0], sp: [22], ax: axe([-0.54, 0.78, -0.14], 202, -1, { two: true, hip: [0, -0.36, 0] }) }, 'out'),
  K(fr(17), { hp: [0, -0.24, 0.04], hr: [4, 0, 0], sp: [12], ch: [6, -10], ax: axe([-0.5, 1.16, 0.22], 285, -1, { two: true, dx: -1.1, hip: [0, -0.24, 0.04] }) }),   /* the bottom of the swing: the haft out to his near side, so the head clears the floor */
  K(fr(20), { hp: [0, -0.16, 0.06], hr: [0, 8, 0], sp: [6], ch: [2, -6], hd: [-20], ax: AXHIT('usmash', 0, -0.14, { two: true, hip: [0, -0.16, 0.06] }) }, 'snap'),
  K(fr(22), { hp: [0, -0.04, 0.04], sp: [-4], ch: [-8, 0], hd: [-28], fr: [-0.22, 0.03, -0.25, 25], ax: AXHIT('usmash', 1, -0.14, { two: true, hip: [0, -0.04, 0.04] }) }),
  K(fr(24), { hp: [0, 0.02, 0], sp: [-10], ch: [-14, 6], hd: [-34], fr: [-0.22, 0.06, -0.25, 35], ax: AXHIT('usmash', 2, -0.14, { two: true, hip: [0, 0.02, 0] }) }),
  FT(fr(28), { hp: [0, 0.05, 0], sp: [-17], ch: [-19, 6], hd: [-32], fr: [-0.22, 0.08, -0.25, 42], fl: [0.22, 0.04, 0.21, 30], ax: axe([-0.12, 1.95, -0.25], 150, 1, { two: true, hip: [0, 0.05, 0] }) }, 'out'),
  FT(fr(36), { hp: [0, -0.2, 0.02], sp: [10], ch: [6, -6], hd: [-6], fr: [-0.2, 0, -0.25], fl: [0.22, 0, 0.21], ax: axe([-0.3, 1.0, 0.5], 18, -1, { two: true, hip: [0, -0.2, 0.02] }) }, 'quad'),
  ...STOW(fr(43), fr(48), fr(52), { hp: [0, -0.12, 0], L: [0.36, 1.36, 0.16] }),
  ...SETTLE(fr(55), fr(61))]);
/* Ground Reaper: drawn, low in front (16 to 19); then the whole body pivots on the feet (the hips leading, about 45 degrees
   of it the body's own turn) so the blade passes his near side low and lands behind him on the near side, where the camera
   sees it (25 to 28); then up and back over the shoulder */
{ const Y = -45, A = { y: Y };
  C.Dsmash = keys([GDK(0),
    K(fr(2), REACH), ...DRAWS(fr(4)),
    K(fr(8), { hp: [0, -0.3, 0], hr: [8, 20, 0], sp: [16], ch: [10, 26], hd: [-12, -30], fl: [0.3, 0, 0.26], fr: [-0.3, 0, -0.3], ax: axe([-0.4, 0.62, -0.1], 200, 1, { two: true, hip: [0, -0.3, 0] }) }),
    K(fr(10), { hp: [0, -0.34, 0], ax: axe([-0.4, 0.6, -0.14], 204, 1, { two: true, hip: [0, -0.34, 0] }) }, 'out'),
    K(fr(14), { hp: [0, -0.38, 0.02], hr: [8, 0, 0], sp: [22], ch: [12, 0], ax: axe([-0.4, 0.5, 0.1], 260, -1, { two: true, dx: -0.2, hip: [0, -0.38, 0.02] }) }),
    K(fr(16), { hp: [0, -0.42, 0.04], hr: [10, -10, 0], sp: [26], ch: [16, 6], hd: [-20, 4], ax: AXHIT('dsmash', 0, -0.18, { two: true, hip: [0, -0.42, 0.04] }) }, 'snap'),
    K(fr(19), { ch: [16, 14], ax: AXHIT('dsmash', 0, -0.1, { two: true, hip: [0, -0.42, 0.04] }) }),
    K(fr(22), { all: [0, -25], hp: [0, -0.4, 0], hr: [8, -20, 0], ch: [12, -12], hd: [-16, 30], ax: axe([-0.62, 0.55, 0.0], 230, 1, { two: true, hip: [0, -0.4, 0], all: { y: -25 } }) }),
    K(fr(25), { all: [0, Y], hp: [0, -0.42, -0.04], hr: [10, -28, 0], sp: [24], ch: [14, -24], hd: [-18, 40], ax: AXHIT('dsmash', 1, -0.36, { two: true, hip: [0, -0.42, -0.04], all: A }) }, 'snap'),
    K(fr(28), { ch: [14, -28], ax: AXHIT('dsmash', 1, -0.3, { two: true, hip: [0, -0.42, -0.04], all: A }) }),
    FT(fr(34), { all: [0, -40], hp: [0, -0.36, -0.02], hr: [8, -24, 0], ch: [12, -22], ax: axe([-0.5, 0.62, -0.32], 212, 1, { two: true, hip: [0, -0.36, -0.02], all: { y: -40 } }) }, 'out'),
    K(fr(42), { all: [0, -8], hp: [0, -0.16, 0], hr: [2, -8, 0], sp: [8], ch: [5, -8], hd: [-6, 14], ax: axe([-0.3, 1.2, 0.2], 90, -1, { hip: [0, -0.16, 0], all: { y: -8 } }), L: [0.36, 1.3, 0.16] }, 'quad'),
    ...STOW(fr(46), fr(50), fr(53), { all: [0, 0], hp: [0, -0.12, 0], L: [0.36, 1.32, 0.16] }),
    ...SETTLE(fr(56), fr(61))]); }
/* the unarmed smashes, while the axe is away */
C.FsmashE = keys([GDK(0),   /* the haymaker: hands up, the hips coil against the braced rear heel, the right fist hooks across */
  K(fr(10), { hp: [0, -0.1, -0.1], hr: [0, -24, 0], ch: [-4, -40], hd: [-4, 50], L: [0.3, 1.36, 0.16], R: [-0.3, 1.32, -0.42], fr: [-0.32, 0, -0.27] }),
  K(fr(17), { hp: [0, -0.13, -0.14], hr: [2, -30, 0], ch: [-6, -48], hd: [-4, 60], R: [-0.36, 1.32, -0.44] }, 'out'),
  K(fr(24), { hp: [0, -0.12, 0.0], hr: [2, -6, 0], ch: [0, -30], R: [-0.1, 1.3, -0.4] }),
  K(fr(27), { hp: [0, -0.13, 0.22], hr: [4, 26, 0], sp: [14], ch: [14, 36], hd: [-10, -40], R: [1.08, 1.2, 0.0], L: [0.2, 1.3, 0.3], fr: [-0.34, 0.04, -0.27, 30] }, 'snap'),
  K(fr(29), { R: [1.12, 1.18, 0.06], ch: [15, 42] }),
  FT(fr(33), { hr: [3, 32, 0], ch: [16, 50], hd: [-10, -46], R: [1.0, 1.08, 0.16] }, 'out'),
  FT(fr(42), { hp: [0, -0.12, 0.14], hr: [2, 20, 0], ch: [10, 30], R: [0.5, 1.1, 0.1], L: [0.3, 1.3, 0.22] }, 'quad'),
  K(fr(50), { hp: [0, -0.1, 0.04], hr: [1, -4, 0], ch: [7, -6], R: [0.2, 1.24, -0.2], fr: [-0.24, 0, -0.27, -8] }),
  ...SETTLE(fr(55), fr(63))]);
C.UsmashE = keys([GDK(0),   /* the rising hammer: a loaded squat, fists by the ribs, then both forearms drive up (19 to 22) */
  K(fr(9), { hp: [0, -0.38, 0], hr: [10, 0, 0], sp: [18], ch: [12], hd: [-16], R: [0.18, 0.95, -0.24], L: [0.18, 0.95, 0.24] }),
  K(fr(15), { hp: [0, -0.42, 0], sp: [22] }, 'out'),
  K(fr(19), { hp: [0, 0.04, 0.02], hr: [-4, 0, 0], sp: [-8], ch: [-10], hd: [-28], R: [0.24, 2.0, -0.16], L: [0.24, 2.0, 0.16], fr: [-0.2, 0.06, -0.25, 35], fl: [0.22, 0.06, 0.21, 35] }, 'snap'),
  K(fr(22), { R: [0.26, 2.08, -0.16], L: [0.26, 2.08, 0.16] }),
  FT(fr(26), { hp: [0, 0.06, 0.02], sp: [-12], hd: [-30], R: [0.24, 2.12, -0.18], L: [0.24, 2.12, 0.18], fr: [-0.2, 0.08, -0.25, 42], fl: [0.22, 0.08, 0.21, 42] }, 'out'),
  FT(fr(35), { hp: [0, -0.16, 0], sp: [8], hd: [-8], R: [0.3, 1.36, -0.36], L: [0.3, 1.36, 0.36], fr: [-0.2, 0, -0.25], fl: [0.22, 0, 0.21] }, 'quad'),
  ...SETTLE(fr(45), fr(54))]);
C.DsmashE = keys([GDK(0),   /* two-sided boot sweep: the lead heel forward (16 to 18), round across the base, the other boot behind (25 to 27) */
  K(fr(8), { hp: [0, -0.32, 0], hr: [8, -10, 0], sp: [16], ch: [10], R: [0.0, 0.5, -0.45], L: [0.2, 0.7, 0.4] }),
  K(fr(16), { hp: [0, -0.48, -0.04], hr: [6, -20, 0], sp: [18], ch: [10, -10], fl: [1.3, 0.05, 0.18, -50], fr: [-0.1, 0, -0.25], R: [-0.1, 0.13, -0.46], L: [0.0, 0.7, 0.42] }, 'snap'),
  K(fr(18), { fl: [1.34, 0.05, 0.18, -50] }),
  K(fr(22), { hp: [0, -0.48, 0], hr: [6, 10, 0], fl: [0.3, 0.1, 0.2], fr: [-0.4, 0.1, -0.22, 20], R: [0.2, 0.6, -0.4], L: [0.4, 0.13, 0.44] }),
  K(fr(25), { hp: [0, -0.48, 0.04], hr: [6, 22, 0], ch: [10, 20], fl: [0.1, 0, 0.2], fr: [-1.28, 0.05, -0.2, 50] }, 'snap'),
  K(fr(27), { fr: [-1.32, 0.05, -0.2, 50] }),
  FT(fr(33), { hp: [0, -0.44, 0.02], hr: [6, 14, 0], ch: [10, 12], fr: [-0.7, 0.02, -0.22, 25] }, 'quad'),
  Object.assign({ t: fr(40), use: 'crouch', in: 'out' }), ...SETTLE(fr(46), fr(55))]);
/* ---- air ---- */
/* Double Kick: knees folded, the near boot out on 7 and 8 (lingering to 12) with the arms swinging against it, drawn back as
   the far knee chambers, the far boot out on 17 and 18 (lingering to 26), then both knees tuck and he settles into his fall */
C.Nair = keys([AIRK(0, { fl: [0.16, 0.44, 0.18, 30], fr: [0.1, 0.4, -0.18, 30], sp: [10] }),
  K(fr(4), { sp: [6], fr: [0.3, 0.5, -0.17, 10], ch: [0, 8], R: [0.1, 1.3, -0.3], L: [0.2, 1.3, 0.28] }),
  K(fr(7), { sp: [-10], ch: [-6, -10], hd: [0, 8], fr: [0.98, 0.62, -0.16, -60], fl: [0.06, 0.44, 0.18, 30], R: [-0.24, 1.4, -0.4], L: [0.4, 1.3, 0.3] }, 'snap'),
  K(fr(12), { fr: [0.95, 0.6, -0.16, -55], ch: [-5, -8] }),
  FT(fr(15), { sp: [2], ch: [0, 0], fr: [0.12, 0.42, -0.16, 20], fl: [0.24, 0.52, 0.18, 0], R: [0.1, 1.3, -0.32], L: [0.2, 1.32, 0.32] }, 'out'),
  K(fr(17), { sp: [-12], ch: [-6, 12], hd: [0, -8], fl: [1.12, 0.8, 0.16, -60], fr: [0.0, 0.36, -0.18, 30], R: [0.34, 1.32, -0.34], L: [-0.24, 1.42, 0.4] }, 'snap'),
  K(fr(26), { fl: [1.08, 0.76, 0.16, -55], ch: [-5, 10] }),
  FT(fr(31), { sp: [6], ch: [2, 0], fl: [0.2, 0.42, 0.18, 25], R: [0.14, 1.22, -0.26], L: [0.3, 1.3, 0.22] }, 'out'), ...SETTLEA(fr(35), fr(40))]);
/* Axe Crusher: the draw flows into the wind-up (the axe carried over his shoulder high behind it), the ribs turn and the
   blade comes over and down through the front (17 to 20); his whole body folds after it with the legs kicking back as a
   counterweight; then back over the shoulder */
C.Fair = keys([AIRK(0),
  K(fr(3), REACH), ...DRAWS(fr(5), { hp: [0, 0.02, 0] }),
  K(fr(10), { sp: [-10], ch: [-12, -24], hd: [-6, 18], fl: [0.06, 0.3, 0.18, 20], fr: [0.0, 0.26, -0.2, 30], ax: axe([-0.24, 1.75, -0.2], 140, -1, { two: true }) }),
  K(fr(15), { sp: [-15], ch: [-14, -28], fl: [0.02, 0.24, 0.18, 30], ax: axe([-0.24, 1.86, -0.26], 124, -1, { two: true }) }, 'out'),
  K(fr(17), { sp: [6], ch: [6, 10], hd: [-2, -6], fl: [0.3, 0.3, 0.18, 0], ax: AXHIT('fair', 0, -0.12, { two: true }) }, 'snap'),
  K(fr(19), { sp: [16], ch: [14, 16], ax: AXHIT('fair', 1, -0.12, { two: true }) }), K(fr(20), { ax: AXHIT('fair', 1, -0.12, { two: true }) }),
  FT(fr(25), { sp: [28], ch: [20, 14], hd: [-16], fl: [-0.32, 0.46, 0.18, 40], fr: [-0.42, 0.36, -0.2, 40], ax: axe([-0.14, 0.7, 0.5], -70, -1, { two: true }) }, 'out'),
  K(fr(30), { sp: [16], ch: [10, 6], hd: [-10], fl: [0.0, 0.34, 0.18, 30], fr: [-0.12, 0.26, -0.2, 30], ax: axe([-0.2, 0.95, 0.5], -15, -1, { two: true }) }, 'quad'),
  ...STOW(fr(33), fr(37), fr(40), { hp: [0, 0.02, 0], L: [0.3, 1.3, 0.22] }),
  ...SETTLEA(fr(43), fr(48))]);
/* the unarmed forward air: the arm rises up and back, then the fist hammers over and down through the front (14 to 19)
   and the body folds after it, the legs trailing */
C.FairE = keys([AIRK(0),
  K(fr(8), { sp: [-10], ch: [-8, -20], hd: [-6, 16], R: [-0.2, 1.85, -0.38], L: [0.3, 1.3, 0.24] }),
  K(fr(12), { sp: [-14], R: [-0.1, 2.0, -0.34] }, 'out'),
  K(fr(14), { sp: [4], ch: [4, 12], hd: [-10, -8], R: [0.85, 1.75, -0.1] }, 'snap'),
  K(fr(17), { sp: [20], ch: [14, 16], R: [1.1, 1.1, -0.06], fr: [-0.3, 0.5, -0.18, 50], fl: [-0.2, 0.42, 0.18, 50] }),
  K(fr(19), { sp: [26], R: [0.9, 0.7, -0.12] }),
  FT(fr(28), { sp: [22], ch: [14, 8], R: [0.6, 0.6, -0.2] }, 'out'), ...SETTLEA(fr(36), fr(44))]);
/* Axe Backhand: drawn, elbows in round the haft; the whole body turns away (about 35 degrees of it the body's own turn) and
   he looks back over his near shoulder as the blade flashes out behind at shoulder height (12 to 14); then back over the shoulder */
{ const A = { y: -35 };
  C.Bair = keys([AIRK(0),
    K(fr(2), REACH), ...DRAWS(fr(4), { hp: [0, 0.02, 0] }),
    K(fr(8), { all: [0, 10], hr: [0, 16, 0], ch: [0, 24], hd: [0, -20], fr: [0.0, 0.32, -0.2, 30], fl: [0.12, 0.38, 0.18, 30], ax: axe([-0.16, 1.2, 0.3], 100, 1, { two: true, all: { y: 10 } }) }),
    K(fr(12), { all: [0, -35], hr: [0, -10, 0], sp: [-6], ch: [-6, -22], hd: [4, -34], fl: [0.32, 0.26, 0.18, 10], fr: [0.2, 0.22, -0.18, 10], ax: AXHIT('bair', 0, -0.36, { two: true, all: A }) }, 'snap'),
    K(fr(14), { ch: [-6, -28], ax: AXHIT('bair', 0, -0.32, { two: true, all: A }) }),
    FT(fr(20), { all: [0, -28], hr: [0, -6, 0], ch: [-4, -18], hd: [2, -20], ax: axe([-0.2, 1.2, -0.3], 150, 1, { two: true, all: { y: -28 } }) }, 'out'),
    ...STOW(fr(24), fr(28), fr(31), { all: [0, 0], hr: [0, 0, 0], L: [0.3, 1.3, 0.22] }),
    ...SETTLEA(fr(34), fr(39))]); }
/* the unarmed back air: the knees tuck, the body turns away and the right fist snaps out behind across the shoulder (10 to
   12), held out while he turns back */
C.BairE = keys([AIRK(0),
  K(fr(5), { hr: [0, 16, 0], ch: [0, 30], hd: [0, -20], R: [0.24, 1.4, 0.0], fl: [0.14, 0.42, 0.18, 30], fr: [0.1, 0.42, -0.18, 30] }),
  K(fr(10), { hr: [0, -14, 0], sp: [-4], ch: [-4, -44], hd: [0, 30], R: [-1.25, 1.18, -0.3], fr: [-0.16, 0.2, -0.18, 40] }, 'snap'),
  K(fr(12), { R: [-1.28, 1.2, -0.3] }),
  K(fr(18), { R: [-1.18, 1.22, -0.32], ch: [-4, -38] }),
  FT(fr(24), { hr: [0, -4, 0], ch: [0, -10], R: [-0.2, 1.3, -0.4] }, 'out'), ...SETTLEA(fr(29), fr(35))]);
/* Axe Skyhook: drawn, the axe across the belly, then easing into the top of a circle up and over from in front (11) through
   the top (13) to behind (15), snapping through it; then back over the shoulder */
C.Uair = keys([AIRK(0),
  K(fr(2), REACH), ...DRAWS(fr(4), { hp: [0, 0.02, 0] }),
  K(fr(8), { sp: [10], fl: [0.14, 0.42, 0.18, 30], fr: [0.1, 0.42, -0.18, 30], ax: axe([-0.2, 0.95, 0.35], -10, 1, { two: true }) }, 'out'),
  K(fr(10), { sp: [4], ch: [-4], hd: [-14], ax: axe([-0.22, 1.0, 0.4], 20, 1, { two: true }) }),
  K(fr(11), { sp: [-6], ch: [-10], hd: [-22], ax: AXHIT('uair', 0, -0.12, { two: true }) }, 'snap'), K(fr(12), { ax: AXHIT('uair', 0, -0.12, { two: true }) }),
  K(fr(13), { sp: [-10], ch: [-16], hd: [-30], ax: AXHIT('uair', 1, -0.12, { two: true }) }),
  K(fr(14), { sp: [-12], ch: [-20], ax: AXHIT('uair', 2, -0.12, { two: true }) }), K(fr(15), { ax: AXHIT('uair', 2, -0.12, { two: true }) }),
  FT(fr(20), { sp: [0], ch: [-4], hd: [-6], fl: [0.2, 0.2, 0.25, 20], fr: [-0.1, 0.1, -0.25, 30], ax: axe([-0.3, 1.25, -0.2], 185, 1) }, 'out'),
  ...STOW(fr(24), fr(28), fr(31), { hp: [0, 0.02, 0], L: [0.3, 1.3, 0.22] }),
  ...SETTLEA(fr(34), fr(39))]);
/* the unarmed up air (owner): a backflip kick on the axe up air's arc and frames. The whole body turns over backward about
   his hips, lifted as he goes (SPIN): the near leg straight, the far knee tucked, the arms thrown back. The boot passes in
   front (11, 12), over the top (13) and behind (14, 15) 0.45 H from the hips, then he comes round upright and settles */
{ const S = (p, up) => SPIN(p, 0.95, up), kick = { fr: [0.04, 0.0, -0.19, 50], fl: [0.32, 0.48, 0.18, 20], R: [-0.34, 1.28, -0.42], L: [-0.3, 1.32, 0.42], hd: [-16], sp: [-8], ch: [-6] };
  C.UairE = keys([AIRK(0),
    K(fr(4), { all: S(12, 0.08), sp: [14], ch: [8], hd: [8], fr: [0.18, 0.4, -0.19, 20], fl: [0.24, 0.46, 0.18, 20], R: [0.3, 1.0, -0.3], L: [0.34, 1.02, 0.3] }, 'out'),
    K(fr(8), cat({ all: S(-55, 0.3) }, kick, { fr: [0.3, 0.5, -0.19, 10], R: [-0.1, 1.85, -0.36], L: [-0.06, 1.88, 0.36] })),
    K(fr(11), cat({ all: S(-120, 0.4) }, kick), 'snap'),
    K(fr(12), { all: S(-135, 0.4) }),
    K(fr(13), { all: S(-180, 0.4) }),
    K(fr(14), { all: S(-215, 0.4) }),
    K(fr(15), { all: S(-245, 0.38) }),
    FT(fr(19), { all: S(-300, 0.28), fr: [0.16, 0.34, -0.19, 20], fl: [0.2, 0.4, 0.18, 20], R: [0.1, 1.2, -0.34], L: [0.14, 1.22, 0.34], hd: [-6], sp: [6], ch: [4] }, 'out'),
    K(fr(24), cat({ all: S(-360, 0.08) }, AIR_O)),
    ...SETTLEA(fr(27), fr(33))]); }
/* Two-Foot Stomp: the body rises and coils, knees to the chest, arms up for balance (1 to 15), both boots driven straight
   down (16 to 18) and held there, then the knees come back up */
C.Dair = keys([AIRK(0),
  K(fr(6), { hp: [0, 0.16, 0], sp: [12], fl: [0.08, 0.56, 0.16, 20], fr: [0.06, 0.56, -0.16, 20], L: [0.0, 1.5, 0.6], R: [-0.04, 1.46, -0.6] }),
  K(fr(10), { hp: [0, 0.22, 0], sp: [16], ch: [6], hd: [6], fl: [0.08, 0.64, 0.16, 20], fr: [0.06, 0.64, -0.16, 20], L: [-0.04, 1.6, 0.62], R: [-0.06, 1.56, -0.62] }, 'out'),
  K(fr(13), { hp: [0, 0.26, 0], sp: [18], ch: [8], fl: [0.08, 0.68, 0.16, 15], fr: [0.06, 0.68, -0.16, 15], L: [-0.08, 1.66, 0.64], R: [-0.1, 1.62, -0.64] }),
  K(fr(16), { hp: [0, 0.1, 0], sp: [-4], ch: [-4], hd: [10], fl: [0.08, -0.62, 0.12, 40], fr: [0.08, -0.62, -0.12, 40], L: [0.1, 1.3, 0.55], R: [0.08, 1.26, -0.55] }, 'snap'),
  K(fr(18), { fl: [0.08, -0.65, 0.12, 40], fr: [0.08, -0.65, -0.12, 40] }),
  K(fr(24), { hp: [0, 0.11, 0], sp: [2], fl: [0.08, -0.56, 0.13, 36], fr: [0.07, -0.56, -0.13, 36], L: [0.14, 1.26, 0.5], R: [0.12, 1.22, -0.5] }),
  FT(fr(31), { hp: [0, 0.12, 0], sp: [6], fl: [0.08, -0.36, 0.14, 30], fr: [0.06, -0.36, -0.14, 30] }, 'quad'),
  ...SETTLEA(fr(38), fr(44))]);
/* ---- grabs, get-ups ---- */
C.Grab = keys([GDK(0), K(fr(4), { hr: [0, -12, 0], ch: [4, -14], R: [0.3, 1.26, -0.24], L: [0.4, 1.2, 0.22] }),
  K(fr(8), { hp: [0, -0.12, 0.1], hr: [4, 14, 0], sp: [8], ch: [8, 18], hd: [-6, -10], R: [1.0, 1.12, -0.08], L: [0.6, 1.12, 0.16], fl: [0.34, 0, 0.21] }, 'snap'),
  K(fr(10), { R: [1.02, 1.12, -0.06] }), FT(fr(18), { hp: [0, -0.12, 0.06], ch: [7, 10], R: [0.7, 1.1, -0.14], L: [0.4, 1.15, 0.2] }, 'out'), K(fr(25), { hp: [0, -0.1, 0.02], R: [0.34, 1.2, -0.2], fl: [0.24, 0, 0.21, -8] }), ...SETTLE(fr(30), fr(38))]);
C.GrabRun = keys([GDK(0, { sp: [10] }), K(fr(6), { hp: [0, -0.16, 0.2], hr: [6, 10, 0], sp: [14], R: [0.5, 1.15, -0.2], L: [0.4, 1.1, 0.24], fl: [0.46, 0, 0.21] }),
  K(fr(11), { hp: [0, -0.14, 0.28], hr: [6, 18, 0], ch: [10, 22], R: [1.14, 1.1, -0.06], L: [0.7, 1.1, 0.16], fr: [-0.4, 0.06, -0.25, 30] }, 'snap'),
  K(fr(13), { R: [1.16, 1.1, -0.06] }), FT(fr(24), { hp: [0, -0.14, 0.14], R: [0.7, 1.0, -0.2], fr: [-0.24, 0, -0.25] }, 'out'), K(fr(32), { hp: [0, -0.12, 0.04], R: [0.34, 1.16, -0.2] }), ...SETTLE(fr(38), fr(46))]);
C.GrabTurn = keys([GDK(0), K(fr(6), { all: [0, 120], ch: [4, -20] }),
  K(fr(12), { all: [0, 180], hp: [0, -0.12, 0.1], hr: [4, 14, 0], ch: [8, 26], R: [1.2, 1.12, -0.06], L: [0.6, 1.12, 0.16] }, 'snap'),
  K(fr(14), { all: [0, 180] }), Object.assign({ t: fr(41), reset: true, use: GD, pose: B({ all: [0, 180] }), in: 'quad' })]);
/* Get-up Kick: from his back he plants both hands, swings both legs round and kicks to both sides (16 to 19), then pulls the
   legs in and comes up into his guard */
C.Getup = keys([{ t: 0, use: 'crouch', pose: B({ hp: [0, -0.55, 0], sp: [20], L: [-0.1, 0.3, 0.46], R: [-0.1, 0.3, -0.46] }) },
  K(fr(6), { hp: [0, -0.5, -0.04], sp: [26], fl: [0.4, 0.2, 0.18, -10], fr: [-0.3, 0.1, -0.2, 20] }),
  K(fr(12), { hp: [0, -0.48, 0], sp: [30], fl: [0.3, 0.12, 0.16, -20], fr: [-0.3, 0.12, -0.16, 20], L: [0.0, 0.3, 0.46], R: [0.0, 0.3, -0.46] }, 'out'),
  K(fr(16), { hp: [0, -0.5, 0], sp: [30], fl: [1.15, 0.04, 0.16, -50], fr: [-1.15, 0.04, -0.16, 50] }, 'snap'), K(fr(19), { fl: [1.18, 0.05, 0.16, -50], fr: [-1.18, 0.05, -0.16, 50] }),
  FT(fr(25), { hp: [0, -0.44, 0], sp: [24], fl: [0.4, 0.06, 0.18, -10], fr: [-0.4, 0.06, -0.2, 10] }, 'out'),
  Object.assign({ t: fr(30), use: 'crouch', in: 'quad' }), ...SETTLE(fr(34), fr(40))]);
/* Ledge attack: he hauls himself up onto the lip, the knee comes up and the lead boot snaps out low (23 to 25), then he steps in */
C.LedgeAtk = keys([{ t: 0, use: 'crouch', pose: B({ hp: [0, -0.5, -0.1], L: [0.3, 0.2, 0.3], R: [0.3, 0.2, -0.3] }) },
  K(fr(8), { hp: [0, -0.38, -0.04], sp: [24], L: [0.34, 0.3, 0.3], R: [0.34, 0.3, -0.3], fl: [0.1, 0.1, 0.2, 10] }),
  K(fr(14), { hp: [0, -0.28, 0], sp: [14], fl: [0.24, 0.36, 0.18, -10], L: [0.36, 1.1, 0.24], R: [0.2, 1.0, -0.26] }, 'out'),
  K(fr(18), { hp: [0, -0.14, -0.06], sp: [-4], fl: [0.3, 0.42, 0.16, -20] }),
  K(fr(23), { hp: [0, -0.12, -0.06], sp: [-12], fl: [1.35, 0.6, 0.12, -60] }, 'snap'), K(fr(25), { fl: [1.38, 0.62, 0.12, -60] }),
  FT(fr(31), { sp: [-4], fl: [0.5, 0.3, 0.16, -15] }, 'out'), K(fr(38), { hp: [0, -0.14, 0.02], sp: [8], fl: [0.26, 0, 0.21, -6] }, 'quad'),
  ...SETTLE(fr(46), fr(55))]);
/* ---- specials ---- */
/* Axe Throw (the lob): drawn and carried back behind his head with the weight on the rear foot, front foot forward, then
   slung up and through and let go on frame 30; the hand opens, the weight that left it pitches him forward onto a catching
   step, and he settles */
C.Throw = keys([GDK(0),
  K(fr(3), REACH), ...DRAWS(fr(6)),
  K(fr(10), { hp: [0, -0.07, -0.06], ch: [-4, -14], hd: [-4, 24], ax: axe([-0.36, 1.82, -0.2], 105, 1, { hip: [0, -0.07, -0.06] }) }),
  K(fr(16), { hp: [0, -0.08, -0.12], hr: [-4, -20, 0], sp: [-10], ch: [-10, -34], hd: [-4, 40], fl: [0.32, 0, 0.21, -10], L: [0.55, 1.45, 0.14], ax: axe([-0.4, 1.75, -0.36], 150, 1, { hip: [0, -0.08, -0.12] }) }),
  K(fr(24), { hp: [0, -0.1, -0.16], hr: [-6, -26, 0], ch: [-14, -44], ax: axe([-0.42, 1.8, -0.42], 165, 1, { hip: [0, -0.1, -0.16] }) }, 'out'),
  K(fr(27), { hp: [0, -0.1, -0.04], hr: [0, -4, 0], ch: [-4, -20], ax: axe([-0.4, 1.95, -0.1], 150, 1, { hip: [0, -0.1, -0.04] }) }),
  K(fr(30), { hp: [0, -0.12, 0.24], hr: [6, 18, 0], sp: [14], ch: [14, 20], hd: [-12, -14], L: [0.1, 1.15, 0.36], fr: [-0.32, 0.04, -0.25, 30], ax: axe([-0.32, 1.45, 0.62], 40, -1, { hip: [0, -0.12, 0.24] }) }, 'snap'),
  FT(fr(35), { hp: [0, -0.18, 0.32], sp: [26], ch: [22, 30], hd: [-16, -20], R: [0.88, 0.86, -0.2], fr: [-0.3, 0.14, -0.25, 40] }, 'out'),
  K(fr(41), { hp: [0, -0.2, 0.3], sp: [18], fr: [0.36, 0, -0.22, -10] }, 'quad'),
  FT(fr(48), { hp: [0, -0.14, 0.22], sp: [12], ch: [10, 12], R: [0.46, 1.04, -0.24], fl: [0.5, 0, 0.21] }, 'quad'),
  K(fr(55), { hp: [0, -0.1, 0.12], fr: [-0.2, 0, -0.25, -6], fl: [0.24, 0, 0.21] }),
  ...SETTLE(fr(59), fr(66))]);
/* with the axe away: the open hand held out toward it, the fingers calling it home */
C.Beckon = keys([GDK(0, { R: [0.3, 1.2, -0.3] }), K(fr(8), { ch: [0, -26], hd: [-6, 24], R: [0.85, 1.45, -0.3] }, 'out'), K(fr(16), { R: [0.8, 1.48, -0.3] }), K(fr(24), { R: [0.84, 1.44, -0.3] })]);
/* Meteor Shoulder Charge: the shoulder sinks into a crouch (1 to 14), explodes forward shoulder-first with the head tucked on
   15, the boots pounding through the travel in a real charging stride (contact, passing, contact, passing every 2 frames, to
   40), then the heels dig in for a long skid and the shoulders recoil */
{ const lead = { hp: [0, -0.24, 0.24], hr: [14, 40, 0], sp: [38], ch: [16, 44], hd: [-32, -60], L: [-0.36, 1.05, 0.36], R: [0.5, 1.15, 0.04] };
  const stride = [{ hp: [0, -0.27, 0.26], fl: [0.5, 0, 0.2, -5], fr: [-0.62, 0.12, -0.24, 50] }, { hp: [0, -0.19, 0.26], fl: [-0.06, 0.08, 0.2, 20], fr: [0.14, 0.34, -0.24, 0] },
    { hp: [0, -0.27, 0.26], fr: [0.5, 0, -0.24, -5], fl: [-0.62, 0.12, 0.2, 50] }, { hp: [0, -0.19, 0.26], fr: [-0.06, 0.08, -0.24, 20], fl: [0.14, 0.34, 0.2, 0] }];
  C.Meteor = keys([GDK(0),
    K(fr(10), { hp: [0, -0.32, -0.12], hr: [12, 30, 0], sp: [24], ch: [14, 40], hd: [-22, -50], fl: [0.32, 0, 0.21], fr: [-0.44, 0, -0.27, 30], L: [0.2, 0.95, 0.3], R: [0.34, 1.05, 0.06] }),
    K(fr(14), { hp: [0, -0.36, -0.14] }, 'out'),
    K(fr(15), cat(lead, { fl: [0.5, 0.16, 0.2, -10], fr: [-0.62, 0.12, -0.24, 50] }), 'snap'),
    ...Array.from({ length: 12 }, (_, k) => K(fr(17 + 2 * k), stride[k % 4])),
    K(fr(41), { hp: [0, -0.24, 0.22], fl: [0.56, 0.06, 0.2, -15], fr: [-0.6, 0.12, -0.24, 50] }),
    FT(fr(44), { hp: [0, -0.34, -0.04], hr: [6, 14, 0], sp: [12], ch: [4, 20], hd: [-8, -14], fl: [0.62, 0, 0.21, -28], fr: [-0.32, 0, -0.27, 0], L: [0.3, 1.1, 0.34], R: [0.3, 1.1, -0.3] }, 'out'),
    K(fr(48), { hp: [0, -0.3, -0.02], sp: [10], fl: [0.6, 0, 0.21, -24] }),
    ...SETTLE(fr(51), fr(57))]); }
/* Soaring Plunge (the rise, hang and dive), played by the game from frame 0 to 60 of the move, then the dive loops
   (UpBDive): drawn in the gather (1 to 9), the rising slash and a twisting climb (10 to 38), slowing into the hang with
   the axe overhead (39 to 47), turning over (48 to 53), and the dive head-first behind the axe */
{ const DV = SPIN(60, 1.0), DA = DV.A;
  const upClip = fist => keys([GDK(0),
    ...(fist ? [] : [K(fr(2), REACH), DRAW(fr(4)), K(fr(6), { ax: MIDAX([0, -0.2, 0]) }, 'out')]),
    K(fr(8), Object.assign({ hp: [0, -0.3, 0], hr: [10, 0, 0], sp: [18], ch: [10, -10], hd: [-14] }, fist ? { R: [0.25, 0.95, -0.25], L: [0.25, 0.95, 0.25] } : { ax: axe([-0.3, 0.7, 0.4], -20, 1, { two: true, hip: [0, -0.3, 0] }) })),
    K(fr(10), Object.assign({ hp: [0, 0.0, 0.02], hr: [-4, 0, 0], sp: [-8], ch: [-10], hd: [-26], fl: [0.1, 0.2, 0.2, 40], fr: [-0.1, -0.1, -0.2, 45] }, fist ? { R: [0.45, 1.85, -0.2], L: [0.2, 1.3, 0.3] } : { ax: AXHIT('uspec', 0, -0.2, { two: true, hip: [0, 0, 0.02] }) }), 'snap'),
    K(fr(17), Object.assign({ all: [0, 28], sp: [-12], hd: [-22], fl: [0.0, -0.16, 0.18, 50], fr: [-0.1, -0.24, -0.18, 50] }, fist ? { R: [0.3, 2.0, -0.2], L: [0.3, 1.95, 0.2] } : { ax: axe([-0.2, 1.9, 0.2], 80, 1, { two: true, all: { y: 28 } }) })),
    K(fr(24), Object.assign({ all: [0, -14], sp: [-11] }, fist ? {} : { ax: axe([-0.2, 1.94, 0.12], 84, 1, { two: true, all: { y: -14 } }) })),
    K(fr(30), Object.assign({ all: [0, 0], sp: [-10], fl: [0.0, -0.1, 0.18, 45], fr: [-0.05, -0.15, -0.18, 45] }, fist ? { R: [0.2, 2.1, -0.2], L: [0.2, 2.05, 0.2] } : { ax: axe([-0.2, 1.95, 0.1], 85, 1, { two: true }) })),
    K(fr(39), Object.assign({ sp: [-4], ch: [-4], hd: [-14], fl: [0.2, 0.2, 0.18, 30], fr: [-0.1, 0.1, -0.18, 30] }, fist ? { R: [0.4, 1.95, -0.24], L: [0.35, 1.9, 0.24] } : { ax: AXHIT('uspec', 1, -0.2, { two: true }) }), 'out'),
    K(fr(47), Object.assign({ ch: [-2], hd: [-10], fl: [0.24, 0.26, 0.18, 25] }, fist ? {} : { ax: axe([-0.2, 1.92, 0.25], 60, 1, { two: true }) })),
    K(fr(51), Object.assign({ all: SPIN(30, 1.0), sp: [16], ch: [10], hd: [10] }, fist ? { R: [0.5, 1.7, -0.2], L: [0.5, 1.7, 0.2] } : { ax: axe([-0.2, 1.5, 0.45], 10, -1, { two: true, all: SPIN(30, 1.0).A }) })),
    K(fr(57), Object.assign({ all: DV, sp: [10], ch: [6], hd: [20], fl: [-0.1, 0.3, 0.18, 50], fr: [-0.2, 0.22, -0.18, 50] }, fist ? { R: [0.5, 0.75, -0.18], L: [0.5, 0.75, 0.18] } : { ax: AXHIT('uspec', 6, -0.2, { two: true, all: DA }) }), 'snap'),
    K(fr(60), {})]);
  C.UpB = upClip(false); C.UpBE = upClip(true);
  /* the dive, looped until he lands: the legs streaming and shaking with the speed */
  const dive = fist => keys([GDK(0, Object.assign({ all: DV, sp: [10], ch: [6], hd: [20], fl: [-0.1, 0.3, 0.18, 50], fr: [-0.2, 0.22, -0.18, 50] }, fist ? { R: [0.5, 0.75, -0.18], L: [0.5, 0.75, 0.18] } : { ax: AXHIT('uspec', 6, -0.2, { two: true, all: DA }) })),
    K(0.1, { fl: [-0.14, 0.34, 0.18, 54], fr: [-0.16, 0.2, -0.18, 46], hd: [22] }), K(0.2, { fl: [-0.1, 0.3, 0.18, 50], fr: [-0.2, 0.22, -0.18, 50], hd: [20] })], 30);
  C.UpBDive = dive(false); C.UpBDiveE = dive(true); }
/* the plunge's landing: the axe driven into the floor ahead, a hard compression with a jolt through him, then up again and
   the axe back over his shoulder */
C.UpLand = keys([{ t: 0, use: ['stand', 'crouch'], pose: B({ hp: [0, -0.42, 0.06], hr: [12, 0, 0], sp: [30], ch: [16], hd: [-16], ax: AXHIT('uspecL', 0, -0.2, { two: true, hip: [0, -0.42, 0.06] }) }) },
  K(fr(3), { hp: [0, -0.52, 0.06], sp: [36], ch: [20], hd: [-24] }, 'out'), K(fr(7), { hp: [0, -0.46, 0.06], sp: [32], hd: [-18] }),
  FT(fr(16), { hp: [0, -0.3, 0.02], sp: [20], ax: axe([-0.3, 0.75, 0.42], 0, -1, { two: true, hip: [0, -0.3, 0.02] }) }, 'out'),
  ...STOW(fr(20), fr(24), fr(28), { hp: [0, -0.14, 0], hr: [0, 0, 0], sp: [6], L: [0.36, 1.3, 0.16] }), ...SETTLE(fr(31), fr(36))]);
C.UpLandE = keys([{ t: 0, use: ['stand', 'crouch'], pose: B({ hp: [0, -0.42, 0.06], sp: [30], ch: [16], hd: [-16], R: [0.65, 0.35, -0.18], L: [0.65, 0.35, 0.18] }) },
  K(fr(3), { hp: [0, -0.52, 0.06], sp: [36] }, 'out'), FT(fr(14), { hp: [0, -0.3, 0.04], sp: [22], R: [0.4, 0.8, -0.2], L: [0.4, 0.8, 0.2] }, 'out'), ...SETTLE(fr(26), fr(36))]);
/* Counter: the axe drawn and set crossways in both fists as a compact guard, weight down (window 8 to 29), tense and alive
   (the grip working, the eyes on the opponent), then put back */
const CTR = { hp: [0, -0.18, -0.04], hr: [6, -14, 0], sp: [8], ch: [6, -20], hd: [4, 22], ax: axe([-0.24, 1.0, 0.36], 95, -1, { two: true, hip: [0, -0.18, -0.04], dx: 0.3 }) };
C.Counter = keys([GDK(0), K(fr(3), REACH), ...DRAWS(fr(5)), K(fr(8), CTR, 'out'),
  K(fr(15), { hp: [0, -0.19, -0.05], ch: [7, -22], hd: [4, 26], ax: axe([-0.24, 1.02, 0.36], 97, -1, { two: true, hip: [0, -0.19, -0.05], dx: 0.3 }) }),
  K(fr(22), { hp: [0, -0.18, -0.04], ch: [6, -19], hd: [3, 19], ax: axe([-0.24, 0.99, 0.37], 93, -1, { two: true, hip: [0, -0.18, -0.04], dx: 0.3 }) }),
  K(fr(29), { hp: [0, -0.2, -0.04], ch: [8, -22], hd: [4, 22] }),
  FT(fr(38), { hp: [0, -0.12, 0], sp: [4], ch: [3, -10], hd: [-2, 16], ax: axe([-0.26, 1.2, 0.3], 80, -1, { hip: [0, -0.12, 0] }) }, 'quad'),
  ...STOW(fr(43), fr(48), fr(52), { hp: [0, -0.1, 0], sp: [2], ch: [2, -8], L: [0.36, 1.32, 0.16] }), ...SETTLE(fr(57), fr(67))]);
/* the counter's answer: the haft's butt snaps up under the attacker (4 and 5), then the axe goes back over the shoulder */
C.CounterHit = keys([GDK(0, CTR),
  K(fr(4), { hp: [0, 0.0, 0.1], hr: [-4, 14, 0], sp: [-8], ch: [-10, 10], hd: [-20], fr: [-0.22, 0.06, -0.25, 30], ax: axe([-0.2, 1.62, 0.5], -100, -1, { dx: 0.15 }), L: [0.4, 1.2, 0.2] }, 'snap'),
  K(fr(6), {}), FT(fr(12), { hp: [0, -0.04, 0.04], hr: [0, 0, 0], ch: [-2, -6], fr: [-0.2, 0, -0.25], ax: axe([-0.3, 1.2, 0.4], 70, -1) }, 'out'),
  ...STOW(fr(16), fr(21), fr(26), {}), ...SETTLE(fr(29), fr(34))]);
C.CounterHitE = keys([GDK(0, { hp: [0, -0.2, -0.04], sp: [8], ch: [6, -24], L: [0.36, 1.2, 0.0], R: [0.3, 1.2, -0.2] }),
  K(fr(4), { hp: [0, 0.0, 0.1], sp: [-8], ch: [-10, 10], hd: [-20], R: [0.7, 1.75, -0.12], fr: [-0.22, 0.06, -0.25, 30] }, 'snap'), K(fr(6), {}), FT(fr(14), { hp: [0, -0.06, 0.04], sp: [0], ch: [-2, -4], R: [0.5, 1.4, -0.16] }, 'out'), ...SETTLE(fr(24), fr(34))]);
/* Berserker on or off: the chest thrown open, fists flung wide and the head back in a roar (render3d holds it a while longer) */
C.Berserk = keys([GDK(0), K(fr(2), { hp: [0, -0.18, 0], sp: [10], ch: [8], hd: [6], L: [0.3, 1.0, 0.3], R: [0.3, 0.98, -0.3] }, 'out'),
  K(fr(4), { hp: [0, -0.14, 0], sp: [-12], ch: [-16], hd: [-24], L: [0.1, 1.55, 0.78], R: [0.1, 1.52, -0.78] }, 'snap'), K(fr(8), { hd: [-28], L: [0.08, 1.58, 0.8], R: [0.08, 1.55, -0.8] })]);

/* ---- the hands: how closed each hand is (0 open, 1 a fist), [t, right, left] points eased between. Both are loose fists
   by default; the right takes the axe on the draw and lets it go on the stow; the left closes on the haft in two-handed swings. */
const ARMED = {   /* clip: [draw, stow] (seconds); the hand axe is drawn between them (render3d axeShow) */
  Fsmash: [fr(5), fr(58)], Usmash: [fr(4), fr(52)], Dsmash: [fr(4), fr(53)], Fair: [fr(5), fr(40)], Bair: [fr(4), fr(31)], Uair: [fr(4), fr(31)],
  Throw: [fr(6), fr(31)], UpB: [fr(4), 99], UpLand: [0, fr(28)], Counter: [fr(5), fr(52)], CounterHit: [0, fr(26)] };
const armedGrip = (nm, two) => { const [d, s] = ARMED[nm], o = [[0, nm === 'UpLand' || nm === 'CounterHit' ? 1 : 0.85, 0.8]];
  if (d > 0) o.push([Math.max(0, d - fr(2)), 0.25, 0.8], [d, 1, 0.8]); if (two) o.push([d + fr(4), 1, 1]);
  if (s < 50) o.push([s - fr(5), 1, two ? 0.8 : 0.8], [s, 1, 0.8], [s + fr(3), 0.85, 0.8]); return o; };
const GRIP = { '*': [[0, 0.85, 0.8]], Grab: [[0, 0.8, 0.8], [fr(7), 0.05, 0.4], [fr(10), 0.95, 0.9]], GrabRun: [[0, 0.8, 0.8], [fr(10), 0.05, 0.4], [fr(13), 0.95, 0.9]], GrabTurn: [[0, 0.8, 0.8], [fr(11), 0.05, 0.4], [fr(14), 0.95, 0.9]],
  Hold: [[0, 0.95, 0.9]], Pummel: [[0, 0.95, 1]], ThrowF: [[0, 0.95, 0.9], [fr(10), 0.3, 0.3], [fr(13), 0.05, 0.05]], ThrowB: [[0, 0.95, 0.9], [fr(14), 0.1, 0.1]], ThrowU: [[0, 0.95, 0.9], [fr(13), 0.1, 0.1]], ThrowD: [[0, 0.95, 0.9], [fr(20), 1, 1]],
  Beckon: [[0, 0.3, 0.8], [fr(8), 0.05, 0.8], [fr(16), 0.6, 0.8], [fr(24), 0.05, 0.8]], Ledge: [[0, 0.5, 0.85]], Jab: [[0, 0.85, 0.8], [fr(6), 1, 0.9]], Utilt: [[0, 0.85, 0.8], [fr(6), 1, 0.9]],
  FsmashE: [[0, 1, 1]], UsmashE: [[0, 1, 1]], FairE: [[0, 1, 1]], BairE: [[0, 1, 1]], UpBE: [[0, 1, 1]], UpLandE: [[0, 0.3, 0.3]], CounterHitE: [[0, 1, 1]], Berserk: [[0, 0.85, 0.8], [fr(3), 0.0, 0.0], [fr(8), 0.1, 0.1]],
  Launch: [[0, 0.3, 0.3]], LaunchUp: [[0, 0.3, 0.3]], Spike: [[0, 0.3, 0.3]], Tumble: [[0, 0.5, 0.5]], Helpless: [[0, 0.2, 0.2]], Held: [[0, 0.3, 0.3]], Down: [[0, 0.3, 0.3]], Hit: [[0, 0.4, 0.4]], HitHeavy: [[0, 0.3, 0.3]],
  Shield: [[0, 1, 1]], ShieldHit: [[0, 1, 1]], Dtilt: [[0, 0.85, 0.8], [fr(6), 0.1, 0.8]], Getup: [[0, 0.3, 0.3]], Down2: [[0, 0.3, 0.3]] };
GRIP.Idle = [[0, 0.85, 0.8], [1.7, 0.85, 0.8], [1.85, 1, 0.95], [2.1, 0.85, 0.8]];
for (const k of ['Fsmash', 'Usmash', 'Dsmash', 'Fair', 'Bair', 'Uair', 'UpB', 'UpLand', 'Counter', 'CounterHit']) GRIP[k] = armedGrip(k, true);
GRIP.Throw = armedGrip('Throw', false).filter(p => p[0] < fr(30)).concat([[fr(30), 1, 0.8], [fr(31), 0.1, 0.8], [fr(50), 0.6, 0.8]]);
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
const entry = { file: 'assets/vargan/export/vargan-v1.glb', height: 18.5,   /* 7.2 ft: sim.js VARGAN U */
  axe: { file: 'assets/vargan/export/runebreaker.glb', bone: 'axe', len: 2.015, hold: HOLD, bal: 1.105, back: BACK, backBone: 'chest', armed: ARMED },
  blendIn: { Idle: 8, Walk: 6, Run: 5 }, chargeShake: 0.25, overlays: true, carry: { bone: 'handR', drop: 0.72 },
  clips: { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: { clip: 'Walk', stride: 18.4 }, run: { clip: 'Run', stride: 46 }, crouch: { clip: 'Crouch', at: 0.18 }, brake: { clip: 'Land', from: 0.05, to: 0.42 }, jumpsquat: { clip: 'Squat', from: 0, to: 0.1 },
    rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' }, airjump: { clip: 'AirJump', from: 0, to: 0.48 }, helpless: { clip: 'Helpless' }, land: { clip: 'Land', from: 0, to: 0.42 }, landHard: { clip: 'LandHard', from: 0, to: 0.6 },
    shield: { clip: 'Shield', from: 0, to: 0.12 }, shieldHit: { clip: 'ShieldHit', from: 0, to: 0.3 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, hitHeavy: { clip: 'HitHeavy', from: 0, to: 0.8 }, hitBack: { clip: 'HitBack', from: 0, to: 0.6 }, hitHeavyBack: { clip: 'HitHeavyBack', from: 0, to: 0.8 }, launch: { clip: 'Launch', from: 0, to: 0.5 }, launchUp: { clip: 'LaunchUp', from: 0, to: 0.6 }, spike: { clip: 'Spike', from: 0, to: 0.6 },
    tumble: { clip: 'Tumble' }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true }, airdodge: { clip: 'AirDodge', from: 0, to: 0.66 }, dodge: { clip: 'Dodge', from: 0, to: 0.42 }, roll: { clip: 'Roll', from: 0, to: 1.05 },
    ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, pummel: { clip: 'Pummel', from: 0, to: 0.3 }, respawn: { clip: 'Respawn' },
    throw: { clip: 'ThrowF', from: 0, to: fr(39) }, throw_f: { clip: 'ThrowF', from: 0, to: fr(39) }, throw_b: { clip: 'ThrowB', from: 0, to: fr(49) }, throw_u: { clip: 'ThrowU', from: 0, to: fr(43) }, throw_d: { clip: 'ThrowD', from: 0, to: fr(39) },
    upb: { clip: 'UpB', from: 0, to: 1 }, upbE: { clip: 'UpBE', from: 0, to: 1 }, upbDive: { clip: 'UpBDive' }, upbDiveE: { clip: 'UpBDiveE' } },
  /* the axe's arc while a blade hit is out (render3d bladeArc): from where the blade starts on the haft to the middle of its edge */
  blade: { base: 'axeHead', tip: 'axeTip', at: 0, dot: 0, col: 0xffa040, col2: 0xff3a10 },
  fire: { aura: ['chest', 'armR', 'armL', 'shinR', 'shinL', 'head'], fists: ['handR', 'handL'], feet: ['footR', 'footL'], shoulder: 'armR', axe: ['axeHead', 'axeTip'] },
  strikers: [{ bone: 'axeTip', ext: 0.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'handR', ext: 1.2 }, { bone: 'footR', ext: 1.6 }, { bone: 'footL', ext: 1.6 }],
  springs: [{ bones: ['hair'], k: 0.28, d: 0.72, max: 0.45, drag: 0.1 }, { bones: ['fur'], k: 0.34, d: 0.66, max: 0.25, drag: 0.06 },
    { bones: ['flapF'], k: 0.26, d: 0.72, max: 0.5, drag: 0.12 }, { bones: ['flapB'], k: 0.26, d: 0.72, max: 0.55, drag: 0.14 }],
  attacks: { jab: AF('Jab', 7, 8, 26), ftilt: AF('Ftilt', 10, 12, 39), utilt: AF('Utilt', 7, 9, 31), dtilt: AF('Dtilt', 10, 12, 35), dash: AF('Dash', 10, 19, 37),
    fsmash: AF('Fsmash', 24, 27, 66), fsmashE: AF('FsmashE', 27, 29, 63), usmash: AF('Usmash', 20, 24, 61), usmashE: AF('UsmashE', 19, 22, 54), dsmash: AF('Dsmash', 16, 28, 61), dsmashE: AF('DsmashE', 16, 27, 55),
    nair: AF('Nair', 7, 26, 40), fair: AF('Fair', 17, 20, 48), fairE: AF('FairE', 14, 19, 44), bair: AF('Bair', 12, 14, 39), bairE: AF('BairE', 10, 12, 35), uair: AF('Uair', 11, 15, 39), uairE: AF('UairE', 11, 15, 33), dair: AF('Dair', 16, 18, 44),
    grab: AF('Grab', 8, 10, 38), dgrab: AF('GrabRun', 11, 13, 46), pgrab: AF('GrabTurn', 12, 14, 41), getup: AF('Getup', 16, 19, 40), ledgeatk: AF('LedgeAtk', 23, 25, 55),
    nspec: AF('Throw', 30, 30, 66), nspecE: AF('Beckon', 8, 8, 24), sspec: AF('Meteor', 15, 40, 57), uspec: AF('UpB', 10, 60, 60), uspecE: AF('UpBE', 10, 60, 60), uspecL: AF('UpLand', 1, 4, 36), uspecLE: AF('UpLandE', 1, 4, 36),
    dspec: AF('Counter', 8, 29, 67), dspecHit: AF('CounterHit', 4, 5, 34), dspecHitE: AF('CounterHitE', 4, 5, 34), berserk: AF('Berserk', 4, 4, 8), '*': AF('Jab', 7, 8, 26) } };
const mf = path.join(ROOT, 'assets', 'manifest.json'), cur = JSON.parse(fs.readFileSync(mf, 'utf8'));
cur.Fyrdsman = entry; fs.writeFileSync(mf, JSON.stringify(cur, null, 1) + '\n'); console.log('manifest: ' + Object.keys(cur).join(', '));
