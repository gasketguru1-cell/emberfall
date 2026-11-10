# FURIOUS FOWLS — COMPLETE CLAUDE CODE IMPLEMENTATION SPECIFICATION

**Revision:** 1.0 — implementation-ready design, proposed/tunable balance numbers  
**Game:** your existing browser-based platform fighter (currently localhost)  
**Goal:** playable on first integration, funny immediately, strategically deep over time, robust under future rollback netcode  
**Hard budget:** no more than **five Meshy model generation submissions**. Zero Meshy animation/text-to-motion generations.  
**Deliverables:** one fully functioning fighter, five bird models, procedural slingshot, animations, data, debug overlays, automated tests, and documentation.  
**Character identity:** *Furious Fowls* is an original group of expressive birds riding a living wooden slingshot. This is a separate design. Do not import proprietary bird characters, animation files, logos, audio, rigs or assets from Angry Birds.

> **EXECUTION INSTRUCTION TO CLAUDE:** Read this entire document and the adjacent `furious_fowls_move_data.json`. Inspect the existing game before editing. Do not ask me to manually animate or build the slingshot. Preserve working existing systems. Implement the complete fighter in safe milestones with tests, small commits, and a final playable build. The numbers below are deliberate starting values, not claims about the existing engine or established tournament balance. Adapt units and timing carefully without changing intent; document deviations.

## A. First inspect and protect the existing game

1. Locate the actual game repository, entry point, engine, combat data format, frame timing, scene graph, camera, character controller, hitbox system, animation pipeline, asset directory, input map, audio, replay/rollback architecture, and test scripts. **Do not assume Phaser, Three.js, Babylon, custom Canvas, or any particular stack.**
2. Confirm whether the reported ~1,000 FPS is rendering rate or simulation rate. Separate combat from rendering only if necessary; keep perceived responsiveness. Use a 60 Hz deterministic *gameplay* tick for move/frame tables and an independently paced render loop. If the engine already has a fixed deterministic step, reuse it.
3. Create a branch/checkpoint and backup, note baseline working behaviors, run existing tests and run the local game before editing.
4. Identify currently supported controller inputs: Up+B, Side+B, Down+B, neutral special, smash vs tilt, jump, shield, grab, and aerials. Add mappings only where absent, while preserving existing bindings.
5. Identify target platform 2.5D/side-on and coordinate conventions. All measurements below use relative units rather than guessed pixels. Make an explicit adapter from normalized units to engine units.
6. If Meshy connection or approved credits are unavailable, **do not fake a generated model**. Build immediately with low-poly geometry placeholders, leave exact model-generation commands and a handoff checklist, and finish the gameplay implementation. Never spend additional credits or initiate a 6th submission.
7. Keep this implementation separate from current roster balance tables unless absolutely necessary. No broad rewrites. If another implementation of these mechanics already exists, retain it where correct.

**Exit criterion:** an inspection note specifying actual stack, 60-tick integration strategy, rollback readiness, reusable systems, planned files, and asset-generation budget before significant modifications.

## B. Identity, visual language, and five-model asset budget

The slingshot is a lopsided living Y-shaped wooden frame with two absurd tiny wooden feet. Its elastic bands and pouch stretch, snap, and swing; the loaded bird sits visibly in its pouch. **Do not Meshy-generate the slingshot**: construct it from beveled cylindrical/branch geometry, a fork joint, two spline bands, and a pouch mesh. Use a single procedural animation rig shared across all birds. The slingshot is approximately 1.0 W wide and 1.5 W tall at neutral, with a bright readable side silhouette; bird size varies while seated.

The five separately generated original bird models are:

| Meshy generation | Internal / UI name | Distinct visual identity | Combat role |
| --- | --- | --- | --- |
| #1 | Flint | Compact crimson, cream chest, stubborn brow, two swept crest feathers | Balanced / reliable |
| #2 | Bolt | Angular golden speedster, sweeping crest, long beak, thin legs | Rushdown / momentum |
| #3 | Cinder | Charcoal round bruiser, heavy shoulders, fiery-tipped feather | Power / detonations |
| #4 | Pip | Tiny blue bird, tall playful crest, bright eyes; **instance mesh 3 times** | Tricky multihits |
| #5 | Pearl | Soft off-white egg-shaped bird, rose accents, layered wings | Float / egg setups |

**Important image-to-3D workflow:** Each character has a standalone near-front 3/4 crop and, where supported, matching side and rear crops. Use `assets/{name}_front3q.png` as the **single primary image**. Do **not** send a sheet showing three birds side-by-side as a single-image 3D input; it can produce a triple character. If the Meshy version/plan supports multi-view, use the side and rear crops as extra views *within the same single model-generation submission*. If that requires extra credit or isn't available, use front 3/4 alone and reserve side/rear for Blender cleanup.

**Hard budget guard:** Maintain a `meshy_generation_ledger.json` with intended bird, request ID, actual status and generated asset path for each of five permitted submissions. Count a failed/unsatisfactory submission toward five unless a returned tool result explicitly says the generation was not submitted/billed. No autonomous retries, variants, paid animation, paid texture upgrade, or extra model tasks. Review any additional credit-spending operations separately; no unapproved spend. Favor basic textured GLB export where already included in a generation.

**Rigging/animation:** These round birds are non-humanoid. Meshy's usual humanoid motion presets may not apply. Use Blender Python / simple runtime bones and hierarchy: root, body, beak, brow L/R, eye L/R, wing L/R, tail, crest, foot L/R; for Pip only one rig and two lightweight clones. Animate bobbing, squash/stretch, tilt, rotations, feather secondary movement, blinks, expressions and impact flinches in-code or reusable generated Blender keyframes. Gameplay root motion comes from simulation, not arbitrary animation playback.

**Optimization targets:** Prefer ~3,000-10,000 triangles per bird if visually acceptable; reuse materials, atlas/cartoon shaders, aim for quick load, test four simultaneous fighters and all spawned dummies. Preserve the distinguishable silhouettes rather than extra surface detail. Use one model per bird; no separate Meshy models for angry faces, eggs, wooden dummy birds, feathers, slingshot, FX, or stage props. Those must be procedural primitives, duplicated meshes, sprites or shaders.

