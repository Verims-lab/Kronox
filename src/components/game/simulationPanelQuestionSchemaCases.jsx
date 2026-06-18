// Kronox Health Center — Question schema preparation contracts (Codex156).
//
// This suite protects the target Question schema cleanup for the new dataset
// while making sure current gameplay still receives safe runtime compatibility
// fields from the fetch layer.

import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';
import subCategoryEntitySource from '../../../base44/entities/SubCategory.jsonc?raw';
import questionEntitySource from '../../../base44/entities/Question.jsonc?raw';
import getCategoryMetadataSource from '../../../base44/functions/getCategoryMetadata/entry.ts?raw';
import getQuestionsFunctionSource from '../../../base44/functions/getQuestions/entry.ts?raw';
// Vite `?raw` cannot reach outside `src/` on this host, so the canonical
// markdown at docs/KRONOX_QUESTION_DATA_MODEL.md is mirrored into a JS module
// (lib/questionDataModelDoc) the runtime can import. Keep them in sync.
import { QUESTION_DATA_MODEL_DOC as questionSchemaDocSource } from '@/lib/questionDataModelDoc';
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

  makeCase('subcategory_entity_table_exists_schema_only',
    'SubCategory entity exists as a future normalized lookup table without migrating Question',
    () => {
      const schema = parseJsonSource(subCategoryEntitySource);
      const props = schema?.properties || {};
      const expectedFields = [
        'id',
        'main_category_1',
        'main_category_2',
        'name',
        'status',
        'description',
      ];
      const missingFields = expectedFields.filter((field) => !Object.prototype.hasOwnProperty.call(props, field));
      const numericCategoryRefs = props.main_category_1?.type === 'number' && props.main_category_2?.type === 'number';
      const statusEnum = Array.isArray(props.status?.enum) ? props.status.enum : [];
      const statusOk = statusEnum.includes('A') && statusEnum.includes('P') && props.status?.default === 'A';
      const required = Array.isArray(schema?.required) ? schema.required : [];
      const requiredOk = ['id', 'main_category_1', 'name'].every((field) => required.includes(field))
        && !required.includes('main_category_2');
      const rls = schema?.rls || {};
      const readPublic = rls.read && Object.keys(rls.read).length === 0;
      const writesAdminOnly = ['create', 'update', 'delete'].every((op) => rls?.[op]?.user_condition?.role === 'admin');
      const description = String(schema?.description || '');
      const documentedRefs = description.includes('Category.category_id')
        && String(props.main_category_1?.description || '').includes('Category.category_id')
        && String(props.main_category_2?.description || '').includes('Category.category_id');

      if (missingFields.length || !numericCategoryRefs || !statusOk || !requiredOk || !readPublic || !writesAdminOnly || !documentedRefs) {
        return fail('SubCategory schema is missing its additive lookup-table contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/SubCategory.jsonc',
          expected: 'id/main_category_1/main_category_2/name/status/description, numeric Category references, A/P status, public read, admin writes',
          actual: {
            missingFields,
            numericCategoryRefs,
            statusEnum,
            defaultStatus: props.status?.default,
            required,
            readPublic,
            writesAdminOnly,
            documentedRefs,
          },
        });
      }
      return pass('SubCategory entity exists with numeric Category references and schema-only migration boundary.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_subcategory_id_migration_deferred',
    'Question schema intentionally keeps free-text sub_category and does not add sub_category_id yet',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const props = schema?.properties || {};
      const hasSubCategoryText = props.sub_category?.type === 'string';
      const forbiddenFields = Object.keys(props).filter((field) => field === 'sub_category_id' || field === 'subcategory_id');
      const docMissing = missingTokens(questionSchemaDocSource, [
        'SubCategory exists as a future normalized lookup table',
        'Question currently still uses the existing free-text sub_category field',
        'Do not add sub_category_id',
      ]);
      if (!hasSubCategoryText || forbiddenFields.length || docMissing.length) {
        return fail('Question schema was migrated too early or docs do not state the deferred migration boundary.', {
          verification: 'STATIC_CONTRACT',
          files: ['base44/entities/Question.jsonc', 'docs/KRONOX_QUESTION_DATA_MODEL.md'],
          expected: 'Question keeps sub_category text and no sub_category_id field until a later task',
          actual: { hasSubCategoryText, forbiddenFields, docMissing },
        });
      }
      return pass('Question subcategory normalization is explicitly deferred; Question.sub_category remains unchanged.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_source_truth_is_current_category_metadata',
    'Category source of truth is current Category metadata, not fixed seed records',
    () => {
      const missing = missingTokens([
        getCategoryMetadataSource,
        getQuestionsFunctionSource,
        questionSchemaDocSource,
      ].join('\n'), [
        'base44.asServiceRole.entities.Category',
        'publicCategoryMetadata',
        'metadataOnly: true',
        'CATEGORY_METADATA_POLICY',
        'legacyHardcodedCategoryFallbackAllowed: false',
        'active Category rows',
      ]);
      const forbidden = [
        'QUESTION_CATEGORIES',
        'FALLBACK_ACTIVE_CATEGORY_IDS',
      ].filter((token) => [
        getCategoryMetadataSource,
        getQuestionsFunctionSource,
      ].join('\n').includes(token));
      if (missing.length || forbidden.length) {
        return fail('Category source-of-truth contract can still drift toward seed records or fallback IDs.', {
          verification: 'STATIC_CONTRACT',
          files: [
            'base44/functions/getCategoryMetadata/entry.ts',
            'base44/functions/getQuestions/entry.ts',
            'docs/KRONOX_QUESTION_DATA_MODEL.md',
          ],
          actual: { missing, forbidden },
        });
      }
      return pass('Current Category metadata and getQuestions policy are the source of truth; fixed seed records are not runtime policy.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_metadata_public_scope_is_safe',
    'Category metadata callable is public-safe and metadata-only',
    () => {
      const missing = missingTokens(getCategoryMetadataSource, [
        'guestCallableWithoutLogin: true',
        'responseFields: [\'category_id\', \'name\', \'description\', \'status\']',
        'rawQuestionRowsExposed: false',
        'answersExposed: false',
        'yearsExposed: false',
        'adminFieldsExposed: false',
      ]);
      const forbidden = [
        'Question.list',
        'Question.filter',
        'AdminUser',
      ].filter((token) => String(getCategoryMetadataSource || '').includes(token));
      if (missing.length || forbidden.length) {
        return fail('Category metadata callable is not locked to public-safe metadata only.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getCategoryMetadata/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Category metadata callable returns only current active metadata needed by guest/category UI.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('question_entity_contains_only_target_dataset_fields',
    'Question entity contains only the approved dataset fields (incl. SEO description)',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      // Approved Question schema fields. `description` is intentionally
      // retained as an approved optional SEO/content-metadata field — it is
      // not gameplay/answer-validation data, does not affect Solo/Online
      // question selection, difficulty, scoring, or leaderboard. Any field
      // NOT in this approved list is still rejected as schema drift, and any
      // missing required target field still fails, so Health stays strict.
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
        'description',
      ];
      const actual = Object.keys(schema?.properties || {});
      const missing = expected.filter((field) => !actual.includes(field));
      const extra = actual.filter((field) => !expected.includes(field));
      if (missing.length || extra.length) {
        return fail('Question schema has missing or unapproved fields.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          expected,
          actual,
          missing,
          extra,
        });
      }
      return pass('Question schema contains only the approved dataset fields, including the SEO description field.', {
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

  makeCase('question_category_ids_are_not_seed_capped',
    'Question category id fields are not capped to the original 1-6 seed set',
    () => {
      const schema = parseJsonSource(questionEntitySource);
      const props = schema?.properties || {};
      const checkedFields = ['main_category_id', 'second_category_id', 'third_category_id'];
      const cappedFields = checkedFields.filter((field) => Array.isArray(props?.[field]?.enum));
      const descriptionMissing = checkedFields.filter((field) => {
        const text = String(props?.[field]?.description || '').toLowerCase();
        return !text.includes('positive live category.category_id') && !text.includes('any positive live category.category_id');
      });
      if (cappedFields.length || descriptionMissing.length) {
        return fail('Question category fields can still look capped to stale seed IDs.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/entities/Question.jsonc',
          actual: { cappedFields, descriptionMissing },
        });
      }
      return pass('Question category fields accept any positive live Category.category_id instead of a stale 1-6 enum.', {
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
    'Gameplay still uses runtime values while active-category filtering is wired through the fetch/deck boundary',
    () => {
      const gameplaySource = [
        gamePageSource,
        gameRulesSource,
      ].join('\n');
      const forbidden = [
        'second_category_id',
        'third_category_id',
        'base44.entities.Question.list',
      ].filter((token) => gameplaySource.includes(token));
      const requiredRuntime = missingTokens(gameplaySource, [
        '.year',
        '.category',
        '.type',
        'allowedMainCategoryIds: activeCategoryIds',
      ]);
      if (forbidden.length || requiredRuntime.length) {
        return fail('Gameplay code bypasses the runtime adapter or active-category whitelist boundary.', {
          verification: 'STATIC_CONTRACT',
          expected: 'Gameplay consumes runtime year/category/type values and passes active category ids into the deck engine.',
          actual: { forbidden, requiredRuntime },
        });
      }
      return pass('Gameplay logic remains on runtime year/category/type values while active category filtering is enforced through the deck boundary.', {
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

  makeCase('category_metadata_runtime_verification_required',
    'Runtime DB probe: verify current active Category rows exist',
    () => notAutomatable('Static checks prove current metadata and gameplay read from Category, but live Base44 rows require deployed DB proof through getCategoryMetadata or direct admin DB inspection.', {
      verification: 'NOT_AUTOMATABLE',
      actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE,
      expected: 'Current intended active Category rows exist with category_id/name/description/status and no stale hardcoded seed fallback is used',
      actual: 'No live Base44 DB session in local build',
    }),
    { actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE, runtimeProofRequired: true }),
];
