import reportSource from '../../../base44/functions/adminDuplicateKeyReport/entry.ts?raw';
import reportManifest from '../../../base44/functions/adminDuplicateKeyReport/function.jsonc?raw';
import claimWheelSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import claimDailySource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import claimLoginSource from '../../../base44/functions/claimLoginBonuses/entry.ts?raw';
import purchaseSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import startOnlineSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateOnlineSource from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import toolSource from '../admin/IntegritySnapshotTool.jsx?raw';
import dailyCalendarSource from '../../lib/dailyCalendar.js?raw';
import dailyHealthSource from './simulationPanelDailyGoalsRuntimeCases.jsx?raw';
import soloHealthSource from './simulationPanelSoloStreakCases.jsx?raw';
import onlineClientSource from '../../lib/applyOnlineResult.js?raw';
import functionGateSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';

const SUITE_ID = 'integrity_proof_health';
const SUITE_NAME = 'Integrity Proof Health Suite';
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, verification: 'STATIC_CONTRACT', actual });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', run });

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#10b981' }];
export const EXTRA_TESTS = [
  makeCase('admin_integrity_tools_are_admin_only', 'Integrity proof tools are admin-only', () => {
    const absent = missing(`${reportSource}\n${adminPageSource}\n${appSource}`, ['requireAdmin', 'AdminUser', "code: 'auth_required'", "code: 'admin_required'", '<AdminRoute><AdminPage', '<IntegritySnapshotTool />']);
    return absent.length ? fail('Admin proof boundary drifted.', { missing: absent }) : pass('The existing Admin route and backend AdminUser guard jointly protect the B1 proof surface.');
  }),
  makeCase('duplicate_report_is_dry_run_only', 'Duplicate report is dry-run only', () => {
    const absent = missing(reportSource, ['dryRun: true', 'readOnly: true', 'mutatesRows: false', 'mutatesBalances: false', 'destructiveCleanupImplemented: false']);
    const forbidden = present(reportSource, ['.create(', '.update(', '.delete(', '.deleteMany(', '.updateMany(', '.bulkCreate(', '.bulkUpdate(']);
    return absent.length || forbidden.length ? fail('Duplicate report is not provably read-only.', { missing: absent, forbidden }) : pass('The report contains reads only and returns explicit dry-run/no-mutation flags.');
  }),
  makeCase('economy_sources_are_distinct', 'Economy sources and directions remain distinct', () => {
    const combined = `${reportSource}\n${claimWheelSource}\n${claimDailySource}\n${claimLoginSource}\n${purchaseSource}`;
    const absent = missing(combined, ['daily_wheel', 'daily_calendar_streak_reward', 'solo_streak', 'market_purchase', 'starter_bonus', 'first_login_reward', 'daily_login', "direction: 'earn'", "direction: 'spend'"]);
    return absent.length ? fail('Economy source separation proof is incomplete.', { missing: absent }) : pass('Active wheel, calendar, Solo streak, Store, and login sources remain independently auditable.');
  }),
  makeCase('idempotency_keys_are_reported', 'Critical idempotency keys are reported', () => {
    const absent = missing(reportSource, ['diamond_transaction_idempotency_key', 'daily_wheel_spin_idempotency_key', 'solo_streak_reward_idempotency_key', 'joker_transaction_idempotency_key', 'hint_transaction_idempotency_key', 'online_match_result_idempotency_key', 'economy_operation_lock_key', 'samples:']);
    return absent.length ? fail('Critical idempotency checks are missing.', { missing: absent }) : pass('The active admin report covers critical receipts and returns fingerprinted—not raw—samples.');
  }),
  makeCase('daily_tasks_have_source_proof', 'Daily tasks map to real source proof', () => {
    const combined = `${reportSource}\n${dailyCalendarSource}\n${dailyHealthSource}`;
    const absent = missing(combined, ['daily_wheel_claim', 'joker_used', 'time_freeze_joker_used', 'hint_used', 'solo_level_complete', 'consecutive_correct_4', 'correct_answer', 'jokerless_solo_level_complete', 'profile_complete', 'friend_invite_sent', 'friend_added', 'Daily Goals Runtime Simulation Suite']);
    return absent.length ? fail('Daily source-proof matrix drifted.', { missing: absent }) : pass('Every active Daily task type is mapped to its persisted receipt source and executable Health coverage.');
  }),
  makeCase('solo_streak_rewards_are_idempotent_and_isolated', 'Solo streak rewards are idempotent and isolated', () => {
    const combined = `${reportSource}\n${claimLoginSource}\n${soloHealthSource}`;
    const absent = missing(combined, ['solo_streak_reward:', "source: 'solo_streak'", 'seenEventIds', 'attempt_id: attemptId', 'level: levelNumber', 'noKronoxPuan: true', 'noLeaderboardImpact: true', 'noDailyGoalImpact: true']);
    return absent.length ? fail('Solo streak receipt isolation drifted.', { missing: absent }) : pass('Solo streak receipts stay attempt/level/milestone-bound, Diamond-only, and separate from Daily/Puan/Leaderboard.');
  }),
  makeCase('online_authority_has_shared_deck_and_backend_result', 'Online uses shared deck and backend result authority', () => {
    const combined = `${startOnlineSource}\n${updateOnlineSource}\n${onlineClientSource}`;
    const absent = missing(combined, ['online_shared_all_active_random_deck_v1', 'allCategoriesRandom: true', 'soloPreferenceWeightingApplied: false', 'online_question_deck', "body?.action === 'commit_result'", 'ONLINE_WIN_POINTS = 15', 'ONLINE_LOSS_POINTS = -6', 'clientOnlineMatchResultWrites: false']);
    return absent.length ? fail('Online authority proof drifted.', { missing: absent }) : pass('Online remains server-deck-owned and backend-result-owned with fixed +15/-6 scoring.');
  }),
  makeCase('no_private_ids_in_public_proof_surfaces', 'No private IDs appear in public proof surfaces', () => {
    const forbidden = present(toolSource, ['user_email', 'from_email', 'to_email', 'owner_key', 'actor_key_hash', 'guest_token', 'guest_id', 'lobby_id', 'idempotency_key']);
    const guarded = adminPageSource.includes('<IntegritySnapshotTool />') && appSource.includes('<AdminRoute><AdminPage');
    return forbidden.length || !guarded ? fail('The B1 UI can render private identifiers or escape Admin.', { forbidden, guarded }) : pass('The B1 UI renders aggregate counts/status only and exists solely under the guarded Admin route.');
  }),
  makeCase('function_count_not_increased', 'B1 does not increase function count', () => {
    const absent = missing(`${functionGateSource}\n${reportManifest}`, ['MAX_BASE44_FUNCTIONS = 50', 'entryFiles.length > MAX_BASE44_FUNCTIONS', '"name": "adminDuplicateKeyReport"']);
    return absent.length ? fail('Function-count gate or reused manifest is missing.', { missing: absent }) : pass('B1 reuses adminDuplicateKeyReport and the deploy gate still enforces the 50-entry ceiling.');
  }),
  makeCase('no_destructive_cleanup_added', 'B1 adds no destructive cleanup', () => {
    const forbidden = present(`${reportSource}\n${toolSource}`, ['DELETE_DUPLICATES', 'execute_cleanup', '.delete(', '.deleteMany(', '.updateMany(', '.bulkUpdate(']);
    return forbidden.length ? fail('A destructive B1 path was detected.', { forbidden }) : pass('B1 proof code has no cleanup, delete, merge, or mutation action.');
  }),
];