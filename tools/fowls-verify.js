// Re-runs every route the hunts found against the scripted defenders (FL.QUICK: no DI, four DIs, and three DI+SDI+escape mixes)
// and against other opponents and weights. A route "holds" when its worst case still chains (and still KOs, for a KO route).
// Usage: node tools/fowls-node.js tools/fowls-verify.js <dir of hunt json> <out.json>
{ const fs = FS, path = require('path'); const dir = ARGS[0], out = ARGS[1];
  const FOES = { 'Flint': [0, 0], 'Nib': [1, 0], 'Hod': [1, 2], 'Joey': [8, 0], 'Cronky': [8, 1], 'Fyrdsman': [9, 0] };
  const items = []; const seen = new Set();
  for (const fn of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) for (const r of JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8'))) {
    const add = (e, kind) => { if (!e || !e.route) return; const key = r.bird + '|' + r.pct + '|' + r.x0 + '|' + e.route.join(' '); if (seen.has(key)) return; seen.add(key); items.push({ kind, bird: r.bird, foe: r.foe, pct: r.pct, x0: r.x0, route: e.route }); };
    (r.ztd || []).slice(0, 2).forEach(e => add(e, 'ko')); if (!(r.ztd || []).length) add(r.best, 'chain'); }
  const res = [];
  for (const it of items) { const dist = +((it.route[0] || '').startsWith('@') ? it.route[0].slice(1) : 12), route = it.route.filter(s => !s.startsWith('@'));
    const base = { bird: it.bird, x0: it.x0, dist, pct: it.pct };
    const one = (foe, d) => FL.run(route, Object.assign({}, base, { foe, def: d }));
    const r0 = one(it.foe, { di: 'none' });
    const per = FL.QUICK.map(d => { const r = one(it.foe, d); return { d, hits: r.hits, dmg: r.dmg, chainKO: r.chainKO, ko: r.ko }; });
    const worst = per.reduce((a, b) => (b.chainKO ? 1000 : 0) + b.hits < (a.chainKO ? 1000 : 0) + a.hits ? b : a);
    const foes = {}; for (const [nm, fo] of Object.entries(FOES)) { const rs = FL.QUICK.map(d => one(fo, d)); foes[nm] = { noDI: rs[0].hits + (rs[0].chainKO ? 'K' : ''), worst: Math.min(...rs.map(r => r.hits)), koAll: rs.every(r => r.chainKO), koAny: rs.some(r => r.chainKO) }; }
    const row = { kind: it.kind, bird: it.bird, pct: it.pct, x0: it.x0, dist, route: route.join(' > '), noDI: { hits: r0.hits, dmg: r0.dmg, chainKO: r0.chainKO, endPct: r0.endPct }, worst: { hits: worst.hits, chainKO: worst.chainKO, def: worst.d }, koHolds: per.every(p => p.chainKO), koCount: per.filter(p => p.chainKO).length, foes };
    res.push(row); console.log(it.kind, 'b' + it.bird, it.pct + '%', 'x' + it.x0, '@' + dist, row.route, '| noDI', r0.hits + 'h', r0.chainKO ? 'KO@' + r0.endPct : r0.dmg + '%', '| KO vs', row.koCount + '/9', '| worst', worst.hits + 'h', JSON.stringify(worst.d), '|', Object.entries(foes).map(([k, v]) => k + ':' + v.noDI + '/' + v.worst + (v.koAll ? 'K' : v.koAny ? 'k' : '')).join(' '));
  }
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
}
