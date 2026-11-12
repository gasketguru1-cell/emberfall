// Writes the skeleton and animation spec for Sprocket (assets/sprocket/work/rig.json), which tools/blender/rig.py turns
// into a rigged, animated model, and adds his entry to the game's manifest.
//   node tools/blender/sprocket.js
// Then:  blender -b --factory-startup --python tools/blender/rig.py -- --mesh assets/sprocket/raw/<task>/model_url.glb
//            --spec assets/sprocket/work/rig.json --out assets/sprocket/work/sprocket-rigged.glb
//        node tools/pack.mjs assets/sprocket/work/pack.json
// A man with a tool. His hands and feet follow four targets (c_handL, c_handR, c_footL, c_footR), so a pose says where a
// hand or a boot is and the elbow or knee works itself out; the hand targets ride on the chest, the foot targets stay on
// the floor when the hips move. The wrench is aimed directly (c_wrench), whatever the arm is doing: at rest it points
// straight down, -90 of pitch points it forward, 180 straight up, positive pitch behind him. It is rigid.
// Turning: positive pitch tips forward, positive yaw turns to his left (his right side comes forward), positive roll raises his left side.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const leg = (s, x) => [
  { name: 'thigh' + s, head: [x, 0.54, 0], tail: [x, 0.29, 0.04], parent: 'hips' },
  { name: 'shin' + s, head: [x, 0.29, 0.04], tail: [x, 0.1, -0.03], parent: 'thigh' + s, connect: true },
  { name: 'foot' + s, head: [x, 0.1, -0.03], tail: [x + (x > 0 ? 0.04 : -0.08), 0.03, 0.24], parent: 'shin' + s },
  { name: 'c_foot' + s, head: [x, 0.1, -0.03], tail: [x, 0.1, 0.09], parent: 'all', deform: false }];
