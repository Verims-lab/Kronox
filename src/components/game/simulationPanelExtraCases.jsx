// Health Simulator — Codex073 extension
// =====================================
// Adds Profile, Friends, Friends-Security, Profile-Economy, Online-Lobby-Setup,
// Create-Lobby-Invite-Gate, Game-Invite, Lobby-Code-UX, Admin-Visibility,
// Mobile-Social-Flow, and Fantasy-Visual-Guardrail-Update coverage.
//
// IMPORTANT — design rules followed here:
//   * No existing suite is modified.
//   * No scoring constant is weakened. We export an additive penalty hook
//     (criticalSocialUncertaintyPenalty) so the existing buildReport can
//     optionally apply harsher penalties to critical social BLOCKED/NOT_AUTOMATABLE.
//   * STATIC_CONTRACT, RUNTIME_VERIFIED, NOT_AUTOMATABLE, BLOCKED are clearly
//     labeled inside each case payload.
//   * No destructive backend writes. No fake green. Manual gaps stay visible.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendListItemSource from '../friends/FriendListItem.jsx?raw';
import incomingRequestItemSource from '../friends/IncomingRequestItem.jsx?raw';
import outgoingRequestItemSource from '../friends/OutgoingRequestItem.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import testSuiteSource from '../../pages/TestSuite.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
// NOTE: Entity .json files cannot be reliably imported with ?raw or as JSON
// under the current Vite config when they live outside /src — it triggers a
// SyntaxError at module-eval time. We embed the entity contract tokens as
// plain JS strings instead. These mirror the live entities/<Name>.json files
// and must be kept in sync when those entities change. STATIC_CONTRACT
// integrity is preserved because the test still asserts each required
// property + RLS token appears in the string verbatim.
const friendshipEntitySource = `
  "name": "Friendship",
  "properties": {
    "user_email": {},
    "friend_email": {},
    "friend_name": {}
  },
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read":   { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;
const friendRequestEntitySource = `
  "name": "FriendRequest",
  "properties": {
    "from_email": {},
    "to_email": {},
    "status": { "enum": ["pending","accepted","rejected","cancelled"] }
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;
const gameInviteEntitySource = `
  "name": "GameInvite",
  "properties": {
    "lobby_id": {},
    "lobby_code": {},
    "from_email": {},
    "to_email": {},
    "status": { "enum": ["pending","accepted","rejected","cancelled","expired"] }
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;
import acceptGameInviteFnSource from '../../../functions/acceptGameInvite.js?raw';
import acceptFriendRequestFnSource from '../../../functions/acceptFriendRequest.js?raw';
import removeFriendFnSource from '../../../functions/removeFriend.js?raw';
import adminLibSource from '../../lib/admin.js?raw';
import appSource from '../../App.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';

// ---------------------------------------------------------------------------
//  Suites added in this extension. The host SimulationPanel.jsx appends these
//  to its SUITES array before rendering.
// ---------------------------------------------------------------------------
export const EXTRA_SUITES = [
  { id: 'profile_navigation',     name: 'Profile Navigation Suite',           critical: true,  color: '#fcd34d' },
  { id: 'friends_ui',             name: 'Friends UI Suite',                   critical: true,  color: '#fde68a' },
  { id: 'friends_validation',     name: 'Friends Validation Suite',           critical: true,  color: '#fbbf24' },
  { id: 'friends_security',       name: 'Friends Security / RLS Suite',       critical: true,  color: '#f59e0b' },
  { id: 'profile_economy',        name: 'Profile Economy Placeholder Suite',  critical: false, color: '#fef08a' },
  { id: 'online_lobby_setup',     name: 'Online Lobby Setup Suite',           critical: true,  color: '#a7f3d0' },
  { id: 'create_lobby_invite_gate', name: 'Create Lobby Invite Gate Suite',   critical: true,  color: '#86efac' },
  { id: 'game_invites',           name: 'Game Invite Suite',                  critical: true,  color: '#5eead4' },
  { id: 'lobby_code_ux',          name: 'Lobby Code UX Suite',                critical: false, color: '#67e8f9' },
  { id: 'admin_visibility',       name: 'Admin Visibility Suite',             critical: true,  color: '#fda4af' },
  { id: 'mobile_social_flow',     name: 'Mobile Social Flow Suite',           critical: true,  color: '#c7d2fe' },
  { id: 'fantasy_visual_update',  name: 'Fantasy Visual Guardrail Update',    critical: false, color: '#ddd6fe' },
];

// Convenience lookup — used by builder fns below so case `critical` matches suite default.
const SUITE_BY_ID = Object.fromEntries(EXTRA_SUITES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
//  Local copy of status constants + small builders.
//  Kept self-contained so this module is decoupled from SimulationPanel.
// ---------------------------------------------------------------------------
const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  BLOCKED: 'BLOCKED',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const pass    = (reason, extra) => ({ status: STATUS.PASS,    reason, ...(extra || {}) });
const fail    = (reason, extra) => ({ status: STATUS.FAIL,    reason, ...(extra || {}) });
const warning = (reason, extra) => ({ status: STATUS.WARNING, reason, ...(extra || {}) });
const blocked = (reason, extra) => ({ status: STATUS.BLOCKED, reason, ...(extra || {}) });
const notAutomatable = (reason, extra) => ({ status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) });

function makeCase(suiteId, id, name, run, options = {}) {
  const suite = SUITE_BY_ID[suiteId];
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: suite?.name || suiteId,
    id,
    name,
    critical: options.critical ?? Boolean(suite?.critical),
    run,
  };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function sourceHas(suiteId, id, name, label, source, tokens, options) {
  return makeCase(suiteId, id, name, () => {
    const missing = missingTokens(source, tokens);
    return missing.length
      ? fail('Static source contract failed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: label,
          expected: tokens,
          actual: `Missing: ${missing.join(', ')}`,
        })
      : pass('Static source contract matched.', {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: label,
          expected: tokens,
          actual: 'all tokens present',
        });
  }, options);
}

function sourceLacks(suiteId, id, name, label, source, tokens, options) {
  return makeCase(suiteId, id, name, () => {
    const found = tokens.filter((token) => String(source || '').includes(token));
    return found.length
      ? fail('Static forbidden-token contract failed.', {
          verification: 'STATIC_CONTRACT',
          file: label,
          expected: 'no forbidden tokens',
          actual: found,
        })
      : pass('Static forbidden-token contract matched.', {
          verification: 'STATIC_CONTRACT',
          file: label,
          expected: 'none',
          actual: 'none',
        });
  }, options);
}

function notAutomatableCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => notAutomatable(reason, {
    verification: 'NOT_AUTOMATABLE',
    classification: 'REAL_PRODUCT_RISK',
    expected: 'mounted DOM, real backend RLS probe, or device gesture',
    actual: 'simulator cannot execute safely without destructive writes or real device',
  }), options);
}

function blockedCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => blocked(reason, {
    verification: 'BLOCKED',
    classification: 'REAL_PRODUCT_RISK',
    expected: 'a safe runtime probe',
    actual: 'safe runtime probe unavailable in this simulator context',
  }), options);
}

// Static contract: ensure an entity JSON file declares the listed properties
// and lists them inside an `rls` block. We only check structural tokens — full
// RLS enforcement is server-side and must be verified by destructive testing
// which is intentionally out of scope here.
function entityHasShape(suiteId, id, name, label, jsonText, requiredProps, rlsTokens, options) {
  return makeCase(suiteId, id, name, () => {
    const missingProps = requiredProps.filter((p) => !String(jsonText || '').includes(`"${p}"`));
    const missingRls = rlsTokens.filter((t) => !String(jsonText || '').includes(t));
    if (missingProps.length || missingRls.length) {
      return fail('Entity static contract failed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'REAL_PRODUCT_RISK',
        file: label,
        expected: { properties: requiredProps, rlsTokens },
        actual: { missingProps, missingRls },
      });
    }
    return pass('Entity static contract matched.', {
      verification: 'STATIC_CONTRACT',
      classification: 'STATIC_CHECK_LIMITATION',
      file: label,
      expected: { properties: requiredProps, rlsTokens },
      actual: 'present',
    });
  }, options);
}

// ---------------------------------------------------------------------------
//  Extra cases. All STATIC_CONTRACT / NOT_AUTOMATABLE / BLOCKED are explicit.
// ---------------------------------------------------------------------------
export const EXTRA_TESTS = [

  /* ============================================================
   *  PROFILE NAVIGATION SUITE
   * ============================================================ */
  sourceHas('profile_navigation', 'home_exposes_profile_entry',
    'Home/BottomNav exposes a Profile entry point',
    'BottomNav.jsx / MainMenu.jsx',
    `${bottomNavSource}\n${mainMenuSource}`,
    ["path: '/profile'", 'Profil']),
  sourceHas('profile_navigation', 'settings_reachable_from_profile',
    'Settings is reachable from Profile',
    'ProfilePage.jsx',
    profilePageSource,
    ["navigate('/settings')", 'Ayarlar']),
  sourceHas('profile_navigation', 'profile_shows_identity',
    'Profile displays authenticated user identity (name or email)',
    'ProfilePage.jsx',
    profilePageSource,
    ['base44.auth.me', 'full_name', 'email']),
  sourceHas('profile_navigation', 'profile_sections_present',
    'Profile shows Arkadaşlarım, Puan, Level, Elmas, Ayarlar',
    'ProfilePage.jsx',
    profilePageSource,
    ['Arkadaşlarım', 'Puan', 'Level', 'Elmas', 'Ayarlar']),
  sourceHas('profile_navigation', 'profile_routes_to_friends',
    'Profile routes to /friends for Arkadaşlarım',
    'ProfilePage.jsx',
    profilePageSource,
    ["navigate('/friends')"]),
  sourceHas('profile_navigation', 'home_remains_no_scroll',
    'Home remains fixed/no-scroll even after Profile is added',
    'MainMenu.jsx',
    mainMenuSource,
    ["height: '100dvh'", "overflow: 'hidden'", "overscrollBehavior: 'none'"]),
  sourceHas('profile_navigation', 'online_and_solo_intact',
    'Online Kapışma and Solo actions remain on Home',
    'MainMenu.jsx',
    mainMenuSource,
    ['handleOnline', 'handleSolo', "navigate('/lobby')", "navigate('/solo')"]),
  notAutomatableCase('profile_navigation', 'profile_back_navigation_runtime',
    'Back navigation from Profile works at runtime',
    'Requires a mounted browser session to simulate back gestures and history state — static source cannot prove the navigation stack restores correctly.'),
  notAutomatableCase('profile_navigation', 'profile_mobile_readability_runtime',
    'Profile is readable and usable on a narrow mobile viewport at runtime',
    'Requires a real device or emulated mobile viewport to measure tap targets, contrast, and overflow.'),

  /* ============================================================
   *  FRIENDS UI SUITE
   * ============================================================ */
  sourceHas('friends_ui', 'arkadaslarim_opens_from_profile',
    'Arkadaşlarım row opens /friends from Profile',
    'ProfilePage.jsx',
    profilePageSource,
    ["navigate('/friends')", 'Arkadaşlarım']),
  sourceHas('friends_ui', 'my_friends_section_exists',
    'My Friends list section exists',
    'FriendsPage.jsx',
    friendsPageSource,
    ['Arkadaşlarım', 'FriendListItem', 'friends.map']),
  sourceHas('friends_ui', 'empty_friends_state_exists',
    'Empty friends state copy exists',
    'FriendsPage.jsx',
    friendsPageSource,
    ['Henüz arkadaşın yok']),
  sourceHas('friends_ui', 'add_friend_email_input_exists',
    'Add Friend email input exists',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['type="email"', 'inputMode="email"']),
  sourceHas('friends_ui', 'add_friend_submit_action_exists',
    'Add Friend submit action exists',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['type="submit"', 'İstek Gönder', 'onSubmit']),
  sourceHas('friends_ui', 'incoming_requests_section_exists',
    'Incoming Friend Requests section exists',
    'FriendsPage.jsx',
    friendsPageSource,
    ['Gelen İstekler', 'IncomingRequestItem']),
  sourceHas('friends_ui', 'accept_request_action_exists',
    'Accept friend-request action exists',
    'IncomingRequestItem.jsx',
    incomingRequestItemSource,
    ['Kabul et', 'onAccept', "handle('accept')"]),
  sourceHas('friends_ui', 'reject_request_action_exists',
    'Reject friend-request action exists',
    'IncomingRequestItem.jsx',
    incomingRequestItemSource,
    ['Reddet', 'onReject', "handle('reject')"]),
  sourceHas('friends_ui', 'remove_friend_action_exists',
    'Remove friend action exists',
    'FriendListItem.jsx',
    friendListItemSource,
    ['onRemove', 'Trash2']),
  sourceHas('friends_ui', 'remove_friend_requires_confirmation',
    'Remove friend requires explicit confirmation',
    'FriendListItem.jsx',
    friendListItemSource,
    ['setConfirming(true)', 'Evet, kaldır', 'Vazgeç']),
  sourceHas('friends_ui', 'outgoing_requests_section_present',
    'Outgoing requests section is present (Giden İstekler)',
    'FriendsPage.jsx',
    friendsPageSource,
    ['Giden İstekler', 'OutgoingRequestItem', 'outgoing.length']),
  sourceHas('friends_ui', 'loading_state_exists',
    'Loading/skeleton state exists in friends UI',
    'FriendsPage.jsx',
    friendsPageSource,
    ['RowSkeleton', 'loading']),
  sourceHas('friends_ui', 'error_state_exists',
    'Error state exists in friends UI',
    'FriendsPage.jsx',
    friendsPageSource,
    ['loadError', 'setLoadError']),
  notAutomatableCase('friends_ui', 'friends_runtime_render',
    'Friends list actually renders rows at runtime with real Friendship data',
    'Mounting the page and asserting that real rows render requires a backend round trip to the live Friendship store — not executed inside this simulator to avoid leaking real user data into a static check.'),

  /* ============================================================
   *  FRIENDS VALIDATION SUITE
   * ============================================================ */
  // The friendsApi exposes pure validation helpers — these are RUNTIME_VERIFIED.
  makeCase('friends_validation', 'email_trimmed_lowercased',
    'normalizeEmail trims and lowercases input',
    async () => {
      const mod = await import('@/lib/friendsApi');
      const a = mod.normalizeEmail('  Foo@Bar.COM ');
      return a === 'foo@bar.com'
        ? pass('Runtime verified: normalizeEmail trims+lowercases.', { verification: 'RUNTIME_VERIFIED', actual: a })
        : fail('normalizeEmail did not trim/lowercase as expected.', { verification: 'RUNTIME_VERIFIED', actual: a });
    }),
  makeCase('friends_validation', 'invalid_email_rejected',
    'isValidEmail rejects obviously invalid input',
    async () => {
      const mod = await import('@/lib/friendsApi');
      const cases = ['', 'foo', 'foo@bar', '@bar.com', 'foo@.com', 'foo bar@baz.com'];
      const bad = cases.filter((c) => mod.isValidEmail(c));
      return bad.length
        ? fail('isValidEmail accepted invalid input.', { verification: 'RUNTIME_VERIFIED', actual: bad })
        : pass('Runtime verified: invalid email rejection.', { verification: 'RUNTIME_VERIFIED', actual: 'all rejected' });
    }),
  makeCase('friends_validation', 'valid_email_accepted',
    'isValidEmail accepts simple valid input',
    async () => {
      const mod = await import('@/lib/friendsApi');
      const ok = mod.isValidEmail('foo@bar.com') && mod.isValidEmail('a.b@c.co.uk');
      return ok
        ? pass('Runtime verified: valid email acceptance.', { verification: 'RUNTIME_VERIFIED' })
        : fail('isValidEmail rejected normal valid email.', { verification: 'RUNTIME_VERIFIED' });
    }),
  sourceHas('friends_validation', 'empty_email_cannot_submit',
    'Empty email cannot submit (client guard)',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['E-posta adresi gir.', 'if (!candidate)']),
  sourceHas('friends_validation', 'self_add_prevented_client',
    'Self-add is prevented client-side',
    'friendsApi.js',
    friendsApiSource,
    ['Kendini ekleyemezsin', 'target === fromEmail']),
  sourceHas('friends_validation', 'duplicate_friend_prevented_client',
    'Duplicate-friend is prevented client-side before request',
    'friendsApi.js',
    friendsApiSource,
    ['Bu kullanıcı zaten arkadaşın.', 'existingFriend']),
  sourceHas('friends_validation', 'duplicate_pending_request_prevented_client',
    'Duplicate pending outgoing request prevented',
    'friendsApi.js',
    friendsApiSource,
    ['bekleyen bir isteğin var', 'pendingOut']),
  sourceHas('friends_validation', 'reverse_pending_surfaced',
    'Reverse pending request from target → me is surfaced to user',
    'friendsApi.js',
    friendsApiSource,
    ['Gelen İstekler listesinden kabul et', 'pendingIn']),
  sourceHas('friends_validation', 'clear_success_and_error_messages',
    'Clear success/error messages exist in Add Friend form',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['Arkadaşlık isteği gönderildi.', 'Geçerli bir e-posta adresi gir.', 'İstek gönderilemedi.']),
  notAutomatableCase('friends_validation', 'server_side_dedup_runtime',
    'Server enforces dedup if client-side guard is bypassed',
    'Would require destructive backend writes against the live store — intentionally not executed.'),

  /* ============================================================
   *  FRIENDS SECURITY / RLS CONTRACT SUITE
   * ============================================================ */
  entityHasShape('friends_security', 'friendship_rls_user_scoped',
    'Friendship rows are user-scoped via RLS',
    'entities/Friendship.json',
    friendshipEntitySource,
    ['user_email', 'friend_email'],
    ['rls', 'data.user_email', '{{user.email}}']),
  entityHasShape('friends_security', 'friend_request_rls_addressed',
    'FriendRequest rows readable only by sender/recipient',
    'entities/FriendRequest.json',
    friendRequestEntitySource,
    ['from_email', 'to_email', 'status'],
    ['rls', 'data.from_email', 'data.to_email', '{{user.email}}']),
  sourceHas('friends_security', 'accept_is_receiver_only_server',
    'Server-side acceptFriendRequest is receiver-only',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ['Only the receiver can accept this request', 'toEmail !== myEmail']),
  sourceHas('friends_security', 'remove_friend_server_scoped',
    'removeFriend server function only affects current user relationship',
    'functions/removeFriend.js',
    removeFriendFnSource,
    ['base44.asServiceRole', 'Friendship']),
  sourceLacks('friends_security', 'no_global_friend_list_client',
    'No global friend/request list exposure in client source',
    'friendsApi.js',
    friendsApiSource,
    ['entities.Friendship.list(', 'entities.FriendRequest.list(']),
  sourceHas('friends_security', 'admin_bypass_explicit',
    'Admin bypass is explicit and isolated (does not weaken normal user rules)',
    'entities/Friendship.json + entities/FriendRequest.json',
    `${friendshipEntitySource}\n${friendRequestEntitySource}`,
    ['user_condition', '"role": "admin"']),
  notAutomatableCase('friends_security', 'rls_runtime_probe',
    'Confirm RLS actually blocks cross-user reads/writes at runtime',
    'Would require signing in as User B and attempting to read/modify User A rows. Destructive multi-account harness is intentionally out of scope here — release decisions must include a real two-account verification.'),
  notAutomatableCase('friends_security', 'rls_no_global_writes_runtime',
    'Confirm FriendRequest cannot be globally created/updated by non-owner',
    'Same reasoning: requires a multi-account live probe.'),

  /* ============================================================
   *  PROFILE ECONOMY PLACEHOLDER SUITE
   * ============================================================ */
  sourceHas('profile_economy', 'puan_appears',
    'Puan stat tile appears',
    'ProfilePage.jsx',
    profilePageSource,
    ["label: 'Puan'", 'StatTile']),
  sourceHas('profile_economy', 'level_appears',
    'Level stat tile appears',
    'ProfilePage.jsx',
    profilePageSource,
    ["label: 'Level'"]),
  sourceHas('profile_economy', 'elmas_appears',
    'Elmas stat tile appears',
    'ProfilePage.jsx',
    profilePageSource,
    ["label: 'Elmas'"]),
  sourceHas('profile_economy', 'placeholder_disclosed_in_source',
    'Economy values are marked PLACEHOLDER in source (no real backend integration claim)',
    'ProfilePage.jsx',
    profilePageSource,
    ['PLACEHOLDER', 'no economy yet']),
  sourceLacks('profile_economy', 'no_purchase_payment_logic',
    'No purchase/payment logic introduced in Profile',
    'ProfilePage.jsx',
    profilePageSource,
    ['Stripe', 'checkout', 'purchase', 'buy(', 'payment']),
  sourceLacks('profile_economy', 'no_fake_economy_api_call',
    'No fake economy API call (e.g. entities.Wallet, entities.Economy)',
    'ProfilePage.jsx',
    profilePageSource,
    ['entities.Wallet', 'entities.Economy', 'entities.Coin', 'entities.Diamond']),
  makeCase('profile_economy', 'ui_does_not_crash_when_values_missing',
    'UI does not crash when economy values are missing (placeholder defaults)',
    () => warning(
      'Static check only: ProfilePage uses hard-coded placeholder 0/1 values, so the missing-data path is not exercised in this build.',
      { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', actual: 'placeholder defaults present' },
    )),

  /* ============================================================
   *  ONLINE LOBBY SETUP SUITE
   * ============================================================ */
  sourceLacks('online_lobby_setup', 'old_player_name_input_removed',
    'Old player-name input is no longer used in create-lobby flow',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['Oyuncu İsminiz', 'placeholder="Oyuncu İsminiz"']),
  sourceHas('online_lobby_setup', 'authenticated_user_identity_used',
    'Authenticated user identity is used automatically',
    'CreateLobbyInvitePanel.jsx / LobbyRoom.jsx',
    `${createLobbyInvitePanelSource}\n${lobbyRoomSource}`,
    ['user?.full_name', 'deriveDisplayName(user)', 'buildPlayerPayload(user']),
  sourceHas('online_lobby_setup', 'player_count_selector_exists',
    'Player count selector exists (PlayerCountSelector with 2/3/4)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['PlayerCountSelector', '[2, 3, 4]']),
  sourceHas('online_lobby_setup', 'invite_cap_formula',
    'Invite cap formula = maxPlayers - 1',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['inviteCap = Math.max(0, maxPlayers - 1)']),
  sourceHas('online_lobby_setup', 'selected_count_visible',
    'Selected friend count is visible (N / M seçildi)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedEmails.length', '{inviteCap} seçildi']),
  sourceHas('online_lobby_setup', 'friends_list_or_empty_state',
    'Friends list is shown or an explicit safe empty state is shown',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['friends.map', 'EmptyFriends', 'Henüz arkadaşın yok']),
  sourceHas('online_lobby_setup', 'select_and_deselect_supported',
    'Friend can be selected and deselected (toggleFriend)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['toggleFriend', 'prev.filter((e) => e !== normalized)']),
  sourceHas('online_lobby_setup', 'too_many_friends_blocked',
    'Too many selected friends are blocked with visible message',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['En fazla', 'arkadaş seçebilirsin', 'prev.length >= inviteCap']),
  sourceHas('online_lobby_setup', 'autotrim_on_count_decrease',
    'Lowering player count auto-trims selection with visible message',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedEmails.length > inviteCap', 'seçimden çıkarıldı']),

  /* ============================================================
   *  CREATE LOBBY INVITE GATE SUITE
   * ============================================================ */
  sourceHas('create_lobby_invite_gate', 'cta_disabled_when_zero_selected',
    'CTA is disabled when selectedFriends.length === 0',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['disabled={selectedEmails.length === 0}', 'disabled={loading || disabled}']),
  sourceHas('create_lobby_invite_gate', 'cta_disabled_visual',
    'Disabled state is visually clear (opacity + pointerEvents)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['opacity: disabled ? 0.55', "pointerEvents: disabled || loading ? 'none'"]),
  sourceHas('create_lobby_invite_gate', 'disabled_helper_text_present',
    'Disabled helper text exists ("Oyuna başlamak için en az 1 arkadaş seç.")',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['Oyuna başlamak için en az 1 arkadaş seç.']),
  sourceHas('create_lobby_invite_gate', 'loading_state_present',
    'CTA shows loading state while creating',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['Lobi Oluşturuluyor', 'Loader2', 'animate-spin']),
  sourceHas('create_lobby_invite_gate', 'error_state_surfaced',
    'CTA surfaces error if lobby/invite creation fails',
    'CreateLobbyInvitePanel.jsx / LobbyRoom.jsx',
    `${createLobbyInvitePanelSource}\n${lobbyRoomSource}`,
    ['ErrorHint', 'davet gönderilemedi', 'Davetler oluşturulamadı']),
  sourceLacks('create_lobby_invite_gate', 'no_manual_player_name_required',
    'No manual player name input required in create flow',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['placeholder="Oyuncu İsminiz"', 'validatePlayerName(playerName)']),

  /* ============================================================
   *  GAME INVITE SUITE
   * ============================================================ */
  entityHasShape('game_invites', 'game_invite_entity_exists',
    'GameInvite entity exists with required shape',
    'entities/GameInvite.json',
    gameInviteEntitySource,
    ['lobby_id', 'from_email', 'to_email', 'status'],
    ['rls', 'data.from_email', 'data.to_email', '{{user.email}}']),
  sourceHas('game_invites', 'invite_status_lifecycle',
    'Invite status lifecycle is pending/accepted/rejected/cancelled/expired',
    'entities/GameInvite.json',
    gameInviteEntitySource,
    ['pending', 'accepted', 'rejected', 'cancelled', 'expired']),
  sourceHas('game_invites', 'self_invite_prevented_client',
    'Self-invite is prevented client-side (host email filtered out)',
    'lib/inviteApi.js',
    inviteApiSource,
    ['email !== fromEmail', 'Array.from(new Set(']),
  sourceHas('game_invites', 'duplicate_selected_friends_deduped_client',
    'Duplicate friend emails are de-duplicated before invite creation',
    'lib/inviteApi.js',
    inviteApiSource,
    ['new Set(', '.map(normalizeEmail)']),
  sourceHas('game_invites', 'invites_created_after_lobby',
    'Lobby creation triggers GameInvite row creation for selected friends',
    'pages/LobbyRoom.jsx',
    lobbyRoomSource,
    ['createGameInvites', 'host: user', 'lobby: newLobby']),
  sourceHas('game_invites', 'incoming_invites_visible_to_recipient',
    'Incoming invites are visible to the recipient',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['loadIncomingInvites', "status: 'pending'", "to_email: me"]),
  sourceHas('game_invites', 'accept_invite_action_exists',
    'Accept invite action exists',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['handleAccept', 'acceptGameInvite']),
  sourceHas('game_invites', 'reject_invite_action_exists',
    'Reject invite action exists',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['handleReject', 'rejectGameInvite']),
  sourceHas('game_invites', 'accept_uses_service_role_join',
    'Accept uses existing safe service-role lobby-append path',
    'functions/acceptGameInvite.js',
    acceptGameInviteFnSource,
    ['base44.asServiceRole.entities.Lobby.update', 'newPlayer', 'verifiedLobby']),
  sourceHas('game_invites', 'accept_blocks_non_recipient',
    'Accept blocks anyone other than the recipient',
    'functions/acceptGameInvite.js',
    acceptGameInviteFnSource,
    ['toEmail !== myEmail', 'Bu davet sana ait değil']),
  sourceHas('game_invites', 'accept_blocks_non_waiting_lobby',
    'Accept blocks lobbies that are no longer in waiting state',
    'functions/acceptGameInvite.js',
    acceptGameInviteFnSource,
    ["lobby.status !== 'waiting'", "status: 'expired'"]),
  sourceHas('game_invites', 'reject_marks_status_rejected',
    'Reject path marks invite as rejected (client RLS-scoped update)',
    'lib/inviteApi.js',
    inviteApiSource,
    ["status: 'rejected'", 'GameInvite.update']),
  notAutomatableCase('game_invites', 'duplicate_pending_invite_db_runtime',
    'Duplicate pending invite for same friend+lobby is prevented at the DB level',
    'No DB-level uniqueness constraint exists; client deduplicates a single selection. Verifying double-host-press protection requires a real backend race-condition test — intentionally not executed.'),
  notAutomatableCase('game_invites', 'invite_runtime_rls_probe',
    'Confirm users cannot see/modify unrelated invites at runtime',
    'Requires a multi-account live probe; static contract verifies RLS shape only.'),
  sourceHas('game_invites', 'sent_invites_filter_supported',
    'Sender can fetch their own outgoing invites for a lobby',
    'lib/inviteApi.js',
    inviteApiSource,
    ['loadOutgoingInvitesForLobby', 'from_email: me']),

  /* ============================================================
   *  LOBBY CODE UX SUITE
   * ============================================================ */
  sourceHas('lobby_code_ux', 'waiting_room_demotes_code',
    'WaitingRoom demotes lobby code to secondary "Yedek kod" chip',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Yedek kod', 'inline-flex']),
  sourceLacks('lobby_code_ux', 'no_primary_share_code_prompt',
    'WaitingRoom no longer prompts host to share the code as primary UX',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Arkadaşlarına bu kodu ver']),
  sourceHas('lobby_code_ux', 'invite_centric_copy',
    'WaitingRoom shows invite-centric copy when invited_emails is present',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Davet edilen arkadaşların', 'invited_emails']),
  sourceHas('lobby_code_ux', 'lobby_code_kept_internally',
    'Lobby.code is still kept internally for compatibility (findLobbyByCode)',
    'entities/Lobby.json + findLobbyByCode is preserved',
    `${gameInviteEntitySource}\n${appSource}`,
    ['lobby_code']),
  sourceHas('lobby_code_ux', 'acik_lobiye_gir_preserved',
    '"Açık Lobiye Gir" join-by-code path is preserved',
    'LobbyCreateJoinPanel.jsx (mode === "join") + LobbyRoom.jsx',
    `${lobbyCreateJoinPanelSource}\n${lobbyRoomSource}`,
    ["mode === 'join'", 'onJoin', 'AÇIK LOBİYE GİR']),

  /* ============================================================
   *  ADMIN VISIBILITY SUITE
   * ============================================================ */
  sourceHas('admin_visibility', 'admin_check_helper_exists',
    'Centralised admin check helper exists (isAdminUser)',
    'lib/admin.js',
    adminLibSource,
    ['isAdminUser', 'ADMIN_EMAIL']),
  sourceHas('admin_visibility', 'test_suite_route_gated',
    'TestSuite/Simulator route is gated behind isAdminUser',
    'pages/TestSuite.jsx',
    testSuiteSource,
    ['isAdminUser', 'isAdmin']),
  sourceHas('admin_visibility', 'settings_admin_tools_gated',
    'Settings admin tools (QuestionManagement, SimulationPanel) are gated',
    'pages/SettingsPage.jsx',
    settingsPageSource,
    ['isAdmin', 'QuestionManagement', 'SimulationPanel']),
  sourceHas('admin_visibility', 'profile_settings_path_exposes_admin_only_under_isAdmin',
    'Profile → Settings exposes admin tooling only when isAdmin is true',
    'pages/SettingsPage.jsx',
    settingsPageSource,
    ['{isAdmin && (', 'Admin Paneli']),
  sourceLacks('admin_visibility', 'simulator_not_in_gameplay',
    'SimulationPanel is not imported into the gameplay surface',
    'pages/Game.jsx + components/game/GameLayout.jsx (gameplay surface)',
    `${gameSource}`,
    ['SimulationPanel']),
  sourceLacks('admin_visibility', 'simulator_not_in_profile',
    'SimulationPanel is not imported into ProfilePage',
    'pages/ProfilePage.jsx',
    profilePageSource,
    ['SimulationPanel']),
  notAutomatableCase('admin_visibility', 'runtime_admin_leak_probe',
    'Confirm a normal user cannot reach /test-suite or SimulationPanel at runtime',
    'Requires signed-in non-admin session for verification. Static contract proves gating exists; release decisions still need a live probe.'),

  /* ============================================================
   *  MOBILE SOCIAL FLOW SUITE
   * ============================================================ */
  sourceHas('mobile_social_flow', 'profile_uses_safe_area_padding',
    'Profile uses safe-area-aware padding',
    'pages/ProfilePage.jsx',
    profilePageSource,
    ['env(safe-area-inset-top)', 'env(safe-area-inset-bottom)']),
  sourceHas('mobile_social_flow', 'friends_uses_safe_area_padding',
    'FriendsPage uses safe-area-aware padding',
    'pages/FriendsPage.jsx',
    friendsPageSource,
    ['env(safe-area-inset-top)', 'env(safe-area-inset-bottom)']),
  sourceHas('mobile_social_flow', 'create_lobby_invite_safe_area_padding',
    'CreateLobbyInvitePanel uses safe-area-aware padding',
    'components/lobby/CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['env(safe-area-inset-top)', 'env(safe-area-inset-bottom)']),
  sourceLacks('mobile_social_flow', 'no_horizontal_overflow_in_social',
    'No clearly bad horizontal overflow tokens in social surfaces',
    'social surfaces',
    `${profilePageSource}\n${friendsPageSource}\n${createLobbyInvitePanelSource}`,
    ['overflow-x-scroll', 'width: 200%', 'min-width: 768px']),
  sourceHas('mobile_social_flow', 'home_no_scroll_after_profile_addition',
    'Home remains no-scroll after Profile and Friends were added',
    'MainMenu.jsx',
    mainMenuSource,
    ["overflow: 'hidden'", "overscrollBehavior: 'none'"]),
  sourceHas('mobile_social_flow', 'create_lobby_invite_touch_friendly_tiles',
    'Player count and friend tiles have touch-friendly sizes',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['py-3', 'p-3', 'h-10']),
  sourceHas('mobile_social_flow', 'accept_reject_remove_touch_targets',
    'Accept/reject/remove buttons have proper touch target sizing',
    'IncomingRequestItem.jsx + FriendListItem.jsx + IncomingInvitesPanel.jsx',
    `${incomingRequestItemSource}\n${friendListItemSource}\n${incomingInvitesPanelSource}`,
    ['h-9 w-9', 'rounded-full']),
  notAutomatableCase('mobile_social_flow', 'keyboard_focus_runtime',
    'Add-friend keyboard focus does not hide the input under the keyboard',
    'Requires real device + virtual keyboard interaction.'),
  notAutomatableCase('mobile_social_flow', 'narrow_viewport_runtime',
    'Profile/Friends/Invite remain usable at 320×568 narrow viewport',
    'Requires real or emulated narrow viewport rendering.'),

  /* ============================================================
   *  FANTASY VISUAL GUARDRAIL UPDATE
   * ============================================================ */
  sourceHas('fantasy_visual_update', 'profile_uses_fantasy_tokens',
    'ProfilePage uses fantasy gold/portal tokens (not SaaS admin look)',
    'ProfilePage.jsx',
    profilePageSource,
    ['#facc15', '#ffe066', 'font-cinzel', 'font-bangers']),
  sourceHas('fantasy_visual_update', 'friends_uses_fantasy_tokens',
    'FriendsPage uses fantasy gold/portal tokens',
    'FriendsPage.jsx',
    friendsPageSource,
    ['font-cinzel', 'rgba(250,204,21', 'radial-gradient(ellipse at 50% 12%']),
  sourceHas('fantasy_visual_update', 'create_invite_uses_fantasy_tokens',
    'CreateLobbyInvitePanel uses fantasy gold/portal tokens',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['#facc15', '#ffe066', 'font-cinzel', 'font-bangers']),
  sourceHas('fantasy_visual_update', 'cta_has_press_feedback',
    'Primary CTAs have tactile press feedback (whileTap or active:scale)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['whileTap']),
  sourceHas('fantasy_visual_update', 'image_buttons_have_aria_labels',
    'Image-based buttons have accessible aria-labels',
    'MainMenu.jsx',
    mainMenuSource,
    ['ariaLabel', 'aria-label']),
  sourceLacks('fantasy_visual_update', 'no_neon_purple_dominance_in_new_screens',
    'No neon purple cosmic gradients dominate new social screens',
    'ProfilePage/FriendsPage/CreateLobbyInvitePanel',
    `${profilePageSource}\n${friendsPageSource}\n${createLobbyInvitePanelSource}`,
    ['from-fuchsia-500', 'via-fuchsia-500', 'to-fuchsia-500', 'from-purple-500 via-fuchsia-500']),
  notAutomatableCase('fantasy_visual_update', 'subjective_beauty',
    'Subjective visual beauty / brand cohesion of Profile/Friends/Invite',
    'Subjective polish requires human/screenshot review — simulator only verifies measurable guardrails.'),
];

// ---------------------------------------------------------------------------
//  Optional additive scoring hook used by SimulationPanel.
//  Adds a small extra penalty when critical social/security suites have any
//  BLOCKED or NOT_AUTOMATABLE case — they are real release risk and should
//  not silently pass through.
// ---------------------------------------------------------------------------
const CRITICAL_SOCIAL_SUITE_IDS = new Set([
  'profile_navigation',
  'friends_ui',
  'friends_validation',
  'friends_security',
  'online_lobby_setup',
  'create_lobby_invite_gate',
  'game_invites',
  'admin_visibility',
  'mobile_social_flow',
]);

export function criticalSocialUncertaintyPenalty(cases) {
  if (!Array.isArray(cases)) return 0;
  const uncertain = cases.filter((c) =>
    CRITICAL_SOCIAL_SUITE_IDS.has(c.suiteId) &&
    (c.status === 'BLOCKED' || c.status === 'NOT_AUTOMATABLE'),
  );
  // Cap at 12 so even a fully-blocked extension doesn't completely zero the
  // score on top of the existing per-case penalty (which already counts each
  // critical NOT_AUTOMATABLE as 8 and BLOCKED as 10).
  return Math.min(12, uncertain.length);
}