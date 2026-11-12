# Retargets skeletal animation from any source file onto one of Emberfall's rig.py fighters, writing per-frame keys in
# rig.py's own form (the same form tools/blender/mocap.py writes for Sprocket), so a fighter's spec can use them as clips.
#   blender -b --factory-startup --python tools/blender/retarget/retarget.py -- --target tools/blender/retarget/targets/brand.json
#           --out <dir> [options] <file or folder> [...]
# Sources: .fbx .bvh .glb .gltf .blend (every action / take / glTF animation in a file becomes a clip).
# Options (all optional):
#   --maps <dir>        where bone maps are kept, one per source skeleton (default tools/blender/retarget/maps); a map
#                       file there is used as it is, so a hand-corrected map wins over the automatic one
#   --fps 60            output rate (Emberfall's clips are 60); --native 1 keeps the source's own frame rate instead
#   --root linear       take the hips' travel across the floor out (straight line, start to end; the sway stays);
#                       full = all horizontal hips motion out; keep = leave it in. The travel is written to <clip>.root.json
#   --feet stance       feet keep the fighter's own stance and stay on the floor (the legs bend as they must to reach);
#                       pose = the legs take the source's exact angles on the fighter's leg lengths (feet may float or sink)
#   --plant 1           lock feet that stand still in the source (foot IK contacts); 0 = off (the default with --feet pose)
#   --wrists 1          turn hands and feet as the source's do, on top of the IK reach; 0 = they follow the forearm / shin
#   --limbs 1           also key the upper and lower limbs' own turns, so the IK (which has no pole) starts from the
#                       source's elbow and knee plane; 0 = the IK alone decides the bend, as hand-keyed clips do
#   --props hand        held props (sword, shield) follow the hand that holds them; bone = follow the source's weapon bone
#                       where the map finds one; none = leave them to the fighter's base pose
#   --forward x,y,z     the source's facing in Blender's world (when it has no toes and no left/right names)
#   --armature <name>   which armature, when a file has several
#   --name <clip>       clip name (single-clip files); default: the file name, plus the action name when a file has several
#   --eval 1            also write eval/<clip>.json (per-frame measurements, for tests/retarget/check.py)
#   --dummy <file.glb>  also write a tiny stand-in mesh, for building a skeleton-only GLB with rig.py
# Writes, per clip: <clip>.keys.json (rig.py keys), <clip>.root.json (the floor travel taken out); and report.json.
import bpy, sys, os, math, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rt_common import conv, back, rig_delta, frame_quat, swing, qlist, vlist, angle_deg, dir_angle_deg, signature, load_json, save_json, RIGHT, UP, FWD
from rt_map import map_skeleton
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
args = sys.argv[sys.argv.index('--') + 1:]
opt, inputs = {}, []
i = 0
while i < len(args):
    if args[i].startswith('--'): opt[args[i][2:]] = args[i + 1]; i += 2
    else: inputs.append(args[i]); i += 1
prof = load_json(opt['target'])
spec = load_json(os.path.join(REPO, prof['spec']))
OUT = opt['out']; MAPS = opt.get('maps', os.path.join(HERE, 'maps'))
FPS_OUT = float(opt.get('fps', 60)); NATIVE = opt.get('native') == '1'
ROOT = opt.get('root', 'linear'); PLANT = opt.get('plant', '0' if opt.get('feet') == 'pose' else '1') == '1'; WRISTS = opt.get('wrists', '1') == '1'
PROPS = opt.get('props', 'hand'); EVAL = opt.get('eval') == '1'; LIMBS = opt.get('limbs', '1') == '1'; FEET = opt.get('feet', 'stance')
EXTS = ('.fbx', '.bvh', '.glb', '.gltf', '.blend')
files = []
for p in inputs:
    if os.path.isdir(p): files += sorted(f for f in glob.glob(os.path.join(p, '**', '*'), recursive=True) if f.lower().endswith(EXTS))
    else: files.append(p)
if not files: raise SystemExit('retarget: no input files')
os.makedirs(OUT, exist_ok=True)
log = lambda *a: print('retarget:', *a)

# ---------------------------------------------------------------- the target rig (from its rig.py spec) ----------
TB = {b['name']: b for b in spec['bones']}
T_HEAD = {n: conv(b['head']) for n, b in TB.items()}
T_TAIL = {n: conv(b['tail']) for n, b in TB.items()}
T_PAR = {n: b.get('parent') for n, b in TB.items()}
ROLES = prof['roles']
SIDES = 'LR'
SEC_X, SEC_F = Vector((1, 0, 0)), Vector((0, -1, 0))
AXES = [Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))]


