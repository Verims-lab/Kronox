// Kronox Health Center — Category status & description contracts
// (Codex158 / Codex159 hardening).
//
// Locks in the new Category entity fields and their UI filtering rule:
//   • Category schema declares `status` (enum: a/p, default a) and
//     `description` (string, default "").
//   • Seed path (functions/seedQuestionCategories.js) writes status='a'
//     and a non-empty description for all six fixed categories.
//   • A shared `lib/categoryFilters.js` helper is the single source of
//     truth for "is this category active in UI?" so any future Online/
//     Solo category selection surface that reads the Category DB lookup
//     table filters passive rows out without rolling its own logic.
//
// Codex159 — TypeError hardening:
//   The `entities/Category.json` file is persisted as a Python-style
//   dict literal on this platform (single quotes), so a `?raw` import
//   either returns a non-string object (template-string concat → throws
//   "Cannot convert object to primitive value") OR a string that
//   `JSON.parse` can't parse (→ schema lookups fail). We now read the
//   schema from a mirror in `simulationPanelContractStrings.jsx` and
//   safe-string everything before token scanning.

import seedQuestionCategoriesSource from '../../functions/seedQuestionCategories.js?raw';
import categoryFiltersSource from '../../lib/categoryFilters.js?raw';
import { categoryEntitySchema } from './simulationPanelContractStrings.jsx';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
};

const SUITE_ID = 'category_status_description_health';
const SUITE_NAME = 'Category Status & Description Suite';

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

