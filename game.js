'use strict';
/* Emberfall - an original two-fighter platform fighter. One mode: 3 stocks, 8 minutes. */
const cv = document.getElementById('c'), g = cv.getContext('2d');
const W = 1280, H = 720, TAU = Math.PI * 2;
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const appr = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);

/* ---------- Rules and feel (movement numbers follow the player's own platforms.ini) ---------- */
const STOCKS = 3, MATCH_FRAMES = 8 * 60 * 60;
const T = {
  drop_stick_y: -0.60, drop_flick_frames: 6, landing_drop_buffer: 8,
  shield_drop_stick_y: -0.55, air_pass_stick_y: -0.70, air_pass_max_x: 0.40,
  wd_window_distance: 12, wd_deadzone: 0.30, wd_long_angle: 30, wd_down_angle: 70,
  wd_long_speed: 2.0, wd_short_speed: 1.1, wd_friction: 0.09, wd_max_speed: 3.0,
  wd_actionable_frame: 7, wd_max_frames: 45,
  dash_stick_x: 0.60, dash_flick_frames: 4, buffer: 9, wd_jumpsquat_buffer: 2,
};

/* ---------- Stage (y is up; feet position) ---------- */
const MAIN = { x0: -80, x1: 80, y: 0, soft: false };
const PLATS = [MAIN, { x0: -19, x1: 19, y: 24, soft: true }, { x0: -64, x1: -34, y: 44, soft: true }, { x0: 34, x1: 64, y: 44, soft: true }];
const BODY_H = 24;
const BLAST = { l: -235, r: 235, t: 200, b: -140 };

/* ---------- Combat rules ---------- */
const DMG_1V1 = 1.2;                 /* one-on-one damage bonus */
const STALE = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03575, 0.02965];   /* repeated moves weaken */
const FRESH = 1.05, SHORT_HOP_MUL = 0.85, TUMBLE_KB = 80, CROUCH_MUL = 0.85, CHARGING_MUL = 1.2;
const SHIELD = { hp: 50, drain: 0.15, regen: 0.08, dmg: 1.19, release: 11, parry: 5, stun: { ground: 0.8, smash: 0.725, air: 0.33, proj: 0.29 } };
function staleMul(a, id) { let r = 0, seen = false; a.stale.forEach((m, k) => { if (m === id) { r += STALE[k]; seen = true; } }); return seen ? 1 - r : FRESH; }
function pushStale(a, id) { a.stale.unshift(id); if (a.stale.length > 9) a.stale.pop(); }
function rage(a) { return a.pct <= 35 ? 1 : a.pct >= 150 ? 1.1 : 1 + (a.pct - 35) / 115 * 0.1; }

/* ---------- Sound ---------- */
let AC = null;
function beep(freq, dur, type, vol, slide) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), a = AC.createGain(), t = AC.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    a.gain.setValueAtTime(vol || 0.05, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(AC.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* no audio */ }
}

/* ---------- Input ---------- */
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (/^(Arrow|Space|Enter)/.test(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function blankIn() { return { lx: 0, ly: 0, cx: 0, cy: 0, atk: false, spc: false, jmp: false, shd: false, grb: false, start: false }; }
function dz(v) { return Math.abs(v) < 0.2 ? 0 : v; }
function readKb() {
  const i = blankIn(), m = (keys.ShiftLeft || keys.ShiftRight) ? 0.5 : 1;
  i.lx = ((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0)) * m; i.ly = ((keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0)) * m;
  i.cx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0); i.cy = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
  i.atk = !!keys.KeyJ; i.spc = !!keys.KeyK; i.jmp = !!keys.Space; i.shd = !!keys.KeyL; i.grb = !!keys.KeyH; i.start = !!keys.Enter;
  return i;
}
function readPad(n) {
  const p = navigator.getGamepads ? navigator.getGamepads()[n] : null, i = blankIn();
  if (!p) return i;
  const b = k => !!(p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > 0.25)), ax = k => dz(p.axes[k] || 0);
  i.lx = ax(0); i.ly = -ax(1); i.cx = ax(2); i.cy = -ax(3);
  if (b(14)) i.lx = -1; if (b(15)) i.lx = 1; if (b(12)) i.ly = 1; if (b(13)) i.ly = -1;
  const m = Math.hypot(i.lx, i.ly); if (m > 1) { i.lx /= m; i.ly /= m; }
  /* Position-based layout: right face button attacks, bottom is special, left and top jump. */
  i.atk = b(1); i.spc = b(0); i.jmp = b(2) || b(3); i.shd = b(6) || b(7); i.grb = b(4) || b(5); i.start = b(9);
  return i;
}
function rumble(ctl, ms, strength) {
  if (!ctl || ctl.dev === 'kb' || ctl.dev === 'cpu') return;
  try { const p = navigator.getGamepads()[+ctl.dev.slice(3)]; if (p && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) { /* no rumble */ }
}
function readDev(dev) { return dev === 'kb' ? readKb() : readPad(+dev.slice(3)); }
function devName(dev) { return dev === 'kb' ? 'Keyboard' : dev === 'cpu' ? 'CPU' : 'Controller ' + (+dev.slice(3) + 1); }

class Ctl {
  constructor(dev) {
    this.dev = dev; this.c = blankIn(); this.p = blankIn(); this.ai = {};
    this.buf = { atk: 0, spc: 0, jmp: 0, shd: 0, grb: 0 };
    this.xT = 99; this.yT = 99; this.xFired = true; this.yFired = true;
    this.dashDir = 0; this.downBuf = 0; this.downNow = false; this.upNow = false; this.cPress = false; this.shdAge = 99;
  }
  poll(raw) {
    this.p = this.c; this.c = raw; const c = raw, p = this.p;
    for (const k in this.buf) { if (c[k] && !p[k]) this.buf[k] = T.buffer; else if (this.buf[k] > 0) this.buf[k]--; }
    this.shdAge = c.shd && !p.shd ? 0 : Math.min(99, this.shdAge + 1);
    const ax = Math.abs(c.lx), ay = Math.abs(c.ly);
    if (ax < 0.3 || (Math.abs(p.lx) >= 0.3 && sgn(p.lx) !== sgn(c.lx))) { this.xT = 0; this.xFired = false; } else this.xT++;
    this.dashDir = 0;
    if (ax >= T.dash_stick_x && this.xT <= T.dash_flick_frames && !this.xFired) { this.xFired = true; this.dashDir = sgn(c.lx); }
    this.xSmash = ax >= 0.8 && this.xT <= 5;
    if (ay < 0.3 || (Math.abs(p.ly) >= 0.3 && sgn(p.ly) !== sgn(c.ly))) { this.yT = 0; this.yFired = false; } else this.yT++;
    this.downNow = this.upNow = false; if (this.downBuf > 0) this.downBuf--;
    if (ay >= 0.55 && this.yT <= T.drop_flick_frames && !this.yFired) {
      this.yFired = true; if (c.ly < 0) { this.downNow = true; this.downBuf = T.landing_drop_buffer; } else this.upNow = true;
    }
    this.ySmash = ay >= 0.8 && this.yT <= 5;
    this.cPress = Math.hypot(c.cx, c.cy) >= 0.5 && Math.hypot(p.cx, p.cy) < 0.5;
  }
  pressed(k) { return this.c[k] && !this.p[k]; }
  take(k) { if (this.buf[k] > 0) { this.buf[k] = 0; return true; } return false; }
}

/* ---------- Effects ---------- */
let PART = [], POPS = [], shake = 0;
function spark(x, y, col, n, sp) {
  for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = (0.3 + Math.random()) * (sp || 1); PART.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 14, col, r: 0.6 + Math.random() * 1.2 }); }
}
function pop(x, y, text, col) { POPS.push({ x, y, text, col, life: 50 }); }

/* ---------- Moves ---------- */
let PROJ = [];
function shoot(f, o) {
  o.h.id = f.form.name + ':' + f.mname;
  PROJ.push(Object.assign({ x: f.x + (o.ox || 8) * f.face, y: f.y + (o.oy || 8), vy: 0, grav: 0, life: 60, owner: f.idx, face: f.face, ground: 'die', plat: null }, o, { vx: (o.vx || 0) * f.face }));
}
/* Shared set of ground and air attacks, scaled per fighter: R reach, P power, S frame speed, Y height. */
function mk(R, P, S, Y, special) {
  const F = n => Math.max(1, Math.round(n * S));
  const hb = (f0, f1, x, y, r, d, a, b, k, o) => Object.assign({ f0: F(f0), f1: F(f1), x: x * R, y: y * Y, r: r * (0.55 + 0.45 * R), d: Math.round(d * P * 10) / 10, a, b, k }, o);
  const m = {
    jab: { t: F(16), h: [hb(3, 5, 9, 8, 4.5, 3, 70, 16, 30)] },
    ftilt: { t: F(27), tilt: 1, h: [hb(6, 9, 11, 8, 5, 8, 361, 25, 90)] },
    utilt: { t: F(26), tilt: 1, h: [hb(5, 10, 3, 17, 5.5, 6.5, 95, 30, 95)] },
    dtilt: { t: F(22), tilt: 1, h: [hb(5, 7, 10, 2.5, 4.5, 6, 75, 25, 70)] },
    dash: { t: F(36), h: [hb(7, 14, 8, 6, 5.5, 9, 60, 50, 60)] },
    fsmash: { t: F(46), chg: F(8), h: [hb(15, 18, 13, 8, 6.5, 16, 361, 28, 100)] },
    usmash: { t: F(42), chg: F(6), h: [hb(10, 15, 2, 18, 7, 14, 88, 30, 97)] },
    dsmash: { t: F(44), chg: F(5), h: [hb(8, 10, 11, 3, 5.5, 12, 30, 30, 85), hb(16, 18, -11, 3, 5.5, 13, 150, 30, 88, { g: 1 })] },
    nair: { t: F(40), ll: F(7), air: 1, h: [hb(4, 20, 0, 7, 7, 8, 45, 22, 80, { away: 1 })] },
    fair: { t: F(40), ll: F(11), air: 1, h: [hb(8, 12, 10, 8, 5.5, 10, 45, 30, 95)] },
    bair: { t: F(36), ll: F(10), air: 1, h: [hb(7, 10, -11, 8, 5.5, 11, 140, 25, 100)] },
    uair: { t: F(32), ll: F(8), air: 1, h: [hb(5, 10, 1, 18, 6, 8, 80, 25, 95)] },
    dair: { t: F(44), ll: F(14), air: 1, h: [hb(12, 15, 1, -1, 5.5, 12, 270, 20, 80)] },
    grab: { t: F(30), h: [{ f0: 6, f1: 8, x: 9 * R, y: 7 * Y, r: 4.5, grab: 1, d: 0 }] },
    getup: { t: F(40), h: [hb(16, 19, 9, 5, 6, 7, 48, 60, 40), hb(16, 19, -9, 5, 6, 7, 132, 60, 40, { g: 1 })], on(f, n) { if (n === 1) f.invuln = Math.max(f.invuln, 18); } },
  };
  /* Aerials land without lag before the hit comes out or once it is well over. */
  for (const k of ['nair', 'fair', 'bair', 'uair', 'dair']) m[k].ac = Math.max(...m[k].h.map(h => h.f1)) + F(9);
  const th = (d, a, b, k) => ({ d: Math.round(d * P * 10) / 10, a, b, k });
  m.throws = { f: th(8, 45, 60, 60), b: th(9, 135, 60, 65), u: th(7, 88, 55, 55), d: th(5, 75, 45, 30) };
  return Object.assign(m, special);
}
const lift = (f, vy) => { f.grounded = false; f.plat = null; f.vy = vy; };
const SWAP = { t: 34, swap: 1, h: [], on(f, n) { if (n === 1) f.invuln = Math.max(f.invuln, 12); if (n === 17) { f.fi = (f.fi + 1) % f.def.forms.length; spark(f.x, f.y + 7, '#fff', 14, 1.4); beep(660, 0.12, 'triangle', 0.05, 1.6); } } };

