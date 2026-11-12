'use strict';
/* Emberfall HUD and menus, drawn on the 2D canvas over whichever renderer is active. */
function pctCol(p) { const k = clamp(p / 150, 0, 1); return `rgb(255,${255 - k * 190 | 0},${255 - k * 215 | 0})`; }
function drawHud() {
  g.textAlign = 'center';
  const t = Math.max(0, Math.ceil(timer / 60)), mm = t / 60 | 0, ss = t % 60;
  g.font = 'bold 34px system-ui, sans-serif'; g.fillStyle = 'rgba(0,0,0,.45)'; rr(W / 2 - 62, 12, 124, 46, 10); g.fill(); g.fillStyle = timer < 1800 || sudden ? '#ff8a7a' : '#fff'; g.fillText(sudden ? 'SD' : mm + ':' + (ss < 10 ? '0' : '') + ss, W / 2, 47);
  F.forEach(f => {
    const x = W * (f.idx ? 0.68 : 0.32), y = H - 86, pc = f.idx ? '#6cb4ff' : '#ff7b6c';
    g.fillStyle = 'rgba(10,10,20,.6)'; rr(x - 120, y, 240, 74, 12); g.fill(); g.fillStyle = pc; rr(x - 120, y, 8, 74, 4); g.fill();
    g.textAlign = 'left'; g.font = 'bold 16px system-ui, sans-serif'; g.fillStyle = pc; g.fillText((f.ctl.dev === 'cpu' ? 'CPU ' + (f.ctl.ai.lv || CPU_LEVEL) : 'P' + (f.idx + 1)) + '  ' + f.def.name, x - 102, y + 22);
    if (f.stocks <= 5) for (let k = 0; k < f.stocks; k++) { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x - 96 + k * 18, y + 40, 6, 0, TAU); g.fill(); }
    else { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x - 96, y + 40, 6, 0, TAU); g.fill(); g.font = 'bold 14px system-ui, sans-serif'; g.fillText('× ' + f.stocks, x - 84, y + 45); }   /* many stocks: one dot and the count */
    if (f.def.transform) drawIntensity(f, x, y);
    if (f.form && f.form.knell) drawThread(f, x, y);
    else if (f.def.forms.length > 1) f.def.forms.slice(0, f.def.cycle || 99).forEach((fm, k) => { g.fillStyle = k === f.fi % (f.def.cycle || 99) ? '#fff' : 'rgba(255,255,255,.35)'; g.font = (k === f.fi % (f.def.cycle || 99) ? 'bold ' : '') + '12px system-ui, sans-serif'; g.fillText(fm.label || fm.name, x - 102 + k * 42, y + 64); });
    g.textAlign = 'right'; g.font = 'bold 44px system-ui, sans-serif'; g.fillStyle = pctCol(f.pct); const jx = f.flash > 0 ? (Math.random() - 0.5) * 6 : 0; g.fillText(Math.round(f.pct) + '%', x + 106 + jx, y + 52);
  });
  /* the finishing hit: cinema bars while the game runs slow */
  if (typeof slowT !== 'undefined' && slowT > 0) { const k = Math.min(1, slowT / 10); g.fillStyle = 'rgba(0,0,0,' + (0.82 * k).toFixed(2) + ')'; g.fillRect(0, 0, W, 64 * k); g.fillRect(0, H - 64 * k, W, 64 * k); }
  g.textAlign = 'center';
  if (mode === 'countdown') { const n = countdown > 130 ? '3' : countdown > 90 ? '2' : countdown > 50 ? '1' : 'GO!'; big(n, H * 0.42, 110); }
  if (paused && typeof drawPauseMenu === 'function') { if (!ML.open) drawPauseMenu(); }   /* movelist.js: Resume, Move List, Exit */
  else if (paused) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H); big('PAUSED', H * 0.42, 80); g.font = 'bold 20px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('Start: resume          Special: exit to fighter select          − or Backspace: controls', W / 2, H * 0.42 + 54); }
  drawCMenu();
  if (mode === 'over') { big(overT < 90 ? 'GAME!' : result, H * 0.42, 100); if (overT > 100) { g.font = '22px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('Press Start or Attack', W / 2, H * 0.42 + 56); drawUpdateNote(H * 0.42 + 80); } }
}
/* Knell's Thread: up to five gold notches in his damage panel, lit when held (also at his feet in the game) */
function drawThread(f, x, y) {
  for (let k = 0; k < KN.max; k++) { const nx = x - 102 + k * 19, ny = y + 54; g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + 16, ny); g.lineTo(nx + 12, ny + 9); g.lineTo(nx + 4, ny + 9); g.closePath();
    g.fillStyle = k < f.thread ? '#ffd166' : 'rgba(255,209,102,.16)'; g.fill(); g.strokeStyle = 'rgba(255,209,102,.6)'; g.lineWidth = 1; g.stroke(); }
  if (f.clinkUntil >= frame) { g.font = 'bold 11px system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#ffd166'; g.fillText('CLINK', x - 52, y + 63); }
}
/* Joey's INTENSITY: looks like a power gauge, is really how tired he is. A big bar sitting on top of his damage panel:
   red into orange into white-hot, with moving shine, a kick when it jumps, and flames, shaking and a glow near the top.
   It starts a size up from the panel and swells as it fills (growing up and out from the panel's top edge), and gets
   louder as it goes: a pulsing aura from 40%, a flaring leading edge, flames, boiling fill and rising embers from 50%,
   heat shake and crackling arcs near the top, a shock ring each time it jumps. Full, it turns cool blue: TAKE FIVE,
   then CATCHING BREATH with the 15 seconds draining. Gone once he transforms.
   HUD_INT keeps only what the drawing needs (the last value, a flash timer, the eased size, the embers), off the fighter,
   so the game state is untouched. */
