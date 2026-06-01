// Kronox Health Center — Notification Lifecycle Stabilization suite.
//
// Locks the persisted-notification lifecycle contract:
//   persisted GameInvite state is authoritative, toast dismiss is visual,
//   header/Online/banner derive from shared selectors/view model, and
//   fetch/subscription merge does not flicker valid pending invites away.

import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import notificationViewModelSource from '../../lib/notificationViewModel.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import useHeaderNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import headerNotificationBellSource from '../notifications/HeaderNotificationBell.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import { acceptGameInviteFnSource } from './simulationPanelContractStrings';
import {
  GAME_INVITE_TTL_MS,
  isActiveIncomingGameInvite,
  mergeActiveIncomingGameInvites,
} from '@/lib/gameInviteSelectors';
import { buildNotificationViewModel } from '@/lib/notificationViewModel';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };
const SUITE_ID = 'notification_lifecycle_health';
const SUITE_NAME = 'Notification Lifecycle Health Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missing(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((token) => !s.includes(token));
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
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

const NOW = Date.parse('2026-06-01T08:00:00Z');
const ME = 'recipient@example.com';
const freshInvite = {
  id: 'invite_fresh',
  lobby_id: 'lobby_fresh',
  from_email: 'host@example.com',
  to_email: ME,
  status: 'pending',
  created_at: new Date(NOW - 30_000).toISOString(),
  expires_at: new Date(NOW + 9 * 60 * 1000).toISOString(),
};

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#22d3ee',
  },
];

