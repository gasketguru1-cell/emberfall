// Hod: 27 bones on top of his 21, placed on the owner's model of 2026-11-12 (low-slung, tail along the floor). Fourteen of
// his leaf scales get their own bones, so the coat ripples on springs and flares up when he strikes; the three cream crest
// leaves on his head (two side leaves and the blaze) swing and pin back; eyes, snout and belly; three claws on each fore paw.
import * as THREE from 'three';
import { sphere, capsule, half, all, pulse, blinks, wobble } from './_lib.mjs';
const BODY = ['hips', 'spine', 'chest', 'neck', 'head', 'fl_upper', 'fr_upper', 'rl_upper', 'rr_upper', 'fl_lower', 'fr_lower', 'rl_lower', 'rr_lower', 'tail1'];
const scaleCol = (p, G) => (G.hsv[1] > 0.55 && G.hsv[0] < 30 ? 1 : 0.12), white = (p, G) => (G.hsv[1] < 0.3 && G.hsv[2] > 0.55 ? 1 : 0.15);
const cream = (p, G) => (G.hsv[0] > 22 && G.hsv[0] < 52 && G.hsv[1] > 0.18 && G.hsv[1] < 0.62 && G.hsv[2] > 0.55 ? 1 : 0.1);
const EYE = { L: [0.075, 0.335, 0.585], R: [-0.075, 0.335, 0.585] }, MID = 0.42;   /* MID: the body's middle height, for which way "out" is */

/* the scale plates: name, parent, base, tip, centre of the patch it carries, size (measured on the coat by colour) */
const PLATES = [
  ['crown', 'chest', [0, 0.6, 0.42], [0, 0.68, 0.3], [0, 0.65, 0.36], 0.06],
  ['ridge1', 'chest', [0, 0.68, 0.2], [0, 0.74, 0.06], [0, 0.7, 0.12], 0.08],
  ['ridge2', 'spine', [0, 0.7, -0.08], [0, 0.72, -0.24], [0, 0.71, -0.15], 0.08],
  ['ridge3', 'hips', [0, 0.64, -0.32], [0, 0.6, -0.5], [0, 0.63, -0.4], 0.08],
];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) PLATES.push(
  ['neck' + k, 'chest', [0.13 * s, 0.52, 0.4], [0.2 * s, 0.6, 0.32], [0.16 * s, 0.55, 0.36], 0.05],
  ['upper' + k, 'spine', [0.18 * s, 0.62, 0.08], [0.28 * s, 0.62, -0.06], [0.23 * s, 0.62, 0.02], 0.07],
  ['shoulder' + k, k === 'L' ? 'fl_upper' : 'fr_upper', [0.22 * s, 0.5, 0.3], [0.32 * s, 0.42, 0.24], [0.26 * s, 0.47, 0.28], 0.07],
  ['flankF' + k, k === 'L' ? 'fl_upper' : 'fr_upper', [0.3 * s, 0.5, 0.1], [0.4 * s, 0.4, 0.03], [0.34 * s, 0.46, 0.07], 0.07],
  ['flankR' + k, k === 'L' ? 'rl_upper' : 'rr_upper', [0.28 * s, 0.42, -0.24], [0.32 * s, 0.3, -0.34], [0.3 * s, 0.37, -0.29], 0.07]);
/* three fore claws a paw: base and tip, from the light claw colour near the floor */
const CLAWS = [];
for (const [s, k] of [[1, 'L'], [-1, 'R']]) [[0.2, 0.44, 0.18, 0.53], [0.27, 0.44, 0.25, 0.56], [0.33, 0.45, 0.33, 0.53]].forEach(([x0, z0, x1, z1], i) =>
  CLAWS.push({ name: 'claw' + k + (i + 1), parent: k === 'L' ? 'fl_paw' : 'fr_paw', head: [x0 * s, 0.095, z0], tail: [x1 * s, 0.0, z1], k }));
/* the cream crest leaves: two at the sides of the head and the blaze up the middle */
const CREST = [
  { name: 'leafL', head: [0.07, 0.47, 0.5], tail: [0.16, 0.62, 0.44] },
  { name: 'leafR', head: [-0.07, 0.47, 0.5], tail: [-0.16, 0.62, 0.44] },
  { name: 'blaze', head: [0, 0.47, 0.6], tail: [0, 0.62, 0.5] }];

