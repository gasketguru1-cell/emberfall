// Writes the skeleton and animation spec for Chomp Chomp (assets/chomp/work/rig.json), which tools/blender/rig.py turns
// into a rigged, animated model, and adds his entry to the game's manifest.
//   bash tools/blender/build-chomp.sh     (runs this, then Blender, then the packer)
// He is a ball with a mouth (the owner's "Magma Munchkin" model, 2026-11-11: charcoal skin, glowing eyes, a furnace mouth,
// an antenna and four stubby legs): the top of his head and his jaw both hinge at the back of the mouth, so it can shut,
// grin or gape far wider than it was modelled. His weights are placed by rule (rig.py "weights"), not worked out by Blender.
// Everything here is picture only: the moves' timing, reach and damage live in sim.js and are not touched.
const fs = require('fs'), path = require('path');
const TEST = process.argv.includes('--test');   /* write the spec only, leave the manifest alone */
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] });
const HY = 0.78, HZ = -0.4;   /* the jaw hinge: height, forward */
const C = [0.95, 0];       /* the middle of the ball: height, forward */
/* The model has no brows or fins: a "brow" is the upper lid of his big glowing eye, a "fin" the glowing stud on his side and
   the cheek round it. His feet are his two front legs; the hind legs step opposite them (see hind() below). */
const side = (s, x) => [
  { name: 'eye' + s, head: [0.29 * x, 1.5, 0.35], tail: [0.29 * x, 1.5, 0.55], parent: 'top' },
  { name: 'brow' + s, head: [0.29 * x, 1.5, 0.4], tail: [0.29 * x, 1.5, 0.6], parent: 'eye' + s },
  { name: 'fin' + s, head: [0.6 * x, 0.8, 0.3], tail: [0.85 * x, 0.8, 0.42], parent: 'body' },
  { name: 'foot' + s, head: [0.57 * x, 0.3, 0.55], tail: [0.6 * x, 0.04, 0.72], parent: 'body' },
  { name: 'hind' + s, head: [0.8 * x, 0.3, -0.12], tail: [0.86 * x, 0.04, -0.08], parent: 'body' },
  { name: 'pupil' + s, head: [(x > 0 ? 0.15 : -0.11), 1.55, 0.55], tail: [(x > 0 ? 0.15 : -0.11), 1.55, 0.72], parent: 'eye' + s },
  { name: 'toe' + s, head: [0.52 * x, 0.1, 0.6], tail: [0.55 * x, 0.04, 0.78], parent: 'foot' + s },
  { name: 'hindToe' + s, head: [0.82 * x, 0.1, -0.13], tail: [0.98 * x, 0.04, -0.13], parent: 'hind' + s }];
/* A somersault for the whole-body bone: pitch it by deg (positive tips his face down) keeping the ball's middle in place; x, y, z then move him. */
const flip = (deg, x, y, z) => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [x || 0, C[0] - (C[0] * cs - C[1] * sn) + (y || 0), C[1] - (C[0] * sn + C[1] * cs) + (z || 0)] }; };
/* The mouth: 0 shut, 1 as modelled (wide open), up to about 1.8 for a gape no jaw should manage. */
/* (this model's lower lip sits just above his front legs, so the head does most of the shutting and the jaw little) */
/* shutting it: the head comes down 24 degrees, the jaw up 14, and the lips close the last of the gap */
const MC = { top: 26, jaw: 8, up: 0.09, dn: 0.18 };
/* The lips, on top of whatever mouth() set (so put lips() after mouth() in a pose): up/dn move the upper and lower lip up
   (+) or down; curl rolls them out (+, a pout or a flap) or in; then the corners: up (+, a smile) or down, and out (+, wider). */
const lips = (up, dn, curlU, curlD) => ({ lipU: { move: [0, up || 0, 0], rot: [-(curlU || 0), 0, 0] }, lipD: { move: [0, dn || 0, 0], rot: [curlD || 0, 0, 0] } });
const corners = (up, out, upR) => ({ cornerL: M(out || 0, up || 0, 0), cornerR: M(-(out || 0), upR === undefined ? (up || 0) : upR, 0) });
const mouth = g => g <= 1 ? { jaw: R(-MC.jaw * (1 - g)), top: R(MC.top * (1 - g)), lipU: { move: [0, -MC.up * (1 - g), 0], rot: [0, 0, 0] }, lipD: { move: [0, MC.dn * (1 - g), 0], rot: [0, 0, 0] } } : { jaw: R(26 * (g - 1)), top: R(-50 * (g - 1)), lipU: { move: [0, 0, 0], rot: [0, 0, 0] }, lipD: { move: [0, 0, 0], rot: [0, 0, 0] } };
/* Squash (k > 0) and stretch (k < 0) of the ball, with an optional lean: pitch, yaw, roll. */
const sq = (k, p, y, r) => ({ scale: [1 + k * 0.5, 1 - k, 1 + k * 0.5], rot: [p || 0, y || 0, r || 0] });
const lg = k => ({ scale: [1 - k * 0.35, 1 - k * 0.35, 1 + k], rot: [0, 0, 0] });   /* stretched along the way his mouth points: a lunge */
const puff = (w, h) => ({ scale: [w, h, w], rot: [0, 0, 0] });
const eyes = (w, h) => ({ eyeL: { scale: [w, h === undefined ? w : h, 1] }, eyeR: { scale: [w, h === undefined ? w : h, 1] } });
const eyes2 = (l, r) => ({ eyeL: { scale: [l, l, 1] }, eyeR: { scale: [r, r, 1] } });   /* one big, one small: dazed */
const brows = (dy, a) => ({ browL: { rot: [0, 0, (a || 0) * 0.6], move: [0, dy * 0.5, 0] }, browR: { rot: [0, 0, -(a || 0) * 0.6], move: [0, dy * 0.5, 0] } });   /* a > 0 scowls, a < 0 worries */
const fins = (up, fwd, upR) => ({ finL: R(0, -(fwd || 0), up), finR: R(0, fwd || 0, -(upR === undefined ? up : upR)) });
const leaves = (a, p, r) => ({ sprout: R(p || 0, 0, r || 0), leafL: R(0, 0, a), leafR: R(0, 0, -a) });   /* a > 0 lifts both leaves, a < 0 folds them down; p bends the sprout forward */
/* len is how far the tongue reaches as the old, short tongue measured it; this one lies the whole length of the mouth floor,
   so it stretches about a third as much for the same reach */
/* The pitch and swing are shared along its four links, so it curls rather than levering up from the back of the mouth,
   and the further it shoots out the more its tip curls up. */
const tongue = (len, yaw, pitch) => { const p = pitch === undefined ? -10 : pitch, y = yaw || 0, o = Math.max(0, Math.min(1.5, (len - 1) * 0.58 - 0.08)), f = v => +v.toFixed(2);
  return { tongue: { scale: [len > 2 ? 0.75 : 1, len > 2 ? 0.75 : 1, 1 + (len - 1) * 0.36], rot: [f(p * 0.3), f(y * 0.5), 0] },
    tongue2: R(f(p * 0.2 - 5 * o), f(y * 0.2)), tongue3: R(f(p * 0.25 - 9 * o), f(y * 0.25)), tongueTip: R(f(p * 0.25 - 16 * o), f(y * 0.35)) }; };
const feet = (ly, lz, ry, rz, out) => ({ footL: M(out || 0, ly, lz), footR: M(-(out || 0), ry === undefined ? ly : ry, rz === undefined ? lz : rz) });
const root = (x, y, z) => ({ root: M(x, y, z) });
/* Parts of a pose, later ones winning, except that the lips' moves add up: lips() moves them on from where mouth() put them. */
const ADD = new Set(['lipU', 'lipD']);
const P = (...parts) => parts.reduce((o, p) => { for (const k in p) { const a = o[k], b = p[k];
  o[k] = ADD.has(k) && a && a.move && b && b.move ? Object.assign({}, a, b, { move: a.move.map((v, i) => +(v + b.move[i]).toFixed(4)) }) : b; } return o; }, {});
const S = 'stand';
/* the shared attack layout: wind-up held to 0.3, the strike arrives at 0.34, is held to 0.44, overshoots at 0.56, settled by 0.9 */
const atk = (wind, hit, over, extra) => [{ t: 0, use: S }, { t: 0.2, pose: wind, in: 'out' }, { t: 0.3, pose: wind }, { t: 0.34, reset: true, use: S, pose: hit, in: 'snap' }, { t: 0.44, pose: hit }, { t: 0.56, pose: over, in: 'back' }, ...(extra || []), { t: 0.9, reset: true, use: S, in: 'quad' }];
/* throws: the game lets go on its 10th frame of 26, 0.38 of the way through */
const thr = (wind, hit, over) => [{ t: 0, use: S, pose: P(mouth(0.4), root(0, 0, 0.1)) }, { t: 0.2, pose: wind, in: 'out' }, { t: 0.32, pose: wind }, { t: 0.38, reset: true, use: S, pose: hit, in: 'snap' }, { t: 0.5, pose: hit }, { t: 0.65, pose: over, in: 'back' }, { t: 1.0, reset: true, use: S, in: 'quad' }];
/* whole turns at an even speed, in steps under 180 degrees so each goes the right way round */
const turns = (kind, from, to, t0, t1, pose) => { const n = Math.ceil(Math.abs(to - from) / 150), keys = []; for (let i = 1; i <= n; i++) { const d = from + (to - from) * i / n; keys.push({ t: +(t0 + (t1 - t0) * i / n).toFixed(3), pose: P(pose || {}, { all: kind === 'flip' ? flip(d) : R(0, d, 0) }), in: 'lin' }); } return keys; };
const waddle = (() => { const keys = [], n = 6, dt = 0.2;   /* six steps: the game plays the clip once per 40 units walked */
  for (let i = 0; i <= n; i++) { const s = i % 2 ? 1 : -1;
    keys.push({ t: +(i * dt).toFixed(2), reset: true, use: S, pose: P({ body: sq(0.06, 4, s * 6, s * 11) }, mouth(0), lips(0, -0.02, 0, 10), corners(s * 0.015, 0, -s * 0.015), fins(s * 22, 0, -s * 22), leaves(8, 0, -s * 16), feet(s > 0 ? 0 : 0.02, s > 0 ? 0.14 : -0.12, s > 0 ? 0.02 : 0, s > 0 ? -0.12 : 0.14), eyes(1.05, 0.8)) });
    if (i < n) keys.push({ t: +(i * dt + dt / 2).toFixed(2), reset: true, use: S, pose: P({ body: sq(-0.05, 4, 0, 0) }, root(0, 0.07, 0), mouth(0), lips(0, 0.01, 0, -4), corners(0), fins(0), leaves(-6), feet(s > 0 ? 0.02 : 0.13, 0, s > 0 ? 0.13 : 0.02, 0)) }); }
  return keys; })();
