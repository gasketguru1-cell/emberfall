/* Brand's sword against the document's capsules, measured in the running game (the 3D model as drawn).
   In a browser tab on http://localhost:<port>/dev/ open the console and run:
     await import('/dev/tools/blade-check.js'); await BLADE_CHECK()        every contact key
     await BLADE_CHECK(['dsmashR'])                                       some of them
   For each contact key written by tools/blender/brand.js (assets/brand/work/contacts.json) it plays the move frame by frame
   and reports how far the drawn point is from where it should be (in H, Flint's height), the blade's angle against the
   capsule's, and dg: how far the grip should move (H, forward and up). FIX_OUT() gives contact-fix.json with those added
   to the corrections already there; rebuild with bash tools/blender/build-brand.sh. Changes nothing in the game itself
   except that it starts a Brand-against-Flint match and steps it by hand. */
const HM = 14 / 7.5837;
const CT = { jab2: ['jab2', 5, 6], jab3: ['jab3', 7, 9], ftilt: ['ftilt', 7, 9], utiltA: ['utilt', 7, 8], utiltB: ['utilt', 9, 10], dtilt: ['dtilt', 6, 8], fsmash: ['fsmash', 16, 19], usmash: ['usmash', 15, 17], dsmashF: ['dsmash', 12, 13], dsmashR: ['dsmash', 17, 18],
  getupF: ['getup', 19, 20], getupR: ['getup', 24, 25], fair: ['fair', 7, 10, 1], bair: ['bair', 8, 10, 1], uair: ['uair', 6, 9, 1], dair: ['dair', 13, 15, 1], dairLate: ['dair', 16, 16, 1], ledgeatk: ['ledgeatk', 20, 22], nspec: ['nspec', 14, 16], nspecH: ['nspecH', 24, 26], uspec: ['uspec', 7, 9], dspec: ['dspec', 15, 17] };
function setup() {
  const G = window.__game, BI = ROSTER.findIndex(d => d.name === 'Brand');
  G.slots[0] = { dev: 'kb', pick: BI, ready: true }; G.slots[1] = { dev: 'kb', pick: 0, ready: true };
  G.startMatch(); let g = 0; while (G.mode !== 'play' && g++ < 400) G.step();
  F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); window.cpuInput = () => blankIn(); G.DBG.step = true;
}
/* Brand from standing (or hanging in the air) into a move, drawn every frame as in play, stopped on the given frame */
function play(name, frame, air) {
  const b = F[0], o = F[1], hang = () => { if (air) { b.y = 30; b.vy = 0; b.grounded = false; } };
  b.x = 0; b.y = air ? 30 : 0; b.vx = b.vy = 0; b.face = 1; if (air) { b.grounded = false; b.plat = null; b.set('air'); } else { b.grounded = true; b.plat = MAIN; b.set('idle'); }
  o.x = window.BLADE_OX || 40; o.y = 0; o.invuln = 999;
  for (let k = 0; k < 6; k++) { __game.step(); hang(); __game.draw(); }
  b.startMove(name); let n = 0; while (b.mf < frame && n++ < 200) { __game.step(); hang(); b.hitlag = 0; __game.draw(); }
}
function blade() {
  const b = F[0], v = R3.fighters[0]; v.root.updateMatrixWorld(true); const V3 = v.obj.position.constructor;
  const g = new V3().setFromMatrixPosition(v.obj.getObjectByName('sword').matrixWorld), t = new V3().setFromMatrixPosition(v.obj.getObjectByName('swordTip').matrixWorld);
  return { g: [(g.x - b.x) / 14, (g.y - b.y) / 14], t: [(t.x - b.x) / 14, (t.y - b.y) / 14] };
}
let last = {};
window.BLADE_CHECK = async ids => {
  window.BLADE_OX = 0; setup(); const C = await (await fetch('/dev/assets/brand/work/contacts.json', { cache: 'no-store' })).json(); const out = {}; last = {};
  for (const c of C) {
    const ct = CT[c.id]; if (!ct || (ids && !ids.includes(c.id))) continue; const rows = [];
    for (let f = ct[1]; f <= ct[2]; f++) { play(ct[0], f, ct[3]); const B = blade(); rows.push({ dg: [c.grip[0] - B.g[0], c.grip[1] - B.g[1]], miss: Math.hypot(c.tip[0] - B.t[0], c.tip[1] - B.t[1]), ang: Math.atan2(B.t[1] - B.g[1], B.t[0] - B.g[0]) * 180 / Math.PI, want: Math.atan2(c.tip[1] - c.grip[1], c.tip[0] - c.grip[0]) * 180 / Math.PI }); }
    const dg = [0, 1].map(i => +(rows.reduce((s, r) => s + r.dg[i], 0) / rows.length).toFixed(3)); last[c.id] = dg;
    out[c.id] = { miss: +Math.max(...rows.map(r => r.miss)).toFixed(2), dg, angle: rows.map(r => r.ang.toFixed(0) + ' (' + r.want.toFixed(0) + ')').join(', ') };
  }
  return out;
};
window.FIX_OUT = async () => {
  let fix = {}; try { fix = await (await fetch('/dev/assets/brand/work/contact-fix.json', { cache: 'no-store' })).json(); } catch (e) {}
  for (const k in last) { const f = fix[k] || [0, 0]; fix[k] = [+(f[0] + last[k][0] * HM).toFixed(3), +(f[1] + last[k][1] * HM).toFixed(3)].concat(f.slice(2));   /* the hand; any hip numbers are kept */ }
  return JSON.stringify(fix);
};
/* a still for looking at: BLADE_SHOT('utilt', 10) stops Brand on frame 10 of the move, Flint close by so the camera is near */
window.BLADE_SHOT = (name, frame, air, boxes) => {
  if (!F.length || __game.mode !== 'play') setup(); __game.DBG.boxes = !!boxes; window.BLADE_OX = 18;
  play(name, frame, air); return name + ' frame ' + F[0].mf;
};
