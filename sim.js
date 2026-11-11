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
const STALE = [0.09, 0.08545, 0.07635, 0.0679, 0.05945, 0.05035, 0.04255, 0.03345, 0.025];   /* repeated moves weaken (Ultimate's queue, SmashWiki "Stale Moves"); a use that hit a shield counts 0.85 of its slot */
const STALE_SHIELD = 0.85;
/* Hitstun is Ultimate's (0.4 x knockback, minus a frame, at least 4) times COMBO_EASE: the owner asked (2026-11-10) for combos
   about 15% easier than in Ultimate. Measured as the follow-up window (frames the attacker is free before the target, after
   every fighter's usual starters at 20% and 60%, tests/combat-audit.js), 1.065 widens it by 15% on average over Ultimate's
   hitstun (1.15 would widen it by a third). Cutting long hitstun short (air
   dodge from frame 40, anything from 45) stays Ultimate's, so the extra mostly lengthens low and mid percent combos, not
   the reach of high percent launches. Set COMBO_EASE to 1 for Ultimate's hitstun exactly. */
const HITSTUN = 0.4, COMBO_EASE = 1.065;
/* Ledges and techs, Ultimate's rules (SmashWiki "Edge" and "Tech", checked 2026-11-10): intangibility on a ledge grab is
   60 x airtime / 300 + 44 - 44 x damage / 120 frames (airtime up to 300, damage up to 120), between 23 and 123; the second grab
   before landing or being hit gets 0.8 of it, the third 0.5, later ones none; at most six grabs; hanging lets go after 6.5 s. */
const LEDGE_INV = (air, pct) => clamp(Math.round(60 * Math.min(air, 300) / 300 + 44 - Math.min(pct, 120) / 120 * 44), 23, 123);
const LEDGE_REGRAB = [1, 0.8, 0.5], LEDGE_HANG = 390, TECH_WINDOW = 11;
const SMASH_HOLD = 180, GRAB_MIN = 30;   /* frames a smash can be held; frames a grab holds at the very least, however hard the victim mashes */
const FRESH = 1.05, SHORT_HOP_MUL = 0.85, TUMBLE_KB = 80, CROUCH_MUL = 0.85, CHARGING_MUL = 1.2;
const CROUCH_Y = -0.4;
const LANDL = f => f.st.land || [2, 4];   /* a form's ordinary landing: [soft, hard] frames */
const CHG_K = a => a.move && a.move.chgK !== undefined ? a.move.chgK : 0.4;   /* how much a full smash charge adds (Joey the human: a fifth) */
/* the states from which Joey can start his transformation; a request made at any other time waits for one */
const TF_READY = { idle: 1, dash: 1, run: 1, brake: 1, air: 1, shield: 1, wd: 1, shieldoff: 1, exhaust: 1 };
/* INTENSITY (Joey's addendum, v1.0): human Joey's fatigue, in integer units, 10000 = full. What each committed action costs
   (one displayed point = 100 units). Running costs 8 a tick; resting drains 8 a tick standing, 3 walking, after 60 ticks of rest.
   Full: once he is next free on the ground, 900 ticks (15 seconds) of catching his breath, only shuffling or transforming. */
const FAT = { max: 10000, run: 8, restDelay: 60, drainIdle: 8, drainWalk: 3, jump: 1000, roll: 500, spot: 400, airdodge: 600, pummel: 200, throwPick: 800, rep: 400, exhaust: 900,
  move: { jab: 300, jab2: 400, jab3: 500, ftilt: 600, utilt: 600, dtilt: 600, dash: 1000, fsmash: 1500, usmash: 1500, dsmash: 1500, nair: 700, fair: 700, bair: 700, uair: 700, dair: 700,
    grab: 500, dgrab: 700, pgrab: 600, nspec: 800, sspec: 1000, uspec: 800, dspec: 1200 } };
const EX_READY = { idle: 1, dash: 1, run: 1, brake: 1, wd: 1, shieldoff: 1 };   /* the moments exhaustion can take over (it never cuts a move short) */   /* how far down the stick must be held to crouch */
const SHIELD = { hp: 50, drain: 0.15, regen: 0.08, dmg: 1.19, release: 11, parry: 5, stun: { ground: 0.8, smash: 0.725, air: 0.33, proj: 0.29 } };
function staleMul(a, id) { let r = 0, seen = false; a.stale.forEach((m, k) => { if (m === id) { r += STALE[k]; seen = true; } else if (m === id + '|s') { r += STALE[k] * STALE_SHIELD; seen = true; } }); return seen ? 1 - r : FRESH; }
function pushStale(a, id, shield) { a.stale.unshift(shield ? id + '|s' : id); if (a.stale.length > 9) a.stale.pop(); }
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
addEventListener('keydown', e => {
  keys[e.code] = true; if (!e.ctrlKey && !e.metaKey && !e.altKey && !/^F\d+$/.test(e.code) && !(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) e.preventDefault();   /* any key may be a game key now; browser shortcuts, the F keys and typing in a text box (the online menu) still work */
  if (CMENU) { if (CMENU.capture && !e.repeat) cmenuKey(e.code); return; }
  if (!e.repeat || e.code === 'KeyO') debugKey(e.code);
});
/* Debug tools: B shows hitboxes and hurtboxes, P freezes the game, O advances one frame, M switches between the 2D and 3D renderers. */
const DBG = { step: false, boxes: false, advance: 0, r3d: true, fx: true, arcs: false };   /* arcs: the circles and sweeps drawn over an attack while it can hit (off unless switched on: the owner asked, 2026-11-10) */   /* fx: the burst of sparks and the flash of light where a hit lands */
/* Showing hitboxes: switched with the jump button on the start screen or B on the keyboard, and remembered. */
try { DBG.boxes = localStorage.getItem('emberfall.boxes') === '1'; } catch (e) { /* no storage */ }
try { DBG.fx = localStorage.getItem('emberfall.hitfx') !== '0'; } catch (e) { /* no storage */ }
try { DBG.arcs = localStorage.getItem('emberfall.arcs') === '1'; } catch (e) { /* no storage */ }
function setArcs(on) { DBG.arcs = !!on; try { localStorage.setItem('emberfall.arcs', on ? '1' : '0'); } catch (e) { /* no storage */ } }
/* The switches at the top right of the fighter select: + (Start) away from a fighter hides or shows them. Remembered. */
let SWITCHES = true; try { SWITCHES = localStorage.getItem('emberfall.switches') !== '0'; } catch (e) { /* no storage */ }
function setSwitches(on) { SWITCHES = !!on; try { localStorage.setItem('emberfall.switches', on ? '1' : '0'); } catch (e) { /* no storage */ } beep(on ? 700 : 420, 0.05, 'square', 0.03); }
function setHitFx(on) { DBG.fx = !!on; try { localStorage.setItem('emberfall.hitfx', on ? '1' : '0'); } catch (e) { /* no storage */ } }
/* Training mode: no clock, stocks never run out, and a true-combo counter. A combo is every hit landed while the target is
   still in hitstun (or held) from the one before; it ends the moment the target can act again. */
let TRAINING = false; try { TRAINING = localStorage.getItem('emberfall.training') === '1'; } catch (e) { /* no storage */ }
function setTraining(on) { TRAINING = !!on; try { localStorage.setItem('emberfall.training', on ? '1' : '0'); } catch (e) { /* no storage */ } }
const COMBO = [{ hits: 0, dmg: 0, last: null, best: null, t: 0 }, { hits: 0, dmg: 0, last: null, best: null, t: 0 }];   /* per attacker */
function comboHit(a, v, dmg, chained) {   /* chained: the target had not recovered from the last hit */
  if (!a || a.idx === undefined) return; const c = COMBO[a.idx]; if (!chained || !c.hits) { c.hits = 0; c.dmg = 0; } c.hits++; c.dmg += dmg; c.t = 0;
}
function comboStep() {   /* a combo ends when its target is free to act */
  for (const a of F) { const c = COMBO[a.idx], v = F[1 - a.idx]; if (!c || !c.hits) continue;
    if (v && (v.state === 'hurt' || v.state === 'held' || v.hitlag > 0)) continue;
    c.last = { hits: c.hits, dmg: c.dmg }; if (!c.best || c.hits > c.best.hits || (c.hits === c.best.hits && c.dmg > c.best.dmg)) c.best = { hits: c.hits, dmg: c.dmg }; c.hits = 0; c.dmg = 0; }
  for (const c of COMBO) c.t++;
}
function setBoxes(on) { DBG.boxes = !!on; try { localStorage.setItem('emberfall.boxes', on ? '1' : '0'); } catch (e) { /* no storage */ } }
function debugKey(code) {
  if (code === 'KeyP') { DBG.step = !DBG.step; DBG.advance = 0; } else if (code === 'KeyO') { if (DBG.step) DBG.advance++; }
  else if (code === 'KeyT' && mode === 'select') setTraining(!TRAINING); else if (code === 'KeyB') setBoxes(!DBG.boxes); else if (code === 'KeyH') setHitFx(!DBG.fx); else if (code === 'KeyG') setArcs(!DBG.arcs); else if (code === 'KeyM') DBG.r3d = !DBG.r3d;
}
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function blankIn() { return { lx: 0, ly: 0, cx: 0, cy: 0, atk: false, spc: false, jmp: false, shd: false, grb: false, start: false, sel: false, sm: false, jmp2: false, tf: false }; }   /* tf: the transform action (Joey: two taps) */   /* jmp2: two jump buttons held at once. sm: the CPU's way of saying "this attack is a smash" (a person flicks the stick) */
/* Controller settings follow the reference build's controllers.ini: no stick deadzone, full outer zone, triggers at 25%. */
const PAD = { deadzone: 0, outer: 1, trigger: 0.25 };
function stick(x, y) { const m = Math.hypot(x, y); if (m === 0 || m <= PAD.deadzone) return [0, 0]; const k = Math.min(1, (m - PAD.deadzone) / (PAD.outer - PAD.deadzone)) / m; return [x * k, y * k]; }
/* ---------- Control setups ----------
   A setup says which key or button does what. The keyboard and each controller use one setup each. The built-in setups
   cannot be changed; the three Custom ones of each kind can. Which setup each device uses, and the Custom ones, are kept
   between visits. Start, the controls screen (Backspace, or - on a controller) and the debug keys are never remapped. */
const KB_ROWS = [['left', 'Move left'], ['right', 'Move right'], ['up', 'Move up'], ['down', 'Move down'], ['walk', 'Walk (hold)'], ['atk', 'Attack'], ['spc', 'Special'], ['jmp', 'Jump'], ['jmp2', 'Jump (second key)'],
  ['shd', 'Shield'], ['shd2', 'Shield (second key)'], ['grb', 'Grab'], ['grb2', 'Grab (second key)'], ['cu', 'Tilt stick up'], ['cd', 'Tilt stick down'], ['cl', 'Tilt stick left'], ['cr', 'Tilt stick right'], ['tf', 'Transform (tap twice)']];
const PAD_ROWS = [[0, 'A  (bottom button)', 'A'], [1, 'B  (right button)', 'B'], [2, 'X  (left button)', 'X'], [3, 'Y  (top button)', 'Y'], [4, 'L  (left bumper)', 'L'], [5, 'R  (right bumper)', 'R'], [6, 'ZL  (left trigger)', 'ZL'], [7, 'ZR  (right trigger)', 'ZR'], [10, 'Left stick click', 'L click'], [11, 'Right stick click', 'R click']];
const PAD_ACTS = ['', 'atk', 'spc', 'jmp', 'shd', 'grb'], ACT_NAME = { '': 'Nothing', atk: 'Attack', spc: 'Special', jmp: 'Jump', shd: 'Shield', grb: 'Grab' };
const KB_STD = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', walk: 'ShiftLeft', atk: 'KeyZ', spc: 'KeyX', jmp: 'KeyC', jmp2: 'KeyV', shd: 'KeyQ', shd2: 'KeyW', grb: 'KeyA', grb2: 'KeyS', cu: 'KeyI', cd: 'KeyK', cl: 'KeyJ', cr: 'KeyL', tf: 'KeyE' };
const KB_WASD = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', walk: 'ShiftLeft', atk: 'KeyJ', spc: 'KeyK', jmp: 'Space', jmp2: 'KeyL', shd: 'KeyU', shd2: '', grb: 'KeyI', grb2: '', cu: 'ArrowUp', cd: 'ArrowDown', cl: 'ArrowLeft', cr: 'ArrowRight', tf: 'KeyE' };
const PAD_STD = { 0: 'atk', 1: 'spc', 2: 'jmp', 3: 'jmp', 4: 'grb', 5: 'grb', 6: 'shd', 7: 'shd', 10: '', 11: '' };   /* the bottom button attacks (owner's choice, 2026-11-10) */
const SETUPS = [], USE = {};   /* USE: device -> the id of the setup it uses */
(function () {
  const add = (id, type, name, map, fixed) => SETUPS.push({ id, type, name, map: Object.assign({}, map), base: map, fixed, touched: false });
  add('kb-std', 'kb', 'Arrows  +  Z X C', KB_STD, true); add('kb-wasd', 'kb', 'WASD  +  J K L', KB_WASD, true);
  add('pad-std', 'pad', 'Standard', PAD_STD, true); add('pad-swap', 'pad', 'A / B swapped', Object.assign({}, PAD_STD, { 0: 'spc', 1: 'atk' }), true);
  for (const t of ['kb', 'pad']) for (let n = 1; n <= 3; n++) add(t + '-c' + n, t, 'Custom ' + n, t === 'kb' ? KB_STD : PAD_STD, false);
  try {
    const old = JSON.parse(localStorage.getItem('emberfall.layout') || '{}'); for (const d in old) if (old[d] === 'labels') USE[d] = 'pad-swap';   /* the A/B switch from before there were setups */
    const sv = JSON.parse(localStorage.getItem('emberfall.controls') || '{}');
    for (const d in sv.use || {}) if (typeof sv.use[d] === 'string') USE[d] = sv.use[d];
    for (const s of SETUPS) { const m = !s.fixed && sv.custom && sv.custom[s.id]; if (!m) continue; for (const k in s.map) if (typeof m[k] === 'string') s.map[k] = m[k]; s.touched = true; }
  } catch (e) { /* no storage */ }
})();
function saveControls() { try { const custom = {}; for (const s of SETUPS) if (!s.fixed && s.touched) custom[s.id] = s.map; localStorage.setItem('emberfall.controls', JSON.stringify({ use: USE, custom })); } catch (e) { /* no storage */ } }
function setupsFor(dev) { const t = dev === 'kb' ? 'kb' : 'pad'; return SETUPS.filter(s => s.type === t); }
function setupOf(dev) { const t = dev === 'kb' ? 'kb' : 'pad', id = USE[dev]; return SETUPS.find(s => s.id === id && s.type === t) || SETUPS.find(s => s.type === t); }
function keyName(c) {
  if (!c) return '—'; const A = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'Shift', ShiftRight: 'Shift', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/' };
  return A[c] || c.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'Num ');
}
function keyHeld(code) { if (!code) return false; if (keys[code]) return true; return code === 'ShiftLeft' ? !!keys.ShiftRight : code === 'ShiftRight' ? !!keys.ShiftLeft : false; }   /* either Shift counts */
/* Keyboard: by default the same keys as the reference build. Arrows are the left stick, I J K L the right stick, Shift walks. */
function readKb() {
  const i = blankIn(), k = setupOf('kb').map, h = n => keyHeld(k[n]), m = h('walk') ? 0.5 : 1, j = h('jmp'), j2 = h('jmp2');
  i.lx = ((h('right') ? 1 : 0) - (h('left') ? 1 : 0)) * m; i.ly = ((h('up') ? 1 : 0) - (h('down') ? 1 : 0)) * m;
  i.cx = (h('cr') ? 1 : 0) - (h('cl') ? 1 : 0); i.cy = (h('cu') ? 1 : 0) - (h('cd') ? 1 : 0);
  i.tf = h('tf'); i.atk = h('atk'); i.spc = h('spc'); i.jmp = j || j2; i.jmp2 = j && j2; i.grb = h('grb') || h('grb2'); i.shd = h('shd') || h('shd2');
  i.start = !!keys.Enter; i.sel = !!keys.Backspace;
  return i;
}
function padInfo(n) { const p = navigator.getGamepads ? navigator.getGamepads()[n] : null; return p ? p.id : ''; }
function readPad(n) {
  const p = navigator.getGamepads ? navigator.getGamepads()[n] : null, i = blankIn();
  if (!p) return i;
  const b = k => !!(p.buttons[k] && (p.buttons[k].pressed || p.buttons[k].value > PAD.trigger)), ax = k => p.axes[k] || 0;
  [i.lx, i.ly] = stick(ax(0), -ax(1)); [i.cx, i.cy] = stick(ax(2), -ax(3));
  if (b(14)) i.lx = -1; if (b(15)) i.lx = 1; if (b(12)) i.ly = 1; if (b(13)) i.ly = -1; i.tf = b(13);   /* the D-pad's down button is also the transform action */
  const m = Math.hypot(i.lx, i.ly); if (m > 1) { i.lx /= m; i.ly /= m; }
  const map = setupOf('pad' + n).map; let jumps = 0;
  for (const k in map) { const a = map[k]; if (a && b(+k)) { i[a] = true; if (a === 'jmp') jumps++; } }
  i.jmp2 = jumps >= 2; i.start = b(9); i.sel = b(8);
  return i;
}
/* ---------- The controls screen ----------
   Opened for one device from the fighter select or from pause. It reads that device directly (never through its setup), so a
   bad setup can always be put right: arrows / Enter / Backspace on the keyboard, stick / A / B on a controller, or the mouse. */
let CMENU = null;
const CM = { x: 190, y: 50, w: 900, h: 620, done: [968, 66, 100, 34] };
const KEY_NO = /^(Enter|Backspace|Delete|Tab|Escape|Equal|NumpadAdd|Control|Alt|Meta|OS|ContextMenu|CapsLock|NumLock|ScrollLock|PrintScreen|Pause|F\d+$|Key[BPOMHT]$)/;
function menuRaw(dev) {
  if (dev === 'kb') return { x: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), y: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), ok: !!(keys.Enter || keys.Space), back: !!(keys.Backspace || keys.Escape), clear: !!keys.Delete };
  const p = navigator.getGamepads ? navigator.getGamepads()[+dev.slice(3)] : null; if (!p) return { x: 0, y: 0, ok: false, back: true, clear: false };   /* unplugged: leave */
  const b = k => !!(p.buttons[k] && p.buttons[k].pressed), ax = k => p.axes[k] || 0;
  return { x: b(15) || ax(0) > 0.55 ? 1 : b(14) || ax(0) < -0.55 ? -1 : 0, y: b(13) || ax(1) > 0.55 ? 1 : b(12) || ax(1) < -0.55 ? -1 : 0, ok: b(0), back: b(1) || b(8) || b(9), clear: b(3) };
}
function openCMenu(dev) { CMENU = { dev, row: 0, capture: false, wait: false, closing: false, note: '', noteT: 0, prev: menuRaw(dev), rep: 0 }; beep(660, 0.06, 'triangle', 0.04); }
function cmenuNote(t) { CMENU.note = t; CMENU.noteT = 260; }
function cmenuItems() {   /* the rows, each with the box it is drawn in (the mouse uses the same boxes) */
  const su = setupOf(CMENU.dev), items = [{ kind: 'setup', box: [CM.x + 30, CM.y + 68, CM.w - 60, 46] }];
  if (su.type === 'kb') { const cw = (CM.w - 80) / 2; KB_ROWS.forEach(([key, label], n) => items.push({ kind: 'bind', key, label, box: [CM.x + 30 + (n >= 9 ? cw + 20 : 0), CM.y + 134 + (n % 9) * 36, cw, 32] })); }
  else PAD_ROWS.forEach(([key, label], n) => items.push({ kind: 'bind', key, label, box: [CM.x + 170, CM.y + 130 + n * 33, CM.w - 340, 29] }));
  if (!su.fixed) items.push({ kind: 'reset', box: [CM.x + CM.w / 2 - 160, CM.y + 476, 320, 34] });
  return items;
}
/* The setup about to be changed. Changing a built-in one copies it into a Custom setup nobody has touched yet and switches to that. */
function cmenuEditable() {
  const m = CMENU, su = setupOf(m.dev); if (!su.fixed) return su;
  const free = setupsFor(m.dev).find(s => !s.fixed && !s.touched);
  if (!free) { cmenuNote('Built-in setups cannot be changed. Switch to a Custom setup and change that one.'); beep(200, 0.08, 'square', 0.03); return null; }
  free.map = Object.assign({}, su.map); free.touched = true; USE[m.dev] = free.id; cmenuNote('Copied "' + su.name.replace(/\s+/g, ' ') + '" into ' + free.name + ', which is yours to change.'); return free;
}
function cmenuCycle(d) { const m = CMENU, list = setupsFor(m.dev), n = list.indexOf(setupOf(m.dev)); USE[m.dev] = list[(n + d + list.length) % list.length].id; saveControls(); beep(520, 0.04, 'square', 0.03); }
function cmenuOk(it, d) {
  const m = CMENU;
  if (it.kind === 'setup') cmenuCycle(d);
  else if (it.kind === 'reset') { const su = setupOf(m.dev); su.map = Object.assign({}, su.base); su.touched = false; saveControls(); cmenuNote(su.name + ' is back to the standard layout.'); beep(380, 0.08, 'triangle', 0.04); }
  else if (m.dev === 'kb') { if (cmenuEditable()) { m.capture = true; beep(700, 0.04, 'square', 0.03); } }
  else { const su = cmenuEditable(); if (!su) return; const n = PAD_ACTS.indexOf(su.map[it.key] || ''); su.map[it.key] = PAD_ACTS[(n + d + PAD_ACTS.length) % PAD_ACTS.length]; su.touched = true; saveControls(); beep(520, 0.04, 'square', 0.03); }
}
function cmenuKey(code) {   /* a key pressed while a row is waiting for one */
  const m = CMENU, it = cmenuItems()[m.row];
  if (code === 'Escape' || !it || it.kind !== 'bind') { m.capture = false; m.wait = true; return; }
  if (KEY_NO.test(code)) { cmenuNote(keyName(code) + ' is kept for the menus, the move list and debug tools. Press a different key, or Escape to cancel.'); beep(200, 0.08, 'square', 0.03); return; }
  const su = setupOf(m.dev), old = su.map[it.key]; for (const k in su.map) if (k !== it.key && su.map[k] === code) { su.map[k] = old; cmenuNote(keyName(code) + ' was already in use, so the two have swapped.'); }
  su.map[it.key] = code; su.touched = true; m.capture = false; m.wait = true; saveControls(); beep(800, 0.06, 'triangle', 0.04);
}
function cmenuClick(x, y) {
  const m = CMENU; if (!m || m.closing) return;
  if (m.capture) { m.capture = false; return; }
  if (inBox(CM.done, x, y)) { m.closing = true; saveControls(); beep(420, 0.06, 'triangle', 0.04); return; }
  const items = cmenuItems(), n = items.findIndex(it => inBox(it.box, x, y)); if (n < 0) return;
  m.row = n; const it = items[n]; cmenuOk(it, x < it.box[0] + it.box[2] / 2 ? -1 : 1);
}
function stepCMenu() {
  const m = CMENU, r = menuRaw(m.dev), p = m.prev; m.prev = r; if (m.noteT > 0) m.noteT--;
  const idle = !r.x && !r.y && !r.ok && !r.back && !r.clear;
  if (m.closing) { if (idle) CMENU = null; return; }   /* closes once everything is let go, so the press that closed it does nothing else */
  if (m.capture) return;
  if (m.wait) { if (idle) m.wait = false; return; }
  const items = cmenuItems(); m.row = Math.min(m.row, items.length - 1); const it = items[m.row];
  if (r.back && !p.back) { m.closing = true; saveControls(); beep(420, 0.06, 'triangle', 0.04); return; }
  let dy = 0; if (r.y && r.y !== p.y) { dy = r.y; m.rep = 0; } else if (r.y && ++m.rep > 18 && m.rep % 5 === 0) dy = r.y;
  if (dy) { m.row = (m.row + dy + items.length) % items.length; beep(440, 0.03, 'square', 0.02); return; }
  const dx = r.x && r.x !== p.x ? r.x : 0;
  if (dx) {
    if (it.kind === 'setup') cmenuCycle(dx);
    else if (it.kind === 'bind' && m.dev !== 'kb') cmenuOk(it, dx);
    else if (it.kind === 'bind') { const n = m.row - 1, t = n >= 9 ? n - 9 : n + 9; if (t < KB_ROWS.length) { m.row = t + 1; beep(440, 0.03, 'square', 0.02); } }   /* keyboard rows sit in two columns */
    return;
  }
  if (r.ok && !p.ok) cmenuOk(it, 1);
  else if (r.clear && !p.clear && it.kind === 'bind') { const su = cmenuEditable(); if (su) { su.map[it.key] = ''; su.touched = true; saveControls(); beep(300, 0.05, 'square', 0.03); } }
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
    this.dashDir = 0; this.downBuf = 0; this.downNow = false; this.upNow = false; this.cPress = false; this.cDown = false; this.cFall = dev !== 'cpu'; this.shdAge = 99; this.jmp2Age = 99;
    this.tfAge = 99; this.tfReq = false;
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
    this.cDown = this.cFall && c.cy <= -0.55 && !(p.cy <= -0.55) && -c.cy >= Math.abs(c.cx);   /* the right stick flicked down: fast-falls, as a flick of the left stick does (people only: the CPU plays as it did) */
    this.jmp2Age = c.jmp2 ? 0 : Math.min(99, this.jmp2Age + 1);   /* frames since two jump buttons were last held together */
    /* The transform double tap (Joey's guide): two presses of the transform action, released in between, the second no more
       than 20 ticks after the first, make one request. Counted on every poll of a match (countdown included), not while paused. */
    if (!(typeof paused !== 'undefined' && paused)) { if (c.tf && !p.tf) { if (this.tfAge < 20) { this.tfReq = true; this.tfAge = 99; } else this.tfAge = 0; } else if (this.tfAge < 99) this.tfAge++; }
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
/* The glint of a fast fall starting: a small four-point star. No random numbers, so it never changes how a match plays out. */
function ffSpark(x, y) {
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4; PART.push({ x, y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, life: 12, col: '#fff3b0', r: 0.55 }); }
  PART.push({ x, y, vx: 0, vy: 0, life: 10, col: '#ffffff', r: 1.3 }); beep(1700, 0.035, 'sine', 0.012, 1.4);
}
/* B-reverse: how many frames after a special starts the stick can still turn it round, and the little swirl when it does. */
const B_REV = 5;
function brevPuff(x, y) {
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; PART.push({ x: x + Math.cos(a) * 2, y: y + Math.sin(a) * 2, vx: -Math.sin(a) * 1.2, vy: Math.cos(a) * 1.2, life: 11, col: '#a8e0ff', r: 0.5 }); }
  beep(1250, 0.04, 'triangle', 0.012, 0.8);
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
const SWAP = { t: 32, swap: 1, stall: 1, h: [], on(f, n) { if (n === 1) f.swapLock = 60; if (n === 16) { f.fi = (f.fi + 1) % f.def.forms.length; f.jumps = f.grounded ? (f.st.jumps ?? 1) : Math.min(f.jumps, f.st.jumps ?? 1); spark(f.x, f.y + 7, '#fff', 14, 1.4); beep(660, 0.12, 'triangle', 0.05, 1.6); } } };

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
  /* Chomp Chomp: the owner's design v2 (2026-11-10) */
  'Chomp Chomp': { jab: [3, 2], jab2: [5, 2], jab3: [8, 4], dash: [9, 9, { late: 6 }], ftilt: [7, 7], utilt: [6, 7], dtilt: [5, 6],
    fsmash: [17, 16], usmash: [14, 14], dsmash: [15, 13, { rear: [17, 13] }],
    nair: [7, 8, { late: 5 }], fair: [9, 10], bair: [8, 9], uair: [7, 8], dair: [12, 12, { late: 7 }],
    grab: 9, pummel: 1.3, throws: { f: 8, b: 9, u: 8, d: 7 } },
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
  Rusty: { kb: 0.92 }, Bolt: { kb: 0.86, lag: 1.15 }, Cinder: { kb: 0.92 }, Pip: { kb: 1.18 }, Pearl: { kb: 1.0 },
  'Chomp Chomp': { kb: 0.84, lag: 1.35 },   /* CPU-vs-CPU 84% wins untuned (2026-11-10): toned toward the 55 to 65% band */
  /* Brand: none. The owner asked (2026-11-11) for every number in the fighter 03 document as written; the 0.72 launch
     setting of 2026-11-10 (CPU-vs-CPU 75% wins without it) was taken out. */
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
/* Hot Potato's burst on whoever is in reach (owner's numbers, 2026-11-10): the hot middle (sweet) KOs most fighters from about
   70% and the edge (sour) from about 100 to 125%, both from the victim's own damage; the sweet spot hits about half again
   as hard as the burst throws the sack itself at the same damage. One hit per target: the middle is tried first. */
