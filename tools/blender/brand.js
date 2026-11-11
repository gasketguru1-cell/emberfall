// Writes the skeleton and animation spec for Brand (assets/brand/work/rig.json), which tools/blender/rig.py turns into a
// rigged, animated model, and adds her entry to the game's manifest.
//   node tools/blender/brand.js
//   bash tools/blender/build-brand.sh          (rig in Blender, pack, and optionally pose pictures for checking)
// A watch captain with a sword and a stove-door shield. Her hands and feet follow four targets (c_handL, c_handR, c_footL,
// c_footR): a pose says where a hand or a boot is and the elbow or knee works itself out; the hand targets ride on the
// chest, the foot targets stay on the floor when the hips move. The sword and the shield are aimed directly, whatever the
// arms do: a pose says which way the blade points (c_sword) and which way the door faces (c_shield). Both are rigid.
// Directions: x is her left, y is up, z is forward. In the game she is seen from her right side, so z runs across the screen.
// The generated mesh stood in a three-quarter guard; prep turns it 47.6 degrees so the body is square to +z.
// The attacks' shapes are the owner's document's (sim.js, BRAND): at the contact keys the blade lies along that shape.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] });
const AIM = (x, y, z, twist) => ({ aim: [x, y, z], twist: twist || 0 });
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b, k) => a.map((v, i) => v + b[i] * (k === undefined ? 1 : k)), len = a => Math.hypot(...a), unit = a => a.map(v => v / len(a));
/* measured on the squared mesh (tools/proj.mjs): sword grip and tip, shield centre and facing */
const GRIP = [-0.385, 0.92, 0.10], TIP = [-0.455, 0.265, 0.75], SD = unit(sub(TIP, GRIP)), POMMEL = add(GRIP, SD, -0.18), GUARD = add(GRIP, SD, 0.08);
const SC = [0.395, 1.045, -0.085], SN = unit([0.995, 0.0995, 0]);
const leg = (s, hip, knee, ankle, toe) => [
  { name: 'thigh' + s, head: hip, tail: knee, parent: 'hips' },
  { name: 'shin' + s, head: knee, tail: ankle, parent: 'thigh' + s, connect: true },
  { name: 'foot' + s, head: ankle, tail: toe, parent: 'shin' + s },
  { name: 'c_foot' + s, head: ankle, tail: add(ankle, [0, 0, 0.12]), parent: 'all', deform: false }];
