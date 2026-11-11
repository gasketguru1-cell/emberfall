# Online play: status and test results

## What is built

- **Rollback netcode (`net.js`).**
  - The game already steps at a fixed 60 Hz and is deterministic. The only randomness is in particles and the CPU, and neither runs online.
  - Frame-numbered input exchange, with the last 8 frames resent in every packet.
  - 2 frames of input delay.
  - Prediction: a missing remote input repeats the last one.
  - Full-state snapshots every frame. On a wrong guess the game rewinds and replays, up to 10 frames back.
  - Sounds and particles are muted during replays.
  - Checksums every 30 confirmed frames, with desync detection.
  - Time sync: the machine that is ahead slows down slightly.
  - On-screen stats: ping, rollbacks and their depth, waits.
  - No server is involved in play.
- **Windows desktop app (`desktop/`, Electron 33).**
  - Opens straight into the game: no browser, no localhost.
  - Packed with only the run-time files (34 MB of game data).
  - Per-user install: no administrator rights, no firewall prompt, no ports to open.
  - Offline play works as before.
- **Online menu (`online.js`, desktop only).** ONLINE, then pick a fighter, then HOST MATCH shows a code. Your friend chooses JOIN MATCH and types the code. Both machines start the same match together.
- **Connections:**
  - **Direct (same network):** UDP between the two machines. It needs nothing else and is fully tested below.
  - **Internet (Epic Online Services):** device-ID login, private lobby, P2P with relay fallback. This is **not built yet**, because it needs the EOS SDK and your game's IDs from the Epic Developer Portal, and only you can sign in there (`desktop/EOS-SETUP.md`). Until then the menu offers Direct only.

## Installer

`dist/Emberfall-Setup-1.0.0.exe` (98 MB). Run `npm run dist` to rebuild it. It isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" the first time; your friend clicks **More info**, then **Run anyway**. A code-signing certificate would remove that warning, but they cost money, so I didn't get one.

## Tests actually run

| Test | Result |
|---|---|
| `node tests/net.js` (part of `npm test`): two copies of the game in separate sandboxes over a simulated network, compared with an offline copy given the same inputs | **12 of 12 pass**: every checksum and the final state are identical to the offline game |
| Network conditions covered | LAN (8 ms); 60 ms with 2% loss; 120 ms with 5% loss and 30 ms jitter; one machine's clock 5% fast |
| Fighters covered | Potato Sack v Furious Fowls (all four conditions), Fowls v Fowls, Sack v Sack, and every roster neighbour pair: Flint, Wren, Sprocket, Scuttle |
| Check that the test exercises real play | 84 distinct states and moves in one run, including grabs, throws, hits and KOs |
| Rollback cost | about 0.2 to 0.4 ms per replay, at most 5 frames deep at 120 ms |
| Two copies of the desktop app, this PC, real UDP sockets | 63 of 63 checksums agree, no desync, about 1,890 frames each |
| The **installed** app (silent install from the installer), two copies, real UDP | 63 of 63 agree, no desync. Uninstalled afterwards. |
| The installed app offline | all 17 models load, a CPU match runs, the ONLINE menu offers Direct |

## Not tested yet (and why)

- **Two separate computers, two different internet connections:** I only have this computer, so you and a friend need to run this one. For a same-network test today: both install, pick ONLINE, then Direct. One hosts, the other joins with the code. The corner of the screen shows ping, rollbacks and any desync.
- **EOS** (anonymous login, lobbies, P2P, relay fallback): not built until the SDK and your product settings are in place.
- **Direct over the internet:** it won't work through most home routers without port forwarding, which you ruled out. That's what EOS is for.

## Cost

Nothing has been bought or subscribed to. Electron and electron-builder are free and open source. Epic Online Services Connect, Lobbies and P2P are free. No servers.
