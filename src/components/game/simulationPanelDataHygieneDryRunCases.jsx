import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import integrityToolSource from '../admin/IntegritySnapshotTool.jsx?raw';
import cleanupPlanSource from '../admin/DuplicateCleanupPlan.jsx?raw';
import docsMirrorSource from '../../lib/healthAlignmentDocMirrors.js?raw';

const SUITE_ID = 'data_hygiene_dry_run';
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, verification: 'STATIC_CONTRACT', actual });
const missing = (source, tokens) => tokens.filter((token) => !String(source).includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source).includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: 'Data Hygiene Dry Run Health Suite', id, name, critical: true, actionType: 'CODE_FIX', run });
const noMutationCalls = () => present(reportSource, ['.create(', '.update(', '.delete(', '.deleteMany(', '.updateMany(', '.bulkCreate(', '.bulkUpdate(']);

export const EXTRA_SUITES = [{ id: SUITE_ID, name: 'Data Hygiene Dry Run Health Suite', critical: true, color: '#f59e0b' }];
export const EXTRA_TESTS = [
  makeCase('report_is_admin_only', 'Cleanup plan is Admin-only', () => {
    const absent = missing(`${reportSource}\n${adminPageSource}\n${appSource}\n${integrityToolSource}`, ['requireAdmin', 'AdminUser', '<AdminRoute><AdminPage', '<IntegritySnapshotTool />', "mode: 'prepare_cleanup_plan'"]);
    return absent.length ? fail('Admin boundary drifted.', { missing: absent }) : pass('The plan is produced by the AdminUser-gated report and rendered only inside guarded Admin Integrity Snapshot.');
  }),
  makeCase('report_is_read_only', 'Cleanup plan is read-only', () => {
    const absent = missing(reportSource, ['dryRun: true', 'readOnly: true', 'mutationOperationsEnabled: false', 'mutatesRows: false', 'mutatesBalances: false']);
    const forbidden = noMutationCalls();
    return absent.length || forbidden.length ? fail('Read-only contract drifted.', { missing: absent, forbidden }) : pass('The active planning source only reads bounded windows and enables no mutation operation.');
  }),
  makeCase('no_execute_without_approval', 'No cleanup executes without approval', () => {
    const absent = missing(`${reportSource}\n${cleanupPlanSource}`, ['cleanupExecutionAvailable: false', 'explicitApprovalRequired: true', 'Yürütme engelli', 'approvalBoundary']);
    const forbidden = present(`${integrityToolSource}\n${cleanupPlanSource}`, ['adminDuplicateKeyCleanup', 'DELETE_DUPLICATES', 'execute_cleanup']);
    return absent.length || forbidden.length ? fail('An execution path is exposed.', { missing: absent, forbidden }) : pass('The Admin dry-run UI has no cleanup invocation or execute control and states the approval boundary.');
  }),
  makeCase('canonical_strategy_defined_per_entity', 'Canonical strategy exists per failing entity', () => {
    const absent = missing(reportSource, ['COMPLETED_THEN_HIGHEST_PROGRESS', 'EARLIEST_VALID_LEDGER_RECEIPT', 'RUNTIME_MAX_THEN_LEDGER_RECONCILIATION', 'VISIBLE_KRONOX_PUAN_THEN_FRESHNESS', 'STATUS_AWARE_RELATION_HISTORY', 'LOBBY_AND_STATUS_AWARE_INVITE_HISTORY']);
    return absent.length ? fail('Canonical strategy metadata is incomplete.', { missing: absent }) : pass('Every targeted Daily, ledger, inventory, leaderboard, friend, and invite check has a named strategy.');
  }),
  makeCase('risk_level_defined_per_entity', 'Risk levels exist per failing entity', () => {
    const absent = missing(reportSource, ["riskLevel: 'P0'", "riskLevel: 'P1'", 'p0DuplicateGroups', 'p1DuplicateGroups']);
    return absent.length ? fail('Risk metadata is incomplete.', { missing: absent }) : pass('P0/P1 risk is attached to every plan and summarized by duplicate group.');
  }),
  makeCase('samples_are_fingerprint_only', 'Samples are bounded fingerprints only', () => {
    const absent = missing(`${reportSource}\n${cleanupPlanSource}`, ['CLEANUP_PLAN_SAMPLE_LIMIT = 3', 'canonicalCandidateFingerprint', 'samplesFingerprintOnly: true', 'geri döndürülemez fingerprint']);
    const forbidden = present(cleanupPlanSource, ['user_email', 'owner_key', 'guest_id', 'actor_key_hash', 'idempotency_key', 'row.id']);
    return absent.length || forbidden.length ? fail('Sample privacy boundary drifted.', { missing: absent, forbidden }) : pass('Only three irreversible group/candidate fingerprints per check can reach the Admin UI.');
  }),
  makeCase('inventory_duplicates_not_auto_cleaned', 'Inventory duplicates are not auto-cleaned', () => {
    const absent = missing(reportSource, ['user_joker_inventory_actor_type', 'user_hint_inventory_actor', "automationSafetyLevel: 'REVIEW_REQUIRED'", 'quantity remains unchanged in this plan']);
    return absent.length || noMutationCalls().length ? fail('Inventory dry-run boundary drifted.', { missing: absent }) : pass('Joker and Hint inventory groups are review-only recommendations with no mutation.');
  }),
  makeCase('transaction_duplicates_not_auto_cleaned', 'Transaction duplicates are not auto-cleaned', () => {
    const absent = missing(reportSource, ['joker_transaction_idempotency_key', 'hint_transaction_idempotency_key', "return 'DO_NOT_AUTOMATE'", 'never delete ledger rows blindly']);
    return absent.length || noMutationCalls().length ? fail('Ledger dry-run boundary drifted.', { missing: absent }) : pass('Conflicting ledger groups become DO_NOT_AUTOMATE and no transaction row is changed.');
  }),
  makeCase('daily_progress_duplicates_not_auto_cleaned', 'Daily duplicates are not auto-cleaned', () => {
    const absent = missing(reportSource, ['user_daily_quest_progress_idempotency_key', 'user_daily_quest_progress_user_day_task', 'do not grant rewards or change streak state']);
    return absent.length || noMutationCalls().length ? fail('Daily dry-run boundary drifted.', { missing: absent }) : pass('Daily canonical candidates are calculated without changing progress, rewards, or streaks.');
  }),
  makeCase('leaderboard_duplicates_not_auto_cleaned', 'Leaderboard duplicates are not auto-cleaned', () => {
    const absent = missing(reportSource, ['solo_leaderboard_entry_owner_key', 'VISIBLE_KRONOX_PUAN_THEN_FRESHNESS', 'do not recompute history in this plan']);
    return absent.length || noMutationCalls().length ? fail('Leaderboard dry-run boundary drifted.', { missing: absent }) : pass('Leaderboard rows remain untouched while score/freshness strategy is reported.');
  }),
  makeCase('friend_invite_duplicates_not_auto_cleaned', 'Friend/invite duplicates are not auto-cleaned', () => {
    const absent = missing(reportSource, ['friend_request_sender_recipient_status', 'game_invite_sender_recipient_status', 'active invites require manual review', 'Testing artifacts remain suppression candidates']);
    return absent.length || noMutationCalls().length ? fail('Social dry-run boundary drifted.', { missing: absent }) : pass('Friend and invite lifecycle groups remain review-only and unchanged.');
  }),
  makeCase('cleanup_execution_deferred_to_separate_approval', 'Execution is deferred to separate approval', () => {
    const absent = missing(`${reportSource}\n${cleanupPlanSource}\n${docsMirrorSource}`, ['Cleanup execution is separate and blocked until explicit admin/user approval.', 'explicitly approved task', 'Duplicate checks remain FAIL']);
    return absent.length ? fail('Separate-approval boundary is not aligned.', { missing: absent }) : pass('Runtime plan, Admin UI, and active docs mirror all defer execution to a separate explicit approval.');
  }),
];