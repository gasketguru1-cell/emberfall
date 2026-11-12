// Runs every scripted clip of clips-list.js headless and prints what happens, so the captions match the game.
global.window = global; global.VREC = { foe: () => null };
(0, eval)(FS.readFileSync('tools/viking-studies/clips-list.js', 'utf8'));
for (const c of VCLIPS.list) { if (c.name === 'rec_far' || c.name === 'tc_sack_dtilt_rc_tech' || c.fdef || c.def === 'cpu9' || typeof c.def === 'function') { console.log(c.name.padEnd(30), '(scripted foe / CPU: skipped)'); continue; }
  const o = Object.assign({}, c.sit); if (c.def) o.def = KLAB.defender(c.def); const r = KLAB.run(c.route, o);
  console.log(c.name.padEnd(30), 'ko', r.ko, 'hits', r.hits, 'dmg', (+r.dmg).toFixed(1)); }
