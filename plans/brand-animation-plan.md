# Brand: swordfighter animation plan (for approval)

**Status:** plan only. Nothing gets built until you approve it.
**Decided (2026-11-11):** Brand becomes a pure swordsman. Each move's startup, active frames and landing lag follow Melee Marth's public frame data. Move names, poses, sword paths and the look are Brand's own. The Chop Chop shield kit is replaced.
**Model:** `Meshy_AI_Crimson_Gearblade_Guardian_20261112_texture.blend` (Downloads). Checked: one unrigged mesh, 651k verts / 1.30M faces, A-pose, 1.83 m tall, long cape, goggles, lantern on the hip, three 2048² textures. The sword is a separate piece of the same mesh, standing upright beside him (about 1.6 m), so it can be cut out cleanly.

---

## 1. Reference sources

| Source | What it gives | Use |
|---|---|---|
| SSBWiki move pages (`Marth_(SSBM)/<move>`, one page per move) | startup, active, IASA, landing lag, autocancel and damage per move | main timing source (measured) |
| SSBWiki `Marth_(SSBM)/Hitboxes` | per-move hitbox GIFs | where the sword is on each active frame (measured by eye, frame by frame) |
| SSBWiki main Marth page | NTSC movement stats, jump airtimes, fast-fall windows | movement timing (measured) |
| Kadano's frame-data thread on Smashboards (linked from SSBWiki) | cross-check | fills gaps, flags disagreements |
| meleeframedata.com | full table | its certificate is expired today; retry later as a cross-check |
| Frame-by-frame gameplay footage (frame-step a public video) | silhouettes, weight shifts, where the hips and shoulders lead | qualitative standard only (estimated) |

**Project+ animation data (study only; you said on 2026-11-11 to study it for inspiration, not copy it):**
- Only three files come from the Project+ v3.2.1 Wii Lite release on GitHub, read straight out of the 1.5 GB zip, not the whole build:
  - `FitMarthMotionEtc.pac` (2.2 MB): the CHR0 animation tracks.
  - `FitMarth06.pac` (0.4 MB): one costume, for the skeleton's rest pose.
  - `FitMarth.pac` (79 KB): move scripts, with exact hitbox frames.
- They're kept outside the repo in `C:\Users\rober\reference\marth-pplus\`. They are never committed, never loaded by the game, and never used as input to a Brand clip.
- I'd write my own small Python reader for the files, working from BrawlCrate's open format notes, rather than running the BrawlCrate program.
- What comes out of them is **measurements and notes**: timing per joint (which frame the hips, chest, arm and sword peak), lead/lag between them, the sword tip's path and speed, foot plant frames, how far the body squashes and stretches. Plus stick-figure contact sheets for my own review, also kept outside the repo.
- Brand's curves are then keyed from scratch on Brand's own rig, with his own poses and sword paths. A similarity check (section 10) makes sure no Brand clip ends up as a retarget of a reference clip.

The move scripts in `FitMarth.pac` give exact hitbox frames for Project+ Marth. Where they differ from Melee's (SSBWiki), Melee's numbers win and the difference is noted. This keeps the same approach Brand and Fyrdsman already use: their frame numbers, original motion and look.

Already fetched (SSBWiki, measured): fair active 4–7, IASA 30 of 33, landing lag 15 (7 when L-cancelled), autocancel from 27. Jab 1 active 4–7, continuable from 20, IASA 26. Jab 2 active 5–9, IASA 25. Jumpsquat 4. Empty landing 4. Short hop airtime 38, full hop 59. Gravity 0.085, fall 2.2 / fast fall 2.5, run 1.8, initial dash 1.5, walk 1.6, traction 0.06, air speed 0.9, weight 87.

