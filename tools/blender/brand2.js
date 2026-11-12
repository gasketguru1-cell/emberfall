// Writes the skeleton and animation spec for Brand's swordsman rework (the owner's Crimson Gearblade model,
// assets/brand/work/brand2-rig.json), which tools/blender/rig.py turns into a rigged, animated model.
//   node tools/blender/brand2.js [test]
//   bash tools/blender/build-brand2.sh [shots.json outdir]
// Plan: plans/brand-animation-plan.md. Timing: assets/brand/reference/framedata.json (Melee Marth frame numbers);
// mechanics: assets/brand/reference/notes.md. Every clip is keyed by frame at 60 fps (F(n) is frame n, frame 1 = t 0),
// so a hitbox's first active frame is exactly the frame the blade arrives.
// Hands and feet follow targets (c_handR, c_handL, c_footR, c_footL) with IK. All four hang off the root, so a pose
// gives each wrist and ankle its exact place, whatever the hips and chest do: the blade can be put on a hitbox exactly.
// The sword is held, not floated: it is rigid in the right fist (fingers closed round the grip), and the right hand turns
// with c_sword, so hand and blade move as one. A pose gives where the GRIP is (HR) and which way the blade points (SW);
// the wrist target is worked out from those (see the end of the file). Two-handed keys close the left fist on the pommel.
// Directions: x is his left, y is up, z is forward. In the game he is seen from his right side.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
const AIM = (x, y, z, twist) => ({ aim: [x, y, z], twist: twist || 0 });
const F = n => (n - 1) / 60;
const add = (a, b, k) => a.map((v, i) => v + b[i] * (k === undefined ? 1 : k));
const unit3 = a => { const l = Math.hypot(...a); return a.map(v => v / l); };

/* measured on the prepped mesh (tools/blender/brand2-prep.py, slices): metres, feet on y = 0, facing +z, his right is -x */
const SHR = [-0.2, 1.44, 0.02], ELR = [-0.40, 1.29, 0.03], WR = [-0.595, 1.115, 0.06], HTR = [-0.652, 1.04, 0.10];
const mir = a => [-a[0], a[1], a[2]];
const SHL = mir(SHR), ELL = mir(ELR), WL = mir(WR), HTL = mir(HTR);
/* The hand at rest (measured, hand views with a 1 cm grid): fingers point out and down, the four in a row front to back
   (index at z 0.143 ... little finger at z 0.059), knuckles at x -0.652 y 1.04, the thumb in front; the palm faces his
   thigh (+x, down). A fist closes round a grip that runs forward through the curl, just inside the knuckles. */
const GRIP = [-0.624, 1.044, 0.10], TIP = [-0.624, 1.044, 1.071];   /* brand2-assemble.py puts the grip's middle here, blade forward */
const KN = [-0.652, 1.04], MID = [-0.675, 1.008], FT = [-0.698, 0.975], FZ = { I: 0.143, M: 0.113, R: 0.086, P: 0.059 };
const fingers = s => { const k = s === 'R' ? 1 : -1, out = [];
  for (const [f, z] of Object.entries(FZ)) {
    out.push({ name: 'f' + f + s + 1, head: [KN[0] * k, KN[1], z], tail: [MID[0] * k, MID[1], z], parent: 'hand' + s });
    out.push({ name: 'f' + f + s + 2, head: [MID[0] * k, MID[1], z], tail: [FT[0] * k, FT[1], z], parent: 'f' + f + s + 1, connect: true });
  }
  out.push({ name: 'th' + s + 1, head: [-0.6 * k, 1.07, 0.14], tail: [-0.59 * k, 1.045, 0.16], parent: 'hand' + s });
  out.push({ name: 'th' + s + 2, head: [-0.59 * k, 1.045, 0.16], tail: [-0.583 * k, 1.018, 0.18], parent: 'th' + s + 1, connect: true });
  return out; };
const leg = (s, hip, knee, ankle, ball, toe) => [
  { name: 'thigh' + s, head: hip, tail: knee, parent: 'hips' },
  { name: 'shin' + s, head: knee, tail: ankle, parent: 'thigh' + s, connect: true },
  { name: 'foot' + s, head: ankle, tail: ball, parent: 'shin' + s, connect: true },
  { name: 'toe' + s, head: ball, tail: toe, parent: 'foot' + s, connect: true },
  { name: 'c_foot' + s, head: ankle, tail: add(ankle, [0, 0, 0.12]), parent: 'all', deform: false },
  /* the foot's rest line on its control: the foot copies it, so a pose turns the foot (heel up, toes down) about the ankle */
  { name: 'c_sole' + s, head: ankle, tail: ball, parent: 'c_foot' + s, deform: false }];
/* the long coat: front, side and back panels from the waist to the knee, two bones each, lying the same way as the thigh
   (so copying the thigh's turn moves nothing at rest); each follows its thigh part of the way, the hem more than the top */
const COAT = { F: [0.17, 0.55, 0.75], S: [0.02, 0.4, 0.55], B: [-0.14, 0.35, 0.5] };
const coat = s => { const k = s === 'R' ? -1 : 1, d = unit3([0.09 * k, -0.42, 0.02]), out = [];
  for (const [w, [z, top, hem]] of Object.entries(COAT)) {
    const x = w === 'S' ? 0.2 * k : 0.1 * k, h0 = [x, 0.95, z], h1 = add(h0, d, 0.23), h2 = add(h1, d, 0.23);
    out.push({ name: 'coat' + w + s + 1, head: h0, tail: h1, parent: 'hips', follow: top },
             { name: 'coat' + w + s + 2, head: h1, tail: h2, parent: 'coat' + w + s + 1, connect: true, follow: hem });
  }
  return out; };
