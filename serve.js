// Tiny local server for the game: node serve.js, then open http://localhost:8317
//
// Two views of the same folder, so the game can be played while it is being worked on:
//   http://localhost:8317/        the last FINISHED version (the last git commit). Half-made edits never show up here.
//   http://localhost:8317/dev/    the files exactly as they are on disk right now (for checking work in progress).
//   http://localhost:8317/__version   a short id of the finished version; the game asks for it and says when a newer one is ready.
// Files git does not keep (node_modules) always come from disk. Without git, everything comes from disk.
// Windows starts a copy of this quietly at sign-in (tools/start-server.vbs, from a shortcut in the Startup folder),
// so the address works all the time. play.bat and the editor can start their own copies too: extra copies stand by.
const http = require('http'), fs = require('fs'), path = require('path'), { execFile, execFileSync } = require('child_process');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const PORT = +process.env.EMBERFALL_PORT || +process.env.PORT || 8317;   /* another port only for trying the server itself, or when the editor's preview hands one out (a second copy of the folder being worked on) */
const root = __dirname, cache = new Map();   /* finished files already read: "commit:path" -> contents */
let head = '', headAt = 0;
function commit() {   /* the current commit, looked up at most once a second */
  if (Date.now() - headAt > 1000) { headAt = Date.now(); try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { head = ''; } }
  return head;
}
function send(res, file, data) { res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); }
function fromDisk(res, rel) {
  const file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }   // only files inside the game folder
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); } else send(res, file, data); });
}
const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end('Bad request'); return; }
  if (rel === '/__version') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end(commit().slice(0, 12) || 'disk'); return; }
  const dev = rel === '/dev' || rel.startsWith('/dev/'); if (dev) rel = rel.slice(4) || '/';
  if (rel.endsWith('/')) rel += 'index.html';
  const h = commit(), inGit = rel.slice(1).replace(/\\/g, '/');
  if (dev || !h || inGit.startsWith('node_modules/') || inGit.includes('..')) { fromDisk(res, rel); return; }
  const key = h + ':' + inGit;
  if (cache.has(key)) { send(res, rel, cache.get(key)); return; }
  execFile('git', ['show', key], { cwd: root, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 }, (err, data) => {
    if (err) { fromDisk(res, rel); return; }   /* not in the finished version (a new or untracked file): fall back to disk */
    if (cache.size > 400) cache.clear(); cache.set(key, data); send(res, rel, data);
  });
});
/* If another copy of this server already has the port (the one Windows starts at sign-in, say), this one does not give up:
   it waits and takes over the moment the port is free. So the address always answers, whoever started first. */
let waiting = false;
server.on('listening', () => console.log('Emberfall running at http://localhost:' + PORT + '  (work in progress: http://localhost:' + PORT + '/dev/)'));
server.on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  if (!waiting) console.log('http://localhost:' + PORT + ' is already being served by another copy; standing by to take over if it stops');
  waiting = true; setTimeout(() => server.listen(PORT, '127.0.0.1'), 4000);
});
server.listen(PORT, '127.0.0.1');
