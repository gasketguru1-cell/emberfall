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
    /* the right elbow's pole for a rowing pull (the "rowR" chain): behind his back, low; it rides on the chest */
    { name: 'c_elbowR', head: [-0.24, 1.05, -0.5], tail: [-0.24, 1.15, -0.5], parent: 'chest2', deform: false },
    { name: 'c_holdL', head: [-0.653, 1.115, -0.045], tail: [-0.653, 1.115, 0.075], parent: 'sword', deform: false },
    ...leg('R', [-0.11, 0.92, 0], [-0.2, 0.5, 0.02], [-0.235, 0.1, -0.02], [-0.245, 0.035, 0.075], [-0.25, 0.02, 0.165]),
    ...leg('L', [0.11, 0.92, 0], [0.2, 0.5, 0.02], [0.25, 0.1, -0.02], [0.255, 0.035, 0.075], [0.26, 0.02, 0.165]),
    ...coat('R'), ...coat('L'),
    ...cape('L', 0.18, 0.4), ...cape('C', 0, 0), ...cape('R', -0.18, -0.4)],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_holdL', bone: 'foreL', chain: 2, influence: 0 }, { name: 'c_handR', bone: 'foreR', chain: 2, id: 'reachR' }, { name: 'c_handR', bone: 'foreR', chain: 2, id: 'rowR', pole: 'c_elbowR', pole_angle: 60, influence: 0 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
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
/* the right arm's rowing chain (elbow driven straight back toward c_elbowR) on (1) or off (0) */
/* the right wrist put at a place directly (model space), for keys worked out on the body (the rowing pull) */
const WRISTR = (x, y, z) => M(x - WR[0], y - WR[1], z - WR[2]);
const ROW = k => ({ iinf: { rowR: k, reachR: 1 - k } });
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

/* ======== batch 1: movement (plans/brand-animation-plan.md section 9) ========
   Timing from the reference notes (assets/brand/reference/notes.md, "Movement"); poses are Brand's own. */

/* Idle: 72-frame loop on the guard stance, the sword arm hanging relaxed at his side (IDLEARM: the hand down by his
   right hip, elbow soft, the blade resting forward and down with the point toward the floor in front). He breathes: the hips settle a centimetre, the chest
   lifts, the point dips and comes back, the cape drifts a frame behind. Clips that end in the guard end on this arm. */
const IDLEARM = { c_handR: Object.assign(HR(0.19, 0.82, -0.15), { reach: 0.5 }), c_sword: SW(-0.66, 0.75) };
C.Idle = { fps: 60, loop: true, keys: [
  { t: F(1), reset: true, use: G, pose: IDLEARM },
  { t: F(37), pose: { hips: RM(0, 25, 0, 0, -0.082, 0), spine: R(5), chest: R(5.5, 11), head: R(1, -33), c_handR: Object.assign(HR(0.19, 0.81, -0.15), { reach: 0.5 }), c_sword: SW(-0.68, 0.73), c_handL: HL(0.12, 1.005, 0.17), ...CAPE(6, 3) }, lag: CL },
  { t: F(73), reset: true, use: G, pose: IDLEARM, lag: CL }] };

/* Walk: a 48-frame loop (two steps), facing the way he goes, the sword carried low at his right side with the point
   forward and down. Heel strike, flat foot, heel lift, toe off, a low swing through. A planted foot moves back at WALKV a
   frame, so the game turns one cycle every WALK_STRIDE metres and the foot stays put on the floor. The hips are lowest
   just after a heel strike and highest as the other foot passes; the shoulders counter the hips. */
const WALKV = 0.0233, WALK_STRIDE = +(48 * WALKV).toFixed(3);
const WSTEP = [[1, 0.33, 0.11, -18], [4, 0.26, 0.1, 0], [16, -0.02, 0.1, 0], [24, -0.21, 0.13, 18], [29, -0.32, 0.17, 42],
               [34, -0.2, 0.23, 34], [40, 0.1, 0.21, 2], [45, 0.36, 0.15, -14], [49, 0.33, 0.11, -18]];
