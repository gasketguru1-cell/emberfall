// The lowest percent each kill confirm KOs from, per DI (the escape-mashing defender that holds the DI from before the first
// hit), on several opponents. A KO under every DI is a kill confirm that does not depend on the opponent's choice.
const foes = (ARGS[0] || '0,3,2,4,8').split(',').map(Number), out = {};
const finds = {
  'grab f, recall (axe on the left platform)': { sit: { x0: -20, dist: 9, axe: { from: -40 } }, route: 'grab_f w18 rc' },
  'grab f, recall, bair (axe on the platform)': { sit: { x0: -20, dist: 9, axe: { from: -40 } }, route: 'grab_f w20 rc w7 fh w9 bair' },
  'Berserker forward smash': { sit: { x0: -20, dist: 9, bz: true }, route: 'fsmash' },
  'Berserker up smash': { sit: { x0: -20, dist: 9, bz: true }, route: 'usmash' },
  'Berserker Side-B': { sit: { x0: -20, dist: 9, bz: true }, route: 'sspec' },
  'Berserker dtilt, recall (axe far)': { sit: { x0: -20, dist: 9, bz: true, axe: { from: -20, face: 1 } }, route: 'dtilt w3 fh rc' },
  'up-B, recall (axe far)': { sit: { x0: -20, dist: 9, axe: { from: -20, face: 1 } }, route: 'fh w9 uspec w7 rc' },
  'forward smash (axe in hand)': { sit: { x0: -20, dist: 9 }, route: 'fsmash' },
  'recall at full range (axe far, Viking at -12)': { sit: { x0: -12, dist: 9, axe: { from: -20, face: 1 } }, route: 'rc' },
};
for (const [name, F0] of Object.entries(finds)) { out[name] = {};
  for (const foe of foes) { const row = {};
    for (const di of KLAB.DIS) { let min = null;
      for (let pct = 0; pct <= 200; pct += 5) { const o = Object.assign({ foe: [foe], pct }, JSON.parse(JSON.stringify(F0.sit))); o.def = KLAB.defender(ARGS[1] === 'diOnly' ? { di, gate: true } : { di, esc: 'all', gate: true });
        const r = KLAB.run(F0.route, o); if (r.ko) { min = pct; break; } }
      row[di] = min; }
    const vals = Object.values(row); row.worst = vals.includes(null) ? null : Math.max(...vals); out[name][ROSTER[foe].name] = row;
    console.log(name.padEnd(46), ROSTER[foe].name.padEnd(12), JSON.stringify(row)); } }
if (OUT) FS.writeFileSync(OUT, JSON.stringify(out, null, 1));
