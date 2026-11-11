// Animation review helpers, for a tab of the game opened by hand (never loaded by the game itself).
// Paste-load with:  await import('/dev/tools/anim-review.js')  ... or inject as a <script>. Needs tools/record-server.js running.
// It stops the page's own frame loop in that tab and steps frames by hand, so every grab shows exactly the frame asked for.
//   SETUP([pickA, formA], [pickB, formB], xA, xB, pctB)  a fresh training match with both fighters standing still
//   PRESS(frames, fn)                                     a script that presses buttons (fn(i, f, o, k)) for its first frames
//   SHEET(name, total, every, scriptA, scriptB, opt)      runs the scripts, grabbing a close-up every `every` frames, and saves
//                                                         one contact sheet to playtest-results/anim-review/<name>.png
(function () {
  window.requestAnimationFrame = () => 0;
  DBG.boxes = false;
  if (!window._origCpu) { window._origCpu = cpuInput; cpuInput = (f, o, m) => { const s = window.SCRIPT && window.SCRIPT[f.idx]; if (s) { const i = blankIn(); s(i, f, o); return i; } return blankIn(); }; }
  window.SETUP = (a, b, ax, bx, pct) => {
    slots[0] = { dev: 'kb', pick: a[0], ready: true }; slots[1] = { dev: 'kb', pick: b[0], ready: true }; startMatch(); mode = 'play'; countdown = 0; TRAINING = true;
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = a[1] || 0; F[1].fi = b[1] || 0; F[0].x = ax; F[1].x = bx; F[0].face = 1; F[1].face = -1; F[1].pct = pct || 0; PROJ.length = 0; window.SCRIPT = [null, null];
    for (let k = 0; k < 30; k++) { step(); tick++; }
  };
  window.PRESS = (frames, set) => { let k = 0; return (i, f, o) => { if (k < frames) set(i, f, o, k); k++; }; };
  window.SEQ = (...parts) => { let k = 0; return (i, f, o) => { let t = k; for (const [n, fn] of parts) { if (t < n) { fn(i, f, o, t); break; } t -= n; } k++; }; };
  const glc = document.getElementById('gl'), hud = document.getElementById('c');
  const cell = (cx, cy, s) => { cam.x = cx; cam.y = cy; cam.s = s; draw(); const W0 = glc.width, H0 = glc.height, sw = W0 * 0.34, sh = H0 * 0.52, c = document.createElement('canvas'); c.width = 320; c.height = 300; const g0 = c.getContext('2d'); g0.drawImage(glc, (W0 - sw) / 2, H0 * 0.18, sw, sh, 0, 0, 320, 300); if (window.BOXES) { const kx = hud.width / W0, ky = hud.height / H0; g0.drawImage(hud, (W0 - sw) / 2 * kx, H0 * 0.18 * ky, sw * kx, sh * ky, 0, 0, 320, 300); } return c; };   /* BOXES = true lays the 2D layer (hitboxes and hurtboxes, with DBG.boxes on) over each grab */
  window.SHEET = async (name, total, every, s0, s1, opt) => {
    opt = opt || {}; window.SCRIPT = [s0 || null, s1 || null]; const cells = [], labels = [], who = opt.who || 0;
    for (let k = 0; k < total; k++) {
      step(); tick++;
      if ((k + 1) % every === 0) { const f = F[who], mid = opt.mid ? [(F[0].x + F[1].x) / 2, (F[0].y + F[1].y) / 2] : [f.x, f.y]; cells.push(cell(mid[0] + (opt.dx || 0), mid[1] + (opt.dy === undefined ? 7 : opt.dy), opt.s || 8));
        labels.push((k + 1) + ' ' + f.state + (f.state === 'attack' ? ':' + f.mname + ' f' + f.mf : '') + (f.hitlag ? ' hl' + f.hitlag : '') + '  ' + ((R3.anim && R3.anim[who]) || '')); }
    }
    const cols = Math.min(opt.cols || 6, cells.length), rows = Math.ceil(cells.length / cols), out = document.createElement('canvas'); out.width = cols * 320; out.height = rows * 300;
    const g2 = out.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, out.width, out.height);
    cells.forEach((c, i) => { const x = (i % cols) * 320, y = Math.floor(i / cols) * 300; g2.drawImage(c, x, y); g2.fillStyle = 'rgba(0,0,0,.65)'; g2.fillRect(x, y, 320, 18); g2.fillStyle = '#fff'; g2.font = '12px sans-serif'; g2.fillText(labels[i], x + 4, y + 13); g2.strokeStyle = '#333'; g2.strokeRect(x, y, 320, 300); });
    const r = await fetch('http://127.0.0.1:8319/png?clip=' + name + '&dir=anim-review', { method: 'POST', body: out.toDataURL('image/png') }); return await r.text();
  };
  /* ATLAS(name, [pick, form]): one grab per attack at the middle of its active frames, with the hitboxes and the body's box
     laid over it (sets BOXES). Nothing is simulated: the fighter is put straight into each move, as tools/audit.js does. */
  window.ATLAS = async (name, a, opt) => {
    opt = opt || {}; window.BOXES = true; DBG.boxes = true; SETUP(a, [0, 0], 0, 90, 0); const f = F[0], cells = [], labels = [];
    for (let k = 0; k < 20; k++) { tick++; draw(); }
    for (const [mn, mv] of Object.entries(f.form.moves)) {
      if (mn === 'throws' || !mv || !Array.isArray(mv.h) || !mv.h.length || mv.swap) continue;
      const a0 = Math.min(...mv.h.map(h => h.f0)), a1 = Math.max(...mv.h.map(h => h.f1));
      for (const fr of (opt.all ? [a0, Math.round((a0 + a1) / 2), a1] : [Math.round((a0 + a1) / 2)])) {
        f.x = 0; f.vx = f.vy = 0; f.face = 1; f.hitlag = 0; if (mv.air) { f.y = 30; f.grounded = false; f.plat = null; } else { f.y = 0; f.grounded = true; f.plat = MAIN; }
        f.state = 'attack'; f.mname = mn; f.move = mv; f.mf = fr; f.sf = fr; f.charge = 0; draw(); tick += 6;
        cells.push(cell(f.x + (opt.dx || 0), f.y + (opt.dy === undefined ? 7 : opt.dy), opt.s || 8)); labels.push(mn + ' f' + fr + '  ' + ((R3.anim && R3.anim[0]) || ''));
      }
    }
    const cols = Math.min(opt.cols || 8, cells.length), rows = Math.ceil(cells.length / cols), out = document.createElement('canvas'); out.width = cols * 320; out.height = rows * 300;
    const g2 = out.getContext('2d'); cells.forEach((c, i) => { const x = (i % cols) * 320, y = Math.floor(i / cols) * 300; g2.drawImage(c, x, y); g2.fillStyle = 'rgba(0,0,0,.65)'; g2.fillRect(x, y, 320, 18); g2.fillStyle = '#fff'; g2.font = '12px sans-serif'; g2.fillText(labels[i], x + 4, y + 13); });
    const r = await fetch('http://127.0.0.1:8319/png?clip=' + name + '&dir=anim-review', { method: 'POST', body: out.toDataURL('image/png') }); return await r.text();
  };
})();
