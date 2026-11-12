// Flint: 30 bones on top of his 36 (the Meshy rig plus five coat strips and a scarf).
//   coat (10): his long coat's skirt was mostly stuck to his thighs (the coat strips only held a band at the hem); now each
//              strip has an upper and a lower panel on springs, so the coat swings and trails while still half-following
//              the legs (the front panels follow them more, so a kick doesn't go through)
//   hands (8): index, middle, ring-and-little and thumb on each hand; his right hand grips the lantern in every clip,
//              his left balls into a fist for a strike, both splay when hit, the left drums while idle
//   face (3):  jaw (a grunt on a strike, open when hit) and two brows that knit under the hat
//   hat (1):   rocks on a spring and bumps up when he's hit
//   collar (3), lapels (2), cuffs (2): the stand collar, the coat's lapels and the deep sleeve cuffs flap on springs
//   scarf (1): the frayed tassel ends of the scarf get a third link
import { sphere, capsule, half, box, all, pulse, blinks, wobble, clamp, smooth } from './_lib.mjs';
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const teal = (p, G) => (G.hsv[0] > 150 && G.hsv[0] < 240 && G.hsv[1] > 0.2 && G.hsv[2] > 0.18 ? 1 : 0);
const deg = (p) => Math.atan2(p.x, p.z) * 180 / Math.PI;   // 0 in front, +90 his left, +-180 behind
/* a sector of the coat around him, soft at its edges */
const sector = (a0, a1, soft = 12) => p => { let a = deg(p); if (a1 > 180 && a < 0) a += 360; return smooth((a - a0) / soft + 0.5) * smooth((a1 - a) / soft + 0.5); };

