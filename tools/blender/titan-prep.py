# Turns one of the owner's Meshy .blend sculpts (a million faces, textured) into a game-sized GLB: drops loose debris
# (the floor cracks round the fists), reduces the faces, stands it on the floor at the origin, facing +Z in glTF.
# Optionally replaces the legs below a height with stick-figure legs (thin dark ink strokes): the human form.
#   blender -b <sculpt.blend> --python tools/blender/titan-prep.py -- --out out.glb [--faces 60000]
#       [--lift m] [--stick legs.json]   legs.json: {"cut": y, "keep_x": half width kept, "r": radius, "legs": [[hip, knee, ankle, toe] x2]}
#   Points in legs.json are model coordinates after standing it up: metres, y up, +z forward, x his left.
import bpy, bmesh, sys, json, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
ob = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
for o in list(bpy.context.scene.objects):
    if o != ob: bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# ---- loose debris: keep the big connected pieces only ----
bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
seen = set(); parts = []
for v in bm.verts:
    if v.index in seen: continue
    stack = [v]; comp = []; seen.add(v.index)
    while stack:
        x = stack.pop(); comp.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y.index not in seen: seen.add(y.index); stack.append(y)
    parts.append(comp)
parts.sort(key=len, reverse=True); big = len(parts[0])
drop = [v for p in parts if len(p) < big * 0.02 for v in p]
print('prep: %d loose pieces, largest %d verts; dropping %d small pieces (%d verts)' % (len(parts), big, sum(1 for p in parts if len(p) < big * 0.02), len(drop)))
bmesh.ops.delete(bm, geom=drop, context='VERTS'); bm.to_mesh(ob.data); bm.free(); ob.data.update()
# ---- debris welded to the fists: thin spiky faces lying near the floor and outside the hands' bulk ----
lo = min(v.co.z for v in ob.data.vertices)
if opt.get('floorcut'):   # delete everything lower than this above the lowest point, except within the given xy discs (fists, feet)
    fc = float(opt['floorcut']); keep = json.loads(opt.get('floorkeep', '[]'))
    bm = bmesh.new(); bm.from_mesh(ob.data)
    gone = [v for v in bm.verts if v.co.z < lo + fc and not any((v.co.x - k[0]) ** 2 + (v.co.y - k[1]) ** 2 < k[2] ** 2 for k in keep)]
    bmesh.ops.delete(bm, geom=gone, context='VERTS'); bm.to_mesh(ob.data); bm.free(); ob.data.update(); print('prep: floor cut removed %d verts' % len(gone))
# ---- floor cracks welded to the fists: pale grey, unsaturated, low down. Skin, shorts and cap are all saturated or dark. ----
if opt.get('cracks'):
    import numpy as np
    h = float(opt['cracks']); me = ob.data
    img = next(n.image for m in me.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
    w, hh = img.size; px = np.array(img.pixels[:], dtype=np.float32).reshape(hh, w, -1); uv = me.uv_layers.active.data
    grey = [0] * len(me.vertices); cnt = [0] * len(me.vertices)
    for lp in me.loops:
        u, v = uv[lp.index].uv; c = px[min(hh - 1, max(0, int((v % 1) * hh))), min(w - 1, max(0, int((u % 1) * w)))]
        mx, mn = max(c[:3]), min(c[:3]); sat = (mx - mn) / mx if mx > 1e-4 else 0
        cnt[lp.vertex_index] += 1; grey[lp.vertex_index] += 1 if (sat < float(opt.get("cracksat", 0.4)) and mx > 0.3) else 0
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    gone = [bm.verts[i] for i in range(len(me.vertices)) if cnt[i] and grey[i] * 2 >= cnt[i] and bm.verts[i].co.z < lo + h]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    # what is left of the cracks: small loose islands
    bm.verts.ensure_lookup_table(); seen = set(); parts = []
    for v in bm.verts:
        if v.index in seen: continue
        st = [v]; comp = []; seen.add(v.index)
        while st:
            x = st.pop(); comp.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); st.append(y)
        parts.append(comp)
    parts.sort(key=len, reverse=True); small = [v for p in parts[1:] if len(p) < len(parts[0]) * 0.02 for v in p]
    bmesh.ops.delete(bm, geom=small, context='VERTS'); bm.to_mesh(me); bm.free(); me.update()
    print('prep: cracks: %d grey verts and %d in loose bits removed' % (len(gone), len(small)))
# ---- fewer faces ----
n0 = len(ob.data.polygons); want = int(opt.get('faces', 60000))
if n0 > want:
    d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = want / n0; d.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
print('prep: %d -> %d faces' % (n0, len(ob.data.polygons)))
# ---- stand it up: lowest point on the floor, centred over the origin left-right and front-back ----
vs = ob.data.vertices; lo = Vector([min(v.co[i] for v in vs) for i in range(3)]); hi = Vector([max(v.co[i] for v in vs) for i in range(3)])
off = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
ob.data.transform(__import__('mathutils').Matrix.Translation(off)); ob.data.update()
print('prep: size %.3f wide, %.3f deep, %.3f tall' % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
if opt.get('lift'):   # a sculpt that ends at the shorts: raise it so the stick legs can stand under it
    ob.data.transform(__import__('mathutils').Matrix.Translation(Vector((0, 0, float(opt['lift']))))); ob.data.update(); print('prep: lifted %s m' % opt['lift'])
conv = lambda p: Vector((p[0], -p[2], p[1]))   # model (y up, +z forward) -> Blender
# ---- stick legs ----
if opt.get('stick'):
    S = json.load(open(opt['stick'], encoding='utf-8'))
    bm = bmesh.new(); bm.from_mesh(ob.data)
    # everything lower than "cut" goes, except inside the "keep" boxes (the arms reaching down to the floor)
    inbox = lambda p, bx: all(min(bx[0][i], bx[1][i]) <= p[i] <= max(bx[0][i], bx[1][i]) for i in range(3))
    gone = [v for v in bm.verts if v.co.z < S['cut'] and not any(inbox((v.co.x, v.co.z, -v.co.y), bx) for bx in S.get('keep', []))]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    print('prep: legs below %.2f removed (%d verts)' % (S['cut'], len(gone)))
    # fill the holes left at the shorts' hems so the cut doesn't show
    bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    # the strokes: round tubes with round joints, one dark material
    ink = bpy.data.materials.new('Ink'); ink.use_nodes = True; bsdf = ink.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = S.get('colour', (0.03, 0.03, 0.035, 1)); bsdf.inputs['Roughness'].default_value = 0.8
    r = S.get('r', 0.022); strokes = []
    for leg in S['legs']:
        pts = [conv(p) for p in leg]
        for p0, p1 in zip(pts, pts[1:]):
            d = p1 - p0; bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r, depth=d.length, location=(p0 + p1) / 2)
            c = bpy.context.active_object; c.rotation_mode = 'QUATERNION'; c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); strokes.append(c)
        for p in pts:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r * 1.05, location=p); strokes.append(bpy.context.active_object)
    for c in strokes:
        c.data.materials.append(ink)
        for uv in [c.data.uv_layers.new(name=ob.data.uv_layers[0].name)] if not c.data.uv_layers else []: pass
    bpy.ops.object.select_all(action='DESELECT')
    for c in strokes: c.select_set(True)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); bpy.ops.object.join()
    print('prep: stick legs, %d strokes' % len(strokes))
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_yup=True, export_apply=True)
print('prep: wrote ' + opt['out'])
