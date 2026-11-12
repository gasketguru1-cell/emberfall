// Potato Sack movement: each technique (sack-lab tokens) run from a standstill in the real game headless, measured frame by frame
// against his plain movement. Testing only. node tools/sack-move.js out.json
require('./sack-probe.js');
const FREE = { idle: 1, air: 1, run: 1, dash: 1, brake: 1, wd: 1 };
function measure(route, sit) {
  const xs = [], ys = [], vxs = [], st = []; let firstFree = -1, tokDone = -1, inv = 0;
  const e0 = { me: SLAB.ME, foe: [0, 0], x0: -60, dist: 120, maxFrames: 120, tail: 120 };
  const r = KLAB.run(route, Object.assign(e0, sit), (t, f) => { if (t < 0) return; xs.push(f.x); ys.push(f.y); vxs.push(f.vx); st.push(f.state + (f.mname ? ':' + f.mname : '') + (f.burstKind ? '/' + f.burstKind : ''));
    if (f.invuln > 0) inv++; });
  const x0 = -60, at = n => +(xs[Math.min(n, xs.length - 1)] - x0).toFixed(1);
  return { route, d10: at(10), d20: at(20), d30: at(30), d45: at(45), d60: at(60), peakVx: +Math.max(...vxs.map(Math.abs)).toFixed(2), peakY: +Math.max(...ys).toFixed(1), minY: +Math.min(...ys).toFixed(1),
    airF: ys.filter(y => y > 0.01).length, states: st.filter((s, i) => i === 0 || s !== st[i - 1]).slice(0, 12).join(' > '), failed: r.failedAt };
}
module.exports = measure;
if (require.main === module) {
  const T = [
    ['run (baseline)', 'run run run run run run'], ['dash then run (baseline)', 'dd'], ['wavedash forward (baseline)', 'wd_f'], ['wavedash x3 (baseline)', 'wd_f wd_f wd_f'],
    ['full hop drift (baseline)', 'fh'], ['short hop (baseline)', 'sh'],
    ['ground Tumble slide', 'tum_f'], ['slide, cancel into a 2nd slide', 'tum_f tum_f'], ['slide chain x4', 'tum_f tum_f tum_f tum_f'],
    ['slide, jump-cancel short hop', 'tum_f sh'], ['slide, jump-cancel full hop', 'tum_f fh'], ['slide, wavedash out', 'tum_f wd_f'], ['slide, wavedash back', 'tum_f wd_b'],
    ['slide, reverse (push back)', 'tum_f tx'], ['slide into back slide', 'tum_f tum_b'], ['ground stall Tumble', 'tum_n'], ['ground lift Tumble', 'tum_u'],
    ['full hop, air dive', 'fh w6 tum_f'], ['full hop, air dive, land-cancel slide', 'fh w6 tum_f Ltum_f'], ['short hop dive (instant slide)', 'sh tum_f'],
    ['full hop, air stall', 'fh w6 tum_n'], ['full hop, lift', 'fh w6 tum_u'], ['double jump, lift (height)', 'fh w12 dj w10 tum_u'],
    ['air dive, fast-fall', 'fh w6 tum_f tdn'], ['dive land-cancel into usmash slide', 'fh w6 tum_f Lusmash'], ['dive land-cancel into fsmash', 'fh w6 tum_f Lfsmash'],
    ['dive land-cancel into dash grab', 'fh w6 tum_f Lgrab_f'], ['dive land-cancel jump', 'fh w6 tum_f Lfh'],
  ];
  const out = T.map(([name, r]) => Object.assign({ name }, measure(r, {})));
  for (const o of out) console.log(o.name.padEnd(40), 'd20', String(o.d20).padStart(6), 'd30', String(o.d30).padStart(6), 'd60', String(o.d60).padStart(6), 'vx', String(o.peakVx).padStart(5), 'y', o.peakY, 'air', o.airF, o.failed >= 0 ? 'FAILED@' + o.failed : '', '|', o.states.slice(0, 110));
  if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
}
