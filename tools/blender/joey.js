// Writes the skeletons and animation specs for Joey's two bodies (assets/joey/work/rig-human.json, rig-big.json), which
// tools/blender/rig.py turns into rigged, animated models, and adds both entries to the game's manifest.
//   node tools/blender/joey.js
//   bash tools/blender/build-joey.sh [human|big] [shots.json outdir]
// Directions: x is his left, y is up, z is forward; metres, feet on y = 0. Joint positions were measured from the
// generated meshes (tools/proj.mjs). Hands and feet follow targets (c_hand*, c_foot*) that hang from the root, not the
// chest: a pose says where a wrist or an ankle is in the model's space and the elbow or knee works itself out. That is
// what lets Cronky Dong lean his whole torso forward while his fists stay planted on the floor.
// The big body carries the human head (tools/blender/headswap.py): the face is the same mesh and texture in both forms.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), S = (x, y, z) => ({ scale: [x, y === undefined ? x : y, z === undefined ? x : z] });
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const add = (a, b) => a.map((v, i) => v + b[i]);
const OUT = path.join(__dirname, '..', '..', 'assets', 'joey', 'work');

/* ---- one skeleton builder for both bodies ---- */
function body(J) {
  const leg = (s, k) => [
    { name: 'thigh' + s, head: J.hip[k], tail: J.knee[k], parent: 'hips' },
    { name: 'shin' + s, head: J.knee[k], tail: J.ankle[k], parent: 'thigh' + s, connect: true },
    { name: 'foot' + s, head: J.ankle[k], tail: J.toe[k], parent: 'shin' + s },
    { name: 'c_foot' + s, head: J.ankle[k], tail: add(J.ankle[k], [0, 0, 0.12]), parent: 'all', deform: false }];
  const arm = (s, k) => [
    { name: 'arm' + s, head: J.sho[k], tail: J.elb[k], parent: 'chest' },
    { name: 'fore' + s, head: J.elb[k], tail: J.wri[k], parent: 'arm' + s, connect: true },
    { name: 'hand' + s, head: J.wri[k], tail: J.fist[k], parent: 'fore' + s, connect: true },
    { name: 'c_hand' + s, head: J.wri[k], tail: add(J.wri[k], [0, 0, 0.12]), parent: 'all', deform: false }];
  return {
    note: J.note, prep: J.prep,
    bones: [
      { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
      { name: 'hips', head: [0, J.pelvis, J.cz], tail: [0, J.waist, J.cz], parent: 'all' },
      { name: 'spine', head: [0, J.waist, J.cz], tail: [0, J.ribs, J.cz], parent: 'hips', connect: true },
      { name: 'chest', head: [0, J.ribs, J.cz], tail: [0, J.neck, J.cz], parent: 'spine', connect: true },
      { name: 'head', head: [0, J.neck, J.hz], tail: [0, J.top, J.hz], parent: 'chest' },
      ...arm('R', 0), ...arm('L', 1), ...leg('R', 0), ...leg('L', 1)],
    ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
    rigid: [{ bone: 'head', box: J.headBox }], poses: {}, clips: {} };
}
/* where a wrist / ankle should be: an absolute place in the model, as a move from where it rests */
const targets = J => ({
  HR: (z, y, x) => M((x === undefined ? -J.handX : x) - J.wri[0][0], y - J.wri[0][1], z - J.wri[0][2]),
  HL: (z, y, x) => M((x === undefined ? J.handX : x) - J.wri[1][0], y - J.wri[1][1], z - J.wri[1][2]),
  FR: (z, y, x) => M((x === undefined ? J.ankle[0][0] : x) - J.ankle[0][0], (y || 0) + J.ankle[0][1] - J.ankle[0][1], z - J.ankle[0][2]),
  FL: (z, y, x) => M((x === undefined ? J.ankle[1][0] : x) - J.ankle[1][0], (y || 0) + J.ankle[1][1] - J.ankle[1][1], z - J.ankle[1][2]) });
const mir = p => [-p[0], p[1], p[2]];
const keys = (list, fps) => ({ fps: fps || 30, keys: list });

/* =====================================================================================================================
   Joey, the ordinary man (1.90 m mesh; 13.5 in the game)
   ===================================================================================================================== */
const JH = { note: 'Joey (human): metres, feet on y = 0, facing +Z, his right is -X.', prep: { yaw: 0, translate: [0, 0.952, 0] },
  pelvis: 0.96, waist: 1.12, ribs: 1.30, neck: 1.56, top: 1.92, cz: -0.01, hz: 0.0, handX: 0.24,
  sho: [[-0.17, 1.47, -0.03], mir([-0.17, 1.47, -0.03])], elb: [[-0.25, 1.16, -0.05], mir([-0.25, 1.16, -0.05])], wri: [[-0.30, 0.88, -0.01], mir([-0.30, 0.88, -0.01])], fist: [[-0.32, 0.76, 0.0], mir([-0.32, 0.76, 0.0])],
  hip: [[-0.09, 0.94, 0], mir([-0.09, 0.94, 0])], knee: [[-0.095, 0.52, 0.01], mir([-0.095, 0.52, 0.01])], ankle: [[-0.10, 0.08, -0.04], mir([-0.10, 0.08, -0.04])], toe: [[-0.10, 0.02, 0.13], mir([-0.10, 0.02, 0.13])],
  headBox: [[-0.14, 1.6, -0.16], [0.14, 1.96, 0.24]] };
const human = body(JH), h = targets(JH), C = human.clips;
human.poses = {
  stand: { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {} },
  /* relaxed: arms down by his sides, a slightly nervous stance */
  rest: { hips: M(0, -0.02, 0), chest: R(2), c_handR: h.HR(0.03, 0.86), c_handL: h.HL(0.03, 0.86), c_footR: h.FR(0.0), c_footL: h.FL(-0.03) },
  crouch: { hips: M(0, -0.32, 0.02), spine: R(18), chest: R(10), head: R(-14), c_handR: h.HR(0.28, 0.55, -0.2), c_handL: h.HL(0.28, 0.55, 0.2), c_footR: h.FR(0.06), c_footL: h.FL(-0.06) },
  air: { hips: M(0, 0.02, 0), chest: R(4), c_handR: h.HR(0.08, 1.0, -0.34), c_handL: h.HL(0.0, 1.05, 0.34), c_footR: h.FR(0.1, 0.16), c_footL: h.FL(-0.04, 0.1) },
  tuck: { spine: R(24), chest: R(16), head: R(10), c_footL: h.FL(0.14, 0.32), c_footR: h.FR(0.14, 0.32), c_handL: h.HL(0.25, 1.0, 0.16), c_handR: h.HR(0.25, 1.0, -0.16) } };
const G = ['stand', 'rest'], AIR = ['stand', 'air'], back = { reset: true, use: G }, backAir = { reset: true, use: AIR };
C.Idle = keys([{ t: 0, use: G }, { t: 0.8, pose: { chest: R(3.5), head: R(-2, 4), c_handR: h.HR(0.04, 0.87) } }, { t: 1.6, pose: { chest: R(2), head: R(0, -3), c_handR: h.HR(0.03, 0.86) } }, { t: 2.4, use: G }]);
C.Idle2 = keys([{ t: 0, use: G }, { t: 0.4, pose: { chest: R(0, -8), head: R(14, -10), c_handR: h.HR(0.22, 1.12, -0.12), c_handL: h.HL(0.14, 0.95, 0.1) } }, { t: 1.3, pose: { head: R(16, -6) } }, { t: 1.8, pose: { head: R(-4, 0) } }, { t: 2.4, use: G }]);   /* checks a fitness watch that isn't there */
{ const st = (a, lean, lift, sw) => [
    { hips: M(0, -0.03, 0), chest: R(lean, 6), c_footR: h.FR(a), c_footL: h.FL(-a, lift * 0.3), c_handR: h.HR(-sw, 0.88), c_handL: h.HL(sw, 0.88) },
    { hips: M(0, 0.0, 0), chest: R(lean), c_footR: h.FR(0), c_footL: h.FL(0.02, lift), c_handR: h.HR(0, 0.87), c_handL: h.HL(0, 0.87) },
    { hips: M(0, -0.03, 0), chest: R(lean, -6), c_footR: h.FR(-a, lift * 0.3), c_footL: h.FL(a), c_handR: h.HR(sw, 0.88), c_handL: h.HL(-sw, 0.88) },
    { hips: M(0, 0.0, 0), chest: R(lean), c_footR: h.FR(0.02, lift), c_footL: h.FL(0), c_handR: h.HR(0, 0.87), c_handL: h.HL(0, 0.87) }];
  const w = st(0.22, 3, 0.08, 0.12), r = st(0.34, 12, 0.2, 0.22);
  C.Walk = keys([{ t: 0, use: G, pose: w[0] }, { t: 0.28, pose: w[1] }, { t: 0.56, pose: w[2] }, { t: 0.84, pose: w[3] }, { t: 1.12, pose: w[0] }]);
  C.Run = keys([{ t: 0, use: G, pose: Object.assign({}, r[0], { head: R(-6) }) }, { t: 0.18, pose: r[1] }, { t: 0.36, pose: r[2] }, { t: 0.54, pose: r[3] }, { t: 0.72, pose: r[0] }]); }
C.Crouch = keys([{ t: 0, use: G }, { t: 0.2, use: 'crouch' }]);
C.Rise = keys([{ t: 0, use: AIR, pose: { chest: R(-4), head: R(-8), c_footR: h.FR(0.06, 0.2), c_footL: h.FL(-0.06, 0.04) } }, { t: 0.4, pose: { c_footR: h.FR(0.08, 0.14) } }]);
C.Fall = keys([{ t: 0, use: AIR, pose: { chest: R(6), c_handR: h.HR(0.1, 1.2, -0.36), c_handL: h.HL(0.0, 1.25, 0.36) } }, { t: 0.3, pose: { c_handR: h.HR(0.12, 1.3, -0.38), c_handL: h.HL(0.0, 1.32, 0.38) } }, { t: 0.6, pose: { c_handR: h.HR(0.1, 1.2, -0.36), c_handL: h.HL(0.0, 1.25, 0.36) } }]);   /* arms flapping a little: he does not like falling */
C.Land = keys([{ t: 0, use: ['stand', 'crouch'] }, { t: 0.2, pose: { hips: M(0, -0.18, 0), spine: R(8), c_handR: h.HR(0.12, 0.7, -0.26), c_handL: h.HL(0.12, 0.7, 0.26) } }, { t: 0.45, ...back }]);
C.Shield = keys([{ t: 0, use: G }, { t: 0.15, pose: { hips: M(0, -0.08, 0), spine: R(8), head: R(14), c_handR: h.HR(0.22, 1.5, 0.06), c_handL: h.HL(0.24, 1.46, -0.06) } }]);   /* forearms crossed over his face */
C.Hit = keys([{ t: 0, use: G, pose: { hips: M(0, -0.03, -0.1), spine: R(-14), chest: R(-12), head: R(-18), c_handL: h.HL(-0.05, 1.25, 0.4), c_handR: h.HR(-0.05, 1.2, -0.4), c_footR: h.FR(0.16, 0.06) } }, { t: 0.3, pose: { spine: R(-8), chest: R(-6), head: R(-6) } }, { t: 0.6, ...back }]);
C.Tumble = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(30), chest: R(22) } }, { t: 0.6, pose: { spine: R(24), chest: R(16) } }]);
C.Down = keys([{ t: 0, use: 'stand', pose: { all: R(-50) } }, { t: 0.3, pose: { all: { rot: [-90, 0, 0], move: [0, 0.2, 0.9] }, c_handL: h.HL(-0.1, 1.0, 0.45), c_handR: h.HR(0.1, 0.95, -0.45) } }]);
C.Dodge = keys([{ t: 0, use: G }, { t: 0.14, pose: { all: R(0, 35), hips: M(0, -0.1, -0.18), spine: R(-14), head: R(18), c_handR: h.HR(0.22, 1.5, 0.06), c_handL: h.HL(0.24, 1.46, -0.06) } }, { t: 0.45, ...back }]);
C.Ledge = keys([{ t: 0, use: 'stand', pose: { head: R(-12), c_handL: h.HL(0.25, 1.98, 0.15), c_handR: h.HR(0.25, 1.98, -0.15), c_footL: h.FL(0.04), c_footR: h.FR(-0.04, 0.06) } }, { t: 0.7, pose: { c_footL: h.FL(-0.04, 0.06), c_footR: h.FR(0.04) } }, { t: 1.4, pose: { c_footL: h.FL(0.04), c_footR: h.FR(-0.04, 0.06) } }]);
C.Hold = keys([{ t: 0, use: G, pose: { chest: R(6), c_handL: h.HL(0.42, 1.12, 0.06), c_handR: h.HR(0.42, 1.12, -0.06) } }, { t: 0.3, pose: { chest: R(9) } }, { t: 0.6, pose: { chest: R(6) } }]);
C.Held = keys([{ t: 0, use: AIR, pose: { head: R(-10), c_handL: h.HL(0.15, 1.35, 0.3), c_handR: h.HR(0.15, 1.35, -0.3) } }, { t: 0.25, pose: { c_footL: h.FL(0.1, 0.16), c_footR: h.FR(-0.05, 0.06) } }, { t: 0.5, pose: { c_footL: h.FL(-0.06, 0.08), c_footR: h.FR(0.12, 0.16) } }]);
/* ---- attacks (contact keys at the moment the hit starts) ---- */
const lunge = (dz, drop) => ({ hips: M(0, -drop, dz), c_footR: h.FR(0.06 + dz * 1.4) });
C.Palm = keys([{ t: 0, use: G }, { t: 0.13, pose: { chest: R(0, 14), c_handR: h.HR(0.12, 1.15, -0.2) } }, { t: 0.23, in: 'snap', pose: Object.assign(lunge(0.04, 0.03), { chest: R(4, -10), c_handR: h.HR(0.42, 1.18, -0.12) }) }, { t: 0.3, pose: { c_handR: h.HR(0.4, 1.17, -0.12) } }, { t: 0.7, ...back }]);   /* Form Check */
C.Curl = keys([{ t: 0, use: G }, { t: 0.15, pose: { c_handL: h.HL(0.18, 0.95, 0.18) } }, { t: 0.3, in: 'snap', pose: Object.assign(lunge(0.05, 0.03), { chest: R(2, 12), c_handL: h.HL(0.38, 1.22, 0.06) }) }, { t: 0.36, pose: {} }, { t: 0.8, ...back }]);   /* Tiny Curl */
C.Shove = keys([{ t: 0, use: G }, { t: 0.32, pose: { hips: M(0, -0.08, -0.08), spine: R(-6), chest: R(-8), c_handR: h.HR(0.05, 1.3, -0.14), c_handL: h.HL(0.05, 1.3, 0.14) } }, { t: 0.5, in: 'snap', pose: Object.assign(lunge(0.14, 0.06), { spine: R(10), chest: R(8), c_handR: h.HR(0.5, 1.25, -0.1), c_handL: h.HL(0.5, 1.15, 0.1) }) }, { t: 0.58, pose: {} }, { t: 1.3, ...back }]);   /* Personal Best: a hugely overprepared shove */
C.Raise = keys([{ t: 0, use: G }, { t: 0.25, pose: { chest: R(0, 10), c_handR: h.HR(0.1, 0.95, -0.2) } }, { t: 0.4, in: 'snap', pose: { chest: R(-2, -6), head: R(4), c_handR: h.HR(0.5, 1.22, -0.14) } }, { t: 0.5, pose: { c_handR: h.HR(0.5, 1.2, -0.14) } }, { t: 1.1, ...back }]);   /* Lateral Raise */
C.Press = keys([{ t: 0, use: G }, { t: 0.25, pose: { hips: M(0, -0.06, 0), c_handR: h.HR(0.04, 1.5, -0.18), c_handL: h.HL(0.04, 1.5, 0.18) } }, { t: 0.43, in: 'snap', pose: { hips: M(0, 0.0, 0), head: R(-14), c_handR: h.HR(0.04, 2.0, -0.12), c_handL: h.HL(0.04, 2.0, 0.12) } }, { t: 0.5, pose: { c_handR: h.HR(0.05, 1.97, -0.13), c_handL: h.HL(0.03, 1.98, 0.12) } }, { t: 0.56, pose: { c_handR: h.HR(0.04, 2.0, -0.12) } }, { t: 1.2, ...back }]);   /* Shoulder Press: trembling */
C.Toe = keys([{ t: 0, use: G }, { t: 0.2, pose: { spine: R(20), chest: R(16) } }, { t: 0.33, in: 'snap', pose: { hips: M(0, -0.1, -0.06), spine: R(40), chest: R(24), head: R(-30), c_handR: h.HR(0.42, 0.18, -0.12), c_handL: h.HL(0.32, 0.3, 0.12) } }, { t: 0.4, pose: {} }, { t: 1.0, ...back }]);   /* Hamstring Check */
C.Jog = keys([{ t: 0, use: G }, { t: 0.13, pose: { chest: R(10, 6), c_footR: h.FR(0.25), c_footL: h.FL(-0.2, 0.1), c_handR: h.HR(-0.15, 1.0), c_handL: h.HL(0.15, 1.0) } }, { t: 0.27, pose: { chest: R(10, -6), c_footR: h.FR(-0.2, 0.1), c_footL: h.FL(0.25), c_handR: h.HR(0.15, 1.0), c_handL: h.HL(-0.15, 1.0) } },
  { t: 0.56, in: 'snap', pose: { hips: M(0, -0.05, 0.12), chest: R(6, 40), head: R(10, -30), c_footR: h.FR(0.3), c_footL: h.FL(-0.1), c_handR: h.HR(0.2, 1.0, -0.3), c_handL: h.HL(0.1, 0.95) } }, { t: 0.67, pose: {} },
  { t: 1.0, pose: { chest: R(4, 0), head: R(18, -10), c_handR: h.HR(0.22, 1.12, -0.12), c_handL: h.HL(0.14, 0.95, 0.1) } }, { t: 1.75, ...back }]);   /* Cardio Was a Mistake, then the watch */
