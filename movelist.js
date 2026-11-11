'use strict';
/* Move lists, as in Ultimate: paged screens of every fighter's moves.
   Opened with + (Start, or the + key on the keyboard) while pointing at a fighter on the fighter select, and from the pause
   menu's Move List for the paused player's fighter. Left / right (or L / R, Q / W on the keyboard) turns pages, up / down
   jumps between a fighter's forms, and B (X on the keyboard), Start or Esc closes it.
   Names and descriptions are written here; the frame and damage line on every move is read from the move itself, so it
   always matches the game. Damage is shown before the one-on-one bonus (x1.2), the way the movesets list it. */

/* ---------- The words, per form ---------- */
const MOVE_TEXT = {
  Flint: {
    nspec: ['Banked Coal', 'Lobs a small arcing coal on frame 14 that hurts on contact. If it reaches the floor first it leaves one glowing ember there for 45 frames, which burns whoever steps on it. Throwing a new coal clears the old ember, so place it where your opponent wants to land.', 'Release f14 · 5% coal · 4% ember'],
    sspec: ['Lamp Rush', 'A short lantern lunge of about one body length. The clean swing (frames 14 and 15) sends diagonally; later it is weaker. About 21 frames to recover after the swing. Punishes a missed attack or catches someone backing away. Once per jump in the air, and it holds Flint level while it lunges.'],
    uspec: ['Updraft', 'The lantern points down and lifts Flint about two body lengths, with a rising hit covering the start from frame 8. Steer a little left or right with the stick. Flint falls helpless afterwards, so use the air jump first and keep this for the last stretch to the ledge.'],
    dspec: ['Bellows Burst', 'Plants and blasts a short cone of flame on frames 24 to 26. Slow but strong: a hard punish up close. If the cone reaches Flint\'s ember, it uses the ember up and sends a low flame on a little further for another hit. In the air it holds Flint in place, once per jump.', 'Blast f24 · 15% · flame from the ember 8%'],
    jab: ['Spark, Tap, Hook', 'A free-hand jab, the lantern handle, then a hook that pushes the opponent out. Stop after the first two on a shield to mix up a grab.'],
    dash: ['Lamplighter\'s Shoulder', 'A sliding shoulder that catches landings. The clean hit sends diagonally up; the late hit is a softer pop.'],
    ftilt: ['Handle Check', 'A short straight thrust that sends straight out. Use it to stop a run-in or push someone off the edge, not to start combos.'],
    utilt: ['Chimney Elbow', 'An overhead elbow that pops a close opponent straight up, ready for an up air.'],
    dtilt: ['Cinder Toe', 'A low boot flick that sends up and inward at low damage. Starts a short combo or catches a ledge getup.'],
    fsmash: ['Beacon Swing', 'Flint plants and swings the lantern like a weight. The lantern itself hits hardest; the arm is weaker. Charge it by holding attack.'],
    usmash: ['Chimney Flash', 'A narrow column of light straight above Flint, with a small scoop in front. Punishes a landing from above.'],
    dsmash: ['Hot Foot', 'Two low sweeps, in front and then behind. Catches a roll or a spot dodge. The rear hit is weaker and sends lower.'],
    nair: ['Lantern Tuck', 'A quick curled kick with a short lingering hit. Gets someone off you when crowded, or when falling through a platform.'],
    fair: ['Lantern Arc', 'A diagonal lantern swing that reaches a little below Flint. Sends a jumping opponent out toward the ledge.'],
    bair: ['Backdraft Heel', 'A fast heel behind him with strong outward launch on the clean hit. Flint\'s main aerial finisher.'],
    uair: ['Lift the Light', 'A short rising lantern lift from front to overhead, for juggles.'],
    dair: ['Ash Stamp', 'A lantern-base stamp. The clean hit sends straight down (a spike off the stage); later contact is weaker.'],
    grab: ['Collar Grip', 'A quick free-hand grab. Out of a dash it reaches further, and out of a run turnaround further still, with more recovery if it misses.'],
    f: ['Clear the Walk', 'A low shove outward that puts the opponent at the ledge or forces a tech.'],
    b: ['Lantern Turn', 'Pivots and tosses behind him. Swaps sides to get out of a corner.'],
    u: ['Chimney Lift', 'Lifts straight up with enough height to start a juggle.'],
    d: ['Knee to the Floor', 'A close bounce that pops up and slightly forward. Follow with up air or forward air depending on how they drift.'],
  },
  Nib: {
    nspec: ['Quick Bolt', 'The key ticks and fires a fast, small bolt on frame 9 that flies about two body lengths. Little flinch and almost no launch: it is for making the opponent decide whether to approach. One bolt out at a time, shared across all three companions.', 'Fires f9 · 4%'],
    sspec: ['False Start', 'A feint. Let go of special before frame 10 to commit to a low pounce of about 1.3 body lengths that hits on frames 14 to 16. Keep holding special through frame 10 on the ground to stop short instead: no hit, and free to act on frame 23. In the air only the pounce, once per jump. Both can be hit during the wind-up.'],
    uspec: ['Spring Vault', 'Compresses and vaults on frame 8, straight up, or diagonally with the stick held sideways. A single rising paw hit covers the first frames, then the arc is open. Nib falls helpless afterwards.'],
    dspec: ['Wren\'s Call', 'Wren calls the next companion: Nib hands over to Loom. The swap happens on frame 16 and Loom can act on frame 33. A hit before frame 16 keeps Nib in. 60 frames before the next call.', 'Swap f16 · act f33'],
    jab: ['Paw, Paw, Snap', 'A fast short-range series. The last bite sends straight out, far enough to reset the spacing.'],
    dash: ['Underfoot', 'A low sliding shoulder with a small upward pop. Punishes a landing or a missed poke.'],
    ftilt: ['Fox Swipe', 'A fast, short step-in swipe that sends outward to start the chase.'],
    utilt: ['Tail Flick', 'The tail curls from behind to overhead and lifts an opponent close to Nib.'],
    dtilt: ['Ankle Nip', 'A quick low bite that sends a grounded opponent up and inward. Nib\'s main combo starter.'],
    fsmash: ['Coil Bite', 'A wind-up pause and a snapping lunge. The jaws launch hardest; the body is weaker.'],
    usmash: ['Trapdoor Kick', 'Flips onto the forepaws and kicks straight up. The hind paws are the strong part. Catches a jump over Nib.'],
    dsmash: ['Split-Tail Sweep', 'Both tail tips sweep low, in front and then behind. Good on a roll read, with short reach.'],
    nair: ['Tuck and Twist', 'A quick compact twist to stop close pressure. The soft late hit can keep a low-damage scramble going.'],
    fair: ['Pounce Swipe', 'A fast forward paw with a shallow outward launch. Chases a drift or carries the opponent toward the edge.'],
    bair: ['Twin Tail Snap', 'A sharp backward snap. The tail tips launch hard outward; the root is weaker. Nib\'s best aerial finisher.'],
    uair: ['Spring Paw', 'A short upward kick to keep a juggle going. Low damage keeps early follow-ups close.'],
    dair: ['Heel Rake', 'The hind paws rake down. Pressures a recovery from above, with a committed landing.'],
    grab: ['Scruff Catch', 'A close catch with the front paws. Quick, short reach; reaches further out of a dash or a run turnaround.'],
    f: ['Trip and Send', 'Trips the opponent toward the ledge at a shallow angle.'],
    b: ['Tail Turn', 'Twists and flings the opponent behind. Switches sides quickly.'],
    u: ['Shoulder Pop', 'Pops straight up for a short juggle.'],
    d: ['Springboard', 'Pushes off the opponent and bounces them up and slightly forward. Follow with up air or a forward chase.'],
  },
  Loom: {
    nspec: ['Crossbreeze', 'A brief forward gust on frames 12 to 15. The inner pulse close to Loom hurts a little; the outer pulse pushes once with no damage and no hitstun (less on a grounded opponent, and a shield blocks it). Offstage, it bends an opponent\'s recovery off course.', 'Gust f12 · 3% inner · outer pushes only'],
    sspec: ['Ribbon Sling', 'Snaps one ribbon straight out from frame 16, then recoils Loom back about a third of a body length. The weight at the tip hits hardest; the inner ribbon is weaker, and point-blank there is a gap. One recoil per jump in the air.'],
    uspec: ['Thermal', 'The kite catches the air from frame 9 for a sure short lift. Keep holding special to keep rising through frame 26, up to about 2.4 body lengths. Steer a little to either side. No hitbox, so Loom is open the whole climb, and falls helpless after.', 'Lift f9 · hold to rise · no hit'],
    dspec: ['Wren\'s Call', 'Wren calls the next companion: Loom hands over to Hod. The swap happens on frame 16 and Hod can act on frame 33. A hit before frame 16 keeps Loom in. 60 frames before the next call.', 'Swap f16 · act f33'],
    jab: ['Ribbon Tap', 'Two quick, close ribbon flicks to interrupt pressure. The second sends straight out.'],
    dash: ['Kite Skim', 'A low gliding body check. The early hit pops up; the late hit is softer.'],
    ftilt: ['Pennant Point', 'A straight ribbon poke at mid-height. The weight at the tip rewards exact spacing; up close it is weaker.'],
    utilt: ['Catch the Lift', 'One ribbon loops from shoulder level to overhead. Covers a jump from just beside Loom.'],
    dtilt: ['Floor Thread', 'A long low sweep with a shallow launch. Catches a retreat or a ledge getup; strongest at the weight.'],
    fsmash: ['Sail Snap', 'Pulls both ribbons taut and cracks them forward. The far tips send hard outward.'],
    usmash: ['Windlass', 'Both weights circle and rise above Loom. Punishes a committed landing.'],
    dsmash: ['Crosswinds', 'The weights strike low on both sides in turn, front first. A strong angle for a ledge trap.'],
    nair: ['Spindle Spin', 'A compact ribbon circle. The late hit nudges the opponent up close for a follow-up on landing.'],
    fair: ['Ribbon Needle', 'A long forward ribbon snap. Check a jump with the weighted tip; the ribbon near Loom is weaker.'],
    bair: ['Trailing Pennant', 'The weight arcs backward and outward. Loom\'s best air-to-air finisher at the tip.'],
    uair: ['Tether Lift', 'One ribbon curves overhead. Loom can drift sideways while it lifts the opponent.'],
    dair: ['Drop Stitch', 'Drops a weight well below Loom, straight down at the tip. Useful over recoveries and platforms.'],
    grab: ['Ribbon Bind', 'A ribbon wrap in front: long reach but slow, with a long miss to punish. Further out of a dash or a turnaround.'],
    f: ['Let the Line Out', 'Unwinds into a shallow forward launch, giving Loom its spacing back.'],
    b: ['Turn the Tether', 'Pulls the opponent around and behind. Good when Loom is cornered.'],
    u: ['Catch a Thermal', 'Tosses straight up into the airspace Loom wants to hold.'],
    d: ['Tie Down', 'Draws the ribbon down and bounces the opponent up and slightly forward for an aerial.'],
  },
  Hod: {
    nspec: ['Boulder Roll', 'Tap special to release a small, faster stone on frame 21. Hold through frame 16 to commit to a larger, slower, stronger stone on frame 35. Either rolls about three body lengths, falls away at a ledge, or breaks on a fighter or a shield. One stone at a time: walk in behind it.', 'Tap f21 · 7%  ·  Held f35 · 11%'],
    sspec: ['Ram Plate', 'A low committed charge that hits on frames 15 to 21. On the ground, frames 13 to 19 shrug off one hit of 8% or less (Hod still takes the damage; throws and stronger hits stop it). About 25 frames to recover. In the air it carries Hod level a short way with no armour: his way back sideways.'],
    uspec: ['Stone Step', 'Folds the plates and vaults on frame 12, about 1.65 body lengths, with one weak rising hit over the opening. Slight steering, then Hod falls helpless. His recovery is the shortest, so save the air jump and come back early.'],
    dspec: ['Wren\'s Call', 'Wren calls the next companion: Hod hands over to Nib. The swap happens on frame 16 and Nib can act on frame 33. A hit before frame 16 keeps Hod in. 60 frames before the next call.', 'Swap f16 · act f33'],
    jab: ['Dig, Dig, Shove', 'Two close claw swipes and a shoulder shove that sends straight out. Hod\'s quickest answer on the ground.'],
    dash: ['Quarry Shoulder', 'A low forward check with no armour. Launches up enough to take space.'],
    ftilt: ['Long Claw', 'A single long claw thrust. The tips hit hardest. Good where the opponent lands after clearing the boulder.'],
    utilt: ['Ridge Rake', 'A low-to-high scoop that catches jump-ins right above Hod.'],
    dtilt: ['Furrow', 'Scrapes the ground and sends low forward, forcing a tech at useful damage.'],
    fsmash: ['Quarry Breaker', 'Two claws drive forward after a long shoulder wind-up. Tips strongest. A heavy punish on a landing read.'],
    usmash: ['Stone Crown', 'Rears and drives the plated crown straight up. Broad above, narrow at ground level.'],
    dsmash: ['Split the Floor', 'Two claw strikes, in front and then behind. The front hit sends lower and outward.'],
    nair: ['Tuck Shell', 'A short curled roll around Hod\'s body, with a weaker lingering hit. Useful out of a jump.'],
    fair: ['Pickaxe Claws', 'A double claw swing down in front. The tips drive the opponent forward.'],
    bair: ['Ridge Kick', 'A heavy strike behind with the plated tail. A strong finisher near the edge.'],
    uair: ['Crown Scrape', 'Rolls the plated back upward. Big near the body, short against a higher target.'],
    dair: ['Sinkhole Stomp', 'The feet send an airborne opponent straight down; the body is weaker. A long landing lag makes it a real commitment.'],
    grab: ['Dig In', 'A close double-claw scoop. Slow to start and long to miss.'],
    f: ['Roll Out', 'Heaves the opponent low and forward for a tech chase or the ledge.'],
    b: ['Quarry Toss', 'Flings the opponent behind on a high arc. Hod\'s strongest throw near a ledge.'],
    u: ['Stone Lift', 'Sends high above Hod. Threaten Crown Scrape if they fall back into reach.'],
    d: ['Set in Stone', 'Slams in front for a low bounce. Cover their tech with a claw.'],
  },
  'Potato Sack': {
    nspec: ['Spud Bomb', 'Hold special to swell up, and let go to burst all round his body 4 frames later. There is no cap: every 10 frames held makes the burst about 1.2 units wider and 1.5% stronger. Tapped, it is a 7-unit ring that KOs a middleweight from about 140%. 20 frames to recover after the burst.', 'Burst 4f after release · 8% tapped, +1.5% per 10f held'],
    sspec: ['Bag It', 'Leaps forward on frame 8 and tries to bag the opponent from frame 10 to 22. It goes through a shield, and whoever it catches is flung up and forward. Once per jump in the air, with landing lag if it misses.', 'Grab f10 · fling 10%'],
    uspec: ['Hot Potato', 'Cooks a potato that bursts on frame 5. The hot middle KOs most fighters from about 70%; the edge is weaker, about 100 to 125%. The blast also throws the sack upward: it takes 12% itself and flies further the more hurt it is. Tilt the stick to angle the flight. Once per jump.', 'Burst f5 · 15% middle · 10% edge · 12% to himself'],
    dspec: ['Tumble', 'How the sack really gets about. On frame 6: stick sideways on the floor slides, up lifts, sideways in the air dives down diagonally (and carries on as a slide when it lands), no direction hangs briefly. From frame 7 it can be cut into any action keeping its speed, and a new push of the stick ends it. Hold down to slide through a soft platform. Once per jump.', 'Burst f6 · cancel from f7 · no hit'],
    jab: ['Sack Slap', 'One heavy slap that sends straight out. There is no jab chain: one hit, then reset.'],
    dash: ['Sack Slide', 'Slides in on his side and pops the opponent up at an angle.'],
    ftilt: ['Spud Shove', 'A straight shove that sends straight out. Good for keeping someone at bay between hops.'],
    utilt: ['Tuft Swat', 'The top tuft swats straight up over him. Catches an opponent landing close.'],
    dtilt: ['Root Trip', 'A low swipe along the floor that pops the opponent up and in.'],
    fsmash: ['Full Sack Slam', 'Rears back and slams the whole sack forward. A strong straight launch.'],
    usmash: ['Spud Geyser', 'Heaves upward with a strong vertical launch. Punishes a landing above him.'],
    dsmash: ['Spill Sweep', 'Sweeps in front, then behind. The rear hit comes later and sends back and up.'],
    nair: ['Sack Shake', 'Three light hits that catch the opponent and carry them along, then a finisher that sends them away. Only 15 frames long, so two fit in one short hop. Only the first one each time in the air carries; later ones still hit but let go.'],
    fair: ['Lumpy Swing', 'A forward swing that sends diagonally out.'],
    bair: ['Back Bump', 'A heavy bump behind him with a strong backward launch. His best aerial finisher.'],
    uair: ['Tuft Flick', 'Flicks the tuft upward to keep an opponent above him.'],
    dair: ['Sack Drop', 'Drops the bottom of the sack. Sends an airborne opponent straight down: a spike off the stage.'],
    grab: ['Sack Snatch', 'Catches the opponent against the sack. Further reach out of a dash or a run turnaround, with more recovery.'],
    f: ['Toss Forward', 'Heaves the opponent forward and diagonally up.'],
    b: ['Over the Shoulder', 'Throws the opponent behind him. The strongest of his throws.'],
    u: ['Spud Launch', 'Pops the opponent straight up.'],
    d: ['Squash', 'Flattens the opponent and pops them up just in front, to follow up.'],
  },
  Sprocket: {
    nspec: ['Tape Roll', 'Flicks a low tape roll on frame 16. On flat ground it runs outward for about 22 frames, then curls back toward where it was let go. From the air it drops to the floor first. It breaks on a fighter or a shield, or falls away at the ledge. One roll at a time. Roll it under a jump, then threaten the wrench.', 'Release f16 · 6%'],
    sspec: ['Hook Wrench', 'Plants the lead foot and reaches up and forward with the open wrench on frames 16 to 19. The head tugs the opponent a little inward; the handle is weaker and pushes them out. A shield blocks either. About 22 frames to recover.'],
    uspec: ['Ratchet Spin', 'Choose straight up, or a diagonal with the stick held sideways, during the wind-up, then ride that arc. One hit from frame 10 covers the start. Goes further sideways and less high than Flint\'s Updraft. Sprocket falls helpless after.'],
    dspec: ['Bench Vise', 'Steps in and closes the open wrench on a standing opponent on frames 18 and 19, about one body length out. It goes through a shield and throws them low behind him. A jump or a dodge beats it, and a miss leaves about 30 frames to punish. Ground only: in the air it catches nothing.', 'Grab f18 · throw 12%'],
    jab: ['Knuckle, Knuckle, Elbow', 'A compact three-hit series, ending in a firm shove that sends straight out.'],
    dash: ['Steel-Toe Slide', 'A boot-first slide under a tall poke. Vulnerable to an answer on the ground.'],
    ftilt: ['Box-End Check', 'A straight wrench poke. The head at the end hits harder and spaces better than the handle.'],
    utilt: ['Overhead Crank', 'Pulls the wrench over his shoulder. Covers a jump beside him or just behind.'],
    dtilt: ['Floor Scrape', 'A low hook under the opponent\'s feet, sending low and outward for a chase.'],
    fsmash: ['Two-Handed Hammer', 'A heavy planted hammer swing with a clear backswing. The head is strongest.'],
    usmash: ['Jack Stand', 'A two-handed vertical tool strike with a small scoop in front. Punishes a predictable landing.'],
    dsmash: ['Sweep the Bench', 'A low front swing into a rear boot sweep. The first hit is the strongest.'],
    nair: ['Tool Belt Turn', 'Tucks both knees and turns. Close cover when landing under pressure.'],
    fair: ['Open-End Swing', 'The wrench draws a forward arc. The head is stronger and reaches past his body.'],
    bair: ['Heel of the Boot', 'A heavy rear kick that covers a retreat. A strong finisher at the edge.'],
    uair: ['Crank Flip', 'A short vertical tool lift, quick enough to meet a jump on a read.'],
    dair: ['Drop the Hammer', 'A heavy downward hit. The head sends an airborne opponent straight down.'],
    grab: ['Glove Grip', 'A short, firm grab. Further reach out of a dash or a run turnaround, with longer recovery on a miss.'],
    f: ['Out of the Shop', 'A straight shove for stage position.'],
    b: ['Over the Bench', 'Turns his hip and hurls the opponent behind. Threatens a KO near the edge at high damage.'],
    u: ['Jack It Up', 'Lifts straight up to set up an up air chase.'],
    d: ['Bench Drop', 'A short bounce up in front. Down tilt on a low-damage drift, or chase the tech.'],
  },
  'Chomp Chomp': {
    nspec: ['Hot Coal Relay', 'Tosses a glowing hot coal out on a rope (frame 13). Press B again just as it swings out past its mark (within 3 frames; within 1 for a little extra speed) to hop it onto a new rope further on: up to three relays. Press at any other moment and it lets go and flies on. It hits harder the faster it goes, 5% up to 12%. Where it lands it stays for 6 seconds. With the coal on the floor, B runs a rope from it to Chomp and sends his ant along it (see the rules page).'],
    sspec: ['Rope Swing', 'Hooks a rope above and ahead on frame 11 and swings on it. Push the stick to pump the swing; let go of B to release and fly on with his mouth open, biting for 9% (6% late). Once each time in the air.'],
    uspec: ['Bubble Ride', 'Blows a bubble round himself on frame 8 and floats up for up to 55 frames, steering gently. Up B again pops it early, for 4% round him and a small push the way the stick points. Falls helpless after.'],
    dspec: ['Air Cushion', 'Squeezes a little cushion: a gust on frames 9 to 13 pushes the opponent away (3%) and nudges a swinging or flying coal along. In the air the first one each jump pushes Chomp back.'],
    jab: ['Nibble, Nibble, Chomp', 'Two quick nibbles and a bigger chomp that knocks away.'],
    dash: ['Rolling Hunger', 'Tumbles forward into a bite. The late hit is weaker.'],
    ftilt: ['Tongue Flick', 'Flicks his tongue out for a mid-range poke.'],
    utilt: ['Snap Up', 'Snaps straight up. A good anti-air.'],
    dtilt: ['Toe Nibble', 'A low nibble at the feet. Starts combos.'],
    fsmash: ['Mega Chomp', 'His mouth opens absurdly wide, then slams shut. His main ground finisher.'],
    usmash: ['Sugar Snap', 'An upward bite that lifts with his head.'],
    dsmash: ['Floor Feast', 'Spins low, biting in front and behind.'],
    nair: ['Hungry Spin', 'Spins with his mouth open, hitting all round. The late hit is weaker.'],
    fair: ['Flying Chomp', 'A big forward bite in the air.'],
    bair: ['Heel Flick', 'A quick kick behind with his stubby feet.'],
    uair: ['Sky Bite', 'An upward snap of the jaws, for juggles.'],
    dair: ['Jaw Drop', 'A giant downward bite. Early it sends straight down; later it is weaker.'],
    grab: ['Tongue Snatch', 'Catches with his tongue. Short-medium reach.'],
    f: ['Spit Launch', 'Spits the opponent forward.'],
    b: ['Over-Shoulder Spit', 'Turns and spits them behind. His strongest throw.'],
    u: ['Pop Up', 'Pops them straight up.'],
    d: ['Floor Bounce', 'Bounces them off the floor in front. Starts combos.'],
  },
  Scuttle: {
    nspec: ['Tongs Snatch', 'A slow reach with the tongs on frames 16 to 18. On the ground it catches a standing opponent, shield or not, and flings them up and away. In the air it is a swipe instead. Use it on someone who keeps shielding.', 'Grab f16 · fling 8%  ·  in the air 5%'],
    sspec: ['Scuttle Roll', 'Pulls into the scuttle and rolls on frames 9 to 23: about 1.65 body lengths along the floor, less in the air. Stronger early (frames 11 to 15), weaker after. Once per jump in the air.'],
    uspec: ['Steam Pop', 'A jet of steam from the scuttle on frame 8 lifts it about 2.15 body lengths, with a hit at the start. Steer a little with the stick. Scuttle falls helpless after.'],
    dspec: ['Bucket Drop', 'On the ground, rears up and drops the scuttle on frames 18 to 20. In the air it dives from frame 12 at 1.4 times its fast fall, sending anyone it hits in the air straight down, with a thump where it lands for anyone the dive missed. One dive per jump; 24 frames to get up after landing.', 'Ground f18 · 13%  ·  Dive f12 · 12% spike · landing 10%'],
    jab: ['Pinch, Pinch, Tong Shove', 'Two quick claw pinches and a tong shove that sends straight out.'],
    dash: ['Scuttle Rush', 'A low skittering rush that pops the opponent up at an angle. The late hit is weaker.'],
    ftilt: ['Tong Poke', 'A quick poke with the fire tongs that sends straight out.'],
    utilt: ['Claw Wave', 'Waves the claw straight up over its shell. Catches an opponent landing close.'],
    dtilt: ['Coal Flick', 'Flicks a coal low along the floor, popping the opponent up and in for a follow-up.'],
    fsmash: ['Fire Tongs Clamp', 'Lunges and snaps the tongs shut. The clean hit is strong; the tail end is weaker.'],
    usmash: ['Hot Coal Pop', 'Pops up out of the scuttle with a strong vertical launch. Calls a landing.'],
    dsmash: ['Pincer Sweep', 'Sweeps low in front, then behind. The front hit sends low and outward.'],
    nair: ['Shell Spin', 'Spins in its shell with a long weaker lingering hit. Quick and safe out of a short hop.'],
    fair: ['Tong Snap', 'A fast forward snap of the tongs. Good for chasing and for two quick hits in a row.'],
    bair: ['Back Pincer', 'A strong backward pinch. The tip launches hardest; close to the body it is weaker.'],
    uair: ['Claw Clap', 'A quick upward clap of both claws, for juggles.'],
    dair: ['Scuttle Stomp', 'Stamps down with the scuttle. The edge sends an airborne opponent straight down.'],
    grab: ['Tong Grip', 'A quick, short grab with the tongs. Further out of a dash or a run turnaround.'],
    f: ['Pitch Forward', 'Tosses the opponent forward and up.'],
    b: ['Over the Shell', 'Flings the opponent back over its shell. Its strongest throw.'],
    u: ['Coal Toss', 'Tosses straight up.'],
    d: ['Into the Ash', 'Pins the opponent down and pops them up in front.'],
  },
  Brand: {
    nspec: ['Hot Iron Thrust', 'Tap for a quick thrust on frames 14 to 16. Keep special held through frame 9 and she draws the arm back for a slower thrust on frames 24 to 26 that hits harder and reaches about a third further. Hold it to catch someone who dodged early. In the air it lands for 16 frames (20 for the held one).', 'Tap f14 · 11%  ·  held f24 · 15%'],
    sspec: ['Stove Door Bash', 'Raises the stove door on frames 5 to 8, then steps in and bashes on frames 12 to 14. On the ground the raised door stops one strike of 8% or less that comes in from the front: it costs shield like a block and the bash still comes out. Stronger hits, hits from behind or above, grabs and projectiles get through. 24 frames to recover, hit or miss. In the air there is no guard, the bash does 8% and landing takes 17 frames.', 'Guard f5-8 (one hit, 8% or less)  ·  bash f12 · 10%  ·  air 8%'],
    uspec: ['Watchfire Rise', 'A rising cut on frames 7 to 9, then straight up about two body lengths by frame 25 with very little steering. She can take the ledge from frame 11. Brand falls helpless after and takes 20 frames to land. The cut contests someone low; from above she is open.'],
    dspec: ['Night Step', 'On the ground, steps back out of a swing on frames 4 to 8 (never off an edge), steps in again and cuts low on frames 15 to 17. Her body can still be hit during the step. In the air there is no step, only the cut. A miss leaves her open until frame 40.'],
    jab: ['Hilt Rap, Quick Cut, Watch Cut', 'A rap with the hilt, a short cut and a cross cut that pushes the opponent back out to the range of the blade. Press again on frames 7 to 13, then 8 to 15, for the next one.'],
    dash: ['Door Drive', 'Drives in shoulder-first behind the stove door, a short step with one solid hit. Covers someone crossing over her.'],
    ftilt: ['Ember Cut', 'A level cut with the full length of the blade. The same damage from the guard to the tip. Her main poke.'],
    utilt: ['Brim Sweep', 'The blade rises in front, then sweeps over her hat and down behind. Either part hits, once. Stops a jump-in and sets up an aerial at low damage.'],
    dtilt: ['Boot-Line Cut', 'A fast low cut that scoops the opponent up in front of her, into Brim Arc or High Ward.'],
    fsmash: ['Forge Cleave', 'A big two-handed cleave, strong along the whole blade. Slow to start and slow to recover: for a punish or a called landing.'],
    usmash: ['Hinge Lift', 'The rim of the stove door scoops the opponent up a set distance, then the blade cleaves straight up through them. Both hits connect at any damage.'],
    dsmash: ['Curfew Sweep', 'A low sweep in front on frame 12, then behind on frame 17. One launch a target. Catches a roll past her.'],
    nair: ['Watch Wheel', 'A close hit with the hilt that holds the opponent in place, then a full turn of the blade on frames 13 to 15 that covers both sides. Landing before the turn skips it.'],
    fair: ['High Ward', 'A forward cut held out for four frames, with only 9 frames of landing lag. Space the end of the blade while drifting back.'],
    bair: ['About-Face Cut', 'A hard cut behind her. Her strongest aerial: run off the stage, or turn round, to take a stock with it.'],
    uair: ['Brim Arc', 'An arc over her head from front to back. Covers the platform above.'],
    dair: ['Poker Drop', 'Drives the blade straight down. The point sends an opponent who is in the air straight down; anyone standing, or caught by the blade above the point, is popped up instead.', 'f13 · point 13% (spike) / blade 9% / late 7%'],
    grab: ['Gauntlet Grab', 'The door swings aside and her shield hand reaches past it: a short reach. It threatens an opponent who waits in shield, but only close. Further out of a dash; the turnaround grab reaches furthest.'],
    f: ['Door Shove', 'Shoves the opponent away with the stove door, out toward the ledge.'],
    b: ['Turn Out', 'Swings the opponent round and sends them out behind her.'],
    u: ['Hoist', 'Lifts the opponent straight up, under a platform.'],
    d: ['Kneel Down', 'Forces the opponent down and pops them up in front, into a rising Brim Arc or High Ward at low damage.'],
    getup: ['Low Sweep / Lip Cut', 'From the floor, sweeps low in front on frame 19 and behind on frame 24. From the ledge, a rising cut onto the stage on frames 20 to 22 for 8%. Briefly intangible as she rises (less above 100%).'],
  },
  /* Joey: the owner's guide, v1.0 (2026-11-10). Weak on purpose. */
  Joey: {
    nspec: ['Shaker Disaster', 'Shakes a protein shaker, forgets the lid and throws the whole bottle. It leaves on frame 22 in a short arc and breaks on the first thing it touches. One bottle at a time. The powder on his face is only for show.'],
    sspec: ['Resistance Band Betrayal', 'Plants a foot in an exercise band; it slips and his leg kicks out on frames 24 to 27. On the ground he stumbles forward with it (never off an edge). No boost in the air.'],
    uspec: ['Spot Me!', 'Throws a lifting strap at a ledge just above and beside his hand on frames 10 to 16. If it catches, he is pulled up to the ledge. If not, it falls limp and he simply keeps falling: no lift at all. Once until he lands or holds a ledge.'],
    dspec: ['Ab Wheel Regret', 'Rolls out on an ab wheel much further than intended. The wheel hits on frames 18 to 32; on the ground he rolls forward with it (stopping before an edge). 25 frames of landing in the air.'],
    jab: ['Form Check, Tiny Curl, Personal Best', 'A timid checking palm, a tiny dumbbell curl, then a hugely overprepared two-hand shove. Each needs a new press: frames 12 to 18, then 15 to 22. No rapid jab.'],
    dash: ['Cardio Was a Mistake', 'Three keen jogging steps and a breathless shoulder bump on frames 17 to 20. Then he checks a fitness watch he is not wearing.'],
    ftilt: ['Lateral Raise', 'A light dumbbell held out to the side, elbow carefully bent. Reaches 0.42 of his height.'],
    utilt: ['Shoulder Press', 'Both hands tremble overhead. The press reaches just above his head.'],
    dtilt: ['Hamstring Check', 'Reaches for his toes and nudges a shin with his fingertips. It does not trip anyone.'],
    fsmash: ['Five-Pound PR', 'Braces as if moving a mountain, then presses a tiny dumbbell forward. Holding it charges for up to a second, for at most a fifth more damage.'],
    usmash: ['Clean and Mostly Jerk', 'Heaves a light plate overhead and nearly falls over. Chargeable like the others.'],
    dsmash: ['Leg Day Withdrawal', 'A lunge forward on frame 23, then a wobbly kick back on frame 36. One hit a target between them.'],
    nair: ['Jumping Jack Panic', 'One disciplined jumping jack, in mid-air. Hands and feet share one hit.'],
    fair: ['Front Raise Fail', 'Raises a tiny dumbbell ahead of him, straining. It never leaves his hand.'],
    bair: ['Glute Kickback', 'An awkward heel kick behind him, with a serious squeeze at contact.'],
    uair: ['Ceiling High-Five', 'Reaches for a pull-up bar that is not there. No lift.'],
    dair: ['Imaginary Box Jump', 'Tucks his knees and stamps down at a gym box that never appears. Pops the opponent up and out; never a spike.'],
    grab: ['Polite Grab', 'An ordinary grab with very little reach. Out of a dash and turning round it reaches a little further.'],
    f: ['Medicine Ball Pass', 'An embarrassingly short chest pass.'],
    b: ['Partner Row', 'Rows the opponent past himself and nearly falls over before letting go.'],
    u: ['Three-Rep Bench PR', 'Lies back on a folding bench and presses the opponent like a barbell: three ever shakier reps (0.5% each on frames 20, 38 and 56), then pops them a little way up on frame 65 and quietly celebrates.'],
    d: ['Assisted Sit-Up', 'Asks the opponent to do a sit-up, then flops onto their knees.'],
    getup: ['Sit-Up Kick / Elbow Nudge', 'From the floor, a sit-up kick both ways on frames 22 to 24. From the ledge, pulls himself up and nudges with an elbow on frames 24 to 26.'],
  },
  /* Cronky Dong: the same man after the injection. The reference fighter's numbers, Joey's own names. */
  'Cronky Dong': {
    nspec: ['The Entire Gym', 'Winds up an enormous arm. It charges for up to 110 frames; special lets it go (19 frames later), shield or an air dodge stops and keeps the charge for this stock. Fully charged, the arm stays wound and the next press punches at once with super armour: 28% on the ground, 25% in the air.'],
    sspec: ['Cap Check', 'Drives his red-capped head forward on frames 20 and 21. A standing opponent is buried in the floor; one in the air is knocked up and away. Super armour on frames 5 to 14 and heavy shield damage. Slow to recover.'],
    uspec: ['Lat Spread Catastrophe', 'Spins with both arms out. On the ground: super armour on frames 5 to 17, seven hits that drag the opponent along, and you steer it left and right. In the air: more hits, a little rise and good sideways travel; helpless after, 38 frames to land.'],
    dspec: ['Floor Is Leg Day', 'Slaps the floor in front and behind on frames 12 and 23. Only standing opponents are hit. Press special again before the second slap ends for another pair. In the air: a two-hit downward swat, the second one sends straight down.'],
    jab: ['Check, Hook', 'A shoving check, then a heavy hook that launches.'],
    dash: ['Full-Body Roll', 'Rolls forward with his whole body. Strongest at the start.'],
    ftilt: ['Long Backhand', 'A long backhand, angled up or down with the stick. 9% angled, 8% straight.'],
    utilt: ['Overhead Arm Sweep', 'Sweeps an arm over his head, front to back. The forearm is the strong part.'],
    dtilt: ['Low Hand Slap', 'A quick low slap that holds the opponent a few frames longer than usual.'],
    fsmash: ['Two-Handed Clap', 'A huge forward clap at full reach. Weaker close in.'],
    usmash: ['Overhead Clap', 'Claps both hands together over his head.'],
    dsmash: ['Two-Fist Floor Strike', 'Hammers both fists into the floor either side of him. The late part on frames 13 and 14 hits hardest.'],
    nair: ['Spin Out', 'Spins with arms out, both sides at once. Lands without lag before frame 10 or after 26.'],
    fair: ['Double-Fist Drop', 'Brings both fists down in front. Late in the swing (frames 21 to 23) the fists spike.'],
    bair: ['Back Kick', 'A fast kick behind him, strongest on frames 7 and 8.'],
    uair: ['Cap Bump', 'Bumps straight up with his head (cap and all).'],
    dair: ['Stomp', 'Stamps straight down. The feet spike; the body above them sends outward.'],
    grab: ['Big Grab', 'A wide two-handed grab with good reach.'],
    f: ['Cargo Lift', 'Hoists the opponent overhead and carries them: walk, jump and pick a carry throw (attack or grab with a direction, or the right stick). The carry lasts about as long as the grab would have; mashing gets them free sooner.'],
    b: ['Toss Back', 'Throws the opponent behind him.'],
    u: ['Overhead Toss', 'Throws the opponent straight up.'],
    d: ['Floor Slam', 'Slams the opponent down in front of him.'],
    cf: ['Cargo Forward', 'From the carry: throws them forward.', '12% · released f15'],
    cb: ['Cargo Back', 'From the carry: turns and throws them behind.', '13% · released f16'],
    cu: ['Cargo Up', 'From the carry: throws them straight up. Quick to recover.', '12% · released f15'],
    cd: ['Cargo Down', 'From the carry: slams them into the floor and up.', '11% · released f17'],
    _extra: { title: 'Carry Throws', keys: ['cf', 'cb', 'cu', 'cd'] },
  },
};
/* The Furious Fowls in the slingshot: each bird's own names. Descriptions come from FOWL_SLING below. */
const FOWL_NAMES = {
  Rusty: { jab: 'Peck, Snap, Headbutt', ftilt: 'Band Whip', utilt: 'Fork Snap', dtilt: 'Handle Sweep', dash: 'Slingshot Lunge', fsmash: 'Overdraw', usmash: 'Fork Launch', dsmash: 'Planted Sweep', nair: 'Sling Spin', fair: 'Band Hook', bair: 'Recoil Snap', uair: 'Pouch Flip', dair: 'Wooden Dummy', grab: 'Band Snare' },
  Bolt: { jab: 'Needle Pecks', ftilt: 'Pouch Thrust', utilt: 'Fork Flick', dtilt: 'Skid Peck', dash: 'Ram Rush', fsmash: 'Piercing Shot', usmash: 'Elastic Flick', dsmash: 'Skid Spin', nair: 'Sling Spin', fair: 'Drill Thrust', bair: 'Back Snap', uair: 'Rising Spiral', dair: 'Diagonal Dive', grab: 'Quick Snare' },
  Cinder: { jab: 'Heavy Pecks, Pouch Slam', ftilt: 'Ember Slam', utilt: 'Blast Pop', dtilt: 'Ground Thump', dash: 'Belly Roll', fsmash: 'Powder Overdraw', usmash: 'Delayed Blast', dsmash: 'Ground Burst', nair: 'Sling Spin', fair: 'Body Slam', bair: 'Blast Recoil', uair: 'Pop Blast', dair: 'Meteor Plunge', grab: 'Heavy Snare' },
  Pip: { jab: 'Staggered Pecks', ftilt: 'Peck Cross', utilt: 'Trio Rise', dtilt: 'Rolling Sweep', dash: 'Formation Rush', fsmash: 'Formation Charge', usmash: 'Trio Spiral', dsmash: 'Scatter', nair: 'Trio Sling Spin', fair: 'Converging Pecks', bair: 'Rear Strike', uair: 'Rising Spiral', dair: 'Triple Drop', grab: 'Band Snare' },
  Pearl: { jab: 'Peck, Flick, Sweep', ftilt: 'Wing Arc', utilt: 'Wing Lift', dtilt: 'Shell Sweep', dash: 'Gliding Swoop', fsmash: 'Egg Catapult', usmash: 'Wing Cyclone', dsmash: 'Egg Burst', nair: 'Floating Sling Spin', fair: 'Wing Thrust', bair: 'Wing Sweep', uair: 'Wing Spiral', dair: 'Egg Drop', grab: 'Band Catch' },
};
const FOWL_SLING = {
  jab: 'Two quick pecks and a finisher that sends up and out.',
  ftilt: 'A forward strike with the band that sends diagonally out.',
  utilt: 'The fork snaps straight up. An anti-air over the pouch.',
  dtilt: 'A low sweep that pops the opponent up and in. A reliable combo starter.',
  dash: 'The whole slingshot lunges in. The early hit is stronger than the late one.',
  fsmash: 'A long overdraw, then the pouch snaps forward with a strong diagonal launch.',
  usmash: 'Fork and band launch straight up.',
  dsmash: 'Plants the handle and sweeps the band low on both sides at once.',
  nair: 'The whole rig spins end over end: light hits that drag the opponent round with it, then a finisher that launches. SDI and DI still decide where they go.',
  fair: 'A forward band hook that sends diagonally out.',
  bair: 'A snap behind that sends low and hard outward. A strong edge finisher.',
  uair: 'An overhead flip of the pouch that sends up, for juggles.',
  grab: 'Snares the opponent with the band. Further out of a dash or a run turnaround.',
  f: 'Releases the band forward on a low diagonal.',
  b: 'Swings the opponent round and slings them behind.',
  u: 'Slings the opponent straight up.',
  d: 'Pins them and lets go for a pop up in front.',
};
const FOWL_SLING_OWN = {
  Rusty: { fd: { dair: 'Drop f14 · 12% early / 8% late' }, dair: 'Drops the wooden dummy straight down. Early it sends an airborne opponent down; later it is a weaker pop-up. The first one each time in the air gives a small hop.' },
  Bolt: { dair: 'Dives fast and diagonally forward, keeping its speed through the hit.', fsmash: 'The longest reach of the five birds: a narrow, piercing pouch snap.', nair: 'A faster, tighter Sling Spin: five light dragging hits with strong sideways carry, then a lower finisher.' },
  Cinder: { dair: 'An explosive plunge straight down that spikes anyone it hits in the air. Long landing lag.', nair: 'A slow, wide Sling Spin: three heavy dragging hits and a strong finisher.' },
  Pip: { dair: 'Three staggered strikes downward. The last one sends straight down.', nair: 'Two Pip doubles orbit the spinning rig: six light dragging hits, then the finisher.' },
  Pearl: { dair: 'A strike below, then an egg dropped that bursts where it lands, and a little float upward afterwards.', fd: { dair: '+ egg 6%' }, nair: 'A floaty, wide Sling Spin that holds Pearl up while it turns: four light dragging hits, then the finisher.' },
};
/* per bird in the slingshot: Side B, Up B (variant) and Down B */
const LAUNCH_DEF = { Rusty: 13, Bolt: 10, Cinder: 18, Pip: 13, Pearl: 14 };
const FOWL_SPEC = {
  Rusty: {
    sspec: ['Redline Launch', 'Aim with the stick during the wind-up (a cannonball arc by default, up or down tilts it), then the bird itself is fired and you fly it. A steady arc with fair steering. On a hit it bounces back off the opponent, angled with the stick. The flight ends when it lands, hits, or you attack, jump, dodge or use a special. The empty slingshot waits where it was.', 'Fires f14 · 9%'],
    uspec: ['Catapult Cyclone', 'Hold special to stretch the bands (up to 45 frames, sinking slowly in the air), let go, and aim any direction with the stick. The rig spins along the line, dragging the opponent with light hits, and ends with a finisher. More charge flies further, hits more often and harder. Once per jump; helpless after.', '8% tapped · up to 24% fully charged'],
    dspec: ['Brace & Break', 'Plants and braces. A light hit from the front on frames 8 to 13 is answered with a 10% band snap and a small hop back. Press attack, or let go of special, on frames 10 to 13 to snap early instead, for 6%.', 'Brace f8-13 · counter 10% · early snap 6%'],
  },
  Bolt: {
    sspec: ['Needleflash Launch', 'Aim during the wind-up, then Bolt is fired: the fastest and narrowest flight, with little steering. Press special once in flight for one sharp change of heading, at three quarters of the speed. A hit doesn\'t stop it: it carries on through. Ends when it lands, hits a shield, or you act.', 'Fires f11 · 7%'],
    uspec: ['Catapult Cyclone', 'Charge by holding special (up to 45 frames), let go and aim with the stick. Bolt\'s cyclone is quicker, spins faster and flies flatter and further sideways, with a lower-angled finisher. Once per jump; helpless after.', '6.5% tapped · up to 22.5% fully charged'],
    dspec: ['Skitter Step', 'A low, elastic skid along the floor on frame 6 with a light hit. Pull the stick back once to reverse it. Press jump on frames 13 to 16 for a low hop out of it. A shield stops it dead and costs six more frames. Once per jump in the air.'],
  },
  Cinder: {
    sspec: ['Meteor Launch', 'Aim during the wind-up, then Cinder is fired: slow and heavy, with the hardest hit of the five but very little steering. Hold down in flight to tuck and dive. Ends when it lands, hits, or you act.', 'Fires f19 · 15%'],
    uspec: ['Catapult Cyclone', 'Charge by holding special (up to 45 frames), let go and aim. Cinder\'s cyclone is slower and bigger, with one hit fewer but each one harder, and a heavier finisher. Once per jump; helpless after.', '9.5% tapped · up to 28% fully charged'],
    dspec: ['Anvil Drop', 'Drives the handle into the floor on frame 15, with a small shock running out on both sides. In the air the slingshot plunges and sends the shock out where it lands. Shorter landing lag if it hit something.', 'Slam f15 · 8% · shocks 6%'],
  },
  Pip: {
    sspec: ['Trio Launch', 'Aim during the wind-up, then Pip is fired with two Pip doubles flying beside it in a staggered formation; the doubles hit too. After about 20 frames they break into a close orbit and can no longer hit. Ends when it lands, hits, or you act.', 'Fires f14 · 5% · doubles 2% each'],
    uspec: ['Catapult Cyclone', 'Charge by holding special (up to 45 frames), let go and aim. Two Pip doubles orbit the spinning rig and widen its reach; the finisher is a little lighter. Once per jump; helpless after.', '7.5% tapped · up to 23.5% fully charged'],
    dspec: ['Orbit Parade', 'Two Pip doubles circle the slingshot for 18 frames while it moves at 70% speed; each can hit twice. Press down + special again to pull them in for a burst in the middle, which ends it early.', 'Doubles from f8 · 1.5% each · burst 3%'],
  },
  Pearl: {
    sspec: ['Glide Release', 'Aim during the wind-up, then Pearl is fired: floaty, with the best steering of the five and a soft, glancing hit that lifts Pearl past. Ends when it lands, hits, or you act.', 'Fires f15 · 6%'],
    uspec: ['Catapult Cyclone', 'Charge by holding special (up to 45 frames), let go and aim. Pearl\'s cyclone floats, rising a little as it goes, with slower turns and lighter hits. Once per jump; helpless after.', '5.8% tapped · up to 19.4% fully charged'],
    dspec: ['Nest Marker', 'Plants one nest on frame 12, on the floor or a platform below. It stays for 150 frames; an opponent who walks into it takes a small hit and is lifted a little, and Pearl gets a lift too if nearby in the air. One nest at a time.', 'Plant f12 · 2%'],
  },
};
/* Each bird on its own (after Side B): three specials, plus the way home and the flight */
const FOWL_SOLO = {
  Rusty: {
    nspec: ['Rally Cry', 'A short pulse all round his body on frames 10 to 13. Clears space when crowded.'],
    sspec: ['Shoulder Check', 'Charges forward on frames 13 to 20. On a hit he bounces up and off the opponent; on a shield he stops dead and is open. Once per jump.'],
    uspec: ['Captain\'s Vault', 'A hop on frame 7. Press special again within the next 16 frames for a second hop off it, and steer each one. Both have a light hit. Helpless after.'],
  },
  Bolt: {
    nspec: ['Brake & Burst', 'Stops dead for seven frames, then bursts the way the stick points (any direction) with a light hit. Bounces back off a shield. Once per jump.'],
    sspec: ['Zigzag', 'A quick dash with a hit. On frame 13 change direction with the stick for a second hit, or pull back to stop dead. Once per jump.'],
    uspec: ['Flash Step', 'Launches in one of eight directions on frame 9, with one small correction mid-flight after frame 13. On a hit it glances upward. Helpless after.'],
  },
  Cinder: {
    nspec: ['Pressure Cooker', 'Hold special to compress (full power after 18 frames) and let go to burst round himself 5 frames later. Frames 15 to 18 shrug off one light hit.', 'Burst 5f after release · 6% to 11%'],
    sspec: ['Furnace Roll', 'A low roll on frames 14 to 22, shrugging off one light hit on frames 14 to 16. Below the stage it bounces once off the island\'s side. Once per jump.'],
    uspec: ['Blast Hop', 'A blast on frame 16 throws him upward with a hit. A smaller hop when under the stage. Helpless after.'],
  },
  Pip: {
    nspec: ['Switcheroo', 'Two Pip doubles appear on either side. On frame 9 Pip swaps places with the one the stick points to (or the one in front), with a small burst between. Once per jump.', 'Swap f9 · 2%'],
    sspec: ['Trio Relay', 'Pip darts forward on frames 11 to 14 while two doubles sweep in from either side, four frames apart. Tilt up or down to aim them.', 'Dart f11 · 4% · doubles 2% each'],
    uspec: ['Bird Ladder', 'Bounces off one double on frame 8. Press special on frames 18 to 25 to bounce off a second, steering harder. Light hits on each. Helpless after.'],
  },
  Pearl: {
    nspec: ['Feather Brake', 'In the air, opens the wings: a slow fall and fine drift for as long as special is held, up to 24 frames. Twice per jump, with a short gap between. Does nothing on the ground.', 'Air only · no hit'],
    sspec: ['Swoop & Fold', 'A folded glide, angled up or down with the stick (and once more on frame 6), into a wide sweep on frames 12 to 17 that glances upward. Bounces back off a shield. Once per jump.'],
    uspec: ['Thermal Rise', 'A smooth, steerable climb from frame 9 to frame 34, with a light hit at the start. Helpless after.'],
  },
};
const FOWL_ALONE = {
  dspec: ['Back to the Pouch', 'Close to the waiting slingshot (about one and a half of its widths), the bird hops back into the pouch on frame 6. Anywhere else it does nothing.', 'Rejoin f6 · near the slingshot only'],
  launch: ['In Flight', 'Right after Side B the bird is flying: steer with the stick. Any attack, jump, dodge or special after frame 6 ends the flight early. Stopped by a shield, it is left open to a punish.'],
  jab: ['Peck, Peck, Kick', 'Two pecks and a kick that sends straight out.'], dash: ['Rushing Strike', 'Rushes in and pops the opponent up at an angle.'],
  ftilt: ['Forward Peck', 'A quick forward strike that sends diagonally out.'], utilt: ['Upward Peck', 'Pecks straight up.'], dtilt: ['Low Sweep', 'Sweeps low and pops the opponent up and in.'],
  fsmash: ['Headlong Strike', 'A committed head-first strike with a long hit.'], usmash: ['Upward Strike', 'Strikes straight up.'], dsmash: ['Two-Sided Kick', 'Kicks out on both sides at once.'],
  nair: ['Body Spin', 'A small spin all round the bird.'], fair: ['Wing Peck', 'A forward wing strike.'], bair: ['Back Kick', 'Kicks out behind, low and outward.'], uair: ['Upward Flap', 'A flap overhead, for juggles.'], dair: ['Downward Strike', 'Strikes below, straight down: a spike.'],
  grab: ['Beak Grab', 'A short grab with the beak. Further out of a dash or a run turnaround.'],
  f: ['Forward Fling', 'Flings forward on a diagonal.'], b: ['Back Fling', 'Flings behind.'], u: ['Up Fling', 'Flings straight up.'], d: ['Down Peck', 'Pins and pecks, popping them up in front.'],
};
/* Unique mechanics, stances and forms */
const MOVE_RULES = {
  Joey: [
    ['tap tap', 'The Injection', 'Tap the transform action twice (the D-pad’s down button, or E on the keyboard), the second tap within a third of a second. Joey looks round, injects, and grows for three seconds: he cannot act, and nothing can hit or grab him. Two seconds more of the same protection once he can move, attacking or not. Then he is Cronky Dong for the rest of the match, through every stock.'],
    ['', 'Any time', 'Taps in the countdown start it on the first moment of play. Taps while he is hit, held, dodging or in an attack wait for the first moment he can act. Later taps do nothing.'],
    ['', 'Human', 'A normal man: very little damage, short reach, slow in the air and no second jump. Spot Me! only reaches a ledge just above him.'],
  ],
  Flint: [
    ['★', 'The Ember Patch', 'A Banked Coal that reaches the floor leaves one ember for 45 frames. It burns whoever steps on it, and goes out on contact or on a shield. Only one: the next coal clears it.'],
    ['↓ B', 'Ember into Flame', 'Bellows Burst reaching Flint\'s own ember uses it up and sends a low flame wave on a little further for another hit.'],
    ['Air ↓ B', 'Hanging Bellows', 'Bellows Burst in the air holds Flint in place while it plays, once each time he leaves the ground.'],
  ],
  Wren: [
    ['↓ B', 'Wren\'s Call', 'Down special cycles the companions: Nib → Loom → Hod → Nib. The new one takes over on frame 16 and can act on frame 33. A hit before frame 16 keeps the old one in. 60 frames must pass before the next call. In the air it hangs while it plays, once per jump.'],
    ['★', 'One Team', 'All three share one set of stocks and one damage percent. The companion out when a hit lands decides the weight: Hod is heavy, Nib light.'],
    ['B', 'One Projectile', 'Only one of Nib\'s bolts or Hod\'s stones can be out at a time across the team; a new one replaces the old. A stone can keep rolling while Wren swaps.'],
    ['★', 'Nib: Wall Jump', 'Nib can kick off the island\'s wall: hold toward it and jump, up to twice each time in the air.'],
    ['★', 'Loom: Three Air Jumps', 'Loom falls slowly and has three jumps in the air, with the widest drift of the three.'],
    ['→ B', 'Hod: Ram Plate Armour', 'On the ground, frames 13 to 19 of Ram Plate shrug off one hit of 8% or less. Hod is the heaviest and has the shortest recovery: keep him on the stage.'],
  ],
  'Potato Sack': [
    ['★', 'Hopping', 'He walks and runs in hops, with a full stop between each one, so he cannot simply walk someone down. Tumble (↓ B) is how he really gets about.'],
    ['★', 'No Hands, No Ledge', 'He cannot hold the ledge: he has to land back on the stage. Tumble, Hot Potato and his jumps are his way home.'],
    ['↑ B', 'Hot Potato Flight', 'Hot Potato hurts him for 12% and throws him upward: the more hurt he is, the further it sends him, so it is a bigger recovery late in a stock.'],
    ['B', 'Uncapped Spud Bomb', 'There is no limit on Spud Bomb\'s charge: hold it long enough and the burst covers a huge area and hits very hard. Being hit stops the charge.'],
  ],
  Sprocket: [
    ['↓ B', 'Through the Shield', 'Bench Vise catches a standing opponent even if they are shielding. Make a shield-happy opponent pay; a jump or a dodge beats it.'],
    ['B', 'The Returning Tape', 'Tape Roll curls back toward where it was let go after about 22 frames, so it covers the space in front of Sprocket twice.'],
  ],
  'Chomp Chomp': [
    ['B', 'The Ant and the Rope', 'With the coal on the floor, B runs a rope from the coal to Chomp, wherever he is, and his ant crawls from the coal along it toward him (from frame 10), following him as he moves. Only the ant hits: 7%, once a trip. The rope never hurts; it just snags an opponent who crosses it. Any attack on the rope cuts it, and any attack on the ant beats it; the coal stays. The ant arriving hands Chomp his coal back.'],
    ['B', 'One Coal', 'Chomp has one hot coal at a time. Walk over it to pick it up. If it is destroyed or runs out, a new one is ready after a moment.'],
    ['↓ B', 'Gust the Coal', 'Air Cushion pushes a swinging or flying coal further along, to change where it lands. It never pushes the ant.'],
  ],
  Scuttle: [
    ['★', 'Low and Quick', 'Scuttle is small and light (three quarters of Flint\'s height), fast on the ground and in the air. It gets under swings but is launched early.'],
    ['B', 'Through the Shield', 'Tongs Snatch on the ground catches a standing opponent even if they are shielding.'],
    ['Air ↓ B', 'Spike and Thump', 'Bucket Drop in the air sends anyone it hits straight down, and thumps the ground where it lands for anyone it missed.'],
  ],
  Brand: [
    ['★', 'The Whole Blade', 'Her sword hits the same from the guard to the tip, and it is longer than most swings. Stand where it reaches and the other fighter falls short.'],
    ['→ B', 'The Door Guards Once', 'Stove Door Bash stops one light strike (8% or less) from the front on frames 5 to 8, on the ground only. It is a read: thrown out with nothing to stop, it leaves 24 frames to punish.'],
    ['B', 'Tap or Hold', 'Hot Iron Thrust is chosen by frame 9: let go for the quick thrust, keep holding for the long, late one.'],
    ['↑ B', 'A Narrow Way Home', 'Watchfire Rise goes almost straight up and she is helpless after it. Get under the ledge before using it.'],
  ],
  'Furious Fowls': [
    ['B', 'Choosing a Bird', 'In the slingshot, tap special for the next bird. Hold it 8 frames to open the wheel, point with the stick and let go: clockwise from the top, Flint, Bolt, Cinder, Pip, Pearl. Each bird changes the slingshot\'s weight, speed and every attack.'],
    ['→ B', 'Firing the Bird', 'Side special fires the bird itself, and you play the bird alone. The empty slingshot stays where it was, falls to the floor, and comes back near the ledge if it is lost.'],
    ['↓ B', 'Back to the Pouch', 'As the bird alone, down special close to the slingshot hops back in. The bird alone is lighter and quicker, with weaker attacks and its own three specials.'],
    ['Air A', 'Sling Spin Drag', 'Neutral air and Catapult Cyclone drag the opponent round with light hits before the finisher. SDI and DI still decide where they end up.'],
    ['↑ B', 'Once per Jump', 'Catapult Cyclone can be used once each time in the air, and leaves the slingshot helpless.'],
  ],
};
const GETUP_TEXT = ['Get-up Attack', 'Getting up from the floor, strikes both sides at once. Briefly intangible as it rises (less above 100%).'];
const PUMMEL_TEXT = ['Pummel', 'Press attack while holding the opponent to add damage before a throw.'];

