// Potato Sack: 30 bones on top of his 12. A face (button eyes that glare and pop, brows of cloth, a stitched mouth that
// opens and pulls at the corners); the bag's contents slosh front, back and sides; the tied top flops in four lobes;
// the potatoes riding on his shoulder jostle and their sprouts wave; and the loose bits (the frayed scrap at the
// rope, stray fibres, the sack's tied corners, the leather patch's corner, slack cloth under the arms) swing.
import { sphere, capsule, half, all, pulse, wobble } from './_lib.mjs';
const X = [1, 0, 0], Z = [0, 0, 1], Y = [0, 1, 0];
const BAG = ['belly', 'chest', 'neck'];
const BTN = { L: [0.19, 1.21, 0.44], R: [-0.18, 1.2, 0.45] };   // his left button is the small one
const FACE = { L: [0.42, 0.3, 0.85], R: [-0.17, 0.25, 0.95] };   // which way each button faces
const green = (p, G) => (G.hsv[0] > 60 && G.hsv[0] < 160 && G.hsv[1] > 0.3 ? 1 : 0.05), light = (p, G) => (G.lum > 0.42 ? 1 : 0.15);
const dark = (p, G) => (G.lum < 0.3 ? 1 : 0.1), leather = (p, G) => (G.hsv[1] > 0.55 ? 1 : 0.1);

