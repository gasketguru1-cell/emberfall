# Builds a custom skeleton for a generated mesh, weights the mesh to it, adds keyed animation clips, and writes a GLB.
# Run headless:
#   blender -b --factory-startup --python tools/blender/rig.py -- --mesh in.glb --spec spec.json --out out.glb [--start 0]
#   --start 0 makes a key at t seconds play at exactly t in the game (the default, 1, exports every key one frame late; the
#   models built before 2026-11-10's animation overhaul use it, and their markers allow for it)
#
# The spec is written in the model's own coordinates (metres, Y up, the character faces +Z):
#   "prep":  { "yaw": degrees, "translate": [x,y,z] }   turn and move the mesh first (applied in that order), so it stands at the origin facing +Z
#   "ik":    [ { "name": control bone, "bone": lower leg bone, "chain": 2, "paw": paw bone } ]   leg reach: the lower bone's tip follows the control
#   "copyrot": [ { "bone": name, "from": control bone } ]   the bone points the way its control points, whatever its parents do (a held tool aimed directly)
#   "rigid": [ { "bone": name, "box": [[x,y,z],[x,y,z]] } ]   every vertex inside the box follows that bone alone (a tool that must not bend)
#            "skipDark": lum / "skipGrey": saturation leave out vertices painted darker / greyer than that (later entries win)
#            or { "bone", "capsule": [[x,y,z],[x,y,z]], "r": radius }   within r of the line between two points (a blade at any angle)
#            or { "bone", "disc": [x,y,z], "n": [x,y,z], "r": radius, "t": [near, far] }   a round slab: centre, facing, radius, and how far along the facing it runs
#            or { "nearest": [bones], "keep": [bones], "r": distance }   each vertex within r of those bones follows the nearest alone (the
#            plates of a gauntlet's fingers); one nearer a "keep" bone keeps its weights; separate parts are never taken
#   "poses": { "<name>": { "<bone>": {...} } }   named poses a key can start from with "use"
#   "bones": [ { "name", "head": [x,y,z], "tail": [x,y,z], "parent": name or null, "connect": bool, "deform": bool } ]
#   "clips": { "<name>": { "fps": 30, "loop": bool, "keys": [ { "t": seconds, "pose": { "<bone>": { "rot": [pitch, yaw, roll], "move": [x,y,z] } } } ] } }
# "spin": degrees in a pose turns the bone about its own rest line (palm over), before "rot".
# "aim": [x,y,z] in a pose turns the bone from the way it points at rest to point that way (the short way round), with "twist"
# degrees about that line after; "rot" is then applied on top. For a held tool: say where it points, not how to get there.
# --shots out.json --shotdir dir renders the clips and times listed in out.json (side view, her front to the right) for checking poses.
# "rot" is in degrees about the model's own axes (pitch = about the right axis, yaw = about up, roll = about forward),
# so a pose reads the same whichever way a bone happens to point. Bones not named in a key keep their previous value.
import bpy, sys, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
spec = json.load(open(opt['spec'], encoding='utf-8'))

conv = lambda p: Vector((p[0], -p[2], p[1]))            # model (Y up, +Z forward) -> Blender (Z up, -Y forward)
RIGHT, UP, FWD = Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=opt['mesh'])
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes: raise SystemExit('rig: no mesh in ' + opt['mesh'])
# "parts": [ { "object": name, "bone": name } ]: a separate mesh object in the file (a weapon modelled on its own) is tagged
# before the meshes are joined, so a rigid entry { "bone", "part": name } can take exactly its vertices, however close they
# sit to the body (an axe haft through a closed fist).
for k, pt in enumerate(spec.get('parts', [])):
    for o in meshes:
        if o.name == pt['object'] or o.name.startswith(pt['object'] + '.'):
            at = o.data.attributes.new('part_id', 'INT', 'POINT'); at.data.foreach_set('value', [k + 1] * len(o.data.vertices))
            print('rig: part %s is mesh object %s (%d vertices)' % (pt['object'], o.name, len(o.data.vertices)))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1: bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
for o in [o for o in bpy.context.scene.objects if o.type not in ('MESH',)]: bpy.data.objects.remove(o, do_unlink=True)
for vg in list(mesh.vertex_groups): mesh.vertex_groups.remove(vg)
for m in list(mesh.modifiers): mesh.modifiers.remove(m)
prep = spec.get('prep')
if prep:
    M = Matrix.Translation(conv(prep.get('translate', [0, 0, 0]))) @ Matrix.Rotation(math.radians(prep.get('yaw', 0)), 4, UP)
    mesh.data.transform(M); mesh.data.update()
lo = [min(v.co[i] for v in mesh.data.vertices) for i in range(3)]; hi = [max(v.co[i] for v in mesh.data.vertices) for i in range(3)]
print('rig: mesh %d verts, %d faces, size %.3f x %.3f x %.3f (model x, y up, z)' % (len(mesh.data.vertices), len(mesh.data.polygons), hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]))

