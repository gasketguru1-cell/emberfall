// Writes the skeleton and animation spec for Potato Sack (assets/potato-sack/work/rig.json), which tools/blender/rig.py
// turns into a rigged, animated model, and adds its entry to the game's manifest.
//   node tools/blender/sack.js
// Then:  blender -b --factory-startup --python tools/blender/rig.py -- --mesh assets/potato-sack/raw/<task>/model_url.glb
//            --spec assets/potato-sack/work/rig.json --out assets/potato-sack/work/potato-sack-rigged.glb
//        node tools/pack.mjs assets/potato-sack/work/pack.json
// The body is a sack: a lower and an upper half that slide into each other for squash and stretch (the rig has no
// scaling), a gathered neck with a floppy tuft, two knotted fists and two knotted feet.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
/* A somersault for the whole-body bone: pitch it by deg while keeping the body's centre (c = [height, forward]) in place. */
const flip = (deg, c) => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, c[0] - (c[0] * cs - c[1] * sn), c[1] - (c[0] * sn + c[1] * cs)] }; };
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const C = [0.8, 0];   /* the body's centre: height, forward */
const side = (s, x) => [
  { name: 'arm' + s, head: [0.5 * x, 1.03, 0], tail: [0.74 * x, 1.05, 0], parent: 'chest' },
  { name: 'fist' + s, head: [0.74 * x, 1.05, 0], tail: [0.93 * x, 1.08, 0], parent: 'arm' + s, connect: true },
  { name: 'foot' + s, head: [0.42 * x, 0.2, 0.02], tail: [0.62 * x, 0.04, 0.16], parent: 'root' }];
