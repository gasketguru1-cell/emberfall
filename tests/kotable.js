// At what percent does each attack KO? For every form and every hit, finds the lowest starting percent at which an
// uncharged, fresh hit carries a standing victim past a blast zone before it regains control (no DI, no rage).
// Two positions: centre stage, and at the edge with the attacker hitting outward.
// Usage: node tests/kotable.js [victimFormIndex 0-3, default 0 = Flint]
const fs = require('fs'), path = require('path'), vm = require('vm');
try { const os = require('os'); os.setPriority(os.constants.priority.PRIORITY_LOW); } catch (e) { /* fine */ }   // long runs give way to a game being played on this PC
const root = path.join(__dirname, '..'), victim = +process.argv[2] || 0;
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 99; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0], [1, 0], [1, 1], [1, 2], [2, 0], [3, 0]], V = forms[${victim}];
  /* One trial: does this hit, landed at percent p with the victim standing at x0, KO? */
  function trial(A, name, hi, p, x0, thrown) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: V[0], ready: true };
    startMatch(); let guard = 0; while (mode !== 'play' && guard++ < 400) step();
    const a = F[0], v = F[1]; a.fi = A[1]; v.fi = V[1];
    const mv = a.form.moves[name], h = thrown ? a.form.moves.throws[name] : mv.h[hi], back = h.a > 90 && h.a < 270 && h.a !== 361 || h.x < -2;
    /* the attacker faces so that the hit sends the victim toward the nearer blast zone */
    const face = back ? -1 : 1;
    a.x = x0 - 9 * (back ? -1 : 1) * (h.x < -2 ? -1 : 1); a.y = 0; a.face = face; v.x = x0; v.y = 0; v.pct = p; v.invuln = 0; a.invuln = 0;
    const air = !thrown && mv.air; if (air) { v.y = 12; v.grounded = false; v.plat = null; }   /* aerials are measured on a victim just off the ground */
    const stocks = v.stocks;
    if (thrown) { const d = h.d * DMG_1V1; v.grounded = false; v.plat = null; v.pct += d; v.launch(knock(v, d, h.b, h.k), h.a * Math.PI / 180, face); }
    else { a.mname = name; a.move = mv; a.charge = 0; a.staled = false; a.moveSH = false; applyHit(a, v, h, face, a.x, false); a.move = null; }
    let after = 0;
    for (let n = 0; n < 400; n++) { step(); if (v.stocks < stocks) return true; if (v.state !== 'hurt') { if (v.y < -4 || ++after > 25) return false; } }
    return false;
  }
  function koAt(A, name, hi, x0, thrown) { if (!trial(A, name, hi, 300, x0, thrown)) return '-'; let lo = 0, hi2 = 300; while (hi2 - lo > 2) { const m = (lo + hi2) >> 1; if (trial(A, name, hi, m, x0, thrown)) hi2 = m; else lo = m; } return hi2; }
  const out = {};
  for (const A of forms) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: V[0], ready: true }; startMatch(); F[0].fi = A[1];
    const fm = F[0].form, row = out[fm.name] = {};
    for (const [name, mv] of Object.entries(fm.moves)) {
      if (name === 'throws' || !mv || !Array.isArray(mv.h) || !mv.h.length || mv.h[0].grab) continue;
      const hi = mv.h.length - 1, h = mv.h[hi];
      row[name] = h.d + ' dmg  ' + koAt(A, name, hi, 0, false) + ' / ' + koAt(A, name, hi, 72, false);
    }
    for (const k of ['f', 'b', 'u', 'd']) row['throw ' + k] = fm.moves.throws[k].d + ' dmg  ' + koAt(A, k, 0, 0, true) + ' / ' + koAt(A, k, 0, 72, true);
  }
  const names = [...new Set(Object.values(out).flatMap(r => Object.keys(r)))], table = {};
  for (const n of names) { table[n] = {}; for (const f in out) table[n][f] = out[f][n] || ''; }
  console.log('KO percent, centre / edge, against ' + ['Flint', 'Nib', 'Loom', 'Hod'][${victim}] + ' (- means never below 300%)');
  console.table(table);
})();
`);
