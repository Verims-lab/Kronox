// Kronox Health Center — GameInvite lifecycle persistence contracts.
//
// These cases lock the regression where a foreground invite toast briefly
// appeared and then the invite stopped being discoverable. Static contracts
// prove selector/state wiring; real two-account delivery still needs manual
// runtime proof.

import gameInviteSelectorsSource from '../../lib/gameInviteSelectors.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import gameInviteNotifierSource from '../invites/GameInviteNotifier.jsx?raw';
import incomingInvitesPanelSource from '../invites/IncomingInvitesPanel.jsx?raw';
import headerGameInviteBellSource from '../invites/HeaderGameInviteBell.jsx?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import gameInviteEntitySource from '../../../base44/entities/GameInvite.jsonc?raw';
import {
  GAME_INVITE_TTL_MS,
  getInviteRemainingMs,
} from '../../lib/gameInviteSelectors';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  TWO_ACCOUNT_TEST: 'TWO_ACCOUNT_TEST',
};

const SUITE_NAMES = {
  game_invite_lifecycle_persistence: 'Game Invite Lifecycle Persistence Suite',
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
function notAutomatable(reason, extra) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) }; }

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function forbiddenTokensFound(source, tokens) {
  return tokens.filter((token) => String(source || '').includes(token));
}

export const EXTRA_SUITES = [
  {
    id: 'game_invite_lifecycle_persistence',
    name: SUITE_NAMES.game_invite_lifecycle_persistence,
    critical: true,
    color: '#67e8f9',
  },
];

