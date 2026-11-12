// Edge cases of the axe and Berserker. Each test drives both fighters frame by frame with plain inputs and reports what the
// game did. Nothing in the game is changed. ARGS[0]: foe index (default 0).
const foe = +(ARGS[0] || 0), R = {};
const ax = f => f.axe ? { st: f.axe.st, x: +f.axe.x.toFixed(1), y: +f.axe.y.toFixed(1), ghost: !!f.axe.ghost } : null;
function sim(T, kin, vin, each) { KLAB.kIn = (f, o) => kin(blankIn(), f, o); KLAB.vIn = vin === 'cpu9' ? 'cpu9' : (v, o) => vin(blankIn(), v, o); let out;
  for (let t = 0; t < T; t++) { step(); out = each && each(t); if (out) break; } KLAB.kIn = KLAB.vIn = null; return out; }
/* G1 recall in hitstun: the axe stuck far right; Flint hits the Viking with a forward smash; the Viking holds special from the
   frame he is hit. Does the recall fire while he is in hitstun, and does it hit Flint (breaking the combo)? */
for (const atk of ['fsmash', 'ftilt', 'jab']) for (const pct of [30, 90]) {
  const [f, v] = VLAB.setup({ foe: [foe], pct: 40, kPct: pct, x0: 20, dist: 9, axe: { from: -20, face: 1 } }); let hitT = -1, recT = -1, axeHitT = -1, stHit = '', vPct0 = v.pct, fz = 0;
  const pressAtk = (i, d) => { if (atk === 'fsmash') { i.lx = d; i.sm = true; } else if (atk === 'ftilt') i.lx = 0.6 * d; i.atk = true; };
  const r = sim(260, (i, ff) => { if (hitT >= 0) i.spc = true; return i; }, (i, vv, o) => { if (fz < 3) { pressAtk(i, sgn(o.x - vv.x)); fz++; } return i; }, t => {
    if (hitT < 0 && f.state === 'hurt') hitT = t; if (recT < 0 && f.axe && f.axe.st === 'recall') { recT = t; stHit = f.state + (f.hitlag > 0 ? '+hitlag' : ''); }
    if (axeHitT < 0 && v.pct > vPct0 + 0.01 && recT >= 0) axeHitT = t; });
  R['G1 recall in hitstun ' + atk + ' @' + pct] = { hitT, recallT: recT, vikingStateAtRecall: stHit, axeHitFoeT: axeHitT, foeDmg: +(v.pct - vPct0).toFixed(1), vikingFreeAfter: f.state };
}
/* G2 recall from shield, from being held (grabbed), from the ledge */
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 40, x0: 20, dist: 9, axe: { from: -20, face: 1 } }); let rec = '';
  sim(120, (i, ff, o) => { i.shd = true; if (ff.state === 'shield' && ff.sf > 4) i.spc = true; return i; }, i => i, t => { if (!rec && f.axe && f.axe.st === 'recall') rec = f.state + ' t' + t; });
  R['G2 recall while shielding'] = rec || 'no recall'; }
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 40, x0: 20, dist: 9, axe: { from: -20, face: 1 } }); let rec = '', held = -1, vp0 = v.pct, fp0;
  sim(200, (i, ff) => { if (held >= 0) i.spc = true; return i; }, (i, vv, o) => { if (held < 0) i.grb = true; return i; }, t => { if (held < 0 && f.state === 'held') held = t; if (!rec && f.axe && f.axe.st === 'recall') rec = f.state + ' t' + t; });
  R['G2 recall while held in a grab'] = { grabbedAt: held, recall: rec || 'no recall', foeDmg: +(v.pct - vp0).toFixed(1), vikingNow: f.state }; }
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 40, x0: 20, dist: -60, axe: { from: -20, face: 1 } }); f.x = EDGE + 6; f.y = -12; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); f.face = -1; f.jumps = 0;
  let led = -1, rec = '';
  sim(160, (i, ff) => { if (led < 0) i.lx = -1; if (led >= 0 && t0() > led + 10) i.spc = true; return i; }, i => i, t => { cur = t; if (led < 0 && f.state === 'ledge') led = t; if (!rec && f.axe && f.axe.st === 'recall') rec = f.state + ' t' + t; });
  R['G2 recall while hanging on the ledge'] = { ledgeAt: led, recall: rec || 'no recall', stillOnLedge: f.state === 'ledge' }; }
