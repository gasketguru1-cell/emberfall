# Checks the retarget pipeline's output against the synthetic sources' known answer (tests/retarget/make_samples.py).
#   python -I tests/retarget/check.py <workdir>      (after tests/retarget/run.sh has filled <workdir>/run)
# Plain Python, no Blender. Exits 1 if any check fails.
import json, math, os, sys

W = sys.argv[1]; RUN = os.path.join(W, 'run')
truth = json.load(open(os.path.join(W, 'samples', 'truth.json')))
fails, passes = [], 0
def ok(cond, what):
    global passes
    if cond: passes += 1
    else: fails.append(what)

def qrot(q, v):
    w, x, y, z = q; vx, vy, vz = v
    tx = 2 * (y * vz - z * vy); ty = 2 * (z * vx - x * vz); tz = 2 * (x * vy - y * vx)
    return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
def ang(a, b):
    la = math.sqrt(sum(c * c for c in a)); lb = math.sqrt(sum(c * c for c in b))
    return math.degrees(math.acos(max(-1, min(1, sum(p * q for p, q in zip(a, b)) / (la * lb)))))
def qang(a, b): return math.degrees(2 * math.acos(min(1, abs(sum(p * q for p, q in zip(a, b))))))
back = lambda v: [v[0], v[2], -v[1]]   # Blender -> model
load = lambda *p: json.load(open(os.path.join(*p)))

