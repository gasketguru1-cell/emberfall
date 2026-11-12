// Does the Berserker dtilt alone KO Potato Sack / Sprocket at 0% if the run is long enough? And without Berserker?
for (const foe of [2, 3]) for (const bz of [true, false]) for (const route of ['dtilt w90', 'dtilt w3 fh rc', 'dtilt w3 fh w60']) {
  const row = []; for (const di of KLAB.DIS) { const o = { foe: [foe], pct: 0, x0: -20, dist: 9, bz, axe: { from: -20, face: 1 } };
    o.def = KLAB.defender({ di, esc: 'all', gate: true }); const r = KLAB.run(route, o); row.push(di + ':' + (r.ko ? 'KO' : '--') + r.hits + 'h'); }
  console.log((ROSTER[foe].name + (bz ? ' BZ ' : ' ') + '| ' + route).padEnd(36), row.join(' ')); }
