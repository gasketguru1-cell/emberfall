#!/usr/bin/env bash
# Rebuilds the animated models for Potato Sack and the five Furious Fowls birds from their specs: writes the specs and the
# manifest entries (node), rigs and keys each model in Blender (rig.py --start 0, so keys play at their own times), then
# packs the game-ready GLB. Uses only the meshes already downloaded under assets/<character>/raw. No Meshy calls.
#   bash tools/blender/build-anim.sh            all six
#   bash tools/blender/build-anim.sh sack pip   just those
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
node tools/blender/fowls.js > /dev/null
node tools/blender/sack.js > /dev/null
which=("$@"); [ ${#which[@]} -eq 0 ] && which=(sack rusty bolt cinder pip pearl)
for c in "${which[@]}"; do
  if [ "$c" = sack ]; then dir=assets/potato-sack; out=potato-sack-rigged.glb; else dir=assets/fowl-$c; out=$c-rigged.glb; fi
  mesh=$(ls "$dir"/raw/*/model_url.glb | head -1)
  "$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$mesh" --spec "$dir/work/rig.json" --out "$dir/work/$out" --start 0 --blend "$(cygpath -w "$PWD/$dir/work/${out%-rigged.glb}-anim.blend" 2>/dev/null || echo "$dir/work/${out%-rigged.glb}-anim.blend")" 2>&1 | grep -E "Error|Traceback|rig: wrote|rig: saved|unweighted" || true
  node tools/pack.mjs "$dir/work/pack.json" | tail -1
  node tools/addbones.mjs "$c" | head -1   # the added bones (tools/bones/<c>.mjs) on top: writes the -b GLB the game loads
done
