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
/* ---- attacks (rework to the document, 2026-11-11) ----
   Timed in the game's own frames: key times are frame / 60, and each attack's manifest entry maps the clip one to one onto
   the move (AF below), so a pose keyed on a frame is the pose on that frame of the move. On every active frame of a sword
   hit the blade lies along that hit's capsule from the document (sim.js BRAND), its point at the capsule's far end plus
   0.6 of its radius: the sword as drawn is where it hits, and the red point the game draws on it is the end of the reach.
   onCap works out the hand and the blade's direction from the capsule; contact-fix.json holds the small corrections
   measured in the game (where the chest's turn moves the hand off its target). */
const fr = n => n / 60;
/* kept from the first version (timed in seconds against the move's contact frames): Hilt Tap, Shield Drive, the grabs */
C.Jab = { fps: 30, keys: [{ t: 0, use: G },   /* Hilt Rap: the pommel punched forward, blade up and back */
  { t: 0.1, pose: { chest: R(2, -22), c_handR: HR(0.05, 1.1, -0.36, [0, -0.05, 0]), c_sword: AIM(-0.1, 0.8, -0.5) } }, { t: 0.17, pose: Object.assign(lunge(0.12, 0.06), { chest: R(6, 12), c_handR: HR(0.6, 1.0, -0.22, [0, -0.06, 0.12]), c_sword: AIM(0, 0.75, -0.6) }) },
  { t: 0.27, pose: { c_handR: HR(0.62, 1.0, -0.22, [0, -0.06, 0.12]) } }, { t: 0.5, ...back }] };
C.Drive = { fps: 30, keys: [{ t: 0, use: G },   /* Door Drive: shoulder-first behind the stove door */
  { t: 0.16, pose: { hips: M(0, -0.1, 0.08), spine: R(10), chest: R(12, -36), head: HEAD(-6, 26), c_handL: HL(0.5, 1.05, 0.02, [0, -0.1, 0.08]), c_shield: AIM(0, 0.05, 1), c_handR: HR(-0.15, 0.9, -0.42, [0, -0.1, 0.08]), c_sword: AIM(-0.2, -0.5, -0.8) } },
  { t: 0.3, in: 'snap', pose: { hips: M(0, -0.14, 0.34), c_footL: M(0.02, 0, 0.5), c_footR: M(0, 0, -0.05), c_handL: HL(0.88, 1.0, 0.02, [0, -0.14, 0.34]) } }, { t: 0.5, pose: { hips: M(0, -0.14, 0.38) } }, { t: 0.9, ...back }] };
C.Reach = { fps: 30, keys: [{ t: 0, use: G },   /* Gauntlet Grab: the door swung aside, the shield hand reaching past it */
  { t: 0.2, pose: { chest: R(0, -6), c_handL: HL(0.2, 1.1, 0.3, [0, -0.05, 0]), c_shield: AIM(1, 0.1, 0.1) } }, { t: 0.34, in: 'snap', pose: { hips: M(0, -0.06, 0.12), chest: R(8, -34), c_handL: HL(0.74, 1.04, 0.02, [0, -0.06, 0.12]), c_shield: AIM(1, 0.2, -0.1) } },
  { t: 0.46, pose: { c_handL: HL(0.76, 1.04, 0.02, [0, -0.06, 0.12]) } }, { t: 0.8, ...back }] };
