'use strict';
/* Emberfall simulation: rules, input, fighters, combat, CPU and match flow. No drawing in this file; it also runs headless. */
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
const CROUCH_Y = -0.4;   /* how far down the stick must be held to crouch */
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
/* A hit: a short burst of filtered noise over a low thump, longer and deeper for harder hits. The noise is made with its
   own generator, so playing a sound never disturbs the game's random numbers. */
let NOISE = null;
function thwack(kb) {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!NOISE) { NOISE = AC.createBuffer(1, AC.sampleRate * 0.4 | 0, AC.sampleRate); const d = NOISE.getChannelData(0); let q = 12345; for (let k = 0; k < d.length; k++) { q = (q * 1664525 + 1013904223) >>> 0; d[k] = q / 2147483648 - 1; } }
    const t = AC.currentTime, k = Math.min(1, kb / 160), dur = 0.07 + k * 0.16;
    const n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); n.buffer = NOISE;
    f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(2600 - k * 1200, t); f.frequency.exponentialRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(0.05 + k * 0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(AC.destination); n.start(t); n.stop(t + dur);
    const o = AC.createOscillator(), a = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(170 - k * 60, t); o.frequency.exponentialRampToValueAtTime(45, t + dur * 1.2);
    a.gain.setValueAtTime(0.06 + k * 0.1, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.2);
    o.connect(a); a.connect(AC.destination); o.start(t); o.stop(t + dur * 1.2);
  } catch (e) { /* no audio */ }
}

/* ---------- Input ---------- */
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (/^(Arrow|Space|Enter|Backspace)/.test(e.code)) e.preventDefault(); if (!e.repeat || e.code === 'KeyO') debugKey(e.code); });
/* Debug tools: B shows hitboxes and hurtboxes, P freezes the game, O advances one frame, M switches between the 2D and 3D renderers. */
const DBG = { step: false, boxes: false, advance: 0, r3d: true };
function debugKey(code) {
  if (code === 'KeyP') { DBG.step = !DBG.step; DBG.advance = 0; } else if (code === 'KeyO') { if (DBG.step) DBG.advance++; }
  else if (code === 'KeyB') DBG.boxes = !DBG.boxes; else if (code === 'KeyM') DBG.r3d = !DBG.r3d;
}
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function blankIn() { return { lx: 0, ly: 0, cx: 0, cy: 0, atk: false, spc: false, jmp: false, shd: false, grb: false, start: false, sel: false }; }
/* Controller settings follow the reference build's controllers.ini: no stick deadzone, full outer zone, triggers at 25%. */
const PAD = { deadzone: 0, outer: 1, trigger: 0.25 };
/* Per pad: 'positional' (default, by where the button sits) or 'labels' (by the letter printed on it). Kept between visits. */
const LAYOUT = {};
try { Object.assign(LAYOUT, JSON.parse(localStorage.getItem('emberfall.layout') || '{}')); } catch (e) { /* no storage */ }
function toggleLayout(dev) { LAYOUT[dev] = LAYOUT[dev] === 'labels' ? 'positional' : 'labels'; try { localStorage.setItem('emberfall.layout', JSON.stringify(LAYOUT)); } catch (e) { /* no storage */ } }
/* Per device: flicking the stick up also jumps ("tap jump"). Off until switched on with the jump button on the select screen. Kept between visits. */
const TAPJUMP = {};
try { Object.assign(TAPJUMP, JSON.parse(localStorage.getItem('emberfall.tapjump') || '{}')); } catch (e) { /* no storage */ }
function toggleTapJump(dev) { TAPJUMP[dev] = !TAPJUMP[dev]; try { localStorage.setItem('emberfall.tapjump', JSON.stringify(TAPJUMP)); } catch (e) { /* no storage */ } }
const TAP_STATES = { idle: 1, dash: 1, run: 1, brake: 1, land: 1, air: 1, wd: 1, shield: 1, shieldstun: 1, shieldoff: 1, attack: 1 };   /* where an upward flick may mean "jump" */
function stick(x, y) { const m = Math.hypot(x, y); if (m === 0 || m <= PAD.deadzone) return [0, 0]; const k = Math.min(1, (m - PAD.deadzone) / (PAD.outer - PAD.deadzone)) / m; return [x * k, y * k]; }
/* Keyboard: the same keys as the reference build. Arrows are the left stick, I J K L the right stick, Shift walks. */
function readKb() {
  const i = blankIn(), m = (keys.ShiftLeft || keys.ShiftRight) ? 0.5 : 1;
  i.lx = ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * m; i.ly = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * m;
  i.cx = (keys.KeyL ? 1 : 0) - (keys.KeyJ ? 1 : 0); i.cy = (keys.KeyI ? 1 : 0) - (keys.KeyK ? 1 : 0);
  i.atk = !!keys.KeyZ; i.spc = !!keys.KeyX; i.jmp = !!(keys.KeyC || keys.KeyV); i.grb = !!(keys.KeyA || keys.KeyS); i.shd = !!(keys.KeyQ || keys.KeyW);
  i.start = !!keys.Enter; i.sel = !!keys.Backspace;
  return i;
}
function padInfo(n) { const p = navigator.getGamepads ? navigator.getGamepads()[n] : null; return p ? p.id : ''; }
function readPad(n) {
  const p = navigator.getGamepads ? navigator.getGamepads()[n] : null, i = blankIn();
  if (!p) return i;
  const b = k => !!(p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > PAD.trigger)), ax = k => p.axes[k] || 0;
  [i.lx, i.ly] = stick(ax(0), -ax(1)); [i.cx, i.cy] = stick(ax(2), -ax(3));
  if (b(14)) i.lx = -1; if (b(15)) i.lx = 1; if (b(12)) i.ly = 1; if (b(13)) i.ly = -1;
  const m = Math.hypot(i.lx, i.ly); if (m > 1) { i.lx /= m; i.ly /= m; }
  /* Positional: the right face button attacks and the bottom one is special. Labels swaps those two, for pads that report by printed letter. */
  const swap = LAYOUT['pad' + n] !== 'labels';   /* owner asked for A and B the other way round (2026-11-10): the bottom button now attacks unless toggled */
  i.atk = b(swap ? 0 : 1); i.spc = b(swap ? 1 : 0); i.jmp = b(2) || b(3); i.shd = b(6) || b(7); i.grb = b(4) || b(5); i.start = b(9); i.sel = b(8);
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
    for (const k in this.buf) { if (c[k] && !p[k]) this.buf[k] = T.buffer; else if (this.buf[k] > 1 || (this.buf[k] === 1 && !c[k])) this.buf[k]--; }
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
function mk(R, P, S, Y, special, kit) {
  const F = n => Math.max(1, Math.round(n * S));
  const hb = (f0, f1, x, y, r, d, a, b, k, o) => Object.assign({ f0: F(f0), f1: F(f1), x: x * R, y: y * Y, r: r * (0.55 + 0.45 * R), d: Math.round(d * P * 10) / 10, a, b, k }, o);
  const m = {
    jab: { t: F(16), next: 'jab2', chain: F(7), h: [hb(3, 5, 9, 8, 4.5, 3, 70, 16, 30)] },
    jab2: { t: F(18), next: 'jab3', chain: F(8), h: [hb(3, 5, 9.5, 8, 4.5, 2.5, 70, 18, 30)] },
    jab3: { t: F(28), h: [hb(5, 8, 10.5, 8, 5.2, 5, 361, 40, 80)] },
    ftilt: { t: F(27), tilt: 1, h: [hb(6, 9, 11, 8, 5, 8, 361, 25, 90)] },
    utilt: { t: F(26), tilt: 1, h: [hb(5, 10, 3, 17, 5.5, 6.5, 95, 30, 95)] },
    dtilt: { t: F(22), tilt: 1, h: [hb(5, 7, 10, 2.5, 4.5, 6, 75, 25, 70)] },
    dash: { t: F(36), h: [hb(7, 14, 8, 6, 5.5, 9, 60, 50, 60)] },
    fsmash: { t: F(46), chg: F(8), h: [hb(15, 18, 13, 8, 6.5, 16, 361, 28, 83)] },
    usmash: { t: F(42), chg: F(6), h: [hb(10, 15, 2, 18, 7, 14, 88, 30, 104)] },
    dsmash: { t: F(44), chg: F(5), h: [hb(8, 10, 11, 3, 5.5, 12, 30, 30, 76), hb(16, 18, -11, 3, 5.5, 13, 150, 30, 79, { g: 1 })] },
    nair: { t: F(40), ll: F(7), air: 1, h: [hb(4, 20, 0, 7, 7, 8, 45, 22, 80, { away: 1 })] },
    fair: { t: F(40), ll: F(11), air: 1, h: [hb(8, 12, 10, 8, 5.5, 10, 45, 30, 95)] },
    bair: { t: F(36), ll: F(10), air: 1, h: [hb(7, 10, -11, 8, 5.5, 11, 140, 25, 92)] },
    uair: { t: F(32), ll: F(8), air: 1, h: [hb(5, 10, 1, 18, 6, 8, 80, 25, 95)] },
    dair: { t: F(44), ll: F(14), air: 1, h: [hb(12, 15, 1, -1, 5.5, 12, 270, 20, 80)] },
    grab: { t: F(30), h: [{ f0: 6, f1: 8, x: 9 * R, y: 7 * Y, r: 4.5, grab: 1, d: 0 }] },
    dgrab: { t: F(40), h: [{ f0: 9, f1: 11, x: 11.5 * R, y: 7 * Y, r: 4.8, grab: 1, d: 0 }] },   /* out of a dash: farther, slower */
    pgrab: { t: F(42), h: [{ f0: 10, f1: 12, x: 13 * R, y: 7 * Y, r: 4.8, grab: 1, d: 0 }] },   /* turning round out of a run: farthest */
    getup: { t: F(40), h: [hb(16, 19, 9, 5, 6, 7, 48, 60, 40), hb(16, 19, -9, 5, 6, 7, 132, 60, 40, { g: 1 })], on(f, n) { if (n === 1) f.invuln = Math.max(f.invuln, f.pct >= 100 ? 12 : 18); } },
  };
  /* Aerials land without lag before the hit comes out or once it is well over. */
  for (const k of ['nair', 'fair', 'bair', 'uair', 'dair']) m[k].ac = Math.max(...m[k].h.map(h => h.f1)) + F(9);
  const th = (d, a, b, k) => ({ d: Math.round(d * P * 10) / 10, a, b, k });
  m.throws = { f: th(8, 45, 60, 60), b: th(9, 135, 60, 65), u: th(7, 88, 55, 55), d: th(5, 75, 45, 30) };
  /* Per-fighter kit: how many jabs chain, grab reach and speed, throw strengths, armoured moves. */
  kit = kit || {};
  if (kit.rapid) m.jabr = { t: F(6), rapid: 1, next: 'jab3', h: [hb(2, 3, 9.5, 8, 4.5, 0.8, 80, 16, 0, { hl: 2 })] };   /* a flurry of light hits that hold the target in place */
  if (kit.rapid) m.jab.next = 'jabr'; else if (kit.jabs === 2) m.jab.next = 'jab3'; else if (kit.jabs === 1) { delete m.jab.next; m.jab.t = F(22); Object.assign(m.jab.h[0], { d: m.jab.h[0].d + 2, a: 361, b: 30, k: 60 }); }
  for (const g of ['grab', 'dgrab', 'pgrab']) if (kit[g]) { const o = kit[g]; if (o.t) m[g].t = o.t; Object.assign(m[g].h[0], o.h || {}); }
  if (kit.throws) for (const k in kit.throws) Object.assign(m.throws[k], kit.throws[k]);
  if (kit.armor) for (const k in kit.armor) m[k].armor = kit.armor[k].map(F);
  return Object.assign(m, special);
}
const lift = (f, vy) => { f.grounded = false; f.plat = null; f.vy = vy; };
const SWAP = { t: 34, swap: 1, h: [], on(f, n) { if (n === 1) f.invuln = Math.max(f.invuln, 12); if (n === 17) { f.fi = (f.fi + 1) % f.def.forms.length; f.jumps = f.grounded ? (f.st.jumps || 1) : Math.min(f.jumps, f.st.jumps || 1); spark(f.x, f.y + 7, '#fff', 14, 1.4); beep(660, 0.12, 'triangle', 0.05, 1.6); } } };