def t_dir(role):
    n = ROLES[role]
    nxt = {'hips': 'spine', 'spine': 'chest', 'chest': 'head'}
    for s in SIDES:
        nxt['upperArm.' + s] = 'foreArm.' + s; nxt['foreArm.' + s] = 'hand.' + s
        nxt['thigh.' + s] = 'shin.' + s; nxt['shin.' + s] = 'foot.' + s
    if role in nxt and ROLES[nxt[role]] != n: return T_HEAD[ROLES[nxt[role]]] - T_HEAD[n]
    if role == 'spine' and ROLES['spine'] == ROLES['chest']: return T_HEAD[ROLES['head']] - T_HEAD[n]
    return T_TAIL[n] - T_HEAD[n]


def build_target_rig():
    arm = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('TargetRig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
    for b in spec['bones']:
        eb = arm.edit_bones.new(b['name']); eb.head = conv(b['head']); eb.tail = conv(b['tail'])
        if b.get('parent'): eb.parent = arm.edit_bones[b['parent']]; eb.use_connect = bool(b.get('connect', False))
    bpy.ops.object.mode_set(mode='OBJECT')
    for ik in spec.get('ik', []):
        c = rig.pose.bones[ik['bone']].constraints.new('IK'); c.target = rig; c.subtarget = ik['name']; c.chain_count = ik.get('chain', 2)
    for cr in spec.get('copyrot', []):
        c = rig.pose.bones[cr['bone']].constraints.new('COPY_ROTATION'); c.target = rig; c.subtarget = cr['from']; c.target_space = 'WORLD'; c.owner_space = 'WORLD'; c.mix_mode = 'REPLACE'
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    return rig


def bone_scale(R, s):   # rig.py's
    S = conv(s); S = Vector((abs(S[0]), abs(S[1]), abs(S[2]))); out = []
    for k in range(3):
        ax = R.col[k]; w = Vector((abs(ax[0]), abs(ax[1]), abs(ax[2]))); t = w[0] + w[1] + w[2]
        out.append((w[0] * S[0] + w[1] * S[1] + w[2] * S[2]) / t if t > 1e-6 else 1)
    return Vector(out)


def pose_rig(rig, state):
    # sets the pose exactly as rig.py keys it (rot, qb, aim, twist, spin, move, scale), bones not in state at rest
    for pb in rig.pose.bones:
        tr = state.get(pb.name, {}); R = pb.bone.matrix_local.to_3x3(); rd = (pb.bone.tail_local - pb.bone.head_local).normalized()
        D = rig_delta(tr.get('rot', [0, 0, 0])).to_matrix()
        if tr.get('qb'): D = D @ Quaternion(tr['qb']).to_matrix()
        if tr.get('aim'):
            tg = conv(tr['aim']).normalized(); A = rd.rotation_difference(tg).to_matrix()
            if tr.get('twist'): A = Quaternion(tg, math.radians(tr['twist'])).to_matrix() @ A
            D = D @ A
        if tr.get('spin'): D = D @ Quaternion(rd, math.radians(tr['spin'])).to_matrix()
        pb.rotation_quaternion = (R.inverted() @ D @ R).to_quaternion()
        pb.location = R.inverted() @ conv(tr.get('move', [0, 0, 0]))
        pb.scale = bone_scale(R, tr.get('scale', [1, 1, 1]))
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return rig.evaluated_get(dg)


def world_delta(ev, rig, n):
    return (ev.pose.bones[n].matrix.to_quaternion() @ rig.data.bones[n].matrix_local.to_quaternion().inverted()).normalized()


BASE = dict(spec['poses'][prof['basePose']]) if prof.get('basePose') else {}
NEUTRAL = {n: rig_delta(r) for n, r in prof.get('neutral', {}).items()}
# leg length along the bones (thigh + shin), so a bent rest pose measures the same as a straight one
T_LEG = sum((T_HEAD[ROLES['shin.' + s]] - T_HEAD[ROLES['thigh.' + s]]).length + (T_HEAD[ROLES['foot.' + s]] - T_HEAD[ROLES['shin.' + s]]).length for s in 'LR') / 2
UNITS = (prof['gameHeight'] / prof['modelHeight']) if prof.get('gameHeight') else None   # game units per metre

# ---------------------------------------------------------------- loading a source -------------------------------
def fcurves_of(act):
    try:
        fc = list(act.fcurves)
        if fc: return fc
    except Exception: pass
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []): out.extend(bag.fcurves)
    return out


