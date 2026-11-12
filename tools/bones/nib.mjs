// Nib (the crimson hound, the owner's model of 2026-11-12): 11 bones on top of its 21. The face was measured on the mesh
// before its head was turned square (tools/blender/turn-head.py); turnHead below applies the same turn, so the points follow.
// Jaw, eyes and nose; the two little black ear spikes; and five locks of the (trimmed) white mane on springs, which
// bristle when it strikes.
import { sphere, capsule, half, all, pulse, blinks, wobble } from './_lib.mjs';
/* the same turn as turn-head.py (-79 degrees about x 0.06 z 0.3, fading in over y 1.0..1.18 and z -0.02..0.12) */
const sm = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const turnHead = ([x, y, z]) => { const th = -79 * Math.PI / 180 * sm(1.0, 1.18, y) * sm(-0.02, 0.12, z), rx = x - 0.06, rz = z - 0.3;
  return [0.06 + rx * Math.cos(th) + rz * Math.sin(th), y, 0.3 - rx * Math.sin(th) + rz * Math.cos(th)]; };
const F = [0, 0, 1], L = [1, 0, 0], U = [0, 1, 0];
const EYE = { L: turnHead([0.397, 1.3, 0.26]), R: turnHead([0.36, 1.305, 0.45]) }, NOSE = turnHead([0.461, 1.25, 0.367]);
const HINGE = turnHead([0.3, 1.17, 0.34]), CHIN = [0.07, 1.14, 0.68], MOUTH_Y = 1.175;
/* the two black ear spikes stick out sideways (measured on the turned mesh): base, tip */
const EAR = { L: [[0.22, 1.43, 0.44], [0.35, 1.4, 0.36]], R: [[-0.08, 1.45, 0.48], [-0.19, 1.44, 0.43]] }, BACK = { L: 35, R: -35 };   /* a turn about up that sweeps the tip back */
const HEAD = ['head', 'neck'], FUR = { k: 0.25, d: 0.74, max: 0.35, drag: 0.08 };
const white = (p, G) => (G.hsv[1] < 0.22 && G.hsv[2] > 0.62 ? 1 : 0.15), dark = (p, G) => (G.hsv[2] < 0.2 ? 1 : 0.2);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);

/* the mane's five locks (the two low chest clusters were too thin once trimmed to carry a bone): the middle of each (found by clustering the white fur), and the bone it hangs from. Each lock's
   bone runs out from the neck's core line through that middle. */
const CORE = [[0, 0.9, 0.28], [0.22, 1.35, 0.3]];
const onCore = c => { const ab = CORE[1].map((v, i) => v - CORE[0][i]), t = Math.max(0, Math.min(1, c.reduce((s, v, i) => s + (v - CORE[0][i]) * ab[i], 0) / ab.reduce((s, v) => s + v * v, 0))); return add(CORE[0], ab, t); };
const LOCKS = [['maneTop', [0.048, 1.401, 0.203], 'neck'], ['maneFront', [0.078, 1.249, 0.479], 'neck'], ['maneR', [-0.093, 1.222, 0.233], 'neck'],
  ['maneL', [0.198, 1.17, 0.127], 'neck'], ['maneBack', [0.011, 0.971, 0.071], 'chest']].map(([name, c, parent]) => {
  c = turnHead(c); const p = onCore(c), out = c.map((v, i) => v - p[i]);
  return { name, parent, c, head: add(p, out, 0.5), tail: add(add(p, out, 1.15), [0, -0.05, 0]) };
});

const bones = [
  { name: 'jaw', parent: 'head', head: HINGE, tail: CHIN, why: 'opens for the bite, the spit and a yelp when hit' },
  { name: 'eyeL', parent: 'head', head: EYE.L, tail: add(EYE.L, F, 0.05), why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'eyeR', parent: 'head', head: EYE.R, tail: add(EYE.R, F, 0.05), why: 'blinks; squints on a strike, shuts when hit' },
  { name: 'nose', parent: 'head', head: add(NOSE, F, -0.06), tail: NOSE, why: 'sniffs while it idles, wrinkles on a strike' },
  ...['L', 'R'].map(k => ({ name: 'ear' + k, parent: 'head', head: EAR[k][0], tail: EAR[k][1], why: 'a black ear spike: pins back on a strike, perks when hit' })),
  ...LOCKS.map(l => ({ name: l.name, parent: l.parent, head: l.head, tail: l.tail, why: 'a lock of the white mane: swings on a spring, bristles on a strike' })),
];

