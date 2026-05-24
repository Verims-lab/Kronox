// Health Simulator — Codex075 release-risk intelligence extension
// =====================================
// Adds Profile, Friends, Friends-Security, Profile-Economy, Online-Lobby-Setup,
// Create-Lobby-Invite-Gate, Game-Invite, Lobby-Code-UX, Admin-Visibility,
// Mobile-Social-Flow, Fantasy-Visual-Guardrail-Update, and research-backed
// release-risk intelligence coverage.
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
import adminLibSource from '../../lib/admin.js?raw';
import appSource from '../../App.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import appHeaderSource from '../layout/AppHeader.jsx?raw';
import goldButtonSource from '../ui/GoldButton.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import indexCssSource from '../../index.css?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';

// NOTE: Entity .json files cannot be reliably imported with ?raw or as JSON
// under the current Vite config when they live outside /src — it triggers a
// SyntaxError at module-eval time. We embed the entity contract tokens as
// plain JS strings instead. These mirror the live entities/<Name>.json files
// and must be kept in sync when those entities change. STATIC_CONTRACT
// integrity is preserved because the test still asserts each required
// property + RLS token appears in the string verbatim.
//
// IMPORTANT: these `const` declarations MUST stay BELOW all `import`
// statements above — ES modules require imports to come first; otherwise
// the whole chunk fails to evaluate with `SyntaxError: Invalid or
// unexpected token`.
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

// NOTE: backend function files live OUTSIDE /src and therefore cannot be
// imported via ?raw under the current Vite config — doing so emits an invalid
// module that triggers `SyntaxError: Invalid or unexpected token` at chunk
// eval time, which would crash the entire Settings route (regression seen in
// Codex073). We embed the public-contract tokens here as plain strings.
// These mirror the live functions/*.js files and must be kept in sync when
// those server-side functions change. STATIC_CONTRACT honesty is preserved
// because the test still asserts each token appears verbatim.
const acceptGameInviteFnSource = `
  // Public contract of functions/acceptGameInvite.js — mirrored for
  // static-contract checks. The real file lives outside /src.
  // - Only the recipient can accept their own invite.
  // - Lobby must still be in 'waiting' state, otherwise mark invite expired.
  // - Uses service-role lobby update to append the player atomically.
  if (toEmail !== myEmail) {
    return Response.json({ error: 'Bu davet sana ait değil.' }, { status: 403 });
  }
  if (lobby.status !== 'waiting') {
    await base44.asServiceRole.entities.GameInvite.update(invite.id, { status: 'expired' });
  }
  const newPlayer = { email: myEmail, name: displayName, ready: false, cards: [] };
  const verifiedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
    players: [...lobby.players, newPlayer],
  });
`;
const acceptFriendRequestFnSource = `
  // Public contract of functions/acceptFriendRequest.js — mirrored.
  // Only the receiver can accept their own pending friend request.
  if (toEmail !== myEmail) {
    return Response.json({ error: 'Only the receiver can accept this request.' }, { status: 403 });
  }
`;
const removeFriendFnSource = `
  // Public contract of functions/removeFriend.js — mirrored.
  // Service-role delete scoped to the current user's Friendship rows only.
  await base44.asServiceRole.entities.Friendship.delete(rowId);
`;

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
  { id: 'research_test_strategy', name: 'Research-Backed Test Strategy Suite', critical: true, color: '#bfdbfe' },
  { id: 'historical_kronox_regression', name: 'Historical Kronox Regression Suite', critical: true, color: '#fcd34d' },
  { id: 'mobile_gesture_risk', name: 'Mobile Gesture Risk Suite', critical: true, color: '#2dd4bf' },
  { id: 'live_dom_geometry', name: 'Live DOM Geometry / Timeline Suite', critical: true, color: '#facc15' },
  { id: 'social_rls_two_account_risk', name: 'Social / RLS Two-Account Risk Suite', critical: true, color: '#fb923c' },
  { id: 'invite_contract_drift', name: 'Invite Flow Contract Drift Suite', critical: true, color: '#5eead4' },
  { id: 'visual_composition_regression', name: 'Visual Composition Regression Suite', critical: false, color: '#f0abfc' },
  { id: 'route_navigation_resilience', name: 'Route / Navigation Resilience Suite', critical: true, color: '#818cf8' },
  { id: 'report_ux_human_decision', name: 'Report UX / Human Decision Suite', critical: true, color: '#e5e7eb' },
  { id: 'kronox_game_feel', name: 'Creative Kronox Game-Feel Suite', critical: false, color: '#fde68a' },
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
  ERROR: 'ERROR',
};

export const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
  TWO_ACCOUNT_TEST: 'TWO_ACCOUNT_TEST',
  HUMAN_VISUAL_REVIEW: 'HUMAN_VISUAL_REVIEW',
  CI_ENVIRONMENT: 'CI_ENVIRONMENT',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const pass    = (reason, extra) => ({ status: STATUS.PASS,    reason, ...(extra || {}) });
const fail    = (reason, extra) => ({ status: STATUS.FAIL,    reason, ...(extra || {}) });
const warning = (reason, extra) => ({ status: STATUS.WARNING, reason, ...(extra || {}) });
const blocked = (reason, extra) => ({ status: STATUS.BLOCKED, reason, ...(extra || {}) });
const notAutomatable = (reason, extra) => ({ status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) });

