# Renders stills of a rigged character's clips straight from Blender, for checking poses without starting the game.
#   blender -b <character>-anim.blend --python tools/blender/preview.py -- --out dir --shots "Idle@0,Idle@0.6,Jab1@0.34" [--az 60] [--size 320]
#   A shot is Clip@seconds; "Clip@*8" spreads 8 shots over the clip; "rest" is the bind pose.
#   --az is the camera's angle round the character in degrees: 90 is side-on as the game shows him (facing right), 0 is from the front.
# Writes <out>/<n>_<clip>_<t>.png. tools/blender/sheet.js tiles them into one picture.
import bpy, sys, math, os
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
size = int(opt.get('size', 320)); az = math.radians(float(opt.get('az', 60))); out = opt['out']; os.makedirs(out, exist_ok=True)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE'); mesh = next(o for o in scene.objects if o.type == 'MESH')
lo = [min(v.co[i] for v in mesh.data.vertices) for i in range(3)]; hi = [max(v.co[i] for v in mesh.data.vertices) for i in range(3)]
h = hi[2] - lo[2]; mid = Vector((0, 0, lo[2] + h * 0.5))
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = h * float(opt.get('zoom', 2.3))
d = h * 6; el = math.radians(float(opt.get('el', 8)))
# the model faces -Y in Blender; az 0 looks at its face, az 90 sees it side-on with its front to the right of the picture
cam.location = mid + Vector((-math.sin(az) * math.cos(el) * d, -math.cos(az) * math.cos(el) * d, math.sin(el) * d))
cam.rotation_euler = (mid - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'BLENDER_WORKBENCH'; sh = scene.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_cavity = True
scene.render.resolution_x = size; scene.render.resolution_y = size; scene.render.film_transparent = False
scene.world = scene.world or bpy.data.worlds.new('W'); scene.world.color = (0.2, 0.2, 0.22)
scene.render.image_settings.file_format = 'PNG'
ad = rig.animation_data; ad.use_nla = False
shots = []
for s in opt['shots'].split(','):
    if s == 'rest': shots.append((None, 0)); continue
    clip, t = s.split('@'); act = bpy.data.actions[clip]; dur = (act.frame_range[1] - 1) / 30
    if t.startswith('*'): n = int(t[1:]); shots += [(clip, dur * k / max(1, n - 1)) for k in range(n)]
    else: shots.append((clip, float(t)))
for n, (clip, t) in enumerate(shots):
    if clip is None:
        ad.action = None
        for pb in rig.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)
    else:
        act = bpy.data.actions[clip]; ad.action = act
        try: ad.action_slot = act.slots[0]
        except Exception: pass
    f = t * 30 + 1; scene.frame_set(int(f), subframe=f - int(f))
    scene.render.filepath = os.path.join(out, '%03d_%s_%.2f.png' % (n, clip or 'rest', t)); bpy.ops.render.render(write_still=True)
print('preview: wrote %d stills to %s' % (len(shots), out))