C.PR = keys([{ t: 0, use: G }, { t: 0.33, pose: { hips: M(0, -0.14, -0.04), spine: R(10), head: R(10), c_handR: h.HR(0.12, 1.15, -0.1), c_handL: h.HL(0.12, 1.15, 0.1), c_footR: h.FR(0.18) } }, { t: 0.6, pose: { chest: R(-4), head: R(-6), c_handR: h.HR(0.1, 1.17, -0.1) } },
  { t: 1.0, in: 'snap', pose: Object.assign(lunge(0.14, 0.12), { chest: R(10), head: R(4), c_handR: h.HR(0.58, 1.18, -0.06), c_handL: h.HL(0.52, 1.14, 0.06) }) }, { t: 1.07, pose: {} }, { t: 2.4, ...back }]);   /* Five-Pound PR */
C.Clean = keys([{ t: 0, use: G }, { t: 0.33, use: 'crouch', pose: { c_handR: h.HR(0.24, 0.3, -0.12), c_handL: h.HL(0.24, 0.3, 0.12) } }, { t: 0.6, pose: { hips: M(0, -0.12, 0), c_handR: h.HR(0.1, 1.4, -0.12), c_handL: h.HL(0.1, 1.4, 0.12) } },
  { t: 0.93, in: 'snap', pose: { hips: M(0, 0.0, 0), spine: R(-10), head: R(-16), c_handR: h.HR(-0.04, 2.0, -0.14), c_handL: h.HL(-0.04, 2.0, 0.14), c_footL: h.FL(-0.16, 0.06) } }, { t: 1.0, pose: { all: R(-6) } }, { t: 1.4, pose: { all: R(4) } }, { t: 2.35, ...back }]);   /* Clean and Mostly Jerk: nearly falls over */