def load_source(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.blend':
        bpy.ops.wm.open_mainfile(filepath=path, load_ui=False, use_scripts=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=path, use_anim=True, ignore_leaf_bones=False, automatic_bone_orientation=False)
        elif ext == '.bvh': bpy.ops.import_anim.bvh(filepath=path, update_scene_fps=True, update_scene_duration=True, rotate_mode='NATIVE')
        elif ext in ('.glb', '.gltf'):   # glTF keys are in seconds: read them onto a 60-a-second timeline
            bpy.context.scene.render.fps = 60; bpy.context.scene.render.fps_base = 1
            bpy.ops.import_scene.gltf(filepath=path)
        else: raise SystemExit('retarget: unknown file type ' + path)
    sc = bpy.context.scene
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    if opt.get('armature'): arms = [o for o in arms if o.name == opt['armature'] or o.data.name == opt['armature']]
    if not arms: raise SystemExit('retarget: no armature in ' + path)
    arm = max(arms, key=lambda o: len(o.data.bones))
    ad = arm.animation_data
    acts = []
    for a in bpy.data.actions:
        paths = [fc.data_path for fc in fcurves_of(a)]
        if any(p.startswith('pose.bones') and p.split('"')[1] in arm.pose.bones for p in paths if '"' in p): acts.append(a)
    if ad and ad.action and ad.action in acts: acts.remove(ad.action); acts.insert(0, ad.action)
    fps = sc.render.fps / sc.render.fps_base
    if abs(fps - round(fps)) < 0.01: fps = float(round(fps))   # a BVH frame time of 0.041667 s is 24 a second
    return arm, acts, fps


def use_action(arm, act):
    ad = arm.animation_data or arm.animation_data_create()
    for a in bpy.data.actions: a.use_fake_user = True
    for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
    ad.action = act
    if hasattr(ad, 'action_slot') and getattr(act, 'slots', None):
        slot = next((s for s in act.slots if s.target_id_type == 'OBJECT'), act.slots[0])
        try: ad.action_slot = slot
        except Exception: pass
    bpy.context.view_layer.update()


def rest_skeleton(arm):
    W = arm.matrix_world
    sk = {}
    for b in arm.data.bones:
        sk[b.name] = {'parent': b.parent.name if b.parent else None, 'head': W @ b.head_local, 'tail': W @ b.tail_local,
                      'rot': (W @ b.matrix_local).decompose()[1]}
    return sk


def get_map(sk, path):
    sig = signature(sk); mp = os.path.join(MAPS, sig + '.json')
    if os.path.exists(mp):
        m = load_json(mp); log('bone map %s (kept from %s)' % (sig, m.get('firstSource', '?')))
        return m['roles'], {'map': mp, 'reused': True, 'signature': sig, 'sideFrom': m.get('sideFrom'), 'namesDisagree': m.get('namesDisagree', [])}
    fh = Vector([float(x) for x in opt['forward'].split(',')]) if opt.get('forward') else None
    # the shape is read standing up: Blender's Z first, then each other axis (a file whose axes were written another way
    # round imports lying down); the first way up that reads as a humanoid is used
    roles = None; errs = []
    for up in (Vector((0, 0, 1)), Vector((0, 1, 0)), Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 0, -1))):
        q = up.rotation_difference(Vector((0, 0, 1)))
        sk2 = {n: {'parent': b['parent'], 'head': q @ b['head'], 'tail': q @ b['tail']} for n, b in sk.items()}
        try: roles, info = map_skeleton(sk2, (q @ fh) if fh else None); info['up'] = list(up); break
        except ValueError as e: errs.append('%s up: %s' % (tuple(up), e))
    if roles is None: raise SystemExit('retarget: no humanoid found in %s (%s). Write a map by hand in %s' % (path, '; '.join(errs), mp))
    save_json(mp, {'signature': sig, 'firstSource': os.path.basename(path), 'roles': roles, 'sideFrom': info['sideFrom'],
                   'namesAgree': info['namesAgree'], 'namesDisagree': info['namesDisagree'],
                   'note': 'Found automatically; edit the roles and this file is used as it is for every file from this skeleton.'})
    log('bone map %s (new, sides from %s%s)' % (sig, info['sideFrom'], (', names disagree: ' + ', '.join(info['namesDisagree'])) if info['namesDisagree'] else ''))
    return roles, {'map': mp, 'reused': False, 'signature': sig, 'sideFrom': info['sideFrom'], 'namesDisagree': info['namesDisagree']}


# ---------------------------------------------------------------- the retarget ------------------------------------
def snap_axis(v, deg=20):
    best = max([a for a in AXES] + [-a for a in AXES], key=lambda a: a.dot(v))
    return best.copy() if math.degrees(best.angle(v, 0)) < deg else v.normalized()


