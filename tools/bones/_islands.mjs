// node tools/bones/_islands.mjs <glb> "x0,y0,z0,x1,y1,z1" [maxPoints]  -> the separate pieces of mesh inside a box (welded points)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [, , f, bx, mx = '5000'] = process.argv, b = bx.split(',').map(Number);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
  const P = pr.getAttribute('POSITION'), n = P.getCount(), idx = pr.getIndices().getArray(), key = new Map(), g = new Int32Array(n), pos = [], p = [];
  for (let i = 0; i < n; i++) { P.getElement(i, p); const k = p.map(v => Math.round(v * 1e4)).join(','); let q = key.get(k); if (q === undefined) { q = pos.length; key.set(k, q); pos.push(p.slice()); } g[i] = q; }
  const par = new Int32Array(pos.length).map((_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(g[idx[t]]), c = find(g[idx[t + 1]]), d = find(g[idx[t + 2]]); par[c] = a; par[find(d)] = a; }
  const comp = new Map(); pos.forEach((q, i) => { const r = find(i); let e = comp.get(r); if (!e) comp.set(r, e = { n: 0, inBox: 0, lo: [9, 9, 9], hi: [-9, -9, -9], s: [0, 0, 0] }); e.n++; if (q[0] >= b[0] && q[1] >= b[1] && q[2] >= b[2] && q[0] <= b[3] && q[1] <= b[4] && q[2] <= b[5]) e.inBox++; for (let k = 0; k < 3; k++) { e.lo[k] = Math.min(e.lo[k], q[k]); e.hi[k] = Math.max(e.hi[k], q[k]); e.s[k] += q[k]; } });
  const fx = a => a.map(v => v.toFixed(3)).join(',');
  for (const e of [...comp.values()].filter(e => e.inBox && e.n <= +mx).sort((a, c) => c.inBox - a.inBox).slice(0, 12)) console.log(e.n + ' pts (' + e.inBox + ' in box)  centre ' + fx(e.s.map(v => v / e.n)) + '  lo ' + fx(e.lo) + '  hi ' + fx(e.hi));
  console.log('pieces in all: ' + comp.size);
}
