# Makes synthetic source animations with a known answer, for testing the retarget pipeline without outside files.
#   blender -b --factory-startup --python tests/retarget/make_samples.py -- --out <dir>
# Three skeletons, each with two actions (Walk: 2 s, feet planted while the hips travel 1.2 m; Spin: 1 s, a full turn):
#   mixamo  Mixamo names, T-pose, centimetres (object scale 0.01), 30 fps, fingers and toes
#   cmu     CMU/BVH names (hip-joint stubs, LowerBack, Neck1), T-pose, facing +X, 24 fps, no fingers
#   odd     names that say nothing ("bone.007"), A-pose, twist helpers, a "prop_01" weapon under the right hand, 25 fps
# Each is written as .fbx (both takes), .glb (both animations), .blend, and one .bvh per action, plus truth.json:
# the world direction of every role's bone and the world position of the hips and feet, at 60 a second.
import bpy, sys, os, math, json
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[args.index('--out') + 1]; os.makedirs(OUT, exist_ok=True)

# joints in metres, Blender axes, facing -Y (left side; right mirrors x)
J = {'hips': (0, 0, 0.95), 'spine': (0, 0, 1.05), 'spine1': (0, 0, 1.18), 'spine2': (0, 0, 1.30), 'neck': (0, 0, 1.48), 'head': (0, 0, 1.58), 'headtop': (0, 0, 1.75),
     'clav': (0.05, 0, 1.42), 'arm': (0.17, 0, 1.42), 'fore': (0.45, 0, 1.42), 'hand': (0.70, 0, 1.42), 'mid1': (0.80, 0, 1.42), 'mid2': (0.86, 0, 1.42),
     'hipj': (0.02, 0, 0.93), 'upleg': (0.09, 0, 0.92), 'leg': (0.09, -0.01, 0.50), 'foot': (0.09, 0, 0.08), 'toe': (0.09, -0.13, 0.02), 'toeend': (0.09, -0.2, 0.02)}
P = lambda k, s=1: Vector((J[k][0] * s, J[k][1], J[k][2]))

def apose(v, s):   # arm joints turned 40 degrees down about the shoulder
    sh = P('arm', s); return sh + Quaternion((0, 1, 0), math.radians(40) * s) @ (v - sh)

STYLES = {
    'mixamo': {'fps': 30, 'unit': 100, 'yaw': 0, 'apose': False},
    'cmu': {'fps': 24, 'unit': 1, 'yaw': 90, 'apose': False},
    'odd': {'fps': 25, 'unit': 1, 'yaw': 0, 'apose': True},
}

