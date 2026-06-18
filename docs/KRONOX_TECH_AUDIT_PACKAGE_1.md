# KRONOX Technical Audit Package 1

Package: Audit only + Package 2 implementation plan  
Branch target: `Codex`  
Audit date: 2026-06-03  
Build marker observed: `Codex168`

This report is intentionally diagnostic. No gameplay rules, scoring rules,
database schema, Health cases, assets, or runtime logic were changed in Package
1.

## 1. Executive Summary

Kronox is substantially healthier than the earlier audit baseline: question
access now goes through authenticated `getQuestions`, visible Puan has a shared
helper, invite lifecycle code uses shared selectors, Online start is stricter
about selected categories, and Diamond/leaderboard docs exist. The remaining
release risks are not mostly "missing token" problems. They are lifecycle,
scale, race, and proof problems.

Release readiness: not release-ready until Package 2 fixes the P1 runtime risks
and the release proof checklist is executed on real devices/accounts.

Biggest risk pattern: several systems now have correct helper-level contracts,
but still run through multiple independent state loops or service-role sampling
paths. That can pass static Health while still producing flicker, stalls, stale
rankings, or insufficient-question errors in production.

Recommended Package 2 scope:

1. Consolidate invite/header/banner/Online pending invite state into one source.
2. Replace question-bank 500-row service-role sampling with scoped query/backfill strategy.
3. Harden Online game start/sync and reduce polling/realtime contention.
4. Move score and Diamond idempotency closer to backend/unique-key semantics.
5. Clean stale Health raw-source dependencies before deleting old UI.
6. Add manual proof gates for two-account invite, Online scoring, PWA/mobile, RLS, push, and Diamond races.

## 2. Top 10 Risks

### 1. Duplicate invite state loops can still flicker

- severity: P1
- affected files: `src/hooks/useHeaderNotifications.js`, `src/components/invites/GameInviteNotifier.jsx`, `src/components/invites/IncomingInvitesPanel.jsx`, `src/lib/inviteApi.js`
- why it matters: Header badge/list, banner toast, and Online pending panel all use shared selectors, but each still owns its own fetch/subscription/poll lifecycle. They can observe events in different orders and briefly disagree under slow fetch, app focus, or subscription lag.
- recommended Package 2 fix: introduce a single notification/invite data provider or store that merges fetch/subscription once, then expose view-model slices for header, banner, and Online.
- safe to fix directly in Package 2: yes, if behavior is reducer-driven and existing selectors remain the filtering source.
- manual/runtime proof required: yes, two-account invite test with banner timeout, header panel, Online panel, and accept flow.

### 2. Online game sync uses aggressive overlapping polling/subscription paths

- severity: P1
- affected files: `src/hooks/useLobbySync.js`, `src/hooks/useWaitingRoomSync.js`, `src/hooks/useGameActions.js`, `src/pages/Game.jsx`
- why it matters: Online gameplay uses realtime subscription plus 1.5s lobby polling, waiting-room start polling, 2s roster polling, rejoin assertion, and optimistic local writes. This improves recovery but can cause churn, stale overwrites, or "game stuck" symptoms when writes are rejected or subscriptions arrive late.
- recommended Package 2 fix: consolidate lobby/game sync into a small state machine with source priority, adaptive polling, stale-write recovery UI, and explicit reconnect states.
- safe to fix directly in Package 2: yes, but should be narrow and test-driven.
- manual/runtime proof required: yes, two-account host start and reconnect/refresh tests.

### 3. Question access is authenticated, but still samples the newest 500 rows

- severity: P1
- affected files: `base44/functions/getQuestions/entry.ts`, `base44/functions/startLobbyGame/entry.ts`
- why it matters: Both functions read `Question.list('-created_date', 500)` through service role and filter in memory. With a larger dataset, valid active questions outside the newest 500 can be missed, causing false insufficient-pool errors for Solo or Online.
- recommended Package 2 fix: add index/query strategy by `state`, `main_category_id`, and normalized year, or introduce a backend sampling function that pages until enough active unique-year rows are found.
- safe to fix directly in Package 2: yes, if runtime projection remains minimal and gameplay rules are unchanged.
- manual/runtime proof required: backend probe with dataset over 500 rows.

### 4. Online start errors still expose debug details and depend on sampled content

- severity: P1
- affected files: `base44/functions/startLobbyGame/entry.ts`, `src/components/lobby/WaitingRoomPanel.jsx`
- why it matters: `startLobbyGame` now blocks permissive fallback, but error responses include selected IDs and active category details in `debug`. It also samples only 500 questions. This can both expose internals and produce content false negatives.
- recommended Package 2 fix: return user-safe Turkish errors to normal clients, admin-gate debug details, and replace the 500-row content sample.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes, host start with selected categories, insufficient questions, and accepted invite flow.

### 5. Online scoring idempotency is safer but not transactional

