
# FURIOUS FOWLS — COMPLETE MOVESET OVERHAUL v3.0
## Claude Code implementation specification

**Purpose:** overhaul the existing Furious Fowls fighter so it feels like a ridiculous, expressive, intuitive slingshot fighter with five genuinely distinct birds. This is a refinement of the existing game, not permission to destroy or rebuild working systems.

**Visual source of truth:** the attached `Furious_Fowls_Bird_Lineup_Reference.png`. Use the exact original visual identities and broad shapes for Flint, Bolt, Cinder, Pip, and Pearl. Do not substitute Angry Birds characters, assets, names, or assumptions. Do not rename Flint to Rusty. Pip is one base model; create extra Pip birds by duplicating that same model at runtime.

## 1. Non-negotiable design decisions

- One fighter, two forms: the skinny wooden slingshot with a bird in its pouch, or the bird alone after it is fired.
- The slingshot is the main fighter and needs its own expressive physical moveset.
- The slingshot is a **skinny wooden Y-shaped slingshot**: narrow handle, two thin fork arms, elastic bands and a small pouch. No bulky humanoid body, giant tree-trunk proportions, or unnecessary limbs.
- The loaded bird sits at the fork/pouch end; the wooden handle/base is at the opposite end.
- **Neutral B selects birds in a Monado-Arts-style selector.** Neutral B is not a projectile in slingshot form.
- **Down B fires the selected bird's wooden ammunition in slingshot form.** In bird-alone form, Down B returns the bird to the slingshot when physically close.
- **Side B fires the living bird** and transfers control to it. The empty slingshot remains behind.
- **Neutral Air and Up Special are end-over-end centrifugal spin moves.** The bird and slingshot stay connected, with the bird at one end and handle/base at the opposite end. The entire long rig rotates around its midpoint. This is not a flat spin, not a stationary slingshot with a separate bird orbiting, and not a generic cartwheel.
- Both spin moves are multi-hit dragging attacks: repeated light hits carry the opponent slightly along the rotating path, then a stronger finishing hit releases them. DI/SDI and counterplay must remain possible; do not create a magnetic tether.
- Preserve existing code, roster, inputs, animation systems, and mechanics wherever they already work. Inspect first; change only what is necessary.
- Keep authoritative gameplay deterministic at fixed 60 Hz and compatible with future rollback.
- Add a start-menu **Show Hitboxes** toggle, default OFF. It hides only debug graphics, never actual collision.

## 2. Slingshot visual identity and personality

Build a slender, simple wooden Y-shaped slingshot with a long narrow handle, two thin fork arms, two elastic bands, and a small flexible pouch. It should look like a classic skinny wooden slingshot that has come alive through elastic physics—not a bulky wooden monster or humanoid character.

Its personality comes from physical behavior:
- fork flexes and wobbles after movement;
- bands stretch, vibrate, and snap back;
- handle plants, skids, tips, and rebounds;
- pouch swings like a pendulum;
- the rig overshoots and corrects itself;
- loaded bird shifts weight and reacts inside the pouch;
- hard landings squash the rig and create a springy rebound.

No generic human punches. Attacks come from stretching, whipping, levering, planting, rotating, recoiling, compressing, and releasing the slingshot.

### Bird lineup

| Bird | Visual identity | Gameplay identity |
|---|---|---|
| Flint | Rust-red, pale chest, dark beak, red/brown crest | Reliable brawler |
| Bolt | Golden-yellow, streamlined, pale chest, pointed beak, dark teal accents | Speed and momentum |
| Cinder | Charcoal, brown chest feathers, orange crest/beak | Heavy explosive power |
| Pip | Small turquoise bird, pale belly, playful expression | Trickery and formations |
| Pearl | Cream/off-white, blush accents, elegant crest | Aerial control and eggs |

Do not redesign these characters or replace them with franchise lookalikes.

## 3. Controls and state machine

| Input | Slingshot form | Bird-alone form |
|---|---|---|
| Neutral B | Monado-Arts-style bird selector | Bird's signature ability |
| Side B | Fire living bird; transfer control | Bird's solo movement/attack special |
| Up B | Charge/aim/release Catapult Cyclone | Bird-specific recovery |
| Down B | Bird-specific wooden ammunition | Rejoin slingshot when physically close |
| Normal attacks | Slingshot's bird-flavored normals | Smaller, weaker bird normals |

