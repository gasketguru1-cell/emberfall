'use strict';
/* Hitbox audit, run inside the real game: for every attack of every fighter it puts the fighter into that attack, has the
   3D renderer pose the model exactly as it does in play, and measures how far each hitbox is from the nearest striking
   limb at the first, middle and last active frame, facing right and then left. Follow-through (tails, ribbons) is switched off while measuring so the
   result is the animation's own pose.

   To run: open the game in 3D, then in the browser console:
     const s = document.createElement('script'); s.src = 'tools/audit.js'; document.body.append(s);
     await auditHitboxes()          // returns { rows, flagged } and prints a table; reload the page afterwards
   'off' is the distance from the hitbox's centre to the nearest limb tip at the best of those frames; 'gap' is how far that
   tip is outside the hitbox's edge (0 = inside). An 'off' over about 3 units deserves a look. Moves a fighter cannot reach
   (later jabs of a shorter jab chain) are skipped. */
async function auditHitboxes(limit) {
  limit = limit || 3;
  const man = await (await fetch('assets/manifest.json')).json(), R = window.R3;
  if (!R || !R.ready) throw new Error('3D renderer is not ready');
  DBG.step = true; DBG.advance = 0; DBG.r3d = true;
  const forms = window.AUDIT_FORMS || [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [6, 0]], rows = [], r1 = v => Math.round(v * 10) / 10;
  const wp = new (R.fighters[0].root.position.constructor)(), wq = wp.clone();
  for (const A of forms) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    const f = F[0], o = F[1]; f.fi = A[1]; o.x = 60; f.x = 0; f.face = 1; f.invuln = 0;
    const cfg = man[f.form.name], v = R.fighters[0];
    for (let k = 0; k < 14; k++) { tick++; draw(); }   /* let the model load in and turn to face right */
    if (!v.model) { rows.push({ fighter: f.form.name, move: '(no model loaded)' }); continue; }
    v.springs = [];
    const strikers = (cfg.strikers || []).map(s => ({ ...s, node: v.obj.getObjectByName(s.bone) })).filter(s => s.node);
    const tips = () => { v.root.updateWorldMatrix(true, true); return strikers.map(s => {
      s.node.getWorldPosition(wp); s.node.parent.getWorldPosition(wq); const dx = wp.x - wq.x, dy = wp.y - wq.y, dz = wp.z - wq.z, len = Math.hypot(dx, dy, dz) || 1, e = s.ext || 0;
      return { bone: s.bone, x: wp.x + dx / len * e - f.x, y: wp.y + dy / len * e - (s.drop || 0) * 0.5 - f.y }; }); };
    for (const face of [1, -1]) { f.face = face; for (let k = 0; k < 16; k++) { tick++; draw(); }   /* both facings: let the model finish turning first */
    for (const [name, mv] of Object.entries(f.form.moves)) {
      if (name === 'throws' || !mv || !Array.isArray(mv.h) || !mv.h.length || mv.swap) continue;
      const M = f.form.moves; if ((name === 'jab2' && M.jab.next !== 'jab2') || (name === 'jab3' && M.jab.next !== 'jab3' && !(M.jab.next === 'jab2' && M.jab2.next === 'jab3'))) continue;
      mv.h.forEach((h, n) => {
        const nx = mv.h[n + 1], inner = nx && nx.f0 === h.f0 && nx.f1 === h.f1 && Math.sign(nx.x) === Math.sign(h.x) && Math.abs(nx.x) > Math.abs(h.x);
        const body = Math.abs(h.x) < f.st.w / 2 + 1 && h.y > 0 && h.y < f.st.h;
        let best = null;
        for (const fr of [h.f0, Math.round((h.f0 + h.f1) / 2), h.f1]) {
          f.x = 0; f.vx = f.vy = 0; f.face = face; f.hitlag = 0;
          if (mv.air) { f.y = 40; f.grounded = false; f.plat = null; } else { f.y = 0; f.grounded = true; f.plat = MAIN; }
          f.state = 'attack'; f.mname = name; f.move = mv; f.mf = fr; f.sf = fr; f.charge = 0;
          draw(); tick += 6; draw();   /* second draw is past the cross-fade */
          for (const t of tips()) { const off = Math.hypot(t.x - h.x * face, t.y - h.y); if (!best || off < best.off) best = { off, gap: Math.max(0, off - h.r), bone: t.bone, at: fr, x: t.x, y: t.y }; }
        }
        rows.push({ fighter: f.form.name, facing: face > 0 ? 'right' : 'left', move: name + (mv.h.length > 1 ? ' #' + (n + 1) : ''), hitbox: r1(h.x * face) + ',' + r1(h.y) + ' r' + r1(h.r), off: best ? r1(best.off) : null, gap: best ? r1(best.gap) : null,
          nearest: best ? best.bone + ' at ' + r1(best.x) + ',' + r1(best.y) + ' (frame ' + best.at + ')' : 'no strikers listed', note: body ? 'body burst' : inner ? 'inner part' : h.grab ? 'grab' : '' });
      });
    }
    }
  }
  const flagged = rows.filter(r => r.off !== null && r.off > limit && r.note !== 'body burst' && r.note !== 'inner part');
  console.table(rows); window.AUDIT = { rows, flagged };
  return window.AUDIT;
}

/* Hurtbox audit: stands every fighter in its idle pose and compares the body's hittable box (hurtRect in sim.js) with the
   model's own outline as drawn: its width and height in game units, measured from the skinned mesh on screen.
     await auditHurtboxes()   returns rows { fighter, box 'w x h', model 'w x h', dw, dh }; reload the page afterwards */
async function auditHurtboxes() {
  const R = window.R3; if (!R || !R.ready) throw new Error('3D renderer is not ready');
  DBG.step = true; DBG.advance = 0; DBG.r3d = true;
  const forms = window.AUDIT_FORMS || [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [6, 0]], rows = [], r1 = v => Math.round(v * 10) / 10;
  for (const A of forms) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    const f = F[0]; f.fi = A[1]; F[1].x = 60; f.x = 0; f.y = 0; f.face = 1; f.grounded = true; f.plat = MAIN; f.state = 'idle'; f.vx = f.vy = 0;
    const v = R.fighters[0]; for (let k = 0; k < 40; k++) { tick++; draw(); }
    if (!v.model) { rows.push({ fighter: f.form.name, box: '(no model)' }); continue; }
    v.springs = []; draw(); v.root.updateWorldMatrix(true, true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const p = new (v.root.position.constructor)();
    v.obj.traverse(m => { if (!m.isSkinnedMesh) return; const pos = m.geometry.attributes.position, stepN = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += stepN) { p.fromBufferAttribute(pos, i); m.applyBoneTransform(i, p); p.applyMatrix4(m.matrixWorld); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } });
    const hr = hurtRect(f), bw = hr[2] - hr[0], bh = hr[3] - hr[1];
    rows.push({ fighter: f.form.name, box: r1(bw) + ' x ' + r1(bh), model: r1(x1 - x0) + ' x ' + r1(y1 - y0), feet: r1(y0 - f.y), dw: r1(bw - (x1 - x0)), dh: r1(bh - (y1 - y0)) });
  }
  console.table(rows); window.HURT = rows; return rows;
}
