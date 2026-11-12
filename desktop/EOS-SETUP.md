# Setting up Epic Online Services for Emberfall (free, one time)

Online play over the internet uses Epic Online Services: anonymous device login (no Epic account for players), a private lobby for the invite code, and peer-to-peer traffic with Epic's free relay when a direct path is blocked. Epic charges nothing for these. Only the game's owner does these steps, once. Players never do anything.

## What only you can do (about 15 minutes)

1. Sign in or create a free account at https://dev.epicgames.com/portal and accept the developer terms. This is the one step that needs your sign-in.
2. Create a product (name it Emberfall). The portal makes a Sandbox and a Deployment for it.
3. Go to Product Settings, then Clients:
   - Add a **Client Policy** of type *Peer2Peer*, or a custom policy that allows **Connect**, **Lobbies** and **P2P** without user-required login.
   - Add a **Client** that uses that policy.
4. Go to the SDK download page and download **EOS SDK for C (Windows)**, the latest version.
5. Put the files here:
   - `desktop/eos/EOSSDK-Win64-Shipping.dll`, taken from the SDK's `Bin` folder.
   - The SDK's `Include` folder, copied to `desktop/eos/Include/`. Claude needs this to write the binding against your exact SDK version.
   - `desktop/eos/config.json`:
     ```json
     { "productId": "...", "sandboxId": "...", "deploymentId": "...", "clientId": "...", "clientSecret": "..." }
     ```

`desktop/eos/` is kept out of git, so the client secret stays on your machine. It ends up inside the app you send to friends, which is normal for EOS client credentials: the Peer2Peer policy only allows what the game does.

Then tell Claude it's in place. Claude will write the binding in `desktop/eos.js`, test host and join between two copies, and rebuild the installer.

## What stays free

- EOS Connect, Lobbies and P2P (including the relay) cost nothing.
- No server, no subscription, nothing to buy.
- Friends need no Epic account and no Epic launcher.
- No firewall or router changes, and no administrator rights.