const wstepAt = f => { f = (((f - 1) % 48) + 48) % 48 + 1;
  for (let i = 0; i < WSTEP.length - 1; i++) { const a = WSTEP[i], b = WSTEP[i + 1]; if (f >= a[0] && f <= b[0]) { const k = (f - a[0]) / (b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * k).slice(1); } }
  return WSTEP[0].slice(1); };
{
  const keys = [];
  for (let f = 1; f <= 49; f++) {
    const c = Math.cos(2 * Math.PI * (f - 1) / 48);            /* +1 at the right heel strike, -1 at the left */
    const b = Math.cos(4 * Math.PI * (f - 4) / 48);            /* +1 just after each strike: the hips low */
    const r = wstepAt(f), l = wstepAt(f + 24);
    keys.push({ t: F(f), pose: {
      hips: RM(4, 8 + 6 * c, 0, 0, -0.065 - 0.022 * b, 0), spine: R(4), chest: R(3, -10 * c), head: R(-6, -8 + 4 * c),
      c_handR: HR(0.12 - 0.07 * c, 0.9 - 0.012 * b, -0.31), c_sword: SW(-0.38 - 0.04 * c, 0.92),
      c_handL: HL(0.06 + 0.16 * c, 0.95 + 0.03 * Math.abs(c) - 0.012 * b, 0.19),
      c_footR: FOOT('R', r[0], r[1], r[2], -0.12), c_footL: FOOT('L', l[0], l[1], l[2], 0.12),
      ...CAPE(8 + 2 * b, 3 + 1.5 * b) } });
  }
  keys[0].reset = true; keys[0].use = 'rest';
  C.Walk = { fps: 60, loop: true, keys };
}

/* Dash: 16 frames out of the guard. He drops and drives off the back foot (pushed back along the floor at DASHV a frame),
   the front knee comes up and through, the sword swings down past his leg to trail behind; lowest on 8 (the reference
   drops to half height by its frame 8), and from 6 the legs run exactly as the run loop does, so the run carries on from
   here. Dash dancing is this clip started again facing the other way. */
const DASHV = 0.17;
{
  const keys = [
    { t: F(1), reset: true, use: G },
    { t: F(2), pose: { hips: RM(10, 16, 0, 0, -0.17, 0.02), spine: R(8), chest: R(4, 4), head: R(-10, -22), c_handR: HR(0.2, 0.86, -0.3), c_sword: SW(-0.6, 0.8),
      c_handL: HL(0.22, 1.02, 0.18), c_footR: FOOT('R', 0.13, 0.2, 30), c_footL: FOOT('L', -0.36, 0.1, 8) } },
    { t: F(3), pose: { c_handR: HR(0.08, 0.81, -0.3), c_sword: SW(-0.72, -0.69), c_handL: HL(0.34, 1.04, 0.18), c_footR: FOOT('R', 0.18, 0.32, 18), c_footL: FOOT('L', -0.53, 0.11, 24), ...CAPE(18, 6) }, lag: CL },
    { t: F(4), pose: { hips: RM(22, 8, 0, 0, -0.32, 0.04), spine: R(16), chest: R(8, -4), head: R(-36, -8), c_handR: HR(0.02, 0.69, -0.28), c_sword: SW(-0.4, -0.92),
      c_footR: FOOT('R', 0.12, 0.26, 30), c_footL: FOOT('L', -0.69, 0.15, 64), ...CAPE(32, 8) }, lag: CL },
    { t: F(5), pose: { c_handR: HR(0.06, 0.66, -0.27), c_sword: SW(-0.15, -1), c_footR: FOOT('R', 0.02, 0.17, 35), c_footL: FOOT('L', -0.72, 0.22, 100) }, lag: CL },
    { t: F(8), pose: { hips: RM(28, 0, 0, 0, -0.42, RUN_HZ), spine: R(20), chest: R(10, 6), head: R(-50, 0), c_handR: HR(0.1, 0.62, -0.26), c_handL: HL(0.0, 0.86, 0.18), ...CAPE(50, 10) }, lag: CL, in: 'out' },
    { t: F(12), pose: { hips: RM(26, -4, 0, 0, -0.33, RUN_HZ), chest: R(10, -8), c_handR: HR(0.1, 0.66, -0.26), c_handL: HL(0.3, 0.92, 0.18) }, lag: CL },
    { t: F(16), pose: { hips: RM(26, 0, 0, 0, -0.36, RUN_HZ), spine: R(20), chest: R(10, 0), head: R(-52, 0), c_handR: HR(0.1, 0.65, -0.26), c_sword: SW(-0.15, -1), c_handL: HL(0.15, 0.9, 0.18), ...CAPE(55, 10) }, lag: CL }];
  for (let f = 6; f <= 16; f++) {
    const at = keys.find(k => Math.abs(k.t - F(f)) < 1e-9), lp = runLegs(f - 5, RUN_HZ);
    if (at) Object.assign(at.pose, lp); else keys.push({ t: F(f), only: true, pose: lp });
  }
  keys.sort((a, b) => a.t - b.t);
  C.Dash = { fps: 60, keys };
}