const scamper = (() => { const keys = [], n = 8, dt = 0.1;   /* eight steps per 46 units run */
  for (let i = 0; i <= n; i++) { const s = i % 2 ? 1 : -1;
    keys.push({ t: +(i * dt).toFixed(2), reset: true, use: S, pose: P({ all: flip(20), body: sq(i % 2 ? 0.08 : -0.04, 0, 0, s * 5) }, root(0, i % 2 ? 0 : 0.06, 0), ...(i % 2 ? [mouth(0.8), lips(0, -0.04, 10, 18), tongue(1.6, s * 22, -24)] : [mouth(0.12), lips(0, 0, -6, 6), tongue(1, 0)]), corners(0.02, 0.03), eyes(1.2), brows(0.03), fins(26, -62), leaves(-30, -34, s * 8), feet(s > 0 ? 0 : 0.12, s > 0 ? 0.2 : -0.2, s > 0 ? 0.12 : 0, s > 0 ? -0.2 : 0.2)) }); }
  return keys; })();
const shieldPose = P({ body: puff(1.08, 0.94) }, mouth(0), lips(-0.02, 0.02, -10, -10), corners(-0.03, 0.04), eyes(1.25, 0.2), brows(-0.03, 16), fins(10, 70), leaves(-58));
const chomp = {
  note: 'Chomp Chomp: metres after prep (feet on y = 0, facing +Z). Joint positions were measured from the generated mesh.',
  prep: { yaw: 0, translate: [0, 0.953, 0] },
  bones: [
    { name: 'all', head: [0, 0, 0], tail: [0, 0.15, 0], parent: null, deform: false },
    { name: 'root', head: [0, 0.6, 0], tail: [0, 0.8, 0], parent: 'all', deform: false },
    { name: 'body', head: [0, 0.2, 0], tail: [0, 0.75, 0], parent: 'root' },
    { name: 'top', head: [0, HY, HZ], tail: [0, 1.45, 0.2], parent: 'body' },
    { name: 'jaw', head: [0, HY, HZ], tail: [0, 0.3, 0.55], parent: 'body' },
    { name: 'tongue', head: [0, 0.45, -0.42], tail: [0, 0.5, 0.5], parent: 'jaw' },
    /* the antenna takes the old leaf sprout's moves and spring; the leaf bones stay so old poses still load, but weigh nothing */
    { name: 'sprout', head: [0, 1.55, 0], tail: [0.08, 1.68, 0], parent: 'top' },
    /* ---- the 30 detail bones (2026-11-11) ---- */
    /* the antenna in three more links, so it curls and whips instead of swinging stiff */
    { name: 'sprout2', head: [0.08, 1.68, 0], tail: [0.12, 1.75, 0], parent: 'sprout' },
    { name: 'sprout3', head: [0.12, 1.75, 0], tail: [0.14, 1.8, 0], parent: 'sprout2' },
    { name: 'bulb', head: [0.14, 1.8, 0], tail: [0.16, 1.9, 0], parent: 'sprout3' },
    /* the body's soft parts: they lag, bulge and settle behind the big moves */
    { name: 'belly', head: [0, 0.3, 0.05], tail: [0, 0.15, 0.3], parent: 'body' },
    { name: 'back', head: [0, 0.9, -0.4], tail: [0, 0.9, -0.75], parent: 'body' },
    { name: 'haunchL', head: [0.6, 0.42, -0.15], tail: [0.85, 0.42, -0.15], parent: 'body' },
    { name: 'haunchR', head: [-0.6, 0.42, -0.15], tail: [-0.85, 0.42, -0.15], parent: 'body' },
    { name: 'cheekL', head: [0.6, 0.95, 0.1], tail: [0.9, 0.95, 0.15], parent: 'body' },
    { name: 'cheekR', head: [-0.6, 0.95, 0.1], tail: [-0.9, 0.95, 0.15], parent: 'body' },
    { name: 'crown', head: [0, 1.35, -0.1], tail: [0, 1.6, -0.1], parent: 'top' },
    { name: 'chin', head: [0, 0.3, 0.35], tail: [0, 0.15, 0.6], parent: 'jaw' },
    /* the face: the dark ridge between his eyes and the eyelids above them (the pupils are in side()) */
    { name: 'ridge', head: [0, 1.3, 0.45], tail: [0, 1.3, 0.75], parent: 'top' },
    { name: 'lidL', head: [0.29, 1.62, 0.3], tail: [0.29, 1.76, 0.45], parent: 'top' },
    { name: 'lidR', head: [-0.29, 1.62, 0.3], tail: [-0.29, 1.76, 0.45], parent: 'top' },
    /* the tongue in four links: it curls, ripples and flicks at the tip */
    { name: 'tongue2', head: [0, 0.5, 0], tail: [0, 0.52, 0.25], parent: 'tongue' },
    { name: 'tongue3', head: [0, 0.52, 0.25], tail: [0, 0.5, 0.4], parent: 'tongue2' },
    { name: 'tongueTip', head: [0, 0.5, 0.4], tail: [0, 0.48, 0.52], parent: 'tongue3' },
    { name: 'leafL', head: [0.02, 1.8, 0], tail: [0.2, 1.85, 0], parent: 'sprout', deform: false },
    { name: 'leafR', head: [-0.02, 1.8, 0], tail: [-0.2, 1.85, 0], parent: 'sprout', deform: false },
    /* lips: the rim of the mouth, so it can seal, pout, curl, sneer or flap on its own */
    { name: 'lipU', head: [0, 1.18, 0.4], tail: [0, 1.18, 0.75], parent: 'top' },
    { name: 'lipD', head: [0, 0.38, 0.4], tail: [0, 0.38, 0.72], parent: 'jaw' },
    /* each lip split in halves for sneers and lopsided grins, and the three glowing fangs */
    { name: 'lipUL', head: [0.25, 1.15, 0.45], tail: [0.3, 1.15, 0.72], parent: 'lipU' },
    { name: 'lipUR', head: [-0.25, 1.15, 0.45], tail: [-0.3, 1.15, 0.72], parent: 'lipU' },
    { name: 'lipDL', head: [0.22, 0.4, 0.45], tail: [0.25, 0.4, 0.7], parent: 'lipD' },
    { name: 'lipDR', head: [-0.22, 0.4, 0.45], tail: [-0.25, 0.4, 0.7], parent: 'lipD' },
    { name: 'fangL', head: [0.31, 1.22, 0.55], tail: [0.31, 1.1, 0.66], parent: 'lipUL' },
    { name: 'fangR', head: [-0.3, 1.22, 0.55], tail: [-0.3, 1.1, 0.66], parent: 'lipUR' },
    { name: 'fangD', head: [0, 0.22, 0.6], tail: [0, 0.34, 0.7], parent: 'lipD' },
    { name: 'cornerL', head: [0.55, 0.8, 0.35], tail: [0.7, 0.8, 0.5], parent: 'body' },
    { name: 'cornerR', head: [-0.55, 0.8, 0.35], tail: [-0.7, 0.8, 0.5], parent: 'body' },
    ...side('L', 1), ...side('R', -1)],
  weights: [
    { bone: 'body', all: true },
    { bone: 'belly', sphere: { c: [0, 0.22, 0.05], r0: 0.45, r1: 1, scale: [0.55, 0.24, 0.5] } },
    { bone: 'back', sphere: { c: [0, 0.95, -0.62], r0: 0.4, r1: 1, scale: [0.7, 0.6, 0.32] } },
    { bone: 'haunchL', sphere: { c: [0.82, 0.4, -0.15], r0: 0.3, r1: 1, scale: [0.28, 0.26, 0.3] } }, { bone: 'haunchR', sphere: { c: [-0.82, 0.4, -0.15], r0: 0.3, r1: 1, scale: [0.28, 0.26, 0.3] } },
    { bone: 'cheekL', sphere: { c: [0.85, 0.98, 0.1], r0: 0.4, r1: 1, scale: [0.22, 0.32, 0.42] } }, { bone: 'cheekR', sphere: { c: [-0.85, 0.98, 0.1], r0: 0.4, r1: 1, scale: [0.22, 0.32, 0.42] } },
    { bone: 'top', wedge: { hinge: [HY, HZ], from: [0, 8, 60], to: [150, 50], side: [0.62, 0.1], fade: [0.72, 0.25] } },
    { bone: 'crown', sphere: { c: [0, 1.55, -0.15], r0: 0.45, r1: 1, scale: [0.55, 0.25, 0.45] } },
    { bone: 'jaw', wedge: { hinge: [HY, HZ], from: [-75, 25], to: [0, 8, 60], side: [0.62, 0.1], fade: [0.72, 0.25] } },
    { bone: 'chin', sphere: { c: [0, 0.15, 0.58], r0: 0.45, r1: 1, scale: [0.32, 0.14, 0.2] } },
    { bone: 'tongue', sphere: { c: [0, 0.48, 0.06], r0: 0.8, r1: 0.96, scale: [0.36, 0.2, 0.48] }, halves: [[2, 0.5, 0.06, -1], [1, 0.38, 0.05, 1]] },
    { bone: 'tongue2', sphere: { c: [0, 0.48, 0.06], r0: 0.8, r1: 0.96, scale: [0.36, 0.2, 0.48] }, halves: [[2, 0.5, 0.06, -1], [1, 0.38, 0.05, 1], [2, -0.02, 0.1, 1]] },
    { bone: 'tongue3', sphere: { c: [0, 0.48, 0.06], r0: 0.8, r1: 0.96, scale: [0.36, 0.2, 0.48] }, halves: [[2, 0.5, 0.06, -1], [1, 0.38, 0.05, 1], [2, 0.22, 0.08, 1]] },
    { bone: 'tongueTip', sphere: { c: [0, 0.48, 0.06], r0: 0.8, r1: 0.96, scale: [0.36, 0.2, 0.48] }, halves: [[2, 0.5, 0.06, -1], [1, 0.38, 0.05, 1], [2, 0.38, 0.06, 1]] },
    { bone: 'lipU', wedge: { hinge: [HY, HZ], from: [9, 7], to: [27, 8], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.42, 0.12, 1]] },
    { bone: 'lipUL', wedge: { hinge: [HY, HZ], from: [9, 7], to: [27, 8], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.42, 0.12, 1], [0, 0.1, 0.22, 1]] }, { bone: 'lipUR', wedge: { hinge: [HY, HZ], from: [9, 7], to: [27, 8], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.42, 0.12, 1], [0, -0.1, 0.22, -1]] },
    /* the lower lip: its middle dips almost to the floor between the front legs, its sides rise clear of them */
    { bone: 'lipD', wedge: { hinge: [HY, HZ], from: [-36, 10], to: [-9, 7], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.46, 0.06, 1], [1, 0.46, 0.12, 1]] },
    { bone: 'lipD', wedge: { hinge: [HY, HZ], from: [-40, 10], to: [-9, 7] }, halves: [[2, 0.5, 0.06, 1], [1, 0.16, 0.06, 1]], sphere: { c: [0, 0.3, 0.6], r0: 0.75, r1: 1, scale: [0.36, 0.6, 0.6] } },
    { bone: 'lipDL', wedge: { hinge: [HY, HZ], from: [-36, 10], to: [-9, 7], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.46, 0.06, 1], [1, 0.46, 0.12, 1], [0, 0.1, 0.22, 1]] }, { bone: 'lipDR', wedge: { hinge: [HY, HZ], from: [-36, 10], to: [-9, 7], side: [0.62, 0.1], fade: [0.7, 0.15] }, halves: [[2, 0.46, 0.06, 1], [1, 0.46, 0.12, 1], [0, -0.1, 0.22, -1]] },
    { bone: 'lipDL', wedge: { hinge: [HY, HZ], from: [-40, 10], to: [-9, 7] }, halves: [[2, 0.5, 0.06, 1], [1, 0.16, 0.06, 1], [0, 0.1, 0.2, 1]], sphere: { c: [0, 0.3, 0.6], r0: 0.75, r1: 1, scale: [0.36, 0.6, 0.6] } }, { bone: 'lipDR', wedge: { hinge: [HY, HZ], from: [-40, 10], to: [-9, 7] }, halves: [[2, 0.5, 0.06, 1], [1, 0.16, 0.06, 1], [0, -0.1, 0.2, -1]], sphere: { c: [0, 0.3, 0.6], r0: 0.75, r1: 1, scale: [0.36, 0.6, 0.6] } },
    { bone: 'fangL', sphere: { c: [0.31, 1.165, 0.63], r0: 0.045, r1: 0.065 } }, { bone: 'fangR', sphere: { c: [-0.3, 1.165, 0.63], r0: 0.045, r1: 0.065 } },
    { bone: 'fangD', sphere: { c: [0, 0.27, 0.67], r0: 0.04, r1: 0.06 } },
    { bone: 'ridge', sphere: { c: [0, 1.34, 0.68], r0: 0.4, r1: 1, scale: [0.22, 0.09, 0.16] } },
    { bone: 'lidL', sphere: { c: [0.29, 1.76, 0.4], r0: 0.4, r1: 1, scale: [0.3, 0.1, 0.26] } }, { bone: 'lidR', sphere: { c: [-0.29, 1.76, 0.4], r0: 0.4, r1: 1, scale: [0.3, 0.1, 0.26] } },
    { bone: 'cornerL', sphere: { c: [0.64, 0.8, 0.45], r0: 0.1, r1: 0.24, scale: [1, 1.6, 1] } }, { bone: 'cornerR', sphere: { c: [-0.64, 0.8, 0.45], r0: 0.1, r1: 0.24, scale: [1, 1.6, 1] } },
    { bone: 'eyeL', sphere: { c: [0.29, 1.5, 0.52], r0: 0.85, r1: 1, scale: [0.3, 0.22, 0.24] } }, { bone: 'eyeR', sphere: { c: [-0.29, 1.5, 0.52], r0: 0.85, r1: 1, scale: [0.3, 0.22, 0.24] } },
    { bone: 'browL', sphere: { c: [0.29, 1.52, 0.52], r0: 0.95, r1: 1.05, scale: [0.32, 0.24, 0.26] }, halves: [[1, 1.6, 0.06, 1]] },
    { bone: 'browR', sphere: { c: [-0.29, 1.52, 0.52], r0: 0.95, r1: 1.05, scale: [0.32, 0.24, 0.26] }, halves: [[1, 1.6, 0.06, 1]] },
    { bone: 'pupilL', sphere: { c: [0.15, 1.55, 0.68], r0: 0.055, r1: 0.075, scale: [1, 1, 1.6] } }, { bone: 'pupilR', sphere: { c: [-0.11, 1.55, 0.68], r0: 0.055, r1: 0.075, scale: [1, 1, 1.6] } },
    { bone: 'sprout', halves: [[1, 1.6, 0.04, 1], [2, 0.2, 0.06, -1], [0, -0.07, 0.05, 1], [0, 0.3, 0.05, -1]] },
    { bone: 'sprout2', halves: [[1, 1.69, 0.03, 1], [2, 0.2, 0.06, -1], [0, -0.07, 0.05, 1], [0, 0.3, 0.05, -1]] },
    { bone: 'sprout3', halves: [[1, 1.75, 0.03, 1], [2, 0.2, 0.06, -1], [0, -0.07, 0.05, 1], [0, 0.3, 0.05, -1]] },
    { bone: 'bulb', sphere: { c: [0.14, 1.83, 0], r0: 0.09, r1: 0.12 } },
    { bone: 'finL', sphere: { c: [0.86, 0.8, 0.36], r0: 0.12, r1: 0.26 } },
    { bone: 'finR', sphere: { c: [-0.86, 0.8, 0.36], r0: 0.12, r1: 0.26 } },
    { bone: 'footL', halves: [[1, 0.26, 0.08, -1], [0, 0.33, 0.08, 1], [2, 0.32, 0.1, 1]] },
    { bone: 'footR', halves: [[1, 0.26, 0.08, -1], [0, -0.33, 0.08, -1], [2, 0.32, 0.1, 1]] },
    { bone: 'hindL', halves: [[1, 0.26, 0.08, -1], [0, 0.5, 0.1, 1], [2, 0.32, 0.1, -1]] },
    { bone: 'hindR', halves: [[1, 0.26, 0.08, -1], [0, -0.5, 0.1, -1], [2, 0.32, 0.1, -1]] },
    { bone: 'toeL', halves: [[1, 0.14, 0.05, -1], [2, 0.62, 0.06, 1], [0, 0.3, 0.06, 1]] }, { bone: 'toeR', halves: [[1, 0.14, 0.05, -1], [2, 0.62, 0.06, 1], [0, -0.3, 0.06, -1]] },
    { bone: 'hindToeL', halves: [[1, 0.14, 0.05, -1], [0, 0.85, 0.05, 1], [2, 0.3, 0.1, -1]] }, { bone: 'hindToeR', halves: [[1, 0.14, 0.05, -1], [0, -0.85, 0.05, -1], [2, 0.3, 0.1, -1]] }],
  poses: {
    stand: P({ all: {}, root: {}, body: {}, tongue: {}, lipU: {}, lipD: {}, cornerL: {}, cornerR: {}, sprout: {}, leafL: {}, leafR: {}, eyeL: {}, eyeR: {}, browL: {}, browR: {}, finL: {}, finR: {}, footL: {}, footR: {} }, mouth(0), corners(0)),
    /* tucked into a ball: mouth shut, eyes screwed up, fins and feet pulled in, leaves flat */
    ball: P(mouth(0.04), eyes(1.25, 0.2), brows(-0.02, 14), fins(-34, 20), leaves(-52), feet(0.1, 0.05), { body: sq(0.08) }) },
  clips: {
    /* ---------- standing about ---------- */
    Idle: { fps: 30, keys: [{ t: 0, use: S },   /* mouth shut: breathes out through puffed lips, the antenna sways, a blink near the end */
      { t: 0.6, pose: P({ body: sq(0.045, 0, 0, 2) }, mouth(0), lips(0, 0, 6, 8), corners(-0.015), fins(-8), leaves(-5, 0, 6)) },
      { t: 1.2, pose: P({ body: sq(-0.025) }, mouth(0), lips(0.01, -0.01, -3, -3), corners(0.02, 0.01), fins(6), leaves(5, 0, 0)) },
      { t: 1.8, pose: P({ body: sq(0.045, 0, 0, -2) }, mouth(0), lips(0, 0, 6, 8), corners(-0.015), fins(-8), leaves(-5, 0, -6)) },
      { t: 2.0, pose: P({ body: sq(0.02) }, eyes(1, 1)) }, { t: 2.08, pose: eyes(1.1, 0.1), in: 'lin' }, { t: 2.18, pose: eyes(1, 1), in: 'lin' },
      { t: 2.4, reset: true, use: S }] },
    /* now and then: spots a fly, follows it, snaps at it twice, chews, licks his lips */
    Idle2: { fps: 30, keys: [{ t: 0, use: S },
      { t: 0.3, pose: P({ body: sq(0, -8, 28, 0) }, eyes(1.3), brows(0.05), mouth(0.2)), in: 'quad' },
      { t: 0.65, pose: P({ body: sq(0, -14, -26, 0) }, leaves(6, 0, 10)), in: 'quad' },
      { t: 0.9, pose: P({ body: sq(0.2, -24, 12, 0) }, mouth(1.15), eyes(1.4), fins(-20)), in: 'out' },
      { t: 1.0, reset: true, use: S, pose: P({ body: sq(-0.2, -30, 12, 0) }, root(0, 0.3, 0.08), mouth(0), eyes(1.2, 0.25), fins(50), leaves(-30)), in: 'snap' },
      { t: 1.15, reset: true, use: S, pose: P({ body: sq(0.2, -18, -14, 0) }, mouth(1.1), eyes(1.4), fins(-20)), in: 'quad' },
      { t: 1.26, reset: true, use: S, pose: P({ body: sq(-0.22, -32, -14, 0) }, root(0, 0.36, 0.08), mouth(0), eyes(1.2, 0.25), fins(60), leaves(-34)), in: 'snap' },
      { t: 1.45, reset: true, use: S, pose: P({ body: sq(0.22) }, mouth(0.05), eyes(1.15, 0.3), brows(0.03), leaves(12)), in: 'quad' },
      { t: 1.65, pose: P({ body: sq(0.02, 0, 0, 5) }, mouth(0.22), corners(0.03, 0, -0.02)) }, { t: 1.82, pose: P({ body: sq(0.1, 0, 0, -5) }, mouth(0), lips(0, 0, 8, 10), corners(-0.02, 0, 0.03)) }, { t: 2.0, pose: P({ body: sq(0.02, 0, 0, 5) }, mouth(0.22), corners(0.03, 0, -0.02)) }, { t: 2.17, pose: P({ body: sq(0.1) }, mouth(0), lips(0, 0, 8, 10), corners(0)) },
      { t: 2.4, pose: P({ body: sq(-0.04, -6, 0, 0) }, mouth(0.45), tongue(1.9, 34, -30), eyes(1.1, 0.5)), in: 'out' }, { t: 2.75, pose: tongue(1.9, -34, -30) }, { t: 2.95, pose: P(tongue(1, 0), mouth(0), lips(0, 0, 0, 10), corners(0.03)), in: 'quad' },
      { t: 3.3, reset: true, use: S, in: 'back' }] },
    Waddle: { fps: 30, keys: waddle },
    Scamper: { fps: 30, keys: scamper },
    Skid: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-24), body: sq(0.16) }, feet(0, 0.26, 0, 0.2), eyes(1.5), brows(0.06, -10), mouth(0), lips(0.02, -0.02), corners(-0.03, 0.05), fins(60, 30), leaves(-20, 44)) },
      { t: 0.2, pose: P({ all: flip(-10), body: sq(0.05) }, leaves(8, -20), eyes(1.2)), in: 'quad' }, { t: 0.4, reset: true, use: S, in: 'back' }] },
    Crouch: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.2, pose: P({ body: sq(0.4) }, mouth(0), lips(0, 0, 8, 8), corners(-0.02, 0.03), eyes(1.15, 0.6), brows(-0.03), fins(-28), leaves(-36, 10), feet(0, 0, 0, 0, 0.08)) }] },
    /* ---------- in the air ---------- */
    Rise: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.3) }, mouth(0.95), eyes(1.25), brows(0.05), fins(64), feet(-0.08, 0), leaves(-46, 0)) },
      { t: 0.4, reset: true, use: S, pose: P({ body: sq(0.03) }, mouth(0.05), lips(0, 0, 6, 10), fins(14), feet(0.08, 0.05), leaves(6)) }] },
    /* the second jump: a twirl with his fins flung out */
    AirJump: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.26) }, mouth(0.8), eyes(1.2, 0.3), fins(80), leaves(-40), feet(-0.06, 0)) }, ...turns('yaw', 0, 360, 0, 0.36, {}), { t: 0.5, reset: true, use: S, pose: P({ all: R(0, 360, 0), body: sq(0.04) }, fins(10), mouth(0), corners(0.03)), in: 'back' }] },
    Fall: { fps: 30, keys: [   /* flaps his little fins as if it helped */
      { t: 0, use: S, pose: P({ body: sq(-0.08) }, mouth(0.1), lips(0.02, -0.03, 14, 20), eyes(1.3), brows(0.05, -14), fins(54), leaves(40, -10), feet(0.1, 0.05, 0.04, -0.04)) },
      { t: 0.125, pose: P(fins(-16), mouth(0.22), lips(0.03, -0.05, 22, 30), feet(0.04, -0.04, 0.1, 0.05), leaves(48, -10, 6)) },
      { t: 0.25, pose: P(fins(54), mouth(0.1), lips(0.02, -0.03, 14, 20), feet(0.1, 0.05, 0.04, -0.04), leaves(40, -10, 0)) },
      { t: 0.375, pose: P(fins(-16), mouth(0.22), lips(0.03, -0.05, 22, 30), feet(0.04, -0.04, 0.1, 0.05), leaves(48, -10, -6)) },
      { t: 0.5, pose: P(fins(54), mouth(0.1), lips(0.02, -0.03, 14, 20), feet(0.1, 0.05, 0.04, -0.04), leaves(40, -10, 0)) }] },
    FastFall: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(55), body: sq(-0.2) }, mouth(1.1), tongue(1.5, 0, -30), eyes(1.2, 0.5), brows(-0.02, 18), fins(70, -40), leaves(-50, -40), feet(-0.08, -0.05)) },
      { t: 0.2, pose: P(tongue(1.6, 14, -34), fins(78, -46)) }, { t: 0.4, pose: P(tongue(1.5, 0, -30), fins(70, -40)) }] },
    /* helpless after the bubble pops: flops about, flapping in turn */
    Helpless: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.1, 0, 0, 18) }, mouth(0.6), tongue(1.5, 20, 0), eyes(1.35), brows(0.05, -20), fins(60, 0, -20), leaves(30, 0, -20), feet(0.08, 0.06, 0, -0.06)) },
      { t: 0.4, pose: P({ body: sq(0.1, 0, 0, -18) }, tongue(1.5, -20, 0), fins(-20, 0, 60), leaves(30, 0, 20), feet(0, -0.06, 0.08, 0.06)) },
      { t: 0.8, pose: P({ body: sq(0.1, 0, 0, 18) }, tongue(1.5, 20, 0), fins(60, 0, -20), leaves(30, 0, -20), feet(0.08, 0.06, 0, -0.06)) }] },
    Land: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.3) }, mouth(0.5), lips(0, -0.04, 10, 24), eyes(1.2, 0.35), fins(-30), leaves(-46), feet(0, 0, 0, 0, 0.06)) }, { t: 0.18, reset: true, use: S, pose: P({ body: sq(-0.1) }, mouth(0), lips(0, 0.01, -4, -6), leaves(20)), in: 'out' }, { t: 0.4, reset: true, use: S, in: 'back' }] },
    LandHard: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.52) }, mouth(1.05), lips(0, -0.05, 14, 30), tongue(1.8, 0, -20), eyes(1.7), brows(0.07), fins(-40), leaves(-60), feet(0, 0, 0, 0, 0.14)) },
      { t: 0.22, pose: P({ body: sq(0.4) }, mouth(0.4), lips(0, -0.02, 6, 14), eyes(1.3), tongue(1.3, 0)) }, { t: 0.36, reset: true, use: S, pose: P({ body: sq(-0.16) }, leaves(26), fins(30)), in: 'out' }, { t: 0.6, reset: true, use: S, in: 'back' }] },
    /* ---------- defending ---------- */
    Shield: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.15, pose: shieldPose }] },   /* clamps his mouth, screws his eyes shut, hides behind his fins */
    ShieldHit: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.26) }, root(0, 0, -0.12), mouth(0.02), eyes(1.6), brows(0.06), fins(30, 80), leaves(-30, 30)) }, { t: 0.15, pose: P(shieldPose, root(0, 0, 0)), in: 'back' }] },
    Dodge: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.14, pose: P({ all: flip(-26), body: puff(0.62, 1.22) }, mouth(0.05), eyes(1.5), brows(0.06), fins(-40), leaves(10, -30)), in: 'out' }, { t: 0.4, reset: true, use: S, in: 'back' }] },   /* sucks himself thin */
    AirDodge: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.12, use: 'ball', in: 'out' }, ...turns('yaw', 0, 360, 0.12, 0.6, {}), { t: 0.8, reset: true, use: S, pose: { all: R(0, 360, 0) }, in: 'back' }] },
    Ball: { fps: 30, keys: [{ t: 0, use: [S, 'ball'] }, { t: 0.3, pose: { body: sq(0.14) } }, { t: 0.6, pose: { body: sq(0.08) } }] },   /* the ground roll: the game turns him over and over */
    /* ---------- being hit ---------- */
    Hit: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-22), body: sq(-0.1) }, mouth(0.9), tongue(1.5, 0, -30), eyes(1.6), brows(0.07), fins(50), leaves(10, 40), feet(0.1, 0.1, 0, 0)) },
      { t: 0.3, pose: P({ all: flip(-14), body: sq(0.06) }, tongue(1.1, 0), eyes(1.2, 0.4), brows(0, -16), leaves(0, -10), fins(24)) }, { t: 0.6, reset: true, use: S }] },
    HitHeavy: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-40), body: sq(-0.26) }, mouth(1.2), tongue(2.2, 0, -34), eyes(1.9), brows(0.09), fins(76), leaves(20, 56), feet(0.12, 0.2, 0.06, 0.24)) },
      { t: 0.3, pose: P({ all: flip(-30), body: sq(0.12) }, tongue(1.6, 20, -10), eyes2(1.5, 0.8)) }, { t: 0.6, pose: P({ all: flip(-8), body: sq(0) }, mouth(0.5), tongue(1.1, 0), eyes(1.2, 0.4), brows(0, -18), fins(20), leaves(0, -10)), in: 'back' }] },
    LaunchUp: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.32) }, mouth(1.1), tongue(1.8, 0, 20), eyes(1.7), brows(0.08), fins(-50), leaves(-60), feet(-0.12, -0.06)) },
      { t: 0.3, pose: P({ all: flip(-100), body: sq(-0.1) }, eyes2(1.6, 0.9)) }, { t: 0.6, pose: P({ all: flip(-200), body: sq(0) }, fins(30)) }] },
    Spike: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(50), body: sq(0.36) }, mouth(1.0), tongue(1.6, 0, -40), eyes(1.8), brows(0.08), fins(80), leaves(50), feet(0.2, -0.1)) }, { t: 0.3, pose: { all: flip(80), body: sq(-0.26) } }, { t: 0.6, pose: { all: flip(100), body: sq(-0.1) } }] },
    Launch: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-60), body: sq(-0.26) }, mouth(1.15), tongue(2, 0, -30), eyes(1.8), brows(0.08), fins(70), leaves(10, 50), feet(0.1, 0.24, 0.06, 0.2)) }, { t: 0.3, pose: P({ all: flip(-160), body: sq(-0.05) }, eyes2(0.8, 1.6)) }, { t: 0.6, pose: { all: flip(-260), body: sq(0) } }] },
    Tumble: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.06) }, mouth(0.85), tongue(1.7, 30, -10), eyes2(1.6, 0.8), brows(0.04, -18), fins(60, 0, -30), leaves(30, 0, 20), feet(0.08, 0.08, 0, -0.06)) },
      { t: 0.3, pose: P({ body: sq(-0.06) }, mouth(0.7), tongue(1.7, -30, -10), eyes2(0.8, 1.6), fins(-30, 0, 60), leaves(30, 0, -20), feet(0, -0.06, 0.08, 0.08)) },
      { t: 0.6, pose: P({ body: sq(0.06) }, mouth(0.85), tongue(1.7, 30, -10), eyes2(1.6, 0.8), fins(60, 0, -30), leaves(30, 0, 20), feet(0.08, 0.08, 0, -0.06)) }] },
    /* flat on his back, feet in the air, tongue out */
    Down: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-50) }, mouth(0.8), eyes(1.5)) }, { t: 0.3, pose: P({ all: flip(-90), body: { scale: [1.12, 1.12, 0.78], rot: [0, 0, 0] } }, mouth(0.6), tongue(1.9, 26, 10), eyes(1.3, 0.14), brows(0, -16), fins(40), leaves(-40), feet(-0.1, 0, -0.04, 0)), in: 'back' }] },
    Dizzy: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0.06, 0, 0, 13) }, mouth(0.5), tongue(1.7, 24, 14), eyes2(1.6, 0.7), brows(0.03, -20), fins(-20), leaves(-40, 0, 16)) },
      { t: 0.5, pose: P({ body: sq(0.02, 6, 0, 0) }, tongue(1.7, 0, 14), eyes2(1.1, 1.1)) }, { t: 1.0, pose: P({ body: sq(0.06, 0, 0, -13) }, tongue(1.7, -24, 14), eyes2(0.7, 1.6), leaves(-40, 0, -16)) }] },
    /* ---------- ledge, grabs ---------- */
    /* hangs from the ledge by his teeth, body swinging underneath, feet kicking */
    Ledge: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-36, 0, 0.18, 0.24), body: sq(-0.16, 9, 0, 0) }, mouth(0.12), eyes(1.3), brows(0.04, -16), fins(40, 0, -10), leaves(-30, 30), feet(-0.06, 0.08, -0.1, -0.06)) },
      { t: 0.5, pose: P({ body: sq(-0.2, -9, 0, 0) }, fins(-10, 0, 40), feet(-0.1, -0.06, -0.06, 0.08), leaves(-30, -20)) },
      { t: 1.0, pose: P({ body: sq(-0.16, 9, 0, 0) }, fins(40, 0, -10), feet(-0.06, 0.08, -0.1, -0.06), leaves(-30, 30)) }] },
    Hold: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(0, 10, 0, 0) }, root(0, 0, 0.1), mouth(0.42), eyes(1.15, 0.3), fins(20, 50), leaves(10)) }, { t: 0.3, pose: P({ body: sq(0.05, 13, 0, 4) }, mouth(0.36), fins(26, 56)) }, { t: 0.6, pose: P({ body: sq(0, 10, 0, -4) }, mouth(0.42), fins(20, 50)) }] },
    Pummel: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.08, 4, 0, 0) }, root(0, 0, 0.1), mouth(0.85), eyes(1.3), fins(50, 30)) }, { t: 0.12, pose: P({ body: sq(0.12, 16, 0, 0) }, mouth(0.2), eyes(1.2, 0.2), fins(10, 60)), in: 'snap' }, { t: 0.4, pose: P({ body: sq(0, 10, 0, 0) }, mouth(0.42), eyes(1.15, 0.3), fins(20, 50)), in: 'back' }] },
    Held: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.06, 0, 0, 9) }, root(0, 0.1, 0), mouth(0.75), eyes(1.4), brows(0.05, -18), fins(60, 0, -20), feet(-0.04, 0.1, -0.08, -0.06), leaves(20, 0, -14)) },
      { t: 0.25, pose: P({ body: sq(-0.06, 0, 0, -9) }, mouth(0.55), fins(-20, 0, 60), feet(-0.08, -0.06, -0.04, 0.1), leaves(20, 0, 14)) },
      { t: 0.5, pose: P({ body: sq(-0.06, 0, 0, 9) }, mouth(0.75), fins(60, 0, -20), feet(-0.04, 0.1, -0.08, -0.06), leaves(20, 0, -14)) }] },
    Grab: { fps: 30, keys: atk(P({ all: flip(-14), body: sq(0.1) }, root(0, 0, -0.1), mouth(1.3), eyes(1.3), fins(50)), P({ all: flip(8), body: lg(0.3) }, root(0, 0, 0.88), mouth(0.42), eyes(1.15, 0.3), fins(10, 60), leaves(-20, -30)), P(root(0, 0, 0.8), mouth(0.4), { body: lg(0.12) })) },
    ThrowF: { fps: 30, keys: thr(P({ all: flip(-22), body: puff(1.14, 1.06) }, mouth(0.08), eyes(1.4), brows(0.05), fins(40)), P({ all: flip(22), body: lg(0.2) }, root(0, 0, 0.42), mouth(1.15), tongue(2, 0, -24), eyes(1.2, 0.25), fins(-20, -40), leaves(-30, -40)), P({ all: flip(12), body: sq(0.06) }, root(0, 0, 0.3), mouth(0.7), tongue(1.3, 0))) },   /* ptooey */
    ThrowB: { fps: 30, keys: thr(P({ all: R(0, 70, 0), body: sq(0.12) }, mouth(0.35), fins(40)), P({ all: R(0, 200, 0), body: sq(-0.2) }, mouth(1.1), tongue(1.8, 0, -20), eyes(1.2, 0.25), fins(80), leaves(-30, 0, 30)), P({ all: R(0, 320, 0), body: sq(0.05) }, mouth(0.6))).concat([{ t: 1.02, reset: true, use: S, pose: { all: R(0, 360, 0) } }]) },
    ThrowU: { fps: 30, keys: thr(P({ body: sq(0.34) }, mouth(0.35), eyes(1.1, 0.4), fins(-30)), P({ all: flip(-78), body: lg(0.3) }, root(0, 0.3, 0), mouth(1.2), tongue(1.8, 0, -10), eyes(1.4), fins(70), leaves(-40)), P({ all: flip(-60), body: lg(0.08) }, root(0, 0.16, 0), mouth(0.8))) },
    ThrowD: { fps: 30, keys: thr(P({ body: sq(-0.24) }, root(0, 0.34, 0.1), mouth(0.3), eyes(1.3), fins(80)), P({ all: flip(24), body: sq(0.46) }, root(0, -0.06, 0.3), mouth(0.1), eyes(1.25, 0.2), fins(-30), leaves(-56), feet(0, 0, 0, 0, 0.12)), P({ all: flip(10), body: sq(0.2) }, root(0, 0, 0.2), mouth(0.5))) },   /* hops up and sits on them */
    Respawn: { fps: 30, keys: [{ t: 0, use: S, pose: P({ body: sq(-0.08) }, mouth(0), corners(0.06, 0.03), lips(0, 0, 0, 8), eyes(1.15, 0.3), fins(70, 0, 10), leaves(16)) }, { t: 0.3, pose: P({ body: sq(0.08, 0, 0, 6) }, fins(34, 0, 0), leaves(-10, 0, -8)), in: 'quad' }, { t: 0.6, pose: P({ body: sq(-0.08) }, fins(70, 0, 10), leaves(16)), in: 'quad' }, { t: 0.9, pose: P({ body: sq(0.08, 0, 0, -6) }, fins(34, 0, 0), leaves(-10, 0, 8)), in: 'quad' }, { t: 1.2, pose: P({ body: sq(-0.08) }, fins(70, 0, 10), leaves(16)), in: 'quad' }] },   /* waves and bounces on the pad */
    /* ---------- ground attacks ---------- */
    Jab1: { fps: 30, keys: atk(P({ body: sq(0.06, -6, 0, 0) }, root(0, 0, -0.05), mouth(0.8), eyes(1.2)), P({ body: sq(-0.1, 9, 0, 0) }, root(0, 0, 0.4), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.1, 0.4), leaves(-10, -24)), P({ body: sq(0.03, 6, 0, 0) }, root(0, 0, 0.32), mouth(0.16))) },
    Jab2: { fps: 30, keys: atk(P({ body: sq(0.06, -6, 0, -12) }, root(0, 0, 0.05), mouth(0.85), eyes(1.2)), P({ body: sq(-0.1, 9, 0, 12) }, root(0, 0, 0.44), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.1, 0.4), leaves(-10, -24, -14)), P({ body: sq(0.03, 6, 0, 8) }, root(0, 0, 0.36), mouth(0.16))) },
    Jab3: { fps: 30, keys: atk(P({ all: flip(-14), body: sq(0.22) }, root(0, -0.03, -0.14), mouth(1.3), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.4), brows(0.05), fins(50), leaves(10, 30)), P({ all: flip(14), body: lg(0.24) }, root(0, 0.1, 0.62), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.25), brows(-0.02, 18), fins(-30, -30), leaves(-30, -44)), P({ all: flip(8), body: sq(0.1) }, root(0, 0, 0.5), mouth(0.12))) },
    /* forward tilt: his tongue shoots out */
    TongueFlick: { fps: 30, keys: atk(P({ all: flip(-10), body: sq(0.1) }, root(0, 0, -0.06), mouth(0.95), tongue(0.6, 0, -20), eyes(1.2, 0.5)), P({ all: flip(6), body: sq(-0.08) }, root(0, 0, 0.3), mouth(0.72), tongue(4.7, 0, -13), eyes(1.2, 0.18), brows(0.04), fins(40, -30), leaves(-10, -30)), P({ all: flip(4) }, root(0, 0, 0.26), mouth(0.72), tongue(4.2, 9, -9)), [{ t: 0.68, pose: P(tongue(0.8, 0, -10), mouth(0.5), root(0, 0, 0.1)), in: 'snap' }]) },
    SnapUp: { fps: 30, keys: atk(P({ all: flip(-46), body: sq(0.26) }, mouth(1.2), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.3)), P({ all: flip(-82), body: lg(0.26) }, root(0, 0.44, 0.34), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.1, 0.4), fins(-40), leaves(-50)), P({ all: flip(-72), body: lg(0.05) }, root(0, 0.32, 0.26), mouth(0.15))) },
    ToeNibble: { fps: 30, keys: atk(P({ all: flip(26), body: sq(0.3) }, root(0, 0, -0.04), mouth(0.95), eyes(1.2)), P({ all: flip(44), body: sq(0.3) }, root(0, -0.08, 0.86), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.1, 0.4), fins(40), leaves(-20, -30)), P({ all: flip(38), body: sq(0.26) }, root(0, -0.06, 0.76), mouth(0.2))) },
    /* dash attack: tumbles head over heels into a bite, then a second munch */
    RollingHunger: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(0) }, mouth(0.5)) }, { t: 0.08, use: 'ball', pose: { all: flip(60) }, in: 'lin' }, ...turns('flip', 60, 330, 0.08, 0.3, {}),
      { t: 0.34, reset: true, use: S, pose: P({ all: flip(372), body: lg(0.2) }, root(0, 0, 0.5), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.3), fins(40, -30), leaves(-30, -40)), in: 'lin' },
      { t: 0.4, pose: P(mouth(0.9), { body: sq(0.1) }) }, { t: 0.47, pose: P(mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), { body: lg(0.1) }), in: 'snap' }, { t: 0.52, pose: P(mouth(0.05), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03)) },
      { t: 0.64, pose: P({ all: flip(364), body: sq(0.1) }, root(0, 0, 0.36), mouth(0.3)), in: 'back' }, { t: 0.9, reset: true, use: S, pose: { all: flip(360) }, in: 'quad' }] },
    /* forward smash: a mouth no jaw should manage, then it slams */
    MegaChomp: { fps: 30, keys: atk(P({ all: flip(-32, 0, 0.04, -0.26), body: sq(-0.16) }, mouth(1.78), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), tongue(1.3, 0, 24), eyes(1.6), brows(0.08), fins(76), leaves(20, 40), feet(0, 0.1, 0, 0)), P({ all: flip(28, 0, -0.03, 0.78), body: sq(0.2) }, mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.3, 0.16), brows(-0.03, 22), fins(-36, -30), leaves(-40, -50)), P({ all: flip(34, 0, -0.03, 0.8), body: sq(0.06) }, mouth(0.04), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03)), [{ t: 0.66, pose: P({ body: sq(0.14) }, mouth(0.1)) }, { t: 0.74, pose: P({ all: flip(16, 0, 0, 0.5), body: sq(-0.04) }, mouth(0.3), eyes(1.1, 0.5)) }]) },
    SugarSnap: { fps: 30, keys: atk(P({ all: flip(-56), body: sq(0.4) }, mouth(1.35), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.4), fins(-30), leaves(-30)), P({ all: flip(-92), body: lg(0.36) }, root(0, 0.56, 0.2), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.25), fins(60), leaves(-60)), P({ all: flip(-84), body: lg(0.1) }, root(0, 0.44, 0.16), mouth(0.12))) },
    /* down smash: a low bite in front; the game spins him half round and he bites again behind */
    FloorFeast: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.2, pose: P({ all: flip(24), body: sq(0.32) }, mouth(1.05), eyes(1.3)), in: 'out' }, { t: 0.3, pose: P({ all: flip(24), body: sq(0.32) }, mouth(1.05)) },
      { t: 0.34, reset: true, use: S, pose: P({ all: flip(42), body: sq(0.28) }, root(0, -0.08, 0.56), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.3), fins(40)), in: 'snap' }, { t: 0.39, pose: P(mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03)) },
      { t: 0.44, pose: P(mouth(1.1), root(0, -0.08, 0.2), eyes(1.3), fins(80)) }, { t: 0.485, pose: P(mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), root(0, -0.08, 0.56), eyes(1.2, 0.3), fins(40)), in: 'snap' }, { t: 0.52, pose: P(mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03)) },
      { t: 0.64, pose: P({ all: flip(30), body: sq(0.2) }, root(0, -0.05, 0.36), mouth(0.2)), in: 'back' }, { t: 0.9, reset: true, use: S, in: 'quad' }] },
    /* ---------- air attacks ---------- */
    /* neutral air: rolls twice round with his mouth wide open */
    HungrySpin: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.12, pose: P({ all: flip(-24), body: sq(0.12) }, mouth(0.7), fins(40)), in: 'out' }, { t: 0.2, pose: P({ all: flip(50), body: sq(-0.06) }, mouth(1.25), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), tongue(1.6, 0, -30), eyes(1.2, 0.3), fins(70, -20), leaves(-40), feet(0.08, 0)), in: 'snap' },
      ...turns('flip', 50, 720, 0.2, 0.6, {}), { t: 0.7, reset: true, use: S, pose: P({ all: flip(732), body: sq(-0.1) }, mouth(0.8), fins(60), eyes2(1.4, 0.8)), in: 'quad' }, { t: 0.9, reset: true, use: S, pose: { all: flip(720) }, in: 'back' }] },
    FlyingChomp: { fps: 30, keys: atk(P({ all: flip(-26), body: sq(0.1) }, mouth(1.45), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.4), fins(64), feet(0.06, -0.1)), P({ all: flip(20), body: lg(0.2) }, root(0, 0, 0.56), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.25), fins(-24, -40), leaves(-30, -44), feet(-0.04, -0.14)), P({ all: flip(12), body: sq(0.05) }, root(0, 0, 0.44), mouth(0.14))) },
    HeelFlick: { fps: 30, keys: atk(P({ all: flip(28), body: sq(0.1) }, feet(0.12, 0.1), mouth(0.3), eyes(1.2)), P({ all: flip(84), body: sq(-0.06) }, root(0, -0.14, -0.2), feet(-0.3, -0.04), mouth(0.75), eyes(1.2, 0.3), fins(60), leaves(-20, 30)), P({ all: flip(76) }, root(0, -0.1, -0.16), feet(-0.22, -0.04), mouth(0.6))) },
    SkyBite: { fps: 30, keys: atk(P({ all: flip(-58), body: sq(0.16) }, mouth(1.25), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.3), fins(-30)), P({ all: flip(-92), body: lg(0.26) }, root(0, 0.42, 0.14), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.1, 0.4), fins(50), leaves(-50)), P({ all: flip(-82), body: lg(0.06) }, root(0, 0.3, 0.1), mouth(0.15))) },
    JawDrop: { fps: 30, keys: atk(P({ all: flip(64), body: lg(0.12) }, root(0, 0.12, 0), mouth(1.75), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), tongue(1.3, 0, 20), eyes(1.5), brows(0.06), fins(84), leaves(30)), P({ all: flip(100), body: lg(0.28) }, root(0, 0.34, 0.62), mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.2), brows(-0.02, 20), fins(-30), leaves(40)), P({ all: flip(102), body: lg(0.1) }, root(0, 0.3, 0.52), mouth(0.08))) },
    /* get-up attack: springs up off his back and twirls with his mouth open, snapping shut as he stops */
    GetupSpin: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-90) }, mouth(0.6), eyes(1.3, 0.2)) }, { t: 0.2, reset: true, use: S, pose: P({ all: R(0, 0, 0), body: sq(0.34) }, mouth(1.1), eyes(1.3), fins(70)), in: 'out' },
      ...turns('yaw', 0, 360, 0.26, 0.5, P(mouth(1.1), { body: sq(0.2) })), { t: 0.54, reset: true, use: S, pose: P({ all: R(0, 360, 0), body: sq(-0.1) }, mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.2, 0.3), fins(20)), in: 'snap' }, { t: 0.9, reset: true, use: S, pose: { all: R(0, 360, 0) }, in: 'quad' }] },
    /* ---------- specials ---------- */
    /* letting go of the rope: flies on mouth first and bites */
    SwingBite: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(18), body: lg(0.18) }, mouth(1.4), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.4), fins(60, -40), leaves(-40, -40), feet(-0.06, -0.12)) }, { t: 0.1, pose: P(mouth(0), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), { body: lg(0.24) }, eyes(1.2, 0.25)), in: 'snap' }, { t: 0.2, pose: mouth(0.9) }, { t: 0.3, pose: P(mouth(0.05), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), { body: lg(0.1) }), in: 'snap' },
      { t: 0.5, pose: P({ all: flip(6), body: sq(0.06) }, mouth(0.3), fins(20)), in: 'back' }, { t: 0.9, reset: true, use: S, in: 'quad' }] },
    /* down special: puffs right up, then squeezes it all out in one gust */
    AirCushion: { fps: 30, keys: atk(P({ all: flip(-16), body: puff(1.24, 1.18) }, mouth(0.06), eyes(1.5), brows(0.07), fins(70), leaves(20, 20)), P({ all: flip(14), body: puff(0.84, 0.86) }, root(0, 0, -0.14), mouth(0.5), eyes(1.25, 0.2), brows(-0.02, 16), fins(-10, 84), leaves(-30, 50)), P({ all: flip(8), body: puff(0.92, 0.9) }, root(0, 0, -0.1), mouth(0.4), fins(0, 70)), [{ t: 0.7, pose: P({ body: sq(0.1) }, mouth(0.6), tongue(1.5, 0), eyes(1.1, 0.5)) }]) },
    /* neutral special, no coal out: gulps, cheeks bulging, spits it up onto its rope on frame 13 of 22, then fans his burnt tongue */
    CoalToss: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.22, pose: P({ all: flip(-22), body: puff(1.16, 1.1) }, mouth(0.05), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.5), brows(0.07), fins(30)), in: 'out' }, { t: 0.36, pose: { body: { scale: [1.2, 1.06, 1.2], rot: [0, 0, 5] } } }, { t: 0.5, pose: { body: { scale: [1.2, 1.1, 1.2], rot: [0, 0, -5] } } },
      { t: 0.59, reset: true, use: S, pose: P({ all: flip(-30), body: sq(-0.2) }, root(0, 0.06, 0.12), mouth(1.1), tongue(1.4, 0, -30), eyes(1.2, 0.25), fins(-30), leaves(-30, 40)), in: 'snap' },
      { t: 0.72, pose: P({ all: flip(-8), body: sq(0.08) }, root(0, 0, 0), mouth(0.8), tongue(2, 16, -4), eyes(1.5), brows(0.05, -18), fins(50, 60, 10)) }, { t: 0.82, pose: P(tongue(2, -16, -4), fins(10, 60, 50)) }, { t: 0.92, pose: P(tongue(1.6, 10, -4), fins(40, 60, 10)) }, { t: 1.0, reset: true, use: S }] },
    CoalFlick: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.3, pose: P({ all: flip(-20), body: sq(-0.08) }, mouth(0.7), eyes(1.3), fins(50), leaves(10, 40)), in: 'out' }, { t: 0.6, pose: P({ all: flip(12), body: sq(0.08) }, mouth(0.1), eyes(1.1, 0.4), leaves(-10, -40)), in: 'snap' }, { t: 1.0, reset: true, use: S, in: 'back' }] },   /* a relay: a quick toss of the head */
    AntCall: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.25, pose: P({ body: sq(0.06, 12, 0, -8) }, mouth(0.22), eyes(1.2), brows(0.05), fins(86, 30, 0)), in: 'out' }, { t: 0.4, pose: fins(50, 60, 0) }, { t: 0.55, pose: P(fins(86, 30, 0), { body: sq(-0.04, 12, 0, -8) }, mouth(0.3)) }, { t: 0.7, pose: fins(50, 60, 0) }, { t: 1.0, reset: true, use: S, in: 'quad' }] },   /* beckons his ant: come on, come on */
    CoalNone: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.4, pose: P({ body: sq(0.06, 0, 0, 10) }, mouth(0.15), eyes(1.2), brows(0.06, -14), fins(50), leaves(-30)), in: 'out' }, { t: 1.0, reset: true, use: S, in: 'quad' }] },   /* nothing to throw: a shrug */
    /* side special: throws his head back to hook the rope, then hangs from it by his teeth (the game turns him along the rope) */
    RopeToss: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.5, pose: P({ all: flip(-40), body: sq(0.16) }, mouth(1.2), lips(0.05, -0.04, 18, 22), corners(0.03, 0.04), eyes(1.3), fins(-20)), in: 'out' }, { t: 1.0, reset: true, use: S, pose: P({ all: flip(-90), body: sq(-0.24) }, mouth(0.1), eyes(1.3), fins(70), feet(-0.1, 0)), in: 'snap' }] },
    RopeSwing: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-90), body: sq(-0.22, 8, 0, 0) }, mouth(0.1), eyes(1.2, 0.3), brows(0.04), fins(74, 0, 40), leaves(-50, 30), feet(-0.12, 0.08, -0.06, -0.06)) },
      { t: 0.3, pose: P({ body: sq(-0.26, -8, 0, 0) }, fins(40, 0, 74), feet(-0.06, -0.06, -0.12, 0.08), leaves(-50, -30)) }, { t: 0.6, pose: P({ body: sq(-0.22, 8, 0, 0) }, fins(74, 0, 40), feet(-0.12, 0.08, -0.06, -0.06), leaves(-50, 30)) }] },
    /* up special: a deep breath, blows the bubble, then paddles about inside it */
    BubbleBlow: { fps: 30, keys: [{ t: 0, use: S }, { t: 0.4, pose: P({ all: flip(-14), body: puff(1.2, 1.14) }, mouth(0.05), lips(-0.02, 0.02, -8, -8), corners(-0.02, 0.03), eyes(1.4), fins(60)), in: 'out' }, { t: 1.0, reset: true, use: S, pose: P({ all: flip(6), body: puff(0.9, 0.92) }, mouth(0.3), eyes(1.2, 0.25), fins(-10, 50)), in: 'snap' }] },
    BubbleRide: { fps: 30, keys: [{ t: 0, use: S, pose: P({ all: flip(-16), body: sq(0.02, 0, 0, 9) }, mouth(0.8), tongue(1.3, 0), eyes(1.15, 0.3), fins(60, 30, -10), feet(0.1, 0.1, 0, -0.08), leaves(20, 0, -14)) },
      { t: 0.35, pose: P({ body: sq(-0.04, 0, 0, -9) }, fins(-10, 30, 60), feet(0, -0.08, 0.1, 0.1), leaves(20, 0, 14)) }, { t: 0.7, pose: P({ body: sq(0.02, 0, 0, 9) }, fins(60, 30, -10), feet(0.1, 0.1, 0, -0.08), leaves(20, 0, -14)) }] },
  },
};
/* The hind legs step opposite the front ones (a trot): wherever a pose places a front foot, the other side's hind leg goes
   the same way. Done once here so the clips themselves read as they always did. */
