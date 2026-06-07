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
- VAPID private key remains a real secret and must stay secret-managed.
- Current source of truth for admin authorization is the private AdminUser entity.
- Shared backend guard: base44/functions/_shared/adminAuth.ts.
- Active AdminUser rows require normalized lowercase email, role: "admin" or owner, and status: "active".
- disabled/missing AdminUser rows are denied.
- There is no unsafe "if no admin exists, everyone is admin" fallback.
- Do not commit the personal admin emails to source.
- Admin email env allowlists are not used for authorization.
- Client admin UI consumes the backend getAdminStatus status hint; /getAdminStatus is the callable status path.
- AdminUser rows remain private and are not listed by normal users.
- admin-only maintenance functions verify AdminUser-backed authorization server-side.
- account deletion is a destructive, NOT_AUTOMATABLE manual proof gate.
- sendQuestionAnalyticsReportEmail is manual/admin-triggered only and sends HTML/table/bar formatted question analytics with text fallback.
- resetQuestionAnalyticsData is manual/admin-triggered only, requires explicit confirmation, clears only QuestionAttemptEvent, QuestionStatsProjection, and CategoryStatsProjection, and logs AdminMaintenanceLog.
- question analytics reset does not delete Question, Category, UserCategoryPreference, score/progress/economy, leaderboard, Daily Wheel, or gameplay rows.
- sendQuestionAnalyticsReportEmail handles stale/deleted question references with diagnostics and bounded sections.
- sendQuestionAnalyticsReportEmail actual sent body includes Kategori Bazında Soru Havuzu, Kategori Tercihleri, Kategori Bazında Gösterim, Kategori İçi Soru Analizi, and Kategori Denge Sinyalleri.
- Category preference report counts are aggregate distinct-user counts only and do not expose user IDs or emails.
- Question analytics report sections render with section-level warnings instead of truncating the whole email.
- user progress admin reset retains question analytics rows; account deletion anonymizes user-owned analytics identity.
- retained QuestionAttemptEvent analytics rows no longer contain deleted user identity after account deletion.
- UserCategoryPreference rows are user-scoped Settings data.
- normal users can read/update only their own preference rows.
- passive Category.status = P/p rows are not selectable.
- Any user with fewer than 3 active valid Category preferences sees the popup; this applies to new and existing users.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are filtered from UI/save state and are not resaved as active preferences.
- completing the popup saves UserCategoryPreference rows before marking the user profile onboarding flag complete.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- Solo question selection reads current-user active valid Category preferences before attempt start and targets 70% selected categories / 30% full eligible pool as soft weighting with fallback.
- Online question selection, getQuestions, and analytics do not read preferences for question selection.
- two-account preference RLS proof remains manual/NOT_AUTOMATABLE.
- old UserSubCategoryPreference rows are retained but not used by the current Settings preference UI.
`;

export const RELEASE_PROOF_CHECKLIST_DOC = `# Kronox Release Proof Checklist

Status: Active manual release gate.

## Solo v2
Normal levels need 7 correct cards with a 16-question deck; special levels
need 10 correct cards with a 19-question deck. All attempts use a 180 seconds
timer and fail on the 10th mistake. Runtime consumes the deck in order. The
first 5 ordered active player question cards keep a minimum 5-year spacing.
Seed/preplaced timeline cards avoid close-year conflicts with those early
active cards.
Visible placed/seed timeline years and the current active card avoid 1-4 year
conflicts where a safe prebuilt-deck alternative exists.
P1 balance distributes rich-pool decks across category, subcategory, theme, and
decade buckets while keeping hard Solo rules mandatory.
P2 diagnostics are Health/admin/helper-only: deck diagnostics, question pool
health, difficulty-readiness, replay-variety, and Kart Değiştir replacement
diagnostics must not appear in normal player UI.
Runtime Solo QuestionAttemptEvent writes are best-effort and manual admin
question analytics email delivery plus Gmail rendering remains deployed/backend proof.
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

## Settings Category Preferences
Settings shows İlgi Alanlarım for authenticated users. Active Category
rows load as selectable interests, passive rows are hidden, users must select
at least 3 Category interests. There is no maximum selection. Preferences are
persisted per user in UserCategoryPreference. Solo question selection targets
70% selected user categories and 30% full eligible pool; Online question
selection is not affected. Any user with fewer than 3 active valid
Category preferences sees the popup, including new and existing users. The
source of truth is active valid UserCategoryPreference count, only active
categories are selectable and count, passive or removed Category selections are
filtered from active UI/save state, completion prevents repeat prompts only while
the user still has 3 or more active valid preferences, and Users can later change
selections under Profile / Settings / İlgi Alanlarım. SubCategory entity still exists, but Settings currently uses Category interests.
Mobile wrapping/long-name visual proof and two-account preference RLS proof
remain manual/NOT_AUTOMATABLE.
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
- Solo QuestionAttemptEvent runtime writes are enabled best-effort; Online analytics remains deferred.
- Manual admin question analytics HTML/table/bar email report exists with no scheduled trigger.
- Admin-only resetQuestionAnalyticsData can reset question analytics history/projections after replacing the question pool.
- Question analytics reports handle empty analytics state and stale/deleted question IDs safely.
- Question analytics reports include category pool counts, aggregate category preference counts, category exposure counts, within-category most/least/never-shown analysis, and category fairness signals.
- Legacy candidates kept without deletion: Friendship, GameRecord, LobbyMessage.
- Raw Question remains protected.
- UserCategoryPreference stores app-open popup and Settings Category preferences per user; minimum 3 selections. There is no maximum selection.
- Solo question selection targets 70% selected user categories and 30% full eligible pool when at least 3 active valid preferences are available.
- This is a soft weighting target with fallback, not hard filtering.
- Online question selection is not affected.
- Any user with fewer than 3 active valid Category preferences sees the popup; this applies to new and existing users.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- UserCategoryPreference duplicate active rows are collapsed/passivated by the save helper; platform unique-key proof remains manual.
- UserCategoryPreference RLS runtime proof remains manual/NOT_AUTOMATABLE.
- UserSubCategoryPreference rows are retained legacy data and are not the current Settings source-of-truth.
`;
