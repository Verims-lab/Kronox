// Kronox Health Center — Daily Quest Definition and Runtime boundary contracts.
//
// Scope: DailyQuestDefinition schema, admin-only Admin Ekranı management, strict
// quest_type enum logic, display-only admin copy, idempotent starter templates,
// and separation from the active UserDailyQuestProgress reward runtime.

import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import appSource from '../../App.jsx?raw';
import dailyQuestManagerSource from '../admin/DailyQuestDefinitionManager.jsx?raw';
import dailyQuestDefinitionListSource from '../admin/DailyQuestDefinitionList.jsx?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import dailyQuestEntitySource from '../../../base44/entities/DailyQuestDefinition.jsonc?raw';
import createDailyQuestDefinitionSource from '../../../base44/functions/createDailyQuestDefinition/entry.ts?raw';
import dailyWheelFunctionSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import marketFunctionSource from '../../../base44/functions/purchaseJokerWithDiamonds/entry.ts?raw';
import gameSource from '../../pages/Game.jsx?raw';
import releaseProofSource from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import dbArchitectureSource from '../../../docs/KRONOX_DB_ARCHITECTURE.md?raw';
import securitySource from '../../../docs/KRONOX_SECURITY_DEPLOYMENT.md?raw';
import soloEngineDocSource from '../../../docs/KRONOX_SOLO_QUESTION_ENGINE.md?raw';

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
    nextStep: options.nextStep || 'Keep Daily Quest definitions admin-managed, enum/template-based, Diamond-only, and separate from runtime progress until later phases.',
    ...options,
    run,
  };
}

