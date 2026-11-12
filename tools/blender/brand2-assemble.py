# Puts the Gearblade sword into Brand's right hand for the rest pose (blade pointing forward) and writes one GLB with
# two mesh objects, Body and Sword, for tools/blender/rig.py (the spec's "parts" tags the sword so it stays rigid).
#   blender -b assets/brand/work/gearblade.blend --python tools/blender/brand2-assemble.py -- --out assets/brand/work/gearblade-rest.glb
#       [--scale 0.6] [--grip -0.624,-0.10,1.044]
# Grip and scale are in Blender's axes (Z up, -Y forward). The sword's own grip centre was measured on the prepped mesh.
import bpy, sys
from mathutils import Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
scale = float(opt.get('scale', 0.6))
hand = Vector([float(x) for x in opt.get('grip', '-0.624,-0.10,1.044').split(',')])
GRIP = Vector((-0.976, -0.069, 1.62))      # middle of the grip, between the crossguard (z 1.45) and the pommel (z 1.8)

sword = bpy.data.objects['Sword']
# the sword stands tip down (its tip at z 0); turn it so the tip points forward (-Y), keeping the edge in the side plane
M = Matrix.Translation(hand) @ Matrix.Rotation(-1.5708, 4, 'X') @ Matrix.Scale(scale, 4) @ Matrix.Translation(-GRIP)
# Rotation of -90 deg about X takes -Z (toward the tip) to -Y (forward)
sword.data.transform(M); sword.data.update()
cs = [v.co for v in sword.data.vertices]
print('assemble: sword tip at y %.3f, pommel at y %.3f, length %.3f' % (min(c.y for c in cs), max(c.y for c in cs), max(c.y for c in cs) - min(c.y for c in cs)))
for o in bpy.context.scene.objects: o.select_set(o.name in ('Body', 'Sword'))
bpy.ops.export_scene.gltf(filepath=opt['out'], use_selection=True, export_format='GLB')
print('assemble: wrote', opt['out'])
