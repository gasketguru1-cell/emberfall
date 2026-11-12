// Potato Sack probe: runs routes (tools/sack-lab.js tokens) in the real game headless and prints what happened, frame by frame
// if asked. Testing only. node tools/sack-probe.js '<route>' '{"pct":30,"dist":12}' [trace]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'tools/knell-lab.js', 'tools/sack-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
if (require.main === module) {
  const route = process.argv[2], sit = Object.assign({ me: SLAB.ME }, JSON.parse(process.argv[3] || '{}')), tr = process.argv[4];
  const r = KLAB.run(route, sit, tr ? (t, f, v) => console.log(t, f.state, f.mname || '', f.mf, 'x' + f.x.toFixed(1), 'y' + f.y.toFixed(1), 'vx' + f.vx.toFixed(2), 'vy' + f.vy.toFixed(2), f.grounded ? 'G' : 'A', f.burstKind || '', '| foe', v.state, v.pct.toFixed(1), 'x' + v.x.toFixed(1), 'y' + v.y.toFixed(1), 'combo', COMBO[0].hits) : null);
  delete r.log; console.log(JSON.stringify(r));
}
/* what came out of a landing: the first frames on the ground after the route's last airborne stretch */
global.landOut = function (route, sit) {
  let air = 0, out = null, n = 0;
  const r = KLAB.run(route, Object.assign({ me: SLAB.ME, maxFrames: 400 }, sit), (t, f, v) => {
    if (!f.grounded) { air++; return; }
    if (air > 8 && !out) out = [];
    if (out && n++ < 30) out.push(f.state + (f.mname ? ':' + f.mname : '') + (f.state === 'land' ? '(' + f.lag + ')' : '') + ' vx' + f.vx.toFixed(2));
    if (!f.grounded) air = 0;
  });
  return { r, out };
};