const bones = [
  { name: 'buttonL', parent: 'chest', head: BTN.L, tail: [0.23, 1.24, 0.52], why: 'the small button eye: glares on a strike, pops and spins when hit' },
  { name: 'buttonR', parent: 'chest', head: BTN.R, tail: [-0.2, 1.23, 0.55], why: 'the big button eye: glares, pops and spins, turns loosely while he idles' },
  { name: 'browL', parent: 'chest', head: [0.1, 1.31, 0.45], tail: [0.27, 1.31, 0.42], why: 'the cloth over his left eye: scowls on a strike, lifts when hit' },
  { name: 'browR', parent: 'chest', head: [-0.08, 1.33, 0.45], tail: [-0.28, 1.33, 0.42], why: 'the cloth over his right eye: scowls on a strike, lifts when hit' },
  { name: 'mouth', parent: 'chest', head: [0.03, 1.05, 0.4], tail: [0.03, 0.94, 0.55], why: 'the cloth below the stitched mouth: drops it open to shout and when hit' },
  { name: 'mouthL', parent: 'chest', head: [0.2, 1.05, 0.46], tail: [0.32, 1.07, 0.44], why: 'his mouth corner: snarls on a strike, droops when hit' },
  { name: 'mouthR', parent: 'chest', head: [-0.14, 1.03, 0.47], tail: [-0.26, 1.03, 0.45], why: 'his mouth corner: snarls on a strike, droops when hit' },
  { name: 'cheekL', parent: 'chest', head: [0.35, 1.15, 0.3], tail: [0.4, 1.02, 0.3], why: 'the full cloth at the side of his face, swings' },
  { name: 'cheekR', parent: 'chest', head: [-0.35, 1.15, 0.3], tail: [-0.4, 1.02, 0.3], why: 'the full cloth at the side of his face, swings' },
  { name: 'sloshF', parent: 'belly', head: [0, 0.62, 0.3], tail: [0, 0.48, 0.42], why: 'the load at the front of the bag, sloshes' },
  { name: 'sloshB', parent: 'belly', head: [0, 0.62, -0.3], tail: [0, 0.48, -0.42], why: 'the load at the back of the bag, sloshes' },
  { name: 'sloshL', parent: 'footL', head: [0.35, 0.6, 0], tail: [0.48, 0.46, 0], why: 'the load at the side of the bag, sloshes' },
  { name: 'sloshR', parent: 'footR', head: [-0.35, 0.6, 0], tail: [-0.48, 0.46, 0], why: 'the load at the side of the bag, sloshes' },
  { name: 'lobeL', parent: 'tuft2', head: [-0.08, 1.74, 0], tail: [-0.28, 1.8, 0], why: 'a lobe of the tied top, flops' },
  { name: 'lobeR', parent: 'tuft2', head: [0.1, 1.71, 0], tail: [0.36, 1.66, 0], why: 'a lobe of the tied top, flops' },
  { name: 'lobeF', parent: 'tuft2', head: [0, 1.72, 0.06], tail: [0, 1.78, 0.2], why: 'a lobe of the tied top, flops' },
  { name: 'lobeB', parent: 'tuft2', head: [0, 1.72, -0.06], tail: [0, 1.78, -0.2], why: 'a lobe of the tied top, flops' },
  { name: 'scrap1', parent: 'chest', head: [0.2, 1.55, 0.08], tail: [0.31, 1.5, 0.06], why: 'the frayed scrap hanging from the rope, first link' },
  { name: 'scrap2', parent: 'scrap1', head: [0.31, 1.5, 0.06], tail: [0.42, 1.47, 0.04], why: 'the frayed scrap, its ragged end' },
  { name: 'spudA', parent: 'chest', head: [-0.33, 1.34, 0.12], tail: [-0.4, 1.44, 0.18], why: 'the upper potato on his shoulder, jostles' },
  { name: 'spudB', parent: 'armR', head: [-0.42, 1.2, 0.08], tail: [-0.53, 1.27, 0.13], why: 'the lower potato on his shoulder, jostles' },
  { name: 'sprout1', parent: 'armR', head: [-0.53, 1.33, 0.12], tail: [-0.58, 1.42, 0.14], why: 'a sprout on the potato, waves' },
  { name: 'sprout2', parent: 'spudA', head: [-0.43, 1.42, 0.14], tail: [-0.46, 1.48, 0.15], why: 'a sprout on the potato, waves' },
  { name: 'cornerL', parent: 'footL', head: [0.47, 0.3, 0.05], tail: [0.7, 0.2, 0.05], why: 'the tied bottom corner of the sack, swings' },
  { name: 'cornerR', parent: 'footR', head: [-0.47, 0.3, 0.05], tail: [-0.7, 0.2, 0.05], why: 'the tied bottom corner of the sack, swings' },
  { name: 'frayL', parent: 'sloshR', head: [-0.6, 0.64, 0.05], tail: [-0.68, 0.58, 0.05], why: 'stray fibres at his side, wave' },
  { name: 'frayR', parent: 'armL', head: [0.42, 1.3, 0.04], tail: [0.5, 1.24, 0.04], why: 'stray fibres by his shoulder, wave' },
  { name: 'patch', parent: 'belly', head: [-0.06, 0.82, 0.52], tail: [0.02, 0.76, 0.56], why: 'the loose corner of the leather patch, flaps' },
  { name: 'slackL', parent: 'armL', head: [0.5, 0.86, 0], tail: [0.55, 0.74, 0], why: 'slack cloth under his arm, sways' },
  { name: 'slackR', parent: 'armR', head: [-0.5, 0.86, 0], tail: [-0.55, 0.74, 0], why: 'slack cloth under his arm, sways' },
];

