'use strict';
/* Emberfall simulation: rules, input, fighters, combat, CPU and match flow. No drawing in this file; it also runs headless. */
const W = 1280, H = 720, TAU = Math.PI * 2;
const sgn = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const appr = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
/* ---------- Movement model ----------
   Every fighter is described by the same set of numbers (in `st`), used the same way:
   walk / run: speed limit = walk or run x how far the stick is pushed; push = walkAdd + walkMul x stick (runAdd, runMul);
               over the limit, or with the stick let go, the floor's grip `trac` slows the fighter instead.
   dash:       a burst to `dash` speed a moment after the flick, lasting dashF frames, then a run.
   jumps:      given as heights (jumpH full hop, hopH short hop, airJumpH air jump); the launch speed is worked out from
               the height and the fighter's gravity. A full hop from the ground covers its first `jumpInit` of height in
               four frames, then rises the rest of the way under gravity, so it pops off the floor.
               Sideways: ground speed x jumpXMul + stick x jumpX, no more than jumpXMax. An air jump with the stick held
               resets sideways speed to stick x airSpeed x airJumpX.
   air:        speed limit airSpeed x stick; push airAdd + airMul x stick; airBrake when over the limit or stick let go.
               grav each frame down to `fall`; a downward flick while falling drops at `ffall` at once. */
const MOVE = { dashKeep: 1, boost: [0.31, 0.27, 0.23, 0.19], launchBrake: 0.03 };
/* Launch speed that carries a jump exactly h high under gravity g, the way this game steps it (no gravity on the first frame). */
function jumpV(h, g) { let lo = 0, hi = 20; for (let k = 0; k < 40; k++) { const v = (lo + hi) / 2; let y = 0; for (let s = v; s > 0; s -= g) y += s; if (y < h) lo = v; else hi = v; } return (lo + hi) / 2; }

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
const EDGE = 68;   /* half the width of the main stage (it was 80 until 2026-11-10; everything about the stage is placed from this number) */
const MAIN = { x0: -EDGE, x1: EDGE, y: 0, soft: false };
/* Two soft platforms side by side, low enough for every fighter's full hop and too high for any short hop. No top platform. */
const PLATS = [MAIN, { x0: -44, x1: -15, y: 26, soft: true }, { x0: 15, x1: 44, y: 26, soft: true }];
/* The main stage is an island: a rim RIM thick at full width; under it a steep shoulder of rock that gives way SHOULDER_IN
   by SHOULDER down (still a wall to kick off or tech against); then rock that narrows to a point DEPTH down.
   There is no flat underside to hit a head on: a fighter rising beneath it is turned outward along the rock and arrives
   beside the ledge. stageHalf(y) is how far the solid reaches from the middle at height y (below 0), or -1 where there is none. */
const RIM = 5, SHOULDER = 22, SHOULDER_IN = 12, DEPTH = 45, BODY_H = DEPTH;
function stageHalf(y) {
  if (y > 0 || y < -DEPTH) return -1; if (y >= -RIM) return EDGE;
  return y >= -SHOULDER ? EDGE - SHOULDER_IN * (-RIM - y) / (SHOULDER - RIM) : (EDGE - SHOULDER_IN) * (DEPTH + y) / (DEPTH - SHOULDER);
}
const BLAST = { l: -(EDGE + 155), r: EDGE + 155, t: 140, b: -140 };   /* the ceiling was 200 until 2026-11-10: lowered 30% at the owner's request */  //   /* the same distance beyond the ledges as before the stage shrank */

/* ---------- Combat rules ---------- */
const DMG_1V1 = 1.2;                 /* one-on-one damage bonus */
const STALE = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03575, 0.02965];   /* repeated moves weaken */
const SMASH_HOLD = 180, GRAB_MIN = 30;   /* frames a smash can be held; frames a grab holds at the very least, however hard the victim mashes */
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
const DBG = { step: false, boxes: false, advance: 0, r3d: true, fx: true };   /* fx: the burst of sparks and the flash of light where a hit lands */
/* Showing hitboxes: switched with the jump button on the start screen or B on the keyboard, and remembered. */
try { DBG.boxes = localStorage.getItem('emberfall.boxes') === '1'; } catch (e) { /* no storage */ }
try { DBG.fx = localStorage.getItem('emberfall.hitfx') !== '0'; } catch (e) { /* no storage */ }
function setHitFx(on) { DBG.fx = !!on; try { localStorage.setItem('emberfall.hitfx', on ? '1' : '0'); } catch (e) { /* no storage */ } }
function setBoxes(on) { DBG.boxes = !!on; try { localStorage.setItem('emberfall.boxes', on ? '1' : '0'); } catch (e) { /* no storage */ } }
function debugKey(code) {
  if (code === 'KeyP') { DBG.step = !DBG.step; DBG.advance = 0; } else if (code === 'KeyO') { if (DBG.step) DBG.advance++; }
  else if (code === 'KeyB') setBoxes(!DBG.boxes); else if (code === 'KeyH') setHitFx(!DBG.fx); else if (code === 'KeyM') DBG.r3d = !DBG.r3d;
}
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function blankIn() { return { lx: 0, ly: 0, cx: 0, cy: 0, atk: false, spc: false, jmp: false, shd: false, grb: false, start: false, sel: false, sm: false }; }   /* sm: the CPU's way of saying "this attack is a smash" (a person flicks the stick) */
/* Controller settings follow the reference build's controllers.ini: no stick deadzone, full outer zone, triggers at 25%. */
const PAD = { deadzone: 0, outer: 1, trigger: 0.25 };
/* Per pad: 'positional' (default, by where the button sits) or 'labels' (by the letter printed on it). Kept between visits. */
const LAYOUT = {};
try { Object.assign(LAYOUT, JSON.parse(localStorage.getItem('emberfall.layout') || '{}')); } catch (e) { /* no storage */ }
function toggleLayout(dev) { LAYOUT[dev] = LAYOUT[dev] === 'labels' ? 'positional' : 'labels'; try { localStorage.setItem('emberfall.layout', JSON.stringify(LAYOUT)); } catch (e) { /* no storage */ } }
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
    this.xSmash = (ax >= 0.8 && this.xT <= 5) || (c.sm && ax >= 0.5);
    if (ay < 0.3 || (Math.abs(p.ly) >= 0.3 && sgn(p.ly) !== sgn(c.ly))) { this.yT = 0; this.yFired = false; } else this.yT++;
    this.downNow = this.upNow = false; if (this.downBuf > 0) this.downBuf--;
    if (ay >= 0.55 && this.yT <= T.drop_flick_frames && !this.yFired) {
      this.yFired = true; if (c.ly < 0) { this.downNow = true; this.downBuf = T.landing_drop_buffer; } else this.upNow = true;
    }
    this.ySmash = (ay >= 0.8 && this.yT <= 5) || (c.sm && ay >= 0.5);
    this.cPress = Math.hypot(c.cx, c.cy) >= 0.5 && Math.hypot(p.cx, p.cy) < 0.5;
  }
  pressed(k) { return this.c[k] && !this.p[k]; }
  take(k) { if (this.buf[k] > 0) { this.buf[k] = 0; return true; } return false; }
}

/* ---------- Effects ---------- */
let PART = [], POPS = [], shake = 0;
let sparkOff = false;   /* set while a hit is being worked out with hit effects switched off */
function spark(x, y, col, n, sp) {
  if (sparkOff) return;
  for (let k = 0; k < n; k++) { const a = Math.random() * TAU, s = (0.3 + Math.random()) * (sp || 1); PART.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 14, col, r: 0.6 + Math.random() * 1.2 }); }
}
function pop(x, y, text, col) { POPS.push({ x, y, text, col, life: 50 }); }

/* ---------- Moves ---------- */
let PROJ = [];
function shoot(f, o) {
  if (o.solo) for (const p of PROJ) if (p.owner === f.idx && p.solo) p.life = 0;   /* a new one replaces the old one */
  if (o.max) { const mine = PROJ.filter(p => p.owner === f.idx && p.tag === o.tag && p.life > 0); if (mine.length >= o.max) mine[0].life = 0; }   /* so many of a kind at once: the oldest goes */
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
  m.throws = { f: th(8, 45, 60, 60), b: th(9, 135, 60, 65), u: th(7, 88, 55, 55), d: th(5, 75, 62, 30) };   /* down throw: a set pop that barely grows, so it starts combos at any damage */
  /* Per-fighter kit: how many jabs chain, grab reach and speed, throw strengths, armoured moves. */
  kit = kit || {};
  if (kit.rapid) m.jabr = { t: F(6), rapid: 1, next: 'jab3', h: [hb(2, 3, 9.5, 8, 4.5, 0.8, 80, 16, 0, { hl: 2 })] };   /* a flurry of light hits that hold the target in place */
  if (kit.rapid) m.jab.next = 'jabr'; else if (kit.jabs === 2) m.jab.next = 'jab3'; else if (kit.jabs === 1) { delete m.jab.next; m.jab.t = F(22); Object.assign(m.jab.h[0], { d: m.jab.h[0].d + 2, a: 361, b: 30, k: 60 }); }
  for (const g of ['grab', 'dgrab', 'pgrab']) if (kit[g]) { const o = kit[g]; if (o.t) m[g].t = o.t; Object.assign(m[g].h[0], o.h || {}); }
  if (kit.throws) for (const k in kit.throws) m.throws[k] = Object.assign(m.throws[k] || {}, kit.throws[k]);   /* a kit may add a throw of its own (a grab special that flings) */
  if (kit.armor) for (const k in kit.armor) m[k].armor = kit.armor[k].map(F);
  return Object.assign(m, special);
}
/* The wind-up of an air move that should not cost height: the fall stops until the move takes over. */
const hang = f => { if (!f.grounded && f.vy < 0) f.vy = 0; };
const lift = (f, vy) => { f.grounded = false; f.plat = null; f.vy = vy; };
/* Wren's Call: the cue starts on frame 1, the new companion takes over on frame 16 and can act on frame 33. It can be hit
   throughout: a hit before frame 16 leaves the old companion in. 60 frames must pass before the next swap. It hangs in the
   air while it plays (the owner's rule). */
const SWAP = { t: 32, swap: 1, stall: 1, h: [], on(f, n) { if (n === 1) f.swapLock = 60; if (n === 16) { f.fi = (f.fi + 1) % f.def.forms.length; f.jumps = f.grounded ? (f.st.jumps || 1) : Math.min(f.jumps, f.st.jumps || 1); spark(f.x, f.y + 7, '#fff', 14, 1.4); beep(660, 0.12, 'triangle', 0.05, 1.6); } } };

/* ---------- The owner's moveset document (2026-11-10) ----------
   KIT holds, per fighter, each attack's first active frame and damage as the document lists them, with:
     late: damage of the later part of a lingering hit        sour: damage nearer the body, when the tip is the strong part
     rear: [frame, damage] of a second hit behind
   Active length and recovery keep the engine's defaults: moving a first active frame moves the whole attack with it.
   Throw damage, pummel damage and the standing grab's first frame are listed too. H in the notes below is Flint's height (14). */
const KIT = {
  Flint: { jab: [3, 2], jab2: [3, 2], jab3: [5, 4], dash: [8, 10, { late: 6 }], ftilt: [7, 9], utilt: [6, 7], dtilt: [6, 6],
    fsmash: [15, 17, { sour: 13 }], usmash: [12, 15], dsmash: [11, 13, { rear: [18, 11] }],
    nair: [4, 8, { late: 4 }], fair: [12, 12], bair: [8, 13, { late: 8 }], uair: [6, 8], dair: [15, 12, { late: 7 }],
    grab: 6, pummel: 1.3, throws: { f: 7, b: 9, u: 7, d: 6 } },
  Nib: { jab: [3, 2], jab2: [3, 2], jab3: [4, 3], dash: [6, 8, { late: 5 }], ftilt: [5, 7], utilt: [5, 6], dtilt: [5, 5],
    fsmash: [15, 15, { sour: 11 }], usmash: [11, 14, { sour: 10 }], dsmash: [12, 12, { rear: [17, 10] }],
    nair: [3, 6, { late: 4 }], fair: [7, 8], bair: [8, 12, { sour: 8 }], uair: [5, 7], dair: [13, 9],
    grab: 6, pummel: 1, throws: { f: 6, b: 7, u: 6, d: 6 } },
  Loom: { jab: [5, 3], jab3: [5, 4], dash: [11, 8, { late: 5 }], ftilt: [9, 9, { sour: 6 }], utilt: [8, 7], dtilt: [10, 7, { sour: 5 }],
    fsmash: [18, 16, { sour: 11 }], usmash: [14, 15], dsmash: [15, 12, { rear: [21, 10] }],
    nair: [6, 7, { late: 4 }], fair: [9, 11, { sour: 7 }], bair: [10, 12, { sour: 8 }], uair: [7, 9, { sour: 6 }], dair: [13, 10, { sour: 6 }],
    grab: 8, pummel: 1.2, throws: { f: 7, b: 8, u: 7, d: 6 } },
  Hod: { jab: [6, 3], jab2: [6, 3], jab3: [7, 5], dash: [12, 13, { late: 8 }], ftilt: [10, 12, { sour: 9 }], utilt: [10, 9], dtilt: [9, 8],
    fsmash: [23, 20, { sour: 16 }], usmash: [17, 18], dsmash: [16, 16, { rear: [23, 13] }],
    nair: [7, 11, { late: 7 }], fair: [13, 14, { sour: 10 }], bair: [12, 15, { late: 9 }], uair: [10, 11], dair: [17, 14, { sour: 9 }],
    grab: 8, pummel: 1.6, throws: { f: 10, b: 12, u: 9, d: 8 } },
  Sprocket: { jab: [5, 2], jab2: [4, 3], jab3: [6, 5], dash: [12, 12, { late: 7 }], ftilt: [8, 10, { sour: 7 }], utilt: [10, 8], dtilt: [9, 7],
    fsmash: [21, 20, { sour: 15 }], usmash: [15, 17], dsmash: [16, 15, { rear: [24, 13] }],
    nair: [7, 9, { late: 6 }], fair: [11, 13, { sour: 8 }], bair: [10, 14, { late: 8 }], uair: [10, 10], dair: [16, 15, { sour: 8 }],
    grab: 7, pummel: 1.5, throws: { f: 9, b: 11, u: 8, d: 7 } },
  Scuttle: { jab: [3, 2], jab2: [4, 2], jab3: [6, 4], dash: [7, 9, { late: 5 }], ftilt: [6, 7], utilt: [5, 6], dtilt: [5, 6],
    fsmash: [16, 17, { late: 11 }], usmash: [11, 13], dsmash: [13, 13, { rear: [18, 11] }],
    nair: [4, 8, { late: 4 }], fair: [6, 8], bair: [8, 12, { sour: 8 }], uair: [5, 7], dair: [13, 11, { sour: 8 }],
    grab: 6, pummel: 1.2, throws: { f: 7, b: 10, u: 7, d: 6 } },
};
function applyKit(fm) {
  const K = KIT[fm.name], mv = fm.moves; if (!K) return;
  for (const k in K) {
    const q = K[k], m = mv[k]; if (!Array.isArray(q) || !m || !m.h || !m.h[0]) continue;
    const h = m.h[0], len = h.f1 - h.f0, shift = q[0] - h.f0, o = q[2] || {};
    h.f0 = q[0]; h.f1 = q[0] + len; h.d = q[1];
    if (o.rear && m.h[1]) { const r = m.h[1], l2 = r.f1 - r.f0; r.f0 = o.rear[0]; r.f1 = o.rear[0] + l2; r.d = o.rear[1]; }
    if (o.late !== undefined) { const cut = h.f0 + Math.max(1, Math.round(len * 0.3)); m.h.push(Object.assign({}, h, { f0: cut + 1, f1: Math.max(cut + 1, h.f1), d: o.late, k: Math.round(h.k * 0.75), part: 'late' })); h.f1 = cut; }
    if (o.sour !== undefined) m.h.push(Object.assign({}, h, { x: h.x * 0.5, y: h.y + (fm.st.h / 2 - h.y) * 0.5, r: h.r * 0.9, d: o.sour, k: Math.round(h.k * 0.85), part: 'near' }));   /* halfway in toward the body */
    m.t = Math.max(m.t + shift, Math.max(...m.h.map(x => x.f1)) + 6);
    if (m.chg && m.chg >= h.f0) m.chg = Math.max(2, h.f0 - 2);
    if (m.chain) m.chain = Math.max(m.chain + shift, h.f1 + 1);
    if (m.ac) m.ac += shift;
  }
  const g0 = mv.grab.h[0].f0, gs = K.grab - g0;
  for (const g of ['grab', 'dgrab', 'pgrab']) { mv[g].h[0].f0 += gs; mv[g].h[0].f1 += gs; mv[g].t += gs; }
  for (const k in K.throws) mv.throws[k].d = K.throws[k];
  fm.st.pummel = K.pummel;
}
/* What the document leaves open, set by balance testing (CPU against CPU, 60 matches a pairing): kb scales how hard every
   hit and throw launches, lag scales the time after an attack's last active frame. */
