// Fits each captured attack's contact window to its hitbox: for every frame of the clip it measures how far the striking
// bone is from the move's main hitbox, then takes the run of frames where it is inside, nearest the capture's own strike.
//   node tools/fit-contact.js bones.json moves.json out.json
// bones.json from tools/blender/bonepaths.py; moves.json: { moves: { <move>: { h: [[f0, f1, x, y, r, part], ...] } } } read
// from the game (F[0].form.moves); out.json: { <clip>: [first, last] clip frames (30 a second) } for tools/blender/sprocket.js.
const fs = require('fs'), [bp, mp, op] = process.argv.slice(2);
const B = JSON.parse(fs.readFileSync(bp)), M = JSON.parse(fs.readFileSync(mp)).moves, man = JSON.parse(fs.readFileSync('assets/manifest.json')).Sprocket;
const mc = JSON.parse(fs.readFileSync('assets/sprocket/work/mocap-clips.json'));   /* which clips are captures, and with what */
const UPM = 14 / 1.9, out = {};
for (const [mn, a] of Object.entries(man.attacks)) {
  const mv = M[mn], fr = B[a.clip], info = mc[a.clip]; if (!mv || !fr || !info || !info.hit) continue;
  const h = mv.h.find(q => !q[5]) || mv.h[0], tz = h[2] / UPM, ty = h[3] / UPM, r = h[4] / UPM;
  const by = info.by ? info.by : info.noTool ? ['handL', 'handR', 'wrenchTip'] : info.kick ? ['footL', 'footR', 'wrenchTip'] : ['wrenchTip'];
  const d = fr.map(row => Math.min(...by.map(n => Math.hypot(row[n][2] - tz, row[n][1] - ty) - r * (info.loose ? 1 : 0.7))));   /* well inside, not grazing the edge */
  /* the capture's own strike (its hit frames, counted in the clip), and only frames within 6 of it: the wind-up and the
     return to stance may pass through the box too, but that is not the blow */
  const want = Math.round((info.hit[0] + info.hit[1]) / 2 - (info.f ? info.f[0] : 1)), near = i => Math.abs(i - want) <= 6 && i >= 3;
  let k = -1; for (let i = 0; i < d.length; i++) if (near(i) && d[i] <= 0 && (k < 0 || Math.abs(i - want) < Math.abs(k - want))) k = i;
  let miss = 0; if (k < 0) { k = Math.max(3, want); for (let i = 0; i < d.length; i++) if (near(i) && d[i] < d[k]) k = i; miss = d[k]; }
  const span = Math.max(1, Math.round((h[1] - h[0] + 1) / 4)); let k0 = k, k1 = k;
  while (k0 > 1 && k - k0 < span && d[k0 - 1] <= Math.max(0, d[k])) k0--; while (k1 < d.length - 2 && k1 - k < span && d[k1 + 1] <= Math.max(0, d[k])) k1++;
  if (k1 === k0) k1++;
  out[a.clip] = [k0, k1];
  console.log(mn.padEnd(6), a.clip.padEnd(11), 'capture strike', want, '-> ' + k0 + '-' + k1, miss ? 'MISS by ' + miss.toFixed(2) + ' m' : 'in');
}
fs.writeFileSync(op, JSON.stringify(out, null, 1) + '\n');
