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
change selections under Profile / Settings / İlgi Alanlarım. Authenticated users
with no saved preferences or empty preferences use all active categories for
Solo; missing authentication uses the explicit capped guest Solo projection and
must not expose raw questions. Insufficient preferences also use all active categories for Solo.
Category preference save validation remains separate from gameplay start.
Saved preferences target 70% selected user categories and 30% full eligible pool
only when at least 3 active valid preferences are available. This is a soft weighting
target with fallback, not hard filtering. The selected-category 70% lane uses
selected categories with difficulty 1 and 2 eligible; the global 30% lane first
uses all active categories with difficulty 1, then selected-category shortage
or global difficulty-1 shortage fills from the broader active global pool before
clean failure.
Online question selection is not affected by Solo preferences. Online start is
authoritative through startLobbyGame, which persists a bounded shared
online_question_deck on Lobby from active lobby-selected categories only;
difficulty 1/2 only; Game reads that persisted deck instead of the Solo
getQuestions buffer.
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
- Authenticated Solo gameplay has no fixed 1200 source-pool cap. getQuestions
  considers the active eligible category/question universe server-side and
  returns only a bounded server attempt candidate buffer; category/subcategory
  shares should follow the active eligible pool rather than equal-count
  balancing, newest-row slicing, DB/category order, or a fixed global source
  cap.
- getQuestions derives active playable category IDs from active Category rows;
  stale hardcoded seed-category ID subsets must not exclude newer active
  categories from the runtime projection.
- Question category id fields accept any positive live Category.category_id;
  main_category_id, second_category_id, and third_category_id must not be
  capped to the original 1-6 seed set.
- getQuestions gameplay v2 requests return getQuestionsRuntimeMarker by
  default. projectionDiagnostics are admin/debug-only and include
  requested/effective limit, active Category source/ids, per-category
  fetch/playable counts, zero-playable categories, fallback state,
  sourcePoolCapRemoved:true, responseCapApplied:true,
  selectionMode:server_attempt_candidate_buffer_v1, and
  projectionCappedBeforeCategoryCoverage:false.
- Missing getQuestionsRuntimeMarker in Solo debug JSON means the deployed
  callable is stale or the frontend invoked a different function. Codex343
  expects backend marker getQuestions-live-per-category-v7-Codex343.
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
- Runtime Projection is diagnostic/admin proof only and is not fabricated by
  email generation. It is described as getQuestions diagnostics when the email
  report does not call live projection.
- Admin question analytics email sends the full nine-section-email-v1 report in
  the email body. The active report includes exactly Executive Summary, category
  pool/preference/exposure tables, top/underused/wrong question tables, Joker
  Kullanımı Analizi, and Oynanma Zamanı ve Kullanım Ritmi. Preference counts are
  aggregate only and do not expose user IDs or emails.
- Joker/time sections must be table-based and use structured Yeterli veri yok
  rows when exact fields are missing. The removed legacy category appendices
  must not return under their old headings.
- Removed legacy report sections must not appear in generated email
  output: Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori /
  Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori
  Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- Long event-based detail sections are row-limited in the email body and must not
  become raw DB dumps.
- After a question pool replacement, analytics reset is manual_db_reset_only:
  clear QuestionAttemptEvent, PlayerQuestionDailyExposure, and, if populated,
  optional manual QuestionStatsProjection and CategoryStatsProjection aggregate
  rows by DB maintenance. The active 9-section report computes history from raw
  QuestionAttemptEvent rows, so empty projection tables are expected until the
  manual refresh runs. PlayerQuestionExposure is optional reset scope only when
  per-player anti-repeat/freshness memory should restart. Do not delete
  Question, Category, SubCategory, User, GuestProfile, PlayerProfile,
  UserCategoryPreference, UserStatsProjection, scores, diamonds, progress,
  users, AdminUser, Daily Wheel/Daily Quest, gameplay, or leaderboard rows.
- The 9-section email also reads ledger/current-state tables for Joker/economy
  signals. JokerTransaction, DiamondTransaction, UserJokerInventory, and
  DailyWheelSpin are not question analytics reset tables; if Joker Kullanımı
  Analizi is ledger-derived, it may remain visible after question analytics
  cleanup. Oynanma Zamanı hour/day metrics reset with QuestionAttemptEvent
  timestamps.
- Report generation skips stale/deleted question_id analytics references with
  a diagnostic count and caps large sections for email readability.
- Top-question/category/subcategory concentration flags are guardrails, not
  equal-count category requirements; they are interpreted against
  Solo-eligible/runtime pool proportions.

This keeps the stored schema clean while gameplay keeps consuming runtime
year/category/type values.

## 14. Per-Player Exposure Architecture

Question-level freshness is per player, not global. Showing the same question
to different users is acceptable; the risk signal is one player seeing the same
question too often or too soon.

Runtime projection tables:
- PlayerQuestionExposure uses logical unique key player_key + question_id + mode
  and application key player_question_exposure:<player_key>:<mode>:<question_id>.
- PlayerQuestionDailyExposure uses logical unique key date_utc + player_key +
  question_id + mode and application key
  player_question_daily_exposure:<date_utc>:<player_key>:<mode>:<question_id>.

Write timing:
- count active playable cards when shown
- count Kart Değiştir replacement cards when the replacement becomes active
- count guided tutorial cards as mode=tutorial
- do not count server candidate pool rows, unused deck buffer/reserve cards, or
  never-shown joker replacement candidates

Question Analytics report remains email-body-only, no PDF, exactly 9 top-level
sections. Kişi Bazlı Soru Çeşitliliği — Anonim lives inside Kategori Bazında
Gösterim and labels users as User0001, User0002, etc. The report must not
output email, provider ids, raw guest id, raw guest token, owner key, internal
player key, or username as the per-player coverage label.
`;