# ---- skeleton ----
arm = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm); bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
for b in spec['bones']:
    eb = arm.edit_bones.new(b['name']); eb.head = conv(b['head']); eb.tail = conv(b['tail'])
    if b.get('parent'): eb.parent = arm.edit_bones[b['parent']]; eb.use_connect = bool(b.get('connect', False))
bpy.ops.object.mode_set(mode='OBJECT')
for b in spec['bones']: arm.bones[b['name']].use_deform = b.get('deform', True)
print('rig: skeleton %d bones (%d deform)' % (len(arm.bones), sum(1 for b in arm.bones if b.use_deform)))

# ---- weights: automatic (heat) on the mesh itself; if that leaves gaps, weight a clean voxel copy and transfer ----
def auto_weight(target):
    bpy.ops.object.select_all(action='DESELECT'); target.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return sum(1 for v in target.data.vertices if not any(g.weight > 1e-4 for g in v.groups))

# "weights" in the spec replaces automatic weighting with weights worked out from where each vertex is: for a simple shape
# with a mouth that must open and shut cleanly (Chomp Chomp), where heat weighting cannot tell the roof of a mouth from its
# floor. Each entry, in order, takes a share s (0..1) of every vertex for its bone, leaving the rest to the entries before:
#   { "bone", "all": true }                                         everything
#   { "bone", "sphere": { "c": [x,y,z], "r0", "r1", "scale": [x,y,z] } }   1 inside r0, fading to 0 at r1 (an ellipsoid with "scale")
#   { "bone", "halves": [ [axis 0|1|2, at, soft, dir] ] }           each: 0 below `at`, 1 above (dir 1) over a band `soft` wide; multiplied
#   { "bone", "wedge": { "hinge": [y, z], "from": [deg, soft, softSide], "to": [deg, soft, softSide], "side": [x, width] } }
#       the angle round a left-to-right axis through the hinge (0 forward, 90 up); softSide is the softness out past |x| = side;
#       "fade": [x, width] lets the wedge go again further out to the sides (cheeks stay with the body)
#   "dark": true on a sphere entry: only the dark-painted vertices (black eyes, brows) get the full sphere; the skin round them
#       gets one 0.6 the size, so an eye can grow or shut without dragging the face with it
# Several kinds in one entry multiply.
def smooth(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def vertex_dark(target):
    # brightness of the base colour texture at each vertex (0..1), or None without a texture
    try:
        import numpy as np
        img = next(n.image for m in target.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
        w, h = img.size; px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, -1); uv = target.data.uv_layers.active.data; out = [1.0] * len(target.data.vertices)
        for lp in target.data.loops:
            u, v = uv[lp.index].uv; c = px[min(h - 1, max(0, int((v % 1) * h))), min(w - 1, max(0, int((u % 1) * w)))]
            out[lp.vertex_index] = min(out[lp.vertex_index], float(c[0] * 0.3 + c[1] * 0.6 + c[2] * 0.1))
        return out
    except Exception as e:
        print('rig: no base colour to read (%s)' % e); return None
def vertex_sat(target):
    # how coloured the base colour texture is at each vertex (0 grey .. 1 pure colour; the least over its corners), or None
    try:
        import numpy as np
        img = next(n.image for m in target.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links))
        w, h = img.size; px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, -1); uv = target.data.uv_layers.active.data; out = [1.0] * len(target.data.vertices)
        for lp in target.data.loops:
            u, v = uv[lp.index].uv; c = px[min(h - 1, max(0, int((v % 1) * h))), min(w - 1, max(0, int((u % 1) * w)))]
            mx, mn = max(c[:3]), min(c[:3]); out[lp.vertex_index] = min(out[lp.vertex_index], float((mx - mn) / mx) if mx > 1e-4 else 0.0)
        return out
    except Exception as e:
        print('rig: no base colour to read (%s)' % e); return None
def strength(op, p, lum=1.0):
    s = 1.0
    if 'sphere' in op:
        q = op['sphere']; sc = q.get('scale', [1, 1, 1]); d = math.sqrt(sum(((p[i] - q['c'][i]) / sc[i]) ** 2 for i in range(3)))
        if op.get('dark') and lum > op.get('darkBelow', 0.12): d /= 0.6
        s *= 1 - smooth((d - q['r0']) / max(1e-6, q['r1'] - q['r0']))
    for ax, at, soft, dr in op.get('halves', []): s *= smooth((p[ax] - at) * dr / max(1e-6, soft) + 0.5)
    if 'wedge' in op:
        q = op['wedge']; ang = math.degrees(math.atan2(p[1] - q['hinge'][0], p[2] - q['hinge'][1])); sd = q.get('side')
        k = smooth((abs(p[0]) - sd[0]) / sd[1]) if sd else 0
        f, t = q['from'], q['to']
        if 'fade' in q: s *= 1 - smooth((abs(p[0]) - q['fade'][0]) / q['fade'][1])   # out toward the sides the wedge lets go
        s *= smooth((ang - f[0]) / (f[1] + (f[2] - f[1]) * k if len(f) > 2 else f[1]) + 0.5) * smooth((t[0] - ang) / (t[1] + (t[2] - t[1]) * k if len(t) > 2 else t[1]) + 0.5)
    return s
