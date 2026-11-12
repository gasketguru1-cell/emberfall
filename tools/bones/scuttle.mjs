// Scuttle (the hermit crab in a copper pot): 30 bones on top of his 9. Every one of his seven legs gets a shin and a foot,
// so they step, brace, tap and curl up when he's hit; the eye stalks wobble and the eyes blink and squint; his mouth,
// mandibles and throat move; the pot rattles on its own and its wire handle swings; the soft body bulging out of the pot
// jiggles; the tongs' jaws open and bite; the small claw flexes and snaps.
import { sphere, ellipsoid, capsule, half, all, not, pulse, blinks, wobble } from './_lib.mjs';
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const dark = (p, G) => (G.hsv[2] < 0.3 && G.hsv[1] < 0.5 ? 1 : 0);
const copper = (p, G) => (G.hsv[0] > 8 && G.hsv[0] < 42 && G.hsv[1] > 0.3 ? 1 : 0);
const C0 = -0.03;   // the face's middle (the eyes are at x 0.147 and -0.208)

/* the seven legs, measured on the mesh: knee (where the leg turns down), ankle, and the tip that touches the ground */
const LEGS = [
  { k: 'L1', parent: 'legL1', knee: [-0.6, 0.32, -0.11], ankle: [-0.682, 0.2, -0.086], tip: [-0.659, 0.05, -0.081] },
  { k: 'L2', parent: 'legL2', knee: [-0.577, 0.31, -0.372], ankle: [-0.665, 0.208, -0.438], tip: [-0.669, 0.05, -0.456] },
  { k: 'L3', parent: 'legL2', knee: [-0.463, 0.31, -0.574], ankle: [-0.451, 0.207, -0.658], tip: [-0.439, 0.05, -0.666] },
  { k: 'R1', parent: 'legR1', knee: [0.507, 0.31, -0.043], ankle: [0.585, 0.205, -0.002], tip: [0.591, 0.05, 0.02] },
  { k: 'R2', parent: 'legR1', knee: [0.577, 0.31, -0.296], ankle: [0.646, 0.205, -0.333], tip: [0.669, 0.05, -0.339] },
  { k: 'R3', parent: 'legR2', knee: [0.5, 0.31, -0.52], ankle: [0.545, 0.205, -0.575], tip: [0.542, 0.05, -0.58] },
  { k: 'R4', parent: 'legR2', knee: [0.37, 0.31, -0.64], ankle: [0.386, 0.207, -0.712], tip: [0.389, 0.05, -0.723] },
];
/* the axis that swings a leg's lower part out (+) or tucks it under (-): across the leg, level */
for (const L of LEGS) { const r = [L.tip[0], 0, L.tip[2] + 0.3], n = Math.hypot(r[0], r[2]); L.ax = [-r[2] / n, 0, r[0] / n]; }

const PIVOT = [0.46, 1.3, 0.71];   // the tongs' rivet
const LUG = [0, 1.03, -0.5], HTOP = [0, 1.49, -0.83];   // the handle's lugs (x ±0.45) and the top of its arc
const hn = (() => { const a = [0, HTOP[1] - LUG[1], HTOP[2] - LUG[2]], n = Math.hypot(a[1], a[2]); return [0, -a[2] / n, a[1] / n]; })();
const onHandle = p => (Math.abs((p.y - LUG[1]) * hn[1] + (p.z - LUG[2]) * hn[2]) < 0.05 && p.y > 0.95 ? 1 : 0);
const lug = p => (Math.abs(p.x) > 0.38 && p.y > 0.88 && p.y < 1.33 && p.z < -0.15 && p.z > -0.8 ? 1 : 0);
const EYE = { L: [0.147, 0.728, 0.251], R: [-0.208, 0.73, 0.258] };
const nearEye = p => Math.min(...Object.values(EYE).map(c => Math.hypot(p.x - c[0], p.y - c[1], p.z - c[2]))) < 0.09;

