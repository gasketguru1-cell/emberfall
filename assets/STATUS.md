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
| Flint | written | two options made, waiting for a pick | not started | not started | not started | grey-box capsule |
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

Spent so far: 10 credits. Ceiling for the Flint proof of concept: 300.