## 2. Reference inventory and analysis method
- `assets/brand/reference/framedata.json`: one row per move with the fields startup, active windows, IASA, total, landing lag, autocancel window, damage (sweet/sour), and `source` + `measured|estimated` for every number.
- `assets/brand/reference/notes.md`: per move, a short written breakdown taken from frame-stepped footage. Which frame the hips turn, when the weight lands on the front foot, the blade angle at the first active frame, the recovery pose. Every note is tagged *estimated*.
- Nothing from the game itself (images, video, data files) goes into the repo. Notes and numbers only.

## 3. The animation standard
What makes that movement read so well, written as rules every clip is checked against:

1. **Anticipation is tiny but present.** 1–3 frames of wind-up before a fast move (3-frame startup = 2 anticipation frames + the strike). The body reaches the wind-up pose by the end of startup; nothing moves slowly before the hitbox.
2. **The blade is at its strongest pose on the first active frame.** Peak extension, flat edge facing the camera, arc smeared across the active frames. The arc ends where the hitbox ends.
3. **Hips lead, shoulders follow, blade last.** A 1–2 frame offset between the pelvis turn, the chest turn and the sword hand. This gives the whip.
4. **Weight is always over a foot.** The centre of mass (pelvis projected to the floor) is inside the support base on every grounded frame unless the move is a lunge, where it moves past the front foot and the back foot pushes.
5. **Compression → extension.** Jumpsquat, landing and smash charge compress the spine and knees. Releases extend past neutral.
6. **Fast in, slow out.** The strike frames take ~20% of the clip; recovery eases back to idle over the IASA window so cancelling at IASA lands in a pose that blends cleanly.
7. **Clean silhouettes.** Each key pose reads at 64 px tall from the side: limbs off the torso, blade not crossing the face or body.
8. **Momentum is kept.** Aerials never stop the body's drift. The upper body animates on top of the drift, and the legs tuck or extend to suggest it.
9. **Feet lock.** A planted foot moves less than 1 cm per frame in world space.
10. **Interruptible from IASA.** Each clip's IASA pose is within a small blend distance of idle, run or fall, so no pop when a new action starts.

Measurable numbers (pelvis-to-chest lag, blade-tip speed at the active frame, foot slide, pose distance at IASA) go into the automated checks in section 10.

## 4. Gameplay timing
- The game runs at 60 frames per second and Marth's numbers are 60 fps frames. Brand's current clips are keyed at 30 fps. **The new clips are keyed per frame at 60 fps**, so a 4-frame startup is really 4 frames and not 2 rounded keys.
- Each move in `sim.js` gets the frame numbers from `framedata.json`: `t` (total), hitbox `f0`/`f1`, `ll` (landing lag) and `ac0`/`ac` (autocancel).
- **Landing lag:** Emberfall has no L-cancel. I'd use the L-cancelled number as Brand's landing lag (fair 7, not 15), since that's how the move is played in practice. I'll say so in each row.
- Movement stats are converted into Emberfall's units against Flint, the way Brand's current `st` block was. Marth's 4-frame jumpsquat becomes `jsq: 4` and so on.
- **Hitboxes:** sizes and positions follow the hitbox GIFs, scaled to Brand's height and sword length. Then `blade-check.js` and `fit-contact.js` check that the blade really is inside each capsule on its active frames.

## 5. Tools and add-ons
Already here: Blender 5.2, `rig.py`, `bonepaths.py`, `mocap.py`, `blade-check.js`, `fit-contact.js`, `anim-review.js`, `sheet.js`, `preview.py`, `pack.mjs`.

To add:
- **Rigify** (comes with Blender, just needs enabling): a full control rig with IK/FK switching for arms and legs, foot roll and spine controls. Controls only; the game gets the plain deform skeleton.
- **Cape motion:** keyframed cape bones with a scripted follow-through pass (each bone lags its parent by a frame and overshoots on stops). Optionally a Blender cloth sim baked onto those bones for big moves. No third-party add-on needed; Wiggle 2 (open source) is only worth adding if the scripted pass looks stiff.
- **New scripts:** `tools/blender/brand2-prep.py` (decimate, cut out the sword, bake textures), `brand2-rig.py` (deform skeleton + Rigify controls), `brand2-anim.py` (per-frame keys → Actions, graph-editor passes), `tools/anim-qa.py` (the checks in section 10).

