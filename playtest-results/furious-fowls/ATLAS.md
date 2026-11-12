# Furious Fowls Discovery Atlas

Playtest of Furious Fowls in the real Emberfall simulation (`sim.js`, 60 frames a second, deterministic), 2026-11-12.
No character data, frame data, hitboxes, damage or physics were changed. The tools only press buttons and read the game's own
combo counter (`COMBO[0].hits`, which ends the moment the victim can act).

## How the testing was done

- **Search.** `tools/fowls-ztd.js` runs a beam search (width 40–48, depth 60). It branches from saved game states (`NET.save`/`NET.load`), trying about 120 actions at each step: every normal, grab and throw, tap B, the wheel to each bird, Side B at three aims, the Cyclone at four charges and five directions, and short/full-hop aerials at several frames with four drift modes. It also tries waits, dashes, jumps and fast-falls.
  - **Runs.** 85 runs covered the five birds, three starting positions (x −30, 0, +30) and starting damage of 0, 50, 80, 110 and 140%, against Flint, Nib and Cronky. Then 90 more runs searched for the best route against each of the nine scripted defences, at 0% and at 80%.
- **Verification.** `tools/fowls-verify.js` replays every route fresh from the start of a match with `FL.run`, never from a saved branch. Every number in this atlas comes from these fresh replays.
  - **Defences.** Each route was played against nine defences: no DI; DI in, out, up and down; and three mixed defences. The mixed ones are (1) DI up-out + SDI up + air dodge, (2) DI down-in + SDI down + jump away, and (3) DI out + SDI out + air dodge, plus DI in + SDI in + jump away.
  - **Opponents.** Six opponents: Flint, Nib, Hod, Joey, Cronky and Fyrdsman.
  - **What counts.** A route counts as a true combo only if the counter never drops while the route runs. A KO counts only if it lands while the counter is still running.
- **What this does not cover.** The defender holds one fixed defence for the whole route. A real player can mix defences, and a real attacker can change route after seeing the DI. So "holds against all 9" means it held against these nine defences, not that every possible defence was ruled out.
  - The defender's escape options are air dodge, jump and nair at the first actionable frame. Shield, tech and ledge options were only exercised by the CPU (level 8) in spot checks.
- **Clips.** Every clip was rendered by the game's own renderer and HUD, which shows damage % and the combo counter. Each one is 1280×720 WebM made with `tools/fowls-rec.js`. Each clip has a `.json` beside it with the exact route, setup, defender and result.

Route notation: `sh_X` short hop and aerial X (frame 4 by default); `sh_X:J` aerial on frame J of the hop; `:n` no drift, `:g` no drift and fast-fall at the peak, `:f` drift toward and fast-fall; `fh_` full hop (aerial frame 9 by default); `dj_X` double jump then X; `ff` fast-fall to the floor; `land` drift until landing; `grab_u` grab then up throw; `seltap` tap Neutral B (the selector), which here works as an exact short delay; `up:C:D` Cyclone (Up B) held C frames, released toward D (t toward, tu up-toward, u up); `dnj` Bolt's Skitter Step (Down B) jump-cancelled on frame 13; `@N` starting distance in units (Flint is about 10 units wide). x is position on the stage (ledges at ±68).

---

## 1. Zero-to-deaths: **0 found**

No route takes any opponent from 0% to a KO in one unbroken chain, even with no DI at all. This held for every bird, every starting position, every opponent and every one of the nine defences tested.

Closest results (fresh replays, no DI unless noted):

| Bird | Best unbroken chain from 0% | Hits | Damage | Against |
|---|---|---|---|---|
| Pip | `@4 sh_nair:4:n > ff > sh_nair:4:n > ff > sh_nair:4:n > ff > sh_nair:7 > dair > sh_nair > seltap > up:0:u` | 38 | 50.3% | Flint, **DI in + SDI in + jump away** |
| Pip | `@13 sh_nair > seltap > grab_u > sh_nair > ff > sh_bair:4:n > ff > sh_nair:4:n > ff > fh_uair` | 30 | 53.3% | Cronky |
| Pip | `@13 sh_nair > ff > sh_bair > seltap > grab_u > fh_nair > seltap > grab_u > fh_uair > dj_uair` | 25 | 63.9% | Flint |
| Rusty | `@13 sh_nair:11:n > sh_nair > land > grab_u > sh_nair:4:g > sh_nair:8:f > sh_fair:11 > uair` | 20 | 62.0% | Flint, **DI in + SDI in + jump away** |
| Bolt | `@13 grab_u > fh_nair > dj_fair > bair` (from 50%) | 9 | 42.2% | Flint |
| Cinder | `@13 sh_nair > dair` | 5 | 29% | Flint |
| Pearl | `@4 fh_dair:16:n > nair` | 6 | 18.9% | Cronky |

