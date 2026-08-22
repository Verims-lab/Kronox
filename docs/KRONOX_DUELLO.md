# Kronox Duello V2

Status: Active product contract.

## Mode Boundary

Duello is an exactly two-player simultaneous mode with the stable internal key
`same_question_duel`. It shares matchmaking infrastructure with Online Kapış
but uses a separate mode lane, route (`/duel`), gameplay state, and scoring
contract. The active flow is search, same-screen `Rakip bulundu`, three-second
countdown, then direct game start. `/lobby` is not part of Duello.

## Shared Round

The backend-owned Lobby session stores one current question, one authoritative
shared timeline, one question index, one 10-second deadline, and one answer per
participant. Both clients receive the same public-safe question, timeline,
index, and deadline. An answer locks immediately and cannot be changed.
Duplicate operations are idempotent and answers at or after the deadline are
late. A round resolves only when both players answer or the deadline expires.

After every resolved round, the correct event is inserted chronologically into
the shared timeline regardless of either player's correctness. Both clients
receive that identical grown timeline before the next shared question starts.
Round feedback is visible for about 0.8 seconds and advances automatically;
there is no Continue button. An unanswered player receives no extra penalty and
no correct-count increase.

## Result Rules

- First to five correct answers wins only after the active round resolves.
- A simultaneous 5-5 enters Sudden Death.
- In Sudden Death, a differential correct/wrong round wins; equal outcomes
  continue while the question limit allows.
- The match ends after at most 12 questions.
- A target or Sudden Death winner receives +50 Kronox Puan.
- At question 12, a higher non-target correct count receives +25 Kronox Puan.
- Equal correct counts at question 12 produce a draw and 0 points.
- Response time is diagnostic only: there is no speed bonus or speed tiebreak.

Winner, draw, and awarded points are backend authoritative. The client invokes
the idempotent result receipt path and never writes profile, leaderboard, or
score entities directly. Online Kapış remains on its independent +15/-6 rule.

## UI And Recovery

Duello reuses Solo `QuestionCard` and `Timeline`, including placement and card
visuals. It adds only the two usernames and correct counts, X/12 progress,
answer-lock status, Sudden Death status, and a bottom horizontal time bar.
Jokers, Hint, and Solo level state are absent. The result screen supports win,
loss, and draw. `RÖVANŞ İSTE` is explicitly gated pending a safe reciprocal
rematch protocol; `ANA SAYFA` remains available.

Polling accepts only non-regressing revisions and reconstructs question,
timeline, counts, deadline, and phase from the backend snapshot. Either
participant may request an idempotent due-state sync after the shared deadline
or feedback hold. This supports brief reconnect recovery without client-owned
winner or timer authority.

## Privacy And Proof

Public snapshots expose username-safe identity, opaque participant references,
synthetic active-card/timeline IDs, one answer-free active prompt, resolved
timeline years, correct counts, and shared timing fields. They omit email,
provider/owner/actor keys, raw guest proof, internal row IDs, used-question IDs,
the remaining deck, full question bank, raw errors, and the active answer year.
The correct year is revealed only in resolved-round feedback.

Full Health checks source and executable rules but does not run Runtime E2E.
True synchronization requires distinct A/B actor fixtures. The two-context
Runtime E2E proves direct no-lobby start, identical question/timeline/index/
deadline fingerprints, independent answer windows, one-card timeline growth,
and identical next-round state. Without both fixtures it remains
`MANUAL_EXTERNAL` / `TWO_ACTOR_REQUIRED`. Full 12-round persistence and rematch
delivery remain manual until a deterministic result fixture exists.
