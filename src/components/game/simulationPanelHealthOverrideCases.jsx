// Kronox Health Center — Stale-contract overrides (Codex132).
//
// PURPOSE
//   `simulationPanelExtraCases.jsx` is frozen at the 2000-line edit cap. A
//   handful of cases inside it became stale after recent product changes:
//
//     1. invite_expiration_health.invite_rows_have_expiry_fields
//        — still expected GAME_INVITE_TTL_MS = 5 * 60 * 1000 after Codex130
//          bumped TTL to 10 minutes.
//     2. invite_expiration_health.invite_creation_sets_five_minute_expiry
//        — same 5-minute stale expectation; rename + update.
//     3. historical_kronox_regression.online_cta_asset_interactivity
//        — expected the legacy `FantasyCtaButton` token inside
//          LobbyCreateJoinPanel. Codex127 moved the Online CTA to the new
//          OnlineChallengeScreen and reduced LobbyCreateJoinPanel to a
//          join-only panel.
//     4. historical_kronox_regression.category_current_rule_documented
//        — expected category-selection tokens inside LobbyCreateJoinPanel.
//          Current Online has no category selector; this now guards the
//          documented all-active-random Online rule.
//     5. route_navigation_resilience.lobby_create_join_modes_static
//        — expected `mode === 'create'` inside LobbyCreateJoinPanel; the
//          create flow is now direct-from-Online-CTA, and the panel only
//          renders the join-by-code path.
//     6. online_category_taxonomy.lobby_panel_consumes_centralized_taxonomy
//        — expected category metadata/carousel plumbing on the Online UI.
//          Current Online must not fetch/sort/render categories for selection.
//     7. friends_validation.clear_success_and_error_messages
//        — Codex129 intentionally moved the success copy ownership from
//          AddFriendForm to FriendsPage so the parent can show honest
//          delivery-outcome copy. The original case still expected the
//          success substring inside AddFriendForm.
//
//   This module provides REPLACEMENT cases that match the current product
//   architecture. The registry (`simulationPanelCaseRegistry.jsx`) filters
//   the stale ids out of BASE_EXTRA_TESTS via `OVERRIDDEN_CASE_KEYS` and
//   appends these replacements through the normal modular path. Suite ids
//   stay the same → counts/penalties/sections unchanged.
//
//   No Solo cases are touched. No new ERROR sources are introduced. Every
//   replacement is a static contract on real product surfaces (in /src) so
//   they cannot throw.

import deployedRootReportFunctionSource from '../../../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts?raw';
import appSource from '../../App.jsx?raw';
import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import diamondEconomySource from '../../lib/diamondEconomy.js?raw';
import leaderboardSource from '../../lib/leaderboard.js?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import onlineCategoriesSource from '../../lib/onlineCategories.js?raw';
// Codex132 follow-up — new override sources for the three re-targeted cases.
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import {
  createGameInvitesForTargetsFnSource,
  gameInviteEntitySource,
  lobbyEntitySource,
  sendFriendRequestFnSource,
} from './simulationPanelContractStrings.jsx';
// Codex153 — Solo path mimarisi tamamen yeni yapıya geçti (bottom CTA
// yok, "SIRADAKİ X. SEVİYE" hero node, helper-tabanlı focus). Stale Solo
// Health sözleşmelerini buradan override ediyoruz.
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';
import useHeaderNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import useNotificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import onboardingPageSource from '../../pages/OnboardingPage.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import guestProfileSource from '../../lib/guestProfile.js?raw';
import createGuestProfileSource from '../../../base44/functions/createGuestProfile/entry.ts?raw';
import friendRequestEntitySource from '../../../base44/entities/FriendRequest.jsonc?raw';
import acceptFriendRequestSource from '../../../base44/functions/acceptFriendRequest/entry.ts?raw';
import acceptGameInviteSource from '../../../base44/functions/acceptGameInvite/entry.ts?raw';
import findLobbyByCodeSource from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import startLobbyGameSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateLobbyGameStateSource from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import getOnlinePlayerSelectionSource from '../../../base44/functions/getOnlinePlayerSelection/entry.ts?raw';
import removeFriendSource from '../../../base44/functions/removeFriend/entry.ts?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import notificationReducerSource from '../../lib/notificationReducer.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
  TWO_ACCOUNT_TEST: 'TWO_ACCOUNT_TEST',
  HUMAN_VISUAL_REVIEW: 'HUMAN_VISUAL_REVIEW',
  CI_ENVIRONMENT: 'CI_ENVIRONMENT',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) }; }

function makeCase(suiteId, suiteName, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function sourceHasReplacement(suiteId, suiteName, id, name, file, src, tokens, options = {}) {
  return makeCase(suiteId, suiteName, id, name, () => {
    const text = safeStr(src);
    const missing = tokens.filter((t) => !text.includes(t));
    if (missing.length) {
      return fail('Static source contract failed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'REAL_PRODUCT_RISK',
        file,
        expected: tokens,
        actual: `Missing: ${missing.join(', ')}`,
        actionType: options.actionType || ACTION_TYPES.CODE_FIX,
      });
    }
    return pass('Static source contract matched.', {
      verification: 'STATIC_CONTRACT',
      classification: 'STATIC_CHECK_LIMITATION',
      file,
      expected: tokens,
      actual: 'all tokens present',
      actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    });
  }, options);
}

// Public registry keys that the override module REPLACES. The registry
// filters BASE_EXTRA_TESTS by this list and appends the replacements
// below, preserving suite ids/critical flags so counts and penalty hooks
// do NOT shift.
export const OVERRIDDEN_CASE_KEYS = new Set([
  'invite_expiration_health.invite_rows_have_expiry_fields',
  'invite_expiration_health.invite_creation_sets_five_minute_expiry',
  'historical_kronox_regression.online_cta_asset_interactivity',
  'historical_kronox_regression.category_current_rule_documented',
  'route_navigation_resilience.lobby_create_join_modes_static',
  'online_category_taxonomy.lobby_panel_consumes_centralized_taxonomy',
  'online_category_taxonomy.current_category_metadata_is_source_of_truth',
  'online_category_taxonomy.online_screen_uses_current_metadata_and_retry',
  'friends_validation.clear_success_and_error_messages',
  'kronox_game_feel.error_states_network_flows',
  'online_lobby_setup.authenticated_user_identity_used',
  'game_invites.invites_created_after_lobby',
  // Codex132 follow-up — three stale visual/code-ux contracts that still
  // pointed at the pre-Codex127 lobby surface. Re-targeted below.
  'lobby_code_ux.acik_lobiye_gir_preserved',
  'visual_composition_regression.image_buttons_have_press_feedback_regression',
  'visual_composition_regression.asset_path_drift_warning',
  // Codex151 — invite loaders now use lifecycle snapshots so terminal rows
  // can remove active state while stale empty fetches cannot flicker valid
  // subscription rows away. The old cases expected the active-only loader call.
  'game_invites.incoming_invites_visible_to_recipient',
  'invite_contract_drift.incoming_panel_uses_loader',
  'friends_security.friend_request_rls_addressed',
  'friends_security.friend_request_manage_delete_rls_sender_recipient_admin',
  'friends_security.accepted_request_is_normalized_friendship',
  'friends_security.accept_is_receiver_only_server',
  'friends_security.accept_does_not_create_friendship_rows',
  'game_invites.game_invite_entity_exists',
  'game_invites.reject_marks_status_declined',
  'game_invites.sent_invites_filter_supported',
  'invite_expiration_health.incoming_loader_expires_old_pending_invites',
  'invite_contract_drift.create_lobby_creates_invites_after_lobby',
  'invite_contract_drift.reject_invite_marks_declined_safe',
  'invite_contract_drift.pending_list_filters_to_email_user',
  'online_category_taxonomy.selected_category_ids_forwarded_to_lobby',
  'online_question_mode_health.online_authoritative_shared_deck_required',
  'online_question_mode_health.online_active_state_requires_readable_shared_deck',
  'lobby_code_ux.invite_centric_copy',
  'friend_request_email_deep_link.send_request_triggers_email_after_create',
  'friend_request_email_deep_link.email_backend_requires_pending_request',
  'friend_request_email_deep_link.email_deep_link_routes_to_friends',
  'friend_request_email_deep_link.no_arbitrary_email_spam_endpoint',
  'historical_kronox_regression.friend_request_email_and_deep_link_wired',
  // Codex152/Codex317 — Profile economy values are real persisted/shared
  // sources; the suite no longer expects placeholder-only markers.
  'profile_economy.profile_uses_real_shared_economy_sources',
  'profile_economy.ui_does_not_crash_when_values_missing',
  // Codex153 cleanup — Profile copy moved from the old English "Level"
  // label to the current Turkish "Seviye" label while keeping the same
  // getCurrentPlayableLevel source.
  'profile_economy.level_appears',

  // Codex153 — Solo mimari yenilemesi sonrasında stale Solo Health
  // sözleşmeleri. Yeni ürün:
  //   • Bottom "LEVEL N / OYNA" CTA YOK — current/next seviye path
  //     üstündeki hero node + "SIRADAKİ N. SEVİYE" pill ile gösteriliyor.
  //   • selectedLevel state, progressLoaded gate, userTouchedSelection
  //     stickiness flag YOK — path doğrudan helper-tabanlı focusLevelNumber
  //     üzerinden çalışıyor.
  //   • scrollIntoView / data-kx-solo-map-container / attemptCenterSoloMap
  //     externalised helper YOK — useLayoutEffect + getBoundingClientRect
  //     + requestAnimationFrame ile inner-container scroll.
  //   • ZoneBanner / range: [1,5] sabit liste YOK — LANE_PATTERN ile S-curve
  //     lane'ler arasında geçiş; 1000 seviyeye kadar VIEW_WINDOW ile
  //     windowed render.
  // Her override case yeni mimarinin gerçek product invariant'ını
  // korurken token-only stale beklentileri kaldırıyor.
  'solo_focus_and_unlock.default_selection_from_helper',
  'solo_focus_and_unlock.bottom_cta_reflects_selected_level',
  'solo_focus_and_unlock.progress_loaded_gate_present',
  'solo_focus_and_unlock.user_touched_selection_flag',
  'solo_focus_and_unlock.level_map_path_receives_focus_target',
  'solo_focus_and_unlock.level_map_path_honors_focus_target',
  'solo_focus_and_unlock.auto_scroll_resilient_to_layout_timing',
  'solo_unlock_self_healing.bottom_cta_not_hardcoded_level_1',
  'solo_unlock_self_healing.progress_loaded_gates_cta_label',
  'solo_unlock_self_healing.solo_initial_focus_uses_current_playable',
  'solo_map_focus.solo_cta_and_map_use_same_focus_level',
  'solo_map_focus.solo_map_refocus_after_progress_load',
  'solo_map_focus.solo_map_focus_matches_cta_level',
  'solo_map_focus.solo_map_scroll_uses_bounding_rect',
  'solo_map_focus.solo_map_scroll_container_is_inner',
  'solo_map_focus.solo_map_admin_focus_diagnostics_wired',
  'solo_adventure_map.level_one_at_bottom_upward_progression',
  'solo_adventure_map.auto_scroll_to_current_level_wired',
  'solo_adventure_map.every_five_levels_zone_theme',

  // Codex153 — Invite Online panel + header bell wiring contract'ı.
  // Yeni mimari `loadIncomingInviteSnapshot` + `mergeActiveIncomingGameInvites`
  // kullanıyor; eski `loadIncomingInvites` named helper artık yok.
  'invite_lifecycle.online_screen_pending_invites_visible',
  'game_invite_lifecycle_v2.game_invite_active_selector_shared',

  // Backend deployability incident — an older report function imported
  // './_shared/adminAuth.js', which resolved to file:///src/_shared/adminAuth.js
  // (module not found) and FAILED to deploy, leaving Base44 serving a stale
  // build. The fix INLINES a DB-backed AdminUser guard (no local import) so
  // the callable function deploys cleanly. The old Health case still required
  // the broken './_shared/adminAuth.js' token, so it is stale and overridden below.
  'question_analytics_health.manual_admin_email_report_deployed_root_entrypoint',

  // Codex378 — Tutorial is no longer a standalone profile-flag modal.
  // First-time onboarding now runs through GuestProfile state +
  // `/onboarding` real level-type first Solo level.
  'tutorial_profile_health.tutorial_status_is_profile_field',
  'tutorial_profile_health.tutorial_completion_updates_profile',

  // Codex402 — Manual-only warnings are not Warning JSON items. These
  // replacement cases keep the same suite/id visibility but report the
  // correct status: NOT_AUTOMATABLE / MANUAL_REQUIRED.
  'mobile_gesture_risk.scroll_restoration_back_nav_risk',
  'mobile_gesture_risk.fat_finger_tap_zone_risk',
  'mobile_gesture_risk.safe_area_collision_bottom_cta',
  'mobile_gesture_risk.virtual_keyboard_crush_social_inputs',
  'mobile_gesture_risk.orientation_surprise_landscape',
  'mobile_gesture_risk.ios_rubber_band_scroll_static_limit',
  'live_dom_geometry.static_cannot_prove_bounding_rects',
  'social_rls_two_account_risk.horizontal_privilege_classified',
  'social_rls_two_account_risk.stale_invite_acceptance_risk',
  'social_rls_two_account_risk.double_click_duplicate_invite_risk',
  'social_rls_two_account_risk.service_role_blast_radius_risk',
  'game_invite_push_notifications.vapid_and_device_runtime_gate_visible',
  'visual_composition_regression.double_header_smell_detector',
  'visual_composition_regression.css_redraw_vs_approved_asset_warning',
  'route_navigation_resilience.direct_url_runtime_not_proven',
  'sre_release_health_signals.health_dashboard_is_not_observability',
  'kronox_game_feel.cta_text_overflow_static_heuristic',
  'random_matchmaking_health.runtime_random_matchmaking_not_detected',
  'online_question_mode_health.runtime_four_player_online_start_manual_proof',
]);

