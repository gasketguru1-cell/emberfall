# Joey's finger joints, into assets/joey/work/human-fingers.json (tools/blender/joey.js builds his fingers from it).
# Each finger's line (LINES: pixel points, base knuckle to tip) was read off the palm renders made by
# tools/blender/joey-handview.py (4 px per mm, image centre 95 mm down the hand); the joints are the centres of the finger's
# cross-sections at set fractions along that line. It also marks the joints on the renders (dots<side>-<view>.png) to check.
#   blender -b --factory-startup --python tools/blender/joey-fingers.py -- assets/joey/work/titan/human-a.glb <renders dir> assets/joey/work/human-fingers.json <renders dir>
import bpy, sys, json, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; glb, framed, outp, drawd = a
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
P = []
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        for v in o.data.vertices: w = o.matrix_world @ v.co; P.append((w.x, w.z, -w.y))
P = np.array(P)
LINES = {'R': {'index': ((285, 450), (292, 865)), 'middle': ((405, 455), (432, 915)), 'ring': ((500, 440), (590, 830)), 'pinky': ((580, 400), (705, 630)), 'thumb': ((330, 200), (265, 445))},
         'L': {'index': ((515, 455), (515, 850)), 'middle': ((390, 470), (355, 905)), 'ring': ((285, 450), (215, 820)), 'pinky': ((210, 400), (85, 625)), 'thumb': ((430, 190), (545, 440))}}
FR = {'thumb': (0, 0.42, 0.72, 0.93)}
res = {}
for s in ('R', 'L'):
    F = json.load(open(framed + '/frame' + s + '.json')); wri, d, n, w = (np.array(F[k]) for k in ('wri', 'd', 'n', 'w'))
    rel = P - wri; pw, psp, pn = rel @ w, rel @ d, rel @ n
    pix = lambda x, y: np.array([-(x - 400) / 4000, 0.095 + (y - 500) / 4000])   # -> (w, sp)
    out = {}; dots = []
    for f, (b, t) in LINES[s].items():
        A, Bt = pix(*b), pix(*t); u = Bt - A; Ln = np.linalg.norm(u); u /= Ln; perp = np.array([-u[1], u[0]])
        q = np.stack([pw, psp], 1) - A; al = q @ u; pe = q @ perp
        js = []
        for fr in FR.get(f, (0, 0.4, 0.65, 0.96)):
            m = (np.abs(al - fr * Ln) < 0.0025) & (np.abs(pe) < (0.012 if f != 'thumb' else 0.014))
            if f != 'thumb': m &= pn < 0.03                     # the thumb lies over the index's knuckle on the palm side
            elif fr > 0.1: m &= pn > 0.025                      # the thumb's own flesh, clear of the palm
            c = rel[m].mean(0)
            if f == 'thumb' and fr == 0: c = c - n * ((c @ n) - 0.015)   # its root joint sits inside the ball of the thumb
            js.append(c + wri); dots.append((c @ w, c @ d, c @ n))
        out[f] = [j.round(4).tolist() for j in js]
        print('J', s, f, int(m.sum()), [[round(x, 3) for x in j] for j in js])
    out['palm'] = (n if s == 'R' else n).round(3).tolist()
    # palm normal facing the palm (fingers curl this way); fingers.py convention: faces the body at rest
    if out['palm'][0] * (1 if s == 'R' else -1) < 0: out['palm'] = [-x for x in out['palm']]
    res[s] = out
    for view in ('palm', 'edge'):
        im = bpy.data.images.load(drawd + '/hand' + s + '-' + view + '.png'); W, H = im.size; px = np.array(im.pixels[:]).reshape(H, W, 4)
        for (cw, cs, cn) in dots:
            x = int(400 - cw * 4000) if view == 'palm' else int(400 + cn * 4000); y = int(500 + (cs - 0.095) * 4000); yy = H - 1 - y
            px[max(0, yy - 4):yy + 5, max(0, x - 4):x + 5] = (0.1, 1, 0.2, 1)
        im.pixels[:] = px.ravel(); im.filepath_raw = drawd + '/dots' + s + '-' + view + '.png'; im.file_format = 'PNG'; im.save()
json.dump(res, open(outp, 'w'), indent=1)