### Neutral B — bird selector (mandatory)

- Quick tap cycles Flint → Bolt → Cinder → Pip → Pearl → Flint.
- Holding Neutral B for approximately 8 frames opens a five-segment radial selector.
- Point with the main stick; release Neutral B to confirm.
- Show bird icon, name, and short role label. Use the provided character designs.
- No arbitrary cooldown. Switching cannot cancel hitstun, hitlag, active attacks, or committed attack recovery.
- Use a short 4–6 frame pouch-swap animation.
- Do not globally pause or slow the simulation. Keep selector behavior rollback deterministic.

### Side B — fire the living bird

- Brief aimable wind-up; allow useful forward/up/down aiming.
- Fire the actual selected bird and transfer player control to it.
- Empty slingshot remains at the launch point. If launched in air, it falls under deterministic physics and settles on stage.
- Empty slingshot is harmless and not an attackable opponent target.
- If it leaves the stage, restore it near the nearest valid ledge after a short deterministic delay.
- Do not impose a fixed 28–40 frame flight timer. The bird stays controllable until it lands, is hit, rejoins, or uses a state-specific action.

### Down B — context-sensitive

- Slingshot form: fires the selected bird's wooden-ammunition special.
- Bird-alone form: if within approximately 1.5 character widths of the empty slingshot, hop back into the pouch. If farther away, do nothing; never teleport.

### Shared state

One damage percentage and one stock count. Separation and rejoining never reset damage. Losing a stock respawns the bird in the slingshot with the last selected bird.

## 4. Bird identities and base movement

Use these as starting values; tune only after playtesting. Bird identity must come from attack geometry, timing, momentum, and specials—not percentages alone.

| Bird | Weight | Run | Air drift | Gravity | Identity |
|---|---:|---:|---:|---:|---|
| Flint | 100 | 100% | 100% | 100% | Grounded pressure, reliable combo starters, stable knockback |
| Bolt | 88 | 115% | 111% | 104% | Fast pursuit, momentum carry, short recovery |
| Cinder | 115 | 86% | 88% | 108% | Slow commitment, large impact, explosive shield pressure |
| Pip | 87 | 106% | 112% | 97% | Three-body formations, staggered hitboxes, cross-ups |
| Pearl | 96 | 96% | 108% | 87% | Floaty aerial control, egg setups, vertical recovery |

Pip's base model is generated once; duplicate it at runtime for formation attacks.

## 5. Slingshot form — complete bird-specific normal movesets

Frame data is a proposed starting point at 60 simulation FPS. Startup is the first active frame. Active is the full active window. Recovery is frames after the final active frame. Damage is before any 1v1 bonus. Verify the engine's frame convention before applying. These are tuning targets, not claims of copied Ultimate data.

### Flint — The Brawler

| Move | Startup | Active / rehit | Damage | Recovery | Animation / hitbox intent |
|---|---:|---|---:|---:|---|
| Jab 1/2/3 | 4/6/8 | 4–5 / 6–7 / 8–10 | 2/2/4% | 14 | Pouch peck → band snap → forward headbutt |
| F-tilt | 8 | 8–11 | 8% | 16 | Wide elastic-band whip; follow the full band arc |
| U-tilt | 7 | 7–10 | 7% | 17 | Fork snaps upward; anti-air above pouch |
| D-tilt | 6 | 6–9 | 6% | 15 | Low handle sweep; reliable combo starter |
| Dash attack | 10 | 10–16 | 9 early / 6 late | 22 | Whole slingshot lunges and rebounds |
| F-smash | 19 | 19–22 | 18% | 36 | Long overdraw then forceful pouch snap |
| U-smash | 14 | 14–18 | 15% | 30 | Fork and band launch upward |
| D-smash | 15 | 15–22 | 13% | 32 | Handle plants; band sweeps both sides |
| N-air | 7 | 9–25; rehit 4f | 4×1.5 + 4 = 10% | 14; land 12 | Sling Spin; stable orbit and reliable pop |
| F-air | 10 | 10–16 | 10% | 18; land 12 | Leaping band hook; broad diagonal capsule |
| B-air | 8 | 8–14 | 11% | 20; land 13 | Elastic recoil snap behind |
| U-air | 8 | 8–16 | 9% | 17; land 11 | Overhead pouch flip |
| D-air | 14 | 14–22 | 12% | 22; land 16 | Wooden dummy; early spike, late pop-up |
| Grab / throws | 9 | — | F/B/U/D 9/10/8/7% | — | Band snare; pummel 1.5%; elastic release |

