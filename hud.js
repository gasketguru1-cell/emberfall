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
    g.textAlign = 'left'; g.font = 'bold 16px system-ui, sans-serif'; g.fillStyle = pc; g.fillText((f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1)) + '  ' + f.def.name, x - 102, y + 22);
    for (let k = 0; k < f.stocks; k++) { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x - 96 + k * 18, y + 40, 6, 0, TAU); g.fill(); }
    if (f.def.forms.length > 1) f.def.forms.forEach((fm, k) => { g.fillStyle = k === f.fi ? '#fff' : 'rgba(255,255,255,.35)'; g.font = (k === f.fi ? 'bold ' : '') + '12px system-ui, sans-serif'; g.fillText(fm.name, x - 102 + k * 42, y + 64); });
    g.textAlign = 'right'; g.font = 'bold 44px system-ui, sans-serif'; g.fillStyle = pctCol(f.pct); const jx = f.flash > 0 ? (Math.random() - 0.5) * 6 : 0; g.fillText(Math.round(f.pct) + '%', x + 106 + jx, y + 52);
  });
  /* the finishing hit: cinema bars while the game runs slow */
  if (typeof slowT !== 'undefined' && slowT > 0) { const k = Math.min(1, slowT / 10); g.fillStyle = 'rgba(0,0,0,' + (0.82 * k).toFixed(2) + ')'; g.fillRect(0, 0, W, 64 * k); g.fillRect(0, H - 64 * k, W, 64 * k); }
  g.textAlign = 'center';
  if (mode === 'countdown') { const n = countdown > 130 ? '3' : countdown > 90 ? '2' : countdown > 50 ? '1' : 'GO!'; big(n, H * 0.42, 110); }
  if (paused) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H); big('PAUSED', H * 0.45, 80); }
  if (mode === 'over') { big(overT < 90 ? 'GAME!' : result, H * 0.42, 100); if (overT > 100) { g.font = '22px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('Press Start or Attack', W / 2, H * 0.42 + 56); } }
}
function big(t, y, sz) { g.font = `900 ${sz}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#1a1230'; g.strokeText(t, W / 2, y); g.fillStyle = '#ffd98a'; g.fillText(t, W / 2, y); }
function drawSelect() {
  const sv = { x: cam.x, y: cam.y, s: cam.s }; cam.x = 0; cam.y = 30; cam.s = 3.4; drawBg(); Object.assign(cam, sv);
  g.fillStyle = 'rgba(8,8,18,.55)'; g.fillRect(0, 0, W, H);
  big('EMBERFALL', 110, 84); g.font = '22px system-ui, sans-serif'; g.fillStyle = '#f6e7c1'; g.fillText('3 stocks  ·  8 minutes', W / 2, 150);
  for (let k = 0; k < 2; k++) {
    const sl = slots[k], x = W / 2 + (k ? 40 : -480), y = 190, pc = k ? '#6cb4ff' : '#ff7b6c';
    g.fillStyle = 'rgba(15,15,30,.75)'; rr(x, y, 440, 330, 16); g.fill(); g.strokeStyle = pc; g.lineWidth = 3; g.stroke();
    g.textAlign = 'left'; g.font = 'bold 24px system-ui, sans-serif'; g.fillStyle = pc; g.fillText('PLAYER ' + (k + 1), x + 24, y + 40);
    g.textAlign = 'center';
    if (!sl) { g.font = '20px system-ui, sans-serif'; g.fillStyle = '#ddd'; g.fillText(k && slots[0] ? 'Press Attack to join' : 'Press Attack to join', x + 220, y + 160); if (k) { g.fillStyle = '#999'; g.fillText('(empty = CPU opponent)', x + 220, y + 192); } continue; }
    g.textAlign = 'right'; g.font = '18px system-ui, sans-serif'; g.fillStyle = '#ccc'; g.fillText(devName(sl.dev) + (sl.dev !== 'kb' ? (LAYOUT[sl.dev] === 'labels' ? '  ·  A/B by label' : '  ·  A/B by position') : '') + '  ·  tap jump ' + (TAPJUMP[sl.dev] ? 'on' : 'off'), x + 416, y + 40);
    if (sl.dev !== 'kb') { g.font = '12px system-ui, sans-serif'; g.fillStyle = '#888'; g.fillText(padInfo(+sl.dev.slice(3)).slice(0, 46), x + 416, y + 58); }
    g.textAlign = 'center';
    const d = ROSTER[sl.pick]; g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('‹  ' + d.name + '  ›', x + 220, y + 100);
    g.font = '18px system-ui, sans-serif'; g.fillStyle = '#f6e7c1'; g.fillText(d.sub, x + 220, y + 128);
    d.forms.forEach((fm, q) => { g.save(); g.translate(x + 220 + (q - (d.forms.length - 1) / 2) * 120, y + 250); g.scale(6, -6); ART[fm.name](k && slots[0] && slots[0].pick === sl.pick ? fm.alt : fm.col, frame, null); g.restore(); if (d.forms.length > 1) { g.font = '15px system-ui, sans-serif'; g.fillStyle = '#ccc'; g.fillText(fm.name, x + 220 + (q - 1) * 120, y + 276); } });
    g.font = 'bold 22px system-ui, sans-serif'; g.fillStyle = sl.ready ? '#9be564' : '#ffd98a'; g.fillText(sl.ready ? 'READY' : 'Left / Right to choose, Attack to confirm', x + 220, y + 312);
  }
  g.textAlign = 'center'; g.font = 'bold 22px system-ui, sans-serif'; g.fillStyle = '#fff';
  if (slots[0] && slots[0].ready && (!slots[1] || slots[1].ready)) g.fillText('Press Start (Enter) to fight', W / 2, 556);
  g.font = '15px system-ui, sans-serif'; g.fillStyle = '#cfc8e8';
  g.fillText("Controller: stick move · A attack · B special · X/Y jump · ZL/ZR shield · L/R grab · right stick smash · + start · − swaps the A/B layout", W / 2, 586);
  g.fillText("Keyboard: arrows move (Shift = walk) · Z attack · X special · C/V jump · Q/W shield · A/S grab · I J K L smash · Enter start", W / 2, 607);
  g.fillText("Jump then shield with a direction to wavedash · flick down to drop through platforms · release shield just before a hit to parry · mash to break a grab", W / 2, 628);
  g.fillText("Jump + attack together for a short-hop aerial · hold attack to chain jabs (Nib keeps a flurry going) · tilt the stick slightly up or down to angle a forward tilt", W / 2, 649);
  g.fillText("Grab out of a dash reaches further, out of a turn further still · jump on a head to spring off it · Nib can kick off the stage wall · shield just before a wall or the floor to tech", W / 2, 670);
  g.fillText("Jump button on this screen: tap jump on or off (flick up to jump) · the ledge protects longer after a long fall, less when damaged · above 100% getting up is slower", W / 2, 691);
  g.fillStyle = '#8f88aa'; g.fillText('Tools: B shows hitboxes · P freezes · O steps one frame · M switches 2D / 3D', W / 2, 712);
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
