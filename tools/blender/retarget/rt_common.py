# Shared helpers for the retarget pipeline (runs inside Blender's Python: needs mathutils).
# Spaces: "model" is Emberfall's spec space (metres, Y up, the fighter faces +Z, +X is the fighter's left);
# "Blender" is Z up, the fighter faces -Y, +X is the fighter's left. rig.py converts with conv/back below.
import math, json, os, hashlib
from mathutils import Vector, Matrix, Quaternion

conv = lambda p: Vector((p[0], -p[2], p[1]))                     # model -> Blender
back = lambda v: [v[0], v[2], -v[1]]                              # Blender -> model
RIGHT, UP, FWD = Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))   # rig.py's axes (RIGHT is the model's +X)


def rig_delta(rot):
    # rig.py's "rot": [pitch, yaw, roll] degrees about the model's own axes, as a world-axis turn (Quaternion, Blender axes)
    p, y, r = (math.radians(a) for a in rot)
    return Quaternion(UP, y) @ Quaternion(RIGHT, p) @ Quaternion(FWD, r)


def frame_quat(d, s):
    # the turn whose X axis is d and whose Y axis is s made square to d (Z = X x Y)
    d = d.normalized()
    s = s - d * s.dot(d)
    if s.length < 1e-6:   # s along d: any square axis will do
        s = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0))
        s = s - d * s.dot(d)
    s.normalize()
    return Matrix((d, s, d.cross(s))).transposed().to_quaternion()


def swing(a, b):
    # the shortest turn taking direction a to direction b
    return a.normalized().rotation_difference(b.normalized())


def qlist(q, nd=6):
    return [round(c, nd) for c in q]


def vlist(v, nd=5):
    return [round(c, nd) for c in v]


def angle_deg(qa, qb):
    d = abs(qa.normalized().dot(qb.normalized()))
    return math.degrees(2 * math.acos(min(1.0, d)))


def dir_angle_deg(a, b):
    if a.length < 1e-9 or b.length < 1e-9: return 0.0
    return math.degrees(a.normalized().angle(b.normalized(), 0.0))


def signature(bones):
    # a skeleton's identity: its bone names and parents (two files from the same rig share a bone map)
    s = '|'.join('%s<%s' % (n, bones[n]['parent'] or '') for n in sorted(bones))
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]


def load_json(p):
    with open(p, encoding='utf-8') as f: return json.load(f)


def save_json(p, data, compact=False):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        if compact: json.dump(data, f, separators=(',', ':'))
        else: json.dump(data, f, indent=1)
