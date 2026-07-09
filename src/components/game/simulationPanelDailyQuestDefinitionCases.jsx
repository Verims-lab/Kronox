// Kronox Health Center — Daily Calendar definition/cleanup boundary.
//
// Scope: active Daily runtime is code-owned Daily Calendar/Streak. Legacy
// DailyQuestDefinition rows can exist only for historical/admin cleanup paths
// and must never drive the runtime UI or task assignment.

import adminPageSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import dailyCalendarSource from '../../lib/dailyCalendar.js?raw';
import dailyQuestEntitySource from '../../../base44/entities/DailyQuestDefinition.jsonc?raw';
import dailyQuestProgressEntitySource from '../../../base44/entities/UserDailyQuestProgress.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import cleanupLegacyDailyQuestsSource from '../../../base44/functions/cleanupLegacyDailyQuests/entry.ts?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import {
  RELEASE_PROOF_CHECKLIST_DOC as releaseProofSource,
  SECURITY_DEPLOYMENT_DOC as securitySource,
} from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR as dbArchitectureSource } from '@/lib/dbArchitectureMirrors';
import { SOLO_QUESTION_ENGINE_DOC as soloEngineDocSource } from '@/lib/soloQuestionEngineDoc';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', MANUAL_VERIFY: 'MANUAL_VERIFY', BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE' };
const SUITE_ID = 'daily_quest_definition_health';
const SUITE_NAME = 'Daily Quest Definition Health Suite';

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
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
    nextStep: options.nextStep || 'Keep Daily Calendar/Streak code-owned and keep legacy definitions cleanup-only.',
    ...options,
    run,
  };
}

