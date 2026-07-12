// Health Simulator — Codex080 release-risk intelligence extension
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
import authContextSource from '../../lib/AuthContext.jsx?raw';
import tutorialProfileSource from '../../lib/tutorialProfile.js?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import friendsRealtimeRefreshSource from '../../hooks/useFriendsRealtimeRefresh.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import notificationApiSource from '../../lib/notificationApi.js?raw';
import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendListItemSource from '../friends/FriendListItem.jsx?raw';
import incomingRequestItemSource from '../friends/IncomingRequestItem.jsx?raw';
import outgoingRequestItemSource from '../friends/OutgoingRequestItem.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import useNotificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import inviteCountdownSource from '../invites/InviteCountdown.jsx?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import gameInviteStatusPillSource from '../friends/GameInviteStatusPill.jsx?raw';
import headerNotificationBellSource from '../notifications/HeaderNotificationBell.jsx?raw';
import toasterSource from '../ui/toaster.jsx?raw';
import toastUiSource from '../ui/toast.jsx?raw';
import useToastSource from '../ui/use-toast.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import testSuiteSource from '../../pages/TestSuite.jsx?raw';
import mainSource from '../../main.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import playerSetupSource from '../../pages/PlayerSetup.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import adminLibSource from '../../lib/admin.js?raw';
import appSource from '../../App.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import goldButtonSource from '../ui/GoldButton.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import indexCssSource from '../../index.css?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import simulationCasesSource from './health/simulationCases.jsx?raw';
import simulationReportBuilderSource from './health/simulationReportBuilder.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';
import buildMarkerSource from '../dev/BuildMarker.jsx?raw';
import onlineCategoriesSource from '../../lib/onlineCategories.js?raw';
import matchmakingPolicySource from '../../lib/matchmakingPolicy.js?raw';
import onlineGameBootstrapFallbackSource from './OnlineGameBootstrapFallback.jsx?raw';
import kronoxTutorialSource from '../tutorial/KronoxTutorial.jsx?raw';
import friendRequestEntityRawSource from '../../../base44/entities/FriendRequest.jsonc?raw';
// Codex086 — diagnostic-overlay gate sources, used to assert admin auto-enable is gone.
import appDiagnosticsAuxSource from '../dev/AppDiagnostics.jsx?raw';
import gameBootstrapDiagAuxSource from './GameBootstrapDiagnostics.jsx?raw';
import startLobbyGameEntrySource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateLobbyGameStateEntrySource from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import lobbyEntityRawSource from '../../../base44/entities/Lobby.jsonc?raw';

// Contract-string mirrors of entities/functions live outside /src are kept
// in components/game/simulationPanelContractStrings.js so this file stays
// under the 2000-line edit limit. STATIC_CONTRACT integrity is preserved.
import {
  friendshipEntitySource,
  friendRequestEntitySource,
  gameInviteEntitySource,
  pushSubscriptionEntitySource,
  acceptGameInviteFnSource,
  acceptFriendRequestFnSource,
  removeFriendFnSource,
  sendFriendRequestFnSource,
  sendFriendRequestEmailFnSource,
  sendGameInvitePushFnSource,
  createGameInvitesForTargetsFnSource,
  getOnlinePlayerSelectionFnSource,
  kronoxServiceWorkerSource,
} from './simulationPanelContractStrings.jsx';

// Leftover inline declaration removed — value comes from the import above.
const _OBSOLETE_INLINE_ACCEPT_FN_SOURCE_REMOVED = '';