/* ---------- Fighters (all original) ---------- */
const FLINT = {
  name: 'Flint', sub: 'the lamplighter', forms: [{
    name: 'Flint', col: ['#1f6f78', '#f2c14e', '#f6e7c1'], alt: ['#7a3b69', '#9be564', '#f6e7c1'], reachMul: 1.0,
    /* All-rounder: middling everything, a three-hit jab, a projectile, a dependable recovery. */
    st: { weight: 92, walk: 1.1, dash: 1.95, run: 1.75, airSpeed: 1.12, airAcc: 0.075, grav: 0.095, fall: 1.6, ffall: 2.55, jump: 3.05, shop: 1.85, djump: 2.95, jsq: 3, trac: 0.11, w: 8, h: 14,
      jumps: 1, dashF: 14, roll: [28, 1.35, 13], spot: [22, 15] },
    aiShot: 1,
    moves: mk(1, 1, 1, 1, {
      /* Ember Toss: a lobbed coal that keeps burning where it lands. */
      nspec: { t: 40, h: [], on(f, n) { if (n === 14) { shoot(f, { kind: 'ember', vx: 1.4, vy: 1.7, grav: 0.09, r: 3, life: 120, ground: 'stick', h: { d: 5, a: 70, b: 30, k: 40 } }); beep(520, 0.08, 'sawtooth', 0.04, 0.6); } } },
      /* Lantern Rush: a straight lunge behind the swinging lantern. */
      sspec: { t: 44, once: 1, nodrift: 1, h: [{ f0: 12, f1: 22, x: 8, y: 8, r: 6, d: 9, a: 50, b: 50, k: 70 }], on(f, n) { if (n >= 12 && n <= 22) { f.vx = f.face * 2.6; if (!f.grounded) f.vy = 0; } if (n === 23) f.vx *= 0.3; } },
      /* Updraft: rides the lantern's heat straight up. */
      uspec: { t: 40, helpless: 1, ledge: 1, inv: [3, 8], h: [{ f0: 6, f1: 16, x: 0, y: 10, r: 7, d: 7, a: 85, b: 60, k: 60 }], on(f, n, i) { if (n === 6) { lift(f, 3.7); f.vx = i.lx * 0.9; } } },
      /* Flare Burst: slow point-blank blast all around. */
      dspec: { t: 56, h: [{ f0: 20, f1: 24, x: 0, y: 8, r: 13, d: 15, a: 50, b: 40, k: 95, away: 1 }], on(f, n) { if (n === 1 && !f.grounded) f.vy *= 0.4; if (n === 20) { spark(f.x, f.y + 8, '#f2c14e', 26, 2.2); beep(140, 0.25, 'sawtooth', 0.07, 0.4); } } },
    }, { jabs: 3 }),
  }],
};
const WREN = {
  name: 'Wren', sub: 'and her three companions', forms: [{
    /* Nib: a wind-up fox. Light, quick, short reach. */
    name: 'Nib', col: ['#c9862b', '#6b4a1e', '#ffe8a3'], alt: ['#4f9d8f', '#1f4d47', '#e8fff6'], reachMul: 0.9,
    /* Rushdown: light and quick, short reach, fast falls, fast dodges, wall jumps, weak throws that set up follow-ups. */
    st: { weight: 80, walk: 1.25, dash: 2.25, run: 2.1, airSpeed: 1.28, airAcc: 0.095, grav: 0.115, fall: 1.85, ffall: 2.95, jump: 3.2, shop: 2.0, djump: 3.1, jsq: 3, trac: 0.13, w: 8, h: 9,
      jumps: 1, wallJump: 1, dashF: 11, roll: [24, 1.6, 11], spot: [20, 14] },
    aiShot: 1,
    moves: mk(0.85, 0.9, 0.85, 0.65, {
      nspec: { t: 30, h: [], on(f, n) { if (n === 10) { shoot(f, { kind: 'bolt', oy: 5, vx: 3.2, r: 2.2, life: 40, h: { d: 4, a: 361, b: 12, k: 25 } }); beep(900, 0.06, 'square', 0.03, 1.5); } } },
      sspec: { t: 42, once: 1, nodrift: 1, ll: 12, h: [{ f0: 10, f1: 24, x: 5, y: 5, r: 5.5, d: 8, a: 60, b: 45, k: 75 }], on(f, n) { if (n === 10) { lift(f, 1.7); f.vx = f.face * 2.4; } } },
      uspec: { t: 34, helpless: 1, ledge: 1, h: [{ f0: 5, f1: 10, x: 0, y: 6, r: 5, d: 3, a: 90, b: 40, k: 30 }], on(f, n, i) { if (n === 5) { lift(f, 4.3); f.vx = i.lx; } } },
      dspec: SWAP,
    }, { jabs: 2, rapid: 1, grab: { t: 26, h: { f0: 5, f1: 7, x: 6.5, r: 4 } }, dgrab: { t: 34, h: { f0: 7, f1: 9, x: 8.5, r: 4.2 } }, pgrab: { t: 36, h: { f0: 8, f1: 10, x: 9.5, r: 4.2 } },
      throws: { f: { d: 5, b: 45, k: 45 }, b: { d: 6, b: 50, k: 50 }, u: { d: 4, b: 48, k: 28 }, d: { d: 3, a: 70, b: 40, k: 22 } } }),
  }, {
    /* Loom: a kite spirit. Floaty with long ribbons. */
    name: 'Loom', col: ['#7b5cd6', '#f08fc0', '#fdf0ff'], alt: ['#2d7dd2', '#f7d154', '#f0fbff'],
    /* Floaty zoner: light, slow on the ground, drifts well, falls slowly, three small air jumps, long slow ribbon grab. */
    st: { weight: 80, walk: 1.0, dash: 1.7, run: 1.5, airSpeed: 1.16, airAcc: 0.065, grav: 0.062, fall: 1.15, ffall: 1.85, jump: 2.6, shop: 1.6, djump: 2.3, jsq: 3, trac: 0.07, w: 8, h: 15,
      jumps: 3, dashF: 16, roll: [32, 1.15, 14], spot: [24, 16] },
    moves: mk(1.3, 1.0, 1.1, 1.05, {
      nspec: { t: 46, h: [{ f0: 14, f1: 17, x: 14, y: 9, r: 5, d: 7, a: 361, b: 30, k: 80 }, { f0: 14, f1: 17, x: 24, y: 9, r: 5, d: 10, a: 361, b: 30, k: 95 }] },
      sspec: { t: 44, h: [], on(f, n) { if (n === 16) { shoot(f, { kind: 'gust', vx: 1.8, r: 6, life: 45, h: { d: 2, a: 20, b: 70, k: 0 } }); beep(300, 0.2, 'sine', 0.05, 2); } } },
      uspec: { t: 50, helpless: 1, ledge: 1, h: [], on(f, n, i) { if (n === 8) lift(f, 1.9); if (n > 8 && n <= 44) { f.vy = 1.9; f.vx = i.lx * 1.0; } } },
      dspec: SWAP,
    }, { jabs: 1, grab: { t: 44, h: { f0: 12, f1: 15, x: 13, r: 4.5 } }, dgrab: { t: 52, h: { f0: 14, f1: 17, x: 15, r: 4.5 } }, pgrab: { t: 54, h: { f0: 15, f1: 18, x: 16.5, r: 4.5 } },
      throws: { f: { d: 7, a: 40, b: 60, k: 55 }, b: { d: 8, b: 60, k: 60 }, u: { d: 6, a: 90, b: 70, k: 60 }, d: { d: 4, a: 60, b: 50, k: 25 } } }),
  }, {
    /* Hod: a stone-backed badger. Heavy, slow, hits hard. */
    name: 'Hod', col: ['#6d6a75', '#a39171', '#f1f1f1'], alt: ['#8a4f3d', '#3d5a6c', '#f1f1f1'],
    /* Heavy: slow, hard to launch, hits and throws hard, armoured smash and dash attack, poor air movement and recovery. */
    st: { weight: 130, walk: 0.9, dash: 1.6, run: 1.45, airSpeed: 1.07, airAcc: 0.055, grav: 0.12, fall: 1.95, ffall: 3.1, jump: 2.95, shop: 1.8, djump: 2.8, jsq: 3, trac: 0.14, w: 12, h: 13,
      jumps: 1, dashF: 15, roll: [32, 1.15, 12], spot: [24, 14] },
    moves: mk(1.1, 1.3, 1.25, 0.9, {
      nspec: { t: 54, h: [], on(f, n) { if (n === 24) { shoot(f, { kind: 'boulder', oy: 6, vx: 1.5, vy: 0.6, grav: 0.09, r: 4.5, life: 110, ground: 'roll', h: { d: 12, a: 50, b: 40, k: 70 } }); beep(110, 0.15, 'square', 0.06, 0.7); } } },
      sspec: { t: 60, once: 1, nodrift: 1, armor: [10, 34], h: [{ f0: 16, f1: 34, x: 7, y: 6, r: 7, d: 14, a: 45, b: 50, k: 85 }], on(f, n) { if (n >= 16 && n <= 34) { f.vx = f.face * 2.0; if (!f.grounded) f.vy = 0; } if (n === 35) f.vx *= 0.3; } },
      uspec: { t: 44, helpless: 1, ledge: 1, inv: [6, 11], h: [{ f0: 10, f1: 16, x: 0, y: 7, r: 8, d: 13, a: 80, b: 50, k: 85 }], on(f, n, i) { if (n === 10) { lift(f, 4.25); f.vx = i.lx * 1.0; } } },
      dspec: SWAP,
    }, { jabs: 2, grab: { t: 36, h: { f0: 8, f1: 10, x: 9.5, r: 5 } }, armor: { fsmash: [8, 18], dash: [5, 14] },
      throws: { f: { d: 11, b: 60, k: 66 }, b: { d: 13, b: 60, k: 69 }, u: { d: 10, b: 60, k: 90 }, d: { d: 8, a: 60, b: 60, k: 45 } } }),
  }],
};
const ROSTER = [FLINT, WREN];
/* Hitbox positions measured from the animations (hitboxes.js, written with tools/measure.html). Timing, damage and launch stay as defined above. */
if (typeof HITBOXES !== 'undefined') for (const def of ROSTER) for (const fm of def.forms) {
  const set = HITBOXES[fm.name]; if (!set) continue;
  for (const k in set) { const mv = fm.moves[k]; if (mv) set[k].forEach((o, n) => { if (mv.h[n]) Object.assign(mv.h[n], o); }); }
}
/* Reach by archetype (hitbox size only, grabs excluded), and the distance the CPU likes to attack from. */
for (const def of ROSTER) for (const fm of def.forms) {
  if (fm.reachMul) for (const k in fm.moves) { const mv = fm.moves[k]; if (mv && Array.isArray(mv.h)) for (const h of mv.h) if (!h.grab) h.r = Math.round(h.r * fm.reachMul * 10) / 10; }
  const ft = fm.moves.ftilt.h[0]; fm.aiRange = Math.round(ft.x + ft.r * 0.5 + 3);
  fm.aiTempo = fm.moves.ftilt.t / 27;   /* quick fighters attack more often, slow ones less */
  /* How high the up special and an air jump carry, found by running the up special on a stand-in. The CPU uses these so it
     never recovers itself into the top blast zone. */
  const u = fm.moves.uspec, d = { vx: 0, vy: 0, grounded: false, plat: null, face: 1 }; let y = 0, top = 0;
  for (let n = 1; n <= 120; n++) { if (n <= u.t && u.on) u.on(d, n, { lx: 0, ly: 0 }); d.vy = Math.max(d.vy - fm.st.grav, -fm.st.fall); y += d.vy; top = Math.max(top, y); }
  fm.aiRise = top; fm.aiHop = fm.st.djump * fm.st.djump / (2 * fm.st.grav);
}

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
    this.jumps = this.st.jumps || 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ff = false;
    this.wall = 0; this.wallT = 0; this.wallJumps = 0; this.sdi = 0; this.airT = 0; this.rapidN = 0; this.aim = 0;
    this.pct = 0; this.shieldHp = 50; this.invuln = 0; this.hitlag = 0; this.hitstun = 0; this.ledgeCd = 0; this.dropT = 0; this.dropPlat = null;
    this.move = null; this.mf = 0; this.charge = 0; this.hitG = new Set(); this.parriedBy = null; this.victim = null; this.lag = 0; this.flash = 0;
    this.stale = []; this.staled = false; this.staleM = 1; this.shortHop = false; this.moveSH = false; this.shMacro = false; this.grabImm = 0; this.ledgeGrabs = 0;
    this.dodgeStale = 0; this.dodgeT = 0; this.ds = 0; this.tumble = false; this.techT = 0; this.techLock = 0; this.pumT = 0; this.wdHold = false;
  }
  /* Dodges used back to back protect for less time and leave more lag. */
  dodge() { this.ds = this.dodgeStale; this.dodgeStale = Math.min(5, this.dodgeStale + 1); this.dodgeT = 0; }
  set(s) { this.state = s; this.sf = 0; }
  startMove(n) {
    const m = this.form.moves[n]; this.move = m; this.mname = n; this.mf = 0; this.charge = 0; this.aim = 0; if (!m.rapid) this.rapidN = 0; this.hitG = new Set(); this.parriedBy = null; this.staled = false; this.moveSH = !!(m.air && this.shortHop); this.set('attack');
    if (m.once && !this.grounded) this.sideUsed = true;
  }
  endMove() {
    const m = this.move, i = this.ctl.c; this.move = null;
    if (this.grounded) { this.set('idle'); if (m.tilt && Math.abs(i.lx) > T.dash_stick_x) { this.face = sgn(i.lx); this.set('dash'); } }
    else this.set(m.helpless ? 'helpless' : 'air');
  }
  /* Recoil from a clank: the attack is cut off and the fighter is pushed back for a moment. */
  rebound(d) { this.move = null; this.charge = 0; this.lag = Math.round(12 + d * 0.7); this.vx = -this.face * 0.7; this.set('rebound'); }
  /* Jumped on from above: squashed for a moment on the ground, knocked downward in the air. */
  footstooled() {
    this.freeVictim(); this.move = null; this.charge = 0;
    if (this.grounded) { this.lag = 22; this.set('land'); }
    else { this.vy = -1.5; this.vx *= 0.3; this.hitstun = 34; this.tumble = true; this.ff = false; this.set('hurt'); }
  }
  freeVictim() { const v = this.victim; if (v) { this.victim = null; if (v.state === 'held') { v.set('air'); v.vy = 1; v.vx = this.face * 0.8; v.grabImm = 60; } } }
  drop() { this.ctl.buf.shd = 0; this.dropPlat = this.plat; this.grounded = false; this.plat = null; this.dropT = 14; this.vy = -0.7; this.ff = false; this.set('air'); }
  doSpecial() {
    const i = this.ctl.c; let n = 'nspec';
    if (Math.abs(i.lx) > 0.5 && Math.abs(i.lx) >= Math.abs(i.ly)) { this.face = sgn(i.lx); n = (!this.grounded && this.sideUsed) ? 'nspec' : 'sspec'; }
    else if (i.ly > 0.5) n = 'uspec'; else if (i.ly < -0.5) n = 'dspec';
    /* Turnaround special: holding back turns the fighter round first; in the air a neutral special also reverses its drift. */
    if (n !== 'sspec' && Math.abs(i.lx) > 0.35 && sgn(i.lx) !== this.face) { this.face = sgn(i.lx); if (n === 'nspec' && !this.grounded) this.vx = -this.vx * 0.9; }
    this.startMove(n);
  }
  aerial(x, y) { if (Math.abs(y) > 0.5 && Math.abs(y) >= Math.abs(x)) return y > 0 ? 'uair' : 'dair'; if (Math.abs(x) > 0.3) return sgn(x) === this.face ? 'fair' : 'bair'; return 'nair'; }
  groundAttack(moving) {
    const c = this.ctl, i = c.c; let n;
    const fwd = Math.abs(i.lx) > 0.3 && Math.abs(i.lx) > Math.abs(i.ly) * 1.6;   /* mostly sideways counts as forward, angled by the rest */
    if (moving && i.lx * this.face < -0.5 && Math.abs(i.ly) < 0.5) { this.face = -this.face; this.vx *= 0.4; n = c.xSmash ? 'fsmash' : 'ftilt'; }   /* attacking while turning out of a run: a turnaround tilt or smash, not a dash attack */
    else if (moving && this.state === 'dash' && this.sf <= 5 && c.xSmash && Math.abs(i.ly) < 0.5) n = 'fsmash';
    else if (moving && Math.abs(i.ly) < 0.5) n = 'dash';
    else if (i.ly > 0.5 && !fwd) n = c.ySmash ? 'usmash' : 'utilt';
    else if (i.ly < -0.5 && !fwd) n = c.ySmash ? 'dsmash' : 'dtilt';
    else if (Math.abs(i.lx) > 0.3) { this.face = sgn(i.lx); n = c.xSmash ? 'fsmash' : 'ftilt'; }
    else n = 'jab';
    this.startMove(n);
    if (n === 'ftilt') this.aim = i.ly > 0.25 ? 1 : i.ly < -0.25 ? -1 : 0;   /* a forward tilt can be angled up or down */
    if (n === 'dash') this.vx = this.face * this.st.run; else if (n === 'fsmash') this.vx *= 0.3;
  }
  groundActs(moving) {
    const c = this.ctl, i = c.c;
    if (c.take('grb') || (i.shd && c.take('atk'))) {
      if (moving && i.lx * this.face < -0.5) { this.face = -this.face; this.vx *= 0.5; this.startMove('pgrab'); }
      else this.startMove(moving ? 'dgrab' : 'grab');
      return true;
    }
    if (c.take('spc')) { this.doSpecial(); return true; }
    /* Jump and attack pressed together: a short-hop aerial (the attack stays buffered for the jump). */
    if (c.buf.jmp > 0 && c.buf.atk > 0 && Math.abs(c.buf.jmp - c.buf.atk) <= 1) { c.buf.jmp = 0; this.set('jsq'); return true; }
    if (c.take('atk')) { this.groundAttack(moving); return true; }
    if (c.cPress) { if (Math.abs(i.cy) > Math.abs(i.cx)) this.startMove(i.cy > 0 ? 'usmash' : 'dsmash'); else { this.face = sgn(i.cx); this.startMove('fsmash'); } this.vx *= 0.3; return true; }
    if (c.take('jmp')) { this.set('jsq'); return true; }
    if (i.shd && !this.wdHold) { c.buf.shd = 0; this.set('shield'); return true; }
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
    if (c.buf.jmp > 0) {   /* footstool: a jump pressed right on top of the opponent springs off their head and costs no air jump */
      const o = F[1 - this.idx];
      if (o && canBeHit(o) && o.state !== 'ledge' && this.vy <= 0.6 && Math.abs(this.x - o.x) < o.st.w / 2 + 2.5 && this.y >= o.y + o.st.h - 3 && this.y <= o.y + o.st.h + 4.5) {
        c.buf.jmp = 0; this.vy = s.jump * 0.92; this.ff = false; this.shortHop = false; this.y = Math.max(this.y, o.y + o.st.h);
        o.footstooled(); spark(this.x, this.y, '#fff', 12, 1.4); pop(this.x, this.y + 8, 'STOMP', '#fff'); beep(640, 0.07, 'triangle', 0.05, 1.5); return false;
      }
    }
    /* wall jump (only some fighters): flick away from a wall just touched */
    if (s.wallJump && this.wallT > 0 && c.dashDir === this.wall && this.wallJumps < 2) {
      this.wallJumps++; this.wallT = 0; this.vy = s.jump * 0.92; this.vx = this.wall * 1.5; this.face = this.wall; this.ff = false;
      spark(this.x - this.wall * 3, this.y + 4, '#fff', 10, 1.2); beep(560, 0.05, 'sine', 0.04, 1.4); return false;
    }
    if (c.buf.jmp > 0 && this.jumps > 0) { c.buf.jmp = 0; this.jumps--; this.shortHop = false; this.vy = s.djump * (1 - 0.1 * Math.max(0, (s.jumps || 1) - 1 - this.jumps)); if (Math.abs(i.lx) > 0.2) this.vx = i.lx * s.airSpeed; this.ff = false; spark(this.x, this.y, '#fff', 6, 0.8); beep(500, 0.05, 'sine', 0.03, 1.4); }
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
    this.ctl.buf.shd = 0; this.wdHold = true; this.vx = sgn(i.lx) * sp; this.vy = 0; this.move = null; this.set('wd'); spark(this.x, this.y, '#cfd8ff', 8, 0.9);
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
  touchDown(p) { this.grounded = true; this.plat = p; this.y = p.y; this.vy = 0; this.wallJumps = 0; this.jumps = this.st.jumps || 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ledgeGrabs = 0; this.ff = false; this.shortHop = false; }
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
    if (s === 'shield' || s === 'shieldstun' || s === 'shieldoff' || s === 'hold' || s === 'throw' || s === 'roll' || s === 'spot' || s === 'broken' || s === 'jsq' || s === 'down' || s === 'rebound') return false;
    if (this.plat.soft) return true;
    return s === 'idle' ? Math.abs(this.ctl.c.lx) > 0.2 : (s === 'dash' || s === 'run' || s === 'brake' || s === 'hurt' || s === 'wd');
  }
  breakShield() { this.shieldHp = 30; this.grounded = false; this.plat = null; this.vy = 3.2; this.vx = 0; this.set('broken'); spark(this.x, this.y + 8, '#9cf', 30, 2.4); beep(200, 0.4, 'sawtooth', 0.08, 0.3); shake = 10; }
  launch(kb, ang, dir, lsi) {
    this.freeVictim(); const sp = kb * 0.03 * (lsi || 1); this.sdi = 0; this.tumble = kb >= TUMBLE_KB; this.ledgeGrabs = 0; this.shortHop = false; this.vx = Math.cos(ang) * sp * dir; this.vy = Math.sin(ang) * sp;
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
    if (!i.shd) this.wdHold = false;   /* the shield press that made a wavedash does not turn into a shield while still held */
    if (this.grabImm > 0) this.grabImm--; if (this.wallT > 0) this.wallT--; if (this.techT > 0) this.techT--; if (this.techLock > 0) this.techLock--;
    if (c.pressed('shd')) { if (this.techLock === 0) this.techT = 20; this.techLock = 40; }
    if (this.grounded || this.state === 'ledge' || this.state === 'respawn') this.airT = 0; else this.airT++;   /* frames since last standing on something */
    if (TAPJUMP[c.dev] && c.upNow && TAP_STATES[this.state]) c.buf.jmp = T.buffer;
    if (this.dodgeStale > 0 && ++this.dodgeT >= 90) { this.dodgeStale--; this.dodgeT = 0; }
    if (this.state !== 'shield' && this.state !== 'shieldstun' && this.shieldHp < SHIELD.hp) this.shieldHp = Math.min(SHIELD.hp, this.shieldHp + SHIELD.regen);
    if (this.hitlag > 0) {
      /* While frozen by a hit, up to three stick flicks nudge the victim a little: a way to shift out of multi-hits and change where a launch starts. */
      if (this.state === 'hurt' && this.sdi < 3) { const dx = c.dashDir, dy = c.upNow ? 1 : c.downNow ? -1 : 0; if (dx || dy) { this.sdi++; this.x += dx * 1.1; if (!this.grounded) this.y += dy * 1.1; } }
      this.hitlag--; return;
    }
    this.sf++; const s = this.st;
    switch (this.state) {
      case 'idle':
        if (this.groundActs(false)) break;
        if (Math.abs(i.lx) > 0.2) { this.face = sgn(i.lx); this.vx = appr(this.vx, i.lx * s.walk, 0.2); } else this.vx = appr(this.vx, 0, s.trac);
        break;
      case 'dash':
        this.vx = this.face * s.dash; if (this.groundActs(true)) break;
        if (this.sf >= (s.dashF || 14)) this.set(sgn(i.lx) === this.face && Math.abs(i.lx) > 0.6 ? 'run' : 'idle');
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
        if (this.sf >= s.jsq) { this.grounded = false; this.plat = null; this.jumps = s.jumps || 1; this.shortHop = !(i.jmp || (TAPJUMP[c.dev] && i.ly > 0.6)) || this.shMacro; this.vy = this.shortHop ? s.shop : s.jump; if (Math.abs(i.lx) > 0.2) this.vx = clamp(this.vx + i.lx * 0.4, -s.airSpeed * 1.4, s.airSpeed * 1.4); else this.vx = clamp(this.vx, -s.airSpeed, s.airSpeed); this.set('air'); beep(420, 0.05, 'sine', 0.03, 1.5); if (this.shMacro) { this.shMacro = false; if (c.take('atk')) this.startMove(this.aerial(i.lx, i.ly)); } }
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
        if (m.inv && this.mf === m.inv[0]) this.invuln = Math.max(this.invuln, m.inv[1] - m.inv[0]);   /* some moves cannot be hit for a few frames */
        if (m.on) m.on(this, this.mf, i);
        /* jab chain: attack again once the jab allows it and the next hit comes out */
        /* rapid jab: loops while attack is held (three at least, fourteen at most), then the finisher */
        if (this.state === 'attack' && m.rapid && this.mf >= m.t) { const n = this.rapidN + 1; if ((i.atk || n < 3) && n < 14 && this.grounded) { this.startMove(this.mname); this.rapidN = n; } else if (this.grounded) this.startMove(m.next); else this.endMove(); break; }
        if (this.state === 'attack' && m.next && this.grounded && this.mf >= m.chain && (c.take('atk') || (i.atk && this.mf >= m.chain + 2))) { this.startMove(m.next); break; }
        if (this.state === 'attack' && this.mf >= m.t) this.endMove();
        break;
      }
      case 'shield':
        c.buf.shd = 0; this.vx = appr(this.vx, 0, s.trac * 1.5); this.shieldHp -= SHIELD.drain; if (this.shieldHp <= 0) { this.breakShield(); break; }
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
      case 'spot': { const sp = s.spot || [22, 15]; this.vx = 0; if (this.sf === 3) this.invuln = Math.max(this.invuln, sp[1] - this.ds * 2); if (this.sf >= sp[0] + this.ds * 3) this.set('idle'); break; }
      case 'rebound': this.vx = appr(this.vx, 0, s.trac); if (this.sf >= this.lag) this.set('idle'); break;
      case 'roll': {
        const r = s.roll || [28, 1.35, 13];   /* total frames, speed, frames it cannot be hit */
        this.vx = this.sf >= 3 && this.sf <= r[0] - 6 ? this.rollDir * r[1] : 0; if (this.sf === 4) this.invuln = Math.max(this.invuln, r[2] - this.ds * 2);
        if (this.sf >= r[0] + this.ds * 3) { this.face = -this.rollDir; this.vx = 0; this.set('idle'); }
        break;
      }
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
          v.launch(knock(v, d, h.b, h.k) * rage(this), h.a * Math.PI / 180, this.face); v.hitlag = 6; this.hitlag = 6; spark(v.x, v.y + 8, '#fff', 12, 1.6); thwack(90);
        }
        if (this.sf >= 26) this.set('idle');
        break;
      }
      case 'ledge': {
        const side = sgn(this.x); this.vx = this.vy = 0;
        if (this.sf > 8) {
          const toward = -side * i.lx, slow = this.pct >= 100;   /* worn down: every way up is slower and less protected */
          if (c.take('jmp')) { this.vy = s.jump * 1.05; this.vx = -side * 0.7; this.ledgeCd = 30; this.set('air'); }
          else if (i.shd) { this.x = side * 58; this.touchDown(MAIN); this.ledgeUsed = true; this.lag = slow ? 26 : 18; this.invuln = slow ? 20 : 18; this.set('land'); }
          else if (c.take('atk')) { this.x = side * 74; this.touchDown(MAIN); this.ledgeUsed = true; this.startMove('getup'); if (slow) this.mf = -8; }
          else if (toward > 0.5 || i.ly > 0.5) { this.x = side * 75; this.touchDown(MAIN); this.ledgeUsed = true; this.lag = slow ? 22 : 14; this.invuln = slow ? 16 : 14; this.set('land'); }
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
      else {
        const side = px < 0 ? -1 : 1; this.x = side * (80 + hw);
        if (st === 'hurt') {
          /* Launched into the stage wall: shield just before impact to tech it (hold jump or up to spring off), otherwise bounce. */
          if (this.techT > 0 && Math.abs(this.vx) > 0.8) {
            this.techT = 0; this.vx = 0; this.vy = Math.max(this.vy, 0); this.invuln = 14; this.set('air');
            if (i.jmp || i.ly > 0.5) { this.vy = s.jump * 0.9; this.vx = side * 1.1; }
            spark(this.x, this.y + s.h / 2, '#9ff', 12, 1.4); pop(this.x, this.y + s.h + 4, 'TECH', '#9ff'); beep(900, 0.05, 'triangle', 0.04);
          } else { if (Math.abs(this.vx) > 1.5) spark(this.x, this.y + s.h / 2, '#ddd', 8, 1.2); this.vx = -this.vx * 0.7; }
        } else { this.vx = 0; this.wall = side; this.wallT = 8; }
      }
    }
    /* Ledges. */
    if (this.vy < 0 && this.ledgeCd === 0 && i.ly > -0.5 && (st === 'air' || st === 'helpless' || (st === 'attack' && this.move && this.move.ledge))) {
      const side = sgn(this.x), out = Math.abs(this.x) - 80, hand = this.y + s.h, o = F[1 - this.idx];
      if (side && out > -1 && out < 13 && hand > -9 && hand < 9 && this.ledgeGrabs < 6) {
        if (o && o.state === 'ledge' && sgn(o.x) === side) { o.set('air'); o.vy = 1.3; o.vx = side * 0.9; o.ledgeCd = 45; o.invuln = 0; pop(o.x, o.y + 20, 'TRUMP', '#fff'); }
        this.ledgeGrabs++; this.shortHop = false;
        this.x = side * (80 + hw + 0.5); this.y = -s.h + 1; this.vx = this.vy = 0; this.face = -side; this.move = null; this.ff = false;
        this.jumps = s.jumps || 1; this.wallJumps = 0; this.airdodged = false; this.sideUsed = false; if (!this.ledgeUsed) { this.invuln = clamp(Math.round(24 + Math.min(this.airT, 300) * 0.1 - Math.min(this.pct, 120) * 0.17), 8, 54); this.ledgeUsed = true; }   /* longer in the air earns more, damage takes it away */
        this.set('ledge'); beep(700, 0.04, 'triangle', 0.03);
      }
    }
  }
}

