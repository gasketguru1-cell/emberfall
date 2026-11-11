#!/usr/bin/env bash
# Rebuilds Joey's two animated models from tools/blender/joey.js. Uses only meshes already on disk; no Meshy calls.
#   bash tools/blender/build-joey.sh [human|big|both] [shots.json outdir]
# Since 2026-11-11 both forms are the owner's own sculpts (the owner's .blend files), prepared once by
# tools/blender/titan-prep.py into assets/joey/work/titan/{human,big}-raw.glb (the human form with stick-figure legs drawn
# in, assets/joey/source/stick-legs.json), the human form's skin matched to Cronky Dong's (tools/skintone.mjs).
#   To redo the preparation from the sculpts:  SCULPTS=<folder holding the .blend files> bash tools/blender/build-joey.sh prep
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
which=${1:-both}; dir=assets/joey; T=$dir/work/titan

if [ "$which" = prep ]; then
  : "${SCULPTS:?set SCULPTS to the folder holding 'human form.blend' and 'idle animation.blend'}"
  "$B" -b "$SCULPTS/human form.blend" --python tools/blender/titan-prep.py -- --out "$T/human-raw.glb" --faces 60000 --cracks 0.3 --stick "$dir/source/stick-legs.json" | grep prep:
  "$B" -b "$SCULPTS/idle animation.blend" --python tools/blender/titan-prep.py -- --out "$T/big-raw.glb" --faces 60000 | grep prep:
  exit 0
fi
node tools/blender/joey.js
extra=(); [ -n "$2" ] && extra=(--shots "$2" --shotdir "$3")
mkdir -p "$dir/export"
# skin: the owner's own textures. Cronky Dong as the owner made it; the human form brought to Cronky Dong's tone, so the two
# forms read as one man (an earlier pass took both to the photo's tone, which the game's lighting washed out to white)
if [ ! -f "$T/human-tinted.glb" ] || [ ! -f "$T/big-tinted.glb" ]; then
  cp "$T/big-raw.glb" "$T/big-tinted.glb"
  node --input-type=module -e "import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import fs from 'fs';
    const d = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read('$T/big-raw.glb'); fs.writeFileSync('$T/big-skin.png', Buffer.from(d.getRoot().listMaterials()[0].getBaseColorTexture().getImage()));"
  SKIN_LOOSE=1 node tools/skintone.mjs "$T/human-raw.glb" "$T/big-skin.png" "$T/human-tinted.glb"
fi
for n in human big; do
  [ "$which" != "both" ] && [ "$which" != "$n" ] && continue
  "$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$T/$n-tinted.glb" --spec "$dir/work/rig-$n.json" --out "$dir/work/joey-$n-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: (mesh|skeleton|weights|wrote|[0-9])|unweighted|line [0-9]+" || true
  node tools/pack.mjs "$dir/work/pack-$n.json" | tail -1
done
