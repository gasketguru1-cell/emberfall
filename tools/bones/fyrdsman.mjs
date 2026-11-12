// Fyrdsman: 30 bones on top of his 29.
//   face (5):    jaw (he roars on the big swings, grunts on the small ones), a two-link beard that wags after the jaw,
//                and two brows that knit for a strike and jump when he's hit
//   hair (2):    the braid down the back of his head gets two links of its own on springs
//   fur (3):     the wolf-fur mantle on his left shoulder splits into its front, back and outer edge, each on a spring
//   cloak (3):   the green cloak under the fur hung from his arm; now it hangs from his chest in three links and swings
//   skirt (5):   the two leather tassets over his thighs, the two halves of the back panel, and the bottom of the front
//                flap; they were stuck to his thighs, now they swing (half of each still follows the leg it covers)
//   shoulder (1): the leather plate on his right shoulder bounces
//   belly (1):   his gut jiggles on landings and when he's hit
//   hands (10):  each hand's single finger chain splits into the index and the ring-and-little fingers (two links each)
//                and the thumb gets a tip: the grip on the haft tightens on a strike, the right index taps the haft while
//                idle, the left beckons, a hand let go of the axe splays when he's hit
import { sphere, capsule, ellipsoid, half, all, pulse, wobble, clamp, smooth } from './_lib.mjs';
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const band = (v, a, b, s) => smooth((v - a) / s + 0.5) * smooth((b - v) / s + 0.5);
const bones = [], weights = [], springs = [];
const B = (name, parent, head, tail, why) => bones.push({ name, parent, head, tail, why });

/* ---- face ---- */
B('jaw', 'head', [0, 1.705, 0.04], [0, 1.625, 0.15], 'the jaw and the beard on it: a roar on the big swings, a grunt on the small ones');
weights.push({ bone: 'jaw', from: ['head'], f: p => band(p.y, 1.565, 1.703, 0.012) * smooth((p.z - 0.03) / 0.03 + 0.5) * smooth((0.11 - Math.abs(p.x)) / 0.03 + 0.5) });
B('beard1', 'jaw', [0, 1.645, 0.15], [0, 1.61, 0.155], 'the beard, upper half: wags after the jaw');
B('beard2', 'beard1', [0, 1.61, 0.155], [0, 1.57, 0.15], 'the beard\'s tip');
weights.push({ chain: ['beard1', 'beard2'], from: ['jaw'], f: p => smooth((1.65 - p.y) / 0.015 + 0.5) * smooth((p.z - 0.06) / 0.025 + 0.5) * smooth((0.075 - Math.abs(p.x)) / 0.025 + 0.5) });
springs.push({ bones: ['beard1', 'beard2'], k: 0.3, d: 0.7, max: 0.2, drag: 0.05 });
for (const [k, s] of [['L', 1], ['R', -1]]) {
  B('brow' + k, 'head', [0.02 * s, 1.76, 0.157], [0.075 * s, 1.765, 0.14], 'the brow: knits for a strike, jumps when he\'s hit');
  weights.push({ bone: 'brow' + k, from: ['head'], f: all(sphere([0.047 * s, 1.762, 0.152], 0.02, 0.038), half([0, 0, 0.1], Z, 0.02)) });
}

/* ---- the braid ---- */
B('braid1', 'hair', [0, 1.6, -0.2], [0, 1.55, -0.22], 'the braid, upper link: swings');
B('braid2', 'braid1', [0, 1.55, -0.22], [0, 1.49, -0.24], 'the braid\'s end: whips');
weights.push({ chain: ['braid1', 'braid2'], from: ['hair'], f: p => smooth((1.61 - p.y) / 0.025 + 0.5) });
springs.push({ bones: ['braid1', 'braid2'], k: 0.24, d: 0.72, max: 0.5, drag: 0.1 });

