// Codex183 — Health mirror for repo-external DB architecture artifacts.
// Vite cannot reliably raw-import Base44 function/schema/docs files from src,
// so modular Health scans this string while canonical source remains in
// base44/entities, base44/functions, and docs/KRONOX_DB_ARCHITECTURE.md.

export const DB_ARCHITECTURE_IMPLEMENTATION_MIRROR = `
docs/KRONOX_DB_ARCHITECTURE.md exists and tracks the Codex183 DB architecture implementation package.
Implemented now:
- src/lib/dbGateway/questionGateway.js
- src/lib/dbGateway/categoryGateway.js
- src/lib/dbGateway/inviteGateway.js
- src/lib/dbGateway/lobbyGateway.js
- src/lib/dbGateway/scoringGateway.js
- src/lib/dbGateway/economyGateway.js
- src/lib/dbGateway/leaderboardGateway.js
- src/lib/dbGateway/analyticsGateway.js
- src/lib/dbGateway/cleanupGateway.js
- src/lib/dbGateway/index.js

Analytics/statistics entities implemented now:
- QuestionAttemptEvent
- QuestionStatsProjection
- UserStatsProjection
- CategoryStatsProjection
- LobbyMatchStats
- UserCategoryPreference stores app-open popup and Settings main Category interest choices per user.
- UserSubCategoryPreference is retained legacy data from the earlier SubCategory preference phase and is not used by current Settings preferences.

Category preference status:
- Settings İlgi Alanlarım reads active Category rows.
- Category interests are stored in UserCategoryPreference rows scoped to user_email.
- Minimum selection count is 3. There is no maximum selection.
- Any user with fewer than 3 active valid Category preferences sees the popup; this applies to new and existing users.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are ignored in UI/save state and must not be resaved as active preferences.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- Solo question selection targets 70% selected user categories and 30% full eligible pool when at least 3 active valid preferences are available.
- This is a soft weighting target with fallback, not hard filtering.
- Online question selection is not affected.
- UserCategoryPreference should have a user_email + category_id unique key where Base44 supports it.
- The save helper collapses duplicate active preference rows by passivating duplicateRows.
- SubCategory entity still exists for future normalized metadata, but current Settings preferences use Category.

SEO/GEO boundary implemented now:
- QuestionPublicProjection is opt-in public-safe projection.
- public_visibility controls public rows.
- Raw Question remains protected and must not be exposed as public full question bank.

Leaderboard projection strategy implemented now:
- SoloLeaderboardEntry is the current canonical public-safe leaderboard projection.
- total_kronox_score is unified Kronox Puan.
- displayed score and sort score use the same projection value.
- public rows must not expose raw email.

Cleanup/retention jobs implemented now:
- expireOldGameInvites requires admin auth, supports dryRun, marks pending GameInvite as status expired, and writes AdminMaintenanceLog.
- cancelStaleLobbies requires admin auth, supports dryRun, marks waiting/starting Lobby as status cancelled, and protects active/in_game/finished rows.
- expirePushSubscriptions requires admin auth, supports dryRun, marks stale disabled PushSubscription rows as status expired.
- refreshLeaderboardProjection requires admin auth, supports dryRun, refreshes SoloLeaderboardEntry and UserStatsProjection.
- aggregateQuestionStats requires admin auth, supports dryRun, refreshes QuestionStatsProjection and CategoryStatsProjection from QuestionAttemptEvent.
- sendQuestionAnalyticsReportEmail requires admin auth, sends a manual HTML/table/bar formatted question analytics email report, includes a plain-text fallback, and has no scheduled trigger.
- sendQuestionAnalyticsReportEmail actual sent body includes Kategori Bazında Soru Havuzu, Kategori Tercihleri, Kategori Bazında Gösterim, Kategori İçi Soru Analizi, and Kategori Denge Sinyalleri. Category preference counts are aggregate distinct-user counts only; no user IDs or emails are exposed.
- resetQuestionAnalyticsData requires admin auth and explicit RESET_QUESTION_ANALYTICS confirmation, clears only QuestionAttemptEvent, QuestionStatsProjection, and CategoryStatsProjection after question pool replacement, and writes AdminMaintenanceLog.
- cleanupAdminMaintenanceLog requires admin auth, supports dryRun, marks old logs retention_status archived.
- Cleanup jobs are status-transition-first and do not hard delete production data.

Idempotency/platform limitations documented:
- DiamondTransaction.idempotency_key unique is required where Base44 supports unique constraints.
- OnlineMatchResult.idempotency_key unique is required where Base44 supports unique constraints.
- OnlineMatchResult lobby_id + player_email unique is required where Base44 supports unique constraints.
- PushSubscription user_email + endpoint unique is required where Base44 supports unique constraints.
- Base44 index/unique-key declarations are a platform/manual configuration gap when not expressible in repo schema.
- Runtime uniqueness proof remains manual/NOT_AUTOMATABLE until platform constraints are configured.

Legacy entity status:
- Friendship is kept as legacy/candidate, no deletion without reference proof.
- GameRecord is kept as legacy/candidate, no deletion without reference proof.
- LobbyMessage is kept as legacy/candidate, no deletion without reference proof.
- UserSubCategoryPreference rows are retained legacy data and are not the current Settings source-of-truth.

Implemented now:
- QuestionAttemptEvent gateway exists and analytics writes are best-effort.
- Solo runtime writes shown, answered, swapped_out, and replacement_shown events.
- aggregateQuestionStats counts shown/replacement_shown, answered, and swapped_out event types separately.
- aggregateQuestionStats and sendQuestionAnalyticsReportEmail ignore stale analytics rows that reference deleted/missing Question IDs with diagnostics.
- Question analytics reset does not delete Question, Category, UserCategoryPreference, score/progress/economy, leaderboard, Daily Wheel, or gameplay rows.

Scaffolded now:
- Online gameplay analytics write coverage is documented/scaffolded only; no Online runtime QuestionAttemptEvent write point is enabled yet.
- Platform unique indexes and live runtime proof are tracked as manual deployment proof, not repo-enforced Health PASS.

Deferred/manual proof:
- Online gameplay analytics write coverage remains future work.
- Deployed email delivery, RLS probes, and high-volume analytics write proof remain manual/NOT_AUTOMATABLE.
`;
