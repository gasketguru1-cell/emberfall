// Records a Furious Fowls lab route (tools/fowls-lab.js) from the running game in the browser, as a WebM: each frame is stepped
// and drawn as in play (3D scene, then the HUD with damage and the training-mode combo counter), every second frame is encoded
// (30 per second, timed by frame number so it plays at true game speed), with a caption strip naming the route and defender.
// Uses the WebM writer in tools/record.js; saves through tools/fowls-rec-server.js. A testing tool only: load it into a tab by hand.
(function () {
  const FREC = window.FREC = {};
  FREC.clip = async function (name, dir, route, sit, caption) {
    DBG.boxes = false;
    const W2 = 1280, H2 = 720, comp = document.createElement('canvas'); comp.width = W2; comp.height = H2; const cg = comp.getContext('2d');
    const glc = document.getElementById('gl'), hud = document.getElementById('c'), chunks = []; let err = null, n = 0;
    const ve = new VideoEncoder({ output: c => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: Math.round(c.timestamp / 1000), key: c.type === 'key', data: d }); }, error: e => { err = e; } });
    ve.configure({ codec: 'vp8', width: W2, height: H2, bitrate: 7000000, framerate: 30, hardwareAcceleration: 'prefer-software' });
    const d = sit.def || {}, dtxt = 'defender: DI ' + (d.di || 'none') + ', SDI ' + (d.sdi || 'none') + ', escape ' + (d.esc || 'none');
    const res = FL.run(route, Object.assign({ lead: 50, tail: 85, settleCam: 1 }, sit), t => {
      tick++; draw(); if (t % 2) return;
      cg.fillStyle = '#000'; cg.fillRect(0, 0, W2, H2); cg.drawImage(glc, 0, 0, W2, H2); cg.drawImage(hud, 0, 0, W2, H2);
      cg.fillStyle = 'rgba(0,0,0,0.62)'; cg.fillRect(0, H2 - 54, W2, 54); cg.fillStyle = '#fff'; cg.font = '600 19px sans-serif'; cg.textBaseline = 'middle';
      cg.fillText(caption || route.join(' > '), 14, H2 - 38, W2 - 28); cg.font = '15px sans-serif'; cg.fillStyle = '#cfd6e0'; cg.fillText(dtxt + '   |   frame ' + t, 14, H2 - 15, W2 - 28);
      const vf = new VideoFrame(comp, { timestamp: Math.round(n * 1e6 / 30) }); ve.encode(vf, { keyFrame: n % 10 === 0 }); vf.close(); n++;
    });
    await ve.flush(); ve.close(); if (err) throw err;
    chunks.sort((a, b) => a.ms - b.ms);
    const file = REC.webm(chunks, W2, H2, n * 1000 / 30);
    const r = await fetch('http://127.0.0.1:8321/file?clip=' + name + '&dir=' + dir, { method: 'POST', body: file });
    const meta = { name, dir, route, sit, caption, hits: res.hits, dmg: res.dmg, ko: res.ko, chainKO: res.chainKO, startPct: res.startPct, endPct: res.endPct, seconds: +(n / 30).toFixed(1) };
    await fetch('http://127.0.0.1:8321/json?clip=' + name + '&dir=' + dir, { method: 'POST', body: JSON.stringify(meta, null, 1) });
    return Object.assign(meta, { server: await r.text() });
  };
})();