const HM = 14 / 7.5837;   /* metres per H: Flint's standing height is 14 game units, and the model is drawn at 7.5837 units a metre */
const BL = len(sub(TIP, GRIP)) * 1.2, WOFF = sub(WR, GRIP);   /* blade length from the grip to the point (with BIG), and the wrist from the grip */
const FIXF = path.join(__dirname, '..', '..', 'assets', 'brand', 'work', 'contact-fix.json');
const FIX = (() => { try { return JSON.parse(fs.readFileSync(FIXF, 'utf8')); } catch (e) { return {}; } })();
const CONTACTS = [];   /* written out for the in-game check: which capsule each contact key puts the blade on */
const onCap = (id, cap, hip, o) => {
  o = o || {}; const [x1, y1, x2, y2, r] = cap, L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = L > 0.01 ? (x2 - x1) / L : (o.dir || [0, -1])[0], uy = L > 0.01 ? (y2 - y1) / L : (o.dir || [0, -1])[1], k = o.k === undefined ? 0.6 : o.k;
  const fx = FIX[id] || [0, 0], tz = (x2 + ux * r * k) * HM, ty = (y2 + uy * r * k) * HM, gz = tz - ux * BL, gy = ty - uy * BL;
  if (!CONTACTS.some(c => c.id === id)) CONTACTS.push({ id, cap, k, grip: [gz / HM, gy / HM], tip: [tz / HM, ty / HM] });
  /* the hips as the pose has them (set on every contact key, so a correction on one key does not carry into the next); where
     the arm cannot reach, the correction's third and fourth numbers move them (forward, up) by what is left over */
  const hz = fx[2] || 0, hy = fx[3] || 0, hp = [hip[0], hip[1] + hy, hip[2] + hz];
  return Object.assign({ hips: M(0, hp[1], hp[2]) }, { c_handR: HR(gz + WOFF[2] + fx[0], gy + WOFF[1] + fx[1], o.dep === undefined ? -0.26 : o.dep, hp), c_sword: AIM(o.ax || 0, uy, ux) });
};
const AF = (clip, a0, a1, t, extra) => Object.assign({ clip, start: 0, contact: [fr(a0), fr(a1 + 1)], end: fr(t) }, extra || {});
const cat = (...a) => Object.assign({}, ...a);
/* the document's capsules, in H from her feet (as in sim.js) */
const CAP = {
  jab2: [0.29, 0.52, 0.59, 0.58, 0.14], jab3: [0.29, 0.55, 0.72, 0.63, 0.15], ftilt: [0.31, 0.53, 0.90, 0.59, 0.14],
  utiltA: [0.45, 0.69, 0.28, 1.07, 0.16], utiltB: [0.26, 1.14, -0.44, 0.87, 0.16], dtilt: [0.29, 0.24, 0.83, 0.19, 0.13],
  fsmash: [0.34, 0.55, 1.04, 0.64, 0.19], usmash: [0.31, 0.68, 0.06, 1.20, 0.22], dsmashF: [0.35, 0.20, 0.84, 0.19, 0.16], dsmashR: [-0.31, 0.20, -0.78, 0.20, 0.16],
  nair: [-0.15, 0.51, 0.66, 0.57, 0.18], fair: [0.31, 0.57, 0.91, 0.62, 0.16], bair: [-0.32, 0.58, -0.93, 0.63, 0.17], uair: [0.36, 0.88, -0.31, 1.14, 0.18],
  dair: [0.10, 0.36, 0.13, -0.23, 0.19], dairLate: [0.10, 0.62, 0.10, 0.04, 0.17],
  getupF: [0.27, 0.24, 0.65, 0.23, 0.17], getupR: [-0.28, 0.23, -0.61, 0.23, 0.17], ledgeatk: [0.26, 0.33, 0.73, 0.38, 0.16],
  nspec: [0.32, 0.56, 0.96, 0.57, 0.14], nspecH: [0.35, 0.56, 1.26, 0.59, 0.15], uspec: [0.19, 0.56, 0.33, 0.97, 0.17], dspec: [0.32, 0.22, 0.95, 0.25, 0.15] };
const WIND = { chest: R(-4, -24), c_sword: AIM(-0.35, 0.85, -0.4) };   /* a level cut starts with the blade raised up and back, so its arc shows from the side */
/* a level cut: drawn back on frame a0 - 3, on the capsule from a0 to a1, back to guard by t */
const levelCut = (id, a0, a1, t, dz) => { const hip = [0, -0.08, dz]; return { fps: 60, keys: [{ t: 0, use: G },
  { t: fr(Math.max(1, a0 - 3)), pose: cat(WIND, { hips: M(0, -0.05, -0.04), c_handR: HR(0.05, 1.42, -0.4, [0, -0.05, -0.04]) }) },
  { t: fr(a0), in: 'snap', pose: cat(lunge(dz, 0.08), { chest: R(6, 14) }, onCap(id, CAP[id], hip)) },
  { t: fr(a1), pose: cat({ chest: R(6, 20) }, onCap(id, CAP[id], hip)) }, { t: fr(t), ...back }] }; };