const front = z => half([0, 0, z], [0, 0, 1], 0.05);
const weights = [
  { bone: 'buttonL', from: ['chest'], f: all(sphere(BTN.L, 0.09, 0.12), front(0.3)) },
  { bone: 'buttonR', from: ['chest'], f: all(sphere(BTN.R, 0.105, 0.135), front(0.3)) },
  { bone: 'browL', from: ['chest'], f: all(sphere([0.18, 1.33, 0.44], 0.06, 0.1), front(0.3)) },
  { bone: 'browR', from: ['chest'], f: all(sphere([-0.18, 1.34, 0.44], 0.05, 0.09), front(0.3)) },
  { bone: 'mouth', from: ['chest'], f: all(capsule([-0.2, 0.95, 0.5], [0.26, 0.97, 0.5], 0.04, 0.09), half([0, 1.01, 0], [0, -1, 0], 0.03), front(0.35)) },
  { bone: 'mouthL', from: ['chest'], f: all(sphere([0.28, 1.06, 0.45], 0.035, 0.07), front(0.3)) },
  { bone: 'mouthR', from: ['chest'], f: all(sphere([-0.22, 1.03, 0.46], 0.035, 0.07), front(0.3)) },
  { bone: 'cheekL', from: ['chest'], f: sphere([0.42, 1.1, 0.3], 0.06, 0.13) },
  { bone: 'cheekR', from: ['chest'], f: sphere([-0.42, 1.1, 0.3], 0.06, 0.13) },
  { bone: 'sloshF', from: ['belly'], f: all(sphere([0, 0.5, 0.5], 0.14, 0.28), front(0.3)) },
  { bone: 'sloshB', from: ['belly'], f: all(sphere([0, 0.5, -0.5], 0.14, 0.28), half([0, 0, -0.3], [0, 0, -1], 0.05)) },
  { bone: 'sloshL', from: ['footL'], f: all(sphere([0.58, 0.6, 0], 0.12, 0.25), half([0.4, 0, 0], [1, 0, 0], 0.05)) },
  { bone: 'sloshR', from: ['footR'], f: all(sphere([-0.58, 0.6, 0], 0.12, 0.25), half([-0.4, 0, 0], [-1, 0, 0], 0.05)) },
  { bone: 'lobeL', from: ['tuft2', 'tuft1'], f: all(sphere([-0.25, 1.78, 0], 0.07, 0.15), half([0, 1.66, 0], [0, 1, 0], 0.04)) },
  { bone: 'lobeR', from: ['tuft2', 'tuft1'], f: all(sphere([0.3, 1.68, 0], 0.07, 0.15), half([0, 1.62, 0], [0, 1, 0], 0.04)) },
  { bone: 'lobeF', from: ['tuft2', 'tuft1'], f: all(sphere([0, 1.78, 0.16], 0.06, 0.13), half([0, 1.66, 0], [0, 1, 0], 0.04)) },
  { bone: 'lobeB', from: ['tuft2', 'tuft1'], f: all(sphere([0, 1.78, -0.16], 0.06, 0.13), half([0, 1.66, 0], [0, 1, 0], 0.04)) },
  { chain: ['scrap1', 'scrap2'], from: ['neck', 'tuft1', 'chest'], f: all(capsule([0.22, 1.54, 0.07], [0.44, 1.46, 0.04], 0.03, 0.07), half([0.2, 0, 0], [1, 0, 0], 0.03)) },
  { bone: 'spudA', from: ['chest'], f: (p, G) => sphere([-0.367, 1.405, 0.16], 0.06, 0.1)(p) * light(p, G) },
  { bone: 'spudB', from: ['armR'], f: (p, G) => sphere([-0.497, 1.247, 0.12], 0.07, 0.11)(p) * light(p, G) },
  { bone: 'sprout1', from: ['armR', 'neutral_bone'], loose: ['neutral_bone'], f: (p, G) => sphere([-0.56, 1.36, 0.13], 0.03, 0.08)(p) * green(p, G) },
  { bone: 'sprout2', from: ['spudA', 'chest', 'neutral_bone', 'armR'], loose: ['neutral_bone', 'chest', 'armR'], f: (p, G) => sphere([-0.44, 1.45, 0.14], 0.04, 0.08)(p) * green(p, G) },
  { bone: 'cornerL', from: ['footL'], f: all(half([0.5, 0, 0], [1, 0, 0], 0.06), half([0, 0.42, 0], [0, -1, 0], 0.05)) },
  { bone: 'cornerR', from: ['footR'], f: all(half([-0.5, 0, 0], [-1, 0, 0], 0.06), half([0, 0.42, 0], [0, -1, 0], 0.05)) },
  { bone: 'frayL', from: ['sloshR', 'footR'], f: (p, G) => all(sphere([-0.62, 0.62, 0.05], 0.04, 0.08), half([-0.6, 0, 0], [-1, 0, 0], 0.03))(p) * dark(p, G) },
  { bone: 'frayR', from: ['armL'], f: (p, G) => all(sphere([0.45, 1.27, 0.04], 0.04, 0.08), half([0.4, 0, 0], [1, 0, 0], 0.03))(p) * dark(p, G) },
  { bone: 'patch', from: ['belly'], f: (p, G) => all(sphere([-0.01, 0.79, 0.54], 0.06, 0.1), front(0.4))(p) * leather(p, G) },
  { bone: 'slackL', from: ['armL'], f: all(sphere([0.52, 0.8, 0], 0.09, 0.16), half([0, 0.9, 0], [0, -1, 0], 0.04), half([0.42, 0, 0], [1, 0, 0], 0.03)) },
  { bone: 'slackR', from: ['armR'], f: all(sphere([-0.52, 0.8, 0], 0.09, 0.16), half([0, 0.9, 0], [0, -1, 0], 0.04), half([-0.42, 0, 0], [-1, 0, 0], 0.03)) },
];

