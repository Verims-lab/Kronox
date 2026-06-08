# Kronox DB Architecture

Status: Codex183 implementation baseline plus target architecture roadmap. This
document remains non-destructive: it records additive schemas, gateway
foundation, maintenance job scaffolding, and platform configuration gaps.

Last reviewed from repo state: Codex183.

## 1. Executive Summary

Kronox has the right core gameplay entities for the current product, but the
data architecture is still in a "working product" shape rather than a
growth-ready shape.

Highest priority findings:

| Priority | Finding | Risk | Safe direction |
| --- | --- | --- | --- |
| P0 | Question reads are safer now, but still rely on per-category batches and broad in-memory filtering. | Medium | Keep `getQuestions` as the protected gateway; add indexed active question queries or paging. |
| P0 | Leaderboard still depends on `User.kronox_puan_total` service-role projection with a fixed limit. | High | Add/finish a public-safe `LeaderboardProjection` or promote `SoloLeaderboardEntry` into the canonical leaderboard projection. |
| P0 | Analytics are missing. Kronox cannot reliably answer question shown/correct/wrong/easy/hard/category popularity questions. | High | Add append-only events plus projection tables. |
| P1 | Idempotency relies on logical keys checked in code, but repo schemas do not declare unique constraints. | High | Configure unique keys where Base44 supports them; otherwise gate writes through backend functions. |
| P1 | Cleanup exists as client-safe helpers, not production recurring jobs. | Medium | Move cleanup to idempotent backend jobs with status transition first, hard delete only after retention approval. |
| P1 | Entity reads/writes are scattered across UI, hooks, client libs, and backend functions. | Medium | Introduce a DB gateway/data access layer and migrate callers gradually. |
| P1 | `Lobby.players` embeds player state and makes per-player/member queries hard to index. | Medium | Keep Lobby as authority now; add match/player projections for analytics and recovery. |
| P1 | `User` JSON carries progress, score, economy guards, tutorial, reset metadata, and leaderboard projection. | Medium | Keep `User` for current source of truth, but add projections and event ledgers for growth. |
| P2 | Public SEO/GEO content is not modeled. Raw `Question` must stay protected. | Medium | Add a public-safe question content projection if public pages are planned. |
| P2 | Legacy entities/fields exist (`Friendship`, `Lobby.category`, some `GameRecord` use). | Low | Mark as legacy, collect proof, then archive/delete only after migration proof. |

Release posture: keep current runtime behavior, but implement gateway,
projection, event, index, and cleanup phases before scaling user traffic or
question volume.

## Codex183 Implementation Status

Implemented now:

- `src/lib/dbGateway/` foundation:
  - `questionGateway.js`
  - `categoryGateway.js`
  - `inviteGateway.js`
  - `lobbyGateway.js`
  - `scoringGateway.js`
  - `economyGateway.js`
  - `leaderboardGateway.js`
  - `analyticsGateway.js`
  - `cleanupGateway.js`
  - `index.js`
- Additive analytics/statistics schemas:
  - `QuestionAttemptEvent`
  - `QuestionStatsProjection`
  - `UserStatsProjection`
  - `CategoryStatsProjection`
  - `LobbyMatchStats`
- `QuestionPublicProjection` as an opt-in public-safe SEO/GEO projection.
  Raw `Question` remains protected and is not a public content source.
- `SoloLeaderboardEntry` is promoted as the current canonical public-safe
  leaderboard projection. Despite the historical name,
  `total_kronox_score` is unified Kronox Puan and public rows must not expose
  raw email.
- Admin-gated, dry-run capable maintenance functions:
  - `expireOldGameInvites`
  - `cancelStaleLobbies`
  - `expirePushSubscriptions`
  - `refreshLeaderboardProjection`
  - `aggregateQuestionStats`
  - `cleanupAdminMaintenanceLog`
- Modular Health coverage for the DB architecture implementation contracts.

Implemented now:

- `QuestionAttemptEvent` best-effort gateway writes exist. Codex197 enables
  Solo runtime `shown`, `answered`, `swapped_out`, and `replacement_shown`
  writes; Online event wiring remains deferred. Placement, drag/drop, scoring,
  and question selection rules are unchanged.
- Cleanup jobs are implemented as callable backend functions. Automatic
  scheduling is not enabled here.

Scaffolded now:

- Online question analytics write coverage is documented/scaffolded only; no
  Online runtime `QuestionAttemptEvent` write point is enabled yet.
- Platform unique indexes and live runtime proof are tracked as manual
  deployment proof, not repo-enforced Health PASS.

Platform/manual configuration still required:

- Base44 index/unique-key enforcement is not declared by repo JSONC. Configure
  unique/index constraints in the Base44/platform admin UI if supported, then
  record proof in release notes.
- Required unique keys include:
  - `DiamondTransaction.idempotency_key`
  - `OnlineMatchResult.idempotency_key`
  - `OnlineMatchResult.lobby_id + player_email`
  - `PushSubscription.user_email + endpoint`
  - `SoloLeaderboardEntry.owner_key`
  - `Category.category_id`
- Runtime uniqueness, scheduled jobs, and analytics write volume remain manual
  proof items.

## 2. Current Entity Map

Current entities audited:

- `Category`
- `SubCategory`
- `UserCategoryPreference`
- `UserSubCategoryPreference`
- `UserJokerInventory`
- `JokerTransaction`
- `DiamondTransaction`
- `DailyWheelSpin`
- `DailyQuestDefinition`
- `FriendRequest`
- `Friendship`
- `GameInvite`
- `GameRecord`
- `Lobby`
- `LobbyMessage`
- `OnlineMatchResult`
- `PushSubscription`
- `Question`
- `SoloLeaderboardEntry`
- `AdminMaintenanceLog`
- `User`

### Entity Audit Table

