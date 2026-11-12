// Loads the game's simulation headless (as tests/knell.js does) and returns Knell's moves, so the clips read the very
// hitboxes the game uses.
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function () {
  const root = path.join(__dirname, '..', '..', '..');
  const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
  global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
  Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
  for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
  return vm.runInThisContext('ROSTER.find(d => d.name === "Knell").forms[0]');
};