- severity: P1
- affected files: `src/lib/applyOnlineResult.js`, `src/lib/onlineRanking.js`, `src/pages/Game.jsx`, `base44/entities/OnlineMatchResult.jsonc`
- why it matters: The client reserves an `OnlineMatchResult` row before writing visible Puan, then repairs on retry if the score write fails. This is a strong improvement, but it is still client-side per-user orchestration with no true transaction or unique constraint proof. Also each client updates only its own profile, so the loser may not apply a loss if their client never reaches the result path.
- recommended Package 2 fix: move result application to a backend function that validates lobby/player, applies both player results or records pending per-player recovery, and enforces unique match-player idempotency.
- safe to fix directly in Package 2: yes, but high blast radius; keep score math untouched.
- manual/runtime proof required: yes, two-account win/loss persistence, refresh/reopen, and loser-disconnect case.

### 6. Diamond idempotency is best-effort under multi-device races

- severity: P1
- affected files: `src/lib/diamondEconomy.js`, `src/lib/AuthContext.jsx`, `base44/entities/DiamondTransaction.jsonc`
- why it matters: The flow checks existing ledger/guards, writes `User.diamonds`, refreshes, then writes ledger. Without a unique idempotency key or backend transaction, two devices can race and double-grant, or balance and ledger can temporarily diverge.
- recommended Package 2 fix: implement backend grant function with durable idempotency key semantics. If Base44 cannot enforce uniqueness, document the limitation and add reconciliation/backfill.
- safe to fix directly in Package 2: yes, if reward amounts and UI behavior remain unchanged.
- manual/runtime proof required: yes, multi-tab/device duplicate grant test.

### 7. Leaderboard ranking still has scale and backfill limits

- severity: P1
- affected files: `base44/functions/getSoloLeaderboard/entry.ts`, `src/lib/leaderboard.js`, `base44/entities/User.jsonc`, `base44/entities/SoloLeaderboardEntry.jsonc`
- why it matters: The leaderboard now sorts by persisted `kronox_puan_total`, but it fetches only the top 500 users and backfills at most 25 missing projections per request. Users without projection may rank incorrectly until backfilled. Current-user rank outside the top window remains approximate.
- recommended Package 2 fix: formalize `kronox_puan_total` as indexed, run explicit idempotent backfill, and add current-user rank strategy that does not fetch/sort a 500-row slice.
- safe to fix directly in Package 2: partially. Backend index/backfill must be controlled.
- manual/runtime proof required: dataset/rank probe with more than 500 users.

### 8. Active lobby recovery can miss valid lobbies

- severity: P2
- affected files: `src/lib/activeLobby.js`, `src/pages/LobbyRoom.jsx`
- why it matters: Active-lobby recovery searches hosted lobbies and then checks the latest 20 waiting lobbies for membership. A user in an older waiting lobby can be missed when many lobbies exist.
- recommended Package 2 fix: create a backend active-lobby lookup by host/player identity or persist searchable member keys.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes, multi-lobby dataset probe.

### 9. Health Center still depends on stale raw-source imports

- severity: P2
- affected files: `src/components/game/simulationPanelExtraCases.jsx`, `src/components/game/simulationPanelHealthOverrideCases.jsx`, `src/components/game/simulationPanelPackage2AuditCases.jsx`, `src/components/lobby/CreateLobbyInvitePanel.jsx`, `src/pages/PlayerSetup.jsx`
- why it matters: Some runtime-stale files remain because Health imports them as raw source. That blocks safe cleanup and creates false confidence around removed flows.
- recommended Package 2 fix: migrate old Health cases to current runtime files first, then delete genuinely unused components/assets.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no for static cleanup, yes for flows the cases represent.

### 10. User-facing error handling still mixes app UI, native confirm, and logs

- severity: P2
- affected files: `src/pages/Game.jsx`, `src/hooks/useGameActions.js`, `src/pages/LobbyRoom.jsx`, `base44/functions/updateLobbyGameState/entry.ts`, `base44/functions/acceptGameInvite/entry.ts`, `base44/functions/startLobbyGame/entry.ts`
- why it matters: Critical flows mostly show inline errors now, but native `window.confirm` remains in gameplay back navigation, and backend debug/log payloads can include actor emails or lobby internals. Error shapes are not fully consistent.
- recommended Package 2 fix: replace native confirmation with app modal, standardize safe error envelopes, admin-gate debug details, and ensure retry buttons reset loading states.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: visual/mobile smoke test.

## 3. Notification System Audit

### Finding: Shared selectors are good, but state ownership is duplicated

- severity: P1
- affected files: `src/lib/gameInviteSelectors.js`, `src/lib/notificationViewModel.js`, `src/hooks/useHeaderNotifications.js`, `src/components/invites/GameInviteNotifier.jsx`, `src/components/invites/IncomingInvitesPanel.jsx`
- why it matters: `gameInviteSelectors` and `notificationViewModel` correctly separate active invite state from toast dismiss state. However, header, notifier, and Online panel still each fetch/subscribe/poll independently. A stale empty fetch in one surface may be preserved locally, but another surface can still be out of phase.
- recommended Package 2 fix: move fetch/subscription/merge into `useGameInviteNotifications` or a provider, expose `viewModel`, `openGameInvite`, and refresh state to all consumers.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### Finding: Toast dismiss is visual-only, but remembered dismisses are local to notifier