const WR = [-0.385, 0.97, 0.08], WL = [0.335, 1.0, -0.07];
const brand = {
  note: 'Brand: metres after prep (feet on y = 0, facing +Z, her right is -X). Joint positions were measured from the generated mesh.',
  prep: { yaw: 47.6, translate: [-0.055, 0.952, 0.15] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'hips', head: [0, 0.95, 0], tail: [0, 1.12, 0], parent: 'all' },
    { name: 'spine', head: [0, 1.12, 0], tail: [0, 1.3, 0], parent: 'hips', connect: true },
    { name: 'chest', head: [0, 1.3, 0], tail: [0, 1.5, 0], parent: 'spine', connect: true },
    { name: 'head', head: [0, 1.55, 0.03], tail: [0, 1.9, 0.05], parent: 'chest' },
    { name: 'armR', head: [-0.26, 1.44, -0.02], tail: [-0.335, 1.2, -0.03], parent: 'chest' },
    { name: 'foreR', head: [-0.335, 1.2, -0.03], tail: WR, parent: 'armR', connect: true },
    { name: 'handR', head: WR, tail: [-0.39, 0.88, 0.12], parent: 'foreR', connect: true },
    { name: 'c_handR', head: WR, tail: add(WR, [0, 0, 0.12]), parent: 'chest', deform: false },
    { name: 'sword', head: GRIP, tail: TIP, parent: 'handR' },
    { name: 'swordTip', head: TIP, tail: add(TIP, SD, 0.08), parent: 'sword', connect: true },   /* marks the point of the blade, for measuring where it strikes */
    { name: 'c_sword', head: GRIP, tail: TIP, parent: 'all', deform: false },
    { name: 'armL', head: [0.215, 1.44, -0.05], tail: [0.285, 1.2, -0.11], parent: 'chest' },
    { name: 'foreL', head: [0.285, 1.2, -0.11], tail: WL, parent: 'armL', connect: true },
    { name: 'handL', head: WL, tail: [0.345, 0.9, -0.07], parent: 'foreL', connect: true },
    { name: 'c_handL', head: WL, tail: add(WL, [0, 0, 0.12]), parent: 'chest', deform: false },
    { name: 'shield', head: SC, tail: add(SC, SN, 0.25), parent: 'handL' },
    { name: 'c_shield', head: SC, tail: add(SC, SN, 0.25), parent: 'all', deform: false },
    ...leg('R', [-0.125, 0.93, 0], [-0.225, 0.5, 0.06], [-0.27, 0.1, 0.02], [-0.27, 0.03, 0.21]),
    ...leg('L', [0.115, 0.93, -0.02], [0.195, 0.5, -0.02], [0.245, 0.1, -0.1], [0.375, 0.03, -0.05])],
  ik: [{ name: 'c_handL', bone: 'foreL', chain: 2 }, { name: 'c_handR', bone: 'foreR', chain: 2 }, { name: 'c_footL', bone: 'shinL', chain: 2 }, { name: 'c_footR', bone: 'shinR', chain: 2 }],
  copyrot: [{ bone: 'sword', from: 'c_sword' }, { bone: 'shield', from: 'c_shield' }],
  /* rigid parts: the head with its hat; the blade and grip; the crossguard; the stove door */
  rigid: [{ bone: 'head', box: [[-0.34, 1.66, -0.36], [0.34, 1.95, 0.36]] },
    { bone: 'sword', capsule: [POMMEL, TIP], r: 0.085 }, { bone: 'sword', capsule: [add(GUARD, SD, -0.01), add(GUARD, SD, 0.01)], r: 0.15 },
    { bone: 'shield', disc: SC, n: SN, r: 0.345, t: [-0.03, 0.09] }],
  poses: {}, clips: {},
};
/* ---- helpers: where a wrist should be in the model's space (z forward, y up, x to her left), allowing for the hips' move ---- */
const HR = (z, y, x, hip) => { hip = hip || [0, 0, 0]; return M((x === undefined ? -0.3 : x) - WR[0] - hip[0], y - WR[1] - hip[1], z - WR[2] - hip[2]); };
const HL = (z, y, x, hip) => { hip = hip || [0, 0, 0]; return M((x === undefined ? 0.22 : x) - WL[0] - hip[0], y - WL[1] - hip[1], z - WL[2] - hip[2]); };
const HEAD = (p, y) => R(p || 0, -24 + (y || 0));   /* the mesh looks to her left; -24 brings the face round to the front */
const BIG = { scale: [1.2, 1.2, 1.2] };   /* the sword a fifth larger than modelled, so the picture reaches what the document's shapes reach */
brand.poses = {
  stand: { all: {}, hips: {}, spine: {}, chest: {}, head: HEAD(), c_handL: {}, c_handR: {}, c_footL: {}, c_footR: {}, c_sword: {}, c_shield: {}, sword: BIG },
  /* the ready stance: sword foot forward, blade low and ahead, the door half raised on the far side */
  guard: { hips: M(0, -0.05, 0), chest: R(4, -12), c_footR: M(0, 0, 0.14), c_footL: M(0.02, 0, -0.1), c_sword: AIM(-0.12, -0.3, 1), c_handR: HR(0.3, 0.95, -0.34, [0, -0.05, 0]), c_shield: AIM(0.6, 0.05, 1), c_handL: HL(0.26, 1.12, 0.24, [0, -0.05, 0]) },
  crouch: { hips: M(0, -0.3, 0), spine: R(16), chest: R(8, -12), head: HEAD(-14), c_footR: M(0, 0, 0.14), c_footL: M(0.02, 0, -0.1), c_sword: AIM(-0.12, -0.15, 1), c_handR: HR(0.32, 0.6, -0.36, [0, -0.3, 0]), c_shield: AIM(0.4, 0.05, 1), c_handL: HL(0.32, 0.85, 0.2, [0, -0.3, 0]) },
  tuck: { hips: M(0, 0.04, 0), spine: R(22), chest: R(16), head: HEAD(10), c_footL: M(0, 0.3, 0.12), c_footR: M(0, 0.3, 0.12), c_handL: HL(0.25, 1.05, 0.2), c_handR: HR(0.25, 0.95, -0.3), c_sword: AIM(-0.2, 0.3, 1), c_shield: AIM(0.5, 0, 1) },
  /* in the air: knees a little up, guard kept */
  air: { hips: M(0, 0.02, 0), chest: R(4, -12), c_footR: M(0, 0.16, 0.12), c_footL: M(0, 0.08, -0.06), c_sword: AIM(-0.12, -0.3, 1), c_handR: HR(0.3, 0.97, -0.34), c_shield: AIM(0.6, 0.05, 1), c_handL: HL(0.26, 1.12, 0.24) },
};
const G = ['stand', 'guard'], AIR = ['stand', 'air'], back = { reset: true, use: G }, backAir = { reset: true, use: AIR };
const lunge = (dz, drop, foot) => ({ hips: M(0, -drop, dz), c_footR: M(0, 0, 0.14 + (foot === undefined ? dz * 1.3 : foot)) });
const C = brand.clips;
/* ---- standing, moving, being hit ---- */
C.Idle = { fps: 30, keys: [{ t: 0, use: G }, { t: 0.7, pose: { spine: R(1.5), chest: R(6, -12), head: HEAD(-1.5), c_handL: HL(0.26, 1.105, 0.24, [0, -0.05, 0]), c_sword: AIM(-0.12, -0.34, 1) } },
  { t: 1.4, pose: { spine: R(0), chest: R(4, -12), head: HEAD(0, 4), c_handL: HL(0.26, 1.12, 0.24, [0, -0.05, 0]), c_sword: AIM(-0.12, -0.3, 1) } },
  { t: 2.1, pose: { spine: R(1.5), chest: R(6, -12), head: HEAD(-1.5, 4), c_handL: HL(0.26, 1.105, 0.24, [0, -0.05, 0]), c_sword: AIM(-0.12, -0.34, 1) } }, { t: 2.8, pose: { spine: R(0), chest: R(4, -12), head: HEAD(), c_handL: HL(0.26, 1.12, 0.24, [0, -0.05, 0]), c_sword: AIM(-0.12, -0.3, 1) } }] };
