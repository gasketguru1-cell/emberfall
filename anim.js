'use strict';
/* Which animation a fighter shows this frame, and how far through it. A pure function of simulation state:
   the simulation decides everything, this only describes it, so animation can never delay an input or move a hitbox.

   Returns { key, mode, v, seg }:
     mode 'loop'  : v is a time in seconds to wrap around the clip
     mode 'cycle' : v counts whole cycles of the clip (walk and run: driven by distance travelled, not by time)
     mode 'phase' : v is 0..1 through the clip
     mode 'marks' : an attack. seg is 0 startup, 1 active, 2 recovery; v is 0..1 inside that part. The renderer
                    stretches the clip's own startup / contact / recovery sections onto the move's real frame data. */
function animBase(f) {
  const st = f.st, s = f.state, t = tick / 60, phase = (a, b) => b > 0 ? Math.min(1, Math.max(0, a / b)) : 1;
  /* A hopper's walk and run are one hop each: the first 70% of the clip while it is moving, the rest while it is planted. */
  const hopV = (c, n) => { const len = c[0] + c[1], ph = ((n % len) + len) % len; return ph < c[0] ? ph / c[0] * 0.7 : 0.7 + (ph - c[0]) / c[1] * 0.3; };
  switch (s) {
    case 'idle':
      if (st.hop && f.grounded && Math.abs(f.ctl.c.lx) > 0.2) return { key: 'walk', mode: 'phase', v: hopV(st.hop.walk, f.hopT - 1) };
      if (f.grounded && Math.abs(f.vx) > 0.25) return { key: 'walk', mode: 'cycle', v: f.x * f.face / 40 };   /* driven by distance travelled */
      if (f.ctl.c.ly < CROUCH_Y) return { key: 'crouch', mode: 'phase', v: 1 };
      return { key: 'idle', mode: 'loop', v: t };
    case 'dash': case 'run':
      if (st.hop) return { key: 'run', mode: 'phase', v: s === 'dash' ? phase(f.sf, st.dashF) * 0.7 : hopV(st.hop.run, f.hopT - 1) };
      return { key: 'run', mode: 'cycle', v: f.x * f.face / 46 };
    case 'brake': return { key: 'brake', mode: 'phase', v: phase(f.sf, 12) };
    case 'jsq': return { key: 'jumpsquat', mode: 'phase', v: phase(f.sf, st.jsq) };
    case 'air': return f.vy > 0.2 ? { key: 'rise', mode: 'phase', v: 1 - phase(f.vy, st.vJump) } : { key: 'fall', mode: 'loop', v: t };
    case 'helpless': return { key: 'fall', mode: 'loop', v: t * 1.6 };
    case 'land': return { key: 'land', mode: 'phase', v: phase(f.sf, Math.max(4, f.lag)) };
    case 'wd': return { key: 'land', mode: 'phase', v: 0.25 };
    case 'shield': case 'shieldstun': return { key: 'shield', mode: 'phase', v: phase(f.sf + (s === 'shieldstun' ? 3 : 0), 3) };
    case 'shieldoff': return { key: 'shield', mode: 'phase', v: 1 - phase(f.sf, 11) };
    case 'spot': return { key: 'dodge', mode: 'phase', v: phase(f.sf, 22) };
    case 'roll': return { key: 'roll', mode: 'phase', v: phase(f.sf, 28) };
    case 'airdodge': return { key: 'airdodge', mode: 'phase', v: phase(f.sf, 40) };
    case 'hurt': return f.grounded ? { key: 'hit', mode: 'phase', v: phase(f.sf, Math.max(8, f.hitstun)) } : { key: 'tumble', mode: f.tumble ? 'loop' : 'phase', v: f.tumble ? f.sf / 40 : phase(f.sf, Math.max(8, f.hitstun)) };
    case 'down': return { key: 'down', mode: 'phase', v: phase(f.sf, 14) };
    case 'broken': return { key: f.grounded ? 'dizzy' : 'tumble', mode: 'loop', v: t };
    case 'ledge': return { key: 'ledge', mode: 'loop', v: t };
    case 'hold': return { key: 'hold', mode: 'loop', v: t };
    case 'held': return { key: 'held', mode: 'loop', v: t };
    case 'throw': return { key: 'throw', mode: 'phase', v: phase(f.sf, 26) };
    case 'respawn': return { key: 'idle', mode: 'loop', v: t };
    case 'rebound': return { key: 'hit', mode: 'phase', v: phase(f.sf, Math.max(8, f.lag)) };
    case 'attack': {
      const m = f.move; if (!m) break;
      if (m.swap) return { key: 'swap', mode: 'phase', v: phase(f.mf, m.t) };
      if (m.sel) {   /* the bird selector: the pouch draws back while Neutral B is held (and stays there while the wheel is open), then the swap plays from wherever it was let go */
        const pull = 0.43;
        if (!f.selDone) return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: phase(Math.min(f.mf, 9), 9) * pull, whole: true };
        const a = phase(f.selRel || 0, 9) * pull; return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: a + (1 - a) * phase(f.mf - (m.t - SEL_SWAP), SEL_SWAP), whole: true };
      }
      if (!m.h.length) return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: phase(f.mf, m.t), whole: true };   /* no hitbox of its own (projectile moves): play straight through */
      const a0 = Math.min(...m.h.map(h => h.f0)), a1 = Math.max(...m.h.map(h => h.f1));
      if (f.mf < a0) return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: phase(f.mf, a0), charge: f.charge };
      if (f.mf <= a1) return { key: 'attack', move: f.mname, mode: 'marks', seg: 1, v: phase(f.mf - a0, a1 - a0 + 1) };
      return { key: 'attack', move: f.mname, mode: 'marks', seg: 2, v: phase(f.mf - a1, m.t - a1) };
    }
  }
  return { key: 'idle', mode: 'loop', v: t };
}

