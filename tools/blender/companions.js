// Writes the skeleton and animation specs for Hod and Loom (assets/<name>/work/rig.json), which tools/blender/rig.py turns
// into rigged, animated models. Kept as code because the two sides of each body are mirrored and many poses share values.
//   node tools/blender/companions.js
const fs = require('fs'), path = require('path');
const out = (name, spec) => { const f = path.join(__dirname, '..', '..', 'assets', name, 'work', 'rig.json'); fs.writeFileSync(f, JSON.stringify(spec, null, 1) + '\n'); console.log(name + ': ' + spec.bones.length + ' bones, ' + Object.keys(spec.clips).length + ' clips'); };
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] });

/* ---------------- Hod: plated pangolin-badger. Heavy, four legs, long tail. ---------------- */
const leg = (s, x) => {
  const m = v => [v[0] * x, v[1], v[2]];
  return [
    { name: 'f' + s + '_upper', head: m([0.26, 0.5, 0.17]), tail: m([0.31, 0.28, 0.2]), parent: 'chest' },
    { name: 'f' + s + '_lower', head: m([0.31, 0.28, 0.2]), tail: m([0.29, 0.1, 0.33]), parent: 'f' + s + '_upper', connect: true },
    { name: 'ik_f' + s, head: m([0.29, 0.1, 0.33]), tail: m([0.29, 0.1, 0.45]), parent: 'all', deform: false },
    { name: 'f' + s + '_paw', head: m([0.29, 0.1, 0.33]), tail: m([0.284, 0.0, 0.45]), parent: 'ik_f' + s },
    { name: 'r' + s + '_upper', head: m([0.24, 0.5, -0.22]), tail: m([0.3, 0.28, -0.15]), parent: 'hips' },
    { name: 'r' + s + '_lower', head: m([0.3, 0.28, -0.15]), tail: m([0.26, 0.09, -0.3]), parent: 'r' + s + '_upper', connect: true },
    { name: 'ik_r' + s, head: m([0.26, 0.09, -0.3]), tail: m([0.26, 0.09, -0.18]), parent: 'all', deform: false },
    { name: 'r' + s + '_paw', head: m([0.26, 0.09, -0.3]), tail: m([0.252, 0.0, -0.16]), parent: 'ik_r' + s }];
};
const hod = {
  note: 'Hod: metres after prep (feet on y = 0, facing +Z). Joint positions were measured from the generated mesh.',
  prep: { yaw: 0, translate: [0, 0.475, -0.275] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'root', head: [0, 0.5, 0], tail: [0, 0.7, 0], parent: 'all', deform: false },
    { name: 'hips', head: [0, 0.5, -0.36], tail: [0, 0.52, -0.1], parent: 'root' },
    { name: 'spine', head: [0, 0.52, -0.1], tail: [0, 0.54, 0.14], parent: 'hips', connect: true },
    { name: 'chest', head: [0, 0.54, 0.14], tail: [0, 0.56, 0.36], parent: 'spine', connect: true },
    { name: 'neck', head: [0, 0.56, 0.36], tail: [0, 0.54, 0.5], parent: 'chest', connect: true },
    { name: 'head', head: [0, 0.54, 0.5], tail: [0, 0.47, 0.67], parent: 'neck', connect: true },
    { name: 'tail1', head: [0, 0.42, -0.42], tail: [0, 0.34, -0.62], parent: 'hips' },
    { name: 'tail2', head: [0, 0.34, -0.62], tail: [0, 0.27, -0.82], parent: 'tail1', connect: true },
    { name: 'tail3', head: [0, 0.27, -0.82], tail: [0, 0.25, -1.02], parent: 'tail2', connect: true },
    { name: 'tail4', head: [0, 0.25, -1.02], tail: [0, 0.28, -1.22], parent: 'tail3', connect: true },
    ...leg('l', 1), ...leg('r', -1)],
  ik: ['fl', 'fr', 'rl', 'rr'].map(k => ({ name: 'ik_' + k, bone: k + '_lower', chain: 2 })),
  poses: {
    stand: { all: {}, root: {}, hips: {}, spine: {}, chest: {}, neck: {}, head: {}, tail1: {}, tail2: {}, tail3: {}, ik_fl: {}, ik_fr: {}, ik_rl: {}, ik_rr: {} },
    crouch: { root: M(0, -0.12, 0), neck: R(-10), tail1: R(-10) },
    curl: { root: M(0, 0.02, 0), hips: R(24), spine: R(14), chest: R(26), neck: R(32), head: R(24), ik_fl: M(0, 0.22, -0.14), ik_fr: M(0, 0.22, -0.14), ik_rl: M(0, 0.2, 0.14), ik_rr: M(0, 0.2, 0.14), tail1: R(-48), tail2: R(-42), tail3: R(-36) },
    stretch: { hips: R(-8), chest: R(-6), neck: R(-8), ik_fl: M(0, 0.14, 0.22), ik_fr: M(0, 0.1, 0.18), ik_rl: M(0, 0.07, -0.2), ik_rr: M(0, 0.1, -0.16), tail1: R(10) },
    gather: { root: M(0, -0.04, 0), hips: R(10), chest: R(8), neck: R(-8), ik_fl: M(0, 0.04, -0.14), ik_fr: M(0, 0.08, -0.1), ik_rl: M(0, 0.06, 0.18), ik_rr: M(0, 0.02, 0.2), tail1: R(-8) } },
  clips: {
    Idle: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.6, pose: { root: M(0, -0.01, 0), head: R(3, 3), tail1: R(0, 5) } }, { t: 1.2, pose: { root: M(0, -0.018, 0), head: R(4, 0), tail1: R(0, 0) } }, { t: 1.8, pose: { root: M(0, -0.01, 0), head: R(3, -3), tail1: R(0, -5) } }, { t: 2.4, pose: { root: M(0, 0, 0), head: R(0), tail1: R(0) } }] },
    Walk: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { ik_fl: M(0, 0, 0.1), ik_rr: M(0, 0, 0.1), ik_fr: M(0, 0, -0.1), ik_rl: M(0, 0, -0.1), chest: R(0, 0, 3) } },
      { t: 0.25, pose: { ik_fl: M(0, 0, 0), ik_rr: M(0, 0, 0), ik_fr: M(0, 0.07, 0), ik_rl: M(0, 0.06, 0), root: M(0, 0.012, 0), chest: R(0, 0, 0), tail1: R(0, 5) } },
      { t: 0.5, pose: { ik_fl: M(0, 0, -0.1), ik_rr: M(0, 0, -0.1), ik_fr: M(0, 0, 0.1), ik_rl: M(0, 0, 0.1), root: M(0, 0, 0), chest: R(0, 0, -3) } },
      { t: 0.75, pose: { ik_fl: M(0, 0.07, 0), ik_rr: M(0, 0.06, 0), ik_fr: M(0, 0, 0), ik_rl: M(0, 0, 0), root: M(0, 0.012, 0), chest: R(0, 0, 0), tail1: R(0, -5) } },
      { t: 1.0, pose: { ik_fl: M(0, 0, 0.1), ik_rr: M(0, 0, 0.1), ik_fr: M(0, 0, -0.1), ik_rl: M(0, 0, -0.1), root: M(0, 0, 0), chest: R(0, 0, 3), tail1: R(0, 0) } }] },
    Run: { fps: 30, keys: [{ t: 0, use: ['stand', 'gather'] }, { t: 0.27, reset: true, use: 'stretch', pose: { root: M(0, 0.04, 0) } }, { t: 0.54, reset: true, use: 'gather' }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'crouch' }] },
    Rise: { fps: 30, keys: [{ t: 0, use: ['stand', 'stretch'], pose: { hips: R(-22), ik_fl: M(0, 0.32, 0.16), ik_fr: M(0, 0.28, 0.12) } }, { t: 0.4, reset: true, use: 'curl', pose: { hips: R(6), spine: R(4), chest: R(8), neck: R(6), head: R(4), tail1: R(-15), tail2: R(-10), tail3: R(-5) } }] },
    Fall: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { hips: R(8), ik_fl: M(0.04, 0.05, 0.1), ik_fr: M(-0.04, 0.08, 0.07), ik_rl: M(0.04, 0.12, -0.06), ik_rr: M(-0.04, 0.09, -0.03), tail1: R(16), tail2: R(10) } },
      { t: 0.5, pose: { ik_fl: M(0.04, 0.08, 0.07), ik_fr: M(-0.04, 0.05, 0.1), ik_rl: M(0.04, 0.09, -0.03), ik_rr: M(-0.04, 0.12, -0.06), tail1: R(20, 4) } },
      { t: 1.0, pose: { ik_fl: M(0.04, 0.05, 0.1), ik_fr: M(-0.04, 0.08, 0.07), ik_rl: M(0.04, 0.12, -0.06), ik_rr: M(-0.04, 0.09, -0.03), tail1: R(16, 0) } }] },
    Land: { fps: 30, keys: [{ t: 0, use: ['stand', 'crouch'], pose: { root: M(0, -0.17, 0), head: R(10) } }, { t: 0.4, reset: true, use: 'stand' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, pose: { root: M(0, -0.1, -0.03), chest: R(12), neck: R(22), head: R(20), tail1: R(-22, 35), tail2: R(-10, 30) } }] },
    Hit: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { root: M(0, 0.02, -0.08), hips: R(-6), chest: R(-10), neck: R(-18), head: R(-12, 0, 10), ik_fl: M(0, 0.1, -0.03), tail1: R(18) } },
      { t: 0.25, pose: { root: M(0, -0.03, -0.11), ik_fl: M(0, 0, -0.04), neck: R(-6), head: R(4, 0, 5) } },
      { t: 0.6, reset: true, use: 'stand' }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'curl'] }, { t: 0.3, pose: { hips: R(28), chest: R(22), tail1: R(-54) } }, { t: 0.6, pose: { hips: R(24), chest: R(26), tail1: R(-48) } }] },
    Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, -0.14, 0) } }, { t: 0.3, pose: { root: M(0, -0.3, 0), chest: R(6), neck: R(22), head: R(16), ik_fl: M(0.1, 0, 0.14), ik_fr: M(-0.1, 0, 0.14), ik_rl: M(0.1, 0, -0.1), ik_rr: M(-0.1, 0, -0.1), tail1: R(-14, 12) } }] },
    Swipe: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: { root: M(0, -0.05, -0.09), chest: R(-14, -10, 0), neck: R(-12), ik_fl: M(0.04, 0.42, -0.06), tail1: R(12) } },
      { t: 0.36, pose: { root: M(0, -0.04, 0.14), chest: R(10, 8, 0), neck: R(10), ik_fl: M(-0.08, 0.08, 0.34), tail1: R(-14) } },
      { t: 0.44, pose: { ik_fl: M(-0.1, 0.0, 0.32) } },
      { t: 0.9, reset: true, use: 'stand' }] },
    UpStrike: { fps: 30, keys: [
      { t: 0, use: 'stand' }, { t: 0.28, use: 'crouch' },
      { t: 0.36, reset: true, pose: { root: M(0, 0.08, -0.05), hips: R(-40), chest: R(-12), neck: R(-18), head: R(-20), ik_fl: M(0, 0.62, 0.0), ik_fr: M(0, 0.54, -0.03), tail1: R(24) } },
      { t: 0.46, pose: { ik_fl: M(0, 0.68, 0.08), ik_fr: M(0, 0.6, 0.05) } },
      { t: 0.9, reset: true, use: 'stand' }] },
    Sweep: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: { all: R(0, -35), root: M(0, -0.07, 0), tail1: R(4, -20), tail2: R(0, -15) } },
      { t: 0.33, pose: { all: R(0, 90), tail1: R(-6, 22), tail2: R(0, 18), tail3: R(0, 12) } },
      { t: 0.38, pose: { all: R(0, 180) } }, { t: 0.43, pose: { all: R(0, 270) } },
      { t: 0.55, pose: { all: R(0, 360), root: M(0, -0.03, 0), tail1: R(0), tail2: R(0), tail3: R(0) } },
      { t: 0.9, pose: { root: M(0, 0, 0) } }] },
    Slam: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: { root: M(0, 0.04, -0.08), hips: R(-26), chest: R(-10), neck: R(-10), ik_fl: M(0, 0.5, 0.04), ik_fr: M(0, 0.5, 0.04), tail1: R(18) } },
      { t: 0.36, pose: { root: M(0, -0.1, 0.1), hips: R(6), chest: R(10), neck: R(14), ik_fl: M(0, 0.0, 0.2), ik_fr: M(0, 0.0, 0.2), tail1: R(-16) } },
      { t: 0.46, pose: { root: M(0, -0.12, 0.1) } },
      { t: 0.9, reset: true, use: 'stand' }] },
    Ram: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, use: 'gather', pose: { root: M(0, -0.08, -0.12), neck: R(16), head: R(10) } },
      { t: 0.36, reset: true, use: 'stretch', pose: { root: M(0, -0.02, 0.3), neck: R(26), head: R(14), chest: R(6) } },
      { t: 0.5, pose: { root: M(0, -0.02, 0.34) } },
      { t: 0.9, reset: true, use: 'stand' }] } },
};
out('hod', hod);

