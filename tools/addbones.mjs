// Adds bones to a fighter's packed, game-ready GLB: places them, moves skin weights onto them, keys the ones that act
// (fingers closing, eyes blinking, a jaw opening) into every clip, and writes the manifest's "springs" for the ones the
// game swings on its own (tails, ears, cloth, feathers, fat). The clips already in the file are left exactly as they were.
//   node tools/addbones.mjs <fighter>        reads tools/bones/<fighter>.mjs; e.g. nib, hod, loom, sack, scuttle, flint,
//                                            fyrdsman, rusty, bolt, cinder, pip, pearl; "all" does every one
//   node tools/addbones.mjs nib --list       just prints the plan (bones, parents, what each one is for)
// Run it again after the fighter's own build (build-anim.sh, build-rig.sh, ...) writes a fresh base GLB: it always reads the
// base file named in the spec and writes the "-b" file next to it, and points the manifest at that file.
//
// A spec (tools/bones/<fighter>.mjs) exports default { in, out, manifest: [entry names], bones, weights, springs, keys }:
//   bones:   [{ name, parent, head: [x,y,z], tail: [x,y,z], why }]   model coordinates of the base GLB (y up, +z forward,
//            x the fighter's left), as tools/blender/gridview.py shows them. New bones have no turn of their own.
//   weights: [{ bone | chain: [bones], f(p, G) -> 0..1, from: [bone names] | (name => bool), s }]   in order; each rule
//            takes share f*s of what the "from" bones hold at a point and gives it to its bone (or splits it along the
//            chain by where the point lies along it). G has the point's colour (G.rgb 0..255, G.hsv) and old weights.
//   springs: [{ bones: [chain, root first], k, d, max, drag }]   the last bone's tip is filled in from its "tail"
//   keys(clip) -> { bone: [[t, [[axis, degrees], ...]], ...] }   turns about model axes at rest (seen from the parent);
//            clip = { name, dur, kind: 'attack'|'hit'|'idle'|'move'|'other', contact: [t0, t1] | null, start, end }.
//            Every keyed bone gets a track in every clip (rest where keys() says nothing), so no pose is left behind.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp'; import * as THREE from 'three';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
import { clamp, smooth, V } from './bones/_lib.mjs';
const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/* a world-axis turn list -> quaternion: [[axis, degrees], ...] applied in order (axis 'x' | 'y' | 'z' | [x,y,z]) */
function turn(list) {
  const q = new THREE.Quaternion();
  for (const [ax, deg] of list || []) q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(typeof ax === 'string' ? AX[ax] : ax).normalize(), deg * Math.PI / 180));
  return q;
}