C.Lunge = keys([{ t: 0, use: G }, { t: 0.4, pose: { hips: M(0, -0.06, 0) } }, { t: 0.77, in: 'snap', pose: { hips: M(0, -0.24, 0.16), spine: R(6), c_footR: h.FR(0.5), c_footL: h.FL(-0.3), c_handR: h.HR(0.2, 0.75, -0.3), c_handL: h.HL(0.0, 0.8, 0.3) } },
  { t: 1.0, pose: { hips: M(0, -0.04, 0), c_footR: h.FR(0.02), c_footL: h.FL(0) } }, { t: 1.2, pose: { hips: M(0, -0.06, 0.06), spine: R(18), c_footL: h.FL(-0.5, 0.18) } }, { t: 1.28, pose: { all: R(0, 0, 6) } }, { t: 2.4, ...back }]);   /* Leg Day Withdrawal: front lunge, wobbly back kick */
C.Jack = keys([{ t: 0, use: AIR }, { t: 0.36, in: 'snap', pose: { c_handR: h.HR(0.0, 1.95, -0.55), c_handL: h.HL(0.0, 1.95, 0.55), c_footR: h.FR(0, 0.05, -0.35), c_footL: h.FL(0, 0.05, 0.35) } }, { t: 0.5, pose: {} }, { t: 0.7, pose: { c_handR: h.HR(0.1, 1.3, -0.4), c_handL: h.HL(0.0, 1.3, 0.4), c_footR: h.FR(0.1, 0.16), c_footL: h.FL(-0.04, 0.1) } }, { t: 1.25, ...backAir }]);   /* Jumping Jack Panic */
C.Front = keys([{ t: 0, use: AIR }, { t: 0.3, pose: { c_handR: h.HR(0.1, 0.95, -0.2) } }, { t: 0.53, in: 'snap', pose: { chest: R(4), c_handR: h.HR(0.58, 1.2, -0.12) } }, { t: 0.6, pose: { c_handR: h.HR(0.55, 1.15, -0.12) } }, { t: 1.5, ...backAir }]);   /* Front Raise Fail */
C.Kick = keys([{ t: 0, use: AIR }, { t: 0.25, pose: { spine: R(14), c_footL: h.FL(0.1, 0.3) } }, { t: 0.43, in: 'snap', pose: { spine: R(22), chest: R(10), head: R(-14), c_footL: h.FL(-0.55, 0.42), c_handR: h.HR(0.3, 1.1, -0.3), c_handL: h.HL(0.3, 1.1, 0.3) } }, { t: 0.53, pose: {} }, { t: 1.35, ...backAir }]);   /* Glute Kickback */
C.High5 = keys([{ t: 0, use: AIR }, { t: 0.25, pose: { c_handR: h.HR(0.1, 1.5, -0.2) } }, { t: 0.4, in: 'snap', pose: { head: R(-20), c_handR: h.HR(0.06, 2.12, -0.12) } }, { t: 0.47, pose: {} }, { t: 1.2, ...backAir }]);   /* Ceiling High-Five */
C.Box = keys([{ t: 0, use: AIR }, { t: 0.45, pose: { c_footR: h.FR(0.1, 0.45), c_footL: h.FL(0.1, 0.45), c_handR: h.HR(0.25, 1.2, -0.3), c_handL: h.HL(0.25, 1.2, 0.3) } }, { t: 0.67, in: 'snap', pose: { hips: M(0, 0.05, 0), c_footR: h.FR(0.02, -0.14), c_footL: h.FL(0.02, -0.14), c_handR: h.HR(0.0, 1.45, -0.4), c_handL: h.HL(0.0, 1.45, 0.4) } }, { t: 0.77, pose: {} }, { t: 1.8, ...backAir }]);   /* Imaginary Box Jump */
C.Reach = keys([{ t: 0, use: G }, { t: 0.28, pose: { c_handR: h.HR(0.18, 1.05, -0.16), c_handL: h.HL(0.18, 1.05, 0.16) } }, { t: 0.37, in: 'snap', pose: Object.assign(lunge(0.05, 0.03), { chest: R(6), c_handR: h.HR(0.4, 1.08, -0.1), c_handL: h.HL(0.4, 1.08, 0.1) }) }, { t: 0.43, pose: {} }, { t: 1.3, ...back }]);
C.Shake = keys([{ t: 0, use: G }, { t: 0.15, pose: { c_handR: h.HR(0.2, 1.3, -0.16) } }, { t: 0.25, pose: { c_handR: h.HR(0.2, 1.45, -0.16) } }, { t: 0.35, pose: { c_handR: h.HR(0.2, 1.3, -0.16) } }, { t: 0.5, pose: { c_handR: h.HR(0.1, 1.55, -0.2) } },
  { t: 0.73, in: 'snap', pose: Object.assign(lunge(0.08, 0.04), { c_handR: h.HR(0.55, 1.25, -0.12) }) }, { t: 0.85, pose: { head: R(-10, 15), c_handL: h.HL(0.15, 1.6, 0.06) } }, { t: 1.4, ...back }]);   /* Shaker Disaster: powder in the face */