export const EXTRA_TESTS = [
  makeCase('toast_dismiss_does_not_mutate_game_invite',
    'Toast/banner dismiss does not update GameInvite status',
    () => {
      const dismissBlock = safeStr(gameInviteNotifierSource).slice(
        safeStr(gameInviteNotifierSource).indexOf('const dismissInviteToast'),
        safeStr(gameInviteNotifierSource).indexOf('const dismissAllInviteToasts'),
      );
      const forbidden = ['GameInvite.update', "status: 'expired'", "status: 'declined'", "status: 'accepted'"]
        .filter((token) => dismissBlock.includes(token));
      if (forbidden.length) {
        return fail('Toast dismiss path mutates persisted GameInvite state.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          forbidden,
        });
      }
      return pass('Toast dismiss only closes the visual banner.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('toast_dismiss_does_not_hide_header_or_online',
    'dismissedToastIds only filters banner candidates, not header/Online actionable lists',
    () => {
      const vm = buildNotificationViewModel({
        currentUser: { email: ME },
        gameInvites: [freshInvite],
        dismissedToastIds: new Set([freshInvite.id]),
        now: NOW,
      });
      const ok = vm.activeIncomingGameInvites.length === 1 && vm.bannerCandidates.length === 0;
      const m = missing(notificationViewModelSource, ['bannerCandidates', 'activeIncomingGameInvites', 'dismissedToastOnly']);
      if (!ok || m.length) {
        return fail('Toast-dismiss state may leak into header/Online visibility.', {
          verification: ok ? 'STATIC_CONTRACT' : 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          actual: { active: vm.activeIncomingGameInvites.length, banner: vm.bannerCandidates.length },
        });
      }
      return pass('Dismissed toast suppresses only banner re-show; actionable lists stay active.',
        { verification: 'EXECUTABLE' });
    }),

  makeCase('subscription_fetch_merge_preserves_valid_pending_invite',
    'Valid subscription invite is not cleared by stale empty fetch',
    () => {
      const merged = mergeActiveIncomingGameInvites([freshInvite], [], ME, NOW);
      const m = missing(useHeaderNotificationsSource + incomingInvitesPanelSource, [
        'stale_empty_fetch_preserved',
        'mergeActiveIncomingGameInvites(prev, snapshot?.rows',
      ]);
      if (merged.length !== 1 || m.length) {
        return fail('Empty stale fetch can still clear a valid pending invite.', {
          verification: merged.length === 1 ? 'STATIC_CONTRACT' : 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          actual: { mergedLength: merged.length },
        });
      }
      return pass('Lifecycle merge preserves valid pending invite across empty stale fetch.',
        { verification: 'EXECUTABLE' });
    }),

  makeCase('fetch_user_not_loaded_does_not_clear_invites',
    'Missing current user during load does not clear existing invite state',
    () => {
      const src = `${safeStr(useHeaderNotificationsSource)}\n${safeStr(incomingInvitesPanelSource)}`;
      const m = missing(src, ['user_not_loaded_preserve_existing', 'setLoading(false)', 'return;']);
      if (m.length || src.includes('if (!myEmail) {\n      setFriendRequests([])')) {
        return fail('User-loading state may clear notification rows as if no invites exist.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('User-not-loaded refresh preserves existing invite state.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('fetch_error_does_not_clear_valid_invites',
    'Fetch error preserves previously known active invites',
    () => {
      const src = `${safeStr(useHeaderNotificationsSource)}\n${safeStr(incomingInvitesPanelSource)}`;
      const m = missing(src, ['fetch_error_preserve_existing']);
      if (m.length) {
        return fail('Fetch failure has no explicit preserve-existing contract.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Fetch errors are diagnostic/error states, not active-invite clears.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('header_and_online_share_active_invite_selector',
    'Header and Online pending list use the same active invite selector',
    () => {
      const src = `${safeStr(useHeaderNotificationsSource)}\n${safeStr(incomingInvitesPanelSource)}`;
      const m = missing(src, ["from '@/lib/gameInviteSelectors'", 'mergeActiveIncomingGameInvites']);
      if (m.length) {
        return fail('Header and Online invite lists do not share selector/merge helpers.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Header and Online surfaces share active invite selector and lifecycle merge.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('banner_uses_view_model_not_source_of_truth',
    'Banner candidates are derived visual UI, not authoritative invite state',
    () => {
      const m = missing(gameInviteNotifierSource, [
        "from '@/lib/notificationViewModel'",
        'buildNotificationViewModel',
        'bannerCandidates',
      ]);
      if (m.length) {
        return fail('Banner trigger is not derived from the notification view model.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Banner uses view-model candidates instead of owning invite state.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('active_invite_dedupes_by_id',
    'Duplicate fetch/subscription events do not duplicate invite rows',
    () => {
      const duplicate = { ...freshInvite, from_name: 'Updated Host Name' };
      const merged = mergeActiveIncomingGameInvites([freshInvite], [duplicate], ME, NOW);
      const m = missing(gameInviteSelectorsSource, ['getGameInviteDedupeKey', 'byId.set(key']);
      if (merged.length !== 1 || merged[0].from_name !== 'Updated Host Name' || m.length) {
        return fail('Invite merge does not dedupe by stable invite identity.', {
          verification: merged.length === 1 ? 'STATIC_CONTRACT' : 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          actual: merged,
        });
      }
      return pass('Active invites dedupe by id/fallback key and latest row wins.',
        { verification: 'EXECUTABLE' });
    }),

  makeCase('accepted_invite_removed_only_by_status_change',
    'Accepted/terminal invite leaves header/Online because status changed, not because toast dismissed',
    () => {
      const accepted = { ...freshInvite, status: 'accepted' };
      const merged = mergeActiveIncomingGameInvites([freshInvite], [accepted], ME, NOW);
      if (merged.length !== 0 || isActiveIncomingGameInvite(accepted, ME, NOW)) {
        return fail('Accepted invite can remain active or be removed for the wrong lifecycle reason.', {
          verification: 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { mergedLength: merged.length },
        });
      }
      return pass('Terminal status update removes invite from actionable lists.',
        { verification: 'EXECUTABLE' });
    }),

  makeCase('open_invite_uses_clicked_invite_id',
    'Open action uses the exact clicked invite id',
    () => {
      const src = `${safeStr(gameInviteNotifierSource)}\n${safeStr(headerNotificationBellSource)}\n${safeStr(incomingInvitesPanelSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, ['openGameInvite(invite', 'handleInviteItem(row)', 'handleAccept(invite)', 'acceptGameInvite(invite.id)']);
      const forbidden = ['gameInvites[0]', 'invites[0]'].filter((token) => src.includes(token));
      if (m.length || forbidden.length) {
        return fail('Invite open may use a stale first/list invite instead of the clicked item.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          forbidden,
        });
      }
      return pass('All surfaces pass the clicked invite into the shared open action.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('invite_open_returns_lobby_payload',
    'acceptGameInvite returns lobby payload for stable navigation',
    () => {
      const src = `${safeStr(acceptGameInviteFnSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, ['lobby: updatedLobby', 'lobbyId', 'lobbyCode', 'joinedLobby']);
      if (m.length) {
        return fail('Invite accept does not return/consume a precise lobby navigation payload.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Accepted invite returns and consumes joined lobby payload.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('lobby_join_does_not_flash_expired_for_fresh_invite',
    'Fresh accepted invite route does not show expired state during first verification',
    () => {
      const m = missing(lobbyRoomSource, ['initialJoinedLobby', 'useLobbyRoomState(initialJoinedLobby)', 'route joined lobby used as initial authoritative lobby']);
      if (m.length) {
        return fail('LobbyRoom can still render empty/expired fallback before applying a fresh accepted lobby.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Fresh joinedLobby route state seeds LobbyRoom before fallback UI can flash.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('lobby_route_state_used_as_initial_authoritative_lobby',
    'Returned updatedLobby is used to stabilize first lobby render',
    () => {
      const m = missing(lobbyRoomSource, ['location.state?.joinedLobby', 'isLobbyStale(joined) ? null : joined', 'debugLog']);
      if (m.length) {
        return fail('Accepted lobby route state is not treated as the initial authoritative lobby.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Route joinedLobby is accepted as initial authoritative lobby when fresh.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('notification_view_model_has_exclusion_reasons',
    'Debug/admin view model can explain why an invite was excluded',
    () => {
      const m = missing(notificationViewModelSource, ['getNotificationExclusionReasons', 'dismissedToastOnly', 'reason', 'user_not_loaded']);
      if (m.length) {
        return fail('Notification view model lacks exclusion reasons for diagnostics.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('View model exposes exclusion reasons for admin/debug diagnostics.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('game_invite_10_min_ttl_still_respected',
    'GameInvite TTL remains 10 minutes',
    () => {
      if (GAME_INVITE_TTL_MS !== 10 * 60 * 1000 || !gameInviteSelectorsSource.includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000')) {
        return fail('GameInvite TTL drifted from the 10-minute product rule.', {
          verification: 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: GAME_INVITE_TTL_MS,
        });
      }
      return pass('GameInvite TTL remains exactly 10 minutes.',
        { verification: 'EXECUTABLE' });
    }),
];