/* ---- the fur mantle (all on his left shoulder) ---- */
B('furOut', 'fur', [0.3, 1.64, -0.03], [0.41, 1.57, -0.05], 'the mantle\'s outer edge over the arm: flops');
weights.push({ bone: 'furOut', from: ['fur'], f: p => smooth((p.x - 0.31) / 0.03 + 0.5) });
B('furF', 'fur', [0.22, 1.66, 0.03], [0.25, 1.58, 0.14], 'the mantle\'s front over the chest: bounces');
weights.push({ bone: 'furF', from: ['fur'], f: p => smooth((p.z - 0.04) / 0.03 + 0.5) });
B('furB', 'fur', [0.22, 1.66, -0.09], [0.22, 1.58, -0.24], 'the mantle\'s back over the shoulder blade: bounces');
weights.push({ bone: 'furB', from: ['fur'], f: p => smooth((-0.11 - p.z) / 0.03 + 0.5) });
springs.push({ bones: ['furOut'], k: 0.3, d: 0.68, max: 0.2, drag: 0.05 }, { bones: ['furF'], k: 0.32, d: 0.68, max: 0.15, drag: 0.04 }, { bones: ['furB'], k: 0.32, d: 0.68, max: 0.15, drag: 0.04 });

/* ---- the green cloak under the fur: off the arm, onto the chest ---- */
const green = (p, G) => (G.hsv[0] > 80 && G.hsv[0] < 200 && G.hsv[1] > 0.15 ? 1 : 0);
B('cloak1', 'chest', [0.26, 1.5, -0.2], [0.27, 1.4, -0.25], 'the cloak under the fur, top: swings');
B('cloak2', 'cloak1', [0.27, 1.4, -0.25], [0.28, 1.31, -0.27], 'the cloak, middle');
B('cloak3', 'cloak2', [0.28, 1.31, -0.27], [0.29, 1.21, -0.29], 'the cloak\'s hem: trails');
weights.push({ chain: ['cloak1', 'cloak2', 'cloak3'], from: ['armL', 'spine', 'chest'], loose: ['armL', 'spine'], s: 0.8, f: (p, G) => green(p, G) * band(p.y, 1.2, 1.52, 0.02) * smooth((p.x - 0.09) / 0.02 + 0.5) * smooth((0.01 - p.z) / 0.02 + 0.5) });
springs.push({ bones: ['cloak1', 'cloak2', 'cloak3'], k: 0.24, d: 0.72, max: 0.4, drag: 0.1 });

/* ---- the leather skirt ---- */
/* how far a point stands off the thigh it covers (the tassets hang 15 cm and more off its line, the trousers closer) */
const off = s => p => { const A = [0.13 * s, 0.9, 0], D = [0.07 * s, -0.38, 0.06], L = Math.hypot(...D), u = D.map(v => v / L), r = [p.x - A[0], p.y - A[1], p.z - A[2]], t = r[0] * u[0] + r[1] * u[1] + r[2] * u[2]; return Math.hypot(r[0] - t * u[0], r[1] - t * u[1], r[2] - t * u[2]); };
for (const [k, s, thigh] of [['L', 1, 'thighL'], ['R', -1, 'thighR']]) {
  const o = off(s);
  B('tasset' + k, 'hips', [0.17 * s, 0.93, 0.2], [0.22 * s, 0.6, 0.2], 'the leather tasset over his thigh: swings, and still half-follows the leg');
  weights.push({ bone: 'tasset' + k, from: [thigh], loose: [thigh], s: 0.55, f: p => band(p.y, 0.58, 0.94, 0.02) * smooth((o(p) - 0.15) / 0.02 + 0.5) * smooth((p.z - 0.04) / 0.03 + 0.5) * smooth((p.x * s - 0.07) / 0.02 + 0.5) });
  B('flapB' + k, 'flapB', [0.1 * s, 0.86, -0.22], [0.16 * s, 0.58, -0.27], 'the back panel\'s ' + (k === 'L' ? 'left' : 'right') + ' half: swings on its own');
  weights.push({ bone: 'flapB' + k, from: ['flapB', thigh], loose: [thigh], s: 0.7, f: p => band(p.y, 0.56, 0.9, 0.02) * smooth((-0.12 - p.z) / 0.03 + 0.5) * smooth((p.x * s - 0.02) / 0.03 + 0.5) * smooth((o(p) - 0.17) / 0.02 + 0.5) });
  springs.push({ bones: ['tasset' + k], k: 0.26, d: 0.72, max: 0.35, drag: 0.1 }, { bones: ['flapB' + k], k: 0.26, d: 0.72, max: 0.35, drag: 0.1 });
}
B('flapF2', 'flapF', [0, 0.77, 0.17], [0, 0.63, 0.13], 'the front flap\'s lower half: flicks');
weights.push({ bone: 'flapF2', from: ['flapF'], f: p => smooth((0.78 - p.y) / 0.03 + 0.5) });
springs.push({ bones: ['flapF2'], k: 0.26, d: 0.7, max: 0.4, drag: 0.1 });

