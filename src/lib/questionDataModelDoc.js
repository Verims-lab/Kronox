// Runtime mirror of docs/KRONOX_QUESTION_DATA_MODEL.md.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing the markdown directly from `docs/` (`.md?raw`) is rejected at
//   build time with: "Failed to parse source for import analysis ... .md?raw".
//   Mirroring the doc as a JS module keeps the Health Center runtime proof
//   while letting the canonical doc live under `docs/`.
//
//   When you change one, change the other. The Health case
//   `question_schema_cleanup_doc_exists` cross-checks required phrases
//   against this string and FAILS if any required phrase is missing.

export const QUESTION_DATA_MODEL_DOC_PATH = 'docs/KRONOX_QUESTION_DATA_MODEL.md';

export const QUESTION_DATA_MODEL_DOC = `# Kronox Question Data Model

Status: Active product contract.
Entity: base44/entities/Question.jsonc
Fetch layer: base44/functions/getQuestions/entry.ts + src/hooks/useOfflineQuestions.js
Runtime adapter: src/lib/questionRuntimeAdapter.js

## 1. Target dataset fields
- id
- question
- answer
- main_category_id
- second_category_id
- third_category_id
- sub_category
- tag
- region
- difficulty (1-5)
- state (A = Active, P = Passive)

## 1a. SubCategory lookup preparation
SubCategory exists as a future normalized lookup table with fields:
- id
- main_category_1
- main_category_2
- name
- status (A = Active, P = Passive)
- description

main_category_1 and main_category_2 store Category.category_id values.
Question currently still uses the existing free-text sub_category field until a
later explicit migration maps Question subcategory values to SubCategory IDs.
Do not add sub_category_id or migrate Question rows in the schema-only
preparation phase.

## 1b. User Category preferences
Users can select active main Category interests under Settings in the
"İlgi Alanlarım" section.
UserCategoryPreference stores preferences per user with fields:
- id
- user_id
- category_id
- status (A = selected/active, P = unselected/passive)
- created_date
- updated_date

Settings shows active Category.status = A/a options and hides passive
Category.status = P/p rows. Minimum selection count is 3. There is no maximum
selection. Any user with fewer than 3 active valid Category preferences
sees the popup; this applies to new and existing users. The source of truth is
active valid UserCategoryPreference count. Only active categories are selectable
and count. Passive or removed Category selections are ignored in UI/save state
and must not be resaved as active preferences. Users can later change selections
under Profile / Settings / İlgi Alanlarım. Solo question selection targets 70%
selected user categories and 30% full eligible pool when at least 3 active
valid preferences are available. This is a soft weighting target with fallback,
not hard filtering.
Online question selection is not affected.
SubCategory still exists for future normalized question metadata, but Settings
preference selection currently uses main Category, not SubCategory. Existing
UserSubCategoryPreference rows, if any, are left untouched until a later
migration decision.

## 2. Removed legacy schema fields
The following legacy fields were removed from the Question entity schema and
are no longer stored on the entity:
- \`year\`
- \`category\`
- \`type\`
- \`media_url\`
- \`icon_url\`

## 3. Runtime Compatibility Note
Gameplay still needs a timeline year plus category/type defaults. These are no
longer stored on the entity — they are derived at fetch time by
\`questionRuntimeAdapter.js\`:
- The timeline \`year\` is derived from \`answer\` via getTimelineYearFromAnswer.
- \`category\` defaults to 'genel' and \`type\` defaults to 'metin' when absent.
- Invalid, missing, null, non-numeric, or approximate years are excluded from
  playable timeline decks.
- Runtime projection may include sub_category and tag as gameplay-balance
  metadata only, not as public full-bank exposure.
- When the active pool is larger than the gameplay projection cap,
  getQuestions uses deterministic pool-proportional sampling before capping:
  category/subcategory shares should follow the active eligible pool rather
  than equal-count balancing, newest-row slicing, or DB/category order.
- getQuestions admin/Health diagnostics expose the safe funnel: fetched active
  rows, normalized eligible rows, returned runtime projection,
  category/subcategory/year-band distributions, projection limit, and seed.
- Admin/Health diagnostics may expose aggregate projection counts and
  category/subcategory/year-band distributions, but never the full raw bank.
- Private QuestionAttemptEvent analytics may store question id, answer year,
  category, subcategory, and tag metadata for admin reports only.
- Admin question analytics reports label all-active question pool,
  Solo-eligible pool, runtime projection diagnostics, unique shown questions,
  and never-shown counts separately when those metrics are available.
- Admin question analytics reports include category pool counts, aggregate user
  category preference counts, category exposure counts, within-category
  most/least/never-shown analysis, and category fairness signals. Preference
  counts are aggregate only and do not expose user IDs or emails.
- Admins may run resetQuestionAnalyticsData after a question pool replacement;
  it clears QuestionAttemptEvent, QuestionStatsProjection, and
  CategoryStatsProjection only. The callable function lives at
  functions/resetQuestionAnalyticsData.js and is mirrored by
  base44/functions/resetQuestionAnalyticsData/function.jsonc with name
  resetQuestionAnalyticsData and entry entry.ts.
- Report generation skips stale/deleted question_id analytics references with
  a diagnostic count and caps large sections for email readability.
- Top-question/category/subcategory concentration flags are guardrails, not
  equal-count category requirements; they are interpreted against
  Solo-eligible/runtime pool proportions.

This keeps the stored schema clean while gameplay keeps consuming runtime
year/category/type values.
`;
