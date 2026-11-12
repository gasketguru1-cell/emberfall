# Turns a Mixamo motion (FBX, "Without Skin") into per-frame keys for one of our rigs with hand and foot targets
# (Sprocket's kind: hips, spine, chest, head; c_handL/R on the chest; c_footL/R on the floor; an aimed tool). The keys come
# out in rig.py's own form, so a clip in the character's spec can use them as they are, trimmed and retimed by its script.
#   blender -b --factory-startup --python tools/blender/mocap.py -- --spec assets/sprocket/work/rig.json --out dir file.fbx [file.fbx ...]
# writes dir/<file name>.json: { fps, frames: [ { "<bone>": { "qb": [w,x,y,z] } | { "move": [x,y,z] } | { "aim": [x,y,z] } } ] }
# How the capture maps onto a body of other proportions:
#  - the hips, spine, chest and head turn as the capture's hips, spine (to Spine1), chest (to Spine2) and head do;
#  - each hand target sits where the capture's hand is from its shoulder, in the chest's own frame, scaled by arm length;
#  - each foot target and the hips move as the capture's do, scaled by leg length (so a short-legged man takes short steps);
#  - the drift of the hips across the floor over the clip is taken out (the game moves the fighter), the feet with it;
#  - the tool points along the capture's right hand's "forward at rest" (a sword in a fist, thumb ahead), unless --toolaxis.
# Coordinates in the JSON are the model's (x his left, y up, z forward); "qb" is a turn in Blender's axes, which rig.py uses.
import bpy, sys, json, os
from mathutils import Vector, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
opt, files = {}, []
i = 0
while i < len(args):
    if args[i].startswith('--'): opt[args[i][2:]] = args[i + 1]; i += 2
    else: files.append(args[i]); i += 1
spec = json.load(open(opt['spec'], encoding='utf-8'))
conv = lambda p: Vector((p[0], -p[2], p[1]))            # model -> Blender
back = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]   # Blender -> model
bones = {b['name']: b for b in spec['bones']}
head = lambda n: conv(bones[n]['head'])
MIRROR = opt.get('mirror') == '1'   # --mirror 1 writes <name>_M.json, the capture mirrored left for right
tool_axis = Vector(json.loads(opt['toolaxis'])) if opt.get('toolaxis') else Vector((0, -1, 0))

# the rig's own lengths
def seglen(*names): return sum((conv(bones[n]['tail']) - conv(bones[n]['head'])).length for n in names)
S_ARM = {'L': seglen('armL', 'foreL'), 'R': seglen('armR', 'foreR')}
S_LEG = (head('hips')[2] - head('footL')[2])

MAP_ROT = [('hips', None, 'Hips'), ('spine', 'Hips', 'Spine1'), ('chest', 'Spine1', 'Spine2'), ('head', 'Spine2', 'Head')]
os.makedirs(opt['out'], exist_ok=True)
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=f)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    pre = next((b.name.split(':')[0] + ':' for b in arm.data.bones if ':' in b.name), '')
    B = lambda n: pre + n
    act = arm.animation_data.action; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    W = arm.matrix_world
    rest = {b.name: W @ b.matrix_local for b in arm.data.bones}
    rpos = lambda n: rest[B(n)].translation
    m_arm = {s: (rpos(side + 'ForeArm') - rpos(side + 'Arm')).length + (rpos(side + 'Hand') - rpos(side + 'ForeArm')).length for s, side in (('L', 'Left'), ('R', 'Right'))}
    m_leg = rpos('Hips')[2] - (rpos('LeftFoot')[2] + rpos('RightFoot')[2]) / 2
    kleg = S_LEG / m_leg
    frames = []
    for fr in range(f0, f1 + 1):
        bpy.context.scene.frame_set(fr)
        P = {pb.name: W @ pb.matrix for pb in arm.pose.bones}
        qd0 = lambda n: (P[B(n)].to_quaternion() @ rest[B(n)].to_quaternion().inverted()).normalized()   # turn from rest, world axes
        pos0 = lambda n: P[B(n)].translation
        if MIRROR:   # left for right: the capture seen in a mirror across his middle (so a left-hand punch is thrown with the near, right hand)
            sw = lambda n: n.replace('Left', '#').replace('Right', 'Left').replace('#', 'Right')
            qd = lambda n: (lambda q: Quaternion((q.w, q.x, -q.y, -q.z)))(qd0(sw(n)))
            pos = lambda n: (lambda p: Vector((-p.x, p.y, p.z)))(pos0(sw(n)))
        else: qd, pos = qd0, pos0
        k = {}
        for sb, parent, mb in MAP_ROT:
            q = qd(mb) if parent is None else qd(parent).inverted() @ qd(mb)
            k[sb] = {'qb': [round(c, 5) for c in q]}
        k['hips']['move'] = back((pos('Hips') - rpos('Hips')) * kleg)
        cq = qd('Spine2').inverted()
        for s, side in (('L', 'Left'), ('R', 'Right')):
            v = cq @ (pos(side + 'Hand') - pos(side + 'Arm')) * (S_ARM[s] / m_arm[s])
            tgt = head('arm' + s) + v
            k['c_hand' + s] = {'move': back(tgt - head('c_hand' + s))}
            k['c_foot' + s] = {'move': back((pos(side + 'Foot') - rpos(side + 'Foot')) * kleg)}
        k['c_wrench'] = {'aim': back(qd('RightHand') @ tool_axis)}
        frames.append(k)
    # take out the hips' drift over the floor (start to end, straight line), from the hips and both feet alike
    n = len(frames)
    if n > 1 and not opt.get('keepdrift'):
        a, b = frames[0]['hips']['move'], frames[-1]['hips']['move']
        for j, k in enumerate(frames):
            t = j / (n - 1); dx = a[0] + (b[0] - a[0]) * t; dz = a[2] + (b[2] - a[2]) * t
            for nm in ('hips', 'c_footL', 'c_footR'):
                m = k[nm]['move']; k[nm]['move'] = [round(m[0] - dx, 4), m[1], round(m[2] - dz, 4)]
    name = os.path.splitext(os.path.basename(f))[0].replace(' ', '_').replace('(', '').replace(')', '') + ('_M' if MIRROR else '')
    json.dump({'source': os.path.basename(f), 'fps': bpy.context.scene.render.fps, 'frames': frames}, open(os.path.join(opt['out'], name + '.json'), 'w'), separators=(',', ':'))
    print('mocap: %s, %d frames, leg x%.2f, arm x%.2f' % (name, n, kleg, S_ARM['R'] / m_arm['R']))