/* ---------------- Loom: kite spirit. Floats, no legs; two ribbon chains. ----------------
   Loom shows its flat face to the camera, so for it "forward" is +X and the game mirrors it when it turns.
   A roll below zero tips the top toward +X (leaning forward). For a hanging ribbon, a roll above zero swings it toward +X. */
const rib = (s, x) => {
  const pts = [[0.32, 1.07, -0.03], [0.36, 0.87, -0.03], [0.44, 0.67, -0.04], [0.48, 0.47, -0.05], [0.46, 0.28, -0.04], [0.436, 0.1, -0.03]].map(p => [p[0] * x, p[1], p[2]]);
  return [0, 1, 2, 3, 4].map(k => ({ name: 'rib' + s + (k + 1), head: pts[k], tail: pts[k + 1], parent: k ? 'rib' + s + k : 'body', connect: k > 0 }));
};
const ribs = (a, b, c, d, e) => ({ ribL1: R(0, 0, a), ribL2: R(0, 0, b), ribL3: R(0, 0, c), ribL4: R(0, 0, d), ribL5: R(0, 0, e) });
const ribsR = (a, b, c, d, e) => ({ ribR1: R(0, 0, a), ribR2: R(0, 0, b), ribR3: R(0, 0, c), ribR4: R(0, 0, d), ribR5: R(0, 0, e) });
const both = (a, b, c, d, e) => Object.assign(ribs(a, b, c, d, e), ribsR(a, b, c, d, e));
const loom = {
  note: 'Loom: metres after prep (ribbon tips just above y = 0). It faces the camera; forward is +X.',
  prep: { yaw: 0, translate: [0, 1.053, 0] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.2, 0], parent: null, deform: false },
    { name: 'root', head: [0, 1.45, 0], tail: [0, 1.65, 0], parent: 'all', deform: false },
    { name: 'body', head: [0, 1.2, 0], tail: [0, 1.55, 0], parent: 'root' },
    { name: 'top', head: [0, 1.55, 0], tail: [0, 1.98, 0], parent: 'body', connect: true },
    { name: 'wingL', head: [0.15, 1.4, 0], tail: [0.62, 1.35, 0], parent: 'body' },
    { name: 'wingR', head: [-0.15, 1.4, 0], tail: [-0.62, 1.35, 0], parent: 'body' },
    ...rib('L', 1), ...rib('R', -1)],
  poses: {
    stand: Object.assign({ all: {}, root: {}, body: {}, top: {}, wingL: {}, wingR: {} }, both(0, 0, 0, 0, 0)),
    lean: Object.assign({ all: R(0, 0, -14), top: R(0, 0, -5) }, both(-14, -12, -10, -8, -6)),
    squash: Object.assign({ root: M(0, -0.14, 0), top: R(18), wingL: R(0, 0, -16), wingR: R(0, 0, 16) }, ribs(14, 10, 6, 0, 0), ribsR(-14, -10, -6, 0, 0)) },
  clips: {
    Idle: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.6, pose: Object.assign({ root: M(0, 0.04, 0), all: R(0, 0, 3), top: R(4) }, both(5, 4, 3, 2, 2)) },
      { t: 1.2, pose: Object.assign({ root: M(0, 0, 0), all: R(0, 0, 0), top: R(0) }, both(0, 0, 0, 0, 0)) },
      { t: 1.8, pose: Object.assign({ root: M(0, -0.04, 0), all: R(0, 0, -3), top: R(-4) }, both(-5, -4, -3, -2, -2)) },
      { t: 2.4, pose: Object.assign({ root: M(0, 0, 0), all: R(0, 0, 0), top: R(0) }, both(0, 0, 0, 0, 0)) }] },
    Walk: { fps: 30, keys: [
      { t: 0, use: ['stand', 'lean'] },
      { t: 0.4, pose: Object.assign({ root: M(0, 0.05, 0), all: R(0, 0, -10) }, both(-20, -16, -12, -10, -8)) },
      { t: 0.8, pose: Object.assign({ root: M(0, 0, 0), all: R(0, 0, -14) }, both(-14, -12, -10, -8, -6)) }] },
    Run: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: Object.assign({ all: R(0, 0, -28), top: R(0, 0, -8), wingL: R(10), wingR: R(-10) }, both(-30, -24, -18, -14, -10)) },
      { t: 0.2, pose: Object.assign({ root: M(0, 0.04, 0), wingL: R(-10), wingR: R(10) }, both(-38, -20, -26, -10, -16)) },
      { t: 0.4, pose: Object.assign({ root: M(0, 0, 0), wingL: R(10), wingR: R(-10) }, both(-30, -24, -18, -14, -10)) }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'squash' }] },
    Rise: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: Object.assign({ root: M(0, 0.08, 0), wingL: R(0, 0, -22), wingR: R(0, 0, 22) }, ribs(-10, -8, -4, 0, 0), ribsR(10, 8, 4, 0, 0)) },
      { t: 0.4, pose: Object.assign({ root: M(0, 0, 0), wingL: R(0, 0, -6), wingR: R(0, 0, 6) }, ribs(-4, 0, 0, 0, 0), ribsR(4, 0, 0, 0, 0)) }] },
    Fall: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: Object.assign({ wingL: R(0, 0, 22), wingR: R(0, 0, -22), top: R(-6) }, ribs(40, 24, 14, 8, 4), ribsR(-40, -24, -14, -8, -4)) },
      { t: 0.5, pose: Object.assign({ wingL: R(0, 0, 28), wingR: R(0, 0, -28), top: R(6) }, ribs(50, 18, 20, 4, 8), ribsR(-50, -18, -20, -4, -8)) },
      { t: 1.0, pose: Object.assign({ wingL: R(0, 0, 22), wingR: R(0, 0, -22), top: R(-6) }, ribs(40, 24, 14, 8, 4), ribsR(-40, -24, -14, -8, -4)) }] },
    Land: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { root: M(0, -0.2, 0) } }, { t: 0.35, reset: true, use: 'stand' }] },
    Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, pose: Object.assign({ root: M(0, -0.05, 0), wingL: R(0, -62), wingR: R(0, 62), top: R(16) }, ribs(-12, -8, 0, 0, 0), ribsR(12, 8, 0, 0, 0)) }] },
    Hit: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: Object.assign({ all: R(0, 0, 26), root: M(-0.08, 0.04, 0), top: R(-20), wingL: R(0, -25), wingR: R(0, 25) }, both(40, 26, 16, 10, 6)) },
      { t: 0.25, pose: Object.assign({ all: R(0, 0, 10), root: M(-0.12, -0.03, 0), top: R(8) }, both(12, 8, 4, 2, 0)) },
      { t: 0.6, reset: true, use: 'stand' }] },
    Tumble: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: Object.assign({ top: R(30), wingL: R(0, -50), wingR: R(0, 50) }, ribs(60, 40, 30, 20, 10), ribsR(-60, -40, -30, -20, -10)) },
      { t: 0.3, pose: Object.assign({ top: R(-20), wingL: R(0, -30), wingR: R(0, 30) }, ribs(30, 50, 20, 30, 10), ribsR(-30, -50, -20, -30, -10)) },
      { t: 0.6, pose: Object.assign({ top: R(30), wingL: R(0, -50), wingR: R(0, 50) }, ribs(60, 40, 30, 20, 10), ribsR(-60, -40, -30, -20, -10)) }] },
    Down: { fps: 30, keys: [
      { t: 0, use: 'stand', pose: { all: R(30), root: M(0, -0.3, 0) } },
      { t: 0.3, pose: Object.assign({ all: R(82), root: M(0, -0.75, 0), top: R(4) }, ribs(20, 10, 0, 0, 0), ribsR(-20, -10, 0, 0, 0)) }] },
    Lash: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: Object.assign({ all: R(0, 0, 14), root: M(-0.06, 0.02, 0) }, ribs(-40, -30, -20, -10, -6)) },
      { t: 0.36, pose: Object.assign({ all: R(0, 0, -16), root: M(0.1, 0, 0) }, ribs(86, 10, 4, 0, 0)) },
      { t: 0.44, pose: Object.assign({}, ribs(92, 0, -6, -6, -4)) },
      { t: 0.9, reset: true, use: 'stand' }] },
    UpStrike: { fps: 30, keys: [
      { t: 0, use: 'stand' }, { t: 0.28, use: 'squash' },
      { t: 0.36, reset: true, pose: Object.assign({ root: M(0, 0.18, 0), top: R(-8), wingL: R(0, 0, -26), wingR: R(0, 0, 26) }, ribs(150, 14, 8, 0, 0), ribsR(-150, -14, -8, 0, 0)) },
      { t: 0.46, pose: Object.assign({}, ribs(168, 6, 0, 0, 0), ribsR(-168, -6, 0, 0, 0)) },
      { t: 0.9, reset: true, use: 'stand' }] },
    Spin: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: Object.assign({ all: R(0, -40), root: M(0, -0.06, 0) }, ribs(20, 10, 0, 0, 0), ribsR(-20, -10, 0, 0, 0)) },
      { t: 0.33, pose: Object.assign({ all: R(0, 90) }, ribs(70, 10, 6, 0, 0), ribsR(-70, -10, -6, 0, 0)) },
      { t: 0.38, pose: { all: R(0, 180) } }, { t: 0.43, pose: { all: R(0, 270) } },
      { t: 0.55, pose: Object.assign({ all: R(0, 360), root: M(0, 0, 0) }, ribs(10, 0, 0, 0, 0), ribsR(-10, 0, 0, 0, 0)) },
      { t: 0.9, pose: Object.assign({}, both(0, 0, 0, 0, 0)) }] },
    Dive: { fps: 30, keys: [
      { t: 0, use: 'stand' },
      { t: 0.28, pose: Object.assign({ all: R(0, 0, 18), root: M(-0.1, 0.06, 0) }, both(10, 8, 6, 4, 2)) },
      { t: 0.36, pose: Object.assign({ all: R(0, 0, -72), root: M(0.28, -0.1, 0), top: R(0, 0, -8) }, both(-30, -14, -8, -4, 0)) },
      { t: 0.46, pose: Object.assign({ root: M(0.32, -0.12, 0) }, both(-10, -4, 0, 0, 0)) },
      { t: 0.9, reset: true, use: 'stand' }] } },
};
out('loom', loom);
