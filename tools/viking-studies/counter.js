// Counter and homing axe. The Viking presses down special (dspec) on frame 0; the opponent (Flint unless ARGS[0]) presses an attack
// toward him on frame vAt. For each axe placement and each vAt: did the counter catch it, how many hits (the game's counter),
// damage, a KO, and the frame advantage (frames the Viking is free before the opponent is). Then from the best counter of each
// placement, the follow-ups tried by hand: dash attack, a jump and an aerial, the throw, the recall.
const foe = +(ARGS[0] || 0), pct0 = +(ARGS[1] || 40), rows = [];
const places = { hand: null, stuckFar: { from: -20 }, stuckNear: { from: 30, face: -1 }, plat: { from: -40 }, flying: 'fly' };
const atks = { jab: i => { i.atk = true; }, ftilt: (i, d) => { i.lx = 0.6 * d; i.atk = true; }, fsmash: (i, d) => { i.lx = d; i.sm = true; i.atk = true; } };
function trial(pl, an, vAt, follow) {
  const o = { foe: [foe], pct: pct0, x0: -20, dist: 9 };
  if (pl && pl !== 'fly') o.axe = pl;
  const [f, v] = VLAB.setup(o); let route = pl === 'fly' ? ['throw', 'dspec'] : ['dspec'];
  if (follow) route = route.concat(follow.split(' '));
  const e = KLAB.exec(route, { patience: 200 }); let vt = 0, countered = -1, homeHit = -1, hits = 0, best = 0, dmg = 0, ko = false, vFree = -1, fFree = -1, t0 = -1;
  KLAB.kIn = (ff, oo) => KLAB.input(e, ff, oo);
  let ds = -1;   /* the opponent's press, vAt frames after the counter starts */
  KLAB.vIn = (vv, aa) => { const i = blankIn(); vt++; if (ds < 0 && aa.mname === 'dspec' && aa.state === 'attack') ds = vt; if (ds >= 0 && (vt === ds + vAt || vt === ds + vAt + 1)) atks[an](i, sgn(aa.x - vv.x)); return i; };
  const kos0 = f.kos; let prevH = 0, axeHits = 0;
  for (let t = 0; t < 400; t++) {
    const st0 = f.axe ? f.axe.st : null, gh0 = f.axe ? f.axe.ghost : true;
    step(); KLAB.after(e, f);
    if (countered < 0 && f.mname && f.mname.startsWith('dspecHit') && f.mf <= 1) { countered = t; t0 = t; }
    if (f.axe && !gh0 && f.axe.ghost && (st0 === 'home' || st0 === 'recall')) { axeHits++; if (homeHit < 0) homeHit = t; }
    const c = COMBO[0].hits; if (c > best) { best = c; dmg = +COMBO[0].dmg.toFixed(1); }
    if (f.kos > kos0) { ko = true; break; }
    if (countered >= 0 && t > countered + 2) { if (fFree < 0 && (f.state === 'idle' || f.state === 'air' || f.state === 'run')) fFree = t; if (vFree < 0 && v.state !== 'hurt' && !(v.hitlag > 0) && v.state !== 'attack') vFree = t; }
    if (countered >= 0 && KLAB.finished(e) && vFree >= 0 && fFree >= 0 && t > countered + 120) break;
    if (countered < 0 && t > 200) break;
  }
  KLAB.kIn = KLAB.vIn = null;
  return { place: Object.keys(places).find(k => places[k] === pl), atk: an, vAt, follow: follow || '', countered: countered >= 0, axeHits, hits: best, dmg, ko, endPct: +v.pct.toFixed(1), adv: countered >= 0 && vFree >= 0 && fFree >= 0 ? vFree - fFree : null };
}
for (const [pn, pl] of Object.entries(places)) for (const an of Object.keys(atks)) {
  let win = [];
  for (let vAt = 0; vAt <= 30; vAt++) { const r = trial(pl, an, vAt); if (r.countered) win.push(vAt); if (r.countered && (!rows.find(q => q.place === pn && q.atk === an))) rows.push(r); }
  const r = rows.find(q => q.place === pn && q.atk === an); if (r) r.window = win.length + ' of 31 timings (' + win[0] + '-' + win[win.length - 1] + ')';
  console.log(JSON.stringify(r || { place: pn, atk: an, countered: false }));
}
/* follow-ups after a counter of Flint's ftilt, per placement, at the first timing that counters */
const fol = ['wret dash', 'wret sh nair', 'wret fh uair', 'wret fh dj uair', 'wret sh fair', 'wret rc', 'wret dsmash', 'wret usmash', 'dash', 'sh nair', 'sh fair', 'fh uair', 'sh bair', 'utilt', 'fsmash', 'usmash', 'rc', 'w10 dash', 'fh dj uair', 'grab_u'];
const followRows = [];
for (const [pn, pl] of Object.entries(places)) { const r0 = rows.find(q => q.place === pn && q.atk === 'ftilt'); if (!r0) continue;
  for (const fw of fol) { const r = trial(pl, 'ftilt', r0.vAt, fw); followRows.push(r); console.log('follow', JSON.stringify(r)); } }
if (OUT) FS.writeFileSync(OUT, JSON.stringify({ foe: ROSTER[foe].name, pct0, rows, followRows }, null, 1));
