# Emberfall work queue

Standing instructions from the owner (2026-11-09, about 9 pm): keep working without waiting for them, restart at 9:40 pm, stop at midnight. If something truly needs the owner, write it under "Needs the owner" and move to the next item.

## Rules while working unattended

- Work in `C:\Users\rober\smash` on the `3d` branch. Run `npm test` and commit after each finished item.
- Roster is final: Flint, and Wren's companions Nib, Loom and Hod. Everything stays original; the owner's installed game is a quality reference, not something to copy.
- Meshy: all calls go through `tools/meshy.js`. Never raise a limit in `assets/meshy-budget.json` and never spend past one. Tonight's daily allowance is used up, so do only work that costs no credits.
- Do not install software, change system settings, or touch anything outside the project folder (the scratchpad is fine).
- Check the clock (`date`) at the start of each item. Do not start a new item after 11:40 pm.
- Keep `assets/STATUS.md` truthful: say what was checked and what was not.

## Queue (take the first unfinished item)

1. [x] **Retune reach and damage** after the hitboxes moved onto the limbs. Use headless matches for numbers (average hit damage, KO percent per fighter, match length). Each archetype should play at its intended range: Nib close, Flint mid, Hod mid with power, Loom longest.
2. [x] **Check the rules not yet verified**: wall tech, hitlag nudges, attacks putting out projectiles, Hod's armour. Fix what fails.
3. [x] **Audit every hitbox against its animation** in the game: for each attack, distance from the hitbox to the nearest striking limb at the active frames; fix any that are more than about 3 units off.
4. [x] **More universal mechanics**: ledge protection that shrinks with air time and damage, slower ledge get-ups above 100%, held-attack rapid jabs where it suits the fighter, angled forward tilts, a tap-jump option.
5. [ ] **Replace stand-in clips** for the companions (roll, spot dodge, air dodge, grab hold, being held, ledge hang) with clips keyed in `tools/blender/companions.js`. No credits needed.
6. [ ] **Hit effects and stage** in the 3D renderer: hit sparks and launch trails drawn in 3D, a bigger KO burst, more background depth.
7. [ ] **Flint's coat**: add coat and scarf bones in Blender so they follow through and the boot stops clipping.
8. [x] **Select screen**: update the help lines for the new rules (jab chains, footstool, wall jump, dash grab).

## Needs the owner

- Frame rate on the RTX 2060: open the game in a normal browser, press B, read the frame-time line.
- Controller: confirm buttons, try wavedash, platform drop, shield drop. Press − on the select screen if A and B are swapped.
- Wavedash distance from the reference build's log (ten wavedashes with logging on).
- Meshy daily limit: stays at 150 unless the owner raises it.

## Stopping (midnight, or when told to stop)

1. Bring the current step to a safe state. If something is half-done and breaks the game, revert it with git.
2. Run `npm test`. Commit.
3. Tick finished items above and add a dated line to `assets/STATUS.md`.
4. Remove the scheduled jobs (CronList, then CronDelete each).
5. Give the owner a short summary: what was finished, what was not checked, what needs them.

## Log

- 2026-11-09 21:10: queue written; restart set for 21:40 with retries every ten minutes, stop at midnight.
- 2026-11-09 21:15: item 1 partly done: reach set by archetype (Nib shortest, Loom longest), Hod recovery buffed, CPU now attacks from each fighter's range and recovers from all 24 test positions (tests/recovery.js). Balance numbers in tests/stats.js. Still to do in item 1: damage and KO tuning (Hod still dies off the bottom more than it should; Loom survives longest at about 158%). Stopped here because the usage limit was reached; restart is scheduled for 21:40.
- 2026-11-09 22:24: item 1 done. Kill power set from a new KO table (tests/kotable.js): forward smash KOs a mid-weight at about 100% mid-stage (was 80%), Hod's back throw at about 150% (was 93%). CPU no longer chases past the ledge or attacks over the void, aims aerials at where the hit will land, and attacks at each fighter's own pace. Over 160 CPU matches: wins Flint 56%, Loom 55%, Hod 48%, Nib 41%; average KO percent Hod 166, Flint 164, Nib 156, Loom 144. Hod still loses about a quarter of its stocks to falling short on recovery, which is its intended weakness. Not checked: how any of this feels with a human playing.
- 2026-11-09 22:26: item 2 done. tests/rules.js feeds exact inputs and checks 15 outcomes: Hod's armour (absorbs a weak hit, breaks to a strong one, no cover before its window), attacks putting out projectiles (a tilt stops Nib's bolt, a jab cannot stop Hod's boulder), hitlag nudges (three flicks, 3.3 units), wall tech (stop, spring off with jump, no tech on a spent press), Nib's wall jump, equal smashes cancelling. All pass with no rule changes needed; it now runs as part of npm test. Not checked: any of these by hand on a controller.
- 2026-11-09 22:32: item 3 done. tools/audit.js runs inside the real game: it poses each model through the 3D renderer and measures every hitbox against the nearest limb tip at its first, middle and last active frame (89 hitboxes). Found and fixed: Flint's down smash and get-up attack were mapped onto the high kick in the clip, with nothing behind him for the back hit; they now use the low sweep, and the renderer has a spin option that carries the leg from front to back in time with the two hits (off 0.7 to 2.3 units now, was 5 to 8.4). Also moved Nib's up smash onto its head, Hod's back air onto the tail, Hod's rear get-up hit inward, and shortened pivot grabs by 1. Left as is: pivot grabs sit 3.2 units past the hand (they are meant to reach further), and Hod's down tilt tail dips about 3 units below the floor in the animation (hitbox is right horizontally; fix belongs with the clip work in item 5). Not checked: follow-through was switched off for the measurement, so ribbons and tails in motion can trail behind these positions.
- 2026-11-09 22:39: items 4 and 8 done. Added: ledge protection set by time in the air and damage (8 to 54 frames); climbing, rolling and attacking from the ledge are 8 frames slower above 100%; holding attack runs the jab chain; Nib's second jab is a flurry that lasts while attack is held (3 to 14 hits) and ends in the finisher; a forward tilt can be angled up or down by a slight tilt of the stick (hitbox moves 3.2 units, the model leans); tap jump per controller, off by default, switched with the jump button on the select screen and shown next to the device name. Select-screen help rewritten to cover these plus dash grab, footstool, wall jump and wall tech. tests/rules.js now has 24 checks, all passing; CPU balance unchanged (Flint 54%, Loom 53%, Nib 49%, Hod 45%). Looked at in the browser: select screen text fits, angled tilt and flurry draw without errors. Not checked: any of it on a real controller; the angled tilt's lean is only a rough match for the moved hitbox.