export const EXTRA_TESTS = [
  makeCase('game_invite_lifecycle_persistence', 'game_invite_toast_dismiss_does_not_change_status',
    'Toast dismiss cannot mutate GameInvite terminal status',
    () => {
      const forbidden = forbiddenTokensFound(gameInviteNotifierSource, [
        'GameInvite.update',
        "status: 'expired'",
        "status: 'declined'",
        "status: 'accepted'",
        "status: 'completed'",
        "status: 'cancelled'",
      ]);
      const required = missingTokens(gameInviteNotifierSource, ['dismissInviteToast', 'toast_timeout', 'remember: false']);
      if (forbidden.length || required.length) {
        return fail('Toast dismiss path can still look like a data/status mutation or lacks visual-only timeout handling.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { forbidden, required },
        });
      }
      return pass('Toast dismiss is local/visual-only; timeout does not update GameInvite status.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_auto_dismiss_not_global_hide',
    'Toast auto-dismiss does not hide header or Online pending invite surfaces',
    () => {
      const required = missingTokens(`${gameInviteNotifierSource}\n${headerGameInviteBellSource}\n${lobbyCreateJoinPanelSource}`, [
        'toast_timeout',
        'remember: false',
        'HeaderGameInviteBell',
        'IncomingInvitesPanel user={user}',
      ]);
      return required.length
        ? fail('Auto-dismiss can still be the only global discoverability path for pending invites.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('Auto-dismiss is visual-only; header and Online surfaces remain backed by pending invite data.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_subscription_fetch_merge_safe',
    'Subscription-created visible invite is not immediately overwritten by an empty stale fetch',
    () => {
      const required = missingTokens(`${incomingInvitesPanelSource}\n${headerGameInviteBellSource}\n${gameInviteSelectorsSource}`, [
        'mergeActiveIncomingGameInvites',
        'preserveExisting: true',
        'subscription_followup',
        'filterActiveIncomingGameInvites(existing',
      ]);
      return required.length
        ? fail('Subscription/fetch merge safety is incomplete.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('Subscription events merge active invites first, then follow-up fetch preserves still-active rows.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_active_selector_used_everywhere',
    'Header, Online pending list, notifier, and loader use the shared active selector',
    () => {
      const required = missingTokens(`${inviteApiSource}\n${incomingInvitesPanelSource}\n${headerGameInviteBellSource}\n${gameInviteNotifierSource}`, [
        'getGameInviteActiveFilterReason',
        'filterActiveIncomingGameInvites',
        'mergeActiveIncomingGameInvites',
      ]);
      return required.length
        ? fail('One or more invite surfaces can still drift from the shared active selector.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('All active invite surfaces depend on the shared selector/merge helpers.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_filter_reason_diagnostics',
    'Active filter can report/drop reason in admin/dev diagnostics',
    () => {
      const required = missingTokens(`${gameInviteSelectorsSource}\n${inviteApiSource}\n${gameInviteNotifierSource}\n${incomingInvitesPanelSource}`, [
        'traceGameInviteLifecycle',
        'summarizeGameInviteForDiagnostics',
        'getGameInviteActiveFilterReason',
        'invite_failed_active_filter',
        'invite_passed_active_filter',
      ]);
      return required.length
        ? fail('Invite filter diagnostics are missing required reason/event tokens.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('Invite lifecycle diagnostics include pass/fail filter reasons behind dev/admin flags.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_remaining_ms_positive_for_fresh_invite',
    'Fresh 10-minute invite has positive remainingMs',
    () => {
      const now = Date.UTC(2026, 0, 1, 12, 0, 0);
      const invite = {
        id: 'health-fresh-invite',
        status: 'pending',
        to_email: 'b@example.com',
        from_email: 'a@example.com',
        lobby_id: 'lobby-1',
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + GAME_INVITE_TTL_MS).toISOString(),
      };
      const remaining = getInviteRemainingMs(invite, now);
      return remaining === 10 * 60 * 1000
        ? pass('Fresh invite remainingMs is exactly 10 minutes.', {
            verification: 'RUNTIME_VERIFIED',
            classification: 'CODE_FIX',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { remaining },
          })
        : fail('Fresh invite remainingMs is not positive/10-minute aligned.', {
            verification: 'RUNTIME_VERIFIED',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            expected: 10 * 60 * 1000,
            actual: { remaining },
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_field_name_consistency',
    'Creation and readers use consistent recipient/lobby/status fields',
    () => {
      const required = missingTokens(`${gameInviteEntitySource}\n${inviteApiSource}\n${gameInviteSelectorsSource}`, [
        '"to_email"',
        '"from_email"',
        '"lobby_id"',
        "to_email: toEmail",
        "status: 'pending'",
        'getInviteRecipientEmail',
        'getInviteSenderEmail',
        'getInviteLobbyId',
      ]);
      return required.length
        ? fail('GameInvite field contract drift detected.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('GameInvite creation and readers agree on recipient/sender/lobby/status fields.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_open_shared_action',
    'Toast/header/Online use a shared open/accept/navigate action',
    () => {
      const required = missingTokens(`${inviteApiSource}\n${gameInviteNotifierSource}\n${incomingInvitesPanelSource}\n${headerGameInviteBellSource}`, [
        'export async function openGameInvite',
        'acceptGameInvite(invite.id)',
        "navigate('/lobby'",
        "source: 'toast'",
        "source: 'online_pending_panel'",
        "source: 'header_notifications'",
      ]);
      return required.length
        ? fail('Invite open/accept path is still duplicated or not wired everywhere.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('Toast, header, and Online pending invite actions share openGameInvite.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_pending_survives_toast_timeout',
    'Pending invite remains active after toast timeout',
    () => {
      const forbidden = forbiddenTokensFound(gameInviteNotifierSource, [
        "status: 'expired'",
        'GameInvite.update',
      ]);
      const required = missingTokens(gameInviteNotifierSource, ['toast_timeout', 'remember: false']);
      return forbidden.length || required.length
        ? fail('Toast timeout can still globally hide or mutate a pending invite.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { forbidden, required },
          })
        : pass('Toast timeout is visual-only and does not mark the invite dismissed for other surfaces.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_not_removed_until_terminal_status',
    'Only terminal status or true expiry removes invite from actionable lists',
    () => {
      const required = missingTokens(`${gameInviteSelectorsSource}\n${incomingInvitesPanelSource}\n${headerGameInviteBellSource}`, [
        'TERMINAL_GAME_INVITE_STATUSES',
        'terminal_',
        'expired',
        'reason.startsWith(\'active\')',
        'prev.filter(item => item.id !== invite.id)',
      ]);
      return required.length
        ? fail('Actionable invite removal is not clearly tied to terminal/expired state.', {
            verification: 'STATIC_CONTRACT',
            classification: 'REAL_PRODUCT_RISK',
            actionType: ACTION_TYPES.CODE_FIX,
            actual: { required },
          })
        : pass('Actionable lists remove invites only on terminal/expired subscription/follow-up paths.', {
            verification: 'STATIC_CONTRACT',
            classification: 'STATIC_CHECK_LIMITATION',
            actionType: ACTION_TYPES.CODE_FIX,
          });
    }),

  makeCase('game_invite_lifecycle_persistence', 'game_invite_two_account_runtime_proof_needed',
    'Two-account invite persistence still needs real runtime proof',
    () => notAutomatable('Static contracts cannot prove Base44 subscription timing, RLS reads, or real recipient-device behavior. Run the two-account scenarios from the task before release.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'REAL_PRODUCT_RISK',
      actionType: ACTION_TYPES.TWO_ACCOUNT_TEST,
    })),
];
