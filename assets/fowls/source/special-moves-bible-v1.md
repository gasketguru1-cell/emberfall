
# FURIOUS FOWLS — BIRD SPECIAL MOVES & PLAYSTYLE BIBLE
## Claude Code implementation specification — v1.0

**Purpose:** Design and implement a complete set of distinctive, expressive, balanceable special moves for Flint, Bolt, Cinder, Pip, and Pearl. Every bird must have a recognizable gameplay identity. Do not make five variations of “shoot a projectile.” The moves should be physical, readable, interactive, and fun to discover.

**This document supplements the Furious Fowls Complete Moveset Overhaul v3.0.** It preserves the established controls, the skinny wooden slingshot, the bird-selector system, the playable-bird separation mechanic, and the end-over-end Sling Spin / Catapult Cyclone. It replaces the old wooden-ammunition Down B concepts and the generic bird-alone special table. If any old special-move description conflicts with this document, use this document for the bird-specific specials.

## 1. Design thesis: five different verbs

Each bird must change how the player moves, approaches, controls space, escapes pressure, and edgeguards. Damage numbers alone do not create identity.

| Bird | Personality | Gameplay role | Core verb |
|---|---|---|---|
| Flint | Determined, dependable, protective | Balanced brawler and pressure anchor | **Brace / rebound** |
| Bolt | Impatient, sharp, restless | Speedster and pursuit specialist | **Accelerate / redirect** |
| Cinder | Confident, heavy, explosive | Power fighter and space punisher | **Compress / detonate** |
| Pip | Playful, mischievous, coordinated | Trickster, formation fighter, cross-up specialist | **Duplicate / switch** |
| Pearl | Poised, graceful, resilient | Aerial controller, setup and recovery specialist | **Float / lift** |

A player should be able to identify which bird is selected by playing for ten seconds with the screen partly obscured. If two birds solve neutral, recover, approach, and edgeguard in the same way, their kits are not distinct enough.

### Global rules

- Avoid projectile-heavy design. No bird should depend on repeatedly firing small objects to be useful.
- The primary hitboxes should come from the bird, slingshot, elastic bands, body movement, or temporary companions.
- Pearl may use one stationary egg/nest setup. It is a planted stage object, not a stream of fired projectiles.
- Do not give every bird a generic charge shot, generic dash, or generic radial explosion.
- Every special must have a clear use, a visible tell, a punish window, and a meaningful answer for the opponent.
- Preserve DI, SDI, shielding, grabs, parries, ledge options, and counterplay. No unavoidable tethers or automatic tracking.
- Make movement mechanics discoverable through consistent physics, not random hidden bonuses.
- Use the existing five bird models. Pip's companions are deterministic runtime duplicates of the one Pip model. No new Meshy generations are required for this moveset.

## 2. Controls and form rules

| Input | Slingshot + bird loaded | Bird separated / controlled |
|---|---|---|
| Neutral B | Monado-Arts-style bird selector | That bird's unique signature ability |
| Side B | Fire the living bird and transfer control | That bird's unique attack / approach tool |
| Up B | Shared Catapult Cyclone; bird-specific spin behavior | That bird's unique recovery |
| Down B | That bird's unique slingshot technique | Rejoin the empty slingshot when physically close |

**Neutral B selector is protected.** In slingshot form, Neutral B must never become a projectile or a bird-specific attack. Quick tap cycles Flint → Bolt → Cinder → Pip → Pearl. Hold to open the five-way selector; point with the main stick and release to confirm. Selection cannot cancel hitstun, committed attacks, or recovery.

**Side B is a form transition, not a projectile.** The bird becomes the player's controlled character. Its body is the attack. Do not spawn a disposable projectile copy and leave the player controlling the slingshot.

**Up B keeps its established identity.** Catapult Cyclone is still a chargeable, aimable, end-over-end spin of the complete slingshot-and-bird rig. Bird-specific differences alter the orbit, speed, drag, and finisher—not the core concept.

