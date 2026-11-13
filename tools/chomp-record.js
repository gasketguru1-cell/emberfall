// Records a Chomp Chomp route (tools/chomp-lab.js tokens) from the running game in a browser tab as a WebM, the same way
// tools/knell-record.js does for Knell: the game is stepped and drawn as in play (3D scene, HUD, training-mode combo counter),
// every second frame is encoded at 30 fps, and the file goes to tools/record-server.js (/cfile -> playtest-results/chomp/<dir>/<name>.webm).
// A testing tool only; load tools/record.js, tools/chomp-lab.js and this into a tab by hand:
//   await CREC.clip('name', 'Zero-to-Deaths', 'ftilt ro_f bite ...', { foe: [0, 0], pct: 0 }, { di: 'out' }, ['caption', 'line 2'])
//   await CREC.scene('name', 'Rope', sit, pre, kf, vf, frames, cap)   a scripted situation: pre(f, v) after setup, then
//     kf(t, f, v, i) and vf(t, v, f, i) fill each frame's input for Chomp and the opponent
(function () {
  const CREC = window.CREC = {};
  CREC.bitrate = 7000000;
  function rec() {
    DBG.boxes = false;
    const W2 = 1280, H2 = 720, comp = document.createElement('canvas'); comp.width = W2; comp.height = H2; const cg = comp.getContext('2d');
    const glc = document.getElementById('gl'), hud = document.getElementById('c'), chunks = []; const r = { err: null, n: 0, fr: 0 };
    const ve = new VideoEncoder({ output: c => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: Math.round(c.timestamp / 1000), key: c.type === 'key', data: d }); }, error: e => { r.err = e; } });
    ve.configure({ codec: 'vp8', width: W2, height: H2, bitrate: CREC.bitrate, framerate: 30, hardwareAcceleration: 'prefer-software' });
    r.frame = cap => {
      tick++; draw(); if (r.fr++ % 2) return;
      cg.fillStyle = '#000'; cg.fillRect(0, 0, W2, H2); cg.drawImage(glc, 0, 0, W2, H2); cg.drawImage(hud, 0, 0, W2, H2);
      if (cap) {   /* a caption, top left, so a clip says what it shows */
        cg.font = '600 22px system-ui, sans-serif'; cg.fillStyle = 'rgba(0,0,0,0.55)'; const wd = Math.max(cg.measureText(cap[0]).width, cap[1] ? cg.measureText(cap[1]).width : 0) + 28;
        cg.fillRect(14, 14, wd, cap[1] ? 66 : 38); cg.fillStyle = '#fff'; cg.fillText(cap[0], 28, 41); if (cap[1]) { cg.font = '18px system-ui, sans-serif'; cg.fillStyle = '#ffd166'; cg.fillText(cap[1], 28, 68); }
      }
      const vf = new VideoFrame(comp, { timestamp: Math.round(r.n * 1e6 / 30) }); ve.encode(vf, { keyFrame: r.n % 10 === 0 }); vf.close(); r.n++;
    };
    r.finish = async (name, dir) => {
      await ve.flush(); ve.close(); if (r.err) throw r.err;
      chunks.sort((a, b) => a.ms - b.ms);
      const file = REC.webm(chunks, W2, H2, r.n * 1000 / 30);
      const q = await fetch('http://127.0.0.1:8319/cfile?clip=' + encodeURIComponent(name) + '&dir=' + encodeURIComponent(dir), { method: 'POST', body: file });
      return { frames: r.n, seconds: +(r.n / 30).toFixed(1), bytes: file.length, server: await q.text() };
    };
    return r;
  }
  CREC._rec = rec;   /* tools/chomp-replay.js films with it too */
  CREC.clip = async function (name, dir, route, sit, defender, cap) {
    const r = rec();
    const o = Object.assign({ lead: 80, tail: 150, settleCam: 1, koTail: 160 }, sit); if (defender) o.def = defender === 'cpu9' || typeof defender === 'function' ? defender : CLAB.defender(defender);   /* a function: e.g. CLAB.cpuAfterHit() */
    const res = CLAB.run(route, o, () => r.frame(cap));
    return Object.assign({ res: Object.assign({}, res, { log: undefined }) }, await r.finish(name, dir));
  };
  CREC.scene = async function (name, dir, sit, pre, kf, vf, N, cap) {
    const r = rec();
    const [f, v] = CLAB.setup(Object.assign({ settleCam: 1 }, sit)); if (pre) pre(f, v); let T = 0;
    CLAB.kIn = (ff, oo) => { const i = blankIn(); if (kf) kf(T, ff, oo, i); return i; }; CLAB.vIn = vf === 'cpu9' ? 'cpu9' : (vv, aa) => { const i = blankIn(); if (vf) vf(T, vv, aa, i); return i; };
    for (T = 0; T < N; T++) { step(); r.frame(cap); }
    CLAB.kIn = CLAB.vIn = null;
    return await r.finish(name, dir);
  };
})();
