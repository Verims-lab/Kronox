# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This mirror matches `docs/KRONOX_SOLO_QUESTION_ENGINE.md` for in-app Health checks.

Normal Solo levels end at 7 correct timeline cards, including seed cards already on the timeline, start with 2 timeline anchor cards, use a 10 evaluated move limit, use an 18-question deck, use a 180 seconds timer, and fail when 10 evaluated moves are used before the target is reached.

Special Solo levels start at level 5 and repeat every 5 levels: 5, 10, 15, 20, and so on. Special Solo levels end at 10 correct timeline cards, including seed cards already on the timeline, use a 13 evaluated move limit, use a 21-question deck, and use the same 180 seconds timer. The 3 extra moves are only a mistake buffer and do not change scoring.

The full attempt deck is built before gameplay starts and is consumed in order. There is no mid-attempt re-randomization. The first active player question card shown to the user is `soloAttemptDeck[0]`; seed/preplaced timeline cards do not count as the first 5 active player question cards unless they are actual player question cards, but they must not create close-year conflicts with those early active cards. Runtime also uses a visible timeline spacing guardrail: placed/seed timeline years and the current active card avoid 1-4 year conflicts such as 1996/1997, 1998/1999, and 1913/1914 where a safe prebuilt-deck alternative exists.

Hard deck rules:
- 18 questions for normal levels
- 21 questions for special levels
- normal: 2 anchor cards + 10 playable moves + Kart Değiştir buffer + Kronokalkan buffer
- special: 2 anchor cards + 13 playable moves + Kart Değiştir buffer + Kronokalkan buffer
- Zaman Dondur does not require an extra card
- Extra Kart Değiştir/Kronokalkan use beyond the per-attempt buffer fails safely before spend; there is no raw client question list fallback.
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
- tag/theme balance, including sports-like theme clustering
- era/year spread
- recently-seen avoidance
- exposure cooldown / rotation prefers never-shown, less-shown, and not-recently-shown questions when local or projected stats are available
- P0 first-five guardrail avoids more than 2 same-subcategory or obvious sports-cluster cards when metadata and alternatives allow
- P1/P2 balance distributes rich-pool decks across categories, subcategories, themes, and year bands using pool-proportional targets, not equal-count balancing; high/recent shown cards are downweighted softly; first 7 active cards avoid 4+ same category/subcategory/theme where alternatives exist
- P2 diagnostics are Health/admin/helper-only and include deck quality, question pool health, difficulty-readiness, replay-variety, and Kart Değiştir replacement diagnostics

Exposure and diversity weighting are soft only and run before the attempt starts. Missing or corrupt local history and sparse metadata must be ignored safely and must not fetch questions or stats mid-attempt.

Fallback may relax recently-seen avoidance, category/subcategory/theme balance, and era spread. It must not relax deck size, unique IDs, unique years, active question/category filtering, visible timeline spacing where a safe alternative exists, or the first 5 minimum 5-year spacing rule unless no valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively recalculated. New attempts may carry `soloRulesVersion: 3`.