/* ---------- Fighters (all original) ---------- */
const FLINT = {
  name: 'Flint', sub: 'the lamplighter', forms: [{
    name: 'Flint', col: ['#1f6f78', '#f2c14e', '#f6e7c1'], alt: ['#7a3b69', '#9be564', '#f6e7c1'],
    st: { weight: 98, walk: 1.1, dash: 1.95, run: 1.75, airSpeed: 1.12, airAcc: 0.075, grav: 0.095, fall: 1.6, ffall: 2.55, jump: 3.05, shop: 1.85, djump: 2.95, jsq: 3, trac: 0.11, w: 8, h: 14 },
    aiShot: 1,
    moves: mk(1, 1, 1, 1, {
      /* Ember Toss: a lobbed coal that keeps burning where it lands. */
      nspec: { t: 40, h: [], on(f, n) { if (n === 14) { shoot(f, { kind: 'ember', vx: 1.4, vy: 1.7, grav: 0.09, r: 3, life: 120, ground: 'stick', h: { d: 5, a: 70, b: 30, k: 40 } }); beep(520, 0.08, 'sawtooth', 0.04, 0.6); } } },
      /* Lantern Rush: a straight lunge behind the swinging lantern. */
      sspec: { t: 44, once: 1, nodrift: 1, h: [{ f0: 12, f1: 22, x: 8, y: 8, r: 6, d: 9, a: 50, b: 50, k: 70 }], on(f, n) { if (n >= 12 && n <= 22) { f.vx = f.face * 2.6; if (!f.grounded) f.vy = 0; } if (n === 23) f.vx *= 0.3; } },
      /* Updraft: rides the lantern's heat straight up. */
      uspec: { t: 40, helpless: 1, ledge: 1, h: [{ f0: 6, f1: 16, x: 0, y: 10, r: 7, d: 7, a: 85, b: 60, k: 60 }], on(f, n, i) { if (n === 6) { lift(f, 3.7); f.vx = i.lx * 0.9; } } },
      /* Flare Burst: slow point-blank blast all around. */
      dspec: { t: 56, h: [{ f0: 20, f1: 24, x: 0, y: 8, r: 13, d: 15, a: 50, b: 40, k: 95, away: 1 }], on(f, n) { if (n === 1 && !f.grounded) f.vy *= 0.4; if (n === 20) { spark(f.x, f.y + 8, '#f2c14e', 26, 2.2); beep(140, 0.25, 'sawtooth', 0.07, 0.4); } } },
    }),
  }],
};
const WREN = {
  name: 'Wren', sub: 'and her three companions', forms: [{
    /* Nib: a wind-up fox. Light, quick, short reach. */
    name: 'Nib', col: ['#c9862b', '#6b4a1e', '#ffe8a3'], alt: ['#4f9d8f', '#1f4d47', '#e8fff6'],
    st: { weight: 80, walk: 1.25, dash: 2.2, run: 2.05, airSpeed: 1.25, airAcc: 0.09, grav: 0.11, fall: 1.8, ffall: 2.85, jump: 3.2, shop: 2.0, djump: 3.1, jsq: 3, trac: 0.13, w: 8, h: 9 },
    aiShot: 1,
    moves: mk(0.85, 0.8, 0.85, 0.65, {
      nspec: { t: 30, h: [], on(f, n) { if (n === 10) { shoot(f, { kind: 'bolt', oy: 5, vx: 3.2, r: 2.2, life: 40, h: { d: 4, a: 361, b: 12, k: 25 } }); beep(900, 0.06, 'square', 0.03, 1.5); } } },
      sspec: { t: 42, once: 1, nodrift: 1, ll: 12, h: [{ f0: 10, f1: 24, x: 5, y: 5, r: 5.5, d: 8, a: 60, b: 45, k: 75 }], on(f, n) { if (n === 10) { lift(f, 1.7); f.vx = f.face * 2.4; } } },
      uspec: { t: 34, helpless: 1, ledge: 1, h: [{ f0: 5, f1: 10, x: 0, y: 6, r: 5, d: 3, a: 90, b: 40, k: 30 }], on(f, n, i) { if (n === 5) { lift(f, 4.3); f.vx = i.lx; } } },
      dspec: SWAP,
    }),
  }, {
    /* Loom: a kite spirit. Floaty with long ribbons. */
    name: 'Loom', col: ['#7b5cd6', '#f08fc0', '#fdf0ff'], alt: ['#2d7dd2', '#f7d154', '#f0fbff'],
    st: { weight: 94, walk: 1.0, dash: 1.75, run: 1.55, airSpeed: 1.05, airAcc: 0.06, grav: 0.07, fall: 1.25, ffall: 2.0, jump: 2.75, shop: 1.7, djump: 2.75, jsq: 3, trac: 0.08, w: 8, h: 15 },
    moves: mk(1.3, 0.95, 1.1, 1.05, {
      nspec: { t: 46, h: [{ f0: 14, f1: 17, x: 14, y: 9, r: 5, d: 7, a: 361, b: 30, k: 80 }, { f0: 14, f1: 17, x: 24, y: 9, r: 5, d: 10, a: 361, b: 30, k: 95 }] },
      sspec: { t: 44, h: [], on(f, n) { if (n === 16) { shoot(f, { kind: 'gust', vx: 1.8, r: 6, life: 45, h: { d: 2, a: 20, b: 70, k: 0 } }); beep(300, 0.2, 'sine', 0.05, 2); } } },
      uspec: { t: 50, helpless: 1, ledge: 1, h: [], on(f, n, i) { if (n === 8) lift(f, 1.9); if (n > 8 && n <= 44) { f.vy = 1.9; f.vx = i.lx * 1.0; } } },
      dspec: SWAP,
    }),
  }, {
    /* Hod: a stone-backed badger. Heavy, slow, hits hard. */
    name: 'Hod', col: ['#6d6a75', '#a39171', '#f1f1f1'], alt: ['#8a4f3d', '#3d5a6c', '#f1f1f1'],
    st: { weight: 120, walk: 0.9, dash: 1.6, run: 1.45, airSpeed: 0.95, airAcc: 0.06, grav: 0.11, fall: 1.85, ffall: 2.9, jump: 2.95, shop: 1.8, djump: 2.8, jsq: 3, trac: 0.14, w: 12, h: 13 },
    moves: mk(1.1, 1.3, 1.25, 0.9, {
      nspec: { t: 54, h: [], on(f, n) { if (n === 24) { shoot(f, { kind: 'boulder', oy: 6, vx: 1.5, vy: 0.6, grav: 0.09, r: 4.5, life: 110, ground: 'roll', h: { d: 12, a: 50, b: 40, k: 70 } }); beep(110, 0.15, 'square', 0.06, 0.7); } } },
      sspec: { t: 60, once: 1, nodrift: 1, armor: [10, 34], h: [{ f0: 16, f1: 34, x: 7, y: 6, r: 7, d: 14, a: 45, b: 50, k: 85 }], on(f, n) { if (n >= 16 && n <= 34) { f.vx = f.face * 2.0; if (!f.grounded) f.vy = 0; } if (n === 35) f.vx *= 0.3; } },
      uspec: { t: 44, helpless: 1, ledge: 1, h: [{ f0: 10, f1: 16, x: 0, y: 7, r: 8, d: 13, a: 80, b: 50, k: 85 }], on(f, n, i) { if (n === 10) { lift(f, 3.4); f.vx = i.lx * 0.7; } } },
      dspec: SWAP,
    }),
  }],
};
const ROSTER = [FLINT, WREN];

