# Potato Sack: combo playbook and video library

Recorded 2026-11-10 from the real game: the Training Room (training mode: no clock, endless stocks, the true-combo counter at the top right), Potato Sack against the training dummy (Flint standing still, CPU level 0) and, in three clips, against a level 8 CPU. Every clip is the actual game rendering frame by frame: the 3D scene and the HUD layer exactly as drawn, encoded to WebM at 30 frames a second of game time. Nothing in the clips is edited or reconstructed.

**How the routes were found.** `tools/combo-lab.js` presses buttons for Potato Sack inside the real game code and reads the game's own counter. `tools/combo-search.js` and `tools/combo-search2.js` tried thousands of routes from 17 starting situations (0 to 130%, middle of the stage, at the ledge, on a platform) and kept a step only if the counter went up without resetting. Every kept route was then replayed against DI in, out, up and down, against a level 8 CPU, and against four weights (`robustness.json`). The browser recorder (`tools/record.js`, `tools/record-server.js`) then played each chosen route in the running game and filmed it. These are testing tools only; the game never loads them.

**What changed in the game before testing** (your request in the same message): Hot Potato (up B) bursts on frame 5; neutral B is the new Spud Bomb (charge with no cap); neutral air is short enough for two in one short hop; Tumble (down B) with down held passes through platforms. Nothing was changed after testing began.

## Correction (added later on 2026-11-10): some clips show different moves from their labels

After the clips were recorded I found two faults in my combo lab, which pressed the buttons:
- It drifted toward the opponent while pressing neutral air, so the game read it as **forward air**.
- Where an aerial step began once Potato Sack was already on the ground, the press came out as a **ground move**.

The videos are genuine footage of the game at the time; they just show different moves from their names. I replayed every route with the game and lab exactly as they were at recording and logged what each step really did:

| Clip | Labelled | What the video actually shows |
|---|---|---|
| 03, 22 | Spud Bomb → Tumble → **up air** | Spud Bomb → Tumble → **up smash** (he slid to the ground first) |
| 15, 21 | down throw → fast fall → **up air** | down throw → fast fall to the floor → **up smash** |
| 04 | … Tumble → **short-hop neutral air** → Tumble → up B | … Tumble → **forward air** → Tumble → up B |
| 05 | **short-hop nair** → up throw → up air → full-hop nair → **forward smash** | **forward air** → up throw → up air → neutral air (the old single hit) → **Bag It** (side B: he was still airborne) |
| 06 | **double neutral air** → up throw → up air → up air | **forward air** → up throw → up air → up air |
| 08 | ledge: down air → up tilt → full-hop nair → **forward smash** | ledge: down air → up tilt → neutral air (old) → **Bag It** |
| 19 | Tumble drop-through → **fast-fall neutral air** | Tumble drop-through → **forward air** |

All other clips do what their labels say. Hit counts, damage, DI and weight results in the master table are true for the moves that really happened. Since then, neutral air has changed (three carrying hits and a finisher), so routes 05, 06, 08 and 10 behave differently in the current game: see **Neutral air (new)** below. The lab is fixed: neutral air is now pressed with the stick centred.

**Terms in your brief that Potato Sack does not have.** He is an original fighter, so: "Sanddash" is his **Tumble** (down B, cancellable into anything from frame 7); "Sanddrop" is **Tumble drop-through** (down B holding down on a platform); "bomb" is **Spud Bomb** (neutral B) and **Hot Potato** (up B). He has no crouch cancel of his own beyond the engine's (crouching takes 15% less knockback); I did not find a route that used it.

## Reading the input notation

Each step starts on the first frame Potato Sack can act after the step before (Tumble steps from its frame-7 cancel). `a+b` means do a, then b as soon as possible.

