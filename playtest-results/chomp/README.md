# Chomp Chomp playtest: coal, rope and ant (2026-11-12)

The Discovery Album is [index.html](index.html), served at http://localhost:8317/dev/playtest-results/chomp/index.html. It has every clip, with stills taken from the clips.

All of this was run in the real game, either headless in Node or drawn in a browser tab, at the game's own 60 Hz. **No game code, balance or mechanic was changed.** Only testing tools were added (listed at the end). Nothing found here has been fixed.

The brief arrived cut off at "Explore thousands". I read that as "explore thousands of routes" and did that: 51 search jobs, 6.49 million route branches, 274 million simulated frames, and 20,489 true-KO routes before removing duplicates.

## How "true" was tested

- **True:** the game's own training combo counter never resets between Chomp's first hit and his last hit (or the KO, with the opponent still in hitstun). Coal and ant hits count, because the counter counts them.
- **Defenders:**
  - the 9 DI directions;
  - each DI combined with 5 SDI options and 6 escape attempts (jump, airdodge, attack, shield, all of them), 270 defenders in all;
  - the game's own level-9 CPU.
- **Human timing:** every input in the route pressed 0–n frames late, chosen at random, over 30 seeded trials for each n.
- **Opponents:** mostly Flint, Potato Sack, Sprocket and Knell (light). Kill confirms were also checked on Joey.
- **Coals:** every coal in a reported route was really tossed by Chomp. Routes marked "coal already down" start with a coal he tossed earlier, landed and repositioned.

## Ranked discoveries

1. **Coal, down throw, fsmash kills at about 110%.** `coalH grab_d fsmash` (3 hits, 40%).
   - Against Knell it is true for all 9 DI directions and kills from 90% to 130%.
   - It still works 30/30 with every input 1 frame late, and 20/30 at 2 frames late.
   - On Potato Sack it is true for 6 of 9 DIs, from 100% to 130%.
   - It is the most reliable kill found.
2. **The wall-swing pop (glitch, not fixed).**
   - Rope Swing used while pinned against the island's side wall keeps the pendulum moving.
   - When Chomp rises past the floor he snaps to the pendulum's position, up to 49.9 units in one frame, onto the stage.
   - 256 of 360 tested recovery routes from below the ledge did it. Example from (−100, −35), holding forward: `rs w8 rs2 w8 rs2 w8 rs2 w30` ends standing at x −19.
3. **With a coal already down, ant into fsmash is a DI-proof opener.**
   - `ant w28 fsmash` then `ro_f hop fair` or `ro_f w9 bite`: 3 hits, about 40%.
   - True against all 9 DIs on Flint, Knell, Sack and Sprocket, and 20/20 at 1 frame late.
   - All four "coal already down" zero-to-deaths start with it.
4. **The reactive ant ledgetrap.**
   - Chomp tosses the coal to the ledge (it lands at x 60) and waits at x 20.
   - He calls the ant 12 frames after the opponent leaves the ledge.
   - That catches neutral getup, roll, ledge jump, and drop then double jump, at every delay tested (10–70 frames), on Flint, Sack and Knell.
   - The getup attack gets through 3 times in 4, except on Knell.
   - Fair comparison: the scripted opponent never adapts, and Chomp standing at the ledge (x 46) with only fsmash covers the same options. What the ant adds is covering them from 48 units away.
5. **Grabs lose to the ant, and damaging attacks cut the rope.** Grabs never cut the rope. Measured with the opponent on the rope line, attacking a set number of frames after the ant call:

   | Opponent | Move | Result |
   |---|---|---|
   | Flint | jab, ftilt | interrupted by the ant |
   | Flint | dtilt | cuts the rope when started 4–24 frames after the call |
   | Potato Sack | jab, ftilt, dtilt | cut the rope when started 4–20 frames after the call |
   | Knell | everything tested | interrupted by the ant |

6. **`coalH grab_f` into `ant sh fair` is the general starter.** It gives 5 hits and 44%, and holds against 6 of 9 DIs with inputs 1 frame late. Nine of the twelve zero-to-deaths begin with it.
7. **Zero-to-deaths exist on every fighter tested, up to 12 hits and 120%**, but only against the DI each was found for (table below). Under human timing they break where they turn DI-specific: after the first 2–3 links.
8. **Coal relays reach across the stage.** The relay window is 3 frames either side of the mark, and a relay at most 1 frame off adds speed. Relays 2 frames off still relay but add nothing (7.6%).

   | Toss and relays | Lands | Hit |
   |---|---|---|
   | Plain toss | 33 units away | 7.6% |
   | 3 perfect relays | 101 units | 8.8% |
   | High toss + 3 perfect relays | 119 units | 10.5% |
   | Low toss + 3 perfect relays | — | 7.8% |

