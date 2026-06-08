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
- src/lib/dbGateway/dailyQuestGateway.js
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
- UserJokerInventory stores current user-owned joker balances per user_email + joker_type and is used by Profile, Solo joker balance display/spend, and Mağaza joker purchases.
- JokerTransaction stores joker ledger/idempotency rows; starter_grant, Solo solo_use, and Mağaza market_purchase rows are active.
- ensureUserJokerInventory grants exactly 3 mistake_shield, 3 card_swap, and 3 time_freeze once per authenticated user with starter_jokers:<email>:<joker_type> idempotency keys.
- spendUserJoker spends one owned Solo joker with reason solo_use, source solo, quantity_delta -1, balance_after, and an idempotency key.
- purchaseJokerWithDiamonds sells only Zaman Dondur for 40 Diamonds, Kart Değiştir for 50 Diamonds, and Kronokalkan for 60 Diamonds; it validates authenticated user context, trusted backend price, sufficient User.diamonds, and writes DiamondTransaction + JokerTransaction market_purchase rows with a per-action idempotency key.
- Daily Wheel is a Diamond source; Mağaza purchase is a Diamond sink. purchaseJokerWithDiamonds is server-authoritative, ignores client price/cost, writes both ledgers with the same idempotency key, and uses best-effort rollback if ledger creation fails. Runtime duplicate-request and partial-failure consistency proof remains manual.
- Profile displays balances under Joker Çantası and does not expose the JokerTransaction ledger.
- Mağaza Phase 1 has no bundles, subscriptions, cosmetics, random boxes, ads, external payments, or Online joker usage.
- DailyQuestDefinition stores admin-managed Daily Quest v1 templates; title/description are display-only and quest_type + target_value drive runtime progress logic through UserDailyQuestProgress.
- createDailyQuestDefinition lists, seeds, creates, and status-updates definitions through an AdminUser-backed owner/admin guard.
- Supported Daily Quest v1 types are start_solo_attempt, correct_cards, complete_solo_level, and use_joker.
- Daily Quest definitions use reward_diamonds only, never Kronox Puan, and do not affect leaderboard.
- Günlük Görev requires active DailyQuestDefinition rows. Runtime functions seed the four default Solo-focused definitions idempotently only when no definition rows exist; getDailyQuestStatus selects the first active definition by sort_order, created_at, and quest_key, is authenticated but not admin-only, preserves newly created rows if immediate refresh is stale, and loading/ensuring today’s quests does not grant Diamonds.
- UserDailyQuestProgress stores the active Daily Quest Runtime v1 selected user/day row. getDailyQuestStatus ensures 1 UTC-day quest idempotently from active definitions, recordDailyQuestProgress increments Solo-only events, and claimDailyQuestReward grants diamonds only with DiamondTransaction source daily_quest_reward. Daily Quest has no leaderboard impact, does not grant Kronox Puan, and one claim per quest per UTC day is enforced by progress/ledger idempotency keys.

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
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane is not difficulty-1 restricted; the global 30% lane prefers difficulty 1 from the full eligible pool where possible and safely falls back when difficulty-1 global candidates are insufficient.
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
- sendQuestionAnalyticsReportEmail actual sent body includes Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori Bazında Soru Havuzu, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Kayıtlı Soru Havuzu, Kategori Bazında Yıl Aralığı, Kategori Tercihleri, Kategori Bazında Gösterim, Kategori İçi Soru Analizi, Kategori Denge Sinyalleri, and Rapor Tamamlandı. Category preference counts are aggregate distinct-user counts only; no user IDs or emails are exposed.
- Kategori Bazında Soru Havuzu is sourced from Question.list static current DB rows, not QuestionAttemptEvent, QuestionStatsProjection, or CategoryStatsProjection. It renders when analytics events/projections are empty and includes active question count, difficulty 1-5/unknown distribution, oldest year, newest year, and Unknown/unmapped diagnostics.
- Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı / Kategori Bazında Kayıtlı Soru Havuzu is sourced from active Question.list registered rows and shows category, difficulty level, registered question count, oldest year, and newest year. It includes asked and never-asked active questions, is independent from analytics events, and remains separate from report-period Kategori Bazında Gösterim.
- Static Question DB pool sections render near the top before long event detail tables; Rapor Bölümleri lists included sections and Rapor Tamamlandı at the end indicates generation completed. Missing completion marker in a received email signals clipping/truncation risk.
- Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı is an email-safe inline HTML/CSS stacked-bar table sourced from active Question rows, includes asked and never-asked questions, avoids JavaScript chart libraries, and visibly states Kaynak: Question tablosu plus Toplam aktif kayıtlı soru.
- Question analytics email shows Rapor Şablonu: static-pool-v2 near the top; if that marker is absent from the real email, the Base44 backend function/template is stale or not redeployed. npm run build only proves the frontend Vite build, not live Base44 function deployment.
- sendQuestionAnalyticsReportEmail is callable from base44/functions/sendQuestionAnalyticsReportEmail/entry.ts with base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc name sendQuestionAnalyticsReportEmail and entry entry.ts; the callable report function inlines the DB-backed AdminUser guard for the current Base44 function runtime so a local _shared import cannot break deploy and leave stale report output.
- sendQuestionAnalyticsReportEmail can be triggered by any active AdminUser role admin/owner. The recipient defaults to the requesting authenticated admin's normalized email; mismatched recipient overrides are rejected; created_by and hardcoded owner addresses are not used as recipients. The function and Settings UI return safe requestedBy, recipientEmail, template, body-marker, and emailDispatchStatus diagnostics.
- Manual DB reset path after question pool replacement is documented because the function reset path is currently not used.
- manual_db_reset_only clears only QuestionAttemptEvent, QuestionStatsProjection, and CategoryStatsProjection by DB maintenance.
- Manual reset must not delete Question, Category, SubCategory, UserCategoryPreference, UserSubCategoryPreference, UserStatsProjection, Solo progress, GameRecord, OnlineMatchResult, Lobby, SoloLeaderboardEntry, Kronox Puan, DiamondTransaction, DailyWheelSpin, UserJokerInventory, JokerTransaction, users, or AdminUser.
- Joker inventory is separate from Diamonds: UserJokerInventory is the joker balance source, JokerTransaction is the joker ledger, Solo spends create solo_use rows, Mağaza purchases create market_purchase rows while spending Diamonds, and Daily Wheel remains Diamond-only.
- cleanupAdminMaintenanceLog requires admin auth, supports dryRun, marks old logs retention_status archived.
- Cleanup jobs are status-transition-first and do not hard delete production data.

Idempotency/platform limitations documented:
- DiamondTransaction.idempotency_key unique is required where Base44 supports unique constraints.
- UserJokerInventory user_email + joker_type unique is required where Base44 supports unique constraints.
- JokerTransaction.idempotency_key unique is required where Base44 supports unique constraints.
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
- Question analytics reset is manual_db_reset_only and clears only QuestionAttemptEvent, QuestionStatsProjection, and CategoryStatsProjection.
- Question analytics reset does not delete Question, Category, SubCategory, UserCategoryPreference, UserSubCategoryPreference, UserStatsProjection, score/progress/economy, leaderboard, Daily Wheel, users, AdminUser, or gameplay rows.

Scaffolded now:
- Online gameplay analytics write coverage is documented/scaffolded only; no Online runtime QuestionAttemptEvent write point is enabled yet.
- Platform unique indexes and live runtime proof are tracked as manual deployment proof, not repo-enforced Health PASS.

Deferred/manual proof:
- Online gameplay analytics write coverage remains future work.
- Deployed email delivery, RLS probes, and high-volume analytics write proof remain manual/NOT_AUTOMATABLE.
`;
