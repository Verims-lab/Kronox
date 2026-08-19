import cleanupSource from '../../../base44/functions/adminDuplicateKeyCleanup/entry.ts?raw';
import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import { TECHNICAL_FLOW_DOC, RELEASE_PROOF_CHECKLIST_DOC } from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const SUITE_ID = 'data_hygiene_phase1';
const SUITE_NAME = 'Data Hygiene Phase 1 Evidence Suite';
const RELATED_FILES = [
  'base44/functions/adminDuplicateKeyCleanup/entry.ts',
  'base44/functions/adminDuplicateKeyReport/entry.ts',
  'docs/KRONOX_DB_ARCHITECTURE.md',
  'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md',
  'src/lib/healthAlignmentDocMirrors.js',
  'src/lib/dbArchitectureMirrors.js',
];
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED', ...extra });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK' });
const manual = (reason, extra = {}) => ({ status: 'NOT_AUTOMATABLE', reason, verification: 'MANUAL_EXTERNAL', classification: 'MANUAL_EXTERNAL', runtimeProofRequired: true, ...extra });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#f59e0b' }];
export const EXTRA_TESTS = [
  makeCase('daily_auto_safe_cleanup_reflected', 'Approved Daily Phase 1 exact-duplicate cleanup is bounded and reflected accurately', () => {
    const docs = `${TECHNICAL_FLOW_DOC}\n${RELEASE_PROOF_CHECKLIST_DOC}\n${DB_ARCHITECTURE_IMPLEMENTATION_MIRROR}`;
    const absent = missing(`${cleanupSource}\n${reportSource}\n${docs}`, [
      "PHASE1_DAILY_SCOPE = 'phase1_user_daily_auto_safe'",
      'PHASE1_EXPECTED_GROUP_COUNT = 8',
      'PHASE1_EXPECTED_DELETE_COUNT = 31',
      "target.id === 'user_daily_quest_progress_user_day_task'",
      'phase1_approval_boundary_mismatch',
      'phase1_live_group_mismatch',
      'balancesMutated: false',
      'scoresMutated: false',
      '8 AUTO_SAFE',
      '31 redundant UserDailyQuestProgress rows',
      '4 UserDailyQuestProgress groups remain REVIEW_REQUIRED',
      'JokerTransaction and GameInvite remain DO_NOT_AUTOMATE',
      'UserJokerInventory and SoloLeaderboardEntry remain REVIEW_REQUIRED',
    ]);
    return absent.length
      ? fail('Phase 1 code bounds or the historical post-cleanup risk record is incomplete.', { missing: absent })
      : pass('Source and docs record only the approved 8 exact Daily groups/31 redundant rows, preserve non-Daily entities, and keep the remaining review/do-not-automate findings open.');
  }),

  makeCase('fresh_duplicate_state_requires_admin_report', 'Current duplicate state remains manual Admin runtime proof', () => manual(
    'The repository records the approved Phase 1 outcome but cannot prove current production rows. Run the AdminUser-gated read-only duplicate report; remaining duplicate checks stay FAIL until a separately approved cleanup and fresh verification.',
    { actionType: 'BACKEND_RUNTIME_PROBE', nextStep: 'Run adminDuplicateKeyReport in dry_run/prepare_cleanup_plan mode and retain fingerprint-only aggregate evidence.' },
  )),
];