### Bolt — The Speedster

| Move | Startup | Active / rehit | Damage | Recovery | Animation / hitbox intent |
|---|---:|---|---:|---:|---|
| Jab 1/2/3 | 3/5/7 | 3–4 / 5–6 / 7–9 | 1.5/1.5/3% | 12 | Rapid pointed pecks; shortest recovery |
| F-tilt | 6 | 6–8 | 7% | 14 | Fast piercing pouch thrust; small lunge |
| U-tilt | 5 | 5–8 | 6% | 15 | Quick fork flick |
| D-tilt | 5 | 5–8 | 5% | 13 | Sliding low peck; keeps forward velocity |
| Dash attack | 7 | 7–12 | 8 early / 5 late | 18 | High-speed ram; momentum carry |
| F-smash | 15 | 15–17 | 14% | 32 | Longest reach; narrow piercing launch |
| U-smash | 10 | 10–14 | 12% | 27 | Quick vertical elastic flick |
| D-smash | 12 | 12–17 | 11% | 28 | Low sliding spin |
| N-air | 6 | 8–22; rehit 3f | 5×1.2 + 3.5 = 9.5% | 10; land 9 | Faster, tighter Sling Spin; strong horizontal carry |
| F-air | 7 | 7–11 | 8% | 15; land 9 | Drill thrust; combo follow-up |
| B-air | 6 | 6–10 | 9% | 16; land 9 | Fast backward kick/snap |
| U-air | 6 | 6–12 | 7% | 14; land 8 | Rising spiral; preserves drift |
| D-air | 9 | 9–14 | 8% | 17; land 12 | Fast diagonal dive; momentum carry |
| Grab / throws | 7 | — | F/B/U/D 8/9/7/6% | — | Quick band snare; pummel 1% |

### Cinder — The Heavyweight

| Move | Startup | Active / rehit | Damage | Recovery | Animation / hitbox intent |
|---|---:|---|---:|---:|---|
| Jab 1/2/3 | 6/8/11 | 6–7 / 8–9 / 11–13 | 3/3/6% | 20 | Heavy strikes into explosive pouch slam |
| F-tilt | 11 | 11–14 | 12% | 22 | Slow wide slam; explosive tip |
| U-tilt | 10 | 10–13 | 10% | 22 | Heavy vertical launch pop |
| D-tilt | 9 | 9–12 | 8% | 21 | Ground thump and low shockwave |
| Dash attack | 14 | 14–19 | 12% | 28 | Heavy rolling belly slam |
| F-smash | 24 | 24–27 | 21% | 45 | Long overdraw; explosive contact; punishable miss |
| U-smash | 18 | 18–21 | 19% | 40 | Delayed vertical blast |
| D-smash | 20 | 20–24 | 18% | 40 | Ground explosion both sides |
| N-air | 9 | 11–23; rehit 5f | 3×2 + 7 = 13% | 22; land 18 | Slow, wide Sling Spin; large orbit and heavy finisher |
| F-air | 14 | 14–19 | 14% | 27; land 18 | Heavy body slam |
| B-air | 13 | 13–18 | 13% | 26; land 17 | Explosive recoil behind |
| U-air | 12 | 12–17 | 12% | 25; land 16 | Pop blast above pouch |
| D-air | 16 | 16–22 | 15% | 30; land 20 | Explosive plunge; strong spike |
| Grab / throws | 11 | — | F/B/U/D 11/12/10/8% | — | Heavy elastic snare; pummel 2% |

### Pip — The Trickster Trio

Pip's base mesh is one model. Duplicate it at runtime for trio moves. All duplicates must be deterministic, use the same rig, and have distinct offsets/trajectories.

