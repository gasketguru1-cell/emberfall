// Checks the Berserker dtilt + recall route on Potato Sack and Sprocket at 0%, every DI, and the dtilt alone.
const out = {};
for (const foe of [2, 3, 0]) for (const route of ['dtilt w3 fh rc', 'dtilt', 'dtilt w3 rc', 'dtilt w3 sh rc'])
  for (const di of KLAB.DIS) { const o = { foe: [foe], pct: 0, x0: -20, dist: 9, bz: true, axe: { from: -20, face: 1 } };
    o.def = KLAB.defender({ di, esc: 'all', gate: true }); const r = KLAB.run(route, o);
    const k = ROSTER[foe].name + ' | ' + route; (out[k] = out[k] || {})[di] = (r.ko ? 'KO ' : '') + r.hits + 'h ' + (+r.dmg).toFixed(1); }
for (const k in out) console.log(k.padEnd(34), Object.entries(out[k]).map(([a, b]) => a + ':' + b).join('  '));
