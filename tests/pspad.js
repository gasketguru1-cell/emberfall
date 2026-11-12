// PlayStation controllers: a PS5 / PS4 pad reads the same as any other pad, in the standard layout and in the raw one
// some browsers and Bluetooth set-ups give, and the game names its buttons the PlayStation way.
// Usage: node tests/pspad.js        (exit code 1 on any failure)
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => { t[k] = v; return true; } });
global.document = { getElementById: () => ({ getContext: () => ctx }) }; global.window = global; global.addEventListener = () => {}; global.requestAnimationFrame = () => {};
let PADS = [];
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => PADS }, configurable: true });
for (const f of ['hitboxes.js', 'sim.js']) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const btns = (n, on, vals = {}) => Array.from({ length: n }, (_, k) => ({ pressed: on.includes(k), value: vals[k] != null ? vals[k] : on.includes(k) ? 1 : 0 }));
const pad = (id, mapping, on, axes, vals) => ({ id, index: 0, mapping, buttons: btns(mapping === 'standard' ? 18 : 14, on, vals), axes });
const DS = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', RAW = '054c-0ce6-Wireless Controller';

// standard layout: cross attacks, circle specials, R2 shields (by its analog value), Options starts, touchpad opens controls
PADS = [pad(DS, 'standard', [0, 9, 17], [0.5, -1, 0, 0.8], { 7: 0.6 })];
let i = readPad(0);
ok(i.atk && !i.spc && i.shd && i.start && i.sel, 'standard DualSense: cross = attack, R2 (analog) = shield, Options = start, touchpad = controls');
ok(Math.abs(i.lx - 0.5 / Math.hypot(0.5, 1)) < 1e-6 && i.ly > 0.8 && i.cy < -0.7, 'standard DualSense: sticks (up is up)');
ok(devName('pad0') === 'PS5 controller 1', 'named "PS5 controller 1"');
ok(padCap('A', 'pad0') === '✕' && padCap('A') === '✕' && padCap('B') === '○' && padCap('ZR') === 'R2' && padCap('+') === 'Options', 'button names: ✕ ○ R2 Options');

// raw layout: square 0, cross 1, circle 2, triangle 3; right stick on axes 2 and 5; D-pad as a hat on axis 9
const rawAxes = (hat, ry = 0) => [0, 0, ry ? 0 : 0.9, -1, -1, ry, 0, 0, 0, hat];
PADS = [pad(RAW, '', [1], rawAxes(1.2857))];
i = readPad(0); ok(i.atk && !i.spc && !i.jmp && i.lx === 0 && i.ly === 0, 'raw: cross = attack, D-pad at rest, triggers at rest (axes 3/4 = -1) do nothing');
ok(i.cx > 0.8 && i.cy === 0, 'raw: right stick X from axis 2, Y from axis 5 (not the trigger on axis 3)');
PADS = [pad(RAW, '', [2], rawAxes(-1, -0.9))]; i = readPad(0); ok(i.spc && !i.atk && i.ly === 1 && i.cy > 0.8, 'raw: circle = special, hat up = D-pad up, right stick up');
PADS = [pad(RAW, '', [0, 3], rawAxes(0.7143))]; i = readPad(0); ok(i.jmp && i.jmp2 && i.lx === -1, 'raw: square + triangle = two jumps (short hop), hat left');
PADS = [pad(RAW, '', [], rawAxes(0.1429))]; i = readPad(0); ok(i.ly === -1 && i.tf, 'raw: hat down = D-pad down');
PADS = [pad(RAW, '', [7, 13], rawAxes(1.2857))]; i = readPad(0); ok(i.shd && i.sel && !i.start, 'raw: R2 = shield, touchpad = controls');
PADS = [pad(RAW, '', [9], rawAxes(1.2857))]; i = readPad(0); ok(i.start, 'raw: Options = start');
PADS = [pad(RAW, '', [], rawAxes(1.2857))]; let m = menuRaw('pad0'); ok(!m.ok && !m.back, 'raw menus: nothing pressed');
PADS = [pad(RAW, '', [1], rawAxes(-0.4286))]; m = menuRaw('pad0'); ok(m.ok && m.x === 1, 'raw menus: cross chooses, hat right moves right');
PADS = [pad(RAW, '', [2], rawAxes(1.2857))]; m = menuRaw('pad0'); ok(m.back, 'raw menus: circle goes back');

