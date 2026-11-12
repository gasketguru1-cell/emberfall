# Emberfall asset library

One folder per character. Inside each:

- `source/` reference art and the written brief
- `meshy/` one JSON per Meshy task: task ID, endpoint, settings, credits, date, verdict
- `raw/` downloads exactly as received (not committed to git)
- `work/` Blender files and scripts
- `export/` game-ready GLB files, versioned

## Status

The roster: Flint, Wren's three companions Nib, Loom and Hod, and (added 2026-11-10 at the owner's request) Potato Sack, Sprocket and Scuttle. Brand was added on 2026-11-10 (model 30 credits, 26-bone rig, 35 clips; details in WORKQUEUE.md). Joey (the owner, with a transformation into Cronky Dong) was added on 2026-11-11 (68 credits; details in WORKQUEUE.md). Fyrdsman the Ashbound (a Nordic berserker with a thrown, recallable axe; the owner's atlas and their own two sculpts) was added on 2026-11-11 (no credits; details in WORKQUEUE.md). Knell, the Angle Thief (dagger and buckler; the owner's Meshy model and their design PDF) was built on 2026-11-11 and 2026-11-12: sim, a 75-bone rig and every clip, on branch claude/skeletal-animation-import-4dd535, not yet committed (details in WORKQUEUE.md). Tilt is still a concept picture only.

