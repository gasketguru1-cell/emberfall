# Gives a prepared character GLB a farmer's tan and brings its skin to a set, game-friendly pair of tones: face, neck,
# forearms and hands tanned; chest, back, upper arms (to a T-shirt sleeve) and legs pale. Only skin-coloured texels
# change (the red cap, hair, shorts and eyes keep their colours); the texture's own shading is kept.
#   blender -b --factory-startup --python tools/blender/farmtan.py -- --in in.glb --spec rig.json --out out.glb
#       [--tan r,g,b] [--pale r,g,b]   sRGB 0..255   [--sleeve 0.42]  how far down the upper arm the sleeve ends
# The body regions come from the skeleton in the rig spec (tools/blender/joey.js): each vertex belongs to its nearest bone.
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; opt = {a[i].lstrip('-'): a[i + 1] for i in range(0, len(a), 2)}
spec = json.load(open(opt['spec'], encoding='utf-8'))
TAN = np.array([float(v) / 255 for v in opt.get('tan', '168,110,77').split(',')]); PALE = np.array([float(v) / 255 for v in opt.get('pale', '219,179,153').split(',')])
SLEEVE = float(opt.get('sleeve', 0.42))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=opt['in'])
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]; me = ob.data
mat = me.materials[0]; nt = mat.node_tree
tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links)); img = tex.image
W, H = img.size; print('farmtan: %d verts, texture %dx%d' % (len(me.vertices), W, H))

# ---- which part of the body each vertex is: nearest deform bone ----
bones = [b for b in spec['bones'] if b.get('deform', True) and not b['name'].startswith('c_') and b['name'] != 'all' and 'Tw' not in b['name'] and not b['name'].startswith(('elbow', 'knee', 'delt')) and not b.get('noauto')]   # helpers overlap their limb bones: leave them out
segs = [(b['name'], np.array(b['head']), np.array(b['tail'])) for b in bones]
neckY = next(b['head'][1] for b in bones if b['name'] == 'head')
co = np.array([(ob.matrix_world @ v.co)[:] for v in me.vertices]); P = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)   # model x, y up, z forward
D = np.empty((len(P), len(segs))); Tp = np.empty_like(D)
for j, (n, h, t) in enumerate(segs):
    ab = t - h; tt = np.clip(((P - h) @ ab) / max(1e-9, ab @ ab), 0, 1); D[:, j] = np.linalg.norm(P - (h + tt[:, None] * ab), axis=1); Tp[:, j] = tt
near = D.argmin(1); names = [s[0] for s in segs]
def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
tan = np.zeros(len(P))
collar = sm((P[:, 1] - (neckY - 0.06)) / 0.04)            # the neck above a crew collar
for j, n in enumerate(names):
    m = near == j
    if n.startswith(('fore', 'hand', 'fing', 'thumb', 'index', 'middle', 'ring', 'pinky')): tan[m] = 1
    elif n.startswith('arm'): tan[m] = sm((Tp[m, j] - SLEEVE) / 0.08 + 0.5)
    elif not n.startswith(('thigh', 'shin', 'foot', 'toe', 'glute')): tan[m] = collar[m]   # head, face, neck, torso: tanned above the collar
print('farmtan: tanned share of the vertices %.2f' % tan.mean())

# ---- bake the mask into the texture's layout ----
attr = me.color_attributes.new('tan', 'FLOAT_COLOR', 'POINT')
for i, v in enumerate(tan): attr.data[i].color = (v, v, v, 1)
mask_img = bpy.data.images.new('tanmask', W, H, float_buffer=True); mask_img.colorspace_settings.name = 'Non-Color'
an = nt.nodes.new('ShaderNodeAttribute'); an.attribute_name = 'tan'; em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(an.outputs['Color'], em.inputs['Color'])
out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'); old = out.inputs['Surface'].links[0].from_socket; nt.links.new(em.outputs[0], out.inputs['Surface'])
mn = nt.nodes.new('ShaderNodeTexImage'); mn.image = mask_img; nt.nodes.active = mn
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'CPU'
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.bake(type='EMIT', margin=16)
mask = np.array(mask_img.pixels[:], dtype=np.float32).reshape(H, W, 4)[:, :, 0]
nt.links.new(old, out.inputs['Surface']); [nt.nodes.remove(n) for n in (an, em, mn)]; me.color_attributes.remove(me.color_attributes['tan'])

# ---- recolour the skin ----
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, -1); rgb = px[:, :, :3]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; mx = rgb.max(-1); mnv = rgb.min(-1); s = (mx - mnv) / np.maximum(mx, 1e-6)
hue = np.where(mx == r, ((g - b) / np.maximum(mx - mnv, 1e-6)) * 60, np.where(mx == g, (2 + (b - r) / np.maximum(mx - mnv, 1e-6)) * 60, (4 + (r - g) / np.maximum(mx - mnv, 1e-6)) * 60)) % 360
w = sm((hue - 6) / 6) * sm((50 - hue) / 10) * sm((s - 0.1) / 0.08) * sm((mx - 0.1) / 0.08) * (1 - sm((s - 0.72) / 0.1))   # skin: orange-brown, not the red cap, not grey, not black
L = r * 0.3 + g * 0.59 + b * 0.11; Lm = np.median(L[w > 0.8]) if (w > 0.8).any() else 0.5
target = PALE[None, None, :] * (1 - mask[..., None]) + TAN[None, None, :] * mask[..., None]
new = np.clip(target * (np.clip(L / Lm, 0, 3) ** 0.8)[..., None], 0, 1)
rgb[:] = rgb * (1 - w[..., None]) + new * w[..., None]
print('farmtan: skin texels %.0f%% of the texture, middle brightness %.2f' % ((w > 0.5).mean() * 100, Lm))
img.pixels.foreach_set(px.ravel()); img.pack()
if opt.get('preview'): mask_img.filepath_raw = opt['preview']; mask_img.file_format = 'PNG'; mask_img.save()
bpy.data.images.remove(mask_img)
bpy.ops.export_scene.gltf(filepath=opt['out'], export_format='GLB', export_yup=True, export_apply=True)
print('farmtan: wrote ' + opt['out'])