| Move | Startup | Active / rehit | Damage | Recovery | Animation / hitbox intent |
|---|---:|---|---:|---:|---|
| Jab 1/2/3 | 4/6/8 | 4–5 / 6–7 / 8–11 | 1.5/1.5/3.5% | 15 | Staggered pecks; companions on finisher |
| F-tilt | 7 | 7–11 | 6.5% | 16 | Three-way peck cross |
| U-tilt | 7 | 7–11 | 6% | 16 | Trio rises in sequence |
| D-tilt | 6 | 6–10 | 6% | 16 | Rolling trio sweeps low |
| Dash attack | 9 | 9–15 | 7.5% total | 21 | Three birds rush in staggered formation |
| F-smash | 18 | 18–23 | 15% | 36 | Formation charge; three real hitboxes |
| U-smash | 13 | 13–19 | 14% | 32 | Three-bird spiral |
| D-smash | 14 | 14–21 | 13% | 31 | Scatter formation both directions |
| N-air | 7 | 9–27; rehit 3f | 6×1 + 3.5 = 9.5% | 16; land 13 | Three-bird orbit around end-over-end rig |
| F-air | 9 | 9–15 | 8% | 17; land 11 | Three pecks converge forward |
| B-air | 8 | 8–14 | 7% | 17; land 11 | Rear formation strike |
| U-air | 7 | 7–14 | 7% | 16; land 10 | Rising spiral |
| D-air | 12 | 12–19 | 9% | 21; land 15 | Three staggered downward strikes |
| Grab / throws | 8 | — | F/B/U/D 8/8/8/7% | — | Band snare; pummel 1% |

### Pearl — The Aerial Specialist

| Move | Startup | Active / rehit | Damage | Recovery | Animation / hitbox intent |
|---|---:|---|---:|---:|---|
| Jab 1/2/3 | 4/6/9 | 4–5 / 6–7 / 9–11 | 2/2/3.5% | 16 | Wing-peck, pouch flick, finishing sweep |
| F-tilt | 8 | 8–12 | 7.5% | 16 | Broad wing arc; high/forward coverage |
| U-tilt | 8 | 8–12 | 7% | 17 | Wing lift with upward drift |
| D-tilt | 7 | 7–11 | 6.5% | 16 | Low egg-shell sweep |
| Dash attack | 11 | 11–18 | 8% | 21 | Gliding swoop over low attacks |
| F-smash | 19 | 19–23 | 16% | 36 | Egg-assisted pouch catapult |
| U-smash | 14 | 14–19 | 13% | 31 | Wing cyclone; upward lift |
| D-smash | 16 | 16–21 | 13% | 32 | Egg-burst sweep both sides |
| N-air | 8 | 10–25; rehit 4f | 4×1.25 + 4 = 9% | 16; land 13 | Floaty wide Sling Spin; slight upward lift |
| F-air | 8 | 8–14 | 8% | 17; land 11 | Long wing thrust |
| B-air | 8 | 8–14 | 9% | 18; land 12 | Backward wing sweep |
| U-air | 7 | 7–15 | 8% | 16; land 10 | Wing spiral; vertical coverage |
| D-air | 12 | 12–20 | 8% direct + 6% egg | 22; land 16 | Egg drop then slight upward float |
| Grab / throws | 9 | — | F/B/U/D 8/9/9/7% | — | Band catch; pummel 1.5% |

## 6. Signature Neutral Air — SLING SPIN

This is the visual identity of Furious Fowls. The bird remains in the pouch at the fork end; the wooden handle/base remains at the opposite end. The complete long rig rotates end-over-end around its midpoint. The bird and handle sweep opposite sides of a large orbit.

**Do not** substitute a flat spin, a stationary slingshot with an orbiting bird, or a generic cartwheel.

### Animation sequence

1. Anticipation: slingshot leans sideways; elastic bands stretch; bird braces in pouch.
2. Wind-up: handle dips and fork rises, establishing the long axis.
3. Rotation: complete rig rotates end-over-end around its midpoint.
4. Centrifugal extension: bird presses outward in pouch; bands/pouch stretch; handle trails opposite.
5. Dragging hits: both ends sweep a broad orbit; repeated light hits carry opponent slightly along the spin.
6. Finisher: rotation snaps to a stop and pops opponent away.
7. Recovery: slingshot wobbles and over-rotates slightly before regaining normal orientation.

