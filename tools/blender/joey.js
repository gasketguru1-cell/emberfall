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
  crouch: { hips: M(0, -0.32, 0.02), footR: R(-38), footL: R(-38), spine: R(18), chest: R(10), head: R(-14), c_handR: h.HR(0.28, 0.55, -0.2), c_handL: h.HL(0.28, 0.55, 0.2), c_footR: h.FR(0.06), c_footL: h.FL(-0.06) },
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
C.Land = keys([{ t: 0, use: ['stand', 'crouch'] }, { t: 0.2, pose: { hips: M(0, -0.18, 0), footR: R(-22), footL: R(-22), spine: R(8), c_handR: h.HR(0.12, 0.7, -0.26), c_handL: h.HL(0.12, 0.7, 0.26) } }, { t: 0.45, ...back }]);
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
/* TAKE FIVE (the INTENSITY addendum, section 04): the whole 15 seconds as one clip, sampled by the game at the elapsed tick,
   so a hit can interrupt it and it picks up again at the right moment. It is written as one continuous performance and
   baked to a key every 0.1 s: a slow body story (six phases blended into each other) with breathing laid over it.
   The breathing is the realism: an exhausted man's breath is fast and deep at first (a gasp in, a longer sag out, about
   70 a minute), and slows and shallows as he recovers (about 40 a minute by the end). Each breath lifts the ribs and
   widens the chest a little, rises the shoulders, lifts the head, and on the out-breath the back sags. The face is never
   touched: the head is rigid, the chest's breathing swell is cancelled on the head and arms so neither grows. */
{ const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const lerpA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  /* hands-on-knees: hips back and down, back rounded, palms on the front of the thighs just above the knees, face down */
  const KNEE = { hips: [0, -0.13, -0.11], spine: [34, 0, 0], chest: [14, 0, 0], head: [-24, 0, 0], hr: [0.17, 0.6, -0.13], hl: [0.17, 0.6, 0.13], fr: [0.03, 0, -0.12], fl: [-0.05, 0, 0.12] };
  /* tall, fingers laced behind his head (wrists clear of the cap and ears, elbows wide), head a little back, gulping air */
  const OVER = { hips: [0, -0.015, 0], spine: [-3, 0, 0], chest: [-5, 0, 0], head: [-7, 0, 0], hr: [-0.11, 1.87, -0.14], hl: [-0.11, 1.87, 0.14], fr: [0, 0, -0.1], fl: [-0.02, 0, 0.1] };
  /* "one second": the right hand up at shoulder height, palm out; the left on his hip */
  const WAIT = { hips: [0.015, -0.01, 0], spine: [4, 0, 0], chest: [4, -6, 0], head: [2, -4, 0], hr: [0.24, 1.58, -0.3], hl: [-0.04, 1.0, 0.27], fr: [0.02, 0, -0.1], fl: [-0.02, 0, 0.1] };
  /* the false start: fists up in a guard, chin tucked, for a hopeful moment */
  const GUARD = { hips: [0, -0.05, 0], spine: [6, 0, 0], chest: [2, 8, 0], head: [6, 0, 0], hr: [0.3, 1.46, -0.12], hl: [0.25, 1.42, 0.13], fr: [0.06, 0, -0.12], fl: [-0.08, 0, 0.12] };
  /* the slump after it: one hand back on a knee, the other hanging */
  const SLUMP = { hips: [0, -0.1, -0.08], spine: [26, 0, 0], chest: [12, -4, 0], head: [-14, 6, 0], hr: [0.08, 0.72, -0.25], hl: [0.16, 0.62, 0.13], fr: [0.03, 0, -0.12], fl: [-0.05, 0, 0.12] };
  const REST = { hips: [0, -0.02, 0], spine: [0, 0, 0], chest: [2, 0, 0], head: [0, 0, 0], hr: [0.03, 0.86, -0.24], hl: [0.03, 0.86, 0.24], fr: [0, 0, -0.1], fl: [-0.03, 0, 0.1] };
  /* the story: [time, pose] with a blend into each over [time, time + dur] */
  const story = [[0, KNEE, 0.35], [3.0, OVER, 1.3], [9.0, WAIT, 0.7], [12.0, GUARD, 0.35], [12.6, SLUMP, 0.6], [14.0, REST, 0.9]];
  const base = t => {
    let p = story[0][1];
    for (let i = 1; i < story.length; i++) { const [t0, q, d] = story[i]; if (t < t0) break; const k = sm((t - t0) / d), o = {}; for (const n in q) o[n] = lerpA(p[n], q[n], k); p = o; }
    if (t < 0.35) { const k = sm(t / 0.35), o = {}; for (const n in KNEE) o[n] = lerpA(REST[n], KNEE[n], k); p = o; }   /* folding over from his stance */
    return p; };
  /* breathing: rate (breaths a second) and depth over time; one extra-deep breath at the end of the false start */
  const rate = t => t < 3 ? 1.15 : t < 6 ? 1.15 - (t - 3) * 0.06 : t < 9 ? 0.97 - (t - 6) * 0.04 : t < 12 ? 0.85 - (t - 9) * 0.03 : 0.72;
  const depth = t => (t < 3 ? 1 : t < 9 ? 1 - (t - 3) * 0.04 : t < 12 ? 0.76 - (t - 9) * 0.04 : t < 14 ? 0.7 : 0.7 - (t - 14) * 0.5) * (t > 13.2 && t < 14.1 ? 1.5 : 1);
  const DT = 0.1, keysOut = []; let ph = 0.62;   /* he arrives at the end of a breath out */
  for (let i = 0; i <= 150; i++) {
    const t = Math.round(i * DT * 100) / 100, p = base(t), A = depth(t);
    if (i) ph += rate(t) * DT;
    const u = ph % 1, w = u < 0.38 ? -Math.cos(Math.PI * u / 0.38) : Math.cos(Math.PI * (u - 0.38) / 0.62), up = (w + 1) / 2;   /* a quick gasp in, a slower sag out */
    const knees = Math.max(0, 1 - sm((t - 2.9) / 0.6)) + (t > 12.6 && t < 14.2 ? sm((t - 12.6) / 0.5) * (1 - sm((t - 13.8) / 0.4)) : 0);   /* hands braced: the shoulders rise less, the back moves more */
    /* the body's own small business on top of the story */
    let hy = 0, hx = 0, hdY = 0, hdP = 0, hdR = 0, chY = 0, chR = 0, fr = p.fr.slice(), fl = p.fl.slice();
    if (t > 1.0 && t < 1.9) { const k = Math.sin(Math.PI * sm((t - 1.0) / 0.9)); hdP -= 20 * k; hdY += 6 * k; }   /* looks up at the opponent, briefly */
    const step = (t0, d, foot, dz) => { if (t > t0 && t < t0 + d) { const k = (t - t0) / d, lift = Math.sin(Math.PI * k); foot[0] += dz * sm(k); foot[1] += 0.045 * lift; hx += (foot === fr ? -1 : 1) * 0.02 * lift; } else if (t >= t0 + d) foot[0] += dz; };
    step(1.95, 0.4, fl, 0.05); step(2.45, 0.4, fr, -0.04);                          /* a shuffle while bent over */
    step(4.4, 0.55, fr, 0.08); step(5.1, 0.55, fl, 0.06);                           /* two miserable steps */
    if (t >= 6.0 && t < 9.0) {                                                      /* paces on the spot, hands still on his head */
      const c = (t - 6.0) / 1.5, k = c % 1, left = Math.floor(c * 2) % 2, lk = (k * 2) % 1, lift = Math.sin(Math.PI * lk) * 0.06;
      (left ? fl : fr)[1] += lift; (left ? fl : fr)[0] += 0.05 * Math.sin(Math.PI * 2 * lk);
      hy -= 0.012 * Math.abs(Math.cos(Math.PI * lk)); hx += (left ? -1 : 1) * 0.025 * Math.sin(Math.PI * lk); chY += (left ? -1 : 1) * 5 * Math.sin(Math.PI * lk); chR += (left ? 1 : -1) * 3 * Math.sin(Math.PI * lk);
      if (t > 7.6 && t < 8.6) { const g = Math.sin(Math.PI * (t - 7.6)); hdY -= 22 * g; hdP += 8 * g; }    /* a small, defeated glance to the side */ }
    if (t >= 9.6 && t < 12.0) { const n = t < 10.9 ? (t - 9.6) / 0.6 : (t - 11.0) / 0.6; if (n > 0 && n < 1) hdP += 9 * Math.sin(Math.PI * n) * (t < 10.9 ? 1 : 0.8); hdY += 4; }   /* nods: explaining a training principle */
    if (t >= 14.25 && t < 14.85) { const k = (t - 14.25) / 0.6; chR += 6 * Math.sin(Math.PI * 2 * k); chY += 4 * Math.sin(Math.PI * k); }   /* rolls his shoulders */
    let hr = p.hr.slice(); if (t >= 14.05 && t < 14.6) { const k = Math.sin(Math.PI * (t - 14.05) / 0.55); hr = lerpA(hr, [0.16, 1.88, -0.1], k); hdP += 4 * k; }   /* tugs the cap's brim straight */
    /* breath on top */
    const inh = A * up, sh = (1 - knees * 0.6) * inh;
    const chestP = p.chest[0] - 4 * inh + chR * 0, spineP = p.spine[0] + (knees ? 4 : 2) * A * (1 - up) - 1.5 * inh;
    const sw = 1 + 0.03 * inh, sd = 1 + 0.045 * inh, su = 1 + 0.012 * inh;   /* the chest widens and deepens more than it grows */
    const handLift = 0.022 * sh;
    keysOut.push({ t, pose: {
      hips: M(p.hips[0] + hx, p.hips[1] + hy + 0.006 * inh, p.hips[2]),
      spine: R(spineP, p.spine[1], p.spine[2]),
      chest: Object.assign(R(chestP, p.chest[1] + chY, p.chest[2] + chR), S(sw, su, sd)),
      head: Object.assign(R(p.head[0] + hdP - 3.5 * inh + 2 * A * (1 - up) * knees, p.head[1] + hdY, p.head[2] + hdR), S(1 / sw, 1 / su, 1 / sd)),
      armR: S(1 / sw, 1 / su, 1 / sd), armL: S(1 / sw, 1 / su, 1 / sd),
      c_handR: h.HR(hr[0], hr[1] + handLift * (1 - knees), hr[2]), c_handL: h.HL(p.hl[0], p.hl[1] + handLift * (1 - knees), p.hl[2]),
      c_footR: h.FR(fr[0], fr[1], fr[2]), c_footL: h.FL(fl[0], fl[1], fl[2]), footR: R(-115 * Math.max(0, -(p.hips[1] + hy))), footL: R(-115 * Math.max(0, -(p.hips[1] + hy))) } });
  }
  keysOut[0].use = G;
  C.Exhaust = keys(keysOut);
}
/* ---- the rest of an ordinary man's states: earnest, a bit stiff, never graceful ---- */
C.Squat = keys([{ t: 0, use: G }, { t: 0.2, pose: { hips: M(0, -0.12, 0), spine: R(10), chest: R(6), head: R(-6), c_handR: h.HR(-0.05, 0.8, -0.28), c_handL: h.HL(-0.05, 0.8, 0.28), c_footR: h.FR(0.02), c_footL: h.FL(-0.02) } }]);   /* arms swing back for the jump */
C.FastFall = keys([{ t: 0, use: AIR, pose: { chest: R(-2), head: R(-4), c_handR: h.HR(0.0, 1.75, -0.28), c_handL: h.HL(0.0, 1.78, 0.28), c_footR: h.FR(0.02, 0.04), c_footL: h.FL(-0.02, 0.02) } }, { t: 0.2, pose: { c_handR: h.HR(0.02, 1.8, -0.3) } }, { t: 0.4, pose: { c_handR: h.HR(0.0, 1.75, -0.28) } }]);
C.Helpless = keys([{ t: 0, use: AIR, pose: { head: R(-6, 0, 6), c_handR: h.HR(-0.1, 1.6, -0.4), c_handL: h.HL(0.3, 1.2, 0.4) } }, { t: 0.2, pose: { c_handR: h.HR(0.3, 1.2, -0.4), c_handL: h.HL(-0.1, 1.6, 0.4), c_footR: h.FR(0.15, 0.2), c_footL: h.FL(-0.05, 0.04) } },
  { t: 0.4, pose: { head: R(-6, 0, -6), c_handR: h.HR(-0.1, 1.6, -0.4), c_handL: h.HL(0.3, 1.2, 0.4), c_footR: h.FR(-0.05, 0.04), c_footL: h.FL(0.15, 0.2) } }]);   /* flailing */
C.LandHard = keys([{ t: 0, use: G, pose: { hips: M(0, -0.05, 0) } }, { t: 0.1, pose: { hips: M(0, -0.3, 0.02), footR: R(-36), footL: R(-36), spine: R(24), chest: R(14), head: R(-12), c_handR: h.HR(0.3, 0.45, -0.22), c_handL: h.HL(0.3, 0.45, 0.22), c_footR: h.FR(0.06), c_footL: h.FL(-0.06) } },
  { t: 0.3, pose: { hips: M(0, -0.2, 0), footR: R(-24), footL: R(-24), spine: R(16), head: R(-4, 0, 5), c_handR: h.HR(0.18, 0.62, -0.24), c_handL: h.HL(0.18, 0.62, 0.24) } }, { t: 0.6, ...back }]);
