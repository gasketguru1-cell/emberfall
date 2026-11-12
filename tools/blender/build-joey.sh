#!/usr/bin/env bash
# Rebuilds Joey's two animated models from tools/blender/joey.js. Uses only meshes already on disk; no Meshy calls.
#   bash tools/blender/build-joey.sh [human|big|both] [shots.json outdir]
# Since 2026-11-11 both forms are the owner's own A-pose models ("Red Cap Stance": Joey; "Red Cap Titan": Cronky Dong),
# prepared once by tools/blender/titan-prep.py into assets/joey/work/titan/{human,big}-a.glb, then given a farmer's tan
# and game-friendly skin tones by tools/blender/farmtan.py (which reads the skeleton from the rig spec).
#   To redo the preparation from the owner's files:  SCULPTS=<folder holding the .blend files> bash tools/blender/build-joey.sh prep
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
which=${1:-both}; dir=assets/joey; T=$dir/work/titan
# the game's lighting brightens skin a good deal, so these sit darker than they look in Blender
TAN="${TAN:-138,86,58}"; PALE="${PALE:-176,130,102}"

if [ "$which" = prep ]; then
  : "${SCULPTS:?set SCULPTS to the folder holding the Red Cap Stance and Red Cap Titan .blend files}"
  "$B" -b "$SCULPTS/Meshy_AI_Red_Cap_Stance_20261111_texture.blend" --python tools/blender/titan-prep.py -- --out "$T/human-a.glb" --faces 90000 | grep prep:
  "$B" -b "$SCULPTS/Meshy_AI_Red_Cap_Titan_20261111_texture.blend" --python tools/blender/titan-prep.py -- --out "$T/big-a.glb" --faces 90000 --legs 0.1,0.72,0.7 | grep prep:   # shorter legs, an ape's proportions
  exit 0
fi
node tools/blender/joey.js
extra=(); [ -n "$2" ] && extra=(--shots "$2" --shotdir "$3")
mkdir -p "$dir/export"
for n in human big; do
  [ "$which" != "both" ] && [ "$which" != "$n" ] && continue
  "$B" -b --factory-startup --python tools/blender/farmtan.py -- --in "$T/$n-a.glb" --spec "$dir/work/rig-$n.json" --out "$T/$n-tan.glb" --tan "$TAN" --pale "$PALE" 2>&1 | grep -E "farmtan: (skin|wrote)|Error|Traceback" || true
  "$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$T/$n-tan.glb" --spec "$dir/work/rig-$n.json" --out "$dir/work/joey-$n-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: (mesh|skeleton|weights|wrote|fingersplit|[0-9])|unweighted|line [0-9]+" || true
  node tools/pack.mjs "$dir/work/pack-$n.json" | tail -1
done
