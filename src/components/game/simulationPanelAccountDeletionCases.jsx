// Kronox Health Center — Account Deletion Contracts.
//
// Static coverage for Profile/Settings deletion flow + backend ownership
// cleanup. Destructive runtime deletion remains manual with a disposable
// test account.

import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import accountDeletionPageSource from '../../pages/AccountDeletionPage.jsx?raw';
import settingsModalSource from './SettingsModal.jsx?raw';
import accountDeletionClientSource from '../../lib/accountDeletion.js?raw';
import deleteAccountSource from '../../../base44/functions/deleteAccount/entry.ts?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
  HUMAN_RELEASE_PROOF: 'HUMAN_RELEASE_PROOF',
};

const SUITE_ID = 'account_deletion_health';
const SUITE_NAME = 'Account Deletion Health Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep account deletion scoped, confirmed, and manually release-probed.',
    ...options,
    run,
  };
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function missingTokens(source, tokens) {
  const src = String(source || '');
  return tokens.filter((token) => !src.includes(token));
}

function presentTokens(source, tokens) {
  const src = String(source || '');
  return tokens.filter((token) => src.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f43f5e' },
];

export const EXTRA_TESTS = [
  makeCase('account_deletion_button_visible_in_settings',
    'Profile Settings exposes Hesabı Sil flow',
    () => {
      const missing = missingTokens(settingsPageSource, [
        'Hesabı Sil',
        'requestAccountDeletion(base44, user)',
        'Tüm veriler kalıcı olarak silinir',
      ]);
      if (missing.length) {
        return fail('Settings account deletion entry point is missing or bypasses the shared deletion request.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/SettingsPage.jsx',
          missing,
        });
      }
      return pass('Settings exposes the account deletion entry point and uses the shared request helper.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_requires_confirmation',
    'Account deletion requires explicit confirmation before backend call',
    () => {
      const composed = `${settingsPageSource}\n${settingsModalSource}`;
      const missing = missingTokens(composed, [
        'confirmDelete',
        'if (!confirmDelete)',
        'Bu işlem geri alınamaz',
        'İptal',
        'Evet, Sil',
        'disabled={deleting}',
      ]);
      if (missing.length) {
        return fail('Account deletion can proceed without complete visible confirmation controls.', {
          verification: 'STATIC_CONTRACT',
          file: 'SettingsPage.jsx + SettingsModal.jsx',
          missing,
        });
      }
      return pass('Account deletion is guarded by a two-step irreversible confirmation and disabled loading state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_requires_authenticated_user',
    'deleteAccount authenticates server-side before cleanup',
    () => {
      const missing = missingTokens(deleteAccountSource, [
        'await base44.auth.me()',
        "code: 'unauthenticated'",
        'Giriş yapmanız gerekiyor.',
        '}, 401)',
      ]);
      if (missing.length) {
        return fail('deleteAccount can run without a proven authenticated user.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/deleteAccount/entry.ts',
          missing,
        });
      }
      return pass('deleteAccount requires server-side authenticated user context.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_scoped_to_current_user_only',
    'deleteAccount ignores client identity and scopes cleanup to auth.me user',
    () => {
      const missing = missingTokens(deleteAccountSource, [
        'userEmail = normalizeEmail(user.email)',
        'userId = String(user.id',
        'base44.asServiceRole.entities.User.delete(userId)',
      ]);
      const forbidden = presentTokens(deleteAccountSource, [
        'req.json()',
        'body.email',
        'body.userId',
        'body.user_email',
        'body.isAdmin',
      ]);
      if (missing.length || forbidden.length) {
        return fail('deleteAccount may trust client-supplied identity or delete outside the current user scope.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'base44/functions/deleteAccount/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('deleteAccount derives identity only from auth.me and deletes the authenticated User row last.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_removes_push_subscriptions',
    'Account deletion removes current-user PushSubscription rows',
    () => {
      const missing = missingTokens(deleteAccountSource, [
        'removePushSubscriptions',
        "'PushSubscription'",
        '{ user_email: userEmail }',
        "deleteRows(base44, 'PushSubscription'",
      ]);
      if (missing.length) {
        return fail('Deleted users can retain push subscription rows.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/deleteAccount/entry.ts',
          missing,
        });
      }
      return pass('deleteAccount removes PushSubscription rows scoped to the authenticated email.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_clears_local_user_cache',
    'Successful deletion clears user-scoped Kronox local/session caches before logout',
    () => {
      const missing = missingTokens(`${settingsPageSource}\n${settingsModalSource}\n${accountDeletionClientSource}`, [
        'clearAccountDeletionLocalCaches',
        'window.localStorage',
        'window.sessionStorage',
        'ownerKeyFromEmail',
        'requestAccountDeletion',
      ]);
      if (missing.length) {
        return fail('Account deletion does not clear local stale user cache after backend success.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/accountDeletion.js + deletion callers',
          missing,
        });
      }
      return pass('Successful deletion clears Kronox user-scoped local/session caches before logout.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_cancels_or_anonymizes_social_rows',
    'Account deletion removes/cancels social rows involving the user',
    () => {
      const missing = missingTokens(deleteAccountSource, [
        'removeSocialRows',
        "'FriendRequest'",
        "'Friendship'",
        'cancelOrAnonymizeInvites',
        "'GameInvite'",
        "status: 'cancelled'",
      ]);
      if (missing.length) {
        return fail('Social/invite rows can remain actionable for a deleted user.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/deleteAccount/entry.ts',
          missing,
        });
      }
      return pass('Friend rows are removed and pending GameInvite rows are cancelled/anonymized.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_removes_or_anonymizes_leaderboard_row',
    'Account deletion removes public leaderboard row and anonymizes retained audit rows',
    () => {
      const missing = missingTokens(deleteAccountSource, [
        "'SoloLeaderboardEntry'",
        "'GameRecord'",
        "'DiamondTransaction'",
        "'OnlineMatchResult'",
        'replaceEmailInKey',
        'account_deleted: true',
      ]);
      if (missing.length) {
        return fail('Deleted user identity can remain in public leaderboard or retained audit rows.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/deleteAccount/entry.ts',
          missing,
        });
      }
      return pass('Public rows are removed and retained Diamond/Online audit rows are anonymized.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_safe_error_handling',
    'Account deletion uses controlled backend errors and recoverable UI state',
    () => {
      const composed = `${deleteAccountSource}\n${settingsPageSource}\n${settingsModalSource}\n${accountDeletionClientSource}`;
      const missing = missingTokens(composed, [
        'account_deletion_failed',
        'Hesap silinemedi. Lütfen tekrar deneyin veya destek ile iletişime geçin.',
        'deleteError',
        'setDeleting(false)',
        'ACCOUNT_DELETION_ERROR_COPY',
      ]);
      const forbidden = presentTokens(deleteAccountSource, [
        'error: error.message',
        'stack: error.stack',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Account deletion can leak backend details or leave the UI stuck after failure.', {
          verification: 'STATIC_CONTRACT',
          file: 'deleteAccount + Settings deletion callers',
          actual: { missing, forbidden },
        });
      }
      return pass('Account deletion returns safe backend errors and the UI exposes a retryable failure state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('account_deletion_public_page_matches_in_app_flow',
    'Public /account-deletion page matches in-app Hesabı Sil flow',
    () => {
      const missing = missingTokens(`${accountDeletionPageSource}\n${settingsPageSource}`, [
        'Delete Your Kronox Account',
        'Profile',
        'Hesabı Sil',
        'support@kronoxgame.com',
        'associated user data will be deleted',
      ]);
      if (missing.length) {
        return fail('Public account deletion page and in-app deletion copy are inconsistent.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/AccountDeletionPage.jsx + src/pages/SettingsPage.jsx',
          missing,
        });
      }
      return pass('Public account deletion page accurately points users to the in-app Hesabı Sil flow and support email fallback.', {
        verification: 'STATIC_CONTRACT',
      });
    },
    { critical: false }),

  makeCase('account_deletion_runtime_probe_required',
    'Runtime deletion proof remains manual with a disposable test account',
    () => notAutomatable('Static checks verify code contracts only. Destructive live deletion, cross-user non-deletion, and retained-row anonymization must be proven manually with a safe test account before release.', {
      verification: 'NOT_AUTOMATABLE',
      classification: 'RUNTIME_DESTRUCTIVE_PROBE_REQUIRED',
      actionType: ACTION_TYPES.HUMAN_RELEASE_PROOF,
      expected: 'authenticated test account deletes only itself; related rows removed/cancelled/anonymized; other users untouched',
      actual: 'not executed by static Health',
    }),
    { critical: true, runtimeProofRequired: true, actionType: ACTION_TYPES.HUMAN_RELEASE_PROOF }),
];