C.ShieldHit = keys([{ t: 0, use: G, pose: { hips: M(0, -0.08, 0), spine: R(8), head: R(14), c_handR: h.HR(0.22, 1.5, 0.06), c_handL: h.HL(0.24, 1.46, -0.06) } }, { t: 0.06, pose: { hips: M(0, -0.1, -0.06), spine: R(2), head: R(20), c_handR: h.HR(0.14, 1.55, 0.06), c_handL: h.HL(0.16, 1.5, -0.06) } }, { t: 0.3, pose: { hips: M(0, -0.08, 0), spine: R(8), head: R(14), c_handR: h.HR(0.22, 1.5, 0.06), c_handL: h.HL(0.24, 1.46, -0.06) } }]);
C.HitHeavy = keys([{ t: 0, use: G, pose: { hips: M(0, -0.02, -0.14), spine: R(-22), chest: R(-16), head: R(-20, 0, 8), c_handL: h.HL(-0.1, 1.45, 0.45), c_handR: h.HR(-0.1, 1.4, -0.45), c_footR: h.FR(0.22, 0.1) } }, { t: 0.3, pose: { spine: R(-8), chest: R(-4), head: R(-6, 0, 4), c_footR: h.FR(0.1) } }, { t: 0.55, pose: { hips: M(0, -0.1, 0), spine: R(14), chest: R(8), c_handR: h.HR(0.15, 0.7, -0.24), c_handL: h.HL(0.15, 0.7, 0.24) } }, { t: 0.8, ...back }]);
C.Launch = keys([{ t: 0, use: AIR, pose: { spine: R(-20), chest: R(-14), head: R(-12), c_handR: h.HR(-0.25, 1.6, -0.5), c_handL: h.HL(-0.2, 1.65, 0.5), c_footR: h.FR(0.3, 0.3), c_footL: h.FL(0.2, 0.2) } }, { t: 0.25, pose: { spine: R(-6), chest: R(-4) } }, { t: 0.5, use: ['stand', 'tuck'] }]);
C.LaunchUp = keys([{ t: 0, use: AIR, pose: { spine: R(-10), chest: R(-8), head: R(12), c_handR: h.HR(0.0, 0.7, -0.4), c_handL: h.HL(0.0, 0.75, 0.4), c_footR: h.FR(0.0), c_footL: h.FL(0.0) } }, { t: 0.4, pose: { spine: R(8), head: R(-8), c_handR: h.HR(0.1, 1.3, -0.5), c_handL: h.HL(0.1, 1.3, 0.5), c_footR: h.FR(0.15, 0.25) } }, { t: 0.6, use: ['stand', 'tuck'] }]);
C.Spike = keys([{ t: 0, use: AIR, pose: { spine: R(26), chest: R(16), head: R(-30), c_handR: h.HR(-0.1, 1.75, -0.35), c_handL: h.HL(-0.1, 1.8, 0.35), c_footR: h.FR(-0.15), c_footL: h.FL(-0.25, 0.04) } }, { t: 0.4, pose: { spine: R(10), chest: R(4), head: R(-10), c_handR: h.HR(0.1, 1.3, -0.4), c_handL: h.HL(0.1, 1.3, 0.4) } }, { t: 0.6, use: AIR }]);
C.AirDodge = keys([{ t: 0, use: AIR }, { t: 0.12, use: ['stand', 'tuck'], pose: { head: R(16), c_handL: h.HL(0.24, 1.48, 0.06), c_handR: h.HR(0.22, 1.5, -0.06) } }, { t: 0.5, pose: { spine: R(28) } }, { t: 0.66, reset: true, use: AIR }]);   /* curls up behind his forearms */
C.Ball = keys([{ t: 0, use: ['stand', 'tuck'], pose: { head: R(16), c_handL: h.HL(0.24, 0.95, 0.12), c_handR: h.HR(0.24, 0.95, -0.12) } }, { t: 0.3, pose: { spine: R(30) } }, { t: 0.6, pose: { spine: R(24) } }]);
C.Respawn = keys([{ t: 0, use: G, pose: { chest: R(-2), head: R(-4), c_handR: h.HR(0.03, 0.98, -0.21), c_handL: h.HL(0.03, 0.98, 0.21) } }, { t: 0.7, pose: { head: R(10, 0, 0), c_handR: h.HR(0.22, 1.12, -0.12), c_handL: h.HL(0.14, 0.95, 0.1) } }, { t: 1.6, pose: { head: R(-2) , c_handR: h.HR(0.03, 0.9, -0.22), c_handL: h.HL(0.03, 0.9, 0.22) } }, { t: 2.4, ...back }]);   /* tugs his waistband, checks the watch that isn't there */
C.Pummel = keys([{ t: 0, use: G, pose: { chest: R(6), c_handL: h.HL(0.42, 1.12, 0.06), c_handR: h.HR(0.42, 1.12, -0.06) } }, { t: 0.08, pose: { chest: R(3), head: R(-4), c_handR: h.HR(0.3, 1.3, -0.12) } }, { t: 0.16, in: 'snap', pose: { chest: R(8), head: R(2), c_handR: h.HR(0.44, 1.18, -0.08) } }, { t: 0.3, pose: { chest: R(6), head: R(0), c_handR: h.HR(0.42, 1.12, -0.06) } }]);   /* a polite knock on the head */
C.ThrowF = keys([{ t: 0, use: G, pose: { chest: R(6), c_handL: h.HL(0.42, 1.12, 0.06), c_handR: h.HR(0.42, 1.12, -0.06) } }, { t: 0.3, pose: { hips: M(0, -0.06, -0.06), chest: R(-4), c_handL: h.HL(0.25, 1.15, 0.1), c_handR: h.HR(0.25, 1.15, -0.1) } },
  { t: 0.5, in: 'snap', pose: { hips: M(0, -0.06, 0.12), spine: R(12), chest: R(10), c_handL: h.HL(0.58, 1.15, 0.1), c_handR: h.HR(0.58, 1.15, -0.1), c_footR: h.FR(0.2) } }, { t: 0.65, pose: {} }, { t: 1.0, ...back }]);   /* a two-handed push, all his weight behind it */
C.ThrowB = keys([{ t: 0, use: G, pose: { chest: R(6), c_handL: h.HL(0.42, 1.12, 0.06), c_handR: h.HR(0.42, 1.12, -0.06) } }, { t: 0.3, pose: { chest: R(4, 30), c_handR: h.HR(0.4, 1.15, 0.1) } },
  { t: 0.55, in: 'snap', pose: { all: R(0, -60), chest: R(-4, -50), head: R(0, 30), c_handR: h.HR(-0.45, 1.1, -0.3), c_handL: h.HL(-0.2, 1.05, 0.35) } }, { t: 0.7, pose: {} }, { t: 1.05, reset: true, use: G }]);   /* swings them round behind, nearly falls over with it */
C.ThrowD = keys([{ t: 0, use: G, pose: { chest: R(6), c_handL: h.HL(0.42, 1.12, 0.06), c_handR: h.HR(0.42, 1.12, -0.06) } }, { t: 0.35, pose: { hips: M(0, 0.0, 0), c_handL: h.HL(0.36, 1.25, 0.06), c_handR: h.HR(0.36, 1.25, -0.06) } },
  { t: 0.6, in: 'snap', pose: { hips: M(0, -0.3, 0.04), spine: R(28), chest: R(16), head: R(-18), c_handL: h.HL(0.5, 0.35, 0.08), c_handR: h.HR(0.5, 0.35, -0.08) } }, { t: 0.75, pose: {} }, { t: 1.1, ...back }]);   /* pushes them down, then sits on them for a rest */
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
const KS = { hips: M(0, HY, -0.1), spine: R(28), chest: R(22), head: R(-50), footR: R(-55), footL: R(-55), c_handR: b.HR(0.36, 0.13, -0.38), c_handL: b.HL(0.36, 0.13, 0.38), c_footR: b.FR(-0.06, 0, -0.24), c_footL: b.FL(-0.1, 0, 0.24) };
big.poses = {
  stand: { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {} },
  kn: KS,
  air: { hips: M(0, 0, 0), spine: R(14), chest: R(8), head: R(-16), c_handR: b.HR(0.25, 0.75, -0.55), c_handL: b.HL(0.2, 0.8, 0.55), c_footR: b.FR(0.08, 0.18), c_footL: b.FL(-0.08, 0.1) },
  crouch: Object.assign({}, KS, { hips: M(0, HY - 0.08, -0.1), spine: R(36), chest: R(24), head: R(-56) }),
  tuck: { spine: R(26), chest: R(18), c_footL: b.FL(0.18, 0.36), c_footR: b.FR(0.18, 0.36), c_handL: b.HL(0.3, 0.95, 0.36), c_handR: b.HR(0.3, 0.95, -0.36) } };
const GB = ['stand', 'kn'], AB = ['stand', 'air'], backB = { reset: true, use: GB }, backBA = { reset: true, use: AB };
/* the carry: the opponent held overhead in both hands, standing taller, walking on his feet */
const CARRY = { hips: M(0, -0.06, 0), spine: R(4), chest: R(-4), head: R(-6), c_handR: b.HR(0.05, 2.15, -0.18), c_handL: b.HL(0.05, 2.15, 0.18) };
K.Carry = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.6, pose: { hips: M(0, -0.08, 0) } }, { t: 1.2, pose: CARRY }]);
K.CarryWalk = keys([{ t: 0, use: 'stand', pose: Object.assign({}, CARRY, { c_footR: b.FR(0.2), c_footL: b.FL(-0.2, 0.08) }) }, { t: 0.35, pose: { hips: M(0, -0.03, 0), c_footR: b.FR(0), c_footL: b.FL(0, 0.14) } }, { t: 0.7, pose: { hips: M(0, -0.08, 0), c_footR: b.FR(-0.2, 0.08), c_footL: b.FL(0.2) } }, { t: 1.05, pose: { hips: M(0, -0.03, 0), c_footR: b.FR(0, 0.14), c_footL: b.FL(0) } }, { t: 1.4, pose: { hips: M(0, -0.06, 0), c_footR: b.FR(0.2), c_footL: b.FL(-0.2, 0.08) } }]);
/* ---- movement: a heavyweight ape's rhythm. Everything lands with weight: the hips dip on every plant, the shoulders roll
   over the planted arm, the head lags the body and then catches up, and the fists stay put on the floor while the body
   moves over them. Ground clips keep the face looking forward (the head counters the torso), so Joey's face reads. ---- */
const kn = o => Object.assign({}, KS, o);
const HP = (dx, dy, dz) => M(dx || 0, HY + (dy || 0), -0.1 + (dz || 0));
const flipC = [1.2, 0.12];   /* his middle when tucked: height, forward */
const flip = (deg, c) => { c = c || flipC; const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, c[0] - (c[0] * cs - c[1] * sn), c[1] - (c[0] * sn + c[1] * cs)] }; };
/* Idle: two heavy bounces a second and a bit, the weight rocking from one fist to the other, the knuckles drumming. */
K.Idle = keys([
  { t: 0, use: GB, pose: kn({}) },
  { t: 0.3, pose: { hips: HP(0.025, -0.05), spine: R(30), chest: R(25, 5, -4), head: R(-54, -4, 3), c_handL: b.HL(0.36, 0.16, 0.38) } },
  { t: 0.6, pose: { hips: HP(0, 0.012), spine: R(28), chest: R(21, 0, 0), head: R(-49, 0, 0), c_handL: b.HL(0.36, 0.13, 0.38) } },
  { t: 0.9, pose: { hips: HP(-0.025, -0.05), spine: R(30), chest: R(25, -5, 4), head: R(-54, 4, -3), c_handR: b.HR(0.36, 0.16, -0.38) } },
  { t: 1.2, pose: { hips: HP(0, 0), spine: R(28), chest: R(22, 0, 0), head: R(-50, 0, 0), c_handR: b.HR(0.36, 0.13, -0.38) } }]);
/* Idle2, almost bored: lifts a fist to look at his knuckles, rubs them, scratches under the back of the cap, plants again. */
K.Idle2 = keys([{ t: 0, use: GB, pose: kn({}) },
  { t: 0.35, pose: { hips: HP(-0.04, 0.03), chest: R(16, -8), head: R(-40, 10), c_handR: b.HR(0.42, 0.95, -0.12) } },
  { t: 0.8, pose: { head: R(-30, 14), c_handR: b.HR(0.44, 1.0, -0.1), c_handL: b.HL(0.4, 0.13, 0.36) } },
  { t: 1.0, pose: { c_handR: b.HR(0.42, 0.98, -0.06) } }, { t: 1.2, pose: { c_handR: b.HR(0.44, 1.0, -0.12) } },
  { t: 1.6, pose: { chest: R(10, -4), head: R(-34, -6, 6), c_handR: b.HR(-0.05, 1.9, -0.22) } },
  { t: 1.8, pose: { c_handR: b.HR(-0.06, 1.95, -0.16) } }, { t: 2.0, pose: { c_handR: b.HR(-0.05, 1.9, -0.24) } }, { t: 2.2, pose: { c_handR: b.HR(-0.06, 1.95, -0.16) } },
  { t: 2.7, pose: kn({ hips: HP(0, -0.04) }) }, { t: 3.0, pose: kn({}) }]);
/* Knuckle-walk: a diagonal gait (right fist with left foot), each fist rolling forward in an outward arc and landing
   flat on its knuckles; the body travels over the planted fist; a dip of the hips on every plant, two to a stride. */
{ const W = 0.30, F = 0.24, AL = 0.17, FL = 0.12;   /* fist and foot stride either side of rest, and how high they lift */
  const pose = (k, ph) => {   /* k: which diagonal leads (0: right fist / left foot forward); ph 0 plant, 1 passing */
    const s = k ? -1 : 1, plant = ph === 0;
    return { hips: HP(s * 0.035, plant ? -0.045 : 0.02, 0), spine: R(plant ? 30 : 27), chest: R(plant ? 24 : 21, s * 10, -s * 6), head: R(plant ? -53 : -49, -s * 9, s * 4),
      c_handR: plant ? b.HR(0.36 + s * W, 0.13, -0.38) : b.HR(0.36, k ? 0.13 + AL : 0.13, k ? -0.46 : -0.38),
      c_handL: plant ? b.HL(0.36 - s * W, k ? 0.13 : 0.16, 0.38) : b.HL(0.36, k ? 0.13 : 0.13 + AL, k ? 0.38 : 0.46),
      c_footL: plant ? b.FL(-0.1 + s * F, 0, 0.24) : b.FL(-0.1, k ? FL : 0, 0.24),
      c_footR: plant ? b.FR(-0.06 - s * F, 0, -0.24) : b.FR(-0.06, k ? 0 : FL, -0.24),
      footL: R(plant ? -55 + s * 22 : -55), footR: R(plant ? -55 - s * 22 : -55) }; };   /* the trailing foot's toes stay on the floor */
  K.Walk = keys([{ t: 0, use: GB, pose: pose(0, 0) }, { t: 0.27, pose: pose(1, 1) }, { t: 0.5, pose: pose(1, 0) }, { t: 0.77, pose: pose(0, 1) }, { t: 1.0, pose: pose(0, 0) }]); }
/* The run is a gallop: both fists reach and land, the body vaults over them, both feet swing through and land ahead of
   where the fists were, then drive him forward into the next reach. Hips rise in the flight and sink on the feet. */
{ const reach = { hips: HP(0, 0.2, 0.12), spine: R(42), chest: R(18), head: R(-62), c_handR: b.HR(1.0, 0.32, -0.36), c_handL: b.HL(0.92, 0.38, 0.4), c_footR: b.FR(-0.6, 0.34, -0.26), c_footL: b.FL(-0.52, 0.42, 0.26) };
  const hands = { hips: HP(0, 0.06, 0.08), spine: R(40), chest: R(22), head: R(-62), c_handR: b.HR(0.78, 0.13, -0.36), c_handL: b.HL(0.7, 0.13, 0.4), c_footR: b.FR(-0.45, 0.3, -0.26), c_footL: b.FL(-0.38, 0.22, 0.26) };
  const vault = { hips: HP(0, 0.0, 0.02), spine: R(34), chest: R(22), head: R(-56), c_handR: b.HR(0.26, 0.13, -0.36), c_handL: b.HL(0.18, 0.13, 0.4), c_footR: b.FR(0.18, 0.2, -0.34), c_footL: b.FL(0.1, 0.16, 0.34) };
  const feet = { hips: HP(0, -0.07, -0.02), spine: R(27), chest: R(20), head: R(-50), c_handR: b.HR(-0.02, 0.32, -0.38), c_handL: b.HL(0.05, 0.26, 0.42), c_footR: b.FR(0.42, 0, -0.3), c_footL: b.FL(0.34, 0, 0.3) };
  const push = { hips: HP(0, 0.1, 0.1), spine: R(36), chest: R(18), head: R(-58), c_handR: b.HR(0.6, 0.5, -0.36), c_handL: b.HL(0.52, 0.56, 0.4), c_footR: b.FR(0.0, 0.02, -0.28), c_footL: b.FL(-0.06, 0, 0.28) };
  K.Run = keys([{ t: 0, use: GB, pose: reach }, { t: 0.08, pose: hands }, { t: 0.2, pose: vault }, { t: 0.28, pose: feet }, { t: 0.4, pose: push }, { t: 0.5, pose: reach }]);
  /* Skid (the brake after a run): fists jammed into the floor ahead, feet sliding up under him, leaning back on it */
  K.Skid = keys([{ t: 0, use: GB, pose: feet }, { t: 0.08, pose: { hips: HP(0, 0.02, -0.08), spine: R(22), chest: R(14), head: R(-38), c_handR: b.HR(0.85, 0.13, -0.4), c_handL: b.HL(0.8, 0.13, 0.42), c_footR: b.FR(0.12, 0, -0.26), c_footL: b.FL(0.06, 0, 0.26) } },
    { t: 0.24, pose: { hips: HP(0, -0.06, -0.08), spine: R(24), chest: R(18), head: R(-44), c_handR: b.HR(0.6, 0.13, -0.4), c_handL: b.HL(0.56, 0.13, 0.4) } }, { t: 0.4, reset: true, use: GB, pose: kn({}) }]); }
