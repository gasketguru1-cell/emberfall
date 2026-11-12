// Writes the skeleton and animation specs for Hod and Loom (assets/<name>/work/rig.json), which tools/blender/rig.py turns
// into rigged, animated models. Kept as code because the two sides of each body are mirrored and many poses share values.
//   node tools/blender/companions.js
// It rewrites the Hod, Loom and Nib manifest entries; after it (and after any rebuild of their GLBs) run
//   node tools/addbones.mjs nib && node tools/addbones.mjs hod && node tools/addbones.mjs loom
// to put the added bones (tools/bones/<name>.mjs) back on top: the -b GLBs the game loads, and their springs.
const fs = require('fs'), path = require('path');
const out = (name, spec) => { const f = path.join(__dirname, '..', '..', 'assets', name, 'work', 'rig.json'); fs.writeFileSync(f, JSON.stringify(spec, null, 1) + '\n'); console.log(name + ': ' + spec.bones.length + ' bones, ' + Object.keys(spec.clips).length + ' clips'); };
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] });
/* A somersault for the whole-body bone: pitch it by deg while keeping the body's centre (c = [height, forward] from that bone) in place. */
const flip = (deg, c) => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, c[0] - (c[0] * cs - c[1] * sn), c[1] - (c[1] * cs + c[0] * sn)] }; };
/* One attack in the game's manifest: which clip, and where its wind-up, contact and recovery fall (seconds). */
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const baseClips = (hold, thrown) => ({ idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.1, to: 0.35 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.35 },
  shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
  airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: thrown, from: 0.2, to: 0.9 }, swap: { clip: 'Tumble', bounce: true } });
