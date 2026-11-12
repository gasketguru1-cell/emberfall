// Rollback netcode test. Two copies of the game run in separate sandboxes (as two machines would), joined by a simulated
// network with latency, jitter and packet loss, each playing one fighter from a scripted, seeded input stream. A third copy
// plays the same inputs with no network at all. Pass: both machines' checksums agree with each other and with the offline
// copy at every checked frame, and their final states match it exactly.
//   node tests/net.js            (several match-ups and network conditions)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const SRC = ['hitboxes.js', 'sim.js', 'net.js'].map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]);

function machine() {
  const g2 = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
  const ctx = vm.createContext({ console, Math, Date, performance: { now: () => Date.now() }, localStorage: { getItem() { return null; }, setItem() {} },
    document: { getElementById: () => ({ getContext: () => g2, addEventListener() {}, style: {} }), addEventListener() {} }, addEventListener() {}, requestAnimationFrame() {}, navigator: {}, window: undefined });
  for (const [f, src] of SRC) vm.runInContext(src, ctx, { filename: f });
  return ctx;
}
/* a seeded stream of player-like inputs: sticks and buttons held for a while, then changed */
function script(seed) {
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out = []; let cur = [0, 0, 0, 0, 0], left = 0;
  for (let k = 0; k < 20000; k++) {
    if (left-- <= 0) { left = 2 + (rnd() * 18 | 0); const r = rnd(); cur = [Math.round((rnd() * 2 - 1) * 127), Math.round((rnd() * 2 - 1) * 127), r < 0.1 ? (rnd() < 0.5 ? -127 : 127) : 0, 0, rnd() < 0.55 ? 1 << (rnd() * 5 | 0) : 0]; if (rnd() < 0.3) cur[0] = cur[1] = 0; }
    out.push(cur.slice());
  }
  return out;
}
function setup(ctx, a, b) {
  vm.runInContext(`TRAINING = false; slots[0] = { dev: 'kb', pick: ${a}, ready: true }; slots[1] = { dev: 'kb', pick: ${b}, ready: true }; startMatch(); mode = 'play'; countdown = 0; for (const f of F) f.ctl = new Ctl('cpu');`, ctx);
}
function run(pa, pb, frames, net, seedA, seedB) {
  const sc = [script(seedA), script(seedB)];
  /* offline reference: the same packed inputs, frame by frame, no network */
  const ref = machine(); setup(ref, pa, pb); ref.SC = sc;
  const refHash = new Map();
  vm.runInContext(`for (const f of F) f.ctl.dev = 'net' + f.idx;`, ref);
  for (let k = 0; k < frames; k++) {
    ref.K = k; vm.runInContext(`NET._in = [0, 1].map(p => NET.unpack(K < NET.DELAY ? [0, 0, 0, 0, 0] : SC[p][K])); step();`, ref);
    if (k % 30 === 0) refHash.set(k, vm.runInContext('NET.hash()', ref));
  }
  const refFinal = vm.runInContext('NET.hash()', ref);
  /* two machines and a network between them */
  const M = [machine(), machine()], q = [[], []];   /* q[i]: packets on their way to machine i */
  let now = 0, rndS = 12345; const rnd = () => { rndS = (Math.imul(rndS, 1103515245) + 12345) >>> 0; return rndS / 4294967296; };
  M.forEach((ctx, me) => {
    setup(ctx, pa, pb); ctx.SC = sc[me];
    ctx.TR = { send: m => { if (rnd() < net.loss) return; q[1 - me].push({ at: now + net.ms + rnd() * net.jitter, m: JSON.parse(JSON.stringify(m)) }); }, onMessage: fn => { ctx.RECV = fn; } };
    ctx.ME = me; vm.runInContext(`NET.start(ME, TR, { local: () => NET.unpack(SC[NET.session().f + NET.DELAY]) });`, ctx);
  });
  const t0 = Date.now(); let guard = 0;
  while (M.some(ctx => vm.runInContext('NET.session().f', ctx) < frames) && guard++ < frames * 20) {
    now += 1000 / 60;
    for (let i = 0; i < 2; i++) { const due = q[i].filter(p => p.at <= now); q[i] = q[i].filter(p => p.at > now); for (const p of due) M[i].RECV(p.m); }
    M.forEach((ctx, i) => { const n = i === 1 && net.skew && guard % net.skew === 0 ? 2 : 1; for (let r = 0; r < n; r++) if (vm.runInContext('NET.session().f', ctx) < frames) vm.runInContext('NET.tick()', ctx); });   /* skew: machine 2's clock runs fast */
  }
  /* let the last inputs arrive so the final frames are confirmed, then compare */
  for (let k = 0; k < 120; k++) { now += 1000 / 60; for (let i = 0; i < 2; i++) { const due = q[i].filter(p => p.at <= now); q[i] = q[i].filter(p => p.at > now); for (const p of due) M[i].RECV(p.m); } }
  const res = M.map(ctx => vm.runInContext(`({ f: NET.session().f, hash: NET.hash(), stats: NET.session().stats, desync: NET.session().desync, hashes: [...NET.session().hashes] })`, ctx));
  let agree = 0, wrong = [];
  for (const r of res) for (const [fr, h] of r.hashes) { if (refHash.has(fr)) { if (refHash.get(fr) === h) agree++; else wrong.push(fr); } }
  return { ok: res.every(r => r.hash === refFinal && !r.desync) && !wrong.length, agree, wrong: wrong.slice(0, 5), final: res.map(r => r.hash === refFinal), desync: res.map(r => r.desync), stats: res.map(r => r.stats), ms: Date.now() - t0 };
}
if (require.main === module) {
  const probe = machine(), names = vm.runInContext('ROSTER.map(d => d.name)', probe);
  const idx = n => names.indexOf(n);
  const fowl = names.findIndex(n => /fowl/i.test(n)), sack = names.findIndex(n => /sack/i.test(n));
  const pairs = [[sack, fowl], [fowl, fowl], [sack, sack]].concat(names.map((_, i) => [i, (i + 1) % names.length]));
  const nets = [{ name: 'LAN', ms: 8, jitter: 4, loss: 0 }, { name: '60 ms, 2% loss', ms: 30, jitter: 12, loss: 0.02 }, { name: '120 ms, 5% loss', ms: 60, jitter: 30, loss: 0.05 }, { name: '60 ms, clock +5%', ms: 30, jitter: 12, loss: 0.02, skew: 20 }];
  let bad = 0, n = 0;
  for (const [a, b] of pairs) for (const net of (a === sack && b === fowl ? nets : [nets[1]])) {
    const r = run(a, b, 1800, net, 1000 + a * 7 + b, 2000 + b * 13 + a); n++;
    const st = r.stats[0];
    console.log((r.ok ? 'pass' : 'FAIL') + '  ' + (names[a] + ' v ' + names[b]).padEnd(34) + net.name.padEnd(17) + ' checks agreed ' + r.agree + (r.wrong.length ? ' wrong at ' + r.wrong : '') + '  rollbacks ' + st.rollbacks + (r.stats[1].slowed || st.slowed ? ', slowed ' + ((st.slowed || 0) + (r.stats[1].slowed || 0)) : '') + ' (deepest ' + st.maxDepth + ', ' + (st.resimMs / Math.max(1, st.rollbacks)).toFixed(2) + ' ms each), waits ' + st.waits + (r.desync.some(Boolean) ? '  DESYNC ' + JSON.stringify(r.desync) : ''));
    if (!r.ok) bad++;
  }
  console.log(bad ? bad + ' of ' + n + ' FAILED' : 'all ' + n + ' netplay runs match the offline game exactly');
  process.exit(bad ? 1 : 0);
}
module.exports = { run, machine };
