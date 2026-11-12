// Draws front, side and top projections of a GLB's vertices (coloured from its base texture) with a 0.1 m grid.
//   node proj.mjs <model.glb> <base_color.png> <out prefix> [yaw degrees] [ymin ymax xmin xmax zmin zmax]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const [file, texFile, out, yawS, ...clip] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(file);
const tex = await sharp(texFile).resize(1024, 1024).raw().toBuffer({ resolveWithObject: true }), ch = tex.info.channels;
const yaw = (+yawS || 0) * Math.PI / 180, P = [];
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices(), a = [0, 0, 0], b = [0, 0];
  const get = k => { pos.getElement(k, a); if (uv) uv.getElement(k, b); const x = a[0] * Math.cos(yaw) + a[2] * Math.sin(yaw), z = -a[0] * Math.sin(yaw) + a[2] * Math.cos(yaw);
    const tx = Math.min(1023, Math.max(0, Math.floor(b[0] * 1024))), ty = Math.min(1023, Math.max(0, Math.floor(b[1] * 1024))), o = (ty * 1024 + tx) * ch; return [x, a[1], z, tex.data[o], tex.data[o + 1], tex.data[o + 2]]; };
  const n = idx ? idx.getCount() : pos.getCount();
  for (let k = 0; k + 2 < n; k += 3) { const t = [0, 1, 2].map(q => get(idx ? idx.getScalar(k + q) : k + q));
    for (let s = 0; s < 6; s++) { let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v; P.push([0, 1, 2, 3, 4, 5].map(c => t[0][c] * w + t[1][c] * u + t[2][c] * v)); } }
}
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const p of P) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
console.log('bounds x ' + lo[0].toFixed(3) + '..' + hi[0].toFixed(3) + '  y ' + lo[1].toFixed(3) + '..' + hi[1].toFixed(3) + '  z ' + lo[2].toFixed(3) + '..' + hi[2].toFixed(3) + '   (y shown from the feet: subtract ' + lo[1].toFixed(3) + ')');
const y0 = lo[1], c = clip.map(Number), keep = p => !clip.length || (p[1] - y0 >= c[0] && p[1] - y0 <= c[1] && p[0] >= c[2] && p[0] <= c[3] && p[2] >= c[4] && p[2] <= c[5]);
const S = 520, W = 1300, H = 1150, views = { front: p => [p[0], p[1] - y0, p[2]], side: p => [p[2], p[1] - y0, -p[0]], top: p => [p[0], p[2] + 1.0, p[1]] };
for (const [name, f] of Object.entries(views)) {
  const img = Buffer.alloc(W * H * 3, 245), depth = new Float32Array(W * H).fill(-1e9), cx = W / 2, by = H - 60;
  for (let gx = -12; gx <= 12; gx++) { const px = Math.round(cx + gx * 0.1 * S); if (px < 0 || px >= W) continue; for (let y = 0; y < H; y++) { const o = (y * W + px) * 3, d = gx === 0 ? 120 : gx % 5 === 0 ? 175 : 222; img[o] = img[o + 1] = img[o + 2] = d; } }
  for (let gy = 0; gy <= 21; gy++) { const py = Math.round(by - gy * 0.1 * S); if (py < 0 || py >= H) continue; for (let x = 0; x < W; x++) { const o = (py * W + x) * 3, d = gy === 0 ? 120 : gy % 5 === 0 ? 175 : 222; img[o] = img[o + 1] = img[o + 2] = d; } }
  for (const p of P) { if (!keep(p)) continue; const q = f(p), px = Math.round(cx + q[0] * S), py = Math.round(by - q[1] * S); if (px < 0 || px >= W || py < 0 || py >= H) continue; const o = py * W + px; if (q[2] < depth[o]) continue; depth[o] = q[2]; img[o * 3] = p[3]; img[o * 3 + 1] = p[4]; img[o * 3 + 2] = p[5]; }
  const labels = []; for (let gx = -12; gx <= 12; gx += 1) labels.push(`<text x="${cx + gx * 0.1 * S}" y="${H - 38}" font-size="15" text-anchor="middle" fill="#000">${(gx / 10).toFixed(1)}</text>`);
  for (let gy = 0; gy <= 21; gy++) labels.push(`<text x="4" y="${by - gy * 0.1 * S + 5}" font-size="15" fill="#000">${(gy / 10).toFixed(1)}</text>`);
  labels.push(`<text x="${W - 10}" y="24" font-size="20" text-anchor="end" fill="#b00">${name}: ${name === 'front' ? 'x across, y up (seen from +z)' : name === 'side' ? 'z across, y up (seen from -x)' : 'x across, z up the page (+1.0), seen from above'}</text>`);
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`) }]).png().toFile(out + '-' + name + '.png');
}