const hind = pose => { if (!pose) return; const l = pose.footL, r = pose.footR; if (l && !pose.hindR) pose.hindR = l; if (r && !pose.hindL) pose.hindL = r; };
Object.values(chomp.poses).forEach(hind);
Object.values(chomp.clips).forEach(c => c.keys.forEach(k => hind(k.pose)));
chomp.poses.stand.hindL = {}; chomp.poses.stand.hindR = {};

/* ---- the detail layer: the 30 detail bones, worked out from what each key already says ----
   Every key of every clip gets them, so the whole moveset gains them at once:
   - the soft body (belly, back, haunches, cheeks, crown) bulges with each squash and swells when he puffs up, and arrives a
     few frames late, so it wobbles and settles behind the big moves; the chin trails the jaw
   - the antenna bends along its length with the old sprout pose, each link later than the last, so it whips
   - the tongue (see tongue()) bends along its length, and its tip trails the swing
   - pupils shrink to pinpricks when his eyes go wide, cross as each bite lands, look up or down along up and down moves,
     and drift apart when he is hurt; lids come down as he squints and tilt with a scowl; the ridge between his eyes
     knits into a frown or lifts in surprise
   - fangs flash bigger when he snarls and as a bite lands; the upper lip sneers on one side in a snarl
   - toes splay as he lands his weight and point when he is in the air */