const arm = (s, sh, el, wr, ht) => [
  { name: 'clav' + s, head: [sh[0] * 0.3, 1.43, 0.0], tail: sh, parent: 'chest2' },
  { name: 'arm' + s, head: sh, tail: el, parent: 'clav' + s, connect: true },
  { name: 'fore' + s, head: el, tail: wr, parent: 'arm' + s, connect: true },
  { name: 'hand' + s, head: wr, tail: ht, parent: 'fore' + s, connect: true },
  { name: 'foreTw' + s, head: el.map((v, i) => (v + wr[i]) / 2), tail: wr, parent: 'fore' + s },
  { name: 'c_hand' + s, head: wr, tail: add(wr, [0, 0, 0.12]), parent: 'all', deform: false }];   /* on the root: a pose puts the wrist exactly where it says */
/* the cape: three chains of four down his back, from the shoulders to the hem */
const cape = (s, x0, x1) => {
  const ys = [1.42, 1.13, 0.85, 0.57, 0.3], zs = [-0.15, -0.2, -0.24, -0.27, -0.3], out = [];
  for (let i = 0; i < 4; i++) out.push({ name: 'cape' + s + (i + 1), head: [x0 + (x1 - x0) * i / 4, ys[i], zs[i]], tail: [x0 + (x1 - x0) * (i + 1) / 4, ys[i + 1], zs[i + 1]], parent: i ? 'cape' + s + i : 'chest2', connect: !!i });
  return out;
};
const spec = {
  note: 'Brand (Crimson Gearblade): metres after brand2-prep.py (feet on y = 0, facing +Z, his right is -X).',
  parts: [{ object: 'Sword', bone: 'sword' }],
  heatScale: 10,
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'hips', head: [0, 0.93, 0], tail: [0, 1.05, 0], parent: 'all' },
    { name: 'spine', head: [0, 1.05, 0], tail: [0, 1.135, 0], parent: 'hips', connect: true },
    { name: 'spine2', head: [0, 1.135, 0], tail: [0, 1.22, 0], parent: 'spine', connect: true },
    { name: 'chest', head: [0, 1.22, 0], tail: [0, 1.335, -0.005], parent: 'spine2', connect: true },
    { name: 'chest2', head: [0, 1.335, -0.005], tail: [0, 1.45, -0.01], parent: 'chest', connect: true },
    { name: 'neck', head: [0, 1.45, -0.01], tail: [0, 1.57, 0], parent: 'chest2', connect: true },
    { name: 'head', head: [0, 1.57, 0], tail: [0, 1.83, 0.02], parent: 'neck', connect: true },
    ...arm('R', SHR, ELR, WR, HTR), ...arm('L', SHL, ELL, WL, HTL), ...fingers('R'), ...fingers('L'),
    { name: 'sword', head: GRIP, tail: TIP, parent: 'handR' },
    { name: 'swordTip', head: TIP, tail: add(TIP, [0, 0, 0.06]), parent: 'sword', connect: true, deform: false },
    { name: 'c_sword', head: GRIP, tail: TIP, parent: 'all', deform: false },
    /* ride on c_sword with the hands' rest orientation: a hand copying one turns exactly as the sword turns */
    { name: 'c_palmR', head: WR, tail: HTR, parent: 'c_sword', deform: false },
    { name: 'c_palmL', head: WL, tail: HTL, parent: 'c_sword', deform: false },
    /* where the left wrist goes to hold the grip just behind the right fist: rides on the sword itself, so the left hand
       finds the grip wherever the right arm has actually put it */
    { name: 'c_holdL', head: [-0.653, 1.115, -0.045], tail: [-0.653, 1.115, 0.075], parent: 'sword', deform: false },
    ...leg('R', [-0.11, 0.92, 0], [-0.2, 0.5, 0.02], [-0.235, 0.1, -0.02], [-0.245, 0.035, 0.075], [-0.25, 0.02, 0.165]),
    ...leg('L', [0.11, 0.92, 0], [0.2, 0.5, 0.02], [0.25, 0.1, -0.02], [0.255, 0.035, 0.075], [0.26, 0.02, 0.165]),
    ...coat('R'), ...coat('L'),
    ...cape('L', 0.18, 0.4), ...cape('C', 0, 0), ...cape('R', -0.18, -0.4)],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_holdL', bone: 'foreL', chain: 2, influence: 0 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
  copyrot: [{ bone: 'handR', from: 'c_palmR' }, { bone: 'handL', from: 'c_palmL', influence: 0 },
    { bone: 'foreTwR', from: 'handR', space: 'LOCAL', axes: [false, true, false], influence: 0.5 },
    { bone: 'foreTwL', from: 'handL', space: 'LOCAL', axes: [false, true, false], influence: 0.5 },
    { bone: 'footR', from: 'c_soleR' }, { bone: 'footL', from: 'c_soleL' }],
  rigid: [{ bone: 'sword', part: 'Sword', only: true }, { bone: 'head', box: [[-0.2, 1.6, -0.24], [0.2, 1.9, 0.2]] }],
  poses: {}, clips: {},
};
for (const b of spec.bones) if (b.follow) { spec.copyrot.push({ bone: b.name, from: 'thigh' + b.name[5], influence: b.follow }); delete b.follow; }

/* ---- helpers ---- */
/* where the sword's GRIP goes (model space: z forward, y up, x to his left); the wrist is worked out from it */
const HR = (z, y, x) => ({ grip: [x === undefined ? -0.3 : x, y, z] });
/* where the free left wrist goes */
const HL = (z, y, x) => M((x === undefined ? 0.2 : x) - WL[0], y - WL[1], z - WL[2]);
/* a foot's ankle: forward z and height y from where it stands at rest */
const FR = (z, y, x, p) => p === undefined ? M(x || 0, y || 0, z) : RM(p, 0, 0, x || 0, y || 0, z), FL = FR;
/* an ankle put at a place: z forward, y its height above the floor, p the foot's turn (+ = toes down), x across (default:
   a little inside where it stands at rest) */