const TUNE = {
  Flint: { kb: 0.84, lag: 1.2 }, Nib: { kb: 1.09 }, Loom: { kb: 1.11, lag: 0.95 }, Hod: { kb: 1.31, lag: 0.8 }, 'Potato Sack': { kb: 0.9 }, Sprocket: { kb: 0.8, lag: 1.3 }, Scuttle: { kb: 0.91, lag: 1.2 },
  /* Furious Fowls: the owner asked for 55 to 65% (2026-11-10) */
  Rusty: { kb: 0.92 }, Cinder: { kb: 0.92 }, Pip: { kb: 1.04 }, Pearl: { kb: 0.95 },
};
const NORMALS = ['jab', 'jab2', 'jab3', 'dash', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash', 'nair', 'fair', 'bair', 'uair', 'dair'];
function applyTune(fm) {
  const T = TUNE[fm.name], mv = fm.moves; if (!T) return;
  if (T.kb) { for (const k in mv) { const m = mv[k]; if (m && Array.isArray(m.h)) for (const h of m.h) if (h.k) h.k = Math.round(h.k * T.kb); } for (const k in mv.throws) mv.throws[k].k = Math.round(mv.throws[k].k * T.kb); }
  if (T.lag) for (const k of ['dash', 'fsmash', 'usmash', 'dsmash']) {   /* committal moves only: tilts, jabs and aerials keep their recovery, so hits lead to follow-ups */ const m = mv[k]; if (!m || !m.h || !m.h[0]) continue; const last = Math.max(...m.h.map(x => x.f1)); m.t = last + Math.max(6, Math.round((m.t - last) * T.lag)); }
}

/* ---------- Fighters (all original) ---------- */
/* Bellows Burst reaching Flint's own ember patch: the patch is used up and a low flame runs on from it. */
function bellowsWave(f) {
  const p = PROJ.find(q => q.owner === f.idx && q.patch && (q.x - f.x) * f.face > 0 && Math.abs(q.x - f.x) < 24 && Math.abs(q.y - 2.5 - f.y) < 8);
  if (!p) return; p.life = 0;
  shoot(f, { kind: 'flame', ox: Math.abs(p.x - f.x), oy: 3, vx: 2.2, r: 4, life: 10, h: { d: 8, a: 30, b: 35, k: 60, cast: 1 } });
  spark(p.x, p.y, '#ffb347', 14, 1.6);
}
const FLINT = {
  name: 'Flint', sub: 'the lamplighter', forms: [{
    name: 'Flint', col: ['#1f6f78', '#f2c14e', '#f6e7c1'], alt: ['#7a3b69', '#9be564', '#f6e7c1'], reachMul: 1.0,
    /* Lantern all-rounder: puts one ember where the opponent wants to stand, and pays off up close. */
    st: { weight: 92, walk: 1.12, walkMul: 0.14, walkAdd: 0.1, trac: 0.105, dash: 1.92, runMul: 0.11, runAdd: 0.044, run: 1.74,
      jumpX: 0.95, jumpXMul: 0.8, jumpXMax: 1.3, airJumpX: 0.9, jumpH: 34, jumpInit: 18.7, hopH: 16.5, airJumpH: 34.5, upH: 28,
      airMul: 0.065, airAdd: 0.01, airSpeed: 1.1, airBrake: 0.01, grav: 0.09, fall: 1.55, ffall: 2.48, jsq: 3, w: 8, h: 14, jf: 3, jb: 1.2,
      jumps: 1, dashF: 12, roll: [28, 1.35, 13], spot: [22, 15] },
    aiShot: [40, 110],
    moves: mk(1, 1, 1, 1, {
      /* Banked Coal: released on frame 14. 5% on contact; if it reaches the floor first it leaves one small ember for 45 frames
         (4%). The next coal clears the old ember. */
      nspec: { t: 40, h: [], on(f, n) { if (n === 14) { shoot(f, { kind: 'ember', solo: 1, vx: 1.4, vy: 1.7, grav: 0.09, r: 3, life: 120, ground: 'stick', h: { d: 5, a: 70, b: 30, k: 40 } }); beep(520, 0.08, 'sawtooth', 0.04, 0.6); } } },
      /* Lamp Rush: a short lantern lunge of about 1.1 H. Active 14 to 18: 10% clean, 7% late. About 21 frames after the swing. */
      sspec: { t: 39, once: 1, nodrift: 1, h: [{ f0: 14, f1: 15, x: 8, y: 8, r: 6, d: 10, a: 50, b: 50, k: 72 }, { f0: 16, f1: 18, x: 8, y: 8, r: 6, d: 7, a: 50, b: 40, k: 55, part: 'late' }],
        on(f, n) { if (n >= 10 && n <= 18) { f.vx = f.face * 1.7; if (!f.grounded) f.vy = 0; } if (n === 19) f.vx *= 0.3; } },
      /* Updraft: the lantern points down and lifts Flint about 2 H. A 6% rising hit from frame 8, modest steering, then special fall. */
      uspec: { t: 40, helpless: 1, ledge: 1, h: [{ f0: 8, f1: 16, x: 0, y: 10, r: 7, d: 6, a: 85, b: 55, k: 50 }], on(f, n, i) { if (n < 8) hang(f); if (n === 8) { lift(f, f.st.vUp); f.vx = i.lx * 0.7; } } },
      /* Bellows Burst: plants, then blasts a short cone on frames 24 to 26 for 15%. If the cone reaches Flint's ember it uses
         the patch up and sends a low 8% flame a short way further. About 23 frames after the blast. Hangs in the air (owner's rule). */
      dspec: { t: 49, stall: 1, cast: 1, h: [{ f0: 24, f1: 26, x: 10, y: 7, r: 8.5, d: 15, a: 45, b: 40, k: 95 }], on(f, n) { if (n === 24) { spark(f.x + f.face * 9, f.y + 7, '#f2c14e', 24, 2.2); beep(140, 0.25, 'sawtooth', 0.07, 0.4); bellowsWave(f); } } },
    }, { jabs: 3 }),
  }],
};
const WREN = {
  name: 'Wren', sub: 'and her three companions', forms: [{
    /* Nib: wind-up fox. Wins by making the opponent defend at the wrong time; light, so a bad pounce is costly. */
    name: 'Nib', col: ['#c9862b', '#6b4a1e', '#ffe8a3'], alt: ['#4f9d8f', '#1f4d47', '#e8fff6'], reachMul: 0.9,
    st: { weight: 72, walk: 1.38, walkMul: 0.2, walkAdd: 0.105, trac: 0.128, dash: 2.36, runMul: 0.13, runAdd: 0.044, run: 2.23,
      jumpX: 0.95, jumpXMul: 0.85, jumpXMax: 1.55, airJumpX: 1, jumpH: 35, jumpInit: 19.25, hopH: 15, airJumpH: 36, upH: 38,
      airMul: 0.085, airAdd: 0.015, airSpeed: 1.23, airBrake: 0.012, grav: 0.097, fall: 1.7, ffall: 2.9, jsq: 3, w: 8, h: 9, jf: 3.2, jb: 2,
      jumps: 1, wallJump: 1, dashF: 10, roll: [24, 1.6, 11], spot: [20, 14] },
    moves: mk(0.85, 1, 0.85, 0.65, {
      /* Quick Bolt: the key ticks and fires a fast 4% bolt on frame 9. Range about 1.8 H. Little flinch, little launch. */
      nspec: { t: 28, h: [], on(f, n) { if (n === 9) { shoot(f, { kind: 'bolt', solo: 1, oy: 5, vx: 3.2, r: 2.2, life: 5, h: { d: 4, a: 361, b: 8, k: 12 } }); beep(900, 0.06, 'square', 0.03, 1.5); } } },
      /* False Start: the first nine frames are shared. Let go before frame 10 for a low pounce of about 1.3 H, active 14 to 16
         for 9%, 20 frames after. Hold through frame 10 to stop short at about 0.55 H: no damage, free to act on frame 23.
         In the air only the pounce, once per time off the ground. */
      sspec: { t: 36, once: 1, nodrift: 1, ll: 12, h: [{ f0: 14, f1: 16, x: 5, y: 4, r: 5.5, d: 9, a: 60, b: 45, k: 75 }],
        on(f, n, i) { if (n === 10 && f.grounded && i.spc) { f.startMove('sbrake'); f.mf = 10; f.vx = f.face * 1.5; return; }
          if (n >= 10 && n <= 16) { f.vx = f.face * 2.6; if (!f.grounded && f.vy < 0) f.vy *= 0.5; } if (n === 17) f.vx *= 0.25; } },
      sbrake: { t: 23, nodrift: 1, h: [], on(f, n) { if (n >= 10 && n <= 14) f.vx = f.face * 1.5; if (n === 15) f.vx = 0; } },
      /* Spring Vault: compresses and vaults on frame 8, steep or (stick held sideways) diagonal. A single 6% rising hit covers
         the first frames. Special fall follows. */
      uspec: { t: 34, helpless: 1, ledge: 1, h: [{ f0: 8, f1: 12, x: 0, y: 6, r: 5, d: 6, a: 90, b: 40, k: 30 }],
        on(f, n, i) { if (n < 8) hang(f); if (n === 8) { const diag = Math.abs(i.lx) > 0.5; lift(f, f.st.vUp * (diag ? 0.84 : 1)); f.vx = diag ? sgn(i.lx) * 2.0 : i.lx * 0.6; } } },
      dspec: SWAP,
    }, { jabs: 3, grab: { t: 26, h: { f0: 5, f1: 7, x: 6.5, r: 4 } }, dgrab: { t: 34, h: { f0: 7, f1: 9, x: 8.5, r: 4.2 } }, pgrab: { t: 36, h: { f0: 8, f1: 10, x: 9.5, r: 4.2 } },
      throws: { f: { b: 45, k: 45 }, b: { b: 50, k: 50 }, u: { b: 48, k: 28 }, d: { a: 70, b: 58, k: 22 } } }),
  }, {
    /* Loom: ribbon spacer. Wants the opponent at the far end of a ribbon; light, and slow up close. */
    name: 'Loom', col: ['#7b5cd6', '#f08fc0', '#fdf0ff'], alt: ['#2d7dd2', '#f7d154', '#f0fbff'],
    st: { weight: 79, walk: 0.95, walkMul: 0.09, walkAdd: 0.09, trac: 0.08, dash: 1.68, runMul: 0.08, runAdd: 0.03, run: 1.51,
      jumpX: 0.8, jumpXMul: 0.75, jumpXMax: 1.2, airJumpX: 1, jumpH: 30, jumpInit: 16.5, hopH: 13.5, airJumpH: 27,
      airMul: 0.08, airAdd: 0.01, airSpeed: 1.33, airBrake: 0.006, grav: 0.066, fall: 1.15, ffall: 1.84, jsq: 3, w: 8, h: 15, jf: 2.6, jb: 1,
      jumps: 3, dashF: 14, roll: [32, 1.15, 14], spot: [24, 16] },
    aiSide: 1,   /* the ribbon, not the gust, is the special to use in a fight */
    moves: mk(1.3, 1.0, 1.1, 1.05, {
      /* Crossbreeze: a brief forward gust from frame 12 for four frames. The inner pulse deals 3%. The outer pulse pushes
         once, with no damage and no hitstun, less on a grounded target; a shield blocks it. */
      nspec: { t: 40, h: [{ f0: 12, f1: 15, x: 9, y: 9, r: 6, d: 3, a: 20, b: 30, k: 20 }, { f0: 12, f1: 15, x: 23, y: 9, r: 9, d: 0, wind: 1.9, g: 1 }], on(f, n) { if (n === 12) beep(300, 0.2, 'sine', 0.05, 2); } },
      /* Ribbon Sling: one ribbon snapped straight out, then a recoil of about 0.3 H. From frame 16: 11% at the weight, 6% on
         the inner ribbon, nothing at point-blank. One recoil per time off the ground. */
      sspec: { t: 46, h: [{ f0: 16, f1: 19, x: 24, y: 9, r: 5, d: 11, a: 361, b: 30, k: 95 }, { f0: 16, f1: 19, x: 14, y: 9, r: 5, d: 6, a: 361, b: 30, k: 60, part: 'near' }],
        on(f, n) { if (n === 20) f.recoil = f.grounded || !f.slingUsed; if (n >= 20 && n <= 22 && f.recoil) { f.vx = -f.face * 1.4; if (!f.grounded) f.slingUsed = true; } if (n === 23 && f.recoil) f.vx = 0; } },
      /* Thermal: the kite cups the air from frame 9 for a sure short lift; holding special keeps it rising through frame 26,
         up to about 2.4 H. Modest steering. Fully open to attack on the way up. Special fall after. */
      uspec: { t: 44, helpless: 1, ledge: 1, hold: 1, rise: 33, h: [],
        on(f, n, i) { if (n === 9) { lift(f, 1.87); f.thermal = true; } if (n > 9 && n <= 26 && f.thermal) { if (n > 13 && !i.spc) { f.thermal = false; f.vy = 0.3; } else { f.vy = 1.87; f.vx = i.lx * 0.8; } } if (n === 27 && f.thermal) { f.thermal = false; f.vy = 0.3; } } },   /* the climb ends with the lift: no coasting on */
      dspec: SWAP,
    }, { jabs: 2, grab: { t: 44, h: { f0: 12, f1: 15, x: 13, r: 4.5 } }, dgrab: { t: 52, h: { f0: 14, f1: 17, x: 15, r: 4.5 } }, pgrab: { t: 54, h: { f0: 15, f1: 18, x: 16.5, r: 4.5 } },
      throws: { f: { a: 40, b: 60, k: 55 }, b: { b: 60, k: 60 }, u: { a: 90, b: 70, k: 60 }, d: { a: 60, b: 60, k: 25 } } }),
  }, {
    /* Hod: armoured ground bully. Takes ground behind a rolling stone; once off the stage it can really be lost. */
    name: 'Hod', col: ['#6d6a75', '#a39171', '#f1f1f1'], alt: ['#8a4f3d', '#3d5a6c', '#f1f1f1'],
    st: { weight: 121, walk: 0.84, walkMul: 0.085, walkAdd: 0.06, trac: 0.1, dash: 1.46, runMul: 0.075, runAdd: 0.02, run: 1.32,
      jumpX: 0.7, jumpXMul: 0.75, jumpXMax: 1.05, airJumpX: 0.9, jumpH: 27.5, jumpInit: 15.1, hopH: 13.5, airJumpH: 28, upH: 23,
      airMul: 0.035, airAdd: 0.01, airSpeed: 0.77, airBrake: 0.008, grav: 0.11, fall: 1.8, ffall: 2.9, jsq: 3, w: 12, h: 13, jf: 4.4, jb: 2.8,
      jumps: 1, dashF: 15, roll: [32, 1.15, 12], spot: [24, 14] },
    aiShot: [18, 46], aiBig: 0.5, aiSide: 1,   /* the stone only rolls about 3 H; half of them held for the big one; Ram Plate up close */
    moves: mk(1.1, 1.3, 1.25, 0.9, {
      /* Boulder Roll: a tap releases a small, faster 7% stone on frame 21; holding through frame 16 commits to the larger,
         slower 11% stone on frame 35. Either rolls about 3 H, falls away at a ledge, or breaks on contact. One at a time. */
      nspec: { t: 54, h: [], on(f, n, i) {
        if (n === 1) f.bigStone = true; if (n <= 16 && !i.spc) f.bigStone = false;
        if (!f.bigStone && n === 21) { shoot(f, { kind: 'boulder', solo: 1, oy: 5, vx: 2.1, vy: 0.5, grav: 0.09, r: 3.2, life: 90, reach: 42, ground: 'roll', h: { d: 7, a: 50, b: 35, k: 55 } }); beep(140, 0.12, 'square', 0.05, 0.7); f.mf = f.move.t - 16; }
        if (f.bigStone && n === 35) { shoot(f, { kind: 'boulder', solo: 1, oy: 6, vx: 1.35, vy: 0.6, grav: 0.09, r: 4.8, life: 120, reach: 42, ground: 'roll', h: { d: 11, a: 50, b: 40, k: 72 } }); beep(110, 0.15, 'square', 0.06, 0.7); } } },
      /* Ram Plate: a low committed charge. On the ground, frames 13 to 19 shrug off one strike of 8% base damage or less (Hod
         still takes the damage; throws and stronger hits stop it). Hits 15 to 21 for 13%; about 25 frames after. In the air
         it carries a short way with no armour. */
      sspec: { t: 46, once: 1, nodrift: 1, armor: [13, 19], armorMax: 8, armorHits: 1, h: [{ f0: 15, f1: 21, x: 7, y: 5, r: 7, d: 13, a: 45, b: 50, k: 85 }],
        on(f, n) { if (n < 13) hang(f); if (n >= 13 && n <= 21) { f.vx = f.face * 2.0; if (!f.grounded) f.vy = 0; } if (n === 22) f.vx *= f.grounded ? 0.3 : 0.6; } },   /* in the air: hangs through the wind-up, the same 18-unit carry held level, and some of the speed kept after. His way back sideways. */
      /* Stone Step: folds the plates and vaults on frame 12. One weak 6% rising hit covers the opening. About 1.65 H of
         height, slight steering, then special fall. */
      uspec: { t: 44, helpless: 1, ledge: 1, h: [{ f0: 12, f1: 17, x: 0, y: 7, r: 7, d: 6, a: 80, b: 45, k: 40 }], on(f, n, i) { if (n < 12) hang(f); if (n === 12) { lift(f, f.st.vUp); f.vx = i.lx * 0.6; } } },
      dspec: SWAP,
    }, { jabs: 3, grab: { t: 36, h: { f0: 8, f1: 10, x: 9.5, r: 5 } },
      throws: { f: { b: 60, k: 60 }, b: { b: 60, k: 62 }, u: { b: 60, k: 80 }, d: { a: 60, b: 60, k: 42 } } }),
  }],
};
/* Potato Sack: a living sack of forge-town potatoes. A heavy trickster.
   - It moves in hops with a full stop between them (st.hop), so it cannot simply walk someone down.
   - Tumble (down special) is how it really gets about: a burst along the floor, up, or diagonally down in the air, or a
     short hang with no direction. From the frame after the burst it can be cut short into any action, keeping its
     speed, and a new push of the stick ends it too. It never falls over: a dive that reaches the floor carries on as a
     slide, with no timing needed. One use per time off the ground.
   - Bag It (side special) is a leaping grab: it goes through shields and flings whoever it catches.
   - Hot Potato (up special) cooks a potato until it bursts: the blast hurts anyone close, and throws the sack upward
     with real knockback that it pays for in damage. The more hurt it is, the further it flies. One use per time off the ground.
   - It has no hands, so it cannot hold the ledge (st.noLedge): it has to land on the stage.
   - Neutral special is Flint's Ember Toss, unchanged. */
function sackBlast(f, i) {
  spark(f.x, f.y + 4, '#ffb347', 30, 2.6); beep(120, 0.3, 'sawtooth', 0.08, 0.4); shake = Math.max(shake, 6);
  shoot(f, { kind: 'blast', ox: 0.01, oy: 4, vx: 0, r: 11, life: 4, h: { d: 13, a: 70, b: 50, k: 78 } });   /* the burst itself, for anyone else in reach */
  const d = 12; f.pct = Math.min(999, f.pct + d); f.flash = 6; f.blastUsed = !f.grounded || true;
  f.launch(knock(f, d, 100, 70), (90 - clamp(i.lx, -1, 1) * 28) * Math.PI / 180, 1); f.hitlag = 4;
}
const SACK = {
  name: 'Potato Sack', sub: 'a sack of forge-town spuds', forms: [{
    name: 'Potato Sack', col: ['#8a6a45', '#5c3d25', '#e6d3a6'], alt: ['#6f7a5a', '#3f4a33', '#e6ecd0'],
    st: { weight: 106, walk: 1.0, walkMul: 0.3, walkAdd: 0.2, trac: 0.11, dash: 1.95, runMul: 0.3, runAdd: 0.2, run: 1.6,
      hop: { walk: [13, 9, 1.4], run: [11, 8, 1.4] }, noLedge: 1,   /* hop: frames moving, frames stopped, speed while moving (x walk or run) */
      jumpX: 0.85, jumpXMul: 0.85, jumpXMax: 1.4, airJumpX: 0.9, jumpH: 31, jumpInit: 17, hopH: 15, airJumpH: 31,
      airMul: 0.055, airAdd: 0.01, airSpeed: 1.02, airBrake: 0.009, grav: 0.104, fall: 1.68, ffall: 2.69, jsq: 3, w: 10, h: 12, jf: 3.8, jb: 2.6,
      jumps: 1, dashF: 13, roll: [30, 1.25, 13], spot: [23, 15] },
    aiShot: [40, 110],
    moves: mk(0.95, 0.94, 1.1, 0.85, {
      nspec: FLINT.forms[0].moves.nspec,
      sspec: { t: 50, once: 1, nodrift: 1, ll: 14, h: [{ f0: 10, f1: 22, x: 7, y: 6, r: 6, grab: 1, cmd: 's', d: 0 }], on(f, n) { if (n === 8) { lift(f, 1.6); f.vx = f.face * 2.3; } } },
      uspec: { t: 40, rise: 40, blast: 1, h: [], on(f, n, i) { if (n < 16 && !f.grounded) f.vy = Math.max(f.vy, -0.5); if (n === 16) sackBlast(f, i); } },
      dspec: { t: 38, burst: 1, cancel: 7, nodrift: 1, h: [], on(f, n, i) {
        if (n === 1) { f.burstKind = ''; if (!f.grounded) f.burstUsed = true; }
        if (n < 6 && !f.grounded) { f.vy = Math.max(f.vy, -0.3); f.vx *= 0.9; }
        if (n === 6) {
          const x = Math.abs(i.lx) > 0.4 ? sgn(i.lx) : 0, up = i.ly > 0.5 && Math.abs(i.ly) >= Math.abs(i.lx);
          if (up) { f.burstKind = 'lift'; lift(f, f.st.vBurst); f.vx *= 0.5; }
          else if (x && f.grounded) { f.burstKind = 'slide'; f.face = x; f.vx = x * 3.1; }
          else if (x) { f.burstKind = 'dive'; f.face = x; f.vx = x * 2.3; f.vy = -2.2; }
          else { f.burstKind = 'stall'; if (f.grounded) f.mf = f.move.t - 10; }
          f.burstX = x; f.burstDown = i.ly < -0.5;   /* where the stick was when it went off: only a new push ends it */
          spark(f.x, f.y + 4, '#e6d3a6', 10, 1.4); beep(260, 0.07, 'triangle', 0.05, 1.8);
        }
        if (f.burstKind === 'stall' && n > 6 && n <= 20 && !f.grounded) { f.vy = 0; f.vx *= 0.9; }
      } },
    }, { jabs: 1, grab: { t: 34, h: { f0: 7, f1: 9, x: 9.5, r: 4.8 } },
      throws: { f: { d: 9, b: 60, k: 58 }, b: { d: 10, b: 60, k: 62 }, u: { d: 8, b: 58, k: 60 }, d: { d: 6, a: 70, b: 60, k: 30 }, s: { d: 10, a: 48, b: 68, k: 58 } } }),
  }],
};
/* Sprocket: the forge town's handyman, a wrench-range brawler (the owner's moveset document). Jumping over the tape roll
   puts you in the wrench's path, shielding too long invites the vise, and swinging early lets him step back and land the
   wrench's head. He hits harder than Flint at that range and takes longer to recover when he guesses wrong. */
const SPROCKET = {
  name: 'Sprocket', sub: 'the handyman', forms: [{
    name: 'Sprocket', col: ['#c9972c', '#2f6f6a', '#f1e3c4'], alt: ['#7a4a2a', '#3d5a6c', '#f1e3c4'], reachMul: 1.0,
    /* the document's targets against Flint: weight 112, ground speed 88, air drift 82, gravity 110. Short bursts, committed jumps. */
    st: { weight: 103, walk: 0.99, walkMul: 0.13, walkAdd: 0.09, trac: 0.11, dash: 1.69, runMul: 0.1, runAdd: 0.04, run: 1.53,
      jumpX: 0.85, jumpXMul: 0.8, jumpXMax: 1.2, airJumpX: 0.9, jumpH: 32, jumpInit: 17.6, hopH: 15.5, airJumpH: 32, upH: 24,
      airMul: 0.055, airAdd: 0.01, airSpeed: 0.9, airBrake: 0.01, grav: 0.099, fall: 1.66, ffall: 2.66, jsq: 3, w: 9, h: 14, jf: 3.2, jb: 1.4,
      jumps: 1, dashF: 12, roll: [30, 1.25, 13], spot: [23, 15] },
    aiShot: [26, 58], aiSide: 1, aiVise: 1,
    moves: mk(1.15, 1, 1.15, 1, {
      /* Tape Roll: flicked low on frame 16. On flat ground it runs outward for about 22 frames, then curls back toward where
         it was let go. From the air it drops to the floor first. 6%; breaks on a fighter or a shield, or falls away at the
         ledge. One roll at a time. */
      nspec: { t: 42, h: [], on(f, n) { if (n === 16) { shoot(f, { kind: 'tape', solo: 1, oy: 3, vx: 1.3, vy: 0.2, grav: 0.09, r: 2.4, life: 130, ground: 'roll', back: 22, h: { d: 6, a: 60, b: 30, k: 40 } }); beep(420, 0.07, 'triangle', 0.04, 0.8); } } },
      /* Hook Wrench: plants the lead foot and reaches up and forward with the open wrench, frames 16 to 19. The head deals 9%
         and tugs the target a little inward; the handle deals 7% and pushes outward. About 22 frames after the swing. */
      sspec: { t: 41, h: [{ f0: 16, f1: 19, x: 12, y: 15, r: 5, d: 9, a: 115, b: 38, k: 22 }, { f0: 16, f1: 19, x: 6.5, y: 11, r: 4.5, d: 7, a: 40, b: 40, k: 60, part: 'near' }] },
      /* Ratchet Spin: straight up or a diagonal, chosen during the wind-up, then rides that arc. One 8% hit from frame 10
         covers the start. Carries further sideways and less high than Flint's Updraft. Special fall after. */
      uspec: { t: 40, helpless: 1, ledge: 1, h: [{ f0: 10, f1: 16, x: 0, y: 8, r: 8, d: 8, a: 80, b: 50, k: 45 }],
        on(f, n, i) { if (n < 10) hang(f); if (n === 10) { const diag = Math.abs(i.lx) > 0.5; lift(f, f.st.vUp * (diag ? 0.82 : 1)); f.vx = diag ? sgn(i.lx) * 1.8 : i.lx * 0.4; } } },
      /* Bench Vise: steps in and closes the open wrench on a standing opponent, frames 18 and 19, reaching about 1 H from
         where he started (the document says roughly 0.9 H; the wrench is that long). It goes through a shield and throws low behind him for 12%. A jump or a dodge beats it, and a miss
         leaves about 30 frames. Ground only: in the air it catches nothing. */
      dspec: { t: 49, h: [{ f0: 18, f1: 19, x: 10, y: 6, r: 4, grab: 1, cmd: 'v', floor: 1, d: 0 }] },   /* the step is in the picture only: the wrench is long enough */
    }, { jabs: 3, grab: { t: 34, h: { f0: 7, f1: 9, x: 8.5, r: 4.5 } }, throws: { v: { d: 12, a: 158, b: 62, k: 52 } } }),
  }],
};
/* Scuttle: a soot crab living in a coal scuttle, with one claw grown into a pair of fire tongs. A low, quick skirmisher
   (frames, damage and movement from the owner's document for fighter 01; the names, look and moves are Emberfall's own).
   Gets under a swing, makes two quick hits count, and calls the landing with its up smash. Short reach and light. */
function scuttleImpact(f) { shoot(f, { kind: 'blast', ox: 0.01, oy: 2, vx: 0, r: 8, life: 3, h: { d: 10, a: 63, b: 39, k: 74 } }); spark(f.x, f.y + 1, '#c9c2b8', 18, 2); beep(110, 0.18, 'square', 0.06, 0.5); shake = Math.max(shake, 4); }
const SCUTTLE = {
  name: 'Scuttle', sub: 'the coal crab', forms: [{
    name: 'Scuttle', col: ['#b5692f', '#2b2a2e', '#ff9a3c'], alt: ['#6f7f86', '#2b2a2e', '#7fe0ff'], reachMul: 1.0,
    /* against Flint's 100: weight 82, walk 115, run 116, dash 127, air drift 110, gravity 107, fast fall 111, hops 91 and 96, air jump 94 */
    st: { weight: 75, walk: 1.29, walkMul: 0.16, walkAdd: 0.12, trac: 0.12, dash: 2.44, runMul: 0.13, runAdd: 0.05, run: 2.02,
      jumpX: 1.0, jumpXMul: 0.85, jumpXMax: 1.45, airJumpX: 0.95, jumpH: 32.6, jumpInit: 17.9, hopH: 15, airJumpH: 32.4, upH: 30,
      airMul: 0.07, airAdd: 0.012, airSpeed: 1.21, airBrake: 0.011, grav: 0.096, fall: 1.66, ffall: 2.75, jsq: 3, w: 9, h: 10.5, jf: 3.2, jb: 2,
      jumps: 1, dashF: 11, roll: [26, 1.45, 12], spot: [21, 14] },
    aiSide: 1, aiVise: 'n',
    moves: mk(0.8, 1, 0.9, 0.7, {
      /* Tongs Snatch: a slow reach with the tongs, frames 16 to 18. On the ground it catches a standing opponent, shield or
         not, and flings them up and away for 8%. In the air it is a 5% swipe instead. */
      nspec: { t: 44, ll: 17, h: [{ f0: 16, f1: 18, x: 8.5, y: 4.5, r: 4.2, grab: 1, cmd: 'n', floor: 1, d: 0 }, { f0: 16, f1: 18, x: 7.5, y: 5, r: 4.5, d: 5, a: 41, b: 27, k: 55, airOnly: 1 }] },
      /* Scuttle Roll: pulls into the scuttle and rolls, frames 9 to 23: about 1.65 H along the floor, 0.9 H in the air.
         10% on frames 11 to 15, 6% after. Once per time off the ground. */
      sspec: { t: 42, once: 1, nodrift: 1, ll: 18, h: [{ f0: 11, f1: 15, x: 1.5, y: 4.5, r: 5.5, d: 10, a: 44, b: 38, k: 76 }, { f0: 16, f1: 22, x: 1.2, y: 4, r: 4.8, d: 6, a: 56, b: 29, k: 57, part: 'late' }],
        on(f, n) { if (n >= 9 && n <= 23) { f.vx = f.face * (f.grounded ? 1.55 : 0.85); if (!f.grounded) f.vy = Math.max(f.vy, -0.4); } if (n === 24) f.vx *= 0.3; } },
      /* Steam Pop: a jet from the scuttle on frame 8 lifts it about 2.15 H, with a 7% hit at the start. Special fall after. */
      uspec: { t: 24, helpless: 1, ledge: 1, h: [{ f0: 8, f1: 10, x: 1, y: 5, r: 5, d: 7, a: 72, b: 35, k: 62 }], on(f, n, i) { if (n < 8) hang(f); if (n === 8) { lift(f, f.st.vUp); f.vx = i.lx * 0.55; } } },
      /* Bucket Drop: on the ground, rears up and drops the scuttle for 13% on frames 18 to 20. In the air it dives from
         frame 12 at 1.4 times its fast fall: 12% and straight down on someone in the air, and a 10% thump where it lands.
         One dive per time off the ground; 24 frames to get up after landing. */
      dspec: { t: 45, blast: 1, ll: 24, h: [{ f0: 18, f1: 20, x: 3, y: 3.5, r: 6, d: 13, a: 65, b: 40, k: 84, gndOnly: 1 }, { f0: 12, f1: 23, x: 0.5, y: -1, r: 5, d: 12, a: 285, b: 27, k: 85, airOnly: 1 }],
        on(f, n) { if (n === 1) { f.dove = !f.grounded; if (f.dove) f.blastUsed = true; } if (!f.dove || f.grounded) return; if (n < 12) hang(f); else if (n <= 23) { f.vy = -f.st.ffall * 1.4; f.vx *= 0.9; } else { f.move = null; f.set('helpless'); } },
        onLand(f, mf) { if (f.dove && mf >= 12 && mf <= 23 && !f.hitG.size) scuttleImpact(f); } },   /* the thump shares the dive's one hit: no second hit on whoever the dive already caught */
    }, { jabs: 3, grab: { t: 28, h: { f0: 6, f1: 7, x: 7.5, r: 4.2 } }, throws: { n: { d: 8, a: 62, b: 42, k: 62 } } }),
  }],
};
/* FOWL-DATA-BEGIN (written by tools/fowls-gen.js from the owner's move data; do not edit by hand) */
const FOWL = {"combined":{"jab_1":{"s":3,"a":2,"e":7,"d":2,"ang":68,"k":40,"b":12,"g":{"x":0.78,"y":0.18,"r":0.18,"in":[0.2,0.18]}},"jab_2":{"s":3,"a":2,"e":8,"d":2,"ang":72,"k":40,"b":14,"g":{"x":0.9,"y":0.2,"r":0.18,"in":[0.3,0.2]}},"jab_finisher":{"s":5,"a":3,"e":14,"d":3,"ang":50,"k":98,"b":25,"g":{"x":0.73,"y":0.25,"r":0.36}},"forward_tilt":{"s":7,"a":3,"e":17,"d":8,"ang":42,"k":84,"b":27,"g":{"x":1.4,"y":0.25,"r":0.18,"in":[0.3,0.25]}},"up_tilt":{"s":6,"a":5,"e":16,"d":7,"ang":91,"k":75,"b":19,"g":{"x":0,"y":1.2,"r":0.27,"in":[0.35,0.2]}},"down_tilt":{"s":5,"a":3,"e":14,"d":6,"ang":76,"k":55,"b":18,"g":{"x":0.95,"y":-0.4,"r":0.17,"in":[0.15,-0.4]}},"dash_attack":{"s":9,"a":5,"e":22,"d":9,"ang":52,"k":84,"b":40,"g":{"x":0.62,"y":0.1,"r":0.475}},"forward_smash":{"s":18,"a":3,"e":28,"d":17,"ang":43,"k":108,"b":35,"g":{"x":1,"y":0.3,"r":0.515}},"up_smash":{"s":13,"a":5,"e":27,"d":15,"ang":87,"k":104,"b":32,"g":{"x":0.08,"y":1.09,"r":0.565}},"down_smash":{"s":14,"a":4,"e":28,"d":13,"ang":33,"k":101,"b":37,"g":{"x":1.05,"y":-0.28,"r":0.3,"in":[0.2,-0.28],"rear":[-1.05,-0.28,0.3]}},"neutral_air":{"s":5,"a":10,"e":16,"d":8,"ang":58,"k":78,"b":28,"g":{"x":0,"y":0,"r":0.72}},"forward_air":{"s":9,"a":4,"e":23,"d":10,"ang":48,"k":91,"b":30,"g":{"x":1.5,"y":0.06,"r":0.19,"in":[0.45,0.06]}},"back_air":{"s":7,"a":3,"e":21,"d":11,"ang":35,"k":104,"b":30,"g":{"x":-1.25,"y":0.28,"r":0.25,"in":[-0.25,0.28]}},"up_air":{"s":7,"a":5,"e":18,"d":9,"ang":80,"k":83,"b":24,"g":{"x":0,"y":1.01,"r":0.42500000000000004}},"down_air_wooden_red_dummy":{"s":13,"a":2,"e":24,"d":12,"ang":270,"k":93,"b":21,"g":{"x":0,"y":-0.45,"r":0.22}},"grab":{"s":8,"a":2,"e":22,"d":0,"ang":0,"k":0,"b":0,"g":{"x":1.01,"y":0.19,"r":0.26,"in":[0.22,0.19]}},"pummel":{"s":4,"a":2,"e":8,"d":1.5,"ang":0,"k":0,"b":0,"g":{"x":0,"y":0,"r":0.25}},"forward_throw":{"s":9,"a":1,"e":17,"d":9,"ang":42,"k":100,"b":48,"g":{"x":0,"y":0,"r":0.25}},"back_throw":{"s":11,"a":1,"e":19,"d":10,"ang":138,"k":107,"b":52,"g":{"x":0,"y":0,"r":0.25}},"up_throw":{"s":10,"a":1,"e":16,"d":8,"ang":89,"k":90,"b":50,"g":{"x":0,"y":0,"r":0.25}},"down_throw":{"s":12,"a":1,"e":19,"d":7,"ang":75,"k":60,"b":36,"g":{"x":0,"y":0,"r":0.25}}},"solo":{"jab":{"s":3,"a":2,"e":10,"d":3,"ang":58,"k":50,"b":12,"g":{"x":0.48,"y":0.06,"r":0.25}},"forward_tilt":{"s":6,"a":3,"e":17,"d":5,"ang":45,"k":65,"b":18,"g":{"x":0.54,"y":0.15,"r":0.3}},"up_tilt":{"s":6,"a":4,"e":16,"d":4,"ang":90,"k":60,"b":15,"g":{"x":0.12,"y":0.6,"r":0.33999999999999997}},"down_tilt":{"s":5,"a":3,"e":16,"d":4,"ang":72,"k":52,"b":16,"g":{"x":0.56,"y":-0.31,"r":0.25,"in":[0.12,-0.31]}},"dash_attack":{"s":9,"a":4,"e":23,"d":6,"ang":60,"k":78,"b":25,"g":{"x":0.49,"y":0.04,"r":0.375}},"forward_smash":{"s":15,"a":3,"e":28,"d":9,"ang":42,"k":95,"b":28,"g":{"x":0.62,"y":0.18,"r":0.41000000000000003}},"up_smash":{"s":12,"a":4,"e":26,"d":8,"ang":88,"k":87,"b":25,"g":{"x":0,"y":0.68,"r":0.42500000000000004}},"down_smash":{"s":13,"a":4,"e":27,"d":8,"ang":35,"k":92,"b":27,"g":{"x":0.5,"y":-0.25,"r":0.27,"rear":[-0.5,-0.25,0.27]}},"neutral_air":{"s":6,"a":8,"e":19,"d":5,"ang":62,"k":65,"b":19,"g":{"x":0,"y":0,"r":0.495}},"forward_air":{"s":8,"a":3,"e":22,"d":6,"ang":46,"k":73,"b":22,"g":{"x":0.55,"y":0.07,"r":0.275}},"back_air":{"s":8,"a":3,"e":22,"d":6,"ang":39,"k":76,"b":25,"g":{"x":-0.48,"y":0.1,"r":0.28}},"up_air":{"s":7,"a":4,"e":18,"d":5,"ang":82,"k":62,"b":20,"g":{"x":0.04,"y":0.64,"r":0.31}},"down_air":{"s":13,"a":3,"e":26,"d":6,"ang":270,"k":72,"b":18,"g":{"x":0,"y":-0.6,"r":0.32499999999999996}},"grab":{"s":8,"a":2,"e":24,"d":0,"ang":0,"k":0,"b":0,"g":{"x":0.55,"y":0.05,"r":0.25,"in":[0.2,0.05]}},"pummel":{"s":4,"a":2,"e":9,"d":1,"ang":0,"k":0,"b":0,"g":{"x":0,"y":0,"r":0.25}},"forward_throw":{"s":10,"a":1,"e":20,"d":5,"ang":45,"k":73,"b":28,"g":{"x":0,"y":0,"r":0.25}},"back_throw":{"s":12,"a":1,"e":20,"d":6,"ang":137,"k":78,"b":33,"g":{"x":0,"y":0,"r":0.25}},"up_throw":{"s":11,"a":1,"e":18,"d":5,"ang":89,"k":60,"b":29,"g":{"x":0,"y":0,"r":0.25}},"down_throw":{"s":12,"a":1,"e":18,"d":4,"ang":72,"k":55,"b":25,"g":{"x":0,"y":0,"r":0.25}}},"forms":[{"name":"Rusty","weight":100,"run":1,"air":1,"grav":1,"nb":{"s":10,"e":18,"d":6,"v":[0.38],"life":65,"ang":40},"sb":{"s":12,"aim":20,"d":13,"v":0.55,"ticks":32},"fs":{"damage":18,"startup":18,"reach_W":1.22,"angle":40},"nair":9,"dash":9},{"name":"Bolt","weight":88,"run":1.15,"air":1.11,"grav":1.04,"nb":{"s":8,"e":20,"d":3,"v":[0.42,0.48],"life":52,"ang":62},"sb":{"s":10,"aim":16,"d":9,"v":0.72,"ticks":28},"fs":{"damage":14,"startup":14,"reach_W":1.34,"angle":48},"nair":8,"dash":8},{"name":"Cinder","weight":115,"run":0.86,"air":0.88,"grav":1.08,"nb":{"s":17,"e":25,"d":9,"v":[0.3],"life":50,"ang":50},"sb":{"s":17,"aim":22,"d":18,"v":0.45,"ticks":40},"fs":{"damage":21,"startup":23,"reach_W":1.17,"angle":42},"nair":11,"dash":10},{"name":"Pip","weight":87,"run":1.06,"air":1.12,"grav":0.97,"nb":{"s":12,"e":20,"d":null,"v":[0.34],"life":48,"ang":60},"sb":{"s":12,"aim":18,"d":5,"v":0.54,"ticks":33},"fs":{"damage":15,"startup":18,"reach_W":1.26,"angle":47},"nair":8,"dash":8},{"name":"Pearl","weight":96,"run":0.96,"air":1.08,"grav":0.87,"nb":{"s":15,"e":24,"d":5,"v":[0.28],"life":55,"ang":78},"sb":{"s":13,"aim":20,"d":8,"v":0.47,"ticks":37},"fs":{"damage":16,"startup":18,"reach_W":1.27,"angle":44},"nair":8,"dash":8}],"special":{"Rusty":[{"s":9,"a":3,"e":19,"d":3},{"s":11,"a":5,"e":21,"d":6},{"s":6,"a":1,"e":26,"d":2}],"Bolt":[{"s":7,"a":6,"e":16,"d":5},{"s":9,"a":7,"e":24,"d":5},{"s":8,"a":4,"e":28,"d":3}],"Cinder":[{"s":15,"a":5,"e":25,"d":6},{"s":14,"a":10,"e":31,"d":8},{"s":15,"a":4,"e":32,"d":6}],"Pip":[{"s":12,"a":3,"e":19,"d":5},{"s":10,"a":7,"e":25,"d":6},{"s":8,"a":10,"e":29,"d":3}],"Pearl":[{"s":15,"a":2,"e":27,"d":6},{"s":10,"a":7,"e":23,"d":5},{"s":7,"a":13,"e":31,"d":2}]},"upb":{"name":"Catastrophic Launch","startup":7,"charge_max_frames":45,"manual_release_required":true,"charge_damage_points":[[0,8],[10,8],[25,13],[44,18],[45,24]],"direction":"full 360 degrees, using main stick only after initiating Up+B","flight_ticks":"12-38 depending charge, tune by engine W","initial_velocity_W_per_tick":"0.34-0.80 scaled smoothly with charge","max_active_hitbox":"ellipsoid 0.65W x 0.57W around compound entity, one hit per opponent","landing_lag_frames":28,"ground_collision":"shallow hit -> deterministic skid; steep hit -> 1 reduced-energy bounce, no recursive energy gain","charge_physics":"gravity remains on (reduced 25%) and horizontal traction reduces; cannot suspend indefinitely","state":"unavailable once per airtime; reset on landing/ledge normal recovery; hold charge at cap without auto-launch, until button released or interrupted","kill_tier":"at max charge target around Flare Blitz-level feel, not guaranteed identical damage or KO percent","armor":"none"}};
/* FOWL-DATA-END */
/* ---------- Furious Fowls (the owner's document, assets/fowls/source/spec.md) ----------
   One fighter in two shapes. Combined: a living slingshot with one of five birds in its pouch (forms 0 to 4). Side special
   fires the bird itself: control goes with the bird, which then fights alone as a smaller, weaker fighter (forms 5 to 9)
   while the empty slingshot waits where it was. Down special beside the slingshot puts the bird back. Down special while
   combined changes bird. One damage meter and one set of stocks throughout.
   Every frame count, damage, angle and knockback number is the document's (FOWL, above). W is the slingshot's width and
   B a lone bird's; speeds the document gives in W a tick are scaled by FV so a launch crosses about half the stage. */
const FW = 10, FB = 6.5, FV = 4.5;
function fowlHit(q, unit, cy, extra) {
  const g = q.g || { x: 0, y: 0, r: 0.25 }, h = Object.assign({ f0: q.s + 1, f1: q.s + q.a, x: +(g.x * unit).toFixed(1), y: +(cy + g.y * unit).toFixed(1), r: +Math.max(2.4, g.r * unit).toFixed(1), d: q.d, a: q.ang, b: q.b, k: q.k }, extra);
  if (g.in) h.in = [+(g.in[0] * unit).toFixed(1), +(cy + g.in[1] * unit).toFixed(1)]; return h;
}
function fowlNormals(m, src, unit, cy, jabs) {
  const map = jabs === 3 ? { jab: 'jab_1', jab2: 'jab_2', jab3: 'jab_finisher' } : { jab: 'jab' };
  Object.assign(map, { ftilt: 'forward_tilt', utilt: 'up_tilt', dtilt: 'down_tilt', dash: 'dash_attack', fsmash: 'forward_smash', usmash: 'up_smash', dsmash: 'down_smash', nair: 'neutral_air', fair: 'forward_air', bair: 'back_air', uair: 'up_air', dair: 'down_air' });
  for (const k in map) { const q = src[map[k]], tm = m[k]; if (!q || !tm) continue; tm.t = q.s + q.a + q.e; tm.h = [fowlHit(q, unit, cy)];
    if (q.g && q.g.rear) tm.h.push(fowlHit(Object.assign({}, q, { g: { x: q.g.rear[0], y: q.g.rear[1], r: q.g.rear[2] } }), unit, cy));
    if (tm.chg) tm.chg = Math.max(2, q.s - 1); if (tm.chain) tm.chain = q.s + q.a + 1; if (tm.ac) tm.ac = q.s + q.a + 9; }
  const g = src.grab, gh = fowlHit(g, unit, cy); for (const [k, add, dx] of [['grab', 0, 0], ['dgrab', 3, 2.5], ['pgrab', 4, 3.2]]) { m[k].t = g.s + g.a + g.e + add * 2; m[k].h = [{ f0: gh.f0 + add, f1: gh.f1 + add, x: gh.x + dx, y: gh.y, r: Math.max(3.6, gh.r), grab: 1, d: 0 }]; }
  for (const [k, id] of [['f', 'forward_throw'], ['b', 'back_throw'], ['u', 'up_throw'], ['d', 'down_throw']]) { const q = src[id]; m.throws[k] = { d: q.d, a: q.ang, b: q.b, k: q.k }; }
  return m;
}
/* a later, weaker part of a lingering hit */
function fowlLate(mv, d) { const h = mv.h[0], cut = h.f0 + Math.max(1, Math.round((h.f1 - h.f0) * 0.35)); mv.h.push(Object.assign({}, h, { f0: cut + 1, d, k: Math.round(h.k * 0.8), part: 'late' })); h.f1 = cut; }
function fowlBoom(p) { const b = p.boom; PROJ.push({ x: p.x, y: p.y, vx: 0, vy: 0, grav: 0, life: 4, owner: p.owner, face: p.face, r: b.r, ground: 'pass', plat: null, kind: 'blast', h: { d: b.d, a: 70, b: 40, k: b.k || 70, id: p.h.id + ':boom' } }); spark(p.x, p.y, '#ffb347', 18, 2); beep(120, 0.2, 'sawtooth', 0.06, 0.5); }
function fowlAmmo(f, b, second) {
  const nb = b.nb, v = nb.v[second ? 1 : 0] * FV, base = { kind: 'dummy', tag: 'fowl', oy: 8, vx: v, r: 2.2, life: nb.life };
  if (b.name === 'Rusty') shoot(f, Object.assign(base, { max: 2, h: { d: nb.d, a: nb.ang, b: 25, k: 90 } }));
  else if (b.name === 'Bolt') shoot(f, Object.assign(base, { max: 4, r: 1.6, h: { d: nb.d, a: nb.ang, b: 15, k: 40 } }));
  else if (b.name === 'Cinder') shoot(f, Object.assign(base, { max: 1, r: 2.6, vy: 1.3, grav: 0.07, boom: { r: 0.64 * FW, d: nb.d, k: 80 }, h: { d: nb.d, a: nb.ang, b: 40, k: 80 } }));
  else if (b.name === 'Pip') shoot(f, Object.assign(base, { max: 3, split: 12, h: { d: 3, a: nb.ang, b: 20, k: 45 } }));
  else shoot(f, Object.assign(base, { max: 1, boom: { r: 0.55 * FW, d: 5, k: 55 }, h: { d: 5, a: nb.ang, b: 22, k: 50 } }));   /* Pearl: the dummy, then its egg; 10% at most together */
  beep(480, 0.06, 'triangle', 0.04, 0.9);
}
function fowlLaunch(f, b) {
  const a = (f.fowlAim || 0) * Math.PI / 180, sp = b.sb.v * FV;
  f.sling = { x: f.x, y: f.y, face: f.face, vy: 0, plat: f.grounded ? f.plat : null, lost: 0 };
  f.fi += 5; f.y += 6; f.grounded = false; f.plat = null; f.startMove('launch'); f.flyV = [Math.cos(a) * sp * f.face, Math.sin(a) * sp]; f.vx = f.flyV[0]; f.vy = f.flyV[1]; f.flyB = false; f.flyD = b.sb.d;
  spark(f.x, f.y, '#fff', 14, 2); beep(300, 0.12, 'square', 0.06, 1.6);
}
function fowlAbility(f, name) {   /* the one mid-flight action each bird has */
  f.flyB = true; const id = { id: 'fowl:ability' };
  if (name === 'Rusty') shoot(f, { kind: 'blast', ox: 0.01, oy: 3, vx: 0, r: 0.85 * FW, life: 3, h: { d: 3, a: 60, b: 45, k: 30 } });
  else if (name === 'Bolt') { const k = 1 + 0.38 / 0.72; f.flyV = [f.flyV[0] * k, f.flyV[1] * k]; f.flyD = 14; }
  else if (name === 'Cinder') { shoot(f, { kind: 'blast', ox: 0.01, oy: 3, vx: 0, r: 9, life: 4, h: { d: 16, a: 65, b: 45, k: 92 } }); f.flyV = [f.flyV[0] * 0.2, 0.18 * FV]; f.flyD = 0; f.mf = Math.max(f.mf, f.move.t - 8); shake = Math.max(shake, 6); }
  else if (name === 'Pip') { for (const dy of [5, -5]) shoot(f, { kind: 'clone', ox: 0.01, oy: 3.5 + dy, vx: Math.abs(f.flyV[0]), vy: f.flyV[1], r: 3, life: 24, h: { d: 3, a: 50, b: 25, k: 40 } }); }
  else { shoot(f, { kind: 'egg', ox: 0.01, oy: 0, vx: 0, vy: -0.4, grav: 0.09, r: 2.2, life: 90, boom: { r: 0.55 * FW, d: 9, k: 70 }, h: { d: 9, a: 70, b: 35, k: 70 } }); f.flyV = [f.flyV[0], f.flyV[1] + 0.16 * FV]; }
  spark(f.x, f.y + 3, '#ffe9a8', 12, 1.6); beep(640, 0.08, 'triangle', 0.05, 1.3);
}
function fowlRejoin(f) { const s = f.sling; f.x = s.x; f.y = s.y; f.fi -= 5; f.sling = null; f.move = null; f.vx = f.vy = 0; f.grounded = !!s.plat; f.plat = s.plat; f.set(f.grounded ? 'idle' : 'air'); spark(f.x, f.y + 8, '#fff', 12, 1.4); beep(520, 0.08, 'triangle', 0.05, 1.2); }
function fowlSlings() {   /* the empty slingshot: it falls to the floor, and comes back by the nearest ledge if it is lost */
  for (const f of F) { const s = f.sling; if (!s) continue;
    if (!s.plat) { const y0 = s.y; s.vy = Math.max(s.vy - 0.1, -2.4); s.y += s.vy; for (const q of PLATS) if (y0 >= q.y && s.y <= q.y && s.x >= q.x0 && s.x <= q.x1) { s.plat = q; s.y = q.y; s.vy = 0; } }
    if (s.y < BLAST.b + 10 && ++s.lost > 45) { s.x = clamp(s.x, -EDGE + 8, EDGE - 8); s.y = 0; s.plat = MAIN; s.vy = 0; s.lost = 0; spark(s.x, 6, '#fff', 14, 1.6); } }
}
const FOWLS = { name: 'Furious Fowls', sub: 'five birds and a slingshot', fowl: 1, cycle: 5, forms: [] };
(function () {
  const base = FLINT.forms[0].st, UP = FOWL.upb, COL = { Rusty: ['#b5533a', '#f1d7a8', '#f6a623'], Bolt: ['#f2b91e', '#2f6f78', '#fff3c4'], Cinder: ['#3a3134', '#a8623a', '#f26b1d'], Pip: ['#2bb8b0', '#bfeccd', '#ffffff'], Pearl: ['#f3e2cf', '#c9736b', '#ffffff'] };
  const SOLO = { Rusty: { up: 30, rush: 2.1 }, Bolt: { up: 26, rush: 3.1, diag: 1 }, Cinder: { up: 22, rush: 1.4, armor: [15, 17] }, Pip: { up: 32, rush: 2.3 }, Pearl: { up: 34, rush: 1.6, float: 1 } };
  const stat = (b, solo) => Object.assign({}, base, { weight: Math.round(base.weight * b.weight / 100 * (solo ? 0.8 : 1)), walk: +(base.walk * b.run).toFixed(2), dash: +(base.dash * b.run * (solo ? 1.05 : 1)).toFixed(2), run: +(base.run * b.run * (solo ? 1.05 : 1)).toFixed(2),
    airSpeed: +(base.airSpeed * b.air).toFixed(2), grav: +(base.grav * b.grav).toFixed(3), fall: +(base.fall * b.grav).toFixed(2), ffall: +(base.ffall * b.grav).toFixed(2), w: solo ? FB : FW, h: solo ? 7 : 15, jf: solo ? 2.6 : 3.4, jb: solo ? 1.4 : 2,
    upH: solo ? SOLO[b.name].up : undefined, pummel: solo ? 1 : 1.5 });
  const combined = FOWL.forms.map(b => { const C = FOWL.combined, sb = b.sb, nb = b.nb;
    const m = fowlNormals(mk(1, 1, 1, 1, {
      /* neutral special: wooden ammunition, a different kind for each bird */
      nspec: { t: nb.s + 1 + nb.e, h: [], on(f, n) { if (n === nb.s + 1) fowlAmmo(f, b, false); if (b.name === 'Bolt' && n === nb.s + 7) fowlAmmo(f, b, true); } },
      /* side special: aim with the stick during the wind-up, then the bird itself is fired and takes the controls with it */
      sspec: { t: sb.s + 3, h: [], on(f, n, i) { if (n <= sb.s) f.fowlAim = clamp(i.ly, -1, 1) * sb.aim + 8; if (n === sb.s + 1) fowlLaunch(f, b); } },
      /* up special, the same for all five: hold to charge (up to 45 frames), let go to fly where the stick points */
      uspec: { t: UP.startup + 1 + 38 + 3, helpless: 1, ledge: 1, ll: UP.landing_lag_frames, rise: 70, fowlUp: 1, blast: 1, h: [{ f0: UP.startup + 2, f1: UP.startup + 40, x: 0, y: 7.5, r: 0.61 * FW, d: 8, dd: a => a.upD || 8, a: 60, b: 42, k: 96 }],
        on(f, n, i) {
          if (n === 1) { f.upC = 0; f.upGo = 0; if (!f.grounded) f.blastUsed = true; }
          if (n > UP.startup && !f.upGo) {
            if (i.spc) { if (f.upC < UP.charge_max_frames) f.upC++; f.mf = UP.startup + 1; f.vx *= 0.9; if (!f.grounded && f.vy < -0.6) f.vy = -0.6; return; }   /* charging: it sinks slowly, it cannot hang for ever */
            const c = f.upC, t = c / UP.charge_max_frames, pts = UP.charge_damage_points; let dmg = pts[0][1]; for (let k = 1; k < pts.length; k++) if (c >= pts[k][0]) dmg = pts[k][1]; else { dmg += (pts[k][1] - dmg) * (c - pts[k - 1][0]) / Math.max(1, pts[k][0] - pts[k - 1][0]); break; }
            const mag = Math.hypot(i.lx, i.ly), dx = mag > 0.3 ? i.lx / mag : 0, dy = mag > 0.3 ? i.ly / mag : 1, sp = (0.34 + 0.46 * t) * FV;
            f.upD = Math.round(dmg * 10) / 10; f.upV = [dx * sp, dy * sp]; f.upGo = 12 + Math.round(26 * t); f.upEnd = f.mf + f.upGo; if (dx) f.face = sgn(dx); f.grounded = false; f.plat = null; spark(f.x, f.y + 6, '#fff', 16, 2); beep(220, 0.2, 'sawtooth', 0.07, 2);
          }
          if (f.upGo) { if (f.mf <= f.upEnd) { f.vx = f.upV[0]; f.vy = f.upV[1]; } else if (f.mf === f.upEnd + 1) { f.vx *= 0.4; f.vy *= 0.4; f.mf = f.move.t - 2; } }
        } },
      /* down special: the next bird (or the one before it, holding back) steps into the pouch; damage and stocks stay as they are */
      dspec: { t: 6, h: [], on(f, n, i) { if (n === 2) { f.fi = (f.fi + (i.lx * f.face < -0.5 ? 4 : 1)) % 5; spark(f.x, f.y + 10, '#fff', 10, 1.2); beep(660, 0.05, 'triangle', 0.04); } } },
    }, { jabs: 3 }), Object.assign({}, C, { down_air: null }), FW, 7.5, 3);
    m.fsmash.t = b.fs.startup + C.forward_smash.a + C.forward_smash.e; Object.assign(m.fsmash.h[0], { f0: b.fs.startup + 1, f1: b.fs.startup + C.forward_smash.a, d: b.fs.damage, a: b.fs.angle, x: +(b.fs.reach_W * FW - m.fsmash.h[0].r).toFixed(1) }); m.fsmash.chg = Math.max(2, b.fs.startup - 1);
    m.nair.h[0].d = b.nair; fowlLate(m.nair, Math.round(b.nair * 0.62)); if (b.name === 'Cinder') m.nair.h.forEach(h => { h.r = +(h.r * 1.15).toFixed(1); });
    m.dash.h[0].d = b.dash; fowlLate(m.dash, Math.round(b.dash * 0.67));
    /* down air: a wooden dummy fired straight down. It spikes for its first five frames, then pops up for 8%. The kick lifts the slingshot, once per time off the ground. */
    const q = C.down_air_wooden_red_dummy; m.dair = { t: q.s + q.a + q.e, air: 1, ll: 12, ac: q.s + q.a + 9, h: [], on(f, n) { if (n === q.s + 1) { shoot(f, { kind: 'dummy', tag: 'fowldown', max: 1, ox: 0.01, oy: 7.5 - 0.45 * FW, vx: 0, vy: -2.6, r: 0.22 * FW, life: 40, lateAt: 5, lateH: { d: 8, a: 70, b: 30, k: 60 }, h: { d: q.d, a: q.ang, b: q.b, k: q.k } }); if (!f.dairUsed) { f.dairUsed = true; f.vy = Math.max(f.vy, 0) + 0.15 * FV * 2; } } } };
    return { name: b.name, col: COL[b.name], alt: COL[b.name], reachMul: 1.0, st: stat(b, false), aiShot: [26, 90], aiSide: 1, sling: 1, moves: m };
  });
  const solo = FOWL.forms.map(b => { const S = FOWL.solo, sp = FOWL.special[b.name], q0 = sp[0], q1 = sp[1], q2 = sp[2], X = SOLO[b.name], sb = b.sb;
    const m = fowlNormals(mk(1, 1, 1, 1, {
      nspec: b.name === 'Pearl' ? { t: q0.s + q0.a + q0.e, h: [], on(f, n) { if (n === q0.s + 1) shoot(f, { kind: 'egg', tag: 'egg', max: 1, oy: 4, vx: 1.2, vy: 0.9, grav: 0.08, r: 1.8, life: 70, h: { d: q0.d, a: 60, b: 25, k: 50 } }); } }
        : { t: q0.s + q0.a + q0.e, h: [{ f0: q0.s + 1, f1: q0.s + q0.a, x: 0, y: 3.5, r: b.name === 'Cinder' ? 0.8 * FB : 0.65 * FB + 1, d: q0.d, a: 60, b: 28, k: 45 }] },
      sspec: { t: q1.s + q1.a + q1.e, once: 1, nodrift: 1, armor: X.armor, armorMax: X.armor ? 8 : undefined, armorHits: X.armor ? 1 : undefined, h: [{ f0: q1.s + 1, f1: q1.s + q1.a, x: 3, y: 3.5, r: 4, d: q1.d, a: 45, b: 34, k: 70 }],
        on(f, n) { if (n > q1.s && n <= q1.s + q1.a) { f.vx = f.face * X.rush; if (!f.grounded) f.vy = Math.max(f.vy, X.float ? 0.2 : 0); } if (n === q1.s + q1.a + 1) f.vx *= 0.4; } },
      uspec: { t: q2.s + q2.a + q2.e, helpless: 1, ledge: 1, h: [{ f0: q2.s + 1, f1: q2.s + q2.a, x: 0, y: 4, r: 4.5, d: q2.d, a: 80, b: 40, k: 40 }],
        on(f, n, i) { if (n <= q2.s) hang(f); if (n === q2.s + 1) { lift(f, f.st.vUp * (X.diag ? 0.85 : 1)); f.vx = X.diag ? (sgn(i.lx) || f.face) * 2.2 : i.lx * (X.float ? 1.1 : 0.7); } } },
      /* down special: back into the pouch, when standing beside the slingshot. Anywhere else it does nothing. */
      dspec: { t: 8, h: [], on(f, n) { if (n === 6 && f.sling && Math.hypot(f.x - f.sling.x, f.y - f.sling.y) < 0.9 * FW + 3) fowlRejoin(f); } },
      /* the flight out of the pouch: straight along the aim for a set time; special, once, does that bird's own trick */
      launch: { t: sb.ticks + 1, nodrift: 1, ll: 10, h: [{ f0: 1, f1: sb.ticks, x: 0, y: 3.5, r: 4.2, d: sb.d, dd: a => a.flyD, a: 45, b: 40, k: 88 }],
        on(f, n) { if (f.flyV) { f.vx = f.flyV[0]; f.vy = f.flyV[1]; } if (n > 2 && !f.flyB && f.ctl.take('spc')) fowlAbility(f, b.name); } },
    }, { jabs: 1 }), S, FB, 3.5, 1);
    return { name: b.name + ' alone', col: COL[b.name], alt: COL[b.name], reachMul: 1.0, st: stat(b, true), aiSide: 1, moves: m };
  });
  FOWLS.forms = combined.concat(solo);
})();
const ROSTER = [FLINT, WREN, SACK, SPROCKET, SCUTTLE, FOWLS];
/* Hitbox positions measured from the animations (hitboxes.js, written with tools/measure.html). Timing, damage and launch stay as defined above. */
if (typeof HITBOXES !== 'undefined') for (const def of ROSTER) for (const fm of def.forms) {
  const set = HITBOXES[fm.name]; if (!set) continue;
  for (const k in set) { const mv = fm.moves[k]; if (mv) set[k].forEach((o, n) => { if (mv.h[n]) Object.assign(mv.h[n], o); }); }
}
for (const def of ROSTER) for (const fm of def.forms) {
  applyKit(fm); applyTune(fm);
  /* where an attack has a weaker part near the body, that part is tried first: a close target takes the weak hit, and only a well-spaced one takes the tip */
  for (const k in fm.moves) { const m = fm.moves[k]; if (m && Array.isArray(m.h) && m.h.some(x => x.part === 'near')) m.hp = m.h.filter(x => x.part === 'near').concat(m.h.filter(x => x.part !== 'near')); }
}
/* Strike shapes (combat audit, 2026-11-10).
   - A strike whose tip is clear of the body also covers the 45% of the way back toward the body's middle (h.in): the
     arm, leg or tool hits, not only its end. Moves that already have a weaker part near the body keep that instead. */
for (const def of ROSTER) for (const fm of def.forms) for (const k in fm.moves) {
  const m = fm.moves[k], st = fm.st; if (!m || !Array.isArray(m.h) || k === 'throws') continue; const sour = m.h.some(h => h.part === 'near');
  for (const h of m.h) { if (h.grab || h.wind || h.away || h.in || h.airOnly && h.a > 180) continue;
    const cx = 0, cy = st.h * 0.5, d = Math.hypot(h.x - cx, h.y - cy); if (sour || d < h.r + 2) continue;
    h.in = [Math.round((h.x + (cx - h.x) * 0.45) * 10) / 10, Math.round((h.y + (cy - h.y) * 0.45) * 10) / 10]; }
}
/* Reach by archetype (hitbox size only, grabs excluded), and the distance the CPU likes to attack from. */
for (const def of ROSTER) for (const fm of def.forms) {
  if (fm.reachMul) for (const k in fm.moves) { const mv = fm.moves[k]; if (mv && Array.isArray(mv.h)) for (const h of mv.h) if (!h.grab) h.r = Math.round(h.r * fm.reachMul * 10) / 10; }
  const ft = fm.moves.ftilt.h[0]; fm.aiRange = Math.round(ft.x + ft.r * 0.5 + 3);
  fm.aiTempo = fm.moves.ftilt.t / 27;   /* quick fighters attack more often, slow ones less */
  /* How high the up special and an air jump carry, found by running the up special on a stand-in. The CPU uses these so it
     never recovers itself into the top blast zone. */
  if (fm.st.upH) fm.st.vUp = jumpV(fm.st.upH, fm.st.grav);   /* an up special's height (upH) as a launch speed */
  const u = fm.moves.uspec, d = { vx: 0, vy: 0, grounded: false, plat: null, face: 1, st: fm.st }; let y = 0, top = 0;
  for (let n = 1; n <= 120 && !u.rise; n++) { if (n <= u.t && u.on) u.on(d, n, { lx: 0, ly: 0 }); d.vy = Math.max(d.vy - fm.st.grav, -fm.st.fall); y += d.vy; top = Math.max(top, y); }
  const st = fm.st;   /* launch speeds from the jump heights */
  st.vJump = jumpV(st.jumpH, st.grav); st.vHop = jumpV(st.hopH, st.grav); st.vAir = jumpV(st.airJumpH, st.grav);
  st.vRise = jumpV(st.jumpH - st.jumpInit, st.grav); st.boost = MOVE.boost.map(k => k * st.jumpInit); st.vBurst = jumpV(30, st.grav);
  if (u.rise) top = u.rise;   /* a move that launches its user says how high it carries, since it cannot be tried on a stand-in */
  fm.aiRise = top; fm.aiHop = st.airJumpH;
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
    this.x = first ? (this.idx ? 28 : -28) : 0; this.y = first ? 0 : 82; this.vx = this.vy = 0;
    if (first) this.face = this.idx ? -1 : 1;
    this.grounded = !!first; this.plat = first ? MAIN : null; this.state = first ? 'idle' : 'respawn'; this.sf = 0;
    this.jumps = this.st.jumps || 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ff = false;
    this.wall = 0; this.wallT = 0; this.wallJumps = 0; this.sdi = 0; this.airT = 0; this.jr = 0; this.jrV = 0; this.rapidN = 0; this.aim = 0;
    this.pct = 0; this.shieldHp = 50; this.invuln = 0; this.hitlag = 0; this.hitstun = 0; this.ledgeCd = 0; this.dropT = 0; this.dropPlat = null;
    this.move = null; this.mf = 0; this.charge = 0; this.hitG = new Set(); this.parriedBy = null; this.victim = null; this.lag = 0; this.flash = 0;
    this.stale = []; this.staled = false; this.staleM = 1; this.shortHop = false; this.moveSH = false; this.shMacro = false; this.grabImm = 0; this.ledgeGrabs = 0;
    this.dodgeStale = 0; this.dodgeT = 0; this.ds = 0; this.tumble = false; this.techT = 0; this.techLock = 0; this.pumT = 0; this.wdHold = false;
    this.chargeT = 0; this.stalled = false; this.stallOk = false; this.cAir = null; this.hopT = 0; this.sling = null; this.dairUsed = false; this.upC = 0; this.upGo = 0; this.flyV = null; this.flyB = false; this.dove = false; this.burstKind = ''; this.burstX = 0; this.burstDown = false; this.burstUsed = false; this.blastUsed = false; this.swapLock = 0; this.slingUsed = false; this.thermal = false; this.recoil = false; this.bigStone = false; this.armorLeft = 99; this.castHit = false;
  }
  /* Dodges used back to back protect for less time and leave more lag. */
  dodge() { this.ds = this.dodgeStale; this.dodgeStale = Math.min(5, this.dodgeStale + 1); this.dodgeT = 0; }
  set(s) { this.state = s; this.sf = 0; }
  startMove(n) {
    const m = this.form.moves[n]; this.move = m; this.mname = n; this.mf = 0; this.charge = 0; this.chargeT = 0; this.aim = 0;
    this.stallOk = !!m.stall && !this.grounded && !this.stalled; if (this.stallOk) this.stalled = true;
    this.armorLeft = m.armorHits || 99; this.castHit = false;   /* a move that hangs in the air does so once per time off the ground */
    if (!m.rapid) this.rapidN = 0; this.hitG = new Set(); this.parriedBy = null; this.staled = false; this.moveSH = !!(m.air && this.shortHop); this.set('attack');
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
    const mv = this.form.moves[n]; if (!this.grounded && ((mv.burst && this.burstUsed) || (mv.blast && this.blastUsed))) return;
    if (mv.swap && this.swapLock > 0) return;   /* too soon after the last swap */   /* spent until it lands */
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
    if (c.buf.atk > 0 && c.buf.atk === c.buf.spc) {   /* attack and special pressed together: a smash, in the direction held or forward */
      c.buf.atk = c.buf.spc = 0; let n = 'fsmash';
      if (Math.abs(i.ly) > 0.5 && Math.abs(i.ly) > Math.abs(i.lx)) n = i.ly > 0 ? 'usmash' : 'dsmash'; else if (Math.abs(i.lx) > 0.3) this.face = sgn(i.lx);
      this.startMove(n); this.vx *= 0.3; return true;
    }
    if (c.take('spc')) { this.doSpecial(); return true; }
    /* Jump and attack pressed together: a short-hop aerial (the attack stays buffered for the jump). */
    if (c.buf.jmp > 0 && c.buf.atk > 0 && Math.abs(c.buf.jmp - c.buf.atk) <= 1) { c.buf.jmp = 0; this.set('jsq'); return true; }
    if (c.take('atk')) { this.groundAttack(moving); return true; }
    /* The right stick is a tilt stick: a tilt in the direction pushed, turning round for a sideways one. */
    if (c.cPress) { let n; if (Math.abs(i.cy) > Math.abs(i.cx)) n = i.cy > 0 ? 'utilt' : 'dtilt'; else { this.face = sgn(i.cx); n = 'ftilt'; } this.startMove(n); if (n === 'ftilt') this.aim = i.cy > 0.25 ? 1 : i.cy < -0.25 ? -1 : 0; this.vx *= 0.3; return true; }
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
        c.buf.jmp = 0; this.vy = s.vJump * 0.92; this.ff = false; this.shortHop = false; this.y = Math.max(this.y, o.y + o.st.h);
        o.footstooled(); spark(this.x, this.y, '#fff', 12, 1.4); pop(this.x, this.y + 8, 'STOMP', '#fff'); beep(640, 0.07, 'triangle', 0.05, 1.5); return false;
      }
    }
    /* wall jump (only some fighters): flick away from a wall just touched */
    if (s.wallJump && this.wallT > 0 && c.dashDir === this.wall && this.wallJumps < 2) {
      this.wallJumps++; this.wallT = 0; this.vy = s.vJump * 0.92; this.vx = this.wall * 1.5; this.face = this.wall; this.ff = false;
      spark(this.x - this.wall * 3, this.y + 4, '#fff', 10, 1.2); beep(560, 0.05, 'sine', 0.04, 1.4); return false;
    }
    if (c.buf.jmp > 0 && this.jumps > 0) { c.buf.jmp = 0; this.jumps--; this.shortHop = false; this.vy = s.vAir * (1 - 0.1 * Math.max(0, (s.jumps || 1) - 1 - this.jumps)); if (Math.abs(i.lx) > 0.2) this.vx = i.lx * s.airSpeed * s.airJumpX; this.ff = false; spark(this.x, this.y, '#fff', 6, 0.8); beep(500, 0.05, 'sine', 0.03, 1.4); }
    this.fastFall();
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
  /* Hoppers: which part of the hop this frame is. Returns the speed multiplier while moving, 0 while planted. */
  hopGate(c) { const ph = this.hopT++ % (c[0] + c[1]); return ph < c[0] ? c[2] : 0; }
  /* A downward flick while falling: drop at full fast-fall speed at once. */
  fastFall() { if (this.ctl.downNow && this.vy <= 0 && !this.ff) { this.ff = true; this.vy = -this.st.ffall; } }
  /* Ground speed toward a target: the fighter's own push when speeding up, the floor's grip when over the target or turning round. */
  groundMove(t, acc) { const v = this.vx; if (v * t < 0) return appr(v, t, acc + this.st.trac); return Math.abs(v) > Math.abs(t) ? appr(v, t, this.st.trac) : appr(v, t, acc); }
  airPhys(drift) {
    const s = this.st, i = this.ctl.c, over = Math.abs(this.vx) > Math.max(s.jumpXMax, s.airSpeed) + 0.05 ? MOVE.launchBrake : s.airBrake;   /* speed left over from a launch dies away faster */
    if (drift && Math.abs(i.lx) > 0.2) { const t = i.lx * s.airSpeed; if (this.vx * t > 0 && Math.abs(this.vx) > Math.abs(t)) this.vx = appr(this.vx, t, over); else this.vx = appr(this.vx, t, s.airAdd + s.airMul * Math.abs(i.lx)); }
    else this.vx = appr(this.vx, 0, over);
    /* The first frames of a full hop: a fixed climb, then the launch speed for the rest. Anything else that sets the speed ends it. */
    if (this.jr > 0) {
      if (this.vy === this.jrV) { this.vy = this.jrV = this.jr < 4 ? s.boost[this.jr] : s.vRise; this.jr = this.jr < 4 ? this.jr + 1 : 0; return; }
      this.jr = 0;
    }
    this.vy -= s.grav; const mf = this.ff ? s.ffall : s.fall; if (this.vy < -mf) this.vy = -mf;
  }
  touchDown(p) { this.grounded = true; this.plat = p; this.y = p.y; this.vy = 0; this.jr = 0; this.stalled = false; this.burstUsed = false; this.blastUsed = false; this.slingUsed = false; this.dairUsed = false; this.wallJumps = 0; this.jumps = this.st.jumps || 1; this.airdodged = false; this.sideUsed = false; this.ledgeUsed = false; this.ledgeGrabs = 0; this.ff = false; this.shortHop = false; }
  land(p) {
    const st = this.state, hard = this.ff; this.touchDown(p);
    if (st === 'attack' && this.move.burst) {   /* a tumble never falls over: a dive that reaches the floor carries on as a slide, anything else lands ready to act */
      if (this.burstKind === 'dive') { this.burstKind = 'slide'; spark(this.x, this.y, '#ddd', 8, 1.2); } else { this.move = null; this.set('idle'); }
    }
    else if (st === 'attack') { const m = this.move; if (m.onLand) m.onLand(this, this.mf); this.lag = m.air ? (this.mf < (m.h[0] ? m.h[0].f0 : 99) - 1 || this.mf > m.ac ? (hard ? 4 : 2) : m.ll) : (m.ll || 8); this.move = null; this.set('land'); }
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
    if (s === 'attack' && this.move && this.move.burst) return true;   /* a tumble carries off the edge */
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
    if (this.def.fowl) { this.sling = null; if (this.fi >= 5) this.fi -= 5; }   /* a lost stock puts the bird back in the pouch */
    this.stocks--; F[1 - this.idx].kos++; this.move = null; this.vx = this.vy = 0; this.grounded = false; this.plat = null; this.set('dead'); PROJ = PROJ.filter(p => p.owner !== this.idx);
  }
  update() {
    const c = this.ctl, i = c.c;
    if (this.invuln > 0) this.invuln--; if (this.swapLock > 0) this.swapLock--; if (this.ledgeCd > 0) this.ledgeCd--; if (this.dropT > 0) this.dropT--; if (this.flash > 0) this.flash--;
    if (!i.shd) this.wdHold = false;   /* the shield press that made a wavedash does not turn into a shield while still held */
    if (this.grabImm > 0) this.grabImm--; if (this.wallT > 0) this.wallT--; if (this.techT > 0) this.techT--; if (this.techLock > 0) this.techLock--;
    if (c.pressed('shd')) { if (this.techLock === 0) this.techT = 20; this.techLock = 40; }
    if (this.grounded || this.state === 'ledge' || this.state === 'respawn') this.airT = 0; else this.airT++;   /* frames since last standing on something */
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
        if (Math.abs(i.lx) > 0.2) { this.face = sgn(i.lx); const hg = s.hop ? this.hopGate(s.hop.walk) : 1; this.vx = hg === 0 ? appr(this.vx, 0, 0.7) : this.groundMove(i.lx * s.walk * hg, s.walkAdd + s.walkMul * Math.abs(i.lx)); }
        else { this.vx = appr(this.vx, 0, s.trac); this.hopT = 0; }
        break;
      case 'dash': {
        /* The speed from before is kept for a moment, then the burst; after it the fighter settles toward run speed. */
        const fwd = sgn(i.lx) === this.face && Math.abs(i.lx) > 0.5;
        if (this.sf === MOVE.dashKeep) this.vx = this.vx * this.face >= 0 ? this.face * s.dash : this.face * s.dash + this.vx;
        else if (this.sf > MOVE.dashKeep) this.vx = fwd ? this.groundMove(this.face * s.run * Math.abs(i.lx), s.runAdd + s.runMul * Math.abs(i.lx)) : appr(this.vx, 0, s.trac);
        if (this.groundActs(true)) break;
        if (this.sf >= (s.dashF || 14)) { if (s.hop) this.hopT = s.hop.run[0]; this.set(fwd && Math.abs(i.lx) > 0.6 ? 'run' : 'idle'); }   /* a hopper plants after its dash before the first run hop */
        break;
      }
      case 'run': {
        const hg = s.hop ? this.hopGate(s.hop.run) : 1;
        this.vx = hg === 0 ? appr(this.vx, 0, 0.7) : this.groundMove(this.face * s.run * hg * Math.abs(i.lx), s.runAdd + s.runMul * Math.abs(i.lx)); if (this.groundActs(true)) break;
        if (!(sgn(i.lx) === this.face && Math.abs(i.lx) > 0.5)) this.set('brake');
        break;
      }
      case 'brake':   /* skidding to a stop out of a run; a back flick here is a dash back */
        this.vx = appr(this.vx, 0, s.trac);
        /* Turning round out of a full run takes a skid first: the dash back waits until the run has bled off to 40% (about
           ten frames). Everything else (jump, attack, shield, grab) is free at once, and dash dancing inside a dash is untouched. */
        if (c.dashDir && c.dashDir * this.vx < 0 && Math.abs(this.vx) > s.run * 0.25) { c.xFired = false; c.xT = 0; c.dashDir = 0; }
        if (this.groundActs(false)) break;
        if (this.sf >= 12 || this.vx === 0) this.set('idle');
        break;
      case 'jsq':
        this.vx = appr(this.vx, 0, s.trac * 0.5);
        if (this.sf === 1) { this.shMacro = false; this.cAir = null; }
        if (c.shdAge <= this.sf + T.wd_jumpsquat_buffer && this.tryWavedash(true)) break;
        /* Out of a jump's start-up: an up smash (flick up with attack), attack with the jump for a short-hop aerial, or the right stick for an aerial the moment the fighter leaves the ground. */
        if (c.cPress) this.cAir = [i.cx, i.cy];
        if (c.buf.atk > 0) { if (i.ly > 0.5 && c.ySmash) { c.buf.atk = 0; this.startMove('usmash'); break; } this.shMacro = true; }
        if (this.sf >= s.jsq) { this.grounded = false; this.plat = null; this.jumps = s.jumps || 1; this.shortHop = !i.jmp || this.shMacro; if (this.shortHop) this.vy = s.vHop; else { this.vy = this.jrV = s.boost[0]; this.jr = 1; } this.vx = clamp(this.vx * s.jumpXMul + (Math.abs(i.lx) > 0.2 ? i.lx * s.jumpX : 0), -s.jumpXMax, s.jumpXMax); this.set('air'); beep(420, 0.05, 'sine', 0.03, 1.5); if (this.shMacro) { this.shMacro = false; if (c.take('atk')) this.startMove(this.aerial(i.lx, i.ly)); } else if (this.cAir) this.startMove(this.aerial(this.cAir[0], this.cAir[1])); this.cAir = null; }
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
        if (this.grounded) this.vx = appr(this.vx, 0, s.trac); else if (this.stallOk) { this.vy = 0; this.vx = appr(this.vx, 0, 0.08); }   /* hangs in the air until the move is over */
        else { this.airPhys(!m.nodrift); if (m.air) this.fastFall(); }
        /* A smash is charged by keeping attack held: its power grows for a second, and it can be held back for two more. */
        if (m.chg && this.mf === m.chg && this.chargeT < SMASH_HOLD && i.atk) { this.chargeT++; if (this.charge < 60) this.charge++; } else this.mf++;
        if (m.inv && this.mf === m.inv[0]) this.invuln = Math.max(this.invuln, m.inv[1] - m.inv[0]);   /* some moves cannot be hit for a few frames */
        if (m.on) m.on(this, this.mf, i);
        if (this.state === 'attack' && this.move === m && m.cancel && this.mf >= m.cancel) {   /* cut short into any action, keeping the speed */
          if (this.grounded) { if (this.groundActs(false)) break; }
          else { const j = this.jumps; if (this.airActs()) break; if (this.jumps < j) { this.endMove(); break; } }
          if (m.burst) {   /* the stick ends a tumble too: a push to a new side, or down again in the air */
            const sx = Math.abs(i.lx) > 0.5 ? sgn(i.lx) : 0, down = i.ly < -0.5; if (!down) this.burstDown = false;
            if ((sx && sx !== this.burstX) || (down && !this.burstDown && !this.grounded)) { this.endMove(); break; }
          }
        }
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
        if (this.sf > 6) {
          if (this.pumT > 0) this.pumT--;
          if (this.pumT === 0 && c.take('atk')) { this.pumT = 14; v.pct += (this.st.pummel || 1.3) * DMG_1V1; v.flash = 5; spark(v.x, v.y + 8, '#fff', 4, 0.8); beep(260, 0.04, 'square', 0.04); }
          /* Throw with either stick, held or flicked: the right stick wins if both are pushed. */
          const cs = Math.hypot(i.cx, i.cy) >= 0.5, tx = cs ? i.cx : i.lx, ty = cs ? i.cy : i.ly; let k = null;
          if (cs || Math.hypot(i.lx, i.ly) >= 0.6) k = Math.abs(ty) > Math.abs(tx) ? (ty > 0 ? 'u' : 'd') : (sgn(tx) === this.face ? 'f' : 'b');
          if (k) { this.throwK = k; this.set('throw'); }
          else if (this.sf > this.holdT && this.sf > GRAB_MIN) { this.freeVictim(); this.lag = 30; this.set('land'); }
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
        if (!this.grounded) this.vy = 0;   /* a catch in the air hangs there for the fling */
        if (this.sf >= 26) this.set(this.grounded ? 'idle' : 'air');
        break;
      }
      case 'ledge': {
        const side = sgn(this.x); this.vx = this.vy = 0;
        if (this.sf === 2 && this.ledgeInv) { this.invuln = Math.max(this.invuln, this.ledgeInv - 2); this.ledgeInv = 0; }   /* the protection starts on the third frame: the grab itself can be hit */
        if (this.sf > 8) {
          const toward = -side * i.lx, slow = this.pct >= 100;   /* worn down: every way up is slower and less protected */
          if (c.take('jmp')) { this.vy = s.vJump * 1.05; this.vx = -side * 0.7; this.ledgeCd = 30; this.set('air'); }
          else if (i.shd) { this.x = side * (EDGE - 22); this.touchDown(MAIN); this.ledgeUsed = true; this.lag = slow ? 26 : 18; this.invuln = slow ? 20 : 18; this.set('land'); }
          else if (c.take('atk')) { this.x = side * (EDGE - 6); this.touchDown(MAIN); this.ledgeUsed = true; this.startMove('getup'); if (slow) this.mf = -8; }
          else if (toward > 0.5 || i.ly > 0.5) { this.x = side * (EDGE - 5); this.touchDown(MAIN); this.ledgeUsed = true; this.lag = slow ? 22 : 14; this.invuln = slow ? 16 : 14; this.set('land'); }
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
    /* The solid island: its rim is a wall, and the rock under it slopes. Whoever touches either is moved out sideways to
       the surface and keeps rising or falling, so coming up from underneath ends beside the ledge, never against a ceiling. */
    const hw = s.w / 2, top = Math.min(this.y + s.h, 0), half = this.y < 0 ? stageHalf(top) : -1;
    if (half >= 0 && Math.abs(this.x) - hw < half) {
      {
        const side = this.x !== 0 ? sgn(this.x) : px < 0 ? -1 : 1; this.x = side * (half + hw);
        if (st === 'hurt') {
          /* Launched into the stage wall: shield just before impact to tech it (hold jump or up to spring off), otherwise bounce. */
          if (this.techT > 0 && Math.abs(this.vx) > 0.8) {
            this.techT = 0; this.vx = 0; this.vy = Math.max(this.vy, 0); this.invuln = 14; this.set('air');
            if (i.jmp || i.ly > 0.5) { this.vy = s.vJump * 0.9; this.vx = side * 1.1; }
            spark(this.x, this.y + s.h / 2, '#9ff', 12, 1.4); pop(this.x, this.y + s.h + 4, 'TECH', '#9ff'); beep(900, 0.05, 'triangle', 0.04);
          } else {
            if (Math.abs(this.vx) > 1.5) spark(this.x, this.y + s.h / 2, '#ddd', 8, 1.2);
            if (this.vx * side < 0) this.vx = -this.vx * 0.7;   /* thrown against the island, rim or rock: back out the way they came, never down under it */
          }
        } else { if (this.vx * side < 0) this.vx = 0; this.wall = side; this.wallT = 8; }
      }
    }
    /* Ledges. */
    const snap = st === 'attack' && this.move && this.move.ledge && this.mf > (this.move.h[0] ? this.move.h[0].f1 : 8);   /* an up special past its hit takes the ledge on the way up too */
    if (!s.noLedge && (this.vy < 0 || snap) && this.ledgeCd === 0 && i.ly > -0.5 && (st === 'air' || st === 'helpless' || (st === 'attack' && this.move && this.move.ledge))) {
      const side = sgn(this.x), out = Math.abs(this.x) - EDGE, hand = this.y + s.h, o = F[1 - this.idx];
      if (side && out > -1 && out < 13 && hand > -9 && hand < 9 && this.ledgeGrabs < 6) {
        if (o && o.state === 'ledge' && sgn(o.x) === side) { o.set('air'); o.vy = 1.3; o.vx = side * 0.9; o.ledgeCd = 45; o.invuln = 0; pop(o.x, o.y + 20, 'TRUMP', '#fff'); }
        this.ledgeGrabs++; this.shortHop = false;
        this.x = side * (EDGE + hw + 0.5); this.y = -s.h + 1; this.vx = this.vy = 0; this.face = -side; this.move = null; this.ff = false;
        this.jumps = s.jumps || 1; this.wallJumps = 0; this.airdodged = false; this.sideUsed = false; this.stalled = false; this.ledgeInv = 0; if (!this.ledgeUsed) { this.ledgeInv = clamp(Math.round(24 + Math.min(this.airT, 300) * 0.1 - Math.min(this.pct, 120) * 0.17), 8, 54); this.ledgeUsed = true; }   /* longer in the air earns more, damage takes it away */
        this.set('ledge'); beep(700, 0.04, 'triangle', 0.03);
      }
    }
  }
}

/* ---------- Combat ---------- */
const AIM_Y = 3.2;   /* how far an angled forward tilt lifts or lowers its hitbox */
function hitY(a, h) { return a.y + h.y + (a.aim || 0) * AIM_Y; }
/* The circles a hitbox is made of this frame, in the world. Most strikes are a run of three from near the body (h.in) out
   to the tip (h.x, h.y), so the whole arm, leg or tool hits and not only its end; the reach is the tip's, unchanged.
   back = 0 is where the attacker is now; back = 1 is where it was a frame ago, used to sweep fast moves. */
function hitCircles(a, h, back) {
  const ox = a.x - (back ? (a.x - a.px) * back : 0), oy = a.y - (back ? (a.y - a.py) * back : 0) + (a.aim || 0) * AIM_Y, tx = ox + h.x * a.face, ty = oy + h.y;
  if (!h.in) return [[tx, ty, h.r]];
  const ix = ox + h.in[0] * a.face, iy = oy + h.in[1]; return [[ix, iy, h.r], [(ix + tx) / 2, (iy + ty) / 2, h.r], [tx, ty, h.r]];
}
/* Does this hitbox touch that body? Checked where both are now and, if they closed more than a hitbox's width since the
   last frame, at the halfway point too, so nothing fast passes through between frames. */
function hitTouches(a, h, v) {
  const rel = Math.hypot((a.x - a.px) - (v.x - v.px), (a.y - a.py) - (v.y - v.py)), steps = rel > h.r && rel < 12 ? [0, 0.5] : [0];   /* a jump of 12 or more is a placement (ledge, respawn), not movement */
  for (const b of steps) { const r = hurtRect(v), sx = (v.x - v.px) * b, sy = (v.y - v.py) * b; for (const c of hitCircles(a, h, b).reverse()) if (circRect(c[0], c[1], c[2], r[0] - sx, r[1] - sy, r[2] - sx, r[3] - sy)) return c; }
  return null;
}
function knock(v, d, b, k) { const p = v.pct; return ((((p / 10 + p * d / 20) * 200 / (v.st.weight + 100) * 1.4) + 18) * k / 100) + b; }
function circRect(cx, cy, r, x0, y0, x1, y1) { const dx = cx - clamp(cx, x0, x1), dy = cy - clamp(cy, y0, y1); return dx * dx + dy * dy <= r * r; }
/* The body's hittable box. It shrinks when crouching or lying down, which is how a crouch slips under high attacks. */
function hurtRect(v) {
  const st = v.st; let w = st.w, h = st.h;
  if (v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y) h *= 0.62;
  else if (v.state === 'down') { h *= 0.42; w *= 1.4; }
  else if (v.state === 'ledge') return [v.x - w / 2, v.y, v.x + w / 2, v.y + h + 3];   /* head and hands show above the lip */
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
    if (n > 2 && vy <= 0 && y <= 0 && Math.abs(x) <= EDGE) return false;
  }
  return false;
}
let slowT = 0, focus = null;   /* slow motion and camera focus after a hit that will take the last stock */
function canBeHit(v) { return v.invuln === 0 && v.state !== 'dead' && v.state !== 'respawn' && v.state !== 'held'; }
function applyHit(a, v, h, face, srcX, proj, poke) { sparkOff = !DBG.fx; try { applyHitRaw(a, v, h, face, srcX, proj, poke); } finally { sparkOff = false; } }
function applyHitRaw(a, v, h, face, srcX, proj, poke) {
  const hx = v.x, hy = v.y + v.st.h / 2;
  if (h.grab) {
    if (v.state === 'held' || v.state === 'hold' || a.state !== 'attack' || (!a.grounded && !h.cmd)) return;   /* a grab that traded with a hit loses */
    if (h.cmd) {   /* a grab that is its own throw: caught and flung in one motion, on the ground or in the air */
      v.freeVictim(); a.move = null; a.victim = v; a.throwK = h.cmd; a.vx = a.vy = 0; a.set('throw'); v.move = null; v.grounded = false; v.plat = null; v.set('held'); beep(330, 0.06, 'triangle', 0.05); return;
    }
    v.freeVictim(); a.move = null; a.set('hold'); a.victim = v; a.holdT = Math.min(300, 90 + v.pct * 1.7); a.pumT = 0; v.move = null; v.grounded = false; v.plat = null; v.set('held'); beep(330, 0.06, 'triangle', 0.05); return;
  }
  if (!proj && a.parriedBy === v) return;
  if (h.wind) {   /* a gust: no damage and no hitstun, just a shove, weaker on someone standing; a shield stops it */
    if (v.state === 'shield' || v.state === 'shieldstun') return;
    v.vx += face * h.wind * (v.grounded ? 0.45 : 1); if (!v.grounded) v.vy += h.wind * 0.2; spark(hx, hy, '#e8dcff', 8, 1.2); return;
  }
  if (proj && h.cast && a.castHit) return;   /* the follow-up of a cast that already hit this target */
  const id = h.id || (a.form.name + ':' + a.mname); let d = (h.dd ? h.dd(a) : h.d) * DMG_1V1;   /* dd: damage worked out when it lands (a charged launch) */
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
  v.pct = Math.min(999, v.pct + d); v.flash = 6; if (!proj && a.move && a.move.cast) a.castHit = true;
  const crouch = v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y, charging = v.state === 'attack' && v.charge > 0;
  const kb = knock(v, d, h.b, h.k) * rage(a) * (crouch ? CROUCH_MUL : 1) * (charging ? CHARGING_MUL : 1);
  const hl = h.hl !== undefined ? h.hl : Math.min(30, Math.floor((d * 0.65 + 6) * (crouch ? 0.67 : 1)));
  /* Armour: a move either shrugs off anything short of a hard launch, or (armorMax) takes one strike of that base damage or less, on the ground only. */
  const am = v.state === 'attack' && v.move && v.move.armor && v.mf >= v.move.armor[0] && v.mf <= v.move.armor[1] ? v.move : null;
  if (am && (am.armorMax ? v.grounded && h.d <= am.armorMax && v.armorLeft > 0 : kb < 95)) { if (am.armorMax) v.armorLeft--; v.hitlag = hl; if (!proj) a.hitlag = hl; spark(hx, hy, '#ccc', 8, 1); beep(150, 0.06, 'square', 0.05); return; }
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
  for (const f of F) { if (f.px === undefined) { f.px = f.x; f.py = f.y; } }
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
    for (const h of live(a)) { const dx = a.x + h.x * a.face - p.x, dy = hitY(a, h) - p.y; if (dx * dx + dy * dy <= (h.r + p.r) * (h.r + p.r) && h.d + 9 > p.h.d) { p.life = 0;   /* an attack puts out a projectile less than 9% stronger than itself */ spark(p.x, p.y, '#fff', 8, 1.2); beep(700, 0.04, 'triangle', 0.04); break; } }
  }
  for (const a of F) {
    const v = F[1 - a.idx];
    if (a.state === 'attack' && a.move && canBeHit(v)) {
      for (const h of (a.move.hp || a.move.h)) {   /* hp: the same hitboxes with the parts near the body first */
        if (a.mf < h.f0 || a.mf > h.f1) continue; const gid = h.g || 0; if (a.hitG.has(gid)) continue;
        if (h.grab && ((!a.grounded && !h.cmd) || v.grabImm > 0 || (h.floor && !(a.grounded && v.grounded)))) continue;
        if ((h.airOnly && a.grounded) || (h.gndOnly && !a.grounded)) continue;   /* a hit that only exists in the air, or only on the floor */   /* ordinary grabs are for the ground; a leaping grab catches in the air; a floor grab needs both standing */
        const at = hitTouches(a, h, v); if (at) { ev.push([a, v, h, a.face, a.x, false, !h.grab && pokes(v, at[0], at[1])]); a.hitG.add(gid); break; }
      }
    }
  }
  for (const p of PROJ) {
    const v = F[1 - p.owner];
    if (p.life > 0 && canBeHit(v) && (circRect(p.x, p.y, p.r, ...hurtRect(v)) || (Math.hypot(p.vx, p.vy) > p.r && circRect(p.x - p.vx / 2, p.y - p.vy / 2, p.r, ...hurtRect(v))))) {   /* and halfway back along a fast shot's path */ ev.push([F[p.owner], v, p.h, p.face, p.x, true, pokes(v, p.x, p.y)]); p.life = 0; p.spent = true; }
  }
  for (const e of ev) applyHit(...e);
}
function updateProj() {
  for (const p of PROJ.slice()) {
    p.life--; p.age = (p.age || 0) + 1; const py = p.y - p.r;
    if (p.lateAt && p.age === p.lateAt) p.h = Object.assign({ id: p.h.id }, p.lateH);
    if (p.split && p.age === p.split) { p.split = 0; for (const vy of [0.55, -0.55]) PROJ.push(Object.assign({}, p, { vy, age: p.age, h: Object.assign({}, p.h, { d: vy > 0 ? 3 : 2 }) })); }
    if (p.boom && p.life <= 0 && !p.spent) { p.spent = true; fowlBoom(p); }
    if (p.x0 === undefined) p.x0 = p.x;
    if (p.plat && p.back) { p.rollF = (p.rollF || 0) + 1; if (p.rollF === 1) p.v0 = Math.abs(p.vx); if (p.rollF > p.back) { p.vx = appr(p.vx, -p.face * p.v0, 0.2); if ((p.x - p.x0) * p.face <= 0) p.life = 0; } }   /* the tape curls back to where it was let go */
    if (p.plat) { p.x += p.vx; p.rot = (p.rot || 0) + p.vx * 0.2; p.rolled = (p.rolled || 0) + Math.abs(p.vx); if (p.reach && p.rolled > p.reach) p.life = 0; if (p.x < p.plat.x0 || p.x > p.plat.x1) p.plat = null; continue; }   /* a rolling stone crumbles after its reach */
    p.vy -= p.grav; p.x += p.vx; p.y += p.vy;
    if (p.grav && p.vy <= 0) {
      for (const q of PLATS) {
        if (py >= q.y && p.y - p.r <= q.y && p.x >= q.x0 && p.x <= q.x1) {
          if (p.ground === 'stick') { p.kind = 'flame'; p.patch = true; p.vx = p.vy = 0; p.grav = 0; p.y = q.y + 2.5; p.life = 45; p.h = { d: 4, a: 80, b: 35, k: 20, id: p.h.id }; }   /* the coal's ember: 45 frames, 4% */
          else if (p.ground === 'roll') { p.plat = q; p.y = q.y + p.r; p.vy = 0; }
          else p.life = 0;
          break;
        }
      }
    }
    if (p.y < -1 && Math.abs(p.x) - p.r < stageHalf(p.y)) p.life = 0;   /* into the side or underside of the island */
  }
  PROJ = PROJ.filter(p => p.life > 0 && p.y > BLAST.b && Math.abs(p.x) < BLAST.r);
}

