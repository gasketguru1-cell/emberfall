# Prepares the owner's Crimson Gearblade model for rigging: cuts the sword (which stands beside the body in the
# source) into its own object, stands the body on the floor at the origin facing -Y (the game's forward), reduces both to
# game size, and saves a work .blend plus a GLB of each.
#   blender -b <source.blend> --python tools/blender/brand2-prep.py -- --out assets/brand/work/gearblade [--body 60000] [--sword 3000]
import bpy, bmesh, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
out = opt['out']; body_tris = int(opt.get('body', 60000)); sword_tris = int(opt.get('sword', 3000))

src = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = src
for o in bpy.context.scene.objects: o.select_set(o is src)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---- the sword: everything connected to vertices left of the body's right hand ----
bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(src.data)
for v in bm.verts: v.select = v.co.x < -0.6
bm.select_flush(True); bmesh.update_edit_mesh(src.data)
bpy.ops.mesh.select_linked(delimit=set())
sel = [v.co.copy() for v in bm.verts if v.select]
lo = Vector([min(c[i] for c in sel) for i in range(3)]); hi = Vector([max(c[i] for c in sel) for i in range(3)])
print('prep: sword part %d verts, x %.3f..%.3f, y %.3f..%.3f, z %.3f..%.3f' % (len(sel), lo.x, hi.x, lo.y, hi.y, lo.z, hi.z))
if hi.x > -0.5: raise SystemExit('prep: the sword selection reaches the body (x up to %.3f); stopping' % hi.x)
bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
sword = [o for o in bpy.context.selected_objects if o is not src][0]
src.name = 'Body'; sword.name = 'Sword'

def bounds(o):
    cs = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector([min(c[i] for c in cs) for i in range(3)]), Vector([max(c[i] for c in cs) for i in range(3)])

# ---- stand the body at the origin, feet on the floor; the sword moves with it ----
blo, bhi = bounds(src)
shift = Vector((-(blo.x + bhi.x) / 2, -(blo.y + bhi.y) / 2, -blo.z))
for o in (src, sword):
    o.data.transform(__import__('mathutils').Matrix.Translation(shift)); o.data.update()
blo, bhi = bounds(src); slo, shi = bounds(sword)
print('prep: body %.3f wide, %.3f deep, %.3f tall; sword %.3f long' % (bhi.x - blo.x, bhi.y - blo.y, bhi.z - blo.z, shi.z - slo.z))

# ---- reduce ----
def reduce(o, target):
    n = len(o.data.polygons)
    if n <= target: return
    m = o.modifiers.new('reduce', 'DECIMATE'); m.ratio = target / n; m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.scene.objects: x.select_set(x is o)
    bpy.ops.object.modifier_apply(modifier=m.name)
    print('prep: %s %d -> %d faces' % (o.name, n, len(o.data.polygons)))
reduce(src, body_tris); reduce(sword, sword_tris)

bpy.ops.wm.save_as_mainfile(filepath=out + '.blend', compress=True)
for o, tag in ((src, 'body'), (sword, 'sword')):
    for x in bpy.context.scene.objects: x.select_set(x is o)
    bpy.ops.export_scene.gltf(filepath='%s-%s.glb' % (out, tag), use_selection=True, export_format='GLB')
print('prep: wrote', out + '.blend')
