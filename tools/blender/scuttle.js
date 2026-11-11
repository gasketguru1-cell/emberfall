// Writes the skeleton and animation spec for Scuttle (assets/scuttle/work/rig.json), which tools/blender/rig.py turns
// into a rigged, animated model, and adds its entry to the game's manifest.
//   node tools/blender/scuttle.js
// Then:  blender -b --factory-startup --python tools/blender/rig.py -- --mesh assets/scuttle/raw/<task>/model_url.glb
//            --spec assets/scuttle/work/rig.json --out assets/scuttle/work/scuttle-rigged.glb
//        node tools/pack.mjs assets/scuttle/work/pack.json
// A crab in a coal scuttle: one bone for the scuttle and body, a two-bone arm for the fire tongs (they stand straight up
// at rest; positive pitch swings them forward and down), a small claw, and four legs.
// Turning: positive pitch tips forward, positive yaw turns to its left, positive roll raises its left side.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
const flip = (deg, c) => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, c[0] - (c[0] * cs - c[1] * sn), c[1] - (c[0] * sn + c[1] * cs)] }; };
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const C = [0.6, -0.2];   /* the body's centre: height, forward */
const legs = (a, b) => ({ legL1: R(a), legR2: R(a), legL2: R(b), legR1: R(b) });   /* opposite corners move together */
const scuttle = {
  note: 'Scuttle: metres after prep (feet on y = 0, facing +Z). The tongs are on its +X side. Joint positions were measured from the generated mesh.',
  prep: { yaw: 0, translate: [0, 0.86, 0] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'root', head: [0, 0.4, -0.2], tail: [0, 0.6, -0.2], parent: 'all', deform: false },
    { name: 'body', head: [0, 0.4, -0.25], tail: [0, 1.3, -0.35], parent: 'root' },
    { name: 'clawArm', head: [0.5, 0.6, 0.2], tail: [0.6, 1.06, 0.6], parent: 'body' },
    { name: 'tongs', head: [0.6, 1.06, 0.6], tail: [0.6, 1.66, 0.72], parent: 'clawArm', connect: true },
    { name: 'tongsTip', head: [0.6, 1.66, 0.72], tail: [0.6, 1.76, 0.74], parent: 'tongs', connect: true },   /* marks the tip, for measuring */
    { name: 'clawS', head: [-0.35, 0.3, 0.05], tail: [-0.6, 0.15, 0.32], parent: 'body' },
    { name: 'legL1', head: [-0.4, 0.35, -0.15], tail: [-0.72, 0.02, -0.1], parent: 'root' },
    { name: 'legL2', head: [-0.35, 0.35, -0.45], tail: [-0.6, 0.02, -0.7], parent: 'root' },
    { name: 'legR1', head: [0.4, 0.35, -0.2], tail: [0.72, 0.02, -0.35], parent: 'root' },
    { name: 'legR2', head: [0.35, 0.35, -0.5], tail: [0.5, 0.02, -0.78], parent: 'root' }],
  rigid: [{ bone: 'tongs', box: [[0.45, 1.12, 0.45], [0.8, 1.8, 0.9]] }],
  poses: {
    stand: { all: {}, root: {}, body: {}, clawArm: {}, tongs: {}, clawS: {}, legL1: {}, legL2: {}, legR1: {}, legR2: {} },
    low: { root: M(0, -0.1, 0), body: R(6), legL1: R(0, 0, 14), legL2: R(0, 0, 14), legR1: R(0, 0, -14), legR2: R(0, 0, -14) },
    tuck: { body: R(20), clawArm: R(50), tongs: R(60), clawS: R(-30), legL1: R(0, 0, -30), legL2: R(0, 0, -30), legR1: R(0, 0, 30), legR2: R(0, 0, 30) } },
  clips: {
    Idle: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.5, pose: { root: M(0, -0.02, 0), body: R(2), tongs: R(8), clawS: R(0, 6) } }, { t: 1.0, pose: { root: M(0, 0, 0), body: R(0), tongs: R(0), clawS: R(0, 0) } },
      { t: 1.5, pose: { root: M(0, -0.02, 0), body: R(2), tongs: R(-6, 0, 6), clawS: R(0, -6) } }, { t: 2.0, pose: { root: M(0, 0, 0), body: R(0), tongs: R(0), clawS: R(0, 0) } }] },
    Scuttle: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(5), root: M(0, 0.01, 0), ...legs(22, -22) } }, { t: 0.15, pose: { root: M(0, -0.02, 0), ...legs(-22, 22), tongs: R(10) } }, { t: 0.3, pose: { root: M(0, 0.01, 0), ...legs(22, -22), tongs: R(0) } }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'low', pose: { root: M(0, -0.16, 0), clawArm: R(30), tongs: R(30) } }] },
    Rise: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(-10), tongs: R(-10), legL1: R(0, 0, -24), legL2: R(0, 0, -24), legR1: R(0, 0, 24), legR2: R(0, 0, 24) } }, { t: 0.4, pose: { body: R(-4), legL1: R(0, 0, -10), legL2: R(0, 0, -10), legR1: R(0, 0, 10), legR2: R(0, 0, 10) } }] },
    Fall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(8), tongs: R(-16), clawS: R(-20), ...legs(14, -14) } }, { t: 0.25, pose: { ...legs(-14, 14), tongs: R(-22) } }, { t: 0.5, pose: { ...legs(14, -14), tongs: R(-16) } }] },
    Land: { fps: 30, keys: [{ t: 0, use: 'low', pose: { root: M(0, -0.18, 0), body: R(10), tongs: R(24) } }, { t: 0.18, reset: true, use: 'stand', pose: { root: M(0, 0.03, 0) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, use: 'low', pose: { root: M(0, -0.2, 0), body: R(-14), clawArm: R(40, -40), tongs: R(50), clawS: R(-30, 30) } }] },   /* pulls in under the scuttle */
    Hit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-20, C), body: R(-10), tongs: R(-30), clawS: R(-30), ...legs(-20, 20) } }, { t: 0.3, pose: { all: flip(-10, C), tongs: R(-12) } }, { t: 0.6, reset: true, use: 'stand' }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { body: R(26), tongs: R(70) } }, { t: 0.6, pose: { body: R(20), tongs: R(60) } }] },
    Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-60, C) } }, { t: 0.3, pose: { all: RM(-170, 0, 0, 0, 1.25, -0.45), tongs: R(-20), ...legs(20, -20) } }] },   /* on its back, legs in the air */
    Dodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.14, use: 'low', pose: { all: R(0, 40), root: M(0, -0.18, -0.12), clawArm: R(40), tongs: R(40) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Hold: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(6), clawArm: R(46), tongs: R(38) } }, { t: 0.3, pose: { tongs: R(44) } }, { t: 0.6, pose: { tongs: R(38) } }] },
    Held: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, 0.08, 0), tongs: R(-20, 0, 10), ...legs(24, -24) } }, { t: 0.2, pose: { tongs: R(-20, 0, -10), ...legs(-24, 24) } }, { t: 0.4, pose: { tongs: R(-20, 0, 10), ...legs(24, -24) } }] },
    /* ---- attacks ---- */
    Snip: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* the tongs jab forward */
      { t: 0.12, pose: { body: R(-6), clawArm: R(-14), tongs: R(-10) } }, { t: 0.2, pose: { root: M(0, -0.03, 0.14), body: R(8), clawArm: R(52), tongs: R(34) } }, { t: 0.3, pose: { tongs: R(40) } }, { t: 0.55, reset: true, use: 'stand' }] },
    Jab2: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* the small claw */
      { t: 0.1, pose: { body: R(0, 14), clawS: R(10, -30) } }, { t: 0.18, pose: { all: flip(8, C), root: M(0, 0, 0.36), body: R(6, -34), clawS: R(-50, 70) }, in: 'snap' }, { t: 0.28, pose: { root: M(0, 0, 0.4), clawS: R(-52, 74) } }, { t: 0.5, reset: true, use: 'stand' }] },
    Lift: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* squats, then heaves the scuttle and tongs upward */
      { t: 0.2, use: 'low', pose: { root: M(0, -0.2, 0), clawArm: R(30), tongs: R(20) } }, { t: 0.3, reset: true, use: 'stand', pose: { root: M(0, 0.32, 0), body: R(-10), clawArm: R(-16), tongs: R(-12), legL1: R(0, 0, -26), legL2: R(0, 0, -26), legR1: R(0, 0, 26), legR2: R(0, 0, 26) } },
      { t: 0.44, pose: { root: M(0, 0.36, 0) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Sweep: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a low spin with the tongs out flat */
      { t: 0.22, use: 'low', pose: { all: R(0, -30), root: M(0, -0.16, 0), clawArm: R(70), tongs: R(30) } }, { t: 0.32, pose: { all: R(0, 150) } }, { t: 0.46, pose: { all: R(0, 320) } }, { t: 0.85, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
    Lunge: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* rears back, then throws the scuttle's weight forward behind the tongs */
      { t: 0.3, pose: { all: flip(-22, C), root: M(0, 0.02, -0.14), clawArm: R(-24), tongs: R(-20) } },
      { t: 0.4, reset: true, use: 'stand', pose: { all: flip(30, C), root: M(0, -0.04, 0.4), clawArm: R(40), tongs: R(26) } }, { t: 0.54, pose: { root: M(0, -0.05, 0.44) } }, { t: 0.95, reset: true, use: 'stand' }] },
    Spin: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { all: flip(0, C) } },   /* tucked into the scuttle, rolling forward */
      { t: 0.25, pose: { all: flip(150, C) } }, { t: 0.45, pose: { all: flip(290, C) } }, { t: 0.7, reset: true, use: 'stand', pose: { all: flip(360, C) } }] },
    Roll: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { all: flip(0, C) } },   /* twice round along the floor */
      { t: 0.2, pose: { all: flip(150, C) } }, { t: 0.35, pose: { all: flip(300, C) } }, { t: 0.5, pose: { all: flip(450, C) } }, { t: 0.65, pose: { all: flip(600, C) } }, { t: 0.8, pose: { all: flip(720, C) } }, { t: 1.0, reset: true, use: 'stand', pose: { all: flip(720, C) } }] },
    BackKick: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* tips forward and bucks the back of the scuttle out behind */
      { t: 0.28, pose: { all: flip(24, C), root: M(0, 0.04, 0.08) } }, { t: 0.38, pose: { all: flip(56, C), root: M(0, 0.06, -0.38), legL2: R(-50), legR2: R(-50), tongs: R(30) } }, { t: 0.5, pose: { root: M(0, 0.06, -0.42) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Stamp: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* drops its underside straight down */
      { t: 0.3, pose: { root: M(0, 0.12, 0), body: R(-8), tongs: R(-20), legL1: R(0, 0, 30), legL2: R(0, 0, 30), legR1: R(0, 0, -30), legR2: R(0, 0, -30) } },
      { t: 0.4, pose: { root: M(0, -0.2, 0), body: R(6), tongs: R(10), legL1: R(0, 0, -34), legL2: R(0, 0, -34), legR1: R(0, 0, 34), legR2: R(0, 0, 34) } }, { t: 0.55, pose: { root: M(0, -0.22, 0) } }, { t: 0.95, reset: true, use: 'stand' }] },
    Reach: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a long, slow reach with the tongs wide open */
      { t: 0.3, pose: { body: R(-10), root: M(0, 0, -0.1), clawArm: R(-20), tongs: R(-24) } }, { t: 0.5, pose: { root: M(0, -0.06, 0.26), body: R(12), clawArm: R(64), tongs: R(30) } }, { t: 0.6, pose: { tongs: R(36) } }, { t: 1.1, reset: true, use: 'stand' }] },
    Pop: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* squats on the jet, then shoots up */
      { t: 0.22, use: 'low', pose: { root: M(0, -0.2, 0), body: R(8) } }, { t: 0.3, reset: true, use: 'stand', pose: { root: M(0, 0.1, 0), body: R(-6), tongs: R(-14), legL1: R(0, 0, -34), legL2: R(0, 0, -34), legR1: R(0, 0, 34), legR2: R(0, 0, 34) } },
      { t: 0.5, pose: { body: R(4, 20) } }, { t: 0.7, pose: { body: R(-4, -20) } }, { t: 0.8, reset: true, use: 'stand' }] },
    Drop: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* rears up on its back legs, then brings the scuttle down flat */
      { t: 0.4, pose: { all: flip(-40, C), root: M(0, 0.22, 0), tongs: R(-30), clawS: R(-40) } }, { t: 0.58, pose: { all: flip(20, C), root: M(0, -0.16, 0.2), tongs: R(40), legL1: R(0, 0, 30), legL2: R(0, 0, 30), legR1: R(0, 0, -30), legR2: R(0, 0, -30) } },
      { t: 0.7, pose: { root: M(0, -0.18, 0.2) } }, { t: 1.4, reset: true, use: 'stand' }] },
  },
};

