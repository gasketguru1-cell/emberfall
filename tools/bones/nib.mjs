// Nib (Wren's fox): 30 bones on top of the 30 he was built with. The head is sculpted turned about 30 degrees to his
// right, so the face is laid out along its own forward (F) and left (L) lines, measured off the painted eyes and nose.
import { sphere, ellipsoid, capsule, half, all, pulse, blinks, wobble, V } from './_lib.mjs';
const F = [-0.471, 0, 0.882], L = [0.882, 0, 0.471], U = [0, 1, 0];
const at = (p, f = 0, l = 0, u = 0) => [0, 1, 2].map(i => p[i] + F[i] * f + L[i] * l + U[i] * u);
const EYE = { L: [0.016, 0.918, 0.615], R: [-0.162, 0.918, 0.531] }, MID = [-0.073, 0.918, 0.573], NOSE = [-0.157, 0.834, 0.712];
const HINGE = at(MID, -0.06, 0, -0.1), CHIN = at(NOSE, -0.03, 0, -0.06);
const HEAD = ['head', 'neck'], FUR = { k: 0.25, d: 0.74, max: 0.4, drag: 0.08 };
const white = (p, G) => (G.hsv[1] < 0.3 && G.hsv[2] > 0.5 ? 1 : 0.35);

const bones = [
  // face, keyed
  { name: 'jaw', parent: 'head', head: HINGE, tail: CHIN, why: 'opens for the bite, the spit and a yelp when hit' },
  { name: 'eyeL', parent: 'head', head: EYE.L, tail: at(EYE.L, 0.05), why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'head', head: EYE.R, tail: at(EYE.R, 0.05), why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'browL', parent: 'head', head: at(EYE.L, -0.01, 0.045, 0.055), tail: at(EYE.L, 0.005, -0.04, 0.05), why: 'fur over the eye: angry on a strike, up when hit' },
  { name: 'browR', parent: 'head', head: at(EYE.R, -0.01, -0.045, 0.055), tail: at(EYE.R, 0.005, 0.04, 0.05), why: 'fur over the eye: angry on a strike, up when hit' },
  { name: 'nose', parent: 'head', head: at(MID, 0.08, 0, -0.03), tail: NOSE, why: 'sniffs while he idles, wrinkles on a strike' },
  // face fur on springs
  { name: 'cheekL', parent: 'head', head: at(MID, -0.03, 0.12, -0.07), tail: at(MID, -0.07, 0.18, -0.13), why: 'cheek ruff, swings' },
  { name: 'cheekR', parent: 'head', head: at(MID, -0.03, -0.12, -0.07), tail: at(MID, -0.07, -0.18, -0.13), why: 'cheek ruff, swings' },
  { name: 'chin', parent: 'jaw', head: at(CHIN, -0.02, 0, -0.01), tail: at(CHIN, -0.04, 0, -0.06), why: 'chin tuft, swings' },
  // ears and tails: one more link each at the tips
  { name: 'earL3', parent: 'earL2', head: [0.53, 1.29, 0.52], tail: [0.66, 1.28, 0.55], why: 'the floppy tip of the left ear' },
  { name: 'earR3', parent: 'earR2', head: [-0.272, 1.394, 0.146], tail: [-0.32, 1.47, 0.11], why: 'the tip of the right ear' },
  { name: 'earInL', parent: 'earL1', head: [0.2, 1.12, 0.5], tail: [0.28, 1.2, 0.56], why: 'the white fluff inside the left ear' },
  { name: 'earInR', parent: 'earR1', head: [-0.13, 1.12, 0.36], tail: [-0.17, 1.22, 0.33], why: 'the white fluff inside the right ear' },
  { name: 'tailL5', parent: 'tailL4', head: [0.21, 1.25, -0.8], tail: [0.25, 1.27, -0.5], why: 'the gold tip of the left tail' },
  { name: 'tailR5', parent: 'tailR4', head: [-0.27, 1.28, -1.07], tail: [-0.2, 1.48, -0.8], why: 'the gold tip of the right tail' },
  { name: 'tailLf', parent: 'tailL1', head: [0.1, 0.78, -0.72], tail: [0.1, 0.62, -0.78], why: 'the fluff hanging under the left tail' },
  { name: 'tailRf', parent: 'tailR2', head: [-0.24, 0.62, -0.88], tail: [-0.24, 0.5, -0.92], why: 'the fluff hanging under the right tail' },
  // body fur
  { name: 'ruff1', parent: 'chest', head: [0, 0.72, 0.5], tail: [0, 0.56, 0.47], why: 'the white chest ruff, top' },
  { name: 'ruff2', parent: 'ruff1', head: [0, 0.56, 0.47], tail: [0, 0.42, 0.4], why: 'the white chest ruff, bottom' },
  { name: 'scruff1', parent: 'neck', head: [0.03, 0.86, 0.33], tail: [0.03, 0.8, 0.25], why: 'the scruff behind the head' },
  { name: 'scruff2', parent: 'chest', head: [0.03, 0.8, 0.25], tail: [0.03, 0.76, 0.15], why: 'the scruff over the shoulders' },
  { name: 'hackle1', parent: 'spine', head: [0.04, 0.66, 0.04], tail: [0.04, 0.78, 0.0], why: 'back fur over the shoulders: bristles on a strike' },
  { name: 'hackle2', parent: 'hips', head: [0.04, 0.66, -0.22], tail: [0.04, 0.78, -0.26], why: 'back fur behind the key: bristles on a strike' },
  { name: 'hackle3', parent: 'hips', head: [0.03, 0.64, -0.34], tail: [0.03, 0.76, -0.38], why: 'rump fur: bristles on a strike' },
  { name: 'belly1', parent: 'chest', head: [0.04, 0.5, 0.22], tail: [0.04, 0.38, 0.2], why: 'belly fur under the chest, swings' },
  { name: 'belly2', parent: 'spine', head: [0.05, 0.54, 0.0], tail: [0.05, 0.42, -0.02], why: 'belly fur under the waist, swings' },
  { name: 'haunchL', parent: 'rl_upper', head: [0.16, 0.58, -0.33], tail: [0.16, 0.44, -0.36], why: 'fur at the back of the left thigh' },
  { name: 'haunchR', parent: 'rr_upper', head: [-0.09, 0.58, -0.36], tail: [-0.09, 0.44, -0.4], why: 'fur at the back of the right thigh' },
  { name: 'elbowL', parent: 'fl_upper', head: [0.17, 0.5, 0.13], tail: [0.17, 0.4, 0.1], why: 'feathering behind the left foreleg' },
  { name: 'elbowR', parent: 'fr_upper', head: [-0.12, 0.5, 0.15], tail: [-0.12, 0.4, 0.12], why: 'feathering behind the right foreleg' },
];