const WR = [[-0.6, 1.16, 0.26], [-0.6, 0.04, 0.22]];   /* the wrench: grip, then the head on the floor */
const sprocket = {
  note: 'Sprocket: metres after prep (feet on y = 0, facing +Z, his right is -X). Joint positions were measured from the generated mesh.',
  prep: { yaw: 0, translate: [0, 0.953, 0] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'hips', head: [0.04, 0.52, 0], tail: [0.04, 0.72, 0], parent: 'all' },
    { name: 'spine', head: [0.04, 0.72, 0], tail: [0.04, 1.08, 0], parent: 'hips', connect: true },
    { name: 'chest', head: [0.04, 1.08, 0], tail: [0.04, 1.46, 0], parent: 'spine', connect: true },
    { name: 'head', head: [0.04, 1.5, 0], tail: [0.04, 1.9, 0.02], parent: 'chest' },
    { name: 'armL', head: [0.42, 1.42, 0], tail: [0.62, 1.07, -0.03], parent: 'chest' },
    { name: 'foreL', head: [0.62, 1.07, -0.03], tail: [0.66, 0.79, 0.03], parent: 'armL', connect: true },
    { name: 'handL', head: [0.66, 0.79, 0.03], tail: [0.64, 0.5, 0.06], parent: 'foreL', connect: true },
    { name: 'c_handL', head: [0.66, 0.79, 0.03], tail: [0.66, 0.79, 0.15], parent: 'chest', deform: false },
    { name: 'armR', head: [-0.36, 1.43, -0.02], tail: [-0.6, 1.13, -0.22], parent: 'chest' },
    { name: 'foreR', head: [-0.6, 1.13, -0.22], tail: [-0.64, 1.15, 0.14], parent: 'armR', connect: true },
    { name: 'handR', head: [-0.64, 1.15, 0.14], tail: [-0.62, 1.16, 0.32], parent: 'foreR', connect: true },
    { name: 'c_handR', head: [-0.64, 1.15, 0.14], tail: [-0.64, 1.15, 0.26], parent: 'chest', deform: false },
    { name: 'wrench', head: WR[0], tail: WR[1], parent: 'handR' },
    { name: 'wrenchTip', head: WR[1], tail: [WR[1][0], WR[1][1] - 0.1, WR[1][2]], parent: 'wrench', connect: true },   /* marks the wrench's head, for measuring where it strikes */
    { name: 'c_wrench', head: WR[0], tail: WR[1], parent: 'all', deform: false },
    ...leg('L', 0.28), ...leg('R', -0.19)],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
  copyrot: [{ bone: 'wrench', from: 'c_wrench' }],
  /* the wrench below the hand, its whole depth (z 0.03 to 0.37). It is told from the trouser leg and boot by how far out it
     sits: measured from the mesh, the wrench is at x -0.44 and beyond below the knee, the leg never past -0.42 and the boot's
     sole edge at -0.45, so the cut is at -0.43 above boot height and -0.465 at the boot. (Before 2026-11-11 the lower box
     started at z 0.175, which left the back half of the jaw on the leg: it stretched into strips whenever the wrench moved.) */
  rigid: [{ bone: 'wrench', box: [[-0.84, 0.2, -0.05], [-0.43, 0.93, 0.6]] }, { bone: 'wrench', box: [[-0.84, -0.05, -0.05], [-0.465, 0.2, 0.6]], skipDark: 0.1 }, { bone: 'wrench', box: [[-0.7, 0.93, 0.15], [-0.5, 1.0, 0.4]], detach: [-0.1, 0.92], only: true }],   /* and the bit of handle just under the fist; below the fist the wrench is cut free of the leg and boot it touches */
  poses: {
    stand: { all: {}, hips: {}, spine: {}, chest: {}, head: {}, c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {}, c_wrench: {} },
    ready: { c_wrench: R(-28), c_handR: M(0.04, 0.02, 0.04) },   /* the wrench lifted off the floor, angled ahead */
    crouch: { hips: M(0, -0.26, 0), spine: R(14), chest: R(10), head: R(-12), c_wrench: R(-36), c_handL: M(0, -0.05, 0.1) },
    tuck: { hips: M(0, 0.04, 0), spine: R(22), chest: R(16), head: R(10), c_footL: M(0, 0.3, 0.12), c_footR: M(0, 0.3, 0.12), c_handL: M(-0.2, 0.2, 0.3), c_handR: M(0.14, -0.1, 0.1), c_wrench: R(-62) } },
  clips: {
    Idle: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.6, pose: { spine: R(1.5), chest: R(2), head: R(-1.5), c_handL: M(0, -0.012, 0.01) } }, { t: 1.2, pose: { spine: R(0), chest: R(0), head: R(0, 5), c_handL: M(0, 0, 0) } },
      { t: 1.8, pose: { spine: R(1.5), chest: R(2), head: R(-1.5, 5), c_handL: M(0, -0.012, 0.01) } }, { t: 2.4, pose: { spine: R(0), chest: R(0), head: R(0), c_handL: M(0, 0, 0) } }] },
    Walk: { fps: 30, keys: [
      { t: 0, use: ['stand', 'ready'], pose: { hips: M(0, -0.02, 0), chest: R(4, 6), c_footL: M(0, 0, 0.2), c_footR: M(0, 0.03, -0.18), c_handL: M(0, 0.03, -0.14) } },
      { t: 0.25, pose: { hips: M(0, 0, 0), chest: R(4, 0), c_footL: M(0, 0, 0), c_footR: M(0, 0.1, 0.02), c_handL: M(0, 0, 0) } },
      { t: 0.5, pose: { hips: M(0, -0.02, 0), chest: R(4, -6), c_footL: M(0, 0.03, -0.18), c_footR: M(0, 0, 0.2), c_handL: M(0, 0.03, 0.14) } },
      { t: 0.75, pose: { hips: M(0, 0, 0), chest: R(4, 0), c_footL: M(0, 0.1, 0.02), c_footR: M(0, 0, 0), c_handL: M(0, 0, 0) } },
      { t: 1.0, pose: { hips: M(0, -0.02, 0), chest: R(4, 6), c_footL: M(0, 0, 0.2), c_footR: M(0, 0.03, -0.18), c_handL: M(0, 0.03, -0.14) } }] },
    Run: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { hips: M(0, -0.05, 0.05), spine: R(8), chest: R(10, 10), head: R(-10), c_wrench: R(38), c_handR: M(0, 0, -0.1), c_footL: M(0, 0.02, 0.3), c_footR: M(0, 0.12, -0.26), c_handL: M(0, 0.12, -0.24) } },
      { t: 0.175, pose: { hips: M(0, 0.0, 0.05), chest: R(10, 0), c_footL: M(0, 0, 0.02), c_footR: M(0, 0.2, 0.04), c_handL: M(0, 0.06, 0) } },
      { t: 0.35, pose: { hips: M(0, -0.05, 0.05), chest: R(10, -10), c_footL: M(0, 0.12, -0.26), c_footR: M(0, 0.02, 0.3), c_handL: M(0, 0.12, 0.24) } },
      { t: 0.525, pose: { hips: M(0, 0.0, 0.05), chest: R(10, 0), c_footL: M(0, 0.2, 0.04), c_footR: M(0, 0, 0.02), c_handL: M(0, 0.06, 0) } },
      { t: 0.7, pose: { hips: M(0, -0.05, 0.05), chest: R(10, 10), c_footL: M(0, 0.02, 0.3), c_footR: M(0, 0.12, -0.26), c_handL: M(0, 0.12, -0.24) } }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'crouch' }] },
    Rise: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, 0.02, 0), chest: R(-6), head: R(-8), c_footR: M(0, 0.16, 0.08), c_handL: M(0.05, 0.36, 0.1), c_wrench: R(-22) } }, { t: 0.4, pose: { c_footR: M(0, 0.08, 0.04), c_handL: M(0.05, 0.2, 0.05) } }] },
    Fall: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { chest: R(6), head: R(8), c_footL: M(0, 0.1, 0.06), c_footR: M(0, 0.05, -0.04), c_handL: M(0.12, 0.5, 0), c_handR: M(-0.05, 0.12, -0.05), c_wrench: R(24) } },
      { t: 0.25, pose: { c_footL: M(0, 0.05, -0.04), c_footR: M(0, 0.1, 0.06), c_handL: M(0.12, 0.56, 0.04), c_wrench: R(30) } },
      { t: 0.5, pose: { c_footL: M(0, 0.1, 0.06), c_footR: M(0, 0.05, -0.04), c_handL: M(0.12, 0.5, 0), c_wrench: R(24) } }] },
    Land: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, -0.3, 0), spine: R(18), chest: R(12), head: R(-10), c_wrench: R(-30), c_handL: M(0, -0.1, 0.12) } }, { t: 0.18, pose: { hips: M(0, -0.08, 0), spine: R(6), chest: R(4), head: R(-4) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, pose: { hips: M(0, -0.12, 0), spine: R(8), head: R(6), c_handR: M(0.1, 0.2, 0.4), c_wrench: R(0, 0, 78), c_handL: M(-0.5, 0.56, 0.5) } }] },   /* the wrench held across him */
    Hit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, 0, -0.08), spine: R(-14), chest: R(-12), head: R(-16), c_handL: M(0.12, 0.4, -0.12), c_handR: M(-0.06, 0.15, -0.15), c_wrench: R(36), c_footL: M(0, 0.06, 0.12) } },
      { t: 0.3, pose: { spine: R(-8), chest: R(-6), head: R(-6) } }, { t: 0.6, reset: true, use: 'stand' }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(28), chest: R(20) } }, { t: 0.6, pose: { spine: R(22), chest: R(16) } }] },
    Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(-50) } }, { t: 0.3, pose: { all: RM(-90, 0, 0, 0, 0.36, 0.9), c_handL: M(0.15, 0.1, 0), head: R(-6) } }] },
    Dodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.14, pose: { all: R(0, 35), hips: M(0, -0.05, -0.18), spine: R(-12), chest: R(-8), c_wrench: R(-30), c_handL: M(0, 0.2, -0.1) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Ledge: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { chest: R(-4), c_handL: M(-0.25, 1.2, 0.3), c_handR: M(0, -0.25, -0.05), c_wrench: R(8), c_footL: M(0, 0, 0.04), c_footR: M(0, 0.06, -0.04) } },
      { t: 0.6, pose: { c_footL: M(0, 0.04, -0.04), c_footR: M(0, 0, 0.04), c_wrench: R(-6) } }, { t: 1.2, pose: { c_footL: M(0, 0, 0.04), c_footR: M(0, 0.06, -0.04), c_wrench: R(8) } }] },
    Hold: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { chest: R(4, -12), c_handL: M(-0.3, 0.52, 0.62), c_wrench: R(20) } }, { t: 0.3, pose: { chest: R(6, -14), c_handL: M(-0.3, 0.5, 0.64) } }, { t: 0.6, pose: { chest: R(4, -12), c_handL: M(-0.3, 0.52, 0.62) } }] },
    Held: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, 0.06, 0), head: R(-10), c_footL: M(0, 0.02, 0.08), c_footR: M(0, 0.06, -0.05), c_handL: M(0.1, 0.35, 0.05), c_wrench: R(15) } },
      { t: 0.25, pose: { c_footL: M(0, 0.06, -0.05), c_footR: M(0, 0.02, 0.08), c_handL: M(0.1, 0.42, 0), c_wrench: R(-10) } }, { t: 0.5, pose: { c_footL: M(0, 0.02, 0.08), c_footR: M(0, 0.06, -0.05), c_handL: M(0.1, 0.35, 0.05), c_wrench: R(15) } }] },
    /* ---- attacks ---- */
    Jab: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* a short left */
      { t: 0.1, pose: { chest: R(0, 10), c_handL: M(-0.1, 0.4, 0.05) } }, { t: 0.17, pose: { chest: R(2, -16), hips: M(0, -0.02, 0.06), c_handL: M(-0.32, 0.56, 0.64) } },
      { t: 0.27, pose: { c_handL: M(-0.32, 0.56, 0.66) } }, { t: 0.5, reset: true, use: ['stand', 'ready'] }] },
    Shove: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* the elbow and shoulder that ends the jabs, and the throws */
      { t: 0.15, pose: { chest: R(-4, 6), c_handL: M(-0.15, 0.35, 0.1) } }, { t: 0.25, pose: { hips: M(0, -0.04, 0.14), chest: R(12, -12), c_handL: M(-0.32, 0.5, 0.66), c_handR: M(0.2, 0.1, 0.3), c_wrench: R(-50) } },
      { t: 0.36, pose: { hips: M(0, -0.04, 0.16) } }, { t: 0.7, reset: true, use: ['stand', 'ready'] }] },
    Poke: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Box-End Check: the wrench straight out */
      { t: 0.2, pose: { hips: M(0, -0.03, -0.05), chest: R(0, -18), c_handR: M(0.05, 0.05, -0.2), c_wrench: R(-75) } },
      { t: 0.3, pose: { hips: M(0, -0.04, 0.1), chest: R(4, 22), c_handR: M(0.28, 0.12, 0.5), c_wrench: R(-92), c_footL: M(0, 0, 0.12) } },
      { t: 0.42, pose: { c_handR: M(0.28, 0.12, 0.52) } }, { t: 0.8, reset: true, use: ['stand', 'ready'] }] },
    Crank: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Overhead Crank: up in front, over the shoulder, down behind */
      { t: 0.24, pose: { chest: R(-4, -8), c_handR: M(0.2, 0.35, 0.3), c_wrench: R(-120) } }, { t: 0.36, pose: { chest: R(-8, 6), c_handR: M(0.18, 0.62, 0.05), c_wrench: R(-178) } },
      { t: 0.5, pose: { chest: R(-12, 10), head: R(-10), c_handR: M(0.1, 0.55, -0.2), c_wrench: R(140) } }, { t: 0.9, reset: true, use: ['stand', 'ready'] }] },
    Scrape: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Floor Scrape: a low hook across the floor */
      { t: 0.22, use: 'crouch', pose: { c_handR: M(0.1, -0.62, 0.1), c_wrench: R(-70, -35) } }, { t: 0.32, pose: { chest: R(14, 16), c_handR: M(0.25, -0.68, 0.4), c_wrench: R(-80, 30) } },
      { t: 0.42, pose: { c_wrench: R(-80, 36) } }, { t: 0.75, reset: true, use: ['stand', 'ready'] }] },
    Slide: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Steel-Toe Slide: boot first */
      { t: 0.2, pose: { all: R(-40), hips: M(0, -0.05, 0), c_footL: M(0, 0.05, 0.2), c_wrench: R(30), c_handL: M(0.1, 0.2, -0.2) } },
      { t: 0.35, pose: { all: R(-62), chest: R(20), head: R(14), c_footL: M(0, 0.02, 0.3), c_footR: M(0, 0.12, -0.05) } }, { t: 0.6, pose: { all: R(-60) } }, { t: 0.9, reset: true, use: ['stand', 'ready'] }] },
    Hammer: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Two-Handed Hammer: a clear backswing, then everything he has */
      { t: 0.3, pose: { hips: M(0, 0, -0.08), spine: R(-10), chest: R(-12, -14), head: R(-6), c_handR: M(0.3, 0.6, -0.12), c_handL: M(-0.78, 0.78, 0.02), c_wrench: R(150) } },
      { t: 0.5, pose: { chest: R(-14, -16), c_wrench: R(156) } },
      { t: 0.6, pose: { hips: M(0, -0.14, 0.14), spine: R(18), chest: R(22, 10), head: R(4), c_handR: M(0.3, -0.3, 0.52), c_handL: M(-0.72, -0.12, 0.6), c_wrench: R(-72), c_footL: M(0, 0, 0.16) } },
      { t: 0.75, pose: { c_wrench: R(-66) } }, { t: 1.2, reset: true, use: ['stand', 'ready'] }] },
    Jack: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Jack Stand: scooped up in front with both hands */
      { t: 0.3, use: 'crouch', pose: { c_handR: M(0.25, -0.35, 0.35), c_handL: M(-0.7, -0.05, 0.45), c_wrench: R(-55) } },
      { t: 0.42, reset: true, use: 'stand', pose: { hips: M(0, 0.02, 0.04), spine: R(-6), chest: R(-8), head: R(-14), c_handR: M(0.28, 0.66, 0.2), c_handL: M(-0.72, 0.9, 0.22), c_wrench: R(-176) } },
      { t: 0.58, pose: { c_handR: M(0.28, 0.68, 0.18) } }, { t: 1.0, reset: true, use: ['stand', 'ready'] }] },
    BenchSweep: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Sweep the Bench: low in front, then the boot behind */
      { t: 0.28, use: 'crouch', pose: { c_handR: M(0.1, -0.6, 0.05), c_wrench: R(-72, -40) } }, { t: 0.38, pose: { chest: R(14, 18), c_handR: M(0.25, -0.66, 0.4), c_wrench: R(-80, 35) } },
      { t: 0.5, pose: { hips: M(0, -0.16, 0.1), chest: R(26, -10), c_handR: M(0.1, -0.3, 0.3), c_wrench: R(-40), c_footR: M(0, 0.12, -0.3) } },
      { t: 0.62, pose: { chest: R(34, -14), head: R(-20), c_footR: M(0, 0.22, -0.78) } }, { t: 0.74, pose: { c_footR: M(0, 0.24, -0.8) } }, { t: 1.2, reset: true, use: ['stand', 'ready'] }] },
    Turn: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] },   /* Tool Belt Turn: knees up, once round */
      { t: 0.2, pose: { all: R(0, 120) } }, { t: 0.4, pose: { all: R(0, 240) } }, { t: 0.6, pose: { all: R(0, 360) } }, { t: 0.8, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
    Arc: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Open-End Swing: from overhead down through the front */
      { t: 0.25, pose: { chest: R(-8, -10), c_handR: M(0.2, 0.6, 0), c_wrench: R(-178) } }, { t: 0.37, pose: { chest: R(10, 16), c_handR: M(0.3, 0.3, 0.5), c_wrench: R(-95) } },
      { t: 0.5, pose: { c_handR: M(0.3, -0.1, 0.45), c_wrench: R(-40) } }, { t: 0.9, reset: true, use: ['stand', 'ready'] }] },
    Heel: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Heel of the Boot: a kick out behind */
      { t: 0.3, pose: { hips: M(0, 0.05, 0), chest: R(18), c_footR: M(0, 0.2, 0.1) } },
      { t: 0.4, pose: { all: R(22), chest: R(26), head: R(-24), c_footR: M(0, 0.3, -0.8), c_handL: M(0, 0.2, 0.3), c_wrench: R(-50) } }, { t: 0.52, pose: { c_footR: M(0, 0.32, -0.82) } }, { t: 0.9, reset: true, use: ['stand', 'ready'] }] },
    Flip: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Crank Flip: a short lift straight up */
      { t: 0.3, pose: { c_handR: M(0.2, 0.2, 0.3), c_wrench: R(-110) } }, { t: 0.4, pose: { chest: R(-10), head: R(-16), c_handR: M(0.2, 0.68, 0.1), c_wrench: R(-178) } },
      { t: 0.52, pose: { c_handR: M(0.15, 0.66, 0), c_wrench: R(165) } }, { t: 0.8, reset: true, use: ['stand', 'ready'] }] },
    Drop: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Drop the Hammer: lifted high, then driven straight down */
      { t: 0.3, pose: { chest: R(-10), c_handR: M(0.25, 0.62, 0), c_handL: M(-0.75, 0.8, 0.05), c_wrench: R(160), c_footL: M(0, 0.2, 0.1), c_footR: M(0, 0.2, 0.1) } },
      { t: 0.4, pose: { chest: R(8), c_handR: M(0.3, 0.3, 0.4), c_handL: M(-0.72, 0.4, 0.45), c_wrench: R(-100) } },
      { t: 0.48, pose: { hips: M(0, 0.1, 0), chest: R(24), c_handR: M(0.32, -0.28, 0.3), c_handL: M(-0.7, -0.1, 0.4), c_wrench: R(-8), c_footL: M(0, 0.3, -0.1), c_footR: M(0, 0.3, -0.1) } },
      { t: 0.6, pose: { c_wrench: R(-4) } }, { t: 1.0, reset: true, use: ['stand', 'ready'] }] },
    Reach: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Glove Grip */
      { t: 0.2, pose: { chest: R(0, 8), c_handL: M(-0.05, 0.3, 0) } }, { t: 0.36, pose: { hips: M(0, -0.03, 0.1), chest: R(8, -18), c_handL: M(-0.3, 0.52, 0.68) } },
      { t: 0.48, pose: { c_handL: M(-0.3, 0.52, 0.7) } }, { t: 0.8, reset: true, use: ['stand', 'ready'] }] },
    Flick: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Tape Roll: an underhand flick along the floor */
      { t: 0.25, pose: { hips: M(0, -0.16, 0), spine: R(14), chest: R(6, 12), c_handL: M(-0.1, -0.2, -0.3) } }, { t: 0.4, pose: { hips: M(0, -0.2, 0.06), chest: R(16, -16), c_handL: M(-0.3, -0.25, 0.6) } },
      { t: 0.5, pose: { c_handL: M(-0.3, -0.1, 0.66) } }, { t: 0.95, reset: true, use: ['stand', 'ready'] }] },
    Hook: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Hook Wrench: lead foot planted, the open end reaching up and ahead, then tugged in */
      { t: 0.3, pose: { chest: R(0, -16), c_handR: M(0.1, 0, -0.15), c_wrench: R(-60) } },
      { t: 0.42, pose: { hips: M(0, -0.06, 0.14), chest: R(-6, 20), head: R(-10), c_footL: M(0, 0, 0.28), c_handR: M(0.28, 0.5, 0.42), c_wrench: R(-132) } },
      { t: 0.52, pose: { c_handR: M(0.26, 0.46, 0.3), c_wrench: R(-150) } }, { t: 1.0, reset: true, use: ['stand', 'ready'] }] },
  Ratchet: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Ratchet Spin: twice round under the raised wrench */
      { t: 0.2, pose: { hips: M(0, -0.2, 0), c_handR: M(0.2, 0.3, 0.2), c_wrench: R(-150) } },
      { t: 0.3, pose: { all: R(0, 150), hips: M(0, 0.05, 0), c_handR: M(0.25, 0.66, 0.05), c_wrench: R(-160), c_footL: M(0, 0.1, 0.05), c_footR: M(0, 0.2, 0.1) } },
      { t: 0.45, pose: { all: R(0, 300) } }, { t: 0.6, pose: { all: R(0, 450) } }, { t: 0.75, pose: { all: R(0, 600) } }, { t: 0.9, pose: { all: R(0, 720) } }, { t: 1.0, reset: true, use: ['stand', 'ready'], pose: { all: R(0, 720) } }] },
    Vise: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* Bench Vise: a step in with the open wrench held out to close on someone */
      { t: 0.25, pose: { chest: R(0, -10), c_handR: M(0.1, 0, -0.1), c_wrench: R(-80) } },
      { t: 0.4, pose: { hips: M(0, -0.08, 0.08), chest: R(8, 16), c_footL: M(0, 0, 0.16), c_handR: M(0.3, -0.12, 0.24), c_wrench: R(-78) } }, { t: 0.5, pose: { c_handR: M(0.3, -0.12, 0.26) } }, { t: 1.1, reset: true, use: ['stand', 'ready'] }] },
  },
};

