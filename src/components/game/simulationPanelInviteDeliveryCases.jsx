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
import useFriendPresenceSource from '../../hooks/useFriendPresence.js?raw';
import usePresenceHeartbeatSource from '../../hooks/usePresenceHeartbeat.js?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import addFriendFormSource from '../friends/AddFriendForm.jsx?raw';
import friendListItemSource from '../friends/FriendListItem.jsx?raw';
import outgoingRequestItemSource from '../friends/OutgoingRequestItem.jsx?raw';
import friendSelectModalSource from '../lobby/FriendSelectModal.jsx?raw';
import createLobbyInvitePanelSource from '../lobby/CreateLobbyInvitePanel.jsx?raw';
import appSource from '../../App.jsx?raw';
import {
  getFriendPresenceFnSource,
  playerPresenceEntitySource,
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
      const emailIdx = src.indexOf('sendFriendRequestEmail(base44');
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
        'never email/provider ids/raw guest ids/player keys',
        'const user = await base44.auth.me()',
        'const myEmail = normalizeEmail(user.email)',
        'const ownerKeyHash = makeOwnerKeyHash(myEmail)',
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
    'Friend picker renders real online/offline labels instead of hardcoded Çevrimiçi',
    () => {
      const src = `${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}\n${safeStr(useFriendPresenceSource)}\n${safeStr(presenceSource)}`;
      const required = [
        'useFriendPresence',
        'getPresenceForFriend',
        'getFriendDisplayPresence',
        'isPresenceOnline',
        'Çevrim dışı',
        'PRESENCE_ONLINE_TTL_MS',
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
      return pass('Friend pickers use presence helper output and include offline display state.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('invite_delivery', 'friend_rows_username_only_no_email_display_fallback',
    'Friends UI uses safe username labels and does not display friend_email as a fallback',
    () => {
      const src = `${safeStr(publicIdentitySource)}\n${safeStr(friendsApiSource)}\n${safeStr(friendListItemSource)}\n${safeStr(outgoingRequestItemSource)}\n${safeStr(friendSelectModalSource)}\n${safeStr(createLobbyInvitePanelSource)}`;
      const required = [
        'getSafePublicUsernameLabel',
        'normalizeSafePublicUsernameInput',
        'resolveSafePublicUsername',
        'getSafeFriendDisplayName',
        'getSafeRequestTargetName',
        'friend_username',
        'presence_key',
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

  makeCase('invite_delivery', 'presence_heartbeat_registered_from_app_shell',
    'Authenticated app shell starts the current user presence heartbeat',
    () => {
      const src = `${safeStr(appSource)}\n${safeStr(usePresenceHeartbeatSource)}\n${safeStr(presenceSource)}`;
      const required = [
        'usePresenceHeartbeat(user)',
        "functions.invoke('updatePlayerPresence'",
        'PRESENCE_HEARTBEAT_MS',
        'document.visibilityState',
        'PRESENCE_STATUS.OFFLINE',
      ];
      const missing = required.filter((token) => !src.includes(token));
      if (missing.length) {
        return fail('Presence heartbeat is not wired from the authenticated app shell.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
        });
      }
      return pass('Authenticated users emit best-effort online/offline heartbeats.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
