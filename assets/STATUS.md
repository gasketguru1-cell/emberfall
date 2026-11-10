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
| Flint | written | concept B chosen | v1: 30,791 triangles, 1K textures, 2.6 MB | Meshy auto-rig, 24 bones | 12 clips (10 presets + walk, run) | **in game**, proof of concept |
| Wren (handler) | not started | | | | | not shown |
| Nib | art supplied; palette to change | | | | | grey-box capsule |
| Loom | art supplied | | | | | grey-box capsule |
| Hod | art supplied | | | | | grey-box capsule |
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

Spent so far: 75 credits. Ceiling for the Flint proof of concept: 300.

## Flint v1: what is and is not done

- Done: model, rig, 12 clips packed into `assets/flint/export/flint-v1.glb` by `tools/pack.mjs`; clip-to-action mapping in `assets/manifest.json`.
- Forward smash uses its own clip (Charged_Slash) locked to the move's startup, active and recovery frames. Every other attack currently shares the jab clip.
- Not done: lantern prop, per-move attack animations, dodge and roll animations, ledge and grab poses, coat and scarf weight clean-up.
