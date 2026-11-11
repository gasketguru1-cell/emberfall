# Emberfall: Smash Ultimate fidelity audit

**Audit only.** No gameplay code, parameters, assets or config were changed, and nothing was committed. Audit date: 2026-11-10 (local evening). Brief: `C:\Users\rober\Downloads\Emberfall\Claude_Code_Smash_Ultimate_Fidelity_Audit_Prompt.pdf`.

Evidence labels used throughout:
- **MEASURED**: produced by running the project's own simulation, in its own tests or in the audit-only harness. The logs are in `docs/audits/ultimate_fidelity_audit_artifacts/`.
- **CODE-INFERRED**: read from source and not executed.
- **UNTESTED**: not checked at all.
- **VIDEO-INFERRED**: not used. No footage was captured or watched.

Reference values marked **[wiki]** come from SmashWiki pages fetched during this audit, with URLs in section B. SmashWiki is community-compiled, not official. Values marked **[recall]** are the auditor's own memory of Ultimate and were **not** verified against a source. They are excluded from every score.

---

## Short prioritized summary

1. **The "combos about 20% stronger than Ultimate" intent does not exist anywhere in the project.** Hitstun is exactly Ultimate's 0.4 × knockback (`sim.js:1142`). STATUS.md says hitstun "matched the reference and [was] left alone" (`assets/STATUS.md:90`). The only systematic offsets that lengthen combos are side effects: the −1 frame Ultimate subtracts from hitstun is missing, and the Ultimate "balloon" knockback speed-up is missing. This is AMBIGUOUS INTENT (P1), and the owner needs to rule on it before anyone tunes combos.
2. **Ledge rules are far stingier than Ultimate's.** Ledge intangibility is about half of Ultimate's and drops to zero from the second grab in each airtime. Ledge hang time is 4 s against Ultimate's 6.5 s. The tech window is 20 frames against Ultimate's 11. These touch every fighter's recovery and edgeguarding, and none is recorded as a deliberate choice (P1/P2, AMBIGUOUS INTENT).
3. **Some of the measurement tooling has rotted.** `tests/movement.js` crashes, and the movement section of `tests/combat-audit.js` gives sentinel values. Both park the dummy at y=150, above the ceiling that was lowered to 140 on 2026-11-10. Neither test is in `npm test`, so the failure is silent. Furious Fowls (10 forms) has no reach or frame-advantage audit (P2, BUG in tests).

The core physics mostly matches Ultimate where Ultimate is the intended benchmark: knockback formula, launch speed and decay, rage, DI/LSI, shield numbers, parry window, hitstun-cancel frames and jumpsquat. Rollback netcode reproduced the offline game exactly in all 12 runs. All 60 normals in the owner's moveset document match the code's first active frame and damage.

---

## A. Executive verdict

**What reproduces Ultimate.**
- The knockback formula (`sim.js:1420`), launch speed (0.03 × KB) and decay (0.051/frame).
- Rage (1.0 to 1.1× between 35% and 150%), DI (0.17 rad) and LSI (×1.095 / ×0.92, with the 65–115° exclusion).
- The grounded Sakurai angle (0° below 60 KB, 38° at 88 KB and above).
- Shield: 50 HP, ×1.19 damage, drain 0.15 and regen 0.08 per frame, 11-frame drop, 3-frame minimum hold.
- Parry on the first 5 frames of shield drop, hitstun cancel (air dodge from frame 40, other actions from 45), tech lockout 40, the 6-regrab ledge limit, the fresh-move bonus 1.05, and the first seven stale-queue entries.
- A fixed 60 Hz step, with rendering decoupled from it (`main.js:2-16`).
- Measured: jumpsquat is 3 frames for all 7 non-Fowl fighters.

**What does not reproduce Ultimate (and has no recorded reason).**
- The aerial Sakurai angle is 45° instead of Ultimate's 38°.
- The −1 frame on hitstun and the 4-frame flinch minimum are missing, and so is balloon knockback.
- The last two stale-queue entries differ, and hits on a shield stale at full weight instead of ×0.85.
- Shield pushback uses a different formula, and a broken shield resets to 30 HP instead of 37.5.
- Ledge intangibility, ledge regrab decay, ledge hang time and the tech window all differ.
- Shield-break stun is a flat 220 frames instead of depending on percent.

**What intentionally does not match Ultimate (and should not be "fixed").**
- The wavedash: the owner's `platforms.ini` model with a snap window of five fixed options.
- Tap jump is removed.
- Smashes come from a flick or attack+special, and the right stick gives tilts.
- The run turnaround waits for the skid.
- Fighters push each other (jostle).
- The ceiling was lowered to 140.
- Training mode, the reset shortcut, CPU level 0, the lethal-hit slow motion and the hit-spark switch.
- Every fighter's frame data, which comes from its own document.
- Potato Sack's no-ledge rule, its Tumble, and its uncapped Spud Bomb.
- The Fowls' two-shape design.

