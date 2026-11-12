// The Furious Fowls share one skeleton (body, beak, crest, tail, wingL/R, footL/R) but each bird is its own model, so
// this builds each bird's 30 bones from its own mesh: it measures where the crest, the tail and the wings actually lie
// (the points those bones lead), where the beak's tip is, where the feet are, and takes the eyes from the bird's file.
//   face (8):  eyeL/R blink, squint and shut; browL/R furrow and lift; jaw (the lower beak) opens; cheekL/R puff;
//              chin (the throat under the beak) swells to squawk
//   crest (6): a four-link crest that swings, and its two side lobes on their own springs
//   tail (5):  a three-link tail and its two side lobes
//   wings (6): each wing in two links (it flares, flaps, folds) and its outer feather
//   body (5):  the belly jiggles and breathes; the rump bounces; the nape (the back of the head) ruffles; toeL/R tap,
//              curl and splay
// Each face and body bone hangs from whichever old bone leads most of its patch, and takes weight only from that bone,
// so nothing shears where a patch fades out.
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { sphere, ellipsoid, capsule, half, all, pulse, blinks, wobble, V } from './_lib.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s), sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }, r3 = a => a.map(v => +v.toFixed(3));

/* every point of the mesh with the bone that leads it */
async function measure(file) {
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path.join(ROOT, file)), root = doc.getRoot();
  const jn = root.listSkins()[0].listJoints().map(j => j.getName()), pts = [];
  const head = Object.fromEntries(root.listNodes().map(n => [n.getName(), n.getWorldTranslation()]));
  for (const m of root.listMeshes()) for (const pr of m.listPrimitives()) {
    const P = pr.getAttribute('POSITION'), J = pr.getAttribute('JOINTS_0'), W = pr.getAttribute('WEIGHTS_0'), p = [], j = [], w = [];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); J.getElement(i, j); W.getElement(i, w); let k = 0; for (let q = 1; q < 4; q++) if (w[q] > w[k]) k = q; pts.push({ p: p.slice(), top: jn[j[k]] }); }
  }
  return { pts, head };
}
/* an appendage's run: from its root (where its bone sits) out to the centre of its farthest tenth, and the second axis
   (the way it fans out across that run), with how far it spreads either way along it */
function axes(P, from) {
  const c = [0, 1, 2].map(k => P.reduce((s, q) => s + q[k], 0) / P.length);
  const far = P.map(q => [Math.hypot(...sub(q, from)), q]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(3, Math.floor(P.length * 0.1))).map(x => x[1]);
  const tipC = [0, 1, 2].map(k => far.reduce((s, q) => s + q[k], 0) / far.length), a1 = norm(sub(tipC, from));
  const t = P.map(q => dot(sub(q, from), a1)).sort((x, y) => x - y), lo = Math.max(0, t[Math.floor(t.length * 0.02)]), hi = dot(sub(tipC, from), a1);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const q of P) { let d = sub(q, c); d = add(d, a1, -dot(d, a1)); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
  let a2 = [0.9, 0.1, 0.3]; a2 = add(a2, a1, -dot(a2, a1)); for (let i = 0; i < 60; i++) { a2 = norm([0, 1, 2].map(a => dot(C[a], a2))); a2 = norm(add(a2, a1, -dot(a2, a1))); }
  const t2 = P.map(q => dot(sub(q, c), a2)).sort((x, y) => x - y);
  return { c, a1, a2, base: add(from, a1, lo), tip: add(from, a1, hi), len: hi - lo, lo2: t2[Math.floor(t2.length * 0.1)], hi2: t2[Math.floor(t2.length * 0.9)] };
}