const bones = [
  { name: 'pot', parent: 'body', head: [0, 0.75, -0.25], tail: [0, 1.35, -0.4], why: 'the copper pot: rattles when he is hit, clanks when he lands or stamps' },
  { name: 'handle', parent: 'pot', head: LUG, tail: HTOP, why: 'the wire handle, swings on its lugs' },
  { name: 'humpF', parent: 'pot', head: [0, 1.17, -0.12], tail: [0, 1.32, -0.12], why: 'the soft body bulging out of the front of the pot, jiggles' },
  { name: 'humpB', parent: 'pot', head: [-0.05, 1.18, -0.48], tail: [-0.05, 1.34, -0.48], why: 'the soft body bulging out of the back of the pot, jiggles' },
  { name: 'stalkL', parent: 'body', head: [0.15, 0.6, 0.2], tail: [0.147, 0.68, 0.245], why: 'the left eye stalk: wobbles, leans in to aim, pulls back when hit' },
  { name: 'eyeL', parent: 'stalkL', head: [0.147, 0.68, 0.245], tail: [0.147, 0.78, 0.255], why: 'the left eye: blinks, squints on a strike, shuts when hit' },
  { name: 'stalkR', parent: 'body', head: [-0.2, 0.6, 0.2], tail: [-0.208, 0.68, 0.25], why: 'the right eye stalk: wobbles, leans in to aim, pulls back when hit' },
  { name: 'eyeR', parent: 'stalkR', head: [-0.208, 0.68, 0.25], tail: [-0.208, 0.78, 0.26], why: 'the right eye: blinks, squints on a strike, shuts when hit' },
  { name: 'mouth', parent: 'body', head: [C0, 0.575, 0.2], tail: [C0, 0.5, 0.24], why: 'the lower lip: drops open on attacks and when hit' },
  { name: 'mandL', parent: 'body', head: [C0 + 0.12, 0.52, 0.19], tail: [C0 + 0.13, 0.44, 0.23], why: 'the left mouthpart: chews, clacks, spreads on a strike' },
  { name: 'mandR', parent: 'body', head: [C0 - 0.12, 0.52, 0.19], tail: [C0 - 0.13, 0.44, 0.23], why: 'the right mouthpart: chews, clacks, spreads on a strike' },
  { name: 'throat', parent: 'body', head: [C0, 0.44, 0.15], tail: [C0, 0.36, 0.2], why: 'the chin under the mouth: breathes in and out' },
  { name: 'jawF', parent: 'tongs', head: PIVOT, tail: [0.46, 1.62, 0.9], why: 'the front jaw of the tongs: opens and bites' },
  { name: 'jawB', parent: 'tongs', head: PIVOT, tail: [0.46, 1.65, 0.77], why: 'the back jaw of the tongs: opens and bites' },
  { name: 'clawHand', parent: 'clawS', head: [-0.42, 0.38, 0.1], tail: [-0.4, 0.25, 0.25], why: 'the small claw\'s hand, cocks back and flexes' },
  { name: 'clawFinger', parent: 'clawHand', head: [-0.4, 0.25, 0.25], tail: [-0.37, 0.15, 0.37], why: 'the small claw\'s pincer, opens and snaps' },
];
for (const L of LEGS) bones.push(
  { name: 'shin' + L.k, parent: L.parent, head: L.knee, tail: L.ankle, why: 'leg ' + L.k + ', the shin: steps, braces, curls under when hit' },
  { name: 'foot' + L.k, parent: 'shin' + L.k, head: L.ankle, tail: L.tip, why: 'leg ' + L.k + ', the pointed foot: taps, flicks, digs in' });

const weights = [
  /* the pot: the copper (but not the orange eyes), the lugs, the handle, and the soft body showing in its mouth */
  { bone: 'pot', from: ['body'], f: (p, G) => (nearEye(p) ? 0 : Math.max(copper(p, G) * (p.y > 0.4 ? 1 : 0), dark(p, G) * lug(p), dark(p, G) * onHandle(p), p.y > 1.15 && p.z < 0.15 ? 1 : 0)) },
  { bone: 'handle', from: ['pot'], f: (p, G) => dark(p, G) * onHandle(p) * Math.min(1, Math.max(0, (p.y - 1.1) / 0.12)) },
  { bone: 'humpF', from: ['pot'], f: (p, G) => (1 - onHandle(p)) * (copper(p, G) ? 0 : 1) * sphere([0, 1.3, -0.12], 0.1, 0.22)(p) * (p.y > 1.2 ? 1 : 0) },
  { bone: 'humpB', from: ['pot'], f: (p, G) => (1 - onHandle(p)) * (copper(p, G) ? 0 : 1) * sphere([-0.05, 1.31, -0.48], 0.1, 0.22)(p) * (p.y > 1.2 ? 1 : 0) },
  { chain: ['stalkL', 'eyeL'], from: ['body'], f: all(capsule([0.15, 0.6, 0.2], [0.147, 0.73, 0.251], 0.05, 0.075), half([0, 0.6, 0], Y, 0.03), half([0, 0, 0.13], Z, 0.04)) },
  { chain: ['stalkR', 'eyeR'], from: ['body'], f: all(capsule([-0.2, 0.6, 0.2], [-0.208, 0.73, 0.258], 0.05, 0.075), half([0, 0.6, 0], Y, 0.03), half([0, 0, 0.13], Z, 0.04)) },
  { bone: 'mouth', from: ['body'], f: all(ellipsoid([C0, 0.53, 0.22], [0.1, 0.05, 0.09]), half([0, 0.578, 0], [0, -1, 0], 0.015)) },
  { bone: 'mandL', from: ['body'], f: all(ellipsoid([C0 + 0.14, 0.48, 0.2], [0.065, 0.07, 0.1]), half([C0 + 0.07, 0, 0], X, 0.03)) },
  { bone: 'mandR', from: ['body'], f: all(ellipsoid([C0 - 0.14, 0.48, 0.2], [0.065, 0.07, 0.1]), half([C0 - 0.07, 0, 0], [-1, 0, 0], 0.03)) },
  { bone: 'throat', from: ['body'], f: all(ellipsoid([C0, 0.39, 0.2], [0.12, 0.07, 0.1]), half([0, 0.45, 0], [0, -1, 0], 0.03)) },
  { bone: 'jawF', from: ['tongs'], f: all(half(PIVOT, Y, 0.06), half(PIVOT, [0, -0.13, 0.3], 0.03)) },
  { bone: 'jawB', from: ['tongs'], f: all(half(PIVOT, Y, 0.06), half(PIVOT, [0, 0.13, -0.3], 0.03)) },
  { chain: ['clawHand', 'clawFinger'], from: ['clawS'], f: all(capsule([-0.42, 0.38, 0.1], [-0.37, 0.15, 0.37], 0.1, 0.16), half([0, 0, 0.07], Z, 0.05)) },
];
for (const L of LEGS) weights.push({ chain: ['shin' + L.k, 'foot' + L.k], from: [L.parent], f: all(capsule(L.knee, L.tip, 0.07, 0.11), half([0, 0.34, 0], [0, -1, 0], 0.05)) });

