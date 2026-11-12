# Turns the owner's slingshot sculpt into the game's Furious Fowls slingshot (assets/fowls/export/slingshot-v2.glb).
#   blender -b --factory-startup --disable-autoexec <copy of the sculpt>.blend --python tools/blender/slingshot.py -- --out assets/fowls/export/slingshot-v2.glb [--debug <folder>]
# The game's slingshot is a small puppet (render3d.js makeSling): a trunk that bends and squashes from its base, a fork that
# bends again above it, a pouch on a spring, two bands stretched fresh each frame from the fork tips to the pouch, and two
# feet that step. So the sculpt is cut into those same parts, each placed so the puppet's existing code moves it unchanged:
#   sling_trunk  around the trunk's bend point (0, 0.6, 0)        sling_fork   around the fork's bend point (0, 6, 0)
#   sling_pouch  around its own middle                            sling_band0/1  a strap from its fork tip to the pouch,
#   sling_foot0/1  where they stand (they are lifted to step)        laid along y, one unit long, centred (as the old bands were)
# and empties give the puppet its anchors: tip0/1 (fork tips, in the fork's space), seat (the pouch's middle, in the fork's
# space) and end0/1 (where each strap meets the pouch, from the pouch's middle). Index 0 is the +z side (toward the camera).
# Facing: eyes along +x in the game, fork spread along z, feet on y = 0, trunk on the vertical axis.
# Size: set by the birds, not the other way round: the pouch's seat lands at SEAT, just under where the birds ride (lift 8.4 to 8.8).
import bpy, bmesh, sys, math, os, colorsys
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(args[args.index('--out') + 1])
DEBUG = os.path.abspath(args[args.index('--debug') + 1]) if '--debug' in args else None
FACES = 16000          # target triangle count for the whole slingshot
TEX = 1024             # texture size
SEAT = 8.5             # game height of the pouch's seat above the feet
TRUNK_PIVOT, FORK_PIVOT = 0.6, 6.0   # the puppet's bend points (game heights), as in makeSling

o = next(x for x in bpy.data.objects if x.type == 'MESH')
for x in list(bpy.data.objects):
    if x is not o: bpy.data.objects.remove(x)
bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---- measure in the sculpt's own frame (z up, eyes toward -y, fork spread along x) ----
vs = [v.co for v in o.data.vertices]
z0 = min(v.z for v in vs)
low = [v for v in vs if z0 + 0.25 < v.z < z0 + 0.45]
cx = (min(v.x for v in low) + max(v.x for v in low)) / 2; cy = (min(v.y for v in low) + max(v.y for v in low)) / 2
tree = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
seat = tree.ray_cast(Vector((cx, cy, 5)), Vector((0, 0, -1)))[0].z - z0
S = SEAT / seat
print('trunk centre', round(cx, 3), round(cy, 3), 'seat above feet', round(seat, 3), '-> scale', round(S, 3))
# sculpt frame -> Blender frame that exports to the game's: eyes to +x, feet at 0, sized. (glTF maps Blender x,y,z to game x,z,-y)
M = Matrix.Scale(S, 4) @ Matrix.Rotation(math.pi / 2, 4, 'Z') @ Matrix.Translation((-cx, -cy, -z0))
game = lambda p: Vector((p.x, p.z, -p.y))     # Blender (after M) to game coordinates, for reporting only