const docsCombined = `${releaseProofSource}\n${dbArchitectureSource}\n${securitySource}\n${soloEngineDocSource}`;
const dailyQuestManagerUiSource = `${dailyQuestManagerSource}\n${dailyQuestDefinitionListSource}`;
const adminSources = `${profilePageSource}\n${adminPageSource}\n${appSource}\n${dailyQuestManagerUiSource}\n${dailyQuestGatewaySource}\n${createDailyQuestDefinitionSource}`;
const definitionSources = `${dailyQuestEntitySource}\n${dailyQuestGatewaySource}\n${createDailyQuestDefinitionSource}\n${docsCombined}`;

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('entity_exists',
    'DailyQuestDefinition entity/table exists',
    () => {
      const missing = missingTokens(dailyQuestEntitySource, [
        '"name": "DailyQuestDefinition"',
        'Admin-managed Daily Quest v1 template definitions',
      ]);
      if (missing.length) return fail('DailyQuestDefinition schema is missing.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/entities/DailyQuestDefinition.jsonc',
        missing,
      });
      return pass('DailyQuestDefinition exists as the admin-managed template entity.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('schema_core_fields_exist',
    'DailyQuestDefinition has required template fields',
    () => {
      const missing = missingTokens(dailyQuestEntitySource, [
        '"quest_key"',
        '"title"',
        '"description"',
        '"quest_type"',
        '"target_value"',
        '"reward_diamonds"',
        '"status"',
        '"sort_order"',
        '"created_by"',
        '"updated_by"',
      ]);
      if (missing.length) return fail('DailyQuestDefinition is missing required fields.', {
        verification: 'STATIC_CONTRACT',
        file: 'base44/entities/DailyQuestDefinition.jsonc',
        missing,
      });
      return pass('DailyQuestDefinition includes quest key, display copy, logic enum, target/reward, status, order, and audit fields.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('quest_key_is_stable_machine_key',
    'quest_key is stable lowercase machine-readable key',
    () => {
      const missing = missingTokens(`${dailyQuestEntitySource}\n${createDailyQuestDefinitionSource}\n${dailyQuestManagerSource}`, [
        '"pattern": "^[a-z0-9_]+$"',
        'normalizeQuestKey',
        'start_1_solo_attempt',
        'correct_5_cards',
        'complete_1_solo_level',
        'use_1_joker',
      ]);
      if (missing.length) return fail('quest_key is not clearly normalized and seeded as a stable machine key.', { verification: 'STATIC_CONTRACT', missing });
      return pass('quest_key is constrained to lowercase machine-readable keys and initial keys are stable.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('supported_quest_type_enum',
    'Supported quest_type enum includes all v1 types',
    () => {
      const missing = missingTokens(definitionSources, [
        '"start_solo_attempt"',
        '"correct_cards"',
        '"complete_solo_level"',
        '"use_joker"',
        'DAILY_QUEST_V1_TYPES',
      ]);
      if (missing.length) return fail('Supported Daily Quest v1 quest_type enum is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Daily Quest v1 supports only the four approved quest_type values.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('quest_type_dropdown_not_free_text',
    'quest_type is enum/dropdown, not arbitrary free text',
    () => {
      const missing = missingTokens(`${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}`, [
        'KronoxSelectSheet',
        'questTypeOptions',
        'DAILY_QUEST_V1_TYPES.map',
        'normalizeQuestType',
        'QUEST_TYPES.includes',
        'invalid_quest_type',
      ]);
      const forbidden = forbiddenTokens(dailyQuestManagerSource, [
        'name="quest_type"',
        'placeholder="Görev Tipi"',
      ]);
      if (missing.length || forbidden.length) return fail('quest_type can drift toward arbitrary free text instead of enum/dropdown validation.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/components/admin/DailyQuestDefinitionManager.jsx', 'base44/functions/createDailyQuestDefinition/entry.ts'],
        actual: { missing, forbidden },
      });
      return pass('quest_type is selected from the Kronox bottom-sheet enum control and revalidated by backend enum.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('positive_target_and_reward_contract',
    'target_value and reward_diamonds minimum is 1',
    () => {
      const missing = missingTokens(`${dailyQuestEntitySource}\n${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}`, [
        '"minimum": 1',
        'min="1"',
        'target_value < 1',
        'reward_diamonds < 1',
        'Hedef ve ödül 1 veya daha büyük olmalı.',
      ]);
      if (missing.length) return fail('Daily Quest target/reward positive integer validation is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('target_value and reward_diamonds are positive integer contracts in schema, UI, and backend.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('status_active_passive_contract',
    'status supports active/passive and admin status updates',
    () => {
      const missing = missingTokens(`${dailyQuestEntitySource}\n${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}`, [
        '"active"',
        '"passive"',
        'update_status',
        'updateDailyQuestDefinitionStatus',
        'Aktif',
        'Pasif',
      ]);
      if (missing.length) return fail('Daily Quest status active/passive management is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Definitions support active/passive status and admin status toggles.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('title_description_display_only',
    'title/description are display-only',
    () => {
      const missing = missingTokens(`${definitionSources}\n${dailyQuestManagerSource}`, [
        'titleDescriptionDisplayOnly',
        'title and description are display-only',
        'Admin metni yalnızca gösterim içindir',
        'Başlık ve açıklama çalıştırılmaz',
      ]);
      if (missing.length) return fail('Daily Quest display copy boundary is not explicit.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Daily Quest title/description are explicitly display-only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('text_is_not_parsed_into_logic',
    'Admin text is not parsed into executable logic',
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
      const missing = missingTokens(`${definitionSources}\n${dailyQuestManagerSource}`, required);
      const foundForbidden = forbiddenTokens(`${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}\n${dailyQuestGatewaySource}`, forbidden);
      if (missing.length || foundForbidden.length) return fail('Admin text may become executable or the no-parser contract is missing.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, foundForbidden },
      });
      return pass('Admin-entered copy is not parsed by AI/NLP/free-text/parser paths; quest_type + target_value are the only logic contract.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('reward_is_diamonds_only',
    'Daily Quest reward is Diamonds only',
    () => {
      const missing = missingTokens(`${definitionSources}\n${dailyQuestManagerSource}`, [
        '"reward_diamonds"',
        'reward_diamonds',
        'Diamonds only',
        'Ödül yalnızca Elmas',
      ]);
      const forbidden = forbiddenTokens(`${dailyQuestEntitySource}\n${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}`, [
        'reward_puan',
        'kronox_puan_reward',
        'puan_reward',
        'leaderboard_delta',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest definitions can drift away from Diamonds-only rewards.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest definitions expose reward_diamonds only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('no_kronox_puan_or_leaderboard_impact',
    'Daily Quest does not grant Kronox Puan or affect leaderboard',
    () => {
      const missing = missingTokens(definitionSources, [
        'noKronoxPuan',
        'noLeaderboardImpact',
        'does not grant Kronox Puan',
        'does not affect leaderboard',
      ]);
      const forbidden = forbiddenTokens(`${dailyQuestManagerSource}\n${createDailyQuestDefinitionSource}`, [
        'kronox_puan_total',
        'total_kronox_score',
        'SoloLeaderboardEntry',
        'levelScore',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest definition path can affect Puan/leaderboard.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Definition management is disconnected from Kronox Puan and leaderboard writes.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_ui_under_profile_settings',
    'Admin-only management UI exists under Profile/Admin Ekranı',
    () => {
      const missing = missingTokens(`${profilePageSource}\n${adminPageSource}\n${appSource}\n${dailyQuestManagerUiSource}`, [
        'Admin Ekranı',
        "navigate('/admin')",
        'path="/admin"',
        "import DailyQuestDefinitionManager",
        '<DailyQuestDefinitionManager />',
        'DailyQuestDefinitionList',
        'Günlük Görev Yönetimi',
        'Tanımlı Görevler',
        'Yeni Görev Ekle',
      ]);
      if (missing.length) return fail('Daily Quest management UI is not mounted under Admin Ekranı.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Profile Admin Ekranı includes Günlük Görev Yönetimi and the split Tanımlı Görevler list.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('normal_users_cannot_see_admin_ui',
    'Normal users cannot see Daily Quest management UI',
    () => {
      const managerIdx = safeStr(adminPageSource).indexOf('<DailyQuestDefinitionManager />');
      const deniedIdx = safeStr(adminPageSource).indexOf('if (!isAdmin)');
      const missing = missingTokens(`${profilePageSource}\n${adminPageSource}\n${createDailyQuestDefinitionSource}`, [
        'const isAdmin = parsedAdminStatus',
        'if (!isAdmin)',
        '{isAdmin &&',
        'requireAdmin(base44)',
        'Admin yetkisi gerekli.',
      ]);
      const gated = managerIdx >= 0 && deniedIdx >= 0 && deniedIdx < managerIdx;
      if (missing.length || !gated) return fail('Daily Quest management may be visible without active admin status.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, gated },
      });
      return pass('Daily Quest management is inside the admin-only Admin Ekranı and backend guarded.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_can_list_definitions',
    'Admin can list existing definitions',
    () => {
      const missing = missingTokens(`${dailyQuestManagerSource}\n${dailyQuestGatewaySource}\n${createDailyQuestDefinitionSource}`, [
        'listDailyQuestDefinitions',
        "{ action: 'list' }",
        "if (action === 'list')",
        'listDefinitions(entity)',
        'definitions',
      ]);
      if (missing.length) return fail('Admin definition listing path is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Admin UI lists definitions through the admin-guarded callable.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_can_create_definition',
    'Admin can create a new Daily Quest definition',
    () => {
      const missing = missingTokens(`${dailyQuestManagerSource}\n${dailyQuestGatewaySource}\n${createDailyQuestDefinitionSource}`, [
        'createDailyQuestDefinition',
        "{ ...payload, action: 'create' }",
        "if (action !== 'create')",
        'entity.create',
        'Günlük görev kaydedildi.',
      ]);
      if (missing.length) return fail('Admin definition creation path is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Admin UI creates DailyQuestDefinition rows through backend validation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('creation_validates_quest_type',
    'Creation validates quest_type',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'normalizeQuestType',
        'QUEST_TYPES.includes',
        'invalid_quest_type',
        'Geçerli bir görev tipi seçin.',
      ]);
      if (missing.length) return fail('Backend quest_type validation is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Backend rejects unsupported quest_type values.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('creation_validates_positive_numbers',
    'Creation validates target_value and reward_diamonds',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'target_value < 1',
        'reward_diamonds < 1',
        'invalid_positive_numbers',
        'Hedef ve ödül 1 veya daha büyük olmalı.',
      ]);
      if (missing.length) return fail('Backend target/reward validation is incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Backend rejects target_value/reward_diamonds below 1.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('quest_key_duplicate_rejected',
    'Duplicate quest_key is rejected where possible',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'findDefinitionsByKey',
        'duplicate_quest_key',
        'Bu görev anahtarı zaten var.',
      ]);
      if (missing.length) return fail('Duplicate quest_key guard is missing.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Creation checks existing quest_key before create and reports duplicate key safely.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('no_hardcoded_admin_allowlist',
    'No hardcoded admin email allowlist',
    () => {
      const forbidden = forbiddenTokens(adminSources, [
        '@gmail.com',
        'ADMIN_EMAILS',
        'adminAllowlist',
        'ownerEmail',
      ]);
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'entities?.AdminUser',
        "value === 'owner' || value === 'admin'",
        'isActiveStatus',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest admin management can drift to hardcoded/admin-list auth.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest definition writes use AdminUser, not hardcoded admin emails.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('seed_definitions_idempotent',
    'Seed definitions are idempotent',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'DEFAULT_DEFINITIONS',
        'ensureSeedDefinitions',
        'findDefinitionsByKey(entity, seed.quest_key)',
        'if (existing.length)',
        'existingKeys.has(seed.quest_key)',
        "seedMode: 'list_only_no_seed'",
        'seededKeys',
      ]);
      if (missing.length) return fail('Initial Daily Quest seed path is missing or not idempotent by quest_key.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Initial definitions seed idempotently by quest_key.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('duplicate_definitions_grouped_and_warned',
    'Admin UI groups duplicate quest_key rows and warns instead of rendering repeated cards',
    () => {
      const combined = `${dailyQuestManagerUiSource}\n${createDailyQuestDefinitionSource}\n${docsCombined}`;
      const missing = missingTokens(combined, [
        'groupDefinitionsByQuestKey',
        'canonicalDefinitionSort',
        'duplicateGroups',
        'duplicateDefinitionCount',
        'duplicate_count',
        'canonical_definition_id',
        'Yinelenen görev tanımı kayıtları var',
        'yinelenen kayıt',
        'manuel DB temizliği',
        'cleanupRecommendation',
      ]);
      const forbidden = forbiddenTokens(createDailyQuestDefinitionSource, [
        'deleteDailyQuestDefinition',
        '.delete(',
        'autoDeleteDuplicates',
      ]);
      if (missing.length || forbidden.length) return fail('Duplicate DailyQuestDefinition rows can still render as repeated cards or be auto-deleted unsafely.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/components/admin/DailyQuestDefinitionManager.jsx', 'base44/functions/createDailyQuestDefinition/entry.ts'],
        actual: { missing, forbidden },
      });
      return pass('Admin list returns one canonical row per quest_key, warns about duplicate rows, and leaves cleanup manual.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('initial_definitions_match_phase_1_examples',
    'Initial active Solo-focused definitions exist',
    () => {
      const missing = missingTokens(createDailyQuestDefinitionSource, [
        'Solo’ya Başla',
        'Bugün 1 Solo oyunu başlat.',
        '5 Kart Doğru Yerleştir',
        'Bugün 5 kartı doğru yerleştir.',
        '1 Level Tamamla',
        'Bugün 1 Solo level tamamla.',
        '1 Joker Kullan',
        'Bugün 1 joker kullan.',
        'reward_diamonds: 20',
        'reward_diamonds: 30',
        'reward_diamonds: 50',
      ]);
      if (missing.length) return fail('Initial Daily Quest definitions do not match the Phase 1 examples.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Initial Daily Quest definitions are the requested Solo-focused templates.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('runtime_progress_contract_documented_separate',
    'UserDailyQuestProgress runtime contract is documented separately from definitions',
    () => {
      const missing = missingTokens(`${definitionSources}\n${docsCombined}`, [
        'UserDailyQuestProgress',
        'Daily Quest Runtime v1 is active',
        'daily_quest_reward',
        'one claim per quest per UTC day',
      ]);
      const activeProgressEntity = safeStr(dailyQuestEntitySource).includes('"name": "UserDailyQuestProgress"');
      if (missing.length || activeProgressEntity) return fail('Runtime progress/claim contract is missing or mixed into DailyQuestDefinition.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, activeProgressEntity },
      });
      return pass('User progress/claim is active in UserDailyQuestProgress and remains separate from DailyQuestDefinition templates.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_remains_separate',
    'Daily Wheel remains separate from Daily Quest definitions',
    () => {
      const missing = missingTokens(`${docsCombined}\n${createDailyQuestDefinitionSource}`, [
        'Daily Wheel remains separate from Daily Quest definitions',
        'daily_wheel:<email>:<YYYY-MM-DD>',
        'daily_quest_reward:<email>:<YYYY-MM-DD>:<quest_key>',
      ]);
      const forbidden = forbiddenTokens(createDailyQuestDefinitionSource, [
        'DailyWheelSpin',
        'claimDailyWheelReward',
        'daily_wheel_last_claim_date',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Quest definitions can conflict with Daily Wheel state.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Quest definitions are separate from Daily Wheel fields and claim function.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('market_and_joker_inventory_unaffected',
    'Mağaza and Solo joker inventory remain unaffected',
    () => {
      const forbidden = forbiddenTokens(createDailyQuestDefinitionSource, [
        'purchaseJokerWithDiamonds',
        'JokerTransaction',
        'UserJokerInventory',
        'market_purchase',
      ]);
      const marketStillHasProducts = missingTokens(marketFunctionSource, [
        'Zaman Dondur',
        'Kart Değiştir',
        'Kronokalkan',
        'market_purchase',
      ]);
      if (forbidden.length || marketStillHasProducts.length) return fail('Daily Quest definition work can affect Mağaza/Joker inventory contracts.', {
        verification: 'STATIC_CONTRACT',
        actual: { forbidden, marketStillHasProducts },
      });
      return pass('Daily Quest definition function does not touch Mağaza or Joker inventory paths.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_runtime_uses_separate_progress_function',
    'Solo runtime progress uses the separate Daily Quest runtime function',
    () => {
      const missing = missingTokens(gameSource, [
        'recordDailyQuestProgress',
        "eventType: 'start_solo_attempt'",
        "recordDailyQuestSoloEvent('correct_cards'",
        "recordDailyQuestSoloEvent('complete_solo_level'",
        "recordDailyQuestSoloEvent('use_joker'",
      ]);
      const forbidden = forbiddenTokens(gameSource, [
        'DailyQuestDefinition',
        'createDailyQuestDefinition',
        'daily_quest_reward',
      ]);
      if (missing.length || forbidden.length) return fail('Solo runtime Daily Quest wiring can mix definition/admin/claim concerns.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/pages/Game.jsx',
        actual: { missing, forbidden },
      });
      return pass('Solo runtime records progress through recordDailyQuestProgress and does not touch definition/admin/claim internals.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('daily_wheel_function_unaffected',
    'Daily Wheel claim function stays Diamond-only and unrelated',
    () => {
      const forbidden = forbiddenTokens(dailyWheelFunctionSource, [
        'DailyQuestDefinition',
        'daily_quest_reward',
        'reward_diamonds',
      ]);
      const missing = missingTokens(dailyWheelFunctionSource, [
        'DAILY_WHEEL_SOURCE',
        'DiamondTransaction',
        'noKronoxPuan',
      ]);
      if (missing.length || forbidden.length) return fail('Daily Wheel claim path drifted toward Daily Quest definitions.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Daily Wheel claim function remains separate and Diamond-only.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_runtime_proof_manual',
    'Runtime admin authorization proof remains manual',
    () => notAutomatable(
      'Static Health can verify the AdminUser-backed function contract and Admin Ekranı visibility. Runtime proof still requires calling createDailyQuestDefinition as an active admin, a normal user, and a disabled/passive admin, then confirming 200/403 behavior in the deployed backend.',
      {
        verification: 'BACKEND_RUNTIME_PROBE',
        actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
        nextStep: 'As active admin, open Admin Ekranı / Günlük Görev Yönetimi and create a test passive definition; as normal user verify the UI is hidden and backend returns 403.',
      },
    ),
    { critical: true, actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
