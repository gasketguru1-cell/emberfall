# Checks Brand's cape cloth (capesim.js, assets/brand/work/brand2-cape.json) on his clips: plays each clip in Blender, reads
# where the animation puts every cape point and body capsule, runs the cloth over it in node (cape-bake.js), keys the cape
# bones to follow the cloth, and renders the frames. The game runs the same solver on the same spec (render3d.js).
#   blender -b --factory-startup --python tools/blender/cape-bake.py -- --blend assets/brand/work/brand2-rigged.blend
#       --cape assets/brand/work/brand2-cape.json --clips Run,Brake --out dir [--view side|back|three] [--size 360]
# A clip can take a ground speed (metres a frame, the way he faces) as Run:0.2, and a loop count as Run:0.2:3 (the cloth is
# warmed up on the earlier loops and only the last is drawn). Pictures go to out/<clip>_<nn>.png, one per frame.
import bpy, sys, json, math, os, subprocess, tempfile
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
bpy.ops.wm.open_mainfile(filepath=opt['blend'])
cape = json.load(open(opt['cape'], encoding='utf-8'))
rig = bpy.data.objects['Rig']; ad = rig.animation_data; scene = bpy.context.scene
conv = lambda p: Vector((p[0], -p[2], p[1]))            # model -> Blender
back = lambda v: [v[0], v[2], -v[1]]                     # Blender -> model
B = rig.data.bones
def rider(bone, p):   # a rest-pose point as an offset in its bone
    return bone, B[bone].matrix_local.inverted() @ conv(p)
pts = [rider(p['bone'], p['rest']) for p in cape['particles']]
cols = [(rider(c['bone'], c['a']), rider(c['bone'], c['b']), c['r']) for c in cape['colliders']]
W = lambda r: rig.matrix_world @ rig.pose.bones[r[0]].matrix @ r[1]

clips = []
for c in opt['clips'].split(','):
    parts = c.split(':'); clips.append((parts[0], float(parts[1]) if len(parts) > 1 else 0.0, int(parts[2]) if len(parts) > 2 else 1))
acts = {t.name: t.strips[0].action for t in ad.nla_tracks}
for t in ad.nla_tracks: t.mute = True
dump = {}; lengths = {}
for name, speed, loops in clips:
    act = acts[name]; ad.action = act; n = int(round(act.frame_range[1])); lengths[name] = n
    loop = n - 1 if loops > 1 else n   # a loop's last key repeats its first
    frames = []
    for k in range(loop * (loops - 1) + n):
        f = 1 + (k % loop if loops > 1 else k); scene.frame_set(f)
        off = Vector((0, -speed * k, 0))     # he travels forward (-Y) while the clip plays in place
        frames.append({'t': [back(W(r) + off) for r in pts], 'c': [[back(W(a) + off), back(W(b) + off), r] for a, b, r in cols], 'f': f, 'off': list(off)})
    dump[name] = frames
tmp = tempfile.mkdtemp(); fin = os.path.join(tmp, 'in.json'); fout = os.path.join(tmp, 'out.json')
json.dump(dump, open(fin, 'w'))
here = os.path.dirname(os.path.abspath(__file__))
print(subprocess.run(['node', os.path.join(here, 'cape-bake.js'), opt['cape'], fin, fout], capture_output=True, text=True).stdout)
res = json.load(open(fout))

# key the cape bones to point at the cloth, parents first, on the frames that are drawn
order = cape['bones']
for name, speed, loops in clips:
    act = acts[name]; ad.action = act; n = lengths[name]; frames = dump[name]; first = len(frames) - n
    for k in range(first, len(frames)):
        f = frames[k]['f']; scene.frame_set(f); off = Vector(frames[k]['off'])
        X = res[name][k]
        for b in order:
            pb = rig.pose.bones[b['name']]; bpy.context.view_layer.update()
            M = pb.matrix.copy(); head = M.translation; cur = (M @ Vector((0, pb.bone.length, 0))) - head
            want = rig.matrix_world.inverted() @ (conv(X[b['tail']]) - off) - head
            R = cur.rotation_difference(want).to_matrix().to_4x4()
            pb.matrix = Matrix.Translation(head) @ R @ Matrix.Translation(-head) @ M
            bpy.context.view_layer.update()
            pb.keyframe_insert('rotation_quaternion', frame=f)
    print('cape-bake: keyed %s' % name)

od = opt['out']; os.makedirs(od, exist_ok=True)
view = opt.get('view', 'side'); size = int(opt.get('size', 360))
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = float(opt.get('span', 3.0)); co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co)
cy, cz = 0.95, 0.0
if view == 'back': co.location = conv([0, cy, -20]); co.rotation_euler = (math.radians(90), 0, math.radians(180))
elif view == 'three': co.location = conv([-14, cy + 3, -14]); co.rotation_euler = (math.radians(80), 0, math.radians(-135))
else: co.location = conv([-20, cy, cz]); co.rotation_euler = (math.radians(90), 0, math.radians(-90))
cam.clip_end = 100; scene.camera = co; scene.render.engine = 'BLENDER_WORKBENCH'; scene.render.resolution_x = scene.render.resolution_y = size
sh = scene.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sh.show_object_outline = True
if scene.world is None: scene.world = bpy.data.worlds.new('w')
scene.world.color = (0.9, 0.9, 0.9)
for name, speed, loops in clips:
    ad.action = acts[name]; n = lengths[name]
    for f in range(1, n + 1):
        scene.frame_set(f); scene.render.filepath = os.path.join(od, '%s_%02d.png' % (name, f - 1)); bpy.ops.render.render(write_still=True)
print('cape-bake: pictures in ' + od)