K.Crouch = keys([{ t: 0, use: GB, pose: kn({}) }, { t: 0.15, pose: kn({ hips: HP(0, -0.13, -0.06), spine: R(40), chest: R(26), head: R(-62), c_handR: b.HR(0.46, 0.13, -0.44), c_handL: b.HL(0.46, 0.13, 0.44), c_footR: b.FR(-0.1, 0, -0.28), c_footL: b.FL(-0.14, 0, 0.28) }) }]);
K.Squat = keys([{ t: 0, use: GB, pose: kn({}) }, { t: 0.1, pose: kn({ hips: HP(0, -0.1, 0.02), spine: R(36), chest: R(24), head: R(-58), c_handR: b.HR(0.3, 0.13, -0.42), c_handL: b.HL(0.3, 0.13, 0.42) }) }]);
/* The jump: he throws himself up off fists and feet, body straightening, both arms flung up; by the top the arms have
   opened out wide and the knees come up. */
const AIRB = { hips: M(0, 0, 0), spine: R(14), chest: R(6), head: R(-18), c_handR: b.HR(0.22, 1.5, -0.78), c_handL: b.HL(0.18, 1.55, 0.78), c_footR: b.FR(0.12, 0.2), c_footL: b.FL(-0.06, 0.1) };
K.Rise = keys([{ t: 0, use: 'stand', pose: { hips: M(0, -0.04, 0), spine: R(6), chest: R(-2), head: R(-6), c_handR: b.HR(0.2, 2.2, -0.36), c_handL: b.HL(0.16, 2.25, 0.36), c_footR: b.FR(-0.12, 0.02), c_footL: b.FL(-0.2, 0.04) } },
  { t: 0.2, pose: { spine: R(10), chest: R(2), head: R(-12), c_handR: b.HR(0.22, 1.9, -0.64), c_handL: b.HL(0.18, 1.95, 0.64), c_footR: b.FR(0.04, 0.12), c_footL: b.FL(-0.1, 0.06) } },
  { t: 0.45, pose: AIRB }]);
/* Falling: arms up and out, paddling slowly, legs hanging apart, one foot then the other drifting forward. */
K.Fall = keys([{ t: 0, use: 'stand', pose: AIRB }, { t: 0.4, pose: { chest: R(8, 4), c_handR: b.HR(0.26, 1.72, -0.7), c_handL: b.HL(0.14, 1.45, 0.82), c_footR: b.FR(0.02, 0.14), c_footL: b.FL(0.08, 0.18) } },
  { t: 0.8, pose: { chest: R(8, -4), c_handR: b.HR(0.16, 1.45, -0.82), c_handL: b.HL(0.24, 1.72, 0.7), c_footR: b.FR(0.14, 0.22), c_footL: b.FL(-0.08, 0.1) } }, { t: 1.2, pose: AIRB }]);
K.FastFall = keys([{ t: 0, use: 'stand', pose: { hips: M(0, 0, 0), spine: R(4), chest: R(0), head: R(-4), c_handR: b.HR(0.1, 2.25, -0.3), c_handL: b.HL(0.1, 2.25, 0.3), c_footR: b.FR(0.0, 0.02), c_footL: b.FL(-0.04, 0.04) } },
  { t: 0.2, pose: { c_handR: b.HR(0.1, 2.28, -0.34), c_handL: b.HL(0.1, 2.22, 0.27) } }, { t: 0.4, pose: { c_handR: b.HR(0.1, 2.25, -0.3), c_handL: b.HL(0.1, 2.25, 0.3) } }]);
/* Helpless (after the spinning recovery): spent, arms windmilling, legs kicking. */
K.Helpless = keys([{ t: 0, use: 'stand', pose: Object.assign({}, AIRB, { head: R(-10, 0, 8) }) }, { t: 0.2, pose: { c_handR: b.HR(-0.2, 1.9, -0.6), c_handL: b.HL(0.5, 1.2, 0.7), c_footR: b.FR(0.2, 0.3), c_footL: b.FL(-0.1, 0.05) } },
  { t: 0.4, pose: { c_handR: b.HR(0.5, 1.2, -0.7), c_handL: b.HL(-0.2, 1.9, 0.6), c_footR: b.FR(-0.1, 0.05), c_footL: b.FL(0.2, 0.3) } }, { t: 0.6, pose: Object.assign({}, AIRB, { head: R(-10, 0, -8) }) }]);
/* The air jump: a tucked forward somersault round his middle, arms hugging the shins, opening out at the end. */
const TUCKB = { hips: M(0, 0.05, 0), spine: R(30), chest: R(22), head: R(-10), c_footL: b.FL(0.3, 0.55), c_footR: b.FR(0.3, 0.55), c_handL: b.HL(0.45, 0.85, 0.34), c_handR: b.HR(0.45, 0.85, -0.34) };
K.AirJump = keys([{ t: 0, use: 'stand', pose: Object.assign({}, TUCKB, { all: flip(0) }) }, { t: 0.12, pose: { all: flip(110) } }, { t: 0.24, pose: { all: flip(230) } }, { t: 0.36, pose: { all: flip(330) } },
  { t: 0.48, reset: true, use: 'stand', pose: Object.assign({}, AIRB, { all: flip(360) }) }, { t: 0.6, reset: true, use: 'stand', pose: AIRB }]);
/* Landing: the fists slam the floor a beat after the feet, the hips sink and spring back. A hard landing goes deeper. */
K.Land = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.1, 0), c_handR: b.HR(0.4, 0.5, -0.5), c_handL: b.HL(0.4, 0.5, 0.5) }) }, { t: 0.08, pose: kn({ hips: HP(0, -0.12, 0.02), spine: R(36), chest: R(26), head: R(-60), c_handR: b.HR(0.4, 0.13, -0.44), c_handL: b.HL(0.4, 0.13, 0.44) }) },
  { t: 0.22, pose: kn({ hips: HP(0, 0.02, 0) }) }, { t: 0.4, pose: kn({}) }]);
K.LandHard = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.1, 0), c_handR: b.HR(0.4, 0.6, -0.55), c_handL: b.HL(0.4, 0.6, 0.55) }) }, { t: 0.1, pose: kn({ hips: HP(0, -0.2, 0.04), spine: R(44), chest: R(28), head: R(-62, 0, 0), c_handR: b.HR(0.5, 0.13, -0.5), c_handL: b.HL(0.5, 0.13, 0.5), c_footR: b.FR(-0.1, 0, -0.3), c_footL: b.FL(-0.14, 0, 0.3) }) },
  { t: 0.3, pose: { head: R(-56, 6, 6) } }, { t: 0.5, pose: kn({ hips: HP(0, 0.02, 0) }) }, { t: 0.65, pose: kn({}) }]);
K.Shield = keys([{ t: 0, use: GB, pose: kn({}) }, { t: 0.12, pose: kn({ hips: HP(0, -0.06, -0.12), spine: R(36), chest: R(20), head: R(-56), c_handR: b.HR(0.42, 0.75, -0.14), c_handL: b.HL(0.44, 0.8, 0.12) }) }]);   /* hunched behind both forearms */
K.ShieldHit = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, -0.06, -0.12), spine: R(36), chest: R(20), head: R(-56), c_handR: b.HR(0.42, 0.75, -0.14), c_handL: b.HL(0.44, 0.8, 0.12) }) },
  { t: 0.06, pose: { hips: HP(0, -0.08, -0.2), spine: R(30), head: R(-48), c_handR: b.HR(0.32, 0.8, -0.14), c_handL: b.HL(0.34, 0.85, 0.12) } }, { t: 0.3, pose: { hips: HP(0, -0.06, -0.12), spine: R(36), head: R(-56), c_handR: b.HR(0.42, 0.75, -0.14), c_handL: b.HL(0.44, 0.8, 0.12) } }]);
/* Hit: knocked back off his fists; a heavy hit throws the torso up and back and he has to catch himself. */
K.Hit = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.12, -0.2), spine: R(10), chest: R(-4), head: R(-24, 0, 6), c_handR: b.HR(0.15, 0.75, -0.62), c_handL: b.HL(0.1, 0.8, 0.62) }) }, { t: 0.25, pose: { spine: R(18), chest: R(8), head: R(-36) } }, { t: 0.6, ...backB }]);
K.HitHeavy = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.22, -0.3), spine: R(-4), chest: R(-14), head: R(-6, 0, 10), c_handR: b.HR(-0.05, 1.15, -0.7), c_handL: b.HL(-0.1, 1.2, 0.72), c_footR: b.FR(0.15, 0.1, -0.26) }) },
  { t: 0.3, pose: { spine: R(8), chest: R(0), head: R(-20, 0, 6) } }, { t: 0.55, pose: kn({ hips: HP(0, -0.06, -0.1), c_handR: b.HR(0.3, 0.13, -0.44), c_handL: b.HL(0.3, 0.13, 0.44) }) }, { t: 0.8, ...backB }]);
const SPRAWL = { hips: M(0, 0, 0), spine: R(-14), chest: R(-12), head: R(-4), c_handR: b.HR(-0.3, 1.7, -0.75), c_handL: b.HL(-0.25, 1.75, 0.75), c_footR: b.FR(0.35, 0.35), c_footL: b.FL(0.25, 0.25) };
K.Launch = keys([{ t: 0, use: 'stand', pose: SPRAWL }, { t: 0.25, pose: { spine: R(-4), chest: R(-4), c_handR: b.HR(0.1, 1.5, -0.8), c_handL: b.HL(-0.1, 1.6, 0.8) } }, { t: 0.5, use: ['stand', 'tuck'] }]);
K.LaunchUp = keys([{ t: 0, use: 'stand', pose: { hips: M(0, 0, 0), spine: R(-10), chest: R(-6), head: R(10), c_handR: b.HR(0.0, 0.7, -0.6), c_handL: b.HL(0.0, 0.75, 0.6), c_footR: b.FR(0.0, 0.0), c_footL: b.FL(0.0, 0.0) } }, { t: 0.4, pose: { spine: R(10), chest: R(6), head: R(-10), c_handR: b.HR(0.2, 1.3, -0.75), c_handL: b.HL(0.2, 1.3, 0.75), c_footR: b.FR(0.15, 0.25), c_footL: b.FL(0.0, 0.15) } }, { t: 0.6, use: ['stand', 'tuck'] }]);
K.Spike = keys([{ t: 0, use: 'stand', pose: { hips: M(0, 0, 0), spine: R(30), chest: R(20), head: R(-50), c_handR: b.HR(-0.2, 1.9, -0.5), c_handL: b.HL(-0.2, 1.95, 0.5), c_footR: b.FR(-0.2, 0.0), c_footL: b.FL(-0.3, 0.05) } }, { t: 0.4, pose: { spine: R(16), chest: R(8), head: R(-24), c_handR: b.HR(0.1, 1.7, -0.7), c_handL: b.HL(0.1, 1.7, 0.7) } }, { t: 0.6, pose: AIRB }]);
K.Tumble = keys([{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(32), chest: R(22), c_handR: b.HR(0.45, 1.2, -0.5), c_handL: b.HL(0.25, 0.9, 0.4) } }, { t: 0.6, pose: { spine: R(26), chest: R(18), c_handR: b.HR(0.3, 0.95, -0.36), c_handL: b.HL(0.3, 0.95, 0.36) } }]);
K.Down = keys([{ t: 0, use: 'stand', pose: { all: R(-50) } }, { t: 0.3, pose: { all: { rot: [-90, 0, 0], move: [0, 0.3, 0.95] }, head: R(20), c_handL: b.HL(-0.1, 1.0, 0.7), c_handR: b.HR(0.1, 0.95, -0.7) } }]);
/* Dodges: a spot dodge rocks him back off his fists; the air dodge curls him up behind his forearms; the roll is a tucked
   ball (the game turns it). */
K.Dodge = keys([{ t: 0, use: GB, pose: kn({}) }, { t: 0.14, pose: kn({ all: R(0, 25), hips: HP(0, -0.02, -0.26), spine: R(20), chest: R(10), head: R(-40), c_handR: b.HR(0.15, 0.6, -0.3), c_handL: b.HL(0.15, 0.65, 0.3) }) }, { t: 0.32, pose: { all: R(0, 15) } }, { t: 0.45, ...backB }]);
K.AirDodge = keys([{ t: 0, use: 'stand', pose: AIRB }, { t: 0.12, pose: Object.assign({}, TUCKB, { head: R(10), c_handL: b.HL(0.32, 1.6, 0.12), c_handR: b.HR(0.3, 1.55, -0.12) }) }, { t: 0.5, pose: { spine: R(26) } }, { t: 0.66, pose: AIRB }]);
K.Ball = keys([{ t: 0, use: ['stand', 'tuck'], pose: { head: R(14), c_handL: b.HL(0.3, 0.8, 0.3), c_handR: b.HR(0.3, 0.8, -0.3) } }, { t: 0.3, pose: { spine: R(32) } }, { t: 0.6, pose: { spine: R(26) } }]);
K.Ledge = keys([{ t: 0, use: 'stand', pose: { head: R(-12), c_handL: b.HL(0.3, 2.0, 0.25), c_handR: b.HR(0.3, 2.0, -0.25), c_footL: b.FL(0.1, 0.12), c_footR: b.FR(-0.05) } }, { t: 0.8, pose: { head: R(-8, 6), c_footL: b.FL(0.0, 0.04), c_footR: b.FR(0.08, 0.1) } }, { t: 1.6, pose: { head: R(-12), c_footL: b.FL(0.1, 0.12), c_footR: b.FR(-0.05) } }]);
/* Respawn: on the platform, arms folded, the same unimpressed face. */
K.Respawn = keys([{ t: 0, use: 'stand', pose: { hips: M(0, -0.08, 0), spine: R(6), chest: R(-4), head: R(-4), c_handR: b.HR(0.42, 1.25, 0.12), c_handL: b.HL(0.4, 1.3, -0.12) } }, { t: 0.8, pose: { chest: R(-6), head: R(-2, 8) } }, { t: 1.6, pose: { chest: R(-4), head: R(-4, -6) } }, { t: 2.4, pose: { chest: R(-4), head: R(-4) } }]);
K.Hold = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.14, 0), spine: R(14), chest: R(6), head: R(-24), c_handR: b.HR(0.65, 0.95, -0.25), c_handL: b.HL(0.4, 0.13, 0.38) }) }, { t: 0.4, pose: { c_handR: b.HR(0.66, 0.97, -0.25) } }, { t: 0.8, pose: { c_handR: b.HR(0.65, 0.95, -0.25) } }]);
/* Pummel: squeezes the held opponent, the whole arm and shoulder clenching. */
K.Pummel = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, 0.14, 0), spine: R(14), chest: R(6), head: R(-24), c_handR: b.HR(0.65, 0.95, -0.25), c_handL: b.HL(0.4, 0.13, 0.38) }) },
  { t: 0.08, pose: { hips: HP(0, 0.1, -0.04), spine: R(18), chest: R(10, 8, 4), head: R(-30), c_handR: b.HR(0.55, 0.9, -0.2) } }, { t: 0.23, pose: { hips: HP(0, 0.14, 0), spine: R(14), chest: R(6), head: R(-24), c_handR: b.HR(0.65, 0.95, -0.25) } }]);
