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
    for (let k = 0; k < f.stocks; k++) { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x - 96 + k * 18, y + 40, 6, 0, TAU); g.fill(); }
    if (f.def.forms.length > 1) f.def.forms.slice(0, f.def.cycle || 99).forEach((fm, k) => { g.fillStyle = k === f.fi % (f.def.cycle || 99) ? '#fff' : 'rgba(255,255,255,.35)'; g.font = (k === f.fi % (f.def.cycle || 99) ? 'bold ' : '') + '12px system-ui, sans-serif'; g.fillText(fm.label || fm.name, x - 102 + k * 42, y + 64); });
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
  'Flick down while falling to fast-fall. Flick the right stick down instead and the left stick stays free to steer.',
  'Change your buttons or keys on the controls screen: − on a controller, Backspace on the keyboard.',
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
/* The controls shown under the fighter select: whatever the keyboard's setup and the first controller's setup say right now. */
function legendRows() {
  const pm = setupOf(allDevs().find(d => d !== 'kb') || 'pad0').map, km = setupOf('kb').map;
  const pb = a => PAD_ROWS.filter(r => pm[r[0]] === a).map(r => r[2]).join(' / ') || '—';
  const kk = (...n) => n.map(x => km[x]).filter(Boolean).map(keyName).join(' / ') || '—';
  const four = (u, l, d, r) => km[u] + km[l] + km[d] + km[r] === 'ArrowUpArrowLeftArrowDownArrowRight' ? 'Arrows' : [u, l, d, r].map(x => keyName(km[x])).join(' ');
  return [['CONTROLLER', [['Stick', 'Move'], [pb('atk'), 'Attack'], [pb('spc'), 'Special'], [pb('jmp'), 'Jump'], [pb('shd'), 'Shield'], [pb('grb'), 'Grab'], ['R Stick', 'Tilt'], ['+', 'Start'], ['−', 'Controls']]],
          ['KEYBOARD', [[four('up', 'left', 'down', 'right'), 'Move'], [kk('atk'), 'Attack'], [kk('spc'), 'Special'], [kk('jmp', 'jmp2'), 'Jump'], [kk('shd', 'shd2'), 'Shield'], [kk('grb', 'grb2'), 'Grab'], [four('cu', 'cl', 'cd', 'cr'), 'Tilt'], [kk('walk'), 'Walk'], ['Enter', 'Start'], ['Bksp', 'Controls']]]];
}
/* The controls screen (sim.js: CMENU), over the fighter select or the pause screen. */
const ACT_COL = { '': '#6d6885', atk: '#ff7b6c', spc: '#6cb4ff', jmp: '#9be564', shd: '#7fe3e0', grb: '#d59bff' };
function drawCMenu() {
  if (!CMENU) return; const m = CMENU, su = setupOf(m.dev), kb = su.type === 'kb', items = cmenuItems(), list = setupsFor(m.dev), ui = 'system-ui, sans-serif';
  g.save(); spaced(0); g.fillStyle = 'rgba(8,6,16,.8)'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(26,22,46,.98)'; rr(CM.x, CM.y, CM.w, CM.h, 18); g.fill(); g.strokeStyle = 'rgba(255,184,107,.55)'; g.lineWidth = 1.5; g.stroke();
  g.textAlign = 'left'; g.font = '900 26px ' + ui; g.fillStyle = '#ffd98a'; g.fillText('CONTROLS', CM.x + 30, CM.y + 44);
  const tw = g.measureText('CONTROLS').width; g.font = '16px ' + ui; g.fillStyle = '#cfc8e8'; g.fillText(devName(m.dev), CM.x + 44 + tw, CM.y + 43);
  g.fillStyle = 'rgba(255,255,255,.1)'; rr(CM.done[0], CM.done[1], CM.done[2], CM.done[3], 17); g.fill(); g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = '#fff'; g.fillText('Done', CM.done[0] + CM.done[2] / 2, CM.done[1] + 22);
  items.forEach((it, n) => {
    const [x, y, w, h] = it.box, on = n === m.row, my = y + h / 2 + 5;
    g.fillStyle = on ? 'rgba(255,217,138,.14)' : 'rgba(255,255,255,.05)'; rr(x, y, w, h, 8); g.fill(); if (on) { g.strokeStyle = '#ffd98a'; g.lineWidth = 2; g.stroke(); }
    if (it.kind === 'setup') {
      const name = su.name.replace(/\s+/g, ' ');
      g.textAlign = 'left'; g.font = 'bold 12px ' + ui; spaced(2); g.fillStyle = '#ffb86b'; g.fillText('SETUP', x + 16, my); spaced(0);
      g.textAlign = 'center'; g.font = 'bold 22px ' + ui; g.fillStyle = '#fff'; g.fillText(name, x + w / 2, my + 3);
      const nw = g.measureText(name).width; g.fillStyle = '#ffd98a'; g.fillText('‹', x + w / 2 - nw / 2 - 26, my + 2); g.fillText('›', x + w / 2 + nw / 2 + 26, my + 2);
      g.textAlign = 'right'; g.font = '13px ' + ui; g.fillStyle = '#b9b2d6'; g.fillText((su.fixed ? 'built-in' : su.touched ? 'your own' : 'your own, not changed yet') + '  ·  ' + (list.indexOf(su) + 1) + ' of ' + list.length, x + w - 16, my);
    } else if (it.kind === 'reset') { g.textAlign = 'center'; g.font = 'bold 14px ' + ui; g.fillStyle = on ? '#fff' : '#d8d2ee'; g.fillText('Reset ' + su.name + ' to the standard layout', x + w / 2, my); }
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
  if (m.noteT > 0) { g.globalAlpha = Math.min(1, m.noteT / 30); g.textAlign = 'center'; g.font = '14px ' + ui; g.fillStyle = '#ffd98a'; g.fillText(m.note, CM.x + CM.w / 2, CM.y + 542); g.globalAlpha = 1; }
  g.textAlign = 'center'; g.font = '13px ' + ui; g.fillStyle = '#8f88ad'; g.fillText('Two jump buttons together: short hop   ·   Right stick down while falling: fast fall', CM.x + CM.w / 2, CM.y + 568);
  let hx = CM.x + (kb ? 96 : 250); const hy = CM.y + CM.h - 24;
  for (const [cap, act] of kb ? [['↑ ↓ ← →', 'choose'], ['Enter', 'change a key'], ['Delete', 'clear it'], ['Backspace', 'done'], ['Mouse', 'works too']] : [['Stick', 'choose'], ['← →', 'change'], ['Y', 'set to nothing'], ['B', 'done']]) hx = keyHint(hx, hy, cap, act) + 8;
  g.restore();
}
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
  g.textAlign = 'center'; g.font = '900 84px ' + serif; spaced(12);
  g.save(); g.shadowColor = 'rgba(255,130,40,.65)'; g.shadowBlur = 34 + Math.sin(t * 0.05) * 8;
  q = g.createLinearGradient(0, 40, 0, 112); q.addColorStop(0, '#fff6dc'); q.addColorStop(0.5, '#ffc56a'); q.addColorStop(1, '#f0702c');
  g.lineWidth = 7; g.strokeStyle = '#2a1410'; g.lineJoin = 'round'; g.strokeText('EMBERFALL', W / 2 + 6, 104); g.fillStyle = q; g.fillText('EMBERFALL', W / 2 + 6, 104); g.restore();
  g.font = 'bold 14px system-ui, sans-serif'; spaced(4); g.fillStyle = '#f3dfb6'; g.fillText('3 STOCKS   ·   8 MINUTES   ·   THE FORGE ISLE', W / 2 + 2, 138); spaced(0);
  for (const dir of [-1, 1]) { q = g.createLinearGradient(W / 2 + dir * 250, 0, W / 2 + dir * 430, 0); q.addColorStop(0, 'rgba(255,170,90,.85)'); q.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = q; g.fillRect(dir > 0 ? W / 2 + 250 : W / 2 - 430, 132, 180, 2); }

  /* ---- the roster: one portrait tile for each fighter, with each player's marker on the one they are on ---- */
  { const th = 124, y0 = 158, tw = rosterTile(0)[2];
    ROSTER.forEach((d, k) => { const x = rosterTile(k)[0], fm = d.forms[d.forms.length > 1 ? Math.floor(t / 170) % (d.cycle || d.forms.length) : 0], on = [0, 1].filter(q => slots[q] && slots[q].pick === k);
      q = g.createLinearGradient(0, y0, 0, y0 + th); q.addColorStop(0, 'rgba(46,38,72,.92)'); q.addColorStop(1, 'rgba(18,15,32,.94)'); g.fillStyle = q; rr(x, y0, tw, th, 10); g.fill();
      g.save(); rr(x, y0, tw, th, 10); g.clip(); g.fillStyle = fm.col[0]; g.globalAlpha = 0.16; g.beginPath(); g.arc(x + tw / 2, y0 + th * 0.62, tw * 0.46, 0, TAU); g.fill(); g.globalAlpha = 1;
      const k2 = Math.min(5.2, 74 / (fm.st.h + 3)); g.translate(x + tw / 2, y0 + th - 30); g.scale(k2, -k2); ART[fm.name](fm.col, frame + k * 30, null); g.restore();
      g.fillStyle = 'rgba(10,8,20,.82)'; rr(x, y0 + th - 26, tw, 26, 10); g.fill(); g.fillRect(x, y0 + th - 26, tw, 10);
      g.textAlign = 'center'; g.font = 'bold 14px system-ui, sans-serif'; g.fillStyle = on.length ? '#fff' : '#d8d2ee'; g.fillText(d.name, x + tw / 2, y0 + th - 8);
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; rr(x, y0, tw, th, 10); g.stroke();
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
      if (!k) { g.textAlign = 'center'; g.font = 'bold 26px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,' + pulse.toFixed(2) + ')'; g.fillText('Press Attack to join', x + cw / 2, y + 92); g.font = '14px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('Attack on a controller  ·  ' + keyName(setupOf('kb').map.atk) + ' on the keyboard', x + cw / 2, y + 120); continue; }
      /* empty second slot: the CPU and its level */
      g.font = 'bold 34px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('CPU', x + 24, y + 78);
      g.font = '15px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText(CPU_LEVEL === 0 ? 'level 0: stands still, for testing' : CPU_PICK >= 0 ? 'plays ' + ROSTER[CPU_PICK].name : 'drag its token to a fighter, or it picks at random', x + 24, y + 102);
      g.textAlign = 'right'; g.font = 'bold 13px system-ui, sans-serif'; spaced(2); g.fillStyle = '#f3dfb6'; g.fillText('LEVEL', x + cw - 86, y + 62); spaced(0);
      g.font = '900 44px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText(String(CPU_LEVEL), x + cw - 30, y + 74);
      for (let n = 1; n <= 9; n++) { g.fillStyle = n <= CPU_LEVEL ? pc : 'rgba(255,255,255,.16)'; rr(x + cw - 30 - (10 - n) * 21, y + 88, 17, 7, 3); g.fill(); }
      g.font = '13px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('point here: Attack raises, Special lowers', x + cw - 30, y + 116);
      g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.3 * pulse).toFixed(2) + ')'; g.fillText('or press Attack on another controller to join', x + 24, y + 140);
      continue;
    }
    const d = ROSTER[sl.pick], same = k && slots[0] && slots[0].pick === sl.pick;
    g.textAlign = 'right'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText(devName(sl.dev) + '  ·  ' + setupOf(sl.dev).name.replace(/\s+/g, ' '), x + cw - 20, y + 30);
    g.textAlign = 'left'; g.font = 'bold 44px ' + serif; g.fillStyle = '#fff'; g.fillText(d.name, x + 52, y + 84);
    const nw = g.measureText(d.name).width; g.font = 'bold 30px system-ui, sans-serif'; g.fillStyle = sl.ready ? 'rgba(255,255,255,.18)' : '#ffd98a'; g.fillText('‹', x + 24, y + 81); g.fillText('›', x + 62 + nw, y + 81);
    g.font = 'italic 16px ' + serif; g.fillStyle = '#f3dfb6'; g.fillText(d.sub, x + 26, y + 110);
    if (d.forms.length > 1) {   /* the companions; in 3D the one standing on the island is lit */
      const now = Math.floor(t / 170) % (d.cycle || d.forms.length); let fx = x + 26;
      d.forms.slice(0, d.cycle || 99).forEach((fm, n) => { g.font = (three && n === now ? 'bold ' : '') + '13px system-ui, sans-serif'; const w = g.measureText(fm.label || fm.name).width + 18; g.fillStyle = three && n === now ? pc : 'rgba(255,255,255,.1)'; rr(fx, y + 120, w, 22, 11); g.fill(); g.fillStyle = three && n === now ? '#16121f' : '#d8d2ee'; g.textAlign = 'center'; g.fillText(fm.label || fm.name, fx + w / 2, y + 135); g.textAlign = 'left'; fx += w + 6; });
    }
    if (!three) d.forms.slice(0, d.cycle || 99).forEach((fm, n) => { g.save(); g.translate(x + cw - 60 - (d.forms.length - 1 - n) * 62, y + 112); g.scale(3.4, -3.4); ART[fm.name](same ? fm.alt : fm.col, frame, null); g.restore(); });
    g.textAlign = 'right';
    if (sl.ready) { g.fillStyle = '#9be564'; rr(x + cw - 108, y + 118, 88, 26, 13); g.fill(); g.font = 'bold 14px system-ui, sans-serif'; spaced(2); g.fillStyle = '#12200c'; g.textAlign = 'center'; g.fillText('READY', x + cw - 63, y + 136); spaced(0); }
    else if ((three || d.forms.length === 1) && (d.cycle || d.forms.length) < 4) { g.font = '13px system-ui, sans-serif'; g.fillStyle = '#cfc8e8'; g.fillText('Point at a fighter  ·  Attack to pick', x + cw - 20, y + 136); }
  }

  /* ---- start prompt, between the cards ---- */
  g.textAlign = 'center';
  const go = slots[0] && slots[0].ready && (!slots[1] || slots[1].ready);
  if (go) {
    const p = 0.5 + 0.5 * Math.sin(t * 0.09), bw = 236, bx = W / 2 - bw / 2, by = 486;
    g.save(); g.shadowColor = 'rgba(255,140,50,' + (0.5 + 0.4 * p).toFixed(2) + ')'; g.shadowBlur = 26; q = g.createLinearGradient(0, by, 0, by + 56); q.addColorStop(0, '#ffc867'); q.addColorStop(1, '#ef6d2a'); g.fillStyle = q; rr(bx, by, bw, 56, 28); g.fill(); g.restore();
    g.font = '900 26px system-ui, sans-serif'; spaced(4); g.fillStyle = '#2a1208'; g.fillText('FIGHT', W / 2 + 2, by + 36); spaced(0);
    g.font = '13px system-ui, sans-serif'; g.fillStyle = '#f3dfb6'; g.fillText('Start on a controller  ·  Enter on the keyboard', W / 2, by + 80);
  } else if (slots[0]) { g.fillStyle = 'rgba(20,17,36,.72)'; rr(W / 2 - 108, 492, 216, 54, 14); g.fill(); g.font = '14px system-ui, sans-serif'; g.fillStyle = '#e6e0f6'; g.fillText('Point at a fighter,', W / 2, 515); g.fillText('then Attack to pick', W / 2, 535); }

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
  g.font = '14px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; g.fillText(TIPS[n], px + 126, py + 77);

  /* ---- hitbox switch (top right) and the note about a newer version (top middle) ---- */
  { const on = DBG.boxes, w = 214, x = W - 44 - w, y = 20;
    g.fillStyle = 'rgba(20,17,36,.8)'; rr(x - 36, y, w + 36, 34, 17); g.fill(); g.strokeStyle = on ? '#ff6a6a' : 'rgba(255,255,255,.16)'; g.lineWidth = on ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#e6e0f6'; g.font = '12px system-ui, sans-serif'; g.fillText('Show Hitboxes', x - 22, y + 22);
    g.fillStyle = on ? '#ff6a6a' : '#55506a'; rr(x + 80, y + 8, 40, 18, 9); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(on ? x + 111 : x + 89, y + 17, 6.5, 0, TAU); g.fill();
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('X / Y  or  B key', x + 130, y + 22); }
  { const on = TRAINING, w = 214, x = W - 44 - w, y = 100;   /* training mode switch */
    g.fillStyle = 'rgba(20,17,36,.8)'; rr(x, y, w, 34, 17); g.fill(); g.strokeStyle = on ? '#9be564' : 'rgba(255,255,255,.16)'; g.lineWidth = on ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#e6e0f6'; g.fillText('Training', x + 12, y + 22);
    g.fillStyle = on ? '#9be564' : '#55506a'; rr(x + 80, y + 8, 40, 18, 9); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(on ? x + 111 : x + 89, y + 17, 6.5, 0, TAU); g.fill();
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('point + A  or  T key', x + 128, y + 22); }
  { const on = DBG.fx, w = 214, x = W - 44 - w, y = 60;   /* hit effects switch: the sparks and flash where a hit lands */
    g.fillStyle = 'rgba(20,17,36,.8)'; rr(x, y, w, 34, 17); g.fill(); g.strokeStyle = on ? '#ffd166' : 'rgba(255,255,255,.16)'; g.lineWidth = on ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#e6e0f6'; g.fillText('Hit sparks', x + 12, y + 22);
    g.fillStyle = on ? '#ffd166' : '#55506a'; rr(x + 80, y + 8, 40, 18, 9); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(on ? x + 111 : x + 89, y + 17, 6.5, 0, TAU); g.fill();
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('Shield  or  H key', x + 128, y + 22); }
  { const on = DBG.arcs, w = 214, x = W - 44 - w, y = 140;   /* attack arcs switch: the circles and sweeps over an attack while it can hit */
    g.fillStyle = 'rgba(20,17,36,.8)'; rr(x, y, w, 34, 17); g.fill(); g.strokeStyle = on ? '#8fd3ff' : 'rgba(255,255,255,.16)'; g.lineWidth = on ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = '13px system-ui, sans-serif'; g.fillStyle = '#e6e0f6'; g.fillText('Attack arcs', x + 12, y + 22);
    g.fillStyle = on ? '#8fd3ff' : '#55506a'; rr(x + 80, y + 8, 40, 18, 9); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(on ? x + 111 : x + 89, y + 17, 6.5, 0, TAU); g.fill();
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText('point + A  or  G key', x + 128, y + 22); }
  if (DESKTOP()) for (const [box, label, hint, col, hot] of [[ONLINE_PILL, 'Online', 'point + A: host or join', '#ffb35c', false], [QUIT_PILL, QUIT_ASK > 0 ? 'Quit?' : 'Quit', QUIT_ASK > 0 ? 'press A again to quit' : 'point + A, twice', '#ff6a6a', QUIT_ASK > 0]]) {   /* desktop app: reachable with a controller's cursor */
    const [x, y, w] = box; g.fillStyle = 'rgba(20,17,36,.8)'; rr(x, y, w, 34, 17); g.fill(); g.strokeStyle = hot ? col : 'rgba(255,255,255,.16)'; g.lineWidth = hot ? 2 : 1; g.stroke();
    g.textAlign = 'left'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = col; g.fillText(label, x + 12, y + 22);
    g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.fillText(hint, x + 80, y + 22); }
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
  g.textAlign = 'center'; drawUpdateNote(14);
  drawCMenu();
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
