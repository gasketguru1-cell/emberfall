// Adds coat and scarf bones to Flint's packed GLB and moves the cloth's skin weights onto them.
//   node tools/cloth.mjs            reads assets/flint/export/flint-v2.glb, writes assets/flint/export/flint-v3.glb
// Why: Meshy's auto-rig weights the coat skirt to the legs (the hem even to the shins), so the hem folds up with the calf
// and the boot comes through it. Here the skirt hangs from the hips on five two-bone chains and the scarf ends from the
// chest on one; the game's follow-through springs (`springs` in the manifest) then make them trail and settle.
// Cloth is told from body by the colour of the texture under each vertex (teal coat, amber scarf) plus where it sits.
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp'; import * as THREE from 'three';

const root0 = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), IN = path.join(root0, 'assets/flint/export/flint-v2.glb'), OUT = path.join(root0, 'assets/flint/export/flint-v3.glb');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* The model stands 1.7 tall, feet at 0, facing +Z, its left at +X. All numbers below are in those units. */
const SKIRT = { top: 0.86, hem: 0.40, split: 0.66, cz: 0.02 };
const CHAINS = [   /* angle round the hips, seen from above: 0 = his left, 90 = front, 180 = his right, 270 = back */
  { name: 'coatFR', a: 115, keep: 0.85 }, { name: 'coatR', a: 180, keep: 0.6 }, { name: 'coatB', a: 270, keep: 0.4 }, { name: 'coatL', a: 360, keep: 0.6 }, { name: 'coatFL', a: 425, keep: 0.85 }];
/* keep: how much of the thigh's pull is left at the hem. The front panels lie on the thighs, so they mostly go with them; the back hangs free. */
const ring = (a, y, rx, rz) => [Math.cos(a * Math.PI / 180) * rx, y, SKIRT.cz + Math.sin(a * Math.PI / 180) * rz];
const SCARF = { top: 1.31, end: 0.92, split: 1.10, bones: [[0.01, 1.29, 0.17], [0.01, 1.10, 0.24]] };
const inLegs = (x, z) => Math.abs(x) < 0.27 && z > -0.17 && z < 0.15;   /* where the trouser legs run, for telling dark lining and buttons from trousers */

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(IN), root = doc.getRoot();
const skin = root.listSkins()[0], joints = skin.listJoints(), jn = joints.map(j => j.getName()), buffer = root.listBuffers()[0];
const node = n => root.listNodes().find(q => q.getName() === n);
if (jn.some(n => n.startsWith('coat'))) throw new Error('cloth: this file already has coat bones');

/* ---- new bones: no turn of their own, so each sits square to its parent and the chain runs through plain offsets ---- */
function addBone(name, parent, world) {
  const inv = new THREE.Matrix4().fromArray(parent.getWorldMatrix()).invert(), p = new THREE.Vector3(...world).applyMatrix4(inv);
  const n = doc.createNode(name).setTranslation([p.x, p.y, p.z]); parent.addChild(n); joints.push(n); jn.push(name); skin.addJoint(n); return n;
}
const hips = node('Hips'), chest = node('Spine');
for (const c of CHAINS) {
  const b1 = addBone(c.name + '1', hips, ring(c.a, 0.84, 0.19, 0.14)); addBone(c.name + '2', b1, ring(c.a, SKIRT.split - 0.04, 0.27, 0.20));
  c.i1 = jn.indexOf(c.name + '1'); c.i2 = c.i1 + 1;
}
const s1 = addBone('scarf1', chest, SCARF.bones[0]); addBone('scarf2', s1, SCARF.bones[1]); const iS1 = jn.indexOf('scarf1'), iS2 = iS1 + 1;
const ibm = new Float32Array(joints.length * 16); ibm.set(skin.getInverseBindMatrices().getArray());
for (let k = jn.indexOf('coatFR1'); k < joints.length; k++) ibm.set(new THREE.Matrix4().fromArray(joints[k].getWorldMatrix()).invert().elements, k * 16);
skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));

/* ---- which vertices are cloth ---- */
const prim = root.listMeshes()[0].listPrimitives()[0], tex = prim.getMaterial().getBaseColorTexture();
const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const P = prim.getAttribute('POSITION'), U = prim.getAttribute('TEXCOORD_0'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), n = P.getCount();
const isArm = jn.map(x => /Arm|Hand|Shoulder/.test(x)), isShin = jn.map(x => /^(Left|Right)(Leg|Foot|ToeBase)$/.test(x)), isThigh = jn.map(x => /UpLeg/.test(x));
const p = [], u = [], j = [], w = [];
/* The mesh is split along texture seams, so several vertices can share one point. They must get the same weights or the
   surface tears, so everything below is decided per point, not per vertex. */
