// Kronox Health Center — Online 4-player lobby start regression contracts.
//
// Scope: lock the join/start/recovery path after the 4-player real-device
// failures where accepted players could be lost by concurrent roster writes or
// left in the waiting room after a missed realtime event.

import waitingRoomPanelSource from '../../components/lobby/WaitingRoomPanel.jsx?raw';
import onlineGameBootstrapFallbackSource from './OnlineGameBootstrapFallback.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';
import useWaitingRoomSyncSource from '../../hooks/useWaitingRoomSync.js?raw';
import onlineGameNavigationSource from '../../lib/onlineGameNavigation.js?raw';
import healthMirrorSource from '../../lib/healthAlignmentDocMirrors.js?raw';
import {
  acceptGameInviteFnSource,
  findLobbyByCodeFnSource,
  startLobbyGameFnSource,
} from './simulationPanelContractStrings.jsx';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_ID = 'online_lobby_start_regression';
const SUITE_NAME = 'Online Lobby Start Regression Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missing(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((token) => !s.includes(token));
}

function forbidden(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((token) => s.includes(token));
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

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#22d3ee',
  },
];

export const EXTRA_TESTS = [
  makeCase('four_player_join_uses_merge_retry',
    'Code and invite joins merge/retry roster writes instead of blind array overwrite',
    () => {
      const src = `${safeStr(findLobbyByCodeFnSource)}\n${safeStr(acceptGameInviteFnSource)}`;
      const m = missing(src, [
        'appendPlayerWithMergeRetry',
        'mergePlayersByIdentity',
        'hasPlayer',
        'state_revision: readRevision',
        'retryApplied',
      ]);
      if (m.length) {
        return fail('Join paths can still lose one of four concurrent players.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'findLobbyByCode + acceptGameInvite mirrors',
          missing: m,
        });
      }
      return pass('Join paths use merge/retry roster repair for concurrent 4-player accepts.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('accepted_invites_reconciled_before_start',
    'Host start reconciles accepted invitees before assigning cards/deck',
    () => {
      const src = safeStr(startLobbyGameFnSource);
      const m = missing(src, [
        'reconcileAcceptedInvitePlayers',
        'loadAcceptedInvitePlayers',
        'mergePlayersByIdentity',
        'const startLobby',
        'const players = startLobby.players',
      ]);
      if (m.length) {
        return fail('startLobbyGame may still trust a stale Lobby.players array.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'startLobbyGame mirror',
          missing: m,
        });
      }
      return pass('startLobbyGame recovers accepted participants before freezing game state.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('host_start_creates_single_shared_game_state',
    'Host start persists one authoritative shared deck/current question before gameplay',
    () => {
      const src = safeStr(startLobbyGameFnSource);
      const m = missing(src, [
        'online_question_deck',
        'online_deck_meta',
        'current_question_id',
        "status: 'starting'",
        'started_at',
        'state_revision: currentRevision + 1',
      ]);
      if (m.length) {
        return fail('Host start no longer clearly persists a complete shared Online state.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'startLobbyGame mirror',
          missing: m,
        });
      }
      return pass('Host start writes deck, current question, status, timestamp, and revision together.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('start_is_idempotent_after_shared_payload_exists',
    'Repeated host start returns the existing started lobby when shared payload exists',
    () => {
      const src = safeStr(startLobbyGameFnSource);
      const m = missing(src, [
        'hasAuthoritativeGamePayload',
        "lobby.status === 'starting'",
        "lobby.status === 'in_game'",
        'idempotent: true',
      ]);
      if (m.length) {
        return fail('Host double-tap/retry can still be rejected after a successful start.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'startLobbyGame mirror',
          missing: m,
        });
      }
      return pass('Started lobbies with complete shared state are returned idempotently.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('all_participants_have_subscription_and_poll_transition',
    'Non-host participants can transition via subscription or fallback poll',
    () => {
      const src = `${safeStr(useWaitingRoomSyncSource)}\n${safeStr(onlineGameNavigationSource)}`;
      const m = missing(src, [
        'base44.entities.Lobby.subscribe',
        'start_fallback_poll',
        "status === 'starting' || status === 'in_game'",
        'navigateToOnlineGameRoute',
        '/game?',
      ]);
      if (m.length) {
        return fail('A participant that misses realtime may remain in the lobby.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'useWaitingRoomSync + onlineGameNavigation',
          missing: m,
        });
      }
      return pass('Waiting room has subscription + poll transition into the same online game route.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('missed_realtime_event_can_refetch_started_lobby',
    'Game bootstrap retry refetches the lobby even after a partial lobby snapshot',
    () => {
      const src = `${safeStr(onlineGameBootstrapFallbackSource)}\n${safeStr(gameSource)}\n${safeStr(useLobbySyncSource)}`;
      const m = missing(src, [
        'if (canRetryLobby)',
        'onRefetchLobby',
        'base44.entities.Lobby.get',
        'pollIntervalId',
        'lastSubscriptionAtRef',
      ]);
      if (m.length) {
        return fail('Game bootstrap recovery may not fetch the current started lobby after a missed event.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'OnlineGameBootstrapFallback + Game + useLobbySync',
          missing: m,
        });
      }
      return pass('Online bootstrap can refetch current lobby state even when it already has a partial snapshot.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_start_stays_separate_from_solo_preferences',
    'Online start uses lobby-selected categories only and never Solo preference weighting',
    () => {
      const src = `${safeStr(startLobbyGameFnSource)}\n${safeStr(gameSource)}\n${safeStr(healthMirrorSource)}`;
      const m = missing(src, [
        'selectedCategoriesOnly: true',
        'soloPreferenceWeightingApplied: false',
        'guestSoloPathUsed: false',
        'questionFetchEnabled = !isOnline',
        'Online question selection is not affected by Solo preferences',
      ]);
      if (m.length) {
        return fail('Online start may have drifted back toward Solo question/preference setup.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'startLobbyGame + Game + Health mirror',
          missing: m,
        });
      }
      return pass('Online start remains isolated from Solo category preferences and guest Solo projection.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('public_online_surfaces_are_username_first',
    'Public lobby/start UI renders names and route ids, not raw private identity fields',
    () => {
      const waiting = safeStr(waitingRoomPanelSource);
      const navigation = safeStr(onlineGameNavigationSource);
      const badVisible = forbidden(waiting, [
        '{p.email}',
        'player.email}</span>',
        'owner_key',
        'provider_id',
        'guest_id',
        'player_key',
      ]);
      const m = missing(`${waiting}\n${navigation}`, [
        '{p.name}',
        'params.set(\'lobbyId\'',
        'params.set(\'lobbyCode\'',
      ]);
      if (badVisible.length || m.length) {
        return fail('Public Online/lobby surfaces may expose private identity or lose username-first display.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'WaitingRoomPanel + onlineGameNavigation',
          badVisible,
          missing: m,
        });
      }
      return pass('Lobby/start public UI remains username-first; route only carries lobby id/code.',
        { verification: 'STATIC_CONTRACT' });
    }),
];
