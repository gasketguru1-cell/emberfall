'use strict';
/* CapeSim: cloth for capes and long coat tails, driven by a skeleton's animation. Engine-agnostic: plain numbers in,
   plain numbers out, no dependencies. Works in the browser (global CapeSim) and in node (require).

   The cloth is a grid of particles (a few chains side by side), described by a JSON spec in the model's own units
   (metres, y up). Brand's is assets/brand/work/brand2-cape.json, written by tools/blender/brand2.js. Each step it is given,
   in world space: where the animation puts every particle (the hand-keyed cape pose), and the body's capsules. It then
   does position-based dynamics (XPBD, small substeps):
     - gravity, velocity damping, and air resistance on every triangle of the cloth (so it streams out behind a run, fills
       like a sail in a fall, and lies flat again when he stops), with an optional wind;
     - the top row pinned to the animation (it is sewn to the shoulders);
     - stretch links down each chain that do not stretch, across between chains that let the cloth bunch, shear and bend
       links that give it body, and a long-range tether from the shoulder so a fast move can never stretch it;
     - a pull toward the animated pose that is firm at the shoulders and loose at the hem (the animator's cape stays the
       intent; the physics adds the overlap and settle), a cap on how far each particle may stray from it, and a cone
       about the animated direction of each segment;
     - collisions with the body's capsules (hips, back, thighs, shins, upper arms) with friction, an optional floor;
     - the character's own big jumps handled: a teleport (respawn) resets it, a turn of more than snapAngle in one step
       (the game flipping him round) carries the cloth round rigidly instead of whipping it through his body, and only
       inertia.move of his travel is felt (1 = all of it).
   Use:
     const sim = CapeSim.create(spec, { unit })      unit = world units per metre (default 1)
     sim.step(targets, colliders, dt)                 targets: [[x,y,z]] world, one per particle; colliders: [[a, b, r]]
                                                       world (a, b points, r in world units); dt seconds (1/60 a game step)
     sim.pos                                          Float64Array of world positions, 3 per particle
     sim.reset(targets)                               put it straight onto the animation (spawn, a cut)
   Then point each bone (spec.bones: head and tail particle) from where its head now is at its tail particle, parents
   first. CapeSim.three(THREE, skinnedRoot, spec) does all of this for a three.js model (render3d.js). */