| Step | Exact input |
|---|---|
| `sh_nair`, `sh_uair`, `sh_dair`, `sh_bair` | tap jump (2 frames), the aerial on frame 4 after the jump press (first airborne frame); drift toward the opponent |
| `sh_double_nair` | tap jump, attack on frame 4 and again on frame 19 (the second neutral air fits before landing) |
| `fh_uair`, `fh_nair` | hold jump 12 frames (full hop), the aerial on frame 9 |
| `dj_dair` | jump again in the air, down air 3 frames later |
| `jump+X` | full hop (jump held 4 frames), then X |
| `ff+X` | fast fall (flick down while falling) to the floor, then X |
| `grab_u`, `grab_d` | grab, then up or down once holding |
| `utilt` | right stick up (a tilt); `fsmash` is attack + special together with the stick toward |
| `bomb_tap` | special tapped for 1 frame (Spud Bomb, smallest); `bomb_120` holds it 120 frames |
| `bag_it` | special with the stick toward (side B, the leaping command grab) |
| `upb`, `upb_b` | up + special; `upb_b` holds the stick back to angle the burst |
| `tum_fwd`, `tum_up`, `tum_stall`, `tum_back` | down + special, then the stick toward / up / neutral / away on frames 2 to 8 (the burst picks its direction on frame 6) |
| `tum_thru` | down + special, then toward and down, keeping down held: goes through the platform |

## Master results

Damage is what the counter showed (one-on-one bonus included). "Hits" is the counter's maximum. Class: **True** = the counter never reset; **Kill confirm** = the KO hit is itself part of the counted combo; **DI-dependent** = loses hits against some DI; **Tech** = a movement showcase, not a combo. Opponent weight 92 (Flint) unless stated. DI column: hits against DI in / out / up / down (K = still KOs). Window: the opponent percents (tested in steps of 10) where the same result happens.