| Entity | Purpose | Current usage | Source of truth | Read/write paths | Security/RLS concerns | Scale/index needs | Retention/cleanup | Decision | Deletion proof needed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Category` | Stable question category lookup. | Online category UI, Solo active category whitelist, `getQuestions`, `startLobbyGame`, seed function. | Yes for category metadata and active/passive state. | `OnlineChallengeScreen`, `seedQuestionCategories`, `getQuestions`, `startLobbyGame`. | Read is public, write/delete admin. Public read is acceptable if only category metadata. | Unique `category_id`; `status`; `status + category_id`. | No routine deletion. Passive instead of delete. | Keep. | None. |
| `SubCategory` | Future normalized subcategory lookup. | No current Settings preference UI usage; no runtime question mapping yet. | Future lookup source for normalized subcategory metadata. | Manual/admin row management expected later. | Read can be public like `Category`; create/update/delete stay admin-only. Rows store only subcategory metadata and `Category.category_id` references. | Unique `id`; `status`; `main_category_1`; `main_category_2`. | No routine deletion. Passive instead of delete. | Keep as additive prep. | Future proof needed before mapping `Question.sub_category` text to `SubCategory.id`. |
| `UserCategoryPreference` | Per-user interest preference rows for active main `Category` selections. | App-open Category preference popup, Settings `İlgi Alanlarım`, and Solo-only soft 70/30 question weighting load current user's selected categories. | Yes for user preference persistence and Solo soft weighting; not a hard question filter. | `src/lib/userCategoryPreferences.js`, `src/lib/categoryPreferenceOnboarding.js`, `src/components/settings/CategoryPreferenceOnboardingModal.jsx`, `src/components/settings/CategoryPreferencesSection.jsx`, `src/pages/Game.jsx`, `src/lib/soloQuestionEngine.js`. | Rows are user-scoped by owner email; normal users can read/update only their own rows, admin can inspect. Any user below 3 active valid preferences is prompted; completion flags cannot bypass that rule. Preferences must not leak other users or affect Online/getQuestions selection. | `user_email + category_id` unique where platform supports it; `user_email + status`; `category_id`. | Unselected preferences become `status = P`; no hard delete needed for routine settings edits. | Keep. | Runtime two-account RLS proof remains needed for preference isolation. |
| `UserSubCategoryPreference` | Legacy retained per-user SubCategory preference rows from the earlier Settings phase. | Not used by the current Settings preference UI. Existing rows are left untouched. | Historical data only until a later migration decision. | No active Settings read/write path. | Keep user-scoped if accessed in future; do not expose globally. | `user_email + sub_category_id` if retained. | Leave existing rows untouched for now. | Retain/legacy. | Future migration/deletion proof needed before removing. |
| `UserJokerInventory` | Per-user current joker balances. | Lazy starter initialization, Profile `Joker Çantası`, Solo joker balance display/spend, and Mağaza joker purchases. | Yes for current owned joker counts. | `ensureUserJokerInventory`, `spendUserJoker`, `purchaseJokerWithDiamonds`, `src/lib/jokerInventory.js`, `ProfilePage`, `Game.jsx` Solo mode, `MarketPage`. | User can read own balances; create/update/delete should stay backend/admin/service-role only so normal users cannot grant themselves jokers. Solo spend and Mağaza purchase are server-backed. Runtime two-account RLS proof remains manual. | Unique `user_email + joker_type`; `joker_type`; `updated_at`. | Keep active rows with user account; anonymize/delete with account deletion in a later cleanup phase. | Keep/additive. | Prove Account A cannot read/mutate Account B inventory and normal users cannot create arbitrary grants/spends/purchases. |
| `JokerTransaction` | Joker ledger/idempotency audit. | `starter_grant`, Solo `solo_use`, and Mağaza `market_purchase` rows. | Audit/ledger; `UserJokerInventory.quantity` is balance source. | `ensureUserJokerInventory` writes starter rows with `starter_jokers:<email>:<joker_type>` keys; `spendUserJoker` writes `solo_use` rows with `quantity_delta = -1`; `purchaseJokerWithDiamonds` writes `market_purchase` rows with positive quantity deltas. | Append-only where possible; normal Profile does not expose ledger rows; writes stay backend/admin/service-role. | Unique `idempotency_key`; `user_email + created_at`; `user_email + joker_type`; `reason + created_at`. | Retain for audit; archive old rows after economy retention policy. | Keep/additive. | Two-account RLS and duplicate starter/spend/purchase proof remain manual/runtime. |
| `Question` | Protected gameplay question bank. | Authenticated `getQuestions`, `startLobbyGame`, test/sim functions, admin paths. | Yes for question content, but runtime projection derives `year` from `answer`. | Service-role backend functions; direct entity read admin-only by RLS. | Must remain protected. Normal users must not get full bank or admin metadata. | `state`; `main_category_id`; `state + main_category_id`; `difficulty`; future `answer_year`; `state + main_category_id + answer_year`. | No hard delete by default. Use `state = P`; archive old invalid rows only after export. | Keep but refactor. | N/A. |
| `AdminUser` | DB-backed admin authorization source-of-truth. | Shared backend admin guard, Settings admin status check, admin-only functions, Health/test-suite gating. | Yes for admin authorization. Active rows with role `owner`/`admin` pass; disabled rows fail. | `functions/getAdminStatus.js`, `base44/functions/_shared/adminAuth.ts`, `base44/functions/getAdminStatus/entry.ts`, `base44/functions/getAdminStatus/function.jsonc`, admin-only backend functions. | Must remain private/admin-only. Normal users cannot list global admins. No env email allowlist for authorization. `getQuestions` must not be used as an admin status source. | Unique `email`; `status`; `role + status`; `updated_at`. | Disable rows to remove access. Account deletion should disable/anonymize the row only through explicit owner/admin action. | Keep. | Prove unauthenticated 401, non-admin 403, active admin allowed, disabled admin blocked, and current Base44 functions version resolves `getAdminStatus`. |
| `User` | Auth profile plus progress/economy/projections. | Auth bootstrap, Solo progress, Online score, Diamonds, tutorial, reset marker, leaderboard service projection. | Yes for account, Solo progress, Online progress, Diamonds, `kronox_puan_total`. | `base44.auth.me/updateMe`, admin reset, delete account, leaderboard service role. | Private user row must not leak. Admin writes must stay server-side. JSON fields make partial race handling hard. | Unique auth id/email platform-managed; `kronox_puan_total desc`; maybe `progress_reset_at`. | Account deletion deletes/anonymizes; no general retention job. | Keep but reduce overload with projections/events. | N/A. |
| `SoloLeaderboardEntry` | Public-safe leaderboard row. | Client publish after Solo/Online changes; fallback leaderboard read. | Projection, not primary score source. | `src/lib/leaderboard.js`, admin reset, optional fallback when service function missing. | Public read is OK only because no raw email. Update is admin-only by schema, but client create/update attempts rely on RLS/platform behavior. | Unique `owner_key`; `total_kronox_score desc`; tie-breakers `current_level`, `total_stars`, `updated_at`. | Keep rows; zero/anonymize on reset/delete. | Keep but refactor into canonical `LeaderboardProjection` or rename purpose. | Prove all leaderboard reads use new projection before replacing. |
| `DiamondTransaction` | Diamond ledger/idempotency audit. | `diamondEconomy` grants starter/daily; Daily Wheel claim writes `daily_wheel`; Mağaza joker purchase writes `market_purchase`; admin reset may reset/delete/adjust rows. | Audit/ledger; `User.diamonds` is balance source. | Client helper writes starter/daily through user RLS; Daily Wheel/admin reset/purchase service-role. `purchaseJokerWithDiamonds` validates price and sufficient Diamonds server-side. | Logical idempotency key not declared unique in repo. Multi-device race remains a platform limitation. Client must never be trusted for purchase price/cost. | Unique `idempotency_key`; `user_email + created_at`; `user_email + source`; `source + created_at`. | Retain for audit. Archive old rows after finance/economy retention policy. | Keep but harden. | N/A. |

Mağaza Phase 1 treats Daily Wheel as a Diamond source and Mağaza purchase as a
Diamond sink. `purchaseJokerWithDiamonds` is server-authoritative: it ignores
client price/cost, validates authenticated self-owned user context and
sufficient `User.diamonds`, writes both Diamond and Joker ledgers with the same
idempotency key, and uses best-effort rollback if ledger creation fails. True
duplicate-request and partial-failure consistency proof remains a live backend
manual gate.

Daily Reward Wheel uses active `daily_wheel_*` User guard fields plus
`daily_wheel:<email>:<YYYY-MM-DD>`. The Home `Günlük Ödüller` panel also shows
Daily Quest v1 readiness/status; Daily Quest does not grant Diamonds or Kronox
Puan yet. Reserved `daily_quest_*` User fields keep future quest rewards
separate from wheel spins and must only be used by a future server-backed claim
path.

Daily Quest Definition Phase 1 adds `DailyQuestDefinition` for admin-managed
system templates. `title` and `description` are display-only; they are never
parsed by regex, AI/NLP, free text, or scripts. The executable contract is
strictly `quest_type + target_value`, with v1 `quest_type` limited to
`start_solo_attempt`, `correct_cards`, `complete_solo_level`, and `use_joker`.
`reward_diamonds` is the only reward field: Daily Quest definitions do not
grant Kronox Puan and do not affect leaderboard. User assignment, progress, and
claim are later phases; the planned future table is `UserDailyQuestProgress`
with `user_email`, `quest_definition_id`, `quest_date`, `progress_value`,
`target_value`, `status`, `completed_at`, `claimed_at`, and UTC-day
idempotent Diamond reward claims.
| `DailyWheelSpin` | Daily Reward Wheel claim ledger and streak audit. | `getDailyWheelStatus` reads current day; `claimDailyWheelReward` creates server-backed claim and updates `User.diamonds`. | Audit/idempotency for Daily Wheel; `User.diamonds` is balance source. | Backend service-role functions only for claim; user/admin read by RLS. | Unique idempotency is not guaranteed in repo schema; race proof needs platform unique key or live probe. | Unique `idempotency_key`; unique `user_email + spin_date`; `user_email + claimed_at`; `spin_date`. | Retain/anonymize on account deletion; admin reset removes target test rows; archive old rows after retention policy. | Keep. | N/A. |
| `DailyQuestDefinition` | Admin-managed Daily Quest v1 templates. | Profile / Settings / `Günlük Görev Yönetimi` lists definitions and creates new templates through `createDailyQuestDefinition`. | Yes for system quest templates only; not user progress. | `base44/functions/createDailyQuestDefinition/entry.ts`, `src/lib/dbGateway/dailyQuestGateway.js`, `DailyQuestDefinitionManager`. | Admin-only. Backend guard uses `AdminUser` active owner/admin. Normal users cannot view the Settings UI section and cannot create definitions. | Unique `quest_key` where platform supports it; `status`; `sort_order`. | Passive instead of delete for routine removal. | Keep/additive. | Prove active admin can list/create, non-admin and disabled admin receive 403. |
| `OnlineMatchResult` | Per-user online score audit/idempotency. | `applyOnlineResult` creates/checks row before visible score write. | Audit/idempotency; `User.online_progress` is visible score source. | Client helper creates via entity SDK; reads own rows; admin can update/delete. | Logical idempotency key not declared unique in repo. Client-side per-user application means opponent disconnect recovery is limited. | Unique `idempotency_key`; unique `lobby_id + player_email`; `lobby_id`; `player_email + applied_at`. | Retain for audit/reconciliation. Archive after long retention. | Keep but move write authority backend-side. | N/A. |
| `Lobby` | Authoritative online lobby/game state. | Lobby create/join/start, realtime sync, waiting room, online game state updates. | Yes for online match state. | `LobbyRoom`, `useLobbySync`, `useWaitingRoomSync`, service functions (`findLobbyByCode`, `startLobbyGame`, `updateLobbyGameState`, `acceptGameInvite`). | RLS lets host update; backend service functions also validate host/player. Embedded `players` array makes member lookup hard. | Unique `code`; `host_email + status`; `status + last_activity_at`; `status + updated_at`; `started_at`; `completed_at`; possible `players.email` limitation. | Mark stale waiting lobbies `cancelled`; preserve finished/audit rows. | Keep but refactor projections. | N/A. |
| `GameInvite` | Pending/actionable online invite lifecycle. | Notification center, header, in-app toast, Online pending list, accept/decline/open, push function. | Yes for invite lifecycle. | `inviteApi`, `useNotificationCenter`, `acceptGameInvite`, `sendGameInvitePush`, `dataRetention`. | Read/update by sender/recipient/admin. Toast dismissal must not mutate row. | `to_email + status + expires_at`; `from_email + status`; `lobby_id`; `status + expires_at`; `to_email + status`. | Pending past `expires_at` -> `expired`; completed/cancelled retained then archived. | Keep. | N/A. |
| `FriendRequest` | Friend request and accepted friendship relation history. | Friends page/API, notification center, accept/reject/remove functions. | Current practical social relation source. | `friendsApi`, `acceptFriendRequest`, `removeFriend`, notification center. | Sender/recipient/admin read/update/delete. Need two-account RLS proof. | `to_email + status`; `from_email + status`; `from_email + to_email + status`; `updated_date`. | Retain relationship history; reject/cancel stale pending. | Keep. | N/A. |
| `Friendship` | Legacy normalized friendship row. | `removeFriend` deletes rows; little active client read evidence. | Likely legacy/secondary. | `removeFriend`; old Health references. | Owner read only plus admin update/delete. Potential drift from accepted FriendRequest rows. | `user_email + friend_email` unique; `user_email`. | Candidate archive after proof. | Archive/legacy candidate. | Prove no UI or backend depends on `Friendship` for accepted friends; migrate remaining data to FriendRequest or new relation table. |
| `PushSubscription` | Browser push endpoint storage. | Notification setup/update; `sendGameInvitePush`; delete account removes. | Yes for push delivery endpoints. | `notificationApi`, `sendGameInvitePush`, `dataRetention`, delete account. | Owner/admin read/update/delete. `keys_auth` is sensitive; never expose outside owner/backend. | Unique `user_email + endpoint`; `user_email + status`; `status + last_seen_at`; `status + disabled_at`. | Push errors mark `expired`; archive/delete expired after retention. | Keep. | N/A. |
| `GameRecord` | Legacy/simple game completion record. | `useGameActions.saveGameRecord`, top scores, tests/admin reset. | Not source of truth for current Solo level progression. | `useGameActions`, `TopScores`, `runTestSuite`, admin reset. | User-owned read. Raw email exists but RLS protects. | `user_email + created_date`; `category`; `duration_seconds`. | Candidate archive after analytics events exist. | Keep but refactor/legacy. | Prove TopScores or any stats can use new projections/events; export historical rows. |
| `LobbyMessage` | Lobby chat/system messages. | Schema exists; active runtime usage not obvious in current scan. | Not currently core source. | No active high-confidence UI path found in quick audit. | Read by lobby membership via nested Lobby query; may be expensive. | `lobby_id + created_date`; `type`; `created_by_id`. | Delete/archive with lobby retention after chat retention policy. | Candidate for deletion after proof. | Prove no chat UI/function uses it; check production row count/export. |
| `AdminMaintenanceLog` | Admin-only maintenance audit log. | Admin reset preview/execute logging. | Yes for maintenance audit. | `adminResetUserProgress`; future jobs should append here or a job log table. | Admin-only RLS. Contains admin/target emails; never public. | `created_at`; `action + created_at`; `target_email + created_at`; `admin_email + created_at`. | Archive/trim after admin audit retention. | Keep. | N/A. |

## 3. Current Risks

### P0/P1 Data Risks

1. P0 - No analytics event model.
   - Affected entities/files: `Question`, `GameRecord`, `Lobby`,
     `OnlineMatchResult`, `src/hooks/useGameActions.js`,
     `base44/functions/startLobbyGame/entry.ts`.
   - Why it matters: Kronox cannot answer usage/correctness/difficulty/stall
     questions without reconstructing from incomplete rows.
   - Safe path: add append-only `QuestionAttemptEvent` and projections.
   - Migration: additive only. No existing data rewrite.
   - Manual proof: runtime event volume and write failures.

2. P0 - Leaderboard ranking is not a full production rank model.
   - Affected entities/files: `User`, `SoloLeaderboardEntry`,
     `base44/functions/getSoloLeaderboard/entry.ts`, `src/lib/leaderboard.js`.
   - Why it matters: ranking from fixed-size lists can miss users if platform
     sorting/indexing is not guaranteed.
   - Safe path: formalize `LeaderboardProjection` with unique `owner_key` and
     indexed `kronox_puan_total`.
   - Rollback: keep `User.kronox_puan_total` as fallback.
   - Manual proof: compare Profile row, leaderboard current row, and top N.

3. P1 - Idempotency keys are logical, not schema-enforced.
   - Affected entities: `DiamondTransaction`, `OnlineMatchResult`.
   - Why it matters: two devices can race before duplicate detection sees the
     first row.
   - Safe path: unique constraints if Base44 supports them; otherwise backend
     functions with reserve-first/reconcile flows.
   - Manual proof: two-device/double-click tests.

4. P1 - Lobby membership is embedded in `Lobby.players`.
   - Affected entities/files: `Lobby`, `useLobbySync`, `useWaitingRoomSync`,
     `updateLobbyGameState`, `startLobbyGame`.
   - Why it matters: per-player lookup, recovery, analytics, and stuck-game
     detection are hard to index.
   - Safe path: keep Lobby authority now; add `LobbyPlayerProjection` or
     `OnlineMatchPlayerState` later.
   - Rollback: projection can be dropped without breaking Lobby authority.

5. P1 - Cleanup is client/report limited.
   - Affected files: `src/lib/dataRetention.js`, `GameInvite`, `Lobby`,
     `PushSubscription`, `AdminMaintenanceLog`.
   - Why it matters: stale rows grow forever if no recurring backend job runs.
   - Safe path: backend jobs that transition status first.
   - Manual proof: scheduled execution and idempotency.

## 4. Target DB Architecture

### Principles

- Protected gameplay data stays protected.
- Lobby remains the online authority until a controlled multiplayer migration.
- User fields remain current source of truth for account/progress/balance, but
  high-volume reads use projections.
- Analytics are append-only events plus periodic projections.
- Cleanup jobs transition statuses first, then archive/delete only after
  retention approval.
- Client UI should not issue broad entity queries when a gateway/backend
  function can narrow, authorize, and project data.

### Target Layers

| Layer | Purpose | Examples |
| --- | --- | --- |
| Source entities | Canonical current state. | `User`, `Question`, `Category`, `Lobby`, `GameInvite`, `UserJokerInventory`. |
| Ledgers/audit | Durable idempotency and audit trail. | `DiamondTransaction`, `JokerTransaction`, `DailyWheelSpin`, `OnlineMatchResult`, `AdminMaintenanceLog`. |
| Append-only events | High-volume behavior/statistics. | `QuestionAttemptEvent`, `MatchLifecycleEvent`, `InviteLifecycleEvent`. |
| Projections | Fast public-safe read models. | `LeaderboardProjection`, `QuestionStatsProjection`, `UserStatsProjection`, `CategoryStatsProjection`. |
| Gateways/functions | Auth, ownership, projection, query narrowing. | `getQuestions`, `startLobbyGame`, future `applyOnlineResult`, future cleanup jobs. |

## 5. DB Gateway Design

Target structure:

```text
src/lib/dbGateway/
  questionGateway.js
  categoryGateway.js
  inviteGateway.js
  lobbyGateway.js
  scoringGateway.js
  economyGateway.js
  leaderboardGateway.js
  analyticsGateway.js
  cleanupGateway.js