9. **Ant anti-air.**
   - A full hop 20 frames after the ant call swings the rope up, so the ant meets an opponent jumping at about y 25.
   - Hops at 26, 32 and 38 frames missed.
   - The rope keeps the ant's progress along it, so moving Chomp swings the ant around the coal. Walking toward the coal shortens the ant's trip.
10. **The rope is a ramp, not a hitbox.**
    - It never deals damage.
    - A flat rope on the floor never blocks walking.
    - A sloped rope (Chomp on a platform) doesn't block an opponent running under it.
    - An opponent falling onto a sloped rope is slowed from 1.55 to about 0.3 units a frame and slides down it toward the coal.
    - Jumping lifts the rope over a standing opponent.
    - A rope through solid stage is cut, except for a hanging coal's.
11. **Ledge fsmash is Chomp's edgeguard.** It kills 4 out of 4 at 100% on Flint and Potato Sack, and at 80% on Knell, with the level-9 CPU recovering. Other options against the recovering CPU:
    - Hanging a coal off-stage and calling the ant hits often (6–15%), but the rope rarely blocks (0–1 frames) and the CPU recovered every time.
    - Off-stage rope bite, fair and cushion only added kills against Knell (40–60%).

## Zero-to-deaths

Every one was replayed and confirmed in the browser with the same result. "Late 1" means every input pressed 0–1 frames late at random, out of 30 trials.

| # | Opponent | Hits | % | DI it holds against | Late 1 | Route |
|---|---|---|---|---|---|---|
| Z03 | Potato Sack | 12 | 120.1 | none | 0/30 | `coalH grab_f ant sh fair ro_f w4 hop fair ff w9 bair ro_b w9 hop nair fair rf12 grab_u fh uair dj dair` |
| Z06 | Knell | 11 | 111.3 | in | 2/30 | `coalH grab_f ant rs w4 bite rf6 utilt ftilt ro_f w3 hop w6 fair dash ro_f hop uair dj dair` |
| Z09 | Sprocket | 11 | 108.6 | out | 1/30 | `coalH grab_f ant sh fair ro_f hop fair ff w9 bair ro_b w4 hop uair utilt fh nair ro_b hop dair` |
| Z08 | Sprocket | 10 | 101.2 | in | 1/30 | `coalH grab_f ant w28 ftilt ro_f w9 bite rf6 grab_u fh fair w3 dj nair ro_f hop dair` |
| Z04 | Potato Sack | 10 | 91.8 | in | 7/30 | `coalH grab_f ant w28 sh fair ro_f bite grab_f rf12 dtilt dtilt ro_f hop dair` |
| Z01 | Flint | 9 | 92.1 | out | 0/30 | `coal grab_f ant w28 dash ro_f w3 hop w6 fair fh nair ro_f w2 bite dj dair` |
| Z05 | Potato Sack | 9 | 88.8 | out | 0/30 | `coalH grab_f ant sh fair ro_f w2 bite grab_u fh nair ro_f hop dair` |
| Z07 | Knell | 8 | 77.4 | none | 20/30 | `coalH grab_f ant sh fair ro_f w2 bite ftilt ro_f hop dair` |
| Z02 | Flint (coal already down) | 8 | 92.0 | none | 1/30 | `ant w28 fsmash ro_f hop fair ff cush ro_f w5 bite rf6 grab_u fh nair ro_f hop dair` |
| Z10 | Knell (coal already down) | 7 | 84.2 | none, in | 1/30 | `ant w28 fsmash ro_f w9 bite dtilt ro_f w5 bite rf6 jab ro_f hop dair` |
| Z12 | Sprocket (coal already down) | 7 | 81.7 | out | 1/30 | `ant fsmash ro_f w5 bite rf6 dtilt ro_f w5 bite wf4 ftilt ro_f hop dair` |
| Z11 | Potato Sack (coal already down) | 7 | 80.6 | in | 5/30 | `ant fsmash ro_f w5 bite wf4 ftilt ro_f w9 hop fair ff cush ro_f hop dair` |

The level-9 CPU escaped every one. No fixed zero-to-death was found that holds against more than two DIs. Searches with Flint holding DI in, Sprocket with no DI, and Knell holding DI out found none at all.

**Where they stop holding.** Each route was cut after every link and replayed against all 9 DIs:
- Openers that hold against 6 to 9 DIs and survive inputs 1 frame late:
  - `coalH grab_f`, then `ant sh fair` (5 hits, 44%);
  - with a coal down, `ant fsmash`, then a rope-out (3 hits, 40%).
- After the 3rd or 4th link every route holds against only its own DI. A player who reads the DI at that point has a choice of endings; the album shows several for each opponent.

