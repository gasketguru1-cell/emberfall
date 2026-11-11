#!/usr/bin/env bash
# Rebuilds Sprocket's or Scuttle's animated model from its spec: writes the spec and manifest entry (node), rigs and keys the
# mesh in Blender (default timing: keys one frame late, as they were first built), packs the game-ready GLB. No Meshy calls.
#   bash tools/blender/build-rig.sh sprocket        or scuttle
# The raw mesh is git-ignored; a worktree without it uses the main checkout's copy (RAW_ROOT to point elsewhere).
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
c="$1"; [ -z "$c" ] && { echo "usage: build-rig.sh sprocket|scuttle"; exit 1; }
node "tools/blender/$c.js" | tail -1
dir="assets/$c"; raw="$dir/raw"; [ -d "$raw" ] || raw="${RAW_ROOT:-$(git worktree list | head -1 | cut -d' ' -f1)}/$dir/raw"
mesh=$(ls -S "$raw"/*/model_url.glb | head -1)
"$B" -b --factory-startup --python tools/blender/rig.py -- --mesh "$mesh" --spec "$dir/work/rig.json" --out "$dir/work/$c-rigged.glb" --blend "$(cygpath -w "$PWD/$dir/work/$c-anim.blend")" 2>&1 | grep -E "Error|Traceback|rig: wrote|unweighted|line [0-9]" || true
node tools/pack.mjs "$dir/work/pack.json" | tail -1