```

Backend/service functions should own writes that require service role,
multi-entity changes, idempotency, or public-safe projection. Client gateways
should be thin wrappers around those functions or RLS-safe direct reads.

| Gateway | Responsibilities | Allowed callers | Entities | Main query patterns | Safety rules | Client or backend |
| --- | --- | --- | --- | --- | --- | --- |
| `questionGateway` | Load playable questions; normalize `answer -> year`; admin bank access. | Game, Solo engine, Online start, admin tooling. | `Question`, `Category`. | Active questions by category/state/limit; admin full-bank. | Auth required; normal users get minimal projection only. | Backend-first; client wrapper only. |
| `categoryGateway` | Load active categories, seed/backfill categories, normalize import aliases. | Online UI, Solo deck, admin/import. | `Category`. | `status=a` ordered by `category_id`. | Public read OK; write admin only. | Client read plus backend seed/admin. |
| `inviteGateway` | Create/load/open/decline invites; merge active rows; TTL checks. | Header, toast, Online pending panel, Lobby. | `GameInvite`, `Lobby`, `PushSubscription`. | `to_email + status`, `from_email + lobby_id`, `expires_at`. | Dismiss UI state never mutates persisted invite. | Mixed: client RLS read/create, backend accept/push. |
| `lobbyGateway` | Create/join/start/update lobby; stale recovery; state revisions. | Lobby UI, waiting room, Game. | `Lobby`, future player projection. | `code`, `id`, `host_email + status`, `status + last_activity_at`. | Lobby authority preserved; service-role functions validate host/player. | Backend for joins/start/update; client for subscribed own lobby. |
| `scoringGateway` | Apply Online result and publish unified score projection. | Game result flow. | `User`, `OnlineMatchResult`, `LeaderboardProjection`. | `idempotency_key`, `lobby_id + player_email`. | Idempotent; no draw; no opponent write from client. | Backend preferred. |
| `economyGateway` | Grant Diamonds, Daily Wheel status/claim, spend Diamonds for Mağaza joker purchases, reconcile ledger/balance. | App bootstrap, Home Daily Wheel, Mağaza, admin reset, future rewards. | `User`, `DiamondTransaction`, `DailyWheelSpin`, `UserJokerInventory`, `JokerTransaction`. | `idempotency_key`, `user_email + source`, `user_email + spin_date`, `user_email + joker_type`. | Unique keys or backend reserve-first. Purchases validate price and sufficient Diamonds server-side. | Backend preferred for grants/spends. |
| `leaderboardGateway` | Publish/read leaderboard projection. | Profile, Leaderboard, score writers. | `LeaderboardProjection` or `SoloLeaderboardEntry`, `User`. | `kronox_puan_total desc`, `owner_key`. | Public rows must not expose email. | Backend read/write projection. |
| `analyticsGateway` | Write attempt/match/invite events; aggregate projections. | Game actions, lobby lifecycle, jobs. | Event/projection entities. | `question_id`, `user_id`, `mode`, date windows. | Never block gameplay; tolerate best-effort event loss. | Backend or fire-and-forget client wrapper with auth. |
| `cleanupGateway` | Expire/cancel/archive stale rows; log jobs. | Scheduled jobs/admin. | `GameInvite`, `Lobby`, `PushSubscription`, logs. | Status + timestamps. | Idempotent; transition before hard delete. | Backend scheduled only. |

Implementation guidance:

- P1: create folder and wrappers without rewiring broad UI.
- P1: migrate new code to gateways first.
- P2: move existing scattered reads gradually.
- P2: Health should flag new direct entity access in UI for protected/high
  volume entities.

## 6. Proposed New/Changed Entities

### P0 - `SubCategory`

Purpose: additive lookup table for future normalized subcategory metadata.

Current status: schema-only. `Question.sub_category` remains the existing
free-text field until a separate migration maps those values to
`SubCategory.id`.

Fields:

```text
id
main_category_1
main_category_2
name
status: A | P
description
```

`main_category_1` and `main_category_2` store existing `Category.category_id`
values. Do not duplicate Category names or migrate Question rows in this phase.

### P0 - `UserCategoryPreference`

Purpose: App-open popup and Settings persistence for user-selected main
Category interests.

Current status: onboarding + Settings only. The preference rows do not affect
Solo, Online, `getQuestions`, or analytics selection logic yet.

Fields:

```text
id
user_id
user_email
category_id
status: A | P
created_date
updated_date
```

Rules:

* `category_id` stores the stable `Category.category_id` value.
* The Settings UI shows only active `Category.status = A/a` rows.
* Passive `Category.status = P/p` rows are not selectable.
* Users must select at least 3 categories before saving.
* There is no maximum selection.
* Rows are scoped to the authenticated user.
* Any authenticated user with fewer than 3 active valid Category preferences
  sees the popup; this applies to new and existing users.
* The source of truth is active valid `UserCategoryPreference` count.
* Only active Categories are selectable and count toward the minimum.
* Passive or removed Category selections are ignored in UI/save state and must
  not be resaved as active preferences.
* Onboarding/completion profile flags are advisory only and cannot bypass the
  below-3 rule.
* Users can later change selections under Profile / Settings /
  `İlgi Alanlarım`.
* Solo question selection targets 70% selected user categories and 30% full
  eligible pool when at least 3 active valid preferences are available.
* This is a soft weighting target with fallback, not hard filtering.
* The selected-category 70% lane is not difficulty-1 restricted; the global
  30% lane prefers difficulty 1 from the full eligible pool where possible,
  with safe fallback if difficulty-1 global candidates are insufficient.
* Online question selection is not affected.
* The `SubCategory` entity and old `UserSubCategoryPreference` rows remain in
  place for future metadata/migration work, but current Settings preferences
  use main Category rows.

### P0 - `QuestionAttemptEvent`

Purpose: append-only event for question exposure and answer outcome.

Suggested fields:

```text
user_email or user_id
question_id
attempt_id
mode: solo | online
level
is_special_level
lobby_id
category_id
sub_category
tags
answer_year
event_type: shown | answered | swapped_out | replacement_shown
shown_at
answered_at
is_correct
placement_index
response_time_ms
mistake_number
joker_used
joker_type
was_swapped_out
replacement_for_question_id
source: deck | reserve | replacement
client_version/build_marker
created_at
```

Risk level: medium. Additive, but high write volume.

Safe path: write events best-effort after placement outcome; never block
gameplay. Start with sampled or low-volume staging if needed.

Rollback: stop event writes; source gameplay remains unaffected.

Manual proof: event write volume, no gameplay delay, no private data leak.

### P0 - `QuestionStatsProjection`

Purpose: aggregate difficulty/content quality.

Suggested fields:

```text
question_id
shown_count
correct_count
wrong_count
swap_count
correct_rate
avg_response_time_ms
solo_shown_count
online_shown_count
last_shown_at
last_answered_at
category_id
sub_category
tags
answer_year
difficulty_signal
updated_at
```

Safe path: job aggregates from events. Do not recalculate on gameplay reads.

### P1 - `UserStatsProjection`

Purpose: public-safe and admin-safe user/player statistics separate from
private `User` JSON.

Suggested fields:

```text
owner_key
user_email_hash or admin-only user_email
kronox_puan_total
solo_score
online_score
current_level
diamonds
total_games
solo_attempts
online_matches
last_active_at
updated_at
```

Use raw `user_email` only in admin-only variant. Public projections should use
`owner_key`.

### P1 - `CategoryStatsProjection`

Suggested fields:

```text
category_id
shown_count
correct_rate
play_count
popularity_rank
updated_at
```

### P1 - `LeaderboardProjection`

Purpose: make the public leaderboard explicit and index-friendly.

Suggested fields:

```text
owner_key
display_name
initial
kronox_puan_total
solo_score
online_score
current_level
total_stars
aggregate_best_time_seconds
rank_window
updated_at
```

Migration option: rename/evolve `SoloLeaderboardEntry` rather than create a
new table if Base44/entity churn is costly.

### P1 - `MatchLifecycleEvent`

Suggested fields:

```text
lobby_id
event_type: created | invite_sent | accepted | started | state_update | finished | cancelled | expired | stuck_detected
actor_email
player_count
selected_category_ids
status
failure_reason
state_revision
created_at
```

### P2 - `QuestionPublicProjection`

Purpose: SEO/GEO-safe public content that is explicitly approved for public
pages.

Suggested fields:

```text
question_id
canonical_slug
public_title
description
source_name
source_url
seo_title
seo_description
locale
structured_data_type
structured_data_json
public_visibility
content_quality_status
updated_at
```

Security boundary: public pages must read this projection, not raw `Question`.

## 7. Index/Unique-Key Strategy

Base44 index/unique constraint support is not visible in repo JSONC schemas.
If the platform supports configuring indexes/unique keys outside the repo,
configure these manually and record the platform setting in deployment docs.
If not supported, use backend gateways to narrow queries and enforce logical
idempotency.

| Entity | Index or unique key | Priority | Why |
| --- | --- | --- | --- |
| `Category` | unique `category_id` | P0 | Seed/backfill and question references. |
| `Category` | `status`, `status + category_id` | P1 | Active category UI/gameplay. |
| `Question` | `state` | P0 | Exclude passive rows. |
| `Question` | `main_category_id` | P0 | Category scoped gameplay. |
| `Question` | `state + main_category_id` | P0 | `getQuestions` and `startLobbyGame`. |
| `Question` | future `answer_year` | P1 | Unique-year deck selection without parsing every row. |
| `Question` | `state + main_category_id + answer_year` | P1 | Scalable Solo/Online sampling. |
| `Question` | `difficulty`, `region`, `public_visibility` | P2 | Content tools/SEO projection. |
| `GameInvite` | `to_email + status + expires_at` | P0 | Header/pending invite fetch. |
| `GameInvite` | `from_email + status`, `lobby_id` | P1 | Host outgoing rows and lobby cleanup. |
| `Lobby` | unique `code` | P0 | Join by code. |
| `Lobby` | `host_email + status` | P1 | Active hosted lobby lookup. |
| `Lobby` | `status + last_activity_at` | P1 | stale lobby cleanup. |
| `Lobby` | `started_at`, `completed_at` | P2 | analytics/retention. |
| `OnlineMatchResult` | unique `idempotency_key` | P0 | Prevent double score application. |
| `OnlineMatchResult` | unique `lobby_id + player_email` | P0 | Alternate idempotency guard. |
| `OnlineMatchResult` | `lobby_id`, `player_email + applied_at` | P1 | reconciliation/history. |
| `DiamondTransaction` | unique `idempotency_key` | P0 | Prevent duplicate rewards/spends. |
| `DiamondTransaction` | `user_email + created_at`, `user_email + source` | P1 | audit/history. |
| `UserJokerInventory` | unique `user_email + joker_type` | P0 | One current balance per user per joker type. |
| `JokerTransaction` | unique `idempotency_key` | P0 | Prevent duplicate starter grants and future spends/purchases. |
| `JokerTransaction` | `user_email + created_at`, `user_email + joker_type` | P1 | audit/history. |
| `DailyWheelSpin` | unique `idempotency_key`, unique `user_email + spin_date` | P0 | one spin per user per server day. |
| `DailyWheelSpin` | `user_email + claimed_at`, `spin_date` | P1 | wheel history/status queries. |
| `SoloLeaderboardEntry`/`LeaderboardProjection` | unique `owner_key` | P0 | Dedupe public rows. |
| `SoloLeaderboardEntry`/`LeaderboardProjection` | `total_kronox_score desc` or `kronox_puan_total desc` | P0 | top N leaderboard. |
| `PushSubscription` | unique `user_email + endpoint` | P0 | prevent duplicate endpoints. |
| `PushSubscription` | `user_email + status`, `status + last_seen_at` | P1 | delivery and cleanup. |
| `FriendRequest` | `to_email + status`, `from_email + status` | P0 | notifications/friends. |
| `FriendRequest` | `from_email + to_email + status` | P1 | duplicate request prevention. |
| `AdminMaintenanceLog` | `created_at`, `action + created_at` | P1 | audit review/retention. |
| `QuestionAttemptEvent` | `question_id + shown_at`, `user/email + shown_at`, `mode + shown_at` | P1 | aggregate jobs. |

## 8. Cleanup/Retention Job Strategy

All cleanup jobs must be idempotent and safe to retry. First phase should
transition statuses, not hard delete. Hard delete requires export and explicit
retention approval.

| Job | Cadence | Entities | Action | Idempotency | Failure behavior | Platform status |
| --- | --- | --- | --- | --- | --- | --- |
| `expireOldGameInvites` | Every 5-15 min | `GameInvite` | `pending` past `expires_at` -> `expired`, set `expired_at`. | Invite id + target status. | Skip already terminal rows; log count. | Requires backend scheduler or external cron. |
| `cancelStaleLobbies` | Every 10-30 min | `Lobby` | `waiting` or `starting` inactive past TTL -> `cancelled`, set `cancelled_at`. | Lobby id + status. | Never cancel `in_game` or `finished`. | Requires scheduler. |
| `expirePushSubscriptions` | Daily plus push-error immediate | `PushSubscription` | 404/410 or old disabled rows -> `expired`; archive after retention. | Endpoint + status. | Keep in-app invite unaffected. | Immediate marking exists in push; recurring archive needed. |
| `refreshLeaderboardProjection` | On score write plus hourly/daily reconciliation | `User`, projection | Recompute unified score rows, dedupe owner keys. | Owner key. | Keep old row if recompute fails; log. | Partially exists via score writers and leaderboard function. |
| `aggregateQuestionStats` | Hourly/daily | events, projections | Roll up shown/correct/wrong/time/difficulty signals. | Date window + projection key. | Re-run same window safely. | New. |
| Manual DB question analytics reset | Manual DB maintenance | `QuestionAttemptEvent`, `QuestionStatsProjection`, `CategoryStatsProjection` | Reset question analytics after replacing the question pool. | Admin console/operator proof. | Clears analytics history/projections only; never deletes questions, categories, preferences, progress, economy, users, admin rows, Daily Wheel, gameplay, or leaderboard data. | Manual only; function reset path is not used. |
| `cleanupAdminMaintenanceLog` | Monthly/quarterly | `AdminMaintenanceLog` | Archive/trim older than retention. | Log id/date. | Never delete recent logs. | New. |
| `archiveOldLobbyMessages` | Monthly | `LobbyMessage` | Archive/delete chat rows after policy. | Lobby id + date. | Skip active lobbies. | New, only if chat used. |

Recommended job logging:

- Add `MaintenanceJobRun` or use `AdminMaintenanceLog` with `action=job:<name>`.
- Record `started_at`, `finished_at`, `status`, `checked`, `updated`,
  `skipped`, `error_count`, and `build_marker`.

## 9. Analytics/Statistics Model

### Why events are needed

Current data can answer "who won this match" and "what is the user's visible
score," but not:

- how many times a question was shown
- how many times it was answered correctly
- which questions are too easy/hard
- which categories are most played
- which online matches fail/stall
- which invites expire/accept/decline by funnel step

### Event write policy

- Events are append-only.
- Event writes must not block placement or scoring.
- Event payloads must be minimal and safe.
- Raw private data should be avoided; use `owner_key`/hash where possible.
- Store raw email only where RLS/admin policy requires it and it is not public.

### Projection policy

- Projections are updated by jobs or controlled backend writes.
- Gameplay reads should never aggregate from raw events live.
- Health should verify event/projection existence and source fields once
  implemented, but runtime correctness remains manual until test harness exists.

## 10. Leaderboard/Stat Projection Model

Target:

```text
LeaderboardProjection.kronox_puan_total
  = User solo score component
  + User online score component