const step = (a, b, lift, lean) => [
  { hips: M(0, -0.07, 0), chest: R(lean, -12 + 5), c_footR: M(0, 0, a), c_footL: M(0.02, lift * 0.3, -b) }, { hips: M(0, -0.04, 0), chest: R(lean, -12), c_footR: M(0, 0, 0), c_footL: M(0.02, lift, 0.02) },
  { hips: M(0, -0.07, 0), chest: R(lean, -12 - 5), c_footR: M(0, lift * 0.3, -b), c_footL: M(0.02, 0, a) }, { hips: M(0, -0.04, 0), chest: R(lean, -12), c_footR: M(0, lift, 0.02), c_footL: M(0.02, 0, 0) }];
{ const w = step(0.24, 0.2, 0.1, 4), r = step(0.36, 0.3, 0.2, 14);
  C.Walk = { fps: 30, keys: [{ t: 0, use: G, pose: w[0] }, { t: 0.25, pose: w[1] }, { t: 0.5, pose: w[2] }, { t: 0.75, pose: w[3] }, { t: 1.0, pose: w[0] }] };
  const run = { c_sword: AIM(-0.2, -0.45, -0.9), c_handR: HR(-0.12, 0.95, -0.4, [0, -0.07, 0.06]), c_handL: HL(0.36, 1.1, 0.16, [0, -0.07, 0.06]), c_shield: AIM(0.3, 0.05, 1), head: HEAD(-10) };   /* the blade trails behind, the door leads */
  C.Run = { fps: 30, keys: [{ t: 0, use: G, pose: Object.assign({}, run, r[0], { hips: M(0, -0.09, 0.06) }) }, { t: 0.175, pose: Object.assign({}, r[1], { hips: M(0, -0.04, 0.06) }) }, { t: 0.35, pose: Object.assign({}, r[2], { hips: M(0, -0.09, 0.06) }) },
    { t: 0.525, pose: Object.assign({}, r[3], { hips: M(0, -0.04, 0.06) }) }, { t: 0.7, pose: Object.assign({}, r[0], { hips: M(0, -0.09, 0.06) }) }] }; }
C.Crouch = { fps: 30, keys: [{ t: 0, use: G }, { t: 0.2, use: 'crouch' }] };
C.Rise = { fps: 30, keys: [{ t: 0, use: AIR, pose: { chest: R(-4, -12), head: HEAD(-8), c_footR: M(0, 0.22, 0.14), c_footL: M(0, 0.02, -0.1), c_sword: AIM(-0.12, -0.6, 0.8) } }, { t: 0.4, pose: { c_footR: M(0, 0.14, 0.1), c_footL: M(0, 0.06, -0.06) } }] };
C.Fall = { fps: 30, keys: [{ t: 0, use: AIR, pose: { chest: R(8, -12), head: HEAD(8), c_sword: AIM(-0.2, 0.3, 0.9), c_handR: HR(0.25, 1.15, -0.4) } }, { t: 0.25, pose: { c_footR: M(0, 0.1, 0.06), c_footL: M(0, 0.14, 0), c_sword: AIM(-0.2, 0.36, 0.9) } },
  { t: 0.5, pose: { c_footR: M(0, 0.16, 0.12), c_footL: M(0, 0.08, -0.06), c_sword: AIM(-0.2, 0.3, 0.9) } }] };
C.Land = { fps: 30, keys: [{ t: 0, use: ['stand', 'crouch'] }, { t: 0.18, pose: { hips: M(0, -0.12, 0), spine: R(6), chest: R(5, -12), head: HEAD(-4), c_handR: HR(0.3, 0.85, -0.35, [0, -0.12, 0]), c_handL: HL(0.28, 1.05, 0.22, [0, -0.12, 0]) } }, { t: 0.4, reset: true, use: G }] };
C.Shield = { fps: 30, keys: [{ t: 0, use: G }, { t: 0.15, pose: { hips: M(0, -0.16, 0), spine: R(10), chest: R(6, -30), head: HEAD(4, 20), c_shield: AIM(0.05, 0.05, 1), c_handL: HL(0.42, 1.0, 0.0, [0, -0.16, 0]), c_sword: AIM(-0.2, -0.4, -0.7), c_handR: HR(-0.05, 0.85, -0.4, [0, -0.16, 0]) } }] };   /* tucked in behind the door */
C.Hit = { fps: 30, keys: [{ t: 0, use: G, pose: { hips: M(0, -0.03, -0.1), spine: R(-14), chest: R(-12, -12), head: HEAD(-16), c_handL: HL(0.05, 1.3, 0.35, [0, -0.03, -0.1]), c_handR: HR(0.0, 1.05, -0.45, [0, -0.03, -0.1]), c_sword: AIM(-0.4, 0.5, 0.6), c_footR: M(0, 0.06, 0.2) } },
  { t: 0.3, pose: { spine: R(-8), chest: R(-6, -12), head: HEAD(-6) } }, { t: 0.6, reset: true, use: G }] };