def placed_weights(target):
    bpy.ops.object.select_all(action='DESELECT'); target.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE')
    W = [dict() for _ in target.data.vertices]; lum = vertex_dark(target) if any(op.get('dark') for op in spec['weights']) else None
    for op in spec['weights']:
        for v in target.data.vertices:
            s = strength(op, (v.co[0], v.co[2], -v.co[1]), lum[v.index] if lum else 1.0)
            if s <= 1e-4: continue
            w = W[v.index]
            for k in w: w[k] *= 1 - s
            w[op['bone']] = w.get(op['bone'], 0) + s
    groups = {b.name: target.vertex_groups.new(name=b.name) for b in arm.bones if b.use_deform}
    for i, w in enumerate(W):
        for k, x in w.items():
            if x > 1e-4: groups[k].add([i], x, 'REPLACE')
    if lum:
        for op in spec['weights']:
            if not op.get('dark'): continue
            ix = [i for i, w in enumerate(W) if w.get(op['bone'], 0) > 0.5]
            if ix: print('rig: %s holds %d vertices, brightness %.2f to %.2f' % (op['bone'], len(ix), min(lum[i] for i in ix), max(lum[i] for i in ix)))
    return sum(1 for w in W if sum(w.values()) < 1e-4)

if spec.get('weights'): missing = placed_weights(mesh); method = 'placed (%d rules)' % len(spec['weights'])
else: missing = auto_weight(mesh); method = 'automatic'
if not spec.get('weights') and missing > len(mesh.data.vertices) * 0.01:
    print('rig: automatic weights left %d vertices unweighted; using a voxel proxy' % missing)
    for vg in list(mesh.vertex_groups): mesh.vertex_groups.remove(vg)
    for m in list(mesh.modifiers): mesh.modifiers.remove(m)
    mesh.parent = None
    proxy = mesh.copy(); proxy.data = mesh.data.copy(); bpy.context.collection.objects.link(proxy)
    rm = proxy.modifiers.new('vox', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = max(hi[i] - lo[i] for i in range(3)) * 0.012
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.modifier_apply(modifier='vox')
    pm = auto_weight(proxy)
    for b in arm.bones:
        if b.use_deform and b.name not in mesh.vertex_groups: mesh.vertex_groups.new(name=b.name)
    dt = mesh.modifiers.new('xfer', 'DATA_TRANSFER'); dt.object = proxy; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.datalayout_transfer(modifier='xfer'); bpy.ops.object.modifier_apply(modifier='xfer')
    bpy.data.objects.remove(proxy, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE')
    missing = sum(1 for v in mesh.data.vertices if not any(g.weight > 1e-4 for g in v.groups)); method = 'voxel proxy (proxy gaps %d)' % pm
# last resort, when heat weighting finds no solution even on the proxy (a mesh with thin separate parts, like stick legs):
# each vertex follows its nearest bones, by distance to each bone's segment, sharpest for the nearest
if missing > len(mesh.data.vertices) * 0.5:
    for vg in list(mesh.vertex_groups): mesh.vertex_groups.remove(vg)
    deform = [b for b in arm.bones if b.use_deform]; groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in deform}
    segs = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in deform]
    for v in mesh.data.vertices:
        ds = []
        for n, a, b in segs:
            ab = b - a; t = max(0.0, min(1.0, (v.co - a).dot(ab) / max(1e-9, ab.length_squared))); ds.append(((v.co - (a + ab * t)).length, n))
        ds.sort(); best = ds[:3]; ws = [1 / (d + 0.03) ** 4 for d, _ in best]; s = sum(ws)
        for (d, n), w in zip(best, ws):
            if w / s > 0.02: groups[n].add([v.index], w / s, 'REPLACE')
    if mesh.parent != rig:
        bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
        bpy.ops.object.parent_set(type='ARMATURE')
    missing = 0; method = 'distance to bones (heat weighting found no solution)'
# vertices the weighting missed would stay behind when the skeleton moves: give each the weights of the nearest vertex that has some
if missing:
    from mathutils import kdtree
    has = [v.index for v in mesh.data.vertices if any(g.weight > 1e-4 for g in v.groups)]
    kd = kdtree.KDTree(len(has))
    for i in has: kd.insert(mesh.data.vertices[i].co, i)
    kd.balance(); fixed = 0
    for v in mesh.data.vertices:
        if any(g.weight > 1e-4 for g in v.groups): continue
        _, src, _ = kd.find(v.co)
        for g in mesh.data.vertices[src].groups:
            if g.weight > 1e-4: mesh.vertex_groups[g.group].add([v.index], g.weight, 'REPLACE')
        fixed += 1
    print('rig: %d missed vertices given their nearest neighbour\'s weights' % fixed)