const SACK_BLAST = { sweet: { r: 6, d: 15, a: 75, b: 50, k: 112 }, sour: { r: 12, d: 10, a: 70, b: 35, k: 100 } };   /* measured with no DI at centre stage: sweet KOs at 55-90% (most near 70), sour at 105-130% (heavies later) */
function sackBlast(f, i) {
  spark(f.x, f.y + 4, '#ffb347', 30, 2.6); beep(120, 0.3, 'sawtooth', 0.08, 0.4); shake = Math.max(shake, 6);
  for (const part of ['sweet', 'sour']) { const q = SACK_BLAST[part]; shoot(f, { kind: 'blast', grp: 'hotpotato', ox: 0.01, oy: 4, vx: 0, r: q.r, life: 4, h: { d: q.d, a: q.a, b: q.b, k: q.k, norage: 1 } }); }   /* norage: the sack's own damage does not add to it */
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
    moves: mk(0.95, 0.94, 1.1, 0.85, {
      /* Spud Bomb (owner's request, 2026-11-10): hold special to swell, let go to burst round his body. There is no cap: the longer
         the hold, the bigger the burst and the harder it hits (about 1.2 more units across and 1.5% more each 10 frames). Tapped it
         is 8% in a 7-unit ring and KOs a middleweight from roughly 140%; it only grows from there. 4 frames from letting go to the
         burst, 20 after. */
      nspec: { t: 40, h: [], on(f, n, i) {
        if (n === 1) { f.scC = 0; f.scRel = 0; PROJ.push({ x: f.x, y: f.y + 5, vx: 0, vy: 0, grav: 0, life: 99999, owner: f.idx, face: f.face, r: 4, ground: 'pass', plat: null, kind: 'sackglow', ghost: 1, tag: 'glow' + f.idx, track: (o, p) => [o.x, o.y + 5], h: { d: 0, a: 0, b: 0, k: 0 } }); }
        const glow = PROJ.find(p => p.tag === 'glow' + f.idx);
        if (!f.scRel) { if (i.spc) { f.scC++; f.mf = 2; if (glow) glow.r = 4 + f.scC * 0.12; return; } f.scRel = f.mf; }
        if (f.mf === f.scRel + 4) { if (glow) glow.life = 0; const c = f.scC;
          PROJ.push({ x: f.x, y: f.y + 5, vx: 0, vy: 0, grav: 0, life: 4, owner: f.idx, face: f.face, r: 7 + c * 0.12, ground: 'pass', plat: null, kind: 'blast', h: { d: +(8 + c * 0.15).toFixed(1), a: 50, b: 50, k: 96, id: 'Potato Sack:spudbomb' } });
          spark(f.x, f.y + 5, '#ffb347', Math.min(80, 20 + c / 4 | 0), 2 + Math.min(6, c / 60)); beep(90, 0.35, 'sawtooth', 0.09, 0.4); shake = Math.max(shake, Math.min(20, 6 + c / 30)); }
        if (f.mf >= f.scRel + 24) { if (glow) glow.life = 0; f.mf = f.move.t; } } },
      sspec: { t: 50, once: 1, nodrift: 1, ll: 14, h: [{ f0: 10, f1: 22, x: 7, y: 6, r: 6, grab: 1, cmd: 's', d: 0 }], on(f, n) { if (n === 8) { lift(f, 1.6); f.vx = f.face * 2.3; } } },
      uspec: { t: 29, rise: 40, blast: 1, h: [], on(f, n, i) { if (n < 5 && !f.grounded) f.vy = Math.max(f.vy, -0.5); if (n === 5) sackBlast(f, i); } },   /* bursts on frame 5 (owner's request, 2026-11-10) */
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
        if (n >= 6 && f.grounded && f.plat && f.plat.soft && i.ly < -0.5) { f.dropPlat = f.plat; f.dropT = 12; f.grounded = false; f.plat = null; f.vy = -0.5; }   /* holding down on a soft platform: the slide drops through it, speed kept */
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
/* ---------- Furious Fowls (the owner's guides: assets/fowls/source/overhaul-v3.md and special-moves-bible-v1.md) ----------
   One fighter in two shapes. In the slingshot (forms 0 to 4) a skinny living slingshot carries one of five birds in its pouch;
   alone (forms 5 to 9) the bird fights by itself after Side B fires it, while the empty slingshot waits where it was.
   One damage meter and one set of stocks throughout. Internally the russet bird is 'Rusty' (the game already has a fighter
   called Flint); everything the player sees calls it Flint.
   Slingshot form:  Neutral B  bird selector (tap: next bird; hold: a five-way wheel, point and let go)
                    Side B     fire the living bird; control goes with it, no flight timer
                    Up B       Catapult Cyclone: charge, aim, and the whole rig spins end over end along the aim
                    Down B     each bird's own slingshot technique (Brace & Break, Skitter Step, Anvil Drop, Orbit Parade, Nest Marker)
                    Neutral air  Sling Spin: the whole rig spins end over end in place, dragging hits and a finisher
   Bird alone:      Neutral B, Side B, Up B are the bird's own; Down B hops back into the slingshot when close.
   Frame data, damage and hit counts are the guides'. Launch angles and knockback the guides leave open come from the first
   move data (FOWL, above). W is the slingshot's width (10) and B a lone bird's (6.5). */
const FW = 10, FB = 6.5, FUP = 2.5, FP = 7.8;   /* FUP scales the Cyclone's flight; FP is the height of the rig's middle, the pivot of both spins */
const FOWL_LABEL = { Rusty: 'Flint', Bolt: 'Bolt', Cinder: 'Cinder', Pip: 'Pip', Pearl: 'Pearl' };
const FOWL_ROLE = { Rusty: 'Brawler', Bolt: 'Speedster', Cinder: 'Heavyweight', Pip: 'Trickster trio', Pearl: 'Aerial control' };
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
function fowlLate(mv, d) { const h = mv.h[0], cut = h.f0 + Math.max(1, Math.round((h.f1 - h.f0) * 0.35)); mv.h.push(Object.assign({}, h, { f0: cut + 1, d, k: Math.round(h.k * 0.8), part: 'late' })); h.f1 = cut; }
function fowlBoom(p) { const b = p.boom; PROJ.push({ x: p.x, y: p.y, vx: 0, vy: 0, grav: 0, life: 4, owner: p.owner, face: p.face, r: b.r, ground: 'pass', plat: null, kind: 'blast', h: { d: b.d, a: 70, b: 40, k: b.k || 70, id: p.h.id + ':boom' } }); spark(p.x, p.y, '#ffb347', 18, 2); beep(120, 0.2, 'sawtooth', 0.06, 0.5); }
function fowlRejoin(f) { const s = f.sling; f.x = s.x; f.y = s.y; f.fi -= 5; f.sling = null; f.move = null; f.vx = f.vy = 0; f.grounded = !!s.plat; f.plat = s.plat; f.set(f.grounded ? 'idle' : 'air'); spark(f.x, f.y + 8, '#fff', 12, 1.4); beep(520, 0.08, 'triangle', 0.05, 1.2); }
function fowlSlings() {   /* the empty slingshot: it falls to the floor, and comes back by the nearest ledge if it is lost */
  for (const f of F) { const s = f.sling; if (!s) continue;
    if (!s.plat) { const y0 = s.y; s.vy = Math.max(s.vy - 0.1, -2.4); s.y += s.vy; for (const q of PLATS) if (y0 >= q.y && s.y <= q.y && s.x >= q.x0 && s.x <= q.x1) { s.plat = q; s.y = q.y; s.vy = 0; } }
    if (s.y < BLAST.b + 10 && ++s.lost > 45) { s.x = clamp(s.x, -EDGE + 8, EDGE - 8); s.y = 0; s.plat = MAIN; s.vy = 0; s.lost = 0; spark(s.x, 6, '#fff', 14, 1.6); } }
}
const edge = f => f.ctl.c.spc && !f.ctl.p.spc;   /* special pressed this very frame */
const opp = f => F[1 - f.idx];
const blocked = f => { const o = opp(f); return !!o && (o.state === 'shield' || o.state === 'shieldstun'); };
/* a Pip double: the one Pip model again, moved by a fixed rule (track) from its owner each frame; ghost doubles cannot hit */
function pipMate(f, track, life, h, extra) { PROJ.push(Object.assign({ x: f.x, y: f.y, vx: 0, vy: 0, grav: 0, life, owner: f.idx, face: f.face, r: 2.6, ground: 'pass', plat: null, kind: 'pipmate', track, ghost: !h, h: h ? Object.assign({ id: 'Pip:mate' }, h) : { d: 0, a: 0, b: 0, k: 0 } }, extra)); }

/* ---- the slingshot's normals, per bird: [first active, last active, damage, recovery after, landing lag] (overhaul v3, section 5) ---- */
const FN = {
  Rusty: { jab: [[4, 5, 2], [6, 7, 2], [8, 10, 4]], jr: 14, ftilt: [8, 11, 8, 16], utilt: [7, 10, 7, 17], dtilt: [6, 9, 6, 15], dash: [10, 16, 9, 22, 6], fsmash: [19, 22, 18, 36], usmash: [14, 18, 15, 30], dsmash: [15, 22, 13, 32],
    fair: [10, 16, 10, 18, 12], bair: [8, 14, 11, 20, 13], uair: [8, 16, 9, 17, 11], dair: [14, 22, 12, 22, 16], grab: 9, thr: [9, 10, 8, 7], pum: 1.5, geo: 1, reach: 1 },
  Bolt: { jab: [[3, 4, 1.5], [5, 6, 1.5], [7, 9, 3]], jr: 12, ftilt: [6, 8, 7, 14], utilt: [5, 8, 6, 15], dtilt: [5, 8, 5, 13], dash: [7, 12, 8, 18, 5], fsmash: [15, 17, 14, 32], usmash: [10, 14, 12, 27], dsmash: [12, 17, 11, 28],
    fair: [7, 11, 8, 15, 9], bair: [6, 10, 9, 16, 9], uair: [6, 12, 7, 14, 8], dair: [9, 14, 8, 17, 12], grab: 7, thr: [8, 9, 7, 6], pum: 1, geo: 0.85, reach: 1.15 },
  Cinder: { jab: [[6, 7, 3], [8, 9, 3], [11, 13, 6]], jr: 20, ftilt: [11, 14, 12, 22], utilt: [10, 13, 10, 22], dtilt: [9, 12, 8, 21], dash: [14, 19, 12, 28], fsmash: [24, 27, 21, 45], usmash: [18, 21, 19, 40], dsmash: [20, 24, 18, 40],
    fair: [14, 19, 14, 27, 18], bair: [13, 18, 13, 26, 17], uair: [12, 17, 12, 25, 16], dair: [16, 22, 15, 30, 20], grab: 11, thr: [11, 12, 10, 8], pum: 2, geo: 1.15, reach: 1 },
  Pip: { jab: [[4, 5, 1.5], [6, 7, 1.5], [8, 11, 3.5]], jr: 15, ftilt: [7, 11, 6.5, 16], utilt: [7, 11, 6, 16], dtilt: [6, 10, 6, 16], dash: [9, 15, 7.5, 21], fsmash: [18, 23, 15, 36], usmash: [13, 19, 14, 32], dsmash: [14, 21, 13, 31],
    fair: [9, 15, 8, 17, 11], bair: [8, 14, 7, 17, 11], uair: [7, 14, 7, 16, 10], dair: [12, 19, 9, 21, 15], grab: 8, thr: [8, 8, 8, 7], pum: 1, geo: 1, reach: 1 },
  Pearl: { jab: [[4, 5, 2], [6, 7, 2], [9, 11, 3.5]], jr: 16, ftilt: [8, 12, 7.5, 16], utilt: [8, 12, 7, 17], dtilt: [7, 11, 6.5, 16], dash: [11, 18, 8, 21], fsmash: [19, 23, 16, 36], usmash: [14, 19, 13, 31], dsmash: [16, 21, 13, 32],
    fair: [8, 14, 8, 17, 11], bair: [8, 14, 9, 18, 12], uair: [7, 15, 8, 16, 10], dair: [12, 20, 8, 22, 16], grab: 9, thr: [8, 9, 9, 7], pum: 1.5, geo: 1.05, reach: 1 },
};
function fowlApplyNormals(m, row) {
  ['jab', 'jab2', 'jab3'].forEach((k, n) => { const q = row.jab[n], mv = m[k], h = mv.h[0]; h.f0 = q[0]; h.f1 = q[1]; h.d = q[2]; mv.t = q[1] + (n < 2 ? 10 : row.jr); if (mv.chain !== undefined) mv.chain = q[1] + 1; });
  for (const k of ['ftilt', 'utilt', 'dtilt', 'dash', 'fsmash', 'usmash', 'dsmash', 'fair', 'bair', 'uair']) { const q = row[k], mv = m[k], h = mv.h[0], len = q[1] - q[0];
    for (const x of mv.h) { x.f0 = q[0]; x.f1 = q[1]; x.d = q[2]; x.r = +(x.r * row.geo).toFixed(1); }
    if (k === 'fsmash' && row.reach !== 1) h.x = +(h.x * row.reach).toFixed(1);
    mv.t = q[1] + q[3]; if (mv.chg) mv.chg = Math.max(2, q[0] - 2); if (mv.air) { mv.ll = q[4]; mv.ac = q[1] + 9; }
    if (k === 'dash') fowlLate(mv, q[4] || Math.round(q[2] * 0.67)); if (len < 0) h.f1 = h.f0; }
  for (const [k, add] of [['grab', 0], ['dgrab', 2], ['pgrab', 3]]) { const h = m[k].h[0], w = h.f1 - h.f0; h.f0 = row.grab + add; h.f1 = h.f0 + w; }
  ['f', 'b', 'u', 'd'].forEach((k, n) => { m.throws[k].d = row.thr[n]; });
}

/* ---- Sling Spin (neutral air) and Catapult Cyclone (up special): the whole rig turns end over end round its middle ----
   The bird end sits RB above the middle and the wooden handle end RH below it; both ends hit. A turn of +angle carries the
   bird end forward over the top. Each hit is tried where the ends were a third and two thirds of a frame ago as well, so a
   fast spin cannot pass through anyone. */
const SPIN = {
  Rusty: { s: 7, w0: 9, re: 4, n: 4, hd: 1.5, fin: 4, rec: 14, ll: 12, turns: 2, sc: 1, fa: 50, fb: 40, fk: 90 },
  Bolt: { s: 6, w0: 8, re: 3, n: 5, hd: 1.2, fin: 3.5, rec: 10, ll: 9, turns: 3, sc: 0.9, fa: 30, fb: 36, fk: 85 },
  Cinder: { s: 9, w0: 11, re: 5, n: 3, hd: 2, fin: 7, rec: 22, ll: 18, turns: 1, sc: 1.15, fa: 45, fb: 45, fk: 100 },
  Pip: { s: 7, w0: 9, re: 3, n: 6, hd: 1, fin: 3.5, rec: 16, ll: 13, turns: 2, sc: 1, fa: 55, fb: 36, fk: 80, mates: 1 },
  Pearl: { s: 8, w0: 10, re: 4, n: 4, hd: 1.25, fin: 4, rec: 16, ll: 13, turns: 2, sc: 1.05, fa: 70, fb: 36, fk: 75, lift: 1 },
};
function rigEnds(a, theta, back, sc, mates) {
  const ox = a.x - (back ? (a.x - a.px) * back : 0), oy = a.y - (back ? (a.y - a.py) * back : 0) + FP, s = Math.sin(theta), c = Math.cos(theta), RB = 5.2 * sc, RH = 7 * sc;
  const out = [[ox + RB * s * a.face, oy + RB * c, 4 * sc], [ox - RH * s * a.face, oy - RH * c, 3 * sc]];
  if (mates) for (const ph of [2.1, -2.1]) out.push([ox + 9 * Math.sin(theta + ph) * a.face, oy + 9 * Math.cos(theta + ph), 2.4]);
  return out;
}
/* A target hit by a dragging spin hit is carried a little along with the rig until its short hitstun ends: its speed eases toward the
   rig's and it is drawn gently back toward the rig's middle if it drifts far out. Weak enough that SDI and DI still decide where it goes. */
function fowlCarry(f) { const o = opp(f); if (!o || o.dragBy !== f.idx || o.state !== 'hurt' || o.hitlag > 0) return; const cx = f.x - o.x, cy = f.y + FP - (o.y + o.st.h / 2), dd = Math.hypot(cx, cy);
  o.vx = appr(o.vx, f.vx, 0.35); o.vy = appr(o.vy, f.vy, 0.35); if (dd > 6) { o.vx += cx / dd * 0.18; o.vy += cy / dd * 0.18; } }
function makeSpin(name) {
  const P = SPIN[name], fin0 = P.w0 + P.n * P.re, fin1 = fin0 + 1, t = fin1 + P.rec;
  const spinAt = (f, mf) => mf < P.s ? -0.35 * mf / P.s : mf <= fin1 ? Math.PI * 2 * P.turns * (mf - P.s) / (fin1 - P.s) : 0.18 * Math.sin((mf - fin1) * 0.9) * Math.exp(-(mf - fin1) / 5);
  const at = (a, back) => rigEnds(a, spinAt(a, a.mf - (back || 0)), back, P.sc, P.mates);
  const h = [];
  for (let k = 0; k < P.n; k++) h.push({ f0: P.w0 + k * P.re, f1: P.w0 + k * P.re + P.re - 1, g: k + 1, x: 0, y: FP, r: 6 * P.sc, at, d: P.hd, drag: 1, a: 0, b: 22, k: 0 });
  h.push({ f0: fin0, f1: fin1, g: 50, x: 0, y: FP, r: 6 * P.sc, at, d: P.fin, a: P.fa, b: P.fb, k: P.fk });
  return { t, air: 1, ll: P.ll, ac: fin1 + 3, spin: 1, spinAt, h,
    on(f, n) {
      if (P.lift && n >= P.w0 && n <= fin1) f.vy = Math.max(f.vy, 0.1);   /* Pearl's spin floats */
      if (n >= P.w0 && n < fin0) fowlCarry(f);
      if (P.mates && n === P.s) for (const ph of [2.1, -2.1]) pipMate(f, (o, p) => { const th = spinAt(o, o.mf) + ph; return [o.x + 9 * Math.sin(th) * o.face, o.y + FP + 9 * Math.cos(th)]; }, fin1 - P.s + 1);
    } };
}
const CY = {   /* Catapult Cyclone, per bird: speed, turn per frame, size, hit damage, hits, finisher */
  Rusty: { spd: 1, rot: 0.42, sc: 1, dmg: 1, hits: 0, fin: 0 }, Bolt: { spd: 1.18, rot: 0.58, sc: 0.9, dmg: 1, hits: 0, fin: -1.5, flat: 1 },
  Cinder: { spd: 0.88, rot: 0.3, sc: 1.15, dmg: 1.5, hits: -1, fin: 2 }, Pip: { spd: 1, rot: 0.42, sc: 1, dmg: 1, hits: 0, fin: -0.5, mates: 1 }, Pearl: { spd: 0.92, rot: 0.34, sc: 1.05, dmg: 0.85, hits: 0, fin: -1, float: 1 },
};
const CY_TIERS = [[10, 2, 1, 6], [25, 3, 1.5, 8.5], [44, 4, 1.5, 12], [45, 5, 2, 14]];   /* charge up to, light hits, each, finisher (overhaul v3, section 7) */
function makeCyclone(name) {
  const V = CY[name], at = (a, back) => rigEnds(a, (a.cyA || 0) - (back || 0) * (a.upGo ? a.cyW : 0), back, V.sc, V.mates);
  return { t: 56, helpless: 1, ledge: 1, rise: 55, fowlUp: 1, blast: 1, spin: 1, spinAt: f => f.cyA || 0, llf: f => f.cyHit ? 22 : 28,
    h: [{ f0: 9, f1: 55, x: 0, y: FP, r: 6 * V.sc, at, d: 1, when: a => !!a.cyMode,
      dyn: a => { a.cyHit = true; return a.cyMode === 'fin' ? { d: a.cy.fin, drag: 0, a: V.flat ? 35 : 55, b: 45, k: 95 } : { d: a.cy.hd, drag: 1, a: 0, b: 22, k: 0 }; } }],
    on(f, n, i) {
      if (n === 1) { f.upC = 0; f.upGo = 0; f.upHold = 0; f.cyMode = null; f.cyA = 0; f.cyW = 0; f.cyHit = false; if (!f.grounded) f.blastUsed = true; }
      if (!f.upGo) {
        if (n < 8) { hang(f); f.cyA = -0.25 * n / 8; return; }
        if (i.spc && f.upHold < 240) {   /* charging: the bands stretch, the rig leans back, and it sinks slowly in the air; held at full charge until let go */
          if (f.upC < 45) f.upC++; f.upHold++; f.mf = 8; f.vx *= 0.9; if (!f.grounded && f.vy < -0.6) f.vy = -0.6; f.cyA = -0.25 - 0.3 * f.upC / 45; return; }
        const c = f.upC, T = CY_TIERS.find(q => c <= q[0]) || CY_TIERS[3], t01 = c / 45, mag = Math.hypot(i.lx, i.ly), dx = mag > 0.3 ? i.lx / mag : 0, dy = mag > 0.3 ? i.ly / mag : 1, sp = (0.34 + 0.46 * t01) * FUP * V.spd;
        const hits = Math.max(1, T[1] + V.hits), go = 12 + Math.round(26 * t01);
        f.cy = { hits, hd: +(T[2] * V.dmg).toFixed(2), fin: +(T[3] * V.dmg + V.fin).toFixed(1), every: Math.max(2, Math.floor(go / (hits + 1))) };
        f.upV = [dx * sp * (V.flat && Math.abs(dx) > 0.2 ? 1.12 : 1), dy * sp]; f.upGo = go; f.upStart = f.mf; f.upEnd = f.mf + go; f.cyW = V.rot * (0.8 + 0.5 * t01); f.cyMode = 'drag'; f.hitG.clear();
        if (dx) f.face = sgn(dx); f.grounded = false; f.plat = null; spark(f.x, f.y + 6, '#fff', 16, 2); beep(220, 0.2, 'sawtooth', 0.07, 2);
      }
      if (f.upGo) {
        const k = f.mf - f.upStart;
        if (f.mf <= f.upEnd) {
          f.vx = f.upV[0]; f.vy = f.y > BLAST.t - 30 && f.upV[1] > 0 ? 0 : f.upV[1] + (V.float ? 0.25 : 0); f.cyA += f.cyW;   /* it never flies itself out through the top */
          fowlCarry(f);
          if (k > 0 && k % f.cy.every === 0 && Math.floor(k / f.cy.every) < f.cy.hits) { f.hitG.clear(); f.cyMode = 'drag'; }
          if (f.mf === f.upEnd - 1) { f.hitG.clear(); f.cyMode = 'fin'; }
        } else if (f.upEnd > 0) { f.vx *= 0.4; f.vy *= 0.4; f.upEnd = -99; f.cyMode = null; f.mf = Math.max(f.mf, f.move.t - 1); }   /* the flight is over, once: straight into the fall */
      }
    } };
}

/* ---- Side B: fire the living bird. No flight timer: the bird flies until it lands, hits, or the player acts. ---- */
const LAUNCH = {
  Rusty: { s: 13, d: 9, sp: 2.5, g: 0.07, steer: 0.05, r: 4.2, a: 45, b: 40, k: 85 },                       /* Redline Launch: steady arc; bounces off whoever it hits */
  Bolt: { s: 10, d: 7, sp: 3.3, g: 0.05, steer: 0.03, r: 3, a: 35, b: 35, k: 72, correct: 1 },              /* Needleflash: fastest, narrow; one sharp correction with special that costs speed; carries through */
  Cinder: { s: 18, d: 15, sp: 2.0, g: 0.1, steer: 0.02, r: 5, a: 45, b: 50, k: 92, dive: 1 },                /* Meteor Launch: slow, heavy; hold down to dive */
  Pip: { s: 13, d: 5, sp: 2.4, g: 0.07, steer: 0.05, r: 3.5, a: 50, b: 30, k: 60, mates: 1 },              /* Trio Launch: two doubles fly in staggered formation */
  Pearl: { s: 14, d: 6, sp: 2.2, g: 0.025, gLate: 0.06, steer: 0.085, r: 4, a: 75, b: 30, k: 55 },        /* Glide Release: floaty, the best steering, a soft glancing hit */
};
function fowlLaunch(f, name) {
  const L = LAUNCH[name], a = (f.fowlAim || 0) * Math.PI / 180;
  f.sling = { x: f.x, y: f.y, face: f.face, vy: 0, plat: f.grounded ? f.plat : null, lost: 0 };
  f.fi += 5; f.y += 6; f.grounded = false; f.plat = null; f.startMove('launch'); f.vx = Math.cos(a) * L.sp * f.face; f.vy = Math.sin(a) * L.sp; f.flyV = [f.vx, f.vy]; f.flying = true; f.flyFix = false;
  if (L.mates) for (const side of [1, -1]) pipMate(f, (o, p) => { const sp = Math.hypot(o.vx, o.vy) || 1, ux = o.vx / sp, uy = o.vy / sp;
      if (p.age > 20 || !o.flying) { p.ghost = true; const th = p.age * 0.3 + (side > 0 ? 0 : Math.PI); return [o.x + 6 * Math.cos(th), o.y + 3.5 + 6 * Math.sin(th)]; }   /* the formation breaks into a close orbit */
      return [o.x - ux * 6 - uy * 5 * side, o.y + 3.5 - uy * 6 + ux * 5 * side]; }, 50, { d: 2, a: 50, b: 25, k: 40 });
  spark(f.x, f.y, '#fff', 14, 2); beep(300, 0.12, 'square', 0.06, 1.6);
}
function fowlFlyEnd(f, name, how) {   /* how: 'hit', 'shield' or 'free' */
  f.flying = false; const c = f.ctl.c;
  if (how === 'shield') { f.vx = -f.face * (name === 'Cinder' ? 0.5 : 1); f.vy = 0.8; f.startMove('flyStop'); return; }   /* stopped by a shield, and open to a punish */
  if (how === 'hit') {
    if (name === 'Rusty') { f.vx = -f.face * 0.9 + c.lx * 0.6; f.vy = 1.8; }   /* one recoil bounce, angled with the stick */
    else if (name === 'Bolt') { f.vx *= 0.85; f.vy *= 0.85; }                 /* carries on through */
    else if (name === 'Cinder') { f.vx *= 0.3; f.vy = 1.6; }
    else if (name === 'Pip') { f.vx *= 0.6; f.vy = 1.3; }
    else { f.vx *= 0.55; f.vy = 1.4; }                                        /* Pearl glances past with a soft lift */
  }
  f.move = null; f.set('air');
}
function makeLaunch(name) {
  const L = LAUNCH[name];
  return { t: 64, nodrift: 1, ll: 10, h: [{ f0: 1, f1: 62, x: 0, y: 3.5, r: L.r, d: L.d, a: L.a, b: L.b, k: L.k, when: a => a.flying }], onLand(f) { f.flying = false; },
    on(f, n, i) {
      if (!f.flying) return;
      if (f.flyV) { f.vx = f.flyV[0]; f.vy = f.flyV[1]; }   /* the flight keeps its own speed: the attack state's ordinary air physics does not get a say */
      if (f.hitG.size) { fowlFlyEnd(f, name, blocked(f) ? 'shield' : 'hit'); return; }
      f.vy = Math.max(f.vy - (L.gLate && n > 20 ? L.gLate : L.g), -3.2);
      const st = L.steer * (i.lx * f.vx < 0 ? 0.5 : 1); f.vx += i.lx * st; const sp = Math.hypot(f.vx, f.vy), cap = L.sp * 1.15; if (sp > cap) { f.vx *= cap / sp; f.vy *= cap / sp; }
      if (L.dive && i.ly < -0.5) f.vy = Math.max(f.vy - 0.25, -4.2);   /* Cinder tucks and drops */
      if (L.correct && !f.flyFix && n > 3 && f.ctl.take('spc')) {   /* Bolt's one sharp correction: a new heading, at three quarters of the speed */
        const m = Math.hypot(i.lx, i.ly), s2 = Math.hypot(f.vx, f.vy) * 0.75; if (m > 0.3) { f.vx = i.lx / m * s2; f.vy = i.ly / m * s2; if (i.lx) f.face = sgn(i.lx); } f.flyV = [f.vx, f.vy]; f.flyFix = true; spark(f.x, f.y + 3, '#fff3c4', 10, 1.4); beep(900, 0.04, 'square', 0.03); return; }
      if (n > 6 && f.airActs()) { f.flying = false; return; }   /* any attack, jump, dodge or special ends the flight */
      f.flyV = [f.vx, f.vy];
      if (n >= 60) fowlFlyEnd(f, name, 'free');   /* a safety cap, so nothing is ever stuck in flight */
    } };
}

/* ---- Down B in the slingshot: each bird's own technique (special-moves bible, sections 3 to 7) ---- */
function makeSlingDown(name) {
  if (name === 'Rusty') return {   /* Brace & Break: plant and brace; a light frontal hit on frames 8 to 13 is answered with a 10% snap */
    t: 37, counter: [8, 13], counterMax: 12, h: [], on(f, n, i) { if (n >= 10 && n <= 13 && (f.ctl.take('atk') || !i.spc)) f.startMove('dsnap'); } };
  if (name === 'Bolt') return {   /* Skitter Step: a low elastic skid; one limited correction; jump at the end for a low hop */
    t: 30, low: [6, 16], h: [{ f0: 6, f1: 10, x: 4, y: 2.5, r: 4, d: 3, a: 40, b: 30, k: 40 }],
    on(f, n, i) {
      if (n === 1) { f.skFix = false; f.skBlk = false; if (!f.grounded) { if (f.airUse.sk) { f.mf = f.move.t; return; } f.airUse.sk = 1; } }
      if (n === 6) f.vx = f.face * (f.grounded ? 3.4 : 2.4);
      if (n > 6 && n <= 16) { f.vx *= 0.95; if (!f.skFix && i.lx * f.face < -0.5) { f.vx *= -0.45; f.skFix = true; } if (!f.grounded) f.vy = Math.max(f.vy, -0.4); }
      if (f.hitG.size && blocked(f) && !f.skBlk) { f.skBlk = true; f.vx = 0; f.mf -= 6; }   /* stopped by a shield: six frames longer to recover */
      if (n >= 13 && n <= 16 && f.grounded && f.ctl.take('jmp')) { f.grounded = false; f.plat = null; f.vy = 1.5; f.vx *= 0.9; f.move = null; f.set('air'); }
    } };
  if (name === 'Cinder') return {   /* Anvil Drop: the handle driven into the floor; a small shock along it on both sides */
    t: 48, h: [{ f0: 15, f1: 18, x: 2, y: 2, r: 5, d: 8, a: 70, b: 45, k: 80 }, { f0: 16, f1: 19, x: 8, y: 1, r: 3.5, d: 6, a: 75, b: 35, k: 60, g: 1, gndOnly: 1 }, { f0: 16, f1: 19, x: -8, y: 1, r: 3.5, d: 6, a: 105, b: 35, k: 60, g: 1, gndOnly: 1 }],
    on(f, n) { if (n === 1) f.adHit = false; if (!f.grounded && n >= 8) f.vy = -3.2; if (f.hitG.size && !f.adHit) { f.adHit = true; f.mf += 6; } if (n === 15 && f.grounded) { shake = Math.max(shake, 5); spark(f.x, f.y, '#c9a27a', 14, 1.6); } },
    onLand(f, mf) { if (mf >= 8) { for (const s of [1, -1]) PROJ.push({ x: f.x + s * 7, y: f.y + 1.5, vx: 0, vy: 0, grav: 0, life: 4, owner: f.idx, face: s, r: 3.5, ground: 'pass', plat: null, kind: 'blast', grp: 'anvil' + f.idx, h: { d: 6, a: 75, b: 35, k: 60, id: 'Cinder:anvil' } }); shake = Math.max(shake, 5); } },
    llf: f => f.hitG.size ? 16 : 26 };
  if (name === 'Pip') return {   /* Orbit Parade: two doubles circle the slingshot for 18 frames while it moves at 70%; down + special again pulls them in */
    t: 43, h: [], on(f, n, i) {
      if (n === 1) f.opDir = i.lx * f.face < -0.3 ? -1 : 1;
      if (n === 8) for (const ph of [0, Math.PI]) pipMate(f, (o, p) => { const th = p.age * 0.38 * o.opDir + ph; return [o.x + 8 * Math.sin(th), o.y + 11 + 8 * Math.cos(th)]; }, 18, { d: 1.5, a: 70, b: 25, k: 20 }, { hits: 2, rehit: 8, tag: 'parade' + f.idx });
      if (n > 8 && n <= 26) { if (f.grounded) f.vx = appr(f.vx, i.lx * f.st.run * 0.7, 0.3);
        if (n > 10 && i.ly < -0.5 && edge(f)) { for (const p of PROJ) if (p.tag === 'parade' + f.idx) p.life = 0; PROJ.push({ x: f.x, y: f.y + 11, vx: 0, vy: 0, grav: 0, life: 3, owner: f.idx, face: f.face, r: 7, ground: 'pass', plat: null, kind: 'blast', h: { d: 3, a: 80, b: 40, k: 50, id: 'Pip:converge' } }); f.mf = f.move.t - 21; } }
    } };
  return {   /* Pearl, Nest Marker: one planted nest; an opponent who walks into it is lifted a little */
    t: 30, h: [], on(f, n) {
      if (n !== 12 || PROJ.some(p => p.owner === f.idx && p.kind === 'nest')) return;
      let fy = null; if (f.grounded) fy = f.y; else for (const q of PLATS) if (f.x >= q.x0 && f.x <= q.x1 && q.y <= f.y && f.y - q.y < 60 && (fy === null || q.y > fy)) fy = q.y;
      if (fy === null) return;
      PROJ.push({ x: f.x + f.face * 3, y: fy + 1.8, vx: 0, vy: 0, grav: 0, life: 150, owner: f.idx, face: f.face, r: 4, ground: 'pass', plat: null, kind: 'nest', gndBreak: 1, h: { d: 2, a: 90, b: 48, k: 10, id: 'Pearl:nest' },
        onHit(p, o) { if (!o.grounded && Math.abs(o.x - p.x) < 25) o.vy = Math.max(o.vy, 1.2); } });   /* Pearl nearby in the air gets a little lift too */
      beep(560, 0.06, 'triangle', 0.04);
    } };
}

/* ---- Bird-alone specials (special-moves bible): three for each bird ---- */
function makeSolo(name) {
  const S = {};
  if (name === 'Rusty') {
    S.nspec = { t: 30, h: [{ f0: 10, f1: 13, x: 0, y: 3.5, r: 6.5, d: 3, a: 50, b: 30, k: 30 }] };   /* Rally Cry: a pulse round his body */
    S.sspec = { t: 48, once: 1, nodrift: 1, h: [{ f0: 13, f1: 20, x: 3, y: 3.5, r: 4.2, d: 7, a: 45, b: 34, k: 70 }],   /* Shoulder Check */
      on(f, n) { if (n === 1) f.scHit = false; if (n >= 13 && n <= 20 && !f.scHit) { f.vx = f.face * 1.9; if (!f.grounded) f.vy = Math.max(f.vy, 0); }
        if (f.hitG.size && !f.scHit) { f.scHit = true; if (blocked(f)) f.vx = 0; else { f.vy = 1.2; f.vx = f.face * 0.6; f.grounded = false; f.plat = null; f.mf += 5; } } if (n === 21) f.vx *= 0.4; } };
    S.uspec = { t: 35, helpless: 1, ledge: 1, rise: 42, vault: 1, twoStep: 1, h: [{ f0: 7, f1: 10, x: 0, y: 4, r: 4.5, d: 2, a: 80, b: 40, k: 30 }, { f0: 8, f1: 34, x: 0, y: 4, r: 4.5, d: 2, a: 80, b: 40, k: 30, g: 1, when: a => a.v2 && a.mf <= a.v2 + 3 }],
      on(f, n, i) { if (n === 1) f.v2 = 0; if (n < 7) hang(f); if (n === 7) { lift(f, jumpV(26, f.st.grav)); f.vx = i.lx * 0.9; }   /* Captain's Vault: a hop, and a second one if special is pressed again within 16 frames */
        if (n > 7 && n <= 23 && !f.v2 && edge(f)) { f.v2 = n; lift(f, jumpV(17, f.st.grav)); f.vx = i.lx * 1.1; spark(f.x, f.y, '#fff', 8, 1.2); }
        if (n === 24 && !f.v2) f.mf = f.move.t - 1; } };
  } else if (name === 'Bolt') {
    S.nspec = { t: 27, h: [{ f0: 8, f1: 11, x: 2, y: 3.5, r: 4, d: 3.5, a: 45, b: 30, k: 40 }],   /* Brake & Burst: stop dead, then burst the way the stick points */
      on(f, n, i) { if (n === 1) { if (!f.grounded) { if (f.airUse.brake) { f.mf = f.move.t; return; } f.airUse.brake = 1; } }
        if (n <= 7) { f.vx *= 0.55; if (!f.grounded) f.vy = Math.max(f.vy, -0.3) * 0.5; const m = Math.hypot(i.lx, i.ly); f.bDir = m > 0.4 ? [i.lx / m, i.ly / m] : f.bDir && n > 1 ? f.bDir : [f.face, 0]; if (Math.abs(f.bDir[0]) > 0.3) f.face = sgn(f.bDir[0]); }
        if (n === 8) { f.vx = f.bDir[0] * 2.8; f.vy = f.grounded ? 0 : f.bDir[1] * 2.4; if (f.vy > 0) { f.grounded = false; f.plat = null; } }
        if (n > 8 && n <= 11) { f.vx *= 0.92; if (f.hitG.size && blocked(f)) f.vx = -f.face * 1.1; } } };
    S.sspec = { t: 36, once: 1, nodrift: 1, h: [{ f0: 9, f1: 12, x: 2.5, y: 3.5, r: 3.8, d: 5, a: 45, b: 32, k: 60 }, { f0: 13, f1: 16, x: 2.5, y: 3.5, r: 3.8, d: 3, a: 50, b: 30, k: 50, g: 1, when: a => !a.zzBlk && !a.zzStop }],   /* Zigzag */
      on(f, n, i) { if (n === 1) { f.zzBlk = false; f.zzStop = false; f.zzUp = clamp(i.ly, -1, 1) * 0.35; }
        if (n >= 9 && n <= 12) { f.vx = f.face * 2.8; f.vy = f.grounded ? 0 : f.zzUp * 2.8; }
        if (f.hitG.size && blocked(f)) f.zzBlk = true;
        if (n === 13) { const m = Math.hypot(i.lx, i.ly); if (i.lx * f.face < -0.5) { f.zzStop = true; f.vx = 0; } else if (m > 0.4) { const ux = i.lx / m, uy = i.ly / m; f.vx = (ux * f.face < 0 ? 0.2 * f.face : ux) * 2.6; f.vy = f.grounded && uy < 0 ? 0 : uy * 2.6; if (f.vy > 0) { f.grounded = false; f.plat = null; } } }
        if (n > 13 && n <= 16 && !f.zzStop) { f.vx *= 0.96; if (!f.grounded) f.vy *= 0.96; }
        if (n === 17) { f.vx *= 0.4; f.vy *= 0.4; } } };
    S.uspec = { t: 30, helpless: 1, ledge: 1, rise: 34, h: [{ f0: 10, f1: 13, x: 0, y: 3.5, r: 4, d: 3, a: 70, b: 35, k: 30 }],   /* Flash Step: a launch in one of eight directions, then one small correction */
      on(f, n, i) { if (n === 1) { f.fsFix = false; f.fsGl = false; } if (n < 9) { hang(f); return; }
        if (n === 9) { const m = Math.hypot(i.lx, i.ly); let ux = 0, uy = 1; if (m > 0.4) { const a8 = Math.round(Math.atan2(i.ly, i.lx) / (Math.PI / 4)) * Math.PI / 4; ux = Math.cos(a8); uy = Math.sin(a8); } if (uy < 0 && f.grounded) uy = 0; f.vx = ux * 3.1; f.vy = uy * 3.1; if (ux) f.face = sgn(ux); f.grounded = false; f.plat = null; }
        if (n > 9 && n <= 22) { f.vx *= 0.96; f.vy = f.vy * 0.96 - f.st.grav * 0.3;
          if (!f.fsFix && n > 13) { const m = Math.hypot(i.lx, i.ly), sp = Math.hypot(f.vx, f.vy); if (m > 0.5 && sp > 0.5) { const cur = Math.atan2(f.vy, f.vx), want = Math.atan2(i.ly, i.lx); let d = want - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) > 0.3) { const nd = cur + clamp(d, -0.8, 0.8); f.vx = Math.cos(nd) * sp; f.vy = Math.sin(nd) * sp; f.fsFix = true; } } }
          if (f.hitG.size && !f.fsGl) { f.fsGl = true; f.vy = Math.abs(f.vy) * 0.6 + 0.4; f.vx *= 0.7; } }
      } };
  } else if (name === 'Cinder') {
    S.nspec = { t: 120, armor: [15, 18], armorMax: 8, armorHits: 1, h: [],   /* Pressure Cooker: hold to compress (up to 18 frames), let go to burst round himself */
      on(f, n, i) { if (n === 1) { f.pcC = 0; f.pcRel = 0; f.pcHit = false; }
        if (!f.pcRel) { if (i.spc && f.pcC < 60) { f.pcC++; if (f.mf > 19) f.mf = 19; return; } f.pcRel = f.mf; }
        if (f.mf === f.pcRel + 5) { const c = Math.min(f.pcC, 18) / 18; PROJ.push({ x: f.x, y: f.y + 3.5, vx: 0, vy: 0, grav: 0, life: 4, owner: f.idx, face: f.face, r: 6.5, ground: 'pass', plat: null, kind: 'blast', h: { d: +(6 + 5 * c).toFixed(1), a: 60, b: 40, k: 70 + 25 * c, id: 'Cinder:cooker' }, onHit(p, o, v) { o.pcHit = true; } }); spark(f.x, f.y + 3.5, '#ff9a3c', 16, 1.8); shake = Math.max(shake, 4); }
        if (f.pcRel && f.mf >= f.pcRel + 8 + (f.pcHit ? 22 : 30)) f.mf = f.move.t; } };
    S.sspec = { t: 51, once: 1, nodrift: 1, low: [14, 22], armor: [14, 16], armorMax: 8, armorHits: 1, h: [{ f0: 14, f1: 22, x: 2.5, y: 2.5, r: 4.5, d: 9, a: 40, b: 40, k: 70 }],   /* Furnace Roll */
      on(f, n) { if (n === 1) { f.frHit = false; f.frWall = false; } if (n >= 14 && n <= 22) { f.vx = f.face * 1.7; if (!f.grounded) f.vy = Math.max(f.vy, -0.6);
          if (!f.frWall && !f.grounded && f.y < 0 && Math.abs(f.x + f.vx) - FB / 2 < stageHalf(f.y)) { f.frWall = true; f.face = -f.face; f.vx = f.face * 0.9; } }   /* bounces once off the island's side */
        if (f.hitG.size && !f.frHit) { f.frHit = true; f.mf += 5; } if (n === 23) f.vx *= 0.3; } };
    S.uspec = { t: 45, helpless: 1, ledge: 1, rise: 30, h: [{ f0: 16, f1: 19, x: 0, y: 3, r: 5.5, d: 6, a: 75, b: 45, k: 45 }],   /* Blast Hop */
      on(f, n, i) { if (n < 16) { hang(f); return; } if (n === 16) { const under = f.y < -4 && Math.abs(f.x) < EDGE + 6; lift(f, jumpV(under ? 18 : 30, f.st.grav)); f.vx = i.lx * 0.5; spark(f.x, f.y, '#ff9a3c', 18, 2); shake = Math.max(shake, 3); } } };
  } else if (name === 'Pip') {
    S.nspec = { t: 24, h: [],   /* Switcheroo: two doubles appear either side; Pip swaps places with the one the stick picks */
      on(f, n, i) { if (n === 1) { if (!f.grounded) { if (f.airUse.sw) { f.mf = f.move.t; return; } f.airUse.sw = 1; } f.swX = f.x; f.swY = f.y; for (const s of [1, -1]) { const x = f.x + s * 14, y = f.y; pipMate(f, () => [x, y + 3.5], 24, null, { tag: 'sw' + f.idx, side: s }); } }
        if (n === 9) { const s = Math.abs(i.lx) > 0.3 ? sgn(i.lx) : f.face, nx = f.swX + s * 14, mx = (f.x + nx) / 2;
          for (const p of PROJ) if (p.tag === 'sw' + f.idx && p.side === s) p.life = 0;
          PROJ.push({ x: mx, y: f.y + 3.5, vx: 0, vy: 0, grav: 0, life: 2, owner: f.idx, face: f.face, r: 7.5, ground: 'pass', plat: null, kind: 'blast', h: { d: 2, a: 60, b: 25, k: 30, id: 'Pip:switch' } });
          f.x = nx; if (f.grounded && (Math.abs(nx) > EDGE || !f.plat || nx < f.plat.x0 || nx > f.plat.x1)) { f.grounded = false; f.plat = null; } spark(f.x, f.y + 3, '#bfeccd', 10, 1.4); } } };
    S.sspec = { t: 39, once: 1, nodrift: 1, h: [{ f0: 11, f1: 14, x: 3, y: 3.5, r: 3.8, d: 4, a: 45, b: 30, k: 55 }],   /* Trio Relay: Pip darts in and the doubles sweep in from either side, four frames apart */
      on(f, n, i) { if (n >= 11 && n <= 14) { f.vx = f.face * 2.4; if (!f.grounded) f.vy = Math.max(f.vy, 0); } if (n === 15) f.vx *= 0.4;
        if (n === 1) { const tx = f.x + f.face * 14, ty = f.y + 3.5 + clamp(i.ly, -1, 1) * 4; [[1, 15], [-1, 19]].forEach(([s, arrive]) => { const x0 = f.x - f.face * 6, y0 = f.y + 3.5 + s * 9;
            pipMate(f, (o, p) => { const k = Math.min(1, p.age / arrive); return [x0 + (tx - x0) * k, y0 + (ty - y0) * k]; }, arrive + 3, { d: 2, a: 50, b: 25, k: 45 }, { hits: 1 }); }); } } };
    S.uspec = { t: 40, helpless: 1, ledge: 1, rise: 34, twoStep: 1, h: [{ f0: 8, f1: 11, x: 0, y: 2, r: 4, d: 2, a: 80, b: 35, k: 30 }, { f0: 18, f1: 39, x: 0, y: 2, r: 4, d: 2, a: 80, b: 35, k: 30, g: 1, when: a => a.lad2 && a.mf <= a.lad2 + 3 }],   /* Bird Ladder: bounce off one double, then steer into a second */
      on(f, n, i) { if (n === 1) f.lad2 = 0; if (n < 8) { hang(f); return; }
        if (n === 8) { lift(f, jumpV(20, f.st.grav)); f.vx = i.lx * 0.7; const x = f.x, y = f.y - 3; pipMate(f, () => [x, y], 12, null); }
        if (n >= 18 && n <= 25 && !f.lad2 && edge(f)) { f.lad2 = n; lift(f, jumpV(14, f.st.grav)); f.vx = i.lx * 1.6; const x = f.x, y = f.y - 3; pipMate(f, () => [x, y], 12, null); }
        if (n === 26 && !f.lad2) f.mf = f.move.t - 1; } };
  } else {
    S.nspec = { t: 30, h: [],   /* Feather Brake: wings open; slower fall and finer drift for up to 24 frames; let go to stop */
      on(f, n, i) { if (n === 1) { if (!f.grounded && (f.airUse.fb >= 2 || f.airT < (f.airUse.fbReady || 0))) { f.mf = f.move.t; return; } if (!f.grounded) f.airUse.fb = (f.airUse.fb || 0) + 1; }
        if (f.grounded) { if (n > 8) f.mf = f.move.t; return; }
        if (n === 5) { const ex = Math.abs(f.vx) - f.st.airSpeed; if (ex > 0) { f.vy += ex * 0.8; f.vx *= 0.7; } }
        if (n >= 5) { f.vy = Math.max(f.vy - f.st.grav * 0.3, -0.35); f.vx = appr(f.vx, i.lx * f.st.airSpeed, 0.08); if (!i.spc || n >= 29) { f.airUse.fbReady = f.airT + 18; f.move = null; f.set('air'); } } } };
    S.sspec = { t: 39, once: 1, nodrift: 1, h: [{ f0: 12, f1: 17, x: 3, y: 3.5, r: 6.5, d: 5, a: 70, b: 32, k: 45 }],   /* Swoop & Fold: a folded glide, then a wide sweep that glances up */
      on(f, n, i) { if (n === 1) { f.swpA = clamp(i.ly, -1, 1) * 0.6 - 0.25; f.swpHit = false; } if (n === 6) f.swpA = clamp(f.swpA + clamp(i.ly, -1, 1) * 0.3, -0.85, 0.6);
        if (n <= 17 && !f.swpHit) { f.vx = Math.cos(f.swpA) * 1.8 * f.face; f.vy = f.grounded && f.swpA < 0 ? 0 : Math.sin(f.swpA) * 1.8; if (f.vy > 0) { f.grounded = false; f.plat = null; } }
        if (f.hitG.size && !f.swpHit) { f.swpHit = true; if (blocked(f)) { f.vx = -f.face * 1; f.vy = 0.5; } else { f.vy = 1.3; f.vx *= 0.5; } } if (n === 18) f.vx *= 0.5; } };
    S.uspec = { t: 44, helpless: 1, ledge: 1, rise: 44, h: [{ f0: 9, f1: 12, x: 0, y: 4, r: 4.5, d: 2, a: 80, b: 35, k: 25 }],   /* Thermal Rise: a smooth, steerable climb */
      on(f, n, i) { if (n < 9) { hang(f); return; } if (n === 9) { f.grounded = false; f.plat = null; }
        if (n <= 34) { f.vy = 1.75 - (n - 9) * 0.03; f.vx = appr(f.vx, i.lx * 1.3, i.lx * f.vx < 0 ? 0.03 : 0.07); } } };
  }
  return S;
}

/* ---- the selector: Neutral B in the slingshot ---- */
/* Tap: the next bird. Hold 8 frames: the wheel opens; point with the stick and let go to confirm. Then a six-frame pouch
   swap, with the bird changing halfway through it. The stick only points while the wheel is open: it does not drift the
   slingshot, and a pick needs the stick in the same slice two frames running, so a stick springing back to the middle
   (which can bounce through the opposite side) does not change the choice. */
const SEL_SWAP = 6;
const SELECTOR = { t: 40, h: [], sel: 1, nodrift: 1,
  on(f, n, i) {
    if (n === 1) { f.selOpen = false; f.selPick = f.fi; f.selDone = false; f.selHold = 0; f.selCand = -1; f.selCandN = 0; f.selRel = 0; f.selTo = -1; }
    if (f.selDone) {   /* the pouch swap */
      if (n === f.move.t - (SEL_SWAP >> 1) && f.selTo >= 0 && f.selTo !== f.fi) { f.fi = f.selTo; spark(f.x, f.y + 12, '#fff', 10, 1.2); beep(660, 0.05, 'triangle', 0.04); }
      return;
    }
    if (i.spc && ++f.selHold < 240) {
      if (n >= 8) {
        f.selOpen = true; const m = Math.hypot(i.lx, i.ly);
        if (m > 0.6) { const k = ((Math.round(Math.atan2(i.lx, i.ly) / (Math.PI * 2 / 5)) % 5) + 5) % 5;   /* clockwise from straight up: Flint, Bolt, Cinder, Pip, Pearl */
          f.selCandN = k === f.selCand ? f.selCandN + 1 : 1; f.selCand = k; if (f.selCandN >= 2) f.selPick = k; }
        else { f.selCand = -1; f.selCandN = 0; }
      }
      if (n > 9) f.mf = 9; return; }
    f.selTo = f.selOpen ? f.selPick : (f.fi + 1) % 5; f.selOpen = false; f.selDone = true; f.selRel = Math.min(n, 9);
    f.mf = f.move.t - SEL_SWAP;
  } };

const FOWLS = { name: 'Furious Fowls', sub: 'five birds and a slingshot', fowl: 1, cycle: 5, forms: [] };
(function () {
  const base = FLINT.forms[0].st, COL = { Rusty: ['#b5533a', '#f1d7a8', '#f6a623'], Bolt: ['#f2b91e', '#2f6f78', '#fff3c4'], Cinder: ['#3a3134', '#a8623a', '#f26b1d'], Pip: ['#2bb8b0', '#bfeccd', '#ffffff'], Pearl: ['#f3e2cf', '#c9736b', '#ffffff'] };
  const UPH = { Rusty: 26, Bolt: 26, Cinder: 30, Pip: 20, Pearl: 34 };
  /* The body box in the slingshot covers the whole slingshot with the bird in its pouch (the owner, 2026-11-11), so it is as tall as
     each bird sits: measured from the drawn models with auditHurtboxes() in tools/audit.js. The width (FW) already spans the slingshot. */
  const SLH = { Rusty: 16.5, Bolt: 16.5, Cinder: 18.5, Pip: 15.5, Pearl: 17 };   /* the tallest each reaches through its idle bob */
  const stat = (b, solo) => Object.assign({}, base, { weight: Math.round(base.weight * b.weight / 100 * (solo ? 0.8 : 1)), walk: +(base.walk * b.run).toFixed(2), dash: +(base.dash * b.run * (solo ? 1.05 : 1)).toFixed(2), run: +(base.run * b.run * (solo ? 1.05 : 1)).toFixed(2),
    airSpeed: +(base.airSpeed * b.air).toFixed(2), grav: +(base.grav * b.grav).toFixed(3), fall: +(base.fall * b.grav).toFixed(2), ffall: +(base.ffall * b.grav).toFixed(2), w: solo ? FB : FW, h: solo ? 7 : SLH[b.name], jf: solo ? 2.6 : 3.4, jb: solo ? 1.4 : 2,
    upH: solo ? UPH[b.name] : undefined, pummel: solo ? 1 : FN[b.name].pum });
  const combined = FOWL.forms.map(b => { const C = FOWL.combined, nm = b.name, L = LAUNCH[nm];
    const m = fowlNormals(mk(1, 1, 1, 1, {
      nspec: SELECTOR,
      /* Side B: aim with the stick during the wind-up, then the bird itself is fired and takes the controls with it */
      sspec: { t: L.s + 3, h: [], nodrift: 1, on(f, n, i) { if (n <= L.s) { f.fowlAim = 25 + clamp(i.ly, -1, 1) * 30;   /* a cannonball arc by default; up or down tilts it */ hang(f); } if (n === L.s + 1) fowlLaunch(f, nm); } },
      uspec: makeCyclone(nm),
      dspec: makeSlingDown(nm),
      dsnap: { t: 21, h: [{ f0: 2, f1: 4, x: 7, y: 9, r: 4.5, d: 6, a: 45, b: 35, k: 60 }] },   /* Brace & Break with nothing to answer: a weaker band snap */
      dcounter: { t: 22, h: [{ f0: 2, f1: 4, x: 7, y: 9, r: 5.5, d: 10, a: 40, b: 50, k: 80 }], on(f, n) { if (n === 5) { f.vx = -f.face * 1; if (f.grounded) { f.grounded = false; f.plat = null; } f.vy = 1.2; } } },   /* the counter: a 10% snap, then a small rebound back and up */
    }, { jabs: 3 }), Object.assign({}, C, { down_air: null }), FW, 7.5, 3);
    fowlApplyNormals(m, FN[nm]);
    m.nair = makeSpin(nm);
    const q = FN[nm].dair, t = q[1] + q[3];
    if (nm === 'Rusty') { const d0 = C.down_air_wooden_red_dummy; m.dair = { t, air: 1, ll: q[4], ac: q[1] + 9, h: [], on(f, n) { if (n === q[0]) { shoot(f, { kind: 'dummy', tag: 'fowldown', max: 1, ox: 0.01, oy: 7.5 - 0.45 * FW, vx: 0, vy: -2.6, r: 0.22 * FW, life: 40, lateAt: 5, lateH: { d: 8, a: 70, b: 30, k: 60 }, h: { d: q[2], a: d0.ang, b: d0.b, k: d0.k } }); if (!f.dairUsed) { f.dairUsed = true; f.vy = Math.max(f.vy, 0) + 1.35; } } } }; }
    else if (nm === 'Bolt') m.dair = { t, air: 1, ll: q[4], ac: q[1] + 9, h: [{ f0: q[0], f1: q[1], x: 3, y: 2, r: 4.5, d: q[2], a: 45, b: 30, k: 72 }], on(f, n) { if (n >= q[0] && n <= q[1]) { f.vx = f.face * 2.2; f.vy = -2.4; } } };   /* a fast diagonal dive that keeps its speed */
    else if (nm === 'Cinder') m.dair = { t, air: 1, ll: q[4], ac: q[1] + 9, h: [{ f0: q[0], f1: q[1], x: 0, y: -1, r: 5.5, d: q[2], a: 270, b: 30, k: 85 }], on(f, n) { if (n >= q[0] && n <= q[1]) f.vy = -3.5; } };   /* an explosive plunge that spikes */
    else if (nm === 'Pip') m.dair = { t, air: 1, ll: q[4], ac: q[1] + 9, h: [[12, 14, 1], [15, 17, 2], [18, 19, 3]].map(([a0, a1, g]) => ({ f0: a0, f1: a1, g, x: 0, y: -1, r: 4, d: 3, a: g === 3 ? 280 : 70, b: g === 3 ? 30 : 25, k: g === 3 ? 70 : 20 })) };   /* three staggered strikes downward */
    else m.dair = { t, air: 1, ll: q[4], ac: q[1] + 9, h: [{ f0: q[0], f1: q[1], x: 0, y: -1, r: 4.5, d: q[2], a: 270, b: 25, k: 70 }],   /* Pearl: a strike below, an egg dropped, and a little float */
      on(f, n) { if (n === q[0]) shoot(f, { kind: 'egg', ox: 0.01, oy: 0, vx: 0, vy: -0.6, grav: 0.09, r: 2, life: 60, boom: { r: 5.5, d: 6, k: 60 }, h: { d: 6, a: 70, b: 30, k: 60 } }); if (n === q[1]) f.vy = Math.max(f.vy, 0.8); } };
    return { name: nm, label: FOWL_LABEL[nm], role: FOWL_ROLE[nm], col: COL[nm], alt: COL[nm], reachMul: 1.0, st: stat(b, false), aiSide: 1, sling: 1, moves: m };
  });
  const SOLO_N = { jab: [4, 6, 3], ftilt: [7, 11, 5], utilt: [7, 11, 4], dtilt: [6, 10, 4], dash: [10, 16, 6], fsmash: [16, 23, 9], usmash: [13, 20, 8], dsmash: [14, 20, 8], nair: [7, 13, 5], fair: [9, 15, 6], bair: [9, 15, 6], uair: [8, 14, 5], dair: [14, 20, 6] };   /* overhaul v3, section 10 */
  const solo = FOWL.forms.map(b => { const nm = b.name;
    const m = fowlNormals(mk(1, 1, 1, 1, Object.assign(makeSolo(nm), {
      /* Down B: back into the pouch, when close to the slingshot (about one and a half widths). Anywhere else it does nothing. */
      dspec: { t: 8, h: [], on(f, n) { if (n === 6 && f.sling && Math.hypot(f.x - f.sling.x, f.y - f.sling.y) < 1.5 * FW) fowlRejoin(f); } },
      launch: makeLaunch(nm),
      flyStop: { t: nm === 'Cinder' ? 30 : 18, h: [] },
    })), FOWL.solo, FB, 3.5, 1);
    for (const k in SOLO_N) { const q = SOLO_N[k], mv = m[k]; if (!mv || !mv.h || !mv.h.length) continue; const rec = mv.t - mv.h[0].f1; for (const h of mv.h) { h.f0 = q[0]; h.f1 = q[1]; h.d = q[2]; } mv.t = q[1] + Math.max(8, rec); if (mv.air) mv.ac = q[1] + 9; }
    return { name: nm + ' alone', label: FOWL_LABEL[nm] + ' alone', col: COL[nm], alt: COL[nm], reachMul: 1.0, st: stat(b, true), aiSide: 1, moves: m };
  });
  FOWLS.forms = combined.concat(solo);
})();

/* ---------- Chomp Chomp (original; the owner's design v2, 2026-11-10) ----------
   A squat blue critter with a leaf sprout, small beady eyes and a huge toothy mouth. He bites, swings on a rope, rides a
   bubble, puffs an air cushion, and plays a hot coal round the stage that his ant can carry back to him.
   Neutral B, the hot coal (one per Chomp at any time; all of it lives in PROJ, so it is part of every snapshot):
     - no coal: tosses it out on a rope from a little hook above and ahead (out on frame 13, can hit from frame 18). It swings
       as a pendulum.
     - swinging: B again is a relay. Pressed within 3 frames of the moment the coal swings out past its mark, it hops to a new
       rope further on, keeping its speed (a little faster within 1 frame). Up to 3 relays. Pressed at any other moment it
       lets go, and the coal flies on with the speed it had. Left alone it lets go at the far end of its swing.
     - landed: stays 8 seconds. Chomp picks it up by walking over it. B while it lies there: a rope runs from the coal to
       Chomp, wherever he is, every frame, and an ant crawls from the coal along it toward him (from frame 10). The rope
       is in the way: an opponent cannot move through it (see ropeBlock), but it never hurts; only the ant hits (7%, once
       a trip). A damaging attack on the rope cuts it (a grab or a push with no damage does not), and on the ant destroys it; the coal stays where it lies. The ant arriving
       hands Chomp the coal back.
     - flying off the stage (past the edge, or below the floor): B calls the ant too. The coal stops where it is, in the
       air, for as long as the call and the ant's walk last. If the call is stopped or the rope is cut, it falls again.
   Its damage grows with its speed: 5% slow, up to 12% at full tilt after relays. */
const COAL = { g: 0.11, mark: 0.55, win: 3, relays: 3, boost: 1.1, keep: 0.97, vmax: 3.4, arc: 70, ground: 480, cd: 50, antV: 1.15, antD: 7, burn: 3 };
const chompCoal = f => PROJ.find(p => p.owner === f.idx && p.tag === 'coal' && p.life > 0);
const chompAnt = f => PROJ.find(p => p.owner === f.idx && p.tag === 'ant' && p.life > 0);
const chompMouth = f => [f.x + f.face * 3, f.y + 5];
function segDist(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-6, t = clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1); return [Math.hypot(px - x0 - dx * t, py - y0 - dy * t), t]; }
/* a pendulum step: angle from straight down, positive toward +x */
function coalSwing(p) { p.w += -(COAL.g / p.L) * Math.sin(p.th); const x = p.ax + p.L * Math.sin(p.th + p.w), y = p.ay - p.L * Math.cos(p.th + p.w); p.th += p.w; p.vx = x - p.x; p.vy = y - p.y; p.x = x; p.y = y; }
function coalSpeedHit(p) { const sp = Math.hypot(p.vx, p.vy); p.h.d = Math.round(clamp(4 + sp * 2.3, 5, 12) * 10) / 10; p.face = sgn(p.vx) || p.face; }
function coalStep(p) {
  const ow = F[p.owner]; if (!ow || ow.state === 'dead') { p.life = 0; return; }
  if (p.st === 'swing') {
    coalSwing(p); p.arcT++;
    /* the relay mark: the frame it swings out past COAL.mark (forward of its hook) */
    if (p.markAge === undefined && sgn(p.w) === p.dir && p.th * p.dir >= COAL.mark) p.markAge = p.age;
    coalSpeedHit(p);
    if (p.y - p.r < 0 && Math.abs(p.x) < EDGE) { p.y = p.r; coalLand(p, MAIN); return; }   /* swung into the floor */
    if (p.markAge !== undefined && sgn(p.w) !== p.dir) { coalLetGo(p); return; }   /* left alone it lets go at the far end of the swing and drops there */
    if (p.arcT > COAL.arc) coalLetGo(p);
    return;
  }
  if (p.st === 'fly') {
    p.vy -= 0.1; const py = p.y - p.r; p.x += p.vx; p.y += p.vy; coalSpeedHit(p);
    if (p.vy <= 0) for (const q of PLATS) if (py >= q.y && p.y - p.r <= q.y && p.x >= q.x0 && p.x <= q.x1) { p.y = q.y + p.r; coalLand(p, q); return; }
    if (p.y < -1 && Math.abs(p.x) - p.r < stageHalf(p.y)) { p.life = 0; return; }   /* into the side of the island */
    if (p.y < BLAST.b || Math.abs(p.x) > BLAST.r) p.life = 0;
    return;
  }
  p.vx = p.vy = 0;
  if (p.st === 'hang') {   /* stopped in the air off the stage while the ant is called and walks: it falls again if the call is stopped or the rope is cut */
    if (!chompAnt(ow) && !(ow.state === 'attack' && ow.mname === 'nspec' && ow.ccAct === 'ant' && ow.mf <= 10)) { p.st = 'fly'; p.cool = Math.max(p.cool || 0, 5); }
    return;
  }
  /* on the ground: Chomp picks it up by walking over it, unless his ant is carrying it */
  if (!chompAnt(ow) && p.age - p.landAge > 20 && Math.abs(ow.x - p.x) < 5 && Math.abs(ow.y - (p.y - p.r)) < 3) { p.picked = true; p.life = 0; spark(p.x, p.y, '#ffb13b', 6, 0.8); beep(700, 0.05, 'triangle', 0.04); }
}
function coalLetGo(p) { p.st = 'fly'; p.ax = p.ay = undefined; beep(300, 0.05, 'triangle', 0.03, 0.7); }
function coalLand(p, q) { p.st = 'ground'; p.plat = null; p.onPlat = q; p.vx = p.vy = 0; p.landAge = p.age; p.life = COAL.ground; p.h = { d: COAL.burn, a: 75, b: 30, k: 20, id: p.h.id }; p.cool = 0; p.rehit = 45; spark(p.x, p.y, '#ffb13b', 8, 0.9); beep(180, 0.06, 'triangle', 0.04, 0.8); }
/* a relay press: in the window it moves the coal onto a new rope further on; anywhere else it lets go */
function coalRelay(f, p) {
  if (p.relay >= COAL.relays) { coalLetGo(p); return 'release'; }
  let off = null;
  if (p.markAge !== undefined && p.age - p.markAge <= COAL.win) off = p.age - p.markAge;   /* late side */
  else if (p.markAge === undefined) {   /* early side: would it pass the mark within the window? */
    let th = p.th, w = p.w; for (let k = 1; k <= COAL.win; k++) { w += -(COAL.g / p.L) * Math.sin(th); th += w; if (sgn(w) === p.dir && th * p.dir >= COAL.mark) { off = k; break; } }
  }
  if (off === null) { coalLetGo(p); return 'release'; }
  const sp = Math.hypot(p.vx, p.vy) * (off <= 1 ? COAL.boost : COAL.keep), v = Math.min(COAL.vmax, sp);
  /* the new rope: hooked ahead at the same height as the last, so the coal starts behind it and swings on through the same
     low point and out again: each relay carries it about one rope width further */
  const th = -p.dir * Math.acos(clamp((p.ay - p.y) / p.L, -1, 1)); p.ax = p.x - p.L * Math.sin(th); p.th = th; p.w = p.dir * v / p.L;
  p.relay++; p.arcT = 0; p.markAge = undefined; p.perfect = off <= 1; p.offs = (p.offs || []).concat(off);
  spark(p.x, p.y, off <= 1 ? '#fff6c8' : '#ffd27a', off <= 1 ? 12 : 7, 1.1); beep(off <= 1 ? 880 : 660, 0.06, 'square', 0.04, 1.3);
  return off <= 1 ? 'perfect' : 'relay';
}
/* The ant: it starts at the coal and walks along the rope toward Chomp's mouth, wherever he is now. Its progress is the
   distance it has walked from the coal; when Chomp moves, the rope swings round the coal and the ant stays that far along. */
