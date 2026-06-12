// Kronox Health Center — Daily Quest Runtime v1 contracts.
//
// Scope: one user-owned daily progress row, UTC-day quest assignment, Solo-only
// progress events, server-backed Diamond claim, Günlük Ödüller panel, and
// strict no Kronox Puan / no leaderboard impact boundaries.

import dailyQuestProgressEntitySource from '../../../base44/entities/UserDailyQuestProgress.jsonc?raw';
import dailyQuestDefinitionEntitySource from '../../../base44/entities/DailyQuestDefinition.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import useDailyQuestsSource from '../../hooks/useDailyQuests.js?raw';
import dailyRewardsPanelSource from '../dailyWheel/DailyRewardsPanel.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import releaseProofSource from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import dbArchitectureSource from '../../../docs/KRONOX_DB_ARCHITECTURE.md?raw';
import securitySource from '../../../docs/KRONOX_SECURITY_DEPLOYMENT.md?raw';
import soloEngineSource from '../../../docs/KRONOX_SOLO_QUESTION_ENGINE.md?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE', MANUAL_VERIFY: 'MANUAL_VERIFY' };
const SUITE_ID = 'daily_quest_runtime_health';
const SUITE_NAME = 'Daily Quest Runtime Health Suite';

function text(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => !value.includes(token));
}

function forbiddenTokens(source, tokens) {
  const value = text(source);
  return tokens.filter((token) => value.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Daily Quest Runtime v1 server-backed, Solo-only, Diamond-only, and separate from Daily Wheel/leaderboard.',
    ...options,
    run,
  };
}

const runtimeSources = [
  dailyQuestProgressEntitySource,
  getDailyQuestStatusSource,
  recordDailyQuestProgressSource,
  claimDailyQuestRewardSource,
  dailyQuestGatewaySource,
  useDailyQuestsSource,
  dailyRewardsPanelSource,
  gameSource,
].join('\n');
const docsCombined = `${releaseProofSource}\n${dbArchitectureSource}\n${securitySource}\n${soloEngineSource}`;

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#7dd3fc' },
];

