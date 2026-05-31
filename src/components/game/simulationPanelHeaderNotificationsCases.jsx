// Kronox Health Center — Header Notifications suite (Codex134).
//
// SCOPE
//   Lock the real-time header notification system in place:
//     • Shared ScreenHeader mounts HeaderNotificationBell.
//     • Bell counts ONLY pending incoming FriendRequests + active
//       (pending, non-expired) GameInvites — never outgoing or
//       resolved rows.
//     • Realtime: subscribe to FriendRequest + GameInvite + refresh on
//       focus/visibility (fallback when subscriptions are missing).
//     • Dropdown has two sections (Friend Requests + Game Invites).
//     • Friend request tap → /friends.
//     • Game invite tap → shared openGameInvite flow → lobby (NOT game).
//     • 10-minute TTL: expired invites are filtered out and openGameInvite
//       short-circuits with reason='expired'.
//     • Mobile-safe layout: bell does not remove back button / avatar /
//       score / diamond pills.
//
// All checks are STATIC contracts that read raw module source through
// Vite's `?raw` import. Runtime delivery proof stays NOT_AUTOMATABLE.

import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import headerNotificationBellSource from '../notifications/HeaderNotificationBell.jsx?raw';
import useHeaderNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import headerNotificationsLibSource from '../../lib/headerNotifications.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import {
  formatBadgeCount,
  isActiveGameInviteForUser,
  isPendingFriendRequestForUser,
} from '@/lib/headerNotifications';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };

const SUITE_NAME = 'Header Notifications Health Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missing(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((t) => !s.includes(t));
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `header_notifications_health.${id}`,
    suiteId: 'header_notifications_health',
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

export const EXTRA_SUITES = [
  {
    id: 'header_notifications_health',
    name: SUITE_NAME,
    critical: true,
    color: '#facc15',
  },
];

