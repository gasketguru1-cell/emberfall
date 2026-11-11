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
const sq = k => ({ scale: [1 + k * 0.55, 1 - k, 1 + k * 0.55] });   /* k > 0 squashes the sack, k < 0 stretches it (scales the belly and all above it) */
/* the shared attack layout: wind-up to 0.3, strike by 0.34, contact held to 0.42, overshoot at 0.55, settled by 0.9 */
const atk = (wind, hit, over) => [{ t: 0, use: 'stand' }, { t: 0.22, pose: wind, in: 'out' }, { t: 0.3, pose: wind }, { t: 0.34, reset: true, use: 'stand', pose: hit, in: 'snap' }, { t: 0.42, pose: hit }, { t: 0.55, pose: over, in: 'back' }, { t: 0.9, reset: true, use: 'stand', in: 'quad' }];
/* A roll for Tumble: curled up, turning `deg` degrees (somersault "flip" or spin "yaw") at an even speed until `until`, in steps
   under 180 so each one turns the right way, then uncurling with an overshoot. */
const roll = (kind, deg, until, start, mid, end) => { const keys = [], n = Math.ceil(deg / 150);
  for (let i = 0; i <= n; i++) { const d = deg * i / n, t = until * i / n, turn = kind === 'flip' ? flip(d, C) : R(0, d, 0); keys.push(Object.assign({ t, pose: Object.assign({ all: turn }, i === 0 ? start : i === Math.floor(n / 2) ? mid : {}) }, i === 0 ? { use: ['stand', 'curl'] } : { in: 'lin' })); }
  keys.push({ t: 1.0, reset: true, use: 'stand', pose: Object.assign({ all: kind === 'flip' ? flip(deg, C) : R(0, deg, 0) }, end), in: 'back' }); return keys; };
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
    /* ---- overhaul clips ---- */
    Idle2: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.3, pose: { chest: R(0, 30), neck: R(0, 20), tuft1: R(0, 0, 14) }, in: 'quad' }, { t: 0.8, pose: { chest: R(0, 30) } }, { t: 1.1, pose: { chest: R(0, -30), neck: R(0, -20), tuft1: R(0, 0, -14) }, in: 'back' }, { t: 1.6, pose: { chest: R(0, -30) } },
      { t: 1.8, reset: true, use: 'stand', pose: { belly: sq(0.15), armL: R(0, 0, -20), armR: R(0, 0, 20) }, in: 'quad' }, { t: 1.95, reset: true, use: 'stand', pose: { belly: sq(-0.12), root: M(0, 0.12, 0), armL: R(0, 0, 40), armR: R(0, 0, -40), tuft1: R(-20) }, in: 'out' }, { t: 2.15, reset: true, use: 'stand', pose: { belly: sq(0.12) }, in: 'quad' }, { t: 2.4, reset: true, use: 'stand', in: 'back' }] },   /* looks one way, the other, then a shake-out hop */
    Bound: { fps: 30, keys: [   /* the run: a long, low, leaning bound (0 to 0.7 airborne, 0.7 to 1 planted, as anim.js expects) */
      { t: 0, use: ['stand', 'squash'], pose: { belly: sq(0.2), all: R(14) } },
      { t: 0.1, reset: true, use: ['stand', 'stretch'], pose: { belly: sq(-0.18), root: M(0, 0.1, 0), all: R(24), tuft1: R(-30), tuft2: R(-24), armL: R(0, 30, 10), armR: R(0, -30, -10) }, in: 'out' },
      { t: 0.35, reset: true, use: 'stand', pose: { root: M(0, 0.2, 0), all: R(18), footL: M(0, 0.1, -0.1), footR: M(0, 0.1, -0.1), armL: R(0, 40, 20), armR: R(0, -40, -20), tuft1: R(-10) } },
      { t: 0.62, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, 0.06, 0), all: R(10), footL: M(0, -0.04, 0.12), footR: M(0, -0.04, 0.12), tuft1: R(16) } },
      { t: 0.7, reset: true, use: ['stand', 'squash'], pose: { belly: sq(0.26), root: M(0, -0.14, 0), all: R(16), tuft1: R(-22) }, in: 'quad' },
      { t: 0.85, reset: true, use: 'stand', pose: { belly: sq(0.06), all: R(14) }, in: 'back' }, { t: 1.0, reset: true, use: ['stand', 'squash'], pose: { belly: sq(0.2), all: R(14) } }] },
    Skid: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-24, C), belly: sq(0.18), footL: M(0, 0, 0.3), footR: M(0, 0, 0.26), armL: R(0, 0, 50), armR: R(0, 0, -50), tuft1: R(-40), tuft2: R(-30) } }, { t: 0.2, pose: { all: flip(-10, C), belly: sq(0.06), tuft1: R(20) }, in: 'quad' }, { t: 0.4, reset: true, use: 'stand', in: 'back' }] },
    FastFall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { belly: sq(-0.2), armL: R(0, 0, 70), armR: R(0, 0, -70), tuft1: R(-40), tuft2: R(-36), footL: M(0, -0.06, 0), footR: M(0, -0.06, 0) } }, { t: 0.2, pose: { armL: R(0, 0, 76), armR: R(0, 0, -64), tuft1: R(-46) } }, { t: 0.4, pose: { armL: R(0, 0, 70), armR: R(0, 0, -70), tuft1: R(-40) } }] },
    LandHard: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { belly: sq(0.42), root: M(0, -0.26, 0), chest: M(0, -0.2, 0), armL: R(0, 0, -30), armR: R(0, 0, 30), footL: M(0.12, 0.04, 0), footR: M(-0.12, 0.04, 0), tuft1: R(-40), tuft2: R(-30) } },
      { t: 0.22, pose: { belly: sq(0.3), root: M(0, -0.2, 0) } }, { t: 0.36, reset: true, use: 'stand', pose: { belly: sq(-0.12), tuft1: R(26) }, in: 'out' }, { t: 0.6, reset: true, use: 'stand', in: 'back' }] },
    ShieldHit: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { belly: sq(0.3), ...fists(70), neck: R(28), tuft1: R(36), root: M(0, 0, -0.1) } }, { t: 0.15, use: 'squash', pose: { belly: sq(0.12), ...fists(62), root: M(0, 0, 0) }, in: 'back' }] },
    HitHeavy: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-40, C), belly: sq(-0.25), chest: RM(-24, 0, 0, 0, 0.06, 0), neck: R(-30), tuft1: R(-50), tuft2: R(-40), armL: R(0, 0, 70), armR: R(0, 0, -70), footL: M(0, 0.12, 0.2), footR: M(0, 0.06, 0.24) } },
      { t: 0.3, pose: { all: flip(-30, C), belly: sq(0.1) } }, { t: 0.6, pose: { all: flip(-8, C), belly: sq(0), tuft1: R(-10), armL: R(0, 0, 20), armR: R(0, 0, -20) }, in: 'back' }] },
    LaunchUp: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { belly: sq(-0.3), chest: RM(-20, 0, 0, 0, 0.1, 0), armL: R(0, 0, -50), armR: R(0, 0, 50), footL: M(0, -0.12, -0.06), footR: M(0, -0.12, -0.06), tuft1: R(40), tuft2: R(36) } },
      { t: 0.3, pose: { all: flip(-100, C), belly: sq(-0.1) } }, { t: 0.6, pose: { all: flip(-200, C), belly: sq(0), armL: R(0, 0, 30), armR: R(0, 0, -30) } }] },
    Spike: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(50, C), belly: sq(0.35), armL: R(0, 0, 80), armR: R(0, 0, -80), footL: M(0, 0.2, -0.1), footR: M(0, 0.2, -0.1), tuft1: R(-50), tuft2: R(-44) } }, { t: 0.3, pose: { all: flip(80, C), belly: sq(-0.25) } }, { t: 0.6, pose: { all: flip(100, C), belly: sq(-0.1) } }] },
    Launch: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-60, C), belly: sq(-0.25), armL: R(0, 0, 70), armR: R(0, 0, -70), footL: M(0, 0.1, 0.24), footR: M(0, 0.06, 0.2), tuft1: R(-40), tuft2: R(-36) } }, { t: 0.3, pose: { all: flip(-160, C), belly: sq(-0.05) } }, { t: 0.6, pose: { all: flip(-260, C), belly: sq(0) } }] },
    AirDodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.12, use: 'curl', pose: { belly: sq(0.2) }, in: 'out' }, { t: 0.5, pose: { belly: sq(0.1) } }, { t: 0.8, reset: true, use: 'stand', in: 'back' }] },
    Respawn: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { belly: sq(-0.06), armL: R(0, 0, 30), armR: R(0, 0, -30), tuft1: R(-10) } }, { t: 0.6, pose: { belly: sq(0.04), armL: R(0, 0, 10), armR: R(0, 0, -10), tuft1: R(10) }, in: 'quad' }, { t: 1.2, pose: { belly: sq(-0.06), armL: R(0, 0, 30), armR: R(0, 0, -30), tuft1: R(-10) }, in: 'quad' }] },
    /* throws: the game carries the victim; these show the sack doing the work */
    ThrowF: { fps: 30, keys: atk({ all: flip(-20, C), belly: sq(0.15), ...fists(80), chest: R(-14) }, { all: flip(40, C), belly: sq(-0.25), root: M(0, 0, 0.4), ...fists(110), chest: R(20), tuft1: R(34) }, { all: flip(24, C), belly: sq(0.05), root: M(0, 0, 0.3) }) },
    ThrowB: { fps: 30, keys: atk({ all: R(0, 60), belly: sq(0.12), ...fists(80) }, { all: R(0, 220), belly: sq(-0.2), armL: R(0, 0, 80), armR: R(0, 0, -80), tuft1: R(0, 0, 30) }, { all: R(0, 330), belly: sq(0.05) }).concat([{ t: 0.92, reset: true, use: 'stand', pose: { all: R(0, 360) } }]) },
    ThrowU: { fps: 30, keys: atk({ belly: sq(0.3), root: M(0, -0.16, 0), ...fists(80, 80, -20) }, { belly: sq(-0.32), root: M(0, 0.2, 0), armL: R(0, 0, 150), armR: R(0, 0, -150), chest: R(-20), tuft1: R(-40), tuft2: R(-30) }, { belly: sq(-0.1), root: M(0, 0.08, 0), armL: R(0, 0, 120), armR: R(0, 0, -120) }) },
    ThrowD: { fps: 30, keys: atk({ belly: sq(-0.2), root: M(0, 0.16, 0), armL: R(0, 0, 120), armR: R(0, 0, -120) }, { belly: sq(0.42), root: M(0, -0.26, 0), all: flip(30, C), ...fists(90, 90, -40), tuft1: R(40) }, { belly: sq(0.2), root: M(0, -0.16, 0), all: flip(20, C) }) },
    ThrowS: { fps: 30, keys: atk({ belly: sq(-0.22), root: M(0, 0.1, 0), armL: R(0, 0, 90), armR: R(0, 0, -90), neck: R(-30) }, { belly: sq(0.32), all: flip(50, C), root: M(0, -0.1, 0.3), ...fists(100, 100, 30), neck: R(30), tuft1: R(40) }, { belly: sq(0.1), all: flip(30, C) }) },   /* Bag It: drops over the victim and spits them out */
    /* attacks in the shared layout (atk): wind-up to 0.3, contact 0.3 to 0.42, overshoot to 0.55, settled by 0.9 */
    Jab1: { fps: 30, keys: atk({ chest: R(0, -22), armR: R(0, -40), belly: sq(0.06), root: M(0, 0, -0.06) }, { root: M(0, -0.02, 0.32), chest: R(6, 24), armR: R(0, 100), belly: sq(-0.08), tuft1: R(16) }, { root: M(0, -0.02, 0.26), chest: R(4, 16), armR: R(0, 90) }) },
    Jab2: { fps: 30, keys: atk({ chest: R(0, 22), armL: R(0, 40), belly: sq(0.06) }, { root: M(0, -0.02, 0.34), chest: R(6, -24), armL: R(0, -100), belly: sq(-0.08), tuft1: R(16, 0, 10) }, { root: M(0, -0.02, 0.28), chest: R(4, -16), armL: R(0, -90) }) },
    Jab3: { fps: 30, keys: atk({ belly: sq(0.22), root: M(0, -0.1, -0.12), ...fists(-30), chest: R(-16), tuft1: R(-24) }, { belly: sq(-0.28), root: M(0, 0.02, 0.5), all: flip(14, C), ...fists(100), chest: R(14), tuft1: R(30), tuft2: R(24) }, { belly: sq(0.06), root: M(0, 0, 0.42), ...fists(92) }) },
    Ftilt: { fps: 30, keys: atk({ all: flip(-14, C), chest: R(-10, -30), armR: R(0, -60), belly: sq(0.12), root: M(0, -0.04, -0.14), footL: M(0, 0, -0.1) }, { all: flip(18, C), chest: R(10, 30), armR: R(0, 110, 10), belly: sq(-0.24), root: M(0, -0.06, 0.62), footL: M(0, 0, 0.3), tuft1: R(30) }, { all: flip(12, C), root: M(0, -0.06, 0.54), armR: R(0, 100) }) },
    Utilt: { fps: 30, keys: atk({ belly: sq(0.3), root: M(0, -0.18, 0), armL: R(0, 0, -30), armR: R(0, 0, 30), neck: R(14) }, { belly: sq(-0.3), root: M(0, 0.2, 0), armR: R(0, 0, -150), armL: R(0, 0, 20), neck: R(-20), tuft1: R(-40), tuft2: R(-30) }, { belly: sq(-0.08), root: M(0, 0.1, 0), armR: R(0, 0, -120) }) },
    Dtilt: { fps: 30, keys: atk({ belly: sq(0.32), root: M(0, -0.28, -0.06), chest: M(0, -0.2, 0), footR: M(0, 0.04, -0.1) }, { belly: sq(0.3), root: M(0, -0.3, 0.14), chest: M(0, -0.22, 0), footR: M(0, 0.02, 0.56), footL: M(0, 0, -0.1), tuft1: R(20) }, { belly: sq(0.26), root: M(0, -0.26, 0.1), footR: M(0, 0.02, 0.44) }) },
    Belly: { fps: 30, keys: atk({ all: flip(-12, C), belly: sq(0.15), root: M(0, 0.06, -0.1), armL: R(0, 0, 40), armR: R(0, 0, -40) }, { all: flip(80, C), belly: sq(0.25), root: M(0, -0.3, 0.6), armL: R(0, 40, 60), armR: R(0, -40, -60), footL: M(0, 0.16, -0.2), footR: M(0, 0.16, -0.2), tuft1: R(40) }, { all: flip(76, C), root: M(0, -0.32, 0.74), belly: sq(0.15) }) },   /* dash attack: a running belly flop */
    Fsmash: { fps: 30, keys: atk({ all: flip(-34, C), belly: sq(-0.18), root: M(0, 0.06, -0.2), chest: RM(-20, 0, 0, 0, 0.08, 0), armL: R(0, 0, 80), armR: R(0, 0, -80), tuft1: R(-44), tuft2: R(-34) }, { all: flip(40, C), belly: sq(0.14), root: M(0, -0.04, 0.6), chest: RM(24, 0, 0, 0, 0.02, 0), ...fists(90, 90, -20), tuft1: R(40), tuft2: R(32) }, { all: flip(46, C), belly: sq(0.06), root: M(0, -0.05, 0.62) }) },
    Usmash: { fps: 30, keys: atk({ belly: sq(0.4), root: M(0, -0.28, 0), chest: M(0, -0.2, 0), armL: R(0, 0, -40), armR: R(0, 0, 40), neck: R(20) }, { belly: sq(-0.4), root: M(0, 0.5, 0), chest: M(0, 0.18, 0), armL: R(0, 0, 160), armR: R(0, 0, -160), neck: R(-30), tuft1: R(-50), tuft2: R(-40) }, { belly: sq(-0.15), root: M(0, 0.4, 0), armL: R(0, 0, 130), armR: R(0, 0, -130) }) },
    Dsmash: { fps: 30, keys: atk({ belly: sq(-0.15), root: M(0, 0.12, 0), armL: R(0, 0, 130), armR: R(0, 0, -130), footL: M(0, 0.1, 0), footR: M(0, 0.1, 0) }, { belly: sq(0.42), root: M(0, -0.3, 0), chest: M(0, -0.2, 0), armL: R(0, -90, -10), armR: R(0, 90, 10), footL: M(0.3, 0, 0.1), footR: M(-0.3, 0, -0.1), tuft1: R(30) }, { belly: sq(0.25), root: M(0, -0.22, 0), armL: R(0, -80), armR: R(0, 80) }) },   /* slams down, both fists out to the sides */
    Axe: { fps: 30, keys: atk({ all: flip(-30, C), belly: sq(-0.15), armL: R(0, 0, 140), armR: R(0, 0, -140), tuft1: R(-30) }, { all: flip(70, C), belly: sq(0.25), ...fists(90, 90, -40), tuft1: R(40), tuft2: R(30) }, { all: flip(100, C), belly: sq(0.1) }) },   /* forward air: a somersault bringing both fists down */
    Juggle: { fps: 30, keys: atk({ all: flip(16, C), belly: sq(0.2), armL: R(0, 0, -20), armR: R(0, 0, 20), footL: M(0, 0.14, 0.1), footR: M(0, 0.14, 0.1) }, { all: flip(-30, C), belly: sq(-0.3), armL: R(0, 0, 160), armR: R(0, 0, -120), footL: M(0, -0.1, 0), tuft1: R(-40), tuft2: R(-30) }, { all: flip(-20, C), belly: sq(-0.1), armL: R(0, 0, 120), armR: R(0, 0, -150) }) },   /* up air: both fists flung overhead */
    Grab: { fps: 30, keys: atk({ belly: sq(0.1), root: M(0, -0.03, -0.08), armL: R(0, 0, 30), armR: R(0, 0, -30), chest: R(-8) }, { belly: sq(-0.18), root: M(0, -0.02, 0.38), all: R(8), chest: R(14), ...fists(92), tuft1: R(18) }, { root: M(0, -0.02, 0.3), ...fists(98) }) },
    /* ---- specials ---- */
    HotPotato: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.08, use: 'squash', pose: { belly: sq(0.32), root: M(0, -0.16, 0), chest: RM(12, 0, 0, 0, -0.18, 0), ...fists(70), tuft1: R(20) }, in: 'out' },   /* it bursts on frame 5 of 29, 0.17 through */
      { t: 0.14, pose: { all: R(0, 0, 5), belly: sq(0.36) } },
      { t: 0.17, reset: true, use: ['stand', 'stretch'], pose: { belly: sq(-0.38), root: M(0, 0.18, 0), chest: M(0, 0.14, 0), armL: R(0, 0, 150), armR: R(0, 0, -150), tuft1: R(-40), tuft2: R(-34), footL: M(0, -0.1, 0), footR: M(0, -0.1, 0) }, in: 'snap' },
      { t: 0.32, pose: { belly: sq(-0.2) } }, { t: 0.6, pose: { belly: sq(0), all: flip(-30, C), armL: R(0, 0, 90), armR: R(0, 0, -90), tuft1: R(10) }, in: 'quad' }, { t: 1.0, reset: true, use: 'stand', pose: { armL: R(0, 0, 40), armR: R(0, 0, -40), tuft1: R(20) } }] },
    SpudCharge: { fps: 30, keys: [{ t: 0, use: 'squash', pose: { belly: sq(0.22), root: M(0, -0.14, 0), chest: RM(16, 0, 0, 0, -0.14, 0), ...fists(80, 80, -10), all: R(0, 0, 3), tuft1: R(24) } }, { t: 0.1, pose: { all: R(0, 0, -3), belly: sq(0.26), tuft1: R(18, 0, 8) } }, { t: 0.2, pose: { all: R(0, 0, 3), belly: sq(0.22), tuft1: R(24, 0, -8) } }] },   /* hunched over the potato, shaking */
    SpudBurst: { fps: 30, keys: [{ t: 0, use: 'squash', pose: { belly: sq(0.3), root: M(0, -0.18, 0), ...fists(80, 80, -10), tuft1: R(24) } }, { t: 0.17, reset: true, use: ['stand', 'stretch'], pose: { belly: { scale: [1.25, 0.7, 1.25] }, armL: R(0, 0, 110), armR: R(0, 0, -110), footL: M(0.16, 0, 0), footR: M(-0.16, 0, 0), tuft1: R(-50), tuft2: R(-44) }, in: 'snap' },   /* the blast on its 4th frame: thrown wide open */
      { t: 0.4, pose: { belly: sq(-0.1) } }, { t: 0.7, reset: true, use: 'stand', pose: { belly: sq(0.08), tuft1: R(20) }, in: 'quad' }, { t: 1.0, reset: true, use: 'stand', in: 'back' }] },
    BagIt: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { belly: sq(0.3) } }, { t: 0.18, reset: true, use: ['stand', 'stretch'], pose: { belly: sq(-0.3), all: flip(24, C), armL: R(0, 0, 70), armR: R(0, 0, -70), neck: R(-30), tuft1: R(-30) }, in: 'out' },
      { t: 0.3, pose: { all: flip(36, C), armL: R(0, -20, 80), armR: R(0, 20, -80), neck: R(-40) } }, { t: 0.44, pose: { all: flip(40, C), ...fists(100), belly: sq(0.1), neck: R(30), tuft1: R(30) }, in: 'snap' }, { t: 0.6, pose: { all: flip(30, C), ...fists(96) } }, { t: 0.9, reset: true, use: 'stand', in: 'back' }] },
    /* neutral air (multi-hit, dragging): curls up and rolls twice; the body thumps on each carrying hit (0.15, 0.25, 0.35),
       then the finisher at 0.45 flings the fists out wide, and he uncurls with an overshoot */
    SpinDrag: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.08, use: 'curl', pose: { all: flip(30, C), belly: sq(0.2) }, in: 'out' },
      { t: 0.15, use: 'curl', pose: { all: flip(140, C), belly: sq(0.28) }, in: 'lin' }, { t: 0.19, pose: { all: flip(230, C), belly: sq(0.05) }, in: 'lin' },
      { t: 0.23, pose: { all: flip(320, C), belly: sq(0.28) }, in: 'lin' }, { t: 0.27, pose: { all: flip(410, C), belly: sq(0.05) }, in: 'lin' },
      { t: 0.31, pose: { all: flip(500, C), belly: sq(0.28) }, in: 'lin' }, { t: 0.35, pose: { all: flip(590, C), belly: sq(0.05) }, in: 'lin' },
      { t: 0.4, reset: true, use: ['stand', 'stretch'], pose: { all: flip(670, C), belly: sq(-0.3), armL: R(0, 0, 100), armR: R(0, 0, -100), footL: M(0.15, -0.05, 0), footR: M(-0.15, -0.05, 0), tuft1: R(-40), tuft2: R(-34) }, in: 'snap' },
      { t: 0.48, pose: { all: flip(700, C), belly: sq(-0.2) } },
      { t: 0.85, reset: true, use: 'stand', pose: { all: flip(720, C), belly: sq(0.06) }, in: 'back' }] },
    /* Tumble (down special): a gathering squash, then a different roll for each direction it bursts */
    TumblePrep: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'curl', pose: { belly: sq(0.3), root: M(0, -0.12, 0) }, in: 'out' }] },
    TumbleLift: { fps: 30, keys: roll('yaw', 720, 0.6, { belly: { scale: [0.8, 1.4, 0.8] } }, { belly: sq(-0.1) }, { armL: R(0, 0, 40), armR: R(0, 0, -40) }) },   /* corkscrews upward, stretched tall */
    TumbleSlide: { fps: 30, keys: roll('flip', 720, 0.8, { belly: { scale: [1.3, 0.75, 1.15] } }, { belly: sq(0.15) }, { belly: sq(0.1) }) },   /* bowls along the ground, squashed flat */
    TumbleDive: { fps: 30, keys: roll('flip', 720, 0.7, { belly: { scale: [0.85, 1.25, 0.85] } }, { belly: sq(-0.15) }, {}) },   /* dives forward and down, stretched along its path */
    TumbleStall: { fps: 30, keys: roll('yaw', 720, 0.6, { belly: sq(0.15) }, { belly: sq(0.05) }, { armL: R(0, 0, 50), armR: R(0, 0, -50), belly: sq(-0.1) }) },   /* a spin in place, hanging in the air */
    TumbleDrop: { fps: 30, keys: roll('flip', 720, 0.75, { belly: { scale: [0.8, 1.35, 0.8] } }, { belly: sq(-0.15) }, { armL: R(0, 0, 60), armR: R(0, 0, -60), tuft1: R(-30) }) },   /* through the platform: stretched long, still rolling */
  },
};
const out = path.join(__dirname, '..', '..', 'assets', 'potato-sack', 'work');
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(sack, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/potato-sack-rigged.glb', texture: 1024, out: 'export/potato-sack-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + sack.bones.length + ' bones, ' + Object.keys(sack.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const hop = { clip: 'Hop' };
const L3 = (clip, s, e) => A(clip, 0.34, 0.44, s || 0, e || 0.9);   /* strike key at 0.34 (built with rig.py --start 0, so keys play at their own times) */
const entry = { file: 'assets/potato-sack/export/potato-sack-v1.glb', height: 13, feel: 1,
  clips: { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: hop, run: { clip: 'Bound' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Skid' }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' },
    land: { clip: 'Land', from: 0, to: 0.4 }, landHard: { clip: 'LandHard' }, shield: { clip: 'Shield', from: 0, to: 0.15 }, shieldHit: { clip: 'ShieldHit' }, hit: { clip: 'Hit', from: 0, to: 0.6 }, hitHeavy: { clip: 'HitHeavy' }, launchUp: { clip: 'LaunchUp' }, spike: { clip: 'Spike' }, launch: { clip: 'Launch' },
    tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true }, airdodge: { clip: 'AirDodge' }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Fall' },
    hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'ThrowF' }, throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'ThrowB' }, throw_u: { clip: 'ThrowU' }, throw_d: { clip: 'ThrowD' }, throw_s: { clip: 'ThrowS' }, swap: { clip: 'Tumble', bounce: true }, respawn: { clip: 'Respawn' },
    spudCharge: { clip: 'SpudCharge' }, spudBurst: { clip: 'SpudBurst' }, tumble_prep: { clip: 'TumblePrep' }, tumble_lift: { clip: 'TumbleLift' }, tumble_slide: { clip: 'TumbleSlide' }, tumble_dive: { clip: 'TumbleDive' }, tumble_stall: { clip: 'TumbleStall' }, tumble_drop: { clip: 'TumbleDrop' } },
  strikers: [{ bone: 'fistL', ext: 1.4 }, { bone: 'fistR', ext: 1.4 }, { bone: 'footL', ext: 1.2 }, { bone: 'footR', ext: 1.2 }, { bone: 'tuft2', ext: 1.2 }, { bone: 'neck', ext: 2.2 }],   /* neck: the top of the sack's body, which leads in its slams */
  springs: [{ bones: ['tuft1', 'tuft2'], k: 0.3, d: 0.66, max: 0.7, drag: 0.14 }],
  attacks: { jab: L3('Jab1'), jab2: L3('Jab2'), jab3: L3('Jab3'), ftilt: L3('Ftilt'), utilt: L3('Utilt'), dtilt: L3('Dtilt'), dash: L3('Belly'),
    fsmash: L3('Fsmash'), usmash: L3('Usmash'), dsmash: L3('Dsmash'),
    nair: A('SpinDrag', 0.15, 0.48, 0, 0.85),   /* active frames 3 to 10: three carrying thumps, then the finisher fling */ fair: L3('Axe'), bair: A('BackKick', 0.39, 0.52), uair: L3('Juggle'), dair: A('Stomp', 0.39, 0.52),
    grab: L3('Grab'), getup: A('Sweep', 0.34, 0.52), nspec: A('SpudBurst', 0.17, 0.3, 0, 1), sspec: A('BagIt', 0.3, 0.6, 0.12, 0.9), uspec: A('HotPotato', 0.17, 0.2, 0, 1), dspec: A('TumbleSlide', 0.1, 0.5, 0, 1), '*': L3('Jab1') } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current['Potato Sack'] = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