def bones_for(style):
    # (name, head, tail, parent, role)   role is what the retarget should find (None for helpers)
    out = []
    def add(n, h, t, p, role=None): out.append((n, h, t, p, role))
    if style == 'mixamo':
        m = lambda s: 'mixamorig:' + s
        add(m('Hips'), P('hips'), P('spine'), None, 'hips'); add(m('Spine'), P('spine'), P('spine1'), m('Hips'), 'spine')
        add(m('Spine1'), P('spine1'), P('spine2'), m('Spine')); add(m('Spine2'), P('spine2'), P('neck'), m('Spine1'), 'chest')
        add(m('Neck'), P('neck'), P('head'), m('Spine2')); add(m('Head'), P('head'), P('headtop'), m('Neck'), 'head')
        add(m('HeadTop_End'), P('headtop'), P('headtop') + Vector((0, 0, 0.05)), m('Head'))
        for side, s in (('Left', 1), ('Right', -1)):
            S = side[0]
            add(m(side + 'Shoulder'), P('clav', s), P('arm', s), m('Spine2')); add(m(side + 'Arm'), P('arm', s), P('fore', s), m(side + 'Shoulder'), 'upperArm.' + S)
            add(m(side + 'ForeArm'), P('fore', s), P('hand', s), m(side + 'Arm'), 'foreArm.' + S); add(m(side + 'Hand'), P('hand', s), P('mid1', s), m(side + 'ForeArm'), 'hand.' + S)
            add(m(side + 'HandMiddle1'), P('mid1', s), P('mid2', s), m(side + 'Hand')); add(m(side + 'HandThumb1'), P('hand', s) + Vector((0.02 * s, -0.04, 0)), P('hand', s) + Vector((0.06 * s, -0.07, 0)), m(side + 'Hand'))
            add(m(side + 'UpLeg'), P('upleg', s), P('leg', s), m('Hips'), 'thigh.' + S); add(m(side + 'Leg'), P('leg', s), P('foot', s), m(side + 'UpLeg'), 'shin.' + S)
            add(m(side + 'Foot'), P('foot', s), P('toe', s), m(side + 'Leg'), 'foot.' + S); add(m(side + 'ToeBase'), P('toe', s), P('toeend', s), m(side + 'Foot'))
    elif style == 'cmu':
        add('Hips', P('hips'), P('hips') + Vector((0, 0, 0.05)), None, 'hips')
        add('LowerBack', P('hips'), P('spine1'), 'Hips', 'spine'); add('Spine', P('spine1'), P('spine2'), 'LowerBack'); add('Spine1', P('spine2'), P('neck'), 'Spine', 'chest')
        add('Neck', P('neck'), P('neck') + Vector((0, 0, 0.05)), 'Spine1'); add('Neck1', P('neck') + Vector((0, 0, 0.05)), P('head'), 'Neck'); add('Head', P('head'), P('headtop'), 'Neck1', 'head')
        for side, s in (('Left', 1), ('Right', -1)):
            S = side[0]
            add(S + 'HipJoint', P('hips'), P('upleg', s), 'Hips'); add(side + 'UpLeg', P('upleg', s), P('leg', s), S + 'HipJoint', 'thigh.' + S)
            add(side + 'Leg', P('leg', s), P('foot', s), side + 'UpLeg', 'shin.' + S); add(side + 'Foot', P('foot', s), P('toe', s), side + 'Leg', 'foot.' + S)
            add(side + 'ToeBase', P('toe', s), P('toeend', s), side + 'Foot')
            add(side + 'Shoulder', P('clav', s), P('arm', s), 'Spine1'); add(side + 'Arm', P('arm', s), P('fore', s), side + 'Shoulder', 'upperArm.' + S)
            add(side + 'ForeArm', P('fore', s), P('hand', s), side + 'Arm', 'foreArm.' + S); add(side + 'Hand', P('hand', s), P('mid1', s), side + 'ForeArm', 'hand.' + S)
    else:
        k = [0]
        def nm(): k[0] += 1; return 'bone' if k[0] == 1 else 'bone.%03d' % (k[0] - 1)
        h = nm(); add(h, P('hips'), P('spine'), None, 'hips')
        sp = nm(); add(sp, P('spine'), P('spine2'), h, 'spine'); ch = nm(); add(ch, P('spine2'), P('neck'), sp, 'chest')
        nk = nm(); add(nk, P('neck'), P('head'), ch); hd = nm(); add(hd, P('head'), P('headtop'), nk, 'head')
        for s, S in ((1, 'L'), (-1, 'R')):
            A = lambda key: apose(P(key, s), s)
            ua = nm(); add(ua, P('arm', s), A('fore'), ch, 'upperArm.' + S)
            tw = nm(); add(tw, P('arm', s), P('arm', s).lerp(A('fore'), 0.15), ua)          # twist helper (a leaf)
            fa = nm(); add(fa, A('fore'), A('hand'), ua, 'foreArm.' + S); ha = nm(); add(ha, A('hand'), A('mid1'), fa, 'hand.' + S)
            fi = nm(); add(fi, A('mid1'), A('mid2'), ha)
            if s == -1: add('prop_01', A('hand'), A('hand') + Vector((0, -0.6, 0)), ha)   # a sword held forward
            th = nm(); add(th, P('upleg', s), P('leg', s), h, 'thigh.' + S); sh = nm(); add(sh, P('leg', s), P('foot', s), th, 'shin.' + S)
            ft = nm(); add(ft, P('foot', s), P('toe', s), sh, 'foot.' + S); to = nm(); add(to, P('toe', s), P('toeend', s), ft)
    return out

def build(style):
    st = STYLES[style]; bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = st['fps']; sc.render.fps_base = 1
    U = st['unit']; arm = bpy.data.armatures.new(style); ob = bpy.data.objects.new(style if style != 'mixamo' else 'Armature', arm)
    sc.collection.objects.link(ob); bpy.context.view_layer.objects.active = ob
    ob.scale = (1 / U,) * 3; ob.rotation_euler = (0, 0, math.radians(st['yaw']))
    bpy.ops.object.mode_set(mode='EDIT'); spec = bones_for(style)
    for n, hh, tt, p, role in spec:
        eb = arm.edit_bones.new(n); eb.head = hh * U; eb.tail = tt * U
        if p: eb.parent = arm.edit_bones[p]; eb.use_connect = (arm.edit_bones[p].tail - eb.head).length < 1e-6
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones: pb.rotation_mode = 'QUATERNION'
    return ob, spec

def roles_of(spec): return {role: n for n, _, _, _, role in spec if role}

