// Records a Knell route (tools/knell-lab.js tokens) from the running game in a browser tab as a WebM, the same way tools/record.js
// does for combo-lab routes: the game is stepped and drawn as in play (3D scene, HUD, training-mode combo counter), every second
// frame is encoded at 30 fps, and the file goes to tools/record-server.js (/kfile -> playtest-results/knell/<dir>/<name>.webm).
// A testing tool only; load tools/record.js, tools/knell-lab.js and this into a tab by hand:
//   await KREC.clip('name', 'Zero-to-Deaths', 'utilt hu uair ...', { foe: [0, 0], pct: 0, thread: 2 }, { di: 'out' })
// opt (all optional): endpoint ('/kfile' by default; '/file' saves under playtest-results/potato-sack/<dir>), stills: a folder name
// under playtest-results: JPEG stills of the recorded frames are posted there (/png) at the start, at each hit, at a KO and at the end.
(function () {
  const KREC = window.KREC = {};
  KREC.clip = async function (name, dir, route, sit, defender, cap, opt) {
    opt = opt || {}; const stills = []; let hits0 = 0, koSeen = false, koAt = -1;
    DBG.boxes = false;
    const W2 = 1280, H2 = 720, comp = document.createElement('canvas'); comp.width = W2; comp.height = H2; const cg = comp.getContext('2d');
    const glc = document.getElementById('gl'), hud = document.getElementById('c'), chunks = []; let err = null, n = 0;
    const ve = new VideoEncoder({ output: c => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: Math.round(c.timestamp / 1000), key: c.type === 'key', data: d }); }, error: e => { err = e; } });
    ve.configure({ codec: 'vp8', width: W2, height: H2, bitrate: 7000000, framerate: 30, hardwareAcceleration: 'prefer-software' });
    /* the lead-in (both standing still) is recorded too, and the tail after a KO shows the respawn: clips of 5 s at least */
    const o = Object.assign({ lead: 80, tail: 150, settleCam: 1, koTail: 160 }, sit); if (defender) o.def = KLAB.defender(defender);
    let fr = 0;
    const res = KLAB.run(route, o, t => {
      tick++; draw(); if (fr++ % 2) return;
      cg.fillStyle = '#000'; cg.fillRect(0, 0, W2, H2); cg.drawImage(glc, 0, 0, W2, H2); cg.drawImage(hud, 0, 0, W2, H2);
      if (cap) {   /* a caption: the route's name and the defender, top left, so a clip says what it shows */
        cg.font = '600 22px system-ui, sans-serif'; cg.fillStyle = 'rgba(0,0,0,0.55)'; const wd = Math.max(cg.measureText(cap[0]).width, cap[1] ? cg.measureText(cap[1]).width : 0) + 28;
        cg.fillRect(14, 14, wd, cap[1] ? 66 : 38); cg.fillStyle = '#fff'; cg.fillText(cap[0], 28, 41); if (cap[1]) { cg.font = '18px system-ui, sans-serif'; cg.fillStyle = '#ffd166'; cg.fillText(cap[1], 28, 68); }
      }
      if (opt.stills) {   /* the stills: the first recorded frame of the route, each new hit (a few frames on), the KO, the last */
        const h = COMBO[0].hits, ko = F[0].kos > 0; if (ko && !koSeen) { koSeen = true; koAt = t; }
        const want = t === 0 || (h > hits0 && h > 0) || (koAt >= 0 && t === koAt + 10);
        if (h !== hits0) hits0 = h;
        if (want && stills.length < 40) stills.push({ t, sec: +(n / 30).toFixed(2), hits: h, data: comp.toDataURL('image/jpeg', 0.86) });
        KREC.lastFrame = { t, sec: +(n / 30).toFixed(2), hits: h, data: null, comp };
      }
      const vf = new VideoFrame(comp, { timestamp: Math.round(n * 1e6 / 30) }); ve.encode(vf, { keyFrame: n % 10 === 0 }); vf.close(); n++;
    });
    await ve.flush(); ve.close(); if (err) throw err;
    chunks.sort((a, b) => a.ms - b.ms);
    const file = REC.webm(chunks, W2, H2, n * 1000 / 30);
    if (opt.stills) { stills.push({ t: 'end', sec: +(n / 30).toFixed(2), hits: COMBO[0].hits, data: comp.toDataURL('image/jpeg', 0.86) });
      for (let k = 0; k < stills.length; k++) { const s = stills[k]; s.file = name + '_' + String(k).padStart(2, '0');
        await fetch('http://127.0.0.1:8319/png?clip=' + encodeURIComponent(s.file) + '&dir=' + encodeURIComponent(opt.stills), { method: 'POST', body: s.data }); s.data = undefined; } }
    const r = await fetch('http://127.0.0.1:8319' + (opt.endpoint || '/kfile') + '?clip=' + encodeURIComponent(name) + '&dir=' + encodeURIComponent(dir), { method: 'POST', body: file });
    return { res: Object.assign({}, res, { log: undefined }), stills: stills.map(s => ({ file: s.file, t: s.t, sec: s.sec, hits: s.hits })), frames: n, seconds: +(n / 30).toFixed(1), bytes: file.length, server: await r.text() };
  };
})();