def basis_of(sk, R):
    up = snap_axis((sk[R['head']]['head'] - sk[R['hips']]['head']).normalized())
    left = sk[R['thigh.L']]['head'] - sk[R['thigh.R']]['head']
    if (left - up * left.dot(up)).length < 1e-6: left = sk[R['upperArm.L']]['head'] - sk[R['upperArm.R']]['head']
    return (frame_quat(UP, Vector((1, 0, 0))) @ frame_quat(up, left).inverted()).normalized()


def s_dir(role, R, Pr):
    # the source bone's direction at rest (after the basis), matching t_dir's choice of end point
    n = R[role]; P = lambda r: Pr[R[r]]
    if role == 'hips':   # up the spine (to the chest when the lower back starts where the hips do, as in CMU rigs)
        v = P('spine' if R['spine'] != n else 'chest') - P('hips')
        return v if v.length > 0.1 * (P('chest') - P('hips')).length else P('chest') - P('hips')
    if role == 'spine': return (P('chest') if R['chest'] != n else P('head')) - P('spine')
    if role == 'chest': return P('head') - P('chest')
    if role == 'head': return (Pr[R['headTip']] - P('head')) if 'headTip' in R else None
    base, s = role.split('.')
    nxt = {'upperArm': 'foreArm', 'foreArm': 'hand', 'thigh': 'shin', 'shin': 'foot', 'hand': 'handTip', 'foot': 'toe', 'weapon': None}[base]
    if nxt and (nxt + '.' + s) in R: return Pr[R[nxt + '.' + s]] - P(role)
    return None


def pick_sec(a, b):
    return max(AXES, key=lambda x: min(a.normalized().cross(x).length, b.normalized().cross(x).length))