/* ---- shoulder plate, belly ---- */
B('pauldron', 'armR', [-0.25, 1.6, 0], [-0.42, 1.48, 0], 'the leather plate on his right shoulder: bounces');
weights.push({ bone: 'pauldron', from: ['armR', 'chest'], loose: ['chest'], f: p => smooth((p.y - 1.45) / 0.03 + 0.5) * smooth((-0.23 - p.x) / 0.02 + 0.5) });
springs.push({ bones: ['pauldron'], k: 0.34, d: 0.68, max: 0.1, drag: 0.03 });
B('belly', 'spine', [0, 1.12, 0.16], [0, 1.08, 0.26], 'his gut: jiggles on landings and when he\'s hit');
weights.push({ bone: 'belly', from: ['spine', 'hips', 'chest'], loose: ['hips', 'chest'], f: all(ellipsoid([0, 1.11, 0.2], [0.17, 0.1, 0.12], 0.5), half([0, 0, 0.1], Z, 0.04)) });
springs.push({ bones: ['belly'], k: 0.24, d: 0.76, max: 0.15, drag: 0.08 });

/* ---- hands: fingers hang down at rest, across the hand from the little finger (near the body, back) to the index (out, front) ---- */
const W = { L: [0.73, 0, 0.68], R: [-0.73, 0, 0.68] };                  // across the hand, towards the index
const CURLAX = { L: [-0.73, 0, -0.68], R: [-0.73, 0, 0.68] };           // a turn about this closes the fingers into the palm
const SPLAYAX = { L: [-0.68, 0, 0.73], R: [-0.68, 0, -0.73] };          // a turn about this fans a finger to the index side
const across = k => p => (k === 'L' ? 1 : -1) * p.x * 0.73 + p.z * 0.68;   // 0.58 at the little finger, 0.79 at the index
for (const [k, s] of [['L', 1], ['R', -1]]) {
  const u = across(k);
  B('idx' + k + '1', 'fing' + k + '1', [0.84 * s, 0.95, 0.2], [0.85 * s, 0.875, 0.2], 'the index finger: points, taps, beckons, tightens on the haft');
  B('idx' + k + '2', 'idx' + k + '1', [0.85 * s, 0.875, 0.2], [0.85 * s, 0.82, 0.18], 'the index fingertip');
  B('low' + k + '1', 'fing' + k + '1', [0.74 * s, 0.95, 0.1], [0.75 * s, 0.875, 0.1], 'the ring and little fingers: clench, splay');
  B('low' + k + '2', 'low' + k + '1', [0.75 * s, 0.875, 0.1], [0.76 * s, 0.82, 0.11], 'the ring and little fingertips');
  weights.push({ bone: 'idx' + k + '1', from: ['fing' + k + '1'], f: p => smooth((u(p) - 0.737) / 0.012 + 0.5) });
  weights.push({ bone: 'low' + k + '1', from: ['fing' + k + '1'], f: p => smooth((0.683 - u(p)) / 0.012 + 0.5) });
  weights.push({ bone: 'idx' + k + '2', from: ['fing' + k + '2'], loose: ['fing' + k + '2'], f: p => smooth((u(p) - 0.737) / 0.012 + 0.5) });
  weights.push({ bone: 'low' + k + '2', from: ['fing' + k + '2'], loose: ['fing' + k + '2'], f: p => smooth((0.683 - u(p)) / 0.012 + 0.5) });
  B('thumb' + k + '2', 'thumb' + k, [0.72 * s, 1.01, 0.24], [0.72 * s, 0.99, 0.3], 'the thumb\'s tip: closes over the haft');
  weights.push({ bone: 'thumb' + k + '2', from: ['thumb' + k], f: p => smooth((p.z - 0.235) / 0.02 + 0.5) });
}

