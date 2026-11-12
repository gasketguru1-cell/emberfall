// node tools/bones/_dom.mjs <glb> <bone> [slab axis y] -> where the points that bone leads lie, slab by slab
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [, , f, bone, ax = 'y', step = '0.04'] = process.argv, A = { x: 0, y: 1, z: 2 }[ax], st = +step;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const skin = doc.getRoot().listSkins()[0], jn = skin.listJoints().map(n => n.getName()), want = jn.indexOf(bone);
if (want < 0) { console.log('no bone', bone, jn.join(' ')); process.exit(1); }
const slabs = new Map(), p = [], j = [], w = [];
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
  const P = pr.getAttribute('POSITION'), J = pr.getAttribute('JOINTS_0'), W = pr.getAttribute('WEIGHTS_0'); if (!J) continue;
  for (let i = 0; i < P.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); let k = w.indexOf(Math.max(...w)); if (j[k] !== want) continue; P.getElement(i, p);
    const s = Math.floor(p[A] / st); let e = slabs.get(s); if (!e) slabs.set(s, e = { n: 0, lo: [9, 9, 9], hi: [-9, -9, -9] }); e.n++; for (let q = 0; q < 3; q++) { e.lo[q] = Math.min(e.lo[q], p[q]); e.hi[q] = Math.max(e.hi[q], p[q]); } }
}
for (const [s, e] of [...slabs].sort((a, b) => a[0] - b[0])) console.log(ax + ' ' + (s * st).toFixed(2) + '  n ' + String(e.n).padStart(4) + '  x ' + e.lo[0].toFixed(2) + '..' + e.hi[0].toFixed(2) + '  y ' + e.lo[1].toFixed(2) + '..' + e.hi[1].toFixed(2) + '  z ' + e.lo[2].toFixed(2) + '..' + e.hi[2].toFixed(2));
