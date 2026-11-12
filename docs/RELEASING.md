# Releasing Emberfall updates

Once this is set up, every installed copy of Emberfall updates itself.

1. When the game starts, it checks for a new version.
2. If there is one, it downloads it in the background.
3. When the download is ready, the player sees **"Restart now"**. If they don't click it, the update installs when they close the game.

It costs nothing. The installers are hosted as GitHub Releases in a small repository of their own that holds **only the installers, never the game's source**.

## How it stays safe

- **Your source stays private.** Only the finished installer goes online. That's the same file you'd hand someone to install the game.
- **Every update is signed with your private key.** The key lives at `%USERPROFILE%\.emberfall-release\update-private.pem`, outside the project, and is never uploaded.
- **The game checks every update before installing it.** It uses the matching public key, `desktop/update-key.pub.pem`, which is built into the game. It installs an update only when both of these hold:
  - the release's `manifest.json` carries a valid signature from your key
  - the downloaded installer matches the size and SHA-256 written in that signed manifest

  Anything else is thrown away. Even someone who got into the GitHub account couldn't push a fake update.
- **The GitHub token never goes into the game.** It's only used on your PC, to upload releases, and lives at `%USERPROFILE%\.emberfall-release\github-token.txt`.
- **Online play is protected from version mismatches.** Players on different versions are told to update instead of getting a broken match.

> **Back up `%USERPROFILE%\.emberfall-release\update-private.pem`**, for example to a USB stick or a password manager. If it's lost, installed copies can't accept any more updates, and everyone would have to reinstall by hand once.

## One-time setup

1. Create a free GitHub account at https://github.com/signup.
2. Create a new repository named `emberfall-releases`, and make it **Public**, so players can download updates without logging in. Leave it empty. Don't upload any game files to it.
3. Create a token that can only upload to that one repository:
   1. Open https://github.com/settings/personal-access-tokens/new.
   2. Under **Repository access**, choose **Only select repositories**, then pick `emberfall-releases`.
   3. Under **Permissions**, set **Contents** to **Read and write**. Leave everything else at **No access**.
   4. Choose an expiry, generate the token, and copy it.
4. Paste the token as the only line of `C:\Users\rober\.emberfall-release\github-token.txt`.
5. In `package.json`, set `"emberfall": { "releaseRepo": "<your GitHub name>/emberfall-releases" }`.
6. Release once (see below), then install that version by hand on each PC. Copies installed before this version have no updater, so this one install has to be manual. Every release after it arrives automatically.

The signing key has already been made, with `node tools/release.js keygen`. Don't run it again: a new key would make existing copies reject your updates.

## Releasing an update

1. Raise `"version"` in `package.json`, for example `1.0.0` → `1.0.1`. Updates only go to copies with a lower version.
2. Run:

   ```
   npm run release -- "What changed in this version"
   ```

   This builds the installer (`npm run dist`), signs it, and uploads the installer, `manifest.json` and `manifest.sig` as release `v<version>`. Each step can also be run separately with `node tools/release.js sign` and `node tools/release.js publish`.

Players get the update the next time they start the game.

## Switches

- **A copy started from the project** (`npm run desktop`) never updates itself. Set `EMBERFALL_UPDATE_TEST=1` to try the updater from there.
- **`EMBERFALL_NO_UPDATE=1`** turns the updater off in an installed copy.
- **Without code signing**, Windows may show "Windows protected your PC" the first time someone installs. The fix is **More info**, then **Run anyway**. Automatic updates afterwards don't show it. Removing that warning needs a paid code-signing certificate, which this setup doesn't require.
