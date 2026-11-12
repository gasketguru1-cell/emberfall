// Epic Online Services transport: anonymous device login (Connect), a lobby that turns the host's short code into the
// host's player id (Lobbies), and game traffic peer to peer with Epic's free relay when a direct path is blocked (P2P).
//
// It needs two things from the Epic Developer Portal (desktop/EOS-SETUP.md): the EOS SDK's EOSSDK-Win64-Shipping.dll and
// the product settings in config.json, both in desktop/eos/ (resources/eos/ in the installed app). Without them
// available() is false and the ONLINE menu offers only the direct connection.
//
// Written against the C headers of EOS SDK 1.19.2.1 (CL 58105819). Every structure below is copied from those headers in
// field order, with the ApiVersion each one was written for; a different SDK version may change them, so check the headers
// (desktop/eos/Include) before swapping the DLL. Calls go through koffi; Windows x64 has one calling convention, so
// EOS_CALL (__stdcall) needs nothing special.
//
// Flow:
//   start:  EOS_Initialize -> EOS_Platform_Create -> EOS_Platform_Tick every few milliseconds (callbacks arrive inside it)
//   login:  EOS_Connect_CreateDeviceId (already there is fine) -> EOS_Connect_Login with a device id token; a first login
//           answers EOS_InvalidUser with a continuance token -> EOS_Connect_CreateUser. The result is an anonymous
//           ProductUserId: no Epic account, nothing for the player to do.
//   host:   EOS_Lobby_CreateLobby (2 members, advertised, no presence, no voice) + a public attribute CODE = the host's code
//           -> listen for P2P connection requests on the socket "emberfall" and accept the first one.
//   join:   EOS_Lobby_CreateLobbySearch with CODE = the typed code -> the lobby's owner is the host -> accept the host and
//           send; the first packet asks for the connection.
//   play:   EOS_P2P_SendPacket / ReceivePacket, unreliable and unordered (the netcode sends every input several times).
//           EOS_P2P_SetRelayControl(EOS_RC_AllowRelays): direct when the two machines can reach each other, relayed when not.
// Messages are JSON, as with the direct connection, and the same version check runs first: both copies must be the same
// version of the game, or their matches would drift apart.
const path = require('path'), fs = require('fs');
let app = null; try { app = require('electron').app; } catch (e) { /* plain node (tests) */ }
const DIR = app && app.isPackaged ? path.join(process.resourcesPath, 'eos') : path.join(__dirname, 'eos');
const DLL = path.join(DIR, 'EOSSDK-Win64-Shipping.dll');
function config() { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8')); } catch (e) { return null; } }
exports.available = () => {
  const c = config(); if (!c || !fs.existsSync(DLL)) return false;
  if (!['productId', 'sandboxId', 'deploymentId', 'clientId', 'clientSecret'].every(k => typeof c[k] === 'string' && c[k].length > 4)) return false;
  try { require('koffi'); return true; } catch (e) { return false; }
};

/* ---------- the binding ---------- */
let E = null;   /* the loaded functions and types */
function bind() {
  if (E) return E;
  const koffi = require('koffi'), lib = koffi.load(DLL);
  const H = n => koffi.pointer(n, koffi.opaque());
  const T = {};
  for (const n of ['EOS_HPlatform', 'EOS_HConnect', 'EOS_HLobby', 'EOS_HP2P', 'EOS_HLobbyModification', 'EOS_HLobbySearch', 'EOS_HLobbyDetails', 'EOS_ProductUserId']) T[n] = H(n);
  koffi.alias('EOS_EResult', 'int32_t'); koffi.alias('EOS_Bool', 'int32_t'); koffi.alias('EOS_LobbyId', 'const char *');
  koffi.alias('EOS_ContinuanceToken', 'void *'); koffi.alias('EOS_NotificationId', 'uint64_t');
  /* eos_init.h */
  koffi.struct('EOS_InitializeOptions', { ApiVersion: 'int32_t', AllocateMemoryFunction: 'void *', ReallocateMemoryFunction: 'void *', ReleaseMemoryFunction: 'void *',
    ProductName: 'const char *', ProductVersion: 'const char *', Reserved: 'void *', SystemInitializeOptions: 'void *', OverrideThreadAffinity: 'void *' });
  /* eos_types.h */
  koffi.struct('EOS_Platform_ClientCredentials', { ClientId: 'const char *', ClientSecret: 'const char *' });
  koffi.struct('EOS_Platform_Options', { ApiVersion: 'int32_t', Reserved: 'void *', ProductId: 'const char *', SandboxId: 'const char *', ClientCredentials: 'EOS_Platform_ClientCredentials',
    bIsServer: 'EOS_Bool', EncryptionKey: 'const char *', OverrideCountryCode: 'const char *', OverrideLocaleCode: 'const char *', DeploymentId: 'const char *', Flags: 'uint64_t',
    CacheDirectory: 'const char *', TickBudgetInMilliseconds: 'uint32_t', RTCOptions: 'void *', IntegratedPlatformOptionsContainerHandle: 'void *', SystemSpecificOptions: 'void *',
    TaskNetworkTimeoutSeconds: 'void *' });
  /* eos_logging.h */
  koffi.struct('EOS_LogMessage', { Category: 'const char *', Message: 'const char *', Level: 'int32_t' });
  koffi.proto('void EOS_LogMessageFunc(const EOS_LogMessage *Message)');
  /* eos_connect_types.h */
  koffi.struct('EOS_Connect_Credentials', { ApiVersion: 'int32_t', Token: 'const char *', Type: 'int32_t' });
  koffi.struct('EOS_Connect_UserLoginInfo', { ApiVersion: 'int32_t', DisplayName: 'const char *', NsaIdToken: 'const char *' });
  koffi.struct('EOS_Connect_LoginOptions', { ApiVersion: 'int32_t', Credentials: 'EOS_Connect_Credentials *', UserLoginInfo: 'EOS_Connect_UserLoginInfo *' });
  koffi.struct('EOS_Connect_LoginCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *', LocalUserId: 'EOS_ProductUserId', ContinuanceToken: 'EOS_ContinuanceToken' });
  koffi.struct('EOS_Connect_CreateUserOptions', { ApiVersion: 'int32_t', ContinuanceToken: 'EOS_ContinuanceToken' });
  koffi.struct('EOS_Connect_CreateUserCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *', LocalUserId: 'EOS_ProductUserId' });
  koffi.struct('EOS_Connect_CreateDeviceIdOptions', { ApiVersion: 'int32_t', DeviceModel: 'const char *' });
  koffi.struct('EOS_Connect_CreateDeviceIdCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *' });
  koffi.proto('void EOS_Connect_OnLoginCallback(void *Data)');
  koffi.proto('void EOS_Connect_OnCreateUserCallback(void *Data)');
  koffi.proto('void EOS_Connect_OnCreateDeviceIdCallback(void *Data)');
  koffi.struct('EOS_Connect_DeleteDeviceIdOptions', { ApiVersion: 'int32_t' });
  koffi.struct('EOS_Connect_DeleteDeviceIdCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *' });
  koffi.proto('void EOS_Connect_OnDeleteDeviceIdCallback(void *Data)');
  /* eos_lobby_types.h */
  koffi.struct('EOS_Lobby_CreateLobbyOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', MaxLobbyMembers: 'uint32_t', PermissionLevel: 'int32_t', bPresenceEnabled: 'EOS_Bool',
    bAllowInvites: 'EOS_Bool', BucketId: 'const char *', bDisableHostMigration: 'EOS_Bool', bEnableRTCRoom: 'EOS_Bool', LocalRTCOptions: 'void *', LobbyId: 'const char *', bEnableJoinById: 'EOS_Bool',
    bRejoinAfterKickRequiresInvite: 'EOS_Bool', AllowedPlatformIds: 'void *', AllowedPlatformIdsCount: 'uint32_t', bCrossplayOptOut: 'EOS_Bool', RTCRoomJoinActionType: 'int32_t' });
  koffi.struct('EOS_Lobby_CreateLobbyCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *', LobbyId: 'const char *' });
  koffi.struct('EOS_Lobby_UpdateLobbyModificationOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', LobbyId: 'const char *' });
  koffi.struct('EOS_Lobby_UpdateLobbyOptions', { ApiVersion: 'int32_t', LobbyModificationHandle: 'EOS_HLobbyModification' });
  koffi.struct('EOS_Lobby_UpdateLobbyCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *', LobbyId: 'const char *' });
  koffi.union('EOS_Lobby_AttributeValue', { AsInt64: 'int64_t', AsDouble: 'double', AsBool: 'EOS_Bool', AsUtf8: 'const char *' });
  koffi.struct('EOS_Lobby_AttributeData', { ApiVersion: 'int32_t', Key: 'const char *', Value: 'EOS_Lobby_AttributeValue', ValueType: 'int32_t' });
  koffi.struct('EOS_LobbyModification_AddAttributeOptions', { ApiVersion: 'int32_t', Attribute: 'EOS_Lobby_AttributeData *', Visibility: 'int32_t' });
  koffi.struct('EOS_Lobby_CreateLobbySearchOptions', { ApiVersion: 'int32_t', MaxResults: 'uint32_t' });
  koffi.struct('EOS_LobbySearch_SetParameterOptions', { ApiVersion: 'int32_t', Parameter: 'EOS_Lobby_AttributeData *', ComparisonOp: 'int32_t' });
  koffi.struct('EOS_LobbySearch_FindOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId' });
  koffi.struct('EOS_LobbySearch_FindCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *' });
  koffi.struct('EOS_LobbySearch_GetSearchResultCountOptions', { ApiVersion: 'int32_t' });
  koffi.struct('EOS_LobbySearch_CopySearchResultByIndexOptions', { ApiVersion: 'int32_t', LobbyIndex: 'uint32_t' });
  koffi.struct('EOS_LobbyDetails_GetLobbyOwnerOptions', { ApiVersion: 'int32_t' });
  koffi.struct('EOS_Lobby_DestroyLobbyOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', LobbyId: 'const char *' });
  koffi.struct('EOS_Lobby_DestroyLobbyCallbackInfo', { ResultCode: 'EOS_EResult', ClientData: 'void *', LobbyId: 'const char *' });
  koffi.proto('void EOS_Lobby_OnCreateLobbyCallback(void *Data)');
  koffi.proto('void EOS_Lobby_OnUpdateLobbyCallback(void *Data)');
  koffi.proto('void EOS_LobbySearch_OnFindCallback(void *Data)');
  koffi.proto('void EOS_Lobby_OnDestroyLobbyCallback(void *Data)');
  /* eos_p2p_types.h */
  koffi.struct('EOS_P2P_SocketId', { ApiVersion: 'int32_t', SocketName: koffi.array('char', 33) });
  koffi.struct('EOS_P2P_SendPacketOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', RemoteUserId: 'EOS_ProductUserId', SocketId: 'EOS_P2P_SocketId *', Channel: 'uint8_t',
    DataLengthBytes: 'uint32_t', Data: 'void *', bAllowDelayedDelivery: 'EOS_Bool', Reliability: 'int32_t', bDisableAutoAcceptConnection: 'EOS_Bool' });
  koffi.struct('EOS_P2P_ReceivePacketOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', MaxDataSizeBytes: 'uint32_t', RequestedChannel: 'void *' });
  koffi.struct('EOS_P2P_GetNextReceivedPacketSizeOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', RequestedChannel: 'void *' });
  koffi.struct('EOS_P2P_AcceptConnectionOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', RemoteUserId: 'EOS_ProductUserId', SocketId: 'EOS_P2P_SocketId *' });
  koffi.struct('EOS_P2P_AddNotifyPeerConnectionRequestOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', SocketId: 'EOS_P2P_SocketId *' });
  koffi.struct('EOS_P2P_OnIncomingConnectionRequestInfo', { ClientData: 'void *', LocalUserId: 'EOS_ProductUserId', RemoteUserId: 'EOS_ProductUserId', SocketId: 'void *' });
  koffi.struct('EOS_P2P_SetRelayControlOptions', { ApiVersion: 'int32_t', RelayControl: 'int32_t' });
  koffi.struct('EOS_P2P_CloseConnectionsOptions', { ApiVersion: 'int32_t', LocalUserId: 'EOS_ProductUserId', SocketId: 'EOS_P2P_SocketId *' });
  koffi.proto('void EOS_P2P_OnIncomingConnectionRequestCallback(void *Data)');
  const F = s => lib.func(s);
  E = { koffi, T,
    Initialize: F('EOS_EResult EOS_Initialize(const EOS_InitializeOptions *Options)'),
    PlatformRelease: F('void EOS_Platform_Release(EOS_HPlatform Handle)'),
    Shutdown: F('EOS_EResult EOS_Shutdown()'),
    PlatformCreate: F('EOS_HPlatform EOS_Platform_Create(const EOS_Platform_Options *Options)'),
    Tick: F('void EOS_Platform_Tick(EOS_HPlatform Handle)'),
    GetConnect: F('EOS_HConnect EOS_Platform_GetConnectInterface(EOS_HPlatform Handle)'),
    GetLobby: F('EOS_HLobby EOS_Platform_GetLobbyInterface(EOS_HPlatform Handle)'),
    GetP2P: F('EOS_HP2P EOS_Platform_GetP2PInterface(EOS_HPlatform Handle)'),
    ResultStr: F('const char * EOS_EResult_ToString(EOS_EResult Result)'),
    LogSet: F('EOS_EResult EOS_Logging_SetCallback(EOS_LogMessageFunc *Callback)'),
    LogLevel: F('EOS_EResult EOS_Logging_SetLogLevel(int32_t LogCategory, int32_t LogLevel)'),
    PuidToStr: F('EOS_EResult EOS_ProductUserId_ToString(EOS_ProductUserId AccountId, _Out_ uint8_t *OutBuffer, _Inout_ int32_t *InOutBufferLength)'),
    PuidFromStr: F('EOS_ProductUserId EOS_ProductUserId_FromString(const char *ProductUserIdString)'),
    CreateDeviceId: F('void EOS_Connect_CreateDeviceId(EOS_HConnect Handle, const EOS_Connect_CreateDeviceIdOptions *Options, void *ClientData, EOS_Connect_OnCreateDeviceIdCallback *CompletionDelegate)'),
    DeleteDeviceId: F('void EOS_Connect_DeleteDeviceId(EOS_HConnect Handle, const EOS_Connect_DeleteDeviceIdOptions *Options, void *ClientData, EOS_Connect_OnDeleteDeviceIdCallback *CompletionDelegate)'),
    Login: F('void EOS_Connect_Login(EOS_HConnect Handle, const EOS_Connect_LoginOptions *Options, void *ClientData, EOS_Connect_OnLoginCallback *CompletionDelegate)'),
    CreateUser: F('void EOS_Connect_CreateUser(EOS_HConnect Handle, const EOS_Connect_CreateUserOptions *Options, void *ClientData, EOS_Connect_OnCreateUserCallback *CompletionDelegate)'),
    CreateLobby: F('void EOS_Lobby_CreateLobby(EOS_HLobby Handle, const EOS_Lobby_CreateLobbyOptions *Options, void *ClientData, EOS_Lobby_OnCreateLobbyCallback *CompletionDelegate)'),
    UpdateLobbyModification: F('EOS_EResult EOS_Lobby_UpdateLobbyModification(EOS_HLobby Handle, const EOS_Lobby_UpdateLobbyModificationOptions *Options, _Out_ EOS_HLobbyModification *OutLobbyModificationHandle)'),
    AddAttribute: F('EOS_EResult EOS_LobbyModification_AddAttribute(EOS_HLobbyModification Handle, const EOS_LobbyModification_AddAttributeOptions *Options)'),
    ModRelease: F('void EOS_LobbyModification_Release(EOS_HLobbyModification LobbyModificationHandle)'),
    UpdateLobby: F('void EOS_Lobby_UpdateLobby(EOS_HLobby Handle, const EOS_Lobby_UpdateLobbyOptions *Options, void *ClientData, EOS_Lobby_OnUpdateLobbyCallback *CompletionDelegate)'),
    DestroyLobby: F('void EOS_Lobby_DestroyLobby(EOS_HLobby Handle, const EOS_Lobby_DestroyLobbyOptions *Options, void *ClientData, EOS_Lobby_OnDestroyLobbyCallback *CompletionDelegate)'),
    CreateSearch: F('EOS_EResult EOS_Lobby_CreateLobbySearch(EOS_HLobby Handle, const EOS_Lobby_CreateLobbySearchOptions *Options, _Out_ EOS_HLobbySearch *OutLobbySearchHandle)'),
    SearchSetParam: F('EOS_EResult EOS_LobbySearch_SetParameter(EOS_HLobbySearch Handle, const EOS_LobbySearch_SetParameterOptions *Options)'),
    SearchFind: F('void EOS_LobbySearch_Find(EOS_HLobbySearch Handle, const EOS_LobbySearch_FindOptions *Options, void *ClientData, EOS_LobbySearch_OnFindCallback *CompletionDelegate)'),
    SearchCount: F('uint32_t EOS_LobbySearch_GetSearchResultCount(EOS_HLobbySearch Handle, const EOS_LobbySearch_GetSearchResultCountOptions *Options)'),
    SearchCopy: F('EOS_EResult EOS_LobbySearch_CopySearchResultByIndex(EOS_HLobbySearch Handle, const EOS_LobbySearch_CopySearchResultByIndexOptions *Options, _Out_ EOS_HLobbyDetails *OutLobbyDetailsHandle)'),
    SearchRelease: F('void EOS_LobbySearch_Release(EOS_HLobbySearch LobbySearchHandle)'),
    DetailsOwner: F('EOS_ProductUserId EOS_LobbyDetails_GetLobbyOwner(EOS_HLobbyDetails Handle, const EOS_LobbyDetails_GetLobbyOwnerOptions *Options)'),
    DetailsRelease: F('void EOS_LobbyDetails_Release(EOS_HLobbyDetails LobbyHandle)'),
    SendPacket: F('EOS_EResult EOS_P2P_SendPacket(EOS_HP2P Handle, const EOS_P2P_SendPacketOptions *Options)'),
    NextSize: F('EOS_EResult EOS_P2P_GetNextReceivedPacketSize(EOS_HP2P Handle, const EOS_P2P_GetNextReceivedPacketSizeOptions *Options, _Out_ uint32_t *OutPacketSizeBytes)'),
    ReceivePacket: F('EOS_EResult EOS_P2P_ReceivePacket(EOS_HP2P Handle, const EOS_P2P_ReceivePacketOptions *Options, _Out_ EOS_ProductUserId *OutPeerId, _Out_ EOS_P2P_SocketId *OutSocketId, _Out_ uint8_t *OutChannel, _Out_ uint8_t *OutData, _Out_ uint32_t *OutBytesWritten)'),
    AcceptConnection: F('EOS_EResult EOS_P2P_AcceptConnection(EOS_HP2P Handle, const EOS_P2P_AcceptConnectionOptions *Options)'),
    NotifyRequest: F('EOS_NotificationId EOS_P2P_AddNotifyPeerConnectionRequest(EOS_HP2P Handle, const EOS_P2P_AddNotifyPeerConnectionRequestOptions *Options, void *ClientData, EOS_P2P_OnIncomingConnectionRequestCallback *ConnectionRequestHandler)'),
    SetRelay: F('EOS_EResult EOS_P2P_SetRelayControl(EOS_HP2P Handle, const EOS_P2P_SetRelayControlOptions *Options)'),
    CloseConnections: F('EOS_EResult EOS_P2P_CloseConnections(EOS_HP2P Handle, const EOS_P2P_CloseConnectionsOptions *Options)'),
  };
  return E;
}

