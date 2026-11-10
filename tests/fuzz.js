// Stress test: both fighters are driven by random stick and button input, the kind of messy pressing no CPU does.
// Looks for crashes, broken numbers, impossible states and fighters stuck in one state. Every fourth match pits the
// random hand against the real CPU, so the CPU also meets opponents doing things it would never do itself.
// Usage: node tests/fuzz.js [matches, default 40] [seed, default 2024]      (exit code 1 on any problem)
const fs = require('fs'), path = require('path'), vm = require('vm');
try { const os = require('os'); os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { /* fine */ }   // long runs give way to a game being played on this PC
const root = path.join(__dirname, '..'), matches = +process.argv[2] || 40, seed0 = +process.argv[3] || 2024;
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = seed0; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'anim.js', 'render2d.js', 'hud.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const KNOWN = new Set(['idle', 'dash', 'run', 'brake', 'jsq', 'wd', 'air', 'helpless', 'airdodge', 'land', 'attack', 'shield', 'shieldstun', 'shieldoff', 'spot', 'roll', 'rebound', 'hurt', 'down', 'held', 'broken', 'hold', 'throw', 'ledge', 'respawn', 'dead']);
  const rnd = Math.random, pick = a => a[rnd() * a.length | 0];
  /* One random "hand": every control keeps a value for a random while, then picks another. Styles differ per match. */
  function hand(style) {
    const s = { lx: 0, ly: 0, cx: 0, cy: 0, atk: false, spc: false, jmp: false, shd: false, grb: false }, left = {};
    const stickVals = [0, 0, 0, 1, -1, 1, -1, 0.5, -0.5, 0.3, -0.3, 0.7, -0.7];
    return function () {
      for (const k in s) {
        if ((left[k] = (left[k] || 0) - 1) > 0) continue;
        if (k === 'lx' || k === 'ly') { s[k] = pick(stickVals); left[k] = 1 + (rnd() * (style === 'mash' ? 6 : 30) | 0); }
        else if (k === 'cx' || k === 'cy') { s[k] = rnd() < 0.06 ? pick([1, -1]) : 0; left[k] = 1 + (rnd() * 8 | 0); }
        else { const p = style === 'mash' ? 0.45 : k === 'shd' ? 0.12 : 0.18; s[k] = rnd() < p; left[k] = 1 + (rnd() * (s[k] ? (style === 'hold' ? 40 : 6) : 14) | 0); }
      }
      return Object.assign(blankIn(), s);
    };
  }
  const hands = [null, null], realCpu = cpuInput; cpuInput = (f, o, m) => hands[f.idx] ? hands[f.idx]() : realCpu(f, o, m);   /* a missing hand means the real CPU plays that side */
  const problems = [], longest = {}, seen = new Set(), moves = new Set(); let frames = 0, kos = 0;
  const note = (m, what) => { if (problems.length < 12) problems.push('match ' + m + ' frame ' + frame + ': ' + what); };
  for (let m = 0; m < ${matches}; m++) {
    slots[0] = { dev: 'kb', pick: m % 2, ready: true }; slots[1] = { dev: 'kb', pick: (m >> 1) % 2, ready: true };
    startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu');
    hands[0] = hand(pick(['calm', 'mash', 'hold'])); hands[1] = m % 4 === 3 ? null : hand(pick(['calm', 'mash', 'hold']));   /* every fourth match: random input against the CPU */
    let n = 0; const stocks = F.map(f => f.stocks);
    try {
      while (mode !== 'over' && n < 8 * 3600 + 600) {
        step(); n++; frames++;
        F.forEach((f, k) => {
          for (const q of ['x', 'y', 'vx', 'vy', 'pct', 'shieldHp', 'invuln', 'hitlag']) if (!isFinite(f[q])) note(m, f.form.name + ' ' + q + ' is ' + f[q] + ' in ' + f.state);
          if (!KNOWN.has(f.state)) note(m, 'unknown state ' + f.state); seen.add(f.state);
          if (f.grounded && !f.plat) note(m, f.form.name + ' grounded without a platform in ' + f.state);
          if (f.state === 'attack') { if (!f.move) note(m, f.form.name + ' attacking with no move'); else moves.add(f.form.name + ':' + f.mname); }
          if (f.state === 'held') { const o = F[1 - k]; if (!(o.victim === f && (o.state === 'hold' || o.state === 'throw'))) note(m, f.form.name + ' is held by nobody (other is ' + o.state + ')'); }
          if (f.state === 'hold' && !f.victim && f.sf > 1) note(m, f.form.name + ' holding nobody');
          if (f.stocks > stocks[k]) note(m, f.form.name + ' gained a stock'); if (f.stocks < stocks[k]) kos++; stocks[k] = f.stocks;
          if (f.pct < 0 || f.shieldHp > SHIELD.hp + 0.01) note(m, f.form.name + ' pct ' + f.pct + ' shield ' + f.shieldHp);
          if (f.state !== 'idle' && f.state !== 'dead') longest[f.state] = Math.max(longest[f.state] || 0, f.sf);
          const a = animState(f); if (!a || !a.key || !isFinite(a.v)) note(m, f.form.name + ' has no animation for ' + f.state);
        });
        if (n % 11 === 0) draw();
      }
    } catch (e) { note(m, 'CRASH ' + (e.stack || e).toString().split('\\n').slice(0, 3).join(' | ')); }
  }
  const stuck = Object.entries(longest).filter(([s, v]) => v > 700).map(([s, v]) => s + ' for ' + v + ' frames');
  console.log(${matches} + ' matches, ' + frames + ' frames, ' + kos + ' stocks lost, ' + seen.size + ' of ' + KNOWN.size + ' states and ' + moves.size + ' different moves reached');
  console.log('never reached: ' + ([...KNOWN].filter(s => !seen.has(s)).join(', ') || 'none'));
  console.log('longest time in one state: ' + Object.entries(longest).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0] + ' ' + e[1]).join(', '));
  if (stuck.length) console.log('POSSIBLY STUCK: ' + stuck.join(', '));
  if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log('  ' + p); process.exitCode = 1; } else console.log('ok: no crashes, broken numbers or impossible states');
})();
`);