var cur = 0; function t0() { return cur; }
/* G3 the axe and Berserker across the Viking's KO */
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 0, x0: -20, dist: 9, axe: { from: -20 }, bz: true }); const before = { axe: ax(f), berserk: f.berserk, axeAway: f.axeAway };
  f.x = 240; f.y = 10; f.grounded = false; f.plat = null; f.set('air'); let dead = -1, back = -1, snaps = [];
  sim(400, i => i, i => i, t => { if (dead < 0 && f.state === 'dead') dead = t; if (dead >= 0 && back < 0 && f.state !== 'dead' && f.state !== 'respawn') back = t; if (t % 40 === 0) snaps.push(t + ':' + f.state + ':' + JSON.stringify(ax(f)) + ':bz' + f.berserk + ':' + f.pct.toFixed(0)); });
  R['G3 axe + Berserker across a KO'] = { before, deadAt: dead, actionableAt: back, after: { axe: ax(f), berserk: f.berserk, axeAway: f.axeAway, pct: +f.pct.toFixed(1) }, snaps }; }
/* G4 throw and recall at once: one throw, special kept held. Hits on the way out and the way back */
for (const hd of [0, 10, 20, 30]) for (const dist of [12, 20, 30, 45]) { const [f, v] = VLAB.setup({ foe: [foe], pct: 30, x0: -40, dist }); let n = 0, vp0 = v.pct, hits = [];
  let prev = COMBO[0].hits; sim(200, (i, ff) => { n++; if (n === 1 || (n >= 3 + hd && n <= 60)) i.spc = true; return i; }, i => i, t => { if (COMBO[0].hits !== prev) { hits.push(t + ':' + COMBO[0].hits + ':' + (f.axe ? f.axe.st : '-')); prev = COMBO[0].hits; } });
  R['G4 throw, then special held from frame ' + (3 + hd) + ', foe at ' + dist] = { hits, dmg: +(v.pct - vp0).toFixed(1), counter: COMBO[0].hits }; }
/* G5 counter while the axe is coming back (recall), and counter while the axe flies out */
for (const mode of ['recalling', 'flying']) for (const vAt of [2, 6, 10, 14]) { const [f, v] = VLAB.setup({ foe: [foe], pct: 40, x0: -20, dist: 9, axe: mode === 'recalling' ? { from: -20, face: 1 } : null }); f.face = 1; if (mode === 'flying') { f.face = -1; v.x = f.x + 9; }
  let k = 0, ds = -1, caught = false, vp0 = v.pct; const seq = mode === 'recalling' ? 2 : 68;
  sim(220, (i, ff) => { k++; if (mode === 'flying' && k === 1) i.spc = true; if (k === seq) { i.spc = true; i.ly = -1; } if (mode === 'recalling' && k > seq && k < seq + 14) i.spc = true; return i; },
    (i, vv, o) => { if (ds >= 0 && (cur - ds === vAt || cur - ds === vAt + 1)) { i.lx = 0.6 * sgn(o.x - vv.x); i.atk = true; } return i; },
    t => { cur = t; if (ds < 0 && f.mname === 'dspec' && f.state === 'attack') ds = t; if (f.mname && f.mname.startsWith('dspecHit')) caught = true; });
  R['G5 counter while axe ' + mode + ' vAt' + vAt] = { caught, foeDmg: +(v.pct - vp0).toFixed(1), counter: COMBO[0].hits, axe: ax(f), foeState: v.state }; }
/* G6 Berserker at high damage: the drain keeps climbing past 150, to the cap */
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 0, kPct: 990, x0: -20, dist: 40, bz: true }); sim(1300, i => i, i => i);
  R['G6 Berserker drain cap'] = { pct: f.pct, berserk: f.berserk }; }
/* G7 the Berserker toggle pressed during hitstun (should do nothing) and on the ledge */
{ const [f, v] = VLAB.setup({ foe: [foe], pct: 40, kPct: 60, x0: 20, dist: -9 }); let hit = -1, bzAt = -1, z = 0;
  sim(200, (i, ff) => { if (hit >= 0 && (cur - hit) % 3 === 0) { i.atk = true; i.spc = true; } return i; }, (i, vv, o) => { if (z++ < 3) { i.lx = sgn(o.x - vv.x); i.sm = true; i.atk = true; } return i; },
    t => { cur = t; if (hit < 0 && f.state === 'hurt') hit = t; if (bzAt < 0 && f.berserk) bzAt = t; });
  R['G7 Berserker mashed through hitstun'] = { hitAt: hit, berserkAt: bzAt, gapFrames: bzAt >= 0 ? bzAt - hit : null }; }
if (OUT) FS.writeFileSync(OUT, JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
