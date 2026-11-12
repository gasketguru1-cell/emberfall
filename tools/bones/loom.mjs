// Loom (the patchwork sprite, the owner's model of 2026-11-12): 14 bones on top of its 18. Eyes that blink and squint; the
// brass cross patch rattles; the cloud tuft is three puffs on springs; six petals of the leaf collar ripple and flare when it
// strikes; and each ember-rock foot swells as it lands a blow.
import { sphere, capsule, half, all, pulse, blinks, wobble } from './_lib.mjs';
const X = [1, 0, 0], Y = [0, 1, 0];
const white = (p, G) => (G.hsv[1] < 0.3 && G.hsv[2] > 0.5 ? 1 : 0.1), dark = (p, G) => (G.hsv[2] < 0.25 ? 1 : 0.2);
const gold = (p, G) => (G.hsv[0] > 25 && G.hsv[0] < 55 && G.hsv[1] > 0.4 ? 1 : 0.1);
const EYE = { L: [0.215, 1.33, 0.37], R: [-0.28, 1.33, 0.36] }, PATCH = [-0.05, 1.29, 0.42];
const FOOT = { L: [0.2, 0.23, 0], R: [-0.26, 0.23, -0.11] };
/* the three puffs of the cloud tuft: base, top */
const TUFT = [['tuft1', [-0.3, 1.68, 0.05], [-0.42, 1.8, 0.05]], ['tuft2', [-0.1, 1.76, 0.05], [-0.12, 1.94, 0.05]], ['tuft3', [0.06, 1.72, 0], [0.12, 1.86, 0]]];
/* six collar petals round the neck (the two sides between them are the wings): name, angle from the front */
const PETALS = [['petalF', 0], ['petalFL', 45], ['petalFR', -45], ['petalBL', 135], ['petalBR', -135], ['petalB', 180]].map(([n, a]) => {
  const r = a * Math.PI / 180, sx = Math.sin(r), cz = Math.cos(r);
  return { name: n, head: [0.12 * sx, 0.97, 0.12 * cz], tail: [0.3 * sx, 0.86, 0.3 * cz], up: [cz, 0, -sx] };   /* a turn about "up" with a negative angle lifts the petal */
});

const bones = [
  { name: 'eyeL', parent: 'body', head: EYE.L, tail: [EYE.L[0], EYE.L[1], 0.42], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'body', head: EYE.R, tail: [EYE.R[0], EYE.R[1], 0.42], why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'patch', parent: 'body', head: PATCH, tail: [PATCH[0], PATCH[1], 0.5], why: 'the brass cross patch: rattles when hit' },
  ...TUFT.map(([name, head, tail]) => ({ name, parent: 'top', head, tail, why: 'a puff of the cloud tuft: bobs on a spring' })),
  ...PETALS.map(p => ({ name: p.name, parent: 'body', head: p.head, tail: p.tail, why: 'a petal of the leaf collar: ripples, flares on a strike' })),
  ...['L', 'R'].map(k => ({ name: 'stone' + k, parent: 'rib' + k + '5', head: FOOT[k], tail: [FOOT[k][0], 0.12, FOOT[k][2]], why: 'the ember-rock foot: swells as it lands a blow' })),
];

const weights = [
  { bone: 'eyeL', from: ['body', 'top'], f: (p, G) => sphere(EYE.L, 0.05, 0.09)(p) * dark(p, G) },
  { bone: 'eyeR', from: ['body', 'top'], f: (p, G) => sphere(EYE.R, 0.05, 0.09)(p) * dark(p, G) },
  { bone: 'patch', from: ['body', 'top'], f: sphere(PATCH, 0.2, 0.3) },
  ...TUFT.map(([bone, h, t]) => ({ bone, from: ['top', 'body'], f: (p, G) => capsule(h, t, 0.07, 0.14)(p) * white(p, G) })),
  ...PETALS.map(pt => ({ bone: pt.name, from: ['body', 'wingL', 'wingR'], f: all(capsule(pt.head, pt.tail, 0.05, 0.1), half([0, 1.0, 0], [0, -1, 0], 0.03)) })),
  ...['L', 'R'].map(k => ({ bone: 'stone' + k, from: ['rib' + k + '5', 'rib' + k + '4'], f: all(sphere(FOOT[k], 0.13, 0.17), half([0, 0.33, 0], [0, -1, 0], 0.03)) })),
];

const PUFF = { k: 0.3, d: 0.7, max: 0.35, drag: 0.1 }, PETAL = { k: 0.28, d: 0.72, max: 0.4, drag: 0.1 };
const springs = [
  ...TUFT.map(([n]) => ({ bones: [n], ...PUFF })),
  ...PETALS.map(p => ({ bones: [p.name], ...PETAL })),
  { bones: ['patch'], k: 0.35, d: 0.7, max: 0.15, drag: 0.05 },
];

const SHUT = [{ s: [1, 0.1, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], OPEN = [{ s: [1, 1, 1] }], WIDE = [{ s: [1.12, 1.2, 1] }];
const SWELL = [{ s: [1.18, 1.18, 1.18] }], REST = [{ s: [1, 1, 1] }];
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    for (const sd of 'LR') k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, SQUINT, OPEN);
    PETALS.forEach((p, i) => { k[p.name] = pulse(Math.min(s + 0.015 * i, c0 - 0.08), c0, c1, Math.min(d, e + 0.1), [[p.up, -26]]); });
    /* the foot doing the work swells: both for the spins and the two-legged blows, the back one for BackLash */
    const feet = /BackLash/.test(c.name) ? ['R'] : /Lash|Flick|Hold/.test(c.name) ? ['L'] : ['L', 'R'];
    for (const f of feet) k['stone' + f] = pulse(Math.max(s, c0 - 0.06), c0, c1, Math.min(d, c1 + 0.12), SWELL, REST);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    for (const sd of 'LR') k['eye' + sd] = [[0, OPEN], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]];
    k.patch = wobble(d, [0, 0, 1], 6, 0.1).map(([t2, p]) => [t2, [[p[0][0], p[0][1] * Math.max(0, 1 - t2 / d)]]]);   // rattles on its rivets
    for (const [n] of TUFT) k[n] = pulse(0, 0.05, t, d, [{ s: [1.15, 0.8, 1.15] }], REST);   // the puffs squash
  } else {
    for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.6 ? [0.3, 0.8] : d > 0.6 ? [0.5] : [], SHUT, OPEN);
    if (c.kind === 'idle') TUFT.forEach(([n], i) => { k[n] = wobble(d, X, 5, d / 2, i * 0.3); });   // the tuft breathes
  }
  return k;
}

export default { in: 'assets/loom/export/loom-v1.glb', out: 'assets/loom/export/loom-b.glb', manifest: ['Loom'], bones, weights, springs, keys };