const below = half(at(MID, 0, 0, -0.1), [0, -1, 0], 0.025);   // under the line of the mouth
const weights = [
  { bone: 'jaw', from: HEAD, f: all(capsule(HINGE, CHIN, 0.035, 0.075), below) },
  { bone: 'chin', from: ['jaw', 'head'], f: sphere(at(CHIN, -0.02, 0, -0.03), 0.025, 0.05) },
  { bone: 'nose', from: HEAD, f: all(capsule(at(MID, 0.08, 0, -0.03), NOSE, 0.03, 0.06), half(at(MID, 0, 0, -0.1), [0, 1, 0], 0.025)) },
  { bone: 'eyeL', from: HEAD, f: sphere(EYE.L, 0.045, 0.075) },
  { bone: 'eyeR', from: HEAD, f: sphere(EYE.R, 0.045, 0.075) },
  { bone: 'browL', from: HEAD.concat(['eyeL']), f: sphere(at(EYE.L, 0, 0, 0.065), 0.025, 0.05) },
  { bone: 'browR', from: HEAD.concat(['eyeR']), f: sphere(at(EYE.R, 0, 0, 0.065), 0.025, 0.05) },
  { bone: 'cheekL', from: HEAD, f: (p, G) => sphere(at(MID, -0.05, 0.15, -0.1), 0.035, 0.075)(p) * white(p, G) },
  { bone: 'cheekR', from: HEAD, f: (p, G) => sphere(at(MID, -0.05, -0.15, -0.1), 0.035, 0.075)(p) * white(p, G) },
  { bone: 'earL3', from: ['earL2', 'earL1'], f: half([0.5, 1.29, 0.51], [0.95, 0, 0.25], 0.06) },
  { bone: 'earR3', from: ['earR2', 'earR1'], f: half([-0.25, 1.36, 0.16], [-0.5, 0.8, -0.35], 0.06) },
  { bone: 'earInL', from: ['earL1', 'earL2'], f: (p, G) => sphere([0.24, 1.16, 0.53], 0.05, 0.1)(p) * (G.hsv[1] < 0.3 ? 1 : 0.2) },
  { bone: 'earInR', from: ['earR1', 'earR2'], f: (p, G) => sphere([-0.15, 1.17, 0.35], 0.05, 0.1)(p) * (G.hsv[1] < 0.3 ? 1 : 0.2) },
  { bone: 'tailL5', from: ['tailL4', 'tailL3'], f: half([0.21, 1.22, -0.8], [0.15, 0.35, 0.9], 0.08) },
  { bone: 'tailR5', from: ['tailR4', 'tailR3'], f: half([-0.27, 1.25, -1.05], [0.25, 0.75, 0.6], 0.08) },
  { bone: 'tailLf', from: ['tailL2', 'tailL1', 'tailL3'], f: all(sphere([0.1, 0.68, -0.74], 0.06, 0.12), half([0.1, 0.74, -0.74], [0, -1, 0], 0.04)) },
  { bone: 'tailRf', from: ['tailR2', 'tailR1', 'tailR3'], f: all(sphere([-0.24, 0.54, -0.9], 0.07, 0.13), half([-0.24, 0.6, -0.9], [0, -1, 0], 0.04)) },
  { chain: ['ruff1', 'ruff2'], from: ['neck', 'chest', 'head', 'spine'], f: (p, G) => all(capsule([0, 0.74, 0.5], [0, 0.42, 0.42], 0.08, 0.14), half([0, 0, 0.3], [0, 0, 1], 0.06))(p) * white(p, G) },
  { bone: 'scruff1', from: ['neck'], f: all(capsule([0.03, 0.88, 0.35], [0.03, 0.8, 0.25], 0.05, 0.1), half([0, 0.73, 0], [0, 1, 0], 0.04)) },
  { bone: 'scruff2', from: ['chest'], f: all(capsule([0.03, 0.8, 0.25], [0.03, 0.76, 0.15], 0.05, 0.1), half([0, 0.73, 0], [0, 1, 0], 0.04)) },
  { bone: 'hackle1', from: ['chest', 'spine', 'neck'], f: all(sphere([0.04, 0.76, 0.04], 0.05, 0.1), half([0, 0.69, 0], [0, 1, 0], 0.03)) },
  { bone: 'hackle2', from: ['spine', 'hips', 'chest'], f: all(sphere([0.04, 0.76, -0.23], 0.05, 0.1), half([0, 0.68, 0], [0, 1, 0], 0.03)) },
  { bone: 'hackle3', from: ['hips', 'spine'], f: all(sphere([0.03, 0.73, -0.36], 0.05, 0.1), half([0, 0.67, 0], [0, 1, 0], 0.03)) },
  { bone: 'belly1', from: ['chest', 'spine'], f: all(ellipsoid([0.04, 0.42, 0.22], [0.13, 0.08, 0.1]), half([0, 0.47, 0], [0, -1, 0], 0.04)) },
  { bone: 'belly2', from: ['spine', 'chest'], f: all(ellipsoid([0.05, 0.47, 0.0], [0.13, 0.07, 0.1]), half([0, 0.52, 0], [0, -1, 0], 0.04)) },
  { bone: 'haunchL', from: ['rl_upper', 'hips'], f: all(sphere([0.16, 0.5, -0.36], 0.05, 0.1), half([0, 0, -0.29], [0, 0, -1], 0.04)) },
  { bone: 'haunchR', from: ['rr_upper', 'hips'], f: all(sphere([-0.09, 0.5, -0.39], 0.05, 0.1), half([0, 0, -0.33], [0, 0, -1], 0.04)) },
  { bone: 'elbowL', from: ['fl_upper', 'fl_lower'], f: all(sphere([0.17, 0.45, 0.11], 0.04, 0.08), half([0, 0, 0.17], [0, 0, -1], 0.03)) },
  { bone: 'elbowR', from: ['fr_upper', 'fr_lower'], f: all(sphere([-0.12, 0.45, 0.13], 0.04, 0.08), half([0, 0, 0.19], [0, 0, -1], 0.03)) },
];

