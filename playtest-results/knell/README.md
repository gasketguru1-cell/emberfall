# Knell playtest: combos, kills, movement, glitches

Tested on 2026-11-12 on the `anim-overhaul` build. All tests ran in the real game: `sim.js` and `hitboxes.js` were run headless for the search, and the dev build at localhost:8317 was used for the clips. **No game file was changed.**

Scale of the search:
- About 6 million route branches.
- About 300 million simulated game frames.
- No crash, no exception and no stuck state anywhere.

How the testing worked:
- **Search:** a beam search over Knell's real inputs: every tilt, smash, aerial, special, throw and jump, short waits, and Hinge forward, back and up. A branch is kept only if the game's own combo counter goes up and never resets.
- **Verify:** each route is replayed against 270 defenders: 9 DI directions × 5 SDI choices × 6 escape habits. The escape habits are none, jump, air dodge, attack, shield, and all of them mashed. Routes are also replayed against the level-9 CPU, against Joey, Potato Sack, Scuttle and Sprocket, at 0–90%, and with human timing, where every input is pressed 0–n frames late over 30–40 seeded trials.
- **True combo:** the counter never drops before the last hit, or the opponent is KO'd while still in hitstun.
- **Slingshot check:** each KO is checked for a speed jump that happens without a hit. That separates real launches from the Link-Slingshot glitch below.

Terms used below:
- **T1** means Knell starts with 1 Thread banked.
- **Hinge** is Knell's special pressed after a hit lands. `hf`, `hb` and `hu` mean Hinge forward, back and up.
- **frame-perfect** means each input on the first frame the game accepts it.

---

## Headline: what changes how Knell is played

1. **Thread decides everything.** With 0 Thread at 0%, Knell has no true combo at all; even jab → jab2 drops. With 1 Thread banked, he has loops that never end.
   - Thread never decays during a stock. It goes up every time two hits in a row come from different direction groups. That is why the loops below run so long:
     - each Hinge spends a Thread;
     - each switch between bair and dair earns one back.
   - Banking one Thread in neutral is the most important thing a Knell player can do.
2. **There is no zero-to-death that beats every defence.** Every single defensive habit tested on its own loses a stock to Knell:
   - no DI, DI in, DI out, SDI in;
   - DI down with SDI down and mashing;
   - DI up-in with SDI up-in and mashing.

   Each of those needs its own route, though. Against DI in + SDI in + mashing every escape, the deepest search managed only 8 hits and 94%, with no KO. That search used the full step set, 3 Thread and about 221,000 branches. So in a real match Knell's zero-to-deaths are reads, not guarantees.
3. **Knell's kill power is low.**
   - At centre stage nothing tested kills Flint under 140% against every DI.
   - The realistic kills are ledge confirms into a smash (section 2).
4. **Link-Slingshot is a harmful glitch.** It is a Hinge slow plus a link hit. It KOs Flint at 1.5% if the victim does nothing, and a version KOs Nib at 28.9% while the victim is still in hitstun (section 5).

---

## 1. Zero-to-deaths (all frame-perfect, all T1 at 0%)

| # | Opponent / defence | Hits, damage | Kill | Defenders it beats | Human timing | Clip |
|---|---|---|---|---|---|---|
| 1 | Flint, no DI | 11 hits, 118.8% | fsmash (launch) | 4 / 270 | 0/30 at 1 frame late | `Zero-to-Deaths/ZTD1_…` |
| 2 | Flint on left platform, no DI | 7 hits, 79.9% | dair (launch) | 4 / 270 | 1/30 at 1 frame late | `Zero-to-Deaths/ZTD2_…` |
| 3 | **Hod** (heaviest), no DI | 18 hits, 187.4% | air Rimskip (launch) | 1 / 270 | 0/30 | `Zero-to-Deaths/ZTD3_…` |
| 4 | Flint SDI-ing in on every hit | 16 hits, 163.2% | bair (launch) | 1 of 2 SDI timings | not tested | `Zero-to-Deaths/ZTD4_…` |
| 5 | Flint DI down + SDI down + mashing jump/air dodge/attack | 9 hits, 81.4% | dair (launch) | 1 of 6 mash timings | not tested | `Zero-to-Deaths/ZTD5_…` |
| 6 | Flint DI up-in + SDI up-in + mashing | 11 hits, 116.2% | bair (launch) | 1 of 6 mash timings | not tested | `Zero-to-Deaths/ZTD6_…` |