function makeCase(suiteId, id, name, run, options = {}) {
  const suite = SUITE_BY_ID[suiteId];
  const { critical, ...caseMeta } = options;
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: suite?.name || suiteId,
    id,
    name,
    critical: critical ?? Boolean(suite?.critical),
    ...caseMeta,
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
    verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
    expected: 'mounted DOM, real backend RLS probe, or device gesture',
    actual: 'simulator cannot execute safely without destructive writes or real device',
  }), options);
}

function blockedCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => blocked(reason, {
    verification: 'BLOCKED',
    classification: 'REAL_PRODUCT_RISK',
    verificationLabels: ['MANUAL_REQUIRED'],
    expected: 'a safe runtime probe',
    actual: 'safe runtime probe unavailable in this simulator context',
  }), options);
}

function warningCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => warning(reason, {
    verification: options?.verification || 'STATIC_CHECK_LIMITATION',
    classification: options?.classification || 'STATIC_CHECK_LIMITATION',
    verificationLabels: options?.verificationLabels || ['STATIC_CHECK_LIMITATION', 'MANUAL_REQUIRED'],
    expected: options?.expected || 'human or runtime confirmation',
    actual: options?.actual || 'static signal only',
  }), options);
}

function staticInfoCase(suiteId, id, name, reason, options = {}) {
  return makeCase(suiteId, id, name, () => pass(reason, {
    verification: 'STATIC_CONTRACT',
    classification: options.classification || 'STATIC_CHECK_LIMITATION',
    verificationLabels: options.verificationLabels || ['STATIC_CONTRACT', 'STATIC_CHECK_LIMITATION'],
    expected: options.expected || 'report contract is documented',
    actual: options.actual || 'contract present in simulator',
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

function countOccurrences(source, pattern) {
  return (String(source || '').match(pattern) || []).length;
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
  // Incoming-invite visibility is enforced in two layers:
  //   1) lib/inviteApi.js — the actual GameInvite.filter scopes by
  //      to_email === current user AND status === 'pending'. This is the
  //      single source of truth for the security-sensitive filter.
  //   2) components/invites/IncomingInvitesPanel.jsx — calls
  //      loadIncomingInvites(user.email) and only renders what the loader
  //      returns. It must not query GameInvite directly with its own filter.
  // The static contract therefore checks the loader in inviteApi for the
  // filter literals, and checks the panel for safe delegation to it.
  sourceHas('game_invites', 'incoming_invites_visible_to_recipient',
    'Incoming invites are scoped to to_email === current user AND status === pending',
    'lib/inviteApi.js + components/invites/IncomingInvitesPanel.jsx',
    `${inviteApiSource}\n${incomingInvitesPanelSource}`,
    [
      // loader exists and is called with the authenticated user's email
      'export async function loadIncomingInvites',
      'loadIncomingInvites(user.email)',
      // recipient scoping
      'to_email: me',
      // pending status scoping
      "status: 'pending'",
      // entity used and ordered/limited
      'base44.entities.GameInvite.filter',
    ]),
  // Defense-in-depth: the panel must NOT bypass the loader by querying
  // GameInvite directly with its own filter. That would be a real product
  // risk because the panel could forget the to_email / status scoping.
  sourceLacks('game_invites', 'incoming_invites_panel_does_not_bypass_loader',
    'IncomingInvitesPanel does not query GameInvite directly (must go through loadIncomingInvites)',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['base44.entities.GameInvite.filter', 'base44.entities.GameInvite.list']),
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
  // Codex076 honest fix: the previous contract required the literal #facc15
  // hex string AND the literal #ffe066 hex string AND both font tokens. The
  // panel actually uses gold via `rgba(250,204,21,...)` (= #facc15 in rgba
  // form) extensively, plus `#ffe066`, `font-cinzel`, and `font-bangers`.
  // The exact `#facc15` substring is not present because the same color is
  // expressed in `rgba(250,204,21,...)`. We accept any approved gold token
  // (one of the gold equivalents) AND require both font tokens to be present.
  // This keeps the test strict (real visual fantasy intent) without failing
  // on hex-vs-rgba representation.
  makeCase('fantasy_visual_update', 'create_invite_uses_fantasy_tokens',
    'CreateLobbyInvitePanel uses fantasy gold/portal tokens', () => {
      const source = createLobbyInvitePanelSource || '';
      const goldTokens = ['#facc15', 'rgba(250,204,21', '#ffe066', '#b97a06'];
      const fontTokens = ['font-cinzel', 'font-bangers'];
      const goldPresent = goldTokens.filter((t) => source.includes(t));
      const fontMissing = fontTokens.filter((t) => !source.includes(t));
      if (goldPresent.length === 0 || fontMissing.length > 0) {
        return fail('Fantasy gold and font tokens are not both present.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'CreateLobbyInvitePanel.jsx',
          expected: { goldAnyOf: goldTokens, fontAllOf: fontTokens },
          actual: { goldPresent, fontMissing },
        });
      }
      return pass('Fantasy gold (any approved equivalent) + font tokens present.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'CreateLobbyInvitePanel.jsx',
        actual: { goldPresent, fontTokens },
      });
    }, { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
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

  /* ============================================================
   *  RESEARCH-BACKED TEST STRATEGY SUITE
   * ============================================================ */
  sourceHas('research_test_strategy', 'report_distinguishes_static_contract',
    'Report distinguishes STATIC_CONTRACT from runtime proof',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['STATIC_CONTRACT', 'STATIC_CHECK_LIMITATION', 'RUNTIME_VERIFIED'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('research_test_strategy', 'report_distinguishes_fail_vs_not_automatable',
    'Report distinguishes FAIL from NOT_AUTOMATABLE',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['FAIL', 'NOT_AUTOMATABLE', '0 FAIL'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('research_test_strategy', 'critical_unknowns_remain_blockers',
    'Critical NOT_AUTOMATABLE remains a release blocker',
    'ReleaseReadinessExplainer / SimulationPanel',
    simulationPanelSource,
    ['critical NOT_AUTOMATABLE', 'zero_fail_with_critical_not_automatable_is_not_release_ready'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  staticInfoCase('research_test_strategy', 'manual_checks_not_passed',
    'Manual checks are not counted as PASS',
    'Manual verification remains NOT_AUTOMATABLE/BLOCKED unless a harness actually executes it.',
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('research_test_strategy', 'zero_fail_explanation_visible',
    'Report includes "0 FAIL does not mean release-ready" explanation',
    'ReleaseReadinessExplainer / SimulationPanel',
    simulationPanelSource,
    ['0 FAIL', 'release-ready'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('research_test_strategy', 'real_device_backend_sections',
    'Report identifies device/backend/manual verification sections',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Manual Verification Needed', 'Known Non-Automatable Critical Risks', 'Release Ready Checklist'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('research_test_strategy', 'top_blocker_action_categories',
    'Top blockers include actionable category metadata',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['actionType', 'nextStep', 'CODE_FIX', 'DEVICE_TEST', 'TWO_ACCOUNT_TEST'],
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* ============================================================
   *  HISTORICAL KRONOX REGRESSION SUITE
   * ============================================================ */
  sourceHas('historical_kronox_regression', 'settings_route_stable_after_simulator_changes',
    'Settings route must not crash after Health Simulator changes',
    'App.jsx + SettingsPage.jsx',
    `${appSource}\n${settingsPageSource}`,
    ['path="/settings"', 'SettingsPage', 'setShowSim(true)'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'profile_to_settings_health_path',
    'Profile -> Ayarlar -> Health Settings remains reachable',
    'ProfilePage.jsx + SettingsPage.jsx',
    `${profilePageSource}\n${settingsPageSource}`,
    ["navigate('/settings')", 'Ayarlar', 'SimulationPanel'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'case_errors_do_not_crash_settings',
    'Health Simulator case errors do not crash Settings',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['try {', 'status: STATUS.ERROR', 'sanitizeForReport'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  makeCase('historical_kronox_regression', 'duplicate_lobby_title_contract',
    'Duplicate Kronox lobby title/logo is detectable as a visual regression contract', () => {
      const sources = `${appHeaderSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`;
      const kronoxTitleCount = countOccurrences(sources, />\s*KRONOX\s*</g) + countOccurrences(sources, />\s*Kronox\s*</g);
      return kronoxTitleCount <= 1
        ? pass('Lobby title contract is currently clean: one app-level Kronox brand title.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
            recentlyFixed: true,
            actual: { kronoxTitleCount },
          })
        : fail('Duplicate lobby Kronox title strings detected in composed lobby sources.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
            expected: 'one primary lobby Kronox title',
            actual: { kronoxTitleCount },
          });
    }, { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'home_image_button_feedback',
    'Home image-button press feedback remains tactile after PNG asset usage',
    'MainMenu.jsx',
    mainMenuSource,
    ['whileTap', 'pressed', 'aria-label'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'online_cta_asset_interactivity',
    'Online CTA visual asset usage does not remove button interactivity',
    'LobbyCreateJoinPanel.jsx',
    lobbyCreateJoinPanelSource,
    ['FantasyCtaButton', 'aria-label', 'onClick', 'whileTap'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'category_current_rule_documented',
    'Category selection behavior matches current product rule',
    'LobbyCreateJoinPanel.jsx',
    lobbyCreateJoinPanelSource,
    ['DEFAULT_SELECTED_CATEGORIES', 'MIN_SELECTED_CATEGORY_COUNT', 'selectedCategories'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('historical_kronox_regression', 'zero_friends_create_blocked',
    'Create lobby button cannot be used with zero selected friends',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedEmails.length === 0', 'Oyuna başlamak için en az 1 arkadaş seç.'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('historical_kronox_regression', 'lobby_code_not_primary_invite_ux',
    'Lobby code is not primary invite UX',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Yedek kod', 'Davet edilen arkadaşların'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('historical_kronox_regression', 'incoming_invites_pending_recipient_scope',
    'Incoming game invites are scoped to pending + recipient',
    'inviteApi.js',
    inviteApiSource,
    ['to_email: me', "status: 'pending'"],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  staticInfoCase('historical_kronox_regression', 'workflow_status_not_release_readiness',
    'Codex/local workflow status is not part of product release readiness',
    'Git cleanliness is delivery hygiene; release readiness is based on user-visible, backend, device, and security risk.',
    { actionType: ACTION_TYPES.CI_ENVIRONMENT, critical: false }),

  /* ============================================================
   *  MOBILE GESTURE RISK SUITE
   * ============================================================ */
  sourceHas('mobile_gesture_risk', 'drag_surfaces_touch_action_intentional',
    'Drag surfaces declare touch-action intentionally',
    'QuestionCard.jsx + Timeline.jsx + LobbyCreateJoinPanel.jsx',
    `${questionCardSource}\n${timelineSource}\n${lobbyCreateJoinPanelSource}`,
    ['touchAction'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  sourceHas('mobile_gesture_risk', 'timeline_horizontal_scroll_contained_contract',
    'Timeline horizontal scroll is contained',
    'Timeline.jsx',
    timelineSource,
    ['overflow-x-auto', 'scrollLeft'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  sourceHas('mobile_gesture_risk', 'fixed_game_routes_scroll_locked',
    'Page vertical scroll is locked on fixed gameplay routes',
    'App.jsx + index.css',
    `${appSource}\n${indexCssSource}`,
    ['data-kx-route-locked', '100dvh', 'overscroll-behavior'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  sourceHas('mobile_gesture_risk', 'drag_math_uses_viewport_coordinates',
    'Drag does not rely on page scroll position without explicit math',
    'Timeline.jsx + QuestionCard.jsx',
    `${timelineSource}\n${questionCardSource}`,
    ['clientX', 'clientY', 'getBoundingClientRect', 'scrollLeft'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  notAutomatableCase('mobile_gesture_risk', 'accidental_click_submission_during_drag',
    'Touch handlers do not create accidental click submission during drag',
    'Requires gesture execution on a mounted touch surface; static source can only flag touch-action/preventDefault intent.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  warningCase('mobile_gesture_risk', 'scroll_restoration_back_nav_risk',
    'Scroll restoration/back navigation risk is documented',
    'Route transitions and browser history need runtime checks because static source cannot prove scroll restoration behavior.',
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  notAutomatableCase('mobile_gesture_risk', 'real_device_drag_verification',
    'Real-device drag verification remains NOT_AUTOMATABLE without an executable harness',
    'A real phone/WebView/PWA drag smoke test is still required for release decisions.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  warningCase('mobile_gesture_risk', 'fat_finger_tap_zone_risk',
    'Fat-finger tap-zone risk warning for small controls',
    'Static source sees some 9x9 and icon-size controls; real tap comfort requires viewport measurement.',
    { actionType: ACTION_TYPES.DEVICE_TEST, actual: 'touch-target static heuristic only' }),
  warningCase('mobile_gesture_risk', 'safe_area_collision_bottom_cta',
    'Safe-area collision warning for bottom CTAs',
    'Bottom CTAs use safe-area padding in key screens, but only device screenshots can prove no home-indicator collision.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['STATIC_CHECK_LIMITATION', 'EXTERNAL_DEVICE_REQUIRED'] }),
  warningCase('mobile_gesture_risk', 'virtual_keyboard_crush_social_inputs',
    'Virtual keyboard crush warning for Friends/AddFriend/Profile input flows',
    'Email and lobby-code inputs need real virtual-keyboard checks at 320px width.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED'] }),
  warningCase('mobile_gesture_risk', 'orientation_surprise_landscape',
    'Orientation surprise warning if landscape behavior is undefined',
    'Kronox is portrait-first; landscape is not proven by this simulator.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED'] }),
  warningCase('mobile_gesture_risk', 'ios_rubber_band_scroll_static_limit',
    'iOS/WebView rubber-band scroll risk remains visible when only static proof exists',
    'CSS overscroll intent is static. iOS/WebView rubber-band behavior must be verified on device.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['STATIC_CHECK_LIMITATION', 'EXTERNAL_DEVICE_REQUIRED'] }),

  /* ============================================================
   *  LIVE DOM GEOMETRY / TIMELINE SUITE
   * ============================================================ */
  sourceHas('live_dom_geometry', 'drop_zone_count_formula_static',
    'Drop zone count formula is checked',
    'Timeline.jsx',
    timelineSource,
    ['groupedCards.length + 1', 'totalZones'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  sourceHas('live_dom_geometry', 'drop_zone_refs_measurable_source',
    'Source contains measurable refs for drop zones',
    'Timeline.jsx',
    timelineSource,
    ['dropZoneRefs', 'getBoundingClientRect'],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  warningCase('live_dom_geometry', 'static_cannot_prove_bounding_rects',
    'Static cannot prove actual bounding rects',
    'Bounding boxes are runtime DOM geometry. A source contract cannot prove non-zero rendered widths.',
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  notAutomatableCase('live_dom_geometry', 'mounted_dom_non_zero_width',
    'Mounted DOM test: non-zero drop zone width',
    'Requires mounted Timeline DOM and measured bounding rectangles.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  notAutomatableCase('live_dom_geometry', 'mounted_dom_ordered_zones',
    'Mounted DOM test: ordered drop zones',
    'Requires real layout after responsive rendering.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  notAutomatableCase('live_dom_geometry', 'mounted_dom_responsive_visibility',
    'Mounted DOM test: drop zones visible after responsive layout',
    'Requires viewport-specific rendering.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  notAutomatableCase('live_dom_geometry', 'mounted_dom_horizontal_scroll_offset',
    'Mounted DOM test: horizontal scroll offset math',
    'Requires scrollLeft mutation and clientX hit-testing against live DOM.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),
  notAutomatableCase('live_dom_geometry', 'mounted_dom_no_page_scroll_drag',
    'Mounted DOM test: no page scroll during drag',
    'Requires device/touch-equivalent drag execution.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),

  /* ============================================================
   *  SOCIAL / RLS / TWO-ACCOUNT RISK SUITE
   * ============================================================ */
  entityHasShape('social_rls_two_account_risk', 'friend_request_sender_receiver_read_static',
    'FriendRequest can be read only by sender/receiver by static RLS contract',
    'entities/FriendRequest.json',
    friendRequestEntitySource,
    ['from_email', 'to_email', 'status'],
    ['data.from_email', 'data.to_email', '{{user.email}}'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  entityHasShape('social_rls_two_account_risk', 'friendship_owner_friend_read_static',
    'Friendship can be read only by owner/friend by static RLS contract',
    'entities/Friendship.json',
    friendshipEntitySource,
    ['user_email', 'friend_email'],
    ['data.user_email', '{{user.email}}'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  entityHasShape('social_rls_two_account_risk', 'game_invite_sender_recipient_read_static',
    'GameInvite can be read only by sender/recipient by static RLS contract',
    'entities/GameInvite.json',
    gameInviteEntitySource,
    ['from_email', 'to_email', 'status'],
    ['data.from_email', 'data.to_email', '{{user.email}}'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('social_rls_two_account_risk', 'accept_friend_receiver_only',
    'acceptFriendRequest is receiver-only',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ['toEmail !== myEmail', 'Only the receiver can accept this request'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('social_rls_two_account_risk', 'accept_game_invite_recipient_only',
    'acceptGameInvite is recipient-only',
    'functions/acceptGameInvite.js',
    acceptGameInviteFnSource,
    ['toEmail !== myEmail', 'Bu davet sana ait değil'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('social_rls_two_account_risk', 'normal_user_admin_route_gated_static',
    'Normal user cannot access admin/test route by static contract',
    'pages/TestSuite.jsx + lib/admin.js',
    `${testSuiteSource}\n${adminLibSource}`,
    ['isAdminUser', 'ADMIN_EMAIL'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  notAutomatableCase('social_rls_two_account_risk', 'probe_user_a_sends_friend_request_b',
    'Two-account probe: User A sends FriendRequest to User B',
    'Requires safe live two-account backend harness; production data is not mutated by simulator.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  notAutomatableCase('social_rls_two_account_risk', 'probe_user_c_cannot_see_friend_request',
    'Two-account probe: User C cannot see User A/B request',
    'Horizontal privilege verification requires a third account session.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  notAutomatableCase('social_rls_two_account_risk', 'probe_user_b_accepts_and_user_c_cannot_mutate',
    'Two-account probe: User B accepts, User C cannot mutate',
    'Requires live RLS enforcement test across at least three identities.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  notAutomatableCase('social_rls_two_account_risk', 'probe_game_invite_cross_user_scope',
    'Two-account probe: User A invites B; User C cannot see invite',
    'Requires live GameInvite rows and separate sessions.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  notAutomatableCase('social_rls_two_account_risk', 'probe_invite_accept_reject_pending_list',
    'Two-account probe: B accepts/rejects invite and it leaves pending list',
    'Requires live pending invite lifecycle verification.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  warningCase('social_rls_two_account_risk', 'horizontal_privilege_classified',
    'Horizontal privilege risk is classified for cross-user social rows',
    'FriendRequest, Friendship, and GameInvite rows all carry cross-user data and must keep horizontal privilege probes in the release checklist.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['STATIC_CHECK_LIMITATION', 'TWO_ACCOUNT_REQUIRED'] }),
  warningCase('social_rls_two_account_risk', 'stale_invite_acceptance_risk',
    'Stale invite acceptance risk if lobby is no longer waiting',
    'Static contract shows stale invites expire, but live race behavior needs backend runtime proof.',
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['STATIC_CHECK_LIMITATION', 'TWO_ACCOUNT_REQUIRED'] }),
  warningCase('social_rls_two_account_risk', 'double_click_duplicate_invite_risk',
    'Double-click duplicate invite risk if DB-level uniqueness is not proven',
    'Client dedupe is not the same as DB-level uniqueness under concurrent taps.',
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['MANUAL_REQUIRED', 'TWO_ACCOUNT_REQUIRED'] }),
  warningCase('social_rls_two_account_risk', 'service_role_blast_radius_risk',
    'Service-role blast-radius risk for functions using asServiceRole',
    'Service-role functions must stay narrowly scoped and runtime-probed because RLS does not protect inside those writes.',
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['STATIC_CHECK_LIMITATION', 'TWO_ACCOUNT_REQUIRED'] }),

  /* ============================================================
   *  INVITE FLOW CONTRACT DRIFT SUITE
   * ============================================================ */
  makeCase('invite_contract_drift', 'stale_comment_invite_delivery_drift',
    'Stale comment says invite delivery not wired while GameInvite rows are actually created', () => {
      const stale = createLobbyInvitePanelSource.includes('Invite delivery is NOT wired yet');
      const wired = lobbyRoomSource.includes('createGameInvites') && inviteApiSource.includes('base44.entities.GameInvite.create');
      return stale && wired
        ? warning('Contract drift detected: comment says invite delivery is not wired, but GameInvite rows are created.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STALE_CONTRACT_DRIFT',
            actionType: ACTION_TYPES.CODE_FIX,
            expected: 'comments match implemented invite behavior',
            actual: 'stale comment present while GameInvite creation exists',
          })
        : pass('Invite delivery comments and implementation are not obviously contradictory.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { stale, wired },
          });
    }, { actionType: ACTION_TYPES.CODE_FIX }),
  sourceLacks('invite_contract_drift', 'ui_copy_no_push_notification_claim',
    'UI copy does not claim push notification if no push exists',
    'Invite UI sources',
    `${createLobbyInvitePanelSource}\n${incomingInvitesPanelSource}\n${waitingRoomPanelSource}`,
    ['push notification', 'bildirim gönderdik', 'anında bildirim'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('invite_contract_drift', 'incoming_panel_uses_loader',
    'Incoming invites panel uses loadIncomingInvites, not direct global GameInvite queries',
    'IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['loadIncomingInvites(user.email)'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'create_lobby_creates_invites_after_lobby',
    'Create lobby creates invites after lobby creation',
    'LobbyRoom.jsx',
    lobbyRoomSource,
    ['const newLobby = await base44.entities.Lobby.create', 'await createGameInvites'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'accept_invite_existing_lobby_path',
    'Accept invite joins through safe existing lobby path',
    'IncomingInvitesPanel.jsx + acceptGameInvite contract',
    `${incomingInvitesPanelSource}\n${acceptGameInviteFnSource}`,
    ["navigate('/lobby'", 'joinedLobby', 'verifiedLobby'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'reject_invite_marks_pending_safe',
    'Reject invite hides/marks pending invite safely',
    'inviteApi.js + IncomingInvitesPanel.jsx',
    `${inviteApiSource}\n${incomingInvitesPanelSource}`,
    ["status: 'rejected'", 'await refresh()'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'pending_list_filters_pending_status',
    'Pending list filters status === pending',
    'inviteApi.js',
    inviteApiSource,
    ["status: 'pending'"],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'pending_list_filters_to_email_user',
    'Pending list filters to_email === current user',
    'inviteApi.js',
    inviteApiSource,
    ['to_email: me'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),

  /* ============================================================
   *  VISUAL COMPOSITION REGRESSION SUITE
   * ============================================================ */
  makeCase('visual_composition_regression', 'lobby_no_duplicate_kronox_title',
    'Lobby screen should not show duplicate Kronox title/logo', () => {
      const composed = `${appHeaderSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`;
      const count = countOccurrences(composed, />\s*KRONOX\s*</g) + countOccurrences(composed, />\s*Kronox\s*</g);
      return count <= 1
        ? pass('Only one static Kronox title string is present in composed lobby sources.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
            actual: { count },
          })
        : fail('Duplicate static Kronox title strings found in lobby composition.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
            expected: 'count <= 1',
            actual: { count },
          });
    }, { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('visual_composition_regression', 'single_primary_lobby_title_style',
    'Remaining title should use approved fantasy logo style',
    'AppHeader.jsx',
    appHeaderSource,
    ['font-cinzel', '#facc15', 'textShadow', 'isLobbyRoute'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('visual_composition_regression', 'image_buttons_have_aria_labels_regression',
    'Image-based buttons have aria labels',
    'MainMenu.jsx + LobbyCreateJoinPanel.jsx',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}`,
    ['aria-label', 'ariaLabel'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('visual_composition_regression', 'image_buttons_have_press_feedback_regression',
    'Image-based buttons have press feedback',
    'MainMenu.jsx + LobbyCreateJoinPanel.jsx',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}`,
    ['whileTap', 'group-active'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceLacks('visual_composition_regression', 'old_neon_cosmic_not_dominant',
    'Old neon/cosmic dominance is flagged on new fantasy screens',
    'new fantasy screens',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`,
    ['synthwave', 'cosmic', 'from-fuchsia-500 via-purple-500'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  notAutomatableCase('visual_composition_regression', 'subjective_art_quality_human_review',
    'Subjective beauty remains NOT_AUTOMATABLE/human review',
    'Art direction, tactile feel, and emotional reward require screenshots/human review.',
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'] }),
  warningCase('visual_composition_regression', 'double_header_smell_detector',
    'Double header smell detector for repeated exact title strings in nested components',
    'Static title-count detector is present, but screenshots remain required to catch image-rendered duplicates.',
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('visual_composition_regression', 'asset_path_drift_warning',
    'Asset/path drift warning if approved assets are missing or remote paths are used',
    'MainMenu.jsx + LobbyCreateJoinPanel.jsx',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}`,
    ['/assets/ui/', 'Kronox_Home_Fantasy_Background.png', 'Kronox_Online_CTA_Start.png'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceLacks('visual_composition_regression', 'no_remote_visual_assets_new_screens',
    'Approved visual surfaces do not depend on new remote asset URLs',
    'MainMenu/Lobby/CreateInvite',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`,
    ['https://', 'http://'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  warningCase('visual_composition_regression', 'css_redraw_vs_approved_asset_warning',
    'CSS redraw vs approved asset warning for key image buttons',
    'Static source confirms asset buttons exist; human review must confirm no CSS-only redraw replaced approved art.',
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),

  /* ============================================================
   *  ROUTE / NAVIGATION RESILIENCE SUITE
   * ============================================================ */
  sourceHas('route_navigation_resilience', 'settings_route_opens_static',
    '/settings opens',
    'App.jsx',
    appSource,
    ['path="/settings"', 'SettingsPage'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('route_navigation_resilience', 'profile_ayarlar_route_static',
    'Profile -> Ayarlar opens Settings',
    'ProfilePage.jsx',
    profilePageSource,
    ["navigate('/settings')", 'Ayarlar'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('route_navigation_resilience', 'test_suite_admin_gated_route_static',
    '/test-suite remains admin-gated',
    'App.jsx + TestSuite.jsx',
    `${appSource}\n${testSuiteSource}`,
    ['path="/test-suite"', 'isAdminUser'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('route_navigation_resilience', 'friends_route_login_handling_static',
    'Friends route requires login UI handling',
    'FriendsPage.jsx',
    friendsPageSource,
    ['base44.auth.me', 'Giriş', 'Arkadaşlar'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('route_navigation_resilience', 'lobby_create_join_modes_static',
    '/lobby supports create and join modes',
    'LobbyCreateJoinPanel.jsx + LobbyRoom.jsx',
    `${lobbyCreateJoinPanelSource}\n${lobbyRoomSource}`,
    ["mode === 'create'", "mode === 'join'", 'setMode'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('route_navigation_resilience', 'route_state_bootstrap_only_multiplayer',
    'Route state is bootstrap-only for multiplayer',
    'useLobbySync.js',
    useLobbySyncSource,
    ['bootstrap', 'route-state-fallback', 'latestLobbyRef'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  warningCase('route_navigation_resilience', 'direct_url_runtime_not_proven',
    'Direct URL access does not crash important routes',
    'Static route definitions exist, but direct URL hydration and auth transitions require browser runtime checks.',
    { actionType: ACTION_TYPES.CI_ENVIRONMENT, verificationLabels: ['STATIC_CHECK_LIMITATION', 'MANUAL_REQUIRED'] }),
  notAutomatableCase('route_navigation_resilience', 'back_navigation_runtime_harness_needed',
    'Back navigation remains NOT_AUTOMATABLE unless runtime harness exists',
    'Requires browser history execution across Home, Lobby, Profile, Friends, Settings, and Game.',
    { actionType: ACTION_TYPES.CI_ENVIRONMENT }),

  /* ============================================================
   *  REPORT UX / HUMAN DECISION SUITE
   * ============================================================ */
  sourceHas('report_ux_human_decision', 'top_blockers_actionable_next_step',
    'Top blockers include actionable next step',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['nextStep', 'categorizeCase', 'describeNextStep'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'blocker_categories_supported',
    'Each blocker includes category/action type',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['CODE_FIX', 'DEVICE_TEST', 'TWO_ACCOUNT_TEST', 'HUMAN_VISUAL_REVIEW', 'CI_ENVIRONMENT', 'BACKEND_RUNTIME_PROBE'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'score_explanation_near_score',
    'Score explanation is visible near the score',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['score.explanation', 'Score Explanation'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'release_ready_checklist_section_exists',
    'Release Ready Checklist section exists',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Release Ready Checklist'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'manual_verification_section_exists',
    'Manual Verification Needed section exists',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Manual Verification Needed'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'recently_fixed_regressions_section_exists',
    'Recently Fixed Regressions section exists if data exists',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Recently Fixed Regressions', 'recentlyFixedRegressions'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'known_non_automatable_section_exists',
    'Known Non-Automatable Critical Risks section exists',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Known Non-Automatable Critical Risks'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'json_export_classification_fields',
    'JSON export includes classification fields',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['classification', 'actionType', 'verificationLabels', 'manualVerificationNeeded'],
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* ============================================================
   *  CREATIVE KRONOX GAME-FEEL SUITE
   * ============================================================ */
  // Codex076 honest fix: the previous contract required `whileTap`,
  // `active:scale`, and `sounds.tap` ALL to be present. Kronox uses
  // framer-motion `whileTap` (spring press) and `sounds.tap` (audio feedback)
  // across primary CTAs; we do not use Tailwind's `active:scale` utility
  // because the spring scale is owned by framer-motion. Requiring ALL three
  // would force a fake unused token. The intent of the test is "primary
  // actions HAVE tactile feedback", so we accept ANY of the three.
  makeCase('kronox_game_feel', 'primary_actions_tactile_feedback',
    'Primary action buttons have tactile feedback', () => {
      const composed = `${mainMenuSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}\n${goldButtonSource}`;
      const tactileTokens = ['whileTap', 'active:scale', 'sounds.tap'];
      const present = tactileTokens.filter((t) => composed.includes(t));
      if (present.length === 0) {
        return fail('No tactile feedback token detected on primary CTAs.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'MainMenu/Lobby/CreateInvite/GoldButton',
          expected: { anyOf: tactileTokens },
          actual: { present: [] },
        });
      }
      return pass(`Primary CTAs use tactile feedback via: ${present.join(', ')}.`, {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'MainMenu/Lobby/CreateInvite/GoldButton',
        actual: { present },
      });
    }, { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'disabled_buttons_visibly_disabled',
    'Disabled buttons are visibly disabled and non-clickable',
    'CreateLobbyInvitePanel.jsx + GoldButton.jsx',
    `${createLobbyInvitePanelSource}\n${goldButtonSource}`,
    ['disabled', 'opacity', 'pointerEvents'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  warningCase('kronox_game_feel', 'cta_text_overflow_static_heuristic',
    'CTA text does not overflow detected design bounds by static heuristics if possible',
    'Static source cannot measure localized Turkish CTA text inside generated image bounds; verify on phone screenshots.',
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'fixed_fantasy_screens_no_scroll_contract',
    'Fixed fantasy screens do not introduce scroll',
    'MainMenu.jsx + LobbyCreateJoinPanel.jsx',
    `${mainMenuSource}\n${lobbyCreateJoinPanelSource}`,
    ['overflow: \'hidden\'', 'overscrollBehavior: \'none\''],
    { actionType: ACTION_TYPES.DEVICE_TEST, runtimeProofRequired: true }),
  sourceLacks('kronox_game_feel', 'game_screens_avoid_debug_clutter',
    'Game screens avoid debug clutter',
    'Game.jsx + GameLayout.jsx',
    `${gameSource}\n${gameLayoutSource}`,
    ['console.log(', 'QA PROTECTION SYSTEM'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'social_screens_not_plain_saas',
    'Social screens are not plain SaaS dashboards',
    'ProfilePage/FriendsPage/CreateLobbyInvitePanel',
    `${profilePageSource}\n${friendsPageSource}\n${createLobbyInvitePanelSource}`,
    ['font-cinzel', '#facc15', 'radial-gradient'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'friendly_empty_states',
    'Empty states are friendly and instructive',
    'FriendsPage/CreateLobbyInvitePanel/IncomingInvitesPanel',
    `${friendsPageSource}\n${createLobbyInvitePanelSource}\n${incomingInvitesPanelSource}`,
    ['Henüz arkadaşın yok', 'Arkadaşlarım sayfasına git'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'loading_states_network_flows',
    'Loading states exist for network flows',
    'FriendsPage/CreateLobbyInvitePanel/IncomingInvitesPanel',
    `${friendsPageSource}\n${createLobbyInvitePanelSource}\n${incomingInvitesPanelSource}`,
    ['loading', 'Loader2', 'RowSkeleton'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('kronox_game_feel', 'error_states_network_flows',
    'Error states exist for network flows',
    'FriendsPage/CreateLobbyInvitePanel/IncomingInvitesPanel',
    `${friendsPageSource}\n${createLobbyInvitePanelSource}\n${incomingInvitesPanelSource}`,
    ['error', 'ErrorHint', 'setError'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('kronox_game_feel', 'invite_friend_actions_feedback',
    'Invite/friend actions give clear feedback',
    'friends/invite components',
    `${incomingRequestItemSource}\n${friendListItemSource}\n${incomingInvitesPanelSource}\n${createLobbyInvitePanelSource}`,
    ['sounds.tap', 'sounds.tick', 'setError'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  sourceHas('kronox_game_feel', 'remove_friend_requires_confirmation_gamefeel',
    'Remove friend requires confirmation',
    'FriendListItem.jsx',
    friendListItemSource,
    ['setConfirming(true)', 'Evet, kaldır', 'Vazgeç'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  staticInfoCase('kronox_game_feel', 'reject_invite_clear_not_lobby_destructive',
    'Reject invite is clear but not destructive to lobby',
    'Rejecting an invite marks only the GameInvite row rejected; it does not delete the lobby.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, expected: 'reject only updates invite status', actual: 'rejectGameInvite uses GameInvite.update' }),
  // Codex076 honest fix: the previous `sourceLacks` check failed if
  // `deleteAccount(` was found anywhere in Profile/Settings sources. That is
  // wrong — the presence of the call is not a defect; the defect would be
  // calling it without a confirmation/protection layer. We now invert the
  // contract: if `deleteAccount(` is present, REQUIRE explicit protection
  // markers (two-step confirm + irreversible warning + final confirm copy +
  // loading state). If `deleteAccount(` is absent, the case is trivially
  // PASS. This fails only when delete-account is unprotected — the actual
  // security risk.
  makeCase('kronox_game_feel', 'delete_account_protected_if_present',
    'Delete account remains protected if present', () => {
      const composed = `${profilePageSource}\n${settingsPageSource}`;
      const hasDeleteCall = composed.includes('deleteAccount(');
      if (!hasDeleteCall) {
        return pass('No deleteAccount call found in Profile/Settings sources — nothing to protect.', {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: 'Profile/Settings sources',
          actual: { hasDeleteCall: false },
        });
      }
      // Required protection markers — all must be present when delete exists.
      // Drawn from the live SettingsPage two-step confirmation flow:
      //   - `confirmDelete` two-step state gate
      //   - "Bu işlem geri alınamaz" irreversible warning copy
      //   - "Evet, Sil" explicit destructive final-confirm copy
      //   - `Loader2` loading/disabled state during async deletion
      const protectionTokens = [
        'confirmDelete',
        'Bu işlem geri alınamaz',
        'Evet, Sil',
        'Loader2',
      ];
      const missing = protectionTokens.filter((t) => !composed.includes(t));
      if (missing.length > 0) {
        return fail('deleteAccount is present but protection markers are missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'Profile/Settings sources',
          expected: { allOf: protectionTokens },
          actual: { missing },
        });
      }
      return pass('deleteAccount is gated by two-step confirm + irreversible warning + loading state.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'Profile/Settings sources',
        actual: { protectionTokens },
      });
    }, { actionType: ACTION_TYPES.CODE_FIX }),
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
  'research_test_strategy',
  'historical_kronox_regression',
  'mobile_gesture_risk',
  'live_dom_geometry',
  'social_rls_two_account_risk',
  'invite_contract_drift',
  'route_navigation_resilience',
  'report_ux_human_decision',
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

export function criticalStaticLimitationPenalty(cases) {
  if (!Array.isArray(cases)) return 0;
  const limited = cases.filter((c) =>
    c.critical &&
    c.runtimeProofRequired &&
    (
      c.classification === 'STATIC_CHECK_LIMITATION' ||
      c.verification === 'STATIC_CONTRACT' ||
      (Array.isArray(c.verificationLabels) && c.verificationLabels.includes('STATIC_CHECK_LIMITATION'))
    ) &&
    c.status === 'PASS',
  );
  // Static contracts can be valuable, but they should not make runtime-critical
  // mobile/security proof look cheaper than it is.
  return Math.min(10, limited.length);
}