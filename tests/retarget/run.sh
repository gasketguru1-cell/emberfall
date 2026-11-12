#!/usr/bin/env bash
# End-to-end test of the retarget pipeline on synthetic sources with a known answer (nothing from outside, nothing in
# the game changed). Everything goes to a work folder: $1, or a fresh temporary one.
#   bash tests/retarget/run.sh [workdir]
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
W="${1:-$(mktemp -d)}"; mkdir -p "$W"
PY="${PYTHON:-python}"
quiet() { grep -E "retarget:|make_samples:|Error|Traceback|line [0-9]+," || true; }
echo "work folder: $W"
"$B" -b --factory-startup --python-exit-code 1 --python tests/retarget/make_samples.py -- --out "$W/samples" 2>&1 | quiet
rm -rf "$W/run"; mkdir -p "$W/run"
for style in mixamo cmu odd; do
  for fmt in blend fbx glb bvh; do
    if [ $fmt = bvh ]; then src=("$W/samples/sample_${style}_Walk.bvh" "$W/samples/sample_${style}_Spin.bvh"); else src=("$W/samples/sample_${style}.$fmt"); fi
    "$B" -b --factory-startup --python-exit-code 1 --python tools/blender/retarget/retarget.py -- --target tools/blender/retarget/targets/brand.json \
      --out "$W/run/${style}_${fmt}" --maps "$W/run/maps" --eval 1 "${src[@]}" 2>&1 | quiet
  done
  if [ $style = mixamo ]; then   # an FBX whose rest pose is a bent walking frame
    "$B" -b --factory-startup --python-exit-code 1 --python tools/blender/retarget/retarget.py -- --target tools/blender/retarget/targets/brand.json \
      --out "$W/run/${style}_bentrest" --maps "$W/run/maps" --eval 1 "$W/samples/sample_${style}_bentrest.fbx" 2>&1 | quiet
  fi
  # the legs posed exactly as the source's (for checking leg angles), and the source's weapon bone driving the sword (odd has one)
  "$B" -b --factory-startup --python-exit-code 1 --python tools/blender/retarget/retarget.py -- --target tools/blender/retarget/targets/brand.json \
    --out "$W/run/${style}_pose" --maps "$W/run/maps" --eval 1 --feet pose --props bone "$W/samples/sample_${style}.blend" 2>&1 | quiet
done
"$PY" -I tests/retarget/check.py "$W"
