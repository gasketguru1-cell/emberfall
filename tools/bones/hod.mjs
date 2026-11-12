// Hod: 30 bones on top of his 21. Fourteen of his leaf scales get their own bones, so the coat ripples on springs and
// flares up when he strikes; a face (jaw, eyes, brows, nose); white cheek tufts and chest fur; three claws on each fore paw.
import * as THREE from 'three';
import { sphere, capsule, half, all, pulse, blinks, wobble } from './_lib.mjs';
const BODY = ['hips', 'spine', 'chest', 'neck', 'head', 'fl_upper', 'fr_upper', 'rl_upper', 'rr_upper'];
const scaleCol = (p, G) => (G.hsv[1] > 0.55 && G.hsv[0] < 30 ? 1 : 0.12), white = (p, G) => (G.hsv[1] < 0.3 && G.hsv[2] > 0.6 ? 1 : 0.15);
const EYE = { L: [0.092, 0.535, 0.56], R: [-0.092, 0.535, 0.56] };

/* the scale plates: name, parent, base, tip, centre of the patch it carries, size */
const PLATES = [
  ['crown', 'neck', [0, 0.8, 0.44], [0, 0.88, 0.34], [0, 0.84, 0.4], 0.06],
  ['ridge1', 'chest', [0, 0.86, 0.2], [0, 0.94, 0.08], [0, 0.9, 0.15], 0.08],
  ['ridge2', 'spine', [0, 0.85, -0.05], [0, 0.9, -0.2], [0, 0.88, -0.1], 0.08],
  ['ridge3', 'hips', [0, 0.76, -0.32], [0, 0.78, -0.48], [0, 0.78, -0.38], 0.08],
];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) PLATES.push(
  ['neck' + k, 'neck', [0.17 * s, 0.7, 0.42], [0.22 * s, 0.6, 0.42], [0.19 * s, 0.65, 0.42], 0.05],
  ['upper' + k, 'spine', [0.2 * s, 0.82, 0.05], [0.3 * s, 0.78, -0.08], [0.25 * s, 0.8, 0.0], 0.07],
  ['shoulder' + k, k === 'L' ? 'fl_upper' : 'fr_upper', [0.3 * s, 0.68, 0.25], [0.4 * s, 0.5, 0.22], [0.36 * s, 0.6, 0.23], 0.07],
  ['flankF' + k, k === 'L' ? 'fl_upper' : 'fr_upper', [0.36 * s, 0.62, 0.0], [0.42 * s, 0.42, -0.05], [0.4 * s, 0.52, -0.02], 0.07],
  ['flankR' + k, k === 'L' ? 'rl_upper' : 'rr_upper', [0.3 * s, 0.6, -0.3], [0.34 * s, 0.4, -0.36], [0.32 * s, 0.5, -0.33], 0.07]);
const CLAWS = [];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) [0.176, 0.275, 0.362].forEach((x, i) => CLAWS.push({ name: 'claw' + k + (i + 1), parent: k === 'L' ? 'fl_paw' : 'fr_paw', head: [x * s, 0.11, 0.31 + (i === 1 ? 0.03 : 0)], tail: [x * s, 0.01, 0.42 + (i === 1 ? 0.03 : 0)], k }));