- severity: P2
- affected files: `src/components/invites/GameInviteNotifier.jsx`, `src/lib/notificationViewModel.js`
- why it matters: This is correct for current product rules: dismissed toast IDs do not hide header/Online actionable lists. But the state is local to the notifier and resets on user/session change, so repeated banners after remount/focus can still occur.
- recommended Package 2 fix: central store should own toast-dismiss memory with TTL-limited visual-only semantics.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### Finding: Expiring pending invites is performed from clients

- severity: P2
- affected files: `src/lib/inviteApi.js`, `base44/functions/acceptGameInvite/entry.ts`, `base44/functions/sendGameInvitePush/entry.ts`
- why it matters: `loadIncomingInviteSnapshot` and push/accept functions can update expired invites. Multiple clients can race the same lifecycle mutation. It is usually harmless, but the authoritative lifecycle should ideally be backend-owned.
- recommended Package 2 fix: keep client filtering passive; add backend cleanup/expire function or make accept/send paths the only mutating expiration authority.
- safe to fix directly in Package 2: yes, if UI still hides expired invites.
- manual/runtime proof required: no for static flow, yes for expiry runtime.

### Finding: Invite diagnostics can be enabled by normal users

- severity: P2
- affected files: `src/lib/gameInviteSelectors.js`
- why it matters: `isGameInviteTraceEnabled` allows `?inviteDebug=1` or localStorage in production for non-admin users. Logs contain invite IDs, lobby IDs, emails, statuses, and timestamps. That is useful during debugging but too broad for release.
- recommended Package 2 fix: restrict production tracing to admin/dev, or redact IDs/emails for non-admin debug.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no.

## 4. Online Gameplay Stability Audit

### Finding: Lobby sync has multiple competing live-data paths

- severity: P1
- affected files: `src/hooks/useLobbySync.js`, `src/hooks/useWaitingRoomSync.js`
- why it matters: Subscriptions, polling, route-state fallback, roster polling, start polling, and rejoin assertion all mutate lobby state. This helps recover from realtime gaps, but makes it hard to prove which source wins during accept/start/reconnect.
- recommended Package 2 fix: use reducer-style lobby state with events: `route_state`, `initial_fetch`, `subscription`, `poll`, `rejoin`, `terminal`. Define source priority and never clear live lobby while verification is in flight.
- safe to fix directly in Package 2: yes with careful tests.
- manual/runtime proof required: yes.

### Finding: Online state updates retry but do not surface final failure to player

- severity: P1
- affected files: `src/hooks/useGameActions.js`, `base44/functions/updateLobbyGameState/entry.ts`
- why it matters: Placement writes retry twice, then fetch latest lobby. If the current player write fails repeatedly, the UI may recover latest state but the user may not see a clear retry/failure state. This can feel like a freeze.
- recommended Package 2 fix: expose a transient "syncing/retrying" and final "sync failed, retry" state in Game UI without touching drag/drop logic.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes, network throttling.

### Finding: Host start has good inline error handling but backend debug leaks remain

- severity: P2
- affected files: `src/components/lobby/WaitingRoomPanel.jsx`, `base44/functions/startLobbyGame/entry.ts`
- why it matters: Host sees safe inline copy, but backend response still includes debug fields for all callers.
- recommended Package 2 fix: return `debug` only to admin/dev or only under a signed debug flag.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no.

### Finding: Guest host path is permissive

- severity: P2
- affected files: `base44/functions/startLobbyGame/entry.ts`, `src/lib/lobbyUtils.js`
- why it matters: `guestHost` accepts unauthenticated starts when host email starts `guest_` and body player name matches first player. If guest Online is still supported, this needs a nonce; if not, it should be removed.
- recommended Package 2 fix: decide guest-lobby policy. If guests remain, add per-lobby join/start nonce or require auth for Online.
- safe to fix directly in Package 2: needs product decision.
- manual/runtime proof required: yes.

## 5. DB / Data Model Audit

### User/Profile

- current state: `User` stores `solo_progress`, `online_progress`, `kronox_puan_total`, `diamonds`, reward guard fields, admin role-ish fields, and profile metadata.
- severity: P1
- affected files: `base44/entities/User.jsonc`, `src/lib/kronoxScore.js`, `src/lib/leaderboard.js`, `src/lib/diamondEconomy.js`
- why it matters: `User` is the current practical aggregate root, but high-churn stats, economy, and progress are compressed into profile JSON. This is workable now and weak at scale.
- recommended Package 2 fix: keep current fields but add backfill/reconciliation tasks and plan future `UserGameStats`, `SoloLevelProgress`, and server-side economy grant functions.
- safe to fix directly in Package 2: partial.
- manual/runtime proof required: migration/backfill probes.

### Category

