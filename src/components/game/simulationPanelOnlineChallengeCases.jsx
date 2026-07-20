// Kronox Health Center — Online Challenge Screen flow contracts (Codex592).
//
// SCOPE
//   Lock the current simplified Online Challenge flow in place:
//     • Online has NO category selection — questions draw randomly from all
//       active categories (startLobbyGame / randomMatchmaking backend owns
//       this; the Online screen must not render a category carousel).
//     • Two entry points, both routed through the shared Pre-game Hourglass
//       wait screen: "Arkadaşını Davet Et" (invite, 60s) and
//       "Rastgele Eşleş" (random matchmaking queue, 30s).
//     • Optional social/player-list load failure (loadSocialSnapshot /
//       getOnlinePlayerSelection) must never render as a page-level alarm
//       banner and must never disable Rastgele Eşleş.
//     • Random matchmaking (useRandomMatchmaking) has zero dependency on
//       friend/social/player-selection data.
//     • Public player selection / invite data stays privacy-safe.
//
//   All checks are static-source contracts against the relevant files.
//   None of them call live entities/SDK — they read raw module source via
//   Vite's `?raw` import to verify the wiring stays in place.
//
// HONESTY
//   These contracts are STATIC_CHECK_LIMITATION on pass: they prove the
//   tokens are present, not that the live UX is bug-free. Runtime / device
//   verification stays NOT_AUTOMATABLE elsewhere.

import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import onlineChallengeScreenSource from '../../components/lobby/OnlineChallengeScreen.jsx?raw';
import friendSelectModalSource from '../../components/lobby/FriendSelectModal.jsx?raw';
import incomingInvitesPanelSource from '../../components/invites/IncomingInvitesPanel.jsx?raw';
import useRandomMatchmakingSource from '../../hooks/useRandomMatchmaking.js?raw';
import randomMatchmakingApiSource from '../../lib/randomMatchmakingApi.js?raw';
import preGameHourglassSource from '../../components/lobby/PreGameHourglass.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  online_challenge_flow: 'Online Challenge Flow Suite',
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

function missingTokens(source, tokens) {
  return tokens.filter((t) => !String(source || '').includes(t));
}
function forbiddenTokensFound(source, tokens) {
  return tokens.filter((t) => String(source || '').includes(t));
}

export const EXTRA_SUITES = [
  {
    id: 'online_challenge_flow',
    name: SUITE_NAMES.online_challenge_flow,
    critical: true,
    color: '#38bdf8',
  },
];