/* Brake: 26 frames out of the run, the legs as the reference's skid. The right foot goes flat on the floor well out in
   front with that knee up high by his chest; the left knee drops almost to the floor with the shin laid back and the foot
   up on its toes behind, and he slides on that (the feet stay put under him while the floor goes by), hips very low
   (lowest 3-12). From 17 the left knee comes up, the left foot steps in under him and he rises into the guard by 26. The
   sword drags behind, the left arm is out in front for balance, the cape carries on forward over him and settles. */
C.Brake = { fps: 60, keys: [
  { t: F(1), reset: true, use: 'rest', pose: Object.assign({ hips: RM(26, 0, 0, 0, -0.34, RUN_HZ), spine: R(20), chest: R(10, 0), head: R(-52, 0), c_handR: HR(0.1, 0.65, -0.26), c_sword: SW(-0.15, -1), c_handL: HL(0.15, 0.9, 0.18), ...CAPE(55, 10) }, runLegs(1, RUN_HZ)) },
  { t: F(3), pose: { hips: RM(12, 10, 0, 0, -0.49, -0.08), spine: R(10), chest: R(6, 12), head: R(-22, -22), c_handR: HR(-0.12, 0.66, -0.3), c_sword: SW(-0.3, -0.95), c_handL: HL(0.42, 0.66, 0.24),
    c_footR: FOOT('R', 0.24, 0.1, -4, -0.16), c_footL: FOOT('L', -0.52, 0.22, 86, 0.14), ...CAPE(30, 4) }, lag: CL, in: 'out' },
  { t: F(7), pose: { hips: RM(10, 12, 0, 0, -0.5, -0.09), chest: R(6, 14), c_handL: HL(0.4, 0.62, 0.24), ...CAPE(8, -2) }, lag: CL },
  { t: F(12), pose: { hips: RM(8, 14, 0, 0, -0.48, -0.09), chest: R(5, 12), head: R(-16, -26), c_handL: HL(0.36, 0.7, 0.22), ...CAPE(2, 0) }, lag: CL },
  { t: F(14), pose: { c_handR: HR(0.0, 0.7, -0.36), c_sword: SW(-0.2, 0.1, -0.97) } },   /* the sword comes round at his side, not through the floor */
  { t: F(17), pose: { hips: RM(4, 16, 0, 0, -0.32, -0.07), spine: R(6), chest: R(4, 10), head: R(-8, -28), c_handR: HR(0.14, 0.8, -0.3), c_sword: SW(0.05, 1), c_handL: HL(0.24, 0.86, 0.2),
    c_footL: FOOT('L', -0.5, 0.24, 70, 0.14), ...CAPE(4, 2) }, lag: CL },
  { t: F(19), only: true, pose: { c_footL: FOOT('L', -0.34, 0.22, 30, 0.14) } },
  { t: F(21), pose: { hips: RM(1, 22, 0, 0, -0.14, -0.02), spine: R(4), chest: R(4, 10), head: R(-2, -31), c_handR: HR(0.18, 0.86, -0.28), c_sword: SW(0.18, 1), c_handL: HL(0.13, 1.0, 0.17),
    c_footL: Object.assign({}, P.guard.c_footL), c_footR: FOOT('R', 0.2, 0.1, 0, -0.16) }, lag: CL },
  { t: F(26), reset: true, use: G, pose: IDLEARM, lag: CL }] };

/* Crouch: 8 frames from the guard down into a deep crouch (lowest on 6, a small overshoot), leaning well over his
   knees. The sword arm hangs loose with a soft elbow, the hand almost on the floor in front and the blade laid out flat
   just above it; the right foot flat in front, the left knee low with its heel up, the left hand down by the left knee.
   The game holds the last frame. */
P.crouch = { hips: RM(34, 25, 0, 0, -0.52, -0.04), spine: R(18), chest: R(10, 8), head: R(-48, -30), c_handR: HR(0.55, 0.3, -0.05), c_sword: SW(-0.03, 1),
  c_handL: HL(0.34, 0.36, 0.22), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.19, 0.06, 0.04, 40), ...CAPE(6, 2) };
C.Crouch = { fps: 60, keys: [
  { t: F(1), reset: true, use: G, pose: IDLEARM },
  { t: F(3), pose: { hips: RM(14, 25, 0, 0, -0.3, -0.02), spine: R(10), chest: R(6, 10), head: R(-18, -32), c_handR: HR(0.4, 0.66, -0.12), c_sword: SW(0.05, 1), c_handL: HL(0.2, 0.8, 0.2), c_footL: FL(-0.18, 0.03, 0.04, 20) } },
  { t: F(6), use: 'crouch', pose: { hips: RM(36, 25, 0, 0, -0.55, -0.04), c_handR: HR(0.56, 0.28, -0.05), ...CAPE(12, 4) }, lag: CL, in: 'out' },
  { t: F(8), use: 'crouch', lag: CL }] };

