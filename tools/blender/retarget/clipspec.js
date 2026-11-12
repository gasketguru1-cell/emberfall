/* Builds a rig.py spec whose clips are retargeted keys (tools/blender/retarget/retarget.py's <clip>.keys.json), from the
   fighter's own spec: same bones, IK, aimed props, rigid parts and poses, so rig.py rigs and exports it exactly as the
   fighter's build does (here with --start 0: a key at t plays at t). Each clip starts from the spec's base pose (the
   target profile's basePose) and keys every frame, so rig.py's easing is not used: the source is the in-between.
     node tools/blender/retarget/clipspec.js --spec assets/brand/work/rig.json --keys <dir> --out <dir>/spec.json [--clips A,B]
   Also writes <dir>/clips.json (name, seconds, frames, source) and <dir>/manifest-snippet.json (how the clips would be
   added to the fighter; nothing in assets/ is changed). */
const fs = require('fs'), path = require('path');
const a = process.argv.slice(2), opt = {};
for (let i = 0; i < a.length; i += 2) opt[a[i].replace(/^--/, '')] = a[i + 1];
const spec = JSON.parse(fs.readFileSync(opt.spec, 'utf8'));
const only = opt.clips ? new Set(opt.clips.split(',')) : null;
const files = fs.readdirSync(opt.keys).filter(f => f.endsWith('.keys.json')).sort();
const clips = {}, info = {};
for (const f of files) {
  const k = JSON.parse(fs.readFileSync(path.join(opt.keys, f), 'utf8'));
  if (only && !only.has(k.clip)) continue;
  for (const fr of k.frames) for (const b in fr) if (!spec.bones.some(x => x.name === b)) throw new Error(f + ': no bone ' + b + ' in the spec');
  const base = k.base && spec.poses && spec.poses[k.base] ? k.base : undefined;
  clips[k.clip] = { fps: k.fps, keys: k.frames.map((p, i) => Object.assign({ t: +(i / k.fps).toFixed(6), pose: p }, i === 0 && base ? { use: base } : {})) };
  info[k.clip] = { seconds: k.seconds, frames: k.frames.length, fps: k.fps, source: k.source, action: k.action, sourceFps: k.sourceFps, sourceKeyRate: k.sourceKeyRate };
}
if (!Object.keys(clips).length) throw new Error('clipspec: no clips in ' + opt.keys);
const out = Object.assign({}, spec, { clips });
fs.mkdirSync(path.dirname(opt.out), { recursive: true });
fs.writeFileSync(opt.out, JSON.stringify(out));
const dir = path.dirname(opt.out);
fs.writeFileSync(path.join(dir, 'clips.json'), JSON.stringify(info, null, 1) + '\n');
fs.writeFileSync(path.join(dir, 'manifest-snippet.json'), JSON.stringify({
  note: 'Suggested only; nothing in assets/ was changed. To use these clips in the game: copy the GLB into the fighter\'s work folder, add it to its pack.json "extra" (pack.mjs merges clips by bone name), rebuild, and point manifest states or attacks at the clip names. Attack clips need their contact frames set and checked (tools/blade-check.js) before use.',
  packExtra: { file: 'work/<this glb>' },
  clips: Object.fromEntries(Object.keys(info).map(c => [c, { clip: c, seconds: info[c].seconds }])),
}, null, 1) + '\n');
console.log('clipspec: ' + Object.keys(clips).length + ' clips -> ' + opt.out + ' (' + Object.entries(info).map(([c, v]) => c + ' ' + v.frames + 'f').join(', ') + ')');
