// Brings the skin in one model's base texture to the average skin colour of another texture (Joey's two bodies were
// generated separately and came out different tones; the face is the photo's, so the body follows the face).
//   node tools/skintone.mjs <in.glb> <reference skin texture.png> <out.glb>
// Skin is found by colour (reddish, warmer than it is green, greener than blue); each such pixel is scaled channel by
// channel toward the reference average, fully for clear skin and less for doubtful pixels. Nothing else is touched.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const [inFile, refFile, outFile] = process.argv.slice(2);
const LO = process.env.SKIN_LOOSE ? 45 : 110;   /* SKIN_LOOSE=1 also takes in skin in shadow (a sculpt with dark skin painted into its texture) */
const isSkin = (r, g, b) => r > LO && r > g + 12 && g > b + 5 && r < 250 && (r - b) > r * 0.25;   /* warm and clearly coloured: pale grey-beige (floor cracks, dust) is not skin */
async function mean(buf) {
  const { data, info } = await sharp(buf).resize(512, 512).raw().toBuffer({ resolveWithObject: true }); const s = [0, 0, 0]; let n = 0;
  for (let i = 0; i < data.length; i += info.channels) if (isSkin(data[i], data[i + 1], data[i + 2])) { s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; n++; }
  return s.map(v => v / n);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(inFile), ref = await mean(refFile);
const base = new Set(doc.getRoot().listMaterials().map(m => m.getBaseColorTexture()).filter(Boolean));   /* colour maps only, never a normal or roughness map */
for (const tex of doc.getRoot().listTextures().filter(t => base.has(t))) {
  const img = Buffer.from(tex.getImage()), own = await mean(img), gain = ref.map((v, i) => v / own[i]);
  const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true }), c = info.channels;
  for (let i = 0; i < data.length; i += c) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const w = Math.max(0, Math.min(1, Math.min((r - g - 4) / 16, (g - b + 3) / 10, (r - LO + 20) / 30)));   /* 1 for clear skin, fading out at the edges of the test */
    if (w <= 0) continue;
    for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, Math.round(data[i + k] * (1 + (gain[k] - 1) * w)));
  }
  tex.setImage(await sharp(data, { raw: info }).png().toBuffer()).setMimeType('image/png');
  console.log('skintone: ' + (tex.getName() || 'texture') + ' skin ' + own.map(Math.round) + ' -> ' + ref.map(Math.round) + ' (gain ' + gain.map(v => v.toFixed(2)) + ')');
}
await io.write(outFile, doc);