- current state: canonical field is `category_id`; docs and helpers allow `categoryid` only as import alias. `status` and `description` exist.
- severity: P2
- affected files at the time of this historical audit: `base44/entities/Category.jsonc`, `src/lib/categoryFilters.js`, the now-removed category seed helper, `docs/KRONOX_CATEGORY_TAXONOMY.md`
- why it matters: This is now documented, but active category status still depends on list reads and in-memory filtering in several places.
- recommended Package 2 fix at the time: keep `category_id` canonical, ensure category backfill/content management is explicit, and query active categories server-side where Base44 supports it.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: DB seed/status verification.

### Question

- current state: schema is new dataset shape: `id`, `question`, `answer`, category IDs, metadata, `difficulty`, `state`. Runtime adapters derive `year`, `category`, and `type`.
- severity: P1
- affected files: `base44/entities/Question.jsonc`, `base44/functions/getQuestions/entry.ts`, `src/lib/questionRuntimeAdapter.js`, `src/hooks/useOfflineQuestions.js`, `base44/functions/startLobbyGame/entry.ts`
- why it matters: Runtime is compatible, but there is no normalized year index and both get/start paths sample 500 rows then parse answer. Unique-year deck and category filtering will become expensive/fragile as content grows.
- recommended Package 2 fix: add/derive `answer_year` or equivalent import-time normalized year field, plus active/category/year query strategy.
- safe to fix directly in Package 2: data-model addition yes; destructive migration no.
- manual/runtime proof required: import/backfill test.

### Lobby

- current state: large row containing roster, selected categories, game state, used question IDs, status, expiry, revision.
- severity: P1
- affected files: `base44/entities/Lobby.jsonc`, `base44/functions/startLobbyGame/entry.ts`, `base44/functions/updateLobbyGameState/entry.ts`, `src/hooks/useLobbySync.js`
- why it matters: Lobby is the authority, but it carries mutable game state as one row. That makes state_revision critical and increases write contention.
- recommended Package 2 fix: keep authority model, but add explicit event/state diagnostics and reduce overlapping writes/polls.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### GameInvite / FriendRequest

- current state: invite TTL is 10 minutes; selectors normalize timestamps and recipients; accept uses backend service role; friend requests are separate.
- severity: P2
- affected files: `base44/entities/GameInvite.jsonc`, `src/lib/inviteApi.js`, `base44/functions/acceptGameInvite/entry.ts`, `src/lib/friendsApi.js`
- why it matters: Lifecycle is functional but expiration is partly client-triggered and notification state duplicated.
- recommended Package 2 fix: centralize invite store and backend expiration ownership.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### OnlineMatchResult

- current state: durable per-user/lobby audit row before visible score write, with reconciliation.
- severity: P1
- affected files: `base44/entities/OnlineMatchResult.jsonc`, `src/lib/applyOnlineResult.js`
- why it matters: Good idempotency marker, but no server-side unique/transaction proof and each client updates only itself.
- recommended Package 2 fix: backend result finalization or server-side per-player result apply.
- safe to fix directly in Package 2: high blast radius.
- manual/runtime proof required: yes.

### DiamondTransaction

- current state: ledger exists and recovery helpers exist, but grant writes balance before ledger row.
- severity: P1
- affected files: `base44/entities/DiamondTransaction.jsonc`, `src/lib/diamondEconomy.js`
- why it matters: Ledger and balance can diverge under failure/race. Multi-device duplicate prevention is best-effort.
- recommended Package 2 fix: backend grant once function with idempotency key as durable unique contract.
- safe to fix directly in Package 2: yes with proof.
- manual/runtime proof required: yes.

### Leaderboard Projection

- current state: `kronox_puan_total` exists and leaderboard rows are public-safe. There is also `SoloLeaderboardEntry` projection/publish.
- severity: P1
- affected files: `base44/functions/getSoloLeaderboard/entry.ts`, `base44/functions/getSoloLeaderboard/entry/entry.ts`, `src/lib/leaderboard.js`
- why it matters: Duplicate function mirror path risks drift. Projection is not guaranteed fully backfilled/indexed.
- recommended Package 2 fix: remove or clearly rename mirror after Health migration, run backfill, confirm index/sort behavior.
- safe to fix directly in Package 2: yes for docs/Health cleanup; backend index needs care.
- manual/runtime proof required: scale probe.

## 6. Performance / Scalability Audit

### Finding: Leaderboard top-N strategy depends on projection completeness

- severity: P1
- affected files: `base44/functions/getSoloLeaderboard/entry.ts`
- why it matters: Sorting by `-kronox_puan_total` is good, but users without a projection can be ordered incorrectly. Only 25 rows are backfilled per request.
- recommended Package 2 fix: one-time/admin backfill all users, then require projection writes on every score change.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### Finding: Question loading is client-friendly but backend-heavy

- severity: P1
- affected files: `base44/functions/getQuestions/entry.ts`, `src/hooks/useOfflineQuestions.js`, `src/lib/questionCache.js`
- why it matters: Authenticated minimal projection protects the bank, but the backend still scans/samples too much and the client stores a 24h cache. First-run offline has no safe bundled fallback.
- recommended Package 2 fix: implement scoped backend paging and decide whether Offline Solo requires a bundled public-safe sample deck.
- safe to fix directly in Package 2: yes after product decision on offline-first.
- manual/runtime proof required: yes.