ROT = ['hips', 'spine', 'chest']
ARMS = ['upperArm.L', 'foreArm.L', 'upperArm.R', 'foreArm.R']
LEGS = ['thigh.L', 'shin.L', 'thigh.R', 'shin.R']
maps = {m: load(RUN, 'maps', m) for m in os.listdir(os.path.join(RUN, 'maps'))}
summary = []
for style, T in truth.items():
    fps = T['fps']
    keysets = {}
    # the truth is in the .blend's world; a BVH file keeps no object turn or scale, so every format is compared in the
    # target's space through the .blend run's basis and leg scale
    ref_rep = load(RUN, style + '_blend', 'report.json')['clips']
    for fmt in ('blend', 'fbx', 'glb', 'bvh', 'pose', 'bentrest'):
        d = os.path.join(RUN, '%s_%s' % (style, fmt))
        if not os.path.isdir(d): continue
        rep = load(d, 'report.json')
        for clip in ('Walk', 'Spin'):
            name = ('sample_%s_bentrest_%s' if fmt == 'bentrest' else 'sample_%s_%s') % (style, clip); tag = '%s %s %s' % (style, fmt, clip)
            ref = ref_rep['sample_%s_%s' % (style, clip)]
            ok(name in rep['clips'], tag + ': clip found (have %s)' % list(rep['clips']))
            if name not in rep['clips']: continue
            r = rep['clips'][name]; tc = T['clips'][clip]; ev = load(d, 'eval', name + '.json')
            # bone map: every role the source has is the one it was built with
            roles = ev['roles']; wrong = [k for k, v in T['roles'].items() if roles.get(k) != v and not (fmt == 'bvh' and roles.get(k, '').split(':')[-1] == v.split(':')[-1])]
            ok(not wrong, tag + ': bone map wrong for ' + ', '.join('%s=%s (want %s)' % (k, roles.get(k), T['roles'][k]) for k in wrong))
            # time: same length, every 60th of a second
            ok(abs(r['seconds'] - tc['seconds']) < 1e-4, tag + ': %.4f s, want %.4f' % (r['seconds'], tc['seconds']))
            ok(r['frames'] == round(tc['seconds'] * 60) + 1 == len(ev['rows']), tag + ': %d frames, want %d' % (r['frames'], round(tc['seconds'] * 60) + 1))
            ok(abs(r['sourceFps'] - fps) < 1e-3 or fmt == 'glb', tag + ': source fps %s, want %s' % (r['sourceFps'], fps))
            ok(r['sourceKeyRate'] is not None and abs(r['sourceKeyRate'] - fps) < 0.5, tag + ': keyed at %s a second, want %s' % (r['sourceKeyRate'], fps))
            # directions against the truth (on the source's own frames, and between them)
            B = load(RUN, style + '_blend', 'eval', 'sample_%s_%s.json' % (style, clip))['basis']; on, off = 0.0, 0.0; worst = ''
            check = ROT + ARMS + (LEGS if fmt == 'pose' else [])
            for i, row in enumerate(ev['rows']):
                trow = tc['rows'][i]; key = abs(i * fps / 60 - round(i * fps / 60)) < 1e-6
                for role in check:
                    if sum(c * c for c in trow[role]) < 1e-12: continue   # a zero-length truth (CMU's hips and lower back share a point)
                    e = ang(row[role], qrot(B, trow[role]))
                    if key and e > on: on, worst = e, role
                    if not key: off = max(off, e)
            # a rest pose written mid-walk faces the way the hips did in that frame (here 2 degrees off); legs posed exactly
            # swing fast enough that a 24-25 fps source, read between its frames, is up to 2 degrees from the 60 fps truth
            tol_on, tol_off = (2.5, 2.5) if fmt == 'bentrest' else (0.5, 2.5 if fmt == 'pose' else 1.5)
            ok(on < tol_on, tag + ': directions off by %.3f deg on source frames (%s)' % (on, worst))
            ok(off < tol_off, tag + ': directions off by %.3f deg between source frames' % off)
            ok(r['handReachMm'] < 1 and r['footReachMm'] < 1, tag + ': IK reach hands %.2f mm feet %.2f mm' % (r['handReachMm'], r['footReachMm']))
            ok(max(r['maxRotErrDeg'].values()) < 0.05, tag + ': turn error %s' % r['maxRotErrDeg'])
            ok(r['propRigidDeg'] < 0.01 or (fmt == 'pose' and style == 'odd'), tag + ': sword moved in the hand by %.4f deg' % r['propRigidDeg'])
            # feet planted in the truth stay planted (the game moves the fighter, so the travel is added back)
            if clip == 'Walk':
                for s in 'LR':
                    fp = [row['feetPos'][s] for row in tc['rows']]
                    still = [i > 0 and i < len(fp) - 1 and math.dist(fp[i - 1], fp[i + 1]) < 1e-4 for i in range(len(fp))]
                    i, worst_cm, spans = 0, 0.0, 0
                    while i < len(still):
                        if not still[i]: i += 1; continue
                        e = i
                        while e + 1 < len(still) and still[e + 1]: e += 1
                        a, b = i + 4, e - 4
                        if b - a >= 4 and fmt != 'pose':
                            spans += 1; pts = [ev['rows'][k]['feet'][s] for k in range(a, b + 1)]
                            c = [sum(p[m] for p in pts) / len(pts) for m in range(3)]
                            worst_cm = max(worst_cm, max(math.dist([p[0], p[2]], [c[0], c[2]]) for p in pts) * 100)
                        i = e + 1
                    if fmt != 'pose': ok(spans >= 2 and worst_cm < 1.0, tag + ': foot %s slides %.2f cm over %d planted spans' % (s, worst_cm, spans))
                want = 1.2 * ref['legScale']
                ok(abs(r['rootTravelM'] - want) < 0.01 * want, tag + ': root travel %.4f m, want %.4f' % (r['rootTravelM'], want))
                rt = load(d, name + '.root.json'); ok(len(rt['travel']) == r['frames'] and rt['unitsPerFrame'] > 0, tag + ': root sidecar')
            else:
                ok(r['rootTravelM'] < 0.005, tag + ': spin travels %.4f m' % r['rootTravelM'])
            # keys: no sign flips or jumps (the spin turns 6 degrees a frame)
            K = load(d, name + '.keys.json'); worst_step = 0.0
            for bn in K['frames'][0]:
                if 'qb' not in K['frames'][0][bn]: continue
                for f0, f1 in zip(K['frames'], K['frames'][1:]):
                    a, b = f0[bn]['qb'], f1[bn]['qb']
                    ok(sum(p * q for p, q in zip(a, b)) >= 0, tag + ': %s flips sign' % bn) if sum(p * q for p, q in zip(a, b)) < 0 else None
                    worst_step = max(worst_step, qang(a, b))
            ok(worst_step < 15, tag + ': a key jumps %.2f deg in one frame' % worst_step)
            ok(K['fps'] == 60 and len(K['frames']) == r['frames'], tag + ': keys at 60 a second')
            if fmt not in ('pose', 'bentrest'): keysets[(fmt, clip)] = K
            summary.append('%-26s dir %.3f/%.3f deg  reach %.2f/%.2f mm  turn %.3f  sword %.4f  plants %s  slide %s cm  travel %.3f m' % (
                tag, on, off, r['handReachMm'], r['footReachMm'], max(r['maxRotErrDeg'].values()), r['propRigidDeg'], r['plants'], r['footSlideCm']['result'], r['rootTravelM']))
    # every format of the same motion gives the same keys
    for clip in ('Walk', 'Spin'):
        ref = keysets.get(('blend', clip))
        for fmt in ('fbx', 'glb', 'bvh'):
            K = keysets.get((fmt, clip))
            if not ref or not K: continue
            dq, dm = 0.0, 0.0
            for fa, fb in zip(ref['frames'], K['frames']):
                for bn, e in fa.items():
                    if 'qb' in e: dq = max(dq, qang(e['qb'], fb[bn]['qb']))
                    if 'move' in e: dm = max(dm, math.dist(e['move'], fb[bn]['move']))
            ok(dq < 0.5 and dm < 0.002, '%s %s: %s keys differ from .blend by %.3f deg / %.2f mm' % (style, clip, fmt, dq, dm * 1000))
            summary.append('%-26s same as .blend within %.4f deg, %.3f mm' % ('%s %s %s' % (style, fmt, clip), dq, dm * 1000))
# bone maps: one per skeleton, reused by every later file of it
reused = {}
for style in truth:
    for fmt in ('blend', 'fbx', 'glb', 'bvh', 'pose', 'bentrest'):
        if not os.path.isdir(os.path.join(RUN, '%s_%s' % (style, fmt))): continue
        rep = load(RUN, '%s_%s' % (style, fmt), 'report.json'); first = next(iter(rep['clips'].values()))['map']   # one map per run
        reused.setdefault(first['signature'], []).append(first['reused'])
ok(len(reused) == len(truth) and all(v[0] is False and all(v[1:]) for v in reused.values()), 'bone maps: a skeleton was not mapped once and then reused: %s' % reused)
summary.append('bone maps: %d skeletons, %s' % (len(reused), {k: '%d runs, %d reused' % (len(v), v.count(True)) for k, v in reused.items()}))
print('\n'.join(summary))
print('\nretarget checks: %d passed, %d failed' % (passes, len(fails)))
for f in fails: print('  FAIL ' + f)
sys.exit(1 if fails else 0)