/* Jumpsquat: 4 frames. Like the reference, he is already down on frame 1 (no easing in) and goes a little deeper to 4:
   the sword pulled in low, the left arm back, ready to throw up into the jump. */
C.JumpSquat = { fps: 60, keys: [
  { t: F(1), reset: true, use: G, pose: { hips: RM(12, 20, 0, 0, -0.4, 0.02), spine: R(14), chest: R(10, 6), head: R(-20, -28), c_handR: HR(0.22, 0.72, -0.3), c_sword: SW(-0.2, 0.98), c_handL: HL(0.0, 0.82, 0.22),
    c_footL: FL(-0.17, 0.03, 0.04, 25), ...CAPE(8, 3) } },
  { t: F(4), pose: { hips: RM(16, 18, 0, 0, -0.46, 0.03), spine: R(18), chest: R(10, 6), head: R(-26, -28), c_handR: HR(0.18, 0.68, -0.3), c_sword: SW(-0.32, 0.95), c_handL: HL(-0.06, 0.8, 0.22), ...CAPE(12, 4) } }] };

/* Rise: 30 frames from the take-off to the top of the jump (the game plays it by how much of the jump's speed is spent).
   Stretched out straight off the floor (toes pointed, left arm thrown up, sword trailing down behind), then the knees
   draw up and the sword comes round to the ready, arriving in the air pose at the top. */
C.Rise = { fps: 60, keys: [
  { t: F(1), reset: true, use: AIR, pose: { hips: RM(-4, 15, 0, 0, 0.02, 0), spine: R(-4), chest: R(-6, 4), head: R(4, -20), c_handR: HR(0.04, 0.94, -0.3), c_sword: SW(-0.62, -0.78), c_handL: HL(0.26, 1.38, 0.2),
    c_footR: FOOT('R', 0.02, 0.11, 55), c_footL: FOOT('L', -0.12, 0.13, 62), ...CAPE(-2, 0) } },
  { t: F(8), pose: { hips: RM(2, 15, 0, 0, 0.0, 0), spine: R(4), chest: R(-2, 4), head: R(-2, -20), c_handR: HR(0.08, 0.92, -0.32), c_sword: SW(-0.8, 0.5), c_handL: HL(0.2, 1.24, 0.2),
    c_footR: FOOT('R', 0.12, 0.3, 40), c_footL: FOOT('L', -0.12, 0.22, 55), ...CAPE(4, 2) }, lag: CL },
  { t: F(18), pose: { c_handR: HR(0.18, 0.98, -0.3), c_sword: SW(-0.1, 1), c_handL: HL(0.12, 1.14, 0.2), c_footR: FOOT('R', 0.12, 0.42, 38), c_footL: FOOT('L', -0.12, 0.32, 50), ...CAPE(10, 4) }, lag: CL },
  { t: F(30), reset: true, use: AIR, lag: CL }] };