C.Cut2 = levelCut('jab2', 5, 6, 19, 0.06);        /* Short Cut */
C.Cut3 = levelCut('jab3', 7, 9, 26, 0.14);        /* Cross Cut */
C.Ember = levelCut('ftilt', 7, 9, 24, 0.3);       /* Ember Cut: the full length of the blade */
/* Crown Guard: up in front on 7 and 8, over the hat and down behind on 9 and 10 */
{ const hA = [0, -0.02, 0.1];
  C.Brim = { fps: 60, keys: [{ t: 0, use: G },
    { t: fr(4), pose: { hips: M(0, -0.1, 0.04), c_handR: HR(0.45, 0.8, -0.3, [0, -0.1, 0.04]), c_sword: AIM(-0.1, -0.5, 1) } },
    { t: fr(7), in: 'snap', pose: cat({ hips: M(0, -0.02, 0.1), chest: R(-4, 6), head: HEAD(-10) }, onCap('utiltA', CAP.utiltA, hA)) },
    { t: fr(8), pose: onCap('utiltA', CAP.utiltA, hA) },
    { t: fr(9), pose: cat({ chest: R(-12, -4), head: HEAD(-16) }, onCap('utiltB', CAP.utiltB, hA)) },
    { t: fr(10), pose: onCap('utiltB', CAP.utiltB, hA) },
    { t: fr(15), pose: { chest: R(-10, -8), c_handR: HR(0.1, 1.7, -0.26, hA), c_sword: AIM(0, -0.5, -1) } }, { t: fr(25), ...back }] }; }
/* Greave Cut: a low cut along the floor */
const low = [0, -0.32, 0.1], lowBody = { hips: M(0, -0.32, 0.1), spine: R(24), chest: R(10, 10), head: HEAD(-20), c_footR: M(0, 0, 0.32), c_handL: HL(0.3, 0.8, 0.26, low), c_shield: AIM(0.8, 0.1, 0.6) };
const crouchWind = { chest: R(8, -30), c_handR: HR(0.1, 0.5, -0.5, [0, -0.3, 0]), c_sword: AIM(-1, -0.1, 0.1) };
C.Low = { fps: 60, keys: [{ t: 0, use: G }, { t: fr(3), use: 'crouch', pose: crouchWind },
  { t: fr(6), in: 'snap', pose: cat(lowBody, onCap('dtilt', CAP.dtilt, low)) }, { t: fr(8), pose: cat({ chest: R(10, 16) }, onCap('dtilt', CAP.dtilt, low)) }, { t: fr(23), ...back }] };
/* Vorpal Cleave: a long backswing (held there while it charges, frame 8), then everything forward on 16 to 19 */
{ const hp = [0, -0.16, 0.4];
  C.Cleave = { fps: 60, keys: [{ t: 0, use: G },
    { t: fr(8), pose: { hips: M(0, -0.02, -0.1), spine: R(-8), chest: R(-10, -26), head: HEAD(-4), c_handR: HR(-0.1, 1.72, -0.34, [0, -0.02, -0.1]), c_sword: AIM(-0.1, 0.55, -1), c_handL: HL(0.4, 1.15, 0.12, [0, -0.02, -0.1]), c_shield: AIM(0.2, 0.05, 1) } },
    { t: fr(13), pose: { chest: R(-12, -30), c_sword: AIM(-0.1, 0.45, -1) } },
    { t: fr(16), in: 'snap', pose: cat(lunge(0.4, 0.16), { spine: R(14), chest: R(16, 16), head: HEAD(-6), c_handL: HL(0.2, 1.0, 0.4, hp), c_shield: AIM(1, 0.1, 0.2) }, onCap('fsmash', CAP.fsmash, hp)) },
    { t: fr(19), pose: onCap('fsmash', CAP.fsmash, hp) }, { t: fr(26), pose: { c_sword: AIM(0.3, -0.6, 0.8), c_handR: HR(0.7, 0.9, -0.14, hp) } }, { t: fr(47), ...back }] }; }
