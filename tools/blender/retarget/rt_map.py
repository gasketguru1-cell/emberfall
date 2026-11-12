# Automatic bone mapping: finds the humanoid roles (hips, spine, chest, head, arms, legs, hands, feet) in any source
# skeleton from its shape first (which chains go down, which go out to the sides, which goes up), then reads left and
# right from the names where they say so, and from the toes otherwise. Names are only a tiebreaker and a cross-check,
# so Mixamo, CMU/BVH, Unreal, Unity/VRM, Rigify or plain "bone.001" rigs all go through the same code.
#   skeleton: { name: { 'parent': name|None, 'head': Vector, 'tail': Vector } } in Blender world space (Z up), at rest.
import re
from mathutils import Vector

ROLE_WORDS = {   # names that agree with a role (for the report; never needed for the mapping itself)
    'hips': r'hip|pelvis|cog|root', 'spine': r'spine|back|abdomen|torso|waist', 'chest': r'chest|spine|thorax|torso|upperback',
    'head': r'head', 'upperArm': r'arm|humerus|shoulder', 'foreArm': r'fore|lowerarm|radius|elbow|ulna', 'hand': r'hand|wrist|palm',
    'thigh': r'thigh|upleg|upperleg|femur|hip', 'shin': r'leg|shin|calf|knee|tibia|lowerleg', 'foot': r'foot|ankle', 'toe': r'toe|ball',
}
WEAPON = re.compile(r'weapon|sword|blade|prop|handle|tool|grip|wpn', re.I)
END = re.compile(r'end|top|nub|site|tip$', re.I)


def name_side(n):
    s = n.split(':')[-1]
    low = s.lower()
    if 'left' in low: return 'L'
    if 'right' in low: return 'R'
    if re.search(r'(^|[\W_])l([\W_]|$)', low) or re.search(r'[\._ ]l\d*$', low): return 'L'
    if re.search(r'(^|[\W_])r([\W_]|$)', low) or re.search(r'[\._ ]r\d*$', low): return 'R'
    if re.match(r'^L[A-Z]', s) or re.search(r'[a-z]L$', s): return 'L'
    if re.match(r'^R[A-Z]', s) or re.search(r'[a-z]R$', s): return 'R'
    if re.match(r'^l(femur|tibia|foot|toes|clavicle|humerus|radius|wrist|hand|fingers|thumb|hipjoint|collar|shoulder|up|low)', low): return 'L'
    if re.match(r'^r(femur|tibia|foot|toes|clavicle|humerus|radius|wrist|hand|fingers|thumb|hipjoint|collar|shoulder|up|low)', low): return 'R'
    return None


def build(sk):
    kids = {n: [] for n in sk}
    for n, b in sk.items():
        if b['parent'] in sk: kids[b['parent']].append(n)
    sub = {}
    def collect(n):
        if n in sub: return sub[n]
        out = [n]
        for c in kids[n]: out += collect(c)
        sub[n] = out; return out
    for n in sk: collect(n)
    return kids, sub