/* both fists swung forward (deg > 0) or back round the body's up axis. Measured on the built model: a positive turn about up brings the right side (-X) forward, so the right arm turns by +deg and the left by -deg; a positive roll raises the left arm. */
const fists = (l, r, up) => ({ armL: R(0, -l, up || 0), armR: R(0, r === undefined ? l : r, -(up || 0)) });
const sack = {
  note: 'Potato Sack: metres after prep (feet on y = 0, facing +Z). Joint positions were measured from the generated mesh.',
  prep: { yaw: 0, translate: [0, 0.951, 0] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'root', head: [0, 0.5, 0], tail: [0, 0.7, 0], parent: 'all', deform: false },
    { name: 'belly', head: [0, 0.25, 0], tail: [0, 0.8, 0], parent: 'root' },
    { name: 'chest', head: [0, 0.8, 0], tail: [0, 1.3, 0], parent: 'belly' },
    { name: 'neck', head: [0, 1.3, 0], tail: [0, 1.5, 0], parent: 'chest', connect: true },
    { name: 'tuft1', head: [0, 1.5, 0], tail: [0, 1.7, 0], parent: 'neck', connect: true },
    { name: 'tuft2', head: [0, 1.7, 0], tail: [0, 1.9, 0], parent: 'tuft1', connect: true },
    ...side('L', 1), ...side('R', -1)],
  poses: {
    stand: { all: {}, root: {}, belly: {}, chest: {}, neck: {}, tuft1: {}, tuft2: {}, armL: {}, armR: {}, footL: {}, footR: {} },
    squash: { root: M(0, -0.1, 0), chest: M(0, -0.12, 0), neck: R(8), armL: R(0, 0, -16), armR: R(0, 0, 16), footL: M(0.05, 0.08, 0), footR: M(-0.05, 0.08, 0) },
    stretch: { root: M(0, 0.05, 0), chest: M(0, 0.08, 0), neck: R(-6), tuft1: R(-8), armL: R(0, 0, 12), armR: R(0, 0, -12) },
    curl: { all: flip(40, C), chest: RM(26, 0, 0, 0, -0.08, 0), neck: R(20), tuft1: R(30), armL: R(0, -50), armR: R(0, 50), footL: M(0, 0.12, 0.1), footR: M(0, 0.12, 0.1) } },
  clips: {
    Idle: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.6, pose: { root: M(0, -0.02, 0), chest: M(0, -0.025, 0), tuft1: R(0, 0, 5), armL: R(0, 0, -5), armR: R(0, 0, 5) } },
      { t: 1.2, pose: { root: M(0, 0, 0), chest: M(0, 0.01, 0), tuft1: R(0, 0, 0), armL: R(0, 0, 3), armR: R(0, 0, -3) } },
      { t: 1.8, pose: { root: M(0, -0.02, 0), chest: M(0, -0.025, 0), tuft1: R(0, 0, -5), armL: R(0, 0, -5), armR: R(0, 0, 5) } },
      { t: 2.4, pose: { root: M(0, 0, 0), chest: M(0, 0, 0), tuft1: R(0, 0, 0), armL: R(0, 0, 0), armR: R(0, 0, 0) } }] },
    /* One hop. The game plays 0 to 0.7 while the sack is moving and 0.7 to 1.0 while it is planted (anim.js). */
    Hop: { fps: 30, keys: [
      { t: 0, use: ['stand', 'squash'] },
      { t: 0.12, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.12, 0), all: R(8), tuft1: R(-18), tuft2: R(-14) } },
      { t: 0.35, reset: true, use: 'stand', pose: { root: M(0, 0.3, 0), all: R(4), chest: M(0, -0.04, 0), footL: M(0, 0.1, 0.06), footR: M(0, 0.1, 0.06), armL: R(0, 0, 24), armR: R(0, 0, -24), tuft1: R(6) } },
      { t: 0.58, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.1, 0), all: R(-5), tuft1: R(22), tuft2: R(18) } },
      { t: 0.7, reset: true, use: ['stand', 'squash'], pose: { root: M(0, -0.16, 0), chest: M(0, -0.18, 0), tuft1: R(-20) } },
      { t: 0.85, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.01, 0), chest: M(0, 0.03, 0), tuft1: R(10) } },
      { t: 1.0, reset: true, use: ['stand', 'squash'] }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'squash', pose: { root: M(0, -0.2, 0), chest: M(0, -0.2, 0) } }] },
    Rise: { fps: 30, keys: [{ t: 0, use: ['stand', 'stretch'], pose: { root: M(0, 0.08, 0), chest: M(0, 0.12, 0), armL: R(0, 0, -30), armR: R(0, 0, 30), tuft1: R(-24), tuft2: R(-20), footL: M(0, -0.06, 0), footR: M(0, -0.06, 0) } },
      { t: 0.4, reset: true, use: 'stand', pose: { chest: M(0, -0.03, 0), armL: R(0, 0, 10), armR: R(0, 0, -10), footL: M(0, 0.08, 0.05), footR: M(0, 0.08, 0.05) } }] },
    Fall: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { chest: M(0, -0.05, 0), armL: R(0, 0, 38), armR: R(0, 0, -38), tuft1: R(26, 0, 6), tuft2: R(22), footL: M(0.04, 0.1, 0), footR: M(-0.04, 0.06, 0) } },
      { t: 0.25, pose: { armL: R(0, 0, 26), armR: R(0, 0, -44), tuft1: R(30, 0, -6), footL: M(0.04, 0.06, 0), footR: M(-0.04, 0.1, 0) } },
      { t: 0.5, pose: { armL: R(0, 0, 38), armR: R(0, 0, -38), tuft1: R(26, 0, 6), footL: M(0.04, 0.1, 0), footR: M(-0.04, 0.06, 0) } }] },
    Land: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { root: M(0, -0.2, 0), chest: M(0, -0.22, 0), tuft1: R(-26), tuft2: R(-20) } }, { t: 0.18, reset: true, use: ['stand', 'stretch'], pose: { tuft1: R(14) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, use: 'squash', pose: { ...fists(62), neck: R(20), tuft1: R(24) } }] },
    Hit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-22, C), chest: RM(-14, 0, 0, 0, -0.04, 0), neck: R(-18), tuft1: R(-30), armL: R(0, 0, 40), armR: R(0, 0, -40), footL: M(0, 0.1, 0.1) } },
      { t: 0.3, pose: { all: flip(-14, C), tuft1: R(-10), armL: R(0, 0, 24), armR: R(0, 0, -24) } }, { t: 0.6, reset: true, use: 'stand' }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'curl'] }, { t: 0.3, pose: { chest: RM(32, 0, 0, 0, -0.1, 0), tuft1: R(38) } }, { t: 0.6, pose: { chest: RM(26, 0, 0, 0, -0.08, 0), tuft1: R(30) } }] },
    Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-50, C) } }, { t: 0.3, pose: { all: RM(-90, 0, 0, 0, 0.42, -0.5), chest: M(0, -0.06, 0), armL: R(0, 0, 30), armR: R(0, 0, -30), tuft1: R(-20), footL: M(0, 0.05, 0.1), footR: M(0, 0.02, 0.06) } }] },
    Dodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.14, pose: { all: flip(-30, C), root: M(0, -0.06, -0.1), chest: RM(-12, 0, 0, 0, -0.08, 0), ...fists(-30), tuft1: R(-26) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Hold: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { ...fists(78), root: M(0, 0, 0.04), chest: R(8) } }, { t: 0.3, pose: { ...fists(84), chest: R(11) } }, { t: 0.6, pose: { ...fists(78), chest: R(8) } }] },
    Held: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, 0.1, 0), chest: M(0, 0.06, 0), armL: R(0, 0, 44), armR: R(0, 0, -30), footL: M(0, -0.04, 0.08), footR: M(0, -0.08, -0.04), tuft1: R(0, 0, 14) } },
      { t: 0.25, pose: { armL: R(0, 0, 30), armR: R(0, 0, -44), footL: M(0, -0.08, -0.04), footR: M(0, -0.04, 0.08), tuft1: R(0, 0, -14) } },
      { t: 0.5, pose: { armL: R(0, 0, 44), armR: R(0, 0, -30), footL: M(0, -0.04, 0.08), footR: M(0, -0.08, -0.04), tuft1: R(0, 0, 14) } }] },
    /* ---- attacks ---- */
    Thump: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* a knotted fist straight out */
      { t: 0.18, pose: { root: M(0, -0.03, -0.1), chest: R(0, -18), armR: R(0, -40), tuft1: R(-12) } },
      { t: 0.28, pose: { root: M(0, -0.03, 0.4), all: R(6), chest: R(6, 22), armR: R(0, 100), tuft1: R(20) } },
      { t: 0.4, pose: { root: M(0, -0.03, 0.42), armR: R(0, 96) } }, { t: 0.7, reset: true, use: 'stand' }] },
    Uppercut: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* squash, then both fists and the whole sack shoot upward */
      { t: 0.26, use: 'squash', pose: { root: M(0, -0.2, 0), chest: M(0, -0.2, 0), armL: R(0, 0, -34), armR: R(0, 0, 34) } },
      { t: 0.36, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.4, 0), chest: M(0, 0.14, 0), armL: R(0, 0, 76), armR: R(0, 0, -76), tuft1: R(-24), tuft2: R(-18) } },
      { t: 0.48, pose: { root: M(0, 0.44, 0) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Sweep: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* low spin with the fists flung wide */
      { t: 0.28, use: 'squash', pose: { all: R(0, -30), root: M(0, -0.3, 0), chest: M(0, -0.24, 0) } },
      { t: 0.36, pose: { all: R(0, 170), armL: R(0, 0, -24), armR: R(0, 0, 24), footL: M(0.22, 0.02, 0), footR: M(-0.22, 0.02, 0) } }, { t: 0.5, pose: { all: R(0, 330) } },
      { t: 0.9, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
    Slam: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* rears back, then throws its whole weight forward */
      { t: 0.3, pose: { all: flip(-26, C), root: M(0, 0.04, -0.14), chest: RM(-16, 0, 0, 0, 0.06, 0), armL: R(0, 0, 50), armR: R(0, 0, -50), tuft1: R(-34) } },
      { t: 0.39, reset: true, use: 'stand', pose: { all: flip(62, C), root: M(0, -0.04, 0.62), chest: RM(20, 0, 0, 0, 0.04, 0), ...fists(70), tuft1: R(34), tuft2: R(26) } },
      { t: 0.52, pose: { all: flip(66, C), root: M(0, -0.06, 0.66) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Spin: { fps: 30, keys: [{ t: 0, use: ['stand', 'curl'], pose: { all: flip(0, C) } },   /* a full forward roll in the air */
      { t: 0.3, pose: { all: flip(150, C) } }, { t: 0.5, pose: { all: flip(290, C) } }, { t: 0.8, reset: true, use: 'stand', pose: { all: flip(360, C) } }] },
    BackKick: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* tips forward and drives both feet out behind */
      { t: 0.3, pose: { all: flip(20, C), footL: M(0, 0.1, 0.12), footR: M(0, 0.1, 0.12), chest: M(0, -0.08, 0) } },
      { t: 0.39, pose: { all: flip(70, C), root: M(0, 0, -0.3), footL: M(0, -0.3, -0.12), footR: M(0, -0.3, -0.12), chest: M(0, 0.06, 0), ...fists(40), tuft1: R(30) } },
      { t: 0.52, pose: { all: flip(74, C), root: M(0, 0, -0.34) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Stomp: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* tucks up, then drops its full weight feet first */
      { t: 0.3, use: 'squash', pose: { root: M(0, 0.1, 0), footL: M(0, 0.16, 0), footR: M(0, 0.16, 0), armL: R(0, 0, 40), armR: R(0, 0, -40) } },
      { t: 0.39, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, -0.06, 0), chest: M(0, 0.12, 0), footL: M(0, -0.14, 0), footR: M(0, -0.14, 0), armL: R(0, 0, 60), armR: R(0, 0, -60), tuft1: R(-30), tuft2: R(-24) } },
      { t: 0.52, pose: { root: M(0, -0.08, 0) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Reach: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* both fists out to catch hold */
      { t: 0.24, pose: { root: M(0, -0.03, -0.05), armL: R(0, 0, 30), armR: R(0, 0, -30), chest: R(-8) } },
      { t: 0.39, pose: { root: M(0, -0.02, 0.34), all: R(8), chest: R(14), ...fists(90), tuft1: R(18) } }, { t: 0.5, pose: { ...fists(98) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Toss: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* an overhand throw */
      { t: 0.3, pose: { root: M(0, 0, -0.06), chest: R(-12, -18), armR: R(0, -30, -70), tuft1: R(-16) } },
      { t: 0.4, pose: { root: M(0, -0.03, 0.08), chest: R(14, 18), armR: R(0, 80, -20), tuft1: R(22) } }, { t: 0.5, pose: { armR: R(0, 96, 0) } }, { t: 0.95, reset: true, use: 'stand' }] },
    Pounce: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'] },   /* a leap with the fists thrown wide, closing as it lands on someone */
      { t: 0.24, reset: true, use: ['stand', 'stretch'], pose: { all: flip(24, C), armL: R(0, 0, 50), armR: R(0, 0, -50), tuft1: R(-20) } },
      { t: 0.39, pose: { all: flip(38, C), ...fists(80), chest: R(10), tuft1: R(26) } }, { t: 0.55, pose: { all: flip(30, C), ...fists(98) } }, { t: 0.9, reset: true, use: 'stand' }] },
    Cook: { fps: 30, keys: [{ t: 0, use: 'stand' },   /* hunches over the potato, shaking, until it bursts */
      { t: 0.1, use: 'squash', pose: { root: M(0, -0.16, 0), chest: RM(12, 0, 0, 0, -0.18, 0), ...fists(70), tuft1: R(20) } },
      { t: 0.16, pose: { all: R(0, 0, 4) } }, { t: 0.22, pose: { all: R(0, 0, -4) } }, { t: 0.28, pose: { all: R(0, 0, 4) } }, { t: 0.34, pose: { all: R(0, 0, 0), root: M(0, -0.2, 0) } },
      { t: 0.4, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.14, 0), chest: M(0, 0.14, 0), armL: R(0, 0, 70), armR: R(0, 0, -70), tuft1: R(-30), tuft2: R(-24) } },
      { t: 0.52, pose: { root: M(0, 0.16, 0) } }, { t: 0.9, reset: true, use: 'stand' }] },
  },
};
const out = path.join(__dirname, '..', '..', 'assets', 'potato-sack', 'work');
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(sack, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/potato-sack-rigged.glb', texture: 1024, out: 'export/potato-sack-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + sack.bones.length + ' bones, ' + Object.keys(sack.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const hop = { clip: 'Hop' };
const entry = { file: 'assets/potato-sack/export/potato-sack-v1.glb', height: 13,
  clips: { idle: { clip: 'Idle' }, walk: hop, run: hop, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Fall' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Slam', from: 0.2, to: 0.9 }, swap: { clip: 'Tumble', bounce: true } },
  strikers: [{ bone: 'fistL', ext: 1.4 }, { bone: 'fistR', ext: 1.4 }, { bone: 'footL', ext: 1.2 }, { bone: 'footR', ext: 1.2 }, { bone: 'tuft2', ext: 1.2 }, { bone: 'neck', ext: 2.2 }],   /* neck: the top of the sack's body, which leads in its slams */
  springs: [{ bones: ['tuft1', 'tuft2'], k: 0.3, d: 0.66, max: 0.7, drag: 0.14 }],
  attacks: { jab: A('Thump', 0.28, 0.4, 0, 0.7), ftilt: A('Thump', 0.28, 0.4, 0, 0.7), utilt: A('Uppercut', 0.36, 0.48), dtilt: A('Sweep', 0.34, 0.52), dash: A('Slam', 0.39, 0.52),
    fsmash: A('Slam', 0.39, 0.52), usmash: A('Uppercut', 0.36, 0.48), dsmash: A('Sweep', 0.34, 0.52),
    nair: A('Spin', 0.2, 0.55, 0, 0.8), fair: A('Slam', 0.39, 0.52), bair: A('BackKick', 0.39, 0.52), uair: A('Uppercut', 0.36, 0.48), dair: A('Stomp', 0.39, 0.52),
    grab: A('Reach', 0.39, 0.5), getup: A('Sweep', 0.34, 0.52), nspec: A('Toss', 0.4, 0.5, 0, 0.95), sspec: A('Pounce', 0.3, 0.55), uspec: A('Cook', 0.38, 0.42), dspec: A('Spin', 0.12, 0.5, 0, 0.8), '*': A('Thump', 0.28, 0.4, 0, 0.7) } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current['Potato Sack'] = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