| Bird | Startup | Multihit window | Rehit | Hits | Total damage | Recovery / landing |
|---|---:|---|---:|---:|---:|---|
| Flint | 7f | 9–25f | 4f | 4 × 1.5% | 10% | 14f / 12f |
| Bolt | 6f | 8–22f | 3f | 5 × 1.2% | 9.5% | 10f / 9f |
| Cinder | 9f | 11–23f | 5f | 3 × 2% | 13% | 22f / 18f |
| Pip | 7f | 9–27f | 3f | 6 × 1% | 9.5% | 16f / 13f |
| Pearl | 8f | 10–25f | 4f | 4 × 1.25% | 9% | 16f / 13f |

### Hitboxes and drag

- Two primary hitbox groups: bird/pouch end and handle/base end.
- A weaker elastic-band arc hitbox may be added only where it visibly contacts.
- Each endpoint follows the animated endpoint, not a static center box.
- Use swept-capsule collision between previous and current endpoint positions to prevent tunneling.
- Multihits use low launch strength and tangential impulses that carry the opponent slightly with the spin.
- The final hit sends the opponent away with a clear angle.
- No forced tether, magnetism, or disabling DI/SDI. Limit re-hits per target and prevent infinite loops.
- Hitbox coverage must match the full visible sweep; no tiny detached hitboxes.

## 7. Up Special — CATAPULT CYCLONE

The traveling, chargeable version of Sling Spin. Hold Up B to stretch the bands, aim in 360 degrees with the main stick, and release to launch the complete bird + slingshot rig. It travels through the air while rotating end-over-end around its midpoint. Bird/pouch and handle/base remain at opposite ends.

| Charge held | Multihits | Finisher | Total damage | Intended use |
|---|---:|---:|---:|---|
| 0–10f | 2 × 1% | 6% | 8% | Quick escape / short recovery |
| 11–25f | 3 × 1.5% | 8.5% | 13% | Medium launch |
| 26–44f | 4 × 1.5% | 12% | 18% | Strong recovery / attack |
| 45f | 5 × 2% | 14% | 24% | Maximum charge; substantial kill power |

- Charge begins on frame 8 and lasts up to 45f.
- Aim in 360 degrees; neutral stick aims upward.
- While charging in air, slingshot sinks slowly; no invulnerability.
- Charge scales launch speed, travel distance, spin speed, and hit count.
- Use the same swept endpoint collision as N-air.
- Repeated hits drag with tangential impulses; final hit releases the opponent.
- One use per airtime, refreshed on landing.
- Initial landing lag: 28f on whiff, 22f after a hit; tune after testing.
- Do not use a fixed animation timer as the physics source. Use deterministic motion/state rules, with a safety cap only to prevent stuck states.

### Bird-specific spin flavor

| Bird | Rotation behavior | Hit feel |
|---|---|---|
| Flint | Stable, even rotation | Reliable drag and outward pop |
| Bolt | Fast rotation with horizontal carry | More pursuit distance; quicker repeated hits |
| Cinder | Slower, wider orbit | Fewer, heavier hits and powerful final blast |
| Pip | Lead bird plus two companions in staggered orbit | Wider formation coverage; real runtime clones |
| Pearl | Floatier rotation and slight upward drift | Longer aerial coverage and gentle lift |

## 8. Down B — wooden ammunition in slingshot form

| Bird | Move | Startup | Damage | Behavior |
|---|---|---:|---:|---|
| Flint | Straight Dummy | 11f | 6% | Straight wooden bird; up to two active |
| Bolt | Double Tap | 8f | 2 × 2.5% | Two fast pellets; second 6f later; up to four active |
| Cinder | Fuse Dummy | 18f | 9% | Slow arc; bursts on contact/end; one active |
| Pip | Wooden Scatter | 12f | 3 × 2.5% | One dummy splits into three after 12f; runtime duplicates |
| Pearl | Egg Courier | 15f | 5% + 5% | Slow carrier drops an egg; one active |

Projectiles need real collision geometry, deterministic lifetime, and clear telegraphs. Projectile spam must not replace the slingshot's close-range identity.

## 9. Side B — FIRE THE LIVING BIRD

