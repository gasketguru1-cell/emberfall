// Prints what is inside a GLB: meshes, skeleton, animation clips and how far each clip moves the root bone.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file), root = doc.getRoot();
  const skins = root.listSkins(), joints = skins[0] ? skins[0].listJoints().map(j => j.getName()) : [];
  console.log('== ' + file.split('/').slice(-1)[0]);
  console.log('meshes ' + root.listMeshes().length + ', nodes ' + root.listNodes().length + ', skins ' + skins.length + ', joints ' + joints.length + ', textures ' + root.listTextures().length);
  if (joints.length) console.log('joints: ' + joints.join(' '));
  for (const a of root.listAnimations()) {
    let dur = 0, rootMove = '';
    for (const ch of a.listChannels()) {
      const s = ch.getSampler(), t = s.getInput().getArray(); dur = Math.max(dur, t[t.length - 1]);
      const n = ch.getTargetNode();
      if (ch.getTargetPath() === 'translation' && n && joints[0] === n.getName()) {
        const v = s.getOutput().getArray(), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[i + k]); mx[k] = Math.max(mx[k], v[i + k]); }
        rootMove = ' root ' + n.getName() + ' range x ' + (mx[0] - mn[0]).toFixed(2) + ' y ' + (mx[1] - mn[1]).toFixed(2) + ' z ' + (mx[2] - mn[2]).toFixed(2) + ' start [' + [v[0], v[1], v[2]].map(q => q.toFixed(2)) + '] end [' + [v[v.length - 3], v[v.length - 2], v[v.length - 1]].map(q => q.toFixed(2)) + ']';
      }
    }
    console.log('  clip "' + a.getName() + '" ' + dur.toFixed(2) + 's, ' + a.listChannels().length + ' channels' + rootMove);
  }
}
