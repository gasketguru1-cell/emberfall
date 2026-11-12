for (const [bz, route, di] of [[true, 'dtilt w3 fh rc', 'in'], [false, 'dtilt w90', 'down'], [true, 'dtilt w90', 'in']]) {
  const o = { foe: [2], pct: 0, x0: -20, dist: 9, bz, axe: { from: -20, face: 1 } }; o.def = KLAB.defender({ di, esc: 'all', gate: true });
  let t = 0; const rows = []; KLAB.run(route, o, () => { t++; const v = F[1], f = F[0]; if (t % 8 === 0 || v.state === 'dead') rows.push(t + ' V(' + f.x.toFixed(0) + ',' + f.y.toFixed(0) + ' ' + f.state + ') S(' + v.x.toFixed(0) + ',' + v.y.toFixed(0) + ' ' + v.state + (v.hitstun ? ' hs' + v.hitstun : '') + ')'); });
  console.log('==', bz, route, di); console.log(rows.slice(0, 22).join('\n')); }