**Why the chains end.**
- **The grab loop runs out.** Grab → up throw → aerial → grab again works twice, because a grab catches an opponent who is still in hitstun. But each up throw sends them higher as damage rises, and by about 60% they are out of reach.
- **The chains stop well short of a kill.** Fowls' combos deal 50–64% and finish with the opponent high and free. Even the best ones end at 0.5–0.65× the damage needed to kill from a standing start.
- **The searches confirm it.** A greedy search that kept extending the grab loop one step at a time also dropped the chain after 23 hits.

## 2. Kill confirms

None of the multi-hit kill confirms holds against all nine defences. The reliable kills are single moves on an opponent who is already standing in range: punishes, not confirms.

| Rank | Bird / route | Start % | Holds vs | Notes | Class | Clip |
|---|---|---|---|---|---|---|
| 1 | **Pip `usmash`** at distance 4–7 | 80% (Flint, Nib, Joey), 110% (all six) | 9/9 defences | 17.6% hit; kills Flint at 80% even with DI up-out + SDI up | Situational punish | `2_Kill_Confirms/pip_usmash_KO_80pct_...` |
| 2 | **Cinder `dsmash`**, near the right ledge (x 30, distance 13) | 80% | 9/9 defences; KOs all six opponents with no DI and holds 9/9 on Flint, Nib and Joey | 22.7% hit | Situational punish | `2_Kill_Confirms/cinder_dsmash_ledge_KO_...` |
| 3 | Cinder `usmash` | 80% | 9/9 vs Flint, Nib, Joey | Fails on Hod and Fyrdsman at 80% | Situational punish | — |
| 4 | **Bolt `sh_dair:4:n > fsmash`** near the ledge | 80% | 7/9 | Escapes: DI in + SDI in + jump away, and DI down-in + SDI down + jump away. Doesn't KO Hod, Cronky or Fyrdsman | Kill confirm (DI-dependent) | `2_Kill_Confirms/bolt_dair_fsmash_ledge_KO_80pct_noDI` |
| 5 | Cinder `sh_dair:8:f > usmash` | 50% | 6/9 | Beaten by DI up-out + SDI up + air dodge | Kill confirm (DI-dependent) | — |
| 6 | Rusty `sh_dair > fsmash` (the dummy hits first) | 50% | 4/9 | Beaten by DI down | Situational trick | `4_Bird_and_Projectile_Tech/rusty_dummy-dair_fsmash_KO_50pct_noDI` |

**Counterplay.**
- Smash punishes: don't stand still in range. Against Pip at 80%+ and Cinder near the ledge at 80%+, shield or spot-dodge.
- The Bolt and Cinder confirms: DI in or down, then jump away.

## 3. Reliable combos (ranked by worst case over the nine defences)

| Rank | Bird / route | No DI | Worst of 9 | Weights | Execution | Clip |
|---|---|---|---|---|---|---|
| 1 | **Pip `@4 grab_u > sh_nair`** | 8 hits, 20.3% | 6 (DI up-out, SDI up, air dodge) | 7–8 on every opponent; at least 4 on all six | Human-executable: up throw, then a short-hop nair on frame 4 of the hop. Nair has a long active window (frames 6–14) | `3_Reliable_Combos/pip_upthrow_nair_5hit_vs_Flint_DI-upout-SDI-up-airdodge` (this defence gave 5 hits in the recording) |
| 2 | **Pip `@13 sh_nair > ff > sh_nair`** | 14 | 4 | Hod 5, Joey 4–5, Fyrdsman 6, Nib 0 (whiffs on Nib) | Human-executable: short-hop nair, fast-fall, repeat | — |
| 3 | **Bolt `@13 grab_u > fh_nair > dj_fair > bair`**, 50% | 9, 42.2% | 5 | 5–6 on Flint, Nib, Joey and Cronky; Hod 1 | Human-executable | `3_Reliable_Combos/bolt_upthrow_nair_fair_bair_9hit_50pct` |
| 4 | **Rusty `@13 sh_nair:11 > up:15:tu > dj_bair`** | 7 vs Cronky, 3 vs Flint | 4 vs Cronky, 2 vs Flint | Heavy targets take more of it | Human-executable: a late nair (frame 11), then the Cyclone with a quarter-second charge | `3_Reliable_Combos/rusty_nair_cyclone_bair_3hit_vs_Flint_0pct` |
| 5 | **Rusty 20-hit route** (see section 1) | — | 20 hits, 62% against DI in + SDI in + jump away | Ends with both offstage: the chain carries Fowls past the ledge | Frame-perfect theoretical route (aerials on exact frames 4, 8 and 11) | `3_Reliable_Combos/rusty_20hit_62pct_vs_DI-in-SDI-in-jumpaway` |
| 6 | **Pip 25 hits / 63.9%** and **30 hits / 53.3%** | — | 6–7 | Huge against the scripted defender only when it doesn't DI out | Frame-perfect theoretical route | `3_Reliable_Combos/pip_25hit_...`, `pip_30hit_..._vs_Cronky` |
| 7 | Cinder `@13 sh_nair > dair` | 5, 29% | 4 (DI out) | Nib and Joey only 1 | Human-executable | — |