const manifest = {};

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
const HOD_C = [0.5, 0];
Object.assign(hod.clips, {
  Jab: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.18, pose: { root: M(0, -0.02, -0.04), chest: R(-4, 8, 0), ik_fr: M(0, 0.2, -0.04) } },
    { t: 0.28, pose: { root: M(0, -0.02, 0.06), chest: R(4, -8, 0), ik_fr: M(0.06, 0.24, 0.3) } },
    { t: 0.38, pose: { ik_fr: M(0.06, 0.1, 0.32) } },
    { t: 0.7, reset: true, use: 'stand' }] },
  Headbutt: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: { root: M(0, -0.06, -0.1), chest: R(-6), neck: R(-20), head: R(-10) } },
    { t: 0.36, pose: { root: M(0, -0.03, 0.2), chest: R(8), neck: R(30), head: R(18), tail1: R(14) } },
    { t: 0.46, pose: { root: M(0, -0.03, 0.22) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  TailSlam: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: { all: R(0, -25), root: M(0, -0.05, 0), tail1: R(26), tail2: R(16) } },
    { t: 0.36, pose: { all: R(0, 172), tail1: R(-9), tail2: R(-6), tail3: R(-4) } },
    { t: 0.48, pose: { all: R(0, 178), tail1: R(-12) } },
    { t: 0.9, pose: { all: R(0, 0), root: M(0, 0, 0), tail1: R(0), tail2: R(0), tail3: R(0) } }] },
  Toss: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.3, pose: { root: M(0, 0.06, -0.08), hips: R(-32), chest: R(-12), neck: R(-10), ik_fl: M(0, 0.55, -0.1), ik_fr: M(0, 0.55, -0.1), tail1: R(20) } },
    { t: 0.42, pose: { root: M(0, 0.0, 0.1), hips: R(-6), chest: R(10), neck: R(12), ik_fl: M(0, 0.3, 0.32), ik_fr: M(0, 0.3, 0.32), tail1: R(-10) } },
    { t: 0.6, pose: { root: M(0, -0.05, 0.08), hips: R(0), ik_fl: M(0, 0, 0.14), ik_fr: M(0, 0, 0.14) } },
    { t: 0.95, reset: true, use: 'stand' }] },
  Burrow: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.26, use: 'crouch', pose: { root: M(0, -0.18, 0) } },
    { t: 0.34, reset: true, pose: { all: flip(-72, HOD_C), hips: R(-6), chest: R(-8), neck: R(-14), ik_fl: M(0, 0.2, 0.2), ik_fr: M(0, 0.2, 0.2), ik_rl: M(0, -0.02, -0.1), ik_rr: M(0, -0.02, -0.1), tail1: R(-20) } },
    { t: 0.5, pose: { all: flip(-80, HOD_C) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  BellyFlop: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, use: 'curl' },
    { t: 0.36, reset: true, pose: { all: flip(18, HOD_C), hips: R(-6), chest: R(-8), neck: R(-12), ik_fl: M(0.14, 0.16, 0.22), ik_fr: M(-0.14, 0.16, 0.22), ik_rl: M(0.14, 0.16, -0.2), ik_rr: M(-0.14, 0.16, -0.2), tail1: R(14) } },
    { t: 0.48, pose: { all: flip(24, HOD_C) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  /* Hanging from the ledge: body upright against the wall, front paws hooked over the top, hind legs and tail swaying. */
  Ledge: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { all: flip(-82, HOD_C), neck: R(26), head: R(14), ik_fl: M(0.02, 0.05, 0.2), ik_fr: M(-0.02, 0.05, 0.2), ik_rl: M(0, 0.1, 0.05), ik_rr: M(0, 0.05, 0.1), tail1: R(0, 6) } },
    { t: 0.8, pose: { all: flip(-78, HOD_C), ik_rl: M(0, 0.05, 0.1), ik_rr: M(0, 0.1, 0.05), tail1: R(0, -6) } },
    { t: 1.6, pose: { all: flip(-82, HOD_C), ik_rl: M(0, 0.1, 0.05), ik_rr: M(0, 0.05, 0.1), tail1: R(0, 6) } }] },
  /* Spot dodge: ducks back and turns its plated side to the front. */
  Dodge: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.12, pose: { all: R(0, 55), root: M(0, -0.12, -0.1), chest: R(10), neck: R(24), head: R(14), tail1: R(-16, 30) } },
    { t: 0.28, pose: { all: R(0, 60), root: M(0, -0.13, -0.1) } },
    { t: 0.4, reset: true, use: 'stand' }] },
  /* Holding a grabbed opponent: front paws clamped out in front, squeezing. */
  Hold: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { root: M(0, -0.03, 0.12), hips: R(-10), chest: R(6), neck: R(10), ik_fl: M(-0.07, 0.3, 0.3), ik_fr: M(0.07, 0.3, 0.3), tail1: R(8) } },
    { t: 0.3, pose: { root: M(0, -0.05, 0.14), ik_fl: M(-0.1, 0.27, 0.3), ik_fr: M(0.1, 0.27, 0.3), neck: R(16) } },
    { t: 0.6, pose: { root: M(0, -0.03, 0.12), ik_fl: M(-0.07, 0.3, 0.3), ik_fr: M(0.07, 0.3, 0.3), neck: R(10) } }] },
  /* Being held: hauled up off its front feet, paddling. */
  Held: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { all: flip(-38, HOD_C), root: M(0, 0.08, 0), neck: R(-14), head: R(-8), ik_fl: M(0, 0.12, 0.1), ik_fr: M(0, 0.04, 0.02), ik_rl: M(0, 0.04, 0.06), ik_rr: M(0, 0.1, 0), tail1: R(-20), tail2: R(-12) } },
    { t: 0.25, pose: { ik_fl: M(0, 0.04, 0.02), ik_fr: M(0, 0.12, 0.1), ik_rl: M(0, 0.1, 0), ik_rr: M(0, 0.04, 0.06), head: R(-8, 8), tail1: R(-20, 10) } },
    { t: 0.5, pose: { ik_fl: M(0, 0.12, 0.1), ik_fr: M(0, 0.04, 0.02), ik_rl: M(0, 0.04, 0.06), ik_rr: M(0, 0.1, 0), head: R(-8, 0), tail1: R(-20, 0) } }] },
});
out('hod', hod);
manifest.Hod = { file: 'assets/hod/export/hod-v1.glb', height: 11.5, clips: baseClips('Swipe', 'Slam'),
  strikers: [{ bone: 'head', ext: 2.4 }, { bone: 'fl_paw', ext: 1.8 }, { bone: 'fr_paw', ext: 1.8 }, { bone: 'rl_paw', ext: 1.2 }, { bone: 'rr_paw', ext: 1.2 }, { bone: 'tail4', ext: 2.6 }],
  springs: [{ bones: ['tail1', 'tail2', 'tail3', 'tail4'], k: 0.3, d: 0.68, max: 0.5, drag: 0.08 }],
  attacks: { jab: A('Jab', 0.28, 0.4, 0, 0.7), jab3: A('Swipe', 0.39, 0.48), ftilt: A('Headbutt', 0.39, 0.5), utilt: A('UpStrike', 0.39, 0.48), dtilt: A('TailSlam', 0.34, 0.52), dash: A('Ram', 0.34, 0.52),
    fsmash: A('Slam', 0.39, 0.5), usmash: A('UpStrike', 0.39, 0.48), dsmash: A('Sweep', 0.34, 0.52),
    nair: A('Sweep', 0.34, 0.52), fair: A('BellyFlop', 0.34, 0.52), bair: A('Sweep', 0.34, 0.52), uair: A('UpStrike', 0.39, 0.48), dair: A('BellyFlop', 0.34, 0.52),
    grab: A('Swipe', 0.39, 0.48), getup: A('Sweep', 0.34, 0.52), nspec: A('Toss', 0.4, 0.46, 0, 0.95), sspec: A('Ram', 0.34, 0.52), uspec: A('Burrow', 0.34, 0.52), '*': A('Swipe', 0.39, 0.48) } };

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
Object.assign(loom.clips, {
  Flick: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.18, pose: Object.assign({ all: R(0, 0, 6) }, ribs(-28, -16, -10, 0, 0)) },
    { t: 0.28, pose: Object.assign({ all: R(0, 0, -8), root: M(0.04, 0, 0) }, ribs(72, 18, 8, 0, 0)) },
    { t: 0.38, pose: Object.assign({}, ribs(60, -8, -10, -4, 0)) },
    { t: 0.7, reset: true, use: 'stand' }] },
  BackLash: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: Object.assign({ all: R(0, 0, -14), root: M(0.06, 0.02, 0) }, ribsR(40, 30, 20, 10, 6)) },
    { t: 0.36, pose: Object.assign({ all: R(0, 0, 16), root: M(-0.1, 0, 0) }, ribsR(-86, -10, -4, 0, 0)) },
    { t: 0.44, pose: Object.assign({}, ribsR(-92, 0, 6, 6, 4)) },
    { t: 0.9, reset: true, use: 'stand' }] },
  DownLash: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: Object.assign({ root: M(0, 0.08, 0), wingL: R(0, 0, 18), wingR: R(0, 0, -18) }, ribs(74, 30, 20, 10, 0), ribsR(-74, -30, -20, -10, 0)) },
    { t: 0.36, pose: Object.assign({ root: M(0, -0.12, 0), wingL: R(0, 0, -24), wingR: R(0, 0, 24), top: R(8) }, ribs(-14, -8, -4, 0, 0), ribsR(14, 8, 4, 0, 0)) },
    { t: 0.46, pose: Object.assign({ root: M(0, -0.14, 0) }, ribs(-18, -4, 4, 4, 0), ribsR(18, 4, -4, -4, 0)) },
    { t: 0.9, reset: true, use: 'stand' }] },
  Gust: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.3, pose: Object.assign({ all: R(0, 0, 10), root: M(-0.06, 0.03, 0), wingL: R(0, 44), wingR: R(0, -44) }, both(14, 10, 6, 4, 2)) },
    { t: 0.43, pose: Object.assign({ all: R(0, 0, -12), root: M(0.1, 0, 0), wingL: R(0, -58), wingR: R(0, 58), top: R(14) }, both(-34, -22, -14, -8, -4)) },
    { t: 0.6, pose: Object.assign({ wingL: R(0, -40), wingR: R(0, 40) }, both(-16, -10, -6, -2, 0)) },
    { t: 1.0, reset: true, use: 'stand' }] },
  Thermal: { fps: 30, keys: [
    { t: 0, use: ['stand', 'squash'] },
    { t: 0.15, reset: true, pose: Object.assign({ root: M(0, 0.14, 0), wingL: R(0, 0, -20), wingR: R(0, 0, 20) }, ribs(-8, -4, 0, 0, 0), ribsR(8, 4, 0, 0, 0)) },
    { t: 0.3, pose: Object.assign({ wingL: R(0, 0, 14), wingR: R(0, 0, -14), top: R(6) }, ribs(6, 8, 4, 0, 0), ribsR(-6, -8, -4, 0, 0)) },
    { t: 0.45, pose: Object.assign({ wingL: R(0, 0, -20), wingR: R(0, 0, 20), top: R(-6) }, ribs(-8, -4, 0, 0, 0), ribsR(8, 4, 0, 0, 0)) },
    { t: 0.6, pose: Object.assign({ wingL: R(0, 0, 14), wingR: R(0, 0, -14), top: R(6) }, ribs(6, 8, 4, 0, 0), ribsR(-6, -8, -4, 0, 0)) },
    { t: 0.75, pose: Object.assign({ wingL: R(0, 0, -20), wingR: R(0, 0, 20), top: R(-6) }, ribs(-8, -4, 0, 0, 0), ribsR(8, 4, 0, 0, 0)) },
    { t: 0.9, reset: true, use: 'stand' }] },
  /* Caught on the ledge by its forward wing, body against the wall, ribbons hanging. */
  Ledge: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: Object.assign({ all: R(0, 0, -5), top: R(0, 0, -8), wingL: R(0, 0, 38), wingR: R(0, 0, -12) }, both(-6, -4, -2, 0, 0)) },
    { t: 0.9, pose: Object.assign({ all: R(0, 0, -2), wingR: R(0, 0, -4) }, both(8, 5, 3, 2, 0)) },
    { t: 1.8, pose: Object.assign({ all: R(0, 0, -5), wingR: R(0, 0, -12) }, both(-6, -4, -2, 0, 0)) }] },
  /* Spot dodge: turns edge-on, so there is almost nothing to hit. */
  Dodge: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.12, pose: Object.assign({ all: R(0, 82), root: M(0, 0.05, 0), wingL: R(0, 0, -30), wingR: R(0, 0, 30) }, both(0, 0, 0, 0, 0)) },
    { t: 0.28, pose: { all: R(0, 86) } },
    { t: 0.4, reset: true, use: 'stand' }] },
  /* Holding with a ribbon: the forward ribbon stays out and tugs. */
  Hold: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: Object.assign({ all: R(0, 0, -8), root: M(0.04, 0, 0) }, ribs(72, 18, 8, 0, 0)) },
    { t: 0.3, pose: Object.assign({ all: R(0, 0, -3) }, ribs(64, 26, 10, -4, 0)) },
    { t: 0.6, pose: Object.assign({ all: R(0, 0, -8) }, ribs(72, 18, 8, 0, 0)) }] },
  /* Being held: pulled back off balance, wings and ribbons fluttering. */
  Held: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: Object.assign({ all: R(0, 0, 14), top: R(0, 0, 10), wingL: R(0, 0, 18), wingR: R(0, 0, -18) }, both(22, 14, 8, 4, 2)) },
    { t: 0.22, pose: Object.assign({ top: R(0, 0, 4), wingL: R(0, 0, -14), wingR: R(0, 0, 14) }, both(8, 18, 4, 8, 0)) },
    { t: 0.44, pose: Object.assign({ top: R(0, 0, 10), wingL: R(0, 0, 18), wingR: R(0, 0, -18) }, both(22, 14, 8, 4, 2)) }] },
});
out('loom', loom);
manifest.Loom = { file: 'assets/loom/export/loom-v1.glb', height: 15, faceCamera: true, clips: baseClips('Lash', 'Lash'),
  strikers: [{ bone: 'top', ext: 3.6 }, { bone: 'ribL5', ext: 1.5 }, { bone: 'ribR5', ext: 1.5 }, { bone: 'wingL', ext: 3.8 }, { bone: 'wingR', ext: 3.8 }],
  springs: [{ bones: ['ribL1', 'ribL2', 'ribL3', 'ribL4', 'ribL5'], k: 0.22, d: 0.74, max: 1.0, drag: 0.16 }, { bones: ['ribR1', 'ribR2', 'ribR3', 'ribR4', 'ribR5'], k: 0.22, d: 0.74, max: 1.0, drag: 0.16 }],
  attacks: { jab: A('Flick', 0.28, 0.4, 0, 0.7), ftilt: A('Lash', 0.39, 0.48), utilt: A('UpStrike', 0.39, 0.48), dtilt: A('Spin', 0.34, 0.52), dash: A('Dive', 0.39, 0.5),
    fsmash: A('Dive', 0.39, 0.5), usmash: A('UpStrike', 0.39, 0.48), dsmash: A('Spin', 0.34, 0.52),
    nair: A('Spin', 0.34, 0.52), fair: A('Lash', 0.39, 0.48), bair: A('BackLash', 0.39, 0.48), uair: A('UpStrike', 0.39, 0.48), dair: A('DownLash', 0.39, 0.5),
    grab: A('Flick', 0.28, 0.4, 0, 0.7), getup: A('Spin', 0.34, 0.52), nspec: A('Gust', 0.4, 0.46, 0.1, 1.0), sspec: A('Lash', 0.39, 0.48), uspec: A('Thermal', 0.2, 0.75), '*': A('Lash', 0.39, 0.48) } };

