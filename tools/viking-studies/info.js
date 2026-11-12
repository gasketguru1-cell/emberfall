console.log(JSON.stringify(PLATS.map(p => [p.x0, p.x1, p.y, !!p.soft])));
console.log(ROSTER.map((r, i) => i + ':' + r.name + ':' + r.forms.map(f => f.st.weight).join('/')).join('  '));
const [f] = VLAB.setup({ x0: -20, axe: { from: -20 } }); console.log('ground throw from -20 sticks at', f.axe.x.toFixed(1), f.axe.y.toFixed(1));
for (const [fr, air, fc] of [[0, 0, 1], [30, 0, 1], [50, 0, 1], [60, 0, 1], [-60, 0, -1], [0, 30, 1], [60, 30, 1], [60, 0, -1], [-40, 0, 1]]) { const [g] = VLAB.setup({ x0: -40, axe: { from: fr, air, face: fc } }); const p = g.axe; console.log('from', fr, 'air', air, 'face', fc, '->', p ? p.st + ' ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + (p.wall ? ' wall' : '') + (p.plat ? ' plat' + p.plat.y : '') : 'gone'); }
