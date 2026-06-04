# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This mirror matches `docs/KRONOX_SOLO_QUESTION_ENGINE.md` for in-app Health checks.

Normal Solo levels end at 7 correct timeline cards, including seed cards already on the timeline, use a 16-question deck, use a 180 seconds timer, and fail on the 10th mistake.

Special Solo levels start at level 10 and repeat every 5 levels: 10, 15, 20, 25, and so on. Special Solo levels end at 10 correct timeline cards, including seed cards already on the timeline, use a 19-question deck, use the same 180 seconds timer, and fail on the 10th mistake.

The full attempt deck is built before gameplay starts and is consumed in order. There is no mid-attempt re-randomization. The first active player question card shown to the user is `soloAttemptDeck[0]`; seed/preplaced timeline cards do not count as the first 5 active player question cards unless they are actual player question cards, but they must not create close-year conflicts with those early active cards. Runtime also uses a visible timeline spacing guardrail: placed/seed timeline years and the current active card avoid 1-4 year conflicts such as 1996/1997, 1998/1999, and 1913/1914 where a safe prebuilt-deck alternative exists.

Hard deck rules:
- 16 questions for normal levels
- 19 questions for special levels
- unique question IDs
- unique years
- active questions only
- active categories only
- passive categories excluded
- first 5 ordered questions have a minimum 5-year gap between answer years
- first 5 ordered questions means the first 5 displayed active player question cards at runtime
- missing, null, undefined, empty, approximate, or non-numeric years are invalid

Soft preferences:
- category balance
- subcategory balance
- era/year spread
- recently-seen avoidance
- P0 first-five guardrail avoids more than 2 same-subcategory or obvious sports-cluster cards when metadata and alternatives allow

Fallback may relax recently-seen avoidance, category/subcategory balance, and era spread. It must not relax deck size, unique IDs, unique years, active question/category filtering, or the first 5 minimum 5-year spacing rule unless no valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively recalculated. New attempts may carry `soloRulesVersion: 2`.