/* 0 below a, 1 above b: a base bone's stray sliver of weight (auto weights leak a little everywhere) stays on it */
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
export async function fowl(o) {
  const { pts, head } = await measure(o.in), at = n => head[n];
  const owned = n => pts.filter(q => q.top === n).map(q => q.p);
  const [eL, eR] = o.eyes, mid = (eL[0] + eR[0]) / 2, ez = o.eyeZ;
  /* the beak's tip: the front-most point near the middle of the face below the eyes */
  const face = pts.filter(q => Math.abs(q.p[0] - mid) < 0.1 && q.p[1] < eL[1] && q.p[1] > eL[1] - 0.45).sort((a, b) => b.p[2] - a.p[2]);
  const tip = face[0].p, beakY = o.beakY ?? tip[1] + 0.02;
  /* the front of the surface at (x, y): the nearest point to the camera within 3 cm */
  const frontAt = (x, y) => { let z = -9; for (const q of pts) if (Math.abs(q.p[0] - x) < 0.03 && Math.abs(q.p[1] - y) < 0.03 && q.p[2] > z) z = q.p[2]; return z > -9 ? z : ez; };
  const bones = [], weights = [], springs = [];
  const B = (name, parent, h, t, why) => bones.push({ name, parent, head: r3(h), tail: r3(t), why });

  /* ---- face ---- */
  const eyeR0 = o.eyeR || 0.075;
  for (const [e, k, s] of [[eL, 'L', 1], [eR, 'R', -1]]) {
    const c = [e[0], e[1], frontAt(e[0], e[1]) - 0.02];
    B('eye' + k, 'beak', c, add(c, Y, 0.1), 'the ' + (k === 'L' ? 'left' : 'right') + ' eye: blinks, squints on a strike, shuts when hit');
    weights.push({ bone: 'eye' + k, from: ['beak', 'body', 'crest'], f: all(ellipsoid(c, [eyeR0 + 0.04, eyeR0 + 0.05, 0.3], 0.45), half([0, 0, c[2] - 0.2], Z, 0.06), half([0, c[1] + eyeR0 + 0.03, 0], [0, -1, 0], 0.03)) });
    const bc = [c[0], c[1] + eyeR0 + 0.075, 0]; bc[2] = frontAt(bc[0], bc[1]) - 0.02;
    B('brow' + k, 'beak', add(bc, [-s * 0.06, 0, 0]), add(bc, [s * 0.06, 0, 0]), 'the ' + (k === 'L' ? 'left' : 'right') + ' brow: knits down to glare, jumps up when hit');
    weights.push({ bone: 'brow' + k, from: ['beak', 'body', 'crest'], f: all(ellipsoid(bc, [(eyeR0 + 0.07) * (o.browS || 1), 0.075 * (o.browS || 1), 0.3], 0.5), half([0, 0, bc[2] - 0.2], Z, 0.06)) });
    const cc = [c[0] + s * 0.07, c[1] - eyeR0 - 0.1, 0]; cc[2] = frontAt(cc[0], cc[1]) - 0.02;
    B('cheek' + k, 'beak', cc, add(cc, [s * 0.08, 0, 0]), 'the ' + (k === 'L' ? 'left' : 'right') + ' cheek: puffs out when hit or blowing');
    weights.push({ bone: 'cheek' + k, from: ['beak', 'body'], f: all(ellipsoid(cc, [0.13 * (o.cheekS || 1), 0.11 * (o.cheekS || 1), 0.3], 0.5), half([0, 0, cc[2] - 0.2], Z, 0.06), half([mid + s * 0.06, 0, 0], [s, 0, 0], 0.04)) });
  }
  const jh = [mid, beakY, tip[2] - (o.beakLen || 0.2)];
  B('jaw', 'beak', jh, [mid, tip[1] - 0.05, tip[2] - 0.03], 'the lower beak: opens to squawk, peck and gasp');
  weights.push({ bone: 'jaw', from: ['beak', 'body'], f: all(capsule(jh, [mid, tip[1] - 0.04, tip[2]], 0.06, 0.1), half([0, beakY, 0], [0, -1, 0], 0.015), half([0, 0, jh[2] - 0.02], Z, 0.04)) });
  const ch = [mid, beakY - 0.1, tip[2] - 0.24];
  B('chin', 'beak', ch, add(ch, [0, -0.1, 0.02]), 'the throat under the beak: swallows, swells to squawk');
  const cz = frontAt(mid, beakY - 0.16);
  weights.push({ bone: 'chin', from: ['beak', 'body'], f: all(ellipsoid([mid, beakY - 0.16, cz - 0.04], [0.16 * (o.chinS || 1), 0.11 * (o.chinS || 1), 0.25], 0.5), half([0, beakY - 0.05, 0], [0, -1, 0], 0.03), half([0, 0, cz - 0.18], Z, 0.05)) });

  /* ---- crest: four links from its root to its tip, and the lobes either side of its middle ---- */
  const cr = axes(owned('crest'), at('crest')), CR = ['crest1', 'crest2', 'crest3', 'crest4'];
  const cp = i => add(cr.base, cr.a1, cr.len * i / 4);
  CR.forEach((n, i) => B(n, i ? CR[i - 1] : 'crest', cp(i), cp(i + 1), 'the crest, link ' + (i + 1) + ' of four: swings and whips'));
  weights.push({ chain: CR, from: ['crest'], f: (p, G) => ramp(G.w('crest'), 0.1, 0.3) });
  for (const [k, s] of [['A', 1], ['B', -1]]) {
    const lc = add(cp(2), cr.a2, s * 0.06);
    B('crest' + k, 'crest1', cp(1), add(lc, cr.a1, cr.len * 0.3), 'the crest\'s ' + (s > 0 ? 'one' : 'other') + ' side lobe: swings on its own');
    weights.push({ bone: 'crest' + k, from: CR, f: all(half(add(cr.c, cr.a2, (s > 0 ? cr.hi2 : cr.lo2) * 0.5), cr.a2.map(v => v * s), 0.04), half(cp(1), cr.a1, 0.06)) });
  }
  springs.push({ bones: CR, k: 0.22, d: 0.7, max: 0.5, drag: 0.1 }, { bones: ['crestA'], k: 0.28, d: 0.68, max: 0.4, drag: 0.08 }, { bones: ['crestB'], k: 0.28, d: 0.68, max: 0.4, drag: 0.08 });

  /* ---- tail ---- */
  const tl = axes(owned('tail'), at('tail')), TL = ['tail1', 'tail2', 'tail3'];
  const tp = i => add(tl.base, tl.a1, tl.len * i / 3);
  TL.forEach((n, i) => B(n, i ? TL[i - 1] : 'tail', tp(i), tp(i + 1), 'the tail, link ' + (i + 1) + ' of three: wags and whips'));
  weights.push({ chain: TL, from: ['tail'], f: (p, G) => (G.w('tail') > 0.02 ? 1 : 0) });
  for (const [k, s] of [['A', 1], ['B', -1]]) {
    B('tail' + k, 'tail1', tp(1), add(add(tp(2), tl.a2, s * 0.08), tl.a1, tl.len * 0.3), 'the tail\'s ' + (s > 0 ? 'one' : 'other') + ' side feather: fans out on its own');
    weights.push({ bone: 'tail' + k, from: TL, f: all(half(add(tl.c, tl.a2, (s > 0 ? tl.hi2 : tl.lo2) * 0.5), tl.a2.map(v => v * s), 0.04), half(tp(1), tl.a1, 0.06)) });
  }
  springs.push({ bones: TL, k: 0.24, d: 0.7, max: 0.45, drag: 0.1 }, { bones: ['tailA'], k: 0.3, d: 0.68, max: 0.4, drag: 0.08 }, { bones: ['tailB'], k: 0.3, d: 0.68, max: 0.4, drag: 0.08 });

  /* ---- wings: from the shoulder out to the tip, and the outermost feather ---- */
  const wing = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    /* a wing whose own bone leads (almost) nothing in the base model takes the mirror of the other wing */
    const other = k === 'L' ? 'R' : 'L', mirror = owned('wing' + k).length < 50, WP = mirror ? owned('wing' + other).map(q => [-q[0], q[1], q[2]]) : owned('wing' + k);
    const cell = q => q.map(v => Math.round(v / 0.04)).join(','), HS = new Set(WP.map(cell));
    const inWing = p => { const b = [p.x, p.y, p.z].map(v => Math.round(v / 0.04)); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) if (HS.has([b[0] + i, b[1] + j, b[2] + l].join(','))) return 1; return 0; };
    const wa = axes(WP, at('wing' + k)); wing[k] = wa;
    const w1 = add(wa.base, wa.a1, wa.len * 0.35), w2 = add(wa.base, wa.a1, wa.len * 0.7), wt = add(wa.base, wa.a1, wa.len);
    B('wing' + k + '1', 'wing' + k, w1, w2, 'the ' + (k === 'L' ? 'left' : 'right') + ' wing, middle: flares, flaps, folds');
    B('wing' + k + '2', 'wing' + k + '1', w2, wt, 'the ' + (k === 'L' ? 'left' : 'right') + ' wing, tip: follows through');
    weights.push(mirror ? { chain: ['wing' + k + '1', 'wing' + k + '2'], from: ['body', 'beak', 'foot' + k, 'wing' + k], loose: ['body', 'beak', 'foot' + k], f: p => inWing(p) * half(w1, wa.a1, 0.08)(p) }
      : { chain: ['wing' + k + '1', 'wing' + k + '2'], from: ['wing' + k], f: (p, G) => ramp(G.w('wing' + k), 0.12, 0.32) * half(w1, wa.a1, 0.08)(p) });
    const out = norm([s, 0, 0]), side = dot(wa.a2, out) >= 0 ? wa.a2 : wa.a2.map(v => -v);
    B('feather' + k, 'wing' + k + '1', w2, add(add(wt, side, 0.05), wa.a1, 0.06), 'the ' + (k === 'L' ? 'left' : 'right') + ' wing\'s outer feather: flicks on its own');
    weights.push({ bone: 'feather' + k, from: ['wing' + k + '1', 'wing' + k + '2'], f: all(half(add(wa.c, side, (dot(side, wa.a2) > 0 ? wa.hi2 : -wa.lo2) * 0.5), side, 0.04), half(w2, wa.a1, 0.05)) });
    springs.push({ bones: ['wing' + k + '1', 'wing' + k + '2'], k: 0.3, d: 0.7, max: 0.3, drag: 0.08 }, { bones: ['feather' + k], k: 0.32, d: 0.66, max: 0.35, drag: 0.06 });
  }

  /* ---- body: the belly in front, the rump behind, the nape at the back of the head; the toes ---- */
  const front = y => Math.max(...pts.filter(q => Math.abs(q.p[0] - mid) < 0.08 && Math.abs(q.p[1] - y) < 0.04).map(q => q.p[2]));
  const back = y => { const col = pts.filter(q => Math.abs(q.p[0] - mid) < 0.2 && Math.abs(q.p[1] - y) < 0.04), own = col.filter(q => q.top !== 'tail' && q.p[2] < 0);
    return own.length >= 3 ? Math.min(...own.map(q => q.p[2])) : Math.min(...col.filter(q => q.p[2] > tl.base[2] - 0.03).map(q => q.p[2])); };
  const yb = o.bellyY ?? eL[1] * 0.42, yn = o.napeY ?? eL[1], yr = o.rumpY ?? yb;
  const bh = [mid, yb, front(yb) - 0.12], nh = [mid, yn, back(yn) + 0.1], rh = [mid, yr, back(yr) + 0.12];
  B('belly', 'body', bh, add(bh, Z, 0.12), 'the round belly: jiggles, breathes'); B('nape', 'body', nh, add(nh, [0, 0.04, -0.1]), 'the back of the head: ruffles up when hit, settles');
  B('rump', 'body', rh, add(rh, Z, -0.12), 'the rump: bounces when landing and running');
  const PRE = n => (p, G) => (G.w(n) > 0 ? 1 : 0);
  const FB = ['body', 'beak', 'footL', 'footR', 'wingL', 'wingR'];
  weights.push({ bone: 'belly', from: FB, f: all(ellipsoid([mid, yb, front(yb) - 0.05], [0.26, 0.2, 0.22], 0.5), half([0, 0, bh[2] - 0.02], Z, 0.08)), loose: FB });
  weights.push({ bone: 'nape', from: FB, f: all(ellipsoid([mid, yn, back(yn) + 0.05], [0.22, 0.15, 0.22], 0.5), half([0, 0, nh[2] + 0.02], [0, 0, -1], 0.08)) });
  weights.push({ bone: 'rump', from: FB.concat(['tail']), f: all(ellipsoid([mid, yr, back(yr) + 0.05], [0.24, 0.2, 0.22], 0.5), half([0, 0, rh[2] + 0.02], [0, 0, -1], 0.08)), loose: FB.concat(['tail']) });
  springs.push({ bones: ['belly'], k: 0.3, d: 0.6, max: 0.12, drag: 0.03 }, { bones: ['nape'], k: 0.3, d: 0.62, max: 0.15, drag: 0.04 }, { bones: ['rump'], k: 0.3, d: 0.6, max: 0.12, drag: 0.03 });
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const F = owned('foot' + k).filter(q => q[1] < 0.1), fx = F.reduce((a, q) => a + q[0], 0) / F.length, z0 = Math.min(...F.map(q => q[2])), z1 = Math.max(...F.map(q => q[2])), zm = (z0 + z1) / 2;
    B('toe' + k, 'foot' + k, [fx, 0.05, zm], [fx, 0.03, z1], 'the ' + (k === 'L' ? 'left' : 'right') + ' toes: tap, grip, curl up in the air, splay on landing');
    weights.push({ bone: 'toe' + k, from: ['foot' + k], f: all((p, G) => (p.y < 0.13 ? 1 : 0), half([0, 0, zm], Z, 0.05), sphere([fx, 0.05, z1 - 0.05], 0.12, 0.25)) });
  }

  /* ---- what the keyed ones do ---- */
  const SHUT = [{ s: [1, 0.12, 1] }], SQUINT = [{ s: [1, 0.55, 1] }], OPEN = [{ s: [1, 1, 1] }], WIDE = [{ s: [1.1, 1.18, 1] }];
  const ANGRY = o.angry ?? 14;   // how hard the brows knit on a strike (a frowning bird gets more)
  function keys(c) {
    const k = {}, d = c.dur, put = (n, v) => { k[n] = v; };
    const browKeys = (seq) => { for (const sd of 'LR') put('brow' + sd, seq.map(([t, a]) => [t, [[Z, sd === 'L' ? a : -a]]])); };
    if (c.kind === 'attack') {
      const [c0, c1] = c.contact, s = Math.max(0, Math.min(c.start, c0 - 0.15)), e = Math.min(d, c1 + 0.25), w = Math.max(s + 0.02, c0 - 0.1);
      const peck = /Peck|Snatch|Lunge|Dive|Bash/.test(c.name), blow = /Puff|Flap|Fly/.test(c.name);
      for (const sd of 'LR') put('eye' + sd, pulse(s, w, c1, e, SQUINT, OPEN));
      browKeys([[0, 0], [s, 0], [w, ANGRY], [c1, ANGRY], [e, 0], [d, 0]].filter((q, i, A) => i === 0 || q[0] > A[i - 1][0] + 1e-6));
      put('jaw', pulse(s, w, c1, e, [[X, peck ? 14 : blow ? 30 : 24]]));
      put('chin', pulse(s, w, c1, e, [{ s: [1.15, 1.2, 1.15] }]));
      if (blow) for (const sd of 'LR') put('cheek' + sd, pulse(s, w, c1, e, [{ s: [1.25, 1.2, 1.25] }]));
      /* the wings flare out on the strike (flaps get a real beat) */
      const fl = blow ? 30 : 16;
      put('wingL1', pulse(s, w, c1, e, [[Z, fl]])); put('wingR1', pulse(s, w, c1, e, [[Z, -fl]]));
      for (const sd of 'LR') put('toe' + sd, pulse(s, w, c1, e, [[X, 10]]));   // grip the ground
    } else if (c.kind === 'hit') {
      const t = Math.min(0.22, d * 0.4);
      for (const sd of 'LR') { put('eye' + sd, [[0, OPEN], [0.04, SHUT], [t, SHUT], [Math.min(d, t + 0.12), WIDE], [d, OPEN]]); put('cheek' + sd, pulse(0, 0.05, t, d, [{ s: [1.2, 1.15, 1.2] }])); }
      browKeys([[0, 0], [0.05, -18], [t, -18], [d, 0]]);
      put('nape', pulse(0, 0.05, t, d, [{ s: [1.1, 1.15, 1.12] }]));   // the feathers stand up
      put('jaw', pulse(0, 0.05, t, d, [[X, 30]])); put('chin', pulse(0, 0.05, t, d, [{ s: [1.1, 1.15, 1.1] }]));
      put('wingL1', pulse(0, 0.05, t, d, [[Z, 28]])); put('wingR1', pulse(0, 0.05, t, d, [[Z, -28]]));
      for (const sd of 'LR') put('toe' + sd, pulse(0, 0.05, t, d, [[X, -22]]));   // toes splay up
    } else {
      if (c.kind === 'idle' || /Select|Respawn|Ledge|Held/.test(c.name)) for (const sd of 'LR') put('eye' + sd, blinks(d, d > 1.6 ? [0.3, 0.78] : d > 0.6 ? [0.55] : [], SHUT, OPEN));
      if (c.kind === 'idle') {
        put('belly', [[0, OPEN], [d * 0.5, [{ s: [1.04, 1.03, 1.07] }]], [d, OPEN]]);   // breathing
        const t = d * 0.6; if (t > 0.2 && t < d - 0.3) put('toeL', [[0, []], [t, []], [t + 0.08, [[X, -16]]], [t + 0.16, []], [t + 0.24, [[X, -12]]], [t + 0.32, []], [d, []]]);
        if (/Idle2/.test(c.name)) browKeys([[0, 0], [d * 0.3, 0], [d * 0.4, ANGRY * 0.7], [d * 0.7, ANGRY * 0.7], [d * 0.8, 0], [d, 0]]);
      }
      if (/Run|Hop|Fly/.test(c.name)) { put('wingL1', wobble(d, Z, 10, d)); put('wingR1', wobble(d, Z, -10, d)); }
      if (/Rise|Fall|Tumble|AirDodge|Launch/.test(c.name)) { for (const sd of 'LR') put('toe' + sd, [[0, [[X, 22]]], [d, [[X, 22]]]]); }   // toes curled in the air
      if (/Land/.test(c.name)) { const h = /Hard/.test(c.name) ? 1.6 : 1; for (const sd of 'LR') put('toe' + sd, pulse(0, 0.04, 0.1, Math.min(d, 0.3), [[X, -14 * h]])); put('wingL1', pulse(0, 0.04, 0.1, Math.min(d, 0.32), [[Z, 14 * h]])); put('wingR1', pulse(0, 0.04, 0.1, Math.min(d, 0.32), [[Z, -14 * h]])); }
      if (/Fly/.test(c.name)) for (const sd of 'LR') put('toe' + sd, [[0, [[X, 22]]], [d, [[X, 22]]]]);
    }
    return k;
  }
  /* the face and body patches hang from the old bone that leads most of the patch, and take weight only from it */
  const AUTO = new Set(['eyeL', 'eyeR', 'browL', 'browR', 'cheekL', 'cheekR', 'jaw', 'chin', 'belly', 'nape', 'rump']);
  const dom = f => { const t = {}; for (const q of pts) { const v = f(V(q.p), { w: n => (q.top === n ? 1 : 0), hsv: [0, 0, 0] }); if (v > 0.3 && !['tail', 'crest', 'wingL', 'wingR'].includes(q.top)) t[q.top] = (t[q.top] || 0) + v; } return Object.entries(t).sort((x, y) => y[1] - x[1])[0]?.[0] || 'body'; };
  for (const r of weights) if (r.bone && AUTO.has(r.bone)) { const par = dom(r.f); r.from = [par]; delete r.loose; bones.find(b => b.name === r.bone).parent = par; }
  return { in: o.in, out: o.out, manifest: o.manifest, bones, weights, springs, keys };
}
