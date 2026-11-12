// Potato Sack 0%, Berserker dtilt > recall, the Sack not mashing, teching the landing (in place, roll in, roll out) or getting up at once.
const near = v => v.state === 'hurt' && !v.grounded && v.y < 4 && v.vy < 0;
const mk = (di, mode) => { const base = KLAB.defender({ di, gate: true });
  return function (v, a) { const i = base(v, a);
    if (mode !== 'none' && mode !== 'getup' && near(v)) { i.shd = true; if (mode === 'rin') i.lx = Math.sign(a.x - v.x); if (mode === 'rout') i.lx = -Math.sign(a.x - v.x); }
    if (mode === 'getup' && v.state === 'down') i.ly = 1; if (mode === 'rollaway' && v.state === 'down') i.lx = -Math.sign(a.x - v.x); return i; }; };
for (const route of ['dtilt w3 fh rc', 'dtilt w3 sh rc']) for (const mode of ['none', 'tech', 'rin', 'rout', 'getup', 'rollaway']) {
  const row = []; for (const di of KLAB.DIS) { const o = { foe: [2], pct: 0, x0: -20, dist: 9, bz: true, axe: { from: -20, face: 1 } }; o.def = mk(di, mode);
    let tech = 0; const r = KLAB.run(route, o, () => { if (F[1].invuln === 20) tech = 1; }); row.push(di + ':' + (r.ko ? 'KO' : '--') + (tech ? 't' : '')); }
  console.log((route + ' / ' + mode).padEnd(28), row.join(' ')); }
