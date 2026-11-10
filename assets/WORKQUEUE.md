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

1. [ ] **Retune reach and damage** after the hitboxes moved onto the limbs. Use headless matches for numbers (average hit damage, KO percent per fighter, match length). Each archetype should play at its intended range: Nib close, Flint mid, Hod mid with power, Loom longest.
2. [ ] **Check the rules not yet verified**: wall tech, hitlag nudges, attacks putting out projectiles, Hod's armour. Fix what fails.
3. [ ] **Audit every hitbox against its animation** in the game: for each attack, distance from the hitbox to the nearest striking limb at the active frames; fix any that are more than about 3 units off.
4. [ ] **More universal mechanics**: ledge protection that shrinks with air time and damage, slower ledge get-ups above 100%, held-attack rapid jabs where it suits the fighter, angled forward tilts, a tap-jump option.
5. [ ] **Replace stand-in clips** for the companions (roll, spot dodge, air dodge, grab hold, being held, ledge hang) with clips keyed in `tools/blender/companions.js`. No credits needed.
6. [ ] **Hit effects and stage** in the 3D renderer: hit sparks and launch trails drawn in 3D, a bigger KO burst, more background depth.
7. [ ] **Flint's coat**: add coat and scarf bones in Blender so they follow through and the boot stops clipping.
8. [ ] **Select screen**: update the help lines for the new rules (jab chains, footstool, wall jump, dash grab).

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