function antStep(p) {
  const ow = F[p.owner], c = p.coal, v = F[1 - p.owner];
  if (!ow || ow.state === 'dead' || !c || c.life <= 0 || !PROJ.includes(c)) { p.life = 0; return; }
  const [mx, my] = chompMouth(ow), x0 = c.x, y0 = c.y, L = Math.hypot(mx - x0, my - y0) || 1e-6;
  p.rope = [x0, y0, mx, my];
  /* a rope through solid stage is cut (not the rope to a coal stopped off the stage: that one always reaches) */
  if (c.st !== 'hang') for (const t of [0.25, 0.5, 0.75]) { const x = x0 + (mx - x0) * t, y = y0 + (my - y0) * t; if (y < -1 && Math.abs(x) < stageHalf(y)) { antCut(p, x, y); return; } }
  p.s = Math.min(p.s + COAL.antV, L); const x = x0 + (mx - x0) * p.s / L, y = y0 + (my - y0) * p.s / L;
  p.vx = x - p.x; p.vy = y - p.y; p.x = x; p.y = y; p.face = sgn(mx - x0) || 1;
  if (L - p.s < 2.5) {   /* home: the coal comes back to Chomp */
    p.life = 0; c.life = 0; c.picked = true; p.home = true; spark(mx, my, '#ffb13b', 10, 1); beep(520, 0.05, 'triangle', 0.04); beep(780, 0.05, 'triangle', 0.04);
    return;
  }
  if (!v || v.state === 'dead') return;
  /* the opponent's damaging attacks cut the rope: a grab, or a push that does no damage, leaves it */
  if (v.state === 'attack' && v.move) for (const h of v.move.h) {
    if (h.grab || !(h.d > 0) || v.mf < h.f0 || v.mf > h.f1 || (h.when && !h.when(v))) continue;
    const [d, t] = segDist(v.x + h.x * v.face, hitY(v, h), x0, y0, mx, my); if (d < h.r && t > 0.02 && t < 0.98) { antCut(p, x0 + (mx - x0) * t, y0 + (my - y0) * t); return; }
  }
  ropeBlock(p, v, x0, y0, mx, my);
}
/* The rope is in the way. The opponent's middle cannot pass through it by his own movement: walking, running, rolling,
   jumping or falling into it stops him at the rope (in the air he slides along it). It is never a hit: no damage, no
   hitstun, no freeze, no launch. A rope that swings across him as Chomp moves passes over him, and one lying along the
   floor is stepped over. A launched opponent is stopped by it too. Someone held or on the ledge goes through. Only a damaging attack cuts it. */
