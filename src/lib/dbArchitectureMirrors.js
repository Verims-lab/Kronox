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
- UserCategoryPreference stores app-open popup and Profile Info main Category interest choices per user.
- UserSubCategoryPreference is retained legacy data from the earlier SubCategory preference phase and is not used by current Profile Info preferences.
- Question loading for Game first attempts online getQuestions when online or network state is unknown. The signed-in gameplay response is an authenticated bounded minimal server attempt candidate buffer, not a fixed 1200 source-pool projection; first-time guest Solo uses only the explicit capped guest_gameplay_runtime minimal projection, while admin/full-bank/diagnostics still require AdminUser authorization. Empty local question cache is not offline; offline/no-cache is reserved for known offline plus failed fetch plus no usable cache. Question-set/category-projection replacements invalidate stale local cache by question-runtime-v10-solo-architecture version. Gameplay fetches request the v2 per-category projection and server_attempt_candidate_buffer_v1 explicitly; getQuestions fetches numeric/string main_category_id and category_id variants per active Category before the bounded response cap, returns getQuestionsRuntimeMarker for both authenticated and guest modes, exposes projectionDiagnostics only for admin/debug diagnostics, reports sourcePoolCapRemoved and responseCapApplied in the response/diagnostics contract, returns an empty/retryable state instead of fallback IDs when Category read fails, and Question category fields are not capped to the original 1-6 seed set. Authenticated candidate reads are bounded to 96 * 3 = 288 rows per active category/query variant before projection.
- PlayerPresence is the backend-owned Online/social presence source. updatePlayerPresence writes linked actors from auth.me or completed guests from guest_id + guest_token proof, stores anonymized owner_key_hash, and keeps user_email backend-private for routable linked invites only. getOnlinePlayerSelection returns username-safe player rows with opaque u_/g_ target refs; non-routable guest presence is visible but disabled for direct GameInvite creation instead of causing raw 500 errors.
- UserJokerInventory stores current user-owned joker balances per normalized user_email + joker_type and is used by Profile, Solo joker balance display/spend, and Mağaza joker purchases. Missing or partial UserJokerInventory rows self-heal for authenticated users; duplicate or malformed rows do not crash Joker Çantası, and repair preserves existing balances.
- JokerTransaction stores joker ledger/idempotency rows; starter_grant, Solo solo_use, and Mağaza market_purchase rows are active.
- Profile/Solo joker balance reads use the shared getUserJokerBalances helper. Complete UserJokerInventory rows render through a fast current-balance read, JokerTransaction is not scanned during render-time balance display, ensureUserJokerInventory runs only for missing/partial rows or explicit retry, and Mağaza purchase/Solo spend update or invalidate the normalized user-scoped cache.
- ensureUserJokerInventory grants exactly 3 mistake_shield, 3 card_swap, and 3 time_freeze once per authenticated user with starter_jokers:<email>:<joker_type> idempotency keys.
- spendUserJoker spends one owned Solo joker with reason solo_use, source solo, quantity_delta -1, balance_after, and an idempotency key; it rejects non-Solo context, uses deploy-safe UserJokerInventory/JokerTransaction entity fallback, and returns safe user-facing errors.
- UserHintInventory stores current user-owned Hint / İpucu balances per normalized user_email or internal guest:<g_owner_key> actor key and is used by Mağaza Hint packages, Advantage package hint portions, Solo starter/consume paths, and read-only Profile Joker Çantası İpucu display.
- HintTransaction stores hint ledger/idempotency audit rows; Mağaza market_purchase, Solo starter_grant, and Solo solo_use rows are active. consumeUserHint spends one Hint server-side with EconomyOperationLock, idempotency re-checks, sanitized responses, no Kronox Puan, no leaderboard impact, and Profile never scans ledger rows for display balance.
- purchaseJokerWithDiamonds owns the expanded Store Diamond-spend product table: Joker packages, Hint packages, and Advantage packages. It validates authenticated user context, trusted backend product price, sufficient User.diamonds, explicitly binds UserJokerInventory, UserHintInventory, DiamondTransaction, JokerTransaction, and HintTransaction, treats starter self-heal as best-effort, and writes DiamondTransaction plus matching grant ledgers with per-action/per-grant idempotency keys.
- DiamondTransaction helpers re-check user_email + idempotency_key before create and confirm by idempotency_key after create; this is function-level guard only until a DB/entity unique constraint is proven.
- Daily Wheel V2 can be a Diamond source and approved joker grant source; Mağaza purchase is a Diamond sink. purchaseJokerWithDiamonds is server-authoritative, ignores client price/cost, writes spend/grant ledgers with linked idempotency keys, and uses best-effort rollback if ledger creation fails. Runtime duplicate-request, partial-failure, and inventory-ledger reconciliation proof remains manual.
- Daily Wheel V2 same-day duplicate prevention uses daily_wheel:<playerKey>:<YYYY-MM-DD>, DailyWheelSpin key/date lookup, reserve-first spin rows, canonical same-player/same-day re-read, User/GuestProfile guard re-check, DiamondTransaction re-check for Diamond portions, and JokerTransaction idempotency keys for approved joker portions. Reward selection, Gift Box package selection, and reward_segment_index are server-owned. This is not an atomic upsert without DB/entity uniqueness. adminResetDailyWheelState is AdminUser-gated, accepts Kronox User ID, archives same-day DailyWheelSpin/DiamondTransaction/JokerTransaction idempotency keys to preserve completed reward rows, sets daily_wheel_auto_popup_reset_at, and does not reverse rewards, grant rewards, affect Daily Quest, Kronox Puan, or leaderboard.
- Profile displays Kronokalkan, Kart Değiştir, Zaman Dondur, and İpucu balances under Joker Çantası in one compact row and does not expose JokerTransaction or HintTransaction ledger details.
- Mağaza Store displays real-money Diamond packages, Diamond-spend Joker packages, Diamond-spend Hint packages, Diamond-spend Advantage packages, and future KronoClub / Reklamları Kaldır sections. Store section subtitles/explanatory copy, Diamond unit prices, decorative Diamond dots, and persistent purchase-success banners are not rendered. Real-money Diamond cards show amount + Elmas as two lines and stay visible but disabled with exact Yakında copy and real_money_unavailable reason; KronoClub and Reklamları Kaldır stay visible but disabled with exact Yakında copy and future_feature reason. Diamond-spend Joker/Hint/Advantage cards show price on-card and open a package-detail popup before purchase. Hint package prices are 5/15/40 İpucu = 150/400/800 Diamonds in both client catalog and purchaseJokerWithDiamonds. None grant without approved IAP/payment verification. Store purchases do not grant Kronox Puan and do not affect Leaderboard; Online joker usage remains absent.
- DailyQuestDefinition is legacy/admin-only for historical/manual cleanup; the Daily Calendar / Streak runtime ignores definition rows.
- createDailyQuestDefinition remains a guarded legacy callable, but runtime and Admin UI do not depend on it.
- cleanupLegacyDailyQuests is AdminUser-gated, defaults to dry_run, requires DELETE_LEGACY_DAILY_QUESTS for destructive deletion, and only targets legacy DailyQuestDefinition plus non-daily_calendar UserDailyQuestProgress rows.
- Daily Calendar / Streak uses UserDailyQuestProgress daily_calendar:* rows: 3 tasks per server day, 9-day rotating task template cycle, event-based idempotent progress, and zero per-task reward_diamonds.
- Home GÜNLÜK shortcut opens /daily; Günlük is not added to BottomNav.
- claimDailyQuestReward grants the 7-day streak reward server-side with DiamondTransaction source daily_calendar_streak_reward for exactly 200 Diamonds, updates daily_calendar_* fields, does not grant Kronox Puan, and does not affect Leaderboard. DailyPage shows only GÜNLÜK in the header, only Tamamlandı and Bugün in the legend, no renewal countdown, title-only task rows, and only 200 Elmas for the 7-day reward UI with no Gift Box icon/name.
- Completed guests use token-proven GuestProfile.diamonds and internal guest keys without exposing raw guest tokens. Daily Wheel remains separate from Daily Calendar. daily_wheel:<playerKey>:<YYYY-MM-DD>. daily_calendar_streak:<playerKey>:<streak_anchor_date>:<claim_number>:200.

