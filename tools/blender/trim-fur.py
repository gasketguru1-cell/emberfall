# Shortens fur of one colour on a GLB. Each vertex of that colour further than r0 from a core line (the neck, say) is drawn
# in toward the line: its distance beyond r0 is kept at the fraction --keep. It is one smooth squeeze, so every lock keeps its
# shape and only gets shorter; fur within r0 (the roots) does not move.
#   blender -b --factory-startup --python tools/blender/trim-fur.py -- --glb in.glb --out out.glb --core x,y,z,x,y,z [--r0 0.17]
#       [--rmax 0.5: fur further than this from the line is not part of it] [--keep 0.5] [--smin 0 --smax 0.22 --vmin 0.62]    (core and positions in model axes: x his left, y up, z forward)
#   Colour test is on the base-colour texture: saturation in [smin, smax] and value >= vmin (white fur by default).
import bpy, sys, colorsys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
keep = float(opt.get('keep', 0.55)); smin, smax, vmin = float(opt.get('smin', 0)), float(opt.get('smax', 0.22)), float(opt.get('vmin', 0.62))
core = [float(x) for x in opt['core'].split(',')]; r0 = float(opt.get('r0', 0.17)); rmax = float(opt.get('rmax', 0.5))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['glb'])
o = next(o for o in bpy.context.scene.objects if o.type == 'MESH'); me = o.data
img = next(n.image for m in me.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'base' in (n.image.name.lower() + n.label.lower() + 'base'))
W, H = img.size; px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
uv = me.uv_layers.active.data; n = len(me.vertices); vuv = np.zeros((n, 2)); seen = np.zeros(n, bool)
for lp in me.loops:
    if not seen[lp.vertex_index]: vuv[lp.vertex_index] = uv[lp.index].uv; seen[lp.vertex_index] = True
fur = np.zeros(n, bool)
for i in range(n):
    u, v = vuv[i] % 1.0; c = px[min(H - 1, int(v * H)), min(W - 1, int(u * W))]
    h, s, val = colorsys.rgb_to_hsv(*c[:3]); fur[i] = smin <= s <= smax and val >= vmin
nb = [[] for _ in range(n)]
for e in me.edges: x, y = e.vertices; nb[x].append(y); nb[y].append(x)
fur = np.array([fur[i] and (not nb[i] or sum(fur[j] for j in nb[i]) * 2 >= len(nb[i])) for i in range(n)])   # a lone light vertex is a highlight, not fur
co = np.array([v.co for v in me.vertices])
A = np.array([core[0], -core[2], core[1]]); Bv = np.array([core[3], -core[5], core[4]]); ab = Bv - A   # model axes -> Blender
d = np.zeros((n, 3))
for i in np.nonzero(fur)[0]:
    t = np.clip(np.dot(co[i] - A, ab) / np.dot(ab, ab), 0, 1); c = A + ab * t; off = co[i] - c; r = np.linalg.norm(off)
    if r0 < r < rmax: d[i] = off / r * (r0 + (r - r0) * keep) - off
for i in np.nonzero(fur)[0]: me.vertices[i].co = co[i] + d[i]
me.update()
print('trim-fur: %d of %d vertices are fur; beyond r0 %.2f kept at %.0f%% (mean move %.3f, max %.3f)' % (fur.sum(), n, r0, keep * 100, np.linalg.norm(d[fur], axis=1).mean(), np.linalg.norm(d[fur], axis=1).max()))
bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=opt['out'], use_selection=True, export_format='GLB')