/* Throws. The ordinary ones start from the one-handed hold; the carry throws from the opponent held overhead. */
const HOLDK = kn({ hips: HP(0, 0.14, 0), spine: R(14), chest: R(6), head: R(-24), c_handR: b.HR(0.65, 0.95, -0.25), c_handL: b.HL(0.4, 0.13, 0.38) });
K.ThrowB = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.2, pose: { chest: R(8, 30), c_handR: b.HR(0.75, 1.05, -0.1) } },
  { t: 0.42, in: 'snap', pose: { hips: HP(0, 0.18, -0.06), spine: R(6), chest: R(-6, -70, -10), head: R(-12, 40), c_handR: b.HR(-0.7, 1.35, -0.55), c_handL: b.HL(0.3, 0.6, 0.6) } },
  { t: 0.55, pose: { chest: R(-2, -78, -8), c_handR: b.HR(-0.8, 1.2, -0.4) } }, { t: 0.9, ...backB }]);
K.ThrowU = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.22, pose: { hips: HP(0, 0.02, 0), spine: R(26), head: R(-44), c_handR: b.HR(0.5, 0.55, -0.2), c_handL: b.HL(0.45, 0.55, 0.2) } },
  { t: 0.42, in: 'snap', pose: { hips: M(0, -0.08, 0), spine: R(-2), chest: R(-8), head: R(-2), c_handR: b.HR(0.2, 2.35, -0.18), c_handL: b.HL(0.2, 2.35, 0.18), c_footR: b.FR(-0.06, 0, -0.26), c_footL: b.FL(-0.1, 0, 0.26) } },
  { t: 0.55, pose: { c_handR: b.HR(0.22, 2.4, -0.22), c_handL: b.HL(0.22, 2.4, 0.22) } }, { t: 0.95, ...backB }]);
K.ThrowD = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.25, pose: { hips: M(0, -0.1, -0.05), spine: R(2), chest: R(-8), head: R(-6), c_handR: b.HR(0.2, 2.2, -0.2), c_handL: b.HL(0.2, 2.2, 0.2) } },
  { t: 0.42, in: 'snap', pose: kn({ hips: HP(0, -0.08, 0.1), spine: R(44), chest: R(26), head: R(-60), c_handR: b.HR(0.85, 0.15, -0.2), c_handL: b.HL(0.85, 0.15, 0.2) }) },
  { t: 0.55, pose: { hips: HP(0, -0.1, 0.1) } }, { t: 0.95, ...backB }]);
K.ThrowCB = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.2, pose: { spine: R(14), head: R(-14), c_handR: b.HR(0.35, 2.05, -0.2), c_handL: b.HL(0.35, 2.05, 0.2) } },
  { t: 0.42, in: 'snap', pose: { spine: R(-22), chest: R(-18), head: R(4), c_handR: b.HR(-0.7, 1.9, -0.2), c_handL: b.HL(-0.7, 1.9, 0.2) } }, { t: 0.55, pose: {} }, { t: 0.95, ...backB }]);
K.ThrowCU = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.2, pose: { hips: M(0, -0.18, 0), c_handR: b.HR(0.05, 1.85, -0.2), c_handL: b.HL(0.05, 1.85, 0.2) } },
  { t: 0.42, in: 'snap', pose: { hips: M(0, 0.02, 0), head: R(-24), c_handR: b.HR(0.08, 2.45, -0.16), c_handL: b.HL(0.08, 2.45, 0.16), c_footR: b.FR(0.0, 0.06), c_footL: b.FL(-0.04, 0.06) } }, { t: 0.55, pose: {} }, { t: 0.95, ...backB }]);
K.ThrowCD = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.2, pose: { hips: M(0, -0.02, 0), chest: R(-10), c_handR: b.HR(-0.1, 2.25, -0.18), c_handL: b.HL(-0.1, 2.25, 0.18) } },
  { t: 0.42, in: 'snap', pose: kn({ hips: HP(0, -0.06, 0.12), spine: R(44), chest: R(26), head: R(-60), c_handR: b.HR(0.85, 0.15, -0.2), c_handL: b.HL(0.85, 0.15, 0.2) }) }, { t: 0.55, pose: {} }, { t: 0.95, ...backB }]);
K.Held = keys([{ t: 0, use: AB, pose: { head: R(-10), c_handL: b.HL(0.15, 1.4, 0.5), c_handR: b.HR(0.15, 1.4, -0.5) } }, { t: 0.3, pose: { c_footL: b.FL(0.1, 0.2) } }, { t: 0.6, pose: { c_footL: b.FL(-0.05, 0.08) } }]);
K.Buried = keys([{ t: 0, use: 'stand', pose: { c_handR: b.HR(0.2, 1.3, -0.6), c_handL: b.HL(0.2, 1.3, 0.6) } }, { t: 0.2, pose: { c_handR: b.HR(0.2, 1.4, -0.66), c_handL: b.HL(0.2, 1.2, 0.6) } }, { t: 0.4, pose: { c_handR: b.HR(0.2, 1.3, -0.6), c_handL: b.HL(0.2, 1.3, 0.6) } }]);
/* ---- attacks: the reference fighter's motions with this body (keys at 30 fps; contact = the hit's first frame) ---- */
const SW = (dz, drop) => ({ hips: M(0, HY + 0.12 - (drop || 0), -0.1 + dz) });   /* attacks rise a little out of the squat */
/* Jab 1, keyed against the reference (hitbox frames 5-6 of 24): shoulder turns back with the fist cocked at the chest and the
   other fist up by his face, a straight punch at chest height, then the fist snaps back into a guard (no lingering arm). */
K.Check = keys([{ t: 0, use: GB },
  { t: 3 / 30, pose: { hips: HP(0, 0.1, -0.06), spine: R(18), chest: R(8, 24), head: R(-36, -12), c_handR: b.HR(-0.05, 1.12, -0.42), c_handL: b.HL(0.05, 1.2, 0.36), c_footL: b.FL(-0.1, 0, 0.26) } },
  { t: 0.17, in: 'snap', pose: Object.assign(SW(0.14), { spine: R(26), chest: R(10, -24), head: R(-46, 12), c_handR: b.HR(1.1, 1.18, -0.1), c_handL: b.HL(-0.25, 1.2, 0.38), c_footR: b.FR(0.14, 0, -0.26), c_footL: b.FL(-0.1, 0, 0.26) }) },
  { t: 0.2, pose: { c_handR: b.HR(1.13, 1.16, -0.1) } },
  { t: 9 / 30, in: 'out', pose: { hips: HP(0, 0.1, 0.02), chest: R(10, -6), head: R(-40, 4), c_handR: b.HR(0.36, 1.0, -0.32), c_handL: b.HL(0.12, 1.05, 0.36) } },
  { t: 16 / 30, pose: { hips: HP(0, 0.08, 0), chest: R(12, 0), head: R(-42), c_handR: b.HR(0.36, 0.95, -0.34), c_handL: b.HL(0.18, 0.98, 0.38) } },
  { t: 0.8, in: 'quad', ...backB }]);
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

/* =====================================================================================================================
   The owner's A-pose models (2026-11-11, latest): "Red Cap Stance" (Joey, an ordinary man) and "Red Cap Titan" (Cronky
   Dong), both standing straight with the arms out and the hands open, so they rig cleanly and the hands can open and
   close (finger bones: the four fingers move together, the thumb on its own). Prepared by tools/blender/titan-prep.py,
   skin given a farmer's tan by tools/blender/farmtan.py.
   The clips above were written for upright generated bodies of the same height, so they carry over: the hand and foot
   targets are re-placed for these bodies' longer arms and wider stance (retarget below), rotations are kept. Cronky
   Dong's moves were then checked against the owner's animation atlas (Donkey Kong in Super Smash Bros. Ultimate as the
   motion reference; original poses) and the ones that read differently are remade here, before the retarget.
   ===================================================================================================================== */
