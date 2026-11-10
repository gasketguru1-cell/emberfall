# Builds a custom skeleton for a generated mesh, weights the mesh to it, adds keyed animation clips, and writes a GLB.
# Run headless:
#   blender -b --factory-startup --python tools/blender/rig.py -- --mesh in.glb --spec spec.json --out out.glb
#
# The spec is written in the model's own coordinates (metres, Y up, the character faces +Z):
#   "prep":  { "yaw": degrees, "translate": [x,y,z] }   turn and move the mesh first (applied in that order), so it stands at the origin facing +Z
#   "ik":    [ { "name": control bone, "bone": lower leg bone, "chain": 2, "paw": paw bone } ]   leg reach: the lower bone's tip follows the control
#   "copyrot": [ { "bone": name, "from": control bone } ]   the bone points the way its control points, whatever its parents do (a held tool aimed directly)
#   "rigid": [ { "bone": name, "box": [[x,y,z],[x,y,z]] } ]   every vertex inside the box follows that bone alone (a tool that must not bend)
#   "poses": { "<name>": { "<bone>": {...} } }   named poses a key can start from with "use"
#   "bones": [ { "name", "head": [x,y,z], "tail": [x,y,z], "parent": name or null, "connect": bool, "deform": bool } ]
#   "clips": { "<name>": { "fps": 30, "loop": bool, "keys": [ { "t": seconds, "pose": { "<bone>": { "rot": [pitch, yaw, roll], "move": [x,y,z] } } } ] } }
# "rot" is in degrees about the model's own axes (pitch = about the right axis, yaw = about up, roll = about forward),
# so a pose reads the same whichever way a bone happens to point. Bones not named in a key keep their previous value.
import bpy, sys, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
spec = json.load(open(opt['spec'], encoding='utf-8'))

conv = lambda p: Vector((p[0], -p[2], p[1]))            # model (Y up, +Z forward) -> Blender (Z up, -Y forward)
RIGHT, UP, FWD = Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=opt['mesh'])
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes: raise SystemExit('rig: no mesh in ' + opt['mesh'])
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1: bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
for o in [o for o in bpy.context.scene.objects if o.type not in ('MESH',)]: bpy.data.objects.remove(o, do_unlink=True)
for vg in list(mesh.vertex_groups): mesh.vertex_groups.remove(vg)
for m in list(mesh.modifiers): mesh.modifiers.remove(m)
prep = spec.get('prep')
if prep:
    M = Matrix.Translation(conv(prep.get('translate', [0, 0, 0]))) @ Matrix.Rotation(math.radians(prep.get('yaw', 0)), 4, UP)
    mesh.data.transform(M); mesh.data.update()
lo = [min(v.co[i] for v in mesh.data.vertices) for i in range(3)]; hi = [max(v.co[i] for v in mesh.data.vertices) for i in range(3)]
print('rig: mesh %d verts, %d faces, size %.3f x %.3f x %.3f (model x, y up, z)' % (len(mesh.data.vertices), len(mesh.data.polygons), hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]))

# ---- skeleton ----
arm = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm); bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
for b in spec['bones']:
    eb = arm.edit_bones.new(b['name']); eb.head = conv(b['head']); eb.tail = conv(b['tail'])
    if b.get('parent'): eb.parent = arm.edit_bones[b['parent']]; eb.use_connect = bool(b.get('connect', False))
bpy.ops.object.mode_set(mode='OBJECT')
for b in spec['bones']: arm.bones[b['name']].use_deform = b.get('deform', True)
print('rig: skeleton %d bones (%d deform)' % (len(arm.bones), sum(1 for b in arm.bones if b.use_deform)))

# ---- weights: automatic (heat) on the mesh itself; if that leaves gaps, weight a clean voxel copy and transfer ----
def auto_weight(target):
    bpy.ops.object.select_all(action='DESELECT'); target.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return sum(1 for v in target.data.vertices if not any(g.weight > 1e-4 for g in v.groups))