const ANK = { R: [-0.235, 0.1, -0.02], L: [0.25, 0.1, -0.02] };
const FOOT = (sd, z, y, p, x) => FR(z - ANK[sd][2], y - ANK[sd][1], (x === undefined ? (sd === 'R' ? -0.15 : 0.15) : x) - ANK[sd][0], p);
const TW = 90;   /* the blade's flat to the camera (side view); 0 shows its edge */
const SW = (y, z, x, tw) => AIM(x || 0, y, z, tw === undefined ? TW : tw);
/* the left fist on the grip just behind the right, for a two-handed hold (worked out with the right hand's) */
const POMMEL = () => ({ pommel: true });
/* fists: f1, f2 = how far each finger joint closes (degrees), t1, t2 = the thumb's */
const FIST = (s, f1, f2, t1, t2) => { const k = s === 'R' ? 1 : -1, o = {}; for (const f of Object.keys(FZ)) { o['f' + f + s + 1] = R(0, 0, k * f1); o['f' + f + s + 2] = R(0, 0, k * f2); }
  o['th' + s + 1] = R(0, 0, k * t1); o['th' + s + 2] = R(0, 0, k * t2); return o; };
const GRIPPED = FIST('R', 95, 80, 35, 30), HOLDL = Object.assign(FIST('L', 95, 80, 35, 30), { handL: { cinf: 1 }, foreL: { iinf: { c_holdL: 1 } } }), FREEL = Object.assign(FIST('L', 25, 20, 5, 5), { handL: { cinf: 0 }, foreL: { iinf: { c_holdL: 0 } } });
/* the cape: a = how far the top bones lift back (degrees), b = each lower bone, r = spread to the sides */
const CAPE = (a, b, r) => { const o = {}; for (const s of ['L', 'C', 'R']) { const k = s === 'L' ? -1 : s === 'R' ? 1 : 0; o['cape' + s + 1] = R(a, 0, k * (r || 0)); for (let i = 2; i <= 4; i++) o['cape' + s + i] = R(b); } return o; };
/* the cape follows a frame or more behind the body, more toward the hem */
const CL = {}; for (const s of ['L', 'C', 'R']) for (let i = 1; i <= 4; i++) CL['cape' + s + i] = i;
const P = spec.poses, C = spec.clips;
P.rest = { all: {}, hips: {}, spine: {}, chest: {}, neck: {}, head: {}, clavR: {}, clavL: {}, c_handR: {}, c_handL: {}, c_footR: {}, c_footL: {}, toeR: {}, toeL: {}, c_sword: {}, ...CAPE(0, 0), ...GRIPPED, ...FREEL };
/* the ready stance: side-on (right side forward), knees soft, sword low in front with the point a little up */
P.guard = { hips: RM(0, 25, 0, 0, -0.07, 0), spine: R(4), chest: R(4, 10), head: R(0, -32), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.17, 0, 0.04),
  c_handR: HR(0.3, 0.98, -0.3), c_handL: HL(0.12, 1.02, 0.17), c_sword: SW(0.3, 1), ...CAPE(4, 2) };
/* in the air: knees drawn up, sword ready in front */
P.air = { hips: RM(0, 15, 0, 0, 0, 0), spine: R(10), chest: R(2, 5), head: R(-4, -20), c_footR: FR(0.14, 0.3), c_footL: FL(-0.08, 0.2, 0.04),
  c_handR: HR(0.22, 1.0, -0.3), c_handL: HL(0.1, 1.1, 0.2), c_sword: SW(0.15, 1), ...CAPE(14, 6) };
const G = ['rest', 'guard'], AIR = ['rest', 'air'];

/* ======== the five proof clips (plans/brand-animation-plan.md section 8) ======== */

/* Forward air: 33 frames, the blade's arc on 4-7 (over his head, in front, below), IASA 30, lands clean from 27.
   Wound up behind his head by frame 3, so the whole arc happens inside the active frames: overhead and forward on 4,
   level in front on 5, below in front on 6, under him on 7, and trailing low behind on 9. The chest does the swing over
   quiet hips; hip height never changes. */
C.AirF = { fps: 60, keys: [
  { t: F(1), reset: true, use: AIR },
  { t: F(2), pose: { c_handR: HR(0.06, 1.38, -0.3), c_sword: SW(0.95, 0.3), chest: R(-6, 20), head: R(-6, -36), c_footR: FOOT('R', 0.08, 0.38, 30, -0.2), c_footL: FOOT('L', -0.12, 0.42, 50, 0.2) } },
  { t: F(3), pose: { hips: RM(4, 15, 0, 0, 0, 0), c_handR: HR(0.0, 1.72, -0.25), c_sword: SW(0.72, -0.69), chest: R(-12, 30), spine: R(2), c_footR: FOOT('R', 0.08, 0.3, 38, -0.2), c_footL: FOOT('L', -0.2, 0.58, 85, 0.2), ...CAPE(20, 8) }, lag: CL },
  { t: F(4), pose: { hips: RM(10, 15, 0, 0, 0, 0), c_handR: HR(0.28, 1.86, -0.25), c_sword: SW(0.82, 0.57), chest: R(-2, 16), spine: R(10), head: R(-6, -20), c_footR: FOOT('R', 0.1, 0.2, 45, -0.19), c_footL: FOOT('L', -0.28, 0.7, 115, 0.2), ...CAPE(30, 12) }, lag: CL },
  { t: F(5), pose: { hips: RM(16, 15, 0, 0, 0, 0), c_handR: HR(0.6, 1.5, -0.22), c_sword: SW(0.05, 1), chest: R(12, -2), spine: R(16), head: R(-14, -12) }, lag: CL },
  { t: F(6), pose: { hips: RM(20, 15, 0, 0, 0, 0), c_handR: HR(0.52, 1.08, -0.22), c_sword: SW(-0.75, 0.66), chest: R(20, -16), spine: R(18), head: R(-22, -10) }, lag: CL },
  { t: F(7), pose: { hips: RM(22, 15, 0, 0, 0, 0), c_handR: HR(0.38, 0.92, -0.24), c_sword: SW(-1, -0.05), chest: R(20, -20), spine: R(18), head: R(-26, -8) }, lag: CL },
  { t: F(9), pose: { hips: RM(24, 15, 0, 0, 0, 0), c_handR: HR(0.22, 0.95, -0.26), c_sword: SW(-0.8, -0.6), chest: R(20, -20), spine: R(18), head: R(-28, -8), ...CAPE(24, 10) }, lag: CL, in: 'out' },
  { t: F(12), pose: { hips: RM(24, 15, 0, 0, 0, 0), c_handR: HR(0.14, 0.98, -0.28), c_sword: SW(-0.55, -0.85), chest: R(18, -15), spine: R(16) }, lag: CL },
  { t: F(22), pose: { hips: RM(22, 15, 0, 0, 0, 0), c_handR: HR(0.12, 1.0, -0.28), c_sword: SW(-0.5, -0.87), chest: R(16, -12), spine: R(16), c_footR: FOOT('R', 0.08, 0.22, 42, -0.19), c_footL: FOOT('L', -0.26, 0.66, 108, 0.2), ...CAPE(16, 6) }, lag: CL },
  { t: F(25), pose: { hips: RM(14, 15, 0, 0, 0, 0), c_handR: HR(0.18, 1.0, -0.28), c_sword: SW(-1, 0.25), chest: R(12, 0), spine: R(14), head: R(-16, -14), c_footR: FOOT('R', 0.1, 0.3, 38, -0.2), c_footL: FOOT('L', -0.18, 0.52, 80, 0.2) }, lag: CL },
  { t: F(30), reset: true, use: AIR, lag: CL },
  { t: F(33), use: AIR }] };