### Finding: Waiting room and gameplay polling add load

- severity: P2
- affected files: `src/hooks/useWaitingRoomSync.js`, `src/hooks/useLobbySync.js`
- why it matters: Every online player can poll lobby rows every 1.5-2s in addition to subscriptions. This scales poorly and may amplify state churn.
- recommended Package 2 fix: adaptive polling: aggressive only during bootstrap/start/reconnect, slower backoff when subscriptions are healthy.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

### Finding: Asset set has intentional but possibly unused WebP files

- severity: P3
- affected files: `public/assets/ui/*`, `public/assets/ui/README.md`, `src/pages/MainMenu.jsx`, `public/kronox-sw.js`
- why it matters: MainMenu is currently CSS/motion-driven and does not use Home WebP buttons/background. Service worker uses `kronox_hero_section_v1.webp`. README lists cleanup candidates but assets remain.
- recommended Package 2 fix: keep CSS/motion Home as product truth or explicitly wire WebP; then delete only reference-proven unused assets after Health/doc updates.
- safe to fix directly in Package 2: yes, after reference audit.
- manual/runtime proof required: visual smoke test.

## 7. Scoring / Timing Audit

### Finding: Unified Puan helper is centralized

- severity: P2
- affected files: `src/lib/kronoxScore.js`, `src/pages/ProfilePage.jsx`, `src/pages/LeaderboardPage.jsx`, `src/lib/leaderboard.js`
- why it matters: `getKronoxVisibleScore` is the visible source: Solo total plus online score. Leaderboard projection uses the same concept. This is good, but projection backfill and function mirror drift remain risks.
- recommended Package 2 fix: keep helper as source, add projection consistency Health/runtime checks, run backfill.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: Profile vs Leaderboard row after Online match.

### Finding: Online elapsed time uses player-own source, but result persistence remains client-local

- severity: P1
- affected files: `src/pages/Game.jsx`, `src/lib/onlinePlayerElapsed.js`, `src/lib/applyOnlineResult.js`
- why it matters: Player-own elapsed ref avoids total-lobby-duration bonus bugs. The remaining risk is not math; it is persistence ownership and opponent/loser application.
- recommended Package 2 fix: backend result finalization with individual elapsed seconds carried per player where available.
- safe to fix directly in Package 2: high blast radius.
- manual/runtime proof required: yes.

### Finding: Solo scoring rules match docs, but failure persistence errors are only debug logged

- severity: P2
- affected files: `src/pages/Game.jsx`, `src/lib/soloLevels.js`, `src/lib/soloProgressHelpers.js`
- why it matters: Solo result math and popups use actual attempt data, but if `writeSoloProgress` fails the user sees the result popup without a clear persistence failure/retry path.
- recommended Package 2 fix: surface a non-blocking "ilerleme kaydedilemedi" retry state in Solo result without changing score math.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: network failure test.

## 8. Solo Question Engine Audit

### Finding: Runtime now passes active category whitelist

- severity: P2
- affected files: `src/hooks/useOfflineQuestions.js`, `src/pages/Game.jsx`, `src/lib/soloQuestionEngine.js`
- why it matters: The prior audit finding is addressed: `activeCategoryIds` from authenticated question fetch/cache is passed to `buildSoloAttemptDeck`.
- recommended Package 2 fix: add a runtime/integration Health case that exercises the actual Game init path rather than helper-only tokens.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: Solo deck probe.

### Finding: Unique-year deck can fail because backend sample is incomplete

- severity: P1
- affected files: `base44/functions/getQuestions/entry.ts`, `src/lib/soloQuestionEngine.js`
- why it matters: The engine correctly refuses to relax 18 unique years. If the server returns a partial 500-row sample, the engine can fail even when the DB has enough valid unique years.
- recommended Package 2 fix: backend should fetch/paginate until it can satisfy the unique-year deck contract or return a real content error.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: seeded large dataset test.

### Finding: Offline-first cache preserves playability but not first-run offline

- severity: P2
- affected files: `src/hooks/useOfflineQuestions.js`, `src/lib/questionCache.js`
- why it matters: Direct public `Question.list` fallback was correctly removed. But first-run offline without cache now fails, which may conflict with "Preserve Offline Solo" depending on product expectations.
- recommended Package 2 fix: decide whether to ship a small public-safe offline seed pack or define Offline Solo as "offline after first authenticated sync."
- safe to fix directly in Package 2: needs product decision.
- manual/runtime proof required: offline/PWA test.

## 9. Diamond Economy Audit

### Finding: Bootstrap is guarded per user/day but not transactionally durable

- severity: P1
- affected files: `src/lib/AuthContext.jsx`, `src/lib/diamondEconomy.js`
- why it matters: `AuthContext` uses an in-session ref keyed by email/day, which prevents React rerender duplication. Durable protection depends on user guard fields and best-effort ledger checks.
- recommended Package 2 fix: move grants to backend `grantDiamondRewardOnce` with unique idempotency key if available.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: two-device race.

### Finding: Balance displays use the real field

