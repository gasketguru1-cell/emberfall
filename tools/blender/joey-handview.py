# Renders one of Joey's hands straight on (palm, back, and edge on), orthographic at 4 px per mm with the image's centre 95 mm
# down the hand from the wrist, and writes the hand's frame (frame<side>.json) that tools/blender/joey-fingers.py reads.
#   blender -b --factory-startup --python tools/blender/joey-handview.py -- assets/joey/work/titan/human-a.glb assets/joey/work/rig-human.json <outdir> R|L
# (rig-human.json as built with JOEY_PLAIN=1: it reads the old single thumb bone for which side the thumb is on)
import bpy, sys, json, numpy as np, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; glb, specp, outd, side = a
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
B = {b['name']: b for b in json.load(open(specp, encoding='utf-8'))['bones']}
sg = -1 if side == 'R' else 1
toB = lambda p: mathutils.Vector((p[0], -p[2], p[1]))   # model (x,y up,z fwd) -> blender
wri = np.array(B['hand' + side]['head']); knu = np.array(B['hand' + side]['tail']); thb = np.array(B['thumb' + side]['head'])
P = []
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        for v in o.data.vertices: w = o.matrix_world @ v.co; P.append((w.x, w.z, -w.y))
P = np.array(P); d = knu - wri; L = np.linalg.norm(d); d /= L
rel = P - wri; sp = rel @ d; near = np.linalg.norm(rel - np.outer(sp, d), axis=1); rel = rel[(sp > -0.03) & (sp < 0.22) & (near < 0.09)]; sp = rel @ d
palm = rel[(sp > 0.3 * L) & (sp < 0.9 * L)]; pc = palm - palm.mean(0); ev, V = np.linalg.eigh(pc.T @ pc)
n = V[:, 0]; n -= d * (n @ d); n /= np.linalg.norm(n)
if n[0] * (-sg) < 0: n = -n
w = np.cross(d, n); w /= np.linalg.norm(w)
json.dump({'wri': wri.tolist(), 'd': d.tolist(), 'n': n.tolist(), 'w': w.tolist(), 'L': L}, open(outd + '/frame' + side + '.json', 'w'))
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 800; sc.render.resolution_y = 1000
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.25   # 1000 px tall = 0.25 m -> 4 px/mm
centre = wri + d * 0.095
for nm, look, up in (('palm', n, -d), ('back', -n, -d), ('edge', w, -d)):
    # camera sits on the side 'look' points to, looking back at the hand; image up = -d (fingers point down the image)
    pos = centre + look * 0.5; cam.location = toB(pos)
    f = toB(-look); u = toB(up); r = f.cross(u)
    cam.matrix_world = mathutils.Matrix(((r.x, u.x, -f.x, cam.location.x), (r.y, u.y, -f.y, cam.location.y), (r.z, u.z, -f.z, cam.location.z), (0, 0, 0, 1)))
    sc.render.filepath = outd + '/hand' + side + '-' + nm + '.png'; bpy.ops.render.render(write_still=True)
print('HR done', 'image x right =', 'r', 'centre sp 0.095')