const HURT = new Set(['Hit', 'HitHeavy', 'LaunchUp', 'Spike', 'Launch', 'Tumble', 'Down', 'Dizzy', 'Held', 'Helpless']);
const LOOK_UP = new Set(['SnapUp', 'SugarSnap', 'SkyBite', 'ThrowU', 'BubbleBlow', 'RopeToss']);
const LOOK_DOWN = new Set(['ToeNibble', 'FloorFeast', 'JawDrop', 'ThrowD', 'FastFall']);
const AIRBORNE = new Set(['Rise', 'AirJump', 'Fall', 'FastFall', 'Helpless', 'BubbleRide', 'FlyingChomp', 'HeelFlick', 'SkyBite', 'JawDrop', 'HungrySpin', 'SwingBite', 'RopeSwing', 'LaunchUp', 'Launch', 'Tumble', 'Spike', 'AirDodge']);
const LAG = { belly: 2, back: 3, haunchL: 2, haunchR: 2, cheekL: 2, cheekR: 2, crown: 2, chin: 2, sprout2: 2, sprout3: 4, bulb: 6, tongue3: 2, tongueTip: 3 };
const r2 = v => +v.toFixed(3);
const detail = (name, clip) => {
  let st = {}; const F = k => Math.round(k.t * clip.fps), end = F(clip.keys[clip.keys.length - 1]);
  clip.keys.forEach((k, i) => {
    if (k.reset) { const z = {}; for (const b in st) z[b] = {}; st = z; }
    if (k.use) for (const u of [].concat(k.use)) Object.assign(st, chomp.poses[u]);
    Object.assign(st, k.pose || {});
    const g = (b, f, j, d) => (st[b] && st[b][f] ? st[b][f][j] : d);
    const k_ = 1 - g('body', 'scale', 1, 1), w = g('body', 'scale', 0, 1), lunge = g('body', 'scale', 2, 1) - 1;
    const sq_ = Math.max(-0.4, Math.min(0.6, k_)), puffed = Math.max(0, Math.min(w, 1 - k_) - 1.04);   /* swelling all round, not just squashed */
    const e = g('eyeL', 'scale', 0, 1), eh = g('eyeL', 'scale', 1, 1), eR = g('eyeR', 'scale', 0, 1);
    const sp = g('sprout', 'rot', 0, 0), sr = g('sprout', 'rot', 2, 0);
    const curlU = -g('lipU', 'rot', 0, 0), scowl = g('browL', 'rot', 2, 0) / 0.6, lift = g('browL', 'move', 1, 0) / 0.5, jawP = g('jaw', 'rot', 0, 0);
    const bite = k.in === 'snap' && Math.abs(k.t - 0.34) < 0.01 && Math.abs(jawP) > 4;
    const D = {};
    /* soft body */
    D.belly = { scale: [r2(1 + 0.35 * sq_ + puffed), r2(1 - 0.2 * sq_), r2(1 + 0.45 * sq_ + puffed)], move: [0, 0, r2(0.05 * Math.max(0, sq_))] };
    D.back = { scale: [r2(1 + 0.2 * sq_ + puffed * 0.8), 1, r2(1 + 0.3 * sq_ - 0.2 * Math.max(0, lunge))] };
    D.haunchL = D.haunchR = { scale: [r2(1 + 0.3 * Math.max(0, sq_)), r2(1 - 0.15 * Math.max(0, sq_)), r2(1 + 0.3 * Math.max(0, sq_))] };
    D.cheekL = D.cheekR = { scale: [r2(1 + 0.4 * Math.max(0, sq_) + 1.6 * puffed), r2(1 + 0.6 * puffed), r2(1 + 0.2 * Math.max(0, sq_) + puffed)] };
    D.crown = { scale: [r2(1 + 0.15 * sq_), r2(1 - 0.2 * sq_), r2(1 + 0.15 * sq_)] };
    D.chin = R(r2(jawP * 0.3));
    /* antenna */
    D.sprout2 = R(r2(sp * 0.7 + 14 * sq_), 0, r2(sr * 0.7)); D.sprout3 = R(r2(sp * 0.5 + 10 * sq_), 0, r2(sr * 0.5)); D.bulb = R(r2(sp * 0.3), 0, r2(sr * 0.3));
    /* eyes */
    const pin = s => (s >= 1.5 ? 0.6 : s >= 1.25 ? 0.8 : 1);
    let pl = [0, 0, 0], pr = [0, 0, 0];
    if (LOOK_UP.has(name)) pl = pr = [0, 0.05, 0];
    if (LOOK_DOWN.has(name)) pl = pr = [0, -0.06, 0.01];
    if (HURT.has(name)) { pl = [0.05, i % 2 ? 0.02 : -0.02, 0]; pr = [-0.05, i % 2 ? -0.02 : 0.03, 0]; }
    if (bite) { pl = [-0.04, -0.01, 0]; pr = [0.04, -0.01, 0]; }
    D.pupilL = { scale: [pin(e), pin(e), 1], move: pl }; D.pupilR = { scale: [pin(eR), pin(eR), 1], move: pr };
    const shut = Math.max(0, 1 - eh), wide = Math.max(0, e - 1.15);
    D.lidL = { move: [0, r2(-0.12 * shut + 0.05 * wide), r2(0.03 * shut)], rot: [0, 0, r2(-scowl * 0.5)] };
    D.lidR = { move: [0, r2(-0.12 * shut + 0.05 * wide), r2(0.03 * shut)], rot: [0, 0, r2(scowl * 0.5)] };
    D.ridge = { move: [0, r2(Math.max(-0.03, Math.min(0.03, lift * 0.5 - 0.0012 * scowl))), 0], scale: [r2(1 - 0.006 * Math.max(0, scowl)), 1, 1] };
    /* mouth details */
    const snarl = curlU > 10;
    D.fangL = D.fangR = D.fangD = { scale: snarl ? [1.25, 1.25, 1.25] : bite ? [1.15, 1.15, 1.15] : [1, 1, 1] };
    D.lipUL = snarl ? { move: [0, 0.03, 0.01], rot: [-8, 0, 0] } : { move: [0, 0, 0] };
    D.lipUR = { move: [0, 0, 0] };
    D.lipDL = D.lipDR = { move: [0, 0, 0] };
    /* feet */
    const toe = AIRBORNE.has(name) ? R(30) : R(r2(-24 * Math.max(0, sq_)));
    D.toeL = D.toeR = D.hindToeL = D.hindToeR = toe;
    k.pose = Object.assign(D, k.pose || {});   /* anything a clip set by hand wins */
    /* overlap: the soft parts arrive a few frames late, but never past the next key or the end of the clip */
    const room = Math.min(end - F(k), i + 1 < clip.keys.length ? F(clip.keys[i + 1]) - F(k) - 1 : Infinity), lag = {};
    for (const b in LAG) { const n = Math.min(LAG[b], room); if (n > 0) lag[b] = n; }
    if (Object.keys(lag).length) k.lag = Object.assign(lag, k.lag || {});
  });
};
/* a few things the rule can't guess: he glances about while idling, follows the fly with his eyes, chews lopsided */
const touch = (clip, t, pose) => { const k = chomp.clips[clip].keys.find(q => Math.abs(q.t - t) < 0.001); k.pose = Object.assign(k.pose || {}, pose); };
touch('Idle', 0.6, { pupilL: M(0.035, 0.01, 0), pupilR: M(0.035, 0.01, 0) });
touch('Idle', 1.2, { pupilL: M(-0.035, 0.015, 0), pupilR: M(-0.035, 0.015, 0) });
touch('Idle', 1.8, { pupilL: M(0, -0.01, 0), pupilR: M(0, -0.01, 0) });
touch('Idle2', 0.3, { pupilL: M(0.05, 0.035, 0), pupilR: M(0.05, 0.035, 0), lidL: M(0, 0.03, 0), lidR: M(0, 0.03, 0) });
touch('Idle2', 0.65, { pupilL: M(-0.05, 0.03, 0), pupilR: M(-0.05, 0.03, 0) });
touch('Idle2', 0.9, { pupilL: M(-0.035, 0.0, 0), pupilR: M(0.035, 0.0, 0) });
touch('Idle2', 1.82, { lipDL: M(0, 0.02, 0), lipDR: M(0, -0.01, 0), cheekL: { scale: [1.15, 1.1, 1.1] } });
touch('Idle2', 2.17, { lipDL: M(0, -0.01, 0), lipDR: M(0, 0.02, 0), cheekR: { scale: [1.15, 1.1, 1.1] } });
touch('Idle2', 2.4, { tongueTip: R(-30, 30), tongue3: R(-12, 14) });
touch('Idle2', 2.75, { tongueTip: R(-30, -30), tongue3: R(-12, -14) });
for (const [name, clip] of Object.entries(chomp.clips)) detail(name, clip);
Object.assign(chomp.poses.stand, Object.fromEntries(['belly', 'back', 'haunchL', 'haunchR', 'cheekL', 'cheekR', 'crown', 'chin', 'sprout2', 'sprout3', 'bulb', 'tongue2', 'tongue3', 'tongueTip',
  'pupilL', 'pupilR', 'lidL', 'lidR', 'ridge', 'fangL', 'fangR', 'fangD', 'lipUL', 'lipUR', 'lipDL', 'lipDR', 'toeL', 'toeR', 'hindToeL', 'hindToeR'].map(b => [b, {}])));