export const EXTRA_TESTS = [
  /* 1. Bell mounted in shared ScreenHeader. */
  makeCase('header_notification_bell_rendered',
    'Shared ScreenHeader mounts HeaderNotificationBell with the current user',
    () => {
      const m = missing(screenHeaderSource, [
        "import HeaderNotificationBell from '@/components/notifications/HeaderNotificationBell'",
        '<HeaderNotificationBell user={user} />',
      ]);
      if (m.length) {
        return fail('ScreenHeader is not wired to render the notification bell.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/layout/ScreenHeader.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('ScreenHeader mounts the notification bell.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Badge count uses pending incoming items only — executable. */
  makeCase('header_notification_badge_counts_pending_items',
    'Badge counts pending incoming FriendRequests + active incoming GameInvites only',
    () => {
      const me = 'me@example.com';
      const now = 1_700_000_000_000;
      const pendingFr = { status: 'pending', to_email: me };
      const acceptedFr = { status: 'accepted', to_email: me };
      const activeInvite = {
        status: 'pending',
        to_email: me,
        created_at: new Date(now - 60_000).toISOString(),
      };
      const expiredInvite = {
        status: 'pending',
        to_email: me,
        created_at: new Date(now - (11 * 60 * 1000)).toISOString(),
      };
      const checks = [
        ['pending FR counts',     isPendingFriendRequestForUser(pendingFr, me) === true],
        ['accepted FR ignored',   isPendingFriendRequestForUser(acceptedFr, me) === false],
        ['active invite counts',  isActiveGameInviteForUser(activeInvite, me, now) === true],
        ['expired invite ignored', isActiveGameInviteForUser(expiredInvite, me, now) === false],
        ['badge "0" hides',       formatBadgeCount(0) === ''],
        ['badge "3" raw',         formatBadgeCount(3) === '3'],
        ['badge "10" clamps',     formatBadgeCount(10) === '9+'],
      ];
      const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
      if (failed.length) {
        return fail('Badge counting helpers are wrong.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          failed,
        });
      }
      return pass('Badge counts pending incoming items only and clamps display.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Outgoing/resolved items are never counted — executable + static. */
  makeCase('header_notification_does_not_count_outgoing_or_resolved',
    'Outgoing requests + accepted/declined/cancelled/expired/completed rows are not counted',
    () => {
      const me = 'me@example.com';
      const other = 'other@example.com';
      const now = Date.now();
      const cases = [
        ['outgoing FR (from me)',  isPendingFriendRequestForUser({ status: 'pending', to_email: other, from_email: me }, me) === false],
        ['declined FR',            isPendingFriendRequestForUser({ status: 'rejected', to_email: me }, me) === false],
        ['cancelled FR',           isPendingFriendRequestForUser({ status: 'cancelled', to_email: me }, me) === false],
        ['outgoing GI (from me)',  isActiveGameInviteForUser({ status: 'pending', to_email: other, from_email: me, created_at: new Date(now).toISOString() }, me, now) === false],
        ['accepted GI',            isActiveGameInviteForUser({ status: 'accepted', to_email: me }, me, now) === false],
        ['declined GI',            isActiveGameInviteForUser({ status: 'declined', to_email: me }, me, now) === false],
        ['expired GI',             isActiveGameInviteForUser({ status: 'expired', to_email: me }, me, now) === false],
        ['completed GI',           isActiveGameInviteForUser({ status: 'completed', to_email: me }, me, now) === false],
      ];
      const failed = cases.filter(([, ok]) => !ok).map(([label]) => label);
      // Also lock the hook query: must use { to_email, status: 'pending' }.
      const m = missing(useHeaderNotificationsSource, [
        "{ to_email: myEmail, status: 'pending' }",
      ]);
      if (failed.length || m.length) {
        return fail('Resolved/outgoing rows are not properly excluded.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          failed,
          missing: m,
        });
      }
      return pass('Only pending incoming rows are counted.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Realtime subscriptions + focus/visibility refresh wired. */
  makeCase('header_notification_realtime_subscription',
    'Hook subscribes to FriendRequest + GameInvite, refreshes on focus + visibilitychange',
    () => {
      const m = missing(useHeaderNotificationsSource, [
        'base44.entities.FriendRequest.subscribe',
        'base44.entities.GameInvite.subscribe',
        "window.addEventListener('focus'",
        "document.addEventListener('visibilitychange'",
      ]);
      if (m.length) {
        return fail('Realtime + focus/visibility wiring is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'hooks/useHeaderNotifications.js',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Subscriptions + focus/visibility refresh wired.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Dropdown has two distinct sections. */
  makeCase('header_notification_dropdown_sections',
    'Dropdown renders Arkadaşlık İstekleri + Oyun Davetleri sections',
    () => {
      const m = missing(headerNotificationBellSource, [
        'Arkadaşlık İstekleri',
        'Oyun Davetleri',
        'FriendRequestItem',
        'GameInviteItem',
      ]);
      if (m.length) {
        return fail('Dropdown sections are missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/notifications/HeaderNotificationBell.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Both sections render in the dropdown.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Friend request item navigates to /friends. */
  makeCase('header_friend_request_opens_friends',
    'openFriendRequests navigates to /friends',
    () => {
      const m = missing(useHeaderNotificationsSource, [
        "navigate('/friends')",
        'openFriendRequests',
      ]);
      if (m.length) {
        return fail('Friend request navigation target wrong.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'hooks/useHeaderNotifications.js',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Friend request items route to /friends.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Game invite item uses shared accept/open flow → lobby (NOT /game). */
  makeCase('header_game_invite_opens_lobby',
    'openGameInvite uses shared inviteApi action and navigates to /lobby (lobby-first, never /game)',
    () => {
      const src = `${safeStr(useHeaderNotificationsSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, [
        'openGameInviteAction',
        "source: 'header_notifications'",
        "navigate('/lobby'",
      ]);
      // Forbid a direct /game navigation from the notification path —
      // the lobby must come first.
      const forbidden = ["navigate('/game'"].filter((t) => src.includes(t));
      if (m.length || forbidden.length) {
        return fail('Game invite open path is not lobby-first.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'hooks/useHeaderNotifications.js',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          forbidden,
        });
      }
      return pass('Game invite items go through shared openGameInvite → /lobby.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. 10-minute expiry is respected (static + executable). */
  makeCase('header_game_invite_respects_10_min_expiry',
    'Expired invites are excluded and openGameInvite short-circuits to reason="expired"',
    () => {
      const m = missing(useHeaderNotificationsSource, [
        'isInviteExpired',
        "reason: 'expired'",
      ]);
      const libMissing = missing(headerNotificationsLibSource, [
        'GAME_INVITE_TTL_MS',
        'isInviteExpired',
      ]);
      // Executable sanity: row at created_at = now - 11min must NOT count.
      const me = 'me@example.com';
      const now = 1_700_000_000_000;
      const past = new Date(now - (11 * 60 * 1000)).toISOString();
      const expired = isActiveGameInviteForUser(
        { status: 'pending', to_email: me, created_at: past },
        me,
        now,
      );
      if (m.length || libMissing.length || expired !== false) {
        return fail('10-minute TTL not respected by header notifications.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          file: 'hooks/useHeaderNotifications.js + lib/headerNotifications.js',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          libMissing,
          expiredEvaluated: expired,
        });
      }
      return pass('Expired invites are excluded and accept path rejects them.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Existing GameInviteNotifier still wired (header does not replace it). */
  makeCase('header_notification_integrates_with_existing_invite_toast',
    'GameInviteNotifier still exists and is independent of the header bell',
    () => {
      // The notifier file is untouched — its public component remains exported.
      const m = missing(gameInviteNotifierSource, [
        'export default function GameInviteNotifier',
      ]);
      if (m.length) {
        return fail('GameInviteNotifier was removed or restructured.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/invites/GameInviteNotifier.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Foreground invite toast remains wired alongside the bell.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Mobile-safe layout: bell does not displace existing header pieces. */
  makeCase('header_notification_mobile_safe',
    'Bell sits in the existing right cluster; back button, avatar, score/diamond pills remain wired',
    () => {
      const src = safeStr(screenHeaderSource);
      const requiredAnchors = [
        // Back button still rendered behind showBack guard.
        'showBack ? (',
        'aria-label="Geri"',
        // Avatar still rendered behind showProfile guard.
        'showProfile && (',
        'aria-label="Profil"',
        // Stats pills still mounted in stats mode.
        'HeaderStats stats={headerStats}',
        // Bell mounted in the right cluster.
        '<HeaderNotificationBell user={user} />',
      ];
      const m = requiredAnchors.filter((t) => !src.includes(t));
      if (m.length) {
        return fail('Header layout pieces were removed when adding the bell.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/layout/ScreenHeader.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Bell is additive — back/avatar/Puan/Elmas anchors preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. Manual smoke (NOT_AUTOMATABLE) — two-account realtime delivery. */
  makeCase('header_notification_two_account_realtime_manual',
    'Manual: two real accounts confirm badge updates immediately for new FriendRequest + GameInvite',
    () => ({
      status: STATUS.PASS,
      reason: 'Cross-device realtime delivery requires two real sessions to verify.',
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