/* Forward smash: 49 frames; charge holds on frame 4; the blade's arc on 10-13, from over his head to the floor in front.
   Two hands on the sword. He drives forward about a metre in one long step: the front foot reaches out on 7-9, the hips
   follow and drop to about half height as the blade comes down (hips 8, chest 9, blade 10), the back foot drags in after.
   The low lunge is held still through the end lag, then he pushes back off the front foot to where he started (34-47):
   the root never moves, so he ends where the game put him. */
{
  const two = (z, y, x, d, extra) => Object.assign({ c_handR: HR(z, y, x), c_sword: SW(d[1], d[2], d[0]), c_handL: POMMEL(), ...HOLDL }, extra);
  C.SmashF = { fps: 60, keys: [
    { t: F(1), reset: true, use: G },
    { t: F(2), pose: { hips: RM(0, 15, 0, 0, -0.12, -0.03), spine: R(6), c_handR: HR(0.22, 1.04, -0.29), c_sword: SW(0.5, 0.86) } },
    { t: F(3), pose: { hips: RM(0, 10, 0, 0, -0.18, -0.06), spine: R(8), chest: R(4, -5), c_handR: HR(0.06, 1.2, -0.27), c_sword: SW(0.85, 0.5), c_handL: HL(0.06, 1.12, 0.0) } },
    { t: F(4), pose: two(-0.1, 1.3, 0, [0, 1, -0.15], { hips: RM(0, -15, 0, 0, -0.22, -0.1), spine: R(-4), chest: R(-10, -35), head: R(-2, 10), c_footL: FL(-0.22, 0, 0.04), c_footR: FR(0.12, 0.03, 0.02), ...CAPE(8, 3) }) },
    { t: F(6), pose: two(-0.2, 1.52, 0, [0, 0.5, -0.86], { chest: R(-14, -40), hips: RM(0, -20, 0, 0, -0.16, -0.06), c_footR: FR(0.2, 0.1, 0.02) }) },
    { t: F(7), pose: two(-0.1, 1.6, 0, [0, 0.42, -0.9], { hips: RM(0, -10, 0, 0, -0.14, 0.12), chest: R(-12, -38), c_footR: FR(0.55, 0.14, 0.02) }) },
    { t: F(8), pose: two(0.12, 1.66, 0, [0, 0.62, -0.78], { hips: RM(0, 10, 0, 0, -0.2, 0.38), chest: R(-8, -32), c_footR: FR(0.9, 0.08, 0.02), ...CAPE(20, 6) }), lag: CL },
    { t: F(9), pose: two(0.45, 1.66, 0, [0, 0.96, -0.28], { hips: RM(0, 22, 0, 0, -0.3, 0.68), chest: R(2, -20), head: R(0, -10), c_footR: FR(1.06, 0.02, 0.02), c_footL: FL(-0.1, 0.02, 0.04), ...CAPE(34, 10) }), lag: CL },
    { t: F(10), pose: two(1.0, 1.5, 0, [0, 0.72, 0.69], { hips: RM(4, 30, 0, 0, -0.38, 0.86), chest: R(16, -15), spine: R(8), c_footR: FR(1.14, 0, 0.02), c_footL: FL(0.12, 0.02, 0.04, 25) }), lag: CL },
    { t: F(11), pose: two(1.42, 0.98, 0, [0, -0.2, 0.98], { hips: RM(10, 30, 0, 0, -0.46, 0.93), chest: R(30, -12), spine: R(16), head: R(-20, -40), c_footL: FL(0.22, 0.03, 0.04, 35), ...CAPE(44, 15) }), lag: CL },
    { t: F(12), pose: two(1.48, 0.45, 0, [0, -0.5, 0.87], { hips: RM(14, 20, 0, 0, -0.54, 0.96), chest: R(30, -6), spine: R(16) }), lag: CL },
    { t: F(13), pose: two(1.45, 0.14, 0.09, [0, -0.12, 0.99], { hips: RM(20, 10, 0, 0, -0.61, 0.98), chest: R(36, -2), spine: R(20), head: R(-44, -20), c_footL: FL(0.26, 0.03, 0.04, 40) }), lag: CL },
    { t: F(15), pose: two(1.44, 0.13, 0.09, [0, -0.12, 0.99], { hips: RM(20, 10, 0, 0, -0.61, 0.98) }), lag: CL, in: 'out' },
    { t: F(33), pose: two(1.42, 0.15, 0.09, [0, -0.13, 0.99], { hips: RM(19, 11, 0, 0, -0.59, 0.96), ...CAPE(10, 4) }), lag: CL },
    /* push back off the front foot: the hips lead, the sword comes up and round to his side, the left hand lets go */
    { t: F(37), pose: { ...FREEL, hips: RM(8, 28, 0, 0, -0.36, 0.6), chest: R(24, 10), spine: R(14), head: R(-24, -40), c_handR: HR(1.0, 0.62, -0.3), c_sword: SW(-0.3, 0.95), c_handL: HL(0.6, 0.85, 0.15), c_footL: FL(0.0, 0.04, 0.04, 20), ...CAPE(16, 6) }, lag: CL },
    { t: F(41), pose: { hips: RM(2, 26, 0, 0, -0.16, 0.22), chest: R(8, 12), spine: R(6), head: R(-6, -36), c_handR: HR(0.55, 0.92, -0.3), c_sword: SW(0.0, 1), c_handL: HL(0.25, 1.0, 0.16), c_footR: FR(0.45, 0.12, 0.02), c_footL: FL(-0.16, 0, 0.04) }, lag: CL },
    { t: F(45), pose: { hips: RM(0, 25, 0, 0, -0.08, 0.02), c_footR: FR(0.17, 0.01, 0.02) }, lag: CL },
    { t: F(47), reset: true, use: G, lag: CL },
    { t: F(49), use: G }] };
}