Reading the route tokens:
- `coal`, `coalH`, `coalL`: the toss straight, high or low.
- `ant`: call the ant.
- `ro_f`, `ro_b`: Rope Swing out of the move that just hit, forward or back.
- `rs`: Rope Swing; `rs2`: a later swing in a chain.
- `bite`, `hop`: the swing's bite or hop.
- `sh`, `fh`, `dj`, `ff`: short hop, full hop, double jump, fast fall.
- `w<n>`: wait n frames. `wf<n>`, `wb<n>`: walk forward or back n frames. `rf<n>`, `rb<n>`: run forward or back n frames.
- `cush`: cushion.
- `grab_f`, `grab_b`, `grab_u`, `grab_d`: grab and throw forward, back, up or down.

## Kill confirms

All were checked against the full set of 270 defenders, the level-9 CPU, five opponents, and ±20%.

| # | Opponent | At | Route | Holds against | Late 1 | Late 2 | Also |
|---|---|---|---|---|---|---|---|
| K05 | Knell | 110% | `coalH grab_d fsmash` | all 9 DIs (34/270) | 30/30 | 20/30 | 90–130%; Potato Sack |
| K02 | Potato Sack | 110% | `coalH grab_d fsmash` | 6 of 9 DIs | 30/30 | 22/30 | 100–130%; Knell |
| K01 | Potato Sack | 110% | `coalH dtilt usmash` | in, up-in (49/270) | 30/30 | 30/30 | 100–130%; Sprocket |
| K04 | Knell | 110% | `coalH dtilt fsmash` | 5 of 9 DIs | 30/30 | 22/30 | 120% |
| K06 | Knell | 110% | `coalH dtilt wf4 usmash` | in, up-in (50/270) | 3/30 | 1/30 | 120–130%; Joey |
| K08 | Flint | 110% | `coalH grab_u fh w4 nair ro_f w9 hop fair` | out | 30/30 | 20/30 | 90–110%; Knell |
| K12 | Knell | 80% | `coalL dtilt ant w28 dash` (the ant joins) | out, down-out | 20/30 | 15/30 | 60–80% |
| K07 | Flint | 80% | `coalH utilt fh w4 bair ro_b w9 hop dair` | in | 3/30 | 0/30 | Joey |
| K09 | Flint | 50% | `coalH ftilt rf6 sh fair ro_f w4 hop dair` | out | 14/30 | 7/30 | — |
| K11 | Potato Sack | 80% | `coalH grab_u wf4 fh fair rf6 sh dair` | out | 13/30 | 2/30 | Sprocket |

The level-9 CPU escaped every confirm too.

## Not found, and what is unverified

**Not found:**
- Any zero-to-death that holds against every DI.
- Any route the level-9 CPU couldn't escape.
- Any off-stage coal or ant setup that stopped a level-9 CPU from recovering.
- Kill confirms on Flint at 110% with no DI or DI in, and on Knell at 80% with no DI or DI in.

**Unverified:**
- The ledgetrap results use a scripted opponent that picks one getup at a fixed delay. A real player can also wait, shield or mix up, and that wasn't tested.
- The wall-swing pop was measured on the main island's wall only.
- Results on fighters other than Flint, Potato Sack, Sprocket, Knell and Joey weren't tested.
- "Human timing" here means random lateness of 0–6 frames. It doesn't model early inputs or a player adapting during a combo.

**Corrected along the way:**
- I first described a falling opponent as being "held on the rope like a platform". Frame traces show the sloped rope acts as a ramp: the opponent slides down it.
- An early "bubble death" was caused by the test's own stick input turning the bubble into Side B. I discarded it.

## Reproducing

Tools, added for this playtest only (the game never loads them):

| File | What it does |
|---|---|
| `tools/chomp-lab.js` | The harness: route tokens, defenders, setup with real tosses, combo watch |
| `tools/chomp-node.js` | Loads the game headless in Node |
| `tools/chomp-search.js` | The beam search over routes |
| `tools/chomp-verify.js` | DI, SDI, escape, CPU, opponent, percent and late-input checks (`def` on a route sets the DI it was found with) |
| `tools/chomp-record.js` | Records a route or scripted scene to WebM through `tools/record-server.js` (`/cfile`) |
| `tools/chomp-album.js` | Builds this album |

- Search: `node tools/chomp-search.js job.json`.
- Verify: `node tools/chomp-verify.js job.json`.
- Record: in a browser tab on `/dev/`, load `tools/record.js`, `tools/chomp-lab.js` and `tools/chomp-record.js`, then call `CREC.clip(...)` with `node tools/record-server.js` running.

Raw results (verification JSON, prefix tables, ledgetrap table) are in [data/](data/).
