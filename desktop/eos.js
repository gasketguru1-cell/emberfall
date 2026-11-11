// Epic Online Services transport: anonymous device login (Connect), a private lobby whose code the host shares (Lobbies),
// and game traffic peer to peer with Epic's free relay as fallback (P2P).
//
// NOT ACTIVE YET. It needs two things only the game's owner can get, both free (desktop/EOS-SETUP.md has the exact steps):
//   1. the EOS SDK for Windows (EOSSDK-Win64-Shipping.dll), downloaded from the Epic Developer Portal after signing in;
//   2. the game's product settings from the portal: product id, sandbox id, deployment id, client id and client secret.
// Put the DLL in desktop/eos/ and the settings in desktop/eos/config.json. Until both exist, available() is false, the
// ONLINE menu offers only the direct connection, and nothing here runs.
//
// The calls into the DLL are written against the SDK's own C headers once the SDK is on this machine (the structures change
// between SDK versions, so they are not guessed here). Planned flow, all through the flat C API with koffi:
//   EOS_Initialize -> EOS_Platform_Create -> (every frame) EOS_Platform_Tick
//   Connect: EOS_Connect_CreateDeviceId -> EOS_Connect_Login (EOS_ECT_DEVICEID_ACCESS_TOKEN): an anonymous ProductUserId, no Epic account
//   Host:  EOS_Lobby_CreateLobby (private, 2 members, join by id) -> the lobby id, shortened to a code via a lobby attribute
//   Join:  EOS_Lobby_CreateLobbySearch + attribute "CODE" -> EOS_Lobby_JoinLobby -> the host's ProductUserId
//   Play:  EOS_P2P_SendPacket / EOS_P2P_ReceivePacket on socket "emberfall", unreliable-unordered (the netcode resends),
//          EOS_P2P_SetRelayControl(EOS_RCT_AllowRelays): direct when possible, Epic's relay when not.
const path = require('path'), fs = require('fs');
const DIR = path.join(__dirname, 'eos');
function config() { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')); } catch (e) { return null; } }
exports.available = () => {
  const c = config(); if (!c || !fs.existsSync(path.join(DIR, 'EOSSDK-Win64-Shipping.dll'))) return false;
  return ['productId', 'sandboxId', 'deploymentId', 'clientId', 'clientSecret'].every(k => typeof c[k] === 'string' && c[k].length > 4) && !!exports.bound;
};
exports.bound = false;   /* set true by the binding once it is written against the installed SDK's headers */
exports.wire = () => {};
