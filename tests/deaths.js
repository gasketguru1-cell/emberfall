// Why does a fighter die without being launched? Plays seeded CPU matches with one form fixed and prints the last
// state changes before each death that did not happen in hitstun.   node tests/deaths.js <formIndex 0-3> [matches]
const fs = require('fs'), path = require('path'), vm = require('vm');
try { const os = require('os'); os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { /* fine */ }   // long runs give way to a game being played on this PC
const root = path.join(__dirname, '..'), which = +process.argv[2] || 0, count = +process.argv[3] || 6;
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0], [1, 0], [1, 1], [1, 2]], A = forms[${which}]; let shown = 0, fell = 0, launched = 0;
  for (let m = 0; m < ${count}; m++) {
    const B = forms[m % 4];
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: B[0], ready: true };
    startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = A[1]; F[1].fi = B[1]; F[0].noSwap = F[1].noSwap = true;
    const f = F[0]; let trace = [], last = '', stocks = f.stocks, n = 0;
    while (mode !== 'over' && n < 8 * 3600 + 400) {
      const before = f.state; step(); n++; if (f.fi !== A[1]) f.fi = A[1]; if (F[1].fi !== B[1]) F[1].fi = B[1];
      const tag = f.state + (f.state === 'attack' ? ':' + f.mname : '');
      if (tag !== last) { trace.push(n + ' ' + tag + ' @' + Math.round(f.x) + ',' + Math.round(f.y) + ' j' + f.jumps + (f.sideUsed ? ' s' : '')); last = tag; if (trace.length > 9) trace.shift(); }
      if (f.stocks < stocks) { stocks = f.stocks; const wasHurt = trace.length > 1 && /hurt/.test(trace[trace.length - 2]); if (wasHurt) launched++; else { fell++; if (shown++ < 7) console.log(Math.round(f.pct) + '%? ' + trace.slice(-8).join(' | ')); } trace = []; }
    }
  }
  console.log(F[0].form.name + ': fell ' + fell + ', launched ' + launched);
})();
`);