/* ---------- Pages, built from the words and the moves themselves ---------- */
const ML_INPUT = { nspec: 'B', sspec: '→ B', uspec: '↑ B', dspec: '↓ B', jab: 'A', ftilt: '→ A', utilt: '↑ A', dtilt: '↓ A', dash: 'Dash A', fsmash: 'Smash → A', usmash: 'Smash ↑ A', dsmash: 'Smash ↓ A',
  nair: 'Air A', fair: 'Air → A', bair: 'Air ← A', uair: 'Air ↑ A', dair: 'Air ↓ A', grab: 'Grab', pummel: 'Grab A', f: 'Grab →', b: 'Grab ←', u: 'Grab ↑', d: 'Grab ↓', getup: 'Get-up A', launch: 'In flight' };
const ML_GROUND = ['jab', 'dash', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'usmash', 'dsmash'], ML_AIR = ['nair', 'fair', 'bair', 'uair', 'dair'], ML_SPEC = ['nspec', 'sspec', 'uspec', 'dspec'];
/* every move a form has, and the entry that documents it (the move keys that are part of another move) */
const ML_PART_OF = { nspecR: 'nspec', nspecF: 'nspec', uspecA: 'uspec', dspecA: 'dspec', jab2: 'jab', jab3: 'jab', jabr: 'jab', dgrab: 'grab', pgrab: 'grab', sbrake: 'sspec', dsnap: 'dspec', dcounter: 'dspec', flyStop: 'launch', swingBite: 'sspec', throws: 'grab', nspecH: 'nspec', ledgeatk: 'getup' };
const pc = v => +(+v).toFixed(1) + '%';
function mlFd(fm, key) {
  const mv = fm.moves;
  if (key === 'pummel') return pc(fm.st.pummel || 1.3) + ' a press';
  if ('fbud'.includes(key) && key.length === 1) return mv.throws[key] ? pc(mv.throws[key].d) : '';
  if (key === 'grab') return 'Standing f' + mv.grab.h[0].f0 + ' · dash f' + mv.dgrab.h[0].f0 + ' · turnaround f' + mv.pgrab.h[0].f0;
  if (key === 'jab') { const ds = []; let m = mv.jab, n = 0; const first = m.h[0].f0; while (m && n++ < 4) { ds.push(pc(m.h[0].d)); m = m.next && m.next !== 'jabr' ? mv[m.next] : null; } return 'f' + first + ' · ' + ds.join(' + '); }
  const m = mv[key]; if (!m || !m.h) return '';
  const hs = m.h.filter(x => x.d > 0 || x.grab); if (!hs.length) return '';
  const start = Math.min(...hs.map(x => x.f0)), dmg = hs.filter(x => !x.grab && x.d > 0);
  let t = (hs.some(x => x.grab) ? 'Grab f' : 'f') + start;
  if (dmg.length) {
    const parts = dmg.some(x => x.part === 'late' || x.part === 'near') || dmg.length < 3;
    if (parts) t += ' · ' + [...new Set(dmg.map(x => x.d))].sort((a, b) => b - a).map(pc).join(' / ');
    else t += ' · ' + dmg.length + ' hits, ' + pc(dmg.reduce((s, x) => s + x.d, 0)) + ' in all';
  }
  if (m.chg) t += ' · chargeable';
  return t;
}
function mlEntry(fm, key, txt, fdx) { if (!txt) return null; return { key, inp: ML_INPUT[key] || '★', name: txt[0], desc: txt[1], fd: txt[2] || ((fm ? mlFd(fm, key) : '') + (fdx ? ' ' + fdx : '')) }; }
function mlStdPages(fm, T, title) {
  const E = k => mlEntry(fm, k, T[k]);
  const grab = [E('grab'), mlEntry(fm, 'pummel', PUMMEL_TEXT), E('f'), E('b'), E('u'), E('d'), mlEntry(fm, 'getup', T.getup || GETUP_TEXT)];
  return [
    { title: 'Special Moves', fm, entries: ML_SPEC.map(E) },
    { title: 'Ground Attacks', fm, entries: ML_GROUND.map(E) },
    { title: 'Aerial Attacks', fm, entries: ML_AIR.map(E) },
    { title: 'Grabs & Throws', fm, entries: grab },
  ].concat(T._extra ? [{ title: T._extra.title, fm, entries: T._extra.keys.map(E) }] : []).map(p => Object.assign(p, { entries: p.entries.filter(Boolean), sub: title }));   /* _extra: a page of a form's own (Cronky Dong's carry throws) */
}
function mlRulesPage(name, fm) { const R = MOVE_RULES[name]; return R ? { title: 'Unique Mechanics', fm, entries: R.map(([inp, n, d]) => ({ key: '', inp, name: n, desc: d, fd: '' })) } : null; }
function mlFowlSections(def) {
  const sl = def.forms.filter(fm => fm.sling), alone = def.forms.filter(fm => !fm.sling), secs = [];
  for (const fm of sl) {
    const nm = fm.name, own = FOWL_SLING_OWN[nm] || {}, T = {};
    for (const k of ML_GROUND.concat(ML_AIR, ['grab'])) T[k] = [FOWL_NAMES[nm][k], own[k] || FOWL_SLING[k]];
    for (const k of 'fbud') T[k] = [{ f: 'Band Release', b: 'Swing Around', u: 'Sky Sling', d: 'Pouch Drop' }[k], FOWL_SLING[k]];
    T.nspec = ['Bird Selector', 'Tap special to switch to the next bird. Hold it for 8 frames to open the wheel: point with the stick and let go to pick (clockwise from the top: Flint, Bolt, Cinder, Pip, Pearl). The new bird drops into the pouch during a six-frame swap.', 'Tap: next bird · hold 8f: wheel'];
    Object.assign(T, FOWL_SPEC[nm]);
    const pages = mlStdPages(fm, T, 'In the slingshot');
    if (own.fd) for (const p of pages) for (const e of p.entries) if (own.fd[e.key]) e.fd = e.fd ? e.fd + ' ' + own.fd[e.key] : own.fd[e.key];
    secs.push({ label: fm.label, role: fm.role, fm, pages });
  }
  const ap = [];
  for (const fm of alone) { const b = fm.name.replace(' alone', ''), S = FOWL_SOLO[b];
    ap.push({ title: (FOWL_LABEL[b] || b) + ' Alone: Specials', sub: 'The bird on its own', fm, entries: [mlEntry(fm, 'nspec', S.nspec), mlEntry(fm, 'sspec', S.sspec), mlEntry(fm, 'uspec', S.uspec), mlEntry(fm, 'dspec', FOWL_ALONE.dspec), mlEntry(fm, 'launch', FOWL_ALONE.launch)] }); }
  const f0 = alone[0];   /* the bird-alone attacks are the same for all five */
  for (const p of mlStdPages(f0, FOWL_ALONE, 'Every bird on its own').slice(1)) { p.title = 'Bird Alone: ' + p.title; p.anyBird = 1; ap.push(p); }
  secs.push({ label: 'Alone', role: 'any bird', fm: f0, pages: ap });
  secs.push({ label: 'Rules', role: 'how the Fowls work', fm: sl[0], pages: [mlRulesPage(def.name, sl[0])] });
  return secs;
}
const ML_CACHE = new Map();
function mlSections(def) {
  if (ML_CACHE.has(def)) return ML_CACHE.get(def);
  let secs;
  if (def.fowl) secs = mlFowlSections(def);
  else {
    secs = def.forms.map(fm => ({ label: fm.label || fm.name, role: '', fm, pages: mlStdPages(fm, MOVE_TEXT[fm.name] || {}, def.forms.length > 1 ? fm.name : '') }));
    const rp = mlRulesPage(def.name, def.forms[0]);
    if (rp) { if (secs.length > 1) secs.push({ label: def.name, role: 'the team', fm: def.forms[0], pages: [rp] }); else secs[0].pages.push(rp); }
  }
  ML_CACHE.set(def, secs); return secs;
}
/* which moves a form has that no page documents (tests/movelist.js checks this is empty for every form) */
function mlMissing(def) {
  const secs = mlSections(def), out = [];
  for (const fm of def.forms) {
    const have = new Set(); for (const s of secs) for (const p of s.pages) if (p.fm === fm || p.anyBird && !fm.sling) for (const e of p.entries) if (e.key) have.add(e.key);
    for (const k in fm.moves) { const m = fm.moves[k]; if (!m || typeof m !== 'object') continue; const need = ML_PART_OF[k] || k;
      if (fm.moves.jab && !fm.moves.jab.next && (k === 'jab2' || k === 'jab3')) continue;   /* a one-hit jab: its chain is never used */
      if (!have.has(need)) out.push(fm.name + ':' + k); }
    for (const k in fm.moves.throws) if (!'fbud'.includes(k)) { if (!have.has(k === 's' || k === 'v' || k === 'n' ? (k === 'v' ? 'dspec' : k === 's' ? 'sspec' : 'nspec') : k)) out.push(fm.name + ':throw ' + k); }   /* a special's own throw is told with that special */
    for (const s of secs) for (const p of s.pages) for (const e of p.entries) if (!e.name || !e.desc) out.push(fm.name + ':' + e.key + ' (no words)');
  }
  return out;
}