**Helpful official Meshy docs (verify current UI before use):** https://docs.meshy.ai/en/webapp/image-to-3d and https://docs.meshy.ai/en/webapp/guides/3d-model/rigging . Meshy multi-view accepts extra perspectives in one model generation when available; non-humanoid Smart Rig is not the same as full humanoid animation support.

## C. Game-state architecture: one fighter, two physical configurations

**Combined state:** the controllable main body is the slingshot with a selected bird visibly loaded. Combined normals are predominantly universal. Bird selection changes speed/weight, three selected normals, projectile behavior, and the Side-B bird launch. Combined Up-B is universal for all birds.

**Separated state:** Side-B shoots the *living* bird. Control immediately follows the flying bird; once flight ends, the bird is a playable but less effective little fighter. The empty slingshot stays at the launch origin with a small deterministic recoil impulse. Opponents cannot damage it or win by hitting it; it may be nudged by attacks/explosions, but is collision-light and never blocks attack hitboxes or acts as an invincible wall. It must never be destructible or become unrecoverable.

**Single ownership:** bird and slingshot share a single player entity ID, stock, damage percentage, shield resources, death state and input stream. Bird-selection swap does not heal or change percent. On death, remove all owned clones, projectiles and empty-sling props, then restore clean combined state on respawn.

**Pip split:** render three blue birds, but there is only one genuine player body/hurtbox and one input recipient. Two side birds are *temporary attacking clone objects only* with no stock, grab, hurtbox, or independent physics that could produce multiple deaths.

**Rejoin:** A separated bird in an actionable state within **0.90 W** of the pouch center may press **Down+B**. Play a 6-tick rejoin (the bird may be interrupted before it locks in). Put the bird into the pouch, destroy/deactivate the empty-sling prop, restore combined state with preserved position, facing, sensible momentum and percent. Do not allow rejoin as a hitstun escape, grabbed escape, startup cancel, or automatic invincible teleport. A collision near the pouch can enable the option, but should not force it during an attack.

**Slingshot missing:** If the unattended slingshot passes the blast zone, it respawns as a non-attacking object near the nearest legal ledge after ~45 simulation ticks, with a clear indicator; it never respawns inside geometry. The solo bird must be able to reach it by using solo recoveries. Do not make the slingshot respawn under an opponent or in an impossible location. Do not grant an invulnerable warp to rejoin.

**Switching:** **Down+B** when combined brings up five-way selection radial. Hold direction then release to commit; short tap with no direction swaps with previous bird. No arbitrary cooldown, no bird duration limit, no forced return. Switching has an approximately 4-tick cosmetic pose/settle but cannot bypass attack active/recovery/landing lag or hitstun. Keep transitions readable and don't let alternating selections manufacture hitboxes or momentum. In separated state Down+B is reserved for rejoin and otherwise does nothing; bird switching requires the slingshot.

**Input precedence:** Neutral-B when combined fires wooden mini-bird ammunition; Side-B when combined launches the *actual* bird. While in launch-flight mode, pressing B activates the one-time midflight bird ability rather than firing dummy ammunition. Once flight has ended, normal solo bird specials apply. Combined Up-B initiates charge; after initiation, main-stick direction freely aims 360° without accidentally restarting moves. Separate Up-B exists for solo form.

## D. Frame, geometry, and knockback conventions

All following numbers are **authoring targets**, not measured from your game and not Smash Ultimate frame data. Make every value editable in data files, with visual debugging; adjust to existing game's damage, knockback, and coordinate conventions through an adapter.

**Simulation:** 60 logic ticks/sec. Rendering is independent. Startup N = ticks 1..N without attack hitboxes; active A = next A ticks; recovery E = next E ticks; first actionable tick = N + A + E + 1. Landing lag replaces airborne recovery on a qualifying landing, not added twice. Use single hit ID / victim ID gates for multi-tick hitboxes unless explicitly multihit. All percentages are reference damage units; if engine already includes a separate multiplayer multiplier, do not apply it again.

**Normalized geometry:** W = width of combined slingshot at neutral. B = width of solo bird, typically 0.68W for Flint, 0.62W for Bolt, 0.78W for Cinder, 0.58W for Pip, 0.70W for Pearl. Origin at primary body center. Positive x is fighter's facing; positive y is up. Ellipses specified as center x,y and horizontal/vertical radii; capsules as line endpoints and radius. Mirroring happens through facing transform. Geometry entries are *starting shapes*; show them with hitbox editor overlay to adjust to the visible mesh and existing cast.

**Hurtboxes:** Combined slingshot hurtbox: ellipse center(0,+0.12W), radii (0.43W,0.72W), with bird pouch protrusion optionally included as second overlapping ellipse at (0,+0.42W) radius (0.35W,0.33W). Never allow one attacker to inflict two hit events on the overlapping combined hurtboxes. Solo bird hurtbox: ellipse center 0,+0.03B, radii 0.45B,0.42B, rescaled per bird. Invulnerable/armor windows are **not** granted by default; allocate only if a specific move requires them.

**Launch data:** `kbg` and `bkb` in the JSON are abstract tuning coefficients on an engine-normalized roughly 0-150 scale; they are **not** Smash or physical-force units. Calibrate a consistent 100-percent KO target relative to the current roster rather than interpreting them as engine-absolute values. Launch angles: 0° forward, 90° up, 180° backward, 270° down. Respect facing. Spike hitboxes can be interrupted/teched as the game's general system allows.

**Hitbox sanity:** No multi-hit loops without hit cooldown, no double hit from direct collision + explosion unless explicitly capped, no projectile hit as both owner and physical object, no hitboxes with invisible ranges. Keep five-source projectile ownership clear when switching between birds; a projectile remains attributed to its spawning state, not the currently selected bird.

## E. Complete combined-form normals: every move + geometry + recovery

The JSON contains machine-readable move objects (`combined_moves`) with all fields and normalized geometry. Rows below summarize the complete base kit. `Act` is hitbox active duration; `End` is attack recovery ticks after activity. FA = first actionable tick.