/* eos_result.h, eos_common.h, eos_types.h, eos_lobby_types.h, eos_p2p_types.h: the values used here */
const R = { Success: 0, InvalidUser: 3, NotFound: 18, DuplicateNotAllowed: 24 };
const ECT_DEVICEID_ACCESS_TOKEN = 10, AT_STRING = 3, CO_EQUAL = 0, LPL_PUBLICADVERTISED = 0, LAT_PUBLIC = 0, RC_ALLOWRELAYS = 1, PR_UNRELIABLE_UNORDERED = 0;
const PF_DISABLE_OVERLAY = 0x2, PF_DISABLE_SOCIAL_OVERLAY = 0x4, LC_ALL_CATEGORIES = 0x7fffffff, LOG_WARNING = 300, LOG_VERBOSE = 500;
const MAX_PACKET = 1170, SOCKET = { ApiVersion: 1, SocketName: 'emberfall' }, BUCKET = 'emberfall:1';
const B32 = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   /* the same letters as the direct connection's codes and the game's code keypad */

/* ---------- the platform: started on first use, ticked from then on ---------- */
let P = null;   /* { platform, connect, lobby, p2p, user, userStr } */
let starting = null;
const pending = new Map(); let nextCb = 1;   /* completion callbacks, by the number passed as ClientData */
const cbs = {};
function result(code) { try { return bind().ResultStr(code) || String(code); } catch (e) { return String(code); } }
function err(what, code) { const e = new Error(what + ' (' + result(code) + ')'); e.code = code; return e; }
/* one registered native callback per kind; each finds its promise by ClientData */
function cb(kind, info) {
  if (!cbs[kind]) cbs[kind] = E.koffi.register(ptr => {
    try { const d = E.koffi.decode(ptr, info), id = Number(d.ClientData), p = pending.get(id); if (p) { pending.delete(id); p(d); } }
    catch (e) { console.error('[eos] callback', kind, e); }
  }, E.koffi.pointer(E.koffi.type(kind)));
  return cbs[kind];
}
function call(fn, handle, opts, kind, info) {
  return new Promise(res => { const id = nextCb++; pending.set(id, res); fn(handle, opts, BigInt(id), cb(kind, info)); });
}
function puidStr(id) { const buf = Buffer.alloc(64), len = [buf.length]; return E.PuidToStr(id, buf, len) === R.Success ? buf.toString('utf8', 0, Math.max(0, len[0] - 1)) : ''; }

