// Level 10 CPU checks (cpu10.js, the Furious Fowls planner).
//   node tests/cpu10.js
// 1. Planning leaves the match exactly as it was: after a level 10 decision the match checksum is unchanged.
// 2. It plays the same every time (its allowance is counted in frames; the wall-clock safety stop is switched off here).
// 3. It does what it is for: in a minute against level 9 Flint it lands a combo of 5 hits or more and takes a stock.
// 4. Other levels are untouched: a level 9 match plays out identically with cpu10.js loaded or not.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const src = f => [f, fs.readFileSync(path.join(root, f), 'utf8')];
const BASE = ['hitboxes.js', 'sim.js', 'net.js'].map(src), PRO = src('cpu10.js');
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };

function machine(withPro) {
  const g2 = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
  let seed = 99; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const M = Object.create(Math); M.random = rnd;
  const ctx = vm.createContext({ console, Math: M, Date, performance: { now: () => Date.now() }, localStorage: { getItem() { return null; }, setItem() {} },
    document: { getElementById: () => ({ getContext: () => g2, addEventListener() {}, style: {} }), addEventListener() {} }, addEventListener() {}, requestAnimationFrame() {}, navigator: {}, window: undefined });
  for (const [f, s] of withPro ? BASE.concat([PRO]) : BASE) vm.runInContext(s, ctx, { filename: f });
  vm.runInContext('if (typeof CPU10 !== "undefined") CPU10.safetyMs = 0;', ctx);
  return ctx;
}
/* Fowls (level lv) against Flint (level 9), CPU against CPU, for n frames; returns what happened */
function match(ctx, lv, n) {
  return vm.runInContext(`(() => {
    TRAINING = false; slots[0] = { dev: 'cpu', pick: 5, ready: true }; slots[1] = { dev: 'cpu', pick: 0, ready: true }; startMatch();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].ctl.ai.lv = ${lv}; F[1].ctl.ai.lv = 9; mode = 'play'; countdown = 0;
    let best = 0, untouched = true, decisions = 0;
    for (let k = 0; k < ${n} && mode === 'play'; k++) {
      if (${lv} === 10 && k % 7 === 0) {   /* ask for a decision outside the step and see that the match is just as it was */
        const h0 = NET.hash(), m = F[0].ctl.ai, keep = JSON.stringify(m); cpuInput(F[0], F[1], m); decisions++;
        if (NET.hash() !== h0) untouched = false; Object.keys(m).forEach(q => delete m[q]); Object.assign(m, JSON.parse(keep));
      }
      step(); best = Math.max(best, COMBO[0].hits || 0);
    }
    return { best, untouched, decisions, hash: NET.hash(), taken: 3 - F[1].stocks, lost: 3 - F[0].stocks };
  })()`, ctx);
}

const a = match(machine(true), 10, 3600), b = match(machine(true), 10, 3600);
check(a.untouched, `planning leaves the match as it was (${a.decisions} decisions checked)`);
check(a.hash === b.hash, 'level 10 plays the same every time');
check(a.best >= 5, `level 10 Fowls lands a combo of 5 or more against level 9 Flint (longest ${a.best})`);
check(a.taken >= 1 && a.taken > a.lost, `level 10 Fowls comes out ahead in a minute (stocks taken ${a.taken}, lost ${a.lost})`);
const c = match(machine(true), 9, 3600), d = match(machine(false), 9, 3600);
check(c.hash === d.hash, 'a level 9 match is the same with or without cpu10.js');
console.log(fails ? fails + ' failed' : 'all level 10 checks pass');
process.exit(fails ? 1 : 0);
