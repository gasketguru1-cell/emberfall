// Flint's extra clips, cut, mirrored and re-posed from the motion already in his GLB (Meshy's presets). No Meshy calls.
//   node tools/derive.mjs tools/flint-clips.mjs      reads flint-v3.glb, writes flint-v4.glb and Flint's manifest entry
//   then: node tools/addbones.mjs flint               puts the added bones (tools/bones/flint.mjs) on top: flint-b.glb, the file the game loads
// Directions: +Z the way he faces, +X his left, +Y up. turn(pose, bone, [pitch forward, yaw to his left, roll left side up]).
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';

/* ---- Fyrdsman's unarmed up air (UairE, the backflip kick) carried onto Flint's bones ----
   Each mapped bone takes the source bone's turn from its rest, in model space; limbs are first lined up so that at rest they
   point the way the source's do (his bind is an A-pose). The hips' travel is scaled by hip height. Bones with no
   counterpart (Spine01, neck, shoulders, toes) keep their own rest turn. */
const FYRD = await (async () => {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const [sd, fd] = [await io.read('assets/vargan/export/vargan-b.glb'), await io.read('assets/flint/export/flint-v3.glb')];
  const joints = d => new Map(d.getRoot().listSkins()[0].listJoints().map(j => [j.getName(), j]));
  const SJ = joints(sd), FJ = joints(fd);
  const anim = sd.getRoot().listAnimations().find(a => a.getName() === 'UairE'), tr = new Map(); let dur = 0;
  for (const ch of anim.listChannels()) { const pth = ch.getTargetPath(); if (pth === 'scale') continue; const s = ch.getSampler(), times = s.getInput().getArray();
    dur = Math.max(dur, times[times.length - 1]); const k = ch.getTargetNode().getName(); tr.set(k, Object.assign(tr.get(k) || {}, { [pth[0]]: { times, vals: s.getOutput().getArray() } })); }
  const find = (ts, t) => { let lo = 0, hi = ts.length - 1; if (t <= ts[0]) return [0, 0, 0]; if (t >= ts[hi]) return [hi, hi, 0]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; } return [lo, hi, (t - ts[lo]) / (ts[hi] - ts[lo])]; };
  /* a skeleton's world matrices: local TRS from fn(node), everything above the skeleton as the file has it */
  const worldOf = (J, fn) => { const W = new Map(), get = n => { const k = n.getName(); if (W.has(k)) return W.get(k); const p = n.getParentNode();
      const pm = !p ? new THREE.Matrix4() : J.has(p.getName()) ? get(p) : new THREE.Matrix4().fromArray(p.getWorldMatrix());
      const [q, t] = fn(n), m = pm.clone().multiply(new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1))); W.set(k, m); return m; };
    for (const n of J.values()) get(n); return W; };
  const restTRS = n => [new THREE.Quaternion(...n.getRotation()), new THREE.Vector3(...n.getTranslation())];
  const animTRS = t => n => { const [q, p] = restTRS(n), e = tr.get(n.getName()), a = new THREE.Quaternion(), b = new THREE.Quaternion();
    if (e && e.r) { const [i, j, u] = find(e.r.times, t); a.fromArray(e.r.vals, i * 4); b.fromArray(e.r.vals, j * 4); q.copy(a).slerp(b, u); }
    if (e && e.t) { const [i, j, u] = find(e.t.times, t); p.fromArray(e.t.vals, i * 3).lerp(new THREE.Vector3().fromArray(e.t.vals, j * 3), u); }
    return [q, p]; };
  const dec = m => { const p = new THREE.Vector3(), q = new THREE.Quaternion(); m.decompose(p, q, new THREE.Vector3()); return { p, q }; };
  const SR = worldOf(SJ, restTRS), FR = worldOf(FJ, restTRS);
  /* flint bone: [source bone, source child, flint child] (children give the line used to line the limb up) */
  const MAP = { Hips: ['hips'], Spine02: ['spine'], Spine: ['chest'], Head: ['head'] };
  for (const [s, F] of [['L', 'Left'], ['R', 'Right']]) Object.assign(MAP, {
    [F + 'Arm']: ['arm' + s, 'fore' + s, F + 'ForeArm'], [F + 'ForeArm']: ['fore' + s, 'hand' + s, F + 'Hand'], [F + 'Hand']: ['hand' + s],
    [F + 'UpLeg']: ['thigh' + s, 'shin' + s, F + 'Leg'], [F + 'Leg']: ['shin' + s, 'foot' + s, F + 'Foot'], [F + 'Foot']: ['foot' + s] });
  const off = new Map();   /* per mapped bone: srcRest^-1 * align * flintRest */
  for (const [f, [s, sc, fc]] of Object.entries(MAP)) {
    const sr = dec(SR.get(s)), fr = dec(FR.get(f)), al = new THREE.Quaternion();
    if (sc) al.setFromUnitVectors(dec(FR.get(fc)).p.sub(fr.p).normalize(), dec(SR.get(sc)).p.sub(sr.p).normalize());
    off.set(f, sr.q.clone().invert().multiply(al).multiply(fr.q));
  }
  const sHip = dec(SR.get('hips')).p, fHip = dec(FR.get('Hips')).p, k = fHip.y / sHip.y;
  const hipsParent = new THREE.Matrix4().fromArray(FJ.get('Hips').getParentNode().getWorldMatrix()), hpInv = hipsParent.clone().invert();
  const order = [...FJ.values()];   /* skin order: parents before children */
  return { dur, at: t => {   /* Flint's pose at time t: bone -> { q, p } in parent space */
    const SW = worldOf(SJ, animTRS(t)), W = new Map(), pose = new Map();
    for (const n of order) { const b = n.getName(), [rq, rp] = restTRS(n), p = n.getParentNode(), pw = p && W.has(p.getName()) ? W.get(p.getName()) : dec(new THREE.Matrix4().fromArray(p.getWorldMatrix())).q;
      let q = rq; if (off.has(b)) q = pw.clone().invert().multiply(dec(SW.get(MAP[b][0])).q.multiply(off.get(b)));
      W.set(b, pw.clone().multiply(q)); pose.set(b, { q, p: rp }); }
    const hp = dec(SW.get('hips')).p.sub(sHip).multiplyScalar(k).add(fHip).applyMatrix4(hpInv); pose.get('Hips').p = hp;
    return pose; } };
})();

