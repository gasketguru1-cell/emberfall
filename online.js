'use strict';
/* ---------- Online: host or join a friend's match (desktop build only) ----------
   The desktop app (desktop/) gives the page window.desktop with its network transports. In a plain browser there is no
   window.desktop and nothing here shows. Flow: pick a fighter, HOST MATCH shows a code, the friend types it into JOIN MATCH,
   both machines start the same match together and net.js keeps them in step.
   Messages before the match: {t:'hello', pick, v} from the joiner, {t:'welcome', pick, v} from the host, then {t:'go'}. */
(function () {
  const D = window.desktop; if (!D) return;
  const VERSION = 'emberfall-net-1';   /* both copies must run the same game: a mismatch is refused */
  const css = `#online-btn{position:fixed;right:18px;bottom:18px;z-index:20;font:700 15px system-ui;padding:10px 18px;border-radius:10px;border:2px solid #ffb35c;background:#1b1530;color:#ffd9a8;cursor:pointer}
  #online{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(6,8,16,.78);font:15px system-ui;color:#eee}
  #online .box{background:#171b2e;border:1px solid #3b4370;border-radius:14px;padding:22px 26px;width:min(460px,92vw)}
  #online h2{margin:0 0 12px;font-size:20px;color:#ffd9a8}#online button{font:700 15px system-ui;padding:9px 16px;margin:6px 8px 6px 0;border-radius:9px;border:1px solid #6b74b0;background:#262c4a;color:#fff;cursor:pointer}
  #online button.main{background:#ff8a3c;border-color:#ff8a3c;color:#1a0f05}#online select,#online input{font:15px system-ui;padding:7px 9px;border-radius:8px;border:1px solid #4a5280;background:#0f1222;color:#fff;margin:4px 0}
  #online .code{font:800 30px ui-monospace,monospace;letter-spacing:4px;color:#9be564;margin:8px 0;user-select:all}#online .st{min-height:22px;color:#aab3e6;margin-top:8px}#online .small{font-size:12px;color:#8890b8}#online button:focus,#online select:focus,#online input:focus{outline:3px solid #ffd27a;outline-offset:2px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'online-btn'; btn.textContent = 'ONLINE'; document.body.appendChild(btn);
  const ov = document.createElement('div'); ov.id = 'online'; document.body.appendChild(ov);
  const opts = ROSTER.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
  ov.innerHTML = `<div class="box"><h2>Play a friend online</h2>
    <div>Your fighter <select id="on-pick">${opts}</select></div>
    <div>Connection <select id="on-via"></select></div>
    <div><button class="main" id="on-host">HOST MATCH</button><button id="on-join">JOIN MATCH</button><button id="on-close">Close</button></div>
    <div id="on-joinrow" style="display:none"><input id="on-code" placeholder="code from your friend" size="24"> <button class="main" id="on-go">Join</button></div>
    <div id="on-codebox" style="display:none">Send your friend this code:<div class="code" id="on-codev"></div></div>
    <div class="st" id="on-st"></div><div class="small" id="on-net">Controller: up / down to move, left / right to change, A to choose, B to go back.</div></div>`;
  const $ = id => document.getElementById(id), status = s => { $('on-st').textContent = s; };
  const open = () => { $('on-via').innerHTML = D.getTransports().map(t => `<option value="${t.id}">${t.label}</option>`).join(''); ov.style.display = 'flex'; UI_MODAL = true; padNav.start(); setTimeout(() => $('on-host').focus(), 0); };
  const close = () => { ov.style.display = 'none'; UI_MODAL = false; padNav.stop(); kb.hide(); if (link && !NET.session()) { link.close(); link = null; } };
  btn.onclick = open; window.openOnline = open;   /* the start screen's Online pill (sim.js) calls this, so a controller can open it */
  $('on-close').onclick = close;
  btn.style.display = 'block'; setInterval(() => { btn.style.display = mode === 'select' && !NET.session() ? 'block' : 'none'; if (NET.session()) netLine(); }, 250);
  /* ---- a controller drives this screen: up / down move between the controls, left / right change a choice, A presses,
     B goes back (or closes). The join code is typed on an on-screen keypad of the code's own letters. ---- */
  const kbBox = document.createElement('div'); kbBox.id = 'on-kb'; kbBox.style.cssText = 'display:none;margin-top:10px;display:none;grid-template-columns:repeat(8,1fr);gap:6px';
  ov.querySelector('.box').appendChild(kbBox);
  const KEYS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').concat(['⌫', 'OK']);
  kbBox.innerHTML = KEYS.map((k, i) => `<button data-k="${k}" style="margin:0;padding:8px 0;${k.length > 1 ? 'grid-column:span 4' : ''}">${k}</button>`).join('');
  const kb = { on: false, at: 0,
    show() { kb.on = true; kbBox.style.display = 'grid'; kb.at = 0; kb.focus(); },
    hide() { kb.on = false; kbBox.style.display = 'none'; },
    focus() { kbBox.children[kb.at].focus(); },
    press(k) { const inp = $('on-code'); let v = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (k === '⌫') v = v.slice(0, -1); else if (k === 'OK') { kb.hide(); $('on-go').focus(); return; } else if (v.length < 10) v += k;
      inp.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v; } };
  kbBox.addEventListener('click', e => { const k = e.target.dataset && e.target.dataset.k; if (k) { kb.press(k); if (kb.on) kb.focus(); } });
  $('on-code').addEventListener('focus', () => { if (padNav.active && !kb.on) kb.show(); });
  const padNav = { timer: 0, prev: null, active: false, rep: 0,
    start() { if (padNav.timer) return; padNav.prev = null; padNav.timer = setInterval(padNav.tick, 16); },
    stop() { clearInterval(padNav.timer); padNav.timer = 0; },
    read() { const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; const i = blankIn();
      for (const p of pads) { const r = readPad(p.index); for (const k of ['atk', 'spc', 'start']) i[k] = i[k] || r[k]; if (Math.abs(r.lx) > Math.abs(i.lx)) i.lx = r.lx; if (Math.abs(r.ly) > Math.abs(i.ly)) i.ly = r.ly; }
      return i; },
    tick() {
      const i = padNav.read(), p = padNav.prev || i; padNav.prev = i;
      const dir = Math.abs(i.ly) > 0.6 ? (i.ly > 0 ? 'up' : 'down') : Math.abs(i.lx) > 0.6 ? (i.lx > 0 ? 'right' : 'left') : '';
      const was = Math.abs(p.ly) > 0.6 ? (p.ly > 0 ? 'up' : 'down') : Math.abs(p.lx) > 0.6 ? (p.lx > 0 ? 'right' : 'left') : '';
      let move = ''; if (dir && dir !== was) { move = dir; padNav.rep = 20; } else if (dir && --padNav.rep <= 0) { move = dir; padNav.rep = 6; }   /* held: repeats */
      const a = i.atk && !p.atk, b = i.spc && !p.spc;
      if (move || a || b) padNav.active = true;
      if (kb.on) {   /* the code keypad: 8 across */
        const n = KEYS.length, col = kb.at < 32 ? kb.at % 8 : (kb.at === 32 ? 0 : 4);
        if (move === 'left') kb.at = Math.max(0, kb.at - 1); if (move === 'right') kb.at = Math.min(n - 1, kb.at + 1);
        if (move === 'up') kb.at = kb.at >= 32 ? 24 + col : Math.max(0, kb.at - 8); if (move === 'down') kb.at = kb.at >= 24 ? (kb.at >= 32 ? kb.at : (col < 4 ? 32 : 33)) : kb.at + 8;
        if (move) kb.focus(); if (a) { kb.press(KEYS[kb.at]); if (kb.on) kb.focus(); } if (b) { kb.hide(); $('on-go').focus(); }
        return;
      }
      const list = [...ov.querySelectorAll('select, button, input')].filter(el => el.offsetParent !== null && el.closest('#on-kb') === null);
      let k = list.indexOf(document.activeElement); if (k < 0) { k = 0; list[0] && list[0].focus(); }
      const el = list[k];
      if (move === 'down' || move === 'up') { const nk = (k + (move === 'down' ? 1 : -1) + list.length) % list.length; list[nk].focus(); }
      if ((move === 'left' || move === 'right') && el && el.tagName === 'SELECT') { const d = move === 'right' ? 1 : -1; el.selectedIndex = (el.selectedIndex + d + el.options.length) % el.options.length; el.dispatchEvent(new Event('change')); }
      if (a && el) { if (el.tagName === 'BUTTON') el.click(); else if (el.tagName === 'INPUT') kb.show(); else if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; } }
      if (b) close();
    } };
  window.__onlineNav = { tick: () => padNav.tick() };   /* lets a test step the controller reading without waiting on timers */
  let link = null;
  function via() { const ts = D.getTransports(); return ts.find(t => t.id === $('on-via').value) || ts[0]; }
  $('on-host').onclick = async () => {
    try {
      $('on-joinrow').style.display = 'none'; status('Opening a match...');
      link = await via().host(); $('on-codev').textContent = link.code; $('on-codebox').style.display = 'block'; status('Waiting for your friend to join...');
      link.onMessage(m => {
        if (m.t !== 'hello') return;
        if (m.v !== VERSION) { link.send({ t: 'refuse', why: 'different game versions' }); status('Your friend has a different version of the game.'); return; }
        link.send({ t: 'welcome', pick: +$('on-pick').value, v: VERSION }); begin(0, +$('on-pick').value, m.pick);
      });
    } catch (e) { status('Could not host: ' + e.message); }
  };
  $('on-join').onclick = () => { $('on-codebox').style.display = 'none'; $('on-joinrow').style.display = 'block'; $('on-code').focus(); if (padNav.active) kb.show(); };   /* with a controller, straight to the keypad */
  $('on-go').onclick = async () => {
    try {
      status('Connecting...'); link = await via().join($('on-code').value.trim());
      link.onMessage(m => { if (m.t === 'welcome') begin(1, m.pick, +$('on-pick').value); else if (m.t === 'refuse') status('The host refused: ' + m.why); });
      const hello = () => { if (!NET.session() && link) { link.send({ t: 'hello', pick: +$('on-pick').value, v: VERSION }); setTimeout(hello, 500); } }; hello();   /* repeated until answered: packets can be lost */
    } catch (e) { status('Could not join: ' + e.message); }
  };
  /* both machines: the same match, then the netcode takes over the loop (main.js calls NET.tick) */
  function begin(me, pick0, pick1) {
    if (NET.session()) return;
    ov.style.display = 'none'; UI_MODAL = false; padNav.stop(); kb.hide();
    TRAINING = false; slots[0] = { dev: 'kb', pick: pick0, ready: true }; slots[1] = { dev: 'kb', pick: pick1, ready: true }; startMatch();
    for (const f of F) f.ctl = new Ctl('cpu');
    const local = () => { const k = readKb(), pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [], p = pads.length ? readPad(pads[0].index) : null;
      if (!p) return k; for (const key in k) if (typeof k[key] === 'boolean') k[key] = k[key] || p[key]; if (Math.abs(p.lx) > Math.abs(k.lx)) k.lx = p.lx; if (Math.abs(p.ly) > Math.abs(k.ly)) k.ly = p.ly; if (Math.abs(p.cx) > Math.abs(k.cx)) k.cx = p.cx; if (Math.abs(p.cy) > Math.abs(k.cy)) k.cy = p.cy; return k; };
    NET.start(me, link, { local });
    link.onMessage(m => { if (m.t === 'hello' && me === 0) link.send({ t: 'welcome', pick: pick0, v: VERSION }); });   /* a late repeat of hello: answer again, harmless */
  }
  /* connection quality, shown in the corner during an online match */
  const line = document.createElement('div'); line.style.cssText = 'position:fixed;left:12px;bottom:8px;z-index:20;font:12px ui-monospace,monospace;color:#9aa3d6;pointer-events:none'; document.body.appendChild(line);
  function netLine() { const s = NET.session(); if (!s) { line.textContent = ''; return; } const t = s.stats; line.textContent = `online · ping ${t.lastRtt} ms · rollbacks ${t.rollbacks} (deepest ${t.maxDepth}) · waits ${t.waits}` + (s.desync ? ' · DESYNC at frame ' + s.desync.frame : ''); }
  setInterval(() => { if (!NET.session()) line.textContent = ''; }, 500);
})();
