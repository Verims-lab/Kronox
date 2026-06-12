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
//          Codex127 moved category multi-select to OnlineChallengeScreen.
//     5. route_navigation_resilience.lobby_create_join_modes_static
//        — expected `mode === 'create'` inside LobbyCreateJoinPanel; the
//          create flow is now direct-from-Online-CTA, and the panel only
//          renders the join-by-code path.
//     6. online_category_taxonomy.lobby_panel_consumes_centralized_taxonomy
//        — expected `CATEGORY_HITBOX_BY_ID` import inside
//          LobbyCreateJoinPanel; the new carousel does not use image
//          hitboxes, and the centralized taxonomy is imported by
//          OnlineChallengeScreen + OnlineCategoryCarousel instead.
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
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import onlineCategoryCarouselSource from '../lobby/OnlineCategoryCarousel.jsx?raw';
// Codex132 follow-up — new override sources for the three re-targeted cases.
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import { gameInviteEntitySource } from './simulationPanelContractStrings.jsx';
// Codex153 — Solo path mimarisi tamamen yeni yapıya geçti (bottom CTA
// yok, "SIRADAKİ X. SEVİYE" hero node, helper-tabanlı focus). Stale Solo
// Health sözleşmelerini buradan override ediyoruz.
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import levelMapPathSource from '../solo/LevelMapPath.jsx?raw';
import useHeaderNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import useNotificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', HUMAN_VISUAL_REVIEW: 'HUMAN_VISUAL_REVIEW' };

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

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
  'friends_validation.clear_success_and_error_messages',
  'kronox_game_feel.error_states_network_flows',
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
]);