/* ---------- CPU opponent ---------- */
/* CPU level, 1 (easiest) to 9. Level 7 is the CPU exactly as it played before levels existed, and the one every test uses.
   tempo: how long it waits between attacks (x its usual wait)   guard: chance it shields an attack it sees coming
   tech: chance it techs a hard landing   punish: chance it grabs a shield   air: chance it takes an opening in the air
   nap: chance each second that it stops attacking for napLen frames and only walks
   mash: frames between its inputs when breaking out of a grab (0 = it does not mash) */
const CPU_LV = [null,
  { tempo: 2.6, guard: 0.03, tech: 0, punish: 0, air: 0.15, nap: 0.7, napLen: 110, mash: 0 },
  { tempo: 2.2, guard: 0.08, tech: 0.05, punish: 0.05, air: 0.25, nap: 0.55, napLen: 95, mash: 0 },
  { tempo: 1.85, guard: 0.14, tech: 0.1, punish: 0.12, air: 0.4, nap: 0.42, napLen: 80, mash: 20 },
  { tempo: 1.55, guard: 0.22, tech: 0.2, punish: 0.22, air: 0.55, nap: 0.3, napLen: 65, mash: 16 },
  { tempo: 1.32, guard: 0.3, tech: 0.32, punish: 0.35, air: 0.7, nap: 0.18, napLen: 50, mash: 12 },
  { tempo: 1.15, guard: 0.38, tech: 0.44, punish: 0.48, air: 0.85, nap: 0.08, napLen: 40, mash: 10 },
  { tempo: 1, guard: 0.45, tech: 0.55, punish: 0.6, air: 1, nap: 0, napLen: 0, mash: 8 },
  { tempo: 0.8, guard: 0.62, tech: 0.76, punish: 0.78, air: 1, nap: 0, napLen: 0, mash: 7 },
  { tempo: 0.62, guard: 0.8, tech: 0.94, punish: 0.92, air: 1, nap: 0, napLen: 0, mash: 6 }];
