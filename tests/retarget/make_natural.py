# A hand-keyed, natural-looking walk on the Mixamo-style test skeleton, for judging the retarget by eye
# (make_samples.py's motions exercise every joint on purpose and look odd; this one is meant to look like walking).
#   blender -b --factory-startup --python tests/retarget/make_natural.py -- --out <dir>
# Writes <dir>/test_natural.fbx (T-pose rest, centimetres, 30 fps) with one take, "Walk": 2 s, two full strides at 1.2 m/s,
# a loop. Arms hang at the sides and swing opposite the legs, elbows soften on the forward swing, heels strike and toes
# push off, the pelvis turns and dips a little and the chest turns against it, and the head stays level and forward.
import bpy, sys, os, math
from mathutils import Vector, Quaternion
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_samples as ms

OUT = ms.OUT
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
CYCLE, SPEED, STANCE = 1.0, 1.2, 0.6          # seconds per stride (two steps), metres a second, share of the stride a foot is down
STEP = SPEED * CYCLE
ANKLE_Z = ms.P('foot')[2]
TOE = Vector((0, -0.13, -0.06))               # ankle to the ball of the foot, at rest
HEEL = Vector((0, 0.05, -0.08))               # ankle to the heel
smooth = lambda u: u * u * (3 - 2 * u)

def pitch_of(c):
    # foot pitch (+ = toe down) over a stride; c = 0 is heel strike
    if c < 0.1: return math.radians(-10) * (1 - smooth(c / 0.1))                    # toe lowers onto the floor
    if c < 0.42: return 0.0
    if c < STANCE: return math.radians(28) * smooth((c - 0.42) / (STANCE - 0.42))  # heel rises, rolling over the toe
    u = (c - STANCE) / (1 - STANCE)                                                # swing: toe lifts, then reaches heel-first
    return math.radians(28) * (1 - smooth(min(1, u / 0.45))) - math.radians(10) * smooth(max(0, (u - 0.3) / 0.7))

def ankle_on_floor(x, y_plant, c):
    # ankle position while the foot is down: rolls about the heel early, about the toe late
    a = Vector((x, -y_plant, ANKLE_Z)); p = pitch_of(c); R = Quaternion(X, p)
    if p < 0: pivot = a + HEEL; return pivot + R @ (-HEEL)
    pivot = a + TOE; return pivot + R @ (-TOE)

def natural(clip, t, T):
    w = 2 * math.pi * t / CYCLE
    pelvis = Quaternion(Z, math.radians(-5) * math.cos(w)) @ Quaternion(Y, math.radians(-3) * math.sin(w))   # swing-side hip dips
    lean = Quaternion(X, math.radians(4))
    hips = ms.P('hips') + Vector((0.015 * math.sin(w), -SPEED * t, -0.065 - 0.015 * math.cos(2 * w)))
    q = {'hips': pelvis}
    q['chest'] = Quaternion(Z, math.radians(4) * math.cos(w)) @ lean
    q['spine'] = pelvis.slerp(q['chest'], 0.5)
    q['head'] = Quaternion(X, math.radians(-2))                                      # level, looking ahead
    feet = {}
    for S, ph, s in (('L', 0.0, 1), ('R', 0.5, -1)):
        k = t / CYCLE - ph; K = math.floor(k); c = k - K
        x = 0.085 * s
        plant = lambda n: STEP * (n + ph) + 0.28                                      # where stride n's foot lands (ahead of the hips)
        if c < STANCE:
            a = ankle_on_floor(x, plant(K), c)
        else:
            u = (c - STANCE) / (1 - STANCE); e = smooth(u)
            a0, a1 = ankle_on_floor(x, plant(K), STANCE - 1e-6), ankle_on_floor(x, plant(K + 1), 0.0)
            a = a0.lerp(a1, e) + Vector((0, 0, 0.07 * math.sin(math.pi * min(1, u * 1.15))))
        feet[S] = a; ms.FOOTQ[S] = Quaternion(X, pitch_of(c))
    for S, s in (('L', 1), ('R', -1)):
        fwd = -math.cos(w) * s                                                        # +1 = this arm fully forward (opposite leg forward)
        swing = Quaternion(X, math.radians(-20) * fwd)                                # negative turns the hanging arm forward
        up = q['chest'] @ swing @ Quaternion(Y, math.radians(80) * s)   # down to 10 degrees off the body
        q['upperArm.' + S] = up
        bend = math.radians(14 + 14 * max(0, fwd))
        q['foreArm.' + S] = up @ Quaternion(Vector((0, 0, -s)), bend)
        q['hand.' + S] = q['foreArm.' + S]
    return q, hips, feet, pelvis

ms.motion = natural
ob, spec = ms.build('mixamo')
act, N, _ = ms.animate(ob, spec, 'Walk', 2.0)
for tr in list(ob.animation_data.nla_tracks): ob.animation_data.nla_tracks.remove(tr)
act.use_fake_user = True; ob.animation_data.action = None
for pb in ob.pose.bones: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)
bpy.context.view_layer.update()
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
path = os.path.join(OUT, 'test_natural.fbx')
bpy.ops.export_scene.fbx(filepath=path, object_types={'ARMATURE'}, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
                         bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'test_natural.blend'), copy=True)
print('make_natural: %d frames -> %s' % (N + 1, path))
