// Builds one game-ready GLB for a character from Meshy's downloads.
//   node tools/pack.mjs assets/<character>/work/pack.json
// - takes the mesh, skeleton and clips from the base file and adds clips from the other files (matched by bone name)
// - removes sideways travel from the root bone, so the game alone decides where a fighter is
// - optionally holds or caps the root bone's height for airborne clips
// - shrinks textures and removes anything unused
import fs from 'node:fs'; import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const cfgFile = path.resolve(process.argv[2]), cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')), dir = path.dirname(path.dirname(cfgFile));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(dir, cfg.base)), root = doc.getRoot(), buffer = root.listBuffers()[0];
const byName = new Map(root.listNodes().map(n => [n.getName(), n]));

for (const a of root.listAnimations()) if (cfg.rename && cfg.rename[a.getName()]) a.setName(cfg.rename[a.getName()]);
for (const extra of cfg.extra || []) {
  const src = await io.read(path.join(dir, extra.file));
  for (const a of src.getRoot().listAnimations()) {
    const name = (extra.rename && extra.rename[a.getName()]) || a.getName(), out = doc.createAnimation(name); let skipped = 0;
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode() && byName.get(ch.getTargetNode().getName()); if (!node) { skipped++; continue; }
      const s = ch.getSampler(), copy = acc => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
      out.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
    console.log('added clip ' + name + ' (' + out.listChannels().length + ' channels' + (skipped ? ', ' + skipped + ' skipped' : '') + ')');
  }
}

/* Root bone: the reference standing height comes from the first frame of the stand clip. */
const rootTrack = a => a.listChannels().find(ch => ch.getTargetPath() === 'translation' && ch.getTargetNode() && ch.getTargetNode().getName() === cfg.root);
const standClip = root.listAnimations().find(a => a.getName() === cfg.stand), stand = rootTrack(standClip).getSampler().getOutput().getArray();
const ref = [cfg.ref[0], stand[1], cfg.ref[2]]; const report = {};
for (const a of root.listAnimations()) {
  const ch = rootTrack(a), rule = (cfg.clips && cfg.clips[a.getName()]) || {}; if (!ch) continue;
  const acc = ch.getSampler().getOutput(), v = acc.getArray().slice(), times = ch.getSampler().getInput().getArray(); let hi = -1e9, lo = 1e9, tHi = 0, tLo = 0;
  for (let i = 0; i < v.length; i += 3) {
    const y = v[i + 1]; if (y > hi) { hi = y; tHi = times[i / 3]; } if (y < lo) { lo = y; tLo = times[i / 3]; }
    v[i] = ref[0]; v[i + 2] = ref[2];
    if (rule.y === 'stand') v[i + 1] = ref[1]; else if (rule.y === 'clamp') v[i + 1] = Math.min(y, ref[1]);
  }
  acc.setArray(v); let dur = times[times.length - 1];
  report[a.getName()] = { seconds: +dur.toFixed(3), rootY: rule.y || 'keep', highestAt: +tHi.toFixed(2), lowestAt: +tLo.toFixed(2), high: +hi.toFixed(1), low: +lo.toFixed(1) };
}
console.log('standing root height ' + ref[1].toFixed(2)); console.table(report);

await doc.transform(resample(), dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.texture || 1024, cfg.texture || 1024], quality: 88 }));
const out = path.join(dir, cfg.out); fs.mkdirSync(path.dirname(out), { recursive: true }); await io.write(out, doc);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
console.log('wrote ' + path.relative(process.cwd(), out) + ': ' + Math.round(fs.statSync(out).size / 1024) + ' KB, ' + Math.round(tris) + ' triangles, ' + root.listAnimations().length + ' clips, ' + root.listTextures().length + ' textures');
fs.writeFileSync(out.replace(/\.glb$/, '.clips.json'), JSON.stringify(report, null, 1));