C.Tumble = { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { spine: R(28), chest: R(20) } }, { t: 0.6, pose: { spine: R(22), chest: R(16) } }] };
C.Down = { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: R(-50), c_sword: AIM(-0.3, -0.2, 1), c_shield: AIM(0.9, 0.2, 0.4) } }, { t: 0.3, pose: { all: { rot: [-90, 0, 0], move: [0, 0.3, 0.9] }, c_handL: HL(-0.05, 1.05, 0.5), c_handR: HR(0.1, 0.95, -0.5), head: HEAD(-6) } }] };
C.Dodge = { fps: 30, keys: [{ t: 0, use: G }, { t: 0.14, pose: { all: R(0, 35), hips: M(0, -0.08, -0.18), spine: R(-12), chest: R(-8, -12), c_sword: AIM(-0.4, 0.3, 0.8) } }, { t: 0.4, reset: true, use: G }] };
C.Ledge = { fps: 30, keys: [{ t: 0, use: 'stand', pose: { chest: R(-4), head: HEAD(-10), c_handL: HL(0.3, 2.0, 0.1), c_shield: AIM(0.9, 0.2, -0.3), c_handR: HR(0.05, 0.8, -0.35), c_sword: AIM(-0.2, -1, 0.1), c_footL: M(0, 0, 0.04), c_footR: M(0, 0.06, -0.04) } },
  { t: 0.6, pose: { c_footL: M(0, 0.04, -0.04), c_footR: M(0, 0, 0.04), c_sword: AIM(-0.2, -1, -0.05) } }, { t: 1.2, pose: { c_footL: M(0, 0, 0.04), c_footR: M(0, 0.06, -0.04), c_sword: AIM(-0.2, -1, 0.1) } }] };
C.Hold = { fps: 30, keys: [{ t: 0, use: G, pose: { chest: R(6, -24), c_handL: HL(0.62, 1.15, 0.0, [0, -0.05, 0]), c_shield: AIM(1, 0.1, 0.2), c_sword: AIM(-0.3, 0.4, 0.8), c_handR: HR(0.15, 1.1, -0.4, [0, -0.05, 0]) } }, { t: 0.3, pose: { chest: R(8, -26), c_handL: HL(0.64, 1.13, 0.0, [0, -0.05, 0]) } }, { t: 0.6, pose: { chest: R(6, -24), c_handL: HL(0.62, 1.15, 0.0, [0, -0.05, 0]) } }] };
C.Held = { fps: 30, keys: [{ t: 0, use: AIR, pose: { hips: M(0, 0.06, 0), head: HEAD(-10), c_handL: HL(0.15, 1.3, 0.3), c_sword: AIM(-0.3, -0.8, 0.3) } }, { t: 0.25, pose: { c_footL: M(0, 0.16, 0.1), c_footR: M(0, 0.06, -0.05), c_handL: HL(0.15, 1.36, 0.3), c_sword: AIM(-0.3, -0.8, 0.5) } },
  { t: 0.5, pose: { c_footL: M(0, 0.08, -0.06), c_footR: M(0, 0.16, 0.12), c_handL: HL(0.15, 1.3, 0.3), c_sword: AIM(-0.3, -0.8, 0.3) } }] };
/* ---- ground attacks ---- */
C.Jab = { fps: 30, keys: [{ t: 0, use: G },   /* Hilt Rap: the pommel punched forward, blade up and back */
  { t: 0.1, pose: { chest: R(2, -22), c_handR: HR(0.05, 1.1, -0.36, [0, -0.05, 0]), c_sword: AIM(-0.1, 0.8, -0.5) } }, { t: 0.17, pose: Object.assign(lunge(0.12, 0.06), { chest: R(6, 12), c_handR: HR(0.6, 1.0, -0.22, [0, -0.06, 0.12]), c_sword: AIM(0, 0.75, -0.6) }) },
  { t: 0.27, pose: { c_handR: HR(0.62, 1.0, -0.22, [0, -0.06, 0.12]) } }, { t: 0.5, ...back }] };
const cut = (wind, hit, hold, end, dz, y0, y1, up) => ({ fps: 30, keys: [{ t: 0, use: G },   /* a level cut from her right across the front */
  { t: wind, pose: { chest: R(0, -30), hips: M(0, -0.05, -0.04), c_handR: HR(0.0, y0 + 0.12, -0.5, [0, -0.05, -0.04]), c_sword: AIM(-1, 0.25, -0.25) } },
  { t: hit, in: 'snap', pose: Object.assign(lunge(dz, 0.08), { chest: R(6, 14), c_handR: HR(0.3 + dz, y0, -0.2, [0, -0.08, dz]), c_sword: AIM(-0.05, up, 1) }) },
  { t: hold, pose: { chest: R(6, 22), c_sword: AIM(0.3, up, 1), c_handR: HR(0.3 + dz, y1, -0.12, [0, -0.08, dz]) } }, { t: end, ...back }] });
