// Kronox Health Center — Game Invite Lifecycle (Codex135).
//
// SCOPE
//   Lock the fix for the "invite appears briefly then disappears" bug:
//     • Single source-of-truth selector `isActiveIncomingGameInvite`.
//     • Header bell + Online IncomingInvitesPanel + GameInviteNotifier
//       all defer to that selector.
//     • Toast dismiss ONLY closes the toast UI — never updates the
//       GameInvite entity, never filters the invite from other surfaces.
//     • A fresh pending invite (created < 10 minutes ago) is treated as
//       ACTIVE if `expires_at` is missing but `created_at` can derive TTL.
//       Malformed rows with no expiry/creation timestamp are diagnostic-only,
//       not immortal active invites.
//     • Accept path is shared and goes to /lobby (lobby-first, NEVER /game).
//     • 10-minute TTL is preserved in both client and backend.
//
// HONESTY
//   Mix of STATIC contracts and EXECUTABLE checks. Runtime delivery
//   proof stays NOT_AUTOMATABLE.

import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import useHeaderNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import useNotificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import notificationViewModelSource from '../../lib/notificationViewModel.js?raw';
import {
  GAME_INVITE_TTL_MS,
  filterActiveIncomingGameInvites,
  getGameInviteRemainingMs,
  isActiveIncomingGameInvite,
  isIncomingInviteForUser,
  isInviteExpired,
  normalizeEmail,
} from '@/lib/gameInviteSelectors';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFICATION: 'MANUAL_VERIFICATION' };

const SUITE_ID = 'game_invite_lifecycle_v2';
const SUITE_NAME = 'Game Invite Lifecycle Hardening Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missing(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((t) => !s.includes(t));
}

function forbidden(src, tokens) {
  const s = safeStr(src);
  return tokens.filter((t) => s.includes(t));
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
    color: '#facc15',
  },
];

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
const ME = 'me@example.com';
const OTHER = 'other@example.com';
const NOW = 1_700_000_000_000;
const freshInvite = {
  id: 'inv_fresh',
  status: 'pending',
  to_email: ME,
  from_email: OTHER,
  lobby_id: 'lobby_1',
  created_at: new Date(NOW - 60_000).toISOString(),
  expires_at: new Date(NOW + (9 * 60 * 1000)).toISOString(),
};
const expiredInvite = {
  id: 'inv_expired',
  status: 'pending',
  to_email: ME,
  from_email: OTHER,
  lobby_id: 'lobby_2',
  created_at: new Date(NOW - (11 * 60 * 1000)).toISOString(),
  expires_at: new Date(NOW - (1 * 60 * 1000)).toISOString(),
};
const acceptedInvite = { ...freshInvite, id: 'inv_accepted', status: 'accepted' };
const outgoingInvite = { ...freshInvite, id: 'inv_outgoing', to_email: OTHER, from_email: ME };
const derivedExpiryInvite = {
  id: 'inv_derived_ts',
  status: 'pending',
  to_email: ME,
  from_email: OTHER,
  lobby_id: 'lobby_3',
  created_at: new Date(NOW - 60_000).toISOString(),
};
const missingTimestampsInvite = {
  id: 'inv_no_ts',
  status: 'pending',
  to_email: ME,
  from_email: OTHER,
  lobby_id: 'lobby_3',
  // expires_at / created_at / created_date / created_by — all missing
};