| Character | Brief | Concept image | 3D model | Rig | Animations | In game |
|---|---|---|---|---|---|---|
| Flint | written | concept B chosen | v3: 30,791 triangles, 1K textures, 3.5 MB | Meshy auto-rig, 24 bones, plus 12 coat and scarf bones added by `tools/cloth.mjs` | 44 clips (v4): 12 more cut and re-posed from his own motion by `tools/derive.mjs`, so every move and state has its own; coat and scarf follow through | **in game** with lantern |
| Nib | the owner's model (2026-11-12, crimson hound) | owner's own model; the white mane shortened (tools/blender/trim-fur.py) and, at the owner's request, the head turned to face forward (tools/blender/turn-head.py) | v1: 40,000 triangles, 2.7 MB | 21-bone hound skeleton with leg IK, + 11 added bones (jaw, eyes, nose, ear spikes, five mane locks on springs) | 26 clips (fox clips renamed for the single tail; Swat and Sweep re-keyed for this body) | **in game** (dev copy pending) |
| Loom | art supplied | owner model 2026-11-12 (patchwork sprite) | v1: 39,999 triangles, 2.5 MB | 16-bone skeleton (two rope-leg chains, sash) + 14 added bones (eyes, patch, tuft puffs, collar petals, ember feet) | 24 hand-keyed clips; rope legs stretch 1.5x on the lashes | **in game**, faces the camera |
| Hod | owner's model (2026-11-12) | owner's own | v1: 40,000 triangles, 1K textures, 2.9 MB | custom 27-bone skeleton with leg IK, plus 27 added bones (crest leaves, 14 leaf scales, eyes, snout, belly, six claws) | 26 hand-keyed clips; tail, crest and scales follow through | **in game** (rebuilt on the owner's model; manifest height 9.2 keeps his old length) |
| Potato Sack | in WORKQUEUE.md | concept A approved (an original design) | v1: 30,898 triangles, 1K textures, 3.0 MB | custom 13-bone skeleton | 24 hand-keyed clips; tuft follows through; hops tied to the rules | **in game** |
| Sprocket | the owner's moveset document | concept A (an original design) | v1: 30,732 triangles, 1K textures, 2.9 MB | custom 24-bone skeleton: hand and foot targets, a rigid wrench aimed directly | 54 hand-keyed clips: every move and state has its own | **in game** |
| Scuttle | the owner's document for fighter 01 (numbers only) | concept A (an original design) | v1: 31,029 triangles, 1K textures, 2.4 MB | custom 11-bone skeleton, rigid tongs | 52 hand-keyed clips: every move and state has its own | **in game** |
| Chomp Chomp | the owner's design v2 | concept A from the owner's drawing | v1: 30,695 triangles, 1K textures, 2.3 MB | custom 17-bone skeleton with placed weights: hinged jaw and head top, tongue, eyes, brows, fins, feet, sprout and leaves | 62 hand-keyed clips: every attack, special, throw and state has its own; leaves follow through | **in game** |

## Meshy credits

All Meshy calls go through `tools/meshy.js`. Limits are in `assets/meshy-budget.json`; every task is recorded in `assets/meshy-ledger.jsonl` and in each character's `meshy/` folder.

| Date | Character | Task | Credits |
|---|---|---|---|
| 2026-11-09 | Flint | Concept image A (nano-banana-2, A-pose) | 6 |
| 2026-11-09 | Flint | Concept image B (nano-banana-2-1, A-pose) | 4 |
| 2026-11-09 | Flint | 3D model from concept B (meshy-7.1, 30k triangles, PBR 2K) | 30 |
| 2026-11-09 | Flint | Auto-rig (includes walk and run clips) | 5 |
| 2026-11-09 | Flint | 10 preset animations | 30 |
| 2026-11-09 | Flint | 20 more preset animations (attacks, dodges, throw, ledge) | 60 |
| 2026-11-09 | Hod, Loom, Nib | Concept images from supplied art | 12 |
| 2026-11-09 | Nib, Hod, Loom | 3D models from the approved concepts (30 each) | 90 |
| 2026-11-10 | Stage | Backdrop with the island painted out; the island alone (4 each) | 8 |
| 2026-11-10 | Stage | 3D island from the isolated picture (60k triangles, PBR 2K) | 30 |
| 2026-11-10 | Potato Sack | Concept picture | 4 |
| 2026-11-10 | Potato Sack | 3D model from the concept (30k triangles, PBR 2K) | 30 |
| 2026-11-10 | Sprocket, Brand, Tilt, Scuttle | Concept pictures (4 each) | 16 |
| 2026-11-10 | Sprocket, Scuttle | 3D models from the concepts (30 each), after the owner said to carry on | 60 |
| 2026-11-10 | Chomp Chomp | Concept picture from the owner's drawing (4) and 3D model (30), inside the owner's 40-credit spend | 34 |

Spent so far: 535 credits (Flint 135, companions 102, stage 38, Potato Sack 34, Sprocket 34, Scuttle 34, concept pictures for Brand and Tilt 8, five Furious Fowls birds 150). On 2026-11-10 the owner allowed 150 more that day (day limit 300; 298 used). The owner cleared up to 400 for the Potato Sack project on 2026-11-10; the 150-a-day limit is unchanged (148 used that day, so Brand's and Tilt's models wait for another day). The daily limit was raised to 240 for 2026-11-09 only, at the owner's request; it is 150 on other days. No credits were spent in the unattended session on the evening of 2026-11-09.

## Flint v3: what is and is not done

- Done: model, rig, 32 clips in `assets/flint/export/flint-v3.glb`; every ground attack, aerial, special, grab, throw, roll, dodge and ledge hang has its own clip, timed to the move's frame data in `assets/manifest.json`; lantern prop follows the right hand.
- Down smash and get-up attack use the low sweep in the sweep-kick clip, and the model is spun front to back through the two hits (`spin` in the manifest).
- Coat and scarf (2026-11-10): `node tools/cloth.mjs` reads `flint-v2.glb` and writes `flint-v3.glb`. The coat skirt now hangs from the hips on five two-bone chains and the scarf ends from the chest on one, instead of being pulled about by the legs; the hem no longer folds up with the calf. The front panels still mostly follow the thighs so a deep crouch does not push the legs through them. The chains are listed under `springs` in the manifest, so they trail in a run and settle. Checked as still frames in the game (run, brake, jump, down smash, forward smash, crouch, tumble): no tearing. Not watched in motion.
- Not done: refinement of anticipation and follow-through per move, effects for the specials.

## Custom rig pipeline (Nib, Hod, Loom)

- `tools/blender/rig.py` builds a skeleton from a JSON spec, weights the mesh, adds keyed clips and writes a GLB. Runs headless in Blender 5.2 in about ten seconds per character.
- Finding: Blender's automatic weighting fails directly on Meshy meshes. The script falls back to weighting a voxel copy and transferring the weights, which left no unweighted vertices.
- All three specs come from `tools/blender/companions.js` (Nib's skeleton and first clips are in `assets/nib/work/rig.base.json`). To rebuild: run that script, run `rig.py` on each mesh, then `node tools/pack.mjs assets/<name>/work/pack.json`.
- Loom shows its flat face to the camera. Its clips treat +X as forward and the game mirrors the model when it turns round (`faceCamera` in the manifest).
- Each companion has nine to eleven attack clips. A few moves still share a clip (see `assets/manifest.json`).
- Each companion has its own ledge hang, spot dodge, grab hold and being-held clips. Roll and air dodge use the curled tumble with a spin, on purpose.
- Follow-through: tails, ears and ribbons are simulated in `render3d.js` (`springs` in the manifest). It is stepped by the game clock, so freezing the game freezes it.

## Ultimate rules pass, easier combos, bird selector (2026-11-10, after `docs/audits/ultimate_fidelity_audit.md`)

The owner said to go ahead with the audit's fixes and to make combos about 15% easier than in Ultimate.

- **Combos.** Hitstun is Ultimate's (0.4 x knockback, one frame less, at least 4) times `COMBO_EASE` = 1.065 in `sim.js`. "15% easier" is measured as the follow-up window: frames the attacker is free before the target, after every fighter's usual starters at 20% and 60% (`tests/combat-audit.js`, 224 cases). Against Ultimate's hitstun exactly, the average window on starters that are plus on hit goes from 11.1 to 12.9 frames (+15 to 16%), and 148 starters are plus on hit instead of 129. A flat 15% more hitstun would have widened the window by about a third, so it was not used. Cutting long hitstun short (air dodge from 40, anything from 45) stays Ultimate's, so the extra mostly helps low and mid percent strings. `COMBO_EASE = 1` gives Ultimate's hitstun exactly.
- **Ledges and techs, now Ultimate's** (SmashWiki "Edge" and "Tech"). Ledge protection is 60 x airtime / 300 + 44 - 44 x damage / 120 frames, between 23 and 123 (before: about half of that, 8 to 54). A second grab before landing or being hit gets 0.8 of it, a third 0.5, later ones none (before: none from the second). Standing up from the ledge no longer resets the count. Hanging lets go after 6.5 s (was 4 s). The tech window is 11 frames (was 20). The first two frames of a ledge grab can still be hit (Emberfall's own rule, kept).
- **Other Ultimate values:** the airborne launch angle for "natural angle" hits is 38 degrees (was 45); the last two slots of the stale-move queue are 0.03345 and 0.025 (were the older game's 0.03575 and 0.02965), and a use that hit a shield counts 0.85 of its slot; shield pushback is (shieldstun + 1) x 0.09, at most 1.3; a broken shield comes back at 75%.
- **Bird selector (Furious Fowls Neutral B).** Fixed: the wheel stayed on screen after a hit or grab interrupted it; pointing with the stick also drifted the slingshot in the air; a stick springing back to the middle could bounce the pick to the opposite bird (a pick now needs the same slice two frames running); the pouch animation froze, then jumped to its end on release (it now draws back while held and plays the swap from where it was let go); the wheel sat over the fighter and hid it (now above the head, kept on screen). The swap is 6 frames with the bird changing halfway, as the overhaul asks (4 to 6). Checked in the game in a separate tab: wheel, pick, swap and close-on-hit.
- **Test tools.** `tests/movement.js` and the movement part of `tests/combat-audit.js` had broken when the ceiling came down to 140 (the dummy was parked above it). Both work again; movement.js also covers Sprocket and Scuttle; combat-audit covers all ten Furious Fowls forms, tries aerial starters at real spacings, and tries a down air from above the target's head. The aerials it used to report as "no hit" (Hod, Sprocket, Fowls) all hit; it was the test's placement. Nib's down-tilt "gap" is a target 2.5 behind him at the very edge of the forward hitbox, not a hole.
- **Balance after all of it** (CPU level 7, 30 matches a pairing, seeds 777 and 4242): Flint 44 and 42%, Nib 53 and 53%, Loom 40 and 42%, Hod 43 and 38%, Potato Sack 41 and 36%, Sprocket 33 and 36%, Scuttle 43 and 43%; Furious Fowls Rusty 65 and 62%, Bolt 61 and 64%, Cinder 59 and 60%, Pip 59 and 62%, Pearl 60 and 64% (inside the owner's 55 to 65%). Not retuned: Sprocket and Potato Sack sit lowest.
- **Checked:** 185 rule checks (new: wheel bounce, drift and close-on-hit; the Ultimate ledge formula; regrab decay; the 11-frame tech window; the hitstun rule), the stress test, the recovery test (every spot lands or takes the ledge), netplay identical to offline. **Not checked:** any of it in a person's hands; the balance numbers below come from CPU matches.

## Furious Fowls v3 (2026-11-10, the owner's overhaul v3 and special-moves bible, in assets/fowls/source/)

- **Slingshot form:** Neutral B is the bird selector (tap for the next bird; hold to open a five-way wheel and point). Side B fires the living bird with no flight timer (Flint bounces off a hit, Bolt has one sharp correction, Cinder dives on down, Pip flies with two doubles, Pearl glides). Up B is Catapult Cyclone: charge, aim, and the whole rig spins end over end along the aim with 2 to 5 dragging hits and a finisher by charge. Neutral air is Sling Spin: the rig turns end over end in place; both the bird end and the handle end hit. Down B is each bird's technique: Brace & Break (a counter), Skitter Step, Anvil Drop, Orbit Parade, Nest Marker. Normals per bird from the overhaul's tables.
- **Bird alone:** Flint Rally Cry / Shoulder Check / Captain's Vault; Bolt Brake & Burst / Zigzag / Flash Step; Cinder Pressure Cooker / Furnace Roll / Blast Hop; Pip Switcheroo / Trio Relay / Bird Ladder; Pearl Feather Brake / Swoop & Fold / Thermal Rise. Down B hops back into the slingshot within 1.5 widths.
- **On screen the russet bird is Flint;** internally it stays Rusty because the lamplighter is also Flint.
- **Left out on purpose:** the overhaul's wooden-ammunition Down B (the bible replaces it). Feather Brake is limited to two uses per time in the air, so it cannot stall for ever. Launch angles and knockback the guides leave open come from the first move data.
- **Engine additions:** hitboxes worked out each frame (both ends of a spinning rig, tested a third and two thirds of a frame back so nothing passes through), dragging hits that carry the target with the rig, a frontal counter, Pip doubles (the one Pip model, placed by a fixed rule), a nest only grounded attacks can break, low-profile moves.
- **Balance** (CPU level 7, two seeds of 30 matches a pairing): Flint 62/62, Bolt 63/62, Cinder 64/61, Pip 57/59, Pearl 61/61, inside the owner's 55 to 65%. The other seven fighters sit at 36 to 48% because of it.
- **Checked:** 18 rule checks of its own (172 in all, including the same inputs giving the same game), stress and recovery tests, contact sheets of the spin, doubles, nest and wheel in the game. **Not checked:** any of it by hand.

## Furious Fowls (2026-11-10)

Five birds and a living slingshot, from the owner's package (assets/fowls/source/spec.md and move_data.json) and the owner's own line-up art.

- **One fighter, two shapes.** In the slingshot (forms 0 to 4): side special fires the bird itself and control goes with it. Alone (forms 5 to 9) the bird is a smaller, lighter fighter; the empty slingshot waits where it was, cannot be hit, falls to the floor, and comes back by the nearest ledge 45 frames after being lost. Down special beside it (within 0.9 W) puts the bird back; down special in the slingshot changes bird. One damage meter and stock count; losing a stock puts the bird back in the pouch.
- **Numbers.** tools/fowls-gen.js copies every frame count, damage, angle and knockback from move_data.json into the FOWL table in sim.js, and reads the hitbox shapes from the document's text. W is 10 units, B 6.5. Speeds given in W a tick are scaled by 4.5 so a launch crosses about half the stage.
- **Names.** The document's russet bird is called Flint; the game already has a Flint, so it is Rusty here.
- **Simplified from the document:** the slingshot is one built shape that leans and squashes rather than a fully animated rig; multi-hit notes (Bolt's and Pip's three small hits) are single hits of the same total; the bird picker is next / previous rather than a five-way wheel; Pip's doubles are two extra hitboxes, not drawn birds; ammunition, eggs and blasts are plain shapes; landing-lag and auto-cancel tables are the engine's.
- **Models:** five birds from the owner's art, 30 credits each (150). One shared 10-bone skeleton and 22 clips (tools/blender/fowls.js). The slingshot is built in render3d.js, not generated.
- **Balance:** the owner asked for 55 to 65%. Full run (8,640 matches, CPU level 7): Rusty 68%, Bolt 65%, Cinder 61%, Pip 63%, Pearl 63%; the other seven fighters 36 to 45% in that run, since each plays the five birds in 5 of its 11 pairings. Rusty's launch power was trimmed once more after that run (0.95 to 0.92) and not re-measured.
- **Checked:** 8 rule checks of its own (150 in all), 80 stress matches, recovery from all six spots for each bird, a CPU match in the game with no errors. **Not checked:** anything in a person's hands, the hitbox audit, animation in motion.
- **Also fixed:** the 3D picture crashed when a shot made of several parts (Sprocket's tape roll) disappeared. That bug had been live since Sprocket was added.

## Combat audit (2026-11-10, branch combat-audit)

Measured with tests/combat-audit.js (movement timings, how near and far each attack hits, holes, frames the attacker is ahead after a starter, reach at the ledge). Hitstun (0.4 x knockback), hit freeze, launch speed and its decay already matched the reference and were left alone, as were the input thresholds (the owner's own platforms.ini values) and wavedashing.

- **Strike shapes.** A hitbox used to be one circle at the tip of the limb or tool. Now a strike whose tip is clear of the body also covers the 45% of the way back toward the body (three circles, hitCircles in sim.js); outer reach is unchanged. Found by: Sprocket's up tilt and up air could not hit someone standing beside him, and Nib's up tilt only hit behind. Moves with a weaker part near the body keep that part instead.
- **Sweeping.** Hits are also checked halfway between frames when attacker and target close by more than a hitbox's radius in one frame, and fast shots halfway along their path. A shot moving 14 a frame used to pass through an 8-wide body.
- **Combos.** The extra recovery added for CPU balance (TUNE lag) had been applied to every normal; Flint's forward tilt was 22 frames behind on hit at 20% and his down tilt 1 behind. It now applies only to smashes and dash attacks. Down throws got a set pop that barely grows (Flint +4 to +11 frames ahead at 20%). Launch power was retuned to keep balance.
- **Run turnaround.** Reversing out of a full run took 7 frames to be at 90% speed the other way. The dash back now waits for the skid to bleed the run to a quarter (about 17 frames). Jump, attack, shield and grab out of the skid are unchanged, and so is dash dancing inside a dash.
- **Ledge.** A ledge grab had its protection from the first frame; now the first two frames can be hit. A hanger's head and hands count 3 units above the lip, so every forward smash can reach one (Flint's and Nib's could not).
- **Ceiling.** Top blast zone 200 to 140 (owner's request), camera limits to match.
- **Show Hitboxes** is the start-screen switch's label; off by default, remembered, X / Y on the start screen or the B key at any time. It draws the new strike shapes.
- **Balance after all of it** (two seeds of 2,940 matches): Flint 49 and 51%, Nib 52 and 51%, Loom 49 and 49%, Hod 49 and 50%, Potato Sack 50 and 51%, Sprocket 51 and 47%, Scuttle 50 and 52%.
- **Not done:** hitboxes do not track a bone frame by frame through a swing; the shape is fixed for the active frames. Hurtboxes are still one box per fighter. Nothing here was tried by a person, and none of it is measured against the reference build itself running.

## Fighter select (2026-11-10)

- The start screen shows the roster as a row of portrait tiles (drawn with each fighter's 2D picture), with a P1 and P2 marker on the tile each player is on and a tick when they have confirmed. Each player has a cursor moved with the stick or the arrow keys: pointing at a tile shows that fighter, Attack there picks it, Special takes the pick back (and again to leave). With the cursor on the CPU card, Attack raises the level and Special lowers it (0 to 9, wrapping). Start begins once everyone has picked. While the second slot is the CPU, its grey CPU token can be dragged with the mouse (or a finger) onto a fighter's tile to choose the CPU's fighter; dropped anywhere else it goes back to the CPU card and the CPU picks at random. The choice is not saved between visits. The layout is Emberfall's own; it follows the usual portrait-grid idea, not another game's art.

## Hit sparks switch (2026-11-10)

- The start screen has a second switch under Hitboxes: Hit sparks. Off, a hit throws no sparks and no flash of light where it lands (KO hits included); damage, launch, sound and the hit freeze are unchanged. Shield button on the start screen, or the H key at any time. Remembered (stored as emberfall.hitfx), on by default.
- Found while checking it: a background check tab still receives the owner's controller, so their presses on its start screen can flip the stored hitbox switch and CPU level. Keep check tabs off the start screen, and close them quickly.

## CPU levels and tap jump (2026-11-10)

- Leaving a match (2026-11-10): while paused (Start), Special goes back to the fighter select; Start resumes. The pause screen says so.
- Training mode (2026-11-10): a switch on the start screen (point at it and press Attack, or the T key). No clock, stocks never run out, and a true-combo counter at the top right: hits landed while the target is still in hitstun or held from the hit before, with the damage they dealt; it shows the last and best combo too. Remembered between visits.
- Reset shortcut (2026-11-10, for testing): during a match, attack + special + grab pressed together (A + B + L or R on a controller; Z + X + A or S on the keyboard) puts both fighters back at their starting places with full stocks and no damage. The clock keeps running.
- CPU level 0 (2026-11-10, for testing): the CPU stands still and does nothing. Up / Down on the start screen goes down to it.
- CPU level 1 to 9, set with Up / Down on the select screen while player 2 is empty, and remembered. Level 7 is the CPU as it always played; every test and balance figure uses it. The numbers for each level are in `CPU_LV` in `sim.js`.
- Tap jump is removed (owner's request, 2026-11-10): only the jump buttons jump, never the stick. There is no switch for it.

## The owner's moveset document (2026-11-10)

Flint, Nib, Loom and Hod now follow the owner's document (`Emberfall_Fighter_Movesets.pdf`).

- **Where the numbers live.** `KIT` in `sim.js` holds every normal attack's first active frame and damage, throw and pummel damage and grab speed, exactly as listed. The specials are written out in each fighter's block with the document's frames and damage in the comment above each.
- **Movement and weight** are the document's targets relative to Flint: Nib 78 / 128 / 112 / 108, Loom 86 / 87 / 121 / 73, Hod 132 / 76 / 70 / 122 (weight / ground speed / air drift / gravity).
- **Specials.** Flint: Banked Coal (leaves a 45-frame ember), Lamp Rush, Updraft (2 H), Bellows Burst (stronger through his own ember). Nib: Quick Bolt, False Start (hold special to brake), Spring Vault (steep or diagonal), a three-hit jab. Loom: Crossbreeze (a push with no damage), Ribbon Sling (11% at the tip, 6% inside, one recoil per time in the air), Thermal (hold to keep rising). Hod: Boulder Roll (tap 7%, hold 11%, rolls about 3 H), Ram Plate (takes one strike of 8% or less on frames 13 to 19, ground only), Stone Step (1.65 H).
- **Wren.** Swap on frame 16, free on frame 33, 60 frames before the next, open to attack throughout, one special projectile alive across the three.
- **Kept different from the document, on purpose:**
  - Wren's swap still hangs in the air (the owner asked for that earlier; the document says it keeps its momentum).
  - Loom's ribbon has no dead spot at point-blank: two fighters cannot stand closer than its inner part reaches.
  - The page of third-party adaptations is not built. Emberfall's fighters stay original.
  - Sprocket is not built yet: he is a new fighter and needs a concept picture approved first.
- **Set by me where the document leaves it open:**
  - An up special's wind-up hangs in the air, so its stated height is what you get when falling. Without this Hod's 12-frame wind-up cost 20 of his 23 units.
  - Ram Plate in the air hangs through its wind-up, travels level through the charge and keeps some speed after (the document says only that it carries a short way). It is Hod's way back sideways.
  - Launch power and recovery time (`TUNE` in `sim.js`), from balance testing: Flint launches 10% softer and recovers 20% slower after an attack; Nib launches 3% harder; Loom 6% harder and 5% quicker; Hod 27% harder and 20% quicker; Potato Sack launches 13% softer and his damage scale went from 1.10 to 0.94 (retuned after his Tumble was freed up: 52 and 53%, with Flint 50 and 52, Nib 50 and 48, Loom 46 and 51, Hod 52 and 47).
- **Hod's recovery is the shortest by design.** From 25 units below the ledge with his air jump, the CPU gets him back from 80 units out; Flint from 130, Nib 150, Loom 150, Potato Sack 95. About two thirds of Hod's lost stocks are falls after a launch he could not come back from; he is knocked out at about 140% on average, the others at 152 to 176%.
- **CPU.** It holds special for Thermal and for the big stone (half the time), rolls stones only from 18 to 46 units, uses Ram Plate and the ribbon up close, and a slow drifter spends its side special off stage only while the jump and up special it has left can pay back the drop.
- **Balance** (CPU against CPU at level 7, 1,500 matches a seed, two seeds): Flint 50 and 53%, Nib 50 and 53%, Loom 54 and 50%, Hod 48 and 48%, Potato Sack 49 and 47%.
- **Checked:** 112 rule checks (22 new), the stress test, the recovery test (30 of 30), the in-game hitbox audit (282 rows; the only large flag is Crossbreeze's outer gust, which is air by design), one CPU match played in the game with no errors, Ram Plate and Ribbon Sling looked at as still frames with hitboxes shown.
- **Not checked:** any of it in a person's hands, and the new moves in motion at full speed.

## Sprocket (2026-11-10)

The forge town's handyman, a wrench-range brawler, built from the owner's moveset document. An original design.

- **Rules** (`SPROCKET` and `KIT.Sprocket` in `sim.js`): every normal's first active frame and damage, the throws, pummel and grab speed are the document's. Weight 112, ground speed 88, air drift 82, gravity 110 against Flint's 100.
- **Specials.** Tape Roll: flicked on frame 16, runs out about 39 units, curls back and ends where it was let go; 6%, one at a time. Hook Wrench: frames 16 to 19, the head 9% with a tug inward, the handle 7% pushing out. Ratchet Spin: straight up (about 1.7 H) or a diagonal chosen in the wind-up, 8% at the start, special fall after. Bench Vise: a command grab on frames 18 and 19 that goes through a shield and throws low behind for 12%; ground only, 30 frames if it misses.
- **Different from the document:** the vise reaches about 1 H from where he stands instead of 0.9 H, because the wrench is that long, and he does not slide forward during it. Launch power is 15% softer and the time after an attack 30% longer than the engine's defaults (`TUNE`), from balance testing: with the document's numbers alone he won 68%.
- **Model:** one concept picture and one 3D model (34 credits). Rigged with `tools/blender/sprocket.js` + `rig.py`, which gained three things for him: hand and foot targets for a two-legged body, a tool aimed directly whatever the arm does (`copyrot`), and rigid parts (`rigid`). The rig also now always turns the short way between keys.
- **Hitboxes** measured on the wrench's head and checked with the in-game audit (346 rows for six fighters; his worst gap is 1.7 units, on the handle parts, which sit on the shaft).
- **CPU:** rolls tape from 26 to 58 units, uses Hook Wrench up close and the vise on a held shield. It gets back from all six recovery test spots.
- **Balance** with six fighters (CPU level 7, 2,160 matches a seed, two seeds): Flint 50 and 53%, Nib 51 and 51%, Loom 53 and 49%, Hod 50 and 48%, Potato Sack 50 and 51%, Sprocket 47 and 48%.
- **Checked:** 11 rule checks of his own (127 in all), the stress test, a full CPU match in the game with no errors, two contact sheets of his poses. **Not checked:** him in a person's hands, and his animation in motion at full speed. His coat has no bones of its own, so the hem moves with his legs.

## Scuttle (2026-11-10)

A soot crab living in a coal scuttle, one claw grown into fire tongs. A low, quick skirmisher. An original design: the owner's document for fighter 01 describes an existing character, so Scuttle takes that document's frame data, damage and movement targets with his own name, look and moves.

- **Rules** (`SCUTTLE` and `KIT.Scuttle` in `sim.js`): weight 82, walk 115, run 116, dash 127, air drift 110, gravity 107 against Flint's 100; 0.75 H tall. Normals' first active frames and damage are the document's.
- **Specials.** Tongs Snatch: frames 16 to 18; on the floor it takes a standing opponent, shield or not, and flings them for 8%; in the air it is a 5% swipe. Scuttle Roll: 1.65 H along the floor or 0.9 H in the air, 10% then 6%, once per time off the ground. Steam Pop: lifts 2.15 H from frame 8 with a 7% hit, special fall after. Bucket Drop: 13% on the floor on frames 18 to 20; in the air a dive at 1.4 times fast fall that sends an airborne target straight down for 12%, and a 10% thump where it lands for anyone the dive missed.
- **Left out or simplified from the document:** the up smash's small 3% scoop before the burst; separate meteor and body parts on the down air (it has a strong and a weak part instead); knockback numbers (the engine's, scaled by `TUNE`: launches 10% softer, 20% longer after an attack). His hitboxes sit on the tongs but short of the tip, to keep the document's short reach.
- **Model:** 34 credits. Rigged with `tools/blender/scuttle.js`.
- **Balance** with seven fighters (CPU level 7, 2,940 matches a seed, two seeds): Flint 50 and 50%, Nib 50 and 55%, Loom 52 and 51%, Hod 45 and 48%, Potato Sack 52 and 48%, Sprocket 48 and 46%, Scuttle 53 and 51%. Flint's and Hod's launch power were nudged again for this (Flint 12% softer, Hod 30% harder).
- **Checked:** 11 rule checks of his own (137 in all), the stress test, the recovery test, a CPU match in the game with no errors, one contact sheet of his poses. **Not checked:** him in a person's hands, the in-game hitbox audit for him, and his animation in motion.

## Potato Sack (2026-11-10)

- **Owner's changes (later 2026-11-10):** Hot Potato (up B) bursts on frame 5. Neutral B is Spud Bomb: hold to swell, let go to burst round his body, with no cap on charge, size or damage (tapped: 8% in a 7-unit ring; each 10 frames held adds about 1.2 units and 1.5%). Neutral air is 15 frames long, so two fit in one short hop. Tumble with down held goes through a soft platform, in the air or sliding on it; without down, it lands as before.

- **Hot Potato burst (owner's numbers, later 2026-11-10):** two parts that hit once between them. The hot middle (6 across, 15%) KOs most fighters at 55 to 90% (Flint 70, the heavies later); the edge (12 across, 10%) at 105 to 130%. Both grow with the target's damage only: the sack's own damage (rage) does not add. At 70% the middle hits Flint about 20% harder than the burst throws the sack at 70%; making it a full 50% harder at every damage would KO from about 35%, so the KO percents the owner gave were kept instead. Measured standing at centre stage with no DI; good DI or a hit near the ledge changes them.

An original fighter: a living sack of forge-town potatoes. Heavy and odd to move.

- **Movement:** walks and runs in hops with a full stop between them. Cannot hold the ledge; it has to land on the stage.
- **Neutral special:** Flint's Ember Toss, unchanged.
- **Tumble (down special):** a burst along the floor, straight up, or diagonally down in the air; a short hang with no direction. From the frame after the burst (frame 7) any action cuts it short, keeping its speed, and so does a new push of the stick (to another side, or down again in the air). It never falls over: a dive that reaches the floor carries on as a slide, whatever height it started from, and there is no landing lag (owner's request, 2026-11-10). Once per time off the ground.
- **Bag It (side special):** a leaping grab that goes through shields, catches in the air, and flings.
- **Hot Potato (up special):** a blast that hurts anyone close and throws the sack upward for 12% of its own damage; it flies further the more hurt it is. Once per time off the ground.
- **Files:** rules in `SACK` (sim.js); model and clips from `tools/blender/sack.js`; hitboxes in hitboxes.js; 2D fallback drawing in render2d.js.
- **Not done:** nothing about it has been played by a person; its clips were checked as still frames and by measuring bones, not watched in motion.

## Playing while it is being worked on (2026-11-10)

- `node serve.js` (or `play.bat`) serves two views: `http://localhost:8317/` is the last finished version (the last git commit), and `http://localhost:8317/dev/` is the files as they are on disk. Half-made edits never reach the first one.
- The address always works on this PC: a shortcut in the Windows Startup folder ("Emberfall game server") starts the server quietly at sign-in through `tools/start-server.vbs`. Extra copies of the server (from `play.bat` or the editor) stand by and take over if the one serving stops. To stop it starting with Windows, delete that shortcut.
- Between matches the game shows a green note when a newer finished version exists; refreshing the page loads it. Nothing reloads by itself.
- Checks in the browser pane are done in a separate tab on `/dev/`, never in the tab the owner is playing in.
- The long test runs (`stats`, `levels`, `fuzz`, `deaths`, `kotable`) run at low priority so they do not slow a game being played.

## Controls and attacks (2026-11-10)

- Right stick: a tilt on the ground in the direction pushed, an aerial in the air. It no longer smashes.
- Smash: flick the left stick with attack, or press attack and special together (with a direction, or forward if none). Keep attack held to charge: power grows for one second, and the smash can be held back two more.
- Grab: either stick throws, held or flicked, from the 7th frame of the hold; attack pummels. A grab holds for at least 30 frames. The CPU breaks out at a human mashing pace that rises with its level.
- Flint's down special and Wren's companion swap hang in the air until they finish, once per time off the ground.
- Only the jump buttons jump.
- Start screen: Up / Down sets the CPU level, the jump button shows or hides hitboxes (also B on the keyboard, any time), − swaps A and B on a controller.

## Fighters push each other (2026-11-10)

Two fighters standing on the same ground cannot walk or run through each other. Whoever moves in is held back and shoves the other along slowly (a heavier fighter is shoved less); fighters standing inside each other slide apart; nobody standing still is pushed off the solid stage. Ways past: roll, dodge, jump, or hit them. Numbers: `jf` / `jb` in each fighter's `st` and `JOSTLE` in `sim.js`. The box sizes follow the reference build's; the push strength is a guess.

## Stage (2026-11-10)

- **Look:** the forge island from the owner's picture (`assets/stage/source/concept.webp`). The island is a Meshy model made from that picture (`assets/stage/export/stage-v1.glb`, 60,546 triangles, 4.5 MB) placed by `assets/stage/export/stage.json`; the backdrop is the same picture with the island painted out (`backdrop.jpg`). Dawn lighting, warm lights at the forge mouth and the lantern, drifting embers. To rebuild the model file: `node tools/stage.mjs assets/stage/raw/<task>/model_url.glb`.
- **Shape for play:** a flat main platform 136 wide with two soft platforms side by side (x 15 to 44 on each side, height 26) and no top platform. Everything is placed from `EDGE` (half the width) and `PLATS` in `sim.js`; the blast zones sit 155 beyond the ledges.
- **The island is solid like this** (`RIM`, `SHOULDER`, `DEPTH`, `stageHalf()` in `sim.js`): a rim 5 thick at full width, a steep shoulder of rock giving way 12 by 22 down (a wall for wall jumps and techs), then rock tapering to a point 45 down. There is no flat underside. A fighter touching any of it is moved out sideways and keeps rising, so coming up from underneath ends beside the ledge; up specials past their hit take the ledge on the way up too; a fighter thrown against the island bounces back out. The hitbox view draws this outline.
- The start screen shows the island live in 3D with the chosen fighters standing on it (the owner's stage picture without 3D). The 2D fallback view of a match (M) still draws the old dusk stage.

## Stages and Valinor (2026-11-11)

- **Stage pick:** Options on the start screen, Stage row. The choice is remembered. Online matches always play on the Forge Isle for now (only the stock count is sent between the two sides).
- **Stage table:** `STAGES` in `sim.js`. Every stage is the same island underneath (floor half-width `EDGE`, ledges, rock, blast lines); a stage sets its soft platforms and names its own file for the look. `useStage(k)` puts a stage's platforms in place (the start screen and the start of a match call it).
- **Valinor:** the owner's model (Meshy "Molten Warlord's Arena", cut from 2.5 million to 100,000 triangles in Blender, 5 MB) and the owner's backdrop picture. One soft platform over the middle (x -20 to 20, height 26); that layout was my pick, not the owner's. Files in `assets/stage-valinor/`: `export/stage.json` places the model and sets the red sky, lights, lava glow and platform colours. To rebuild the model file: `node tools/stage.mjs assets/stage-valinor/raw/valinor.glb stage-valinor`.
- **Valinor (no platforms):** a third stage in the table, the same model and look as Valinor with a bare floor (they share one stage file, so the model loads once).
- The 2D fallback view (M) draws the old dusk island on every stage, with the right platforms.
- `tests/stages.js` checks every stage: files on disk, platforms over the floor, a CPU match per fighter with no bad states.

## Movement (2026-11-10)

The movement rules now work the way the reference build's do, with Emberfall's own numbers for each fighter.

- **Where the model came from:** the reference build's fighter attribute table (`fighter_param.prc`, found under `C:\OpenSmash\mods`; read with a small parser, names from `SwitchProject\research\param-labels`). It gives every fighter the same set of movement numbers. How the engine applies them was read from the research sources on this PC and the SmashWiki jump page. Nothing from that table is copied into Emberfall; it was used for the list of parameters and the range each one covers across the roster.
- **The model** (comment block at the top of `sim.js`, numbers in each fighter's `st`):
  - Walk and run: the speed limit follows how far the stick is pushed; the push is a fixed part plus a part that grows with the stick; over the limit, or with the stick let go, the floor's grip slows the fighter.
  - Dash: a burst to dash speed one frame after the flick, then settling to run speed. A dash the other way adds to the old speed instead of replacing it.
  - Jumps are heights, not speeds. The launch speed is worked out from the height and the fighter's gravity. A full hop from the ground covers its first 55% in four frames, then rises the rest under gravity. Short hops and air jumps have no such pop.
  - Sideways speed at a jump is ground speed times a carry factor plus the stick, up to a cap. An air jump with the stick held resets sideways speed.
  - Air: speed limit and push follow the stick the same way as on the ground, with a small air brake.
  - Fast fall: a downward flick while falling drops at full fast-fall speed at once, also during an aerial.
- **What changed in play** (`tests/movement.js` measures this; before -> after for Flint): full hop 50.5 high in 72 frames of air time -> 34 high in 52; height after four frames 11.6 -> 18.7; short hop 19 -> 16.5; hop plus air jump 97.7 -> 68.5; air time with a fast fall 65 -> 36 frames; stop from a run 20 -> 17 frames. Top speeds barely moved (they were already close).

| | Flint | Nib | Loom | Hod | reference roster, middle (10th to 90th percentile) |
|---|---|---|---|---|---|
| walk speed | 1.12 | 1.3 | 0.9 | 0.85 | 1.12 (0.82 to 1.39) |
| dash burst | 1.92 | 2.2 | 1.65 | 1.62 | 1.90 (1.68 to 2.21) |
| run speed | 1.74 | 2.15 | 1.45 | 1.5 | 1.72 (1.43 to 2.2) |
| grip | 0.105 | 0.128 | 0.08 | 0.1 | 0.11 (0.085 to 0.13) |
| full hop / short hop / air jump | 34 / 16.5 / 34.5 | 35 / 15 / 36 | 30 / 13.5 / 27 x3 | 29.5 / 14.5 / 30 | 32.8 / 16 / 33.7 |
| air speed | 1.1 | 1.2 | 1.12 | 0.98 | 1.05 (0.88 to 1.24) |
| air push (fixed + stick) | 0.01 + 0.065 | 0.015 + 0.085 | 0.01 + 0.075 | 0.01 + 0.04 | 0.01 + 0.06 |
| gravity | 0.09 | 0.125 | 0.062 | 0.118 | 0.092 (0.071 to 0.13) |
| fall / fast fall | 1.55 / 2.48 | 1.82 / 2.91 | 1.12 / 1.79 | 1.78 / 2.85 | 1.6 / 2.53 |

- Flint sits at the middle of the roster (all-rounder). Nib is near the fast end on the ground and falls fast (rushdown). Loom is slow on the ground, light on gravity, with three smaller air jumps and good drift (floaty). Hod is slow with poor air control and falls hard (heavy).
- **Changed for balance:** Nib's up special was raised (4.3 to 4.55) to give back the recovery the lower jumps took away; Nib's weight 80 -> 84 and damage 0.9 -> 0.93 of the template; Loom's weight 80 -> 77; Flint's weight 92 -> 95 after the stage was narrowed. Then, once grabs held long enough to be thrown (which favoured Hod): Hod's throws weakened (damage 11/13/10/8 to 9/11/9/7, growth 66/69/90/45 to 60/62/80/42) and weights set to Flint 92, Nib 87, Loom 83, Hod 122, then Hod 119 after the underside change made recovering easier.
- **Not known, so guessed:** the file with the build's shared constants (`common.prc`) is not on disk in readable form. Three things come from it: how many frames a dash waits before its burst (set to 1 here), the extra grip while skidding out of a run (set to none), and the turn-around rules. Landing lag (2 frames, 4 after a fast fall) was left as it was.

## Rules (2026-11-09)

- **Archetypes** (`st` and the kit passed to `mk()` in `sim.js`): Flint all-rounder with a three-hit jab; Nib rushdown with fast dodges, a wall jump, a rapid jab, a quick short grab and weak set-up throws; Loom floaty zoner with three air jumps, slow fall, and a long slow ribbon grab; Hod heavy with armour on forward smash and dash attack and strong throws.
- **Rules in the game:** jab chains (press or hold), Nib's held flurry, clanks between ground attacks, attacks putting out projectiles, footstool jumps, wall techs, wall jumps (Nib), dash and pivot grabs, turnaround specials, turnaround tilt or smash out of a run, angled forward tilts, hitlag nudges, shield tilt and shield poke, ledge protection by air time and damage, slower ledge options above 100%, brief intangibility on Flint's and Hod's up specials, smaller hurtbox when crouching or lying down, and a lethal-hit effect with slow motion on the last stock.
- **Kill power** is set from `tests/kotable.js` (KO percent of every hit, centre and edge). Against a mid-weight with no DI: forward smash KOs at about 99% mid-stage for Flint and Loom, 112% Nib, 67% Hod (about 25 lower at the edge); Hod's back throw at about 147% mid-stage, 107% at the edge.

## How things are checked

| Tool | What it does | Result on 2026-11-09 |
|---|---|---|
| `npm test` | six seeded CPU matches looking for broken states, then `tests/rules.js`, then a 20-match `tests/fuzz.js` | passes |
| `tests/rules.js` | 90 scripted checks of single rules with exact inputs, including the movement rules from platforms.ini, the match clock and (2026-11-10) each fighter's jump heights, full-hop pop, fast fall and ground speeds, and fighters pushing each other | all pass |
| `tests/movement.js` | measures every fighter's speeds, stopping distance, jump heights and air times in the running rules; `EMBERFALL_SIM=<file>` measures another copy of the rules | see Movement |
| `tests/fuzz.js` | both fighters driven by random sticks and buttons; looks for crashes, broken numbers, impossible or stuck states | about 880,000 frames of random against random and 730,000 with the CPU on one side in a quarter of the matches, clean |
| `tests/stats.js` | CPU-versus-CPU balance per fighter: wins, damage, KO percent, where stocks are lost, who beats whom | with all five fighters (2026-11-10, latest), over two seeds of 1,500 matches each: Flint 48 to 50%, Nib 51 to 55%, Loom 48 to 50%, Hod 49 to 51%, Potato Sack 48 to 50%. Potato Sack's damage is touchy: 1.12 of the template gave 53 to 54%, 1.07 gave 41 to 44%, 1.10 gave this |
| `tests/levels.js` | each CPU level against level 7, same fighter on both sides | wins for levels 1 to 9 (before the last weight changes): 0, 0, 0, 3, 15, 30, 53, 63, 83% |
| `tests/kotable.js` | KO percent of every hit | see Rules |
| `tests/recovery.js` | CPU recovery from six spots off stage per form | 24 of 24 get back (also after the movement change) |
| `tests/deaths.js` | traces of stocks lost without being in hitstun | found three CPU mistakes on 2026-11-09 (a ledge regrab loop, a tech press that became an air dodge, recovering out through the top), all fixed; what remains is long launches at high percent |
| `tools/audit.js` (in the game) | distance from each hitbox to the nearest limb tip while the attack is active, measured through the real renderer | 178 checks (89 hitboxes, facing right and left); only pivot grabs are over 3 units (3.2 to 3.5), by design |

## Not checked by anyone yet

- Frame rate on the RTX 2060. The browser pane used for checks runs on the Intel chip.
- Anything on a real controller: button layout, wavedash, platform and shield drops, tap jump, shield tilt, rumble.
- How the game feels with a person playing. All balance numbers are CPU against CPU, and that measure is touchy: 160-match samples moved by 5 points or more between runs, and a two-point change to one fighter's weight swung a single matchup by 25 points. Only large samples over several seeds were used for the final setting.
- The new effects and clips in motion at full speed. They were inspected as still frames.
- Wavedash distance against the reference build (needs ten wavedashes logged there).

## Log

- 2026-11-09, evening (unattended, 22:12 to midnight). Queue items 1 to 6 and 8 done; item 7 (Flint's coat bones) not started. In order: kill power set from a KO table and CPU edge play; scripted rule checks; in-game hitbox audit and fixes, including Flint's spinning sweep; ledge, jab, angled tilt, tap-jump, shield tilt and poke, and run-turn mechanics; companion ledge, dodge, hold and held clips; 3D sparks, hit flash, launch trail, KO burst, embers and far islands; select-screen help; a random-input stress test; a new hit sound; CPU techs, grabs shields, and three CPU recovery mistakes fixed; balance set from 960-match samples over several seeds. No Meshy credits spent. Step-by-step notes are in `assets/WORKQUEUE.md`.

## Animation pass, the rest of the cast (2026-11-11, no Meshy)

- Flint (`node tools/derive.mjs tools/flint-clips.mjs`), Sprocket and Scuttle (`bash tools/blender/build-rig.sh sprocket|scuttle`) now have a clip for every state the game asks for (air jump, fast fall, helpless, hard landing, shield hit, heavy hit, launches, pummel, four throws, an idle variation, respawn) and no attack borrows another move's clip. Sprocket and Scuttle also have the squash-and-stretch layer (`feel`).
- Chomp Chomp: grab, down tilt and down air lunge further so the bite reaches its hitbox.
- Hitbox check: `tools/anim-review.js` ATLAS draws every attack's hitboxes over the model in the game; `tools/audit.js` measures limb tips against them. Flint, Sprocket, Scuttle and Chomp Chomp line up (left over: Scuttle's second jab reaches the hitbox facing left but stops about 2 short facing right).
- Hurtbox check (`auditHurtboxes()`, which counts props such as the slingshot as well as the model): body boxes match what is drawn within about 2 for Flint, Loom, Potato Sack, Sprocket, Scuttle, Chomp Chomp and the Furious Fowls. The Fowls' box covers the whole slingshot with the bird in it (the owner's call, 2026-11-11): 10 wide, and as tall as each bird reaches through its idle bob (Rusty 16.5, Bolt 16.5, Cinder 18.5, Pip 15.5, Pearl 17; it was 15 for all five, so the tops of Bolt, Cinder and Pearl stuck out). The empty slingshot left behind by Side B stays not hittable, as overhaul-v3 says. Not changed: Hod's box is about 10 narrower than his model and Nib's about 6 (Wren's companions, left for later).
- Sprocket's wrench (2026-11-11, the owner saw it clipping): the back half of its jaw and some of the handle had been left on his leg, and automatic weighting had given the wrench a pull on 2,434 boot, trouser and glove vertices, so swings stretched strips and black wedges between wrench and boot. The wrench now owns its whole shape and nothing else, and the faces joining it to the boot are cut (rig.py 'only', 'detach', 'skipDark'). Jab 2 is now a straight thrust (it held the wrench against his face) and the shield holds the wrench out at chest height (it sank into his coat).
- Wren's companions were left alone, as the owner asked.

### Joey and Cronky Dong on the owner's A-pose models, with the animation atlas (2026-11-11, latest; no Meshy credits)
- **Models.** The owner made two A-pose models with open hands: "Red Cap Stance" (Joey, an ordinary man with ordinary legs) and "Red Cap Titan" (Cronky Dong). These replace the sculpts below. Each is reduced to 90,000 faces by `tools/blender/titan-prep.py`. Rebuild: `SCULPTS=<folder> bash tools/blender/build-joey.sh prep`, then `bash tools/blender/build-joey.sh`.
- **Skin.** `tools/blender/farmtan.py` gives both forms a farmer's tan and sets their skin to one shared pair of tones, darker than they look in Blender because the game's lighting brightens them. Face, neck, forearms and hands are tanned; the chest, back, upper arms down to a T-shirt sleeve, and the legs are pale. Body regions come from the skeleton. Only skin-coloured texels change, so the red cap, hair and shorts keep their colours.
- **Rig.** New skeletons (`apose()` in `tools/blender/joey.js`) add finger bones (the four fingers as one chain, plus the thumb). Every clip says how closed each hand is: Cronky Dong makes fists on the ground and opens his hands to slap, clap, swat and grab; Joey's hands hang loosely curled. `rig.py` gains `spin` (a turn about a bone's own line).
- **Clips.** The first-pass clips, written for upright bodies, are re-placed on the new bodies by `retarget()`. Cronky Dong's moves were checked against the owner's animation atlas. These are remade to match it: jab 2 as a rising uppercut, the forward tilt as an open-hand swat, a one-hand grab and an open-hand pummel slap, one-arm up and down throws, a cargo up throw finishing high and apart, the cargo down throw as a bear hug, The Entire Gym's charge as a windmill round the shoulder, the down air as a one-foot stamp, a new get-up attack (rising off his back, clapping in front and behind), a new ledge attack (haul up and forearm club) and an idle with a fist into the palm and a shoulder roll. Contact times are unchanged; the move list needed no change. The sculpt-era remakes are retired with the sculpts.
- Checked with Blender pictures, in game (skin under the game's lighting) and with the test suites. Not played by hand.
- **Later the same day: legs and plates.** Cronky Dong's legs are 30% shorter between the ankles and the shorts (`titan-prep.py --legs 0.1,0.72,0.7`, 0.19 m), an ape's proportions, so his stance squats less. His manifest height is 24.4, so he stays the same size on screen. Both forms had bowed legs; the fix: feet are now placed out from the hips by the old body's spacing rather than the A-pose's spread, and Cronky Dong's knees sit ahead of the hip-to-ankle line so they bend forward. Moves re-checked against the atlas's picture plates and remade: forward tilt (arm wound back behind him first), down tilt (flat, free arm back), forward smash (arms spread back, then a low lunging clap far in front), up smash (palms down by the floor, then a bent-arm clap just over the cap, then arms open), down smash (both fists together overhead, then slammed wide front and back), the punch and the headbutt (free arms thrown back), grab (one hand reaches, the other lifts behind), the ground spin (ends with the arms raised) and the ground Hand Slap (the free arm straight up).

### Joey's human form: the owner's red-cap sculpt (2026-11-11, later still; no Meshy credits; replaced by the A-pose section above)
- **Model.** Human Joey is now the owner's red-cap sculpt (`Meshy_AI_Red_Cap_Reflection_20261111_texture.blend`): an ordinary upright man in a red cap and shorts, a phone in his left hand, cut off at the shorts. `tools/blender/titan-prep.py --lift 0.8` raises it and stands it on stick-figure legs coming out of the shorts (`assets/joey/source/stick-legs-redcap.json`). Cronky Dong is unchanged. The muscled "human form" sculpt is no longer built (its skeleton and remade clips stay in `joey.js` as `humanT`).
- **Rig.** Upright, so the original upright Joey's clips are rebased onto it (`humanN` in `joey.js`), scaled to the sculpt's longer arms; the phone hand's targets are measured from where it would hang. The shorts move with the hips alone and each stick stroke with its own bone alone; his right arm, welded to his side and the shorts in the sculpt, is cut free (`rig.py` rigid boxes with the new `skipGrey` colour test and `detach`).
- **Select screen.** Subtitle "just a regular guy"; the screen shows this same form, so nothing there hints at the change.
- Checked on Blender stills and in a match (select screen, a forward smash, the transformation). Not played by hand.

### Joey and Cronky Dong on the owner's own sculpts (2026-11-11, later; no Meshy credits; replaced by the section above)
- **Models.** Both forms now use the Meshy sculpts the owner made and sent as .blend files ("human form", "idle animation", "running animation"; the last is a pose reference only). `tools/blender/titan-prep.py` reduces each from 1 to 2 million faces to 60,000, removes the floor cracks round the human form's fists (by their grey colour) and stands it on the floor. The human form gets stick-figure legs drawn in below the shorts: thin dark strokes with round joints (`assets/joey/source/stick-legs.json`). Skin: the owner's own textures; the human form is brought to Cronky Dong's tone (`tools/skintone.mjs`, new `SKIN_LOOSE` mode). The heads and faces are the sculpts' own; the old head swap is no longer used. Rebuild: `SCULPTS=<folder> bash tools/blender/build-joey.sh prep`, then `bash tools/blender/build-joey.sh`.
- **Rig.** New skeletons fitted to the bent sculpts (`titan()` in `tools/blender/joey.js`, joints read off `tools/blender/gridview.py` pictures). Heat weighting finds no solution on the stick-legged mesh, so `tools/blender/rig.py` has a new last resort: weights by distance to the bones.
- **Clips.** Every earlier clip is kept and rebased onto the new rest stance: rotations and the hips' move are taken relative to the stance it was written round, and hand and foot targets become moves from the sculpt's own fists and feet, scaled to its longer arms. Cronky Dong's torso straightens only 60% in poses written for an upright body. Remade: Cronky Dong's Run (a gallop built round the owner's running pose), Rise, Fall and FastFall (hunched, arms flung wide), and 17 attacks (both jabs, the three tilts, the three smashes, The Entire Gym's charge and punch, Cap Check, Floor Is Leg Day, grab, forward, back, up and down air), each aimed at the middle of its hitbox. Joey's Idle (heavy breathing, nervous re-planting of the stick legs), Walk (knuckle-waddle, four stick-leg steps to each fist) and Run (a cartoon scurry, six whirling steps a cycle).
- **Sizes.** Joey stays 13.5 tall and Cronky Dong 18 at rest in his knuckle stance. Joey's sculpt is about as wide as it is tall, so it is much wider than his 5.4 hurtbox. The gameplay numbers are unchanged.
- Checked in Blender, on in-game sheets (walk, run, jump, both attack atlases, `playtest-results/anim-review/*2-*.png`) and with the test suites. Not played by hand. Joey's gag attacks are the rebased first-pass clips.

### Joey and Cronky Dong (2026-11-11, no Meshy)
- **Neck join (Cronky Dong).** The old join tore the skin at the neck into flaps. `tools/blender/headswap.py` now deletes the big body's own head, draws its thick neck in to sit just inside Joey's neck (measured angle by angle), and keeps only Joey's neck below the jaw, so both cut edges are hidden inside the other surface. The face mesh is untouched.
- **Cronky Dong's movement** follows the heavyweight ape rhythm the owner asked for (the guide's reference fighter: knuckle-supported stance, quick heavy bounce in the idle, diagonal knuckle-walk, galloping run, a skid, arms flung up on the jump, a tucked forward somersault for the air jump, arms-out fall, heavy fist-first landings). The poses are drawn for this body; no reference animation was copied. New: Idle, Idle2, Walk, Run, Skid, Squat, Rise, Fall, FastFall, Helpless, AirJump, Land, LandHard, ShieldHit, HitHeavy, Launch, LaunchUp, Spike, AirDodge, Ball, Respawn, Pummel, seven throws. Feet are levelled in the squat so the toes no longer sink 11 cm into the floor.
- **Joey's TAKE FIVE** (15 s) is rebuilt as one continuous performance baked every 0.1 s: hands on knees, hands on his head, pacing with them there, "one second", the failed guard, the slump, the cap tug. Breathing runs through all of it, fast and deep at first (about 70 a minute) and slowing to about 40; the chest widens on each breath without touching the face. Plus the human states that were missing (fast fall, helpless, hard landing, shield hit, heavy hit, launches, air dodge, roll, respawn, pummel, throws).
- Checked in Blender renders, face close-ups and in-game sheets (walk, run, jump and air jump, the full 15 s). Not played by hand. Joey's attacks and Cronky Dong's attacks are the first-pass clips, unchanged.