/* ---------- Fighter ---------- */
let F = [];
class Fighter {
  constructor(idx, def, ctl, alt) {
    this.idx = idx; this.def = def; this.ctl = ctl; this.alt = alt; this.fi = 0; this.stocks = STOCKS;
    this.pct = 0; this.kos = 0; this.spawn(true);
  }
  get form() { return this.def.forms[this.fi]; }
  get st() { return this.form.st; }
  spawn(first) {
    this.x = first ? (this.idx ? 32 : -32) : 0; this.y = first ? 0 : 82; this.vx = this.vy = 0;
    if (first) this.face = this.idx ? -1 : 1;
    this.grounded = !!first; this.plat = first ? MAIN : null; this.state = first ? 'idle' : 'respawn'; this.sf = 0;
    this.jumps = 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ff = false;
    this.pct = 0; this.shieldHp = 50; this.invuln = 0; this.hitlag = 0; this.hitstun = 0; this.ledgeCd = 0; this.dropT = 0; this.dropPlat = null;
    this.move = null; this.mf = 0; this.charge = 0; this.hitG = new Set(); this.parriedBy = null; this.victim = null; this.lag = 0; this.flash = 0;
    this.stale = []; this.staled = false; this.staleM = 1; this.shortHop = false; this.moveSH = false; this.shMacro = false; this.grabImm = 0; this.ledgeGrabs = 0;
    this.dodgeStale = 0; this.dodgeT = 0; this.ds = 0; this.tumble = false; this.techT = 0; this.techLock = 0; this.pumT = 0;
  }
  /* Dodges used back to back protect for less time and leave more lag. */
  dodge() { this.ds = this.dodgeStale; this.dodgeStale = Math.min(5, this.dodgeStale + 1); this.dodgeT = 0; }
  set(s) { this.state = s; this.sf = 0; }
  startMove(n) {
    const m = this.form.moves[n]; this.move = m; this.mname = n; this.mf = 0; this.charge = 0; this.hitG = new Set(); this.parriedBy = null; this.staled = false; this.moveSH = !!(m.air && this.shortHop); this.set('attack');
    if (m.once && !this.grounded) this.sideUsed = true;
  }
  endMove() {
    const m = this.move, i = this.ctl.c; this.move = null;
    if (this.grounded) { this.set('idle'); if (m.tilt && Math.abs(i.lx) > T.dash_stick_x) { this.face = sgn(i.lx); this.set('dash'); } }
    else this.set(m.helpless ? 'helpless' : 'air');
  }
  freeVictim() { const v = this.victim; if (v) { this.victim = null; if (v.state === 'held') { v.set('air'); v.vy = 1; v.vx = this.face * 0.8; v.grabImm = 60; } } }
  drop() { this.ctl.buf.shd = 0; this.dropPlat = this.plat; this.grounded = false; this.plat = null; this.dropT = 14; this.vy = -0.7; this.ff = false; this.set('air'); }
  doSpecial() {
    const i = this.ctl.c; let n = 'nspec';
    if (Math.abs(i.lx) > 0.5 && Math.abs(i.lx) >= Math.abs(i.ly)) { this.face = sgn(i.lx); n = (!this.grounded && this.sideUsed) ? 'nspec' : 'sspec'; }
    else if (i.ly > 0.5) n = 'uspec'; else if (i.ly < -0.5) n = 'dspec';
    this.startMove(n);
  }
  aerial(x, y) { if (Math.abs(y) > 0.5 && Math.abs(y) >= Math.abs(x)) return y > 0 ? 'uair' : 'dair'; if (Math.abs(x) > 0.3) return sgn(x) === this.face ? 'fair' : 'bair'; return 'nair'; }
  groundAttack(moving) {
    const c = this.ctl, i = c.c; let n;
    if (moving && this.state === 'dash' && this.sf <= 5 && c.xSmash && Math.abs(i.ly) < 0.5) n = 'fsmash';
    else if (moving && Math.abs(i.ly) < 0.5) n = 'dash';
    else if (i.ly > 0.5) n = c.ySmash ? 'usmash' : 'utilt';
    else if (i.ly < -0.5) n = c.ySmash ? 'dsmash' : 'dtilt';
    else if (Math.abs(i.lx) > 0.3) { this.face = sgn(i.lx); n = c.xSmash ? 'fsmash' : 'ftilt'; }
    else n = 'jab';
    this.startMove(n);
    if (n === 'dash') this.vx = this.face * this.st.run; else if (n === 'fsmash') this.vx *= 0.3;
  }
  groundActs(moving) {
    const c = this.ctl, i = c.c;
    if (c.take('grb') || (i.shd && c.take('atk'))) { this.startMove('grab'); return true; }
    if (c.take('spc')) { this.doSpecial(); return true; }
    /* Jump and attack pressed together: a short-hop aerial (the attack stays buffered for the jump). */
    if (c.buf.jmp > 0 && c.buf.atk > 0 && Math.abs(c.buf.jmp - c.buf.atk) <= 1) { c.buf.jmp = 0; this.set('jsq'); return true; }
    if (c.take('atk')) { this.groundAttack(moving); return true; }
    if (c.cPress) { if (Math.abs(i.cy) > Math.abs(i.cx)) this.startMove(i.cy > 0 ? 'usmash' : 'dsmash'); else { this.face = sgn(i.cx); this.startMove('fsmash'); } this.vx *= 0.3; return true; }
    if (c.take('jmp')) { this.set('jsq'); return true; }
    if (i.shd) { this.set('shield'); return true; }
    if (this.plat.soft && c.downBuf > 0) { c.downBuf = 0; this.drop(); return true; }
    if (c.dashDir) { this.face = c.dashDir; this.set('dash'); return true; }
    return false;
  }
  airActs() {
    const c = this.ctl, i = c.c, s = this.st;
    if (c.buf.shd > 0 && !this.airdodged) { c.buf.shd = 0; if (!this.tryWavedash(false)) this.airdodge(); return true; }
    if (c.take('spc')) { this.doSpecial(); return true; }
    if (c.take('atk')) { this.startMove(this.aerial(i.lx, i.ly)); return true; }
    if (c.cPress) { this.startMove(this.aerial(i.cx, i.cy)); return true; }
    if (c.buf.jmp > 0 && this.jumps > 0) { c.buf.jmp = 0; this.jumps--; this.shortHop = false; this.vy = s.djump; if (Math.abs(i.lx) > 0.2) this.vx = i.lx * s.airSpeed; this.ff = false; spark(this.x, this.y, '#fff', 6, 0.8); beep(500, 0.05, 'sine', 0.03, 1.4); }
    if (c.downNow && this.vy <= 0.3) this.ff = true;
    return false;
  }
  /* Wavedash: five fixed options picked by the stick, same slide for every fighter. */
  tryWavedash(fromGround) {
    const i = this.ctl.c, mag = Math.hypot(i.lx, i.ly); if (mag < T.wd_deadzone) return false;
    const ang = Math.atan2(-i.ly, Math.abs(i.lx)) * 180 / Math.PI;
    if (ang < -T.wd_long_angle) return false;
    if (!fromGround) {
      let best = null;
      for (const p of PLATS) { const d = this.y - p.y; if (this.x >= p.x0 && this.x <= p.x1 && d >= 0 && d <= T.wd_window_distance && (!best || d < this.y - best.y)) best = p; }
      if (!best) return false;
      this.touchDown(best);
    }
    const sp = ang <= T.wd_long_angle ? T.wd_long_speed : ang <= T.wd_down_angle ? T.wd_short_speed : 0;
    this.ctl.buf.shd = 0; this.vx = sgn(i.lx) * sp; this.vy = 0; this.move = null; this.set('wd'); spark(this.x, this.y, '#cfd8ff', 8, 0.9);
    return true;
  }
  airdodge() {
    const i = this.ctl.c, mag = Math.hypot(i.lx, i.ly); this.airdodged = true; this.ff = false; this.dodge();
    this.adDir = mag > 0.3; if (this.adDir) { this.vx = i.lx / mag * 2.7; this.vy = i.ly / mag * 2.7; }
    this.set('airdodge');
  }
  airPhys(drift) {
    const s = this.st, i = this.ctl.c;
    if (drift && Math.abs(i.lx) > 0.2) { const t = i.lx * s.airSpeed; if (Math.abs(this.vx) <= s.airSpeed || sgn(this.vx) !== sgn(i.lx)) this.vx = appr(this.vx, t, s.airAcc); else this.vx = appr(this.vx, t, 0.03); }
    else this.vx = appr(this.vx, 0, 0.02);
    this.vy -= s.grav; const mf = this.ff ? s.ffall : s.fall; if (this.vy < -mf) this.vy = -mf;
  }
  touchDown(p) { this.grounded = true; this.plat = p; this.y = p.y; this.vy = 0; this.jumps = 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ledgeGrabs = 0; this.ff = false; this.shortHop = false; }
  land(p) {
    const st = this.state, hard = this.ff; this.touchDown(p);
    if (st === 'attack') { const m = this.move; this.lag = m.air ? (this.mf < m.h[0].f0 - 1 || this.mf > m.ac ? (hard ? 4 : 2) : m.ll) : (m.ll || 8); this.move = null; this.set('land'); }
    else if (st === 'airdodge') { if (Math.abs(this.vx) > 0.5) { this.vx = clamp(this.vx, -T.wd_max_speed, T.wd_max_speed); this.set('wd'); } else { this.lag = 10; this.set('land'); } }
    else if (st === 'hurt') {
      /* Launched hard enough to tumble: shield just before touching down to tech (in place or rolling), else lie there. */
      if (this.tumble && this.sf < this.hitstun) {
        const lx = this.ctl.c.lx;
        if (this.techT > 0) {
          this.techT = 0; this.invuln = 20; spark(this.x, this.y, '#9ff', 10, 1.2); beep(900, 0.05, 'triangle', 0.04);
          if (Math.abs(lx) > 0.5) { this.rollDir = sgn(lx); this.ds = 0; this.set('roll'); } else { this.vx = 0; this.lag = 26; this.set('land'); }
        } else { this.vx *= 0.5; spark(this.x, this.y, '#ddd', 8, 1.2); beep(130, 0.08, 'square', 0.05); this.set('down'); }
      } else { this.lag = 4; this.set('land'); }
    }
    else if (st === 'helpless') { this.lag = 12; this.set('land'); }
    else if (st === 'broken') { /* stays dizzy */ }
    else { this.lag = hard ? 4 : 2; this.set('land'); }
  }
  canFall() {
    const s = this.state;
    if (s === 'shield' || s === 'shieldstun' || s === 'shieldoff' || s === 'hold' || s === 'throw' || s === 'roll' || s === 'spot' || s === 'broken' || s === 'jsq' || s === 'down') return false;
    if (this.plat.soft) return true;
    return s === 'idle' ? Math.abs(this.ctl.c.lx) > 0.2 : (s === 'dash' || s === 'run' || s === 'brake' || s === 'hurt' || s === 'wd');
  }
  breakShield() { this.shieldHp = 30; this.grounded = false; this.plat = null; this.vy = 3.2; this.vx = 0; this.set('broken'); spark(this.x, this.y + 8, '#9cf', 30, 2.4); beep(200, 0.4, 'sawtooth', 0.08, 0.3); shake = 10; }
  launch(kb, ang, dir, lsi) {
    this.freeVictim(); const sp = kb * 0.03 * (lsi || 1); this.tumble = kb >= TUMBLE_KB; this.ledgeGrabs = 0; this.shortHop = false; this.vx = Math.cos(ang) * sp * dir; this.vy = Math.sin(ang) * sp;
    this.hitstun = Math.floor(kb * 0.4); this.move = null; this.ff = false;
    if (this.grounded) { if (this.vy < 0) this.vy = -this.vy * 0.8; if (kb < 30 || this.vy < 0.05) this.vy = 0; else { this.grounded = false; this.plat = null; } }
    this.set('hurt');
  }
  ko() {
    const top = this.y > BLAST.t - 5;
    spark(clamp(this.x, BLAST.l + 20, BLAST.r - 20), clamp(this.y, BLAST.b + 20, BLAST.t - 20), this.idx ? '#6cb4ff' : '#ff7b6c', 60, top ? 4 : 5);
    beep(90, 0.6, 'sawtooth', 0.1, 0.3); shake = 16; rumble(this.ctl, 400, 1); this.stale = [];
    const o = F[1 - this.idx]; if (o.victim === this) o.victim = null; this.freeVictim();
    this.stocks--; F[1 - this.idx].kos++; this.move = null; this.vx = this.vy = 0; this.grounded = false; this.plat = null; this.set('dead'); PROJ = PROJ.filter(p => p.owner !== this.idx);
  }
  update() {
    const c = this.ctl, i = c.c;
    if (this.invuln > 0) this.invuln--; if (this.ledgeCd > 0) this.ledgeCd--; if (this.dropT > 0) this.dropT--; if (this.flash > 0) this.flash--;
    if (this.grabImm > 0) this.grabImm--; if (this.techT > 0) this.techT--; if (this.techLock > 0) this.techLock--;
    if (c.pressed('shd')) { if (this.techLock === 0) this.techT = 20; this.techLock = 40; }
    if (this.dodgeStale > 0 && ++this.dodgeT >= 90) { this.dodgeStale--; this.dodgeT = 0; }
    if (this.state !== 'shield' && this.state !== 'shieldstun' && this.shieldHp < SHIELD.hp) this.shieldHp = Math.min(SHIELD.hp, this.shieldHp + SHIELD.regen);
    if (this.hitlag > 0) { this.hitlag--; return; }
    this.sf++; const s = this.st;
    switch (this.state) {
      case 'idle':
        if (this.groundActs(false)) break;
        if (Math.abs(i.lx) > 0.2) { this.face = sgn(i.lx); this.vx = appr(this.vx, i.lx * s.walk, 0.2); } else this.vx = appr(this.vx, 0, s.trac);
        break;
      case 'dash':
        this.vx = this.face * s.dash; if (this.groundActs(true)) break;
        if (this.sf >= 14) this.set(sgn(i.lx) === this.face && Math.abs(i.lx) > 0.6 ? 'run' : 'idle');
        break;
      case 'run':
        this.vx = appr(this.vx, this.face * s.run, 0.2); if (this.groundActs(true)) break;
        if (!(sgn(i.lx) === this.face && Math.abs(i.lx) > 0.5)) this.set('brake');
        break;
      case 'brake':   /* skidding to a stop out of a run; a back flick here is a dash back */
        this.vx = appr(this.vx, 0, s.trac * 0.8); if (this.groundActs(false)) break;
        if (this.sf >= 12 || this.vx === 0) this.set('idle');
        break;
      case 'jsq':
        this.vx = appr(this.vx, 0, s.trac * 0.5);
        if (this.sf === 1) this.shMacro = false;
        if (c.shdAge <= this.sf + T.wd_jumpsquat_buffer && this.tryWavedash(true)) break;
        /* Out of a jump's start-up: an up smash, or attack with the jump for a short-hop aerial. */
        if (c.cPress && i.cy > 0.5) { this.startMove('usmash'); break; }
        if (c.buf.atk > 0) { if (i.ly > 0.5 && c.ySmash) { c.buf.atk = 0; this.startMove('usmash'); break; } this.shMacro = true; }
        if (this.sf >= s.jsq) { this.grounded = false; this.plat = null; this.shortHop = !i.jmp || this.shMacro; this.vy = this.shortHop ? s.shop : s.jump; if (Math.abs(i.lx) > 0.2) this.vx = clamp(this.vx + i.lx * 0.4, -s.airSpeed * 1.4, s.airSpeed * 1.4); else this.vx = clamp(this.vx, -s.airSpeed, s.airSpeed); this.set('air'); beep(420, 0.05, 'sine', 0.03, 1.5); if (this.shMacro) { this.shMacro = false; if (c.take('atk')) this.startMove(this.aerial(i.lx, i.ly)); } }
        break;
      case 'wd':
        this.vx = appr(this.vx, 0, T.wd_friction);
        if (this.plat.soft && c.downBuf > 0) { c.downBuf = 0; this.drop(); break; }
        if (this.sf >= T.wd_actionable_frame) { if (this.groundActs(false)) break; if (this.vx === 0 || this.sf >= T.wd_max_frames) this.set('idle'); }
        break;
      case 'air': this.airPhys(true); this.airActs(); break;
      case 'helpless': this.airPhys(true); break;
      case 'airdodge':
        if (this.adDir && this.sf < 18) { this.vx *= 0.9; this.vy *= 0.9; } else this.airPhys(!this.adDir);
        if (this.sf === 3) this.invuln = Math.max(this.invuln, 24 - this.ds * 2 - (this.adDir ? 6 : 0));
        if (this.sf >= (this.adDir ? 54 : 40) + this.ds * 3) this.set('air');
        break;
      case 'land':
        this.vx = appr(this.vx, 0, s.trac);
        if (this.sf >= this.lag) { this.set('idle'); this.groundActs(false); }
        break;
      case 'attack': {
        const m = this.move;
        if (this.grounded) this.vx = appr(this.vx, 0, s.trac); else this.airPhys(!m.nodrift);
        if (m.chg && this.mf === m.chg && this.charge < 60 && (i.atk || Math.hypot(i.cx, i.cy) > 0.5)) this.charge++; else this.mf++;
        if (m.on) m.on(this, this.mf, i);
        if (this.state === 'attack' && this.mf >= m.t) this.endMove();
        break;
      }
      case 'shield':
        this.vx = appr(this.vx, 0, s.trac * 1.5); this.shieldHp -= SHIELD.drain; if (this.shieldHp <= 0) { this.breakShield(); break; }
        if (c.buf.spc > 0 && i.ly > 0.5) { c.buf.spc = 0; this.startMove('uspec'); break; }   /* up special straight out of shield */
        if (c.cPress && i.cy > 0.5) { this.startMove('usmash'); break; }
        if (c.take('jmp')) { this.set('jsq'); break; }
        if (c.take('atk') || c.take('grb')) { this.startMove('grab'); break; }
        if (c.downBuf > 0) { c.downBuf = 0; if (this.plat.soft) this.drop(); else { this.dodge(); this.set('spot'); } break; }
        if (c.dashDir && this.sf > 1) { this.rollDir = c.dashDir; this.dodge(); this.set('roll'); break; }
        if (!i.shd && this.sf >= 3) this.set('shieldoff');
        break;
      case 'shieldstun':
        this.vx = appr(this.vx, 0, 0.08);
        if (this.sf >= this.stunT) { if (this.plat.soft && i.ly < T.shield_drop_stick_y) this.drop(); else this.set(i.shd ? 'shield' : 'shieldoff'); }
        break;
      case 'shieldoff': this.vx = appr(this.vx, 0, s.trac); if (this.sf >= SHIELD.release) this.set('idle'); break;
      case 'spot': this.vx = 0; if (this.sf === 3) this.invuln = Math.max(this.invuln, 15 - this.ds * 2); if (this.sf >= 22 + this.ds * 3) this.set('idle'); break;
      case 'roll':
        this.vx = this.sf >= 3 && this.sf <= 22 ? this.rollDir * 1.35 : 0; if (this.sf === 4) this.invuln = Math.max(this.invuln, 13 - this.ds * 2);
        if (this.sf >= 28 + this.ds * 3) { this.face = -this.rollDir; this.vx = 0; this.set('idle'); }
        break;
      case 'hurt':
        if (this.grounded) { this.vx = appr(this.vx, 0, 0.06); if (this.sf >= this.hitstun) this.set('idle'); }
        else {
          /* Long hitstun can be cut short: an air dodge from frame 40, an attack or jump from frame 45. */
          if (this.sf >= 45 && (c.buf.atk > 0 || c.cPress || c.buf.spc > 0 || (c.buf.jmp > 0 && this.jumps > 0))) { this.set('air'); this.airActs(); break; }
          if (this.sf >= 40 && c.buf.shd > 0 && !this.airdodged) { c.buf.shd = 0; this.airdodge(); break; }
          const sp = Math.hypot(this.vx, this.vy); if (sp > 0.051) { const k = (sp - 0.051) / sp; this.vx *= k; this.vy *= k; }
          this.vy -= s.grav; if (this.sf % 3 === 0 && sp > 2) PART.push({ x: this.x, y: this.y + s.h / 2, vx: 0, vy: 0, life: 16, col: 'rgba(255,255,255,.7)', r: 1.6 });
          if (this.sf >= this.hitstun) this.set('air');
        }
        break;
      case 'down':   /* missed tech: lying on the floor */
        this.vx = appr(this.vx, 0, 0.1);
        if (this.sf >= 20) {
          if (c.take('atk')) { this.startMove('getup'); break; }
          if (Math.abs(i.lx) > 0.5) { this.rollDir = sgn(i.lx); this.ds = 0; this.invuln = 14; this.set('roll'); break; }
          if (i.ly > 0.5 || c.take('jmp') || i.shd || this.sf >= 100) { this.lag = 22; this.invuln = 16; this.set('land'); }
        }
        break;
      case 'held': {   /* mashing buttons breaks a grab sooner */
        const h = F[1 - this.idx];
        if (h.victim !== this) { this.set('air'); break; }
        let n = c.dashDir || c.upNow || c.downNow ? 1 : 0; for (const k of ['atk', 'spc', 'jmp', 'shd', 'grb']) if (c.pressed(k)) n++;
        h.holdT -= n * 8;
        break;
      }
      case 'broken':
        if (this.grounded) { this.vx = 0; if (this.sf >= 220) this.set('idle'); } else { this.vy -= s.grav; if (this.vy < -s.fall) this.vy = -s.fall; }
        break;
      case 'hold': {
        this.vx = 0; const v = this.victim; if (!v || v.state !== 'held') { this.victim = null; this.set('idle'); break; }
        v.x = this.x + this.face * 8; v.y = this.y; v.vx = v.vy = 0; v.face = -this.face;
        if (this.sf > 8) {
          if (this.pumT > 0) this.pumT--;
          if (this.pumT === 0 && c.take('atk')) { this.pumT = 14; v.pct += 1.3 * DMG_1V1; v.flash = 5; spark(v.x, v.y + 8, '#fff', 4, 0.8); beep(260, 0.04, 'square', 0.04); }
          let k = null; if (c.dashDir) k = c.dashDir === this.face ? 'f' : 'b'; else if (c.upNow) k = 'u'; else if (c.downNow) k = 'd';
          if (k) { this.throwK = k; this.set('throw'); }
          else if (this.sf > this.holdT) { this.freeVictim(); this.lag = 30; this.set('land'); }
        }
        break;
      }
      case 'throw': {
        const v = this.victim;
        if (v && v.state === 'held') { v.x = this.x + this.face * (this.throwK === 'b' ? -6 : 8) * Math.min(1, this.sf / 8); v.y = this.y + (this.throwK === 'u' ? this.sf : 0); }
        if (this.sf === 10 && v) {
          const h = this.form.moves.throws[this.throwK], id = this.form.name + ':throw' + this.throwK, d = h.d * staleMul(this, id) * DMG_1V1; pushStale(this, id);
          this.victim = null; v.grounded = false; v.plat = null; v.pct = Math.min(999, v.pct + d); v.grabImm = 60;
          v.launch(knock(v, d, h.b, h.k) * rage(this), h.a * Math.PI / 180, this.face); v.hitlag = 6; this.hitlag = 6; spark(v.x, v.y + 8, '#fff', 12, 1.6); beep(180, 0.1, 'square', 0.06, 0.6);
        }
        if (this.sf >= 26) this.set('idle');
        break;
      }
      case 'ledge': {
        const side = sgn(this.x); this.vx = this.vy = 0;
        if (this.sf > 8) {
          const toward = -side * i.lx;
          if (c.take('jmp')) { this.vy = s.jump * 1.05; this.vx = -side * 0.7; this.ledgeCd = 30; this.set('air'); }
          else if (i.shd) { this.x = side * 58; this.touchDown(MAIN); this.ledgeUsed = true; this.lag = 18; this.invuln = 18; this.set('land'); }
          else if (c.take('atk')) { this.x = side * 74; this.touchDown(MAIN); this.ledgeUsed = true; this.startMove('getup'); }
          else if (toward > 0.5 || i.ly > 0.5) { this.x = side * 75; this.touchDown(MAIN); this.ledgeUsed = true; this.lag = 14; this.invuln = 14; this.set('land'); }
          else if (toward < -0.5 || i.ly < -0.5 || this.sf > 240) { this.ledgeCd = 30; this.vy = -0.5; this.x += side * 2; this.set('air'); }
        }
        break;
      }
      case 'respawn':
        this.x = 0; this.y = 82 - Math.min(14, this.sf * 0.5); this.invuln = 2;
        if (this.sf > 150 || (this.sf > 25 && (Math.abs(i.lx) > 0.4 || Math.abs(i.ly) > 0.4 || i.atk || i.spc || i.jmp || i.shd))) { this.invuln = 110; this.set('air'); }
        break;
      case 'dead':
        if (this.stocks > 0 && this.sf >= 50) { const fi = this.fi; this.spawn(false); this.fi = fi; }
        break;
    }
    this.integrate();
  }
  integrate() {
    const st = this.state, s = this.st, i = this.ctl.c;
    if (st === 'held' || st === 'ledge' || st === 'respawn' || st === 'dead') return;
    if (this.grounded) {
      const p = this.plat; this.x += this.vx; this.y = p.y;
      if (this.x < p.x0 || this.x > p.x1) {
        if (this.canFall()) { this.grounded = false; this.plat = null; this.vy = 0; if (st !== 'attack' && st !== 'hurt') this.set('air'); }
        else { this.x = clamp(this.x, p.x0, p.x1); this.vx = 0; }
      }
      return;
    }
    const py = this.y, px = this.x; this.x += this.vx; this.y += this.vy;
    if (this.vy <= 0) {
      const pass = i.ly < T.air_pass_stick_y && Math.abs(i.lx) < T.air_pass_max_x && (st === 'air' || st === 'attack' || st === 'helpless');
      for (const p of PLATS) {
        if (py >= p.y && this.y <= p.y && this.x >= p.x0 && this.x <= p.x1) {
          if (p.soft && (pass || (this.dropT > 0 && p === this.dropPlat))) continue;
          this.land(p); return;
        }
      }
    }
    /* Solid underside and walls of the main stage. */
    const hw = s.w / 2;
    if (this.x + hw > MAIN.x0 && this.x - hw < MAIN.x1 && this.y < 0 && this.y + s.h > -BODY_H) {
      if (py + s.h <= -BODY_H + 0.01) { this.y = -BODY_H - s.h; if (this.vy > 0) this.vy = st === 'hurt' ? -this.vy * 0.6 : 0; }
      else { const side = px < 0 ? -1 : 1; this.x = side * (80 + hw); this.vx = st === 'hurt' ? -this.vx * 0.7 : 0; }
    }
    /* Ledges. */
    if (this.vy < 0 && this.ledgeCd === 0 && i.ly > -0.5 && (st === 'air' || st === 'helpless' || (st === 'attack' && this.move && this.move.ledge))) {
      const side = sgn(this.x), out = Math.abs(this.x) - 80, hand = this.y + s.h, o = F[1 - this.idx];
      if (side && out > -1 && out < 13 && hand > -9 && hand < 9 && this.ledgeGrabs < 6) {
        if (o && o.state === 'ledge' && sgn(o.x) === side) { o.set('air'); o.vy = 1.3; o.vx = side * 0.9; o.ledgeCd = 45; o.invuln = 0; pop(o.x, o.y + 20, 'TRUMP', '#fff'); }
        this.ledgeGrabs++; this.shortHop = false;
        this.x = side * (80 + hw + 0.5); this.y = -s.h + 1; this.vx = this.vy = 0; this.face = -side; this.move = null; this.ff = false;
        this.jumps = 1; this.airdodged = false; this.sideUsed = false; if (!this.ledgeUsed) { this.invuln = Math.max(20, 44 - this.pct * 0.15) | 0; this.ledgeUsed = true; }
        this.set('ledge'); beep(700, 0.04, 'triangle', 0.03);
      }
    }
  }
}

