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
- description

### 1.0 Question.description (approved SEO/content metadata)
Question.description is intentionally retained as an approved Question field.
- Purpose: SEO behavior and metadata / content description for question pages
  or future public SEO surfaces.
- It is optional/nullable. Existing question rows without a description remain
  valid and safe.
- It is NOT part of gameplay answer validation.
- It must not affect Solo or Online question selection.
- It must not affect difficulty, scoring, the timeline year logic, category
  selection, or the leaderboard.
- It is not required for any existing gameplay logic unless explicitly needed
  later.
- It may be used by SEO / meta / content surfaces. If exposed publicly later,
  sanitize/escape it like normal user-facing content.
- Question analytics, import, and export must preserve description when present
  and must not fail when it is missing or blank.
- Health treats description as an approved field; unknown/unapproved fields
  beyond the approved list still fail the Question schema drift check.

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
selection. Any authenticated user with fewer than 3 active valid Category
preferences sees the optional personalization popup; this applies to new and
existing users, but it can be deferred and must not block gameplay. The source
of truth is active valid UserCategoryPreference count. Only active categories
are selectable and count. Passive or removed Category selections are ignored in
UI/save state and must not be resaved as active preferences. Users can later
change selections under Profile / Settings / İlgi Alanlarım. No login/no saved
preferences/empty preferences use all active categories for Solo. Category
preference save validation remains separate from gameplay start.
Saved preferences target 70% selected user categories and 30% full eligible pool
only when at least 3 active valid preferences are available. This is a soft weighting
target with fallback, not hard filtering. The selected-category 70% lane is not
difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full
eligible pool where possible, with safe fallback if difficulty-1 global
candidates are insufficient.
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
- Admin question analytics email sends the full product-intel-email-v3 report in
  the email body. The active report includes product-intelligence sections for
  Solo algorithm signals, question-type/content quality, joker usage, play-time
  rhythm, longer-session/retention signals, recommended actions, and missing
  instrumentation. Preference counts are aggregate only and do not expose user
  IDs or emails.
- Static inventory-style category pool sections are intentionally excluded from
  generated email output. Current Question/Category data may still inform
  aggregate product signals, but the old category pool appendix must not return.
- Removed legacy report sections must not appear in generated email
  output: Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori /
  Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori
  Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- Long event-based detail sections are row-limited in the email body and must not
  become raw DB dumps.
- After a question pool replacement, analytics reset is manual_db_reset_only:
  clear QuestionAttemptEvent, QuestionStatsProjection, and
  CategoryStatsProjection only by DB maintenance. Do not delete Question,
  Category, SubCategory, UserCategoryPreference, UserStatsProjection, scores,
  diamonds, progress, users, AdminUser, Daily Wheel, gameplay, or leaderboard
  rows.
- Report generation skips stale/deleted question_id analytics references with
  a diagnostic count and caps large sections for email readability.
- Top-question/category/subcategory concentration flags are guardrails, not
  equal-count category requirements; they are interpreted against
  Solo-eligible/runtime pool proportions.

This keeps the stored schema clean while gameplay keeps consuming runtime
year/category/type values.
`;
