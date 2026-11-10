# Emberfall asset library

One folder per character. Inside each:

- `source/` reference art and the written brief
- `meshy/` one JSON per Meshy task: task ID, endpoint, settings, credits, date, verdict
- `raw/` downloads exactly as received (not committed to git)
- `work/` Blender files and scripts
- `export/` game-ready GLB files, versioned

## Status

The roster: Flint, Wren's three companions Nib, Loom and Hod, and (added 2026-11-10 at the owner's request) Potato Sack, Sprocket and Scuttle. Two more are on the way: Brand and Tilt (concept pictures only).

| Character | Brief | Concept image | 3D model | Rig | Animations | In game |
|---|---|---|---|---|---|---|
| Flint | written | concept B chosen | v3: 30,791 triangles, 1K textures, 3.5 MB | Meshy auto-rig, 24 bones, plus 12 coat and scarf bones added by `tools/cloth.mjs` | 32 clips; every move has its own; coat and scarf follow through | **in game** with lantern |
| Nib | art supplied | concept A approved (teal and brass) | v1: 31,045 triangles, 1K textures, 2.6 MB | custom 36-bone skeleton with leg IK | 26 hand-keyed clips; tails and ears follow through | **in game** |
| Loom | art supplied | concept A approved | v1: 30,047 triangles, 1K textures, 2.4 MB | custom 16-bone skeleton with two ribbon chains | 24 hand-keyed clips; ribbons follow through | **in game**, faces the camera |
| Hod | art supplied | concept A approved | v1: 30,595 triangles, 1K textures, 2.8 MB | custom 27-bone skeleton with leg IK | 26 hand-keyed clips; tail follows through | **in game** |
| Potato Sack | in WORKQUEUE.md | concept A approved (an original design) | v1: 30,898 triangles, 1K textures, 3.0 MB | custom 13-bone skeleton | 24 hand-keyed clips; tuft follows through; hops tied to the rules | **in game** |
| Sprocket | the owner's moveset document | concept A (an original design) | v1: 30,732 triangles, 1K textures, 2.9 MB | custom 24-bone skeleton: hand and foot targets, a rigid wrench aimed directly | 34 hand-keyed clips | **in game** |
| Scuttle | the owner's document for fighter 01 (numbers only) | concept A (an original design) | v1: 31,029 triangles, 1K textures, 2.4 MB | custom 11-bone skeleton, rigid tongs | 25 hand-keyed clips | **in game** |

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

Spent so far: 385 credits (Flint 135, companions 102, stage 38, Potato Sack 34, Sprocket 34, Scuttle 34, concept pictures for Brand and Tilt 8). The owner cleared up to 400 for the Potato Sack project on 2026-11-10; the 150-a-day limit is unchanged (148 used that day, so Brand's and Tilt's models wait for another day). The daily limit was raised to 240 for 2026-11-09 only, at the owner's request; it is 150 on other days. No credits were spent in the unattended session on the evening of 2026-11-09.

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

## Hit sparks switch (2026-11-10)

- The start screen has a second switch under Hitboxes: Hit sparks. Off, a hit throws no sparks and no flash of light where it lands (KO hits included); damage, launch, sound and the hit freeze are unchanged. Shield button on the start screen, or the H key at any time. Remembered (), on by default.
- Found while checking it: a background check tab still receives the owner's controller, so their presses on its start screen can flip the stored hitbox switch and CPU level. Keep check tabs off the start screen, and close them quickly.

## CPU levels and tap jump (2026-11-10)

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