const CLOTH = { k: 0.26, d: 0.72, max: 0.45, drag: 0.12 }, SLOSH = { k: 0.16, d: 0.8, max: 0.22, drag: 0.1 };
const springs = [
  ...['cheekL', 'cheekR', 'slackL', 'slackR'].map(b => ({ bones: [b], ...CLOTH, max: 0.3 })),
  ...['sloshF', 'sloshB', 'sloshL', 'sloshR'].map(b => ({ bones: [b], ...SLOSH })),
  ...['lobeL', 'lobeR', 'lobeF', 'lobeB'].map(b => ({ bones: [b], k: 0.28, d: 0.68, max: 0.6, drag: 0.14 })),
  { bones: ['scrap1', 'scrap2'], k: 0.26, d: 0.7, max: 0.8, drag: 0.16 },
  { bones: ['spudA'], k: 0.3, d: 0.65, max: 0.3, drag: 0.1 }, { bones: ['spudB'], k: 0.3, d: 0.65, max: 0.3, drag: 0.1 },
  { bones: ['sprout1'], k: 0.3, d: 0.66, max: 0.7, drag: 0.15 }, { bones: ['sprout2'], k: 0.3, d: 0.66, max: 0.7, drag: 0.15 },
  { bones: ['cornerL'], ...CLOTH }, { bones: ['cornerR'], ...CLOTH },
  { bones: ['frayL'], ...CLOTH, max: 0.7 }, { bones: ['frayR'], ...CLOTH, max: 0.7 }, { bones: ['patch'], ...CLOTH, max: 0.35 },
];

const REST = [{ s: [1, 1, 1] }];
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    for (const [sd, w] of [['L', 1], ['R', -1]]) k['button' + sd] = pulse(s, c0 - 0.05, c1, e, [[FACE[sd], 14 * w], { s: [1, 1, 1] }], REST);   // the buttons cock inward, a glare
    k.browL = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, Math.min(d, e + 0.1), [[Z, 16]]);
    k.browR = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, Math.min(d, e + 0.1), [[Z, -16]]);
    k.mouth = pulse(s, c0, c1, e, [[X, 14]]);
    k.mouthL = pulse(s, c0, c1, e, [[Z, 14]]); k.mouthR = pulse(s, c0, c1, e, [[Z, -14]]);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    /* the buttons pop and rattle round on their threads */
    for (const [sd, w] of [['L', 1], ['R', -1]]) k['button' + sd] = [[0, REST], [0.05, [[FACE[sd], 28 * w], { s: [1.22, 1.22, 1.22] }]], [t * 0.6, [[FACE[sd], -16 * w], { s: [1.15, 1.15, 1.15] }]], [t, [[FACE[sd], 9 * w], { s: [1.08, 1.08, 1.08] }]], [Math.min(d, t + 0.15), [[FACE[sd], -3 * w], { s: [1, 1, 1] }]], [d, REST]];
    k.browL = pulse(0, 0.06, t, Math.min(d, t + 0.15), [[Z, -12], [X, -6]]); k.browR = pulse(0, 0.06, t, Math.min(d, t + 0.15), [[Z, 12], [X, -6]]);
    k.mouth = [[0, []], [0.06, [[X, 20]]], [t, [[X, 12]]], [d, []]];
    k.mouthL = pulse(0, 0.06, t, d, [[Z, -14]]); k.mouthR = pulse(0, 0.06, t, d, [[Z, 14]]);
  } else if (c.kind === 'idle') {
    k.buttonR = wobble(d, FACE.R, 10, d / 2);   // the big button hangs loose and turns a little
  }
  return k;
}

export default { in: 'assets/potato-sack/export/potato-sack-v1.glb', out: 'assets/potato-sack/export/potato-sack-b.glb', manifest: ['Potato Sack'], bones, weights, springs, keys };
