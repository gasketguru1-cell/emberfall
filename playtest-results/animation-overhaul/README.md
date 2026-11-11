# Animation overhaul: Furious Fowls and Potato Sack

Branch `anim-overhaul`. No Meshy credits were used: the Meshy ledger and budget files are unchanged. No assets were bought and no paid services were used. Every model is the existing mesh, re-rigged and re-animated in Blender 5.2 by script, plus geometry built in code (the slingshot).

## What I found (audit)

- **Renderer:** Three.js (WebGL) with skinned GLB models. Each fighter has one GLB of clips.
- **How animation follows the game:** `anim.js` turns game state into "which clip, how far through". Attacks are stretched onto their real startup, active and recovery frames using markers.
- **Pipeline:** `tools/blender/rig.py` builds the skeleton from a JS spec, weights the Meshy mesh, keys the clips and exports. `tools/pack.mjs` makes the game file.
- **Potato Sack:**
  - 13 bones, 24 clips.
  - Jab and forward tilt shared one clip. Dash attack, forward smash and forward air shared "Slam". Up tilt, up smash and up air shared "Uppercut".
  - Every special used a borrowed clip, and Tumble showed the neutral air spin whatever its direction.
  - The game has no taunt, victory, defeat or tech states, and no ledge hold for him (by design).
- **The five birds:**
  - One 10-bone skeleton and **one identical clip set for all five**, so no personalities.
  - In the pouch, neutral air and up B played a static "Hold".
  - There was no clip for rejoining.
  - The Pip companions were frozen copies of the model.
- **The slingshot:** a rigid group of meshes that only leaned and squashed as a whole. The bands and pouch never moved.
- **Hit reactions:** one "Hit" on the ground and one "Tumble" in the air, whatever the hit.
- **A timing bug in every model built before this:** Blender's export places every key one frame (1/30 s) late. Fixed for these six models (`rig.py --start 0`). The other fighters are untouched.

## What changed

### Tools (reusable)

- **`tools/blender/rig.py`:**
  - eased keys: `in: back` (overshoot and settle), `snap`, `out`, `elastic`, `hold`;
  - real bone **scale**, so squash and stretch deforms the mesh;
  - `--start 0` for exact key timing;
  - `--blend` to save the scene.
- **`tools/blender/build-anim.sh`:** rebuilds all six models in one command, about 90 s.
- **`tools/anim-review.js`:** frame-by-frame contact sheets from the running game, used for every check below (`playtest-results/anim-review/`).
- **`tools/anim-clips.js`:** records the before and after clips.

### Game (rendering only: no move, frame, hitbox or physics changes)

- **`anim.js` variants:** extra cues, each used only by a model that has the clip, so other fighters render exactly as before:
  - light and heavy hits, launched up, spiked, launched away (from the real knockback direction);
  - hard landings, fast fall, shield hits, a throw per direction, respawn;
  - an idle variation after 5 s standing still;
  - Spud Bomb charge and burst;
  - Tumble by burst direction, including drop-through.
- **`render3d.js` "feel" layer** (Potato Sack and the birds only):
  - whole-body squash and stretch kicked by landings (scaled by fall speed), take-offs, hits and strikes;
  - lean into air drift;
  - hit-freeze shake along the knockback direction.
- **Living slingshot** (built in code):
  - the trunk bends at the base and again at the fork;
  - the two bands are redrawn every frame from the fork tips to the pouch, and thin as they stretch;
  - the pouch hangs on a spring (overshoot, follow-through), and the bird rides it.
  - It is posed from the game state:
    - idle breathing and walk steps;
    - a lean into runs and a skid on braking;
    - squash on jump-squat and landings;
    - each normal: wind-up lean, strike, settle;
    - bending away from hits;
    - Catapult Cyclone: the bands stretch back and the trunk leans further with charge;
    - Side B: drawn back, then fired;
    - Sling Spin and Cyclone: the pouch is flung outward;
    - the empty slingshot recoils when fired, then stands slack;
    - the bands take the bird's weight on rejoining.
- **Pip's companions:** they fly and idle with their own animation, staggered in time.

