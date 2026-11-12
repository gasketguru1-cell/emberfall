#!/usr/bin/env bash
# Rebuilds Brand's swordsman rework from tools/blender/brand2.js: writes the spec (node), rigs and keys the Gearblade model
# in Blender (rig.py --start 0), and optionally renders stills of chosen clips.
#   bash tools/blender/build-brand2.sh                      build
#   bash tools/blender/build-brand2.sh shots.json outdir    build and render the clips and times listed in shots.json
#   BRAND2_MODE=test bash tools/blender/build-brand2.sh ... the skeleton with the deformation test clip
# Needs assets/brand/work/gearblade-rest.glb (brand2-prep.py, then brand2-assemble.py, from the owner's .blend in raw/gearblade).
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
node tools/blender/brand2.js $BRAND2_MODE
dir=assets/brand
extra=(); [ -n "$1" ] && extra=(--shots "$1" --shotdir "$2")
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$dir/work/gearblade-rest.glb" --spec "$dir/work/brand2-rig.json" \
  --out "$dir/work/brand2-rigged.glb" --blend "$dir/work/brand2-rigged.blend" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: |unweighted|line [0-9]+" || true
