// Kronox Health Center — GameInvite "Aç" opens Lobby regression suite.
//
// Locks the Codex140 fix for the real video bug:
// recipient taps the top banner "Aç", acceptGameInvite succeeds, but the
// returned lobby is re-checked with browser-local timestamp parsing and is
// misclassified as stale, dropping the user onto Online setup with
// "Lobi süresi doldu".

import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import headerNotificationBellSource from '../notifications/HeaderNotificationBell.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import {
  acceptGameInviteFnSource,
  findLobbyByCodeFnSource,
  kronoxServiceWorkerSource,
  sendGameInvitePushFnSource,
} from './simulationPanelContractStrings';
import {
  getLobbyStaleDiagnostics,
  isLobbyStale,
  LOBBY_STALE_AFTER_MS,
} from '@/lib/inviteApi';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };
const SUITE_ID = 'game_invite_open_to_lobby_health';
const SUITE_NAME = 'GameInvite Open-To-Lobby Health Suite';

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

export const EXTRA_SUITES = [
  {
    id: SUITE_ID,
    name: SUITE_NAME,
    critical: true,
    color: '#38bdf8',
  },
];

export const EXTRA_TESTS = [
  makeCase('notification_open_uses_clicked_invite_id',
    'Banner/header/online open actions bind to the exact clicked invite id',
    () => {
      const src = [
        safeStr(gameInviteNotifierSource),
        safeStr(headerNotificationBellSource),
        safeStr(incomingInvitesPanelSource),
      ].join('\n');
      const m = missing(src, [
        "params.set('inviteId', invite.id)",
        'openGameInvite(invite',
        'onOpen={() => handleInviteItem(row)}',
        'handleAccept(invite)',
      ]);
      if (m.length) {
        return fail('One invite surface may open a stale/first invite instead of the clicked row.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          file: 'GameInviteNotifier + HeaderNotificationBell + IncomingInvitesPanel',
        });
      }
      return pass('All invite surfaces pass the selected invite object/id into the shared open flow.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('push_payload_contains_invite_and_lobby_identifiers',
    'Push/in-app notification payload carries invite and lobby identifiers',
    () => {
      const src = `${safeStr(sendGameInvitePushFnSource)}\n${safeStr(kronoxServiceWorkerSource)}`;
      const m = missing(src, ['inviteId', 'lobbyId', 'lobbyCode', 'targetUrl', '/lobby']);
      if (m.length) {
        return fail('Push notification click may not be able to reopen the exact invite/lobby.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          file: 'sendGameInvitePush + public/kronox-sw.js',
        });
      }
      return pass('Push/click payload includes inviteId, lobbyId/lobbyCode, and a /lobby target.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('accept_game_invite_returns_lobby_navigation_target',
    'Successful accept returns a verified lobby payload and the client navigates with joinedLobby state',
    () => {
      const src = `${safeStr(acceptGameInviteFnSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, ['verifiedLobby', "navigate('/lobby'", 'joinedLobby']);
      if (m.length) {
        return fail('Accept success does not provide or consume a verified lobby navigation target.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          file: 'acceptGameInvite + lib/inviteApi.js',
        });
      }
      return pass('Accept returns the verified/joined lobby and the client routes to /lobby with joinedLobby.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('fresh_invite_does_not_show_lobby_expired',
    'Fresh invite + fresh lobby cannot produce “Lobi süresi doldu”',
    () => {
      const now = new Date('2026-06-01T05:10:59Z').getTime();
      const freshLobby = {
        id: 'fresh_lobby',
        status: 'waiting',
        updated_date: '2026-06-01T05:10:52.000000',
      };
      const stale = isLobbyStale(freshLobby, now);
      const diag = getLobbyStaleDiagnostics(freshLobby, now);
      if (stale || !(diag.remainingMs > LOBBY_STALE_AFTER_MS - 10_000)) {
        return fail('A fresh Base44 naive UTC lobby timestamp is still being parsed as local time.', {
          verification: 'EXECUTABLE',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: diag,
        });
      }
      return pass('Naive Base44 lobby timestamps parse as UTC; fresh lobbies stay joinable.',
        { verification: 'EXECUTABLE', actual: diag });
    }),

  makeCase('lobby_stale_guard_uses_safe_timestamp_parse',
    'Lobby stale guards use the same safe timestamp parsing as invite TTL checks',
    () => {
      const src = `${safeStr(gameInviteSelectorsSource)}\n${safeStr(inviteApiSource)}\n${safeStr(findLobbyByCodeFnSource)}\n${safeStr(acceptGameInviteFnSource)}`;
      const m = missing(src, ['parseKronoxTimestamp', 'hasZone', '${str}Z', 'getLobbyExpiry', 'last_activity_at']);
      if (m.length) {
        return fail('A lobby stale guard can still parse naive UTC timestamps with raw new Date().', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          file: 'lib/inviteApi.js + findLobbyByCode + acceptGameInvite',
        });
      }
      return pass('Client and backend lobby stale guards normalize naive Base44 timestamps as UTC.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('invite_open_navigates_lobby_not_online_setup',
    'Successful invite open routes to lobby/waiting room, not Online setup or /game',
    () => {
      const src = `${safeStr(inviteApiSource)}\n${safeStr(lobbyRoomSource)}`;
      const hasLobby = src.includes("navigate('/lobby'") && src.includes('setLobby(res.lobby)');
      const badGame = src.includes("navigate('/game'");
      if (!hasLobby || badGame) {
        return fail('Invite open does not clearly land in the lobby-first waiting room path.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { hasLobby, badGame },
          file: 'lib/inviteApi.js + pages/LobbyRoom.jsx',
        });
      }
      return pass('Invite open uses the lobby-first path and does not navigate directly to game.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('expired_or_stale_error_mapping_is_specific',
    'Invite expired, lobby expired, missing lobby, and unauthorized errors stay specific',
    () => {
      const src = `${safeStr(acceptGameInviteFnSource)}\n${safeStr(inviteApiSource)}\n${safeStr(lobbyRoomSource)}`;
      const m = missing(src, [
        'Davetin süresi doldu',
        'Lobi süresi doldu',
        'Lobi artık mevcut değil',
        'Bu davet sana ait değil',
      ]);
      if (m.length) {
        return fail('Invite/lobby failure states may collapse into misleading user copy.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
        });
      }
      return pass('Invite and lobby failure states retain specific user-facing messages.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('multiple_invites_open_exact_item',
    'Multiple invites cannot make the fresh row open an old/stale invite',
    () => {
      const src = `${safeStr(gameInviteNotifierSource)}\n${safeStr(headerNotificationBellSource)}\n${safeStr(incomingInvitesPanelSource)}`;
      const badFirstItem = src.includes('gameInvites[0]') || src.includes('invites[0]');
      const m = missing(src, [
        'key={row.id}',
        'key={invite.id}',
        'handleInviteItem(row)',
        'handleAccept(invite)',
      ]);
      if (badFirstItem || m.length) {
        return fail('Invite surfaces may be using list position instead of exact item identity.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { badFirstItem },
          missing: m,
        });
      }
      return pass('Rendered invite rows bind actions to their own item identity.',
        { verification: 'STATIC_CONTRACT' });
    }),
];
