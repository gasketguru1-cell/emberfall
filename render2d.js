'use strict';
/* Emberfall 2D renderer: the canvas, world drawing and the debug box view. */
const cv = document.getElementById('c'), g = cv.getContext('2d');
/* ---------- Drawing ---------- */
const SX = x => W / 2 + (x - cam.x) * cam.s, SY = y => H * 0.52 - (y - cam.y) * cam.s;
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/* The canvas is drawn at the screen's real pixel size; everything is laid out in 1280x720 units and scaled. */
let RS = 1;
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), w = Math.round((cv.clientWidth || W) * dpr), h = Math.round((cv.clientHeight || H) * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  RS = w / W;
}
const OL = '#17121f';
function tint(hex, k) { const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
function vgrad(hex, y0, y1) { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, tint(hex, -0.3)); q.addColorStop(1, tint(hex, 0.22)); return q; }
function ink(fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 0.42; g.strokeStyle = OL; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function limb(x0, y0, x1, y1, w, col) { g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = OL; g.lineWidth = w + 0.8; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
const gait = f => f && f.grounded && Math.abs(f.vx) > 0.3 ? Math.sin(f.x * 0.55) : 0;
const swing = f => f && f.state === 'attack' && f.move && !f.move.swap ? Math.sin(Math.min(1, f.mf / f.move.t) * Math.PI) : 0;

function drawBg() {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1230'); gr.addColorStop(0.4, '#2c2356'); gr.addColorStop(0.72, '#8a4a6e'); gr.addColorStop(1, '#f0a063'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    const x = ((k * 197.3 - cam.x * 0.3) % W + W) % W, y = (k * 89.7) % (H * 0.55), tw = 0.45 + 0.4 * Math.sin(frame * 0.03 + k * 1.7);
    g.fillStyle = 'rgba(255,250,235,' + tw.toFixed(2) + ')'; g.beginPath(); g.arc(x, y, k % 7 === 0 ? 1.6 : 0.9, 0, TAU); g.fill();
  }
  const mx = W * 0.78 - cam.x * 0.4, my = 128 + cam.y * 0.2, mg = g.createRadialGradient(mx, my, 0, mx, my, 150);
  mg.addColorStop(0, 'rgba(255,236,190,.5)'); mg.addColorStop(0.25, 'rgba(255,220,170,.16)'); mg.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 150, 0, TAU); g.fill();
  g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(mx, my, 34, 0, TAU); g.fill(); g.fillStyle = 'rgba(214,190,160,.5)'; g.beginPath(); g.arc(mx - 10, my - 6, 7, 0, TAU); g.arc(mx + 12, my + 10, 4.5, 0, TAU); g.fill();
  const cols = [['#5b3f73', '#3d2c5a'], ['#3a2a58', '#261d42'], ['#231a3c', '#120e22']];
  for (let L = 0; L < 3; L++) {
    const base = H * (0.6 + L * 0.1) - cam.y * (0.3 + L * 0.25), hg = g.createLinearGradient(0, base - 70, 0, H); hg.addColorStop(0, cols[L][0]); hg.addColorStop(1, cols[L][1]);
    g.fillStyle = hg; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) { const wx = x + cam.x * (1 + L) * 1.2; g.lineTo(x, base + Math.sin(wx * 0.006 + L * 2) * 40 + Math.sin(wx * 0.017 + L) * 14 + Math.sin(wx * 0.045 + L * 5) * 4); }
    g.lineTo(W, H); g.fill();
    const fg = g.createLinearGradient(0, base + 10, 0, base + 110); fg.addColorStop(0, 'rgba(255,170,130,0)'); fg.addColorStop(1, 'rgba(255,170,130,' + (0.10 - L * 0.03) + ')'); g.fillStyle = fg; g.fillRect(0, base + 10, W, 100);
  }
}
function lampPost(lx, y, s) {
  g.lineCap = 'round'; g.strokeStyle = OL; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(SX(lx), y); g.lineTo(SX(lx), SY(19)); g.stroke();
  g.strokeStyle = '#4a4058'; g.lineWidth = 0.8 * s; g.stroke();
  g.fillStyle = '#4a4058'; rr(SX(lx) - 1.6 * s, y - 1.2 * s, 3.2 * s, 1.2 * s, 0.4 * s); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.35 * s; g.stroke();
  const gl = g.createRadialGradient(SX(lx), SY(21), 0, SX(lx), SY(21), 15 * s); gl.addColorStop(0, 'rgba(255,205,110,.6)'); gl.addColorStop(0.4, 'rgba(255,205,110,.18)'); gl.addColorStop(1, 'rgba(255,205,110,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(SX(lx), SY(21), 15 * s, 0, TAU); g.fill();
  rr(SX(lx) - 1.5 * s, SY(23), 3 * s, 3.6 * s, 0.5 * s); g.fillStyle = '#ffe2a0'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.4 * s; g.stroke();
  g.fillStyle = '#fffbe6'; g.beginPath(); g.ellipse(SX(lx), SY(21.2), 0.6 * s, (1 + Math.sin(frame * 0.3 + lx) * 0.15) * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#4a4058'; g.beginPath(); g.moveTo(SX(lx) - 2.2 * s, SY(23)); g.lineTo(SX(lx), SY(25.2)); g.lineTo(SX(lx) + 2.2 * s, SY(23)); g.closePath(); g.fill(); g.stroke();
}
function drawStage() {
  const s = cam.s, x0 = SX(-EDGE), x1 = SX(EDGE), y = SY(0), bh = BODY_H * s, K = EDGE / 80;   /* the stage art was drawn for a half-width of 80 */
  g.lineJoin = 'round';
  const rg = g.createLinearGradient(0, y, 0, y + bh); rg.addColorStop(0, '#43374f'); rg.addColorStop(1, '#15111f');
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y + RIM * s); g.lineTo(SX(EDGE - SHOULDER_IN), y + SHOULDER * s); g.lineTo(SX(0), y + bh); g.lineTo(SX(-(EDGE - SHOULDER_IN)), y + SHOULDER * s); g.lineTo(x0, y + RIM * s); g.closePath();   /* the island's outline, the same as its collision */
  g.fillStyle = rg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.5 * s; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.3 * s; g.beginPath();
  for (const q of [[-66, 4, -52, 15], [-34, 4, -24, 22], [6, 4, -4, 21], [30, 4, 42, 20], [64, 4, 55, 13], [-10, 12, -18, 23], [18, 10, 24, 23]]) { g.moveTo(SX(q[0] * K), y + q[1] * s); g.lineTo(SX(q[2] * K), y + q[3] * s); }
  g.stroke();
  const dg = g.createLinearGradient(0, y, 0, y + 3.4 * s); dg.addColorStop(0, '#d2bd9f'); dg.addColorStop(0.3, '#a08b74'); dg.addColorStop(1, '#6a594d');
  rr(x0 - 2 * s, y, (EDGE * 2 + 4) * s, 3.4 * s, 1.2 * s); g.fillStyle = dg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.45 * s; g.stroke();
  g.strokeStyle = 'rgba(40,28,30,.4)'; g.lineWidth = 0.22 * s; g.beginPath(); for (let x = -60; x <= 60; x += 12) { g.moveTo(SX(x), y + 1 * s); g.lineTo(SX(x), y + 3.2 * s); } g.stroke();
  g.fillStyle = 'rgba(255,244,220,.6)'; g.fillRect(x0 - 1 * s, y + 0.25 * s, (EDGE * 2 + 2) * s, 0.32 * s);
  lampPost(-(EDGE - 10), y, s); lampPost(EDGE - 10, y, s);
  for (const p of PLATS) if (p.soft) {
    const px = SX(p.x0), py = SY(p.y), pw = (p.x1 - p.x0) * s, hov = g.createRadialGradient(px + pw / 2, py + 2.4 * s, 0, px + pw / 2, py + 2.4 * s, pw * 0.55);
    hov.addColorStop(0, 'rgba(255,205,110,.22)'); hov.addColorStop(1, 'rgba(255,205,110,0)'); g.fillStyle = hov; g.fillRect(px - pw * 0.1, py, pw * 1.2, 7 * s);
    const pg = g.createLinearGradient(0, py, 0, py + 2 * s); pg.addColorStop(0, '#ecd2a6'); pg.addColorStop(0.35, '#b5946f'); pg.addColorStop(1, '#6f5747');
    rr(px, py, pw, 2 * s, 0.9 * s); g.fillStyle = pg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.4 * s; g.stroke();
    g.fillStyle = 'rgba(255,248,225,.65)'; g.fillRect(px + s, py + 0.22 * s, pw - 2 * s, 0.28 * s);
    g.fillStyle = '#5a4638'; for (const ex of [px + 1.4 * s, px + pw - 1.4 * s]) { g.beginPath(); g.arc(ex, py + 1 * s, 0.38 * s, 0, TAU); g.fill(); }
  }
}
/* Fighter art: drawn in local units, origin at the feet, +x forward, +y up. All four designs are original. */
const ART = {
  Flint(c, t, f) {
    const sw = gait(f) * 1.3, a = swing(f), bob = Math.sin(t * 0.08) * 0.15;
    limb(-1.4, 3.2, -1.4 - sw, 0.6, 1.5, '#2b2433'); limb(1.4, 3.2, 1.4 + sw, 0.6, 1.5, '#2b2433');
    g.beginPath(); g.ellipse(-1.1 - sw, 0.5, 1.5, 0.7, 0, 0, TAU); ink('#4a342a', 0.3); g.beginPath(); g.ellipse(1.7 + sw, 0.5, 1.5, 0.7, 0, 0, TAU); ink('#4a342a', 0.3);
    limb(-1.6, 9 + bob, -3.4 - a, 6 + bob, 1.3, tint(c[0], -0.25));
    g.beginPath(); g.moveTo(-4.2, 2.4); g.quadraticCurveTo(0, 1.4, 4.2, 2.4); g.lineTo(2.7, 10.2 + bob); g.quadraticCurveTo(0, 11, -2.7, 10.2 + bob); g.closePath(); ink(vgrad(c[0], 2, 10.6));
    g.strokeStyle = tint(c[0], -0.45); g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.9, 9.8); g.lineTo(1.3, 2.2); g.stroke();
    g.fillStyle = c[1]; for (const y of [4.5, 6.3, 8.1]) { g.beginPath(); g.arc(1.9, y + bob * 0.5, 0.33, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-2.6, 10 + bob); g.quadraticCurveTo(0, 8.8 + bob, 2.6, 10 + bob); g.lineTo(2.4, 10.9 + bob); g.quadraticCurveTo(0, 9.9 + bob, -2.4, 10.9 + bob); g.closePath(); ink(c[1], 0.3);
    g.beginPath(); g.arc(0.3, 12.1 + bob, 2.5, 0, TAU); ink(c[2]);
    g.fillStyle = OL; g.beginPath(); g.ellipse(1.5, 12.3 + bob, 0.32, 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(230,120,90,.5)'; g.beginPath(); g.arc(2, 11.3 + bob, 0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.1, 13.7 + bob, 4.6, 0.95, 0, 0, TAU); ink(tint(c[0], -0.2));
    g.beginPath(); g.moveTo(-2.3, 13.8 + bob); g.lineTo(-1.9, 16.3 + bob); g.quadraticCurveTo(0, 16.9 + bob, 1.9, 16.3 + bob); g.lineTo(2.3, 13.8 + bob); g.closePath(); ink(vgrad(c[0], 13.8, 16.7));
    g.fillStyle = c[1]; g.fillRect(-2.15, 14.1 + bob, 4.3, 0.6);
    const hx = 4.6 + a * 3, hy = 6.8 + bob + a * 1.5, lz = Math.sin(t * 0.1) * 0.1;
    limb(1.6, 9 + bob, hx, hy, 1.4, c[0]);
    const gl = g.createRadialGradient(hx + 0.3, hy - 2.3, 0, hx + 0.3, hy - 2.3, 5.5); gl.addColorStop(0, 'rgba(255,214,120,.6)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gl; g.beginPath(); g.arc(hx + 0.3, hy - 2.3, 5.5, 0, TAU); g.fill();
    g.strokeStyle = OL; g.lineWidth = 0.3; g.beginPath(); g.arc(hx + 0.3 + lz, hy - 0.9, 0.8, 0, Math.PI); g.stroke();
    g.beginPath(); g.rect(hx - 0.8 + lz, hy - 3.6, 2.2, 2.7); ink('#ffe9a8', 0.35);
    g.fillStyle = '#fff8dc'; g.beginPath(); g.ellipse(hx + 0.3 + lz, hy - 2.4, 0.45, 0.8 + Math.sin(t * 0.4) * 0.15, 0, 0, TAU); g.fill();
    g.beginPath(); g.rect(hx - 1.1 + lz, hy - 1.1, 2.8, 0.5); ink(c[1], 0.25); g.beginPath(); g.rect(hx - 1.1 + lz, hy - 4, 2.8, 0.5); ink(c[1], 0.25);
  },
  Nib(c, t, f) {
    const sw = gait(f), a = swing(f), tw = Math.sin(t * 0.12) * 0.5;
    for (const q of [[-3, 1], [-1.6, -1], [1.6, 1], [3, -1]]) limb(q[0], 2.6, q[0] + sw * q[1] * 1.1, 0.5, 0.9, c[1]);
    g.beginPath(); g.moveTo(-3.6, 4.6); g.quadraticCurveTo(-8.5, 8.5 + tw, -8.6, 4 + tw); g.quadraticCurveTo(-7, 2.2, -3.8, 3.2); g.closePath(); ink(vgrad(c[0], 2, 8));
    g.beginPath(); g.moveTo(-8.6, 4 + tw); g.quadraticCurveTo(-8.9, 6.6 + tw, -7.2, 7 + tw); g.quadraticCurveTo(-7.4, 5, -8.6, 4 + tw); ink(c[2], 0.3);
    g.beginPath(); g.ellipse(0, 4.1, 4.7, 2.7, 0, 0, TAU); ink(vgrad(c[0], 1.4, 6.8));
    g.fillStyle = tint(c[0], 0.4); g.beginPath(); g.ellipse(0.6, 2.9, 3, 1, 0, 0, TAU); g.fill();
    g.strokeStyle = tint(c[0], -0.45); g.lineWidth = 0.25; g.beginPath(); g.moveTo(-1.6, 6.5); g.lineTo(-1.6, 1.7); g.moveTo(1.8, 6.4); g.lineTo(1.8, 1.8); g.stroke();
    g.fillStyle = c[1]; for (const p of [[-1.6, 5.4], [-1.6, 2.8], [1.8, 5.3], [1.8, 2.9]]) { g.beginPath(); g.arc(p[0], p[1], 0.28, 0, TAU); g.fill(); }
    g.save(); g.translate(-0.6, 6.7); limb(0, 0, 0, 1.6, 0.5, c[1]); g.translate(0, 2.5); g.scale(Math.cos(t * 0.15) || 0.05, 1);
    g.beginPath(); g.arc(-0.9, 0, 0.85, 0, TAU); g.moveTo(1.75, 0); g.arc(0.9, 0, 0.85, 0, TAU); g.strokeStyle = OL; g.lineWidth = 0.75; g.stroke(); g.strokeStyle = c[1]; g.lineWidth = 0.35; g.stroke(); g.restore();
    const hx = 4 + a * 1.5, hy = 6.4;
    g.beginPath(); g.moveTo(hx - 1.8, hy + 1.6); g.lineTo(hx - 1.3, hy + 4.4); g.lineTo(hx, hy + 2.2); g.closePath(); ink(c[0]);
    g.beginPath(); g.moveTo(hx + 0.3, hy + 2.2); g.lineTo(hx + 1.6, hy + 4.4); g.lineTo(hx + 2, hy + 1.4); g.closePath(); ink(c[0]);
    g.beginPath(); g.arc(hx, hy, 2.5, 0, TAU); ink(vgrad(c[0], hy - 2.5, hy + 2.5));
    g.beginPath(); g.moveTo(hx + 1, hy + 0.4); g.quadraticCurveTo(hx + 4, hy - 0.6, hx + 1.2, hy - 1.9); g.closePath(); ink(c[2], 0.3);
    g.fillStyle = OL; g.beginPath(); g.arc(hx + 3.1, hy - 0.6, 0.42, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + 0.9, hy + 0.8, 0.36, 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 1, hy + 1, 0.15, 0, TAU); g.fill();
  },
  Loom(c, t, f) {
    const a = swing(f), bob = Math.sin(t * 0.07) * 0.5;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = -1; k <= 1; k++) {
      g.beginPath(); g.moveTo(k * 1.1, 4.2 + bob);
      for (let q = 1; q <= 9; q++) g.lineTo(k * 1.1 - q * 1.15 + Math.sin(t * 0.12 + q * 0.8 + k) * 0.6, 4.2 + bob - q * 0.45 + Math.sin(t * 0.1 + q + k * 2) * 0.9);
      g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = k ? c[1] : c[2]; g.lineWidth = 0.85; g.stroke();
    }
    if (a > 0) { g.beginPath(); g.moveTo(3.5, 9.5 + bob); g.quadraticCurveTo(6 + a * 4, 12 + bob, 8 + a * 7, 9 + bob); g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = c[1]; g.lineWidth = 0.85; g.stroke(); }
    g.beginPath(); g.moveTo(0, 15.4 + bob); g.quadraticCurveTo(3.4, 12.8 + bob, 4.9, 9.6 + bob); g.quadraticCurveTo(2.6, 6.4 + bob, 0, 3.4 + bob); g.quadraticCurveTo(-2.6, 6.4 + bob, -4.9, 9.6 + bob); g.quadraticCurveTo(-3.4, 12.8 + bob, 0, 15.4 + bob); g.closePath(); ink(vgrad(c[0], 3.4, 15.4));
    g.fillStyle = tint(c[0], 0.3); g.beginPath(); g.moveTo(0, 15.1 + bob); g.quadraticCurveTo(3.2, 12.7 + bob, 4.5, 9.8 + bob); g.lineTo(0.2, 9.8 + bob); g.closePath(); g.fill();
    g.strokeStyle = tint(c[0], -0.5); g.lineWidth = 0.35; g.beginPath(); g.moveTo(0, 15.2 + bob); g.lineTo(0, 3.6 + bob); g.moveTo(-4.7, 9.6 + bob); g.lineTo(4.7, 9.6 + bob); g.stroke();
    g.fillStyle = c[2]; g.beginPath(); g.ellipse(1.3, 11.3 + bob, 0.7, 0.95, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(3.1, 10.9 + bob, 0.5, 0.75, 0, 0, TAU); g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(1.5, 11.2 + bob, 0.3, 0, TAU); g.fill(); g.beginPath(); g.arc(3.2, 10.8 + bob, 0.24, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(0, 4 + bob); g.lineTo(-1.5, 5 + bob); g.lineTo(-1.5, 3 + bob); g.closePath(); ink(c[1], 0.3);
    g.beginPath(); g.moveTo(0, 4 + bob); g.lineTo(1.5, 5 + bob); g.lineTo(1.5, 3 + bob); g.closePath(); ink(c[1], 0.3);
  },
  Hod(c, t, f) {
    const sw = gait(f), a = swing(f), br = Math.sin(t * 0.06) * 0.15;
    for (const q of [[-3.4, 1], [3.2, -1]]) { g.beginPath(); g.ellipse(q[0] + sw * q[1], 0.8, 1.9, 1.1, 0, 0, TAU); ink('#2f2a33', 0.35); }
    g.beginPath(); g.ellipse(0, 6.3, 6.5, 5.7 + br, 0, 0, TAU); ink(vgrad(c[0], 0.6, 12));
    g.fillStyle = tint(c[0], 0.35); g.beginPath(); g.ellipse(1.5, 4.2, 3.6, 2.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-7, 6.8); g.lineTo(-6, 12.2 + br); g.lineTo(-2.4, 14.2 + br); g.lineTo(2.2, 12.6 + br); g.lineTo(1.2, 8.6); g.lineTo(-3, 7.6); g.closePath(); ink(vgrad(c[1], 6.8, 14.2));
    g.fillStyle = tint(c[1], 0.3); g.beginPath(); g.moveTo(-6, 12.2 + br); g.lineTo(-2.4, 14.2 + br); g.lineTo(2.2, 12.6 + br); g.lineTo(-1.6, 11.6 + br); g.closePath(); g.fill();
    g.strokeStyle = tint(c[1], -0.5); g.lineWidth = 0.3; g.beginPath(); g.moveTo(-1.6, 11.6 + br); g.lineTo(-3, 7.6); g.moveTo(-1.6, 11.6 + br); g.lineTo(-6, 12.2 + br); g.moveTo(-1.6, 11.6 + br); g.lineTo(2.2, 12.6 + br); g.moveTo(-4.6, 9.2); g.lineTo(-3.9, 10.6); g.stroke();
    limb(2.5, 4.2, 4.6 + a * 4, 2.6 + a * 2.5, 1.9, tint(c[0], -0.15));
    const hx = 5 + a * 1.2;
    g.beginPath(); g.arc(hx - 1.6, 8.6, 1, 0, TAU); ink(tint(c[0], -0.2), 0.3);
    g.beginPath(); g.ellipse(hx, 6.2, 3.3, 2.7, 0, 0, TAU); ink(vgrad(c[0], 3.5, 8.9));
    g.beginPath(); g.moveTo(hx - 2, 8.3); g.quadraticCurveTo(hx + 1, 7.6, hx + 3.2, 5.7); g.lineTo(hx + 3.1, 4.9); g.quadraticCurveTo(hx + 0.6, 6.6, hx - 2.4, 7.3); g.closePath(); g.fillStyle = c[2]; g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(hx + 3.1, 5.3, 0.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + 0.6, 6.1, 0.36, 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 0.7, 6.3, 0.15, 0, TAU); g.fill();
  },
  /* Potato Sack: a lumpy burlap sack tied with rope, a sewn-on face, a leather patch, knotted corners for fists and feet. */
  Scuttle(c, t, f) {
    const sw = gait(f) * 0.9, a = swing(f), bob = Math.sin(t * 0.1) * 0.15, shell = '#2b2a2e';
    g.strokeStyle = shell; g.lineWidth = 0.7; g.lineCap = 'round'; for (const k of [-1, 0, 1]) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.2 + k, 2.6); g.lineTo(s * (4.6 + k * 0.6) + sw * s * (k ? 1 : -1), 0.3); g.stroke(); }   /* legs */
    g.beginPath(); g.ellipse(0, 3.2 + bob, 3.6, 1.9, 0, 0, TAU); ink(shell, 0.3);   /* the crab */
    g.beginPath(); g.moveTo(-3.6, 4.2 + bob); g.lineTo(-3.1, 9 + bob); g.lineTo(3.3, 9.4 + bob); g.lineTo(4.6, 3.8 + bob); g.closePath(); ink(vgrad(c[0], 4, 9.5));   /* the scuttle */
    g.fillStyle = shell; for (const q of [[-1.5, 9.5], [0.3, 10], [1.8, 9.6]]) { g.beginPath(); g.arc(q[0], q[1] + bob, 1, 0, TAU); g.fill(); } g.fillStyle = c[2]; g.beginPath(); g.arc(0.5, 9.8 + bob, 0.4, 0, TAU); g.fill();   /* coal */
    g.fillStyle = c[2]; for (const x of [1.6, 3]) { g.beginPath(); g.arc(x, 4.1 + bob, 0.38, 0, TAU); g.fill(); }   /* eyes under the lip */
    g.save(); g.translate(4.2, 3.4 + bob); g.rotate(-1.2 * a + 0.5); g.strokeStyle = '#4a4d57'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5.2); g.moveTo(0, 3.4); g.lineTo(-0.7, 6); g.moveTo(0, 3.4); g.lineTo(0.7, 6); g.stroke(); g.restore();   /* fire tongs */
  },
  /* Chomp Chomp: a squat round blue critter with a leaf sprout, small beady eyes and a huge mouth of triangular teeth. The
     mouth opens wide in an attack; the leaf bobs. Faces +x. */
  'Chomp Chomp'(c, t, f) {
    const sw = gait(f) * 0.8, a = swing(f), bob = Math.sin(t * 0.12) * 0.18, open = f && f.state === 'attack' ? 0.55 + 0.45 * Math.abs(Math.sin(a * 2.2)) : 0.25 + Math.max(0, Math.sin(t * 0.05)) * 0.1;
    for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(s2 * 2 + s2 * sw * 0.6 + 0.4, 0.7, 2, 1, 0, 0, TAU); ink(tint(c[0], -0.1), 0.35); }   /* stubby feet */
    for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(s2 * 4.6, 5.6 + bob); g.quadraticCurveTo(s2 * 6.6, 5.2 + bob, s2 * 6.7, 3.2 + bob); g.quadraticCurveTo(s2 * 5.4, 3.6 + bob, s2 * 4.4, 4.4 + bob); g.closePath(); ink(tint(c[0], -0.2), 0.32); }   /* fins */
    g.beginPath(); g.ellipse(0, 5.7 + bob, 5.2, 5.2, 0, 0, TAU); ink(vgrad(c[0], 0.5, 11), 0.5);   /* body */
    const my = 5 + bob, mh = 2.2 + open * 2.4;   /* the mouth, on the front of the body */
    g.beginPath(); g.moveTo(-1.6, my + 0.6); g.quadraticCurveTo(2, my + 1, 5.1, my + 0.6); g.quadraticCurveTo(4.6, my - mh, 1.6, my - mh * 0.9); g.quadraticCurveTo(-1.2, my - mh * 0.6, -1.6, my + 0.6); g.closePath(); ink('#5a0f1c', 0.35);
    g.fillStyle = '#fff'; g.strokeStyle = OL; g.lineWidth = 0.18;
    for (let k = 0; k < 5; k++) { const x0 = -1 + k * 1.2; g.beginPath(); g.moveTo(x0, my + 0.6); g.lineTo(x0 + 0.6, my - 0.5); g.lineTo(x0 + 1.2, my + 0.65); g.closePath(); g.fill(); g.stroke(); }   /* top teeth */
    for (let k = 0; k < 3; k++) { const x0 = 0 + k * 1.4, yb = my - mh * 0.8; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0 + 0.7, yb + 0.9); g.lineTo(x0 + 1.4, yb + 0.1); g.closePath(); g.fill(); g.stroke(); }   /* bottom teeth */
    g.fillStyle = OL; for (const x of [1.2, 3]) { g.beginPath(); g.arc(x, 8.4 + bob, 0.45, 0, TAU); g.fill(); }   /* small beady eyes */
    g.fillStyle = '#fff'; for (const x of [1.35, 3.15]) { g.beginPath(); g.arc(x, 8.6 + bob, 0.14, 0, TAU); g.fill(); }
    const lb = Math.sin(t * 0.15) * 0.3;   /* the leaf sprout, bobbing */
    g.strokeStyle = '#2f6b1e'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, 10.8 + bob); g.quadraticCurveTo(0.1, 11.8 + bob, 0.2 + lb * 0.3, 12.4 + bob); g.stroke();
    g.beginPath(); g.ellipse(1.3 + lb, 12.9 + bob, 1.3, 0.55, 0.35, 0, TAU); ink(c[1], 0.25); g.beginPath(); g.ellipse(-0.8 + lb * 0.6, 12.6 + bob, 1, 0.45, -0.4, 0, TAU); ink(tint(c[1], -0.15), 0.25);
    if (f && f.bubble) { g.beginPath(); g.arc(0, 5.5, 7.5, 0, TAU); g.fillStyle = 'rgba(190,225,255,.22)'; g.fill(); g.strokeStyle = 'rgba(220,240,255,.85)'; g.lineWidth = 0.35; g.stroke(); }
  },
  /* Brand: the night-watch captain. Tall boots, a long quilted slate coat with brass buttons, a kettle hat, a dark braid,
     a round stove-door shield on the leading arm and a broad sword with a forge-hot edge. The blade is drawn to where the
     attack's own shape is, so the picture and the hit agree. Faces +x. */
  Brand(c, t, f) {
    const sw = gait(f) * 1.3, bob = Math.sin(t * 0.07) * 0.14, iron = '#55585f', skin = '#d9a383', hair = '#2a2024', boot = '#3a2f2a';
    limb(-1.3, 4, -1.3 - sw, 0.8, 1.5, '#23232b'); limb(1.3, 4, 1.3 + sw, 0.8, 1.5, '#23232b');
    for (const s of [-1, 1]) { g.beginPath(); g.rect(s * 1.3 + s * sw - 1, 0.2, 2.1, 3.1); ink(boot, 0.28); g.beginPath(); g.ellipse(s * 1.3 + s * sw + 0.5, 0.5, 1.6, 0.7, 0, 0, TAU); ink(boot, 0.28); }
    g.beginPath(); g.moveTo(-3.3, 3.3); g.quadraticCurveTo(0, 2.6, 3.4, 3.3); g.lineTo(2.3, 11.3 + bob); g.quadraticCurveTo(0, 12 + bob, -2.3, 11.3 + bob); g.closePath(); ink(vgrad(c[0], 3, 12));   /* coat */
    g.strokeStyle = tint(c[0], -0.35); g.lineWidth = 0.16; g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(k * 1.1 - 1.4, 3.4); g.lineTo(k * 1.1 + 1.2, 11); g.moveTo(k * 1.1 + 1.4, 3.4); g.lineTo(k * 1.1 - 1.2, 11); } g.stroke();   /* quilting */
    g.fillStyle = c[1]; for (const y of [8.2, 9.4, 10.5]) { g.beginPath(); g.arc(0.5, y + bob, 0.26, 0, TAU); g.fill(); }
    g.beginPath(); g.rect(-2.9, 6.6, 5.8, 0.9); ink('#6b4630', 0.22); g.beginPath(); g.rect(0.1, 6.5, 1, 1.1); ink('#9a9aa2', 0.18);   /* belt */
    /* the sword arm */
    let tx = 4.6, ty = 2.2, hx = 2.6, hy = 6.6;
    if (f && f.state === 'attack' && f.move && f.move.h) { const m = f.move, h = m.h.find(q => !q.grab && f.mf >= q.f0 && f.mf <= q.f1) || m.h.find(q => !q.grab && f.mf < q.f0) || m.h.filter(q => !q.grab).pop();
      if (h && h.in) { const p = f.mf < h.f0 ? f.mf / h.f0 : f.mf <= h.f1 ? 1 : Math.max(0, 1 - (f.mf - h.f1) / Math.max(1, m.t - h.f1)), e = p * p * (3 - 2 * p), wind = f.mf < h.f0 ? Math.sin(p * Math.PI) * 2 : 0;
        const ex = h.x + (h.x >= h.in[0] ? h.r : -h.r) * 0.8, ey = h.y; tx += (ex - tx) * e - wind * 1.5; ty += (ey - ty) * e + wind; hx += (h.in[0] * 0.8 - hx) * e; hy += (h.in[1] - hy) * e; } }
    limb(0.6, 10 + bob, hx, hy, 1.2, tint(c[0], -0.12));
    { const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = iron; g.lineWidth = 0.95; g.stroke();
      const q = g.createLinearGradient(hx, hy, tx, ty); q.addColorStop(0, 'rgba(255,138,60,0)'); q.addColorStop(0.35, c[2]); q.addColorStop(1, '#ffd98a'); g.beginPath(); g.moveTo(hx + ux * L * 0.25 - uy * 0.25, hy + uy * L * 0.25 + ux * 0.25); g.lineTo(tx - uy * 0.2, ty + ux * 0.2); g.strokeStyle = q; g.lineWidth = 0.42; g.stroke();
      g.beginPath(); g.moveTo(hx + ux * 0.9 - uy * 1.1, hy + uy * 0.9 + ux * 1.1); g.lineTo(hx + ux * 0.9 + uy * 1.1, hy + uy * 0.9 - ux * 1.1); g.strokeStyle = OL; g.lineWidth = 0.75; g.stroke(); g.strokeStyle = '#33353c'; g.lineWidth = 0.4; g.stroke();   /* crossguard */
      g.beginPath(); g.arc(hx, hy, 0.75, 0, TAU); ink(skin, 0.22); }
    /* while a sword hit is out, the red point at the end of the blade (as in 3D) */
    if (f && f.state === 'attack' && f.move && f.move.h && f.move.h.some(q => !q.grab && !q.nb && q.d > 0 && f.mf >= q.f0 && f.mf <= q.f1)) { g.beginPath(); g.arc(tx, ty, 0.55, 0, TAU); g.fillStyle = '#ff1414'; g.fill(); }
    /* head, braid and kettle hat */
    g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-1.2, 13 + bob); g.quadraticCurveTo(-2.4, 11.4 + bob, -1.9, 8.8 + bob); g.stroke(); g.strokeStyle = hair; g.lineWidth = 0.9; g.stroke();
    g.beginPath(); g.arc(0.3, 13 + bob, 1.75, 0, TAU); ink(skin, 0.28);
    g.fillStyle = OL; g.beginPath(); g.arc(1.25, 13.1 + bob, 0.18, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-2.9, 13.7 + bob); g.lineTo(3.4, 13.7 + bob); g.lineTo(1.7, 14.4 + bob); g.quadraticCurveTo(0.3, 16.4 + bob, -1.2, 14.4 + bob); g.closePath(); ink(vgrad('#6a6d75', 13.6, 16));
    /* the stove-door shield on the leading arm: raised and pushed forward while the bash guards or strikes */
    const up = f && f.state === 'attack' && f.mname === 'sspec' ? (f.mf >= 5 && f.mf <= 14 ? 1 : 0.4) : f && (f.state === 'shield' || f.state === 'shieldstun') ? 0.8 : f && f.state === 'attack' && f.mname === 'dash' ? 0.9 : 0;
    const sx = 2.7 + up * 2.6, sy = 6.9 + bob + up * 0.5, sr = 2.5 + up * 0.5;
    g.beginPath(); g.ellipse(sx, sy, sr * 0.62, sr, 0, 0, TAU); ink(vgrad('#4a4c53', sy - sr, sy + sr), 0.36);
    g.beginPath(); g.ellipse(sx + 0.1, sy, sr * 0.4, sr * 0.68, 0, 0, TAU); g.strokeStyle = '#2c2d33'; g.lineWidth = 0.2; g.stroke();
    g.fillStyle = c[1]; g.fillRect(sx - sr * 0.6, sy - 0.25, sr * 0.55, 0.5);   /* brass hinge strap */
    g.fillStyle = c[2]; g.beginPath(); g.ellipse(sx + 0.25, sy, 0.32, 0.6, 0, 0, TAU); g.fill();   /* the glowing grille */
  },
  /* Vargan the Ashbound: heavy boots, dark trousers, a studded leather tunic, a fur mantle on one shoulder, a braided red
     beard, and Runebreaker. The axe is drawn where an axe hit's shape is (as Brand's blade); while it is thrown his hand is
     empty. In Berserker an orange glow rings him. Faces +x. */
  Vargan(c, t, f) {
    const sw = gait(f) * 1.2, bob = Math.sin(t * 0.06) * 0.16, skin = '#d29a76', leather = '#4a2e1c', beard = '#9a4e22';
    if (f && f.berserk) { g.beginPath(); g.ellipse(0, 8, 6.4, 9.6, 0, 0, TAU); g.fillStyle = 'rgba(255,90,30,.18)'; g.fill(); }
    limb(-1.5, 5, -1.6 - sw, 1, 1.9, '#3c3a30'); limb(1.5, 5, 1.6 + sw, 1, 1.9, '#3c3a30');
    for (const s of [-1, 1]) { g.beginPath(); g.rect(s * 1.6 + s * sw - 1.2, 0.2, 2.6, 3.6); ink('#3a2416', 0.28); g.beginPath(); g.ellipse(s * 1.6 + s * sw + 0.6, 0.6, 1.9, 0.8, 0, 0, TAU); ink('#3a2416', 0.28); }
    g.beginPath(); g.moveTo(-3.6, 4.2); g.quadraticCurveTo(0, 3.4, 3.8, 4.2); g.lineTo(3.2, 12.6 + bob); g.quadraticCurveTo(0, 13.4 + bob, -3.2, 12.6 + bob); g.closePath(); ink(vgrad(leather, 4, 13));   /* tunic */
    g.fillStyle = c[1]; for (const [x, y] of [[-1.6, 10.6], [1.4, 10.8], [-1.2, 8.4], [1.8, 8.6]]) { g.beginPath(); g.arc(x, y + bob, 0.24, 0, TAU); g.fill(); }
    g.beginPath(); g.rect(-3.3, 7.4, 6.6, 1.1); ink('#5e3b22', 0.22); g.beginPath(); g.rect(0.3, 7.3, 1.2, 1.3); ink(c[1], 0.18);   /* belt and buckle */
    /* the axe arm */
    let tx = 4.2, ty = 13.4, hx = 3.0, hy = 7.6;
    if (f && f.state === 'attack' && f.move && f.move.h && !f.axeAway) { const m = f.move, h = m.h.find(q => q.ax && f.mf >= q.f0 && f.mf <= q.f1) || m.h.find(q => q.ax && f.mf < q.f0) || m.h.filter(q => q.ax).pop();
      if (h) { const p = f.mf < h.f0 ? f.mf / h.f0 : f.mf <= h.f1 ? 1 : Math.max(0, 1 - (f.mf - h.f1) / Math.max(1, m.t - h.f1)), e = p * p * (3 - 2 * p), U = 16, a = h.ax[2] * Math.PI / 180;
        const gx = h.ax[0] * U, gy = h.ax[1] * U; hx += (gx - hx) * e; hy += (gy - hy) * e; tx += (gx + Math.cos(a) * 11 - tx) * e; ty += (gy + Math.sin(a) * 11 - ty) * e; } }
    limb(1, 11.4 + bob, hx, hy, 1.6, skin);
    if (!(f && f.axeAway)) { const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = hx - ux * 1.8, py = hy - uy * 1.8;
      g.lineCap = 'round'; g.beginPath(); g.moveTo(px, py); g.lineTo(tx, ty); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); g.strokeStyle = '#6b4226'; g.lineWidth = 0.7; g.stroke();
      const bx = tx - ux * 2.4, by = ty - uy * 2.4, nx = uy, ny = -ux;   /* the blade on the haft's leading side */
      g.beginPath(); g.moveTo(bx - ux * 1.2, by - uy * 1.2); g.lineTo(bx - ux * 1.6 + nx * 3, by - uy * 1.6 + ny * 3); g.lineTo(tx + ux * 0.6 + nx * 3, ty + uy * 0.6 + ny * 3); g.lineTo(tx, ty); g.closePath(); ink(f && f.berserk ? '#c9744a' : '#9aa0a8', 0.3);
      g.beginPath(); g.arc(hx, hy, 0.85, 0, TAU); ink(skin, 0.22); }
    else { g.beginPath(); g.arc(hx, hy, 0.85, 0, TAU); ink(skin, 0.22); }
    /* fur mantle, head, beard and braid */
    g.beginPath(); g.ellipse(-1.2, 12.4 + bob, 2.6, 1.3, -0.2, 0, TAU); ink('#9b9890', 0.26);
    g.beginPath(); g.arc(0.5, 14.3 + bob, 1.9, 0, TAU); ink(skin, 0.28);
    g.beginPath(); g.moveTo(-0.3, 13.6 + bob); g.quadraticCurveTo(1.6, 11.2 + bob, 2.5, 13.5 + bob); g.closePath(); ink(beard, 0.22);
    g.strokeStyle = OL; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-1.2, 14.8 + bob); g.quadraticCurveTo(-2.2, 13.2 + bob, -1.8, 11.6 + bob); g.stroke(); g.strokeStyle = beard; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = OL; g.beginPath(); g.arc(1.6, 14.6 + bob, 0.2, 0, TAU); g.fill(); g.fillStyle = c[1]; g.fillRect(1.0, 14.9 + bob, 1.2, 0.35);   /* the gold plate over one eye */
  },
  /* Joey: an ordinary lean man, red cap, a dark mustache, grey camouflage shorts, bare feet. The reaching hand is drawn to
     where the attack's own shape is, as Brand's blade is. Faces +x. */
  Joey(c, t, f) {
    const sw = gait(f) * 1.2, bob = Math.sin(t * 0.07) * 0.12, skin = c[2], hair = '#2a1d18', sk = tint(skin, -0.12);
    if (f && f.state === 'grow') return growArt(c, t, f);
    limb(-0.8, 5.6, -0.8 - sw, 0.5, 1.1, sk); limb(0.8, 5.6, 0.8 + sw, 0.5, 1.1, skin);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.8 + s * sw + 0.45, 0.35, 0.95, 0.38, 0, 0, TAU); ink(skin, 0.22); }   /* bare feet */
    g.beginPath(); g.moveTo(-1.6, 5.2); g.lineTo(-1.7, 7.6); g.lineTo(1.7, 7.6); g.lineTo(1.6, 5.2); g.lineTo(0.15, 5.4); g.lineTo(0, 6.4); g.lineTo(-0.15, 5.4); g.closePath(); ink(c[1], 0.26);   /* shorts */
    g.fillStyle = tint(c[1], 0.35); for (const q of [[-1, 6.7], [0.6, 6.1], [1.1, 7.1], [-0.4, 5.8]]) { g.beginPath(); g.ellipse(q[0], q[1], 0.45, 0.16, 0.4, 0, TAU); g.fill(); }   /* camouflage */
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 0.12; g.beginPath(); g.moveTo(0.1, 7.5); g.lineTo(0.05, 6.8); g.stroke();   /* drawstring */
    g.beginPath(); g.moveTo(-1.5, 7.6); g.quadraticCurveTo(-1.9, 10.5, -1.8, 11.3 + bob); g.lineTo(1.8, 11.3 + bob); g.quadraticCurveTo(1.9, 10.5, 1.5, 7.6); g.closePath(); ink(vgrad(skin, 7.6, 11.4), 0.3);   /* bare torso */
    limb(-1.4, 11 + bob, -2.1, 7.4, 0.85, sk);   /* back arm */
    let tx = 2.1, ty = 7.6;
    if (f && f.state === 'attack' && f.move && f.move.h) { const m = f.move, h = m.h.find(q => !q.grab && f.mf >= q.f0 && f.mf <= q.f1) || m.h.find(q => !q.grab && f.mf < q.f0) || m.h.filter(q => !q.grab).pop();
      if (h && h.in && h.y > 3) { const p = f.mf < h.f0 ? f.mf / h.f0 : f.mf <= h.f1 ? 1 : Math.max(0, 1 - (f.mf - h.f1) / Math.max(1, m.t - h.f1)), e = p * p * (3 - 2 * p); tx += (h.x - tx) * e; ty += (h.y - ty) * e; } }
    limb(1.3, 11 + bob, tx, ty, 0.85, skin); g.beginPath(); g.arc(tx, ty, 0.5, 0, TAU); ink(skin, 0.2);
    g.beginPath(); g.rect(-0.45, 11.2 + bob, 0.9, 0.7); ink(skin, 0.2);   /* neck */
    g.beginPath(); g.ellipse(0.2, 12.7 + bob, 1.25, 1.45, 0, 0, TAU); ink(skin, 0.28);   /* head */
    g.fillStyle = hair; g.beginPath(); g.arc(-0.8, 13.3 + bob, 0.55, 0, TAU); g.arc(-0.3, 13.75 + bob, 0.5, 0, TAU); g.fill();   /* curls under the cap */
    g.fillStyle = OL; g.beginPath(); g.arc(0.95, 12.95 + bob, 0.14, 0, TAU); g.fill();
    g.strokeStyle = hair; g.lineWidth = 0.28; g.beginPath(); g.moveTo(0.6, 12.15 + bob); g.quadraticCurveTo(1.05, 12.35 + bob, 1.45, 12.05 + bob); g.stroke();   /* mustache */
    g.beginPath(); g.moveTo(-1.15, 13.4 + bob); g.quadraticCurveTo(0.1, 14.9 + bob, 1.25, 13.6 + bob); g.lineTo(2.6, 13.35 + bob); g.lineTo(1.3, 13.25 + bob); g.closePath(); ink(c[0], 0.26);   /* red cap and its peak */
  },
  /* Cronky Dong: the same head, cap and shorts on an absurd body, low on its knuckles. Faces +x. */
  'Cronky Dong'(c, t, f) {
    const sw = gait(f) * 1.6, bob = Math.sin(t * 0.06) * 0.18, skin = c[2], sk = tint(skin, -0.14), hair = '#2a1d18', a = swing(f);
    limb(-2.6, 6, -3.4 - sw, 0.6, 3, sk); limb(2.4, 6, 3.2 + sw, 0.6, 3, skin);   /* thick legs */
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 3.2 + s * sw + 0.6, 0.4, 1.5, 0.5, 0, 0, TAU); ink(skin, 0.24); }
    g.beginPath(); g.moveTo(-4, 5); g.lineTo(-4.3, 8.2); g.lineTo(4.3, 8.2); g.lineTo(4, 5); g.lineTo(0, 5.6); g.closePath(); ink(c[1], 0.3);
    g.fillStyle = tint(c[1], 0.35); for (const q of [[-2.4, 7.2], [1.5, 6.5], [2.8, 7.6], [-0.6, 6.2]]) { g.beginPath(); g.ellipse(q[0], q[1], 0.9, 0.3, 0.4, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-4, 8.2); g.quadraticCurveTo(-7.4, 12.5 + bob, -5.6, 15.4 + bob); g.quadraticCurveTo(0, 17.4 + bob, 5.6, 15.4 + bob); g.quadraticCurveTo(7.4, 12.5 + bob, 4, 8.2); g.closePath(); ink(vgrad(skin, 8, 17), 0.34);   /* the torso */
    g.strokeStyle = sk; g.lineWidth = 0.18; g.beginPath(); g.moveTo(0, 15.6 + bob); g.lineTo(0, 9.2); for (const y of [10, 11.2, 12.4]) { g.moveTo(-1.3, y); g.lineTo(1.3, y); } g.moveTo(-3.6, 13.6 + bob); g.quadraticCurveTo(0, 12.4 + bob, 3.6, 13.6 + bob); g.stroke();
    const reach = a * 6;
    limb(-5.2, 14.8 + bob, -6.6, 6, 3.4, sk); g.beginPath(); g.arc(-6.4, 1.6, 1.7, 0, TAU); ink(sk, 0.3); limb(-6.6, 6, -6.4, 2.2, 3.6, sk);   /* back arm: the forearm down to the knuckles */
    limb(5.2, 14.8 + bob, 6.8 + reach * 0.5, 6 + reach * 0.3, 3.4, skin); limb(6.8 + reach * 0.5, 6 + reach * 0.3, 6.6 + reach, 2.2 + reach * 0.6, 3.8, skin); g.beginPath(); g.arc(6.6 + reach, 1.6 + reach * 0.6, 1.8, 0, TAU); ink(skin, 0.3);
    g.beginPath(); g.ellipse(-3.4, 15.4 + bob, 2.4, 1.5, -0.3, 0, TAU); ink(skin, 0.28); g.beginPath(); g.ellipse(3.4, 15.4 + bob, 2.4, 1.5, 0.3, 0, TAU); ink(skin, 0.28);   /* traps */
    const hy = 16.2 + bob;   /* the ordinary head, set low between the traps */
    g.beginPath(); g.ellipse(0.4, hy, 1.25, 1.45, 0, 0, TAU); ink(skin, 0.28);
    g.fillStyle = hair; g.beginPath(); g.arc(-0.6, hy + 0.6, 0.55, 0, TAU); g.arc(-0.1, hy + 1.05, 0.5, 0, TAU); g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(1.15, hy + 0.25, 0.14, 0, TAU); g.fill();
    g.strokeStyle = hair; g.lineWidth = 0.28; g.beginPath(); g.moveTo(0.8, hy - 0.55); g.quadraticCurveTo(1.25, hy - 0.35, 1.65, hy - 0.65); g.stroke();
    g.beginPath(); g.moveTo(-0.95, hy + 0.7); g.quadraticCurveTo(0.3, hy + 2.2, 1.45, hy + 0.9); g.lineTo(2.8, hy + 0.65); g.lineTo(1.5, hy + 0.55); g.closePath(); ink(c[0], 0.26);
  },
  Sprocket(c, t, f) {
    const sw = gait(f) * 1.4, a = swing(f), bob = Math.sin(t * 0.08) * 0.15, skin = '#e0a98a', iron = '#5b5f6b', copper = '#b87333';
    for (const s of [-1, 1]) { g.beginPath(); g.rect(s * 1.9 - 1.1 + s * sw * 0.5, 1.2, 2.2, 3.6); ink('#3a3a40', 0.3); g.beginPath(); g.ellipse(s * 1.9 + s * sw + 0.5, 0.8, 1.9, 0.9, 0, 0, TAU); ink(iron, 0.3); }   /* legs and steel-capped boots */
    g.beginPath(); g.moveTo(-4.2, 3.6); g.lineTo(-3.6, 10.6 + bob); g.quadraticCurveTo(0, 11.8 + bob, 3.6, 10.6 + bob); g.lineTo(4.2, 3.6); g.closePath(); ink(vgrad(c[0], 3.6, 11));   /* work coat */
    g.beginPath(); g.moveTo(-1.3, 11 + bob); g.lineTo(0.2, 6.2); g.lineTo(1.7, 11 + bob); g.closePath(); ink(c[1], 0.25);   /* shirt */
    g.beginPath(); g.rect(-4.2, 5, 8.4, 1.1); ink('#4a3426', 0.25); g.beginPath(); g.rect(-0.2, 4.9, 1.2, 1.3); ink(iron, 0.2);   /* tool belt */
    g.save(); g.translate(3.4, 8.2 + bob); g.rotate(-0.2 - a * 1.9);   /* the wrench arm: hangs at rest, swings over in an attack */
    g.beginPath(); g.rect(-0.45, -8.6, 0.9, 8.2); ink(copper, 0.28); g.beginPath(); g.arc(0, -9.2, 1.35, Math.PI * 0.75, Math.PI * 2.25); g.lineTo(0, -8.9); g.closePath(); ink(copper, 0.28);
    g.beginPath(); g.arc(0, 0, 1.25, 0, TAU); ink('#c2a45a', 0.3); g.restore();
    g.beginPath(); g.arc(-4.4, 6.6 + bob, 1.2, 0, TAU); ink('#c2a45a', 0.3);   /* back glove */
    g.beginPath(); g.arc(0.2, 12.6 + bob, 2.3, 0, TAU); ink(skin, 0.3);   /* head */
    g.beginPath(); g.arc(0.5, 11.9 + bob, 1.9, Math.PI * 1.05, Math.PI * 1.95, false); g.closePath(); ink('#b9b4ac', 0.25);   /* beard */
    for (const x of [0.2, 1.9]) { g.beginPath(); g.arc(x, 14.2 + bob, 0.7, 0, TAU); ink('#3c4a4a', 0.25); g.strokeStyle = '#c9a94e'; g.lineWidth = 0.22; g.stroke(); }   /* goggles pushed up */
    g.fillStyle = OL; for (const x of [0.6, 1.9]) { g.beginPath(); g.arc(x, 12.9 + bob, 0.2, 0, TAU); g.fill(); }
  },
  'Potato Sack'(c, t, f) {
    const sw = gait(f) * 1.1, a = swing(f), bob = Math.sin(t * 0.09) * 0.2, rope = '#b89a5e';
    g.beginPath(); g.ellipse(-2.9 - sw, 0.7, 1.5, 0.8, 0, 0, TAU); ink(tint(c[0], -0.2), 0.3); g.beginPath(); g.ellipse(2.9 + sw, 0.7, 1.5, 0.8, 0, 0, TAU); ink(tint(c[0], -0.2), 0.3);   /* knotted feet */
    g.beginPath(); g.arc(-5.5, 6 + bob, 1.3, 0, TAU); ink(tint(c[0], -0.15), 0.3);                                                                                               /* back fist */
    g.beginPath(); g.moveTo(-4.4, 1.3); g.quadraticCurveTo(-6, 5 + bob, -3.4, 9.8 + bob); g.quadraticCurveTo(-2, 10.9 + bob, -1.3, 10.9 + bob); g.lineTo(1.3, 10.9 + bob);
    g.quadraticCurveTo(2, 10.9 + bob, 3.4, 9.8 + bob); g.quadraticCurveTo(6, 5 + bob, 4.4, 1.3); g.quadraticCurveTo(0, 0.2, -4.4, 1.3); g.closePath(); ink(vgrad(c[0], 0.8, 11));     /* the sack */
    g.strokeStyle = tint(c[0], -0.3); g.lineWidth = 0.14; g.beginPath(); for (let y = 2.2; y < 10; y += 1.3) { g.moveTo(-4.6, y); g.quadraticCurveTo(0, y - 0.5, 4.6, y); } g.stroke();   /* weave */
    for (const q of [[-3.5, 9.7, 1.0, 0.75], [-2.3, 10.2, 0.8, 0.6]]) { g.beginPath(); g.ellipse(q[0], q[1] + bob, q[2], q[3], 0.4, 0, TAU); ink('#c8a46a', 0.25); }                 /* potatoes peeking out */
    g.fillStyle = '#6fae4e'; g.beginPath(); g.ellipse(-3.9, 10.6 + bob, 0.32, 0.18, -0.6, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-1.2, 11.2 + bob); g.lineTo(-2.7, 13.5 + bob); g.quadraticCurveTo(-0.6, 12.8 + bob, 0.2, 13.9 + bob); g.quadraticCurveTo(1.2, 12.9 + bob, 2.9, 13.6 + bob); g.lineTo(1.2, 11.2 + bob); g.closePath(); ink(tint(c[0], -0.1), 0.3);   /* the tied top */
    g.beginPath(); g.ellipse(0, 11.05 + bob, 1.7, 0.5, 0, 0, TAU); ink(rope, 0.3);
    g.save(); g.translate(-1.9, 3.6 + bob * 0.5); g.rotate(-0.12); g.beginPath(); g.rect(-1.6, -1.4, 3.2, 2.8); ink(c[1], 0.3);
    g.strokeStyle = c[2]; g.lineWidth = 0.2; g.beginPath(); for (const q of [[-1.6, -0.8], [-1.6, 0.6], [1.6, -0.8], [1.6, 0.6]]) { g.moveTo(q[0] - 0.4, q[1]); g.lineTo(q[0] + 0.4, q[1]); } for (const x of [-0.8, 0.6]) { g.moveTo(x, -1.8); g.lineTo(x, -1); g.moveTo(x, 1); g.lineTo(x, 1.8); } g.stroke(); g.restore();   /* patch and stitches */
    for (const q of [[0.5, 7.6, 0.95, '#c9a94e'], [3.1, 7.7, 0.7, '#9a7350']]) {   /* button eyes, one brass, one wooden */
      g.beginPath(); g.arc(q[0], q[1] + bob, q[2], 0, TAU); ink(q[3], 0.28); g.fillStyle = OL; for (const d of [-0.22, 0.22]) { g.beginPath(); g.arc(q[0] + d, q[1] + bob, 0.11, 0, TAU); g.fill(); }
    }
    g.strokeStyle = OL; g.lineWidth = 0.3; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0.1, 5.5 + bob);
    [[0.7, 5.1], [1.3, 5.6], [1.9, 5.2], [2.5, 5.7], [3.1, 5.4], [3.7, 6.1]].forEach(q => g.lineTo(q[0], q[1] + bob)); g.stroke();   /* stitched grin */
    const hx = 5.5 + a * 3.2, hy = 6 + bob + a * 1.2;
    limb(4.2, 6.4 + bob, hx, hy, 1.3, c[0]); g.beginPath(); g.arc(hx, hy, 1.35, 0, TAU); ink(tint(c[0], 0.08), 0.3);   /* front fist, the one that swings */
  },
};
/* Furious Fowls in 2D: a round bird, in the slingshot's pouch or alone. */
/* Joey's growth, drawn over three seconds: he looks round, the injector, then three swells, and down onto his knuckles. */
function growArt(c, t, f) {
  const e = f.sf, k = e < 55 ? 0 : e < 115 ? (e - 55) / 60 * 0.6 : e < 157 ? 0.6 + (e - 115) / 42 * 0.4 : 1, pulse = e >= 55 && e < 115 ? Math.max(0, Math.sin((e - 55) / 20 * Math.PI)) * 0.08 : 0, s = k + pulse;
  g.save(); if (e < 24) g.scale(e % 24 < 12 ? 1 : -1, 1);
  if (s <= 0.02) { ART.Joey(c, t, Object.assign({}, f, { state: 'idle' })); if (e >= 25 && e < 55) { g.strokeStyle = '#9fd6ff'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(1.6, 8.6); g.lineTo(2.6, 9.6); g.stroke(); } g.restore(); return; }
  g.globalAlpha = 1 - Math.min(1, s); ART.Joey(c, t, Object.assign({}, f, { state: 'idle' })); g.globalAlpha = Math.min(1, s * 1.4);
  g.translate(0, 0); g.scale(0.6 + 0.4 * s, 0.75 + 0.25 * s); ART['Cronky Dong'](c, t, Object.assign({}, f, { state: 'idle' })); g.restore();
}
function fowlSling2d() { g.strokeStyle = '#a8672f'; g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0.6); g.lineTo(0, 6); g.lineTo(-4.2, 13.6); g.moveTo(0, 6); g.lineTo(4.2, 13.6); g.stroke();
  g.strokeStyle = '#c2562e'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-4.2, 13); g.lineTo(0, 9.2); g.lineTo(4.2, 13); g.stroke(); g.fillStyle = '#7a3a26'; g.beginPath(); g.ellipse(0, 9, 2.6, 1.3, 0, 0, TAU); g.fill();
  g.fillStyle = '#a8672f'; for (const x of [-1.3, 1.3]) { g.beginPath(); g.ellipse(x, 0.4, 1.1, 0.5, 0, 0, TAU); g.fill(); } }
