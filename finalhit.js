'use strict';
/* The final-hit screen, as in Ultimate: the hit that ends the match freezes the game (sim.js: finalT, FINAL) with the camera
   punched in on the victim, the stage replaced by a red burst of rays, speed lines and lightning, and a bright arc where
   the blow landed. Then the launch plays out in slow motion.
   finalBg paints the burst (behind the fighters: on the 2D canvas, or as the 3D backdrop's picture); finalFg paints what
   goes over them. Both are pure drawing: nothing here touches the match. */
const FINAL_ROLL = -0.07;   /* the view tilts a little while frozen */
function finalRnd(seed) { let s = Math.imul(seed ^ 0x5bd1e995, 0x9e3779b1) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   /* mulberry32: neighbouring seeds give unrelated patterns */
/* where the victim's middle, and the hit, sit on screen right now */
function finalSpots() {
  const v = F[FINAL.v]; if (!v) return null;
  return { cx: SX(v.x), cy: SY(v.y + v.st.h / 2), hx: SX(FINAL.x), hy: SY(FINAL.y), vh: v.st.h * cam.s, t: FINAL_FREEZE - finalT, col: FINAL.a ? '#6cb4ff' : '#ff7b6c' };
}
function finalBg(c, w, h, s) {
  const R = Math.hypot(w, h), t = s.t;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.scale(c.canvas.width / w, c.canvas.height / h);
  c.translate(w / 2, h / 2); c.rotate(FINAL_ROLL); c.translate(-w / 2, -h / 2);
  let q = c.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, R * 0.75);
  q.addColorStop(0, '#fff8d2'); q.addColorStop(0.07, '#ffd65c'); q.addColorStop(0.18, '#ff8a1e'); q.addColorStop(0.38, '#e8261a'); q.addColorStop(0.68, '#8c0712'); q.addColorStop(1, '#2c0006');
  const m = 0.1 * w;   /* the tilt only needs a little past the edges filled, not nine screens' worth */
  c.fillStyle = q; c.fillRect(-m, -m, w + 2 * m, h + 2 * m);
  /* rays out of the victim: light and dark wedges, turning slowly */
  const rnd = finalRnd(7), n = 72;
  for (let k = 0; k < n; k++) {
    const a = k * Math.PI * 2 / n + rnd() * 0.04 + t * 0.003, wd = 0.012 + rnd() * 0.035, light = k % 2 === 0;
    c.fillStyle = light ? 'rgba(255,214,120,' + (0.14 + rnd() * 0.2).toFixed(2) + ')' : 'rgba(90,0,12,' + (0.12 + rnd() * 0.22).toFixed(2) + ')';
    c.beginPath(); c.moveTo(s.cx, s.cy); c.lineTo(s.cx + Math.cos(a - wd) * R, s.cy + Math.sin(a - wd) * R); c.lineTo(s.cx + Math.cos(a + wd) * R, s.cy + Math.sin(a + wd) * R); c.closePath(); c.fill();
  }
  /* the hot core behind the victim */
  q = c.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, Math.max(80, s.vh * 1.6)); q.addColorStop(0, 'rgba(255,255,235,.95)'); q.addColorStop(0.35, 'rgba(255,220,120,.55)'); q.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = q; c.fillRect(-m, -m, w + 2 * m, h + 2 * m);
  c.restore();
}
function finalBolt(c, rnd, x0, y0, x1, y1) {
  const pts = [[x0, y0]], n = 9;
  for (let k = 1; k < n; k++) { const f = k / n, j = (1 - f) * 38 + 8; pts.push([x0 + (x1 - x0) * f + (rnd() - 0.5) * j * 2, y0 + (y1 - y0) * f + (rnd() - 0.5) * j * 2]); }
  pts.push([x1, y1]);
  /* the glow is wide faint strokes under the bright ones (drawn with 'lighter'): a canvas shadowBlur here cost more than the
     rest of the frame put together, every frame of the freeze */
  c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y));
  for (const [lw, col] of [[30, 'rgba(255,140,20,.10)'], [18, 'rgba(255,160,40,.16)'], [9, 'rgba(255,150,30,.5)'], [3.5, '#fff1a8'], [1.4, '#ffffff']]) { c.lineWidth = lw; c.strokeStyle = col; c.stroke(); }
}
function finalFg(c, w, h, s) {
  const R = Math.hypot(w, h), t = s.t;
  c.save(); c.translate(w / 2, h / 2); c.rotate(FINAL_ROLL); c.translate(-w / 2, -h / 2);
  /* the arc of the blow: a bright crescent swept round the victim, opening the way they are launched */
  { const a = FINAL.ang, r0 = Math.max(46, s.vh * 0.95), grow = Math.min(1, t / 5), sweep = 1.25 * grow, fade = t < 30 ? 1 : Math.max(0, 1 - (t - 30) / 18);
    c.globalAlpha = fade; c.globalCompositeOperation = 'lighter';
    const q = c.createRadialGradient(s.cx, s.cy, r0 * 0.7, s.cx, s.cy, r0 * 1.35); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.45, '#ffffff'); q.addColorStop(0.7, s.col); q.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = q; c.beginPath();
    for (let k = 0; k <= 24; k++) { const f = k / 24, an = a + Math.PI - sweep + f * sweep * 2, rr2 = r0 * (1.3 - 0.1 * Math.abs(f - 0.5)); c.lineTo(s.cx + Math.cos(an) * rr2, s.cy - Math.sin(an) * rr2); }
    for (let k = 24; k >= 0; k--) { const f = k / 24, an = a + Math.PI - sweep + f * sweep * 2, th = Math.sin(f * Math.PI) * 0.32 * r0; c.lineTo(s.cx + Math.cos(an) * (r0 * 1.3 - th), s.cy - Math.sin(an) * (r0 * 1.3 - th)); }
    c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  /* the impact: a white star where the hit landed, shrinking away */
  if (t < 14) { const k = 1 - t / 14, rr3 = (60 + 140 * k) * Math.max(0.6, s.vh / 90);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,240,' + (0.9 * k).toFixed(2) + ')'; c.beginPath();
    for (let j = 0; j < 16; j++) { const an = j * Math.PI / 8 + 0.2, r = j % 2 ? rr3 * 0.22 : rr3; c.lineTo(s.hx + Math.cos(an) * r, s.hy + Math.sin(an) * r); } c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over'; }
  /* speed lines from the edges toward the victim, new every two frames */
  { const rnd = finalRnd(101 + (t >> 1)), r0 = Math.min(w, h) * 0.34;
    for (let k = 0; k < 64; k++) { const a = rnd() * Math.PI * 2, r1 = r0 + rnd() * r0 * 0.9, wd = 0.6 + rnd() * 2.8;
      c.fillStyle = rnd() < 0.7 ? 'rgba(255,255,255,' + (0.35 + rnd() * 0.5).toFixed(2) + ')' : 'rgba(255,220,130,' + (0.4 + rnd() * 0.4).toFixed(2) + ')';
      const ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
      c.beginPath(); c.moveTo(s.cx + ux * r1, s.cy + uy * r1); c.lineTo(s.cx + ux * R + px * wd * 4, s.cy + uy * R + py * wd * 4); c.lineTo(s.cx + ux * R - px * wd * 4, s.cy + uy * R - py * wd * 4); c.closePath(); c.fill(); } }
  /* lightning crackling in from the edges, redrawn every three frames */
  { const rnd = finalRnd(500 + Math.floor(t / 3)), n = 5 + (rnd() * 3 | 0);
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, rA = R * 0.62, rB = Math.min(w, h) * (0.24 + rnd() * 0.14);
      finalBolt(c, rnd, s.cx + Math.cos(a) * rA, s.cy + Math.sin(a) * rA, s.cx + Math.cos(a + (rnd() - 0.5) * 0.5) * rB, s.cy + Math.sin(a + (rnd() - 0.5) * 0.5) * rB); }
    c.globalCompositeOperation = 'source-over'; }
  c.restore();
  /* dark red edges, and the white flash of the first frames */
  const q = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, R * 0.62); q.addColorStop(0, 'rgba(40,0,6,0)'); q.addColorStop(1, 'rgba(40,0,6,.7)');
  c.fillStyle = q; c.fillRect(0, 0, w, h);
  if (t < 5) { c.fillStyle = 'rgba(255,255,255,' + (0.85 * (1 - t / 5)).toFixed(2) + ')'; c.fillRect(0, 0, w, h); }
}
/* the whole frozen picture on the 2D canvas; in 3D the renderer shows the burst and the fighters, and this adds what goes over them */
function drawFinal(three) {
  const s = finalSpots(); if (!s) return false;
  if (three) { g.clearRect(0, 0, W, H); finalFg(g, W, H, s); return true; }
  finalBg(g, W, H, s);
  g.save(); g.translate(W / 2, H / 2); g.rotate(FINAL_ROLL); g.translate(-W / 2, -H / 2);
  drawProj(); for (const f of F) drawFighter(f, false); drawFx(false);
  g.restore();
  finalFg(g, W, H, s);
  return true;
}
