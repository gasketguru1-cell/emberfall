# Emberfall asset library

One folder per character. Inside each:

- `source/` reference art and the written brief
- `meshy/` one JSON per Meshy task: task ID, endpoint, settings, credits, date, verdict
- `raw/` downloads exactly as received (not committed to git)
- `work/` Blender files and scripts
- `export/` game-ready GLB files, versioned

## Status

| Character | Brief | Concept image | 3D model | Rig | Animations | In game |
|---|---|---|---|---|---|---|
| Flint | written | concept B chosen | v2: 30,791 triangles, 1K textures, 3.5 MB | Meshy auto-rig, 24 bones | 32 clips; every move has its own | **in game** with lantern |
| Wren (handler) | not started | | | | | not shown |
| Nib | art supplied | concept A made (new teal and brass palette), waiting for approval | | custom rig needed (Blender) | | grey-box capsule |
| Loom | art supplied | concept A made, waiting for approval | | custom rig needed (Blender) | | grey-box capsule |
| Hod | art supplied | concept A made, waiting for approval | | custom rig needed (Blender) | | grey-box capsule |
| Sprocket | outline only | | | | | not in roster |

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

Spent so far: 147 credits (Flint 135, companions 12). Daily cap of 150 reached for 2026-11-09.

## Flint v2: what is and is not done

- Done: model, rig, 32 clips in `assets/flint/export/flint-v2.glb`; every ground attack, aerial, special, grab, throw, roll, dodge and ledge hang has its own clip, timed to the move's frame data in `assets/manifest.json`; lantern prop follows the right hand.
- Not done: coat and scarf weight clean-up (boot clips the coat when running), refinement of anticipation and follow-through per move, effects for the specials.
