# Turns a head (with whatever it carries: horn, ears, the top of the mane) about a vertical axis through the neck, fading the
# turn out down the neck and toward the back, so the body and tail do not move. For a model sculpted looking to one side.
#   blender -b --factory-startup --python tools/blender/turn-head.py -- --glb in.glb --out out.glb --deg -79 --axis x,z
#       [--y0 1.0 --y1 1.18: the turn fades in between these heights] [--z0 -0.02 --z1 0.12: and between these depths]
#   Model axes: x his left, y up, z forward. A positive --deg turns +z toward +x (to his left); negative turns him to his right.
#   The same weights and turn are in tools/bones/nib.mjs (turnHead), so bone positions measured before the turn can follow it.
import bpy, sys, math, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
deg = float(opt['deg']); ax, az = (float(v) for v in opt['axis'].split(','))
y0, y1, z0, z1 = (float(opt.get(k, d)) for k, d in (('y0', 1.0), ('y1', 1.18), ('z0', -0.02), ('z1', 0.12)))
def smooth(e0, e1, v): t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['glb'])
o = next(o for o in bpy.context.scene.objects if o.type == 'MESH'); me = o.data
co = np.array([v.co for v in me.vertices]); x, y, z = co[:, 0], co[:, 2], -co[:, 1]   # Blender -> model axes
w = smooth(y0, y1, y) * smooth(z0, z1, z); th = np.radians(deg) * w
rx, rz = x - ax, z - az; nx = ax + rx * np.cos(th) + rz * np.sin(th); nz = az - rx * np.sin(th) + rz * np.cos(th)
for i, v in enumerate(me.vertices): v.co = (nx[i], -nz[i], y[i])
me.update()
print('turn-head: %d of %d vertices turned (fully: %d), %.1f degrees about x %.2f z %.2f' % ((w > 0.001).sum(), len(co), (w > 0.999).sum(), deg, ax, az))
bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=opt['out'], use_selection=True, export_format='GLB')