const weights = [
  { bone: 'jaw', from: HEAD, f: all(capsule(HINGE, CHIN, 0.03, 0.065), half([0, MOUTH_Y, 0], [0, -1, 0], 0.02)) },
  { bone: 'nose', from: HEAD, f: all(sphere(NOSE, 0.025, 0.055), half([0, MOUTH_Y + 0.02, 0], [0, 1, 0], 0.02)) },
  { bone: 'eyeL', from: HEAD, f: sphere(EYE.L, 0.04, 0.07) },
  { bone: 'eyeR', from: HEAD, f: sphere(EYE.R, 0.04, 0.07) },
  ...['L', 'R'].map(k => ({ bone: 'ear' + k, from: HEAD, f: (p, G) => capsule(EAR[k][0], EAR[k][1], 0.03, 0.07)(p) * dark(p, G) })),
  ...LOCKS.map(l => ({ bone: l.name, from: ['neck', 'chest', 'head', 'spine'], f: (p, G) => sphere(l.c, 0.08, 0.17)(p) * white(p, G) })),
];

const springs = [
  ...LOCKS.map(l => ({ bones: [l.name], ...FUR })),
  { bones: ['earL'], k: 0.4, d: 0.66, max: 0.3, drag: 0.06 }, { bones: ['earR'], k: 0.4, d: 0.66, max: 0.3, drag: 0.06 },
];

const OPEN = [{ s: [1, 1, 1] }], SHUT = [{ s: [1, 0.12, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], WIDE = [{ s: [1.1, 1.18, 1.1] }];
const BRISTLE = [{ s: [1.15, 1.15, 1.15] }];
function keys(c) {
  const k = {}, d = c.dur, locks = LOCKS.map(l => l.name);
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25);
    const bite = /Bite|Hold/.test(c.name), spit = /Spit/.test(c.name);
    k.jaw = bite ? [[0, []], [Math.max(0, c0 - 0.12), [[L, 26]]], [c0, [[L, 0]]], [c1 + 0.05, [[L, 4]]], [e, []]]
      : pulse(s, c0, c1, e, [[L, spit ? 28 : 12]]);
    for (const sd of 'LR') { k['eye' + sd] = pulse(s, c0 - 0.05, c1, e, SQUINT, OPEN); k['ear' + sd] = pulse(s, s + 0.08, c1, e, [[U, BACK[sd]]]); }
    k.nose = pulse(s, c0, c1, e, [[L, -8]]);
    locks.forEach((n, i) => { k[n] = pulse(Math.min(s + 0.01 * i, c0 - 0.08), c0, c1, Math.min(d, e + 0.12), BRISTLE, OPEN); });
  } else if (c.kind === 'hit') {
    const t = Math.min(0.3, d * 0.4);
    k.jaw = [[0, []], [0.06, [[L, 18]]], [t, [[L, 10]]], [d, []]];
    for (const sd of 'LR') { k['eye' + sd] = [[0, OPEN], [0.05, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]]; k['ear' + sd] = pulse(0, 0.06, t, d, [[U, -BACK[sd] * 0.6]]); }
    for (const n of locks) k[n] = pulse(0, 0.05, t, d, [{ s: [1.2, 1.2, 1.2] }], OPEN);
  } else {
    for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.2 ? [0.3, 0.8] : d > 0.6 ? [0.5] : [], SHUT, OPEN);
    if (c.kind === 'idle') {
      k.nose = wobble(d, U, 3, 0.35, 0, [[L, -2]]).map(([t, p], i) => [t, i % 4 < 2 ? p : [[L, 0]]]);
      k.earL = wobble(d, L, 8, d / 2).map(([t, p], i) => [t, i % 8 < 2 ? p : []]);   // a twitch now and then
    }
    if (/Run/.test(c.name)) k.jaw = [[0, [[L, 7]]], [d, [[L, 7]]]];   // panting
  }
  return k;
}

export default { in: 'assets/nib/export/nib-v1.glb', out: 'assets/nib/export/nib-b.glb', manifest: ['Nib'], bones, weights, springs, keys };
