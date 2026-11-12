const near = v => v.state === 'hurt' && !v.grounded && v.y < 14 && v.vy < 0;
for (const mode of ['tech', 'rout']) { const base = KLAB.defender({ di: 'in', esc: 'all', gate: true });
  const def = function (v, a) { const i = base(v, a); if (near(v)) { i.shd = true; if (mode === 'rout') i.lx = -Math.sign(a.x - v.x); } return i; };
  const o = { foe: [2], pct: 0, x0: -20, dist: 9, bz: true, axe: { from: -20, face: 1 } }; o.def = def; let t = 0; const rows = [];
  KLAB.run('dtilt w3 fh rc', o, () => { t++; const v = F[1]; if (t >= 56 && t <= 100 && t % 3 === 0) rows.push(t + ' S(' + v.x.toFixed(0) + ',' + v.y.toFixed(1) + ' ' + v.state + ' g' + (+v.grounded) + ' vy' + v.vy.toFixed(1) + ' inv' + v.invuln + ' techT' + v.techT + ' tumble' + (+v.tumble) + ')'); });
  console.log('==', mode); console.log(rows.join('\n')); }
