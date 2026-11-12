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
ok(padCap('A') === '✕' && padCap('B') === '○' && padCap('ZR') === 'R2' && padCap('+') === 'Options', 'button names: ✕ ○ R2 Options');

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
i = readPad(0); ok(i.spc && i.sel && !i.atk && devName('pad0') === 'Controller 1' && padCap('A') === 'A', 'Xbox pad: unchanged, letters on screen');
console.log(bad ? bad + ' failures' : 'all PlayStation checks pass');
if (bad) process.exitCode = 1;
