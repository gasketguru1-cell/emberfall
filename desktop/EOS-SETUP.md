# Epic Online Services for Emberfall

Online play over the internet uses Epic Online Services: anonymous device login (no Epic account for players), a lobby that turns the host's code into the host's player id, and peer-to-peer traffic with Epic's free relay when a direct path is blocked. Epic charges nothing for these.

## Status: set up (2026-11-11)

- Epic Developer Portal: organization **Emberfall**, product **Emberfall**, client **Emberfall Game** using the client policy **Emberfall Peer2Peer** (Epic's Peer2Peer template).
- SDK: EOS C SDK **1.19.2.1** (CL 58105819). `desktop/eos.js` is written against its headers.
- On this PC, in `desktop/eos/` (kept out of git):
  - `EOSSDK-Win64-Shipping.dll` from the SDK's `Bin` folder
  - `Include/`, the SDK's headers, for checking the binding against a new SDK version
  - `config.json` with the product, sandbox, deployment and client ids and the client secret

The installer ships the DLL and `config.json` only. The client secret ends up inside the app you give to friends, which is normal for EOS client credentials: the Peer2Peer policy only allows what a game client does.

## Changing the SDK version

The structures in `desktop/eos.js` are copied from the 1.19.2.1 headers, each with the `ApiVersion` it was written for. Before swapping in a newer DLL, put the new `Include/` folder in `desktop/eos/` and compare the structures `desktop/eos.js` uses against it. A mismatch crashes the game instead of failing politely.

## Testing

Two copies on one PC normally share one Epic player id (Epic ties it to the Windows user), so they can't connect to each other. For a test, start the second copy with `EMBERFALL_EOS_NEW_DEVICE=1` and its own `EMBERFALL_EOS_CACHE` folder: it throws the device id away and signs in as a new anonymous player. The desktop self-test does this:

```
EMBERFALL_AUTOVIA=eos EMBERFALL_AUTOTEST=host|join EMBERFALL_AUTOFILE=<folder>
```

`EMBERFALL_EOS_LOG=1` prints Epic's detailed log.

## What stays free

- EOS Connect, Lobbies and P2P (including the relay) cost nothing.
- No server, no subscription, nothing to buy.
- Friends need no Epic account and no Epic launcher.
- No firewall or router changes, and no administrator rights.

## When a connection fails

Each copy writes `online-log.txt` in its data folder (`%APPDATA%\Emberfall` for the installed game; the previous run's is kept as `online-log-previous.txt`). It records sign-in, this network's NAT type, the code lookup, connection requests, whether the connection came up direct or through Epic's relay, why it closed, and the version check. A join that hasn't reached the host after 20 seconds gives up and says why, with the log's location, instead of waiting on "Connecting...".

The menu's own self-test: `EMBERFALL_AUTOTEST=menu-host` on one copy and `menu-join` on the other (same `EMBERFALL_AUTOFILE` folder) host and join through the ONLINE menu and write what the menu showed plus the log to `<folder>/menu-*.json`.
