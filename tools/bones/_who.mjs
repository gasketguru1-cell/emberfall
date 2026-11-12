// node tools/bones/_who.mjs <glb> "<x0,y0,z0,x1,y1,z1>" "<js filter on h,s,v,p>" -> which bones lead the matching points
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import sharp from 'sharp';
const [, , f, bx, flt = 'true'] = process.argv, b = bx.split(',').map(Number), test = new Function('h', 's', 'v', 'p', 'return ' + flt);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f), jn = doc.getRoot().listSkins()[0].listJoints().map(n => n.getName()), cnt = {}, lo = [9, 9, 9], hi = [-9, -9, -9];
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
  const P = pr.getAttribute('POSITION'), U = pr.getAttribute('TEXCOORD_0'), J = pr.getAttribute('JOINTS_0'), W = pr.getAttribute('WEIGHTS_0'), tex = pr.getMaterial()?.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const p = [], u = [], j = [], w = [];
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); if (p[0] < b[0] || p[1] < b[1] || p[2] < b[2] || p[0] > b[3] || p[1] > b[4] || p[2] > b[5]) continue; U.getElement(i, u);
    const px = Math.min(info.width - 1, Math.max(0, Math.floor((u[0] % 1 + 1) % 1 * info.width))), py = Math.min(info.height - 1, Math.max(0, Math.floor((u[1] % 1 + 1) % 1 * info.height))), o = (py * info.width + px) * 3;
    const [r, g, bl] = [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255], mx = Math.max(r, g, bl), d = mx - Math.min(r, g, bl); let h = 0; if (d > 1e-6) h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
    if (!test((h * 60 + 360) % 360, mx ? d / mx : 0, mx, p)) continue; J.getElement(i, j); W.getElement(i, w);
    for (let q = 0; q < 4; q++) if (w[q] > 0.05) cnt[jn[j[q]]] = (cnt[jn[j[q]]] || 0) + w[q]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } } }
console.log('bbox', lo.map(v => v.toFixed(2)).join(','), '..', hi.map(v => v.toFixed(2)).join(','), ' weight by bone:', Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(e => e[0] + ' ' + e[1].toFixed(0)).join(', '));
