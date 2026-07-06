// Kronox Health Center — Friend invite delivery contracts (Codex129).
//
// SCOPE
//   The Codex129 fix addressed three issues:
//     1. Sender saw "Arkadaşlık isteği gönderildi" even when the
//        Base44 SendEmail integration rejected the message because the
//        recipient was not registered ("Cannot send emails to users
//        outside the app"). We now surface honest copy.
//     2. Email normalization had to be confirmed unconditional (it was —
//        kept as an executable assertion).
//     3. Even when push/email delivery fails, the FriendRequest entity
//        row must be created so the recipient can still find the invite
//        in-app after signing up.
//
//   These cases lock the new contracts. No existing case is touched.

import { normalizeEmail, isValidEmail } from '@/lib/friendsApi';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import publicIdentitySource from '../../lib/publicIdentity.js?raw';
import presenceSource from '../../lib/presence.js?raw';
import onlinePlayerSelectionSource from '../../lib/onlinePlayerSelection.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import useFriendPresenceSource from '../../hooks/useFriendPresence.js?raw';
import usePresenceHeartbeatSource from '../../hooks/usePresenceHeartbeat.js?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendListItemSource from '../friends/FriendListItem.jsx?raw';
import outgoingRequestItemSource from '../friends/OutgoingRequestItem.jsx?raw';
import friendSelectModalSource from '../lobby/FriendSelectModal.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import appSource from '../../App.jsx?raw';
import {
  getFriendPresenceFnSource,
  getOnlinePlayerSelectionFnSource,
  friendRequestOperationLockEntitySource,
  playerPresenceEntitySource,
  createGameInvitesForTargetsFnSource,
  sendFriendRequestFnSource,
  sendFriendRequestEmailFnSourceFull,
  updatePlayerPresenceFnSource,
} from './simulationPanelContractStrings.jsx';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };
const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';

const SUITE_NAMES = {
  invite_delivery: 'Friend Invite Delivery & Email Honesty Suite',
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
    id: 'invite_delivery',
    name: SUITE_NAMES.invite_delivery,
    critical: true,
    color: '#34d399',
  },
];