// other pads are untouched
PADS = [pad('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'standard', [1, 8], [0, 0, 0, 0])];
i = readPad(0); ok(i.spc && i.sel && !i.atk && devName('pad0') === 'Xbox controller 1' && padCap('A') === 'A', 'Xbox pad: unchanged, letters on screen');

// Nintendo: a Switch Pro Controller in the standard layout reads by position; the names on screen are Nintendo's
PADS = [pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [0], [0, 0, 0, 0])];
i = readPad(0); ok(i.atk && devName('pad0') === 'Switch Pro Controller 1' && padCap('A', 'pad0') === 'B' && padCap('B', 'pad0') === 'A' && padCap('Y', 'pad0') === 'X', 'Switch Pro: bottom button attacks and is called B');
PADS = [pad('057e-2009-Pro Controller', '', [1, 12], [0, 0, 0, 0, 0, 0, 0, 0, 0, -1])]; i = readPad(0); ok(i.spc && i.ly === 1 && i.sel === false, 'Switch Pro raw: right button = special, hat up');
PADS = [pad('Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)', 'standard', [], [0, 0, 0, 0])]; ok(devKind('pad0') === 'joyLR' && padCap('A', 'pad0') === 'B', 'Joy-Con pair: Nintendo names');
PADS = [pad('Joy-Con (L) (Vendor: 057e Product: 2006)', 'standard', [0], [0, 0, 0, 0])]; ok(devKind('pad0') === 'joyL' && readPad(0).atk && padCap('A', 'pad0') === '↓' && !padRowsFor('pad0').some(r => r[0] === 11), 'one Joy-Con: sideways arrows, no right stick click');
PADS = [pad('HORIPAD S (Vendor: 0f0d Product: 00c1)', 'standard', [], [0, 0, 0, 0])]; ok(devName('pad0') === 'Switch-style controller 1', 'Hori Switch pad: Switch-style');
PADS = [pad('PowerA Wired Controller (Vendor: 20d6 Product: a711)', 'standard', [], [0, 0, 0, 0])]; ok(devKind('pad0') === 'switchlike', 'PowerA Switch pad: Switch-style');

// GameCube through a Mayflash adapter (PC mode): raw buttons, analog triggers on axes 3 / 4 resting at -1, C-stick on axes 5 / 2
const MF = 'MAYFLASH GameCube Controller Adapter (Vendor: 0079 Product: 1846)', gcAx = (o = {}) => Object.assign([0, 0, 0, -1, -1, 0, 0, 0, 0, 1.2857], o);
PADS = [pad(MF, '', [], gcAx())]; i = readPad(0); ok(devName('pad0') === 'GameCube controller 1' && !i.shd && !i.atk && i.cx === 0, 'Mayflash GC: at rest, triggers resting do nothing');
PADS = [pad(MF, '', [1], gcAx({ 3: 1 }))]; i = readPad(0); ok(i.atk && i.shd, 'Mayflash GC: A attacks, L trigger (analog, axis 3) shields');
PADS = [pad(MF, '', [2], gcAx({ 5: 0.8 }))]; i = readPad(0); ok(i.spc && i.cx > 0.8, 'Mayflash GC: B specials, C-stick right');
PADS = [pad(MF, '', [9], gcAx())]; i = readPad(0); ok(i.start && padCap('A', 'pad0') === 'A' && padCap('R', 'pad0') === 'Z' && !padRowsFor('pad0').some(r => r[0] === 8), 'Mayflash GC: Start, names A and Z, no select row');

// GameCube through Nintendo's adapter over USB: ports become controllers 5 to 8
const pkt = new Uint8Array(37); pkt[0] = 0x21;
const port = (n, st, b1, b2, sx, sy, l = 30, r = 30) => { pkt.set([st, b1, b2, sx, sy, 128, 128, l, r], 1 + 9 * n); };
port(0, 0x10, 0, 0, 128, 128); PADS = []; GCU.pads[0] = gcuPad(0, pkt, 1);
port(0, 0x10, 0x01, 0x04, 200, 128); GCU.pads[0] = gcuPad(0, pkt, 1); i = readPad(4);
ok(allDevs().includes('pad4') && devName('pad4') === 'GameCube controller 5' && i.atk && i.grb === (setupOf('pad4').map[7] === 'grb') && i.lx === 1, 'GC adapter: port 1 = controller 5, A attacks, stick right (rest learned from the first reading)');
port(0, 0x10, 0x02, 0x01, 128, 56, 220); GCU.pads[0] = gcuPad(0, pkt, 1); i = readPad(4); ok(i.spc && i.start && i.ly === -1 && i.shd, 'GC adapter: B specials, Start starts, stick down, L trigger pressed in shields');
port(0, 0, 0, 0, 0, 0); GCU.pads[0] = gcuPad(0, pkt, 1); ok(!allDevs().includes('pad4'), 'GC adapter: an empty port is no controller');
GCU.pads = [null, null, null, null];

// a controller taught its buttons on the controls screen
const ODD = 'Odd Pad (Vendor: 1234 Product: 5678)';
TAUGHT[ODD] = { b: { 0: { b: 5 }, 1: { a: 4, s: 1, r: -1 }, 12: { h: 9, v: -1 } }, ax: { 0: { a: 2, s: 1 }, 1: { a: 3, s: -1 } } };
PADS = [pad(ODD, '', [5], [0, 0, 0.6, 0.7, -1, 0, 0, 0, 0, -1])]; i = readPad(0);
ok(i.atk && !i.spc && i.ly > 0 && i.lx > 0 && padGroupOf('pad0') === 'x', 'taught pad: button 5 = attack, hat up = D-pad up beats the stick, Xbox names');
PADS = [pad(ODD, '', [], [0, 0, 0, 0, 0.9, 0, 0, 0, 0, 1.2857])]; i = readPad(0); ok(i.spc && !i.atk, 'taught pad: an axis resting at -1 pushed in = special');
delete TAUGHT[ODD];

// opposite directions together, and the half-stick button
PADS = [pad('Xbox Controller (XInput STANDARD GAMEPAD)', 'standard', [14], [0, 0, 0, 0])]; readPad(0);
PADS = [pad('Xbox Controller (XInput STANDARD GAMEPAD)', 'standard', [14, 15], [0, 0, 0, 0])]; SOCD.mode = 'neutral'; i = readPad(0); ok(i.lx === 0, 'left + right: neutral');
PADS = [pad('Xbox Controller (XInput STANDARD GAMEPAD)', 'standard', [14], [0, 0, 0, 0])]; readPad(0);
SOCD.mode = 'last'; PADS = [pad('Xbox Controller (XInput STANDARD GAMEPAD)', 'standard', [14, 15], [0, 0, 0, 0])]; i = readPad(0); ok(i.lx === 1, 'left then right: last one wins');
SOCD.mode = 'neutral';
const cs = SETUPS.find(s => s.id === 'pad-c1'); cs.map[5] = 'mod'; USE.pad0 = 'pad-c1';
PADS = [pad('Xbox Controller (XInput STANDARD GAMEPAD)', 'standard', [5, 15], [0, 0, 0, 0])]; i = readPad(0); ok(i.lx === 0.5, 'half-stick button: D-pad right goes half way');
delete USE.pad0; cs.map[5] = cs.base[5];

// the Options panel's Controllers box: the keyboard, each controller, the adapter, then Done; A on a controller opens its controls
PADS = [pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [], [0, 0, 0, 0]), null, pad(DS, 'standard', [], [0, 0, 0, 0])];
const OR = optLayout().rows.map(r => r.kind + (r.dev ? ':' + r.dev : ''));
ok(OR.join() === 'stocks,stage,dev:kb,dev:pad0,dev:pad2,gcu,done', 'Options: ' + OR.join(' '));
optPick(optLayout().rows[3], 'kb'); ok(CMENU && CMENU.dev === 'pad0' && CMENU.via === 'kb', 'Options: a controller row opens its controls screen, worked by the keyboard too'); CMENU = null;
console.log(bad ? bad + ' failures' : 'all controller checks pass');
if (bad) process.exitCode = 1;
