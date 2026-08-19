// Kronox Health Center — Online Challenge Screen flow contracts (Codex592).
//
// SCOPE
//   Lock the current simplified Online Challenge flow in place:
//     • Online has NO category selection — questions draw randomly from all
//       active categories (startLobbyGame / randomMatchmaking backend owns
//       this; the Online screen must not render a category carousel).
//     • Two entry points, both routed through the shared Pre-game Hourglass
//       search screen: "Arkadaşını Davet Et" (invite, 60s), "Online Kapış"
//       and Duello (mode-scoped matchmaking queues, 30s).
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

import appSource from '../../App.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import onlinePageSource from '../../pages/OnlinePage.jsx?raw';
import onlineChallengeScreenSource from '../../components/lobby/OnlineChallengeScreen.jsx?raw';
import friendSelectModalSource from '../../components/lobby/FriendSelectModal.jsx?raw';
import incomingInvitesPanelSource from '../../components/invites/IncomingInvitesPanel.jsx?raw';
import useRandomMatchmakingSource from '../../hooks/useRandomMatchmaking.js?raw';
import randomMatchmakingApiSource from '../../lib/randomMatchmakingApi.js?raw';
import preGameHourglassSource from '../../components/lobby/PreGameHourglass.jsx?raw';
import startLobbyGameSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import gameSource from '../../pages/Game.jsx?raw';
import { auditSourceContracts, findRenderedSensitiveKeyHits } from '@/lib/health/sourceProof';

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
      const required = missingTokens(onlineChallengeScreenSource, [
        'Tüm kategorilerden rastgele sorular',
      ]);
      if (forbidden.length || required.length) {
        return fail('Category selection UI/state leaked back into the Online screen.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'visible all-category random copy and no OnlineCategoryCarousel / selectedCategories / selected_category_ids tokens',
          actual: { forbidden, required },
        });
      }
      return pass('Online screen has no category selection UI/state.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Online screen offers invite, Online Kapış, and Duello search entry points. */
  makeCase('online_challenge_flow', 'online_offers_invite_and_random_modes',
    'OnlineChallengeScreen offers Invite, Online Kapış, and Duello through the shared search surface',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        'Arkadaşını Davet Et',
        'Online Kapış',
        'Duello',
        'const INVITE_WAIT_MS = 60 * 1000',
        'durationMs={30 * 1000}',
        "import PreGameHourglass from '@/components/lobby/PreGameHourglass'",
        "import useRandomMatchmaking from '@/hooks/useRandomMatchmaking'",
        "'invite-wait'",
        "'random-wait'",
        "'duel-wait'",
      ]);
      if (required.length) {
        return fail('Online screen is missing its invite/Online Kapış/Duello search wiring.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'invite + Online Kapış + Duello CTAs and their bounded shared search surfaces',
          actual: { required },
        });
      }
      return pass('All Online entry points use the shared bounded search surface.',
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

  /* 6. Friend modal keeps a reusable default while Online direct matches cap at one opponent. */
  makeCase('online_challenge_flow', 'friend_modal_caps_at_three',
    'FriendSelectModal has a default cap of 3 and Online direct matches cap at one opponent',
    () => {
      const required = missingTokens(`${friendSelectModalSource}\n${onlineChallengeScreenSource}`, [
        'DEFAULT_MAX_SELECTION = 3',
        'maxSelection = DEFAULT_MAX_SELECTION',
        'prev.length >= maxSelection',
        'maxSelection={1}',
      ]);
      if (required.length) {
        return fail('Friend modal selection caps do not match reusable/direct-match ownership.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'default maxSelection=3 and OnlineChallengeScreen maxSelection=1',
          actual: { required },
        });
      }
      return pass('Friend modal enforces its configurable cap; direct Online invite matches select one opponent.',
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

  /* 8. OnlinePage owns the active flow; LobbyRoom is compatibility redirect only. */
  makeCase('online_challenge_flow', 'lobby_room_wires_new_online_flow',
    'OnlinePage wires search to direct backend handoff while LobbyRoom redirects only',
    () => {
      const required = missingTokens(`${appSource}\n${onlinePageSource}\n${lobbyRoomSource}`, [
        'path="/online"',
        '<OnlineChallengeScreen',
        'onCreateInviteMatch={',
        'onMatchFound={handleMatchFound}',
        '<DirectOnlineMatchScreen',
        "pathname: '/online'",
      ]);
      const forbidden = forbiddenTokensFound(`${onlinePageSource}\n${lobbyRoomSource}`, [
        '<WaitingRoomPanel',
        '<ActiveLobbyCard',
      ]);
      if (required.length || forbidden.length) {
        return fail('Active Online direct-start ownership or legacy redirect drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/OnlinePage.jsx / pages/LobbyRoom.jsx / App.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: '/online owns OnlineChallengeScreen + DirectOnlineMatchScreen; /lobby redirects only',
          actual: { required, forbidden },
        });
      }
      return pass('OnlinePage owns search/direct start and LobbyRoom cannot mount gameplay UI.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. BottomNav stays on Online selection and hides only during a direct handoff/deep link. */
  makeCase('online_challenge_flow', 'bottom_nav_visibility_rules_preserved',
    'BottomNav stays visible on Online selection and hides during a direct match or invite deep link',
    () => {
      const required = missingTokens(onlinePageSource, [
        'setBottomNavHidden',
        'setBottomNavHidden(Boolean(match || queryInviteId))',
        'return () => setBottomNavHidden(false)',
      ]);
      if (required.length) {
        return fail('BottomNav visibility rule was lost on OnlinePage.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/OnlinePage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'BottomNav hidden only while match handoff or invite deep link is active',
          actual: { required },
        });
      }
      return pass('BottomNav visibility rules preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Invite infrastructure remains backend-backed without a user-visible lobby. */
  makeCase('online_challenge_flow', 'invite_infrastructure_preserved',
    'Private match creation still triggers createGameInvites and cleans failed sessions',
    () => {
      const required = missingTokens(onlinePageSource, [
        'createLobby({ code, playerName, maxPlayers: 2 })',
        'createGameInvites',
        'inviteTargets',
        'const summary = await createGameInvites',
        'if (created?.id) await leaveLobby(created.id).catch(() => null)',
      ]);
      if (required.length) {
        return fail('Invite creation pathway was broken.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/OnlinePage.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'createGameInvites still invoked with inviteTargets',
          actual: { required },
        });
      }
      return pass('Invite creation pathway is preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('online_challenge_flow', 'online_shared_deck_runtime_contract',
    'Online uses the backend-authored all-active shared deck and never Solo preference/question buffers',
    () => {
      const violations = auditSourceContracts([
        { file: 'base44/functions/startLobbyGame/entry.ts', source: startLobbyGameSource, required: ["const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_all_active_random_deck_v1'", 'allCategoriesRandom: true', 'soloPreferenceWeightingApplied: false', 'guestSoloPathUsed: false', 'return Array.from(activeMainCategoryIds)', 'online_question_deck: initialState.onlineQuestionDeck'] },
        { file: 'src/pages/Game.jsx', source: gameSource, required: ['const questionFetchEnabled = !isOnline', 'normalizeOnlineQuestionDeck', 'if (isOnline) {', 'return onlineQuestionDeck;'] },
      ]);
      return violations.length
        ? fail('Online shared-deck/all-active isolation drifted.', { verification: 'STATIC_CONTRACT', classification: 'REAL_PRODUCT_RISK', actual: { violations } })
        : pass('startLobbyGame authors the all-active random shared deck; Game disables Solo fetching and consumes that deck.', { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('online_challenge_flow', 'join_by_code_remains_available',
    'Legacy join-by-code UI is absent from the active no-lobby Online flow',
    () => {
      const forbidden = forbiddenTokensFound(`${onlineChallengeScreenSource}\n${onlinePageSource}`, [
        'onJoinOpenLobby',
        'veya kodla katıl',
        '<LobbyCreateJoinPanel',
      ]);
      const redirectOk = appSource.includes('function LegacyLobbyRedirect()') && appSource.includes("pathname: '/online'");
      return forbidden.length || !redirectOk
        ? fail('Legacy lobby/join-code UI returned to the active Online flow.', { verification: 'STATIC_CONTRACT', classification: 'REAL_PRODUCT_RISK', actual: { forbidden, redirectOk } })
        : pass('Active Online exposes no join-code/lobby step; legacy routes redirect to /online.', { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* Privacy — no forbidden private keys rendered/exposed in the Pre-game Hourglass surfaces. */
  makeCase('online_challenge_flow', 'online_flow_privacy_no_forbidden_keys',
    'OnlineChallengeScreen / PreGameHourglass / FriendSelectModal never render invited emails or private actor identifiers (guest_token may only be used as an opaque backend-call/effect-dependency value, never rendered)',
    () => {
      const keys = ['to_email', 'from_email', 'owner_key', 'actor_key_hash', 'guest_token', 'guest_id', 'player_key', 'kronox_user_id'];
      const surfaces = [
        ['OnlineChallengeScreen.jsx', onlineChallengeScreenSource],
        ['PreGameHourglass.jsx', preGameHourglassSource],
        ['FriendSelectModal.jsx', friendSelectModalSource],
      ];
      const forbidden = surfaces.flatMap(([file, source]) => (
        findRenderedSensitiveKeyHits(source, keys).map((key) => ({ file, key }))
      ));
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
