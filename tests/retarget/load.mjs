// Runtime check of a retarget run's GLB against the fighter's production model, the way the game would use the clips:
// bound to the production skeleton by bone name (as tools/pack.mjs "extra" merges them), played by time.
//   node tests/retarget/load.mjs <retarget out dir> [profile.json]      (the run needs --eval 1)
// Checks: every channel targets one of the production model's joints; every joint's rest matches the production model's;
// samplers are LINEAR and start at 0; each clip's length and key count match clips.json; and, posing the production
// skeleton with the clip (forward kinematics in glTF space), every bone points where the pipeline's own Blender evaluation
// had it (eval/<clip>.json), so what the GLB carries is what was retargeted.
import fs from 'node:fs'; import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const dir = process.argv[2], profFile = process.argv[3] || 'tools/blender/retarget/targets/brand.json';
const prof = JSON.parse(fs.readFileSync(profFile, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const glbName = fs.readdirSync(dir).find(f => f.endsWith('-retarget.glb'));
const out = await io.read(path.join(dir, glbName)), prod = await io.read(prof.glb);
const clips = JSON.parse(fs.readFileSync(path.join(dir, 'clips.json'), 'utf8'));
const fails = []; let passes = 0;
const ok = (c, what) => { if (c) passes++; else fails.push(what); };

const joints = prod.getRoot().listSkins()[0].listJoints(), jn = new Set(joints.map(j => j.getName()));
const prodNode = new Map(prod.getRoot().listNodes().map(n => [n.getName(), n]));
const outNode = new Map(out.getRoot().listNodes().map(n => [n.getName(), n]));
// rest transforms must agree, or a clip bound by name would pull the production mesh off its bones
for (const j of joints) {
  const o = outNode.get(j.getName()); ok(!!o, 'joint ' + j.getName() + ' missing from the retarget GLB'); if (!o) continue;
  const d = Math.max(...[...j.getTranslation().map((v, i) => Math.abs(v - o.getTranslation()[i])), ...j.getRotation().map((v, i) => Math.abs(Math.abs(v) - Math.abs(o.getRotation()[i])))]);
  ok(d < 2e-4, 'joint ' + j.getName() + ' rest differs from production by ' + d.toExponential(2));
}
// quaternion / matrix helpers (glTF: [x, y, z, w])
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => { const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
const slerp = (a, b, u) => { let d = a.reduce((s, v, i) => s + v * b[i], 0); if (d < 0) { b = b.map(v => -v); d = -d; } const r = a.map((v, i) => v + (b[i] - v) * u), l = Math.hypot(...r); return r.map(v => v / l); };
const angle = (a, b) => { const la = Math.hypot(...a), lb = Math.hypot(...b); return Math.acos(Math.max(-1, Math.min(1, a.reduce((s, v, i) => s + v * b[i], 0) / (la * lb)))) * 180 / Math.PI; };
const parentOf = new Map(); for (const n of prod.getRoot().listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
const sampleAt = (ch, t) => { const s = ch.getSampler(), T = s.getInput().getArray(), V = s.getOutput().getArray(), k = ch.getTargetPath() === 'rotation' ? 4 : 3;
  let i = 0; while (i < T.length - 2 && T[i + 1] < t) i++;
  const u = T.length > 1 ? Math.max(0, Math.min(1, (t - T[i]) / ((T[i + 1] - T[i]) || 1))) : 0, A = [...V.slice(i * k, i * k + k)], B = [...V.slice((i + 1) * k, (i + 1) * k + k)];
  return T.length < 2 ? A : k === 4 ? slerp(A, B, u) : A.map((v, m) => v + (B[m] - v) * u); };
const R = prof.roles;
const NEXT = { hips: 'spine', spine: 'chest', chest: 'head' };
for (const s of 'LR') Object.assign(NEXT, { ['upperArm.' + s]: 'foreArm.' + s, ['foreArm.' + s]: 'hand.' + s, ['thigh.' + s]: 'shin.' + s, ['shin.' + s]: 'foot.' + s });
const back = v => [v[0], v[2], -v[1]];   // Blender -> glTF / model

const summary = [];
for (const a of out.getRoot().listAnimations()) {
  const name = a.getName(), info = clips[name]; ok(!!info, 'clip ' + name + ' not in clips.json'); if (!info) continue;
  const chans = a.listChannels(); let dur = 0, t0 = 1e9, keys = 0, badInterp = [];
  for (const ch of chans) {
    const n = ch.getTargetNode(), s = ch.getSampler(), T = s.getInput().getArray(), V = s.getOutput().getArray();
    ok(n && jn.has(n.getName()), name + ': channel on ' + (n && n.getName()) + ', not a production joint');
    // Blender writes a channel that never changes as two STEP keys (the production model's are the same)
    const k = V.length / T.length, constant = T.length === 2 && [...V.slice(0, k)].every((v, i) => Math.abs(v - V[k + i]) < 1e-4);
    if (!(s.getInterpolation() === 'LINEAR' || (s.getInterpolation() === 'STEP' && constant))) badInterp.push(n.getName() + '.' + ch.getTargetPath() + ' ' + s.getInterpolation());
    dur = Math.max(dur, T[T.length - 1]); t0 = Math.min(t0, T[0]); keys = Math.max(keys, T.length);
  }
  ok(!badInterp.length, name + ': not LINEAR: ' + badInterp.join(', '));
  ok(Math.abs(t0) < 1e-6, name + ': starts at ' + t0);
  ok(Math.abs(dur - (info.frames - 1) / info.fps) < 1 / 240, name + ': ' + dur.toFixed(4) + ' s, want ' + ((info.frames - 1) / info.fps).toFixed(4));
  ok(keys === info.frames, name + ': ' + keys + ' keys, want ' + info.frames);
  // pose the production skeleton with the clip, and compare bone directions with the Blender evaluation
  const evf = path.join(dir, 'eval', name + '.json'); if (!fs.existsSync(evf)) { summary.push(name + ': no eval file, pose not compared'); continue; }
  const ev = JSON.parse(fs.readFileSync(evf, 'utf8')); const byNode = new Map();
  for (const ch of chans) { const nm = ch.getTargetNode().getName(); if (!byNode.has(nm)) byNode.set(nm, {}); byNode.get(nm)[ch.getTargetPath()] = ch; }
  let worst = 0, wrole = '';
  ev.rows.forEach((row, f) => {
    const t = f / info.fps, W = new Map();
    const world = n => { if (W.has(n)) return W.get(n); const c = byNode.get(n.getName()) || {};
      const lt = c.translation ? sampleAt(c.translation, t) : [...n.getTranslation()], lr = c.rotation ? sampleAt(c.rotation, t) : [...n.getRotation()], ls = c.scale ? sampleAt(c.scale, t) : [...n.getScale()];
      const p = parentOf.get(n); let r;
      if (!p) r = { t: lt, r: lr, s: ls };
      else { const P = world(p); const st = lt.map((v, i) => v * P.s[i]); const rt = qrot(P.r, st); r = { t: P.t.map((v, i) => v + rt[i]), r: qmul(P.r, lr), s: ls.map((v, i) => v * P.s[i]) }; }
      W.set(n, r); return r; };
    for (const role of Object.keys(NEXT)) {
      if (!row[role] || !R[role] || !R[NEXT[role]] || R[role] === R[NEXT[role]]) continue;
      const A = world(prodNode.get(R[role])).t, Bp = world(prodNode.get(R[NEXT[role]])).t, d = Bp.map((v, i) => v - A[i]);
      const e = angle(d, back(row[role])); if (e > worst) { worst = e; wrole = role + ' at frame ' + f; }
    }
  });
  ok(worst < 0.5, name + ': bones on the production skeleton point %.3f deg from the retarget\'s own evaluation (' + wrole + ')'.replace('%.3f', worst.toFixed(3)));
  summary.push(name + ': ' + chans.length + ' channels, ' + keys + ' keys, ' + dur.toFixed(3) + ' s, posed on ' + path.basename(prof.glb) + ' within ' + worst.toFixed(3) + ' deg of the Blender evaluation');
}
console.log(summary.join('\n'));
console.log('\nruntime checks: ' + passes + ' passed, ' + fails.length + ' failed');
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