# ---- thin it first, then sort its faces into parts ----
dec = o.modifiers.new('thin', 'DECIMATE'); dec.ratio = min(1.0, FACES / max(1, len(o.data.polygons)))
bpy.ops.object.modifier_apply(modifier=dec.name)
img = next(n.image for n in o.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE' and any('Base' in l.to_socket.name for l in n.outputs[0].links))
W, H = img.size; px = img.pixels[:]
bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table(); uv = bm.loops.layers.uv.active

def colour(f):
    u = sum((l[uv].uv for l in f.loops), Vector((0, 0))) / len(f.loops)
    x = min(W - 1, max(0, int((u.x % 1) * W))); y = min(H - 1, max(0, int((u.y % 1) * H))); i = (y * W + x) * 4
    return colorsys.rgb_to_hsv(px[i], px[i + 1], px[i + 2])
FEET_Z = z0 + 0.05 * (1.9 / 1.9)        # the little feet stand below the trunk's flat base
cls = {}
for f in bm.faces:
    c = f.calc_center_median(); h, s, v = colour(f); hd = h * 360
    if c.z < z0 + 0.05: cls[f.index] = 'foot'
    elif (hd < 16 or hd > 340) and s > 0.45 and v > 0.35: cls[f.index] = 'red'
    elif abs(c.x - cx) < 0.4 and -0.05 < c.z < 0.55 and v < 0.5: cls[f.index] = 'leather'
    elif 15 <= hd <= 50 and v >= 0.45: cls[f.index] = 'wood'
    else: cls[f.index] = 'other'
# small islands of one kind (rivets, eyes, grain lines, specks) join whatever surrounds them
def islands(kind):
    seen, out = set(), []
    for f in bm.faces:
        if cls[f.index] != kind or f.index in seen: continue
        comp, stack = [], [f]; seen.add(f.index)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen and cls[h.index] == kind: seen.add(h.index); stack.append(h)
        out.append(comp)
    return out
for _ in range(3):
    for kind in ('other', 'leather', 'red', 'wood'):
        for comp in islands(kind):
            if len(comp) > (60 if kind != 'other' else 10 ** 9): continue
            near = {}
            for g in comp:
                for e in g.edges:
                    for h in e.link_faces:
                        k = cls[h.index]
                        if k != kind: near[k] = near.get(k, 0) + 1
            if near:
                k = max(near, key=near.get)
                for g in comp: cls[g.index] = k
            elif kind == 'other':
                for g in comp: cls[g.index] = 'wood'
# red over the pouch's middle is the pouch's; red up at the fork tips is the wraps, part of the fork
for f in bm.faces:
    c = f.calc_center_median()
    if cls[f.index] == 'red' and c.z > 0.56: cls[f.index] = 'wood'   # the wraps round the fork tips belong to the fork
    elif cls[f.index] == 'red' and abs(c.x - cx) < 0.27: cls[f.index] = 'leather'
# the pouch's lighter rim, stitching and riveted tabs: everything joined to its leather that is not a strap, inside the pouch's reach
stack = [f for f in bm.faces if cls[f.index] == 'leather']; inpouch = {f.index for f in stack}
while stack:
    g = stack.pop()
    for e in g.edges:
        for h in e.link_faces:
            if h.index in inpouch or cls[h.index] in ('red', 'foot'): continue
            c = h.calc_center_median()
            if abs(c.x - cx) < 0.37 and 0.0 < c.z < 0.6: inpouch.add(h.index); stack.append(h)
for i in inpouch: cls[i] = 'leather'
# each strap's inner strand is painted like wood, so it is found by where it hangs: just inside the arm (whose inner face is
# about 0.44 out), between the wraps and the pouch's rim
n_strand = 0
for f in bm.faces:
    c = f.calc_center_median()
    if cls[f.index] == 'wood' and 0.45 < c.z < 0.8 and 0.3 < abs(c.x - cx) < 0.44: cls[f.index] = 'red'; n_strand += 1
print('inner strand faces', n_strand)
cut = (FORK_PIVOT - 0.1) / S + z0              # the fork's bend point, in the sculpt's frame
part = {}
for f in bm.faces:
    c = f.calc_center_median(); k = cls[f.index]
    if k == 'foot': part[f.index] = 'foot0' if (c.x - cx) < 0 else 'foot1'   # -x in the sculpt ends up toward the camera (game +z)
    elif k == 'leather': part[f.index] = 'pouch'
    elif k == 'red': part[f.index] = 'band0' if (c.x - cx) < 0 else 'band1'
    else: part[f.index] = 'trunk' if c.z < cut else 'fork'
print('faces per part', {k: sum(1 for v in part.values() if v == k) for k in sorted(set(part.values()))})

# ---- into the game's frame, then one object per part ----
bmesh.ops.transform(bm, matrix=M, verts=bm.verts); bm.to_mesh(o.data); o.data.update()
names = sorted(set(part.values())); objs = {}
for n in names:
    keep = {i for i, p in part.items() if p == n}
    if n == 'fork': keep |= {f.index for f in bm.faces if part[f.index] == 'trunk' and (f.calc_center_median().z) > FORK_PIVOT - 0.5}   # a little overlap hides the seam when it bends
    c = o.copy(); c.data = o.data.copy(); c.name = c.data.name = 'sling_' + n; bpy.context.collection.objects.link(c)
    b2 = bmesh.new(); b2.from_mesh(c.data); b2.faces.ensure_lookup_table()
    bmesh.ops.delete(b2, geom=[f for f in b2.faces if f.index not in keep], context='FACES')
    b2.to_mesh(c.data); b2.free(); objs[n] = c
bpy.data.objects.remove(o)
bm.free()

def verts(n): return [v.co.copy() for v in objs[n].data.vertices]
def shift(n, mat):
    objs[n].data.transform(mat); objs[n].data.update()
def empty(name, p):
    e = bpy.data.objects.new(name, None); e.location = p; bpy.context.collection.objects.link(e); return e

fork_pivot = Vector((0, 0, FORK_PIVOT)); trunk_pivot = Vector((0, 0, TRUNK_PIVOT))
pv = verts('pouch'); P = Vector(((min(v.x for v in pv) + max(v.x for v in pv)) / 2, (min(v.y for v in pv) + max(v.y for v in pv)) / 2, (min(v.z for v in pv) + max(v.z for v in pv)) / 2))
empty('seat', P - fork_pivot)
for i in (0, 1):
    bv = verts('band%d' % i); zs = sorted(v.z for v in bv); hi, lo = zs[int(len(zs) * 0.93)], zs[int(len(zs) * 0.07)]
    top = sum((v for v in bv if v.z >= hi), Vector()) / max(1, sum(1 for v in bv if v.z >= hi))
    bot = sum((v for v in bv if v.z <= lo), Vector()) / max(1, sum(1 for v in bv if v.z <= lo))
    empty('tip%d' % i, top - fork_pivot); empty('end%d' % i, bot - P)
    d = bot - top; L = d.length; mid = (top + bot) / 2
    # the band's own space: centred, its length along +z here (+y in the game), one unit long, turned the shortest way (as three.js turns it back)
    R = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    shift('band%d' % i, Matrix.Diagonal((1, 1, 1 / L, 1)) @ R.inverted() @ Matrix.Translation(-mid))
    print('band', i, 'tip', [round(x, 2) for x in game(top)], 'pouch end', [round(x, 2) for x in game(bot)], 'length', round(L, 2))
shift('pouch', Matrix.Translation(-P)); shift('trunk', Matrix.Translation(-trunk_pivot)); shift('fork', Matrix.Translation(-fork_pivot))
print('pouch middle', [round(x, 2) for x in game(P)], 'height', round(max(max(v.z for v in verts(n)) for n in ('fork',)) + FORK_PIVOT, 2))

for ob in objs.values():
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.shade_smooth()

if DEBUG:   # a picture of the parts, each in its own colour, put back together at rest
    cols = {'trunk': (0.8, 0.6, 0.2), 'fork': (0.9, 0.85, 0.3), 'pouch': (0.3, 0.15, 0.1), 'band0': (1, 0.1, 0.1), 'band1': (0.2, 0.4, 1), 'foot0': (0.1, 0.9, 0.2), 'foot1': (0.9, 0.1, 0.9)}
    import copy
    sc = bpy.context.scene; tmp = []
    for n, ob in objs.items():
        d = ob.copy(); d.data = ob.data.copy(); sc.collection.objects.link(d); tmp.append(d)
        m = bpy.data.materials.new(n); m.diffuse_color = (*cols[n], 1); d.data.materials.clear(); d.data.materials.append(m)
        if n == 'trunk': d.location = trunk_pivot
        if n == 'fork': d.location = fork_pivot
        if n == 'pouch': d.location = P
        if n.startswith('band'):
            i = int(n[-1]); top = bpy.data.objects['tip%d' % i].location + fork_pivot; bot = bpy.data.objects['end%d' % i].location + P; dd = bot - top
            d.matrix_world = Matrix.Translation((top + bot) / 2) @ Vector((0, 0, 1)).rotation_difference(dd.normalized()).to_matrix().to_4x4() @ Matrix.Diagonal((1, 1, dd.length, 1))
        ob.hide_render = True
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'MATERIAL'; sc.render.resolution_x = sc.render.resolution_y = 600
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 17
    for nm, az in (('side', 90), ('front', 0), ('three4', 50), ('back', 180), ('backtop', 200)):
        a = math.radians(az); cam.location = (40 * math.cos(a), -40 * math.sin(a), 7.5); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2 - a)
        sc.render.filepath = os.path.join(DEBUG, 'parts_' + nm + '.png'); bpy.ops.render.render(write_still=True)
    for d in tmp: bpy.data.objects.remove(d)
    for ob in objs.values(): ob.hide_render = False

for img in bpy.data.images:
    if img.size[0] > TEX: img.scale(TEX, TEX)
bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=85,
                          export_apply=True, export_animations=False, export_yup=True)
print('wrote', OUT, os.path.getsize(OUT))
