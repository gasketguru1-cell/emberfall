#!/usr/bin/env bash
# Animation import and retarget: any FBX / BVH / glTF / .blend animation onto one of Emberfall's rig.py fighters.
#   bash tools/blender/retarget.sh --target brand --out <dir> [--mesh <fighter mesh.glb>] [retarget options] <file or folder> [...]
# Writes into <dir> (nothing in assets/ is touched):
#   <clip>.keys.json     per-frame keys in rig.py's form (what a fighter's spec uses as a clip)
#   <clip>.root.json     the floor travel taken out of each clip (the game moves the fighter)
#   report.json          per clip: frames, rates, bone map, IK reach, turn errors, foot plants and slide, sword path
#   spec.json            the fighter's spec with these clips; <target>-retarget.glb, rigged and exported by rig.py exactly as
#                        the fighter's own build does (skeleton only, on a stand-in mesh, unless --mesh is given)
#   clips.json, manifest-snippet.json   clip lengths, and how the clips would be added to the fighter
# --shots <shots.json> also renders stills (rig.py --shots; needs --mesh to show the fighter). Every other option is passed
# to tools/blender/retarget/retarget.py (see its header): --fps --native --root --feet --plant --wrists --limbs --props
# --forward --armature --name --maps --eval.
set -e
cd "$(dirname "$0")/../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
target=brand; out=; mesh=; shots=; pass=(); inputs=()
while [ $# -gt 0 ]; do
  case "$1" in
    --target) target="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --mesh) mesh="$2"; shift 2 ;;
    --shots) shots="$2"; shift 2 ;;
    --*) pass+=("$1" "$2"); shift 2 ;;
    *) inputs+=("$1"); shift ;;
  esac
done
[ -n "$out" ] && [ ${#inputs[@]} -gt 0 ] || { sed -n '2,15p' "$0"; exit 1; }
prof="$target"; [ -f "$prof" ] || prof="tools/blender/retarget/targets/$target.json"
[ -f "$prof" ] || { echo "retarget: no target profile $prof"; exit 1; }
name=$(node -e "console.log(require(require('path').resolve(process.argv[1])).name)" "$prof"); spec=$(node -e "console.log(require(require('path').resolve(process.argv[1])).spec)" "$prof")
mkdir -p "$out"
if [ -z "$mesh" ]; then mesh="$out/_stand-in.glb"; dummy=(--dummy "$mesh"); else dummy=(); fi
show() { grep -E "retarget:|clipspec:|rig: (clip|wrote|shots)|Error|Traceback|line [0-9]+," || true; }
"$B" -b --factory-startup --python-exit-code 1 --python tools/blender/retarget/retarget.py -- --target "$prof" --out "$out" "${dummy[@]}" "${pass[@]}" "${inputs[@]}" 2>&1 | show
[ -f "$out/report.json" ] || { echo "retarget: failed"; exit 1; }
node tools/blender/retarget/clipspec.js --spec "$spec" --keys "$out" --out "$out/spec.json"
extra=(); [ -n "$shots" ] && extra=(--shots "$shots" --shotdir "$out/shots")
"$B" -b --factory-startup --python-exit-code 1 --python tools/blender/rig.py -- --mesh "$mesh" --spec "$out/spec.json" --out "$out/$name-retarget.glb" --start 0 "${extra[@]}" 2>&1 | show
[ -f "$out/$name-retarget.glb" ] && echo "retarget: done -> $out/$name-retarget.glb"