# glTF allows four bones per vertex
bpy.ops.object.select_all(action='DESELECT'); mesh.select_set(True); bpy.context.view_layer.objects.active = mesh
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4); bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
print('rig: weights by %s; %d bones, %d groups, %d vertices unweighted' % (method, len(arm.bones), len(mesh.vertex_groups), missing))

# ---- rigid parts: vertices inside a box follow one bone only ----
bpy.ops.object.mode_set(mode='OBJECT')
part_vals = None
if spec.get('parts') and 'part_id' in mesh.data.attributes:
    part_vals = [0] * len(mesh.data.vertices); mesh.data.attributes['part_id'].data.foreach_get('value', part_vals)
SPEC_BONE = {b['name']: b for b in spec['bones']}
def seg_dist(co, name):
    a, b = conv(SPEC_BONE[name]['head']), conv(SPEC_BONE[name]['tail']); ab = b - a
    return (co - (a + ab * max(0.0, min(1.0, (co - a).dot(ab) / max(ab.length_squared, 1e-12))))).length
for rg in spec.get('rigid', []):
    if 'nearest' in rg:   # each vertex within r of these bones follows the nearest one alone; one nearer a "keep" bone is left as it is
        own = {}
        for v in mesh.data.vertices:
            if part_vals and part_vals[v.index]: continue   # never a separate part (a held tool)
            d, nm = min((seg_dist(v.co, n), n) for n in rg['nearest'] + rg.get('keep', []))
            if d <= rg['r'] and nm in rg['nearest']: own.setdefault(nm, []).append(v.index)
        for nm, idx in own.items():
            for vg in mesh.vertex_groups: vg.remove(idx)
            mesh.vertex_groups[nm].add(idx, 1.0, 'REPLACE')
            globals().setdefault('rigid_sets', {}).setdefault(nm, set()).update(idx)
        print('rig: nearest of %d bones: %s' % (len(rg['nearest']), ' '.join('%s %d' % (n, len(own.get(n, []))) for n in rg['nearest'])))
        continue
    if 'part' in rg:
        k = 1 + [pt['object'] for pt in spec['parts']].index(rg['part'])
        idx = [i for i, v in enumerate(part_vals or []) if v == k]
    elif 'capsule' in rg:
        a, b = conv(rg['capsule'][0]), conv(rg['capsule'][1]); ab = b - a; L2 = ab.length_squared; r2 = rg['r'] ** 2
        idx = [v.index for v in mesh.data.vertices if (v.co - (a + ab * max(0.0, min(1.0, (v.co - a).dot(ab) / L2)))).length_squared <= r2]
    elif 'disc' in rg:
        c, n = conv(rg['disc']), conv(rg['n']).normalized(); t0, t1 = rg['t']; r2 = rg['r'] ** 2
        idx = [v.index for v in mesh.data.vertices if t0 <= (v.co - c).dot(n) <= t1 and ((v.co - c) - n * (v.co - c).dot(n)).length_squared <= r2]
    else:
        a, b = conv(rg['box'][0]), conv(rg['box'][1]); mn = [min(a[i], b[i]) for i in range(3)]; mx = [max(a[i], b[i]) for i in range(3)]
        idx = [v.index for v in mesh.data.vertices if all(mn[i] <= v.co[i] <= mx[i] for i in range(3))]
    if 'skipDark' in rg:   # leave out vertices painted darker than this (a black boot touching a copper tool)
        lum = globals().get('lum_cache') or vertex_dark(mesh); globals()['lum_cache'] = lum
        if lum: n0 = len(idx); idx = [i for i in idx if lum[i] >= rg['skipDark']]; print('rig: %d dark vertices left out of %s' % (n0 - len(idx), rg['bone']))
    if 'skipGrey' in rg:   # leave out vertices painted greyer than this (black and grey cloth touching a skin-coloured hand)
        sat = globals().get('sat_cache') or vertex_sat(mesh); globals()['sat_cache'] = sat
        if sat: n0 = len(idx); idx = [i for i in idx if sat[i] >= rg['skipGrey']]; print('rig: %d grey vertices left out of %s' % (n0 - len(idx), rg['bone']))
    for vg in mesh.vertex_groups: vg.remove(idx)
    mesh.vertex_groups[rg['bone']].add(idx, 1.0, 'REPLACE')
    print('rig: %d vertices rigid on %s' % (len(idx), rg['bone']))
    rigid_sets = globals().setdefault('rigid_sets', {}); rigid_sets.setdefault(rg['bone'], set()).update(idx)
