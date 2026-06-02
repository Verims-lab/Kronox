// Kronox Health Center — Online Challenge Screen flow contracts (Codex127).
//
// SCOPE
//   Lock the new simplified Online Challenge flow in place:
//     • Online ana ekran → kategori carousel + arkadaş popup + CTA
//     • "Meydan Okumaya Başla" disabled until ≥1 friend selected
//     • Tapping CTA opens the lobby DIRECTLY (no extra friend-select page)
//     • Email invite input REMOVED from this flow (popup uses friend list)
//     • BottomNav visible on the Online selection screen
//     • Old separate friend-select page (CreateLobbyInvitePanel) no longer
//       referenced from the active LobbyRoom flow.
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
import lobbyCreateJoinPanelSource from '../../components/lobby/LobbyCreateJoinPanel.jsx?raw';
import onlineChallengeScreenSource from '../../components/lobby/OnlineChallengeScreen.jsx?raw';
import friendSelectModalSource from '../../components/lobby/FriendSelectModal.jsx?raw';
import onlineCategoryCarouselSource from '../../components/lobby/OnlineCategoryCarousel.jsx?raw';

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
  /* 1. Online ekran popup ile arkadaş seçer, ayrı sayfa AÇILMAZ. */
  makeCase('online_challenge_flow', 'online_uses_popup_friend_selection',
    'Online challenge screen uses a popup (FriendSelectModal) for friend selection — no separate friend page route',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        'FriendSelectModal',
        'friendModalOpen',
        'setFriendModalOpen',
      ]);
      const lobbyMustImportNewScreen = missingTokens(lobbyRoomSource, [
        'OnlineChallengeScreen',
      ]);
      if (required.length || lobbyMustImportNewScreen.length) {
        return fail('Online screen is not wired to the popup-based friend selection.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx / LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'FriendSelectModal usage + LobbyRoom routes through OnlineChallengeScreen',
          actual: { required, lobbyMustImportNewScreen },
        });
      }
      return pass('Online screen routes through popup friend selection.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Challenge butonu en az 1 arkadaş seçimine kadar disabled. */
  makeCase('online_challenge_flow', 'challenge_cta_disabled_until_friend_selected',
    '"Meydan Okumaya Başla" CTA is disabled until at least one friend is selected',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        'ctaDisabled',
        'selectedEmails.length === 0',
        'disabled={ctaDisabled}',
      ]);
      if (required.length) {
        return fail('Challenge CTA disabled-state contract missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'CTA disabled when selectedEmails.length === 0',
          actual: { required },
        });
      }
      return pass('CTA disable wiring is in place.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. CTA bastığında DİREKT lobi açılır — ayrı arkadaş seçim ekranı YOK. */
  makeCase('online_challenge_flow', 'challenge_opens_lobby_directly',
    'Tapping the CTA invokes handleCreate directly with { invitedEmails, selectedCategories } — no extra screen',
    () => {
      const required = missingTokens(lobbyRoomSource, [
        'onStartChallenge={({ selectedCategories, selectedEmails })',
        'handleCreate({',
        'invitedEmails',
        'selectedCategories',
      ]);
      // The old CreateLobbyInvitePanel must NOT appear in active LobbyRoom flow.
      const forbidden = forbiddenTokensFound(lobbyRoomSource, [
        'CreateLobbyInvitePanel',
        "setMode('create')",
      ]);
      if (required.length || forbidden.length) {
        return fail('Lobby is not opened directly from the new challenge CTA.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'onStartChallenge → handleCreate; no CreateLobbyInvitePanel; no setMode("create")',
          actual: { required, forbidden },
        });
      }
      return pass('CTA opens the lobby in one step.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Mail ile davet etme alanı YOK. */
  makeCase('online_challenge_flow', 'no_email_invite_input_in_online_flow',
    'Email invite text input is removed from the online challenge screen and the friend modal',
    () => {
      // Look for typical email-input markers on the new flow surfaces.
      const forbiddenOnScreen = forbiddenTokensFound(onlineChallengeScreenSource, [
        'type="email"', 'inputMode="email"', 'placeholder="E-posta"', 'sendFriendRequest(',
      ]);
      const forbiddenInModal = forbiddenTokensFound(friendSelectModalSource, [
        'type="email"', 'inputMode="email"', 'placeholder="E-posta"', 'sendFriendRequest(',
      ]);
      if (forbiddenOnScreen.length || forbiddenInModal.length) {
        return fail('Email-invite UI must not exist in the online flow.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx / FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'no email input fields, no sendFriendRequest call',
          actual: { forbiddenOnScreen, forbiddenInModal },
        });
      }
      return pass('Email invite UI is removed from the online flow.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Popup max 3 seçim. */
  makeCase('online_challenge_flow', 'friend_modal_caps_at_three',
    'FriendSelectModal enforces a max selection cap of 3',
    () => {
      const required = missingTokens(friendSelectModalSource, [
        'MAX_SELECTION = 3',
        'prev.length >= MAX_SELECTION',
      ]);
      if (required.length) {
        return fail('Friend modal does not enforce the 3-friend cap.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'FriendSelectModal.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'MAX_SELECTION=3 cap',
          actual: { required },
        });
      }
      return pass('Friend modal enforces the 3-friend cap.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Kategori carousel multi-select. */
  makeCase('online_challenge_flow', 'category_carousel_multi_select',
    'OnlineCategoryCarousel supports multi-select via toggle (selectedIds + onToggle prop wiring)',
    () => {
      const required = missingTokens(onlineCategoryCarouselSource, [
        'selectedIds',
        'onToggle',
        'isSelected = selectedIds.includes(cat.id)',
      ]);
      if (required.length) {
        return fail('Category carousel is not wired for multi-select.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineCategoryCarousel.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'selectedIds + onToggle props consumed',
          actual: { required },
        });
      }
      return pass('Category carousel exposes multi-select wiring.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Codex159 — Yeni Online ekran StandardTopBar kullanır (Home/Solo ile
        aynı): back + diamond chip + bell. Avatar/score chip artık BURADA
        gösterilmez (yeni hedef tasarım kararı). */
  makeCase('online_challenge_flow', 'online_uses_shared_top_bar',
    'OnlineChallengeScreen uses the shared <StandardTopBar> (back + diamond + bell, no avatar) — Codex159 redesign',
    () => {
      const required = missingTokens(onlineChallengeScreenSource, [
        "import StandardTopBar from '@/components/layout/StandardTopBar'",
        '<StandardTopBar',
        'showBack',
        'getLeaderboardDiamondValue',
      ]);
      // Avatar/score chip must NOT live on this screen anymore.
      const forbidden = forbiddenTokensFound(onlineChallengeScreenSource, [
        'headerStats={{',
        "import ScreenHeader from '@/components/layout/ScreenHeader'",
      ]);
      if (required.length || forbidden.length) {
        return fail('StandardTopBar (back + diamond + bell) is not wired on Online screen.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'OnlineChallengeScreen.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'StandardTopBar import + back arrow + diamond chip (no ScreenHeader, no headerStats)',
          actual: { required, forbidden },
        });
      }
      return pass('StandardTopBar is used (back + diamond + bell, no avatar).',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. LobbyCreateJoinPanel artık sadece "join" modu — landing/create akışı yok. */
  makeCase('online_challenge_flow', 'lobby_panel_only_handles_join',
    'LobbyCreateJoinPanel only renders the "join via code" mode now; landing/create paths are removed',
    () => {
      const required = missingTokens(lobbyCreateJoinPanelSource, [
        "if (mode !== 'join') return null",
      ]);
      const forbidden = forbiddenTokensFound(lobbyCreateJoinPanelSource, [
        'OnlineChallengeLanding',
        'CreateLobbyInvitePanel',
      ]);
      if (required.length || forbidden.length) {
        return fail('LobbyCreateJoinPanel still contains the legacy create/landing flow.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'LobbyCreateJoinPanel.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'join-only render; no OnlineChallengeLanding/CreateLobbyInvitePanel references',
          actual: { required, forbidden },
        });
      }
      return pass('LobbyCreateJoinPanel is reduced to join-only.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. BottomNav görünürlük: Online selection ekranında VISIBLE, lobi açılınca HIDDEN. */
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

  /* 10. Davet altyapısı korunuyor — handleCreate hâlâ createGameInvites çağırıyor. */
  makeCase('online_challenge_flow', 'invite_infrastructure_preserved',
    'Lobby creation still triggers createGameInvites for selected friends — invite backend wiring is unchanged',
    () => {
      const required = missingTokens(lobbyRoomSource, [
        'createGameInvites',
        'invitedEmails',
        'await createGameInvites',
      ]);
      if (required.length) {
        return fail('Invite creation pathway was broken.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'pages/LobbyRoom.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'createGameInvites still invoked with invitedEmails',
          actual: { required },
        });
      }
      return pass('Invite creation pathway is preserved.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];