const HUD_INT = [{ k: 0, pop: 0, s: 1.3, ring: 0, em: [] }, { k: 0, pop: 0, s: 1.3, ring: 0, em: [] }];
const INT_SIZE = [1.3, 1.85];   /* the bar's scale empty and full (1 = the panel's width); 1.85 keeps two Joeys' bars apart */
function drawIntensity(f, x, y) {
  if (f.tfLatch) { g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.textAlign = 'left'; g.fillText('CRONKY DONG', x - 102, y + 64); return; }
  const ex = f.exStart >= 0, e = ex ? frame - f.exStart : 0, k = ex ? Math.max(0, 900 - e) / 900 : f.fat / FAT.max, m = HUD_INT[f.idx & 1];
  if (!ex && k > m.k + 0.004) { m.pop = 1; m.ring = 1; } m.k = k; m.pop = Math.max(0, m.pop - 0.06); m.ring = Math.max(0, m.ring - 0.045);
  /* size: eased toward its target, with a little overshoot kick when it jumps */
  const heat = ex ? 0 : k, target = INT_SIZE[0] + (INT_SIZE[1] - INT_SIZE[0]) * (ex ? 0.35 : Math.pow(k, 0.85)) + m.pop * 0.06 * (0.5 + k);
  m.s += (target - m.s) * 0.18;
  const hot = !ex && k >= 0.8, bw = 240, bh = 30, sh = (hot ? (k - 0.8) * 20 : 0) + (!ex && k > 0.6 ? (k - 0.6) * 4 : 0), ax = x, ay = y - 8;
  const bx = x - 120 + (Math.random() - 0.5) * sh, by = y - 42 + (Math.random() - 0.5) * sh, fw = bw * k;
  g.save();
  g.translate(ax, ay); g.scale(m.s, m.s); g.translate(-ax, -ay);   /* grows from the middle of the panel's top edge */
  /* the aura: a soft pulsing glow behind the bar from 40%, wider and hotter as it climbs */
  if (heat > 0.4) {
    const a = (heat - 0.4) / 0.6, pul = 0.75 + 0.25 * Math.sin(tick * (0.15 + a * 0.35)), cx = bx + Math.max(fw, 40) * 0.6, cy = by + bh / 2, rad = 70 + 110 * a * pul;
    const ag = g.createRadialGradient(cx, cy, 4, cx, cy, rad); ag.addColorStop(0, 'rgba(255,' + (150 + 90 * a | 0) + ',60,' + (0.55 * a * pul).toFixed(2) + ')'); ag.addColorStop(0.5, 'rgba(255,90,20,' + (0.25 * a * pul).toFixed(2) + ')'); ag.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = ag; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  /* the shock ring when it jumps */
  if (m.ring > 0 && fw > 0) { const r = (1 - m.ring) * (40 + 60 * heat); g.strokeStyle = 'rgba(255,230,150,' + (m.ring * 0.8).toFixed(2) + ')'; g.lineWidth = 3 * m.ring + 1; g.beginPath(); g.ellipse(bx + fw, by + bh / 2, r + 6, (r + 6) * 0.55, 0, 0, TAU); g.stroke(); }
  /* the plate */
  g.shadowColor = ex ? 'rgba(120,180,230,.6)' : heat > 0.5 ? 'rgba(255,140,40,' + (0.5 + 0.5 * Math.sin(tick * (0.2 + heat * 0.3))).toFixed(2) + ')' : 'rgba(0,0,0,.5)'; g.shadowBlur = 10 + (ex ? 0 : 26 * Math.max(0, heat - 0.3));
  g.fillStyle = 'rgba(14,8,18,.85)'; rr(bx - 4, by - 4, bw + 8, bh + 8, 10); g.fill(); g.shadowBlur = 0;
  /* the rim: dull copper, warming to molten gold with a glint running round it */
  if (ex) g.strokeStyle = '#8fb7d6';
  else { const rg = g.createLinearGradient(bx - 4, 0, bx + bw + 4, 0), t = 0.1 + 0.8 * ((tick * 0.02) % 1), c0 = heat > 0.5 ? '#ffcf5a' : heat > 0.25 ? '#8a4a2c' : '#6a3a2a', c1 = heat > 0.5 ? '#fff6c8' : '#c87a4a';
    rg.addColorStop(0, c0); rg.addColorStop(t - 0.1, c0); rg.addColorStop(t, c1); rg.addColorStop(t + 0.1, c0); rg.addColorStop(1, c0); g.strokeStyle = rg; }
  g.lineWidth = 2 + (ex ? 0 : heat * 1.5); rr(bx - 4, by - 4, bw + 8, bh + 8, 10); g.stroke();
  /* the fill, clipped to the bar */
  g.save(); rr(bx, by, bw, bh, 7); g.clip();
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(bx, by, bw, bh);
  if (fw > 0) {
    const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
    if (ex) { gr.addColorStop(0, '#2c5a86'); gr.addColorStop(1, '#a9d6f5'); }
    else { gr.addColorStop(0, '#7a1410'); gr.addColorStop(0.45, '#e0441e'); gr.addColorStop(0.75, '#ff9a2a'); gr.addColorStop(0.92, '#ffe27a'); gr.addColorStop(1, '#fffbe8'); }
    g.fillStyle = gr; g.fillRect(bx, by, fw, bh);
    /* moving diagonal shine */
    g.save(); g.beginPath(); g.rect(bx, by, fw, bh); g.clip(); g.fillStyle = 'rgba(255,255,255,' + (ex ? 0.08 : 0.16) + ')';
    const off = (tick * (ex ? 0.6 : 1.5 + k * 3)) % 28; for (let sx = bx - 28 + off; sx < bx + fw + 28; sx += 28) { g.beginPath(); g.moveTo(sx, by + bh); g.lineTo(sx + 12, by); g.lineTo(sx + 22, by); g.lineTo(sx + 10, by + bh); g.fill(); }
    /* past halfway the fill boils: bright blobs drifting through it */
    if (heat > 0.5) for (let q = 0; q < 6; q++) { const px = bx + ((q * 47 + tick * (1.2 + q * 0.3)) % Math.max(1, fw)), py = by + bh * (0.5 + 0.3 * Math.sin(tick * 0.07 + q * 2)), r = 8 + 4 * Math.sin(tick * 0.11 + q);
      const bg = g.createRadialGradient(px, py, 0, px, py, r); bg.addColorStop(0, 'rgba(255,250,210,' + ((heat - 0.5) * 1.1).toFixed(2) + ')'); bg.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = bg; g.fillRect(px - r, py - r, r * 2, r * 2); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(bx, by + 2, fw, 5);   /* top gloss */
    if (m.pop > 0) { g.fillStyle = 'rgba(255,255,255,' + (0.55 * m.pop).toFixed(2) + ')'; g.fillRect(bx, by, fw, bh); }   /* the kick when it jumps */
    g.fillStyle = '#fff'; g.fillRect(bx + fw - 2, by, 3, bh);   /* the leading edge */
  }
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let q = 1; q < 10; q++) g.fillRect(bx + bw * q / 10 - 1, by + bh - 8, 2, 8);   /* tenths */
  g.restore();
  /* the leading edge flares: a white-hot star where the fill ends, bigger as it climbs */
  if (!ex && fw > 0 && heat > 0.3) { const sx = bx + fw, sy = by + bh / 2, r = (10 + 26 * heat) * (0.85 + 0.15 * Math.sin(tick * 0.5));
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, r); sg.addColorStop(0, 'rgba(255,255,240,.95)'); sg.addColorStop(0.3, 'rgba(255,220,120,.6)'); sg.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = sg; g.fillRect(sx - r, sy - r, r * 2, r * 2);
    g.strokeStyle = 'rgba(255,250,220,' + (0.5 * heat).toFixed(2) + ')'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx - r * 1.3, sy); g.lineTo(sx + r * 1.3, sy); g.moveTo(sx, sy - r); g.lineTo(sx, sy + r); g.stroke(); }
  /* flames off the top of the fill: from halfway, taller and spread wider as it climbs */
  if (!ex && heat >= 0.5 && fw > 0) {
    const a = (heat - 0.5) / 0.5, n = 6 + (a * 10 | 0);
    for (let q = 0; q < n; q++) { const fx = bx + fw * (1 - (0.7 * a + 0.2) * q / Math.max(1, n - 1)), fl = (6 + 34 * a) * (0.6 + 0.4 * Math.sin(tick * 0.5 + q * 1.7)) * (0.7 + Math.random() * 0.3), wd = 5 + 3 * a;
      g.fillStyle = q % 3 === 0 ? 'rgba(255,245,200,.85)' : q % 2 ? 'rgba(255,200,70,.85)' : 'rgba(255,110,30,.8)'; g.beginPath(); g.moveTo(fx - wd, by + 2); g.quadraticCurveTo(fx - 2, by - fl * 0.5, fx + (Math.random() - 0.5) * 4, by - fl); g.quadraticCurveTo(fx + 2, by - fl * 0.5, fx + wd, by + 2); g.fill(); }
  }
  /* embers rising off the bar from halfway, more and faster the higher it is */
  if (!ex && heat > 0.5 && fw > 0 && m.em.length < 60 && Math.random() < (heat - 0.5) * 2.4) for (let q = 0; q < 1 + (heat > 0.85 ? 2 : 0); q++) m.em.push({ x: bx + Math.random() * fw, y: by, vx: (Math.random() - 0.5) * 1.2, vy: -(1 + Math.random() * 2.5 * heat), life: 1, r: 1 + Math.random() * 2 });
  for (let q = m.em.length - 1; q >= 0; q--) { const p = m.em[q]; p.x += p.vx + Math.sin(tick * 0.2 + q) * 0.3; p.y += p.vy; p.life -= 0.025; if (p.life <= 0 || ex) { m.em.splice(q, 1); continue; }
    g.fillStyle = 'rgba(255,' + (160 + 90 * p.life | 0) + ',' + (60 * p.life | 0) + ',' + p.life.toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, TAU); g.fill(); }
  /* crackling arcs jumping off the plate near the top */
  if (hot && Math.random() < (k - 0.8) * 4) { g.strokeStyle = 'rgba(255,250,210,.9)'; g.lineWidth = 1.5; g.shadowColor = '#ffd27a'; g.shadowBlur = 8;
    for (let q = 0; q < 2; q++) { let px = bx + Math.random() * bw, py = Math.random() < 0.5 ? by - 4 : by + bh + 4; const dir = py < by ? -1 : 1; g.beginPath(); g.moveTo(px, py);
      for (let j = 0; j < 4; j++) { px += (Math.random() - 0.5) * 14; py += dir * (4 + Math.random() * 6); g.lineTo(px, py); } g.stroke(); }
    g.shadowBlur = 0; }
  /* words */
  const label = ex ? (e < 90 ? 'TAKE FIVE!' : 'CATCHING BREATH') : k >= 0.95 ? 'MAXED OUT!' : heat >= 0.8 ? 'RED HOT!' : heat >= 0.5 ? 'HEATING UP!' : 'INTENSITY';
  const ls = 17 + (ex && e < 90 ? 3 : 0) + (heat >= 0.8 ? 2 * (1 + Math.sin(tick * 0.4)) : 0);
  g.textAlign = 'left'; g.font = 'italic 900 ' + ls.toFixed(0) + 'px system-ui, sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(20,8,10,.9)';
  g.strokeText(label, bx + 10, by + 22); g.fillStyle = ex ? '#e8f4ff' : k >= 0.95 && Math.sin(tick * 0.6) > 0 ? '#ffe27a' : '#fff'; g.fillText(label, bx + 10, by + 22);
  const num = ex ? ((900 - e) / 60).toFixed(1) + 's' : Math.round(k * 100) + '%', ns = 20 + m.pop * 8;
  g.textAlign = 'right'; g.font = '900 ' + ns.toFixed(0) + 'px system-ui, sans-serif'; g.strokeText(num, bx + bw - 8, by + 23); g.fillStyle = ex ? '#cfe4f5' : hot ? '#ffe27a' : '#ffd0a0'; g.fillText(num, bx + bw - 8, by + 23);
  g.restore();
}
function big(t, y, sz) { g.font = `900 ${sz}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#1a1230'; g.strokeText(t, W / 2, y); g.fillStyle = '#ffd98a'; g.fillText(t, W / 2, y); }
/* Between matches only: a newer finished version of the game is waiting on the server. */
function drawUpdateNote(y) {
  if (typeof UPDATE_READY === 'undefined' || !UPDATE_READY) return;
  g.textAlign = 'center'; g.font = 'bold 18px system-ui, sans-serif'; const t = 'A newer version is ready  ·  refresh this page (F5) to load it', w = g.measureText(t).width + 36;
  g.fillStyle = 'rgba(40,110,60,.92)'; rr(W / 2 - w / 2, y, w, 32, 16); g.fill(); g.fillStyle = '#eaffea'; g.fillText(t, W / 2, y + 22);
}
/* ---------- Start screen ----------
   In 3D the forge island is live behind it, with the chosen fighters standing on it (sim.js: selectPreview), so the middle
   of the screen is left clear. Without 3D the stage picture is the background and the fighters are drawn on their cards. */
const TITLE_ART = typeof Image !== 'undefined' ? new Image() : null; if (TITLE_ART) TITLE_ART.src = 'assets/stage/source/concept.webp';
const TIPS = [
  'Smash: flick the stick with attack, or press attack + special together. Keep attack held to charge it.',
  'Choose the CPU’s fighter: point at its token, press A to pick it up, and A again on a fighter to put it down.',
  'After a grab, push either stick to throw. Keep the stick still if you want to pummel first.',
  'Wren swaps companions with down + special: Nib is quick, Loom floats, Hod hits hard.',
  'Jump, then shield with a direction just as you leave the ground, to wavedash.',
  'Flick down to drop through a platform. Down while shielding on one drops through too.',
  'Let go of shield just before a hit lands to parry it.',
  'Jump + attack together gives a short-hop aerial. Two jump buttons pressed together always give a short hop.',
  'Reverse aerial rush: while running, pull back (or pull back as you jump) and you jump facing back but still sliding forward; forward + attack is a back air that keeps the speed.',
  'Push the right stick forward while dashing or running for a dash attack.',
  'B-reverse: just after pressing special, pull the stick the other way to turn round; in the air your drift turns round too.',
  'Flick down while falling to fast-fall. Flick the right stick down instead and the left stick stays free to steer.',
  'Change your buttons, keys and the volume on the controls screen: − on a controller, Backspace on the keyboard.',
  'Hold attack to chain jabs. Nib keeps a flurry going for as long as it is held.',
  'Tilt the stick slightly up or down to angle a forward tilt.',
  'You cannot run through an opponent: roll, jump, or hit your way past.',
  'A grab out of a dash reaches further, and out of a turn further still.',
  'Shield just before hitting a wall or the floor to tech. Nib can also kick off the island’s wall.',
  'Coming up from under the island slides you out to the ledge: there is no ceiling to hit.',
  'A worn shield leaves your head or feet open. Tilt the stick gently to move it.',
  'Flint’s down special and Wren’s swap hang in the air once each time you leave the ground.',
  'Back + attack out of a run turns and strikes. Jump on a head to spring off it.',
  'Above 100%, getting up from the ledge is slower and less protected.',
  'Keyboard tools: B hitboxes · G attack arcs · P freeze · O step one frame · M switch 2D / 3D.',
];
function spaced(px) { if ('letterSpacing' in g) g.letterSpacing = px + 'px'; }
/* A key cap with its action after it; returns the x where the next one starts. */
function keyHint(x, y, cap, action) {
  g.font = 'bold 12px system-ui, sans-serif'; const w = g.measureText(cap).width + 14;
  g.fillStyle = 'rgba(255,255,255,.12)'; rr(x, y - 13, w, 19, 5); g.fill(); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(cap, x + w / 2, y + 1);
  g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#cfc8e8'; g.fillText(action, x + w + 6, y + 1);
  return x + w + 6 + g.measureText(action).width + 16;
}
/* the cap of the button (or key) that does act for this player, from their own setup */
function actCap(dev, act) { const m = setupOf(dev).map; if (dev === 'kb') return m[act] ? keyName(m[act]) : '—'; const r = padRowsFor(dev).find(r => m[r[0]] === act); return r ? padCap(r[2], dev) : '—'; }
/* key hints ending at xr: measured first, then drawn left to right */
function hintsRight(xr, y, list) { let w = 0; for (const [cap, act] of list) { g.font = 'bold 12px system-ui, sans-serif'; w += g.measureText(cap).width + 20; g.font = '13px system-ui, sans-serif'; w += g.measureText(act).width + 16; } let x = xr - w + 16; for (const [cap, act] of list) x = keyHint(x, y, cap, act); }
let SEL_GO_T = 0;   /* frames since everyone got ready, for the banner sliding in */
/* The controls shown under the fighter select: whatever the keyboard's setup and the first controller's setup say right now. */
function legendRows() {
  const pd = allDevs().find(d => d !== 'kb') || 'pad0', pm = setupOf(pd).map, km = setupOf('kb').map, ps = pd;
  const pb = a => padRowsFor(pd).filter(r => pm[r[0]] === a).map(r => padCap(r[2], ps)).join(' / ') || '—';
  const kk = (...n) => n.map(x => km[x]).filter(Boolean).map(keyName).join(' / ') || '—';
  const four = (u, l, d, r) => km[u] + km[l] + km[d] + km[r] === 'ArrowUpArrowLeftArrowDownArrowRight' ? 'Arrows' : [u, l, d, r].map(x => keyName(km[x])).join(' ');
  return [['CONTROLLER', [['Stick', 'Move'], [pb('atk'), 'Attack'], [pb('spc'), 'Special'], [pb('jmp'), 'Jump'], [pb('shd'), 'Shield'], [pb('grb'), 'Grab'], ['R Stick', 'Tilt'], [padCap('+', ps), 'Start'], [padCap('−', ps), 'Controls']]],
          ['KEYBOARD', [[four('up', 'left', 'down', 'right'), 'Move'], [kk('atk'), 'Attack'], [kk('spc'), 'Special'], [kk('jmp', 'jmp2'), 'Jump'], [kk('shd', 'shd2'), 'Shield'], [kk('grb', 'grb2'), 'Grab'], [four('cu', 'cl', 'cd', 'cr'), 'Tilt'], [kk('walk'), 'Walk'], ['Enter', 'Start'], ['Bksp', 'Controls']]]];
}
/* The controls screen (sim.js: CMENU), over the fighter select or the pause screen. */
const ACT_COL = { mod: '#f2c14e', '': '#6d6885', atk: '#ff7b6c', spc: '#6cb4ff', jmp: '#9be564', shd: '#7fe3e0', grb: '#d59bff' };
function drawCMenu() {
  if (!CMENU) return; const m = CMENU, su = setupOf(m.dev), kb = su.type === 'kb', snd = m.page === 'sound', items = cmenuItems(), list = setupsFor(m.dev), ui = 'system-ui, sans-serif';
  g.save(); spaced(0); g.fillStyle = 'rgba(8,6,16,.8)'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(26,22,46,.98)'; rr(CM.x, CM.y, CM.w, CM.h, 18); g.fill(); g.strokeStyle = 'rgba(255,184,107,.55)'; g.lineWidth = 1.5; g.stroke();
  g.textAlign = 'left'; g.font = '900 26px ' + ui; g.fillStyle = '#ffd98a'; g.fillText(snd ? 'SOUND' : 'CONTROLS', CM.x + 30, CM.y + 44);
  const tw = g.measureText(snd ? 'SOUND' : 'CONTROLS').width; g.font = '16px ' + ui; g.fillStyle = '#cfc8e8'; g.fillText(devName(m.dev), CM.x + 44 + tw, CM.y + 43);
  g.fillStyle = 'rgba(255,255,255,.1)'; rr(CM.done[0], CM.done[1], CM.done[2], CM.done[3], 17); g.fill(); g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = '#fff'; g.fillText('Done', CM.done[0] + CM.done[2] / 2, CM.done[1] + 22);
  items.forEach((it, n) => {
    const [x, y, w, h] = it.box, on = n === m.row, my = y + h / 2 + 5;
    g.fillStyle = on ? 'rgba(255,217,138,.14)' : 'rgba(255,255,255,.05)'; rr(x, y, w, h, 8); g.fill(); if (on) { g.strokeStyle = '#ffd98a'; g.lineWidth = 2; g.stroke(); }
    if (it.kind === 'page') { g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = on ? '#fff' : '#ffd98a'; g.fillText(it.to === 'sound' ? '♪  Sound' : '‹  Controls', x + w / 2, my); }
    else if (it.kind === 'vol') {
      const S = SND.settings, off = S.mute[it.key], v = S[it.key], b = volBar(it.box);
      g.textAlign = 'left'; g.font = 'bold 17px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText(it.label, x + 18, my + 1);
      g.fillStyle = 'rgba(255,255,255,.12)'; rr(b[0], b[1], b[2], b[3], 8); g.fill();
      if (v > 0) { g.fillStyle = off ? '#6d6885' : '#ffb86b'; rr(b[0], b[1], Math.max(16, b[2] * v), b[3], 8); g.fill(); }
      g.fillStyle = off ? '#8f88ad' : '#fff'; g.beginPath(); g.arc(b[0] + b[2] * v, b[1] + b[3] / 2, 11, 0, TAU); g.fill();
      g.textAlign = 'right'; g.font = 'bold 15px ' + ui; g.fillStyle = off ? '#8f88ad' : '#fff'; g.fillText(Math.round(v * 100) + '%', b[0] - 16, my + 1);
      const px = x + w - 128; g.fillStyle = off ? '#ff7b6c' : 'rgba(255,255,255,.1)'; rr(px, y + 10, 112, h - 20, (h - 20) / 2); g.fill();
      g.textAlign = 'center'; g.font = 'bold 13px ' + ui; g.fillStyle = off ? '#1a1230' : '#d8d2ee'; g.fillText(off ? 'MUTED' : 'Mute', px + 56, my);
    } else if (it.kind === 'track') {
      const name = SND.trackName();
      g.textAlign = 'left'; g.font = 'bold 17px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText('Battle music', x + 18, my + 1);
      g.textAlign = 'center'; g.font = 'bold 18px ' + ui; g.fillStyle = '#fff'; g.fillText(name, x + w / 2 + 60, my + 2);
      const nw = g.measureText(name).width; g.fillStyle = '#ffd98a'; g.fillText('‹', x + w / 2 + 60 - nw / 2 - 24, my + 1); g.fillText('›', x + w / 2 + 60 + nw / 2 + 24, my + 1);
    }
    else if (it.kind === 'setup') {
      const name = su.name.replace(/\s+/g, ' ');
      g.textAlign = 'left'; g.font = 'bold 12px ' + ui; spaced(2); g.fillStyle = '#ffb86b'; g.fillText('SETUP', x + 16, my); spaced(0);
      g.textAlign = 'center'; g.font = 'bold 22px ' + ui; g.fillStyle = '#fff'; g.fillText(name, x + w / 2, my + 3);
      const nw = g.measureText(name).width; g.fillStyle = '#ffd98a'; g.fillText('‹', x + w / 2 - nw / 2 - 26, my + 2); g.fillText('›', x + w / 2 + nw / 2 + 26, my + 2);
      g.textAlign = 'right'; g.font = '13px ' + ui; g.fillStyle = '#b9b2d6'; g.fillText((su.fixed ? 'built-in' : su.touched ? 'your own' : 'your own, not changed yet') + '  ·  ' + (list.indexOf(su) + 1) + ' of ' + list.length, x + w - 16, my);
    } else if (it.kind === 'socd') { g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText('Left + right together:  ' + (SOCD.mode === 'last' ? 'last pressed wins' : 'neither (neutral)'), x + w / 2, my); }
    else if (it.kind === 'teach') { const q = padObj(m.dev), has = q && TAUGHT[q.id]; g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = on ? '#fff' : has ? '#9be564' : '#d8d2ee'; g.fillText(has ? 'Buttons taught ✓  (teach again)' : 'Teach this controller its buttons', x + w / 2, my); }
    else if (it.kind === 'reset') { g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText('Reset ' + su.name + ' to the standard layout', x + w / 2, my); }
    else {
      g.textAlign = 'left'; g.font = '15px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText(it.label, x + 14, my);
      if (kb) {
        const cap = on && m.capture, has = !!su.map[it.key], txt = cap ? 'press a key…' : keyName(su.map[it.key]); g.font = 'bold 14px ' + ui; const cw = Math.max(46, g.measureText(txt).width + 22);
        g.fillStyle = cap ? 'rgba(255,217,138,' + (0.65 + 0.3 * Math.sin(Date.now() / 110)).toFixed(2) + ')' : has ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)'; rr(x + w - cw - 8, y + 4, cw, h - 8, 6); g.fill();
        g.textAlign = 'center'; g.fillStyle = cap ? '#1a1230' : has ? '#fff' : '#6d6885'; g.fillText(txt, x + w - cw / 2 - 8, my);
      } else {
        const a = su.map[it.key] || '', cx = x + w - 96; g.fillStyle = ACT_COL[a]; g.globalAlpha = a ? 0.9 : 0.35; rr(cx - 56, y + 3, 112, h - 6, (h - 6) / 2); g.fill(); g.globalAlpha = 1;
        g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = a ? '#16121f' : '#e6e0f6'; g.fillText(ACT_NAME[a], cx, my);
        if (on) { g.font = 'bold 20px ' + ui; g.fillStyle = '#ffd98a'; g.fillText('‹', cx - 72, my + 1); g.fillText('›', cx + 72, my + 1); }
      }
    }
  });
  if (m.teach) {   /* teaching: one big question at a time */
    const t = m.teach, [, what, hint] = TEACH_STEPS[t.step], bx = CM.x + 30, by = CM.y + 124, bw = CM.w - 60, bh = 400;
    g.fillStyle = 'rgba(16,13,30,.97)'; rr(bx, by, bw, bh, 14); g.fill(); g.strokeStyle = '#ffd98a'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.font = 'bold 13px ' + ui; spaced(2); g.fillStyle = '#ffb86b'; g.fillText('TEACHING  ·  STEP ' + (t.step + 1) + ' OF ' + TEACH_STEPS.length, W / 2, by + 52); spaced(0);
    const ask = typeof TEACH_STEPS[t.step][0] === 'string' ? what : 'Press ' + what;
    g.font = '900 30px ' + ui; g.fillStyle = t.rel ? '#8f88ad' : '#fff'; g.fillText(t.rel ? 'Let go of everything…' : ask, W / 2, by + 150);
    g.font = '16px ' + ui; g.fillStyle = '#cfc8e8'; if (!t.rel && hint) g.fillText(hint, W / 2, by + 190);
    g.fillStyle = 'rgba(255,255,255,.1)'; rr(bx + 120, by + 250, bw - 240, 10, 5); g.fill(); g.fillStyle = '#ffb86b'; rr(bx + 120, by + 250, (bw - 240) * t.step / TEACH_STEPS.length, 10, 5); g.fill();
    g.font = '14px ' + ui; g.fillStyle = '#9d96b8'; g.fillText('No such button?  Press one you already taught to skip it.', W / 2, by + 310);
    g.fillText('Escape, Delete or a click stops without changing anything.', W / 2, by + 334);
  }
  if (m.noteT > 0) { g.globalAlpha = Math.min(1, m.noteT / 30); g.textAlign = 'center'; g.font = '14px ' + ui; g.fillStyle = '#ffd98a'; g.fillText(m.note, CM.x + CM.w / 2, CM.y + 542); g.globalAlpha = 1; }
  g.textAlign = 'center'; g.font = '13px ' + ui; g.fillStyle = '#8f88ad'; g.fillText(snd ? 'The music steps back by itself for heavy hits and KOs, and while the game is paused.' : 'Two jump buttons together: short hop   ·   Right stick down while falling: fast fall', CM.x + CM.w / 2, CM.y + 568);
  let hx = CM.x + (snd ? 190 : kb ? 96 : 250); const hy = CM.y + CM.h - 24;
  for (const [cap, act] of snd ? (kb ? [['↑ ↓', 'choose'], ['← →', 'quieter / louder'], ['Enter', 'mute'], ['Backspace', 'done'], ['Mouse', 'works too']] : [['Stick', 'choose'], ['← →', 'quieter / louder'], [padCap('A', m.dev), 'mute'], [padCap('B', m.dev), 'done']]) : kb ? [['↑ ↓ ← →', 'choose'], ['Enter', 'change a key'], ['Delete', 'clear it'], ['Backspace', 'done'], ['Mouse', 'works too']] : [['Stick', 'choose'], ['← →', 'change'], [padCap('Y', m.dev), 'set to nothing / forget'], [padCap('B', m.dev), 'done']]) hx = keyHint(hx, hy, cap, act) + 8;
  g.restore();
}
/* the forms the fighter select shows: Wren's companions, the first five Fowls; Joey only as himself (his other form is a surprise) */
function selForms(d) { return d.transform ? d.forms.slice(0, 1) : d.forms.slice(0, d.cycle || 99); }
function drawSelect(three) {
  const t = tick, PC = ['#ff7b6c', '#6cb4ff'], serif = '"Palatino Linotype", "Book Antiqua", Georgia, serif';
  /* ---- background (2D only; in 3D the live island shows through) ---- */
  if (!three) {
    if (TITLE_ART && TITLE_ART.complete && TITLE_ART.naturalWidth) { const k = Math.max(W / TITLE_ART.naturalWidth, H / TITLE_ART.naturalHeight), w = TITLE_ART.naturalWidth * k, h = TITLE_ART.naturalHeight * k; g.drawImage(TITLE_ART, (W - w) / 2, (H - h) / 2, w, h); }
    else { const sv = { x: cam.x, y: cam.y, s: cam.s }; cam.x = 0; cam.y = 30; cam.s = 3.4; drawBg(); Object.assign(cam, sv); }
  }
  /* shade the top and the bottom so the words read; the middle stays clear */
  let q = g.createLinearGradient(0, 0, 0, 250); q.addColorStop(0, 'rgba(14,10,26,.86)'); q.addColorStop(0.55, 'rgba(14,10,26,.42)'); q.addColorStop(1, 'rgba(14,10,26,0)'); g.fillStyle = q; g.fillRect(0, 0, W, 250);
  q = g.createLinearGradient(0, 390, 0, H); q.addColorStop(0, 'rgba(14,10,26,0)'); q.addColorStop(0.4, 'rgba(14,10,26,.72)'); q.addColorStop(1, 'rgba(14,10,26,.95)'); g.fillStyle = q; g.fillRect(0, 390, W, H - 390);

  /* ---- title ---- */
  g.textAlign = 'center'; g.font = '900 72px ' + serif; spaced(10);
  g.save(); g.shadowColor = 'rgba(255,130,40,.65)'; g.shadowBlur = 30 + Math.sin(t * 0.05) * 7;
  q = g.createLinearGradient(0, 56, 0, 112); q.addColorStop(0, '#fff6dc'); q.addColorStop(0.5, '#ffc56a'); q.addColorStop(1, '#f0702c');
  g.lineWidth = 6; g.strokeStyle = '#2a1410'; g.lineJoin = 'round'; g.strokeText('EMBERFALL', W / 2 + 5, 110); g.fillStyle = q; g.fillText('EMBERFALL', W / 2 + 5, 110); g.restore();
  g.font = 'bold 14px system-ui, sans-serif'; spaced(4); g.fillStyle = '#f3dfb6'; g.fillText(OPT.stocks + (OPT.stocks === 1 ? ' STOCK' : ' STOCKS') + '   ·   8 MINUTES   ·   ' + STAGES[OPT.stage].name.toUpperCase(), W / 2 + 2, 140); spaced(0);
  for (const dir of [-1, 1]) { q = g.createLinearGradient(W / 2 + dir * 250, 0, W / 2 + dir * 430, 0); q.addColorStop(0, 'rgba(255,170,90,.85)'); q.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = q; g.fillRect(dir > 0 ? W / 2 + 250 : W / 2 - 430, 134, 180, 2); }
  const pointed = b => (MOUSE && inBox(b, MOUSE.x, MOUSE.y)) || slots.some(p => p && p.cx !== undefined && inBox(b, p.cx, p.cy));

  /* ---- the roster: one portrait tile for each fighter, with each player's marker on the one they are on ---- */
  { const th = 124, y0 = 158, tw = rosterTile(0)[2];
    ROSTER.forEach((d, k) => { const x = rosterTile(k)[0], fm = selForms(d)[Math.floor(t / 170) % selForms(d).length], on = [0, 1].filter(q => slots[q] && slots[q].pick === k);
      q = g.createLinearGradient(0, y0, 0, y0 + th); q.addColorStop(0, 'rgba(46,38,72,.92)'); q.addColorStop(1, 'rgba(18,15,32,.94)'); g.fillStyle = q; rr(x, y0, tw, th, 10); g.fill();
      g.save(); rr(x, y0, tw, th, 10); g.clip(); g.fillStyle = fm.col[0]; g.globalAlpha = 0.16; g.beginPath(); g.arc(x + tw / 2, y0 + th * 0.62, tw * 0.46, 0, TAU); g.fill(); g.globalAlpha = 1;
      const k2 = Math.min(5.2, 74 / (fm.st.h + 3)); g.translate(x + tw / 2, y0 + th - 30); g.scale(k2, -k2); ART[fm.name](fm.col, frame + k * 30, null); g.restore();
      g.fillStyle = 'rgba(10,8,20,.82)'; rr(x, y0 + th - 26, tw, 26, 10); g.fill(); g.fillRect(x, y0 + th - 26, tw, 10);
      let fs = 14; g.font = 'bold 14px system-ui, sans-serif'; while (fs > 10 && g.measureText(d.name).width > tw - 10) { fs--; g.font = 'bold ' + fs + 'px system-ui, sans-serif'; }   /* long names shrink to fit */
      g.textAlign = 'center'; g.fillStyle = on.length ? '#fff' : '#d8d2ee'; g.fillText(d.name, x + tw / 2, y0 + th - 8);
      const hov = MOUSE && inBox(rosterTile(k), MOUSE.x, MOUSE.y);
      g.strokeStyle = hov ? 'rgba(255,217,138,.85)' : 'rgba(255,255,255,.14)'; g.lineWidth = hov ? 2 : 1; rr(x, y0, tw, th, 10); g.stroke();
      on.forEach((pk, m) => { const pc = PC[pk], sl = slots[pk], pulse = sl.ready ? 1 : 0.65 + 0.35 * Math.sin(t * 0.12 + pk); g.globalAlpha = pulse; g.strokeStyle = pc; g.lineWidth = 4; rr(x - 3 - m * 5, y0 - 3 - m * 5, tw + 6 + m * 10, th + 6 + m * 10, 12 + m * 3); g.stroke(); g.globalAlpha = 1;
        const bx = pk ? x + tw - 44 : x + 6; g.fillStyle = pc; rr(bx, y0 + 6, 38, 20, 10); g.fill(); g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#16121f'; g.fillText(sl.ready ? 'P' + (pk + 1) + ' ✓' : 'P' + (pk + 1), bx + 19, y0 + 20); });
    }); }

  /* ---- player cards ---- */
  for (let k = 0; k < 2; k++) {
    const sl = slots[k], cw = 460, ch = 158, x = k ? W - 44 - cw : 44, y = 446, pc = PC[k];
    g.fillStyle = 'rgba(20,17,36,.84)'; rr(x, y, cw, ch, 14); g.fill(); g.strokeStyle = sl && sl.ready ? '#9be564' : 'rgba(255,255,255,.14)'; g.lineWidth = sl && sl.ready ? 2.5 : 1; g.stroke();
    g.fillStyle = pc; rr(x, y + 14, 5, ch - 28, 2.5); g.fill();
    g.textAlign = 'left'; g.font = 'bold 13px system-ui, sans-serif'; spaced(3); g.fillStyle = pc; g.fillText(!sl && k ? 'PLAYER 2  /  CPU' : 'PLAYER ' + (k + 1), x + 24, y + 30); spaced(0);
    if (!sl) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.07);
      if (!k) { g.textAlign = 'center'; g.font = 'bold 26px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')'; g.fillText('Press Attack to join', x + cw / 2, y + 88);
        g.font = '14px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('Attack on a controller  ·  ' + keyName(setupOf('kb').map.atk) + ' on the keyboard', x + cw / 2, y + 116);
        g.font = '13px system-ui, sans-serif'; g.fillStyle = '#8f88ad'; g.fillText('or click a fighter', x + cw / 2, y + 138); continue; }
      /* empty second slot: the CPU, the spot its token rests on, and its level with − and + */
      g.font = 'bold 34px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('CPU', x + 24, y + 80);
      g.font = '15px system-ui, sans-serif'; g.fillStyle = '#d8d2ee'; g.fillText(CPU_LEVEL === 0 ? 'stands still, for testing' : CPU_PICK >= 0 ? 'plays ' + ROSTER[CPU_PICK].name : 'random fighter', x + 24, y + 106);
      { const [dx, dy] = CPU_DOCK, free = CPU_PICK >= 0 || CPU_TOK.drag; g.strokeStyle = 'rgba(201,195,220,' + (free ? 0.75 : 0.35) + ')'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(dx, dy, 22, 0, TAU); g.stroke(); g.setLineDash([]);
        g.textAlign = 'center'; g.font = '12px system-ui, sans-serif'; g.fillStyle = '#9d96b8'; g.fillText(free ? 'drop here for random' : 'drag to a fighter', dx, dy + 40); }
      { const m = CPU_LV.length - 1, cx = (CPU_MINUS[0] + CPU_PLUS[0] + CPU_PLUS[2]) / 2;
        g.textAlign = 'center'; g.font = 'bold 12px system-ui, sans-serif'; spaced(2); g.fillStyle = '#f3dfb6'; g.fillText('LEVEL', cx, y + 36); spaced(0);
        for (const [b, glyph, off] of [[CPU_MINUS, '−', CPU_LEVEL <= 0], [CPU_PLUS, '+', CPU_LEVEL >= m]]) { const hot = !off && pointed(b);
          g.fillStyle = hot ? 'rgba(255,217,138,.9)' : off ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)'; rr(b[0], b[1], b[2], b[3], 10); g.fill(); g.strokeStyle = off ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
          g.font = 'bold 26px system-ui, sans-serif'; g.fillStyle = hot ? '#1a1230' : off ? '#5a5570' : '#fff'; g.fillText(glyph, b[0] + b[2] / 2, b[1] + b[3] / 2 + 9); }
        g.font = '900 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(CPU_LEVEL), cx, CPU_MINUS[1] + 35);
        const bx = CPU_MINUS[0], bw = CPU_PLUS[0] + CPU_PLUS[2] - bx, sw = (bw - (m - 1) * 3) / m;
        for (let n = 1; n <= m; n++) { g.fillStyle = n <= CPU_LEVEL ? pc : 'rgba(255,255,255,.16)'; rr(bx + (n - 1) * (sw + 3), y + 100, sw, 7, 3); g.fill(); } }
      g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.3 * pulse).toFixed(2) + ')'; g.fillText('Another controller?  Press Attack to join', x + 24, y + 140);
      continue;
    }
    const d = ROSTER[sl.pick], same = k && slots[0] && slots[0].pick === sl.pick, nf = selForms(d).length;
    g.textAlign = 'right'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText(devName(sl.dev) + '  ·  ' + setupOf(sl.dev).name.replace(/\s+/g, ' '), x + cw - 20, y + 30);
    g.textAlign = 'left'; g.font = 'bold 44px ' + serif; g.fillStyle = '#fff'; g.fillText(d.name, x + 24, y + 84);
    g.font = 'italic 16px ' + serif; g.fillStyle = '#f3dfb6'; g.fillText(d.sub, x + 26, y + 110);
    if (nf > 1) {   /* the companions; in 3D the one standing on the island is lit */
      const now = Math.floor(t / 170) % nf; let fx = x + 26;
      selForms(d).forEach((fm, n) => { g.font = (three && n === now ? 'bold ' : '') + '13px system-ui, sans-serif'; const w = g.measureText(fm.label || fm.name).width + 18; g.fillStyle = three && n === now ? pc : 'rgba(255,255,255,.1)'; rr(fx, y + 120, w, 22, 11); g.fill(); g.fillStyle = three && n === now ? '#16121f' : '#d8d2ee'; g.textAlign = 'center'; g.fillText(fm.label || fm.name, fx + w / 2, y + 135); g.textAlign = 'left'; fx += w + 6; });
    }
    if (!three) selForms(d).forEach((fm, n, a) => { g.save(); g.translate(x + cw - 60 - (a.length - 1 - n) * 62, y + 112); g.scale(3.4, -3.4); ART[fm.name](same ? fm.alt : fm.col, frame, null); g.restore(); });
    /* what this player's buttons do now, with their own buttons on the caps */
    if (sl.ready) { g.fillStyle = '#9be564'; rr(x + cw - 108, y + 120, 88, 26, 13); g.fill(); g.font = 'bold 14px system-ui, sans-serif'; spaced(2); g.fillStyle = '#12200c'; g.textAlign = 'center'; g.fillText('READY', x + cw - 63, y + 138); spaced(0);
      if (nf === 1) hintsRight(x + cw - 120, y + 138, [[actCap(sl.dev, 'spc'), 'Change']]); }
    else if (nf < 4) hintsRight(x + cw - 20, y + 138, nf > 1 ? [[actCap(sl.dev, 'atk'), 'Pick']] : [[actCap(sl.dev, 'atk'), 'Pick'], [actCap(sl.dev, 'spc'), 'Leave'], [sl.dev === 'kb' ? '+' : padCap('+', sl.dev), 'Moves']]);
  }

  /* ---- the middle: READY TO FIGHT across the screen once everyone in is ready, or who is still choosing ---- */
  g.textAlign = 'center';
  if (selReady()) { SEL_GO_T++; const e = Math.min(1, SEL_GO_T / 12), ease = 1 - Math.pow(1 - e, 3), p = 0.5 + 0.5 * Math.sin(t * 0.09), [, by, , bh] = FIGHT_BAR, hot = pointed(FIGHT_BAR);
    g.save(); g.globalAlpha = ease; g.translate((1 - ease) * -W * 0.25, 0);
    q = g.createLinearGradient(0, 0, W, 0); q.addColorStop(0, 'rgba(239,109,42,0)'); q.addColorStop(0.2, 'rgba(239,109,42,.9)'); q.addColorStop(0.5, hot ? 'rgba(255,200,103,.98)' : 'rgba(255,178,82,.95)'); q.addColorStop(0.8, 'rgba(239,109,42,.9)'); q.addColorStop(1, 'rgba(239,109,42,0)');
    g.shadowColor = 'rgba(255,140,50,' + (0.45 + 0.4 * p).toFixed(2) + ')'; g.shadowBlur = 24; g.fillStyle = q; g.fillRect(0, by, W, bh); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,240,200,.75)'; g.fillRect(W * 0.15, by, W * 0.7, 2); g.fillRect(W * 0.15, by + bh - 2, W * 0.7, 2);
    g.font = 'italic 900 34px system-ui, sans-serif'; spaced(6); g.fillStyle = '#2a1208'; g.fillText('READY TO FIGHT', W / 2 + 3, by + 38); spaced(0);
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = 'rgba(42,18,8,.8)'; g.fillText((slots.some(q => q && q.dev !== 'kb') ? padCap('+', slots.find(q => q && q.dev !== 'kb').dev) + ' / Start' : 'Start') + '  ·  Enter  ·  or click here', W / 2, by + 56);
    g.restore(); }
  else { SEL_GO_T = 0; if (slots[0]) {
    const part = n => { const sl = slots[n]; return sl ? ['P' + (n + 1) + (sl.ready ? '  ready ✓' : '  choosing…'), sl.ready ? '#9be564' : PC[n]] : ['CPU  level ' + CPU_LEVEL, '#c9c3dc']; };
    const parts = [part(0), part(1)]; g.font = 'bold 14px system-ui, sans-serif'; const ws = parts.map(([s]) => g.measureText(s).width), tw = ws[0] + ws[1] + 44, bx = W / 2 - tw / 2;
    g.fillStyle = 'rgba(20,17,36,.78)'; rr(bx - 14, 378, tw + 28, 32, 16); g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.stroke();
    g.textAlign = 'left'; let px = bx; parts.forEach(([s, c], n) => { g.fillStyle = c; g.fillText(s, px, 399); px += ws[n]; if (!n) { g.fillStyle = '#6d6885'; g.fillText('·', px + 18, 399); px += 44; } }); g.textAlign = 'center'; } }
  /* ---- a short note when a switch changes ---- */
  if (SEL_TOAST) { const a = Math.min(1, SEL_TOAST.t / 6, (100 - SEL_TOAST.t) / 20); g.globalAlpha = Math.max(0, a); g.font = 'bold 15px system-ui, sans-serif'; const w = g.measureText(SEL_TOAST.text).width + 40;
    g.fillStyle = 'rgba(20,17,36,.92)'; rr(W / 2 - w / 2, 326, w, 30, 15); g.fill(); g.strokeStyle = SEL_TOAST.col; g.lineWidth = 2; g.stroke(); g.fillStyle = SEL_TOAST.col; g.textAlign = 'center'; g.fillText(SEL_TOAST.text, W / 2, 346); g.globalAlpha = 1; }

  /* ---- controls and a tip ---- */
  const px = 44, py = 620, pw = W - 88;
  g.fillStyle = 'rgba(12,10,22,.7)'; rr(px, py, pw, 88, 12); g.fill(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.stroke();
  const rows = legendRows();
  rows.forEach(([label, keys], r) => {
    const y = py + 24 + r * 26; g.textAlign = 'left'; g.font = 'bold 11px system-ui, sans-serif'; spaced(2); g.fillStyle = '#ffb86b'; g.fillText(label, px + 18, y + 1); spaced(0);
    let x = px + 126; for (const [cap, action] of keys) x = keyHint(x, y, cap, action);
  });
  const n = Math.floor(t / 420) % TIPS.length, ph = (t % 420) / 420, a = Math.min(1, ph * 8, (1 - ph) * 8);
  g.textAlign = 'left'; g.font = 'bold 11px system-ui, sans-serif'; spaced(2); g.fillStyle = '#ffb86b'; g.fillText('TIP', px + 18, py + 77); spaced(0);
  g.font = '14px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; g.fillText(TIPS[n].replace(/(press|and) A\b/g, (s, w) => w + ' ' + padCap('A')), px + 126, py + 77);

  /* ---- the bar along the top (sim.js: selChips): switches drawn as switches, buttons as buttons; what one does shows while it is pointed at ---- */
  let tip = null;
  for (const c of selChips()) { const [x, y, w, h] = c.box, hot = pointed(c.box), sw = c.on !== undefined;
    g.fillStyle = hot ? 'rgba(40,33,66,.92)' : 'rgba(20,17,36,.8)'; rr(x, y, w, h, h / 2); g.fill(); g.strokeStyle = hot || c.hot ? c.col : sw && c.on ? c.col + '88' : 'rgba(255,255,255,.16)'; g.lineWidth = hot || c.hot ? 2 : 1; g.stroke();
    g.font = (sw ? '' : 'bold ') + '13px system-ui, sans-serif';
    if (sw) { g.textAlign = 'left'; g.fillStyle = c.on ? '#fff' : '#cfc8e8'; g.fillText(c.label, x + 14, y + 21);
      g.fillStyle = c.on ? c.col : '#55506a'; rr(x + w - 50, y + 8, 36, 16, 8); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(c.on ? x + w - 22 : x + w - 42, y + 16, 6, 0, TAU); g.fill(); }
    else { g.textAlign = 'center'; g.fillStyle = c.col; g.fillText(c.label, x + w / 2, y + 21); }
    if (hot && !tip) tip = c; }
  if (tip) { g.font = '12px system-ui, sans-serif'; const w = g.measureText(tip.tip).width + 20, x = Math.max(8, Math.min(W - 8 - w, tip.box[0] + tip.box[2] / 2 - w / 2)), y = tip.box[1] + tip.box[3] + 6;
    g.fillStyle = 'rgba(10,8,20,.94)'; rr(x, y, w, 24, 6); g.fill(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.stroke(); g.textAlign = 'center'; g.fillStyle = '#e6e0f6'; g.fillText(tip.tip, x + w / 2, y + 16); }
  /* ---- each player's cursor: a round token with a pointer at its top left, where it points ---- */
  for (let k = 0; k < 2; k++) { const sl = slots[k]; if (!sl || sl.cx === undefined) continue; const x = sl.cx, y = sl.cy, pc = PC[k];
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.fillStyle = pc; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20, y + 7); g.lineTo(x + 7, y + 20); g.closePath(); g.fill();
    g.beginPath(); g.arc(x + 24, y + 24, 16, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 24, y + 24, 16, 0, TAU); g.stroke();
    g.textAlign = 'center'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = '#16121f'; g.fillText('P' + (k + 1), x + 24, y + 29); }
  /* ---- the CPU's token, while the second slot is the CPU: drag it with the mouse onto a fighter ---- */
  if (!slots[1]) { const x = CPU_TOK.x, y = CPU_TOK.y, lift = CPU_TOK.drag ? 4 : 0, hov = CPU_TOK.drag || (MOUSE && cpuTokOn(MOUSE.x, MOUSE.y)) || slots.some(q => q && q.cx !== undefined && cpuTokOn(q.cx, q.cy));
    if (CPU_PICK >= 0 && !CPU_TOK.drag) { const b = rosterTile(CPU_PICK); g.strokeStyle = '#c9c3dc'; g.lineWidth = 3; g.setLineDash([6, 5]); rr(b[0] - 2, b[1] - 2, b[2] + 4, b[3] + 4, 12); g.stroke(); g.setLineDash([]); }
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10 + lift * 2; g.shadowOffsetY = 2 + lift;
    g.fillStyle = '#c9c3dc'; g.beginPath(); g.moveTo(x, y - lift); g.lineTo(x + 20, y + 7 - lift); g.lineTo(x + 7, y + 20 - lift); g.closePath(); g.fill();
    g.beginPath(); g.arc(x + 24, y + 24 - lift, 18, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = hov ? '#ffd98a' : '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 24, y + 24 - lift, 18, 0, TAU); g.stroke();
    g.textAlign = 'center'; g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#16121f'; g.fillText('CPU', x + 24, y + 28 - lift); }
  drawOptButton();
  g.textAlign = 'center'; drawUpdateNote(290);
  drawOptions();
  drawCMenu();
}
/* the Options button at the top left of the fighter select (sim.js: OPT_PILL), lit while a cursor or the mouse is on it */
function drawOptButton() {
  const [x, y, w, h] = OPT_PILL, hot = OPT_UI.open || slots.some(q => q && q.cx !== undefined && inBox(OPT_PILL, q.cx, q.cy)) || (MOUSE && inBox(OPT_PILL, MOUSE.x, MOUSE.y));
  g.fillStyle = 'rgba(20,17,36,.8)'; rr(x, y, w, h, h / 2); g.fill(); g.strokeStyle = hot ? '#ffd166' : 'rgba(255,255,255,.16)'; g.lineWidth = hot ? 2 : 1; g.stroke();
  const cx = x + 22, cy = y + h / 2; g.fillStyle = '#ffd166'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r = k % 2 ? 6 : 9; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill();   /* a little cog */
  g.fillStyle = '#2a1208'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
  g.textAlign = 'left'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = '#ffe2a8'; g.fillText('Options', x + 42, y + 21);
}
/* the Options panel: Stocks and Stage, each with arrows; the Controllers box (what is plugged in, what kind it is, the setup
   it uses; A or a click opens its controls screen); Done */
const KIND_COL = { ps: '#5b8cff', nin: '#ff5a5a', joy: '#ff5a5a', gc: '#9b7bff', x: '#5fd068', kb: '#d9d3ee' };
function drawOptions() {
  if (!OPT_UI.open) return; const L = optLayout(), [px, py, pw, ph] = L.P;
  g.fillStyle = 'rgba(6,5,12,.62)'; g.fillRect(0, 0, W, H);
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 30; g.fillStyle = 'rgba(22,18,38,.97)'; rr(px, py, pw, ph, 18); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,209,102,.45)'; g.lineWidth = 2; rr(px, py, pw, ph, 18); g.stroke();
  g.textAlign = 'center'; g.font = '900 30px system-ui, sans-serif'; spaced(6); g.fillStyle = '#ffd98a'; g.fillText('OPTIONS', W / 2 + 3, py + 52); spaced(0);
  const vals = [[OPT.stocks + (OPT.stocks === 1 ? ' stock' : ' stocks'), 'per player, 1 to 99', OPT.stocks > 1, OPT.stocks < 99], [STAGES[OPT.stage].name, STAGES.length > 1 ? (OPT.stage + 1) + ' of ' + STAGES.length : 'the only stage, for now', STAGES.length > 1, STAGES.length > 1]];
  /* the Controllers box behind its rows */
  { const [cx, cy, cw, ch] = L.cbox; g.fillStyle = 'rgba(255,255,255,.03)'; rr(cx, cy, cw, ch, 14); g.fill(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; rr(cx, cy, cw, ch, 14); g.stroke();
    g.textAlign = 'left'; g.font = '900 13px system-ui, sans-serif'; spaced(3); g.fillStyle = '#ffd98a'; g.fillText('CONTROLLERS', cx + 14, cy + 24); spaced(0);
    g.textAlign = 'right'; g.font = '12px system-ui, sans-serif'; g.fillStyle = '#9d96b8'; g.fillText('what is plugged in  ·  A or a click: set up its buttons', cx + cw - 14, cy + 24); }
  L.rows.forEach((r, k) => { const [bx, by, bw, bh] = r.box, sel = OPT_UI.row === k;
    if (r.kind === 'done') { g.fillStyle = sel ? '#ffd166' : 'rgba(255,209,102,.18)'; rr(bx, by, bw, bh, 23); g.fill();
      g.textAlign = 'center'; g.font = 'bold 18px system-ui, sans-serif'; g.fillStyle = sel ? '#2a1208' : '#ffe2a8'; g.fillText('Done', bx + bw / 2, by + 30); return; }
    g.fillStyle = sel ? 'rgba(255,209,102,.13)' : 'rgba(255,255,255,.04)'; rr(bx, by, bw, bh, 12); g.fill(); if (sel) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; rr(bx, by, bw, bh, 12); g.stroke(); }
    const my = by + bh / 2;
    if (r.kind === 'stocks' || r.kind === 'stage') { const [val, sub, canL, canR] = vals[k];
      g.textAlign = 'left'; g.font = 'bold 20px system-ui, sans-serif'; g.fillStyle = sel ? '#fff' : '#d9d3ee'; g.fillText(k ? 'Stage' : 'Stocks', bx + 24, my + 7);
      for (const [b, d, on] of [[r.l, -1, canL], [r.r, 1, canR]]) { const [ax, ay, aw, ah] = b, mx = ax + aw / 2, ny = ay + ah / 2;
        g.fillStyle = on ? (sel ? '#ffd166' : 'rgba(255,209,102,.55)') : 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(mx + d * 9, ny); g.lineTo(mx - d * 7, ny - 11); g.lineTo(mx - d * 7, ny + 11); g.closePath(); g.fill(); }
      const vx = (r.l[0] + r.l[2] + r.r[0]) / 2; g.textAlign = 'center'; g.font = 'bold 21px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(val, vx, my + 2);
      g.font = '12px system-ui, sans-serif'; g.fillStyle = '#9d96b8'; g.fillText(sub, vx, my + 19); return; }
    let name, kind, right, col;
    if (r.kind === 'dev') {
      const d = r.dev, p = padObj(d), grp = d === 'kb' ? 'kb' : kindGroup(padKind(p)), su = setupOf(d), who = devPlayer(d);
      name = d === 'kb' ? 'Keyboard' : devName(d); col = KIND_COL[grp] || KIND_COL.x;
      kind = d === 'kb' ? 'and the mouse' : p && TAUGHT[p.id] ? 'buttons taught on the controls screen' : grp === 'x' && padKind(p) === 'other' ? (p.mapping === 'standard' ? 'read as a standard controller' : 'unknown layout: teach it its buttons') : 'buttons named its own way';
      right = (who ? who + '  ·  ' : '') + su.name + '   Set up ›';
    } else {
      const n = GCU.pads.filter(Boolean).length; name = 'GameCube adapter (Nintendo, USB)'; col = KIND_COL.gc;
      kind = GCU.dev ? 'connected  ·  ' + (n ? n + (n === 1 ? ' controller' : ' controllers') + ' in it' : 'nothing plugged into its ports') : GCU.err ? GCU.err : 'Windows needs the WinUSB driver on it first (Zadig, as for Dolphin)';
      right = GCU.dev ? 'Ports = controllers 5 to 8' : DESKTOP() ? 'Find it ›' : 'Connect ›';
    }
    const big = bh >= 36;
    g.fillStyle = col; g.beginPath(); g.arc(bx + 20, my, 6, 0, TAU); g.fill();
    g.textAlign = 'left'; g.font = 'bold ' + (big ? 16 : 14) + 'px system-ui, sans-serif'; g.fillStyle = sel ? '#fff' : '#e6e0f6'; g.fillText(name, bx + 36, big ? my - 2 : my + 5);
    if (big) { g.font = '12px system-ui, sans-serif'; g.fillStyle = GCU.err && r.kind === 'gcu' ? '#ff9b8a' : '#9d96b8'; g.fillText(kind, bx + 36, my + 14); }
    g.textAlign = 'right'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = sel ? '#ffd166' : '#b9b2d6'; g.fillText(right, bx + bw - 16, my + 5);
  });
  g.textAlign = 'center'; g.font = '12px system-ui, sans-serif'; g.fillStyle = '#9d96b8'; g.fillText('Stick or arrows: up / down picks, left / right changes   ·   A: change, set up or Done   ·   B or Start: close', W / 2, py + ph - 22);
}
/* Training: the true-combo counter at the top right, one panel per player who is landing hits. */
function drawCombo() {
  if (!TRAINING || !F.length || F.preview) return; let y = 16;
  g.save(); g.textAlign = 'right'; g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#9be564'; g.fillText('TRAINING  ·  no clock, endless stocks  ·  A + B + L resets', W - 18, y + 4); y += 12;
  for (const f of F) { const c = COMBO[f.idx]; if (!c || (!c.hits && !c.last && f.idx !== 0)) continue; const last = c.last || { hits: 0, dmg: 0 };   /* player 1's panel is always shown in training, from zero */ const pc = f.idx ? '#6cb4ff' : '#ff7b6c', live = c.hits > 0, n = live ? c.hits : last.hits, dm = live ? c.dmg : last.dmg, w = 230, x = W - 18 - w, fade = live ? 1 : Math.max(0.55, 1 - c.t / 240);
    g.globalAlpha = fade; g.fillStyle = 'rgba(14,10,26,.78)'; rr(x, y, w, 86, 12); g.fill(); g.fillStyle = pc; rr(x, y + 10, 4, 66, 2); g.fill();
    g.textAlign = 'left'; g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = pc; g.fillText((f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1)) + (live ? '  COMBO' : '  LAST COMBO'), x + 16, y + 20);
    g.font = '900 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(n), x + 16, y + 62); const nw = g.measureText(String(n)).width;
    g.font = 'bold 15px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.fillText(n === 1 ? 'hit' : 'hits', x + 22 + nw, y + 62);
    g.textAlign = 'right'; g.font = '900 26px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.fillText(dm.toFixed(1) + '%', x + w - 14, y + 50);
    g.font = '12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('damage dealt', x + w - 14, y + 66);
    if (c.best) { g.fillText('best ' + c.best.hits + ' hits, ' + c.best.dmg.toFixed(1) + '%', x + w - 14, y + 80); }
    g.globalAlpha = 1; y += 94; }
  /* Knell in training: the move's frame, the class of its dagger, the direction of the move he last linked (Thread comes from a different one), Thread and whether the Hinge is open */
  for (const f of F) { if (!f.form || !f.form.knell) continue; const m = f.state === 'attack' ? f.move : null, h = m && m.h && m.h.find(q => q.cl && f.mf >= q.f0 && f.mf <= q.f1), CL = { H: 'HIGH', M: 'MID', L: 'LOW' }, w = 230, x = W - 18 - w;
    const open = !!(m && m.hinge && f.knC && f.mf >= m.hinge[0] && f.mf <= m.hinge[1] && f.thread > 0);
    g.fillStyle = 'rgba(14,10,26,.78)'; rr(x, y, w, 70, 12); g.fill(); g.textAlign = 'left'; g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#ffd166'; g.fillText('KNELL  ·  Thread ' + f.thread + ' / ' + KN.max + (f.clinkUntil >= frame ? '  ·  CLINK' : ''), x + 14, y + 18);
    g.font = '12px system-ui, sans-serif'; g.fillStyle = '#e8e2f8'; g.fillText((m ? f.mname + '  frame ' + f.mf : f.state) + (h ? '  ·  ' + CL[h.cl] : ''), x + 14, y + 36);
    g.fillText('last ' + (f.knLast && frame <= f.knExp ? ({ n: 'NEUTRAL', f: 'FORWARD', u: 'UP', d: 'DOWN', b: 'BACK' }[f.knLast[0]] + (f.knLast[1] === 'H' ? ' HIGH' : f.knLast[1] === 'L' ? ' LOW' : '')) + ' (' + (f.knExp - frame) + ')' : '-') + '  ·  Hinge ' + (f.hingeUsed ? 'used' : open ? 'OPEN' : m && m.hinge ? 'window ' + m.hinge[0] + '-' + m.hinge[1] : 'ready'), x + 14, y + 54); y += 78; }
  g.restore();
}
function drawFowlWheel() {
  if (mode !== 'play' && mode !== 'countdown') return;
  for (const f of F) { if (!f.selOpen || !f.def.fowl || f.state !== 'attack' || !f.move || !f.move.sel) continue;   /* only while the selector itself is running */ const R = 92, r0 = 34;
    /* above the slingshot rather than over it, so the fighter stays in view, and kept on screen near the edges */
    const cx = clamp(SX(f.x), R + 8, W - R - 8), cy = clamp(SY(f.y + f.st.h) - R - 10, R + 8, H - R - 8);
    g.save(); g.globalAlpha = 0.95; for (let k = 0; k < 5; k++) { const a0 = -Math.PI / 2 + (k - 0.5) * Math.PI * 2 / 5 + 0.04, a1 = a0 + Math.PI * 2 / 5 - 0.08, fm = f.def.forms[k], on = k === f.selPick;
      g.beginPath(); g.arc(cx, cy, R, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fillStyle = on ? fm.col[0] : 'rgba(18,14,30,.82)'; g.fill(); g.strokeStyle = on ? '#fff' : fm.col[0]; g.lineWidth = on ? 3 : 1.5; g.stroke();
      const am = (a0 + a1) / 2, tx = cx + Math.cos(am) * (R + r0) / 2, ty = cy + Math.sin(am) * (R + r0) / 2; g.textAlign = 'center'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(fm.label || fm.name, tx, ty);
      g.font = '10px system-ui, sans-serif'; g.fillStyle = on ? '#fff' : '#cfc8e8'; g.fillText(fm.role || '', tx, ty + 13); }
    g.restore(); }
}
function drawDebugText() {
  if (!DBG.boxes && !DBG.step) return;
  const lines = ['frame ' + frame + (DBG.step ? '   FROZEN: O = next frame, P = resume' : '')];
  for (const f of F) {
    const m = f.state === 'attack' && f.move ? '  ' + f.mname + ' ' + f.mf + '/' + f.move.t + ' ' + movePhase(f) : '';
    lines.push((f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1)) + ' ' + f.form.name + '  ' + f.state + ' ' + f.sf + m + (f.hitlag ? '  hitlag ' + f.hitlag : '') + (f.state === 'hurt' ? '  hitstun ' + Math.max(0, f.hitstun - f.sf) : '') + (f.invuln ? '  invuln ' + f.invuln : ''));
  }
  const p = perf(); lines.push(p.avgMs + ' ms avg, worst ' + p.worstMs + ' ms, ' + p.slowFrames + '/' + p.frames + ' slow' + (window.R3 && window.R3.ready ? '   ' + (DBG.r3d ? '3D' : '2D') : '   2D'));
  g.font = '14px Consolas, monospace'; g.textAlign = 'left';
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(12, 70, 560, 14 + lines.length * 18);
  g.fillStyle = '#d7ffd9'; lines.forEach((t, k) => g.fillText(t, 22, 90 + k * 18));
}