/* ---------- State and input ---------- */
const ML = { open: false, def: null, secs: [], flat: [], at: 0, ctl: null, dev: '', hx: 0, vy: 0, rep: 0, sh: [false, false], kq: [false, false], t: 0 };
let ML_PLUS = 0;   /* when the + key was last pressed (keyboard) */
if (typeof addEventListener === 'function') addEventListener('keydown', e => { if ((e.code === 'Equal' || e.code === 'NumpadAdd') && !e.repeat) ML_PLUS = performance.now(); if (ML.open && (e.code === 'Escape' || e.code === 'Tab')) e.preventDefault(); });
function mlPlusKey() { if (!ML_PLUS || performance.now() - ML_PLUS > 250) return false; ML_PLUS = 0; return true; }
function mlOpen(def, sec, ctl, page) {
  ML.def = def; ML.secs = mlSections(def); ML.flat = []; ML.secs.forEach((s, si) => s.pages.forEach((p, pi) => ML.flat.push({ si, pi })));
  const at = ML.flat.findIndex(q => q.si === (sec || 0) && q.pi === (page || 0)); ML.at = Math.max(0, at);
  ML.ctl = ctl; ML.dev = ctl.dev; ML.open = true; ML.hx = 0; ML.vy = 0; ML.rep = 0; ML.t = 0; ML.esc = true; ML.sh = [true, true]; ML.kq = [true, true];
  beep(660, 0.06, 'triangle', 0.05, 1.3);
}
function mlClose() { ML.open = false; beep(420, 0.06, 'triangle', 0.04); }
/* where the move list opens for a fighter in a match: the companion or bird that is out */
function mlOpenFor(f) {
  const def = f.def; let sec = 0, page = 0;
  if (def.fowl) { if (f.fi < 5) sec = f.fi; else { sec = 5; page = f.fi - 5; } } else if (def.forms.length > 1) sec = f.fi % def.forms.length;
  mlOpen(def, sec, f.ctl, page);
}
function mlTurn(d) { const n = ML.flat.length, to = clamp(ML.at + d, 0, n - 1); if (to !== ML.at) { ML.at = to; ML.t = 0; beep(520 + (d > 0 ? 60 : 0), 0.035, 'square', 0.025); } }
function mlSection(d) { const si = ML.flat[ML.at].si + d; if (si < 0 || si >= ML.secs.length) return; ML.at = ML.flat.findIndex(q => q.si === si); ML.t = 0; beep(600, 0.04, 'triangle', 0.03); }
function mlInput(c) {
  ML.t++;
  const kb = c.dev === 'kb', esc = kb && !!(keys.Escape || keys.Backspace);
  if (c.pressed('spc') || c.pressed('start') || c.pressed('sel') || (esc && !ML.esc) || (kb && mlPlusKey())) { ML.esc = esc; mlClose(); return; }
  ML.esc = esc;
  /* shoulders: L / ZL back, R / ZR on (Q and W on the keyboard) */
  let sh = [false, false];
  if (kb) sh = [!!keys.KeyQ, !!keys.KeyW];
  else { const p = navigator.getGamepads ? navigator.getGamepads()[+c.dev.slice(3)] : null; const b = k => !!(p && p.buttons[k] && p.buttons[k].pressed); sh = [b(4) || b(6), b(5) || b(7)]; }
  if (sh[0] && !ML.sh[0]) mlTurn(-1); if (sh[1] && !ML.sh[1]) mlTurn(1); ML.sh = sh;
  /* the stick (or arrows): left / right pages, up / down forms, held to repeat */
  const lx = c.c.lx, ly = c.c.ly, hx = lx > 0.6 ? 1 : lx < -0.6 ? -1 : 0, vy = Math.abs(ly) > 0.6 && Math.abs(ly) > Math.abs(lx) ? sgn(ly) : 0;
  if (hx && hx === ML.hx) { if (++ML.rep > 20 && ML.rep % 7 === 0) mlTurn(hx); } else if (hx) { ML.rep = 0; mlTurn(hx); }
  if (vy && vy !== ML.vy) mlSection(-vy);
  if (!hx) ML.rep = 0; ML.hx = hx; ML.vy = vy;
  if (c.pressed('atk')) mlTurn(1);
}
/* The pause menu: Resume, Move List, Controls, Exit. Returns 'held' when it used this frame's input, 'resume' or 'exit' to act on. */
const PAUSE_ITEMS = ['Resume', 'Move List', 'Controls', 'Exit to fighter select'];
function pauseMenuStep(starter) {
  if (ML.open) { if (ML.ctl) mlInput(ML.ctl); return 'held'; }
  if (starter) return null;   /* Start: the usual resume */
  for (const f of F) { if (f.ctl.dev === 'cpu') continue; const c = f.ctl;
    if (c.dev === 'kb' && mlPlusKey()) { mlOpenFor(f); return 'held'; }
    const up = c.c.ly > 0.6 && !(c.p.ly > 0.6), dn = c.c.ly < -0.6 && !(c.p.ly < -0.6);
    if (up || dn) { PAUSE_SEL = (PAUSE_SEL + (dn ? 1 : -1) + PAUSE_ITEMS.length) % PAUSE_ITEMS.length; beep(480, 0.03, 'square', 0.02); return 'held'; }
    if (c.pressed('atk')) { if (PAUSE_SEL === 0) return 'resume'; if (PAUSE_SEL === 3) return 'exit'; if (PAUSE_SEL === 2) { openCMenu(c.dev); return 'held'; }   /* the controls screen (sim.js), for whoever chose it */
      mlOpenFor(F[PAUSED_BY] && F[PAUSED_BY].ctl.dev !== 'cpu' ? F[PAUSED_BY] : f); return 'held'; }
  }
  return null;
}
function drawPauseMenu() {
  g.fillStyle = 'rgba(8,6,16,.62)'; g.fillRect(0, 0, W, H); big('PAUSED', H * 0.3, 80);
  const pf = F[PAUSED_BY], who = pf ? (pf.ctl.dev === 'cpu' ? 'CPU' : 'P' + (pf.idx + 1)) + '  ·  ' + pf.def.name : '';
  g.textAlign = 'center'; g.font = 'bold 13px system-ui, sans-serif'; spaced(3); g.fillStyle = '#f3dfb6'; g.fillText(who.toUpperCase(), W / 2, H * 0.3 + 34); spaced(0);
  const bw = 340, bh = 46, x = W / 2 - bw / 2;
  PAUSE_ITEMS.forEach((t, k) => { const y = H * 0.3 + 64 + k * (bh + 12), on = k === PAUSE_SEL;
    if (on) { g.save(); g.shadowColor = 'rgba(255,140,50,.55)'; g.shadowBlur = 20; const q = g.createLinearGradient(0, y, 0, y + bh); q.addColorStop(0, '#ffc867'); q.addColorStop(1, '#ef6d2a'); g.fillStyle = q; rr(x, y, bw, bh, 23); g.fill(); g.restore(); }
    else { g.fillStyle = 'rgba(20,17,36,.86)'; rr(x, y, bw, bh, 23); g.fill(); g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.stroke(); }
    g.font = (on ? '900 ' : 'bold ') + '19px system-ui, sans-serif'; spaced(on ? 2 : 1); g.fillStyle = on ? '#2a1208' : '#e6e0f6'; g.fillText(t.toUpperCase(), W / 2, y + 30); spaced(0); });
  let hx = W / 2 - 300; const hy = H * 0.3 + 64 + PAUSE_ITEMS.length * (bh + 12) + 26;
  for (const [cap, a] of [['↑ ↓', 'Choose'], ['A / Z', 'Select'], ['Start / Enter', 'Resume'], ['B / X', 'Exit to fighter select'], ['+', 'Move list']]) hx = keyHint(hx, hy, cap, a);
}

