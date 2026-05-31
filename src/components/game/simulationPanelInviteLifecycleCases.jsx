// Kronox Health Center — Game Invite Lifecycle contracts (Codex130).
//
// SCOPE
//   Codex130 updates the Game Invite lifecycle:
//     • TTL bumped 5 → 10 minutes (UI + backend + push handler).
//     • Stale waiting lobby guard (10 min) on both findLobbyByCode +
//       acceptGameInvite, plus a client-side `isLobbyStale` helper used by
//       LobbyRoom deep-link / accept-and-navigate paths.
//     • GameInviteNotifier: 10-second banner auto-dismiss + focus /
//       visibilitychange recheck so background-arrived invites surface
//       when the app is reopened.
//
//   These cases lock the new contracts. We deliberately do NOT touch
//   simulationPanelExtraCases.jsx (frozen). New cases live here and are
//   registered through the case registry.

import { GAME_INVITE_TTL_MS, LOBBY_STALE_AFTER_MS, isLobbyStale } from '@/lib/inviteApi';

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
    async () => {
      const src = (await import('../../functions/acceptGameInvite.js?raw')).default;
      if (!String(src || '').includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000')) {
        return fail('Backend acceptGameInvite still references 5-minute TTL.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (String(src || '').includes('GAME_INVITE_TTL_MS = 5 * 60 * 1000')) {
        return fail('Backend acceptGameInvite still contains a literal 5-minute TTL.', {
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
    async () => {
      const src = (await import('../../functions/sendGameInvitePush.js?raw')).default;
      if (!String(src || '').includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000')) {
        return fail('Backend sendGameInvitePush still references 5-minute TTL.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (String(src || '').includes('GAME_INVITE_TTL_MS = 5 * 60 * 1000')) {
        return fail('Backend sendGameInvitePush still contains a literal 5-minute TTL.', {
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
    async () => {
      const src = (await import('../../functions/acceptGameInvite.js?raw')).default;
      const required = [
        'getInviteExpiry',
        "status: 'expired'",
        'Davetin süresi doldu',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
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
    async () => {
      const src = (await import('../../functions/acceptGameInvite.js?raw')).default;
      const required = [
        'LOBBY_STALE_AFTER_MS = 10 * 60 * 1000',
        'Lobi süresi doldu',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
      if (missing.length) {
        return fail('Stale-lobby guard missing from acceptGameInvite.', {
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
    async () => {
      const src = (await import('../../functions/findLobbyByCode.js?raw')).default;
      const required = [
        'LOBBY_STALE_AFTER_MS = 10 * 60 * 1000',
        'Lobi süresi doldu',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
      if (missing.length) {
        return fail('Stale-lobby guard missing from findLobbyByCode.', {
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
    async () => {
      const src = (await import('../../components/invites/GameInviteNotifier.jsx?raw')).default;
      const required = [
        'showInviteToast',
        'Kronox oyun daveti',
        'INVITE_TOAST_DURATION_MS',
      ];
      const appSrc = (await import('../../App.jsx?raw')).default;
      const missing = required.filter((t) => !String(src || '').includes(t));
      if (missing.length) {
        return fail('Notifier banner contract is missing pieces.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      if (!String(appSrc || '').includes('<GameInviteNotifier')) {
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

  /* 9. Banner auto-dismiss: 10 seconds */
  makeCase('invite_lifecycle', 'in_app_invite_banner_auto_dismiss',
    'Banner auto-dismisses after 10 seconds; dismiss never deletes invite',
    async () => {
      const src = (await import('../../components/invites/GameInviteNotifier.jsx?raw')).default;
      if (!String(src || '').includes('INVITE_TOAST_DURATION_MS = 10000')) {
        return fail('Banner duration is not 10 seconds.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      // Dismiss path must NOT call GameInvite.update/delete.
      if (/dismissInviteToast[\s\S]{0,400}GameInvite\.(update|delete)/.test(String(src || ''))) {
        return fail('Banner dismiss path mutates GameInvite — invites would disappear.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Banner auto-dismisses after 10s without deleting the invite.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Banner "Aç" -> /lobby?inviteId= deep-link */
  makeCase('invite_lifecycle', 'in_app_invite_banner_open_goes_to_lobby',
    'Banner "Aç" action navigates to /lobby?inviteId=… which triggers accept + waiting room',
    async () => {
      const src = (await import('../../components/invites/GameInviteNotifier.jsx?raw')).default;
      const required = [
        "params.set('inviteId'",
        "'/lobby'",
        '<ToastAction',
        'navigate(target)',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
      if (missing.length) {
        return fail('Banner "Aç" handler is not wired to /lobby deep-link.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      // LobbyRoom must call acceptGameInvite when arriving with the deep-link.
      const lobbySrc = (await import('../../pages/LobbyRoom.jsx?raw')).default;
      if (!String(lobbySrc || '').includes('acceptGameInvite(deepLinkInvite.id)')) {
        return fail('LobbyRoom deep-link path does not call acceptGameInvite.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Banner Aç → /lobby?inviteId → acceptGameInvite → waiting room.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. App resume pending invite check (focus / visibilitychange) */
  makeCase('invite_lifecycle', 'app_resume_pending_invite_check',
    'Notifier re-checks pending invites on focus + visibilitychange',
    async () => {
      const src = (await import('../../components/invites/GameInviteNotifier.jsx?raw')).default;
      const required = [
        "addEventListener('focus'",
        "addEventListener('visibilitychange'",
        'visibilityState',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
      if (missing.length) {
        return fail('Notifier does not refresh on app resume.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Notifier refreshes pending invites on focus/visibility.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 12. Online screen pending invites visible */
  makeCase('invite_lifecycle', 'online_screen_pending_invites_visible',
    'OnlineChallengeScreen renders <IncomingInvitesPanel /> for pending invites',
    async () => {
      const src = (await import('../../components/lobby/OnlineChallengeScreen.jsx?raw')).default;
      if (!String(src || '').includes('<IncomingInvitesPanel')) {
        return fail('Online challenge screen does not render IncomingInvitesPanel.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      const panel = (await import('../../components/invites/IncomingInvitesPanel.jsx?raw')).default;
      const required = ['loadIncomingInvites', 'acceptGameInvite', 'rejectGameInvite', 'InviteCountdown'];
      const missing = required.filter((t) => !String(panel || '').includes(t));
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
    async () => {
      const src = (await import('../../components/invites/GameInviteNotifier.jsx?raw')).default;
      const required = [
        'knownInviteIdsRef',
        'activeToastByInviteIdRef',
        'dismissedInviteIdsRef',
      ];
      const missing = required.filter((t) => !String(src || '').includes(t));
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
    async () => {
      const files = [
        '../../components/invites/IncomingInvitesPanel.jsx?raw',
        '../../components/invites/InviteCountdown.jsx?raw',
        '../../components/invites/GameInviteNotifier.jsx?raw',
        '../../components/lobby/OnlineChallengeScreen.jsx?raw',
        '../../pages/LobbyRoom.jsx?raw',
      ];
      const hits = [];
      for (const path of files) {
        const src = (await import(path)).default || '';
        if (/5\s*dakika/i.test(String(src))) hits.push(path.replace('?raw', ''));
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