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
  /* the wrench below the hand: beside the boot it is told apart by being further forward */
  rigid: [{ bone: 'wrench', box: [[-0.84, 0.26, 0.02], [-0.47, 0.93, 0.6]] }, { bone: 'wrench', box: [[-0.84, -0.05, 0.175], [-0.465, 0.26, 0.6]] }],
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
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, pose: { hips: M(0, -0.12, 0), spine: R(8), head: R(6), c_handR: M(0.1, 0.05, 0.22), c_wrench: R(0, 0, 78), c_handL: M(-0.5, 0.42, 0.34) } }] },   /* the wrench held across him */
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
const out = path.join(__dirname, '..', '..', 'assets', 'sprocket', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(sprocket, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/sprocket-rigged.glb', texture: 1024, out: 'export/sprocket-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + sprocket.bones.length + ' bones, ' + Object.keys(sprocket.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const entry = { file: 'assets/sprocket/export/sprocket-v1.glb', height: 14,
  clips: { idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Shove', from: 0.1, to: 0.7 }, swap: { clip: 'Tumble', bounce: true } },
  strikers: [{ bone: 'wrenchTip', ext: 0.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'footL', ext: 1.8 }, { bone: 'footR', ext: 1.8 }, { bone: 'head', ext: 1.0 }],
  springs: [],
  attacks: { jab: A('Jab', 0.17, 0.27, 0, 0.5), jab2: A('Jab', 0.17, 0.27, 0, 0.5), jab3: A('Shove', 0.25, 0.36, 0, 0.7), ftilt: A('Poke', 0.3, 0.42, 0, 0.8), utilt: A('Crank', 0.36, 0.5), dtilt: A('Scrape', 0.32, 0.42, 0, 0.75), dash: A('Slide', 0.35, 0.6),
    fsmash: A('Hammer', 0.6, 0.75, 0, 1.2), usmash: A('Jack', 0.42, 0.58, 0, 1.0), dsmash: A('BenchSweep', 0.38, 0.74, 0, 1.2),
    nair: A('Turn', 0.15, 0.6, 0, 0.8), fair: A('Arc', 0.37, 0.5), bair: A('Heel', 0.4, 0.52), uair: A('Flip', 0.4, 0.52, 0, 0.8), dair: A('Drop', 0.48, 0.6, 0, 1.0),
    grab: A('Reach', 0.36, 0.48, 0, 0.8), getup: A('BenchSweep', 0.38, 0.74, 0, 1.2), nspec: A('Flick', 0.4, 0.5, 0, 0.95), sspec: A('Hook', 0.42, 0.52, 0, 1.0), uspec: A('Ratchet', 0.3, 0.45, 0, 1.0), dspec: A('Vise', 0.4, 0.5, 0, 1.1), '*': A('Jab', 0.17, 0.27, 0, 0.5) } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current.Sprocket = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
