// Copies just the files the game needs at run time into build/game/, for the desktop installer (electron-builder takes it
// from there). Leaves out Meshy downloads, Blender work files, tools, tests and recordings.
//   node tools/stage-desktop.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'build', 'game');
fs.rmSync(out, { recursive: true, force: true });
const copy = rel => { const to = path.join(out, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(root, rel), to); };
const files = ['index.html', 'hitboxes.js', 'sim.js', 'anim.js', 'net.js', 'knellcpu.js', 'chompcpu.js', 'render2d.js', 'hud.js', 'movelist.js', 'finalhit.js', 'main.js', 'online.js', 'render3d.js',
  'assets/manifest.json', 'assets/stage/export/stage.json', 'assets/stage/export/backdrop.jpg', 'assets/stage/source/concept.webp',
  'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js'];
/* every script the game page loads (so a new one, like audio.js, can't be left out), and everything the sound needs */
for (const m of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) if (!files.includes(m[1])) files.push(m[1]);
const addDir = rel => { for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) { if (e.isDirectory()) addDir(rel + '/' + e.name); else files.push(rel + '/' + e.name); } };
if (fs.existsSync(path.join(root, 'assets/audio'))) addDir('assets/audio');
const stage = JSON.parse(fs.readFileSync(path.join(root, 'assets/stage/export/stage.json'), 'utf8')); files.push(stage.file);
/* every other stage (assets/stage-<name>/export/stage.json): its file, its model and its backdrop */
for (const d of fs.readdirSync(path.join(root, 'assets'))) { const rel = 'assets/' + d + '/export/stage.json'; if (!d.startsWith('stage-') || !fs.existsSync(path.join(root, rel))) continue;
  const c = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); files.push(rel, c.file); if (c.backdrop) files.push(c.backdrop); }
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf8'));
/* every file the manifest names anywhere in an entry (the model, and extras like Kestrel's cape or Fyrdsman's runebreaker) */
const named = v => { if (typeof v === 'string') { if (/^assets\/.+\.\w+$/.test(v) && !files.includes(v)) files.push(v); } else if (v && typeof v === 'object') Object.values(v).forEach(named); };
named(manifest);
/* every model the game's scripts load by name (the props: Flint's light ball, Joey's needle, the Fowls' slingshot, ...) */
for (const f of files.filter(f => /\.js$/.test(f) && !f.startsWith('node_modules/')))
  for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/['"`](assets\/[\w./-]+\.(?:glb|gltf|png|jpg|webp))['"`]/g)) if (!files.includes(m[1])) files.push(m[1]);
for (const f of files) if (fs.existsSync(path.join(root, f))) copy(f); else console.log('missing (skipped): ' + f);
/* the three.js add-ons the renderer imports, with whatever they import in turn */
const addons = new Set(), want = ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js', 'environments/RoomEnvironment.js', 'utils/BufferGeometryUtils.js'];
const jsm = path.join(root, 'node_modules/three/examples/jsm');
while (want.length) { const w = want.pop(); if (addons.has(w)) continue; addons.add(w); const src = fs.readFileSync(path.join(jsm, w), 'utf8');
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) want.push(path.posix.normalize(path.posix.join(path.posix.dirname(w), m[1]))); }
for (const a of addons) copy('node_modules/three/examples/jsm/' + a);
let bytes = 0; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else bytes += fs.statSync(p).size; } }; walk(out);
console.log('staged ' + (files.length + addons.size) + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB, in build/game');
