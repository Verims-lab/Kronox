// Kronox Health Center — Question schema preparation contracts (Codex155).
//
// This suite protects the DB/entity preparation for the future question
// dataset while making sure current gameplay has not been switched to the
// new category-id fields prematurely.

import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import seedQuestionCategoriesSource from '../../../base44/functions/seedQuestionCategories/entry.ts?raw';
import questionSchemaDocSource from '../../../docs/KRONOX_QUESTION_DATA_MODEL.md?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import gameRulesSource from '../../lib/gameRules.js?raw';
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';

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

  makeCase('question_entity_supports_future_dataset_fields',
    'Question entity supports future answer/category metadata fields without changing gameplay',
    () => {
      const missing = missingTokens(questionEntitySource, [
        '"answer"',
        '"question_numeric_id"',
        '"main_category_id"',
        '"second_category_id"',
        '"third_category_id"',
        '"sub_category"',
        '"tag"',
        '"region"',
        '"difficulty"',
        '"state"',
      ]);
      if (missing.length) {
        return fail('Question schema is missing future dataset fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          missing,
        });
      }
      return pass('Question schema supports future answer/category metadata fields.', {
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

  makeCase('base44_question_id_conflict_documented',
    'Future numeric question ID does not overwrite runtime Base44 Question.id',
    () => {
      const missing = missingTokens(questionSchemaDocSource, [
        'Base44 already provides `Question.id`',
        'question_numeric_id',
        'Do not overwrite runtime `Question.id`',
      ]);
      if (missing.length) {
        return fail('Question numeric ID transition is not documented safely.', {
          verification: 'STATIC_CONTRACT',
          file: 'docs/KRONOX_QUESTION_DATA_MODEL.md',
          missing,
        });
      }
      return pass('Question numeric ID transition documents the Base44 row-id boundary.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('gameplay_not_switched_to_new_question_schema_yet',
    'Gameplay still uses legacy year/category/type selectors until migration is explicitly requested',
    () => {
      const gameplaySource = [
        gamePageSource,
        gameRulesSource,
        useOfflineQuestionsSource,
      ].join('\n');
      const forbidden = [
        'main_category_id',
        'second_category_id',
        'third_category_id',
        "state === 'A'",
        'question_numeric_id',
      ].filter((token) => gameplaySource.includes(token));
      const requiredLegacy = missingTokens(gameplaySource, [
        '.year',
        '.category',
        '.type',
      ]);
      if (forbidden.length || requiredLegacy.length) {
        return fail('Gameplay appears to have been switched to the future question schema in this prep-only task.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Current gameplay still uses year/category/type and not category-id/state filters.',
          actual: { forbidden, requiredLegacy },
        });
      }
      return pass('Current gameplay remains on the legacy question selection fields.', {
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
