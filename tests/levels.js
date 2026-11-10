// CPU levels: plays each level against level 7 (the reference level) with the same fighter on both sides, and prints how
// often the level wins. The share should rise with the level and pass 50% at 7.
// Usage: node tests/levels.js [matchesPerFighterPerLevel, default 15] [seed, default 31]
const fs = require('fs'), path = require('path'), vm = require('vm');
try { const os = require('os'); os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { /* fine */ }   // long runs give way to a game being played on this PC
const root = path.join(__dirname, '..'), per = +process.argv[2] || 15;
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = +process.argv[3] || 31; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0, 'Flint'], [1, 0, 'Nib'], [1, 1, 'Loom'], [1, 2, 'Hod'], [2, 0, 'Potato Sack'], [3, 0, 'Sprocket'], [4, 0, 'Scuttle']], rows = {};
  for (let lv = 1; lv <= 9; lv++) {
    let wins = 0, games = 0, stocks = 0, dmg = 0, frames = 0;
    for (const A of forms) for (let m = 0; m < ${per}; m++) {
      const side = m % 2;   /* the level under test alternates sides */
      slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: A[0], ready: true };
      startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = F[1].fi = A[1]; F[0].noSwap = F[1].noSwap = true;
      F[side].ctl.ai.lv = lv; F[1 - side].ctl.ai.lv = 7;
      let n = 0; while (mode !== 'over' && n < 8 * 3600 + 400) { step(); n++; if (F[0].fi !== A[1]) F[0].fi = A[1]; if (F[1].fi !== A[1]) F[1].fi = A[1]; }
      const w = F[0].stocks !== F[1].stocks ? (F[0].stocks > F[1].stocks ? 0 : 1) : F[0].pct < F[1].pct ? 0 : 1;
      games++; if (w === side) wins++; stocks += F[side].stocks - F[1 - side].stocks; frames += n;
    }
    rows['level ' + lv] = { 'wins against level 7 %': Math.round(wins / games * 100), 'stock lead at the end': +(stocks / games).toFixed(2), 'match seconds': Math.round(frames / games / 60) };
  }
  console.table(rows);
})();
`);
