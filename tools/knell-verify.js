// Checks Knell routes (tools/knell-lab.js tokens) in the real game run headless: each route is replayed against every defender
// (9 DI directions x SDI x escape attempts, and the game's own level-9 CPU), against other weights and percents, and with human
// timing (each token pressed 0..n frames late, many seeded trials). A route counts as true for a defender when the game's own
// combo counter never resets before the last hit (or the KO). Nothing in the game is changed.
//   node tools/knell-verify.js job.json     job: { routes: [{ name, route, sit }], out, foes?, pcts?, late?, trials? }
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'tools/knell-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
global.JOB = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); global.FS = fs;
vm.runInThisContext(`
(function () {
  const J = JOB, K = KLAB, out = [];
  const R = (route, sit, def, late) => K.run(route, Object.assign({}, sit, { def, late, maxFrames: 2400, tail: 320, koTail: 5 }));
  const lastT = r => r.log.length ? r.log[r.log.length - 1].t : -1;
  /* true: the counter never dropped before the last hit (its drop after the last hit is just the combo ending), or a KO in hitstun first */
  const ok = r => r.firstReset < 0 || r.firstReset > lastT(r) || (r.ko && r.koHurt && r.firstReset >= r.koT);
  const brief = r => ({ hits: r.hits, dmg: r.dmg, ko: r.ko && r.koHurt, resets: r.resets, firstReset: r.firstReset, endPct: r.endPct, failedAt: r.failedAt });
  for (const it of J.routes) {
    const sit = it.sit, base = R(it.route, sit, null), rec = { name: it.name, route: it.route, sit, base: brief(base), di: {}, cpu9: null, foes: {}, pcts: {}, late: {} };
    let pass = 0, tot = 0;
    const sdis = J.sdi || ['', 'in', 'out', 'up', 'down'], escs = J.esc || ['none', 'jump', 'ad', 'atk', 'shield', 'all'];
    for (const di of K.DIS) for (const sdi of sdis) for (const esc of escs) {
      const d = K.defender({ di, sdi: sdi || undefined, esc, gate: true }), r = R(it.route, sit, d); tot++;
      const good = ok(r) && r.hits >= base.hits;
      if (good) pass++; else rec.di[d.desc] = brief(r);
    }
    rec.defPass = pass + '/' + tot;
    const c = R(it.route, sit, 'cpu9'); rec.cpu9 = brief(c); rec.cpu9.ok = ok(c) && c.hits >= base.hits;
    for (const fo of (J.foes || [[0, 0], [8, 0], [2, 0], [4, 0], [3, 0]])) { const r = R(it.route, Object.assign({}, sit, { foe: fo }), null); rec.foes[ROSTER[fo[0]].name + (fo[1] ? '/' + fo[1] : '')] = Object.assign(brief(r), { ok: ok(r) }); }
    for (const p of (J.pcts || [0, 20, 40, 60, 90])) { const r = R(it.route, Object.assign({}, sit, { pct: p }), null); rec.pcts[p] = Object.assign(brief(r), { ok: ok(r) && r.hits >= base.hits }); }
    for (const n of (J.late || [1, 2, 3, 4, 6])) {   /* a human: every token pressed 0..n frames after it could be */
      let good = 0; const T = J.trials || 40;
      for (let s = 0; s < T; s++) { let q = 99991 * (s + 1) + n * 7; const late = () => { q = (q * 1103515245 + 12345) >>> 0; return (q >>> 16) % (n + 1); }; const r = R(it.route, sit, null, late); if (ok(r) && r.hits >= base.hits) good++; }
      rec.late[n] = good + '/' + T;
    }
    out.push(rec); console.log(it.name + ': base ' + base.hits + ' hits ' + base.dmg + '% ko ' + (base.ko && base.koHurt) + ' | defenders ' + rec.defPass + ' | cpu9 ' + rec.cpu9.ok + ' | late ' + JSON.stringify(rec.late));
  }
  FS.writeFileSync(J.out, JSON.stringify(out, null, 1));
})();
`, { filename: 'knell-verify' });
