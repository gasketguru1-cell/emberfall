// Knell route search, in the real game run headless. A beam search over the tokens of tools/knell-lab.js: from every state it
// tries each next step (a wait, a Hinge, a jump, then an attack), keeps the step only if the game's own true-combo counter went
// up without ever resetting, and saves the game (net.js's rollback snapshot) at that hit to branch from. A route that ends in a
// KO with the opponent still in hitstun is a true kill. Nothing in the game is changed.
//   node tools/knell-search.js job.json      job: { name, sit, def, depth, beam, out, goal: 'ko' | 'hits', steps: 'full' | 'lite' }
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
global.localStorage = { getItem() { return null; }, setItem() {} };
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
let seed = 4242; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
global.JOB = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); global.FS = fs;
/* JOB.labs: more lab files loaded after knell-lab.js (e.g. tools/sack-lab.js for Potato Sack, with sit.me his roster index) */
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'tools/knell-lab.js'].concat(JOB.labs || [])) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  /* A robust route search: like tools/knell-search.js, but every step is played against several defenders at once (J.defs, each
     with its own game snapshot), and a step is kept only if the true-combo counter went up for every one of them. A KO counts only
     when every defender is KO'd in hitstun. So what it finds is true against all of those DI / SDI / escape choices together.
     Testing only: nothing in the game is changed.  job: { name, sit, defs: [defender opts], depth, beam, out, G, AIR, H, extra, first } */
  const J = JOB, K = KLAB;
  const G = J.G, AIR = J.AIR, H = J.H || [];
  const W = J.steps === 'lite' ? ['', 'w4', 'w10'] : ['', 'w3', 'w7', 'w12', 'w18'], W2 = J.steps === 'lite' ? ['', 'w6'] : ['', 'w4', 'w9'];
  const cat = (...p) => p.filter(Boolean);
  const STEPS = (J.extra || []).map(x => x.split(' '));
  for (const w of W) { for (const g of G) STEPS.push(cat(w, g)); for (const a of AIR) STEPS.push(cat(w, a)); }
  for (const w of W) for (const j of ['sh', 'fh']) for (const w2 of W2) for (const a of AIR) STEPS.push(cat(w, j, w2, a));
  for (const w of W) for (const w2 of W2) for (const a of AIR) { STEPS.push(cat(w, 'dj', w2, a)); STEPS.push(cat(w, 'ff', w2, a)); }
  for (const h of H) for (const w of W) {
    for (const a of AIR) STEPS.push(cat(h, w, a));
    for (const g of G) STEPS.push(cat(h, w, g));
    for (const j of ['sh', 'fh', 'dj']) for (const w2 of W2) for (const a of AIR) STEPS.push(cat(h, w, j, w2, a));
    for (const a of AIR) STEPS.push(cat(h, w, 'ff', a));
  }
  const defs = J.defs.map(d => K.defender(Object.assign({ gate: true }, d)));
  const strip = w => JSON.parse(JSON.stringify(Object.assign({}, w, { frame: undefined })));
  const mkW = s => { const w = K.watch(); Object.assign(w, JSON.parse(JSON.stringify(s))); return w; };
  const cpE = e => Object.assign({}, e, { toks: e.toks.slice() });
  /* the root: one start per defender (they are the same until the first hit) */
  const roots = defs.map(d => { K.setup(J.sit); K.kIn = () => blankIn(); K.vIn = d; for (let t = 0; t < 2; t++) step(); const w = K.watch(); return { snap: NET.save(), e: K.exec([], { patience: 45 }), w: strip(w) }; });
  const kos0 = F[1].kos;
  let sims = 0, frames = 0;
  function one(st, d, toks) {   /* one defender: returns {st} on a new true hit, {ko} on a true KO, or null */
    NET.load(st.snap); const e = cpE(st.e); e.toks.push(...toks); const w = mkW(st.w); const best0 = w.best;
    K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = d; sims++;
    for (let t = 0; t < 160; t++) {
      step(); frames++; K.after(e, F[0]); w.frame();
      if (F[1].kos > kos0) return null;
      if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? { ko: true, w: strip(w) } : null;
      if (w.resets > 0 || e.failed >= 0) return null;
      if (K.finished(e)) return w.best > best0 ? { st: { snap: NET.save(), e: cpE(e), w: strip(w) }, pct: F[1].pct, sig: [Math.round(F[0].x / 3), Math.round(F[0].y / 3), Math.round(F[1].x / 3), Math.round(F[1].y / 3), Math.round(F[1].pct / 4), F[0].state].join(',') } : null;
    }
    return null;
  }
  function tail(st, d) {   /* no more input: does the launch alone KO? */
    NET.load(st.snap); const e = cpE(st.e); e.drift = 0; const w = mkW(st.w); K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = d;
    for (let t = 0; t < 240; t++) { step(); frames++; K.after(e, F[0]); w.frame(); if (F[1].kos > kos0) return null; if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? strip(w) : null; if (w.resets > 0) return null; }
    return null;
  }
  const found = [], seen = new Set(); let beam = [{ sts: roots, route: [], pct: 0 }];
  const t0 = Date.now();
  for (let dd = 0; dd < (J.depth || 16) && beam.length; dd++) {
    const kids = [];
    for (const n of beam) for (const s of (dd === 0 && J.first ? STEPS.filter(q => J.first.split(',').includes(q[q.length - 1])) : STEPS)) {
      const rs = []; let kos = 0, dead = false;
      for (let k = 0; k < defs.length; k++) { const r = one(n.sts[k], defs[k], s); if (!r) { dead = true; break; } if (r.ko) kos++; rs.push(r); }
      if (dead) continue;
      const route = n.route.concat([s.join(' ')]);
      if (kos === defs.length) { found.push({ route: route.join(' | '), ko: true, how: 'hit', hits: Math.min(...rs.map(r => r.w.best)), dmg: Math.min(...rs.map(r => r.w.dmg)), frames: Math.max(...rs.map(r => r.w.t)) }); continue; }
      if (kos) continue;   /* KO'd some defenders but not all: not kept as a node (the others are still in the combo, but it can't be stepped on together) */
      const sig = rs.map(r => r.sig).join('/'); if (seen.has(sig)) continue; seen.add(sig);
      kids.push({ sts: rs.map(r => r.st), route, pct: Math.min(...rs.map(r => r.pct)), hits: Math.min(...rs.map(r => r.st.w.best)) });
    }
    kids.sort((a, b) => (b.pct + (J.hitW || 0) * b.hits) - (a.pct + (J.hitW || 0) * a.hits));
    beam = kids.slice(0, J.beam || 10);
    for (const n of beam) { let all = true, ws = []; for (let k = 0; k < defs.length && all; k++) { const w = tail(n.sts[k], defs[k]); if (!w) all = false; else ws.push(w); }
      if (all) found.push({ route: n.route.join(' | '), ko: true, how: 'launch', hits: Math.min(...ws.map(w => w.best)), dmg: Math.min(...ws.map(w => w.dmg)), frames: Math.max(...ws.map(w => w.t)) }); }
    if (J.hitsLog) for (const n of beam.slice(0, 3)) found.push({ route: n.route.join(' | '), ko: false, hits: n.hits, pct: +n.pct.toFixed(1), depth: dd + 1 });
    const top = beam[0];
    console.log('[' + J.name + '] depth ' + (dd + 1) + ': ' + kids.length + ' kids, best ' + (top ? top.hits + ' hits ' + top.pct.toFixed(0) + '%  ' + top.route.join(' | ') : '-') + '  KOs ' + found.filter(x => x.ko).length + ' (' + sims + ' sims, ' + Math.round(frames / 1000) + 'k frames, ' + Math.round((Date.now() - t0) / 1000) + 's)');
    if (found.filter(x => x.ko).length >= (J.stopAfter || 20)) break;
  }
  found.sort((a, b) => (b.ko - a.ko) || (a.frames - b.frames));
  FS.writeFileSync(J.out, JSON.stringify({ job: J, sims, frames, found }, null, 1));
  console.log('[' + J.name + '] wrote ' + found.length);
})();
`, { filename: 'robust-search' });