function fowlBird(c, y, r, t) { const bob = Math.sin(t * 0.1) * 0.12; g.beginPath(); g.ellipse(0, y + bob, r, r * 0.95, 0, 0, TAU); ink(vgrad(c[0], y - r, y + r), 0.3); g.beginPath(); g.ellipse(r * 0.2, y - r * 0.35 + bob, r * 0.6, r * 0.5, 0, 0, TAU); ink(c[1], 0.2);
  g.beginPath(); g.moveTo(-r * 0.3, y + r * 0.85 + bob); g.quadraticCurveTo(-r * 0.9, y + r * 1.7 + bob, r * 0.2, y + r * 0.95 + bob); g.closePath(); ink(c[2] === '#ffffff' ? c[1] : c[2], 0.2);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(r * 0.45, y + r * 0.25 + bob, r * 0.26, 0, TAU); g.fill(); g.fillStyle = OL; g.beginPath(); g.arc(r * 0.52, y + r * 0.22 + bob, r * 0.12, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(r * 0.8, y + r * 0.1 + bob); g.lineTo(r * 1.3, y - r * 0.05 + bob); g.lineTo(r * 0.8, y - r * 0.2 + bob); g.closePath(); ink('#4a3b36', 0.2); }
for (const [n, r] of [['Rusty', 3.2], ['Bolt', 2.9], ['Cinder', 4], ['Pip', 2.3], ['Pearl', 3.3]]) { ART[n] = (c, t) => { fowlSling2d(); fowlBird(c, 9.8, r, t); }; ART[n + ' alone'] = (c, t) => fowlBird(c, r + 0.5, r * 1.05, t); }
function drawFighter(f, three) {
  if (f.state === 'dead') return;
  const s = cam.s, st = f.st, fm = f.form, col = f.alt ? fm.alt : fm.col, x = SX(f.x), y = SY(f.y);
  if (!three) {
  if (f.state === 'respawn') { g.fillStyle = 'rgba(255,230,160,.8)'; rr(x - 9 * s, y, 18 * s, 1.6 * s, 0.8 * s); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.25)'; if (f.grounded) { g.beginPath(); g.ellipse(x, y + 0.4 * s, st.w * 0.6 * s, 0.9 * s, 0, 0, TAU); g.fill(); }
  g.save(); g.translate(x, y);
  let sy = 1, sx = 1, rot = 0, oy = 0;
  if (f.state === 'jsq' || f.state === 'land') { sy = 0.8; sx = 1.12; } else if (f.state === 'dash' || f.state === 'run') rot = 0.18;
  else if (f.state === 'wd') { sy = 0.85; rot = -0.12 * sgn(f.vx * f.face); }
  else if (f.state === 'hurt' && !f.grounded) { rot = f.sf * 0.3; oy = st.h / 2; }
  else if (f.state === 'broken') rot = Math.sin(frame * 0.2) * 0.25;
  else if (f.state === 'roll') { rot = f.sf * 0.45 * f.rollDir * f.face; oy = st.h / 2; }
  else if (f.state === 'helpless') rot = 0.35;
  else if (f.state === 'attack' && f.move && f.move.swap) { sx = sy = 1 - Math.sin(Math.min(1, f.mf / 34) * Math.PI) * 0.7; }
  else if (f.state === 'air') sy = 1 + clamp(Math.abs(f.vy) * 0.03, 0, 0.12);
  else if (f.state === 'idle' && f.ctl.c.ly < CROUCH_Y) { sy = 0.72; sx = 1.1; }
  else if (f.state === 'down') { sy = 0.45; sx = 1.25; }
  if (!f.grounded && f.state !== 'ledge' && f.state !== 'hurt' && f.state !== 'roll') oy = 0;
  g.scale(s * f.face, -s);
  if (oy) { g.translate(0, oy); g.rotate(-rot); g.translate(0, -oy); } else g.rotate(-rot);
  g.scale(sx, sy);
  if (f.invuln > 0 && (frame >> 1) % 2) g.globalAlpha = 0.45;
  if (f.state === 'spot' || f.state === 'airdodge') g.globalAlpha = 0.5;
  ART[fm.name](col, frame + f.idx * 40, f);
  if ((f.flash > 0 || f.hitlag > 0 && f.state === 'hurt') && !(typeof finalT !== 'undefined' && finalT > 0 && finalT < FINAL_FREEZE - 3)) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; ART[fm.name](['#ffffff', '#ffffff', '#ffffff'], frame, f); g.globalCompositeOperation = 'source-over'; }
  g.restore(); g.globalAlpha = 1;
  }
  /* Attack arcs: only with the switch on (start screen, or G). */
  if (DBG.arcs && f.state === 'attack' && f.move) for (const h of f.move.h) if (f.mf >= h.f0 && f.mf <= h.f1 && !h.grab) {
    const hx = SX(f.x + h.x * f.face), hy = SY(hitY(f, h)), k = (f.mf - h.f0 + 1) / (h.f1 - h.f0 + 1);
    g.strokeStyle = col[1]; g.globalAlpha = 0.85 - k * 0.5; g.lineWidth = 1.6 * s; g.beginPath(); g.arc(hx, hy, h.r * s * 0.8, -1.2 + k * 2.4 * f.face, 1.2 + k * 2.4 * f.face); g.stroke();
    g.fillStyle = col[2]; g.globalAlpha = 0.18; g.beginPath(); g.arc(hx, hy, h.r * s, 0, TAU); g.fill(); g.globalAlpha = 1;
  }
  if (DBG.arcs && f.state === 'attack' && f.move && f.move.h[0] && f.move.h[0].grab && f.mf >= 5 && f.mf <= 10) { g.strokeStyle = '#fff'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(x + 3 * s * f.face, y - 7 * s); g.lineTo(x + 11 * s * f.face, y - 7 * s); g.stroke(); }
  if (DBG.arcs && f.charge > 0 && (frame >> 1) % 2) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - st.h * s / 2, (st.h * 0.7 + f.charge * 0.05) * s, 0, TAU); g.stroke(); }
  if (!three && (f.state === 'shield' || f.state === 'shieldstun')) {
    const sc = shieldCircle(f); g.fillStyle = f.idx ? 'rgba(110,180,255,.45)' : 'rgba(255,125,110,.45)'; g.beginPath(); g.arc(SX(sc[0]), SY(sc[1]), sc[2] * s, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
  }
  if (f.state === 'broken') { g.fillStyle = '#ffe066'; for (let k = 0; k < 3; k++) { const a = frame * 0.15 + k * TAU / 3; g.beginPath(); g.arc(x + Math.cos(a) * 5 * s, y - (st.h + 3) * s + Math.sin(a) * 1.5 * s, 0.9 * s, 0, TAU); g.fill(); } }
  /* Player tag. */
  const ty = Math.max(26, y - (st.h + 7) * s); g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = f.idx ? '#6cb4ff' : '#ff7b6c';
  g.fillText(f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1), clamp(x, 20, W - 20), ty); g.beginPath(); g.moveTo(x - 5, ty + 4); g.lineTo(x + 5, ty + 4); g.lineTo(x, ty + 10); g.fill();
}
function drawProj() {
  const s = cam.s;
  if (typeof chompRopes === 'function') for (const r of chompRopes()) { g.strokeStyle = r[4] === 'ant' ? '#c9a46a' : '#a88552'; g.lineWidth = Math.max(1, 0.5 * s); g.beginPath(); g.moveTo(SX(r[0]), SY(r[1])); g.lineTo(SX(r[2]), SY(r[3])); g.stroke(); if (r[4] === 'swing') { g.fillStyle = '#6b5a4a'; g.beginPath(); g.arc(SX(r[0]), SY(r[1]), 0.8 * s, 0, TAU); g.fill(); } }   /* Chomp Chomp's ropes: never hit, drawn plainly */
  for (const p of PROJ) {
    const x = SX(p.x), y = SY(p.y);
    if (p.kind === 'coal') { g.fillStyle = 'rgba(255,150,50,.3)'; g.beginPath(); g.arc(x, y, p.r * 2 * s, 0, TAU); g.fill(); g.beginPath(); for (let k = 0; k < 7; k++) { const a2 = k / 7 * TAU, r = p.r * s * (k % 2 ? 0.85 : 1); g.lineTo(x + Math.cos(a2) * r, y + Math.sin(a2) * r); } g.closePath(); g.fillStyle = '#ff8a2a'; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#ffe6a0'; g.beginPath(); g.arc(x - p.r * 0.2 * s, y - p.r * 0.2 * s, p.r * 0.35 * s, 0, TAU); g.fill(); continue; }
    if (p.kind === 'ant') { g.save(); g.translate(x, y); g.scale(p.face * s / 3, s / 3); g.fillStyle = '#c2402a'; g.strokeStyle = OL; g.lineWidth = 0.9; for (const [ex, er] of [[-4, 3], [0, 2.2], [4, 2.8]]) { g.beginPath(); g.arc(ex, 0, er, 0, TAU); g.fill(); g.stroke(); } g.beginPath(); for (const lx of [-2, 0, 2]) { g.moveTo(lx, 1); g.lineTo(lx - 1.5 + Math.sin(frame * 0.6 + lx) * 1.2, 4); } g.stroke(); g.restore(); continue; }
    if (p.kind === 'ember' || p.kind === 'flame') {
      const fl = p.kind === 'flame' ? 1 + Math.sin(frame * 0.5) * 0.25 : 1; g.fillStyle = 'rgba(255,170,60,.35)'; g.beginPath(); g.arc(x, y, p.r * 1.8 * s, 0, TAU); g.fill();
      g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(x, y - (fl - 1) * 2 * s, p.r * 0.7 * s, p.r * 0.9 * s * fl, 0, 0, TAU); g.fill(); g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x, y, p.r * 0.35 * s, 0, TAU); g.fill();
    } else if (p.kind === 'shaker') { g.save(); g.translate(x, y); g.rotate(frame * 0.4 * p.face); g.fillStyle = '#e9eef3'; g.strokeStyle = OL; g.lineWidth = 0.25 * s; g.fillRect(-0.45 * s, -0.8 * s, 0.9 * s, 1.6 * s); g.strokeRect(-0.45 * s, -0.8 * s, 0.9 * s, 1.6 * s); g.fillStyle = '#5a8fd8'; g.fillRect(-0.45 * s, -0.2 * s, 0.9 * s, 0.5 * s); g.restore();
    } else if (p.kind === 'bolt') { g.strokeStyle = '#ffe8a3'; g.lineWidth = 1.4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 3 * s * p.face, y); g.lineTo(x + 2 * s * p.face, y); g.stroke(); g.lineCap = 'butt'; }
    else if (p.kind === 'tape') { g.beginPath(); g.arc(x, y, p.r * s, 0, TAU); g.fillStyle = '#d9c24a'; g.fill(); g.strokeStyle = '#4a4d57'; g.lineWidth = 0.5 * s; g.stroke(); g.beginPath(); g.moveTo(x - Math.cos(p.rot || 0) * p.r * s, y + Math.sin(p.rot || 0) * p.r * s); g.lineTo(x + Math.cos(p.rot || 0) * p.r * s, y - Math.sin(p.rot || 0) * p.r * s); g.stroke(); }
    else if (p.kind === 'gust') { g.strokeStyle = 'rgba(240,220,255,.7)'; g.lineWidth = 0.7 * s; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(x - k * 2 * s, y + k * 3 * s, 3 * s, -1 + frame * 0.2, 1.4 + frame * 0.2); g.stroke(); } }
    else { g.save(); g.translate(x, y); g.rotate(p.rot || 0); g.fillStyle = '#8d8794'; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r = p.r * s * (k % 2 ? 0.85 : 1); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = '#4c4855'; g.lineWidth = 2; g.stroke(); g.restore(); }
  }
}
function drawFx(three) {
  g.lineCap = 'round';
  for (const p of three ? [] : PART) {   /* in 3D the sparks are drawn in the scene instead */
    g.globalAlpha = Math.min(1, p.life / 12); const x = SX(p.x), y = SY(p.y), sp = Math.hypot(p.vx, p.vy);
    if (sp > 0.25) { g.strokeStyle = p.col; g.lineWidth = p.r * cam.s; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * 2.4 * cam.s, y + p.vy * 2.4 * cam.s); g.stroke(); }
    else { g.fillStyle = p.col; g.beginPath(); g.arc(x, y, p.r * cam.s, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1; g.textAlign = 'center'; g.font = 'bold 22px system-ui, sans-serif';
  for (const p of POPS) { g.globalAlpha = Math.min(1, p.life / 20); g.fillStyle = p.col; g.fillText(p.text, SX(p.x), SY(p.y)); } g.globalAlpha = 1;
}
function movePhase(f) {
  const m = f.move; if (f.state !== 'attack' || !m) return '';
  if (!m.h.length) return 'special';
  const a0 = Math.min(...m.h.map(h => h.f0)), a1 = Math.max(...m.h.map(h => h.f1));
  return f.mf < a0 ? 'startup' : f.mf <= a1 ? 'ACTIVE' : 'recovery';
}
function drawDebug() {
  if (!DBG.boxes) return; const s = cam.s; g.lineWidth = 1.5;
  for (const f of F) {
    if (f.state === 'dead') continue; const st = f.st;
    const hr = hurtRect(f); g.strokeStyle = f.invuln > 0 ? '#55ccff' : '#ffee00'; g.strokeRect(SX(hr[0]), SY(hr[3]), (hr[2] - hr[0]) * s, (hr[3] - hr[1]) * s);
    if (f.state === 'attack' && f.move) for (const h of f.move.h) if (f.mf >= h.f0 && f.mf <= h.f1) {
      g.fillStyle = h.grab ? 'rgba(200,80,255,.45)' : 'rgba(255,40,40,.45)'; g.strokeStyle = h.grab ? '#cc55ff' : '#ff3333';
      for (const c of hitCircles(f, h, 0)) { g.beginPath(); g.arc(SX(c[0]), SY(c[1]), c[2] * s, 0, TAU); g.fill(); g.stroke(); }
    }
  }
  for (const p of PROJ) { g.fillStyle = 'rgba(255,40,40,.35)'; g.strokeStyle = '#ff3333'; g.beginPath(); g.arc(SX(p.x), SY(p.y), p.r * s, 0, TAU); g.fill(); g.stroke(); }
  g.strokeStyle = 'rgba(120,255,160,.8)'; g.beginPath(); for (const p of PLATS) { g.moveTo(SX(p.x0), SY(p.y)); g.lineTo(SX(p.x1), SY(p.y)); }
  /* the island's solid outline: rim, shoulder, and the rock tapering to its point */
  g.moveTo(SX(EDGE), SY(0)); for (const q of [[EDGE, -RIM], [EDGE - SHOULDER_IN, -SHOULDER], [0, -DEPTH], [-(EDGE - SHOULDER_IN), -SHOULDER], [-EDGE, -RIM], [-EDGE, 0]]) g.lineTo(SX(q[0]), SY(q[1]));
  g.stroke();
}
const SHK = { x: 0, y: 0 };
function draw() {
  fit(); g.setTransform(RS, 0, 0, RS, 0, 0);
  const three = !!(DBG.r3d && window.R3 && window.R3.ready);
  if (window.R3) window.R3.show(three);
  if (mode === 'select') {   /* start screen: over the live island in 3D, over the stage picture otherwise */
    SHK.x = SHK.y = 0; if (three) g.clearRect(0, 0, W, H); drawSelect(three); if (typeof drawMoveList === 'function') drawMoveList(); if (three) window.R3.render(); return;
  }
  if (typeof finalT !== 'undefined' && finalT > 0 && FINAL && typeof drawFinal === 'function') {   /* the final hit: frozen on the red screen, no HUD (finalhit.js) */
    SHK.x = SHK.y = 0; if (drawFinal(three)) { if (three) window.R3.render(); return; } }
  if (three) g.clearRect(0, 0, W, H);
  SHK.x = shake > 0 ? (Math.random() - 0.5) * shake : 0; SHK.y = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  g.save(); g.translate(SHK.x, SHK.y);
  if (!three) { drawBg(); drawStage(); drawProj(); }
  if (!three) for (const f of F) if (f.sling) { g.save(); g.translate(SX(f.sling.x), SY(f.sling.y)); g.scale(cam.s * f.sling.face, -cam.s); fowlSling2d(); g.restore(); }   /* the empty slingshot, waiting */
  for (const f of F) drawFighter(f, three); drawFx(three); drawDebug(); g.restore(); drawHud(); drawCombo(); drawFowlWheel(); drawDebugText(); if (typeof drawMoveList === 'function') drawMoveList();
  if (three) window.R3.render();
}

