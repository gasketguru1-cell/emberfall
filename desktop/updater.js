// Emberfall's own updater: at start the installed game reads the latest release's manifest.json, checks its signature
// against the public key built into the game (desktop/update-key.pub.pem, made by `node tools/release.js keygen`),
// downloads the installer it names, checks its SHA-256 and size, and installs it when the player says so (or when the
// game closes). Anything that fails a check is thrown away and the game plays on as it is.
// Where releases come from: package.json "emberfall.releaseRepo" (a GitHub repo holding only the installers).
// Off in a game started from the project (`npm run desktop`) unless EMBERFALL_UPDATE_TEST=1; off with EMBERFALL_NO_UPDATE=1.
const { app, net, ipcMain } = require('electron');
const crypto = require('crypto'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const newer = (a, b) => {   // a > b, versions "1.2.3"
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let k = 0; k < 3; k++) if ((pa[k] || 0) !== (pb[k] || 0)) return (pa[k] || 0) > (pb[k] || 0);
  return false;
};
const log = m => console.log('[update] ' + m);

function start(getWin) {
  let ready = null, installing = false;
  const tell = (state, extra) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('update-status', { state, ...extra }); };
  const install = relaunch => {
    if (!ready || installing) return;
    installing = true;
    // the one-click installer, silently over this copy; --force-run starts the new version when it is done
    const args = ['/S'].concat(relaunch ? ['--force-run'] : []);
    spawn(ready.file, args, { detached: true, stdio: 'ignore' }).unref();
    log(`installing ${ready.version}`);
    if (relaunch) app.quit();
  };
  ipcMain.on('update-install', () => install(true));
  app.on('before-quit', () => install(false));   // (ready and not chosen: installed as the game closes)

  if (process.env.EMBERFALL_NO_UPDATE || (!app.isPackaged && !process.env.EMBERFALL_UPDATE_TEST)) return;
  let repo, pub;
  try {
    repo = (require(path.join(__dirname, '..', 'package.json')).emberfall || {}).releaseRepo;
    pub = crypto.createPublicKey(fs.readFileSync(path.join(__dirname, 'update-key.pub.pem')));
  } catch (e) { log('not set up (no release repo or public key): ' + e.message); return; }
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || repo.startsWith('YOUR-')) { log('not set up (no release repo)'); return; }

  (async () => {
    const base = `https://github.com/${repo}/releases/latest/download/`;
    const get = async (url, what) => { const r = await net.fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(`${what}: HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
    const body = await get(base + 'manifest.json', 'manifest');
    const sig = Buffer.from((await get(base + 'manifest.sig', 'signature')).toString('utf8').trim(), 'base64');
    if (!crypto.verify(null, body, pub, sig)) throw new Error('the manifest signature is not valid: ignored');
    const m = JSON.parse(body.toString('utf8'));
    if (m.app !== 'emberfall' || !newer(m.version, app.getVersion())) { log(`up to date (${app.getVersion()}; latest ${m.version})`); return; }
    if (!/^https:\/\/github\.com\//.test(m.url) || !/^Emberfall-Setup-[\d.]+\.exe$/.test(m.file)) throw new Error('unexpected download address: ignored');
    log(`${m.version} available: downloading`);
    tell('downloading', { version: m.version, notes: m.notes });
    const data = await get(m.url, 'installer');
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== m.size || hash !== m.sha256) throw new Error('the download does not match the signed manifest: thrown away');
    const dir = path.join(os.tmpdir(), 'emberfall-update');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, m.file);
    fs.writeFileSync(file, data);
    ready = { version: m.version, file };
    log(`${m.version} ready`);
    tell('ready', { version: m.version, notes: m.notes });
  })().catch(e => { log(e.message); tell('error', { message: e.message }); });
}

module.exports = { start };