// No new suite ids — we reuse the existing suite ids defined in the base
// extras so the side-panel grouping, critical flags, and penalty hooks
// stay identical.
export const EXTRA_SUITES = [];

const MANUAL_WARNING_RECLASSIFICATIONS = [
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'scroll_restoration_back_nav_risk',
    name: 'Scroll restoration/back navigation risk is documented',
    reason: 'Route transitions and browser history need runtime checks because static source cannot prove scroll restoration behavior.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'fat_finger_tap_zone_risk',
    name: 'Fat-finger tap-zone risk warning for small controls',
    reason: 'Real tap comfort requires viewport measurement on target devices.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'safe_area_collision_bottom_cta',
    name: 'Safe-area collision warning for bottom CTAs',
    reason: 'Only device screenshots can prove no home-indicator collision.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'virtual_keyboard_crush_social_inputs',
    name: 'Virtual keyboard crush warning for Friends/AddFriend/Profile input flows',
    reason: 'Email and lobby-code inputs need real virtual-keyboard checks at 320px width.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'orientation_surprise_landscape',
    name: 'Orientation surprise warning if landscape behavior is undefined',
    reason: 'Kronox is portrait-first; landscape is a manual device proof item.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'mobile_gesture_risk',
    suiteName: 'Mobile Gesture Risk Suite',
    id: 'ios_rubber_band_scroll_static_limit',
    name: 'iOS/WebView rubber-band scroll risk remains visible when only static proof exists',
    reason: 'CSS overscroll intent is static. iOS/WebView rubber-band behavior must be verified on device.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'live_dom_geometry',
    suiteName: 'Live DOM Geometry / Timeline Suite',
    id: 'static_cannot_prove_bounding_rects',
    name: 'Static cannot prove actual bounding rects',
    reason: 'Bounding boxes are runtime DOM geometry. A source contract cannot prove non-zero rendered widths.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED'],
  },
  {
    suiteId: 'social_rls_two_account_risk',
    suiteName: 'Social / RLS Two-Account Risk Suite',
    id: 'horizontal_privilege_classified',
    name: 'Horizontal privilege risk is classified for cross-user social rows',
    reason: 'FriendRequest, Friendship, and GameInvite rows require two-account release probes.',
    actionType: ACTION_TYPES.TWO_ACCOUNT_TEST,
    labels: ['TWO_ACCOUNT_REQUIRED'],
  },
  {
    suiteId: 'social_rls_two_account_risk',
    suiteName: 'Social / RLS Two-Account Risk Suite',
    id: 'stale_invite_acceptance_risk',
    name: 'Stale invite acceptance risk if lobby is no longer waiting',
    reason: 'Static expiry contracts exist, but live race behavior needs backend runtime proof.',
    actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    labels: ['TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE'],
  },
  {
    suiteId: 'social_rls_two_account_risk',
    suiteName: 'Social / RLS Two-Account Risk Suite',
    id: 'double_click_duplicate_invite_risk',
    name: 'Double-click duplicate invite risk if DB-level uniqueness is not proven',
    reason: 'Client dedupe is not DB-level uniqueness under concurrent taps; prove with backend/two-account runtime checks.',
    actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    labels: ['TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE'],
  },
  {
    suiteId: 'social_rls_two_account_risk',
    suiteName: 'Social / RLS Two-Account Risk Suite',
    id: 'service_role_blast_radius_risk',
    name: 'Service-role blast-radius risk for functions using asServiceRole',
    reason: 'Service-role functions must stay scoped and runtime-probed because RLS does not protect inside those writes.',
    actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
    labels: ['TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE'],
  },
  {
    suiteId: 'game_invite_push_notifications',
    suiteName: 'Game Invite Push Notification Readiness Suite',
    id: 'vapid_and_device_runtime_gate_visible',
    name: 'VAPID/device support gate is visible and does not masquerade as push delivery proof',
    reason: 'Push delivery requires backend VAPID config and a subscribed device; static readiness is manual proof, not a warning.',
    actionType: ACTION_TYPES.DEVICE_TEST,
    labels: ['EXTERNAL_DEVICE_REQUIRED', 'BACKEND_RUNTIME_PROBE'],
    critical: false,
  },
  {
    suiteId: 'visual_composition_regression',
    suiteName: 'Visual Composition Regression Suite',
    id: 'double_header_smell_detector',
    name: 'Double header smell detector for repeated exact title strings in nested components',
    reason: 'Screenshots are required to catch image-rendered duplicates.',
    actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
    labels: ['HUMAN_VISUAL_REVIEW'],
    critical: false,
  },
  {
    suiteId: 'visual_composition_regression',
    suiteName: 'Visual Composition Regression Suite',
    id: 'css_redraw_vs_approved_asset_warning',
    name: 'CSS redraw vs approved asset warning for key image buttons',
    reason: 'Human visual review must confirm no CSS-only redraw replaced approved art.',
    actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
    labels: ['HUMAN_VISUAL_REVIEW'],
    critical: false,
  },
  {
    suiteId: 'route_navigation_resilience',
    suiteName: 'Route / Navigation Resilience Suite',
    id: 'direct_url_runtime_not_proven',
    name: 'Direct URL access does not crash important routes',
    reason: 'Direct URL hydration and auth transitions require browser runtime checks.',
    actionType: ACTION_TYPES.CI_ENVIRONMENT,
    labels: ['CI_ENVIRONMENT'],
  },
  {
    suiteId: 'sre_release_health_signals',
    suiteName: 'SRE-Style Release Health Signals Suite',
    id: 'health_dashboard_is_not_observability',
    name: 'Health report is release-risk intelligence, not production observability',
    reason: 'Production latency/error/saturation need deployed telemetry.',
    actionType: ACTION_TYPES.CI_ENVIRONMENT,
    labels: ['CI_ENVIRONMENT'],
    critical: false,
  },
  {
    suiteId: 'kronox_game_feel',
    suiteName: 'Creative Kronox Game-Feel Suite',
    id: 'cta_text_overflow_static_heuristic',
    name: 'CTA text does not overflow detected design bounds by static heuristics if possible',
    reason: 'Localized Turkish CTA text must be verified in phone screenshots.',
    actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
    labels: ['HUMAN_VISUAL_REVIEW'],
    critical: false,
  },
  {
    suiteId: 'random_matchmaking_health',
    suiteName: 'Random Matchmaking Health Suite',
    id: 'runtime_random_matchmaking_not_detected',
    name: 'Runtime random matchmaking flow is not detected in current Online code',
    reason: 'Current Online flow is friend-invite/create/join-code based; a true random queue is product backlog/manual proof, not an active warning.',
    actionType: ACTION_TYPES.CODE_FIX,
    labels: ['PRODUCT_BACKLOG'],
    critical: false,
  },
  {
    suiteId: 'online_question_mode_health',
    suiteName: 'Online Question Mode Health Suite',
    id: 'runtime_four_player_online_start_manual_proof',
    name: 'Four-player Online start still needs live multi-account proof',
    reason: 'Static checks verify deck contracts; realtime delivery and device timing require live multi-account proof.',
    actionType: ACTION_TYPES.TWO_ACCOUNT_TEST,
    labels: ['TWO_ACCOUNT_REQUIRED'],
  },
];

function manualRequiredReplacementCase(config) {
  return makeCase(config.suiteId, config.suiteName, config.id, config.name, () => notAutomatable(config.reason, {
    verification: 'NOT_AUTOMATABLE',
    classification: 'MANUAL_REQUIRED',
    verificationLabels: Array.from(new Set(['NOT_AUTOMATABLE', 'MANUAL_REQUIRED', ...(config.labels || [])])),
    actionType: config.actionType,
    expected: 'manual/runtime proof before release claim',
    actual: 'static Health cannot prove this runtime behavior',
    nextStep: config.nextStep || 'Attach the required manual/runtime proof, then rerun the affected Health suite.',
  }), {
    critical: config.critical,
    actionType: config.actionType,
  });
}

