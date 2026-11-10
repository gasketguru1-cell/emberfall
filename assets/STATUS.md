| Hod | art supplied | concept A approved | generated: 30,595 triangles; not yet packed | not started | | grey-box capsule |
| Loom | art supplied | concept A approved | generated: 30,047 triangles; not yet packed | not started | | grey-box capsule |
| Nib | art supplied | concept A approved (teal and brass) | v1: 31,045 triangles, 1K textures, 2.4 MB | custom 36-bone skeleton with leg IK (Blender script) | 15 hand-keyed clips, first pass | **in game** |
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
| 2026-11-09 | Nib, Hod, Loom | 3D models from the approved concepts (30 each) | 90 |

Spent so far: 237 credits (Flint 135, companions 102). The daily limit was raised to 240 for 2026-11-09 only, at the owner's request; it is 150 on other days.

## Flint v2: what is and is not done

- Done: model, rig, 32 clips in `assets/flint/export/flint-v2.glb`; every ground attack, aerial, special, grab, throw, roll, dodge and ledge hang has its own clip, timed to the move's frame data in `assets/manifest.json`; lantern prop follows the right hand.
- Not done: coat and scarf weight clean-up (boot clips the coat when running), refinement of anticipation and follow-through per move, effects for the specials.

## Custom rig pipeline (Nib, Hod, Loom)

- `tools/blender/rig.py` builds a skeleton from a JSON spec, weights the mesh, adds keyed clips and writes a GLB. Runs headless in Blender 5.2.
- Tested end to end on Flint's unrigged mesh with a made-up 11-bone skeleton (`tools/blender/test-spec.json`): result loads in the viewer with textures and a working clip.
- Finding: Blender's automatic weighting fails directly on Meshy meshes. The script falls back to weighting a voxel copy and transferring the weights, which left no unweighted vertices.
- Nib is rigged with this script from `assets/nib/work/rig.json`: joints measured from the mesh, leg reach by IK, clips keyed by hand.
- Nib's clips are a first pass: one clip each for bite, upward strike, tail sweep and pounce is shared across his moves; tails and ears have no secondary motion yet.
- Not done: skeletons and animations for Hod and Loom.
