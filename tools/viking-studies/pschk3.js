for (const [foe, bz, route, di] of [[2, true, 'dtilt w3 fh rc', 'in'], [2, true, 'dtilt w3 fh rc', 'up'], [2, false, 'dtilt w90', 'down'], [3, false, 'dtilt w90', 'di']]) {
  const o = { foe: [foe], pct: 0, x0: -20, dist: 9, bz, axe: { from: -20, face: 1 } }; o.def = KLAB.defender({ di, esc: 'all', gate: true });
  const r = KLAB.run(route, o); console.log(ROSTER[foe].name, bz, route, di, JSON.stringify({ ko: r.ko, koT: r.koT, koHits: r.koHits, koHurt: r.koHurt, hits: r.hits, dmg: r.dmg })); }