const ROPE_PASS = { dead: 1, held: 1, carry: 1, ledge: 1, buried: 1, down: 1 };
function ropeBlock(p, v, x0, y0, x1, y1) {
  const bx = v.x, by = v.y + v.st.h / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L, ny = dx / L;
  const dist = (x, y) => (x - x0) * nx + (y - y0) * ny, [, t] = segDist(bx, by, x0, y0, x1, y1), was = p.vp; p.vp = [bx, by];
  if (ROPE_PASS[v.state] || t <= 0.03 || t >= 0.97) return;
  const cur = dist(bx, by), prev = was ? dist(was[0], was[1]) : cur, crossed = prev * cur < 0, side = sgn(crossed ? prev : cur) || 1;
  const m = v.st.w / 2 * Math.abs(nx) + 0.5, push = m - cur * side;   /* how far inside the rope he is, from the side he came from */
  if (push <= 0 || push > 9) return;
  if (v.grounded) {   /* on the floor he is only moved along it */
    if (Math.abs(nx) < 0.3) return;
    v.x += push / (nx * side); if (v.vx * nx * side < 0) v.vx = 0;
  } else {
    v.x += nx * side * push; v.y += ny * side * push; const vn = (v.vx * nx + v.vy * ny) * side; if (vn < 0) { v.vx -= vn * side * nx; v.vy -= vn * side * ny; }
  }
  p.vp = [v.x, v.y + v.st.h / 2]; p.blocks = (p.blocks || 0) + 1;   /* frames it has held him back */
}
function antCut(p, x, y) { p.life = 0; p.cut = true; const ow = F[p.owner]; if (ow) ow.ropeCuts = (ow.ropeCuts || 0) + 1; spark(x, y, '#d8c49a', 10, 1); beep(240, 0.06, 'square', 0.04, 0.6); }
/* the ant's rope and the coal's swing rope, for the renderers and the hitbox view: picture only */
function chompRopes() { const out = []; for (const p of PROJ) { if (p.tag === 'coal' && p.st === 'swing' && p.ax !== undefined) out.push([p.ax, p.ay, p.x, p.y, 'swing']); if (p.tag === 'ant' && p.rope) out.push([...p.rope, 'ant']); } return out; }
function chompNspec(f, n, i) {
  if (n === 1) {
    const c = chompCoal(f), a = chompAnt(f);
    const off = c && c.st === 'fly' && (Math.abs(c.x) > EDGE || c.y < 0);   /* flying off the stage: past the edge, or below the floor */
    f.ccAct = !c ? (frame < (f.coalReady || 0) ? 'none' : 'throw') : c.st === 'swing' ? 'relay' : (c.st === 'ground' || off) && !a ? 'ant' : 'none';
    if (f.ccAct === 'ant' && off) { c.st = 'hang'; c.vx = c.vy = 0; c.h.d = 5; spark(c.x, c.y, '#ffd27a', 8, 0.9); beep(620, 0.05, 'triangle', 0.04); }   /* the coal stops where it is */
    if (f.ccAct === 'relay') { f.ccRelay = coalRelay(f, c); f.mf = f.move.t - 8; }   /* a quick flick of the head */
    else if (f.ccAct === 'none') f.mf = f.move.t - 6;
    if (!f.grounded) hang(f);
    return;
  }
  if (f.ccAct === 'throw' && n === 13) {   /* out of his mouth, onto a rope from a little hook above and ahead */
    const dir = f.face, up = clamp(i.ly, -1, 1), ax = f.x + dir * 14, ay = f.y + 26 + up * 5, x = f.x + dir * 4, y = f.y + 6, L = Math.hypot(x - ax, y - ay), th = Math.atan2(x - ax, ay - y);
    PROJ.push({ x, y, vx: 0, vy: 0, grav: 0, life: 9999, owner: f.idx, face: dir, dir, r: 2.4, ground: 'pass', plat: null, kind: 'coal', tag: 'coal', st: 'swing',
      ax, ay, L, th, w: dir * (0.06 + 0.012 * up), arcT: 0, relay: 0, hits: 99, rehit: 9999, cool: 5, h: { d: 5, a: 50, b: 30, k: 55, id: 'Chomp Chomp:nspec' }, step: coalStep, onGone: coalGone });
    beep(420, 0.07, 'triangle', 0.04, 1.2);
  }
  if (f.ccAct === 'ant' && n === 10) {
    const c = chompCoal(f);
    if (c && (c.st === 'ground' || c.st === 'hang') && !chompAnt(f)) PROJ.push({ x: c.x, y: c.y, vx: 0, vy: 0, grav: 0, life: 9999, owner: f.idx, face: f.face, r: 2.2, ground: 'pass', plat: null, kind: 'ant', tag: 'ant',
      coal: c, s: 0, hits: 99, rehit: 9999, h: { d: COAL.antD, a: 55, b: 40, k: 50, id: 'Chomp Chomp:ant' }, step: antStep });
    f.mf = Math.max(f.mf, f.move.t - 8);
  }
}
function coalGone(p) { if (!p.picked) { const ow = F[p.owner]; if (ow) ow.coalReady = frame + COAL.cd; } }
/* Side B, Rope Swing: a rope to a hook above and ahead on frame 11 (once per time in the air), then a pendulum swing. Push
   the stick to pump it. From the ground the rope pulls in a little as it takes his weight, so the swing clears the floor.
   While swinging: special again throws a new rope to a hook further on and he swings on from that one, keeping his speed
   (up to ROPE.max ropes in one go); attack lets go along the swing with the mouth open: 9% clean, 6% after. A rope left
   alone for 80 frames ends in the bite too. Landing ends the swing. The rope never hits. */
const ROPE = { max: 4, gap: 8 };   /* ropes in one go; frames on a rope before the next rope or the bite */
function chompSwing(f, n, i) {
  const s = f.st, by = () => f.y + s.h / 2;
  if (n === 1) { f.rsGo = false; f.rsN = 0; if (!f.grounded) { if (f.airUse.rope) { f.mf = f.move.t; return; } f.airUse.rope = 1; } }
  if (!f.rsGo && n < 11) { hang(f); return; }
  if (n === 11 && !f.rsGo) {
    f.rsAx = f.x + f.face * 12; f.rsAy = by() + 22; const dx = f.x - f.rsAx, dy = by() - f.rsAy;
    f.rsL = Math.hypot(dx, dy); f.rsTh = Math.atan2(dx, -dy); f.rsW = f.face * 0.05 + (f.vx * Math.cos(f.rsTh)) / f.rsL; f.rsGo = true; f.rsN = 1; f.rsT = 0;
    f.rsReel = f.grounded ? f.rsL - 19 : 0; f.airUse.rope = 1; f.grounded = false; f.plat = null;
    beep(500, 0.05, 'triangle', 0.04, 1.4);
  }
  if (!f.rsGo) return;
  f.rsT++;
  if (f.rsReel > 0) { const k = Math.min(1.5, f.rsReel); f.rsL -= k; f.rsReel -= k; }
  const c = f.ctl, again = c && c.pressed('spc') && f.rsT > ROPE.gap, bite = c && c.pressed('atk') && f.rsT > ROPE.gap;
  if (again && !bite && f.rsN < ROPE.max) {   /* the next rope: hooked ahead at the same height as the last, so he starts behind it and swings on through */
    const sp = Math.max(Math.abs(f.rsW) * f.rsL, 1.3), th = -f.face * Math.acos(clamp((f.rsAy - by()) / f.rsL, -1, 1));
    f.rsAx = f.x - f.rsL * Math.sin(th); f.rsTh = th; f.rsW = f.face * sp / f.rsL; f.rsN++; f.rsT = 0; f.mf = 12;
    spark(f.rsAx, f.rsAy, '#ffd27a', 6, 0.9); beep(500 + f.rsN * 60, 0.05, 'triangle', 0.04, 1.4);
  }
  f.rsW += -(0.11 / f.rsL) * Math.sin(f.rsTh) + clamp(i.lx * f.face, -1, 1) * 0.0012 * f.face; f.rsW = clamp(f.rsW, -0.14, 0.14); f.rsTh += f.rsW;
  const x = f.rsAx + f.rsL * Math.sin(f.rsTh), y = f.rsAy - f.rsL * Math.cos(f.rsTh) - s.h / 2;
  f.vx = x - f.x; f.vy = y - f.y;
  if (bite || f.mf >= 91) { f.rsGo = false; f.startMove('swingBite'); f.vx = clamp(f.vx, -3, 3); f.vy = clamp(f.vy, -2.5, 3); }   /* let go: fly on along the swing, mouth first */
}
/* Up B, Bubble Ride: a bubble forms on frame 8 and carries him up for up to 55 frames, steering gently. Up B again pops it
   (4% round him) with a small push the way the stick points; it pops by itself at the end. Falls helpless after. */
function chompBubble(f, n, i) {
  if (n < 8) { hang(f); return; }
  if (n === 8) f.bubble = true;
  if (!f.bubble) return;
  f.vy = 0.95; f.vx = appr(f.vx, clamp(i.lx, -1, 1) * 0.75, 0.06);
  if ((n > 14 && f.ctl && f.ctl.pressed('spc')) || n >= 63) {
    f.bubble = false; const m = Math.hypot(i.lx, i.ly), dx = m > 0.3 ? i.lx / m : 0, dy = m > 0.3 ? i.ly / m : 1;
    f.vx = dx * 1.8; f.vy = dy * 1.8 + 0.4;
    PROJ.push({ x: f.x, y: f.y + f.st.h / 2, vx: 0, vy: 0, grav: 0, life: 3, owner: f.idx, face: f.face, r: 8, ground: 'pass', plat: null, kind: 'blast', h: { d: 4, a: 70, b: 40, k: 40, id: 'Chomp Chomp:uspec' } });
    spark(f.x, f.y + f.st.h / 2, '#cfe8ff', 14, 1.4); beep(900, 0.05, 'sine', 0.04, 0.6); f.mf = f.move.t;
  }
}
/* Down B, Air Cushion: squeezes a little cushion. A gust on frames 9 to 13 pushes the opponent away (3%) and nudges a
   swinging or flying coal along; it leaves the ant alone. In the air the first one each jump pushes Chomp back. 18 after. */
function chompCushion(f, n) {
  if (n === 9) { if (!f.grounded && !f.airUse.cush) { f.airUse.cush = 1; f.vx = -f.face * 1.6; f.vy = Math.max(f.vy, 0.7); } else if (f.grounded) f.vx = -f.face * 0.5; beep(260, 0.08, 'sine', 0.04, 0.5); }
  if (n >= 9 && n <= 13) { const c = chompCoal(f); if (c && (c.st === 'swing' || c.st === 'fly')) { const dx = c.x - f.x, dy = c.y - (f.y + 5), d = Math.hypot(dx, dy);
    if (d < 22 && dx * f.face > 0 && Math.abs(dy) < d * 0.7) { if (c.st === 'swing') c.w += f.face * 0.006; else { c.vx += f.face * 0.4; c.vy += 0.12; } c.gusted = (c.gusted || 0) + 1; } } }
}
const CHOMP = {
  name: 'Chomp Chomp', sub: 'the hungry critter', forms: [{
    name: 'Chomp Chomp', col: ['#2a5fd6', '#5fc23a', '#ffb13b'], alt: ['#8a3fd0', '#ffcf3a', '#ff6a3c'], reachMul: 1.0,
    /* the design's targets against an average fighter (Flint): weight 94, walk 108, dash 115, run 110, air speed average,
       gravity and fall a little low, jump squat 4, a high full hop. Squat and round. */
    st: { weight: 94, walk: 1.21, walkMul: 0.15, walkAdd: 0.1, trac: 0.11, dash: 2.2, runMul: 0.12, runAdd: 0.045, run: 1.91,
      jumpX: 0.95, jumpXMul: 0.85, jumpXMax: 1.35, airJumpX: 0.9, jumpH: 37, jumpInit: 19.6, hopH: 17, airJumpH: 35, upH: 28,
      airMul: 0.06, airAdd: 0.01, airSpeed: 1.0, airBrake: 0.01, grav: 0.088, fall: 1.52, ffall: 2.45, jsq: 4, w: 10, h: 11, jf: 3, jb: 1.6,
      jumps: 1, dashF: 12, roll: [28, 1.35, 13], spot: [22, 15] },
    aiShot: [30, 90],
    moves: mk(0.95, 1, 1, 0.8, {
      nspec: { t: 22, h: [], on: chompNspec },   /* the toss: out on frame 13, free again on 22, before the coal reaches its first relay mark */
      sspec: { t: 92, nodrift: 1, h: [], on: chompSwing },
      swingBite: { t: 26, air: 1, ll: 10, h: [{ f0: 1, f1: 4, x: 5, y: 6, r: 5.5, d: 9, a: 40, b: 40, k: 75 }, { f0: 5, f1: 9, x: 4.5, y: 6, r: 5, d: 6, a: 45, b: 30, k: 60, part: 'late' }] },
      uspec: { t: 70, helpless: 1, ledge: 1, nodrift: 1, rise: 78, h: [], on: chompBubble },   /* rise: about 52 in the bubble and 26 from the pop */
      dspec: { t: 32, h: [{ f0: 9, f1: 13, x: 10, y: 5, r: 7.5, d: 3, a: 20, b: 48, k: 12, away: 1 }], on: chompCushion },
    }, { jabs: 3, grab: { t: 32, h: { f0: 9, f1: 10, x: 10.5, r: 4.4 } } }),
  }],
};

/* ---------- Brand (original; frames, damage, launch, shapes and movement from the owner's document for fighter 03) ----------
   The captain of the forge town's night watch: a quilted coat, a kettle hat, a round shield made from a cast-iron stove
   door and a broad sword whose edge glows like iron fresh from the forge. A sword-and-shield duelist: she stands where
   the blade reaches and the other fighter's swing falls short. The blade hits the same along its whole length. Shield
   Bash guards one light strike from the front before it hits; Reverse Cut and Vorpal Cleave take the stock. Average
   bursts of speed and a narrow, mostly vertical recovery; an empty bash is easy to punish.
   Full rework to the document (owner's request, 2026-11-11): its move names (two that name another game's world are Ember
   Cut and Ember Rise here), its launch numbers with no balance setting, the back throw's release point, the back-down
   floor attack and the pummel's own clock. The blade's arc and a red point at its tip show on every active frame (render3d).
   Shapes are the document's, in units of Flint's height H = 14, from her feet: circ is a circle, cap a capsule from its
   inner end to its tip (drawn and tested as a run of overlapping circles). Frame 1 is the frame the input is taken. */