missing = auto_weight(mesh); method = 'automatic'
if missing > len(mesh.data.vertices) * 0.01:
    print('rig: automatic weights left %d vertices unweighted; using a voxel proxy' % missing)
    for vg in list(mesh.vertex_groups): mesh.vertex_groups.remove(vg)
    for m in list(mesh.modifiers): mesh.modifiers.remove(m)
    mesh.parent = None
    proxy = mesh.copy(); proxy.data = mesh.data.copy(); bpy.context.collection.objects.link(proxy)
    rm = proxy.modifiers.new('vox', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = max(hi[i] - lo[i] for i in range(3)) * 0.012
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.modifier_apply(modifier='vox')
    pm = auto_weight(proxy)
    for b in arm.bones:
        if b.use_deform and b.name not in mesh.vertex_groups: mesh.vertex_groups.new(name=b.name)
    dt = mesh.modifiers.new('xfer', 'DATA_TRANSFER'); dt.object = proxy; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.datalayout_transfer(modifier='xfer'); bpy.ops.object.modifier_apply(modifier='xfer')
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE')
    missing = sum(1 for v in mesh.data.vertices if not any(g.weight > 1e-4 for g in v.groups)); method = 'voxel proxy (proxy gaps %d)' % pm
# glTF allows four bones per vertex
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4); bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
print('rig: weights by %s; %d bones, %d groups, %d vertices unweighted' % (method, len(arm.bones), len(mesh.vertex_groups), missing))

# ---- rigid parts: vertices inside a box follow one bone only ----
bpy.ops.object.mode_set(mode='OBJECT')
for rg in spec.get('rigid', []):
    a, b = conv(rg['box'][0]), conv(rg['box'][1]); mn = [min(a[i], b[i]) for i in range(3)]; mx = [max(a[i], b[i]) for i in range(3)]
    idx = [v.index for v in mesh.data.vertices if all(mn[i] <= v.co[i] <= mx[i] for i in range(3))]
    for vg in mesh.vertex_groups: vg.remove(idx)
    mesh.vertex_groups[rg['bone']].add(idx, 1.0, 'REPLACE')
    print('rig: %d vertices rigid on %s' % (len(idx), rg['bone']))

# ---- leg reach (IK): the lower leg's tip follows a control bone; the exporter bakes the result into plain rotations ----
bpy.context.view_layer.objects.active = rig
for ik in spec.get('ik', []):
    c = rig.pose.bones[ik['bone']].constraints.new('IK'); c.target = rig; c.subtarget = ik['name']; c.chain_count = ik.get('chain', 2)
if spec.get('ik'): print('rig: %d IK chains' % len(spec['ik']))
for cr in spec.get('copyrot', []):
    c = rig.pose.bones[cr['bone']].constraints.new('COPY_ROTATION'); c.target = rig; c.subtarget = cr['from']; c.target_space = 'WORLD'; c.owner_space = 'WORLD'; c.mix_mode = 'REPLACE'
if spec.get('copyrot'): print('rig: %d aimed bones' % len(spec['copyrot']))

# ---- animation ----
def delta(rot):
    p, y, r = (math.radians(a) for a in rot)
    return (Quaternion(UP, y) @ Quaternion(RIGHT, p) @ Quaternion(FWD, r)).to_matrix()

rest = {b.name: b.matrix_local.to_3x3() for b in arm.bones}
ad = rig.animation_data_create(); scene = bpy.context.scene; last = 1
for name, clip in spec.get('clips', {}).items():
    fps = clip.get('fps', 30); scene.render.fps = fps
    act = bpy.data.actions.new(name); ad.action = act
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion(); pb.location = Vector()
    state = {}; lastq = {}
    for key in clip['keys']:
        f = round(key['t'] * fps) + 1; last = max(last, f)
        if key.get('reset'): state = {b: {} for b in state}
        if key.get('use'):
            for u in ([key['use']] if isinstance(key['use'], str) else key['use']): state.update(spec['poses'][u])
        state.update(key.get('pose', {}))
        for bname, tr in state.items():
            pb = rig.pose.bones[bname]; R = rest[bname]
            q = (R.inverted() @ delta(tr.get('rot', [0, 0, 0])) @ R).to_quaternion()
            if bname in lastq and lastq[bname].dot(q) < 0: q.negate()   # keep to the near side of the last key, so a turn goes the short way round
            lastq[bname] = q.copy(); pb.rotation_quaternion = q
            pb.location = R.inverted() @ conv(tr.get('move', [0, 0, 0]))
            pb.keyframe_insert('rotation_quaternion', frame=f); pb.keyframe_insert('location', frame=f)
    track = ad.nla_tracks.new(); track.name = name; track.strips.new(name, 1, act); ad.action = None
    print('rig: clip %s, %d keys' % (name, len(clip['keys'])))
for pb in rig.pose.bones: pb.rotation_quaternion = Quaternion(); pb.location = Vector()
scene.frame_start = 1; scene.frame_end = last

bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_frame_range=False, export_force_sampling=True, export_def_bones=True)
print('rig: wrote ' + opt['out'])