### Potato Sack: 64 clips (was 24)

| Kind | Clips |
|---|---|
| Movement | Idle, Idle2 (looks around, shake-out hop), Hop (walk), Bound (run: long, low, leaning), Skid, Crouch, Rise, Fall, FastFall, Land, LandHard, AirDodge, Dodge, Respawn |
| Defence and hits | Shield, ShieldHit, Hit, HitHeavy, LaunchUp, Launch, Spike, Tumble, Down, Held |
| Ground attacks | Jab1, Jab2, Jab3, Ftilt, Utilt, Dtilt, Belly (dash attack), Fsmash, Usmash, Dsmash, Grab, Hold |
| Air attacks | Spin (neutral air), Axe (forward air), BackKick, Juggle (up air), Stomp (down air) |
| Throws | ThrowF, ThrowB, ThrowU, ThrowD, ThrowS (Bag It) |
| Specials | HotPotato (burst keyed to frame 5), SpudCharge (shake speeds up with charge), SpudBurst (blast on its 4th frame), BagIt, TumblePrep, TumbleLift (corkscrew), TumbleSlide (flattened roll), TumbleDive, TumbleStall (spin in place), TumbleDrop (stretched roll through a platform) |

Attacks use one layout: wind-up to 0.3 s, strike at 0.34 s, contact held, overshoot, settled by 0.9 s. The strike is placed on the first active frame. I checked this in the game: during hit-freeze the contact pose is what shows.

### The birds: 49 clips each, five personalities

Each bird has its own tempo, weight, lean, wing activity, bob height and strike sharpness, all used in every clip. Each also has its own Idle, Idle2 and Select (its entrance on the selector).

| Bird | Idle | Idle2 | Entrance | Feel |
|---|---|---|---|---|
| Flint (Rusty) | chest out, planted | puffs up and squares off | drops in and plants | forceful, committed strikes |
| Bolt | taps a foot, jittery | glances behind, hops | dashes in from the side | barely any wind-up, hard brakes, strongest lean |
| Cinder | slow heaving breath | big heave and huff | lands heavily, squash | deepest wind-ups, ground-shaking landings |
| Pip | looks left and right, hops | a backflip | pops in, grows from small | bouncy and sly |
| Pearl | wings always moving | stretches wings and sways | floats down | slow flutter-fall, softest landings |

All 49 clips:

- **Movement:** Idle, Idle2, Hop, Run, Skid, Crouch, Rise, Fall, FastFall, Land, LandHard, Dodge, AirDodge, Ledge, Respawn.
- **Defence and hits:** Shield, ShieldHit, Hit, HitHeavy, LaunchUp, Spike, Launch, Tumble, Down, Hold, Held.
- **Throws:** ThrowF, ThrowB, ThrowU, ThrowD.
- **Attacks:** Peck, Peck2, Bash, Lunge, Flick, Flap, Sweep, TailSweep, Spin, Fling, Dive, Flip, Kick, Stomp, Snatch, Puff.
- **Flight and pouch:** Fly, HopIn, Select.

## Coverage matrix

**Done** means animated and checked frame by frame in the game. **Shared** means it uses a clip made for something close. **Not in game** means the game has no such state, so there is nothing to animate (I added no mechanics).