```

Rules:

- Displayed score and sort score must be the same value.
- Projection must not expose raw email.
- Current user row must match Profile/Header visible Puan.
- Projection updates happen:
  - after Solo progress write
  - after Online score application
  - after admin reset
  - via periodic reconciliation job
- If Base44 cannot index descending score, document the limitation and keep
  the top-N query behind `getSoloLeaderboard`.

Backfill strategy:

1. Read users in pages ordered by `updated_date` or platform-supported cursor.
2. Compute `kronox_puan_total` from existing helpers.
3. Upsert `LeaderboardProjection` by `owner_key`.
4. Write no raw email to public row.
5. Repeat until no missing/outdated rows.

Rollback:

- Keep existing `User.kronox_puan_total` and `SoloLeaderboardEntry` as fallback
  until projection is proven.

## 11. Question Data SEO/GEO Model

Gameplay `Question` rows must stay protected. Do not expose the full question
bank through public pages just to support SEO/GEO.

Recommended public model:

```text
QuestionPublicProjection
```

Use it only for approved public content rows.

Fields to consider:

- `question_id`
- `canonical_slug`
- `public_title`
- `description`
- `source_name`
- `source_url`
- `seo_title`
- `seo_description`
- `locale`
- `language`
- `public_visibility`
- `structured_data_type`
- `structured_data_json`
- `content_quality_status`
- `updated_at`

Safety rules:

- `public_visibility` must be explicit.
- Raw internal tags, passive rows, answer strategy, and hidden metadata should
  not leak unless product intentionally approves that content.
- Public projection reads can be unauthenticated; raw `Question` stays
  admin-only or protected gameplay projection only.

## 12. Entity Cleanup Candidates

| Entity/file | Status | Why candidate | Safe Package path | Proof before deletion |
| --- | --- | --- | --- | --- |
| `Friendship` | Legacy candidate | Accepted `FriendRequest` appears to be the practical social source; `removeFriend` still cleans Friendship rows. | Mark legacy, stop new writes if any, migrate remaining references. | `rg` plus production row/usage check; verify friends UI works without it. |
| `LobbyMessage` | Candidate after proof | Schema exists but active chat UI usage was not found in this audit pass. | Keep until runtime/product confirms no chat. | Search production deployed code, row count, and manual lobby chat proof. |
| `GameRecord` | Keep but legacy | Not enough for current analytics and not source of Solo progress. | Replace stats reads with `QuestionAttemptEvent`/stats projections, then archive. | TopScores and test suite migrated; historical rows exported. |
| `Lobby.category` | Legacy field | Current Online uses `selected_category_ids`; old lobbies may need fallback. | Keep as compatibility field until all old lobbies expire/archive. | No active old lobbies relying on legacy category. |
| Client `dataRetention` broad helpers | Keep as admin/client report helpers | They are not real scheduled jobs. | Replace with backend scheduled jobs. | Jobs deployed and verified. |

No deletion should happen in this task.

## 13. Migration/Backfill Plan

### Phase 0 - Documentation and platform discovery

- Confirm Base44 support for indexes and unique constraints.
- Document manual index configuration in deployment notes.
- Confirm whether scheduled backend functions are supported directly or need
  external cron.

### Phase 1 - Gateways and additive scaffolding

- Add `src/lib/dbGateway/` modules. Codex183 implemented the gateway
  foundation.
- Move new code through gateways.
- Add Health cases warning on direct `Question.list`, broad leaderboard reads,
  and unmanaged cleanup calls. Codex183 added modular implementation-contract
  Health cases.
- No production data migration.

### Phase 2 - Projections

- Add or formalize `LeaderboardProjection`. Codex183 uses
  `SoloLeaderboardEntry` as the current public-safe projection and documents
  that future rename/migration requires parity proof.
- Add backfill/reconcile function. Codex183 added
  `refreshLeaderboardProjection`.
- Keep existing leaderboard fallback until parity proof.
- Add `UserStatsProjection` if admin/player stats need fast reads. Codex183
  added the schema and refresh-job write path.

### Phase 3 - Analytics events

- Add `QuestionAttemptEvent`. Codex183 added the schema and gateway.
- Write best-effort events from Solo and Online placement outcomes. Codex196
  wires Solo `shown`, `answered`, `swapped_out`, and `replacement_shown` events
  through the gateway. Online event wiring remains deferred.
- Add `QuestionStatsProjection` and `CategoryStatsProjection`. Codex183 added
  both schemas; Codex196 extended question projection fields for swap,
  metadata, and last answered timestamps.
- Build aggregate job. Codex183 added `aggregateQuestionStats`; Codex196
  updates it to count `shown`/`replacement_shown`, `answered`, and
  `swapped_out` events separately. Projection refresh skips analytics events
  whose `question_id` no longer exists in the current `Question` pool.
- Manual admin email report. Codex197 adds `sendQuestionAnalyticsReportEmail`
  for admin-triggered, question-focused reports. Codex198 formats the report
  as HTML email with summary cards, grouped tables, capped never-shown samples,
  and email-safe visual bars plus a plain-text fallback. The report skips
  stale/deleted question references with a diagnostic count and caps large
  sections for email readability. Codex254 makes the actual sent body include
  category pool counts, aggregate category preference counts, category exposure
  counts, within-category most/least/never-shown analysis, and category fairness
  signals. Category preference counts are aggregate only and do not expose user
  IDs or emails. The function is registered at
  `base44/functions/sendQuestionAnalyticsReportEmail/entry.ts` with
  `base44/functions/sendQuestionAnalyticsReportEmail/function.jsonc`.
  The callable report function inlines the DB-backed AdminUser guard for the
  current Base44 function runtime, so a local `_shared` import cannot break
  deploy and leave a stale event-detail-first report body. No scheduled report
  exists in this version. Frontend `npm run build` does not by itself prove
  Base44 backend function redeployment.
  The report recipient defaults to the requesting authenticated admin's
  normalized email. Mismatched recipient overrides are rejected; `created_by`
  and hardcoded owner addresses are not used as recipients. The function and
  Settings UI return safe `requestedBy`, `recipientEmail`, template, body-marker,
  and email dispatch diagnostics, while real inbox delivery remains manual
  provider proof.
- Static category pool reporting. `Kategori Bazında Soru Havuzu` is sourced
  directly from current `Question` rows and `Category` lookup rows, not from
  `QuestionAttemptEvent`, `QuestionStatsProjection`, or
  `CategoryStatsProjection`. It renders after analytics reset, includes active
  question count, difficulty 1-5/unknown distribution, oldest year, newest
  year, and Unknown/unmapped category diagnostics. `Kategori Bazında Gösterim`
  remains separate report-period exposure analytics.
- Registered pool detail reporting. `Kategori ve Zorluk Bazında Kayıtlı Soru
  Sayısı` / `Kategori Bazında Kayıtlı Soru Havuzu` is also sourced from current
  active `Question` rows and shows category, difficulty level, registered
  question count, oldest year, and newest year. It includes asked and
  never-asked active questions, is independent of analytics events, and remains
  distinct from shown/asked distribution.
- Report ordering and clipping diagnostics. Static `Question` DB pool sections
  render near the top before long event detail tables. `Rapor Bölümleri` lists
  included sections near the top, and `Rapor Tamamlandı` at the end indicates
  generation completed; if the marker is missing in a received email, suspect
  clipping/truncation.
- Email-safe registered-pool chart. `Sistemdeki Soru Havuzu: Kategori /
  Zorluk Dağılımı` is sourced from active `Question` rows and renders a numeric
  category/difficulty table plus inline HTML/CSS stacked bars. It includes
  asked and never-asked questions, counts Zorluk 1-5 plus Bilinmiyor, and does
  not use JavaScript chart libraries. It appears directly after
  `Key Insights / Risk Flags` in the sent email body, before every long
  event-based detail table, and displays `Kaynak: Question tablosu` plus
  `Toplam aktif kayıtlı soru` inside the section. The near-top
  `Rapor Şablonu: static-pool-v2` marker identifies the deployed report
  template; if the marker is absent from a real email, the runtime function is
  stale or not redeployed.
- Manual DB reset path after question pool replacement. The function-based
  reset path is currently not used. To restart analytics from zero, manually
  clear only `QuestionAttemptEvent`, `QuestionStatsProjection`, and
  `CategoryStatsProjection`. Do not delete `Question`, `Category`,
  `SubCategory`, `UserCategoryPreference`, `UserSubCategoryPreference`,
  `UserStatsProjection`, Solo progress, `GameRecord`, `OnlineMatchResult`,
  `Lobby`, leaderboard rows, score/Kronox Puan rows, `DiamondTransaction`,
  `DailyWheelSpin`, `UserJokerInventory`, `JokerTransaction`, users, or
  `AdminUser` rows. After reset, the report should
  still show current active question/category pool counts with zero exposure
  events.

### Phase 4 - Backend idempotency hardening

- Move Online result application fully backend-side if feasible.
- Move Diamond grants/spends backend-side if feasible.
- Enforce unique idempotency keys where platform supports them.

### Phase 5 - Cleanup jobs

- Implement scheduled status-transition jobs. Codex183 added callable
  admin-gated job functions; external/platform scheduling remains manual.
- Log job runs.
- Add archive/delete only after retention proof.

### Phase 6 - SEO/GEO projection

- Add `QuestionPublicProjection` only after product decides public content
  strategy. Codex183 added the protected schema boundary but no public pages
  or raw question exposure.
- Never switch public pages to raw `Question`.

## 14. Package Implementation Phases

| Package | Priority | Risk | Affected files/entities | Safe implementation path | Rollback | Migration | Manual proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2A Gateway contracts | P1 | Low | `src/lib/dbGateway/*`, Health | Codex183 implemented wrappers and docs; broad caller migration remains gradual. | Delete wrappers. | None. | Static build/lint. |
| 2B Leaderboard projection | P0 | Medium | `User`, `SoloLeaderboardEntry` or `LeaderboardProjection`, `getSoloLeaderboard` | Codex183 promoted `SoloLeaderboardEntry` and added refresh scaffolding; keep fallback. | Return to `User.kronox_puan_total`. | Additive/backfill. | Profile vs Leaderboard parity. |
| 2C Question query scaling | P0 | Medium | `Question`, `Category`, `getQuestions`, `startLobbyGame` | Add paging/index-aware category queries; no public raw access. | Revert gateway query function. | None/add `answer_year` later. | Large dataset deck sampling. |
| 2D Event analytics | P0 | Medium | New event/projection entities | Codex183 added event/projection schemas and gateway; gameplay write points remain future/manual. | Disable event writer. | Additive. | Event volume and no gameplay delay. |
| 2E Idempotency backend | P1 | High | `OnlineMatchResult`, `DiamondTransaction`, User update helpers | Backend authority/reserve-first; unique keys if supported. | Keep current client helpers. | Additive plus backfill audit rows optional. | Double-click/two-device probes. |
| 2F Cleanup jobs | P1 | Medium | `GameInvite`, `Lobby`, `PushSubscription`, logs | Codex183 added admin-gated dry-run functions; no hard delete. | Pause jobs. | None. | Scheduler and retry proof. |
| 2G SEO/GEO projection | P2 | Medium | `QuestionPublicProjection` | Codex183 added explicit public-safe projection schema only. | Disable public pages/projection reads. | Additive. | Public/private boundary probe. |

## 15. Manual/Runtime Proof Checklist

Before release after DB architecture changes:

- Verify unauthenticated `getQuestions` returns 401.
- Verify normal user receives minimal active-only question projection.
- Verify admin can access intended admin/full-bank views only.
- Load test question sampling with more than 500 rows.
- Verify passive categories/questions never enter Solo or Online decks.
- Verify leaderboard current user row equals Profile/Header Puan.
- Verify leaderboard top N does not expose raw email.
- Two-account invite: pending, dismiss toast, accept, lobby join, start.
- Invite expiry job transitions pending invites after TTL.
- Stale lobby job cancels waiting/starting only, not in-game/finished.
- Push expired endpoint is marked expired and in-app invite still works.
- Online scoring double-submit/double-mount applies once.
- Diamond starter/daily multi-device duplicate probe.
- Account deletion removes/anonymizes user-owned rows and does not affect other users.
- Admin reset updates `progress_reset_at`, score, diamonds, leaderboard row.
- Analytics event writes do not block placement or result flow.
- Public SEO page reads only `QuestionPublicProjection`, not raw `Question`.

## 16. Open Questions For Base44/Platform

1. Can Base44 entity schemas declare indexes in repo JSONC, or are indexes
   configured only in platform admin?
2. Can Base44 enforce unique constraints for `idempotency_key`,
   `category_id`, `owner_key`, `code`, and `user_email + endpoint`?
3. Are scheduled Base44 functions supported, or is external cron required?
4. Can service-role functions paginate with cursors beyond fixed `list` limits?
5. Can nested array fields such as `Lobby.players.email` be indexed or queried
   efficiently?
6. Are transactions or compare-and-set writes available for score/economy
   idempotency?
7. What is the recommended retention policy for deleted users' historical
   gameplay/audit rows under Kronox compliance requirements?
8. Can public-safe projections be made unauthenticated while source rows remain
   protected?
9. How are production index/config changes exported or documented so they are
   not lost between environments?

## Future Health Coverage Recommendations

- `db_gateway_direct_question_reads_blocked`
- `db_gateway_invite_lifecycle_single_source`
- `leaderboard_projection_unique_owner_key`
- `leaderboard_projection_sort_display_match`
- `diamond_transaction_unique_idempotency_key_configured_or_documented`
- `online_match_result_unique_idempotency_key_configured_or_documented`
- `cleanup_jobs_status_transition_only`
- `question_attempt_event_schema_exists`
- `question_stats_projection_schema_exists`
- `public_question_projection_does_not_expose_raw_question_bank`
- `base44_index_capability_documented`