/* Gate Raise: the door's rim scoops on 13 and 14, the blade cleaves up through on 15 to 17 */
{ const hp = [0, 0, 0.1];
  C.Lift = { fps: 60, keys: [{ t: 0, use: G },
    { t: fr(6), use: 'crouch', pose: { chest: R(10, -34), c_handL: HL(0.4, 0.55, 0.05, [0, -0.3, 0]), c_shield: AIM(0, 0.6, 1), c_handR: HR(-0.1, 0.7, -0.4, [0, -0.3, 0]), c_sword: AIM(-0.2, -0.6, -0.7) } },
    { t: fr(13), in: 'snap', pose: { hips: M(0, -0.14, 0.1), chest: R(0, -30), c_handL: HL(0.66, 0.82, 0.0, [0, -0.14, 0.1]), c_shield: AIM(0, 0.8, 0.6), c_handR: HR(0.25, 0.8, -0.4, [0, -0.14, 0.1]), c_sword: AIM(0, 0.2, 1) } },
    { t: fr(15), in: 'snap', pose: cat({ hips: M(0, 0, 0.1), spine: R(-4), chest: R(-8, 12), head: HEAD(-14), c_handL: HL(0.4, 1.1, 0.2, hp), c_shield: AIM(0.7, 0.2, 0.6) }, onCap('usmash', CAP.usmash, hp)) },
    { t: fr(17), pose: onCap('usmash', CAP.usmash, hp) }, { t: fr(46), ...back }] }; }
/* Rampart Sweep: low in front on 12 and 13, round her right side, low behind on 17 and 18. The floor attack is the same
   two cuts a few frames later (19 and 20, 24 and 25); on her back the clip is played turned round (getupB), behind first. */
const sweep = (idF, idR, f1, f2, t) => { const turn = { chest: R(14, -62), head: HEAD(-10, -40) };
  return { fps: 60, keys: [{ t: 0, use: G }, { t: fr(f1 - 4), use: 'crouch', pose: crouchWind },
    { t: fr(f1), in: 'snap', pose: cat(lowBody, onCap(idF, CAP[idF], low)) }, { t: fr(f1 + 1), pose: onCap(idF, CAP[idF], low) },
    { t: fr(Math.round((f1 + f2) / 2) + 1), pose: { chest: R(12, -30), c_handR: HR(0.0, 0.44, -0.6, low), c_sword: AIM(-1, -0.02, 0) } },
    { t: fr(f2), pose: cat(turn, onCap(idR, CAP[idR], low, { dep: -0.4 })) }, { t: fr(f2 + 1), pose: onCap(idR, CAP[idR], low, { dep: -0.4 }) }, { t: fr(t), ...back }] }; };
C.Sweep = sweep('dsmashF', 'dsmashR', 12, 17, 42);
C.FloorSweep = sweep('getupF', 'getupR', 19, 24, 47);
/* ---- air attacks ---- */
/* Guard Wheel: a rap with the hilt on 6 and 7, then once round with the blade held level, the turn made on 12 to 15 */
{ const lv = onCap('nair', CAP.nair, [0, 0, 0]);
  C.Wheel = { fps: 60, keys: [{ t: 0, use: AIR },
    { t: fr(6), in: 'snap', pose: { chest: R(6, 12), c_handR: HR(0.56, 0.98, -0.22), c_sword: AIM(0, 0.75, -0.6), c_footR: M(0, 0.24, 0.14), c_footL: M(0, 0.2, 0.02) } },
    { t: fr(9), pose: { chest: R(4, -20), c_handR: HR(0.2, 1.02, -0.5), c_sword: AIM(-1, 0.05, 0.2) } },
    { t: fr(12), pose: cat({ all: R(0, 0), chest: R(4, 0) }, lv) }, { t: fr(13), pose: { all: R(0, 120) } }, { t: fr(14), pose: { all: R(0, 240) } },
    { t: fr(15), pose: { all: R(0, 360) } }, { t: fr(24), reset: true, use: AIR, pose: { all: R(0, 360) } }] }; }
