// Makes new animation clips for a model whose clips are baked into its GLB (Flint: Meshy's preset motions), by cutting,
// retiming, mirroring and re-posing the motion that is already there. No Meshy calls, no Blender.
//   node tools/derive.mjs tools/flint-clips.mjs      the spec names the input GLB, the output GLB and the clips
// A spec is a module exporting default (lib) => ({ in, out, clips: { Name: clip }, manifest: (entry) => void }).
// A clip is { dur, fn(t) -> pose }. A pose is a Map: bone name -> { q: Quaternion, p: Vector3 } in the bone's parent space.
// Directions in the helpers are the model's own: +Z is the way it faces, +X its left, +Y up; angles in degrees.
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

const specFile = process.argv[2]; if (!specFile) throw new Error('usage: node tools/derive.mjs <spec.mjs>');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), D2R = Math.PI / 180;
export const ease = {
  lin: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), io: u => u * u * (3 - 2 * u),
  snap: u => 1 - Math.pow(1 - u, 4), back: u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
};

const spec0 = (await import(pathToFileURL(path.resolve(specFile)).href)).default;
const probe = spec0(null), doc = await io.read(probe.in), root = doc.getRoot(), buffer = root.listBuffers()[0];
const skin = root.listSkins()[0], allJoints = skin.listJoints();
const nodeOf = new Map(allJoints.map(j => [j.getName(), j]));

/* ---- source clips ---- */
const src = {};
for (const a of root.listAnimations()) {
  const c = { dur: 0, tr: new Map() };
  for (const ch of a.listChannels()) {
    const n = ch.getTargetNode(), pth = ch.getTargetPath(); if (!n || pth === 'scale' || pth === 'weights') continue;
    const s = ch.getSampler(), times = s.getInput().getArray(), vals = s.getOutput().getArray();
    c.dur = Math.max(c.dur, times[times.length - 1]);
    let e = c.tr.get(n.getName()); if (!e) c.tr.set(n.getName(), e = {}); e[pth === 'rotation' ? 'r' : 't'] = { times, vals };
  }
  src[a.getName()] = c;
}
const bones = [...new Set(Object.values(src).flatMap(c => [...c.tr.keys()]))].filter(b => nodeOf.has(b));
bones.sort((a, b) => allJoints.indexOf(nodeOf.get(a)) - allJoints.indexOf(nodeOf.get(b)));
const parentOf = new Map(bones.map(b => { const p = nodeOf.get(b).getParentNode(); return [b, p && bones.includes(p.getName()) ? p.getName() : null]; }));
const rest = new Map(bones.map(b => { const n = nodeOf.get(b); return [b, { q: new THREE.Quaternion(...n.getRotation()), p: new THREE.Vector3(...n.getTranslation()) }]; }));
/* what sits above the first bone (the armature object): its turn and size, to get from model directions to bone space */
const top = nodeOf.get(bones[0]).getParentNode(), topM = top ? new THREE.Matrix4().fromArray(top.getWorldMatrix()) : new THREE.Matrix4();
const topQ = new THREE.Quaternion(), topS = new THREE.Vector3(); topM.decompose(new THREE.Vector3(), topQ, topS);

const find = (times, t) => { let lo = 0, hi = times.length - 1; if (t <= times[0]) return [0, 0, 0]; if (t >= times[hi]) return [hi, hi, 0]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; } return [lo, hi, (t - times[lo]) / (times[hi] - times[lo])]; };
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function sample(name, t) {
  const c = src[name]; if (!c) throw new Error('no source clip ' + name);
  const pose = new Map();
  for (const b of bones) {
    const e = c.tr.get(b), r = rest.get(b), o = { q: r.q.clone(), p: r.p.clone() };
    if (e && e.r) { const [i, j, u] = find(e.r.times, t); qa.fromArray(e.r.vals, i * 4); qb.fromArray(e.r.vals, j * 4); o.q.copy(qa).slerp(qb, u); }
    if (e && e.t) { const [i, j, u] = find(e.t.times, t); o.p.fromArray(e.t.vals, i * 3).lerp(new THREE.Vector3().fromArray(e.t.vals, j * 3), u); }
    pose.set(b, o);
  }
  return pose;
}
const copy = pose => new Map([...pose].map(([b, o]) => [b, { q: o.q.clone(), p: o.p.clone() }]));
function blend(a, b, k) { const out = new Map(); for (const n of bones) { const x = a.get(n), y = b.get(n); out.set(n, { q: x.q.clone().slerp(y.q, k), p: x.p.clone().lerp(y.p, k) }); } return out; }
/* world turns of every bone in a pose (model space) */
function world(pose) { const W = new Map(); for (const b of bones) { const p = parentOf.get(b); W.set(b, (p ? W.get(p) : topQ).clone().multiply(pose.get(b).q)); } return W; }
const restW = world(rest);
/* turn a bone about the model's axes, on top of what it is doing: [pitch forward, yaw to its left, roll left side up] */
function turn(pose, bone, deg, k = 1) {
  if (!pose.has(bone)) throw new Error('no bone ' + bone);
  const W = world(pose), p = parentOf.get(bone), Wp = p ? W.get(p) : topQ;
  const d = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg[0] * D2R * k, deg[1] * D2R * k, deg[2] * D2R * k, 'YXZ'));
  const o = pose.get(bone); o.q.copy(Wp.clone().invert().multiply(d).multiply(Wp).multiply(o.q)); return pose;
}
/* move the whole body: [to its left, up, forward] in game units given the model's height in game units */
function shift(pose, v, unit = 1) { const o = pose.get(bones[0]); o.p.add(new THREE.Vector3(v[0] * unit / topS.x, v[1] * unit / topS.y, v[2] * unit / topS.z).applyQuaternion(topQ.clone().invert())); return pose; }
const other = b => b.startsWith('Left') ? 'Right' + b.slice(4) : b.startsWith('Right') ? 'Left' + b.slice(5) : b;
function mirror(pose) {
  const W = world(pose), W2 = new Map(), out = new Map();
  for (const b of bones) { const d = W.get(b).clone().multiply(restW.get(b).clone().invert()); d.set(d.x, -d.y, -d.z, d.w); W2.set(other(b), d.multiply(restW.get(other(b)))); }
  for (const b of bones) { const p = parentOf.get(b), Wp = p ? W2.get(p) : topQ; out.set(b, { q: Wp.clone().invert().multiply(W2.get(b)), p: pose.get(b).p.clone() }); }
  return out;
}
/* take some bones' turns from another pose; names match by prefix ("LeftArm" also takes LeftForeArm? no: exact or listed) */
function take(pose, from, list, k = 1) { for (const b of list) { if (!pose.has(b)) throw new Error('no bone ' + b); pose.get(b).q.slerp(from.get(b).q, k); } return pose; }
const ARM = s => [s + 'Shoulder', s + 'Arm', s + 'ForeArm', s + 'Hand'], LEG = s => [s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'ToeBase'];

