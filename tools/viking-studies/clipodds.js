// Each scripted clip of clips-list.js run 20 times (the random numbers running on), with how often each outcome came up.
global.window = global; global.VREC = { foe: () => null }; (0, eval)(FS.readFileSync('tools/viking-studies/clips-list.js', 'utf8'));
for (const c of VCLIPS.list) { if (c.name === 'rec_far' || c.fdef || c.def === 'cpu9') continue; const tally = {};
  for (let n = 0; n < 20; n++) { const o = Object.assign({}, c.sit); if (typeof c.def === 'function') o.def = c.def; else if (c.def) o.def = KLAB.defender(c.def);
    const r = KLAB.run(c.route, o); const k = (r.ko ? 'KO ' : '') + r.hits + 'h/' + Math.round(r.dmg); tally[k] = (tally[k] || 0) + 1; }
  console.log(c.name.padEnd(26), JSON.stringify(tally)); }
