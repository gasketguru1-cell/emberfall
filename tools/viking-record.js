// Records Fyrdsman (the Viking) clips for the discovery album, through tools/knell-record.js (KREC.clip), with the lab
// tokens of tools/viking-lab.js plus a few scene tokens below. A testing tool only: nothing here changes the game.
// Load into a browser tab on /dev/, after tools/record.js, tools/knell-lab.js, tools/viking-lab.js and tools/knell-record.js:
//   await VREC.clip({ name, cat, title, inputs, route, sit, def, opt })
// Clips go through record-server's /kfile route (playtest-results/knell/vk_<cat>/), and are moved to playtest-results/viking/clips/.
(function () {
  const VREC = window.VREC = {}, A = KLAB.A, sg = x => x < 0 ? -1 : 1;
  /* scene tokens */
  /* tele<x>_<y>: put the Viking in the air at (x, y) facing the stage, both jumps kept (a starting position, not a move) */
  for (const x of [100, 120, 140, 160]) for (const y of [-30, 0, 20]) A['tele' + x + '_' + (y < 0 ? 'm' + -y : y)] = { ok: () => true, inp(i, k, f) {
    if (k === 0) { f.x = x; f.y = y; f.vx = f.vy = 0; f.grounded = false; f.plat = null; f.set('air'); f.face = -1; f.jumps = f.st.jumps ?? 1; f.sideUsed = false; } }, done: k => k >= 1, wait: 1 };
  /* spcHurt: special held whenever the Viking is hit (hitstun, hitlag, held in a grab), for 150 frames: a recall from hitstun */
  A.spcHurt = { ok: () => true, inp(i, k, f) { if (f.state === 'hurt' || f.hitlag > 0 || f.state === 'held') i.spc = true; }, done: k => k >= 150, wait: 1 };
  /* inN: the stick held toward the stage for N frames (air drift) */
  for (const n of [10, 20, 30, 40, 60]) A['in' + n] = { ok: () => true, inp(i, k, f) { i.lx = -sg(f.x); }, done: k => k >= n, wait: 1 };
  /* djIn, sspecIn, uspecIn: the double jump, Side-B and up-B toward the stage, the stick held in through the up-B's rise */
  A.djIn = { ok: f => !f.grounded && f.jumps > 0, inp(i, k, f) { if (k === 0) i.jmp = true; i.lx = -sg(f.x); }, done: k => k >= 12 };
  A.sspecIn = { ok: f => !f.grounded && f.state === 'air', inp(i, k, f) { i.lx = -sg(f.x); if (k === 0) i.spc = true; }, done: (k, f) => k >= 4 && f.state !== 'attack' };
  A.uspecIn = { ok: f => !f.grounded && f.state === 'air', inp(i, k, f) { if (k < 2) { i.spc = true; i.ly = 1; } else i.lx = -sg(f.x); }, done: (k, f) => k >= 4 && (f.state !== 'attack' || f.grounded) };
  /* the opponent's scripts: press an attack once, at a frame after the Viking starts his counter (or at once), then hold a DI */
  VREC.foe = function (atk, opt) {
    opt = opt || {}; let t = 0, ds = -1, pressed = 0; const after = opt.di ? KLAB.defender({ di: opt.di, gate: true }) : null;
    const press = (i, v, a) => { const d = sg(a.x - v.x); if (atk === 'fsmash') { i.lx = d; i.sm = true; } else if (atk === 'ftilt') i.lx = 0.6 * d; else if (atk === 'grab') { i.grb = true; return; } i.atk = true; };
    return function (v, a) { t++; const i = blankIn();
      if (opt.onCounter) { if (ds < 0 && a.mname === 'dspec' && a.state === 'attack') ds = t; if (ds >= 0 && pressed < 2 && t >= ds + opt.onCounter) { press(i, v, a); pressed++; return i; } }
      else if (pressed < (opt.hold || 3) && t > (opt.at ?? 84))   /* after the recorder's 80-frame lead-in */ { press(i, v, a); pressed++; return i; }
      return after && pressed ? after(v, a) : i; };
  };
  /* one clip: KREC.clip with the caption, the stills in playtest-results/viking/stills (the server's /png keeps the folder name flat) */
  VREC.clip = async function (c) {
    const sit = Object.assign({}, c.sit); if (c.def === 'cpu9') sit.def = 'cpu9'; else if (typeof c.def === 'function') sit.def = c.def;
    const defender = c.def && typeof c.def === 'object' ? c.def : null;
    const r = await KREC.clip(c.name, 'vk_' + c.cat, c.route, sit, defender, [c.title, c.inputs], Object.assign({ stills: 'vikingstills' }, c.opt || {}));
    return { name: c.name, cat: c.cat, route: c.route, res: r.res, stills: r.stills, seconds: r.seconds, bytes: r.bytes };
  };
})();
