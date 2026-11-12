// Offstage. Part A, edgeguards: the opponent (the game's level-9 CPU, which recovers by itself) starts in the air beyond the
// right ledge with its jumps; the Viking stands near the ledge and runs a route after a delay. Did it KO, did the opponent get
// back (ledge or stage), did the Viking die. Part B, recovery: the Viking alone in the air beyond the ledge, jumps left 0 or 1,
// each recovery route; does he reach the ledge or the stage. ARGS: foes (comma list, default 0,3,8,2), pct (default 80).
const foes = (ARGS[0] || '0,3,8,2').split(',').map(Number), pct = +(ARGS[1] || 80);
const A = [], B = [];
function place(g, x, y, face, jumps) { g.x = x; g.y = y; g.vx = g.vy = 0; g.grounded = false; g.plat = null; g.set('air'); g.face = face; if (jumps !== undefined) g.jumps = jumps; g.sideUsed = false; }
function run(route, f, v, T, vIn) {
  const e = KLAB.exec(route, { patience: 120 }); let rt = 0; KLAB.vIn = vIn;
  /* once the route is over and the Viking is beyond the ledge, he recovers the way a player would: drift in, jump, then up-B */
  KLAB.kIn = (ff, oo) => { if (!KLAB.finished(e) || ff.grounded || Math.abs(ff.x) < EDGE - 2 || ff.state === 'ledge') return KLAB.input(e, ff, oo); const i = blankIn(); rt++; const d = -sgn(ff.x);
    if (ff.state === 'air' && ff.vy < 0 && ff.jumps > 0 && rt % 2) { i.jmp = true; i.lx = d; } else if (ff.state === 'air' && ff.jumps === 0 && !ff.sideUsed && Math.abs(ff.x) - EDGE > 28 && ff.y > -30 && rt % 2) { if (ff.face !== d) i.lx = d; else { i.lx = d; i.spc = true; } } else if (ff.state === 'air' && ff.jumps === 0 && ff.y < 15 && rt % 2) { i.ly = 1; i.spc = true; } else i.lx = d; return i; };
  const k0 = f.kos, d0 = v.kos; let best = 0, dmg = 0, back = false, koT = -1, ledge = false;
  for (let t = 0; t < T; t++) {
    step(); KLAB.after(e, f);
    const c = COMBO[0].hits; if (c > best) { best = c; dmg = +COMBO[0].dmg.toFixed(1); }
    if (f.kos > k0) { koT = t; break; }
    if (v.kos > d0) break;
    if (v.state === 'ledge') ledge = true;
    if (v.grounded && v.plat && Math.abs(v.x) < EDGE) { back = true; if (t > 60 && KLAB.finished(e)) break; }
  }
  KLAB.kIn = KLAB.vIn = null;
  return { hits: best, dmg, ko: koT >= 0, koT, foeBack: back || ledge, ledge, vikingDied: v.kos > d0 };
}
const routes = ['w90', 'throw', 'throw w20 rc', 'sh throwA', 'fh throwA', 'sspec', 'sh fair', 'fh fair', 'fh dair', 'rf10 fair', 'rf10 dair', 'rf10 dj fair', 'rf10 dj dair', 'rf10 throwA', 'rf10 throwA w10 rc', 'rf10 sspecA', 'rf10 nair', 'sh throwA w10 rc', 'throw w40 rc', 'fsmash', 'dsmash', 'dspec'];
for (const foe of foes) for (const dx of [25, 45, 65]) for (const y of [-25, 0, 25]) for (const w of [0, 15, 30]) for (const r of routes) {
  const [f, v] = VLAB.setup({ foe: [foe], pct, x0: 58, dist: 40 });
  place(v, EDGE + dx, y, -1); f.face = 1;
  const res = run((w ? ['w' + w] : []).concat(r.split(' ')), f, v, 360, 'cpu9');
  A.push(Object.assign({ foe: ROSTER[foe].name, dx, y, wait: w, route: r }, res));
}
/* Part B */
const rec = ['uspec', 'uspec_f', 'dj uspec_f', 'sspecA', 'sspecA uspec_f', 'dj sspecA uspec_f', 'sspecA dj uspec_f', 'dj w10 sspecA w5 uspec_f', 'throwA hs', 'dj', 'sspecA dj', 'dj sspecA'];
for (const bz of [false, true]) for (const jumps of [1, 0]) for (const dx of [10, 30, 50, 70, 90, 110, 130]) for (const y of [-80, -60, -40, -20, 0, 20, 40]) for (const r of rec) {
  if (jumps === 0 && r.includes('dj')) continue;
  const [f, v] = VLAB.setup({ foe: [0], pct: 0, x0: -40, dist: -20, bz });
  v.x = -60; place(f, EDGE + dx, y, -1, jumps);
  const e = KLAB.exec(r.split(' '), { patience: 120 }); KLAB.kIn = (ff, oo) => KLAB.input(e, ff, oo); KLAB.vIn = () => { const i = blankIn(); return i; };
  /* after the route, the stick held toward the stage */
  const d0 = f.kos, dd0 = v.kos; let ok = '', t = 0;
  const kin = KLAB.kIn, hold = !r.includes('throwA'); KLAB.kIn = (ff, oo) => { const i = kin(ff, oo); if (KLAB.finished(e) || (hold && !((i.spc || i.jmp) && f.state !== 'attack'))) { i.lx = -1; } return i; };   /* a player holds toward the stage the whole way (except the throw, where the stick would make it Side-B) */
  for (; t < 420; t++) { step(); KLAB.after(e, f); if (v.kos > dd0 || f.y < -130) { ok = 'died'; break; } if (f.state === 'ledge') { ok = 'ledge'; break; } if (f.grounded && f.plat) { ok = 'stage'; break; } }
  KLAB.kIn = KLAB.vIn = null;
  B.push({ bz, jumps, dx, y, route: r, result: ok || 'timeout', t });
}
const okB = B.filter(b => b.result === 'ledge' || b.result === 'stage');
console.log('A', A.length, 'kos', A.filter(a => a.ko).length, 'B ok', okB.length, '/', B.length);
if (OUT) FS.writeFileSync(OUT, JSON.stringify({ pct, A, B }, null, 0));
