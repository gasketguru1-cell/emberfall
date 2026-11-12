const near = v => v.state === 'hurt' && !v.grounded && v.y < 4 && v.vy < 0;
for (const route of ['dtilt w3 sh rc', 'dtilt w3 fh rc']) for (const mode of ['mash', 'nomash', 'tech']) { const row = [];
  for (const di of KLAB.DIS) { const base = KLAB.defender(mode === 'mash' ? { di, esc: 'all', gate: true } : { di, gate: true });
    const o = { foe: [0], pct: 0, x0: -20, dist: 9, bz: true, axe: { from: -20, face: 1 } }; o.def = mode === 'tech' ? (v, a) => { const i = base(v, a); if (near(v)) i.shd = true; return i; } : base;
    const r = KLAB.run(route, o); row.push(di + ':' + (r.ko ? 'KO' : '--') + r.hits + 'h'); }
  console.log(('Flint ' + route + ' / ' + mode).padEnd(30), row.join(' ')); }
