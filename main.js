'use strict';
/* ---------- Loop: fixed 60 steps per second ---------- */
let last = performance.now(), acc = 0;
const PERF = { dt: new Float32Array(600), n: 0 };
function perf() {
  const n = Math.min(PERF.n, 600); let sum = 0, worst = 0, slow = 0;
  for (let k = 0; k < n; k++) { const d = PERF.dt[k]; sum += d; if (d > worst) worst = d; if (d > 18.5) slow++; }
  return { frames: n, avgMs: n ? +(sum / n).toFixed(2) : 0, worstMs: +worst.toFixed(1), slowFrames: slow };
}
function loop(now) {
  const d = now - last; PERF.dt[PERF.n++ % 600] = d; acc += Math.min(100, d); last = now;
  while (acc >= 1000 / 60) {
    if (!DBG.step || mode === 'select') step(); else if (DBG.advance > 0) { DBG.advance--; step(); }
    acc -= 1000 / 60;
  }
  draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
/* ---------- Is a newer finished version waiting? ----------
   The server hands out the last finished version of the game, so it can be played while it is being worked on. This asks
   every few seconds whether a newer one exists; the menus then say so. Nothing ever reloads by itself. */
let UPDATE_READY = false;
(function () {
  if (typeof fetch !== 'function') return; let mine = null, timer = 0;
  const ask = () => fetch('/__version', { cache: 'no-store' }).then(r => { if (!r.ok) { clearInterval(timer); return null; } return r.text(); })   /* an older server has no such page: stop asking */
    .then(v => { if (!v || v.length > 20) return; if (mine === null) mine = v; else if (v !== mine) UPDATE_READY = true; }).catch(() => {});
  ask(); timer = setInterval(ask, 5000);
})();
/* ---------- Mouse (or a finger) on the fighter select: drag the CPU's token ---------- */
let MOUSE = null;
(function () {
  const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  addEventListener('pointerdown', e => { const p = at(e); MOUSE = p; if (CMENU) { cmenuClick(p.x, p.y); e.preventDefault(); return; } if (cpuGrab(p.x, p.y)) { e.preventDefault(); try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } } });
  addEventListener('pointermove', e => { const p = at(e); MOUSE = p; cpuDrag(p.x, p.y); document.body.style.cursor = CPU_TOK.drag ? 'grabbing' : cpuTokOn(p.x, p.y) ? 'grab' : ''; });
  addEventListener('pointerup', e => { const p = at(e); cpuDrop(p.x, p.y); document.body.style.cursor = cpuTokOn(p.x, p.y) ? 'grab' : ''; });
  addEventListener('pointercancel', () => { if (CPU_TOK.drag) { CPU_TOK.drag = false; cpuTokHome(); } });
})();
window.__game = { get F() { return F; }, get mode() { return mode; }, slots, step, startMatch, keys, draw, perf, DBG, cam };
