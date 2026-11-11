#!/usr/bin/env bash
# Rebuilds Vargan the Ashbound's animated model and his thrown axe from tools/blender/vargan.js. No Meshy calls.
#   bash tools/blender/build-vargan.sh [shots.json outdir]
# The owner's sculpts (Google Drive, Ironhide) are prepared once into assets/vargan/work/{body-a,axe}.glb:
#   SCULPTS=<folder holding the two .blend files> bash tools/blender/build-vargan.sh prep
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
W=assets/vargan/work
if [ "$1" = prep ]; then
  : "${SCULPTS:?set SCULPTS to the folder holding Meshy_AI_Ironhide_Berserker and Meshy_AI_Runebreaker}"
  "$B" -b "$SCULPTS/Meshy_AI_Ironhide_Berserker_20261111_texture.blend" --python tools/blender/vargan-prep.py -- --part body --out "$W/body-a.glb" --faces 90000 | grep prep:
  "$B" -b "$SCULPTS/Meshy_AI_Runebreaker_20261111_texture.blend" --python tools/blender/vargan-prep.py -- --part axe --out "$W/axe.glb" --faces 9000 --len 2.015 | grep prep:
  exit 0
fi
node tools/blender/vargan.js
# the bind pose: the haft through the middle of the right fist (vargan.js G), held 0.286 m up from the pommel
"$B" -b --factory-startup --python tools/blender/vargan-join.py -- --body "$W/body-a.glb" --axe "$W/axe.glb" --out "$W/joined.glb" --grip -0.74,0.915,0.14 --hold 0.286 2>&1 | grep -E "join:|Error|Traceback" || true
extra=(); [ -n "$1" ] && extra=(--shots "$1" --shotdir "$2")
mkdir -p assets/vargan/export
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$W/joined.glb" --spec "$W/rig.json" --out "$W/vargan-rigged.glb" --start 0 "${extra[@]}" 2>&1 | grep -E "Error|Traceback|rig: (mesh|part|skeleton|weights|wrote|[0-9]|shots)|unweighted|line [0-9]+" || true
node tools/pack.mjs "$W/pack.json" | tail -1
node tools/pack.mjs "$W/pack-axe.json" | tail -1
