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
window.__game = { get F() { return F; }, get mode() { return mode; }, slots, step, startMatch, keys, draw, perf, DBG };
