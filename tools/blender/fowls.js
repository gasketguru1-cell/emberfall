// Writes the skeleton and animation spec for each of the five Furious Fowls birds (assets/fowl-<bird>/work/rig.json),
// which tools/blender/rig.py turns into rigged, animated models, and adds their entries to the game's manifest: one for
// the bird in the slingshot's pouch and one for the bird alone (the same model).
//   node tools/blender/fowls.js
// Then for each bird:  blender -b --factory-startup --python tools/blender/rig.py -- --mesh assets/fowl-<bird>/raw/<task>/model_url.glb
//                          --spec assets/fowl-<bird>/work/rig.json --out assets/fowl-<bird>/work/<bird>-rigged.glb
//                      node tools/pack.mjs assets/fowl-<bird>/work/pack.json
// The birds are round, so all five share one small skeleton placed by each model's size: body, crest, two wings, tail, two feet.
// Turning: positive pitch tips forward, positive yaw turns to its left, positive roll raises its left side.
const fs = require('fs'), path = require('path');
const R = (p, y, r) => ({ rot: [p, y || 0, r || 0] }), M = (x, y, z) => ({ move: [x, y, z] }), RM = (p, y, r, x, h, z) => ({ rot: [p, y || 0, r || 0], move: [x || 0, h || 0, z || 0] });
const A = (clip, c0, c1, start, end) => ({ clip, start: start || 0, contact: [c0, c1], end: end || 0.9 });
/* each model's half-width, lowest and highest point, and how far it reaches forward and back (from the generated meshes); game height alone, and how high it rides in the pouch */
const BIRDS = { rusty: { name: 'Rusty', x: 0.63, y0: -0.79, y1: 0.78, z: 0.95, h: 7, lift: 8.6 }, bolt: { name: 'Bolt', x: 0.6, y0: -0.89, y1: 0.88, z: 0.95, h: 7.4, lift: 8.6 },
  cinder: { name: 'Cinder', x: 0.79, y0: -0.95, y1: 0.95, z: 0.83, h: 8.8, lift: 8.4 }, pip: { name: 'Pip', x: 0.75, y0: -0.95, y1: 0.95, z: 0.95, h: 5.8, lift: 8.8 }, pearl: { name: 'Pearl', x: 0.65, y0: -0.95, y1: 0.95, z: 0.75, h: 7.8, lift: 8.6 } };