const bones = [
  { name: 'jaw', parent: 'head', head: [0, 0.465, 0.5], tail: [0, 0.405, 0.64], why: 'opens for the headbutt, the bite of a jab and a grunt when hit' },
  { name: 'eyeL', parent: 'head', head: EYE.L, tail: [EYE.L[0], EYE.L[1], 0.6], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'head', head: EYE.R, tail: [EYE.R[0], EYE.R[1], 0.6], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'browL', parent: 'head', head: [0.06, 0.585, 0.56], tail: [0.15, 0.59, 0.53], why: 'the dark brow: scowls harder on a strike, lifts when hit' },
  { name: 'browR', parent: 'head', head: [-0.06, 0.585, 0.56], tail: [-0.15, 0.59, 0.53], why: 'the dark brow: scowls harder on a strike, lifts when hit' },
  { name: 'nose', parent: 'head', head: [0, 0.5, 0.58], tail: [0, 0.49, 0.665], why: 'sniffs while idle, wrinkles on a strike' },
  { name: 'cheekL', parent: 'neck', head: [0.14, 0.48, 0.49], tail: [0.2, 0.41, 0.48], why: 'white cheek tuft, swings' },
  { name: 'cheekR', parent: 'neck', head: [-0.14, 0.48, 0.49], tail: [-0.2, 0.41, 0.48], why: 'white cheek tuft, swings' },
  { name: 'chestFur', parent: 'chest', head: [0, 0.4, 0.4], tail: [0, 0.22, 0.38], why: 'the white bib under the chin, swings' },
  { name: 'belly', parent: 'spine', head: [0, 0.26, -0.05], tail: [0, 0.15, -0.08], why: 'the soft belly, jiggles on landings' },
  ...PLATES.map(([name, parent, head, tail]) => ({ name, parent, head, tail, why: 'a leaf scale: ripples on a spring, flares on a strike' })),
  ...CLAWS.map(c => ({ name: c.name, parent: c.parent, head: c.head, tail: c.tail, why: 'a fore claw: splays for the swipe, curls to grip' })),
];

const weights = [
  { bone: 'jaw', from: ['head', 'neck'], f: all(capsule([0, 0.465, 0.5], [0, 0.405, 0.64], 0.04, 0.08), half([0, 0.445, 0], [0, -1, 0], 0.02), half([0, 0, 0.5], [0, 0, 1], 0.04)) },
  { bone: 'nose', from: ['head'], f: sphere([0, 0.5, 0.64], 0.03, 0.06) },
  { bone: 'eyeL', from: ['head'], f: sphere(EYE.L, 0.03, 0.055) },
  { bone: 'eyeR', from: ['head'], f: sphere(EYE.R, 0.03, 0.055) },
  { bone: 'browL', from: ['head', 'eyeL'], f: sphere([0.1, 0.59, 0.55], 0.025, 0.05) },
  { bone: 'browR', from: ['head', 'eyeR'], f: sphere([-0.1, 0.59, 0.55], 0.025, 0.05) },
  { bone: 'cheekL', from: ['head', 'neck'], f: (p, G) => sphere([0.17, 0.45, 0.49], 0.035, 0.075)(p) * white(p, G) },
  { bone: 'cheekR', from: ['head', 'neck'], f: (p, G) => sphere([-0.17, 0.45, 0.49], 0.035, 0.075)(p) * white(p, G) },
  { bone: 'chestFur', from: ['chest', 'neck', 'head'], f: (p, G) => all(capsule([0, 0.38, 0.42], [0, 0.2, 0.36], 0.08, 0.14), half([0, 0, 0.3], [0, 0, 1], 0.05))(p) * white(p, G) },
  { bone: 'belly', from: ['spine', 'chest', 'hips'], f: all(sphere([0, 0.18, -0.06], 0.1, 0.18), half([0, 0.26, 0], [0, -1, 0], 0.05)) },
  ...PLATES.map(([bone, , , , c, r]) => ({ bone, from: BODY, f: (p, G) => sphere(c, r, r * 1.9)(p) * scaleCol(p, G) })),
  ...CLAWS.map(c => ({ bone: c.name, from: [c.parent, c.parent.replace('paw', 'lower')], f: (p, G) => capsule(c.head, c.tail, 0.03, 0.05)(p) * white(p, G) })),
];

const PLATE = { k: 0.28, d: 0.72, max: 0.3, drag: 0.06 }, FUR = { k: 0.25, d: 0.74, max: 0.4, drag: 0.08 };
const springs = [
  { bones: ['cheekL'], ...FUR }, { bones: ['cheekR'], ...FUR }, { bones: ['chestFur'], ...FUR, max: 0.3 }, { bones: ['belly'], k: 0.2, d: 0.78, max: 0.25, drag: 0.1 },
  ...PLATES.map(([n]) => ({ bones: [n], ...PLATE })),
];

