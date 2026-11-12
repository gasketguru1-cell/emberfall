// Writes the skeleton spec for Knell, The Angle Thief (the owner's Meshy model), which tools/blender/rig.py turns into a rigged
// model. 75 bones move the mesh, plus 7 controls that are not exported. The core keeps Brand's names (hips, spine, chest,
// head, arm/fore/hand, thigh/shin/foot, sword, swordTip, shield), so the runtime, the blade arc and retargeted animation find
// what they look for; everything else adds joints the mesh really has.
//   node tools/blender/knell/knell.js <out dir>          writes <out dir>/rig.json
// The mesh is first readied by prep.py (pieces split and named Body, Sword and Shield, the dagger in the right hand, the buckler
// on the left forearm, standing on the floor at the origin facing +Z). It rests in a T-pose.
// Directions: x is his left, y is up, z is forward, metres. Joints were measured from cross-sections and X-ray renders of the mesh.
//
// What each group is for:
//   spine     hips, spine, spine2, spine3, chest, neck, head: his spine is bare vertebrae between the pelvis and the ribcage,
//             so it bends in three places (a ripple through a cut, a hunch in the crouch), and the helm turns on its own neck.
//   helm      crest, crestTip (the swept fin over the front) and crestBack (its tail): keyed with a short lag for follow-through.
//             eyeL, eyeR: the two lamp eyes, scaled to flare (a Thread lit, a Clink).
//   arms      clav (shrugs, reach), pauldron (the shoulder plate rides the collarbone and lifts a third of the arm's raise,
//             so it does not stretch), arm, fore, hand; armTwist undoes half the upper arm's roll by the shoulder and
//             foreTwist carries half the wrist's roll down the forearm, so turning the dagger over does not wring the
//             gauntlet; elbow keeps half the elbow's bend so the joint keeps its volume.
//   fingers   thumb, index, middle, ring, pinky, three joints each, both hands: a real grip on the dagger's handle and the
//             buckler's strap instead of a mitten (the gauntlet's fingers are separate in the mesh).
//   legs      thigh (thighTwist undoes half its roll at the hip), shin, knee (half the knee's bend, keeps the knob of bone round),
//             bootCuff (the boot's top takes a third of the ankle's turn), foot, toe (the boot bends at the ball: heel-toe steps,
//             a push off in the dash).
//   props     sword (the dagger; rigid), swordTip (its point: the blade arc and the hit checks read it), shield (the buckler; rigid).
// The one control is all (the root). Every clip is solved in anim.js (arms reaching the dagger's grip and the buckler's
// place, legs reaching the feet), so the keys are plain turns and no IK or aim control is needed.
const fs = require('fs'), path = require('path');
const add = (a, b, k) => a.map((v, i) => v + b[i] * (k === undefined ? 1 : k));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const unit = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const mir = p => [-p[0], p[1], p[2]];   /* his right is -x: the measurements below are for the right side */
const out = require.main === module ? process.argv[2] : null; if (require.main === module && !out) { console.error('usage: node knell.js <out dir>'); process.exit(1); }

/* the dagger: the grip under the right palm, the point forward and a little down (prep.py puts it there); the buckler: centre and facing */
const GRIP = [-0.772, 0.785, 0.10], TIP = [-0.772, 0.851, 0.753], SD = [0, -0.208, 0.978];
const SC = [0.578, 1.188, 0.07], SN = [0, 1, 0];
/* the lamp eyes: the middle of each yellow lens, a little behind its face (found by the lenses' colour) */
const EYE_R = [-0.08, 1.30, 0.12], EYE_L = [0.10, 1.30, 0.12];

/* right-side joints (mirrored for the left) */
const R = {
  clav: [-0.04, 1.13, -0.01], shoulder: [-0.24, 1.07, -0.03], elbow: [-0.47, 0.975, -0.02], wrist: [-0.672, 0.89, 0.06], handTip: [-0.745, 0.86, 0.13],
  pauldron: [-0.19, 1.15, -0.02],
  hip: [-0.102, 0.65, -0.03], knee: [-0.19, 0.47, -0.035], ankle: [-0.252, 0.14, -0.06], ball: [-0.255, 0.05, 0.10], toe: [-0.255, 0.04, 0.22],
  cuff: [-0.215, 0.41, -0.04],
  /* the fingers: knuckle, two middle joints and the tip, fitted to each finger's own vertices (both hands agree within a few mm) */
  fingers: {
    index: [[-0.745, 0.852, 0.226], [-0.791, 0.81, 0.236], [-0.828, 0.776, 0.235], [-0.866, 0.756, 0.203]],
    middle: [[-0.74, 0.892, 0.164], [-0.793, 0.841, 0.184], [-0.832, 0.811, 0.204], [-0.886, 0.78, 0.205]],
    ring: [[-0.744, 0.854, 0.081], [-0.802, 0.83, 0.117], [-0.833, 0.82, 0.143], [-0.869, 0.761, 0.168]],
    pinky: [[-0.748, 0.83, 0.022], [-0.798, 0.835, 0.061], [-0.834, 0.794, 0.09], [-0.889, 0.773, 0.14]],
    thumb: [[-0.631, 0.856, 0.153], [-0.649, 0.789, 0.194], [-0.646, 0.773, 0.223], [-0.679, 0.731, 0.244]],
  },
};
const side = (s, p) => s === 'R' ? p : mir(p);

