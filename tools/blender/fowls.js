// Writes the skeleton and animation spec for each of the five Furious Fowls birds (assets/fowl-<bird>/work/rig.json),
// which tools/blender/rig.py turns into rigged, animated models, and adds their entries to the game's manifest: one for
// the bird in the slingshot's pouch and one for the bird alone (the same model).
//   node tools/blender/fowls.js
// Then for each bird:  blender -b --factory-startup --python tools/blender/rig.py -- --mesh assets/fowl-<bird>/raw/<task>/model_url.glb
//                          --spec assets/fowl-<bird>/work/rig.json --out assets/fowl-<bird>/work/<bird>-rigged.glb
//                      node tools/pack.mjs assets/fowl-<bird>/work/pack.json
// The birds are round, so all five share one small skeleton placed by each model's size: body, crest, two wings, tail, two feet.
// Turning: positive pitch tips forward, positive yaw turns to its left, positive roll raises its left side.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
/* each model's half-width, lowest and highest point, and how far it reaches forward and back (from the generated meshes); game height alone, and how high it rides in the pouch */
const BIRDS = { rusty: { name: 'Rusty', x: 0.63, y0: -0.79, y1: 0.78, z: 0.95, h: 7, lift: 8.6 }, bolt: { name: 'Bolt', x: 0.6, y0: -0.89, y1: 0.88, z: 0.95, h: 7.4, lift: 8.6 },
  cinder: { name: 'Cinder', x: 0.79, y0: -0.95, y1: 0.95, z: 0.83, h: 8.8, lift: 8.4 }, pip: { name: 'Pip', x: 0.75, y0: -0.95, y1: 0.95, z: 0.95, h: 5.8, lift: 8.8 }, pearl: { name: 'Pearl', x: 0.65, y0: -0.95, y1: 0.95, z: 0.75, h: 7.8, lift: 8.6 } };
/* ---- five personalities. The same skeleton, but each bird moves to its own rhythm:
   tempo  how long its loops take (1 = Flint)        wt    how far it squashes on weight (anticipation and landings)
   lean   how far it leans into movement (degrees)   wing  how much its wings join in
   bob    how high its riding bob goes               snap  0..1, how sharply strikes arrive (Bolt) versus wind up (Cinder) */
const PERSONA = {
  Rusty:  { tempo: 1.0, wt: 1.1, lean: 10, wing: 0.7, bob: 1.0, snap: 0.5, note: 'Flint: a determined brawler. Planted feet, chest out, forceful strikes that commit the whole body.' },
  Bolt:   { tempo: 0.62, wt: 0.75, lean: 24, wing: 0.9, bob: 0.7, snap: 1.0, note: 'Bolt: a restless speedster. Leans forward, taps a foot, strikes arrive almost without wind-up, brakes hard.' },
  Cinder: { tempo: 1.45, wt: 1.6, lean: 6, wing: 0.55, bob: 1.3, snap: 0.15, note: 'Cinder: a heavyweight. Slow heaving breath, deep compression before every hit, ground-shaking landings.' },
  Pip:    { tempo: 0.8, wt: 1.0, lean: 14, wing: 1.1, bob: 1.6, snap: 0.6, note: 'Pip: a trickster. Bouncy, looks left and right, little extra hops, sly sideways moves.' },
  Pearl:  { tempo: 1.3, wt: 0.55, lean: 4, wing: 1.7, bob: 0.6, snap: 0.35, note: 'Pearl: graceful in the air. Wings always moving, floats on the top of every arc, lands softly.' } };
/* All the clips for one bird. Attack clips share one layout so the game can stretch them onto the real frame data:
   wind-up to 0.3, contact 0.3 to 0.42, follow-through and overshoot to 0.6, recovery back to standing by 0.9. */
