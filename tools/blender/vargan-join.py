# Puts Vargan's axe in his right hand for the bind pose and writes both as one GLB with two mesh objects ("Body", "Axe"),
# so tools/blender/rig.py can make the axe rigid on its own bone (spec "parts").
#   blender -b --factory-startup --python tools/blender/vargan-join.py -- --body body-a.glb --axe axe.glb --out joined.glb --grip x,y,z --hold 0.22
# --grip: the middle of the right fist in model coordinates (metres, y up, +z forward, x his left); --hold: how far up the
# haft from the pommel the fist holds it. In the bind pose the haft runs straight forward (+z) through the fist, the
# blade's edge pointing down; every animation aims it from there (tools/blender/vargan.js).
import bpy, sys, math
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
bpy.ops.wm.read_factory_settings(use_empty=True)
conv = lambda p: Vector((p[0], -p[2], p[1]))
def load(path, name):
    before = set(bpy.context.scene.objects); bpy.ops.import_scene.gltf(filepath=path)
    ms = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    for o in ms:
        o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o = ms[0]; o.name = name; o.data.name = name; bpy.ops.object.select_all(action='DESELECT'); return o
body = load(opt['body'], 'Body'); axe = load(opt['axe'], 'Axe')
g = [float(v) for v in opt['grip'].split(',')]; hold = float(opt.get('hold', 0.22))
pommel = conv([g[0], g[1], g[2] - hold])
# the sculpt's haft runs along Blender +z with the blade toward Blender -y (glTF +z); turn it +90 deg about x so the haft runs
# along Blender -y (model +z, forward) and the edge along Blender -z (model -y, down)
axe.data.transform(Matrix.Translation(pommel) @ Matrix.Rotation(math.radians(90), 4, 'X')); axe.data.update()
for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_yup=True, export_apply=True)
vs = [axe.matrix_world @ v.co for v in axe.data.vertices]
print('join: axe from model z %.3f to %.3f, y %.3f to %.3f; wrote %s' % (min(-v.y for v in vs), max(-v.y for v in vs), min(v.z for v in vs), max(v.z for v in vs), opt['out']))