const springs = [
  { bones: ['cheekL'], ...FUR, max: 0.45 }, { bones: ['cheekR'], ...FUR, max: 0.45 }, { bones: ['chin'], ...FUR },
  { bones: ['earL3'], k: 0.34, d: 0.66, max: 0.7, drag: 0.12 }, { bones: ['earR3'], k: 0.34, d: 0.66, max: 0.6, drag: 0.12 },
  { bones: ['earInL'], ...FUR, max: 0.3 }, { bones: ['earInR'], ...FUR, max: 0.3 },
  { bones: ['tailL5'], k: 0.24, d: 0.72, max: 0.8, drag: 0.15 }, { bones: ['tailR5'], k: 0.24, d: 0.72, max: 0.8, drag: 0.15 },
  { bones: ['tailLf'], ...FUR, max: 0.5 }, { bones: ['tailRf'], ...FUR, max: 0.5 },
  { bones: ['ruff1', 'ruff2'], ...FUR, max: 0.35 }, { bones: ['scruff1'], ...FUR, max: 0.3 }, { bones: ['scruff2'], ...FUR, max: 0.3 },
  { bones: ['hackle1'], ...FUR, max: 0.25 }, { bones: ['hackle2'], ...FUR, max: 0.25 }, { bones: ['hackle3'], ...FUR, max: 0.25 },
  { bones: ['belly1'], ...FUR, max: 0.35 }, { bones: ['belly2'], ...FUR, max: 0.35 },
  { bones: ['haunchL'], ...FUR }, { bones: ['haunchR'], ...FUR }, { bones: ['elbowL'], ...FUR }, { bones: ['elbowR'], ...FUR },
];

