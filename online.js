'use strict';
/* ---------- Online: host or join a friend's match (desktop build only) ----------
   The desktop app (desktop/) gives the page window.desktop with its network transports. In a plain browser there is no
   window.desktop and nothing here shows. Flow: HOST MATCH shows a code, the friend types it into JOIN MATCH, and the two
   are linked. From then on each picks a fighter on the regular fighter select. Whoever is ready first plays a warm-up
   against the CPU; when both are ready the same match starts on both machines with the regular countdown and net.js keeps
   them in step. When it ends both are back on the fighter select, still linked: a rematch is the default.
   Messages: {t:'hello', v} from the joiner until {t:'welcome', v} from the host; then both send {t:'lobby', ready, pick,
   last, inMatch, stocks, stage} a few times a second; the host sends {t:'start', n, p0, p1, stocks, stage} (its own stocks
   and stage: the host alone decides them); a match's packets carry g: its number; {t:'bye'} on leaving. */
(function () {
  const D = window.desktop; if (!D) return;
  const VERSION = 'emberfall-net-2';   /* both copies must run the same game: a mismatch is refused */
  const css = `#online-btn{position:fixed;right:18px;bottom:18px;z-index:20;font:700 15px system-ui;padding:10px 18px;border-radius:10px;border:2px solid #ffb35c;background:#1b1530;color:#ffd9a8;cursor:pointer}
  #online{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(6,8,16,.78);font:15px system-ui;color:#eee}
  #online .box{background:#171b2e;border:1px solid #3b4370;border-radius:14px;padding:22px 26px;width:min(460px,92vw)}
  #online h2{margin:0 0 12px;font-size:20px;color:#ffd9a8}#online button{font:700 15px system-ui;padding:9px 16px;margin:6px 8px 6px 0;border-radius:9px;border:1px solid #6b74b0;background:#262c4a;color:#fff;cursor:pointer}
  #online button.main{background:#ff8a3c;border-color:#ff8a3c;color:#1a0f05}#online select,#online input{font:15px system-ui;padding:7px 9px;border-radius:8px;border:1px solid #4a5280;background:#0f1222;color:#fff;margin:4px 0}
  #online .code{font:800 30px ui-monospace,monospace;letter-spacing:4px;color:#9be564;margin:8px 0;user-select:all}#online .st{min-height:22px;color:#aab3e6;margin-top:8px}#online .small{font-size:12px;color:#8890b8}#online button:focus,#online select:focus,#online input:focus{outline:3px solid #ffd27a;outline-offset:2px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'online-btn'; btn.textContent = 'ONLINE'; document.body.appendChild(btn);
  const ov = document.createElement('div'); ov.id = 'online'; document.body.appendChild(ov);
  ov.innerHTML = `<div class="box"><h2>Play a friend online</h2>
    <div id="on-setup"><div>Connection <select id="on-via"></select></div>
    <div><button class="main" id="on-host">HOST MATCH</button><button id="on-join">JOIN MATCH</button></div>
    <div id="on-joinrow" style="display:none"><input id="on-code" placeholder="code from your friend" size="24"> <button class="main" id="on-go">Join</button></div></div>
    <div id="on-codebox" style="display:none">Send your friend this code:<div class="code" id="on-codev"></div></div>
    <div class="st" id="on-st"></div>
    <div><button id="on-close">Close</button><button id="on-leave" style="display:none">Leave online play</button></div>
    <div class="small" style="margin:8px 0">You each pick a fighter on the fighter select. Whoever is ready first warms up against the CPU; the match starts when you are both ready. After a match you are both back on the fighter select, still connected. <span id="on-rules"></span></div>
    <div class="small" id="on-net">Controller: up / down to move, left / right to change, A to choose, B to go back.</div></div>`;
  const $ = id => document.getElementById(id), status = s => { $('on-st').textContent = s; };
  const open = () => { $('on-net').textContent = `Controller: up / down to move, left / right to change, ${padCap('A')} to choose, ${padCap('B')} to go back.`; $('on-via').innerHTML = D.getTransports().map(t => `<option value="${t.id}">${t.label}</option>`).join(''); refresh(); ov.style.display = 'flex'; UI_MODAL = true; padNav.start(); setTimeout(() => (L ? $('on-close') : $('on-host')).focus(), 0); };
  const close = () => { ov.style.display = 'none'; UI_MODAL = false; padNav.stop(); kb.hide(); };   /* closing keeps the link: Leave ends it */
  btn.onclick = open; window.openOnline = open;   /* the start screen's Online pill (sim.js) calls this, so a controller can open it */
  $('on-close').onclick = close;
  btn.style.display = 'block'; setInterval(() => { btn.style.display = mode === 'select' && !NET.session() ? 'block' : 'none'; }, 250);
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
  /* ---- the link to the friend. It outlives a match: after one ends, both are back on the fighter select, still linked. ----
     L.n (host): the number of the last match started. L.last (joiner): the last match it began. L.cur: the match being played. */
  let L = null, note = '', noteT = 0;
  const say = s => { note = s; noteT = Date.now(); status(s); };
  function via() { const ts = D.getTransports(); return ts.find(t => t.id === $('on-via').value) || ts[0]; }
  function refresh() {   /* what the menu offers: host or join when alone, the code while waiting, leaving once linked */
    $('on-setup').style.display = L ? 'none' : 'block'; $('on-leave').style.display = L ? 'inline-block' : 'none';
    $('on-codebox').style.display = L && L.host && !L.linked ? 'block' : 'none'; if (L && L.host) $('on-codev').textContent = L.link.code;
    $('on-rules').textContent = L && !L.host ? 'The host picks the stocks and the stage.' : 'Your stocks and stage (Options, on the fighter select) are used when you host.';
  }
  function connect(link, host) {
    L = { link, host, linked: false, n: 0, last: 0, cur: 0, ready: false, pick: 0, peer: null, heard: Date.now(), handler: null, slot: null, wait: 0, startMsg: null, training: TRAINING };
    link.onMessage(onLink); LOBBY = api; refresh();
  }
  function drop(why) {   /* the link is over: tell the friend, stop a match in progress, back to the fighter select */
    if (!L) return; const l = L; L = null; LOBBY = null;
    try { for (let k = 0; k < 3; k++) l.link.send({ t: 'bye' }); l.link.close(); } catch (e) { /* already gone */ }
    if (NET.session()) { NET.stop(); mode = 'select'; F = []; PROJ = []; PART = []; POPS = []; restore(l); }
    say(why || ''); refresh();
  }
  function restore(l) { TRAINING = l.training; slots[0] = l.slot ? Object.assign(l.slot, { ready: false }) : null; slots[1] = null; l.handler = null; }
  function linkedNow() { L.linked = true; L.heard = Date.now(); sfx('confirm'); refresh(); if (ov.style.display !== 'none') close(); }   /* connected: on to the fighter select */
  function onLink(m) {
    if (!L || !m) return; L.heard = Date.now();
    if (m.g !== undefined) { if (NET.session() && m.g === L.cur && L.handler) L.handler(m); return; }   /* a match's own packets, only for the match being played */
    if (m.t === 'hello') { if (!L.host) return;
      if (m.v !== VERSION) { L.link.send({ t: 'refuse', why: 'different game versions' }); status('Your friend has a different version of the game.'); return; }
      L.link.send({ t: 'welcome', v: VERSION }); if (!L.linked) linkedNow(); }
    else if (m.t === 'welcome') { if (!L.host && !L.linked) linkedNow(); }
    else if (m.t === 'refuse') drop('The host refused: ' + m.why);
    else if (m.t === 'bye') drop('Your friend left online play.');
    else if (m.t === 'lobby') { L.peer = m; if (L.host) maybeStart(); else if (L.ready && m.ready && !L.wait && mode === 'select') L.wait = Date.now(); }
    else if (m.t === 'start') { if (L.host || !(m.n > L.last)) return;   /* a repeat of one already begun */
      if (!STAGES[m.stage | 0]) { say('The host chose a stage this copy of the game does not have. Update the game.'); return; }
      L.last = m.n; play(1, m.p0, m.p1, m.stocks, m.stage | 0, m.n); }
  }
  /* host: both ready on the fighter select (or warming up) starts the match; a start the friend never got is sent again */
  function maybeStart() {
    const p = L.peer; if (!p) return;
    if (NET.session()) { if (!p.inMatch && p.last === L.n - 1 && L.startMsg) L.link.send(L.startMsg); return; }
    if (!(L.ready && p.ready && !p.inMatch && p.last === L.n)) return;
    L.n++; L.startMsg = { t: 'start', n: L.n, p0: L.pick, p1: p.pick, stocks: OPT.stocks, stage: OPT.stage }; L.link.send(L.startMsg);
    play(0, L.pick, p.pick, OPT.stocks, OPT.stage, L.n);
  }
  const lobbyMsg = () => ({ t: 'lobby', ready: L.ready, pick: L.pick, last: L.host ? L.n : L.last, inMatch: !!NET.session(), stocks: OPT.stocks, stage: OPT.stage });
  function lobbyTick() {
    if (!L) return;
    if (!L.linked) { if (!L.host) L.link.send({ t: 'hello', v: VERSION }); return; }   /* repeated until answered: packets can be lost */
    if (Date.now() - L.heard > 6000) { drop('Lost the connection to your friend.'); return; }
    if (L.ready && !NET.session() && mode === 'select') {
      if (L.wait && Date.now() - L.wait < 1500) { /* the friend was ready too: the host's start is on its way */ }
      else if (L.wait) { L.wait = 0; startMatch(); }   /* it never came (the friend went back to choose): warm up after all */
      else L.ready = false;   /* the warm-up ended or was left: choosing again */
    }
    L.link.send(lobbyMsg()); if (L.host) maybeStart();
  }
  setInterval(lobbyTick, 200);
  /* what the fighter select calls (sim.js) in place of starting a match, while linked */
  const api = {
    linked: () => !!L,   /* from the moment a match is hosted or joined: the host may warm up before the friend has even connected */
    /* this player has chosen: the match starts if the friend is ready too, otherwise a warm-up against the CPU until they are */
    ready() {
      const sl = slots.find(s => s && s.ready) || slots.find(Boolean); if (!sl) return;
      L.slot = sl; L.pick = sl.pick; L.ready = true; slots[0] = sl; slots[1] = null;   /* one player on each machine */
      const p = L.peer, both = L.linked && p && p.ready && !p.inMatch;
      if (L.linked) { L.link.send(lobbyMsg()); if (L.host) maybeStart(); }
      if (NET.session()) return;
      if (both && !L.host) { L.wait = Date.now(); return; }   /* the host starts it in a moment: no flash of a warm-up first */
      startMatch();
    },
    /* the online match is over and the game is back on the fighter select (main.js): still linked, choose again */
    ended() { if (L) { restore(L); L.ready = false; L.wait = 0; } }
  };
  /* both machines: the same match, then the netcode takes over the loop (main.js calls NET.tick). Whatever this machine
     was doing (choosing, or warming up against the CPU) stops, and the regular countdown starts. */
  function play(me, pick0, pick1, stocks, stage, n) {   /* stocks, stage: the host's choices, so both ends play the same match */
    if (NET.session()) return;
    ov.style.display = 'none'; UI_MODAL = false; padNav.stop(); kb.hide();
    if (!L.slot) L.slot = slots.find(Boolean) || null;
    L.cur = n; L.ready = false; L.wait = 0; L.training = TRAINING; TRAINING = false;
    CMENU = null; OPT_UI.open = false; if (typeof ML !== 'undefined') ML.open = false;   /* a menu left open would hold this machine's game still */
    slots[0] = { dev: 'kb', pick: pick0, ready: true }; slots[1] = { dev: 'kb', pick: pick1, ready: true }; startMatch(stocks, stage);
    frame = 0; tick = 0;   /* counters that run on from earlier matches: level on both machines, so their checksums compare */
    for (const f of F) { f.ctl = new Ctl('cpu'); f.ctl.cFall = true; }   /* people on both ends: the right stick fast-falls */
    const local = () => { const k = readKb(), pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [], p = pads.length ? readPad(pads[0].index) : null;
      if (!p) return k; for (const key in k) if (typeof k[key] === 'boolean') k[key] = k[key] || p[key]; if (Math.abs(p.lx) > Math.abs(k.lx)) k.lx = p.lx; if (Math.abs(p.ly) > Math.abs(k.ly)) k.ly = p.ly; if (Math.abs(p.cx) > Math.abs(k.cx)) k.cx = p.cx; if (Math.abs(p.cy) > Math.abs(k.cy)) k.cy = p.cy; return k; };
    const l = L;
    NET.start(me, { send: m => { m.g = n; if (L === l) l.link.send(m); }, onMessage: fn => { l.handler = fn; } }, { local });
  }
  $('on-host').onclick = async () => {
    try { $('on-joinrow').style.display = 'none'; status('Opening a match...'); const link = await via().host(); connect(link, true);
      status('Close this and pick your fighter. You warm up against the CPU until your friend is in and ready.'); $('on-close').focus();
    } catch (e) { status('Could not host: ' + e.message); }
  };
  $('on-join').onclick = () => { $('on-joinrow').style.display = 'block'; $('on-code').focus(); if (padNav.active) kb.show(); };   /* with a controller, straight to the keypad */
  $('on-go').onclick = async () => {
    try { status('Connecting...'); const link = await via().join($('on-code').value.trim()); connect(link, false); kb.hide(); }
    catch (e) { status('Could not join: ' + e.message); }
  };
  $('on-leave').onclick = () => { drop('You left online play.'); $('on-host').focus(); };
  /* the corner line: where things stand while linked, and the connection's quality during an online match */
  const line = document.createElement('div'); line.style.cssText = 'position:fixed;left:12px;bottom:8px;z-index:20;pointer-events:none;border-radius:8px'; document.body.appendChild(line);
  function lineText() {
    const s = NET.session();
    if (s) { const t = s.stats; return [`online · ping ${t.lastRtt} ms · rollbacks ${t.rollbacks} (deepest ${t.maxDepth}) · waits ${t.waits}` + (s.desync ? ' · DESYNC at frame ' + s.desync.frame : ''), false]; }
    if (!L) return [note && Date.now() - noteT < 6000 ? note : '', true];
    if (!L.linked) return [L.host ? 'Online · code ' + L.link.code + ' · waiting for your friend to connect' + (mode !== 'select' ? ' · warm-up against the CPU' : '') : 'Online · connecting...', true];
    const p = L.peer, rules = p && !L.host && STAGES[p.stage | 0] ? ' · host: ' + p.stocks + (p.stocks === 1 ? ' stock, ' : ' stocks, ') + STAGES[p.stage | 0].name : '';
    if (mode !== 'select') return ['Online · warm-up against the CPU · the match starts when your friend is ready', true];
    return ['Online · ' + (p && p.ready ? 'your friend is ready: pick your fighter and the match starts' : 'your friend is choosing a fighter · pick yours to warm up against the CPU') + rules, true];
  }
  setInterval(() => { const [t, big] = lineText(); line.textContent = t; line.style.font = big ? '700 15px system-ui' : '12px ui-monospace,monospace'; line.style.color = big ? '#ffd9a8' : '#9aa3d6'; line.style.background = big && t ? 'rgba(11,13,22,.78)' : 'none'; line.style.padding = big && t ? '6px 12px' : '0'; }, 250);
  window.__online = { state: () => L && { host: L.host, linked: L.linked, ready: L.ready, n: L.n, last: L.last, cur: L.cur, peer: L.peer }, line: () => lineText()[0], tick: lobbyTick };   /* for tests */
})();