/* Air jump: 50 frames, the reference's two parts. A kick off the air, then one full spin round (1-14) with the sword
   held out level at his right side so the blade sweeps a wide circle round him at hip height; then one forward
   somersault (15-40) laid out long, legs nearly straight and the sword trailing along his side, that also turns once
   round the upright axis as it goes (a twisting flip: two axes at once). It all turns about his middle (FLIP) rather
   than his feet; he opens out into the air pose by 46. */
{
  const FLIP = [0, 0.8, 0.0];
  /* turns as rig.py builds them (yaw about up, after pitch about his right-left axis), to keep FLIP where it was */
  const qm = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  const qa = (ax, deg) => { const h = deg * Math.PI / 360, q = [Math.cos(h), 0, 0, 0]; q[ax + 1] = Math.sin(h); return q; };
  const qr = (q, v) => qm(qm(q, [0, ...v]), [q[0], -q[1], -q[2], -q[3]]).slice(1);
  const turn = (p, y, extra) => { const c = qr(qm(qa(1, y), qa(0, p)), FLIP);
    return Object.assign({ all: RM(p, y, 0, FLIP[0] - c[0], FLIP[1] - c[1], FLIP[2] - c[2]) }, extra); };
  const ease = k => k * k * (3 - 2 * k);
  const spinBody = { hips: RM(8, 15, 0, 0, 0, 0), spine: R(8), chest: R(4, 0), head: R(-10, -15), c_handR: HR(0.24, 0.98, -0.42), c_sword: SW(-0.2, 0.62, -0.76), c_handL: HL(0.1, 1.08, 0.22),
    c_footR: FOOT('R', -0.12, 0.62, 85, -0.15), c_footL: FOOT('L', -0.26, 0.22, 80, 0.15), ...CAPE(20, 8, 20) };
  const layout = { hips: RM(16, 15, 0, 0, 0, 0), spine: R(12), chest: R(6, 4), head: R(-14, -15), c_handR: HR(0.1, 1.06, -0.15), c_sword: SW(-0.45, -0.89), c_handL: HL(0.38, 1.06, 0.26),
    c_footR: FOOT('R', -0.12, 0.26, 70, -0.13), c_footL: FOOT('L', -0.28, 0.32, 78, 0.13), ...CAPE(40, 14) };
  const keys = [
    { t: F(1), reset: true, use: AIR, pose: { all: R(0, 0) } },
    { t: F(3), pose: Object.assign({ all: R(0, 18) }, spinBody, { c_footR: FOOT('R', 0.0, 0.14, 60, -0.15), c_footL: FOOT('L', -0.16, 0.12, 65, 0.15) }) }];
  for (const [f, deg] of [[5, 85], [7, 160], [9, 235], [11, 300], [13, 345]]) keys.push({ t: F(f), pose: Object.assign({ all: R(0, deg) }, f === 5 ? spinBody : {}), lag: CL });
  keys.push({ t: F(15), pose: turn(0, 0, Object.assign({}, layout, { c_footR: FOOT('R', -0.12, 0.46, 80, -0.13) })), lag: CL });
  for (let f = 17; f <= 39; f += 2) { const k = ease((f - 15) / 25); keys.push({ t: F(f), pose: turn(360 * k, 360 * k), lag: CL }); }
  keys.push({ t: F(40), pose: turn(360, 360, { hips: RM(10, 15, 0, 0, 0, 0), spine: R(10), chest: R(4, 4), c_footR: FOOT('R', 0.08, 0.32, 50, -0.15), c_footL: FOOT('L', -0.12, 0.2, 60, 0.15), c_handR: HR(0.1, 0.96, -0.3), c_sword: SW(-0.6, 0.8) }), lag: CL, in: 'out' });
  keys.push({ t: F(46), reset: true, use: AIR, pose: { all: R(0) }, lag: CL });
  keys.push({ t: F(50), use: AIR });
  C.AirJump = { fps: 60, keys };
}

/* Fall: a 32-frame loop. Leaning well forward from the hips up, the near (right) knee drawn up in front with the foot
   tucked back under him, the far leg hanging long behind; the sword hand back and up by his head with the elbow high
   and the blade laid forward over it, the left arm reaching out long in front. The cape lifts in the air coming up past
   him and flutters, and the legs trade a little. */
P.fall = { hips: RM(14, 15, 0, 0, 0, 0), spine: R(14), chest: R(8, 6), head: R(-28, -20), c_handR: HR(0.03, 1.41, -0.18), c_sword: SW(-0.27, 0.96), c_handL: HL(0.56, 1.04, 0.22),
  c_footR: FOOT('R', -0.16, 0.68, 92, -0.16), c_footL: FOOT('L', -0.3, 0.24, 84, 0.15), ...CAPE(36, 14) };
C.Fall = { fps: 60, loop: true, keys: [
  { t: F(1), reset: true, use: [...AIR, 'fall'] },
  { t: F(17), pose: { c_footR: FOOT('R', -0.14, 0.66, 88, -0.16), c_footL: FOOT('L', -0.27, 0.27, 80, 0.15), c_handL: HL(0.56, 1.08, 0.22), c_sword: SW(-0.22, 0.97), ...CAPE(44, 18) }, lag: CL },
  { t: F(33), reset: true, use: [...AIR, 'fall'], lag: CL }] };

/* Fast fall: a 16-frame loop, dropping straight: legs down and together, the sword point up, the left arm up, the cape
   blown right up behind him. */