/* ---- every move and state with its own clip (2026-11-11). Attacks are posed to the hitboxes in hitboxes.js: forward ones
   low and ahead (y 2 to 4), up ones overhead (y 14), down air under it. ---- */
const HOLDP = { body: R(6), clawArm: R(46), tongs: R(38) };
const LEGS_UP = { legL1: R(0, 0, -34), legL2: R(0, 0, -34), legR1: R(0, 0, 34), legR2: R(0, 0, 34) }, LEGS_OUT = { legL1: R(0, 0, 26), legL2: R(0, 0, 26), legR1: R(0, 0, -26), legR2: R(0, 0, -26) };
Object.assign(scuttle.clips, {
  /* ---- attacks ---- */
  Jab3: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* the finisher: tongs drawn right back, then a lunging snap with its weight behind it */
    { t: 0.12, pose: { all: flip(-10, C), body: R(-8), clawArm: R(-26), tongs: R(-20) } },
    { t: 0.2, reset: true, use: 'stand', pose: { all: flip(4, C), root: M(0, -0.04, 0.22), body: R(8), clawArm: R(54), tongs: R(32), clawS: R(-20, -30) }, in: 'snap' },
    { t: 0.3, pose: { root: M(0, -0.04, 0.26), tongs: R(42) } }, { t: 0.6, reset: true, use: 'stand' }] },
  FTilt: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a low sideways rake of the tongs along the floor */
    { t: 0.14, pose: { body: R(4, 30), root: M(0, -0.04, 0), clawArm: R(64, 40), tongs: R(30) } },
    { t: 0.22, pose: { body: R(10, -24), root: M(0, -0.06, 0.18), clawArm: R(66, -16), tongs: R(34), ...legs(10, -10) }, in: 'snap' },
    { t: 0.32, pose: { clawArm: R(66, -24) } }, { t: 0.62, reset: true, use: 'stand' }] },
  Dash: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a head-down charge, scuttle first, legs pumping */
    { t: 0.12, pose: { all: flip(-12, C), root: M(0, 0.02, -0.08), clawArm: R(-10), tongs: R(-20), ...legs(-20, 20) } },
    { t: 0.2, pose: { all: flip(18, C), root: M(0, -0.02, 0.32), clawArm: R(40), tongs: R(24), clawS: R(-30), ...legs(26, -26) }, in: 'snap' },
    { t: 0.3, pose: { root: M(0, -0.02, 0.42), ...legs(-26, 26) } }, { t: 0.4, pose: { root: M(0, -0.02, 0.48), ...legs(26, -26) } },
    { t: 0.48, pose: { all: flip(8, C), root: M(0, 0, 0.4), ...legs(-10, 10) } }, { t: 0.75, reset: true, use: 'stand' }] },
  Heave: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* up smash: a deep squat, then the whole crab springs up with the tongs thrust overhead */
    { t: 0.26, use: 'low', pose: { root: M(0, -0.24, 0), body: R(12), clawArm: R(40), tongs: R(30), ...LEGS_OUT } },
    { t: 0.34, reset: true, use: 'stand', pose: { root: M(0, 0.44, 0), body: R(-12), clawArm: R(-14), tongs: R(-6), clawS: R(-40), ...LEGS_UP }, in: 'snap' },
    { t: 0.42, pose: { root: M(0, 0.5, 0), clawArm: R(-8), tongs: R(-14, 0, 10) } }, { t: 0.5, pose: { tongs: R(-8, 0, -10) } },
    { t: 0.7, pose: { root: M(0, 0.02, 0), body: R(4), ...LEGS_OUT } }, { t: 1.0, reset: true, use: 'stand' }] },
  Clamp: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* down smash: tongs slammed down in front, then a half turn to slam behind, and back */
    { t: 0.24, use: 'low', pose: { body: R(-10), clawArm: R(-24), tongs: R(-20), root: M(0, -0.06, 0) } },
    { t: 0.32, pose: { body: R(14), clawArm: R(78), tongs: R(34), root: M(0, -0.16, 0.12) }, in: 'snap' },
    { t: 0.4, pose: { all: R(0, 90), clawArm: R(40), tongs: R(10) } },
    { t: 0.46, pose: { all: R(0, 180), clawArm: R(78), tongs: R(34) }, in: 'snap' },
    { t: 0.62, pose: { all: R(0, 270), clawArm: R(30), tongs: R(10) } }, { t: 0.85, reset: true, use: 'stand', pose: { all: R(0, 359) } }] },
  Chop: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { ...legs(14, -14) } },   /* forward air: tongs lifted high, then chopped down in front */
    { t: 0.14, pose: { body: R(-14), clawArm: R(-40), tongs: R(-30), clawS: R(-30), ...LEGS_UP } },
    { t: 0.22, pose: { all: flip(8, C), body: R(6), clawArm: R(56), tongs: R(30), ...LEGS_OUT }, in: 'snap' },
    { t: 0.32, pose: { clawArm: R(58), tongs: R(34) } }, { t: 0.6, reset: true, use: 'stand', pose: { ...legs(14, -14) } }] },
  Swat: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { ...legs(14, -14) } },   /* up air: tongs swung up from in front, over the top and back */
    { t: 0.14, pose: { body: R(6), clawArm: R(50), tongs: R(30) } },
    { t: 0.22, pose: { all: flip(-10, C), body: R(-14), clawArm: R(-6), tongs: R(-10), ...LEGS_UP }, in: 'snap' },
    { t: 0.32, pose: { clawArm: R(-34), tongs: R(-40) } }, { t: 0.6, reset: true, use: 'stand', pose: { ...legs(14, -14) } }] },
  Grab: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a quick lean and pinch: tongs and claw both out */
    { t: 0.12, pose: { body: R(-6), clawArm: R(-10), tongs: R(-8), clawS: R(10, 20) } },
    { t: 0.2, pose: { root: M(0, -0.04, 0.2), body: R(8), clawArm: R(46), tongs: R(28), clawS: R(-24, 46) }, in: 'snap' },
    { t: 0.3, pose: { root: M(0, -0.04, 0.22), tongs: R(32) } }, { t: 0.55, reset: true, use: 'stand' }] },
  GetupSweep: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: RM(-170, 0, 0, 0, 1.25, -0.45), tongs: R(-20), ...legs(20, -20) } },   /* off its back with a kick, then a spin with the tongs out low */
    { t: 0.16, reset: true, use: 'low', pose: { all: flip(-30, C), root: M(0, 0.1, 0), ...LEGS_UP } },
    { t: 0.26, reset: true, use: 'low', pose: { all: R(0, -30), root: M(0, -0.16, 0), clawArm: R(70), tongs: R(30) } },
    { t: 0.36, pose: { all: R(0, 150) } }, { t: 0.48, pose: { all: R(0, 320) } }, { t: 0.8, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
  /* ---- states ---- */
  Hang: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, -0.1, 0), body: R(-12), clawArm: R(-24), tongs: R(28), clawS: R(-50), ...legs(26, -26) } },   /* hanging off the ledge by its tongs, legs paddling */
    { t: 0.6, pose: { body: R(-8, 6), ...legs(-26, 26) } }, { t: 1.2, pose: { body: R(-12), ...legs(26, -26) } }] },
  IdleClack: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* now and then: looks round, then clacks its tongs on the scuttle */
    { t: 0.4, pose: { body: R(2, 28) } }, { t: 0.9, pose: { body: R(2, -28) } }, { t: 1.3, pose: { body: R(0, 0) } },
    { t: 1.5, pose: { clawArm: R(-20, 0, 20), tongs: R(-40) } }, { t: 1.6, pose: { tongs: R(-60) }, in: 'snap' }, { t: 1.7, pose: { tongs: R(-40) }, in: 'out' },
    { t: 1.8, pose: { tongs: R(-60) }, in: 'snap' }, { t: 1.9, pose: { tongs: R(-40) }, in: 'out' }, { t: 2.0, pose: { tongs: R(-60) }, in: 'snap' },
    { t: 2.4, reset: true, use: 'stand', pose: { root: M(0, 0.04, 0), ...LEGS_UP } }, { t: 2.6, reset: true, use: 'stand' }] },
  Respawn: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(-6), clawArm: R(-10, 0, 20), tongs: R(-10), clawS: R(-60, 30) } },   /* waving its claw */
    { t: 0.3, pose: { clawS: R(-80, -10) } }, { t: 0.6, pose: { clawS: R(-60, 30) } }, { t: 0.9, pose: { clawS: R(-80, -10) } }, { t: 1.2, pose: { clawS: R(-60, 30) } }] },
  AirJump: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { all: flip(0, C) } },   /* the second jump: a tucked forward roll in the air */
    { t: 0.12, pose: { all: flip(120, C) } }, { t: 0.24, pose: { all: flip(240, C) } }, { t: 0.34, pose: { all: flip(359, C) } },
    { t: 0.5, reset: true, use: 'stand', pose: { all: flip(360, C), body: R(-8), tongs: R(-10), ...LEGS_OUT }, in: 'back' }] },
  FastFall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(-6), clawArm: R(-20), tongs: R(-30), clawS: R(-60), ...LEGS_UP, root: M(0, 0.04, 0) } },   /* plummeting, everything held up */
    { t: 0.2, pose: { tongs: R(-36), clawS: R(-70) } }, { t: 0.4, pose: { tongs: R(-30), clawS: R(-60) } }] },
  Helpless: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(10, 0, 8), tongs: R(-40, 0, 20), clawS: R(-40, 30), ...legs(30, -30) } },   /* spent: legs and tongs flailing */
    { t: 0.2, pose: { body: R(10, 0, -8), tongs: R(-40, 0, -20), clawS: R(-60, -30), ...legs(-30, 30) } }, { t: 0.4, pose: { body: R(10, 0, 8), tongs: R(-40, 0, 20), clawS: R(-40, 30), ...legs(30, -30) } }] },
  LandHard: { fps: 30, keys: [{ t: 0, use: 'low', pose: { root: M(0, -0.28, 0), body: R(14), clawArm: R(40), tongs: R(36), ...LEGS_OUT } },   /* flattened, legs splayed */
    { t: 0.1, pose: { root: M(0, -0.3, 0) } }, { t: 0.26, reset: true, use: 'stand', pose: { root: M(0, 0.04, 0) }, in: 'back' }, { t: 0.45, reset: true, use: 'stand' }] },
  ShieldHit: { fps: 30, keys: [{ t: 0, use: 'low', pose: { root: M(0, -0.2, 0), body: R(-14), clawArm: R(40, -40), tongs: R(50), clawS: R(-30, 30) } },
    { t: 0.06, pose: { root: M(0, -0.22, -0.1), body: R(-22) }, in: 'out' }, { t: 0.3, pose: { root: M(0, -0.2, 0), body: R(-14) } }] },
  HitHeavy: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-34, C), root: M(0, 0.06, -0.12), body: R(-14), tongs: R(-50, 0, 20), clawS: R(-50), ...legs(-30, 30) } },
    { t: 0.3, pose: { all: flip(-14, C), tongs: R(-20) } }, { t: 0.8, reset: true, use: 'stand' }] },
  LaunchUp: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(10), clawArm: R(70), tongs: R(80), clawS: R(30), ...LEGS_OUT } },   /* flung up: limbs dragged down below it */
    { t: 0.6, pose: { body: R(4), tongs: R(50), ...legs(10, -10) } }] },
  Spike: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(-10), clawArm: R(-30), tongs: R(-50), clawS: R(-70), ...LEGS_UP } },   /* driven down: everything trails above */
    { t: 0.6, pose: { tongs: R(-36), ...legs(10, -10) } }] },
  Launch: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(-16), clawArm: R(-20, 0, 20), tongs: R(-50), clawS: R(-60, 30), ...legs(-34, 34) } },   /* knocked flying (the game spins it) */
    { t: 0.25, pose: { tongs: R(-30, 0, -10), ...legs(34, -34) } }, { t: 0.5, pose: { tongs: R(-50), ...legs(-20, 20) } }] },
  AirDodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.1, use: ['stand', 'tuck'], pose: { all: R(0, 120) } }, { t: 0.2, pose: { all: R(0, 240) } }, { t: 0.3, pose: { all: R(0, 359) } },   /* pulls into the scuttle and corkscrews */
    { t: 0.5, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
  Pummel: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLDP },   /* squeezes the tongs */
    { t: 0.08, pose: { body: R(10), tongs: R(50, 0, 8) }, in: 'snap' }, { t: 0.16, pose: { tongs: R(36, 0, -6) } }, { t: 0.24, pose: { body: R(6), tongs: R(38) } }] },
  ThrowF: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLDP },   /* forward: winds the tongs back, then flings them ahead */
    { t: 0.14, pose: { all: flip(-14, C), clawArm: R(-20), tongs: R(-30) } },
    { t: 0.24, pose: { all: flip(10, C), root: M(0, 0, 0.2), clawArm: R(60), tongs: R(36) }, in: 'snap' }, { t: 0.4, pose: { clawArm: R(70) } }, { t: 0.75, reset: true, use: 'stand' }] },
  ThrowB: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLDP },   /* back: turns and tosses them over its back */
    { t: 0.12, pose: { all: R(0, 60), clawArm: R(20), tongs: R(-10) } },
    { t: 0.24, pose: { all: R(0, 160), body: R(-14), clawArm: R(-40), tongs: R(-50) }, in: 'snap' }, { t: 0.4, pose: { all: R(0, 180) } },
    { t: 0.6, pose: { all: R(0, 300), body: R(0), clawArm: R(0), tongs: R(0) } }, { t: 0.8, reset: true, use: 'stand', pose: { all: R(0, 359) } }] },
  ThrowU: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLDP },   /* up: squats under them and launches them on the tongs */
    { t: 0.14, use: 'low', pose: { root: M(0, -0.2, 0), clawArm: R(50), tongs: R(40), ...LEGS_OUT } },
    { t: 0.24, reset: true, use: 'stand', pose: { root: M(0, 0.3, 0), body: R(-12), clawArm: R(-16), tongs: R(-10), ...LEGS_UP }, in: 'snap' }, { t: 0.4, pose: { root: M(0, 0.32, 0) } }, { t: 0.8, reset: true, use: 'stand' }] },
  ThrowD: { fps: 30, keys: [{ t: 0, use: 'stand', pose: HOLDP },   /* down: pins them, then drops the scuttle on them */
    { t: 0.12, pose: { root: M(0, 0.16, 0.1), body: R(-10), clawArm: R(70), tongs: R(60), ...LEGS_UP } },
    { t: 0.24, pose: { all: flip(18, C), root: M(0, -0.2, 0.2), body: R(10), ...LEGS_OUT }, in: 'snap' }, { t: 0.36, pose: { root: M(0, -0.22, 0.2) } }, { t: 0.75, reset: true, use: 'stand' }] },
});

