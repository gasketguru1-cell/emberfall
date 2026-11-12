// Recall distance power: the axe thrown for real from x = -20 (it sticks at x 55.9 on the floor), the Viking standing at x0 so
// the axe is D away, the opponent 8 units in front of him (between him and the axe). He recalls (rc). For each D: t, the hit's
// damage, and the lowest percent (steps of 2) at which the hit KOs, with no DI and with the best survival DI of the nine.
const res = [], foes = [[0, 'Flint'], [8, '?'], [3, '?']];
const name = i => ROSTER[i].name;
const koAt = (x0, foe, di) => { for (let p = 0; p <= 200; p += 2) { const r = KLAB.run('rc w10', { foe: [foe], pct: p, x0, dist: 8, axe: { from: -20 }, def: di ? KLAB.defender({ di }) : null, maxFrames: 400, tail: 260 }); if (r.hits && r.ko && r.koHurt) return p; } return null; };
for (const x0 of [-12, 0, 10, 20, 30, 40]) {
  const [f] = VLAB.setup({ x0, dist: 8, axe: { from: -20 } }); const p = f.axe, t = vTier(f, p);
  const r0 = KLAB.run('rc w10', { foe: [0], pct: 0, x0, dist: 8, axe: { from: -20 }, maxFrames: 300 });
  const row = { x0, D: +Math.hypot(p.x - f.x, p.y - (f.y + f.st.h * 0.5)).toFixed(1), t: +t.toFixed(2), formula: vAxeHit(t).d, dealt0: r0.dmg, hit: r0.hits };
  for (const fo of [0, 3, 8]) { row[name(fo) + '_noDI'] = koAt(x0, fo, null); let best = -1; for (const di of KLAB.DIS) { const k = koAt(x0, fo, di); if (k === null) { best = null; break; } best = Math.max(best, k); } row[name(fo) + '_bestDI'] = best; }
  res.push(row); console.log(JSON.stringify(row));
}
if (OUT) FS.writeFileSync(OUT, JSON.stringify(res, null, 1));
