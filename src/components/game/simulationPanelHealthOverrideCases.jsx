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

import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import onlineCategoryCarouselSource from '../lobby/OnlineCategoryCarousel.jsx?raw';
import { gameInviteEntitySource } from './simulationPanelContractStrings.jsx';

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
]);

// No new suite ids — we reuse the existing suite ids defined in the base
// extras so the side-panel grouping, critical flags, and penalty hooks
// stay identical.
export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
  /* ------------------------------------------------------------------
   *  invite_expiration_health — TTL bumped 5 → 10 minutes (Codex130)
   * ------------------------------------------------------------------ */
  sourceHasReplacement(
    'invite_expiration_health', 'Invite Expiration Health Suite',
    'invite_rows_have_expiry_fields',
    'GameInvite rows store created_at/expires_at for 10-minute validity',
    'entities/GameInvite.json + lib/inviteApi.js',
    `${gameInviteEntitySource}\n${inviteApiSource}`,
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
];