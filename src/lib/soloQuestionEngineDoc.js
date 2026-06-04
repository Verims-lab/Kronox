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
The first active player question card shown to the user must be
soloAttemptDeck[0], the second must be soloAttemptDeck[1], and so on. Seed
or preplaced timeline cards do not count as the first 5 active player
question cards unless they are actual player question cards. They must still
avoid close-year conflicts with the first 5 active player cards in the early
visible timeline context.

Hard deck rules:
- 16 questions for normal levels.
- 19 questions for special levels.
- unique question IDs.
- unique years.
- active questions only.
- active categories only.
- passive categories excluded.
- first 5 ordered active player question cards must satisfy minimum 5-year spacing between answer years.
- first 5 ordered questions means the first 5 displayed active player question cards at runtime.
- missing, null, undefined, empty, approximate, or non-numeric years are invalid.

Soft deck preferences:
- category balance.
- subcategory balance.
- era/year spread.
- recently-seen avoidance.

The P0 first-five guardrail avoids more than 2 same-subcategory or obvious
sports-cluster cards when metadata and alternatives allow. Full category,
subcategory, and era tuning remains a P1 improvement.

Fallback may relax recently-seen avoidance, category/subcategory balance,
and era spread. It must not relax required deck size, unique IDs, unique
years, active question/category filtering, or the first 5 minimum 5-year
spacing rule unless no valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively
recalculated. New attempts may carry soloRulesVersion: 2.

Solo Jokers v1 are Solo-only, free, attempt-local helpers. Every new Solo
attempt starts with Hata Affı, Kart Değiştir, and Zaman Dondur. Only 1 joker
total may be used per attempt. Jokers do not use Diamonds, do not grant Kronox Puan, and do not affect Online mode.

Hata Affı forgives the next wrong placement without counting a mistake.
Kart Değiştir replaces the current card from the already prepared Solo deck
or reserve without fetching or re-randomizing mid-attempt. The swapped-out card
should not reappear while unused deck cards are available. Zaman Dondur freezes
the Solo timer for 10 seconds.
`;