C.FastFall = { fps: 60, loop: true, keys: [
  { t: F(1), reset: true, use: AIR, pose: { hips: RM(-2, 15, 0, 0, 0.02, 0), spine: R(2), chest: R(0, 4), head: R(8, -18), c_handR: HR(0.14, 1.2, -0.32), c_sword: SW(0.62, 0.78), c_handL: HL(0.12, 1.42, 0.24),
    c_footR: FOOT('R', 0.04, 0.08, 50, -0.13), c_footL: FOOT('L', -0.06, 0.12, 55, 0.13), ...CAPE(56, 14) } },
  { t: F(9), pose: { c_handL: HL(0.12, 1.46, 0.24), ...CAPE(62, 18) }, lag: CL },
  { t: F(17), pose: { c_handL: HL(0.12, 1.42, 0.24), ...CAPE(56, 14) }, lag: CL }] };

/* Land: 16 frames, played over the landing's lag (4 frames from a jump), as the reference's light landing. He comes
   down in the fall pose: the far (left) foot takes the floor first and the knees give, lowest on 4, while the tucked
   right foot is still coming down; it lands out in front on 10. The sword arm rows back through the drop (the upper arm swung
   back along his side at the shoulder so the elbow leads straight back, past his back), the hand drawn to the bottom of
   his ribs; the whole landing uses the rowing chain (rowR), so the elbow keeps pointing back as the arm comes down to
   hang at his side and the point kept down below his knees, then hangs loose at his side as he
   comes up (10-16); the left arm comes in. */
C.Land = { fps: 60, keys: [
  { t: F(1), reset: true, use: G, pose: Object.assign({}, P.fall, { c_handR: WRISTR(-0.206, 0.902, 0.111), c_sword: SW(-0.7, 0.71), foreR: ROW(1), hips: RM(12, 18, 0, 0, -0.2, 0), c_footL: Object.assign({}, P.guard.c_footL), c_footR: FOOT('R', -0.1, 0.42, 80, -0.16), ...CAPE(24, 10) }) },
  { t: F(4), pose: { hips: RM(18, 20, 0, 0, -0.39, 0.0), spine: R(14), chest: R(8, 8), head: R(-28, -24), c_handR: WRISTR(-0.193, 0.702, 0.141), c_sword: SW(-0.58, 0.81), c_handL: HL(0.5, 0.62, 0.22),
    c_footR: FOOT('R', 0.04, 0.3, 60, -0.16) }, lag: CL, in: 'out' },
  { t: F(8), pose: { hips: RM(10, 22, 0, 0, -0.18, 0), spine: R(8), chest: R(6, 10), c_handR: WRISTR(-0.194, 0.919, 0.133), c_handL: HL(0.36, 0.78, 0.2), c_footR: FOOT('R', 0.12, 0.2, 30, -0.16), ...CAPE(6, 2) }, lag: CL },
  { t: F(10), pose: { c_footR: Object.assign({}, P.guard.c_footR), c_handR: WRISTR(-0.194, 0.919, 0.133), c_sword: SW(-0.7, 0.71), foreR: ROW(1) }, lag: CL },
  { t: F(13), pose: { hips: RM(2, 24, 0, 0, -0.09, 0), spine: R(5), chest: R(5, 10), head: R(-4, -31), c_handR: Object.assign(HR(0.12, 0.86, -0.16), { reach: 0.5 }), c_sword: SW(-0.68, 0.73), c_handL: HL(0.14, 0.98, 0.17), ...CAPE(3, 1) }, lag: CL },
  { t: F(16), reset: true, use: G, pose: IDLEARM, lag: CL }] };

/* Hard landing (an aerial's landing lag): 31 frames, as the reference's heavy landing. He drops straight into a deep
   crouch (lowest on 8) leaning far over the right knee, the left knee nearly down, the left hand on the floor in front.
   The sword is held low and out in front of the right knee with the point up and in across his body; held there, then
   from 18 the point comes down to touch the floor out in front (22-24) as he pushes up, and lifts into the guard by 31. */