| # | Video | Route | Start → end % | Damage | Hits | Class | DI in/out/up/down | Weights: Nib 72 / Flint 92 / Sprocket 103 / Hod 121 | Window | Difficulty |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 | low-percent/01_SpudBomb_TumbleGrab_SpudBomb_TumbleUair.webm | bomb_tap > tum_fwd+grab_d > ff+bomb_tap > tum_fwd+sh_uair | 0 → 34.5 | 34.5 | 4 | True | 4/4/4/4 | 4/4/4/4 | 0% only | Hard (two Tumble cancels) |
| 02 | low-percent/02_UpThrow_JumpUpB_TumbleUp_BagIt.webm | grab_u > jump+upb > tum_up+bag_it | 25 → 66.6 | 41.6 | 3 | True, DI-dependent | 2/2/3/3 | 3/3/3/2 | 20 to 25% | Medium |
| 03 | low-percent/03_SpudBomb_TumbleForward_Uair.webm | bomb_tap > tum_fwd+uair | 25 → 51.7 | 26.7 | 2 | True | 2/2/2/2 | 2/2/2/2 | 0 to 30% | Easy |
| 22 | low-percent/22_vsCPU8_SpudBomb_TumbleForward_Uair.webm | bomb_tap > tum_fwd+uair, against a level 8 CPU | 20 → 46.7 | 26.7 | 2 | True | — | — | — | Easy |
| 05 | mid-percent/05_SHNair_UpThrow_Uair_Nair_Fsmash.webm | sh_nair > grab_u > fh_uair > fh_nair > fsmash | 40 → 91.6 | 51.6 | 5 | True, DI-dependent | 5/3/3/5 | 2/5/2/1 | 40 to 50% | Medium |
| 06 | mid-percent/06_SHDoubleNair_UpThrow_Uair_Uair.webm | sh_double_nair > grab_u > fh_uair > sh_uair | 40 → 76.6 | 36.6 | 4 | True | 4/4/4/4 | 2/4/3/1 | 40 to 50% | Medium |
| 07 | mid-percent/07_Dair_UpThrow_Uair_Uair.webm | sh_dair > grab_u > fh_uair > fh_uair | 60 → 99.8 | 39.8 | 4 | True | 4/4/4/4 | 2/4/3/3 | about 60% | Medium |
| 20 | mid-percent/20_vsCPU8_Dair_UpThrow_Uair_Uair.webm | the same, against a level 8 CPU | 60 → 99.8 | 39.8 | 4 | True | — | — | — | Medium |
| 08 | mid-percent/08_Ledge_Dair_Utilt_FHNair_Fsmash.webm | at the ledge: sh_dair > utilt > fh_nair > fsmash | 60 → 101.8 | 41.8 | 4 | True, DI-dependent | 4/2/4/2 | 1/4/2/2 | about 60% | Medium |
| 04 | kill-confirms/04_SpudBomb_TumbleGrab_Nair_TumbleUpB_KO_at_0.webm | bomb_tap > tum_fwd+grab_d > ff+bomb_tap > tum_fwd+sh_nair > tum_fwd+upb | 0 → KO | 36.5 | 4 | Kill confirm, DI-dependent | 3/4 K/3/4 | 4 K/4 K/4/4 | 0% only | Hard |
| 11 | kill-confirms/11_Dair_TumbleStallGrab_DThrow_TumbleUpB_Uair_UpB.webm | sh_dair > tum_stall+grab_d > tum_fwd+upb > tum_fwd+sh_uair > ff+upb | 75 → KO | 41.7 | 4 | Kill confirm, DI-dependent | 3/3 K/3/3 K | 3 K/4 K/4 K/2 K | about 70 to 75% | Hard |
| 12 | kill-confirms/12_Dair_TumbleUtilt_JumpUpB_BagIt_UpB.webm | sh_dair > tum_fwd+utilt > jump+upb > jump+bag_it > ff+upb | 75 → KO | 45 | 4 | Kill confirm, DI-dependent | 3/3/4 K/3 | 2 K/4 K/3 K/1 | 75% only | Hard |
| 13 | kill-confirms/13_Ledge_DThrow_TumbleUpB_BagIt_UpB.webm | at the ledge: grab_d > tum_fwd+upb > jump+bag_it > ff+upb | 80 → KO | 32.8 | 3 | Kill confirm | 2 K/2 K/3 K/2 K | 3 K/3 K/2 K/1 K | 80 to 90% | Medium |
| 14 | kill-confirms/14_Dair_TumbleUp_UpB.webm | sh_dair > tum_up+upb | 75 → KO | 31 | 2 | Kill confirm | 2 K/2 K/2 K/2 K | 1/2 K/2 K/1 | 70 to 120% | Easy |
| 15 | kill-confirms/15_DThrow_FastfallUair.webm | grab_d > ff+uair | 100 → KO | 24.2 | 2 | Kill confirm | 2 K/2 K/2 K/2 K | 2 K/2 K/2/2 | 100 to 160% (Flint, Nib); later for heavies | Easy |
| 21 | kill-confirms/21_vsCPU8_DThrow_FastfallUair.webm | the same, against a level 8 CPU | 100 → KO | 24.2 | 2 | Kill confirm | — | — | — | Easy |
| 16 | kill-confirms/16_Dair_TumbleStallGrab_DThrow_Bair_TumbleUpB.webm | sh_dair > tum_stall+grab_d > sh_bair > tum_fwd+upb_b | 75 → KO | 30.7 | 3 | Kill confirm | 3 K/3 K/3 K/3 K | 2 K/3 K/3 K/2 K | 70 to 80% | Hard |
| 17 | kill-confirms/17_Ledge_DThrow_DoubleJumpDair_Spike.webm | at the ledge: grab_d > dj_dair | 120 → KO | 19.7 | 2 | Kill confirm, DI-dependent | 2/1 K/2 K/2 K | 2 K/2 K/2 K/1 | 120 to 160% | Medium |
| 09 | advanced-tech/09_Platform_UpThrow_SpudBomb_x2_TumbleUp_BagIt_UpB.webm | both on the left platform: grab_u > jump+bomb_tap > jump+bomb_tap > tum_up+bag_it > ff+upb | 30 → KO | 41.5 | 4 | Kill confirm, DI-dependent | 2/2/2/3 K | 3 K/4 K/3/3 | 30% only | Hard |
| 10 | advanced-tech/10_Platform_Utilt_FHNair_TumbleBagIt.webm | both on the left platform: utilt > fh_nair > tum_fwd+bag_it | 70 → 99.7 | 29.7 | 3 | True, DI-dependent | 3/2/2/3 | 0/3/2/1 | 70 to 100% | Medium |
| 18 | advanced-tech/18_SpudBomb_Charged_2s_KO.webm | bomb_120 (held 2 seconds), opponent 14 away | 60 → KO | 32.5 | 1 | Kill move (single hit) | — | — | KOs from 60% at 2 s; 120% at 1 s; 150% at 0.5 s | Easy, slow |
| 19 | advanced-tech/19_TumbleDropThrough_Platform_FastfallNair.webm | on the platform, opponent below 30 away: tum_thru > ff_nair | 50 → 61.8 | 11.8 | 1 | Tech (movement) | — | — | any | Easy |

