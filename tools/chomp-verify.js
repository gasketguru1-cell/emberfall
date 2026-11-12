// Checks Chomp Chomp routes (tools/chomp-lab.js tokens) in the real game run headless, as tools/knell-verify.js does for Knell:
// each route is replayed against every defender (9 DI directions x SDI x escape attempts, and the game's own level-9 CPU),
// against other fighters and percents, and with human timing (each token pressed 0..n frames late, many seeded trials). A route
// counts as true for a defender when the game's own combo counter never resets before the last hit (or the KO). Nothing in the
// game is changed.
//   node tools/chomp-verify.js job.json     job: { routes: [{ name, route, sit, def? }], out, foes?, pcts?, late?, trials?, quick? }
require('./chomp-node.js');
global.JOB = JSON.parse(FS.readFileSync(process.argv[2], 'utf8'));
RUN(function () {
  const J = JOB, K = CLAB, out = [];
  const R = (route, sit, def, late) => K.run(route, Object.assign({}, sit, { def, late, maxFrames: 2400, tail: 320, koTail: 5 }));
  const lastT = r => r.log.length ? r.log[r.log.length - 1].t : -1;
  const ok = r => r.firstReset < 0 || r.firstReset > lastT(r) || (r.ko && r.koHurt && r.firstReset >= r.koT);
  /* a kill route must still kill; a damage route must still land every hit */
  const full = (r, base) => ok(r) && r.hits >= base.hits && (!(base.ko && base.koHurt) || (r.ko && r.koHurt));
  const brief = r => ({ hits: r.hits, dmg: r.dmg, ko: r.ko && r.koHurt, resets: r.resets, firstReset: r.firstReset, endPct: r.endPct, failedAt: r.failedAt, ant: r.antHits, coal: r.coalHits });
  for (const it of J.routes) {
    /* it.def: the defender the route was found against (a DI spec); the baseline and the timing trials use it */
    const bd = () => it.def ? K.defender(Object.assign({ gate: true }, it.def)) : null;
    const sit = it.sit, base = R(it.route, sit, bd()), rec = { name: it.name, route: it.route, sit, base: brief(base), di: {}, diOK: [], cpu9: null, foes: {}, pcts: {}, late: {} };
    let pass = 0, tot = 0;
    const sdis = J.quick ? [''] : (J.sdi || ['', 'in', 'out', 'up', 'down']), escs = J.quick ? ['none', 'all'] : (J.esc || ['none', 'jump', 'ad', 'atk', 'shield', 'all']);
    for (const di of K.DIS) for (const sdi of sdis) for (const esc of escs) {
      const d = K.defender({ di, sdi: sdi || undefined, esc, gate: true }), r = R(it.route, sit, d); tot++;
      if (full(r, base)) { pass++; if (!sdi && esc === 'none') rec.diOK.push(di); } else rec.di[d.desc] = brief(r);
    }
    rec.defPass = pass + '/' + tot;
    const c = R(it.route, sit, 'cpu9'); rec.cpu9 = brief(c); rec.cpu9.ok = full(c, base);
    for (const fo of (J.foes || [])) { const r = R(it.route, Object.assign({}, sit, { foe: fo }), bd()); rec.foes[ROSTER[fo[0]].name + (fo[1] ? '/' + fo[1] : '')] = Object.assign(brief(r), { ok: full(r, base) }); }
    for (const p of (J.pcts || [])) { const r = R(it.route, Object.assign({}, sit, { pct: p }), bd()); rec.pcts[p] = Object.assign(brief(r), { ok: ok(r) && r.hits >= base.hits }); }
    for (const n of (J.late || [1, 2, 3, 4, 6])) {   /* a human: every token pressed 0..n frames after it could be */
      let good = 0; const T = J.trials || 40;
      for (let s = 0; s < T; s++) { let q = 99991 * (s + 1) + n * 7; const late = () => { q = (q * 1103515245 + 12345) >>> 0; return (q >>> 16) % (n + 1); }; const r = R(it.route, sit, bd(), late); if (full(r, base)) good++; }
      rec.late[n] = good + '/' + T;
    }
    out.push(rec); console.log(it.name + ': base ' + base.hits + ' hits ' + base.dmg + '% ko ' + (base.ko && base.koHurt) + ' ant ' + base.antHits + ' | defenders ' + rec.defPass + ' DI ok [' + rec.diOK.join(' ') + '] | cpu9 ' + rec.cpu9.ok + ' | late ' + JSON.stringify(rec.late));
  }
  FS.writeFileSync(J.out, JSON.stringify(out, null, 1));
});