let CPU_LEVEL = 7;
try { const raw = localStorage.getItem('emberfall.cpulevel'), v = +raw; if (raw !== null && raw !== '' && v >= 0 && v <= 9) CPU_LEVEL = Math.round(v); } catch (e) { /* no storage */ }   /* level 0 is for testing: the CPU stands still */
function setCpuLevel(v) { CPU_LEVEL = clamp(Math.round(v), 0, 9); try { localStorage.setItem('emberfall.cpulevel', String(CPU_LEVEL)); } catch (e) { /* no storage */ } }
const NAP_STATES = { idle: 1, dash: 1, run: 1, brake: 1, land: 1, wd: 1 };
function cpuInput(f, o, m) {
  if (!m.lv && CPU_LEVEL === 0) return blankIn();   /* level 0: a target that does nothing at all, for testing moves on */
  const L = CPU_LV[m.lv || CPU_LEVEL], before = m.cd > 0 ? m.cd - 1 : 0, i = cpuBrain(f, o, m, L);
  if (m.cd > before && L.tempo !== 1) m.cd = Math.max(1, Math.round(m.cd * L.tempo));   /* a wait it has just set itself */
  if (L.nap > 0) {
    if (m.nap > 0) m.nap--; else if (m.t % 60 === 0 && Math.random() < L.nap) m.nap = L.napLen;
    /* napping: standing safely on the stage it throws nothing out, and only ambles */
    if (m.nap > 0 && f.grounded && NAP_STATES[f.state] && Math.abs(f.x) < EDGE - 8) { i.atk = i.spc = i.grb = i.jmp = i.sm = false; i.cx = i.cy = 0; i.lx *= 0.45; if (i.ly > 0) i.ly = 0; }
  }
  return i;
}
function cpuBrain(f, o, m, L) {
  const i = blankIn(); m.t = (m.t || 0) + 1; if (m.cd > 0) m.cd--; else m.cd = 0;
  const dx = o.x - f.x, dy = o.y - f.y, ad = Math.abs(dx), dir = sgn(dx) || 1;
  if (f.state === 'respawn') { if (f.sf > 45) i.lx = dir; return i; }
  if (f.state === 'hurt' && f.tumble && !f.grounded) {   /* decide once per launch whether to tech, then shield just above the floor */
    if (f.sf <= 1) m.tech = Math.random() < L.tech;
    /* only when it really is about to land, still in hitstun: a shield press that misses the floor would come out as an air dodge */
    const nx = f.x + f.vx * 3;
    if (m.tech && f.vy < 0 && f.techLock === 0 && f.hitstun - f.sf > 4 && PLATS.some(q => nx >= q.x0 + 2 && nx <= q.x1 - 2 && f.y - q.y > 0 && f.y - q.y < -f.vy * 3 + 0.5)) i.shd = true;
  }
  if (f.state === 'attack' && f.move && f.move.burst && f.mf <= 7) {   /* a tumble picks its direction on frame 6: up when off the stage, toward the opponent on it */
    if (!f.grounded && (Math.abs(f.x) > EDGE - 2 || f.y < 0)) i.ly = 1; else i.lx = dir; return i;
  }
  if (f.state === 'attack' && f.move && f.move.fowlUp) { const off = Math.abs(f.x) > EDGE - 4 || f.y < -2; i.spc = !f.upGo && f.upC < (off ? 34 : 12); i.ly = 1; i.lx = off ? -sgn(f.x) * (f.y < -20 ? 0.5 : 1) : dir * 0.6; return i; }
  if (f.sling && f.grounded && f.state !== 'attack' && (ad > 16 || f.pct > 60)) { const sx = f.sling.x - f.x; if (Math.abs(sx) < 7 && Math.abs(f.sling.y - f.y) < 6) { i.ly = -1; i.spc = m.t % 4 < 2; return i; } if (f.sling.plat && Math.abs(f.sling.y - f.y) < 4) { i.lx = sgn(sx); return i; } }
  if (f.state === 'attack' && f.move && f.move.hold) { i.spc = true; i.lx = Math.abs(f.x) > EDGE - 6 ? -sgn(f.x) * 0.8 : 0; return i; }   /* a rise that lasts while special is held: hold it, and steer for the stage */
  if (f.state === 'attack' && f.mname === 'nspec' && m.big && f.mf <= 17) { i.spc = true; return i; }   /* holding for the bigger stone */
  if (f.state === 'attack' && f.move && f.move.rapid) { i.atk = f.rapidN < 6 && ad < 16; return i; }
  if (f.state === 'attack' && f.move && f.move.next && f.mf >= f.move.chain && ad < 18) { i.atk = m.t % 2 === 0; return i; }
  if (f.state === 'held') { const q = L.mash; if (q) { i.grb = m.t % q === 0; i.lx = m.t % (q * 2) < q ? 1 : -1; } return i; }   /* mash out with the stick and the grab button: a buffered attack or jump would come out the moment it breaks free */
  if (f.state === 'down') { if (f.sf > 24) { const r = m.t % 3; if (r === 0) i.ly = 1; else if (r === 1) i.lx = -dir; else i.atk = true; } return i; }
  if (f.state === 'ledge') { if (f.sf > 20) { if (m.t % 2) i.lx = -sgn(f.x); else i.jmp = true; } return i; }
  if (f.state === 'hold') { if (f.sf > 16) { const r = m.t % 4; if (r === 0) i.lx = f.face; else if (r === 1) i.lx = -f.face; else if (r === 2) i.ly = 1; else i.ly = -1; } return i; }
  if (!f.grounded && (Math.abs(f.x) > EDGE + 4 || f.y < -3)) {
    /* Getting back. Never drift in under the stage: when below its top and inside its edge, steer back out first.
       Use the side special only while still high and far out, the air jumps on the way down, and the up special last,
       pressed with the stick only slightly toward the stage so it is not read as a side special. */
    const side = sgn(f.x) || 1, edge = EDGE + f.st.w / 2 + 2, under = false, far = Math.abs(f.x) - EDGE;   /* the island's underside slopes, so rising from beneath it just slides out to the ledge */
    i.lx = under ? side : (f.y > -3 || Math.abs(f.x) > edge + 1) ? -side : 0;   /* beside the wall and below the lip: stay off it and let the ledge or a jump do the work */
    if (f.state !== 'air' || m.t % 5 !== 0) return i;
    if (!f.sideUsed && f.form.moves.sspec.once && (f.st.airSpeed < 0.9 ? far > 30 && f.y > 32 - f.form.aiRise - (f.jumps > 0 ? f.form.aiHop : 0) : far > 36 && f.y > 14)) { i.lx = -side; i.spc = true; return i; }   /* a slow drifter needs its side special for distance, but only while the jump and up special it has left can pay back the drop */
    if (f.st.noLedge && !f.burstUsed && f.vy < 0 && (f.y < 4 || far > 45) && f.y + 30 < BLAST.t - 28) { i.lx = 0; i.ly = -1; i.spc = true; return i; }   /* no ledge to hold: the tumble's free lift comes before the jump and the blast */
    if (f.vy < 0 && !under) {
      const roof = BLAST.t - 28;   /* when launched high, fall first: rising from up there would go out through the top */
      if (f.jumps > 0) { if ((f.y < 8 || far > 50) && f.y + f.form.aiHop < roof) i.jmp = true; }
      else if ((f.y < -4 || far > 40) && f.y + f.form.aiRise < roof) { i.lx = -side * 0.35; i.ly = 1; i.spc = true; }
    }
    return i;
  }
  if (o.state === 'dead' || o.state === 'respawn') { if (Math.abs(f.x) > 20) i.lx = -sgn(f.x) * 0.5; return i; }
  if (f.grounded && o.state === 'attack' && ad < 24 && Math.abs(dy) < 20) { if (m.def == null) m.def = Math.random() < L.guard; if (m.def) { i.shd = true; return i; } } else m.def = null;
  if (f.grounded) {
    /* The opponent is off stage: hold the ledge instead of following them out, and swing as they come back. */
    if ((Math.abs(o.x) > EDGE + 4 || o.y < -5) && Math.abs(f.x) > EDGE - 22 && sgn(f.x) === sgn(o.x)) {
      if (f.face !== dir) i.lx = dir * 0.5; else if (m.cd === 0 && ad < (f.form.aiRange || 14) + 6 && Math.abs(dy) < 14) { i.lx = dir; i.atk = i.sm = true; m.cd = 55; }
      return i;
    }
    if (dy > 16 && ad < 34) { if (m.cd === 0) { i.jmp = true; m.cd = 22; } i.lx = ad > 6 ? dir : 0; return i; }
    if (dy < -10 && f.plat && f.plat.soft) { if (m.t % 12 < 6) i.ly = -1; return i; }
    if (m.cd === 0 && f.form.aiShot && ad > f.form.aiShot[0] && ad < f.form.aiShot[1] && Math.abs(dy) < 10 && f.face === dir && Math.random() < 0.04) { i.spc = true; m.big = Math.random() < (f.form.aiBig || 0); m.cd = 50; return i; }
    if (f.form.moves.dspec.burst && m.cd === 0 && ad > 44 && ad < 96 && Math.abs(dy) < 8 && f.face === dir && Math.abs(f.x + dir * 40) < EDGE - 6 && Math.random() < 0.035) { i.ly = -1; i.spc = true; m.cd = 26; return i; }   /* a tumble slide to close the gap, when there is stage to slide on */
    if (f.def.forms.length > 1 && !f.noSwap && m.cd === 0 && ad > 45 && Math.random() < 0.012) { i.ly = -1; i.spc = true; m.cd = 70; return i; }   /* swap companion at a safe distance */
    if (ad > (f.form.aiRange || 14)) { i.lx = dir; return i; }
    if (f.face !== dir) { i.lx = dir * 0.5; return i; }
    if (m.cd === 0 && f.form.aiVise && o.state === 'shield' && o.grounded && ad < 13 && Math.abs(dy) < 6 && Math.random() < L.punish * 0.5) { i.ly = f.form.aiVise === 'n' ? 0 : -1; i.spc = true; m.cd = 50; return i; }   /* a held shield invites the vise */
    if (m.cd === 0 && (o.state === 'shield' || o.state === 'shieldstun') && f.form.moves.grab.h[0].f0 <= 9 && ad < f.form.moves.grab.h[0].x + 3 && Math.abs(dy) < 6 && Math.random() < L.punish) { i.grb = true; m.cd = 36; return i; }   /* a shield is there to be grabbed, by those whose grab is quick enough */
    if (m.cd === 0) {
      const r = Math.random(); m.cd = Math.round((22 + (Math.random() * 30 | 0)) * (f.form.aiTempo || 1));
      if (dy > 8) { i.ly = 1; i.atk = true; if (r >= 0.5) i.sm = true; }
      else if (r < 0.25) i.atk = true; else if (r < 0.45) { i.lx = dir * 0.5; i.atk = true; } else if (r < 0.6) { i.lx = dir; i.atk = i.sm = true; }
      else if (r < 0.72) i.grb = true; else if (r < 0.84) { i.spc = true; m.big = false; if (f.form.aiSide) i.lx = dir; } else if (r < 0.92) { i.ly = -0.9; i.atk = true; } else i.jmp = true;
    }
    return i;
  }
  i.lx = ad > 6 ? dir : 0;
  if (Math.abs(f.x) > EDGE - 14) { i.lx = -sgn(f.x); return i; }   /* airborne near the edge: drift back over the stage, no attacks */
  if (m.cd === 0 && f.state === 'air' && (L.air >= 1 || Math.random() < L.air)) {
    const mv = f.form.moves, lead = n => (mv[n].h[0] ? mv[n].h[0].f0 : 14) + 1,   /* a move with no hitbox of its own (it fires something) is timed as frame 14 */ at = n => { const t = lead(n); return [dx + (o.vx - f.vx) * t, dy + (o.vy - f.vy) * t + (o.grounded ? 0.5 * f.st.grav * t * t : 0)]; };
    const up = at('uair'), dn = at('dair'), fw = at('fair'), room = f.y + f.vy * mv.fair.h[0].f1 > 3 || o.y > 6;
    if (Math.abs(up[0]) < 8 && up[1] > 5 && up[1] < 22) { m.cd = 30; i.cy = 1; }
    else if (Math.abs(dn[0]) < 6 && dn[1] < -11 && dn[1] > -26 && f.vy > -0.7) { m.cd = 40; i.cy = -1; }   /* only with room to finish the attack before landing */
    else if (Math.abs(fw[0]) < (f.form.aiRange || 14) + 2 && Math.abs(fw[1]) < 8 && room) { m.cd = 30; i.cx = sgn(fw[0]) || dir; }
  }
  if (dy > 20 && f.jumps > 0 && f.vy < 0 && m.t % 20 === 0 && f.y + f.form.aiHop < BLAST.t - 28) i.jmp = true;
  return i;
}