**Down B is the main bird-specific slingshot special.** Replace the old wooden-ammunition moves. Each bird now has a physical technique that expresses its role.

In bird-alone form, Neutral B, Side B, and Up B are the bird's own unique specials. Down B is reserved for physically returning to the slingshot. Do not add a second selector while separated.

## 3. Flint — the dependable brawler

**Personality:** Determined, grounded, protective, and stubborn. Flint is the bird who stands his ground and makes the opponent deal with him. He is not the fastest or strongest; he is the most dependable at turning a close interaction into another close interaction.

**Gameplay promise:** Stable pressure, honest confirms, strong defensive timing, and satisfying rebounds. Flint should be the easiest bird to understand but still reward timing and good positioning.

### Slingshot Down B — BRACE & BREAK

The slingshot plants its wooden handle against the floor, leans back, and stretches the bands. Flint braces in the pouch. This is a close-range defensive stance that converts a frontal commitment into an elastic counterattack.

- Startup: 7f to plant.
- Counter window: frames 8–13 after input.
- On a successful frontal melee counter: absorb only a limited amount of damage, then snap forward into the attacker for 10% and a reliable diagonal launch.
- On a successful counter, Flint rebounds slightly backward/upward. This creates a possible jump, aerial, or reposition follow-up, not a guaranteed combo.
- If no attack arrives, press attack or release Down B after frame 10 to perform a weaker 6% forward band snap.
- Whiff recovery: 24f. Counter recovery: 18f.
- Does not counter grabs, attacks from behind, or attacks that clearly bypass the planted front.
- No full invulnerability. A strong attack can overpower the brace and deal reduced but real damage.

**Why it belongs to Flint:** he stands his ground, takes the confrontation, and turns the opponent's commitment into a rebound.

### Slingshot Side B — REDLINE LAUNCH

Flint is fired from the pouch in a direct, controlled cannonball arc. The launch is forceful but predictable. On body contact, Flint bounces away from the target at a controllable angle.

- Startup: 13f; launch hitbox active 13–16f.
- Launch contact: 9%.
- Medium travel speed; moderate air control.
- On hit, Flint gets one recoil bounce. Angle the next drift with the stick.
- On shield, he is pushed away and cannot bounce off the shield for free.
- The player controls Flint after launch. The empty slingshot remains behind.
- No automatic return and no fixed flight timer.

**Use:** approach, pressure a landing, recover toward stage after a hit, or create a second approach angle after the first collision.

### Slingshot Up B — CATAPULT CYCLONE: FLINT VARIANT

Keep the shared end-over-end rig rotation. Flint has the most stable, readable orbit: moderate speed, even hit spacing, reliable drag, and a clean final pop. He is the reference version against which the other four variants should be judged.

### Bird-alone Neutral B — RALLY CRY

Flint gives a short, determined cry and snaps his wings outward. A compact circular pressure pulse forms immediately around his body.

- Startup: 9f; active: 10–13f.
- Damage: 3%.
- Very short radius; low knockback and brief hitstun.
- Its purpose is to interrupt close pressure, create breathing room, or confirm into a quick aerial—not to kill.
- It does not travel outward as a projectile. The hitbox is attached to Flint's body.
- Whiff recovery: 17f.

### Bird-alone Side B — SHOULDER CHECK

Flint lowers his head and drives forward with a sturdy shoulder/body rush.

- Startup: 12f; active: 13–20f.
- Damage: 7%.
- Moderate horizontal travel; limited steering.
- On hit, Flint rebounds slightly upward and forward. The rebound can lead to a chase, but not a guaranteed follow-up.
- On shield, he stops close enough to be punished if used carelessly.
- Recovery: 23f on hit, 28f on whiff.

### Bird-alone Up B — CAPTAIN'S VAULT

Flint performs a strong first hop, then gets a second elastic hop if Up B is pressed again during a short window.

