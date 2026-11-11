// Records a combo-lab route from the running game in the browser, as a WebM video. Every frame the game is stepped and drawn
// exactly as in play (3D scene, then the 2D layer with the HUD and the training-mode combo counter); every second frame both layers
// are copied into one 1280x720 picture and encoded with the browser's own VP8 encoder, timed by frame number (30 per second), so
// the video plays at true game speed however long the recording took. The WebM container is written here (a few EBML elements)
// and the file is sent to tools/record-server.js, which saves it. A testing tool only: load it into a tab by hand.
(function () {
  const REC = window.REC = {};
  /* ---- a minimal WebM (Matroska) writer ---- */
  const enc = new TextEncoder();
  const cat = parts => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
  const idB = id => { const b = []; let v = id; while (v > 0) { b.unshift(v & 255); v = Math.floor(v / 256); } return new Uint8Array(b); };
  const size8 = n => { const b = new Uint8Array(8); b[0] = 1; let v = n; for (let i = 7; i >= 1; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b; };
  const el = (id, data) => cat([idB(id), size8(data.length), data]);
  const uint = v => { const b = []; do { b.unshift(v % 256); v = Math.floor(v / 256); } while (v > 0); return new Uint8Array(b); };
  const f64 = v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
  const str = s => enc.encode(s);
  function webm(chunks, w, h, durMs) {
    const header = el(0x1A45DFA3, cat([el(0x4286, uint(1)), el(0x42F7, uint(1)), el(0x42F2, uint(4)), el(0x42F3, uint(8)), el(0x4282, str('webm')), el(0x4287, uint(2)), el(0x4285, uint(2))]));
    const info = el(0x1549A966, cat([el(0x2AD7B1, uint(1000000)), el(0x4D80, str('Emberfall recorder')), el(0x5741, str('Emberfall recorder')), el(0x4489, f64(durMs))]));
    const tracks = el(0x1654AE6B, el(0xAE, cat([el(0xD7, uint(1)), el(0x73C5, uint(1)), el(0x83, uint(1)), el(0x86, str('V_VP8')), el(0xE0, cat([el(0xB0, uint(w)), el(0xBA, uint(h))]))])));
    const clusters = []; let i = 0;
    while (i < chunks.length) {
      const t0 = chunks[i].ms, blocks = [el(0xE7, uint(t0))];
      do { const c = chunks[i], rel = c.ms - t0, head = new Uint8Array([0x81, (rel >> 8) & 255, rel & 255, c.key ? 0x80 : 0]); blocks.push(el(0xA3, cat([head, c.data]))); i++; } while (i < chunks.length && !chunks[i].key && chunks[i].ms - t0 < 30000);
      clusters.push(el(0x1F43B675, cat(blocks)));
    }
    return cat([header, el(0x18538067, cat([info, tracks].concat(clusters)))]);
  }
  /* ---- record one route ---- */
  REC.clip = async function (name, dir, route, sit) {
    DBG.boxes = false;   /* hitboxes hidden; the page's own loop cannot run while this works, as it never yields */
    const W2 = 1280, H2 = 720, comp = document.createElement('canvas'); comp.width = W2; comp.height = H2; const cg = comp.getContext('2d');
    const glc = document.getElementById('gl'), hud = document.getElementById('c'), chunks = []; let err = null, n = 0;
    const ve = new VideoEncoder({ output: (c) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); chunks.push({ ms: Math.round(c.timestamp / 1000), key: c.type === 'key', data: d }); }, error: e => { err = e; } });
    ve.configure({ codec: 'vp8', width: W2, height: H2, bitrate: 7000000, framerate: 30, hardwareAcceleration: 'prefer-software' });   /* the software encoder keeps going when the tab is not in front */
    const res = LAB.run(route, Object.assign({ lead: 50, tail: 85, settleCam: 1 }, sit), t => {
      tick++; draw(); if (t % 2) return;
      cg.fillStyle = '#000'; cg.fillRect(0, 0, W2, H2); cg.drawImage(glc, 0, 0, W2, H2); cg.drawImage(hud, 0, 0, W2, H2);
      const vf = new VideoFrame(comp, { timestamp: Math.round(n * 1e6 / 30) }); ve.encode(vf, { keyFrame: n % 10 === 0 }); vf.close(); n++;
    });
    await ve.flush(); ve.close(); if (err) throw err;
    chunks.sort((a, b) => a.ms - b.ms);
    const file = webm(chunks, W2, H2, n * 1000 / 30);
    const r = await fetch('http://127.0.0.1:8319/file?clip=' + name + '&dir=' + dir, { method: 'POST', body: file });
    return { res, frames: n, seconds: +(n / 30).toFixed(1), bytes: file.length, server: await r.text() };
  };
})();