/* Neutral air: 49 frames; a flat cut across his front at waist height on 6-7 (wound back low on his right, swept through
   level to his left), then the whole body turns once round with the blade out level at hip height on 15-21 (wider and
   faster: the second hit reads as its own). Lands clean before 6 and from 25. */
C.AirN = { fps: 60, keys: [
  { t: F(1), reset: true, use: AIR },
  { t: F(2), pose: { hips: RM(26, 15, 0, 0, 0, 0), spine: R(28), head: R(-28, -20), c_footR: FOOT('R', -0.08, 0.4, 50, -0.18), c_footL: FOOT('L', -0.04, 0.5, 45, 0.18) } },
  { t: F(4), pose: { c_handR: HR(0.08, 1.06, -0.36), c_sword: SW(-0.1, 0.15, -0.98), hips: RM(30, 15, 0, 0, 0, 0), chest: R(24, 30), spine: R(30), head: R(-32, -25), c_footR: FOOT('R', -0.24, 0.32, 75, -0.18), c_footL: FOOT('L', -0.1, 0.66, 60, 0.18) } },
  { t: F(5), pose: { c_handR: HR(0.24, 1.0, -0.4), c_sword: SW(-0.1, 0.4, -0.91), chest: R(24, 22) }, lag: CL },
  { t: F(6), pose: { c_handR: HR(0.5, 0.95, -0.2), c_sword: SW(-0.1, 1), chest: R(24, 0), spine: R(30), ...CAPE(20, 8, 10) }, lag: CL },
  { t: F(7), pose: { c_handR: HR(0.42, 1.0, 0.04), c_sword: SW(-0.08, 0.5, 0.86), chest: R(24, -28) }, lag: CL },
  { t: F(9), pose: { c_handR: HR(0.26, 1.06, 0.06), c_sword: SW(0, -0.1, 1), chest: R(24, -35), head: R(-32, -20), c_footR: FOOT('R', -0.24, 0.32, 75, -0.18), c_footL: FOOT('L', -0.1, 0.66, 60, 0.18) }, lag: CL, in: 'out' },
  { t: F(13), pose: { all: R(0, 0), c_handR: HR(0.22, 1.08, -0.44), c_sword: SW(-0.05, 0, -1), chest: R(24, 20), spine: R(30), head: R(-32, -30), c_footR: FOOT('R', -0.1, 0.46, 65, -0.18), c_footL: FOOT('L', 0.0, 0.6, 50, 0.18) }, lag: CL },
  { t: F(15), pose: { all: R(0, 70), c_handR: HR(0.22, 1.06, -0.45), c_sword: SW(-0.1, 0.1, -1), ...CAPE(45, 12, 30) }, lag: CL },
  { t: F(17), pose: { all: R(0, 160) }, lag: CL },
  { t: F(19), pose: { all: R(0, 250) }, lag: CL },
  { t: F(21), pose: { all: R(0, 330) }, lag: CL },
  { t: F(23), pose: { all: R(0, 360), c_handR: HR(0.2, 1.1, -0.4), c_sword: SW(0, 0.6, -0.8), c_footR: FOOT('R', 0.04, 0.4, 50, -0.18), c_footL: FOOT('L', -0.06, 0.5, 55, 0.18) }, lag: CL, in: 'out' },
  { t: F(26), pose: { c_handR: HR(0.18, 1.1, -0.4), c_sword: SW(0.05, 0.8, -0.6), chest: R(14, 10), spine: R(18), hips: RM(12, 15, 0, 0, 0, 0), head: R(-18, -22), c_footR: FOOT('R', 0.08, 0.34, 40, -0.2), c_footL: FOOT('L', -0.08, 0.42, 45, 0.2), ...CAPE(20, 8) }, lag: CL },
  { t: F(34), reset: true, use: AIR, lag: CL },
  { t: F(49), use: AIR }] };

/* Run legs. One foot's step over the 16 frames, as [frame, forward of the hips, ankle height above the floor, foot turn];
   the other foot is the same 8 frames later. He runs on the balls of his feet (heels never down) with the feet kept
   under and behind his leaning body; the ankle never gets ahead of the hips, it is the knee that drives forward. The
   foot lands under the hips (1), is pushed back at the run speed (RUNV metres a frame, so it stays put on the floor while
   the game moves him) until the toes leave the floor (4), stretches out long behind with the toes pointing back (6-8),
   and comes back through low under him, knee leading (10-14), to settle onto the next landing (16-17). */