Category preference status:
- Profile > Profil Bilgileri Kategori seçimi reads active Category rows.
- Category interests are stored in UserCategoryPreference rows scoped to user_email.
- Minimum selection count is 3. There is no maximum selection.
- Any authenticated new or existing user with fewer than 3 active valid Category preferences is eligible for the optional personalization popup only after active Category metadata has loaded successfully; transient Category load failures fail open, the prompt can be deferred, and gameplay must not be blocked.
- The source of truth is active valid UserCategoryPreference count.
- Only active categories are selectable and count.
- Passive or removed Category selections are ignored in UI/save state and must not be resaved as active preferences.
- Users can later change selections under Profile > Profil Bilgileri > Kategori seçimi.
- Authenticated users with no saved preferences or empty preferences use all active categories for Solo; missing authentication uses the explicit capped guest Solo projection and must not expose raw questions. Insufficient preferences also use all active categories for Solo. Game.jsx explicitly resolves getValidActiveSelectedCategoryIds(preferences, activeCategories) in the Solo-only path before passing selected IDs to the deck builder. Saved preferences target 70% selected user categories and 30% full eligible pool only when at least 3 active valid preferences are available. getQuestions derives active playable category IDs from active Category rows; stale hardcoded seed-category ID subsets must not exclude newer active categories from runtime projection. Active category status aliases accepted by runtime are missing/blank, a, active, and aktif; category_id normalization accepts any positive live DB id.
- This is a soft weighting target with fallback, not hard filtering. The selected-category 70% lane uses selected user categories with difficulty 1 and 2 eligible; the global 30% lane first uses all active categories with difficulty 1, then selected-category shortage or global difficulty-1 shortage fills from the broader active global pool before clean failure.
- Online question selection is not affected by Solo preferences: startLobbyGame
  persists a bounded shared online_question_deck on Lobby, selected 100% from
  active lobby-selected categories with difficulty 1/2 only, and Game reads
  that persisted deck instead of the Solo getQuestions buffer.