/* a plate flares by lifting its tip away from the body */
const flareAxis = {};
for (const [n, , h, t] of PLATES) { const dir = new THREE.Vector3(...t).sub(new THREE.Vector3(...h)).normalize(), out = new THREE.Vector3(h[0], h[1] - 0.45, 0).normalize(); flareAxis[n] = dir.cross(out).normalize().toArray(); }
const flare = deg => Object.fromEntries(PLATES.map(([n]) => [n, deg]));
const X = [1, 0, 0], Z = [0, 0, 1], Y = [0, 1, 0];
const SHUT = [{ s: [1, 0.12, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], OPEN = [{ s: [1, 1, 1] }], WIDE = [{ s: [1.1, 1.2, 1.1] }];
const ANGRY = { L: [[Z, 14]], R: [[Z, -14]] }, UP = { L: [[Z, -10], [X, -6]], R: [[Z, 10], [X, -6]] };

function keys(c) {
  const k = {}, d = c.dur, claws = CLAWS.map(x => x.name);
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    const paw = /Swipe|Jab|Slam|Toss/.test(c.name), mouth = /Headbutt|Jab|Ram/.test(c.name);
    k.jaw = pulse(s, c0, c1, e, [[X, mouth ? 22 : 10]]);
    k.nose = pulse(s, c0, c1, e, [[X, -8]]);
    for (const sd of 'LR') { k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, SQUINT, OPEN); k['brow' + sd] = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, e + 0.1, ANGRY[sd]); }
    PLATES.forEach(([n], i) => { const lag = 0.012 * i; k[n] = pulse(Math.min(s + lag, c0 - 0.1), Math.min(s + 0.12 + lag, c0), c1, Math.min(d, e + 0.15), [[flareAxis[n], 28]]); });
    for (const n of claws) k[n] = paw ? pulse(s, c0 - 0.04, c1, e, [[X, -28]]) : pulse(s, c0, c1, e, [[X, 12]]);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    k.jaw = [[0, []], [0.06, [[X, 16]]], [t, [[X, 8]]], [d, []]];
    for (const sd of 'LR') { k['eye' + sd] = [[0, OPEN], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]]; k['brow' + sd] = pulse(0, 0.06, t, Math.min(d, t + 0.15), UP[sd]); }
    PLATES.forEach(([n], i) => { k[n] = wobble(d, flareAxis[n], 14 * (1 - 0.3 * (i % 2)), 0.12, i * 0.13).map(([t2, p]) => [t2, [[p[0][0], p[0][1] * Math.max(0, 1 - t2 / d)]]]); });
    for (const n of claws) k[n] = pulse(0, 0.05, t, d, [[X, 25]]);
  } else {
    for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.6 ? [0.25, 0.75] : d > 0.6 ? [0.5] : [], SHUT, OPEN);
    if (/hold|held/i.test(c.name)) for (const n of claws) k[n] = [[0, [[X, 30]]], [d, [[X, 30]]]];
    if (c.kind === 'idle') {
      k.nose = wobble(d, Y, 4, 0.3).map(([t, p], i) => [t, i % 6 < 3 ? p : []]);
      /* he drums the claws of his left paw */
      ['clawL3', 'clawL2', 'clawL1'].forEach((n, i) => { const t0 = d * 0.55 + i * 0.09; k[n] = t0 + 0.2 < d ? [[0, []], [t0, []], [t0 + 0.05, [[X, -22]]], [t0 + 0.12, []], [d, []]] : [[0, []], [d, []]]; });
    }
  }
  return k;
}

export default { in: 'assets/hod/export/hod-v1.glb', out: 'assets/hod/export/hod-b.glb', manifest: ['Hod'], bones, weights, springs, keys };