const bones = [
  { name: 'eyeL', parent: 'head', head: EYE.L, tail: [EYE.L[0], EYE.L[1], 0.63], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'head', head: EYE.R, tail: [EYE.R[0], EYE.R[1], 0.63], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'nose', parent: 'head', head: [0, 0.28, 0.6], tail: [0, 0.25, 0.68], why: 'the snout tip: sniffs while idle, wrinkles on a strike' },
  { name: 'belly', parent: 'spine', head: [0, 0.2, -0.02], tail: [0, 0.12, -0.05], why: 'the soft belly, jiggles on landings' },
  ...CREST.map(c => ({ name: c.name, parent: 'head', head: c.head, tail: c.tail, why: 'a cream crest leaf: swings on a spring, pins back on a strike' })),
  ...PLATES.map(([name, parent, head, tail]) => ({ name, parent, head, tail, why: 'a leaf scale: ripples on a spring, flares on a strike' })),
  ...CLAWS.map(c => ({ name: c.name, parent: c.parent, head: c.head, tail: c.tail, why: 'a fore claw: splays for the swipe, curls to grip' })),
];

const weights = [
  { bone: 'nose', from: ['head'], f: sphere([0, 0.26, 0.65], 0.03, 0.06) },
  { bone: 'eyeL', from: ['head'], f: sphere(EYE.L, 0.025, 0.045) },
  { bone: 'eyeR', from: ['head'], f: sphere(EYE.R, 0.025, 0.045) },
  ...CREST.map(c => ({ bone: c.name, from: BODY, f: (p, G) => capsule(c.head, c.tail, 0.035, 0.06)(p) * cream(p, G) })),
  { bone: 'belly', from: ['spine', 'chest', 'hips'], f: all(sphere([0, 0.14, 0.0], 0.1, 0.18), half([0, 0.22, 0], [0, -1, 0], 0.05)) },
  ...PLATES.map(([bone, , , , c, r]) => ({ bone, from: BODY, f: (p, G) => sphere(c, r, r * 1.9)(p) * scaleCol(p, G) })),
  ...CLAWS.map(c => ({ bone: c.name, from: [c.parent, c.parent.replace('paw', 'lower')], f: (p, G) => capsule(c.head, c.tail, 0.025, 0.045)(p) * white(p, G) })),
];

const PLATE = { k: 0.28, d: 0.72, max: 0.3, drag: 0.06 }, LEAF = { k: 0.32, d: 0.7, max: 0.4, drag: 0.08 };
const springs = [
  ...CREST.map(c => ({ bones: [c.name], ...LEAF })), { bones: ['belly'], k: 0.2, d: 0.78, max: 0.25, drag: 0.1 },
  ...PLATES.map(([n]) => ({ bones: [n], ...PLATE })),
];

/* a plate flares by lifting its tip away from the body */
const flareAxis = {};
for (const [n, , h, t] of PLATES) { const dir = new THREE.Vector3(...t).sub(new THREE.Vector3(...h)).normalize(), out = new THREE.Vector3(h[0], h[1] - MID, 0).normalize(); flareAxis[n] = dir.cross(out).normalize().toArray(); }
const X = [1, 0, 0], Y = [0, 1, 0];
const SHUT = [{ s: [1, 0.12, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], OPEN = [{ s: [1, 1, 1] }], WIDE = [{ s: [1.1, 1.2, 1.1] }];
const PIN = [[X, -22]], PERK = [[X, 14]];   /* crest leaves: laid back on a strike, raised when hit */

function keys(c) {
  const k = {}, d = c.dur, claws = CLAWS.map(x => x.name), crest = CREST.map(x => x.name);
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    const paw = /Swipe|Jab|Slam|Toss/.test(c.name);
    k.nose = pulse(s, c0, c1, e, [[X, -8]]);
    for (const sd of 'LR') k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, SQUINT, OPEN);
    for (const n of crest) k[n] = pulse(s, Math.max(s + 0.02, c0 - 0.06), c1, e, PIN);
    PLATES.forEach(([n], i) => { const lag = 0.012 * i; k[n] = pulse(Math.min(s + lag, c0 - 0.1), Math.min(s + 0.12 + lag, c0), c1, Math.min(d, e + 0.15), [[flareAxis[n], 28]]); });
    for (const n of claws) k[n] = paw ? pulse(s, c0 - 0.04, c1, e, [[X, -28]]) : pulse(s, c0, c1, e, [[X, 12]]);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    for (const sd of 'LR') k['eye' + sd] = [[0, OPEN], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]];
    for (const n of crest) k[n] = pulse(0, 0.06, t, d, PERK);
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