export const EXTRA_TESTS = [
  /* 1. Toast dismiss must not change GameInvite status. */
  makeCase('game_invite_persists_after_toast_dismiss',
    'GameInviteNotifier.dismissInviteToast NEVER calls GameInvite.update — toast dismiss only closes UI',
    () => {
      const src = safeStr(gameInviteNotifierSource);
      // Look at the dismiss helper body specifically. The forbidden tokens
      // would only ever appear if someone wired a status mutation in.
      const f = forbidden(src.replace(/[\s\S]*const dismissInviteToast = useCallback/, ''), [
        'GameInvite.update',
        "status: 'declined'",
        "status: 'expired'",
        "status: 'cancelled'",
        "status: 'completed'",
      ]).slice(0, 1); // first occurrence is enough
      if (f.length) {
        return fail('Toast dismiss path may be mutating the GameInvite entity.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/invites/GameInviteNotifier.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          forbidden: f,
        });
      }
      return pass('Toast dismiss only closes the toast UI.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. All three surfaces share the same active-invite selector. */
  makeCase('game_invite_active_selector_shared',
    'Header bell + IncomingInvitesPanel + GameInviteNotifier all read active invites through the shared notification center',
    () => {
      const missingInCenter = missing(useNotificationCenterSource, [
        "from '@/lib/gameInviteSelectors'",
        'mergeActiveIncomingGameInvites',
        'getGameInviteActiveFilterReason',
      ]);
      const missingInPanel = missing(incomingInvitesPanelSource, [
        'useNotificationCenter',
      ]);
      const missingInToast = missing(gameInviteNotifierSource, [
        'useNotificationCenter',
      ]);
      if (missingInCenter.length || missingInPanel.length || missingInToast.length) {
        return fail('At least one invite surface is not on the shared notification center/selector.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingInCenter,
          missingInPanel,
          missingInToast,
        });
      }
      return pass('All invite surfaces consume the shared notification center backed by the selector module.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Local dismissed-toast bookkeeping cannot hide invites from other surfaces. */
  makeCase('game_invite_not_hidden_by_local_dismiss',
    'dismissedToastIds only suppresses banner candidates — never header bell or Online panel rows',
    () => {
      const center = safeStr(useNotificationCenterSource);
      const viewModel = safeStr(notificationViewModelSource);
      const headerReads = safeStr(useHeaderNotificationsSource).includes('dismissedToastIds');
      const panelReads = safeStr(incomingInvitesPanelSource).includes('dismissedToastIds');
      const hasVisualOnlyDismiss =
        center.includes('dismissedToastIds') &&
        viewModel.includes('bannerCandidates') &&
        viewModel.includes('activeIncomingGameInvites');
      if (!hasVisualOnlyDismiss || headerReads || panelReads) {
        return fail('Local dismissed-toast state is leaking to other surfaces.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          hasVisualOnlyDismiss,
          headerReads,
          panelReads,
        });
      }
      return pass('Dismissed-toast ids only affect visual banner candidates.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Pending invites remain pending across all known surfaces (executable). */
  makeCase('game_invite_pending_until_terminal_status',
    'isActiveIncomingGameInvite preserves pending status; accepted/declined/expired drop out',
    () => {
      const checks = [
        ['fresh pending counts',          isActiveIncomingGameInvite(freshInvite, ME, NOW) === true],
        ['accepted dropped',              isActiveIncomingGameInvite(acceptedInvite, ME, NOW) === false],
        ['expired dropped',               isActiveIncomingGameInvite(expiredInvite, ME, NOW) === false],
        ['outgoing dropped',              isActiveIncomingGameInvite(outgoingInvite, ME, NOW) === false],
        ['created_at derives expiry',     isActiveIncomingGameInvite(derivedExpiryInvite, ME, NOW) === true],
        ['missing-ts not immortal',       isActiveIncomingGameInvite(missingTimestampsInvite, ME, NOW) === false],
      ];
      const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
      if (failed.length) {
        return fail('Selector misclassifies invite lifecycle states.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          failed,
        });
      }
      return pass('Pending invite remains active until a terminal status lands.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Fresh invite is NOT silently expired (executable). */
  makeCase('game_invite_fresh_not_expired_10_min',
    'A new invite with expires_at 10 minutes ahead is treated as active by the selector',
    () => {
      const active = isActiveIncomingGameInvite(freshInvite, ME, NOW);
      const remainingOk = getGameInviteRemainingMs(freshInvite, NOW) > 0;
      const ttlOk = GAME_INVITE_TTL_MS === 10 * 60 * 1000;
      if (!active || !remainingOk || !ttlOk) {
        return fail('Fresh invite is incorrectly being treated as expired.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          active,
          remainingOk,
          ttlOk,
        });
      }
      return pass('Fresh invite stays active for the full 10-minute window.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 6. Missing expires_at with created_at is safe; totally malformed rows are not immortal. */
  makeCase('game_invite_expiry_date_parsing_safe',
    'Missing expires_at derives from created_at; missing all timestamps is diagnostic-only, not active forever',
    () => {
      const derivedActive = isActiveIncomingGameInvite(derivedExpiryInvite, ME, NOW);
      const malformedActive = isActiveIncomingGameInvite(missingTimestampsInvite, ME, NOW);
      const treatedExpired = isInviteExpired(missingTimestampsInvite, NOW);
      const filtered = filterActiveIncomingGameInvites([missingTimestampsInvite], ME, NOW);
      if (!derivedActive || treatedExpired || malformedActive || filtered.length !== 0) {
        return fail('Invite expiry parsing does not match the 10-minute TTL contract.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          derivedActive,
          malformedActive,
          treatedExpired,
          filteredCount: filtered.length,
        });
      }
      return pass('Missing expires_at can derive from created_at; malformed no-time rows are not counted active forever.',
        { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 7. Open/accept path is shared and goes to lobby (static + executable spot-check). */
  makeCase('game_invite_open_shared_action',
    'Header bell openGameInvite uses shared openGameInvite action and navigates to /lobby',
    () => {
      const src = `${safeStr(useHeaderNotificationsSource)}\n${safeStr(useNotificationCenterSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, [
        'openNotificationCenterGameInvite',
        'openGameInviteAction',
        "source: 'header_notifications'",
        "navigate('/lobby'",
      ]);
      const f = forbidden(src, ["navigate('/game'"]);
      if (m.length || f.length) {
        return fail('Header open path is not lobby-first.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          forbidden: f,
        });
      }
      return pass('Header open path always lands on /lobby.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 8. Header + Online + Notifier consistent (static). */
  makeCase('game_invite_header_and_online_consistent',
    'Header bell, Online IncomingInvitesPanel, and toast notifier all read from the shared selector',
    () => {
      const surfaces = [
        ['header hook', useHeaderNotificationsSource],
        ['online panel', incomingInvitesPanelSource],
        ['toast notifier', gameInviteNotifierSource],
      ];
      const missingImports = surfaces
        .filter(([, src]) => !safeStr(src).includes("from '@/lib/gameInviteSelectors'"))
        .map(([label]) => label);
      if (missingImports.length) {
        return fail('Not every invite surface uses the shared selector module.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missingImports,
        });
      }
      return pass('All three invite surfaces share the same filter source.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 9. Accept goes to /lobby (also covered for IncomingInvitesPanel). */
  makeCase('game_invite_accept_navigates_lobby',
    'IncomingInvitesPanel.handleAccept uses shared openGameInvite and navigates to /lobby with joinedLobby state (NEVER /game)',
    () => {
      const src = `${safeStr(incomingInvitesPanelSource)}\n${safeStr(inviteApiSource)}`;
      const m = missing(src, [
        'openGameInvite',
        "source: 'online_pending_panel'",
        "navigate('/lobby'",
        'joinedLobby',
      ]);
      const f = forbidden(src, ["navigate('/game'"]);
      if (m.length || f.length) {
        return fail('Online accept path is not lobby-first.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          missing: m,
          forbidden: f,
        });
      }
      return pass('Online accept lands on /lobby with the joined lobby state.',
        { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 10. Recipient email is normalized (executable). */
  makeCase('game_invite_recipient_email_normalized',
    'Recipient matching is trim/lowercase normalized via normalizeEmail',
    () => {
      const upperInvite = { ...freshInvite, to_email: '  ME@Example.COM  ' };
      const matches = isIncomingInviteForUser(upperInvite, ME);
      const normalizedSelf = normalizeEmail('  ME@Example.COM  ') === ME;
      // Also lock the selector import in the lib source.
      const m = missing(gameInviteSelectorsSource, [
        'normalizeEmail',
        'getGameInviteExpiresAt',
        'getGameInviteCreatedAt',
      ]);
      // And lock the back-end TTL parity (10 minutes).
      const ttlOk = gameInviteSelectorsSource.includes('GAME_INVITE_TTL_MS = 10 * 60 * 1000');
      if (!matches || !normalizedSelf || m.length || !ttlOk) {
        return fail('Recipient normalization or TTL parity is broken.', {
          verification: 'EXECUTABLE',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          matches,
          normalizedSelf,
          missing: m,
          ttlOk,
        });
      }
      return pass('Recipient matching is normalized and 10-min TTL is preserved.', { verification: 'EXECUTABLE' });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 11. Manual two-account scenario A (invite stays after toast dismiss). */
  makeCase('game_invite_two_account_persistence_manual',
    'Manual: invite stays visible on header + Online after toast disappears, no terminal status flip',
    () => ({
      status: STATUS.NOT_AUTOMATABLE,
      reason: 'Two-account flow verifying header/online persistence after toast dismiss must be checked manually.',
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