function spec(b) {
  const H = b.y1 - b.y0, X = b.x, Z = b.z, C = [H * 0.48, 0];
  const flip = deg => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a); return { rot: [deg, 0, 0], move: [0, C[0] - (C[0] * cs - C[1] * sn), C[1] - (C[0] * sn + C[1] * cs)] }; };
  const wings = (up, fwd) => ({ wingL: R(0, -(fwd || 0), up), wingR: R(0, fwd || 0, -up) }), feet = (a, c) => ({ footL: M(0, a, c || 0), footR: M(0, a, c || 0) });
  return {
    note: b.name + ': metres after prep (feet on y = 0, facing +Z).', prep: { yaw: 0, translate: [0, -b.y0, 0] },
    bones: [
      { name: 'all', head: [0, 0, 0], tail: [0, 0.12, 0], parent: null, deform: false },
      { name: 'root', head: [0, H * 0.4, 0], tail: [0, H * 0.55, 0], parent: 'all', deform: false },
      { name: 'body', head: [0, H * 0.14, 0], tail: [0, H * 0.74, 0.02], parent: 'root' },
      { name: 'crest', head: [0, H * 0.8, 0.05], tail: [0, H * 0.99, -0.12], parent: 'body' },
      { name: 'wingL', head: [X * 0.72, H * 0.52, -0.05], tail: [X * 0.98, H * 0.34, -Z * 0.3], parent: 'body' },
      { name: 'wingR', head: [-X * 0.72, H * 0.52, -0.05], tail: [-X * 0.98, H * 0.34, -Z * 0.3], parent: 'body' },
      { name: 'tail', head: [0, H * 0.4, -Z * 0.62], tail: [0, H * 0.46, -Z * 0.98], parent: 'body' },
      { name: 'beak', head: [0, H * 0.56, Z * 0.7], tail: [0, H * 0.54, Z * 0.98], parent: 'body' },   /* also marks the front of the bird, for measuring */
      { name: 'footL', head: [X * 0.3, H * 0.1, 0.08], tail: [X * 0.32, 0.01, 0.26], parent: 'root' },
      { name: 'footR', head: [-X * 0.3, H * 0.1, 0.08], tail: [-X * 0.32, 0.01, 0.26], parent: 'root' }],
    poses: {
      stand: { all: {}, root: {}, body: {}, crest: {}, wingL: {}, wingR: {}, tail: {}, footL: {}, footR: {} },
      squash: { root: M(0, -H * 0.07, 0), body: M(0, -H * 0.05, 0), crest: R(14), ...wings(-14) },
      stretch: { root: M(0, H * 0.04, 0), body: M(0, H * 0.04, 0), crest: R(-10), ...wings(22) },
      tuck: { body: R(18), crest: R(30), ...wings(-10, 30), ...feet(H * 0.06, 0.06), tail: R(-20) } },
    clips: {
      Idle: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.5, pose: { root: M(0, -H * 0.012, 0), crest: R(4), ...wings(-4) } }, { t: 1.0, pose: { root: M(0, 0, 0), crest: R(0, 0, 4), ...wings(3) } }, { t: 1.5, pose: { root: M(0, -H * 0.012, 0), crest: R(4), tail: R(0, 8), ...wings(-4) } }, { t: 2.0, pose: { root: M(0, 0, 0), crest: R(0), tail: R(0), ...wings(0) } }] },
      Hop: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'] }, { t: 0.1, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, H * 0.1, 0), body: R(8), ...feet(-H * 0.02) } }, { t: 0.2, reset: true, use: 'stand', pose: { root: M(0, H * 0.14, 0), body: R(4), ...wings(34), ...feet(H * 0.05, 0.05) } },
        { t: 0.3, reset: true, use: ['stand', 'squash'], pose: { root: M(0, -H * 0.05, 0) } }, { t: 0.36, reset: true, use: ['stand', 'squash'] }] },
      Crouch: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'squash', pose: { root: M(0, -H * 0.12, 0), body: RM(6, 0, 0, 0, -H * 0.06, 0) } }] },
      Rise: { fps: 30, keys: [{ t: 0, use: ['stand', 'stretch'], pose: { ...wings(60), crest: R(-20), tail: R(20), ...feet(-H * 0.03) } }, { t: 0.2, pose: { ...wings(-20) } }, { t: 0.4, pose: { ...wings(50), ...feet(H * 0.04) } }] },
      Fall: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(6), crest: R(24), tail: R(-16), ...wings(70), ...feet(H * 0.05) } }, { t: 0.2, pose: { ...wings(40) } }, { t: 0.4, pose: { ...wings(70) } }] },
      Land: { fps: 30, keys: [{ t: 0, use: ['stand', 'squash'], pose: { root: M(0, -H * 0.14, 0), body: M(0, -H * 0.1, 0) } }, { t: 0.16, reset: true, use: ['stand', 'stretch'] }, { t: 0.4, reset: true, use: 'stand' }] },
      Shield: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.15, use: 'squash', pose: { ...wings(-6, 62), crest: R(20), body: R(-8) } }] },
      Hit: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-24), body: R(-10), crest: R(-34), ...wings(50), ...feet(H * 0.04, 0.1) } }, { t: 0.3, pose: { all: flip(-12), crest: R(-10), ...wings(24) } }, { t: 0.6, reset: true, use: 'stand' }] },
      Tumble: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'] }, { t: 0.3, pose: { body: R(26), crest: R(38) } }, { t: 0.6, pose: { body: R(18), crest: R(30) } }] },
      Down: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(-50) } }, { t: 0.3, pose: { all: RM(-90, 0, 0, 0, Z * 0.55, -H * 0.1), ...wings(30), ...feet(H * 0.03, 0.08) } }] },
      Dodge: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.14, pose: { all: R(0, 40), root: M(0, -H * 0.04, -0.1), body: R(-10), ...wings(-10, 40) } }, { t: 0.4, reset: true, use: 'stand' }] },
      Hold: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { body: R(10), ...wings(0, 70) } }, { t: 0.3, pose: { body: R(13) } }, { t: 0.6, pose: { body: R(10) } }] },
      Held: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { root: M(0, H * 0.05, 0), ...wings(50), ...feet(-H * 0.02, 0.06), crest: R(0, 0, 14) } }, { t: 0.2, pose: { ...wings(20), ...feet(-H * 0.02, -0.04), crest: R(0, 0, -14) } }, { t: 0.4, pose: { ...wings(50), ...feet(-H * 0.02, 0.06), crest: R(0, 0, 14) } }] },
      /* ---- attacks ---- */
      Peck: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.1, pose: { all: flip(-14), root: M(0, 0, -0.08), crest: R(-18) } }, { t: 0.18, pose: { all: flip(34), root: M(0, -H * 0.02, Z * 0.42), crest: R(26), ...wings(-10) } }, { t: 0.28, pose: { root: M(0, -H * 0.02, Z * 0.46) } }, { t: 0.55, reset: true, use: 'stand' }] },
      Bash: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.3, pose: { all: flip(-28), root: M(0, H * 0.03, -Z * 0.2), crest: R(-30), ...wings(46) } }, { t: 0.4, reset: true, use: 'stand', pose: { all: flip(50), root: M(0, -H * 0.03, Z * 0.7), crest: R(34), ...wings(-10, 30) } }, { t: 0.54, pose: { root: M(0, -H * 0.04, Z * 0.74) } }, { t: 0.95, reset: true, use: 'stand' }] },
      Flap: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.2, use: 'squash', pose: { root: M(0, -H * 0.14, 0), ...wings(-30) } }, { t: 0.3, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, H * 0.3, 0), ...wings(80), crest: R(-24), ...feet(-H * 0.04) } }, { t: 0.44, pose: { root: M(0, H * 0.34, 0), ...wings(40) } }, { t: 0.9, reset: true, use: 'stand' }] },
      Sweep: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.22, use: 'squash', pose: { all: R(0, -30), root: M(0, -H * 0.14, 0) } }, { t: 0.32, pose: { all: R(0, 150), ...wings(50) } }, { t: 0.46, pose: { all: R(0, 320) } }, { t: 0.85, reset: true, use: 'stand', pose: { all: R(0, 360) } }] },
      Spin: { fps: 30, keys: [{ t: 0, use: ['stand', 'tuck'], pose: { all: flip(0) } }, { t: 0.22, pose: { all: flip(150) } }, { t: 0.42, pose: { all: flip(290) } }, { t: 0.7, reset: true, use: 'stand', pose: { all: flip(360) } }] },
      Fly: { fps: 30, keys: [{ t: 0, use: 'stand', pose: { all: flip(64), crest: R(-30), tail: R(10), ...wings(20, -40), ...feet(H * 0.05, -0.1) } }, { t: 0.15, pose: { ...wings(34, -40) } }, { t: 0.3, pose: { ...wings(20, -40) } }] },
      Kick: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.28, pose: { all: flip(24) } }, { t: 0.38, pose: { all: flip(64), root: M(0, H * 0.03, -Z * 0.4), tail: R(-30), ...feet(-H * 0.06, -0.3) } }, { t: 0.5, pose: { root: M(0, H * 0.03, -Z * 0.44) } }, { t: 0.9, reset: true, use: 'stand' }] },
      Stomp: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.3, use: 'squash', pose: { root: M(0, H * 0.08, 0), ...wings(60), ...feet(H * 0.08) } }, { t: 0.4, reset: true, use: ['stand', 'stretch'], pose: { root: M(0, -H * 0.1, 0), ...wings(-20), ...feet(-H * 0.08) } }, { t: 0.55, pose: { root: M(0, -H * 0.12, 0) } }, { t: 0.95, reset: true, use: 'stand' }] },
      Puff: { fps: 30, keys: [{ t: 0, use: 'stand' }, { t: 0.25, use: 'squash', pose: { body: R(-10), crest: R(-20) } }, { t: 0.4, reset: true, use: ['stand', 'stretch'], pose: { body: R(8), ...wings(70), crest: R(20) } }, { t: 0.5, pose: { ...wings(50) } }, { t: 0.9, reset: true, use: 'stand' }] },
    },
  };
}
const mf = path.join(__dirname, '..', '..', 'assets', 'manifest.json'), manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const key in BIRDS) { const b = BIRDS[key], out = path.join(__dirname, '..', '..', 'assets', 'fowl-' + key, 'work'); fs.mkdirSync(out, { recursive: true });
  const s = spec(b); fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(s, null, 1));
  fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ base: 'work/' + key + '-rigged.glb', texture: 1024, out: 'export/' + key + '-v1.glb' }, null, 1) + '\n');
  const hop = { clip: 'Hop' }, clips = { idle: { clip: 'Idle' }, walk: hop, run: hop, crouch: { clip: 'Crouch', at: 0.2 }, brake: { clip: 'Land', from: 0.05, to: 0.4 }, jumpsquat: { clip: 'Crouch', from: 0, to: 0.2 }, rise: { clip: 'Rise' }, fall: { clip: 'Fall' }, land: { clip: 'Land', from: 0, to: 0.4 },
    shield: { clip: 'Shield', from: 0, to: 0.15 }, hit: { clip: 'Hit', from: 0, to: 0.6 }, tumble: { clip: 'Tumble', bounce: true }, down: { clip: 'Down', from: 0, to: 0.3 }, dizzy: { clip: 'Hit', from: 0, to: 0.6, bounce: true },
    airdodge: { clip: 'Tumble', bounce: true }, dodge: { clip: 'Dodge', from: 0, to: 0.4 }, roll: { clip: 'Tumble', bounce: true }, ledge: { clip: 'Fall' }, hold: { clip: 'Hold' }, held: { clip: 'Held' }, throw: { clip: 'Bash', from: 0.25, to: 0.95 }, swap: { clip: 'Tumble', bounce: true } };
  const attacks = { jab: A('Peck', 0.18, 0.28, 0, 0.55), jab2: A('Peck', 0.18, 0.28, 0, 0.55), jab3: A('Bash', 0.4, 0.54, 0.15, 0.95), ftilt: A('Peck', 0.18, 0.28, 0, 0.55), utilt: A('Flap', 0.3, 0.44), dtilt: A('Sweep', 0.3, 0.46, 0, 0.85), dash: A('Spin', 0.15, 0.45, 0, 0.7),
    fsmash: A('Bash', 0.4, 0.54, 0, 0.95), usmash: A('Flap', 0.3, 0.44), dsmash: A('Sweep', 0.3, 0.46, 0, 0.85), nair: A('Spin', 0.15, 0.45, 0, 0.7), fair: A('Peck', 0.18, 0.28, 0, 0.55), bair: A('Kick', 0.38, 0.5), uair: A('Flap', 0.3, 0.44), dair: A('Stomp', 0.4, 0.55, 0, 0.95),
    grab: A('Peck', 0.18, 0.28, 0, 0.55), getup: A('Sweep', 0.3, 0.46, 0, 0.85), nspec: A('Puff', 0.4, 0.5), sspec: A('Bash', 0.4, 0.54, 0.1, 0.95), uspec: A('Flap', 0.3, 0.44), dspec: A('Puff', 0.4, 0.5), launch: { clip: 'Fly', start: 0, contact: [0.05, 0.28], end: 0.3 }, '*': A('Peck', 0.18, 0.28, 0, 0.55) };
  const base = { file: 'assets/fowl-' + key + '/export/' + key + '-v1.glb', height: b.h, clips, strikers: [{ bone: 'beak', ext: 0.6 }, { bone: 'crest', ext: 0.6 }, { bone: 'footL', ext: 0.8 }, { bone: 'tail', ext: 0.6 }], springs: [], attacks };
  manifest[b.name + ' alone'] = base;
  /* in the pouch: the same bird, riding high, with the slingshot built by the renderer underneath; charging the up special and firing ammunition use the puff */
  manifest[b.name] = Object.assign({}, base, { lift: b.lift, prop: { type: 'sling' }, attacks: Object.assign({}, attacks, { uspec: A('Hold', 0.3, 0.6, 0, 0.6), nair: A('Hold', 0.3, 0.6, 0, 0.6), sspec: A('Puff', 0.4, 0.5), nspec: A('Idle', 0.3, 0.6), dspec: A('Shield', 0.1, 0.15, 0, 0.15) }) });
  console.log('wrote ' + key + ': ' + s.bones.length + ' bones, ' + Object.keys(s.clips).length + ' clips'); }
fs.writeFileSync(mf, JSON.stringify(manifest, null, 1) + '\n'); console.log('manifest: ' + Object.keys(manifest).join(', '));
