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
      { t: 0.1, pose: { body: R(0, 14), clawS: R(0, 30) } }, { t: 0.18, pose: { root: M(0, -0.02, 0.1), body: R(4, -22), clawS: R(-30, -60) } }, { t: 0.28, pose: { clawS: R(-30, -66) } }, { t: 0.5, reset: true, use: 'stand' }] },
    Lift: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* squats, then heaves the scuttle and tongs upward */
      { t: 0.2, use: 'low', pose: { root: M(0, -0.2, 0), clawArm: R(30), tongs: R(20) } }, { t: 0.3, reset: true, use: 'stand', pose: { root: M(0, 0.32, 0), body: R(-10), clawArm: R(-16), tongs: R(-12), legL1: R(0, 0, -26), legL2: R(0, 0, -26), legR1: R(0, 0, 26), legR2: R(0, 0, 26) } },
      { t: 0.44, pose: { root: M(0, 0.36, 0) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Sweep: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a low spin with the tongs out flat */
      { t: 0.22, use: 'low', pose: { all: R(0, -30), root: M(0, -0.16, 0), clawArm: R(70), tongs: R(30) } }, { t: 0.32, pose: { all: R(0, 150) } }, { t: 0.46, pose: { all: R(0, 320) } }, { t: 0.85, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
    Lunge: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* rears back, then throws the scuttle's weight forward behind the tongs */
      { t: 0.3, pose: { all: flip(-22, C), root: M(0, 0.02, -0.14), clawArm: R(-24), tongs: R(-20) } },
      { t: 0.4, reset: true, use: 'stand', pose: { all: flip(34, C), root: M(0, -0.04, 0.4), clawArm: R(60), tongs: R(40) } }, { t: 0.54, pose: { root: M(0, -0.05, 0.44) } }, { t: 0.95, reset: true, use: 'stand' }] },
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
const out = path.join(__dirname, '..', '..', 'assets', 'scuttle', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(scuttle, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/scuttle-rigged.glb', texture: 1024, out: 'export/scuttle-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + scuttle.bones.length + ' bones, ' + Object.keys(scuttle.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const run = { clip: 'Scuttle' };
const entry = { file: 'assets/scuttle/export/scuttle-v1.glb', height: 11.4,
  clips: { idle: { clip: 'Idle' }, walk: run, run, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Rise', at: 0.4 }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Lunge', from: 0.25, to: 0.95 }, swap: { clip: 'Tumble', bounce: true } },
  strikers: [{ bone: 'tongsTip', ext: 0.4 }, { bone: 'clawS', ext: 2.4 }, { bone: 'legL2', ext: 2.6 }, { bone: 'legR2', ext: 2.6 }, { bone: 'body', ext: 6 }],
  springs: [],
  attacks: { jab: A('Snip', 0.2, 0.3, 0, 0.55), jab2: A('Jab2', 0.18, 0.28, 0, 0.5), jab3: A('Snip', 0.2, 0.3, 0, 0.55), ftilt: A('Snip', 0.2, 0.3, 0, 0.55), utilt: A('Lift', 0.3, 0.44), dtilt: A('Sweep', 0.3, 0.46, 0, 0.85), dash: A('Spin', 0.2, 0.45, 0, 0.7),
    fsmash: A('Lunge', 0.4, 0.54, 0, 0.95), usmash: A('Lift', 0.3, 0.44), dsmash: A('Sweep', 0.3, 0.46, 0, 0.85),
    nair: A('Spin', 0.15, 0.45, 0, 0.7), fair: A('Snip', 0.2, 0.3, 0, 0.55), bair: A('BackKick', 0.38, 0.5), uair: A('Lift', 0.3, 0.44), dair: A('Stamp', 0.4, 0.55, 0, 0.95),
    grab: A('Snip', 0.2, 0.3, 0, 0.55), getup: A('Sweep', 0.3, 0.46, 0, 0.85), nspec: A('Reach', 0.5, 0.6, 0, 1.1), sspec: A('Roll', 0.25, 0.7, 0, 1.0), uspec: A('Pop', 0.3, 0.4, 0, 0.8), dspec: A('Drop', 0.58, 0.7, 0, 1.4), '*': A('Snip', 0.2, 0.3, 0, 0.55) } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current.Scuttle = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
