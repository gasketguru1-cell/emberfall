// The album's clip list, recorded in the browser through VREC.clip (tools/viking-record.js). window.VCLIPS.run() records them in order.
(function () {
  const far = { from: -20, face: 1 }, plat = { from: -40 }, D = (di, esc) => esc === false ? { di, gate: true } : { di, esc: 'all', gate: true };
  const near = v => v.state === 'hurt' && !v.grounded && v.y < 4 && v.vy < 0;
  const techer = di => { const b = KLAB.defender({ di, gate: true }); return (v, a) => { const i = b(v, a); if (near(v)) i.shd = true; return i; }; };
  const L = window.VCLIPS = { list: [
    { name: 'tc_sack_dtilt_rc', cat: 'tc', title: 'Missed-tech punish: Berserker dtilt > recall KOs Potato Sack at 0%', inputs: 'A+B on; axe stuck far right; d-tilt, wait 3, full hop, recall  | Sack misses the tech (any DI)',
      route: 'dtilt w3 fh rc', sit: { foe: [2], pct: 0, x0: -20, dist: 9, bz: true, axe: far }, def: D('in') },
    { name: 'tc_sack_dtilt_rc_tech', cat: 'tc', title: 'Same route, the Sack techs the landing: it survives', inputs: 'd-tilt, wait 3, full hop, recall  | Sack shields just before landing',
      route: 'dtilt w3 fh rc', sit: { foe: [2], pct: 0, x0: -20, dist: 9, bz: true, axe: far }, def: techer('in') },
    { name: 'combo_plat0_bair', cat: 'combo', title: '4 hits from 0% (62%), 14 of 20 runs: grab, recall, bair (Flint)', inputs: 'axe on right platform; grab, fthrow, wait 20, recall, full hop, wait 9, bair  | DI in. DI out or up: 3 hits',
      route: 'grab_f w20 rc fh w9 bair', sit: { foe: [0], pct: 0, x0: -20, dist: 9, axe: plat }, def: D('in') },
    { name: 'kill_plat55_grab_rc', cat: 'kill', title: 'Kill confirm at 55%? fthrow > platform-axe recall KOs half the time', inputs: 'axe on right platform; grab, fthrow, wait 18, recall  | DI down-out',
      route: 'grab_f w18 rc', sit: { foe: [0], pct: 55, x0: -20, dist: 9, axe: plat }, def: D('do') },
    { name: 'kill_plat55_bair', cat: 'kill', title: 'Kill confirm at 55%: fthrow > recall > bair (Flint, DI out, 20 of 20)', inputs: 'grab, fthrow, wait 20, recall, wait 7, full hop, wait 9, bair  | DI out, mashing',
      route: 'grab_f w20 rc w7 fh w9 bair', sit: { foe: [0], pct: 55, x0: -20, dist: 9, axe: plat }, def: D('out') },
    { name: 'bz_usmash25', cat: 'bz', title: 'Berserker up smash KOs Flint at 25%, every DI', inputs: 'A+B on; up smash  | DI up-in',
      route: 'usmash', sit: { foe: [0], pct: 25, x0: -20, dist: 9, bz: true }, def: D('ui') },
    { name: 'bz_fsmash55', cat: 'bz', title: 'Berserker forward smash KOs Flint at 55%, every DI', inputs: 'A+B on; forward smash  | DI in',
      route: 'fsmash', sit: { foe: [0], pct: 55, x0: -20, dist: 9, bz: true }, def: D('in') },
    { name: 'bz_run', cat: 'move', title: 'Berserker run: 61 units in 30 frames (normal 21.5)', inputs: 'A+B on; run forward 30 frames',
      route: 'rf30 w30', sit: { foe: [0], pct: 0, x0: -60, dist: 90, bz: true } },
    { name: 'mv_wavedash', cat: 'move', title: 'Wavedash forward, back, forward', inputs: 'jump, air dodge down-forward / down-back on frame 1',
      route: 'wd_f w4 wd_b w4 wd_f w30', sit: { foe: [0], pct: 0, x0: -30, dist: 70 } },
    { name: 'mv_shthrow', cat: 'move', title: 'Short-hop axe throw: 67.6 units of drift', inputs: 'short hop, B (throw) with the stick neutral, drift forward',
      route: 'sh throwA w40', sit: { foe: [0], pct: 0, x0: -60, dist: 110 } },
    { name: 'rc_fullrange', cat: 'axe', title: 'Recall across the stage KOs Flint at 80%, every DI', inputs: 'axe stuck far right; Viking at -12; hold B',
      route: 'rc w40', sit: { foe: [0], pct: 80, x0: -12, dist: 9, axe: far }, def: D('n') },
    { name: 'axe_ride_sspec', cat: 'axe', title: 'Side-B with special held: the recall rides along', inputs: 'B throw, wait until stuck, Side-B keeping B held',
      route: 'throw wstuck sspecR w30', sit: { foe: [0], pct: 30, x0: -40, dist: 30 } },
    { name: 'counter_homing', cat: 'counter', title: 'Counter > homing axe (axe stuck), Flint 40%', inputs: 'axe stuck far right; down-B as Flint ftilts  | DI in',
      route: 'dspec w60', sit: { foe: [0], pct: 40, x0: -20, dist: 9, axe: far }, fdef: ['ftilt', { onCounter: 8, di: 'in' }] },
    { name: 'counter_flying', cat: 'counter', title: 'Counter while the axe flies: the uppercut only, no homing axe', inputs: 'throw B, then down-B as Flint ftilts',
      route: 'throw dspec w60', sit: { foe: [0], pct: 40, x0: -20, dist: 9 }, fdef: ['ftilt', { onCounter: 8 }] },
    { name: 'g1_hitstun_recall', cat: 'glitch', title: 'G1: recall fires from hitstun, KOs Flint at 40%', inputs: 'axe stuck behind Flint; hold B while being hit',
      route: 'spcHurt', sit: { foe: [0], pct: 40, x0: 20, dist: 9, axe: far }, fdef: ['ftilt', {}] },
    { name: 'g2_grab_escape', cat: 'glitch', title: 'G2: recall while held in a grab frees the Viking', inputs: 'axe stuck behind; hold B while grabbed',
      route: 'spcHurt', sit: { foe: [0], pct: 40, x0: 20, dist: 9, axe: far }, fdef: ['grab', { hold: 1 }] },
    { name: 'eg_ground_sspec', cat: 'edge', title: 'Edgeguard: ground Side-B stops at the ledge (vs CPU 9, 80%)', inputs: 'Side-B at the ledge as the foe recovers',
      route: 'sspec w60', sit: { foe: [0], pct: 80, x0: 58, dist: 40, foeAir: -25 }, def: 'cpu9' },
    { name: 'eg_sh_fair', cat: 'edge', title: 'Edgeguard: short-hop fair (vs CPU 9, 80%)', inputs: 'short hop, fair at the ledge',
      route: 'sh fair w60', sit: { foe: [0], pct: 80, x0: 58, dist: 40, foeAir: -25 }, def: 'cpu9' },
    { name: 'eg_throw_rc', cat: 'edge', title: 'Edgeguard: throw offstage, recall through the foe', inputs: 'throw, wait 20, recall',
      route: 'throw w20 rc w40', sit: { foe: [0], pct: 80, x0: 58, dist: 40, foeAir: -25 }, def: 'cpu9' },
    { name: 'rec_far', cat: 'edge', title: 'Recovery from 52 units out: jump, Side-B, Up-B', inputs: 'double jump in, Side-B in, Up-B in',
      route: 'tele120_0 w10 djIn sspecIn uspecIn w60', sit: { foe: [0], pct: 0, x0: -20, dist: -40 } },
  ], out: [] };
  L.run = async function (from) { for (let k = from || 0; k < L.list.length; k++) { const c = Object.assign({}, L.list[k]);
      if (c.fdef) c.def = VREC.foe(c.fdef[0], c.fdef[1]);
      try { const r = await VREC.clip(c); L.out[k] = Object.assign(r, { title: c.title, inputs: c.inputs, sit: c.sit }); }
      catch (e) { L.out[k] = { name: c.name, err: String(e) }; }
      window.__prog = k + 1; } window.__done = true; };
})();