const RUNV = 0.2, RUN_HZ = 0.04;
const STEP = [[1, -0.05, 0.12, 35], [2, -0.25, 0.12, 38], [3, -0.45, 0.12, 45], [4, -0.62, 0.15, 70], [6, -0.7, 0.24, 112],
              [8, -0.6, 0.32, 122], [10, -0.36, 0.34, 98], [12, -0.12, 0.3, 64], [14, 0.0, 0.22, 42], [16, 0.01, 0.15, 36], [17, -0.05, 0.12, 35]];
const stepAt = f => { f = (((f - 1) % 16) + 16) % 16 + 1;
  for (let i = 0; i < STEP.length - 1; i++) { const a = STEP[i], b = STEP[i + 1]; if (f >= a[0] && f <= b[0]) { const k = (f - a[0]) / (b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * k).slice(1); } }
  return STEP[0].slice(1); };
const runLegs = (f, hz) => { const r = stepAt(f), l = stepAt(f + 8);
  return { c_footR: FOOT('R', hz + r[0], r[1], r[2]), c_footL: FOOT('L', hz + l[0], l[1], l[2]) }; };

/* Run: a 16-frame loop (two steps). Very low and leaning, the sword trailing low behind, the free arm pumping. */
{
  const D = -0.38, U = -0.3, keys = [];
  for (let f = 1; f <= 17; f++) {
    const ph = ((f - 1) % 8) / 8;   /* ph: 0 at a landing */
    const hy = D + (U - D) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (ph - 0.15)));   /* lowest just after a landing, highest in the flight */
    const sw = Math.sin(2 * Math.PI * (f - 1) / 16);   /* +1 a quarter after the right foot's landing */
    keys.push({ t: F(f), pose: Object.assign({
      hips: RM(26, 8 * sw, 0, 0, hy, RUN_HZ), spine: R(20), chest: R(10, -20 * sw), head: R(-52, 0),
      c_handR: HR(0.1, 0.86 + hy * 0.6 + 0.03 * sw, -0.26), c_sword: SW(-0.15, -1),
      c_handL: HL(0.22 - 0.3 * sw, 0.98 + hy * 0.6 + 0.06 * Math.abs(sw), 0.18) },
      runLegs(f, RUN_HZ),
      CAPE(55 + 5 * Math.sin(4 * Math.PI * (f - 1) / 16), 10 + 4 * Math.sin(4 * Math.PI * (f - 1) / 16 + 1))) });
  }
  keys[0].reset = true; keys[0].use = 'rest';
  C.Run = { fps: 60, loop: true, keys };
}

/* Run turnaround: 30 frames. The game has already turned him round, so he starts facing the old way (the root turned
   180) and pivots back over his LEFT foot, which lands on its ball at the root's centre (3) and stays put there while
   the root turns (3-11). The right leg, kicked up behind as he runs in, swings round under him with the knee coming
   through and reaches out to land as the first step of the new run (14); the left pushes off and kicks up behind. From
   14 the legs run exactly as the run loop, which starts where this ends. He stays low; the hips lead the turn by two
   frames, the chest follows; the cape swings wide behind. */
{
  const run = { spine: R(20), chest: R(10), head: R(-52, 0), c_sword: SW(-0.15, -1), c_handR: HR(0.1, 0.66, -0.26), c_handL: HL(0.15, 0.82, 0.18) };
  const body = [
    { t: F(1), reset: true, use: 'rest', pose: Object.assign({ all: R(0, 180), hips: RM(26, 0, 0, 0, -0.34, 0.04), ...CAPE(50, 10) }, run) },
    { t: F(3), pose: { hips: RM(6, 0, 0, 0, -0.38, -0.08), spine: R(14), chest: R(6), head: R(-26, 0), c_handR: HR(0.0, 0.72, -0.34), c_handL: HL(0.25, 0.95, 0.25), ...CAPE(25, 8) }, lag: CL },
    { t: F(5), pose: { all: R(0, 150), hips: RM(12, -35, 0, 0, -0.39, -0.04), chest: R(8, 20) }, lag: CL },
    { t: F(7), pose: { all: R(0, 95), hips: RM(18, -25, 0, 0, -0.38, 0), chest: R(10, 10), head: R(-36, -20), c_handR: HR(-0.06, 0.66, -0.34), ...CAPE(35, 10, 30) }, lag: CL },
    { t: F(9), pose: { all: R(0, 45), hips: RM(22, -10, 0, 0, -0.37, 0.02), chest: R(10, 0) }, lag: CL },
    { t: F(11), pose: { all: R(0, 15), hips: RM(24, -4, 0, 0, -0.36, 0.04), spine: R(20), head: R(-48, 0) }, lag: CL },
    { t: F(14), pose: Object.assign({ all: R(0, 0), hips: RM(26, 0, 0, 0, -0.36, 0.04), chest: R(10, 0), ...CAPE(45, 12, 10) }, run), lag: CL, in: 'out' },
    { t: F(18), pose: { hips: RM(26, 6, 0, 0, -0.3, 0.04), chest: R(10, -14) }, lag: CL },
    { t: F(22), pose: { hips: RM(26, -4, 0, 0, -0.35, 0.04), chest: R(10, 10), ...CAPE(55, 10) }, lag: CL },
    { t: F(26), pose: { hips: RM(26, 0, 0, 0, -0.37, 0.04), chest: R(10, 0), c_handR: HR(0.1, 0.66, -0.26) }, lag: CL },
    { t: F(30), pose: {}, lag: CL }];
  /* the legs, keyed on every frame they move: [frame, right ankle [z, y, turn], left ankle [z, y, turn, x]] */
  const PIVOT = [0, 0.12, 30, 0];
  const legs = {
    1: runLegs(7, RUN_HZ),
    2: { c_footR: FOOT('R', -0.56, 0.32, 112), c_footL: FOOT('L', 0.0, 0.14, 34, 0.06) },
    3: { c_footR: FOOT('R', -0.4, 0.33, 105), c_footL: FOOT('L', ...PIVOT) },
    5: { c_footR: FOOT('R', -0.36, 0.38, 100) },
    7: { c_footR: FOOT('R', -0.18, 0.38, 85) },
    9: { c_footR: FOOT('R', -0.02, 0.32, 66) },
    11: { c_footR: FOOT('R', 0.06, 0.24, 46), c_footL: FOOT('L', ...PIVOT) },
    12: { c_footL: FOOT('L', -0.1, 0.2, 62, 0.06) },
    13: { c_footR: FOOT('R', 0.02, 0.16, 38), c_footL: FOOT('L', -0.28, 0.3, 90, 0.12) } };
  for (let f = 14; f <= 30; f++) legs[f] = runLegs(f - 13, RUN_HZ);
  const keys = body.map(k => Object.assign({}, k, { pose: Object.assign({}, k.pose) }));
  for (const [f, lp] of Object.entries(legs)) {
    const at = keys.find(k => Math.abs(k.t - F(+f)) < 1e-9);
    if (at) Object.assign(at.pose, lp); else keys.push({ t: F(+f), only: true, pose: Object.assign({}, lp) });
  }
  keys.sort((a, b) => a.t - b.t);
  C.RunTurn = { fps: 60, keys };
}