export default L => {
  const o = { in: 'assets/flint/export/flint-v3.glb', out: 'assets/flint/export/flint-v4.glb', clips: {} };
  if (!L) return o;
  const { sample: S, copy, blend, turn, shift, mirror, take, ARM, LEG, range, keys, mod, seq, hold, bump, ease } = L, C = o.clips;
  const JAB = 'Right_Jab_from_Guard', HOOK = 'Left_Hook_from_Guard', UPPER = 'Right_Uppercut_from_Guard', TAU = Math.PI * 2;
  const LEGS = [...LEG('Left'), ...LEG('Right')];

  /* ---- in the air ---- */
  const fb = S('Jumping_Down', 1.0), hang = S('Bar_Hang_Idle', 0);
  C.Fall = { dur: 1.2, fn: t => { const p = copy(fb), w = Math.sin(t / 1.2 * TAU), w2 = Math.sin(t / 1.2 * TAU * 2);   /* upright, arms out for balance, legs treading */
    turn(p, 'LeftArm', [0, 0, 9 * w]); turn(p, 'RightArm', [0, 0, -9 * w]); turn(p, 'LeftForeArm', [0, 0, 6 * w2]); turn(p, 'RightForeArm', [0, 0, -6 * w2]);
    turn(p, 'LeftUpLeg', [7 * w, 0, 0]); turn(p, 'RightUpLeg', [-7 * w, 0, 0]); turn(p, 'Spine02', [3 * w2, 0, 0]); turn(p, 'Head', [-4 * w2, 0, 0]); return p; } };
  C.FastFall = { dur: 0.4, fn: t => { const p = copy(fb), w = Math.sin(t / 0.4 * TAU);   /* a dive: legs straight, arms swept up behind, a shiver of speed */
    take(p, hang, LEGS, 0.8); turn(p, 'Hips', [10, 0, 0]); turn(p, 'Spine02', [8, 0, 0]); turn(p, 'Head', [-10, 0, 0]);
    turn(p, 'LeftArm', [0, 0, 48 + 4 * w]); turn(p, 'RightArm', [0, 0, -48 - 4 * w]); turn(p, 'LeftForeArm', [0, 0, 14 - 4 * w]); turn(p, 'RightForeArm', [0, 0, -14 + 4 * w]); return p; } };
  const tuck = copy(fb); for (const d of ['Left', 'Right']) { const g = d === 'Left' ? 1 : -1; turn(tuck, d + 'UpLeg', [-72, 0, 0]); turn(tuck, d + 'Leg', [95, 0, 0]); turn(tuck, d + 'Arm', [-20, 0, -42 * g]); turn(tuck, d + 'ForeArm', [-50, 0, 0]); }
  turn(tuck, 'Spine02', [16, 0, 0]); turn(tuck, 'Head', [10, 0, 0]);
  const open = copy(fb); turn(open, 'LeftArm', [0, 0, 30]); turn(open, 'RightArm', [0, 0, -30]); turn(open, 'Spine02', [-8, 0, 0]);
  C.AirJump = mod(keys([[0, tuck], [0.2, tuck], [0.42, open, ease.back], [0.5, fb]]), (p, t, u) => { turn(p, 'Hips', [0, 360 * ease.out(Math.min(1, u / 0.8)), 0]); });   /* the second jump: a tucked spin that opens out */

  /* ---- standing about ---- */
  C.IdleLook = mod(range('Idle', 0, 3.3), (p, t, u) => {   /* now and then: lifts the lantern and looks about */
    const a = bump(u, 0.32, 0.3), b = bump(u, 0.7, 0.26), lift = bump(u, 0.45, 0.45);
    turn(p, 'Head', [0, -34 * a + 30 * b, 0]); turn(p, 'neck', [0, -10 * a + 9 * b, 0]); turn(p, 'Spine', [0, -10 * a + 8 * b, 0]);
    turn(p, 'RightArm', [-58 * lift, 0, 0]); turn(p, 'RightForeArm', [-34 * lift, 0, 0]); turn(p, 'Spine02', [-4 * lift, 0, 0]); });
  C.Respawn = mod(range('Idle', 0, 4), (p, t) => { const w = Math.sin(t / 4 * TAU);   /* waiting on the platform: lantern held high */
    turn(p, 'RightArm', [-118, 0, 0]); turn(p, 'RightForeArm', [-20 + 6 * w, 0, 0]); turn(p, 'Spine02', [-6, 0, 0]); turn(p, 'Head', [-8, 10 * w, 0]); });

  /* ---- being hit ---- */
  const sh = S('Block1', 1.2);
  C.ShieldHit = mod(hold(sh, 0.34), (p, t, u) => { const k = bump(u, 0.16, 0.34) + 0.35 * bump(u, 0.62, 0.3);   /* rocked back on his heels, then braces again */
    turn(p, 'Hips', [-7 * k, 0, 0]); turn(p, 'Spine02', [-13 * k, 0, 0]); turn(p, 'Head', [12 * k, 0, 0]); shift(p, [0, -0.035 * k, -0.07 * k]); });
  C.HitHeavy = mod(range('Hit_Reaction', 0, 1.2), (p, t, u) => { const k = bump(u, 0.14, 0.3);   /* the same flinch, thrown much further back */
    turn(p, 'Spine02', [-24 * k, 0, 0]); turn(p, 'Spine', [-12 * k, 0, 0]); turn(p, 'Head', [-20 * k, 0, 0]);
    turn(p, 'LeftArm', [0, 0, 28 * k]); turn(p, 'RightArm', [0, 0, -28 * k]); shift(p, [0, -0.05 * k, -0.09 * k]); });

  /* ---- attacks that used to borrow another move's clip ---- */
  C.Jab2 = { dur: 2, fn: t => mirror(S(JAB, t)) };                               /* the left straight: one-two with the jab */
  C.UpTilt = mod({ dur: 1, fn: t => mirror(S(UPPER, t)) }, (p, t) => { const k = bump(t, 0.6, 0.3);   /* a left uppercut that lifts him onto his toes */
    turn(p, 'Spine02', [-9 * k, 0, 0]); turn(p, 'Head', [-12 * k, 0, 0]); shift(p, [0, 0.05 * k, 0.02 * k]); });
  const grabAt = t => { const p = S(JAB, t), m = mirror(p), k = bump(t, 0.58, 0.4); take(p, m, ARM('Left'));   /* both hands out */
    turn(p, 'Spine02', [9 * k, 0, 0]); turn(p, 'LeftArm', [0, -8, 0]); turn(p, 'RightArm', [0, 8, 0]); return p; };
  C.Grab = { dur: 2, fn: grabAt };
  const held = grabAt(0.63);
  C.Pummel = { dur: 0.5, fn: t => { const u = t / 0.5, p = S(HOOK, 0.1 + ease.out(Math.min(1, u / 0.55)) * 0.3 + Math.max(0, u - 0.55) / 0.45 * 0.35);   /* keeps hold with the right, hooks with the left */
    take(p, held, [...ARM('Right'), ...LEGS, 'Hips']); p.get('Hips').p.copy(held.get('Hips').p); return p; } };
  const pull = turn(shift(turn(copy(grabAt(0.3)), 'Spine02', [-16, 0, 0]), [0, -0.03, -0.06]), 'Hips', [-5, 0, 0]);
  const shove = turn(shift(turn(copy(held), 'Spine02', [14, 0, 0]), [0, -0.03, 0.1]), 'Head', [-14, 0, 0]);
  C.ThrowF = keys([[0, held], [0.2, pull, ease.out], [0.33, shove, ease.snap], [0.5, shove], [0.87, S('Idle', 0), ease.io]]);   /* hauls them in, then shoves with both hands */
  C.UairFlip = { dur: FYRD.dur, fn: t => { const f = FYRD.at(t), p = S('Idle', 0); for (const b of L.bones) if (f.has(b)) p.set(b, f.get(b)); return p; } };   /* the backflip kick, as Fyrdsman's unarmed up air */
  return Object.assign(o, { manifest: man => {
    const F = man.Flint, c = F.clips, a = F.attacks; F.file = o.out;
    Object.assign(c, {
      fall: { clip: 'Fall' }, fastfall: { clip: 'FastFall' }, helpless: { clip: 'Fall1', rate: 1.6 }, airjump: { clip: 'AirJump' },
      idle2: { clip: 'IdleLook' }, respawn: { clip: 'Respawn' }, landHard: { clip: 'Jump_and_Slam_Back_Down', from: 1.62, to: 2.2 },
      shieldHit: { clip: 'ShieldHit' }, hitHeavy: { clip: 'HitHeavy' },
      launchUp: { clip: 'BeHit_FlyUp', from: 0, to: 0.3 }, spike: { clip: 'Knock_Down', from: 0.25, to: 0.5 }, launch: { clip: 'Knock_Down', from: 0.05, to: 0.35 },
      hold: { clip: 'Grab', at: 0.63 }, pummel: { clip: 'Pummel' },
      throw_f: { clip: 'ThrowF' }, throw_b: { clip: 'Over_Shoulder_Throw', from: 1.9, to: 3.2 }, throw_u: { clip: 'Charged_Upward_Slash', from: 0.3, to: 1.6 }, throw_d: { clip: 'Grip_and_Throw_Down', from: 2.4, to: 3.6 },
    });
    a.jab2 = { clip: 'Jab2', start: 0.3, contact: [0.47, 0.68], end: 1.05 };
    a.utilt = { clip: 'UpTilt', start: 0.25, contact: [0.5, 0.68], end: 0.95 };
    a.grab = { clip: 'Grab', start: 0.3, contact: [0.5, 0.63], end: 1.05 };
    a.uair = { clip: 'UairFlip', start: 0, contact: [11 / 60, 16 / 60], end: 0.55 };   /* same clip times as Fyrdsman's uairE */
    a.getup = { clip: '360_Power_Spin_Jump', start: 1.25, contact: [1.45, 1.65], end: 2.1, spin: 0.5 };
  } });
};