function birdClips(b, H, X, Z, flip, wings, feet) {
  const P = PERSONA[b.name], w = P.wt, T = P.tempo, L = P.lean, Wg = P.wing, cr = n => R(n);
  const sq = k => ({ scale: [1 + k * 0.55, 1 - k, 1 + k * 0.55] });   /* k > 0 squashes the body, k < 0 stretches it */
  const body = (k, p, y) => Object.assign({}, sq(k), p !== undefined ? { rot: [p, y || 0, 0] } : {});
  const strikeIn = P.snap > 0.7 ? 'snap' : P.snap < 0.3 ? 'out' : 'snap';
  const atk = (wind, hit, over) => [   /* the shared attack layout: wind-up, strike, overshoot, settle */
    { t: 0, use: 'stand' },
    { t: 0.3 * (1 - P.snap * 0.45), pose: wind, in: 'out' },
    { t: 0.3, pose: wind },
    { t: 0.34, reset: true, use: 'stand', pose: hit, in: strikeIn },
    { t: 0.42, pose: hit },
    { t: 0.55, pose: over, in: 'back' },
    { t: 0.9, reset: true, use: 'stand', in: 'quad' }];
  const idle = {
    Rusty: [{ t: 0, use: 'stand', pose: { body: body(0, -4) } }, { t: 0.7, pose: { body: body(-0.04, -6), crest: cr(-6), ...wings(-6, 8), root: M(0, H * 0.01, 0) } }, { t: 1.4, pose: { body: body(0.03, -3), crest: cr(2), ...wings(2, 4), root: M(0, -H * 0.01, 0) } }, { t: 2.0, pose: { body: body(0, -4), crest: cr(0), ...wings(0) } }],
    Bolt: [{ t: 0, use: 'stand', pose: { body: body(0, L * 0.5) } }, { t: 0.12, pose: { footL: M(0, H * 0.05, 0.02), crest: R(-8, 6) } }, { t: 0.24, pose: { footL: M(0, 0, 0), body: body(0.04, L * 0.5, 6) } }, { t: 0.36, pose: { footL: M(0, H * 0.05, 0.02), crest: R(-8, -6) } },
      { t: 0.48, pose: { footL: M(0, 0, 0), body: body(0.04, L * 0.5, -6), tail: R(0, 14) } }, { t: 0.8, pose: { body: body(-0.03, L * 0.6, 0), tail: R(0, -10), ...wings(8, -6) } }, { t: 1.24, pose: { body: body(0, L * 0.5), tail: R(0), ...wings(0) } }],
    Cinder: [{ t: 0, use: 'stand', pose: { body: body(0.12, 4), root: M(0, -H * 0.03, 0) } }, { t: 1.1, pose: { body: body(-0.12, -10), root: M(0, H * 0.04, 0), ...wings(18, -6), crest: cr(-16), tail: R(-10) }, in: 'quad' }, { t: 1.5, pose: { body: body(-0.12, -10) } }, { t: 2.9, pose: { body: body(0.12, 4), root: M(0, -H * 0.03, 0), ...wings(-6), crest: cr(8), tail: R(4) }, in: 'quad' }],   /* a big, slow heave */
    Pip: [{ t: 0, use: 'stand' }, { t: 0.2, pose: { all: R(0, 26), crest: R(0, 0, 10) } }, { t: 0.5, pose: { all: R(0, 26) } }, { t: 0.7, pose: { all: R(0, -26), crest: R(0, 0, -10) }, in: 'back' }, { t: 1.0, pose: { all: R(0, -26) } },
      { t: 1.12, pose: { all: R(0, 0), root: M(0, H * 0.12, 0), body: body(-0.1), ...wings(30) }, in: 'out' }, { t: 1.26, pose: { root: M(0, 0, 0), body: body(0.12), ...wings(0) } }, { t: 1.6, reset: true, use: 'stand' }],
    Pearl: [{ t: 0, use: 'stand', pose: { body: body(-0.03, -3), ...wings(14) } }, { t: 0.65, pose: { root: M(0, H * 0.03, 0), ...wings(34, -6), tail: R(-12), crest: cr(-10) }, in: 'quad' }, { t: 1.3, pose: { root: M(0, 0, 0), ...wings(8, 4), tail: R(4), crest: cr(2) }, in: 'quad' }, { t: 2.6, pose: { body: body(-0.03, -3), ...wings(14), tail: R(0), crest: cr(0) } }] }[b.name];
  /* a second idle, played now and then after standing still a while */
  const idle2 = {
    Rusty: [{ t: 0, use: 'stand' }, { t: 0.25, pose: { body: body(0.08, 10), ...wings(-10, 30) }, in: 'out' }, { t: 0.45, pose: { body: body(-0.1, -14), ...wings(40, -20), crest: cr(-20), root: M(0, H * 0.04, 0) }, in: 'back' }, { t: 0.9, pose: { body: body(-0.06, -10) } }, { t: 1.3, reset: true, use: 'stand', in: 'quad' }],   /* puffs his chest and squares up */
    Bolt: [{ t: 0, use: 'stand' }, { t: 0.15, pose: { all: R(0, 70), body: body(0.06, L) }, in: 'snap' }, { t: 0.3, pose: { all: R(0, 70) } }, { t: 0.42, pose: { all: R(0, -10), body: body(-0.05, L) }, in: 'snap' }, { t: 0.6, pose: { root: M(0, H * 0.1, 0), body: body(-0.1) } }, { t: 0.75, reset: true, use: 'stand', pose: { body: body(0.08) } }, { t: 0.9, reset: true, use: 'stand' }],   /* glances behind him, hops in place */
    Cinder: [{ t: 0, use: 'stand' }, { t: 0.5, pose: { body: body(0.15, 8), root: M(0, -H * 0.05, 0) }, in: 'quad' }, { t: 0.9, pose: { body: body(-0.12, -10), root: M(0, H * 0.03, 0), ...wings(24), crest: cr(-14) }, in: 'back' }, { t: 1.6, pose: { body: body(-0.1, -8) } }, { t: 2.2, reset: true, use: 'stand', pose: { body: body(0.12) }, in: 'quad' }, { t: 2.5, reset: true, use: 'stand' }],   /* a big heave and a huff */
    Pip: [{ t: 0, use: 'stand' }, { t: 0.15, pose: { root: M(0, H * 0.2, 0), all: flip(-60), ...wings(40) }, in: 'out' }, { t: 0.32, pose: { root: M(0, H * 0.24, 0), all: flip(-200) } }, { t: 0.5, pose: { root: M(0, 0, 0), all: flip(-360), body: body(0.15) }, in: 'quad' }, { t: 0.62, reset: true, use: 'stand', pose: { all: R(0, 0), body: body(-0.05) }, in: 'back' }, { t: 0.8, reset: true, use: 'stand' }],   /* a little backflip */
    Pearl: [{ t: 0, use: 'stand' }, { t: 0.4, pose: { ...wings(70, -10), body: body(-0.08, -10), crest: cr(-20), root: M(0, H * 0.04, 0) }, in: 'quad' }, { t: 0.8, pose: { ...wings(76, -14), all: R(0, 0, 8) } }, { t: 1.2, pose: { ...wings(70, -10), all: R(0, 0, -8) } }, { t: 1.6, pose: { all: R(0, 0, 0), ...wings(20) } }, { t: 2.0, reset: true, use: 'stand', in: 'quad' }] }[b.name];
  const hopUp = H * 0.14 * P.bob, lean = L;
  return {
    Idle: { fps: 30, keys: idle },
    Idle2: { fps: 30, keys: idle2 },
    /* the riding bob while the slingshot walks: 0 to 0.7 is the hop, 0.7 to 1 is planted */
    Hop: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { body: body(0.1 * w, lean * 0.5) } }, { t: 0.1, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, hopUp * 0.7, 0), body: body(-0.08 * w, lean), ...feet(-H * 0.02) }, in: 'out' },
      { t: 0.2, reset: true, use: 'stand', pose: { root: M(0, hopUp, 0), body: body(0, lean * 0.6), ...wings(34 * Wg), ...feet(H * 0.05, 0.05), crest: cr(-10) } }, { t: 0.3, reset: true, use: ['stand', 'squash'], pose: { root: M(0, -H * 0.05 * w, 0), body: body(0.12 * w, lean * 0.4), crest: cr(12) }, in: 'quad' }, { t: 0.36, reset: true, use: 'stand', pose: { body: body(0, lean * 0.4) }, in: 'back' }] },
    Run: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(0.06 * w, lean * 1.6), crest: cr(lean * 0.8 + 6), tail: R(-lean * 0.6), ...wings(10 * Wg, -30) } }, { t: 0.12, pose: { root: M(0, hopUp * 0.6, 0), body: body(-0.06 * w, lean * 1.8), ...wings(30 * Wg, -34) }, in: 'out' },
      { t: 0.24, pose: { root: M(0, 0, 0), body: body(0.06 * w, lean * 1.6), ...wings(10 * Wg, -30) }, in: 'quad' }] },
    Skid: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(0.1 * w, -lean * 1.2 - 8), root: M(0, -H * 0.03, -0.06), crest: cr(-24), tail: R(30), ...wings(40 * Wg, 20), ...feet(0, 0.14) } }, { t: 0.18, pose: { body: body(0.04, -lean * 0.6), crest: cr(-8) }, in: 'quad' }, { t: 0.35, reset: true, use: 'stand', in: 'back' }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'squash', pose: { root: M(0, -H * 0.12, 0), body: Object.assign(body(0.18 * w, 6), { move: [0, -H * 0.06, 0] }) }, in: 'back' }] },
    Rise: { fps: 30, keys: [{ t: 0, use: ['stand', 'stretch'], pose: { body: body(-0.12 / w), ...wings(60 * Wg + 10), crest: cr(-20), tail: R(20), ...feet(-H * 0.03) } }, { t: 0.2, pose: { ...wings(-20 * Wg), body: body(-0.04) } }, { t: 0.4, pose: { ...wings(50 * Wg), ...feet(H * 0.04), body: body(0) } }] },
    Fall: { fps: 30, keys: b.name === 'Pearl'
      ? [{ t: 0, use: 'stand', pose: { body: body(-0.04, -6), ...wings(80, -8), tail: R(-20), ...feet(H * 0.04) } }, { t: 0.3, pose: { ...wings(56, -4), root: M(0, H * 0.02, 0) }, in: 'quad' }, { t: 0.6, pose: { ...wings(80, -8), root: M(0, 0, 0) }, in: 'quad' }]   /* a slow, buoyant flutter */
      : [{ t: 0, use: 'stand', pose: { body: R(6), crest: R(24), tail: R(-16), ...wings(70 * Wg), ...feet(H * 0.05) } }, { t: 0.2 * T, pose: { ...wings(40 * Wg) } }, { t: 0.4 * T, pose: { ...wings(70 * Wg) } }] },
    FastFall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(-0.12, -4), crest: cr(30), tail: R(-30), ...wings(-12, 20), ...feet(-H * 0.04) } }, { t: 0.2, pose: { body: body(-0.14, -4), ...wings(-18, 24) } }] },
    Land: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { root: M(0, -H * 0.1 * w, 0), body: body(0.16 * w), crest: cr(16) } }, { t: 0.14, reset: true, use: 'stand', pose: { body: body(-0.05 * w), crest: cr(-6) }, in: 'out' }, { t: 0.4, reset: true, use: 'stand', in: 'back' }] },
    LandHard: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { root: M(0, -H * 0.18 * Math.min(1.3, w), 0), body: body(0.3 * Math.min(1.3, w), 10), crest: cr(30), ...wings(-20, 30), tail: R(-20) } }, { t: 0.2, pose: { root: M(0, -H * 0.14, 0), body: body(0.22, 8) } }, { t: 0.36, reset: true, use: 'stand', pose: { body: body(-0.08), crest: cr(-10) }, in: 'out' }, { t: 0.6, reset: true, use: 'stand', in: 'back' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, use: 'squash', pose: { ...wings(-6, 62), crest: R(20), body: body(0.1, -8) }, in: 'back' }] },
    ShieldHit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { ...wings(-6, 62), crest: R(28), body: body(0.2, -18), root: M(0, 0, -0.08) } }, { t: 0.15, pose: { body: body(0.1, -8), root: M(0, 0, 0) }, in: 'back' }] },
    /* hit reactions: light, heavy, and launched up, down (spiked) or away */
    Hit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-18), body: body(0.1, -10), crest: cr(-30), ...wings(40), ...feet(H * 0.03, 0.08) } }, { t: 0.25, pose: { all: flip(-8), crest: cr(-8), ...wings(20) }, in: 'back' }, { t: 0.6, reset: true, use: 'stand', in: 'quad' }] },
    HitHeavy: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-40), body: body(-0.2, -20), crest: cr(-50), ...wings(80, -20), ...feet(H * 0.06, 0.2), tail: R(30) } }, { t: 0.3, pose: { all: flip(-30), body: body(0.08, -12) } }, { t: 0.6, pose: { all: flip(-6), crest: cr(-10), ...wings(20) }, in: 'back' }] },
    LaunchUp: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(-0.25, -30), crest: cr(-40), ...wings(-30, -10), ...feet(-H * 0.08, -0.1), tail: R(40) } }, { t: 0.3, pose: { all: flip(-90), body: body(-0.1, -10), ...wings(60) } }, { t: 0.6, pose: { all: flip(-180), body: body(0) } }] },
    Spike: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(40), body: body(0.25, 30), crest: cr(50), ...wings(90, 20), ...feet(H * 0.1, -0.1) } }, { t: 0.3, pose: { all: flip(70), body: body(-0.2, 20) } }, { t: 0.6, pose: { all: flip(90), body: body(-0.1, 10) } }] },
    Launch: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-60), body: body(-0.18, -20), crest: cr(-40), ...wings(70, -30), ...feet(H * 0.04, 0.2) } }, { t: 0.3, pose: { all: flip(-150) } }, { t: 0.6, pose: { all: flip(-240) } }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { body: R(26), crest: R(38) } }, { t: 0.6, pose: { body: R(18), crest: R(30) } }] },
    Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-50), body: body(0.1) } }, { t: 0.3, pose: { all: RM(-90, 0, 0, 0, Z * 0.55, -H * 0.1), body: body(0.2), ...wings(30), ...feet(H * 0.03, 0.08) }, in: 'back' }] },
    Dodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.14, pose: { all: R(0, 40), root: M(0, -H * 0.04, -0.1), body: body(0.12, -10), ...wings(-10, 40) }, in: 'out' }, { t: 0.4, reset: true, use: 'stand', in: 'back' }] },
    AirDodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.12, pose: { all: R(0, 0, 30), body: body(0.15), ...wings(-14, 50), crest: cr(20), ...feet(H * 0.06, 0) }, in: 'out' }, { t: 0.5, pose: { all: R(0, 0, -10), body: body(0.05) } }, { t: 0.8, reset: true, use: 'stand', in: 'back' }] },
    Hold: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(0.04, 10), ...wings(0, 70) } }, { t: 0.3, pose: { body: body(0.08, 13) } }, { t: 0.6, pose: { body: body(0.04, 10) } }] },
    Held: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, H * 0.05, 0), body: body(-0.1), ...wings(50), ...feet(-H * 0.02, 0.06), crest: R(0, 0, 14) } }, { t: 0.2, pose: { ...wings(20), ...feet(-H * 0.02, -0.04), crest: R(0, 0, -14), body: body(-0.04) } }, { t: 0.4, pose: { ...wings(50), ...feet(-H * 0.02, 0.06), crest: R(0, 0, 14), body: body(-0.1) } }] },
    ThrowF: { fps: 30, keys: atk({ body: body(0.15, -20), crest: cr(-30), ...wings(20, 30) }, { all: flip(40), body: body(-0.18, 10), root: M(0, 0, Z * 0.5), crest: cr(30), ...wings(60, -30) }, { all: flip(20), body: body(0.06), root: M(0, 0, Z * 0.3) }) },
    ThrowB: { fps: 30, keys: atk({ all: R(0, 40), body: body(0.12) }, { all: R(0, 200), body: body(-0.16), ...wings(80) }, { all: R(0, 330), body: body(0.05) }).concat([{ t: 0.92, reset: true, use: 'stand', pose: { all: R(0, 360) } }]) },
    ThrowU: { fps: 30, keys: atk({ body: body(0.25, 20), root: M(0, -H * 0.1, 0), crest: cr(30) }, { body: body(-0.3, -40), root: M(0, H * 0.12, 0), crest: cr(-50), ...wings(90) }, { body: body(-0.1, -20), root: M(0, H * 0.04, 0) }) },
    ThrowD: { fps: 30, keys: atk({ root: M(0, H * 0.14, 0), body: body(-0.15), ...wings(70), ...feet(H * 0.08) }, { root: M(0, -H * 0.08, 0), body: body(0.3, 20), ...wings(-20), ...feet(-H * 0.04) }, { body: body(0.12, 10) }) },
    Ledge: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(-0.1, -10), ...wings(90, 10), ...feet(-H * 0.06, 0.1) } }, { t: 0.3, pose: { ...wings(60, 10) } }, { t: 0.6, pose: { ...wings(90, 10) } }] },
    Respawn: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(-0.1, -6), ...wings(40 * Wg), crest: cr(-14) } }, { t: 0.5 * T, pose: { body: body(0.04), ...wings(10), crest: cr(0) }, in: 'quad' }, { t: 1.0 * T, pose: { body: body(-0.1, -6), ...wings(40 * Wg), crest: cr(-14) }, in: 'quad' }] },
    /* the entrance when chosen on the selector wheel: each bird its own way in */
    Select: { fps: 30, keys: ({
      Rusty: [{ t: 0, use: 'stand', pose: { root: M(0, -H * 0.3, 0), body: body(0.3) } }, { t: 0.15, pose: { root: M(0, H * 0.08, 0), body: body(-0.2), ...wings(30, -30) }, in: 'out' }, { t: 0.3, reset: true, use: 'stand', pose: { body: body(0.15, 14), ...wings(-10, 30), crest: cr(20) }, in: 'quad' }, { t: 0.5, pose: { body: body(-0.08, -12), ...wings(40, -20) }, in: 'back' }, { t: 0.7, reset: true, use: 'stand', in: 'quad' }],
      Bolt: [{ t: 0, use: 'stand', pose: { all: R(0, -90), root: M(0, 0, -Z), body: body(-0.25, L * 2) } }, { t: 0.12, pose: { all: R(0, 0), root: M(0, 0, Z * 0.2), body: body(-0.1, L * 1.5) }, in: 'snap' }, { t: 0.2, pose: { root: M(0, 0, 0), body: body(0.15, -10), crest: cr(-20) }, in: 'out' }, { t: 0.45, reset: true, use: 'stand', in: 'back' }],
      Cinder: [{ t: 0, use: 'stand', pose: { root: M(0, H * 0.4, 0), body: body(-0.1) } }, { t: 0.2, pose: { root: M(0, -H * 0.1, 0), body: body(0.4, 10), crest: cr(30), ...wings(-20) }, in: 'snap' }, { t: 0.4, pose: { root: M(0, -H * 0.06, 0), body: body(0.25, 8) } }, { t: 0.7, reset: true, use: 'stand', pose: { body: body(-0.1, -10), ...wings(30) }, in: 'quad' }, { t: 0.9, reset: true, use: 'stand', in: 'back' }],
      Pip: [{ t: 0, use: 'stand', pose: { all: R(0, 0, 0), root: M(0, H * 0.3, 0), body: { scale: [0.3, 0.3, 0.3] } } }, { t: 0.12, pose: { root: M(0, H * 0.2, 0), body: { scale: [1.2, 1.2, 1.2] }, all: R(0, 180) }, in: 'back' }, { t: 0.3, pose: { root: M(0, 0, 0), all: R(0, 360), body: body(0.12) }, in: 'quad' }, { t: 0.5, reset: true, use: 'stand', pose: { all: R(0, 360) }, in: 'back' }],
      Pearl: [{ t: 0, use: 'stand', pose: { root: M(0, H * 0.35, 0), ...wings(80, -10), body: body(-0.1, -10) } }, { t: 0.3, pose: { root: M(0, H * 0.1, 0), ...wings(30) }, in: 'quad' }, { t: 0.5, pose: { root: M(0, H * 0.02, 0), ...wings(70) } }, { t: 0.7, reset: true, use: 'stand', pose: { ...wings(20) }, in: 'quad' }, { t: 0.9, reset: true, use: 'stand', in: 'back' }] })[b.name] },
    /* ---- attacks ---- */
    Peck: { fps: 30, keys: atk({ all: flip(-14 * w), root: M(0, 0, -0.08 * w), crest: cr(-18), body: body(0.1 * w) }, { all: flip(34), root: M(0, -H * 0.02, Z * 0.42), crest: cr(26), body: body(-0.12), ...wings(-10) }, { all: flip(24), root: M(0, -H * 0.02, Z * 0.36) }) },
    Peck2: { fps: 30, keys: atk({ all: R(0, 20), body: body(0.08 * w), ...wings(30, 20) }, { all: Object.assign(flip(30), { rot: [30, -22, 10] }), root: M(0, 0, Z * 0.44), body: body(-0.12), wingL: R(0, -60, 50), crest: cr(24) }, { all: R(10, -14, 0), root: M(0, 0, Z * 0.3) }) },
    Bash: { fps: 30, keys: atk({ all: flip(-28 * w), root: M(0, H * 0.03, -Z * 0.2 * w), crest: cr(-30), ...wings(46), body: body(0.2 * w, -10) }, { all: flip(50), root: M(0, -H * 0.03, Z * 0.7), crest: cr(34), ...wings(-10, 30), body: body(-0.22) }, { all: flip(36), root: M(0, -H * 0.04, Z * 0.6), body: body(0.08) }) },
    Lunge: { fps: 30, keys: atk({ body: body(0.18 * w, -16), root: M(0, -H * 0.04, -Z * 0.2), crest: cr(-24), ...wings(10, 40), tail: R(20) }, { all: flip(22), body: body(-0.25, 16), root: M(0, 0, Z * 0.8), crest: cr(30), ...wings(30, -50), tail: R(-20), ...feet(0, -0.2) }, { all: flip(12), body: body(0.06, 8), root: M(0, 0, Z * 0.66) }) },
    Flick: { fps: 30, keys: atk({ body: body(0.18 * w, 16), crest: cr(30), root: M(0, -H * 0.06, 0) }, { all: flip(-30), body: body(-0.26, -30), crest: cr(-60), root: M(0, H * 0.1, 0), ...wings(70, -10) }, { all: flip(-16), body: body(-0.08, -14), crest: cr(-20), root: M(0, H * 0.04, 0) }) },
    Flap: { fps: 30, keys: atk({ root: M(0, -H * 0.14 * w, 0), body: body(0.25 * w), ...wings(-30) }, { root: M(0, H * 0.3, 0), body: body(-0.3), ...wings(80 * Math.max(1, Wg * 0.8)), crest: cr(-24), ...feet(-H * 0.04) }, { root: M(0, H * 0.34, 0), body: body(-0.1), ...wings(40) }) },
    Sweep: { fps: 30, keys: atk({ all: R(0, -30), root: M(0, -H * 0.14, 0), body: body(0.2 * w) }, { all: R(0, 150), root: M(0, -H * 0.14, 0), ...wings(50), tail: R(0, 40), body: body(0.12) }, { all: R(0, 320), root: M(0, -H * 0.1, 0) }).concat([{ t: 0.92, reset: true, use: 'stand', pose: { all: R(0, 360) } }]) },
    TailSweep: { fps: 30, keys: atk({ all: R(0, 30), root: M(0, -H * 0.12, 0), body: body(0.22 * w, 10), tail: R(0, -30) }, { all: R(0, -60), root: M(0, -H * 0.16, 0), body: body(0.18, 16), tail: R(-10, 50), ...feet(0, 0.1) }, { all: R(0, -40), root: M(0, -H * 0.12, 0), tail: R(0, 20) }) },
    Spin: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { all: flip(0) } }, { t: 0.22, pose: { all: flip(150) } }, { t: 0.42, pose: { all: flip(290) } }, { t: 0.7, reset: true, use: 'stand', pose: { all: flip(360) }, in: 'back' }] },
    /* flung out on the end of the spinning slingshot: stretched along the spin, wings swept back, crest flattened */
    Fling: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(0.12, 10), ...wings(-10, 30) } }, { t: 0.3, pose: { body: { scale: [0.86, 1.28, 0.86], rot: [-10, 0, 0] }, crest: cr(-40), tail: R(40), ...wings(10, -70), ...feet(-H * 0.06, -0.12) }, in: 'out' },
      { t: 0.36, pose: { body: { scale: [0.82, 1.34, 0.82], rot: [-14, 0, 0] }, ...wings(20, -76) } }, { t: 0.42, pose: { body: { scale: [0.86, 1.28, 0.86], rot: [-10, 0, 0] }, ...wings(8, -70) } }, { t: 0.6, pose: { body: body(0.15), crest: cr(20), ...wings(40) }, in: 'back' }, { t: 0.9, reset: true, use: 'stand', in: 'quad' }] },
    Dive: { fps: 30, keys: atk({ all: flip(-20), body: body(0.12, -10), ...wings(60), crest: cr(-20) }, { all: flip(60), body: body(-0.28, 10), root: M(0, -H * 0.06, Z * 0.5), ...wings(10, -60), crest: cr(40), tail: R(-30) }, { all: flip(44), body: body(-0.08), root: M(0, -H * 0.04, Z * 0.4) }) },
    Flip: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, pose: { all: flip(20), body: body(0.2) }, in: 'out' }, { t: 0.3, pose: { all: flip(20), body: body(0.22) } }, { t: 0.36, pose: { all: flip(-120), body: body(-0.28), ...wings(80), ...feet(-H * 0.06, 0.2) }, in: 'snap' },
      { t: 0.42, pose: { all: flip(-190), body: body(-0.2) } }, { t: 0.6, pose: { all: flip(-300), body: body(0.08), ...wings(30) }, in: 'back' }, { t: 0.9, reset: true, use: 'stand', pose: { all: flip(-360) }, in: 'quad' }] },
    Kick: { fps: 30, keys: atk({ all: flip(24), body: body(0.14 * w) }, { all: flip(64), root: M(0, H * 0.03, -Z * 0.4), body: body(-0.2), tail: R(-30), ...feet(-H * 0.06, -0.3) }, { all: flip(50), root: M(0, H * 0.03, -Z * 0.3) }) },
    Stomp: { fps: 30, keys: atk({ root: M(0, H * 0.08, 0), body: body(-0.12), ...wings(60), ...feet(H * 0.08) }, { root: M(0, -H * 0.1, 0), body: body(0.28 * w), ...wings(-20), ...feet(-H * 0.08) }, { root: M(0, -H * 0.12, 0), body: body(0.12) }) },
    Snatch: { fps: 30, keys: atk({ body: body(0.1, -10), crest: cr(-20), beak: R(-20) }, { all: flip(26), root: M(0, 0, Z * 0.55), body: body(-0.16, 10), beak: R(20), ...wings(20, -50) }, { all: flip(10), root: M(0, 0, Z * 0.2), beak: R(0) }) },
    Puff: { fps: 30, keys: atk({ body: body(0.18 * w, -10), crest: cr(-20) }, { body: Object.assign(sq(-0.18), { rot: [8, 0, 0] }), ...wings(70 * Wg), crest: cr(20) }, { body: body(-0.05), ...wings(50) }) },
    /* back into the pouch (down special while alone, 8 frames): crouch, spring up, tuck to drop in */
    HopIn: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: body(0.25), root: M(0, -H * 0.1, 0), ...wings(-10, 30) } }, { t: 0.1, pose: { body: body(-0.25), root: M(0, H * 0.35, 0), ...wings(60), ...feet(-H * 0.06) }, in: 'out' }, { t: 0.2, use: 'tuck', pose: { body: body(0.1), root: M(0, H * 0.45, 0) }, in: 'quad' }, { t: 0.27, pose: { root: M(0, H * 0.4, 0) } }] },
    Fly: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(64), body: { scale: [0.88, 1.22, 0.88] }, crest: cr(-30), tail: R(10), ...wings(20, -40), ...feet(H * 0.05, -0.1) } }, { t: 0.15, pose: { ...wings(20 + 14 * Wg, -40) } }, { t: 0.3, pose: { ...wings(20, -40) } }] },
  };
}
function spec(b) {
  const H = b.y1 - b.y0, X = b.x, Z = b.z, C = [H * 0.48, 0];
  const flip = deg => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, C[0] - (C[0] * cs - C[1] * sn), C[1] - (C[0] * sn + C[1] * cs)] }; };
  const wings = (up, fwd) => ({ wingL: R(0, -(fwd || 0), up), wingR: R(0, fwd || 0, -up) }), feet = (a, c) => ({ footL: M(0, a, c || 0), footR: M(0, a, c || 0) });
  return {
    note: b.name + ': metres after prep (feet on y = 0, facing +Z).', prep: { yaw: 0, translate: [0, -b.y0, 0] },
    bones: [
      { name: 'all', head: [0, 0, 0], tail: [0, 0.12, 0], parent: null, deform: false },
      { name: 'root', head: [0, H * 0.4, 0], tail: [0, H * 0.55, 0], parent: 'all', deform: false },
      { name: 'body', head: [0, H * 0.14, 0], tail: [0, H * 0.74, 0.02], parent: 'root' },
      { name: 'crest', head: [0, H * 0.8, 0.05], tail: [0, H * 0.99, -0.12], parent: 'body' },
      { name: 'wingL', head: [X * 0.72, H * 0.52, -0.05], tail: [X * 0.98, H * 0.34, -Z * 0.3], parent: 'body' },
      { name: 'wingR', head: [-X * 0.72, H * 0.52, -0.05], tail: [-X * 0.98, H * 0.34, -Z * 0.3], parent: 'body' },
      { name: 'tail', head: [0, H * 0.4, -Z * 0.62], tail: [0, H * 0.46, -Z * 0.98], parent: 'body' },
      { name: 'beak', head: [0, H * 0.56, Z * 0.7], tail: [0, H * 0.54, Z * 0.98], parent: 'body' },   /* also marks the front of the bird, for measuring */
      { name: 'footL', head: [X * 0.3, H * 0.1, 0.08], tail: [X * 0.32, 0.01, 0.26], parent: 'root' },
      { name: 'footR', head: [-X * 0.3, H * 0.1, 0.08], tail: [-X * 0.32, 0.01, 0.26], parent: 'root' }],
    poses: {
      stand: { all: {}, root: {}, body: {}, crest: {}, wingL: {}, wingR: {}, tail: {}, beak: {}, footL: {}, footR: {} },
      squash: { root: M(0, -H * 0.07, 0), body: M(0, -H * 0.05, 0), crest: R(14), ...wings(-14) },
      stretch: { root: M(0, H * 0.04, 0), body: M(0, H * 0.04, 0), crest: R(-10), ...wings(22) },
      tuck: { body: R(18), crest: R(30), ...wings(-10, 30), ...feet(H * 0.06, 0.06), tail: R(-20) } },
    clips: birdClips(b, H, X, Z, flip, wings, feet),
  };
}
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const key in BIRDS) { const b = BIRDS[key], out = path.join(__dirname, '..', '..', 'assets', 'fowl-' + key, 'work'); fs.mkdirSync(out, { recursive: true });
  const s = spec(b); fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(s, null, 1));
  fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/' + key + '-rigged.glb', texture: 1024, out: 'export/' + key + '-v1.glb' }, null, 1) + '\n');
  const hop = { clip: 'Hop' }, clips = { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: hop, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Skid' }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise' }, fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' },
    land: { clip: 'Land', from: 0, to: 0.4 }, landHard: { clip: 'LandHard' }, shield: { clip: 'Shield', from: 0, to: 0.15 }, shieldHit: { clip: 'ShieldHit' }, hit: { clip: 'Hit', from: 0, to: 0.6 }, hitHeavy: { clip: 'HitHeavy' }, launchUp: { clip: 'LaunchUp' }, spike: { clip: 'Spike' }, launch: { clip: 'Launch' },
    tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true }, airdodge: { clip: 'AirDodge' }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Ledge' },
    hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'ThrowF' }, throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'ThrowB' }, throw_u: { clip: 'ThrowU' }, throw_d: { clip: 'ThrowD' }, swap: { clip: 'Select' }, respawn: { clip: 'Respawn' } };
  const L3 = (clip, s, e) => A(clip, 0.34, 0.44, s || 0, e || 0.9);   /* strike key at 0.34 (built with rig.py --start 0, so keys play at their own times) */
  const attacks = { jab: L3('Peck'), jab2: L3('Peck2'), jab3: L3('Bash'), ftilt: L3('Lunge'), utilt: L3('Flick'), dtilt: L3('TailSweep'), dash: A('Spin', 0.15, 0.45, 0, 0.7),
    fsmash: L3('Bash'), usmash: L3('Flap'), dsmash: L3('Sweep', 0, 0.92), nair: A('Fling', 0.3, 0.44, 0, 0.9), fair: L3('Dive'), bair: L3('Kick'), uair: L3('Flip'), dair: L3('Stomp'),
    grab: L3('Snatch'), getup: L3('TailSweep'), nspec: L3('Puff'), sspec: L3('Bash', 0.1), uspec: L3('Flap'), dspec: L3('Puff'), launch: { clip: 'Fly', start: 0, contact: [0.05, 0.28], end: 0.3 }, '*': L3('Peck') };
  const base = { feel: 1, file: 'assets/fowl-' + key + '/export/' + key + '-v1.glb', height: b.h, clips, strikers: [{ bone: 'beak', ext: 0.6 }, { bone: 'crest', ext: 0.6 }, { bone: 'footL', ext: 0.8 }, { bone: 'tail', ext: 0.6 }], springs: [], attacks };
  base.attacks = Object.assign({}, base.attacks, { dspec: { clip: 'HopIn', start: 0, contact: [0.1, 0.2], end: 0.27 } });   /* alone, down special is the hop back into the pouch */
  manifest[b.name + ' alone'] = base;
  /* in the pouch: the same bird, riding high, with the slingshot built by the renderer underneath; charging the up special and firing ammunition use the puff */
  manifest[b.name] = Object.assign({}, base, { lift: b.lift, prop: { type: 'sling' }, feel: 1, attacks: Object.assign({}, attacks, { uspec: A('Fling', 0.3, 0.44, 0, 0.9), nair: A('Fling', 0.3, 0.44, 0, 0.9), sspec: L3('Puff'), nspec: A('Select', 0.1, 0.3, 0, 0.7), dspec: A('Shield', 0.1, 0.15, 0, 0.15) }) });
  console.log('wrote ' + key + ': ' + s.bones.length + ' bones, ' + Object.keys(s.clips).length + ' clips'); }
fs.writeFileSync(mf, JSON.stringify(manifest, null, 1) + '\n'); console.log('manifest: ' + Object.keys(manifest).join(', '));