- First lift begins on 7f; second input window lasts 16f after the first hop.
- Each hop has a small 2% body hitbox.
- Moderate vertical recovery, dependable horizontal control.
- Once per airtime; refreshes on landing.
- The second hop is not automatic. Players choose whether to spend it immediately or hold it for a recovery mix-up.

**Discoverable movement:** use the first hop to bait an edgeguard, delay the second hop, then drift back toward stage. The second hop is a resource, not a mandatory animation.

## 4. Bolt — the restless speedster

**Personality:** Impatient, sharp, always moving. Bolt hates staying where the opponent expects him to be. His kit is about acceleration, abrupt braking, redirection, and preserving momentum.

**Gameplay promise:** the highest movement expression and pursuit potential. Bolt should feel brilliant in the hands of someone who understands drift and terrible in the hands of someone who presses forward without thinking.

### Slingshot Down B — SKITTER STEP

The slingshot tips low and snaps along the floor in a quick, elastic skid. It is a movement technique first and a small attack second.

- Startup: 5f; low-profile movement begins on 6f.
- Contact hitbox: 6–10f, 3%.
- Strong horizontal burst, low vertical displacement.
- One directional correction is allowed during the burst. The correction is immediate but limited; it cannot reverse the full dash.
- If the player jumps during the final 4f, the skid converts into a low forward hop that preserves most horizontal momentum.
- If blocked, the slingshot loses momentum and is punishable. It cannot freely pass through shields.
- Recovery: 14f after a clean finish; 20f if blocked.

**Why it belongs to Bolt:** he is a sudden change of direction, not a projectile.

### Slingshot Side B — NEEDLEFLASH LAUNCH

Bolt is fired as a narrow, high-speed body dart. The player controls his flight and can make one sharp mid-flight vector correction.

- Startup: 10f; launch contact: 7%.
- Fastest initial launch of the five birds.
- Narrower body hitbox than Flint; better for threading gaps, worse for broad coverage.
- One mid-flight correction. The correction costs speed, so it is a choice between precision and distance.
- On hit, Bolt passes through and carries forward; he does not automatically bounce back.
- On shield, he is stopped and left vulnerable.
- No homing, no repeated afterimages that deal damage, and no invulnerability.

### Slingshot Up B — CATAPULT CYCLONE: BOLT VARIANT

Bolt rotates the complete rig faster and carries more horizontal momentum. The orbit is tighter than Cinder's and the finisher is weaker than Flint's. It is best for recovering from a distance or carrying an opponent laterally, but its narrow sweep can miss if aimed carelessly.

### Bird-alone Neutral B — BRAKE & BURST

Bolt abruptly kills his current momentum for a brief instant, then bursts in a chosen direction. It is a feint and repositioning tool, not a teleport.

- Startup: 5f brake; directional burst begins after 3f.
- Burst contact: 3.5%, active for 4f.
- Can reverse current horizontal momentum, including air drift.
- No invulnerability during the stop or burst.
- The player may choose a new direction during the brief brake window.
- Whiff recovery: 16f. If the burst hits shield, Bolt slides away and can be punished if too close.

**Discoverable movement:** reverse a fast approach at the last moment, bait a whiff, then burst back in. Momentum is preserved only when the player chooses not to brake.

### Bird-alone Side B — ZIGZAG

Bolt makes a fast two-stage dash. The first stage commits to the chosen direction; the second stage can be redirected once.

- Startup: 8f; first hit active 9–12f.
- Damage: 5%.
- After the first stage, one directional correction changes the second-stage angle.
- If the first stage hits, Bolt can still choose whether to continue past the target or brake short.
- If blocked, the second stage loses its hitbox and Bolt is punishable.
- Recovery: 20f.

### Bird-alone Up B — FLASH STEP

Bolt launches in a chosen 8-way direction, then receives one small steering correction.

- Startup: 9f; body hitbox active 10–13f.
- Damage: 3%.
- High horizontal distance, moderate vertical recovery.
- If he hits an opponent, he glances off at a shallow angle and retains some momentum.
- One use per airtime.
- The correction changes the trajectory but cannot create a second full dash.