All six were replayed in the real game and the KO reproduced. None is a slingshot: the opponent's speed never rose without a hit.

Routes (tokens as pressed):

- **ZTD1** `ftiltH hf sh dair hu w4 ff bair hf w10 usmash fh bair hb uair fh fair dj fairL hf dair hf ftiltL hf fsmash`
  - Up-angled forward tilt, then ten Hinges, ending on the ground with a forward smash. This is the only one that finishes with a smash, so it is the most "watchable".
- **ZTD2** `fh dair hu bair hb sh sspecA dj fairL hu w4 ff fairH hu w4 ff bair hu dair`
  - Starts with the opponent standing on the left platform, Knell 8 units to their left.
- **ZTD3** `utilt hu dair hf bair hf usmash fh fair hb fh dair hb w10 bair hf dair hf usmash fh nair hf dj w6 bair hb dair w10 fh w6 fairH hf dj w6 bair hb dair hu w10 bair hb w10 sspecA`
  - On Hod, the heaviest fighter, so it is the most impressive. Thread never runs out: it is spent and re-earned 17 times.
- **ZTD4** `utilt hu dair hf bair hf usmash fh fair dj uair hf fh dair hf w10 ff bair hu dair fh w6 fairH hb dj w6 bair hu dair hb bair hu dair hf w4 ff bair`
- **ZTD5** `sh w6 nair hf fairH sh dair hf uair sh bair hb fairH fh dair hb w10 ff fair hu w10 dair`
- **ZTD6** `sh w6 nair hf fh dair hf bair hu w10 dair hf w10 sspecA dj w6 fairH hf fh fair dj bair hu uair hu dair hf bair`

Also found but not recorded: routes that beat DI in alone (15 hits, 154.5%) and DI out alone (14 hits, 128.4%).

**How to escape them:**
- Any change of DI or SDI direction, or a different SDI or mash rhythm, breaks a fixed route.
- The best defence found is to DI in, SDI in and mash escapes.

**Practical use:** these are proofs of the ceiling, not match routes. Being 1 frame late breaks every one of them. A human Knell should treat them as a menu of follow-ups and pick the next hit by reading the DI. The short blocks in section 3 are the human-sized pieces.

---

## 2. Kill confirms (verified against all 9 DI directions)

Measured near the right ledge (Knell at x = 80, opponent 9 units further out) against Flint. A "kill" means a KO while the opponent is still in hitstun.

| Rank | Route | Thread | From | Survives with | Human timing | Clip |
|---|---|---|---|---|---|---|
| 1 | **dtilt → Hinge forward → usmash** | 1 | 120% (8 of 9 DIs) | DI down-away only | 30/30 kills up to 3 frames late, 26/30 at 4 | `Kill-Confirms/KC1_…` |
| 2 | **jab → Hinge forward → fsmash** | 1 | 120% (5/9), 140% (6/9), 160% (7/9) | DI down / down-in | 30/30 kills up to 3 frames late, 26/30 at 4 | `Kill-Confirms/KC2_…` |
| 3 | dtilt → Hinge → up-angled ftilt → Hinge → fsmash | 2 | 120% (5/9) | DI in / up-in | not tested | `Kill-Confirms/KC3_…` |
| — | raw fsmash (reference, not a combo) | 0 | 140%, every DI | — | — | `Kill-Confirms/KC4_…` |

At centre stage (x = -11):
- dtilt → Hinge → usmash still kills against 7 of 9 DIs at 120%, but only 4 of those KOs land while the opponent is in hitstun.
- jab → Hinge → fsmash mostly fails.
- usmash alone kills from 140%, except against DI down, up-out and down-out.

**Survival DI against Knell:** hold **down** (down-away against usmash). Up and up-in DI help Flint survive the bair finishers.

