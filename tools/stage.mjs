// Prepares the stage model for the game: shrinks its textures, measures it, and writes where it has to sit so that its
// flat top is the fighting floor (y = 0) and its rim lines up with the ledges.
//   node tools/stage.mjs assets/stage/raw/<task>/model_url.glb [folder]
// folder is the stage's folder under assets (stage when left out; stage-valinor for Valinor).
// Writes assets/<folder>/export/<folder>-v1.glb and stage.measure.json beside it (file, measurements).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress } from '@gltf-transform/functions'; import sharp from 'sharp';

const root0 = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), src = path.resolve(process.argv[2]), folder = process.argv[3] || 'stage';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(src), root = doc.getRoot();

/* ---- measure in the model's own units: bounding box, and the height of the big flat top ---- */
const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], bins = new Map(); let tris = 0; const flat = [];
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const P = prim.getAttribute('POSITION').getArray(), I = prim.getIndices().getArray(); tris += I.length / 3;
  for (let k = 0; k < P.length; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], P[k + a]); max[a] = Math.max(max[a], P[k + a]); }
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, area = Math.hypot(nx, ny, nz) / 2;
    if (area > 0 && ny / (area * 2) > 0.94) {   /* faces looking straight up */
      const y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, key = Math.round(y * 200); bins.set(key, (bins.get(key) || 0) + area);
      flat.push([y, (P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3]);
    }
  }
}
let best = 0, deckKey = 0; for (const [k, a] of bins) { const sum = a + (bins.get(k - 1) || 0) + (bins.get(k + 1) || 0); if (sum > best) { best = sum; deckKey = k; } }
const deckY = deckKey / 200;
/* how far the floor reaches: left and right along the middle line front to back, and front to back along the middle line across */
const zMid = (min[2] + max[2]) / 2, xMid = (min[0] + max[0]) / 2; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
for (const [y, x, z] of flat) if (Math.abs(y - deckY) < 0.012) { if (Math.abs(z - zMid) < 0.12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } if (Math.abs(x - xMid) < 0.12) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
const r = v => +v.toFixed(4);
const measure = { box: { min: min.map(r), max: max.map(r) }, deckY: r(deckY), deckX: [r(x0), r(x1)], deckZ: [r(z0), r(z1)], triangles: tris };

await doc.transform(dedup(), prune());
/* textures: colour at 2048, the others at 1024, all as webp */
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 86, slots: /baseColor/ }));
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 86, slots: /^(?!baseColor)/ }));
const outDir = path.join(root0, 'assets', folder, 'export'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, folder + '-v1.glb'); await io.write(out, doc);
const info = { file: 'assets/' + folder + '/export/' + folder + '-v1.glb', source: path.relative(root0, src).replace(/\\/g, '/'), measure };
fs.writeFileSync(path.join(outDir, 'stage.measure.json'), JSON.stringify(info, null, 1) + '\n');
console.log('wrote ' + path.relative(root0, out) + ': ' + Math.round(fs.statSync(out).size / 1024) + ' KB, ' + tris + ' triangles');
console.log(JSON.stringify(measure));