/* ---------- Combat ---------- */
function knock(v, d, b, k) { const p = v.pct; return ((((p / 10 + p * d / 20) * 200 / (v.st.weight + 100) * 1.4) + 18) * k / 100) + b; }
function circRect(cx, cy, r, x0, y0, x1, y1) { const dx = cx - clamp(cx, x0, x1), dy = cy - clamp(cy, y0, y1); return dx * dx + dy * dy <= r * r; }
function canBeHit(v) { return v.invuln === 0 && v.state !== 'dead' && v.state !== 'respawn' && v.state !== 'held'; }
function applyHit(a, v, h, face, srcX, proj) {
  const hx = v.x, hy = v.y + v.st.h / 2;
  if (h.grab) {
    if (v.state === 'held' || v.state === 'hold' || a.state !== 'attack' || !a.grounded) return;   /* a grab that traded with a hit loses */
    v.freeVictim(); a.move = null; a.set('hold'); a.victim = v; a.holdT = Math.min(300, 90 + v.pct * 1.7); a.pumT = 0; v.move = null; v.grounded = false; v.plat = null; v.set('held'); beep(330, 0.06, 'triangle', 0.05); return;
  }
  if (!proj && a.parriedBy === v) return;
  const id = h.id || (a.form.name + ':' + a.mname); let d = h.d * DMG_1V1;
  if (proj) { d *= staleMul(a, id); pushStale(a, id); }
  else { if (!a.staled) { a.staleM = staleMul(a, id); pushStale(a, id); a.staled = true; } d *= a.staleM * (1 + a.charge / 60 * 0.4) * (a.moveSH ? SHORT_HOP_MUL : 1); }
  if (v.state === 'shieldoff' && v.sf <= SHIELD.parry) {
    v.set('idle'); v.invuln = 4; if (!proj) { a.hitlag = 16; a.parriedBy = v; }
    spark(hx, hy, '#fff', 20, 2); pop(hx, hy + 12, 'PARRY', '#fff'); beep(1200, 0.12, 'triangle', 0.07, 1.3); return;
  }
  if (v.state === 'shield' || v.state === 'shieldstun') {
    v.shieldHp -= d * SHIELD.dmg;
    const sm = proj ? SHIELD.stun.proj : a.move && a.move.air ? SHIELD.stun.air : a.move && a.move.chg ? SHIELD.stun.smash : SHIELD.stun.ground;
    if (v.shieldHp <= 0) v.breakShield(); else { v.stunT = Math.floor(d * sm) + 2; v.set('shieldstun'); v.vx = (sgn(v.x - srcX) || face) * (0.3 + d * 0.04); }
    const hl = Math.min(20, Math.floor((d * 0.65 + 6) * 0.67)); v.hitlag = hl; if (!proj) a.hitlag = hl;
    spark(hx, hy, '#9cf', 6, 1); beep(400, 0.05, 'triangle', 0.04); return;
  }
  v.pct = Math.min(999, v.pct + d); v.flash = 6;
  const crouch = v.grounded && v.state === 'idle' && v.ctl.c.ly < -0.6, charging = v.state === 'attack' && v.charge > 0;
  const kb = knock(v, d, h.b, h.k) * rage(a) * (crouch ? CROUCH_MUL : 1) * (charging ? CHARGING_MUL : 1);
  const hl = Math.min(30, Math.floor((d * 0.65 + 6) * (crouch ? 0.67 : 1)));
  if (v.state === 'attack' && v.move && v.move.armor && v.mf >= v.move.armor[0] && v.mf <= v.move.armor[1] && kb < 95) { v.hitlag = hl; if (!proj) a.hitlag = hl; spark(hx, hy, '#ccc', 8, 1); beep(150, 0.06, 'square', 0.05); return; }
  /* 361 is the "natural" angle: flat along the ground for weak hits, steeper as the hit gets stronger, 45 in the air. */
  const deg = h.a !== 361 ? h.a : !v.grounded ? 45 : kb < 60 ? 0 : kb >= 88 ? 38 : (kb - 60) / 28 * 38;
  let ang = deg * Math.PI / 180;
  const dir = h.away ? (sgn(v.x - srcX) || face) : face;
  /* Directional influence: the stick bends the launch up to about 10 degrees. */
  const i = v.ctl.c, lx = Math.cos(ang) * dir, ly = Math.sin(ang), perp = i.lx * -ly + i.ly * lx;
  ang += perp * 0.17 * (dir > 0 ? 1 : -1);
  /* Holding up or down stretches or shortens the launch, except for near-vertical ones. */
  const nd = ((ang * 180 / Math.PI) % 360 + 360) % 360, vertical = (nd > 65 && nd < 115) || (nd > 245 && nd < 295);
  const lsi = vertical ? 1 : i.ly > 0.5 ? 1.095 : i.ly < -0.5 ? 0.92 : 1;
  v.launch(kb, ang, dir, lsi); v.hitlag = hl; if (!proj) a.hitlag = hl; rumble(v.ctl, 60 + kb, Math.min(1, 0.25 + kb / 150)); rumble(a.ctl, 50, 0.25);
  spark(hx, hy, kb > 110 ? '#ffd166' : '#fff', Math.min(40, 6 + kb / 6 | 0), 1 + kb / 80);
  if (kb > 110) shake = Math.max(shake, 8);
  beep(kb > 110 ? 120 : 220, 0.1 + Math.min(0.2, kb / 800), 'square', 0.07, 0.5);
}
function resolveHits() {
  const ev = [];
  for (const a of F) {
    const v = F[1 - a.idx];
    if (a.state === 'attack' && a.move && canBeHit(v)) {
      for (const h of a.move.h) {
        if (a.mf < h.f0 || a.mf > h.f1) continue; const gid = h.g || 0; if (a.hitG.has(gid)) continue;
        if (h.grab && (!a.grounded || v.grabImm > 0)) continue;
        if (circRect(a.x + h.x * a.face, a.y + h.y, h.r, v.x - v.st.w / 2, v.y, v.x + v.st.w / 2, v.y + v.st.h)) { ev.push([a, v, h, a.face, a.x, false]); a.hitG.add(gid); break; }
      }
    }
  }
  for (const p of PROJ) {
    const v = F[1 - p.owner];
    if (p.life > 0 && canBeHit(v) && circRect(p.x, p.y, p.r, v.x - v.st.w / 2, v.y, v.x + v.st.w / 2, v.y + v.st.h)) { ev.push([F[p.owner], v, p.h, p.face, p.x, true]); p.life = 0; }
  }
  for (const e of ev) applyHit(...e);
}
function updateProj() {
  for (const p of PROJ) {
    p.life--; const py = p.y - p.r;
    if (p.plat) { p.x += p.vx; p.rot = (p.rot || 0) + p.vx * 0.2; if (p.x < p.plat.x0 || p.x > p.plat.x1) p.plat = null; continue; }
    p.vy -= p.grav; p.x += p.vx; p.y += p.vy;
    if (p.grav && p.vy <= 0) {
      for (const q of PLATS) {
        if (py >= q.y && p.y - p.r <= q.y && p.x >= q.x0 && p.x <= q.x1) {
          if (p.ground === 'stick') { p.kind = 'flame'; p.vx = p.vy = 0; p.grav = 0; p.y = q.y + 2.5; p.life = 85; p.h = { d: 3, a: 80, b: 35, k: 20 }; }
          else if (p.ground === 'roll') { p.plat = q; p.y = q.y + p.r; p.vy = 0; }
          else p.life = 0;
          break;
        }
      }
    }
    if (p.x + p.r > MAIN.x0 && p.x - p.r < MAIN.x1 && p.y < -1 && p.y > -BODY_H) p.life = 0;
  }
  PROJ = PROJ.filter(p => p.life > 0 && p.y > BLAST.b && Math.abs(p.x) < BLAST.r);
}