C.Cut = cut(0.12, 0.2, 0.3, 0.6, 0.16, 1.0, 1.02, 0.1);      /* Quick Cut and Watch Cut (jabs 2 and 3) */
C.Ember = cut(0.16, 0.26, 0.36, 0.8, 0.3, 1.0, 1.02, 0.1);   /* Ember Cut: the forward tilt, the full length of the blade */
C.Brim = { fps: 30, keys: [{ t: 0, use: G },   /* Brim Sweep: up in front, over the hat, down behind */
  { t: 0.2, pose: { hips: M(0, -0.1, 0.04), c_handR: HR(0.45, 0.8, -0.3, [0, -0.1, 0.04]), c_sword: AIM(-0.1, -0.5, 1) } },
  { t: 0.3, in: 'snap', pose: { hips: M(0, -0.02, 0.1), chest: R(-4, 6), head: HEAD(-10), c_handR: HR(0.6, 1.3, -0.24, [0, -0.02, 0.1]), c_sword: AIM(0, 1, -0.3) } },
  { t: 0.38, pose: { chest: R(-10, 0), head: HEAD(-16), c_handR: HR(0.3, 1.8, -0.2, [0, -0.02, 0.1]), c_sword: AIM(0, 0.35, -1) } },
  { t: 0.46, pose: { chest: R(-14, -10), c_handR: HR(0.1, 1.85, -0.24, [0, -0.02, 0.1]), c_sword: AIM(0, -0.4, -1) } }, { t: 0.9, ...back }] };
const low = [0, -0.32, 0.1], lowPose = { hips: M(0, -0.32, 0.1), spine: R(24), chest: R(10, 10), head: HEAD(-20), c_footR: M(0, 0, 0.32), c_handR: HR(0.52, 0.44, -0.18, low), c_sword: AIM(0, -0.08, 1), c_handL: HL(0.3, 0.8, 0.26, low), c_shield: AIM(0.8, 0.1, 0.6) };
C.Low = { fps: 30, keys: [{ t: 0, use: G },   /* Boot-Line Cut: a low cut along the floor */
  { t: 0.14, use: 'crouch', pose: { chest: R(8, -30), c_handR: HR(0.1, 0.5, -0.5, [0, -0.3, 0]), c_sword: AIM(-1, -0.1, 0.1) } }, { t: 0.24, in: 'snap', pose: lowPose }, { t: 0.34, pose: { c_sword: AIM(0.35, -0.02, 1), chest: R(10, 18) } }, { t: 0.75, ...back }] };
C.Cleave = { fps: 30, keys: [{ t: 0, use: G },   /* Forge Cleave: a long backswing, then everything forward */
  { t: 0.3, pose: { hips: M(0, -0.02, -0.1), spine: R(-8), chest: R(-10, -26), head: HEAD(-4), c_handR: HR(-0.1, 1.72, -0.34, [0, -0.02, -0.1]), c_sword: AIM(-0.1, 0.55, -1), c_handL: HL(0.4, 1.15, 0.12, [0, -0.02, -0.1]), c_shield: AIM(0.2, 0.05, 1) } },
  { t: 0.5, pose: { chest: R(-12, -30), c_sword: AIM(-0.1, 0.45, -1) } },
  { t: 0.6, in: 'snap', pose: Object.assign(lunge(0.4, 0.16), { spine: R(14), chest: R(16, 16), head: HEAD(-6), c_handR: HR(0.82, 1.06, -0.18, [0, -0.16, 0.4]), c_sword: AIM(0, 0.13, 1), c_handL: HL(0.2, 1.0, 0.4, [0, -0.16, 0.4]), c_shield: AIM(1, 0.1, 0.2) }) },
  { t: 0.72, pose: { c_sword: AIM(0.2, -0.1, 1), c_handR: HR(0.82, 1.0, -0.12, [0, -0.16, 0.4]) } }, { t: 0.84, pose: { c_sword: AIM(0.3, -0.6, 0.8) } }, { t: 1.25, ...back }] };
C.Lift = { fps: 30, keys: [{ t: 0, use: G },   /* Hinge Lift: the door's rim scoops, the blade cleaves straight up */
  { t: 0.28, use: 'crouch', pose: { chest: R(10, -34), c_handL: HL(0.4, 0.55, 0.05, [0, -0.3, 0]), c_shield: AIM(0, 0.6, 1), c_handR: HR(-0.1, 0.7, -0.4, [0, -0.3, 0]), c_sword: AIM(-0.2, -0.6, -0.7) } },
  { t: 0.38, in: 'snap', pose: { hips: M(0, -0.14, 0.1), chest: R(0, -30), c_handL: HL(0.66, 0.82, 0.0, [0, -0.14, 0.1]), c_shield: AIM(0, 0.8, 0.6) } },
  { t: 0.46, pose: { hips: M(0, 0, 0.1), spine: R(-4), chest: R(-8, 12), head: HEAD(-14), c_handR: HR(0.52, 1.36, -0.2, [0, 0, 0.1]), c_sword: AIM(0, 1, -0.45), c_handL: HL(0.4, 1.1, 0.2, [0, 0, 0.1]), c_shield: AIM(0.7, 0.2, 0.6) } },
  { t: 0.56, pose: { c_handR: HR(0.4, 1.5, -0.2, [0, 0, 0.1]), c_sword: AIM(0, 1, -0.6) } }, { t: 1.1, ...back }] };