/* ---- every state and move with its own clip (2026-11-11): air jump, fast fall, helpless, hard landing, shield and heavy
   hits, launches, air dodge, roll, pummel, four throws, his own second jab and get-up attack, an idle fiddle, a respawn pose ---- */
const HOLD = { chest: R(4, -12), c_handL: M(-0.3, 0.52, 0.62), c_wrench: R(20) };
Object.assign(sprocket.clips, {
  IdleFiddle: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* now and then: lifts the wrench, eyes the jaw, gives it two taps and a twirl */
    { t: 0.5, pose: { head: R(14, -10), chest: R(4, -8), c_handR: M(0.22, 0.42, 0.22), c_wrench: R(-150), c_handL: M(-0.2, 0.42, 0.3) } },
    { t: 0.9, pose: { head: R(18, -14), c_handL: M(-0.42, 0.62, 0.34) } }, { t: 1.0, pose: { c_handL: M(-0.4, 0.56, 0.32) }, in: 'snap' },
    { t: 1.1, pose: { c_handL: M(-0.42, 0.62, 0.34) }, in: 'out' }, { t: 1.2, pose: { c_handL: M(-0.4, 0.56, 0.32) }, in: 'snap' },
    { t: 1.5, pose: { head: R(4, 6), c_handL: M(0, 0.05, 0), c_wrench: R(-200) } }, { t: 1.75, pose: { c_wrench: R(-330) } }, { t: 2.0, pose: { c_wrench: R(-450), c_handR: M(0.15, 0.25, 0.15) } },
    { t: 2.3, pose: { head: R(-4), chest: R(-2), c_handR: M(0.04, 0.02, 0.04), c_wrench: R(-388) }, in: 'back' }, { t: 3.0, reset: true, use: ['stand', 'ready'] }] },
  Respawn: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { chest: R(-4), head: R(-6), c_handR: M(0.12, 0.58, -0.1), c_wrench: R(150), c_handL: M(-0.08, 0.05, -0.12) } },   /* wrench on his shoulder, waiting */
    { t: 1.0, pose: { chest: R(-2, 6), head: R(-4, 10) } }, { t: 2.0, pose: { chest: R(-4), head: R(-6) } }] },
  AirJump: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { c_wrench: R(-100) } },   /* the second jump: knees to chest, then a hard kick downward off thin air, wrench flung up */
    { t: 0.1, pose: { spine: R(28), chest: R(20), c_footL: M(0, 0.4, 0.16), c_footR: M(0, 0.4, 0.16) } },
    { t: 0.2, reset: true, use: 'stand', pose: { spine: R(-10), chest: R(-12), head: R(-16), c_footL: M(0, -0.04, -0.04), c_footR: M(0, -0.02, -0.08), c_handL: M(0.16, 0.62, 0.02), c_handR: M(0.15, 0.5, 0), c_wrench: R(-170) }, in: 'snap' },
    { t: 0.5, reset: true, use: 'stand', pose: { chest: R(-6), head: R(-8), c_handL: M(0.12, 0.42, 0), c_wrench: R(-30), c_footR: M(0, 0.12, 0.06) }, in: 'back' }] },
  FastFall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, 0.04, 0), chest: R(-4), head: R(12), c_handL: M(0.16, 0.62, 0.02), c_handR: M(0.12, 0.5, -0.05), c_wrench: R(176), c_footL: M(0, 0.02, 0.02), c_footR: M(0, 0.04, -0.02) } },   /* boots first, wrench straight up */
    { t: 0.2, pose: { c_handL: M(0.18, 0.66, 0), c_wrench: R(170) } }, { t: 0.4, pose: { c_handL: M(0.16, 0.62, 0.02), c_wrench: R(176) } }] },
  Helpless: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { spine: R(-6), chest: R(-10), head: R(-14), c_handL: M(0.2, 0.5, 0.2), c_handR: M(0.1, 0.3, -0.2), c_wrench: R(60), c_footL: M(0, 0.2, 0.1), c_footR: M(0, 0.05, -0.1) } },   /* spent: arms and wrench flailing */
    { t: 0.3, pose: { c_handL: M(0.2, 0.62, -0.2), c_handR: M(0.1, 0.45, 0.2), c_wrench: R(-60), c_footL: M(0, 0.05, -0.1), c_footR: M(0, 0.2, 0.1), head: R(-8, 10) } },
    { t: 0.6, pose: { c_handL: M(0.2, 0.5, 0.2), c_handR: M(0.1, 0.3, -0.2), c_wrench: R(60), c_footL: M(0, 0.2, 0.1), c_footR: M(0, 0.05, -0.1), head: R(-14) } }] },
  LandHard: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, -0.4, 0), spine: R(26), chest: R(18), head: R(-18), c_wrench: R(-10), c_handR: M(0.2, -0.3, 0.3), c_handL: M(-0.1, -0.35, 0.3) } },   /* a deep squat, wrench to the floor */
    { t: 0.12, pose: { hips: M(0, -0.44, 0), spine: R(30) } }, { t: 0.3, pose: { hips: M(0, -0.14, 0), spine: R(8), chest: R(4), head: R(-4), c_wrench: R(-30) } }, { t: 0.45, reset: true, use: ['stand', 'ready'] }] },
  ShieldHit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { hips: M(0, -0.12, 0), spine: R(8), head: R(6), c_handR: M(0.1, 0.2, 0.4), c_wrench: R(0, 0, 78), c_handL: M(-0.5, 0.56, 0.5) } },
    { t: 0.06, pose: { hips: M(0, -0.16, -0.1), spine: R(-6), head: R(-6), c_handR: M(0.1, 0.22, 0.3), c_handL: M(-0.5, 0.58, 0.4) }, in: 'out' },
    { t: 0.3, pose: { hips: M(0, -0.12, 0), spine: R(8), head: R(6), c_handR: M(0.1, 0.2, 0.4), c_handL: M(-0.5, 0.56, 0.5) } }] },
  HitHeavy: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(-18), hips: M(0, 0, -0.14), spine: R(-22), chest: R(-18), head: R(-28), c_handL: M(0.3, 0.62, -0.2), c_handR: M(-0.05, 0.4, -0.3), c_wrench: R(70), c_footL: M(0, 0.18, 0.22), c_footR: M(0, 0.04, 0.05) } },
    { t: 0.3, pose: { all: R(-8), spine: R(-12), chest: R(-8), head: R(-10), c_footL: M(0, 0.04, 0.1) } }, { t: 0.8, reset: true, use: 'stand' }] },
  LaunchUp: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(-14), spine: R(-14), chest: R(-12), head: R(-30), c_handL: M(0.2, -0.05, -0.15), c_handR: M(-0.05, -0.1, -0.2), c_wrench: R(30), c_footL: M(0, 0.04, -0.06), c_footR: M(0, 0.1, 0.06) } },   /* flung upward: limbs trail below */
    { t: 0.6, pose: { all: R(-6), head: R(-14), c_handL: M(0.2, 0.2, -0.05), c_wrench: R(60) } }] },
  Spike: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(14), spine: R(30), chest: R(22), head: R(30), c_handL: M(0.1, 0.6, -0.1), c_handR: M(0.1, 0.5, -0.1), c_wrench: R(150), c_footL: M(0, 0.2, -0.2), c_footR: M(0, 0.25, -0.12) } },   /* driven down, folded over */
    { t: 0.6, pose: { all: R(10), spine: R(20), head: R(16) } }] },
  Launch: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(-12), hips: M(0, 0, -0.1), spine: R(-24), chest: R(-18), head: R(-28), c_handL: M(0.3, 0.5, -0.3), c_handR: M(0, 0.3, -0.35), c_wrench: R(80), c_footL: M(0, 0.25, 0.3), c_footR: M(0, 0.1, 0.12) } },   /* knocked flying: arched back, limbs flung (the game spins him) */
    { t: 0.25, pose: { spine: R(-14), chest: R(-8), c_footL: M(0, 0.3, 0.2), c_handL: M(0.3, 0.6, -0.1) } }, { t: 0.5, pose: { all: R(-6), spine: R(6), chest: R(8), head: R(0), c_footL: M(0, 0.3, 0.1) } }] },
  AirDodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.1, use: ['stand', 'tuck'], pose: { all: R(0, 120) } }, { t: 0.2, pose: { all: R(0, 240) } }, { t: 0.3, pose: { all: R(0, 359) } },   /* a corkscrew out of the way */
    { t: 0.5, reset: true, use: 'stand', pose: { chest: R(-4), c_handL: M(0.1, 0.3, 0), c_wrench: R(20) } }] },
  Roll: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { hips: M(0, -0.2, 0), spine: R(30), chest: R(24), head: R(24), c_wrench: R(-10) } }, { t: 0.5, pose: { spine: R(34), chest: R(26) } }] },   /* tucked tight: the game turns him over */
  Pummel: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLD },   /* a knee to whoever he is holding */
    { t: 0.12, pose: { chest: R(-6, -12), head: R(-8), c_footR: M(0, 0.04, -0.12) } }, { t: 0.2, pose: { chest: R(12, -12), head: R(10), c_footR: M(0, 0.42, 0.34), hips: M(0, 0.02, 0.06) }, in: 'snap' },
    { t: 0.4, pose: { chest: R(4, -12), head: R(0), c_footR: M(0, 0, 0), hips: M(0, 0, 0) } }] },
  ThrowF: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLD },   /* forward: lifts the wrench and bonks them away */
    { t: 0.16, pose: { chest: R(-10, -6), head: R(-8), c_handR: M(0.25, 0.62, -0.1), c_wrench: R(165) } },
    { t: 0.26, pose: { hips: M(0, -0.08, 0.14), chest: R(18, 14), head: R(6), c_handR: M(0.3, 0.1, 0.5), c_handL: M(-0.2, 0.2, 0.2), c_wrench: R(-80), c_footL: M(0, 0, 0.16) }, in: 'snap' },
    { t: 0.4, pose: { c_wrench: R(-76) } }, { t: 0.75, reset: true, use: ['stand', 'ready'] }] },
  ThrowB: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLD },   /* back: hauls them round and heaves them over his shoulder */
    { t: 0.12, pose: { all: R(0, 60), chest: R(-6, -20), c_handL: M(-0.3, 0.7, 0.4) } }, { t: 0.24, pose: { all: R(0, 150), chest: R(-16, 10), head: R(-14), c_handL: M(-0.1, 0.9, -0.2), c_handR: M(0.1, 0.4, -0.2), c_wrench: R(120) }, in: 'snap' },
    { t: 0.4, pose: { all: R(0, 180), chest: R(10, 10), c_handL: M(-0.1, 0.4, -0.5) } }, { t: 0.6, pose: { all: R(0, 300) } }, { t: 0.8, reset: true, use: ['stand', 'ready'], pose: { all: R(0, 359) } }] },
  ThrowU: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLD },   /* up: a squat, then both hands and the wrench drive them skyward */
    { t: 0.14, use: 'crouch', pose: { c_handL: M(-0.5, 0.1, 0.4), c_handR: M(0.2, -0.2, 0.4), c_wrench: R(-60) } },
    { t: 0.26, reset: true, use: 'stand', pose: { hips: M(0, 0.06, 0), spine: R(-8), chest: R(-12), head: R(-24), c_handL: M(-0.6, 0.95, 0.15), c_handR: M(0.25, 0.7, 0.1), c_wrench: R(-178), c_footL: M(0, 0.06, 0), c_footR: M(0, 0.06, 0) }, in: 'snap' },
    { t: 0.45, pose: { c_wrench: R(175) } }, { t: 0.8, reset: true, use: ['stand', 'ready'] }] },
  ThrowD: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLD },   /* down: slams them to the floor and hammers them flat */
    { t: 0.12, pose: { chest: R(-8), c_handL: M(-0.3, 0.7, 0.5), c_handR: M(0.25, 0.6, -0.05), c_wrench: R(160) } },
    { t: 0.24, pose: { hips: M(0, -0.24, 0.06), spine: R(20), chest: R(24), head: R(10), c_handL: M(-0.4, -0.3, 0.55), c_handR: M(0.3, -0.25, 0.4), c_wrench: R(-20) }, in: 'snap' },
    { t: 0.36, pose: { c_wrench: R(-12), hips: M(0, -0.28, 0.06) } }, { t: 0.75, reset: true, use: ['stand', 'ready'] }] },
  Jab2: { fps: 30, keys: [{ t: 0, use: ['stand', 'ready'] },   /* the follow-up: a short, sharp jab with the wrench thrust straight out */
    { t: 0.1, pose: { chest: R(0, -12), c_handR: M(0.02, 0.15, -0.12), c_wrench: R(-34) } },
    { t: 0.17, pose: { hips: M(0, -0.02, 0.08), chest: R(4, 18), c_handR: M(0.12, 0.24, 0.46), c_wrench: R(-96), c_handL: M(0, 0.05, -0.1) }, in: 'snap' },
    { t: 0.27, pose: { c_handR: M(0.12, 0.24, 0.5) } }, { t: 0.5, reset: true, use: ['stand', 'ready'] }] },
  GetupSwing: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: RM(-90, 0, 0, 0, 0.36, 0.9), head: R(-6), c_handL: M(0.15, 0.1, 0) } },   /* off his back: a wrench sweep in front, then one behind */
    { t: 0.22, reset: true, use: 'crouch', pose: { hips: M(0, -0.3, 0), c_handR: M(0.1, -0.5, 0), c_wrench: R(-70, -40) } },
    { t: 0.38, pose: { chest: R(14, 20), c_handR: M(0.3, -0.62, 0.45), c_wrench: R(-84, 30) }, in: 'snap' },
    { t: 0.55, pose: { chest: R(14, -60), c_handR: M(0.3, -0.62, -0.4), c_wrench: R(80, 30) }, in: 'snap' },
    { t: 0.74, pose: { c_wrench: R(86, 36) } }, { t: 1.0, reset: true, use: ['stand', 'ready'] }] },
});