/* Variants a fighter's model may have. Each is offered as `alt`: the renderer uses it only when the model has that clip, so
   every fighter without one shows exactly what it showed before. Like everything here, a pure reading of simulation state.
   mode 'once' plays v seconds into the clip and is dropped once the clip has run out. */
function animAlt(f, a) {
  const s = f.state, t = tick / 60, phase = (x, n) => n > 0 ? Math.min(1, Math.max(0, x / n)) : 1, nm = f.form && f.form.name;
  switch (s) {
    case 'idle':
      if (a.key === 'idle' && f.sf > 300) { const k = (f.sf - 300) % 480; if (k < 200) return { key: 'idle2', mode: 'once', v: k / 60 }; }   /* now and then, after standing still five seconds */
      return null;
    case 'air': if (f.ff && f.vy < 0) return { key: 'fastfall', mode: 'loop', v: t };
      if (f.vy > 0.2 && f.jumps < (f.st.jumps || 1) && f.st.vAir) return { key: 'airjump', mode: 'phase', v: 1 - phase(f.vy, f.st.vAir) };   /* the second jump has its own move */
      return null;
    case 'helpless': return { key: 'helpless', mode: 'loop', v: t };
    case 'hold': return f.pumT > 0 ? { key: 'pummel', mode: 'phase', v: 1 - phase(f.pumT, 14) } : null;   /* a pummel: 14 frames from the press */
    case 'land': return f.lag >= 9 ? { key: 'landHard', mode: 'phase', v: a.v } : null;
    case 'shieldstun': return { key: 'shieldHit', mode: 'phase', v: phase(f.sf, 10) };
    case 'respawn': return { key: 'respawn', mode: 'loop', v: t };
    case 'throw': return f.throwK ? { key: 'throw_' + f.throwK, mode: 'phase', v: phase(f.sf, 26) } : null;
    case 'hurt': {
      const ax = Math.abs(f.vx);
      if (f.grounded) return f.hitstun >= 20 ? { key: 'hitHeavy', mode: 'phase', v: phase(f.sf, Math.max(8, f.hitstun)) } : null;
      if (f.sf < 40 && f.vy < -1 && -f.vy > ax) return { key: 'spike', mode: 'phase', v: phase(f.sf, 40) };   /* driven downward */
      if (f.sf < 40 && f.vy > 1.2 && f.vy > ax * 1.5) return { key: 'launchUp', mode: 'phase', v: phase(f.sf, 40) };
      if (f.sf < 30 && f.tumble) return { key: 'launch', mode: 'phase', v: phase(f.sf, 30) };
      if (!f.tumble && f.hitstun >= 20) return { key: 'hitHeavy', mode: 'phase', v: phase(f.sf, Math.max(8, f.hitstun)) };
      return null;
    }
    case 'attack': {
      const m = f.move; if (!m) return null;
      if (nm === 'Potato Sack' && f.mname === 'nspec') return !f.scRel ? { key: 'spudCharge', mode: 'loop', v: t * (1 + Math.min(2, (f.scC || 0) / 60)) } : { key: 'spudBurst', mode: 'phase', v: phase(f.mf - f.scRel, 24) };   /* the shake quickens as it charges */
      if (nm === 'Potato Sack' && f.mname === 'dspec') {
        if (f.mf < 6 || !f.burstKind) return { key: 'tumble_prep', mode: 'phase', v: phase(f.mf, 6) };
        return { key: 'tumble_' + (f.burstKind === 'slide' && !f.grounded ? 'drop' : f.burstKind), mode: 'phase', v: phase(f.mf - 6, m.t - 6) };   /* a slide that leaves the ground has dropped through a platform or off an edge */
      }
      if (nm === 'Chomp Chomp') {
        if (f.mname === 'nspec') {   /* what B did this time (sim.js chompNspec): toss the coal, relay it, call the ant, or nothing */
          if (f.ccAct === 'relay') return { key: 'coalFlick', mode: 'phase', v: phase(f.mf - (m.t - 8), 8) };
          if (f.ccAct === 'ant') return { key: 'antCall', mode: 'phase', v: f.mf <= 10 ? phase(f.mf, 10) * 0.55 : 0.55 + phase(f.mf - (m.t - 8), 8) * 0.45 };
          if (f.ccAct === 'none') return { key: 'coalNone', mode: 'phase', v: phase(f.mf - (m.t - 6), 6) };
          return { key: 'coalToss', mode: 'phase', v: phase(f.mf, m.t) };
        }
        if (f.mname === 'sspec') return f.rsGo ? { key: 'ropeSwing', mode: 'loop', v: t } : { key: 'ropeToss', mode: 'phase', v: phase(f.mf, 11) };   /* hooks the rope on frame 11, then hangs from it */
        if (f.mname === 'uspec') return f.bubble ? { key: 'bubbleRide', mode: 'loop', v: t } : { key: 'bubbleBlow', mode: 'phase', v: phase(f.mf, 8) };   /* the bubble forms on frame 8 */
      }
      if (f.def && f.def.fowl && f.mname === 'nspec' && f.selOpen) return { key: 'selecting', mode: 'loop', v: t };
      return null;
    }
  }
  return null;
}
function animState(f) { const a = animBase(f), alt = animAlt(f, a); if (alt) a.alt = alt; return a; }
