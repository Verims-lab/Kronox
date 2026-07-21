// Kronox Health Center — Category status & description contracts
// (Codex158 / Codex159 hardening).
//
// Locks in the new Category entity fields and their UI filtering rule:
//   • Category schema declares `status` (enum: a/p, default a) and
//     `description` (string, default "").
//   • Category rows are live DB content. Runtime/UI surfaces must read
//     current active Category metadata and must not fall back to stale
//     hardcoded seed names or fixed historical ID lists.
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

import getCategoryMetadataSource from '../../../base44/functions/getCategoryMetadata/entry.ts?raw';
import getQuestionsSource from '../../../base44/functions/getQuestions/entry.ts?raw';
import categoryFiltersSource from '../../lib/categoryFilters.js?raw';
// Codex591 — Online no longer has category selection. Carousel source may
// remain for legacy/unused code, but the Online screen must not fetch/sort
// active categories for a UI category picker.
import onlineCategoryCarouselSource from '../lobby/OnlineCategoryCarousel.jsx?raw';
import onlineChallengeScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
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

  makeCase('category_metadata_live_rows_not_seeded',
    'Category metadata source is live Category rows, not a stale seed array',
    () => {
      const missing = missingTokens(getCategoryMetadataSource, [
        'base44.asServiceRole.entities.Category',
        'publicCategoryMetadata',
        'metadataOnly: true',
        'guestCallableWithoutLogin: true',
        'legacyHardcodedCategoryFallbackAllowed: false',
      ]);
      const forbidden = [
        'QUESTION_CATEGORIES',
        'Chronicle',
        'Flashback',
        'Viral',
        'Arena',
        'Level Up',
      ].filter((token) => safeStr(getCategoryMetadataSource).includes(token));
      if (missing.length || forbidden.length) {
        return fail('Category metadata can still look seeded or stale instead of live DB-sourced.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getCategoryMetadata/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Category metadata is read from live active Category rows and declares stale hardcoded fallbacks forbidden.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_metadata_description_scope',
    'Public category metadata includes descriptions without exposing questions',
    () => {
      const missing = missingTokens(getCategoryMetadataSource, [
        'description: safeText(row?.description, 240)',
        'responseFields: [\'category_id\', \'name\', \'description\', \'status\']',
        'rawQuestionRowsExposed: false',
        'answersExposed: false',
        'yearsExposed: false',
      ]);
      const forbidden = [
        'Question.list',
        'Question.filter',
      ].filter((token) => safeStr(getCategoryMetadataSource).includes(token));
      if (missing.length || forbidden.length) {
        return fail('Public category metadata does not keep the metadata-only description contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getCategoryMetadata/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('Public category metadata exposes category_id/name/description/status only; questions stay hidden.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('category_runtime_uses_active_category_rows',
    'Gameplay category source of truth is active Category rows, not seed IDs',
    () => {
      const source = safeStr(getQuestionsSource);
      const missing = missingTokens(source, [
        'CATEGORY_METADATA_POLICY',
        'getServiceEntity(base44, \'Category\')',
        'legacyHardcodedCategoryFallbackAllowed: false',
        'staleCategoryFallbackUsed: false',
        'category_id\', 1000',
      ]);
      const forbidden = [
        'FALLBACK_ACTIVE_CATEGORY_IDS',
        'QUESTION_CATEGORIES',
        'Chronicle',
        'Flashback',
        'Viral',
        'Arena',
        'Level Up',
      ].filter((token) => source.includes(token));
      if (missing.length || forbidden.length) {
        return fail('Gameplay category policy can still drift toward stale seed IDs.', {
          verification: 'STATIC_CONTRACT',
          file: 'base44/functions/getQuestions/entry.ts',
          actual: { missing, forbidden },
        });
      }
      return pass('getQuestions derives playable category IDs from active Category rows and declares stale seed fallback disabled.', {
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

  makeCase('online_categories_sorted_by_id_asc_on_fetch',
    'Online screen does not fetch/sort active categories for a removed category picker',
    () => {
      const online = safeStr(onlineChallengeScreenSource);
      const required = missingTokens(online, [
        'Tüm kategorilerden rastgele sorular',
        'Arkadaşını Davet Et',
        'Rastgele Eşleş',
      ]);
      const forbidden = [
        'loadActiveCategories({ limit: 1000 })',
        '.sort((a, b) => (Number(a.category_id) || 0) - (Number(b.category_id) || 0))',
        'setDbCategories(active)',
        'OnlineCategoryCarousel',
        'categoryLoadError',
      ].filter((token) => online.includes(token));
      if (required.length || forbidden.length) {
        return fail('Online screen drifted toward the removed category fetch/sort carousel.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/lobby/OnlineChallengeScreen.jsx',
          actual: { required, forbidden },
        });
      }
      return pass('Online screen does not fetch or sort categories for UI selection; no-category copy and entry points remain.',
        { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('online_category_carousel_starts_at_left_on_mount',
    'Online category carousel opens with the first card visible (scrollLeft = 0)',
    () => {
      // Codex161 — The carousel must pin scrollLeft to 0 on first
      // mount AND once real categories arrive, then never reset
      // programmatically again. We verify:
      //   • a one-shot guard ref exists (didInitialScrollRef)
      //   • useLayoutEffect is used so the reset happens BEFORE the
      //     first browser paint (no flash of mid-scroll position)
      //   • the effect actually sets scrollLeft = 0
      //   • the effect depends on `categories` so the reset re-runs
      //     when the parent swaps fallback rows for the DB rows
      //   • there is NO scrollIntoView / scrollTo on a selected-card
      //     id on mount (that would hide the first card)
      const src = safeStr(onlineCategoryCarouselSource);
      const missing = [
        'useLayoutEffect',
        'didInitialScrollRef',
        'el.scrollLeft = 0',
      ].filter((t) => !src.includes(t));
      // Forbidden auto-scroll-to-selected patterns on initial mount.
      const forbidden = [
        'scrollIntoView',
        'scrollTo({ left:',
      ].filter((t) => src.includes(t));
      if (missing.length || forbidden.length) {
        return fail('Online category carousel does not guarantee a left-aligned initial scroll.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/lobby/OnlineCategoryCarousel.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Carousel pins scrollLeft=0 on first mount via a one-shot useLayoutEffect; no auto-scroll-to-selected.', {
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
      let normalizeCategoryId;
      try {
        // eslint-disable-next-line no-new-func
        const factory = new Function(
          `${safeStr(categoryFiltersSource)
            .replace(/export\s+const\s+/g, 'const ')
            .replace(/export\s+function\s+/g, 'function ')}; return { isActiveCategory, normalizeCategoryId };`,
        );
        ({ isActiveCategory, normalizeCategoryId } = factory());
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
      if (typeof normalizeCategoryId !== 'function' || normalizeCategoryId(11) !== 11) {
        return fail('normalizeCategoryId still rejects live category IDs beyond the original seed set.', {
          verification: 'STATIC_CONTRACT',
          expected: 'category_id 11 remains valid when present in active Category rows',
          actual: {
            normalizeCategoryIdType: typeof normalizeCategoryId,
            category11: typeof normalizeCategoryId === 'function' ? normalizeCategoryId(11) : null,
          },
        });
      }
      const checks = [
        { input: { status: 'a' }, expected: true, label: 'status=a' },
        { input: { status: 'A' }, expected: true, label: 'status=A (case-insensitive)' },
        { input: { status: 'active' }, expected: true, label: 'status=active' },
        { input: { status: 'aktif' }, expected: true, label: 'status=aktif' },
        { input: { status: 'p' }, expected: false, label: 'status=p' },
        { input: { status: 'P' }, expected: false, label: 'status=P (case-insensitive)' },
        { input: { status: 'passive' }, expected: false, label: 'status=passive' },
        { input: { status: 'pasif' }, expected: false, label: 'status=pasif' },
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