# "only": true on a rigid entry: that bone moves nothing outside its rigid part. Automatic weighting gives a tool's bone some
# pull on whatever is near it at rest (a boot beside a wrench); that pull would drag the boot along with every swing.
for bone in {rg['bone'] for rg in spec.get('rigid', []) if rg.get('only')}:
    part = rigid_sets[bone]; g = mesh.vertex_groups[bone]; gi = g.index; fixed = 0
    for v in mesh.data.vertices:
        if v.index in part: continue
        ws = {e.group: e.weight for e in v.groups if e.weight > 1e-6}
        if gi not in ws: continue
        rest = sum(w for k, w in ws.items() if k != gi); g.remove([v.index]); fixed += 1
        if rest > 1e-6:
            for k, w in ws.items():
                if k != gi: mesh.vertex_groups[k].add([v.index], w / rest, 'REPLACE')
        else: mesh.vertex_groups[arm.bones[bone].parent.name].add([v.index], 1.0, 'REPLACE')
    print('rig: %s no longer pulls on %d vertices outside its rigid part' % (bone, fixed))
# "detach": [y0, y1] on a rigid entry removes the faces that join that bone's rigid part to the rest of the mesh between those
# heights (spec units, feet at 0). A generated mesh is one welded surface, so a tool resting on the floor beside a boot shares
# faces with it there; those faces would stretch into strips whenever the tool moves, however they were weighted.
for rg in spec.get('rigid', []):
    if 'detach' not in rg: continue
    import bmesh
    y0, y1 = rg['detach']; part = rigid_sets[rg['bone']]
    bm = bmesh.new(); bm.from_mesh(mesh.data); bm.faces.ensure_lookup_table()
    gone = [f for f in bm.faces if 0 < sum(v.index in part for v in f.verts) < len(f.verts) and y0 <= f.calc_center_median().z <= y1]
    bmesh.ops.delete(bm, geom=gone, context='FACES_ONLY'); bm.to_mesh(mesh.data); bm.free(); mesh.data.update()
    print('rig: detached %s from the body between heights %.2f and %.2f (%d faces)' % (rg['bone'], y0, y1, len(gone)))

# ---- leg reach (IK): the lower leg's tip follows a control bone; the exporter bakes the result into plain rotations ----
bpy.context.view_layer.objects.active = rig
for ik in spec.get('ik', []):
    c = rig.pose.bones[ik['bone']].constraints.new('IK'); c.target = rig; c.subtarget = ik['name']; c.chain_count = ik.get('chain', 2)
if spec.get('ik'): print('rig: %d IK chains' % len(spec['ik']))
for cr in spec.get('copyrot', []):
    c = rig.pose.bones[cr['bone']].constraints.new('COPY_ROTATION'); c.target = rig; c.subtarget = cr['from']
    c.target_space = c.owner_space = cr.get('space', 'WORLD'); c.mix_mode = cr.get('mix', 'REPLACE'); c.influence = cr.get('influence', 1.0)
    if cr.get('axes'): c.use_x, c.use_y, c.use_z = ('X' in cr['axes'], 'Y' in cr['axes'], 'Z' in cr['axes'])
    if cr.get('invert'): c.invert_x, c.invert_y, c.invert_z = ('X' in cr['invert'], 'Y' in cr['invert'], 'Z' in cr['invert'])   # turn the other way (a twist helper undoing part of its limb's roll)
if spec.get('copyrot'): print('rig: %d aimed bones' % len(spec['copyrot']))
# "track": [ { "bone", "target": bone, "headtail": 0..1 } ]   the bone points at a point on another bone, turning the short way
# from its parent (an upper-arm twist helper that follows the arm's swing but not its twist)
for tk in spec.get('track', []):
    c = rig.pose.bones[tk['bone']].constraints.new('DAMPED_TRACK'); c.target = rig; c.subtarget = tk['target']; c.head_tail = tk.get('headtail', 1.0)
if spec.get('track'): print('rig: %d tracking helpers' % len(spec['track']))

# ---- animation ----
def delta(rot):
    p, y, r = (math.radians(a) for a in rot)
    return (Quaternion(UP, y) @ Quaternion(RIGHT, p) @ Quaternion(FWD, r)).to_matrix()

# "scale": [x, y, z] in a pose is squash and stretch along the model's axes (1 = rest). A bone's own axes rarely line up with the
# model's exactly, so each of its axes takes the model scale it lies closest to (weighted by how much it lies along each).
def bone_scale(R, s):
    S = conv(s); S = Vector((abs(S[0]), abs(S[1]), abs(S[2])))
    out = []
    for i in range(3):
        ax = R.col[i]; w = Vector((abs(ax[0]), abs(ax[1]), abs(ax[2]))); t = w[0] + w[1] + w[2]
        out.append((w[0] * S[0] + w[1] * S[1] + w[2] * S[2]) / t if t > 1e-6 else 1)
    return Vector(out)