function start() {
  if (starting) return starting;
  starting = (async () => {
    const c = config(); bind();
    const verbose = !!process.env.EMBERFALL_EOS_LOG;
    let r = E.Initialize({ ApiVersion: 5, ProductName: 'Emberfall', ProductVersion: (app && app.getVersion()) || 'dev' });
    if (r !== R.Success && r !== 15 /* EOS_AlreadyConfigured */) throw err('Epic Online Services did not start', r);
    cbs.log = E.koffi.register(ptr => { try { const m = E.koffi.decode(ptr, 'EOS_LogMessage'); console.log('[eos] ' + m.Category + ': ' + m.Message); } catch (e) { /* ignore */ } }, E.koffi.pointer(E.koffi.type('EOS_LogMessageFunc')));
    E.LogSet(cbs.log); E.LogLevel(LC_ALL_CATEGORIES, verbose ? LOG_VERBOSE : LOG_WARNING);
    const cache = process.env.EMBERFALL_EOS_CACHE || path.join(app ? app.getPath('userData') : require('os').tmpdir(), 'eos-cache');   /* a second copy on one computer, for testing, keeps its own */ fs.mkdirSync(cache, { recursive: true });
    const platform = E.PlatformCreate({ ApiVersion: 15, ProductId: c.productId, SandboxId: c.sandboxId, DeploymentId: c.deploymentId,
      ClientCredentials: { ClientId: c.clientId, ClientSecret: c.clientSecret }, bIsServer: 0, Flags: PF_DISABLE_OVERLAY | PF_DISABLE_SOCIAL_OVERLAY, CacheDirectory: cache, TickBudgetInMilliseconds: 0 });
    if (!platform) throw new Error('Epic Online Services did not start (check desktop/eos/config.json)');
    P = { platform, connect: E.GetConnect(platform), lobby: E.GetLobby(platform), p2p: E.GetP2P(platform), user: null, userStr: '' };
    P.timer = setInterval(pump, 4);   /* EOS work and its callbacks happen inside Tick; incoming packets are read here too */
    /* anonymous login with this computer's device id. EMBERFALL_EOS_NEW_DEVICE (tests only) first throws the device id away,
       so a second copy on the same computer signs in as a different player (the first copy stays signed in as it was) */
    if (process.env.EMBERFALL_EOS_NEW_DEVICE) await call(E.DeleteDeviceId, P.connect, { ApiVersion: 1 }, 'EOS_Connect_OnDeleteDeviceIdCallback', 'EOS_Connect_DeleteDeviceIdCallbackInfo');
    const dev =await call(E.CreateDeviceId, P.connect, { ApiVersion: 1, DeviceModel: 'PC' }, 'EOS_Connect_OnCreateDeviceIdCallback', 'EOS_Connect_CreateDeviceIdCallbackInfo');
    if (dev.ResultCode !== R.Success && dev.ResultCode !== R.DuplicateNotAllowed) throw err('Could not make a device id', dev.ResultCode);
    const name = (process.env.EMBERFALL_EOS_NAME || 'Player').slice(0, 32);
    let li = await call(E.Login, P.connect, { ApiVersion: 2, Credentials: { ApiVersion: 1, Token: null, Type: ECT_DEVICEID_ACCESS_TOKEN }, UserLoginInfo: { ApiVersion: 2, DisplayName: name, NsaIdToken: null } },
      'EOS_Connect_OnLoginCallback', 'EOS_Connect_LoginCallbackInfo');
    if (li.ResultCode === R.InvalidUser) {   /* the first time on this computer: make the player */
      const cu = await call(E.CreateUser, P.connect, { ApiVersion: 1, ContinuanceToken: li.ContinuanceToken }, 'EOS_Connect_OnCreateUserCallback', 'EOS_Connect_CreateUserCallbackInfo');
      if (cu.ResultCode !== R.Success) throw err('Could not sign in to Epic Online Services', cu.ResultCode);
      li = { ResultCode: R.Success, LocalUserId: cu.LocalUserId };
    }
    if (li.ResultCode !== R.Success) throw err('Could not sign in to Epic Online Services', li.ResultCode);
    P.user = li.LocalUserId; P.userStr = puidStr(P.user);
    E.SetRelay(P.p2p, { ApiVersion: 1, RelayControl: RC_ALLOWRELAYS });
    /* connection requests from a friend on our socket: accepted when this machine is hosting and has no friend yet */
    E.NotifyRequest(P.p2p, { ApiVersion: 1, LocalUserId: P.user, SocketId: SOCKET }, 0n, cbs.req = E.koffi.register(ptr => {
      try { const d = E.koffi.decode(ptr, 'EOS_P2P_OnIncomingConnectionRequestInfo'), from = puidStr(d.RemoteUserId);
        for (const k of links.values()) if (k.host && (!k.peerStr || k.peerStr === from)) { k.peer = E.PuidFromStr(from); k.peerStr = from; E.AcceptConnection(P.p2p, { ApiVersion: 1, LocalUserId: P.user, RemoteUserId: k.peer, SocketId: SOCKET }); return; }
      } catch (e) { console.error('[eos] request', e); }
    }, E.koffi.pointer(E.koffi.type('EOS_P2P_OnIncomingConnectionRequestCallback'))));
    return P;
  })();
  starting.catch(() => { starting = null; });   /* a failed start (no internet, say) may be tried again */
  return starting;
}

