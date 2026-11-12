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
for (const f of ['hitboxes.js', 'sim.js', 'net.js', 'tools/knell-lab.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
global.JOB = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); global.FS = fs;
vm.runInThisContext(`
(function () {
  const J = JOB, K = KLAB;
  const G = ['jab', 'jab2', 'jab3', 'ftilt', 'ftiltH', 'ftiltL', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'dash', 'grab_f', 'grab_b', 'grab_u', 'grab_d', 'nspec', 'nspecH', 'nspecL', 'sspec', 'uspecG'];
  const AIR = ['nair', 'fair', 'fairH', 'fairL', 'bair', 'uair', 'dair', 'nspecA', 'nspecAH', 'sspecA', 'uspec'];
  const H = ['hf', 'hb', 'hu'];
  const W = J.steps === 'lite' ? ['', 'w4', 'w10'] : ['', 'w3', 'w7', 'w12', 'w18'], W2 = J.steps === 'lite' ? ['', 'w6'] : ['', 'w4', 'w9'];
  const cat = (...p) => p.filter(Boolean);
  const STEPS = [];
  for (const w of W) { for (const g of G) STEPS.push(cat(w, g)); for (const a of AIR) STEPS.push(cat(w, a)); }
  for (const w of W) for (const j of ['sh', 'fh']) for (const w2 of W2) for (const a of AIR) STEPS.push(cat(w, j, w2, a));
  for (const w of W) for (const w2 of W2) for (const a of AIR) { STEPS.push(cat(w, 'dj', w2, a)); STEPS.push(cat(w, 'ff', w2, a)); }
  for (const h of H) for (const w of W) {
    for (const a of AIR) STEPS.push(cat(h, w, a));
    for (const g of G) STEPS.push(cat(h, w, g));
    for (const j of ['sh', 'fh', 'dj']) for (const w2 of W2) for (const a of AIR) STEPS.push(cat(h, w, j, w2, a));
    for (const a of AIR) STEPS.push(cat(h, w, 'ff', a));
  }
  const def = J.def ? K.defender(J.def) : (() => blankIn());
  /* the root */
  const [f0, v0] = K.setup(J.sit); K.kIn = () => blankIn(); K.vIn = def; for (let t = 0; t < 2; t++) step();
  /* pre: a scripted opening before the search (Knell's tokens J.preK; the opponent presses attack on frame J.vAt, stick toward
     Knell, e.g. to be caught by Deadbolt). The search starts from the frame Knell's first hit lands. */
  if (J.preK) {
    const pe = K.exec(J.preK.split(' '), { patience: 200 }); let n = 0, vt = 0;
    K.kIn = (ff, oo) => K.input(pe, ff, oo);
    K.vIn = (vv, aa) => { const i = blankIn(); vt++; if (vt >= J.vAt && vt <= J.vAt + 1) { i.atk = vt === J.vAt; i.lx = J.vLx ? sgn(aa.x - vv.x) : 0; } return i; };
    while (COMBO[0].hits < 1 && n++ < 400) { step(); K.after(pe, F[0]); }
    if (COMBO[0].hits < 1) { console.log('pre: no hit'); return; }
    while (F[0].hitlag > 0 || (F[0].state === 'attack' && !F[0].knC)) { step(); n++; }
    console.log('pre: hit after ' + n + ' frames, ' + F[0].mname + ' T' + F[0].thread + ' foe ' + F[1].pct.toFixed(1) + '% ' + F[1].state);
    K.vIn = def;
  }
  const w0 = K.watch(); if (J.preK) { w0.prev = COMBO[0].hits; w0.best = COMBO[0].hits; w0.dmg = COMBO[0].dmg; }
  const strip = w => ({ best: w.best, dmg: w.dmg, prev: w.prev, resets: w.resets, firstReset: w.firstReset, ko: w.ko, koT: w.koT, koHits: w.koHits, koHurt: w.koHurt, kos0: w.kos0, hinges: w.hinges, maxThread: w.maxThread, log: w.log.slice(), t: w.t, lastHit: w.lastHit, slowed: w.slowed, vState: w.vState });
  const mkW = s => { const w = K.watch(); Object.assign(w, JSON.parse(JSON.stringify(s))); return w; };
  const cpE = e => Object.assign({}, e, { toks: e.toks.slice() });
  let root = { snap: NET.save(), e: K.exec([], { patience: 45 }), w: strip(w0), route: [] };
  const kDeaths0 = F[1].kos;
  let sims = 0, frames = 0;
  /* one step from a node: returns a child, a KO, or null */
  function expand(node, stepToks) {
    NET.load(node.snap); const e = cpE(node.e); e.toks.push(...stepToks); const w = mkW(node.w); const best0 = w.best;
    K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = def; sims++;
    const f = F[0], v = F[1];
    for (let t = 0; t < 160; t++) {
      step(); frames++; K.after(e, f); w.frame();
      if (F[1].kos > kDeaths0) return null;   /* Knell lost a stock */
      if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? { ko: true, route: node.route.concat([stepToks.join(' ')]), w: strip(w), e } : null;   /* the KO itself ends the combo on its frame */
      if (w.resets > 0 || e.failed >= 0) return null;
      if (K.finished(e)) { if (w.best > best0) return { snap: NET.save(), e: cpE(e), w: strip(w), route: node.route.concat([stepToks.join(' ')]), pct: v.pct, thread: f.thread, sig: sig() }; return null; }
    }
    return null;
  }
  /* after a node: let it play out with no more input; does the launch alone KO (the opponent still in hitstun)? */
  function tailKO(node) {
    NET.load(node.snap); const e = cpE(node.e); e.drift = 0; const w = mkW(node.w);
    K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = def;
    for (let t = 0; t < 240; t++) { step(); frames++; K.after(e, F[0]); w.frame(); if (F[1].kos > kDeaths0) return null; if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? strip(w) : null; if (w.resets > 0) return null; }
    return null;
  }
  const sig = () => { const f = F[0], v = F[1]; return [Math.round(f.x / 2), Math.round(f.y / 2), Math.round(v.x / 2), Math.round(v.y / 2), Math.round(v.pct / 3), f.thread, f.state, f.mname, v.slowT > 0 ? 1 : 0].join(','); };
  const score = c => c.pct + c.thread * (J.threadW || 6) + c.w.best * (J.hitW || 0.5);
  const found = [], seen = new Set(); let beam = [root];
  const t0 = Date.now();
  for (let d = 0; d < (J.depth || 20) && beam.length; d++) {
    const kids = [];
    for (const n of beam) for (const s of (d === 0 && J.first ? STEPS.filter(q => J.first.split(',').includes(q[q.length - 1])) : STEPS)) {
      const c = expand(n, s); if (!c) continue;
      if (c.ko) { found.push({ route: c.route.join(' | '), hits: c.w.best, dmg: c.w.dmg, ko: true, koT: c.w.koT, frames: c.w.t, hinges: c.w.hinges, maxThread: c.w.maxThread, how: 'hit' }); continue; }
      if (seen.has(c.sig)) continue; seen.add(c.sig); kids.push(c);
    }
    kids.sort((a, b) => score(b) - score(a));
    beam = kids.slice(0, J.beam || 12);
    for (const n of kids) { const k = tailKO(n); if (k) found.push({ route: n.route.join(' | '), hits: k.best, dmg: k.dmg, ko: true, koT: k.koT, frames: k.t, hinges: k.hinges, maxThread: k.maxThread, how: 'launch' }); }
    const top = beam[0];
    console.log('[' + J.name + '] depth ' + (d + 1) + ': ' + kids.length + ' kids, best ' + (top ? top.w.best + ' hits ' + top.pct.toFixed(0) + '% T' + top.thread + '  ' + top.route.join(' | ') : '-') + '  KOs so far ' + found.filter(x => x.ko).length + '  (' + sims + ' sims, ' + Math.round(frames / 1000) + 'k frames, ' + Math.round((Date.now() - t0) / 1000) + 's)');
    if (J.goal === 'ko' && found.filter(x => x.ko).length >= (J.stopAfter || 30)) break;
    if (J.hitsLog) for (const n of beam.slice(0, 3)) found.push({ route: n.route.join(' | '), hits: n.w.best, dmg: n.w.dmg, ko: false, pct: +n.pct.toFixed(1), thread: n.thread, depth: d + 1 });
  }
  found.sort((a, b) => (b.ko - a.ko) || (a.frames - b.frames));
  FS.writeFileSync(J.out, JSON.stringify({ job: J, sims, frames, found }, null, 1));
  console.log('[' + J.name + '] wrote ' + found.length + ' to ' + J.out);
})();
`, { filename: 'knell-search' });
