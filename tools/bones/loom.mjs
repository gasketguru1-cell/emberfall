// Loom (the kite): 30 bones on top of her 14. The sail becomes cloth: a three-link tip at the top, three-link wing tips,
// flutter along the upper edges and the hem, panels that billow; the gold knots and the pendants swing on their own;
// and a face: eyes that blink and squint, a mouth that opens to blow her Gust.
import { sphere, capsule, half, all, pulse, blinks } from './_lib.mjs';
const X = [1, 0, 0], Y = [0, 1, 0];
const gold = (p, G) => (G.hsv[0] > 30 && G.hsv[0] < 60 && G.hsv[1] > 0.35 ? 1 : 0.1);
const SAIL = ['top', 'wingL', 'wingR', 'body'];

const bones = [
  { name: 'eyeL', parent: 'body', head: [0.1, 1.556, 0.09], tail: [0.1, 1.556, 0.15], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'body', head: [-0.1, 1.556, 0.09], tail: [-0.1, 1.556, 0.15], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'mouth', parent: 'body', head: [0, 1.487, 0.1], tail: [0, 1.487, 0.16], why: 'opens round to blow the Gust, gasps when hit' },
  { name: 'apex1', parent: 'top', head: [0, 1.72, 0], tail: [0, 1.84, -0.01], why: 'the top of the sail, first link' },
  { name: 'apex2', parent: 'apex1', head: [0, 1.84, -0.01], tail: [0, 1.93, -0.02], why: 'the top of the sail, second link' },
  { name: 'apex3', parent: 'apex2', head: [0, 1.93, -0.02], tail: [0, 2.0, -0.04], why: 'the very tip of the sail' },
  { name: 'belly', parent: 'body', head: [0, 1.4, 0.04], tail: [0, 1.28, 0.04], why: 'the middle of the sail under the face: billows in the wind of her specials' },
  { name: 'hemC', parent: 'body', head: [0, 1.27, 0.03], tail: [0, 1.17, 0.02], why: 'the middle of the bottom edge, flutters' },
];
const side = [];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
  const m = a => [a[0] * s, a[1], a[2]], w = 'wing' + k;
  side.push(
    { name: 'corner' + k + '1', parent: w, head: m([0.3, 1.42, 0]), tail: m([0.42, 1.39, 0]), why: 'the wing tip, first link' },
    { name: 'corner' + k + '2', parent: 'corner' + k + '1', head: m([0.42, 1.39, 0]), tail: m([0.53, 1.36, 0]), why: 'the wing tip, second link' },
    { name: 'corner' + k + '3', parent: 'corner' + k + '2', head: m([0.53, 1.36, 0]), tail: m([0.65, 1.32, 0]), why: 'the very point of the wing' },
    { name: 'edge' + k + '1', parent: 'top', head: m([0.13, 1.76, 0]), tail: m([0.2, 1.81, 0]), why: 'the upper edge near the top, flutters' },
    { name: 'edge' + k + '2', parent: w, head: m([0.34, 1.53, 0]), tail: m([0.42, 1.58, 0]), why: 'the upper edge near the wing tip, flutters' },
    { name: 'panel' + k + '1', parent: w, head: m([0.22, 1.68, 0]), tail: m([0.24, 1.58, 0]), why: 'the upper panel beside the face, billows' },
    { name: 'panel' + k + '2', parent: w, head: m([0.27, 1.36, 0]), tail: m([0.29, 1.26, 0]), why: 'the lower panel out to the wing, billows' },
    { name: 'hem' + k, parent: w, head: m([0.17, 1.28, 0]), tail: m([0.17, 1.18, 0]), why: 'the bottom edge between the middle and the knot, flutters' },
    { name: 'knot' + k, parent: 'rib' + k + '1', head: m([0.3, 1.17, -0.02]), tail: m([0.3, 1.08, -0.02]), why: 'the gold knot the ribbon hangs from, swings' },
    { name: 'bead' + k, parent: 'rib' + k + '5', head: m([0.45, 0.3, -0.07]), tail: m([0.45, 0.235, -0.07]), why: 'the bead at the end of the ribbon' },
    { name: 'pendant' + k, parent: 'bead' + k, head: m([0.45, 0.235, -0.07]), tail: m([0.44, 0.1, -0.07]), why: 'the gold pendant, swings on its own' });
}
bones.push(...side);