const out =path.join(__dirname, '..', '..', 'assets', 'chomp', 'work');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(chomp, null, 1));
fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/chomp-rigged.glb', texture: 1024, out: 'export/chomp-v1.glb' }, null, 1) + '\n');
console.log('wrote rig.json: ' + chomp.bones.length + ' bones, ' + Object.keys(chomp.clips).length + ' clips');
if (TEST) process.exit(0);

/* ---- the game's manifest entry ---- */
const A = (clip, c0, c1, start, end, more) => Object.assign({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 }, more);
const L = (clip, more) => A(clip, 0.34, 0.44, 0, 0.9, more);   /* the strike key is at 0.34 (built with rig.py --start 0, so keys play at their own times) */
const entry = { file: 'assets/chomp/export/chomp-v1.glb', height: 13, feel: 1,
  clips: { idle: { clip: 'Idle' }, idle2: { clip: 'Idle2' }, walk: { clip: 'Waddle' }, run: { clip: 'Scamper' }, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Skid' }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 },
    rise: { clip: 'Rise', from: 0, to: 0.4 }, airjump: { clip: 'AirJump' }, fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' }, helpless: { clip: 'Helpless' }, land: { clip: 'Land', from: 0, to: 0.4 }, landHard: { clip: 'LandHard' },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, shieldHit: { clip: 'ShieldHit' }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, airdodge: { clip: 'AirDodge' }, roll: { clip: 'Ball', bounce: true },
    hit: { clip: 'Hit', from: 0, to: 0.6 }, hitHeavy: { clip: 'HitHeavy' }, launchUp: { clip: 'LaunchUp' }, spike: { clip: 'Spike' }, launch: { clip: 'Launch' }, tumble: { clip: 'Tumble' }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Dizzy', bounce: true },
    ledge: { clip: 'Ledge' }, hold: { clip: 'Hold' }, pummel: { clip: 'Pummel' }, held: { clip: 'Held' }, throw: { clip: 'ThrowF' }, throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'ThrowB', to: 1.0 }, throw_u: { clip: 'ThrowU' }, throw_d: { clip: 'ThrowD' },
    swap: { clip: 'Ball', bounce: true }, respawn: { clip: 'Respawn' },
    coalToss: { clip: 'CoalToss' }, coalFlick: { clip: 'CoalFlick' }, antCall: { clip: 'AntCall' }, coalNone: { clip: 'CoalNone' }, ropeToss: { clip: 'RopeToss' }, ropeSwing: { clip: 'RopeSwing' }, bubbleBlow: { clip: 'BubbleBlow' }, bubbleRide: { clip: 'BubbleRide' } },
  strikers: [{ bone: 'jaw', ext: 1.3 }, { bone: 'tongue', ext: 1 }, { bone: 'footL', ext: 1.2 }, { bone: 'footR', ext: 1.2 }],
  springs: [{ bones: ['sprout', 'sprout2', 'sprout3', 'bulb'], k: 0.3, d: 0.66, max: 0.6, drag: 0.16 }, { bones: ['tongue3', 'tongueTip'], k: 0.4, d: 0.62, max: 0.5, drag: 0.1 }],
  /* jiggle (render3d applyJiggle): his whole soft body wobbles when he lands, stops, gets hit or throws himself about. max is in model units, k/d the spring, g how hard the motion shoves it */
  jiggle: [{ bone: 'top', k: 0.16, d: 0.86, max: 0.045, g: 0.1 }, { bone: 'jaw', k: 0.2, d: 0.84, max: 0.03, g: 0.08 }, { bone: 'belly', k: 0.14, d: 0.88, max: 0.09, g: 0.14 }, { bone: 'back', k: 0.16, d: 0.86, max: 0.07, g: 0.12 }, { bone: 'haunchL', k: 0.18, d: 0.85, max: 0.06, g: 0.12 }, { bone: 'haunchR', k: 0.18, d: 0.85, max: 0.06, g: 0.12 }, { bone: 'cheekL', k: 0.2, d: 0.84, max: 0.06, g: 0.12 }, { bone: 'cheekR', k: 0.2, d: 0.84, max: 0.06, g: 0.12 }, { bone: 'crown', k: 0.18, d: 0.85, max: 0.06, g: 0.12 }, { bone: 'chin', k: 0.22, d: 0.84, max: 0.05, g: 0.1 }, { bone: 'lipU', k: 0.3, d: 0.8, max: 0.03, g: 0.08 }, { bone: 'lipD', k: 0.3, d: 0.8, max: 0.03, g: 0.08 }, { bone: 'finL', k: 0.25, d: 0.82, max: 0.04, g: 0.1 }, { bone: 'finR', k: 0.25, d: 0.82, max: 0.04, g: 0.1 }],
  attacks: { jab: L('Jab1'), jab2: L('Jab2'), jab3: L('Jab3'), ftilt: L('TongueFlick'), utilt: L('SnapUp'), dtilt: L('ToeNibble'), dash: A('RollingHunger', 0.34, 0.52),
    fsmash: L('MegaChomp'), usmash: L('SugarSnap'), dsmash: A('FloorFeast', 0.34, 0.52, 0, 0.9, { spin: 0.5 }),
    nair: A('HungrySpin', 0.2, 0.6), fair: L('FlyingChomp'), bair: L('HeelFlick'), uair: L('SkyBite'), dair: L('JawDrop'),
    grab: L('Grab'), getup: A('GetupSpin', 0.34, 0.54), swingBite: A('SwingBite', 0.02, 0.3), dspec: L('AirCushion'),
    nspec: A('CoalToss', 0.59, 0.6, 0, 1), sspec: A('RopeSwing', 0.1, 0.5, 0, 0.6), uspec: A('BubbleRide', 0.1, 0.5, 0, 0.7), '*': L('Jab1') } };
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), current = JSON.parse(fs.readFileSync(mf, 'utf8'));
current['Chomp Chomp'] = entry; fs.writeFileSync(mf, JSON.stringify(current, null, 1) + '\n'); console.log('manifest: ' + Object.keys(current).join(', '));