FOOTQ = {}   # per-side foot world turns a motion can set; empty = feet follow the facing

def motion(clip, t, T):
    # world turns (in the armature's own facing frame) and positions for the roles, at time t; metres
    q = {}; X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    if clip == 'Walk':
        Pd = 1.0; v = 0.6; w = 2 * math.pi * t / Pd
        yaw = Quaternion(Z, math.radians(5) * math.sin(w))
        hips = P('hips') + Vector((0, -v * t, -0.06 + 0.02 * math.cos(2 * w)))
        q['hips'] = yaw; q['spine'] = yaw @ Quaternion(X, math.radians(-10) * (0.5 + 0.5 * math.sin(w)))
        q['chest'] = q['spine'] @ Quaternion(Z, math.radians(-15) * math.sin(w)); q['head'] = q['chest'] @ Quaternion(X, math.radians(8) * math.sin(2 * w))
        feet = {}
        for S, ph, s in (('L', 0.0, 1), ('R', 0.5, -1)):
            c = (t / Pd + ph) % 1.0; K = math.floor(t / Pd + ph); tm = (K - ph) * Pd + 0.3 * Pd; pk = v * tm
            if c < 0.6: y, lift = pk, 0
            else:
                u = (c - 0.6) / 0.4; e = u * u * (3 - 2 * u); y, lift = pk + v * Pd * e, 0.08 * math.sin(math.pi * u)
            feet[S] = Vector((0.09 * s, -y, P('foot')[2] + lift))
        arms = {'L': math.radians(35) * math.sin(w), 'R': -math.radians(35) * math.sin(w)}
    else:
        yaw = Quaternion(Z, 2 * math.pi * t / T)
        hips = P('hips'); q['hips'] = yaw; q['spine'] = yaw @ Quaternion(X, math.radians(-8)); q['chest'] = q['spine']; q['head'] = q['chest'] @ Quaternion(Z, math.radians(20) * math.sin(2 * math.pi * t / T))
        feet = None; arms = {'L': math.radians(-60), 'R': math.radians(-60)}
    for S, s in (('L', 1), ('R', -1)):
        up = q['chest'] @ Quaternion(X, arms[S]) @ Quaternion(Y, math.radians(50) * s); q['upperArm.' + S] = up   # lowered 50 degrees, swung
        q['foreArm.' + S] = up @ Quaternion(Vector((0, 0, s)), math.radians(25) * (0.5 + 0.5 * math.sin(2 * math.pi * t)))
        q['hand.' + S] = q['foreArm.' + S] @ Quaternion(Vector((s, 0, 0)), math.radians(50) * math.sin(2 * math.pi * t) if S == 'R' else 0)
    return q, hips, feet, yaw

