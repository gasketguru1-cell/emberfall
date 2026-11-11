#!/usr/bin/env bash
# Rebuilds Joey's two animated models from tools/blender/joey.js. Uses only meshes already downloaded; no Meshy calls.
#   bash tools/blender/build-joey.sh [human|big|both] [shots.json outdir]
# The big body is the generated big mesh with its skin matched to the face (tools/skintone.mjs) and Joey's own head put on
# (tools/blender/headswap.py), so both forms show the same face.
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
which=${1:-both}; dir=assets/joey
HUMAN=$dir/raw/01a1c905-9931-76be-95c1-c84723575329; BIG=$dir/raw/01a1c905-a000-76d0-a8fd-8033c351c8fd
node tools/blender/joey.js
extra=(); [ -n "$2" ] && extra=(--shots "$2" --shotdir "$3")
if [ "$which" != "human" ] && [ ! -f "$dir/work/big-headswap.glb" ]; then
  node tools/skintone.mjs "$BIG/model_url.glb" "$HUMAN/texture_urls.0.base_color.png" "$dir/work/big-tinted.glb"
  "$B" -b --factory-startup --python tools/blender/headswap.py -- --head "$HUMAN/model_url.glb" --body "$dir/work/big-tinted.glb" --out "$dir/work/big-headswap.glb" --bcut 1.675 --h1 1.665 --shrink 0.72 --keep 1.55 --keephalf 0.1 --necktop 1.605 | grep headswap
fi
mkdir -p "$dir/export"
for n in human big; do
  [ "$which" != "both" ] && [ "$which" != "$n" ] && continue
  mesh=$HUMAN/model_url.glb; [ "$n" = big ] && mesh=$dir/work/big-headswap.glb
  "$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$mesh" --spec "$dir/work/rig-$n.json" --out "$dir/work/joey-$n-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: (mesh|skeleton|weights|wrote|[0-9])|unweighted|line [0-9]+" || true
  node tools/pack.mjs "$dir/work/pack-$n.json" | tail -1
done