/* ---- motion capture (2026-11-11): clips built from Mixamo motions, retargeted by tools/blender/mocap.py into
   assets/sprocket/mocap/<name>.json (per-frame keys). MOCAP(name, o) makes a clip's keys from one:
     o.from / o.to   the part of the capture used, in its own seconds
     o.warp          [[capture s, clip s], ...] retimes it (piecewise straight); default: plays from..to at o.speed (1)
     o.add           { bone: pose } added on top of every frame (rot adds a turn, move adds an offset)
     o.loop          the last frame blends back into the first over o.loop seconds (for idles, walks and runs)
   Keys come out every frame of the clip (30 a second), so rig.py's easing is not used: the capture is the in-between. ---- */
/* o.yaw scales how far the whole body turns about the vertical (0.5 = half as far, so a swing that turns his back to the
   camera stays readable side-on) and o.turn adds degrees; the tool and both feet are turned with him about his hips. */
const FOOTREST = { c_footL: [0.28, 0.1, -0.03], c_footR: [-0.19, 0.1, -0.03] }, HIPREST = [0.04, 0.52, 0];
/* o.yawMax (degrees): the chest's facing is eased so it never turns much past that from side-on (soft, so a turn still
   reads as a turn); the correction turns the whole body at the hips. */
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
function unturn(pose, f, turnDeg, yawMax) {
  const h = pose.hips; if (!h || !h.qb) return pose;
  const cw = qmul(qmul(h.qb, pose.spine ? pose.spine.qb : [1, 0, 0, 0]), pose.chest ? pose.chest.qb : [1, 0, 0, 0]);   /* the chest's turn in the world */
  const [w, , , z] = cw, th = 2 * Math.atan2(z, w), th2 = th > Math.PI ? th - 2 * Math.PI : th < -Math.PI ? th + 2 * Math.PI : th;
  let want = f * th2; if (yawMax) { const m = yawMax * Math.PI / 180; want = m * Math.tanh(want / m); }
  const D = want - th2 + turnDeg * Math.PI / 180, c = Math.cos(D), s = Math.sin(D), cq = Math.cos(D / 2), sq = Math.sin(D / 2);
  const rot = v => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  const q = h.qb; h.qb = [cq * q[0] - sq * q[3], cq * q[1] - sq * q[2], cq * q[2] + sq * q[1], cq * q[3] + sq * q[0]].map(v => +v.toFixed(5));
  const hp = HIPREST.map((v, i) => v + (h.move ? h.move[i] : 0));
  for (const fb in FOOTREST) if (pose[fb] && pose[fb].move) { const r = FOOTREST[fb], p = r.map((v, i) => v + pose[fb].move[i] - hp[i]), p2 = rot(p);
    pose[fb].move = p2.map((v, i) => +(v + hp[i] - r[i]).toFixed(4)); }
  if (pose.c_wrench && pose.c_wrench.aim) pose.c_wrench.aim = rot(pose.c_wrench.aim).map(v => +v.toFixed(4));
  return pose;
}
const MOCAPDIR = path.join(__dirname, '..', '..', 'assets', 'sprocket', 'mocap');
function MOCAP(name, o) {
  o = o || {}; const d = JSON.parse(fs.readFileSync(path.join(MOCAPDIR, name + '.json'), 'utf8')), F = d.frames, sf = d.fps || 30;
  const from = o.from || 0, to = o.to !== undefined ? o.to : (F.length - 1) / sf;
  const warp = o.warp || [[from, 0], [to, (to - from) / (o.speed || 1)]];
  const src = t => { for (let i = 1; i < warp.length; i++) if (t <= warp[i][1] || i === warp.length - 1) { const [s0, d0] = warp[i - 1], [s1, d1] = warp[i]; return s0 + (s1 - s0) * Math.min(1, Math.max(0, (t - d0) / ((d1 - d0) || 1))); } };
  const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const nq = q => { const l = Math.hypot(...q); return q.map(v => +(v / l).toFixed(5)); };
  const sample = s => { const x = Math.min(F.length - 1, Math.max(0, s * sf)), i = Math.floor(x), j = Math.min(F.length - 1, i + 1), u = x - i, out = {};
    for (const b in F[i]) { const A = F[i][b], Bq = F[j][b], r = {};
      if (A.qb) { let q2 = Bq.qb; if (A.qb.reduce((s, v, k) => s + v * q2[k], 0) < 0) q2 = q2.map(v => -v); r.qb = nq(mix(A.qb, q2, u)); }
      if (A.move) r.move = mix(A.move, Bq.move, u).map(v => +v.toFixed(4));
      if (A.aim) r.aim = mix(A.aim, Bq.aim, u).map(v => +v.toFixed(4));
      out[b] = r; }
    return out; };
  const dur = warp[warp.length - 1][1], n = Math.round(dur * 30), keys = [];
  for (let k = 0; k <= n; k++) {
    const t = k / 30; let pose = sample(src(t));
    if (o.loop && t > dur - o.loop) { const u = (t - (dur - o.loop)) / o.loop, p0 = sample(src(0)); for (const b in pose) { const A = pose[b], Bp = p0[b];
      if (A.qb) { let q2 = Bp.qb; if (A.qb.reduce((s, v, i) => s + v * q2[i], 0) < 0) q2 = q2.map(v => -v); A.qb = nq(mix(A.qb, q2, u)); }
      if (A.move) A.move = mix(A.move, Bp.move, u); if (A.aim) A.aim = mix(A.aim, Bp.aim, u); } }
    if (o.yaw !== undefined || o.turn || o.yawMax) pose = unturn(pose, o.yaw === undefined ? 1 : o.yaw, o.turn || 0, o.yawMax);
    if (o.zs) for (const fb of ['c_footL', 'c_footR']) if (pose[fb] && pose[fb].move) pose[fb].move = [pose[fb].move[0], pose[fb].move[1], +(pose[fb].move[2] * o.zs).toFixed(4)];   /* longer steps: this game's fighters cover ground fast */
    if (o.noTool) pose.c_wrench = { rot: [-28, 0, 0] };   /* an unarmed capture: the wrench held as he stands ready, angled ahead */
    if (o.air) {   /* in the air: the hips stop bobbing, and the legs tuck (or, 'rel', keep the capture's kicks relative to the hips, lifted) */
      const hm = pose.hips.move || [0, 0, 0];
      for (const fb of ['c_footL', 'c_footR']) pose[fb] = { move: o.air === 'rel' ? pose[fb].move.map((v, i) => +(v - hm[i] + [0, 0.2, 0.05][i]).toFixed(4)) : [0, 0.3, 0.12] };
      pose.hips.move = [0, 0, 0];
    }
    /* o.boost: { at: [first, last] capture frames, pose: { bone: { rot, move } } } pushes the pose further there only (eased in
       over the 5 frames before and out over the 5 after): to carry a strike up into a hitbox the capture falls short of */
    if (o.boost) { const cf = src(t) * sf + 1, [b0, b1] = o.boost.at, w = cf < b0 ? Math.max(0, 1 - (b0 - cf) / 5) : cf > b1 ? Math.max(0, 1 - (cf - b1) / 5) : 1, ws = w * w * (3 - 2 * w);
      if (ws > 0) for (const bn in o.boost.pose) { const q = o.boost.pose[bn], P = pose[bn] = Object.assign({}, pose[bn]);
        if (q.rot) P.rot = q.rot.map((v, i) => +((P.rot ? P.rot[i] : 0) + v * ws).toFixed(2));
        if (q.move) P.move = q.move.map((v, i) => +((P.move ? P.move[i] : 0) + v * ws).toFixed(4)); } }
    for (const b in o.add || {}) pose[b] = Object.assign({}, pose[b], o.add[b], o.add[b].move && pose[b] && pose[b].move ? { move: pose[b].move.map((v, i) => v + o.add[b].move[i]) } : {});
    keys.push(k === 0 ? { t, use: 'stand', pose } : { t: +t.toFixed(4), pose });
  }
  return { fps: 30, keys };
}
/* which capture makes which clip. f: [first, last] capture frame used (30 a second, counted from 1); hit: the capture
   frames where the strike lands, which become the attack's contact window (the game stretches startup, contact and
   recovery onto the move's real frame data, so the capture's own timing only sets the spacing inside each part). */