| Interaction | Potato Sack | Slingshot | Birds |
|---|---|---|---|
| Idle, idle variation | Done | Done (breathing, sway) | Done (5 different) |
| Walk, run, dash, skid, turn | Done (turn is instant in the game) | Done (lean, feet, skid) | Done (per bird) |
| Jump-squat, rise, fall, fast fall | Done | Done | Done (Pearl's own fall) |
| Landing, hard landing | Done (squash scales with fall speed) | Done | Done |
| Platform drop | Done (Tumble drop-through) | Shared (fall) | Shared (fall) |
| Ledge | Not in game (he cannot hold the ledge) | Done | Done |
| Shield, shield hit | Done | Done | Done |
| Shield break | Shared (dizzy) | Shared | Shared |
| Spot dodge, roll, air dodge | Done (roll shares Tumble) | Done | Done |
| Jab 1, 2, 3 | Done (3 different) | Done | Done (Peck, Peck2, Bash) |
| Tilts | Done (3 different) | Done | Done (Lunge, Flick, TailSweep) |
| Dash attack | Done (Belly) | Done | Done (Spin) |
| Smashes | Done (3 different) | Done | Done (Bash, Flap, Sweep) |
| Aerials | Done (5 different) | Done | Done (Fling, Dive, Kick, Flip, Stomp) |
| Grab, pummel | Done / Shared (pummel uses Hold) | Done | Done / Shared |
| Throws f, b, u, d (and Bag It) | Done (5) | Done (per direction) | Done (4) |
| Being grabbed, held, thrown | Done (Held, then the launch reaction) | Done | Done |
| Hit: light, heavy, up, spiked, away | Done | Done (bends away) | Done |
| Hit-freeze shake by direction | Done | Done | Done |
| Neutral air Sling Spin (multi-hit) | n/a | Done (end over end, pouch flung) | Done (Fling) |
| Up special Catapult Cyclone | n/a | Done (charge stretch, release, spin) | Done (Fling) |
| Selector and entrances | n/a | Done (pouch jiggles) | Done (5 entrances) |
| Separating, firing, flying | n/a | Done (draw back, recoil, empty and slack) | Done (Fly) |
| Rejoining | n/a | Done (bands take the weight) | Done (HopIn) |
| Pip trio | n/a | n/a | Done (staggered flight and idle) |
| Spud Bomb charge and release | Done | n/a | n/a |
| Hot Potato | Done (burst on frame 5) | n/a | n/a |
| Tumble by direction (the "sanddash") | Done (5 kinds) | n/a | n/a |
| KO, respawn | Done (respawn idle; KO uses the existing blast effect) | Done | Done |
| Taunt, victory, defeat, tech | Not in game | Not in game | Not in game |
| Wall, ground and platform impacts | Not separate states in the game (shown by squash on landing) | | |
| Armor, counter | Shared (the birds' counter uses Shield) | | |

## Footage

`before/` and `after/`, 16 clips each: the same scripted inputs, at 1280x720 with the HUD showing. Open `compare.html` to play each pair side by side.

- **Potato Sack:** sack-movement, sack-ground-normals, sack-smashes, sack-aerials, sack-throws, sack-specials, sack-tumble-drop, sack-hit-reactions.
- **Furious Fowls:** fowl-birds-idle-run (all five), fowl-normals, fowl-sling-spin-cyclone, fowl-selector, fowl-separate-rejoin, fowl-pip-trio, fowl-hit-reactions.
- **Both:** ko-respawn.

The frame-by-frame review sheets I used are in `../anim-review/`.

## Files

- **Blender scenes** (rigged and animated, open in Blender 5.2): `assets/potato-sack/work/potato-sack-anim.blend` and `assets/fowl-<bird>/work/<bird>-anim.blend`. These are on disk and kept out of git (8 to 14 MB each); `tools/blender/build-anim.sh` remakes them.
- **Rig and animation sources:** `tools/blender/sack.js`, `tools/blender/fowls.js` (written out as `assets/*/work/rig.json`).
- **Game files:** `assets/potato-sack/export/potato-sack-v1.glb` and `assets/fowl-*/export/*-v1.glb`.
- **Previous models:** `assets/_backup-anim-v1/` (and git history).

## Limits

- The animation is authored as numbers in scripts and judged from rendered frames. It is clearly better: anticipation, overshoot, squash, distinct birds. It is still not hand-keyed studio animation, and your eye is the final check.
- The meshes are single generated shells, so big bends deform like a soft toy. That suits a sack and round birds.
- The birds share attack shapes, with timing and size set by personality. Their idles, second idles, entrances, falls (Pearl) and movement feel are their own.
- The slingshot is animated in code, not in Blender. It was never a Blender model, and code lets the bands and pouch respond to the game directly.
- No taunts, victory or defeat poses, or tech rolls: the game has no such states, and adding them would be new mechanics.
- Gameplay is unchanged: `sim.js` and `hitboxes.js` were not edited by this work, and all 176 rule checks pass.
