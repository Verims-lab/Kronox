// Kronox Health Center — DB Index / Duplicate Cleanup Readiness Suite
// (GFable 5 P0+P1 scale hardening).
//
// Contract locked in:
//   • Base44 repo JSONC schemas cannot declare indexes/unique constraints;
//     unique/index setup is platform/manual configuration and remains a
//     manual release gate. Function-level guards stay the runtime enforcement.
//   • INDEX BEFORE DUPLICATE CLEANUP IS NOT ALLOWED: every planned unique key
//     requires an admin dry-run duplicate check first.
//   • adminDuplicateKeyReport is the AdminUser-gated, READ-ONLY duplicate
//     dry-run tool (modes dry_run default / prepare_cleanup_plan). It never
//     deletes, merges, or mutates rows/balances; destructive cleanup is
//     intentionally not implemented until canonical-row semantics are approved.

import duplicateReportFnSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '../../lib/dbArchitectureMirrors';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const SUITE_ID = 'db_index_readiness';
const SUITE_NAME = 'DB Index / Duplicate Cleanup Readiness Suite';

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
function notAutomatable(reason, extra) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) }; }

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { /* fall through */ }
  try { return JSON.stringify(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

function forbiddenTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => text.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('duplicate_report_tool_admin_gated_read_only',
    'adminDuplicateKeyReport is AdminUser-gated, dry-run by default, and never mutates rows',
    () => {
      const missing = missingTokens(duplicateReportFnSource, [
        'requireAdmin',
        'AdminUser',
        "code: 'admin_required'",
        '403',
        "code: 'auth_required'",
        '401',
        "String(body?.mode || 'dry_run')",
        "'prepare_cleanup_plan'",
        'dryRun: true',
        'readOnly: true',
        'mutatesRows: false',
        'mutatesBalances: false',
        'destructiveCleanupImplemented: false',
      ]);
      const forbidden = forbiddenTokens(duplicateReportFnSource, [
        '.delete(',
        '.deleteMany(',
        '.updateMany(',
        '.create(',
        '.update(',
        "'execute_cleanup'",
        'bulkCreate',
        'bulkUpdate',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Duplicate dry-run tool drifted from the admin-gated read-only contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/adminDuplicateKeyReport/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Duplicate dry-run tool requires an active AdminUser, defaults to dry_run, and contains no row/balance mutation path.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('p0_unique_keys_covered_by_duplicate_dry_run',
    'All P0 unique keys have duplicate dry-run coverage before index creation',
    () => {
      const missing = missingTokens(duplicateReportFnSource, [
        "entity: 'DiamondTransaction'",
        "entity: 'DailyWheelSpin'",
        "entity: 'UserJokerInventory'",
        "entity: 'UserDailyQuestProgress'",
        "entity: 'JokerTransaction'",
        "entity: 'HintTransaction'",
        "fields: ['idempotency_key']",
        "fields: ['user_email', 'spin_date']",
        "fields: ['user_email', 'joker_type']",
        "fields: ['user_email', 'quest_date', 'quest_key']",
        'uniqueIndexBlockedByDuplicates',
        'duplicateCleanupRequiredBeforeUniqueIndex: true',
      ]);
      if (missing.length) {
        return fail('A planned P0 unique key lost its duplicate dry-run coverage.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/adminDuplicateKeyReport/entry.ts',
          missing,
        });
      }
      return pass('DiamondTransaction, DailyWheelSpin (key + user/day), UserJokerInventory, UserDailyQuestProgress, and joker/hint ledgers all have dry-run duplicate checks.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('p1_keys_covered_by_duplicate_dry_run',
    'P1 unique/projection keys (leaderboard owner, lobby code) have duplicate dry-run coverage',
    () => {
      const missing = missingTokens(duplicateReportFnSource, [
        "entity: 'SoloLeaderboardEntry'",
        "fields: ['owner_key']",
        "entity: 'Lobby'",
        "fields: ['code']",
      ]);
      if (missing.length) {
        return fail('A planned P1 unique key lost its duplicate dry-run coverage.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/adminDuplicateKeyReport/entry.ts',
          missing,
        });
      }
      return pass('SoloLeaderboardEntry.owner_key and Lobby.code duplicate dry-run checks exist.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('duplicate_report_samples_masked_no_private_ids',
    'Duplicate report samples mask emails/guest ids/owner keys before returning',
    () => {
      const missing = missingTokens(duplicateReportFnSource, [
        'function maskPrivateKeys',
        "'<email>'",
        "'guest:<key>'",
        'maskPrivateKeys(key)',
        'sampleKeys',
      ]);
      if (missing.length) {
        return fail('Duplicate report sample masking contract drifted; private identifiers could leak into admin report payloads.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/adminDuplicateKeyReport/entry.ts',
          missing,
        });
      }
      return pass('Sample duplicate keys are masked (emails, guest keys, u_/g_ owner keys) before response.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('index_support_model_and_cleanup_rule_documented',
    'Docs/mirror record the platform-manual index model and cleanup-before-unique rule',
    () => {
      const missing = missingTokens(DB_ARCHITECTURE_IMPLEMENTATION_MIRROR, [
        'GFable 5 P0 unique priorities',
        'GFable 5 P1 priorities',
        'Duplicate cleanup must complete before any unique constraint is configured',
        'adminDuplicateKeyReport',
        'cannot declare indexes/unique constraints',
        'manual release gate',
        'function-level guard',
        'total_kronox_score descending',
        'status + last_activity_at',
        'to_email + status + expires_at',
      ]);
      if (missing.length) {
        return fail('DB architecture mirror lost the GFable 5 index/duplicate-cleanup documentation.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/dbArchitectureMirrors.js',
          missing,
        });
      }
      return pass('Mirror documents P0/P1 index priorities, the manual platform gate, and the duplicate-cleanup-before-unique rule.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('platform_unique_index_configuration_manual_gate',
    'Base44 platform unique/index configuration remains a manual release gate',
    () => notAutomatable(
      'Base44 repo schemas cannot declare unique/index constraints. Configure the documented P0/P1 keys in the Base44 platform admin (after duplicate cleanup) and attach proof; until then function-level guards remain the enforcement (Medium/P1 risk).',
      {
        verification: 'NOT_AUTOMATABLE',
        verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
        expected: 'Platform unique keys configured for DiamondTransaction/DailyWheelSpin/UserJokerInventory/UserDailyQuestProgress/SoloLeaderboardEntry/Lobby.code after zero-duplicate dry-run proof.',
      },
    )),
];