C.Band = keys([{ t: 0, use: G }, { t: 0.4, pose: { c_footR: h.FR(0.06, 0.12), c_handR: h.HR(0.2, 1.3, -0.25), c_handL: h.HL(0.2, 1.3, 0.25) } }, { t: 0.65, pose: { chest: R(-6), c_handR: h.HR(0.15, 1.35, -0.5), c_handL: h.HL(0.15, 1.35, 0.5) } },
  { t: 0.8, in: 'snap', pose: { hips: M(0, 0.0, 0.1), spine: R(-14), c_footR: h.FR(0.55, 0.35), c_handR: h.HR(-0.1, 1.4, -0.4), c_handL: h.HL(-0.1, 1.4, 0.4) } }, { t: 0.9, pose: {} }, { t: 1.3, pose: { hips: M(0, -0.05, 0.25), spine: R(16), c_footR: h.FR(0.4), c_footL: h.FL(0.0) } }, { t: 1.9, ...back }]);   /* Resistance Band Betrayal */
C.Strap = keys([{ t: 0, use: AIR }, { t: 0.33, pose: { c_handR: h.HR(0.25, 1.8, -0.2) } }, { t: 0.5, pose: { head: R(-16), c_handR: h.HR(0.4, 2.1, -0.15), c_handL: h.HL(0.1, 1.6, 0.25) } }, { t: 0.9, pose: { head: R(-6, 25) } }, { t: 1.4, ...backAir }]);   /* Spot Me! */
C.Wheel = keys([{ t: 0, use: G }, { t: 0.3, use: 'crouch', pose: { c_handR: h.HR(0.35, 0.15, -0.08), c_handL: h.HL(0.35, 0.15, 0.08) } },
  { t: 0.6, in: 'snap', pose: { all: M(0, -0.55, 0), hips: M(0, 0, 0), spine: R(70), chest: R(10), head: R(-50), c_handR: h.HR(0.95, 0.12, -0.08), c_handL: h.HL(0.95, 0.12, 0.08), c_footR: h.FR(-0.35, 0.0), c_footL: h.FL(-0.35, 0.0) } }, { t: 1.07, pose: {} }, { t: 1.6, pose: { head: R(-30, 20) } }, { t: 2.2, ...back }]);   /* Ab Wheel Regret: flat out, wondering */
C.Bench = keys([{ t: 0, use: 'stand', pose: { all: { rot: [-90, 0, 0], move: [0, 0.3, 0] }, c_handR: h.HR(0.0, 1.5, -0.2), c_handL: h.HL(0.0, 1.5, 0.2) } },
  ...[0.67, 1.27, 1.87].flatMap((tt, k) => [{ t: tt - 0.25, pose: { c_handR: h.HR(0.0, 1.55, -0.2), c_handL: h.HL(0.0, 1.55, 0.2) } }, { t: tt, pose: { c_handR: h.HR(0.0, 2.0 - k * 0.04, -0.2), c_handL: h.HL(0.0, 2.0 - k * 0.06, 0.2), head: R(-10 * k) } }]),
  { t: 2.17, pose: { c_handR: h.HR(0.0, 2.05, -0.2), c_handL: h.HL(0.0, 2.05, 0.2) } }, { t: 2.5, reset: true, use: G, pose: { c_handR: h.HR(0.15, 1.3, -0.25) } }, { t: 2.9, ...back }]);   /* Three-Rep Bench PR, lying on his back */
C.Grow = keys([{ t: 0, use: G },   /* the injection: looks left and right, the pocket, the jab, three swells, down onto his knuckles */
  { t: 0.2, pose: { head: R(0, 40) } }, { t: 0.4, pose: { head: R(0, -40) } }, { t: 0.55, pose: { head: R(0, 0), c_handR: h.HR(-0.02, 0.9, -0.2) } },
  { t: 0.75, pose: { c_handR: h.HR(0.15, 1.25, 0.05), c_handL: h.HL(0.0, 1.0, 0.3) } }, { t: 0.9, pose: { c_handR: h.HR(0.05, 1.35, 0.15), head: R(10, 25) } },
  { t: 1.05, pose: { chest: S(1.25, 1.1, 1.25), head: S(0.8, 0.91, 0.8), c_handR: h.HR(0.1, 1.0, -0.3) } }, { t: 1.2, pose: { chest: S(1.18, 1.08, 1.2), head: S(0.85, 0.93, 0.83) } },
  { t: 1.4, pose: { chest: S(1.4, 1.15, 1.4), head: S(0.71, 0.87, 0.71), armR: S(1.3), armL: S(1.3) } }, { t: 1.55, pose: { chest: S(1.35, 1.13, 1.35), armR: S(1.25), armL: S(1.25) } },
  { t: 1.75, pose: { chest: S(1.55, 1.2, 1.5), head: S(0.65, 0.83, 0.67), armR: S(1.35), armL: S(1.35), foreR: S(1.5), foreL: S(1.5), thighR: S(1.5, 1, 1.5), thighL: S(1.5, 1, 1.5) } },
  { t: 2.3, pose: { hips: M(0, -0.25, 0), spine: R(30), chest: R(20), head: R(-40), c_handR: h.HR(0.45, 0.1, -0.45), c_handL: h.HL(0.45, 0.1, 0.45), c_footR: h.FR(-0.05, 0, -0.18), c_footL: h.FL(-0.1, 0, 0.18) } },
  { t: 2.62, pose: { hips: M(0, -0.3, 0) } }, { t: 3.0, pose: { hips: M(0, -0.27, 0) } }]);
/* TAKE FIVE (the INTENSITY addendum): the whole 15 seconds as one clip, sampled at the elapsed tick. A first pass on this
   rig; the full performance (knee contact, fingers, the shuffle) is for the animation work to replace. */
{ const KN = { hips: M(0, -0.12, -0.1), spine: R(34), chest: R(14), head: R(-26), c_handR: h.HR(0.16, 0.6, -0.12), c_handL: h.HL(0.16, 0.6, 0.12), c_footR: h.FR(0.02), c_footL: h.FL(-0.04) };
  const breath = (t0, t1, base) => { const out = []; for (let t = t0; t < t1 - 0.01; t += 0.6) out.push({ t: Math.round(t * 100) / 100, pose: Object.assign({}, base, { chest: R((base.chest ? base.chest.rot[0] : 0) + ((Math.round(t / 0.6) % 2) ? 5 : -2)) }) }); return out; };
  const OH = { hips: M(0, -0.02, 0), spine: R(-4), chest: R(-6), head: R(-6), c_handR: h.HR(-0.06, 1.98, -0.12), c_handL: h.HL(-0.06, 1.98, 0.12) };
  C.Exhaust = keys([{ t: 0, use: G }, ...breath(0.3, 1.5, KN), { t: 1.6, pose: Object.assign({}, KN, { head: R(-40, -10) }) }, ...breath(2.0, 3.0, KN),
    { t: 4.5, use: G, pose: OH }, ...breath(5.1, 6.0, OH),
    { t: 6.4, pose: Object.assign({}, OH, { c_footR: h.FR(0.12, 0.06) }) }, { t: 6.9, pose: { c_footR: h.FR(0.1), c_footL: h.FL(0.0, 0.06) } }, { t: 7.4, pose: { c_footL: h.FL(0.08), head: R(-2, 20) } }, { t: 8.2, pose: { c_footR: h.FR(-0.02, 0.06) } }, { t: 8.7, pose: { c_footR: h.FR(0.02), head: R(-6, 0) } },
    { t: 9.4, use: G, pose: { chest: R(4), c_handR: h.HR(0.32, 1.45, -0.2), c_handL: h.HL(-0.06, 1.0, 0.26), head: R(4) } }, { t: 10.2, pose: { head: R(14) } }, { t: 10.7, pose: { head: R(2) } }, { t: 11.3, pose: { head: R(14) } }, { t: 11.8, pose: { head: R(4) } },
    { t: 12.2, use: G, pose: { hips: M(0, -0.04, 0), chest: R(2), c_handR: h.HR(0.3, 1.45, -0.12), c_handL: h.HL(0.24, 1.42, 0.12) } }, { t: 12.6, pose: { c_handR: h.HR(0.32, 1.48, -0.12) } },
    { t: 13.2, use: G, pose: Object.assign({}, KN, { c_handL: h.HL(0.0, 0.9, 0.24) }) }, { t: 13.8, pose: { chest: R(20) } },
    { t: 14.4, reset: true, use: G, pose: { chest: R(-4), c_handR: h.HR(0.05, 1.82, -0.1) } }, { t: 14.7, pose: { chest: R(2) } }, { t: 15.0, ...back }]); }
