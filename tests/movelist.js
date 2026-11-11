// Every fighter's move list documents every move it has, with a name, a description and (for real attacks) a frame line.
// Usage: node tests/movelist.js        (exit code 1 if anything is missing)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
for (const f of ['hitboxes.js', 'sim.js', 'movelist.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
vm.runInThisContext(`
(function () {
  let bad = 0, pages = 0, moves = 0;
  for (const def of ROSTER) {
    const miss = mlMissing(def), secs = mlSections(def);
    for (const s of secs) for (const p of s.pages) { pages++; moves += p.entries.length; if (!p.entries.length || p.entries.length > 8) { console.log('FAIL ' + def.name + ': page "' + p.title + '" has ' + p.entries.length + ' entries'); bad++; } }
    if (miss.length) { console.log('FAIL ' + def.name + ': not documented: ' + miss.join(', ')); bad++; }
    else console.log('ok   ' + def.name + ': ' + secs.reduce((n, s) => n + s.pages.length, 0) + ' pages');
  }
  console.log(pages + ' pages, ' + moves + ' entries' + (bad ? ', ' + bad + ' problems' : ', all documented'));
  if (bad) process.exitCode = 1;
})();
`);
