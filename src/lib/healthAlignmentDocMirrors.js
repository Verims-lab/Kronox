// Runtime mirrors for repo-root / docs markdown consumed by the Health
// Center alignment suite.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach outside of `src/` on this host, so
//   importing markdown directly from the repo root or `docs/` (`.md?raw`)
//   fails at build time. Mirroring the docs as JS strings keeps the Health
//   Center static-contract checks alive while the canonical docs live in
//   the repo. When you change one, change the other — the Health cases
//   cross-check required phrases against these strings.

export const CORE_PROMPT_DOC = `# KRONOX Core Prompt

Status: Active product contract.

Manual runtime proof gates remain visible and NOT_AUTOMATABLE:
- two-account invite + scoring proof
- RLS probe matrix
- push subscription on a real installed device
- destructive account deletion proof
- Android wrapper edge-to-edge and large-screen/orientation proof
- mobile safe-area proof
- real-device drag/drop proof
`;

export const KRONOX_DOC = `# Kronox

Status: Active product overview.

Kronox is a timeline placement game with Solo and Online modes, a Diamond
economy, friends/invites, leaderboard projection, and a Health Center that
keeps product contracts honest.
`;

export const SECURITY_DEPLOYMENT_DOC = `# Kronox Security & Deployment

Status: Active product contract.

- getQuestions requires auth.
- startLobbyGame requires authenticated host, no legacy guest, no client identity override.
- Service-role usage is scoped to admin/maintenance backend functions.
- Secrets (VAPID, admin emails) live in environment variables, never in client code.
- admin-only maintenance functions verify role === 'admin'.
- account deletion is a destructive, NOT_AUTOMATABLE manual proof gate.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

Status: Active manual release gate.

## Solo v2
Normal levels need 7 correct cards with a 16-question deck; special levels
need 10 correct cards with a 19-question deck. All attempts use a 180 seconds
timer and fail on the 10th mistake. Runtime consumes the deck in order. The
first 5 ordered active player question cards keep a minimum 5-year spacing.
Same-score replay does not add points. Lower-score replay does not add points.
Better replay adds only the positive score delta. Old completed Solo results
are not retroactively recalculated.

## Online Scoring Persistence
Two-account invite + scoring proof, OnlineMatchResult idempotency.

## RLS And Backend Security
Two/three-account RLS probe matrix, service-role scoping.

## PWA / Push
Push subscription works on real installed device if supported. (manual)

## Android 15 Edge-To-Edge
Play Console reports Window.setStatusBarColor / Window.setNavigationBarColor
deprecations from the native wrapper. Upload a new AAB and verify edge-to-edge
behavior. Do not mark this complete from static Health alone.

## Android Large-Screen / Orientation / Resizability
Verify tablet, foldable, and resizable behavior in Play Console and on device.
Do not mark this complete from static Health alone.
`;

export const CATEGORY_TAXONOMY_DOC = `# Kronox Category Taxonomy

Status: Active product contract.

category_id is the single canonical live field. Canonical categories:
Chronicle, Flashback, Kült, Viral, Arena, Level Up.
`;

export const DB_ARCHITECTURE_DOC = `# Kronox DB Architecture

Status: Implementation tracking doc.

- DB gateway modules wrap entity access.
- Analytics entities: QuestionAttemptEvent, QuestionStatsProjection,
  UserStatsProjection, CategoryStatsProjection.
- Leaderboard projection: SoloLeaderboardEntry.
- cleanup/retention jobs are status-transition-first.
- Base44 index/unique-key declarations are a platform/manual configuration gap.
- Runtime uniqueness proof remains manual/NOT_AUTOMATABLE.
- Legacy candidates kept without deletion: Friendship, GameRecord, LobbyMessage.
- Raw Question remains protected.
`;
