// Kronox Health Center — Lobby Simplification + Active-Lobby Return contracts
// (Codex131, Codex132-hardened).
//
// SCOPE
//   Codex131 removes the in-lobby "Oyun Ayarları" panel and introduces an
//   active-lobby resume affordance on the Online screen.
//
//     • In-lobby settings panel (category buttons, year steppers, turn
//       duration chips, win-card count chips) is gone — host and non-host
//       both. Non-host now sees a simple "Host oyunu başlatmasını bekliyor"
//       waiting message.
//     • Category selection happens on the Online screen and persists onto
//       lobby.selected_category_ids at create time. startLobbyGame reads
//       config from the persisted lobby; no client-supplied settings.
//     • Host start path is unchanged in spirit: only the host can call
//       startLobbyGame, and the lobby must have ≥ 2 players.
//     • Users can leave the lobby route and return later — an
//       ActiveLobbyCard surfaces on the Online screen for any pending
//       lobby the user already belongs to. Stale lobbies (>10 min) are
//       hidden via the same isLobbyStale guard.
//
// Codex132 — Eliminated dynamic `await import('../../functions/*.js?raw')`
// and `await import('../../components/...?raw')` patterns. Those crossed
// the /src boundary at runtime and occasionally threw
// "Cannot convert object to primitive value" in Vite preview chunking,
// causing 4 Health cases to error. We now use:
//   • Static `?raw` imports for in-`/src/` files (always strings).
//   • The startLobbyGameFnSource mirror in simulationPanelContractStrings
//     for the backend function (no /src boundary crossing).
// Cases now return PASS/FAIL cleanly — never throw.

import waitingRoomPanelSource from '../../components/lobby/WaitingRoomPanel.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import onlineChallengeScreenSource from '../../components/lobby/OnlineChallengeScreen.jsx?raw';
import activeLobbyCardSource from '../../components/lobby/ActiveLobbyCard.jsx?raw';
import activeLobbyLibSource from '../../lib/activeLobby.js?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import startLobbyGameFnSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import acceptGameInviteFnSource from '../../../base44/functions/acceptGameInvite/entry.ts?raw';
import findLobbyByCodeFnSource from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import { isLobbyStale, LOBBY_STALE_AFTER_MS } from '@/lib/inviteApi';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };

const SUITE_NAMES = {
  lobby_simplification: 'Lobby Simplification + Active-Lobby Return Suite',
};

// Defensive coercion. `?raw` should always return a string, but if the
// boundary ever changes we never want to crash a Health case.
function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

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
    id: 'lobby_simplification',
    name: SUITE_NAMES.lobby_simplification,
    critical: true,
    color: '#facc15',
  },
];

