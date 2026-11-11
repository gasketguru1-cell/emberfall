# Potato Sack: frame data, read from the game (sim.js) on 2026-11-10

Frames at 60 per second. "Active" is the first to last frame a hitbox is out; "total" is the frame the move ends (whiff). Damage is before the one-on-one bonus (x1.2). Angle in degrees (361 = the engine ground-sensitive angle); b = base knockback, k = growth. Positions are relative to his feet, facing right.

| Move | Active | Total | Hits (damage / angle / b / k at x,y radius) | Landing |
|---|---|---|---|---|
| jab | 3-6 | 24 | 4.8% / 361 / 30 / 54 at 7.1,6 r4.4 |  |
| ftilt | 7-10 | 30 | 7.5% / 361 / 25 / 81 at 7.2,6 r4.9 |  |
| utilt | 6-11 | 29 | 6.1% / 95 / 30 / 86 at 0,15.5 r5.4 |  |
| dtilt | 6-8 | 24 | 5.6% / 75 / 25 / 63 at 6.6,3.2 r4.6 |  |
| dash | 8-15 | 40 | 8.5% / 60 / 50 / 54 at 7.6,3.5 r5.4 |  |
| fsmash | 17-20 | 51 | 15% / 361 / 28 / 75 at 7.6,3.5 r6.4 |  |
| usmash | 11-17 | 46 | 13.2% / 88 / 30 / 94 at 0,16 r6.6 |  |
| dsmash | 9-20 | 48 | 11.3% / 30 / 30 / 68 at 6.8,3.4 r5.4; 12.2% / 150 / 30 / 71 at -6.8,3.4 r5.4 |  |
| nair | 3-9 | 15 | 7.5% / 45 / 22 / 72 at 0,6 r7 | 5 (no lag before frame 2 or after 10) |
| fair | 9-13 | 44 | 9.4% / 45 / 30 / 86 at 7.6,3.5 r5.4 | 12 (no lag before frame 8 or after 23) |
| bair | 8-11 | 40 | 10.3% / 140 / 25 / 83 at -7,5.5 r5.4 | 11 (no lag before frame 7 or after 21) |
| uair | 6-11 | 35 | 7.5% / 80 / 25 / 86 at 0,15.5 r5.9 | 9 (no lag before frame 5 or after 21) |
| dair | 13-17 | 48 | 11.3% / 270 / 20 / 72 at 0.2,0.8 r5.4 | 15 (no lag before frame 12 or after 27) |
| grab | 7-9 | 34 | grab at 7.2,5.6 r4.8 |  |
| dgrab | 9-11 | 44 | grab at 8.6,5.6 r4.8 |  |
| pgrab | 10-12 | 46 | grab at 9.2,5.6 r4.8 |  |
| getup | 18-21 | 44 | 6.6% / 48 / 60 / 36 at 7,3.4 r5.9; 6.6% / 132 / 60 / 36 at -7,3.4 r5.9 |  |
| sspec | 10-22 | 50 | grab at 7,6 r6, then flings (command grab) |  |

**Specials**

- Neutral B, Spud Bomb: hold to swell, release; burst 4 frames after release, 20 frames after. Tapped: 8% in a 7-unit ring, angle 50, b 50, k 96. Every frame held adds 0.12 units of radius and 0.15% damage, with no cap.
- Side B, Bag It: a leaping command grab, active 10-22, goes through shields, flings for 10%.
- Up B, Hot Potato: bursts on frame 5. Sweet spot (middle, radius 6): 15% b 50 k 112; sour spot (radius 12): 10% b 35 k 100. Both ignore rage. The sack takes 12% and is launched himself (b 100, k 70 from his own damage), steered up to 28 degrees with the stick. Once per time in the air.
- Down B, Tumble: burst on frame 6 in the stick direction (slide along the floor, lift straight up, dive diagonally down, or hang with no direction); any action or a new push of the stick ends it from frame 7; never trips; holding down passes through soft platforms. Once per time in the air.

**Throws**: f 9% (angle 45, b 60, k 52), b 10% (angle 135, b 60, k 56), u 8% (angle 88, b 58, k 54), d 6% (angle 70, b 60, k 27), s 10% (angle 48, b 68, k 52). Pummel 1.3%.

**Movement**: weight 106, walk 1, dash 1.95, run 1.6 (walk and run move in hops: {"walk":[13,9,1.4],"run":[11,8,1.4]}), air speed 1.02, gravity 0.104, fall 1.68, fast fall 2.69, jump 31, short hop 15, air jump 31, jump squat 3 frames, body 10 wide and 12 tall. He cannot hold the ledge. Launch power scaled by {"kb":0.9} after the kits.

**Engine rules that matter for combos**: hitstun = 0.4 x knockback; hitlag about (damage x 0.65 + 6) frames; launch speed decays by 0.051 per frame; up to three SDI nudges of 1.1 per hitlag; DI bends launches up to about 10 degrees. The true-combo counter counts a hit as part of a combo only if the target was still in hitstun, held, or in hitlag when it landed; throws always continue it.