C.Sweep = { fps: 30, keys: [{ t: 0, use: G },   /* Curfew Sweep and the floor attack: low in front, then round her right side to low behind */
  { t: 0.26, use: 'crouch', pose: { chest: R(8, -30), c_handR: HR(0.1, 0.5, -0.5, [0, -0.3, 0]), c_sword: AIM(-1, -0.1, 0.2) } }, { t: 0.36, in: 'snap', pose: lowPose },
  { t: 0.47, pose: { chest: R(12, -30), c_handR: HR(0.0, 0.44, -0.6, low), c_sword: AIM(-1, -0.02, 0) } },
  { t: 0.56, pose: { chest: R(14, -62), head: HEAD(-10, -40), c_handR: HR(-0.42, 0.44, -0.4, low), c_sword: AIM(-0.2, 0, -1) } }, { t: 0.66, pose: { c_sword: AIM(0.1, 0, -1) } }, { t: 1.15, ...back }] };
C.Drive = { fps: 30, keys: [{ t: 0, use: G },   /* Door Drive: shoulder-first behind the stove door */
  { t: 0.16, pose: { hips: M(0, -0.1, 0.08), spine: R(10), chest: R(12, -36), head: HEAD(-6, 26), c_handL: HL(0.5, 1.05, 0.02, [0, -0.1, 0.08]), c_shield: AIM(0, 0.05, 1), c_handR: HR(-0.15, 0.9, -0.42, [0, -0.1, 0.08]), c_sword: AIM(-0.2, -0.5, -0.8) } },
  { t: 0.3, in: 'snap', pose: { hips: M(0, -0.14, 0.34), c_footL: M(0.02, 0, 0.5), c_footR: M(0, 0, -0.05), c_handL: HL(0.88, 1.0, 0.02, [0, -0.14, 0.34]) } }, { t: 0.5, pose: { hips: M(0, -0.14, 0.38) } }, { t: 0.9, ...back }] };
/* ---- air attacks ---- */
C.Wheel = { fps: 30, keys: [{ t: 0, use: AIR },   /* Watch Wheel: a rap with the hilt, then once round with the blade held level */
  { t: 0.12, pose: { chest: R(6, 12), c_handR: HR(0.56, 0.98, -0.22), c_sword: AIM(0, 0.75, -0.6), c_footR: M(0, 0.24, 0.14), c_footL: M(0, 0.2, 0.02) } },
  { t: 0.24, pose: { chest: R(4, -20), c_handR: HR(0.2, 1.02, -0.5), c_sword: AIM(-1, 0.05, 0.2) } },
  { t: 0.36, pose: { all: R(0, 120), chest: R(4, 0), c_handR: HR(0.5, 1.02, -0.34), c_sword: AIM(0.87, 0.05, -0.5) } }, { t: 0.48, pose: { all: R(0, 240), c_sword: AIM(-0.87, 0.05, -0.5) } },
  { t: 0.6, pose: { all: R(0, 360), c_sword: AIM(0, 0.05, 1) } }, { t: 0.8, reset: true, use: AIR, pose: { all: R(0, 360) } }] };
C.Ward = { fps: 30, keys: [{ t: 0, use: AIR },   /* High Ward: a forward cut held out */
  { t: 0.2, pose: { chest: R(-4, -24), c_handR: HR(0.05, 1.5, -0.4), c_sword: AIM(-0.5, 0.8, -0.3) } }, { t: 0.3, in: 'snap', pose: { hips: M(0, 0.02, 0.08), chest: R(10, 16), c_handR: HR(0.62, 1.08, -0.2, [0, 0.02, 0.08]), c_sword: AIM(0, 0.09, 1), c_footL: M(0, 0.12, -0.2) } },
  { t: 0.45, pose: { c_sword: AIM(0.15, 0.05, 1) } }, { t: 0.85, ...backAir }] };
C.About = { fps: 30, keys: [{ t: 0, use: AIR },   /* About-Face Cut: a hard cut behind her */
  { t: 0.24, pose: { chest: R(0, 20), c_handR: HR(0.4, 1.15, -0.2), c_sword: AIM(0.4, 0.2, 1) } },
  { t: 0.36, in: 'snap', pose: { hips: M(0, 0.02, -0.06), chest: R(-8, -50), head: HEAD(0, -40), c_handR: HR(-0.3, 1.12, -0.5, [0, 0.02, -0.06]), c_sword: AIM(-0.1, 0.08, -1), c_footR: M(0, 0.1, 0.25), c_handL: HL(0.4, 1.1, 0.2), c_shield: AIM(0.2, 0, 1) } },
  { t: 0.48, pose: { c_sword: AIM(0.2, 0.05, -1) } }, { t: 0.9, ...backAir }] };
