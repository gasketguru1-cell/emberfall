# Animation import and retarget

Takes skeletal animation from outside files and turns it into clips for one of Emberfall's `rig.py` fighters (Brand to begin with). It reads FBX, BVH, glTF/GLB and `.blend` actions. The output is per-frame keys in `rig.py`'s own form, the same form `tools/blender/mocap.py` writes for Sprocket. From those keys `rig.py` builds a GLB exactly as the fighter's own build does.

The importer doesn't care where a file came from. A new source needs no code: the bone map is worked out from the skeleton's shape and then kept for reuse.

Nothing in `assets/` is changed. Putting a clip into a fighter is a separate, deliberate step (see the last section).

```bash
bash tools/blender/retarget.sh --target brand --out <work dir> <file or folder> [...]
```

Useful flags:

- `--mesh <fighter mesh.glb>` and `--shots shots.json`: render stills of the fighter.
- `--eval 1`: write per-frame measurements.
- `--maps <dir>`: keep the bone maps somewhere other than `tools/blender/retarget/maps/`.

All other options are listed in the header of `retarget.py`.

## Output (in the work dir)

| file | what |
|---|---|
| `<clip>.keys.json` | `{fps: 60, frames: [{bone: {qb, move}}]}`: rig.py keys, one per game frame |
| `<clip>.root.json` | floor travel taken out of the clip, per frame (metres, model axes), with its speed in game units per frame |
| `report.json` | per clip: source rate, key rate, frames, leg scale, bone map, IK reach, turn errors, limb angle differences, foot plants and slide, sword-tip range |
| `spec.json`, `<target>-retarget.glb` | the fighter's spec with these clips, rigged and exported by `rig.py --start 0` (skeleton on a stand-in mesh unless `--mesh`) |
| `clips.json`, `manifest-snippet.json` | clip lengths, and how the clips would be added to the fighter |

## How it works

1. **Load** (`retarget.py`). Blender's own importers read FBX, BVH (scene rate taken from the file) and glTF (read onto a 60-a-second timeline). A `.blend` is opened as a file with its scripts off. Each action, take or glTF animation becomes one clip.
2. **Map** (`rt_map.py`). Roles are found from the skeleton's shape:
   - **Hips:** the deepest bone with two legs hanging below it.
   - **Spine, chest and head:** the chain up from the hips. The chest is where the arms branch.
   - **Arms and legs:** the side chains, skipping clavicle and hip-joint stubs.
   - **Hands' pointing bone and toes:** found the same way.

   Left and right come from the names (Left/Right, L/R, `.l`, `_r`, CMU `lfemur`), or from where the toes point if the names don't say. Each way up is tried, so a file written lying down still maps. The map is saved per skeleton (a hash of bone names and parents) as `maps/<signature>.json`. Later files from the same rig reuse it, and a hand-edited map always wins.
3. **Basis and scale.** The source is turned upright and facing Brand's way: up from hips to head, left from the right thigh to the left. It is scaled by leg length, measured along the thigh and shin, so units don't matter (cm, m, BVH inches all work). Hips and feet are measured from the source *standing straight*, not from its rest pose, so a rest pose that isn't a T-pose moves nothing.
4. **Rest-pose alignment.** Working down the chain from the hips, each target bone takes its parent's alignment, then the shortest swing that points it the way the source bone points at rest. Each frame, a bone's world turn is `source turn from rest · alignment · neutral`, where *neutral* is the fighter's modelled offset (Brand's head is turned −24°, from `brand.js`'s stand pose). Twist follows the chain, so T-pose, A-pose and arms-down rests all line up. Thighs are the exception: each is lined up by its own line *and* the way its foot points, so a fighter modelled with a foot turned out (Brand's left, about 70°) turns the whole leg in at the hip rather than twisting the ankle.
5. **Brand's controls, in `rig.py`'s form:**
   - `hips`, `spine`, `chest`, `head` turns (`qb`), plus the hips' `move`.
   - The upper and lower limbs' own turns (`qb`), so the IK, which has no pole, bends elbows and knees in the source's plane.
   - `c_handL/R` placed where the source's arm angles put the wrist on Brand's arm lengths.
   - `c_footL/R` placed by one of two modes:
     - `--feet stance` (the default): the source's feet relative to its hips, scaled, keeping Brand's own wider stance and keeping the feet on the floor.
     - `--feet pose`: the source's exact leg angles.
   - Wrists and feet turned on top of what the IK does.
   - `c_sword` / `c_shield` turned to follow the hand that holds them, so the sword stays rigid in the grip. With `--props bone`, they follow the source's weapon bone instead.