/* ---------- links: one per host or join, like the direct connection's sockets ---------- */
const links = new Map(); let nextLink = 1;
let getWin = () => null, VERSION = '0';
function deliver(k, msg) { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('eos-msg', k.id, msg); }
function sendRaw(k, obj) {
  if (!P || !k.peer) return; const data = Buffer.from(JSON.stringify(obj)); if (data.length > MAX_PACKET) { console.warn('[eos] packet too big', data.length); return; }
  E.SendPacket(P.p2p, { ApiVersion: 3, LocalUserId: P.user, RemoteUserId: k.peer, SocketId: SOCKET, Channel: 0, DataLengthBytes: data.length, Data: data,
    bAllowDelayedDelivery: 1, Reliability: PR_UNRELIABLE_UNORDERED, bDisableAutoAcceptConnection: 0 });
}
/* both copies must be the same version: each sends {__ev: version} until the other's has arrived (as main.js does for UDP) */
function onPacket(k, msg) {
  if (msg && msg.__ev !== undefined) {
    if (k.theirs === null) { k.theirs = String(msg.__ev); clearTimeout(k.oldTimer); sendRaw(k, { __ev: VERSION }); if (k.theirs !== VERSION) mismatch(k.theirs); }
    return;
  }
  if (k.theirs === null) { sendRaw(k, { __ev: VERSION }); if (!k.oldTimer) k.oldTimer = setTimeout(() => { if (k.theirs === null) mismatch('an older version'); }, 4000); return; }
  if (k.theirs !== VERSION) return;
  deliver(k, msg);
}
function mismatch(theirs) { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('version-mismatch', { mine: VERSION, theirs }); }
const rxBuf = Buffer.alloc(MAX_PACKET + 16);
function pump() {
  if (!P) return;
  E.Tick(P.platform);
  if (!P.user) return;
  for (let n = 0; n < 64; n++) {
    const size = [0]; if (E.NextSize(P.p2p, { ApiVersion: 2, LocalUserId: P.user, RequestedChannel: null }, size) !== R.Success) break;
    const peer = [null], sock = {}, ch = [0], got = [0];
    if (E.ReceivePacket(P.p2p, { ApiVersion: 2, LocalUserId: P.user, MaxDataSizeBytes: rxBuf.length, RequestedChannel: null }, peer, sock, ch, rxBuf, got) !== R.Success) break;
    if (sock.SocketName !== SOCKET.SocketName) continue;
    let msg; try { msg = JSON.parse(rxBuf.toString('utf8', 0, got[0])); } catch (e) { continue; }
    const from = puidStr(peer[0]);
    for (const k of links.values()) if (k.peerStr === from) { onPacket(k, msg); break; }
  }
}
function newCode() { let s = ''; const r = require('crypto').randomBytes(10); for (let i = 0; i < 10; i++) s += B32[r[i] & 31]; return s; }
const show = c => c.slice(0, 5) + '-' + c.slice(5);

