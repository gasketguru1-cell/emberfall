// Viking probe: loads the real game headless (hitboxes.js, sim.js, net.js, tools/knell-lab.js, tools/viking-lab.js) and runs a
// study script in it, the same way tools/knell-search.js runs the game. A study is plain JavaScript using KLAB / VLAB and the
// game's own globals; it writes what it measures. Nothing in the game is changed.
//   node tools/viking-probe.js tools/viking-studies/power.js [out.json]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
global.FS = fs; global.OUT = process.argv[3] || null; global.ARGS = process.argv.slice(4);
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'tools/knell-lab.js', 'tools/viking-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext('(function () {\n' + fs.readFileSync(path.resolve(process.argv[2]), 'utf8') + '\n})();', { filename: process.argv[2] });