const weights = [
  { bone: 'eyeL', from: ['body'], f: all(sphere([0.1, 1.556, 0.09], 0.035, 0.06), half([0, 1.51, 0], [0, 1, 0], 0.02)) },
  { bone: 'eyeR', from: ['body'], f: all(sphere([-0.1, 1.556, 0.09], 0.035, 0.06), half([0, 1.51, 0], [0, 1, 0], 0.02)) },
  { bone: 'mouth', from: ['body'], f: sphere([0, 1.487, 0.1], 0.04, 0.065) },
  { chain: ['apex1', 'apex2', 'apex3'], from: ['top'], f: all(capsule([0, 1.76, 0], [0, 2.0, -0.04], 0.12, 0.26), half([0, 1.72, 0], [0, 1, 0], 0.08)) },
  { bone: 'belly', from: ['body', 'wingL', 'wingR'], f: all(sphere([0, 1.34, 0.04], 0.07, 0.15), half([0, 1.45, 0], [0, -1, 0], 0.04)) },
  { bone: 'hemC', from: ['body', 'belly'], f: all(capsule([-0.1, 1.2, 0], [0.1, 1.2, 0], 0.03, 0.08)) },
];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
  const m = a => [a[0] * s, a[1], a[2]], w = 'wing' + k, SIDE = [w, 'top', 'body'];
  weights.push(
    { chain: ['corner' + k + '1', 'corner' + k + '2', 'corner' + k + '3'], from: [w], f: all(capsule(m([0.32, 1.415, 0]), m([0.66, 1.32, 0]), 0.1, 0.2), half(m([0.28, 0, 0]), [s, 0, 0], 0.08)) },
    { bone: 'edge' + k + '1', from: SIDE, f: capsule(m([0.06, 1.9, 0]), m([0.26, 1.7, 0]), 0.03, 0.09) },
    { bone: 'edge' + k + '2', from: SIDE.concat(['corner' + k + '1']), f: capsule(m([0.28, 1.62, 0]), m([0.48, 1.45, 0]), 0.03, 0.09) },
    { bone: 'panel' + k + '1', from: SIDE, f: all(sphere(m([0.25, 1.63, 0]), 0.06, 0.14), half(m([0.15, 0, 0]), [s, 0, 0], 0.05)) },
    { bone: 'panel' + k + '2', from: SIDE.concat(['corner' + k + '1']), f: all(sphere(m([0.3, 1.3, 0]), 0.06, 0.13), half(m([0.2, 0, 0]), [s, 0, 0], 0.05)) },
    { bone: 'hem' + k, from: SIDE.concat(['hemC', 'belly']), f: all(capsule(m([0.1, 1.21, 0]), m([0.24, 1.17, 0]), 0.03, 0.08)) },
    { bone: 'knot' + k, from: ['rib' + k + '1', 'body', w], f: (p, G) => sphere(m([0.3, 1.125, -0.02]), 0.04, 0.07)(p) * gold(p, G) },
    { chain: ['bead' + k, 'pendant' + k], from: ['rib' + k + '5', 'rib' + k + '4'], f: half([0, 0.33, 0], [0, -1, 0], 0.04), blend: 0.15 });
}

const CLOTH = { k: 0.26, d: 0.72, max: 0.45, drag: 0.12 };
const springs = [
  { bones: ['apex1', 'apex2', 'apex3'], k: 0.24, d: 0.72, max: 0.5, drag: 0.1 },
  { bones: ['belly'], ...CLOTH, max: 0.3 }, { bones: ['hemC'], ...CLOTH, max: 0.35 },
];
for (const k of 'LR') springs.push(
  { bones: ['corner' + k + '1', 'corner' + k + '2', 'corner' + k + '3'], k: 0.24, d: 0.72, max: 0.6, drag: 0.12 },
  { bones: ['edge' + k + '1'], ...CLOTH }, { bones: ['edge' + k + '2'], ...CLOTH },
  { bones: ['panel' + k + '1'], ...CLOTH, max: 0.3 }, { bones: ['panel' + k + '2'], ...CLOTH, max: 0.3 }, { bones: ['hem' + k], ...CLOTH },
  { bones: ['knot' + k], k: 0.3, d: 0.7, max: 0.4, drag: 0.1 },
  { bones: ['bead' + k, 'pendant' + k], k: 0.28, d: 0.7, max: 0.9, drag: 0.16 });

const SHUT = [{ s: [1, 0.1, 1] }], SQUINT = [{ s: [1, 0.6, 1] }], OPEN = [{ s: [1, 1, 1] }], WIDE = [{ s: [1.12, 1.2, 1] }];
const SHUTM = [{ s: [1, 1, 1] }];
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    const blow = /Gust|Thermal/.test(c.name);
    k.mouth = pulse(s, blow ? c0 - 0.05 : c0, c1 + (blow ? 0.2 : 0), Math.min(d, e + (blow ? 0.2 : 0)), [{ s: blow ? [0.6, 3.2, 1] : [1.1, 2.2, 1] }], SHUTM);
    for (const sd of 'LR') k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, blow ? [{ s: [1, 0.35, 1] }] : SQUINT, OPEN);
    /* the sail fills: the middle bows forward and the panels with it */
    const fill = blow ? 22 : 10;
    k.belly = pulse(s, c0, c1, e, [[X, -fill]]);
    for (const sd of 'LR') { k['panel' + sd + '1'] = pulse(s, c0, c1, e, [[X, -fill * 0.6]]); k['panel' + sd + '2'] = pulse(s, c0, c1, e, [[X, -fill * 0.7]]); }
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    k.mouth = [[0, SHUTM], [0.05, [{ s: [1.3, 2.8, 1] }]], [t, [{ s: [1.2, 2.2, 1] }]], [d, SHUTM]];
    for (const sd of 'LR') k['eye' + sd] = [[0, OPEN], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]];
    k.belly = pulse(0, 0.05, t, d, [[X, 18]]);   // the sail is punched in
  } else {
    for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.6 ? [0.3, 0.8] : d > 0.6 ? [0.5] : [], SHUT, OPEN);
    if (/Run|Fall|Rise/.test(c.name)) k.belly = [[0, [[X, -8]]], [d, [[X, -8]]]];   // full of air when moving fast
    if (c.kind === 'idle') k.mouth = [[0, SHUTM], [d * 0.4, SHUTM], [d * 0.5, [{ s: [1.15, 1.6, 1] }]], [d * 0.6, SHUTM], [d, SHUTM]];   // a little hum
  }
  return k;
}

export default { in: 'assets/loom/export/loom-v1.glb', out: 'assets/loom/export/loom-b.glb', manifest: ['Loom'], bones, weights, springs, keys };