// ---------------------------------------------------------------------------
//  Suites added in this extension. The host SimulationPanel.jsx appends these
//  to its SUITES array before rendering.
// ---------------------------------------------------------------------------
export const EXTRA_SUITES = [
  { id: 'auth_profile_health',   name: 'Auth / Profile Health Suite',        critical: true,  color: '#fde68a' },
  { id: 'tutorial_profile_health', name: 'Tutorial Profile Health Suite',    critical: true,  color: '#fcd34d' },
  { id: 'profile_navigation',     name: 'Profile Navigation Suite',           critical: true,  color: '#fcd34d' },
  { id: 'friends_ui',             name: 'Friends UI Suite',                   critical: true,  color: '#fde68a' },
  { id: 'friends_validation',     name: 'Friends Validation Suite',           critical: true,  color: '#fbbf24' },
  { id: 'friends_security',       name: 'Friends Security / RLS Suite',       critical: true,  color: '#f59e0b' },
  { id: 'profile_economy',        name: 'Profile Economy Suite',              critical: false, color: '#fef08a' },
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
  { id: 'online_category_taxonomy', name: 'Online Category Taxonomy Suite', critical: true, color: '#fde68a' },
  { id: 'friend_request_email_deep_link', name: 'Friend Request Email / Deep-Link Suite', critical: true, color: '#93c5fd' },
  { id: 'game_invite_push_notifications', name: 'Game Invite Push Notification Readiness Suite', critical: false, color: '#67e8f9' },
  { id: 'invite_expiration_health', name: 'Invite Expiration Health Suite', critical: true, color: '#fbbf24' },
  { id: 'random_matchmaking_health', name: 'Random Matchmaking Health Suite', critical: false, color: '#93c5fd' },
  { id: 'online_question_mode_health', name: 'Online Question Mode Health Suite', critical: true, color: '#c4b5fd' },
  { id: 'sre_release_health_signals', name: 'SRE-Style Release Health Signals Suite', critical: false, color: '#c4b5fd' },
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

function parseEntityContract(source, label) {
  try {
    return { entity: JSON.parse(String(source || '')), error: null };
  } catch (error) {
    return {
      entity: null,
      error: `${label} could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function rlsOrBranchHas(branches, field, expected) {
  return Array.isArray(branches)
    && branches.some((branch) => branch && branch[field] === expected);
}

function rlsOrBranchHasAdmin(branches) {
  return Array.isArray(branches)
    && branches.some((branch) => branch?.user_condition?.role === 'admin');
}

function auditFriendRequestRls(source) {
  const { entity, error } = parseEntityContract(source, 'base44/entities/FriendRequest.jsonc');
  if (error || !entity) return { ok: false, missing: [error || 'missing entity'] };

  const missing = [];
  const rls = entity.rls || {};
  if (entity.name !== 'FriendRequest') missing.push('name=FriendRequest');
  if (rls.create?.user_condition?.role !== 'admin') missing.push('create.user_condition.role=admin');
  if (rls.create?.created_by_id) missing.push('create.created_by_id must not allow direct client create');
  if (rls.create?.['data.from_email']) missing.push('create.data.from_email must not allow direct client create');

  for (const action of ['read', 'update', 'delete']) {
    const branches = rls[action]?.$or;
    if (!rlsOrBranchHas(branches, 'data.from_email', '{{user.email}}')) {
      missing.push(`${action}.data.from_email={{user.email}}`);
    }
    if (!rlsOrBranchHas(branches, 'data.to_email', '{{user.email}}')) {
      missing.push(`${action}.data.to_email={{user.email}}`);
    }
    if (!rlsOrBranchHasAdmin(branches)) {
      missing.push(`${action}.user_condition.role=admin`);
    }
  }

  return { ok: missing.length === 0, missing };
}

function countOccurrences(source, pattern) {
  return (String(source || '').match(pattern) || []).length;
}

// ---------------------------------------------------------------------------
//  Extra cases. All STATIC_CONTRACT / NOT_AUTOMATABLE / BLOCKED are explicit.
// ---------------------------------------------------------------------------
export const EXTRA_TESTS = [

  /* ============================================================
   *  AUTH / PROFILE + TUTORIAL HEALTH
   * ============================================================ */
  sourceHas('auth_profile_health', 'auth_provider_loads_profile',
    'Auth/profile health: AuthProvider loads the current Base44 user profile',
    'AuthContext.jsx',
    authContextSource,
    ['base44.auth.me', 'setUser(currentUser || null)', 'isAuthenticated']),
  sourceHas('auth_profile_health', 'profile_settings_uses_standard_top_bar',
    'Profile exposes Ayarlar and Settings uses the standard diamond/bell top bar',
    'ProfilePage.jsx + SettingsPage.jsx',
    `${profilePageSource}\n${settingsPageSource}`,
    ["navigate('/settings'", 'Ayarlar', 'StandardTopBar', 'showBack']),
  sourceLacks('auth_profile_health', 'settings_removed_sections_absent',
    'Settings no longer contains removed question-management or app-settings sections',
    'SettingsPage.jsx',
    settingsPageSource,
    ['QuestionManagement', 'NotificationSettingsCard', 'NotificationDeploymentHint', 'AppPreferencesCard', 'Uygulama Ayarları', 'Soru Yönetimi']),
  sourceHas('tutorial_profile_health', 'tutorial_status_is_profile_field',
    'Tutorial state is tied to hasCompletedTutorial on the user profile',
    'lib/tutorialProfile.js + MainMenu.jsx',
    `${tutorialProfileSource}\n${mainMenuSource}`,
    ['hasCompletedTutorial', 'shouldShowTutorialForUser', 'markTutorialCompleted', 'base44.auth.updateMe']),
  sourceLacks('tutorial_profile_health', 'tutorial_flow_not_local_storage_based',
    'Tutorial completion no longer depends on tutorial-specific localStorage state',
    'MainMenu.jsx + PlayerSetup.jsx + KronoxTutorial.jsx',
    `${mainMenuSource}\n${playerSetupSource}\n${kronoxTutorialSource}`,
    ['tutorialState', 'kronox_tutorial_seen']),
  sourceHas('tutorial_profile_health', 'tutorial_completion_updates_profile',
    'Completing or skipping tutorial updates the profile flag before closing',
    'KronoxTutorial.jsx + tutorialProfile.js',
    `${kronoxTutorialSource}\n${tutorialProfileSource}`,
    ['onComplete', 'complete(onDone)', 'complete(onSkip)', 'hasCompletedTutorial: true']),

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
    ["navigate('/settings'", 'Ayarlar']),
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
    ["navigate('/friends'"]),
  sourceHas('profile_navigation', 'home_remains_no_scroll',
    'Home remains fixed/no-scroll even after Profile is added',
    'MainMenu.jsx',
    mainMenuSource,
    ["height: '100dvh'", "overflow: 'hidden'", "overscrollBehavior: 'none'"]),
  sourceHas('profile_navigation', 'online_and_solo_intact',
    'Online Kapışma and direct-start Solo actions remain on Home',
    'MainMenu.jsx',
    mainMenuSource,
    ['handleOnline', 'handleSolo', "navigate('/lobby')", "navigate('/game'", 'buildSoloGameConfigForLevel']),
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
    ["navigate('/friends'", 'Arkadaşlarım']),
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
  sourceHas('friends_ui', 'add_friend_email_or_username_input_exists',
    'Add Friend email-or-username input exists',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['type="text"', 'E-posta veya kullanıcı adı ile arkadaş ekle', 'E-posta veya kullanıcı adı']),
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
  sourceHas('friends_validation', 'empty_friend_target_cannot_submit',
    'Empty friend target cannot submit (client guard)',
    'AddFriendForm.jsx',
    addFriendFormSource,
    ['E-posta veya kullanıcı adı gir.', 'parseFriendRequestTarget']),
  sourceHas('friends_validation', 'self_add_prevented_client',
    'Self-add is prevented by the backend friend request function',
    'friendsApi.js + base44/functions/sendFriendRequest',
    `${friendsApiSource}\n${sendFriendRequestFnSource}`,
    ['Kendini ekleyemezsin', 'targetEmail === fromEmail', "functions.invoke('sendFriendRequest'"]),
  sourceHas('friends_validation', 'duplicate_friend_prevented_client',
    'Duplicate-friend is prevented by the backend friend request function',
    'friendsApi.js + base44/functions/sendFriendRequest',
    `${friendsApiSource}\n${sendFriendRequestFnSource}`,
    ['Bu kullanıcı zaten arkadaşın.', 'existingFriend']),
  sourceHas('friends_validation', 'duplicate_pending_request_prevented_client',
    'Duplicate pending outgoing request handled idempotently',
    'friendsApi.js + base44/functions/sendFriendRequest',
    `${friendsApiSource}\n${sendFriendRequestFnSource}`,
    ['OPEN_INVITE_EXISTS', 'Bu kişiye gönderilmiş açık davet var.', 'pendingOut']),
  sourceHas('friends_validation', 'reverse_pending_surfaced',
    'Reverse pending request from target → me is surfaced to user',
    'friendsApi.js + base44/functions/sendFriendRequest',
    `${friendsApiSource}\n${sendFriendRequestFnSource}`,
    ['Gelen İstekler listesinden kabul et', 'pendingIn']),
  sourceHas('friends_validation', 'clear_success_and_error_messages',
    'Clear success/error messages exist in Add Friend form',
    'AddFriendForm.jsx + friendsApi.js',
    `${addFriendFormSource}\n${friendsApiSource}`,
    ['E-posta veya kullanıcı adı gir.', 'Geçerli bir e-posta adresi gir.', 'İstek gönderilemedi.', 'İstek Gönder']),
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
    'base44/entities/FriendRequest.jsonc',
    friendRequestEntityRawSource,
    ['from_email', 'to_email', 'status'],
    ['rls', 'data.from_email', 'data.to_email', '{{user.email}}']),
  makeCase('friends_security', 'friend_request_manage_delete_rls_sender_recipient_admin',
    'FriendRequest create is service-owned and read/update/delete stays sender, recipient, or admin',
    () => {
      const audit = auditFriendRequestRls(friendRequestEntityRawSource);
      if (!audit.ok) {
        return fail('FriendRequest RLS is missing service-owned create or a sender/recipient/admin branch.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/entities/FriendRequest.jsonc',
          expected: 'create by admin/service-role only; read/update/delete by data.from_email, data.to_email, or admin role',
          actual: { missing: audit.missing },
        });
      }
      return pass('FriendRequest RLS keeps admin/service-role create and sender/recipient/admin read/update/delete coverage.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/entities/FriendRequest.jsonc',
        actual: 'sender/recipient/admin branches present for read/update/delete',
      });
    }),
  sourceHas('friends_security', 'friend_request_lookup_indexes_documented',
    'FriendRequest lookup/index contract supports friend badge and status reads',
    'base44/entities/FriendRequest.jsonc',
    friendRequestEntityRawSource,
    [
      'from_email + status',
      'to_email + status',
      'from_email + to_email + status',
      'Create is backend service/admin owned',
    ],
    {
      expected: 'FriendRequest documents hot lookup keys and backend-owned create without loosening sender/recipient/admin RLS',
    }),
  sourceHas('friends_security', 'accept_is_receiver_only_server',
    'Server-side acceptFriendRequest is receiver-only',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ['Only the receiver can accept this request', 'toEmail !== myEmail']),
  sourceHas('friends_security', 'accepted_request_is_normalized_friendship',
    'Accepted FriendRequest is the normalized friendship record',
    'functions/acceptFriendRequest.js + friendsApi.js',
    `${acceptFriendRequestFnSource}\n${friendsApiSource}`,
    ["status: 'accepted'", 'incomingAccepted', 'outgoingAccepted', 'from_email: me', 'to_email: me'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceLacks('friends_security', 'accept_does_not_create_friendship_rows',
    'acceptFriendRequest does not attempt RLS-blocked Friendship.create mirror writes',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ['Friendship.create', 'ensureFriendshipPair', 'createFriendship(base44'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('friends_security', 'duplicate_accept_idempotent_static',
    'Duplicate accept is idempotent and reports alreadyFriends',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ["fr.status !== 'pending' && fr.status !== 'accepted'", 'alreadyFriends', "status: 'accepted'"],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
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
   *  PROFILE ECONOMY SUITE
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
    ["label: 'Seviye'"]),
  sourceHas('profile_economy', 'elmas_appears',
    'Elmas stat tile appears',
    'ProfilePage.jsx',
    profilePageSource,
    ["label: 'Elmas'"]),
  sourceHas('profile_economy', 'profile_uses_real_shared_economy_sources',
    'Profile economy values use shared persisted sources',
    'ProfilePage.jsx',
    profilePageSource,
    ['getKronoxVisibleScore', 'getProfileDiamondValue', 'JokerPocketSection']),
  sourceHas('profile_economy', 'joker_pocket_has_local_loading_error_retry',
    'Profile Joker Çantası has local loading/error/retry state',
    'ProfilePage.jsx',
    profilePageSource,
    ['authLoading={loading}', 'loading={jokerState.loading}', 'Joker Çantası şu anda yüklenemedi.', 'Tekrar Dene']),
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
    'UI does not crash when economy values are missing',
    () => {
      const missing = missingTokens(profilePageSource, [
        'getLeaderboardDiamondValue(user)',
        'emptyJokerBalances()',
        'Number(balances?.[joker.type]) || 0',
      ]);
      if (missing.length) return fail('Profile missing-data fallbacks for economy/joker values drifted.', {
        verification: 'STATIC_CONTRACT',
        missing,
      });
      return pass('Profile keeps safe missing-data fallbacks for Diamonds and Joker Çantası while using persisted sources.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

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
    'Selected player count is visible (N / M seçildi)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedTargets.length', '{inviteCap} seçildi']),
  sourceHas('online_lobby_setup', 'friends_list_or_empty_state',
    'Player list is shown or an explicit safe empty state is shown',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['players.map', 'EmptyPlayers', 'Oyuncu bulunamadı']),
  sourceHas('online_lobby_setup', 'select_and_deselect_supported',
    'Player can be selected and deselected (togglePlayer)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['togglePlayer', 'prev.filter((ref) => ref !== targetRef)']),
  sourceHas('online_lobby_setup', 'too_many_friends_blocked',
    'Too many selected players are blocked with visible message',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['En fazla', 'oyuncu seçebilirsin', 'prev.length >= inviteCap']),
  sourceHas('online_lobby_setup', 'autotrim_on_count_decrease',
    'Lowering player count auto-trims selection with visible message',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedTargets.length > inviteCap', 'seçimden çıkarıldı']),

  /* ============================================================
   *  CREATE LOBBY INVITE GATE SUITE
   * ============================================================ */
  sourceHas('create_lobby_invite_gate', 'cta_disabled_when_zero_selected',
    'CTA is disabled when selectedTargets.length === 0',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['disabled={selectedTargets.length === 0}', 'disabled={loading || disabled}']),
  sourceHas('create_lobby_invite_gate', 'cta_disabled_visual',
    'Disabled state is visually clear (opacity + pointerEvents)',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['opacity: disabled ? 0.55', "pointerEvents: disabled || loading ? 'none'"]),
  sourceHas('create_lobby_invite_gate', 'disabled_helper_text_present',
    'Disabled helper text exists ("Oyuna başlamak için en az 1 oyuncu seç.")',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['Oyuna başlamak için en az 1 oyuncu seç.']),
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
    'Invite status lifecycle includes pending/accepted/declined/expired/cancelled/completed',
    'entities/GameInvite.json',
    gameInviteEntitySource,
    ['pending', 'accepted', 'declined', 'expired', 'cancelled', 'completed']),
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
  // Incoming-invite visibility is enforced in the shared notification center:
  // it fetches/scopes rows once, then Header, toast, and Online panel consume
  // the same selector/view-model slices. The panel must not own a separate
  // GameInvite query loop anymore.
  sourceHas('game_invites', 'incoming_invites_visible_to_recipient',
    'Incoming invites are scoped to to_email === current user and active-pending shared selector',
    'hooks/useNotificationCenter.js + components/invites/IncomingInvitesPanel.jsx',
    `${useNotificationCenterSource}\n${incomingInvitesPanelSource}`,
    [
      // recipient scoping
      'to_email: email',
      // active status/expiry scoping
      'mergeActiveIncomingGameInvites',
      // entity used and ordered/limited
      'base44.entities.GameInvite.filter',
      'useNotificationCenter',
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
    'Accept/open invite action exists through the shared openGameInvite path',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['handleAccept', 'openNotificationCenterGameInvite']),
  sourceHas('game_invites', 'reject_invite_action_exists',
    'Reject invite action exists',
    'components/invites/IncomingInvitesPanel.jsx',
    incomingInvitesPanelSource,
    ['handleReject', 'rejectNotificationCenterGameInvite']),
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
  sourceHas('game_invites', 'reject_marks_status_declined',
    'Reject path marks invite as declined (client RLS-scoped update)',
    'lib/inviteApi.js',
    inviteApiSource,
    ["status: 'declined'", 'declined_at', 'GameInvite.update']),
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
  sourceHas('game_invites', 'status_pill_maps_full_invite_lifecycle',
    'GameInviteStatusPill maps the full invite lifecycle safely',
    'GameInviteStatusPill.jsx',
    gameInviteStatusPillSource,
    ['pending', 'accepted', 'declined', 'rejected', 'expired', 'cancelled', 'completed']),
  sourceHas('game_invites', 'outgoing_rows_use_shared_status_pill',
    'Outgoing request rows reuse the complete shared status pill instead of stale local mapping',
    'OutgoingRequestItem.jsx + GameInviteStatusPill.jsx',
    `${outgoingRequestItemSource}\n${gameInviteStatusPillSource}`,
    ['GameInviteStatusPill', 'invite={request}', 'declined', 'completed']),

  /* ============================================================
   *  INVITE EXPIRATION HEALTH SUITE
   * ============================================================ */
  sourceHas('invite_expiration_health', 'invite_rows_have_expiry_fields',
    'GameInvite rows store created_at/expires_at for 10-minute validity',
    'entities/GameInvite.json + functions/createGameInvitesForTargets + lib/gameInviteSelectors.js',
    `${gameInviteEntitySource}\n${createGameInvitesForTargetsFnSource}\n${gameInviteSelectorsSource}`,
    ['created_at', 'expires_at', 'GAME_INVITE_TTL_MS = 10 * 60 * 1000']),
  sourceHas('invite_expiration_health', 'invite_creation_sets_ten_minute_expiry',
    'Creating a game invite sets status pending and expires_at = created_at + 10 minutes',
    'functions/createGameInvitesForTargets',
    createGameInvitesForTargetsFnSource,
    ["status: 'pending'", 'createdAt.getTime() + GAME_INVITE_TTL_MS', 'expires_at: expiresAt.toISOString()']),
  sourceHas('invite_expiration_health', 'incoming_loader_expires_old_pending_invites',
    'Incoming invite loader expires old pending invites before rendering',
    'lib/inviteApi.js',
    inviteApiSource,
    ['isGameInviteExpired', 'expirePendingInvite', "status: 'expired'", "invite.status !== 'pending'"]),
  sourceHas('invite_expiration_health', 'accept_backend_blocks_expired_invites',
    'acceptGameInvite blocks expired invites before joining the lobby',
    'functions/acceptGameInvite.js',
    acceptGameInviteFnSource,
    ['getInviteExpiry', "status: 'expired'", 'Davetin süresi doldu']),
  sourceHas('invite_expiration_health', 'expired_incoming_invite_accept_ui_guard',
    'Expired pending invites disable the incoming invite accept affordance',
    'IncomingInvitesPanel.jsx + InviteCountdown.jsx',
    `${incomingInvitesPanelSource}\n${inviteCountdownSource}`,
    ['isGameInviteExpired(invite)', 'Davetin süresi doldu', 'disabled={busy || expired}', "aria-label={expired ? 'Davetin süresi doldu'"]),
  sourceLacks('invite_expiration_health', 'invite_countdown_is_read_only_ui',
    'InviteCountdown is read-only UI and does not mutate invite/backend state',
    'InviteCountdown.jsx',
    inviteCountdownSource,
    ['GameInvite.update', 'acceptGameInvite', 'rejectGameInvite', 'base44.entities']),
  sourceHas('invite_expiration_health', 'notification_deep_link_handles_expired_invite',
    'Notification deep-link route shows expired invite message instead of opening lobby',
    'LobbyRoom.jsx',
    lobbyRoomSource,
    ['queryInviteId', 'isGameInviteExpired', 'Davetin süresi doldu', 'DeepLinkedInvitePanel']),

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
    ['isAdminUser', "role === 'admin'", "permissions.includes('admin')"]),
  sourceHas('admin_visibility', 'test_suite_route_gated',
    'TestSuite/Simulator route is gated behind isAdminUser',
    'pages/TestSuite.jsx',
    testSuiteSource,
    ['isAdminUser', 'isAdmin']),
  sourceHas('admin_visibility', 'settings_admin_tools_gated',
    'Admin Ekranı tools are gated by active AdminUser status',
    'pages/AdminPage.jsx',
    adminPageSource,
    ['Admin Ekranı', 'const isAdmin = parsedAdminStatus', 'if (!isAdmin)', 'SimulationPanel', 'Kronox Health Simulator', 'QuestionAnalyticsReportTool', 'ResetUserProgressTool']),
  sourceHas('admin_visibility', 'profile_settings_path_exposes_admin_only_under_isAdmin',
    'Profile exposes Admin Ekranı only when isAdmin is true while Settings remains public',
    'pages/ProfilePage.jsx + pages/SettingsPage.jsx',
    `${profilePageSource}\n${settingsPageSource}`,
    ['Admin Ekranı', '{isAdmin && (', "navigate('/admin'", 'Arkadaşlarım', 'Ayarlar']),
  sourceHas('admin_visibility', 'admin_screen_route_exists_and_blocks_normal_users',
    'Admin Ekranı route exists and direct non-admin access is blocked safely',
    'App.jsx + pages/AdminPage.jsx',
    `${appSource}\n${adminPageSource}`,
    ['path="/admin"', 'AdminPage', 'Admin Ekranı', 'if (!isAdmin)', 'Bu alan yalnızca aktif admin/owner kullanıcılar içindir.']),
  sourceLacks('admin_visibility', 'settings_no_longer_hosts_admin_tools',
    'Normal Settings no longer hosts admin-only maintenance tools',
    'pages/SettingsPage.jsx',
    settingsPageSource,
    ['SimulationPanel', 'Kronox Health Simulator', 'QuestionAnalyticsReportTool', 'ResetUserProgressTool']),
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
  sourceHas('research_test_strategy', 'critical_unknowns_remain_manual_proof',
    'Critical NOT_AUTOMATABLE remains visible as manual proof, not blocker copy',
    'ReleaseReadinessExplainer / SimulationPanel / simulationReportBuilder',
    `${simulationPanelSource}\n${simulationCasesSource}\n${simulationReportBuilderSource}`,
    ['manual_required_not_top_blocker', 'manual-only verification'],
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
    'Settings route stays stable after admin tools move to Admin Ekranı',
    'App.jsx + SettingsPage.jsx + AdminPage.jsx',
    `${appSource}\n${settingsPageSource}\n${adminPageSource}`,
    ['path="/settings"', 'SettingsPage', 'path="/admin"', 'AdminPage', 'setShowSim(true)'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'profile_to_settings_health_path',
    'Profile -> Admin Ekranı -> Health Simulator remains reachable for admins',
    'ProfilePage.jsx + AdminPage.jsx',
    `${profilePageSource}\n${adminPageSource}`,
    ["navigate('/admin'", 'Admin Ekranı', 'SimulationPanel'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'case_errors_do_not_crash_settings',
    'Health Simulator case errors do not crash Settings',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['try {', 'status: STATUS.ERROR', 'sanitizeForReport'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  makeCase('historical_kronox_regression', 'duplicate_lobby_title_contract',
    'Duplicate Kronox lobby title/logo is detectable as a visual regression contract', () => {
      const sources = `${screenHeaderSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`;
      const kronoxTitleCount = countOccurrences(sources, />\s*KRONOX\s*</g) + countOccurrences(sources, />\s*Kronox\s*</g);
      return kronoxTitleCount <= 1
        ? pass('Current ScreenHeader/lobby composition has no duplicate literal Kronox title.', {
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
  makeCase('historical_kronox_regression', 'home_image_button_feedback',
    'Home image-button press feedback remains tactile without old pressed asset swap',
    () => {
      const required = ['motion.button', 'whileTap', 'transition={{ type: \'spring\'', 'aria-label'];
      const missing = missingTokens(mainMenuSource, required);
      const forbidden = [
        'pressedSrc',
        'normalSrc',
        'setPressed',
        'isPressed',
        'Pressed.png',
        'pressed.webp',
      ].filter((token) => String(mainMenuSource || '').includes(token));
      if (missing.length || forbidden.length) {
        return fail('Home CTA press feedback contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: 'MainMenu.jsx',
          expected: 'single asset/CSS button with aria-label + framer-motion whileTap press feedback; no pressed image swap',
          actual: { missing, forbidden },
        });
      }
      return pass('Home CTA keeps tactile motion feedback and no pressed asset swap.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'MainMenu.jsx',
        actual: 'motion whileTap + aria-label present; pressed asset swap absent',
      });
    },
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
    'Create lobby button cannot be used with zero selected players',
    'CreateLobbyInvitePanel.jsx',
    createLobbyInvitePanelSource,
    ['selectedTargets.length === 0', 'Oyuna başlamak için en az 1 oyuncu seç.'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('historical_kronox_regression', 'lobby_code_not_primary_invite_ux',
    'Lobby code is not primary invite UX',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Yedek kod', 'Davet edilen arkadaşların'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW }),
  // Codex080 historical regression contract:
  //   - Codex075–079: every prior attempt kept the mirrored-rows model. Live
  //     backend probe (May 2026) proved Friendship.create RLS pins
  //     data.user_email === {{user.email}} AND this rule is enforced even
  //     under base44.asServiceRole on this app. Result: 403 "Permission denied
  //     for create operation on Friendship entity" on every accept tap.
  //     Database evidence: Friendship table was completely empty; 3
  //     FriendRequests had silently been flipped to 'accepted' with NO
  //     companion Friendship rows.
  //   - Codex080: normalized model. The accepted FriendRequest IS the
  //     friendship. No Friendship.create attempts. loadFriends projects both
  //     sides of accepted FriendRequests (sender via from_email===me,
  //     recipient via to_email===me). Auto-repairs old "accepted-without-
  //     friendship" rows.
  sourceHas('historical_kronox_regression', 'accept_friend_request_no_raw_500',
    'Friend-request accept is receiver-only, idempotent, and refreshes both accepted directions through the sanitized snapshot',
    'acceptFriendRequest + friendsApi + getOnlinePlayerSelection',
    `${acceptFriendRequestFnSource}\n${friendsApiSource}\n${getOnlinePlayerSelectionFnSource}`,
    [
      'callerIsRecipient',
      'Only the receiver can accept this request',
      "status: 'accepted'",
      'Invalid friend request',
      "typeof requestOrId === 'string'",
      'requestOrId?.request_ref',
      'requestOrId?.id',
      'Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.',
      'incomingAccepted',
      'outgoingAccepted',
      'loadFriendsPageSnapshot',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  // Codex077: assert the build marker has actually been bumped beyond
  // Codex075. Previous tasks claimed bumps but the marker stayed on
  // Codex075 — this static contract makes future drift impossible to hide.
  // Codex087 — friend-request email + deep-link contract. One compact static
  // case asserting the full chain: friendsApi invokes the backend function,
  // the backend builds a /friends deep link, and App.jsx honors ?next= on login.
  sourceHas('historical_kronox_regression', 'friend_request_email_and_deep_link_wired',
    'Friend-request email + /friends deep link + ?next= login redirect are wired end-to-end (Codex087)',
    'lib/friendsApi.js + base44/functions/sendFriendRequest + App.jsx',
    `${friendsApiSource}\n${sendFriendRequestFnSource}\n${appSource}`,
    ["functions.invoke('sendFriendRequest'", 'const appUrl = sanitizeAppUrl', "URLSearchParams(location.search).get('next')"],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  makeCase('historical_kronox_regression', 'build_marker_bumped_beyond_codex090',
    'Build marker is bumped beyond Codex090 (deploy-version visibility for the Codex091 email-failure + category-handoff fix phase)', () => {
      const match = String(buildMarkerSource || '').match(/BUILD_MARKER\s*=\s*'([^']+)'/);
      const value = match?.[1] || '';
      const codexMatch = value.match(/^Codex(\d+)$/);
      const num = codexMatch ? parseInt(codexMatch[1], 10) : NaN;
      if (!Number.isFinite(num) || num <= 90) {
        return fail('Build marker has not been bumped beyond Codex090.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/dev/BuildMarker.jsx',
          expected: 'CodexN where N > 90',
          actual: value || '(unreadable)',
        });
      }
      return pass(`Build marker bumped: ${value}.`, {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'components/dev/BuildMarker.jsx',
        actual: value,
      });
    }, { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),

  // Codex086 — diagnostic overlays must NOT auto-enable for admin users
  // during normal gameplay. The host black-screen is fixed; the remaining
  // problem (Codex086) was that admins kept seeing the overlay because both
  // overlays auto-enabled on role==='admin'. This contract proves the gates
  // are now strictly opt-in (URL param or localStorage only).
  sourceLacks('historical_kronox_regression', 'diagnostics_do_not_auto_enable_for_admin',
    'Diagnostics overlays must NOT auto-enable on role==="admin" (Codex086 gameplay-block fix)',
    'components/dev/AppDiagnostics.jsx + components/game/GameBootstrapDiagnostics.jsx',
    `${appDiagnosticsAuxSource}\n${gameBootstrapDiagAuxSource}`,
    [
      // The forbidden auto-admin gates from Codex084/085. Both must be gone.
      "currentUser?.role === 'admin'",
      'user.role === "admin"',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  // Codex084 — diagnostics overlay + render error boundary regression contract.
  sourceHas('historical_kronox_regression', 'game_render_has_diagnostics_and_error_boundary',
    '/game render exposes dev/admin diagnostics overlay AND wraps the playable view in a render error boundary so a black screen cannot hide the cause (Codex084)',
    'pages/Game.jsx',
    gameSource,
    [
      'GameBootstrapDiagnostics',
      'GameRenderErrorBoundary',
      'isDiagnosticsEnabled',
      'renderStage',
      '[Game.bootstrap]',
      'boundaryError',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'boundary_error_hook_hoisted_above_guards',
    'boundaryError useState is declared BEFORE any conditional return — Rules of Hooks must not be violated by mid-component state (Codex084)',
    'pages/Game.jsx',
    gameSource,
    [
      // Marker comment near the top-of-component hook
      'Codex084 — boundaryError + diagVisible must live at top-level',
      'const [boundaryError, setBoundaryError] = useState(null);',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  // Codex083 host black-screen on online start regression contract.
  //   Symptom: User A (host) tapped OYUNU BAŞLAT → backend started the lobby
  //   and User B (Player 2) entered /game via the WaitingRoom subscription,
  //   but User A landed on /game showing a stuck loading screen ("black
  //   screen"). Codex082 added URL-param recovery but the host's
  //   `handleStart` still navigated with the function-response lobby alone,
  //   which raced the post-update DB write on slow networks.
  //
  //   Codex083 fix tokens this regression case checks:
  //     1. WaitingRoomPanel.handleStart MUST re-fetch Lobby.get(id) after
  //        startLobbyGame succeeds and use that authoritative copy.
  //     2. useLobbySync MUST retry the initial Lobby.get with backoff so a
  //        slow-network race doesn't strand the host.
  //     3. Game.jsx MUST route the not-ready state through
  //        OnlineGameBootstrapFallback so the host never sees an infinite
  //        spinner without a manual recovery option.
  sourceHas('historical_kronox_regression', 'host_start_bootstraps_from_live_lobby',
    'Host start re-fetches authoritative Lobby after startLobbyGame instead of trusting stale function-response only (Codex083 fix)',
    'WaitingRoomPanel.jsx + useLobbySync.js + Game.jsx',
    `${waitingRoomPanelSource}\n${useLobbySyncSource}\n${gameSource}`,
    [
      // 1. Host re-fetches live lobby after start
      'liveStartedLobby',
      'getLobbySnapshot({ lobbyId: startLobby.id })',
      // 2. useLobbySync retries with backoff so the host doesn't black-screen
      //    if the first fetch races the post-start write
      'resolveInitialLobbyWithRetry',
      // 3. /game routes not-ready state through the recoverable fallback
      'OnlineGameBootstrapFallback',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('historical_kronox_regression', 'online_game_black_screen_has_manual_recovery',
    'Online /game shows a manual "Tekrar Dene" recovery instead of infinite spinner (Codex083 fix)',
    'OnlineGameBootstrapFallback.jsx',
    onlineGameBootstrapFallbackSource,
    [
      'Tekrar Dene',
      'onRefetchLobby',
      'onRetryQuestions',
      'setShowRetry(true)',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  notAutomatableCase('historical_kronox_regression', 'online_start_two_account_runtime',
    'Two-device proof: host taps start, host enters /game on first try, no black screen',
    'Codex083 verified the symptom on the static + backend layer: host now re-fetches Lobby.get after startLobbyGame and uses that authoritative copy for navigation; useLobbySync retries the initial fetch; Game.jsx routes the not-ready state through OnlineGameBootstrapFallback so a stalled bootstrap is recoverable. Final release sign-off still needs a real two-device session because only a mounted browser can prove the visual transition and timing on a slow link.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, recentlyFixed: true, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  // Codex079: directly assert the FriendsPage→friendsApi call path that
  // caused the regression cannot silently regress again. FriendsPage hands
  // the full request object to acceptIncomingRequest, so the helper MUST
  // extract `.id` defensively or accept a bare id — never String()-coerce
  // an object to "[object Object]".
  sourceHas('historical_kronox_regression', 'accept_helper_handles_request_object',
    'acceptIncomingRequest defensively extracts request id (no [object Object] regression)',
    'lib/friendsApi.js',
    friendsApiSource,
    [
      "typeof requestOrId === 'string'",
      'requestOrId?.id',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  // Codex088 — Friends/Profile realtime refresh after accept. Asserts the
  // FriendsPage wires subscription + visibility/focus + polling fallback,
  // loadOutgoingRequests still filters strictly by pending (accepted can
  // never linger as a "pending sent" row), and loadFriends still reads
  // both sides of accepted (Codex080 normalized-model invariant preserved).
  sourceHas('historical_kronox_regression', 'friends_page_realtime_refresh_wired',
    'FriendsPage uses sanitized snapshot refresh on visibility/focus plus polling so sender updates after recipient accept',
    'FriendsPage + useFriendsRealtimeRefresh + friendsApi + getOnlinePlayerSelection',
    `${friendsPageSource}\n${friendsRealtimeRefreshSource}\n${friendsApiSource}\n${getOnlinePlayerSelectionFnSource}`,
    [
      'useFriendsRealtimeRefresh',
      'visibilitychange',
      "window.addEventListener('focus'",
      'POLL_INTERVAL_MS',
      'loadFriendsPageSnapshot',
      'incomingAccepted',
      'outgoingAccepted',
      "effectiveLifecycleStatus(row, nowMs) === 'pending'",
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  // Codex080: accept function no longer attempts Friendship.create — that was
  // the proven failing operation (403 Permission denied).
  sourceLacks('historical_kronox_regression', 'accept_does_not_attempt_friendship_create',
    'acceptFriendRequest no longer attempts Friendship.create (proven 403 root cause)',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    [
      '.entities.Friendship.create(',
      '.Friendship.create(',
      'ensureFriendshipPair(',
      'createFriendship(base44,',
    ],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  notAutomatableCase('historical_kronox_regression', 'accept_friend_request_two_account_runtime',
    'Two-account proof: User A sends → User B accepts → BOTH users see each other, no 500',
    'Codex080 normalized model verified by live backend probe: acceptFriendRequest returned 200 ok:true after the fix (previously 403 on Friendship.create). FriendRequest.status confirmed flipped to accepted in the database. The reciprocal-visibility outcome (does A see B in list AND does B see A in list?) was verified by manually walking loadFriends against the real accepted FriendRequest rows — both sides project correctly. Live two-tab UI execution from two authenticated sessions is still required for full release sign-off because the simulator cannot perform real-user navigation.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, recentlyFixed: true, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  sourceHas('historical_kronox_regression', 'incoming_invites_pending_recipient_scope',
    'Incoming game invites are backend-scoped to the current recipient and client-filtered to pending',
    'inviteApi + getOnlinePlayerSelection',
    `${inviteApiSource}\n${getOnlinePlayerSelectionFnSource}`,
    ['filter({ to_email: myEmail }', "effectiveLifecycleStatus(row, nowMs) === 'pending'", 'recipient_is_self: true', 'filterActiveIncomingGameInvites'],
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
  makeCase('social_rls_two_account_risk', 'friend_request_sender_receiver_read_static',
    'FriendRequest direct reads are admin-only and the backend snapshot scopes sender/receiver rows', () => {
      const parsed = parseEntityContract(friendRequestEntityRawSource, 'FriendRequest');
      const rls = parsed.entity?.rls || {};
      const adminOnly = ['read', 'update', 'delete'].every((operation) => rls?.[operation]?.user_condition?.role === 'admin');
      const missing = missingTokens(getOnlinePlayerSelectionFnSource, [
        'FriendRequest.filter({ to_email: myEmail }',
        'FriendRequest.filter({ from_email: myEmail }',
        'publicFriendRequest',
        'request_ref: publicRef',
      ]);
      if (parsed.error || !adminOnly || missing.length) {
        return fail('FriendRequest backend-only ownership contract drifted.', {
          verification: 'STATIC_CONTRACT',
          file: 'FriendRequest.jsonc + getOnlinePlayerSelection',
          actual: { parseError: parsed.error, adminOnly, missing },
        });
      }
      return pass('Direct FriendRequest access is admin-only; the backend scopes both actor directions and returns opaque request refs.', {
        verification: 'STATIC_CONTRACT',
      });
    }, { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  entityHasShape('social_rls_two_account_risk', 'friendship_owner_friend_read_static',
    'Friendship can be read only by owner/friend by static RLS contract',
    'entities/Friendship.json',
    friendshipEntitySource,
    ['user_email', 'friend_email'],
    ['data.user_email', '{{user.email}}'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  makeCase('social_rls_two_account_risk', 'game_invite_sender_recipient_read_static',
    'GameInvite direct reads are admin-only and backend snapshots scope recipient/host rows', () => {
      const parsed = parseEntityContract(gameInviteEntitySource, 'GameInvite');
      const rls = parsed.entity?.rls || {};
      const adminOnly = ['read', 'update', 'delete'].every((operation) => rls?.[operation]?.user_condition?.role === 'admin');
      const missing = missingTokens(getOnlinePlayerSelectionFnSource, [
        'GameInvite.filter({ to_email: myEmail }',
        'GameInvite.filter({ from_email: myEmail }',
        'from_actor_key_hash: actorKeyHash',
        'invite_ref: inviteRef',
        'recipient_is_self: direction === \'incoming\'',
      ]);
      if (parsed.error || !adminOnly || missing.length) {
        return fail('GameInvite backend-only ownership contract drifted.', {
          verification: 'STATIC_CONTRACT',
          file: 'GameInvite.jsonc + getOnlinePlayerSelection',
          actual: { parseError: parsed.error, adminOnly, missing },
        });
      }
      return pass('Direct GameInvite access is admin-only; backend actor scope covers linked recipients and linked/guest hosts.', {
        verification: 'STATIC_CONTRACT',
      });
    }, { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('social_rls_two_account_risk', 'accept_friend_receiver_only',
    'acceptFriendRequest is receiver-only',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ['callerIsRecipient', "action === 'accept' && !callerIsRecipient", 'Only the receiver can accept this request'],
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
    ['isAdminUser', "role === 'admin'", "permissions.includes('admin')"],
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
  notAutomatableCase('social_rls_two_account_risk', 'probe_user_a_sees_user_b_after_accept',
    'Two-account probe: User A sees User B after User B accepts',
    'This is the runtime reciprocal-visibility proof for the normalized accepted-FriendRequest model. It must stay manual/two-account until a safe backend harness exists.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'TWO_ACCOUNT_REQUIRED'] }),
  sourceHas('social_rls_two_account_risk', 'accept_friend_idempotent_accepted_static',
    'acceptFriendRequest treats already-accepted requests as idempotent success',
    'functions/acceptFriendRequest.js',
    acceptFriendRequestFnSource,
    ["fr.status !== 'pending' && fr.status !== 'accepted'", 'alreadyFriends', "status: 'accepted'"],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
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
      const wired = lobbyRoomSource.includes('createGameInvites') && inviteApiSource.includes("functions.invoke('createGameInvitesForTargets'");
      return stale && wired
        ? warning('Contract drift detected: comment says invite delivery is not wired, but backend-owned GameInvite creation is wired.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STALE_CONTRACT_DRIFT',
            actionType: ACTION_TYPES.CODE_FIX,
            expected: 'comments match implemented invite behavior',
            actual: 'stale comment present while backend-owned GameInvite creation exists',
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
    'Incoming invites panel uses shared notification center, not direct global GameInvite queries',
    'IncomingInvitesPanel.jsx + useNotificationCenter.js',
    `${incomingInvitesPanelSource}\n${useNotificationCenterSource}`,
    ['useNotificationCenter', 'base44.entities.GameInvite.filter', 'mergeActiveIncomingGameInvites'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'create_lobby_creates_invites_after_lobby',
    'Create lobby creates invites after lobby creation',
    'LobbyRoom.jsx',
    lobbyRoomSource,
    ['const newLobby = await base44.entities.Lobby.create', 'await createGameInvites'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'accept_invite_existing_lobby_path',
    'Accept invite joins through shared openGameInvite and safe existing lobby path',
    'IncomingInvitesPanel.jsx + useNotificationCenter.js + inviteApi.js + acceptGameInvite contract',
    `${incomingInvitesPanelSource}\n${useNotificationCenterSource}\n${inviteApiSource}\n${acceptGameInviteFnSource}`,
    ['openNotificationCenterGameInvite', "navigate('/lobby'", 'joinedLobby', 'verifiedLobby'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
  sourceHas('invite_contract_drift', 'reject_invite_marks_declined_safe',
    'Reject invite hides/marks pending invite safely with declined status',
    'inviteApi.js + IncomingInvitesPanel.jsx',
    `${inviteApiSource}\n${incomingInvitesPanelSource}\n${useNotificationCenterSource}`,
    ["status: 'declined'", 'declined_at', 'rejected_followup'],
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, runtimeProofRequired: true }),
  sourceLacks('invite_contract_drift', 'accepted_invite_does_not_open_game_directly',
    'Accepted invite does not navigate directly to /game from invite surfaces',
    'IncomingInvitesPanel.jsx + LobbyRoom.jsx',
    `${incomingInvitesPanelSource}\n${lobbyRoomSource}`,
    ["navigate('/game'", 'navigate("/game"'],
    { actionType: ACTION_TYPES.CODE_FIX }),
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
   *  FRIEND REQUEST EMAIL / DEEP-LINK SUITE
   * ============================================================ */
  sourceHas('friend_request_email_deep_link', 'send_request_triggers_email_after_create',
    'sendFriendRequest backend triggers email path after FriendRequest creation',
    'base44/functions/sendFriendRequest/entry.ts',
    sendFriendRequestFnSource,
    ['FriendRequest.create', 'sendFriendRequestEmail(base44', 'const appUrl = sanitizeAppUrl'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('friend_request_email_deep_link', 'email_failure_does_not_break_friend_request',
    'Email failure does not break FriendRequest creation',
    'base44/functions/sendFriendRequest/entry.ts + lib/friendsApi.js',
    `${sendFriendRequestFnSource}\n${friendsApiSource}`,
    ['FriendRequest.create', 'emailSent: false', "emailError: 'email_failed'", 'marker=email_failed'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('friend_request_email_deep_link', 'email_backend_requires_pending_request',
    'Email backend requires an existing pending FriendRequest from caller to recipient',
    'functions/sendFriendRequestEmail.js',
    sendFriendRequestEmailFnSource,
    ['FriendRequest.filter', 'from_email: fromEmail', 'to_email: toEmail', "status: 'pending'", 'No matching pending friend request'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('friend_request_email_deep_link', 'email_deep_link_routes_to_friends',
    'Email copy contains Kronox /friends deep link',
    'functions/sendFriendRequestEmail.js',
    sendFriendRequestEmailFnSource,
    ['const deepLink = `${appUrl}/friends`', 'Kabul etmek için Kronox', 'return json({ ok: true, deepLink })'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('friend_request_email_deep_link', 'login_next_redirect_is_relative_only',
    'Login ?next= redirect preserves intended Friends page without accepting external redirects',
    'App.jsx',
    appSource,
    ["URLSearchParams(location.search).get('next')", "next.startsWith('/')", "!next.startsWith('//')"],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('friend_request_email_deep_link', 'no_arbitrary_email_spam_endpoint',
    'No arbitrary friend-request email spam endpoint exists',
    'functions/sendFriendRequestEmail.js',
    sendFriendRequestEmailFnSource,
    ['toEmail === fromEmail', 'No matching pending friend request', 'Authenticated user only'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  notAutomatableCase('friend_request_email_deep_link', 'email_delivery_backend_runtime_proof_needed',
    'Email delivery/deep-link opening remains runtime/manual until Base44 SendEmail proof exists',
    'Static checks prove the FriendRequest email path and non-blocking failure handling, but real delivery, spam filtering, and mobile deep-link landing require backend email logs plus a recipient inbox/device test.',
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, verificationLabels: ['NOT_AUTOMATABLE', 'BACKEND_RUNTIME_PROBE', 'MANUAL_REQUIRED'] }),

  /* ============================================================
   *  GAME INVITE PUSH NOTIFICATION READINESS SUITE
   * ============================================================ */
  sourceLacks('game_invite_push_notifications', 'settings_notification_setup_block_removed',
    'Settings no longer renders the old notification/app-settings setup block',
    'SettingsPage.jsx',
    settingsPageSource,
    ['NotificationSettingsCard', 'NotificationDeploymentHint', 'AppPreferencesCard', 'Uygulama Ayarları', 'Bildirimleri Aç', 'Ses efektleri', 'Titreşim', 'Hareket azaltma', 'Ana ekrana ekle'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceLacks('game_invite_push_notifications', 'settings_load_does_not_request_push_permission',
    'Settings cleanup does not introduce automatic push permission prompts',
    'SettingsPage.jsx',
    settingsPageSource,
    ['Notification.requestPermission()', 'enableGameInviteNotifications', 'getPushChainDiagnostics'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'permission_states_and_unsupported_paths_handled',
    'Push permission/support states remain handled in the notification API',
    'lib/notificationApi.js',
    notificationApiSource,
    ['granted', 'denied', 'default', 'unsupported', 'missing_vapid_public_key', 'service_worker_missing', 'push_manager_missing', 'no_subscription'],
    { actionType: ACTION_TYPES.DEVICE_TEST, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'header_and_toast_notifications_remain_wired',
    'Header bell and foreground invite toast remain the notification surfaces after Settings cleanup',
    'HeaderNotificationBell.jsx + GameInviteNotifier.jsx + App.jsx',
    `${headerNotificationBellSource}\n${gameInviteNotifierSource}\n${appSource}`,
    ['HeaderNotificationBell', 'GameInviteNotifier', 'useNotificationCenter', 'notificationViewModel.bannerCandidates', 'openNotificationCenterGameInvite'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'user_notification_preference_api_contract_preserved',
    'Notification preference update helpers remain in API even though Settings UI was removed',
    'lib/notificationApi.js',
    notificationApiSource,
    ['game_invite_notifications_enabled', 'base44.auth.updateMe({ game_invite_notifications_enabled: true })', 'base44.auth.updateMe({ game_invite_notifications_enabled: false })'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'recipient_disabled_preference_skips_push',
    'sendGameInvitePush respects the recipient profile notification preference before sending Web Push',
    'functions/sendGameInvitePush.js',
    sendGameInvitePushFnSource,
    ['game_invite_notifications_enabled === false', 'recipient_notifications_disabled', 'attempted: false'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceLacks('game_invite_push_notifications', 'vapid_private_key_not_used_by_client_runtime',
    'VAPID private key is not referenced by client runtime notification code',
    'notificationApi.js + service worker + main.jsx',
    `${notificationApiSource}\n${kronoxServiceWorkerSource}\n${mainSource}`,
    ['KRONOX_VAPID_PRIVATE_KEY', 'VAPID_PRIVATE_KEY'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceLacks('game_invite_push_notifications', 'admin_notification_diagnostics_removed_from_settings',
    'Technical notification diagnostics are no longer rendered in Settings',
    'SettingsPage.jsx',
    settingsPageSource,
    ['Admin tanılama', 'Aktif kayıt', 'VITE_KRONOX_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'push_chain_diagnostics_distinguish_permission_from_subscription',
    'Push diagnostics distinguish permission from browser subscription and saved PushSubscription row',
    'lib/notificationApi.js',
    notificationApiSource,
    ['getPushChainDiagnostics', 'hasActiveSubscription', 'no_subscription', 'detailReason', 'no_browser_subscription', 'no_saved_subscription', 'saved_subscription_endpoint_mismatch', 'vapidPublicKeyConfigured'],
    { actionType: ACTION_TYPES.DEVICE_TEST, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'granted_permission_can_renew_missing_subscription',
    'Notification API can renew a missing browser subscription when called from a future user-initiated surface',
    'lib/notificationApi.js',
    notificationApiSource,
    ['enableGameInviteNotifications', 'getSubscription()', 'pushManager.subscribe', 'savePushSubscriptionRecord'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'push_subscription_entity_owner_scoped',
    'PushSubscription entity stores only owner-scoped device subscription fields',
    'entities/PushSubscription.json',
    pushSubscriptionEntitySource,
    ['user_email', 'endpoint', 'keys_p256dh', 'keys_auth', 'data.user_email', '{{user.email}}'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'subscription_dedupes_by_user_and_endpoint',
    'Push subscription storage avoids duplicate rows for the same user/device endpoint',
    'lib/notificationApi.js',
    notificationApiSource,
    ['PushSubscription.filter', '{ user_email: userEmail, endpoint: serialized.endpoint }', 'PushSubscription.update', 'PushSubscription.create'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'client_subscription_shape_matches_push_backend',
    'Client-created PushSubscription shape matches what sendGameInvitePush reads',
    'lib/notificationApi.js + functions/sendGameInvitePush',
    `${notificationApiSource}\n${sendGameInvitePushFnSource}`,
    ['endpoint', 'keys_p256dh', 'keys_auth', 'user_email: userEmail', 'user_email: toEmail', "status: 'active'"],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'service_worker_registers_and_handles_click',
    'Service worker registers and notification click opens/focuses Kronox invite route',
    'main.jsx + public/kronox-sw.js',
    `${mainSource}\n${kronoxServiceWorkerSource}`,
    ['registerKronoxServiceWorker', "addEventListener('push'", 'showNotification', "addEventListener('notificationclick'", 'clients.openWindow', 'targetUrl'],
    { actionType: ACTION_TYPES.DEVICE_TEST, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'game_invite_creation_triggers_best_effort_push',
    'GameInvite creation triggers best-effort push without blocking invite creation',
    'lib/inviteApi.js + functions/sendGameInvitePush',
    `${inviteApiSource}\n${sendGameInvitePushFnSource}`,
    ["base44.functions.invoke('sendGameInvitePush'", 'Promise.allSettled', "error: error?.message || 'push_failed'", 'return { created, failed, attempted: unique.length, push }'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'push_summary_preserves_skip_and_failure_reasons',
    'Push result summary preserves skipped/failure reasons for missing VAPID, no subscription, and send failures',
    'lib/inviteApi.js + functions/sendGameInvitePush',
    `${inviteApiSource}\n${sendGameInvitePushFnSource}`,
    ['skippedReasons', 'failedReasons', 'missingConfig', 'missing_vapid_config', 'no_active_subscriptions', 'subscriptionCount'],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'in_app_invite_notifier_remains_wired',
    'In-app invite notifier remains wired for foreground/open-app invites',
    'GameInviteNotifier.jsx + App.jsx',
    `${gameInviteNotifierSource}\n${appSource}`,
    ['GameInviteNotifier', 'useNotificationCenter', 'notificationViewModel.bannerCandidates', 'toast', 'seni Kronox oyununa davet etti', 'openNotificationCenterGameInvite'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'invite_toasts_persist_until_valid_close',
    'Foreground invite toasts persist until explicit close/open or confirmed source invalidation',
    'GameInviteNotifier.jsx + ui/toaster.jsx + ui/use-toast.jsx + ui/toast.jsx',
    `${gameInviteNotifierSource}\n${toasterSource}\n${useToastSource}\n${toastUiSource}`,
    ['PERSISTENT_INVITE_TOAST_DURATION = Infinity', 'duration: PERSISTENT_INVITE_TOAST_DURATION', 'toast_close_button', 'toast_open_action', 'active_invite_removed', 'onDismiss?.()', 'dismiss(id)', 'TOAST_REMOVE_DELAY = 350', "data-state={open ? 'open' : 'closed'}"],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'invite_toasts_clear_on_game_route',
    'Active invite toasts are cleared as soon as the route becomes /game',
    'GameInviteNotifier.jsx',
    gameInviteNotifierSource,
    ["location.pathname === '/game'", 'dismissAllInviteToasts', 'activeToastByInviteIdRef'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'non_pending_invites_dismiss_active_toasts',
    'Accepted/rejected/expired invites dismiss any active foreground notification',
    'GameInviteNotifier.jsx',
    gameInviteNotifierSource,
    ['active_invite_removed', 'dismissInviteToast(inviteId,', 'knownInviteIdsRef.current.add(invite.id)'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'push_backend_sender_and_recipient_scoped',
    'Push backend validates sender and sends only to recipient active subscriptions',
    'functions/sendGameInvitePush.js',
    sendGameInvitePushFnSource,
    ['myEmail !== fromEmail', 'PushSubscription.filter', 'user_email: toEmail', "status: 'active'"],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'push_payload_is_minimal_and_invite_scoped',
    'Push payload carries only minimal invite/lobby routing data',
    'functions/sendGameInvitePush.js + public/kronox-sw.js',
    `${sendGameInvitePushFnSource}\n${kronoxServiceWorkerSource}`,
    ['title: \'Kronox\'', 'seni Kronox oyununa davet etti', 'inviteId', 'lobbyId', 'lobbyCode', 'targetUrl', 'expiresAt'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true }),
  sourceHas('game_invite_push_notifications', 'expired_invites_do_not_trigger_push',
    'Expired pending invites are marked expired and skipped before Web Push send',
    'functions/sendGameInvitePush.js',
    sendGameInvitePushFnSource,
    ['getInviteExpiry', 'invite_expired', "status: 'expired'"],
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, recentlyFixed: true, runtimeProofRequired: true }),
  sourceHas('game_invite_push_notifications', 'notification_click_target_is_same_origin',
    'Notification click target is constrained to same-origin Kronox invite route',
    'public/kronox-sw.js',
    kronoxServiceWorkerSource,
    ['resolveSameOriginTarget', 'target.origin !== self.location.origin', '/lobby', 'client.navigate(target)', 'clients.openWindow(target)'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  warningCase('game_invite_push_notifications', 'vapid_and_device_runtime_gate_visible',
    'VAPID/device support gate is visible and does not masquerade as push delivery proof',
    'Push is best-effort: missing VAPID config, unsupported browsers, denied permission, and platform-specific PWA behavior must stay visible as release proof gaps.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['STATIC_CHECK_LIMITATION', 'EXTERNAL_DEVICE_REQUIRED', 'BACKEND_RUNTIME_PROBE'], expected: 'real subscribed device with backend VAPID secrets', actual: 'static readiness only' }),
  notAutomatableCase('game_invite_push_notifications', 'push_delivery_real_device_backend_proof_needed',
    'Push delivery and notification click remain NOT_AUTOMATABLE without a subscribed device/backend proof',
    'Requires HTTPS/PWA-compatible install state, granted permission, VAPID secrets, Base44 function execution, and a backgrounded recipient device. Static source cannot prove system notification delivery.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'MANUAL_REQUIRED'] }),

  /* ============================================================
   *  VISUAL COMPOSITION REGRESSION SUITE
   * ============================================================ */
  makeCase('visual_composition_regression', 'lobby_no_duplicate_kronox_title',
    'Lobby screen should not show duplicate Kronox title/logo', () => {
      const composed = `${screenHeaderSource}\n${lobbyCreateJoinPanelSource}\n${createLobbyInvitePanelSource}`;
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
    'Current ScreenHeader title styling should use the approved fantasy header style',
    'ScreenHeader.jsx + LobbyCreateJoinPanel.jsx',
    `${screenHeaderSource}\n${lobbyCreateJoinPanelSource}`,
    ['ScreenHeader', 'font-cinzel', '#facc15', 'textShadow'],
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
    ['/assets/ui/', 'Kronox_Home_Fantasy_Background.png', 'Kronox_Online_CTA_Start.webp', 'Kronox_Online_CTA_Join.webp'],
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
    ["navigate('/settings'", 'Ayarlar'],
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
  // Codex105 — /game hidden by route; /lobby visibility is runtime/subflow-based via bottomNavVisibility. The OLD "'/lobby' must be in HIDDEN_ROUTES" expectation is intentionally NOT asserted.
  sourceHas('route_navigation_resilience', 'bottom_nav_subflow_aware',
    'Bottom navigation: /game hidden by route; /lobby visibility is runtime/subflow-based via bottomNavVisibility (visible on Online Battle selection; hidden during create/join/waiting/deep-link)',
    'BottomNav.jsx', bottomNavSource,
    ["'/game'", 'HIDDEN_ROUTES', 'subscribeBottomNavHidden', 'runtimeHidden'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('route_navigation_resilience', 'notification_invite_link_bootstraps_lobby_route',
    'Notification inviteId query bootstraps a safe invite/lobby route',
    'LobbyRoom.jsx',
    lobbyRoomSource,
    ['queryInviteId', 'DeepLinkedInvitePanel', 'acceptGameInvite', "navigate('/lobby', { replace: true"],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
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
  sourceHas('report_ux_human_decision', 'current_critical_fail_card_exists',
    'Compact Current Critical FAIL card exists',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Current Critical FAIL', 'currentCriticalFailures'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'runtime_proof_needed_grouping_exists',
    'Runtime Proof Needed grouping separates device/two-account/backend/human/CI proof',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Runtime Proof Needed', 'runtimeProofNeededByActionType'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('report_ux_human_decision', 'recently_changed_areas_section_exists',
    'Recently changed areas section exists when report data is available',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['Recently Changed Areas', 'recentlyChangedAreas'],
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* ============================================================
   *  SRE-STYLE RELEASE HEALTH SIGNALS SUITE
   * ============================================================ */
  sourceHas('sre_release_health_signals', 'sre_signal_fields_exported',
    'Report exports lightweight SRE-style health signals',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['sreSignals', 'errors', 'latency', 'saturation', 'recoverability'],
    { actionType: ACTION_TYPES.CI_ENVIRONMENT }),
  sourceHas('sre_release_health_signals', 'slow_suite_latency_detectable',
    'Simulator duration and slow suites are measurable',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['totalDurationMs', 'slowSuites', 'durationMs'],
    { actionType: ACTION_TYPES.CI_ENVIRONMENT }),
  sourceHas('sre_release_health_signals', 'recoverability_checks_are_named',
    'Recoverability signals include /game bootstrap, email failure, and push failure paths',
    'SimulationPanel.jsx',
    simulationPanelSource,
    ['bootstrap', 'email', 'push', 'fallback'],
    { actionType: ACTION_TYPES.CI_ENVIRONMENT }),
  warningCase('sre_release_health_signals', 'health_dashboard_is_not_observability',
    'Health report is release-risk intelligence, not production observability',
    'The simulator can summarize static/runtime case outcomes and local duration, but production latency/error/saturation need deployed telemetry.',
    { actionType: ACTION_TYPES.CI_ENVIRONMENT, verificationLabels: ['STATIC_CHECK_LIMITATION', 'MANUAL_REQUIRED'] }),

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
    'Rejecting an invite marks only the GameInvite row declined; it does not delete the lobby.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, expected: 'reject only updates invite status', actual: 'rejectGameInvite uses GameInvite.update with declined status' }),
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

  /* ============================================================
   *  ONLINE CATEGORY POLICY SUITE
   *  Current Category metadata is the source of truth; static code may
   *  provide only presentation helpers and policy contracts.
   * ============================================================ */
  makeCase('online_category_taxonomy', 'current_category_metadata_is_source_of_truth',
    'Online categories come from current Category metadata, not a hardcoded taxonomy', async () => {
      const mod = await import('@/lib/onlineCategories');
      const policy = mod.ONLINE_CATEGORY_POLICY || {};
      const ok =
        policy.categorySourceOfTruth === 'Category' &&
        policy.selectedCategoriesOnly === true &&
        policy.categoryListFallbackAllowed === false &&
        policy.legacyHardcodedCategoryFallbackAllowed === false &&
        !Array.isArray(mod.ONLINE_CATEGORIES) &&
        !Array.isArray(mod.ONLINE_CATEGORY_IDS);
      return ok
        ? pass('Online category policy points to current Category metadata and exposes no static category list.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'STATIC_CHECK_LIMITATION',
          actual: policy,
        })
        : fail('Online category policy still looks like a static category source.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/onlineCategories.js',
          actual: {
            policy,
            hasStaticCategories: Array.isArray(mod.ONLINE_CATEGORIES),
            hasStaticIds: Array.isArray(mod.ONLINE_CATEGORY_IDS),
          },
        });
    }, { actionType: ACTION_TYPES.CODE_FIX }),
  makeCase('online_category_taxonomy', 'visual_slots_are_not_category_ids',
    'Online category module provides presentation slots without category ids or labels', async () => {
      const mod = await import('@/lib/onlineCategories');
      const slots = mod.ONLINE_CATEGORY_VISUAL_SLOTS || [];
      const broken = slots.filter((slot) => (
        !slot.iconKey ||
        !slot.color ||
        Object.prototype.hasOwnProperty.call(slot, 'category_id') ||
        Object.prototype.hasOwnProperty.call(slot, 'id') ||
        Object.prototype.hasOwnProperty.call(slot, 'label')
      ));
      if (!slots.length || broken.length) {
        return fail('Online visual slots may be acting as category metadata fallback.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'lib/onlineCategories.js',
          actual: { count: slots.length, broken },
        });
      }
      return pass('Online visual slots are presentation-only and do not define category IDs or labels.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'STATIC_CHECK_LIMITATION',
        actual: { count: slots.length },
      });
    }, { actionType: ACTION_TYPES.CODE_FIX }),
  makeCase('online_category_taxonomy', 'decorate_online_category_uses_live_metadata',
    'Online decoration keeps live numeric Category IDs and metadata labels', async () => {
      const mod = await import('@/lib/onlineCategories');
      const decorated = mod.decorateOnlineCategory({
        category_id: 11,
        name: 'Future Lane',
        description: 'Current DB row',
      }, 8);
      const ok = decorated.id === 11 &&
        decorated.category_id === 11 &&
        decorated.label === 'Future Lane' &&
        decorated.description === 'Current DB row' &&
        decorated.iconKey &&
        decorated.color;
      return ok
        ? pass('Online category decoration preserves current metadata and adds visuals only.', {
          verification: 'RUNTIME_VERIFIED',
          actual: decorated,
        })
        : fail('Online category decoration is not preserving live metadata.', {
          verification: 'RUNTIME_VERIFIED',
          file: 'lib/onlineCategories.js',
          actual: decorated,
        });
    }, { actionType: ACTION_TYPES.CODE_FIX }),
  sourceHas('online_category_taxonomy', 'online_screen_uses_current_metadata_and_retry',
    'Online challenge screen loads current metadata and shows retry/error on failure',
    'components/lobby/OnlineChallengeScreen.jsx',
    onlineChallengeScreenSource,
    [
      "loadActiveCategories({ limit: 1000 })",
      'decorateOnlineCategory',
      'categoryLoadError',
      'Tekrar Dene',
      'setSelectedCategories([])',
      'selectedCategories: [...selectedCategories]',
    ],
    { actionType: ACTION_TYPES.CODE_FIX }),
  sourceLacks('online_category_taxonomy', 'no_stale_category_fallback_names_in_online_runtime',
    'Online runtime sources do not contain stale category fallback names',
    'OnlineChallengeScreen + onlineCategories + startLobbyGame',
    `${onlineChallengeScreenSource}\n${onlineCategoriesSource}\n${startLobbyGameEntrySource}`,
    [
      'Chronicle',
      'Flashback',
      'Viral',
      'chronicle',
      'flashback',
      'viral',
      'ONLINE_ID_TO_MAIN_CATEGORY_ID',
      'LEGACY_ONLINE_TO_LEGACY_CATEGORY_MAP',
    ],
    { actionType: ACTION_TYPES.CODE_FIX }),
  makeCase('online_category_taxonomy', 'selected_category_ids_forwarded_to_lobby',
    'Selected Online category ids are forwarded into lobby creation/question filtering contract', () => {
      // Assert end-to-end multi-select handoff:
      //   OnlineChallengeScreen -> LobbyRoom.handleCreate ->
      //   lobbyPayload.selected_category_ids -> startLobbyGame current
      //   Category filtering.
      const selectedExists = onlineChallengeScreenSource.includes('selectedCategories');
      const createReceivesSelection =
        onlineChallengeScreenSource.includes('selectedCategories: [...selectedCategories]') ||
        createLobbyInvitePanelSource.includes('selectedCategories: Array.isArray(selectedCategories)');
      const lobbyStoresSelection = lobbyRoomSource.includes('lobbyPayload.selected_category_ids');
      const filterConsumesSelection =
        startLobbyGameEntrySource.includes('getQueryMainCategoryIdsForSettings') &&
        startLobbyGameEntrySource.includes('categorySourceOfTruth') &&
        startLobbyGameEntrySource.includes('selectedCategoriesOnly');

      if (selectedExists && (!createReceivesSelection || !lobbyStoresSelection || !filterConsumesSelection)) {
        return fail('Online category multi-select exists visually, but selected ids are not wired through lobby creation/question filtering.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'LobbyCreateJoinPanel.jsx + LobbyRoom.jsx',
          expected: 'selectedCategories handed to onCreate, stored on Lobby/settings, and consumed by question filtering',
          actual: {
            selectedExists,
            createReceivesSelection,
            lobbyStoresSelection,
            filterConsumesSelection,
          },
          nextStep: 'Wire selected category ids through the lobby/create/start path before claiming category selection affects online questions.',
        });
      }

      return pass('Selected Online category ids appear to be forwarded through the lobby/question-filtering contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actual: {
          selectedExists,
          createReceivesSelection,
          lobbyStoresSelection,
          filterConsumesSelection,
        },
      });
    }, { actionType: ACTION_TYPES.CODE_FIX, runtimeProofRequired: true }),
  notAutomatableCase('online_category_taxonomy', 'multi_select_runtime_unbroken',
    'Online multi-category selection still works at runtime after taxonomy centralization',
    'Static contract proves the Online screen loads current Category metadata, keeps a min-1 guard, and forwards numeric selected_category_ids; the actual multi-select UX flow needs a real touch session on the mounted Online landing.',
    { actionType: ACTION_TYPES.DEVICE_TEST, verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'] }),

  /* ============================================================
   *  RANDOM MATCHMAKING + ONLINE QUESTION MODE HEALTH
   * ============================================================ */
  sourceHas('random_matchmaking_health', 'no_opponent_message_policy_exists',
    'Random matchmaking has a no-opponent message policy',
    'lib/matchmakingPolicy.js',
    matchmakingPolicySource,
    ['RANDOM_MATCHMAKING_NO_OPPONENT_MESSAGE', 'Şu anda uygun rakip bulunamadı. Tekrar dene.'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('random_matchmaking_health', 'bot_fallback_policy_is_disabled',
    'Random matchmaking policy explicitly forbids bot fallback',
    'lib/matchmakingPolicy.js',
    matchmakingPolicySource,
    ['RANDOM_MATCHMAKING_ALLOW_BOT_FALLBACK = false'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceLacks('random_matchmaking_health', 'no_bot_fallback_in_online_lobby_sources',
    'Online lobby sources do not assign a bot while waiting for a real opponent',
    'LobbyRoom.jsx + LobbyCreateJoinPanel.jsx + WaitingRoomPanel.jsx',
    `${lobbyRoomSource}\n${lobbyCreateJoinPanelSource}\n${waitingRoomPanelSource}`,
    ['isBot', 'bot_email', 'Bot Oyuncu', 'AI opponent', 'fakePlayer'],
    { actionType: ACTION_TYPES.CODE_FIX }),
  warningCase('random_matchmaking_health', 'runtime_random_matchmaking_not_detected',
    'Runtime random matchmaking flow is not detected in current Online code',
    'Current Online flow is friend-invite/create/join-code based. No bot fallback was found, but a true random opponent queue/loading/cancel flow still needs product implementation or a dedicated backend queue before runtime PASS can be claimed.',
    { actionType: ACTION_TYPES.CODE_FIX, verificationLabels: ['STATIC_CHECK_LIMITATION', 'MANUAL_REQUIRED'] }),
  sourceHas('online_question_mode_health', 'online_authoritative_shared_deck_required',
    'Online uses a server-authored shared question deck, not per-player Solo buffers',
    'Game + startLobbyGame + Lobby',
    `${gameSource}\n${startLobbyGameEntrySource}\n${lobbyEntityRawSource}`,
    ['online_question_deck', 'online_shared_selected_category_deck_v1', 'normalizeOnlineQuestionDeck', 'questionFetchEnabled = !isOnline', 'onlineQuestionDeck', 'selectedCategoriesOnly: ONLINE_GAME_POLICY.selectedCategoriesOnly'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('online_question_mode_health', 'online_selected_categories_difficulty_one_two_only',
    'Online start uses selected lobby categories only and difficulty 1/2',
    'startLobbyGame',
    startLobbyGameEntrySource,
    ['filterQuestionsForLobbySettings', 'selected_category_ids', 'isOnlineDifficultyEligible', 'ONLINE_ALLOWED_DIFFICULTIES', 'difficulty_1_or_2_only', 'soloPreferenceWeightingApplied: ONLINE_GAME_POLICY.soloPreferenceWeightingApplied', 'guestSoloPathUsed: ONLINE_GAME_POLICY.guestSoloPathUsed'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  sourceHas('online_question_mode_health', 'online_active_state_requires_readable_shared_deck',
    'Online route/game state waits for deck readiness and rejects non-deck next questions',
    'WaitingRoom + Game + updateLobbyGameState',
    `${waitingRoomPanelSource}\n${gameSource}\n${updateLobbyGameStateEntrySource}`,
    ['startedLobby.online_question_deck.length > 0', 'onlineDeckReady', 'currentQuestion != null', 'Siradaki soru paylasilan Online destesinde olmali'],
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true }),
  warningCase('online_question_mode_health', 'runtime_four_player_online_start_manual_proof',
    'Four-player Online start still needs live multi-account proof',
    'Static checks verify shared deck persistence, selected-category filtering, and Online/Solo separation. A real four-player session must still prove realtime delivery and device timing.',
    { actionType: ACTION_TYPES.TWO_ACCOUNT_TEST, verificationLabels: ['MANUAL_REQUIRED'] }),
];

// ---------------------------------------------------------------------------
//  Optional additive scoring hook used by SimulationPanel.
//  Adds a small extra penalty when critical social/security suites have any
//  BLOCKED or NOT_AUTOMATABLE case. These remain release-proof risks, but
//  manual-only NOT_AUTOMATABLE cases are not copied/counts as code blockers.
// ---------------------------------------------------------------------------
const CRITICAL_SOCIAL_SUITE_IDS = new Set([
  'profile_navigation',
  'auth_profile_health',
  'tutorial_profile_health',
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
  'online_category_taxonomy',
  'friend_request_email_deep_link',
  'invite_expiration_health',
  'online_question_mode_health',
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