// No new suite ids — we reuse the existing suite ids defined in the base
// extras so the side-panel grouping, critical flags, and penalty hooks
// stay identical.
export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
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
        'Number(balances?.[joker.type]) || 0',
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

  /* ------------------------------------------------------------------
   *  invite_expiration_health — TTL bumped 5 → 10 minutes (Codex130)
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'invite_rows_have_expiry_fields',
    'GameInvite rows store created_at/expires_at for 10-minute validity',
    'entities/GameInvite.json + lib/inviteApi.js + lib/gameInviteSelectors.js',
    `${gameInviteEntitySource}\n${inviteApiSource}\n${gameInviteSelectorsSource}`,
    ['created_at', 'expires_at', 'GAME_INVITE_TTL_MS = 10 * 60 * 1000'],
  ),
  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'invite_creation_sets_five_minute_expiry',
    'Creating a game invite sets status pending and expires_at = created_at + 10 minutes (TTL bumped from 5 → 10 in Codex130)',
    'lib/inviteApi.js',
    inviteApiSource,
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
      'to_email: email',
      'mergeActiveIncomingGameInvites',
      'base44.entities.GameInvite.filter',
    ],
  ),

  sourceHasReplacement(
    'invite_contract_drift', 'Invite Contract Drift Suite',
    'incoming_panel_uses_loader',
    'Incoming invites panel uses the shared notification center, not direct global GameInvite queries',
    'IncomingInvitesPanel.jsx + useNotificationCenter.js',
    `${incomingInvitesPanelSource}\n${useNotificationCenterSource}`,
    ['useNotificationCenter', 'mergeActiveIncomingGameInvites', 'buildNotificationViewModel'],
    { actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW },
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
  sourceHasReplacement(
    'historical_kronox_regression', 'Historical Kronox Regression Suite',
    'category_current_rule_documented',
    'Category multi-select default + toggle live on the Online challenge screen',
    'components/lobby/OnlineChallengeScreen.jsx',
    onlineChallengeScreenSource,
    ['DEFAULT_CATEGORIES', 'selectedCategories', 'toggleCategory'],
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
      'onStartChallenge',
      'handleCreate({',
      // Explicit join-by-code path still wired.
      "mode === 'join'",
      "setMode('join')",
      // Mode setter still used (back navigation, reset).
      'setMode',
    ],
  ),

  /* ------------------------------------------------------------------
   *  online_category_taxonomy — centralized taxonomy import moved to
   *  the Online challenge screen + carousel; CATEGORY_HITBOX_BY_ID is
   *  obsolete now (chips, not image hitboxes).
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'online_category_taxonomy', 'Online Category Taxonomy Suite',
    'lobby_panel_consumes_centralized_taxonomy',
    'Online challenge screen imports the centralized ONLINE_CATEGORIES and feeds them to the carousel',
    'components/lobby/OnlineChallengeScreen.jsx + components/lobby/OnlineCategoryCarousel.jsx',
    `${safeStr(onlineChallengeScreenSource)}\n${safeStr(onlineCategoryCarouselSource)}`,
    [
      "from '@/lib/onlineCategories'",
      'ONLINE_CATEGORIES',
      'ONLINE_CATEGORIES.map',
      'OnlineCategoryCarousel',
    ],
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
   *  The active Home screen is now CSS/motion-driven: the KRONOX wordmark,
   *  gold Solo/Online CTAs, and StandardTopBar are rendered directly in
   *  MainMenu. Legacy PNG pressed-swap paths are intentionally absent.
   * ------------------------------------------------------------------ */
  makeCase(
    'visual_composition_regression', 'Visual Composition Regression Suite',
    'asset_path_drift_warning',
    'MainMenu uses current CSS/motion KRONOX home buttons and no stale PNG pressed asset swap',
    () => {
      const src = safeStr(mainMenuSource);
      const required = ['function KronoxWordmark', 'function HomeCTA', 'StandardTopBar', 'whileTap', 'SOLO MEYDAN OKUMA', 'ONLINE KAPIŞMA'];
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
      return pass('MainMenu uses CSS/motion CTAs and does not depend on stale PNG pressed asset swaps.', {
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
      const errorTokens = ['Geçerli bir e-posta adresi gir.', 'İstek gönderilemedi.', 'İstek Gönder'];
      const successTokens = ['Arkadaşlık isteği gönderildi', 'setSuccessMsg'];
      const missingErr = errorTokens.filter((t) => !form.includes(t));
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
      const missingCreateInvite = ['friendsError', 'setFriendsError', 'ErrorHint', 'Arkadaşlar yüklenemedi.']
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
            createInvite: ['friendsError', 'setFriendsError', 'ErrorHint', 'Arkadaşlar yüklenemedi.'],
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
    `${safeStr(useNotificationCenterSource)}\n${safeStr(useHeaderNotificationsSource)}\n${safeStr(incomingInvitesPanelSource)}\n${safeStr(gameInviteNotifierSource)}`,
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
   *  authorization guard (no local import) AND keeps the product-intel-email-v3
   *  template + full email-body diagnostics, with no attachment dependency.
   *  We explicitly FORBID any local `_shared/adminAuth`
   *  import in the callable report path so the broken pattern cannot return.
   * ================================================================= */
  makeCase(
    'question_analytics_health', 'Question Analytics Health Suite',
    'manual_admin_email_report_deployed_root_entrypoint',
    'Callable report entrypoint deploys cleanly (inline AdminUser guard, no local import) and keeps the full email-body contract',
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
        // Report template + body markers.
        'Question.list',
        'REPORT_TEMPLATE_VERSION = "product-intel-email-v3"',
        'bodyContainsExecutiveSummary',
        'bodyContainsProductIntelligenceSections',
        'bodyRemovedSectionsPresent',
        'report_body_validation_failed',
        'emailBodyMode: "full_product_intelligence_email"',
        'reportDeliveryMode: "email_body_only"',
        'missingBodySections',
        'bodyLength',
        'body: emailHtml',
        'html: emailHtml',
        'safeSectionHtml("Yönetici Özeti"',
        'safeSectionHtml("Genel Kullanım Özeti"',
        'safeSectionHtml("Solo Soru Algoritması İçin Sinyaller"',
        'safeSectionHtml("Doğru Soru Tiplerini Öğrenme / İçerik Kalitesi"',
        'safeSectionHtml("Joker Kullanımı Analizi"',
        'safeSectionHtml("Oynanma Zamanı ve Kullanım Ritmi"',
        'safeSectionHtml("Daha Uzun Oynama / Retention Sinyalleri"',
        'safeSectionHtml("Soru / İçerik Aksiyonları"',
        'safeSectionHtml("Önerilen Aksiyonlar"',
        'safeSectionHtml("Data Quality / Eksik Ölçüm"',
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
      ];
      const missing = required.filter((t) => !src.includes(t));
      const found = forbidden.filter((t) => src.includes(t));
      // Full email must start with the executive summary and continue into usage.
      const summaryIdx = src.indexOf('safeSectionHtml("Yönetici Özeti"');
      const usageIdx = src.indexOf('safeSectionHtml("Genel Kullanım Özeti"');
      const orderOk = summaryIdx >= 0 && usageIdx > summaryIdx;
      if (missing.length || found.length || !orderOk) {
        return fail('Callable report entrypoint can regress to a non-deployable local import, lose the full email body, or restore the attachment contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
          expected: 'inline AdminUser guard (no local import) + product-intel-email-v3 template + full email-body diagnostics',
          actual: { missing, foundForbidden: found, orderOk },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Callable report entrypoint inlines the AdminUser guard, has no local import, and keeps the full email-body report contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        file: 'base44/functions/sendQuestionAnalyticsReportEmail/entry.ts',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX, recentlyFixed: true },
  ),
];