**Discoverable movement:** use the first vector to clear the ledge, then correct inward at the last moment. A good Bolt player should recover with sharp angles rather than raw distance.

## 5. Cinder — the heavyweight

**Personality:** Confident, patient, and intimidating. Cinder does not rush. He compresses force, occupies space, and makes the opponent regret challenging him at the wrong moment.

**Gameplay promise:** powerful close-range punishment, heavy landings, shield pressure, and commitment. Cinder's moves must be telegraphed enough to punish when guessed correctly.

### Slingshot Down B — ANVIL DROP

The slingshot lifts slightly, turns its wooden handle downward, and drives the handle into the ground. The impact creates a short, low shock ring around the base. It is a planted close-range space-control move, not a ranged blast.

- Startup: 15f; direct handle impact active 15–18f.
- Direct hit: 8%; nearby ground shock: 6%.
- Very short radius. The shock travels only a small distance along the floor and does not leave the ground.
- Strong shield pressure, but the move has clear startup and punishable recovery.
- If used in the air, Cinder drops handle-first. Landing creates the same small shock ring; a missed aerial landing has substantial landing lag.
- Recovery: 30f on whiff, 24f on hit.
- Does not hit through platforms or travel up walls.

**Why it belongs to Cinder:** he turns his weight into an impact and claims the space immediately around him.

### Slingshot Side B — METEOR LAUNCH

Cinder is fired as a heavy, slow cannonball. His flight is less steerable than the other birds, but the body hit is dangerous and he can dive to accelerate downward.

- Startup: 18f; launch contact: 15%.
- Slowest launch; strongest direct body impact.
- Hold down during flight to tuck and increase downward speed. Release down to resume normal air control.
- On a grounded opponent hit, Cinder rebounds slightly upward; on a wall or stage surface, he loses most forward speed.
- On shield, he stops hard and suffers heavy recovery.
- The player controls Cinder after launch. No automatic explosion and no fixed flight timer.

### Slingshot Up B — CATAPULT CYCLONE: CINDER VARIANT

Cinder has the slowest rotation and widest orbit. The bird and wooden base remain opposite ends of the same rotating rig. Each hit is heavier, with fewer re-hits and a stronger final pop. Charging gives more power but makes the launch easier to read. It should be possible to punish a poorly aimed Cinder spin.

### Bird-alone Neutral B — PRESSURE COOKER

Cinder crouches, compresses his body, and stores force. Release to create a point-blank radial burst centered on himself. Nothing is fired.

- Charge: 0–18f. Release hitbox begins 5f after release.
- Tap release: 6%; full charge: 11%.
- Short radius, strong shield pressure, high commitment.
- During the final 4f of charge, Cinder resists one weak flinch hit but still takes damage. Grabs and strong attacks beat the stance.
- Holding longer than 18f does not increase power.
- Whiff recovery: 30f; full-charge hit recovery: 22f.

**Use:** punish an opponent who insists on crowding Cinder, break a predictable shield habit, or force space before landing.

### Bird-alone Side B — FURNACE ROLL

Cinder tucks into a heavy rolling body attack. The front of the roll is difficult to stop, but the move is slow and vulnerable from above or behind.

- Startup: 13f; active: 14–22f.
- Damage: 9%.
- Low profile; moderate ground travel.
- A brief front-facing armor window exists on frames 14–16. It reduces one light hit; it does not negate strong attacks or grabs.
- Can bounce once off a stage wall, losing speed and changing direction.
- Cannot be freely steered after the first few frames.
- Whiff recovery: 29f; hit recovery: 24f.

### Bird-alone Up B — BLAST HOP

Cinder compresses and detonates the air beneath himself, launching sharply upward. The blast is a close-range body effect, not a projectile.

- Startup: 15f; close hitbox active 16–19f.
- Damage: 6%.
- Strong vertical lift, poor horizontal distance.
- The initial burst can interrupt a nearby edgeguarder, but it is not a long-lasting hitbox.
- One use per airtime.
- If used too close to the stage underside, the lift is reduced to prevent a free ceiling escape.

