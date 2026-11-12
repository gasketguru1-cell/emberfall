/* Knell's dagger against his hitboxes, measured in the running game (the 3D model as drawn), like tools/blade-check.js for Brand.
   In a browser tab on http://localhost:<port>/dev/ open the console and run:
     await import('/dev/tools/knell-check.js'); await KNELL_CHECK()          every blade contact (assets/knell/work/contacts.json)
     await KNELL_CHECK(['fsmash'])                                           some moves
   For each move and frame that tools/blender/knell/anim.js keyed onto a hit capsule it plays the move up to that frame and reports
   how far the drawn dagger point is from the point it was aimed at (cm on the model), and the blade's angle against the
   capsule's. Starts a Knell-against-Flint match and steps it by hand; changes nothing else. */
const AIR = new Set(['nair', 'fair', 'fairL', 'fairH', 'bair', 'uair', 'dair']);
function setup() {
  const G = window.__game, KI = ROSTER.findIndex(d => d.name === 'Knell');
  G.slots[0] = { dev: 'kb', pick: KI, ready: true }; G.slots[1] = { dev: 'kb', pick: 0, ready: true };
  G.startMatch(); let g = 0; while (G.mode !== 'play' && g++ < 400) G.step();
  F[0].ctl = new Ctl('cpu'); F[1].ctl = new Ctl('cpu'); window.cpuInput = () => blankIn(); G.DBG.step = true;
}
function play(name, frame) {
  const air = AIR.has(name), b = F[0], o = F[1], hang = () => { if (air) { b.y = 30; b.vy = 0; b.grounded = false; } };
  b.x = 0; b.y = air ? 30 : 0; b.vx = b.vy = 0; b.face = 1; b.dmg = 0;
  if (air) { b.grounded = false; b.plat = null; b.set('air'); } else { b.grounded = true; b.plat = MAIN; b.set('idle'); }
  o.x = 60; o.y = 0; o.invuln = 999;
  for (let k = 0; k < 6; k++) { __game.step(); hang(); __game.draw(); }
  const v = /[LH]$/.test(name) && F[0].form.moves[name.slice(0, -1)] ? name.slice(-1) : '';   /* a low or high variant: held up or down as it starts */
  window.cpuInput = () => Object.assign(blankIn(), v ? { ly: v === 'H' ? 1 : -1, cy: v === 'H' ? 1 : -1 } : {});
  b.startMove(name); let n = 0; while (b.mf < frame && n++ < 200) { if (b.mname !== name) break; __game.step(); hang(); b.hitlag = 0; __game.draw(); }
  window.cpuInput = () => blankIn();
  return b.mname === name && b.mf === frame;
}
function blade() {
  const b = F[0], v = R3.fighters[0]; v.root.updateMatrixWorld(true); const V3 = v.obj.position.constructor;
  const m = R3.manifest ? R3.manifest.Knell : null, MPU = (m ? m.height : 12.89) / 1.835;
  const g = new V3().setFromMatrixPosition(v.obj.getObjectByName('sword').matrixWorld), t = new V3().setFromMatrixPosition(v.obj.getObjectByName('swordTip').matrixWorld);
  /* sim x and y relative to the fighter, in model metres; b.x moves during the move, so it is read on the same frame */
  return { g: [(g.x - b.x) / MPU * b.face, (g.y - b.y) / MPU], t: [(t.x - b.x) / MPU * b.face, (t.y - b.y) / MPU] };
}
window.KNELL_CHECK = async moves => {
  setup(); const C = await (await fetch('/dev/assets/knell/work/contacts.json', { cache: 'no-store' })).json(); const out = {};
  for (const c of C) {
    if (moves && !moves.includes(c.move)) continue;
    if (!play(c.move, c.frame)) { out[c.id] = 'did not reach that frame'; continue; }
    const B = blade(), want = c.tip, wg = c.grip;   /* where the point and grip should be drawn: forward and up from his feet, metres */
    const ang = Math.atan2(B.t[1] - B.g[1], B.t[0] - B.g[0]) * 180 / Math.PI, wa = Math.atan2(want[1] - wg[1], want[0] - wg[0]) * 180 / Math.PI;
    let da = ((ang - wa) % 360 + 540) % 360 - 180;
    out[c.id] = { miss: +(Math.hypot(want[0] - B.t[0], want[1] - B.t[1]) * 100).toFixed(1), angle: +da.toFixed(0) };
  }
  return out;
};
window.KNELL_SHOT = (name, frame, boxes) => { if (!F.length || __game.mode !== 'play') setup(); __game.DBG.boxes = !!boxes; play(name, frame); return name + ' frame ' + F[0].mf; };