/* ---------------- Nib: wind-up fox. Its skeleton and first clips were measured and keyed by hand in rig.base.json. ---------------- */
const nib = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'nib', 'work', 'rig.base.json'), 'utf8'));
const NIB_C = [0.62, -0.05];
Object.assign(nib.clips, {
  Swat: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.18, pose: { root: M(0, -0.02, -0.04), chest: R(-4, -8, 0), ik_fl: M(0, 0.24, -0.05), earL1: R(0, 0, -14) } },
    { t: 0.28, pose: { root: M(0, -0.02, 0.06), chest: R(4, 8, 0), ik_fl: M(-0.06, 0.32, 0.3) } },
    { t: 0.38, pose: { ik_fl: M(-0.06, 0.14, 0.34) } },
    { t: 0.7, reset: true, use: 'stand' }] },
  TailWhip: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: { all: R(0, -25), root: M(0, -0.05, 0), tailL1: R(10, -25), tailR1: R(10, -25) } },
    { t: 0.36, pose: { all: R(0, 172), tailL1: R(-34, 20), tailR1: R(-34, 20), tailL2: R(-22), tailR2: R(-22) } },
    { t: 0.48, pose: { all: R(0, 178) } },
    { t: 0.9, pose: { all: R(0, 0), root: M(0, 0, 0), tailL1: R(0), tailR1: R(0), tailL2: R(0), tailR2: R(0) } }] },
  Headbutt: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: { root: M(0, -0.12, -0.16), hips: R(6), neck: R(18), head: R(22), earL1: R(0, 0, -24), earR1: R(22), tailL1: R(16), tailR1: R(16) } },
    { t: 0.36, pose: { root: M(0, 0.0, 0.3), hips: R(-4), neck: R(30), head: R(8), ik_fl: M(0, 0, 0.12), ik_fr: M(0, 0, 0.1), tailL1: R(-26), tailR1: R(-26) } },
    { t: 0.46, pose: { root: M(0, -0.02, 0.32) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  Flip: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.26, use: 'tuck', pose: { all: flip(-20, NIB_C) } },
    { t: 0.32, pose: { all: flip(110, NIB_C) } },
    { t: 0.38, pose: { all: flip(230, NIB_C) } },
    { t: 0.46, pose: { all: flip(350, NIB_C) } },
    { t: 0.6, pose: { all: flip(360, NIB_C) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  BackKick: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.28, pose: { root: M(0, -0.05, 0.08), hips: R(12), ik_rl: M(0, 0.2, 0.12), ik_rr: M(0, 0.2, 0.14), neck: R(-10) } },
    { t: 0.36, pose: { root: M(0, 0.06, -0.06), hips: R(-28), chest: R(10), neck: R(12), ik_rl: M(0, 0.44, -0.44), ik_rr: M(0, 0.4, -0.38), tailL1: R(30), tailR1: R(30) } },
    { t: 0.46, pose: { ik_rl: M(0, 0.4, -0.46), ik_rr: M(0, 0.44, -0.42) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  Spit: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.2, pose: { root: M(0, 0, -0.05), neck: R(-28), head: R(-14), earL1: R(0, 0, 16), earR1: R(-14) } },
    { t: 0.3, pose: { root: M(0, -0.02, 0.08), neck: R(22), head: R(-20), earL1: R(0, 0, -20), earR1: R(18) } },
    { t: 0.45, pose: { neck: R(8), head: R(-6) } },
    { t: 0.8, reset: true, use: 'stand' }] },
  CoilJump: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.14, use: 'crouch', pose: { root: M(0, -0.24, 0) } },
    { t: 0.22, reset: true, use: 'stretch', pose: { all: flip(-68, NIB_C), key: R(0, 180, 0) } },
    { t: 0.5, pose: { all: flip(-74, NIB_C), key: R(0, 360, 0) } },
    { t: 0.9, reset: true, use: 'stand' }] },
  /* Hanging from the ledge: upright against the wall, front paws over the top, hind legs kicking, key turning. */
  Ledge: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { all: flip(-80, NIB_C), neck: R(28), head: R(10), ik_fl: M(0.02, 0.04, 0.12), ik_fr: M(-0.02, 0.04, 0.12), ik_rl: M(0, 0.1, 0.06), ik_rr: M(0, 0.05, 0.1), tailL1: R(0, 10), tailR1: R(0, -4), earL1: R(0, 0, -10), earR1: R(10) } },
    { t: 0.7, pose: { all: flip(-76, NIB_C), ik_rl: M(0, 0.05, 0.1), ik_rr: M(0, 0.1, 0.06), tailL1: R(0, -4), tailR1: R(0, 10), key: R(0, 180, 0) } },
    { t: 1.4, pose: { all: flip(-80, NIB_C), ik_rl: M(0, 0.1, 0.06), ik_rr: M(0, 0.05, 0.1), tailL1: R(0, 10), tailR1: R(0, -4), key: R(0, 360, 0) } }] },
  /* Spot dodge: a quick sidestep away from the camera, ears flat. */
  Dodge: { fps: 30, keys: [
    { t: 0, use: 'stand' },
    { t: 0.12, pose: { all: R(0, 60), root: M(0, -0.1, -0.14), neck: R(16), head: R(8), earL1: R(0, 0, -24), earR1: R(22), tailL1: R(-20, 20), tailR1: R(-20, 30) } },
    { t: 0.28, pose: { all: R(0, 66), root: M(0, -0.11, -0.14) } },
    { t: 0.4, reset: true, use: 'stand' }] },
  /* Holding a grabbed opponent in its jaws, shaking its head. */
  Hold: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { root: M(0, -0.05, 0.16), hips: R(-6), neck: R(24), head: R(-14), ik_fl: M(0, 0, 0.1), ik_fr: M(0, 0, 0.08), tailL1: R(-18), tailR1: R(-18) } },
    { t: 0.2, pose: { head: R(-14, 12), neck: R(24, 6), earL1: R(0, 0, -14), earR1: R(12) } },
    { t: 0.4, pose: { head: R(-14, -12), neck: R(24, -6), earL1: R(0, 0, 10), earR1: R(-10) } },
    { t: 0.6, pose: { head: R(-14, 0), neck: R(24, 0), earL1: R(0, 0, 0), earR1: R(0) } }] },
  /* Being held: lifted by the scruff, legs paddling, tails drooping. */
  Held: { fps: 30, keys: [
    { t: 0, use: 'stand', pose: { all: flip(-40, NIB_C), root: M(0, 0.06, 0), neck: R(-16), head: R(-10), ik_fl: M(0, 0.14, 0.08), ik_fr: M(0, 0.04, 0), ik_rl: M(0, 0.04, 0.06), ik_rr: M(0, 0.12, 0), tailL1: R(-30), tailR1: R(-30), earL1: R(0, 0, 20), earR1: R(-18) } },
    { t: 0.22, pose: { ik_fl: M(0, 0.04, 0), ik_fr: M(0, 0.14, 0.08), ik_rl: M(0, 0.12, 0), ik_rr: M(0, 0.04, 0.06), tailL1: R(-30, 12), tailR1: R(-30, -12) } },
    { t: 0.44, pose: { ik_fl: M(0, 0.14, 0.08), ik_fr: M(0, 0.04, 0), ik_rl: M(0, 0.04, 0.06), ik_rr: M(0, 0.12, 0), tailL1: R(-30, 0), tailR1: R(-30, 0) } }] },
});
out('nib', nib);
manifest.Nib = { file: 'assets/nib/export/nib-v1.glb', height: 10.5, clips: baseClips('Bite', 'Bite'),
  strikers: [{ bone: 'head', ext: 3.2 }, { bone: 'fl_paw', ext: 0.9 }, { bone: 'fr_paw', ext: 0.9 }, { bone: 'rl_paw', ext: 0.9 }, { bone: 'rr_paw', ext: 0.9 }, { bone: 'tailL4', ext: 1.8 }, { bone: 'tailR4', ext: 1.8 }],
  springs: [{ bones: ['tailL1', 'tailL2', 'tailL3', 'tailL4'], k: 0.26, d: 0.72, max: 0.8, drag: 0.13 }, { bones: ['tailR1', 'tailR2', 'tailR3', 'tailR4'], k: 0.26, d: 0.72, max: 0.8, drag: 0.13 },
    { bones: ['earL1', 'earL2'], k: 0.4, d: 0.62, max: 0.5, drag: 0.1 }, { bones: ['earR1', 'earR2'], k: 0.4, d: 0.62, max: 0.5, drag: 0.1 }],
  attacks: { jab: A('Swat', 0.28, 0.4, 0, 0.7), jab3: A('Bite', 0.39, 0.46), ftilt: A('Bite', 0.39, 0.46), utilt: A('UpStrike', 0.39, 0.48), dtilt: A('TailWhip', 0.34, 0.52), dash: A('Pounce', 0.39, 0.48),
    fsmash: A('Headbutt', 0.39, 0.5), usmash: A('UpStrike', 0.39, 0.48), dsmash: A('Sweep', 0.34, 0.52),
    nair: A('Flip', 0.31, 0.5), fair: A('Headbutt', 0.39, 0.5), bair: A('BackKick', 0.39, 0.5), uair: A('UpStrike', 0.39, 0.48), dair: A('Pounce', 0.39, 0.48),
    grab: A('Bite', 0.39, 0.46), getup: A('Sweep', 0.34, 0.52), nspec: A('Spit', 0.28, 0.34, 0.05, 0.7), sspec: A('Pounce', 0.39, 0.48), sbrake: A('Pounce', 0.2, 0.3, 0, 0.6), uspec: A('CoilJump', 0.24, 0.4), '*': A('Bite', 0.39, 0.46) } };

/* The game's manifest: these three entries are owned by this file; other entries (Flint) are left as they are. */
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
fs.writeFileSync(mf, JSON.stringify(Object.assign(current, manifest), null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
