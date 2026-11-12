// AUDIT-ONLY harness (Ultimate fidelity audit, 2026-11-10). Reads the repo's sim.js read-only; writes nothing to the repo.
// Usage: node audit-harness.js <repo>
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = process.argv[2];
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 7; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  const out = {};
  let SCRIPT = null, t = 0;
  cpuInput = function (f) { const i = blankIn(); if (f.idx === 0 && SCRIPT) SCRIPT(i, t, f); return i; };
  function setup(pick, fi, pick2, fi2) {
    slots[0] = { dev: 'kb', pick, ready: true }; slots[1] = { dev: 'kb', pick: pick2 || 0, ready: true };
    startMatch(); let g = 0; while (mode !== 'play' && g++ < 400) step();
    F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); F[0].fi = fi; if (fi2 !== undefined) F[1].fi = fi2;
    F[0].x = -20; F[0].face = 1; F[0].invuln = F[1].invuln = 0; PROJ.length = 0; F[1].x = 20; F[1].face = -1; t = 0; SCRIPT = null; return F[0];
  }
  function run(n, script, freezeOther) { SCRIPT = script; const s = []; for (let k = 0; k < n; k++) { if (freezeOther) { const o = F[1]; o.x = 60; o.vx = 0; o.invuln = 0; } step(); t++; const f = F[0]; s.push({ st: f.state, g: f.grounded, x: f.x, y: f.y, vx: f.vx, vy: f.vy, inv: f.invuln, mf: f.mf, o: F[1].state, oinv: F[1].invuln }); } return s; }
  const NAMES = [['Flint',0,0],['Nib',1,0],['Loom',1,1],['Hod',1,2],['Potato Sack',2,0],['Sprocket',3,0],['Scuttle',4,0]];

  /* 1. Jumpsquat: frames from jump press to airborne, and first actionable after a dash flick */
  out.jumpsquat = NAMES.map(([n,p,fi]) => { setup(p,fi); const s = run(20, (i,tt)=>{ i.jmp = tt>=2; }, true); return { fighter:n, airborneFrame: s.findIndex(q=>!q.g) - 1 }; });

  /* 2. Dash: frames in dash state and top speed reached in 40f */
  out.dash = NAMES.map(([n,p,fi]) => { setup(p,fi); const s = run(60, (i,tt)=>{ i.lx = tt>=2?1:0; }, true); const top = Math.max(...s.map(q=>q.vx)); const runAt = s.findIndex(q=>q.st==='run'); return { fighter:n, dashFrames: s.filter(q=>q.st==='dash').length, firstRunFrame: runAt-1, topSpeed: +top.toFixed(3), runSt: F[0].st.run }; });

  /* 3. Spot dodge / roll / air dodge intangibility windows (fresh) */
  out.dodges = NAMES.map(([n,p,fi]) => {
    const r = { fighter:n };
    setup(p,fi); let s = run(40, (i,tt)=>{ i.shd = tt>=2 && tt<6; if (tt===5) i.ly=-1; }, true);
    let inv = s.map((q,k)=>q.inv>0&&q.st==='spot'?k:-1).filter(k=>k>=0), st0 = s.findIndex(q=>q.st==='spot'); r.spot = st0<0?'n/a':(inv[0]-st0+1)+'-'+(inv[inv.length-1]-st0+1)+' of '+s.filter(q=>q.st==='spot').length;
    setup(p,fi); s = run(60, (i,tt)=>{ i.jmp = tt>=2&&tt<5; if (tt===14) i.shd = true; }, true);
    st0 = s.findIndex(q=>q.st==='airdodge'); inv = s.map((q,k)=>q.inv>0&&q.st==='airdodge'?k:-1).filter(k=>k>=0); r.neutralAirdodge = st0<0?'n/a':(inv[0]-st0+1)+'-'+(inv[inv.length-1]-st0+1)+' of '+s.filter(q=>q.st==='airdodge').length;
    return r; });

  /* 4. Shield: frames from shield press to grab active via attack (OOS grab) and to jump OOS airborne */
  out.oos = NAMES.map(([n,p,fi]) => { setup(p,fi); let s = run(40,(i,tt)=>{ i.shd = tt>=2; if (tt===8) i.atk = true; }, true); const gStart = s.findIndex(q=>q.st==='attack'); setup(p,fi); const s2 = run(40,(i,tt)=>{ i.shd = tt>=2; if (tt>=8) i.jmp = true; }, true); return { fighter:n, grabStartsAfterPress: gStart-7, jumpAirborneAfterPress: s2.findIndex(q=>!q.g)-7 }; });

  /* 5. Shield drop (release) to idle */
  { setup(0,0); const s = run(40,(i,tt)=>{ i.shd = tt>=2 && tt<12; }, true); out.shieldDrop = { framesInShieldoff: s.filter(q=>q.st==='shieldoff').length }; }

  /* 6. Launch table: Flint uncharged fsmash (sweetspot) on each fighter at 0/50/100/150, no DI, via knock() and launch() */
  const fs = FLINT.forms[0].moves.fsmash.h[0];
  out.launch = { move: { d: fs.d, a: fs.a, b: fs.b, k: fs.k }, rows: [] };
  for (const [n,p,fi] of NAMES) { setup(0,0,p,fi); const v = F[1]; for (const pct of [0,50,100,150]) { const d = fs.d * DMG_1V1 * FRESH; v.pct = pct + d; const kb = knock(v, d, fs.b, fs.k); out.launch.rows.push({ target:n, weight:v.st.weight, pct, kb:+kb.toFixed(1), hitstun:Math.floor(kb*0.4), tumble: kb>=TUMBLE_KB, launchSpeed:+(kb*0.03).toFixed(2), ultHitstunWouldBe: Math.max(0,Math.floor(kb*0.4)-1) }); } }

  /* 7. Ledge intangibility formula vs Ultimate (SmashWiki "Edge"): Emberfall clamp(24+0.1a-0.17p,8,54)-2 vs Ult 60a/300+44-44p/120 (23..123) */
  out.ledge = [];
  for (const a of [30,120,300]) for (const p of [0,60,120]) { const em = Math.min(54,Math.max(8,Math.round(24+Math.min(a,300)*0.1-Math.min(p,120)*0.17))) - 2; const ult = Math.min(123,Math.max(23,Math.round(60*(Math.min(a,300)/300)+(44-Math.min(p,120)/120*44)))); out.ledge.push({ airtime:a, pct:p, emberfall:em, ultimate:ult }); }

  /* 8. Sakurai angle on airborne target (code path) */
  out.sakurai = { airborneDeg: 'see sim.js:1502 (45)', groundedThresholds: '60/88 -> 0..38' };

  /* 9. True combo vs purported: Flint utilt -> utilt at 0% on Flint, count combo counter */
  { setup(0,0,0,0); F[0].x = -4; F[1].x = 4; F[1].face = -1; const s = run(80,(i,tt)=>{ if (tt===2) i.ly = 1; if (tt===2||tt===3) i.atk = false; if (tt>=2 && tt<4){ i.cy = 1; } if (tt>=24&&tt<26){ i.cy = 1; } }, false); out.utiltRepeat = { comboLast: COMBO[0].last, comboBest: COMBO[0].best, victimPct: +F[1].pct.toFixed(1) }; }

  /* 10. Stale queue sum vs SmashWiki Ultimate */
  out.stale = { emberfall: STALE, sum: +STALE.reduce((a,b)=>a+b,0).toFixed(4), ultimateWiki: [0.09,0.08545,0.07635,0.0679,0.05945,0.05035,0.04255,0.03345,0.025] };
  out.constants = { DMG_1V1, FRESH, SHORT_HOP_MUL, TUMBLE_KB, CROUCH_MUL, CHARGING_MUL, SHIELD, buffer: T.buffer, STOCKS, MATCH_FRAMES, BLAST, EDGE };
  console.log(JSON.stringify(out, null, 1));
})();
`);