| Bird | Startup | Launch hit | Flight identity | In-flight Neutral B trick |
|---|---:|---:|---|---|
| Flint | 13f | 13% | Balanced cannonball arc | Battle Cry: 3% radial push; small trajectory nudge |
| Bolt | 11f | 9% | Fastest; horizontal momentum | Speed Burst; boosted impact can reach 14% |
| Cinder | 18f | 18% | Slow, heavy cannonball | Detonate: 16% blast; ends flight and pops Cinder away |
| Pip | 13f | 5% | Controlled lead Pip | Split into two real clones; each side bird 3% |
| Pearl | 14f | 8% | High, floaty arc | Egg Drop: 9% egg and small upward impulse |

Do not impose a fixed flight duration. The bird remains controllable until landing, hit, rejoin, or a state-specific action. The empty slingshot stays behind and can be rejoined physically.

## 10. Bird-alone form — normal moves

| Move | Startup | Active | Base damage | Notes |
|---|---:|---|---:|---|
| Jab | 4f | 4–6f | 3% | Quick peck |
| Forward tilt | 7f | 7–11f | 5% | Forward strike |
| Up tilt | 7f | 7–11f | 4% | Upward peck |
| Down tilt | 6f | 6–10f | 4% | Low sweep |
| Dash attack | 10f | 10–16f | 6% | Rushing strike |
| Forward smash | 16f | 16–23f | 9% | Committed head/body strike |
| Up smash | 13f | 13–20f | 8% | Upward strike |
| Down smash | 14f | 14–20f | 8% | Two-sided kick/spin |
| Neutral air | 7f | 7–13f | 5% | Small body spin |
| Forward air | 9f | 9–15f | 6% | Forward wing/peck |
| Back air | 9f | 9–15f | 6% | Backward wing/kick |
| Up air | 8f | 8–14f | 5% | Upward flap |
| Down air | 14f | 14–20f | 6% | Downward strike |

The solo bird is weaker, but not helpless. Preserve each bird's timing, animation, reach, movement carry, and formation behavior.

## 11. Bird-alone specials

| Bird | Neutral B | Side B | Up B |
|---|---|---|---|
| Flint | Mini Cry, f10, 3%; small push ring | Angry Rush, f12, 6% | Double Hop, f7, 2%; once per airtime |
| Bolt | Beak Drill, f8, 5% | Sprint Burst, f10, 5%; fastest burst | Diagonal Flash, f9, 3% |
| Cinder | Smoke Puff, f16, 6%; wide | Heavy Roll, f15, 8%; one light-hit armor window on f15–17 | Blast Hop, f16, 6%; short and powerful |
| Pip | Mini Split, f13, 5%; clones | Trio Stampede, f11, 6% | Bird Ladder, f9, 3%; staggered hops |
| Pearl | Weak Egg, f16, 6%; lob | Flutter Check, f11, 5%; float check | Wing Float, f8, 2%; high steerable lift |

In bird form, Down B rejoins the slingshot only when physically close (about 1.5 body widths). No teleporting.

## 12. Hitboxes, drag behavior, and debug display

- Tie hitboxes to the actual attacking body part, elastic band, pouch, bird, egg, or projectile.
- Use capsules, swept capsules, and simple convex shapes; do not use tiny static boxes for large sweeping attacks.
- Lunges move hitboxes with the character. Delayed explosions use explicit radius and timing.
- For Sling Spin and Catapult Cyclone, track both endpoints every fixed tick and sweep between previous/current positions to prevent tunneling.
- Multihits use fixed re-hit intervals and maximum hit counts. Drag is repeated tangential impulse, not an unavoidable tether. Preserve DI/SDI.
- Use stronger final hitboxes and weaker dragging hits.
- Make hitboxes generous enough to match the visible swing, but preserve spacing and counterplay.

### Start-menu setting: Show Hitboxes

- Add a clearly labeled **Show Hitboxes** toggle to the start menu.
- Default OFF.
- OFF hides attack hitbox overlays/debug outlines only; real collisions and damage continue normally.
- ON displays hitboxes and active/inactive state; hurtboxes may remain a separate developer option.
- Persist through the existing settings system.
- This setting must never change simulation or rollback behavior.

## 13. Animation checklist

