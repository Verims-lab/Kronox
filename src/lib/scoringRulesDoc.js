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

## Solo scoring
Per-level best score is stored on User.solo_progress and projected into the
leaderboard by getSoloLeaderboard.

Normal Solo levels require 7 correct cards. Special Solo levels start at
level 10 and repeat every 5 levels; they require 10 correct cards.
All new Solo attempts use a 180 seconds timer and fail on the 10th mistake.

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
Old completed Solo results are not retroactively recalculated. New Solo
attempts use soloRulesVersion: 2.

## Online scoring
Online results are recorded per-user in OnlineMatchResult for durable
idempotency (one row per lobby_id + player_email). Each client persists ONLY
its own user via User.online_progress. Online score stays separate from Solo
total score.

## Source of truth
- Solo: User.solo_progress
- Online: User.online_progress + OnlineMatchResult
- Unified visible Kronox Puan: Solo best-score total plus Online score.
`;
