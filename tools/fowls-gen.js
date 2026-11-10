// Turns the owner's Furious Fowls move data (assets/fowls/source/move_data.json) into the table the game reads, and writes it
// into sim.js between the FOWL-DATA markers. Every frame count, damage, angle and knockback number is copied as given;
// hitbox shapes are read from the document's text into x, y and radius (in W for the slingshot, B for a lone bird).
//   node tools/fowls-gen.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), d = JSON.parse(fs.readFileSync(path.join(root, 'assets/fowls/source/move_data.json'), 'utf8'));
const num = s => +String(s).replace(/^\./, '0.').replace(/^-\./, '-0.').replace(/^\+/, '');
function geom(text) {
  if (!text) return null; const t = text.replace(/\s+/g, ' ');
  const r1 = /radius\s*=?\s*([.\d]+)/.exec(t), r2 = /radii\s*=?\s*([.\d]+)\s*\/\s*([.\d]+)/.exec(t), r = r2 ? (num(r2[1]) + num(r2[2])) / 2 : r1 ? num(r1[1]) : 0.25;
  const y = /y\s*=\s*([-+]?[.\d]+)/.exec(t), yy = y ? num(y[1]) : 0;
  const arc = /\(\s*([-.\d]+)\s*,\s*([-.\d]+)\s*\)\s*to\s*\(\s*([-.\d]+)\s*,\s*([-.\d]+)\s*\)/.exec(t);
  if (arc) return { x: num(arc[3]), y: num(arc[4]), r, in: [num(arc[1]), num(arc[2])] };
  const two = /x\s*=\s*\+-\s*([.\d]+)/.exec(t); if (two) return { x: num(two[1]), y: yy, r, rear: [-num(two[1]), yy, r] };
  const ranges = [...t.matchAll(/x\s*=\s*([-+]?[.\d]+)\s*\.\.\s*([-+]?[.\d]+)/g)].map(m => [num(m[1]), num(m[2])]);
  if (ranges.length === 2) { const f = ranges.find(q => q[1] > 0) || ranges[1], b = ranges.find(q => q[0] < 0) || ranges[0]; return { x: f[1], y: yy, r, in: [f[0], yy], rear: [b[0], yy, r] }; }
  if (ranges.length === 1) { const q = ranges[0], tip = Math.abs(q[0]) > Math.abs(q[1]) ? q[0] : q[1], inn = tip === q[0] ? q[1] : q[0]; return { x: tip, y: yy, r, in: [inn, yy] }; }
  const x = /x\s*=\s*([-+]?[.\d]+)/.exec(t); if (/ring/.test(t)) return { x: 0, y: 0, r };
  return { x: x ? num(x[1]) : 0, y: yy, r };
}
const mv = (m, key) => ({ s: m.startup_frames, a: m.active_frames, e: m.endlag_frames, d: m.damage_percent, ang: m.launch_angle_degrees, k: m.knockback_growth, b: m.base_knockback, g: geom(m[key]) });
const NAME = { Flint: 'Rusty' };   /* the game already has a fighter called Flint, so the russet bird is Rusty here */
const out = { combined: {}, solo: {}, forms: [], special: {}, upb: d.shared_up_b };
for (const m of d.combined_moves) out.combined[m.id] = mv(m, 'hitbox_W');
for (const m of d.solo_moves) out.solo[m.id] = mv(m, 'hitbox_bird_width_B');
const first = s => parseFloat(String(s));
for (const f of d.forms) { const nb = f.neutral_b, sb = f.side_b;
  out.forms.push({ name: NAME[f.bird] || f.bird, weight: f.weight, run: f.run_mult, air: f.air_mult, grav: f.gravity_mult,
    nb: { s: nb.startup, e: nb.endlag, d: first(nb.damage), v: String(nb.speed_W_per_tick).split(',').map(Number), life: nb.lifetime, ang: nb.angle },
    sb: { s: sb.startup, aim: sb.aim_max, d: first(sb.damage), v: sb.launch_speed_W_per_tick, ticks: sb.flight_ticks },
    fs: f.f_smash, nair: f.nair.damage, dash: f.dash.damage }); }
for (const k in d.solo_specials) out.special[NAME[k] || k] = d.solo_specials[k].map(q => ({ s: q.startup, a: q.active, e: q.endlag, d: q.damage }));
const file = path.join(root, 'sim.js'); let s = fs.readFileSync(file, 'utf8'); const crlf = s.includes('\r\n'); s = s.replace(/\r\n/g, '\n');
const A = '/* FOWL-DATA-BEGIN (written by tools/fowls-gen.js from the owner\'s move data; do not edit by hand) */', B = '/* FOWL-DATA-END */';
const a = s.indexOf(A), b = s.indexOf(B); if (a < 0 || b < 0) { console.error('markers not found in sim.js'); process.exit(1); }
s = s.slice(0, a) + A + '\nconst FOWL = ' + JSON.stringify(out) + ';\n' + s.slice(b); fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('wrote FOWL: ' + Object.keys(out.combined).length + ' slingshot moves, ' + Object.keys(out.solo).length + ' lone-bird moves, ' + out.forms.length + ' birds');
if (process.argv[2] === '-v') { for (const k in out.combined) console.log(k, JSON.stringify(out.combined[k].g)); for (const k in out.solo) console.log('solo', k, JSON.stringify(out.solo[k].g)); }