const springs = [
  { bones: ['handle'], k: 0.2, d: 0.78, max: 0.35, drag: 0.04 },
  { bones: ['humpF'], k: 0.3, d: 0.65, max: 0.18, drag: 0.04 }, { bones: ['humpB'], k: 0.3, d: 0.65, max: 0.18, drag: 0.04 },
  { bones: ['stalkL'], k: 0.32, d: 0.68, max: 0.4, drag: 0.08 }, { bones: ['stalkR'], k: 0.32, d: 0.68, max: 0.4, drag: 0.08 },
];

/* a fading rattle: turns of +a, -a*0.7, +a*0.45 ... every step seconds from t0, clipped to the clip */
function rattle(t0, d, axis, a, step = 0.06, n = 5) {
  const out = [[0, []]]; if (t0 > 0.01) out.push([t0, []]);
  let amp = a; for (let i = 1; i <= n; i++) { const t = t0 + i * step; if (t >= d - 0.02) break; out.push([t, [[axis, amp]]]); amp *= -0.65; }
  const last = out[out.length - 1][0]; out.push([Math.min(d, last + step), []]); if (out[out.length - 1][0] < d) out.push([d, []]);
  return out.filter((k, i, A) => i === 0 || k[0] > A[i - 1][0] + 1e-6);
}
const SHUT = [{ s: [1, 0.2, 1] }], SQUINT = [{ s: [1, 0.6, 1] }], OPEN = [{ s: [1, 1, 1] }];
const legPose = (k, sh, ft) => { for (const L of LEGS) { k['shin' + L.k] = sh(L); k['foot' + L.k] = ft(L); } };
function keys(c) {
  const k = {}, d = c.dur;
  if (c.kind === 'attack') {
    const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25), w = Math.max(s + 0.02, c0 - 0.1);
    for (const sd of 'LR') { k['eye' + sd] = pulse(s, w, c1, e, SQUINT, OPEN); k['stalk' + sd] = pulse(s, w, c1, e, [[X, 12]]); }
    k.mouth = pulse(s, w, c1, e, [[X, 20]]);
    k.mandL = pulse(s, w, c1, e, [[Y, 22]]); k.mandR = pulse(s, w, c1, e, [[Y, -22]]);
    /* the tongs gape on the wind-up and bite shut on contact */
    k.jawF = [[0, []], [s, []], [w, [[X, 16]]], [c0, [[X, -3]]], [c1, [[X, -3]]], [e, []], [d, []]].filter((q, i, A) => i === 0 || q[0] > A[i - 1][0] + 1e-6);
    k.jawB = k.jawF.map(([t, pz]) => [t, pz.map(([a, v]) => [a, -v])]);
    k.clawHand = pulse(s, w, c1, e, [[X, -14]]);
    k.clawFinger = [[0, []], [s, []], [w, [[X, -30]]], [c0, [[X, 6]]], [c1, [[X, 6]]], [e, []], [d, []]].filter((q, i, A) => i === 0 || q[0] > A[i - 1][0] + 1e-6);
    /* the legs brace out and the feet dig in */
    legPose(k, L => pulse(s, w, c1, e, [[L.ax, 9]]), L => pulse(s, w, c1, e, [[L.ax, -12]]));
    if (/Stamp|Drop|Heave|Pop|Lift/.test(c.name)) k.pot = rattle(c0, d, X, 4, 0.07, 4);
  } else if (c.kind === 'hit') {
    const t = Math.min(0.22, d * 0.4);
    for (const sd of 'LR') { k['eye' + sd] = [[0, OPEN], [0.04, SHUT], [t, SHUT], [Math.min(d, t + 0.12), OPEN], [d, OPEN]]; k['stalk' + sd] = pulse(0, 0.05, t, Math.min(d, t + 0.18), [[X, -32]]); }
    k.mouth = pulse(0, 0.05, t, d, [[X, 26]]);
    k.mandL = pulse(0, 0.05, t, d, [[Y, 18]]); k.mandR = pulse(0, 0.05, t, d, [[Y, -18]]);
    k.jawF = pulse(0, 0.05, t, d, [[X, 12]]); k.jawB = pulse(0, 0.05, t, d, [[X, -12]]);
    k.clawFinger = pulse(0, 0.05, t, d, [[X, -22]]);
    /* the crab flinch: every leg curls under */
    legPose(k, L => pulse(0, 0.06, t, d, [[L.ax, -26]]), L => pulse(0, 0.06, t, d, [[L.ax, -30]]));
    k.pot = rattle(0.02, d, Z, 5, 0.06, 5);
  } else {
    if (c.kind === 'idle' || /Hang|Respawn|Held/.test(c.name)) for (const sd of 'LR') k['eye' + sd] = blinks(d, d > 1.6 ? [0.35, 0.82] : d > 0.6 ? [0.5] : [], SHUT, OPEN);
    if (/Scuttle|Dash/.test(c.name)) {
      /* a ripple of steps down each side, the two sides out of step */
      legPose(k, L => wobble(d, L.ax, 10, d, (+L.k[1]) * 0.25 + (L.k[0] === 'R' ? 0.5 : 0)), L => wobble(d, L.ax, 9, d, (+L.k[1]) * 0.25 + (L.k[0] === 'R' ? 0.5 : 0) + 0.25));
      k.mandL = wobble(d, Y, 6, d); k.mandR = wobble(d, Y, -6, d);
    } else if (/Fall|Rise|AirJump|FastFall|Helpless|Tumble/.test(c.name)) {
      legPose(k, L => [[0, [[L.ax, 10]]], [d, [[L.ax, 10]]]], L => [[0, [[L.ax, -18]]], [d, [[L.ax, -18]]]]);   // legs hang, toes curled
    } else if (/Land/.test(c.name)) {
      const h = /Hard/.test(c.name) ? 1.6 : 1;
      legPose(k, L => pulse(0, 0.05, 0.1, Math.min(d, 0.3), [[L.ax, 14 * h]]), L => pulse(0, 0.05, 0.1, Math.min(d, 0.3), [[L.ax, -10 * h]]));
      k.pot = rattle(0.03, d, X, 3.5 * h, 0.06, 4);
    } else if (/Crouch|Shield|Hold|Down/.test(c.name)) {
      legPose(k, L => [[0, [[L.ax, -12]]], [d, [[L.ax, -12]]]], L => [[0, [[L.ax, -8]]], [d, [[L.ax, -8]]]]);   // tucked in
    }
    if (c.kind === 'idle') {
      k.throat = [[0, OPEN], [d * 0.5, [{ s: [1.08, 1.12, 1.12] }]], [d, OPEN]];   // breathing
      const tap = (L, at) => { const t = d * at; if (t > 0.1 && t < d - 0.25) { k['foot' + L] = [[0, []], [t, []], [t + 0.07, [[LEGS.find(q => q.k === L).ax, 14]]], [t + 0.14, []], [t + 0.21, [[LEGS.find(q => q.k === L).ax, 10]]], [t + 0.28, []], [d, []]]; } };
      tap('R1', 0.25); tap('L2', 0.62);
      if (/Clack/.test(c.name)) {   // the tongs and the mouthparts clack together
        const ts = [0.2, 0.32, 0.44, 0.62, 0.74].map(f => f * d);
        const clack = a => { const o = [[0, []]]; for (const t of ts) o.push([t - 0.05, []], [t, [[X, a]]], [t + 0.05, []]); o.push([d, []]); return o; };
        k.jawF = clack(14); k.jawB = clack(-14);
        k.mandL = clack(0).map(([t, p]) => [t, p.length ? [[Y, 16]] : []]); k.mandR = clack(0).map(([t, p]) => [t, p.length ? [[Y, -16]] : []]);
      } else { k.mandL = wobble(d, Y, 5, d / 2); k.mandR = wobble(d, Y, -5, d / 2); }
    }
  }
  return k;
}

export default { in: 'assets/scuttle/export/scuttle-v1.glb', out: 'assets/scuttle/export/scuttle-b.glb', manifest: ['Scuttle'], bones, weights, springs, keys };
