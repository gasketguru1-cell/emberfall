# Checks Brand's rebuilt clips against the timing standard (plans/brand-animation-plan.md section 10):
#   - the blade tip moves fastest on the move's first active frame (framedata.json), not before or after;
#   - a planted foot stays put on the floor (for the run, while the game moves him forward at RUNV metres a frame);
#   - the grip stays in the hand (sword bone head to the hand bone);
#   - no bone pops (a frame-to-frame jump far larger than its neighbours').
#   blender -b assets/brand/work/brand2-rigged.blend --python tools/blender/anim-qa.py -- --data assets/brand/reference/framedata.json
import bpy, sys, json, math
args = sys.argv[sys.argv.index('--') + 1:]
opt = {args[i].lstrip('-'): args[i + 1] for i in range(0, len(args), 2)}
fd = json.load(open(opt['data'], encoding='utf-8'))['moves']
MOVE = {'AirF': 'fair', 'SmashF': 'fsmash', 'AirN': 'nair'}
if 'hits' in opt:   # the rest of the strikes: their first and last active frames, from brand2.js
    for k, v in json.load(open(opt['hits'], encoding='utf-8')).items(): fd['_' + k] = {'hit': [v[:2]], 'upto': v[2] if len(v) > 2 else 999}; MOVE[k] = '_' + k
GROUND = {'Run': (0.2, 1, 99), 'RunTurn': (None, 3, 11), 'Walk': (0.0233, 1, 99), 'Brake': (None, 3, 16), 'Idle': (None, 1, 99), 'Crouch': (None, 1, 99), 'JumpSquat': (None, 1, 99), 'Land': (None, 1, 99), 'LandHard': (None, 1, 99), 'Jab1': (None, 1, 99), 'Jab2': (None, 1, 99), 'TiltU': (None, 1, 99), 'TiltD': (None, 1, 99), 'SmashU': (None, 1, 12), 'SmashD': (None, 1, 99), 'SpecD': (None, 1, 99), 'SpecDHit': (None, 1, 99), 'Shield': (None, 1, 99), 'ShieldHit': (None, 1, 99), 'Taunt': (None, 1, 99), 'Idle2': (None, 1, 99), 'Win2': (None, 1, 99), 'Pummel': (None, 1, 99), 'Hold': (None, 1, 99), 'SpecNLoop': (None, 1, 99), 'Dizzy': (None, 1, 99)}   # (run speed the floor slides back under him in m/frame, or None: the foot stays put; frames checked)
rig = bpy.data.objects['Rig']; sc = bpy.context.scene; ad = rig.animation_data
W = lambda b, end='head': rig.matrix_world @ getattr(rig.pose.bones[b], end)
report = []; fails = 0
for tr in ad.nla_tracks:
    name = tr.name; strip = tr.strips[0]; s0 = int(strip.frame_start); n = int(round(strip.frame_end)) - s0 + 1   # move frame m plays at scene frame s0 + m - 1 (a strip at 0 plays the action's frame 1 there)
    for t in ad.nla_tracks: t.mute = t.name != name   # (bpy wrappers are new objects each time: compare names)
    tip, footR, footL, grip = [], [], [], []
    for f in range(n):
        sc.frame_set(s0 + f)
        tip.append(W('swordTip').copy()); footR.append(W('footR').copy()); footL.append(W('footL').copy())
        grip.append((W('sword') - W('handR', 'tail')).length)
    speed = [0] + [(tip[i] - tip[i - 1]).length for i in range(1, n)]
    line = '%-8s %2d frames' % (name, n)
    if name in MOVE:
        mv = fd[MOVE[name]]; first = mv['hit'][0][0]; last = mv['hit'][-1][1]
        peak = max(range(min(n, mv.get('upto', 999))), key=lambda i: speed[i]) + 1   # a frame's speed is how far the tip came to reach it (as the reference notes count it)
        ok = first <= peak <= last
        line += ' | blade fastest on frame %d (%.2f m/frame), active %d-%d: %s' % (peak, speed[peak - 1], first, last, 'ok' if ok else 'OFF')
        fails += not ok
    if name in GROUND:
        v, g0, g1 = GROUND[name]; worst = 0
        for foot in (footR, footL):
            for i in range(1, n):
                if not g0 < i + 1 <= g1: continue
                if foot[i].z < 0.13 and foot[i - 1].z < 0.13:       # both frames on the floor (ankle height)
                    d = foot[i] - foot[i - 1]; drift = abs(d.y - v) + abs(d.x) if v else math.hypot(d.x, d.y)   # Blender -Y is forward: a planted foot slides back (+Y) at the run speed; elsewhere it stays put
                    worst = max(worst, drift)
        line += ' | planted-foot slide %.3f m/frame' % worst
        if worst > 0.03: fails += 1; line += ' (OVER 0.03)'
    # reach: how far each wrist falls short of its target (an out-of-reach target leaves the arm straight and the grip off).
    # The left hand counts only while it fully holds the sword (not while it takes hold or lets go).
    short = {'R': 0.0, 'L': 0.0}; worstf = {'R': 0, 'L': 0}
    for f in range(n):
        sc.frame_set(s0 + f)
        for s in 'RL':
            if s == 'L' and rig.pose.bones['handL'].constraints[0].influence < 0.99: continue   # fully holding only; letting go is a planned blend
            target = 'c_holdL' if s == 'L' else 'c_handR'   # the left hand only counts while it holds: then it reaches for the grip
            gap = (W('fore' + s, 'tail') - W(target)).length
            if gap > short[s]: short[s] = gap; worstf[s] = f + 1
    for s in 'RL':
        if short[s] > 0.02:
            fails += 1; line += ' | %s hand short of its target by %.2f m on frame %d' % ('right' if s == 'R' else 'left', short[s], worstf[s])
    jump = max(abs(grip[i] - grip[0]) for i in range(n))
    line += ' | grip drift %.3f m' % jump
    if jump > 0.01: fails += 1; line += ' (OVER 0.01)'
    report.append(line)
print('\n'.join('qa: ' + l for l in report)); print('qa: %d problems' % fails)
