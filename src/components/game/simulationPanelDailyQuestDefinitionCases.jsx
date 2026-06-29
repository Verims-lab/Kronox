// Kronox Health Center — Daily Quest canonical runtime/template contracts.
//
// Scope: the current Daily Quest model is code-owned runtime progress, not an
// Admin Ekranı definition manager. Legacy DailyQuestDefinition rows/functions
// may remain for historical/manual cleanup paths, but runtime must ignore them
// to prevent duplicate/empty DB definition bloat.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import dailyQuestEntitySource from '../../../base44/entities/DailyQuestDefinition.jsonc?raw';
import dailyQuestProgressEntitySource from '../../../base44/entities/UserDailyQuestProgress.jsonc?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyQuestRewardSource from '../../../base44/functions/claimDailyQuestReward/entry.ts?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import dailyWheelFunctionSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import gameSource from '../../pages/Game.jsx?raw';
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
    nextStep: options.nextStep || 'Keep Daily Quest Runtime v1 code-owned, Solo-completion-only, Diamond-only, and independent from legacy definition rows.',
    ...options,
    run,
  };
}

const docsCombined = `${releaseProofSource}\n${dbArchitectureSource}\n${securitySource}\n${soloEngineDocSource}`;
const runtimeSources = `${dailyQuestGatewaySource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`;
const definitionBoundarySources = `${dailyQuestEntitySource}\n${dailyQuestGatewaySource}\n${createDailyQuestDefinitionSource}\n${docsCombined}`;
const adminMountSources = `${profilePageSource}\n${adminPageSource}\n${appSource}`;

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('entity_exists',
    'Daily Quest no longer depends on active DB definition rows',
    () => {
      const missing = missingTokens(`${definitionBoundarySources}\n${runtimeSources}`, [
        'DailyQuestDefinition (legacy/admin-only; runtime ignores definition rows)',
        '"name": "DailyQuestDefinition"',
        'Legacy/admin-only Daily Quest template definitions',
        'adminDefinitionRowsIgnoredAtRuntime: true',
        'definitionRowsIgnoredAtRuntime: true',
        "seedMode: 'code_canonical_no_definition_seed'",
      ]);
      const forbidden = forbiddenTokens(getDailyQuestStatusSource, [
        'ensureDefaultDefinitions(base44)',
        "filter({ status: 'active' }",
        "created_by: 'system:daily_quest_runtime_seed'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime can still depend on active DailyQuestDefinition rows or seed DB bloat.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'src/lib/dbGateway/dailyQuestGateway.js',
            'base44/functions/getDailyQuestStatus/entry.ts',
            'base44/entities/DailyQuestDefinition.jsonc',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('Legacy DailyQuestDefinition is documented as non-runtime while getDailyQuestStatus uses the code-owned canonical quest.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('schema_core_fields_exist',
    'Canonical runtime template has explicit logic and reward fields',
    () => {
      const missing = missingTokens(`${dailyQuestGatewaySource}\n${getDailyQuestStatusSource}\n${dailyQuestProgressEntitySource}`, [
        'DAILY_QUEST_DEFINITION_CONTRACT',
        'canonicalQuestKey',
        'canonicalQuestType',
        'canonicalTitle',
        'canonicalDescription',
        'solo_level_completion_only',
        'quest_type',
        'target_value',
        'reward_diamonds',
        'solo_level_complete',
        'Solo’da Seviye Geç',
        'Bugün 1 Solo seviyesini tamamla.',
        'target_value: 1',
        'reward_diamonds: 20',
      ]);
      if (missing.length) {
        return fail('Canonical Daily Quest runtime template contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/lib/dbGateway/dailyQuestGateway.js', 'base44/functions/getDailyQuestStatus/entry.ts'],
          missing,
        });
      }
      return pass('Daily Quest Runtime v1 exposes a single canonical Solo completion template with explicit target/reward fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('supported_quest_type_enum',
    'Supported active quest_type enum is Solo level completion only',
    () => {
      const missing = missingTokens(`${dailyQuestGatewaySource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}`, [
        'DAILY_QUEST_V1_TYPES',
        "'solo_level_complete'",
        'QUEST_TYPES',
        'normalizeQuestType',
        'unsupported_daily_quest_event',
      ]);
      if (missing.length) {
        return fail('Daily Quest active enum can drift away from Solo level completion only.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing },
        });
      }
      return pass('Daily Quest Runtime v1 supports only solo_level_complete as the active executable quest type.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('title_description_display_only',
    'title/description are display-only',
    () => {
      const missing = missingTokens(`${dailyQuestGatewaySource}\n${dailyQuestProgressEntitySource}\n${docsCombined}`, [
        'Display-only',
        'title',
        'description',
        'textIsNeverParsedIntoLogic',
        'quest_type + target_value',
      ]);
      if (missing.length) return fail('Daily Quest display copy boundary is not explicit.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Daily Quest copy is display-only; executable logic is carried by quest_type + target_value.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('text_is_not_parsed_into_logic',
    'Daily Quest text is not parsed into executable logic',
    () => {
      const required = [
        'textIsNeverParsedIntoLogic',
        'noRegexParser',
        'noAiParser',
        'noNlpParser',
        'noArbitraryScripts',
        'quest_type + target_value',
      ];
      const forbidden = [
        'parseQuestText',
        'interpretQuestText',
        'eval(',
        'new Function',
        'openai',
        'gpt',
        'nlpParse',
      ];
      const missing = missingTokens(`${dailyQuestGatewaySource}\n${docsCombined}`, required);
      const foundForbidden = forbiddenTokens(runtimeSources, forbidden);
      if (missing.length || foundForbidden.length) {
        return fail('Daily Quest text may become executable or the no-parser contract is missing.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, foundForbidden },
        });
      }
      return pass('Daily Quest runtime uses explicit enum/target fields and has no text/AI/NLP parser path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('reward_is_diamonds_only',
    'Daily Quest reward is Diamonds only',
    () => {
      const missing = missingTokens(`${runtimeSources}\n${dailyQuestProgressEntitySource}\n${docsCombined}`, [
        'reward_diamonds',
        'daily_quest_reward',
        'Diamonds only',
        'does not grant Kronox Puan',
      ]);
      const forbidden = forbiddenTokens(runtimeSources, [
        'reward_puan',
        'kronox_puan_reward',
        'puan_reward',
        'leaderboard_delta',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest can drift away from Diamonds-only rewards.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest Runtime v1 grants Diamonds only through daily_quest_reward.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('no_kronox_puan_or_leaderboard_impact',
    'Daily Quest does not grant Kronox Puan or affect leaderboard',
    () => {
      const missing = missingTokens(`${runtimeSources}\n${docsCombined}`, [
        'noKronoxPuan',
        'noLeaderboardImpact',
        'does not grant Kronox Puan',
        'does not affect leaderboard',
      ]);
      const forbidden = forbiddenTokens(runtimeSources, [
        'kronox_puan_total',
        'total_kronox_score',
        'SoloLeaderboardEntry',
        'levelScore',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime can affect Puan/leaderboard.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest Runtime v1 is disconnected from Kronox Puan and leaderboard writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_ui_removed_from_admin_page',
    'Daily Quest admin monitor/add UI is not mounted in Admin Ekranı',
    () => {
      const missing = missingTokens(adminMountSources, [
        'Admin Ekranı',
        "navigate('/admin')",
        'path="/admin"',
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        'QuestionAnalyticsReportTool',
        'ResetUserProgressTool',
        'PullToRefresh',
      ]);
      const forbidden = forbiddenTokens(adminPageSource, [
        "import DailyQuestDefinitionManager",
        '<DailyQuestDefinitionManager />',
        'Günlük Görev Yönetimi',
        'questTypeOptions',
        'statusOptions',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Admin Ekranı either lost its gate/tools or restored removed Daily Quest manager UI.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Admin Ekranı remains gated and does not mount Daily Quest monitor/add UI.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('legacy_definition_backend_guarded_not_runtime_ui',
    'Legacy definition callable remains guarded and outside runtime UI',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'requireAdmin(base44)',
        'asServiceRole?.entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
        'isActiveStatus',
        'Admin yetkisi gerekli.',
      ]);
      const forbidden = forbiddenTokens(`${adminPageSource}\n${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}`, [
        '<DailyQuestDefinitionManager />',
        'listDailyQuestDefinitions',
        'createDailyQuestDefinition',
        'ensureSeedDefinitions(',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Legacy definition callable can leak into runtime/Admin UI or lose AdminUser guard.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Legacy definition callable is AdminUser-guarded and not used by runtime or mounted Admin UI.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('duplicate_definitions_grouped_and_warned',
    'Runtime ignores duplicate DailyQuestDefinition rows instead of creating or deleting them',
    () => {
      const missing = missingTokens(`${runtimeSources}\n${docsCombined}`, [
        'definitionRowsIgnoredAtRuntime: true',
        "seedMode: 'code_canonical_no_definition_seed'",
        'duplicate/empty DB definition',
        'manual cleanup',
      ]);
      const forbidden = forbiddenTokens(getDailyQuestStatusSource, [
        'deleteDailyQuestDefinition',
        '.delete(',
        'autoDeleteDuplicates',
        'ensureSeedDefinitions(',
        'DailyQuestDefinition.create',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime may create/delete definition rows or hide duplicate-definition bloat.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Runtime ignores stale/duplicate definition rows, creates no definition rows on app open, and leaves cleanup manual.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_progress_contract_documented_separate',
    'UserDailyQuestProgress runtime contract is documented separately from templates',
    () => {
      const missing = missingTokens(`${runtimeSources}\n${dailyQuestProgressEntitySource}\n${docsCombined}`, [
        'UserDailyQuestProgress',
        'Daily Quest Runtime v1 is active',
        'daily_quest_reward',
        'one claim per quest per UTC day',
        'claimDailyQuestReward',
      ]);
      const activeProgressEntity = safeStr(dailyQuestProgressEntitySource).includes('"name": "UserDailyQuestProgress"');
      const definitionMixedProgressEntity = safeStr(dailyQuestEntitySource).includes('"name": "UserDailyQuestProgress"');
      if (missing.length || !activeProgressEntity || definitionMixedProgressEntity) {
        return fail('Runtime progress/claim contract is missing or mixed into DailyQuestDefinition.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, activeProgressEntity, definitionMixedProgressEntity },
        });
      }
      return pass('User progress/claim is active in UserDailyQuestProgress and remains separate from legacy templates.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_remains_separate',
    'Daily Wheel remains separate from Daily Quest runtime',
    () => {
      const missing = missingTokens(`${docsCombined}\n${dailyWheelFunctionSource}`, [
        'Daily Wheel remains separate from Daily Quest definitions',
        'daily_wheel:<playerKey>:<YYYY-MM-DD>',
        'daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>',
      ]);
      const forbidden = forbiddenTokens(`${getDailyQuestStatusSource}\n${recordDailyQuestProgressSource}\n${claimDailyQuestRewardSource}`, [
        'DailyWheelSpin',
        'claimDailyWheelReward',
        'daily_wheel_last_claim_date',
      ]);
      if (missing.length || forbidden.length) {
        return fail('Daily Quest runtime can conflict with Daily Wheel state.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Quest runtime is separate from Daily Wheel fields and claim function.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_and_joker_inventory_unaffected',
    'Mağaza and Solo joker inventory remain unaffected',
    () => {
      const forbidden = forbiddenTokens(runtimeSources, [
        'purchaseJokerWithDiamonds',
        'JokerTransaction',
        'UserJokerInventory',
        'market_purchase',
      ]);
      if (forbidden.length) {
        return fail('Daily Quest runtime can affect Mağaza/Joker inventory contracts.', {
          verification: 'STATIC_CONTRACT',
          actual: { forbidden },
        });
      }
      return pass('Daily Quest runtime does not touch Mağaza or Joker inventory paths.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_runtime_uses_separate_progress_function',
    'Solo runtime progress uses the separate Daily Quest runtime function',
    () => {
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}`, [
        'recordDailyQuestProgress',
        "recordDailyQuestSoloEvent('solo_level_complete'",
        "questType: 'solo_level_complete'",
        'passed: true',
      ]);
      const forbidden = forbiddenTokens(gameSource, [
        'DailyQuestDefinition',
        'createDailyQuestDefinition',
        'daily_quest_reward',
        "eventType: 'start_solo_attempt'",
        "recordDailyQuestSoloEvent('correct_cards'",
        "recordDailyQuestSoloEvent('complete_solo_level'",
        "recordDailyQuestSoloEvent('use_joker'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('Solo runtime Daily Quest wiring can mix definition/admin/claim concerns.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/Game.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Solo runtime records progress through recordDailyQuestProgress and does not touch definition/admin/claim internals.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_no_definition_bloat_proof_manual',
    'Runtime DB definition-bloat proof remains manual',
    () => notAutomatable(
      'Static Health verifies runtime no longer reads/seeds DailyQuestDefinition rows. Live proof still requires opening Home with stale duplicate definition rows present and confirming getDailyQuestStatus creates/returns only one UserDailyQuestProgress row without creating DailyQuestDefinition rows.',
      {
        verification: 'BACKEND_RUNTIME_PROBE',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
        nextStep: 'In deployed Base44, keep duplicate legacy DailyQuestDefinition rows, open Home, then verify no new definition rows are created and only the canonical solo_level_complete progress row is active.',
      },
    ),
    { critical: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
