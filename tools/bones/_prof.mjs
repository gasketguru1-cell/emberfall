// node tools/bones/_prof.mjs <glb> y0 y1 step [xc] [xw] -> the front-most and back-most z per height near x = xc (a side profile)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [, , f, a, b, st, xc = '0', xw = '0.03'] = process.argv, doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f), rows = new Map(), p = [];
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) { const P = pr.getAttribute('POSITION'); for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); if (Math.abs(p[0] - xc) > +xw || p[1] < +a || p[1] > +b) continue; const k = Math.floor(p[1] / st); const r = rows.get(k) || { f: -9, bk: 9 }; r.f = Math.max(r.f, p[2]); r.bk = Math.min(r.bk, p[2]); rows.set(k, r); } }
for (const [k, r] of [...rows].sort((x, y) => y[0] - x[0])) console.log((k * st).toFixed(3), 'front', r.f.toFixed(3), 'back', r.bk.toFixed(3));