const bones = [
  { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
  /* the spine: pelvis, three vertebral segments, the ribcage, the neck, the helm */
  { name: 'hips', head: [0, 0.68, -0.04], tail: [0, 0.80, -0.04], parent: 'all' },
  { name: 'spine', head: [0, 0.80, -0.04], tail: [0, 0.84, -0.04], parent: 'hips', connect: true },
  { name: 'spine2', head: [0, 0.84, -0.04], tail: [0, 0.88, -0.035], parent: 'spine', connect: true },
  { name: 'spine3', head: [0, 0.88, -0.035], tail: [0, 0.92, -0.03], parent: 'spine2', connect: true },
  { name: 'chest', head: [0, 0.92, -0.03], tail: [0, 1.17, -0.03], parent: 'spine3', connect: true },
  { name: 'neck', head: [0, 1.17, -0.03], tail: [0, 1.26, -0.02], parent: 'chest', connect: true },
  { name: 'head', head: [0, 1.26, -0.02], tail: [0, 1.58, -0.02], parent: 'neck', connect: true },
  /* the helm's fin and its lamp eyes */
  { name: 'crest', head: [0, 1.58, -0.05], tail: [0.03, 1.75, 0.04], parent: 'head' },
  { name: 'crestTip', head: [0.03, 1.75, 0.04], tail: [0.12, 1.79, 0.30], parent: 'crest', connect: true },
  { name: 'crestBack', head: [-0.02, 1.62, -0.10], tail: [-0.16, 1.48, -0.30], parent: 'head' },
  { name: 'eyeR', head: EYE_R, tail: add(EYE_R, [0, 0, 0.1]), parent: 'head' },
  { name: 'eyeL', head: EYE_L, tail: add(EYE_L, [0, 0, 0.1]), parent: 'head' },
];
const copyrot = [], track = [], fingerRigid = [];
for (const s of ['R', 'L']) {
  const J = k => side(s, R[k]);
  const sh = J('shoulder'), el = J('elbow'), wr = J('wrist');
  const armDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), shinDir = unit(sub(J('ankle'), J('knee'))), footDir = unit(sub(J('ball'), J('ankle')));
  bones.push(
    { name: 'clav' + s, head: J('clav'), tail: sh, parent: 'chest' },
    { name: 'pauldron' + s, head: J('pauldron'), tail: add(J('pauldron'), armDir, 0.1), parent: 'clav' + s },
    { name: 'arm' + s, head: sh, tail: el, parent: 'clav' + s, connect: true },
    { name: 'armTwist' + s, head: sh, tail: lerp(sh, el, 0.5), parent: 'arm' + s },
    { name: 'elbow' + s, head: el, tail: add(el, foreDir, 0.04), parent: 'arm' + s },
    { name: 'fore' + s, head: el, tail: wr, parent: 'arm' + s, connect: true },
    { name: 'foreTwist' + s, head: lerp(el, wr, 0.5), tail: wr, parent: 'fore' + s },
    { name: 'hand' + s, head: wr, tail: J('handTip'), parent: 'fore' + s, connect: true });
  for (const [f, P] of Object.entries(R.fingers)) {
    const p = P.map(q => side(s, q));
    for (let k = 0; k < 3; k++) {
      bones.push({ name: f + (k + 1) + s, head: p[k], tail: p[k + 1], parent: k ? f + k + s : 'hand' + s, connect: k > 0 });
    }
  }
  /* each joint of the gauntlet is its own armour plate: the hand's vertices follow the nearest finger joint, or the palm, alone */
  fingerRigid.push({ nearest: ['hand' + s, ...Object.keys(R.fingers).flatMap(f => [1, 2, 3].map(k => f + k + s))], keep: ['foreTwist' + s, 'fore' + s], r: 0.045 });
  const hip = J('hip'), knee = J('knee'), ank = J('ankle');
  bones.push(
    { name: 'thigh' + s, head: hip, tail: knee, parent: 'hips' },
    { name: 'thighTwist' + s, head: hip, tail: lerp(hip, knee, 0.5), parent: 'thigh' + s },
    { name: 'knee' + s, head: knee, tail: add(knee, shinDir, 0.04), parent: 'thigh' + s },
    { name: 'shin' + s, head: knee, tail: ank, parent: 'thigh' + s, connect: true },
    { name: 'bootCuff' + s, head: J('cuff'), tail: add(J('cuff'), footDir, 0.06), parent: 'shin' + s },
    { name: 'foot' + s, head: ank, tail: J('ball'), parent: 'shin' + s },
    { name: 'toe' + s, head: J('ball'), tail: J('toe'), parent: 'foot' + s, connect: true });
  /* the helpers move themselves: each copies part of a neighbour's turn in its own axes (rest-aligned with it) */
  copyrot.push(
    { bone: 'armTwist' + s, from: 'arm' + s, space: 'LOCAL', axes: 'Y', invert: 'Y', influence: 0.5 },
    { bone: 'foreTwist' + s, from: 'hand' + s, space: 'LOCAL', axes: 'Y', influence: 0.5 },
    { bone: 'elbow' + s, from: 'fore' + s, space: 'LOCAL', influence: 0.5 },
    { bone: 'pauldron' + s, from: 'arm' + s, space: 'LOCAL', axes: 'XZ', influence: 0.33 },
    { bone: 'thighTwist' + s, from: 'thigh' + s, space: 'LOCAL', axes: 'Y', invert: 'Y', influence: 0.5 },
    { bone: 'knee' + s, from: 'shin' + s, space: 'LOCAL', influence: 0.5 },
    { bone: 'bootCuff' + s, from: 'foot' + s, space: 'LOCAL', influence: 0.33 });
}
bones.push(
  { name: 'sword', head: GRIP, tail: TIP, parent: 'handR' },
  { name: 'swordTip', head: TIP, tail: add(TIP, SD, 0.08), parent: 'sword', connect: true },   /* marks the point of the blade */
  { name: 'shield', head: SC, tail: add(SC, SN, 0.25), parent: 'foreL' });   /* strapped to the forearm: it turns with it, the hand free to grip */