**Discoverable movement:** use Furnace Roll to force a shield, then threaten a delayed Pressure Cooker; or use Anvil Drop to punish a predictable landing. Cinder wins by making opponents respect space, not by chasing them.

## 6. Pip — the trickster trio

**Personality:** Playful, mischievous, quick-thinking, and coordinated. Pip is one small bird with two companions. They are not three independent fighters. They move like a practiced little team.

**Gameplay promise:** misdirection, cross-ups, formation coverage, and unusual recovery routes. Pip should have the highest number of clever position swaps and multi-angle interactions.

**Model rule:** create one Pip model and duplicate it at runtime. Companions share the same rig and animation state with deterministic offsets. Never spend Meshy credits on extra Pip models.

### Slingshot Down B — ORBIT PARADE

Two Pip companions pop out of the pouch and orbit the slingshot in a chosen formation. The companions remain visibly connected to the move; they are not fired away.

- Startup: 8f; formation active for 18f.
- Each companion makes up to two light contacts of 1.5% per opponent.
- The main slingshot can move at 70% normal speed while the formation is active.
- Stick input chooses the orbit plane and clockwise/counterclockwise direction at startup.
- Tap Down B again to end the formation early, creating a small 3% converging peck around the pouch.
- No full-body invulnerability. Attacks can interrupt the setup.
- Recovery: 17f after natural end; 21f if manually converged.

**Why it belongs to Pip:** the companions coordinate around the main body to create a moving puzzle for the opponent.

### Slingshot Side B — TRIO LAUNCH

Pip is fired from the pouch with two companions in a staggered formation. The player controls the lead Pip; the other two follow fixed, deterministic offset paths and can create additional body contacts.

- Startup: 13f; lead launch hit: 5%.
- Each companion can add one 2% contact hit during the initial formation window.
- Formation lasts up to 20f, then companions return to a close orbit around lead Pip.
- Stick input adjusts the lead trajectory; companions keep their staggered offset.
- No companion homes in on the opponent. No independent long-range projectiles.
- On shield, companions do not keep hitting indefinitely; the formation breaks and Pip is left vulnerable.

### Slingshot Up B — CATAPULT CYCLONE: PIP VARIANT

The full slingshot rig still rotates end over end. Two companions orbit in staggered positions around the rotating axis, creating a wider but more readable pattern. Their hitboxes are smaller and weaker than the main bird/base endpoints. Pip gets coverage, not Cinder-level power.

### Bird-alone Neutral B — SWITCHEROO

Two companions appear at offset positions. The player chooses left or right with the stick, then Pip swaps places with that companion after a brief tell. The other companion remains as a decoy for a moment.

- Startup: 8f; swap occurs on 9f after input.
- Swap contact: 2% only if Pip physically overlaps an opponent during the transition.
- No invulnerability during startup or arrival.
- The companions disappear after the swap or after 24f.
- Can be used in air; horizontal and vertical positions are preserved relative to the selected companion.
- Whiff recovery: 15f.

**Use:** cross-up, escape a corner, bait an attack at the wrong position, or create a new edgeguard angle.

### Bird-alone Side B — TRIO RELAY

Pip darts forward while the two companions sweep in from alternating sides. This is a coordinated close-range pincer, not a projectile volley.

- Startup: 10f; lead hit active 11–14f.
- Lead hit: 4%; each companion: 2%.
- Companions arrive 4f apart and can hit the same target once each.
- Stick input slightly changes the pincer angle.
- If the lead Pip misses, companions still finish their short paths and then disappear; the move cannot be repeated immediately.
- Whiff recovery: 25f.

### Bird-alone Up B — BIRD LADDER

The two companions create two temporary moving footholds. Pip bounces off the first, then may steer into the second for another lift.