human.pack = { base: 'work/joey-human-rigged.glb', texture: 1024, out: 'export/joey-v1.glb' };

/* =====================================================================================================================
   Cronky Dong (1.93 m mesh with Joey's head; shown 27 tall standing, so his deep knuckle stance is about the 18 he is in the game)
   ===================================================================================================================== */
const JB = { note: 'Cronky Dong: metres, feet on y = 0, facing +Z, his right is -X. Joey’s own head (headswap.py).', prep: { yaw: 0, translate: [0, 0.952, 0] },
  pelvis: 0.97, waist: 1.15, ribs: 1.34, neck: 1.6, top: 1.95, cz: 0.0, hz: 0.03, handX: 0.42,
  sho: [[-0.30, 1.45, 0.02], mir([-0.30, 1.45, 0.02])], elb: [[-0.40, 1.12, 0.05], mir([-0.40, 1.12, 0.05])], wri: [[-0.42, 0.86, 0.08], mir([-0.42, 0.86, 0.08])], fist: [[-0.43, 0.72, 0.09], mir([-0.43, 0.72, 0.09])],
  hip: [[-0.13, 0.93, 0], mir([-0.13, 0.93, 0])], knee: [[-0.17, 0.5, 0.03], mir([-0.17, 0.5, 0.03])], ankle: [[-0.2, 0.08, -0.03], mir([-0.2, 0.08, -0.03])], toe: [[-0.21, 0.02, 0.16], mir([-0.21, 0.02, 0.16])],
  headBox: [[-0.14, 1.6, -0.15], [0.14, 1.98, 0.27]] };
const big = body(JB), b = targets(JB), K = big.clips;
/* the knuckle stance: hips low, torso pitched well forward, fists planted ahead, the face still looking forward */
const HY = -0.46;   /* a deep squat, thighs near level, as in the owner's pictures: with a human's arms that is what puts the fists on the floor */
const KS = { hips: M(0, HY, -0.1), spine: R(28), chest: R(22), head: R(-50), c_handR: b.HR(0.36, 0.13, -0.38), c_handL: b.HL(0.36, 0.13, 0.38), c_footR: b.FR(-0.06, 0, -0.24), c_footL: b.FL(-0.1, 0, 0.24) };
big.poses = {
  stand: { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {} },
  kn: KS,
  air: { hips: M(0, 0, 0), spine: R(14), chest: R(8), head: R(-16), c_handR: b.HR(0.25, 0.75, -0.55), c_handL: b.HL(0.2, 0.8, 0.55), c_footR: b.FR(0.08, 0.18), c_footL: b.FL(-0.08, 0.1) },
  crouch: Object.assign({}, KS, { hips: M(0, HY - 0.08, -0.1), spine: R(36), chest: R(24), head: R(-56) }),
  tuck: { spine: R(26), chest: R(18), c_footL: b.FL(0.18, 0.36), c_footR: b.FR(0.18, 0.36), c_handL: b.HL(0.3, 0.95, 0.36), c_handR: b.HR(0.3, 0.95, -0.36) } };
const GB = ['stand', 'kn'], AB = ['stand', 'air'], backB = { reset: true, use: GB }, backBA = { reset: true, use: AB };
K.Idle = keys([{ t: 0, use: GB }, { t: 0.9, pose: { hips: M(0, HY + 0.02, -0.1), chest: R(19), head: R(-48, 4) } }, { t: 1.8, pose: { hips: M(0, HY, -0.1), chest: R(22), head: R(-50, -3) } }, { t: 2.7, use: GB }]);
K.Idle2 = keys([{ t: 0, use: GB }, { t: 0.5, pose: { head: R(-30, 30) } }, { t: 1.2, pose: { head: R(-30, -20) } }, { t: 1.9, pose: { head: R(-36, 0) } }, { t: 2.4, use: GB }]);   /* looks round, almost bored */
/* Knuckle-walking, the way a gorilla goes: each fist lands on its knuckles and pushes back, with the opposite foot
   (a diagonal gait); the shoulders roll from side to side. The run is a bound: both fists, then both feet. */
{ const step = (k, fz, lift, roll) => { const s = k ? 1 : -1;   /* k 0: right fist and left foot forward */
    return { hips: M(0, HY + lift * 0.2, -0.1), chest: R(22, s * 8, -s * roll), head: R(-50, -s * 4),
      c_handR: b.HR(0.36 + s * -fz, 0.13 + (k ? lift : 0), -0.38), c_handL: b.HL(0.36 + s * fz, 0.13 + (k ? 0 : lift), 0.38),
      c_footR: b.FR(-0.06 + s * fz * 0.8, k ? 0 : lift * 0.7, -0.24), c_footL: b.FL(-0.1 - s * fz * 0.8, k ? lift * 0.7 : 0, 0.24) }; };
  const mid = (k) => ({ hips: M(0, HY + 0.04, -0.1), chest: R(22, 0, 0), c_handR: b.HR(0.36, 0.13 + (k ? 0.12 : 0), -0.38), c_handL: b.HL(0.36, 0.13 + (k ? 0 : 0.12), 0.38) });
  K.Walk = keys([{ t: 0, use: GB, pose: step(0, 0.2, 0, 6) }, { t: 0.3, pose: mid(0) }, { t: 0.6, pose: step(1, 0.2, 0, 6) }, { t: 0.9, pose: mid(1) }, { t: 1.2, pose: step(0, 0.2, 0, 6) }]);
  const reach = { hips: M(0, HY + 0.14, 0.1), spine: R(40), chest: R(24, 0, 0), head: R(-60), c_handR: b.HR(0.95, 0.14, -0.36), c_handL: b.HL(0.88, 0.2, 0.4), c_footR: b.FR(-0.5, 0.25, -0.24), c_footL: b.FL(-0.42, 0.3, 0.24) };
  const plant = { hips: M(0, HY - 0.04, -0.05), spine: R(32), chest: R(22), head: R(-54), c_handR: b.HR(0.3, 0.13, -0.36), c_handL: b.HL(0.36, 0.13, 0.4), c_footR: b.FR(-0.2, 0.1, -0.24), c_footL: b.FL(-0.24, 0.05, 0.24) };
  const gather = { hips: M(0, HY + 0.06, -0.1), spine: R(26), chest: R(20), head: R(-48), c_handR: b.HR(-0.05, 0.3, -0.36), c_handL: b.HL(0.0, 0.25, 0.4), c_footR: b.FR(0.35, 0.0, -0.24), c_footL: b.FL(0.28, 0.0, 0.24) };
  K.Run = keys([{ t: 0, use: GB, pose: reach }, { t: 0.14, pose: plant }, { t: 0.3, pose: gather }, { t: 0.46, pose: reach }]); }