export const EXTRA_TESTS = [
  makeCase('progress_entity_exists_and_is_user_owned',
    'UserDailyQuestProgress entity/table exists and is user-owned',
    () => {
      const missing = missingTokens(dailyQuestProgressEntitySource, [
        '"name": "UserDailyQuestProgress"',
        '"user_email"',
        '"quest_definition_id"',
        '"quest_key"',
        '"quest_date"',
        '"progress_value"',
        '"target_value"',
        '"reward_diamonds"',
        '"status"',
        '"completed_at"',
        '"claimed_at"',
        '"idempotency_key"',
        '"data.user_email": "{{user.email}}"',
      ]);
      if (missing.length) return fail('UserDailyQuestProgress schema or user-owned RLS contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/entities/UserDailyQuestProgress.jsonc',
        missing,
      });
      return pass('UserDailyQuestProgress stores per-user/per-day progress and is scoped by user_email.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('utc_day_and_today_ensure_contract',
    'Daily Quest uses UTC quest_date and ensureTodayDailyQuests creates 1 row idempotently',
    () => {
      const missing = missingTokens(getDailyQuestStatusSource, [
        'utcDateKey',
        "toISOString().slice(0, 10)",
        'nextUtcMidnightIso',
        'ensureTodayDailyQuests',
        'DAILY_QUESTS_PER_DAY = 1',
        'dedupeDefinitionsByQuestKey',
        'canonicalDefinitionSort',
        'duplicateDefinitionCount',
        'definitionDuplicateGroups',
        'canonical_definition_id',
        'definitions.slice(0, DAILY_QUESTS_PER_DAY)',
        'selectedQuestKeys',
        'selectedQuestKeys.has',
        'slice(0, DAILY_QUESTS_PER_DAY)',
        'dailyQuestLimit: DAILY_QUESTS_PER_DAY',
        "filter({ status: 'active' }",
        'ensureDefaultDefinitions',
        'DEFAULT_DEFINITIONS',
        'definitions_present',
        'default_seed_created',
        'seededDefaultKeys',
        'function progressEntity(base44',
        'base44?.entities?.UserDailyQuestProgress',
        'progressEntitySource',
        'auth_user',
        'findProgressByAssignment',
        'daily_quest:${email}:${dateKey}:${questKey}',
        'const ensuredRows = rows',
        'refreshedRows.length ? refreshedRows : ensuredRows',
        'noRewardDuringEnsure: true',
      ]);
      if (missing.length) return fail('UTC daily ensure/idempotency/active-definition contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/getDailyQuestStatus/entry.ts',
        missing,
      });
      return pass('getDailyQuestStatus uses UTC, excludes passive definitions, and idempotently ensures exactly 1 selected row.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('home_empty_state_and_seed_contract',
    'Home Daily Quest load seeds fresh DB defaults and has a clear no-active-definition state',
    () => {
      const combined = `${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${dailyRewardsPanelSource}\n${docsCombined}`;
      const missing = missingTokens(combined, [
        'DEFAULT_DEFINITIONS',
        'Solo’ya Başla',
        'correct_5_cards',
        'complete_1_solo_level',
        'use_1_joker',
        'readAllDefinitions',
        'allDefinitions.length > 0',
        'created_by: \'system:daily_quest_runtime_seed\'',
        'emptyStateReason',
        'no_active_definitions',
        'Günlük görev yakında hazır olacak.',
        'Görevler yükleniyor...',
        'Older same-day 3-quest rows are retained but Home displays only the selected',
        'Aktif günlük görev tanımı yok. Admin Ekranı &gt; Günlük Görev Yönetimi bölümünden aktif görev ekleyin.',
        '`claimDailyQuestReward` remains the only reward path',
      ]);
      const forbidden = forbiddenTokens(`${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}`, [
        'DiamondTransaction.create',
        'source: \'daily_quest_reward\'',
        'kronox_puan_total',
        'SoloLeaderboardEntry',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest Home load can remain empty/stuck or can grant rewards during ensure.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Home status load idempotently seeds fresh DB defaults, reports no-active-definition state, and never grants during ensure.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('definition_copy_and_logic_boundary',
    'Daily Quest progress copies target/reward and keeps title/description display-only',
    () => {
      const missing = missingTokens(`${dailyQuestProgressEntitySource}\n${getDailyQuestStatusSource}\n${dailyQuestDefinitionEntitySource}`, [
        'title',
        'description',
        'Display-only',
        'quest_type',
        'target_value',
        'reward_diamonds',
        'title: definition.title',
        'description: definition.description',
        'target_value: definition.target_value',
        'reward_diamonds: definition.reward_diamonds',
      ]);
      const forbidden = forbiddenTokens(runtimeSources, [
        'parseQuestText',
        'interpretQuestText',
        'eval(',
        'new Function',
        'openai',
        'gpt',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest display copy/logic boundary can drift.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Progress rows copy display/target/reward values and runtime logic uses quest_type + target_value only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_progress_events_are_wired',
    'Solo events increment supported Daily Quest types',
    () => {
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}`, [
        "recordDailyQuestProgress({",
        "eventType: 'start_solo_attempt'",
        "recordDailyQuestSoloEvent('correct_cards'",
        "recordDailyQuestSoloEvent('complete_solo_level'",
        "recordDailyQuestSoloEvent('use_joker'",
        "mode: 'solo'",
        'progress_value',
        'status: nextStatus',
        'completed_at',
      ]);
      if (missing.length) return fail('Solo Daily Quest progress event wiring is incomplete.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/pages/Game.jsx', 'base44/functions/recordDailyQuestProgress/entry.ts'],
        missing,
      });
      return pass('Game.jsx emits Solo-only start/correct/complete/joker events and recordDailyQuestProgress completes rows at target.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_mode_excluded',
    'Online mode does not increment Daily Quest progress',
    () => {
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}`, [
        "if (!isSoloLevelMode",
        "mode !== 'solo'",
        'non_solo_mode',
        'onlineModeExcluded',
      ]);
      const forbidden = forbiddenTokens(recordDailyQuestProgressSource, [
        "mode: 'online'",
        'lobbyId, eventType',
      ]);
      if (missing.length || forbidden.length) return fail('Online mode can affect Daily Quest progress.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest progress is gated to Solo mode and the backend skips non-solo events.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('claim_requires_completed_and_writes_diamond_transaction',
    'Claim requires completed status and writes DiamondTransaction daily_quest_reward',
    () => {
      const missing = missingTokens(`${claimDailyQuestRewardSource}\n${diamondTransactionEntitySource}`, [
        'claimDailyQuestReward',
        'base44.auth.me()',
        'findProgress',
        'progressValue < targetValue',
        'daily_quest_not_completed',
        "source: DAILY_QUEST_REWARD_SOURCE",
        "direction: 'earn'",
        'DiamondTransaction',
        'daily_quest_reward',
        'related_entity_type: RELATED_ENTITY_TYPE',
        'related_entity_id: rowId(progress)',
        'balance_after',
        'diamondBalanceAfter',
        "questStatus: 'claimed'",
      ]);
      if (missing.length) return fail('Daily Quest claim does not prove completed-status validation and DiamondTransaction write.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/functions/claimDailyQuestReward/entry.ts',
        missing,
      });
      return pass('claimDailyQuestReward validates completion and writes a daily_quest_reward DiamondTransaction.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('claim_idempotent_and_client_reward_not_trusted',
    'Daily Quest claim is idempotent and client cannot control reward amount',
    () => {
      const missing = missingTokens(claimDailyQuestRewardSource, [
        'buildClaimIdempotencyKey',
        'findDiamondTransaction',
        'existingTx',
        'alreadyClaimed: true',
        'rewardDiamonds = Math.max(1, normalizeNumber(progress.reward_diamonds, 1))',
        'clientRewardIgnored: true',
        'daily_quest_already_claimed',
      ]);
      const forbidden = forbiddenTokens(claimDailyQuestRewardSource, [
        'body?.reward',
        'body?.reward_diamonds',
        'body?.diamondAmount',
        'body?.amount',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest claim can double-grant or trust client reward values.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Claim idempotency uses DiamondTransaction keys and reward amount comes from the progress row.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('completed_quest_claim_action_grants_visible_diamonds',
    'Completed Daily Quest exposes a claim action and refreshes visible Diamonds',
    () => {
      const combined = `${useDailyQuestsSource}\n${dailyRewardsPanelSource}\n${dailyQuestGatewaySource}\n${claimDailyQuestRewardSource}`;
      const missing = missingTokens(combined, [
        'const body = await claimDailyQuestReward({',
        'progressId: quest?.id || undefined',
        'questKey: quest?.questKey',
        'questDate: quest?.questDate || serverDate',
        'buildClaimKey(quest, serverDate)',
        'body?.userPatch',
        'onUserUpdated(body.userPatch)',
        "setError(err?.message || 'Ödül alınamadı. Tekrar dene.')",
        'Ödül alınamadı. Tekrar dene.',
        'safeRuntimeError(error, \'Ödül alınamadı. Tekrar dene.\')',
        'Günlük Görevleri Yap, Elmasları Kazan!',
        'dailyQuests.error',
        'Al',
        'Alındı',
        'diamondBalanceAfter',
        "questStatus: 'claimed'",
      ]);
      if (missing.length) return fail('Completed Daily Quest claim can fail silently or skip visible Diamond refresh.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/hooks/useDailyQuests.js', 'src/components/dailyWheel/DailyRewardsPanel.jsx', 'base44/functions/claimDailyQuestReward/entry.ts'],
        missing,
      });
      const forbidden = forbiddenTokens(combined, ['Request failed with status code']);
      if (forbidden.length) return fail('Completed Daily Quest claim can expose raw HTTP status text.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/hooks/useDailyQuests.js', 'src/lib/dbGateway/dailyQuestGateway.js', 'src/components/dailyWheel/DailyRewardsPanel.jsx'],
        forbidden,
      });
      return pass('Completed quests call claimDailyQuestReward with id or quest fallback, surface claim errors, and apply returned diamond userPatch.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('diamonds_only_no_puan_no_leaderboard',
    'Daily Quest grants diamonds only, no Kronox Puan and no leaderboard impact',
    () => {
      const missing = missingTokens(`${runtimeSources}\n${docsCombined}`, [
        'grants diamonds only',
        'does not grant Kronox Puan',
        'no leaderboard impact',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
      ]);
      const forbidden = forbiddenTokens(`${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`, [
        'kronox_puan_total',
        'total_kronox_score',
        'SoloLeaderboardEntry',
        'online_progress',
        'solo_progress',
        'levelScore',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest runtime can affect Puan/leaderboard/scoring.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest runtime is Diamond-only and disconnected from Puan, leaderboard, Solo score, and Online score writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_rewards_panel_includes_wheel_and_daily_quest',
    'Günlük Ödüller panel includes Daily Wheel and one compact Günlük Görev claim UI',
    () => {
      const missing = missingTokens(dailyRewardsPanelSource, [
        'Günlük Ödüller',
        'DailyWheelCard',
        'Günlük Görev',
        'Günlük Görevleri Yap, Elmasları Kazan!',
        'useDailyQuests',
        'dailyQuests.quests.slice(0, 1)',
        'progressValue',
        'targetValue',
        'rewardDiamonds',
        'Ödül',
        'Al',
        'Alındı',
        'Devam Et',
        'Günlük görev yakında hazır olacak.',
      ]);
      if (missing.length) return fail('Günlük Ödüller panel does not include the runtime Daily Quest UI.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/components/dailyWheel/DailyRewardsPanel.jsx',
        missing,
      });
      return pass('Günlük Ödüller combines Daily Wheel and one compact Günlük Görev with progress and claim states.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_separation_contract',
    'Daily Quest and Daily Wheel remain separate reward systems',
    () => {
      const missing = missingTokens(`${claimDailyWheelRewardSource}\n${claimDailyQuestRewardSource}\n${docsCombined}`, [
        'DAILY_WHEEL_SOURCE',
        'daily_wheel',
        'DAILY_QUEST_REWARD_SOURCE',
        'daily_quest_reward',
        'Daily Wheel and Daily Quest are separate',
        'STREAK_BONUS_AMOUNT = 150',
      ]);
      const forbidden = forbiddenTokens(claimDailyWheelRewardSource, [
        'daily_quest_reward',
        'UserDailyQuestProgress',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Wheel and Daily Quest reward lanes can conflict.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Wheel stays daily_wheel/+150 streak; Daily Quest uses separate daily_quest_reward claims.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('user_ownership_and_runtime_security',
    'User can only read/update/claim own Daily Quest progress',
    () => {
      const missing = missingTokens(`${dailyQuestProgressEntitySource}\n${claimDailyQuestRewardSource}\n${recordDailyQuestProgressSource}`, [
        '"data.user_email": "{{user.email}}"',
        'normalizeEmail(user?.email)',
        'normalizeEmail(row?.user_email) === email',
        'user_email: email',
        'base44.auth.me()',
      ]);
      const forbidden = forbiddenTokens(`${claimDailyQuestRewardSource}\n${recordDailyQuestProgressSource}`, [
        'body?.user_email',
        'body?.email',
        'hardcoded',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest runtime can trust client identity or cross-user progress.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest runtime derives ownership from authenticated user context and user_email-scoped rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_manual_rls_and_race_proof',
    'Daily Quest runtime RLS/race/idempotency proof remains manual',
    () => notAutomatable(
      'Static Health verifies source contracts, but two-account RLS and duplicate-claim race behavior require deployed backend proof: claim own quest, attempt cross-user claim, retry/double-click claim, and confirm only one daily_quest_reward DiamondTransaction.',
      {
        verification: 'NOT_AUTOMATABLE',
        classification: 'RUNTIME_BACKEND_PROBE_REQUIRED',
        expected: 'User A cannot read/claim User B progress; duplicate claims create at most one DiamondTransaction and one balance increase.',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      },
    ),
    { critical: false, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE }),
];