/* ---------- Drawing ---------- */
const ML_SERIF = '"Palatino Linotype", "Book Antiqua", Georgia, serif';
function mlWrap(text, w) { const out = []; let line = ''; for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
/* an input written as chips: arrows and buttons in round caps, words (Smash, Air, Grab...) as pills */
function mlChips(x, y, inp) {
  for (const tok of inp.split(' ')) {
    const btn = tok === 'A' || tok === 'B', arrow = '→←↑↓'.includes(tok) && tok.length === 1;
    g.font = 'bold ' + (btn || arrow ? 15 : 11) + 'px system-ui, sans-serif'; spaced(btn || arrow ? 0 : 1);
    const w = btn || arrow ? 24 : g.measureText(tok.toUpperCase()).width + 14;
    if (btn) { g.fillStyle = tok === 'A' ? '#ff8a5c' : '#ffd166'; g.beginPath(); g.arc(x + 12, y, 12, 0, TAU); g.fill(); g.fillStyle = '#2a1208'; }
    else if (arrow) { g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(x + 12, y, 12, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#fff'; }
    else { g.fillStyle = tok === '★' ? 'rgba(255,184,107,.22)' : 'rgba(255,255,255,.08)'; rr(x, y - 11, w, 22, 11); g.fill(); g.strokeStyle = 'rgba(255,184,107,.55)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#ffb86b'; }
    g.textAlign = 'center'; g.fillText(btn || arrow ? tok : tok.toUpperCase(), x + w / 2, y + (btn || arrow ? 5 : 4)); spaced(0);
    x += w + 5;
  }
  return x;
}
function mlCard(e, x, y, w, h, big) {
  const q = g.createLinearGradient(0, y, 0, y + h); q.addColorStop(0, 'rgba(46,38,72,.9)'); q.addColorStop(1, 'rgba(22,18,38,.92)'); g.fillStyle = q; rr(x, y, w, h, 12); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#ffb86b'; rr(x, y + 12, 4, h - 24, 2); g.fill();
  const nx = mlChips(x + 18, y + 26, e.inp) + 6;
  g.textAlign = 'left'; g.font = 'bold ' + (big ? 21 : 18) + 'px ' + ML_SERIF; g.fillStyle = '#fff'; g.fillText(e.name, nx, y + 32);
  let ty = y + 48;
  if (e.fd) { g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.fillText(e.fd, x + 20, ty + 6); ty += 14; }
  g.font = (big ? 15 : 14) + 'px system-ui, sans-serif'; g.fillStyle = '#d8d2ee'; const lh = big ? 20 : 17, max = Math.max(1, Math.floor((y + h - 10 - ty) / lh));
  let lines = mlWrap(e.desc, w - 40); if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…'; }
  lines.forEach((l, k) => g.fillText(l, x + 20, ty + 14 + k * lh));
}
function drawMoveList() {
  if (!ML.open || !ML.flat.length) return;
  const { si, pi } = ML.flat[ML.at], sec = ML.secs[si], page = sec.pages[pi], def = ML.def, fm = page.fm || sec.fm, t = typeof tick !== 'undefined' ? tick : 0;
  /* backdrop: the game dimmed behind an ember glow */
  g.fillStyle = 'rgba(10,8,20,.965)'; g.fillRect(0, 0, W, H);
  let q = g.createRadialGradient(W * 0.15, 40, 10, W * 0.15, 40, 520); q.addColorStop(0, 'rgba(255,130,40,.18)'); q.addColorStop(1, 'rgba(255,130,40,0)'); g.fillStyle = q; g.fillRect(0, 0, W, H);
  /* header: the fighter, its name, and the forms */
  const hx = 44, hy = 22;
  g.fillStyle = 'rgba(20,17,36,.84)'; rr(hx, hy, 116, 104, 14); g.fill(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.stroke();
  if (typeof ART !== 'undefined' && fm && ART[fm.name]) { g.save(); rr(hx, hy, 116, 104, 14); g.clip(); g.fillStyle = fm.col[0]; g.globalAlpha = 0.18; g.beginPath(); g.arc(hx + 58, hy + 62, 46, 0, TAU); g.fill(); g.globalAlpha = 1; const k = Math.min(5, 72 / (fm.st.h + 3)); g.translate(hx + 58, hy + 92); g.scale(k, -k); ART[fm.name](fm.col, (typeof frame !== 'undefined' ? frame : 0), null); g.restore(); }
  g.textAlign = 'left'; g.font = 'bold 12px system-ui, sans-serif'; spaced(4); g.fillStyle = '#ffb86b'; g.fillText('MOVE LIST', 184, 46); spaced(0);
  g.save(); g.font = '900 44px ' + ML_SERIF; spaced(3); g.shadowColor = 'rgba(255,130,40,.5)'; g.shadowBlur = 18;
  q = g.createLinearGradient(0, 56, 0, 96); q.addColorStop(0, '#fff6dc'); q.addColorStop(0.5, '#ffc56a'); q.addColorStop(1, '#f0702c'); g.lineWidth = 5; g.strokeStyle = '#2a1410'; g.lineJoin = 'round';
  g.strokeText(def.name.toUpperCase(), 184, 92); g.fillStyle = q; g.fillText(def.name.toUpperCase(), 184, 92); g.restore(); spaced(0);
  g.font = 'italic 16px ' + ML_SERIF; g.fillStyle = '#f3dfb6'; g.fillText(page.sub || def.sub, 186, 116);
  if (ML.secs.length > 1) {   /* the forms, as tabs: up / down jumps between them */
    let x = W - 44; g.font = 'bold 13px system-ui, sans-serif';
    const ws = ML.secs.map(s => g.measureText(s.label).width + 26); x -= ws.reduce((a, b) => a + b + 6, -6);
    g.textAlign = 'right'; g.font = 'bold 11px system-ui, sans-serif'; spaced(2); g.fillStyle = '#b9b2d6'; g.fillText('↑ ↓', x - 10, 66); spaced(0);
    ML.secs.forEach((s, k) => { const on = k === si, w = ws[k]; g.fillStyle = on ? '#ffb86b' : 'rgba(255,255,255,.08)'; rr(x, 48, w, 26, 13); g.fill(); if (!on) { g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.stroke(); }
      g.textAlign = 'center'; g.font = 'bold 13px system-ui, sans-serif'; g.fillStyle = on ? '#2a1208' : '#d8d2ee'; g.fillText(s.label, x + w / 2, 66); x += w + 6; });
    if (sec.role) { g.textAlign = 'right'; g.font = 'italic 14px ' + ML_SERIF; g.fillStyle = '#cfc8e8'; g.fillText(sec.role, W - 44, 98); }
  }
  /* the page's title bar, with page arrows and the count */
  const by = 140;
  for (const dir of [-1, 1]) { q = g.createLinearGradient(W / 2 + dir * 170, 0, W / 2 + dir * 420, 0); q.addColorStop(0, 'rgba(255,170,90,.8)'); q.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = q; g.fillRect(dir > 0 ? W / 2 + 170 : W / 2 - 420, by + 12, 250, 2); }
  g.textAlign = 'center'; g.font = '900 22px system-ui, sans-serif'; spaced(5); g.fillStyle = '#fff'; g.fillText(page.title.toUpperCase(), W / 2 + 2, by + 20); spaced(0);
  const n = ML.flat.length, pulse = 0.6 + 0.4 * Math.sin(t * 0.12);
  g.font = 'bold 30px system-ui, sans-serif'; g.fillStyle = 'rgba(255,217,138,' + (ML.at > 0 ? pulse : 0.15).toFixed(2) + ')'; g.fillText('‹', 64, by + 24); g.fillStyle = 'rgba(255,217,138,' + (ML.at < n - 1 ? pulse : 0.15).toFixed(2) + ')'; g.fillText('›', W - 64, by + 24);
  g.font = 'bold 12px system-ui, sans-serif'; g.fillStyle = '#b9b2d6'; g.textAlign = 'left'; g.fillText('L', 84, by + 18); g.textAlign = 'right'; g.fillText('R', W - 84, by + 18);
  /* the moves, as cards: two columns */
  const es = page.entries, cols = 2, rows = Math.max(2, Math.ceil(es.length / cols)), top = by + 40, bot = H - 70, gap = 12, cw = (W - 88 - gap) / cols, ch = (bot - top - gap * (rows - 1)) / rows, slide = Math.max(0, 1 - ML.t / 8);
  g.save(); g.globalAlpha = 1 - slide * 0.6; g.translate(slide * 18, 0);
  es.forEach((e, k) => { const c = k % cols, r = k / cols | 0; mlCard(e, 44 + c * (cw + gap), top + r * (ch + gap), cw, ch, rows <= 2); });
  g.restore();
  /* footer: where we are, and the controls */
  const fy = H - 30; let dx = W / 2 - (Math.min(n, 40) * 12) / 2;
  if (n <= 40) ML.flat.forEach((p, k) => { g.fillStyle = k === ML.at ? '#ffb86b' : p.si === si ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(dx + 6, fy - 12, k === ML.at ? 4 : 3, 0, TAU); g.fill(); dx += 12; });
  let x = 44; for (const [cap, a] of [['← →', 'Page'], ['L / R', 'Page'], ...(ML.secs.length > 1 ? [['↑ ↓', 'Form']] : []), ['B', 'Back']]) x = keyHint(x, fy + 14, cap, a);
  g.textAlign = 'right'; g.font = '12px system-ui, sans-serif'; g.fillStyle = '#9d96bb';
  g.fillText('A = Attack (Z)  ·  B = Special (X)  ·  keyboard: Q / W pages, Esc back  ·  damage before the 1-on-1 bonus', W - 44, fy + 15);
  g.fillText((ML.at + 1) + ' / ' + n, W - 44, fy - 8);
}