# "in" on a key says how the motion arrives there: "back" overshoots and settles (follow-through), "snap" leaves the last key
# slowly and arrives fast (a strike), "out" leaves fast and eases in (a recoil), "hold" jumps (no in-between), "elastic" wobbles
# in. Without it Blender's smooth ease in and out is used.
EASE = {'back': ('BACK', 'EASE_OUT'), 'snap': ('EXPO', 'EASE_IN'), 'out': ('EXPO', 'EASE_OUT'), 'hold': ('CONSTANT', 'AUTO'), 'elastic': ('ELASTIC', 'EASE_OUT'), 'lin': ('LINEAR', 'AUTO'), 'quad': ('QUAD', 'EASE_OUT')}
def fcurves_of(act):
    try:
        fc = list(act.fcurves)
        if fc: return fc
    except Exception: pass
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []): out.extend(bag.fcurves)
    return out

rest = {b.name: b.matrix_local.to_3x3() for b in arm.bones}
restdir = {b.name: (b.tail_local - b.head_local).normalized() for b in arm.bones}
# "share": { "<bone>": [ [bone, fraction], ... ] }   a pose's turn of that bone is spread over a chain (fractions summing to 1);
#          its move and scale stay on the bone itself
SHARE = spec.get('share', {})
# "clavicles": [ { "bone", "target": hand control, "rest": [x,y,z] where the wrist rests, "k": share, "max": degrees } ]
#          each key turns the collarbone a share of the way toward where the hand is reaching, seen from the chest (a
#          shrug when the hand is high, the shoulder rolling forward into a reach and back as the arm goes behind)
AUTO_CLAV = spec.get('clavicles', [])
# "toes": [ { "bone", "foot": foot bone, "floor": rest height of the tip above the floor, "near": height } ]   while the ball of
#          the foot is within "near" of the floor, the toes bend up just enough to keep their tip on or above it (push-off, landing)
AUTO_TOE = spec.get('toes', [])
lastq = {}
def turn_of(bname, tr):
    D = delta(tr.get('rot', [0, 0, 0]))
    if tr.get('qb'): D = D @ Quaternion(tr['qb']).to_matrix()   # a turn given directly in Blender's axes (motion capture, tools/blender/mocap.py); "rot" adds on top
    if tr.get('aim'):
        tgt = conv(tr['aim']).normalized(); A = restdir[bname].rotation_difference(tgt).to_matrix()
        if tr.get('twist'): A = Quaternion(tgt, math.radians(tr['twist'])).to_matrix() @ A
        D = D @ A
    if tr.get('spin'):   # "spin": degrees about the bone's own rest line (a forearm or wrist turning the palm over)
        D = D @ Quaternion(restdir[bname], math.radians(tr['spin'])).to_matrix()
    return D
def put(bname, D, tr, fb):
    pb = rig.pose.bones[bname]; R = rest[bname]
    q = (R.inverted() @ D @ R).to_quaternion()
    if bname in lastq and lastq[bname].dot(q) < 0: q.negate()   # keep to the near side of the last key, so a turn goes the short way round
    lastq[bname] = q.copy(); pb.rotation_quaternion = q
    pb.location = R.inverted() @ conv(tr.get('move', [0, 0, 0]))
    pb.scale = bone_scale(R, tr.get('scale', [1, 1, 1]))
    pb.keyframe_insert('rotation_quaternion', frame=fb); pb.keyframe_insert('location', frame=fb); pb.keyframe_insert('scale', frame=fb)
def frame_delta(bn):   # how far a bone has turned from rest, in the armature's axes
    return (rig.pose.bones[bn].matrix.to_3x3().normalized() @ arm.bones[bn].matrix_local.to_3x3().inverted()).to_quaternion()
# "meet": { "<clip>": { "at": [t0, t1], "fade": seconds, "gap": metres, "hands": [right, left], "targets": [right, left] } }
#          a true clap: between t0 and t1 the two wrists are brought level, side by side "gap" apart (bone line to bone
#          line, so the palms press flat together), and each hand is turned palm in (its own +x), fingers pointing forward;
#          over the last "fade" seconds it lets go into the clip's own motion
MEET = spec.get('meet', {})
_palm = {}
def palm_normal(bone, sg):
    """which way the palm faces, in the hand bone's own axes: the flattest direction of the hand's own vertices (the
    palm and fingers together), turned toward the body (at rest, in the A-pose, the palms face the thighs)"""
    if bone in _palm: return _palm[bone]
    import numpy as np
    me = mesh; gi = me.vertex_groups[bone].index; Mi = arm.bones[bone].matrix_local.inverted(); W = me.matrix_world
    pts = [Mi @ (W @ v.co) for v in me.data.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)]
    P = np.array([p[:] for p in pts]); P -= P.mean(0); ev, evec = np.linalg.eigh(P.T @ P); n = Vector(evec[:, 0])
    inward = arm.bones[bone].matrix_local.to_3x3().inverted() @ (RIGHT * sg)
    if n.dot(inward) < 0: n = -n
    _palm[bone] = n; print('rig: %s palm faces %s in its own axes' % (bone, tuple(round(c, 2) for c in n))); return n