def map_skeleton(sk, forward_hint=None):
    """Returns (roles, info). roles: role -> bone name (sided roles as 'thigh.L'). Raises ValueError if no humanoid is found."""
    kids, sub = build(sk)
    pts = lambda n: [sk[m]['head'] for m in sub[n]] + [sk[m]['tail'] for m in sub[n]]
    allz = [p.z for n in sk for p in (sk[n]['head'], sk[n]['tail'])]
    H = max(allz) - min(allz)
    if H <= 0: raise ValueError('flat skeleton')
    depth = {}
    def dep(n):
        if n not in depth: depth[n] = 0 if sk[n]['parent'] not in sk else dep(sk[n]['parent']) + 1
        return depth[n]
    minz = lambda n: min(p.z for p in pts(n))
    maxz = lambda n: max(p.z for p in pts(n))
    # hips: the deepest bone with two child branches reaching well below it (the legs)
    cand = []
    for n in sk:
        z = sk[n]['head'].z
        down = [c for c in kids[n] if minz(c) < z - 0.3 * H]
        if len(down) >= 2: cand.append(n)
    if not cand: raise ValueError('no hips: no bone has two legs below it')
    hips = max(cand, key=lambda n: (dep(n), len(kids[n])))
    z0 = sk[hips]['head'].z
    legs = sorted([c for c in kids[hips] if minz(c) < z0 - 0.3 * H], key=minz)[:2]
    ups = [c for c in kids[hips] if c not in legs and maxz(c) > z0 + 0.2 * H]
    if not ups:   # some rigs hang the spine off the hips' parent
        ups = [c for c in kids.get(sk[hips]['parent'], []) if c != hips and maxz(c) > z0 + 0.2 * H] if sk[hips]['parent'] in sk else []
    if not ups: raise ValueError('no spine above the hips')
    # the up chain: always the child that reaches highest
    up = [max(ups, key=maxz)]
    while kids[up[-1]]: up.append(max(kids[up[-1]], key=maxz))
    axis = sk[hips]['head']
    horiz = lambda p: Vector((p.x - axis.x, p.y - axis.y)).length
    reach = lambda n: max(horiz(p) for p in pts(n))
    chest, arms = None, []
    for n in up:
        lat = [c for c in kids[n] if c not in up and reach(c) > 0.12 * H and maxz(c) > z0]
        if len(lat) >= 2: chest, arms = n, sorted(lat, key=reach)[-2:]; break
    if not chest: raise ValueError('no arms off the spine')
    ci = up.index(chest)
    spine = up[0]   # the first bone up from the hips (its turn is the lower back's); the chest is where the arms branch
    after = up[ci + 1:]
    blen = lambda n: (sk[n]['tail'] - sk[n]['head']).length
    while len(after) > 1 and not kids[after[-1]] and (END.search(after[-1].split(':')[-1]) or blen(after[-1]) < 0.06 * H) and 'head' not in after[-1].lower().replace('headtop', ''):
        after = after[:-1]   # an end marker above the head
    named = [n for n in after if 'head' in n.lower() and not END.search(n.split(':')[-1])]
    head = named[0] if named else (after[-1] if after else chest)
    head_tip = next((c for c in kids[head] if c in up), None) if head != chest else None

    def chain(n):
        out = [n]
        while kids[out[-1]]: out.append(max(kids[out[-1]], key=lambda c: len(sub[c])))
        return out
    seg = lambda a, b: (sk[b]['head'] - sk[a]['head']).length

    def limb(start, kind):
        c = chain(start)
        if len(c) >= 2 and seg(c[0], c[1]) < 0.6 * (seg(c[1], c[2]) if len(c) > 2 else 1e9) and (kind == 'leg' or horiz(sk[c[0]]['head']) < 0.12 * H):
            c = c[1:]   # a clavicle or hip-joint stub
        if len(c) < 3: raise ValueError('%s chain from %s is too short' % (kind, start))
        return c
    legc = [limb(l, 'leg') for l in legs]
    armc = [limb(a, 'arm') for a in arms]
    # sides: from the names when both members of a pair agree; else from where the toes point
    def toe_fwd():
        f = Vector((0, 0, 0))
        for c in legc:
            if len(c) >= 4: v = sk[c[3]]['head'] - sk[c[2]]['head']; v.z = 0; f += v
        return f.normalized() if f.length > 1e-6 else None
    fwd = forward_hint or toe_fwd()
    info = {'hips': hips, 'H': H, 'sideFrom': {}}
    roles = {'hips': hips, 'spine': spine, 'chest': chest, 'head': head}
    if head_tip: roles['headTip'] = head_tip
    for kind, chains in (('leg', legc), ('arm', armc)):
        sides = [None, None]
        for i, c in enumerate(chains):
            votes = [name_side(n) for n in c]
            votes = [v for v in votes if v]
            sides[i] = max(set(votes), key=votes.count) if votes else None
        how = 'names'
        if sides[0] is None or sides[1] is None or sides[0] == sides[1]:
            f = fwd if fwd is not None else Vector((0, -1, 0))
            how = 'toes' if fwd is not None else 'assumed facing -Y'
            left = Vector((0, 0, 1)).cross(f)
            centre = (sk[chains[0][0]]['head'] + sk[chains[1][0]]['head']) / 2
            d0 = (sk[chains[0][1]]['head'] - centre).dot(left)
            sides = ['L', 'R'] if d0 > 0 else ['R', 'L']
        info['sideFrom'][kind] = how
        for c, s in zip(chains, sides):
            if kind == 'leg':
                roles['thigh.' + s], roles['shin.' + s], roles['foot.' + s] = c[0], c[1], c[2]
                if len(c) >= 4: roles['toe.' + s] = c[3]
            else:
                roles['upperArm.' + s], roles['foreArm.' + s], roles['hand.' + s] = c[0], c[1], c[2]
                hk = kids[c[2]]
                mid = [k for k in hk if 'middle' in k.lower() or 'mid' in k.lower()]
                pick = mid[0] if mid else (max(hk, key=lambda k: len(sub[k])) if hk else None)
                if pick and not WEAPON.search(pick): roles['handTip.' + s] = pick
                wep = [m for m in sub[c[2]] if m != c[2] and WEAPON.search(m.split(':')[-1])]
                if wep: roles['weapon.' + s] = min(wep, key=dep)
    # cross-check with the names
    agree, disagree = [], []
    for r, n in roles.items():
        base = r.split('.')[0]
        if base not in ROLE_WORDS: continue
        (agree if re.search(ROLE_WORDS[base], n.split(':')[-1], re.I) else disagree).append(r)
    info['namesAgree'] = sorted(agree); info['namesDisagree'] = sorted(disagree)
    return roles, info
