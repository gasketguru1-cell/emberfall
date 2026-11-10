// Does the CPU get back to the stage? Drops each fighter at set points off stage and plays until it lands, grabs the ledge or dies.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 99; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0, 'Flint'], [1, 0, 'Nib'], [1, 1, 'Loom'], [1, 2, 'Hod'], [2, 0, 'Potato Sack'], [3, 0, 'Sprocket'], [4, 0, 'Scuttle'], [5, 0, 'Rusty'], [5, 1, 'Bolt'], [5, 2, 'Cinder'], [5, 3, 'Pip'], [5, 4, 'Pearl']], spots = [[30, 20], [50, 0], [70, 30], [40, -30], [20, -45], [90, 40]].map(q => [EDGE + q[0], q[1]])   /* distances out from the ledge */, verbose = process.argv[2] === '-v';
  const table = {};
  for (const A of forms) { const res = [];
    for (const sp of spots) {
      slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: 0, ready: true };
      startMatch(); for (let n = 0; n < 190; n++) step();
      const f = F[0], o = F[1]; f.ctl = new Ctl('cpu'); o.ctl = new Ctl('none'); o.ctl.dev = 'pad3'; f.fi = A[1]; f.noSwap = true;
      f.x = sp[0]; f.y = sp[1]; f.vx = 0; f.vy = 0; f.grounded = false; f.plat = null; f.state = 'air'; f.jumps = f.st.jumps || 1; f.airdodged = false; f.sideUsed = false; o.x = -40;
      let out = 'timeout', trace = [], last = '';
      for (let n = 0; n < 400; n++) { step(); if (!f.def.fowl && f.fi !== A[1]) f.fi = A[1]; const tag = f.state + (f.state === 'attack' ? ':' + f.mname : ''); if (tag !== last) { trace.push(n + ' ' + tag + ' @' + Math.round(f.x) + ',' + Math.round(f.y)); last = tag; }
        if (f.stocks < 3) { out = 'DIED'; break; } if (f.grounded) { out = 'landed'; break; } if (f.state === 'ledge') { out = 'ledge'; break; } }
      res.push(sp.join(',') + ': ' + out); if (verbose && out === 'DIED') console.log(A[2] + ' from ' + sp.join(',') + ' -> ' + trace.join(' | '));
    }
    table[A[2]] = res.join('   ');
  }
  for (const k in table) console.log(k.padEnd(6) + table[k]);
})();
`);
