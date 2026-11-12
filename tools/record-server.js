// Saves clips recorded from the running game (tools/record.js in the browser). The WebM path (/file) is the one in use; the
// JPEG-frames-to-MP4 path through Blender (/frame, /done) crashed Blender and is kept only for reference.
// A testing tool only; the game never talks to it.   node tools/record-server.js   (listens on 127.0.0.1:8319)
//   POST /frame?clip=<name>&i=<n>   body: a JPEG data URL   -> playtest-results/_frames/<name>/<n>.jpg
//   POST /file?clip=<name>&dir=<folder>  body: a WebM -> playtest-results/potato-sack/<folder>/<name>.webm
//   POST /done?clip=<name>&dir=<folder>&fps=<n>             -> playtest-results/potato-sack/<folder>/<name>.mp4
const http = require('http'), fs = require('fs'), path = require('path'), { execFile } = require('child_process');
const root = path.join(__dirname, '..'), frames = path.join(root, 'playtest-results', '_frames'), outRoot = path.join(root, 'playtest-results', 'potato-sack');
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const safe = s => String(s || '').replace(/[^A-Za-z0-9_\-]/g, '');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const parts = []; req.on('data', d => { parts.push(d); }); req.on('end', () => {
    const raw = Buffer.concat(parts), body = raw.toString('latin1'), clip = safe(u.searchParams.get('clip'));
    if (u.pathname === '/file') {   /* a finished WebM from the browser */
      const od = path.join(outRoot, safe(u.searchParams.get('dir'))); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.webm');
      fs.writeFileSync(out, raw); res.writeHead(200, cors); return res.end('wrote ' + out + ' (' + raw.length + ' bytes)');
    }
    if (u.pathname === '/afile') {   /* an animation-overhaul clip: playtest-results/animation-overhaul/<dir>/<clip>.webm */
      const od = path.join(root, 'playtest-results', 'animation-overhaul', safe(u.searchParams.get('dir'))); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.webm');
      fs.writeFileSync(out, raw); res.writeHead(200, cors); return res.end('wrote ' + out + ' (' + raw.length + ' bytes)');
    }
    if (u.pathname === '/kfile') {   /* a Knell playtest clip (tools/knell-record.js): playtest-results/knell/<dir>/<clip>.webm */
      const od = path.join(root, 'playtest-results', 'knell', safe(u.searchParams.get('dir'))); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.webm');
      fs.writeFileSync(out, raw); res.writeHead(200, cors); return res.end('wrote ' + out + ' (' + raw.length + ' bytes)');
    }
    if (u.pathname === '/cfile') {   /* a Chomp Chomp playtest clip (tools/chomp-record.js): playtest-results/chomp/<dir>/<clip>.webm */
      const od = path.join(root, 'playtest-results', 'chomp', safe(u.searchParams.get('dir'))); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.webm');
      fs.writeFileSync(out, raw); res.writeHead(200, cors); return res.end('wrote ' + out + ' (' + raw.length + ' bytes)');
    }
    if (u.pathname === '/cpng') {   /* a still taken from a Chomp Chomp clip (the Discovery Album): playtest-results/chomp/<dir>/stills/<clip>.png */
      const od = path.join(root, 'playtest-results', 'chomp', safe(u.searchParams.get('dir')), 'stills'); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.png');
      fs.writeFileSync(out, Buffer.from(body.slice(body.indexOf(',') + 1), 'base64')); res.writeHead(200, cors); return res.end('wrote ' + out);
    }
    if (u.pathname === '/png') {   /* a still from the running game: playtest-results/<dir>/<clip>.png */
      const od = path.join(root, 'playtest-results', safe(u.searchParams.get('dir'))); fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + '.png');
      fs.writeFileSync(out, Buffer.from(body.slice(body.indexOf(',') + 1), 'base64')); res.writeHead(200, cors); return res.end('wrote ' + out);
    }
    if (u.pathname === '/frame') {
      const dir = path.join(frames, clip); fs.mkdirSync(dir, { recursive: true });
      const n = String(+u.searchParams.get('i')).padStart(5, '0'), b64 = body.slice(body.indexOf(',') + 1);
      fs.writeFileSync(path.join(dir, n + '.jpg'), Buffer.from(b64, 'base64')); res.writeHead(200, cors); return res.end('ok');
    }
    if (u.pathname === '/done') {
      const sub = safe(u.searchParams.get('dir')), fps = +u.searchParams.get('fps') || 30, od = path.join(outRoot, sub); fs.mkdirSync(od, { recursive: true });
      const out = path.join(od, clip + '.mp4');
      execFile(BLENDER, ['-b', '--factory-startup', '--python', path.join(__dirname, 'blender', 'encode.py'), '--', '--frames', path.join(frames, clip), '--out', out, '--fps', String(fps)], { maxBuffer: 1 << 24 }, (err, so, se) => {
        const ok = !err && fs.existsSync(out) && fs.statSync(out).size > 10000;
        if (ok) fs.rmSync(path.join(frames, clip), { recursive: true, force: true });
        res.writeHead(ok ? 200 : 500, cors); res.end(ok ? 'wrote ' + out + ' (' + fs.statSync(out).size + ' bytes)' : 'encode failed: ' + (err ? err.message : '') + '\n' + String(se).slice(-800) + String(so).slice(-800));
      });
      return;
    }
    res.writeHead(404, cors); res.end('?');
  });
}).listen(8319, '127.0.0.1', () => console.log('record server on http://127.0.0.1:8319'));