const fr = n => (n - 1) / 30;
const MC = {   /* kept hand-keyed (no capture reads as well side-on, or reaches the hitbox): Shove, Pummel, Flip, Drop, Heel, Flick, Vise, the throws, Crouch/Rise/Land, Roll, AirDodge */
  Idle: ['Great_Sword_Idle', { loop: 0.3, add: { spine: R(-8) } }],
  Walk: ['Great_Sword_Walk', { loop: 0.15, zs: 2.2 }],
  Run: ['Great_Sword_Run', { loop: 0.1, zs: 2.6 }],
  Shield: ['Great_Sword_Blocking_Idle', {}],
  Hit: ['Great_Sword_Unblocked_Impact', {}],
  HitHeavy: ['Great_Sword_Head_Impact', {}],
  Fall: ['Mid-Air_Falling_Idle', { loop: 0.15, noTool: 1 }],
  Helpless: ['Mid-Air_Falling_Idle', { loop: 0.15, noTool: 1, speed: 1.6 }],
  Down: ['Male_Knocked_Down_From_A_Punch', { noTool: 1 }],
  Ledge: ['Hanging_From_A_Ledge_Idle', { loop: 0.4, noTool: 1 }],
  Dodge: ['Dodging_To_The_Right_In_Place', { noTool: 1 }],
  Jab: ['Quick_Left_Handed_Punch', { hit: [11, 15], noTool: 1 }],
  Jab2: ['Great_Sword_Hilt_Melee', { hit: [4, 9], by: ['handL', 'handR'], loose: 1 }],
  Reach: ['Jab_Punch', { hit: [13, 18], noTool: 1 }],
  Poke: ['Great_Sword_Combo_Slash', { f: [8, 42], hit: [22, 27] }],
  Hook: ['Great_Sword_Combo_Slash', { f: [40, 66], hit: [49, 54], boost: { at: [44, 54], pose: { c_wrench: R(-55), c_handR: M(0, 0.5, 0.3), chest: R(-10) } } }],
  Crank: ['Overhead_Bashing_Swing', { f: [25, 75], hit: [46, 52], boost: { at: [44, 52], pose: { c_wrench: R(35), c_handR: M(0, 0.25, 0.05) } } }],
  Hammer: ['Great_Sword_Downward_Slash', { hit: [17, 22] }],
  Jack: ['Great_Sword_Crouching_Slash', { hit: [14, 19], boost: { at: [20, 26], pose: { c_wrench: R(-40), c_handR: M(0, 0.3, -0.1), c_handL: M(0, 0.3, -0.1) } } }],
  BenchSweep: ['Left_To_Right_Spin_Attack_With_Axe', { spin: 1, hit: [25, 33] }],
  Turn: ['Great_Sword_Spin_Kick', { spin: 1, kick: 1, hit: [6, 18], air: 'rel' }],
  Arc: ['Great_Sword_Jump_Attack_From_Run', { f: [18, 55], hit: [33, 38], air: 'tuck' }],
  Slide: ['Great_Sword_Low_Slide_Attack_From_Run', { hit: [18, 40], by: ['wrenchTip', 'footL', 'footR'] }],
  Scrape: ['Sword_And_Shield_Low_Attack', { hit: [22, 27] }],
  Ratchet: ['Great_Sword_High_Spin_Attack_From_Run', { spin: 1, hit: [11, 34], air: 'tuck' }],
};
const CONTACT = {}, FIT = path.join(MOCAPDIR, 'contact.json'), fitted = fs.existsSync(FIT) ? JSON.parse(fs.readFileSync(FIT, 'utf8')) : {};   /* contact.json: windows fitted to the hitboxes by tools/fit-contact.js */
if (process.env.SPROCKET_MOCAP !== '0') for (const c in MC) {
  const [src, o] = MC[c]; if (!fs.existsSync(path.join(MOCAPDIR, src + '.json'))) { console.log('no capture yet for ' + c + ': ' + src); continue; }
  const oo = Object.assign({ yawMax: o.spin ? undefined : 40 }, o); if (o.f) { oo.from = fr(o.f[0]); oo.to = fr(o.f[1]); }
  sprocket.clips[c] = MOCAP(src, oo);
  const k = sprocket.clips[c].keys, from = oo.from || 0;
  if (o.hit) CONTACT[c] = [+(fr(o.hit[0]) - from).toFixed(3), +(fr(o.hit[1]) - from).toFixed(3), k[k.length - 1].t];
  if (o.hit && fitted[c]) CONTACT[c] = [fitted[c][0] / 30, fitted[c][1] / 30, k[k.length - 1].t];
}

