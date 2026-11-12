# Where the striking bones are on every frame of every clip of a rigged, animated scene (a .blend that build-rig.sh saves),
# in the model's metres (x his left, y up, z forward, feet at 0). For fitting attack contact windows to their hitboxes.
#   blender -b assets/sprocket/work/sprocket-anim.blend --python tools/blender/bonepaths.py -- out.json
import bpy, sys, json
out_path = sys.argv[sys.argv.index('--') + 1]
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); ad = rig.animation_data; sc = bpy.context.scene
names = [n for n in ('wrenchTip', 'handL', 'handR', 'footL', 'footR', 'head') if n in rig.pose.bones]
out = {}
for tr in ad.nla_tracks:
    for t2 in ad.nla_tracks: t2.mute = t2.name != tr.name
    s = tr.strips[0]; fr = []
    for f in range(int(s.frame_start), int(s.frame_end) + 1):
        sc.frame_set(f); row = {}; dg = bpy.context.evaluated_depsgraph_get(); dg.update(); re = rig.evaluated_get(dg)   # the evaluated pose (the original's head/tail lag behind)
        for nm in names:
            pb = re.pose.bones[nm]; p = re.matrix_world @ (pb.tail if nm == 'wrenchTip' else pb.head)
            row[nm] = [round(p.x, 3), round(p.z, 3), round(-p.y, 3)]
        fr.append(row)
    out[tr.name] = fr
json.dump(out, open(out_path, 'w'), separators=(',', ':')); print('bonepaths: %d clips -> %s' % (len(out), out_path))