Not confirmed:
- **Unverified as true:** the back throw kills Flint from about 180% at centre in 9 of 18 trials, but it is a throw, not a confirm.
- **Not found:** offstage dair spike confirms. No spike kill turned up in any search, so it is unverified.

---

## 3. Reliable combos for humans (verified)

Each verify run used T1 at 0% against Flint. Defenders who start mashing only once the first hit lands count too.

| Rank | Route | Defenders it beats | Human timing | Weights | Clip |
|---|---|---|---|---|---|
| 1 | **short hop nair → Hinge forward → up-angled fair** | **270 / 270** | 16/40 at 1 frame late; the Hinge press is the hard part | Flint, Sprocket ✓; Joey, Potato Sack, Scuttle ✗ | `Reliable-Combos/RC1_…` |
| 2 | **dtilt → Hinge forward → up-angled ftilt** | 198 / 270 | **40/40 up to 3 frames late**, 34/40 at 4 | all but Joey ✓; 0–90% ✓ | `Reliable-Combos/RC2_…` |
| 3 | **up-angled ftilt → Hinge forward → short hop dair** | 162 / 270 | **40/40 up to 3 frames late** | all but Joey ✓; 0–60% ✓ | `Reliable-Combos/RC3_…` |
| 4 | utilt → Hinge up → bair (→ Hinge up → dair) | 61 / 270 | 40/40 at 2 frames late | Flint only; 0–60% | — |

**The human timing rule for Hinge:**
- The game accepts the press in a 12-frame window, but only **after** contact.
- Pressing on the contact frame or during hitlag is eaten.
- When to press, counted from contact:

  | Move | Press from |
  |---|---|
  | jab | +5 to +16 frames |
  | dtilt | +6 to +17 |
  | ftilt | +7 to +18 |
  | utilt | +15 to +26 (it waits for the second hit) |

- That makes dtilt and ftilt starters the most forgiving, which matches the table.

**Joey is the counter-pick.** Every short block failed on Joey. Why is not verified.

**The loop** (no DI, T1):
- Route: `utilt hu dair hu bair hb dair sh uair hf dj w6 bair hb dair hf bair hu dair hf bair hb fair hu dair hf bair …`
- Hinge-bair and Hinge-dair alternate, and each swap of direction refunds the Thread the Hinge spent.
- The recorded run is 19 hits / 186.6%. Searches ran it to 31 hits / 304% with no end. Recorded as `Glitches/GL3_…`.
- DI in + SDI in + mashing stops it.

---

## 4. Movement tech (verified unless marked)

| Tech | Result | Clip |
|---|---|---|
| Wavedash | 7.3 units (about 1 m) per wavedash; actionable on frame 16 after the jump press (jumpsquat 3) | `Movement-Tech/MT1_…` |
| **Hinge fall-stall** | The Hinge resets his fall, and the game sets but never checks a per-airtime Hinge limit (`hingeUsed`). In the loop Knell stayed airborne **418 frames (7 s)** while landing 16 Hinges | `Glitches/GL3_…` |
| Recovery line | Full hop → double jump → air Rimskip → Turnkey peaks at 79 units high, 67 across. Rimskip into Turnkey from a full hop *without* the double jump landed him instead | `Movement-Tech/MT2_…` |
| Dash dance | Works. Flipping the stick every 3 frames gives 19 turns a second, and every flip is a fresh dash. He creeps toward the direction of the first flip: 35 units left over 1 s at 3-frame flips, 11 at 10-frame flips (**the cause is unverified**) | — |
| Platform drop | Instant: airborne on the same frame down is pressed, with no delay frames | — |
| Ledge | Walking off the edge grabs the ledge automatically 19 frames later, facing back | — |
| Run | 32.6 units in 40 frames | — |

Not covered: wall rebound of the Rimskip (the stage has no walls); momentum carried from a dash into a jump (not measured); recovery extension with a Hinge offstage (it needs a hit, so it only works on an opponent who is offstage too).

---

## 5. Glitches

