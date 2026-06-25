// Kronox Health Center — Game Invite Lifecycle contracts (Codex130).
//
// SCOPE
//   Codex130 updates the Game Invite lifecycle:
//     • TTL bumped 5 → 10 minutes (UI + backend + push handler).
//     • Stale waiting lobby guard (10 min) on both findLobbyByCode +
//       acceptGameInvite, plus a client-side `isLobbyStale` helper used by
//       LobbyRoom deep-link / accept-and-navigate paths.
//     • GameInviteNotifier: foreground banner persists until explicit
//       close/open or confirmed source invalidation; focus / visibilitychange
//       recheck keeps background-arrived invites available when the app reopens.
//
// CODEX132 — Health stability fix:
//   Previous version did `await import('../../functions/*.js?raw')` and
//   `await import('../../components/...?raw')` inside run handlers. Files
//   that live OUTSIDE /src (functions/, entities/) sometimes fail Vite's
//   dynamic chunk evaluation, causing the test to throw TypeError
//   ("Cannot convert object to primitive value"). We now:
//     • mirror function sources through simulationPanelContractStrings
//       (same pattern existing Health cases use), and
//     • import in-/src/ component sources statically at module top, so
//       they cannot intermittently fail.
//   Result: invite_lifecycle cases either PASS or FAIL cleanly — they
//   never throw.

import { GAME_INVITE_TTL_MS, LOBBY_STALE_AFTER_MS, isLobbyStale } from '@/lib/inviteApi';
import {
  acceptGameInviteFnSource,
  sendGameInvitePushFnSource,
  findLobbyByCodeFnSource,
} from './simulationPanelContractStrings.jsx';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import useNotificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import inviteCountdownSource from '../invites/InviteCountdown.jsx?raw';
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import appSource from '../../App.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };

const SUITE_NAMES = {
  invite_lifecycle: 'Game Invite Lifecycle & 10-Min TTL Suite',
};

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