function apose(T, extra) {
  if (extra) return aposeX(T);
  const side = (s, k) => [
    { name: 'arm' + s, head: T.sho[k], tail: T.elb[k], parent: 'chest' },
    { name: 'fore' + s, head: T.elb[k], tail: T.wri[k], parent: 'arm' + s, connect: true },
    { name: 'hand' + s, head: T.wri[k], tail: T.knu[k], parent: 'fore' + s, connect: true },
    { name: 'fing' + s + '1', head: T.knu[k], tail: T.mid[k], parent: 'hand' + s, connect: true },
    { name: 'fing' + s + '2', head: T.mid[k], tail: T.tip[k], parent: 'fing' + s + '1', connect: true },
    { name: 'thumb' + s, head: T.thb[k], tail: T.tht[k], parent: 'hand' + s },
    { name: 'c_hand' + s, head: T.wri[k], tail: add(T.wri[k], [0, 0, 0.12]), parent: 'all', deform: false },
    { name: 'thigh' + s, head: T.hip[k], tail: T.knee[k], parent: 'hips' },
    { name: 'shin' + s, head: T.knee[k], tail: T.ankle[k], parent: 'thigh' + s, connect: true },
    { name: 'foot' + s, head: T.ankle[k], tail: T.toe[k], parent: 'shin' + s },
    { name: 'c_foot' + s, head: T.ankle[k], tail: add(T.ankle[k], [0, 0, 0.12]), parent: 'all', deform: false }];
  return { note: T.note, prep: { yaw: 0, translate: [0, 0, 0] },
    bones: [
      { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
      { name: 'hips', head: T.pelvis, tail: T.waist, parent: 'all' },
      { name: 'spine', head: T.waist, tail: T.ribs, parent: 'hips', connect: true },
      { name: 'chest', head: T.ribs, tail: T.neck, parent: 'spine', connect: true },
      { name: 'head', head: T.neck, tail: T.top, parent: 'chest' },
      ...side('R', 0), ...side('L', 1)],
    ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
    rigid: [{ bone: 'head', box: T.headBox }], poses: {}, clips: {} };
}
const lerp = (a, b, u) => a + (b - a) * u, sm = x => x * x * (3 - 2 * x);
/* Cronky Dong's fuller skeleton (2026-11-11, the owner's pick): collarbones, so the shoulders shrug, roll forward into a
   reach and pull back behind; a second spine bone and a neck, so the back curves instead of folding in two places and the
   head bends on its neck; twist helpers in the upper arms and forearms, so a turning wrist or a swinging arm doesn't pinch
   the skin; and toes, so the feet roll as he pushes off and lands. The clips still say spine / head / hands / feet as
   before: rig.py spreads a spine turn over both spine bones and a head turn over neck and head ("share"), turns each
   collarbone part of the way toward where its hand reaches ("clavicles"), bends the toes when the ball of the foot is on
   the floor ("toes"), and the twist helpers follow by constraint. */
function aposeX(T) {
  const L = (a, c, u) => a.map((v, i) => v + (c[i] - v) * u);
  const mid = L(T.waist, T.ribs, 0.5), ctop = L(T.ribs, T.neck, 0.62);
  const side = (s, k) => { const sg = k ? 1 : -1, sho = T.sho[k];
    const clav = [sg * 0.07, ctop[1] - 0.02, sho[2] + 0.07];   /* the inner end of the collarbone, by the top of the breastbone */
    const ball = [T.toe[k][0], Math.max(0.03, T.toe[k][1] + 0.01), lerp(T.ankle[k][2], T.toe[k][2], 0.6)];
    return [
      { name: 'clav' + s, head: clav, tail: sho, parent: 'chest' },
      { name: 'arm' + s, head: sho, tail: T.elb[k], parent: 'clav' + s },
      { name: 'armTw' + s, head: sho, tail: L(sho, T.elb[k], 0.5), parent: 'clav' + s },
      { name: 'fore' + s, head: T.elb[k], tail: T.wri[k], parent: 'arm' + s, connect: true },
      { name: 'foreTw' + s, head: L(T.elb[k], T.wri[k], 0.5), tail: T.wri[k], parent: 'fore' + s },
      { name: 'hand' + s, head: T.wri[k], tail: T.knu[k], parent: 'fore' + s, connect: true },
      { name: 'fing' + s + '1', head: T.knu[k], tail: T.mid[k], parent: 'hand' + s, connect: true },
      { name: 'fing' + s + '2', head: T.mid[k], tail: T.tip[k], parent: 'fing' + s + '1', connect: true },
      { name: 'thumb' + s, head: T.thb[k], tail: T.tht[k], parent: 'hand' + s },
      { name: 'c_hand' + s, head: T.wri[k], tail: add(T.wri[k], [0, 0, 0.12]), parent: 'all', deform: false },
      { name: 'thigh' + s, head: T.hip[k], tail: T.knee[k], parent: 'hips' },
      { name: 'shin' + s, head: T.knee[k], tail: T.ankle[k], parent: 'thigh' + s, connect: true },
      { name: 'foot' + s, head: T.ankle[k], tail: ball, parent: 'shin' + s },
      { name: 'toe' + s, head: ball, tail: T.toe[k], parent: 'foot' + s, connect: true },
      { name: 'c_foot' + s, head: T.ankle[k], tail: add(T.ankle[k], [0, 0, 0.12]), parent: 'all', deform: false }]; };
  const S = ['R', 'L'];
  return { note: T.note, prep: { yaw: 0, translate: [0, 0, 0] },
    bones: [
      { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
      { name: 'hips', head: T.pelvis, tail: T.waist, parent: 'all' },
      { name: 'spine', head: T.waist, tail: mid, parent: 'hips', connect: true },
      { name: 'spine2', head: mid, tail: T.ribs, parent: 'spine', connect: true },
      { name: 'chest', head: T.ribs, tail: ctop, parent: 'spine2', connect: true },
      { name: 'neck', head: ctop, tail: T.neck, parent: 'chest', connect: true },
      { name: 'head', head: T.neck, tail: T.top, parent: 'neck', connect: true },
      ...side('R', 0), ...side('L', 1)],
    ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
    share: { spine: [['spine', 0.5], ['spine2', 0.5]], head: [['neck', 0.4], ['head', 0.6]] },
    clavicles: S.map((s, k) => ({ bone: 'clav' + s, target: 'c_hand' + s, rest: T.wri[k], k: 0.4, max: 30 })),
    toes: S.map(s => ({ bone: 'toe' + s, foot: 'foot' + s, floor: 0.015, near: 0.07 })),
    /* the forward smash's clap: palms pressed flat together from the strike until the hands part (bone lines 0.065 apart:
       measured on the rendered clap: closer and the hands pass into each other) */
    meet: { ClapCap: { at: [0.73, 1.4], fade: 0.2, gap: 0.065, hands: ['handR', 'handL'], targets: ['c_handR', 'c_handL'] } },
    track: S.map(s => ({ bone: 'armTw' + s, target: 'arm' + s, headtail: 1 })),
    copyrot: S.map(s => ({ bone: 'foreTw' + s, from: 'hand' + s, space: 'LOCAL', axes: 'Y', influence: 0.5 })),
    rigid: [{ bone: 'head', box: T.headBox }], poses: {}, clips: {} };
}
/* both sides from the right side's points (the models are near enough symmetric) */
const both = o => { const T = {}; for (const [k, v] of Object.entries(o)) T[k] = Array.isArray(v) && Array.isArray(v[0]) && k !== 'headBox' ? [v[0], mir(v[0])] : v; return T; };
/* Joint places read off gridded views and the hand's own vertices (tools/blender/gridview.py). knu: the knuckles,
   mid: the middle of the fingers, tip: the fingertips, thb/tht: the thumb's root and tip. */
const THA = both({ note: 'Joey (human form): the owner\'s A-pose model. Metres, feet on y = 0, facing +Z, his right is -X.',
  pelvis: [0, 0.95, -0.02], waist: [0, 1.1, -0.02], ribs: [0, 1.3, -0.02], neck: [0, 1.56, -0.02], top: [0, 1.9, 0],
  sho: [[-0.19, 1.47, -0.05]], elb: [[-0.4, 1.2, -0.07]], wri: [[-0.55, 0.97, 0.04]], knu: [[-0.59, 0.885, 0.07]], mid: [[-0.605, 0.84, 0.08]], tip: [[-0.616, 0.795, 0.095]],
  thb: [[-0.54, 0.95, 0.07]], tht: [[-0.525, 0.905, 0.155]],
  hip: [[-0.1, 0.92, -0.02]], knee: [[-0.17, 0.5, 0.01]], ankle: [[-0.21, 0.08, -0.08]], toe: [[-0.24, 0.02, 0.12]],
  headBox: [[-0.12, 1.6, -0.15], [0.12, 1.93, 0.2]] });
const TBA = both({ note: 'Cronky Dong: the owner\'s A-pose model. Metres, feet on y = 0, facing +Z, his right is -X.',
  pelvis: [0, 0.92, -0.12], waist: [0, 1.08, -0.12], ribs: [0, 1.3, -0.1], neck: [0, 1.6, -0.08], top: [0, 1.9, -0.06],
  sho: [[-0.42, 1.44, -0.11]], elb: [[-0.59, 1.13, -0.03]], wri: [[-0.72, 0.83, 0.12]], knu: [[-0.82, 0.65, 0.24]], mid: [[-0.845, 0.575, 0.275]], tip: [[-0.835, 0.51, 0.29]],
  thb: [[-0.68, 0.79, 0.15]], tht: [[-0.62, 0.66, 0.3]],
  hip: [[-0.17, 0.86, -0.14]], knee: [[-0.23, 0.37, -0.05]], ankle: [[-0.29, 0.08, -0.17]], toe: [[-0.33, 0.02, 0.06]],
  headBox: [[-0.13, 1.64, -0.26], [0.13, 1.95, 0.14]] });
/* (the knee sits a little ahead of the line from hip to ankle, so it bends forward over the foot, not out to the side) */
/* his legs are shortened in the preparation (titan-prep.py --legs 0.1,0.72,0.7): every joint height follows */
{ const y0 = 0.1, y1 = 0.72, s = 0.7, sq = y => y <= y0 ? y : y <= y1 ? y0 + (y - y0) * s : y - (y1 - y0) * (1 - s);
  for (const [k, v] of Object.entries(TBA)) if (Array.isArray(v)) for (const p of (Array.isArray(v[0]) ? v : [v])) p[1] = +sq(p[1]).toFixed(4); }
/* re-place an old clip's hand and foot targets on a new body. A hand target below the shoulder keeps its height (plus
   `lift` near the floor: a bigger fist stands taller on its knuckles), above it scales with the arm; sideways, reach out
   to the old shoulder's width becomes the new shoulder's width, past it scales with the arm; forward scales with the arm.
   Feet keep their stride (scaled with the leg) from the new hips' width. The hips' move scales with the leg. */
function retarget(old, J, T, o) {
  const s = apose(T, o.extra), k = o.arm, kl = o.leg, ox = Math.abs(J.sho[0][0]), nx = Math.abs(T.sho[0][0]);
  const hand = (i, mv) => { const sd = i ? 1 : -1, a = add(J.wri[i], mv || [0, 0, 0]), u = a[0] * sd;
    const x = sd * (u <= 0 ? u : u < ox ? u * nx / ox : nx + (u - ox) * k);
    const y = a[1] > J.sho[i][1] ? T.sho[i][1] + (a[1] - J.sho[i][1]) * k : a[1] * T.sho[i][1] / J.sho[i][1] + o.lift * Math.max(0, 1 - a[1] / J.sho[i][1]);
    return [x - T.wri[i][0], y - T.wri[i][1], a[2] * k - T.wri[i][2]]; };
  /* feet: as far out from the hips as they were on the old body (under the hips, not out at the A-pose's spread) */
  const foot = (i, mv) => { const sd = i ? 1 : -1, a = add(J.ankle[i], mv || [0, 0, 0]);
    const x = a[0] + sd * (Math.abs(T.hip[i][0]) - Math.abs(J.hip[i][0])), y = (a[1] - J.ankle[i][1]) * kl + T.ankle[i][1], z = (a[2] - J.hip[i][2]) * kl + T.hip[i][2];
    return [x - T.ankle[i][0], y - T.ankle[i][1], z - T.ankle[i][2]]; };
  const f = pose => { const out = {};
    for (const [bn, tr] of Object.entries(pose)) {
      const n = Object.assign({}, tr);
      if (bn === 'c_handR' || bn === 'c_handL') n.move = hand(bn === 'c_handL' ? 1 : 0, tr.move);
      else if (bn === 'c_footR' || bn === 'c_footL') n.move = foot(bn === 'c_footL' ? 1 : 0, tr.move);
      else if (bn === 'hips' && tr.move) n.move = tr.move.map(v => v * kl);
      out[bn] = n; }
    return out; };
  for (const [nm, p] of Object.entries(old.poses)) s.poses[nm] = f(p);
  for (const [nm, c] of Object.entries(old.clips)) s.clips[nm] = Object.assign({}, c, { keys: c.keys.map(key => key.pose ? Object.assign({}, key, { pose: f(key.pose) }) : key) });
  s.pack = old.pack; return s;
}

/* ---- Cronky Dong's moves remade from the atlas (written on the old body's targets, like the rest, then re-placed) ---- */
/* jab 2: a rising uppercut, the left fist driving up from low in front, chest and legs lifting into it */
K.Uppercut = keys([{ t: 0, use: GB, pose: { chest: R(10, -14), c_handR: b.HR(0.9, 1.0, -0.2) } },
  { t: 0.07, pose: { hips: HP(0, -0.05, 0), spine: R(34), chest: R(26, 16, 6), head: R(-54), c_handR: b.HR(0.6, 0.85, -0.3), c_handL: b.HL(0.45, 0.4, 0.22) } },
  { t: 0.13, in: 'snap', pose: { hips: HP(0, 0.22, 0.06), spine: R(6), chest: R(-8, -18, -6), head: R(-18), c_handL: b.HL(0.55, 1.8, 0.06), c_handR: b.HR(0.2, 0.85, -0.5) } },
  { t: 0.2, pose: { c_handL: b.HL(0.5, 1.88, 0.04) } }, { t: 0.55, in: 'quad', pose: { hips: HP(0, 0.06, 0.02), spine: R(20), chest: R(12, -4), head: R(-38), c_handL: b.HL(0.45, 0.8, 0.3), c_handR: b.HR(0.36, 0.3, -0.38) } }, { t: 1.05, ...backB }]);
/* ftilt: an open-hand swat, the right arm swinging out from across the chest into a broad slap in front, carried past */
K.Backhand = keys([{ t: 0, use: GB }, { t: 0.15, pose: { hips: HP(0, 0.06, -0.06), spine: R(22), chest: R(14, 26, 4), head: R(-40, -10), c_handR: b.HR(0.45, 1.15, 0.2) } },
  { t: 0.23, in: 'snap', pose: Object.assign(SW(0.14), { spine: R(26), chest: R(14, -10), head: R(-44, 6), c_handR: b.HR(1.2, 0.9, -0.2) }) },
  { t: 0.3, pose: { chest: R(14, -22), c_handR: b.HR(1.0, 0.85, -0.65) } }, { t: 0.7, in: 'quad', pose: { hips: HP(0, 0.04, 0.04), chest: R(20, -8), c_handR: b.HR(0.55, 0.4, -0.55) } }, { t: 1.15, ...backB }]);
/* grab: one open hand shoots out and closes */
K.Grab = keys([{ t: 0, use: GB }, { t: 0.17, pose: { hips: HP(0, 0.05, -0.04), chest: R(18, 10), c_handR: b.HR(0.35, 0.95, -0.3) } },
  { t: 0.27, in: 'snap', pose: Object.assign(SW(0.12), { spine: R(22), chest: R(14, -12), head: R(-40), c_handR: b.HR(1.05, 0.9, -0.12) }) }, { t: 0.33, pose: {} },
  { t: 0.8, in: 'quad', pose: { hips: HP(0, 0.04, 0), chest: R(20, 0), c_handR: b.HR(0.5, 0.5, -0.35) } }, { t: 1.25, ...backB }]);
/* pummel: the free left hand slaps the held opponent, the holding hand stays put */
K.Pummel = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.06, pose: { chest: R(8, -10), c_handL: b.HL(0.45, 1.25, 0.35) } },
  { t: 0.12, in: 'snap', pose: { chest: R(4, 10), c_handL: b.HL(0.7, 1.0, 0.05) } }, { t: 0.23, pose: { chest: R(6, 0), c_handL: b.HL(0.4, 0.13, 0.38) } }]);
/* up throw: one arm heaves the opponent straight up, the other side low for balance */
K.ThrowU = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.22, pose: { hips: HP(0, -0.04, 0), spine: R(30), chest: R(22, 6), head: R(-48), c_handR: b.HR(0.5, 0.45, -0.3) } },
  { t: 0.42, in: 'snap', pose: { hips: M(0, -0.12, 0), spine: R(4), chest: R(-10, -6, -8), head: R(-10), c_handR: b.HR(0.15, 2.35, -0.3), c_handL: b.HL(0.3, 0.6, 0.55), c_footR: b.FR(-0.06, 0, -0.26), c_footL: b.FL(-0.1, 0, 0.26) } },
  { t: 0.55, pose: { c_handR: b.HR(0.12, 2.4, -0.32) } }, { t: 0.95, ...backB }]);
/* down throw: one arm drives the opponent into the floor, the body folding forward over it */
K.ThrowD = keys([{ t: 0, use: GB, pose: HOLDK }, { t: 0.25, pose: { hips: HP(0, 0.18, -0.06), spine: R(8), chest: R(-4, 10), head: R(-16), c_handR: b.HR(0.45, 1.6, -0.3), c_handL: b.HL(0.3, 0.7, 0.5) } },
  { t: 0.42, in: 'snap', pose: kn({ hips: HP(0, -0.1, 0.12), spine: R(46), chest: R(28, -8), head: R(-62), c_handR: b.HR(0.95, 0.15, -0.2), c_handL: b.HL(0.4, 0.13, 0.42) }) },
  { t: 0.55, pose: { hips: HP(0, -0.12, 0.12) } }, { t: 0.95, ...backB }]);
/* cargo up throw: both arms heave the opponent overhead and finish high and apart */
K.ThrowCU = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.2, pose: { hips: M(0, -0.2, 0), spine: R(10), c_handR: b.HR(0.05, 1.8, -0.22), c_handL: b.HL(0.05, 1.8, 0.22) } },
  { t: 0.42, in: 'snap', pose: { hips: M(0, 0.02, 0), spine: R(-6), chest: R(-8), head: R(-24), c_handR: b.HR(0.0, 2.4, -0.55), c_handL: b.HL(0.0, 2.4, 0.55), c_footR: b.FR(0.0, 0.06), c_footL: b.FL(-0.04, 0.06) } },
  { t: 0.55, pose: { c_handR: b.HR(-0.02, 2.35, -0.62), c_handL: b.HL(-0.02, 2.35, 0.62) } }, { t: 0.95, ...backB }]);
/* cargo down throw: a bear hug, the opponent pulled down into his arms and squeezed against his chest, then let go */
K.ThrowCD = keys([{ t: 0, use: 'stand', pose: CARRY }, { t: 0.18, pose: { hips: M(0, -0.08, 0), spine: R(8), chest: R(2), c_handR: b.HR(0.55, 1.4, -0.45), c_handL: b.HL(0.55, 1.4, 0.45) } },
  { t: 0.32, in: 'snap', pose: { hips: M(0, -0.16, -0.04), spine: R(14), chest: Object.assign(R(10), { scale: [0.94, 1, 1.04] }), head: R(-14), c_handR: b.HR(0.5, 1.15, 0.08), c_handL: b.HL(0.5, 1.15, -0.08) } },
  { t: 0.42, pose: { chest: Object.assign(R(12), { scale: [0.92, 1, 1.05] }), c_handR: b.HR(0.48, 1.12, 0.1), c_handL: b.HL(0.48, 1.12, -0.1) } },
  { t: 0.55, in: 'out', pose: { chest: Object.assign(R(4), { scale: [1, 1, 1] }), c_handR: b.HR(0.5, 1.2, -0.7), c_handL: b.HL(0.5, 1.2, 0.7) } }, { t: 0.95, ...backB }]);