- severity: P3
- affected files: `src/components/layout/StandardTopBar.jsx`, `src/pages/ProfilePage.jsx`, `src/pages/MainMenu.jsx`, `src/pages/SoloChallenge.jsx`, `src/components/lobby/OnlineChallengeScreen.jsx`, `src/lib/leaderboard.js`
- why it matters: Elmas no longer appears to be derived from score/stars/level. This is good; the remaining risk is grant consistency, not display.
- recommended Package 2 fix: keep displays helper-based and add runtime proof after grants.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: UI smoke.

## 10. Security Audit

### Finding: Question-bank public fallback is removed, but service-role function remains broad

- severity: P1
- affected files: `base44/functions/getQuestions/entry.ts`, `src/hooks/useOfflineQuestions.js`
- why it matters: Unauthenticated calls now return 401 and gameplay uses minimal projection. However the function still service-role lists 500 rows before filtering and parsing. Admin full-bank behavior is protected, but normal gameplay should be scoped server-side as much as possible.
- recommended Package 2 fix: query active/category/year pages instead of broad list; confirm Question entity public read policy in Base44/RLS.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: unauth/auth/admin probes.

### Finding: Admin function guards are role/config based

- severity: P2
- affected files at the time of this historical audit: `base44/functions/generateTechDoc/entry.ts`, `base44/functions/generateWorkflowDoc/entry.ts`, and the now-removed category seed helper.
- why it matters: Hardcoded admin email is removed from the inspected admin functions. Admin config must still be set in deployment secrets for allowlist fallback.
- recommended Package 2 fix: factor repeated admin guard into shared server helper if Base44 function packaging supports it.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: admin/non-admin function probes.

### Finding: Test/admin functions use service role and legacy question assumptions

- severity: P2
- affected files: `base44/functions/runTestSuite/entry.ts`, `base44/functions/simulateOnlineGame/entry.ts`
- why it matters: They are admin-gated, but contain many legacy `Question.list`, `year`, `category`, `type` assumptions and service-role access. They can drift from current data model and give false test results.
- recommended Package 2 fix: update or quarantine legacy backend test suites; ensure they use current adapters or mark as historical.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no for static cleanup, yes if used as release proof.

### Finding: Secrets are not visibly hardcoded in current source

- severity: P3
- affected files: `base44/functions/sendGameInvitePush/entry.ts`, `src/lib/notificationApi.js`, `docs/KRONOX_SECURITY_DEPLOYMENT.md`
- why it matters: VAPID reads from env/config and Spotify integration is absent from runtime functions. Deployment rotation remains an external requirement.
- recommended Package 2 fix: keep secret scan in release checklist and rotate exposed historical keys outside repo.
- safe to fix directly in Package 2: no code required unless scan flags new values.
- manual/runtime proof required: deployment/security scan.

## 11. Health Center Audit

### Finding: `simulationPanelExtraCases.jsx` remains large and imports stale runtime files

- severity: P2
- affected files: `src/components/game/simulationPanelExtraCases.jsx`
- why it matters: It is 2469 lines and imports old files such as `CreateLobbyInvitePanel.jsx` and `PlayerSetup.jsx`. This prevents safe dead-code removal and makes Health harder to reason about.
- recommended Package 2 fix: split remaining Extra cases into focused suites or retire cases that protect removed flows.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no.

### Finding: Static raw-source mirrors can drift from real functions

- severity: P2
- affected files: `base44/functions/getSoloLeaderboard/entry/entry.ts`, `src/lib/healthMirrors/*.js`, `src/components/game/simulationPanel*Cases.jsx`
- why it matters: Mirrors make Health pass even if real deployed function changes or raw import path drifts. They should be used only when the raw-import limitation is documented and sync-tested.
- recommended Package 2 fix: add mirror-sync checks or replace mirrors with direct source import where possible.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no.

### Finding: Health covers many contracts but still misses runtime ordering

- severity: P1
- affected files: `src/components/game/simulationPanelNotificationLifecycleCases.jsx`, `src/components/game/simulationPanelSoloQuestionEngineCases.jsx`, `src/components/game/simulationPanelBackendSecurityCases.jsx`, `src/components/game/simulationPanelPackage2AuditCases.jsx`
- why it matters: Health now has cases for many critical contracts, but static checks cannot prove no flicker, no online stall, no score double-apply, or no Diamond race.
- recommended Package 2 fix: keep runtime-only probes as NOT_AUTOMATABLE and add release-proof links/results rather than fake static PASS.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: yes.

## 12. Docs Consistency Audit

### Finding: Required docs exist at `docs/`

- severity: P3
- affected files: `docs/KRONOX_SCORING_RULES.md`, `docs/KRONOX_SOLO_QUESTION_ENGINE.md`, `docs/KRONOX_SECURITY_DEPLOYMENT.md`, `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`, `docs/KRONOX_QUESTION_DATA_MODEL.md`, `docs/KRONOX_ECONOMY_RULES.md`, `docs/KRONOX_CATEGORY_TAXONOMY.md`
- why it matters: The requested docs are present and broadly match current architecture. `src/docs/KRONOX_SOLO_QUESTION_ENGINE.md` also exists as a runtime mirror, which is useful but can drift.
- recommended Package 2 fix: add doc mirror sync rule/check if `src/docs` must remain.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: no.

