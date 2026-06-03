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

This keeps the stored schema clean while gameplay keeps consuming runtime
year/category/type values.
`;