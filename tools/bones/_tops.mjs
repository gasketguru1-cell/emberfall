// node tools/bones/_tops.mjs <glb> -> how many points each bone leads, and how many it touches at all (weight > 0.1)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]), jn = doc.getRoot().listSkins()[0].listJoints().map(n => n.getName()), lead = {}, touch = {}, j = [], w = [];
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) { const J = pr.getAttribute('JOINTS_0'), W = pr.getAttribute('WEIGHTS_0'); for (let i = 0; i < J.getCount(); i++) { J.getElement(i, j); W.getElement(i, w); const k = w.indexOf(Math.max(...w)); lead[jn[j[k]]] = (lead[jn[j[k]]] || 0) + 1; for (let q = 0; q < 4; q++) if (w[q] > 0.1) touch[jn[j[q]]] = (touch[jn[j[q]]] || 0) + 1; } }
console.log(jn.map(n => n + ' ' + (lead[n] || 0) + '/' + (touch[n] || 0)).join(', '));
