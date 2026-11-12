// Every stage in the STAGES table: its files are on disk, its platforms sit over the floor, and a seeded CPU-vs-CPU match
// for each fighter finishes with no bad states and with fighters using the platforms. Usage: node tests/stages.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) };
global.fs = fs; global.path = path; global.root = root; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'anim.js', 'render2d.js', 'hud.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  let fail = 0; const say = (ok, t) => { console.log((ok ? 'ok   ' : 'FAIL ') + t); if (!ok) fail++; };
  STAGES.forEach((S, k) => {
    setStage(k, false);
    say(PLATS.length === S.plats.length + 1 && PLATS[0] === MAIN, S.name + ': ' + S.plats.length + ' soft platform(s) over the main floor');
    say(fs.existsSync(path.join(root, S.cfg)) && fs.existsSync(path.join(root, JSON.parse(fs.readFileSync(path.join(root, S.cfg), 'utf8')).file)), S.name + ': stage file and model are on disk');
    say(PLATS.slice(1).every(p => p.x0 < p.x1 && p.x0 >= -EDGE && p.x1 <= EDGE && p.y > 0 && p.y < BLAST.t - 40), S.name + ': platforms sit over the floor');
    let bad = 0, done = 0, landed = 0;
    for (let match = 0; match < ROSTER.length; match++) {
      slots[0] = { dev: 'kb', pick: match, ready: true }; slots[1] = null; startMatch(); F[0].ctl = new Ctl('cpu');
      let n = 0; while (mode !== 'over' && n < 8 * 3600 + 400) { step(); n++; for (const f of F) { if (!isFinite(f.x) || !isFinite(f.y) || !isFinite(f.vx) || !isFinite(f.vy)) bad++; if (f.grounded && !f.plat) bad++; if (f.grounded && f.plat && !PLATS.includes(f.plat)) bad++; if (f.grounded && f.plat && f.plat.soft) landed++; } }
      if (mode === 'over') done++;
    }
    say(!bad && done === ROSTER.length, S.name + ': ' + done + ' of ' + ROSTER.length + ' CPU matches finished, ' + bad + ' bad states');
    say(landed > 0, S.name + ': fighters stood on a soft platform (' + landed + ' frames)');
  });
  setStage(0, false); mode = 'select'; slots[0] = slots[1] = null;
  console.log(fail ? fail + ' FAILED' : 'all stage checks passed'); if (fail) process.exitCode = 1;
})();
`, { filename: 'stages-run' });