/* High Guard: a forward cut held out on 7 to 10 */
C.Ward = { fps: 60, keys: [{ t: 0, use: AIR }, { t: fr(4), pose: { chest: R(-4, -24), c_handR: HR(0.05, 1.5, -0.4), c_sword: AIM(-0.5, 0.8, -0.3) } },
  { t: fr(7), in: 'snap', pose: cat({ hips: M(0, 0.02, 0.08), chest: R(10, 16), c_footL: M(0, 0.12, -0.2) }, onCap('fair', CAP.fair, [0, 0.02, 0.08])) },
  { t: fr(10), pose: onCap('fair', CAP.fair, [0, 0.02, 0.08]) }, { t: fr(30), ...backAir }] };
/* Reverse Cut: a hard cut behind her on 8 to 10 */
C.About = { fps: 60, keys: [{ t: 0, use: AIR }, { t: fr(5), pose: { chest: R(0, 20), c_handR: HR(0.4, 1.15, -0.2), c_sword: AIM(0.4, 0.2, 1) } },
  { t: fr(8), in: 'snap', pose: cat({ hips: M(0, 0.02, -0.06), chest: R(-8, -50), head: HEAD(0, -40), c_footR: M(0, 0.1, 0.25), c_handL: HL(0.4, 1.1, 0.2), c_shield: AIM(0.2, 0, 1) }, onCap('bair', CAP.bair, [0, 0.02, -0.06], { dep: -0.4 })) },
  { t: fr(10), pose: onCap('bair', CAP.bair, [0, 0.02, -0.06], { dep: -0.4 }) }, { t: fr(34), ...backAir }] };
/* Crown Arc: from in front, over her head, to behind: on the capsule from 6 to 9 */
C.Arc = { fps: 60, keys: [{ t: 0, use: AIR }, { t: fr(3), pose: { c_handR: HR(0.5, 1.25, -0.26), c_sword: AIM(0, 0.3, 1) } },
  { t: fr(6), in: 'snap', pose: cat({ chest: R(-12, -6), head: HEAD(-14) }, onCap('uair', CAP.uair, [0, 0, 0])) },
  { t: fr(9), pose: onCap('uair', CAP.uair, [0, 0, 0]) }, { t: fr(13), pose: { c_sword: AIM(0, -0.2, -1), c_handR: HR(-0.05, 1.6, -0.26) } }, { t: fr(27), ...backAir }] };
/* Blade Drop: the point driven straight down; on 13 to 15 the point is the spike, then on 16 the blade has come up a little (the late hit) */
{ const hp = [0, 0.1, 0], body = { hips: M(0, 0.1, 0), chest: R(18, -4), head: HEAD(20), c_footL: M(0, 0.34, -0.2), c_footR: M(0, 0.34, -0.2) };
  C.Drop = { fps: 60, keys: [{ t: 0, use: AIR },
    { t: fr(8), pose: { chest: R(-8, -8), c_handR: HR(0.2, 1.66, -0.24), c_sword: AIM(0, -1, 0.1), c_handL: HL(0.25, 1.5, 0.1), c_shield: AIM(0.9, 0.3, 0.3), c_footL: M(0, 0.26, 0.1), c_footR: M(0, 0.26, 0.1) } },
    { t: fr(13), in: 'snap', pose: cat(body, onCap('dair', CAP.dair, hp, { k: 0 })) }, { t: fr(15), pose: onCap('dair', CAP.dair, hp, { k: 0 }) },
    { t: fr(16), pose: onCap('dairLate', CAP.dairLate, hp, { k: 0 }) }, { t: fr(41), ...backAir }] }; }
/* ---- get-ups ---- */
/* Rising Cut, from the ledge: up onto the stage and a cut along the lip on 20 to 22 */
C.LipCut = { fps: 60, keys: [{ t: 0, use: 'crouch' }, { t: fr(16), use: 'crouch', pose: crouchWind },
  { t: fr(20), in: 'snap', pose: cat({ hips: M(0, -0.2, 0.12), chest: R(12, 10), c_footR: M(0, 0, 0.3) }, onCap('ledgeatk', CAP.ledgeatk, [0, -0.2, 0.12])) },
  { t: fr(22), pose: onCap('ledgeatk', CAP.ledgeatk, [0, -0.2, 0.12]) }, { t: fr(46), ...back }] };