// Codex159 — Defensive stringifier. `?raw` may return a non-string on
// edge platform builds; template concat / String() then throws "Cannot
// convert object to primitive value". Always go through this helper
// before token scanning so the Health case can never crash.
function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { /* fall through */ }
  try { return JSON.stringify(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#22d3ee' },
];

export const EXTRA_TESTS = [
  makeCase('category_entity_declares_status_field',
    'Category entity schema declares status (enum a/p, default a)',
    () => {
      const prop = categoryEntitySchema?.properties?.status;
      if (!prop) {
        return fail('Category schema is missing the `status` property.', {
          verification: 'STATIC_CONTRACT',
          file: 'entities/Category.json',
        });
      }
      const enumOk = Array.isArray(prop.enum)
        && prop.enum.includes('a')
        && prop.enum.includes('p');
      const defaultOk = prop.default === 'a';
      if (!enumOk || !defaultOk) {
        return fail('Category.status must be enum ["a","p"] with default "a".', {
          verification: 'STATIC_CONTRACT',
          file: 'entities/Category.json',
          actual: { enum: prop.enum, default: prop.default },
        });
      }
      return pass('Category.status declared with enum ["a","p"] and default "a".', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_entity_declares_description_field',
    'Category entity schema declares description (string, optional)',
    () => {
      const prop = categoryEntitySchema?.properties?.description;
      if (!prop) {
        return fail('Category schema is missing the `description` property.', {
          verification: 'STATIC_CONTRACT',
          file: 'entities/Category.json',
        });
      }
      if (prop.type !== 'string') {
        return fail('Category.description must be a string field.', {
          verification: 'STATIC_CONTRACT',
          file: 'entities/Category.json',
          actual: prop.type,
        });
      }
      const required = Array.isArray(categoryEntitySchema?.required) ? categoryEntitySchema.required : [];
      if (required.includes('description')) {
        return fail('Category.description must remain optional (not in required).', {
          verification: 'STATIC_CONTRACT',
          file: 'entities/Category.json',
        });
      }
      return pass('Category.description declared as optional string field.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_rows_all_active',
    'Seed path marks all six fixed categories as status="a"',
    () => {
      // Codex159 — Detect each (id,name,status='a') trio independently
      // instead of matching one exact concatenated literal. The seed
      // file is JS-formatted, but a future style change (extra prop
      // between name and status, prettier reflow, etc.) shouldn't make
      // this case crash or false-fail. We still verify the real
      // contract: all six fixed categories carry status='a'.
      const src = safeStr(seedQuestionCategoriesSource);
      const fixed = [
        { id: 1, name: 'Chronicle' },
        { id: 2, name: 'Flashback' },
        { id: 3, name: 'Kült' },
        { id: 4, name: 'Viral' },
        { id: 5, name: 'Arena' },
        { id: 6, name: 'Level Up' },
      ];
      const missing = [];
      for (const f of fixed) {
        const rowRegex = new RegExp(
          `category_id:\\s*${f.id}[^}]*name:\\s*'${f.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}'[^}]*status:\\s*'a'`,
          's',
        );
        if (!rowRegex.test(src)) missing.push(`${f.id}:${f.name}`);
      }
      if (missing.length) {
        return fail('Seed path does not mark all six fixed categories as status="a".', {
          verification: 'STATIC_CONTRACT',
          file: 'functions/seedQuestionCategories.js',
          missing,
        });
      }
      return pass('All six seeded categories carry status="a".', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_rows_have_description',
    'Seed path supplies a non-empty description for every fixed category',
    () => {
      const src = safeStr(seedQuestionCategoriesSource);
      const matches = src.match(/description:\s*'([^']*)'/g) || [];
      const nonEmpty = matches.filter((m) => !/description:\s*''/.test(m));
      if (nonEmpty.length < 6) {
        return fail('Fewer than six non-empty descriptions found in seed path.', {
          verification: 'STATIC_CONTRACT',
          file: 'functions/seedQuestionCategories.js',
          foundCount: nonEmpty.length,
        });
      }
      return pass('Seed path supplies six non-empty category descriptions.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_seed_backfills_missing_status_and_description',
    'Seed path backfills status/description on existing rows that lack them',
    () => {
      const missing = missingTokens(seedQuestionCategoriesSource, [
        "typeof existing.status !== 'string'",
        'patch.status = category.status',
        "typeof existing.description !== 'string'",
        'patch.description = category.description',
        'base44.asServiceRole.entities.Category.update(existing.id, patch)',
      ]);
      if (missing.length) {
        return fail('Seed path does not backfill missing status/description on pre-Codex158 rows.', {
          verification: 'STATIC_CONTRACT',
          file: 'functions/seedQuestionCategories.js',
          missing,
        });
      }
      return pass('Seed path safely backfills status/description on existing rows.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_active_filter_helper_exists',
    'Shared category active-filter helper (lib/categoryFilters.js) exists',
    () => {
      const missing = missingTokens(categoryFiltersSource, [
        'CATEGORY_STATUS_ACTIVE',
        'CATEGORY_STATUS_PASSIVE',
        'export function isActiveCategory',
        'export function filterActiveCategories',
        // backward-compat: missing status must be treated as active
        'missing status = active',
      ]);
      if (missing.length) {
        return fail('Shared category active-filter helper is missing required exports/behavior.', {
          verification: 'STATIC_CONTRACT',
          file: 'lib/categoryFilters.js',
          missing,
        });
      }
      return pass('Shared category active-filter helper is defined and documents backward-compat.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_active_filter_helper_rejects_passive',
    'isActiveCategory rejects status="p" and accepts status="a" / missing',
    () => {
      // Lightweight runtime sanity check — runs in the simulator host,
      // not against a live DB. Guards against future regressions where
      // someone inverts the boolean or removes the backward-compat path.
      let isActiveCategory;
      try {
        // eslint-disable-next-line no-new-func
        const factory = new Function(
          `${safeStr(categoryFiltersSource)
            .replace(/export\s+const\s+/g, 'const ')
            .replace(/export\s+function\s+/g, 'function ')}; return { isActiveCategory };`,
        );
        ({ isActiveCategory } = factory());
      } catch (err) {
        return fail('Could not evaluate lib/categoryFilters.js in simulator host.', {
          verification: 'STATIC_CONTRACT',
          error: String(err?.message || err),
        });
      }
      if (typeof isActiveCategory !== 'function') {
        return fail('isActiveCategory is not exported as a function.', {
          verification: 'STATIC_CONTRACT',
        });
      }
      const checks = [
        { input: { status: 'a' }, expected: true, label: 'status=a' },
        { input: { status: 'A' }, expected: true, label: 'status=A (case-insensitive)' },
        { input: { status: 'p' }, expected: false, label: 'status=p' },
        { input: { status: 'P' }, expected: false, label: 'status=P (case-insensitive)' },
        { input: { status: '' }, expected: true, label: 'missing/empty status (backward-compat)' },
        { input: {}, expected: true, label: 'no status field (backward-compat)' },
        { input: null, expected: false, label: 'null row' },
      ];
      const failures = checks.filter((c) => isActiveCategory(c.input) !== c.expected);
      if (failures.length) {
        return fail('isActiveCategory returned unexpected values for one or more cases.', {
          verification: 'STATIC_CONTRACT',
          failures: failures.map((f) => f.label),
        });
      }
      return pass('isActiveCategory correctly accepts active/missing-status and rejects passive.', {
        verification: 'STATIC_CONTRACT',
      });
    }),
];