- First hop begins on 8f; second bounce window begins 10f later and lasts 8f.
- Each bounce has a small 2% body contact hitbox.
- First bounce provides moderate vertical lift; second bounce provides less height but better horizontal steering.
- The player chooses the second bounce direction with the stick.
- One use per airtime. If the second bounce is not used, companions vanish and the move ends.
- Pip can be hit between bounces. The footholds are not invulnerable platforms.

**Discoverable movement:** use Switcheroo to bait an edgeguard, then Bird Ladder to recover along an unexpected angle. Trio Relay is strongest when the opponent is already committed to one side.

## 7. Pearl — the aerial controller

**Personality:** Poised, graceful, observant, and resilient. Pearl is not a fragile floaty character. She controls the pace of aerial interactions, chooses when to descend, and creates favorable airspace.

**Gameplay promise:** exceptional drift control, landing manipulation, vertical recovery, and one careful setup tool. Pearl should be able to make an opponent's edgeguard timing uncomfortable without having a powerful escape from every situation.

### Slingshot Down B — NEST MARKER

Pearl gently drops one egg beneath the slingshot and creates a small planted nest. It is a stationary setup, not a thrown projectile.

- Startup: 12f; the nest appears directly below/near the slingshot.
- One nest maximum. It lasts 150f or until triggered/destroyed.
- If an opponent enters its small radius, it opens into a brief vertical updraft that lifts the opponent slightly and gives Pearl a small drift boost if she is nearby.
- Trigger effect: 2% damage, low knockback, short lift.
- Opponents can destroy the nest with a grounded attack. It does not trigger through platforms.
- Pearl cannot place another nest until the first disappears.
- Recovery after placement: 18f.

**Why it belongs to Pearl:** she creates a small favorable patch of airspace and uses it to control a future interaction. It is a trap/setup tool, not projectile spam.

### Slingshot Side B — GLIDE RELEASE

Pearl is released from the pouch into a long, floaty arc. She has the best air steering of the five birds but the weakest immediate collision power.

- Startup: 14f; launch contact: 6%.
- Moderate initial speed, strong air drift, low gravity during the first part of flight.
- Hold a direction to bank gradually; reverse direction takes time and loses speed.
- On contact, Pearl glances past the opponent with a soft lift rather than a heavy knockback.
- No homing and no automatic egg drop.
- The player controls Pearl after launch.

### Slingshot Up B — CATAPULT CYCLONE: PEARL VARIANT

Pearl's complete rig rotates end over end with a slower, floatier orbit and gentle upward drift. The orbit is broad but the hits are light. She gains more recovery distance from steering and lift, not from raw launch speed. Keep the bird and wooden base at opposite ends throughout.

### Bird-alone Neutral B — FEATHER BRAKE

Pearl opens her wings and converts horizontal momentum into a controlled float. This is an aerial-control tool, not a shield or a free hover.

- Startup: 5f.
- For up to 24f, horizontal air drift becomes more precise and downward speed is reduced.
- The player can release Neutral B at any time to restore normal gravity and preserve the chosen direction.
- If Pearl enters the move with high horizontal speed, the brake gradually converts some of it into upward lift.
- No invulnerability and no hitbox.
- After use, 18f before it can be used again while airborne; it refreshes on landing.

**Use:** delay a landing, drift away from a ledge trap, or hold an aerial position long enough to challenge a recovery.

### Bird-alone Side B — SWOOP & FOLD

Pearl folds her wings and glides through a controlled arc, then opens them for a wide close-range sweep. The move can pass across an opponent, but it is not a teleport.

- Startup: 9f; sweep active 12–17f.
- Damage: 5%.
- Stick input sets the approach angle; a small correction is allowed before the sweep.
- On hit, Pearl glances upward and outward, creating space rather than a hard launch.
- On shield, she is pushed away and has moderate recovery.
- Whiff recovery: 22f.

### Bird-alone Up B — THERMAL RISE

Pearl catches an updraft and climbs in a smooth, steerable arc. It is the best sustained vertical recovery, but it has weak immediate protection.

