// Codex310 — Health mirror for repo-external DB architecture artifacts.
// Vite cannot reliably raw-import Base44 function/schema/docs files from src,
// so modular Health scans this string while canonical source remains in
// base44/entities, base44/functions, and docs/KRONOX_DB_ARCHITECTURE.md.

export const DB_ARCHITECTURE_IMPLEMENTATION_MIRROR = `
docs/KRONOX_DB_ARCHITECTURE.md exists and tracks the Codex310 DB architecture audit snapshot and implementation package.
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
- PlayerQuestionExposure
- PlayerQuestionDailyExposure
- LobbyMatchStats
- UserCategoryPreference stores app-open popup and Settings main Category interest choices per user.
- UserSubCategoryPreference is retained legacy data from the earlier SubCategory preference phase and is not used by current Settings preferences.
- Question loading for Game first attempts online getQuestions when online or network state is unknown. The signed-in gameplay response is an authenticated bounded minimal server attempt candidate buffer, not a fixed 1200 source-pool projection; first-time guest Solo uses only the explicit capped guest_gameplay_runtime minimal projection, while admin/full-bank/diagnostics still require AdminUser authorization. Empty local question cache is not offline; offline/no-cache is reserved for known offline plus failed fetch plus no usable cache. Question-set/category-projection replacements invalidate stale local cache by question-runtime-v10-solo-architecture version. Gameplay fetches request the v2 per-category projection and server_attempt_candidate_buffer_v1 explicitly; getQuestions fetches numeric/string main_category_id and category_id variants per active Category before the bounded response cap, returns getQuestionsRuntimeMarker for both authenticated and guest modes, exposes projectionDiagnostics only for admin/debug diagnostics, reports sourcePoolCapRemoved and responseCapApplied in the response/diagnostics contract, returns an empty/retryable state instead of fallback IDs when Category read fails, and Question category fields are not capped to the original 1-6 seed set. Authenticated candidate reads are bounded to 96 * 3 = 288 rows per active category/query variant before projection.
- UserJokerInventory stores current user-owned joker balances per normalized user_email + joker_type and is used by Profile, Solo joker balance display/spend, and Mağaza joker purchases. Missing or partial UserJokerInventory rows self-heal for authenticated users; duplicate or malformed rows do not crash Joker Çantası, and repair preserves existing balances.
- JokerTransaction stores joker ledger/idempotency rows; starter_grant, Solo solo_use, and Mağaza market_purchase rows are active.
- Profile/Solo joker balance reads use the shared getUserJokerBalances helper. Complete UserJokerInventory rows render through a fast current-balance read, JokerTransaction is not scanned during render-time balance display, ensureUserJokerInventory runs only for missing/partial rows or explicit retry, and Mağaza purchase/Solo spend update or invalidate the normalized user-scoped cache.
- ensureUserJokerInventory grants exactly 3 mistake_shield, 3 card_swap, and 3 time_freeze once per authenticated user with starter_jokers:<email>:<joker_type> idempotency keys.
- spendUserJoker spends one owned Solo joker with reason solo_use, source solo, quantity_delta -1, balance_after, and an idempotency key; it rejects non-Solo context, uses deploy-safe UserJokerInventory/JokerTransaction entity fallback, and returns safe user-facing errors.
- purchaseJokerWithDiamonds sells only Zaman Dondur for 40 Diamonds, Kart Değiştir for 50 Diamonds, and Kronokalkan for 60 Diamonds; it validates authenticated user context, trusted backend price, sufficient User.diamonds, explicitly binds UserJokerInventory, DiamondTransaction, and JokerTransaction, treats starter self-heal as best-effort, and writes DiamondTransaction + JokerTransaction market_purchase rows with a per-action idempotency key.
- DiamondTransaction helpers re-check user_email + idempotency_key before create and confirm by idempotency_key after create; this is function-level guard only until a DB/entity unique constraint is proven.
- Daily Wheel is a Diamond source; Mağaza purchase is a Diamond sink. purchaseJokerWithDiamonds is server-authoritative, ignores client price/cost, writes both ledgers with the same idempotency key, and uses best-effort rollback if ledger creation fails. Runtime duplicate-request, partial-failure, and inventory-ledger reconciliation proof remains manual.
- Daily Wheel same-day duplicate prevention uses daily_wheel:<playerKey>:<YYYY-MM-DD>, DailyWheelSpin key/date lookup, reserve-first spin rows, canonical same-player/same-day re-read, User/GuestProfile guard re-check, and DiamondTransaction re-check before balance mutation. This is not an atomic upsert without DB/entity uniqueness.
- Profile displays balances under Joker Çantası and does not expose the JokerTransaction ledger.
- Mağaza Phase 1 has no bundles, subscriptions, cosmetics, random boxes, ads, external payments, or Online joker usage.
- DailyQuestDefinition stores admin-managed Daily Quest v1 templates; title/description are display-only and quest_type + target_value drive runtime progress logic through UserDailyQuestProgress.
- createDailyQuestDefinition lists, seeds, creates, and status-updates definitions through an AdminUser-backed owner/admin guard. Admin list is read-only and does not seed defaults on refresh.
- Supported Daily Quest v1 types are start_solo_attempt, correct_cards, complete_solo_level, and use_joker.
- Daily Quest definitions use reward_diamonds only, never Kronox Puan, and do not affect leaderboard. Daily Quest does not grant Kronox Puan. Daily Quest does not affect leaderboard.
- DailyQuestDefinition.quest_key is the logical unique key. Create/default seed skip or reject existing keys; existing duplicate rows are grouped by quest_key with Admin warnings and require manual cleanup after backup.
- Günlük Görev requires active DailyQuestDefinition rows. Runtime functions seed the four default Solo-focused definitions idempotently only when no definition rows exist; getDailyQuestStatus groups duplicate active definitions by quest_key, selects one canonical active definition by sort_order, created_at, and stable id, is authenticated-or-completed-guest but not admin-only, preserves newly created rows if immediate refresh is stale, and loading/ensuring today’s quests does not grant Diamonds.
- Daily Quest Runtime v1 is active.
- UserDailyQuestProgress stores the active Daily Quest Runtime v1 selected player/day row. getDailyQuestStatus ensures 1 UTC-day quest idempotently from active definitions, recordDailyQuestProgress increments Solo-only events, and claimDailyQuestReward grants diamonds only with DiamondTransaction source daily_quest_reward. Runtime functions explicitly bind UserDailyQuestProgress, Home copy says Günlük Görevleri Yap, Elmasları Kazan!, completed guests use token-proven GuestProfile.diamonds and internal guest:<g_owner_key> keys, Daily Quest has no leaderboard impact, Daily Quest does not affect leaderboard, does not grant Kronox Puan, and one claim per quest per UTC day is enforced by progress/ledger idempotency keys. Daily Wheel remains separate from Daily Quest definitions. Daily Wheel and Daily Quest are separate. daily_wheel:<playerKey>:<YYYY-MM-DD>. daily_quest_reward:<playerKey>:<YYYY-MM-DD>:<quest_key>.

Category preference status:
- Settings İlgi Alanlarım reads active Category rows.
- Category interests are stored in UserCategoryPreference rows scoped to user_email.
- Minimum selection count is 3. There is no maximum selection.
- Any authenticated user with fewer than 3 active valid Category preferences sees an optional personalization popup; this applies to new and existing users, can be deferred, and must not block gameplay.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are ignored in UI/save state and must not be resaved as active preferences.
- Users can later change selections under Profile / Settings / İlgi Alanlarım.
- Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication uses the explicit capped guest Solo projection and must not expose raw questions. Insufficient preferences also use all active categories for Solo. Game.jsx explicitly resolves getValidActiveSelectedCategoryIds(preferences, activeCategories) in the Solo-only path before passing selected IDs to the deck builder. Saved preferences target 70% selected user categories and 30% full eligible pool only when at least 3 active valid preferences are available. getQuestions derives active playable category IDs from active Category rows; stale hardcoded seed-category ID subsets must not exclude newer active categories from runtime projection. Active category status aliases accepted by runtime are missing/blank, a, active, and aktif; category_id normalization accepts any positive live DB id.
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane uses selected user categories with difficulty 1 and 2 eligible; the global 30% lane first uses all active categories with difficulty 1, then selected-category shortage or global difficulty-1 shortage fills from the broader active global pool before clean failure.
- Online question selection is not affected by Solo preferences: startLobbyGame
  persists a bounded shared online_question_deck on Lobby, selected 100% from
  active lobby-selected categories with difficulty 1/2 only, and Game reads
  that persisted deck instead of the Solo getQuestions buffer.
- UserCategoryPreference should have a user_email + category_id unique key where Base44 supports it.
- The save helper collapses duplicate active preference rows by passivating duplicateRows.
- SubCategory entity still exists for future normalized metadata, but current Settings preferences use Category.

SEO/GEO boundary implemented now:
- QuestionPublicProjection is opt-in public-safe projection.
- public_visibility controls public rows.
- Raw Question remains protected and must not be exposed as public full question bank.

Leaderboard projection strategy implemented now:
- SoloLeaderboardEntry is the current internal leaderboard projection source.
- total_kronox_score is unified Kronox Puan.
- displayed score and sort score use the same projection value.
- getSoloLeaderboard returns sanitized username plus opaque leaderboard_id and strips raw email, provider ids, raw guest id, owner_key, player_key, and display_name. Completed guest players can open Liderlik and appear through username-only rows backed by internal g_ owner keys.

Cleanup/retention jobs implemented now:
- expireOldGameInvites requires admin auth, supports dryRun, marks pending GameInvite as status expired, and writes AdminMaintenanceLog.
- cancelStaleLobbies requires admin auth, supports dryRun, marks waiting/starting Lobby as status cancelled, and protects active/in_game/finished rows.
- expirePushSubscriptions requires admin auth, supports dryRun, marks stale disabled PushSubscription rows as status expired.
- refreshLeaderboardProjection requires admin auth, supports dryRun, refreshes SoloLeaderboardEntry and UserStatsProjection.
- aggregateQuestionStats requires admin auth, supports dryRun, refreshes QuestionStatsProjection and CategoryStatsProjection from QuestionAttemptEvent only when run as a write; empty projection tables are normal if the manual refresh has not been run.
- sendQuestionAnalyticsReportEmail requires admin auth, sends the full nine-section question analytics report inside the email body with a plain-text fallback, intentionally does not send a PDF attachment for now, and has no scheduled trigger.
- sendQuestionAnalyticsReportEmail actual sent email body includes exactly Executive Summary, Kategori Bazında Soru Havuzu, Kategori Tercihleri, Kategori Bazında Gösterim, En Çok Gösterilen Sorular, Az ya da Hiç Gösterilmeyen Sorular, En Çok Yanlış Yapılan Sorular, Joker Kullanımı Analizi, and Oynanma Zamanı ve Kullanım Ritmi. Kategori Bazında Soru Havuzu includes the category-based Top 10 answer year/count table inside the same section. Category preference counts are aggregate distinct-user counts only; no user IDs or emails are exposed.
- Joker Kullanımı Analizi and Oynanma Zamanı ve Kullanım Ritmi must be table-based and show structured Yeterli veri yok rows when exact event fields are missing.
- Removed legacy report sections must not appear in generated email output: Rapor Şablonu, Rapor Bölümleri, Sistemdeki Soru Havuzu: Kategori / Zorluk Dağılımı, Kategori ve Zorluk Bazında Kayıtlı Soru Sayısı, Kategori Bazında Yıl Aralığı, and Kategori İçi Soru Analizi.
- Live report deploy proof reads reportBuildMarker Codex347, templateVersion nine-section-email-v1, emailBodyMode nine_section_email_body, reportDeliveryMode email_body_only, bodyContainsExactlyRequiredSections true, requiredSectionOrderValid true, renderedSectionHeaderCount 9, and bodyLength > 1000; npm run build only proves the frontend Vite build, not live Base44 function deployment or SendEmail receipt.
- Question Analytics report separates active pool, Solo-eligible pool, and Runtime Projection diagnostics; Runtime Projection is based on getQuestions diagnostics and is not fabricated by email generation.
- Top-shown category/subcategory concentration is a generic guardrail and must be compared with the Solo-eligible pool before fairness conclusions.
- sendQuestionAnalyticsReportEmail is callable from base44/functions/sendQuestionAnalyticsReportEmail/entry.ts with base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc name sendQuestionAnalyticsReportEmail and entry entry.ts; the callable report function inlines the DB-backed AdminUser guard for the current Base44 function runtime so a local _shared import cannot break deploy and leave stale report output.
- sendQuestionAnalyticsReportEmail can be triggered by any active AdminUser role admin/owner. The recipient defaults to the requesting authenticated admin's normalized email; mismatched recipient overrides are rejected; created_by and hardcoded owner addresses are not used as recipients. The function and Admin Ekranı UI return safe requestedBy, recipientEmail, template, body-marker, and emailDispatchStatus diagnostics.
- Manual DB reset path after question pool replacement is documented because the function reset path is currently not used.
- manual_db_reset_only clears QuestionAttemptEvent, PlayerQuestionDailyExposure, and any populated QuestionStatsProjection/CategoryStatsProjection manual aggregate rows by DB maintenance.
- PlayerQuestionExposure is optional reset scope only when per-player anti-repeat memory should restart; clearing it resets the same-player question freshness memory.
- Manual reset must not delete Question, Category, SubCategory, User, GuestProfile, PlayerProfile, UserCategoryPreference, UserSubCategoryPreference, UserStatsProjection, Solo progress, GameRecord, OnlineMatchResult, Lobby, SoloLeaderboardEntry, Kronox Puan, DiamondTransaction, DailyWheelSpin, Daily Quest, UserJokerInventory, JokerTransaction, users, or AdminUser.
- Static pool and category preference report sections still use current Question, Category, and UserCategoryPreference rows after analytics cleanup.
- Joker Kullanımı Analizi may continue to show ledger-derived history from JokerTransaction and current-state UserJokerInventory after question analytics reset. DiamondTransaction and DailyWheelSpin activity signals are economy/audit rows and are not question analytics reset tables. Oynanma Zamanı hour/day metrics reset through QuestionAttemptEvent timestamps.
- Joker inventory is separate from Diamonds: UserJokerInventory is the joker balance source, JokerTransaction is the joker ledger, Solo spends create solo_use rows, Mağaza purchases create market_purchase rows while spending Diamonds, and Daily Wheel remains Diamond-only.
- cleanupAdminMaintenanceLog requires admin auth, supports dryRun, marks old logs retention_status archived.
- Cleanup jobs are status-transition-first and do not hard delete production data.

Idempotency/platform limitations documented:
- DiamondTransaction.idempotency_key unique is required where Base44 supports unique constraints.
- UserJokerInventory user_email + joker_type unique and user_email index are required where Base44 supports unique/index constraints.
- JokerTransaction.idempotency_key unique is required where Base44 supports unique constraints.
- OnlineMatchResult.idempotency_key unique is required where Base44 supports unique constraints.
- OnlineMatchResult lobby_id + player_email unique is required where Base44 supports unique constraints.
- PushSubscription user_email + endpoint unique is required where Base44 supports unique constraints.
- Base44 index/unique-key declarations are a platform/manual configuration gap when not expressible in repo schema.
- AdminUser.email unique and role + status indexes are required where Base44 supports them.
- DailyQuestDefinition.quest_key unique, status + sort_order, and quest_key + created_at indexes are required where Base44 supports them. If Base44 cannot enforce uniqueness, service-level duplicate guards and manual cleanup proof are required.
- UserDailyQuestProgress.idempotency_key unique and user_email + quest_date + quest_key unique are required where Base44 supports them.
- UserDailyQuestProgress user_email + quest_date + status index is required where Base44 supports it.
- DailyWheelSpin.idempotency_key unique and user_email + spin_date unique are required where Base44 supports them.
- UserCategoryPreference user_email + category_id unique is required where Base44 supports it.
- FriendRequest to_email + status, from_email + status, and from_email + to_email + status indexes are required where Base44 supports them.
- GameInvite to_email + status + expires_at, from_email + status, and lobby_id indexes are required where Base44 supports them.
- Question state + main_category_id, state + difficulty, and state + sub_category indexes are required where Base44 supports them.
- QuestionAttemptEvent.event_id unique and question_id + created_at / user_key + created_at indexes are required where Base44 supports them.
- QuestionStatsProjection.question_id unique and CategoryStatsProjection category_id + sub_category indexes are required where Base44 supports them.
- Runtime uniqueness proof remains manual/NOT_AUTOMATABLE until platform constraints are configured.
- DB/entity unique plus function-level guard = Low; function-level guard only = Medium/P1 hardening; neither DB/entity unique nor function-level guard = High.
- Codex310 audit keeps mutable user-owned data server/auth scoped, prefers online fetch before offline fallback for question runtime, uses projection/ledger rows for public and economy surfaces, and keeps final iOS IPA/icon, two-account RLS, and backend deploy proof as manual gates.
- Hot UI paths read current-state tables/projections directly and must not sum append-only ledgers or scan full analytics history during render.
- Admin/Health/report paths may process larger datasets, but they should batch, paginate, cap output, or yield work so long JavaScript tasks do not block the app shell.
- Gameplay must not run Health, report, projection refresh, cleanup, or aggregate maintenance jobs.
- Service-role functions bind every user-owned object to authenticated user/admin context before reading, writing, updating, or deleting it.
- If Base44 cannot enforce a DB-level unique/index constraint, the service layer remains responsible for idempotency and duplicate detection.

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
- Question analytics report history is sourced from QuestionAttemptEvent raw events; QuestionStatsProjection and CategoryStatsProjection are manual aggregateQuestionStats outputs and may be empty.
- Question analytics reset is manual_db_reset_only and clears QuestionAttemptEvent, PlayerQuestionDailyExposure, plus QuestionStatsProjection/CategoryStatsProjection only if those optional projection rows are populated.
- PlayerQuestionExposure is optional reset scope because it is runtime anti-repeat memory, not report history.
- Question analytics reset does not delete Question, Category, SubCategory, UserCategoryPreference, UserSubCategoryPreference, UserStatsProjection, score/progress/economy, leaderboard, Daily Wheel, users, AdminUser, or gameplay rows.
- Question analytics reset does not clear JokerTransaction, DiamondTransaction, UserJokerInventory, or DailyWheelSpin; ledger-derived Joker/economy report signals may remain visible.
- PlayerQuestionExposure is the fast per-player Solo freshness projection keyed logically by player_key + question_id + mode.
- PlayerQuestionDailyExposure is the daily anonymous coverage projection keyed logically by date_utc + player_key + question_id + mode.
- player_key is an internal server-derived owner-style key: authenticated users use u_ and guests use GuestProfile owner_key / g_ only after guest_id + raw guest token verification.
- Exposure rows are written only when an active card, replacement card, or tutorial card is actually shown. Candidate pools, server buffers, unused reserve cards, and never-shown replacement buffers are not counted.
- linkGuestAccount best-effort merges recent guest exposure projection rows into the registered u_ key so anti-repeat continuity survives Google / Apple / Email linking. It also preserves guest Diamonds, Daily Wheel/Daily Quest guard fields/history, leaderboard username identity, category preferences, progress, and inventory where applicable.
- Question Analytics report may include anonymous per-player coverage inside the existing nine-section email body only as User0001-style labels; it must not expose email, provider ids, raw guest id/token, owner key, internal player_key, or username.

Scaffolded now:
- Online gameplay analytics write coverage is documented/scaffolded only; no Online runtime QuestionAttemptEvent write point is enabled yet.
- Platform unique indexes and live runtime proof are tracked as manual deployment proof, not repo-enforced Health PASS.

Deferred/manual proof:
- Online gameplay analytics write coverage remains future work.
- Deployed email delivery, RLS probes, and high-volume analytics write proof remain manual/NOT_AUTOMATABLE.
`;
