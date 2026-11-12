# Puts one body's head on another body (Joey's guide: one head for both forms). Run headless:
#   blender -b --factory-startup --python headswap.py -- --head head.glb --body body.glb --out out.glb
#       [--bcut 1.64] [--h1 1.60] [--shrink 0.6] [--zc 0.02] [--keep 1.60] [--keephalf 0.13] [--dy 0.02] [--dz 0.03]
# Heights are from the soles (both meshes are the generator's 1.903 m tall, feet at -0.952). The body loses its own head
# (see below); the head mesh keeps only what is above
# --keep within --keephalf (head and the top of the neck), is moved up --dy and forward --dz, and is joined on. Nothing is
# scaled, so the face stays exactly as generated. Both textures are kept, one material each.
import bpy, bmesh, sys
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
F = lambda k, d: float(opt.get(k, d))
CUT, HALF, KEEP, KHALF, DY, DZ, FOOT = F('cut', 1.66), F('half', 0.15), F('keep', 1.60), F('keephalf', 0.13), F('dy', 0.02), F('dz', 0.03), 0.952
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(p):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=p); new = [o for o in bpy.data.objects if o not in before]
    ms = [o for o in new if o.type == 'MESH']
    for o in new:
        if o.type != 'MESH': continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]; bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(ms) > 1: bpy.ops.object.join()
    for o in [o for o in new if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    return bpy.context.view_layer.objects.active
body = load(opt['body']); head = load(opt['head'])
H = lambda v: v.co.z + FOOT   # height from the soles; forward is -y in Blender
# the head: only the head and the top of the neck, moved into place
bm = bmesh.new(); bm.from_mesh(head.data)
# below --necktop only the neck itself is kept (an ellipse round it), so none of the slim body's shoulders pokes out
NT, NRX, NRZ, NCZ = F('necktop', 1.63), F('neckrx', 0.085), F('neckrz', 0.09), F('neckcz', -0.035)
def keep(v):
    h = H(v)
    if not (h > KEEP and abs(v.co.x) < KHALF): return False
    return h >= NT or (v.co.x / NRX) ** 2 + ((-v.co.y - NCZ) / NRZ) ** 2 <= 1
gone = [v for v in bm.verts if not keep(v)]
bmesh.ops.delete(bm, geom=gone, context='VERTS')
for v in bm.verts: v.co.z += DY; v.co.y -= DZ
print('headswap: head keeps %d vertices' % len(bm.verts))
hverts = [v.co.copy() for v in bm.verts]
bm.to_mesh(head.data); bm.free()
# the body: its own head goes. Everything above --bcut near the middle is deleted. From --h1 up to --bcut the body's own
# neck is drawn in toward the new head's neck, measured angle by angle round the neck's middle, until it lies just inside
# it (--shrink of the new neck's radius). So the new neck is outside the body's from about --h1 up, the body's thick neck is
# outside the new neck's cut-off bottom, both cut edges are hidden inside the other surface, and the skins meet in one line.
import math
BCUT, H1, SHR, ZC = F('bcut', 1.64), F('h1', 1.60), F('shrink', 0.9), F('zc', 0.0)
AB, HB = 24, 0.01   # angle and height bins for the new neck's radius
rad = {}; NTOP = NT + DY
class _V:
    pass
for co in hverts:
    v = _V(); v.co = co
    h = H(v); x, z = v.co.x, -v.co.y - ZC
    if h > NTOP: continue   # the neck only: higher up the jaw and chin would count as neck
    key = (int(math.floor(h / HB)), int(math.floor((math.atan2(x, z) + math.pi) / (2 * math.pi) * AB)) % AB)
    rad[key] = max(rad.get(key, 0.0), math.hypot(x, z))
def new_r(h, ang):
    h = min(h, NTOP - 0.006); hb = int(math.floor(h / HB)); ab = int(math.floor((ang + math.pi) / (2 * math.pi) * AB)) % AB
    for dh in (0, 1, -1, 2, -2):
        for da in (0, 1, -1):
            r = rad.get((hb + dh, (ab + da) % AB))
            if r: return r
    return None
bm = bmesh.new(); bm.from_mesh(body.data)
gone = [v for v in bm.verts if H(v) > BCUT and abs(v.co.x) < 0.25]
bmesh.ops.delete(bm, geom=gone, context='VERTS'); n = 0
for v in bm.verts:
    h = H(v)
    if h <= H1 - 0.08: continue
    x, z = v.co.x, -v.co.y - ZC; r = math.hypot(x, z)
    if r < 1e-6 or (r > 0.24 and h < 1.63): continue
    ang = math.atan2(x, z); rn = new_r(h, ang)
    if not rn: continue
    # where the draw-in starts goes round the neck: low at the back (the body's hairline must go under the new nape), high
    # at the front (the body's throat stays outside the new neck's cut-off bottom until the jaw covers it)
    fr = min(1.0, max(0.0, (math.cos(ang) + 0.3) / 0.6)); fr = fr * fr * (3 - 2 * fr); h0 = H1 - 0.08 + 0.05 * fr
    k = min(1.0, max(0.0, (h - h0) / 0.04)); k = k * k * (3 - 2 * k)
    if h < 1.63: far = min(1.0, max(0.0, (r - 0.16) / 0.08)); k *= 1 - far * far * (3 - 2 * far)   # shoulders further out are left alone (higher up is all head)
    want = min(r, rn * SHR); r2 = r + (want - r) * k
    if r2 >= r: continue
    v.co.x = x * r2 / r; v.co.y = -(ZC + z * r2 / r); n += 1
# what is left of the old head's hairline (now tucked under the new nape) takes plain skin from the back of the neck
uvl = bm.loops.layers.uv.active; HAIR = F('hairline', 1.635)
if uvl:
    ref = max((v for v in bm.verts if abs(v.co.x) < 0.03 and 1.57 < H(v) < 1.6), key=lambda v: v.co.y, default=None)   # the back of the neck (-y is forward)
    if ref and ref.link_loops:
        skin = ref.link_loops[0][uvl].uv.copy()
        hair = lambda v: H(v) > HAIR and math.cos(math.atan2(v.co.x, -v.co.y - ZC)) < 0.2
        for f in bm.faces:   # whole faces, so no triangle stretches across the texture
            if any(hair(v) for v in f.verts):
                for l in f.loops: l[uvl].uv = skin
print('headswap: body head removed (%d vertices), neck drawn in (%d vertices)' % (len(gone), n))
bm.to_mesh(body.data); bm.free()
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); head.select_set(True); bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB')
print('headswap: wrote ' + opt['out'])
