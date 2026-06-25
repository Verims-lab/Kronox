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
import onlineLobbyReducerSource from '../../lib/onlineLobbyReducer.js?raw';
import healthMirrorSource from '../../lib/healthAlignmentDocMirrors.js?raw';
import {
  createOnlineLobbyInitialState,
  hasOnlineSharedGameState,
  onlineLobbyReducer,
  ONLINE_LOBBY_ACTIONS,
  ONLINE_LOBBY_PHASES,
} from '@/lib/onlineLobbyReducer';
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
  makeCase('online_lobby_reducer_phase_1_contract',
    'Online lobby reducer models 4-player join/start/recovery without effects',
    () => {
      const required = missing(onlineLobbyReducerSource, [
        'export function onlineLobbyReducer',
        'export function createOnlineLobbyInitialState',
        'export function hasOnlineSharedGameState',
        'CREATE_REQUESTED',
        'CREATE_SUCCEEDED',
        'JOIN_REQUESTED',
        'JOIN_SUCCEEDED',
        'INVITE_ACCEPTED',
        'LOBBY_REFRESHED',
        'SUBSCRIPTION_UPDATE_RECEIVED',
        'START_REQUESTED',
        'START_CONFIRMED',
        'RECOVERY_REQUESTED',
        'RECOVERY_SUCCEEDED',
        'LOBBY_EXPIRED',
        'LOBBY_CANCELLED',
        'missing_shared_game_state',
      ]);
      const reducerForbidden = forbidden(onlineLobbyReducerSource, [
        'base44',
        'fetch(',
        'window.',
        'document.',
        'navigator.',
        'localStorage',
        'Date.now',
        'new Date(',
        'UserCategoryPreference',
        'loadUserCategoryPreferences',
      ]);
      const integrationRequired = missing(`${safeStr(useWaitingRoomSyncSource)}\n${safeStr(waitingRoomPanelSource)}`, [
        'onlineLobbyReducer',
        'ONLINE_LOBBY_ACTIONS.START_CONFIRMED',
        'ONLINE_LOBBY_ACTIONS.RECOVERY_REQUESTED',
        'lobbyPhaseState',
        'phase reducer',
      ]);

      const players = ['host', 'p2', 'p3', 'p4'].map((name, index) => ({
        name,
        email: `${name}@example.com`,
        ready: true,
        cards: index === 0 ? [{ id: 'seed-card', year: 1990 }] : [],
      }));
      const waitingLobby = {
        id: 'lobby_4p',
        code: 'ABCD12',
        status: 'waiting',
        state_revision: 1,
        players,
        selected_category_ids: [1, 2],
      };
      const startedLobby = {
        ...waitingLobby,
        status: 'starting',
        state_revision: 2,
        current_question_id: 'q-start',
        online_question_deck: [{ id: 'q-start', year: 1999, question: 'Q' }],
      };

      const executableFailures = [];
      const created = onlineLobbyReducer(createOnlineLobbyInitialState(), {
        type: ONLINE_LOBBY_ACTIONS.CREATE_SUCCEEDED,
        lobby: waitingLobby,
      });
      if (created.phase !== ONLINE_LOBBY_PHASES.WAITING || created.playerCount !== 4) executableFailures.push('4 participants not represented in waiting state');

      const joined = onlineLobbyReducer(createOnlineLobbyInitialState(), {
        type: ONLINE_LOBBY_ACTIONS.INVITE_ACCEPTED,
        verifiedLobby: waitingLobby,
        joinedLobby: waitingLobby,
      });
      if (joined.phase !== ONLINE_LOBBY_PHASES.JOINED || joined.joinedVia !== 'invite' || joined.playerCount !== 4) executableFailures.push('verifiedLobby/joinedLobby invite accept did not become joined');

      const starting = onlineLobbyReducer(created, { type: ONLINE_LOBBY_ACTIONS.START_REQUESTED });
      if (starting.phase !== ONLINE_LOBBY_PHASES.STARTING) executableFailures.push('START_REQUESTED did not enter starting');

      const missingSharedState = onlineLobbyReducer(starting, {
        type: ONLINE_LOBBY_ACTIONS.START_CONFIRMED,
        lobby: { ...waitingLobby, status: 'starting', state_revision: 2, current_question_id: null, online_question_deck: [] },
      });
      if (missingSharedState.phase === ONLINE_LOBBY_PHASES.STARTED || missingSharedState.sharedGameStateReady) executableFailures.push('started phase allowed without shared game state');

      const started = onlineLobbyReducer(starting, {
        type: ONLINE_LOBBY_ACTIONS.START_CONFIRMED,
        lobby: startedLobby,
      });
      if (started.phase !== ONLINE_LOBBY_PHASES.STARTED || !started.sharedGameStateReady || !hasOnlineSharedGameState(started.lobby)) executableFailures.push('shared game state did not confirm started');

      const duplicateStart = onlineLobbyReducer(started, {
        type: ONLINE_LOBBY_ACTIONS.START_CONFIRMED,
        lobby: startedLobby,
      });
      if (duplicateStart.phase !== ONLINE_LOBBY_PHASES.STARTED || duplicateStart.stateRevision !== 2) executableFailures.push('duplicate start confirmation was not idempotent');

      const newerWaiting = onlineLobbyReducer(created, {
        type: ONLINE_LOBBY_ACTIONS.LOBBY_REFRESHED,
        lobby: { ...waitingLobby, state_revision: 4, players: [...players, { name: 'late-player', email: 'late@example.com' }] },
      });
      const staleSameStatusRefresh = onlineLobbyReducer(newerWaiting, {
        type: ONLINE_LOBBY_ACTIONS.LOBBY_REFRESHED,
        lobby: { ...waitingLobby, state_revision: 2, players: [players[0]] },
      });
      if (staleSameStatusRefresh.stateRevision !== 4 || staleSameStatusRefresh.playerCount !== 5) executableFailures.push('same-status stale refresh erased newer roster state');

      const staleRefresh = onlineLobbyReducer(started, {
        type: ONLINE_LOBBY_ACTIONS.LOBBY_REFRESHED,
        lobby: { ...waitingLobby, state_revision: 1 },
      });
      if (staleRefresh.phase !== ONLINE_LOBBY_PHASES.STARTED || staleRefresh.status !== 'starting') executableFailures.push('stale refresh erased newer started state');

      const recovering = onlineLobbyReducer(created, { type: ONLINE_LOBBY_ACTIONS.RECOVERY_REQUESTED });
      const recovered = onlineLobbyReducer(recovering, {
        type: ONLINE_LOBBY_ACTIONS.RECOVERY_SUCCEEDED,
        lobby: startedLobby,
      });
      if (recovering.phase !== ONLINE_LOBBY_PHASES.RECOVERING || recovered.phase !== ONLINE_LOBBY_PHASES.STARTED) executableFailures.push('missed realtime recovery did not recover to started');

      const expired = onlineLobbyReducer(created, { type: ONLINE_LOBBY_ACTIONS.LOBBY_EXPIRED });
      const expiredStart = onlineLobbyReducer(expired, {
        type: ONLINE_LOBBY_ACTIONS.START_CONFIRMED,
        lobby: startedLobby,
      });
      if (expiredStart.phase !== ONLINE_LOBBY_PHASES.EXPIRED) executableFailures.push('expired lobby was able to start');

      if (required.length || reducerForbidden.length || integrationRequired.length || executableFailures.length) {
        return fail('Online lobby reducer Phase 1 contract failed.', {
          verification: 'STATIC_AND_EXECUTABLE_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          file: 'onlineLobbyReducer + useWaitingRoomSync',
          missing: { required, integrationRequired },
          forbidden: reducerForbidden,
          executableFailures,
        });
      }

      return pass('Online lobby reducer models 4-player join/start/recovery, blocks stale/expired transitions, and stays effect-free.',
        { verification: 'STATIC_AND_EXECUTABLE_CONTRACT' });
    }),

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