/* finger curls: each joint turns about the forward axis (the hand's hinge in the T-pose); the thumb folds across the palm */
const curl = (s, a, thumb) => {
  const o = {}, sg = s === 'R' ? 1 : -1;
  for (const f of ['index', 'middle', 'ring', 'pinky']) for (let k = 1; k <= 3; k++) o[f + k + s] = { rot: [0, 0, sg * a * [0.9, 1.1, 0.8][k - 1]] };
  for (let k = 1; k <= 3; k++) o['thumb' + k + s] = { rot: [-a * 0.4 * (thumb === undefined ? 1 : thumb), sg * a * 0.3, 0] };
  return o;
};
const spec = {
  note: 'Knell, The Angle Thief: metres after prep.py (feet on y = 0, facing +Z, his right is -X), T-pose rest. 75 deforming bones and the root.',
  bones,
  copyrot, track,
  parts: [{ object: 'Sword', bone: 'sword' }, { object: 'Shield', bone: 'shield' }],
  /* rigid: the helmet shell, the dagger and the buckler (their own pieces, pulling on nothing else) */
  rigid: [{ bone: 'head', box: [[-0.36, 1.24, -0.30], [0.36, 1.62, 0.30]] }, ...fingerRigid,
    /* the lamp eyes: only the bright lenses inside a slab round each one, not the dark mask round them */
    { bone: 'eyeR', disc: EYE_R, n: [0, 0, 1], r: 0.07, t: [0, 0.12], skipDark: 0.5 }, { bone: 'eyeL', disc: EYE_L, n: [0, 0, 1], r: 0.07, t: [0, 0.12], skipDark: 0.5 },
    { bone: 'sword', part: 'Sword', only: true }, { bone: 'shield', part: 'Shield', only: true }],
  /* the stand pose names every bone, so a clip's first key holds them all at rest (a bone first keyed later would otherwise hold that key from the start) */
  poses: { stand: Object.fromEntries(bones.map(b => [b.name, {}])) },
  /* for checking the weights (anim.js replaces this with the real clips): arms down, fists, wrists turned over, a knee bent;
     then the spine curled, the head turned and the crest whipped back, the eyes flared */
  clips: {
    Check: { fps: 30, keys: [{ t: 0, use: 'stand' },
      { t: 1, pose: { armR: { rot: [0, 0, 55] }, armL: { rot: [0, 0, -55] }, foreR: { rot: [0, -40, 0] }, foreL: { rot: [0, 40, 0] }, thighL: { rot: [-40, 0, 0] }, shinL: { rot: [50, 0, 0] }, toeL: { rot: [-35, 0, 0] },
        handR: { spin: 80 }, handL: { spin: -80 }, ...curl('R', 70), ...curl('L', 70) } },
      { t: 2, pose: { spine: { rot: [12, 0, 0] }, spine2: { rot: [10, 8, 0] }, spine3: { rot: [8, 8, 0] }, neck: { rot: [-10, 20, 0] }, head: { rot: [0, 15, 8] },
        crest: { rot: [-15, 0, 0] }, crestTip: { rot: [-20, 0, 0] }, crestBack: { rot: [20, 0, 0] }, eyeL: { scale: [1.25, 1.25, 1.25] }, eyeR: { scale: [1.25, 1.25, 1.25] },
        clavR: { rot: [0, 0, -15] }, clavL: { rot: [0, 0, 15] } } }] },
  },
};
const deform = bones.filter(b => b.deform !== false).length;
if (deform < 75) { console.error('knell: only ' + deform + ' deforming bones'); process.exit(1); }
module.exports = { spec, bones, R, GRIP, TIP, SD, SC, SN, EYE_L, EYE_R, curl };
if (!out) return;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(spec, null, 1));
console.log('knell: ' + bones.length + ' bones (' + deform + ' deforming, ' + (bones.length - deform) + ' controls) -> ' + path.join(out, 'rig.json'));
