# Front, side and top views of a GLB over a 10 cm grid (model coordinates: y up, +z forward, x his left), for reading
# joint positions off the picture when building a skeleton.
#   blender -b --factory-startup --python tools/blender/gridview.py -- --glb in.glb --out dir [--size 900] [--span 2.2] [--mid 0.9]
#   Front view: looking at his face, his left (+x) on the right of the picture. Side view: his front on the LEFT of the
#   picture (picture x = -model z). Top view: his front at the bottom. --half right|left shows one side only.
import bpy, sys, math, os
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['glb'])
sc = bpy.context.scene; out = opt['out']; os.makedirs(out, exist_ok=True); size = int(opt.get('size', 900)); span = float(opt.get('span', 2.2)); cy = float(opt.get('mid', 0.9))
sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sh.show_object_outline = True
sc.render.resolution_x = sc.render.resolution_y = size; sc.world = bpy.data.worlds.new('W'); sc.world.color = (0.85, 0.85, 0.85)
grey = bpy.data.materials.new('g'); grey.diffuse_color = (0.3, 0.3, 0.9, 1); red = bpy.data.materials.new('r'); red.diffuse_color = (0.9, 0.1, 0.1, 1)
sh.color_type = 'TEXTURE'
def line(p0, p1, mat, r=0.0025):
    d = p1 - p0; bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=r, depth=d.length, location=(p0 + p1) / 2)
    c = bpy.context.active_object; c.rotation_mode = 'QUATERNION'; c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); c.data.materials.append(mat); c.show_in_front = True; return c
if opt.get('half'):   # --half right|left: show only his right (x < 0) or left side, to tell crossing limbs apart
    import bmesh
    for o in [o for o in sc.objects if o.type == 'MESH']:
        bm = bmesh.new(); bm.from_mesh(o.data); sgn = -1 if opt['half'] == 'right' else 1
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if (o.matrix_world @ v.co).x * sgn < 0], context='VERTS'); bm.to_mesh(o.data); bm.free()
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = span; cam.data.clip_end = 100
# Blender coords: x = model x, y = -model z, z = model y
views = {'front': ((0, -10, cy), (math.radians(90), 0, 0)), 'side': ((10, 0, cy), (math.radians(90), 0, math.radians(90))), 'top': ((0, 0, 10), (0, 0, 0))}
for name, (loc, rot) in views.items():
    grid = []
    n = int(span / 0.1) + 2
    for i in range(-n, n + 1):
        m = red if i % 5 == 0 else grey; v = i * 0.1
        if name == 'front':
            grid.append(line(Vector((v, -3, cy - span)), Vector((v, -3, cy + span)), m)); grid.append(line(Vector((-span, -3, cy + v)), Vector((span, -3, cy + v)), m))
        elif name == 'side':
            grid.append(line(Vector((-3, v, cy - span)), Vector((-3, v, cy + span)), m)); grid.append(line(Vector((-3, -span, cy + v)), Vector((-3, span, cy + v)), m))
        else:
            grid.append(line(Vector((v, -span, -1)), Vector((v, span, -1)), m)); grid.append(line(Vector((-span, v, -1)), Vector((span, v, -1)), m))
    cam.location = loc; cam.rotation_euler = rot
    if name == 'side': cam.location = (10, 0, cy)
    sc.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
    for g in grid: bpy.data.objects.remove(g, do_unlink=True)
print('gridview: red lines every 0.5 m, blue every 0.1 m, centred on x 0 / z 0 and height --mid')