def palms(c, f, t):
    t0, t1 = c['at']; fade = c.get('fade', 0.15)
    w = 0.0 if t < t0 - 1e-6 or t > t1 + 1e-6 else min(1.0, (t1 - t) / fade) if fade > 0 else 1.0
    hr, hl = (rig.pose.bones[n] for n in c['hands']); tr_, tl = (rig.pose.bones[n] for n in c['targets'])
    if w > 0:
        a, b_ = hr.head.copy(), hl.head.copy(); m = (a + b_) / 2; g = c['gap'] / 2
        m.y = max(a.y, b_.y) + 0.02   # level at the shorter reach (forward is -y), a little inside it so both arms get there
        for tb, want in ((tr_, m - RIGHT * g), (tl, m + RIGHT * g)):
            tgt = tb.head.lerp(want, w)
            tb.location = arm.bones[tb.name].matrix_local.to_3x3().inverted() @ (tgt - arm.bones[tb.name].head_local)
            tb.keyframe_insert('location', frame=f)
        bpy.context.scene.frame_set(f)
    for pb, sg in ((hr, 1), (hl, -1)):
        if w <= 0: pb.rotation_quaternion = Quaternion(); pb.keyframe_insert('rotation_quaternion', frame=f); continue
        n = palm_normal(pb.name, sg); yl = Vector((0, 1, 0)); n = (n - yl * n.dot(yl)).normalized()
        Bl = Matrix((n, yl, n.cross(yl))).transposed()                       # palm, finger line, side: in the bone's own axes
        tn = RIGHT * sg; Bt = Matrix((tn, FWD, tn.cross(FWD))).transposed()   # where they should point: palm in, fingers ahead
        Wd = (Bt @ Bl.transposed()).to_quaternion()
        cur = pb.matrix.to_quaternion(); want = cur.slerp(Wd, w)
        M4 = want.to_matrix().to_4x4(); M4.translation = pb.matrix.translation; pb.matrix = M4
        pb.keyframe_insert('rotation_quaternion', frame=f)
def automatic(state, f, cname=None, t=0.0):
    bpy.context.scene.frame_set(f)   # the keys just made, evaluated (with the IK), so the reach and the feet are where this key puts them
    mc = MEET.get(cname)
    if mc: palms(mc, f, t)
    for c in AUTO_CLAV:
        if c['bone'] in state: continue
        par = arm.bones[c['bone']].parent.name; X = frame_delta(par); Xm = rig.pose.bones[par].matrix
        H = arm.bones[c['bone']].head_local
        # the hand target as the chest at rest would see it
        p = arm.bones[par].matrix_local @ Xm.inverted() @ rig.pose.bones[c['target']].head
        q = (conv(c['rest']) - H).rotation_difference(p - H)
        ang = min(q.angle * c.get('k', 0.3), math.radians(c.get('max', 25)))
        Dc = Quaternion(q.axis, ang).to_matrix() if q.angle > 1e-5 else Matrix.Identity(3)
        put(c['bone'], Dc, {}, f)
    if mc and AUTO_CLAV:   # the collarbones moved the arms: turn the hands again from where the forearms now are
        bpy.context.scene.frame_set(f); palms(mc, f, t)
    for c in AUTO_TOE:
        if c['bone'] in state: continue
        ft = c['foot']; X = frame_delta(ft); Xi = X.inverted()
        Mf = rig.pose.bones[ft].matrix; Mf0 = arm.bones[ft].matrix_local
        tb = arm.bones[c['bone']]; ball = Mf @ Mf0.inverted() @ tb.head_local; tip = Mf @ Mf0.inverted() @ tb.tail_local
        Ma = rig.pose.bones['all'].matrix @ arm.bones['all'].matrix_local.inverted(); n = (Ma.to_3x3() @ UP).normalized(); o = Ma @ Vector((0, 0, 0))
        ht = lambda v: (v - o).dot(n)
        best = 0.0
        if ht(ball) < c.get('near', 0.08) and ht(tip) < c['floor']:
            ax = (Mf.to_3x3().normalized() @ Mf0.to_3x3().inverted() @ RIGHT).normalized(); v = tip - ball
            for sgn in (1, -1):
                for d in range(2, 72, 2):
                    if ht(ball + Quaternion(ax, sgn * math.radians(d)) @ v) >= c['floor']:
                        if not best or d < abs(best): best = sgn * d
                        break
        Qw = Quaternion(ax, math.radians(best)) if best else Quaternion()
        put(c['bone'], (Xi @ Qw @ X).to_matrix(), {}, f)