C.Arc = { fps: 30, keys: [{ t: 0, use: AIR },   /* Brim Arc: over her head from front to back */
  { t: 0.2, pose: { c_handR: HR(0.5, 1.25, -0.26), c_sword: AIM(0, 0.3, 1) } }, { t: 0.3, in: 'snap', pose: { chest: R(-6, 4), head: HEAD(-14), c_handR: HR(0.45, 1.66, -0.22), c_sword: AIM(0, 0.9, 0.6) } },
  { t: 0.4, pose: { chest: R(-12, -6), c_handR: HR(0.2, 1.86, -0.22), c_sword: AIM(0, 0.6, -0.9) } }, { t: 0.5, pose: { c_sword: AIM(0, 0.2, -1) } }, { t: 0.85, ...backAir }] };
C.Drop = { fps: 30, keys: [{ t: 0, use: AIR },   /* Poker Drop: the point driven straight down */
  { t: 0.3, pose: { chest: R(-8, -8), c_handR: HR(0.2, 1.66, -0.24), c_sword: AIM(0, -1, 0.1), c_handL: HL(0.25, 1.5, 0.1), c_shield: AIM(0.9, 0.3, 0.3), c_footL: M(0, 0.26, 0.1), c_footR: M(0, 0.26, 0.1) } },
  { t: 0.45, in: 'snap', pose: { hips: M(0, 0.1, 0), chest: R(18, -4), head: HEAD(20), c_handR: HR(0.22, 0.72, -0.22, [0, 0.1, 0]), c_sword: AIM(0, -1, 0.04), c_footL: M(0, 0.34, -0.2), c_footR: M(0, 0.34, -0.2) } },
  { t: 0.58, pose: { c_handR: HR(0.22, 0.68, -0.22, [0, 0.1, 0]) } }, { t: 1.0, ...backAir }] };
/* ---- grab ---- */
C.Reach = { fps: 30, keys: [{ t: 0, use: G },   /* Gauntlet Grab: the door swung aside, the shield hand reaching past it */
  { t: 0.2, pose: { chest: R(0, -6), c_handL: HL(0.2, 1.1, 0.3, [0, -0.05, 0]), c_shield: AIM(1, 0.1, 0.1) } }, { t: 0.34, in: 'snap', pose: { hips: M(0, -0.06, 0.12), chest: R(8, -34), c_handL: HL(0.74, 1.04, 0.02, [0, -0.06, 0.12]), c_shield: AIM(1, 0.2, -0.1) } },
  { t: 0.46, pose: { c_handL: HL(0.76, 1.04, 0.02, [0, -0.06, 0.12]) } }, { t: 0.8, ...back }] };
/* ---- specials ---- */
const thrust = (draw, hit, hold, end, dz, pull) => ({ fps: 30, keys: [{ t: 0, use: G },   /* Hot Iron Thrust: the arm drawn back, then straight out */
  { t: draw * 0.5, pose: { hips: M(0, -0.05, -0.06), chest: R(0, -26), c_handR: HR(-0.1, 1.05, -0.4, [0, -0.05, -0.06]), c_sword: AIM(0, 0.02, 1), c_handL: HL(0.42, 1.1, 0.08, [0, -0.05, -0.06]), c_shield: AIM(0.1, 0.05, 1) } },
  { t: draw, pose: { hips: M(0, -0.08, -pull), chest: R(-2, -34), c_handR: HR(-0.16 - pull, 1.08, -0.42, [0, -0.08, -pull]) } },
  { t: hit, in: 'snap', pose: Object.assign(lunge(dz, 0.12), { chest: R(8, 20), head: HEAD(-4), c_handR: HR(0.36 + dz, 1.03, -0.2, [0, -0.12, dz]), c_sword: AIM(0, 0.02, 1), c_handL: HL(0.1, 1.05, 0.4, [0, -0.12, dz]), c_shield: AIM(1, 0.1, 0.2) }) },
  { t: hold, pose: { c_handR: HR(0.38 + dz, 1.03, -0.2, [0, -0.12, dz]) } }, { t: end, ...back }] });
C.Thrust = thrust(0.3, 0.45, 0.55, 1.1, 0.34, 0.04);
C.ThrustLong = thrust(0.7, 0.8, 0.9, 1.5, 0.56, 0.16);
C.Bash = { fps: 30, keys: [{ t: 0, use: G },   /* Stove Door Bash: the door comes up, a short step, the bash */
  { t: 0.12, pose: { hips: M(0, -0.08, 0), spine: R(6), chest: R(6, -32), head: HEAD(0, 24), c_handL: HL(0.46, 1.06, 0.02, [0, -0.08, 0]), c_shield: AIM(0, 0.05, 1), c_handR: HR(-0.1, 0.9, -0.42, [0, -0.08, 0]), c_sword: AIM(-0.2, -0.5, -0.8) } },
  { t: 0.28, pose: { hips: M(0, -0.1, -0.02), c_handL: HL(0.42, 1.06, 0.02, [0, -0.1, -0.02]) } },
  { t: 0.36, in: 'snap', pose: { hips: M(0, -0.12, 0.3), chest: R(12, -40), c_footL: M(0.02, 0, 0.46), c_footR: M(0, 0, 0), c_handL: HL(0.9, 1.0, 0.02, [0, -0.12, 0.3]) } }, { t: 0.46, pose: { c_handL: HL(0.92, 1.0, 0.02, [0, -0.12, 0.3]) } }, { t: 1.1, ...back }] };