K.Crouch = keys([{ t: 0, use: GB }, { t: 0.15, use: 'crouch' }]);
K.Rise = keys([{ t: 0, use: AB, pose: { c_footR: b.FR(0.0, 0.28), c_footL: b.FL(-0.1, 0.12) } }, { t: 0.4, pose: { c_footR: b.FR(0.08, 0.18) } }]);
K.Fall = keys([{ t: 0, use: AB }, { t: 0.4, pose: { c_handR: b.HR(0.25, 0.85, -0.58), c_handL: b.HL(0.2, 0.9, 0.58) } }, { t: 0.8, pose: { c_handR: b.HR(0.25, 0.75, -0.55), c_handL: b.HL(0.2, 0.8, 0.55) } }]);
K.Land = keys([{ t: 0, use: ['stand', 'crouch'] }, { t: 0.15, pose: { hips: M(0, HY - 0.12, -0.1) } }, { t: 0.4, ...backB }]);
K.Shield = keys([{ t: 0, use: GB }, { t: 0.12, pose: { hips: M(0, HY - 0.04, -0.12), spine: R(36), head: R(-58), c_handR: b.HR(0.35, 0.65, -0.12), c_handL: b.HL(0.38, 0.7, 0.12) } }]);   /* hunched behind both forearms */
K.Hit = keys([{ t: 0, use: GB, pose: { hips: M(0, HY + 0.1, -0.18), spine: R(10), chest: R(-2), head: R(-26), c_handR: b.HR(0.15, 0.7, -0.6), c_handL: b.HL(0.1, 0.75, 0.6) } }, { t: 0.3, pose: { spine: R(16), chest: R(6) } }, { t: 0.6, ...backB }]);
K.Tumble = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(32), chest: R(22) } }, { t: 0.6, pose: { spine: R(26), chest: R(18) } }]);
K.Down = keys([{ t: 0, use: 'stand', pose: { all: R(-50) } }, { t: 0.3, pose: { all: { rot: [-90, 0, 0], move: [0, 0.3, 0.95] }, c_handL: b.HL(-0.1, 1.0, 0.7), c_handR: b.HR(0.1, 0.95, -0.7) } }]);
K.Dodge = keys([{ t: 0, use: GB }, { t: 0.14, pose: { all: R(0, 30), hips: M(0, HY - 0.02, -0.22), spine: R(32), head: R(-52), c_handR: b.HR(0.2, 0.6, -0.15), c_handL: b.HL(0.2, 0.65, 0.15) } }, { t: 0.45, ...backB }]);
K.Ledge = keys([{ t: 0, use: 'stand', pose: { head: R(-12), c_handL: b.HL(0.3, 2.0, 0.25), c_handR: b.HR(0.3, 2.0, -0.25) } }, { t: 0.8, pose: { c_footL: b.FL(0.05, 0.05), c_footR: b.FR(-0.05) } }, { t: 1.6, pose: { c_footL: b.FL(-0.05), c_footR: b.FR(0.05, 0.05) } }]);
K.Hold = keys([{ t: 0, use: GB, pose: { spine: R(14), chest: R(6), head: R(-24), c_handR: b.HR(0.65, 0.95, -0.25), c_handL: b.HL(0.4, 0.13, 0.38) } }, { t: 0.4, pose: { c_handR: b.HR(0.66, 0.97, -0.25) } }, { t: 0.8, pose: { c_handR: b.HR(0.65, 0.95, -0.25) } }]);
/* the carry: the opponent held overhead in both hands, standing taller, walking on his feet */
const CARRY = { hips: M(0, -0.06, 0), spine: R(4), chest: R(-4), head: R(-6), c_handR: b.HR(0.05, 2.15, -0.18), c_handL: b.HL(0.05, 2.15, 0.18) };
K.Carry = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.6, pose: { hips: M(0, -0.08, 0) } }, { t: 1.2, pose: CARRY }]);
K.CarryWalk = keys([{ t: 0, use: 'stand', pose: Object.assign({}, CARRY, { c_footR: b.FR(0.2), c_footL: b.FL(-0.2, 0.08) }) }, { t: 0.35, pose: { hips: M(0, -0.03, 0), c_footR: b.FR(0), c_footL: b.FL(0, 0.14) } }, { t: 0.7, pose: { hips: M(0, -0.08, 0), c_footR: b.FR(-0.2, 0.08), c_footL: b.FL(0.2) } }, { t: 1.05, pose: { hips: M(0, -0.03, 0), c_footR: b.FR(0, 0.14), c_footL: b.FL(0) } }, { t: 1.4, pose: { hips: M(0, -0.06, 0), c_footR: b.FR(0.2), c_footL: b.FL(-0.2, 0.08) } }]);
K.Held = keys([{ t: 0, use: AB, pose: { head: R(-10), c_handL: b.HL(0.15, 1.4, 0.5), c_handR: b.HR(0.15, 1.4, -0.5) } }, { t: 0.3, pose: { c_footL: b.FL(0.1, 0.2) } }, { t: 0.6, pose: { c_footL: b.FL(-0.05, 0.08) } }]);
K.Buried = keys([{ t: 0, use: 'stand', pose: { c_handR: b.HR(0.2, 1.3, -0.6), c_handL: b.HL(0.2, 1.3, 0.6) } }, { t: 0.2, pose: { c_handR: b.HR(0.2, 1.4, -0.66), c_handL: b.HL(0.2, 1.2, 0.6) } }, { t: 0.4, pose: { c_handR: b.HR(0.2, 1.3, -0.6), c_handL: b.HL(0.2, 1.3, 0.6) } }]);
/* ---- attacks: the reference fighter's motions with this body (keys at 30 fps; contact = the hit's first frame) ---- */
const SW = (dz, drop) => ({ hips: M(0, HY + 0.12 - (drop || 0), -0.1 + dz) });   /* attacks rise a little out of the squat */
K.Check = keys([{ t: 0, use: GB }, { t: 0.1, pose: { chest: R(10, 12), c_handR: b.HR(0.3, 0.9, -0.3) } }, { t: 0.17, in: 'snap', pose: Object.assign(SW(0.08), { chest: R(10, -14), c_handR: b.HR(0.9, 1.0, -0.2) }) }, { t: 0.24, pose: {} }, { t: 0.8, ...backB }]);
K.Hook = keys([{ t: 0, use: GB, pose: { chest: R(10, -14), c_handR: b.HR(0.9, 1.0, -0.2) } }, { t: 0.08, pose: { chest: R(8, 16), c_handL: b.HL(0.3, 1.0, 0.6) } }, { t: 0.13, in: 'snap', pose: Object.assign(SW(0.1), { chest: R(4, -24), head: R(-28), c_handL: b.HL(0.85, 1.3, 0.1) }) }, { t: 0.2, pose: {} }, { t: 1.05, ...backB }]);
K.Backhand = keys([{ t: 0, use: GB }, { t: 0.17, pose: { chest: R(12, 30), c_handR: b.HR(0.0, 0.9, -0.7) } }, { t: 0.23, in: 'snap', pose: Object.assign(SW(0.12), { chest: R(12, -26), c_handR: b.HR(1.15, 0.8, -0.1) }) }, { t: 0.3, pose: {} }, { t: 1.15, ...backB }]);
K.ArmSweep = keys([{ t: 0, use: GB }, { t: 0.13, in: 'snap', pose: { hips: M(0, -0.06, -0.05), spine: R(6), chest: R(-6), head: R(-14), c_handR: b.HR(0.55, 1.5, -0.3) } }, { t: 0.25, pose: { c_handR: b.HR(0.0, 2.15, -0.25) } }, { t: 0.37, pose: { c_handR: b.HR(-0.5, 1.55, -0.3) } }, { t: 1.3, ...backB }]);
K.LowSlap = keys([{ t: 0, use: GB }, { t: 0.1, pose: { c_handR: b.HR(0.4, 0.45, -0.38) } }, { t: 0.17, in: 'snap', pose: Object.assign(SW(0.04, 0.06), { spine: R(32), c_handR: b.HR(1.05, 0.12, -0.25) }) }, { t: 0.23, pose: {} }, { t: 0.83, ...backB }]);
K.Roll = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.27, in: 'snap', pose: { all: { rot: [180, 0, 0], move: [0, 0.75, 0.2] } } }, { t: 0.4, pose: { all: { rot: [300, 0, 0], move: [0, 0.4, 0.3] } } }, { t: 0.6, pose: { all: { rot: [360, 0, 0], move: [0, 0, 0.3] } } }, { t: 1.15, reset: true, use: GB }]);   /* the whole body rolls forward */
K.Clap = keys([{ t: 0, use: GB }, { t: 0.45, pose: { hips: M(0, -0.12, -0.15), spine: R(6), chest: R(-4), head: R(-20), c_handR: b.HR(-0.1, 1.2, -0.75), c_handL: b.HL(-0.1, 1.2, 0.75) } },
  { t: 0.73, in: 'snap', pose: Object.assign(SW(0.18), { spine: R(34), chest: R(14), head: R(-44), c_handR: b.HR(1.3, 0.75, -0.06), c_handL: b.HL(1.3, 0.75, 0.06) }) }, { t: 0.8, pose: {} }, { t: 1.85, ...backB }]);