(function (root) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function create(spec, opt) {
    opt = opt || {};
    const U = opt.unit || 1, P = spec.particles, n = P.length;
    const x = new Float64Array(n * 3), xp = new Float64Array(n * 3), v = new Float64Array(n * 3), t0 = new Float64Array(n * 3), t1 = new Float64Array(n * 3), tg = new Float64Array(n * 3);
    const w = P.map(p => p.pinned ? 0 : 1 / (p.mass || 0.05)), rad = P.map(p => p.radius || 0.03);
    const links = spec.links.map(l => Object.assign({ lambda: 0 }, l));
    const tris = spec.triangles || [], cols0 = [], cols1 = [];
    const g = (spec.gravity || [0, -9.81, 0]).map(c => c * (spec.gravityScale === undefined ? 1 : spec.gravityScale));
    const air = spec.air || { normal: 1.2, tangent: 0.05 }, damp = spec.damping || 1, inert = spec.inertia || {}, maxV = spec.maxSpeed || 25;
    const nsub = spec.substeps || 4, iters = spec.iterations || 1, wind = (opt.wind || spec.wind || [0, 0, 0]).slice();
    const out = new Float64Array(n * 3);
    let ready = false, frame0 = null;
    const st = { pos: out, wind, reset, step, contacts: 0, spec };

    /* everything inside runs in metres; world numbers are divided by U on the way in and multiplied on the way out */
    function load(dst, targets) { for (let i = 0; i < n; i++) { const p = targets[i]; dst[i * 3] = p[0] / U; dst[i * 3 + 1] = p[1] / U; dst[i * 3 + 2] = p[2] / U; } }
    function reset(targets) {
      load(t1, targets); x.set(t1); xp.set(t1); t0.set(t1); v.fill(0); for (const l of links) l.lambda = 0;
      frame0 = frameOf(t1); ready = true; emit();
    }
    function emit() { for (let i = 0; i < n * 3; i++) out[i] = x[i] * U; }
    const P3 = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
    /* the cloth's own frame from the animation: across the shoulders, and down the middle chain */
    const fr = spec.frame || { left: 0, right: 0, top: 0, below: 1 };
    function frameOf(T) {
      const o = P3(T, fr.top), ax = norm(sub(P3(T, fr.left), P3(T, fr.right))), dn = sub(P3(T, fr.below), o);
      const az = norm(cross(ax, dn)), ay = cross(az, ax);
      return { o, m: [ax, ay, az] };
    }
    /* turn a point by the change between two frames (rows of m are the axes) */
    const carry = (f0, f1, p, isVec) => { const d = isVec ? p : sub(p, f0.o), l = [dot(d, f0.m[0]), dot(d, f0.m[1]), dot(d, f0.m[2])];
      const r = [0, 1, 2].map(k => f1.m[0][k] * l[0] + f1.m[1][k] * l[1] + f1.m[2][k] * l[2]); return isVec ? r : [r[0] + f1.o[0], r[1] + f1.o[1], r[2] + f1.o[2]]; };

    function step(targets, colliders, dt) {
      if (!ready) { reset(targets); return st; }
      t0.set(t1); load(t1, targets);
      /* a respawn or a cut: straight onto the animation */
      let moved = 0; for (let i = 0; i < n; i++) if (w[i] === 0) moved = Math.max(moved, len(sub(P3(t1, i), P3(t0, i))));
      if (moved > (inert.teleport || 2)) { reset(targets); return st; }
      /* the body turned a long way in one step (the game turning him round): carry the cloth round with it */
      const f1 = frameOf(t1), cosA = (dot(frame0.m[0], f1.m[0]) + dot(frame0.m[1], f1.m[1]) + dot(frame0.m[2], f1.m[2]) - 1) / 2;
      if (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI > (inert.snapAngle || 100)) {
        for (let i = 0; i < n; i++) { const p = carry(frame0, f1, P3(x, i)), q = carry(frame0, f1, P3(v, i), true); x.set(p, i * 3); v.set(q, i * 3); }
      } else if (inert.move !== undefined && inert.move < 1) {
        /* feel only part of the body's travel: the rest is carried along rigidly */
        const d = sub(f1.o, frame0.o), k = 1 - inert.move;
        for (let i = 0; i < n; i++) if (w[i]) for (let c = 0; c < 3; c++) x[i * 3 + c] += d[c] * k;
      }
      frame0 = f1;
      cols0.length = cols1.length; for (let c = 0; c < colliders.length; c++) { cols0[c] = cols1[c] || null; const q = colliders[c]; cols1[c] = [q[0].map(z => z / U), q[1].map(z => z / U), q[2] / U]; }
      const h = dt / nsub, wv = wind.map(z => z / U);
      st.contacts = 0;
      for (let s = 1; s <= nsub; s++) {
        const k = s / nsub;
        for (let i = 0; i < n * 3; i++) tg[i] = t0[i] + (t1[i] - t0[i]) * k;   /* the animation's pose part way through the step */
        const cols = cols1.map((c, ci) => { const o = cols0[ci]; if (!o) return c; return [o[0].map((z, j) => z + (c[0][j] - z) * k), o[1].map((z, j) => z + (c[1][j] - z) * k), c[2]]; });
        /* forces: gravity, then air on each triangle, then damping */
        for (let i = 0; i < n; i++) if (w[i]) for (let c = 0; c < 3; c++) v[i * 3 + c] += g[c] * h;
        for (const [a, b, c] of tris) {
          const pa = P3(x, a), pb = P3(x, b), pc = P3(x, c), nn = cross(sub(pb, pa), sub(pc, pa)), area2 = len(nn); if (area2 < 1e-9) continue;
          const nrm = nn.map(z => z / area2), area = area2 / 2;
          const vr = [0, 1, 2].map(j => (v[a * 3 + j] + v[b * 3 + j] + v[c * 3 + j]) / 3 - wv[j]), vn = dot(vr, nrm), vt = sub(vr, nrm.map(z => z * vn));
          for (const id of [a, b, c]) {
            if (!w[id]) continue;
            /* the push from the air is spread over the triangle's corners, and never more than stops the motion through it */
            const dvn = Math.min(Math.abs(vn), air.normal * area * vn * vn * w[id] / 3 * h) * Math.sign(vn), dvt = Math.min(1, air.tangent * area * w[id] / 3 * h * len(vt));
            for (let j = 0; j < 3; j++) v[id * 3 + j] -= nrm[j] * dvn + vt[j] * dvt;
          }
        }
        const dk = Math.exp(-damp * h);
        for (let i = 0; i < n; i++) {
          if (!w[i]) continue;
          let sp = 0; for (let c = 0; c < 3; c++) { v[i * 3 + c] *= dk; sp += v[i * 3 + c] ** 2; }
          sp = Math.sqrt(sp); if (sp > maxV) for (let c = 0; c < 3; c++) v[i * 3 + c] *= maxV / sp;
        }
        for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { xp[i * 3 + c] = x[i * 3 + c]; x[i * 3 + c] = w[i] ? x[i * 3 + c] + v[i * 3 + c] * h : tg[i * 3 + c]; }
        for (const l of links) l.lambda = 0;
        /* the pull toward the animated pose (per 60 Hz step, made the same at any substep count) */
        for (let i = 0; i < n; i++) {
          if (!w[i]) continue; const f = P[i].follow || 0; if (!f) continue;
          const a = 1 - Math.pow(1 - f, h * 60);
          for (let c = 0; c < 3; c++) x[i * 3 + c] += (tg[i * 3 + c] - x[i * 3 + c]) * a;
        }
        for (let it = 0; it < iters; it++) solve(h, cols);
        for (let i = 0; i < n * 3; i++) v[i] = (x[i] - xp[i]) / h;
        friction(cols, h);
      }
      emit(); return st;
    }

    function solve(h, cols) {
      /* links: XPBD distance constraints with a slack band (min, max as fractions of the rest length) */
      for (const l of links) {
        const a = l.a, b = l.b, wa = w[a], wb = w[b], ws = wa + wb; if (!ws) continue;
        const d = sub(P3(x, b), P3(x, a)), L = len(d); if (L < 1e-9) continue;
        const lo = l.rest * (l.min === undefined ? 1 : l.min), hi = l.rest * (l.max === undefined ? 1 : l.max);
        const C = L < lo ? L - lo : L > hi ? L - hi : 0; if (!C && !l.lambda) continue;
        const al = (l.compliance || 0) / (h * h), dl = (-C - al * l.lambda) / (ws + al); l.lambda += dl;
        for (let c = 0; c < 3; c++) { const g2 = d[c] / L * dl; x[a * 3 + c] -= g2 * wa; x[b * 3 + c] += g2 * wb; }
      }
      for (let i = 0; i < n; i++) {
        if (!w[i]) continue; const p = P[i];
        /* the cone: the segment from its parent may lean away from the animated direction by at most p.cone degrees */
        if (p.parent >= 0 && p.cone) {
          const q = p.parent, d = sub(P3(x, i), P3(x, q)), a = norm(sub(P3(tg, i), P3(tg, q))), L = len(d), dn = d.map(z => z / (L || 1));
          const cosv = dot(dn, a), lim = Math.cos(p.cone * Math.PI / 180);
          if (cosv < lim) {
            const perp = norm(sub(dn, a.map(z => z * cosv))), sn = Math.sqrt(1 - lim * lim), nd = [0, 1, 2].map(c => (a[c] * lim + perp[c] * sn) * L);
            for (let c = 0; c < 3; c++) x[i * 3 + c] = x[q * 3 + c] + nd[c];
          }
        }
        /* never further than maxDev from where the animation puts it */
        if (p.maxDev) {
          const d = sub(P3(x, i), P3(tg, i)), L = len(d);
          if (L > p.maxDev) for (let c = 0; c < 3; c++) x[i * 3 + c] = tg[i * 3 + c] + d[c] * p.maxDev / L;
        }
      }
      collide(cols);
    }

    const hits = new Uint8Array(n), hitN = new Float64Array(n * 3);
    function collide(cols) {
      hits.fill(0);
      for (let i = 0; i < n; i++) {
        if (!w[i]) continue;
        for (const [a, b, r] of cols) {
          const p = P3(x, i), ab = sub(b, a), tt = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
          const c = [a[0] + ab[0] * tt, a[1] + ab[1] * tt, a[2] + ab[2] * tt], d = sub(p, c), L = len(d), R = r + rad[i];
          if (L >= R) continue;
          /* deep inside (it came through in one substep): push out the side it was on before */
          let nrm = L > R * 0.35 ? d.map(z => z / L) : null;
          if (!nrm) { const pp = P3(xp, i), dp = sub(pp, c), lp = len(dp); nrm = lp > 1e-6 ? dp.map(z => z / lp) : norm(sub(P3(tg, i), c)); }
          for (let k = 0; k < 3; k++) x[i * 3 + k] = c[k] + nrm[k] * R;
          hits[i] = 1; hitN.set(nrm, i * 3); st.contacts++;
        }
        if (opt.floor !== undefined) { const fy = opt.floor / U + rad[i]; if (x[i * 3 + 1] < fy) { x[i * 3 + 1] = fy; hits[i] = 1; hitN.set([0, 1, 0], i * 3); } }
      }
    }
    /* sliding over the body loses some speed along it, and none goes into it */
    function friction() {
      const mu = spec.friction === undefined ? 0.3 : spec.friction;
      for (let i = 0; i < n; i++) {
        if (!hits[i]) continue; const nn = P3(hitN, i), vv = P3(v, i), vn = dot(vv, nn);
        const vt = sub(vv, nn.map(z => z * vn)), k = 1 - mu;
        for (let c = 0; c < 3; c++) v[i * 3 + c] = vt[c] * k + nn[c] * Math.max(0, vn);
      }
    }
    return st;
  }

  /* three.js: run a cape spec on a loaded, skinned model. obj = the model's root (the gltf scene), stepped once per game step.
     The animated pose is read after the mixer has posed the bones; the cape bones are then turned to follow the cloth.
     Same approach as render3d.js's follow-through springs: the turn is put on top of the animated value each frame. */
  function three(THREE, obj, spec, opt) {
    opt = opt || {};
    let mesh = null; obj.traverse(o => { if (!mesh && o.isSkinnedMesh) mesh = o; });
    if (!mesh) return null;
    const sk = mesh.skeleton, byName = {}; sk.bones.forEach((b, i) => { byName[b.name] = i; });
    const local = (bone, p) => { const i = byName[bone]; if (i === undefined) return null;
      return { bone: sk.bones[i], at: new THREE.Vector3(...p).applyMatrix4(mesh.bindMatrix).applyMatrix4(sk.boneInverses[i]) }; };
    const pts = spec.particles.map(p => local(p.bone, p.rest)), cols = spec.colliders.map(c => ({ a: local(c.bone, c.a), b: local(c.bone, c.b), r: c.r })).filter(c => c.a && c.b);
    const bones = spec.bones.map(b => ({ bone: sk.bones[byName[b.name]], head: b.head, tail: b.tail, animQ: null, setQ: null })).filter(b => b.bone);
    if (pts.some(p => !p)) return null;
    const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _qd = new THREE.Quaternion();
    let sim = null, unit = 1;
    const api = {
      sim: () => sim,
      /* step = true once per game step (false re-applies the last result: a paused game, a second render of the same step) */
      update(step, dt) {
        for (const b of bones) { if (b.setQ && b.bone.quaternion.equals(b.setQ)) b.bone.quaternion.copy(b.animQ); else b.animQ = b.bone.quaternion.clone(); }
        obj.updateWorldMatrix(true, true);   /* its parents too: the fighter's root has moved since the last draw */
        unit = _s.setFromMatrixScale(mesh.matrixWorld).x; unit = Math.abs(unit) || 1;
        if (!sim) sim = create(spec, { unit, floor: opt.floor, wind: opt.wind });
        const T = pts.map(p => p.at.clone().applyMatrix4(p.bone.matrixWorld).toArray());
        if (step) sim.step(T, cols.map(c => [c.a.at.clone().applyMatrix4(c.a.bone.matrixWorld).toArray(), c.b.at.clone().applyMatrix4(c.b.bone.matrixWorld).toArray(), c.r * unit]), dt || 1 / 60);
        const X = sim.pos;
        _inv.copy(obj.matrixWorld).invert();
        for (const b of bones) {
          const bn = b.bone; bn.updateMatrixWorld(true);
          const head = new THREE.Vector3().setFromMatrixPosition(bn.matrixWorld), tail = pts[b.tail].at.clone().applyMatrix4(bn.matrixWorld);
          const want = new THREE.Vector3(X[b.tail * 3], X[b.tail * 3 + 1], X[b.tail * 3 + 2]);
          const h = head.clone().applyMatrix4(_inv), a = tail.applyMatrix4(_inv).sub(h).normalize(), t = want.applyMatrix4(_inv).sub(h).normalize();
          if (a.angleTo(t) > 1e-4) {
            _qd.setFromUnitVectors(a, t);
            _m.multiplyMatrices(_inv, bn.matrixWorld).decompose(_v, _q, _s);
            _m.multiplyMatrices(_inv, bn.parent.matrixWorld).decompose(_v, _pq, _s);
            bn.quaternion.copy(_pq.invert().multiply(_qd.multiply(_q)));
          }
          b.setQ = bn.quaternion.clone(); bn.updateMatrixWorld(true);
        }
      },
      reset() { sim = null; },
    };
    return api;
  }

  const CapeSim = { create, three };
  if (typeof module !== 'undefined' && module.exports) module.exports = CapeSim; else root.CapeSim = CapeSim;
})(typeof window !== 'undefined' ? window : globalThis);