/* ---- keys ---- */
const curl = (k, d) => [[CURLAX[k], d]], splay = (k, d) => [[SPLAYAX[k], d]];
const BIG = /smash|Fsmash|Usmash|Dsmash|Meteor|Berserk|Throw|UpB|Counter/i;
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25), w = Math.max(s + 0.02, c0 - 0.06), big = BIG.test(c.name);
    k.jaw = pulse(s, c0, c1, e, [[X, big ? 20 : 9]]);
    for (const [sd, sg] of [['L', 1], ['R', -1]]) {
      k['brow' + sd] = pulse(Math.max(0, s - 0.05), s + 0.08, c1 + 0.05, Math.min(d, e + 0.1), [[Z, 14 * sg]]);
      for (const f of ['idx', 'low']) { k[f + sd + '1'] = pulse(s, w, c1, e, curl(sd, 14)); k[f + sd + '2'] = pulse(s, w, c1, e, curl(sd, 12)); }
      k['thumb' + sd + '2'] = pulse(s, w, c1, e, curl(sd, 15));
    }
  } else if (c.kind === 'hit') {
    const t = Math.min(0.25, d * 0.4);
    k.jaw = [[0, []], [0.05, [[X, 15]]], [t, [[X, 7]]], [d, []]];
    for (const [sd, sg] of [['L', 1], ['R', -1]]) k['brow' + sd] = pulse(0, 0.05, t, Math.min(d, t + 0.15), [[Z, -10 * sg]]);
    /* the left hand lets go and splays; the right keeps the axe */
    k.idxL1 = pulse(0, 0.05, t, d, [...splay('L', 10), ...curl('L', -12)]); k.lowL1 = pulse(0, 0.05, t, d, [...splay('L', -10), ...curl('L', -8)]);
    k.idxL2 = pulse(0, 0.05, t, d, curl('L', -8)); k.lowL2 = pulse(0, 0.05, t, d, curl('L', -6)); k.thumbL2 = pulse(0, 0.05, t, d, curl('L', -12));
  } else {
    if (/Beckon/.test(c.name)) { const n = 2; k.idxL1 = []; k.idxL2 = []; for (let i = 0; i <= n * 2; i++) { const t = d * i / (n * 2); k.idxL1.push([t, curl('L', i % 2 ? 55 : 0)]); k.idxL2.push([t, curl('L', i % 2 ? 50 : 0)]); } }
    if (c.kind === 'idle' && d > 1) {
      /* the right index drums twice on the haft */
      const t0 = d * 0.45; k.idxR1 = [[0, []], [t0, []], [t0 + 0.06, curl('R', -18)], [t0 + 0.12, []], [t0 + 0.2, curl('R', -18)], [t0 + 0.26, []], [d, []]];
      k.jaw = [[0, []], [d * 0.5, [[X, 2.5]]], [d, []]];   // breathing through the mouth
    }
  }
  return k;
}

export default { in: 'assets/vargan/export/vargan-v1.glb', out: 'assets/vargan/export/vargan-b.glb', manifest: ['Fyrdsman'], bones, weights, springs, keys };