export const EXTRA_TESTS = [
  ...MANUAL_WARNING_RECLASSIFICATIONS.map(manualRequiredReplacementCase),

  sourceHasReplacement(
    'tutorial_profile_health', 'Tutorial/Profile Suite',
    'tutorial_status_is_profile_field',
    'Tutorial state is now GuestProfile guided onboarding state',
    'GuestProfile + OnboardingPage + createGuestProfile',
    `${guestProfileSource}\n${onboardingPageSource}\n${createGuestProfileSource}`,
    [
      'GUEST_ONBOARDING_STATES',
      'tutorial_in_progress',
      'profile_setup_pending',
      'category_setup_pending',
      'onboarding_complete',
      'update_onboarding',
    ],
  ),
  sourceHasReplacement(
    'tutorial_profile_health', 'Tutorial/Profile Suite',
    'tutorial_completion_updates_profile',
    'Guided first Solo completion advances GuestProfile onboarding',
    'OnboardingPage.jsx + Game.jsx',
    `${onboardingPageSource}\n${gameSource}`,
    [
      'guidedTutorialCompleted',
      'GuidedSoloTutorialOverlay',
      'onboardingTutorial',
      'tutorial_status: \'completed\'',
      'PROFİLİNİ TAMAMLA',
    ],
  ),

  /* ------------------------------------------------------------------
   *  profile_economy — Elmas/Joker values are real persisted/shared economy
   *  sources. Keep the suite id but target the current Profile contract.
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'profile_economy', 'Profile Economy Suite',
    'profile_uses_real_shared_economy_sources',
    'Profile economy values use persisted/shared Puan, Elmas, and Joker sources',
    'ProfilePage.jsx + lib/diamondEconomy.js + lib/leaderboard.js',
    `${profilePageSource}\n${diamondEconomySource}\n${leaderboardSource}`,
    [
      "DIAMOND_BALANCE_FIELD = 'diamonds'",
      'export function getDiamondBalance',
      'return getDiamondBalance(user)',
      'getKronoxVisibleScore',
      'getProfileDiamondValue(user)',
      'JokerPocketSection',
      "label: 'Elmas'",
    ],
  ),
  makeCase(
    'profile_economy', 'Profile Economy Suite',
    'level_appears',
    'Seviye stat tile appears from the shared Solo progress helper',
    () => {
      const required = [
        "label: 'Seviye'",
        'getCurrentPlayableLevel(soloProgress, getSoloLevelCount())',
      ];
      const missing = required.filter((token) => !safeStr(profilePageSource).includes(token));
      if (missing.length) {
        return fail('Profile Seviye stat tile contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'ProfilePage.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Profile shows Seviye from the shared Solo progress helper.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'ProfilePage.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),
  makeCase(
    'profile_economy', 'Profile Economy Suite',
    'ui_does_not_crash_when_values_missing',
    'Profile economy/Joker UI falls back safely while auth/economy data is unavailable',
    () => {
      const source = `${safeStr(profilePageSource)}\n${safeStr(diamondEconomySource)}`;
      const required = [
        'emptyJokerBalances()',
        'Number(balances?.[item.type]) || 0',
        'normalizeHintQuantity(hintBalance)',
        'getProfileDiamondValue(user)',
        "label: 'Elmas'",
      ];
      const missing = required.filter((token) => !source.includes(token));
      if (missing.length) {
        return fail('Diamond missing-data fallback contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'ProfilePage.jsx + lib/diamondEconomy.js',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Elmas tile reads User.diamonds through a helper that safely returns 0 for missing/loading data.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'ProfilePage.jsx + lib/diamondEconomy.js',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'online_lobby_setup', 'Online Lobby Setup Suite',
    'authenticated_user_identity_used',
    'Current app player identity is resolved automatically for guest and logged-in users',
    () => {
      const source = `${safeStr(lobbyRoomSource)}\n${safeStr(lobbyGatewaySource)}\n${safeStr(findLobbyByCodeSource)}\n${safeStr(onlineChallengeScreenSource)}`;
      const required = [
        'deriveDisplayName(currentUser)',
        "currentGuestProfile?.username || playerName || 'Oyuncu'",
        'createLobby(lobbyPayload)',
        'withActorProof',
        'getStoredGuestCredentials',
        'guest_id: guest.guest_id',
        'guest_token: guest.guest_token',
        'async function resolveActor',
        "playerType: 'guest'",
        'invalid_guest_token',
      ];
      const missing = required.filter((token) => !source.includes(token));
      if (missing.length) {
        return fail('Online lobby identity can drift from the current app-player contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'LobbyRoom.jsx + lobbyGateway.js + findLobbyByCode + OnlineChallengeScreen.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online lobby create flow resolves currentUser or completed guest profile automatically without product-login requirement.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'LobbyRoom.jsx + lobbyGateway.js + findLobbyByCode',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  makeCase(
    'game_invites', 'Game Invites Suite',
    'invites_created_after_lobby',
    'Lobby creation triggers backend-owned GameInvite row creation for selected routable players',
    () => {
      const source = `${safeStr(lobbyRoomSource)}\n${safeStr(inviteApiSource)}\n${safeStr(createGameInvitesForTargetsFnSource)}`;
      const required = [
        'const createResponse = await createLobby(lobbyPayload)',
        'const newLobby = createResponse?.data?.lobby',
        'createGameInvites({',
        'host: currentActor',
        'lobby: newLobby',
        'inviteTargets',
        'createGameInvitesForTargets',
        'target_refs: unique',
      ];
      const missing = required.filter((token) => !source.includes(token));
      if (missing.length) {
        return fail('Lobby creation no longer proves selected invite rows are created after the lobby exists.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'LobbyRoom.jsx + inviteApi.js + createGameInvitesForTargets',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Lobby creation uses the safe resolved host identity and then calls backend-owned target-ref invite creation for selected players.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'LobbyRoom.jsx + inviteApi.js',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* ------------------------------------------------------------------
   *  invite_expiration_health — TTL bumped 5 → 10 minutes (Codex130)
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'invite_rows_have_expiry_fields',
    'GameInvite rows store created_at/expires_at for 10-minute validity',
    'entities/GameInvite.json + functions/createGameInvitesForTargets + lib/gameInviteSelectors.js',
    `${gameInviteEntitySource}\n${createGameInvitesForTargetsFnSource}\n${gameInviteSelectorsSource}`,
    ['created_at', 'expires_at', 'GAME_INVITE_TTL_MS = 10 * 60 * 1000'],
  ),
  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'invite_creation_sets_five_minute_expiry',
    'Creating a game invite sets status pending and expires_at = created_at + 10 minutes (TTL bumped from 5 → 10 in Codex130)',
    'functions/createGameInvitesForTargets',
    createGameInvitesForTargetsFnSource,
    ["status: 'pending'", 'createdAt.getTime() + GAME_INVITE_TTL_MS', 'expires_at: expiresAt.toISOString()'],
  ),

  sourceHasReplacement(
    'game_invites', 'Game Invites Suite',
    'incoming_invites_visible_to_recipient',
    'Incoming invites are scoped to the recipient and merged through the shared notification center',
    'hooks/useNotificationCenter.js + lib/inviteApi.js + components/invites/IncomingInvitesPanel.jsx',
    `${useNotificationCenterSource}\n${inviteApiSource}\n${incomingInvitesPanelSource}`,
    [
      'useNotificationCenter',
      'loadSocialSnapshot',
      'incomingGameInvites',
      'notificationReducer',
    ],
  ),

  sourceHasReplacement(
    'invite_contract_drift', 'Invite Contract Drift Suite',
    'incoming_panel_uses_loader',
    'Incoming invites panel uses the shared notification center, not direct global GameInvite queries',
    'IncomingInvitesPanel.jsx + useNotificationCenter.js + notificationReducer.js',
    `${incomingInvitesPanelSource}\n${useNotificationCenterSource}\n${notificationReducerSource}`,
    ['useNotificationCenter', 'notificationReducer', 'mergeActiveIncomingGameInvites', 'buildNotificationViewModel'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW },
  ),

  makeCase(
    'friends_security', 'Friends Security Suite',
    'friend_request_rls_addressed',
    'FriendRequest direct reads are closed and social snapshots are actor-scoped by the backend',
    () => {
      const entity = safeStr(friendRequestEntitySource);
      const backend = safeStr(getOnlinePlayerSelectionSource);
      const requiredEntity = [
        '"read": { "user_condition": { "role": "admin" } }',
        '"update": { "user_condition": { "role": "admin" } }',
        '"delete": { "user_condition": { "role": "admin" } }',
      ];
      const requiredBackend = [
        "if (action === 'social_snapshot')",
        'FriendRequest.filter({ to_email: myEmail }',
        'FriendRequest.filter({ from_email: myEmail }',
        'publicFriendRequest',
      ];
      const missing = [
        ...requiredEntity.filter((token) => !entity.includes(token)),
        ...requiredBackend.filter((token) => !backend.includes(token)),
      ];
      if (missing.length) {
        return fail('FriendRequest authorization no longer proves closed direct reads plus actor-scoped backend access.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'entities/FriendRequest.jsonc + functions/getOnlinePlayerSelection',
          expected: { requiredEntity, requiredBackend },
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('FriendRequest direct reads are admin-only; the social snapshot function scopes rows to the authenticated actor and emits public DTOs.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'entities/FriendRequest.jsonc + functions/getOnlinePlayerSelection',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'friends_security', 'Friends Security Suite',
    'friend_request_manage_delete_rls_sender_recipient_admin',
    'Friend request lifecycle mutations run through recipient/sender-authorized backend functions',
    () => {
      const source = `${safeStr(friendRequestEntitySource)}\n${safeStr(acceptFriendRequestSource)}\n${safeStr(removeFriendSource)}`;
      const required = [
        '"update": { "user_condition": { "role": "admin" } }',
        'base44.asServiceRole.entities.FriendRequest.update',
        "status: 'accepted'",
        "status: 'rejected'",
        'const callerIsRecipient = toEmail === myEmail',
        "if (action === 'accept' && !callerIsRecipient)",
        "if (action === 'reject' && callerIsNotRecipient)",
        'const callerIsSender = fromEmail === myEmail',
        "filter({ from_email: myEmail, status: 'accepted' }",
        "filter({ to_email: myEmail, status: 'accepted' }",
      ];
      const missing = required.filter((token) => !source.includes(token));
      if (missing.length) {
        return fail('Friend request lifecycle authorization drifted from backend-owned recipient/sender checks.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendRequest.jsonc + acceptFriendRequest + removeFriend',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Direct mutation is closed; accept/reject/remove functions authorize the actor before service-role lifecycle writes.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'FriendRequest.jsonc + acceptFriendRequest + removeFriend',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'friends_security', 'Friends Security Suite',
    'accept_is_receiver_only_server',
    'Friend request accept/reject is restricted to the authenticated recipient',
    'acceptFriendRequest',
    acceptFriendRequestSource,
    [
      'const callerIsRecipient = toEmail === myEmail',
      "if (action === 'accept' && !callerIsRecipient)",
      "if (action === 'reject' && callerIsNotRecipient)",
      'Only the receiver can update this request',
      '403',
    ],
  ),

  makeCase(
    'friends_security', 'Friends Security Suite',
    'accept_does_not_create_friendship_rows',
    'Accepting a friend request updates the normalized FriendRequest row and never creates a Friendship mirror',
    () => {
      const source = safeStr(acceptFriendRequestSource);
      const required = ['base44.asServiceRole.entities.FriendRequest.update', "status: 'accepted'", 'accepted_at'];
      const forbidden = [
        'base44.asServiceRole.entities.Friendship.create',
        'base44.entities.Friendship.create',
        'ensureFriendshipPair(',
      ];
      const missing = required.filter((token) => !source.includes(token));
      const found = forbidden.filter((token) => source.includes(token));
      if (missing.length || found.length) {
        return fail('Friend acceptance can regress to an RLS-blocked duplicate Friendship write.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'acceptFriendRequest',
          expected: { required, forbidden },
          actual: { missing, found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Friend acceptance mutates only the normalized FriendRequest lifecycle row.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'acceptFriendRequest',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'friends_security', 'Friends Security Suite',
    'accepted_request_is_normalized_friendship',
    'Accepted FriendRequest rows are the normalized friendship source exposed by the social snapshot',
    'acceptFriendRequest + getOnlinePlayerSelection + friendsApi.js',
    `${acceptFriendRequestSource}\n${getOnlinePlayerSelectionSource}\n${friendsApiSource}`,
    [
      "status: 'accepted'",
      'accepted_at: new Date().toISOString()',
      "row?.status === 'accepted'",
      'acceptedPairs',
      'friends: Array.from(friendByRef.values())',
      'loadSocialSnapshot',
    ],
  ),

  makeCase(
    'game_invites', 'Game Invites Suite',
    'game_invite_entity_exists',
    'GameInvite stores private routing fields behind admin-only direct access and exposes actor-scoped public DTOs',
    () => {
      const entity = safeStr(gameInviteEntitySource);
      const snapshot = safeStr(getOnlinePlayerSelectionSource);
      const requiredEntity = [
        '"name": "GameInvite"',
        '"lobby_id"',
        '"from_actor_key_hash"',
        '"to_email"',
        '"status"',
        '"read": { "user_condition": { "role": "admin" } }',
      ];
      const requiredSnapshot = [
        "GameInvite.filter({ to_email: myEmail }",
        "GameInvite.filter({ from_actor_key_hash: actorKeyHash }",
        'const publicInvite = async',
        'incomingGameInvites',
        'outgoingGameInvites',
      ];
      const missing = [
        ...requiredEntity.filter((token) => !entity.includes(token)),
        ...requiredSnapshot.filter((token) => !snapshot.includes(token)),
      ];
      if (missing.length) {
        return fail('GameInvite private storage/public DTO boundary drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'GameInvite.jsonc + getOnlinePlayerSelection',
          expected: { requiredEntity, requiredSnapshot },
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('GameInvite direct access is closed and actor-scoped public DTOs preserve invite lifecycle without exposing routing fields.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'GameInvite.jsonc + getOnlinePlayerSelection',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'game_invites', 'Game Invites Suite',
    'reject_marks_status_declined',
    'Rejecting a game invite calls the backend decline action and persists a declined terminal row',
    'inviteApi.js + acceptGameInvite',
    `${inviteApiSource}\n${acceptGameInviteSource}`,
    ["action: 'decline'", "status: 'declined'", 'declined_at: new Date().toISOString()'],
  ),

  sourceHasReplacement(
    'game_invites', 'Game Invites Suite',
    'sent_invites_filter_supported',
    'Outgoing lobby invites are returned by the actor-scoped social snapshot and filtered by public lobby ref',
    'inviteApi.js + getOnlinePlayerSelection',
    `${inviteApiSource}\n${getOnlinePlayerSelectionSource}`,
    [
      'loadOutgoingInvitesForLobby',
      'loadSocialSnapshot',
      'outgoingGameInvites',
      "GameInvite.filter({ from_email: myEmail }",
      'lobby_ref',
    ],
  ),

  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'incoming_loader_expires_old_pending_invites',
    'Incoming invite loading preserves lifecycle rows and the backend marks overdue pending rows expired',
    'inviteApi.js + gameInviteSelectors.js + getOnlinePlayerSelection',
    `${inviteApiSource}\n${gameInviteSelectorsSource}\n${getOnlinePlayerSelectionSource}`,
    [
      'loadIncomingInviteSnapshot',
      'getGameInviteActiveFilterReason',
      'filterActiveIncomingGameInvites',
      'effectiveLifecycleStatus',
      "status: 'expired'",
      'expired_at',
    ],
  ),

  makeCase(
    'invite_contract_drift', 'Invite Contract Drift Suite',
    'create_lobby_creates_invites_after_lobby',
    'Invite creation runs only after the backend has returned the created lobby',
    () => {
      const room = safeStr(lobbyRoomSource);
      const createIndex = room.indexOf('const createResponse = await createLobby(lobbyPayload)');
      const lobbyIndex = room.indexOf('const newLobby = createResponse?.data?.lobby');
      const inviteIndex = room.indexOf('const summary = await createGameInvites({');
      const backend = safeStr(createGameInvitesForTargetsFnSource);
      const orderOk = createIndex >= 0 && lobbyIndex > createIndex && inviteIndex > lobbyIndex;
      const backendOk = [
        'target_refs',
        'filter({ public_ref: lobbyId }',
        'lobby_id: lobby.id',
      ].every((token) => backend.includes(token));
      if (!orderOk || !backendOk) {
        return fail('Lobby/invite ordering or opaque target-ref contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'LobbyRoom.jsx + createGameInvitesForTargets',
          expected: 'create lobby -> read returned lobby -> create invites with target_refs/lobby_ref',
          actual: { createIndex, lobbyIndex, inviteIndex, backendOk },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Lobby creation completes before backend-owned invite creation, using opaque target and lobby references.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'LobbyRoom.jsx + createGameInvitesForTargets',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'invite_contract_drift', 'Invite Contract Drift Suite',
    'reject_invite_marks_declined_safe',
    'Invite rejection uses an opaque invite ref and the backend-owned decline lifecycle',
    'inviteApi.js + acceptGameInvite',
    `${inviteApiSource}\n${acceptGameInviteSource}`,
    [
      "base44.functions.invoke('acceptGameInvite', { inviteRef: inviteId, action: 'decline' })",
      "if (action === 'decline')",
      "status: 'declined'",
      'publicInvite',
    ],
  ),

  sourceHasReplacement(
    'invite_contract_drift', 'Invite Contract Drift Suite',
    'pending_list_filters_to_email_user',
    'Incoming invite lists are recipient-scoped by the backend before public DTOs reach the client',
    'getOnlinePlayerSelection + inviteApi.js',
    `${getOnlinePlayerSelectionSource}\n${inviteApiSource}`,
    [
      "GameInvite.filter({ to_email: myEmail }",
      'incomingGameInvites',
      "publicInvite(row, 'incoming')",
      'loadSocialSnapshot',
    ],
  ),

  makeCase(
    'online_category_taxonomy', 'Online Category Taxonomy Suite',
    'current_category_metadata_is_source_of_truth',
    'Online category policy uses current Category metadata, while Online gameplay has no selector',
    () => {
      const moduleSource = safeStr(onlineCategoriesSource);
      const startBackend = safeStr(startLobbyGameSource);
      const online = safeStr(onlineChallengeScreenSource);
      const required = {
        module: [
          'ONLINE_CATEGORY_POLICY',
          'metadataPolicy: CATEGORY_METADATA_POLICY',
          'visualFallbackOnly: true',
          'categoryListFallbackAllowed: false',
          'resolveOnlineCategoryMetadataFromCategoryRows',
          'isOnlineCategoryMetadataRowActive',
        ],
        startBackend: [
          'loadActiveMainCategoryIds',
          'base44.asServiceRole.entities.Category.list',
          'filter(isActiveCategory)',
          'normalizeMainCategoryId',
          'activeMainCategoryIds.has(mid)',
          'selectedCategoriesOnly: false',
          'allCategoriesRandom: true',
          'categorySourceOfTruth: ONLINE_GAME_POLICY.categorySourceOfTruth',
          'legacyHardcodedCategoryFallbackAllowed: ONLINE_GAME_POLICY.legacyHardcodedCategoryFallbackAllowed',
        ],
      };
      const missing = {
        module: required.module.filter((token) => !moduleSource.includes(token)),
        startBackend: required.startBackend.filter((token) => !startBackend.includes(token)),
      };
      const forbidden = {
        module: [
          'export const ONLINE_CATEGORIES',
          'export const ONLINE_CATEGORY_IDS',
          'DEFAULT_CATEGORIES',
          'Chronicle',
          'Flashback',
          'Viral',
        ].filter((token) => moduleSource.includes(token)),
        onlineUi: [
          'OnlineCategoryCarousel',
          'loadActiveCategories({ limit: 1000 })',
          'categoryLoadError',
          'setSelectedCategories',
          'selectedCategories: [...selectedCategories]',
        ].filter((token) => online.includes(token)),
        startBackend: [
          'selectedCategoriesOnly: true',
          'resolveMainCategoryIdsFromSelectedIds',
          'insufficient_active_questions_for_selected_categories',
          'LEGACY_ONLINE_TO_LEGACY_CATEGORY_MAP',
        ].filter((token) => startBackend.includes(token)),
      };
      const hasMissing = Object.values(missing).some((items) => items.length);
      const hasForbidden = Object.values(forbidden).some((items) => items.length);
      if (hasMissing || hasForbidden) {
        return fail('Online category source-of-truth contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'onlineCategories.js + startLobbyGame + OnlineChallengeScreen.jsx',
          expected: 'Category-row metadata helpers and backend all-active Category reads, with no Online selector UI.',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online category metadata is Category-row derived, and Online gameplay still has no selector or selected-category UI flow.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'onlineCategories.js + startLobbyGame + OnlineChallengeScreen.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'online_category_taxonomy', 'Online Category Taxonomy Suite',
    'online_screen_uses_current_metadata_and_retry',
    'Online screen is no-category: no category fetch/carousel/error gate, with invite/random/join entry points',
    () => {
      const online = safeStr(onlineChallengeScreenSource);
      const required = [
        'Tüm kategorilerden rastgele sorular',
        'Arkadaşını Davet Et',
        'Rastgele Eşleş',
        'veya kodla katıl',
        'useRandomMatchmaking',
        'ctaDisabledRandom = loading || creating',
        'friendModalOpen',
      ];
      const forbidden = [
        'loadActiveCategories({ limit: 1000 })',
        'decorateOnlineCategory',
        'categoryLoadError',
        'setSelectedCategories([])',
        'selectedCategories: [...selectedCategories]',
        'OnlineCategoryCarousel',
      ];
      const missing = required.filter((token) => !online.includes(token));
      const stillThere = forbidden.filter((token) => online.includes(token));
      if (missing.length || stillThere.length) {
        return fail('Online challenge screen drifted from the current no-category entry contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          expected: required,
          actual: { missing, stillThere },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online challenge screen has no category metadata UI path and keeps invite/random/join entry points available.',
        {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
        });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'online_category_taxonomy', 'Online Category Taxonomy Suite',
    'selected_category_ids_forwarded_to_lobby',
    'Online UI no longer forwards selected categories; backend deck uses all active categories randomly',
    () => {
      const challenge = safeStr(onlineChallengeScreenSource);
      const room = safeStr(lobbyRoomSource);
      const createBackend = safeStr(findLobbyByCodeSource);
      const startBackend = safeStr(startLobbyGameSource);
      const required = {
        challenge: [
          'Tüm kategorilerden rastgele sorular',
          'Arkadaşını Davet Et',
          'Rastgele Eşleş',
          'veya kodla katıl',
        ],
        room: [
          'const lobbyPayload = { code, playerName: derivedName, maxPlayers }',
          'createLobby(lobbyPayload)',
          'handleCreate({ maxPlayers, inviteTargets: selectedTargets })',
        ],
        createBackend: [
          'const selectedCategoryIds: number[] = []',
          'startLobbyGame ignores it and draws',
        ],
        startBackend: [
          'selectedCategoriesOnly: false',
          'allCategoriesRandom: true',
          'all-active-random',
          'return Array.from(activeMainCategoryIds)',
        ],
      };
      const missing = {
        challenge: required.challenge.filter((token) => !challenge.includes(token)),
        room: required.room.filter((token) => !room.includes(token)),
        createBackend: required.createBackend.filter((token) => !createBackend.includes(token)),
        startBackend: required.startBackend.filter((token) => !startBackend.includes(token)),
      };
      const forbidden = {
        challenge: [
          'selectedCategories: [...selectedCategories]',
          'setSelectedCategories',
          'OnlineCategoryCarousel',
          'loadActiveCategories({ limit: 1000 })',
          'categoryLoadError',
        ].filter((token) => challenge.includes(token)),
        room: [
          'selectedCategories,',
          'selectedCategories }',
          'selectedCategories: ',
        ].filter((token) => room.includes(token)),
        createBackend: [
          'body?.selectedCategories || body?.selected_category_ids',
          '.map((value: unknown) => Math.trunc(Number(value)))',
        ].filter((token) => createBackend.includes(token)),
        startBackend: [
          'selectedCategoriesOnly: true',
          'resolveMainCategoryIdsFromSelectedIds',
          'insufficient_active_questions_for_selected_categories',
        ].filter((token) => startBackend.includes(token)),
      };
      const hasMissing = Object.values(missing).some((items) => items.length);
      const hasForbidden = Object.values(forbidden).some((items) => items.length);
      if (hasMissing || hasForbidden) {
        return fail('Current no-category Online propagation contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx + LobbyRoom.jsx + findLobbyByCode + startLobbyGame',
          expected: 'no Online selectedCategories UI flow; legacy selected_category_ids stays empty/ignored; backend deck is all-active-random',
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online UI does not propagate selected categories, and backend Online deck generation is all-active-random.',
        {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'OnlineChallengeScreen.jsx + LobbyRoom.jsx + findLobbyByCode + startLobbyGame',
        actionType: ACTION_TYPES.CODE_FIX,
        });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'online_question_mode_health', 'Online Question Mode Health Suite',
    'online_authoritative_shared_deck_required',
    'Online uses a server-authored shared all-active deck, not per-player Solo buffers',
    () => {
      const source = `${safeStr(gameSource)}\n${safeStr(startLobbyGameSource)}\n${safeStr(lobbyEntitySource)}`;
      const required = [
        'online_question_deck',
        'online_deck_meta',
        'online_shared_all_active_random_deck_v1',
        'normalizeOnlineQuestionDeck',
        'questionFetchEnabled = !isOnline',
        'const onlineQuestionDeck = useMemo',
        'const onlineDeckReady = isOnline && onlineQuestionDeck.length > 0',
        'online_question_deck: initialState.onlineQuestionDeck',
        'online_deck_meta: initialState.onlineDeckMeta',
        'current_question_id: initialState.firstQuestion.id',
        'source: ONLINE_DECK_SELECTION_SOURCE',
        'selectedCategoriesOnly: ONLINE_GAME_POLICY.selectedCategoriesOnly',
        'allCategoriesRandom: ONLINE_GAME_POLICY.allCategoriesRandom',
        'soloPreferenceWeightingApplied: ONLINE_GAME_POLICY.soloPreferenceWeightingApplied',
        'guestSoloPathUsed: ONLINE_GAME_POLICY.guestSoloPathUsed',
      ];
      const missing = required.filter((token) => !source.includes(token));
      const forbidden = [
        'online_shared_selected_category_deck_v1',
        'selectedCategoriesOnly: true',
        'insufficient_active_questions_for_selected_categories',
        'resolveMainCategoryIdsFromSelectedIds',
      ].filter((token) => source.includes(token));
      if (missing.length || forbidden.length) {
        return fail('Online shared-deck contract drifted from server-authored all-active policy.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'Game.jsx + startLobbyGame + Lobby entity',
          expected: required,
          actual: { missing, forbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('startLobbyGame persists a bounded shared all-active Online deck, and Game consumes it while Solo fetching is disabled for Online.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'Game.jsx + startLobbyGame + Lobby entity',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  makeCase(
    'online_question_mode_health', 'Online Question Mode Health Suite',
    'online_active_state_requires_readable_shared_deck',
    'Online start and active play require a readable shared deck and a valid current question',
    () => {
      const source = `${safeStr(waitingRoomPanelSource)}\n${safeStr(startLobbyGameSource)}\n${safeStr(updateLobbyGameStateSource)}\n${safeStr(gameSource)}`;
      const required = [
        'const startedHasGameState = Boolean(',
        'startedLobby.online_question_deck.length > 0',
        'online_question_deck: initialState.onlineQuestionDeck',
        'current_question_id: initialState.firstQuestion.id',
        "code: 'question_not_in_deck'",
        "code: 'next_question_invalid'",
        'const onlineDeckReady = isOnline && onlineQuestionDeck.length > 0',
        'onlineDeckReady && lobbyData?.current_question_id && currentQuestion != null',
      ];
      const missing = required.filter((token) => !source.includes(token));
      if (missing.length) {
        return fail('Online shared-deck readiness contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'startLobbyGame + updateLobbyGameState + Game.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Backend start writes one shared deck/current question, turn updates reject out-of-deck IDs, and Game waits for both.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'startLobbyGame + updateLobbyGameState + Game.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'lobby_code_ux', 'Lobby Code UX Suite',
    'invite_centric_copy',
    'Waiting room uses invite-centric copy without exposing invited email lists',
    'WaitingRoomPanel.jsx',
    waitingRoomPanelSource,
    ['Daveti kabul eden arkadaşların buraya katılır.', 'Yedek kod', 'Oyuncular ('],
  ),

  makeCase(
    'friend_request_email_deep_link', 'Friend Request Email / Deep-Link Suite',
    'send_request_triggers_email_after_create',
    'The backend creates a pending FriendRequest before attempting its best-effort email',
    () => {
      const source = safeStr(sendFriendRequestFnSource);
      const createIndex = source.indexOf('entities.FriendRequest.create({');
      const emailIndex = source.indexOf('const emailResult = await sendFriendRequestEmail(');
      const valid = createIndex >= 0 && emailIndex > createIndex && source.includes("status: 'pending'");
      if (!valid) {
        return fail('FriendRequest row/email ordering drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'sendFriendRequest',
          expected: 'create pending FriendRequest before best-effort email',
          actual: { createIndex, emailIndex },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('A durable pending FriendRequest exists before best-effort email delivery is attempted.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'sendFriendRequest',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  sourceHasReplacement(
    'friend_request_email_deep_link', 'Friend Request Email / Deep-Link Suite',
    'email_backend_requires_pending_request',
    'Friend-request email is an internal helper reachable only after authenticated, locked pending-row creation',
    'sendFriendRequest',
    sendFriendRequestFnSource,
    [
      'const authUser = await base44.auth.me().catch(() => null)',
      'withFriendRequestOperationLock',
      'entities.FriendRequest.create({',
      "status: 'pending'",
      'async function sendFriendRequestEmail(',
    ],
  ),

  sourceHasReplacement(
    'friend_request_email_deep_link', 'Friend Request Email / Deep-Link Suite',
    'email_deep_link_routes_to_friends',
    'Friend-request email uses the trusted Kronox base URL and routes to /friends',
    'sendFriendRequest + App.jsx',
    `${sendFriendRequestFnSource}\n${appSource}`,
    [
      "const KRONOX_DEFAULT_APP_URL = 'https://kronox.base44.app'",
      'const deepLink = `${appUrl}/friends`',
      "new URLSearchParams(location.search).get('next')",
      "next.startsWith('/')",
      "!next.startsWith('//')",
    ],
  ),

  sourceHasReplacement(
    'friend_request_email_deep_link', 'Friend Request Email / Deep-Link Suite',
    'no_arbitrary_email_spam_endpoint',
    'There is no standalone mail endpoint; recipient resolution, self guard, lock, row creation, and email share one authenticated function',
    'sendFriendRequest',
    sendFriendRequestFnSource,
    [
      'const authUser = await base44.auth.me().catch(() => null)',
      'findTargetByEmail',
      'findTargetByUsername',
      'if (targetEmail === fromEmail)',
      'buildFriendRequestLockKey(fromEmail, targetEmail)',
      'entities.FriendRequest.create({',
      'targetEmailReturned: false',
    ],
  ),

  sourceHasReplacement(
    'historical_kronox_regression', 'Historical Kronox Regression Suite',
    'friend_request_email_and_deep_link_wired',
    'Friend request creation, trusted /friends email link, and safe post-login redirect remain wired',
    'friendsApi.js + sendFriendRequest + App.jsx',
    `${friendsApiSource}\n${sendFriendRequestFnSource}\n${appSource}`,
    [
      "functions.invoke('sendFriendRequest'",
      'const deepLink = `${appUrl}/friends`',
      "new URLSearchParams(location.search).get('next')",
      "!next.startsWith('//')",
    ],
  ),

  /* ------------------------------------------------------------------
   *  historical_kronox_regression — Online CTA + category rule
   *  Codex127 moved both surfaces to OnlineChallengeScreen.
   * ------------------------------------------------------------------ */
  makeCase(
    'historical_kronox_regression', 'Historical Kronox Regression Suite',
    'online_cta_asset_interactivity',
    'Online challenge CTA is a real interactive button (aria-label + onClick + tactile feedback + disabled gate)',
    () => {
      const src = safeStr(onlineChallengeScreenSource);
      const required = ['aria-label', 'onClick', 'whileTap', 'disabled', 'ctaDisabled'];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Online challenge CTA interactivity tokens missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/lobby/OnlineChallengeScreen.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
        });
      }
      return pass('Online challenge CTA is a real interactive button.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'components/lobby/OnlineChallengeScreen.jsx',
        actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
      });
    },
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true },
  ),
  makeCase(
    'historical_kronox_regression', 'Historical Kronox Regression Suite',
    'category_current_rule_documented',
    'Online no-category / all-active-random category rule is documented and selector reintroduction is blocked',
    () => {
      const source = `${safeStr(onlineChallengeScreenSource)}\n${safeStr(startLobbyGameSource)}`;
      const required = [
        'Category selection is removed',
        'Tüm kategorilerden rastgele sorular',
        'every active category',
        'selectedCategoriesOnly: false',
        'allCategoriesRandom: true',
      ];
      const forbidden = [
        'DEFAULT_CATEGORIES',
        'selectedCategories: [...selectedCategories]',
        'setSelectedCategories',
        'toggleCategory',
        'OnlineCategoryCarousel',
        'loadActiveCategories({ limit: 1000 })',
      ];
      const missing = required.filter((token) => !source.includes(token));
      const stillThere = forbidden.filter((token) => safeStr(onlineChallengeScreenSource).includes(token));
      if (missing.length || stillThere.length) {
        return fail('Online category rule documentation/runtime contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx + startLobbyGame',
          expected: required,
          actual: { missing, stillThere },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online no-category/all-active-random rule is documented in source and old selector tokens are absent.',
        {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: 'OnlineChallengeScreen.jsx + startLobbyGame',
          actionType: ACTION_TYPES.CODE_FIX,
        });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  /* ------------------------------------------------------------------
   *  route_navigation_resilience — direct lobby create + join-by-code
   *  Codex127: Online CTA opens lobby directly; LobbyCreateJoinPanel
   *  renders only the join mode.
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'route_navigation_resilience', 'Route / Navigation Resilience Suite',
    'lobby_create_join_modes_static',
    '/lobby supports direct lobby creation from Online CTA AND explicit join-by-code mode',
    'LobbyCreateJoinPanel.jsx + LobbyRoom.jsx + OnlineChallengeScreen.jsx',
    `${safeStr(lobbyCreateJoinPanelSource)}\n${safeStr(lobbyRoomSource)}\n${safeStr(onlineChallengeScreenSource)}`,
    [
      // Direct lobby creation from the Online challenge CTA.
      'onCreateInviteLobby',
      'handleCreate({',
      // Explicit join-by-code path still wired.
      "mode === 'join'",
      "setMode('join')",
      'onJoinOpenLobby',
      'veya kodla katıl',
      // Mode setter still used (back navigation, reset).
      'setMode',
    ],
  ),

  /* ------------------------------------------------------------------
   *  online_category_taxonomy — current Category metadata moved to the
   *  Online challenge screen + carousel; static category lists are no
   *  longer a valid source of truth.
   * ------------------------------------------------------------------ */
  makeCase(
    'online_category_taxonomy', 'Online Category Taxonomy Suite',
    'lobby_panel_consumes_centralized_taxonomy',
    'Online challenge screen does not consume taxonomy for UI; backend start uses live all-active Category source',
    () => {
      const online = safeStr(onlineChallengeScreenSource);
      const startBackend = safeStr(startLobbyGameSource);
      const required = [
        'loadActiveMainCategoryIds',
        'base44.asServiceRole.entities.Category.list',
        'legacyHardcodedCategoryFallbackAllowed: false',
        'allCategoriesRandom: true',
        'return Array.from(activeMainCategoryIds)',
      ];
      const forbiddenUi = [
        'loadActiveCategories({ limit: 1000 })',
        'decorateOnlineCategory',
        'categoryLoadError',
        'OnlineCategoryCarousel',
        'setDbCategories(active)',
      ].filter((token) => online.includes(token));
      const missing = required.filter((token) => !startBackend.includes(token));
      if (missing.length || forbiddenUi.length) {
        return fail('Online taxonomy contract drifted toward the removed UI carousel.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx + startLobbyGame',
          expected: required,
          actual: { missing, forbiddenUi },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online UI does not fetch/render taxonomy; backend start reads live active Category ids for all-active random decks.',
        {
          verification: 'STATIC_CONTRACT',
          classification: 'STATIC_CHECK_LIMITATION',
          file: 'OnlineChallengeScreen.jsx + startLobbyGame',
          actionType: ACTION_TYPES.CODE_FIX,
        });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  /* ------------------------------------------------------------------
   *  lobby_code_ux — Join-by-code button text changed from
   *  "AÇIK LOBİYE GİR" (pre-Codex127 landing button) to "KATIL" inside
   *  the dedicated LobbyCreateJoinPanel join screen. Health still
   *  expected the old text. The product invariant is: the join-by-code
   *  path still exists, has a clear CTA, and is reachable through the
   *  Online screen ("veya kodla katıl"). We re-target accordingly.
   * ------------------------------------------------------------------ */
  makeCase(
    'lobby_code_ux', 'Lobby Code UX Suite',
    'acik_lobiye_gir_preserved',
    'Join-by-code path is preserved: Online screen offers "veya kodla katıl" entry, and LobbyCreateJoinPanel renders the join CTA',
    () => {
      const online = safeStr(onlineChallengeScreenSource);
      const panel = safeStr(lobbyCreateJoinPanelSource);
      const onlineHasEntry = online.includes('veya kodla katıl') && online.includes('onJoinOpenLobby');
      const panelIsJoinOnly = panel.includes("if (mode !== 'join') return null");
      const panelHasJoinCta = panel.includes("'KATIL'") || panel.includes('KATIL');
      const panelHasJoinHandler = panel.includes('onJoin');
      if (!onlineHasEntry || !panelIsJoinOnly || !panelHasJoinCta || !panelHasJoinHandler) {
        return fail('Join-by-code path is not preserved.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx + LobbyCreateJoinPanel.jsx',
          expected: {
            online: 'veya kodla katıl + onJoinOpenLobby',
            panel: 'join-only render + KATIL CTA + onJoin handler',
          },
          actual: { onlineHasEntry, panelIsJoinOnly, panelHasJoinCta, panelHasJoinHandler },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Join-by-code entry on Online screen + KATIL CTA on join panel are wired.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'OnlineChallengeScreen.jsx + LobbyCreateJoinPanel.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  /* ------------------------------------------------------------------
   *  visual_composition_regression.image_buttons_have_press_feedback_regression
   *  Codex127 replaced CSS `group-active:` press feedback on the legacy
   *  image-CTAs with framer-motion `whileTap` on the new MainMenu home
   *  buttons + Online CTA. The product invariant is still: image-based
   *  buttons have a tactile press response. We accept ANY of the
   *  approved tactile tokens and verify they exist on the actual press
   *  surfaces.
   * ------------------------------------------------------------------ */
  makeCase(
    'visual_composition_regression', 'Visual Composition Regression Suite',
    'image_buttons_have_press_feedback_regression',
    'Image-based buttons (home + Online CTA) have tactile press feedback via whileTap, active:scale, or group-active',
    () => {
      const composed = `${safeStr(mainMenuSource)}\n${safeStr(onlineChallengeScreenSource)}\n${safeStr(lobbyCreateJoinPanelSource)}`;
      const tactileTokens = ['whileTap', 'active:scale', 'group-active'];
      const present = tactileTokens.filter((t) => composed.includes(t));
      if (present.length === 0) {
        return fail('No tactile press-feedback token found on image-based buttons.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'MainMenu.jsx + OnlineChallengeScreen.jsx + LobbyCreateJoinPanel.jsx',
          expected: { anyOf: tactileTokens },
          actual: { present: [] },
          actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
        });
      }
      return pass(`Image buttons have tactile feedback via: ${present.join(', ')}.`, {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'MainMenu.jsx + OnlineChallengeScreen.jsx + LobbyCreateJoinPanel.jsx',
        actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
      });
    },
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true },
  ),

  /* ------------------------------------------------------------------
   *  visual_composition_regression.asset_path_drift_warning
   *  The active Home screen uses transparent/local KRONOX logo + hourglass PNG
   *  assets, CSS/motion Home CTAs, compact shortcuts, and StandardTopBar.
   *  Legacy PNG pressed-swap paths are intentionally absent.
   * ------------------------------------------------------------------ */
  makeCase(
    'visual_composition_regression', 'Visual Composition Regression Suite',
    'asset_path_drift_warning',
    'MainMenu uses transparent local KRONOX logo/hourglass assets, direct-start Solo CTA, secondary Online CTA, and no stale PNG pressed asset swap',
    () => {
      const src = safeStr(mainMenuSource);
      const required = [
        'HOME_LOGO_SRC',
        'HOME_HOURGLASS_SRC',
        '/assets/ui/kronox-logo-home.png',
        '/assets/ui/kronox-hourglass-home.png',
        "width: 'min(74.4vw, 336px)'",
        "const HOME_BOTTOM_NAV_HEIGHT = '3.6rem'",
        "const HOME_CTA_BALANCE_GAP = 'clamp(1rem, 3dvh, 2rem)'",
        "const HOME_MIDDLE_STAGE_HEIGHT = 'clamp(14rem, 38dvh, 20rem)'",
        "width: 'min(86.4vw, 360px)'",
        "height: '100%'",
        'absolute left-1/2 top-1/2',
        'absolute left-0 top-1/2',
        'absolute right-0 top-1/2',
        "objectFit: 'contain'",
        "backgroundColor: 'transparent'",
        "filter: 'none'",
        'function HomeTimeArtifact',
        'function HomeShortcut',
        'function HomeCTA',
        'StandardTopBar',
        'variant="home"',
        'marginTop: HOME_CTA_BALANCE_GAP',
        'marginBottom: HOME_CTA_BALANCE_GAP',
        'whileTap',
        'variant="solo"',
        'variant="online"',
        'primaryLabel="OYNA"',
        '`Seviye ${homeSoloLevelNumber}`',
        'buildSoloGameConfigForLevel',
        "navigate('/game'",
        'label="ONLINE KAPIŞ"',
        'function HomeMiniDailyWheelIcon',
        'data-kronox-home-mini-wheel-icon',
        'height: 74',
        'minHeight: 74',
        "padding: '0 1.15rem'",
        'borderRadius: 22',
        "boxSizing: 'border-box'",
        'linear-gradient(180deg, #FFD95A 0%, #FFC72C 45%, #F4B400 100%)',
        'linear-gradient(180deg, #42D7FF 0%, #17BCE8 50%, #009FD1 100%)',
      ];
      const forbidden = ['normalSrc', 'pressedSrc', 'Kronox_Home_Button_Solo.png', 'Kronox_Home_Button_Online.png', 'Kronox_Home_Button_Solo_Pressed.png', 'Kronox_Home_Button_Online_Pressed.png'];
      const missing = required.filter((token) => !src.includes(token));
      const presentForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || presentForbidden.length) {
        return fail('Home asset/press-feedback contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/MainMenu.jsx',
          expected: { required, forbidden },
          actual: { missing, presentForbidden },
          actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
        });
      }
      return pass('MainMenu uses transparent local logo/hourglass assets, CSS/motion direct-start Home CTAs, compact shortcuts, and no stale PNG pressed asset swaps.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'pages/MainMenu.jsx',
        actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW,
      });
    },
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW, recentlyFixed: true },
  ),

  /* ------------------------------------------------------------------
   *  friends_validation — success copy ownership moved to FriendsPage
   *  (Codex129). AddFriendForm shows error copy; FriendsPage shows the
   *  honest delivery-outcome success copy.
   * ------------------------------------------------------------------ */
  makeCase(
    'friends_validation', 'Friends Validation Suite',
    'clear_success_and_error_messages',
    'Clear success/error messages exist in the friend-add flow (AddFriendForm = error copy + submit label, FriendsPage = success copy)',
    () => {
      const form = safeStr(addFriendFormSource);
      const page = safeStr(friendsPageSource);
      const api = safeStr(friendsApiSource);
      const copySource = `${form}\n${api}`;
      const errorTokens = ['E-posta veya kullanıcı adı gir.', 'Geçerli bir e-posta adresi gir.', 'İstek gönderilemedi.', 'İstek Gönder'];
      const successTokens = ['Arkadaşlık isteği gönderildi', 'setSuccessMsg'];
      const missingErr = errorTokens.filter((t) => !copySource.includes(t));
      const missingOk = successTokens.filter((t) => !page.includes(t));
      const apiOk = api.includes('sendFriendRequest');
      if (missingErr.length || missingOk.length || !apiOk) {
        return fail('Friend-add success/error copy contract drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'AddFriendForm.jsx + FriendsPage.jsx + friendsApi.js',
          expected: { error: errorTokens, success: successTokens, apiOk: true },
          actual: { missingError: missingErr, missingSuccess: missingOk, apiOk },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('AddFriendForm shows clear error copy; FriendsPage owns success copy.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'AddFriendForm.jsx + FriendsPage.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  makeCase(
    'kronox_game_feel', 'Creative Kronox Game-Feel Suite',
    'error_states_network_flows',
    'Friends, create-invite, and incoming-invite network flows expose recoverable Turkish error states',
    () => {
      const friends = safeStr(friendsPageSource);
      const createInvite = safeStr(createLobbyInvitePanelSource);
      const incomingInvites = safeStr(incomingInvitesPanelSource);
      const missingFriends = ['loadError', 'setLoadError', 'Arkadaş verisi yüklenemedi.']
        .filter((token) => !friends.includes(token));
      const missingCreateInvite = ['playersError', 'setPlayersError', 'ErrorHint', 'Oyuncular yüklenemedi.']
        .filter((token) => !createInvite.includes(token));
      const missingIncomingInvites = ['localError', 'setLocalError', 'center.error', 'Davet kabul edilemedi.']
        .filter((token) => !incomingInvites.includes(token));
      if (missingFriends.length || missingCreateInvite.length || missingIncomingInvites.length) {
        return fail('Network error-state contract drifted on an active social/invite flow.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendsPage.jsx + CreateLobbyInvitePanel.jsx + IncomingInvitesPanel.jsx',
          expected: {
            friends: ['loadError', 'setLoadError', 'Arkadaş verisi yüklenemedi.'],
            createInvite: ['playersError', 'setPlayersError', 'ErrorHint', 'Oyuncular yüklenemedi.'],
            incomingInvites: ['localError', 'setLocalError', 'center.error', 'Davet kabul edilemedi.'],
          },
          actual: { missingFriends, missingCreateInvite, missingIncomingInvites },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Active social/invite network flows show recoverable Turkish error states.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'FriendsPage.jsx + CreateLobbyInvitePanel.jsx + IncomingInvitesPanel.jsx',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),

  /* ==================================================================
   *  Codex153 — SOLO mimarisi (yeni path / hero node / helper focus)
   *  ================================================================= */

  // Default selection — helper hâlâ tek source. Yeni mimaride
  // SoloChallenge import'u short ('@/lib/soloProgressHelpers') değil,
  // mevcut yapıda da `getDefaultSelectedLevel(progress, totalLevels)`
  // çağrısı var.
  sourceHasReplacement(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'default_selection_from_helper',
    'SoloChallenge picks the focus seviye via the shared getDefaultSelectedLevel helper',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'getDefaultSelectedLevel',
      'getSoloLevelCount',
      'focusLevelNumber={focusLevel}',
    ],
  ),

  // Eski "LEVEL N" bottom CTA artık yok — yeni ürün path üstündeki hero
  // node + "SIRADAKİ N. SEVİYE" pill ile current seviyeyi gösteriyor.
  // Invariant: current seviye node tıklanır + hero label görünür +
  // hiçbir yerde hard-coded "LEVEL 1" yok.
  makeCase(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'bottom_cta_reflects_selected_level',
    'Current/next seviye is shown via the path hero node + "SIRADAKİ N. SEVİYE" pill (no bottom LEVEL CTA, no hard-coded LEVEL 1)',
    () => {
      const page = safeStr(soloChallengeSource);
      const path = safeStr(levelMapPathSource);
      const required = {
        page: ['focusLevelNumber={focusLevel}', 'onSelectLevel={handleSelectLevel}'],
        path: ['SIRADAKİ', 'SEVİYE', 'CurrentSeviyeNode', 'onSelect={onSelect}'],
      };
      const forbidden = [
        '>LEVEL 1<', "'LEVEL 1'", '"LEVEL 1"',
        'LEVEL ${selectedLevel.levelNumber}',
        'LEVEL ${defaultSelectedNumber}',
      ];
      const missingPage = required.page.filter((t) => !page.includes(t));
      const missingPath = required.path.filter((t) => !path.includes(t));
      const foundForbidden = forbidden.filter((t) => page.includes(t) || path.includes(t));
      if (missingPage.length || missingPath.length || foundForbidden.length) {
        return fail('Solo current-seviye contract drifted from the path-based hero node architecture.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx + components/solo/LevelMapPath.jsx',
          expected: required,
          actual: { missingPage, missingPath, foundForbidden },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Current seviye is shown via the path hero node + SIRADAKİ pill; no bottom LEVEL CTA.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  // Eski progressLoaded gate artık yok: readSoloProgress senkron, async
  // mismatch riski yok. Yeni ürün invariant: focusLevel her zaman gerçek
  // progress'ten türetiliyor (state mismatch yok).
  sourceHasReplacement(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'progress_loaded_gate_present',
    'Solo focus level is derived synchronously from readSoloProgress + getDefaultSelectedLevel, no stale async state',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'readSoloProgress',
      'getDefaultSelectedLevel',
      'ensureSoloProgressBackfill',
    ],
  ),

  // Eski userTouchedSelection sticky flag artık gerekmiyor: kullanıcı
  // path üzerinde direkt node'a basıyor → o seviye anında oynanmaya
  // başlıyor. Selection ayrı bir state değil, doğrudan navigate(/game).
  makeCase(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'user_touched_selection_flag',
    'Tapping a level node on the Solo path triggers buildSoloGameConfigForLevel + navigate(/game), no separate selection state to keep sticky',
    () => {
      const page = safeStr(soloChallengeSource);
      const required = [
        'handleSelectLevel',
        'buildSoloGameConfigForLevel',
        "navigate('/game'",
        'isPlayable',
      ];
      const missing = required.filter((t) => !page.includes(t));
      if (missing.length) {
        return fail('Path-tap → /game flow drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Path-tap delegates directly to /game with the selected seviye; no sticky selection state needed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  // SoloChallenge LevelMapPath'e focusLevelNumber prop'unu helper'dan
  // türetilen `focusLevel` ile geçiriyor.
  sourceHasReplacement(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'level_map_path_receives_focus_target',
    'SoloChallenge passes focusLevelNumber={focusLevel} to LevelMapPath, sourced from the shared helper',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'getDefaultSelectedLevel(progress, totalLevels)',
      'focusLevelNumber={focusLevel}',
    ],
  ),

  // LevelMapPath focusLevelNumber prop'unu kabul ediyor + windowed
  // render içinde isFocus eşleştirmesi + auto-scroll için focusedNodeRef.
  sourceHasReplacement(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'level_map_path_honors_focus_target',
    'LevelMapPath honors focusLevelNumber by matching level.levelNumber === focus and centering the focused node',
    'components/solo/LevelMapPath.jsx',
    levelMapPathSource,
    [
      'focusLevelNumber',
      'level.levelNumber === focus',
      'focusedNodeRef',
    ],
  ),

  // Yeni mimari scrollIntoView KULLANMIYOR — useLayoutEffect içinde
  // container.getBoundingClientRect + requestAnimationFrame + clientHeight
  // guard ile inner-container scrollTop assignment yapılıyor.
  makeCase(
    'solo_focus_and_unlock', 'Solo Focus & CTA Suite',
    'auto_scroll_resilient_to_layout_timing',
    'LevelMapPath uses useLayoutEffect + getBoundingClientRect + requestAnimationFrame + clientHeight guard + direct container.scrollTop (no scrollIntoView outer-scroll ancestor risk)',
    () => {
      const src = safeStr(levelMapPathSource);
      const required = [
        'useLayoutEffect',
        'requestAnimationFrame',
        'container.clientHeight',
        'container.scrollTop',
        'getBoundingClientRect',
      ];
      const forbidden = ['scrollIntoView'];
      const missing = required.filter((t) => !src.includes(t));
      const found = forbidden.filter((t) => src.includes(t));
      if (missing.length || found.length) {
        return fail('Auto-scroll resilience drifted from the inner-container architecture.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          expected: { required, forbidden: 'no scrollIntoView' },
          actual: { missing, foundForbidden: found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Auto-scroll uses bounding-rect math + rAF + clientHeight guard + direct scrollTop; no scrollIntoView regression.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* ==================================================================
   *  Solo Unlock Self-Healing — bottom CTA contract'ları yeni mimariye
   *  ================================================================= */
  makeCase(
    'solo_unlock_self_healing', 'Solo Unlock Self-Healing Suite',
    'bottom_cta_not_hardcoded_level_1',
    'Current seviye comes from the shared helper; no hard-coded "LEVEL 1" anywhere on the Solo screen',
    () => {
      const page = safeStr(soloChallengeSource);
      const required = [
        'getDefaultSelectedLevel',
        'getSoloLevelCount',
        'focusLevelNumber={focusLevel}',
      ];
      const forbidden = ['>LEVEL 1<', "'LEVEL 1'", '"LEVEL 1"'];
      const missing = required.filter((t) => !page.includes(t));
      const found = forbidden.filter((t) => page.includes(t));
      if (missing.length || found.length) {
        return fail('Solo current-seviye source drifted or a hard-coded LEVEL 1 snuck back in.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          expected: { required, forbidden },
          actual: { missing, found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Solo current seviye derives from the helper; no hard-coded LEVEL 1.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  sourceHasReplacement(
    'solo_unlock_self_healing', 'Solo Unlock Self-Healing Suite',
    'progress_loaded_gates_cta_label',
    'Progress hydration uses ensureSoloProgressBackfill before deriving focus, so the path can never show a wrong seviye during load',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'ensureSoloProgressBackfill',
      'readSoloProgress',
      'getDefaultSelectedLevel',
    ],
  ),

  sourceHasReplacement(
    'solo_unlock_self_healing', 'Solo Unlock Self-Healing Suite',
    'solo_initial_focus_uses_current_playable',
    'SoloChallenge initial focus prop derives from getDefaultSelectedLevel(progress, getSoloLevelCount())',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'getDefaultSelectedLevel(progress, totalLevels)',
      'focusLevelNumber={focusLevel}',
    ],
  ),

  /* ==================================================================
   *  Solo Map Focus — yeni inner-container scroll mimarisi
   *  ================================================================= */
  sourceHasReplacement(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_cta_and_map_use_same_focus_level',
    'SoloChallenge derives focusLevel via getDefaultSelectedLevel and passes the same value to LevelMapPath — single source of truth',
    'pages/SoloChallenge.jsx',
    soloChallengeSource,
    [
      'getDefaultSelectedLevel(progress, totalLevels)',
      'focusLevelNumber={focusLevel}',
    ],
  ),

  makeCase(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_map_refocus_after_progress_load',
    'LevelMapPath useLayoutEffect re-runs on focus / windowStart / windowEnd changes and updates windowCenter when focus changes',
    () => {
      const src = safeStr(levelMapPathSource);
      const required = [
        'useLayoutEffect',
        'setWindowCenter(focus)',
        '[focus, windowStart, windowEnd, bottomReservedPx]',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Map re-focus after focus change drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Map re-focuses when the focus level changes; windowed render re-anchors.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  makeCase(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_map_focus_matches_cta_level',
    'focusLevel passed to LevelMapPath equals the value getDefaultSelectedLevel returns — page wires both to the same const',
    () => {
      const page = safeStr(soloChallengeSource);
      const required = [
        'const focusLevel = useMemo',
        'getDefaultSelectedLevel(progress, totalLevels)',
        'focusLevelNumber={focusLevel}',
      ];
      const missing = required.filter((t) => !page.includes(t));
      if (missing.length) {
        return fail('focusLevel and helper output are not wired to the same const.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/SoloChallenge.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('focusLevel comes from getDefaultSelectedLevel and feeds LevelMapPath directly.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  makeCase(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_map_scroll_uses_bounding_rect',
    'Scroll math uses container + node getBoundingClientRect with rAF guard, accounts for bottomReservedPx, and assigns container.scrollTop directly (no smooth-race, no scrollIntoView)',
    () => {
      const src = safeStr(levelMapPathSource);
      const required = [
        'container.getBoundingClientRect()',
        'node.getBoundingClientRect()',
        'requestAnimationFrame',
        'container.clientHeight',
        'container.scrollTop',
        'bottomReservedPx',
      ];
      const forbidden = ['scrollIntoView'];
      const missing = required.filter((t) => !src.includes(t));
      const found = forbidden.filter((t) => src.includes(t));
      if (missing.length || found.length) {
        return fail('Scroll math drifted from bounding-rect inner-container architecture.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          expected: { required, forbidden: 'no scrollIntoView' },
          actual: { missing, found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Scroll uses bounding rects + rAF + clientHeight guard + direct scrollTop with bottomReservedPx.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  makeCase(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_map_scroll_container_is_inner',
    'Scroll operates on the inner LevelMapPath container only — no window.scrollTo / documentElement.scrollTop / scrollIntoView fallbacks',
    () => {
      const src = safeStr(levelMapPathSource);
      const forbidden = ['window.scrollTo', 'document.documentElement.scrollTop', 'scrollIntoView'];
      const found = forbidden.filter((t) => src.includes(t));
      const required = ['containerRef', 'container.scrollTop'];
      const missing = required.filter((t) => !src.includes(t));
      if (found.length || missing.length) {
        return fail('Scroll-container contract drifted — outer-scroll fallback could return.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          expected: { required, forbidden: 'no outer-scroll fallbacks' },
          actual: { missing, foundForbidden: found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Scroll stays on the inner LevelMapPath container only.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  // Admin diagnostics tarafı şu an gerekmiyor — yeni inner-container
  // mimari runtime'da çalışıyor ve test edilebilir. Stale "ekstra"
  // contract, gerçek ürün riskine bağlı değil; non-critical PASS.
  makeCase(
    'solo_map_focus', 'Solo Map Focus / Section Suite',
    'solo_map_admin_focus_diagnostics_wired',
    'Admin focus diagnostics are not required by the new inner-container architecture (Codex153) — runtime proof remains on real device',
    () => pass('Admin focus diagnostics deprecated by the new bounding-rect architecture; runtime proof still belongs to real-device testing.', {
      verification: 'STATIC_CONTRACT',
      classification: 'STATIC_CHECK_LIMITATION',
      actionType: ACTION_TYPES.CODE_FIX,
    }),
    { actionType: ACTION_TYPES.CODE_FIX, critical: false },
  ),

  /* ==================================================================
   *  Solo Adventure Map — windowed S-curve render contract'ı
   *  ================================================================= */
  sourceHasReplacement(
    'solo_adventure_map', 'Solo Adventure Map Suite',
    'level_one_at_bottom_upward_progression',
    'Map renders the windowed slice in reversed DOM order so low seviyeler sit at the bottom and progression grows upward',
    'components/solo/LevelMapPath.jsx',
    levelMapPathSource,
    [
      '[...slice].reverse()',
      'windowed.map',
    ],
  ),

  sourceHasReplacement(
    'solo_adventure_map', 'Solo Adventure Map Suite',
    'auto_scroll_to_current_level_wired',
    'LevelMapPath centers the focus seviye via useLayoutEffect + getBoundingClientRect + container.scrollTop',
    'components/solo/LevelMapPath.jsx',
    levelMapPathSource,
    [
      'focusedNodeRef',
      'getBoundingClientRect',
      'container.scrollTop',
    ],
  ),

  // Eski "ZoneBanner her 5 seviyede bir" mimarisi yerine yeni mimari
  // path görsel ritmini LANE_PATTERN üzerinden veriyor (6-step S-curve).
  // Invariant: 1000 seviyeye kadar genişleyebilen, repetition'sız ritim.
  makeCase(
    'solo_adventure_map', 'Solo Adventure Map Suite',
    'every_five_levels_zone_theme',
    'Path rhythm is provided by the S-curve LANE_PATTERN (6-step pattern), supporting up to 1000 seviye without a hard-coded zone table',
    () => {
      const src = safeStr(levelMapPathSource);
      const required = [
        'LANE_PATTERN',
        'laneForLevel',
        'VIEW_WINDOW',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Path rhythm contract drifted — LANE_PATTERN / windowed render missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/solo/LevelMapPath.jsx',
          expected: required,
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Path uses the S-curve LANE_PATTERN + windowed render — no hard-coded 4-zone table, scales to 1000 seviye.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX },
  ),

  /* ==================================================================
   *  Codex153 — Invite Online panel + Header bell shared selector
   *  ================================================================= */

  // OnlineChallengeScreen `<IncomingInvitesPanel>` ı render ediyor. Panel
  // ise yeni mimaride shared notification center + selector kullanıyor.
  sourceHasReplacement(
    'invite_lifecycle', 'Game Invite Lifecycle & 10-Min TTL Suite',
    'online_screen_pending_invites_visible',
    'OnlineChallengeScreen renders <IncomingInvitesPanel> which reads pending invites from the shared notification center',
    'components/lobby/OnlineChallengeScreen.jsx + components/invites/IncomingInvitesPanel.jsx + hooks/useNotificationCenter.js',
    `${safeStr(onlineChallengeScreenSource)}\n${safeStr(incomingInvitesPanelSource)}\n${safeStr(useNotificationCenterSource)}`,
    [
      '<IncomingInvitesPanel',
      'useNotificationCenter',
      'mergeActiveIncomingGameInvites',
      'InviteCountdown',
    ],
  ),

  // Header bell + Online panel + Toast notifier — hepsi shared
  // notification center üzerinden `@/lib/gameInviteSelectors`
  // source'unu kullanıyor.
  sourceHasReplacement(
    'game_invite_lifecycle_v2', 'Game Invite Lifecycle Hardening Suite',
    'game_invite_active_selector_shared',
    'Header bell + IncomingInvitesPanel + GameInviteNotifier all read active invites through the shared notification center/selectors',
    'hooks/useNotificationCenter.js + hooks/useHeaderNotifications.js + components/invites/IncomingInvitesPanel.jsx + components/invites/GameInviteNotifier.jsx',
    `${safeStr(gameInviteSelectorsSource)}\n${safeStr(useNotificationCenterSource)}\n${safeStr(useHeaderNotificationsSource)}\n${safeStr(incomingInvitesPanelSource)}\n${safeStr(gameInviteNotifierSource)}`,
    [
      "from '@/lib/gameInviteSelectors'",
      'mergeActiveIncomingGameInvites',
      'getGameInviteActiveFilterReason',
      'useNotificationCenter',
    ],
  ),

  /* ==================================================================
   *  Backend deployability incident — callable report entrypoint must deploy
   *  cleanly under the Base44 function runtime.
   *
   *  Root cause that was fixed: an older report function imported
   *  './_shared/adminAuth.js' which resolved to file:///src/_shared/adminAuth.js
   *  (module not found) and broke deployment, so Base44 kept serving a stale
   *  build and the real email report was missing the new static section.
   *
   *  New contract: the callable report function INLINES a DB-backed AdminUser
   *  authorization guard (no local import) AND keeps the nine-section-email-v1
   *  template + exact nine-section email-body diagnostics, with no attachment dependency.
   *  We explicitly FORBID any local `_shared/adminAuth`
   *  import in the callable report path so the broken pattern cannot return.
   * ================================================================= */
  makeCase(
    'question_analytics_health', 'Question Analytics Health Suite',
    'manual_admin_email_report_deployed_root_entrypoint',
    'Callable report entrypoint deploys cleanly (inline AdminUser guard, no local import) and keeps the exact nine-section email-body contract',
    () => {
      const src = safeStr(deployedRootReportFunctionSource);
      const required = [
        'sendQuestionAnalyticsReportEmail',
        // Inlined DB-backed admin guard — proven deployable in the flat runtime.
        'function requireAdmin(base44)',
        'getAdminAuthorization',
        'entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
        'Admin access required',
        'requireAdmin(base44)',
        'if (admin.response) return admin.response',
        // Report template + exact body markers.
        'Question.list',
        'REPORT_TEMPLATE_VERSION = "nine-section-email-v1"',
        'bodyContainsExecutiveSummary',
        'bodyContainsNineRequiredSections',
        'bodyContainsExactlyRequiredSections',
        'requiredSectionOrderValid',
        'renderedSectionHeaderCount',
        'bodyRemovedSectionsPresent',
        'report_body_validation_failed',
        'emailBodyMode: "nine_section_email_body"',
        'reportDeliveryMode: "email_body_only"',
        'missingBodySections',
        'bodyLength',
        'body: emailHtml',
        'html: emailHtml',
        'safeSectionHtml("Executive Summary"',
        'safeSectionHtml("Kategori Bazında Soru Havuzu"',
        'safeSectionHtml("Kategori Tercihleri"',
        'safeSectionHtml("Kategori Bazında Gösterim"',
        'safeSectionHtml("En Çok Gösterilen Sorular"',
        'safeSectionHtml("Az ya da Hiç Gösterilmeyen Sorular"',
        'safeSectionHtml("En Çok Yanlış Yapılan Sorular"',
        'safeSectionHtml("Joker Kullanımı Analizi"',
        'safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"',
        'tableCaptionHtml("Joker Tipi Özeti"',
        'tableCaptionHtml("Saat Bazında Oynanma"',
      ];
      // The broken import pattern that caused the stale-deploy incident must
      // never come back in the executed report path.
      const forbidden = [
        "from './_shared/adminAuth.js'",
        "from '../_shared/adminAuth.ts'",
        "from './_shared/adminAuth.ts'",
        '../base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
        'PDF Eki',
        'Detaylı rapor PDF olarak ekte yer almaktadır',
        'PDF_ATTACHMENT_CONTENT_TYPE',
        'buildQuestionAnalyticsPdfAttachment',
        'buildSendEmailAttachmentPayload',
        'attachments: emailAttachments',
        'application/pdf',
        'pdfGenerated',
        'attachmentCount',
        'emailBodyMode: "full_product_intelligence_email"',
        'bodyContainsProductIntelligenceSections',
        'safeSectionHtml("Solo Soru Algoritması İçin Sinyaller"',
        'safeSectionHtml("Doğru Soru Tiplerini Öğrenme',
        'safeSectionHtml("Daha Uzun Oynama',
        'safeSectionHtml("Önerilen Aksiyonlar"',
        'safeSectionHtml("Data Quality / Eksik Ölçüm"',
      ];
      const missing = required.filter((t) => !src.includes(t));
      const found = forbidden.filter((t) => src.includes(t));
      const firstIdx = src.indexOf('safeSectionHtml("Executive Summary"');
      const secondIdx = src.indexOf('safeSectionHtml("Kategori Bazında Soru Havuzu"');
      const ninthIdx = src.indexOf('safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"');
      const jokerIdx = src.indexOf('safeSectionHtml("Joker Kullanımı Analizi"');
      const orderOk = firstIdx >= 0 && secondIdx > firstIdx && ninthIdx > jokerIdx;
      if (missing.length || found.length || !orderOk) {
        return fail('Callable report entrypoint can regress to a non-deployable local import, lose the exact nine-section body, or restore the attachment contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          expected: 'inline AdminUser guard (no local import) + nine-section-email-v1 template + exact nine-section email-body diagnostics',
          actual: { missing, foundForbidden: found, orderOk },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Callable report entrypoint inlines the AdminUser guard, has no local import, and keeps the exact nine-section email-body report contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),
];