const SHUT = [{ s: [1, 0.12, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], WIDE = [{ s: [1.1, 1.18, 1.1] }];
const ANGRY = { L: [[F, 16]], R: [[F, -16]] }, UP = { L: [[F, -10]], R: [[F, 10]] };
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    const bite = /Bite/.test(c.name), spit = /Spit/.test(c.name);
    k.jaw = bite ? [[0, []], [Math.max(0, c0 - 0.12), [[L, 26]]], [c0, [[L, 0]]], [c1 + 0.05, [[L, 4]]], [e, []]]
      : pulse(s, c0, c1, e, [[L, spit ? 28 : 14]]);
    for (const sd of 'LR') { k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, SQUINT, [{ s: [1, 1, 1] }]); k['brow' + sd] = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, e + 0.1, ANGRY[sd]); }
    k.nose = pulse(s, c0, c1, e, [[L, -8]]);
    for (const h of ['hackle1', 'hackle2', 'hackle3']) k[h] = pulse(s, s + 0.08, c1, e + 0.15, [{ s: [1.08, 1.35, 1.08] }], [{ s: [1, 1, 1] }]);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.3, d * 0.4);
    k.jaw = [[0, []], [0.06, [[L, 18]]], [t, [[L, 10]]], [d, []]];
    for (const sd of 'LR') { k['eye' + sd] = [[0, [{ s: [1, 1, 1] }]], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, [{ s: [1, 1, 1] }]]]; k['brow' + sd] = pulse(0, 0.06, t, Math.min(d, t + 0.15), UP[sd]); }
    for (const h of ['hackle1', 'hackle2', 'hackle3']) k[h] = pulse(0, 0.05, t, d, [{ s: [1.1, 1.5, 1.1] }], [{ s: [1, 1, 1] }]);
  } else {
    for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.2 ? [0.3, 0.8] : d > 0.6 ? [0.5] : [], SHUT, [{ s: [1, 1, 1] }]);
    if (c.kind === 'idle') k.nose = wobble(d, U, 3, 0.35, 0, [[L, -2]]).map(([t, p], i) => [t, i % 4 < 2 ? p : [[L, 0]]]);
    if (/Run/.test(c.name)) k.jaw = [[0, [[L, 7]]], [d, [[L, 7]]]];   // panting
  }
  return k;
}

export default { in: 'assets/nib/export/nib-v1.glb', out: 'assets/nib/export/nib-b.glb', manifest: ['Nib'], bones, weights, springs, keys };
