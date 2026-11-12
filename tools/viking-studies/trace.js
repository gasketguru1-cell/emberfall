// Prints one Viking route frame by frame (state, move, position, axe). ARGS: route, x, y, jumps
const route = (ARGS[0] || 'dj uspec_f').split(' '), x = +(ARGS[1] || 118), y = +(ARGS[2] || 0), jumps = +(ARGS[3] ?? 1);
const [f, v] = VLAB.setup({ foe: [0], pct: 0, x0: -40, dist: -20 }); v.x = -60;
f.x = x; f.y = y; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); f.face = -1; f.jumps = jumps; f.sideUsed = false;
const e = KLAB.exec(route, { patience: 120 }); KLAB.kIn = (ff, oo) => { const i = KLAB.input(e, ff, oo); if (KLAB.finished(e) || (ARGS[4] === 'hold' && !((i.spc || i.jmp) && f.state !== 'attack'))) i.lx = -1; return i; }; KLAB.vIn = () => blankIn();
for (let t = 0; t < 200; t++) { step(); KLAB.after(e, f); if (t % 4 === 0 || f.state !== 'air') console.log(t, f.state, f.mname || '', f.x.toFixed(1), f.y.toFixed(1), 'j' + f.jumps, 'tok' + (e.i ?? e.k ?? ''), KLAB.finished(e) ? 'done' : ''); if (f.state === 'ledge' || f.y < -130) break; }
