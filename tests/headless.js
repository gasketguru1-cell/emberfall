// Headless regression check: seeded CPU-vs-CPU matches against a stub canvas.
// Usage: node tests/headless.js [file ...]   (defaults to the split game files)
// Prints one line per match; the same seed and the same rules must give the same lines.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const files = process.argv.length > 2 ? process.argv.slice(2) : ['sim.js', 'render2d.js', 'hud.js'].map(f => path.join(root, f));
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) };
global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 12345; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of files) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: path.basename(f) });
vm.runInThisContext(`
(function () {
  const lines = []; let bad = 0;
  for (let match = 0; match < 6; match++) {
    slots[0] = { dev: 'kb', pick: match % 2, ready: true }; slots[1] = null;
    startMatch(); F[0].ctl = new Ctl('cpu');
    let n = 0; const states = new Set();
    while (mode !== 'over' && n < 8 * 3600 + 400) {
      step(); n++;
      for (const f of F) { states.add(f.state); if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.vx) || !isFinite(f.vy)) bad++; if (f.grounded && !f.plat) bad++; }
      if (n % 7 === 0 && typeof draw === 'function') draw();
    }
    lines.push([match, F.map(f => f.def.name).join(' v '), n, result, F.map(f => f.stocks + ':' + f.pct.toFixed(2)).join(' '), states.size + ' states'].join(' | '));
  }
  console.log(lines.join('\\n')); console.log(bad ? 'BAD STATES: ' + bad : 'ok: no bad states');
})();
`);