- Startup: 8f; lift begins on 9f.
- Small wing contact: 2% during the first 4f only.
- Strong vertical travel, excellent gradual steering, low initial horizontal burst.
- Holding a direction banks the rise; sharp reversals are slow.
- Once per airtime.
- Can be interrupted by a well-timed attack after the initial lift.

**Discoverable movement:** combine Feather Brake with Swoop & Fold to delay a landing and then change approach angle. Place Nest Marker before leaving the stage to create a recovery/edgeguard interaction.

## 8. Bird identity at a glance

| Bird | Slingshot Down B | Slingshot Side B | Bird Neutral B | Bird Side B | Bird Up B |
|---|---|---|---|---|---|
| Flint | Brace & Break | Redline Launch | Rally Cry | Shoulder Check | Captain's Vault |
| Bolt | Skitter Step | Needleflash Launch | Brake & Burst | Zigzag | Flash Step |
| Cinder | Anvil Drop | Meteor Launch | Pressure Cooker | Furnace Roll | Blast Hop |
| Pip | Orbit Parade | Trio Launch | Switcheroo | Trio Relay | Bird Ladder |
| Pearl | Nest Marker | Glide Release | Feather Brake | Swoop & Fold | Thermal Rise |

The shared Up B in slingshot form remains Catapult Cyclone, with bird-specific behavior described above. Neutral B in slingshot form remains the selector.

## 9. Balance and counterplay requirements

These are starting values for a 60 Hz simulation, not sacred final values. Confirm the engine's frame convention before implementation.

- Flint wins by timing and dependable close-range interaction. Brace & Break must be punishable when baited; do not let it counter grabs or attacks from behind.
- Bolt wins by movement and angle changes. His bursts must lose to prediction, shield, and well-placed disjointed attacks. Do not add blanket invulnerability.
- Cinder wins by commitment and punishment. His strongest attacks must have visible startup and substantial whiff recovery. Armor is narrow and limited.
- Pip wins by creating multiple approach angles. Companion attacks need clear timing and deterministic paths. Never let duplicates become endless hitbox spam.
- Pearl wins by controlling airspace. Her float and recovery tools must remain interruptible and cannot grant unlimited airtime. Nest Marker is one stationary setup only.

### Damage and hit-count guardrails

- Most quick special contacts should be in the 2–7% range.
- Strong committed specials may reach 8–11%.
- Cinder's high-charge Pressure Cooker and the shared fully charged Catapult Cyclone are exceptions, with clear startup and punish windows.
- Pip's companions must have strict per-target re-hit limits.
- Multi-hit attacks must have a defined final hit or end state. No infinite dragging loops.
- Movement-only moves such as Feather Brake do not need damage to be valuable.
- Do not add hitstun so long that every special becomes a guaranteed combo starter.

### Edgeguard roles

| Bird | Edgeguard strength | Intended method | Limitation |
|---|---|---|---|
| Flint | Reliable | Redline Launch, Shoulder Check, stable aerial pressure | Less range and chase speed than Bolt |
| Bolt | Excellent pursuit | Needleflash, Zigzag, vector corrections | Easy to punish if he commits to a predictable line |
| Cinder | Strong space denial | Anvil Drop, Meteor Launch, Furnace Roll | Poor chase; misses are costly |
| Pip | Multi-angle pressure | Trio Relay, Switcheroo, Orbit Parade | Formation timing can be interrupted |
| Pearl | Aerial control | Glide Release, Feather Brake, Nest Marker | Weak direct kill power and interruptible recovery |

## 10. Animation and readability requirements

The animation must communicate the gameplay verb before the hitbox becomes active.

- Flint: plant the handle, brace the pouch, then snap forward. His bird expression should look determined, not manic.
- Bolt: compressed posture, sharp directional lean, elastic snap, visible braking skid. The animation must show the correction point.
- Cinder: slow compression, weight shift, heavy contact, visible recoil. The audience should understand why the move is powerful.
- Pip: companions appear in clear formation, never as random particles. The player must be able to read which Pip is the lead and where the next companion will enter.
- Pearl: wing posture communicates lift, brake, bank, and descent. Nest Marker must be visibly planted and breakable.