if (process.argv[2] === 'test') {
  /* deformation test: every joint to the far end of what the clips will ask of it */
  C.Test = { fps: 60, keys: [
    { t: F(1), use: 'rest' },
    { t: F(30), pose: { c_handR: HR(0.2, 1.85, -0.25), c_handL: HL(-0.2, 1.85, 0.25), c_sword: AIM(0, 1, 0) } },        /* arms overhead */
    { t: F(60), pose: { c_handR: HR(0.5, 1.2, -0.05), c_handL: HL(0.4, 1.1, 0.1), c_sword: AIM(0, 0, 1) } },           /* both hands forward */
    { t: F(90), pose: { hips: M(0, -0.4, 0.1), spine: R(20), c_footR: M(0, 0, 0.45), c_footL: M(0, 0, -0.35), c_handR: HR(0.7, 0.6, -0.3, [0, -0.4, 0.1]), c_sword: AIM(0, -0.3, 1) } },   /* deep lunge */
    { t: F(120), pose: { hips: RM(0, 60, 0, 0, -0.1, 0), chest: R(0, 40), c_footR: M(0, 0, 0.1), c_footL: M(0, 0, -0.05), c_handR: HR(-0.4, 1.1, -0.4), c_sword: AIM(0, -0.5, -1) } },   /* twist, sword behind */
    { t: F(150), pose: { hips: M(0, 0.1, 0), spine: R(30), chest: R(15), head: R(20), c_footR: M(0, 0.45, 0.2), c_footL: M(0, 0.35, 0.15), c_handR: HR(0.3, 0.9, -0.3), c_handL: HL(0.3, 0.9, 0.3), c_sword: AIM(0, 1, 0.2) } },   /* tuck */
    { t: F(180), use: 'rest', reset: true }] };
}