Opponent notes:
- Nib (small) often dodges Pip's short-hop nair entirely.
- Hod resists the Bolt and Pearl strings.
- Cronky (the heaviest) takes the longest chains.

## 4. Bird-specific setups

- **Pip: grab in hitstun.** A grab connects on an opponent who is still in hitstun, so `nair > grab_u` is part of the same combo. Pip's best routes each use it once or twice.
  - Throws set a 60-frame grab immunity, so a direct throw → regrab never works. An aerial has to go between.
- **Rusty: the dummy dair.** Rusty's `dair` drops a wooden dummy (8% on hit, 60 knockback growth late). It is a free first hit into `fsmash`: 2 hits, 37.8% at 50%, which KOs with no DI (section 2, row 6).
- **Bolt: Skitter Step jump-cancel** (`dnj`). Down B, then jump on frame 13. It travels 62.8 units and peaks at 12.7.
  - It worked as a combo extender in one search result (`sh_nair:11:n > dnj > nair`, 10 hits against DI up-out + SDI up + air dodge).
  - Fresh replays of the longer Bolt routes dropped the counter, so only the short version is listed.
- **Cinder: the plunging dair** spikes (angle 270). Off `sh_nair` it gives 5 hits / 29%. Cinder's `dsmash` near the ledge is its strongest kill (section 2).
- **Pearl:**
  - **Egg dair.** `fh_dair:16:n > nair`, 6 hits on Cronky and Fyrdsman. It whiffs on Flint, Nib and Joey from this spacing.
  - **Sling Spin airtime.** Pearl's nair keeps her airborne longer: 54 frames against 44 for a plain short hop. The other birds show no difference.

## 5. Projectile tech

- **Side B flights** (all from the ground, no steering unless noted):

  | Bird | Flat | Aimed up | Aimed up, stick held forward |
  |---|---|---|---|
  | Rusty | 81.6 | 68.8 (peak 37) | 148.6 |
  | Bolt | 92.7 | 115.5 (peak 80.4) | 170.4 |
  | Cinder | 43.5 | — | 56.4 |
  | Pip | 76.1 | — | 142.6 |
  | Pearl | 109.6 (53 frames) | — | 138.9 |

  Holding the stick forward roughly doubles the range for every bird except Cinder.
- **Side B aim in the air holds height.** From y 50, the 16-frame aim keeps vertical speed at 0. It is a short stall before the bird leaves.
- **Rusty's dummy** (section 4) is the only projectile that started a verified kill route.
- **Pearl's egg** (section 4) is a hitbox below that starts short strings on heavy opponents.
- **The empty slingshot.** After a launch the empty slingshot falls (gravity 0.1, max fall speed 2.4) and lands on platforms. If it falls below the bottom blast line (y −130) for 45 frames, it reappears on the stage 8 units in from the nearest ledge (tested: it reappeared at x 60). This behaves as designed.

## 6. Movement tech (measured, every bird unless noted)

| Technique | Result | Clip |
|---|---|---|
| Wavedash, long (air dodge at −0.35 down) | 23.2 units, 27 frames until free | `5_Movement_Tech/rusty_wavedash_x3_dashdance` |
| Wavedash, short (−0.8 down) | 7.3 units, 17 frames | same |
| Dash dance (8-frame turns) | Covers 16.8 units (Cinder 13.1) | same |
| Bolt Skitter Step | 31.2 units, 30 frames | `5_Movement_Tech/bolt_skitter-step_jump-cancel` |
| Bolt Skitter Step jump-cancel (frame 13) | 62.8 units, peak 12.7 | same |
| Cyclone from the ground, full charge, up | Rise: Rusty 78.8, Bolt 93, Cinder 69.3 | — |
| Cyclone from the ground, full charge, diagonal | Rusty 55.7 / 55.7, Bolt 73.6 / 65.7 | — |
| Cyclone from the air, full charge, sideways | Rusty 109.9, Bolt 135.3, Cinder 100.5, Pip 109.9, Pearl 103.6 | `5_Movement_Tech/bolt_air-cyclone_sideways_full-charge` |
| Cyclone charge float (holding the charge in the air) | Sinks 36 units in 70 frames, against 85–100 falling normally; can be held about 240 frames | — |
| Cyclone ceiling | Released above y 110 (30 below the top blast line), vertical speed is set to 0: an upward Cyclone can't carry Fowls into the top blast line | — |
| Side B aim stall in the air | 16 frames at vertical speed 0 | `5_Movement_Tech/pip_sideB-hover_then_flight` |
| Side B flight range | See section 5 | — |
| Pearl Sling Spin float | +10 frames of airtime per short hop | — |
| Selector wheel held in the air | Does not slow the fall (same distance as falling normally) | — |

