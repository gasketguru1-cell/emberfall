'use strict';
/* Which animation a fighter shows this frame, and how far through it. A pure function of simulation state:
   the simulation decides everything, this only describes it, so animation can never delay an input or move a hitbox.

   Returns { key, mode, v, seg }:
     mode 'loop'  : v is a time in seconds to wrap around the clip
     mode 'cycle' : v counts whole cycles of the clip (walk and run: driven by distance travelled, not by time)
     mode 'phase' : v is 0..1 through the clip
     mode 'marks' : an attack. seg is 0 startup, 1 active, 2 recovery; v is 0..1 inside that part. The renderer
                    stretches the clip's own startup / contact / recovery sections onto the move's real frame data. */
function animState(f) {
  const st = f.st, s = f.state, t = tick / 60, phase = (a, b) => b > 0 ? Math.min(1, Math.max(0, a / b)) : 1;
  switch (s) {
    case 'idle':
      if (f.grounded && Math.abs(f.vx) > 0.25) return { key: 'walk', mode: 'cycle', v: f.x * f.face / 40 };   /* driven by distance travelled */
      if (f.ctl.c.ly < CROUCH_Y) return { key: 'crouch', mode: 'phase', v: 1 };
      return { key: 'idle', mode: 'loop', v: t };
    case 'dash': case 'run': return { key: 'run', mode: 'cycle', v: f.x * f.face / 46 };
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
      if (!m.h.length) return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: phase(f.mf, m.t), whole: true };   /* no hitbox of its own (projectile moves): play straight through */
      const a0 = Math.min(...m.h.map(h => h.f0)), a1 = Math.max(...m.h.map(h => h.f1));
      if (f.mf < a0) return { key: 'attack', move: f.mname, mode: 'marks', seg: 0, v: phase(f.mf, a0), charge: f.charge };
      if (f.mf <= a1) return { key: 'attack', move: f.mname, mode: 'marks', seg: 1, v: phase(f.mf - a0, a1 - a0 + 1) };
      return { key: 'attack', move: f.mname, mode: 'marks', seg: 2, v: phase(f.mf - a1, m.t - a1) };
    }
  }
  return { key: 'idle', mode: 'loop', v: t };
}