export const EXTRA_TESTS = [
  /* 1. Online ekranında kategori carousel YOK. */
  makeCase('online_challenge_flow', 'online_screen_no_category_selection',
    'OnlineChallengeScreen does not render category selection — Online draws random questions from all active categories',
    () => {
      const forbidden = forbiddenTokensFound(onlineChallengeScreenSource, [
        'OnlineCategoryCarousel',
        'selectedCategories',
        'selected_category_ids',
      ]);
      if (forbidden.length) {
        return fail('Category selection UI/state leaked back into the Online screen.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no OnlineCategoryCarousel / selectedCategories / selected_category_ids tokens',
          actual: { forbidden },
        });
      }
      return pass('Online screen has no category selection UI/state.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Online screen offers both Invite and Random entry points into the Pre-game Hourglass. */
  makeCase('online_challenge_flow', 'online_offers_invite_and_random_modes',
    'OnlineChallengeScreen offers "Arkadaşını Davet Et" (invite) and "Rastgele Eşleş" (random matchmaking), both routed through PreGameHourglass',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        'Arkadaşını Davet Et',
        'Rastgele Eşleş',
        "import PreGameHourglass from '@/components/lobby/PreGameHourglass'",
        "import useRandomMatchmaking from '@/hooks/useRandomMatchmaking'",
        "'invite-wait'",
        "'random-wait'",
      ]);
      if (required.length) {
        return fail('Online screen is missing the invite/random dual-entry Pre-game Hourglass wiring.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'invite + random CTAs, PreGameHourglass + useRandomMatchmaking imports, invite-wait/random-wait screens',
          actual: { required },
        });
      }
      return pass('Both Online entry points route through the Pre-game Hourglass.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Random matchmaking hook has zero dependency on social/friend/player-selection data. */
  makeCase('online_challenge_flow', 'random_matchmaking_independent_of_social_data',
    'useRandomMatchmaking / randomMatchmakingApi do not import friend, social snapshot, or player-selection modules',
    () => {
      const forbiddenInHook = forbiddenTokensFound(useRandomMatchmakingSource, [
        'onlinePlayerSelection',
        'inviteApi',
        'friendsApi',
        'loadSocialSnapshot',
      ]);
      const forbiddenInApi = forbiddenTokensFound(randomMatchmakingApiSource, [
        'onlinePlayerSelection',
        'inviteApi',
        'friendsApi',
        'loadSocialSnapshot',
      ]);
      // handleStartRandom must not gate on player-list/social state before calling random.start().
      const randomStartGatedOnSocial = forbiddenTokensFound(onlineChallengeScreenSource, [
        'handleStartRandom = () => {\n    if (players',
        'handleStartRandom = () => {\n    if (!players',
      ]);
      if (forbiddenInHook.length || forbiddenInApi.length || randomStartGatedOnSocial.length) {
        return fail('Random matchmaking has a dependency on social/friend/player-selection data.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'useRandomMatchmaking.js / randomMatchmakingApi.js / OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no social/friend/player-selection imports; handleStartRandom never gated on player list',
          actual: { forbiddenInHook, forbiddenInApi, randomStartGatedOnSocial },
        });
      }
      return pass('Random matchmaking is fully independent of social/friend/player-selection data.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Optional invite notification list failure must not render as a page-level alarm banner. */
  makeCase('online_challenge_flow', 'incoming_invites_panel_load_failure_non_blocking',
    'IncomingInvitesPanel only surfaces action-specific (accept/reject) errors — background list-fetch failure (center.error) is never shown as a blocking banner',
    () => {
      const required = missingTokens(incomingInvitesPanelSource, [
        'const error = localError;',
      ]);
      const forbidden = forbiddenTokensFound(incomingInvitesPanelSource, [
        'localError || center.error',
      ]);
      if (required.length || forbidden.length) {
        return fail('Optional invite-list load failure can still surface as a page-level error banner.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'IncomingInvitesPanel.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'error state sourced only from localError (action-specific), not center.error (list fetch)',
          actual: { required, forbidden },
        });
      }
      return pass('Invite-list load failure stays silent/non-blocking; only action errors surface.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Manual invite/player-list failure shows a local calm recoverable state with retry, scoped to the modal. */
  makeCase('online_challenge_flow', 'friend_modal_local_recoverable_error',
    'FriendSelectModal shows a calm local "Oyuncular yüklenemedi." error with a Tekrar Dene retry, scoped to the modal only',
    () => {
      const required = missingTokens(friendSelectModalSource, [
        'Oyuncular yüklenemedi.',
        'Tekrar Dene',
      ]);
      if (required.length) {
        return fail('Friend/player selection modal is missing the local recoverable error contract.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '"Oyuncular yüklenemedi." + "Tekrar Dene" retry inside the modal',
          actual: { required },
        });
      }
      return pass('Manual invite player-list failure is calm, local, and retryable.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Friend modal caps selection at 3. */
  makeCase('online_challenge_flow', 'friend_modal_caps_at_three',
    'FriendSelectModal enforces a max selection cap of 3',
    () => {
      const required = missingTokens(friendSelectModalSource, [
        'MAX_SELECTION = 3',
        'prev.length >= MAX_SELECTION',
      ]);
      if (required.length) {
        return fail('Friend modal does not enforce the 3-player cap.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'MAX_SELECTION=3 cap',
          actual: { required },
        });
      }
      return pass('Friend modal enforces the 3-player cap.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Shared top bar (back + diamond + bell, no avatar). */
  makeCase('online_challenge_flow', 'online_uses_shared_top_bar',
    'OnlineChallengeScreen uses the shared <StandardTopBar> (back + diamond + bell, no avatar)',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        "import StandardTopBar from '@/components/layout/StandardTopBar'",
        '<StandardTopBar',
        'showBack',
        'getLeaderboardDiamondValue',
      ]);
      if (required.length) {
        return fail('StandardTopBar (back + diamond + bell) is not wired on Online screen.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'StandardTopBar import + back arrow + diamond chip',
          actual: { required },
        });
      }
      return pass('StandardTopBar is used (back + diamond + bell, no avatar).',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. LobbyCreateJoinPanel only handles "join" mode. */
  makeCase('online_challenge_flow', 'lobby_room_wires_new_online_flow',
    'LobbyRoom wires OnlineChallengeScreen through onCreateInviteLobby / onEnterLobby (not the legacy onStartChallenge one-shot CTA)',
    () => {
      const required = missingTokens(lobbyRoomSource, [
        'onCreateInviteLobby={',
        'onEnterLobby={',
        'OnlineChallengeScreen',
      ]);
      const forbidden = forbiddenTokensFound(lobbyRoomSource, [
        'onStartChallenge={',
        'CreateLobbyInvitePanel',
      ]);
      if (required.length || forbidden.length) {
        return fail('LobbyRoom is not wired to the current Pre-game Hourglass Online flow.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'onCreateInviteLobby + onEnterLobby wiring; no legacy onStartChallenge/CreateLobbyInvitePanel',
          actual: { required, forbidden },
        });
      }
      return pass('LobbyRoom routes through the current invite/random Online flow.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. BottomNav görünürlük kuralları korunuyor. */
  makeCase('online_challenge_flow', 'bottom_nav_visibility_rules_preserved',
    'BottomNav stays visible on the Online selection screen and is hidden once a lobby is active or an invite deep-link is pending',
    () => {
      const required = missingTokens(lobbyRoomSource, [
        'setBottomNavHidden',
        'isOnlineSelectionScreen',
        '!lobby && !queryInviteId && (mode === null || mode === undefined)',
      ]);
      if (required.length) {
        return fail('BottomNav visibility rule was lost on LobbyRoom.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'BottomNav hidden only when lobby/invite is active',
          actual: { required },
        });
      }
      return pass('BottomNav visibility rules preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Davet altyapısı korunuyor. */
  makeCase('online_challenge_flow', 'invite_infrastructure_preserved',
    'Lobby creation still triggers createGameInvites for selected invite targets — invite backend wiring is preserved',
    () => {
      const required = missingTokens(lobbyRoomSource, [
        'createGameInvites',
        'inviteTargets',
        'await createGameInvites',
      ]);
      if (required.length) {
        return fail('Invite creation pathway was broken.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'createGameInvites still invoked with inviteTargets',
          actual: { required },
        });
      }
      return pass('Invite creation pathway is preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. Privacy — no forbidden private keys in the Pre-game Hourglass surfaces. */
  makeCase('online_challenge_flow', 'online_flow_privacy_no_forbidden_keys',
    'OnlineChallengeScreen / PreGameHourglass / FriendSelectModal never render invited emails or private actor identifiers',
    () => {
      const forbidden = [
        onlineChallengeScreenSource,
        preGameHourglassSource,
        friendSelectModalSource,
      ].flatMap((source) => forbiddenTokensFound(source, [
        'invite.to_email', 'invite.from_email', 'owner_key', 'actor_key_hash', 'guest_token',
      ]));
      if (forbidden.length) {
        return fail('Private identifiers leaked into the Online invite/matchmaking UI.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx / PreGameHourglass.jsx / FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no email/owner_key/actor_key_hash/guest_token tokens rendered in these surfaces',
          actual: { forbidden },
        });
      }
      return pass('No private identifiers are exposed by the Online invite/matchmaking UI.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];