### Finding: Generated technical docs can become stale

- severity: P2
- affected files: `base44/functions/generateTechDoc/entry.ts`, `base44/functions/generateWorkflowDoc/entry.ts`
- why it matters: Generated PDFs are admin-gated, but their content references architecture and can lag code. This is lower product risk but important for future Codex context.
- recommended Package 2 fix: update generated doc content after Package 2 or reduce generated docs to link to source docs.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: admin smoke test if function changed.

### Finding: Home asset truth is documented as CSS/motion, not WebP runtime

- severity: P3
- affected files: `src/pages/MainMenu.jsx`, `public/assets/ui/README.md`, `src/components/game/simulationPanelHealthOverrideCases.jsx`
- why it matters: Current Home uses CSS/motion CTAs and no external image background. This conflicts with older product wording that said Home uses WebP button/background assets. README documents current truth and cleanup candidates.
- recommended Package 2 fix: decide final truth. If CSS/motion remains accepted, update any stale product docs/Health and mark unused assets for deletion.
- safe to fix directly in Package 2: yes.
- manual/runtime proof required: visual smoke.

## 13. Dead Code / Assets Cleanup Candidates

### Candidate: Old invite creation panel

- severity: P2
- affected files: `src/components/lobby/CreateLobbyInvitePanel.jsx`, `src/components/game/simulationPanelExtraCases.jsx`
- why it matters: Runtime routing no longer imports this component, but Health still imports/checks it.
- recommended Package 2 fix: migrate/remove stale Health cases, then delete the component if no runtime reference remains.
- safe to fix directly in Package 2: yes after Health migration.
- manual/runtime proof required: Online invite flow smoke.

### Candidate: Old player setup page

- severity: P2
- affected files: `src/pages/PlayerSetup.jsx`, `src/components/game/simulationPanelExtraCases.jsx`, `base44/functions/simulateOnlineGame/entry.ts`
- why it matters: Runtime route references were not found in inspected code, but Health and simulation docs still reference it.
- recommended Package 2 fix: confirm route table, migrate Health references, then delete or mark as archived.
- safe to fix directly in Package 2: yes after route audit.
- manual/runtime proof required: navigation smoke.

### Candidate: Legacy client-side Online start helper

- severity: P2
- affected files: `src/lib/onlineGameStart.js`, `base44/functions/generateTechDoc/entry.ts`, `base44/functions/generateWorkflowDoc/entry.ts`
- why it matters: Runtime uses `startLobbyGame` backend through `WaitingRoomPanel`; this helper appears referenced only by docs/generated docs. It contains stale category/type/year assumptions.
- recommended Package 2 fix: delete or move to historical docs after confirming no runtime imports.
- safe to fix directly in Package 2: yes after final `rg`.
- manual/runtime proof required: host start smoke.

### Candidate: Home WebP assets

- severity: P3
- affected files: `public/assets/ui/Kronox_Home_Button_Solo.webp`, `public/assets/ui/Kronox_Home_Button_Online.webp`, `public/assets/ui/Kronox_Home_Fantasy_background.webp`, `public/assets/ui/home-background-full.webp`, `public/assets/ui/home-screen-final.webp`, `public/assets/ui/Kronox-Cosmic_background.webp`
- why it matters: MainMenu does not import these. `kronox_hero_section_v1.webp` is used by service worker and should be kept.
- recommended Package 2 fix: decide Home visual truth and delete only assets with no code/docs/service-worker references.
- safe to fix directly in Package 2: yes after reference proof.
- manual/runtime proof required: visual smoke.

## 14. Package 2 Fix Plan

### Package 2A - Safe Cleanup and Health Alignment

- priority: P1/P2
- risk: low to medium
- expected files: `src/components/game/simulationPanelExtraCases.jsx`, modular Health suites, `src/components/lobby/CreateLobbyInvitePanel.jsx`, `src/pages/PlayerSetup.jsx`, docs/Health mirrors
- work items:
  1. Move stale Extra cases to modular suites or remove historical cases.
  2. Remove Health raw-source dependencies on old runtime files.
  3. Delete dead UI only after final reference proof.
  4. Replace native `window.confirm` with app modal if no gameplay rules change.
  5. Restrict production invite diagnostics to admin/dev or redact.
- tests: `git diff --check`, `npm run lint`, `npm run build`, focused Health around cleanup/report integrity, manual navigation smoke.

### Package 2B - Question Access and Data-Scale Fixes

- priority: P1
- risk: medium
- expected files: `base44/functions/getQuestions/entry.ts`, `base44/functions/startLobbyGame/entry.ts`, `src/hooks/useOfflineQuestions.js`, `src/lib/questionRuntimeAdapter.js`, docs/Health
- work items:
  1. Replace 500-row broad service-role sampling with paged/scoped active question reads.
  2. Normalize/import `answer_year` or equivalent if Base44 indexing supports it.
  3. Preserve minimal runtime projection and no direct public `Question.list`.
  4. Add insufficient-pool diagnostics that are safe for normal users.
  5. Decide first-run offline behavior: cache-only or bundled safe deck.