const docsCombined = `${releaseProofSource}\n${dbArchitectureSource}\n${securitySource}\n${soloEngineDocSource}`;
const runtimeSources = `${dailyCalendarSource}\n${dailyQuestGatewaySource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`;

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('legacy_definition_entity_is_cleanup_only',
    'DailyQuestDefinition is legacy/admin-only and ignored by active runtime',
    () => {
      const missing = missingTokens(`${dailyQuestEntitySource}\n${dailyQuestGatewaySource}\n${docsCombined}`, [
        'DailyQuestDefinition',
        'legacy/admin-only',
        'new Daily Calendar runtime ignores definition rows',
        'adminDefinitionRowsIgnoredAtRuntime: true',
        'definitionRowsIgnoredAtRuntime',
        'cleanupLegacyDailyQuests',
      ]);
      const forbidden = forbiddenTokens(getDailyQuestStatusSource, [
        'ensureDefaultDefinitions',
        'DailyQuestDefinition.create',
        "filter({ status: 'active' }",
      ]);
      if (missing.length || forbidden.length) {
        return fail('DailyQuestDefinition can still drive or seed runtime assignments.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('DailyQuestDefinition remains documented for historical cleanup only; runtime ignores definition rows.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('new_template_cycle_is_code_owned',
    'New Daily task definitions are centralized in the code-owned 9-day cycle',
    () => {
      const missing = missingTokens(`${dailyCalendarSource}\n${dailyQuestGatewaySource}`, [
        'DAILY_TASK_TEMPLATE_CYCLE',
        'DAILY_CALENDAR_TEMPLATE_CYCLE_LENGTH = 9',
        'DAILY_CALENDAR_TASKS_PER_DAY = 3',
        'daily_wheel_claim',
        'solo_level_complete',
        'consecutive_correct_4',
        'joker_used',
        'time_freeze_joker_used',
        'jokerless_solo_level_complete',
        'profile_complete',
        'correct_answer',
        'friend_invite_sent',
        'friend_added',
        'textIsNeverParsedIntoLogic: true',
        'quest_type + target_value',
      ]);
      const forbidden = forbiddenTokens(runtimeSources, [
        'parseQuestText',
        'interpretQuestText',
        'eval(',
        'new Function',
        'gpt',
        'nlpParse',
      ]);
      if (missing.length || forbidden.length) {
        return fail('New Daily templates can drift back to DB/free-text parser behavior.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily task templates are explicit code-owned event contracts, not DB/free-text logic.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('progress_schema_supports_calendar_tasks',
    'UserDailyQuestProgress schema supports Daily Calendar rows and zero per-task rewards',
    () => {
      const missing = missingTokens(dailyQuestProgressEntitySource, [
        '"name": "UserDailyQuestProgress"',
        'Daily Calendar/Streak Runtime v1',
        'daily_calendar:*',
        '"daily_wheel_claim"',
        '"solo_level_complete"',
        '"consecutive_correct_4"',
        '"joker_used"',
        '"time_freeze_joker_used"',
        '"jokerless_solo_level_complete"',
        '"profile_complete"',
        '"correct_answer"',
        '"friend_invite_sent"',
        '"friend_added"',
        '"reward_diamonds"',
        '"minimum": 0',
        '"idempotency_key"',
      ]);
      if (missing.length) {
        return fail('UserDailyQuestProgress schema lacks the new Daily Calendar task/event contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/UserDailyQuestProgress.jsonc',
          missing,
        });
      }
      return pass('UserDailyQuestProgress supports 3 Daily Calendar rows/day, event task types, and zero per-task Diamond rewards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('streak_reward_schema_and_claim_source',
    'DiamondTransaction supports the Daily Calendar streak reward source',
    () => {
      const missing = missingTokens(`${diamondTransactionEntitySource}\n${claimDailyQuestRewardSource}`, [
        '"daily_calendar_streak_reward"',
        'Daily Calendar 7-day streak reward claims write daily_calendar_streak_reward',
        'DAILY_STREAK_REWARD_DIAMONDS = 200',
        'source: DAILY_CALENDAR_REWARD_SOURCE',
        "direction: 'earn'",
        'clientRewardIgnored: true',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
      ]);
      if (missing.length) {
        return fail('Daily Calendar streak reward ledger/schema source is incomplete.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('Daily Calendar streak reward has a dedicated DiamondTransaction source and server-side 200-Diamond claim path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('legacy_cleanup_function_safe_scope',
    'Legacy cleanup function is admin-gated, dry-run by default, and scoped to legacy daily quest data',
    () => {
      const missing = missingTokens(cleanupLegacyDailyQuestsSource, [
        'cleanupLegacyDailyQuests',
        'requireAdmin',
        'AdminUser',
        "mode: 'dry_run'",
        'DELETE_LEGACY_DAILY_QUESTS',
        'legacyDefinitionRows',
        'legacyProgressRows',
        'daily_calendar:',
        'protectedEntities',
        'DailyWheelSpin',
        'DiamondTransaction',
        'UserJokerInventory',
        'Friendship',
      ]);
      const forbidden = forbiddenTokens(cleanupLegacyDailyQuestsSource, [
        'User.delete',
        'GuestProfile.delete',
        'DiamondTransaction.delete',
        'DailyWheelSpin.delete',
        'Friendship.delete',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Legacy Daily Quest cleanup can delete broad data or lacks dry-run/admin safeguards.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/cleanupLegacyDailyQuests/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('cleanupLegacyDailyQuests provides the required dry-run/delete path without touching unrelated systems.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('legacy_definition_callable_guarded_not_runtime_ui',
    'Old definition callable remains AdminUser-guarded and unmounted from runtime/Admin UI',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'requireAdmin(base44)',
        'asServiceRole?.entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
      ]);
      const forbidden = forbiddenTokens(`${adminPageSource}\n${appSource}\n${runtimeSources}`, [
        '<DailyQuestDefinitionManager',
        'Günlük Görev Yönetimi',
        'listDailyQuestDefinitions()',
        'seedDailyQuestDefinitions(',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Legacy definition tools can leak into runtime or lose admin guard.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Legacy definition callable is still guarded, while active runtime/Admin UI does not mount old definition management.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('docs_state_replacement_not_parallel_runtime',
    'Docs state that legacy Daily Quest was replaced, not run in parallel',
    () => {
      const missing = missingTokens(docsCombined, [
        'legacy Daily Quest',
        'replaced by Daily Calendar / Streak',
        'Home GÜNLÜK shortcut',
        'cleanupLegacyDailyQuests',
        'daily_calendar_streak_reward',
        '200 Diamonds',
      ]);
      const forbidden = forbiddenTokens(docsCombined, [
        'Daily Quest Runtime v1 is active',
        'Home Görevler Daily Quest copy is',
        'daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Docs still imply old Daily Quest runtime is active or omit cleanup/replacement contract.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Docs describe the Daily Calendar replacement and scoped legacy cleanup path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_no_definition_bloat_proof_manual',
    'Legacy definition cleanup/live DB proof remains manual',
    () => notAutomatable(
      'Static Health verifies runtime ignores old DailyQuestDefinition rows and cleanupLegacyDailyQuests is scoped. Live proof still requires admin dry-run counts and, after explicit approval, production cleanup execution in Base44.',
      {
        verification: 'BACKEND_RUNTIME_PROBE',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
        nextStep: 'Run cleanupLegacyDailyQuests dry_run in Base44 Admin, verify counts, then use DELETE_LEGACY_DAILY_QUESTS only for legacy Daily Quest rows.',
      },
    ),
    { critical: false, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
