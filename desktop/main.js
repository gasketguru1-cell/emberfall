// Emberfall desktop app (Electron). Opens the game straight into its own window: no browser, no localhost server.
// The game files are served to the window from inside the app through a private app:// address.
// Networking lives here, in the main process, and reaches the page through preload.js:
//   - 'direct': UDP between the two machines (same network, or this computer for testing). No account, no server.
//   - 'eos':    Epic Online Services P2P + Lobbies (desktop/eos.js): internet play through Epic's free relay (desktop/EOS-SETUP.md).
const { app, BrowserWindow, protocol, ipcMain, Menu } = require('electron');
const path = require('path'), fs = require('fs'), dgram = require('dgram'), os = require('os');

app.commandLine.appendSwitch('force_high_performance_gpu');   /* laptops and desktops with two GPUs: use the strong one */
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const GAME = app.isPackaged ? path.join(process.resourcesPath, 'game') : path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.css': 'text/css', '.wasm': 'application/wasm' };
let win = null;

function serve() {
  protocol.handle('app', async req => {
    let rel = decodeURIComponent(new URL(req.url).pathname); if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(GAME, rel));
    if (!file.startsWith(GAME + path.sep)) return new Response('Forbidden', { status: 403 });   /* only files inside the game */
    try { const data = await fs.promises.readFile(file); return new Response(data, { headers: { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' } }); }
    catch (e) { return new Response('Not found', { status: 404 }); }
  });
}

/* ---- direct UDP: the code is this machine's address and port, written as letters ---- */
const B32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const enc = (ip, port) => { let n = BigInt(ip.split('.').reduce((a, b) => a * 256 + +b, 0)) * 65536n + BigInt(port), s = ''; for (let k = 0; k < 10; k++) { s = B32[Number(n % 32n)] + s; n /= 32n; } return s.slice(0, 5) + '-' + s.slice(5); };
const dec = code => { const c = code.toUpperCase().replace(/[^0-9A-Z]/g, ''); if (c.length !== 10) throw new Error('a code is 10 letters and numbers'); let n = 0n; for (const ch of c) { const v = B32.indexOf(ch); if (v < 0) throw new Error('that is not a valid code'); n = n * 32n + BigInt(v); } const port = Number(n % 65536n), ipN = Number(n / 65536n); return { ip: [ipN >>> 24, (ipN >> 16) & 255, (ipN >> 8) & 255, ipN & 255].join('.'), port }; };
function lanIp() { for (const list of Object.values(os.networkInterfaces())) for (const a of list) if (a.family === 'IPv4' && !a.internal) return a.address; return '127.0.0.1'; }
const socks = new Map(); let nextId = 1;
/* Both players must run the same version (an older or newer copy would desync): each side sends { __ev: version } until
   the other's has arrived; the game's own messages pass only once the two match. A mismatch (or a copy too old to say
   its version) shows a message asking to update, through preload.js. */
const VERSION = app.getVersion();
const sendRaw = (k, obj) => { if (k.peer) k.s.send(Buffer.from(JSON.stringify(obj)), k.peer.port, k.peer.ip); };
const mismatch = (theirs) => { if (win && !win.isDestroyed()) win.webContents.send('version-mismatch', { mine: VERSION, theirs }); };
ipcMain.handle('udp-open', (e, role, code) => new Promise((resolve, reject) => {
  const id = nextId++, s = dgram.createSocket('udp4'); let peer = null;
  if (role === 'join') { try { peer = dec(code); } catch (err) { reject(err); return; } }
  const k = { s, get peer() { return peer; }, theirs: null, oldTimer: null };
  s.on('message', (buf, rinfo) => {
    if (!peer) peer = { ip: rinfo.address, port: rinfo.port };
    if (rinfo.address !== peer.ip || rinfo.port !== peer.port) return;
    let msg; try { msg = JSON.parse(buf.toString()); } catch (err) { return; }   /* not ours */
    if (msg && msg.__ev !== undefined) {
      if (k.theirs === null) { k.theirs = String(msg.__ev); clearTimeout(k.oldTimer); sendRaw(k, { __ev: VERSION }); if (k.theirs !== VERSION) mismatch(k.theirs); }
      return;
    }
    if (k.theirs === null) {   /* the other copy hasn't said its version: ours goes out; none at all within 4 s means an old copy */
      sendRaw(k, { __ev: VERSION });
      if (!k.oldTimer) k.oldTimer = setTimeout(() => { if (k.theirs === null) mismatch('an older version'); }, 4000);
      return;
    }
    if (k.theirs !== VERSION) return;
    win && win.webContents.send('udp-msg', id, msg);
  });
  s.on('error', err => reject(err));
  s.bind(role === 'host' ? 0 : 0, () => { socks.set(id, k); if (peer) sendRaw(k, { __ev: VERSION }); resolve({ id, code: role === 'host' ? enc(lanIp(), s.address().port) : code }); });
}));
ipcMain.on('udp-send', (e, id, msg) => { const k = socks.get(id); if (!k || !k.peer) return; if (k.theirs === null) sendRaw(k, { __ev: VERSION }); sendRaw(k, msg); });
ipcMain.on('udp-close', (e, id) => { const k = socks.get(id); if (k) { k.s.close(); socks.delete(id); } });

/* ---- EOS: loaded only when its SDK and settings are present (see desktop/EOS-SETUP.md) ---- */
let eos = null; try { eos = require('./eos.js'); if (!eos.available()) eos = null; } catch (e) { eos = null; }
ipcMain.handle('eos-available', () => !!eos);
if (eos) eos.wire(ipcMain, () => win);
app.on('will-quit', () => { try { if (eos && eos.shutdown) eos.shutdown(); } catch (e) { /* quitting anyway */ } });

app.whenReady().then(() => {
  serve(); Menu.setApplicationMenu(null);
  /* Fullscreen by default; F11 switches to a window and back. Self-tests and EMBERFALL_WINDOWED=1 start in a window. */
  const fullscreen = !process.env.EMBERFALL_WINDOWED && !process.env.EMBERFALL_AUTOTEST;
  win = new BrowserWindow({ width: 1280, height: 760, fullscreen, backgroundColor: '#0b0d16', title: 'Emberfall', autoHideMenuBar: true, icon: path.join(__dirname, 'logo', 'icon-256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  /* Nintendo's GameCube adapter (057e:0337) over WebUSB: the game may open it without asking (sim.js: GCU). Nothing else. */
  const isGCU = d => d && d.vendorId === 0x057e && d.productId === 0x0337, ses = win.webContents.session;
  ses.setPermissionCheckHandler(() => true);   /* Electron's own default, kept: the device handler below is what limits USB */
  ses.setDevicePermissionHandler(d => d.deviceType === 'usb' && isGCU(d.device));
  ses.on('select-usb-device', (e, details, pick) => { e.preventDefault(); const d = details.deviceList.find(isGCU); pick(d ? d.deviceId : undefined); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  /* The DEV copy (started from the project, not installed): its title and a badge say so, so it is never mistaken for
     the installed game. It plays the project's files as they are saved, read when the game loads, so F5 reloads it to
     pick up new work without closing the window (the installed game ignores F5). */
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'F5' && !input.isAutoRepeat) { win.webContents.reloadIgnoringCache(); e.preventDefault(); }
    });
    let branch = ''; try { branch = require('child_process').execSync('git branch --show-current', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* no git */ }
    const title = `Emberfall DEV - live from your project${branch ? ' (' + branch + ')' : ''}`;
    win.setTitle(title);
    win.on('page-title-updated', e => e.preventDefault());
    ipcMain.on('dev-info', e => { e.returnValue = { dev: true, branch, version: app.getVersion() }; });
  } else ipcMain.on('dev-info', e => { e.returnValue = { dev: false }; });
  win.loadURL('app://game/index.html');
  require('./updater.js').start(() => win);   /* signed updates (desktop/updater.js, docs/RELEASING.md) */
  if (process.env.EMBERFALL_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  if (process.env.EMBERFALL_AUTOTEST) win.webContents.once('did-finish-load', () => autotest(process.env.EMBERFALL_AUTOTEST));
});
app.on('window-all-closed', () => app.quit());
/* Self-test, for checking a build with nobody at the keyboard: EMBERFALL_AUTOTEST=host|join, EMBERFALL_AUTOFILE=<folder>.
   The host writes its code to <folder>/code.txt; the joiner reads it. Both play the same seeded inputs as tests/net.js for
   1800 frames over the real connection (direct, or Epic with EMBERFALL_AUTOVIA=eos), then write their checksums and network numbers to <folder>/<role>.json and quit. */
function autotest(role) {
  const dir = process.env.EMBERFALL_AUTOFILE, fsP = fs.promises, me = role === 'host' ? 0 : 1;
  if (role === 'probe') {   /* offline check: the 3D models load and a CPU match runs with no network */
    (async () => { await new Promise(r => setTimeout(r, 8000));
      const r = await win.webContents.executeJavaScript(`(async () => { slots[0] = { dev: 'kb', pick: 2, ready: true }; slots[1] = { dev: 'cpu', pick: 5, ready: true }; startMatch(); await new Promise(r => setTimeout(r, 6000));
        const M = R3.models; return { r3: R3.ready, gpu: R3.gpu, models: Object.keys(M).filter(k => M[k].ready).length + '/' + Object.keys(M).length, errors: Object.keys(M).filter(k => M[k].error), mode, frame, fighters: F.map(f => f.form.name + ' ' + f.state + ' ' + f.pct.toFixed(0) + '%'), online: !!window.desktop, transports: window.desktop.getTransports().map(t => t.id) }; })()`);
      await fsP.writeFile(path.join(dir, 'probe.json'), JSON.stringify(r)); app.quit(); })();
    return;
  }
  const js = `(async () => {
    const seed = ${me === 0 ? 1000 : 2000}; let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const sc = []; let cur = [0, 0, 0, 0, 0], left = 0;
    for (let k = 0; k < 4000; k++) { if (left-- <= 0) { left = 2 + (rnd() * 18 | 0); const r = rnd(); cur = [Math.round((rnd() * 2 - 1) * 127), Math.round((rnd() * 2 - 1) * 127), r < 0.1 ? (rnd() < 0.5 ? -127 : 127) : 0, 0, rnd() < 0.55 ? 1 << (rnd() * 5 | 0) : 0]; if (rnd() < 0.3) cur[0] = cur[1] = 0; } sc.push(cur.slice()); }
    const t = window.desktop.getTransports().find(x => x.id === ${JSON.stringify(process.env.EMBERFALL_AUTOVIA || 'direct')});   /* EMBERFALL_AUTOVIA=eos tests the Epic connection */
    let link; if (${me} === 0) { link = await t.host(); window.__code = link.code; } else { link = await t.join(${JSON.stringify('CODE')}); }
    await new Promise(res => { let ok = false; link.onMessage(m => { if (m.t === 'hi' && !ok) { ok = true; link.send({ t: 'hi' }); setTimeout(res, 300); } }); const ping = () => { if (!ok) { link.send({ t: 'hi' }); setTimeout(ping, 200); } }; ping(); });
    TRAINING = false; slots[0] = { dev: 'kb', pick: 2, ready: true }; slots[1] = { dev: 'kb', pick: 5, ready: true }; startMatch(); for (const f of F) f.ctl = new Ctl('cpu');
    NET.start(${me}, link, { local: () => NET.unpack(sc[NET.session().f + NET.DELAY]) });
    const t0 = Date.now(); while (NET.session().f < 1800 && Date.now() - t0 < 120000) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 1500));
    const S = NET.session(); return { role: '${role}', frames: S.f, hashes: [...S.hashes], desync: S.desync, stats: S.stats, final: NET.hash(), pct: F.map(f => f.pct), ms: Date.now() - t0 };
  })()`;
  (async () => {
    let code = 'CODE';
    if (role === 'join') { for (let k = 0; k < 100 && !fs.existsSync(path.join(dir, 'code.txt')); k++) await new Promise(r => setTimeout(r, 200)); code = (await fsP.readFile(path.join(dir, 'code.txt'), 'utf8')).trim(); }
    const run = win.webContents.executeJavaScript(js.replace(JSON.stringify('CODE'), JSON.stringify(code)));
    if (role === 'host') { for (let k = 0; k < 300; k++) { const c = await win.webContents.executeJavaScript('window.__code || null'); if (c) { await fsP.writeFile(path.join(dir, 'code.txt'), c); break; } await new Promise(r => setTimeout(r, 100)); } }
    try { const r = await run; await fsP.writeFile(path.join(dir, role + '.json'), JSON.stringify(r)); } catch (e) { await fsP.writeFile(path.join(dir, role + '.json'), JSON.stringify({ error: String(e) })); }
    app.quit();
  })();
}