- tests: backend security Health, solo question engine Health, Online start Health, large dataset backend probe.

### Package 2C - Notification and Lobby State Stabilization

- priority: P1
- risk: medium to high
- expected files: `src/hooks/useHeaderNotifications.js`, `src/components/invites/GameInviteNotifier.jsx`, `src/components/invites/IncomingInvitesPanel.jsx`, `src/lib/notificationViewModel.js`, `src/hooks/useWaitingRoomSync.js`, `src/hooks/useLobbySync.js`
- work items:
  1. Add one invite notification data provider/store.
  2. Keep selector/view-model semantics unchanged.
  3. Collapse duplicated fetch/subscription/poll behavior.
  4. Add lobby sync source-priority reducer and adaptive polling.
  5. Surface sync retry/failure states in Online gameplay.
- tests: notification lifecycle Health, invite lifecycle Health, two-account invite/lobby manual tests.

### Package 2D - Idempotency and Projection Hardening

- priority: P1
- risk: high
- expected files: `src/lib/applyOnlineResult.js`, new/updated backend score function, `src/lib/diamondEconomy.js`, Diamond backend function if added, leaderboard function/backfill docs
- work items:
  1. Move Online match result apply toward backend finalization or server-side per-player apply.
  2. Add loser-disconnect recovery/diagnostic for match results.
  3. Harden Diamond grants with backend idempotency key or documented Base44 limitation.
  4. Backfill and enforce `kronox_puan_total`.
  5. Add leaderboard current-user rank strategy beyond top 500.
- tests: Online score Health, Diamond Health, leaderboard Health, two-account score persistence, multi-device Diamond race.

### Package 2E - Docs and Release Proof

- priority: P2
- risk: low
- expected files: `docs/*`, generated admin docs if updated
- work items:
  1. Keep `docs/KRONOX_SOLO_QUESTION_ENGINE.md` and `src/docs` mirror synced.
  2. Update architecture docs after Package 2 changes.
  3. Attach manual proof results to `docs/KRONOX_RELEASE_PROOF_CHECKLIST.md`.
  4. Record unresolved Base44 transaction/RLS limitations.
- tests: doc Health, report integrity, manual checklist completion.

## 15. Manual / Runtime Proof Checklist

Package 2 should not claim release readiness until these are executed:

1. Two-account invite lifecycle:
   - A invites B.
   - B sees banner.
   - Banner times out.
   - Header and Online pending list still show invite.
   - B accepts from banner/header/Online list.
   - Both enter lobby without stale/expired flash.

2. Two-account Online start:
   - Host starts after B accepted.
   - No 400 for selected active categories.
   - Both navigate to game.
   - Refresh/reconnect does not stall.

3. Online scoring persistence:
   - Winner visible Puan increases by correct individual-time delta.
   - Loser visible Puan decreases with checkpoint protection.
   - Refresh preserves values.
   - Reopen/refresh does not double-apply.

4. Solo question engine:
   - Attempt deck has 18 questions, 18 unique IDs, 18 unique years.
   - Passive category rows are excluded.
   - Replay creates a new deck.
   - Insufficient unique years shows clean error.

5. Diamond economy:
   - First entry grants 120 total on first day.
   - Refresh same day does not duplicate.
   - Two tabs/devices do not duplicate, or limitation is documented.

6. Security/RLS:
   - `getQuestions` unauthenticated returns 401.
   - Non-admin cannot request full/admin bank.
   - Wrong user cannot accept invite or mutate lobby/player state.
   - Admin-only docs/seed/test functions reject normal users.

7. Mobile/PWA:
   - Home no-scroll and safe-area OK.
   - Solo map scrolls only in map area.
   - Drag/drop does not scroll page.
   - Push works with real VAPID secrets, and missing VAPID keeps in-app invite working.

## 16. Open Questions / Decisions Needed

1. Should first-run Offline Solo work before any authenticated question sync?
   - If yes, add a public-safe bundled minimal deck or another protected offline strategy.
   - If no, document "offline after first sync" in product docs.

2. Are unauthenticated guest Online lobbies still supported?
   - If yes, add nonce-based guest authority.
   - If no, remove guest host paths.

3. What is the final Home asset truth?
   - CSS/motion current runtime, or WebP artwork assets.
   - This must be settled before asset deletion.

4. Does Base44 provide unique constraints or safe upsert for idempotency keys?
   - Needed for OnlineMatchResult and DiamondTransaction hardening.

5. Should leaderboard expose rank outside top N?
   - If yes, add server rank query/backfill.
   - If no, UI should clearly avoid implying global exact rank outside returned rows.

6. Should backend debug payloads be admin-gated globally?
   - Recommended yes for `startLobbyGame`, `updateLobbyGameState`, and accept/start diagnostics.

7. Should generated PDF docs remain an authoritative artifact?
   - If yes, update them after Package 2.
   - If no, reduce them to links/summaries of markdown docs.