No mocap for the final curves. Mixamo great-sword clips (already used for Sprocket) can serve only as a timing comparison during blocking, never as data in Brand's clips.

## 6. Rig
- **Prep:** decimate to ~40–60k triangles (today's Brand GLB is 3 MB; aim for the same), keeping the 2048² textures and checking the face and hands up close. Cut the sword into its own rigid mesh with a grip point at the hilt. The lantern and goggles become rigid parts too.
- **Deform skeleton (~65 bones):** root, pelvis, spine 1–3, neck, head; clavicle, upper arm, forearm (+ twist), hand for both arms; three finger groups per hand (thumb, index, other fingers) so the grip closes; thigh, shin, foot, toe for both legs; cape 3 chains × 4 bones; hair 2; lantern 1; `weapon` (child of the right hand, the sword's pivot at the grip).
- **Controls (Rigify):** IK legs with foot roll and knee poles; IK/FK arms; a `sword` control the right hand follows in IK, so sword paths are keyed directly as blade positions and angles. The left hand can pin to the hilt for two-handed moves.
- **Fixing the A-pose:** set rest pose shoulders at about 45° down. Add corrective weights at shoulders, elbows and hips, then test the extremes (arm overhead, deep lunge, full crouch).
- **Export:** deform bones only, baked from the controls. Clip names stay in today's manifest format.

## 7. How each animation gets made
1. **Block:** key poses only, keyed on exact frames: start, anticipation, first active, last active, IASA, end. Stepped interpolation. Render a contact sheet.
2. **Spline:** switch to Bézier. Breakdowns where an arc needs them. Fast transitions stay sharp: the frames into the strike are often linear or constant, never eased.
3. **Graph-editor pass (scripted, then checked by eye):** clamp overshoot, line up the hips → chest → hand offsets from section 3 rule 3, settle the recovery into the IASA pose.
4. **Secondary:** cape and hair follow-through, a little head counter-motion, finger tightening on the strike.
5. **Root motion:** the pelvis travels exactly as far as the sim moves the fighter, frame for frame, so feet don't slide.
6. **Checks** (section 10), then a review sheet for you.

## 8. Proof of concept: five clips first

| Clip | Timing target | What it has to prove |
|---|---|---|
| **Forward air** | active 4–7, IASA 30, total 33, autocancel 27 | a full arc above → in front → below in 4 frames, the body staying in its drift, legs tucked and then opening |
| **Forward smash** | from the SSBWiki page (step 1); a charge hold loop + release | a big wind-up, the step-in weight shift onto the front foot, a downward arc that ends with the tip low in front, hips leading |
| **Neutral air** | from the page (two hits) | two spins around the body, cape swinging, readable as two separate hits |
| **Run** | the run speed above, looping | a long low stride, sword held back, no foot slide at that speed, cape flowing behind |
| **Dash turnaround** | the initial dash length and frames | a 1-frame-readable direction change: the front foot plants, the body pivots over it, the cape whips through |

Each one is scored on fluidity, weight transfer, sword position, body mechanics, pose readability, curve smoothness, foot slide, timing and transitions. Before / after contact sheets, a 60 fps preview video, and a side-by-side of blade path vs hitbox. **You review these five before I go on.**

## 9. The rest of the moveset
Batched in this order, with a review sheet after each batch:
1. Movement: idle, walk, run start/stop, initial dash, dash dance, crouch, jumpsquat, short and full hop, double jump, fall, fast fall, landing (empty and per aerial).
2. Ground attacks: jab 1–2, forward tilt, up tilt, down tilt, dash attack, up smash, down smash.
3. Aerials: back air, up air, down air.
4. Specials (original names), redesigned as sword moves:
   - Neutral: a charged thrust that breaks shields.
   - Side: a branching multi-hit sword combo (up or down on each step).
   - Up: a rising sword cut with recovery height.
   - Down: a counter stance.
5. Defence: shield, rolls, spot dodge, air dodge, hitstun (light, medium, heavy), tumble, knockdowns, techs (in place, roll), getups and getup attacks.
6. Grabs: grab, dash grab, pivot grab, pummel, four throws.
7. Ledge: grab, hang, getups (normal and slow), ledge attack, ledge roll, ledge jump.
8. Taunt, victory poses, entrance.

**Code work alongside:** rewrite `BRAND` in `sim.js` with the new frame data and hitboxes. Update `movelist.js` and run `tests/movelist.js`. Adjust the CPU so it knows the new moves. Run `tests/rules.js` and the stats run. Your play decides balance, not the CPU win rate.

## 10. Automated quality checks
`tools/anim-qa.py` runs on every clip and writes a report:
- **Timing:** first active frame, last active frame and IASA match `framedata.json`, and the blade tip is inside its hitbox on every active frame (`bonepaths.py` + `blade-check.js`).
- **Foot slide:** a planted foot's world drift is under 1 cm a frame.
- **Grip:** the hand-to-hilt distance stays constant.
- **Joint limits:** no elbow or knee bends backwards. Limits on wrist, neck and spine twist.
- **Pops:** catches any bone whose rotation jumps in a frame where nothing calls for it (a second derivative check), and flags unintended sharp corners.
- **Clipping:** blade through the body or head, cape through the legs (sampled points vs. the body).
- **Balance:** the centre of mass over the feet on grounded frames, except moves marked as lunges.
- **Blend:** pose distance at IASA to idle / run / fall.
- **Original, not copied:** each Brand clip's joint curves are compared with the matching reference clip's after both are mapped to a shared simple skeleton. A clip whose curves track the reference too closely, across most joints, fails and gets re-keyed. Matching timing is expected; matching curves is not allowed.
- **Visual:** contact sheets from `anim-review.js` in my own tab, plus a 60 fps clip for each move.

## 11. Effort and risks
**Rough effort** (in sessions like today's):
- Prep and rig: 1.
- The five proof clips with review: 1–2.
- The rest of the clips, about 60: 4–6.
- Sim and kit rewrite, move list, CPU, tests: 1–2.

**Risks:**
- Meshy topology can bend badly at the shoulders and hips. Corrective weights help, but a bad area may need you to re-generate the model.
- The cape may clip into the legs during spins. Scripted collision checks catch it, but some moves may need the cape pushed out on purpose.
- Decimation can blur the face and hands. If needed, keep those areas denser.
- Hitbox numbers for some moves may disagree between sources. The `measured|estimated` tags show which is which, and I'll note each choice.
- Replacing the kit changes Brand's balance. CPU stats will move; you decide.
- 60 fps clips mean twice the keyframe data per clip; the GLB grows. Mitigated by curve simplification at export and checked against the 3 MB target.

## 12. Deliverables and acceptance
**Deliverables:**
- The prepped, rigged model (source `.blend` with controls, exported GLB with deform bones).
- The animation library as Actions in the source file and clips in the game GLB, plus `clips.json`.
- `framedata.json` and the reference notes.
- The new `BRAND` kit in `sim.js`, the move list, and the CPU and tests updated.
- The QA report and contact sheets for every clip.

**Acceptance:**
- Every clip passes `anim-qa.py` (timing exact, slide < 1 cm/frame, no pops, blade in the hitbox on every active frame).
- You've signed off on the five proof clips before the rest are made.
- No clip is a placeholder or renamed stand-in.
- Everything plays in the game at 60 fps with no visible pop when cancelling at IASA.
- Merged into the live checkout only when you say so.

**First step once approved:** merge the live `anim-overhaul` branch into this worktree (this branch is behind it and doesn't have Brand's current files), then fetch the remaining SSBWiki move pages into `framedata.json`, then prep and rig.
