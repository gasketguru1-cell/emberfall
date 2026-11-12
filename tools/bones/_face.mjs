// node tools/bones/_face.mjs <glb> y0 y1 [x0 x1 step]  -> an ASCII map of the front surface (the nearest point per cell):
// W white, K black/dark, o orange-yellow, r red, b blue/teal, p pink, . other; rows are y (top first), columns x (left of
// the picture = -x)
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import sharp from 'sharp';
const [, , f, ya = '0.6', yb = '1.4', xa = '-0.5', xb = '0.5', st = '0.025'] = process.argv, [y0, y1, x0, x1, s] = [ya, yb, xa, xb, st].map(Number);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(f);
const nx = Math.round((x1 - x0) / s), ny = Math.round((y1 - y0) / s), best = new Map();
for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
  const P = pr.getAttribute('POSITION'), U = pr.getAttribute('TEXCOORD_0'), tex = pr.getMaterial()?.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const p = [], u = [];
  for (let i = 0; i < P.getCount(); i++) { P.getElement(i, p); const cx = Math.floor((p[0] - x0) / s), cy = Math.floor((p[1] - y0) / s); if (cx < 0 || cy < 0 || cx >= nx || cy >= ny) continue;
    const key = cx + ',' + cy, b = best.get(key); if (b && b.z >= p[2]) continue; U.getElement(i, u);
    const px = Math.min(info.width - 1, Math.max(0, Math.floor((u[0] % 1 + 1) % 1 * info.width))), py = Math.min(info.height - 1, Math.max(0, Math.floor((u[1] % 1 + 1) % 1 * info.height))), o = (py * info.width + px) * 3;
    const [r, g, bl] = [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn; let h = 0; if (d > 1e-6) h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    const sat = mx ? d / mx : 0, c = mx < 0.22 ? 'K' : sat < 0.15 && mx > 0.75 ? 'W' : sat < 0.25 ? '.' : h < 15 || h > 345 ? 'r' : h < 50 ? 'o' : h > 160 && h < 260 ? 'b' : h >= 260 ? 'p' : '.';
    best.set(key, { z: p[2], c }); } }
console.log('      ' + Array.from({ length: nx }, (_, i) => (Math.abs(x0 + i * s) < 1e-6 ? '|' : ' ')).join(''));
for (let j = ny - 1; j >= 0; j--) console.log((y0 + j * s).toFixed(3) + ' ' + Array.from({ length: nx }, (_, i) => best.get(i + ',' + j)?.c || ' ').join(''));