/* ---------- Combat ---------- */
const AIM_Y = 3.2;   /* how far an angled forward tilt lifts or lowers its hitbox */
function hitY(a, h) { return a.y + h.y + (a.aim || 0) * AIM_Y; }
function knock(v, d, b, k) { const p = v.pct; return ((((p / 10 + p * d / 20) * 200 / (v.st.weight + 100) * 1.4) + 18) * k / 100) + b; }
function circRect(cx, cy, r, x0, y0, x1, y1) { const dx = cx - clamp(cx, x0, x1), dy = cy - clamp(cy, y0, y1); return dx * dx + dy * dy <= r * r; }
/* The body's hittable box. It shrinks when crouching or lying down, which is how a crouch slips under high attacks. */
function hurtRect(v) {
  const st = v.st; let w = st.w, h = st.h;
  if (v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y) h *= 0.62;
  else if (v.state === 'down') { h *= 0.42; w *= 1.4; }
  else if (v.state === 'jsq' || v.state === 'land') h *= 0.86;
  return [v.x - w / 2, v.y, v.x + w / 2, v.y + h];
}
/* The shield bubble shrinks as the shield wears down and can be shifted a little with the stick, so a worn shield leaves
   the head or feet uncovered unless it is tilted to cover them. */
const SHIELD_TILT = 3;
function shieldCircle(v) { const i = v.ctl.c; return [v.x + clamp(i.lx, -1, 1) * SHIELD_TILT, v.y + v.st.h / 2 + clamp(i.ly, -1, 1) * SHIELD_TILT, 4 + v.shieldHp / SHIELD.hp * 6]; }
/* Does an attack centred at (hx, hy) reach a part of a shielding fighter's body that the bubble does not cover? */
function pokes(v, hx, hy) {
  if (v.state !== 'shield' && v.state !== 'shieldstun') return false;
  const [x0, y0, x1, y1] = hurtRect(v), [sx, sy, sr] = shieldCircle(v), px = clamp(hx, x0, x1), py = clamp(hy, y0, y1);
  return Math.hypot(px - sx, py - sy) > sr + 0.5;
}
/* Would this launch carry the victim past a blast zone before it could recover? Used only for the lethal-hit effect. */
function wouldKO(v) {
  if (v.grounded) return false;
  let x = v.x, y = v.y, vx = v.vx, vy = v.vy;
  for (let n = 0; n < v.hitstun + 30; n++) {
    if (n < v.hitstun) { const sp = Math.hypot(vx, vy); if (sp > 0.051) { const k = (sp - 0.051) / sp; vx *= k; vy *= k; } vy -= v.st.grav; }
    else { vx *= 0.96; vy = Math.max(vy - v.st.grav, -v.st.fall); }
    x += vx; y += vy;
    if (x < BLAST.l || x > BLAST.r || y > BLAST.t || y < BLAST.b) return true;
    if (n > 2 && vy <= 0 && y <= 0 && Math.abs(x) <= 80) return false;
  }
  return false;
}
let slowT = 0, focus = null;   /* slow motion and camera focus after a hit that will take the last stock */
function canBeHit(v) { return v.invuln === 0 && v.state !== 'dead' && v.state !== 'respawn' && v.state !== 'held'; }
function applyHit(a, v, h, face, srcX, proj, poke) {
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
  if (poke) pop(hx, hy + 12, 'POKE', '#9cf');   /* the hit found a part of the body the shield no longer covers */
  if ((v.state === 'shield' || v.state === 'shieldstun') && !poke) {
    v.shieldHp -= d * SHIELD.dmg;
    const sm = proj ? SHIELD.stun.proj : a.move && a.move.air ? SHIELD.stun.air : a.move && a.move.chg ? SHIELD.stun.smash : SHIELD.stun.ground;
    if (v.shieldHp <= 0) v.breakShield(); else { v.stunT = Math.floor(d * sm) + 2; v.set('shieldstun'); v.vx = (sgn(v.x - srcX) || face) * (0.3 + d * 0.04); }
    const hl = Math.min(20, Math.floor((d * 0.65 + 6) * 0.67)); v.hitlag = hl; if (!proj) a.hitlag = hl;
    spark(hx, hy, '#9cf', 6, 1); beep(400, 0.05, 'triangle', 0.04); return;
  }
  v.pct = Math.min(999, v.pct + d); v.flash = 6;
  const crouch = v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y, charging = v.state === 'attack' && v.charge > 0;
  const kb = knock(v, d, h.b, h.k) * rage(a) * (crouch ? CROUCH_MUL : 1) * (charging ? CHARGING_MUL : 1);
  const hl = h.hl !== undefined ? h.hl : Math.min(30, Math.floor((d * 0.65 + 6) * (crouch ? 0.67 : 1)));
  if (v.state === 'attack' && v.move && v.move.armor && v.mf >= v.move.armor[0] && v.mf <= v.move.armor[1] && kb < 95) { v.hitlag = hl; if (!proj) a.hitlag = hl; spark(hx, hy, '#ccc', 8, 1); beep(150, 0.06, 'square', 0.05); return; }
  /* 361 is the "natural" angle: flat along the ground for weak hits, steeper as the hit gets stronger, 45 in the air. */
  let deg = h.a !== 361 ? h.a : !v.grounded ? 45 : kb < 60 ? 0 : kb >= 88 ? 38 : (kb - 60) / 28 * 38;
  if (!proj && a.aim) deg = Math.max(0, deg + a.aim * 8);   /* an angled tilt sends a little higher or lower */
  let ang = deg * Math.PI / 180;
  const dir = h.away ? (sgn(v.x - srcX) || face) : face;
  /* Directional influence: the stick bends the launch up to about 10 degrees. */
  const i = v.ctl.c, lx = Math.cos(ang) * dir, ly = Math.sin(ang), perp = i.lx * -ly + i.ly * lx;
  ang += perp * 0.17 * (dir > 0 ? 1 : -1);
  /* Holding up or down stretches or shortens the launch, except for near-vertical ones. */
  const nd = ((ang * 180 / Math.PI) % 360 + 360) % 360, vertical = (nd > 65 && nd < 115) || (nd > 245 && nd < 295);
  const lsi = vertical ? 1 : i.ly > 0.5 ? 1.095 : i.ly < -0.5 ? 0.92 : 1;
  v.launch(kb, ang, dir, lsi); v.hitlag = hl; if (!proj) a.hitlag = hl; rumble(v.ctl, 60 + kb, Math.min(1, 0.25 + kb / 150)); rumble(a.ctl, 50, 0.25);
  if (wouldKO(v)) {   /* a hit that will KO lands harder: longer freeze, a bigger burst, and slow motion if it takes the last stock */
    v.hitlag += 8; if (!proj) a.hitlag += 8; shake = Math.max(shake, 14); rumble(v.ctl, 300, 1);
    spark(hx, hy, '#ff5a4d', 40, 4.2); spark(hx, hy, '#ffe9a8', 24, 2.6); beep(70, 0.5, 'sawtooth', 0.11, 0.5);
    if (v.stocks === 1) { slowT = 54; focus = { x: hx, y: hy }; }
  }
  spark(hx, hy, kb > 110 ? '#ffd166' : '#fff', Math.min(40, 6 + kb / 6 | 0), 1 + kb / 80);
  if (kb > 110) shake = Math.max(shake, 8);
  thwack(kb);
}
function resolveHits() {
  const ev = [];
  /* Attacks meeting attacks. Two ground attacks whose hitboxes touch cancel out, with both fighters recoiling, when their
     damage is within 9 of each other; otherwise only the weaker one recoils. An attack that touches an enemy projectile
     no more than 9 stronger than it puts the projectile out. */
  const live = f => f.state === 'attack' && f.move ? f.move.h.filter(h => !h.grab && f.mf >= h.f0 && f.mf <= h.f1) : [];
  if (F.length === 2 && F[0].grounded && F[1].grounded && F[0].hitlag === 0 && F[1].hitlag === 0) {
    const [a, b] = F;
    clank: for (const h0 of live(a)) for (const h1 of live(b)) {
      const dx = (a.x + h0.x * a.face) - (b.x + h1.x * b.face), dy = hitY(a, h0) - hitY(b, h1);
      if (dx * dx + dy * dy > (h0.r + h1.r) * (h0.r + h1.r)) continue;
      const mx = (a.x + h0.x * a.face + b.x + h1.x * b.face) / 2, my = (hitY(a, h0) + hitY(b, h1)) / 2, diff = h0.d - h1.d;
      if (diff < 9) a.rebound(h1.d); if (diff > -9) b.rebound(h0.d);
      spark(mx, my, '#fff', 16, 1.8); pop(mx, my + 8, 'CLANK', '#fff'); beep(1000, 0.06, 'square', 0.05, 0.7); shake = Math.max(shake, 5);
      break clank;
    }
  }
  for (const p of PROJ) {
    const a = F[1 - p.owner]; if (p.life <= 0 || !a) continue;
    for (const h of live(a)) { const dx = a.x + h.x * a.face - p.x, dy = hitY(a, h) - p.y; if (dx * dx + dy * dy <= (h.r + p.r) * (h.r + p.r) && h.d + 9 >= p.h.d) { p.life = 0; spark(p.x, p.y, '#fff', 8, 1.2); beep(700, 0.04, 'triangle', 0.04); break; } }
  }
  for (const a of F) {
    const v = F[1 - a.idx];
    if (a.state === 'attack' && a.move && canBeHit(v)) {
      for (const h of a.move.h) {
        if (a.mf < h.f0 || a.mf > h.f1) continue; const gid = h.g || 0; if (a.hitG.has(gid)) continue;
        if (h.grab && (!a.grounded || v.grabImm > 0)) continue;
        if (circRect(a.x + h.x * a.face, hitY(a, h), h.r, ...hurtRect(v))) { ev.push([a, v, h, a.face, a.x, false, !h.grab && pokes(v, a.x + h.x * a.face, hitY(a, h))]); a.hitG.add(gid); break; }
      }
    }
  }
  for (const p of PROJ) {
    const v = F[1 - p.owner];
    if (p.life > 0 && canBeHit(v) && circRect(p.x, p.y, p.r, ...hurtRect(v))) { ev.push([F[p.owner], v, p.h, p.face, p.x, true, pokes(v, p.x, p.y)]); p.life = 0; }
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
  if (f.state === 'hurt' && f.tumble && !f.grounded) {   /* decide once per launch whether to tech, then shield just above the floor */
    if (f.sf <= 1) m.tech = Math.random() < 0.55;
    /* only when it really is about to land, still in hitstun: a shield press that misses the floor would come out as an air dodge */
    const nx = f.x + f.vx * 3;
    if (m.tech && f.vy < 0 && f.techLock === 0 && f.hitstun - f.sf > 4 && PLATS.some(q => nx >= q.x0 + 2 && nx <= q.x1 - 2 && f.y - q.y > 0 && f.y - q.y < -f.vy * 3 + 0.5)) i.shd = true;
  }
  if (f.state === 'attack' && f.move && f.move.rapid) { i.atk = f.rapidN < 6 && ad < 16; return i; }
  if (f.state === 'attack' && f.move && f.move.next && f.mf >= f.move.chain && ad < 18) { i.atk = m.t % 2 === 0; return i; }
  if (f.state === 'held') { i.grb = m.t % 2 === 0; i.lx = m.t % 4 < 2 ? 1 : -1; return i; }   /* mash out with the stick and the grab button: a buffered attack or jump would come out the moment it breaks free */
  if (f.state === 'down') { if (f.sf > 24) { const r = m.t % 3; if (r === 0) i.ly = 1; else if (r === 1) i.lx = -dir; else i.atk = true; } return i; }
  if (f.state === 'ledge') { if (f.sf > 20) { if (m.t % 2) i.lx = -sgn(f.x); else i.jmp = true; } return i; }
  if (f.state === 'hold') { if (f.sf > 16) { const r = m.t % 4; if (r === 0) i.lx = f.face; else if (r === 1) i.lx = -f.face; else if (r === 2) i.ly = 1; else i.ly = -1; } return i; }
  if (!f.grounded && (Math.abs(f.x) > 84 || f.y < -3)) {
    /* Getting back. Never drift in under the stage: when below its top and inside its edge, steer back out first.
       Use the side special only while still high and far out, the air jumps on the way down, and the up special last,
       pressed with the stick only slightly toward the stage so it is not read as a side special. */
    const side = sgn(f.x) || 1, edge = 80 + f.st.w / 2 + 2, under = f.y + f.st.h < -BODY_H + 4 && Math.abs(f.x) < edge, far = Math.abs(f.x) - 80;
    i.lx = under ? side : (f.y > -3 || Math.abs(f.x) > edge + 1) ? -side : 0;   /* beside the wall and below the lip: stay off it and let the ledge or a jump do the work */
    if (f.state !== 'air' || m.t % 5 !== 0) return i;
    if (!f.sideUsed && f.form.moves.sspec.once && far > 36 && f.y > 14) { i.lx = -side; i.spc = true; return i; }
    if (f.vy < 0 && !under) {
      const roof = BLAST.t - 28;   /* when launched high, fall first: rising from up there would go out through the top */
      if (f.jumps > 0) { if ((f.y < 8 || far > 50) && f.y + f.form.aiHop < roof) i.jmp = true; }
      else if ((f.y < -4 || far > 40) && f.y + f.form.aiRise < roof) { i.lx = -side * 0.35; i.ly = 1; i.spc = true; }
    }
    return i;
  }
  if (o.state === 'dead' || o.state === 'respawn') { if (Math.abs(f.x) > 20) i.lx = -sgn(f.x) * 0.5; return i; }
  if (f.grounded && o.state === 'attack' && ad < 24 && Math.abs(dy) < 20) { if (m.def == null) m.def = Math.random() < 0.45; if (m.def) { i.shd = true; return i; } } else m.def = null;
  if (f.grounded) {
    /* The opponent is off stage: hold the ledge instead of following them out, and swing as they come back. */
    if ((Math.abs(o.x) > 84 || o.y < -5) && Math.abs(f.x) > 58 && sgn(f.x) === sgn(o.x)) {
      if (f.face !== dir) i.lx = dir * 0.5; else if (m.cd === 0 && ad < (f.form.aiRange || 14) + 6 && Math.abs(dy) < 14) { i.cx = dir; m.cd = 55; }
      return i;
    }
    if (dy > 16 && ad < 34) { if (m.cd === 0) { i.jmp = true; m.cd = 22; } i.lx = ad > 6 ? dir : 0; return i; }
    if (dy < -10 && f.plat && f.plat.soft) { if (m.t % 12 < 6) i.ly = -1; return i; }
    if (m.cd === 0 && f.form.aiShot && ad > 40 && ad < 110 && Math.abs(dy) < 10 && f.face === dir && Math.random() < 0.04) { i.spc = true; m.cd = 50; return i; }
    if (f.def.forms.length > 1 && !f.noSwap && m.cd === 0 && ad > 45 && Math.random() < 0.012) { i.ly = -1; i.spc = true; m.cd = 70; return i; }   /* swap companion at a safe distance */
    if (ad > (f.form.aiRange || 14)) { i.lx = dir; return i; }
    if (f.face !== dir) { i.lx = dir * 0.5; return i; }
    if (m.cd === 0 && (o.state === 'shield' || o.state === 'shieldstun') && f.form.moves.grab.h[0].f0 <= 9 && ad < f.form.moves.grab.h[0].x + 3 && Math.abs(dy) < 6 && Math.random() < 0.6) { i.grb = true; m.cd = 36; return i; }   /* a shield is there to be grabbed, by those whose grab is quick enough */
    if (m.cd === 0) {
      const r = Math.random(); m.cd = Math.round((22 + (Math.random() * 30 | 0)) * (f.form.aiTempo || 1));
      if (dy > 8) { if (r < 0.5) { i.ly = 1; i.atk = true; } else i.cy = 1; }
      else if (r < 0.25) i.atk = true; else if (r < 0.45) { i.lx = dir * 0.5; i.atk = true; } else if (r < 0.6) i.cx = dir;
      else if (r < 0.72) i.grb = true; else if (r < 0.84) i.spc = true; else if (r < 0.92) { i.ly = -0.9; i.atk = true; } else i.jmp = true;
    }
    return i;
  }
  i.lx = ad > 6 ? dir : 0;
  if (Math.abs(f.x) > 66) { i.lx = -sgn(f.x); return i; }   /* airborne near the edge: drift back over the stage, no attacks */
  if (m.cd === 0 && f.state === 'air') {
    const mv = f.form.moves, lead = n => mv[n].h[0].f0 + 1, at = n => { const t = lead(n); return [dx + (o.vx - f.vx) * t, dy + (o.vy - f.vy) * t + (o.grounded ? 0.5 * f.st.grav * t * t : 0)]; };
    const up = at('uair'), dn = at('dair'), fw = at('fair'), room = f.y + f.vy * mv.fair.h[0].f1 > 3 || o.y > 6;
    if (Math.abs(up[0]) < 8 && up[1] > 5 && up[1] < 22) { m.cd = 30; i.cy = 1; }
    else if (Math.abs(dn[0]) < 6 && dn[1] < -11 && dn[1] > -26 && f.vy > -0.7) { m.cd = 40; i.cy = -1; }   /* only with room to finish the attack before landing */
    else if (Math.abs(fw[0]) < (f.form.aiRange || 14) + 2 && Math.abs(fw[1]) < 8 && room) { m.cd = 30; i.cx = sgn(fw[0]) || dir; }
  }
  if (dy > 20 && f.jumps > 0 && f.vy < 0 && m.t % 20 === 0 && f.y + f.form.aiHop < BLAST.t - 28) i.jmp = true;
  return i;
}

/* ---------- Game flow ---------- */
let sudden = false;
let tick = 0;   /* counts every step of a match, countdown and finish included; drives idle loops and follow-through, never gameplay */
let mode = 'select', frame = 0, timer = MATCH_FRAMES, countdown = 0, paused = false, overT = 0, result = '';
let slots = [null, null], DEVS = {};
const cam = { x: 0, y: 30, s: 3.4 };
function devCtl(dev) { return DEVS[dev] || (DEVS[dev] = new Ctl(dev)); }
function allDevs() { const d = ['kb']; const gp = navigator.getGamepads ? navigator.getGamepads() : []; for (let n = 0; n < gp.length && n < 4; n++) if (gp[n]) d.push('pad' + n); return d; }
function startMatch() {
  const s0 = slots[0], s1 = slots[1] || { dev: 'cpu', pick: Math.random() * ROSTER.length | 0 };
  const c0 = devCtl(s0.dev), c1 = s1.dev === 'cpu' ? new Ctl('cpu') : devCtl(s1.dev);
  F = [new Fighter(0, ROSTER[s0.pick], c0, false), new Fighter(1, ROSTER[s1.pick], c1, s1.pick === s0.pick)];
  PROJ = []; PART = []; POPS = []; timer = MATCH_FRAMES; sudden = false; slowT = 0; focus = null; countdown = 190; paused = false; mode = 'countdown'; cam.x = 0; cam.y = 30; cam.s = 3.4;
}
function stepSelect() {
  for (const dev of allDevs()) {
    const c = devCtl(dev); c.poll(readDev(dev));
    if (c.pressed('sel') && dev !== 'kb') { toggleLayout(dev); beep(520, 0.05, 'square', 0.03); }
    if (c.pressed('jmp')) { toggleTapJump(dev); beep(TAPJUMP[dev] ? 620 : 380, 0.05, 'square', 0.03); }
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
  if (slowT > 0) { slowT--; if (slowT % 3) return; }   /* one step in three while the finishing hit plays out */
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
/* Camera numbers, in stage units. padX/padUp/padDown: room kept round each fighter. min/max: how far out and in it may zoom
   (pixels per unit). lx/ly: how far off stage a fighter is still followed. ex/ey: the furthest the edge of the view may reach. */
const CAM = { padX: 30, padUp: 34, padDown: 14, min: 2.3, max: 8.6, lx: 200, ly0: -105, ly1: 160, ex: 240, ey0: -135, ey1: 205 };
function stepFx() {
  for (const p of PART) { p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life--; }
  PART = PART.filter(p => p.life > 0); for (const p of POPS) { p.y += 0.25; p.life--; } POPS = POPS.filter(p => p.life > 0);
  if (shake > 0) shake--;
  if (!F.length) return;
  const live = F.filter(f => f.state !== 'dead');
  if (slowT > 0 && focus) { cam.x += (focus.x - cam.x) * 0.18; cam.y += (focus.y - cam.y) * 0.18; cam.s += (CAM.max + 1 - cam.s) * 0.14; return; }
  /* Each fighter carries a box the camera must keep in view: room all round, more in front and in the direction of travel.
     The view is the tightest frame round those boxes, so it closes in when the fighters are together and opens up as they
     part. Nothing else is forced into the picture. Fighters past the camera limits are followed no further. */
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const f of live) {
    const x = clamp(f.x, -CAM.lx, CAM.lx), y = clamp(f.y, CAM.ly0, CAM.ly1), lead = f.face * 5 + clamp(f.vx * 5, -12, 12);
    x0 = Math.min(x0, x - CAM.padX + Math.min(lead, 0)); x1 = Math.max(x1, x + CAM.padX + Math.max(lead, 0));
    y0 = Math.min(y0, y - CAM.padDown + Math.min(f.vy * 4, 0)); y1 = Math.max(y1, y + CAM.padUp + Math.max(f.vy * 3, 0));
  }
  if (!live.length) { x0 = -60; x1 = 60; y0 = -10; y1 = 50; }
  const s = clamp(Math.min(W / (x1 - x0), (H - 110) / (y1 - y0)), CAM.min, CAM.max);
  cam.s += (s - cam.s) * (s < cam.s ? 0.12 : 0.03);   /* open up quickly so nobody leaves the frame, close in gently */
  /* aim a little toward the stage, then keep the edges of the view inside the camera limits */
  const hw = W / 2 / cam.s, up = H * 0.52 / cam.s, down = H * 0.48 / cam.s;
  let tx = (x0 + x1) / 2 * 0.92, ty = (y0 + y1) / 2 - 69 / cam.s;   /* the damage display covers the bottom strip, so frame the boxes in what is left above it */
  tx = hw >= CAM.ex ? 0 : clamp(tx, -CAM.ex + hw, CAM.ex - hw);
  ty = up + down >= CAM.ey1 - CAM.ey0 ? (CAM.ey0 + CAM.ey1) / 2 : clamp(ty, CAM.ey0 + down, CAM.ey1 - up);
  cam.x += (tx - cam.x) * 0.11; cam.y += (ty - cam.y) * 0.11;
}
function step() {
  if (mode === 'select') { stepSelect(); return; }
  pollMatch(); if (!paused) tick++;
  if (mode === 'countdown') { countdown--; if (countdown === 130 || countdown === 90 || countdown === 50) beep(440, 0.1, 'square', 0.05); if (countdown === 10) beep(880, 0.3, 'square', 0.06); if (countdown <= 10) mode = 'play'; }
  else if (mode === 'play') stepPlay();
  else if (mode === 'over') { overT++; if (overT < 90) { for (const f of F) { if (overT % 3 === 0) f.update(); } } if (overT > 100 && F.some(f => f.ctl.dev !== 'cpu' && (f.ctl.pressed('start') || f.ctl.pressed('atk')))) { mode = 'select'; for (const s of slots) if (s) s.ready = false; F = []; } }
  stepFx();
}

