// Brand's swordsman rework, batches 2-8 (plans/brand-animation-plan.md section 9): ground attacks, aerials, specials,
// defence and hit reactions, grabs and throws, the ledge, taunt, victories and entrance. Loaded by brand2.js before its
// post-passes (grips to wrists, collarbones, cape lean, feet, spine split), with its helpers.
// Timing: assets/brand/reference/framedata.json (Melee Marth frame numbers, the owner's timing reference): every strike is
// keyed so the blade's biggest step lands on the move's first active frame, and the move's total and IASA are kept. The
// poses and curves are Brand's own.
module.exports = X => {
  const { C, P, F, R, M, RM, HR, HL, SW, FOOT, FR, FL, CAPE, CL, G, AIR, IDLEARM, POMMEL, HOLDL, FREEL, FIST, WRISTR, ROW } = X;
  const K = (f, pose, o) => Object.assign({ t: F(f), pose: pose || {}, lag: CL }, o || {});
  const START = (pose) => ({ t: F(1), reset: true, use: G, pose: Object.assign({}, IDLEARM, pose || {}) });
  const END = (f, o) => Object.assign({ t: F(f), reset: true, use: G, pose: IDLEARM, lag: CL }, o || {});
  const AEND = (f, o) => Object.assign({ t: F(f), reset: true, use: AIR, lag: CL }, o || {});
  /* two hands on the sword: the right fist's grip and the blade's direction (y up, z forward, x his left) */
  const TWO = (z, y, x, sy, sz, sx, extra) => Object.assign({ c_handR: HR(z, y, x), c_sword: SW(sy, sz, sx), c_handL: POMMEL(), ...HOLDL }, extra || {});
  const ONE = (z, y, x, sy, sz, sx, extra) => Object.assign({ c_handR: HR(z, y, x), c_sword: SW(sy, sz, sx) }, extra || {});
  const LET = (z, y, x) => Object.assign({}, FREEL, { c_handL: HL(z, y, x) });
  /* turns of the whole body about a centre (default his middle), the way rig.py builds them (yaw after pitch), keeping that
     centre where it is: for somersaults, tumbles and lying down */
  const qm = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  const qa = (ax, deg) => { const h = deg * Math.PI / 360, q = [Math.cos(h), 0, 0, 0]; q[ax + 1] = Math.sin(h); return q; };
  const qr = (q, v) => qm(qm(q, [0, ...v]), [q[0], -q[1], -q[2], -q[3]]).slice(1);
  const turn = (p, y, r, at, to) => { at = at || [0, 0.8, 0]; to = to || at;
    const c = qr(qm(qm(qa(1, y || 0), qa(0, p || 0)), qa(2, r || 0)), at);
    return { all: RM(p || 0, y || 0, r || 0, to[0] - c[0], to[1] - c[1], to[2] - c[2]) }; };
  const STAND = { c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.17, 0, 0.04) };
  /* a turned body (pitch p, yaw y about local point `at`, put at world point `to`) and its controls placed at WORLD points:
     feet that stay planted while the body pivots over them, a hand flat on the floor while he sits up. Points are [x, y, z]
     (x his left, y up, z forward); w2l takes a world point into the turned body's own frame */
  const ANKL = { R: [-0.235, 0.1, -0.02], L: [0.25, 0.1, -0.02] };
  const FRAME = (p, y, at, to) => {
    const q = qm(qa(1, y || 0), qa(0, p || 0)), qi = [q[0], -q[1], -q[2], -q[3]];
    const w2l = w => qr(qi, w.map((v, i) => v - to[i])).map((v, i) => v + at[i]);
    return { all: turn(p, y, 0, at, to).all,
      foot: (sd, w, pitch) => { const l = w2l(w); return { ['c_foot' + sd]: FR(l[2] - ANKL[sd][2], l[1] - ANKL[sd][1], l[0] - ANKL[sd][0], pitch) }; },
      handL: w => { const l = w2l(w); return { c_handL: HL(l[2], l[1], l[0]) }; },
      grip: w => { const l = w2l(w); return { c_handR: HR(l[2], l[1], l[0]) }; } };
  };

  /* ================= batch 2: ground attacks ================= */

  /* Jab 1: 27 frames, hit 4-7, the second jab can follow from 20. A rising cut from a drawn-back arm: the right shoulder
     turns away and the sword hand swings back past his hip (blade trailing behind, the left hand coming forward to balance),
     then the chest whips round and the hand comes up and forward, the blade rising from low in front to over his head. */
  C.Jab1 = { fps: 60, keys: [
    START(),
    K(2, { hips: RM(4, 6, 0, 0, -0.1, -0.01), spine: R(3, -4), chest: R(4, -16), head: R(-4, -12), ...ONE(0.0, 0.95, -0.32, -0.7, -0.7), c_handL: HL(0.26, 1.06, 0.2), c_footR: FR(0.22, 0.06, 0.02), ...CAPE(4, 2) }),
    K(3, { hips: RM(6, -12, 0, 0, -0.13, -0.03), spine: R(4, -8), chest: R(4, -30), head: R(-4, 22), ...ONE(-0.5, 1.2, -0.3, 0.35, -0.94), c_handL: HL(0.36, 1.16, 0.24), c_footR: FR(0.25, 0.09, 0.02), ...CAPE(6, 3) }),
    K(4, { hips: RM(6, 20, 0, 0, -0.11, 0.06), spine: R(4, 0), chest: R(6, 12), head: R(-4, -30), ...ONE(0.36, 0.96, -0.26, -0.18, 0.98), c_handL: HL(0.18, 1.02, 0.18), c_footR: FR(0.28, 0, 0.02) }, { in: 'snap' }),
    K(5, { chest: R(4, -4), ...ONE(0.46, 1.1, -0.22, 0.32, 0.95) }),
    K(6, { chest: R(2, -10), ...ONE(0.44, 1.25, -0.2, 0.7, 0.71), ...CAPE(10, 4) }),
    K(7, { chest: R(0, -14), head: R(-8, -26), ...ONE(0.38, 1.35, -0.21, 0.9, 0.42) }),
    K(10, { ...ONE(0.34, 1.36, -0.22, 0.95, 0.3) }, { in: 'out' }),
    K(20, { hips: RM(4, 22, 0, 0, -0.09, 0.04), chest: R(3, -6), ...ONE(0.33, 1.3, -0.23, 0.9, 0.42) }),
    K(24, { hips: RM(2, 24, 0, 0, -0.08, 0.01), chest: R(4, 6), ...ONE(0.24, 0.98, -0.2, -0.2, 0.98), c_footR: FR(0.2, 0.08, 0.02) }),
    END(27)] };

  /* Jab 2: 28 frames, hit 5-9. From the first jab's raised blade: it cocks a little higher, then cuts down and across in front
     (from over his head to low on his left), the hips turning into it. */
  C.Jab2 = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: { hips: RM(4, 22, 0, 0, -0.09, 0.04), chest: R(3, -6), ...ONE(0.33, 1.3, -0.23, 0.9, 0.42), c_footR: FR(0.28, 0, 0.02) } },
    K(3, { chest: R(-2, 6), ...ONE(0.24, 1.46, -0.24, 0.92, -0.38), head: R(-6, -30) }),
    K(4, { ...ONE(0.3, 1.5, -0.22, 0.98, 0.05) }),
    K(5, { hips: RM(6, 10, 0, 0, -0.12, 0.08), chest: R(8, -12), ...ONE(0.46, 1.36, -0.16, 0.45, 0.89) }, { in: 'snap' }),
    K(6, { chest: R(12, -22), ...ONE(0.5, 1.12, -0.08, -0.15, 0.93, 0.33) }),
    K(7, { chest: R(14, -30), ...ONE(0.44, 0.95, 0.02, -0.55, 0.62, 0.56) }),
    K(9, { chest: R(14, -34), head: R(-14, -20), ...ONE(0.36, 0.86, 0.06, -0.72, 0.2, 0.66), ...CAPE(12, 5) }, { in: 'out' }),
    K(16, { hips: RM(4, 14, 0, 0, -0.1, 0.06), chest: R(10, -28), ...ONE(0.34, 0.88, 0.04, -0.7, 0.25, 0.66) }),
    K(23, { hips: RM(2, 22, 0, 0, -0.08, 0.02), chest: R(5, 4), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), c_footR: FR(0.16, 0, 0.02) }),
    END(28)] };

  /* Forward tilt: 35 frames, hit 7-10. A stepping rising cut: the blade drawn low behind his hip, then a long step in as it
     sweeps up from low in front to over his head; the reach is at shoulder height on 8-9. */
  C.TiltF = { fps: 60, keys: [
    START(),
    K(4, { hips: RM(6, 30, 0, 0, -0.16, -0.02), spine: R(6), chest: R(6, 30), head: R(-4, -36), ...ONE(-0.02, 0.86, -0.34, -0.55, -0.83), c_handL: HL(0.25, 1.0, 0.18), c_footR: FR(0.2, 0.05, 0.02) }),
    K(6, { hips: RM(8, 26, 0, 0, -0.18, 0.06), chest: R(8, 24), ...ONE(0.16, 0.76, -0.3, -0.9, -0.42), c_footR: FR(0.42, 0.06, 0.02) }),
    K(7, { hips: RM(10, 18, 0, 0, -0.2, 0.14), chest: R(8, 8), ...ONE(0.5, 0.86, -0.22, -0.3, 0.95), c_footR: FR(0.5, 0, 0.02) }, { in: 'snap' }),
    K(8, { chest: R(6, -6), ...ONE(0.6, 1.08, -0.18, 0.25, 0.97) }),
    K(9, { chest: R(2, -14), ...ONE(0.54, 1.34, -0.18, 0.72, 0.69), ...CAPE(14, 5) }),
    K(10, { chest: R(-2, -18), head: R(-10, -28), ...ONE(0.42, 1.5, -0.2, 0.97, 0.25) }),
    K(13, { ...ONE(0.34, 1.54, -0.22, 0.97, -0.2) }, { in: 'out' }),
    K(24, { hips: RM(6, 20, 0, 0, -0.17, 0.12), chest: R(2, -12), ...ONE(0.36, 1.46, -0.22, 0.94, -0.1) }),
    K(30, { hips: RM(2, 24, 0, 0, -0.1, 0.03), chest: R(4, 6), ...ONE(0.24, 0.98, -0.2, -0.2, 0.98), c_footR: FR(0.16, 0, 0.02) }),
    END(35)] };

  /* Up tilt: 39 frames, hits 6-8 and 9-12, IASA 32. An arc over his head from in front to behind, low on his legs: the blade
     sweeps up past his face (6), over the top (8) and down behind him (12), the chest arching back under it. */
  C.TiltU = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(6, 20, 0, 0, -0.16, 0), spine: R(8), chest: R(6, 10), head: R(-8, -30), ...ONE(0.34, 0.86, -0.24, -0.35, 0.94), c_handL: HL(0.15, 0.95, 0.2) }),
    K(5, { ...ONE(0.42, 1.02, -0.22, 0.15, 0.99) }),
    K(6, { hips: RM(0, 20, 0, 0, -0.12, 0), spine: R(0), chest: R(-4, 6), head: R(4, -28), ...ONE(0.36, 1.34, -0.2, 0.72, 0.69) }, { in: 'snap' }),
    K(7, { chest: R(-8, 4), ...ONE(0.2, 1.6, -0.2, 0.99, 0.12) }),
    K(8, { chest: R(-12, 2), head: R(10, -26), ...ONE(0.04, 1.68, -0.22, 0.8, -0.6) }),
    K(9, { chest: R(-16, 0), ...ONE(-0.08, 1.62, -0.24, 0.42, -0.9), ...CAPE(2, 0) }),
    K(10, { ...ONE(-0.14, 1.52, -0.26, 0.05, -1) }),
    K(12, { chest: R(-14, 2), ...ONE(-0.16, 1.4, -0.27, -0.42, -0.9) }, { in: 'out' }),
    K(22, { hips: RM(2, 22, 0, 0, -0.1, 0), chest: R(-6, 6), ...ONE(-0.08, 1.36, -0.28, -0.3, -0.95) }),
    K(32, { hips: RM(1, 24, 0, 0, -0.08, 0), chest: R(4, 10), head: R(0, -32), ...ONE(0.2, 0.9, -0.2, -0.55, 0.83) }),
    END(39)] };

  /* Down tilt: 49 frames, hit 7-9, IASA 20. From the crouch, a long low thrust along the floor: the hand drawn back by his
     knee, then driven straight out with the body behind it; the clip ends back in the crouch (the game holds the crouch). */
  C.TiltD = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'crouch'] },
    K(4, { hips: RM(30, 22, 0, 0, -0.54, -0.06), chest: R(8, 14), ...ONE(0.2, 0.32, -0.16, -0.06, 1), c_handL: HL(0.2, 0.4, 0.22) }),
    K(6, { ...ONE(0.3, 0.3, -0.14, -0.05, 1) }),
    K(7, { hips: RM(36, 18, 0, 0, -0.56, 0.08), chest: R(12, -2), head: R(-46, -26), ...ONE(0.78, 0.26, -0.1, -0.05, 1), ...CAPE(14, 5) }, { in: 'snap' }),
    K(9, { ...ONE(0.8, 0.26, -0.1, -0.05, 1) }, { in: 'out' }),
    K(14, { hips: RM(34, 24, 0, 0, -0.54, -0.02), chest: R(10, 8), ...ONE(0.5, 0.3, -0.06, -0.04, 1) }),
    { t: F(20), reset: true, use: [...G, 'crouch'], lag: CL },
    { t: F(49), reset: true, use: [...G, 'crouch'] }] };

  /* Dash attack: 49 frames, hit 12-15, IASA 40. Out of the run: he dips low with the blade trailing behind, then lunges with
     a big rising cut, the blade coming up from low in front to over his head (12-15); he skids to a stop and rises. */
  C.DashAttack = { fps: 60, keys: [
    { t: F(1), reset: true, use: 'rest', pose: { hips: RM(26, 0, 0, 0, -0.36, 0.04), spine: R(20), chest: R(10, 0), head: R(-52, 0), ...ONE(0.1, 0.65, -0.26, -0.15, -1), c_handL: HL(0.15, 0.9, 0.18), c_footR: FOOT('R', 0.05, 0.12, 35), c_footL: FOOT('L', -0.5, 0.22, 90), ...CAPE(55, 10) } },
    K(5, { hips: RM(24, 10, 0, 0, -0.46, 0.0), chest: R(10, 20), head: R(-40, -14), ...ONE(-0.08, 0.66, -0.32, -0.45, -0.89), c_handL: HL(0.32, 0.86, 0.2), c_footR: FOOT('R', 0.3, 0.1, 0), c_footL: FOOT('L', -0.45, 0.14, 70) }),
    K(9, { hips: RM(22, 14, 0, 0, -0.5, 0.14), chest: R(12, 24), ...ONE(0.0, 0.6, -0.32, -0.85, -0.5), c_footR: FOOT('R', 0.55, 0.1, 0), c_footL: FOOT('L', -0.4, 0.12, 60) }),
    K(11, { hips: RM(18, 14, 0, 0, -0.5, 0.2), chest: R(10, 14), ...ONE(0.3, 0.56, -0.28, -0.75, 0.66) }),
    K(12, { chest: R(4, 2), head: R(-24, -20), ...ONE(0.58, 0.82, -0.22, -0.1, 0.99) }, { in: 'snap' }),
    K(13, { hips: RM(12, 16, 0, 0, -0.44, 0.22), chest: R(-2, -8), ...ONE(0.56, 1.14, -0.2, 0.6, 0.8), ...CAPE(30, 10) }),
    K(14, { chest: R(-6, -14), ...ONE(0.44, 1.42, -0.2, 0.93, 0.36) }),
    K(15, { chest: R(-8, -16), head: R(-6, -24), ...ONE(0.34, 1.56, -0.22, 0.99, -0.12) }, { in: 'out' }),
    K(26, { hips: RM(10, 18, 0, 0, -0.38, 0.2), chest: R(-2, -10), ...ONE(0.32, 1.52, -0.22, 0.96, -0.2), ...CAPE(8, 2) }),
    K(34, { hips: RM(4, 22, 0, 0, -0.18, 0.08), chest: R(4, 4), ...ONE(0.26, 1.0, -0.22, -0.1, 0.99), c_handL: HL(0.15, 1.0, 0.17), c_footR: FR(0.24, 0, 0.02), c_footL: FL(-0.17, 0, 0.04) }),
    END(40), END(49)] };

  /* Up smash: 54 frames, hit 13-16, charge held on 8, IASA 46. Both hands. He steps in with the right foot and spreads the
     left back into a wide low base, folding forward over the sword held upright at his chest (head down, coiled), holds
     there while charged and sinks a little deeper; then everything opens at once: hips and chest snap from bent forward to
     arched back, he rises onto both toes and drives the point high above his head, looking up after it. He settles, then
     brings the feet back in step by step. */
  C.SmashU = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(4, 15, 0, 0, -0.12, 0.02), chest: R(4, 0), head: R(-4, -22), ...ONE(0.24, 0.94, -0.18, 0.5, 0.86, 0.05), ...LET(0.2, 0.9, 0.0), c_footR: FR(0.24, 0.08, 0.03) }),
    K(5, { hips: RM(10, 8, 0, 0, -0.24, 0.05), spine: R(8), chest: R(8, -6), head: R(-10, -18), c_footR: FR(0.32, 0, 0.04), c_footL: FL(-0.24, 0.08, 0.06) }),
    K(8, { hips: RM(18, 2, 0, 0, -0.38, 0.04), spine: R(12), chest: R(14, -10), head: R(-18, -14), ...TWO(0.3, 0.82, -0.04, 0.99, 0.12, 0.05), c_footL: FL(-0.32, 0, 0.08), ...CAPE(8, 3) }),
    K(12, { hips: RM(21, 2, 0, 0, -0.42, 0.04), spine: R(14), chest: R(16, -12), head: R(-14, -14), ...TWO(0.3, 0.8, -0.04, 1, 0.08, 0.04) }),
    K(13, { hips: RM(-6, 5, 0, 0, -0.02, 0.06), spine: R(-6), chest: R(-10, -4), head: R(20, -10), ...TWO(0.16, 1.62, -0.08, 1, 0.04, 0.02), c_footR: FOOT('R', 0.3, 0.16, 45, -0.2), c_footL: FOOT('L', -0.3, 0.16, 45, 0.31), ...CAPE(-6, 0) }, { in: 'snap' }),
    K(14, { hips: RM(-10, 5, 0, 0, 0.02, 0.06), spine: R(-8), chest: R(-14, -2), head: R(24, -8), ...TWO(0.14, 1.82, -0.06, 1, 0.02, 0.0) }),
    K(16, { chest: R(-15, -2), ...TWO(0.13, 1.86, -0.06, 1, 0.02, 0.0) }, { in: 'out' }),
    K(28, { hips: RM(-6, 6, 0, 0, 0.0, 0.05), spine: R(-6), chest: R(-10, -2), head: R(18, -10), ...TWO(0.13, 1.82, -0.06, 1, 0.03, 0.0), ...CAPE(2, 1) }),
    K(34, { hips: RM(8, 16, 0, 0, -0.22, 0.04), spine: R(6), chest: R(6, 4), head: R(-6, -26), ...ONE(0.24, 1.2, -0.24, 0.6, 0.8), ...LET(0.15, 1.0, 0.18), c_footR: FR(0.32, 0, 0.04), c_footL: FL(-0.32, 0, 0.08) }),
    K(39, { hips: RM(5, 20, 0, 0, -0.16, 0.04), c_footL: FL(-0.25, 0.08, 0.06) }),
    K(43, { hips: RM(3, 22, 0, 0, -0.12, 0.02), chest: R(4, 8), ...ONE(0.22, 1.0, -0.22, -0.2, 0.98), c_footL: FL(-0.17, 0, 0.04), c_footR: FR(0.24, 0.08, 0.03) }),
    K(47, { hips: RM(1, 24, 0, 0, -0.08, 0), chest: R(4, 10), ...ONE(0.2, 0.9, -0.2, -0.5, 0.86), c_footR: FR(0.16, 0, 0.02) }),
    END(54)] };

  /* Down smash: 64 frames, hits 5-7 (in front) and 20-22 (behind), charge on 4, IASA 62. Low on a long narrow base (right
     foot ahead, left behind, nearly in line), the blade sweeps flat along the floor in front of him from his right to his
     left. The sweep's swing carries him round: he pivots on the balls of both feet (they stay where they are and turn under
     him) through a half turn toward his left, so the feet end swapped (right now behind him), rewinds, and sweeps the floor
     behind him the same way, now facing it. Then he pivots back the way he came and steps the feet back to his stance. */
  {
    /* Footwork: a wide, low, square-hipped stance, right foot leading. To face behind him he turns in two clear steps with
       his weight kept low between them: the left foot steps across to square him up side-on, then the right foot steps
       round so the left now leads the other way, and the sweep goes out behind. On the way back the same two steps in
       reverse, and he settles into his stance. The body only shifts toward or away from the camera while he turns. */
    const MID = [0, 0, -0.02], LIFT = 0.28;
    const AR = [-0.24, 0.1, 0.26], AL = [0.24, 0.1, -0.26], QL = [-0.24, 0.1, -0.26], BR = [0.24, 0.1, 0.26];
    const UP = (a, b) => [(a[0] + b[0]) / 2, LIFT, (a[2] + b[2]) / 2];
    const ST = (y, cx, r, l) => { const fr = FRAME(0, y, MID, [cx, 0, -0.02]); return { all: fr.all, ...fr.foot('R', r), ...fr.foot('L', l) }; };
    C.SmashD = { fps: 60, keys: [
      START(),
      K(2, { c_footR: FOOT('R', 0.2, 0.2, 0, -0.24), c_footL: FOOT('L', -0.2, 0.18, 0, 0.27) }),
      K(3, { ...ST(0, 0, AR, AL), hips: RM(16, 10, 0, 0, -0.34, 0), spine: R(10), chest: R(10, 30), head: R(-20, -26), ...ONE(0.1, 0.52, -0.44, -0.2, 0.3, -0.93), c_handL: HL(0.25, 0.7, 0.3) }),
      K(4, { hips: RM(18, 10, 0, 0, -0.3, 0), chest: R(12, 36), ...ONE(0.08, 0.7, -0.46, -0.45, 0.18, -0.85) }),
      K(5, { chest: R(14, 10), head: R(-24, -22), ...ONE(0.46, 0.58, -0.24, -0.45, 0.88, -0.07) }, { in: 'snap' }),
      K(6, { chest: R(14, -12), ...ONE(0.44, 0.58, 0.04, -0.45, 0.59, 0.66) }),
      K(7, { chest: R(14, -26), ...ONE(0.3, 0.58, 0.2, -0.45, 0.09, 0.88), ...CAPE(16, 6) }, { in: 'out' }),
      K(9, { ...ST(0, 0, AR, AL), chest: R(14, -30), head: R(-18, 0), ...ONE(0.24, 0.6, 0.26, -0.45, 0, 0.89) }),
      K(11, { ...ST(45, -0.12, AR, UP(AL, QL)), hips: RM(16, 10, 0, 0, -0.3, 0), head: R(-16, 10) }),
      K(13, { ...ST(90, -0.24, AR, QL), hips: RM(14, 10, 0, 0, -0.28, 0), chest: R(12, -4), head: R(-14, -6), ...ONE(0.16, 0.66, -0.2, -0.45, 0.4, -0.8), c_handL: HL(0.2, 0.76, 0.3) }),
      K(15, { ...ST(135, -0.12, UP(AR, BR), QL), hips: RM(16, 10, 0, 0, -0.3, 0), chest: R(12, 26), head: R(-20, -24), ...ONE(0.08, 0.66, -0.46, -0.45, 0.18, -0.85), c_handL: HL(0.25, 0.7, 0.3) }),
      K(17, { ...ST(170, 0, BR, QL), hips: RM(18, 10, 0, 0, -0.34, 0), chest: R(12, 36), ...ONE(0.08, 0.7, -0.46, -0.45, 0.18, -0.85) }),
      K(19, { chest: R(12, 38), ...ONE(0.07, 0.7, -0.47, -0.45, 0.16, -0.86) }),
      K(20, { chest: R(14, 10), head: R(-24, -22), ...ONE(0.46, 0.58, -0.24, -0.45, 0.88, -0.07) }, { in: 'snap' }),
      K(21, { chest: R(14, -12), ...ONE(0.44, 0.58, 0.04, -0.45, 0.59, 0.66) }),
      K(22, { chest: R(14, -26), ...ONE(0.3, 0.58, 0.2, -0.45, 0.09, 0.88), ...CAPE(24, 8, 10) }, { in: 'out' }),
      K(36, { ...ST(170, 0, BR, QL), hips: RM(16, 10, 0, 0, -0.32, 0), chest: R(12, -22), ...ONE(0.26, 0.62, 0.18, -0.45, 0.1, 0.88) }),
      K(39, { ...ST(135, -0.12, UP(BR, AR), QL) }),
      K(42, { ...ST(90, -0.24, AR, QL), hips: RM(12, 15, 0, 0, -0.24, 0), chest: R(8, 0), head: R(-12, -24), ...ONE(0.12, 0.8, -0.3, -0.6, 0.8), c_handL: HL(0.15, 0.92, 0.2) }),
      K(45, { ...ST(45, -0.12, AR, UP(QL, AL)) }),
      K(48, { ...ST(0, 0, AR, AL), hips: RM(8, 20, 0, 0, -0.2, 0), chest: R(6, 6), head: R(-8, -28) }),
      K(51, { c_footR: FOOT('R', 0.2, 0.22, 0, -0.23) }),
      K(54, { c_footR: FR(0.16, 0, 0.02), hips: RM(5, 22, 0, 0, -0.14, 0) }),
      K(56, { c_footL: FOOT('L', -0.22, 0.2, 0, 0.28) }),
      K(58, { c_footL: FL(-0.17, 0, 0.04), hips: RM(3, 24, 0, 0, -0.1, 0) }),
      K(60, { ...STAND }),
      END(62), END(64)] };
  }

  /* ================= batch 3: aerials ================= */

  /* Back air: 39 frames, hit 7-11, the game turns him round on 32. He looks back over his right shoulder and cuts from over
     his head down behind him (7-11), the chest twisting after it; then the whole body comes round to face the way he was
     cutting, and on 32 (when the game turns him) he is the air pose again, facing the new way. */
  C.AirB = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: { all: R(0, 0) } },
    K(4, { chest: R(-4, -30), head: R(-6, 30), ...ONE(0.06, 1.5, -0.3, 0.85, 0.52), c_handL: HL(0.25, 1.08, 0.24), c_footR: FOOT('R', 0.14, 0.36, 40, -0.18), c_footL: FOOT('L', -0.1, 0.3, 50, 0.18) }),
    K(6, { chest: R(-6, -50), head: R(-4, 50), ...ONE(-0.12, 1.66, -0.3, 0.95, -0.3) }),
    K(7, { chest: R(-6, -58), ...ONE(-0.3, 1.56, -0.3, 0.6, -0.8) }, { in: 'snap' }),
    K(8, { chest: R(-4, -62), ...ONE(-0.42, 1.34, -0.3, 0.05, -1) }),
    K(9, { ...ONE(-0.42, 1.1, -0.3, -0.5, -0.87), ...CAPE(30, 10) }),
    K(11, { chest: R(0, -60), ...ONE(-0.34, 0.92, -0.3, -0.85, -0.5) }, { in: 'out' }),
    K(14, { all: R(0, 0), ...ONE(-0.3, 0.92, -0.3, -0.88, -0.45) }),
    K(20, { all: R(0, -60), chest: R(0, -40), head: R(-4, 10) }),
    K(26, { all: R(0, -140), chest: R(2, -10), head: R(-4, -10), ...ONE(-0.0, 1.0, -0.3, -0.2, 0.98) }),
    { t: F(31), reset: true, use: AIR, pose: { all: R(0, -180) }, lag: CL },
    { t: F(32), reset: true, use: AIR, pose: { all: R(0, 0) }, in: 'hold' },
    AEND(39)] };

  /* Up air: 45 frames, hit 5-8. A flip of the blade over his head from in front to behind, his body arching back under it
     and the legs kicking up in front. */
  C.AirU = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR },
    K(3, { hips: RM(4, 15, 0, 0, 0, 0), ...ONE(0.36, 1.02, -0.26, -0.15, 0.99), c_footR: FOOT('R', 0.16, 0.36, 40, -0.18) }),
    K(5, { hips: RM(-10, 15, 0, 0, 0, 0), spine: R(-6), chest: R(-8, 6), head: R(14, -20), ...ONE(0.34, 1.46, -0.22, 0.75, 0.66), c_footR: FOOT('R', 0.32, 0.5, 20, -0.18), c_footL: FOOT('L', 0.06, 0.36, 40, 0.18) }, { in: 'snap' }),
    K(6, { ...ONE(0.18, 1.78, -0.22, 1, 0.08) }),
    K(7, { chest: R(-14, 4), head: R(20, -20), ...ONE(0.0, 1.84, -0.24, 0.75, -0.66), ...CAPE(4, 0) }),
    K(8, { ...ONE(-0.14, 1.7, -0.26, 0.2, -0.98) }, { in: 'out' }),
    K(12, { hips: RM(-8, 15, 0, 0, 0, 0), ...ONE(-0.14, 1.52, -0.27, -0.3, -0.95) }),
    K(24, { hips: RM(4, 15, 0, 0, 0, 0), spine: R(6), chest: R(0, 5), head: R(-2, -20), ...ONE(0.12, 1.1, -0.3, -0.6, 0.8), c_footR: FOOT('R', 0.14, 0.32, 40, -0.18), c_footL: FOOT('L', -0.08, 0.24, 50, 0.18), ...CAPE(14, 6) }),
    AEND(34), AEND(45)] };

  /* Down air: 59 frames, hit 6-9 (it spikes). Both hands, a heavy arc down in front of him from over his head to under his
     feet. He arches back with the sword raised, then folds hard over it: hips, back and chest all bend forward until his
     chest is nearly level, the head drops to look straight down past his feet at where the blade is going, and the knees
     tuck up out of its way. He stays folded low while the blade hangs under him, then slowly straightens. */
  C.AirD = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR },
    K(4, { hips: RM(-6, 15, 0, 0, 0, 0), spine: R(-4), chest: R(-8, 0), head: R(6, -16), ...TWO(0.14, 1.66, -0.12, 0.85, -0.52, 0), c_footR: FOOT('R', 0.04, 0.24, 50, -0.18), c_footL: FOOT('L', -0.16, 0.2, 60, 0.18) }),
    K(5, { ...TWO(0.26, 1.72, -0.1, 0.95, 0.3, 0) }),
    K(6, { hips: RM(14, 15, 0, 0, 0, 0), spine: R(12), chest: R(14, 0), head: R(-30, -12), ...TWO(0.46, 1.4, -0.08, 0.3, 0.95, 0) }, { in: 'snap' }),
    K(7, { hips: RM(26, 15, 0, 0, -0.02, 0), spine: R(18), chest: R(22, 0), head: R(-44, -6), ...TWO(0.5, 1.0, -0.08, -0.55, 0.83, 0), c_footR: FOOT('R', 0.06, 0.4, 50, -0.18), c_footL: FOOT('L', -0.12, 0.36, 60, 0.18) }),
    K(8, { hips: RM(32, 15, 0, 0, -0.04, 0), spine: R(22), chest: R(26, 0), head: R(-52, -2), ...TWO(0.42, 0.74, -0.08, -0.95, 0.3, 0), c_footR: FOOT('R', 0.02, 0.52, 55, -0.18), c_footL: FOOT('L', -0.14, 0.48, 65, 0.18), ...CAPE(34, 14) }),
    K(9, { head: R(-54, 0), ...TWO(0.34, 0.76, -0.08, -0.98, -0.18, 0) }, { in: 'out' }),
    K(20, { hips: RM(28, 15, 0, 0, -0.03, 0), spine: R(20), chest: R(22, 0), head: R(-46, -4), ...TWO(0.32, 0.82, -0.1, -0.95, -0.25, 0) }),
    K(32, { hips: RM(8, 15, 0, 0, 0, 0), spine: R(8), chest: R(4, 4), head: R(-6, -20), ...ONE(0.16, 1.0, -0.3, -0.5, 0.86), ...LET(0.12, 1.1, 0.2), c_footR: FOOT('R', 0.04, 0.32, 50, -0.18), c_footL: FOOT('L', -0.12, 0.26, 60, 0.18) }),
    AEND(48), AEND(59)] };

  /* ================= batch 4: specials ================= */

  /* Neutral special, the charged thrust that breaks shields. SpecN is the uncharged move (44 frames, hit 16-21): he draws
     the sword back to his right hip with the point forward and the left hand out along the flat, sinks, and drives it
     straight out in a long lunge. SpecNLoop is the charge held (30 frames, from his frame 12, trembling and the cape
     stirring); SpecNRelease the charged thrust from the loop (33 frames, hit 6-10). */
  const DRAWN = { hips: RM(6, 40, 0, 0, -0.22, -0.06), spine: R(6), chest: R(8, 40), head: R(-6, -44), ...ONE(-0.18, 1.1, -0.3, 0.02, 1), c_handL: HL(0.35, 1.16, 0.0), c_footR: FR(0.3, 0, 0.02), c_footL: FL(-0.24, 0, 0.04), ...CAPE(8, 3) };
  const THRUST = { hips: RM(12, 10, 0, 0, -0.32, 0.3), spine: R(8), chest: R(10, -10), head: R(-14, -24), ...ONE(0.66, 1.12, -0.12, 0.0, 1), c_handL: HL(-0.15, 1.04, 0.26), c_footR: FR(0.62, 0, 0.02), c_footL: FL(-0.24, 0.02, 0.04, 20), ...CAPE(22, 8) };
  C.SpecN = { fps: 60, keys: [
    START(),
    K(6, Object.assign({}, DRAWN, { hips: RM(4, 36, 0, 0, -0.16, -0.04), chest: R(6, 34) })),
    K(12, DRAWN),
    K(15, Object.assign({}, DRAWN, { hips: RM(8, 38, 0, 0, -0.24, -0.04), ...ONE(-0.2, 1.1, -0.3, 0.02, 1) })),
    K(16, THRUST, { in: 'snap' }),
    K(21, Object.assign({}, THRUST, { ...ONE(0.68, 1.12, -0.12, 0.0, 1) }), { in: 'out' }),
    K(30, Object.assign({}, THRUST, { hips: RM(10, 14, 0, 0, -0.3, 0.26), ...ONE(0.6, 1.1, -0.14, -0.05, 1) })),
    K(38, { hips: RM(2, 22, 0, 0, -0.1, 0.06), chest: R(4, 8), head: R(-2, -32), ...ONE(0.24, 0.92, -0.2, -0.45, 0.89), c_handL: HL(0.12, 1.0, 0.17), ...STAND }),
    END(44)] };
  C.SpecNLoop = { fps: 60, loop: true, keys: [
    { t: F(1), reset: true, use: G, pose: DRAWN },
    K(8, { hips: RM(7, 40, 0, 0, -0.23, -0.06), ...ONE(-0.19, 1.11, -0.3, 0.03, 1), ...CAPE(11, 4, 4) }),
    K(16, { hips: RM(6, 41, 0, 0, -0.225, -0.06), ...ONE(-0.18, 1.1, -0.3, 0.01, 1), ...CAPE(7, 2, 0) }),
    K(23, { hips: RM(7, 39, 0, 0, -0.23, -0.06), ...ONE(-0.19, 1.105, -0.3, 0.025, 1), ...CAPE(12, 5, 6) }),
    { t: F(31), reset: true, use: G, pose: DRAWN, lag: CL }] };
  C.SpecNRelease = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: DRAWN },
    K(5, Object.assign({}, DRAWN, { hips: RM(8, 40, 0, 0, -0.25, -0.08), ...ONE(-0.22, 1.1, -0.3, 0.02, 1) })),
    K(6, Object.assign({}, THRUST, { hips: RM(14, 8, 0, 0, -0.34, 0.36), ...ONE(0.72, 1.12, -0.12, 0, 1), c_footR: FR(0.7, 0, 0.02), ...CAPE(30, 12) }), { in: 'snap' }),
    K(10, Object.assign({}, THRUST, { hips: RM(14, 8, 0, 0, -0.34, 0.36), ...ONE(0.74, 1.12, -0.12, 0, 1), c_footR: FR(0.7, 0, 0.02) }), { in: 'out' }),
    K(20, Object.assign({}, THRUST, { hips: RM(12, 12, 0, 0, -0.3, 0.3), ...ONE(0.64, 1.1, -0.14, -0.05, 1), c_footR: FR(0.6, 0, 0.02) })),
    K(28, { hips: RM(2, 22, 0, 0, -0.1, 0.06), chest: R(4, 8), head: R(-2, -32), ...ONE(0.24, 0.92, -0.2, -0.45, 0.89), c_handL: HL(0.12, 1.0, 0.17), ...STAND }),
    END(33)] };

  /* Side special: a branching sword combo, each press a step (the game picks up, side or down on steps 2-4). Every step
     starts and ends on the ready guard (blade up in front), so any branch follows any other; the last steps end in the
     relaxed stance. 1: a level cut across (29, hit 6-8). 2 up: a rising cut (40, 12-15). 2 side: a back-hand level cut
     (40, 14-16). 3 up: a jumping rising cut (40, 13-17). 3 side: a lunging thrust (46, 11-14). 3 down: a low sweep (46,
     15-18). 4 up: a leaping overhead flip-cut (50, 20-25). 4 side: a two-handed thrust with his weight (50, 23-26). 4 down:
     five fast stabs low in front (60, 13-15, 19-21, 25-27, 31-33, 37-38). */
  const READY = { hips: RM(0, 25, 0, 0, -0.1, 0), spine: R(4), chest: R(4, 10), head: R(0, -32), ...ONE(0.3, 1.0, -0.28, 0.35, 0.94), c_handL: HL(0.12, 1.02, 0.17), ...STAND };
  const RS = (f) => ({ t: F(f), reset: true, use: G, pose: READY, lag: CL });
  C.SpecS1 = { fps: 60, keys: [
    START(),
    K(4, { hips: RM(4, 40, 0, 0, -0.12, 0), chest: R(4, 34), head: R(-2, -40), ...ONE(0.2, 1.12, -0.42, 0.05, 0.3, -0.95), c_footR: FR(0.24, 0, 0.02) }),
    K(6, { hips: RM(6, 20, 0, 0, -0.14, 0.06), chest: R(6, 6), ...ONE(0.5, 1.1, -0.18, 0.02, 0.99, 0.1) }, { in: 'snap' }),
    K(7, { chest: R(6, -12), ...ONE(0.42, 1.1, 0.06, 0.02, 0.62, 0.78) }),
    K(8, { chest: R(6, -22), head: R(-4, -22), ...ONE(0.3, 1.1, 0.2, 0.02, 0.1, 0.99), ...CAPE(10, 4, 12) }, { in: 'out' }),
    K(18, { hips: RM(4, 18, 0, 0, -0.12, 0.04), chest: R(4, -14), ...ONE(0.32, 1.06, 0.14, 0.1, 0.4, 0.9) }),
    RS(29)] };
  C.SpecS2U = { fps: 60, keys: [
    RS(1),
    K(9, { hips: RM(6, 26, 0, 0, -0.18, 0), chest: R(8, 18), ...ONE(0.24, 0.82, -0.3, -0.6, 0.8), c_footR: FR(0.24, 0, 0.02) }),
    K(11, { ...ONE(0.36, 0.78, -0.26, -0.5, 0.86) }),
    K(12, { hips: RM(2, 20, 0, 0, -0.12, 0.06), chest: R(0, 4), ...ONE(0.46, 1.06, -0.22, 0.25, 0.97) }, { in: 'snap' }),
    K(13, { chest: R(-4, -2), ...ONE(0.4, 1.36, -0.22, 0.8, 0.6) }),
    K(15, { chest: R(-6, -6), head: R(6, -28), ...ONE(0.3, 1.52, -0.22, 0.99, 0.1), ...CAPE(8, 3) }, { in: 'out' }),
    K(26, { hips: RM(0, 22, 0, 0, -0.1, 0.04), ...ONE(0.3, 1.36, -0.24, 0.9, 0.42) }),
    RS(40)] };
  C.SpecS2S = { fps: 60, keys: [
    RS(1),
    K(10, { hips: RM(4, 0, 0, 0, -0.14, 0), chest: R(4, -24), head: R(-2, -20), ...ONE(0.26, 1.12, 0.14, 0.05, 0.25, 0.97) }),
    K(13, { ...ONE(0.3, 1.12, 0.16, 0.04, 0.4, 0.92) }),
    K(14, { hips: RM(6, 24, 0, 0, -0.14, 0.06), chest: R(6, 6), ...ONE(0.5, 1.1, -0.14, 0.02, 0.99, -0.1), c_footR: FR(0.26, 0, 0.02) }, { in: 'snap' }),
    K(15, { chest: R(6, 22), ...ONE(0.36, 1.1, -0.36, 0.02, 0.5, -0.86) }),
    K(16, { chest: R(6, 30), head: R(-4, -40), ...ONE(0.2, 1.1, -0.44, 0.02, 0.0, -1), ...CAPE(10, 4, -12) }, { in: 'out' }),
    K(28, { hips: RM(2, 30, 0, 0, -0.12, 0.04), ...ONE(0.22, 1.08, -0.4, 0.1, 0.2, -0.97) }),
    RS(40)] };
  C.SpecS3U = { fps: 60, keys: [
    RS(1),
    K(8, { hips: RM(8, 22, 0, 0, -0.28, 0), spine: R(8), chest: R(8, 14), ...ONE(0.3, 0.76, -0.28, -0.55, 0.84), c_footR: FR(0.22, 0, 0.02) }),
    K(12, { hips: RM(6, 22, 0, 0, -0.3, 0.02), ...ONE(0.38, 0.72, -0.26, -0.4, 0.92) }),
    K(13, { hips: RM(-2, 20, 0, 0, 0.0, 0.06), spine: R(0), chest: R(-4, 6), head: R(8, -28), ...ONE(0.44, 1.16, -0.22, 0.45, 0.89), c_footR: FOOT('R', 0.2, 0.18, 40), c_footL: FOOT('L', -0.16, 0.24, 60) }, { in: 'snap' }),
    K(14, { hips: RM(-4, 20, 0, 0, 0.1, 0.06), ...ONE(0.3, 1.56, -0.22, 0.92, 0.38) }),
    K(15, { chest: R(-8, 4), ...ONE(0.14, 1.8, -0.22, 0.98, -0.2) }),
    K(17, { hips: RM(-4, 20, 0, 0, 0.12, 0.06), head: R(14, -24), ...ONE(0.06, 1.84, -0.24, 0.9, -0.42), ...CAPE(-4, 0) }, { in: 'out' }),
    K(24, { hips: RM(2, 22, 0, 0, -0.06, 0.04), ...ONE(0.18, 1.5, -0.24, 0.9, 0.42), ...STAND }),
    RS(40)] };
  C.SpecS3S = { fps: 60, keys: [
    RS(1),
    K(9, { hips: RM(4, 40, 0, 0, -0.18, -0.06), chest: R(6, 38), head: R(-4, -44), ...ONE(-0.12, 1.12, -0.3, 0.02, 1), c_handL: HL(0.3, 1.14, 0.04), c_footR: FR(0.26, 0, 0.02) }),
    K(10, { hips: RM(5, 40, 0, 0, -0.2, -0.06), ...ONE(-0.14, 1.12, -0.3, 0.02, 1) }),
    K(11, { hips: RM(12, 10, 0, 0, -0.3, 0.26), chest: R(10, -10), head: R(-14, -24), ...ONE(0.64, 1.14, -0.12, 0.0, 1), c_handL: HL(-0.1, 1.04, 0.26), c_footR: FR(0.56, 0, 0.02), ...CAPE(18, 6) }, { in: 'snap' }),
    K(14, { ...ONE(0.68, 1.14, -0.12, 0.0, 1) }, { in: 'out' }),
    K(30, { hips: RM(8, 14, 0, 0, -0.26, 0.22), ...ONE(0.56, 1.1, -0.14, 0.1, 0.99) }),
    RS(46)] };
  C.SpecS3D = { fps: 60, keys: [
    RS(1),
    K(10, { hips: RM(16, 30, 0, 0, -0.3, 0), spine: R(10), chest: R(10, 30), head: R(-20, -36), ...ONE(0.1, 0.54, -0.42, -0.25, 0.2, -0.95), c_handL: HL(0.25, 0.8, 0.28), c_footR: FR(0.3, 0, 0.0), c_footL: FL(-0.24, 0, 0.08) }),
    K(14, { ...ONE(0.12, 0.5, -0.44, -0.25, 0.25, -0.94) }),
    K(15, { chest: R(14, 8), ...ONE(0.48, 0.62, -0.2, -0.45, 0.88, -0.04) }, { in: 'snap' }),
    K(16, { chest: R(14, -10), ...ONE(0.44, 0.6, 0.06, -0.45, 0.55, 0.69) }),
    K(18, { chest: R(14, -22), ...ONE(0.3, 0.62, 0.18, -0.45, 0.09, 0.87), ...CAPE(14, 5, 10) }, { in: 'out' }),
    K(30, { hips: RM(14, 24, 0, 0, -0.34, 0), ...ONE(0.3, 0.66, 0.14, -0.45, 0.18, 0.86) }),
    RS(46)] };
  C.SpecS4U = { fps: 60, keys: [
    RS(1),
    K(10, { hips: RM(10, 22, 0, 0, -0.32, 0), spine: R(10), chest: R(8, 12), head: R(-10, -28), ...TWO(0.3, 0.8, -0.14, -0.6, 0.8, 0), c_footR: FR(0.2, 0, 0.02) }),
    K(13, { hips: RM(2, 20, 0, 0, -0.1, 0.02), ...TWO(0.32, 1.2, -0.12, 0.6, 0.8, 0) }),
    K(16, { hips: RM(-6, 20, 0, 0, 0.16, 0.04), spine: R(-4), chest: R(-8, 4), head: R(10, -24), ...TWO(0.2, 1.62, -0.1, 0.92, -0.38, 0), c_footR: FOOT('R', 0.16, 0.34, 40), c_footL: FOOT('L', -0.1, 0.28, 50), ...CAPE(-6, 0) }),
    K(19, { hips: RM(-10, 20, 0, 0, 0.24, 0.04), chest: R(-12, 4), ...TWO(0.06, 1.86, -0.1, 0.6, -0.8, 0) }),
    K(20, { hips: RM(0, 20, 0, 0, 0.22, 0.08), chest: R(0, 2), ...TWO(0.32, 1.84, -0.1, 0.9, 0.44, 0) }, { in: 'snap' }),
    K(21, { hips: RM(10, 20, 0, 0, 0.16, 0.12), chest: R(10, 0), ...TWO(0.52, 1.5, -0.1, 0.25, 0.97, 0) }),
    K(22, { hips: RM(16, 20, 0, 0, 0.06, 0.14), chest: R(16, 0), ...TWO(0.52, 1.1, -0.1, -0.5, 0.86, 0), ...CAPE(30, 12) }),
    K(25, { hips: RM(20, 20, 0, 0, -0.24, 0.14), chest: R(18, 0), head: R(-30, -20), ...TWO(0.4, 0.74, -0.08, -0.95, 0.3, 0), c_footR: FR(0.36, 0, 0.02), c_footL: FL(-0.2, 0.0, 0.04) }, { in: 'out' }),
    K(38, { hips: RM(16, 22, 0, 0, -0.3, 0.12), ...TWO(0.4, 0.7, -0.08, -0.95, 0.3, 0) }),
    K(45, { hips: RM(2, 24, 0, 0, -0.1, 0.03), chest: R(4, 8), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), ...LET(0.12, 1.0, 0.17), ...STAND }),
    END(50)] };
  C.SpecS4S = { fps: 60, keys: [
    RS(1),
    K(12, { hips: RM(4, 40, 0, 0, -0.2, -0.08), chest: R(6, 38), head: R(-4, -44), ...TWO(-0.08, 1.14, -0.18, 0.05, 1, 0), c_footR: FR(0.3, 0, 0.02), c_footL: FL(-0.26, 0, 0.04) }),
    K(20, { hips: RM(6, 42, 0, 0, -0.26, -0.1), chest: R(8, 42), ...TWO(-0.14, 1.12, -0.18, 0.05, 1, 0), ...CAPE(10, 4) }),
    K(22, { hips: RM(6, 40, 0, 0, -0.26, -0.08), ...TWO(-0.1, 1.12, -0.18, 0.04, 1, 0) }),
    K(23, { hips: RM(14, 6, 0, 0, -0.36, 0.4), spine: R(8), chest: R(10, -6), head: R(-16, -20), ...TWO(0.76, 1.12, -0.06, 0.0, 1, 0), c_footR: FR(0.74, 0, 0.02), c_footL: FL(-0.2, 0.02, 0.04, 25), ...CAPE(30, 12) }, { in: 'snap' }),
    K(26, { ...TWO(0.8, 1.12, -0.06, 0.0, 1, 0) }, { in: 'out' }),
    K(40, { hips: RM(12, 10, 0, 0, -0.32, 0.34), ...TWO(0.7, 1.08, -0.06, -0.05, 1, 0) }),
    K(46, { hips: RM(2, 24, 0, 0, -0.1, 0.04), chest: R(4, 8), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), ...LET(0.12, 1.0, 0.17), ...STAND }),
    END(50)] };
  {
    const keys = [RS(1), K(9, { hips: RM(16, 22, 0, 0, -0.34, 0.02), spine: R(10), chest: R(10, 10), head: R(-24, -28), ...ONE(0.16, 0.56, -0.24, -0.25, 0.97), c_handL: HL(0.15, 0.8, 0.24), c_footR: FR(0.3, 0, 0.02), c_footL: FL(-0.22, 0, 0.04) })];
    const hits = [13, 19, 25, 31, 37];
    hits.forEach((h, i) => {
      const y = [0.42, 0.48, 0.38, 0.5, 0.44][i], x = [-0.22, -0.18, -0.24, -0.16, -0.2][i];
      keys.push(K(h - 1, { ...ONE(0.18, y + 0.04, x, -0.22, 0.97) }));
      keys.push(K(h, { hips: RM(18, 18, 0, 0, -0.36, 0.08), chest: R(10, 2), ...ONE(0.66, y - 0.06, x + 0.06, -0.24, 0.97) }, { in: 'snap' }));
      keys.push(K(h + 2 > 38 ? 38 : h + 2, { ...ONE(0.6, y - 0.05, x + 0.05, -0.24, 0.97), ...CAPE(14 + 3 * i, 5, 4 * (i % 2 ? 1 : -1)) }));
    });
    keys.push(K(48, { hips: RM(14, 20, 0, 0, -0.32, 0.06), ...ONE(0.5, 0.44, -0.16, -0.3, 0.95) }));
    keys.push(K(55, { hips: RM(2, 24, 0, 0, -0.1, 0.03), chest: R(4, 8), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), c_handL: HL(0.12, 1.0, 0.17), ...STAND }));
    keys.push(END(60));
    C.SpecS4D = { fps: 60, keys };
  }

  /* Up special: 39 frames, the clean hit on 5, then 6-10 as he rises; 34 frames of landing lag. He drops into a deep coil
     with the right shoulder turned away and the sword drawn down and back past his right hip, the blade trailing behind
     him, the left hand reaching forward. Then he uncoils upward in one line: the hand whips forward low and up, the right
     knee drives up, the left leg stretches long beneath him, and the blade sweeps from behind, through low in front, up to
     straight overhead with his whole body stretched under it, the body turning a quarter round as he climbs and the head
     following the point. At the top the blade drifts back over his head, then he curls: knees up, the sword brought down in
     front, and drops into the helpless fall. */
  P.helpless = { hips: RM(6, 15, 0, 0, 0, 0), spine: R(6), chest: R(2, 4), head: R(-10, -18), ...ONE(0.12, 1.06, -0.36, -0.7, 0.4, -0.6), c_handL: HL(0.14, 1.1, 0.3), c_footR: FOOT('R', -0.02, 0.18, 55, -0.15), c_footL: FOOT('L', -0.14, 0.12, 65, 0.15), ...CAPE(30, 12) };
  C.SpecU = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(16, 30, 0, 0, -0.36, -0.02), spine: R(10), chest: R(12, -24), head: R(-6, -30), ...ONE(-0.16, 0.84, -0.32, -0.5, -0.86), c_handL: HL(0.34, 0.9, 0.2), c_footR: FR(0.24, 0, 0.02), c_footL: FL(-0.22, 0.02, 0.04, 20), ...CAPE(10, 4) }),
    K(4, { hips: RM(14, 26, 0, 0, -0.34, 0.0), chest: R(10, -10), ...ONE(0.1, 0.68, -0.36, -0.6, -0.8) }),
    K(5, { hips: RM(-2, 20, 0, 0, 0.0, 0.04), spine: R(0), chest: R(-2, 14), head: R(8, -24), ...ONE(0.5, 1.06, -0.26, 0.2, 0.98), c_handL: HL(-0.1, 0.92, 0.28), c_footR: FOOT('R', 0.16, 0.14, 50), c_footL: FOOT('L', -0.12, 0.16, 55), ...CAPE(-6, 0) }, { in: 'snap' }),
    K(6, { hips: RM(-6, 18, 0, 0, 0.08, 0), chest: R(-6, 10), head: R(14, -22), ...ONE(0.4, 1.5, -0.24, 0.75, 0.66), c_footR: FOOT('R', 0.22, 0.42, 20, -0.12), c_footL: FOOT('L', -0.06, 0.1, 65) }),
    K(8, { all: R(0, -35), hips: RM(-8, 15, 0, 0, 0.1, 0), spine: R(-4), chest: R(-10, 6), head: R(20, -18), ...ONE(0.12, 1.9, -0.2, 1, 0.06), c_handL: HL(-0.06, 1.0, 0.3) }),
    K(10, { all: R(0, -70), chest: R(-12, 4), head: R(24, -16), ...ONE(0.04, 1.92, -0.2, 0.96, -0.28) }, { in: 'out' }),
    K(16, { all: R(0, -90), hips: RM(-4, 15, 0, 0, 0.06, 0), chest: R(-8, 4), ...ONE(0.0, 1.86, -0.22, 0.9, -0.44), c_footR: FOOT('R', 0.12, 0.3, 40, -0.12), c_footL: FOOT('L', -0.04, 0.12, 60), ...CAPE(-2, 0) }),
    K(24, { all: R(0, -50), hips: RM(14, 15, 0, 0, 0, 0), spine: R(14), chest: R(10, 4), head: R(-12, -18), ...ONE(0.34, 1.16, -0.3, -0.3, 0.95), c_handL: HL(0.2, 1.1, 0.28), c_footR: FOOT('R', 0.16, 0.42, 30, -0.15), c_footL: FOOT('L', 0.0, 0.36, 40, 0.15), ...CAPE(24, 10) }),
    { t: F(34), reset: true, use: [...AIR, 'helpless'], pose: { all: R(0, 0) }, lag: CL },
    { t: F(39), reset: true, use: [...AIR, 'helpless'] }] };
  /* Helpless: a 32-frame loop after the up special: drifting down spent, limbs loose, the sword hanging out to his side. */
  C.Helpless = { fps: 60, loop: true, keys: [
    { t: F(1), reset: true, use: [...AIR, 'helpless'] },
    K(17, { c_handL: HL(0.14, 1.14, 0.32), ...ONE(0.12, 1.04, -0.37, -0.72, 0.35, -0.6), c_footR: FOOT('R', -0.04, 0.2, 58, -0.15), ...CAPE(36, 16) }),
    { t: F(33), reset: true, use: [...AIR, 'helpless'], lag: CL }] };

  /* Down special, the counter. SpecD: 59 frames, the counter window 5-29 (intangible 1-5): the sword snaps upright in front
     of him, the flat to the enemy, his weight back; held, then he relaxes out of it. SpecDHit: 35 frames, hit 3-9: from the
     stance a fast cut down and across in front of him, then back to the stance's end. */
  const STANCE = { hips: RM(-2, 30, 0, 0, -0.16, -0.06), spine: R(-2), chest: R(-2, 20), head: R(2, -36), ...ONE(0.3, 1.12, -0.2, 0.97, 0.15, 0.1, { c_sword: SW(0.97, 0.15, 0.1, 0) }), c_handL: HL(0.28, 1.36, 0.0), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.28, 0, 0.06), ...CAPE(4, 2) };
  C.SpecD = { fps: 60, keys: [
    START(),
    K(2, { c_footL: FL(-0.23, 0.08, 0.05) }),
    K(3, Object.assign({}, STANCE, { hips: RM(0, 28, 0, 0, -0.12, -0.03), ...ONE(0.28, 1.0, -0.22, 0.7, 0.7, 0.1, { c_sword: SW(0.7, 0.7, 0.1, 0) }) })),
    K(5, STANCE, { in: 'out' }),
    K(29, Object.assign({}, STANCE, { hips: RM(-2, 30, 0, 0, -0.17, -0.06) })),
    K(40, { hips: RM(1, 26, 0, 0, -0.1, -0.02), chest: R(2, 12), head: R(0, -32), ...ONE(0.26, 1.0, -0.24, 0.3, 0.95), c_handL: HL(0.14, 1.02, 0.17), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.2, 0.08, 0.05) }),
    END(59)] };
  C.SpecDHit = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: STANCE },
    K(2, Object.assign({}, STANCE, { ...ONE(0.24, 1.3, -0.24, 0.9, -0.42), c_footR: FR(0.22, 0.08, 0.02) })),
    K(3, { hips: RM(8, 16, 0, 0, -0.18, 0.08), chest: R(8, -6), head: R(-8, -26), ...ONE(0.5, 1.28, -0.18, 0.4, 0.92), c_footR: FR(0.3, 0, 0.02) }, { in: 'snap' }),
    K(5, { chest: R(12, -18), ...ONE(0.5, 1.0, -0.06, -0.3, 0.8, 0.52) }),
    K(7, { chest: R(14, -28), ...ONE(0.38, 0.86, 0.06, -0.7, 0.3, 0.65), ...CAPE(16, 6, 8) }),
    K(9, { ...ONE(0.34, 0.84, 0.08, -0.75, 0.2, 0.62) }, { in: 'out' }),
    K(22, { hips: RM(6, 18, 0, 0, -0.16, 0.06), chest: R(10, -22), ...ONE(0.34, 0.86, 0.06, -0.72, 0.25, 0.64) }),
    K(30, { hips: RM(2, 24, 0, 0, -0.1, 0.02), chest: R(4, 8), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), c_handL: HL(0.12, 1.0, 0.17), ...STAND }),
    END(35)] };

  /* ================= batch 5: defence and being hit ================= */

  /* Shield: 8 frames up into a braced crouch behind the blade (held across in front, point up and out), the left forearm
     raised; the game holds the last frame (and plays it backward to drop the shield). ShieldHit: 10 frames, knocked back
     inside it and braced again. */
  P.shield = { hips: RM(8, 30, 0, 0, -0.24, -0.04), spine: R(8), chest: R(8, 14), head: R(-12, -30), ...ONE(0.24, 1.08, -0.2, 0.8, 0.3, 0.52), c_handL: HL(0.24, 1.2, 0.12), c_footR: FR(0.18, 0, 0.02), c_footL: FL(-0.24, 0, 0.06), ...CAPE(4, 2) };
  C.Shield = { fps: 60, keys: [START(), K(3, { hips: RM(4, 28, 0, 0, -0.16, -0.02), ...ONE(0.26, 1.0, -0.22, 0.4, 0.4, 0.82), c_footL: FL(-0.21, 0.08, 0.05) }), { t: F(6), reset: true, use: [...G, 'shield'], lag: CL, in: 'out' }, { t: F(8), reset: true, use: [...G, 'shield'] }] };
  C.ShieldHit = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'shield'] },
    K(3, { hips: RM(2, 30, 0, 0, -0.26, -0.08), chest: R(0, 14), head: R(-4, -30), ...ONE(0.18, 1.1, -0.2, 0.85, 0.15, 0.5), ...CAPE(14, 6) }, { in: 'out' }),
    { t: F(10), reset: true, use: [...G, 'shield'], lag: CL }] };

  /* Roll: 35 frames, intangible 4-19; the game slides him the way he rolls and then turns him round, so he ends facing back
     the way he came (the root turned 180 by the end). A low spinning dash past the enemy: he drops, spins round on the balls
     of his feet with the cape whirled out, and comes up in the guard facing back. RollB: the same length, a low backward
     spin out of danger that ends facing the same way. */
  {
    const low = { hips: RM(20, 10, 0, 0, -0.42, 0.02), spine: R(14), chest: R(8, 0), head: R(-30, -10), ...ONE(0.0, 0.86, -0.3, -0.7, -0.7), c_handL: HL(0.2, 0.86, 0.24),
      c_footR: FOOT('R', 0.14, 0.14, 40, -0.14), c_footL: FOOT('L', -0.12, 0.16, 45, 0.14), ...CAPE(40, 14, 25) };
    const roll = (dir, name) => {
      const keys = [START(), K(3, Object.assign({}, low, { all: R(0, 0), c_footR: FR(0.12, 0, 0.02), c_footL: FL(-0.14, 0, 0.04, 30) }))];
      const deg = [[5, 30], [8, 90], [11, 150], [14, 210], [17, 270], [20, 330], [23, 360]].map(([f, d]) => [f, dir * d * (name === 'Roll' ? 0.5 : 1)]);
      for (const [f, d] of deg) keys.push(K(f, Object.assign(f === 5 ? Object.assign({}, low) : {}, { all: R(0, d) })));
      keys.push(K(27, { hips: RM(6, 22, 0, 0, -0.18, 0), spine: R(6), chest: R(4, 8), head: R(-6, -30), ...ONE(0.18, 0.9, -0.22, -0.5, 0.86), c_handL: HL(0.15, 1.0, 0.18), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.17, 0, 0.04), ...CAPE(10, 4) }));
      keys.push(Object.assign(END(35), { pose: Object.assign({}, IDLEARM, { all: R(0, dir * (name === 'Roll' ? 180 : 360)) }) }));
      C[name] = { fps: 60, keys };
    };
    roll(-1, 'Roll'); roll(1, 'RollB');
  }

  /* Spot dodge: 27 frames, intangible 2-18. He sinks and sways back out of the way, turning his chest from the hit with the
     sword drawn in along his leg, then comes back up. */
  C.Spot = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(-4, 40, 0, 0, -0.3, -0.12), spine: R(-6), chest: R(-8, 30), head: R(-4, -40), ...ONE(-0.06, 0.72, -0.3, -0.85, 0.5), c_handL: HL(-0.12, 0.9, 0.24), c_footL: FL(-0.24, 0, 0.04, 20), ...CAPE(8, 2, -10) }, { in: 'out' }),
    K(14, { hips: RM(-3, 40, 0, 0, -0.32, -0.12), chest: R(-8, 32), ...CAPE(4, 0) }),
    K(21, { hips: RM(2, 28, 0, 0, -0.14, -0.03), spine: R(4), chest: R(2, 14), head: R(0, -34), ...ONE(0.16, 0.84, -0.18, -0.65, 0.76), c_handL: HL(0.1, 1.0, 0.17), c_footL: FL(-0.17, 0, 0.04) }),
    END(27)] };

  /* Air dodge: 49 frames, intangible 4-29. Knees tucked and a full twist round in the air, the sword held in close along his
     body, then he opens out into the air pose. */
  C.AirDodge = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: { all: R(0, 0) } },
    K(4, { all: R(0, 20), hips: RM(14, 15, 0, 0, 0.04, 0), spine: R(18), chest: R(10, 0), head: R(-20, -14), ...ONE(0.06, 1.0, -0.22, -0.6, -0.4, 0.7), c_handL: HL(0.16, 1.02, 0.12), c_footR: FOOT('R', 0.1, 0.52, 70, -0.12), c_footL: FOOT('L', -0.04, 0.46, 70, 0.12), ...CAPE(20, 8, 20) }),
    ...[[8, 100], [12, 190], [16, 270], [20, 330], [24, 360]].map(([f, d]) => K(f, { all: R(0, d) })),
    K(30, { all: R(0, 360), hips: RM(8, 15, 0, 0, 0, 0), spine: R(10), ...ONE(0.16, 1.0, -0.3, -0.3, 0.95), c_footR: FOOT('R', 0.12, 0.36, 50, -0.18), c_footL: FOOT('L', -0.08, 0.26, 60, 0.18) }),
    { t: F(40), reset: true, use: AIR, pose: { all: R(0, 360) }, lag: CL },
    { t: F(49), reset: true, use: AIR, pose: { all: R(0, 360) } }] };

  /* Hit reactions (played over the hitstun). Hit: a hit from in front (24 frames): head and chest snap back, the arms fly
     out, a step back, then he recovers to the guard. HitBack: from behind (24): thrown forward over his hips. HitHeavy (36):
     knocked off balance, the front leg up, nearly over. HitHeavyBack (36): bent double forward. */
  C.Hit = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(-8, 22, 0, 0, -0.1, -0.06), spine: R(-10), chest: R(-14, 14), head: R(-6, -26), ...ONE(0.06, 0.96, -0.38, -0.2, 0.6, -0.77), c_handL: HL(0.22, 1.18, 0.34), c_footL: FL(-0.24, 0, 0.04, 15), ...CAPE(-8, -4) }, { in: 'out' }),
    K(10, { hips: RM(-4, 22, 0, 0, -0.1, -0.04), spine: R(-6), chest: R(-8, 12), head: R(4, -30), ...CAPE(10, 4) }),
    K(18, { hips: RM(2, 24, 0, 0, -0.1, -0.01), spine: R(4), chest: R(3, 10), ...ONE(0.18, 0.88, -0.2, -0.55, 0.83), c_handL: HL(0.12, 1.02, 0.17), c_footL: FL(-0.17, 0, 0.04) }),
    END(24)] };
  C.HitBack = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(14, 22, 0, 0, -0.14, 0.06), spine: R(16), chest: R(14, 4), head: R(-30, -26), ...ONE(0.18, 0.86, -0.34, -0.7, 0.3, -0.64), c_handL: HL(0.36, 0.98, 0.3), c_footR: FR(0.3, 0, 0.02), ...CAPE(30, 12) }, { in: 'out' }),
    K(10, { hips: RM(10, 22, 0, 0, -0.14, 0.05), spine: R(12), chest: R(10, 6), ...CAPE(12, 4) }),
    K(18, { hips: RM(2, 24, 0, 0, -0.1, 0.01), spine: R(4), chest: R(3, 10), head: R(0, -32), ...ONE(0.18, 0.88, -0.2, -0.55, 0.83), c_handL: HL(0.12, 1.02, 0.17), c_footR: FR(0.16, 0, 0.02) }),
    END(24)] };
  C.HitHeavy = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(-18, 22, 8, 0, -0.06, -0.12), spine: R(-14), chest: R(-20, 16), head: R(-12, -20), ...ONE(-0.06, 1.2, -0.42, 0.2, 0.2, -0.96), c_handL: HL(0.1, 1.42, 0.38), c_footR: FOOT('R', 0.3, 0.3, 30), c_footL: FL(-0.26, 0, 0.04, 10), ...CAPE(-14, -6) }, { in: 'out' }),
    K(14, { hips: RM(-12, 22, 6, 0, -0.08, -0.1), chest: R(-14, 14), c_footR: FOOT('R', 0.3, 0.2, 20), ...CAPE(8, 4) }),
    K(24, { hips: RM(-2, 22, 0, 0, -0.14, -0.04), spine: R(0), chest: R(0, 10), head: R(-2, -30), ...ONE(0.12, 0.92, -0.24, -0.4, 0.92), c_handL: HL(0.16, 1.0, 0.2), c_footR: FR(0.18, 0, 0.02), c_footL: FL(-0.17, 0, 0.04) }),
    END(36)] };
  C.HitHeavyBack = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(30, 22, 0, 0, -0.2, 0.1), spine: R(24), chest: R(20, 0), head: R(-40, -20), ...ONE(0.3, 0.7, -0.36, -0.9, 0.3, -0.3), c_handL: HL(0.4, 0.74, 0.3), c_footR: FR(0.36, 0, 0.02), c_footL: FOOT('L', -0.36, 0.3, 60), ...CAPE(50, 18) }, { in: 'out' }),
    K(14, { hips: RM(24, 22, 0, 0, -0.2, 0.08), spine: R(20), ...CAPE(20, 8) }),
    K(24, { hips: RM(4, 22, 0, 0, -0.14, 0.03), spine: R(6), chest: R(4, 10), head: R(-6, -30), ...ONE(0.16, 0.9, -0.22, -0.5, 0.86), c_handL: HL(0.14, 1.0, 0.18), c_footR: FR(0.16, 0, 0.02), c_footL: FL(-0.17, 0, 0.04) }),
    END(36)] };

  /* Launched: Launch (30): flung back, body stretched and arms trailing, before the tumble. LaunchUp (40): sent straight up,
     arched back and spinning slowly. Spike (40): driven down, folded over, the cape blown up. Tumble: a 40-frame loop, one
     full slow somersault backward, limbs loose, about his middle. */
  C.Launch = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: { hips: RM(-24, 15, 0, 0, 0, 0), spine: R(-14), chest: R(-16, 4), head: R(14, -10), ...ONE(0.3, 1.36, -0.4, 0.5, 0.6, -0.6), c_handL: HL(0.3, 1.5, 0.36), c_footR: FOOT('R', 0.3, 0.3, 10, -0.18), c_footL: FOOT('L', 0.24, 0.42, 20, 0.18), ...CAPE(-20, -6) } },
    K(16, { hips: RM(-30, 15, 0, 0, 0, 0), chest: R(-20, 6), ...CAPE(10, 4) }),
    K(30, { hips: RM(-34, 15, 0, 0, 0, 0), ...CAPE(30, 10) })] };
  C.LaunchUp = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: Object.assign(turn(0, 0), { hips: RM(-10, 15, 0, 0, 0, 0), spine: R(-10), chest: R(-12, 0), head: R(20, -10), ...ONE(0.1, 1.0, -0.4, -0.6, 0.2, -0.77), c_handL: HL(0.1, 1.0, 0.36), c_footR: FOOT('R', 0.04, 0.06, 60, -0.12), c_footL: FOOT('L', -0.04, 0.04, 62, 0.12), ...CAPE(80, 10) }) },
    ...[[11, 90], [21, 180], [31, 270], [40, 340]].map(([f, d]) => K(f, turn(0, d)))] };
  C.Spike = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: { hips: RM(30, 15, 0, 0, 0, 0), spine: R(24), chest: R(20, 0), head: R(-30, -10), ...ONE(0.1, 1.5, -0.4, 0.7, 0.2, -0.68), c_handL: HL(0.1, 1.5, 0.36), c_footR: FOOT('R', -0.2, 0.5, 80, -0.16), c_footL: FOOT('L', -0.3, 0.6, 90, 0.16), ...CAPE(110, 20) } },
    K(20, { hips: RM(24, 15, 0, 0, 0, 0), ...CAPE(120, 30) }),
    K(40, { hips: RM(16, 15, 0, 0, 0, 0), spine: R(14), ...CAPE(100, 20) })] };
  {
    const loose = { hips: RM(4, 15, 0, 0, 0, 0), spine: R(8), chest: R(4, 0), head: R(-10, -10), ...ONE(0.2, 1.12, -0.44, 0.3, 0.3, -0.9), c_handL: HL(0.2, 1.3, 0.4), c_footR: FOOT('R', 0.1, 0.4, 40, -0.18), c_footL: FOOT('L', -0.12, 0.26, 50, 0.2), ...CAPE(40, 16, 20) };
    const keys = [{ t: F(1), reset: true, use: AIR, pose: Object.assign({}, loose, turn(0, 0)) }];
    for (let f = 3; f <= 41; f += 2) keys.push(K(f, Object.assign(turn(-360 * (f - 1) / 40, 0), f === 21 ? { c_footR: FOOT('R', 0.2, 0.3, 30, -0.18), c_handL: HL(0.3, 1.2, 0.4), ...CAPE(50, 20, 30) } : {})));
    C.Tumble = { fps: 60, loop: true, keys };
  }

  /* On the floor. Down (20): he hits the floor on his back (the game shows it over 14 frames), a small bounce, and lies
     there. DownLie: a 60-frame loop lying on his back, breathing, the sword by his side. GetUp (30): he rolls his legs over
     and comes up to the guard. GetUpAttack (49, hits 22-23 in front, 27-28 behind, intangible 1-28): from his back he sweeps
     the blade round flat along the floor in front and then behind as he springs up. TechInPlace (26): he slaps the floor
     and springs straight up. TechRoll (40): he rolls along the floor and comes up in the guard. */
  const LIE = Object.assign(turn(-90, 0, 0, [0, 0.0, 0], [0, 0.17, 0.9]), {
    hips: RM(0, 0, 0, 0, 0, 0), spine: R(0), chest: R(-4, 0), head: R(10, 0), c_handR: HR(0.14, 0.86, -0.34), c_sword: SW(-1, 0.1, -0.05), c_handL: HL(0.1, 0.9, 0.32),
    c_footR: FOOT('R', 0.05, 0.1, -20, -0.18), c_footL: FOOT('L', -0.04, 0.22, -10, 0.2), ...CAPE(0, 0) });
  C.Down = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: Object.assign(turn(-40, 0), { hips: RM(-10, 15, 0, 0, 0, 0), chest: R(-10, 0), head: R(10, -10), ...ONE(0.2, 1.2, -0.4, 0.3, 0.3, -0.9), c_handL: HL(0.2, 1.3, 0.4), ...CAPE(20, 8) }) },
    K(6, LIE, { in: 'snap' }),
    K(9, Object.assign({}, LIE, turn(-80, 0, 0, [0, 0, 0], [0, 0.24, 0.9]), { head: R(20, 0), c_footR: FOOT('R', 0.1, 0.3, -20, -0.18), c_footL: FOOT('L', 0.0, 0.36, -10, 0.2) }), { in: 'out' }),
    K(14, LIE),
    K(20, LIE)] };
  C.DownLie = { fps: 60, loop: true, keys: [
    { t: F(1), reset: true, use: G, pose: LIE },
    K(31, { chest: R(-6, 0), head: R(12, 0), c_handL: HL(0.1, 0.92, 0.32) }),
    { t: F(61), reset: true, use: G, pose: LIE, lag: CL }] };
  const SIT = Object.assign(turn(-30, 0, 0, [0, 0, 0], [0, 0.42, 0.55]), { hips: RM(0, 10, 0, 0, 0, 0), spine: R(30), chest: R(20, 0), head: R(-10, -10), ...ONE(0.3, 0.6, -0.36, -0.2, 0.98), c_handL: HL(-0.3, 0.6, 0.3),
    c_footR: FOOT('R', 0.4, 0.15, -10, -0.18), c_footL: FOOT('L', 0.3, 0.3, -30, 0.2), ...CAPE(0, 0) });
  /* GetUp (30): from flat on his back he crunches up (chin tucked, knees drawn up, the left palm going down on the floor
     behind him), sits up over his right foot with the left leg folding under, rocks forward onto the right foot and the left
     knee (the left hand pushing off the right knee), rises out of the kneel bringing the left foot through to his stance,
     and comes up into the guard. The seat, feet and hand are placed on the floor itself, so nothing floats. */
  const HIP0 = [0, 0.93, 0];
  const GU = (p, hip) => FRAME(p, 0, HIP0, hip);
  const GUK = (f, p, hip, pose, at) => { const fr = GU(p, hip); return K(f, Object.assign({ all: fr.all }, pose, fr.foot('R', at.R[0], at.R[1]), fr.foot('L', at.L[0], at.L[1]), fr.handL(at.hl), fr.grip(at.gr))); };
  C.GetUp = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: LIE },
    GUK(5, -62, [0, 0.26, -0.03], { hips: RM(0, 8, 0, 0, 0, 0), spine: R(14), chest: R(18, 0), head: R(-26, -6), c_sword: SW(-0.85, 0.5), ...CAPE(0, 0) },
      { R: [[-0.17, 0.12, 0.42], 62], L: [[0.2, 0.1, 0.6], 40], hl: [0.36, 0.08, -0.26], gr: [-0.36, 0.14, -0.1] }),
    GUK(9, -26, [0, 0.27, -0.02], { hips: RM(0, 12, 0, 0, 0, 0), spine: R(16), chest: R(20, 4), head: R(-8, -12), c_sword: SW(-0.55, 0.83), ...CAPE(4, 2) },
      { R: [[-0.215, 0.1, 0.14], 26], L: [[0.12, 0.12, -0.1], 70], hl: [0.36, 0.06, -0.22], gr: [-0.36, 0.4, 0.26] }),
    GUK(13, 0, [0, 0.44, 0.02], { hips: RM(4, 15, 0, 0, 0, 0), spine: R(14), chest: R(16, 8), head: R(-10, -24), c_sword: SW(-0.4, 0.92), ...CAPE(8, 3) },
      { R: [[-0.215, 0.1, 0.14], 0], L: [[0.12, 0.13, -0.4], 70], hl: [-0.08, 0.56, 0.24], gr: [-0.34, 0.46, 0.4] }),
    GUK(18, 0, [0, 0.62, 0.02], { hips: RM(6, 18, 0, 0, 0, 0), spine: R(10), chest: R(12, 10), head: R(-8, -28), c_sword: SW(-0.5, 0.86), ...CAPE(8, 3) },
      { R: [[-0.215, 0.1, 0.14], 0], L: [[0.2, 0.24, -0.24], 30], hl: [0.1, 0.8, 0.26], gr: [-0.3, 0.68, 0.36] }),
    GUK(22, 0, [0, 0.82, 0.0], { hips: RM(4, 24, 0, 0, 0, 0), spine: R(5), chest: R(4, 10), head: R(-4, -32), c_sword: SW(-0.6, 0.8), ...CAPE(6, 2) },
      { R: [[-0.215, 0.1, 0.14], 0], L: [[0.29, 0.1, -0.19], 0], hl: [0.17, 0.98, 0.12], gr: [-0.2, 0.84, 0.22] }),
    END(30)] };
  C.GetUpAttack = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: LIE },
    K(10, SIT),
    K(18, Object.assign(turn(0, 0), { hips: RM(20, 10, 0, 0, -0.5, 0), spine: R(16), chest: R(10, 30), head: R(-30, -30), ...ONE(0.1, 0.64, -0.44, -0.45, 0.18, -0.85), c_handL: HL(0.2, 0.4, 0.3), c_footR: FR(0.26, 0, 0.0), c_footL: FL(-0.26, 0.04, 0.08, 30), ...CAPE(10, 4) })),
    K(21, { ...ONE(0.1, 0.6, -0.46, -0.45, 0.22, -0.85) }),
    K(22, { chest: R(12, 6), ...ONE(0.46, 0.56, -0.2, -0.45, 0.88, -0.04) }, { in: 'snap' }),
    K(23, { chest: R(12, -16), ...ONE(0.42, 0.56, 0.08, -0.45, 0.53, 0.7) }, { in: 'out' }),
    K(25, { hips: RM(20, -20, 0, 0, -0.5, 0), chest: R(14, -36), ...ONE(0.2, 0.58, 0.28, -0.45, 0, 0.89) }),
    K(26, { hips: RM(20, -40, 0, 0, -0.5, 0), chest: R(14, -42), ...ONE(0, 0.58, 0.3, -0.45, -0.45, 0.77) }),
    K(27, { ...ONE(-0.24, 0.58, 0.12, -0.45, -0.88, 0.09) }, { in: 'snap' }),
    K(28, { ...ONE(-0.26, 0.6, -0.12, -0.45, -0.62, -0.62), ...CAPE(24, 8, 12) }, { in: 'out' }),
    K(38, { hips: RM(8, 0, 0, 0, -0.24, 0), chest: R(6, -10), head: R(-10, -20), ...ONE(0.0, 0.7, -0.3, -0.5, -0.86), c_handL: HL(0.2, 0.9, 0.2), ...STAND }),
    END(49)] };
  C.TechInPlace = { fps: 60, keys: [
    { t: F(1), reset: true, use: G, pose: Object.assign({}, LIE, turn(-70, 0, 0, [0, 0, 0], [0, 0.22, 0.8])) },
    K(4, Object.assign({}, SIT, { c_handL: HL(-0.3, 0.2, 0.3) })),
    K(9, Object.assign(turn(0, 0), { hips: RM(-4, 20, 0, 0, 0.06, 0), spine: R(0), chest: R(-4, 6), head: R(4, -26), ...ONE(0.2, 1.0, -0.36, -0.5, 0.4, -0.77), c_handL: HL(0.2, 1.3, 0.3), c_footR: FOOT('R', 0.1, 0.2, 40), c_footL: FOOT('L', -0.1, 0.24, 50), ...CAPE(-6, -2) })),
    K(15, { hips: RM(10, 22, 0, 0, -0.3, 0), spine: R(10), chest: R(6, 10), head: R(-12, -30), ...ONE(0.24, 0.8, -0.26, -0.4, 0.92), c_handL: HL(0.16, 0.9, 0.2), ...STAND, ...CAPE(12, 4) }, { in: 'out' }),
    END(26)] };
  {
    const keys = [{ t: F(1), reset: true, use: G, pose: Object.assign({}, LIE, turn(-70, 0, 0, [0, 0, 0], [0, 0.22, 0.8])) }];
    const ball = { hips: RM(30, 15, 0, 0, 0, 0), spine: R(30), chest: R(20, 0), head: R(-40, -10), ...ONE(0.16, 0.9, -0.26, -0.7, -0.2, 0.68), c_handL: HL(0.2, 0.9, 0.16), c_footR: FOOT('R', 0.1, 0.62, 80, -0.12), c_footL: FOOT('L', 0.0, 0.58, 80, 0.12), ...CAPE(30, 10) };
    for (const [f, p] of [[5, 0], [9, 90], [13, 180], [17, 270], [21, 360]]) keys.push(K(f, Object.assign(f === 5 ? Object.assign({}, ball) : {}, turn(p, 0, 0, [0, 0.8, 0], [0, 0.42, 0]))));
    keys.push(K(26, Object.assign(turn(0, 0), { hips: RM(16, 22, 0, 0, -0.36, 0), spine: R(14), chest: R(8, 8), head: R(-20, -28), ...ONE(0.3, 0.7, -0.24, -0.4, 0.92), c_handL: HL(0.2, 0.8, 0.22), ...STAND, ...CAPE(10, 4) }), { in: 'out' }));
    keys.push(END(40));
    C.TechRoll = { fps: 60, keys };
  }

  /* Dizzy (shield broken): a 60-frame loop, swaying on his heels, the sword point on the floor, head lolling. */
  C.Dizzy = { fps: 60, loop: true, keys: [
    START({ hips: RM(-4, 25, 6, 0, -0.06, -0.03), spine: R(-4), chest: R(-6, 10), head: R(14, -20), ...ONE(0.3, 0.7, -0.22, -0.8, 0.6), c_handL: HL(-0.02, 0.9, 0.24) }),
    K(16, { hips: RM(-2, 25, -4, 0, -0.07, -0.01), head: R(10, -40), ...CAPE(4, 2, 6) }),
    K(31, { hips: RM(-4, 25, -8, 0, -0.06, 0.02), head: R(16, -26) }),
    K(46, { hips: RM(-3, 25, 2, 0, -0.07, -0.02), head: R(8, -14), ...CAPE(2, 0, -6) }),
    Object.assign(START({ hips: RM(-4, 25, 6, 0, -0.06, -0.03), spine: R(-4), chest: R(-6, 10), head: R(14, -20), ...ONE(0.3, 0.7, -0.22, -0.8, 0.6), c_handL: HL(-0.02, 0.9, 0.24) }), { t: F(61), lag: CL })] };

  /* ================= batch 6: grabs and throws ================= */

  /* He grabs with his free left hand; the sword hand draws back out of the way. Grab: 30 frames, hit 7-8. DashGrab: 40,
     hit 10-11, out of the run with a lunge. PivotGrab: 36, he turns round on the spot and grabs behind (the root turned 180
     by the grab; the game faces him that way). Hold: a 40-frame loop holding them at arm's length by the collar. */
  const REACHL = (z, y) => Object.assign({ c_handL: HL(z, y, 0.08) }, FIST('L', 60, 50, 20, 15));
  const HOLDING = { hips: RM(4, 30, 0, 0, -0.12, 0.02), spine: R(4), chest: R(4, -10), head: R(-4, -30), ...ONE(0.0, 1.0, -0.34, 0.2, -0.3, -0.93), c_handL: HL(0.5, 1.18, 0.06), ...FIST('L', 90, 75, 30, 25), c_footR: FR(0.12, 0, 0.02), c_footL: FL(-0.2, 0, 0.04) };
  P.hold = HOLDING;
  /* Grab: the left arm swings in one long natural circle: his chest turns away and the hand drops back past his hip and
     rises behind him at shoulder height, the arm long; then the chest whips round, the arm sweeps out to his side and on
     to full reach in front as he steps in. */
  C.Grab = { fps: 60, keys: [
    START(),
    K(3, { hips: RM(6, 40, 0, 0, -0.14, -0.02), spine: R(2), chest: R(2, 22), head: R(-4, -34), ...ONE(0.04, 0.94, -0.36, 0.1, -0.4, -0.9), c_handL: HL(-0.28, 0.98, 0.3), ...FIST('L', 15, 10, 0, 0) }),
    K(5, { hips: RM(4, 44, 0, 0, -0.16, -0.02), spine: R(0), chest: R(-2, 30), head: R(-6, -36), c_handL: HL(-0.58, 1.3, 0.32), ...FIST('L', 5, 5, 0, 0), c_footR: FR(0.24, 0.08, 0.02) }),
    K(6, { hips: RM(8, 36, 0, 0, -0.17, 0.08), spine: R(2), chest: R(4, 4), head: R(-6, -32), c_handL: HL(0.2, 1.3, 0.55), c_footR: FR(0.32, 0.04, 0.02) }, { in: 'snap' }),
    K(7, { hips: RM(12, 30, 0, 0, -0.2, 0.16), spine: R(4), chest: R(8, -26), head: R(-8, -26), ...REACHL(0.8, 1.12), c_footR: FR(0.36, 0, 0.02) }),
    K(8, { ...REACHL(0.82, 1.1) }),
    K(14, { hips: RM(10, 32, 0, 0, -0.18, 0.12), chest: R(6, -20), c_handL: HL(0.66, 1.08, 0.1), ...FIST('L', 40, 30, 10, 10) }, { in: 'out' }),
    K(20, { hips: RM(5, 28, 0, 0, -0.12, 0.05), chest: R(4, -6), c_footR: FR(0.26, 0.08, 0.02) }),
    K(24, { hips: RM(2, 26, 0, 0, -0.1, 0.02), chest: R(4, 4), ...ONE(0.16, 0.88, -0.2, -0.55, 0.83), c_handL: HL(0.14, 1.0, 0.17), ...FREEL, ...STAND }),
    END(30)] };
  C.DashGrab = { fps: 60, keys: [
    { t: F(1), reset: true, use: 'rest', pose: { hips: RM(26, 0, 0, 0, -0.36, 0.04), spine: R(20), chest: R(10, 0), head: R(-52, 0), ...ONE(0.1, 0.65, -0.26, -0.15, -1), c_handL: HL(0.15, 0.9, 0.18), c_footR: FOOT('R', 0.05, 0.12, 35), c_footL: FOOT('L', -0.5, 0.22, 90), ...CAPE(55, 10) } },
    K(6, { hips: RM(20, 20, 0, 0, -0.34, 0.06), chest: R(8, 10), head: R(-30, -20), ...ONE(-0.06, 0.8, -0.34, -0.3, -0.95), c_handL: HL(0.3, 1.0, 0.16), c_footR: FOOT('R', 0.4, 0.1, 0), c_footL: FOOT('L', -0.36, 0.1, 40) }),
    K(10, { hips: RM(22, 34, 0, 0, -0.38, 0.22), chest: R(10, -24), head: R(-30, -26), ...REACHL(0.86, 1.04), c_footR: FOOT('R', 0.62, 0.1, 0) }, { in: 'snap' }),
    K(11, { ...REACHL(0.88, 1.02) }),
    K(22, { hips: RM(16, 32, 0, 0, -0.32, 0.2), chest: R(8, -20), c_handL: HL(0.7, 1.0, 0.1), ...FIST('L', 40, 30, 10, 10) }, { in: 'out' }),
    K(32, { hips: RM(4, 24, 0, 0, -0.14, 0.06), chest: R(4, 4), head: R(-6, -30), ...ONE(0.18, 0.88, -0.2, -0.55, 0.83), c_handL: HL(0.14, 1.0, 0.17), ...FREEL, ...STAND }),
    END(40)] };
  C.PivotGrab = { fps: 60, keys: [
    Object.assign(START(), { pose: Object.assign({}, IDLEARM, { all: R(0, 0) }) }),
    K(4, { all: R(0, 70), hips: RM(8, 30, 0, 0, -0.16, 0), chest: R(6, 10), ...ONE(0.0, 0.94, -0.34, 0.1, -0.4, -0.9), c_handL: HL(0.3, 1.06, 0.2) }),
    K(7, { all: R(0, 150) }),
    K(9, { all: R(0, 180), hips: RM(10, 36, 0, 0, -0.18, 0.06), chest: R(8, -18), c_handL: HL(0.5, 1.1, 0.1) }),
    K(10, { ...REACHL(0.72, 1.12), c_footR: FR(0.26, 0, 0.02) }, { in: 'snap' }),
    K(11, { ...REACHL(0.74, 1.1) }),
    K(20, { hips: RM(8, 34, 0, 0, -0.16, 0.06), chest: R(6, -20), c_handL: HL(0.6, 1.08, 0.1), ...FIST('L', 40, 30, 10, 10) }, { in: 'out' }),
    K(30, { hips: RM(2, 26, 0, 0, -0.1, 0.02), chest: R(4, 4), ...ONE(0.16, 0.88, -0.2, -0.55, 0.83), c_handL: HL(0.14, 1.0, 0.17), ...FREEL, ...STAND }),
    Object.assign(END(36), { pose: Object.assign({}, IDLEARM, { all: R(0, 180) }) })] };
  C.Hold = { fps: 60, loop: true, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(21, { hips: RM(4, 30, 0, 0, -0.13, 0.02), chest: R(5, -11), c_handL: HL(0.5, 1.17, 0.06), ...CAPE(6, 3) }),
    { t: F(41), reset: true, use: [...G, 'hold'], lag: CL }] };
  /* Pummel: 24 frames, hit 7: the hilt driven into them, the blade pointing back past his shoulder. */
  C.Pummel = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(5, { chest: R(4, 10), ...ONE(0.06, 1.12, -0.3, 0.45, -0.3, -0.84) }),
    K(7, { chest: R(6, -24), ...ONE(0.42, 1.12, -0.1, 0.4, -0.88, -0.25) }, { in: 'snap' }),
    K(10, { ...ONE(0.4, 1.12, -0.1, 0.4, -0.88, -0.25) }, { in: 'out' }),
    { t: F(24), reset: true, use: [...G, 'hold'], lag: CL }] };
  /* Throws (the game plays them over 26 frames from the throw). ThrowF (31, released 14): he drags them in and shoves them
     off with the left palm, then cuts after them. ThrowB (44, 7): he swings them round past his hip and flings them behind,
     turning to watch. ThrowU (44, 12): a heave up overhead with the left arm and a rising cut. ThrowD (42, 14): he slams them
     to the floor and stabs down. */
  C.ThrowF = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(8, { hips: RM(2, 36, 0, 0, -0.14, -0.02), chest: R(2, 6), c_handL: HL(0.3, 1.14, 0.06) }),
    K(14, { hips: RM(8, 24, 0, 0, -0.18, 0.1), chest: R(8, -30), head: R(-6, -24), c_handL: HL(0.72, 1.16, 0.04), ...FIST('L', 5, 5, 0, 0), c_footR: FR(0.3, 0, 0.02) }, { in: 'snap' }),
    K(18, { chest: R(6, -6), ...ONE(0.4, 1.2, -0.22, 0.4, 0.92), c_handL: HL(0.5, 1.12, 0.1) }),
    K(20, { chest: R(8, -18), ...ONE(0.5, 1.0, -0.1, -0.3, 0.95) }),
    K(26, { hips: RM(4, 26, 0, 0, -0.14, 0.06), chest: R(6, -6), ...ONE(0.36, 0.9, -0.14, -0.5, 0.86), c_handL: HL(0.2, 1.0, 0.17), ...FREEL }),
    END(31, { pose: Object.assign({}, IDLEARM) })] };
  C.ThrowB = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(4, { hips: RM(4, 10, 0, 0, -0.16, 0), chest: R(4, 30), c_handL: HL(0.3, 1.1, 0.4) }),
    K(7, { hips: RM(4, -30, 0, 0, -0.18, -0.04), chest: R(2, 40), head: R(-4, 20), c_handL: HL(-0.5, 1.12, 0.3), ...FIST('L', 5, 5, 0, 0) }, { in: 'snap' }),
    K(14, { hips: RM(2, -50, 0, 0, -0.16, -0.06), chest: R(0, 30), head: R(-2, 40), c_handL: HL(-0.5, 1.1, 0.34), ...CAPE(14, 6, -14) }, { in: 'out' }),
    K(30, { hips: RM(2, -20, 0, 0, -0.12, -0.03), chest: R(2, 20), head: R(-2, 10), ...ONE(0.2, 0.92, -0.26, -0.4, 0.92), c_handL: HL(0.0, 1.0, 0.2), ...FREEL }),
    END(44)] };
  C.ThrowU = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(6, { hips: RM(10, 30, 0, 0, -0.26, 0.02), spine: R(8), chest: R(8, -6), c_handL: HL(0.4, 0.96, 0.08), c_footR: FR(0.2, 0, 0.02) }),
    K(12, { hips: RM(-6, 26, 0, 0, -0.02, 0.02), spine: R(-6), chest: R(-8, -6), head: R(14, -24), c_handL: HL(0.24, 1.82, 0.1), ...FIST('L', 5, 5, 0, 0) }, { in: 'snap' }),
    K(16, { ...ONE(0.3, 1.4, -0.24, 0.8, 0.6) }),
    K(18, { ...ONE(0.18, 1.72, -0.22, 0.99, -0.1), ...CAPE(-4, 0) }),
    K(30, { hips: RM(2, 26, 0, 0, -0.1, 0.02), spine: R(4), chest: R(4, 6), head: R(-2, -30), ...ONE(0.2, 1.1, -0.26, 0.5, 0.86), c_handL: HL(0.14, 1.0, 0.17), ...FREEL }),
    END(44)] };
  C.ThrowD = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hold'] },
    K(8, { hips: RM(4, 30, 0, 0, -0.14, 0.02), chest: R(2, -8), c_handL: HL(0.46, 1.4, 0.06) }),
    K(14, { hips: RM(24, 26, 0, 0, -0.4, 0.06), spine: R(16), chest: R(14, -6), head: R(-36, -24), c_handL: HL(0.56, 0.3, 0.06), ...FIST('L', 5, 5, 0, 0), c_footR: FR(0.24, 0, 0.02), c_footL: FL(-0.22, 0.04, 0.04, 30), ...CAPE(14, 4) }, { in: 'snap' }),
    K(18, { ...ONE(0.36, 1.1, -0.2, 0.3, 0.95) }),
    K(20, { ...ONE(0.58, 0.72, -0.12, -0.92, 0.38) }, { in: 'snap' }),
    K(26, { ...ONE(0.58, 0.68, -0.12, -0.94, 0.34) }, { in: 'out' }),
    K(34, { hips: RM(4, 24, 0, 0, -0.14, 0.02), spine: R(4), chest: R(4, 8), head: R(-4, -30), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), c_handL: HL(0.14, 1.0, 0.17), ...FREEL, ...STAND }),
    END(42)] };
  /* Held: a 40-frame loop, caught by the collar: lifted onto his toes, leaning back, the free hand pulling at the grip on him. */
  C.Held = { fps: 60, loop: true, keys: [
    START({ hips: RM(-10, 20, 0, 0, -0.04, -0.06), spine: R(-6), chest: R(-8, 6), head: R(-14, -24), ...ONE(0.06, 0.84, -0.34, -0.7, 0.4, -0.6), c_handL: HL(0.3, 1.36, 0.1), c_footR: FOOT('R', 0.1, 0.14, 30), c_footL: FOOT('L', -0.14, 0.12, 30) }),
    K(21, { hips: RM(-8, 20, 4, 0, -0.05, -0.05), head: R(-10, -30), c_handL: HL(0.32, 1.32, 0.12), c_footR: FOOT('R', 0.12, 0.18, 34), ...CAPE(4, 2) }),
    Object.assign(START({ hips: RM(-10, 20, 0, 0, -0.04, -0.06), spine: R(-6), chest: R(-8, 6), head: R(-14, -24), ...ONE(0.06, 0.84, -0.34, -0.7, 0.4, -0.6), c_handL: HL(0.3, 1.36, 0.1), c_footR: FOOT('R', 0.1, 0.14, 30), c_footL: FOOT('L', -0.14, 0.12, 30) }), { t: F(41), lag: CL })] };

  /* ================= batch 7: the ledge ================= */

  /* The game hangs him with his top just under the floor and his front to the stage, about half his width out from the
     edge: the edge's corner is about 0.48 m in front of the root and 1.7 m up. LedgeHang: a 60-frame loop hanging by the
     left hand, the sword arm down along his side, the legs and cape swaying a little. LedgeGrab: 12 frames from the fall
     to the hang. The getups start from the hang and finish standing on the stage, which the game puts at 1.15 m in front
     of where he hung and 1.7 m up, so these clips move the whole body (all) from (0, -1.7, -1.15) up to 0. LedgeGetUp (33),
     LedgeGetUpSlow (60), LedgeAttack (54, hit 24-27), LedgeRoll (49), LedgeJump (20, back into the air). */
  const HANG = { hips: RM(4, 0, 0, 0, 0.02, 0), spine: R(4), chest: R(-2, 0), head: R(-10, 0), c_handL: HL(0.4, 1.74, 0.1), ...FIST('L', 80, 70, 30, 20),
    ...ONE(0.04, 0.92, -0.32, -0.9, 0.1, -0.4), c_footR: FOOT('R', 0.08, 0.06, 40, -0.13), c_footL: FOOT('L', 0.02, 0.1, 40, 0.13), ...CAPE(0, 0) };
  P.hang = HANG;
  C.LedgeHang = { fps: 60, loop: true, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'] },
    K(31, { hips: RM(6, 4, 0, 0, 0.02, 0.01), chest: R(-1, 2), c_footR: FOOT('R', 0.12, 0.08, 38, -0.13), c_footL: FOOT('L', 0.06, 0.12, 36, 0.13), ...ONE(0.06, 0.92, -0.33, -0.88, 0.15, -0.45), ...CAPE(3, 1, 3) }),
    { t: F(61), reset: true, use: [...G, 'hang'], lag: CL }] };
  C.LedgeGrab = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...AIR, 'fall'], pose: { c_handL: HL(0.44, 1.8, 0.14) } },
    K(4, { c_handL: HL(0.4, 1.74, 0.1), hips: RM(14, 0, 0, 0, 0.06, 0.04), ...FIST('L', 80, 70, 30, 20) }),
    K(7, Object.assign({}, HANG, { hips: RM(-6, 0, 0, 0, 0.0, -0.06), c_footR: FOOT('R', 0.2, 0.2, 30, -0.13), ...CAPE(30, 10) }), { in: 'out' }),
    { t: F(12), reset: true, use: [...G, 'hang'], lag: CL }] };
  const UP = (f, x, y, z) => ({ all: M(x || 0, y, z) });
  C.LedgeGetUp = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'], pose: UP(1, 0, -1.7, -1.15) },
    K(8, { ...UP(0, 0, -1.3, -0.9), hips: RM(30, 0, 0, 0, 0.1, 0.1), spine: R(20), chest: R(10, 0), head: R(-30, 0), c_handL: HL(0.3, 1.2, 0.2), ...ONE(0.1, 1.24, -0.34, -0.5, 0.86), c_footR: FOOT('R', 0.3, 0.7, 60, -0.13), c_footL: FOOT('L', 0.0, 0.4, 70, 0.13), ...CAPE(30, 10) }),
    K(16, { ...UP(0, 0, -0.3, -0.25), hips: RM(30, 10, 0, 0, -0.3, 0.1), spine: R(20), chest: R(10, 4), head: R(-36, -20), c_handL: HL(0.2, 0.6, 0.22), ...ONE(0.3, 0.6, -0.26, -0.3, 0.95), c_footR: FOOT('R', 0.2, 0.2, 30, -0.13), c_footL: FOOT('L', -0.2, 0.3, 60, 0.13), ...FREEL }),
    K(24, { ...UP(0, 0, 0, 0), hips: RM(10, 22, 0, 0, -0.26, 0), spine: R(10), chest: R(6, 10), head: R(-14, -30), c_handL: HL(0.2, 0.86, 0.2), ...ONE(0.26, 0.8, -0.24, -0.5, 0.86), ...STAND, ...CAPE(8, 3) }, { in: 'out' }),
    END(33, { pose: Object.assign({ all: M(0, 0, 0) }, IDLEARM) })] };
  C.LedgeGetUpSlow = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'], pose: UP(1, 0, -1.7, -1.15) },
    K(14, { ...UP(0, 0, -1.6, -1.1), hips: RM(10, 0, 0, 0, 0.0, 0.0), c_handL: HL(0.42, 1.76, 0.1), ...ONE(0.34, 1.7, -0.3, 0.2, 0.98), c_footR: FOOT('R', 0.14, 0.2, 40, -0.13) }),
    K(28, { ...UP(0, 0, -1.2, -0.85), hips: RM(36, 0, 0, 0, 0.06, 0.1), spine: R(24), chest: R(14, 0), head: R(-36, 0), c_handL: HL(0.3, 1.2, 0.2), ...ONE(0.3, 1.18, -0.3, 0.0, 1), c_footR: FOOT('R', 0.3, 0.7, 60, -0.13), c_footL: FOOT('L', 0.0, 0.36, 70, 0.13), ...CAPE(24, 8) }),
    K(40, { ...UP(0, 0, -0.25, -0.2), hips: RM(30, 10, 0, 0, -0.34, 0.1), spine: R(20), chest: R(10, 4), head: R(-36, -20), c_handL: HL(0.2, 0.6, 0.22), ...ONE(0.3, 0.6, -0.26, -0.3, 0.95), c_footR: FOOT('R', 0.2, 0.2, 30, -0.13), c_footL: FOOT('L', -0.2, 0.3, 60, 0.13), ...FREEL }),
    K(50, { ...UP(0, 0, 0, 0), hips: RM(8, 22, 0, 0, -0.2, 0), spine: R(8), chest: R(6, 10), head: R(-10, -30), c_handL: HL(0.18, 0.9, 0.2), ...ONE(0.24, 0.84, -0.22, -0.5, 0.86), ...STAND }, { in: 'out' }),
    END(60, { pose: Object.assign({ all: M(0, 0, 0) }, IDLEARM) })] };
  C.LedgeAttack = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'], pose: UP(1, 0, -1.7, -1.15) },
    K(8, { ...UP(0, 0, -1.3, -0.9), hips: RM(30, 0, 0, 0, 0.1, 0.1), spine: R(20), chest: R(10, 0), head: R(-30, 0), c_handL: HL(0.3, 1.2, 0.2), ...ONE(0.1, 1.24, -0.34, -0.5, 0.86), c_footR: FOOT('R', 0.3, 0.7, 60, -0.13), c_footL: FOOT('L', 0.0, 0.4, 70, 0.13), ...CAPE(30, 10) }),
    K(16, { ...UP(0, 0, -0.3, -0.25), hips: RM(24, 30, 0, 0, -0.34, 0.04), spine: R(16), chest: R(10, 30), head: R(-30, -30), c_handL: HL(0.2, 0.6, 0.22), ...ONE(0.04, 0.6, -0.4, -0.3, 0.3, -0.9), c_footR: FOOT('R', 0.2, 0.2, 30, -0.13), c_footL: FOOT('L', -0.2, 0.3, 60, 0.13), ...FREEL }),
    K(22, { ...UP(0, 0, 0, 0), hips: RM(14, 30, 0, 0, -0.3, 0), chest: R(8, 34), ...ONE(0.04, 0.6, -0.44, -0.3, 0.25, -0.92), ...STAND }),
    K(23, { ...ONE(0.08, 0.6, -0.44, -0.3, 0.3, -0.9) }),
    K(24, { hips: RM(14, 14, 0, 0, -0.28, 0.06), chest: R(10, 6), head: R(-14, -24), ...ONE(0.5, 0.68, -0.18, -0.2, 0.98, -0.05), c_footR: FR(0.3, 0, 0.02) }, { in: 'snap' }),
    K(25, { chest: R(10, -12), ...ONE(0.46, 0.7, 0.08, -0.2, 0.6, 0.77) }),
    K(27, { chest: R(10, -24), ...ONE(0.32, 0.72, 0.2, -0.2, 0.1, 0.97), ...CAPE(14, 5, 10) }, { in: 'out' }),
    K(40, { hips: RM(6, 20, 0, 0, -0.18, 0.04), chest: R(6, -10), ...ONE(0.3, 0.8, 0.1, -0.3, 0.4, 0.86) }),
    K(48, { hips: RM(2, 24, 0, 0, -0.1, 0.01), chest: R(4, 8), ...ONE(0.22, 0.9, -0.2, -0.5, 0.86), ...STAND }),
    END(54, { pose: Object.assign({ all: M(0, 0, 0) }, IDLEARM) })] };
  C.LedgeRoll = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'], pose: Object.assign(UP(1, 0, -1.7, -1.15)) },
    K(8, { ...UP(0, 0, -1.2, -0.95), hips: RM(30, 0, 0, 0, 0.1, 0.1), spine: R(20), chest: R(10, 0), head: R(-30, 0), c_handL: HL(0.3, 1.2, 0.2), ...ONE(0.06, 0.96, -0.3, -0.7, -0.7), c_footR: FOOT('R', 0.3, 0.7, 60, -0.13), c_footL: FOOT('L', 0.0, 0.4, 70, 0.13), ...CAPE(30, 10) }),
    ...[[14, 0, -0.4, -0.6, 0], [18, 0, -0.1, -0.3, 120], [22, 0, 0, -0.1, 240], [26, 0, 0, 0, 340]].map(([f, x, y, z, d]) => K(f, Object.assign({ all: RM(0, d, 0, x, y, z) },
      f === 14 ? { hips: RM(20, 10, 0, 0, -0.42, 0.02), spine: R(14), chest: R(8, 0), head: R(-30, -10), c_handL: HL(0.2, 0.86, 0.24), c_footR: FOOT('R', 0.14, 0.14, 40, -0.14), c_footL: FOOT('L', -0.12, 0.16, 45, 0.14), ...FREEL, ...CAPE(40, 14, 25) } : {}))),
    K(34, { all: RM(0, 360, 0, 0, 0, 0), hips: RM(6, 22, 0, 0, -0.18, 0), spine: R(6), chest: R(4, 8), head: R(-6, -30), ...ONE(0.18, 0.9, -0.22, -0.5, 0.86), c_handL: HL(0.15, 1.0, 0.18), ...STAND, ...CAPE(10, 4) }),
    END(49, { pose: Object.assign({ all: RM(0, 360, 0, 0, 0, 0) }, IDLEARM) })] };
  C.LedgeJump = { fps: 60, keys: [
    { t: F(1), reset: true, use: [...G, 'hang'] },
    K(4, { hips: RM(20, 0, 0, 0, 0.1, 0.06), c_handL: HL(0.36, 1.6, 0.14), c_footR: FOOT('R', 0.3, 0.5, 30, -0.13), c_footL: FOOT('L', 0.2, 0.4, 40, 0.13) }),
    K(9, { hips: RM(-6, 15, 0, 0, 0.04, 0), spine: R(-4), chest: R(-6, 4), head: R(6, -20), ...ONE(0.04, 0.94, -0.3, -0.62, -0.78), c_handL: HL(0.26, 1.42, 0.2), ...FREEL, c_footR: FOOT('R', 0.02, 0.11, 55), c_footL: FOOT('L', -0.12, 0.13, 62), ...CAPE(-4, 0) }, { in: 'out' }),
    AEND(20)] };

  /* ================= batch 8: taunt, victory, entrance, idle variety ================= */

  /* Taunt: 90 frames. He brings the blade up before his face, flat to the camera, holds it there a beat with his eyes along
     it, then flicks it down and out to his side and settles. */
  C.Taunt = { fps: 60, keys: [
    START(),
    K(12, { hips: RM(0, 20, 0, 0, -0.06, 0), chest: R(0, 6), head: R(-4, -28), ...ONE(0.22, 1.2, -0.18, 0.99, 0.08, 0.05), c_handL: HL(0.0, 1.0, 0.2) }),
    K(18, { head: R(-2, -20), ...ONE(0.24, 1.26, -0.12, 1, 0.04, 0.0), c_handL: HL(0.22, 1.5, 0.04), ...FIST('L', 10, 5, 0, 0) }, { in: 'out' }),
    K(52, { head: R(-3, -22), ...ONE(0.24, 1.27, -0.12, 1, 0.04, 0.0), c_handL: HL(0.22, 1.48, 0.06) }),
    K(58, { hips: RM(2, 30, 0, 0, -0.08, 0), chest: R(2, 20), head: R(0, -36), ...ONE(0.1, 0.92, -0.5, -0.5, 0.2, -0.85), c_handL: HL(0.12, 1.0, 0.17), ...FREEL, ...CAPE(10, 4, -12) }, { in: 'snap' }),
    K(72, { hips: RM(1, 26, 0, 0, -0.08, 0), chest: R(3, 12), ...ONE(0.12, 0.88, -0.36, -0.6, 0.4, -0.7) }, { in: 'out' }),
    END(90)] };
  /* Idle 2: 200 frames now and then from the idle: he turns the sword over and looks down the edge, then lets it hang again. */
  C.Idle2 = { fps: 60, keys: [
    START(),
    K(30, { hips: RM(0, 22, 0, 0, -0.07, 0), chest: R(4, 4), head: R(16, -12), ...ONE(0.3, 1.06, -0.12, 0.5, 0.86, 0.1, { c_sword: SW(0.5, 0.86, 0.1, 30) }), c_handL: HL(0.26, 1.06, 0.12) }),
    K(80, { head: R(18, -6), ...ONE(0.3, 1.08, -0.12, 0.55, 0.83, 0.1, { c_sword: SW(0.55, 0.83, 0.1, -60) }) }),
    K(130, { head: R(14, -16), ...ONE(0.3, 1.06, -0.12, 0.5, 0.86, 0.1, { c_sword: SW(0.5, 0.86, 0.1, 90) }) }),
    K(170, { hips: RM(0, 25, 0, 0, -0.07, 0), chest: R(4, 10), head: R(0, -32), ...ONE(0.22, 0.86, -0.16, -0.5, 0.86), c_handL: HL(0.12, 1.02, 0.17) }),
    END(200)] };
  /* Victory poses. Win1 (150): a flourish, the blade whirled round at his side and brought up point high, the cape thrown back.
     Win2 (150): he drives the sword point into the ground in front and rests both hands on the pommel. Win3 (150): back to
     the camera, he looks over his shoulder and sheathes the stance with the blade low behind him. Entrance (90): he drops in
     from above in a crouch, the cape billowing, and rises into the guard. */
  C.Win1 = { fps: 60, keys: [
    START(),
    K(14, { ...ONE(0.2, 1.0, -0.4, 0.0, 0.3, -0.95, { c_sword: SW(0.0, 0.3, -0.95, 0) }) }),
    K(22, { ...ONE(0.06, 1.1, -0.44, 0.95, -0.3, 0, { c_sword: SW(0.95, -0.3, 0, 0) }) }),
    K(30, { ...ONE(-0.06, 1.0, -0.42, 0.0, -0.3, -0.95, { c_sword: SW(0.0, -0.3, -0.95, 0) }) }),
    K(38, { ...ONE(0.06, 0.9, -0.42, -0.95, 0.3, 0, { c_sword: SW(-0.95, 0.3, 0, 0) }) }),
    K(48, { hips: RM(-4, 30, 0, 0, -0.04, 0), spine: R(-4), chest: R(-6, 20), head: R(10, -36), ...ONE(0.3, 1.8, -0.24, 0.96, 0.25), c_handL: HL(-0.1, 1.0, 0.24), ...CAPE(30, 10, 10) }, { in: 'back' }),
    K(150, { hips: RM(-3, 30, 0, 0, -0.04, 0), chest: R(-5, 20), head: R(8, -36), ...ONE(0.3, 1.8, -0.24, 0.96, 0.25), ...CAPE(6, 2) })] };
  C.Win2 = { fps: 60, keys: [
    START(),
    K(20, { hips: RM(0, 0, 0, 0, -0.04, 0), chest: R(-2, 0), head: R(-6, 0), ...TWO(0.38, 1.2, 0.0, 0.95, 0.3, 0), c_footR: FR(0.0, 0, -0.02), c_footL: FL(0.0, 0, 0.02) }),
    K(25, { ...TWO(0.42, 1.18, 0.0, 0.1, 0.99, 0) }),
    K(28, { ...TWO(0.42, 1.1, 0.0, -0.75, 0.66, 0) }),
    K(30, { ...TWO(0.42, 1.06, 0.0, -0.99, 0.12, 0, { c_sword: SW(-0.99, 0.12, 0, 0) }) }, { in: 'snap' }),
    K(150, { hips: RM(0, 0, 0, 0, -0.05, 0), head: R(-4, 0), ...TWO(0.42, 1.04, 0.0, -0.99, 0.12, 0, { c_sword: SW(-0.99, 0.12, 0, 0) }), ...CAPE(2, 1) })] };
  C.Win3 = { fps: 60, keys: [
    START(),
    K(24, { all: R(0, 160), hips: RM(0, 25, 0, 0, -0.05, 0), head: R(-4, 60), ...ONE(-0.1, 0.86, -0.3, -0.7, -0.7), c_handL: HL(0.0, 1.0, 0.2), ...CAPE(14, 5) }),
    K(60, { all: R(0, 160), head: R(-6, 70) }),
    K(150, { all: R(0, 160), head: R(-4, 68), ...CAPE(3, 1) })] };
  C.Entrance = { fps: 60, keys: [
    { t: F(1), reset: true, use: AIR, pose: { all: M(0, 2.5, 0), ...CAPE(80, 20) } },
    K(14, { all: M(0, 0, 0), hips: RM(26, 20, 0, 0, -0.52, 0), spine: R(16), chest: R(10, 6), head: R(-36, -26), ...ONE(0.5, 0.36, -0.08, 0.3, 0.72, 0.62), c_handL: HL(0.26, 0.18, 0.3), c_footR: FR(0.1, 0, 0.02), c_footL: FOOT('L', -0.22, 0.16, 76, 0.15), ...CAPE(60, 10) }, { in: 'snap' }),
    K(40, { hips: RM(24, 20, 0, 0, -0.5, 0), ...CAPE(4, 0) }),
    K(60, { hips: RM(4, 25, 0, 0, -0.1, 0), spine: R(5), chest: R(5, 10), head: R(-4, -32), ...ONE(0.3, 1.0, -0.28, 0.35, 0.94), c_handL: HL(0.12, 1.0, 0.17), ...STAND, ...CAPE(6, 2) }),
    END(90)] };
  /* Respawn: a 60-frame loop on the platform, guard up and still. */
  C.Respawn = { fps: 60, loop: true, keys: [{ t: F(1), reset: true, use: G, pose: READY }, K(31, { hips: RM(0, 25, 0, 0, -0.11, 0), ...CAPE(6, 3) }), { t: F(61), reset: true, use: G, pose: READY, lag: CL }] };

  /* first active frame of each strike, for anim-qa.py (the blade's biggest step lands there) */
  return {
    Jab1: [4, 7], Jab2: [5, 9], TiltF: [7, 10], TiltU: [6, 12], TiltD: [7, 9], DashAttack: [12, 15], SmashU: [13, 16], SmashD: [5, 7, 12], AirB: [7, 11, 31], AirU: [5, 8], AirD: [6, 9],
    SpecN: [16, 21], SpecNRelease: [6, 10], SpecS1: [6, 8], SpecS2U: [12, 15], SpecS2S: [14, 16], SpecS3U: [13, 17], SpecS3S: [11, 14], SpecS3D: [15, 18], SpecS4U: [20, 25], SpecS4S: [23, 26],
    SpecU: [5, 10], SpecDHit: [3, 9], GetUpAttack: [22, 23], LedgeAttack: [24, 27] };
};