C.LandHard = { fps: 60, keys: [
  { t: F(1), reset: true, use: G, pose: { hips: RM(22, 20, 0, 0, -0.48, 0.0), spine: R(14), chest: R(10, 6), head: R(-34, -26), c_handR: HR(0.5, 0.36, -0.08), c_sword: SW(0.3, 0.72, 0.62), c_handL: HL(0.26, 0.18, 0.3),
    c_footR: FR(0.1, 0, 0.02), c_footL: FOOT('L', -0.22, 0.16, 76, 0.15), ...CAPE(22, 8) } },
  { t: F(8), pose: { hips: RM(26, 20, 0, 0, -0.56, 0.0), spine: R(16), chest: R(12, 6), head: R(-38, -26), c_handR: HR(0.51, 0.34, -0.07), c_sword: SW(0.42, 0.66, 0.62), c_handL: HL(0.24, 0.14, 0.3), ...CAPE(2, 0) }, lag: CL, in: 'out' },
  { t: F(16), pose: { hips: RM(25, 20, 0, 0, -0.54, 0.0), c_handR: HR(0.5, 0.35, -0.08), c_sword: SW(0.38, 0.7, 0.6) }, lag: CL },
  { t: F(20), pose: { hips: RM(20, 21, 0, 0, -0.4, 0.0), spine: R(12), chest: R(8, 8), head: R(-28, -28), c_handR: HR(0.5, 0.57, -0.07), c_sword: SW(-0.35, 0.93, 0.12), c_handL: HL(0.2, 0.36, 0.28),
    c_footL: FOOT('L', -0.22, 0.17, 60, 0.15) }, lag: CL },
  { t: F(23), pose: { hips: RM(12, 23, 0, 0, -0.25, 0.0), spine: R(8), chest: R(6, 10), head: R(-14, -30), c_handR: HR(0.45, 0.6, -0.1), c_sword: SW(-0.64, 0.77, 0.05), c_handL: HL(0.14, 0.64, 0.22) }, lag: CL },
  { t: F(27), pose: { hips: RM(4, 25, 0, 0, -0.11, 0), spine: R(5), chest: R(5, 10), head: R(-4, -32), c_handR: HR(0.36, 0.9, -0.13), c_sword: SW(-0.1, 1), c_handL: HL(0.12, 0.96, 0.17),
    c_footR: FR(0.16, 0, 0.02), c_footL: Object.assign({}, P.guard.c_footL), ...CAPE(3, 1) }, lag: CL },
  { t: F(31), reset: true, use: G, pose: IDLEARM, lag: CL }] };

/* For the game's manifest: the ground one cycle of the walk and the run covers (metres; times units-per-metre there). */
spec.stride = { Walk: WALK_STRIDE, Run: +(16 * RUNV).toFixed(3) };

/* batches 2-8 (attacks, specials, defence, grabs, ledge, taunt, victories): tools/blender/brand2-moves.js. It returns each
   strike's active frames, which anim-qa.py checks the blade against (assets/brand/work/brand2-hits.json). */
const HITS = require('./brand2-moves.js')({ C, P, F, R, M, RM, HR, HL, SW, FOOT, FR, FL, CAPE, CL, G, AIR, IDLEARM, POMMEL, HOLDL, FREEL, FIST, WRISTR, ROW });
require('fs').writeFileSync(require('path').join(__dirname, '../../assets/brand/work/brand2-hits.json'), JSON.stringify(HITS, null, 1));

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
const REACH0 = 0.45;   /* shoulder to wrist with the elbow still a little bent (upper arm 0.25, forearm 0.265: 0.515 locked straight) */
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
    const sh = onChest(state, SHR), d = sub3(wr, sh), L = Math.hypot(...d), REACH = hr.reach || REACH0;   /* a key may let the arm hang longer (a loose arm at rest) */
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