def retarget_clip(arm, act, src_fps, R, mapinfo, path, clip):
    use_action(arm, act)
    sk = rest_skeleton(arm)
    B = basis_of(sk, R)
    Pr = {n: B @ b['head'] for n, b in sk.items()}
    Qr = {n: (B @ b['rot']).normalized() for n, b in sk.items()}
    s_leg = sum((Pr[R['shin.' + s]] - Pr[R['thigh.' + s]]).length + (Pr[R['foot.' + s]] - Pr[R['shin.' + s]]).length for s in SIDES) / 2
    if s_leg <= 1e-9: raise SystemExit('retarget: the source has no leg length (%s)' % path)
    k = T_LEG / s_leg
    # the source standing straight (feet on the floor its rest feet stand on, under the hip joints): the reference its
    # hips and feet are measured from, matched to the target's own rest stance. A rest pose that is not a T-pose (an FBX
    # written mid-walk) then moves nothing.
    floor = min(Pr[R['foot.L']].z, Pr[R['foot.R']].z)
    hip_drop = Pr[R['hips']].z - (Pr[R['thigh.L']].z + Pr[R['thigh.R']].z) / 2
    ref_hips = Vector((Pr[R['hips']].x, Pr[R['hips']].y, floor + hip_drop + s_leg))
    ref_foot = {s: Vector((Pr[R['thigh.' + s]].x, Pr[R['thigh.' + s]].y, floor)) for s in SIDES}
    # turn from target rest frame to source rest frame, per driven role
    drive = ['hips', 'spine', 'chest', 'head'] + [r + '.' + s for s in SIDES for r in ('upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot')]
    if ROLES['spine'] == ROLES['chest']: drive.remove('spine')
    # Down the chain from the hips: each bone takes its parent's alignment, then the shortest swing that points it the way
    # the source's points. Twist therefore follows the chain (no world axis decides it), so a source whose rest pose is an
    # A-pose, arms down or a bent mid-step frame lines up the same as a T-pose would.
    PAR = {'spine': 'hips', 'chest': 'spine' if 'spine' in drive else 'hips', 'head': 'chest'}
    for s in SIDES:
        PAR.update({'upperArm.' + s: 'chest', 'foreArm.' + s: 'upperArm.' + s, 'hand.' + s: 'foreArm.' + s,
                    'thigh.' + s: 'hips', 'shin.' + s: 'thigh.' + s, 'foot.' + s: 'shin.' + s})
    QA = {}
    for role in drive:
        dt, ds = t_dir(role), s_dir(role, R, Pr)
        if role == 'hips':   # upright and facing the same way: the spine's line and the left-right line
            QA[role] = (frame_quat(ds, Vector((1, 0, 0))) @ frame_quat(dt, Vector((1, 0, 0))).inverted()).normalized(); continue
        P0 = QA[PAR[role]]
        if role.startswith('thigh.'):
            # a thigh is lined up by its own line and the way its foot points, so a target modelled with a foot turned
            # out (Brand's left) turns the whole leg in at the hip, instead of leaving the twist to the ankle
            s = role[-1]; ft, fs = t_dir('foot.' + s), s_dir('foot.' + s, R, Pr)
            if ds is not None and fs is not None and ds.length > 1e-6 and fs.length > 1e-6 \
                    and ft.normalized().cross(dt.normalized()).length > 0.3 and fs.normalized().cross(ds.normalized()).length > 0.3:
                QA[role] = (frame_quat(ds, fs) @ frame_quat(dt, ft).inverted()).normalized(); continue
        QA[role] = P0 if (ds is None or ds.length < 1e-6) else (swing(P0 @ dt, ds) @ P0).normalized()
    wep = {}
    if PROPS == 'bone':
        for p in prof['props']:
            r = 'weapon.' + p['side']
            if r in R:
                tb = p['bone']; dt = T_TAIL[tb] - T_HEAD[tb]; ds = B @ (sk[R[r]]['tail'] - sk[R[r]]['head']); P0 = QA['hand.' + p['side']]
                wep[p['side']] = (R[r], (swing(P0 @ dt, ds) @ P0).normalized())
    # sample the source
    f0, f1 = act.frame_range[0], act.frame_range[1]
    dur = (f1 - f0) / src_fps
    rate = src_fps if NATIVE else FPS_OUT
    n = int(round(dur * rate)) + 1
    native_keys = max((len(fc.keyframe_points) for fc in fcurves_of(act)), default=0)
    kt = sorted({round(kp.co[0], 4) for fc in fcurves_of(act) for kp in fc.keyframe_points})
    gaps = sorted(b - a for a, b in zip(kt, kt[1:]) if b - a > 1e-4)
    key_rate = round(src_fps / gaps[len(gaps) // 2], 3) if gaps else None   # the rate the source was keyed at
    need = set(R[r] for r in drive) | set(v[0] for v in wep.values())
    # The source is evaluated on its own key grid (every key, and at least once a frame between sparse keys), with Blender
    # doing the curves, rotation orders and constraints; the output times are read between those samples by slerp, so an
    # Euler curve that wraps at 180 degrees between two keys cannot throw a sub-frame off.
    W = arm.matrix_world; sc = bpy.context.scene
    gap = gaps[len(gaps) // 2] if gaps else 1.0
    step = gap / math.ceil(gap - 1e-6) if gap > 1e-6 else 1.0
    F = [f0 + i * step for i in range(int(round((f1 - f0) / step)) + 1)]
    if F[-1] < f1 - 1e-6: F.append(f1)
    raw_rot = {b: [] for b in need}; raw_pos = {b: [] for b in need}
    for f in F:
        fi = math.floor(f + 1e-6); sc.frame_set(int(fi), subframe=max(0.0, f - fi))
        ev = arm.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for b in need:
            m = W @ ev.pose.bones[b].matrix
            q = (B @ m.decompose()[1]).normalized()
            if raw_rot[b] and raw_rot[b][-1].dot(q) < 0: q = -q
            raw_rot[b].append(q); raw_pos[b].append(B @ m.translation)
    S_rot = {b: [] for b in need}; S_pos = {b: [] for b in need}
    for j in range(n):
        x = (min(dur, j / rate) * src_fps) / step; i0 = max(0, min(len(F) - 1, int(math.floor(x + 1e-9)))); i1 = min(len(F) - 1, i0 + 1)
        u = max(0.0, min(1.0, ((f0 + min(dur, j / rate) * src_fps) - F[i0]) / max(1e-9, F[i1] - F[i0]))) if i1 != i0 else 0.0
        for b in need:
            S_rot[b].append(raw_rot[b][i0].slerp(raw_rot[b][i1], u).normalized() if u > 1e-9 else raw_rot[b][i0].copy())
            S_pos[b].append(raw_pos[b][i0].lerp(raw_pos[b][i1], u))
    dS = lambda role, j: (S_rot[R[role]][j] @ Qr[R[role]].inverted()).normalized()

    # world turns for the driven target bones, every frame
    Dw = []
    for j in range(n):
        d = {}
        for role in drive:
            q = dS(role, j) @ QA[role]
            nm = ROLES[role]
            if nm in NEUTRAL: q = q @ NEUTRAL[nm]
            d[role] = q.normalized()
        for side, (sb, qa) in wep.items(): d['weapon.' + side] = ((S_rot[sb][j] @ Qr[sb].inverted()) @ qa).normalized()
        Dw.append(d)
    def driven_parent_delta(d, nm):
        p = T_PAR[nm]
        while p:
            for role, bn in ROLES.items():
                if bn == p and role in d: return d[role]
            p = T_PAR[p]
        return Quaternion()
    def fk_head(d, nm, hp):
        # where a target bone's head is, from the hips at hp and the driven turns down the chain
        chain = []; p = nm
        while p and p != ROLES['hips']: chain.append(p); p = T_PAR[p]
        if p != ROLES['hips']: return T_HEAD[nm]
        pos = hp
        for c in reversed(chain): pos = pos + driven_parent_delta(d, c) @ (T_HEAD[c] - T_HEAD[T_PAR[c]])
        return pos
    # positions: the hips move as the source's do, scaled by leg length
    hipsP = [T_HEAD[ROLES['hips']] + (S_pos[R['hips']][j] - ref_hips) * k for j in range(n)]
    feet = {}
    for s in SIDES:
        fb = R['foot.' + s]
        if FEET == 'pose':   # the legs posed as the source's are, on the fighter's own leg lengths
            feet[s] = [fk_head(Dw[j], ROLES['foot.' + s], hipsP[j]) for j in range(n)]
        else:   # "stance": where the source's foot is from its hips (scaled), plus the difference in stance at rest turned
                # with the hips, so a wider-legged fighter keeps its own stance and its feet stay on the floor
            c_rest = (T_HEAD[ROLES['foot.' + s]] - T_HEAD[ROLES['hips']]) - (ref_foot[s] - ref_hips) * k
            feet[s] = [hipsP[j] + (S_pos[fb][j] - S_pos[R['hips']][j]) * k + dS('hips', j) @ c_rest for j in range(n)]
    # foot contacts: still and low in the source -> held in place
    plants = {s: [] for s in SIDES}; slide_before = {}
    if PLANT and n >= 3:
        for s in SIDES:
            g = feet[s]; zmin = min(p.z for p in g); hz = max(0.02, 0.03 * T_LEG); vmax = 0.3 * T_LEG / 0.85
            spd = [((g[min(n - 1, j + 1)] - g[max(0, j - 1)]).xy.length * rate / max(1, min(n - 1, j + 1) - max(0, j - 1))) for j in range(n)]
            on = [g[j].z < zmin + hz and spd[j] < vmax for j in range(n)]
            j = 0
            while j < n:
                if not on[j]: j += 1; continue
                e = j
                while e + 1 < n and on[e + 1]: e += 1
                if e - j + 1 >= 3: plants[s].append((j, e))
                j = e + 1
            worst = 0
            for a, e in plants[s]:
                span = g[a:e + 1]; c = sum(span, Vector()) / len(span)
                worst = max(worst, max((p - c).xy.length for p in span))
                for jj in range(max(0, a - 3), min(n, e + 4)):
                    w = 1.0 if a <= jj <= e else 1 - min(abs(jj - a), abs(jj - e)) / 4
                    g[jj] = g[jj].lerp(Vector((c.x, c.y, min(g[jj].z, c.z) if a <= jj <= e else g[jj].z)), w)
            slide_before[s] = round(worst * 100, 2)
    # floor travel out
    h0 = T_HEAD[ROLES['hips']]
    travel = []
    for j in range(n):
        if ROOT == 'keep': o = Vector((0, 0, 0))
        elif ROOT == 'full': o = Vector(((hipsP[j] - h0).x, (hipsP[j] - h0).y, 0))
        else:
            u = j / (n - 1) if n > 1 else 0; a, b = hipsP[0] - h0, hipsP[-1] - h0
            o = Vector((a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0))
        travel.append(o)
    hipsP = [hipsP[j] - travel[j] for j in range(n)]
    for s in SIDES: feet[s] = [feet[s][j] - travel[j] for j in range(n)]

    # keys
    frames = []; goals = []; prev = {}
    for j in range(n):
        d = Dw[j]; hips_now = hipsP[j]; key = {}
        def put(bn, **kw):
            e = key.setdefault(bn, {})
            for kk, v in kw.items():
                if kk == 'qb':
                    if bn in prev and prev[bn].dot(v) < 0: v = -v
                    prev[bn] = v.copy(); e['qb'] = qlist(v)
                else: e[kk] = vlist(back(v))
        put(ROLES['hips'], qb=d['hips'], move=hips_now - T_HEAD[ROLES['hips']])
        for role in ('spine', 'chest', 'head'):
            if role in d: put(ROLES[role], qb=driven_parent_delta(d, ROLES[role]).inverted() @ d[role])
        if LIMBS:   # the limbs' own turns too: the IK starts from them, so elbows and knees bend in the source's plane
            for s in SIDES:
                for role in ('upperArm.', 'foreArm.', 'thigh.', 'shin.'):
                    bn = ROLES[role + s]; put(bn, qb=driven_parent_delta(d, bn).inverted() @ d[role + s])
        g = {}
        for s in SIDES:
            up_, fo, ha = ROLES['upperArm.' + s], ROLES['foreArm.' + s], ROLES['hand.' + s]
            sh = fk_head(d, up_, hips_now)
            el = sh + d['upperArm.' + s] @ (T_HEAD[fo] - T_HEAD[up_])
            wr = el + d['foreArm.' + s] @ (T_HEAD[ha] - T_HEAD[fo])
            ctl = prof['ik']['hand.' + s]; par = prof['ikParent'][ctl]
            pd = driven_parent_delta(d, ctl); ph = fk_head(d, par, hips_now)
            put(ctl, move=pd.inverted() @ (wr - ph) - (T_HEAD[ctl] - T_HEAD[par]))
            ctl = prof['ik']['foot.' + s]; par = prof['ikParent'][ctl]
            pd = driven_parent_delta(d, ctl); ph = fk_head(d, par, hips_now)
            put(ctl, move=pd.inverted() @ (feet[s][j] - ph) - (T_HEAD[ctl] - T_HEAD[par]))
            g['hand.' + s] = wr; g['foot.' + s] = feet[s][j]
        frames.append(key); goals.append(g)

    # wrists, feet and held props: turned on top of what the IK does, so they point as the source's do
    rig = build_target_rig()
    evals = []
    for j in range(n):
        state = dict(BASE); state.update(frames[j]); ev = pose_rig(rig, state)
        hand_now = {}
        for s in SIDES:
            for limb, par in (('hand', 'foreArm'), ('foot', 'shin')):
                bn = ROLES[limb + '.' + s]; want = Dw[j][limb + '.' + s]
                if WRISTS:
                    q = world_delta(ev, rig, ROLES[par + '.' + s]).inverted() @ want
                    if bn in prev and prev[bn].dot(q) < 0: q = -q
                    prev[bn] = q.copy(); frames[j][bn] = {'qb': qlist(q)}
            hand_now[s] = Dw[j]['hand.' + s] if WRISTS else world_delta(ev, rig, ROLES['hand.' + s])
        if PROPS in ('hand', 'bone'):
            for p in prof['props']:
                q = Dw[j]['weapon.' + p['side']] if (PROPS == 'bone' and p['side'] in wep) else hand_now[p['side']]
                q = driven_parent_delta({}, p['control']).inverted() @ q
                if p['control'] in prev and prev[p['control']].dot(q) < 0: q = -q
                prev[p['control']] = q.copy(); frames[j][p['control']] = {'qb': qlist(q)}
    # measure the result as the rig really poses it
    stats = {'handReach': 0.0, 'footReach': 0.0, 'rotErr': {}, 'limbDirErr': {}, 'propRigid': 0.0}
    tips = []; footw = {s: [] for s in SIDES}
    for j in range(n):
        state = dict(BASE); state.update(frames[j]); ev = pose_rig(rig, state)
        hp = lambda bn: ev.pose.bones[bn].head.copy()
        row = {'t': round(j / rate, 5)}
        for s in SIDES:
            stats['handReach'] = max(stats['handReach'], (hp(ROLES['hand.' + s]) - goals[j]['hand.' + s]).length)
            stats['footReach'] = max(stats['footReach'], (hp(ROLES['foot.' + s]) - goals[j]['foot.' + s]).length)
            footw[s].append(hp(ROLES['foot.' + s]) + travel[j])
        for role in drive:
            bn = ROLES[role]; wd = world_delta(ev, rig, bn)
            if bn in NEUTRAL: wd = wd @ NEUTRAL[bn].inverted()   # measured without the modelled face's turn
            got = wd @ t_dir(role)
            want = dS(role, j) @ (s_dir(role, R, Pr) if s_dir(role, R, Pr) is not None else (QA[role] @ t_dir(role)))
            e = dir_angle_deg(got, want)
            bucket = stats['limbDirErr'] if role.split('.')[0] in ('upperArm', 'foreArm', 'thigh', 'shin') else stats['rotErr']
            bucket[role] = max(bucket.get(role, 0.0), e)
            row[role] = vlist(got.normalized(), 5)
        for p in prof['props']:
            rel = world_delta(ev, rig, ROLES['hand.' + p['side']]).inverted() @ world_delta(ev, rig, p['bone'])
            if j == 0: p['_rel0'] = rel
            stats['propRigid'] = max(stats['propRigid'], angle_deg(rel, p['_rel0']))
            if p.get('tip'): tips.append(vlist(back(ev.pose.bones[p['tip']].head), 4))
        row['feet'] = {s: vlist(back(footw[s][-1]), 5) for s in SIDES}
        evals.append(row)
    slide_after = {}
    for s in SIDES:
        worst = 0
        for a, e in plants[s]:
            span = footw[s][a:e + 1]; c = sum(span, Vector()) / len(span); worst = max(worst, max((p - c).xy.length for p in span))
        slide_after[s] = round(worst * 100, 2)
    bpy.data.objects.remove(rig, do_unlink=True)

    # root travel sidecar
    tr = [vlist(back(o), 5) for o in travel]; tot = travel[-1] - travel[0]
    root = {'clip': clip, 'mode': ROOT, 'fps': rate, 'frames': n, 'seconds': round(dur, 5),
            'travel': tr, 'total': vlist(back(tot), 4), 'distance': round(tot.length, 4),
            'speed': round(tot.length / dur, 4) if dur > 0 else 0,
            'unitsPerFrame': round(tot.length / dur * UNITS / 60, 5) if (UNITS and dur > 0) else None,
            'note': 'metres in the model\'s axes (x her left, y up, z forward); unitsPerFrame is game units per game frame (60 a second)'}
    save_json(os.path.join(OUT, clip + '.root.json'), root)
    keys = {'source': os.path.basename(path), 'action': act.name, 'clip': clip, 'fps': rate, 'frames': frames,
            'sourceFps': round(src_fps, 4), 'sourceFrames': [f0, f1], 'sourceKeys': native_keys, 'sourceKeyRate': key_rate, 'seconds': round(dur, 5),
            'target': prof['name'], 'base': prof.get('basePose'), 'options': {'root': ROOT, 'plant': PLANT, 'wrists': WRISTS, 'props': PROPS, 'feet': FEET, 'limbs': LIMBS}}
    save_json(os.path.join(OUT, clip + '.keys.json'), keys, compact=True)
    if EVAL:
        save_json(os.path.join(OUT, 'eval', clip + '.json'), {'clip': clip, 'basis': qlist(B), 'scale': k, 'rows': evals, 'plants': plants,
                  'travel': tr, 'drive': drive, 'roles': R}, compact=True)
    rep = {'source': os.path.basename(path), 'action': act.name, 'sourceFps': round(src_fps, 4), 'sourceFrames': [f0, f1], 'sourceKeys': native_keys, 'sourceKeyRate': key_rate,
           'seconds': round(dur, 5), 'fps': rate, 'frames': n, 'legScale': round(k, 5), 'basis': qlist(B, 5),
           'map': mapinfo, 'unmappedTargetRoles': [r for r in ROLES if r not in drive],
           'handReachMm': round(stats['handReach'] * 1000, 2), 'footReachMm': round(stats['footReach'] * 1000, 2),
           'maxRotErrDeg': {r: round(v, 3) for r, v in stats['rotErr'].items()},
           'limbDirErrDeg': {r: round(v, 2) for r, v in stats['limbDirErr'].items()},
           'propRigidDeg': round(stats['propRigid'], 4), 'plants': {s: len(plants[s]) for s in SIDES},
           'footSlideCm': {'source': slide_before, 'result': slide_after}, 'rootTravelM': round(tot.length, 4),
           'tipRange': [vlist([min(t[i] for t in tips) for i in range(3)], 3), vlist([max(t[i] for t in tips) for i in range(3)], 3)] if tips else None}
    log('%s: %d frames at %g fps (source %g fps, %.3f s), legs x%.3f, hands within %.1f mm, feet within %.1f mm, plants %s, travel %.2f m'
        % (clip, n, rate, src_fps, dur, k, rep['handReachMm'], rep['footReachMm'], rep['plants'], tot.length))
    return rep


def clean(s): return ''.join(c if c.isalnum() or c in '-_' else '_' for c in s).strip('_')


report = {'target': prof['name'], 'options': {'fps': FPS_OUT, 'native': NATIVE, 'root': ROOT, 'plant': PLANT, 'wrists': WRISTS, 'props': PROPS}, 'clips': {}}
for path in files:
    arm, acts, fps = load_source(path)
    if not acts: log('no animation in %s, skipped' % path); continue
    sk = rest_skeleton(arm)
    R, info = get_map(sk, path)
    stem = clean(os.path.splitext(os.path.basename(path))[0])
    for act in acts:
        clip = opt['name'] if (opt.get('name') and len(acts) == 1 and len(files) == 1) else (stem if len(acts) == 1 else stem + '_' + clean(act.name.split('|')[-1]))
        report['clips'][clip] = retarget_clip(arm, act, fps, R, info, path, clip)
save_json(os.path.join(OUT, 'report.json'), report)
if opt.get('dummy'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=0.02, location=(0, 0, 0.05))
    bpy.ops.export_scene.gltf(filepath=opt['dummy'], export_format='GLB')
log('%d clips -> %s' % (len(report['clips']), OUT))