/* ---- the coat: five strips, each an upper panel (under the strip's hip bone) and a lower one (under its knee bone) ---- */
const STRIPS = [
  // name, sector, hip head, knee head, how much the panel lets go of the legs (the rest still follows them)
  ['FL', sector(-2, 62), [0.08, 0.84, 0.15], [0.11, 0.62, 0.2], 0.55],
  ['L', sector(62, 130), [0.19, 0.84, 0.02], [0.27, 0.62, 0.02], 0.7],
  ['B', sector(130, 230), [0, 0.84, -0.12], [0, 0.62, -0.18], 0.8],
  ['R', sector(-130, -62), [-0.19, 0.84, 0.02], [-0.27, 0.62, 0.02], 0.7],
  ['FR', sector(-62, 2), [-0.08, 0.84, 0.15], [-0.11, 0.62, 0.2], 0.55],
];
const LEGS = ['Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'Spine02'];
const upper = p => smooth((p.y - 0.6) / 0.08 + 0.5), lower = p => 1 - upper(p);
const skirt = (p, G) => teal(p, G) * smooth((0.86 - p.y) / 0.04 + 0.5);

/* ---- hands: fingers hang down, palms to his sides, index in front (+z), thumb in front and inside ---- */
const FING = [['Idx', 0.15, 0.125, 9], ['Mid', 0.095, 0.065, 0.125], ['Low', 0.03, -9, 0.065]];
const finger = (s, z0, z1) => (p) => smooth((0.75 - p.y) / 0.025 + 0.5) * smooth((p.x * s - 0.58) / 0.02 + 0.5) * smooth((p.z - z0) / 0.02 + 0.5) * smooth((z1 - p.z) / 0.02 + 0.5);

const bones = [], weights = [], springs = [];
const B = (name, parent, head, tail, why) => bones.push({ name, parent, head, tail, why });
for (const [k, sec, hip, knee, s] of STRIPS) {
  const dir = [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]], hem = [knee[0] + dir[0] * 1.05, 0.39, knee[2] + dir[2] * 1.05];
  B('coat' + k + 'a', 'coat' + k + '1', hip, [hip[0] + dir[0] * 0.9, hip[1] + dir[1] * 0.9, hip[2] + dir[2] * 0.9], 'the coat\'s ' + k + ' panel above the knee: swings and lags');
  B('coat' + k + 'b', 'coat' + k + '2', knee, hem, 'the coat\'s ' + k + ' panel below the knee, down to the hem: flaps and trails');
  weights.push({ bone: 'coat' + k + 'a', from: LEGS.concat(['coat' + k + '1']), loose: LEGS, s, f: (p, G) => skirt(p, G) * sec(p) * upper(p) });
  weights.push({ bone: 'coat' + k + 'b', from: LEGS.concat(['coat' + k + '2']), loose: LEGS, s, f: (p, G) => skirt(p, G) * sec(p) * lower(p) });
  springs.push({ bones: ['coat' + k + 'a'], k: 0.26, d: 0.72, max: 0.25, drag: 0.08 }, { bones: ['coat' + k + 'b'], k: 0.24, d: 0.7, max: 0.35, drag: 0.1 });
}
for (const [k, s, hand] of [['L', 1, 'LeftHand'], ['R', -1, 'RightHand']]) {
  for (const [f, z, z0, z1] of FING) {
    B('fing' + f + k, hand, [0.625 * s, 0.745, z], [0.645 * s, 0.645, z], { Idx: 'index finger', Mid: 'middle finger', Low: 'ring and little fingers' }[f] + ': curls into a fist or round the lantern, splays when hit');
    weights.push({ bone: 'fing' + f + k, from: [hand], f: finger(s, z0, z1) });
  }
  B('thumb' + k, hand, [0.515 * s, 0.815, 0.15], [0.545 * s, 0.75, 0.2], 'the thumb: folds over the fist, closes on the lantern');
  weights.push({ bone: 'thumb' + k, from: [hand], f: all(capsule([0.515 * s, 0.815, 0.15], [0.545 * s, 0.745, 0.2], 0.022, 0.04), p => smooth((0.59 - p.x * s) / 0.02 + 0.5), half([0, 0, 0.12], Z, 0.03)) });
  B('cuff' + k, k === 'L' ? 'LeftForeArm' : 'RightForeArm', [0.43 * s, 0.95, 0], [0.55 * s, 0.82, 0], 'the deep sleeve cuff: jiggles on a punch and a landing');
  weights.push({ bone: 'cuff' + k, from: [k === 'L' ? 'LeftForeArm' : 'RightForeArm', hand], loose: [hand], f: (p, G) => teal(p, G) * smooth((0.96 - p.y) / 0.03 + 0.5) * smooth((p.x * s - 0.4) / 0.03 + 0.5) });
  springs.push({ bones: ['cuff' + k], k: 0.3, d: 0.7, max: 0.12, drag: 0.05 });
  /* the collar and lapels hang from the top of the spine, not the head, so they flap instead of turning with his head */
  B('collar' + k, 'Spine', [0.12 * s, 1.3, -0.03], [0.15 * s, 1.45, -0.05], 'the stand collar\'s side: flaps on a spring');
  weights.push({ bone: 'collar' + k, from: ['Head', 'headfront', 'neck', k === 'L' ? 'LeftShoulder' : 'RightShoulder', k === 'L' ? 'LeftArm' : 'RightArm', 'Spine01'], loose: ['Head', 'headfront', 'neck', k === 'L' ? 'LeftShoulder' : 'RightShoulder', k === 'L' ? 'LeftArm' : 'RightArm', 'Spine01'], s: 0.75,
    f: (p, G) => teal(p, G) * smooth((p.y - 1.28) / 0.03 + 0.5) * smooth((1.47 - p.y) / 0.02 + 0.5) * smooth((p.x * s - 0.07) / 0.03 + 0.5) * smooth((0.3 - p.x * s) / 0.03 + 0.5) });
  B('lapel' + k, 'Spine01', [0.06 * s, 1.27, 0.16], [0.13 * s, 1.05, 0.2], 'the lapel: flaps open when he lunges and when he\'s hit');
  weights.push({ bone: 'lapel' + k, from: ['Spine02', 'Spine01', k === 'L' ? 'LeftShoulder' : 'RightShoulder', 'headfront'], loose: ['Spine02', k === 'L' ? 'LeftShoulder' : 'RightShoulder', 'headfront'], s: 0.8,
    f: (p, G) => teal(p, G) * all(box([0.0, 1.0, 0.12], [0.22, 1.29, 0.4], 0.03))({ x: p.x * s, y: p.y, z: p.z }) });
  springs.push({ bones: ['collar' + k], k: 0.3, d: 0.72, max: 0.15, drag: 0.05 }, { bones: ['lapel' + k], k: 0.28, d: 0.7, max: 0.2, drag: 0.06 });
}
B('collarB', 'Spine', [0, 1.3, -0.12], [0, 1.47, -0.16], 'the back of the stand collar: flaps on a spring');
weights.push({ bone: 'collarB', from: ['Head', 'neck', 'LeftShoulder', 'RightShoulder', 'Spine01'], loose: ['Head', 'neck', 'LeftShoulder', 'RightShoulder', 'Spine01'], s: 0.75,
  f: (p, G) => teal(p, G) * smooth((p.y - 1.28) / 0.03 + 0.5) * smooth((1.47 - p.y) / 0.02 + 0.5) * smooth((0.1 - Math.abs(p.x)) / 0.04 + 0.5) * smooth((-0.02 - p.z) / 0.03 + 0.5) });
springs.push({ bones: ['collarB'], k: 0.3, d: 0.72, max: 0.15, drag: 0.05 });