const out = path.join(__dirname, '..', '..', 'assets', 'scuttle', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(scuttle, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/scuttle-rigged.glb', texture: 1024, out: 'export/scuttle-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + scuttle.bones.length + ' bones, ' + Object.keys(scuttle.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const run = { clip: 'Scuttle' };
const entry = { file: 'assets/scuttle/export/scuttle-v1.glb', height: 11.4, feel: 1,
  clips: { idle: { clip: 'Idle' }, walk: run, run, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'AirDodge' }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Hang' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Lunge', from: 0.25, to: 0.95 }, swap: { clip: 'Tumble', bounce: true },
    idle2: { clip: 'IdleClack' }, respawn: { clip: 'Respawn' }, airjump: { clip: 'AirJump' }, fastfall: { clip: 'FastFall' }, helpless: { clip: 'Helpless' }, landHard: { clip: 'LandHard' },
    shieldHit: { clip: 'ShieldHit' }, hitHeavy: { clip: 'HitHeavy' }, launchUp: { clip: 'LaunchUp' }, spike: { clip: 'Spike' }, launch: { clip: 'Launch' },
    pummel: { clip: 'Pummel' }, throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'ThrowB' }, throw_u: { clip: 'ThrowU' }, throw_d: { clip: 'ThrowD' } },
  strikers: [{ bone: 'tongsTip', ext: 0.4 }, { bone: 'clawS', ext: 2.4 }, { bone: 'legL2', ext: 2.6 }, { bone: 'legR2', ext: 2.6 }, { bone: 'body', ext: 6 }],
  springs: [],
  attacks: { jab: A('Snip', 0.2, 0.3, 0, 0.55), jab2: A('Jab2', 0.18, 0.28, 0, 0.5), jab3: A('Jab3', 0.2, 0.3, 0, 0.6), ftilt: A('FTilt', 0.22, 0.32, 0, 0.62), utilt: A('Lift', 0.3, 0.44), dtilt: A('Sweep', 0.3, 0.46, 0, 0.85), dash: A('Dash', 0.2, 0.48, 0, 0.75),
    fsmash: A('Lunge', 0.4, 0.54, 0, 0.95), usmash: A('Heave', 0.34, 0.5, 0, 1.0), dsmash: A('Clamp', 0.32, 0.46, 0, 0.85),
    nair: A('Spin', 0.15, 0.45, 0, 0.7), fair: A('Chop', 0.22, 0.32, 0, 0.6), bair: A('BackKick', 0.38, 0.5), uair: A('Swat', 0.22, 0.32, 0, 0.6), dair: A('Stamp', 0.4, 0.55, 0, 0.95),
    grab: A('Grab', 0.2, 0.3, 0, 0.55), getup: A('GetupSweep', 0.36, 0.48, 0.16, 0.8), nspec: A('Reach', 0.5, 0.6, 0, 1.1), sspec: A('Roll', 0.25, 0.7, 0, 1.0), uspec: A('Pop', 0.3, 0.4, 0, 0.8), dspec: A('Drop', 0.58, 0.7, 0, 1.4), '*': A('Snip', 0.2, 0.3, 0, 0.55) } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current.Scuttle = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
