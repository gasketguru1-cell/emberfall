// Potato Sack's Spud Drill (back air): the owner's numbers (8% in all, hitting for 0.45 s) and the three-drill chain
// from 0% on Flint. Usage: node tests/sack.js        (exit code 1 if any check fails)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'movelist.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const SI = ROSTER.findIndex(d => d.name === 'Potato Sack'), bair = ROSTER[SI].forms[0].moves.bair, results = [];
  let SCRIPT = [null, null], t = 0;
  cpuInput = function (f) { const i = blankIn(); if (SCRIPT[f.idx]) SCRIPT[f.idx](i, t, f); return i; };
  const check = (name, ok, detail) => results.push([ok, name, detail || '']);
  function setup(gap) {
    slots[0] = { dev: 'kb', pick: SI, ready: true }; slots[1] = { dev: 'kb', pick: 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].x = 60; F[1].x = 60 - gap; F[0].face = 1; F[1].face = 1; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; SCRIPT = [null, null]; t = 0; return F;
  }
  /* the numbers */
  { const hits = bair.h, total = hits.reduce((a, h) => a + (h.d || 0), 0), first = Math.min(...hits.map(h => h.f0)), last = Math.max(...hits.map(h => h.f1));
    check('Spud Drill: 8% in all over seven hits, hitting from frame 6 to 32 (27 frames, 0.45 s)', Math.abs(total - 8) < 1e-9 && hits.length === 7 && first === 6 && last === 32 && last - first + 1 === 27,
      total.toFixed(1) + '% in ' + hits.length + ' hits, frames ' + first + ' to ' + last); }
  /* the chain: a short-hop drill, land and short-hop another, then a double-jump drill; every drill's first hit lands on a
     target still in hitstun. plan: per drill, jump delay after he is free (dj), short hop (sh), drift back (drift), and the
     attack press after the jump (da). */
  function play(plan) {
    const [s, f] = setup(6); let k = 0, phase = 'wait', free = 0, jumped = -1, p = 0, drills = 0, wasStun = false, firstOf = true, bad = '';
    SCRIPT[0] = (i, tt, me) => {
      if (k >= plan.length) return; const P = plan[k];
      if (me.state === 'attack' || me.state === 'land' || me.state === 'jsq') { if (me.state !== 'jsq') phase = 'wait'; return; }
      if (phase === 'wait') { phase = 'go'; free = tt; jumped = -1; }
      const back = Math.sign(f.x - me.x) || -1; i.lx = P.drift * back;
      if (jumped < 0 && tt >= free + P.dj) jumped = tt;
      if (jumped >= 0 && (!P.sh || tt === jumped) && tt < jumped + 6) i.jmp = true;
      if (tt >= jumped + P.da && tt < jumped + P.da + 2 && !me.grounded) { i.atk = true; i.lx = back; i.ly = 0; if (tt === jumped + P.da) k++; }
    };
    for (let n = 0; n < 400; n++) { wasStun = f.state === 'hurt' || f.hitlag > 0; step(); t++;
      if (s.state === 'attack' && s.mname === 'bair' && s.mf === 1) firstOf = true;
      if (f.pct > p + 0.01) { if (s.mname !== 'bair' || s.state !== 'attack') { bad = 'another move hit'; break; } if (drills > 0 && firstOf && !wasStun) { bad = 'drill ' + (drills + 1) + ' was not a combo'; break; }
        firstOf = false; if (s.mf >= 30) drills++; p = f.pct; } }
    return { drills, pct: f.pct, bad, n: s.drillN };
  }
  const r = play([{ dj: 0, sh: 1, drift: 0, da: 6 }, { dj: 3, sh: 1, drift: 1, da: 4 }, { dj: 0, sh: 1, drift: 0, da: 1 }]);
  check('Spud Drill chains into itself three times from 0% (short hop, land and short hop, double jump)', r.drills === 3 && !r.bad && r.n === 3, r.drills + ' drills, ' + r.pct.toFixed(1) + '%' + (r.bad ? ', ' + r.bad : ''));
  check('the third drill in a row ends with a real launch, the first two with the pop', bair.h[6].dyn({ drillN: 3 }).k > bair.h[6].dyn({ drillN: 2 }).k && bair.h[6].dyn({ drillN: 3 }).hs === 0 && bair.h[6].dyn({ drillN: 1 }).hs === 20);
  let fail = 0;
  for (const [ok, name, detail] of results) { if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '\\n       ' + detail : '')); }
  console.log(results.length + ' checks, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})();`, { filename: 'sack-tests' });