const BRAND = (() => {
  const U = 14, q = v => Math.round(v * U * 100) / 100;
  const cap = (f0, f1, x1, y1, x2, y2, r, d, a, b, k, o) => Object.assign({ f0, f1, x: q(x2), y: q(y2), r: q(r), in: [q(x1), q(y1)], n: Math.max(3, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / r) + 1), d, a, b, k }, o);
  const circ = (f0, f1, x, y, r, d, a, b, k, o) => Object.assign({ f0, f1, x: q(x), y: q(y), r: q(r), in: [q(x), q(y)], n: 1, d, a, b, k }, o);
  const grab = (f0, f1, x1, y1, x2, y2, r) => ({ f0, f1, x: q(x2), y: q(y2), r: q(r), in: [q(x1), q(y1)], n: 4, grab: 1, d: 0 });
  const rise = () => (f, n) => { if (n === 1) f.invuln = Math.max(f.invuln, f.pct >= 100 ? 12 : 18); };   /* the shared protection of a get-up */
  const UP = 2.05 * U, UPV = UP / 11;   /* Ember Rise: 2.05 H over frames 5 to 25, fastest at the start */
  return {
    name: 'Brand', sub: 'the night-watch captain', forms: [{
      name: 'Brand', col: ['#4a5d7e', '#c9a24a', '#ff8a3c'], alt: ['#6e4a4a', '#b9b4ac', '#7fe0ff'],
      /* against Flint's 100: weight 108, walk 106, run 95, dash 102, air drift 96, ground push 102, air push 94, gravity and
         fast fall 102, short hop 100, full hop 98, air jump 97. Standing 1.03 x 0.56 H, crouching 0.72 x 0.62 H. */
      st: { weight: 99, walk: 1.19, walkMul: 0.143, walkAdd: 0.102, trac: 0.105, dash: 1.96, runMul: 0.112, runAdd: 0.045, run: 1.65,
        jumpX: 0.95, jumpXMul: 0.8, jumpXMax: 1.3, airJumpX: 0.9, jumpH: 33.3, jumpInit: 18.3, hopH: 16.5, airJumpH: 33.5, upH: UP,
        airMul: 0.061, airAdd: 0.0094, airSpeed: 1.056, airBrake: 0.01, grav: 0.0918, fall: 1.58, ffall: 2.53, jsq: 3, w: 7.84, h: 14.42, jf: 3, jb: 1.4,
        crouch: [0.72 / 1.03, 0.62 / 0.56], pummel: 1.3, pumAt: 4, pumT: 12, pumLock: 1, jumps: 1, dashF: 12, roll: [28, 1.35, 13], spot: [22, 15] },
      aiBash: 1,
      moves: mk(1, 1, 1, 1, {
        /* ---- ground: Hilt Tap, Short Cut, Cross Cut; Shield Drive; Ember Cut, Crown Guard, Greave Cut; Vorpal Cleave, Gate Raise, Rampart Sweep ---- */
        jab: { t: 16, next: 'jab2', chain: 7, chainEnd: 13, h: [circ(4, 5, 0.33, 0.53, 0.17, 2.5, 60, 15, 25, { nb: 1 })] },   /* nb: not the blade (no arc is drawn): the hilt, the door, a shoulder */
        jab2: { t: 19, next: 'jab3', chain: 8, chainEnd: 15, h: [cap(5, 6, 0.29, 0.52, 0.59, 0.58, 0.14, 2.5, 66, 17, 27)] },
        jab3: { t: 26, h: [cap(7, 9, 0.29, 0.55, 0.72, 0.63, 0.15, 4.5, 42, 34, 59)] },
        dash: { t: 33, h: [circ(9, 12, 0.48, 0.53, 0.27, 10, 54, 34, 67, { nb: 1 })], on(f, n) { if (n <= 10) f.vx = f.face * 0.39 * U / 10; } },   /* a shoulder behind the stove door: 0.39 H by frame 10 */
        ftilt: { t: 24, tilt: 1, h: [cap(7, 9, 0.31, 0.53, 0.90, 0.59, 0.14, 9, 36, 34, 67)] },
        utilt: { t: 25, tilt: 1, h: [cap(7, 8, 0.45, 0.69, 0.28, 1.07, 0.16, 8, 83, 27, 61), cap(9, 10, 0.26, 1.14, -0.44, 0.87, 0.16, 8, 96, 27, 61)] },   /* up in front, then over the hat brim and behind: one hit between them */
        dtilt: { t: 23, tilt: 1, h: [cap(6, 8, 0.29, 0.24, 0.83, 0.19, 0.13, 7, 69, 24, 51)] },
        fsmash: { t: 47, chg: 8, h: [cap(16, 19, 0.34, 0.55, 1.04, 0.64, 0.19, 17, 38, 40, 104)] },
        /* the shield's rim scoops the target up a set 0.14 H, then the blade cleaves upward */
        usmash: { t: 46, chg: 6, h: [circ(13, 14, 0.38, 0.42, 0.22, 3, 83, 0, 0, { g: 1, nb: 1, link: [0.03 * U, 0.14 * U, 5] }), cap(15, 17, 0.31, 0.68, 0.06, 1.20, 0.22, 12, 87, 37, 97)] },
        dsmash: { t: 42, chg: 5, h: [cap(12, 13, 0.35, 0.20, 0.84, 0.19, 0.16, 13, 30, 40, 86), cap(17, 18, -0.31, 0.20, -0.78, 0.20, 0.16, 12, 149, 38, 84)] },
        /* ---- air: Guard Wheel, High Guard, Reverse Cut, Crown Arc, Blade Drop. Landing lag, and the frames that land without it (ac0 and earlier, after ac) ---- */
        nair: { t: 36, air: 1, ll: 10, ac0: 4, ac: 31, h: [cap(6, 7, -0.15, 0.47, 0.41, 0.51, 0.20, 4, 70, 0, 0, { g: 1, nb: 1, link: [0.04 * U, 0.08 * U, 9] }), cap(13, 15, -0.49, 0.51, 0.66, 0.57, 0.18, 7, 48, 31, 64)] },
        fair: { t: 30, air: 1, ll: 9, ac0: 4, ac: 25, h: [cap(7, 10, 0.31, 0.57, 0.91, 0.62, 0.16, 9, 43, 32, 70)] },
        bair: { t: 34, air: 1, ll: 12, ac0: 5, ac: 30, h: [cap(8, 10, -0.32, 0.58, -0.93, 0.63, 0.17, 13, 144, 39, 95)] },
        uair: { t: 27, air: 1, ll: 8, ac0: 4, ac: 24, h: [cap(6, 9, 0.36, 0.88, -0.31, 1.14, 0.18, 8, 86, 25, 62)] },
        /* the point sends someone in the air straight down; anyone standing, or caught by the blade above the point, is popped up */
        dair: { t: 41, air: 1, ll: 15, ac0: 5, ac: 37, h: [circ(13, 15, 0.13, -0.23, 0.19, 13, 275, 30, 94, { vAir: 1 }), cap(13, 15, 0.10, 0.32, 0.12, -0.03, 0.17, 9, 59, 35, 65), circ(13, 15, 0.13, -0.23, 0.19, 9, 59, 35, 65, { vGnd: 1 }), circ(16, 16, 0.10, 0.04, 0.17, 7, 55, 30, 58)] },
        /* ---- grabs (Gauntlet Grab, Lunge Grab, Turn Grab) and get-ups (Guard Sweep, Rising Cut) ---- */
        grab: { t: 30, h: [grab(7, 8, 0.21, 0.54, 0.57, 0.56, 0.13)] },
        dgrab: { t: 38, h: [grab(10, 11, 0.23, 0.52, 0.60, 0.54, 0.13)], on(f, n) { if (n <= 11) f.vx = f.face * 0.33 * U / 11; } },
        pgrab: { t: 36, h: [grab(11, 12, 0.23, 0.54, 0.67, 0.55, 0.13)] },
        getup: { t: 47, h: [cap(19, 20, 0.27, 0.24, 0.65, 0.23, 0.17, 7, 43, 45, 56), cap(24, 25, -0.28, 0.23, -0.61, 0.23, 0.17, 7, 137, 45, 56)], on: rise() },
        /* lying on her back: the same two cuts with front and rear swapped, behind first */
        getupB: { t: 47, h: [cap(19, 20, -0.28, 0.23, -0.61, 0.23, 0.17, 7, 137, 45, 56), cap(24, 25, 0.27, 0.24, 0.65, 0.23, 0.17, 7, 43, 45, 56)], on: rise() },
        ledgeatk: { t: 46, h: [cap(20, 22, 0.26, 0.33, 0.73, 0.38, 0.16, 8, 39, 42, 59)], on: rise() },
        /* ---- specials ---- */
        /* Vorpal Thrust: let go of special before frame 9 for the quick thrust (frames 14 to 16, 11%); keep it held through
           frame 9 and she draws the arm back for the long one (frames 24 to 26, 15%, a third further). */
        nspec: { t: 38, ll: 16, h: [cap(14, 16, 0.32, 0.56, 0.96, 0.57, 0.14, 11, 40, 36, 72)], on(f, n, i) { if (n === 9 && i.spc) { f.startMove('nspecH'); f.mf = 9; } } },
        nspecH: { t: 52, ll: 20, h: [cap(24, 26, 0.35, 0.56, 1.26, 0.59, 0.15, 15, 37, 40, 88)] },
        /* Shield Bash: the door comes up on frames 5 to 8 (on the ground) and stops one strike of 8% or less from the
           front; then a short step and a bash on frames 12 to 14. 24 frames after it, hit or miss. */
        sspec: { t: 38, ll: 17, guard: [5, 8], guardMax: 8, guardC: [q(0.32), q(0.52), q(0.26)],
          h: [circ(12, 14, 0.52, 0.53, 0.25, 10, 53, 35, 70, { gndOnly: 1, nb: 1 }), circ(12, 14, 0.44, 0.51, 0.23, 8, 48, 32, 62, { airOnly: 1, nb: 1 })],
          on(f, n) { if (n === 1) f.guarded = false; if (n >= 9 && n <= 14) f.vx = f.face * (f.grounded ? 0.32 : 0.18) * U / 6; else if (n === 15) f.vx = 0; } },
        /* Ember Rise: a rising cut on frames 7 to 9, then straight up 2.05 H by frame 25 with a little steering (0.46 H at
           most). The ledge can be taken from frame 11. Special fall after; 20 frames on landing. */
        uspec: { t: 25, helpless: 1, ledge: 1, snap: 11, nodrift: 1, ll: 20, hll: 20, rise: UP, h: [cap(7, 9, 0.19, 0.56, 0.33, 0.97, 0.17, 8, 76, 35, 62)],
          on(f, n, i) { if (n < 5) { hang(f); return; } if (n === 5) lift(f, 0); f.vy = UPV * (1 - (n - 5) / 21); f.vx = clamp(i.lx, -1, 1) * 0.46 * U / 21; } },
        /* Grave Step: on the ground she steps back 0.28 H on frames 4 to 8 (never off an edge), comes back in 0.16 H on frames
           12 to 15 and cuts low on frames 15 to 17. In the air there is no step, only the cut. */
        dspec: { t: 39, ll: 16, h: [cap(15, 17, 0.32, 0.22, 0.95, 0.25, 0.15, 11, 41, 37, 72)],
          on(f, n) { if (!f.grounded) return; let v = n >= 4 && n <= 8 ? -f.face * 0.28 * U / 5 : n >= 12 && n <= 15 ? f.face * 0.16 * U / 4 : 0; const p = f.plat; if (p && (f.x + v < p.x0 || f.x + v > p.x1)) v = 0; f.vx = v; } },
      /* throws: Shield Shove, Gauntlet Turn, Crown Lift, Kneel Break. Gauntlet Turn holds the target at the usual place in front
         until it lets go on frame 13 at 0.41 H behind her, measured from where she stood and faced on frame 1. */
      }, { jabs: 3, throws: { f: { d: 8, a: 40, b: 43, k: 68, f: 10, t: 29 },
        b: { d: 8, a: 143, b: 43, k: 68, f: 13, t: 33, at(f, v, n) { if (n <= 1 || f.twX === undefined) { f.twX = f.x; f.twFace = f.face; } v.x = n >= 13 ? f.twX - f.twFace * q(0.41) : f.x + f.face * 8; v.y = f.y; } }, u: { d: 7, a: 88, b: 44, k: 68, f: 14, t: 34 }, d: { d: 6, a: 71, b: 33, k: 51, f: 16, t: 33 } } }),
    }],
  };
})();

/* Joey (the owner's guide "Joey: from warm-up to Cronky Dong", v1.0, 2026-11-10). Two forms of one fighter:
   - Joey, an ordinary man with a gym bag's worth of moves, deliberately weak: no air jump, short reach, 0.5 to 5% hits.
     Every number here is the guide's (frames are its frames; FAF - 1 is a move's length t; H is his height, 13.5).
   - Cronky Dong, the same face on an absurd body, after two taps of the transform action. His numbers are the guide's
     reference fighter (Ultimate 13.0.1, from the public frame and hitbox tables the guide cites), in the game's own units,
     which match the reference's. Hitboxes the tables give on a bone are placed where that bone is at the active frame,
     by estimate: positions are approximate, timing, damage and launch are the tables'. No balance change is applied.
   The transformation itself (two taps, 180 ticks of growth, protection to tick 300, kept through KOs) is Fighter.tfStep. */
const JOEY = (() => {
  const U = 13.5, q = v => Math.round(v * U * 1000) / 1000;
  const cap = (f0, f1, x1, y1, x2, y2, r, d, a, b, k, o) => Object.assign({ f0, f1, x: x2, y: y2, r, in: [x1, y1], n: Math.max(3, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / r) + 1), d, a, b, k }, o);
  const circ = (f0, f1, x, y, r, d, a, b, k, o) => Object.assign({ f0, f1, x, y, r, in: [x, y], n: 1, d, a, b, k }, o);
  const grab = (f0, f1, x1, y1, x2, y2, r) => ({ f0, f1, x: x2, y: y2, r, in: [x1, y1], n: 4, grab: 1, d: 0 });
  /* the same in units of Joey's height */
  const hc = (f0, f1, x1, y1, x2, y2, r, d, a, b, k, o) => cap(f0, f1, q(x1), q(y1), q(x2), q(y2), q(r), d, a, b, k, o);
  const hg = (f0, f1, x1, y1, x2, y2, r) => grab(f0, f1, q(x1), q(y1), q(x2), q(y2), q(r));
  const rise = inv => (f, n) => { if (n === 1) f.invuln = Math.max(f.invuln, inv || (f.pct >= 100 ? 12 : 18)); };
  /* a ground move that carries him forward stops at the end of what he stands on */
  const walkOn = (f, v) => { const p = f.plat; if (p && (f.x + v < p.x0 + 0.5 || f.x + v > p.x1 - 0.5)) v = 0; f.vx = v; };
  const over = (f, v) => { v.x = f.x; v.y = f.y + f.st.h + 0.5; };   /* overhead, for the carry throws */

  const human = {
    name: 'Joey', col: ['#c8102e', '#3b3b3b', '#f1c7a6'], alt: ['#1f4fa8', '#6b6b6b', '#f1c7a6'],
    /* Guide section 06. Weight 72, walk 0.70, dash 1.15, run 1.05, air 0.50, gravity 0.10, fall 1.35, fast fall 2.16, a
       6-tick squat, jumps of 8.45 and 4.05, no air jump; landing 3 / 7; standing 0.40 H wide (torso and arms), crouch 0.60 H. */
    st: { weight: 72, walk: 0.70, walkMul: 0.04, walkAdd: 0.04, trac: 0.08, dash: 1.15, runMul: 0.04, runAdd: 0.04, run: 1.05,
      jumpX: 0.6, jumpXMul: 0.8, jumpXMax: 0.8, airJumpX: 0.9, jumpH: 8.45, jumpInit: 2, hopH: 4.05, airJumpH: 1,
      airMul: 0.025, airAdd: 0.01, airSpeed: 0.50, airBrake: 0.01, grav: 0.10, fall: 1.35, ffall: 2.16, jsq: 6, w: q(0.40), h: U, jf: 2.5, jb: 1,
      crouch: [0.60, 1], jumps: 0, dashF: 12, land: [3, 7], pummel: 0.5, pumT: 29,
      roll: [38, 0.30, 10, 5], spot: [31, 9, 4], ad: { s: 5, n: [15, 52, 18], d: [13, 65, 22] } },
    aiShot: [18, 60],
    moves: mk(1, 1, 1, 1, {
      /* ---- 07: the warm-up set ---- */
      jab: { t: 24, next: 'jab2', chain: 12, chainEnd: 18, press: 1, h: [hc(7, 8, 0.16, 0.62, 0.30, 0.62, 0.045, 0.8, 65, 12, 15)] },
      jab2: { t: 29, next: 'jab3', chain: 15, chainEnd: 22, press: 1, h: [hc(9, 10, 0.16, 0.58, 0.30, 0.60, 0.045, 1.2, 70, 15, 20)] },
      jab3: { t: 43, h: [hc(15, 17, 0.14, 0.66, 0.30, 0.66, 0.045, 2, 55, 18, 35, { g: 1 }), hc(15, 17, 0.14, 0.55, 0.30, 0.55, 0.045, 2, 55, 18, 35, { g: 1 })] },
      ftilt: { t: 36, tilt: 1, h: [hc(12, 15, 0.18, 0.62, 0.365, 0.62, 0.055, 2, 40, 15, 30)] },
      utilt: { t: 38, tilt: 1, h: [hc(13, 16, 0.05, 0.80, 0.03, 1.00, 0.06, 2, 90, 18, 25)] },
      dtilt: { t: 31, tilt: 1, h: [hc(10, 12, 0.12, 0.12, 0.315, 0.05, 0.035, 1, 25, 12, 25)] },
      dash: { t: 53, h: [hc(17, 20, 0.05, 0.70, 0.16, 0.62, 0.08, 3, 40, 20, 35)], on(f, n) { if (n >= 8 && n <= 16 && f.grounded) walkOn(f, f.face * 1.4); } },
      fsmash: { t: 73, chg: 10, chgHold: 60, chgK: 0.2, h: [hc(30, 32, 0.20, 0.62, 0.445, 0.62, 0.055, 5, 40, 20, 45)] },
      usmash: { t: 71, chg: 10, chgHold: 60, chgK: 0.2, h: [hc(28, 30, 0.05, 0.85, 0.02, 1.0, 0.06, 4, 85, 22, 40)] },
      dsmash: { t: 73, chg: 10, chgHold: 60, chgK: 0.2, h: [hc(23, 25, 0.10, 0.10, 0.30, 0.05, 0.05, 3, 30, 18, 35, { g: 1 }), hc(36, 38, -0.10, 0.12, -0.30, 0.08, 0.05, 3, 150, 18, 35, { g: 1 })] },
      /* ---- 08: aerials (landing lag; landing free up to ac0 and after ac) ---- */
      nair: { t: 39, air: 1, ll: 15, ac0: 3, ac: 33, h: [hc(11, 15, 0.10, 0.72, 0.30, 0.82, 0.045, 1.5, 60, 15, 25, { g: 1, away: 1 }), hc(11, 15, -0.10, 0.72, -0.30, 0.82, 0.045, 1.5, 60, 15, 25, { g: 1, away: 1 }),
        hc(11, 15, 0.06, 0.15, 0.24, 0.0, 0.05, 1.5, 60, 15, 25, { g: 1, away: 1 }), hc(11, 15, -0.06, 0.15, -0.24, 0.0, 0.05, 1.5, 60, 15, 25, { g: 1, away: 1 })] },
      fair: { t: 47, air: 1, ll: 20, ac0: 3, ac: 41, h: [hc(16, 18, 0.12, 0.66, 0.405, 0.66, 0.045, 2.5, 45, 18, 30)] },
      bair: { t: 42, air: 1, ll: 17, ac0: 3, ac: 36, h: [hc(13, 16, -0.10, 0.35, -0.33, 0.30, 0.05, 2, 140, 15, 30)] },
      uair: { t: 37, air: 1, ll: 15, ac0: 3, ac: 31, h: [hc(12, 14, 0.04, 0.95, 0.06, 1.16, 0.045, 1.5, 90, 16, 25)] },
      dair: { t: 54, air: 1, ll: 24, ac0: 4, ac: 48, h: [hc(20, 23, -0.07, 0.05, -0.07, -0.15, 0.05, 3, 70, 20, 30, { g: 1 }), hc(20, 23, 0.07, 0.05, 0.07, -0.15, 0.05, 3, 70, 20, 30, { g: 1 })] },
      /* ---- 09: grabs ---- */
      grab: { t: 39, h: [hg(11, 13, 0.12, 0.55, 0.235, 0.55, 0.045)] },
      dgrab: { t: 47, h: [hg(15, 17, 0.12, 0.55, 0.295, 0.55, 0.045)] },
      pgrab: { t: 45, h: [hg(16, 18, 0.12, 0.55, 0.275, 0.55, 0.045)] },
      /* ---- 11: get-ups ---- */
      getup: { t: 48, h: [hc(22, 24, 0.08, 0.15, 0.30, 0.12, 0.05, 1.5, 45, 20, 25, { g: 1 }), hc(22, 24, -0.08, 0.15, -0.30, 0.12, 0.05, 1.5, 135, 20, 25, { g: 1 })], on: rise() },
      ledgeatk: { t: 51, h: [hc(24, 26, 0.10, 0.40, 0.32, 0.40, 0.045, 2, 45, 20, 25)], on: rise() },
      /* ---- 10: specials ---- */
      /* Shaker Disaster: the bottle leaves 0.25 H ahead at chest height on frame 22, (1.0, 0.4) a tick, gravity 0.08, 40 ticks. */
      nspec: { t: 52, h: [], on(f, n) { if (n === 22) { shoot(f, { kind: 'shaker', solo: 1, ox: q(0.25), oy: q(0.6), vx: 1.0, vy: 0.4, grav: 0.08, r: q(0.05), life: 40, h: { d: 1.5, a: 45, b: 12, k: 20 } }); beep(700, 0.05, 'triangle', 0.03, 0.7); } } },
      /* Resistance Band Betrayal: the kick on 24 to 27; on the ground 1.2 a tick forward on 20 to 29, stopping at an edge. */
      sspec: { t: 58, h: [hc(24, 27, 0.05, 0.30, 0.30, 0.15, 0.05, 2.5, 40, 20, 30)], on(f, n) { if (f.grounded && n >= 20 && n <= 29) walkOn(f, f.face * 1.2); } },
      /* Spot Me!: a strap reaches for a ledge 0.65 H above and 0.35 H out from his hand on frames 10 to 16 (once in the air
         until he lands or holds a ledge); a catch pulls him to the ledge over 18 ticks. Missed: an ordinary fall on 43. */
      uspec: { t: 42, rise: 0.1, h: [], on(f, n) {
        if (n === 1) { f.tether = null; f.spotDud = !f.grounded && !!f.airUse.spot; if (!f.grounded) f.airUse.spot = 1; }
        if (n >= 10 && n <= 16 && !f.tether && !f.spotDud && !f.grounded) {
          const side = sgn(f.x) || 1, hx = f.x + f.face * q(0.15), hy = f.y + q(0.75), dx = Math.abs(side * EDGE - hx), dy = 0 - hy, o = F[1 - f.idx];
          if (f.face === -side && dx <= q(0.35) && dy >= 0 && dy <= q(0.65) && f.ledgeGrabs < 6 && f.ledgeCd === 0) f.tether = { n: 0, x0: f.x, y0: f.y, side };
        }
        if (f.tether) { const T = f.tether, k = ++T.n / 18, tx = T.side * (EDGE + f.st.w / 2 + 0.5), ty = -f.st.h + 1;
          f.x = T.x0 + (tx - T.x0) * k; f.y = T.y0 + (ty - T.y0) * k; f.vx = f.vy = 0; if (T.n >= 18) { f.tether = null; f.grabLedge(T.side); } } } },
      /* Ab Wheel Regret: the wheel hits on 18 to 32; on the ground he rolls 0.9 a tick on 12 to 32. 25 frames on landing. */
      dspec: { t: 66, ll: 25, h: [hc(18, 32, 0.22, 0.06, 0.40, 0.06, 0.06, 2, 35, 15, 25)], on(f, n) { if (f.grounded && n >= 12 && n <= 32) walkOn(f, f.face * 0.9); } },
    }, { jabs: 3, throws: {
      f: { d: 3, a: 40, b: 24, k: 30, f: 27, t: 51 },
      b: { d: 3, a: 140, b: 24, k: 30, f: 31, t: 55 },
      /* the Three-Rep Bench PR: reps of 0.5 on 20, 38 and 56, released on 65 for 1.5 */
      u: { d: 1.5, a: 85, b: 28, k: 25, f: 65, t: 87, hits: [[20, 0.5], [38, 0.5], [56, 0.5]], at(f, v, n) { const rep = [20, 38, 56].some(r => Math.abs(n - r) < 5); v.x = f.x + f.face * 0.5; v.y = f.y + q(0.30) + (rep ? q(0.12) : 0); } },
      d: { d: 2, a: 65, b: 22, k: 25, f: 39, t: 61, hits: [[30, 1]], at(f, v) { v.x = f.x + f.face * q(0.35); v.y = f.y; } } } }),
  };

  const big = {
    name: 'Cronky Dong', col: ['#c8102e', '#3b3b3b', '#e9b58f'], alt: ['#1f4fa8', '#6b6b6b', '#e9b58f'], cargo: 1,
    /* Guide section 13: weight 127, walk 1.365, dash 2.09, run 1.873, air 1.208 (0.01 + 0.05), gravity 0.085, fall 1.63,
       fast fall 2.608, a 3-tick squat, jumps 34 / 17.3 / 35.5, one air jump, dash 15, landing 2 / 5. Traction is not in the
       guide (0.08 here). Dodges: spot 3-17 / 27, roll 4-15 / 31, air dodge 4-32 / 49 (landing 10), directional 4-22 with
       67 to 110 by direction. */
    st: { weight: 127, walk: 1.365, walkMul: 0.14, walkAdd: 0.1, trac: 0.08, dash: 2.09, runMul: 0.11, runAdd: 0.044, run: 1.873,
      jumpX: 1.0, jumpXMul: 0.8, jumpXMax: 1.4, airJumpX: 0.9, jumpH: 34, jumpInit: 19, hopH: 17.3, airJumpH: 35.5,
      airMul: 0.05, airAdd: 0.01, airSpeed: 1.208, airBrake: 0.01, grav: 0.085, fall: 1.63, ffall: 2.608, jsq: 3, w: 12, h: 18, jf: 4, jb: 2,
      crouch: [0.62, 1.1], jumps: 1, dashF: 15, land: [2, 5], pummel: 1.6, pumT: 8,
      roll: [30, 1.3, 12, 4], spot: [26, 15, 3], ad: { s: 4, n: [29, 49, 10], d: [19, 83, 14], dir: [67, 74, 83, 89, 110] } },
    moves: mk(1, 1, 1, 1, {
      /* ---- 14: ground ---- */
      jab: { t: 24, next: 'jab2', chain: 8, chainEnd: 28, h: [cap(5, 6, 3, 11.5, 11, 10.5, 5, 4, 361, 25, 35)] },
      jab2: { t: 31, h: [cap(4, 6, 4, 9.5, 9, 13.5, 6, 6, 70, 40, 100)] },
      ftilt: { t: 34, tilt: 1, h: [cap(7, 9, 2, 10, 16, 9, 5.5, 8, 361, 50, 78, { dd: a => a.aim ? 9 : 8 })] },   /* 9% angled, 8% straight */
      utilt: { t: 38, tilt: 1, h: [circ(5, 11, 2, 15, 4.8, 8, 100, 40, 105, { g: 1 }), circ(5, 11, 6, 23, 4.0, 9, 100, 40, 110, { g: 1 }), circ(5, 11, 4, 19, 5.3, 10, 100, 40, 115, { g: 1 })] },
      dtilt: { t: 24, tilt: 1, h: [cap(6, 7, 5, 4, 15, 2.5, 5, 6, 361, 10, 80, { hs: 5 })] },   /* +5 hitstun (13.0.1); the trip chance is not modelled */
      dash: { t: 34, h: [circ(9, 12, 8, 8, 7, 12, 53, 85, 46), circ(13, 24, 5.2, 8, 5.5, 9, 45, 60, 60)] },
      fsmash: { t: 54, chg: 14, h: [circ(22, 23, 24, 6.4, 5.7, 22, 46, 21, 88, { g: 1 }), cap(22, 23, 10, 6.4, 18, 6.4, 3.7, 21, 361, 18, 86, { g: 1 })] },
      usmash: { t: 49, chg: 6, h: [circ(14, 15, 0, 28, 8.8, 19, 90, 40, 84, { g: 1 }), cap(14, 15, -5, 18, 5, 18, 7, 19, 90, 40, 84, { g: 1 })] },
      dsmash: { t: 55, chg: 2, h: [
        circ(11, 12, 12, 3, 4, 17, 70, 35, 88, { g: 1, away: 1 }), circ(11, 12, -12, 3, 4, 17, 70, 35, 88, { g: 1, away: 1 }), circ(11, 12, 6, 8, 4, 14, 82, 35, 88, { g: 1, away: 1 }), circ(11, 12, -6, 8, 4, 14, 82, 35, 88, { g: 1, away: 1 }),
        circ(13, 14, 19, 4.5, 6, 18, 55, 30, 88, { g: 1, away: 1 }), circ(13, 14, -12, 4.5, 6, 18, 55, 30, 88, { g: 1, away: 1 }), circ(13, 14, 6, 8, 4.5, 14, 98, 35, 88, { g: 1, away: 1 }), circ(13, 14, -6, 8, 4.5, 14, 98, 35, 88, { g: 1, away: 1 })] },
      /* ---- 15: aerials ---- */
      nair: { t: 38, air: 1, ll: 10, ac0: 9, ac: 26, h: [cap(10, 10, -12, 9, 15, 8, 5, 12, 361, 20, 100, { g: 1 }), cap(11, 13, -11, 9, 11, 9, 5, 12, 361, 20, 100, { g: 1 }), cap(14, 26, -11, 9, 11, 9, 5, 9, 361, 10, 100, { g: 1 })] },
      fair: { t: 55, air: 1, ll: 17, ac0: 0, ac: 55, h: [cap(18, 20, 5, 15, 12, 12, 5.5, 16, 361, 20, 85, { g: 1 }), circ(21, 23, 13, 4, 5.5, 15, 270, 30, 100, { g: 1 }), circ(21, 23, 6, 9, 5, 13, 361, 30, 100, { g: 1 })] },
      bair: { t: 31, air: 1, ll: 11, ac0: 6, ac: 30, h: [cap(7, 8, -4, 8, -14, 6, 6, 13, 361, 20, 97, { g: 1, away: 1 }), cap(9, 16, -4, 8, -14, 6, 5, 8, 361, 10, 100, { g: 1, away: 1 })] },
      uair: { t: 37, air: 1, ll: 15, ac0: 5, ac: 25, h: [circ(6, 10, 1, 21, 7.5, 13, 90, 32, 90)] },
      dair: { t: 54, air: 1, ll: 14, ac0: 2, ac: 49, h: [circ(14, 16, 0, -5, 7, 16, 270, 30, 90, { g: 1 }), circ(14, 16, 0, 6, 5.8, 13, 361, 20, 90, { g: 1 })] },
      /* ---- 18: grabs ---- */
      grab: { t: 38, h: [grab(8, 10, 4, 7, 13.7, 7, 5.8)] },
      dgrab: { t: 46, h: [grab(11, 13, 4, 7, 15.9, 7, 4.6)] },
      pgrab: { t: 41, h: [grab(12, 14, 4, 7, 21.5, 7, 5.8)] },
      ledgeatk: { t: 55, h: [cap(23, 25, -5.5, 5.5, 12, 5.5, 5.5, 10, 45, 90, 20)], on: rise(25) },
      /* ---- 16 and 17: specials ---- */
      /* The Entire Gym (Giant Punch): 7 ticks in, then it charges for up to 110 while he swings his arm; special lets it go,
         shield (or an air dodge) stops and keeps the charge for this stock. A full charge is kept, and the next press
         punches at once with super armour. Partial: hit 19-20 after the release, 63 to act; 10 to 27% on the ground (6 to
         24% in the air: the guide gives 6, the rest by the same slope). Full: 28% (18% near the body), 25% in the air. */
      nspec: { t: 400, ll: 4, h: [], pick: f => f.punchC >= 110 ? 'nspecF' : null, on(f, n) {
        const c = f.ctl; if (!c) return;
        if (n === 1) f.punchGo = false;
        if (n <= 7) { if (c.take('spc')) f.punchGo = true; if (n === 7 && f.punchGo) f.startMove('nspecR'); return; }
        f.punchC = Math.min(110, f.punchC + 1);
        if (c.take('spc')) { f.startMove(f.punchC >= 110 ? 'nspecF' : 'nspecR'); return; }
        if (f.punchC >= 110) { spark(f.x, f.y + 12, '#ffb15c', 16, 1.6); beep(880, 0.12, 'triangle', 0.05, 1.5); f.endMove(); return; }
        if (c.buf.shd > 0) { c.buf.shd = 0; f.move = null; if (f.grounded) f.set('shield'); else if (!f.airdodged) f.airdodge(); else f.set('air'); } } },
      nspecR: { t: 62, h: [cap(19, 20, 3, 9, 15, 9, 5.5, 10, 361, 45, 70, { dyn: a => a.grounded ? { d: Math.round((10 + 17 * a.punchUse / 110) * 10) / 10, b: 45, k: 70 } : { d: Math.round((6 + 18 * a.punchUse / 110) * 10) / 10, b: 60, k: 65 } })],
        on(f, n) { if (n === 1) { f.punchUse = f.punchC; f.punchC = 0; } } },
      nspecF: { t: 47, sarm: [9, 20], sarmAir: [15, 20], h: [cap(19, 20, 3, 9, 15, 9, 5.5, 28, 361, 35, 73, { g: 1, dyn: a => a.grounded ? {} : { d: 25, b: 40, k: 72 } }), circ(19, 20, 1, 8, 3, 18, 361, 35, 73, { g: 1, dyn: a => a.grounded ? {} : { d: 25, b: 40, k: 72 } })],
        on(f, n) { if (n === 1) { f.punchC = 0; spark(f.x, f.y + 10, '#ffb15c', 10, 1.2); } } },
      /* Cap Check (Headbutt): super armour 5-14, the hit on 20-21. A standing target is buried; one in the air takes the 70°
         part. 25 extra shield damage. He slows at the start: half speed on the ground, two-thirds across and half up in the air,
         with half gravity. */
      sspec: { t: 62, sarm: [5, 14], h: [
        cap(20, 21, 7, 5, 19, 5, 5, 10, 270, 40, 40, { bury: 1, vGnd: 1, gndOnly: 1, sd: 25, g: 1 }), cap(20, 21, 9, 13, 18, 13, 3, 10, 270, 40, 40, { bury: 1, vGnd: 1, gndOnly: 1, sd: 25, g: 1 }), circ(20, 21, 14, 11, 10, 8, 70, 15, 40, { vAir: 1, gndOnly: 1, sd: 25, g: 1 }),
        cap(20, 21, 1.4, 5, 8.8, 5, 6.5, 10, 270, 30, 40, { bury: 1, vGnd: 1, airOnly: 1, sd: 25, g: 1 }), circ(20, 21, 14, 11, 10, 8, 70, 15, 40, { vAir: 1, airOnly: 1, sd: 25, g: 1 })],
        on(f, n) { if (n === 1) { f.vx *= f.grounded ? 0.5 : 0.67; if (!f.grounded) f.vy *= 0.5; } if (!f.grounded) f.vy += f.st.grav * 0.5; } },
      /* Lat Spread Catastrophe (Spinning Kong), on the ground: super armour 5-17; hits on 19, 25-27, 32-33, 40-42, 49-50,
         55-58 and a finisher on 62; 105 to act. Steers at up to 1.1 (0.034 a tick). The light hits pull the target in. */
      uspec: { t: 104, rise: 12, sarm: [5, 17], pick: f => f.grounded ? null : 'uspecA', h: [
        cap(19, 19, -12, 10, 12, 10, 6, 5, 88, 0, 30, { fkv: 90, g: 1 }),
        ...[[25, 27], [32, 33], [40, 42], [49, 50], [55, 58]].flatMap(([a0, a1], k) => [cap(a0, a1, -2.5, 12, 25, 9.5, 4.5, 1.4, 80, 0, 55, { fkv: 90, carry: 1, g: 2 + k }), circ(a0, a1, -2.5, 13.5, 5.7, 3.5, 60, 35, 100, { g: 2 + k })]),
        cap(62, 62, -4, 11, 20, 11, 8, 4, 361, 60, 157, { g: 9 })],
        on(f, n, i) { if (n === 1) f.spinVx = f.vx; f.spinVx = appr(f.spinVx, clamp(i.lx, -1, 1) * 1.1, Math.abs(i.lx) > 0.2 ? 0.034 : n > 62 ? 0.04 : 0.015); f.vx = f.spinVx; } },
      /* in the air: a first hit on 4-6, twelve light pulling hits from 10 to 38, a finisher on 39-43; then helpless, 38 frames
         on landing; the ledge can be taken from frame 14. Rises from 0.9 a tick and drifts up to 1.7 sideways. Landing
         before the end goes to frame 63 of the ground version. (How fast the rise dies away is my estimate: 0.03 a tick.) */
      uspecA: { t: 69, helpless: 1, ledge: 1, snap: 14, hll: 38, ownPhys: 1, h: [
        cap(4, 6, -7, 12, 4, 12, 7.7, 5, 85, 50, 10, { g: 1 }),
        ...[[10, 12], [13, 14], [15, 17], [18, 19], [20, 21], [22, 24], [25, 26], [27, 29], [30, 31], [32, 33], [34, 36], [37, 38]].map(([a0, a1], k) => cap(a0, a1, -10, 10, 10, 10, 5, 1, 80, 55, 20, { carry: 1, g: 2 + k })),
        cap(39, 43, -10, 10, 10, 10, 5, 2, 361, 72, 80, { g: 20 })],
        on(f, n, i) { if (n === 1) { f.vy = 0.9; f.grounded = false; f.plat = null; } f.vx = appr(f.vx, clamp(i.lx, -1, 1) * 1.7, 0.05); f.vy -= f.st.grav * 0.07; if (f.vy > 0) f.vy = Math.max(0, f.vy - 0.03); f.vy = Math.max(f.vy, -f.st.fall); },
        onLand(f, n) { if (n < 69) { f.startMove('uspec'); f.mf = 63; return true; } } },
      /* Floor Is Leg Day (Hand Slap), on the ground: slaps on 12-13 and 23-24 that reach only standing opponents, in front
         and behind; special again before the second slap ends repeats the pair (26 ticks a loop). 47 to act. */
      dspec: { t: 46, pick: f => f.grounded ? null : 'dspecA', h: [
        circ(12, 13, 13.6, 5, 10.3, 14, 78, 85, 30, { vGnd: 1, away: 1, g: 1 }), circ(12, 13, -1.4, 5, 10.3, 14, 84, 85, 30, { vGnd: 1, away: 1, g: 1 }),
        circ(23, 24, 13.6, 5, 10.3, 14, 84, 85, 30, { vGnd: 1, away: 1, g: 2 }), circ(23, 24, -1.4, 5, 10.3, 14, 78, 85, 30, { vGnd: 1, away: 1, g: 2 })],
        on(f, n) { if (n === 1) f.slapMore = false; if (n <= 34 && f.ctl && f.ctl.take('spc')) f.slapMore = true; if (n === 35 && f.slapMore) { f.slapMore = false; f.mf = 9; f.hitG = new Set(); } } },
      /* in the air: 5% on 19-21 (a set pop), then 6% straight down on 28-30; 10 frames on landing. */
      dspecA: { t: 49, ll: 10, h: [circ(19, 21, 9, 4, 7, 5, 90, 0, 100, { fkv: 36, g: 1 }), circ(28, 30, 9, 1, 8, 6, 270, 30, 100, { g: 2 })] },
    }, { jabs: 2, throws: {
      /* forward throw starts the carry (Fighter: 'carry'); the four carry throws are cf, cb, cu and cd */
      f: { d: 12, a: 60, b: 90, k: 46, f: 15, t: 45 },
      b: { d: 11, a: 140, b: 60, k: 65, f: 15, t: 39 },
      u: { d: 9, a: 90, b: 70, k: 50, f: 14, t: 43 },
      d: { d: 7, a: 38, b: 60, k: 50, f: 19, t: 54 },
      cf: { d: 12, a: 60, b: 90, k: 46, f: 15, t: 45, at: over },
      cb: { d: 13, a: 108, b: 85, k: 52, f: 16, t: 42, at: over },
      cu: { d: 12, a: 92, b: 65, k: 53, f: 15, t: 29, at: over },
      cd: { d: 11, a: 46, b: 70, k: 45, f: 17, t: 44, at: over } } }),
  };
  delete big.moves.jab3;   /* two jabs only */
  return { name: 'Joey', sub: 'just a regular guy', transform: 1, forms: [human, big] };
})();