/* The Entire Gym, charging: the right fist windmills round the shoulder (behind, below, in front, above), the torso
   rocking against it; the punch starts from the behind point */
{ const P = [[-0.45, 1.4, -0.65], [0.15, 0.7, -0.6], [0.55, 1.35, -0.5], [0.0, 2.0, -0.5]], ch = [R(10, 34), R(18, 22), R(14, 4), R(4, 22)], hp = [0, -0.05, 0, 0.04];
  K.Wind = keys([0, 1, 2, 3, 0].map((j, n) => ({ t: n * 0.125, in: n ? 'lin' : undefined, reset: n === 0 || undefined, use: n === 0 ? GB : undefined, pose: { hips: HP(0, hp[j], -0.04), chest: ch[j], head: R(-46, -ch[j].rot[1] * 0.5), c_handR: b.HR(P[j][0], P[j][1], P[j][2]) } }))); }
/* down air: one foot stamps straight down, the other knee drawn up, arms flung up and out */
K.Stomp = keys([{ t: 0, use: AB }, { t: 0.33, pose: { spine: R(4), chest: R(-4), head: R(-8), c_footR: b.FR(0.15, 0.5), c_footL: b.FL(0.15, 0.55), c_handR: b.HR(0.0, 1.45, -0.7), c_handL: b.HL(0.0, 1.45, 0.7) } },
  { t: 0.47, in: 'snap', pose: { hips: M(0, 0.04, 0), spine: R(-2), head: R(0), c_footR: b.FR(0.02, -0.28), c_footL: b.FL(0.25, 0.6), c_handR: b.HR(-0.1, 1.75, -0.75), c_handL: b.HL(-0.1, 1.75, 0.75) } },
  { t: 0.56, pose: { c_footR: b.FR(0.02, -0.26) } }, { t: 1.0, in: 'quad', pose: { c_footR: b.FR(0.1, 0.2), c_footL: b.FL(0.0, 0.15) } }, { t: 1.8, ...backBA }]);
/* get-up attack from flat on his back: rolls up onto his knees with the arms sweeping round, a clap in front, then one
   behind, and back into the stance */
{ const LIE = { all: { rot: [-90, 0, 0], move: [0, 0.3, 0.95] }, head: R(20), c_handL: b.HL(-0.1, 1.0, 0.7), c_handR: b.HR(0.1, 0.95, -0.7) };
  K.GetupAtk = keys([{ t: 0, use: 'stand', pose: LIE }, { t: 0.18, pose: { all: { rot: [-40, 0, 0], move: [0, 0.1, 0.4] }, spine: R(30), chest: R(18), c_handR: b.HR(0.2, 1.2, -1.0), c_handL: b.HL(0.2, 1.2, 1.0) } },
    { t: 0.37, in: 'snap', reset: true, use: GB, pose: kn({ hips: HP(0, 0.06, 0.04), spine: R(30), chest: R(16), head: R(-46), c_handR: b.HR(1.15, 0.6, -0.08), c_handL: b.HL(1.15, 0.6, 0.08) }) },
    { t: 0.47, in: 'snap', pose: { chest: R(4, 0), c_handR: b.HR(-0.75, 0.6, -0.1), c_handL: b.HL(-0.75, 0.6, 0.1) } },
    { t: 1.1, in: 'quad', pose: kn({ hips: HP(0, 0.02, 0) }) }, { t: 1.85, ...backB }]); }
/* ledge attack: hauls himself up over the edge and clubs his right forearm down across the space in front */
K.LedgeAtk = keys([{ t: 0, use: GB, pose: kn({ hips: HP(0, -0.12, -0.3), spine: R(40), chest: R(26), head: R(-60), c_handR: b.HR(0.55, 0.15, -0.4), c_handL: b.HL(0.55, 0.15, 0.4), c_footR: b.FR(-0.4, 0, -0.24), c_footL: b.FL(-0.45, 0, 0.24) }) },
  { t: 0.14, pose: { hips: HP(0, 0.12, -0.05), spine: R(16), chest: R(4, 24), head: R(-30), c_handR: b.HR(0.0, 1.85, -0.2), c_footR: b.FR(-0.06, 0, -0.24), c_footL: b.FL(-0.1, 0, 0.24) } },
  { t: 0.23, in: 'snap', pose: Object.assign(SW(0.12), { spine: R(34), chest: R(20, -16), head: R(-50), c_handR: b.HR(1.05, 0.5, 0.05) }) },
  { t: 0.3, pose: { c_handR: b.HR(0.95, 0.35, 0.15) } }, { t: 0.75, in: 'quad', pose: kn({ hips: HP(0, 0.02, 0.04) }) }, { t: 1.15, ...backB }]);
/* the second idle: sits back, thumps his right fist into his open left palm, twice, then rolls the right shoulder */
K.Idle2 = keys([{ t: 0, use: GB, pose: kn({}) },
  { t: 0.4, pose: { hips: HP(0, 0.14, -0.08), spine: R(12), chest: R(6), head: R(-24), c_handR: b.HR(0.5, 1.2, -0.4), c_handL: b.HL(0.5, 1.05, 0.12) } },
  { t: 0.62, in: 'snap', pose: { chest: R(8, 6), c_handR: b.HR(0.52, 1.08, 0.06) } }, { t: 0.85, pose: { chest: R(6), c_handR: b.HR(0.5, 1.25, -0.4) } },
  { t: 1.05, in: 'snap', pose: { chest: R(8, 6), c_handR: b.HR(0.52, 1.08, 0.06) } }, { t: 1.3, pose: { chest: R(6, -4), head: R(-20, 10), c_handR: b.HR(0.2, 1.05, -0.6), c_handL: b.HL(0.4, 0.13, 0.38) } },
  { t: 1.6, pose: { chest: R(2, -10, 8), c_handR: b.HR(-0.1, 1.7, -0.75) } }, { t: 1.9, pose: { chest: R(4, -6, 10), c_handR: b.HR(-0.45, 1.25, -0.7) } },
  { t: 2.2, pose: { chest: R(8, 0, 4), head: R(-30, 4), c_handR: b.HR(0.3, 0.8, -0.65) } }, { t: 2.65, pose: kn({ hips: HP(0, -0.03) }) }, { t: 3.0, pose: kn({}) }]);

/* ---- matched to the atlas's picture plates (six frames a move): the forward tilt winds the arm back behind him first; the
   down tilt goes flat with the free arm thrown back; the forward smash rears up with both arms spread back and lunges
   into a low clap far out in front; the up smash sinks with both palms by the floor, claps overhead and opens up; the
   down smash lifts both fists together overhead and slams them wide, front and back; the punch and the headbutt throw
   the free arm(s) back; the grab reaches with one hand while the other lifts behind; the ground spin ends arms raised;
   the ground Hand Slap keeps the free arm straight up while the other slaps ---- */
K.Backhand = keys([{ t: 0, use: GB }, { t: 0.15, pose: { hips: HP(0, 0.04, -0.08), spine: R(24), chest: R(16, 30, 4), head: R(-44, -12), c_handR: b.HR(-0.55, 1.25, -0.7), c_handL: b.HL(0.45, 0.13, 0.4) } },
  { t: 0.23, in: 'snap', pose: Object.assign(SW(0.16, 0.04), { spine: R(32), chest: R(18, -14), head: R(-50, 8), c_handR: b.HR(1.25, 0.85, -0.25) }) },
  { t: 0.3, pose: { chest: R(18, -24), c_handR: b.HR(1.1, 0.8, -0.05) } }, { t: 0.7, in: 'quad', pose: { hips: HP(0, 0.02, 0.04), chest: R(22, -8), c_handR: b.HR(0.6, 0.35, -0.45) } }, { t: 1.15, ...backB }]);
K.LowSlap = keys([{ t: 0, use: GB }, { t: 0.1, pose: { hips: HP(0, -0.04, -0.04), spine: R(36), c_handR: b.HR(0.2, 0.5, -0.45) } },
  { t: 0.17, in: 'snap', pose: Object.assign(SW(0.06, 0.16), { spine: R(44), chest: R(26, -10), head: R(-64), c_handR: b.HR(1.15, 0.12, -0.2), c_handL: b.HL(-0.15, 0.45, 0.55) }) }, { t: 0.23, pose: { c_handR: b.HR(1.1, 0.12, -0.15) } },
  { t: 0.55, in: 'quad', pose: { hips: HP(0, -0.02, 0), c_handR: b.HR(0.6, 0.13, -0.38), c_handL: b.HL(0.36, 0.13, 0.38) } }, { t: 0.83, ...backB }]);
/* Forward smash and down smash below are keyed frame by frame against the reference (one game frame = 1/30 s of clip
   time here, so key times are frame / 30). Forward smash: hitbox 22-23, charge holds frame 14. Down smash: 11-14. */
const FP = { c_footL: b.FL(-0.1, 0, 0.26) };   /* the back foot stays planted where the stance put it */
K.Clap = keys([{ t: 0, use: GB },
  /* 1-3: rises out of the knuckles, the arms opening wide to the sides */
  { t: 3 / 30, pose: Object.assign({ hips: HP(0, 0.06, -0.08), spine: R(18), chest: R(4, 10), head: R(-32, -6), c_handR: b.HR(-0.05, 1.3, -0.6), c_handL: b.HL(0.35, 0.95, 0.7) }, FP) },
  /* 14: the charge pose, held while the button is held: crouched, leaning back, one hand high and behind, the other wide */
  { t: 14 / 30, pose: Object.assign({ hips: HP(0, 0.06, -0.14), spine: R(14), chest: R(-2, 16), head: R(-28, -8), c_handR: b.HR(-0.35, 1.45, -0.5), c_handL: b.HL(0.4, 0.95, 0.7) }, FP) },
  /* 16-19: both arms flung straight back at shoulder height, chest open, weight back */
  { t: 17 / 30, in: 'out', pose: Object.assign({ hips: HP(0, 0.1, -0.2), spine: R(4), chest: R(-14, 6), head: R(-20), c_handR: b.HR(-0.8, 1.45, -0.4), c_handL: b.HL(-0.75, 1.5, 0.4) }, FP) },
  { t: 19 / 30, pose: { hips: HP(0, 0.1, -0.18), chest: R(-16, 4), c_handR: b.HR(-0.85, 1.42, -0.36), c_handL: b.HL(-0.8, 1.47, 0.36) } },
  /* 20-21: pitches forward, the arms sweeping round the sides at shoulder height */
  { t: 21 / 30, in: 'snap', pose: Object.assign({ hips: HP(0, 0.1, 0.08), spine: R(24), chest: R(10), head: R(-40), c_handR: b.HR(0.55, 1.0, -0.75), c_handL: b.HL(0.55, 1.0, 0.75), c_footR: b.FR(0.12, 0, -0.26) }, FP) },
  /* 22: the clap, a long low lunge, the back leg stretched out behind */
  { t: 0.73, pose: Object.assign(SW(0.34, 0.12), { spine: R(46), chest: R(20, 0), head: R(-60), c_handR: b.HR(1.45, 0.72, -0.05), c_handL: b.HL(1.45, 0.72, 0.05), c_footR: b.FR(0.32, 0, -0.26) }, FP) },
  { t: 0.8, pose: { c_handR: b.HR(1.47, 0.7, -0.05), c_handL: b.HL(1.47, 0.7, 0.05) } },
  /* 27-40: the hands sag, still pressed together, the body stays down in the lunge */
  { t: 0.95, in: 'out', pose: { spine: R(44), c_handR: b.HR(1.3, 0.42, -0.08), c_handL: b.HL(1.3, 0.42, 0.08) } },
  { t: 1.35, in: 'quad', pose: Object.assign({ hips: HP(0, 0.02, 0.18), spine: R(36), chest: R(22), head: R(-52), c_handR: b.HR(0.9, 0.2, -0.25), c_handL: b.HL(0.9, 0.2, 0.25), c_footR: b.FR(0.2, 0, -0.25) }, FP) },
  /* 41-54: gathers back into the knuckles */
  { t: 1.85, ...backB }]);
/* ---- motion capture test (2026-11-11): the forward smash from a Mixamo two-handed heavy swing, retargeted by
   tools/blender/mocap.py --handspace root into assets/joey/mocap/<name>.json. The capture is the in-between (a key every
   frame); on top of it he stays down in his ape's crouch, the hands meet in a clap at the strike and reach as far as the
   hand-keyed clap did, and the clip blends out of and back into the knuckle stance. ---- */
const MOCAPDIR = path.join(__dirname, '..', '..', 'assets', 'joey', 'mocap');
/* keeps a capture readable side-on: the chest's turn about the vertical is eased to within yawMax degrees (soft, so a turn
   still reads), the correction turning the whole body about the hips, hand and foot targets with it */