6. **Foot contacts.** A foot that is low and still in the source is held in place, eased in and out over 3 frames.
7. **Root motion.** The hips' straight-line travel across the floor (start to end) is taken out, keeping the sway, because the game moves the fighter. It is written to `<clip>.root.json`. Other modes: `--root full` or `--root keep`.
8. **Curves.** The source is evaluated on its own key grid, every key and at least once a frame. Blender does the curves, rotation orders and constraints. The game's 60-a-second frames are read in between by slerp, and the clip length is kept exactly (`round(seconds × 60) + 1` frames). `--native 1` keeps the source's own rate.
9. **Measure.** The result is posed on Brand's rig, built from `rig.json` with the same IK and copy-rotation constraints `rig.py` uses, and checked: hand and foot reach, turn errors, limb angle differences, foot slide, sword rigidity, and the sword-tip path.

## Adding another fighter

```bash
"$BLENDER" -b --factory-startup --python tools/blender/retarget/make_target.py -- --spec assets/<f>/work/rig.json --name <f> --manifest <Name> --glb assets/<f>/export/<f>-v1.glb --out tools/blender/retarget/targets/<f>.json
```

The profile is read from the rig spec's IK chains (arms and legs), the chain from the hips to the chest, the head, the copy-rotation props (which hand holds each), and the base pose's head turn. Check the roles it prints before using it.

## Tests (temporary files only)

```bash
bash tests/retarget/run.sh <work dir>
node tests/retarget/load.mjs <work dir from retarget.sh --eval 1>
```

- **`run.sh`** builds three synthetic sources with a known answer:
  - Mixamo names, T-pose, centimetres, 30 fps.
  - CMU/BVH names, facing +X, 24 fps.
  - Uninformative names, A-pose, twist helpers and a weapon bone, 25 fps.

  Each has a walk (feet planted, 1.2 m of travel) and a 1-second full turn. It writes each as `.blend`, `.fbx`, `.glb` and `.bvh`, plus a mid-walk-rest FBX. `check.py` then checks: the bone map; length and frame count; source and key rate; bone directions against the truth (under 0.5° on source frames); IK reach (under 1 mm); sword rigidity; planted-foot slide (under 1 cm); root travel (within 1%); no quaternion flips; every format giving the same keys as the `.blend` (within 0.5°, 2 mm); and maps made once and then reused.
- **`load.mjs`** checks the `rig.py`-exported GLB against the production `brand-v1.glb`: every channel is on a production joint, joint rests match, samplers are LINEAR (or STEP for a constant channel), clips start at 0 with the right length and key count. Posed on the production skeleton by bone name, every bone points where the pipeline's Blender evaluation had it (within 0.5°).

These need Blender, so they are not part of `npm test`.

## Known limits

- **Twist in a source's rest pose can't be seen from its geometry.** A rest whose forearms are rolled relative to a T-pose carries that roll into the clip. Directions are unaffected. If a file has this, edit its map or use a T-pose rest.
- **Facing comes from the rest pose's hips.** An FBX whose rest is a mid-step frame faces the way the hips did then (2° off in the test). `--forward` sets the facing when there are no toes and no left/right names.
- **`--feet stance` trades exact leg angles for Brand's own stance and floor contact.** The report's `limbDirErrDeg` says by how much. `--feet pose` gives the source's angles instead.
- **Fingers, toes, and source bones with no Brand counterpart are not carried** (Brand has none). Neither are facial or morph animation.
- **Attack clips need their contact frames fitted to the hitboxes before use.** Use `tools/blade-check.js` and the `AF(...)` table in `brand.js`. Any attack that uses a retargeted clip invalidates `contact-fix.json`.

## Putting clips into the game (not done here)

There are two ways in:

1. **As a spec clip:** copy `<clip>.keys.json` into `assets/<f>/mocap/` and build the clip from it in the fighter's script, as `sprocket.js` does with `MOCAP()`.
2. **As an extra GLB:** add the exported GLB to the fighter's `pack.json` `extra` list (`pack.mjs` merges clips by bone name).

Either way, then point manifest states or attacks at the clip names, rebuild, and check in the game.