async function host() {
  await start();
  const code = newCode();
  const cl = await call(E.CreateLobby, P.lobby, { ApiVersion: 10, LocalUserId: P.user, MaxLobbyMembers: 2, PermissionLevel: LPL_PUBLICADVERTISED, bPresenceEnabled: 0, bAllowInvites: 0,
    BucketId: BUCKET, bDisableHostMigration: 1, bEnableRTCRoom: 0, LocalRTCOptions: null, LobbyId: null, bEnableJoinById: 0, bRejoinAfterKickRequiresInvite: 0, AllowedPlatformIds: null,
    AllowedPlatformIdsCount: 0, bCrossplayOptOut: 0, RTCRoomJoinActionType: 0 }, 'EOS_Lobby_OnCreateLobbyCallback', 'EOS_Lobby_CreateLobbyCallbackInfo');
  if (cl.ResultCode !== R.Success) throw err('Could not open a match', cl.ResultCode);
  const lobbyId = cl.LobbyId, mod = [null];
  let r = E.UpdateLobbyModification(P.lobby, { ApiVersion: 1, LocalUserId: P.user, LobbyId: lobbyId }, mod);
  if (r !== R.Success) throw err('Could not set the match code', r);
  r = E.AddAttribute(mod[0], { ApiVersion: 2, Attribute: { ApiVersion: 1, Key: 'CODE', Value: { AsUtf8: code }, ValueType: AT_STRING }, Visibility: LAT_PUBLIC });
  if (r !== R.Success) { E.ModRelease(mod[0]); throw err('Could not set the match code', r); }
  const up = await call(E.UpdateLobby, P.lobby, { ApiVersion: 1, LobbyModificationHandle: mod[0] }, 'EOS_Lobby_OnUpdateLobbyCallback', 'EOS_Lobby_UpdateLobbyCallbackInfo');
  E.ModRelease(mod[0]);
  if (up.ResultCode !== R.Success) throw err('Could not set the match code', up.ResultCode);
  const id = nextLink++; links.set(id, { id, host: true, lobbyId, peer: null, peerStr: '', theirs: null, oldTimer: null });
  return { id, code: show(code) };
}
async function join(typed) {
  const code = String(typed || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (code.length !== 10 || [...code].some(ch => !B32.includes(ch))) throw new Error('a code is 10 letters and numbers');
  await start();
  const search = [null]; let r = E.CreateSearch(P.lobby, { ApiVersion: 1, MaxResults: 1 }, search);
  if (r !== R.Success) throw err('Could not look for the match', r);
  try {
    r = E.SearchSetParam(search[0], { ApiVersion: 1, Parameter: { ApiVersion: 1, Key: 'CODE', Value: { AsUtf8: code }, ValueType: AT_STRING }, ComparisonOp: CO_EQUAL });
    if (r !== R.Success) throw err('Could not look for the match', r);
    const f = await call(E.SearchFind, search[0], { ApiVersion: 1, LocalUserId: P.user }, 'EOS_LobbySearch_OnFindCallback', 'EOS_LobbySearch_FindCallbackInfo');
    if (f.ResultCode === R.NotFound || (f.ResultCode === R.Success && E.SearchCount(search[0], { ApiVersion: 1 }) === 0)) throw new Error('no match has that code (check it, or ask your friend to host again)');
    if (f.ResultCode !== R.Success) throw err('Could not look for the match', f.ResultCode);
    const det = [null]; r = E.SearchCopy(search[0], { ApiVersion: 1, LobbyIndex: 0 }, det);
    if (r !== R.Success) throw err('Could not read the match', r);
    const owner = puidStr(E.DetailsOwner(det[0], { ApiVersion: 1 })); E.DetailsRelease(det[0]);
    if (!owner) throw new Error('the match has no host');
    if (owner === P.userStr) throw new Error('that is your own match');
    const peer = E.PuidFromStr(owner), id = nextLink++, k = { id, host: false, peer, peerStr: owner, theirs: null, oldTimer: null };
    links.set(id, k);
    E.AcceptConnection(P.p2p, { ApiVersion: 1, LocalUserId: P.user, RemoteUserId: peer, SocketId: SOCKET });
    sendRaw(k, { __ev: VERSION });
    return { id, code: show(code) };
  } finally { E.SearchRelease(search[0]); }
}
function close(id) {
  const k = links.get(id); if (!k) return; links.delete(id); clearTimeout(k.oldTimer);
  if (!P) return;
  if (k.lobbyId) call(E.DestroyLobby, P.lobby, { ApiVersion: 1, LocalUserId: P.user, LobbyId: k.lobbyId }, 'EOS_Lobby_OnDestroyLobbyCallback', 'EOS_Lobby_DestroyLobbyCallbackInfo').catch(() => {});
  if (![...links.values()].length) E.CloseConnections(P.p2p, { ApiVersion: 1, LocalUserId: P.user, SocketId: SOCKET });
}

/* main.js hands over ipcMain and the window; the page reaches this through preload.js */
exports.wire = (ipcMain, win, version) => {
  getWin = win; VERSION = version || (app && app.getVersion()) || '0';
  ipcMain.handle('eos-host', () => host());
  ipcMain.handle('eos-join', (e, code) => join(code));
  ipcMain.on('eos-send', (e, id, msg) => { const k = links.get(id); if (!k || !k.peer) return; if (k.theirs === null) sendRaw(k, { __ev: VERSION }); sendRaw(k, msg); });
  ipcMain.on('eos-close', (e, id) => close(id));
  start().catch(e => console.warn('[eos] not signed in yet:', e.message));   /* sign in early, so hosting is quick */
};
/* on quit: leave lobbies, stop ticking, and release the SDK, so the app can exit */
exports.shutdown = () => {
  if (!P) return; const p = P;
  for (const id of [...links.keys()]) close(id);
  for (let k = 0; k < 20; k++) E.Tick(p.platform);   /* lets the lobby removal go out */
  clearInterval(p.timer); P = null; E.PlatformRelease(p.platform); E.Shutdown();
};
exports._test = { start, host, join, close, links, get P() { return P; }, setWin: w => { getWin = w; }, _send: sendRaw };   /* for tests run with plain node */
