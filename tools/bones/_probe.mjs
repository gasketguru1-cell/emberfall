// node tools/bones/_probe.mjs <glb> "<x0,y0,z0,x1,y1,z1>" "<js filter on h,s,v,lum,p>"  -> count, centre, extent of matching points
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import sharp from 'sharp';
const [, , f, bx, flt = 'true'] = process.argv, b = bx.split(',').map(Number), test = new Function('h', 's', 'v', 'lum', 'p', 'return ' + flt);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
  const P = pr.getAttribute('POSITION'), U = pr.getAttribute('TEXCOORD_0'), tex = pr.getMaterial()?.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const p = [], u = [], hit = []; 
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); if (p[0] < b[0] || p[1] < b[1] || p[2] < b[2] || p[0] > b[3] || p[1] > b[4] || p[2] > b[5]) continue; U.getElement(i, u);
    const px = Math.min(info.width - 1, Math.max(0, Math.floor((u[0] % 1 + 1) % 1 * info.width))), py = Math.min(info.height - 1, Math.max(0, Math.floor((u[1] % 1 + 1) % 1 * info.height))), o = (py * info.width + px) * 3;
    const [r, g, bl] = [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn; let h = 0; if (d > 1e-6) h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
    if (test((h * 60 + 360) % 360, mx ? d / mx : 0, mx, r * .3 + g * .6 + bl * .1, p)) hit.push(p.slice()); }
  if (!hit.length) { console.log(m.getName(), 'none'); continue; }
  const c = [0, 1, 2].map(k => hit.reduce((a, q) => a + q[k], 0) / hit.length), lo = [0, 1, 2].map(k => Math.min(...hit.map(q => q[k]))), hi = [0, 1, 2].map(k => Math.max(...hit.map(q => q[k])));
  const fx = a => a.map(v => v.toFixed(3)).join(','); console.log(hit.length + ' pts  centre ' + fx(c) + '  lo ' + fx(lo) + '  hi ' + fx(hi));
}
