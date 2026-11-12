// Runs capesim.js over the frames cape-bake.py dumped from Blender (the animated cape points and body capsules, world
// metres, y up) and writes the cloth's positions back for it to key and render.
//   node tools/blender/cape-bake.js spec.json frames.json out.json
const fs = require('fs'), path = require('path'), CapeSim = require(path.join(__dirname, '../../capesim.js'));
const [specFile, inFile, outFile] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8')), data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const res = {};
for (const [clip, frames] of Object.entries(data)) {
  const sim = CapeSim.create(spec, { floor: 0 });
  const out = [];
  let contacts = 0;
  for (const fr of frames) {
    sim.step(fr.t, fr.c, 1 / 60); contacts += sim.contacts;
    out.push(Array.from({ length: spec.particles.length }, (_, i) => [sim.pos[i * 3], sim.pos[i * 3 + 1], sim.pos[i * 3 + 2]].map(v => +v.toFixed(5))));
  }
  res[clip] = out;
  console.log('cape-bake: %s %d frames, %d collider pushes', clip, frames.length, contacts);
}
fs.writeFileSync(outFile, JSON.stringify(res));
