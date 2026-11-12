const [f, v] = VLAB.setup({ foe: [0], pct: 40, x0: -20, dist: 9, axe: { from: 30, face: -1 } }); f.face = 1;
console.log('axe', JSON.stringify(f.axe && { st: f.axe.st, x: f.axe.x }), 'away', f.axeAway, 'arm', f.recallArm);
let k = 0, ds = -1, cur = 0;
KLAB.kIn = (ff, o) => { const i = blankIn(); k++; if (k <= 10) i.spc = true; if (k === 12) { i.spc = true; i.ly = -1; } return i; };
KLAB.vIn = (vv, o) => { const i = blankIn(); if (ds >= 0 && (cur - ds === 6 || cur - ds === 7)) { i.lx = 0.6 * sgn(o.x - vv.x); i.atk = true; } return i; };
for (let t = 0; t < 60; t++) { cur = t; step(); if (ds < 0 && f.mname === 'dspec' && f.state === 'attack') ds = t; if (t < 40) console.log(t, f.state, f.mname, f.mf, f.axe ? f.axe.st + ' ' + f.axe.x.toFixed(1) : '-', '| foe', v.state, v.mname || '', v.x.toFixed(1)); }
