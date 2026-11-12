# Brand: what the reference teaches (timing and mechanics only)

Measured from the Project+ reference animations (decoded and studied outside the repo; nothing from them is used in
Brand's clips) and checked against the Melee numbers in framedata.json. These are the rules Brand's clips are keyed to.
"Fastest" means the frame on which that part moves most between frames.

## Forward air (active 4-7)
- The blade tip moves fastest on frame 4, the first active frame. All the speed lands on the hitbox; frames 1-3 are a
  short lift of the sword behind and over the head.
- The hips hardly turn (about 40 degrees across the whole move). The chest does the work (about 160 degrees of twist,
  fastest on frame 2). In the air the upper body swings on top of a quiet lower body.
- Hip height stays at about 0.78 of standing throughout: legs tucked, no bob. The drift is left alone.
- After the arc (frames 8-23) the sword rests low and behind for a long, still follow-through. Then a quick return to the
  ready pose from frame 24, which is where the 27+ autocancel starts.

## Forward smash (start 3 frames, then the swing; active 10-13 counted from the start)
- One-frame cascade: hips turn fastest on swing frame 6, chest on 7, blade tip on 9, the hand on 10. The hips lead,
  then the chest, then the blade. This is the whip.
- The wind-up pulls the sword back and up behind the head over swing frames 1-6. The strike is an overhead arc down to
  the floor in front, in four frames.
- Deep lunge: hip height falls to 0.46 of standing at swing frame 12, just after the last active frame. The front foot is
  planted from frame 13 to 33 and the pose holds still and low through the end lag. Then it rises in about 14 frames
  (34-48) back to full height.
- The start's three frames crouch from 0.9 to 0.53 of standing: the body drops before the swing, not during it.

## Neutral air (active 6-7 and 15-21)
- The sword hand is fastest on frame 5, a frame before the first hit. The blade tip is fastest on frame 17, the middle
  of the second hit.
- Two full turns of the upper body around a nearly still pelvis (hip height constant). The second circle is wider and
  faster than the first. That is what makes the two hits read as separate.

## Run (17-frame loop)
- Very low: hip height 0.49 to 0.60 of standing. The body leans far forward with the sword trailing low behind.
- The hips barely turn. The chest swings about 60 degrees with the stride: shoulders counter the legs.

## Dash and dash turnaround
- Initial dash: drops to 0.51 of standing by frame 8, then rises.
- Run turnaround: the outside foot plants on frames 4-5, the hips turn fastest on frame 5 and the chest on frame 7 (a
  two-frame lag). Hip height stays low (0.50 to 0.64). The body pivots over the planted foot rather than standing up.
- Standing turn: 12 frames. Chest first (frame 2), hips later (frame 7).

## Jumpsquat (4 frames)
- Already at 0.40 of standing on frame 1 and held to frame 4. The crouch is instant, not eased in.

## Movement (batch 1)
- Idle: almost still. Hip height moves about 5% over a 71-frame breath; the blade barely moves.
- Walk: hips lowest just after a foot lands and highest as the other passes (0.84 to 1.00 of standing).
- Dash: lowest (0.51) by frame 8. The sword swings down and back in the first two frames, the fastest thing in the move.
- Run brake: lowest (0.47) on frame 4, held low and sliding to about frame 17, then standing by 26.
- Crouch: 8 frames down to 0.38, fastest on frame 2.
- Landing (light): lowest (0.58) on frame 4, standing by 16. Landing (heavy): lowest (0.38) on frame 8, held to about 18, standing by 31.
- Double jump: a full body turn in the middle of the rise. The legs kick first, the hips turn fastest around frame 20, the chest a few frames later.
- Fall: a short, nearly still loop.

## Rules taken from this for every Brand clip
1. Peak blade speed on the first active frame, never before or after.
2. Hips → chest → blade, one frame apart on ground strikes. In the air the hips stay quiet and the chest leads.
3. Crouch and lunge depths: jumpsquat ~0.4, run ~0.5–0.6, smash lunge ~0.45 of standing height.
4. Hold the end-lag pose still and low, then return quickly. No slow drift through the whole recovery.
5. Aerials keep hip height constant and leave drift alone.