const qmulB = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
function unturnB(pose, yawMax) {
  const h = pose.hips, cw = qmulB(qmulB(h.qb, pose.spine.qb), pose.chest.qb), th0 = 2 * Math.atan2(cw[3], cw[0]), th = Math.atan2(Math.sin(th0), Math.cos(th0));
  const m = yawMax * Math.PI / 180, D = m * Math.tanh(th / m) - th, c = Math.cos(D), s = Math.sin(D), cq = Math.cos(D / 2), sq = Math.sin(D / 2);
  const rot = v => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c], q = h.qb;
  h.qb = [cq * q[0] - sq * q[3], cq * q[1] - sq * q[2], cq * q[2] + sq * q[1], cq * q[3] + sq * q[0]];
  const bone = n => big.bones.find(b => b.name === n).head, hp = bone('hips').map((v, i) => v + h.move[i]);
  for (const bn of ['c_handL', 'c_handR', 'c_footL', 'c_footR']) { const r = bone(bn), p = r.map((v, i) => v + pose[bn].move[i] - hp[i]); pose[bn].move = rot(p).map((v, i) => v + hp[i] - r[i]); }
}
function capClip(name, o) {
  const d = JSON.parse(fs.readFileSync(path.join(MOCAPDIR, name + '.json'), 'utf8')), F = d.frames, sf = d.fps || 30, fr = n => (n - 1) / sf;
  const warp = o.warp.map(([c, t]) => [fr(c), t]), dur = warp[warp.length - 1][1];
  const src = t => { for (let i = 1; i < warp.length; i++) if (t <= warp[i][1] || i === warp.length - 1) { const [s0, d0] = warp[i - 1], [s1, d1] = warp[i]; return s0 + (s1 - s0) * Math.min(1, Math.max(0, (t - d0) / ((d1 - d0) || 1))); } };
  const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const nq = q => { const l = Math.hypot(...q); return q.map(v => +(v / l).toFixed(5)); };
  const nlerp = (a, b, u) => { if (dot(a, b) < 0) b = b.map(v => -v); return nq(mix(a, b, u)); };
  const sample = s => { const x = Math.min(F.length - 1, Math.max(0, s * sf)), i = Math.floor(x), j = Math.min(F.length - 1, i + 1), u = x - i, out = {};
    for (const bn of ['hips', 'spine', 'chest', 'head', 'c_handL', 'c_handR', 'c_footL', 'c_footR']) { const A = F[i][bn], B = F[j][bn], r = {};
      if (A.qb) r.qb = nlerp(A.qb, B.qb, u); if (A.move) r.move = mix(A.move, B.move, u); out[bn] = r; }
    return out; };
  const smooth = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  /* a window over clip time [a, b], eased in over e0 seconds before and out over e1 after */
  const win = (t, [a, b], e0, e1) => t < a ? smooth(1 - (a - t) / e0) : t > b ? smooth(1 - (t - b) / e1) : 1;
  const stance = big.poses.kn, keysOut = [], n = Math.round(dur * 30);
  for (let k = 0; k <= n; k++) {
    const t = k / 30, c = sample(src(t)), pose = {};
    if (o.yawMax) unturnB(c, o.yawMax);
    for (const bn in o.add) { const a = o.add[bn]; c[bn] = c[bn] || {}; if (a.move) c[bn].move = (c[bn].move || [0, 0, 0]).map((v, i) => v + a.move[i]); if (a.rot) c[bn].rot = a.rot; }
    for (const bw of o.boost || []) { const w = win(t, bw.at, bw.ease[0], bw.ease[1]); if (!w) continue;
      for (const bn in bw.pose) { const p = bw.pose[bn]; c[bn] = c[bn] || {};
        if (p.move) c[bn].move = (c[bn].move || [0, 0, 0]).map((v, i) => v + p.move[i] * w);
        if (p.rot) c[bn].rot = (c[bn].rot || [0, 0, 0]).map((v, i) => v + p.rot[i] * w);
        if (p.toX !== undefined) { const rest = big.bones.find(b => b.name === bn).head[0]; c[bn].move[0] += ((p.toX - rest) - c[bn].move[0]) * w; } } }   /* toX: the hand pulled to this x (the clap) */
    if (o.hands) {   /* the hands follow their own path ([t, forward, height, out to the side, ease into this key]), the body stays the capture's; the left hand mirrors the right */
      const H = o.hands; let i = 1; while (i < H.length - 1 && t > H[i][0]) i++;
      const A = H[i - 1], B = H[i], u0 = Math.min(1, Math.max(0, (t - A[0]) / (B[0] - A[0]))), u = B[4] === 'snap' ? u0 * u0 * u0 : smooth(u0);
      const z = A[1] + (B[1] - A[1]) * u, y = A[2] + (B[2] - A[2]) * u, x = A[3] + (B[3] - A[3]) * u;
      c.c_handR = { move: b.HR(z, y, -x).move }; c.c_handL = { move: b.HL(z, y, x).move }; }
    const ws = Math.max(1 - smooth(t / o.blendIn), smooth((t - (dur - o.blendOut)) / o.blendOut));   /* how much of the knuckle stance shows */
    for (const bn of new Set([...Object.keys(stance), ...Object.keys(c)])) { const s = stance[bn] || {}, m = c[bn] || {}, r = {};
      const sr = s.rot || [0, 0, 0], mr = m.rot || [0, 0, 0]; r.rot = mix(mr, sr, ws).map(v => +v.toFixed(2));
      if (m.qb) r.qb = nlerp(m.qb, [1, 0, 0, 0], ws);
      r.move = mix(m.move || [0, 0, 0], s.move || [0, 0, 0], ws).map(v => +v.toFixed(4));
      pose[bn] = r; }
    keysOut.push(k === 0 ? { t: 0, use: GB, pose } : { t: +t.toFixed(4), pose });
  }
  return keys(keysOut);
}
/* Two Handed Heavy Weapon Swing: 40-55 both arms drawn back low behind him, 58-73 swung up over his head, 76-80 slammed
   down in front, 82-110 the follow-through and settle. Startup 0-0.73 (the charge holds near capture frame 63, arms back),
   contact 0.73-0.8, recovery to 1.85. */
K.ClapCap = capClip('Two_Handed_Heavy_Weapon_Swing', {
  warp: [[38, 0], [66, 0.5], [76, 0.73], [80, 0.8], [104, 1.45], [110, 1.85]], blendIn: 0.18, blendOut: 0.4, yawMax: 15,
  add: { hips: M(0, -0.22, -0.04), spine: R(4), head: R(-30), footL: R(-20), footR: R(-20) },   /* stays down in his crouch, face forward */
  /* Studied (not copied) from the owner's reference clip, 2026-11-11: a long wind-up with the arms flung straight back and
     the body leaning back; a release of about one frame; the whole body diving low and long into the clap, back leg
     stretched out behind, the hands meeting low; the dive held a long while, then a slow climb back. */
  boost: [
    { at: [0.3, 0.64], ease: [0.25, 0.04], pose: { hips: M(0, 0.06, -0.1), spine: R(-12), chest: R(-16), head: R(14) } },   /* leaning back, chest open, arms behind */
    { at: [0.7, 1.1], ease: [0.03, 0.6], pose: { hips: M(0, -0.2, 0.45), spine: R(24), chest: R(10), head: R(-38), c_footR: M(0, 0, 0.42), c_footL: M(0, 0, -0.32), footL: R(30) } },   /* the dive: low and long, back leg straight out behind */
    { at: [0.86, 1.25], ease: [0.1, 0.4], pose: { spine: R(-22), chest: R(-10), head: R(16) } }],   /* the capture keeps bending over after the strike: hold him up so his face stays off the floor */
  /* [t, forward, height, out to the side; below 0 aims past the middle, so arms stretched beyond their reach still meet]: arms drawn straight back behind him, held while charging, then one frame to
     whip through and the palms smash together low and far in front; they part a little and drift back as he rises */
  hands: [[0, 0.36, 0.13, 0.38], [0.22, -0.1, 1.15, 0.6], [0.5, -0.78, 1.32, 0.45], [0.65, -0.86, 1.28, 0.42], [0.69, 0.55, 0.95, 0.55, 'snap'],
    [0.73, 1.8, 0.55, -0.1, 'snap'], [0.8, 1.83, 0.52, -0.1], [1.0, 1.76, 0.5, -0.08], [1.25, 1.62, 0.46, -0.09], [1.4, 1.45, 0.42, -0.06], [1.62, 0.9, 0.3, 0.28], [1.85, 0.36, 0.13, 0.38]] });
K.OverClap = keys([{ t: 0, use: GB }, { t: 0.25, pose: { hips: HP(0, -0.1, -0.02), spine: R(34), chest: R(20), head: R(-50), c_handR: b.HR(0.3, 0.15, -0.85), c_handL: b.HL(0.3, 0.15, 0.85), c_footR: b.FR(-0.06, 0, -0.3), c_footL: b.FL(-0.1, 0, 0.3) } },
  { t: 0.47, in: 'snap', pose: { hips: HP(0, 0.24, 0), spine: R(4), chest: R(-10), head: R(-14), c_handR: b.HR(0.12, 1.95, -0.05), c_handL: b.HL(0.12, 1.95, 0.05), c_footR: b.FR(-0.06, 0, -0.26), c_footL: b.FL(-0.1, 0, 0.26) } },
  { t: 0.56, pose: { c_handR: b.HR(0.12, 1.93, -0.05), c_handL: b.HL(0.12, 1.93, 0.05) } },
  { t: 0.85, in: 'out', pose: { hips: HP(0, 0.18, 0), chest: R(-4), c_handR: b.HR(0.15, 1.75, -0.6), c_handL: b.HL(0.15, 1.75, 0.6) } }, { t: 1.65, ...backB }]);
const DF = { c_footR: b.FR(-0.06, 0, -0.32), c_footL: b.FL(-0.1, 0, 0.32) };   /* feet set wide and kept there */
K.Hammer = keys([{ t: 0, use: GB },
  /* 1-3: straightens up fast, the fists coming up past the chest */
  { t: 2 / 30, pose: Object.assign({ hips: M(0, -0.22, -0.04), spine: R(10), chest: R(2), head: R(-20), c_handR: b.HR(0.35, 1.45, -0.35), c_handL: b.HL(0.35, 1.45, 0.35) }, DF) },
  /* 4-9: standing tall, both fists on top of his head, elbows out wide; a small lift as it holds */
  { t: 4 / 30, in: 'out', pose: Object.assign({ hips: M(0, -0.1, 0), spine: R(-2), chest: R(-6), head: R(-6), c_handR: b.HR(0.02, 1.6, -0.4), c_handL: b.HL(0.02, 1.6, 0.4) }, DF) },
  { t: 9 / 30, pose: { hips: M(0, -0.07, 0), chest: R(-8), c_handR: b.HR(0.0, 1.64, -0.4), c_handL: b.HL(0.0, 1.64, 0.4) } },
  /* 10: the fists swing out to either side, front and back, at shoulder height, as the body drops */
  { t: 10.3 / 30, in: 'snap', pose: Object.assign({ hips: HP(0, 0.14, 0), spine: R(16), chest: R(6), head: R(-30), c_handR: b.HR(0.85, 1.3, -0.4), c_handL: b.HL(-0.85, 1.3, 0.4) }, DF) },
  /* 11-14: fists slam the floor wide, the body squashed flat and low */
  { t: 0.37, pose: Object.assign(SW(0, 0.24), { spine: R(50), chest: R(26), head: R(-66), c_handR: b.HR(1.1, 0.12, -0.38), c_handL: b.HL(-1.1, 0.12, 0.38) }, DF) },
  { t: 0.47, pose: Object.assign(SW(0, 0.28), { c_handR: b.HR(1.12, 0.12, -0.38), c_handL: b.HL(-1.12, 0.12, 0.38) }) },
  /* 15-32: holds down there, settling */
  { t: 1.07, pose: Object.assign(SW(0, 0.26), { spine: R(48), c_handR: b.HR(1.1, 0.12, -0.38), c_handL: b.HL(-1.1, 0.12, 0.38) }) },
  /* 33-40: the back fist lifts first, the body turning toward the front hand */
  { t: 1.3, in: 'quad', pose: Object.assign({ hips: HP(0, 0.02, 0.06), spine: R(34), chest: R(20, -10), head: R(-52, 6), c_handL: b.HL(-0.45, 0.75, 0.38), c_handR: b.HR(0.95, 0.13, -0.36) }, DF) },
  /* 41-55: brings the back fist round to the front and gathers into the knuckles */
  { t: 1.55, pose: { hips: HP(0, 0.02, 0.02), chest: R(22, -4), c_handL: b.HL(0.25, 0.4, 0.38), c_handR: b.HR(0.6, 0.13, -0.38) } },
  { t: 1.85, ...backB }]);
K.Punch = keys([{ t: 0, use: GB, pose: { chest: R(10, 34), c_handR: b.HR(-0.45, 1.4, -0.65) } }, { t: 0.5, pose: { hips: HP(0, 0.06, -0.12), chest: R(6, 46), head: R(-40, -16), c_handR: b.HR(-0.65, 1.25, -0.55), c_handL: b.HL(0.45, 0.7, 0.45) } },
  { t: 0.63, in: 'snap', pose: Object.assign(SW(0.3), { spine: R(32), chest: R(14, -34), head: R(-46, 14), c_handR: b.HR(1.45, 0.95, -0.02), c_handL: b.HL(-0.45, 0.95, 0.5), c_footR: b.FR(0.28, 0, -0.26) }) },
  { t: 0.8, pose: { c_handR: b.HR(1.42, 0.93, -0.02) } }, { t: 1.5, in: 'quad', pose: { hips: HP(0, 0.02, 0.1), chest: R(20, -10), c_handR: b.HR(0.7, 0.4, -0.35), c_handL: b.HL(0.3, 0.13, 0.38), c_footR: b.FR(0.05, 0, -0.24) } }, { t: 2.05, ...backB }]);
K.Headbutt = keys([{ t: 0, use: GB }, { t: 0.4, pose: { hips: HP(0, 0.18, -0.2), spine: R(-6), chest: R(-14), head: R(-6), c_handR: b.HR(0.2, 1.4, -0.6), c_handL: b.HL(0.2, 1.4, 0.6) } },
  { t: 0.67, in: 'snap', pose: Object.assign(SW(0.35, 0.02), { spine: R(52), chest: R(26), head: R(-22), c_handR: b.HR(-0.55, 1.0, -0.5), c_handL: b.HL(-0.55, 1.0, 0.5), c_footR: b.FR(0.2, 0, -0.26) }) }, { t: 0.73, pose: {} },
  { t: 1.4, in: 'quad', pose: { hips: HP(0, 0.04, 0.12), spine: R(36), chest: R(22), head: R(-50), c_handR: b.HR(0.3, 0.13, -0.4), c_handL: b.HL(0.3, 0.13, 0.4), c_footR: b.FR(0.05, 0, -0.24) } }, { t: 2.1, ...backB }]);
K.SpinG = keys([{ t: 0, use: GB }, { t: 0.15, pose: { hips: M(0, -0.06, 0), spine: R(6), chest: R(0), head: R(-8), c_handR: b.HR(0.0, 1.3, -1.05), c_handL: b.HL(0.0, 1.3, 1.05), c_footR: b.FR(-0.06, 0, -0.3), c_footL: b.FL(-0.1, 0, 0.3) } },
  ...Array.from({ length: 12 }, (_, k) => ({ t: 0.63 + k * 0.125, pose: { all: R(0, (k + 1) * 180) } })),
  { t: 2.3, in: 'out', pose: { hips: M(0, -0.12, 0), spine: R(-4), head: R(-8), c_handR: b.HR(0.15, 1.9, -0.55), c_handL: b.HL(0.15, 1.9, 0.55) } },
  { t: 2.9, pose: { hips: M(0, -0.1, 0), c_handR: b.HR(0.1, 1.7, -0.7), c_handL: b.HL(0.1, 1.7, 0.7) } }, { t: 3.5, reset: true, use: GB }]);
K.Slap = keys([{ t: 0, use: GB }, { t: 0.2, pose: { hips: HP(0, -0.08, -0.02), spine: R(30), chest: R(18, 0, 10), head: R(-48), c_handR: b.HR(0.3, 2.0, -0.4), c_handL: b.HL(0.5, 0.13, 0.45), c_footR: b.FR(-0.06, 0, -0.32), c_footL: b.FL(-0.1, 0, 0.32) } },
  { t: 0.4, in: 'snap', pose: { chest: R(28, 0, -10), c_handR: b.HR(0.75, 0.1, -0.4), c_handL: b.HL(0.25, 1.9, 0.4) } },
  { t: 0.58, pose: { chest: R(22, 0, -12), c_handR: b.HR(0.6, 0.35, -0.45), c_handL: b.HL(0.3, 2.0, 0.4) } },
  { t: 0.77, in: 'snap', pose: { chest: R(28, 0, 10), c_handR: b.HR(0.25, 1.9, -0.4), c_handL: b.HL(0.75, 0.1, 0.4) } },
  { t: 1.1, in: 'quad', pose: { chest: R(22), c_handR: b.HR(0.4, 0.13, -0.4), c_handL: b.HL(0.5, 0.13, 0.4) } }, { t: 1.55, ...backB }]);
K.Grab = keys([{ t: 0, use: GB }, { t: 0.17, pose: { hips: HP(0, 0.06, -0.04), chest: R(16, 14), c_handR: b.HR(0.3, 1.0, -0.35), c_handL: b.HL(0.2, 0.9, 0.45) } },
  { t: 0.27, in: 'snap', pose: Object.assign(SW(0.14), { spine: R(24), chest: R(14, -14), head: R(-42), c_handR: b.HR(1.1, 0.95, -0.1), c_handL: b.HL(-0.35, 1.35, 0.5) }) }, { t: 0.33, pose: {} },
  { t: 0.8, in: 'quad', pose: { hips: HP(0, 0.04, 0), chest: R(20, 0), c_handR: b.HR(0.5, 0.5, -0.35), c_handL: b.HL(0.36, 0.13, 0.38) } }, { t: 1.25, ...backB }]);