**Slingshot:** idle bounce, bird-in-pouch reactions, walk/run, dash start/stop, jump, fall, land, skid, all normals, smashes, Sling Spin, grabs/throws, Neutral B selector open/cycle/highlight/confirm/swap, Down B ammo, Side B aim/launch/recoil, Catapult Cyclone charge/aim/launch/rotation/multihits/finisher/landing, hitstun, tumble, shield, dodge, KO, respawn, win/lose/taunts.

**Bird form:** idle, hop/walk/run, jump/double jump/fall/land, all normals, shield/dodge/air dodge, bird-specific Neutral B/Side B/Up B, launch flight, hitstun/tumble, rejoin approach and pouch snap-back.

**Personality:** Flint determined and sturdy; Bolt impatient and forward-leaning; Cinder heavy and confident; Pip playful and coordinated; Pearl poised and buoyant. The loaded bird must react during slingshot moves, especially both spin moves.

## 14. Meshy and asset budget

- Use the supplied lineup as the image-to-3D source for five base bird models.
- Maximum five unique Meshy model generations: one per bird. Pip companions are runtime duplicates of the one Pip model.
- Do not use Meshy for the slingshot, animations, eggs, wooden dummies, effects, selector icons, or projectiles. Build those procedurally or reuse existing assets.
- Prioritize clean topology, simple rigs, readable silhouettes, and consistent scale.
- Budget ceiling: up to 50 Meshy credits from the user's available balance only if that balance exists. Do not claim credits were added, exceed the available balance, or spend beyond 50 without approval.

## 15. Safe implementation sequence

1. Create/use a safe feature branch. Inspect the current character, input map, state machine, animation system, hitbox system, and settings before editing.
2. Preserve working systems and map current behavior to this specification. Move bird selection to Neutral B.
3. Implement slingshot personality and per-bird normal differences.
4. Replace N-air with the true end-over-end Sling Spin.
5. Replace Up Special with the traveling end-over-end Catapult Cyclone.
6. Implement Down B ammo, Side B living-bird launch, solo bird states, and physical rejoin.
7. Rework hitboxes and add swept endpoint collision for spin moves.
8. Add Show Hitboxes toggle, default OFF.
9. Test combos, shield pressure, aerials, edgeguards, recoveries, separation/rejoin, and all five bird identities.
10. Run regression tests on unrelated characters/features. Keep deterministic 60 Hz simulation and rollback safety.

Do not delete or rewrite working engine systems merely to make the code cleaner. Reuse the current state machine, animation system, input system, hitbox system, and settings system wherever possible.

## 16. Acceptance tests

- The five birds match the supplied lineup and retain the names Flint, Bolt, Cinder, Pip, Pearl.
- Neutral B selects birds through a Monado-Arts-style wheel/cycle; it is not a projectile in slingshot form.
- Down B fires bird-specific wooden ammunition in slingshot form and returns the solo bird when near the slingshot.
- Side B fires the living bird and transfers control without a fixed flight timer.
- All five birds feel different through normals, movement, specials, and solo form.
- The slingshot is a skinny wooden Y shape, not a bulky humanoid.
- N-air and Up Special rotate the whole rig end-over-end around its midpoint, bird and base at opposite ends.
- Both spins are multi-hit dragging moves with a distinct finisher, fair hitboxes, and DI/SDI counterplay.
- Rotating hitboxes do not tunnel through opponents.
- Show Hitboxes is OFF by default and hides only debug graphics.
- Existing characters and unrelated features still work.
- Simulation is deterministic and rollback-compatible.

## 17. Final instruction to Claude

Implement this overhaul in the existing game. Do not stop at a plan or another design document. Inspect first, preserve what works, and make the smallest safe set of changes necessary. The defining feature is the slingshot's ridiculous end-over-end centrifugal motion: in Neutral Air and Up Special, the bird/pouch end and wooden handle/base must remain opposite ends of one spinning rig, sweep through a large orbit, multi-hit and drag opponents, then finish with a satisfying pop. Neutral B must be the Monado-Arts-style bird selector. Make all five birds genuinely different to play, not merely different colors or projectile values. Use the supplied bird lineup as the visual source of truth. Test the actual game and report what changed, what was preserved, and what remains incomplete.
