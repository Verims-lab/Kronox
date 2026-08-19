import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import toolSource from '../admin/IntegritySnapshotTool.jsx?raw';
import planSource from '../admin/DuplicateCleanupPlan.jsx?raw';
import reviewSource from '../admin/DuplicateEligibilityReview.jsx?raw';
import docsMirrorSource from '../../lib/healthAlignmentDocMirrors.js?raw';

const SUITE_ID = 'data_hygiene_review';
const RELATED_FILES = [
  'base44/functions/adminDuplicateKeyReport/entry.ts',
  'src/components/admin/IntegritySnapshotTool.jsx',
  'src/components/admin/DuplicateCleanupPlan.jsx',
  'src/components/admin/DuplicateEligibilityReview.jsx',
  'src/lib/healthAlignmentDocMirrors.js',
];
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT' });
const missing = (source, tokens) => tokens.filter((token) => !String(source).includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source).includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: 'Data Hygiene Review Health Suite', id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });
const mutationCalls = () => present(reportSource, ['.create(', '.update(', '.delete(', '.deleteMany(', '.updateMany(', '.bulkCreate(', '.bulkUpdate(']);

export const EXTRA_SUITES = [{ id: SUITE_ID, name: 'Data Hygiene Review Health Suite', critical: true, color: '#f59e0b' }];
export const EXTRA_TESTS = [
  makeCase('p0_groups_have_deep_review', 'P0 groups include confidence and conflict reasons', () => {
    const absent = missing(reportSource, ['P0_REVIEW_CHECK_IDS', 'groupReviews:', 'logicalGroupFingerprint', 'canonicalConfidence', 'conflictReasons', 'requiredReviewerDecision']);
    return absent.length ? fail('P0 deep-review output is incomplete.', { missing: absent }) : pass('Every P0 group receives a fingerprint-only eligibility review with confidence, conflicts, reviewer decision, and future action.');
  }),
  makeCase('no_execution_path_exposed', 'No cleanup execute path is exposed', () => {
    const absent = missing(`${reportSource}\n${planSource}`, ['cleanupExecutionAvailable: false', 'executionEligibilityReviewOnly: true', 'Yürütme engelli']);
    const forbidden = present(`${toolSource}\n${planSource}`, ['adminDuplicateKeyCleanup', 'DELETE_DUPLICATES', 'execute_cleanup']);
    return absent.length || forbidden.length ? fail('Execution path exposure detected.', { missing: absent, forbidden }) : pass('The active report and Admin UI expose review only, with execution blocked.');
  }),
  makeCase('no_data_mutation_calls', 'Eligibility report contains no mutation calls', () => mutationCalls().length ? fail('Mutation calls exist in the report.', { forbidden: mutationCalls() }) : pass('The eligibility review performs bounded reads and in-memory analysis only.')),
  makeCase('joker_inventory_reconciliation_preview_only', 'Joker inventory reconciliation is preview-only', () => {
    const absent = missing(reportSource, ['inventoryLedgerSignals', 'LATEST_LEDGER_BALANCE_MISMATCH', 'DISTINCT_RECEIPT_DELTA_MISMATCH', "classification = conflictReasons.length ? 'REVIEW_REQUIRED'"]);
    return absent.length || mutationCalls().length ? fail('Joker inventory preview contract drifted.', { missing: absent }) : pass('Inventory candidates compare runtime quantity, latest ledger balance, and distinct receipt deltas without normalization.');
  }),
  makeCase('joker_transaction_conflicts_block_automation', 'Joker ledger conflicts block automation', () => {
    const absent = missing(reportSource, ['MATERIAL_CONFLICT_', "classification = conflictReasons.length ? 'DO_NOT_AUTOMATE'", 'EARLIEST_VALID_LEDGER_RECEIPT']);
    return absent.length ? fail('Conflicting Joker ledger rows may be automated.', { missing: absent }) : pass('Material JokerTransaction conflicts remain DO_NOT_AUTOMATE.');
  }),
  makeCase('daily_progress_conflicts_require_review', 'Daily progress conflicts require review', () => {
    const absent = missing(reportSource, ['DAILY_CONFLICT_', 'SOURCE_PROOF_CONFLICT', "classification = conflictReasons.length ? 'REVIEW_REQUIRED'"]);
    return absent.length ? fail('Daily source/progress conflicts are not guarded.', { missing: absent }) : pass('Daily state, progress, streak, and source-proof conflicts remain REVIEW_REQUIRED.');
  }),
  makeCase('leaderboard_conflicts_require_review', 'Leaderboard conflicts require review', () => {
    const absent = missing(reportSource, ['leaderboardScoreSignals', 'VISIBLE_SCORE_POLICY_MISMATCH', 'PROJECTION_CONFLICT_', "classification = conflictReasons.length ? 'REVIEW_REQUIRED'"]);
    return absent.length ? fail('Leaderboard projection conflicts are not guarded.', { missing: absent }) : pass('Leaderboard score/profile projection conflicts remain REVIEW_REQUIRED unless exact and policy-aligned.');
  }),
  makeCase('samples_are_fingerprint_only', 'Eligibility samples are fingerprint-only', () => {
    const absent = missing(`${reportSource}\n${reviewSource}`, ['fingerprintKey', 'proposedCanonicalRowFingerprint', 'samplesFingerprintOnly: true']);
    const forbidden = present(reviewSource, ['user_email', 'owner_key', 'guest_id', 'actor_key_hash', 'idempotency_key', 'row.id']);
    return absent.length || forbidden.length ? fail('Private or raw identity may reach eligibility samples.', { missing: absent, forbidden }) : pass('Admin review renders only bounded irreversible group and candidate fingerprints.');
  }),
  makeCase('cleanup_requires_separate_approval', 'Cleanup requires a separate approved task', () => {
    const absent = missing(`${reportSource}\n${planSource}\n${docsMirrorSource}`, ['separate_explicitly_approved_cleanup_execution', 'Temizlik ayrı onaylı görev gerektirir.', 'three-step']);
    return absent.length ? fail('Separate approval boundary is incomplete.', { missing: absent }) : pass('Runtime, UI, and docs enforce a separate explicitly approved cleanup task after review.');
  }),
  makeCase('duplicate_failures_not_marked_pass_before_cleanup', 'Duplicate checks stay failed before cleanup', () => {
    const absent = missing(`${reportSource}\n${docsMirrorSource}`, ["report.duplicateKeyCount > 0 ? 'FAIL' : 'PASS'", 'Duplicate checks remain FAIL']);
    return absent.length ? fail('Duplicate findings may be marked PASS before execution.', { missing: absent }) : pass('Eligibility review can pass while actual duplicate checks remain FAIL until cleanup and re-verification.');
  }),
];