/* Grips to wrists. HR gives where the grip goes and SW which way the blade points; the right hand turns with the sword
   (it copies c_palmR, which rides on c_sword), so the wrist sits at grip - A (GRIP - WR), A being the sword's turn from
   rest (shortest arc from straight forward to the aim, then the twist about the aim, as rig.py does it). A two-handed key
   puts the left fist on the grip 0.105 m behind the right, turned the same way. */
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qrot = (q, v) => qmul(qmul(q, [0, ...v]), [q[0], -q[1], -q[2], -q[3]]).slice(1);
const qnorm = q => { const l = Math.hypot(...q); return q.map(v => v / l); };
const swordTurn = aim => {
  const b = unit3(aim.aim), a = [0, 0, 1], d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const arc = d < -0.9999 ? [0, 0, 1, 0] : qnorm([1 + d, ...c]);
  const h = (aim.twist || 0) * Math.PI / 360, tw = [Math.cos(h), ...b.map(v => v * Math.sin(h))];
  return qmul(tw, arc);
};
const GRIPL = mir(GRIP), sub3 = (a, b) => a.map((v, i) => v - b[i]), add3 = (a, b) => a.map((v, i) => v + b[i]);
/* a pose's turn, as rig.py builds it: about up, then right, then forward, in the model's axes */
const qax = (ax, deg) => { const h = deg * Math.PI / 360, q = [Math.cos(h), 0, 0, 0]; q[ax + 1] = Math.sin(h); return q; };
const qpose = tr => { const r = (tr && tr.rot) || [0, 0, 0]; return qmul(qmul(qax(1, r[1]), qax(0, r[0])), qax(2, r[2])); };
/* where a point on the chest (a shoulder) is once hips, spine and chest are posed (in the root's space) */
const HIPS0 = [0, 0.93, 0], SPINE0 = [0, 1.05, 0], SPINE2 = [0, 1.135, 0], CHEST0 = [0, 1.22, 0], CHEST2 = [0, 1.335, -0.005];
/* a spine or chest turn is shared half and half by its two bones (the split at the end of the file) */
const halfTurn = tr => ({ rot: ((tr && tr.rot) || [0, 0, 0]).map(v => v / 2) });
const onChest = (st, p) => {
  const turn = (q, c, x) => add3(c, qrot(q, sub3(x, c)));
  const ch = qpose(halfTurn(st.chest)), sp = qpose(halfTurn(st.spine));
  let x = turn(ch, CHEST2, p); x = turn(ch, CHEST0, x); x = turn(sp, SPINE2, x); x = turn(sp, SPINE0, x); x = turn(qpose(st.hips), HIPS0, x);
  return add3(x, (st.hips && st.hips.move) || [0, 0, 0]);
};
const REACH = 0.45;   /* shoulder to wrist with the elbow still a little bent (upper arm 0.25, forearm 0.265: 0.515 locked straight) */
const reached = [];
for (const [cname, clip] of Object.entries(C)) {
  let state = {};
  for (const key of clip.keys) {
    if (key.reset) state = {};
    for (const u of (key.use ? [].concat(key.use) : [])) Object.assign(state, P[u]);
    Object.assign(state, key.pose || {});
    const hr = state.c_handR, sw = state.c_sword;
    if (key.only || !hr || !hr.grip || !sw || !sw.aim) continue;
    const A = swordTurn(sw); let wr = sub3(hr.grip, qrot(A, sub3(GRIP, WR)));
    const sh = onChest(state, SHR), d = sub3(wr, sh), L = Math.hypot(...d);
    if (process.env.REACHLOG && L > REACH) console.log(cname, Math.round(key.t * 60 + 1), "shoulder", sh.map(v => v.toFixed(2)).join(","), "wrist", wr.map(v => v.toFixed(2)).join(","));
    if (L > REACH) { wr = add3(sh, d.map(v => v * REACH / L)); reached.push(cname + ' ' + Math.round(key.t * 60 + 1) + ' (' + (L - REACH).toFixed(2) + ')'); }
    key.pose = Object.assign({}, key.pose || {}, { c_handR: M(...sub3(wr, WR)) });
    let wl = state.c_handL && state.c_handL.move ? add3(WL, state.c_handL.move) : null;
    if (state.c_handL && state.c_handL.pommel) {
      /* the hold chain (c_holdL, on the sword) does the work; the free target is put there too so a blend in or out is short */
      const gr = add3(wr, qrot(A, sub3(GRIP, WR))), pg = sub3(gr, qrot(A, [0, 0, 0.105]));
      wl = sub3(pg, qrot(A, sub3(GRIPL, WL)));
      key.pose.c_handL = M(...sub3(wl, WL));
    }
    /* the collarbones: a hand above the shoulder lifts it, a hand out in front brings it forward (a reach uses the back too) */
    const clav = (w, shp, k) => { const r = sub3(w, onChest(state, shp)), up = Math.min(1, Math.max(0, (r[1] + 0.05) / 0.4)), fw = Math.min(1, Math.max(-1, r[2] / 0.4));
      return R(0, k * 12 * fw, -k * 16 * up); };
    key.pose.clavR = clav(wr, SHR, 1);
    if (wl) key.pose.clavL = clav(wl, SHL, -1);
  }
}
if (reached.length) console.log('brand2: grips pulled in to arm\'s reach (key frame, metres short): ' + reached.join(', '));

/* CAPE values are lifts from hanging straight down. The cape hangs from the chest, so a forward lean would lift it the
   same amount again: every key's top cape bones get the lean of hips, spine and chest taken off. */
for (const clip of Object.values(C)) {
  let state = {};
  for (const key of clip.keys) {
    if (key.reset) state = {};
    for (const u of (key.use ? [].concat(key.use) : [])) Object.assign(state, P[u]);
    Object.assign(state, key.pose || {});
    if (key.only) continue;   /* a key of a few bones only: the cape interpolates through it */
    const pitch = b => (state[b] && state[b].rot ? state[b].rot[0] : 0), lean = pitch('hips') + pitch('spine') + pitch('chest');
    const world = {}; for (const s of ['L', 'C', 'R']) world[s] = state['cape' + s + 1] || R(0);
    key.pose = Object.assign({}, key.pose || {});
    for (const s of ['L', 'C', 'R']) { const r = world[s].rot || [0, 0, 0]; key.pose['cape' + s + 1] = R(r[0] - lean, r[1], r[2]); }
    for (const s of ['L', 'C', 'R']) state['cape' + s + 1] = world[s];   /* the next key starts from the world values */
  }
}

/* Feet: a foot off the floor points its toes down (more the higher it is) unless the key turns it itself; a heel that is up
   while the ball is still on the floor bends the toes back so they stay flat. */
for (const clip of Object.values(C)) {
  let state = {};
  for (const key of clip.keys) {
    if (key.reset) state = {};
    for (const u of (key.use ? [].concat(key.use) : [])) Object.assign(state, P[u]);
    Object.assign(state, key.pose || {});
    key.pose = Object.assign({}, key.pose || {});
    for (const sd of ['R', 'L']) {
      if (key.only && !key.pose['c_foot' + sd]) continue;
      const f = state['c_foot' + sd] || {}, y = (f.move || [0, 0, 0])[1];
      let pitch = f.rot ? f.rot[0] : Math.min(35, Math.max(0, (y - 0.03) * 120));
      if (!f.rot && (y > 0.03)) key.pose['c_foot' + sd] = Object.assign({}, f, { rot: [pitch, 0, 0] });
      key.pose['toe' + sd] = R(pitch > 8 && y < 0.12 ? -0.85 * pitch : 0);
    }
  }
}

/* The torso's four bones: each spine or chest turn a pose gives is shared half and half by spine and spine2, chest and
   chest2 (onChest above works the shoulders out the same way). */
const split = pose => { if (!pose) return;
  for (const [a, b] of [['spine', 'spine2'], ['chest', 'chest2']]) if (pose[a]) { const h = halfTurn(pose[a]); pose[a] = Object.assign({}, pose[a], h); pose[b] = h; } };
for (const pz of Object.values(P)) split(pz);
for (const clip of Object.values(C)) for (const key of clip.keys) split(key.pose);

const work = path.join(__dirname, '../../assets/brand/work');
fs.writeFileSync(path.join(work, 'brand2-rig.json'), JSON.stringify(spec, null, 1));
console.log('brand2: %d bones, %d clips -> assets/brand/work/brand2-rig.json', spec.bones.length, Object.keys(C).length);
