// node tools/bones/_plane.mjs <glb> x y r  -> centre and facing of the front surface within r of (x, y) seen from the front
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import * as THREE from 'three';
const [, , f, X, Y, R] = process.argv.map((v, i) => i > 2 ? +v : v);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f), pts = [], p = [];
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) { const P = pr.getAttribute('POSITION'); for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); if (Math.hypot(p[0] - X, p[1] - Y) < R && p[2] > 0) pts.push(new THREE.Vector3(...p)); } }
/* keep the front-most layer: per small cell, the largest z */
const cell = new Map(); for (const q of pts) { const k = Math.round(q.x / 0.01) + ',' + Math.round(q.y / 0.01); const o = cell.get(k); if (!o || q.z > o.z) cell.set(k, q); }
const fr = [...cell.values()], c = fr.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(fr.length);
let sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0; for (const q of fr) { const dx = q.x - c.x, dy = q.y - c.y, dz = q.z - c.z; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; sxz += dx * dz; syz += dy * dz; }
const det = sxx * syy - sxy * sxy, a = (sxz * syy - syz * sxy) / det, b = (syz * sxx - sxz * sxy) / det, n = new THREE.Vector3(-a, -b, 1).normalize();
console.log('front points ' + fr.length + '  centre ' + c.toArray().map(v => v.toFixed(3)).join(',') + '  facing ' + n.toArray().map(v => v.toFixed(3)).join(',') + '  z range ' + Math.min(...fr.map(q => q.z)).toFixed(3) + '..' + Math.max(...fr.map(q => q.z)).toFixed(3));
