#!/usr/bin/env bash
# Rebuilds Brand's animated model from tools/blender/brand.js: writes the spec and the manifest entry (node), rigs and keys
# the model in Blender (rig.py --start 0), then packs the game-ready GLB. Uses only the mesh already downloaded. No Meshy calls.
#   bash tools/blender/build-brand.sh                      build
#   bash tools/blender/build-brand.sh shots.json outdir    build and also render the clips and times listed in shots.json
#   BRAND_MODE=test bash tools/blender/build-brand.sh ...  the skeleton with a test clip only
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
node tools/blender/brand.js $BRAND_MODE
dir=assets/brand; mesh=$(ls "$dir"/raw/*/model_url.glb | head -1)
extra=(); [ -n "$1" ] && extra=(--shots "$1" --shotdir "$2")
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$mesh" --spec "$dir/work/rig.json" --out "$dir/work/brand-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: |unweighted|line [0-9]+" || true
mkdir -p "$dir/export"
node tools/pack.mjs "$dir/work/pack.json" | tail -1
