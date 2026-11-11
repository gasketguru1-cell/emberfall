#!/usr/bin/env node
/* Emberfall releases: signed updates that every installed copy picks up by itself (desktop/updater.js).

   node tools/release.js keygen          once: makes the release signing key.
                                         private key -> %USERPROFILE%\.emberfall-release\update-private.pem (never in the project)
                                         public key  -> desktop/update-key.pub.pem (built into the game: it checks updates with it)
   node tools/release.js sign ["notes"]  after `npm run dist`: writes dist/manifest.json (version, installer name, its
                                         SHA-256 and size, where to download it) and dist/manifest.sig (its signature)
   node tools/release.js publish         uploads the installer, manifest.json and manifest.sig as a GitHub release of the
                                         repo in package.json "emberfall.releaseRepo" (a token in
                                         %USERPROFILE%\.emberfall-release\github-token.txt; never in the project)
   node tools/release.js all ["notes"]   dist + sign + publish

   Safety: the game installs an update only when manifest.json carries a valid signature from the private key and the
   downloaded installer matches the SHA-256 in it. Whoever hosts the files, or gets into the hosting account, can't make
   the game install anything else. Keep the private key safe and backed up: without it you can't release updates that
   existing copies accept (they'd need a new installer by hand). */
const crypto = require('crypto'), fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SECRET_DIR = path.join(os.homedir(), '.emberfall-release');
const PRIVATE_KEY = path.join(SECRET_DIR, 'update-private.pem');
const TOKEN_FILE = path.join(SECRET_DIR, 'github-token.txt');
const PUBLIC_KEY = path.join(ROOT, 'desktop', 'update-key.pub.pem');
const pkg = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const die = m => { console.error('release: ' + m); process.exit(1); };

function repo() {
  const r = (pkg().emberfall || {}).releaseRepo;
  if (!r || !/^[\w.-]+\/[\w.-]+$/.test(r) || r.startsWith('YOUR-')) die('set "emberfall": { "releaseRepo": "<github user>/<repo>" } in package.json (see docs/RELEASING.md)');
  return r;
}

function keygen() {
  if (fs.existsSync(PRIVATE_KEY)) die(`a key exists already (${PRIVATE_KEY}); delete it first only if you really mean to replace it - copies of the game checking with the old key would no longer accept updates`);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(SECRET_DIR, { recursive: true });
  fs.writeFileSync(PRIVATE_KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('private key (keep secret, back it up): ' + PRIVATE_KEY);
  console.log('public key (built into the game):      ' + PUBLIC_KEY);
}

function sign(notes) {
  if (!fs.existsSync(PRIVATE_KEY)) die('no private key: run `node tools/release.js keygen` first');
  const version = pkg().version, file = `Emberfall-Setup-${version}.exe`, exe = path.join(ROOT, 'dist', file);
  if (!fs.existsSync(exe)) die(`${exe} not found: run \`npm run dist\` first`);
  const data = fs.readFileSync(exe);
  const manifest = {
    app: 'emberfall', version, file, size: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    url: `https://github.com/${repo()}/releases/download/v${version}/${file}`,
    notes: notes || '', date: new Date().toISOString(),
  };
  const body = Buffer.from(JSON.stringify(manifest, null, 2));
  const sig = crypto.sign(null, body, crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY)));
  // (self-check with the public key the game is built with)
  if (!crypto.verify(null, body, crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY)), sig)) die('the signature does not check with desktop/update-key.pub.pem: the key pair does not match');
  fs.writeFileSync(path.join(ROOT, 'dist', 'manifest.json'), body);
  fs.writeFileSync(path.join(ROOT, 'dist', 'manifest.sig'), sig.toString('base64'));
  console.log(`signed ${file} (${(data.length / 1048576).toFixed(1)} MB, sha256 ${manifest.sha256.slice(0, 16)}...)`);
}

async function gh(method, url, body, type) {
  const token = fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : process.env.EMBERFALL_GITHUB_TOKEN;
  if (!token) die(`no GitHub token: put one in ${TOKEN_FILE} (see docs/RELEASING.md)`);
  const r = await fetch(url, { method, body, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'emberfall-release', ...(type ? { 'Content-Type': type } : {}) } });
  const text = await r.text();
  if (!r.ok) die(`GitHub ${method} ${url.replace(/\?.*/, '')}: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function publish() {
  const version = pkg().version, r = repo(), dist = path.join(ROOT, 'dist');
  const files = [`Emberfall-Setup-${version}.exe`, 'manifest.json', 'manifest.sig'];
  for (const f of files) if (!fs.existsSync(path.join(dist, f))) die(`dist/${f} missing: run dist and sign first`);
  const m = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
  if (m.version !== version) die(`dist/manifest.json is for ${m.version}, package.json says ${version}: sign again`);
  const rel = await gh('POST', `https://api.github.com/repos/${r}/releases`, JSON.stringify({ tag_name: `v${version}`, name: `Emberfall ${version}`, body: m.notes || '', make_latest: 'true' }), 'application/json');
  for (const f of files) {
    const up = rel.upload_url.replace(/\{.*\}$/, `?name=${encodeURIComponent(f)}`);
    await gh('POST', up, fs.readFileSync(path.join(dist, f)), 'application/octet-stream');
    console.log('uploaded ' + f);
  }
  console.log(`released Emberfall ${version}: installed copies update at their next start.`);
}

(async () => {
  const [cmd, notes] = process.argv.slice(2);
  if (cmd === 'keygen') keygen();
  else if (cmd === 'sign') sign(notes);
  else if (cmd === 'publish') await publish();
  else if (cmd === 'all') { execSync('npm run dist', { cwd: ROOT, stdio: 'inherit' }); sign(notes); await publish(); }
  else console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*', '').trim());
})().catch(e => die(e.stack || String(e)));
