# Reduces a GLB's faces to about --faces (collapse decimation, UVs and materials kept) and writes it back out unmoved.
#   blender -b --factory-startup --python tools/blender/decimate.py -- --glb in.glb --out out.glb --faces 90000
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['glb'])
for ob in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons); want = int(opt.get('faces', 90000))
    if n > want:
        m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = want / n
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier=m.name)
    print('decimate: %s %d -> %d triangles' % (ob.name, n, sum(len(p.vertices) - 2 for p in ob.data.polygons)))
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB')