/* ---------- CPU opponent ---------- */
function cpuInput(f, o, m) {
  const i = blankIn(); m.t = (m.t || 0) + 1; if (m.cd > 0) m.cd--; else m.cd = 0;
  const dx = o.x - f.x, dy = o.y - f.y, ad = Math.abs(dx), dir = sgn(dx) || 1;
  if (f.state === 'respawn') { if (f.sf > 45) i.lx = dir; return i; }
  if (f.state === 'held') { i.atk = m.t % 2 === 0; i.jmp = m.t % 2 === 1; return i; }
  if (f.state === 'down') { if (f.sf > 24) { const r = m.t % 3; if (r === 0) i.ly = 1; else if (r === 1) i.lx = -dir; else i.atk = true; } return i; }
  if (f.state === 'ledge') { if (f.sf > 20) { if (m.t % 2) i.lx = -sgn(f.x); else i.jmp = true; } return i; }
  if (f.state === 'hold') { if (f.sf > 16) { const r = m.t % 4; if (r === 0) i.lx = f.face; else if (r === 1) i.lx = -f.face; else if (r === 2) i.ly = 1; else i.ly = -1; } return i; }
  if (!f.grounded && (Math.abs(f.x) > 84 || f.y < -3)) {
    i.lx = -sgn(f.x);
    if (f.vy < 0 && f.state === 'air' && m.t % 6 === 0) { if (f.jumps > 0 && f.y < 12) i.jmp = true; else if (f.jumps === 0 && f.y < -6) { i.lx = 0; i.ly = 1; i.spc = true; } }
    return i;
  }
  if (o.state === 'dead' || o.state === 'respawn') { if (Math.abs(f.x) > 20) i.lx = -sgn(f.x) * 0.5; return i; }
  if (f.grounded && o.state === 'attack' && ad < 24 && Math.abs(dy) < 20) { if (m.def == null) m.def = Math.random() < 0.45; if (m.def) { i.shd = true; return i; } } else m.def = null;
  if (f.grounded) {
    if (dy > 16 && ad < 34) { if (m.cd === 0) { i.jmp = true; m.cd = 22; } i.lx = ad > 6 ? dir : 0; return i; }
    if (dy < -10 && f.plat && f.plat.soft) { if (m.t % 12 < 6) i.ly = -1; return i; }
    if (m.cd === 0 && f.form.aiShot && ad > 40 && ad < 110 && Math.abs(dy) < 10 && f.face === dir && Math.random() < 0.04) { i.spc = true; m.cd = 50; return i; }
    if (ad > 14) { i.lx = dir; return i; }
    if (f.face !== dir) { i.lx = dir * 0.5; return i; }
    if (m.cd === 0) {
      const r = Math.random(); m.cd = 22 + (Math.random() * 30 | 0);
      if (dy > 8) { if (r < 0.5) { i.ly = 1; i.atk = true; } else i.cy = 1; }
      else if (r < 0.25) i.atk = true; else if (r < 0.45) { i.lx = dir * 0.5; i.atk = true; } else if (r < 0.6) i.cx = dir;
      else if (r < 0.72) i.grb = true; else if (r < 0.84) i.spc = true; else if (r < 0.92) { i.ly = -0.9; i.atk = true; } else i.jmp = true;
    }
    return i;
  }
  i.lx = ad > 6 ? dir : 0;
  if (m.cd === 0 && ad < 16 && Math.abs(dy) < 16 && f.state === 'air') { m.cd = 30; if (dy > 6) i.cy = 1; else if (dy < -6) i.cy = -1; else i.cx = dir; }
  if (dy > 20 && f.jumps > 0 && f.vy < 0 && m.t % 20 === 0) i.jmp = true;
  return i;
}

/* ---------- Game flow ---------- */
let sudden = false;
let mode = 'select', frame = 0, timer = MATCH_FRAMES, countdown = 0, paused = false, overT = 0, result = '';
let slots = [null, null], DEVS = {};
const cam = { x: 0, y: 30, s: 3.4 };
function devCtl(dev) { return DEVS[dev] || (DEVS[dev] = new Ctl(dev)); }
function allDevs() { const d = ['kb']; const gp = navigator.getGamepads ? navigator.getGamepads() : []; for (let n = 0; n < gp.length && n < 4; n++) if (gp[n]) d.push('pad' + n); return d; }
function startMatch() {
  const s0 = slots[0], s1 = slots[1] || { dev: 'cpu', pick: Math.random() * ROSTER.length | 0 };
  const c0 = devCtl(s0.dev), c1 = s1.dev === 'cpu' ? new Ctl('cpu') : devCtl(s1.dev);
  F = [new Fighter(0, ROSTER[s0.pick], c0, false), new Fighter(1, ROSTER[s1.pick], c1, s1.pick === s0.pick)];
  PROJ = []; PART = []; POPS = []; timer = MATCH_FRAMES; sudden = false; countdown = 190; paused = false; mode = 'countdown'; cam.x = 0; cam.y = 30; cam.s = 3.4;
}
function stepSelect() {
  for (const dev of allDevs()) {
    const c = devCtl(dev); c.poll(readDev(dev));
    let sl = slots.find(s => s && s.dev === dev);
    if (!sl) { if (c.pressed('atk') || c.pressed('start')) { const k = slots[0] ? (slots[1] ? -1 : 1) : 0; if (k >= 0) { slots[k] = { dev, pick: k, ready: false }; beep(600, 0.06, 'triangle', 0.05); } } continue; }
    if (!sl.ready) {
      if (c.dashDir) { sl.pick = (sl.pick + c.dashDir + ROSTER.length) % ROSTER.length; beep(440, 0.04, 'square', 0.03); }
      if (c.pressed('atk')) { sl.ready = true; beep(800, 0.08, 'triangle', 0.05); }
      else if (c.pressed('spc')) { slots[slots.indexOf(sl)] = null; if (!slots[0] && slots[1]) { slots[0] = slots[1]; slots[1] = null; } }
    } else if (c.pressed('spc')) sl.ready = false;
    else if (c.pressed('start') || c.pressed('atk')) { if (slots[0] && slots[0].ready && (!slots[1] || slots[1].ready)) { startMatch(); return; } }
  }
}
function pollMatch() {
  for (const f of F) f.ctl.poll(f.ctl.dev === 'cpu' ? (mode === 'play' ? cpuInput(f, F[1 - f.idx], f.ctl.ai) : blankIn()) : readDev(f.ctl.dev));
}
function finish(text) { result = text; mode = 'over'; overT = 0; beep(300, 0.5, 'triangle', 0.08, 2); }
function stepPlay() {
  if (F.some(f => f.ctl.dev !== 'cpu' && f.ctl.pressed('start'))) { paused = !paused; return; }
  if (paused) return;
  frame++;
  for (const f of F) f.update();
  updateProj(); resolveHits();
  for (const f of F) if (f.state !== 'dead' && f.state !== 'respawn' && (f.x < BLAST.l || f.x > BLAST.r || f.y > BLAST.t || f.y < BLAST.b)) f.ko();
  timer--;
  const out = F.filter(f => f.stocks <= 0);
  if (out.length === 2) finish('DRAW');
  else if (out.length === 1) finish((F[1 - out[0].idx].def.name + ' WINS').toUpperCase());
  else if (timer <= 0) {
    const [a, b] = F; let w = a.stocks !== b.stocks ? (a.stocks > b.stocks ? a : b) : Math.round(a.pct) !== Math.round(b.pct) ? (a.pct < b.pct ? a : b) : null;
    if (w) finish((w.def.name + ' WINS').toUpperCase());
    else { sudden = true; timer = 1e9; for (const f of F) { f.pct = 300; f.stocks = 1; } pop(0, 60, 'SUDDEN DEATH', '#ff8a7a'); beep(200, 0.6, 'sawtooth', 0.08, 2); }
  }
}
function stepFx() {
  for (const p of PART) { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life--; }
  PART = PART.filter(p => p.life > 0); for (const p of POPS) { p.y += 0.25; p.life--; } POPS = POPS.filter(p => p.life > 0);
  if (shake > 0) shake--;
  if (!F.length) return;
  const live = F.filter(f => f.state !== 'dead');
  let x0 = -30, x1 = 30, y0 = 0, y1 = 40;
  for (const f of live) { x0 = Math.min(x0, clamp(f.x, -210, 210) - 30); x1 = Math.max(x1, clamp(f.x, -210, 210) + 30); y0 = Math.min(y0, clamp(f.y, -110, 170) - 14); y1 = Math.max(y1, clamp(f.y, -110, 170) + 34); }
  const s = clamp(Math.min(W / (x1 - x0), (H - 110) / (y1 - y0)), 2.2, 4.4);
  cam.x += ((x0 + x1) / 2 - cam.x) * 0.08; cam.y += ((y0 + y1) / 2 - cam.y) * 0.08; cam.s += (s - cam.s) * 0.06;
}
function step() {
  if (mode === 'select') { stepSelect(); return; }
  pollMatch();
  if (mode === 'countdown') { countdown--; if (countdown === 130 || countdown === 90 || countdown === 50) beep(440, 0.1, 'square', 0.05); if (countdown === 10) beep(880, 0.3, 'square', 0.06); if (countdown <= 10) mode = 'play'; }
  else if (mode === 'play') stepPlay();
  else if (mode === 'over') { overT++; if (overT < 90) { for (const f of F) { if (overT % 3 === 0) f.update(); } } if (overT > 100 && F.some(f => f.ctl.dev !== 'cpu' && (f.ctl.pressed('start') || f.ctl.pressed('atk')))) { mode = 'select'; for (const s of slots) if (s) s.ready = false; F = []; } }
  stepFx();
}

