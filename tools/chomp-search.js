// Chomp Chomp route search, in the real game run headless (the same beam search as tools/knell-search.js). From every state it
// tries each next step (a wait, a jump, a rope-out, a coal or ant call, then an attack), keeps the step only if the game's own
// true-combo counter went up without ever resetting, and saves the game (net.js's rollback snapshot) at that hit to branch from.
// A route that ends in a KO with the opponent still in hitstun is a true kill. Nothing in the game is changed.
//   node tools/chomp-search.js job.json   job: { name, sit, def, depth, beam, out, goal: 'ko' | 'hits', steps: 'full' | 'lite', specials, first, preK }
require('./chomp-node.js');
global.JOB = JSON.parse(FS.readFileSync(process.argv[2], 'utf8'));
RUN(function () {
  const J = JOB, K = CLAB;
  const G = ['jab', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'dash', 'grab_f', 'grab_b', 'grab_u', 'grab_d', 'cush'];
  const AIR = ['nair', 'fair', 'bair', 'uair', 'dair', 'cush'];
  const W = J.steps === 'lite' ? ['', 'w4', 'w10'] : ['', 'w3', 'w7', 'w12', 'w18'], W2 = J.steps === 'lite' ? ['', 'w6'] : ['', 'w4', 'w9'];
  const cat = (...p) => p.filter(Boolean);
  const STEPS = [];
  for (const w of W) { for (const g of G) STEPS.push(cat(w, g)); for (const a of AIR) STEPS.push(cat(w, a)); }
  for (const w of W) for (const j of ['sh', 'fh']) for (const w2 of W2) for (const a of AIR) STEPS.push(cat(w, j, w2, a));
  for (const w of W) for (const w2 of W2) for (const a of AIR) { STEPS.push(cat(w, 'dj', w2, a)); STEPS.push(cat(w, 'ff', w2, a)); }
  if (J.specials !== false) {
    /* the rope-out cancel: out of the move that just hit, Rope Swing forward or back, then the bite, or a hop into an aerial */
    for (const r of ['ro_f', 'ro_b']) { for (const w of ['', 'w2', 'w5', 'w9', 'w14']) STEPS.push(cat(r, w, 'bite')); for (const w of ['', 'w4', 'w9']) for (const a of AIR) STEPS.push(cat(r, w, 'hop', a)); for (const a of AIR) STEPS.push(cat(r, 'w3', 'hop', 'w6', a)); }
    for (const w of W) { STEPS.push(cat(w, 'rs', 'w4', 'bite')); STEPS.push(cat(w, 'rs', 'w10', 'bite')); }
    /* the coal and the ant, then an attack while they work */
    for (const c of ['coal', 'coalH', 'coalL']) for (const w of ['', 'w6']) { for (const g of G) STEPS.push(cat(c, w, g)); for (const j of ['sh', 'fh']) for (const a of AIR) STEPS.push(cat(c, w, j, a)); }
    for (const w of ['', 'w8', 'w16', 'w28']) { for (const g of G) STEPS.push(cat('ant', w, g)); for (const j of ['sh', 'fh']) for (const a of AIR) STEPS.push(cat('ant', w, j, a)); STEPS.push(cat('ant', w, 'rs', 'w4', 'bite')); }
    for (const w of ['', 'w4']) for (const g of G) STEPS.push(cat('relay', w, g));
  }
  if (J.moves) for (const m of ['wf4', 'wb4', 'wf10', 'rf6', 'rf12', 'rb6']) { for (const g of G) STEPS.push(cat(m, g)); for (const j of ['sh', 'fh']) for (const a of AIR) STEPS.push(cat(m, j, a)); }
  const def = J.def ? (J.def === 'cpu9' ? 'cpu9' : K.defender(J.def)) : (() => blankIn());
  K.setup(J.sit); K.kIn = () => blankIn(); K.vIn = def; for (let t = 0; t < 2; t++) step();
  let pre = null;
  if (J.preK) {   /* a scripted opening before the search: it starts from the frame Chomp's first hit lands */
    pre = K.exec(J.preK.split(' '), { patience: 200 }); let n = 0;
    K.kIn = (ff, oo) => K.input(pre, ff, oo);
    while (COMBO[0].hits < 1 && n++ < 400) { step(); K.after(pre, F[0]); }
    if (COMBO[0].hits < 1) { console.log('pre: no hit'); return; }
    console.log('pre: hit after ' + n + ' frames, ' + F[0].mname + ' foe ' + F[1].pct.toFixed(1) + '% ' + F[1].state);
    pre.patience = 45;
  }
  const w0 = K.watch(); if (J.preK) { w0.prev = COMBO[0].hits; w0.best = COMBO[0].hits; w0.dmg = COMBO[0].dmg; }
  const strip = w => ({ best: w.best, dmg: w.dmg, prev: w.prev, resets: w.resets, firstReset: w.firstReset, ko: w.ko, koT: w.koT, koHits: w.koHits, koHurt: w.koHurt, kos0: w.kos0, log: w.log.slice(), t: w.t, lastHit: w.lastHit, antHits: w.antHits, coalHits: w.coalHits, ropeBlocks: w.ropeBlocks, cuts: w.cuts, vState: w.vState });
  const mkW = s => { const w = K.watch(); Object.assign(w, JSON.parse(JSON.stringify(s))); return w; };
  const cpE = e => Object.assign({}, e, { toks: e.toks.slice() });
  const root = { snap: NET.save(), e: pre ? cpE(pre) : K.exec([], { patience: 45 }), w: strip(w0), route: J.preK ? [J.preK] : [] };
  const kDeaths0 = F[1].kos;
  let sims = 0, frames = 0;
  const sig = () => { const f = F[0], v = F[1], c = K.coal(f), a = K.ant(f); return [Math.round(f.x / 2), Math.round(f.y / 2), Math.round(v.x / 2), Math.round(v.y / 2), Math.round(v.pct / 3), f.state, f.mname, c ? c.st + Math.round(c.x / 4) : '-', a ? Math.round(a.s / 4) : '-', f.airUse && f.airUse.rope ? 1 : 0].join(','); };
  function expand(node, stepToks) {
    NET.load(node.snap); const e = cpE(node.e); e.toks.push(...stepToks); const w = mkW(node.w); const best0 = w.best;
    K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = def; sims++;
    const f = F[0], v = F[1];
    for (let t = 0; t < 200; t++) {
      step(); frames++; K.after(e, f); w.frame();
      if (F[1].kos > kDeaths0) return null;
      if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? { ko: true, route: node.route.concat([stepToks.join(' ')]), w: strip(w), e } : null;
      if (w.resets > 0 || e.failed >= 0) return null;
      if (K.finished(e)) { if (w.best > best0) return { snap: NET.save(), e: cpE(e), w: strip(w), route: node.route.concat([stepToks.join(' ')]), pct: v.pct, sig: sig() }; return null; }
    }
    return null;
  }
  function tailKO(node) {
    NET.load(node.snap); const e = cpE(node.e); e.drift = 0; const w = mkW(node.w);
    K.kIn = (ff, oo) => K.input(e, ff, oo); K.vIn = def;
    for (let t = 0; t < 240; t++) { step(); frames++; K.after(e, F[0]); w.frame(); if (F[1].kos > kDeaths0) return null; if (w.ko) return w.koHurt && (w.firstReset < 0 || w.firstReset >= w.koT) ? strip(w) : null; if (w.resets > 0) return null; }
    return null;
  }
  const score = c => c.pct + c.w.best * (J.hitW || 0.5);
  const found = [], seen = new Set(); let beam = [root];
  const t0 = Date.now();
  for (let d = 0; d < (J.depth || 20) && beam.length; d++) {
    const kids = [];
    for (const n of beam) for (const s of (d === 0 && J.first ? STEPS.filter(q => J.first.split(',').some(x => q.includes(x))) : STEPS)) {
      const c = expand(n, s); if (!c) continue;
      if (c.ko) { found.push({ route: c.route.join(' | '), hits: c.w.best, dmg: c.w.dmg, ko: true, koT: c.w.koT, frames: c.w.t, ant: c.w.antHits, coal: c.w.coalHits, how: 'hit', log: c.w.log }); continue; }
      if (seen.has(c.sig)) continue; seen.add(c.sig); kids.push(c);
    }
    kids.sort((a, b) => score(b) - score(a));
    beam = kids.slice(0, J.beam || 12);
    for (const n of kids) { const k = tailKO(n); if (k) found.push({ route: n.route.join(' | '), hits: k.best, dmg: k.dmg, ko: true, koT: k.koT, frames: k.t, ant: k.antHits, coal: k.coalHits, how: 'launch', log: k.log }); }
    const top = beam[0];
    console.log('[' + J.name + '] depth ' + (d + 1) + ': ' + kids.length + ' kids, best ' + (top ? top.w.best + ' hits ' + top.pct.toFixed(0) + '%  ' + top.route.join(' | ') : '-') + '  KOs ' + found.filter(x => x.ko).length + '  (' + sims + ' sims, ' + Math.round(frames / 1000) + 'k frames, ' + Math.round((Date.now() - t0) / 1000) + 's)');
    if (J.goal === 'ko' && found.filter(x => x.ko).length >= (J.stopAfter || 30)) break;
    if (J.hitsLog) for (const n of beam.slice(0, 3)) found.push({ route: n.route.join(' | '), hits: n.w.best, dmg: n.w.dmg, ko: false, pct: +n.pct.toFixed(1), depth: d + 1, ant: n.w.antHits, coal: n.w.coalHits });
  }
  found.sort((a, b) => (b.ko - a.ko) || (a.frames - b.frames));
  FS.writeFileSync(J.out, JSON.stringify({ job: J, sims, frames, found }, null, 1));
  console.log('[' + J.name + '] wrote ' + found.length + ' to ' + J.out);
});
