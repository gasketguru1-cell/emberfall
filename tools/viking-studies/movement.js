// Movement: what each technique does, measured in the real game. Each row: the route, Berserker or not, distance (x), height,
// frames until he can act again. The opponent stands far away (x 60) and does nothing.
const rows = [];
function meas(name, route, o, extra) {
  o = Object.assign({ foe: [0], x0: -30, dist: 90 }, o || {});
  const [f, v] = VLAB.setup(o); const x0 = f.x, y0 = f.y; let maxY = f.y, minY = f.y, t = 0, actAt = -1, peakVx = 0;
  const e = KLAB.exec(route.split(' '), { patience: 200 }); KLAB.kIn = (ff, oo) => KLAB.input(e, ff, oo); KLAB.vIn = () => blankIn();
  const info = {};
  for (; t < 400; t++) { step(); KLAB.after(e, f); maxY = Math.max(maxY, f.y); minY = Math.min(minY, f.y); peakVx = Math.max(peakVx, Math.abs(f.vx));
    if (extra) extra(f, v, t, info);
    if (KLAB.finished(e)) { if (actAt < 0 && (f.state === 'idle' || f.state === 'air' || f.state === 'run' || f.state === 'dash')) { actAt = t; break; } } }
  KLAB.kIn = KLAB.vIn = null;
  const r = Object.assign({ name, route, bz: !!o.bz, dx: +(f.x - x0).toFixed(1), rise: +(maxY - y0).toFixed(1), drop: +(minY - y0).toFixed(1), framesToAct: actAt, endState: f.state, peakVx: +peakVx.toFixed(2), axe: VLAB.axeInfo(f) }, info);
  rows.push(r); console.log(JSON.stringify(r));
}
for (const bz of [false, true]) {
  const o = { bz };
  meas('walk 30f', 'wf30', o); meas('run 30f', 'rf30', o); meas('wavedash forward', 'wd_f', o); meas('wavedash back', 'wd_b', o);
  meas('short hop', 'sh w40', o); meas('full hop', 'fh w60', o); meas('full hop + double jump', 'fh w20 dj w60', o);
  meas('Side-B on the ground', 'sspec', o); meas('Side-B in the air', 'fh sspecA', o);
  meas('Up-B from the ground', 'uspecG', o); meas('Up-B forward, from a full hop + double jump', 'fh w20 dj w4 uspec_f', o);
  meas('waveland (full hop, air dodge down-forward)', 'fh w20 ad_df', o); meas('fast fall (full hop)', 'fh w25 ff', o);
  meas('Berserker toggle on the ground', 'bz', o); meas('Berserker toggle in the air', 'fh w15 bzA', o);
  meas('throw on the ground', 'throw', o); meas('throw from a short hop', 'sh throwA', o);
  meas('Side-B, then Up-B (air)', 'fh w10 sspecA uspec_f', o);
  meas('Side-B with special held (recall rides along)', 'throw wstuck sspecR', o);
  meas('Up-B with special held (recall rides along)', 'throw wstuck fh uspecR', o);
}
/* the counter in the air: does it stall the fall? */
meas('counter in the air (full hop)', 'fh w15 dspecA', {}, (f, v, t, inf) => { if (f.mname === 'dspec' && f.state === 'attack') { inf.cFrames = (inf.cFrames || 0) + 1; inf.cVy = Math.min(inf.cVy || 9, f.vy); } });
/* Side-B is once per airtime: a second press, and after a hit */
meas('Side-B twice in one jump', 'fh w5 sspecA sspecA', {}, (f, v, t, inf) => { if (f.mname === 'sspec' && f.mf === 1) inf.sspecs = (inf.sspecs || 0) + 1; });
/* Berserker drain */
{ const [f] = VLAB.setup({ x0: -30, dist: 90, bz: true }); KLAB.kIn = KLAB.vIn = () => blankIn(); const p0 = f.pct; for (let t = 0; t < 600; t++) step(); rows.push({ name: 'Berserker drain over 600 frames (10 s)', pctGained: +(f.pct - p0).toFixed(1) }); console.log('drain', f.pct - p0); KLAB.kIn = KLAB.vIn = null; }
if (OUT) FS.writeFileSync(OUT, JSON.stringify(rows, null, 1));