const humanA = retarget(human, JH, THA, { arm: 1.05, leg: 1, lift: 0 });
const bigA = retarget(big, JB, TBA, { arm: 1.18, leg: 0.7, lift: 0.09, extra: !process.env.JOEY_PLAIN });

/* ---- the hands: how closed each hand is (0 open, 1 a fist) through every clip, added to each key ----
   Cronky Dong walks on his knuckles, so his hands are fists on the ground unless a move slaps, claps or grabs; in the air
   they hang half open. Joey's hang loosely curled. [t, right, left] points, eased between; one value is both hands. */
const GRIPB = { '*': [[0, 1, 1]], Rise: [[0, 0.35]], Fall: [[0, 0.3]], FastFall: [[0, 0.3]], Helpless: [[0, 0.2]], AirJump: [[0, 0.7]], AirDodge: [[0, 0.8]],
  Hit: [[0, 0.3], [0.6, 1]], HitHeavy: [[0, 0.2], [0.55, 1]], Launch: [[0, 0.2]], LaunchUp: [[0, 0.2]], Spike: [[0, 0.2]], Tumble: [[0, 0.6]], Down: [[0, 0.3]], Held: [[0, 0.3]], Buried: [[0, 0.3]],
  Ledge: [[0, 0.8]], Respawn: [[0, 0.5]], Carry: [[0, 0.75]], CarryWalk: [[0, 0.75]], Toss: [[0, 0.75], [0.45, 0.75], [0.55, 0.1], [1.2, 0.9]],
  Hold: [[0, 0.8, 1]], Pummel: [[0, 0.8, 1], [0.06, 0.8, 0.1], [0.18, 0.8, 0.1], [0.23, 0.8, 1]], Grab: [[0, 1], [0.15, 0.1, 1], [0.27, 0.1, 1], [0.33, 0.85, 1], [1.1, 1, 1]],
  ThrowB: [[0, 0.8, 1], [0.4, 0.8, 0.3], [0.45, 0.1, 0.3], [0.9, 1]], ThrowU: [[0, 0.8, 1], [0.4, 0.8, 0.6], [0.45, 0.1, 0.6], [0.95, 1]], ThrowD: [[0, 0.8, 1], [0.4, 0.8, 1], [0.45, 0.2, 1], [0.95, 1]],
  ThrowCB: [[0, 0.75], [0.4, 0.75], [0.45, 0.1], [0.95, 1]], ThrowCU: [[0, 0.75], [0.4, 0.75], [0.45, 0.05], [0.95, 1]], ThrowCD: [[0, 0.75], [0.18, 0.4], [0.42, 0.5], [0.55, 0.05], [0.95, 1]],
  Backhand: [[0, 1], [0.12, 0.1, 1], [0.6, 0.15, 1], [1.15, 1]], ArmSweep: [[0, 1], [0.1, 0.1, 1], [0.8, 0.2, 1], [1.3, 1]], LowSlap: [[0, 1], [0.08, 0.1, 1], [0.55, 0.2, 1], [0.83, 1]],
  Clap: [[0, 1], [0.3, 0.1], [1.4, 0.2], [1.85, 1]], ClapCap: [[0, 1], [0.2, 0.15], [0.66, -0.3], [1.35, -0.3], [1.6, 0.2], [1.85, 1]], OverClap: [[0, 1], [0.15, 0.1], [1.2, 0.2], [1.65, 1]], Slap: [[0, 1], [0.15, 0.1], [1.2, 0.15], [1.55, 1]], SlapAir: [[0, 0.3], [0.3, 0.05], [1.65, 0.3]],
  Spin: [[0, 0.3], [0.25, 0.05], [1.0, 0.2], [1.27, 0.3]], SpinG: [[0, 1], [0.12, 0.05], [3.1, 0.1], [3.5, 1]], SpinA: [[0, 0.3], [0.1, 0.05], [2.3, 0.3]],
  GetupAtk: [[0, 0.3], [0.25, 0.05], [1.0, 0.2], [1.6, 1]], Idle2: [[0, 1], [0.35, 1, 0.05], [1.2, 1, 0.05], [1.4, 0.4, 1], [2.3, 0.4, 1], [2.65, 1]],
  Stomp: [[0, 0.3]], Bump: [[0, 0.3], [0.15, 0.6], [1.25, 0.3]], BackKick: [[0, 0.3]], FistDrop: [[0, 0.3], [0.4, 0.9], [1.4, 0.9], [1.85, 0.3]],
  Roll: [[0, 0.8], [0.9, 0.8], [1.15, 1]], Headbutt: [[0, 1]], Respawn2: [[0, 0.5]] };
const GRIPH = { '*': [[0, 0.3]], Palm: [[0, 0.3], [0.15, 0.05], [0.5, 0.05], [0.7, 0.3]], Reach: [[0, 0.3], [0.25, 0.05], [0.4, 0.8], [1.3, 0.8]], Hold: [[0, 0.8, 0.3]], Pummel: [[0, 0.8, 0.3]],
  Down: [[0, 0.2]], Tumble: [[0, 0.5]], Ball: [[0, 0.7]], Ledge: [[0, 0.8]] };
/* air clips of Cronky Dong that use no table entry hang half open, like the air pose */
const AIRCLIPS = ['Ball', 'Tumble'];
function grip(spec, table, deg) {
  const at = (pts, t) => { const v = i => [pts[i][1], pts[i].length > 2 ? pts[i][2] : pts[i][1]];
    if (t <= pts[0][0]) return v(0); for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const u = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]), a = v(i - 1), c = v(i); return [lerp(a[0], c[0], u), lerp(a[1], c[1], u)]; } return v(pts.length - 1); };
  const hand = (c, sd) => ({ ['fing' + sd + '1']: R(0, 0, (sd === 'R' ? 1 : -1) * deg.f1 * c), ['fing' + sd + '2']: R(0, 0, (sd === 'R' ? 1 : -1) * deg.f2 * c), ['thumb' + sd]: R(deg.tp * c, (sd === 'R' ? 1 : -1) * deg.ty * c, 0) });
  for (const [nm, clip] of Object.entries(spec.clips)) {
    const pts = table[nm] || (AIRCLIPS.includes(nm) ? [[0, 0.6]] : table['*']);
    for (const key of clip.keys) { const [r, l] = at(pts, key.t); key.pose = Object.assign({}, key.pose || {}, hand(r, 'R'), hand(l, 'L')); }
  }
}

grip(humanA, GRIPH, { f1: 45, f2: 50, tp: 0, ty: 30 }); grip(bigA, GRIPB, { f1: 80, f2: 85, tp: 0, ty: 45 });

/* ---- write ---- */
fs.mkdirSync(OUT, { recursive: true });
for (const [n, s] of [['human', humanA], ['big', bigA]]) {
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
cur.Joey = { file: 'assets/joey/export/joey-v1.glb', height: 13.5, feel: 1,
  clips: Object.assign(common(0.15), { throw: { clip: 'Reach', from: 0.3, to: 1.0 }, throw_u: { clip: 'Bench', from: 0, to: 2.9 }, grow: { clip: 'Grow', from: 0, to: 3.0 }, exhaust: { clip: 'Exhaust', from: 0, to: 15.0 },
    jumpsquat: { clip: 'Squat', from: 0, to: 0.2 }, fastfall: { clip: 'FastFall' }, helpless: { clip: 'Helpless' }, landHard: { clip: 'LandHard', from: 0, to: 0.6 }, shieldHit: { clip: 'ShieldHit', from: 0, to: 0.3 },
    hitHeavy: { clip: 'HitHeavy', from: 0, to: 0.8 }, launch: { clip: 'Launch', from: 0, to: 0.5 }, launchUp: { clip: 'LaunchUp', from: 0, to: 0.6 }, spike: { clip: 'Spike', from: 0, to: 0.6 },
    airdodge: { clip: 'AirDodge', from: 0, to: 0.66 }, roll: { clip: 'Ball', bounce: true }, respawn: { clip: 'Respawn' }, pummel: { clip: 'Pummel', from: 0, to: 0.3 },
    throw_f: { clip: 'ThrowF', from: 0, to: 1.0 }, throw_b: { clip: 'ThrowB', from: 0, to: 1.05 }, throw_d: { clip: 'ThrowD', from: 0, to: 1.1 } }),
  strikers: [{ bone: 'handR', ext: 1.0 }, { bone: 'handL', ext: 1.0 }, { bone: 'footL', ext: 1.4 }, { bone: 'footR', ext: 1.4 }], springs: [],
  attacks: { jab: A('Palm', 0.23, 0.27, 0, 0.7), jab2: A('Curl', 0.3, 0.33, 0, 0.8), jab3: A('Shove', 0.5, 0.57, 0, 1.3), ftilt: A('Raise', 0.4, 0.5, 0, 1.1), utilt: A('Press', 0.43, 0.53, 0, 1.2), dtilt: A('Toe', 0.33, 0.4, 0, 1.0), dash: A('Jog', 0.56, 0.67, 0, 1.75),
    fsmash: A('PR', 1.0, 1.07, 0, 2.4), usmash: A('Clean', 0.93, 1.0, 0, 2.35), dsmash: A('Lunge', 0.77, 1.27, 0, 2.4), nair: A('Jack', 0.36, 0.5, 0, 1.25), fair: A('Front', 0.53, 0.6, 0, 1.5), bair: A('Kick', 0.43, 0.53, 0, 1.35), uair: A('High5', 0.4, 0.47, 0, 1.2), dair: A('Box', 0.67, 0.77, 0, 1.8),
    grab: A('Reach', 0.37, 0.43, 0, 1.3), dgrab: A('Reach', 0.37, 0.43, 0, 1.3), pgrab: A('Reach', 0.37, 0.43, 0, 1.3), getup: A('Lunge', 0.77, 0.8, 0, 1.6), ledgeatk: A('Shove', 0.5, 0.57, 0, 1.3),
    nspec: A('Shake', 0.73, 0.8, 0, 1.4), sspec: A('Band', 0.8, 0.9, 0, 1.9), uspec: A('Strap', 0.33, 0.55, 0, 1.4), dspec: A('Wheel', 0.6, 1.07, 0, 2.2), '*': A('Palm', 0.23, 0.27, 0, 0.7) } };
cur['Cronky Dong'] = { file: 'assets/joey/export/cronky-v1.glb', height: 24.4, feel: 1,
  clips: Object.assign(common(0.12), { throw: { clip: 'Toss', from: 0, to: 1.4 }, carry: { clip: 'Carry' }, carryWalk: { clip: 'CarryWalk' }, punchWind: { clip: 'Wind' }, buried: { clip: 'Buried' },
    brake: { clip: 'Skid', from: 0, to: 0.4 }, jumpsquat: { clip: 'Squat', from: 0, to: 0.1 }, crouch: { clip: 'Crouch', at: 0.15 }, rise: { clip: 'Rise', from: 0, to: 0.45 }, airjump: { clip: 'AirJump', from: 0, to: 0.48 },
    fastfall: { clip: 'FastFall' }, helpless: { clip: 'Helpless' }, land: { clip: 'Land', from: 0, to: 0.4 }, landHard: { clip: 'LandHard', from: 0, to: 0.65 }, shieldHit: { clip: 'ShieldHit', from: 0, to: 0.3 },
    hitHeavy: { clip: 'HitHeavy', from: 0, to: 0.8 }, launch: { clip: 'Launch', from: 0, to: 0.5 }, launchUp: { clip: 'LaunchUp', from: 0, to: 0.6 }, spike: { clip: 'Spike', from: 0, to: 0.6 },
    airdodge: { clip: 'AirDodge', from: 0, to: 0.66 }, roll: { clip: 'Ball', bounce: true }, respawn: { clip: 'Respawn' }, pummel: { clip: 'Pummel', from: 0, to: 0.23 },
    throw_b: { clip: 'ThrowB', from: 0, to: 0.9 }, throw_u: { clip: 'ThrowU', from: 0, to: 0.95 }, throw_d: { clip: 'ThrowD', from: 0, to: 0.95 },
    throw_cf: { clip: 'Toss', from: 0, to: 1.4 }, throw_cb: { clip: 'ThrowCB', from: 0, to: 0.95 }, throw_cu: { clip: 'ThrowCU', from: 0, to: 0.95 }, throw_cd: { clip: 'ThrowCD', from: 0, to: 0.95 } }),
  strikers: [{ bone: 'handR', ext: 1.4 }, { bone: 'handL', ext: 1.4 }, { bone: 'footR', ext: 1.6 }, { bone: 'head', ext: 1.6 }], springs: [],
  attacks: { jab: A('Check', 0.17, 0.2, 0, 0.8), jab2: A('Uppercut', 0.13, 0.2, 0, 1.05), ftilt: A('Backhand', 0.23, 0.3, 0, 1.15), utilt: A('ArmSweep', 0.13, 0.37, 0, 1.3), dtilt: A('LowSlap', 0.17, 0.23, 0, 0.83), dash: A('Roll', 0.27, 0.6, 0, 1.15),
    fsmash: A('ClapCap', 0.73, 0.8, 0, 1.85), usmash: A('OverClap', 0.47, 0.53, 0, 1.65), dsmash: A('Hammer', 0.37, 0.47, 0, 1.85), nair: A('Spin', 0.33, 0.87, 0, 1.27), fair: A('FistDrop', 0.6, 0.77, 0, 1.85), bair: A('BackKick', 0.23, 0.53, 0, 1.05), uair: A('Bump', 0.2, 0.33, 0, 1.25), dair: A('Stomp', 0.47, 0.53, 0, 1.8),
    grab: A('Grab', 0.27, 0.33, 0, 1.25), dgrab: A('Grab', 0.27, 0.33, 0, 1.25), pgrab: A('Grab', 0.27, 0.33, 0, 1.25), ledgeatk: A('LedgeAtk', 0.23, 0.3, 0, 1.15), getup: A('GetupAtk', 0.37, 0.47, 0, 1.85),
    nspec: A('Wind', 0, 0.5, 0, 0.5), nspecR: A('Punch', 0.63, 0.7, 0, 2.05), nspecF: A('Punch', 0.63, 0.7, 0, 2.05), sspec: A('Headbutt', 0.67, 0.73, 0, 2.1), uspec: A('SpinG', 0.63, 2.1, 0, 3.5), uspecA: A('SpinA', 0.13, 1.43, 0, 2.3),
    dspec: A('Slap', 0.4, 0.77, 0, 1.55), dspecA: A('SlapAir', 0.63, 0.93, 0, 1.65), '*': A('Check', 0.17, 0.2, 0, 0.8) } };
fs.writeFileSync(mf, JSON.stringify(cur, null, 1) + '\n'); console.log('manifest: ' + Object.keys(cur).join(', '));
