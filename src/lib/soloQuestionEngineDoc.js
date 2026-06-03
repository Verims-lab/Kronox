// Codex167 — Runtime mirror of docs/KRONOX_SOLO_QUESTION_ENGINE.md so the
// Health Center can prove that the engine contract is present in the app
// bundle. Keep this string in sync with the canonical markdown.

export const SOLO_QUESTION_ENGINE_DOC_PATH = 'docs/KRONOX_SOLO_QUESTION_ENGINE.md';

export const SOLO_QUESTION_ENGINE_DOC = `# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

Normal Solo levels end at 7 correct timeline cards, including seed cards
already on the timeline, and use a 16-question deck.
Special Solo levels start at level 10 and repeat every 5 levels: 10, 15,
20, 25, and so on. Special Solo levels end at 10 correct timeline cards,
including seed cards already on the timeline, and use a 19-question deck.

All new Solo attempts use a 180 seconds timer and fail on 10 mistakes; the
10th mistake ends the attempt.

The full attempt deck is built before gameplay starts. Gameplay consumes
the prebuilt deck in order. There is no mid-attempt re-randomization.

Hard deck rules:
- 16 questions for normal levels.
- 19 questions for special levels.
- unique question IDs.
- unique years.
- active questions only.
- active categories only.
- passive categories excluded.
- first 5 ordered questions must satisfy minimum 5-year spacing between answer years.

Soft deck preferences:
- category balance.
- subcategory balance.
- era/year spread.
- recently-seen avoidance.

Fallback may relax recently-seen avoidance, category/subcategory balance,
and era spread. It must not relax required deck size, unique IDs, unique
years, active question/category filtering, or the first 5 minimum 5-year
spacing rule unless no valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively
recalculated. New attempts may carry soloRulesVersion: 2.
`;
