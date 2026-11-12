#!/usr/bin/env bash
# Rebuilds Knell, The Angle Thief, from the owner's Meshy model and tools/blender/knell/: readies the mesh (prep.py), writes the
# skeleton, the clips and the manifest entry (anim.js), rigs and keys it in Blender (rig.py --start 0), packs the game GLB.
# Uses only the model already on disk; no Meshy calls.
#   bash tools/blender/build-knell.sh                           build
#   bash tools/blender/build-knell.sh shots.json outdir         build and also render the clips and times listed in shots.json
#   KNELL_SRC=<Meshy .glb> bash tools/blender/build-knell.sh    take the raw model from somewhere else the first time
#   KNELL_BLEND=1 ...                                           also save work/knell-rigged.blend (for the joint check)
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
dir=assets/knell; mkdir -p "$dir/raw" "$dir/work" "$dir/export"
raw="$dir/raw/model.glb"
if [ ! -f "$raw" ]; then
  src="${KNELL_SRC:-$(ls "$HOME"/Downloads/Meshy_AI_Emberbone_Guardian_*_texture.glb 2>/dev/null | head -1)}"
  [ -f "$src" ] || { echo "build-knell: the raw model is not in $raw; set KNELL_SRC"; exit 1; }
  cp "$src" "$raw"
fi
if [ ! -f "$dir/work/prepped.glb" ] || [ "$raw" -nt "$dir/work/prepped.glb" ] || [ tools/blender/knell/prep.py -nt "$dir/work/prepped.glb" ]; then
  "$B" -b --factory-startup --python tools/blender/knell/prep.py -- --mesh "$raw" --out "$dir/work/prepped.glb" 2>&1 | grep -E "Error|Traceback|prep: " || true
fi
node tools/blender/knell/anim.js | grep -v "^  " || true
extra=(); [ -n "$1" ] && extra=(--shots "$1" --shotdir "$2")
[ -n "$KNELL_BLEND" ] && extra+=(--blend "$dir/work/knell-rigged.blend")
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$dir/work/prepped.glb" --spec "$dir/work/rig.json" --out "$dir/work/knell-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: |unweighted|line [0-9]+" || true
node tools/pack.mjs "$dir/work/pack.json" | tail -1
