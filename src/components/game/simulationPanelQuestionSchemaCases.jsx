// Kronox Health Center — Question schema preparation contracts (Codex156).
//
// This suite protects the target Question schema cleanup for the new dataset
// while making sure current gameplay still receives safe runtime compatibility
// fields from the fetch layer.

import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import getQuestionsFunctionSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import questionSchemaDocSource from '../../../docs/KRONOX_QUESTION_DATA_MODEL.md?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import gameRulesSource from '../../lib/gameRules.js?raw';
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';
import questionRuntimeAdapterSource from '../../lib/questionRuntimeAdapter.js?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  BACKEND_RUNTIME_PROBE: 'BACKEND_RUNTIME_PROBE',
};

const SUITE_ID = 'question_schema_preparation_health';
const SUITE_NAME = 'Question Schema Preparation Suite';

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
function notAutomatable(reason, extra) {
  return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function parseJsonSource(source) {
  try {
    return JSON.parse(String(source || '{}'));
  } catch {
    return {};
  }
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#0ea5e9' },
];

export const EXTRA_TESTS = [
  makeCase('category_entity_table_exists',
    'Category entity exists with fixed numeric category_id and display name fields',
    () => {
      const missing = missingTokens(categoryEntitySource, [
        '"name": "Category"',
        '"category_id"',
        '"name"',
        '"required"',
        '"category_id"',
        '"name"',
      ]);
      if (missing.length) {
        return fail('Category entity schema is missing required fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Category.jsonc',
          missing,
        });
      }
      return pass('Category entity schema exists and documents category_id/name.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_path_has_six_fixed_records',
    'Admin-only seed path contains the six fixed Kronox category records',
    () => {
      const missing = missingTokens(seedQuestionCategoriesSource, [
        'QUESTION_CATEGORIES',
        "category_id: 1, name: 'Chronicle'",
        "category_id: 2, name: 'Flashback'",
        "category_id: 3, name: 'Kült'",
        "category_id: 4, name: 'Viral'",
        "category_id: 5, name: 'Arena'",
        "category_id: 6, name: 'Level Up'",
        'base44.asServiceRole.entities.Category.filter',
        'base44.asServiceRole.entities.Category.create',
        'base44.asServiceRole.entities.Category.update',
      ]);
      if (missing.length) {
        return fail('Category seed path is missing fixed records or idempotent create/update behavior.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/seedQuestionCategories/entry.ts',
          missing,
        });
      }
      return pass('Category seed function is repeatable and contains the six fixed category rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_requires_admin',
    'Category seed function is server-side admin-only',
    () => {
      const missing = missingTokens(seedQuestionCategoriesSource, [
        'await base44.auth.me()',
        "user.role !== 'admin'",
        'user.email !== ADMIN_EMAIL',
        "Response.json(body, { status })",
      ]);
      if (missing.length) {
        return fail('Category seed path is not protected by the existing admin authorization pattern.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/seedQuestionCategories/entry.ts',
          missing,
        });
      }
      return pass('Category seed path requires authenticated admin context.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_entity_contains_only_target_dataset_fields',
    'Question entity contains only the intended new dataset fields',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const expected = [
        'id',
        'question',
        'answer',
        'main_category_id',
        'second_category_id',
        'third_category_id',
        'sub_category',
        'tag',
        'region',
        'difficulty',
        'state',
      ];
      const actual = Object.keys(schema?.properties || {});
      const missing = expected.filter((field) => !actual.includes(field));
      const extra = actual.filter((field) => !expected.includes(field));
      if (missing.length || extra.length) {
        return fail('Question schema has missing or legacy fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          expected,
          actual,
          missing,
          extra,
        });
      }
      return pass('Question schema contains only the target new dataset fields.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_entity_required_fields_match_import_contract',
    'Question entity required fields match the new CSV import contract',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const expected = ['id', 'question', 'answer', 'main_category_id', 'difficulty', 'state'];
      const actual = schema?.required || [];
      const missing = expected.filter((field) => !actual.includes(field));
      const extra = actual.filter((field) => !expected.includes(field));
      if (missing.length || extra.length) {
        return fail('Question schema required fields do not match the new import contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          expected,
          actual,
          missing,
          extra,
        });
      }
      return pass('Question schema requires id/question/answer/main_category_id/difficulty/state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('legacy_question_fields_removed_from_schema',
    'Legacy Question fields are removed from the entity schema',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const actual = Object.keys(schema?.properties || {});
      const forbidden = [
        'year',
        'category',
        'type',
        'media_url',
        'icon_url',
        'question_numeric_id',
        'answerYear',
        'correctYear',
      ].filter((field) => actual.includes(field));
      if (forbidden.length) {
        return fail('Legacy Question fields are still present in the entity schema.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          forbidden,
        });
      }
      return pass('Legacy year/category/type/media fields are no longer part of Question schema.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_difficulty_and_state_contract_documented',
    'Question difficulty is documented as 1-5 and state as A/P',
    () => {
      const missing = missingTokens(questionEntitySource, [
        '1',
        '2',
        '3',
        '4',
        '5',
        '"A"',
        '"P"',
        'A = Active, P = Passive',
      ]);
      if (missing.length) {
        return fail('Question difficulty/state future contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          missing,
        });
      }
      return pass('Question schema documents difficulty 1-5 and A/P state.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_runtime_answer_to_year_adapter_exists',
    'Question fetch layer derives runtime timeline year from answer',
    () => {
      const missing = missingTokens([
        questionRuntimeAdapterSource,
        useOfflineQuestionsSource,
        getQuestionsFunctionSource,
      ].join('\n'), [
        'getTimelineYearFromAnswer',
        'normalizeQuestionForRuntime',
        'normalizeQuestionsForRuntime',
        'answer',
        'year',
        "category: question.category || 'genel'",
        "type: question.type || 'metin'",
      ]);
      if (missing.length) {
        return fail('Question runtime compatibility mapping is missing.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Fetch layer derives runtime year from answer and supplies category/type defaults.',
          missing,
        });
      }
      return pass('Question fetch layer derives runtime year from answer and supplies compatibility defaults.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('gameplay_rules_not_changed_for_schema_cleanup',
    'Gameplay rules still operate on runtime year/category/type values supplied by the fetch adapter',
    () => {
      const gameplaySource = [
        gamePageSource,
        gameRulesSource,
      ].join('\n');
      const forbidden = [
        'main_category_id',
        'second_category_id',
        'third_category_id',
        "state === 'A'",
      ].filter((token) => gameplaySource.includes(token));
      const requiredLegacy = missingTokens(gameplaySource, [
        '.year',
        '.category',
        '.type',
      ]);
      if (forbidden.length || requiredLegacy.length) {
        return fail('Gameplay rule/filter code was changed to read new schema fields directly.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Gameplay still uses runtime year/category/type and not category-id/state filters.',
          actual: { forbidden, requiredLegacy },
        });
      }
      return pass('Gameplay logic remains on runtime year/category/type values; schema translation is fetch-layer only.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_schema_cleanup_doc_exists',
    'Question data model doc describes removed fields and compatibility layer',
    () => {
      const missing = missingTokens(questionSchemaDocSource, [
        'Removed legacy schema fields',
        '`year`',
        '`category`',
        '`type`',
        '`media_url`',
        '`icon_url`',
        'Runtime Compatibility Note',
        'questionRuntimeAdapter.js',
      ]);
      if (missing.length) {
        return fail('Question data model doc does not explain the schema cleanup boundary.', {
          verification: 'STATIC_CONTRACT',
          file: 'docs/KRONOX_QUESTION_DATA_MODEL.md',
          missing,
        });
      }
      return pass('Question data model doc records removed fields and compatibility mapping.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_runtime_verification_required',
    'Runtime DB probe: verify six Category rows exist after deployment seed',
    () => notAutomatable('Static checks prove the entity and seed path exist, but live Base44 rows require running POST /seedQuestionCategories as admin and verifying Category rows in the deployed DB.', {
      verification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Category rows 1..6 exist exactly as Chronicle, Flashback, Kült, Viral, Arena, Level Up',
      actual: 'No live Base44 DB session in local build',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
