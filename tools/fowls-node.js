// Loads the game simulation and the Fowls lab into this node process (stub canvas, seeded random), then runs the code in the
// file given:  node tools/fowls-node.js script.js [args]   The script runs in the game's own global scope (FL, F, PROJ ...).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = undefined; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 1234; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'cpu10.js', 'tools/fowls-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
global.require = require; global.FS = fs; global.ARGS = process.argv.slice(3); global.ROOT = root;
vm.runInThisContext(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'), { filename: path.basename(process.argv[2]) });