const out = path.join(__dirname, '..', '..', 'assets', 'sprocket', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'mocap-clips.json'), JSON.stringify(Object.fromEntries(Object.entries(MC).map(([c, [src, o]]) => [c, Object.assign({ src }, o)])), null, 1));
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(sprocket, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/sprocket-rigged.glb', texture: 1024, out: 'export/sprocket-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + sprocket.bones.length + ' bones, ' + Object.keys(sprocket.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const entry = { file: 'assets/sprocket/export/sprocket-v1.glb', height: 14, feel: 1,
  clips: { idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'AirDodge' }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Roll', bounce: true }, ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Shove', from: 0.1, to: 0.7 }, swap: { clip: 'Tumble', bounce: true },
    idle2: { clip: 'IdleFiddle' }, respawn: { clip: 'Respawn' }, airjump: { clip: 'AirJump' }, fastfall: { clip: 'FastFall' }, helpless: { clip: 'Helpless' }, landHard: { clip: 'LandHard' },
    shieldHit: { clip: 'ShieldHit' }, hitHeavy: { clip: 'HitHeavy' }, launchUp: { clip: 'LaunchUp' }, spike: { clip: 'Spike' }, launch: { clip: 'Launch' },
    pummel: { clip: 'Pummel' }, throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'ThrowB' }, throw_u: { clip: 'ThrowU' }, throw_d: { clip: 'ThrowD' } },
  strikers: [{ bone: 'wrenchTip', ext: 0.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'handR', ext: 1.2 }, { bone: 'footL', ext: 1.8 }, { bone: 'footR', ext: 1.8 }, { bone: 'head', ext: 1.0 }],
  springs: [],
  attacks: { jab: A('Jab', 0.17, 0.27, 0, 0.5), jab2: A('Jab2', 0.17, 0.27, 0, 0.5), jab3: A('Shove', 0.25, 0.36, 0, 0.7), ftilt: A('Poke', 0.3, 0.42, 0, 0.8), utilt: A('Crank', 0.36, 0.5), dtilt: A('Scrape', 0.32, 0.42, 0, 0.75), dash: A('Slide', 0.35, 0.6),
    fsmash: A('Hammer', 0.6, 0.75, 0, 1.2), usmash: A('Jack', 0.42, 0.58, 0, 1.0), dsmash: A('BenchSweep', 0.38, 0.74, 0, 1.2),
    nair: A('Turn', 0.15, 0.6, 0, 0.8), fair: A('Arc', 0.37, 0.5), bair: A('Heel', 0.4, 0.52), uair: A('Flip', 0.4, 0.52, 0, 0.8), dair: A('Drop', 0.48, 0.6, 0, 1.0),
    grab: A('Reach', 0.36, 0.48, 0, 0.8), getup: A('GetupSwing', 0.38, 0.74, 0.22, 1.0), nspec: A('Flick', 0.4, 0.5, 0, 0.95), sspec: A('Hook', 0.42, 0.52, 0, 1.0), uspec: A('Ratchet', 0.3, 0.45, 0, 1.0), dspec: A('Vise', 0.4, 0.5, 0, 1.1), '*': A('Jab', 0.17, 0.27, 0, 0.5) } };
