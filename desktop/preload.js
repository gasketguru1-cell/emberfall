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
contextBridge.exposeInMainWorld('desktop', { getTransports: () => transports.map(t => ({ id: t.id, label: t.label, host: t.host, join: t.join })) });