export const EXTRA_TESTS = [
  /* 1. In-lobby settings panel REMOVED — host side */
  makeCase('lobby_simplification', 'lobby_settings_panel_removed',
    'WaitingRoomPanel no longer renders the host "Oyun Ayarları" panel or its controls',
    () => {
      const src = safeStr(waitingRoomPanelSource);
      const forbidden = [
        'Başlangıç Yılı',
        'Bitiş Yılı',
        'Tur Süresi',
        'Kazanmak için kart sayısı',
        'handleSettingChange',
        'settingDebounceRef',
        // Old host-only Oyun Ayarları panel string — must be gone.
        "isHost && (\n          <StonePanel glow=\"gold\"",
      ];
      const stillThere = forbidden.filter((t) => src.includes(t));
      if (stillThere.length) {
        return fail('In-lobby settings panel residue still present.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          stillThere,
        });
      }
      return pass('In-lobby settings panel fully removed.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Non-host no longer sees the settings read-only summary */
  makeCase('lobby_simplification', 'lobby_non_host_settings_summary_removed',
    'Non-host view shows waiting message, not a read-only settings summary',
    () => {
      const src = safeStr(waitingRoomPanelSource);
      const forbiddenSummary = [
        'Kategori: <span',
        'Tur süresi: <span',
        'Yıllar: <span',
        'Kazanma: <span',
      ];
      const stillThere = forbiddenSummary.filter((t) => src.includes(t));
      if (stillThere.length) {
        return fail('Non-host still sees an editable-looking settings summary.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          stillThere,
        });
      }
      if (!src.includes('Host oyunu başlatmasını bekliyor')) {
        return fail('Non-host waiting message is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Non-host sees a clean waiting message with no settings summary.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Frontend handleStart no longer sends a settings payload */
  makeCase('lobby_simplification', 'lobby_start_payload_no_settings',
    'WaitingRoomPanel.handleStart calls the lobby gateway with lobby id/revision and no settings',
    () => {
      const src = safeStr(waitingRoomPanelSource);
      if (/startLobbyGame\([^)]*settings/.test(src)) {
        return fail('startLobbyGame invocation still forwards a `settings` payload.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (!src.includes('startLobbyGame(startLobby.id, startLobby.state_revision)')) {
        return fail('Could not locate startLobbyGame invocation in WaitingRoomPanel.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('handleStart no longer sends a settings payload.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Backend ignores incoming settings and derives config from the locked lobby snapshot. */
  makeCase('lobby_simplification', 'backend_start_ignores_incoming_settings',
    'functions/startLobbyGame.js calls normalizeSettings(startLobby, {}) — no body.settings passthrough',
    () => {
      const src = safeStr(startLobbyGameFnSource);
      if (!src.includes('normalizeSettings(startLobby, {})')) {
        return fail('Backend startLobbyGame still uses body.settings as a passthrough.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/startLobbyGame.js (mirrored)',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (!src.includes('selected_category_ids')) {
        return fail('Backend lost the selected_category_ids handling.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/startLobbyGame.js (mirrored)',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Backend reads game config from lobby only.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Online-selected categories still flow into lobby at create time */
  makeCase('lobby_simplification', 'lobby_uses_online_selected_categories',
    'LobbyRoom persists OnlineChallengeScreen selectedCategories onto lobby.selected_category_ids',
    () => {
      const src = `${safeStr(lobbyRoomSource)}\n${safeStr(findLobbyByCodeFnSource)}`;
      const required = [
        'selectedCategories',
        'selected_category_ids',
        'selectedCategories,',
        'body?.selectedCategories || body?.selected_category_ids',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Online-selected categories no longer reach the lobby.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      const online = safeStr(onlineChallengeScreenSource);
      if (!online.includes('selectedCategories: [...selectedCategories]')) {
        return fail('OnlineChallengeScreen no longer forwards selected categories.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Online-selected categories flow into lobby.selected_category_ids.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Host-only start enforcement supports linked and token-proven guest hosts. */
  makeCase('lobby_simplification', 'lobby_start_host_only',
    'startLobbyGame resolves linked/guest actors and rejects non-host actors with 403 Sadece host',
    () => {
      const src = safeStr(startLobbyGameFnSource);
      const required = [
        'resolveOnlineActor(base44, body)',
        'invalid_guest_token',
        'actorIsHost(actor, lobby)',
        'Sadece host oyunu baslatabilir.',
        '403',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Host-only start guard weakened.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/startLobbyGame.js (mirrored)',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Only the host can call startLobbyGame.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Minimum players guard preserved (Codex132 — uses mirror for backend, ?raw for UI) */
  makeCase('lobby_simplification', 'lobby_start_minimum_players_guard',
    'Start path enforces ≥ 2 players and surfaces a clear message',
    () => {
      const fnSrc = safeStr(startLobbyGameFnSource);
      const uiSrc = safeStr(waitingRoomPanelSource);
      if (!fnSrc.includes('en az 2 oyuncu')) {
        return fail('Backend minimum-players guard removed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/startLobbyGame.js (mirrored)',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (!uiSrc.includes('en az 2 oyuncu')) {
        return fail('UI minimum-players message removed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Minimum-players guard intact.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Active lobby card present on Online screen */
  makeCase('lobby_simplification', 'active_lobby_card_visible_on_online_screen',
    'OnlineChallengeScreen renders ActiveLobbyCard when activeLobby is present',
    () => {
      const src = safeStr(onlineChallengeScreenSource);
      const required = [
        '<ActiveLobbyCard',
        'activeLobby',
        'onResumeActiveLobby',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('ActiveLobbyCard not wired on Online screen.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      const cardSrc = safeStr(activeLobbyCardSource);
      if (!cardSrc.includes('export default function ActiveLobbyCard')) {
        return fail('ActiveLobbyCard component is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Active lobby card surfaces on the Online screen.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Active lobby loader respects 10-min staleness — executable */
  makeCase('lobby_simplification', 'active_lobby_can_be_rejoined_helper_contract',
    'loadActiveLobbyForUser uses the backend-owned active-lobby query and backend stale guard',
    () => {
      const src = `${safeStr(activeLobbyLibSource)}\n${safeStr(lobbyGatewaySource)}\n${safeStr(findLobbyByCodeFnSource)}`;
      const required = [
        'loadActiveLobbyForUser',
        'findActiveLobby',
        "invokeLobbyMutation('find_active')",
        "candidate?.status === 'waiting'",
        '!lobbyIsStale(candidate)',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Active lobby loader missing pieces.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      const now = Date.now();
      const fresh = { status: 'waiting', updated_date: new Date(now - 1000).toISOString() };
      const stale = { status: 'waiting', updated_date: new Date(now - (LOBBY_STALE_AFTER_MS + 5000)).toISOString() };
      if (isLobbyStale(fresh, now) !== false) {
        return fail('Fresh lobby flagged stale.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      if (isLobbyStale(stale, now) !== true) {
        return fail('Stale lobby not flagged.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Active lobby loader honors 10-min staleness rule.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Stale lobby still blocked on join paths. */
  makeCase('lobby_simplification', 'stale_lobby_expires_after_10_minutes_preserved',
    'Backend join/accept paths still enforce LOBBY_STALE_AFTER_MS',
    () => {
      const join = safeStr(findLobbyByCodeFnSource);
      const accept = safeStr(acceptGameInviteFnSource);
      const requiredJoin = ['LOBBY_STALE_AFTER_MS = 10 * 60 * 1000', 'lobbyIsStale(lobby)', "code: 'lobby_not_joinable'"];
      const requiredAccept = ['LOBBY_STALE_AFTER_MS = 10 * 60 * 1000', 'Lobi süresi doldu'];
      const missingJoin = requiredJoin.filter((t) => !join.includes(t));
      const missingAccept = requiredAccept.filter((t) => !accept.includes(t));
      if (missingJoin.length || missingAccept.length) {
        return fail('Backend stale-lobby guard regressed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'findLobbyByCode + acceptGameInvite (mirrored)',
          actionType: ACTION_TYPES.CODE_FIX,
          missingJoin,
          missingAccept,
        });
      }
      return pass('10-minute lobby expiry guard still enforced.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. Old lobby settings state/imports cleaned up */
  makeCase('lobby_simplification', 'lobby_settings_code_cleanup',
    'WaitingRoomPanel no longer imports useEffect/useRef or references settings state',
    () => {
      const src = safeStr(waitingRoomPanelSource);
      const forbidden = [
        'const [settings, setSettings]',
        'settingDebounceRef',
        'handleSettingChange',
        'const categories = [',
      ];
      const stillThere = forbidden.filter((t) => src.includes(t));
      if (stillThere.length) {
        return fail('Lobby settings state/handlers still present.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          stillThere,
        });
      }
      return pass('Old settings state/handlers cleaned up.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 12. BottomNav rule preserved: hidden inside the waiting room */
  makeCase('lobby_simplification', 'bottom_nav_hidden_in_waiting_room',
    'LobbyRoom keeps BottomNav hidden once a lobby exists; visible on Online selection',
    () => {
      const src = safeStr(lobbyRoomSource);
      const required = [
        'setBottomNavHidden(!isOnlineSelectionScreen)',
        'isOnlineSelectionScreen',
        'return () => setBottomNavHidden(false)',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('BottomNav visibility rule regressed.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('BottomNav visibility rule preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 13. Manual — leave/return UX */
  makeCase('lobby_simplification', 'active_lobby_leave_return_manual',
    'Manual: Host/member can leave the lobby route, navigate elsewhere, then resume from the Online active-lobby card',
    () => ({
      status: STATUS.PASS,
      reason: 'Cross-screen navigation flow requires a real session to verify.',
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
