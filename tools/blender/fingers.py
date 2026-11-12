# Finds each finger's joints on an A-pose hand from the mesh (tools/blender/joey.js reads the result for Cronky Dong's skeleton).
#   blender -b --factory-startup --python tools/blender/fingers.py -- assets/joey/work/titan/big-a.glb assets/joey/work/rig-big.json assets/joey/work/big-fingers.json
# The bands across the hand and each finger's span from knuckle to tip were read off a plot of the hand's vertices in its own frame.
# finds the four fingers and the thumb of each hand from the mesh: verts past the knuckles split into four along the hand's width
import bpy, sys, json, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; glb, specp, outp = a
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
spec = json.load(open(specp, encoding='utf-8')); B = {b['name']: b for b in spec['bones']}
P = []
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        for v in o.data.vertices: w = o.matrix_world @ v.co; P.append((w.x, w.z, -w.y))
P = np.array(P); res = {}
for s, sg in (('R', -1), ('L', 1)):
    wri = np.array(B['hand' + s]['head']); knu = np.array(B['hand' + s]['tail']); tht = np.array((B.get('thumb' + s) or B['thumb' + s + '3'])['tail']); thb = np.array((B.get('thumb' + s) or B['thumb' + s + '1'])['head'])
    d = knu - wri; L = np.linalg.norm(d); d /= L
    rel = P - wri; sp = rel @ d; near = np.linalg.norm(rel - np.outer(sp, d), axis=1)
    hand = P[(sp > -0.02) & (sp < L + 0.25) & (near < 0.16) & (P[:, 0] * sg > 0.55)]
    rel = hand - wri; sp = rel @ d
    palm = rel[(sp > 0.3 * L) & (sp < 0.9 * L)]; pc = palm - palm.mean(0); ev, V = np.linalg.eigh(pc.T @ pc)
    n = V[:, 0]; n -= d * (n @ d); n /= np.linalg.norm(n)
    if n[0] * (-sg) < 0: n = -n          # palm faces the body at rest
    w = np.cross(d, n); w /= np.linalg.norm(w)
    if (thb - wri) @ w < 0: w = -w       # w points to the thumb side
    fing = rel[sp > L - 0.005]
    # the thumb: verts nearer its line than the knuckle line, on the thumb side
    tv = rel[((rel @ w) > 0.6 * ((knu - wri) @ w + 0.06)) & (sp < L + 0.02)]
    fing = fing[(fing @ n) < 0.06]; fw = fing @ w
    bounds = [-0.135, -0.073, -0.015, 0.048, 0.11]   # read off the hand plot: the gaps between the fingers, across the hand
    names = ['pinky', 'ring', 'middle', 'index']  # from the far side to the thumb side
    out = {}
    SPAN = {'pinky': (0.19, 0.254), 'ring': (0.21, 0.279), 'middle': (0.215, 0.333), 'index': (0.21, 0.31)}   # knuckle joint to fingertip, along the hand (plot)
    allh = rel[(rel @ n) < 0.06]; aw = allh @ w; asp = allh @ d
    for i, nm in enumerate(names):
        band = allh[(aw >= bounds[i]) & (aw < bounds[i + 1])]; bsp = asp[(aw >= bounds[i]) & (aw < bounds[i + 1])]
        s0, s1 = SPAN[nm]
        def cen(x, h=0.006):
            m = np.abs(bsp - x) < h
            return band[m].mean(0)
        tip = band[bsp > s1 - 0.012]; tip = tip.mean(0) if len(tip) else cen(s1 - 0.005)
        js = [cen(s0), cen(s0 + 0.45 * (s1 - s0)), cen(s0 + 0.75 * (s1 - s0)), tip]
        out[nm] = [(j + wri).round(4).tolist() for j in js]
        print('fingers', s, nm, len(band), [[round(x, 3) for x in p] for p in out[nm]])
    out['thumb'] = [thb.tolist(), (thb + (tht - thb) * 0.4).round(4).tolist(), (thb + (tht - thb) * 0.72).round(4).tolist(), tht.tolist()]
    out['palm'] = n.round(3).tolist(); res[s] = out
json.dump(res, open(outp, 'w'), indent=1)