async function run(name, listOnly, flag) {
  const spec = (await import(pathToFileURL(path.join(ROOT, 'tools/bones', name + '.mjs')).href)).default;
  const IN = path.join(ROOT, spec.in), OUT = path.join(ROOT, spec.out);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(IN), root = doc.getRoot(), buffer = root.listBuffers()[0];
  const skin = root.listSkins()[0], joints = skin.listJoints(), jn = joints.map(j => j.getName()), node = n => root.listNodes().find(q => q.getName() === n);
  const before = joints.length;
  if (listOnly) { console.log(name + ': ' + before + ' bones + ' + spec.bones.length); for (const b of spec.bones) console.log('  ' + b.name.padEnd(12) + ' <' + b.parent.padEnd(10) + '> ' + (b.why || '')); return; }
  for (const b of spec.bones) if (jn.includes(b.name)) throw new Error(name + ': ' + spec.in + ' already has a bone ' + b.name);
  /* ---- the bones: no turn of their own, so each sits square to its parent ---- */
  const world = n => new THREE.Matrix4().fromArray(n.getWorldMatrix());
  const made = {};
  for (const b of spec.bones) {
    const par = made[b.parent] || node(b.parent); if (!par) throw new Error(name + ': no parent ' + b.parent + ' for ' + b.name);
    /* turned so that at rest the bone sits square to the model (its axes are the model's): keyed turns and squashes then
       read the same on every fighter, whatever way its parent happens to point */
    const pm = world(par), pq = new THREE.Quaternion(); pm.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
    const p = V(b.head).applyMatrix4(pm.clone().invert()), lq = pq.clone().invert();
    const n = doc.createNode(b.name).setTranslation([p.x, p.y, p.z]).setRotation([lq.x, lq.y, lq.z, lq.w]);
    par.addChild(n); joints.push(n); jn.push(b.name); skin.addJoint(n); made[b.name] = n;
  }
  const ibm = new Float32Array(joints.length * 16); ibm.set(skin.getInverseBindMatrices().getArray());
  for (let k = before; k < joints.length; k++) ibm.set(world(joints[k]).invert().elements, k * 16);
  skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buffer));
  const J = Object.fromEntries(jn.map((n, i) => [n, i])), B = Object.fromEntries(spec.bones.map(b => [b.name, b]));
  const upJ = {}; joints.forEach((j, i) => { for (const c of j.listChildren()) { const k = joints.indexOf(c); if (k >= 0) upJ[k] = i; } });
  const under = (q, anc) => { for (let x = B[q]; x; x = B[x.parent]) if (x.parent === anc) return true; return false; };

  /* ---- weights, per welded point (a mesh is split along texture seams; points that share a place must move together) ---- */
  let moved = 0, trimmed = 0, points = 0;
  const used = {}, diag = {}; for (const b of spec.bones) { used[b.name] = 0; diag[b.name] = { f: 0, src: 0, top: {} }; }
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const Pa = prim.getAttribute('POSITION'), Ua = prim.getAttribute('TEXCOORD_0'), Ja = prim.getAttribute('JOINTS_0'), Wa = prim.getAttribute('WEIGHTS_0'); if (!Ja) continue;
    const n = Pa.getCount(), tex = prim.getMaterial() && prim.getMaterial().getBaseColorTexture();
    let img = null; if (tex && Ua) { const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true }); img = { data, w: info.width, h: info.height }; }
    const gid = new Int32Array(n), groups = [], seen = new Map(), p = [], u = [0, 0], j = [], w = [];
    for (let i = 0; i < n; i++) {
      Pa.getElement(i, p); Ja.getElement(i, j); Wa.getElement(i, w); if (Ua) Ua.getElement(i, u);
      const key = p.map(v => Math.round(v * 1e4)).join(','); let g = seen.get(key);
      if (g === undefined) { g = groups.length; seen.set(key, g); const m = new Map(); for (let k = 0; k < 4; k++) if (w[k] > 0) m.set(j[k], (m.get(j[k]) || 0) + w[k]); groups.push({ p: V(p), m, rgb: [0, 0, 0], n: 0, nb: new Set(), touched: false }); }
      gid[i] = g; const G = groups[g]; G.n++;
      if (img) { const px = clamp(Math.floor((u[0] - Math.floor(u[0])) * img.w), 0, img.w - 1), py = clamp(Math.floor((u[1] - Math.floor(u[1])) * img.h), 0, img.h - 1), o = (py * img.w + px) * 3; for (let k = 0; k < 3; k++) G.rgb[k] += img.data[o + k]; }
    }
    for (const G of groups) { G.rgb = G.rgb.map(v => v / G.n); const [r, g, b] = G.rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d > 1e-6) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; G.hsv = [(h * 60 + 360) % 360, mx ? d / mx : 0, mx]; G.lum = r * 0.3 + g * 0.6 + b * 0.1; G.w = q => G.m.get(J[q]) || 0; }
    const idx = prim.getIndices() ? prim.getIndices().getArray() : null;
    if (idx) for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = gid[idx[t + k]], b = gid[idx[t + (k + 1) % 3]]; if (a !== b) { groups[a].nb.add(b); groups[b].nb.add(a); } }
    points += groups.length;
    for (const rule of spec.weights) {
      const chain = rule.chain || [rule.bone], s = rule.s === undefined ? 1 : rule.s;
      const fromOk = typeof rule.from === 'function' ? rule.from : rule.from ? (q => rule.from.includes(q)) : (() => true);
      /* Weight comes only from the bone the new one hangs on (and from new bones already placed under it): a share taken from
         any other bone would leave that point following a different bone than before, and the skin shears where the
         share fades out. A rule may name others in "loose" when they move together anyway. */
      const root = B[chain[0]].parent, okStrict = q => spec.strict === false || q === root || (rule.loose || []).includes(q) || (B[q] && under(q, root));
      const src = new Set(jn.map((q, i) => fromOk(q) && okStrict(q) && !chain.includes(q) ? i : -1).filter(i => i >= 0));
      /* along a chain: the line from the first head through each head to the last tail */
      const pts = chain.map(c => V(B[c] ? B[c].head : [0, 0, 0])).concat([V(B[chain[chain.length - 1]].tail)]);
      for (const G of groups) {
        let f = rule.f(G.p, G); if (!(f > 1e-4)) continue; f = Math.min(1, f) * s;
        let tot = 0; for (const [q, v] of G.m) if (src.has(q)) tot += v;
        for (const c of chain) { const D = diag[c]; if (!D) continue; D.f = Math.max(D.f, f); if (f > 0.5) { D.src = Math.max(D.src, tot); for (const [q, v] of G.m) if (v > 0.3) D.top[jn[q]] = (D.top[jn[q]] || 0) + 1; } }
        if (tot < 1e-5) continue;
        const take = f * Math.min(1, tot);
        for (const [q, v] of G.m) if (src.has(q)) G.m.set(q, v - take * v / tot);
        if (chain.length === 1) G.m.set(J[chain[0]], (G.m.get(J[chain[0]]) || 0) + take);
        else {
          /* nearest segment, blended toward its neighbour near each joint */
          let best = 0, bd = 1e9, bt = 0;
          for (let k = 0; k < chain.length; k++) { const a = pts[k], ab = pts[k + 1].clone().sub(a), t = clamp(G.p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1), d = G.p.distanceTo(a.clone().addScaledVector(ab, t)); if (d < bd) { bd = d; best = k; bt = t; } }
          const blend = rule.blend === undefined ? 0.3 : rule.blend; let share = [[best, 1]];
          if (bt < blend && best > 0) { const x = 0.5 + 0.5 * smooth(bt / blend); share = [[best, x], [best - 1, 1 - x]]; }
          else if (bt > 1 - blend && best < chain.length - 1) { const x = 0.5 + 0.5 * smooth((1 - bt) / blend); share = [[best, x], [best + 1, 1 - x]]; }
          for (const [k, x] of share) G.m.set(J[chain[k]], (G.m.get(J[chain[k]]) || 0) + take * x);
        }
        G.touched = true;
      }
    }
    /* even the new weights out with their neighbours (two passes), so nothing moves on its own */
    const isNew = q => q >= before;
    for (let pass = 0; pass < (spec.smooth === undefined ? 2 : spec.smooth); pass++) {
      const next = groups.map(G => {
        const near = [...G.nb].filter(q => groups[q].touched); if (!G.touched && !near.length) return G.m; if (!G.nb.size) return G.m;
        const m = new Map(); for (const [q, v] of G.m) m.set(q, v * 0.5);
        for (const q of G.nb) for (const [b, v] of groups[q].m) m.set(b, (m.get(b) || 0) + v * 0.5 / G.nb.size);
        /* only the share of new bones is evened out; old bones keep their own proportions of the rest */
        let newOld = 0, newNew = 0; for (const [q, v] of m) if (isNew(q)) newNew += v;
        for (const [q, v] of G.m) if (isNew(q)) newOld += v;
        const out = new Map(); let oldSum = 0; for (const [q, v] of G.m) if (!isNew(q)) oldSum += v;
        for (const [q, v] of G.m) if (!isNew(q)) out.set(q, oldSum > 0 ? v / oldSum * (1 - newNew) : 0);
        for (const [q, v] of m) if (isNew(q)) out.set(q, v);
        if (oldSum <= 0 && newNew < 1) for (const [q, v] of out) out.set(q, v / Math.max(1e-6, newNew));
        return out;
      });
      groups.forEach((G, k) => { G.m = next[k]; if ([...G.m.keys()].some(isNew)) G.touched = true; });
    }
    const Jn = new Uint16Array(n * 4), Wn = new Float32Array(n * 4);
    for (const G of groups) {
      /* more than four: fold the lightest new bone into its parent (which moves exactly like it unless keyed or swung),
         and only when no new bone is left to fold drop the lightest old one, so the base clips still move every point as before */
      const m = new Map([...G.m].filter(e => e[1] > 1e-3));
      if (m.size > 4) trimmed++;
      while (m.size > 4) {
        /* cheapest first: a new bone whose ancestor is already here folds into it (nothing lost);
           any other new bone counts double and an old bone triple, so an old one goes only when it is far lighter */
        const anc = q => { for (let b = upJ[q]; b !== undefined; b = upJ[b]) if (m.has(b)) return b; return null; };
        const cost = e => e[1] * (!isNew(e[0]) ? 3 : anc(e[0]) !== null ? 1 : 2);
        const lo = [...m].sort((a, b) => cost(a) - cost(b))[0];
        m.delete(lo[0]);
        const to = isNew(lo[0]) ? anc(lo[0]) : null; if (to !== null) m.set(to, m.get(to) + lo[1]);
      }
      const top = [...m].sort((a, b) => b[1] - a[1]);
      G.use = top.slice(0, 4); G.sum = G.use.reduce((a, e) => a + e[1], 0) || 1;
      if (G.use.some(e => isNew(e[0]))) moved++;
      for (const [q, v] of G.use) if (isNew(q) && v / G.sum > 0.3) used[jn[q]]++;
    }
    for (let i = 0; i < n; i++) { const G = groups[gid[i]]; for (let k = 0; k < 4; k++) { Jn[i * 4 + k] = G.use[k] ? G.use[k][0] : 0; Wn[i * 4 + k] = G.use[k] ? G.use[k][1] / G.sum : 0; } }
    const Jt = joints.length < 256 ? new Uint8Array(Jn) : Jn;
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(Jt).setBuffer(buffer));
    prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(Wn).setBuffer(buffer));
    Ja.dispose(); Wa.dispose();
  }

  /* ---- keys: every keyed bone gets a rotation track in every clip ---- */
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8')), entries = spec.manifest.map(e => man[e]).filter(Boolean);
  const info = (clipName, dur) => {
    const c = { name: clipName, dur, kind: 'other', contact: null, start: 0, end: dur };
    for (const e of entries) {
      for (const a of Object.values(e.attacks || {})) if (a.clip === clipName && a.contact) { c.kind = 'attack'; c.contact = a.contact; c.start = a.start || 0; c.end = a.end || dur; }
      if (c.kind === 'attack') break;
      for (const [k, a] of Object.entries(e.clips || {})) if (a.clip === clipName) {
        c.kind = /^(hit|tumble|held|dizzy|down|launch|spike|hitheavy|shieldhit)/i.test(k) ? 'hit' : /^(idle|swap|shield|ledge)/i.test(k) ? 'idle' : /^(walk|run|dash|rise|fall|jump|land|crouch|brake|roll|dodge|airdodge|fastfall|airjump|hop)/i.test(k) ? 'move' : c.kind;
        if (c.kind !== 'other') break;
      }
    }
    if (c.kind === 'other' && /hit|tumble|held|launch|spike|down/i.test(clipName)) c.kind = 'hit';
    if (c.kind === 'other' && /idle/i.test(clipName)) c.kind = 'idle';
    return c;
  };
  const keyed = new Set(); let tracks = 0;
  if (spec.keys) {
    const Rp = {}; for (const b of spec.bones) { const m = world(made[b.parent] || node(b.parent)), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(); m.decompose(t, q, s); Rp[b.name] = q; }
    const all = root.listAnimations().map(a => { let dur = 0; for (const ch of a.listChannels()) { const t = ch.getSampler().getInput().getArray(); dur = Math.max(dur, t[t.length - 1]); } return { a, ks: spec.keys(info(a.getName(), dur)) || {}, dur }; });
    for (const { ks } of all) for (const b in ks) keyed.add(b);
    /* a bone squashed in any clip gets a scale track in every clip (1 where it isn't squashed) */
    var keyedScale = new Set(); for (const { ks } of all) for (const b in ks) if (ks[b].some(([, l]) => (l || []).some(e => e && !Array.isArray(e) && e.s))) keyedScale.add(b);
    for (const { a, ks, dur } of all) for (const b of keyed) {
      if (!made[b]) throw new Error(name + ': keys for unknown bone ' + b);
      let list = (ks[b] || []).filter(k => k[0] <= dur + 1e-6); if (!list.length) list = [[0, []]];
      list.sort((x, y) => x[0] - y[0]);
      /* sample at 30 a second with an ease between keys, so the tracks play smoothly whatever the player interpolates */
      /* a pose: [[axis, degrees], ...] turns, optionally followed by { s: [x, y, z] } a squash along the model's axes */
      const qs = list.map(([, l]) => Rp[b].clone().invert().multiply(turn((l || []).filter(Array.isArray))));
      const ss = list.map(([, l]) => { const o = (l || []).find(e => e && !Array.isArray(e) && e.s); return o ? o.s : [1, 1, 1]; });
      const scaled = ss.some(v => v.some(x => Math.abs(x - 1) > 1e-4));
      const times = [], vals = [], svals = [];
      const steps = Math.max(1, Math.round(dur * 30));
      for (let i = 0; i <= steps; i++) {
        const t = dur * i / steps; let k = 0; while (k < list.length - 1 && list[k + 1][0] <= t) k++;
        let q, sc; if (k >= list.length - 1 || t <= list[0][0]) { const e = t <= list[0][0] ? 0 : qs.length - 1; q = qs[e].clone(); sc = ss[e]; }
        else { const x = smooth((t - list[k][0]) / Math.max(1e-6, list[k + 1][0] - list[k][0])); q = qs[k].clone().slerp(qs[k + 1], x); sc = ss[k].map((v, i) => v + (ss[k + 1][i] - v) * x); }
        times.push(t); vals.push(q.x, q.y, q.z, q.w); svals.push(...sc);
      }
      const sampler = doc.createAnimationSampler().setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer)).setOutput(doc.createAccessor().setType('VEC4').setArray(new Float32Array(vals)).setBuffer(buffer)).setInterpolation('LINEAR');
      a.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(made[b]).setTargetPath('rotation').setSampler(sampler)); tracks++;
      if (scaled || keyedScale.has(b)) {
        keyedScale.add(b);
        const s2 = doc.createAnimationSampler().setInput(sampler.getInput()).setOutput(doc.createAccessor().setType('VEC3').setArray(new Float32Array(svals)).setBuffer(buffer)).setInterpolation('LINEAR');
        a.addSampler(s2).addChannel(doc.createAnimationChannel().setTargetNode(made[b]).setTargetPath('scale').setSampler(s2)); tracks++;
      }
    }
  }

  await io.write(OUT, doc);
  /* ---- manifest: the new file, and the springs (last tip in the bone's own axes) ---- */
  const springs = (spec.springs || []).map(c => {
    const last = c.bones[c.bones.length - 1], tip = V(B[last].tail).applyMatrix4(world(made[last]).invert());
    const o = { bones: c.bones }; for (const k of ['k', 'd', 'max', 'drag']) if (c[k] !== undefined) o[k] = c[k]; o.tip = [tip.x, tip.y, tip.z].map(v => +v.toFixed(4)); return o;
  });
  const mine = new Set(spec.bones.map(b => b.name)), have = new Set(joints.map(j => j.getName()));
  for (const e of spec.manifest) {
    const m = man[e]; if (!m) { console.log('addbones: no manifest entry ' + e); continue; }
    m.file = spec.out; /* an old chain goes if it holds a new bone, shares a bone with a new chain (a chain made longer
                          replaces it) or names a bone the model doesn't have (left from an earlier spec) */
    const taken = new Set(springs.flatMap(c => c.bones)); m.springs = (m.springs || []).filter(c => !c.bones.some(b => mine.has(b) || taken.has(b) || !have.has(b))).concat(springs);
  }
  fs.writeFileSync(path.join(ROOT, 'assets/manifest.json'), JSON.stringify(man, null, 1) + '\n');
  const idle = spec.bones.filter(b => !used[b.name]).map(b => b.name), thin = spec.bones.filter(b => used[b.name] && used[b.name] < 10).map(b => b.name);
  console.log('addbones ' + name + ': ' + before + ' -> ' + joints.length + ' bones; ' + moved + ' of ' + points + ' points reweighted, ' + trimmed + ' trimmed to four bones; '
    + springs.length + ' spring chains, ' + keyed.size + ' keyed bones (' + tracks + ' tracks); ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB -> ' + spec.out
    + (idle.length ? '\n  WARNING: these bones lead no vertex: ' + idle.join(' ') : ''));
  for (const b of flag === '--why' ? spec.bones.map(x => x.name) : idle.concat(flag === '--counts' ? thin : [])) { const D = diag[b]; console.log('    ' + b + ': region peak ' + D.f.toFixed(2) + ', source share there ' + D.src.toFixed(2) + ', main bones there ' + (Object.entries(D.top).sort((x, y) => y[1] - x[1]).slice(0, 4).map(e => e[0] + ' ' + e[1]).join(', ') || 'none')); }
  if (flag === '--counts') console.log('    ' + spec.bones.map(b => b.name + ' ' + used[b.name]).join(', '));
  return { name, used };
}

const [, , who, flag] = process.argv;
if (!who) { console.log('usage: node tools/addbones.mjs <fighter>|all [--list]'); process.exit(1); }
const list = who === 'all' ? fs.readdirSync(path.join(ROOT, 'tools/bones')).filter(f => f.endsWith('.mjs') && !f.startsWith('_')).map(f => f.replace(/\.mjs$/, '')) : [who];
for (const n of list) await run(n, flag === '--list', flag);