ad = rig.animation_data_create(); scene = bpy.context.scene; last = 1
for name, clip in spec.get('clips', {}).items():
    fps = clip.get('fps', 30); scene.render.fps = fps
    act = bpy.data.actions.new(name); ad.action = act
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion(); pb.location = Vector(); pb.scale = Vector((1, 1, 1))
    state = {}; lastq.clear(); eases = []; prevf = None; prevb = {}; beases = []
    for key in clip['keys']:
        f = round(key['t'] * fps) + 1; last = max(last, f)
        if key.get('reset'): state = {b: {} for b in state}
        if key.get('use'):
            for u in ([key['use']] if isinstance(key['use'], str) else key['use']): state.update(spec['poses'][u])
        state.update(key.get('pose', {}))
        # "lag": { bone: frames } keys those bones that many frames later than the key's time (overlap: the hips lead, the
        # chest, arms and tool follow); the bone's own ease from its previous key comes with it
        lag = key.get('lag', {})
        for bname, tr in state.items():
            fb = f + int(lag.get(bname, 0))
            if bname in prevb and fb <= prevb[bname]: fb = prevb[bname] + 1
            if key.get('in') and bname in prevb and bname in lag: beases.append((bname, prevb[bname], key['in']))
            prevb[bname] = fb; last = max(last, fb)
            if bname in SHARE:   # the turn spread over a chain of bones (a spine that curves, a neck that bends with the head)
                Dq = turn_of(bname, tr).to_quaternion()
                for tb, fr in SHARE[bname]:
                    put(tb, Quaternion().slerp(Dq, fr).to_matrix(), tr if tb == bname else {}, fb)
                continue
            put(bname, turn_of(bname, tr), tr, fb)
        if AUTO_CLAV or AUTO_TOE or name in MEET: automatic(state, f, name, key['t'])
        if key.get('in') and prevf is not None: eases.append((prevf, key['in']))
        prevf = f
    fcs = fcurves_of(act)
    def ease_at(fc, fr, kind):
        ip, ez = EASE[kind]
        for kp in fc.keyframe_points:
            if abs(kp.co[0] - fr) < 0.5:
                kp.interpolation = ip; kp.easing = ez
                if ip == 'BACK': kp.back = 1.4
    for fr, kind in eases:
        for fc in fcs: ease_at(fc, fr, kind)
    for bname, fr, kind in beases:
        for fc in fcs:
            if ('"%s"' % bname) in fc.data_path: ease_at(fc, fr, kind)
    track = ad.nla_tracks.new(); track.name = name; track.strips.new(name, int(opt.get('start', 1)), act); ad.action = None
    print('rig: clip %s, %d keys%s' % (name, len(clip['keys']), (', %d eased' % len(eases)) if eases else ''))
for pb in rig.pose.bones: pb.rotation_quaternion = Quaternion(); pb.location = Vector(); pb.scale = Vector((1, 1, 1))
scene.frame_start = 1; scene.frame_end = last

if opt.get('shots'):   # pictures of chosen clips at chosen times, from her right side with her front to the right of the picture
    import os
    shots = json.load(open(opt['shots'], encoding='utf-8')); sdir = opt.get('shotdir', '.'); os.makedirs(sdir, exist_ok=True)
    view = shots.get('view', 'side'); span = shots.get('span', 3.4); cy = shots.get('cy', 1.0); cz = shots.get('cz', 0.3)
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = span; co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co)
    if view == 'front': co.location = conv([0, cy, 20]); co.rotation_euler = (math.radians(90), 0, 0)
    elif view == 'top': co.location = conv([0, 20, cz]); co.rotation_euler = (0, 0, math.radians(90))
    else: co.location = conv([-20, cy, cz]); co.rotation_euler = (math.radians(90), 0, math.radians(-90))
    cam.clip_end = 100; scene.camera = co; scene.render.engine = 'BLENDER_WORKBENCH'; scene.render.resolution_x = scene.render.resolution_y = shots.get('size', 360); scene.render.film_transparent = False
    sh = scene.display.shading; sh.light = 'FLAT'; sh.color_type = 'TEXTURE'; sh.show_object_outline = True
    if scene.world is None: scene.world = bpy.data.worlds.new('w')
    scene.world.color = (0.9, 0.9, 0.9)
    st = int(opt.get('start', 1))
    for cname, times in shots['clips'].items():
        for tr in ad.nla_tracks: tr.mute = tr.name != cname
        fps = spec['clips'][cname].get('fps', 30)
        for n, tsec in enumerate(times):
            scene.frame_set(st + round(tsec * fps)); scene.render.filepath = os.path.join(sdir, '%s_%02d.png' % (cname, n)); bpy.ops.render.render(write_still=True)
    for tr in ad.nla_tracks: tr.mute = False
    bpy.data.objects.remove(co, do_unlink=True)
    print('rig: shots in ' + sdir)
if opt.get('blend'):   # also keep the rigged, animated scene as a .blend, for opening and editing in Blender
    bpy.ops.wm.save_as_mainfile(filepath=opt['blend'])
    print('rig: saved ' + opt['blend'])
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_skins=True, export_yup=True, export_frame_range=False, export_force_sampling=True, export_def_bones=True)
print('rig: wrote ' + opt['out'])
