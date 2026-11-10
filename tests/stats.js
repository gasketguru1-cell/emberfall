// Balance numbers from seeded CPU-vs-CPU matches, one fixed form per side (the CPU does not swap in this test).
// Usage: node tests/stats.js [matchesPerPairing]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), per = +process.argv[2] || 4;
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} }) : () => {}, set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) };
global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const forms = [[0, 0, 'Flint'], [1, 0, 'Nib'], [1, 1, 'Loom'], [1, 2, 'Hod']], S = {}, M = {};
  for (const a of forms) { M[a[2]] = {}; for (const b of forms) M[a[2]][b[2]] = 0; }
  for (const f of forms) S[f[2]] = { wins: 0, games: 0, started: 0, hits: 0, dmg: 0, koAt: [], frames: 0, byMove: {} };
  const _apply = applyHit, _start = Fighter.prototype.startMove, _ko = Fighter.prototype.ko;
  applyHit = function (a, v, h, face, srcX, proj) { const p0 = v.pct, st0 = v.state; _apply(a, v, h, face, srcX, proj); if (v.pct > p0) { const s = S[a.form.name]; s.hits++; s.dmg += v.pct - p0; const k = h.id ? h.id.split(':')[1] : a.mname; s.byMove[k] = (s.byMove[k] || 0) + 1; v.lastHit = [a.form.name, k]; } };
  Fighter.prototype.startMove = function (n) { if (!this.form.moves[n].swap) { const s = S[this.form.name]; s.started++; s.tried = s.tried || {}; s.tried[n] = (s.tried[n] || 0) + 1; } return _start.call(this, n); };
  Fighter.prototype.ko = function () { const s = S[this.form.name]; if (this.lastHit) { const k = S[this.lastHit[0]]; k.kills = k.kills || {}; k.kills[this.lastHit[1]] = (k.kills[this.lastHit[1]] || 0) + 1; this.lastHit = null; } s.koAt.push(this.pct); s.zone = s.zone || { top: 0, side: 0, bottom: 0, launched: 0, fell: 0 }; s.zone[this.y > BLAST.t ? 'top' : this.y < BLAST.b ? 'bottom' : 'side']++; s.zone[this.state === 'hurt' ? 'launched' : 'fell']++; return _ko.call(this); };
  for (const A of forms) for (const B of forms) for (let m = 0; m < ${per}; m++) {
    slots[0] = { dev: 'kb', pick: A[0], ready: true }; slots[1] = { dev: 'kb', pick: B[0], ready: true };
    startMatch(); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = A[1]; F[1].fi = B[1]; F[0].noSwap = F[1].noSwap = true;
    let n = 0; while (mode !== 'over' && n < 8 * 3600 + 400) { step(); n++; if (F[0].fi !== A[1]) F[0].fi = A[1]; if (F[1].fi !== B[1]) F[1].fi = B[1]; }
    const w = F[0].stocks !== F[1].stocks ? (F[0].stocks > F[1].stocks ? 0 : 1) : F[0].pct < F[1].pct ? 0 : 1;
    S[A[2]].games++; S[B[2]].games++; S[[A, B][w][2]].wins++; M[[A, B][w][2]][[B, A][w][2]]++; S[A[2]].frames += n; S[B[2]].frames += n;
  }
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, rows = {};
  for (const k in S) { const s = S[k]; const top = Object.entries(s.tried || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0] + ' ' + (s.byMove[e[0]] || 0) + '/' + e[1]).join(', ');
    rows[k] = { 'win %': Math.round(100 * s.wins / s.games), 'hit %': Math.round(100 * s.hits / s.started), 'dmg/hit': +(s.dmg / s.hits).toFixed(1), 'KO at %': Math.round(avg(s.koAt)), 'match s': Math.round(s.frames / s.games / 60), 'deaths top/side/bottom': s.zone.top + '/' + s.zone.side + '/' + s.zone.bottom, 'while launched %': Math.round(100 * s.zone.launched / (s.zone.launched + s.zone.fell)), 'dmg/min': Math.round(s.dmg / (s.frames / 3600)), 'KOs by': Object.entries(s.kills || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0] + ' ' + e[1]).join(', '), 'hits/tries by move': top }; }
  console.table(rows);
  /* who beats whom: wins of the row fighter over the column fighter, out of twice the matches per pairing */
  const mx = {}; for (const a in M) { mx[a] = {}; for (const b in M[a]) mx[a]['beat ' + b] = a === b ? '' : M[a][b] + '/' + (M[a][b] + M[b][a]); } console.table(mx);
})();
`);