| Glitch | Kind | Escape | Clip |
|---|---|---|---|
| **Link-Slingshot** | **Harmful / game-breaking.** It kills from 0–100% | Any air dodge, attack or shield during the slow. Doing nothing or jumping dies | `Glitches/Link-Slingshot_…` (two clips) |
| **Thread loop** (Hinge bair ↔ dair) | Emergent mechanic bordering on an infinite. It is endless only against no DI | DI in + SDI in + mashing | `Glitches/GL3_…` |
| Hinge never limited per airtime (`hingeUsed` set, never read) | Emergent (it enables the fall-stall and the loop). Probably not intended | — | — |

**Link-Slingshot in detail:**
- **Cause:** several of Knell's hits are "link" hits. Each one keeps pulling the opponent toward a point next to Knell, at a speed of (gap ÷ frames left). His link hits are:
  - nair's first hit and dash attack;
  - the Needlewheel ticks and jab 3;
  - utilt's first hit, usmash's first two hits and Turnkey's first hit.
- **The trigger:** the Hinge slows the opponent to 1 frame in 4. If Knell then moves far away, the pull speed becomes huge, for example by a Hinge up, a double jump or a Turnkey. The opponent keeps that speed when the slow ends.
- **Minimal case:** `sh w6 nair hu dj w6 dair` KOs Flint at **1.5%**.
- **In-hitstun case:** `dtilt hf ftiltH sh dair hf nair hb dj w6 uspec` KOs Nib at **28.9%** while Nib is still in hitstun. 33 of 270 defenders die to it, and so does the level-9 CPU.
- **Who it affects:** Flint, Joey/Cronky and Fyrdsman on several routes; Nib and Hod mostly not.
- **Left unfixed, as asked.**

**Harmful-bug checks:**
- **Crashes:** none in about 300 million frames.
- **Stuck states:** none.
- **Desync:** not tested online. The game uses no randomness in gameplay, and the glitch is deterministic, so a desync is unlikely, but this is **unverified**.
- **Unavoidable infinites:** none. Every loop found is escaped by DI in + SDI in + mashing.

---

## 6. Clips (all in `playtest-results/knell/`, 5–15 s, WebM 1280×720 at 30 fps)

Every clip is real gameplay from the dev build: the 3D scene, the HUD with damage %, and the training-mode combo counter. A caption at the top left names the route and the defender.

| Folder | Clips |
|---|---|
| `Zero-to-Deaths/` | ZTD1 Flint 118.8%, ZTD2 platform 79.9%, ZTD3 Hod 187.4%, ZTD4 SDI-in 163.2%, ZTD5 DI-down + mash 81.4%, ZTD6 DI up-in + mash 116.2% |
| `Kill-Confirms/` | KC1 dtilt→Hinge→usmash, KC2 jab→Hinge→fsmash, KC3 two-Thread fsmash, KC4 raw fsmash reference |
| `Reliable-Combos/` | RC1 SH nair→Hinge→fairH, RC2 dtilt→Hinge→ftiltH, RC3 ftiltH→Hinge→SH dair |
| `Movement-Tech/` | MT1 wavedash shuffle, MT2 full hop → DJ → Rimskip → Turnkey |
| `Glitches/` | Link-Slingshot at 1.5% (Flint), Link-Slingshot in hitstun at 28.9% (Nib), GL3 Thread loop to 186.6% |

---

## Limits of this test

- The defenders are scripted habits: held DI, SDI flicks on every other hitlag frame, and escapes mashed every other frame. A real player mixes these up. ZTD4–6 are true only against one exact rhythm of that habit.
- "Optimal defence" here means the best of the 270 habits plus targeted searches. It is not a proof that no zero-to-death exists against DI in + SDI in + mashing. The search there ran 221,000 branches and stopped growing at 8 hits.
- Most tests were against Flint. The other weights were checked on the short blocks and on ZTD3 (Hod) only.
- Human-timing tests add lateness only. They don't add early presses or wrong directions.

## Tools (testing only; the game doesn't load them)

- `tools/knell-lab.js`: route tokens, defenders, and the run/watch harness.
  - Added in this pass: `gate`, so a defender waits for the first hit before mashing.
- `tools/knell-search.js`: the beam search (`node tools/knell-search.js job.json`).
- `tools/knell-verify.js`: the defender, weight, percent and late-input checks.
- `tools/knell-record.js` with `tools/record-server.js` `/kfile`: the clip recorder.