K.OverClap = keys([{ t: 0, use: GB }, { t: 0.2, pose: { hips: M(0, -0.08, -0.05), spine: R(8), c_handR: b.HR(0.2, 1.3, -0.8), c_handL: b.HL(0.2, 1.3, 0.8) } }, { t: 0.47, in: 'snap', pose: { hips: M(0, 0.0, 0), spine: R(-4), chest: R(-6), head: R(-6), c_handR: b.HR(0.05, 2.45, -0.04), c_handL: b.HL(0.05, 2.45, 0.04) } }, { t: 0.53, pose: {} }, { t: 1.65, ...backB }]);
K.Hammer = keys([{ t: 0, use: GB }, { t: 0.07, pose: { hips: M(0, -0.06, -0.05), spine: R(10), c_handR: b.HR(0.5, 1.5, -0.3), c_handL: b.HL(-0.3, 1.5, 0.3) } }, { t: 0.37, in: 'snap', pose: Object.assign(SW(0, 0.12), { spine: R(34), head: R(-46), c_handR: b.HR(0.75, 0.1, -0.35), c_handL: b.HL(-0.55, 0.1, 0.35) }) }, { t: 0.47, pose: {} }, { t: 1.85, ...backB }]);
K.Spin = keys([{ t: 0, use: AB }, { t: 0.33, in: 'snap', pose: { spine: R(0), chest: R(0), c_handR: b.HR(0.0, 1.35, -1.0), c_handL: b.HL(0.0, 1.35, 1.0) } }, { t: 0.5, pose: { all: R(0, 180) } }, { t: 0.7, pose: { all: R(0, 360) } }, { t: 0.87, pose: { all: R(0, 540) } }, { t: 1.27, reset: true, use: AB, pose: { all: R(0, 720) } }]);
K.FistDrop = keys([{ t: 0, use: AB }, { t: 0.45, pose: { chest: R(-14), head: R(-6), c_handR: b.HR(-0.1, 1.85, -0.12), c_handL: b.HL(-0.1, 1.85, 0.12) } }, { t: 0.6, in: 'snap', pose: { chest: R(10), head: R(-24), c_handR: b.HR(0.65, 1.35, -0.08), c_handL: b.HL(0.65, 1.35, 0.08) } }, { t: 0.7, pose: { chest: R(26), c_handR: b.HR(0.75, 0.5, -0.08), c_handL: b.HL(0.75, 0.5, 0.08) } }, { t: 1.85, ...backBA }]);
K.BackKick = keys([{ t: 0, use: AB }, { t: 0.13, pose: { spine: R(20), c_footR: b.FR(0.15, 0.4) } }, { t: 0.23, in: 'snap', pose: { spine: R(30), chest: R(16), head: R(-30), c_footR: b.FR(-0.85, 0.65) } }, { t: 0.3, pose: {} }, { t: 1.05, ...backBA }]);
K.Bump = keys([{ t: 0, use: AB }, { t: 0.13, pose: { spine: R(20), head: R(16) } }, { t: 0.2, in: 'snap', pose: { spine: R(-16), chest: R(-12), head: R(-36), c_handR: b.HR(-0.1, 1.0, -0.65), c_handL: b.HL(-0.1, 1.0, 0.65) } }, { t: 0.33, pose: {} }, { t: 1.25, ...backBA }]);
K.Stomp = keys([{ t: 0, use: AB }, { t: 0.33, pose: { c_footR: b.FR(0.1, 0.5), c_footL: b.FL(0.0, 0.42), c_handR: b.HR(0.0, 1.3, -0.6), c_handL: b.HL(0.0, 1.3, 0.6) } }, { t: 0.47, in: 'snap', pose: { hips: M(0, 0.05, 0), c_footR: b.FR(0.05, -0.2), c_footL: b.FL(-0.05, -0.15) } }, { t: 0.53, pose: {} }, { t: 1.8, ...backBA }]);
K.Grab = keys([{ t: 0, use: GB }, { t: 0.17, pose: { c_handR: b.HR(0.3, 0.9, -0.35), c_handL: b.HL(0.3, 0.9, 0.35) } }, { t: 0.27, in: 'snap', pose: Object.assign(SW(0.1), { spine: R(20), c_handR: b.HR(0.95, 0.85, -0.12), c_handL: b.HL(0.95, 0.85, 0.12) }) }, { t: 0.33, pose: {} }, { t: 1.25, ...backB }]);
K.Wind = keys([{ t: 0, use: GB, pose: { chest: R(10, 30), c_handR: b.HR(-0.35, 1.3, -0.7) } }, { t: 0.25, pose: { chest: R(8, 40), c_handR: b.HR(-0.5, 1.7, -0.5) } }, { t: 0.5, pose: { chest: R(10, 30), c_handR: b.HR(-0.35, 1.3, -0.7) } }]);   /* The Entire Gym, charging: the arm whirls back */
K.Punch = keys([{ t: 0, use: GB, pose: { chest: R(10, 34), c_handR: b.HR(-0.45, 1.4, -0.65) } }, { t: 0.5, pose: { chest: R(6, 44), c_handR: b.HR(-0.6, 1.2, -0.55) } },
  { t: 0.63, in: 'snap', pose: Object.assign(SW(0.22), { spine: R(30), chest: R(14, -30), head: R(-42), c_handR: b.HR(1.35, 0.95, -0.05), c_footR: b.FR(0.2) }) }, { t: 0.7, pose: {} }, { t: 2.05, ...backB }]);
K.Headbutt = keys([{ t: 0, use: GB }, { t: 0.4, pose: { hips: M(0, -0.06, -0.12), spine: R(-10), chest: R(-12), head: R(-10), c_handR: b.HR(0.2, 0.9, -0.6), c_handL: b.HL(0.2, 0.9, 0.6) } },
  { t: 0.67, in: 'snap', pose: { hips: M(0, -0.2, 0.2), spine: R(50), chest: R(26), head: R(-20), c_handR: b.HR(0.6, 0.13, -0.38), c_handL: b.HL(0.6, 0.13, 0.38) } }, { t: 0.73, pose: {} }, { t: 2.1, ...backB }]);   /* Cap Check */
K.SpinG = keys([{ t: 0, use: GB }, { t: 0.15, pose: { hips: M(0, -0.04, 0), spine: R(4), chest: R(0), head: R(-6), c_handR: b.HR(0.0, 1.3, -1.0), c_handL: b.HL(0.0, 1.3, 1.0) } },
  ...Array.from({ length: 12 }, (_, k) => ({ t: 0.63 + k * 0.125, pose: { all: R(0, (k + 1) * 180) } })), { t: 3.5, reset: true, use: GB }]);   /* Lat Spread Catastrophe on the ground */