| Move | Start | Act | End | FA | Damage | Angle | Hitbox / purpose |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jab 1 | 3 | 2 | 7 | 13 | 2 | 68 | capsule forward x=0.20..0.78, y=0.18, radius=.18 |
| Jab 2 | 3 | 2 | 8 | 14 | 2 | 72 | capsule x=.30..0.90 y=.20 radius=.18 |
| Jab Finisher | 5 | 3 | 14 | 23 | 3 | 50 | ellipse center x=.73 y=.25 radii=.42/.30 |
| Forward Tilt | 7 | 3 | 17 | 28 | 8 | 42 | capsule x=.30..1.40 y=.25 radius=.18 |
| Up Tilt | 6 | 5 | 16 | 28 | 7 | 91 | swept arc centers from (.35,.20) to (.00,1.20), radius=.27 |
| Down Tilt | 5 | 3 | 14 | 23 | 6 | 76 | capsule x=.15..0.95 y=-.40 radius=.17 |
| Dash Attack | 9 | 5 | 22 | 37 | 9 | 52 | ellipse center x=.62 y=.10 radii=.53/.42 |
| Forward Smash | 18 | 3 | 28 | 50 | 17 | 43 | ellipse x=1.00 y=.30 radii=.55/.48 |
| Up Smash | 13 | 5 | 27 | 46 | 15 | 87 | ellipse x=.08 y=1.09 radii=.48/.65 |
| Down Smash | 14 | 4 | 28 | 47 | 13 | 33 | two capsules left x=-1.05..-.20 and right x=.20..1.05 y=-.28 radius=.30 |
| Neutral Air | 5 | 10 | 16 | 32 | 8 | 58 | rotating ring radius=.72 around torso, thickness=.20 |
| Forward Air | 9 | 4 | 23 | 37 | 10 | 48 | capsule x=.45..1.50 y=.06 radius=.19 |
| Back Air | 7 | 3 | 21 | 32 | 11 | 35 | capsule x=-1.25..-.25 y=.28 radius=.25 |
| Up Air | 7 | 5 | 18 | 31 | 9 | 80 | ellipse center x=.00 y=1.01 radii=.53/.32 |
| Down Air / Wooden Red Dummy | 13 | 2 | 24 | 40 | 12 | 270 | spawn wooden dummy at x=0 y=-.45, projectile radius=.22W |
| Grab | 8 | 2 | 22 | 33 | 0 | 0 | capsule x=.22..1.01 y=.19 radius=.26 |
| Pummel | 4 | 2 | 8 | 15 | 1.5 | 0 | captured target |
| Forward Throw | 9 | 1 | 17 | 28 | 9 | 42 | captured target |
| Back Throw | 11 | 1 | 19 | 32 | 10 | 138 | captured target |
| Up Throw | 10 | 1 | 16 | 28 | 8 | 89 | captured target |
| Down Throw | 12 | 1 | 19 | 33 | 7 | 75 | captured target |

**Animation direction for universal moves:** Jab: two rubber-band slaps then loaded bird thrust. Tilts: band acts as a visible elastic limb; keep a slight pre-stretch. Dash attack: the slingshot trips over its little feet and cartwheels. Forward smash: the loaded bird is tensioned forward but **never detached**. Up smash: pouch stretches vertically. Down smash: fork frame twists with two low sweep volumes. N-air: entire Y spins around bird (bird stays in pouch). F-air/B-air: rubber-band tipper flashes only where hitbox is. U-air: springing overhead. D-air: fire a **wooden red bird dummy** vertically downward; it shatters when it hits terrain. The dummy is a wooden object, not Flint or the living selected bird.

**D-air recoil anti-infinite rule:** On spawning its dummy, apply upward impulse ~0.15W/tick to slingshot **once per airtime**; later D-air uses in same airtime may fire another wooden dummy only after the previous expires, but produce no additional vertical boost. On landing/ledge regain the normal one recoil. Aiming remains strictly downward. This is a powerful emergent movement ingredient without infinite flight.

**Smash charge rule:** Use the existing smash charge system where present. Never double-apply a charge multiplier. If absent, add a standard held-charge curve (max 1.35x damage after 60 ticks, modest increased knockback) with clear visual telegraph; startup listed begins on release. Smash charging cannot be canceled into bird switching except via universal defensive exceptions already established in the game.

## F. Bird-specific modifiers to three combined normals and locomotion

Universal normals retain their identities. Only F-smash, N-air, and dash attack need material per-bird variants. Other attacks may use small cosmetic bird assist differences, but do not change their inputs or animations drastically.

| Bird | Weight | Run | Air | Gravity | F-smash | N-air | Dash |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flint | 100 | 1.0 | 1.0 | 1.0 | 18% 18f | 9% | 9% |
| Bolt | 88 | 1.15 | 1.11 | 1.04 | 14% 14f | 8% | 8% |
| Cinder | 115 | 0.86 | 0.88 | 1.08 | 21% 23f | 11% | 10% |
| Pip | 87 | 1.06 | 1.12 | 0.97 | 15% 18f | 8% | 8% |
| Pearl | 96 | 0.96 | 1.08 | 0.87 | 16% 18f | 8% | 8% |

- **Flint:** Strong ordinary bird-head smash with clean forward cone; standard N-air and fair-weight dash; safest all-round pick.
- **Bolt:** F-smash quicker (14 ticks startup) but weaker and longer/narrower. N-air is a **3-hit** 8%-total blender with finite rehit timer and guaranteed exit angle. Dash attack is a long slide with carry momentum.
- **Cinder:** F-smash slow 23 ticks, 21% with clear fuse ignition. N-air has a slightly larger circle; dash attack gains brief resistance to weak projectile flinching only on designated frames, never full armor.
- **Pip:** F-smash shows three staggered tiny headbutt visual echoes but only one summed hit event. N-air 3 pulses with a combined 8% target. Dash attack a sequence of tiny tumbles; all multihit damage is capped per target.
- **Pearl:** F-smash uses an egg-impact puff without placing a persistent egg. N-air wide wing sweep with lower knockback. Dash attack is a floaty rise into lunge.

**Cross-bird combo hygiene:** switching cannot cancel a move, but selecting another bird on first actionable tick is legal; preserve natural momentum when safe. Do not allow endless true blockstrings just by cycling Flint -> Bolt -> Pip.

## G. Combined Neutral-B — five kinds of wooden bird ammunition

**Visual identity:** all Neutral-B variants are wooden *miniature blue bird-shaped dummies*, each modified by the currently loaded living bird. These are never living Pip instances, never trigger solo state, and are cheap procedural meshes/material variants. All launches apply a small but bounded physical recoil to combined slingshot, ~0.02W/tick horizontal, except the separate D-air recoil noted above.

