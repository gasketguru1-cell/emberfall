#!/usr/bin/env bash
# Contact sheet of clips straight from a game-ready GLB (no .blend needed):
#   bash tools/blender/preview-glb.sh assets/flint/export/flint-v4.glb "Idle@*6,Jab2@0.3" "90 30" flint-idle
# Writes playtest-results/glb-preview/<name>-<az>.png. Env: SIZE, ZOOM, COLS; FOCUS=head (SPAN=0.5) for a close-up on a bone.
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
mkdir -p playtest-results/glb-preview
for az in ${3:-90}; do tmp="$PWD/playtest-results/glb-preview/_stills"; rm -rf "$tmp"; mkdir -p "$tmp"
  "$B" -b --factory-startup --python tools/blender/preview.py -- --glb "$(cygpath -w "$PWD/$1")" --out "$(cygpath -w "$tmp")" --shots "$2" --az "$az" --size "${SIZE:-256}" --zoom "${ZOOM:-1.9}" ${FOCUS:+--focus "$FOCUS" --span "${SPAN:-0.5}"} 2>&1 | grep -E "Error|Traceback|line [0-9]|preview:" || true
  node tools/blender/sheet.js "$tmp" "playtest-results/glb-preview/${4:-sheet}-$az.png" "${COLS:-8}"; done