K.SpinA = keys([{ t: 0, use: AB, pose: { c_handR: b.HR(0.0, 1.3, -1.0), c_handL: b.HL(0.0, 1.3, 1.0), spine: R(0), chest: R(0) } }, ...Array.from({ length: 10 }, (_, k) => ({ t: 0.13 + k * 0.13, pose: { all: R(0, (k + 1) * 180) } })), { t: 2.3, reset: true, use: AB }]);
K.Slap = keys([{ t: 0, use: GB }, { t: 0.2, pose: { spine: R(10), c_handR: b.HR(0.3, 1.3, -0.4), c_handL: b.HL(0.0, 1.3, 0.4) } }, { t: 0.4, in: 'snap', pose: Object.assign(SW(0, 0.08), { spine: R(36), c_handR: b.HR(0.75, 0.1, -0.35), c_handL: b.HL(0.0, 1.2, 0.4) }) },
  { t: 0.58, pose: { c_handR: b.HR(0.4, 1.2, -0.4), c_handL: b.HL(0.3, 1.3, 0.4) } }, { t: 0.77, in: 'snap', pose: { c_handR: b.HR(0.4, 1.2, -0.4), c_handL: b.HL(0.75, 0.1, 0.35) } }, { t: 1.55, ...backB }]);   /* Floor Is Leg Day */
K.SlapAir = keys([{ t: 0, use: AB }, { t: 0.4, pose: { c_handR: b.HR(0.3, 1.8, -0.2), c_handL: b.HL(0.3, 1.8, 0.2) } }, { t: 0.63, in: 'snap', pose: { chest: R(16), c_handR: b.HR(0.65, 0.9, -0.15) } }, { t: 0.93, in: 'snap', pose: { chest: R(28), c_handL: b.HL(0.65, 0.4, 0.15) } }, { t: 1.65, ...backBA }]);
K.Toss = keys([{ t: 0, use: GB, pose: CARRY }, { t: 0.5, in: 'snap', pose: { spine: R(10), c_handR: b.HR(0.7, 1.9, -0.2), c_handL: b.HL(0.7, 1.9, 0.2) } }, { t: 1.4, ...backB }]);   /* the carry throws and the ordinary throws */
big.pack = { base: 'work/joey-big-rigged.glb', texture: 2048, out: 'export/cronky-v1.glb' };

/* ---- write ---- */
fs.mkdirSync(OUT, { recursive: true });
for (const [n, s] of [['human', human], ['big', big]]) {
  const pack = s.pack; delete s.pack;
  fs.writeFileSync(path.join(OUT, 'rig-' + n + '.json'), JSON.stringify(s, null, 1));
  fs.writeFileSync(path.join(OUT, 'pack-' + n + '.json'), JSON.stringify(pack, null, 1) + '\n');
  console.log('wrote rig-' + n + '.json: ' + s.bones.length + ' bones, ' + Object.keys(s.clips).length + ' clips');
}
/* ---- the game's manifest entries ---- */
const common = (c) => ({ idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 },
  rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 }, shield: { clip: 'Shield', from: 0, to: c }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true },
  down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true }, airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.45 }, roll: { clip: 'Tumble', bounce: true },
  ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' } });
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), cur = JSON.parse(fs.readFileSync(mf, 'utf8'));
cur.Joey = { file: 'assets/joey/export/joey-v1.glb', height: 13.5,
  clips: Object.assign(common(0.15), { throw: { clip: 'Reach', from: 0.3, to: 1.0 }, throw_u: { clip: 'Bench', from: 0, to: 2.9 }, grow: { clip: 'Grow', from: 0, to: 3.0 }, exhaust: { clip: 'Exhaust', from: 0, to: 15.0 } }),
  strikers: [{ bone: 'handR', ext: 1.0 }, { bone: 'handL', ext: 1.0 }, { bone: 'footL', ext: 1.4 }, { bone: 'footR', ext: 1.4 }], springs: [],
  attacks: { jab: A('Palm', 0.23, 0.27, 0, 0.7), jab2: A('Curl', 0.3, 0.33, 0, 0.8), jab3: A('Shove', 0.5, 0.57, 0, 1.3), ftilt: A('Raise', 0.4, 0.5, 0, 1.1), utilt: A('Press', 0.43, 0.53, 0, 1.2), dtilt: A('Toe', 0.33, 0.4, 0, 1.0), dash: A('Jog', 0.56, 0.67, 0, 1.75),
    fsmash: A('PR', 1.0, 1.07, 0, 2.4), usmash: A('Clean', 0.93, 1.0, 0, 2.35), dsmash: A('Lunge', 0.77, 1.27, 0, 2.4), nair: A('Jack', 0.36, 0.5, 0, 1.25), fair: A('Front', 0.53, 0.6, 0, 1.5), bair: A('Kick', 0.43, 0.53, 0, 1.35), uair: A('High5', 0.4, 0.47, 0, 1.2), dair: A('Box', 0.67, 0.77, 0, 1.8),
    grab: A('Reach', 0.37, 0.43, 0, 1.3), dgrab: A('Reach', 0.37, 0.43, 0, 1.3), pgrab: A('Reach', 0.37, 0.43, 0, 1.3), getup: A('Lunge', 0.77, 0.8, 0, 1.6), ledgeatk: A('Shove', 0.5, 0.57, 0, 1.3),
    nspec: A('Shake', 0.73, 0.8, 0, 1.4), sspec: A('Band', 0.8, 0.9, 0, 1.9), uspec: A('Strap', 0.33, 0.55, 0, 1.4), dspec: A('Wheel', 0.6, 1.07, 0, 2.2), '*': A('Palm', 0.23, 0.27, 0, 0.7) } };
cur['Cronky Dong'] = { file: 'assets/joey/export/cronky-v1.glb', height: 27,
  clips: Object.assign(common(0.12), { throw: { clip: 'Toss', from: 0, to: 1.4 }, carry: { clip: 'Carry' }, carryWalk: { clip: 'CarryWalk' }, punchWind: { clip: 'Wind' }, buried: { clip: 'Buried' } }),
  strikers: [{ bone: 'handR', ext: 1.4 }, { bone: 'handL', ext: 1.4 }, { bone: 'footR', ext: 1.6 }, { bone: 'head', ext: 1.6 }], springs: [],
  attacks: { jab: A('Check', 0.17, 0.2, 0, 0.8), jab2: A('Hook', 0.13, 0.2, 0, 1.05), ftilt: A('Backhand', 0.23, 0.3, 0, 1.15), utilt: A('ArmSweep', 0.13, 0.37, 0, 1.3), dtilt: A('LowSlap', 0.17, 0.23, 0, 0.83), dash: A('Roll', 0.27, 0.6, 0, 1.15),
    fsmash: A('Clap', 0.73, 0.8, 0, 1.85), usmash: A('OverClap', 0.47, 0.53, 0, 1.65), dsmash: A('Hammer', 0.37, 0.47, 0, 1.85), nair: A('Spin', 0.33, 0.87, 0, 1.27), fair: A('FistDrop', 0.6, 0.77, 0, 1.85), bair: A('BackKick', 0.23, 0.53, 0, 1.05), uair: A('Bump', 0.2, 0.33, 0, 1.25), dair: A('Stomp', 0.47, 0.53, 0, 1.8),
    grab: A('Grab', 0.27, 0.33, 0, 1.25), dgrab: A('Grab', 0.27, 0.33, 0, 1.25), pgrab: A('Grab', 0.27, 0.33, 0, 1.25), ledgeatk: A('Backhand', 0.23, 0.3, 0, 1.15), getup: A('Hammer', 0.37, 0.47, 0, 1.85),
    nspec: A('Wind', 0, 0.5, 0, 0.5), nspecR: A('Punch', 0.63, 0.7, 0, 2.05), nspecF: A('Punch', 0.63, 0.7, 0, 2.05), sspec: A('Headbutt', 0.67, 0.73, 0, 2.1), uspec: A('SpinG', 0.63, 2.1, 0, 3.5), uspecA: A('SpinA', 0.13, 1.43, 0, 2.3),
    dspec: A('Slap', 0.4, 0.77, 0, 1.55), dspecA: A('SlapAir', 0.63, 0.93, 0, 1.65), '*': A('Check', 0.17, 0.2, 0, 0.8) } };
fs.writeFileSync(mf, JSON.stringify(cur, null, 1) + '\n'); console.log('manifest: ' + Object.keys(cur).join(', '));