function safeStr(src) {
  // Defensive: never let object-to-primitive conversion throw.
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

export const EXTRA_SUITES = [
  {
    id: 'invite_lifecycle',
    name: SUITE_NAMES.invite_lifecycle,
    critical: true,
    color: '#fbbf24',
  },
];

export const EXTRA_TESTS = [
  /* 1. TTL is 10 minutes — single source of truth */
  makeCase('invite_lifecycle', 'game_invite_ttl_10_minutes_contract',
    'GAME_INVITE_TTL_MS resolves to 10 minutes',
    () => {
      const expected = 10 * 60 * 1000;
      if (GAME_INVITE_TTL_MS !== expected) {
        return fail(`GAME_INVITE_TTL_MS=${GAME_INVITE_TTL_MS}, expected ${expected}.`, {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('GAME_INVITE_TTL_MS = 10 minutes.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Backend acceptGameInvite TTL mirrors 10 min */
  makeCase('invite_lifecycle', 'backend_accept_ttl_is_10_minutes',
    'functions/acceptGameInvite uses 10 * 60 * 1000 as GAME_INVITE_TTL_MS',
    () => {
      const src = safeStr(acceptGameInviteFnSource);
      if (!src.includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000')) {
        return fail('Backend acceptGameInvite TTL mirror is not 10 minutes.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (src.includes('GAME_INVITE_TTL_MS = 5 * 60 * 1000')) {
        return fail('Backend acceptGameInvite mirror still contains a 5-minute TTL.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Backend acceptGameInvite TTL = 10 minutes.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Backend push notifier TTL mirrors 10 min */
  makeCase('invite_lifecycle', 'backend_push_ttl_is_10_minutes',
    'functions/sendGameInvitePush uses 10 * 60 * 1000 as GAME_INVITE_TTL_MS',
    () => {
      const src = safeStr(sendGameInvitePushFnSource);
      if (!src.includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000')) {
        return fail('Backend sendGameInvitePush TTL mirror is not 10 minutes.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (src.includes('GAME_INVITE_TTL_MS = 5 * 60 * 1000')) {
        return fail('Backend sendGameInvitePush mirror still contains a 5-minute TTL.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Backend sendGameInvitePush TTL = 10 minutes.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. expired_invite_not_acceptible_backend */
  makeCase('invite_lifecycle', 'expired_invite_not_acceptible_backend',
    'acceptGameInvite enforces expires_at and rejects expired invites',
    () => {
      const src = safeStr(acceptGameInviteFnSource);
      const required = [
        'getInviteExpiry',
        "status: 'expired'",
        'Davetin süresi doldu',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Backend accept expiry guard incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Backend accept expiry guard present.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. stale_lobby_expires_after_10_minutes — accept path */
  makeCase('invite_lifecycle', 'stale_lobby_blocked_on_accept_backend',
    'acceptGameInvite blocks joining a waiting lobby idle > 10 minutes',
    () => {
      const src = safeStr(acceptGameInviteFnSource);
      const required = [
        'LOBBY_STALE_AFTER_MS = 10 * 60 * 1000',
        'Lobi süresi doldu',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Stale-lobby guard missing from acceptGameInvite mirror.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('acceptGameInvite enforces 10-minute lobby staleness.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. stale_lobby_expires_after_10_minutes — code-join path */
  makeCase('invite_lifecycle', 'stale_lobby_blocked_on_code_join_backend',
    'findLobbyByCode blocks joining a waiting lobby idle > 10 minutes',
    () => {
      const src = safeStr(findLobbyByCodeFnSource);
      const required = [
        'LOBBY_STALE_AFTER_MS = 10 * 60 * 1000',
        'Lobi süresi doldu',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Stale-lobby guard missing from findLobbyByCode mirror.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('findLobbyByCode enforces 10-minute lobby staleness.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Client-side isLobbyStale helper — executable */
  makeCase('invite_lifecycle', 'client_is_lobby_stale_helper_contract',
    'isLobbyStale returns true for waiting lobbies idle > 10 min, false otherwise',
    () => {
      const now = Date.now();
      const fresh = { status: 'waiting', updated_date: new Date(now - 1000).toISOString() };
      const stale = { status: 'waiting', updated_date: new Date(now - (LOBBY_STALE_AFTER_MS + 5000)).toISOString() };
      const finished = { status: 'finished', updated_date: new Date(now - (LOBBY_STALE_AFTER_MS + 5000)).toISOString() };
      const noTime = { status: 'waiting' };

      const errors = [];
      if (isLobbyStale(fresh, now) !== false) errors.push('fresh waiting flagged stale');
      if (isLobbyStale(stale, now) !== true) errors.push('stale waiting not flagged');
      if (isLobbyStale(finished, now) !== false) errors.push('finished lobby flagged stale');
      if (isLobbyStale(noTime, now) !== false) errors.push('no-time lobby flagged stale');

      if (errors.length) {
        return fail('isLobbyStale boundary issues.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('isLobbyStale matches 10-minute contract on all boundaries.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. In-app banner visible while app is open */
  makeCase('invite_lifecycle', 'in_app_invite_banner_visible_when_app_open',
    'GameInviteNotifier mounts globally and surfaces pending invites as toasts',
    () => {
      const src = `${safeStr(useNotificationCenterSource)}\n${safeStr(gameInviteNotifierSource)}`;
      const required = [
        'showInviteToast',
        'Kronox oyun daveti',
        'PERSISTENT_INVITE_TOAST_DURATION',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Notifier banner contract is missing pieces.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      if (!safeStr(appSource).includes('<GameInviteNotifier')) {
        return fail('GameInviteNotifier is not mounted at the App shell level.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Notifier is mounted at App shell and shows invite banner.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Banner persists until valid close. */
  makeCase('invite_lifecycle', 'in_app_invite_banner_persistent_until_valid_close',
    'Banner does not auto-dismiss; explicit close/open/source invalidation are the close paths',
    () => {
      const src = safeStr(gameInviteNotifierSource);
      const required = [
        'PERSISTENT_INVITE_TOAST_DURATION = Infinity',
        'duration: PERSISTENT_INVITE_TOAST_DURATION',
        'toast_close_button',
        'toast_open_action',
        'active_invite_removed',
      ];
      const missing = required.filter((t) => !src.includes(t));
      const forbidden = [
        'INVITE_TOAST_DURATION_MS',
        'toast_timeout',
        'timerId',
        'window.setTimeout',
      ].filter((t) => src.includes(t));
      if (missing.length || forbidden.length) {
        return fail('Foreground invite banner can still close without a valid lifecycle event.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          forbidden,
        });
      }
      // Dismiss path must NOT call GameInvite.update/delete.
      if (/dismissInviteToast[\s\S]{0,400}GameInvite\.(update|delete)/.test(src)) {
        return fail('Banner dismiss path mutates GameInvite — invites would disappear.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Banner stays visible until explicit close/open or confirmed source invalidation.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Banner "Aç" -> shared accept/open action */
  makeCase('invite_lifecycle', 'in_app_invite_banner_open_goes_to_lobby',
    'Banner "Aç" action uses shared openGameInvite and navigates with the accepted lobby payload',
    () => {
      const src = `${safeStr(gameInviteNotifierSource)}\n${safeStr(useNotificationCenterSource)}\n${safeStr(inviteApiSource)}`;
      const required = [
        "params.set('inviteId'",
        "'/lobby'",
        '<ToastAction',
        'openNotificationCenterGameInvite(invite',
        'openGameInviteAction(invite',
        "source: 'toast'",
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Banner "Aç" handler is not wired to the shared accept/open path.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      if (!safeStr(lobbyRoomSource).includes('acceptGameInvite(deepLinkInvite.id)')) {
        return fail('LobbyRoom deep-link path does not call acceptGameInvite.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Banner Aç → shared openGameInvite → accepted lobby waiting room.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. App resume pending invite check (focus / visibilitychange) */
  makeCase('invite_lifecycle', 'app_resume_pending_invite_check',
    'Notifier re-checks pending invites on focus + visibilitychange',
    () => {
      const src = safeStr(useNotificationCenterSource);
      const required = [
        "addEventListener('focus'",
        "addEventListener('visibilitychange'",
        'visibilityState',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Shared notification center does not refresh on app resume.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Shared notification center refreshes pending invites on focus/visibility.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 12. Online screen pending invites visible */
  makeCase('invite_lifecycle', 'online_screen_pending_invites_visible',
    'OnlineChallengeScreen renders <IncomingInvitesPanel /> for pending invites',
    () => {
      const src = safeStr(onlineChallengeScreenSource);
      if (!src.includes('<IncomingInvitesPanel')) {
        return fail('Online challenge screen does not render IncomingInvitesPanel.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      const panel = safeStr(incomingInvitesPanelSource);
      const required = ['useNotificationCenter', 'openNotificationCenterGameInvite', 'rejectNotificationCenterGameInvite', 'InviteCountdown'];
      const missing = required.filter((t) => !panel.includes(t));
      if (missing.length) {
        return fail('IncomingInvitesPanel is missing key wiring.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Pending invites are visible on Online screen with accept/reject + countdown.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 13. No duplicate banner spam */
  makeCase('invite_lifecycle', 'no_duplicate_invite_banner_spam',
    'Notifier keeps a known-id + active-toast map so the same invite cannot be shown twice',
    () => {
      const src = safeStr(gameInviteNotifierSource);
      const required = [
        'knownInviteIdsRef',
        'activeToastByInviteIdRef',
        'rememberDismissedInviteToast',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Banner spam guard is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Notifier dedupes banners per invite id.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 14. No leftover "5 dakika" UI copy */
  makeCase('invite_lifecycle', 'no_legacy_5_minute_copy_in_invite_ui',
    'Invite-related UI files no longer contain the literal "5 dakika" copy',
    () => {
      // Codex132 — Use the statically-imported in-/src/ sources. No dynamic
      // imports → cannot throw.
      const files = [
        { label: 'IncomingInvitesPanel.jsx', src: incomingInvitesPanelSource },
        { label: 'InviteCountdown.jsx', src: inviteCountdownSource },
        { label: 'GameInviteNotifier.jsx', src: gameInviteNotifierSource },
        { label: 'OnlineChallengeScreen.jsx', src: onlineChallengeScreenSource },
        { label: 'LobbyRoom.jsx', src: lobbyRoomSource },
      ];
      const hits = [];
      for (const { label, src } of files) {
        if (/5\s*dakika/i.test(safeStr(src))) hits.push(label);
      }
      if (hits.length) {
        return fail('Legacy 5-minute UI copy still present.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          hits,
        });
      }
      return pass('No legacy "5 dakika" copy remains in invite-related UI.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 15. Manual — real-device closed-app push delivery */
  makeCase('invite_lifecycle', 'closed_app_push_delivery_manual',
    'Manual: Closed-app invite arrives via Web Push on a real subscribed device',
    () => ({
      status: STATUS.PASS,
      reason: 'Closed-app Web Push delivery requires VAPID config + a real subscribed device.',
      verification: 'NOT_AUTOMATABLE',
      classification: 'MANUAL_VERIFICATION_REQUIRED',
      actionType: ACTION_TYPES.MANUAL_VERIFICATION,
      runtimeProofRequired: true,
    }),
    {
      critical: false,
      verification: 'NOT_AUTOMATABLE',
      classification: 'MANUAL_VERIFICATION_REQUIRED',
      runtimeProofRequired: true,
      actionType: ACTION_TYPES.MANUAL_VERIFICATION,
    }),
];
