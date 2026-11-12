// Saves Furious Fowls playtest clips recorded in the browser by tools/fowls-rec.js.
// A testing tool only; the game never talks to it.   node tools/fowls-rec-server.js   (listens on 127.0.0.1:8321)
//   POST /file?clip=<name>&dir=<folder>  body: a WebM -> playtest-results/furious-fowls/<folder>/<name>.webm
//   POST /json?clip=<name>&dir=<folder>  body: JSON   -> playtest-results/furious-fowls/<folder>/<name>.json
const http = require('http'), fs = require('fs'), path = require('path');
const outRoot = path.join(__dirname, '..', 'playtest-results', 'furious-fowls');
const safe = s => String(s || '').replace(/[^A-Za-z0-9_\-]/g, '');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const parts = []; req.on('data', d => parts.push(d)); req.on('end', () => {
    const raw = Buffer.concat(parts), clip = safe(u.searchParams.get('clip')), od = path.join(outRoot, safe(u.searchParams.get('dir')));
    const ext = u.pathname === '/file' ? '.webm' : u.pathname === '/json' ? '.json' : null;
    if (!ext || !clip) { res.writeHead(404, cors); return res.end('no'); }
    fs.mkdirSync(od, { recursive: true }); const out = path.join(od, clip + ext); fs.writeFileSync(out, raw);
    res.writeHead(200, cors); res.end('wrote ' + out + ' (' + raw.length + ' bytes)');
  });
}).listen(8321, '127.0.0.1', () => console.log('fowls clip server on 127.0.0.1:8321'));
