// Gives the game page its network transports, and nothing else from the computer.
// Each transport: { id, label, host() -> link, join(code) -> link }; a link: { code, send(obj), onMessage(fn) (adds a listener), close() }.
const { contextBridge, ipcRenderer } = require('electron');
const listeners = new Map();
ipcRenderer.on('udp-msg', (e, id, msg) => { for (const fn of listeners.get(id) || []) fn(msg); });
function udpLink(r) {
  listeners.set(r.id, []);
  return { code: r.code, send: m => ipcRenderer.send('udp-send', r.id, m), onMessage: fn => listeners.get(r.id).push(fn), close: () => { ipcRenderer.send('udp-close', r.id); listeners.delete(r.id); } };
}
const direct = { id: 'direct', label: 'Direct (same network)', host: async () => udpLink(await ipcRenderer.invoke('udp-open', 'host')), join: async code => udpLink(await ipcRenderer.invoke('udp-open', 'join', code)) };
const eosL = new Map();
ipcRenderer.on('eos-msg', (e, id, msg) => { for (const fn of eosL.get(id) || []) fn(msg); });
function eosLink(r) { eosL.set(r.id, []); return { code: r.code, send: m => ipcRenderer.send('eos-send', r.id, m), onMessage: fn => eosL.get(r.id).push(fn), close: () => { ipcRenderer.send('eos-close', r.id); eosL.delete(r.id); } }; }
const eos = { id: 'eos', label: 'Internet (Epic Online Services)', host: async () => eosLink(await ipcRenderer.invoke('eos-host')), join: async code => eosLink(await ipcRenderer.invoke('eos-join', code)) };
/* EOS is offered first when it is set up; direct is always there */
const transports = [direct];
ipcRenderer.invoke('eos-available').then(ok => { if (ok) transports.unshift(eos); });
/* ---- notices from the desktop app (updates, a version mismatch online): a small panel of its own, over the game ---- */
function notice(text, button, onClick, sticky) {
  const show = () => {
    let el = document.getElementById('ef-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ef-notice';
      el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;max-width:360px;padding:12px 16px;border-radius:10px;' +
        'background:rgba(11,13,22,0.94);border:1px solid #ff8a3d;box-shadow:0 0 18px rgba(255,120,40,0.35);color:#f3ead8;' +
        'font:600 14px/1.4 system-ui,sans-serif;display:flex;gap:12px;align-items:center';
      document.body.appendChild(el);
    }
    el.textContent = '';
    const t = document.createElement('div'); t.textContent = text; el.appendChild(t);
    if (button) {
      const b = document.createElement('button'); b.textContent = button;
      b.style.cssText = 'flex:none;padding:6px 12px;border:0;border-radius:6px;background:#ff8a3d;color:#0b0d16;font:700 13px system-ui,sans-serif;cursor:pointer';
      b.onclick = onClick; el.appendChild(b);
    }
    clearTimeout(el._t);
    if (!sticky) el._t = setTimeout(() => el.remove(), 8000);
  };
  if (document.body) show(); else window.addEventListener('DOMContentLoaded', show, { once: true });
}
ipcRenderer.on('update-status', (e, s) => {
  if (s.state === 'downloading') notice(`Downloading Emberfall ${s.version}...`);
  else if (s.state === 'ready') notice(`Emberfall ${s.version} is ready${s.notes ? ': ' + s.notes : ''}. It installs when you close the game.`, 'Restart now', () => ipcRenderer.send('update-install'), true);
});
ipcRenderer.on('version-mismatch', (e, v) => notice(`The other player has Emberfall ${v.theirs}; you have ${v.mine}. Both players need the same version: restart the game to update.`, null, null, true));

contextBridge.exposeInMainWorld('desktop', { getTransports: () => transports.map(t => ({ id: t.id, label: t.label, host: t.host, join: t.join })) });