/* captured clips: each attack's contact window is where its capture strikes, and states shown as part of a clip use all of it */
for (const a in entry.attacks) { const c = CONTACT[entry.attacks[a].clip]; if (c) entry.attacks[a] = A(entry.attacks[a].clip, c[0], c[1], 0, c[2]); }
/* walk and run: one cycle per `stride` game units walked, so the planted foot stays put (the capture is in place: the foot
   on the floor travels back the whole forward and back range of the foot once a cycle, each foot in turn) */
const UPM = 14 / 1.9;   /* game units a metre: he is 14 units tall, 1.9 m in the model */
for (const [s, c] of [['walk', 'Walk'], ['run', 'Run']]) if (MC[c] && sprocket.clips[c].keys.length > 8) {
  const z = sprocket.clips[c].keys.map(k => k.pose.c_footL.move[2]); entry.clips[s].stride = +(2 * (Math.max(...z) - Math.min(...z)) * UPM).toFixed(1); }
const clipLen = c => { const k = sprocket.clips[c].keys; return k[k.length - 1].t; };
for (const s of ['down', 'dodge']) { const e = entry.clips[s]; if (MC[e.clip] && CONTACT[e.clip] === undefined && sprocket.clips[e.clip].keys.length > 20) e.to = clipLen(e.clip); }
if (sprocket.clips.Hit.keys.length > 20) entry.clips.hit.to = entry.clips.dizzy.to = Math.min(0.9, clipLen('Hit'));
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current.Sprocket = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