const ROSTER = [FLINT, WREN, SACK, SPROCKET, SCUTTLE, FOWLS, CHOMP, BRAND, JOEY];
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
/* (after the kits, which would otherwise rewrite it) */
{ const nair = SACK.forms[0].moves.nair; nair.t = 15; nair.ll = 5; nair.ac = 10;   /* Potato Sack's neutral air: 15 frames long, so two fit in one short hop (owner's request, 2026-11-10) */
  /* Multi-hit and dragging (owner's request, 2026-11-10): three light hits on frames 3, 5 and 7 catch the opponent and carry
     them along with the sack (carry: they take on his speed and are pulled to his body), then a finisher on frame 9 launches
     them away. 1.2% x 3 + 4% = 7.6%, about the 7.5% of the single hit it replaces; the finisher keeps the old 45-degree launch,
     with more base knockback so it sends about as far. */
  const body = { x: 0, y: 6, r: 7 };
  nair.h = [1, 2, 3].map(g => Object.assign({ f0: 1 + 2 * g, f1: 2 + 2 * g, g, d: 1.2, a: 80, b: 16, k: 0, carry: 1, dyn: a => a.nairDrag ? {} : { carry: 0 } }, body))
    .concat([Object.assign({ f0: 9, f1: 10, g: 50, d: 4, a: 45, b: 45, k: 84, away: 1 }, body)]);
  /* Toned down (owner's request, 2026-11-10): only the first neutral air of each trip into the air drags. Later ones in the
     same airtime still hit four times but let go, so the move can no longer carry someone through a chain of itself. */
  nair.on = (f, n) => { if (n === 1) { f.nairDrag = !f.airUse.nairDrag; f.airUse.nairDrag = 1; } if (n >= 3 && n <= 9 && f.nairDrag) sackCarry(f); }; }
/* Keeps an opponent caught by Potato Sack's neutral air moving with him: their speed eases toward his and they are pulled
   toward the middle of his body, so the hits that follow connect wherever he is drifting or falling. */