/* ---------- Drawing ---------- */
const SX = x => W / 2 + (x - cam.x) * cam.s, SY = y => H * 0.52 - (y - cam.y) * cam.s;
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/* The canvas is drawn at the screen's real pixel size; everything is laid out in 1280x720 units and scaled. */
let RS = 1;
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), w = Math.round((cv.clientWidth || W) * dpr), h = Math.round((cv.clientHeight || H) * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  RS = w / W;
}
const OL = '#17121f';
function tint(hex, k) { const n = parseInt(hex.slice(1), 16), f = v => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
function vgrad(hex, y0, y1) { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, tint(hex, -0.3)); q.addColorStop(1, tint(hex, 0.22)); return q; }
function ink(fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw || 0.42; g.strokeStyle = OL; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
function limb(x0, y0, x1, y1, w, col) { g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = OL; g.lineWidth = w + 0.8; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
const gait = f => f && f.grounded && Math.abs(f.vx) > 0.3 ? Math.sin(f.x * 0.55) : 0;
const swing = f => f && f.state === 'attack' && f.move && !f.move.swap ? Math.sin(Math.min(1, f.mf / f.move.t) * Math.PI) : 0;

function drawBg() {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1230'); gr.addColorStop(0.4, '#2c2356'); gr.addColorStop(0.72, '#8a4a6e'); gr.addColorStop(1, '#f0a063'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    const x = ((k * 197.3 - cam.x * 0.3) % W + W) % W, y = (k * 89.7) % (H * 0.55), tw = 0.45 + 0.4 * Math.sin(frame * 0.03 + k * 1.7);
    g.fillStyle = 'rgba(255,250,235,' + tw.toFixed(2) + ')'; g.beginPath(); g.arc(x, y, k % 7 === 0 ? 1.6 : 0.9, 0, TAU); g.fill();
  }
  const mx = W * 0.78 - cam.x * 0.4, my = 128 + cam.y * 0.2, mg = g.createRadialGradient(mx, my, 0, mx, my, 150);
  mg.addColorStop(0, 'rgba(255,236,190,.5)'); mg.addColorStop(0.25, 'rgba(255,220,170,.16)'); mg.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 150, 0, TAU); g.fill();
  g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(mx, my, 34, 0, TAU); g.fill(); g.fillStyle = 'rgba(214,190,160,.5)'; g.beginPath(); g.arc(mx - 10, my - 6, 7, 0, TAU); g.arc(mx + 12, my + 10, 4.5, 0, TAU); g.fill();
  const cols = [['#5b3f73', '#3d2c5a'], ['#3a2a58', '#261d42'], ['#231a3c', '#120e22']];
  for (let L = 0; L < 3; L++) {
    const base = H * (0.6 + L * 0.1) - cam.y * (0.3 + L * 0.25), hg = g.createLinearGradient(0, base - 70, 0, H); hg.addColorStop(0, cols[L][0]); hg.addColorStop(1, cols[L][1]);
    g.fillStyle = hg; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) { const wx = x + cam.x * (1 + L) * 1.2; g.lineTo(x, base + Math.sin(wx * 0.006 + L * 2) * 40 + Math.sin(wx * 0.017 + L) * 14 + Math.sin(wx * 0.045 + L * 5) * 4); }
    g.lineTo(W, H); g.fill();
    const fg = g.createLinearGradient(0, base + 10, 0, base + 110); fg.addColorStop(0, 'rgba(255,170,130,0)'); fg.addColorStop(1, 'rgba(255,170,130,' + (0.10 - L * 0.03) + ')'); g.fillStyle = fg; g.fillRect(0, base + 10, W, 100);
  }
}
function lampPost(lx, y, s) {
  g.lineCap = 'round'; g.strokeStyle = OL; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(SX(lx), y); g.lineTo(SX(lx), SY(19)); g.stroke();
  g.strokeStyle = '#4a4058'; g.lineWidth = 0.8 * s; g.stroke();
  g.fillStyle = '#4a4058'; rr(SX(lx) - 1.6 * s, y - 1.2 * s, 3.2 * s, 1.2 * s, 0.4 * s); g.fill(); g.strokeStyle = OL; g.lineWidth = 0.35 * s; g.stroke();
  const gl = g.createRadialGradient(SX(lx), SY(21), 0, SX(lx), SY(21), 15 * s); gl.addColorStop(0, 'rgba(255,205,110,.6)'); gl.addColorStop(0.4, 'rgba(255,205,110,.18)'); gl.addColorStop(1, 'rgba(255,205,110,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(SX(lx), SY(21), 15 * s, 0, TAU); g.fill();
  rr(SX(lx) - 1.5 * s, SY(23), 3 * s, 3.6 * s, 0.5 * s); g.fillStyle = '#ffe2a0'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.4 * s; g.stroke();
  g.fillStyle = '#fffbe6'; g.beginPath(); g.ellipse(SX(lx), SY(21.2), 0.6 * s, (1 + Math.sin(frame * 0.3 + lx) * 0.15) * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#4a4058'; g.beginPath(); g.moveTo(SX(lx) - 2.2 * s, SY(23)); g.lineTo(SX(lx), SY(25.2)); g.lineTo(SX(lx) + 2.2 * s, SY(23)); g.closePath(); g.fill(); g.stroke();
}
function drawStage() {
  const s = cam.s, x0 = SX(-80), x1 = SX(80), y = SY(0), bh = BODY_H * s;
  g.lineJoin = 'round';
  const rg = g.createLinearGradient(0, y, 0, y + bh); rg.addColorStop(0, '#43374f'); rg.addColorStop(1, '#15111f');
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.lineTo(x1, y + bh * 0.55); g.lineTo(SX(54), y + bh * 0.8); g.lineTo(SX(38), y + bh); g.lineTo(SX(-38), y + bh); g.lineTo(SX(-54), y + bh * 0.8); g.lineTo(x0, y + bh * 0.55); g.closePath();
  g.fillStyle = rg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.5 * s; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 0.3 * s; g.beginPath();
  for (const q of [[-66, 4, -52, 15], [-34, 4, -24, 22], [6, 4, -4, 21], [30, 4, 42, 20], [64, 4, 55, 13], [-10, 12, -18, 23], [18, 10, 24, 23]]) { g.moveTo(SX(q[0]), y + q[1] * s); g.lineTo(SX(q[2]), y + q[3] * s); }
  g.stroke();
  const dg = g.createLinearGradient(0, y, 0, y + 3.4 * s); dg.addColorStop(0, '#d2bd9f'); dg.addColorStop(0.3, '#a08b74'); dg.addColorStop(1, '#6a594d');
  rr(x0 - 2 * s, y, 164 * s, 3.4 * s, 1.2 * s); g.fillStyle = dg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.45 * s; g.stroke();
  g.strokeStyle = 'rgba(40,28,30,.4)'; g.lineWidth = 0.22 * s; g.beginPath(); for (let x = -72; x <= 72; x += 12) { g.moveTo(SX(x), y + 1 * s); g.lineTo(SX(x), y + 3.2 * s); } g.stroke();
  g.fillStyle = 'rgba(255,244,220,.6)'; g.fillRect(x0 - 1 * s, y + 0.25 * s, 162 * s, 0.32 * s);
  lampPost(-70, y, s); lampPost(70, y, s);
  for (const p of PLATS) if (p.soft) {
    const px = SX(p.x0), py = SY(p.y), pw = (p.x1 - p.x0) * s, hov = g.createRadialGradient(px + pw / 2, py + 2.4 * s, 0, px + pw / 2, py + 2.4 * s, pw * 0.55);
    hov.addColorStop(0, 'rgba(255,205,110,.22)'); hov.addColorStop(1, 'rgba(255,205,110,0)'); g.fillStyle = hov; g.fillRect(px - pw * 0.1, py, pw * 1.2, 7 * s);
    const pg = g.createLinearGradient(0, py, 0, py + 2 * s); pg.addColorStop(0, '#ecd2a6'); pg.addColorStop(0.35, '#b5946f'); pg.addColorStop(1, '#6f5747');
    rr(px, py, pw, 2 * s, 0.9 * s); g.fillStyle = pg; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.4 * s; g.stroke();
    g.fillStyle = 'rgba(255,248,225,.65)'; g.fillRect(px + s, py + 0.22 * s, pw - 2 * s, 0.28 * s);
    g.fillStyle = '#5a4638'; for (const ex of [px + 1.4 * s, px + pw - 1.4 * s]) { g.beginPath(); g.arc(ex, py + 1 * s, 0.38 * s, 0, TAU); g.fill(); }
  }
}
/* Fighter art: drawn in local units, origin at the feet, +x forward, +y up. All four designs are original. */
const ART = {
  Flint(c, t, f) {
    const sw = gait(f) * 1.3, a = swing(f), bob = Math.sin(t * 0.08) * 0.15;
    limb(-1.4, 3.2, -1.4 - sw, 0.6, 1.5, '#2b2433'); limb(1.4, 3.2, 1.4 + sw, 0.6, 1.5, '#2b2433');
    g.beginPath(); g.ellipse(-1.1 - sw, 0.5, 1.5, 0.7, 0, 0, TAU); ink('#4a342a', 0.3); g.beginPath(); g.ellipse(1.7 + sw, 0.5, 1.5, 0.7, 0, 0, TAU); ink('#4a342a', 0.3);
    limb(-1.6, 9 + bob, -3.4 - a, 6 + bob, 1.3, tint(c[0], -0.25));
    g.beginPath(); g.moveTo(-4.2, 2.4); g.quadraticCurveTo(0, 1.4, 4.2, 2.4); g.lineTo(2.7, 10.2 + bob); g.quadraticCurveTo(0, 11, -2.7, 10.2 + bob); g.closePath(); ink(vgrad(c[0], 2, 10.6));
    g.strokeStyle = tint(c[0], -0.45); g.lineWidth = 0.3; g.beginPath(); g.moveTo(0.9, 9.8); g.lineTo(1.3, 2.2); g.stroke();
    g.fillStyle = c[1]; for (const y of [4.5, 6.3, 8.1]) { g.beginPath(); g.arc(1.9, y + bob * 0.5, 0.33, 0, TAU); g.fill(); }
    g.beginPath(); g.moveTo(-2.6, 10 + bob); g.quadraticCurveTo(0, 8.8 + bob, 2.6, 10 + bob); g.lineTo(2.4, 10.9 + bob); g.quadraticCurveTo(0, 9.9 + bob, -2.4, 10.9 + bob); g.closePath(); ink(c[1], 0.3);
    g.beginPath(); g.arc(0.3, 12.1 + bob, 2.5, 0, TAU); ink(c[2]);
    g.fillStyle = OL; g.beginPath(); g.ellipse(1.5, 12.3 + bob, 0.32, 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(230,120,90,.5)'; g.beginPath(); g.arc(2, 11.3 + bob, 0.5, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.1, 13.7 + bob, 4.6, 0.95, 0, 0, TAU); ink(tint(c[0], -0.2));
    g.beginPath(); g.moveTo(-2.3, 13.8 + bob); g.lineTo(-1.9, 16.3 + bob); g.quadraticCurveTo(0, 16.9 + bob, 1.9, 16.3 + bob); g.lineTo(2.3, 13.8 + bob); g.closePath(); ink(vgrad(c[0], 13.8, 16.7));
    g.fillStyle = c[1]; g.fillRect(-2.15, 14.1 + bob, 4.3, 0.6);
    const hx = 4.6 + a * 3, hy = 6.8 + bob + a * 1.5, lz = Math.sin(t * 0.1) * 0.1;
    limb(1.6, 9 + bob, hx, hy, 1.4, c[0]);
    const gl = g.createRadialGradient(hx + 0.3, hy - 2.3, 0, hx + 0.3, hy - 2.3, 5.5); gl.addColorStop(0, 'rgba(255,214,120,.6)'); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gl; g.beginPath(); g.arc(hx + 0.3, hy - 2.3, 5.5, 0, TAU); g.fill();
    g.strokeStyle = OL; g.lineWidth = 0.3; g.beginPath(); g.arc(hx + 0.3 + lz, hy - 0.9, 0.8, 0, Math.PI); g.stroke();
    g.beginPath(); g.rect(hx - 0.8 + lz, hy - 3.6, 2.2, 2.7); ink('#ffe9a8', 0.35);
    g.fillStyle = '#fff8dc'; g.beginPath(); g.ellipse(hx + 0.3 + lz, hy - 2.4, 0.45, 0.8 + Math.sin(t * 0.4) * 0.15, 0, 0, TAU); g.fill();
    g.beginPath(); g.rect(hx - 1.1 + lz, hy - 1.1, 2.8, 0.5); ink(c[1], 0.25); g.beginPath(); g.rect(hx - 1.1 + lz, hy - 4, 2.8, 0.5); ink(c[1], 0.25);
  },
  Nib(c, t, f) {
    const sw = gait(f), a = swing(f), tw = Math.sin(t * 0.12) * 0.5;
    for (const q of [[-3, 1], [-1.6, -1], [1.6, 1], [3, -1]]) limb(q[0], 2.6, q[0] + sw * q[1] * 1.1, 0.5, 0.9, c[1]);
    g.beginPath(); g.moveTo(-3.6, 4.6); g.quadraticCurveTo(-8.5, 8.5 + tw, -8.6, 4 + tw); g.quadraticCurveTo(-7, 2.2, -3.8, 3.2); g.closePath(); ink(vgrad(c[0], 2, 8));
    g.beginPath(); g.moveTo(-8.6, 4 + tw); g.quadraticCurveTo(-8.9, 6.6 + tw, -7.2, 7 + tw); g.quadraticCurveTo(-7.4, 5, -8.6, 4 + tw); ink(c[2], 0.3);
    g.beginPath(); g.ellipse(0, 4.1, 4.7, 2.7, 0, 0, TAU); ink(vgrad(c[0], 1.4, 6.8));
    g.fillStyle = tint(c[0], 0.4); g.beginPath(); g.ellipse(0.6, 2.9, 3, 1, 0, 0, TAU); g.fill();
    g.strokeStyle = tint(c[0], -0.45); g.lineWidth = 0.25; g.beginPath(); g.moveTo(-1.6, 6.5); g.lineTo(-1.6, 1.7); g.moveTo(1.8, 6.4); g.lineTo(1.8, 1.8); g.stroke();
    g.fillStyle = c[1]; for (const p of [[-1.6, 5.4], [-1.6, 2.8], [1.8, 5.3], [1.8, 2.9]]) { g.beginPath(); g.arc(p[0], p[1], 0.28, 0, TAU); g.fill(); }
    g.save(); g.translate(-0.6, 6.7); limb(0, 0, 0, 1.6, 0.5, c[1]); g.translate(0, 2.5); g.scale(Math.cos(t * 0.15) || 0.05, 1);
    g.beginPath(); g.arc(-0.9, 0, 0.85, 0, TAU); g.moveTo(1.75, 0); g.arc(0.9, 0, 0.85, 0, TAU); g.strokeStyle = OL; g.lineWidth = 0.75; g.stroke(); g.strokeStyle = c[1]; g.lineWidth = 0.35; g.stroke(); g.restore();
    const hx = 4 + a * 1.5, hy = 6.4;
    g.beginPath(); g.moveTo(hx - 1.8, hy + 1.6); g.lineTo(hx - 1.3, hy + 4.4); g.lineTo(hx, hy + 2.2); g.closePath(); ink(c[0]);
    g.beginPath(); g.moveTo(hx + 0.3, hy + 2.2); g.lineTo(hx + 1.6, hy + 4.4); g.lineTo(hx + 2, hy + 1.4); g.closePath(); ink(c[0]);
    g.beginPath(); g.arc(hx, hy, 2.5, 0, TAU); ink(vgrad(c[0], hy - 2.5, hy + 2.5));
    g.beginPath(); g.moveTo(hx + 1, hy + 0.4); g.quadraticCurveTo(hx + 4, hy - 0.6, hx + 1.2, hy - 1.9); g.closePath(); ink(c[2], 0.3);
    g.fillStyle = OL; g.beginPath(); g.arc(hx + 3.1, hy - 0.6, 0.42, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + 0.9, hy + 0.8, 0.36, 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 1, hy + 1, 0.15, 0, TAU); g.fill();
  },
  Loom(c, t, f) {
    const a = swing(f), bob = Math.sin(t * 0.07) * 0.5;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = -1; k <= 1; k++) {
      g.beginPath(); g.moveTo(k * 1.1, 4.2 + bob);
      for (let q = 1; q <= 9; q++) g.lineTo(k * 1.1 - q * 1.15 + Math.sin(t * 0.12 + q * 0.8 + k) * 0.6, 4.2 + bob - q * 0.45 + Math.sin(t * 0.1 + q + k * 2) * 0.9);
      g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = k ? c[1] : c[2]; g.lineWidth = 0.85; g.stroke();
    }
    if (a > 0) { g.beginPath(); g.moveTo(3.5, 9.5 + bob); g.quadraticCurveTo(6 + a * 4, 12 + bob, 8 + a * 7, 9 + bob); g.strokeStyle = OL; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = c[1]; g.lineWidth = 0.85; g.stroke(); }
    g.beginPath(); g.moveTo(0, 15.4 + bob); g.quadraticCurveTo(3.4, 12.8 + bob, 4.9, 9.6 + bob); g.quadraticCurveTo(2.6, 6.4 + bob, 0, 3.4 + bob); g.quadraticCurveTo(-2.6, 6.4 + bob, -4.9, 9.6 + bob); g.quadraticCurveTo(-3.4, 12.8 + bob, 0, 15.4 + bob); g.closePath(); ink(vgrad(c[0], 3.4, 15.4));
    g.fillStyle = tint(c[0], 0.3); g.beginPath(); g.moveTo(0, 15.1 + bob); g.quadraticCurveTo(3.2, 12.7 + bob, 4.5, 9.8 + bob); g.lineTo(0.2, 9.8 + bob); g.closePath(); g.fill();
    g.strokeStyle = tint(c[0], -0.5); g.lineWidth = 0.35; g.beginPath(); g.moveTo(0, 15.2 + bob); g.lineTo(0, 3.6 + bob); g.moveTo(-4.7, 9.6 + bob); g.lineTo(4.7, 9.6 + bob); g.stroke();
    g.fillStyle = c[2]; g.beginPath(); g.ellipse(1.3, 11.3 + bob, 0.7, 0.95, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(3.1, 10.9 + bob, 0.5, 0.75, 0, 0, TAU); g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(1.5, 11.2 + bob, 0.3, 0, TAU); g.fill(); g.beginPath(); g.arc(3.2, 10.8 + bob, 0.24, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(0, 4 + bob); g.lineTo(-1.5, 5 + bob); g.lineTo(-1.5, 3 + bob); g.closePath(); ink(c[1], 0.3);
    g.beginPath(); g.moveTo(0, 4 + bob); g.lineTo(1.5, 5 + bob); g.lineTo(1.5, 3 + bob); g.closePath(); ink(c[1], 0.3);
  },
  Hod(c, t, f) {
    const sw = gait(f), a = swing(f), br = Math.sin(t * 0.06) * 0.15;
    for (const q of [[-3.4, 1], [3.2, -1]]) { g.beginPath(); g.ellipse(q[0] + sw * q[1], 0.8, 1.9, 1.1, 0, 0, TAU); ink('#2f2a33', 0.35); }
    g.beginPath(); g.ellipse(0, 6.3, 6.5, 5.7 + br, 0, 0, TAU); ink(vgrad(c[0], 0.6, 12));
    g.fillStyle = tint(c[0], 0.35); g.beginPath(); g.ellipse(1.5, 4.2, 3.6, 2.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-7, 6.8); g.lineTo(-6, 12.2 + br); g.lineTo(-2.4, 14.2 + br); g.lineTo(2.2, 12.6 + br); g.lineTo(1.2, 8.6); g.lineTo(-3, 7.6); g.closePath(); ink(vgrad(c[1], 6.8, 14.2));
    g.fillStyle = tint(c[1], 0.3); g.beginPath(); g.moveTo(-6, 12.2 + br); g.lineTo(-2.4, 14.2 + br); g.lineTo(2.2, 12.6 + br); g.lineTo(-1.6, 11.6 + br); g.closePath(); g.fill();
    g.strokeStyle = tint(c[1], -0.5); g.lineWidth = 0.3; g.beginPath(); g.moveTo(-1.6, 11.6 + br); g.lineTo(-3, 7.6); g.moveTo(-1.6, 11.6 + br); g.lineTo(-6, 12.2 + br); g.moveTo(-1.6, 11.6 + br); g.lineTo(2.2, 12.6 + br); g.moveTo(-4.6, 9.2); g.lineTo(-3.9, 10.6); g.stroke();
    limb(2.5, 4.2, 4.6 + a * 4, 2.6 + a * 2.5, 1.9, tint(c[0], -0.15));
    const hx = 5 + a * 1.2;
    g.beginPath(); g.arc(hx - 1.6, 8.6, 1, 0, TAU); ink(tint(c[0], -0.2), 0.3);
    g.beginPath(); g.ellipse(hx, 6.2, 3.3, 2.7, 0, 0, TAU); ink(vgrad(c[0], 3.5, 8.9));
    g.beginPath(); g.moveTo(hx - 2, 8.3); g.quadraticCurveTo(hx + 1, 7.6, hx + 3.2, 5.7); g.lineTo(hx + 3.1, 4.9); g.quadraticCurveTo(hx + 0.6, 6.6, hx - 2.4, 7.3); g.closePath(); g.fillStyle = c[2]; g.fill();
    g.fillStyle = OL; g.beginPath(); g.arc(hx + 3.1, 5.3, 0.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + 0.6, 6.1, 0.36, 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(hx + 0.7, 6.3, 0.15, 0, TAU); g.fill();
  },
};
function drawFighter(f) {
  if (f.state === 'dead') return;
  const s = cam.s, st = f.st, fm = f.form, col = f.alt ? fm.alt : fm.col, x = SX(f.x), y = SY(f.y);
  if (f.state === 'respawn') { g.fillStyle = 'rgba(255,230,160,.8)'; rr(x - 9 * s, y, 18 * s, 1.6 * s, 0.8 * s); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.25)'; if (f.grounded) { g.beginPath(); g.ellipse(x, y + 0.4 * s, st.w * 0.6 * s, 0.9 * s, 0, 0, TAU); g.fill(); }
  g.save(); g.translate(x, y);
  let sy = 1, sx = 1, rot = 0, oy = 0;
  if (f.state === 'jsq' || f.state === 'land') { sy = 0.8; sx = 1.12; } else if (f.state === 'dash' || f.state === 'run') rot = 0.18;
  else if (f.state === 'wd') { sy = 0.85; rot = -0.12 * sgn(f.vx * f.face); }
  else if (f.state === 'hurt' && !f.grounded) { rot = f.sf * 0.3; oy = st.h / 2; }
  else if (f.state === 'broken') rot = Math.sin(frame * 0.2) * 0.25;
  else if (f.state === 'roll') { rot = f.sf * 0.45 * f.rollDir * f.face; oy = st.h / 2; }
  else if (f.state === 'helpless') rot = 0.35;
  else if (f.state === 'attack' && f.move && f.move.swap) { sx = sy = 1 - Math.sin(Math.min(1, f.mf / 34) * Math.PI) * 0.7; }
  else if (f.state === 'air') sy = 1 + clamp(Math.abs(f.vy) * 0.03, 0, 0.12);
  else if (f.state === 'idle' && f.ctl.c.ly < -0.6) { sy = 0.72; sx = 1.1; }
  else if (f.state === 'down') { sy = 0.45; sx = 1.25; }
  if (!f.grounded && f.state !== 'ledge' && f.state !== 'hurt' && f.state !== 'roll') oy = 0;
  g.scale(s * f.face, -s);
  if (oy) { g.translate(0, oy); g.rotate(-rot); g.translate(0, -oy); } else g.rotate(-rot);
  g.scale(sx, sy);
  if (f.invuln > 0 && (frame >> 1) % 2) g.globalAlpha = 0.45;
  if (f.state === 'spot' || f.state === 'airdodge') g.globalAlpha = 0.5;
  ART[fm.name](col, frame + f.idx * 40, f);
  if (f.flash > 0 || f.hitlag > 0 && f.state === 'hurt') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; ART[fm.name](['#ffffff', '#ffffff', '#ffffff'], frame, f); g.globalCompositeOperation = 'source-over'; }
  g.restore(); g.globalAlpha = 1;
  /* Attack arcs. */
  if (f.state === 'attack' && f.move) for (const h of f.move.h) if (f.mf >= h.f0 && f.mf <= h.f1 && !h.grab) {
    const hx = SX(f.x + h.x * f.face), hy = SY(f.y + h.y), k = (f.mf - h.f0 + 1) / (h.f1 - h.f0 + 1);
    g.strokeStyle = col[1]; g.globalAlpha = 0.85 - k * 0.5; g.lineWidth = 1.6 * s; g.beginPath(); g.arc(hx, hy, h.r * s * 0.8, -1.2 + k * 2.4 * f.face, 1.2 + k * 2.4 * f.face); g.stroke();
    g.fillStyle = col[2]; g.globalAlpha = 0.18; g.beginPath(); g.arc(hx, hy, h.r * s, 0, TAU); g.fill(); g.globalAlpha = 1;
  }
  if (f.state === 'attack' && f.move && f.move.h[0] && f.move.h[0].grab && f.mf >= 5 && f.mf <= 10) { g.strokeStyle = '#fff'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(x + 3 * s * f.face, y - 7 * s); g.lineTo(x + 11 * s * f.face, y - 7 * s); g.stroke(); }
  if (f.charge > 0 && (frame >> 1) % 2) { g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - st.h * s / 2, (st.h * 0.7 + f.charge * 0.05) * s, 0, TAU); g.stroke(); }
  if (f.state === 'shield' || f.state === 'shieldstun') {
    const r = (4 + f.shieldHp / 50 * 6) * s; g.fillStyle = f.idx ? 'rgba(110,180,255,.45)' : 'rgba(255,125,110,.45)'; g.beginPath(); g.arc(x, y - st.h * s / 2, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
  }
  if (f.state === 'broken') { g.fillStyle = '#ffe066'; for (let k = 0; k < 3; k++) { const a = frame * 0.15 + k * TAU / 3; g.beginPath(); g.arc(x + Math.cos(a) * 5 * s, y - (st.h + 3) * s + Math.sin(a) * 1.5 * s, 0.9 * s, 0, TAU); g.fill(); } }
  /* Player tag. */
  const ty = Math.max(26, y - (st.h + 7) * s); g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = f.idx ? '#6cb4ff' : '#ff7b6c';
  g.fillText(f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1), clamp(x, 20, W - 20), ty); g.beginPath(); g.moveTo(x - 5, ty + 4); g.lineTo(x + 5, ty + 4); g.lineTo(x, ty + 10); g.fill();
}
function drawProj() {
  const s = cam.s;
  for (const p of PROJ) {
    const x = SX(p.x), y = SY(p.y);
    if (p.kind === 'ember' || p.kind === 'flame') {
      const fl = p.kind === 'flame' ? 1 + Math.sin(frame * 0.5) * 0.25 : 1; g.fillStyle = 'rgba(255,170,60,.35)'; g.beginPath(); g.arc(x, y, p.r * 1.8 * s, 0, TAU); g.fill();
      g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(x, y - (fl - 1) * 2 * s, p.r * 0.7 * s, p.r * 0.9 * s * fl, 0, 0, TAU); g.fill(); g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x, y, p.r * 0.35 * s, 0, TAU); g.fill();
    } else if (p.kind === 'bolt') { g.strokeStyle = '#ffe8a3'; g.lineWidth = 1.4 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 3 * s * p.face, y); g.lineTo(x + 2 * s * p.face, y); g.stroke(); g.lineCap = 'butt'; }
    else if (p.kind === 'gust') { g.strokeStyle = 'rgba(240,220,255,.7)'; g.lineWidth = 0.7 * s; for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(x - k * 2 * s, y + k * 3 * s, 3 * s, -1 + frame * 0.2, 1.4 + frame * 0.2); g.stroke(); } }
    else { g.save(); g.translate(x, y); g.rotate(p.rot || 0); g.fillStyle = '#8d8794'; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r = p.r * s * (k % 2 ? 0.85 : 1); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = '#4c4855'; g.lineWidth = 2; g.stroke(); g.restore(); }
  }
}
function drawFx() {
  g.lineCap = 'round';
  for (const p of PART) {
    g.globalAlpha = Math.min(1, p.life / 12); const x = SX(p.x), y = SY(p.y), sp = Math.hypot(p.vx, p.vy);
    if (sp > 0.25) { g.strokeStyle = p.col; g.lineWidth = p.r * cam.s; g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.vx * 2.4 * cam.s, y + p.vy * 2.4 * cam.s); g.stroke(); }
    else { g.fillStyle = p.col; g.beginPath(); g.arc(x, y, p.r * cam.s, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1; g.textAlign = 'center'; g.font = 'bold 22px system-ui, sans-serif';
  for (const p of POPS) { g.globalAlpha = Math.min(1, p.life / 20); g.fillStyle = p.col; g.fillText(p.text, SX(p.x), SY(p.y)); } g.globalAlpha = 1;
}
function pctCol(p) { const k = clamp(p / 150, 0, 1); return `rgb(255,${255 - k * 190 | 0},${255 - k * 215 | 0})`; }
function drawHud() {
  g.textAlign = 'center';
  const t = Math.max(0, Math.ceil(timer / 60)), mm = t / 60 | 0, ss = t % 60;
  g.font = 'bold 34px system-ui, sans-serif'; g.fillStyle = 'rgba(0,0,0,.45)'; rr(W / 2 - 62, 12, 124, 46, 10); g.fill(); g.fillStyle = timer < 1800 || sudden ? '#ff8a7a' : '#fff'; g.fillText(sudden ? 'SD' : mm + ':' + (ss < 10 ? '0' : '') + ss, W / 2, 47);
  F.forEach(f => {
    const x = W * (f.idx ? 0.68 : 0.32), y = H - 86, pc = f.idx ? '#6cb4ff' : '#ff7b6c';
    g.fillStyle = 'rgba(10,10,20,.6)'; rr(x - 120, y, 240, 74, 12); g.fill(); g.fillStyle = pc; rr(x - 120, y, 8, 74, 4); g.fill();
    g.textAlign = 'left'; g.font = 'bold 16px system-ui, sans-serif'; g.fillStyle = pc; g.fillText((f.ctl.dev === 'cpu' ? 'CPU' : 'P' + (f.idx + 1)) + '  ' + f.def.name, x - 102, y + 22);
    for (let k = 0; k < f.stocks; k++) { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x - 96 + k * 18, y + 40, 6, 0, TAU); g.fill(); }
    if (f.def.forms.length > 1) f.def.forms.forEach((fm, k) => { g.fillStyle = k === f.fi ? '#fff' : 'rgba(255,255,255,.35)'; g.font = (k === f.fi ? 'bold ' : '') + '12px system-ui, sans-serif'; g.fillText(fm.name, x - 102 + k * 42, y + 64); });
    g.textAlign = 'right'; g.font = 'bold 44px system-ui, sans-serif'; g.fillStyle = pctCol(f.pct); const jx = f.flash > 0 ? (Math.random() - 0.5) * 6 : 0; g.fillText(Math.round(f.pct) + '%', x + 106 + jx, y + 52);
  });
  g.textAlign = 'center';
  if (mode === 'countdown') { const n = countdown > 130 ? '3' : countdown > 90 ? '2' : countdown > 50 ? '1' : 'GO!'; big(n, H * 0.42, 110); }
  if (paused) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H); big('PAUSED', H * 0.45, 80); }
  if (mode === 'over') { big(overT < 90 ? 'GAME!' : result, H * 0.42, 100); if (overT > 100) { g.font = '22px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('Press Start or Attack', W / 2, H * 0.42 + 56); } }
}
function big(t, y, sz) { g.font = `900 ${sz}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#1a1230'; g.strokeText(t, W / 2, y); g.fillStyle = '#ffd98a'; g.fillText(t, W / 2, y); }
function drawSelect() {
  const sv = { x: cam.x, y: cam.y, s: cam.s }; cam.x = 0; cam.y = 30; cam.s = 3.4; drawBg(); Object.assign(cam, sv);
  g.fillStyle = 'rgba(8,8,18,.55)'; g.fillRect(0, 0, W, H);
  big('EMBERFALL', 110, 84); g.font = '22px system-ui, sans-serif'; g.fillStyle = '#f6e7c1'; g.fillText('3 stocks  ·  8 minutes', W / 2, 150);
  for (let k = 0; k < 2; k++) {
    const sl = slots[k], x = W / 2 + (k ? 40 : -480), y = 190, pc = k ? '#6cb4ff' : '#ff7b6c';
    g.fillStyle = 'rgba(15,15,30,.75)'; rr(x, y, 440, 330, 16); g.fill(); g.strokeStyle = pc; g.lineWidth = 3; g.stroke();
    g.textAlign = 'left'; g.font = 'bold 24px system-ui, sans-serif'; g.fillStyle = pc; g.fillText('PLAYER ' + (k + 1), x + 24, y + 40);
    g.textAlign = 'center';
    if (!sl) { g.font = '20px system-ui, sans-serif'; g.fillStyle = '#ddd'; g.fillText(k && slots[0] ? 'Press Attack to join' : 'Press Attack to join', x + 220, y + 160); if (k) { g.fillStyle = '#999'; g.fillText('(empty = CPU opponent)', x + 220, y + 192); } continue; }
    g.textAlign = 'right'; g.font = '18px system-ui, sans-serif'; g.fillStyle = '#ccc'; g.fillText(devName(sl.dev), x + 416, y + 40); g.textAlign = 'center';
    const d = ROSTER[sl.pick]; g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.fillText('‹  ' + d.name + '  ›', x + 220, y + 100);
    g.font = '18px system-ui, sans-serif'; g.fillStyle = '#f6e7c1'; g.fillText(d.sub, x + 220, y + 128);
    d.forms.forEach((fm, q) => { g.save(); g.translate(x + 220 + (q - (d.forms.length - 1) / 2) * 120, y + 250); g.scale(6, -6); ART[fm.name](k && slots[0] && slots[0].pick === sl.pick ? fm.alt : fm.col, frame, null); g.restore(); if (d.forms.length > 1) { g.font = '15px system-ui, sans-serif'; g.fillStyle = '#ccc'; g.fillText(fm.name, x + 220 + (q - 1) * 120, y + 276); } });
    g.font = 'bold 22px system-ui, sans-serif'; g.fillStyle = sl.ready ? '#9be564' : '#ffd98a'; g.fillText(sl.ready ? 'READY' : 'Left / Right to choose, Attack to confirm', x + 220, y + 312);
  }
  g.textAlign = 'center'; g.font = 'bold 22px system-ui, sans-serif'; g.fillStyle = '#fff';
  if (slots[0] && slots[0].ready && (!slots[1] || slots[1].ready)) g.fillText('Press Start (Enter) to fight', W / 2, 556);
  g.font = '16px system-ui, sans-serif'; g.fillStyle = '#cfc8e8';
  g.fillText('Controller: stick move · right button attack · bottom button special · left/top button jump · triggers shield · bumpers grab · right stick smash', W / 2, 610);
  g.fillText('Keyboard: WASD move (Shift = walk) · J attack · K special · Space jump · L shield · H grab · arrows smash · Enter start', W / 2, 636);
  g.fillText('Jump then shield with a direction to wavedash · flick down to drop through platforms · release shield just before a hit to parry', W / 2, 662);
  g.fillText('Jump + attack together for a short-hop aerial · shield just before hitting the floor to tech · mash buttons to break a grab', W / 2, 688);
}
function draw() {
  fit(); g.setTransform(RS, 0, 0, RS, 0, 0);
  if (mode === 'select') { drawSelect(); return; }
  g.save(); if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBg(); drawStage(); drawProj(); for (const f of F) drawFighter(f); drawFx(); g.restore(); drawHud();
}

/* ---------- Loop: fixed 60 steps per second ---------- */
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  draw(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.__game = { get F() { return F; }, get mode() { return mode; }, slots, step, startMatch, keys, draw };