Use existing models, rigs, and animation tooling. Generate animation from the available rigs wherever possible. Do not create a new Meshy model for every move, companion, effect, or projectile. The only new simple asset that may be needed is Pearl's stationary nest/egg; create it procedurally or from existing geometry.

## 11. Technical implementation requirements

- Keep all gameplay authoritative at fixed 60 Hz.
- Every companion spawn, position, attack, swap, and despawn must be deterministic and rollback-safe.
- Do not use wall-clock timers, random offsets, nondeterministic physics, or render-frame timing for gameplay.
- Separate visual animation from hitbox simulation. The animation should follow gameplay state, not determine collision timing.
- Use body capsules or swept capsules for lunges, rolls, pincer attacks, and rotating companions.
- Hitboxes must follow the visible attacking body part. Do not use tiny static boxes for wide swings.
- Keep DI and SDI available on multihits. Apply low drag impulses on intermediate hits and reserve meaningful launch for the final hit.
- Do not make any move automatically track an opponent.
- Keep the start-menu Show Hitboxes toggle from the previous overhaul: default OFF; it hides debug graphics only and never changes collision.
- Reuse the current input system, state machine, hitbox framework, settings, and animation system. Do not rewrite unrelated systems.
- Preserve all unrelated characters and existing working moves.

## 12. Implementation order for Claude

1. Inspect the current code and map every existing Furious Fowls special to the control architecture in this document.
2. Preserve Neutral B selector, the living-bird Side B transition, the shared end-over-end Catapult Cyclone, and bird-alone Down B rejoin.
3. Remove the old wooden-ammunition Down B implementation. Replace it with the five physical slingshot techniques.
4. Implement Flint's full kit and use it as the baseline for state transitions and hitbox conventions.
5. Implement Bolt's momentum and redirection states.
6. Implement Cinder's compression, armor window, and heavy impact states.
7. Implement Pip's deterministic companion system once, then reuse it across Orbit Parade, Trio Launch, Switcheroo, Trio Relay, and Bird Ladder.
8. Implement Pearl's air-control states and one stationary Nest Marker object.
9. Add per-bird Catapult Cyclone parameters without changing the end-over-end rotation geometry.
10. Tune recovery, whiff lag, hitstop, damage, and hitbox dimensions through actual playtesting.
11. Test combos, shield interactions, ledge pressure, edgeguards, recovery routes, and all bird switches.
12. Run regression tests on the rest of the game. Report what was implemented, what was preserved, and what remains incomplete.

## 13. Acceptance tests

- A player can recognize each bird's identity from movement and special interactions, not just color or damage.
- Neutral B in slingshot form always selects birds and never fires a projectile.
- The old wooden-ammunition Down B moves are gone.
- Each bird has a different slingshot Down B.
- Each bird has a different living-bird Neutral B, Side B, and Up B.
- Side B launches the actual controllable bird; it is not a disposable projectile.
- Catapult Cyclone remains the shared end-over-end spin, with meaningful bird-specific variations.
- Pip's companions are deterministic duplicates of one model and cannot create infinite hit loops.
- Pearl's Nest Marker is a single stationary setup object, not a projectile stream.
- Every special has visible startup, a real recovery window, and opponent counterplay.
- All gameplay states are fixed-tick deterministic and compatible with rollback.
- The game still runs and unrelated characters/moves remain intact.

## 14. Final instruction to Claude

Implement these bird-specific specials in the existing Furious Fowls game. Do not merely summarize the document or produce another proposal. Inspect the current implementation first, preserve working code, and make the smallest safe set of changes. The objective is five genuinely different fighters inside one unusual character: Flint braces and rebounds; Bolt accelerates and redirects; Cinder compresses and impacts; Pip duplicates and switches; Pearl floats and lifts. Do not solve character identity by giving every bird another projectile. Make the moves physical, expressive, readable, balanceable, and fun to discover through play.