/* ---- head ---- */
B('hat', 'Head', [0, 1.53, -0.02], [0, 1.7, 0], 'the hat: rocks on a spring, jumps when he\'s hit');
weights.splice(0, 0, { bone: 'hat', from: ['Head', 'headfront'], loose: ['headfront'], f: p => Math.max(smooth((p.y - 1.527) / 0.012 + 0.5), smooth((p.y - 1.475) / 0.01 + 0.5) * smooth((Math.hypot(p.x, p.z + 0.02) - 0.178) / 0.01 + 0.5)) });
springs.push({ bones: ['hat'], k: 0.32, d: 0.66, max: 0.12, drag: 0.04 });
B('jaw', 'headfront', [0, 1.42, 0.03], [0, 1.37, 0.13], 'the jaw: a grunt on every strike, drops open when he\'s hit');
weights.push({ bone: 'jaw', from: ['headfront', 'Head'], loose: ['Head'], f: all(capsule([0, 1.405, 0.06], [0, 1.375, 0.12], 0.035, 0.06), half([0, 1.408, 0], [0, -1, 0], 0.012), half([0, 0, 0.03], Z, 0.03)) });
for (const [k, s] of [['L', 1], ['R', -1]]) {
  B('brow' + k, 'headfront', [0.025 * s, 1.48, 0.135], [0.08 * s, 1.485, 0.115], 'the brow: knits on a strike, lifts when hit');
  weights.push({ bone: 'brow' + k, from: ['headfront', 'Head'], loose: ['Head'], f: all(sphere([0.052 * s, 1.482, 0.13], 0.02, 0.038), half([0, 0, 0.08], Z, 0.02)) });
}
/* ---- scarf: the tassels at its end ---- */
B('scarf3', 'scarf2', [0.01, 0.99, 0.25], [0.01, 0.9, 0.26], 'the scarf\'s frayed tassels: whip after the rest of it');
weights.push({ bone: 'scarf3', from: ['scarf2'], f: p => smooth((0.995 - p.y) / 0.03 + 0.5) });
springs.push({ bones: ['scarf3'], k: 0.22, d: 0.74, max: 0.6, drag: 0.12 });

/* ---- keys ---- */
const CURL = d => ({ L: [[Z, -d]], R: [[Z, d]] });
const SPLAY = { Idx: -12, Mid: 0, Low: 12 };
const LANTERN = { Idx: 62, Mid: 68, Low: 74, thumb: 30 };   // his right hand round the lantern's handle
function keys(c) {
  const k = {}, d = c.dur, hold = (n, v) => (k[n] = [[0, v], [d, v]]);
  const grip = (tight = 0) => { for (const [f] of FING) hold('fing' + f + 'R', CURL(LANTERN[f] + tight).R); hold('thumbR', [[Z, LANTERN.thumb + tight], [X, -10]]); };
  grip();
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    for (const [f] of FING) { k['fing' + f + 'L'] = pulse(s, Math.max(s + 0.02, c0 - 0.06), c1, e, CURL(85 + (f === 'Low' ? 8 : 0)).L); k['fing' + f + 'R'] = pulse(s, Math.max(s + 0.02, c0 - 0.06), c1, e, CURL(LANTERN[f] + 12).R, CURL(LANTERN[f]).R); }
    k.thumbL = pulse(s, Math.max(s + 0.02, c0 - 0.06), c1, e, [[Z, -40], [X, -20]]);
    k.jaw = pulse(s, c0, c1, e, [[X, 9]]);
    for (const [sd, sg] of [['L', 1], ['R', -1]]) k['brow' + sd] = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, Math.min(d, e + 0.1), [[Z, 14 * sg]]);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    for (const [f] of FING) k['fing' + f + 'L'] = pulse(0, 0.05, t, d, [[Z, 14], [X, SPLAY[f]]]);
    k.thumbL = pulse(0, 0.05, t, d, [[Z, 12]]);
    k.jaw = [[0, []], [0.05, [[X, 16]]], [t, [[X, 8]]], [d, []]];
    for (const [sd, sg] of [['L', 1], ['R', -1]]) k['brow' + sd] = pulse(0, 0.05, t, Math.min(d, t + 0.15), [[Z, -10 * sg]]);
    k.hat = [[0, []], [0.06, [[X, -10]]], [Math.min(d, 0.2), [[X, 3]]], [Math.min(d, 0.32), []], [d, []]];
  } else {
    /* at rest the left hand hangs a little curled; while idle its fingers drum */
    for (const [f] of FING) hold('fing' + f + 'L', CURL(14).L);
    hold('thumbL', [[Z, -8]]);
    if (c.kind === 'idle' && d > 1) ['Low', 'Mid', 'Idx'].forEach((f, i) => { const t0 = d * 0.5 + i * 0.08; k['fing' + f + 'L'] = [[0, CURL(14).L], [t0, CURL(14).L], [t0 + 0.05, CURL(34).L], [t0 + 0.12, CURL(14).L], [d, CURL(14).L]]; });
    if (/Grab|Grip|Throw|Pummel|Bar_Hang/i.test(c.name)) { for (const [f] of FING) hold('fing' + f + 'L', CURL(80).L); hold('thumbL', [[Z, -35]]); }
    if (/Roll|Dodge|Jump|Fall/i.test(c.name)) for (const [sd, sg] of [['L', 1], ['R', -1]]) k['brow' + sd] = [[0, [[Z, 6 * sg]]], [d, [[Z, 6 * sg]]]];
  }
  return k;
}

export default { in: 'assets/flint/export/flint-v4.glb', out: 'assets/flint/export/flint-b.glb', manifest: ['Flint'], bones, weights, springs, keys };