export const EXTRA_TESTS = [
  /* 1. Email normalization is unconditional — trim + lowercase */
  makeCase('invite_delivery', 'invite_email_normalization_contract',
    'normalizeEmail trims whitespace and lowercases both sides',
    () => {
      const samples = [
        ['  Example.User@Example.COM ', 'example.user@example.com'],
        ['INVITE.TEST@EXAMPLE.COM',     'invite.test@example.com'],
        ['invite.test@example.com',     'invite.test@example.com'],
        ['',                            ''],
        [null,                          ''],
        [undefined,                     ''],
      ];
      const errors = samples
        .map(([input, expected]) => ({ input, expected, got: normalizeEmail(input) }))
        .filter((c) => c.got !== c.expected);
      if (errors.length) {
        return fail('normalizeEmail drift.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('normalizeEmail consistently produces lowercase, trimmed values.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Recipient lookup is case-insensitive (uses normalizeEmail) */
  makeCase('invite_delivery', 'invite_recipient_lookup_by_normalized_email',
    'friendsApi.sendFriendRequest normalizes email before backend request',
    () => {
      const src = safeStr(friendsApiSource);
      const required = [
        'parseFriendRequestTarget',
        'normalizeEmail(value)',
        "functions.invoke('sendFriendRequest'",
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Recipient normalization/backend handoff is missing.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Recipient input is normalized client-side before backend resolution.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. isValidEmail accepts mixed case + rejects empty */
  makeCase('invite_delivery', 'invite_email_validation_case_insensitive',
    'isValidEmail accepts mixed-case inputs and rejects empty/garbage values',
    () => {
      const ok = ['Example.User@Example.COM', 'INVITE.TEST@EXAMPLE.COM', 'a@b.co'];
      const bad = ['', '  ', 'not-an-email', 'a@b', '@b.co'];
      const errors = [
        ...ok.filter((v) => !isValidEmail(v)).map((v) => ({ value: v, expected: true, got: false })),
        ...bad.filter((v) => isValidEmail(v)).map((v) => ({ value: v, expected: false, got: true })),
      ];
      if (errors.length) {
        return fail('isValidEmail boundary issue.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          errors,
        });
      }
      return pass('isValidEmail is case-insensitive and rejects empty/garbage values.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. FriendRequest row is created BEFORE email is attempted */
  makeCase('invite_delivery', 'invite_entity_created_even_if_push_email_fails',
    'Backend FriendRequest.create runs before SendEmail so delivery failure cannot lose the invite',
    () => {
      const src = safeStr(sendFriendRequestFnSource);
      const createIdx = src.indexOf('FriendRequest.create');
      const emailIdx = src.indexOf('const emailResult = await sendFriendRequestEmail(base44');
      if (createIdx < 0 || emailIdx < 0) {
        return fail('Could not locate create / email send positions in sendFriendRequest backend.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          createIdx, emailIdx,
        });
      }
      if (createIdx > emailIdx) {
        return fail('Email invoke happens before FriendRequest.create — delivery failure could lose the invite.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          createIdx, emailIdx,
        });
      }
      return pass('FriendRequest is persisted before email delivery is attempted.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_add_username_backend_resolution_no_email_return',
    'Add Friend supports username lookup server-side without returning target email',
    () => {
      const backend = safeStr(sendFriendRequestFnSource);
      const client = `${safeStr(friendsApiSource)}\n${safeStr(addFriendFormSource)}\n${safeStr(friendsPageSource)}`;
      const requiredBackend = [
        'findTargetByUsername',
        'username_normalized',
        USERNAME_NOT_FOUND_MESSAGE,
        'targetLabel: target.username',
        'targetEmailReturned: false',
        'publicIdentity: \'username\'',
      ];
      const requiredClient = [
        'E-posta veya kullanıcı adı ile arkadaş ekle',
        'E-posta veya kullanıcı adı',
        'parseFriendRequestTarget',
        "functions.invoke('sendFriendRequest'",
      ];
      const forbiddenClient = [
        "User.filter({ username",
        "User.list(",
        'targetEmail',
      ];
      const missingBackend = requiredBackend.filter((token) => !backend.includes(token));
      const missingClient = requiredClient.filter((token) => !client.includes(token));
      const foundForbiddenClient = forbiddenClient.filter((token) => client.includes(token));
      if (missingBackend.length || missingClient.length || foundForbiddenClient.length) {
        return fail('Username friend-add path is missing backend privacy guardrails.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingBackend,
          missingClient,
          foundForbiddenClient,
        });
      }
      return pass('Username friend-add resolves server-side and returns only safe public labels.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_invite_duplicate_and_expired_contract',
    'Friend invite duplicate and expired-resend contracts are backend-owned and shared by Add Friend / Leaderboard',
    () => {
      const backend = safeStr(sendFriendRequestFnSource);
      const client = `${safeStr(friendsApiSource)}\n${safeStr(friendsPageSource)}\n${safeStr(addFriendFormSource)}`;
      const leaderboard = safeStr(leaderboardPageSource);
      const requiredBackend = [
        'OPEN_INVITE_EXISTS',
        'EXPIRED_INVITE_REQUIRES_DELETE',
        'Bu kişiye gönderilmiş açık davet var.',
        'Bu kişiye süresi dolmuş bir davetin var. Yeniden davet göndermeden önce eski daveti silmelisin.',
        'findOutgoingInviteConflict',
        'findOpenReversePendingRequest',
        'markExpiredFriendRequestRows',
        'isFriendRequestExpired',
        'FRIEND_REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000',
        "status: 'expired'",
        'expired_at: new Date(nowMs).toISOString()',
        'expires_at: expiresAt.toISOString()',
        'targetEmailReturned: false',
      ];
      const requiredClient = [
        'OPEN_INVITE_EXISTS_MESSAGE',
        'EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE',
        'makeFriendRequestError',
        'isFriendRequestExpired',
      ];
      const requiredLeaderboard = [
        'sendFriendRequest({ me: user, target: username })',
        'OPEN_INVITE_EXISTS',
        'EXPIRED_INVITE_REQUIRES_DELETE',
      ];
      const missingBackend = requiredBackend.filter((token) => !backend.includes(token));
      const missingClient = requiredClient.filter((token) => !client.includes(token));
      const missingLeaderboard = requiredLeaderboard.filter((token) => !leaderboard.includes(token));
      if (missingBackend.length || missingClient.length || missingLeaderboard.length) {
        return fail('Friend invite duplicate/expired lifecycle contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingBackend,
          missingClient,
          missingLeaderboard,
        });
      }
      return pass('Friend invite duplicate/open and expired-before-resend rules are backend-owned, privacy-safe, and shared by Add Friend plus Leaderboard.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'leaderboard_friend_invite_double_submit_guard',
    'Leaderboard friend-add blocks double-submit while the first request is in flight',
    () => {
      const src = safeStr(leaderboardPageSource);
      const required = [
        'friendInvitePendingTargetsRef',
        '.has(usernameKey)',
        '.add(usernameKey)',
        '.delete(usernameKey)',
        'İstek gönderiliyor.',
      ];
      const missing = required.filter((token) => !src.includes(token));
      if (missing.length) {
        return fail('Leaderboard friend-add can still issue duplicate in-flight invite calls.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Leaderboard friend-add suppresses duplicate in-flight submissions before the backend duplicate guard is needed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'add_friend_form_double_submit_guard',
    'Add Friend form blocks rapid double-submit before the backend duplicate guard is needed',
    () => {
      const src = safeStr(addFriendFormSource);
      const required = [
        'useRef',
        'submittingRef',
        'if (submittingRef.current) return',
        'submittingRef.current = true',
        'submittingRef.current = false',
        'disabled={busy}',
      ];
      const missing = required.filter((token) => !src.includes(token));
      if (missing.length) {
        return fail('Add Friend form can still issue duplicate same-tick invite calls.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Add Friend form suppresses rapid duplicate submissions locally before backend locking is needed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_request_function_level_lock_guard',
    'sendFriendRequest uses a backend-owned TTL lock for duplicate-send race hardening',
    () => {
      const backend = safeStr(sendFriendRequestFnSource);
      const entity = safeStr(friendRequestOperationLockEntitySource);
      const requiredBackend = [
        'FRIEND_REQUEST_LOCK_TTL_MS = 8_000',
        'FRIEND_REQUEST_LOCK_SETTLE_MS = 80',
        'friendRequestOperationLockEntity',
        'buildFriendRequestLockKey',
        'selectCanonicalFriendRequestLock',
        'markExpiredFriendRequestOperationLocks',
        'withFriendRequestOperationLock',
        'FRIEND_REQUEST_IN_PROGRESS',
        'friend_request_send',
        'targetEmailReturned: false',
      ];
      const requiredEntity = [
        '"name": "FriendRequestOperationLock"',
        'Base44/platform uniqueness is not assumed',
        'actor_key_hash',
        'target_key_hash',
        '"friend_request_send"',
        '"active","released","stale"',
        'role": "admin"',
        'raw email',
      ];
      const missingBackend = requiredBackend.filter((token) => !backend.includes(token));
      const missingEntity = requiredEntity.filter((token) => !entity.includes(token));
      if (missingBackend.length || missingEntity.length) {
        return fail('Friend request send still lacks a documented function-level race guard.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingBackend,
          missingEntity,
        });
      }
      return pass('sendFriendRequest has a backend-owned TTL lock and privacy-safe lock entity contract.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Soft failure shape: emailSent boolean + recipientRegistered hint */
  makeCase('invite_delivery', 'invite_no_silent_success_on_delivery_failure',
    'sendFriendRequest returns {emailSent, recipientRegistered} so UI can show honest copy',
    () => {
      const src = `${safeStr(sendFriendRequestFnSource)}\n${safeStr(friendsApiSource)}`;
      const required = [
        'emailSent: true',
        'emailSent: false',
        'recipientRegistered',
        'marker=email_failed',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Soft-failure result shape is missing keys.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Soft-failure result shape includes emailSent + recipientRegistered.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. UI prints honest copy in all 3 outcomes */
  makeCase('invite_delivery', 'invite_ui_shows_honest_outcome_copy',
    'FriendsPage.handleSend prints distinct copy for sent / created-without-email / unregistered',
    () => {
      const src = safeStr(friendsPageSource);
      const required = [
        'e-posta iletildi',          // emailSent true
        'uygulamada görecek',         // recipientRegistered true, email failed
        "Kronox\\'a kayıtlı değilse", // unregistered
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Honest outcome copy is missing for at least one path.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('UI distinguishes between sent, created-without-email, and unregistered.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. AddFriendForm no longer prints its own faux success */
  makeCase('invite_delivery', 'invite_form_does_not_print_premature_success',
    'AddFriendForm does not render its own "Arkadaşlık isteği gönderildi" success row',
    () => {
      const src = safeStr(addFriendFormSource);
      const forbidden = ['Arkadaşlık isteği gönderildi.'];
      const found = forbidden.filter((t) => src.includes(t));
      if (found.length) {
        return fail('AddFriendForm still prints a premature success message — UI lies when email fails.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          found,
        });
      }
      return pass('AddFriendForm defers success copy to the parent.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Backend honestly reports email_failed */
  makeCase('invite_delivery', 'invite_backend_reports_email_failed_marker',
    'sendFriendRequestEmail backend returns {ok:false, error:"email_failed"} on SendEmail throw',
    () => {
      // Codex132 — Mirror the backend function via the contract-strings
      // module instead of a dynamic ?raw import of a path outside /src.
      // Outside-/src ?raw imports occasionally fail Vite chunking and
      // turn the case into an ERROR ("Cannot convert object to primitive").
      const src = safeStr(sendFriendRequestEmailFnSourceFull);
      const required = [
        "error: 'email_failed'",
        '[sendFriendRequestEmail] SendEmail failed',
      ];
      const missing = required.filter((t) => !src.includes(t));
      if (missing.length) {
        return fail('Backend does not surface email_failed marker.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Backend honestly reports email_failed marker on SendEmail throw.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Manual: real email delivery requires recipient to be a Kronox user */
  makeCase('invite_delivery', 'invite_email_provider_limitation_documented',
    'Manual: Base44 SendEmail only delivers to registered Kronox users — confirmed by runtime log',
    () => {
      // We can't dynamically probe the real SendEmail integration from the
      // Health Center without sending real mail. The platform limitation is
      // documented in runtime logs ("Cannot send emails to users outside
      // the app"). UI copy and Health case 6 cover the user-facing honesty
      // contract; this case remains a manual checkpoint for SRE proof.
      return {
        status: STATUS.PASS,
        reason: 'Platform email provider limitation is documented; UI honesty contracts cover the user-facing risk.',
        verification: 'NOT_AUTOMATABLE',
        classification: 'MANUAL_VERIFICATION_REQUIRED',
        actionType: ACTION_TYPES.MANUAL_VERIFICATION,
        runtimeProofRequired: true,
      };
    },
    {
      critical: false,
      verification: 'NOT_AUTOMATABLE',
      classification: 'MANUAL_VERIFICATION_REQUIRED',
      runtimeProofRequired: true,
      actionType: ACTION_TYPES.MANUAL_VERIFICATION,
    }),

  makeCase('invite_delivery', 'friend_presence_backend_is_owner_bound_and_friend_scoped',
    'PlayerPresence writes are current-user-bound and reads are accepted-friend scoped',
    () => {
      const composed = `${safeStr(playerPresenceEntitySource)}\n${safeStr(updatePlayerPresenceFnSource)}\n${safeStr(getFriendPresenceFnSource)}`;
      const required = [
        '"name": "PlayerPresence"',
        'owner_key_hash',
        'backend-private user_email used only for invite routing',
        'Guest rows are token-proven',
        'Public responses never return email/provider ids/raw guest ids/player keys',
        'const user = await base44.auth.me().catch(() => null)',
        'const myEmail = normalizeEmail(user.email)',
        'const ownerKeyHash = makeOwnerKeyHash(myEmail)',
        'verifyGuestProfile',
        'hashGuestToken',
        'guest_token_hash',
        'makeGuestOwnerKeyHash',
        'owner_key_hash: actor.ownerKeyHash',
        'user_email: actor.userEmail',
        "FriendRequest.filter({ to_email: myEmail, status: 'accepted' }",
        "FriendRequest.filter({ from_email: myEmail, status: 'accepted' }",
        'requestedSet.has(friend.email)',
        'presence_key',
      ];
      const missing = required.filter((token) => !composed.includes(token));
      if (missing.length) {
        return fail('Presence backend contract is missing owner binding or accepted-friend scoping.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Presence writes are tied to auth.me() and reads are relationship-scoped.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_presence_not_hardcoded_online',
    'Player picker renders real online/offline labels instead of hardcoded Çevrimiçi',
    () => {
      const src = `${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}\n${safeStr(useFriendPresenceSource)}\n${safeStr(presenceSource)}\n${safeStr(onlinePlayerSelectionSource)}\n${safeStr(getOnlinePlayerSelectionFnSource)}`;
      const required = [
        'loadOnlinePlayerSelection',
        'getOnlinePlayerSelectionStatusLabel',
        'getFriendDisplayPresence',
        'isPresenceOnline',
        'Çevrim dışı',
        'PRESENCE_ONLINE_TTL_MS',
        'online_friend',
        'online_non_friend',
        'offline_friend',
      ];
      const forbidden = [
        'const isOnline = true',
        'treat every friend as "Çevrimiçi" by default',
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Friend picker presence can still drift to fake-online behavior.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Player pickers use backend presence output and include offline display state.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_rows_username_only_no_email_display_fallback',
    'Friends UI uses safe username labels and does not display friend_email as a fallback',
    () => {
      const src = `${safeStr(publicIdentitySource)}\n${safeStr(friendsApiSource)}\n${safeStr(friendListItemSource)}\n${safeStr(outgoingRequestItemSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}\n${safeStr(onlinePlayerSelectionSource)}`;
      const required = [
        'getSafePublicUsernameLabel',
        'normalizeSafePublicUsernameInput',
        'resolveSafePublicUsername',
        'getSafeFriendDisplayName',
        'getSafeRequestTargetName',
        'friend_username',
        'presence_key',
        'isSafeOnlineSelectionUsername',
      ];
      const forbidden = [
        'friend.friend_name?.trim() || friend.friend_email',
        'const display = request.to_email',
        '>{friend.friend_email}</p>',
        'invite?.from_name?.trim() || invite?.from_email',
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('A friend-facing surface can still display email/provider/internal identifiers.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Friend-facing UI uses safe username helpers instead of email fallbacks.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'online_player_selection_order_and_scope',
    'Online player selection orders online friends, online non-friends, then offline friends',
    () => {
      const client = `${safeStr(onlinePlayerSelectionSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}`;
      const backend = safeStr(getOnlinePlayerSelectionFnSource);
      const requiredClient = [
        'ONLINE_PLAYER_SELECTION_ORDER',
        'ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_FRIEND',
        'ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_NON_FRIEND',
        'ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND',
        'Çevrimiçi Arkadaşlar',
        'Çevrimiçi Oyuncular',
        'Çevrim Dışı Arkadaşlar',
        'Oyuncu seç...',
      ];
      const requiredBackend = [
        "relation: 'friend'",
        "relation: 'not_friend'",
        'online_friend',
        'online_non_friend',
        'offline_friend',
        'resolveSelectionActor',
        'verifyGuestProfile',
        'hashGuestToken',
        'makeGuestOwnerKeyHash',
        'const inviteEnabled = Boolean(targetEmail)',
        'selectionDisabledReason',
        'code_join_only',
        'rawGuestIdReturned: false',
      ];
      const missingClient = requiredClient.filter((token) => !client.includes(token));
      const missingBackend = requiredBackend.filter((token) => !backend.includes(token));
      if (missingClient.length || missingBackend.length) {
        return fail('Online player selection ordering/scope contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingClient,
          missingBackend,
        });
      }
      return pass('Player selection preserves online friend → online player → offline friend ordering, supports guest-proofed actors, and keeps non-routable rows safe.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'online_non_friend_invites_backend_resolve_opaque_targets',
    'Online non-friend invites use opaque target refs resolved by backend, not client-visible email',
    () => {
      const src = `${safeStr(onlinePlayerSelectionSource)}\n${safeStr(inviteApiSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}\n${safeStr(createGameInvitesForTargetsFnSource)}`;
      const required = [
        'normalizeInviteTargetRef',
        'target_refs',
        "functions.invoke('createGameInvitesForTargets'",
        'TARGET_REF_PATTERN = /^[ug]',
        'targetEmailReturned: false',
        "targetResolution: 'backend_only'",
        'freshPresence.user_email',
        'target_not_routable',
        'recipient_relation: target.relation',
        "created_source: 'online_player_selection'",
      ];
      const forbidden = [
        'User.list(',
        'selectedEmails',
        'friend.friend_email',
        '>{player.email}',
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Online non-friend invite target routing can still leak or rely on client email.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Online non-friend invite creation is backend-resolved from opaque target refs and returns no recipient email.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'online_player_selection_guest_safe_retry_contract',
    'Online player selection supports completed guests and safe retry copy instead of raw 500 text',
    () => {
      const src = `${safeStr(friendSelectModalSource)}\n${safeStr(onlinePlayerSelectionSource)}\n${safeStr(getOnlinePlayerSelectionFnSource)}\n${safeStr(createGameInvitesForTargetsFnSource)}`;
      const required = [
        'getCompletedGuestCredentialsPayload',
        'hasPlayerContext',
        'loadOnlinePlayerSelection({ guestCredentials })',
        'Oyuncu listesi alınamadı. Tekrar dene.',
        'Tekrar Dene',
        'resolveSelectionActor',
        'verifyGuestProfile',
        'guest_token_hash',
        'makeGuestOwnerKeyHash',
        'TARGET_REF_PATTERN = /^[ug]',
        'invite_enabled',
        'selection_disabled_reason',
      ];
      const forbidden = [
        'Request failed with status code ' + '500',
        'if (!user?.email) return undefined',
        'const user = await base44.auth.me();\n  if (!user?.email)',
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Online player selection can still be login-gated or expose raw backend failures.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Online player selection accepts completed guest proof and uses safe retry UI for backend failures.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'presence_heartbeat_registered_from_app_shell',
    'App shell starts one linked-or-guest presence heartbeat with runtime session safety',
    () => {
      const src = `${safeStr(appSource)}\n${safeStr(usePresenceHeartbeatSource)}\n${safeStr(presenceSource)}`;
      const required = [
        'usePresenceHeartbeat(\n    nonCriticalModulesEnabled ? user : null',
        'nonCriticalModulesEnabled ? guestProfile : null',
        "functions.invoke('updatePlayerPresence'",
        'PRESENCE_HEARTBEAT_MS',
        'PRESENCE_REFRESH_MS',
        'getOrCreateRuntimeSessionId',
        'getStoredGuestCredentials',
        'guestCredentials',
        'document.visibilityState',
        "window.addEventListener('focus'",
        "window.addEventListener('online'",
        'PRESENCE_STATUS.OFFLINE',
      ];
      const forbidden = [
        'localStorage.setItem(STORAGE_KEY',
        "localStorage.getItem(STORAGE_KEY",
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Presence heartbeat is not wired from the authenticated app shell.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Linked and token-proven guest actors emit best-effort online/offline heartbeats from one app-shell runtime session.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'presence_freshness_and_refresh_contract',
    'Presence freshness uses 75s backend TTL, 25s heartbeat, and 12s visible UI refresh',
    () => {
      const src = `${safeStr(playerPresenceEntitySource)}\n${safeStr(updatePlayerPresenceFnSource)}\n${safeStr(getFriendPresenceFnSource)}\n${safeStr(getOnlinePlayerSelectionFnSource)}\n${safeStr(presenceSource)}\n${safeStr(useFriendPresenceSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}`;
      const required = [
        'PRESENCE_ONLINE_TTL_MS = 75 * 1000',
        'PRESENCE_HEARTBEAT_MS = 25 * 1000',
        'PRESENCE_REFRESH_MS = 12 * 1000',
        'last_heartbeat_at',
        'presence_expires_at',
        'latest?.last_heartbeat_at || latest?.last_seen_at',
        'latest?.presence_expires_at || latest?.expires_at',
        'PRESENCE_SCAN_LIMIT',
        'Math.max(limit, PRESENCE_SCAN_LIMIT)',
        'window.setInterval(refreshIfVisible, PRESENCE_REFRESH_MS)',
        "window.addEventListener('focus'",
        "window.addEventListener('online'",
      ];
      const forbidden = [
        'PRESENCE_ONLINE_TTL_MS = 2 * 60 * 1000',
        'PRESENCE_HEARTBEAT_MS = 45 * 1000',
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Presence freshness/refresh timing can still leave users stale or invisible.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Presence uses short server TTL plus visible-window refresh/reconnect hooks.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'presence_transient_failure_keeps_previous_rows',
    'Presence UI keeps previous safe rows through transient fetch failure',
    () => {
      const src = `${safeStr(useFriendPresenceSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}`;
      const required = [
        "setError(err?.message || 'Arkadaş durumu yüklenemedi.')",
        "setError(err?.message || 'Oyuncular yüklenemedi.')",
        'loading && players.length === 0',
        'playersError && players.length === 0',
        'error && players.length === 0',
      ];
      const forbidden = [
        'catch (err) {\n      setPresenceByKey({});',
        "setPlayers([]);\n      setError(err?.message || 'Oyuncular yüklenemedi.')",
      ];
      const missing = required.filter((token) => !src.includes(token));
      const foundForbidden = forbidden.filter((token) => src.includes(token));
      if (missing.length || foundForbidden.length) {
        return fail('Transient presence fetch failures can still clear actionable online rows.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          foundForbidden,
        });
      }
      return pass('Presence readers preserve previous safe state while revalidating after transient failures.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