| Bird | Move | Start | Act | End | Dmg | Travel & collision | Hard cap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flint | Straight Dummy | 10 | 1 | 18 | 6 | blue wooden dummy; 0.38 W/tick | max 2 live normal dummies; additional fire replaces oldest |
| Bolt | Double Tap | 8 | 1 | 20 | 3% x2 | two small wooden blue dummies; 0.42,0.48 W/tick | max 4 active dummy pellets |
| Cinder | Fuse Dummy | 17 | 1 | 25 | 9 | arcing explosive wooden dummy; 0.3 W/tick | only one live explosive dummy; cannot stack explosion and direct hit |
| Pip | Wooden Scatter | 12 | 1 | 20 | up to 8% total | one dummy splits into three; 0.34 W/tick | max 3 live shards; no chain splitting |
| Pearl | Egg Courier | 15 | 1 | 24 | 5 direct + 7 egg; cap combined 10 | wooden blue dummy carrying one egg; 0.28 W/tick | one active egg; existing egg detonates or expires on new input |

- **Flint Straight Dummy:** tap fires fast straight wooden mini-bird. Holding special up to 25 ticks increases projectile speed and launch power, but leaves slingshot vulnerable. No indefinite projectile charge. Range approximately 12-18W depending release.
- **Bolt Double Tap:** two 3% mini shots separated by 6 ticks, weaker standalone but strong at stopping approaches. Noncancelable endlag; cannot rapid-fire into unwinnable projectile walls.
- **Cinder Fuse Dummy:** slow low-arc wooden bird that explodes in a .64W radius. Direct body and blast are alternative contacts for one 9% max hit, not additive. Only one active explosive dummy.
- **Pip Wooden Scatter:** one dummy travels and splits into three shards after ~14 ticks. Holding B longer increases their spread, which covers jumping and landing lanes. Shared damage cap 8% per target per projectile instance.
- **Pearl Egg Courier:** wooden blue-bird dummy carries a small glowing egg, drops it after ~12 ticks or on target contact, and the egg pops after contact / 30 ticks. Per-target combined cap 10% prevents forced same-frame double hit. Only one active egg.

**Charge input clarity:** holding neutral special charges/stages that move; holding Down+B is the selection wheel. Holding Up+B is the Catastrophic Launch charge. These may not share input state accidentally.

## H. Combined Side-B — Fire the Living Bird (core gimmick)

**Activation:** tap Side-B to fire at ordinary forward angle. Hold Side-B (up to ~20 ticks depending bird) and aim up/down within roughly +/-55° of current facing, release to fire. After releasing: slingshot stays behind, controllable bird enters ballistic launch phase. Side-B has no cooldown in combined state, because return requires physical rejoin; it must not allow frame-cancel or infinite same-tick re-fires. One explicit midflight B input activates the selected bird's ability once; after launch finishes or terrain contact forces a transition, solo locomotion/attack rules apply. During flight, allow only limited directional influence (e.g. +/-10% velocity) rather than unrestricted midair steering, except each defined ability.

**Collision:** Launch flight has its own first active hitbox, one hit per target. If the bird hits shield or an opponent, resolve physical momentum/knockback and transition coherently to solo state instead of sticking to target. At floor impact, enter a small roll/landing animation. The separate slingshot applies rearward recoil ~0.17W/tick at departure, friction/lifetime tuned so it does not roll away forever. The bird always shares existing damage.

| Bird | Launch startup | Damage | Speed | Flight | Single B activation |
| --- | --- | --- | --- | --- | --- |
| Flint | 12 | 13 | 0.55 | 32 ticks | B battle cry: 3% in .85W radius, impulse opposite facing; one activation per launch; 10 frame animation |
| Bolt | 10 | 9 normal / 14 boosted | 0.72 | 28 ticks | B adds +0.38W/tick along existing velocity once, 3f later; allow ground skim without action cancel |
| Cinder | 17 | 18 max impact OR 16 explosive, not both | 0.45 | 40 ticks | B detonates once; radial impulse including self .18W/tick, brief soot expression, never invuln |
| Pip | 12 | 5% lead, side clones up to 3% each with total 8% max per target | 0.54 | 33 ticks | B creates two visual/attack clones from same mesh for 24 ticks; center is only player-controlled body; no extra damage stocks |
| Pearl | 13 | 8 bird impact + 9 egg; cap combined 13% per victim | 0.47 | 37 ticks | B drops one egg below and adds +0.16W/tick vertical self impulse; no repeated air stall |

**Flint:** straight dependable cannonball, average flight. B emits a tight 3%-damage battle cry that pushes surrounding opponents and subtly corrects its own flight path. Pushback does not grant repeat stall; only once per launched bird.

**Bolt:** strongest horizontal acceleration and biggest momentum carry. B boosts **along current velocity** with a narrow but strong clean hit, rather than teleporting straight ahead; hitting a shallow slope may produce a legal skid. When landing, use capped tangential velocity so the move can generate interesting slides without crossing the entire arena involuntarily. A whiff should be punishable.

**Cinder:** heavy arc, impact up to 18%. B manually detonates with one large explosion but explosion and direct impact cannot both inflict their full values on the same target. Give Cinder a self-recoil impulse, not self-damage or invulnerability; this offers a niche recovery reversal. Long recovery on whiff.

**Pip:** pressing B generates two blue wingmen that peel away. One central bird is the only true player-controlled body. Side clones have collision attacks (small) but are not grabbable, have no hurtbox, and expire within 24 ticks. Do not let clone hit damage exceed the aggregate cap.

**Pearl:** B releases a single egg vertically down and bounces Pearl slightly upward. The egg explosion may also move the empty sling. Give a fixed one-per-launch egg activation and one small self impulse, not repeatable flight.

**Separated danger:** On launching, the player deliberately risks becoming a weak solo bird and physically crossing back to their slingshot. Never forcibly recall the bird. Solo's limitations (range and kill power) create the risk/reward rather than artificial time limits.

## I. Combined Up-B — CATASTROPHIC LAUNCH (universal for all five)

This is **the signature comedy attack**. Hold Up+B to tension the living slingshot while the loaded bird braces inside; use the main stick to aim **anywhere in 360 degrees**. On releasing B, the bird AND the entire slingshot launch as one tumbling entity, not separate. Extremely exaggerated spinning animation, comic faces, fluttering bands, and a real collision hitbox. Different birds react differently in facial expression, but gameplay trajectory and damage chart are the same before movement multipliers / engine forces.

