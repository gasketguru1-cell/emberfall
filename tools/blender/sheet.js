// Tiles the stills written by tools/blender/preview.py into one labelled contact sheet.
//   node tools/blender/sheet.js <dir of stills> <out.png> [columns]
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const [dir, out, colsArg] = process.argv.slice(2);
(async () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort(); if (!files.length) throw new Error('no stills in ' + dir);
  const meta = await sharp(path.join(dir, files[0])).metadata(), w = meta.width, h = meta.height, cols = Math.min(+colsArg || 8, files.length), rows = Math.ceil(files.length / cols);
  const parts = [];
  files.forEach((f, i) => { const x = (i % cols) * w, y = Math.floor(i / cols) * h, label = f.replace(/^\d+_|\.png$/g, '').replace('_', ' @ ');
    parts.push({ input: path.join(dir, f), left: x, top: y });
    parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="18"><rect width="${w}" height="18" fill="rgba(0,0,0,.6)"/><text x="4" y="13" font-family="sans-serif" font-size="12" fill="#fff">${label}</text></svg>`), left: x, top: y }); });
  await sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#000' } }).composite(parts).png().toFile(out);
  console.log('sheet: ' + files.length + ' stills -> ' + out);
})().catch(e => { console.error(e.message); process.exit(1); });
