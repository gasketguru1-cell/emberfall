// Records the animation-overhaul demonstration clips from the running game, in a tab opened by hand (never loaded by the game).
// Needs tools/anim-review.js and tools/record.js loaded first, and tools/record-server.js running. The same scripted inputs are
// played on the old build (the playtest link, /) and the new one (/dev/), so each clip has a fair before and after:
//   await ACLIP.all('after')    -> playtest-results/animation-overhaul/after/<clip>.webm
// Every frame is stepped and drawn exactly as in play (3D scene plus HUD); every second frame goes into the video (30 fps).
(function () {
  const A = window.ACLIP = {};
  const W2 = 1280, H2 = 720;
  /* ---- inputs ---- */
  const nothing = () => {};
  const hold = fn => fn, atk = (i, d) => { i.atk = true; Object.assign(i, d || {}); };
  const S = (...p) => SEQ(...p);
  const tap = (n, fn, rest) => [[n, fn], [rest || 0, nothing]];
  const jump = (full) => [full ? 10 : 3, i => { i.jmp = true; }];
  const SACK = 2, FOWL = 5;
  /* a segment: who plays whom, where, at what percent, for how many frames, with which scripts; cam: how close (cam.s) */
  const seg = (a, b, ax, bx, pct, frames, s0, s1, cam) => ({ a, b, ax, bx, pct, frames, s0, s1, cam: cam || 6.5 });
  const X = (...arr) => [].concat(...arr);
  A.CLIPS = {
    'sack-movement': [seg([SACK], [FOWL], -40, 60, 0, 330, S([60, nothing], [45, i => { i.lx = 0.5; }], [50, i => { i.lx = 1; }], [22, i => { i.lx = -1; }], [30, nothing], jump(true), [20, nothing], [30, (i, f) => { if (f.vy < 0) i.ly = -1; }], [80, nothing]))],
    'sack-ground-normals': [seg([SACK], [FOWL], -10, 4, 30, 330, S(...X(tap(1, atk, 11), tap(1, atk, 11), tap(1, atk, 40), tap(1, i => { i.cx = 1; }, 50), tap(1, i => { i.cy = 1; }, 45), tap(1, i => { i.cy = -1; }, 40), [[6, i => { i.lx = -1; }]], [[6, i => { i.lx = 1; i.atk = true; }]], [[60, nothing]])))],
    'sack-smashes': [seg([SACK], [FOWL], -10, 5, 30, 220, S(...X(tap(1, i => { atk(i, { spc: true, lx: 1 }); }, 70), tap(1, i => { atk(i, { spc: true, ly: 1 }); }, 70), tap(1, i => { atk(i, { spc: true, ly: -1 }); }, 70))), null, 6)],
    'sack-aerials': [seg([SACK], [FOWL], -20, 60, 0, 330, S(...X([jump(false)], tap(4, nothing), tap(1, atk, 45), [jump(true)], tap(8, nothing), tap(1, i => atk(i, { lx: 1 }), 55), [jump(true)], tap(8, nothing), tap(1, i => atk(i, { lx: -1 }), 55), [jump(true)], tap(8, nothing), tap(1, i => atk(i, { ly: 1 }), 55), [jump(true)], tap(8, nothing), tap(1, i => atk(i, { ly: -1 }), 60))))],
    'sack-throws': ['f', 'b', 'u', 'd'].map(d => seg([SACK], [FOWL], -10, -2, 60, 80, S([1, i => { i.grb = true; }], [12, nothing], [6, (i, f) => { if (d === 'f') i.lx = f.face; else if (d === 'b') i.lx = -f.face; else if (d === 'u') i.ly = 1; else i.ly = -1; }], [80, nothing]), null, 6)),
    'sack-specials': [seg([SACK], [FOWL], -20, 40, 0, 170, S([100, i => { i.spc = true; }], [70, nothing])), seg([SACK], [FOWL], -20, 40, 0, 80, S([1, i => { i.spc = true; i.ly = 1; }], [80, nothing]), null, 5),
      seg([SACK], [FOWL], -40, 40, 0, 70, S([1, i => { i.spc = true; i.ly = -1; }], [8, i => { i.lx = 1; }], [60, nothing])), seg([SACK], [FOWL], -20, 40, 0, 80, S([1, i => { i.spc = true; i.ly = -1; }], [8, i => { i.ly = 1; }], [70, nothing]), null, 5)],
    'sack-tumble-drop': [seg([SACK, 0, 'plat'], [FOWL], 0, 40, 0, 140, S([20, nothing], [1, i => { i.spc = true; i.ly = -1; }], [40, i => { i.lx = 1; i.ly = -1; }], [80, nothing]), null, 5)],
    'sack-hit-reactions': [seg([FOWL], [SACK], -10, 2, 20, 70, S([1, atk], [70, nothing]), null, 6), seg([FOWL], [SACK], -10, 2, 80, 110, S([1, i => atk(i, { spc: true, lx: 1 })], [110, nothing]), null, 5), seg([FOWL], [SACK], -10, 0, 70, 110, S([1, i => atk(i, { spc: true, ly: 1 })], [110, nothing]), null, 5)],
    'fowl-birds-idle-run': [0, 1, 2, 3, 4].map(fi => seg([FOWL, fi], [SACK], -30, 60, 0, 150, S([70, nothing], [40, i => { i.lx = 1; }], [20, i => { i.lx = -1; }], [30, nothing]), null, 7)),
    'fowl-normals': [seg([FOWL], [SACK], -10, 4, 30, 330, S(...X(tap(1, atk, 7), tap(1, atk, 9), tap(1, atk, 40), tap(1, i => { i.cx = 1; }, 45), tap(1, i => { i.cy = 1; }, 45), tap(1, i => { i.cy = -1; }, 40), tap(1, i => atk(i, { spc: true, lx: 1 }), 80))))],
    'fowl-sling-spin-cyclone': [seg([FOWL], [SACK], -10, 6, 40, 110, S(jump(true), [8, nothing], [1, atk], [100, nothing]), null, 5.5), seg([FOWL], [SACK], -20, 40, 0, 150, S([55, i => { i.spc = true; i.ly = 1; }], [100, i => { i.ly = 0.3; i.lx = 0.3; }]), null, 4.5)],
    'fowl-selector': [seg([FOWL], [SACK], -10, 40, 0, 240, S([3, i => { i.spc = true; }], [20, nothing], [8, i => { i.lx = 1; }], [40, nothing], [3, i => { i.spc = true; }], [20, nothing], [8, i => { i.ly = -1; }], [40, nothing], [3, i => { i.spc = true; }], [20, nothing], [8, i => { i.lx = -1; }], [60, nothing]), null, 7)],
    'fowl-separate-rejoin': [seg([FOWL, 1], [SACK], -30, 60, 0, 330, S([1, i => { i.spc = true; i.lx = 1; }], [20, i => { i.ly = 1; }], [400, (i, f) => { if (!f.sling) return; const d = f.sling.x - f.x; if (Math.abs(d) > 6) i.lx = Math.sign(d); else if (f.state === 'idle' || f.state === 'brake') { i.spc = true; i.ly = -1; } }]), null, 4.5)],
    'fowl-pip-trio': [seg([FOWL, 3], [SACK], -40, 60, 0, 110, S([1, i => { i.spc = true; i.lx = 1; }], [20, i => { i.lx = 1; i.ly = 0.4; }], [100, nothing]), null, 4.5)],
    'fowl-hit-reactions': [seg([SACK], [FOWL], -10, 2, 20, 70, S([1, atk], [70, nothing]), null, 6), seg([SACK], [FOWL], -10, 4, 80, 110, S([1, i => atk(i, { spc: true, lx: 1 })], [110, nothing]), null, 5), seg([SACK], [FOWL], -10, 0, 70, 110, S([1, i => atk(i, { spc: true, ly: 1 })], [110, nothing]), null, 5)],
    'ko-respawn': [seg([SACK], [FOWL], -10, 4, 170, 330, S([1, i => atk(i, { spc: true, lx: 1 })], [330, nothing]), null, 3.6)],
  };
  /* ---- the recorder ---- */
  function setup(s) {
    SETUP([s.a[0], s.a[1] || 0], [s.b[0], s.b[1] || 0], s.ax, s.bx, s.pct);
    if (s.a[2] === 'plat') { const q = PLATS[1], f = F[0]; f.x = (q.x0 + q.x1) / 2; f.y = q.y; f.plat = q; f.grounded = true; }
  }
  A.record = async (name, dir) => {
    const comp = document.createElement('canvas'); comp.width = W2; comp.height = H2; const cg = comp.getContext('2d');
    const glc = document.getElementById('gl'), hud = document.getElementById('c'), chunks = []; let err = null, n = 0;
    const ve = new VideoEncoder({ output: c => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: Math.round(c.timestamp / 1000), key: c.type === 'key', data: d }); }, error: e => { err = e; } });
    ve.configure({ codec: 'vp8', width: W2, height: H2, bitrate: 6000000, framerate: 30, hardwareAcceleration: 'prefer-software' });
    let cx = null, cy = 0, cs = 6;
    for (const s of A.CLIPS[name]) {
      setup(s); window.SCRIPT = [s.s0 || null, s.s1 || null];
      for (let k = 0; k < s.frames + 20; k++) {
        if (k >= 20) step(); tick++;   /* 20 still frames first, so each segment opens on a clear pose */
        const f = F[0], o = F[1], mx = (f.x + o.x) / 2, near = Math.abs(f.x - o.x) < 50, tx = near ? mx : f.x, ty = (near ? (f.y + o.y) / 2 : f.y) + 9;
        if (cx === null || k === 0) { cx = tx; cy = ty; cs = s.cam; } cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12; cs += (s.cam - cs) * 0.1;
        cam.x = cx; cam.y = cy; cam.s = cs; draw();
        if (k % 2) continue;
        cg.fillStyle = '#000'; cg.fillRect(0, 0, W2, H2); cg.drawImage(glc, 0, 0, W2, H2); cg.drawImage(hud, 0, 0, W2, H2);
        const vf = new VideoFrame(comp, { timestamp: Math.round(n * 1e6 / 30) }); ve.encode(vf, { keyFrame: n % 10 === 0 }); vf.close(); n++;
        if (n % 30 === 0) await new Promise(r => setTimeout(r, 0));   /* let the encoder drain */
      }
    }
    await ve.flush(); ve.close(); if (err) throw err;
    chunks.sort((a, b) => a.ms - b.ms);
    const file = REC.webm(chunks, W2, H2, n * 1000 / 30);
    const r = await fetch('http://127.0.0.1:8319/afile?clip=' + name + '&dir=' + dir, { method: 'POST', body: file });
    return name + ': ' + (n / 30).toFixed(1) + ' s, ' + (await r.text());
  };
  A.all = async (dir, only) => { const out = []; for (const name of only || Object.keys(A.CLIPS)) { try { out.push(await A.record(name, dir)); } catch (e) { out.push(name + ': FAILED ' + e.message); } } return out; };
})();
