# Puts one body's head on another body (Joey's guide: one head for both forms). Run headless:
#   blender -b --factory-startup --python headswap.py -- --head head.glb --body body.glb --out out.glb
#       [--cut 1.66] [--half 0.15] [--keep 1.60] [--keephalf 0.13] [--dy 0.02] [--dz 0.03]
# Heights are from the soles (both meshes are the generator's 1.903 m tall, feet at -0.952). The body loses everything
# above --cut within --half of the middle (its own head) and the hole is capped; the head mesh keeps only what is above
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
# the body: its own head goes, the hole is capped
bm = bmesh.new(); bm.from_mesh(body.data)
# its own head is drawn in, tapering, to a thin column inside the new neck: the skin runs on from the traps into the new
# neck with no hole and no seam to patch (nothing is deleted, so the body's surface stays closed)
Z0 = F('neckz', 0.02); n = 0
for v in bm.verts:
    h = H(v)
    if abs(v.co.x) > HALF * 1.3 or h < CUT - 0.03: continue
    k = min(1.0, max(0.0, (h - (CUT - 0.03)) / 0.07)); k = k * k * (3 - 2 * k)   # 0 below the taper, 1 above it
    s = 1 - k * (1 - F('squeeze', 0.3)); fz = -v.co.y
    v.co.x *= s; v.co.y = -(Z0 + (fz - Z0) * s)
    if h > CUT: v.co.z = CUT - FOOT + (h - CUT) * 0.25
    n += 1
# what is left of the old head's surface takes plain skin from the neck below the taper (its hair and face would show)
uvl = bm.loops.layers.uv.active
if uvl:
    ref = min((v for v in bm.verts if abs(v.co.x) < 0.04 and CUT - 0.08 < H(v) < CUT - 0.04), key=lambda v: v.co.y, default=None)   # the front of the neck
    skin = ref.link_loops[0][uvl].uv.copy() if ref and ref.link_loops else None
    if skin:
        for f in bm.faces:
            if all(abs(v.co.x) <= HALF * 1.3 and H(v) > CUT - 0.005 - 0.0 for v in f.verts) or any(H(v) > CUT + 0.0 and abs(v.co.x) < HALF * 0.5 for v in f.verts):
                for l in f.loops: l[uvl].uv = skin
print('headswap: body head drawn in (%d vertices)' % n)
bm.to_mesh(body.data); bm.free()
# the head: only the head and the top of the neck, moved into place
bm = bmesh.new(); bm.from_mesh(head.data)
gone = [v for v in bm.verts if not (H(v) > KEEP and abs(v.co.x) < KHALF)]
bmesh.ops.delete(bm, geom=gone, context='VERTS')
for v in bm.verts: v.co.z += DY; v.co.y -= DZ
print('headswap: head keeps %d vertices' % len(bm.verts))
bm.to_mesh(head.data); bm.free()
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); head.select_set(True); bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB')
print('headswap: wrote ' + opt['out'])
