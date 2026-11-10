# Emberfall asset library

One folder per character. Inside each:

- `source/` reference art and the written brief
- `meshy/` one JSON per Meshy task: task ID, endpoint, settings, credits, date, verdict
- `raw/` downloads exactly as received (not committed to git)
- `work/` Blender files and scripts
- `export/` game-ready GLB files, versioned

## Status

The roster is final: Flint, and Wren's three companions Nib, Loom and Hod. No further fighters are planned.

| Character | Brief | Concept image | 3D model | Rig | Animations | In game |
|---|---|---|---|---|---|---|
| Flint | written | concept B chosen | v2: 30,791 triangles, 1K textures, 3.5 MB | Meshy auto-rig, 24 bones | 32 clips; every move has its own | **in game** with lantern |
| Nib | art supplied | concept A approved (teal and brass) | v1: 31,045 triangles, 1K textures, 2.6 MB | custom 36-bone skeleton with leg IK | 26 hand-keyed clips; tails and ears follow through | **in game** |
| Loom | art supplied | concept A approved | v1: 30,047 triangles, 1K textures, 2.4 MB | custom 16-bone skeleton with two ribbon chains | 24 hand-keyed clips; ribbons follow through | **in game**, faces the camera |
| Hod | art supplied | concept A approved | v1: 30,595 triangles, 1K textures, 2.8 MB | custom 27-bone skeleton with leg IK | 26 hand-keyed clips; tail follows through | **in game** |

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

Spent so far: 237 credits (Flint 135, companions 102). The daily limit was raised to 240 for 2026-11-09 only, at the owner's request; it is 150 on other days. No credits were spent in the unattended session on the evening of 2026-11-09.

## Flint v2: what is and is not done

- Done: model, rig, 32 clips in `assets/flint/export/flint-v2.glb`; every ground attack, aerial, special, grab, throw, roll, dodge and ledge hang has its own clip, timed to the move's frame data in `assets/manifest.json`; lantern prop follows the right hand.
- Down smash and get-up attack use the low sweep in the sweep-kick clip, and the model is spun front to back through the two hits (`spin` in the manifest).
- Not done: coat and scarf weight clean-up (boot clips the coat when running), refinement of anticipation and follow-through per move, effects for the specials.

## Custom rig pipeline (Nib, Hod, Loom)

- `tools/blender/rig.py` builds a skeleton from a JSON spec, weights the mesh, adds keyed clips and writes a GLB. Runs headless in Blender 5.2 in about ten seconds per character.
- Finding: Blender's automatic weighting fails directly on Meshy meshes. The script falls back to weighting a voxel copy and transferring the weights, which left no unweighted vertices.
- All three specs come from `tools/blender/companions.js` (Nib's skeleton and first clips are in `assets/nib/work/rig.base.json`). To rebuild: run that script, run `rig.py` on each mesh, then `node tools/pack.mjs assets/<name>/work/pack.json`.
- Loom shows its flat face to the camera. Its clips treat +X as forward and the game mirrors the model when it turns round (`faceCamera` in the manifest).
- Each companion has nine to eleven attack clips. A few moves still share a clip (see `assets/manifest.json`).
- Each companion has its own ledge hang, spot dodge, grab hold and being-held clips. Roll and air dodge use the curled tumble with a spin, on purpose.
- Follow-through: tails, ears and ribbons are simulated in `render3d.js` (`springs` in the manifest). It is stepped by the game clock, so freezing the game freezes it.

## Rules (2026-11-09)

- **Archetypes** (`st` and the kit passed to `mk()` in `sim.js`): Flint all-rounder with a three-hit jab; Nib rushdown with fast dodges, a wall jump, a rapid jab, a quick short grab and weak set-up throws; Loom floaty zoner with three air jumps, slow fall, and a long slow ribbon grab; Hod heavy with armour on forward smash and dash attack and strong throws.
- **Rules in the game:** jab chains (press or hold), Nib's held flurry, clanks between ground attacks, attacks putting out projectiles, footstool jumps, wall techs, wall jumps (Nib), dash and pivot grabs, turnaround specials, turnaround tilt or smash out of a run, angled forward tilts, hitlag nudges, shield tilt and shield poke, ledge protection by air time and damage, slower ledge options above 100%, tap jump as a per-controller option, brief intangibility on Flint's and Hod's up specials, smaller hurtbox when crouching or lying down, and a lethal-hit effect with slow motion on the last stock.
- **Kill power** is set from `tests/kotable.js` (KO percent of every hit, centre and edge). Against a mid-weight with no DI: forward smash KOs at about 99% mid-stage for Flint and Loom, 112% Nib, 67% Hod (about 25 lower at the edge); Hod's back throw at about 147% mid-stage, 107% at the edge.

## How things are checked

| Tool | What it does | Result on 2026-11-09 |
|---|---|---|
| `npm test` | six seeded CPU matches looking for broken states, then `tests/rules.js`, then a 20-match `tests/fuzz.js` | passes |
| `tests/rules.js` | 41 scripted checks of single rules with exact inputs, including the movement rules from platforms.ini and the match clock | all pass |
| `tests/fuzz.js` | both fighters driven by random sticks and buttons; looks for crashes, broken numbers, impossible or stuck states | about 880,000 frames of random against random and 730,000 with the CPU on one side in a quarter of the matches, clean |
| `tests/stats.js` | CPU-versus-CPU balance per form: wins, damage, KO percent, where stocks are lost, who beats whom | over three seeds of 960 matches each: Flint 49 to 54%, Nib 50 to 53%, Loom 49 to 51%, Hod 46 to 50%; average KO percent Hod 165, Flint 164, Nib 154, Loom 149 |
| `tests/kotable.js` | KO percent of every hit | see Rules |
| `tests/recovery.js` | CPU recovery from six spots off stage per form | 24 of 24 get back |
| `tests/deaths.js` | traces of stocks lost without being in hitstun | Hod loses about a quarter of its stocks to short recoveries after long launches |
| `tools/audit.js` (in the game) | distance from each hitbox to the nearest limb tip while the attack is active, measured through the real renderer | 89 hitboxes; only the two pivot grabs are over 3 units (3.2), by design |

## Not checked by anyone yet

- Frame rate on the RTX 2060. The browser pane used for checks runs on the Intel chip.
- Anything on a real controller: button layout, wavedash, platform and shield drops, tap jump, shield tilt, rumble.
- How the game feels with a person playing. All balance numbers are CPU against CPU, and that measure is touchy: 160-match samples moved by 5 points or more between runs, and a two-point change to one fighter's weight swung a single matchup by 25 points. Only large samples over several seeds were used for the final setting.
- The new effects and clips in motion at full speed. They were inspected as still frames.
- Wavedash distance against the reference build (needs ten wavedashes logged there).

## Log

- 2026-11-09, evening (unattended, 22:12 to midnight): balance pass and CPU edge play; scripted rule checks; in-game hitbox audit and fixes; ledge, jab, tilt, tap-jump, shield and run-turn mechanics; companion ledge, dodge, hold and held clips; 3D sparks, hit flash, launch trail, KO burst, embers and far islands; select-screen help. Flint's coat bones were not started. Details are in `assets/WORKQUEUE.md`.
