#!/usr/bin/env bash
# Rebuilds Chomp Chomp's animated model from tools/blender/chomp.js. No Meshy calls.
#   bash tools/blender/build-chomp.sh            spec, rig, pack
#   bash tools/blender/build-chomp.sh preview "Idle@*6,Jab1@0.34" ["az az"] [out name]   also renders stills to playtest-results/chomp-preview/<name>.png
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
dir=assets/chomp
node tools/blender/chomp.js $CHOMP_ARGS | tail -2
mesh=$(ls -S "$dir"/raw/*/model_url.glb | head -1)
blend="$(cygpath -w "$PWD/$dir/work/chomp-anim.blend")"
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$mesh" --spec "$dir/work/rig.json" --out "$dir/work/chomp-rigged.glb" --start 0 --blend "$blend" 2>&1 | grep -E "Error|Traceback|rig: wrote|rig: weights|rig: no base|holds|unweighted|line [0-9]" || true
if [ "$1" = preview ]; then
  for az in ${3:-60}; do tmp="$PWD/playtest-results/chomp-preview/_stills"; rm -rf "$tmp"; mkdir -p "$tmp"
    "$B" -b "$blend" --python tools/blender/preview.py -- --out "$(cygpath -w "$tmp")" --shots "$2" --az "$az" --size "${SIZE:-320}" --zoom "${ZOOM:-2.3}" 2>&1 | grep -E "Error|Traceback|line [0-9]" || true
    node tools/blender/sheet.js "$tmp" "playtest-results/chomp-preview/${4:-sheet}-$az.png" "${COLS:-6}"; done
else
  node tools/pack.mjs "$dir/work/pack.json" | tail -1
fi