/* ---- clip builders ---- */
const range = (name, a, b, dur, e = ease.lin) => ({ dur: dur || Math.abs(b - a), fn: t => sample(name, a + (b - a) * e(clamp(t / (dur || Math.abs(b - a)), 0, 1))) });
/* keys: [[time, pose, ease into this key], ...] */
function keys(list) { const dur = list[list.length - 1][0]; return { dur, fn: t => { let i = 0; while (i < list.length - 2 && t > list[i + 1][0]) i++; const a = list[i], b = list[i + 1], u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1); return blend(a[1], b[1], (b[2] || ease.io)(u)); } }; }
/* change every frame of a clip: fn(pose, t, u) where u runs 0..1 through it */
const mod = (c, f) => ({ dur: c.dur, fn: t => { const p = copy(c.fn(t)); f(p, t, clamp(t / c.dur, 0, 1)); return p; } });
/* one after another, each eased into from the one before over x seconds */
function seq(parts, x = 0.07) { const starts = []; let d = 0; for (const p of parts) { starts.push(d); d += p.dur; }
  return { dur: d, fn: t => { let i = parts.length - 1; while (i > 0 && t < starts[i]) i--; const lt = t - starts[i], cur = parts[i].fn(Math.min(lt, parts[i].dur)); if (i > 0 && lt < x) return blend(parts[i - 1].fn(parts[i - 1].dur), cur, ease.io(lt / x)); return cur; } }; }
const hold = (pose, dur) => ({ dur, fn: () => pose });
const bump = (u, at, w) => { const x = (u - at) / w; return Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(x * Math.PI); };   /* a smooth hump centred on `at`, half-width w */

const lib = { sample, copy, blend, turn, shift, mirror, take, ARM, LEG, range, keys, mod, seq, hold, bump, ease, bones, src: Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.dur])) };
const spec = spec0(lib);

/* ---- write ---- */
const FPS = 30, made = [];
for (const a of root.listAnimations()) if (spec.clips[a.getName()]) { for (const ch of a.listChannels()) ch.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }
for (const [name, c] of Object.entries(spec.clips)) {
  const n = Math.max(2, Math.round(c.dur * FPS) + 1), times = new Float32Array(n), R = new Map(bones.map(b => [b, new Float32Array(n * 4)])), T = new Map(bones.map(b => [b, new Float32Array(n * 3)]));
  const last = new Map();
  for (let i = 0; i < n; i++) { const t = i / FPS; times[i] = t; const pose = c.fn(Math.min(t, c.dur));
    for (const b of bones) { const o = pose.get(b), q = o.q.clone().normalize(), l = last.get(b); if (l && l.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); last.set(b, q); q.toArray(R.get(b), i * 4); o.p.toArray(T.get(b), i * 3); } }
  const anim = doc.createAnimation(name), tAcc = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer);
  for (const b of bones) {
    const rs = doc.createAnimationSampler().setInput(tAcc).setOutput(doc.createAccessor().setType('VEC4').setArray(R.get(b)).setBuffer(buffer)).setInterpolation('LINEAR');
    const ts = doc.createAnimationSampler().setInput(tAcc).setOutput(doc.createAccessor().setType('VEC3').setArray(T.get(b)).setBuffer(buffer)).setInterpolation('LINEAR');
    anim.addSampler(rs).addSampler(ts);
    anim.addChannel(doc.createAnimationChannel().setTargetNode(nodeOf.get(b)).setTargetPath('rotation').setSampler(rs));
    anim.addChannel(doc.createAnimationChannel().setTargetNode(nodeOf.get(b)).setTargetPath('translation').setSampler(ts));
  }
  made.push(name + ' ' + c.dur.toFixed(2) + 's');
}
await io.write(spec.out, doc);
console.log('derive: ' + made.length + ' clips -> ' + spec.out + '\n  ' + made.join(', '));
if (spec.manifest && !process.argv.includes('--test')) {
  const mf = path.resolve('assets/manifest.json'), man = JSON.parse(fs.readFileSync(mf, 'utf8')); spec.manifest(man);
  fs.writeFileSync(mf, JSON.stringify(man, null, 1) + '\n'); console.log('derive: manifest updated');
}