/* ---- specials ---- */
/* Vorpal Thrust: the arm drawn back, then straight out. Held through frame 9 it becomes the long one (nspecH, from frame 9). */
const thrust = (id, draw, a0, a1, t, dz, pull) => { const hp = [0, -0.12, dz]; return { fps: 60, keys: [{ t: 0, use: G },
  { t: fr(5), pose: { hips: M(0, -0.05, -0.06), chest: R(0, -26), c_handR: HR(-0.1, 1.05, -0.4, [0, -0.05, -0.06]), c_sword: AIM(0, 0.02, 1), c_handL: HL(0.42, 1.1, 0.08, [0, -0.05, -0.06]), c_shield: AIM(0.1, 0.05, 1) } },
  { t: fr(draw), pose: { hips: M(0, -0.08, -pull), chest: R(-2, -34), c_handR: HR(-0.16 - pull, 1.08, -0.42, [0, -0.08, -pull]) } },
  { t: fr(a0), in: 'snap', pose: cat(lunge(dz, 0.12), { chest: R(8, 20), head: HEAD(-4), c_handL: HL(0.1, 1.05, 0.4, hp), c_shield: AIM(1, 0.1, 0.2) }, onCap(id, CAP[id], hp, { dep: -0.2 })) },
  { t: fr(a1), pose: onCap(id, CAP[id], hp, { dep: -0.2 }) }, { t: fr(t), ...back }] }; };
C.Thrust = thrust('nspec', 10, 14, 16, 38, 0.34, 0.04);
C.ThrustLong = thrust('nspecH', 20, 24, 26, 52, 0.62, 0.16);
/* Shield Bash (the door, no blade): the door comes up, a short step, the bash on 12 to 14 */
C.Bash = { fps: 60, keys: [{ t: 0, use: G },
  { t: fr(5), pose: { hips: M(0, -0.08, 0), spine: R(6), chest: R(6, -32), head: HEAD(0, 24), c_handL: HL(0.46, 1.06, 0.02, [0, -0.08, 0]), c_shield: AIM(0, 0.05, 1), c_handR: HR(-0.1, 0.9, -0.42, [0, -0.08, 0]), c_sword: AIM(-0.2, -0.5, -0.8) } },
  { t: fr(9), pose: { hips: M(0, -0.1, -0.02), c_handL: HL(0.42, 1.06, 0.02, [0, -0.1, -0.02]) } },
  { t: fr(12), in: 'snap', pose: { hips: M(0, -0.12, 0.3), chest: R(12, -40), c_footL: M(0.02, 0, 0.46), c_footR: M(0, 0, 0), c_handL: HL(0.9, 1.0, 0.02, [0, -0.12, 0.3]) } }, { t: fr(14), pose: { c_handL: HL(0.92, 1.0, 0.02, [0, -0.12, 0.3]) } }, { t: fr(38), ...back }] };
/* Ember Rise: a rising cut on 7 to 9, then up with the blade overhead */
C.RiseCut = { fps: 60, keys: [{ t: 0, use: G }, { t: fr(4), use: 'crouch', pose: { c_handR: HR(0.36, 0.55, -0.3, [0, -0.3, 0]), c_sword: AIM(0, -0.5, 1) } },
  { t: fr(7), in: 'snap', pose: cat({ hips: M(0, 0.04, 0), spine: R(-4), chest: R(-6, 8), head: HEAD(-14), c_footR: M(0, 0.1, 0.1), c_footL: M(0, -0.02, -0.08), c_handL: HL(0.2, 1.0, 0.3, [0, 0.04, 0]), c_shield: AIM(0.9, 0, 0.4) }, onCap('uspec', CAP.uspec, [0, 0.04, 0])) },
  { t: fr(9), pose: onCap('uspec', CAP.uspec, [0, 0.04, 0]) }, { t: fr(16), pose: { c_handR: HR(0.32, 1.7, -0.22, [0, 0.04, 0]), c_sword: AIM(0, 1, 0.2) } },
  { t: fr(25), pose: { c_handR: HR(0.25, 1.85, -0.22, [0, 0.04, 0]), c_sword: AIM(0, 1, 0.05), c_footR: M(0, 0.04, 0.04) } }] };
