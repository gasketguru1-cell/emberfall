// Measures how each fighter actually moves in the running rules: top speeds, how long they take to reach, jump heights and
// air times, drift. These are the numbers to compare against the reference build.
// Usage: node tests/movement.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 5; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', process.env.EMBERFALL_SIM || 'sim.js']) vm.runInThisContext(fs.readFileSync(path.resolve(root, f), 'utf8'), { filename: f });   /* EMBERFALL_SIM: measure another copy of the rules */
vm.runInThisContext(`
(function () {
  const FORMS = [['Flint', 0, 0], ['Nib', 1, 0], ['Loom', 1, 1], ['Hod', 1, 2]];
  PLATS.length = 1;   /* measure on the bare main stage, so no jump lands on a platform */
  let SCRIPT = null, t = 0;
  cpuInput = function (f) { const i = blankIn(); if (f.idx === 0 && SCRIPT) SCRIPT(i, t, f); return i; };
  function setup(pick, fi) {
    slots[0] = { dev: 'kb', pick, ready: true }; slots[1] = { dev: 'kb', pick: 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = fi; F[0].x = -(EDGE - 3); F[0].face = 1; t = 0; SCRIPT = null; return F[0];
  }
  /* Run a script for n frames; returns per-frame samples of the first fighter. */
  function run(n, script) { SCRIPT = script; const out = [], o = F[1]; for (let k = 0; k < n; k++) { o.x = 0; o.y = 150; o.vx = o.vy = 0; o.grounded = false; o.plat = null; o.state = 'air'; step(); t++;   /* the other fighter is parked in the air, out of the way */ const f = F[0]; out.push({ x: f.x, y: f.y, vx: f.vx, vy: f.vy, state: f.state, g: f.grounded }); } return out; }
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  function jump(f, script, n) {
    const y0 = f.y, s = run(n || 220, script), up = s.findIndex(q => !q.g), down = s.findIndex((q, k) => k > up && q.g);
    let top = 0, at = 0; s.forEach((q, k) => { if (q.y - y0 > top) { top = q.y - y0; at = k; } });
    if (down < 0) return { top: r1(top), toTop: at - up + 1, air: 'off stage', y4: r1(s[up + 3].y - y0), dx: 'off stage' };
    return { top: r1(top), toTop: at - up + 1, air: down - up, y4: r1(s[up + 3].y - y0), dx: r1(s[down].x - s[up].x) };
  }
  const rows = [];
  for (const [name, pick, fi] of FORMS) {
    const row = { fighter: name };
    let f = setup(pick, fi), s = run(110, (i, tt) => { i.lx = tt < 3 ? 0 : tt < 10 ? 0.4 : 1; });                /* eased push: walk */
    row['walk top'] = r2(Math.max(...s.map(q => q.vx)));
    f = setup(pick, fi); s = run(123, (i, tt) => { i.lx = tt < 3 ? 0 : 1; }).slice(3);                    /* flick and hold: dash, then run */
    const x0 = -(EDGE - 3), top = Math.max(...s.slice(40).map(q => q.vx));
    row['dash peak'] = r2(Math.max(...s.slice(0, 20).map(q => q.vx))); row['dash at f'] = s.findIndex(q => q.state === 'dash' && q.vx >= row['dash peak'] - 0.001) + 1;
    row['run top'] = r2(top);
    row['units in 30f'] = r1(s[29].x - x0); row['units in 60f'] = r1(s[59].x - x0);
    f = setup(pick, fi); s = run(123, (i, tt) => { if (tt >= 3 && tt < 43) i.lx = 1; });                 /* let go at full run: how long to stop */
    const stop = s.findIndex((q, k) => k >= 43 && q.vx === 0);
    row['stop frames'] = stop - 42; row['stop slide'] = r1(s[stop].x - s[42].x);
    f = setup(pick, fi); let j = jump(f, (i, tt) => { i.jmp = tt >= 5; });                             /* jump held: full hop */
    row['full hop'] = j.top; row['after 4f'] = j.y4; row['to top'] = j.toTop; row['air time'] = j.air;
    f = setup(pick, fi); j = jump(f, (i, tt) => { i.jmp = tt === 5 || tt === 6; });                    /* jump tapped: short hop */
    row['short hop'] = j.top; row['sh air'] = j.air;
    f = setup(pick, fi); let peak = 0;                                                                 /* full hop, then an air jump at the top */
    j = jump(f, (i, tt, ff) => { i.jmp = (tt >= 5 && tt < 12) || (ff.vy <= 0 && !ff.grounded && tt > 12 && tt < 80 && ff.jumps === (ff.st.jumps || 1)); }, 220);
    row['hop + air jump'] = j.top;
    f = setup(pick, fi); j = jump(f, (i, tt, ff) => { i.jmp = tt >= 5; if (!ff.grounded && ff.vy <= 0) i.ly = -1; });   /* full hop, fast fall from the top */
    row['ff air time'] = j.air;
    f = setup(pick, fi); j = jump(f, (i, tt) => { i.jmp = tt >= 5; if (tt >= 5) i.lx = 1; });        /* standing full hop holding forward */
    row['hop drift'] = j.dx;
    f = setup(pick, fi); j = jump(f, (i, tt) => { i.lx = tt < 3 ? 0 : 1; i.jmp = tt >= 23; });           /* running full hop */
    row['run hop dist'] = j.dx;
    rows.push(row);
  }
  const keys = Object.keys(rows[0]), w = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k]).length)));
  console.log(keys.map((k, n) => k.padEnd(w[n])).join('  '));
  for (const r of rows) console.log(keys.map((k, n) => String(r[k]).padEnd(w[n])).join('  '));
  console.log('\\nSpeeds are stage units per frame, distances stage units (the main stage is ' + EDGE * 2 + ' wide), times frames at 60 per second.');
})();
`);
