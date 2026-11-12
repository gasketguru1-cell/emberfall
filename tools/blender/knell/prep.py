# Readies the owner's Meshy model of Knell, The Angle Thief (first called the Emberbone Guardian), for rig.py (no Meshy calls; the file is on disk).
#   blender -b --factory-startup --python tools/blender/knell/prep.py -- --mesh <Meshy .glb> --out <prepped .glb>
#       [--faces 60000] [--weapon-faces 5000]
# The model is one textured surface in three pieces: the body (a T-pose), a sword and a shield floating beside it. This
# welds the texture seams, splits the pieces into objects named Body, Sword and Shield (rig.py's "parts"), reduces their
# faces, stands the body on the floor centred over the origin (it already faces +Z), and moves the sword into the right
# hand (grip under the palm, blade forward and a little down, edge up) and the shield onto the left forearm (strapped on
# top, face up, so it faces out to the side when the arm hangs). Positions below are model axes (metres, y up, z forward,
# x his left) in the file as Meshy wrote it, measured from cross-sections of the mesh.
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
conv = lambda p: Vector((p[0], -p[2], p[1]))                     # model -> Blender
CENTRE_X, FLOOR_Y = -0.058, -0.92                                # body centre line and sole height in the file
SWORD_GRIP = (0.685, 0.29, -0.045)                               # middle of the sword's handle (the sword stands blade up)
HAND_GRIP = (-0.83, -0.135, 0.10)                                # under the right palm
SHIELD_C, SHIELD_BACK = (0.675, -0.62, -0.12), 0.118             # the shield's centre, and how far its back sits behind it
FOREARM_TOP = (0.52, 0.15, 0.07)                                 # the top of the left bracer, mid-forearm

bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['mesh'])
ob = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o != ob: bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bm = bmesh.new(); bm.from_mesh(ob.data); n0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.to_mesh(ob.data); bm.free(); ob.data.update()
print('prep: welded %d -> %d vertices' % (n0, len(ob.data.vertices)))
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
parts = sorted((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: -len(o.data.vertices))
if len(parts) != 3: raise SystemExit('prep: expected 3 pieces (body, shield, sword), found %d' % len(parts))
def top(o): return max((o.matrix_world @ v.co).z for v in o.data.vertices)
body = parts[0]; sword, shield = sorted(parts[1:], key=top, reverse=True)   # the sword reaches higher than the shield
body.name, sword.name, shield.name = 'Body', 'Sword', 'Shield'
for o, want in ((body, int(opt.get('faces', 60000))), (sword, int(opt.get('weapon-faces', 5000))), (shield, int(opt.get('weapon-faces', 5000)))):
    f0 = len(o.data.polygons)
    if f0 > want:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = want / f0; d.use_collapse_triangulate = True; bpy.ops.object.modifier_apply(modifier='dec')
    print('prep: %s %d -> %d faces' % (o.name, f0, len(o.data.polygons)))
# model-axis rotations as Blender matrices
def model_rot(cols):   # columns: where the model's x, y and z axes go
    M = Matrix((cols[0], cols[1], cols[2])).transposed(); C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))   # model -> Blender
    return (C @ M @ C.inverted()).to_4x4()
def tilt_down(deg): # about the model's x axis, turning +z toward -y
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg)); return model_rot(((1, 0, 0), (0, c, s), (0, -s, c)))
# sword: blade (+y) forward (+z), flat (+z) to the side (+x), the curved edge (+x) up; then 12 degrees down
Rs = tilt_down(12) @ model_rot(((0, 1, 0), (0, 0, 1), (1, 0, 0)))
sword.data.transform(Matrix.Translation(conv(HAND_GRIP)) @ Rs @ Matrix.Translation(-conv(SWORD_GRIP)))
# shield: face (+z) up (+y), its top (+y) toward the shoulder (-x); its back on the bracer
Rh = model_rot(((0, 0, -1), (-1, 0, 0), (0, 1, 0)))
at = Vector(FOREARM_TOP) + Vector((0, SHIELD_BACK, 0))
shield.data.transform(Matrix.Translation(conv(at)) @ Rh @ Matrix.Translation(-conv(SHIELD_C)))
# everything: centred over the origin, soles on the floor
T = Matrix.Translation(conv((-CENTRE_X, -FLOOR_Y, 0)))
for o in (body, sword, shield): o.data.transform(T); o.data.update()
lo = Vector([min(v.co[i] for v in body.data.vertices) for i in range(3)]); hi = Vector([max(v.co[i] for v in body.data.vertices) for i in range(3)])
print('prep: body %.3f wide, %.3f deep, %.3f tall' % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', use_selection=False, export_yup=True)
print('prep: wrote ' + opt['out'])
