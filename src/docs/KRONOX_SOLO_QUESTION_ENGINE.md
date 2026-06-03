# Kronox Solo Question Engine

Status: Active product contract for new Solo attempts.

This mirror matches `docs/KRONOX_SOLO_QUESTION_ENGINE.md` for in-app Health checks.

Normal Solo levels end at 7 correct cards, use a 16-question deck, use a 180 seconds timer, and fail on the 10th mistake.

Special Solo levels start at level 10 and repeat every 5 levels: 10, 15, 20, 25, and so on. Special Solo levels end at 10 correct cards, use a 19-question deck, use the same 180 seconds timer, and fail on the 10th mistake.

The full attempt deck is built before gameplay starts and is consumed in order. There is no mid-attempt re-randomization.

Hard deck rules:
- 16 questions for normal levels
- 19 questions for special levels
- unique question IDs
- unique years
- active questions only
- active categories only
- passive categories excluded
- first 5 ordered questions have a minimum 5-year gap between answer years

Soft preferences:
- category balance
- subcategory balance
- era/year spread
- recently-seen avoidance

Fallback may relax recently-seen avoidance, category/subcategory balance, and era spread. It must not relax deck size, unique IDs, unique years, active question/category filtering, or the first 5 minimum 5-year spacing rule unless no valid spaced deck exists at all.

Replay creates a new deck. Old completed results are not retroactively recalculated. New attempts may carry `soloRulesVersion: 2`.
