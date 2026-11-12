import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [, , f, bx, r = '0.08'] = process.argv, b = bx.split(',').map(Number);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const pts = []; for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) { const P = pr.getAttribute('POSITION'), p = []; for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); if (p[0] >= b[0] && p[1] >= b[1] && p[2] >= b[2] && p[0] <= b[3] && p[1] <= b[4] && p[2] <= b[5]) pts.push(p.slice()); } }
const cl = []; for (const p of pts) { let c = cl.find(c => Math.hypot(c.s[0] / c.n - p[0], c.s[2] / c.n - p[2]) < +r); if (!c) cl.push(c = { n: 0, s: [0, 0, 0], lo: 9 }); c.n++; for (let k = 0; k < 3; k++) c.s[k] += p[k]; c.lo = Math.min(c.lo, p[1]); }
for (const c of cl.sort((a, b) => a.s[0] / a.n - b.s[0] / b.n)) console.log(c.n, c.s.map(v => (v / c.n).toFixed(3)).join(','), 'lowY', c.lo.toFixed(3));
