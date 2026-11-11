# Turns the owner's two Meshy sculpts for Vargan the Ashbound into game-sized GLBs (no Meshy calls; the files are on disk).
#   body:  blender -b <Ironhide_Berserker.blend> --python tools/blender/vargan-prep.py -- --part body --out body-a.glb [--faces 90000]
#   axe:   blender -b <Runebreaker.blend>        --python tools/blender/vargan-prep.py -- --part axe  --out axe.glb [--faces 9000] [--len 1.55]
# Body: faces reduced, lowest point on the floor, centred over the origin (front faces +Z in glTF, as Meshy stands it).
# Axe: faces reduced, the haft stood along +Y with the pommel at y = 0 and the head at the top, the blade's edge toward +Z
# and the haft's centre line on x = z = 0, scaled so the whole axe is --len metres long. Nothing loose is thrown away: these
# sculpts have no floor debris, and the beard's rings and the belt's buckles are small separate pieces.
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
ob = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o != ob: bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
part = opt.get('part', 'body')
n0 = len(ob.data.polygons); want = int(opt.get('faces', 90000 if part == 'body' else 9000))
if n0 > want:
    d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = want / n0; d.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
print('prep: %d -> %d faces' % (n0, len(ob.data.polygons)))
vs = ob.data.vertices
lo = Vector([min(v.co[i] for v in vs) for i in range(3)]); hi = Vector([max(v.co[i] for v in vs) for i in range(3)])
if part == 'body':
    ob.data.transform(Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))); ob.data.update(); ob.name = 'Body'
    print('prep: body %.3f wide, %.3f deep, %.3f tall' % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
else:
    # In the sculpt the axe stands on its pommel (Blender z up), the blade sticking out toward -x (the far side from the
    # back spike). The haft's centre line: the middle of the vertices in the lowest fifth (the pommel cap and wrapped grip).
    L = hi.z - lo.z; low = [v.co for v in vs if v.co.z < lo.z + L * 0.2]
    cx = sum(p.x for p in low) / len(low); cy = sum(p.y for p in low) / len(low)
    s = float(opt.get('len', 1.55)) / L
    # Blender: haft along +z, blade toward +x... glTF +Z (forward) is Blender -Y, so turn the blade from -x to -y: +90 deg about z
    M = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-cx, -cy, -lo.z)))
    ob.data.transform(M); ob.data.update(); ob.name = 'Axe'
    vs = ob.data.vertices; lo2 = Vector([min(v.co[i] for v in vs) for i in range(3)]); hi2 = Vector([max(v.co[i] for v in vs) for i in range(3)])
    print('prep: axe %.3f long; blade reaches %.3f forward, spike %.3f back; %.3f thick' % (hi2.z - lo2.z, -lo2.y, hi2.y, hi2.x - lo2.x))
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_yup=True, export_apply=True)
print('prep: wrote ' + opt['out'])
