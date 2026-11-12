// Renders the Emberfall logo and app icon from desktop/logo/*.svg: PNGs in several sizes and a Windows .ico holding them.
//   node tools/make-icon.js
const fs = require('fs'), path = require('path'), sharp = require('sharp');
const dir = path.join(__dirname, '..', 'desktop', 'logo');
(async () => {
  const svg = fs.readFileSync(path.join(dir, 'icon.svg')), sizes = [16, 24, 32, 48, 64, 128, 256], pngs = [];
  for (const s of sizes) pngs.push(await sharp(svg, { density: Math.max(72, s * 72 / 512 * 4) }).resize(s, s).png().toBuffer());
  await sharp(svg, { density: 288 }).resize(512, 512).png().toFile(path.join(dir, 'icon-512.png'));
  fs.writeFileSync(path.join(dir, 'icon-256.png'), pngs[sizes.indexOf(256)]);
  await sharp(fs.readFileSync(path.join(dir, 'logo.svg')), { density: 144 }).resize(1200, 400).png().toFile(path.join(dir, 'logo.png'));
  /* .ico: a 6-byte header, a 16-byte entry per image, then the PNG images themselves (Windows Vista and later read PNG entries) */
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = 6 + 16 * sizes.length; const entries = [];
  sizes.forEach((s, i) => { const e = Buffer.alloc(16); e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s; e[2] = 0; e[3] = 0; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(off, 12); off += pngs[i].length; entries.push(e); });
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([head, ...entries, ...pngs]));
  console.log('wrote icon.ico (' + sizes.join(', ') + '), icon-256.png, icon-512.png, logo.png');
})();