## 7. Glitches (documented, not fixed)

1. **A sideways Cyclone from the ground never takes off.** Reproducible every time for Rusty, Bolt, Cinder and Pip. Pearl is exempt because her float adds 0.25 upward speed.
   - **What happens:** Up B on the ground, released with the stick fully horizontal. Fowls doesn't fly. It "lands" the next frame and takes the full 28-frame no-hit landing lag.
   - **Range:** It slides only 5.2 units (no charge) to 14.3 units (full charge).
   - **Side effect:** The move name stays `uspec` after landing (a stale label).
   - **Clip:** `6_Glitches_and_Exploits/glitch_ground-cyclone-sideways_fizzle_28f-lag`.
   - **Impact:** A self-punish trap for players who aim the Cyclone sideways on the ground.
2. **Stale move label after a special lands.** Also reproducible: when Pip lands from the ledge during a Side B input, the move name stays `sspec` while the state is `land`.
   - It is cosmetic only. No timing effect was measured.

Probed and found **not** to be glitches:
- Pip's Switcheroo can't teleport into the island: the stage's side pushes Pip back out at every height tested (y −12 to −40).
- Rejoining the slingshot doesn't refresh air options.
- The lost slingshot comes back correctly.
- No infinite stall was found. The Cyclone charge float ends by about frame 240.

## 8. Spectacular discoveries

1. **Pip's 38-hit, 50.3% chain against a defender who DIs in, SDIs in and jumps away.** Fresh replay, no counter drop.
   - Route: four short-hop nairs with fast-falls, then dair, nair, tap B and the Cyclone.
   - It's the longest unbroken chain found anywhere in this playtest.
   - Clip: `7_Funny_and_Spectacular_Discoveries/pip_38hit_50pct_vs_DI-in-SDI-in-jumpaway`.
2. **Pip's 30-hit chain on Cronky** (the heaviest opponent) at 53.3%, and the 25-hit grab relay on Flint at 63.9%, with two grabs in hitstun.
3. **Rusty's 20-hit, 62% route** against DI in + SDI in + jump away. It carries both fighters off the right side of the stage.

## 9. Clips

Every clip is in `playtest-results/furious-fowls/<folder>/`, with a `.json` beside it holding the route, setup, defender and the result read from the game.

The folder names have no spaces, because the clip server strips them.

- `1_Zero-to-Deaths/`: empty. None exist (see `README.md` there).
- `2_Kill_Confirms/`: Cinder dsmash at the ledge; Pip usmash at 80%; Bolt dair → fsmash.
- `3_Reliable_Combos/`: Pip up throw → nair; Pip 25-hit; Pip 30-hit vs Cronky; Bolt up throw string; Rusty nair → Cyclone → bair; Rusty 20-hit.
- `4_Bird_and_Projectile_Tech/`: Rusty dummy dair → fsmash; Pearl egg dair → nair vs Cronky.
- `5_Movement_Tech/`: wavedashes and dash dance; Bolt Skitter jump-cancel; air Cyclone sideways; Side B hover.
- `6_Glitches_and_Exploits/`: ground sideways Cyclone fizzle.
- `7_Funny_and_Spectacular_Discoveries/`: Pip 38-hit.

The raw search output is in `ztd/batch/` (85 runs) and `ztd/policy/` (90 runs). Every replayed route is in `verify.json`, and the measured movement numbers are in `movement.json`.

## Tools (testing only; the game never loads them)

- `tools/fowls-node.js`: runs `sim.js` headless in Node.
- `tools/fowls-lab.js`: the action library, scripted defender, `FL.run`, `FL.begin`/`FL.act`/`FL.save`/`FL.load`.
- `tools/fowls-ztd.js`: the beam search.
- `tools/fowls-verify.js`: fresh replays against nine defences and six opponents.
- `tools/fowls-move.js`: movement measurements.
- `tools/fowls-rec.js` + `tools/fowls-rec-server.js`: in-game clip recording.
- `tools/fowls-search.js`: an older search, superseded.

**Known limitation of the search:** a route found in a saved-state branch sometimes gives fewer hits on a fresh replay. For example, Rusty's 11-hit route from the search replays at 8. That is why only fresh replays are reported here.
