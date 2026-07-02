// Runtime mirror of docs/KRONOX_SCORING_RULES.md.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing markdown directly from `docs/` (`.md?raw`) fails at build time.
//   Mirroring the doc as a JS module keeps the Health Center static-contract
//   checks alive while the canonical doc lives under `docs/`.
//   When you change one, change the other — the Health cases cross-check
//   required phrases against this string.

export const SCORING_RULES_DOC_PATH = 'docs/KRONOX_SCORING_RULES.md';

export const SCORING_RULES_DOC = `# Kronox Scoring Rules

Status: Active product contract.

Kronox has one player-facing score language.
Visible UI must use **Puan** or **Kronox Puan**.
Internally, two scoring components feed that visible score.
Technical/internal docs may discuss base score, bonus, streak, accuracy, Solo
component, Online component, and projection details, but those components must
not fragment visible UI language into competing score names.

## Solo scoring
Per-level best score is stored on User.solo_progress and projected into the
leaderboard by getSoloLeaderboard.

Normal Solo levels require 7 correct timeline cards, including seed cards
already on the timeline. Special Solo levels start at level 5 and repeat
every 5 levels; they require 10 correct timeline cards, including seed cards
already on the timeline.
All new Solo attempts use a 180 seconds timer and 2 timeline anchor cards.
Normal levels use 10 evaluated moves; special levels use 13 evaluated moves
only as a mistake buffer. Deck sizing is anchors + level-specific playable
moves + Kart Değiştir/Kronokalkan buffer. The visible counter is HAMLE /
remaining moves. A valid evaluated placement consumes one move; touch, drag
start, invalid drop, joker activation, and tutorial popups do not consume
moves. Using the level-specific move limit without the target card count fails
the attempt.

Star thresholds:
- 5–6 used moves: 3 stars.
- 7–8 used moves: 2 stars.
- 9–10 used moves: 1 star.

Star base points:
- 3 stars: 15 points.
- 2 stars: 10 points.
- 1 star: 5 points.
- fail: 0 points.

Time bonus boundaries (winner elapsed seconds):
- 0–60 seconds: 60.0s yields +15 time bonus.
- 61–90 seconds: 90.0s yields +10 time bonus.
- 91–120 seconds: 120.0s yields +5 time bonus.
- 121–180 seconds: no time bonus.

Solo best score never decreases on replay — only improvements are written.
Same-score replay does not add points. Lower-score replay does not add points.
Better replay adds only the positive score delta.
Old completed Solo results are not retroactively recalculated. New Solo
attempts use soloRulesVersion: 3.

## Online scoring
Online results are recorded per-user in OnlineMatchResult for durable
idempotency (one row per lobby_id + player_email). Each client persists ONLY
its own user via User.online_progress. Online score stays separate from Solo
total score.
Online winner scoring is exactly +15 Kronox Puan, loser scoring is exactly -6
Kronox Puan before checkpoint protection, and Online has no speed bonus.
Elapsed seconds may be shown or stored for audit/diagnostics, but they do not
change the Online score delta.

## Source of truth
- Solo: User.solo_progress
- Online: User.online_progress + OnlineMatchResult
- Unified visible Kronox Puan: Solo best-score total plus Online score.
`;