function sackCarry(f) { const o = opp(f); if (!o || o.dragBy !== f.idx || o.state !== 'hurt' || o.hitlag > 0) return; const cx = f.x + f.face * 2 - o.x, cy = f.y + f.st.h / 2 - (o.y + o.st.h / 2), dd = Math.hypot(cx, cy);
  o.vx = appr(o.vx, f.vx + clamp(cx * 0.25, -1.5, 1.5), 0.6); o.vy = appr(o.vy, f.vy + clamp(cy * 0.25, -1.5, 1.5), 0.6); }
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
    this.pct = 0; this.kos = 0; this.tfLatch = false; this.tfPend = false; this.tfStart = -1; this.noSwap = !!def.transform; this.spawn(true);
  }
  get form() { return this.def.forms[this.fi]; }
  get st() { return this.form.st; }
  spawn(first) {
    this.x = first ? (this.idx ? 28 : -28) : 0; this.y = first ? 0 : 82; this.vx = this.vy = 0;
    if (first) this.face = this.idx ? -1 : 1;
    this.grounded = !!first; this.plat = first ? MAIN : null; this.state = first ? 'idle' : 'respawn'; this.sf = 0;
    this.jumps = this.st.jumps ?? 1; this.airdodged = false; this.sideUsed = false; this.ff = false;
    this.wall = 0; this.wallT = 0; this.wallJumps = 0; this.sdi = 0; this.airT = 0; this.jr = 0; this.jrV = 0; this.rapidN = 0; this.aim = 0;
    this.pct = 0; this.shieldHp = 50; this.invuln = 0; this.hitlag = 0; this.hitstun = 0; this.ledgeCd = 0; this.dropT = 0; this.dropPlat = null;
    this.move = null; this.mf = 0; this.charge = 0; this.hitG = new Set(); this.parriedBy = null; this.victim = null; this.lag = 0; this.flash = 0;
    this.stale = []; this.staled = false; this.staleM = 1; this.shortHop = false; this.moveSH = false; this.shMacro = false; this.grabImm = 0; this.ledgeGrabs = 0;
    this.dodgeStale = 0; this.dodgeT = 0; this.ds = 0; this.tumble = false; this.techT = 0; this.techLock = 0; this.pumT = 0; this.pumHit = 0; this.downBack = false; this.wdHold = false;
    this.chargeT = 0; this.stalled = false; this.stallOk = false; this.cAir = null; this.hopT = 0; this.airUse = {}; this.flying = false; this.selOpen = false; this.sling = null; this.dairUsed = false; this.upC = 0; this.upGo = 0; this.flyV = null; this.flyB = false; this.dove = false; this.burstKind = ''; this.burstX = 0; this.burstDown = false; this.burstUsed = false; this.blastUsed = false; this.swapLock = 0; this.slingUsed = false; this.thermal = false; this.recoil = false; this.bigStone = false; this.armorLeft = 99; this.castHit = false; this.linkT = 0; this.helpLag = 0; this.guarded = false;
    this.fat = 0; this.fatGain = false; this.restT = 0; this.exPend = false; this.exStart = -1; this.paceX = null; this.paceDir = 1;   /* INTENSITY: per stock */
    this.punchC = 0; this.punchUse = 0; this.buryT = 0; this.slapMore = false; this.tether = null; this.adFaf = 0; this.spinVx = 0;   /* per stock: a stored punch charge goes with the stock */
  }
  /* Joey's transformation (his guide, sections 04 and 05). The latch and the start tick belong to the fighter for the whole
     match, never to a stock: a KO does not undo it, and a respawn before it finishes picks the growth up where it is. e is
     gameplay ticks since it began: no control while e < 180, the big form from e = 180, protection while e < 300. */
  tfStep() {
    const c = this.ctl; if (c.tfReq) { c.tfReq = false; if (!this.tfLatch) this.tfPend = true; }
    if (this.tfPend && !this.tfLatch && this.hitlag === 0 && TF_READY[this.state]) {
      this.tfLatch = true; this.tfPend = false; this.tfStart = frame; this.fat = 0; this.exPend = false; this.exStart = -1; this.restT = 0; this.freeVictim(); this.move = null; this.charge = 0; PROJ = PROJ.filter(p => p.owner !== this.idx);
      if (this.grounded) this.vx = 0; this.set('grow'); beep(330, 0.12, 'triangle', 0.05, 1.3);
    }
    if (!this.tfLatch) return; const e = frame - this.tfStart;
    if (e >= 180 && this.fi === 0) { this.fi = 1; this.punchC = 0;
      if (this.state === 'grow') { this.jumps = this.st.jumps ?? 1; this.set(this.grounded ? 'idle' : 'air'); spark(this.x, this.y + 2, '#d8c49a', 22, 1.8); beep(120, 0.25, 'sawtooth', 0.07, 0.6); shake = Math.max(shake, 6); } }
    else if (e < 180 && this.state !== 'grow' && this.state !== 'dead' && this.state !== 'respawn') { this.move = null; this.set('grow'); this.sf = e; }
    if (e === 180 + 1 || e === 300) beep(e === 300 ? 520 : 990, 0.08, 'sine', 0.04, e === 300 ? 0.8 : 1.2);   /* the protected moment starts, and ends */
  }
  tfProtected() { return this.tfLatch && frame - this.tfStart < 300; }
  /* INTENSITY: only human Joey, only until the transformation latch is set */
  fatOn() { return !!this.def.transform && this.fi === 0 && !this.tfLatch; }
  effort(u) { if (!u || !this.fatOn() || this.exStart >= 0) return; this.fat = Math.min(FAT.max, this.fat + u); this.fatGain = true; }
  exhausted() { return this.exStart >= 0; }
  /* Dodges used back to back protect for less time and leave more lag. */
  dodge() { this.ds = this.dodgeStale; this.dodgeStale = Math.min(5, this.dodgeStale + 1); this.dodgeT = 0; }
  set(s) { this.state = s; this.sf = 0; }
  startMove(n) {
    const m = this.form.moves[n]; if (this.def.transform) this.effort(FAT.move[n]); this.move = m; this.mname = n; this.mf = 0; this.charge = 0; this.chargeT = 0; this.aim = 0;
    this.stallOk = !!m.stall && !this.grounded && !this.stalled; if (this.stallOk) this.stalled = true;
    this.armorLeft = m.armorHits || 99; this.castHit = false; this.bRev = 0;   /* a move that hangs in the air does so once per time off the ground */
    this.selOpen = false;   /* a bird wheel left open by an interrupted Neutral B never outlives it */
    if (!m.rapid) this.rapidN = 0; this.hitG = new Set(); this.parriedBy = null; this.staled = false; this.moveSH = !!(m.air && this.shortHop); this.set('attack');
    if (m.once && !this.grounded) this.sideUsed = true;
  }
  endMove() {
    const m = this.move, i = this.ctl.c; this.move = null;
    if (this.grounded) { this.set('idle'); if (m.tilt && Math.abs(i.lx) > T.dash_stick_x) { this.face = sgn(i.lx); this.set('dash'); } }
    else { this.helpLag = m.helpless ? m.hll || 0 : 0; this.set(m.helpless ? 'helpless' : 'air'); }
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
    const dir = n; let turned = false, mv = this.form.moves[n]; if (mv.pick) { n = mv.pick(this) || n; mv = this.form.moves[n]; }   /* a special with a ground and an air form, or a stored charge */
    if (!this.grounded && ((mv.burst && this.burstUsed) || (mv.blast && this.blastUsed))) return;
    if (mv.swap && this.swapLock > 0) return;   /* too soon after the last swap */   /* spent until it lands */
    if (n !== 'sspec' && Math.abs(i.lx) > 0.35 && sgn(i.lx) !== this.face) { this.face = sgn(i.lx); if (n === 'nspec' && !this.grounded) { this.vx = -this.vx * 0.9; turned = true; } }
    this.startMove(n); this.bRevV = !turned;   /* the drift already turned round with the fighter: a B-reverse after it only turns them back (a wavebounce) */
    if (dir !== 'uspec' && !mv.swap && this.ctl.cFall) this.bRev = B_REV;   /* people only (cFall, as for the right-stick fast fall), so seeded CPU matches play out as before */
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
    if (this.exStart >= 0) { for (const k in c.buf) c.buf[k] = 0; this.fastFall(); return false; }   /* exhausted in the air: drift only */
    if (c.buf.shd > 0 && !this.airdodged) { c.buf.shd = 0; if (!this.tryWavedash(false)) this.airdodge(); return true; }
    if (c.take('spc')) { this.doSpecial(); return true; }
    if (c.take('atk')) { this.startMove(this.aerial(i.lx, i.ly)); return true; }
    if (c.cPress) { this.fastFall(); this.startMove(this.aerial(i.cx, i.cy)); return true; }
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
    if (c.buf.jmp > 0 && this.jumps > 0) { c.buf.jmp = 0; this.jumps--; this.shortHop = false; this.vy = s.vAir * (1 - 0.1 * Math.max(0, (s.jumps ?? 1) - 1 - this.jumps)); if (Math.abs(i.lx) > 0.2) this.vx = i.lx * s.airSpeed * s.airJumpX; this.ff = false; spark(this.x, this.y, '#fff', 6, 0.8); beep(500, 0.05, 'sine', 0.03, 1.4); }
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
    const i = this.ctl.c, mag = Math.hypot(i.lx, i.ly); this.effort(FAT.airdodge); this.airdodged = true; this.ff = false; this.dodge();
    this.adDir = mag > 0.3; if (this.adDir) { this.vx = i.lx / mag * 2.7; this.vy = i.ly / mag * 2.7; }
    const dd = this.st.ad && this.st.ad.dir; if (this.adDir && dd) { const a = Math.atan2(i.ly, Math.abs(i.lx)) * 180 / Math.PI; this.adFaf = dd[a < -67.5 ? 0 : a < -22.5 ? 1 : a < 22.5 ? 2 : a < 67.5 ? 3 : 4]; }   /* down, down-sideways, sideways, up-sideways, up */
    this.set('airdodge');
  }
  /* Hoppers: which part of the hop this frame is. Returns the speed multiplier while moving, 0 while planted. */
  hopGate(c) { const ph = this.hopT++ % (c[0] + c[1]); return ph < c[0] ? c[2] : 0; }
  /* A downward flick of either stick while falling: drop at full fast-fall speed at once, with a glint. On the right stick the
     left one stays free to steer; flicked down out of nothing it gives a fast-falling down air. */
  fastFall() { const c = this.ctl; if ((c.downNow || c.cDown) && this.vy <= 0 && !this.ff) { this.ff = true; this.vy = -this.st.ffall; ffSpark(this.x, this.y + this.st.h * 0.5); } }
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
  touchDown(p, fromLedge) { if (!fromLedge) this.ledgeGrabs = 0; this.airUse = {}; this.flying = false; this.grounded = true; this.plat = p; this.y = p.y; this.vy = 0; this.jr = 0; this.stalled = false; this.burstUsed = false; this.blastUsed = false; this.slingUsed = false; this.dairUsed = false; this.wallJumps = 0; this.jumps = this.st.jumps ?? 1; this.airdodged = false; this.sideUsed = false; this.ff = false; this.shortHop = false; }
  land(p) {
    const st = this.state, hard = this.ff; this.touchDown(p);
    if (st === 'attack' && this.move.burst) {   /* a tumble never falls over: a dive that reaches the floor carries on as a slide, anything else lands ready to act */
      if (this.burstKind === 'dive') { this.burstKind = 'slide'; spark(this.x, this.y, '#ddd', 8, 1.2); } else { this.move = null; this.set('idle'); }
    }
    else if (st === 'attack') { const m = this.move; if (m.onLand && m.onLand(this, this.mf) === true) return;   /* the move carries on in a landing form of its own */ this.lag = m.air ? ((m.ac0 !== undefined ? this.mf <= m.ac0 : this.mf < (m.h[0] ? m.h[0].f0 : 99) - 1) || this.mf > m.ac ? (hard ? LANDL(this)[1] : LANDL(this)[0]) : m.ll) : (m.ll || 8); if (m.llf) this.lag = m.llf(this); this.move = null; this.set('land'); }
    else if (st === 'airdodge') { if (Math.abs(this.vx) > 0.5) { this.vx = clamp(this.vx, -T.wd_max_speed, T.wd_max_speed); this.set('wd'); } else { this.lag = this.st.ad ? this.st.ad[this.adDir ? 'd' : 'n'][2] : 10; this.set('land'); } }
    else if (st === 'grow' || st === 'carry' || st === 'buried') { /* growing, carrying or buried: carries on where it lands */ }
    else if (st === 'hurt') {
      /* Launched hard enough to tumble: shield just before touching down to tech (in place or rolling), else lie there. */
      if (this.tumble && this.sf < this.hitstun) {
        const lx = this.ctl.c.lx;
        if (this.techT > 0) {
          this.techT = 0; this.invuln = 20; spark(this.x, this.y, '#9ff', 10, 1.2); beep(900, 0.05, 'triangle', 0.04);
          if (Math.abs(lx) > 0.5) { this.rollDir = sgn(lx); this.ds = 0; this.set('roll'); } else { this.vx = 0; this.lag = 26; this.set('land'); }
        } else { this.downBack = this.vx * this.face < 0; this.vx *= 0.5; spark(this.x, this.y, '#ddd', 8, 1.2); beep(130, 0.08, 'square', 0.05); this.set('down'); }   /* downBack: carried backward, so lying on the back */
      } else { this.lag = 4; this.set('land'); }
    }
    else if (st === 'helpless') { this.lag = this.helpLag || 12; this.helpLag = 0; this.set('land'); }
    else if (st === 'broken') { /* stays dizzy */ }
    else { this.lag = hard ? LANDL(this)[1] : LANDL(this)[0]; this.set('land'); }
  }
  canFall() {
    const s = this.state;
    if (s === 'shield' || s === 'shieldstun' || s === 'shieldoff' || s === 'hold' || s === 'throw' || s === 'roll' || s === 'spot' || s === 'broken' || s === 'jsq' || s === 'down' || s === 'rebound') return false;
    if (this.plat.soft) return true;
    if (s === 'attack' && this.move && this.move.burst) return true;   /* a tumble carries off the edge */
    return s === 'idle' ? Math.abs(this.ctl.c.lx) > 0.2 : (s === 'dash' || s === 'run' || s === 'brake' || s === 'hurt' || s === 'wd');
  }
  breakShield() { this.shieldHp = SHIELD.hp * 0.75;   /* Ultimate: a broken shield comes back at 75% */ this.grounded = false; this.plat = null; this.vy = 3.2; this.vx = 0; this.set('broken'); spark(this.x, this.y + 8, '#9cf', 30, 2.4); beep(200, 0.4, 'sawtooth', 0.08, 0.3); shake = 10; }
  launch(kb, ang, dir, lsi) {
    this.freeVictim(); this.selOpen = false; const sp = kb * 0.03 * (lsi || 1); this.sdi = 0; this.tumble = kb >= TUMBLE_KB; this.ledgeGrabs = 0; this.shortHop = false; this.vx = Math.cos(ang) * sp * dir; this.vy = Math.sin(ang) * sp;
    this.hitstun = Math.max(4, Math.floor(kb * HITSTUN * COMBO_EASE) - 1); this.move = null; this.ff = false; this.linkT = 0;   /* Ultimate: 0.4 x knockback, one frame less, at least 4; then Emberfall's combo ease */
    if (this.grounded) { if (this.vy < 0) this.vy = -this.vy * 0.8; if (kb < 30 || this.vy < 0.05) this.vy = 0; else { this.grounded = false; this.plat = null; } }
    this.set('hurt');
  }
  ko() {
    const top = this.y > BLAST.t - 5;
    spark(clamp(this.x, BLAST.l + 20, BLAST.r - 20), clamp(this.y, BLAST.b + 20, BLAST.t - 20), this.idx ? '#6cb4ff' : '#ff7b6c', 60, top ? 4 : 5);
    beep(90, 0.6, 'sawtooth', 0.1, 0.3); shake = 16; rumble(this.ctl, 400, 1); this.stale = [];
    const o = F[1 - this.idx]; if (o.victim === this) o.victim = null; this.freeVictim();
    if (this.def.fowl) { this.sling = null; if (this.fi >= 5) this.fi -= 5; }   /* a lost stock puts the bird back in the pouch */
    this.stocks--; if (TRAINING) this.stocks = STOCKS; F[1 - this.idx].kos++;   /* training: stocks never run out */ this.move = null; this.vx = this.vy = 0; this.grounded = false; this.plat = null; this.set('dead'); PROJ = PROJ.filter(p => p.owner !== this.idx);
  }
  update() {
    const c = this.ctl, i = c.c;
    if (this.def.transform) this.tfStep();
    if (this.exStart >= 0 && frame - this.exStart >= FAT.exhaust) { this.exStart = -1; this.fat = 0; this.exPend = false; this.restT = 0; if (this.state === 'exhaust') this.set('idle'); }   /* e = 900: free, with no extra lag */
    if (this.invuln > 0) this.invuln--; if (this.swapLock > 0) this.swapLock--; if (this.ledgeCd > 0) this.ledgeCd--; if (this.dropT > 0) this.dropT--; if (this.flash > 0) this.flash--;
    if (!i.shd) this.wdHold = false;   /* the shield press that made a wavedash does not turn into a shield while still held */
    if (this.grabImm > 0) this.grabImm--; if (this.wallT > 0) this.wallT--; if (this.techT > 0) this.techT--; if (this.techLock > 0) this.techLock--;
    if (c.pressed('shd')) { if (this.techLock === 0) this.techT = TECH_WINDOW; this.techLock = 40; }   /* Ultimate: an 11-frame window, 40 before the next try */
    if (this.grounded || this.state === 'ledge' || this.state === 'respawn') this.airT = 0; else this.airT++;   /* frames since last standing on something */
    if (this.dodgeStale > 0 && ++this.dodgeT >= 90) { this.dodgeStale--; this.dodgeT = 0; }
    if (this.state !== 'shield' && this.state !== 'shieldstun' && this.shieldHp < SHIELD.hp) this.shieldHp = Math.min(SHIELD.hp, this.shieldHp + SHIELD.regen);
    if (this.hitlag > 0) {
      /* While frozen by a hit, up to three stick flicks nudge the victim a little: a way to shift out of multi-hits and change where a launch starts. */
      if (this.state === 'hurt' && this.sdi < 3) { const dx = c.dashDir, dy = c.upNow ? 1 : c.downNow ? -1 : 0; if (dx || dy) { this.sdi++; this.x += dx * 1.1; if (!this.grounded) this.y += dy * 1.1; } }
      this.hitlag--; return;
    }
    if (this.def.transform && this.grounded && EX_READY[this.state]) {
      if (this.exStart >= 0) { this.paceX = null; this.set('exhaust'); this.sf = frame - this.exStart; }   /* back on his feet before the 15 seconds are up: the same moment of the performance */
      else if (this.exPend && this.fatOn()) { this.exPend = false; this.exStart = frame; this.paceX = null; this.paceDir = this.face; this.vx *= 0.3; this.set('exhaust'); pop(this.x, this.y + this.st.h + 6, 'TAKE FIVE', '#ffb26b'); beep(220, 0.35, 'triangle', 0.05, 0.5); }
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
        if (this.sf >= s.jsq) { this.grounded = false; this.plat = null; this.jumps = s.jumps ?? 1; this.shortHop = !i.jmp || this.shMacro || c.jmp2Age <= this.sf + T.buffer; this.effort(FAT.jump);   /* let go early, attack with the jump, or two jump buttons together */ if (this.shortHop) this.vy = s.vHop; else { this.vy = this.jrV = s.boost[0]; this.jr = 1; } this.vx = clamp(this.vx * s.jumpXMul + (Math.abs(i.lx) > 0.2 ? i.lx * s.jumpX : 0), -s.jumpXMax, s.jumpXMax); this.set('air'); beep(420, 0.05, 'sine', 0.03, 1.5); if (this.shMacro) { this.shMacro = false; if (c.take('atk')) this.startMove(this.aerial(i.lx, i.ly)); } else if (this.cAir) this.startMove(this.aerial(this.cAir[0], this.cAir[1])); this.cAir = null; }
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
        { const ad = s.ad, k = this.adDir ? 'd' : 'n';   /* ad: a form's own air dodge (first protected frame; per kind: frames protected, first free frame, landing) */
          if (this.sf === (ad ? ad.s : 3)) this.invuln = Math.max(this.invuln, (ad ? ad[k][0] : 24 - (this.adDir ? 6 : 0)) - this.ds * 2);
          if (this.sf >= (ad ? (this.adDir && ad.dir ? this.adFaf : ad[k][1]) - 1 : this.adDir ? 54 : 40) + this.ds * 3) this.set('air'); }
        break;
      case 'land':
        this.vx = appr(this.vx, 0, s.trac);
        if (this.sf >= this.lag) { this.set('idle'); this.groundActs(false); }
        break;
      case 'attack': {
        const m = this.move;
        if (this.grounded) this.vx = appr(this.vx, 0, s.trac); else if (this.stallOk) { this.vy = 0; this.vx = appr(this.vx, 0, 0.08); }   /* hangs in the air until the move is over */
        else if (!m.ownPhys) { this.airPhys(!m.nodrift); if (m.air) this.fastFall(); }   /* ownPhys: the move moves the fighter itself */
        /* A smash is charged by keeping attack held: its power grows for a second, and it can be held back for two more. */
        if (m.chg && this.mf === m.chg && this.chargeT < (m.chgHold || SMASH_HOLD) && i.atk) { this.chargeT++; if (this.charge < 60) this.charge++; } else this.mf++;
        if (m.inv && this.mf === m.inv[0]) this.invuln = Math.max(this.invuln, m.inv[1] - m.inv[0]);   /* some moves cannot be hit for a few frames */
        /* B-reverse: in a special's first few frames, pull the stick the other way to turn round; in the air the drift turns round too.
           With a turnaround special first (back held as special is pressed) it becomes a wavebounce. Once per special; not for up specials. */
        if (this.bRev > 0) { this.bRev--; if (Math.abs(i.lx) > 0.5 && Math.abs(i.lx) >= Math.abs(i.ly) && sgn(i.lx) === -this.face) { this.bRev = 0; this.face = -this.face; if (!this.grounded && this.bRevV) this.vx = -this.vx; brevPuff(this.x, this.y + this.st.h * 0.45); } }
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
        if (this.state === 'attack' && m.next && this.grounded && this.mf >= m.chain && (!m.chainEnd || this.mf <= m.chainEnd) && (c.take('atk') || (!m.press && i.atk && this.mf >= m.chain + 2))) { this.startMove(m.next); break; }   /* press: only a new press chains */
        if (this.state === 'attack' && this.mf >= m.t) this.endMove();
        break;
      }
      case 'shield':
        c.buf.shd = 0; this.vx = appr(this.vx, 0, s.trac * 1.5); this.shieldHp -= SHIELD.drain; if (this.shieldHp <= 0) { this.breakShield(); break; }
        if (c.buf.spc > 0 && i.ly > 0.5) { c.buf.spc = 0; this.startMove('uspec'); break; }   /* up special straight out of shield */
        if (c.take('jmp')) { this.set('jsq'); break; }
        if (c.take('atk') || c.take('grb')) { this.startMove('grab'); break; }
        if (c.downBuf > 0) { c.downBuf = 0; if (this.plat.soft) this.drop(); else { this.effort(FAT.spot); this.dodge(); this.set('spot'); } break; }
        if (c.dashDir && this.sf > 1) { this.rollDir = c.dashDir; this.effort(FAT.roll); this.dodge(); this.set('roll'); break; }
        if (!i.shd && this.sf >= 3) this.set('shieldoff');
        break;
      case 'shieldstun':
        this.vx = appr(this.vx, 0, 0.08);
        if (this.sf >= this.stunT) { if (this.plat.soft && i.ly < T.shield_drop_stick_y) this.drop(); else this.set(i.shd ? 'shield' : 'shieldoff'); }
        break;
      case 'shieldoff': this.vx = appr(this.vx, 0, s.trac); if (this.sf >= SHIELD.release) this.set('idle'); break;
      case 'spot': { const sp = s.spot || [22, 15]; this.vx = 0; if (this.sf === (sp[2] || 3)) this.invuln = Math.max(this.invuln, sp[1] - this.ds * 2); if (this.sf >= sp[0] + this.ds * 3) this.set('idle'); break; }
      case 'rebound': this.vx = appr(this.vx, 0, s.trac); if (this.sf >= this.lag) this.set('idle'); break;
      case 'roll': {
        const r = s.roll || [28, 1.35, 13];   /* total frames, speed, frames it cannot be hit */
        this.vx = this.sf >= 3 && this.sf <= r[0] - 6 ? this.rollDir * r[1] : 0; if (this.sf === (r[3] || 4)) this.invuln = Math.max(this.invuln, r[2] - this.ds * 2);
        if (this.sf >= r[0] + this.ds * 3) { this.face = -this.rollDir; this.vx = 0; this.set('idle'); }
        break;
      }
      case 'hurt':
        if (this.grounded) { this.vx = appr(this.vx, 0, 0.06); if (this.sf >= this.hitstun) this.set('idle'); }
        else {
          /* Long hitstun can be cut short: an air dodge from frame 40, an attack or jump from frame 45. */
          if (this.sf >= 45 && (c.buf.atk > 0 || c.cPress || c.buf.spc > 0 || (c.buf.jmp > 0 && this.jumps > 0))) { this.set('air'); this.airActs(); break; }
          if (this.sf >= 40 && c.buf.shd > 0 && !this.airdodged && this.exStart < 0) { c.buf.shd = 0; this.airdodge(); break; }
          if (this.linkT > 0) { this.linkT--; if (this.sf >= this.hitstun) this.set('air'); break; }   /* held by a linking hit: carried at a fixed speed, no gravity, until it lets go */
          const sp = Math.hypot(this.vx, this.vy); if (sp > 0.051) { const k = (sp - 0.051) / sp; this.vx *= k; this.vy *= k; }
          this.vy -= s.grav; if (this.sf % 3 === 0 && sp > 2) PART.push({ x: this.x, y: this.y + s.h / 2, vx: 0, vy: 0, life: 16, col: 'rgba(255,255,255,.7)', r: 1.6 });
          if (this.sf >= this.hitstun) this.set('air');
        }
        break;
      case 'down':   /* missed tech: lying on the floor */
        this.vx = appr(this.vx, 0, 0.1);
        if (this.sf >= 20) {
          if (this.exStart >= 0) { c.buf.atk = 0; if (i.ly > 0.5 || Math.abs(i.lx) > 0.5 || this.sf >= 100) { this.lag = 22; this.invuln = 16; this.set('land'); } break; }   /* exhausted: only gets up */
          if (c.take('atk')) { this.startMove(this.downBack && this.form.moves.getupB ? 'getupB' : 'getup'); break; }   /* getupB: a floor attack of its own when lying on the back */
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
          const pumHit = () => { v.pct += (this.st.pummel || 1.3) * DMG_1V1; v.flash = 5; spark(v.x, v.y + 8, '#fff', 4, 0.8); beep(260, 0.04, 'square', 0.04); };
          if (this.pumHit > 0 && --this.pumHit === 0) pumHit();   /* pumAt: a pummel whose hit lands a few frames after the press */
          if (this.pumT === 0 && c.take('atk')) { this.effort(FAT.pummel); this.pumT = this.st.pumT || 14; if (this.st.pumAt > 1) this.pumHit = this.st.pumAt - 1; else pumHit(); }
          if (this.st.pumLock && this.pumT > 0) break;   /* pumLock: the pummel runs on its own clock; nothing else until its free frame */
          /* Throw with either stick, held or flicked: the right stick wins if both are pushed. */
          const cs = Math.hypot(i.cx, i.cy) >= 0.5, tx = cs ? i.cx : i.lx, ty = cs ? i.cy : i.ly; let k = null;
          if (cs || Math.hypot(i.lx, i.ly) >= 0.6) k = Math.abs(ty) > Math.abs(tx) ? (ty > 0 ? 'u' : 'd') : (sgn(tx) === this.face ? 'f' : 'b');
          if (k === 'f' && this.form.cargo) { this.holdT = Math.round((90 + 1.7 * v.pct) * 11 / 6) - this.sf; this.set('carry'); }   /* the carry lasts what the grab had left, x 11/6 */
          else if (k) { this.effort(FAT.throwPick); this.throwK = k; this.set('throw'); }
          else if (this.sf > this.holdT && this.sf > GRAB_MIN) { this.freeVictim(); this.lag = 30; this.set('land'); }
        }
        break;
      }
      case 'throw': {
        const v = this.victim;
        const tw = this.form.moves.throws[this.throwK] || {};
        if (v && v.state === 'held') { if (tw.at) tw.at(this, v, this.sf); else { v.x = this.x + this.face * (this.throwK === 'b' ? -6 : 8) * Math.min(1, this.sf / 8); v.y = this.y + (this.throwK === 'u' ? this.sf : 0); } }   /* at: where a throw holds its victim */
        if (v && v.state === 'held' && tw.hits) for (const q of tw.hits) if (this.sf === q[0]) { this.effort(FAT.rep); const d = q[1] * DMG_1V1; v.pct = Math.min(999, v.pct + d); v.flash = 4; comboHit(this, v, d, true); spark(v.x, v.y + 6, '#fff', 4, 0.7); beep(300, 0.04, 'square', 0.03); }   /* damage before the release (a throw of several reps) */
        if (this.sf === (tw.f || 10) && v) {
          const h = tw, id = this.form.name + ':throw' + this.throwK, d = h.d * staleMul(this, id) * DMG_1V1; pushStale(this, id);
          this.victim = null; v.grounded = false; v.plat = null; v.pct = Math.min(999, v.pct + d); v.grabImm = 60;
          comboHit(this, v, d, true); v.launch(knock(v, d, h.b, h.k) * rage(this), h.a * Math.PI / 180, this.face); v.hitlag = 6; this.hitlag = 6; spark(v.x, v.y + 8, '#fff', 12, 1.6); thwack(90);
        }
        if (!this.grounded) this.vy = 0;   /* a catch in the air hangs there for the fling */
        if (this.sf >= (tw.t || 26)) this.set(this.grounded ? 'idle' : 'air');
        break;
      }
      case 'exhaust': {   /* TAKE FIVE: 900 ticks. Nothing but a slow shuffle (and the transformation, in tfStep); between 3 and 9 s he paces on his own */
        for (const k in c.buf) c.buf[k] = 0; c.downBuf = 0;
        const e = frame - this.exStart; let tv = 0;
        if (Math.abs(i.lx) > 0.2) { tv = clamp(i.lx, -1, 1) * 0.22; this.paceX = null; }
        else if (e >= 180 && e < 540) { if (this.paceX === null) this.paceX = this.x; if (Math.abs(this.x - this.paceX) >= 0.25 * s.h) this.paceDir = -sgn(this.x - this.paceX); tv = this.paceDir * 0.16; }
        this.vx = appr(this.vx, tv, 0.04);
        const p = this.plat; if (p && (this.x + this.vx < p.x0 + 1 || this.x + this.vx > p.x1 - 1)) { this.vx = 0; this.paceDir = -this.paceDir; }   /* never walks himself off anything */
        if (Math.abs(this.vx) > 0.02) this.face = sgn(this.vx);
        break;
      }
      case 'grow':   /* Joey's injection and growth: no control; on the ground he stays put, in the air he falls as the human form does */
        if (this.grounded) this.vx = 0; else this.airPhys(false);
        break;
      case 'carry': {   /* Cronky Dong's cargo carry: walk and jump with the opponent overhead, throw with attack or grab (or the right stick) */
        const v = this.victim; if (!v || v.state !== 'held') { this.victim = null; this.set(this.grounded ? 'idle' : 'air'); break; }
        if (this.grounded) { if (Math.abs(i.lx) > 0.2) { this.face = sgn(i.lx); this.vx = this.groundMove(i.lx * s.walk * 1.1, (s.walkAdd + s.walkMul * Math.abs(i.lx)) * 1.1); } else this.vx = appr(this.vx, 0, s.trac);
          if (c.take('jmp')) { this.grounded = false; this.plat = null; this.vy = i.jmp ? s.vJump : s.vHop; } }
        else { this.airPhys(true); if (c.take('jmp') && this.jumps > 0) { this.jumps--; this.vy = s.vAir; } this.fastFall(); }
        v.x = this.x; v.y = this.y + s.h + 0.5; v.vx = v.vy = 0; v.face = this.face;
        const cs = Math.hypot(i.cx, i.cy) >= 0.5;
        if (this.sf > 3 && (cs || c.take('atk') || c.take('grb'))) { const tx = cs ? i.cx : i.lx, ty = cs ? i.cy : i.ly; let k = 'cf';
          if (Math.abs(ty) > 0.5 && Math.abs(ty) >= Math.abs(tx)) k = ty > 0 ? 'cu' : 'cd'; else if (Math.abs(tx) > 0.3 && sgn(tx) !== this.face) k = 'cb';
          this.throwK = k; this.set('throw'); break; }
        if (this.sf > this.holdT) { this.freeVictim(); this.set(this.grounded ? 'idle' : 'air'); }
        break;
      }
      case 'buried': {   /* stuck in the floor: mashing frees sooner; a hit knocks them out */
        this.vx = 0; let n = c.dashDir || c.upNow || c.downNow ? 1 : 0; for (const k of ['atk', 'spc', 'jmp', 'shd', 'grb']) if (c.pressed(k)) n++; this.buryT -= n * 8;
        if (this.sf >= this.buryT) { this.grounded = false; this.plat = null; this.vy = 1.6; this.set('air'); spark(this.x, this.y, '#c9a27a', 10, 1.2); }
        break;
      }
      case 'ledge': {
        const side = sgn(this.x); this.vx = this.vy = 0;
        if (this.sf === 2 && this.ledgeInv) { this.invuln = Math.max(this.invuln, this.ledgeInv - 2); this.ledgeInv = 0; }   /* the protection starts on the third frame: the grab itself can be hit */
        if (this.sf > 8) {
          const toward = -side * i.lx, slow = this.pct >= 100;
          if (this.exStart >= 0) { c.buf.jmp = c.buf.atk = 0; }   /* exhausted: only the plain climb up, or letting go */   /* worn down: every way up is slower and less protected */
          if (c.take('jmp')) { this.vy = s.vJump * 1.05; this.vx = -side * 0.7; this.ledgeCd = 30; this.set('air'); }
          else if (i.shd && this.exStart < 0) { this.x = side * (EDGE - 22); this.touchDown(MAIN, true); this.lag = slow ? 26 : 18; this.invuln = slow ? 20 : 18; this.set('land'); }
          else if (c.take('atk')) { this.x = side * (EDGE - 6); this.touchDown(MAIN, true); this.startMove(this.form.moves.ledgeatk ? 'ledgeatk' : 'getup'); if (slow) this.mf = -8; }
          else if (toward > 0.5 || i.ly > 0.5) { this.x = side * (EDGE - 5); this.touchDown(MAIN, true); this.lag = slow ? 22 : 14; this.invuln = slow ? 16 : 14; this.set('land'); }
          else if (toward < -0.5 || i.ly < -0.5 || this.sf > LEDGE_HANG) { this.ledgeCd = 30; this.vy = -0.5; this.x += side * 2; this.set('air'); }
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
    if (this.fatOn()) {   /* INTENSITY: costs already charged this tick come first; running; then rest, only if nothing was gained */
      if (this.exStart < 0 && this.grounded && (this.state === 'dash' || this.state === 'run') && Math.abs(i.lx) > 0.2 && Math.abs(this.vx) > s.walk) this.effort(FAT.run);
      if (this.grounded && this.state === 'idle' && !this.exPend && this.exStart < 0 && !i.shd) { this.restT++; if (!this.fatGain && this.restT > FAT.restDelay) this.fat = Math.max(0, this.fat - (Math.abs(this.vx) > 0.25 ? FAT.drainWalk : FAT.drainIdle)); } else this.restT = 0;
      if (this.fat >= FAT.max && this.exStart < 0) { this.fat = FAT.max; this.exPend = true; }
      this.fatGain = false;
    }
    this.integrate();
  }
  grabLedge(side) {
    const s = this.st, hw = s.w / 2, o = F[1 - this.idx];
    if (o && o.state === 'ledge' && sgn(o.x) === side) { o.set('air'); o.vy = 1.3; o.vx = side * 0.9; o.ledgeCd = 45; o.invuln = 0; pop(o.x, o.y + 20, 'TRUMP', '#fff'); }
    this.ledgeGrabs++; this.shortHop = false;
    this.x = side * (EDGE + hw + 0.5); this.y = -s.h + 1; this.vx = this.vy = 0; this.face = -side; this.move = null; this.ff = false;
    this.jumps = s.jumps ?? 1; this.wallJumps = 0; this.airdodged = false; this.sideUsed = false; this.stalled = false; this.airUse = {}; this.ledgeInv = Math.round(LEDGE_INV(this.airT, this.pct) * (LEDGE_REGRAB[this.ledgeGrabs - 1] || 0));   /* Ultimate's rule: longer in the air earns more, damage takes it away, and regrabs before landing or being hit earn less, then none */
    this.set('ledge'); beep(700, 0.04, 'triangle', 0.03);
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
          if (p.soft && (pass || (this.dropT > 0 && p === this.dropPlat) || (st === 'attack' && this.move && this.move.burst && i.ly < -0.5))) continue;   /* a tumble with down held goes through a soft platform */
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
    const snap = st === 'attack' && this.move && this.move.ledge && this.mf > (this.move.snap ? this.move.snap - 1 : this.move.h[0] ? this.move.h[0].f1 : 8);   /* an up special past its hit takes the ledge on the way up too */
    if (!s.noLedge && (this.vy < 0 || snap) && this.ledgeCd === 0 && i.ly > -0.5 && (st === 'air' || st === 'helpless' || (st === 'attack' && this.move && this.move.ledge))) {
      const side = sgn(this.x), out = Math.abs(this.x) - EDGE, hand = this.y + s.h, o = F[1 - this.idx];
      if (side && out > -1 && out < 13 && hand > -9 && hand < 9 && this.ledgeGrabs < 6) {
        this.grabLedge(side);
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
  if (h.at) return h.at(a, back || 0);   /* a shape worked out from the move itself, such as both ends of a spinning rig */
  const ox = a.x - (back ? (a.x - a.px) * back : 0), oy = a.y - (back ? (a.y - a.py) * back : 0) + (a.aim || 0) * AIM_Y, tx = ox + h.x * a.face, ty = oy + h.y;
  if (!h.in || h.n === 1) return [[tx, ty, h.r]];
  const ix = ox + h.in[0] * a.face, iy = oy + h.in[1];
  if (h.n > 3) { const out = []; for (let k = 0; k < h.n; k++) { const q = k / (h.n - 1); out.push([ix + (tx - ix) * q, iy + (ty - iy) * q, h.r]); } return out; }   /* a long blade: enough circles to leave no gaps */
  return [[ix, iy, h.r], [(ix + tx) / 2, (iy + ty) / 2, h.r], [tx, ty, h.r]];
}
/* Does this hitbox touch that body? Checked where both are now and, if they closed more than a hitbox's width since the
   last frame, at the halfway point too, so nothing fast passes through between frames. */
function hitTouches(a, h, v) {
  const rel = Math.hypot((a.x - a.px) - (v.x - v.px), (a.y - a.py) - (v.y - v.py)), steps = h.at ? [0, 0.34, 0.67] : rel > h.r && rel < 12 ? [0, 0.5] : [0];   /* a jump of 12 or more is a placement (ledge, respawn), not movement */
  for (const b of steps) { const r = hurtRect(v), sx = (v.x - v.px) * b, sy = (v.y - v.py) * b; for (const c of hitCircles(a, h, b).reverse()) if (circRect(c[0], c[1], c[2], r[0] - sx, r[1] - sy, r[2] - sx, r[3] - sy)) return c; }
  return null;
}
/* Set knockback (Ultimate): the launch is worked out as if from a fixed amount, whatever the damage. */
function knockSet(v, s, b, k) { return (((1 + s * 10 / 20) * 200 / (v.st.weight + 100) * 1.4) + 18) * k / 100 + b; }
function knock(v, d, b, k) { const p = v.pct; return ((((p / 10 + p * d / 20) * 200 / (v.st.weight + 100) * 1.4) + 18) * k / 100) + b; }
function circRect(cx, cy, r, x0, y0, x1, y1) { const dx = cx - clamp(cx, x0, x1), dy = cy - clamp(cy, y0, y1); return dx * dx + dy * dy <= r * r; }
/* The body's hittable box. It shrinks when crouching or lying down, which is how a crouch slips under high attacks. */
function hurtRect(v) {
  const st = v.st; let w = st.w, h = st.h;
  if (v.state === 'buried') return [v.x - w / 2, v.y, v.x + w / 2, v.y + h * 0.45];   /* only the top half shows above the floor */
  if (v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y) { h *= st.crouch ? st.crouch[0] : 0.62; if (st.crouch) w *= st.crouch[1]; }
  else if (v.state === 'down') { h *= 0.42; w *= 1.4; }
  else if (v.state === 'ledge') return [v.x - w / 2, v.y, v.x + w / 2, v.y + h + 3];   /* head and hands show above the lip */
  else if (v.state === 'jsq' || v.state === 'land') h *= 0.86;
  else if (v.state === 'attack' && v.move && v.move.low && v.mf >= v.move.low[0] && v.mf <= v.move.low[1]) h *= 0.5;   /* a low skid or roll ducks under high attacks */
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
/* The final hit, as in Ultimate: when a hit will take the last stock and end the match, the game stops dead for FINAL_FREEZE
   frames with the camera punched in on the victim against a red burst (finalhit.js draws it), then plays the launch out in
   the slow motion above. FINAL holds what the picture needs: victim, attacker, where the hit landed and the launch angle. */
const FINAL_FREEZE = 48;
let finalT = 0, FINAL = null;
function canBeHit(v) { return v.invuln === 0 && v.state !== 'dead' && v.state !== 'respawn' && v.state !== 'held' && !(v.tfLatch && v.tfProtected()); }   /* Joey's five protected seconds: nothing can hit or grab him */
function applyHit(a, v, h, face, srcX, proj, poke, at) { sparkOff = !DBG.fx; try { applyHitRaw(a, v, h, face, srcX, proj, poke, at); } finally { sparkOff = false; } }
function applyHitRaw(a, v, h, face, srcX, proj, poke, at) {
  if (h.dyn) h = Object.assign({}, h, h.dyn(a));   /* a hit whose numbers depend on the moment (the Cyclone's light hits, then its finisher) */
  const hx = v.x, hy = v.y + v.st.h / 2;
  if (h.grab) {
    if (v.state === 'held' || v.state === 'hold' || a.state !== 'attack' || (!a.grounded && !h.cmd)) return;   /* a grab that traded with a hit loses */
    if (h.cmd) {   /* a grab that is its own throw: caught and flung in one motion, on the ground or in the air */
      v.freeVictim(); a.move = null; a.victim = v; a.throwK = h.cmd; a.vx = a.vy = 0; a.set('throw'); v.move = null; v.grounded = false; v.plat = null; v.set('held'); beep(330, 0.06, 'triangle', 0.05); return;
    }
    v.freeVictim(); a.move = null; a.set('hold'); a.victim = v; a.holdT = Math.min(300, 90 + v.pct * 1.7); a.pumT = 0; a.pumHit = 0; v.move = null; v.grounded = false; v.plat = null; v.set('held'); beep(330, 0.06, 'triangle', 0.05); return;
  }
  if (!proj && a.parriedBy === v) return;
  if (h.wind) {   /* a gust: no damage and no hitstun, just a shove, weaker on someone standing; a shield stops it */
    if (v.state === 'shield' || v.state === 'shieldstun') return;
    v.vx += face * h.wind * (v.grounded ? 0.45 : 1); if (!v.grounded) v.vy += h.wind * 0.2; spark(hx, hy, '#e8dcff', 8, 1.2); return;
  }
  if (proj && h.cast && a.castHit) return;   /* the follow-up of a cast that already hit this target */
  const id = h.id || (a.form.name + ':' + a.mname); let d = (h.dd ? h.dd(a) : h.d) * DMG_1V1;   /* dd: damage worked out when it lands (a charged launch) */
  const onShield = (v.state === 'shield' || v.state === 'shieldstun') && !poke;
  if (proj) { d *= staleMul(a, id); pushStale(a, id, onShield); }
  else { if (!a.staled) { a.staleM = staleMul(a, id); pushStale(a, id, onShield); a.staled = true; } d *= a.staleM * (1 + a.charge / 60 * CHG_K(a)) * (a.moveSH ? SHORT_HOP_MUL : 1); }
  if (v.state === 'shieldoff' && v.sf <= SHIELD.parry) {
    v.set('idle'); v.invuln = 4; if (!proj) { a.hitlag = 16; a.parriedBy = v; }
    spark(hx, hy, '#fff', 20, 2); pop(hx, hy + 12, 'PARRY', '#fff'); beep(1200, 0.12, 'triangle', 0.07, 1.3); return;
  }
  if (!proj && !h.grab && v.state === 'attack' && v.move && v.move.counter && v.mf >= v.move.counter[0] && v.mf <= v.move.counter[1] && sgn(a.x - v.x) === v.face) {
    if (h.d <= v.move.counterMax) { a.hitlag = 12; v.hitlag = 6; v.startMove('dcounter'); spark(hx, hy, '#ffd98a', 16, 1.8); pop(hx, hy + 12, 'BRACE', '#ffd98a'); beep(880, 0.08, 'triangle', 0.05, 0.6); return; }
    d *= 0.5;   /* a strong hit overpowers the brace, for half its damage */
  }
  /* A guard window (Brand's Shield Bash): on the ground it stops one light strike that comes in from the front, for the
     usual shield cost and freeze, and the move carries on. Too strong, from behind or above, a grab or a projectile: no guard. */
  if (!proj && v.state === 'attack' && v.move && v.move.guard && v.grounded && !v.guarded && v.mf >= v.move.guard[0] && v.mf <= v.move.guard[1] && h.d * (1 + a.charge / 60 * CHG_K(a)) <= v.move.guardMax) {
    const gc = v.move.guardC, gx = v.x + gc[0] * v.face, gy = v.y + gc[1], c = at || [a.x + h.x * a.face, hitY(a, h), h.r];
    let fx = (c[0] - v.x) * v.face; const fy = c[1] - gy; if (Math.abs(fx) < 1) fx = (a.x - v.x) * v.face;
    if (fx > 0 && Math.abs(Math.atan2(fy, fx)) <= 55 * Math.PI / 180 && Math.hypot(c[0] - gx, c[1] - gy) <= c[2] + gc[2]) {
      v.guarded = true; v.shieldHp -= d * SHIELD.dmg;
      if (v.shieldHp <= 0) { v.move = null; v.breakShield(); return; }
      const hl = Math.min(20, Math.floor((d * 0.65 + 6) * 0.67)); v.hitlag = hl; a.hitlag = hl;
      spark(gx, gy, '#ffb060', 12, 1.6); pop(gx, gy + 10, 'GUARD', '#ffb060'); beep(520, 0.06, 'triangle', 0.05, 0.8); return;
    }
  }
  if (poke) pop(hx, hy + 12, 'POKE', '#9cf');   /* the hit found a part of the body the shield no longer covers */
  if ((v.state === 'shield' || v.state === 'shieldstun') && !poke) {
    v.shieldHp -= (d + (h.sd || 0)) * SHIELD.dmg;   /* sd: extra shield damage */
    const sm = proj ? SHIELD.stun.proj : a.move && a.move.air ? SHIELD.stun.air : a.move && a.move.chg ? SHIELD.stun.smash : SHIELD.stun.ground;
    if (v.shieldHp <= 0) v.breakShield(); else { v.stunT = Math.floor(d * sm) + 2; v.set('shieldstun'); v.vx = (sgn(v.x - srcX) || face) * Math.min(1.3, (v.stunT + 1) * 0.09); }   /* pushback as in Ultimate: (shieldstun + 1) x 0.09, at most 1.3 */
    const hl = Math.min(20, Math.floor((d * 0.65 + 6) * 0.67)); v.hitlag = hl; if (!proj) a.hitlag = hl;
    spark(hx, hy, '#9cf', 6, 1); beep(400, 0.05, 'triangle', 0.04); return;
  }
  const chained = v.state === 'hurt' || v.state === 'held' || v.hitlag > 0;
  v.pct = Math.min(999, v.pct + d); v.flash = 6; if (!proj && a.move && a.move.cast) a.castHit = true; comboHit(a, v, d, chained);
  const crouch = v.grounded && v.state === 'idle' && v.ctl.c.ly < CROUCH_Y, charging = v.state === 'attack' && v.charge > 0;
  const kb = (h.fkv ? knockSet(v, h.fkv, h.b, h.k) : knock(v, d, h.b, h.k) * (h.norage ? 1 : rage(a))) * (crouch ? CROUCH_MUL : 1) * (charging ? CHARGING_MUL : 1);   /* fkv: set knockback, the same at any damage */
  const hl = h.hl !== undefined ? h.hl : Math.min(30, Math.floor((d * 0.65 + 6) * (crouch ? 0.67 : 1)));
  /* Armour: a move either shrugs off anything short of a hard launch, or (armorMax) takes one strike of that base damage or less, on the ground only. */
  const am = v.state === 'attack' && v.move && v.move.armor && v.mf >= v.move.armor[0] && v.mf <= v.move.armor[1] ? v.move : null;
  const sa = v.state === 'attack' && v.move && (v.grounded ? v.move.sarm : (v.move.sarmAir || v.move.sarm));   /* super armour: no flinch at all for those frames (the damage is still taken) */
  if (sa && v.mf >= sa[0] && v.mf <= sa[1]) { v.hitlag = hl; if (!proj) a.hitlag = hl; spark(hx, hy, '#ffcf8a', 10, 1.2); beep(150, 0.06, 'square', 0.05); return; }
  if (h.bury && v.grounded) {   /* buried: stuck in the floor for a time that grows with the launch it would have had */
    v.freeVictim(); v.move = null; v.vx = v.vy = 0; v.buryT = Math.min(180, Math.round(kb * 0.6) + 12); v.set('buried'); v.hitlag = hl; if (!proj) a.hitlag = hl;
    spark(hx, v.y, '#c9a27a', 18, 1.6); pop(hx, hy + 10, 'BURIED', '#e0b98a'); thwack(kb); shake = Math.max(shake, 6); return; }
  if (am && (am.armorMax ? v.grounded && h.d <= am.armorMax && v.armorLeft > 0 : kb < 95)) { if (am.armorMax) v.armorLeft--; v.hitlag = hl; if (!proj) a.hitlag = hl; spark(hx, hy, '#ccc', 8, 1); beep(150, 0.06, 'square', 0.05); return; }
  /* 361 is the "natural" angle: flat along the ground for weak hits, steeper as the hit gets stronger, 45 in the air. */
  let deg = h.a !== 361 ? h.a : !v.grounded ? 38 : kb < 60 ? 0 : kb >= 88 ? 38 : (kb - 60) / 28 * 38;   /* Ultimate's values (SmashWiki "Sakurai angle") */
  if (!proj && a.aim) deg = Math.max(0, deg + a.aim * 8);   /* an angled tilt sends a little higher or lower */
  let ang = deg * Math.PI / 180;
  let dir = h.away ? (sgn(v.x - srcX) || face) : face;
  if (h.drag) { const tx = a.face * (v.y + v.st.h / 2 - (a.y + FP)), ty = -a.face * (v.x - a.x); ang = Math.atan2(ty, tx); dir = 1; }   /* along the spin: forward over the top, back along the bottom */
  /* Directional influence: the stick bends the launch up to about 10 degrees. */
  const i = v.ctl.c, lx = Math.cos(ang) * dir, ly = Math.sin(ang), perp = i.lx * -ly + i.ly * lx;
  ang += perp * 0.17 * (dir > 0 ? 1 : -1);
  /* Holding up or down stretches or shortens the launch, except for near-vertical ones. */
  const nd = ((ang * 180 / Math.PI) % 360 + 360) % 360, vertical = (nd > 65 && nd < 115) || (nd > 245 && nd < 295);
  const lsi = vertical ? 1 : i.ly > 0.5 ? 1.095 : i.ly < -0.5 ? 0.92 : 1;
  v.launch(kb, ang, dir, lsi); if (h.hs) v.hitstun += h.hs; if (h.drag) { v.vx += a.vx; v.vy += a.vy; v.dragBy = a.idx; } else if (h.carry && !proj) { const cx = a.x + a.face * 2 - v.x, cy = a.y + a.st.h / 2 - (v.y + v.st.h / 2); v.grounded = false; v.plat = null; v.vx = a.vx + clamp(cx * 0.3, -2, 2); v.vy = a.vy + clamp(cy * 0.3, -2, 2) + 0.2; v.dragBy = a.idx; } else v.dragBy = -1;
  if (h.link) { v.tumble = false; v.grounded = false; v.plat = null; v.hitstun = v.linkT = h.link[2]; v.vx = face * h.link[0] / h.link[2]; v.vy = h.link[1] / h.link[2]; }   /* a linking hit: the target is moved a set distance over a set time, whatever its damage, so the next hit of the move connects */   /* carry: caught and taken along (sackCarry) */   /* carried along with a travelling rig (see fowlCarry) */ v.hitlag = hl; if (!proj) a.hitlag = hl; rumble(v.ctl, 60 + kb, Math.min(1, 0.25 + kb / 150)); rumble(a.ctl, 50, 0.25);
  if (wouldKO(v)) {   /* a hit that will KO lands harder: longer freeze, a bigger burst, and slow motion if it takes the last stock */
    v.hitlag += 8; if (!proj) a.hitlag += 8; shake = Math.max(shake, 14); rumble(v.ctl, 300, 1);
    spark(hx, hy, '#ff5a4d', 40, 4.2); spark(hx, hy, '#ffe9a8', 24, 2.6); beep(70, 0.5, 'sawtooth', 0.11, 0.5);
    if (v.stocks === 1) { slowT = 54; focus = { x: hx, y: hy };
      if (!TRAINING && !finalT) {   /* the match-ending hit: the red final-hit screen */
        finalT = FINAL_FREEZE; FINAL = { v: v.idx, a: a && a.idx !== undefined ? a.idx : 1 - v.idx, x: hx, y: hy, ang: Math.atan2(v.vy, v.vx), t0: frame };
        v.hitlag = Math.min(v.hitlag, 3); if (a && a.hitlag) a.hitlag = Math.min(a.hitlag, 3);   /* the freeze stands in for the hit's own freeze, so the launch plays out in the slow motion after it */
        shake = 0; rumble(v.ctl, 600, 1); if (a && a.ctl) rumble(a.ctl, 400, 0.8);
        beep(55, 0.9, 'sawtooth', 0.13, 0.4); beep(1400, 0.35, 'triangle', 0.06, 2.2); } }
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
  const live = f => f.state === 'attack' && f.move ? f.move.h.filter(h => !h.grab && f.mf >= h.f0 && f.mf <= h.f1 && (!h.when || h.when(f))) : [];
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
    const a = F[1 - p.owner]; if (p.life <= 0 || !a || p.ghost || (p.gndBreak && !a.grounded)) continue;
    for (const h of live(a)) { const dx = a.x + h.x * a.face - p.x, dy = hitY(a, h) - p.y; if (dx * dx + dy * dy <= (h.r + p.r) * (h.r + p.r) && h.d + 9 > p.h.d) { p.life = 0;   /* an attack puts out a projectile less than 9% stronger than itself */ spark(p.x, p.y, '#fff', 8, 1.2); beep(700, 0.04, 'triangle', 0.04); break; } }
  }
  for (const a of F) {
    const v = F[1 - a.idx];
    if (a.state === 'attack' && a.move && canBeHit(v)) {
      for (const h of (a.move.hp || a.move.h)) {   /* hp: the same hitboxes with the parts near the body first */
        if (a.mf < h.f0 || a.mf > h.f1 || (h.when && !h.when(a))) continue; const gid = h.g || 0; if (a.hitG.has(gid)) continue;
        if (h.grab && ((!a.grounded && !h.cmd) || v.grabImm > 0 || (h.floor && !(a.grounded && v.grounded)))) continue;
        if ((h.airOnly && a.grounded) || (h.gndOnly && !a.grounded) || (h.vAir && v.grounded) || (h.vGnd && !v.grounded)) continue;   /* a hit that only exists in the air, or only on the floor */   /* ordinary grabs are for the ground; a leaping grab catches in the air; a floor grab needs both standing */
        const at = hitTouches(a, h, v); if (at) { ev.push([a, v, h, a.face, a.x, false, !h.grab && pokes(v, at[0], at[1]), at]); a.hitG.add(gid); break; }
      }
    }
  }
  for (const p of PROJ) {
    const v = F[1 - p.owner];
    if (p.life > 0 && !p.ghost && !(p.cool > 0) && canBeHit(v) && (circRect(p.x, p.y, p.r, ...hurtRect(v)) || (Math.hypot(p.vx, p.vy) > p.r && circRect(p.x - p.vx / 2, p.y - p.vy / 2, p.r, ...hurtRect(v))))) {   /* and halfway back along a fast shot's path */ ev.push([F[p.owner], v, p.h, p.face, p.x, true, pokes(v, p.x, p.y)]); if (p.onHit) p.onHit(p, F[p.owner], v); if (p.hits > 1) { p.hits--; p.cool = p.rehit || 6; } else { p.life = 0; p.spent = true; } if (p.grp && p.life <= 0) for (const q of PROJ) if (q.grp === p.grp && q.owner === p.owner) q.life = 0; }   /* grp: parts of one burst, one hit between them */
  }
  for (const e of ev) applyHit(...e);
}
function updateProj() {
  for (const p of PROJ.slice()) {
    p.life--; p.age = (p.age || 0) + 1; const py = p.y - p.r;
    if (p.cool > 0) p.cool--;
    if (p.step) { p.step(p); continue; }   /* moves itself (Chomp Chomp's coal and ant) */
    if (p.track) { const ow = F[p.owner]; if (!ow || ow.state === 'dead') { p.life = 0; continue; } const q = p.track(ow, p); p.vx = q[0] - p.x; p.vy = q[1] - p.y; p.x = q[0]; p.y = q[1]; continue; }   /* placed by a rule from its owner (Pip's doubles) */
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
  for (const p of PROJ) if (p.onGone && !p.gone && (p.life <= 0 || p.y <= BLAST.b || Math.abs(p.x) >= BLAST.r)) { p.gone = true; p.onGone(p); }
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
  if (f.def.fowl && f.state === 'attack' && f.mname === 'uspec' && !f.grounded && !f.move.fowlUp) {   /* a lone bird recovering: steer for the stage, and spend a second hop once the first one tops out */
    i.ly = 1; i.lx = Math.abs(f.x) > EDGE - 6 ? -sgn(f.x) : 0; if (f.move.twoStep) i.spc = f.mf > 12 && f.vy < 0.6 && m.t % 2 === 0; return i; }
  if (f.state === 'attack' && f.move && f.move.fowlUp) { const off = Math.abs(f.x) > EDGE - 4 || f.y < -2; i.spc = !f.upGo && f.upC < (off ? 34 : 12); i.ly = 1; i.lx = off ? -sgn(f.x) * (f.y < -20 ? 0.5 : 1) : dir * 0.6; return i; }
  if (f.sling && f.grounded && f.state !== 'attack' && (ad > 16 || f.pct > 60)) { const sx = f.sling.x - f.x; if (Math.abs(sx) < 7 && Math.abs(f.sling.y - f.y) < 6) { i.ly = -1; i.spc = m.t % 4 < 2; return i; } if (f.sling.plat && Math.abs(f.sling.y - f.y) < 4) { i.lx = sgn(sx); return i; } }
  if (f.state === 'attack' && f.move && f.move.hold) { i.spc = true; i.lx = Math.abs(f.x) > EDGE - 6 ? -sgn(f.x) * 0.8 : 0; return i; }   /* a rise that lasts while special is held: hold it, and steer for the stage */
  if (f.state === 'attack' && f.mname === 'nspec' && m.big && f.mf <= 17) { i.spc = true; return i; }   /* holding for the bigger stone */
  if (f.state === 'attack' && f.move && f.move.rapid) { i.atk = f.rapidN < 6 && ad < 16; return i; }
  if (f.state === 'attack' && f.move && f.move.next && f.mf >= f.move.chain && ad < 18) { i.atk = m.t % 2 === 0; return i; }
  if (f.def.transform && !f.tfLatch) { if (m.tfAt === undefined) m.tfAt = 30 + (Math.random() * 240 | 0); if (m.t >= m.tfAt) i.tf = m.t % 6 < 2; }   /* two taps of the transform action, a moment into the match */
  if (f.state === 'grow') return i;
  if (f.state === 'buried') { const q = L.mash || 12; i.grb = m.t % q === 0; i.lx = m.t % (q * 2) < q ? 1 : -1; return i; }
  if (f.state === 'carry') { if (f.sf > 8 + (m.t % 20)) { i.atk = m.t % 2 === 0; const r = (m.t >> 3) % 4; if (r === 1) i.ly = 1; else if (r === 2) i.lx = -f.face; else if (r === 3 && Math.abs(f.x) > EDGE - 30) i.lx = f.face; } else if (Math.abs(f.x) < EDGE - 20) i.lx = f.face * 0.8; return i; }
  if (f.state === 'attack' && f.mname === 'nspec' && f.form.cargo && f.mf > 8) { i.spc = (ad < 26 && Math.abs(dy) < 12 && f.face === dir && m.t % 2 === 0) || (o.state === 'attack' && ad < 30 && m.t % 2 === 0) ? true : false; if (!i.spc && ad < 16 && Math.random() < 0.02) i.shd = true; return i; }   /* a Giant Punch on charge: let it go when they are in reach */
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
  if (f.grounded && f.form.aiBash && m.cd === 0 && NAP_STATES[f.state] && o.state === 'attack' && o.grounded && o.mf <= 3 && ad < 15 && Math.abs(dy) < 6 && Math.random() < L.punish * 0.5) { i.lx = dir; i.spc = true; m.cd = 45; return i; }   /* a swing just starting in front of her: the guarded bash */
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
let PAUSED_BY = 0, PAUSE_SEL = 0;   /* who pressed Start, and the pause menu's highlighted line (movelist.js draws and runs the menu) */
let slots = [null, null], DEVS = {};
const cam = { x: 0, y: 30, s: 3.4 };
function devCtl(dev) { return DEVS[dev] || (DEVS[dev] = new Ctl(dev)); }
function allDevs() { const d = ['kb']; const gp = navigator.getGamepads ? navigator.getGamepads() : []; for (let n = 0; n < gp.length && n < 4; n++) if (gp[n]) d.push('pad' + n); return d; }
function startMatch() {
  const s0 = slots[0], s1 = slots[1] || { dev: 'cpu', pick: CPU_PICK >= 0 ? CPU_PICK : Math.random() * ROSTER.length | 0 };   /* the CPU's token, or random */
  const c0 = devCtl(s0.dev), c1 = s1.dev === 'cpu' ? new Ctl('cpu') : devCtl(s1.dev);
  for (const c of [c0, c1]) { c.tfAge = 99; c.tfReq = false; }
  F = [new Fighter(0, ROSTER[s0.pick], c0, false), new Fighter(1, ROSTER[s1.pick], c1, s1.pick === s0.pick)];
  for (const c of COMBO) Object.assign(c, { hits: 0, dmg: 0, last: null, best: null, t: 0 });
  PROJ = []; PART = []; POPS = []; timer = MATCH_FRAMES; sudden = false; slowT = 0; focus = null; finalT = 0; FINAL = null; countdown = 190; paused = false; mode = 'countdown'; cam.x = 0; cam.y = 30; cam.s = 3.4;
}
/* Start screen: the fighters chosen so far stand on the island, for show only (nothing here is played). They are
   rebuilt whenever a choice changes; Wren's three companions take turns. The camera sits close on the island. */
let PREVIEW = null;
function selectPreview() {
  tick++;
  const shown = slots.slice(); if (!shown[1] && shown[0] && CPU_PICK >= 0) shown[1] = { pick: CPU_PICK };   /* the CPU's chosen fighter stands on the island too */
  const key = shown.map(s => s ? s.pick : '-').join(',');
  if (key !== PREVIEW || !F.preview) {
    PREVIEW = key; const list = [];
    shown.forEach((s, k) => { if (!s) return; const n = list.length, f = new Fighter(n, ROSTER[s.pick], new Ctl('cpu'), k === 1 && !!slots[0] && slots[0].pick === s.pick); f.x = n ? 16 : -16; f.face = n ? -1 : 1; list.push(f); });
    F = list; F.preview = true; PROJ = []; PART = []; POPS = [];
  }
  for (const f of F) if (f.def.forms.length > 1 && !f.def.transform) f.fi = Math.floor(tick / 170) % (f.def.cycle || f.def.forms.length);   /* Joey stays himself: his other form is a surprise */
  cam.x = Math.sin(tick * 0.004) * 3; cam.y = 5; cam.s = 9;
}
/* The fighter select screen: where each roster tile and the CPU card are (the HUD draws them from the same numbers), and
   which one a player's cursor is over. */
function rosterTile(k) { const n = ROSTER.length, tw = Math.min(168, (W - 120) / n - 12), gap = 12, x0 = (W - (n * tw + (n - 1) * gap)) / 2; return [x0 + k * (tw + gap), 158, tw, 124]; }
const CPU_CARD = [W - 44 - 460, 446, 460, 158], TRAIN_PILL = [W - 44 - 214, 100, 214, 34], ARC_PILL = [W - 44 - 214, 140, 214, 34];
/* Desktop app only (window.desktop): Online and Quit, under the switches, so a controller can reach them too. */
const ONLINE_PILL = [W - 44 - 214, 180, 214, 34], QUIT_PILL = [W - 44 - 214, 220, 214, 34];
const DESKTOP = () => typeof window !== 'undefined' && !!window.desktop;
let UI_MODAL = false, QUIT_ASK = 0;   /* UI_MODAL: a screen drawn over the game (the online menu) has the controllers; QUIT_ASK: frames left to confirm quitting */
const inBox = (b, x, y) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
function tileUnder(x, y) { for (let k = 0; k < ROSTER.length; k++) if (inBox(rosterTile(k), x, y)) return k; return -1; }
/* The CPU's token: dragged with the mouse (or a finger) onto a fighter's tile to choose the CPU's fighter. Dropped anywhere
   else, the CPU picks at random again. CPU_PICK is -1 for random. Only while the second player slot is empty. */
let CPU_PICK = -1; const CPU_TOK = { x: 0, y: 0, drag: false, dx: 0, dy: 0 };
function cpuTokHome() { if (CPU_PICK >= 0) { const b = rosterTile(CPU_PICK); CPU_TOK.x = b[0] + b[2] - 44; CPU_TOK.y = b[1] + b[3] - 60; } else { CPU_TOK.x = CPU_CARD[0] + 236; CPU_TOK.y = CPU_CARD[1] + 40; } }
cpuTokHome();
function cpuTokOn(x, y) { return mode === 'select' && !slots[1] && Math.hypot(x - (CPU_TOK.x + 24), y - (CPU_TOK.y + 24)) < 24; }
function cpuGrab(x, y) { if (!cpuTokOn(x, y)) return false; CPU_TOK.drag = true; CPU_TOK.dx = CPU_TOK.x - x; CPU_TOK.dy = CPU_TOK.y - y; beep(600, 0.04, 'triangle', 0.03); return true; }
function cpuDrag(x, y) { if (!CPU_TOK.drag) return; CPU_TOK.x = clamp(x + CPU_TOK.dx, 0, W - 48); CPU_TOK.y = clamp(y + CPU_TOK.dy, 0, H - 48); const k = tileUnder(CPU_TOK.x, CPU_TOK.y); if (k >= 0 && k !== CPU_PICK) { CPU_PICK = k; beep(440, 0.03, 'square', 0.02); } }
function cpuDrop(x, y) { if (!CPU_TOK.drag) return; cpuDrag(x, y); CPU_TOK.drag = false; CPU_PICK = tileUnder(CPU_TOK.x, CPU_TOK.y); cpuTokHome(); beep(CPU_PICK >= 0 ? 800 : 420, 0.06, 'triangle', 0.04); }
function stepSelect() {
  selectPreview(); if (QUIT_ASK > 0) QUIT_ASK--;
  for (const dev of allDevs()) {
    const c = devCtl(dev); c.poll(readDev(dev));
    if (UI_MODAL) continue;   /* the online menu is open: it reads the controllers itself */
    if (typeof ML !== 'undefined' && ML.open) { if (dev === ML.dev) mlInput(c); continue; }   /* a move list is open (movelist.js): only its player turns the pages */
    if (c.pressed('sel')) { openCMenu(dev); return; }   /* Backspace, or - on a controller: the controls screen for that device */
    if (c.pressed('jmp')) { setBoxes(!DBG.boxes); beep(DBG.boxes ? 700 : 420, 0.05, 'square', 0.03); }   /* jump button: show or hide hitboxes */
    if (c.pressed('shd')) { setHitFx(!DBG.fx); beep(DBG.fx ? 700 : 420, 0.05, 'square', 0.03); }   /* shield button: hit sparks and flash on or off */
    let sl = slots.find(s => s && s.dev === dev);
    if (!sl) { if (c.pressed('atk') || c.pressed('start')) { const k = slots[0] ? (slots[1] ? -1 : 1) : 0; if (k >= 0) { const tb = rosterTile(k); slots[k] = { dev, pick: k, ready: false, cx: tb[0] + tb[2] / 2, cy: tb[1] + tb[3] + 46 }; beep(600, 0.06, 'triangle', 0.05); } } continue; }
    /* Each player has a cursor moved with the stick (or the arrow keys). Pointing at a fighter shows it; Attack there picks it.
       On the CPU card, Attack raises the level and Special lowers it. Special anywhere else takes back a pick, then leaves. */
    if (sl.cx === undefined) { const tb = rosterTile(sl.pick); sl.cx = tb[0] + tb[2] / 2; sl.cy = tb[1] + tb[3] + 46; }
    const mag = Math.hypot(c.c.lx, c.c.ly); if (mag > 0.15) { const sp = 4 + 9 * Math.min(1, mag); sl.cx = clamp(sl.cx + c.c.lx / mag * sp, 8, W - 8); sl.cy = clamp(sl.cy - c.c.ly / mag * sp, 8, H - 8); }
    const over = tileUnder(sl.cx, sl.cy), onCpu = !slots[1] && inBox(CPU_CARD, sl.cx, sl.cy);
    if (over >= 0 && !sl.ready && sl.pick !== over) { sl.pick = over; beep(440, 0.03, 'square', 0.02); }
    /* The CPU's fighter: point at its token and press Attack to pick it up, move it onto a fighter, Attack again to put it down
       (the mouse can still drag it). Off any fighter, it goes back to random. */
    if (sl.tok) { CPU_TOK.x = clamp(sl.cx - 24, 0, W - 48); CPU_TOK.y = clamp(sl.cy - 24, 0, H - 48); CPU_TOK.drag = true;
      if (c.pressed('atk') || c.pressed('spc') || slots[1]) { sl.tok = false; CPU_TOK.drag = false; if (!slots[1] && c.pressed('atk')) CPU_PICK = tileUnder(sl.cx, sl.cy); cpuTokHome(); beep(CPU_PICK >= 0 ? 800 : 420, 0.06, 'triangle', 0.04); }
      continue; }
    if (c.pressed('atk') && !CPU_TOK.drag && cpuTokOn(sl.cx, sl.cy)) { sl.tok = true; beep(600, 0.04, 'triangle', 0.03); continue; }
    /* + (Start, or the + key) while pointing at a fighter opens its move list; once everyone is ready, Start fights instead */
    if (typeof mlOpen === 'function' && dev === 'kb' && mlPlusKey()) { if (over >= 0) mlOpen(ROSTER[over], 0, c, 0, true); else setSwitches(!SWITCHES); continue; }
    if (c.pressed('start')) { if (slots[0] && slots[0].ready && (!slots[1] || slots[1].ready)) { startMatch(); return; } if (typeof mlOpen === 'function' && over >= 0) { mlOpen(ROSTER[over], 0, c, 0, true); continue; } setSwitches(!SWITCHES); continue; }   /* anywhere else: hide or show the switches */
    else if (c.pressed('atk')) {
      if (SWITCHES && DESKTOP() && inBox(ONLINE_PILL, sl.cx, sl.cy)) { if (window.openOnline) window.openOnline(); beep(600, 0.05, 'square', 0.03); continue; }
      if (SWITCHES && DESKTOP() && inBox(QUIT_PILL, sl.cx, sl.cy)) { if (QUIT_ASK > 0) window.close(); else { QUIT_ASK = 150; beep(300, 0.08, 'square', 0.04); } continue; }   /* press twice to quit */
      if (SWITCHES && inBox(TRAIN_PILL, sl.cx, sl.cy)) { setTraining(!TRAINING); beep(TRAINING ? 700 : 420, 0.05, 'square', 0.03); }
      if (SWITCHES && inBox(ARC_PILL, sl.cx, sl.cy)) { setArcs(!DBG.arcs); beep(DBG.arcs ? 700 : 420, 0.05, 'square', 0.03); }
      else if (onCpu) { setCpuLevel(CPU_LEVEL + 1 > 9 ? 0 : CPU_LEVEL + 1); beep(360 + CPU_LEVEL * 40, 0.04, 'square', 0.03); }
      else if (over >= 0) { sl.pick = over; sl.ready = true; beep(800, 0.08, 'triangle', 0.05); }
      else if (sl.ready && slots[0] && slots[0].ready && (!slots[1] || slots[1].ready)) { startMatch(); return; }
    } else if (c.pressed('spc')) {
      if (onCpu) { setCpuLevel(CPU_LEVEL - 1 < 0 ? 9 : CPU_LEVEL - 1); beep(360 + CPU_LEVEL * 40, 0.04, 'square', 0.03); }
      else if (sl.ready) sl.ready = false;
      else { slots[slots.indexOf(sl)] = null; if (!slots[0] && slots[1]) { slots[0] = slots[1]; slots[1] = null; } }
    }
  }
}
function pollMatch() {
  for (const f of F) f.ctl.poll(f.ctl.dev === 'cpu' ? (mode === 'play' ? cpuInput(f, F[1 - f.idx], f.ctl.ai) : blankIn()) : readDev(f.ctl.dev));
}
function finish(text) { result = text; mode = 'over'; overT = 0; beep(300, 0.5, 'triangle', 0.08, 2); }
function resetFighters() {
  PROJ = []; slowT = 0; focus = null; finalT = 0; FINAL = null; shake = 0;
  for (const f of F) { if (f.def.fowl) { f.sling = null; f.fi %= 5; } if (f.def.transform) { f.fi = 0; f.tfLatch = f.tfPend = false; f.tfStart = -1; f.ctl.tfReq = false; } f.freeVictim(); f.victim = null; f.stocks = STOCKS; f.spawn(true); for (const k in f.ctl.buf) f.ctl.buf[k] = 0; }
  beep(520, 0.08, 'triangle', 0.05, 1.4);
}
function stepPlay() {
  const starter = F.find(f => f.ctl.dev !== 'cpu' && f.ctl.pressed('start'));
  const quit = () => { paused = false; mode = 'select'; for (const s of slots) if (s) s.ready = false; F = []; PROJ = []; PART = []; POPS = []; beep(300, 0.1, 'triangle', 0.05); };
  if (paused && typeof pauseMenuStep === 'function') {   /* the pause menu and the move list (movelist.js) */
    const r = pauseMenuStep(starter); if (r === 'held') return; if (r === 'resume') { paused = false; return; } if (r === 'exit') { quit(); return; } }
  if (starter) { paused = !paused; if (paused) { PAUSED_BY = starter.idx; PAUSE_SEL = 0; } return; }
  if (paused) {   /* paused: Special leaves the match and goes back to the fighter select */
    const cm = F.find(f => f.ctl.dev !== 'cpu' && f.ctl.pressed('sel')); if (cm) { openCMenu(cm.ctl.dev); return; }
    if (F.some(f => f.ctl.dev !== 'cpu' && f.ctl.pressed('spc'))) quit();
    return;
  }
  /* Testing shortcut: attack + special + grab (A + B + L or R on a controller, Z + X + A or S on the keyboard) pressed together puts both
     fighters back where a match starts, with full stocks and no damage. The clock keeps running. */
  if (F.some(f => f.ctl.dev !== 'cpu' && f.ctl.c.atk && f.ctl.c.spc && f.ctl.c.grb && !(f.ctl.p.atk && f.ctl.p.spc && f.ctl.p.grb))) { resetFighters(); return; }
  if (finalT > 0) { finalT--; if (!finalT) shake = 10; return; }   /* the final hit: everything stands still on the red screen */
  if (slowT > 0) { slowT--; if (slowT % 3) return; }   /* one step in three while the finishing hit plays out */
  frame++;
  for (const f of F) { f.px = f.x; f.py = f.y; }   /* where each was before this frame, for sweeping hits */
  for (const f of F) f.update();
  fowlSlings();
  jostle();
  updateProj(); resolveHits();
  for (const f of F) if (f.state !== 'dead' && f.state !== 'respawn' && (f.x < BLAST.l || f.x > BLAST.r || f.y > BLAST.t || f.y < BLAST.b)) f.ko();
  if (!TRAINING) timer--; comboStep();
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
  if (finalT > 0 && FINAL && F[FINAL.v]) {   /* punch in hard on the victim, between them and where the hit landed */
    const v = F[FINAL.v], tx = (v.x * 2 + FINAL.x) / 3, ty = (v.y + v.st.h / 2) * 2 / 3 + FINAL.y / 3, k = finalT > FINAL_FREEZE - 3 ? 0.6 : 0.25;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.s += (CAM.max * 1.55 - cam.s) * k; return; }
  if (slowT > 0 && focus) { const fv = FINAL && F[FINAL.v] && F[FINAL.v].state !== 'dead' ? F[FINAL.v] : null, fx = fv ? fv.x : focus.x, fy = fv ? fv.y + fv.st.h / 2 : focus.y;   /* after the final hit: follow the victim out */
    cam.x += (fx - cam.x) * 0.18; cam.y += (fy - cam.y) * 0.18; cam.s += (CAM.max + 1 - cam.s) * 0.14; return; }
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
  if (CMENU) { stepCMenu(); if (mode === 'select') selectPreview(); return; }   /* the controls screen holds everything else still */
  if (mode === 'select') { stepSelect(); return; }
  pollMatch(); if (!paused) tick++;
  if (mode === 'countdown') { countdown--; if (countdown === 130 || countdown === 90 || countdown === 50) beep(440, 0.1, 'square', 0.05); if (countdown === 10) beep(880, 0.3, 'square', 0.06); if (countdown <= 10) mode = 'play'; }
  else if (mode === 'play') stepPlay();
  else if (mode === 'over') { overT++; if (overT < 90) { for (const f of F) { if (overT % 3 === 0) f.update(); } } if (overT > 100 && F.some(f => f.ctl.dev !== 'cpu' && (f.ctl.pressed('start') || f.ctl.pressed('atk')))) { mode = 'select'; for (const s of slots) if (s) s.ready = false; F = []; } }
  stepFx();
}

