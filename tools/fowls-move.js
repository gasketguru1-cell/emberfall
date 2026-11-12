// Movement and glitch probes for Furious Fowls in the real simulation (run through tools/fowls-node.js):
//   node tools/fowls-node.js tools/fowls-move.js [out.json]
// Each probe drives Fowls frame by frame with plain inputs and measures what the game does (distance, height, frames). The
// opponent stands far away (or is placed where a probe needs it). Nothing in the game is changed.
{
const OUTF = ARGS[0] || ROOT + '/playtest-results/furious-fowls/movement.json';
const BN = ['Rusty', 'Bolt', 'Cinder', 'Pip', 'Pearl'];
/* drive: g(t, f, i) fills the input for frame t; stop(t, f) ends it. Returns the track and summary numbers. */
function drive(o, g, stop, max) {
  const [f, v] = FL.setup(Object.assign({ dist: 120, x0: -50 }, o)); FL.install();
  const orig = cpuInput; let t = 0; const tr = [];
  cpuInput = (ff, oo, m) => { if (ff === F[0]) { const i = blankIn(); g(t, ff, i); return i; } const i = blankIn(); return i; };
  try { for (; t < (max || 300); t++) { step(); tr.push([+f.x.toFixed(2), +f.y.toFixed(2), f.state, f.fi, f.mname || '']); if (stop && stop(t, f)) break; } } finally { cpuInput = orig; }
  const xs = tr.map(p => p[0]), ys = tr.map(p => p[1]);
  return { f, v, t, tr, x0: tr[0][0], y0: tr[0][1], x1: f.x, y1: f.y, dx: +(f.x - tr[0][0]).toFixed(1), dy: +(f.y - tr[0][1]).toFixed(1), maxY: +Math.max(...ys).toFixed(1), minY: +Math.min(...ys).toFixed(1), maxX: +Math.max(...xs).toFixed(1), minX: +Math.min(...xs).toFixed(1), states: [...new Set(tr.map(p => p[2]))] };
}
const free = f => f.state === 'idle' || f.state === 'run' || f.state === 'dash';
const R = {};
for (let b = 0; b < 5; b++) {
  const nm = BN[b], P = R[nm] = {};
  /* 1. wavedash: jump, air dodge down-forward the first airborne frame; slide distance and frames until free again */
  for (const [lab, ly] of [['long', -0.35], ['short', -0.8]]) { let jt = -1;
    const r = drive({ bird: b }, (t, f, i) => { if (t === 0) i.jmp = true; if (!f.grounded && jt < 0) jt = t; if (jt >= 0 && t === jt) { i.shd = true; i.lx = 1; i.ly = ly; } }, (t, f) => t > 4 && free(f), 120);
    P['wavedash_' + lab] = { dist: r.dx, frames: r.t, states: r.states }; }
  /* 2. dash dance width: 8 frames each way, 6 times */
  { const r = drive({ bird: b }, (t, f, i) => { i.lx = Math.floor(t / 8) % 2 ? -1 : 1; }, null, 48); P.dashdance = { span: +(r.maxX - r.minX).toFixed(1), drift: r.dx }; }
  /* 3. Side B flight, no steering: distance, peak and frames, by aim */
  for (const [lab, ly] of [['flat', 0], ['up', 1], ['down', -1]]) { let launched = -1;
    const r = drive({ bird: b }, (t, f, i) => { if (t === 0) { i.lx = 1; i.spc = true; } else if (f.mname === 'sspec') i.ly = ly; if (f.flying && launched < 0) launched = t; }, (t, f) => launched >= 0 && !f.flying && t > launched + 2, 200);
    P['flight_' + lab] = { dist: r.dx, peak: +(r.maxY - r.y0).toFixed(1), frames: launched >= 0 ? r.t - launched : null, endState: r.f.state, form: r.f.fi }; }
  /* 4. Side B, steering held forward the whole flight */
  { let launched = -1; const r = drive({ bird: b }, (t, f, i) => { i.lx = 1; if (t === 0) i.spc = true; else if (f.mname === 'sspec') i.ly = 1; if (f.flying && launched < 0) launched = t; }, (t, f) => launched >= 0 && !f.flying && t > launched + 2, 200);
    P.flight_up_steer = { dist: r.dx, peak: +(r.maxY - r.y0).toFixed(1), frames: launched >= 0 ? r.t - launched : null }; }
  /* 5. Cyclone displacement by charge and direction: from the ground, and from the air (y 30) */
  for (const air of [0, 1]) for (const c of [0, 15, 30, 45]) for (const [lab, lx, ly] of [['up', 0, 1], ['diag', 0.7, 0.7], ['side', 1, 0], ['down', 0.7, -0.7]]) {
    if (!air && lab === 'down') continue;
    const r = drive({ bird: b, fowlY: air ? 70 : 0, x0: -30 }, (t, f, i) => { if (t === 0) { i.ly = 1; i.spc = true; return; } if (t < 8 + c) i.spc = true; i.lx = lx; i.ly = ly; }, (t, f) => t > 12 + c && (f.upEnd === -99 || f.mname !== 'uspec' || f.state !== 'attack'), 300);
    P['cyclone_' + (air ? 'air_' : 'gnd_') + c + '_' + lab] = { dx: r.dx, dy: r.dy, rise: +(r.maxY - r.y0).toFixed(1), endState: r.f.state, frames: r.t }; }
  /* 6. Cyclone charge in the air: how far it sinks over 60 frames of holding, against 60 frames of plain falling */
  { const r = drive({ bird: b, fowlY: 100, x0: 0 }, (t, f, i) => { if (t === 0) { i.ly = 1; i.spc = true; return; } i.spc = true; }, (t, f) => t >= 70, 400);
    const r2 = drive({ bird: b, fowlY: 100, x0: 0 }, () => {}, (t, f) => t >= 70, 400);
    let held = 0; drive({ bird: b, fowlY: 100, x0: 120 }, (t, f, i) => { if (t === 0) { i.ly = 1; i.spc = true; return; } i.spc = true; if (f.mname === 'uspec' && !f.upGo) held = t; }, (t, f) => f.upGo || t > 300, 400);
    P.cyclone_charge_float = { sink70: +(r.y0 - r.y1).toFixed(1), plainFall70: +(r2.y0 - r2.y1).toFixed(1), maxHoldFrames: held }; }
  /* 7. Selector wheel held in the air for 60 frames: does it stall the fall? */
  { const r = drive({ bird: b, fowlY: 100, x0: 0 }, (t, f, i) => { i.spc = true; }, (t, f) => t >= 60, 300);
    const r2 = drive({ bird: b, fowlY: 100, x0: 0 }, () => {}, (t, f) => t >= 60, 300);
    P.wheel_hold_air = { fell60: +(r.y0 - r.y1).toFixed(1), plainFall60: +(r2.y0 - r2.y1).toFixed(1), state: r.f.state + '/' + r.f.mname }; }
  /* 8. Sling Spin air time (short hop nair, no drift) vs a plain short hop */
  { const a = drive({ bird: b }, (t, f, i) => { if (t < 2) i.jmp = true; if (t === 4) i.atk = true; }, (t, f) => t > 6 && f.grounded, 200), c = drive({ bird: b }, (t, f, i) => { if (t < 2) i.jmp = true; }, (t, f) => t > 6 && f.grounded, 200);
    P.spin_airtime = { nair: a.t, plainHop: c.t, peakNair: +(a.maxY - a.y0).toFixed(1), peakHop: +(c.maxY - c.y0).toFixed(1) }; }
  /* 9. Bird alone: five flutters straight across (after a Side B into the floor) */
  { let solo = -1; const r = drive({ bird: b, fowlY: 40 }, (t, f, i) => { if (t === 0) { i.lx = 1; i.spc = true; } if (f.fi >= 5 && !f.flying && solo < 0) solo = t; if (solo >= 0) { i.lx = 1; if ((t - solo) % 8 === 0) i.jmp = true; } }, (t, f) => solo >= 0 && f.grounded, 300);
    P.flight_then_flutters = { dx: r.dx, frames: r.t, form: r.f.fi }; }
}
/* 10. Bolt's Skitter Step and its jump cancel; Pip's Switcheroo by a ledge; the empty slingshot falling offstage */
{ const r = drive({ bird: 1 }, (t, f, i) => { if (t === 0) { i.ly = -1; i.spc = true; } }, (t, f) => t > 2 && free(f), 120); R.Bolt.skitter = { dist: r.dx, frames: r.t };
  const r2 = drive({ bird: 1 }, (t, f, i) => { if (t === 0) { i.ly = -1; i.spc = true; } if (t === 13) { i.jmp = true; i.lx = 1; } }, (t, f) => t > 14 && f.grounded && free(f), 160); R.Bolt.skitter_jc = { dist: r2.dx, frames: r2.t, peak: +(r2.maxY - r2.y0).toFixed(1) }; }
FS.mkdirSync(require('path').dirname(OUTF), { recursive: true }); FS.writeFileSync(OUTF, JSON.stringify(R, null, 1));
for (const k in R) console.log(k, JSON.stringify(R[k]));
}
