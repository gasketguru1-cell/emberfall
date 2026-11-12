// Tiles the pictures in a folder into one sheet, each labelled with its file name.   node sheet.mjs <dir> <out.png> [columns] [name filter]
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const [dir, out, colsS, filt] = process.argv.slice(2), files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && (!filt || new RegExp(filt).test(f))).sort();
const cols = +colsS || 6, m = await sharp(path.join(dir, files[0])).metadata(), w = m.width, h = m.height, rows = Math.ceil(files.length / cols);
const comp = files.map((f, i) => ({ input: path.join(dir, f), left: (i % cols) * w, top: Math.floor(i / cols) * h }));
const svg = `<svg width="${cols * w}" height="${rows * h}" xmlns="http://www.w3.org/2000/svg">` + files.map((f, i) => `<text x="${(i % cols) * w + 6}" y="${Math.floor(i / cols) * h + 18}" font-size="15" fill="#b00">${f.replace('.png', '')}</text>`).join('') + '</svg>';
await sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#ffffff' } }).composite(comp.concat([{ input: Buffer.from(svg) }])).png().toFile(out);
console.log(files.length + ' pictures -> ' + out);