Starting positions: Potato Sack at x -20 with the opponent 8 to 14 units in front (middle of the stage), at x 46 facing the ledge (edge at 68), or both on the left platform. The level 8 CPU column of `robustness.json` uses the CPU's own random choices; it varies run to run, and the three recorded CPU clips are runs where the route held.

## Best ten for a competitive Potato Sack

1. **15 Down throw → fast fall → up smash** (100%+). Labelled "up air" when recorded; it is an up smash once he lands. Holds against every DI and against the level 8 CPU; the cleanest kill confirm he has. Heavies need about 20% more.
2. **14 Down air → Tumble up → Hot Potato** (70 to 120%). The frame-5 up B turns a landing down air into a kill from the middle of the stage against every DI.
3. **16 Down air → Tumble stall → down throw → back air → Tumble → angled up B** (70 to 80%). Three hits, kills against every DI and every weight tested.
4. **07 Down air → up throw → up air → up air** (around 60%). Four hits, every DI.
5. **06 Short-hop forward air → up throw → up air → up air** (40 to 50%). Labelled "double neutral air" when recorded; it was a forward air. Every DI. (With the new neutral air the double-nair version no longer reaches the grab.)
6. **13 Ledge down throw → Tumble → up B → Bag It → up B** (80 to 90% at the ledge). Kills every weight including Hod.
7. **11 Down air → Tumble stall grab → ... → up B** (around 70%). Four hits into a kill; DI out and down still die.
8. **01 Spud Bomb → Tumble grab → Spud Bomb → Tumble up air** (0%). Four hits from nothing, every DI and weight.
9. **03 Spud Bomb → Tumble → up smash** (0 to 30%). Labelled "up air" when recorded. The simplest low-percent starter; works on everyone.
10. **05 Short-hop forward air → up throw → up air → neutral air → Bag It** (40 to 50%, as recorded with the old neutral air). Five hits and over 50%; DI out or up cut it to 3. With the new neutral air it breaks after the first hit, so see **Neutral air (new)** for its replacements.

## New tech found

- **Tumble cancel grab (`tum_stall+grab_d`, `tum_fwd+grab_d`)**: Tumble's frame-7 cancel lets him grab out of a stalled or forward Tumble while the target is still in hitstun from a down air or Spud Bomb. It is the glue in routes 01, 04, 11 and 16.
- **Tumble → up B**: Tumble up or forward, cancelled into Hot Potato, which now bursts on frame 5, reaches launched opponents the up B alone could not.
- **Spud Bomb as a combo starter**: the tapped bomb (8%, a 7-unit ring round his body) pops the opponent just enough for a forward Tumble to carry him to them.
- **Two neutral airs per short hop**: the rule tests confirm two fit in one short hop. Route 06 as recorded was a forward air, not this.
- **Tumble drop-through** (clip 19): down held on a platform keeps all of the Tumble's speed and drops him through; a fast-fall aerial (a forward air in the clip) catches someone 30 units away below. As a combo extension it found nothing (the search tried it from 20, 50 and 80% at seven distances), so it is a movement and approach tool.
- **Charged Spud Bomb** (clip 18): with no cap it eventually covers a third of the stage; at 2 seconds it KOs from 60% and 14 units away. It is slow and obvious, so it is a read or a punish on a ledge recovery, not a combo ender.

## Neutral air (new): three carrying hits and a finisher

Added on 2026-11-10 at your request.
- **The move:** hits on frames 3, 5 and 7 carry the opponent along with Potato Sack, and a finisher on frame 9 launches them.
- **Search:** `tools/combo-search-nair.js` tried routes that start with or pass through it, from 9 situations, and kept 54 (`search-nair.json`).
- **Notation:** `nair` means neutral air in the air, with the stick centred. `dj_nair` means double jump, then neutral air.
- **Hit counts are high** because every neutral air puts 4 hits on the counter.