**Timeline:** 7 ticks entry animation, then charge 0..45 ticks while aim is sampled. Charge progress can be held at max without auto-launch; player must release B (unless interrupted or KO'd). Holding the move in midair does not freeze gravity, only reduces gravity by ~25% during the charge. No armor or invulnerability while charging. Show an unobtrusive charge gauge and small aiming arrow; the direction can be changed every tick until release.

| Charge ticks | Damage | Range behavior | Readability |
| --- | --- | --- | --- |
| 0-10 | 8% | Short burst | Fast, punishable close-range option |
| 11-25 | 13% | Medium | Growing wooden strain effect |
| 26-44 | 18% | Long | Clear high-risk tell |
| 45+ (capped) | 24% | Very long | Maximum power; prominent telegraph, charge remains held |

**Geometry:** one tumbling compound hitbox centered around character (0.65W x 0.57W max ellipse), adjust with animation, only one damaging hit per victim per launch. Initial speed should smoothly scale ~0.34 to 0.80 W/tick (not a literal engine velocity until mapped). Contact at a shallow angle should preserve **some** tangential momentum and cause a deterministic skid. Steep terrain contact can cause **one** energy-loss bounce (never gain momentum). On clean hit, strong knockback and a dramatic slowing stumble; full-charge kill power should *feel* comparable to a powerful Flare Blitz clean hit but not reproduce its exact engine-specific values.

**Recovery risk:** after miss/landing, approximately 28 landing/recovery ticks, longer on high-velocity crash; do not let stored launch velocity cancel this lag. Once per airtime, reset after real landing or standard ledge return. Do not let a D-air recoil or switch reset the Up-B availability in midair. Straight-down launches are legal and can self-destruct.

**Animation:** at low charge, one clumsy tumble; maximum charge spins several times with band stretch, eyes, tongue and feather secondary motion. Keep animation's visual spin decoupled from deterministic collision velocity: any spin effects must be reproducible from state/time, and hitboxes must remain readable.

## J. Separated bird: full normal, grab, throw and defensive kit

This is the *Popo without Nana* feeling: little bird is significantly weaker without its wood-and-elastic weapon but can still create clutch moments. Every bird uses the same core solo attack **timings and geometry** with modest animation differences. Solo hurtbox is much smaller; don't accidentally buff too much by giving it tiny hurtbox *and* full combined damage, startup and reach. Each solo move has one actual hit event except where specified. No separate special resources or damage percent.

| Move | Start | Act | End | FA | Dmg | Angle | Hitbox |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jab | 3 | 2 | 10 | 16 | 3 | 58 | ellipse x=.48 y=.06 radii=.30/.20 |
| Forward Tilt | 6 | 3 | 17 | 27 | 5 | 45 | ellipse x=.54 y=.15 radii=.37/.23 |
| Up Tilt | 6 | 4 | 16 | 27 | 4 | 90 | ellipse x=.12 y=.60 radii=.35/.33 |
| Down Tilt | 5 | 3 | 16 | 25 | 4 | 72 | capsule x=.12.. .56 y=-.31 r=.15 |
| Dash Attack | 9 | 4 | 23 | 37 | 6 | 60 | ellipse x=.49 y=.04 radii=.44/.31 |
| Forward Smash | 15 | 3 | 28 | 47 | 9 | 42 | ellipse x=.62 y=.18 radii=.46/.36 |
| Up Smash | 12 | 4 | 26 | 43 | 8 | 88 | ellipse x=0 y=.68 radii=.40/.45 |
| Down Smash | 13 | 4 | 27 | 45 | 8 | 35 | two ellipses x=+-.50 y=-.25 radii=.32/.22 |
| Neutral Air | 6 | 8 | 19 | 34 | 5 | 62 | ellipse centered 0,0 radii=.53/.46 |
| Forward Air | 8 | 3 | 22 | 34 | 6 | 46 | ellipse x=.55 y=.07 radii=.35/.20 |
| Back Air | 8 | 3 | 22 | 34 | 6 | 39 | ellipse x=-.48 y=.10 radii=.34/.22 |
| Up Air | 7 | 4 | 18 | 30 | 5 | 82 | ellipse x=.04 y=.64 radii=.37/.25 |
| Down Air | 13 | 3 | 26 | 43 | 6 | 270 | ellipse x=.00 y=-.60 radii=.36/.29 |
| Grab | 8 | 2 | 24 | 35 | 0 | 0 | capsule x=.20.. .55 y=.05 r=.19 |
| Pummel | 4 | 2 | 9 | 16 | 1 | 0 | captured target |
| Forward Throw | 10 | 1 | 20 | 32 | 5 | 45 | captured target |
| Back Throw | 12 | 1 | 20 | 34 | 6 | 137 | captured target |
| Up Throw | 11 | 1 | 18 | 31 | 5 | 89 | captured target |
| Down Throw | 12 | 1 | 18 | 32 | 4 | 72 | captured target |

**Defense:** solo bird can shield, shield-break, roll, spot dodge, air dodge, ledge grab, jump, double jump, tech, grab and throw. Existing universal game rules determine those frames; do not implement a second broken defensive system. Solo's weak grabs have visibly short range; solo forward/up/back/down throws are described in JSON.

**Primary distinction:** solo hitboxes measured in B, not W. Combined slingshot's oversized normals, projectiles and charged launches are unavailable until rejoin. Solo moves should permit survival and scrambles; most finishers intentionally struggle to kill before high percent.

## K. Separated bird specials — 15 distinct moves

A separated bird retains Neutral B, Side B and Up B with **specific mini-abilities**. They are not the combined powerful versions. Solo Down B checks rejoin proximity and otherwise stays inert.

| Bird | Solo move | Start | Act | End | Dmg | Design |
| --- | --- | --- | --- | --- | --- | --- |
| Flint | Neutral B: Mini Cry | 9 | 3 | 19 | 3 | push radius .65B; low knockback |
| Flint | Side B: Angry Rush | 11 | 5 | 21 | 6 | speed .32B/tick |
| Flint | Up B: Double Hop | 6 | 1 | 26 | 2 | one upward impulse .80B/tick, used once airtime |
| Bolt | Neutral B: Beak Drill | 7 | 6 | 16 | 5 | 3 ticks of damage totaling 5, once per enemy |
| Bolt | Side B: Sprint Burst | 9 | 7 | 24 | 5 | speed .48B/tick, slides on landing |
| Bolt | Up B: Diagonal Flash | 8 | 4 | 28 | 3 | single diagonal boost .70B/tick, used once airtime |
| Cinder | Neutral B: Smoke Puff | 15 | 5 | 25 | 6 | near body .8B radius |
| Cinder | Side B: Heavy Roll | 14 | 10 | 31 | 8 | slow armored only frame 15-17 vs weak hits |
| Cinder | Up B: Blast Hop | 15 | 4 | 32 | 6 | short upward blast, recoil and landing lag |
| Pip | Neutral B: Mini Split | 12 | 3 | 19 | 5 | two temporary clones, no independent hurtbox |
| Pip | Side B: Trio Stampede | 10 | 7 | 25 | 6 | 3 short pulses, aggregate 6 |
| Pip | Up B: Bird Ladder | 8 | 10 | 29 | 3 | 3 staged upward impulses, once airtime |
| Pearl | Neutral B: Weak Egg | 15 | 2 | 27 | 6 | one tiny egg active |
| Pearl | Side B: Flutter Check | 10 | 7 | 23 | 5 | gentle horizontal body-check |
| Pearl | Up B: Wing Float | 7 | 13 | 31 | 2 | slow upward impulse, air steering, once airtime |

**Solo recovery limit:** each bird's solo Up-B is once per airtime and follows the same grounded-reset convention as existing fighters. Bolt's diagonal flash has higher distance but more endlag; Pearl's float has weaker immediate distance but steering; Cinder's explosive hop can attack beneath itself but has a large punishable recovery. Ensure every bird can reach common ledges from a reasonable offstage distance without needing a teleport.

**Damage caps and collision gates:** 3 pulses from Pip's attacks share a single per-target aggregate damage cap; Cinder smoke/fuse cannot damage every simulation tick; any clone projectile lifetime is bounded; Pearl has only one active weak egg. If passive physics impulses inadvertently enable infinite air stalls, clamp impulse energy **rather than** adding arbitrary cooldowns to bird switching.

## L. Movement rules that invite discovery, not scripted gimmicks

Emergent advanced movement is one of the goals, but not at the expense of game stability. Write generic laws first, not hard-coded tricks:

1. Preserve horizontal momentum across air-to-ground and launch-to-solo transitions subject to consistent friction/caps. No arbitrary velocity resets at animation boundaries.
2. Projectile fire produces a small equal-and-opposite recoil on slingshot; D-air wooden dummy has a stronger **once per airtime** upward recoil. Deterministic recoil before collisions.
3. A directional launch into terrain computes normal/tangent components, losing energy and potentially skimming or bouncing once. No penetrations, no recursive energy gain.
4. Empty slingshot is a persistent, movable, tagged physics prop. Its movement is limited and consistent; opponent's attack explosions may nudge it but never count as hitting the player.
5. Pearl's egg explosion may push the empty slingshot; it must be deterministic and carefully capped.
6. Bolt's acceleration retains a capped amount of ground momentum. Directional inputs and slopes can interact to create emergent routes.
7. A launched bird's trajectory may naturally return it within rejoin range. Rejoin is a normal action, **not** a pre-scripted tether or instant recall.
8. Bird switching keeps legal movement momentum but cannot cancel existing recovery, multihit lockout, or cooldown of universal moves.
9. All special states have rollback snapshot/restore, seeded RNG if needed, and stable collision identity.

**Possible techniques to discover naturally:** dummy recoil jump, Up-B ground skim, Cinder explosion reversal, Bolt speed carry, Pearl egg-assisted slingshot displacement, flight-to-rejoin redirect, landing slide -> conventional attack. **Do not create move names or tutorial badges for these yet.** Let players find them. Record instrumentation so the team can later observe repeated emergent techniques and decide which deserve protection.

**Bugs to remove:** infinite true combos, platform clipping, wall phasing, unbounded speed, airborne infinite flight, invulnerable release loops, repeated hitbox spawning, accidental two-body damage, nondeterministic outcome and rollback desync.

## M. Control and interaction specification

| Player state | Input | Result |
|---|---|---|
| Combined neutral | Attack / tilt / smash / aerial | Universal slingshot normals, with selected bird modifiers |
| Combined neutral | Neutral B | Shoot wooden small blue bird dummy (form-specific behavior) |
| Combined neutral | Side B hold/aim/release | Launch real loaded bird; start separated flight |
| Combined neutral | Up B hold, steer, release | Charge Catastrophic Launch and fire both together |
| Combined neutral | Down B hold and direction | Open 5-slice wheel; commit on release |
| Combined neutral | Down B tap, neutral direction | Swap with last selected bird when actionable |
| Separated in flight | B once | Bird's unique midflight power |
| Separated in flight | Movement stick | Limited air influence, not free steering |
| Separated free | Neutral / Side / Up B | Solo bird specials |
| Separated near empty sling | Down B | 6-tick physical rejoin into slingshot |
| Separated far away | Down B | No action; optionally show directional indicator to sling |

**Controls edge cases:** releasing B while opening the Down-B wheel must not also fire a Neutral-B; Up-B aim must not accidentally trigger tilt/smash; side-B launch aim has commit window; pressing B in launch after ability already spent should not fire dummy projectiles. Support both keyboard and gamepad, with hold thresholds and a 5-slice selection UI readable at game speed. Preserve any existing controller remapping and accessibility defaults.

## N. Complete animation and effects production map

**Claude owns animation.** Use reusable armature poses and deterministic procedural transform curves, not a Meshy text-to-motion or animation-credit pipeline. Build a procedural slingshot from fork root, wood limbs, pivoting feet, band endpoints and pouch, with a child slot (`loadedBirdAnchor`) to attach a bird. Program angular compression, squash/stretch, snap-back, nervous hops, skid and spin with easing and inertial follow-through. The **feet are very small** and comedic, not human walking legs.

### Mandatory combined / slingshot clips (one set shared by five bird forms)

| Family | Clips / explicit states |
|---|---|
| Locomotion | idle, fidget, walk, run, dash start, dash stop, turnaround, crouch, jump squat, rise, double jump, fall, fast fall, ground land, landing skid, ledge hang, ledge getup |
| Universal attacks | jab1, jab2, jab finisher, F-tilt, U-tilt, D-tilt, dash attack, F-smash charge/release, U-smash charge/release, D-smash charge/release, N-air, F-air, B-air, U-air, D-air dummy fire |
| Grabs | grab whiff, grab connect, grab hold, pummel, forward throw, back throw, up throw, down throw |
| Defense | shield raise/hold/lower, spot dodge, roll forward, roll back, air dodge, shield break, trip, knockdown, tech, getup attack |
| Shared specials | neutral wooden shot load/fire/recover, Side-B aim/loaded bird release, empty sling recoil, Down-B selection wheel, Up-B wind/hold/aim/release/tumble/impact/skim/bounce/crash |
| Reactions/end states | light hurt, heavy hurt, airborne tumble, ledge impact, KO, respawn, dizzy, taunt A, taunt B, victory, defeat |

### Mandatory bird-in-pouch overlays (apply to all five without Meshy generation)

Idle bob and eyes; pout/squint/brow; brace during charge; headbutt/F-smash assist; U-smash extended; wing flare N-air; startled in skid; leaning during jog; ridiculous fear/excitement during Catastrophic Launch; midflight detachable launch; 6f reunion hop; quick swap pop-in. Each bird may use the same animation envelope with unique secondary motion/facial variables. Red/Flint irritated; Bolt excited; Cinder deadpan; Pip delighted/screaming; Pearl offended.

### Mandatory solo bird clips (shared action architecture, five procedural variants)

Idle, hop-walk, dash, stop, turn, crouch, jump squat, jump, second jump, fall, fastfall, landing, ledge hang/climb, shield, spot dodge, forward roll, back roll, air dodge, hurt, tumble, tech, KO, jab, F-tilt, U-tilt, D-tilt, dash attack, F-smash, U-smash, D-smash, N-air, F-air, B-air, U-air, D-air, grab, pummel, F/B/U/D throw, solo Neutral-B/Side-B/Up-B, rejoin hop. The silhouette must remain readable from a side-view game camera.

### Bird-specific special FX / motion overlays

- **Flint**: throat/chest inflate, short battle cry shock ring, battle cry air reaction.
- **Bolt**: beak tuck, speed streaks, brief stretched-body acceleration, tumble skid transition.
- **Cinder**: fuse burn, smoke eyes, orange flash, round explosion shader, soot expression, self-recoil.
- **Pip**: split transform into 3 visible copies using a single reusable source mesh, center controlled, two side clones time-out; merge/vanish FX.
- **Pearl**: egg pop-out, falling egg trajectory, burst, little recoil, feather float animation.
- **Wooden dummies**: mini carved blue bird, single red dummy, break into 3-5 inexpensive procedural wood shards at stage impact. No Meshy model needed.

**Animation direction:** clear 3-6 frame anticipation for big moves, strong 1-3 frame impact holds where appropriate, squash/stretch and mechanical spring recoil. Procedural bones animate below mesh silhouette without cloth simulation, dynamic-ragdoll randomness, or expensive physics-driven feathers. At 60 logic ticks, attach animation pose evaluation to action state elapsed ticks; visual smoothing may interpolate between ticks but must not affect hitboxes.

## O. Deterministic physics, rollback readiness, and entity lifecycle

Even though multiplayer is not the immediate deliverable, **do not build the character in a way that prevents it**. Never let rendering delta time update damage or movement. Everything that affects hits/position must be a pure fixed-tick update on canonical gameplay state. Snapshottable fields at minimum:

- fighter player id, form id, previous form id, combined/separated/flight/rejoin state, stock, percentage, lives, shield, facing, ground flags, jump count, upB-used;
- slingshot prop id, position, velocity, rotation if gameplay-relevant, drag, contact state, respawn timer;
- selected bird controlled entity id, position, velocity, action id, action frame, animation gameplay state, armor state;
- current aim vector and charge ticks for Side-B and Up-B, neutral B hold ticks, one-time midflight ability spent;
- active projectile IDs, owners, spawn ticks, velocities, hit registries, expiration, split state, egg state, explosion state;
- one-per-airtime D-air recoil flag, hitstun, landing lag, stop/hitlag if engine uses it, seed/state for any gameplay RNG.

**Deterministic entity order:** spawn/destroy in stable ID order, use engine-defined fixed-point or stable float math suitable for your platform, avoid browser-dependent physics jitter by sorting collision pairs and using consistent rounding. Do not call `Math.random()` for gameplay branches, wall-clock timers, animation event callbacks that spawn damage, DOM layout, or visual frame timing.

**Snapshot test:** capture all game state at frame 120, run fixed inputs through frame 240, restore frame 120 and replay identical inputs; positions, velocities, percent, active hitboxes, projectile IDs, and all special states must match exactly under chosen deterministic tolerance. Repeat with all five birds, Up-B skimming, and Pip split.

**Performance:** 1 player character may create a few projectile/clone entities; cap counts. The goal is stable 60Hz simulation independent of whatever number of render frames the user's browser reports. The game may still render very fast on desktop. Do not force the rendering loop down to 60 simply because the move frame data is at 60Hz.

## P. Hitstop, shield pressure, combo and balance targets

The character must be useful out of the box and have discovered skill ceiling. Initial balancing targets (not guarantees):

- Matchup goal after real testing: roughly even with middle-of-cast competitors at equal skill, no single bird mandatory.
- Flint should be the lowest execution stable baseline.
- Bolt deals modest per hit but can string quick aerials; reduce damage or hitstun rather than ruining his movement if overpowered.
- Cinder should earn KO power through slow, punishable commitments rather than invincible explosive hitboxes.
- Pip's clones and multihits must be visually readable and shieldable without endless true pressure.
- Pearl's eggs create space but stay limited to one active trap; egg routes should not force unavoidable offstage deaths.
- Combined Forward Air and Down Tilt are dependable neutral tools. Dash attack and smashes carry real commitment. Combined Up-B is powerful but extremely punishable if read.
- Separated normals should have around 55-65% of combined combat effectiveness in typical practical situations; do not simply scale damage by .6 and leave same ranges. Solo survivability can be good but offense weak.
- Switching bird type does not clear stale recovery, shield stun, grab capture, knockback velocity, stale moves, or knockback decay (if engine uses them).

**Suggested tune targets:** short combo routes 2-4 hits before meaningful defense, no frequent unavoidable 60% strings off Down Tilt, max-charge Up-B kills around the same percentage band as other heavy committed finishers on the roster, not at midstage absurdly early; solo bird kill moves require substantially higher percent than combined's normal kill moves. Test on light, medium and heavy archetypes and on three stage sizes, with real player inputs rather than AI-only tests.

**Debug overlay:** frame number, startup/active/endlag, selected bird, combined or separated, recovery flags, slingshot location indicator, charge %, aim direction, positions/velocities, collision normals, all hurtboxes and hitbox shapes, projectile IDs and per-target hit gates, damage and knockback vectors. Make display toggleable with no effect on determinism.

## Q. Implementation sequence, tests, and non-negotiable acceptance criteria

**Milestone 0: audit / baseline.** Confirm engine, branch, local multiplayer, input system, fixed-step plan. Identify conflicts. Preserve originals.

**Milestone 1: gameplay skeleton.** Create combined/separated/launch/rejoin state machine and the empty-sling prop using inexpensive placeholders. Implement switching and physical rejoin; no final art needed. Verify shared damage and solo state.

**Milestone 2: universal slingshot.** Implement all 15 combined normals plus grab, pummel, four throws, conventional defenses and movement. Implement dummy d-air and neutral projectile template. Hitbox debug overlay, collision sanity.

**Milestone 3: Catastrophic Launch.** Charge/aim/release, 360° angle, gradient damage/range, tumble, one hit per target, bounce/skim with energy loss, once per airtime, whiff lag. Test every direction including downward self-destruct.

**Milestone 4: Flint / side-B.** Actual living bird launch, transfer control in flight, one-time B battle cry, solo normals/specials, 6f reunion. Make complete mirror match playable before adding other forms.

**Milestone 5: Bolt / Cinder / Pip / Pearl.** Add movement tuning, 3 normal modifiers, 5 neutral projectiles, unique flight powers and 15 solo specials. Duplicate Pip's existing model (do not invoke Meshy extra).

**Milestone 6: asset pipeline.** Ledger cap 5 mesh generation submissions. Download GLBs, validate shape, adapt and rig, apply procedural slingshot and universal animation clips, facial reactions and low-cost FX. Do not block mechanics if assets are missing.

**Milestone 7: acceptance testing / tuning.** Automated replay comparisons, training mode, one-player, local two-player, 4-player stress where available, projectile limits, 2+ controllers, varied FPS, interrupted moves, KO/respawn, ledge/offstage cases, frame-perfect state transition tests. Compare real feel against roster and tune config rather than rewrite mechanics.

### Required acceptance test matrix

1. All five bird selections are available immediately when actionable and persist indefinitely.
2. Switching cannot cancel lag, shieldstun, hitstun, grabs, or recoveries.
3. Every combined normal, all throws/grabs and every separated normal has correct hitbox start/duration and first actionable frame.
4. Up-B only launches upon B release, can aim 360°, can be held at cap, moves against gravity, supports self-destruct and applies correct charge scaling, with one use per airtime.
5. D-air creates a wooden red dummy with 270° clean spike and only one upward recoil impulse per airtime.
6. Neutral B wooden blue dummies use the selected bird's five distinct projectile rules, with finite lifetimes and per-target damage caps.
7. Side-B launches the living bird, preserves stock and percent, leaves exactly one empty slingshot, and allows one unique midflight B activation.
8. Every solo bird has normals, defense, all four throws, three specials, predictable recovery, and physical reunite via Down-B near sling.
9. Slingshot can be repositioned/knocked but never damaged, permanently lost, multiplied or used as a solid invulnerable barrier.
10. Pip creates a single controlled center bird and two short-lived clones, no extra stock/hurtboxes or duplicate KO.
11. No infinite aerial boost or instant air resets from D-air, Up-B, Cinder blast, Bolt burst, Pearl egg or switching.
12. Regression: existing fighters remain playable, controls preserved, fixed-tick combat stays stable at different render frame rates.
13. Snapshot/restore replay results are identical for side-B, rejoin, all eggs, all explosions, all clones, Up-B aim/skims and KO cleanup.
14. Meshy ledger shows <= 5 submitted generations and zero paid animation generations.
15. Finished visuals are original and distinct; no copyrighted third-party assets imported.

## R. What Claude must report in final delivery

Deliver a playable character integrated into the *actual game*, not just scaffolding or concept code. Include:

- list of modified/new files; how to run development build, character-select test and debug overlay;
- where proposed 60Hz frame data and normalized hitbox geometry live, and any engine-specific conversions;
- exact completed roster of moves and animations; missing pieces clearly named instead of implied done;
- Meshy generation ledger and which GLBs exist; if no Meshy permission, show placeholders and next action to import the five models;
- rollback-readiness and deterministic replay evidence, including failed tests and known inconsistencies;
- intentional balance deviations and unresolved playtesting areas;
- a 5-minute manual QA walkthrough: choose each bird, fire dummy, Side-B launch, solo fight, rejoin, charge Up-B, downward self-destruct, Pip split, stage collision skim.

**Definition of done:** the character can be chosen in the roster and enjoyed in a real match today. The slingshot's physical comedy is unmistakable; all five birds work; separation/reunion changes the player's strategy; advanced physics feel consistent; and the implementation hasn't broken the rest of the game. No more than five Meshy model submissions were made. If any blocker remains, deliver maximum functional progress and a precise list of blockers — do not claim a completed implementation when it is only a plan.

## S. Attachments and file map

`furious_fowls_move_data.json`: canonical numeric frame/hitbox/timing and special parameter configuration.  
`assets/flint_turnaround.png` etc: visual turnaround sheets (three poses each).  
`assets/flint_front3q.png`, `assets/flint_side.png`, `assets/flint_rear.png`: clean single-view crops, similarly for four other birds.  
`meshy_generation_ledger.json`: initial 0-submission ledger used to ensure hard budget.  
`README.txt`: concise handoff instructions.

**Source reference for general Meshy constraints:** Meshy Image-to-3D documentation (https://docs.meshy.ai/en/webapp/image-to-3d), rigging (https://docs.meshy.ai/en/webapp/guides/3d-model/rigging), animation (https://docs.meshy.ai/en/webapp/guides/animate). Tool documentation may change; confirm exact options before generation. The animations and data tables in this specification are original **proposed** values, not externally validated frame data.