def animate(ob, spec, clip, T):
    st = None; arm = ob.data; R = roles_of(spec); role_of = {n: r for r, n in R.items()}
    sc = bpy.context.scene; fps = sc.render.fps; N = int(round(T * fps))
    act = bpy.data.actions.new(clip); ob.animation_data_create(); ob.animation_data.action = act
    rest = {b.name: b.matrix_local.copy() for b in arm.bones}; U = 1 / ob.scale[0]
    order = [n for n, *_ in spec]; parent = {n: p for n, _, _, p, _ in spec}
    lens = {}
    def pose_at(t):
        q, hips, feet, yaw = motion(clip, t, T); M = {}; D = {}
        for n in order:
            p = parent[n]; role = role_of.get(n)
            Rr = rest[n].to_quaternion()
            if p is None:
                d = q['hips']; pos = hips * U
            else:
                L = rest[p].inverted() @ rest[n]; pos = (M[p] @ L).translation
                d = D[p]
                if role and role in q: d = q[role]
            if role and role.split('.')[0] in ('thigh', 'shin', 'foot'):
                S = role.split('.')[1]; th, sh, ft = R['thigh.' + S], R['shin.' + S], R['foot.' + S]
                if feet is None: d = D[p] if role.startswith('thigh') else d   # spin: legs turn with the hips
                if feet is None: d = D[parent[n]]
                else:
                    if role.startswith('thigh'):
                        H = pos / U; G = feet[S]; a = (rest[sh].translation - rest[th].translation).length / U; b = (rest[ft].translation - rest[sh].translation).length / U
                        dv = G - H; dl = min(dv.length, a + b - 1e-4); u = dv.normalized(); f = yaw @ Vector((0, -1, 0)); vv = (f - u * u.dot(f)).normalized()
                        ca = (a * a + dl * dl - b * b) / (2 * a * dl); knee = H + (u * ca + vv * math.sqrt(max(0, 1 - ca * ca))) * a
                        lens[S] = (knee, G)
                        d = (rest[sh].translation - rest[th].translation).normalized().rotation_difference((knee - H).normalized())
                    elif role.startswith('shin'):
                        knee, G = lens[S]
                        d = (rest[ft].translation - rest[sh].translation).normalized().rotation_difference((G - knee).normalized())
                    else: d = FOOTQ.get(S, yaw)   # a motion may pitch the feet (make_natural.py)
            D[n] = d; M[n] = Matrix.Translation(pos) @ (d @ Rr).to_matrix().to_4x4()
        return M, D
    for fr in range(N + 1):
        t = fr / fps; M, D = pose_at(t)
        for n in order:
            p = parent[n]
            Lm = rest[n] if p is None else M[p] @ rest[p].inverted() @ rest[n]
            basis = Lm.inverted() @ M[n]
            pb = ob.pose.bones[n]; loc, rot, _ = basis.decompose(); pb.location = loc; pb.rotation_quaternion = rot
            pb.keyframe_insert('location', frame=fr + 1); pb.keyframe_insert('rotation_quaternion', frame=fr + 1)
    track = ob.animation_data.nla_tracks.new(); track.name = clip; track.strips.new(clip, 1, act); ob.animation_data.action = None
    # the truth, at 60 a second, in world space
    W = ob.matrix_world; tr = []
    for i in range(int(round(T * 60)) + 1):
        t = i / 60; M, D = pose_at(t); row = {'t': round(t, 5)}
        def wpos(n): return W @ M[n].translation
        tip = {'hips': R['spine'], 'spine': R['chest'], 'chest': R['head']}
        for S in 'LR':
            tip['upperArm.' + S] = R['foreArm.' + S]; tip['foreArm.' + S] = R['hand.' + S]; tip['thigh.' + S] = R['shin.' + S]; tip['shin.' + S] = R['foot.' + S]
        for role, end in tip.items(): row[role] = list((wpos(end) - wpos(R[role])).normalized())
        row['hipsPos'] = list(wpos(R['hips'])); row['feetPos'] = {S: list(wpos(R['foot.' + S])) for S in 'LR'}
        tr.append(row)
    return act, N, tr

def main():
    TRUTH = {}
    for style in STYLES:
        ob, spec = build(style); TRUTH[style] = {'roles': roles_of(spec), 'fps': STYLES[style]['fps'], 'clips': {}}
        acts = {}
        for clip, T in (('Walk', 2.0), ('Spin', 1.0)):
            act, N, tr = animate(ob, spec, clip, T); acts[clip] = (act, N)
            TRUTH[style]['clips'][clip] = {'seconds': T, 'frames': N + 1, 'rows': tr}
        base = os.path.join(OUT, 'sample_' + style)
        for a in bpy.data.actions: a.use_fake_user = True
        bpy.ops.wm.save_as_mainfile(filepath=base + '.blend', copy=True)
        for tr in list(ob.animation_data.nla_tracks): ob.animation_data.nla_tracks.remove(tr)
        sc = bpy.context.scene
        for clip, (act, N) in acts.items():
            ob.animation_data.action = act; sc.frame_start = 1; sc.frame_end = N + 1
            bpy.context.view_layer.objects.active = ob; ob.select_set(True)
            bpy.ops.export_anim.bvh(filepath='%s_%s.bvh' % (base, clip), frame_start=1, frame_end=N + 1, root_transform_only=False)
        fbx = dict(object_types={'ARMATURE'}, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
                   bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0)
        if style == 'mixamo':   # FBX writes the pose it is exported in as the rest: one written mid-walk, as some files are
            ob.animation_data.action = acts['Walk'][0]; sc.frame_end = acts['Walk'][1] + 1; sc.frame_set(1 + 13)
            bpy.ops.export_scene.fbx(filepath=base + '_bentrest.fbx', **fbx)
        ob.animation_data.action = None
        for pb in ob.pose.bones: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
        bpy.context.view_layer.update()
        bpy.ops.export_scene.fbx(filepath=base + '.fbx', **fbx)
        bpy.ops.export_scene.gltf(filepath=base + '.glb', export_format='GLB', export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True)
        print('make_samples: %s (%d bones) -> %s.{blend,fbx,glb} + %d bvh' % (style, len(spec), base, len(acts)))
    json.dump(TRUTH, open(os.path.join(OUT, 'truth.json'), 'w'), separators=(',', ':'))
    print('make_samples: truth.json written')

if __name__ == '__main__':
    main()