**Coverage and confidence.**
- Universal systems: about 34 mechanics were checked. 26 of them are scored against a fetched reference; the rest are excluded as having no reference or unclear intent.
- Fighters: all 8 roster entries (17 forms) were inventoried. 7 have measured reach and frame advantage from the project's own audit. The Fowls do not.
- Nothing was tried by a human, on a real controller, at 30/120 FPS, or in the rendered build.
- Confidence: **moderate** for the universal physics, **low** for feel and per-move fidelity.

**The three biggest problems.**
1. The combo-strength intent is unresolved.
2. The ledge, tech and recovery rule set departs from Ultimate without a recorded decision.
3. The movement and combat measurement tools are broken or incomplete, so later tuning is flying partly blind.

---

## B. Audit scope

| Item | Value |
|---|---|
| Repository | `C:\Users\rober\smash` (`Downloads\Emberfall` holds only design documents) |
| Branch | `anim-overhaul` (main branch: `main`) |
| Commit | Tests ran on the tree at `08a2e81`/`115c510`. During the audit, another session committed `aa32645` and left uncommitted edits to `sim.js` and `tests/rules.js`: Potato Sack's neutral air now drags only on the first use per airtime. **Those edits are not audited.** The Potato Sack neutral-air figures below predate them. |
| Engine | Plain JavaScript. `sim.js` (rules, headless-capable), `render3d.js` (Three.js 0.187), `render2d.js` fallback, `main.js` fixed 60 Hz accumulator loop. Electron desktop wrapper in `desktop/`. |
| Run | `node serve.js` → `http://localhost:8317/` serves the last commit; `/dev/` serves the working tree. The owner's tab was **not** touched. |
| Networking | Rollback (`net.js`). Direct UDP in the desktop app. EOS internet play is not built yet (waits on the owner's portal setup). |
| Input | Keyboard and gamepads (`sim.js:124-185`). Pad dead zone 0, triggers at 25%, buffer 9 frames with held-button buffering. |
| Test commands | `npm test` = `tests/headless.js && tests/rules.js && tests/fuzz.js 20 && tests/net.js`. Also `tests/movement.js`, `combat-audit.js`, `recovery.js`, `stats.js`, `levels.js`, `kotable.js` and `deaths.js`. |
| Test status (this audit) | headless **pass**; rules **179/179 pass**; net **12/12 identical to offline**; fuzz 20 matches **clean** (states never reached: `rebound`, `broken`); recovery **all land or ledge**; combat-audit **ran**, but its movement table is invalid (G-3); movement.js **crashes** (G-3). |
| Not run | `stats.js`, `levels.js`, `kotable.js` and `deaths.js` (long CPU runs, skipped to save budget). The rendered game, `tools/audit.js` (in-browser hitbox audit), and anything at 30/120 FPS. |
| Fighters found | Flint; Wren (Nib, Loom, Hod: swap forms); Potato Sack; Sprocket; Scuttle; Furious Fowls (Rusty, Bolt, Cinder, Pip, Pearl, each in slingshot and alone forms = 10 forms). **17 playable forms in all.** Planned only, with concept art and no code: Brand and Tilt. |
| Stage | One stage: a forge island with a 136-wide main platform, two soft platforms at height 26, and the solid underside shape `stageHalf()`. No hazards. Blast zones ±223 horizontal, top 140, bottom −140. |
| Modes | 1v1 versus (3 stocks, 8 min), CPU levels 0–9, training mode, online (rollback). No teams or FFA (`resolveHits` assumes 2 fighters). |
| Sources of truth | `assets/STATUS.md`, `assets/WORKQUEUE.md`, `Downloads\Emberfall\Emberfall_Fighter_Movesets.md/.pdf`, `Furious_Fowls_Complete_Moveset_Overhaul_v3.md`, `Furious_Fowls_Bird_Special_Moves_Bible_v1.md`, `assets/fowls/source/`, git history (81+ commits), the auto-memory notes, and comments in `sim.js`. |
| Reference version | Ultimate **Ver. 13.0.5 (released September 1, 2026)**, which is an online invalid-data fix with no balance or physics change. Source: https://en-americas-support.nintendo.com/app/answers/detail/a_id/42809/ |
| Reference pages fetched | https://www.ssbwiki.com/Hitstun, /Stale-move_negation, /Directional_influence, /Shield, /Air_dodge (page flagged by the wiki as partly inaccurate), /Sakurai_angle, /Knockback, /Tech, /Ledge (Edge). /Input_buffer returned 404. UltimateFrameData and Kurogane Hammer were **not** fetched, so no per-character Ultimate frame data is used (none is needed: every fighter is original). |

---

## C. Intent register

Benchmark classes: A = Ultimate-equivalent; B = Ultimate-inspired but modified; C = explicit non-Ultimate reference; D = original design; E = unknown intent.

| # | Rule | Class | Evidence | Confidence | Contradictions / notes |
|---|---|---|---|---|---|
| 1 | Universal combat physics (knockback, hitstun, hitlag, rage, DI/LSI, staling, shield) | A | `sim.js:50-59` constants; STATUS:90 ("matched the reference"); memory note "reference build" = owner's Ultimate dump and mod | High | Some constants are Smash 4-era values (see E) |
| 2 | Combos ≈20% stronger than Ultimate | **E** | Appears **only** in the audit brief. No repo doc, commit or code mentions it. The code uses Ultimate's 0.4 hitstun. | — | Direct contradiction between the brief and STATUS:90 |
| 3 | Wavedash, deliberate and not Melee's | B | `sim.js:25-31` (`T.wd_*`, "follow the player's own platforms.ini"); `rules.js` checks 2.0/1.1 speeds and action on frame 7; WORKQUEUE:31 | High | Never tried on a controller (STATUS:265) |
| 4 | Movement model (walk/run/dash/jump heights, carry, instant fast fall) | B | STATUS "Movement": the reference build's parameter list, with Emberfall's own values by archetype | High | The dash wait, skid grip and turn rules are guesses (STATUS: "Not known") |
| 5 | Run turnaround waits for the skid to bleed to 25% | B | STATUS:95; `sim.js:1192-1194` | High | Comment says 40%, code says 25% (`sim.js:1192` vs `:1194`): a stale comment |
| 6 | Tap jump removed; smash by flick or A+B; right stick tilts; grab from either stick | D | STATUS "Controls"; commit `0f0236e` | High | |
| 7 | One-on-one damage ×1.2 | A | `sim.js:51` | Medium | Not confirmed on a fetched page |
| 8 | Ledge intangibility "by air time and damage" | B or E | WORKQUEUE item 4; `sim.js:1394` | Low | Shape follows Ultimate, magnitudes about half. No stated reason. |
| 9 | Tech window 20 frames | E | `sim.js:1159` | Low | Ultimate's is 11 [wiki]. No doc. |
| 10 | Ledge hang ends at 240 frames | E | `sim.js:1332` | Low | Ultimate: 6.5 s under 100% [wiki] |
| 11 | Jostle (fighters push each other) | B | STATUS "Fighters push each other" | High | Push strength is a guess |
| 12 | Lethal-hit slow motion, extra hitlag on a KO hit | D | `sim.js:1514-1518` | High | +8 hitlag on a KO hit is not Ultimate. Cosmetic-plus-timing. |
| 13 | Ceiling 140 (was 200) | D (owner) | STATUS:97 | High | Broke two tests (G-3) |
| 14 | Hitboxes as limb "strike shapes"; one hurtbox per fighter | D (engine simplification) | STATUS:92, :100 | High | Acknowledged as not done |
| 15 | Flint, Nib, Loom, Hod and Sprocket frame data | D | `Emberfall_Fighter_Movesets.md`; `KIT` (`sim.js:257`) | **High (measured 60/60)** | Recorded deviations: Wren's swap hangs in the air; Loom's ribbon has no dead spot; vise range 1 H |
| 16 | Scuttle | D (document numbers, original identity) | STATUS "Scuttle"; memory note | Medium | The source document was not in `Downloads`, so first active frames were not cross-checked |
| 17 | Potato Sack | D (owner-directed) | STATUS "Potato Sack"; commits `5cb502c`, `5920ba9`, `08a2e81` | High | Neutral-air drag being reworked concurrently (B) |
| 18 | Furious Fowls | D (owner's v3 overhaul and special-moves bible) | `Downloads\Furious_Fowls_*`; STATUS "Furious Fowls v3"; target 55–65% win rate | Medium | STATUS lists simplifications; some earlier ones were later replaced (wheel, doubles) |
| 19 | Fighters emulating another Smash game (e.g. a Melee-style swordfighter) | none present | No fighter in the repo is specified as C | High | Nothing to audit as class C |
| 20 | Throws release on frame 10 for every fighter | E | `sim.js:1314` | Medium | Documents give throw damage only |

---

## D. Scorecard

Method: each check scores PASS = 1, PARTIAL = 0.5, FAIL = 0. Checks of UNKNOWN status, or without a fetched reference, are **excluded**, not counted as passes. Weights are those in the brief. Scores are rounded to 5 because the samples are small; the decimals are not meaningful.

| Category (weight) | Checks scored | P / Part / F | Excluded | Score |
|---|---|---|---|---|
| 1. Universal Ultimate fidelity (30%) | 26 (listed in E, rows marked ★) | 15 / 4 / 7 | 8 (no fetched reference) | **≈65** (≈70 if the tech window, E-class, is excluded) |
| 2. Input, movement, feel (20%) | 11: fixed step; jumpsquat; short/full hop; fast fall; dash/run (own design); run turnaround (B); wavedash (B, rules.js); tap-jump removal; pad dead zone 0 (PARTIAL: drift risk); 30/120 FPS independence (PARTIAL: code only); movement test tool (FAIL) | 8 / 2 / 1 | Human execution, real controllers | **≈80** |
| 3. Combat, defense, interaction (20%) | 14: swept hit detection; clank; projectile clash; shield/poke/parry; armour/counter; ledge trump and regrab cap; combo-counter truthfulness (code); fuzz no stuck states; throw timing (PARTIAL); tech window (PARTIAL); single hurtbox (PARTIAL); fixed hitbox shapes (PARTIAL); ledge intangibility (FAIL); Nib dtilt hole (FAIL) | 8 / 4 / 2 | Infinite/zero-to-death search, Hod and Sprocket air "no hit" (unverified) | **≈70** |
| 4. Fighter implementation vs own spec (20%) | 8 entries × up to 5 checks (doc frames/damage; specials present; deviations recorded; reach holes; CPU balance in its band) | see F | Scuttle's and the Fowls' doc frames | **≈85, low confidence** |
| 5. Runtime reliability, edge cases (10%) | 6: determinism (net 12/12); fuzz clean; headless clean; rules 179/179; recovery; test rot (FAIL) | 5 / 0 / 1 | Desync handling under real latency; 30/120 FPS | **≈85** |

- **Intended-design conformance (weighted): ≈75 / 100**, moderate confidence for the physics and low for feel.
- **Pure-Ultimate similarity (only directly comparable systems: the category-1 checks): ≈65 / 100.** These two numbers are deliberately kept apart.
- **Evidence coverage:** about 34 universal mechanics looked at, 26 scored. 17/17 forms inventoried. 7/8 fighters have measured reach and frame advantage. 0 human, controller or video checks.

---

## E. Universal mechanics table

★ = scored in category 1. Dev = deviation.

| Mechanic | Expected (source) | Actual (code) | Measured / status | Dev | Sev | Label |
|---|---|---|---|---|---|---|
| ★ Update basis | 60 Hz fixed | `main.js:11-15` accumulator at 1000/60; catch-up capped at 100 ms | CODE-INFERRED | none (below 10 FPS the game slows rather than skips) | — | PASS |
| ★ Knockback formula | Melee-onward formula [wiki Knockback] | `sim.js:1420`, p = post-hit percent | MEASURED table (artifacts/harness.json) | none | — | PASS |
| ★ Launch speed / decay | 0.03 / 0.051 [wiki] | `sim.js:1141`, `:1274` | CODE | none | — | PASS |
| ★ Hitstun | 0.4 × KB, **−1 frame**, minimum 4 on flinch [wiki Hitstun] | `floor(kb*0.4)`, no −1, no minimum (`sim.js:1142`) | MEASURED: Flint fsmash on Flint at 0/50/100/150% → 26/50/74/98 (Ultimate rule gives 25/49/73/97) | +1 frame on every hit | P2 | PARTIAL |
| ★ Balloon knockback (hitstun > 32) | Ultimate launch speed-up [wiki Knockback, Hitstun] | absent | CODE | Strong launches take longer to travel the same path, so more time is spent in hitstun | P2 | FAIL / MISSING |
| Tumble threshold | ≥80 KB [recall] | `TUMBLE_KB = 80` | — | — | — | excluded |
| Hitlag | floor((d·0.65+6)·mult), cap 30 [recall] | `sim.js:1497`; crouch ×0.67; +8 on a KO hit | — | KO +8 is D | — | excluded |
| ★ Rage | 1.0–1.1 [wiki] | `sim.js:59` | CODE | none | — | PASS |
| ★ Stale queue | Ultimate: …0.04255, **0.03345, 0.025**; shield hits ×0.85 [wiki] | …0.04255, **0.03575, 0.02965**; shield hits stale at full weight (`sim.js:52`, `:1476`) | MEASURED (constants dump) | slots 8–9 a little too strong (sum 0.5374 vs 0.5305) | P3 | PARTIAL |
| ★ Fresh bonus | 1.05 [wiki] | `FRESH = 1.05` | CODE | none | — | PASS |
| ★ DI | 0.17 rad; Ultimate reuses Smash 4 DI [wiki DI] | `sim.js:1509` (0.17) | CODE | none | — | PASS |
| ★ LSI | ×1.095 / ×0.92, excludes 65–115° and 245–295° [wiki] | `sim.js:1511-1512` | CODE | none | — | PASS |
| SDI | per-frame nudge in hitlag | up to 3 nudges of 1.1 units (`sim.js:1165`) | CODE | magnitude not compared | — | excluded |
| ★ Sakurai angle, grounded | 0° below 60, 38° at 88+, linear [wiki] | `sim.js:1502` | CODE | none | — | PASS |
| ★ Sakurai angle, airborne | **38°** [wiki] | **45°** (`sim.js:1502`) | CODE | +7° on every 361 move against an airborne target | P2 | FAIL |
| ★ Shield HP / multiplier / drain / regen | 50 / 1.19 / 0.15 / 0.08 [wiki] | `SHIELD`, `sim.js:56` | CODE | none | — | PASS |
| ★ Shield drop / minimum hold | 11 / 3 [wiki] | `release: 11`; `sf >= 3` (`sim.js:1253`) | MEASURED: 11 frames in shieldoff | none | — | PASS |
| ★ Parry | 5 frames on shield drop [wiki] | `sim.js:1477` | rules.js parry check passes | none | — | PASS |
| ★ Shieldstun | d·0.8·mult+2 [wiki]; mult values not given on the page | `floor(d*sm)+2`, sm = 0.8 / 0.725 / 0.33 / 0.29 | CODE | multipliers unverified | — | PARTIAL |
| ★ Shield pushback | (shieldstun+1)·0.09·…, max 1.3 [wiki] | `0.3 + d*0.04`, no cap (`sim.js:1489`) | CODE | different formula | P3 | FAIL |
| ★ Shield break | resets to 37.5 HP (75%); stun scales with percent [wiki] | 30 HP; flat 220 frames (`sim.js:1139`, `:1295`) | CODE; fuzz never reached `broken` | | P3 | FAIL |
| ★ Air dodge, neutral landing lag | 10 [wiki] | 10 (`sim.js:1117`) | CODE | none | — | PASS |
| ★ Air dodge, one per airtime | [wiki] | `airdodged` flag | CODE | none | — | PASS |
| Air dodge intangibility | Fox: neutral 2–26, directional 2–19 [wiki, flagged as partly inaccurate] | neutral 4–27; directional 18 frames from frame 4 | MEASURED, neutral 4–27 (Flint) | about 2 frames later | P3 | excluded (reference flagged) |
| Directional air dodge into the ground | 11–19 landing lag [wiki] | becomes a wavedash, actionable on frame 7 | rules.js | intentional (B) | — | INTENTIONAL |
| Spot dodge | not fetched | intangible 4–18 of 22 (Flint), by fighter | MEASURED | — | — | excluded |
| ★ Hitstun cancel | 40 / 45 [wiki] | 40 air dodge / 45 others (`sim.js:1272-1273`) | CODE | none | — | PASS |
| ★ Tech window | **11** [wiki] | **20** (`sim.js:1159`) | CODE | about 1.8× more lenient | P2 | FAIL (E) |
| ★ Tech lockout | 40 [wiki] | 40 | CODE | none | — | PASS |
| ★ Ledge intangibility | 60a/300 + 44 − 44p/120, 23–123 [wiki Edge] | clamp(24 + 0.1a − 0.17p, 8, 54) − 2, first grab per airtime only (`sim.js:1394`, `:1325`) | MEASURED table: a=120,p=0 → 34 vs 68; a=300,p=0 → 52 vs 104; a=30,p=120 → 6 vs 23 | about −50% | P1 | FAIL |
| ★ Ledge regrab | at most 6; intangibility ×0.8, then ×0.5, then none [wiki] | at most 6 ✓; **0 from the 2nd grab** | CODE | | P2 | PARTIAL |
| ★ Ledge hang time | 6.5 s below 100% [wiki] | 240 frames = 4 s (`sim.js:1332`) | CODE | −38% | P3 | FAIL |
| Ledge trump | Ultimate trump | `sim.js:1391` | CODE | — | — | (cat. 3) PASS |
| Ledge getup, slow at 100%+ | Ultimate concept | `sim.js:1327-1331` | CODE | values not compared | — | excluded |
| Jumpsquat | 3 [recall] | `jsq: 3` for all | MEASURED 3 for all 7 | — | — | excluded (unfetched) |
| Initial dash | per fighter | 10–15 frames | MEASURED (Nib 10 … Hod 15) | D | — | n/a |
| 1v1 damage | 1.2 [recall] | 1.2, also used in knockback `d` and shield damage | — | Whether Ultimate's knockback uses the 1v1-scaled damage is unverified | — | excluded |
| Short-hop aerial ×0.85, crouch ×0.85, charging-smash victim ×1.2 | SmashWiki lists the 1.2× charging bonus as "prior to Ultimate" | all three present (`sim.js:54`) | — | **charging ×1.2 may not exist in Ultimate** | P3 | AMBIGUOUS, excluded |
| Clank range 9%, grounded only | [recall] | `sim.js:1530-1539` | rules.js clank check | — | — | excluded |
| Input buffer | 9 [unverified, wiki 404] | 9 plus held-button buffering (`sim.js:169`) | CODE | — | — | excluded |
| Dead zones | — | pad 0 (owner's controllers.ini); walk at 0.2; dash 0.6 within 4 frames | CODE | Drift risk on worn sticks: DI and shield tilt read raw values | P3 | INTENTIONAL (owner) |
| 30/60/120 FPS independence | sim locked to 60 | accumulator | UNTESTED at runtime | | | |
| Respawn | — | platform at most 150 frames; 110 frames of intangibility after leaving | CODE | not compared | | excluded |
| Rollback | determinism | `net.js` | MEASURED: 12/12 runs identical to offline, at 60 ms and 2% loss, rollback depth at most 2 | none | — | PASS (cat. 5) |

---

## F. Fighter matrix

Each fighter has 24–26 move slots, all reachable: jab 1–3, ftilt, utilt, dtilt, dash, fsmash, usmash, dsmash, nair, fair, bair, uair, dair, grab, dash grab, pivot grab, getup, 4 throws, and 4 specials. Each also has its own movement `st`, roll and spot dodge. Startup and damage for the documented normals: **60/60 match** (Flint, Sprocket, Nib, Loom, Hod; artifacts/kitcheck.js). Reach, holes and frame advantage come from `tests/combat-audit.js` (MEASURED, CPU-free scripted, at 20% and 60%). **Not covered for any fighter:** active-frame length against the documents (the documents give first active only), hitbox angle and knockback against the documents (the documents mostly leave them open; TUNE scales knockback by 0.8–1.31), animation alignment in motion, and human play.

| Fighter / forms | Class | Moves covered | Discrepancies found | Unique tools: status | Role implication |
|---|---|---|---|---|---|
| **Flint** | D | 13 normals reach-measured; 4 specials; throws | ftilt **−20 frames on hit at 20%**, though STATUS:94 says the ftilt lag problem was fixed (its frame advantage was −22 before the fix). TUNE: knockback ×0.84, lag ×1.2 on smashes and dash attack. | Banked Coal ember, Bellows through the ember: rules.js checks pass | All-rounder: ftilt is a spacing tool, not a starter, which is consistent with the document's "interrupt a run-in" |
| **Nib** (Wren) | D | 13 normals and specials | **dtilt has a hole at −2** inside its own reach (combat-audit "gaps"); frames match | Spring Vault, held-flurry jab, wall jump: rules checks | Rushdown; strong combo throughput (uair +16/+30) |
| **Loom** (Wren) | D | as above | ftilt −1 at both 20% and 60% (a poke by design); ribbon has no dead spot (recorded) | Crossbreeze (no-damage gust), Thermal hold: rules checks | Zoner |
| **Hod** (Wren) | D | as above | **nair and uair "no hit"** in the combo test and **dair never hits a standing target** (combat-audit). It may be the test's spacing, so UNVERIFIED. | Ram Plate armour (1 strike of 8% or less, frames 13–19), Boulder Roll: rules checks | Heavy; shortest recovery by design (STATUS) |
| Wren swap | D | swap frames 16/33, 60-frame lock | Swap hangs in the air: an owner-recorded deviation from the document | One shared projectile across the three forms: rules check | — |
| **Potato Sack** | D (owner) | normals, 4 specials | nair **−5 on hit at 20% and 60%** (pre-change version); **being reworked by another session** to drag only once per airtime because of a drag-chain loop risk (uncommitted diff, not audited) | No ledge; Tumble burst; Hot Potato sweetspot (rules: KO percents); uncapped Spud Bomb (rules) | Uncapped charge is an owner request; unbounded damage is a design risk |
| **Sprocket** | D | as above | uair "no hit" in the combo test (UNVERIFIED); ftilt −14 at 60% | Tape Roll, Bench Vise command grab through shield: rules checks | Spacer |
| **Scuttle** | D | as above | Document frames not cross-checked (source not found); STATUS says the in-game hitbox audit was **not** run | Tongs Snatch through shield; Bucket Drop spike | Skirmisher |
| **Furious Fowls** (10 forms) | D | inventory only (26 slots per form) | **No combat-audit coverage** (not in its fighter list). STATUS: hitbox audit not run; balance 57–64% (inside the owner's 55–65%) pushes the other fighters down to 36–48% | Selector wheel, living-bird launch, spin rig hitboxes, counter, nest, Pip doubles: 18 rules checks | Highest-risk fighter for state-machine bugs (shape swaps, the slingshot object) |
| Brand, Tilt | planned | — | concept art only | — | not playable, not judged |

The task asked for "three distinctive interactions per fighter". These are covered only by the existing rules.js checks named above, which are MEASURED but written by the project. No new per-fighter interaction trials were run (budget).

---

## G. Top 20 findings

Steps cite file:line. Remedies are recommendations only, and none has been implemented.

| # | Sev | Type | System / fighter | Finding & evidence | Expected (source) | Root-cause hypothesis | Remedy (not done) |
|---|---|---|---|---|---|---|---|
| 1 | P1 | AMBIGUOUS INTENT | Combos (all) | "≈20% stronger combos" is not implemented or documented; hitstun = floor(0.4·KB) (`sim.js:1142`); STATUS:90 | Owner's brief | The intent never reached the repo | Owner decides: confirm the target, then define it as a measurable continuation-window gain (e.g. +20% of frames in hitstun at 20–80%) before touching numbers |
| 2 | P1 | AMBIGUOUS / BUG | Ledge (all) | Intangibility about half of Ultimate's, zero on regrab (`sim.js:1394`, `:1325`); harness ledge table | [wiki Edge] | Hand-made formula (WORKQUEUE item 4) | Decide B or A; if A, adopt the wiki formula and the regrab ×0.8/×0.5 |
| 3 | P2 | BUG (tests) | Test tooling | `tests/movement.js` crashes (artifacts/movement.log) and combat-audit's movement table gives sentinels (200/80). Both park the dummy at y=150 > `BLAST.t`=140 (`tests/movement.js:23`), so the dummy is KO'd every frame | — | Ceiling lowered 2026-11-10 without updating the tests | Park the dummy below 140; add both tests to CI |
| 4 | P2 | MISSING | Knockback | No balloon knockback (`sim.js:1140-1145`) | [wiki Knockback] | Not implemented | Implement only if the A-class intent is confirmed (it interacts with #1) |
| 5 | P2 | BUG vs A | Launch angle | Airborne Sakurai angle 45 vs 38 (`sim.js:1502`) | [wiki Sakurai angle] | Melee/Brawl-era value | One-line change after owner approval; rerun kotable and stats |
| 6 | P2 | AMBIGUOUS | Tech | 20-frame window (`sim.js:1159`) vs 11 | [wiki Tech] | Possibly leniency for keyboard players; unrecorded | Owner decides |
| 7 | P2 | BUG (coverage) | Furious Fowls | Absent from combat-audit and from the hitbox audit | STATUS "Not checked" | Tool fighter list predates the Fowls | Extend the audit tool's roster |
| 8 | P2 | BUG | Nib dtilt | Misses at −2 inside its own reach (combat-audit gaps) | Doc: dtilt as a poke | Strike-shape inner circle | Inspect `HITBOXES.Nib.dtilt` |
| 9 | P2 | UNVERIFIED | Hod nair, uair, dair; Sprocket uair | "no hit" or "never hits a standing target" (combat-audit) | Doc roles | Hitbox height vs the test's target placement | Re-run with an airborne target before judging |
| 10 | P2 | AMBIGUOUS | Potato Sack nair | −5 on hit (pre-change); a concurrent drag-limit edit addresses the chain risk | Owner commit `08a2e81` | Drag carry plus finisher spacing | Audit after the concurrent change lands; run combo-search for loops |
| 11 | P2 | DOC MISMATCH | Flint ftilt | −20 on hit at 20% while STATUS:94 implies it was fixed | STATUS | TUNE lag was removed, but the base endlag remains | Correct the STATUS wording, or set an intended advantage |
| 12 | P2 | MISSING | Hurtboxes | One box per fighter; hitbox shapes fixed through the active frames (STATUS:100) | Brief §3 (hurtbox interpolation) | Engine simplification | Long-term: per-bone hurtboxes |
| 13 | P3 | BUG vs A | Hitstun | No −1 frame, no 4-frame minimum (`sim.js:1142`) | [wiki Hitstun] | | Fold into decision #1 |
| 14 | P3 | BUG vs A | Staling | Slots 8–9 and the ×0.85 on shield hits (`sim.js:52`, `:1476`) | [wiki Stale] | Smash 4 table | Swap the values after approval |
| 15 | P3 | BUG vs A | Shield break | 30 HP reset vs 37.5; flat 220-frame stun (`sim.js:1139`, `:1295`) | [wiki Shield] | | Approval needed |
| 16 | P3 | BUG vs A | Shield pushback | Different formula, no cap (`sim.js:1489`) | [wiki Shield] | | Approval needed |
| 17 | P3 | AMBIGUOUS | Ledge hang | 4 s vs 6.5 s (`sim.js:1332`) | [wiki Edge] | | Owner decides |
| 18 | P3 | AMBIGUOUS | Charging-smash victim ×1.2 | `CHARGING_MUL` (`sim.js:54`) | The wiki lists it as pre-Ultimate | | Verify against a primary source |
| 19 | P3 | E | Throws | Every throw releases on frame 10; 26 frames total (`sim.js:1314`, `:1320`) | Documents silent | Simplification | Per-throw timing if wanted |
| 20 | P3 | DOC | Run turnaround | Comment says 40%, code uses 25% (`sim.js:1192` vs `:1194`) | STATUS:95 says a quarter | Stale comment | Fix the comment |

---

## H. Root-cause map

| Root component | Findings | Kind |
|---|---|---|
| `applyHitRaw` / `launch` (`sim.js:1458-1522`, `1140`) | 1, 4, 5, 13, 18 | physics data and formula |
| `Fighter.update` ledge / tech / shield cases (`sim.js:1159`, `1246-1335`, `1388-1396`) | 2, 6, 15, 16, 17 | state-machine data |
| `STALE` / `SHIELD` constants (`sim.js:52-56`) | 14, 15 | data |
| Hitbox strike shapes (`hitboxes.js`, `hitCircles` `sim.js:1407`) | 8, 9, 12 | asset/data and geometry |
| `KIT` / `TUNE` (`sim.js:257-316`) and fighter blocks | 10, 11, 19 | per-fighter data |
| Test tools (`tests/movement.js`, `combat-audit.js`) | 3, 7 | test failure |
| Docs (STATUS, comments) | 11, 20 | documentation |
| Networking | none found | — |
| Animation | not audited in motion | — |

The shared-engine defects (rows 1–3) affect all 17 forms. Fix those, and settle what's intended, before any per-fighter patch.

---

## I. Fix plan (impact × effort × risk; no time estimates)

1. **Decide intent (no code):** combo strength (#1), ledge, tech and hang rules (#2, #6, #17), and A vs B for the shield and staling details. Dependency: everything below. Risk: none.
2. **Quick win, tests:** repair the dummy placement in `movement.js` and `combat-audit.js`; add the Fowls to combat-audit; put both into `npm test` (#3, #7). Low effort, no gameplay risk. Regression: movement table snapshot.
3. **Shared physics batch, once approved:** aerial Sakurai 38, hitstun −1 and the minimum, stale slots and shield staling, shield break and pushback (#5, #13–16). Small effort; moderate balance risk. Regression: rules.js asserts for each constant; rerun `kotable.js` and `stats.js` over two seeds.
4. **Ledge model, once approved (#2):** formula plus regrab decay. Moderate risk, because it changes recovery and edgeguard balance (Hod is the most exposed). Regression: `recovery.js`, `deaths.js`, a new ledge-intangibility check.
5. **Combo-strength implementation, only after #1 defines the metric:** measure with combat-audit "attacker ahead by" at 20/60/100% across weights before and after; separately search for loops (`tools/combo-search*.js`).
6. **Per-fighter fixes:** Nib dtilt hole, the Hod/Sprocket aerial checks with airborne targets, a Potato Sack nair re-audit after the concurrent change, and Flint ftilt intent.
7. **Long-term:** per-bone hurtboxes and per-frame hitbox tracking (#12); per-throw timing (#19).

---

## J. Open questions and blind spots

- **Combo-strength target:** is the 20% real, and what does it measure (hitstun frames, damage per opening, continuation window)?
- **Ledge, tech and hang values:** deliberate leniency or strictness, or not considered?
- **Primary references not obtained:** Ultimate's input buffer length (the wiki page 404'd); tumble threshold; hitlag formula; 1v1 multiplier; the short-hop and crouch multipliers; per-type shieldstun multipliers; spot-dodge frames. These need https://ultimateframedata.com/stats or a datamine. The owner's own `common.prc` is not readable (memory note).
- **Not executed:** the rendered game, `tools/audit.js` in the browser, 30/120 FPS runs, real controllers, human feel, stats/levels/kotable/deaths, VIDEO checks, frame-by-frame trials for trade-during-landing, hit-during-startup, late-active shield contact, hitlag with rapid inputs, and interrupted specials (the fuzz test covers them only statistically).
- **Scuttle's and the Fowls' documents** were not cross-checked frame by frame (Scuttle's source was not found; the Fowls numbers are generated by `tools/fowls-gen.js` from the owner's JSON, a pipeline this audit did not verify).
- **Concurrent edits:** Potato Sack nair (uncommitted, another session) is outside this audit.

## K. Test artifact index

All files are in `docs/audits/ultimate_fidelity_audit_artifacts/` (audit-only, uncommitted).

| Artifact | Command (from repo root) | Result |
|---|---|---|
| headless.log | `node tests/headless.js` | pass |
| rules.log | `node tests/rules.js` | 179/179 pass |
| net.log | `node tests/net.js` | 12/12 identical to offline |
| fuzz.log | `node tests/fuzz.js 20` | clean; `rebound` and `broken` never reached |
| recovery.log | `node tests/recovery.js` | all spots land or ledge |
| combat-audit.log | `node tests/combat-audit.js` | reach, combos and edge valid; movement section invalid (G-3) |
| movement.log | `node tests/movement.js` | **crash**: TypeError at `jump()` (G-3) |
| audit-harness.js → harness.json | `node docs/audits/ultimate_fidelity_audit_artifacts/audit-harness.js .` | jumpsquat, dash, dodges, OOS, shield drop, launch table, ledge table, stale and constants |
| kitcheck.js | `node …/kitcheck.js . "C:\Users\rober\Downloads\Emberfall\Emberfall_Fighter_Movesets.md"` | 60/60 normals match |
| inv.js | `node …/inv.js .` | move inventory per form (17 forms) |

Known harness limitation: its "utilt repeat" combo probe landed only one hit, so the script is not a valid combo trial. The result is discarded and not used above. Also, the first harness run parked the dummy at y=150 like the project's tests and produced invalid values; it was corrected to keep the dummy on the stage, and only the corrected run is reported.