const gid = new Int32Array(n), groups = [], seen = new Map();
for (let i = 0; i < n; i++) {
  P.getElement(i, p); U.getElement(i, u); J.getElement(i, j); W.getElement(i, w);
  const key = p.map(v => Math.round(v * 1e5)).join(','); let g = seen.get(key);
  if (g === undefined) {
    g = groups.length; seen.set(key, g);
    const m = new Map(); for (let k = 0; k < 4; k++) if (w[k] > 0) m.set(j[k], (m.get(j[k]) || 0) + w[k]);
    let arm = 0; for (const [q, v] of m) if (isArm[q]) arm += v;
    groups.push({ x: p[0], y: p[1], z: p[2], m, arm, n: 0, teal: 0, amber: 0, nb: new Set(), kind: '' });
  }
  gid[i] = g; const G = groups[g]; G.n++;
  const px = clamp(Math.floor((u[0] - Math.floor(u[0])) * info.width), 0, info.width - 1), py = clamp(Math.floor((u[1] - Math.floor(u[1])) * info.height), 0, info.height - 1), o = (py * info.width + px) * 3;
  const r = data[o], g2 = data[o + 1], b = data[o + 2]; if (g2 - r > 18 && b - r > 15) G.teal++; if (r > 150 && r - b > 70 && g2 > 80) G.amber++;
}
const idx = prim.getIndices().getArray();
for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = gid[idx[t + k]], b = gid[idx[t + (k + 1) % 3]]; if (a !== b) { groups[a].nb.add(b); groups[b].nb.add(a); } }
for (const G of groups) {
  const band = G.y > 0.33 && G.y < SKIRT.top && Math.abs(G.x) < 0.42 && G.arm < 0.25; G.band = band;
  if (band && (G.teal * 2 >= G.n || (!inLegs(G.x, G.z) && G.amber * 2 < G.n))) G.kind = 'skirt';
  else if (G.amber * 2 >= G.n && G.y > SCARF.end - 0.03 && G.y < SCARF.top && Math.abs(G.x) < 0.14 && G.z > 0.12 && G.arm < 0.25) G.kind = 'scarf';
}
/* tidy stray points: one the colour test missed inside the coat joins it, a lone one outside leaves it */
for (let pass = 0; pass < 3; pass++) {
  const next = groups.map(G => { if (!G.band || G.kind === 'scarf' || !G.nb.size) return G.kind; let c = 0; for (const q of G.nb) if (groups[q].kind === 'skirt') c++; const f = c / G.nb.size; return f >= 0.6 ? 'skirt' : f <= 0.25 ? '' : G.kind; });
  groups.forEach((G, k) => { G.kind = next[k]; });
}
let nSkirt = 0, nScarf = 0, cut = 0;
for (const G of groups) {
  const m = G.m, { x, y, z } = G;
  if (G.kind === 'skirt') {
    nSkirt++;
    const t = (SKIRT.top - y) / (SKIRT.top - SKIRT.hem), s = smooth(t); let rest = 0;
    let a = Math.atan2(z - SKIRT.cz, x) * 180 / Math.PI; if (a < 90) a += 360; a = clamp(a, CHAINS[0].a, CHAINS[CHAINS.length - 1].a);
    let k = 0; while (k < CHAINS.length - 2 && a > CHAINS[k + 1].a) k++;
    const f = smooth((a - CHAINS[k].a) / (CHAINS[k + 1].a - CHAINS[k].a)), low = smooth((SKIRT.split + 0.1 - y) / 0.2), keep = CHAINS[k].keep * (1 - f) + CHAINS[k + 1].keep * f;
    for (const [q, v] of m) { const nv = isShin[q] ? v * (1 - clamp(t * 3, 0, 1)) : isThigh[q] ? v * (1 - (1 - keep) * s) : v; m.set(q, nv); rest += nv; }
    const cloth = Math.max(0, 1 - rest);
    for (const [c, share] of [[CHAINS[k], 1 - f], [CHAINS[k + 1], f]]) { if (share * cloth * (1 - low) > 0) m.set(c.i1, share * cloth * (1 - low)); if (share * cloth * low > 0) m.set(c.i2, share * cloth * low); }
  } else if (G.kind === 'scarf') {
    nScarf++;
    const s = smooth((SCARF.top - y) / (SCARF.top - SCARF.end - 0.1)) * 0.92, low = smooth((SCARF.split + 0.08 - y) / 0.16);
    for (const [q, v] of m) m.set(q, v * (1 - s));
    m.set(iS1, s * (1 - low)); if (low > 0) m.set(iS2, s * low);
  }
}
/* even the cloth's weights out with its neighbours, so no single point moves on its own */
for (let pass = 0; pass < 2; pass++) {
  const next = groups.map(G => {
    if (!G.kind) return G.m; const nb = [...G.nb].filter(q => groups[q].kind === G.kind); if (!nb.length) return G.m;
    const m = new Map(); for (const [q, v] of G.m) m.set(q, v * 0.5);
    for (const q of nb) for (const [b, v] of groups[q].m) m.set(b, (m.get(b) || 0) + v * 0.5 / nb.length);
    return m;
  });
  groups.forEach((G, k) => { G.m = next[k]; });
}
const Jn = new Uint8Array(n * 4), Wn = new Float32Array(n * 4);
for (const G of groups) { const top = [...G.m].filter(e => e[1] > 1e-4).sort((a, b) => b[1] - a[1]); if (top.length > 4) cut++; G.use = top.slice(0, 4); G.sum = G.use.reduce((a, e) => a + e[1], 0); }
for (let i = 0; i < n; i++) { const G = groups[gid[i]]; for (let k = 0; k < 4; k++) { Jn[i * 4 + k] = G.use[k] ? G.use[k][0] : 0; Wn[i * 4 + k] = G.use[k] ? G.use[k][1] / G.sum : 0; } }
prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(Jn).setBuffer(buffer));
prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(Wn).setBuffer(buffer));
J.dispose(); W.dispose();
await io.write(OUT, doc);
console.log('cloth: ' + nSkirt + ' coat vertices, ' + nScarf + ' scarf vertices, ' + cut + ' trimmed to four bones, ' + groups.length + ' welded points; ' + joints.length + ' bones -> ' + path.relative(root0, OUT));