| # | Video (nair-drag/) | Route | Start | Result | DI in/out/up/down/CPU 8 | Weights Nib / Hod / Sprocket |
|---|---|---|---|---|---|---|
| 23 | 23_NairLoop_x4_16hits_at_0 | sh_nair > nair > dj_nair > nair | 0% | 16 hits, 29.5% | 16/16/16/16/0 | 16/16/16 |
| 24 | 24_NairLoop_x8_32hits_at_0 | the same, then two more short hops of two neutral airs each | 0% | 32 hits, 49.6% | held against no DI and DI out at 0%; DI out at 30% stops it at 17 hits | — |
| 25 | 25_Nair_Nair_DJNair_UpB_KO_at_30 | sh_nair > nair > dj_nair > upb | 30% | 13 hits, KO | 13K/13/13K/13/0 | 13K/13/13 |
| 26 | 26_Ledge_Nair_DJNair_Nair_FFNair_KO_at_60 | at the ledge: sh_nair > dj_nair > nair > ff+nair | 60% | 12 hits, KO | 12K/8K/12K/12K/0 | 12K/12K/12K |
| 27 | 27_Nair_TumbleNair_Nair_FFNair_KO_at_120 | sh_nair > tum_fwd+sh_nair > nair > ff+nair | 120% | 12 hits, KO | 8K/4K/8K/12K/4 | 7K/12K/12K |
| 28 | 28_Platform_FHNair_Nair_DJNair_UpB_KO_at_30 | opponent on a platform: fh_nair > nair > dj_nair > upb | 30% | 13 hits, KO | 13K/13K/13K/13K/1 | 13K/13/13K |
| 29 | 29_SpudBomb_TumbleGrab_Nair_TumbleUpB_KO_at_0 | route 04 with the real neutral air | 0% | 6 hits, KO | — | — |

**What this means for balance. This is for you to decide; I have not changed it.**
- **Neutral air now combos into itself.** Short hop with two neutral airs, then double jump with two more, is a true combo from 0 to 60% against every DI and every weight tested.
- **Short hops after landing extend it to 8 neutral airs:** 32 hits and about 50% from one touch at 0%.
- **It isn't infinite:** by 30%, DI out ends it at 17 hits, and by 90% it is 4 to 8 hits.
- **The level 8 CPU usually escapes,** because it acts during the gaps and doesn't hold still.
- **If it's too strong, any one of these would stop the loop:**
  - a bigger base knockback on the finisher, so they fly out of reach;
  - the carrying hits only on the first neutral air of each jump;
  - a little more landing lag.

## Weaknesses: where combos break and opponents escape

- **Heavyweights escape.** Against Hod (121) most mid-percent routes drop to 1 to 3 hits (05, 06, 12 and 14 lose their follow-ups). Light Nib (72) flies out of the up-throw chains (05 and 06 drop to 2).
- **Narrow percent windows.** Many routes work at one percent only (01 at 0%, 07 near 60%, 12 at 75%). Up throw → up air chains stop by about 70% because the target flies too high; down air starters stop working above about 100%.
- **DI.** DI out cuts route 05 from 5 to 3 hits and route 08 from 4 to 2; DI in or up stops routes 04, 11 and 12 short of the kill.
- **Starters that need the opponent still.** Spud Bomb tapped, dash attack and the smashes whiff against a moving level 8 CPU (route 01 landed 0 hits against it); in a real match they are punishes, not openers.
- **Poor starters.** Jab (one hit, ends nothing), down tilt and up tilt in the open (one hit at most percents; up tilt only works on a platform, route 10), forward tilt (one hit), and Bag It except as an extender.
- **Self-risk.** Hot Potato costs him 12% and throws him upward every time, and he cannot hold the ledge: every up-B kill confirm near the ledge leaves him high or off the stage. Tumble is once per time in the air, so a confirm that spends it off stage loses his recovery.

## Files

- `low-percent/`, `mid-percent/`, `kill-confirms/`, `advanced-tech/`: the clips (WebM, VP8, 1280x720; they play in Chrome, Edge, Firefox and VLC).
- `frame-data.md`: Potato Sack's frame data, damage, angles, knockback and hitboxes, read from the game.
- `robustness.json`: DI, weight and percent-window results for every clip's route, as recorded with the old neutral air. `search.json`, `search2.json`: every route the searches kept.
- `nair-drag/`: clips 23 to 29 of the new neutral air. `search-nair.json`: the 54 routes the neutral-air search kept, with DI and weight results.

## Limits

- Inputs are frame-perfect machine inputs, so "difficulty" is my judgement of how hard each is for a person, not something measured.
- DI was tested as a held direction, not as SDI; the level 8 CPU adds its own mixing.
- Percent windows were tested in steps of 10%.
- Crouch cancelling, reverse aerials and platform drops other than Tumble were not explored beyond what the search tried.