/* ---------- Fighters push each other ----------
   Two fighters standing on the same ground cannot walk or run through each other. Each has a small box round its feet
   (`jf` in front, `jb` behind). Where the boxes would overlap, whoever is walking in is held back and shoves the other
   along at a fraction of that speed (a heavier pusher shoves faster); boxes already overlapping slide apart. Nothing is
   pushed off the solid stage unless it could walk off itself. Rolls, dodges, jumps, launches, grabs and anyone lying
   down are not blocked, so those are the ways past. */
const JOSTLE = { push: 0.36, sep: 0.9 };
const JOSTLE_STATES = { idle: 1, dash: 1, run: 1, brake: 1, jsq: 1, land: 1, wd: 1, attack: 1, shield: 1, shieldstun: 1, shieldoff: 1, rebound: 1, broken: 1 };
function jostles(f) { return f.grounded && f.plat && JOSTLE_STATES[f.state] === 1; }
function jostle() {
  const a = F[0], b = F[1]; if (!jostles(a) || !jostles(b) || a.plat !== b.plat) return;
  const dir = b.x !== a.x ? sgn(b.x - a.x) : 1;   /* which side of a the other fighter is on */
  const need = (a.face === dir ? a.st.jf : a.st.jb) + (b.face === -dir ? b.st.jf : b.st.jb), over = need - Math.abs(b.x - a.x);
  if (over <= 0) return;
  const wa = a.st.weight, wb = b.st.weight, cA = Math.max(0, a.vx * dir), cB = Math.max(0, -b.vx * dir), closing = cA + cB;
  const closePart = Math.min(over, closing), sepPart = Math.min(over - closePart, JOSTLE.sep), k = closing > 0 ? closePart / closing : 0;
  const kA = JOSTLE.push * wa / (wa + wb), kB = JOSTLE.push * wb / (wa + wb);
  let backA = k * (cA * (1 - kA) + cB * kB) + sepPart * wb / (wa + wb), fwdB = k * (cB * (1 - kB) + cA * kA) + sepPart * wa / (wa + wb);
  a.x -= dir * backA; b.x += dir * fwdB;
  /* someone who cannot leave the platform stays on it, and the other gives way instead */
  for (const [f, g] of [[a, b], [b, a]]) { const p = f.plat; if ((f.x < p.x0 || f.x > p.x1) && !f.canFall()) { const nx = clamp(f.x, p.x0, p.x1); g.x += nx - f.x; f.x = nx; } }
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
/* Start screen: the fighters chosen so far stand on the island, for show only (nothing here is played). They are
   rebuilt whenever a choice changes; Wren's three companions take turns. The camera sits close on the island. */
let PREVIEW = null;
function selectPreview() {
  tick++;
  const key = slots.map(s => s ? s.pick : '-').join(',');
  if (key !== PREVIEW || !F.preview) {
    PREVIEW = key; const list = [];
    slots.forEach((s, k) => { if (!s) return; const n = list.length, f = new Fighter(n, ROSTER[s.pick], new Ctl('cpu'), k === 1 && !!slots[0] && slots[0].pick === s.pick); f.x = n ? 16 : -16; f.face = n ? -1 : 1; list.push(f); });
    F = list; F.preview = true; PROJ = []; PART = []; POPS = [];
  }
  for (const f of F) if (f.def.forms.length > 1) f.fi = Math.floor(tick / 170) % (f.def.cycle || f.def.forms.length);
  cam.x = Math.sin(tick * 0.004) * 3; cam.y = 5; cam.s = 9;
}
function stepSelect() {
  selectPreview();
  for (const dev of allDevs()) {
    const c = devCtl(dev); c.poll(readDev(dev));
    if (c.pressed('sel') && dev !== 'kb') { toggleLayout(dev); beep(520, 0.05, 'square', 0.03); }
    if (c.pressed('jmp')) { setBoxes(!DBG.boxes); beep(DBG.boxes ? 700 : 420, 0.05, 'square', 0.03); }   /* jump button: show or hide hitboxes */
    if (c.pressed('shd')) { setHitFx(!DBG.fx); beep(DBG.fx ? 700 : 420, 0.05, 'square', 0.03); }   /* shield button: hit sparks and flash on or off */
    let sl = slots.find(s => s && s.dev === dev);
    if (!sl) { if (c.pressed('atk') || c.pressed('start')) { const k = slots[0] ? (slots[1] ? -1 : 1) : 0; if (k >= 0) { slots[k] = { dev, pick: k, ready: false }; beep(600, 0.06, 'triangle', 0.05); } } continue; }
    if (!slots[1] && (c.upNow || c.downNow)) { setCpuLevel(CPU_LEVEL + (c.upNow ? 1 : -1)); beep(360 + CPU_LEVEL * 40, 0.04, 'square', 0.03); }
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
  for (const f of F) { f.px = f.x; f.py = f.y; }   /* where each was before this frame, for sweeping hits */
  for (const f of F) f.update();
  fowlSlings();
  jostle();
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
const CAM = { padX: 30, padUp: 34, padDown: 14, min: 2.3, max: 8.6, lx: EDGE + 120, ly0: -105, ly1: 112, ex: EDGE + 160, ey0: -135, ey1: 145 };
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
    y0 = Math.min(y0, y - CAM.padDown + Math.min(f.vy * 4, 0)); y1 = Math.max(y1, y + CAM.padUp + clamp(f.vy * 3, 0, 6));
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

