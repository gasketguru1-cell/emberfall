# Reads a Mixamo motion (FBX, "Without Skin") into what Knell's pose solver (anim.js / solve.js) takes, frame by frame:
#   q      the hips' turn from rest (the whole body's turn: a flip, a spin), model axes, [w, x, y, z]
#   hp     the hips' move from rest, metres, scaled to Knell's legs
#   chest  the chest's turn on the hips (Spine2 from Hips); head the head's on the chest
#   fL/fR  each ankle from the hips joint, in the hips' own frame, scaled by leg length; fqL/fqR the foot's turn on the hips
#   hL/hR  each wrist from its shoulder, in the chest's own frame, scaled by arm length
# Model axes: metres, x his left, y up, z forward. Only the body's shape is taken; the dagger is placed from the hitboxes.
#   blender -b --factory-startup --python tools/blender/knell/mocap.py -- --out assets/knell/mocap --leg 0.93 --arm 0.6 file.fbx ...
import bpy, sys, json, os

args = sys.argv[sys.argv.index('--') + 1:]
opt, files = {}, []
i = 0
while i < len(args):
    if args[i].startswith('--'): opt[args[i][2:]] = args[i + 1]; i += 2
    else: files.append(args[i]); i += 1
LEG, ARM = float(opt['leg']), float(opt['arm'])
bm = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]              # Blender vector -> model
qm = lambda q: [round(q.w, 5), round(q.x, 5), round(q.z, 5), round(-q.y, 5)]   # Blender quaternion -> model axes
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
    m_arm = (rpos('RightForeArm') - rpos('RightArm')).length + (rpos('RightHand') - rpos('RightForeArm')).length
    m_leg = rpos('Hips')[2] - (rpos('LeftFoot')[2] + rpos('RightFoot')[2]) / 2
    kl, ka = LEG / m_leg, ARM / m_arm
    frames = []
    for fr in range(f0, f1 + 1):
        bpy.context.scene.frame_set(fr)
        P = {pb.name: W @ pb.matrix for pb in arm.pose.bones}
        qd = lambda n: (P[B(n)].to_quaternion() @ rest[B(n)].to_quaternion().inverted()).normalized()
        pos = lambda n: P[B(n)].translation
        Qh, Qc = qd('Hips'), qd('Spine2')
        k = {'q': qm(Qh), 'hp': bm((pos('Hips') - rpos('Hips')) * kl), 'chest': qm(Qh.inverted() @ Qc), 'head': qm(Qc.inverted() @ qd('Head'))}
        for s, side in (('L', 'Left'), ('R', 'Right')):
            k['f' + s] = bm(Qh.inverted() @ (pos(side + 'Foot') - pos('Hips')) * kl)
            k['fq' + s] = qm(Qh.inverted() @ qd(side + 'Foot'))
            k['h' + s] = bm(Qc.inverted() @ (pos(side + 'Hand') - pos(side + 'Arm')) * ka)
        frames.append(k)
    name = os.path.splitext(os.path.basename(f))[0].replace(' ', '_').replace('(', '').replace(')', '')
    json.dump({'source': os.path.basename(f), 'fps': bpy.context.scene.render.fps, 'frames': frames}, open(os.path.join(opt['out'], name + '.json'), 'w'), separators=(',', ':'))
    print('mocap: %s, %d frames at %d, leg x%.2f, arm x%.2f' % (name, len(frames), bpy.context.scene.render.fps, kl, ka))