C.RiseCut = { fps: 30, keys: [{ t: 0, use: G },   /* Watchfire Rise: a rising cut, then up with the blade overhead */
  { t: 0.1, use: 'crouch', pose: { c_handR: HR(0.36, 0.55, -0.3, [0, -0.3, 0]), c_sword: AIM(0, -0.5, 1) } },
  { t: 0.2, in: 'snap', pose: { hips: M(0, 0.04, 0), spine: R(-4), chest: R(-6, 8), head: HEAD(-14), c_handR: HR(0.36, 1.2, -0.24, [0, 0.04, 0]), c_sword: AIM(0, 1, 0.34), c_footR: M(0, 0.1, 0.1), c_footL: M(0, -0.02, -0.08), c_handL: HL(0.2, 1.0, 0.3, [0, 0.04, 0]), c_shield: AIM(0.9, 0, 0.4) } },
  { t: 0.3, pose: { c_handR: HR(0.32, 1.7, -0.22, [0, 0.04, 0]), c_sword: AIM(0, 1, 0.2) } }, { t: 0.9, pose: { c_handR: HR(0.25, 1.85, -0.22, [0, 0.04, 0]), c_sword: AIM(0, 1, 0.05), c_footR: M(0, 0.04, 0.04) } }, { t: 1.0, pose: {} }] };
C.Step = { fps: 30, keys: [{ t: 0, use: G },   /* Night Step: back out of a swing, in again, a low cut */
  { t: 0.12, pose: { hips: M(0, -0.04, -0.12), spine: R(-10), chest: R(-8, -16), c_footL: M(0.02, 0.04, -0.3), c_sword: AIM(-0.3, 0.3, 0.9), c_handR: HR(0.1, 1.0, -0.4, [0, -0.04, -0.12]) } },
  { t: 0.25, pose: { hips: M(0, -0.08, -0.2), c_footL: M(0.02, 0, -0.34), c_footR: M(0, 0, 0.0) } },
  { t: 0.38, use: 'crouch', pose: { chest: R(8, -30), c_handR: HR(0.1, 0.5, -0.5, [0, -0.3, 0]), c_sword: AIM(-1, -0.1, 0.2) } }, { t: 0.48, in: 'snap', pose: lowPose }, { t: 0.58, pose: { c_sword: AIM(0.3, 0.02, 1), chest: R(10, 18) } }, { t: 1.2, ...back }] };
if (process.argv[2] === 'test') {
  for (const k of Object.keys(C)) delete C[k];
  C.Test = { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 1, use: 'guard' }, { t: 2, use: 'crouch' }, { t: 3, reset: true, use: ['stand', 'air'] }] };
}
const out = path.join(__dirname, '..', '..', 'assets', 'brand', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(brand, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/brand-rigged.glb', texture: 1024, out: 'export/brand-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + brand.bones.length + ' bones, ' + Object.keys(brand.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const entry = { file: 'assets/brand/export/brand-v1.glb', height: 14.42,
  clips: { idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Bash', from: 0.28, to: 0.8 }, swap: { clip: 'Tumble', bounce: true } },
  strikers: [{ bone: 'swordTip', ext: 0.4 }, { bone: 'shield', ext: 2.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'handR', ext: 1.2 }, { bone: 'footR', ext: 1.8 }],
  springs: [],
  attacks: { jab: A('Jab', 0.17, 0.27, 0, 0.5), jab2: A('Cut', 0.2, 0.3, 0, 0.6), jab3: A('Cut', 0.2, 0.3, 0, 0.6), ftilt: A('Ember', 0.26, 0.36, 0, 0.8), utilt: A('Brim', 0.3, 0.46), dtilt: A('Low', 0.24, 0.34, 0, 0.75), dash: A('Drive', 0.3, 0.5),
    fsmash: A('Cleave', 0.6, 0.72, 0, 1.25), usmash: A('Lift', 0.38, 0.56, 0, 1.1), dsmash: A('Sweep', 0.36, 0.66, 0, 1.15),
    nair: A('Wheel', 0.12, 0.6, 0, 0.8), fair: A('Ward', 0.3, 0.45, 0, 0.85), bair: A('About', 0.36, 0.48), uair: A('Arc', 0.3, 0.5, 0, 0.85), dair: A('Drop', 0.45, 0.58, 0, 1.0),
    grab: A('Reach', 0.34, 0.46, 0, 0.8), dgrab: A('Reach', 0.34, 0.46, 0, 0.8), pgrab: A('Reach', 0.34, 0.46, 0, 0.8), getup: A('Sweep', 0.36, 0.66, 0, 1.15), ledgeatk: A('Ember', 0.26, 0.36, 0, 0.8),
    nspec: A('Thrust', 0.45, 0.55, 0, 1.1), nspecH: A('ThrustLong', 0.8, 0.9, 0, 1.5), sspec: A('Bash', 0.36, 0.46, 0, 1.1), uspec: A('RiseCut', 0.2, 0.3, 0, 1.0), dspec: A('Step', 0.48, 0.58, 0, 1.2), '*': A('Cut', 0.2, 0.3, 0, 0.6) } };
if (process.argv[2] !== 'test') { const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
  current.Brand = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', ')); }
