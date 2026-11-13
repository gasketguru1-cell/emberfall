// Plays a whole match saved by tools/chomp-cpu-test.js (CLIPS=dir: every frame's input for both fighters) again in a browser tab,
// and films a stretch of it with tools/chomp-record.js's encoder: the clips of Funny mode's best moments.
// A testing tool only. In a tab of the game (never the one being played), with tools/record.js, tools/chomp-lab.js,
// tools/chomp-record.js and this loaded, and tools/record-server.js running:
//   await CRP.film('/playtest-results/chomp/replays/11-cpu9-flint-g0.json', 'name', 'Funny-Clips', from, to, ['caption', 'line 2'])
//   from, to: frames of the match (the 'at' of the test's EV lines). The match is played up to 'from' undrawn, then drawn and filmed.
// The replay checks the fighters' positions against the ones saved every 30 frames and stops if they differ (a different build).
(function () {
  const CRP = window.CRP = {};
  const dec = a => { const i = blankIn(); i.lx = a[0]; i.ly = a[1]; i.cx = a[2]; i.cy = a[3]; const b = a[4];
    i.atk = !!(b & 1); i.spc = !!(b & 2); i.jmp = !!(b & 4); i.shd = !!(b & 8); i.grb = !!(b & 16); i.sm = !!(b & 32); i.jmp2 = !!(b & 64); i.tf = !!(b & 128); i.start = !!(b & 256); i.sel = !!(b & 512); return i; };
  CRP.load = async url => (await fetch(url)).json();
  /* the match as the test started it, and its inputs fed back through PRO_SIM (which supplies every fighter's input) */
  CRP.start = function (J) {
    const opt0 = Object.assign({}, OPT); Object.assign(OPT, J.opt || {});
    TRAINING = false; slots[0] = { dev: 'kb', pick: J.chomp, ready: true }; slots[1] = { dev: 'kb', pick: J.foe, ready: true };
    startMatch(J.stocks, J.stage); F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl(J.foeDev); F[0].noSwap = F[1].noSwap = true;
    F[0].ctl.ai.lv = J.lv; F[1].ctl.ai.lv = J.foeLv; frame = J.f0 || 0; tick = J.tick0 || 0;
    const n = [0, 0]; PRO_SIM = f => { const a = J.inp[f.idx][n[f.idx]++]; return a ? dec(a) : blankIn(); };
    const ck = new Map(J.chk.map(c => [c[0], c]));
    return { n, opt0, check() { const c = ck.get(n[1] + 1); if (!c) return null;   /* saved as fighter 1 asked for its input that frame: before the step, so after step k it is entry k + 1 */ const d = Math.max(Math.abs(F[0].x - c[1]), Math.abs(F[0].y - c[2]), Math.abs(F[1].x - c[3]), Math.abs(F[1].y - c[4])); return d > 0.01 ? 'off by ' + d.toFixed(3) + ' at ' + n[1] : null; } };
  };
  CRP.stop = function (s) { PRO_SIM = null; Object.assign(OPT, s.opt0); mode = 'select'; };
  /* played through without drawing: does it still match the test's match? */
  CRP.verify = async function (url, upTo) {
    const J = await CRP.load(url), s = CRP.start(J); let bad = null;
    try { while (s.n[1] < Math.min(upTo || 1e9, J.inp[1].length) && !bad) { step(); bad = s.check(); } } finally { CRP.stop(s); }
    return bad || 'ok to ' + s.n[1];
  };
  CRP.film = async function (url, name, dir, from, to, cap) {
    const J = await CRP.load(url), s = CRP.start(J); let bad = null;
    const r = CREC._rec();
    try {
      while (s.n[1] < from - 90 && !bad) { step(); bad = s.check(); }
      if (bad) throw new Error('replay differs: ' + bad);
      while (s.n[1] < from) { step(); tick++; draw(); }   /* drawn, not filmed: the camera settles on them */
      while (s.n[1] < to && s.n[1] < J.inp[1].length) { step(); r.frame(cap); if (!bad) bad = s.check(); }
    } finally { CRP.stop(s); }
    const out = await r.finish(name, dir); out.check = bad || 'ok'; return out;
  };
})();