/* Grave Step: back out of a swing (the game moves her), in again, a low cut on 15 to 17 */
C.Step = { fps: 60, keys: [{ t: 0, use: G },
  { t: fr(6), pose: { hips: M(0, -0.04, -0.06), spine: R(-10), chest: R(-8, -16), c_footL: M(0.02, 0.04, -0.2), c_sword: AIM(-0.3, 0.3, 0.9), c_handR: HR(0.1, 1.0, -0.4, [0, -0.04, -0.06]) } },
  { t: fr(11), use: 'crouch', pose: crouchWind }, { t: fr(15), in: 'snap', pose: cat(lowBody, onCap('dspec', CAP.dspec, low)) },
  { t: fr(17), pose: cat({ chest: R(10, 18) }, onCap('dspec', CAP.dspec, low)) }, { t: fr(39), ...back }] };
/* every clip at 60 a second, so a key on an odd frame of the game lands on that frame (seconds are unchanged) */
for (const k in C) C[k].fps = 60;
if (process.argv[2] === 'test') {
  for (const k of Object.keys(C)) delete C[k];
  C.Test = { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 1, use: 'guard' }, { t: 2, use: 'crouch' }, { t: 3, reset: true, use: ['stand', 'air'] }] };
}
const out = path.join(__dirname, '..', '..', 'assets', 'brand', 'work'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(brand, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/brand-rigged.glb', texture: 1024, out: 'export/brand-v1.glb' }, null, 1) + '\n');
fs.writeFileSync(path.join(out, 'contacts.json'), JSON.stringify(CONTACTS) + '\n');
console.log('wrote rig.json: ' + brand.bones.length + ' bones, ' + Object.keys(brand.clips).length + ' clips');

/* ---- the game's manifest entry ---- */
const entry = { file: 'assets/brand/export/brand-v1.glb', height: 14.42,
  clips: { idle: { clip: 'Idle' }, walk: { clip: 'Walk' }, run: { clip: 'Run' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise', from: 0, to: 0.4 }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Bash', from: 0.28, to: 0.8 }, swap: { clip: 'Tumble', bounce: true } },
  /* the sword's arc and red point while a cut is out (render3d bladeArc): from a fifth of the way up the blade to the point */
  blade: { base: 'sword', tip: 'swordTip', at: 0.2, dot: 0.6, col: 0xffb45a, col2: 0xff5a1e },
  strikers: [{ bone: 'swordTip', ext: 0.4 }, { bone: 'shield', ext: 2.4 }, { bone: 'handL', ext: 1.2 }, { bone: 'handR', ext: 1.2 }, { bone: 'footR', ext: 1.8 }],
  springs: [],
  attacks: { jab: A('Jab', 0.17, 0.27, 0, 0.5), jab2: AF('Cut2', 5, 6, 19), jab3: AF('Cut3', 7, 9, 26), ftilt: AF('Ember', 7, 9, 24), utilt: AF('Brim', 7, 10, 25), dtilt: AF('Low', 6, 8, 23), dash: A('Drive', 0.3, 0.5),
    fsmash: AF('Cleave', 16, 19, 47), usmash: AF('Lift', 13, 17, 46), dsmash: AF('Sweep', 12, 18, 42),
    nair: AF('Wheel', 6, 15, 36), fair: AF('Ward', 7, 10, 30), bair: AF('About', 8, 10, 34), uair: AF('Arc', 6, 9, 27), dair: AF('Drop', 13, 16, 41),
    grab: A('Reach', 0.34, 0.46, 0, 0.8), dgrab: A('Reach', 0.34, 0.46, 0, 0.8), pgrab: A('Reach', 0.34, 0.46, 0, 0.8),
    getup: AF('FloorSweep', 19, 25, 47), getupB: AF('FloorSweep', 19, 25, 47, { flip: true }), ledgeatk: AF('LipCut', 20, 22, 46),
    nspec: AF('Thrust', 14, 16, 38), nspecH: AF('ThrustLong', 24, 26, 52), sspec: AF('Bash', 12, 14, 38), uspec: AF('RiseCut', 7, 9, 25), dspec: AF('Step', 15, 17, 39), '*': AF('Cut2', 5, 6, 19) } };
if (process.argv[2] !== 'test') { const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
  current.Brand = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', ')); }