/* ---- the cape's cloth (capesim.js): assets/brand/work/brand2-cape.json ----
   One particle at every joint of the three cape chains (row 0 sewn to the shoulders, 1-4 down to the hem), each riding the
   cape bone whose tail it is, so the hand-keyed cape pose above is where the cloth is pulled toward. Rest positions are
   in model space (metres, y up, z forward): an engine works out each point's offset in its bone from the bind pose.
   Colliders are capsules on the body, fitted to the mesh (hips and back from the vertices weighted to them; thighs to the
   leg inside the coat, which hangs inside the cape). */
{
  const chains = ['L', 'C', 'R'], idx = (s, k) => chains.indexOf(s) * 5 + k;
  const byName = Object.fromEntries(spec.bones.map(b => [b.name, b]));
  const ROW = [   /* per row, shoulder to hem: mass kg, radius m, follow (pull to the animated pose per 60 Hz step), maxDev m, cone deg */
    [0, 0.04, 1, 0, 0], [0.07, 0.045, 0.12, 0.25, 60], [0.07, 0.05, 0.07, 0.45, 75], [0.075, 0.05, 0.04, 0.6, 90], [0.1, 0.05, 0.025, 0.75, 105]];
  const particles = [];
  for (const s of chains) for (let k = 0; k <= 4; k++) {
    const b = byName['cape' + s + Math.max(1, k)], [mass, radius, follow, maxDev, cone] = ROW[k];
    particles.push(Object.assign({ name: 'cape' + s + k, bone: b.name, rest: k ? b.tail : b.head, row: k, chain: s },
      k ? { mass, radius, follow, maxDev, cone, parent: idx(s, k - 1) } : { pinned: true, radius, parent: -1 }));
  }
  const dist = (a, b) => +Math.hypot(...sub3(particles[a].rest, particles[b].rest)).toFixed(4);
  const links = [], link = (a, b, kind, compliance, min, max) => links.push({ a, b, kind, rest: dist(a, b), compliance, min, max });
  for (const s of chains) for (let k = 0; k < 4; k++) link(idx(s, k), idx(s, k + 1), 'stretch', 0, 0.98, 1.0);           /* down the chains: no stretch, barely any give */
  for (const s of chains) for (let k = 0; k < 3; k++) link(idx(s, k), idx(s, k + 2), 'bend', 2e-4 * (k + 1), 0.7, 1.0);  /* skip one: body, softer toward the hem */
  for (let k = 1; k <= 4; k++) {
    link(idx('L', k), idx('C', k), 'across', 1e-5, 0.55, 1.08); link(idx('C', k), idx('R', k), 'across', 1e-5, 0.55, 1.08);   /* across: bunches up, hardly widens */
    link(idx('L', k), idx('R', k), 'bendAcross', 1e-3, 0.3, 1.05);
  }
  for (let k = 0; k < 4; k++) for (const [s1, s2] of [['L', 'C'], ['C', 'R']]) {   /* shear: diagonals in each cell */
    link(idx(s1, k), idx(s2, k + 1), 'shear', 4e-4, 0.6, 1.1); link(idx(s2, k), idx(s1, k + 1), 'shear', 4e-4, 0.6, 1.1);
  }
  for (const s of chains) for (let k = 2; k <= 4; k++) {   /* long-range tether from the shoulder: never further than the cloth's length */
    let L = 0; for (let j = 0; j < k; j++) L += dist(idx(s, j), idx(s, j + 1));
    links.push({ a: idx(s, 0), b: idx(s, k), kind: 'tether', rest: +L.toFixed(4), compliance: 0, min: 0, max: 1.01 });
  }
  const triangles = [];
  for (let k = 0; k < 4; k++) for (const [s1, s2] of [['L', 'C'], ['C', 'R']]) {
    triangles.push([idx(s1, k), idx(s2, k), idx(s2, k + 1)], [idx(s1, k), idx(s2, k + 1), idx(s1, k + 1)]);
  }
  const cap = (name, bone, a, b, r) => ({ name, bone, a, b, r });
  const colliders = [
    cap('upperBack', 'chest2', [-0.12, 1.38, -0.02], [0.12, 1.38, -0.02], 0.12), cap('back', 'chest', [0, 1.34, -0.01], [0, 1.18, -0.01], 0.13),
    cap('waist', 'spine', [0, 1.17, -0.01], [0, 1.0, -0.01], 0.12), cap('seat', 'hips', [-0.1, 0.9, -0.03], [0.1, 0.9, -0.03], 0.13),
    cap('thighR', 'thighR', [-0.11, 0.88, 0], [-0.2, 0.5, 0.02], 0.15), cap('thighL', 'thighL', [0.11, 0.88, 0], [0.2, 0.5, 0.02], 0.15),
    cap('shinR', 'shinR', [-0.2, 0.5, 0.02], [-0.235, 0.12, -0.02], 0.08), cap('shinL', 'shinL', [0.2, 0.5, 0.02], [0.25, 0.12, -0.02], 0.08),
    cap('armR', 'armR', SHR, ELR, 0.07), cap('armL', 'armL', SHL, ELL, 0.07)];
  const cape = {
    note: 'Brand\'s cape cloth for capesim.js (see its header). Model space: metres, y up, z forward, x his left. Particles ride the named bone (rest = bind-pose position); bones aim from their head particle at their tail particle, parents first.',
    fps: 60, substeps: 4, iterations: 2, gravity: [0, -9.81, 0], gravityScale: 1, damping: 1.4, friction: 0.35, maxSpeed: 30,
    air: { normal: 3, tangent: 0.08 }, inertia: { move: 0.9, snapAngle: 100, teleport: 2.5 },
    frame: { left: idx('L', 0), right: idx('R', 0), top: idx('C', 0), below: idx('C', 2) },
    particles, links, triangles, colliders,
    bones: chains.flatMap(s => [1, 2, 3, 4].map(k => ({ name: 'cape' + s + k, head: idx(s, k - 1), tail: idx(s, k) }))) };
  fs.writeFileSync(path.join(work, 'brand2-cape.json'), JSON.stringify(cape, null, 1));
}
console.log('brand2: %d bones, %d clips -> assets/brand/work/brand2-rig.json', spec.bones.length, Object.keys(C).length);