- UserCategoryPreference should have a user_email + category_id unique key where Base44 supports it.
- The save helper collapses duplicate active preference rows by passivating duplicateRows.
- SubCategory entity still exists for future normalized metadata, but current Profile Info preferences use Category.

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
- Joker inventory is separate from Diamonds: UserJokerInventory is the joker balance source, JokerTransaction is the joker ledger, Solo spends create solo_use rows, Mağaza purchases create market_purchase rows while spending Diamonds, and Daily Wheel V2 may create daily_wheel joker grant rows without using Mağaza purchase semantics.
- cleanupAdminMaintenanceLog requires admin auth, supports dryRun, marks old logs retention_status archived.
- Cleanup jobs are status-transition-first and do not hard delete production data.

Idempotency/platform limitations documented:
- GFable 5 index support model: Base44 repo JSONC entity schemas cannot declare indexes/unique constraints; unique/index setup is Base44 platform/manual configuration and remains a manual release gate. When platform constraints are unavailable, function-level guard + EconomyOperationLock + duplicate dry-run monitoring remain the runtime enforcement.
- Duplicate cleanup must complete before any unique constraint is configured (index before duplicate cleanup is not allowed). adminDuplicateKeyReport is the AdminUser-gated, read-only duplicate dry-run tool: mode dry_run (default) and prepare_cleanup_plan are both read-only, return masked counts/sample keys only, never delete/merge/mutate rows or balances, and destructive cleanup is intentionally not implemented until canonical-row semantics are approved.
- GFable 5 P0 unique priorities: DiamondTransaction.idempotency_key; DailyWheelSpin.idempotency_key and user_email + spin_date; UserJokerInventory user_email + joker_type; UserDailyQuestProgress idempotency_key and user_email + quest_date + quest_key; JokerTransaction.idempotency_key; HintTransaction.idempotency_key.
- GFable 5 P1 priorities: SoloLeaderboardEntry.owner_key unique plus total_kronox_score descending sort index; FriendRequest to_email + status and from_email + status lookup indexes; GameInvite to_email + status + expires_at lookup/expiry index; Lobby.code unique plus status + last_activity_at stale-cleanup index.
- Duplicate cleanup executed (2026-07-06, admin approved): adminDuplicateKeyCleanup (AdminUser-gated, dry_run default, execute requires confirm DELETE_DUPLICATES) deleted 959 redundant duplicate rows using the approved canonical-row semantics — DiamondTransaction/JokerTransaction keep earliest ledger row per idempotency_key, UserJokerInventory keeps newest updated balance row per user_email + joker_type, UserDailyQuestProgress keeps the best row per user + quest_date + quest_key (completed first, then highest progress, then earliest created), SoloLeaderboardEntry keeps newest updated row per owner_key. No player balance, score, streak, or reward was mutated; only redundant duplicate rows were deleted.
- Permanent code-level logical unique guards (GFable 5): Base44 has no repo-level unique index support, so duplicate cleanup is not enough by itself — logical uniqueness is enforced at function/code level permanently. Guard pattern per key: query-before-create on every unique-key create path; reserve-first on DailyWheelSpin (spin row reserved before rewards, existing spin recovered instead of duplicated); EconomyOperationLock around economy mutations (Daily Wheel claim, Market purchase, joker/hint spend, Daily Calendar streak claim); idempotency_key find-before-create on DiamondTransaction/JokerTransaction/HintTransaction ledgers with re-read after write where race risk exists; UserDailyQuestProgress assignment keys checked via findProgressByAssignment before create with catch-recover; SoloLeaderboardEntry publishes filter owner_key before update/create and re-read the canonical row after create; Lobby.code is generated through generateUniqueLobbyCode (server-side lookup-only findLobbyByCode query-before-create). Duplicate-key hits return the existing canonical record — never a second row. Read-time dedupe (selectPrimaryInventoryRow, dedupeSpinRows, getSoloLeaderboard owner_key dedupe, duplicate-row repair after spend) is preserved as the safety fallback and must not be removed. adminDuplicateKeyReport remains the duplicate monitor; if Base44 platform unique indexes become available later they are configured as manual release gates with a fresh zero-duplicate dry-run.
- Post-backend-fix cleanup (2026-07-06): the single post-cleanup starter_bonus DiamondTransaction duplicate (client grant race echo) was removed through the scoped adminDuplicateKeyCleanup executor (1 redundant row deleted, earliest canonical row kept, balances untouched) only after claimLoginBonuses moved starter/daily login grants server-side; a fresh adminDuplicateKeyReport dry-run re-verified ZERO duplicates on all P0/P1 keys.
- Post-cleanup verification snapshot (2026-07-06): adminDuplicateKeyReport dry-run reports ZERO duplicates for all P0/P1 keys (DiamondTransaction, DailyWheelSpin key and user/day, UserJokerInventory, UserDailyQuestProgress, JokerTransaction, HintTransaction, SoloLeaderboardEntry.owner_key, Lobby.code). Platform unique-key configuration is unblocked for all documented keys, pending a fresh dry-run at configuration time; until platform proof exists, function-level guards remain the enforcement.
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
- UserSubCategoryPreference rows are retained legacy data and are not the current Profile Info source-of-truth.

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
