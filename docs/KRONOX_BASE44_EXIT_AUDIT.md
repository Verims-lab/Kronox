# Kronox Base44 Exit Risk And Migration Audit

Status: technical audit and migration plan.

This document is an audit only. It does not implement a migration, change
runtime behavior, or change product contracts.

## Executive Summary

Kronox is tightly coupled to Base44 today. The coupling is not limited to one
API client:

* `package.json` depends on `@base44/sdk` and `@base44/vite-plugin`.
* `vite.config.js` installs the Base44 Vite plugin, with notifier, navigation,
  analytics, and visual edit hooks enabled.
* `src/api/base44Client.js` creates the shared frontend SDK client.
* Frontend runtime code calls Base44 auth, entities, functions, subscriptions,
  and provider login paths directly from pages, hooks, and shared libs.
* `base44/entities` defines 34 entity schemas.
* `base44/functions` contains 52 function entry files; 28 currently have
  `function.jsonc` manifests in this repo.
* Release docs assume Base44 for backend deploy proof, Android/iOS wrapper
  generation, App Store file generation, and some manual platform gates.

The Vite React frontend, Tailwind UI, Solo game logic, visual components, and
much of the pure scoring/question normalization logic are portable. The highest
risk areas are backend identity, GuestProfile continuity, economy/idempotency,
leaderboard projection/privacy, question-bank protection, realtime lobby
state/subscriptions, push/email integrations, and the mobile build pipeline.

Recommended direction: do not exit Base44 in one jump. First introduce a
backend adapter boundary while still running on Base44, then mirror/export
critical data, replace functions incrementally, and only then replace the
mobile build pipeline. A rushed migration would risk data loss, auth drift,
duplicate rewards, public leaderboard privacy leaks, question-bank exposure,
and App Store / Play Store disruption.

## Source Evidence

Audited files and patterns:

* `package.json`, `vite.config.js`, `tailwind.config.js`
* `src/api/base44Client.js`
* `src/lib/dbGateway/*`
* direct Base44 callers in `src/pages`, `src/hooks`, `src/lib`, and
  `src/components`
* `base44/entities/*.jsonc`
* `base44/functions/*/entry.ts` and `function.jsonc`
* release/security/data-model docs under `docs/`
* scripts that use Base44 diagnostics or validate Base44 functions

Current inventory from source scan:

| Item | Count / Finding |
| --- | --- |
| Files containing `@base44/sdk`, `createClientFromRequest`, or `base44.` | 149, including runtime, docs, scripts, and Health cases |
| Base44 entity schemas | 34 |
| Base44 function entry files | 52 |
| Function manifests present in repo | 28 |
| Frontend Base44 client | `src/api/base44Client.js` |
| Existing adapter start | `src/lib/dbGateway/*`, but many direct calls remain |
| Mobile source of truth | No complete native iOS/Android app source of truth in repo; current wrapper/export path is Base44-managed |

## Base44 Dependency Map

### Build And SDK Layer

| Area | Current dependency | Classification |
| --- | --- | --- |
| Package dependencies | `@base44/sdk`, `@base44/vite-plugin` | Backend adapter needed |
| Vite integration | Base44 Vite plugin adds runtime/editor/notifier assumptions | Backend adapter needed |
| App parameters | `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`, URL/localStorage `base44_*` params | Backend adapter needed |
| Base44 config | `base44/config.jsonc`, `base44/.app.jsonc` with app id | Backend adapter needed |
| Function compile gate | `npm run check:base44-functions` validates Base44 function entries | Backend adapter needed |

### Frontend Runtime Layer

| Area | Current dependency | Classification |
| --- | --- | --- |
| Auth context | `base44.auth.me`, `updateMe`, `logout`, `redirectToLogin` | Auth/session migration needed |
| Provider login | Base44 provider auth through `loginWithProvider`, hosted login fallback | Auth/session migration needed |
| Guest bootstrap | `ensureGuestProfile` calls `createGuestProfile`; raw guest token stored client-side, hash server-side | Data + auth/session migration needed |
| Profile/account linking | `linkGuestAccount`, `updateProfileSettings`, Base44 user row merge | Data + auth/session migration needed |
| Solo signed-in progress | `base44.auth.updateMe({ solo_progress })` | Data migration needed |
| Online result | `OnlineMatchResult` entity plus `base44.auth.updateMe` | Data migration needed |
| Friends/invites | Direct `FriendRequest`, `GameInvite`, `User` entity reads/writes plus functions | Backend adapter + data migration needed |
| Lobby/realtime | Direct `Lobby` entity get/filter/create/update/delete and `subscribe` | High-risk/blocker |
| Questions | Gameplay should call `getQuestions`; admin/diagnostics read `Question` server-side | High-risk/blocker |
| Category preferences | Direct `Category` and `UserCategoryPreference` use plus `getCategoryMetadata` | Backend adapter + data migration needed |
| Push notifications | `PushSubscription` entity and backend push functions | Backend adapter + data migration needed |
| Email | Base44 `Core.SendEmail` in backend functions | Backend adapter needed |

### Backend Function Layer

Function entry files exist for these areas:

* Admin/status/maintenance: `getAdminStatus`, `adminResetUserProgress`,
  `adminResetDailyWheelState`,
  `resetTestAccountProgress`, `cleanupAdminMaintenanceLog`,
  `aggregateQuestionStats`, `refreshLeaderboardProjection`
* Guest/account/profile: `createGuestProfile`, `linkGuestAccount`,
  `updateProfileSettings`, `deleteAccount`
* Questions/categories/analytics: `getQuestions`, `getCategoryMetadata`,
  `diagnoseSoloQuestionStartQuery`, `recordPlayerQuestionExposure`,
  `getPlayerQuestionExposureStats`, `sendQuestionAnalyticsReportEmail`
* Economy/jokers: `getDailyWheelStatus`, `claimDailyWheelReward`,
  `ensureUserJokerInventory`, `spendUserJoker`, `purchaseJokerWithDiamonds`
* Daily Quest: `getDailyQuestStatus`, `recordDailyQuestProgress`,
  `claimDailyQuestReward`, `createDailyQuestDefinition`
* Online/lobby/social: `findLobbyByCode`, `startLobbyGame`,
  `updateLobbyGameState`, `acceptGameInvite`, `sendGameInvitePush`,
  `sendFriendRequestEmail`, `acceptFriendRequest`, `removeFriend`,
  `cancelStaleLobbies`, `expireOldGameInvites`, `expirePushSubscriptions`

Migration implication: each Base44 function must become a provider-neutral API
contract before the implementation moves. The current function bodies mix
authentication, service-role entity access, business rules, response shape,
and platform-specific SDK calls.

### Data Layer

Entity groups and risk:

| Data group | Entities | Migration classification |
| --- | --- | --- |
| Auth/profile/player state | `User`, `GuestProfile`, `GuestCreationThrottle`, `AccountLinkTransaction` | Critical data + auth migration |
| Economy | `DiamondTransaction`, `DailyWheelSpin`, `UserDailyQuestProgress`, `DailyQuestDefinition`, `UserJokerInventory`, `JokerTransaction` | Critical data migration |
| Leaderboard/projections | `SoloLeaderboardEntry`, `UserStatsProjection` | High data + privacy migration |
| Questions/categories | `Question`, `Category`, `SubCategory`, `QuestionPublicProjection` | Critical protected-content migration |
| Analytics/exposure | `QuestionAttemptEvent`, `PlayerQuestionExposure`, `PlayerQuestionDailyExposure`, `QuestionStatsProjection`, `CategoryStatsProjection` | Medium/high data migration |
| Online/lobby/social | `Lobby`, `LobbyMessage`, `LobbyMatchStats`, `OnlineMatchResult`, `GameInvite`, `FriendRequest`, `Friendship` | High realtime data migration |
| Admin/ops/push | `AdminUser`, `AdminMaintenanceLog`, `PushSubscription` | High security/integration migration |
| Legacy/other | `GameRecord`, `UserCategoryPreference`, `UserSubCategoryPreference` | Medium migration |

### Storage And Files

No active Base44 storage/file SDK usage was found in runtime source. Current
asset usage is repo/public-asset based, while docs and scripts reference local
files and App Store icon assets. However, mobile export artifacts and final
native app files are still Base44-managed outside this repo.

### Build, Deploy, And Mobile Release Coupling

| Area | Base44 assumption | Migration effect |
| --- | --- | --- |
| Web deploy | Base44 config uses Vite build and `dist` output | Easy to replace with Vercel/Netlify/Cloudflare |
| Backend deploy | Base44 functions and entities are deployed by Base44 | High effort replacement |
| Function proof | `npm run build` does not prove backend deployment; docs require manual Base44 proof | Replacement must add CI deploy/probe workflow |
| iOS/Android | App wrappers and App Store files are generated through Base44/WixOneApp path | Critical mobile pipeline replacement |
| Native source | Repo has no complete native iOS/Android source of truth | Critical release risk |
| App icons | Repo checks source PNGs, but final IPA/App Store proof depends on generated native assets | Replacement needs deterministic native asset pipeline |

## Risk Matrix

| Area | Current Base44 dependency | Difficulty | Main risk | Required replacement | Mitigation | Blocks stores? |
| --- | --- | --- | --- | --- | --- | --- |
| Vite frontend shell | Base44 Vite plugin and SDK client | Medium | Hidden runtime/editor assumptions | Plain Vite config and backend adapter client | Turn plugin features off behind flags, prove build parity | No |
| Auth/session | `base44.auth.me`, provider login, hosted login, `updateMe` | Critical | Account drift, lost linked users, provider mismatch | Supabase/Appwrite/Convex/custom auth with provider linking | Define auth identity map and migration rehearsal | Yes if broken |
| GuestProfile | Base44 function + entity with token hash | Critical | Lost guest diamonds/progress, raw token mishandling | Guest identity table, token proof, migration import | Export guest rows and verify hash/token model | Yes if broken |
| Account linking | `linkGuestAccount` merge into `User` | Critical | Double merge, data loss, public identity leak | Transactional link function and merge ledger | Add idempotency key and replay tests before cutover | Yes |
| Solo progress | `User.solo_progress` through `auth.updateMe` | High | Progress overwrite/regression | User progress table or JSON field with guarded merge | Adapter, export snapshots, replay best-score merge tests | No if release path kept |
| Unified Puan | User + Online + leaderboard projection | High | Profile/leaderboard drift | Shared scoring projection service | Contract tests around visible Puan helpers | No if validated |
| Diamonds/economy | `User.diamonds`, guest diamonds, ledgers, functions | Critical | Duplicate grants/spends, financial-style inconsistency | Transactional economy service and ledger | Unique constraints, idempotency, two-device proof | Yes if broken |
| Daily Wheel/Quest | Base44 functions and daily guard entities | High | Duplicate rewards, wrong player binding | Reward API with server-side reward source | Keep Daily Wheel V2 weighted/no-Puan and Daily Quest Diamond-only contracts with replay claim tests | No if disabled/fallback |
| Market/jokers | Joker inventory + spend/purchase functions | High | Inventory spend duplication | Inventory service and transactions | Reserve-first spend API | No |
| Leaderboard | `getSoloLeaderboard`, `SoloLeaderboardEntry` | High | Public email/owner key leak, stale ranks | Public leaderboard API/projection table | Keep sanitized response contract; forbid direct User listing | No if fallback works |
| Questions | `getQuestions`, service-role `Question` reads | Critical | Full question bank exposure | Server-only question service and protected DB | API projection only, no client raw reads | Yes if exposed |
| Categories | `Category`, `UserCategoryPreference`, metadata function | Medium | Stale categories/preferences | Metadata API + preference storage | Adapter and active-category contract | No |
| Online/lobby | Direct `Lobby` entity, subscriptions, functions | Critical | Realtime desync, race bugs | Realtime channels + authoritative lobby functions | Keep Base44 until replacement is load-tested | Yes for Online release |
| Friends/invites | Entity reads/writes, email/push functions | High | Invite delivery drift, privacy leak | Social API + notification queue | Centralize under gateway before migration | No if feature can be degraded |
| Push notifications | `PushSubscription`, backend push functions | High | Invalid endpoints, VAPID secret drift | Web push service and subscription table | Export subscriptions only with consent/validity policy | Store-dependent |
| Email/reporting | Base44 `Core.SendEmail` | Medium | Admin/report delivery failure | Transactional email provider | Provider abstraction and manual delivery proof | No |
| Admin auth | `AdminUser` entity + inline guards | High | Privilege escalation | Admin role table + middleware | Port guards before admin functions | Yes for admin release gates |
| Health Center | Static Base44 source contracts | Medium | False pass/fail after migration | Provider-neutral Health contracts | Update only after adapter is real | No |
| Mobile build | Base44/Wix generated wrappers | Critical | App Store/Play Store disruption | Capacitor or Expo pipeline in repo | Create native source-of-truth before backend cutover | Yes |

## Migration Target Options

### Option A: Vite React Frontend + Supabase Backend

Fit: strongest general-purpose exit path.

Pros:

* PostgreSQL, Row Level Security, SQL migrations, storage, auth providers,
  Edge Functions, realtime channels.
* Good fit for GuestProfile, economy ledgers, leaderboard projections,
  questions/categories, admin tables, and idempotency constraints.
* Easier to avoid lock-in because schema and SQL are portable.
* Works with Vite web and Capacitor.

Cons:

* RLS and service-role functions require careful design.
* Current Base44 function semantics must be rewritten.
* Realtime Online/Lobby must be re-proven under Supabase channels or custom
  server authority.

Best for Kronox if the goal is portable production ownership while preserving
the existing React frontend.

### Option B: Vite React Frontend + Appwrite Backend

Fit: viable if the team wants a self-hostable BaaS with auth, database,
functions, storage, and realtime.

Pros:

* Self-host option reduces vendor lock-in.
* Supports auth, databases, functions, realtime, and storage.
* Clear boundary between frontend and backend services.

Cons:

* Query/index/model fit must be checked against leaderboard and question
  runtime needs.
* Economy idempotency and transactional guarantees need careful proof.
* Smaller ecosystem than Supabase for mobile release patterns and SQL-style
  data analysis.

Good fallback option, especially if self-hosting is a priority.

### Option C: Vite React Frontend + Convex Backend

Fit: attractive for realtime and server functions, but less conventional for
portable relational data migration.

Pros:

* Strong realtime/data-function model.
* Developer experience can suit lobby and social flows.
* Server functions can protect question bank and economy writes.

Cons:

* Data model differs substantially from current entity/SQL-like thinking.
* Vendor lock-in risk remains, just different from Base44.
* Export/migration and App Store independent build path still need separate
  work.

Best for rapid realtime iteration, not the cleanest exit if portability is the
top priority.

### Option D: Vite React Frontend On Vercel/Netlify/Cloudflare + Capacitor

Fit: required family for independent web/mobile delivery, but not a backend
answer by itself.

Pros:

* GitHub can become the real source of truth.
* Web deploy becomes standard CI/CD.
* Capacitor gives repo-managed iOS/Android projects.
* Can pair with Supabase, Appwrite, Convex, or custom backend.

Cons:

* Requires creating and maintaining native iOS/Android projects.
* Push, deep links, safe area, app icons, signing, store screenshots, and
  updates become owned by the repo/team.
* Backend still must be selected and migrated.

Recommended as the mobile pipeline replacement phase, not as a complete
backend migration plan.

### Option E: Expo / React Native Rewrite

Fit: strategic rewrite, not an exit shortcut.

Pros:

* Native app ownership and store pipeline become first-class.
* Better long-term access to native APIs, Play Games, Apple sign-in, push,
  haptics, and performance tuning.

Cons:

* High rewrite cost.
* Timeline drag/drop, responsive UI, Health Center, admin screens, and web/PWA
  behavior must be rebuilt or split.
* Does not solve backend/data migration alone.
* High risk to current release schedule.

Only sensible after backend contracts are stabilized and the current web app is
portable.

### Option F: Bolt/Replit/Lovable Or Other AI App Builder As Editing Layer

Fit: acceptable for editing assistance, not production source of truth.

Pros:

* Can speed up UI/documentation iteration.
* Useful for prototyping if GitHub remains canonical.

Cons:

* Reintroduces builder lock-in if it owns deploy, backend, or mobile export.
* Does not replace the need for real backend, data, auth, and mobile release
  pipelines.

Use only as an editor on top of GitHub. Do not make another builder the
production backend or native build authority.

## Recommended Target Architecture

Short term:

* Keep Vite React frontend.
* Keep Base44 release path until the current release is stable.
* Add provider-neutral adapters around all backend calls.
* Keep Health focused on product contracts, not Base44 strings.

Likely exit target:

* Vite React frontend hosted on Vercel/Netlify/Cloudflare.
* Backend on Supabase or Appwrite, with Supabase preferred for relational
  constraints, SQL migrations, RLS, analytics, and economy/leaderboard
  projection tables.
* Mobile packaged with Capacitor once web/backend contracts are stable.

Do not choose Expo/React Native as Phase 1 unless the product decision is to
rewrite the client. The current Base44 risk is primarily backend/build
ownership; rewriting the UI first would increase risk.

## Phased Exit Plan

### Phase 0: Backup, Freeze, Inventory

Goals:

* Freeze schema/function changes except critical fixes.
* Export Base44 entity schemas and function source snapshots.
* Export live data snapshots for `User`, `GuestProfile`, economy ledgers,
  leaderboard projections, questions/categories, daily rewards, lobby/social,
  push subscriptions, and admin rows.
* Record current Base44 env/secrets and provider settings outside the repo in a
  secure runbook.
* Confirm which function entry files are actually deployed versus source-only.

Exit criteria:

* Restore path exists for Base44 data.
* Live function inventory is known.
* App Store / Play Store current release path remains untouched.

### Phase 1: Backend Adapter Layer While Still On Base44

Goals:

* Move all direct `base44.*` calls out of pages and hooks.
* Expand `src/lib/dbGateway/*` into provider-neutral gateway interfaces:
  auth, guest, profile, economy, leaderboard, questions, categories, lobby,
  friends, push, admin.
* Keep Base44 as the first adapter implementation.
* Add Health cases that detect new direct client `base44.entities.*` calls in
  pages/hooks and direct client raw `Question` reads.

Exit criteria:

* Feature code depends on gateway contracts, not the SDK.
* Base44 adapter can be swapped in tests without changing UI code.

### Phase 2: Mirror Critical Data Model Outside Base44

Goals:

* Define canonical schemas for:
  `GuestProfile`, `User`, `EconomyLedger`, `DailyWheelSpin`,
  `UserDailyQuestProgress`, `JokerInventory`, `LeaderboardProjection`,
  `Question`, `Category`, `PlayerQuestionExposure`, `Lobby`, `GameInvite`,
  `FriendRequest`, `PushSubscription`, and `AdminUser`.
* Create one-way export scripts from Base44 into the target database.
* Run read-only shadow projections for leaderboard, economy balances, and
  question metadata.

Exit criteria:

* Target DB can reconstruct public leaderboard, balances, guest status, and
  categories from Base44 exports.
* No production writes go to the new backend yet.

### Phase 3: Replace Functions One By One

Order:

1. Read-only metadata and status APIs: `getCategoryMetadata`, admin status.
2. Question runtime: `getQuestions`, exposure stats, analytics writes.
3. Guest creation and profile settings.
4. Economy: Daily Wheel, Daily Quest, market/jokers.
5. Leaderboard projection and refresh.
6. Friends/invites/push.
7. Online lobby state and realtime.
8. Admin/reporting/deletion.

Rules:

* Each replacement must keep the existing response contract until the frontend
  adapter is explicitly versioned.
* Economy functions must be idempotent and server-rewarded before cutover.
* Question functions must never expose the full bank to clients.
* Leaderboard functions must return username-only public identity.

Exit criteria:

* Each function has parity tests and rollback to Base44 adapter.
* Runtime proof exists for auth, guest, economy, leaderboard, and questions.

### Phase 4: Replace Mobile Build Pipeline

Goals:

* Add Capacitor iOS/Android projects or choose Expo/React Native only if a
  rewrite is approved.
* Move native app icons, splash, bundle IDs, signing notes, deep links, push
  setup, and store metadata into repo-owned docs/config.
* Recreate current safe-area, PWA, and mobile drag/drop proof against the new
  wrapper.

Exit criteria:

* A TestFlight and Play internal test build can be produced without Base44.
* App icon, Apple sign-in parity, Android 15 edge-to-edge, large-screen, and
  push gates are proven against the new native artifacts.

### Phase 5: Final Cutover And Rollback

Goals:

* Freeze writes briefly.
* Export final Base44 delta.
* Import into target backend.
* Switch frontend adapter config to target backend.
* Keep Base44 in read-only fallback mode for a defined window.

Rollback:

* DNS/app config can switch back to Base44 adapter.
* Data written during target-backend window must be replayable into Base44 or
  the rollback window must be short and explicitly accepted.
* Economy claims during cutover require special replay/idempotency handling.

Exit criteria:

* Guest progress, registered progress, diamonds, daily guards, leaderboard
  projection, and question runtime pass live smoke tests.
* Store builds are proven on real devices.

## Immediate Hardening Tasks

These reduce Base44 lock-in without migrating yet:

1. Centralize SDK access.
   Move remaining direct `base44.*` calls from pages/hooks into gateway modules.

2. Define provider-neutral interfaces.
   Create contracts for auth, guest profile, economy, leaderboard, questions,
   categories, lobby/realtime, friends/invites, push, and admin.

3. Separate pure domain logic from SDK calls.
   Keep scoring, progress merge, leaderboard sanitization, reward calculation,
   and question projection as pure functions with tests.

4. Add direct-call Health checks.
   Fail new direct `base44.entities.*` usage in UI pages/hooks, except inside
   approved adapter modules.

5. Add raw question-bank guardrails.
   Continue failing direct client `Question.list`/`Question.filter` gameplay
   paths and require `getQuestions` or future question adapter.

6. Add data export scripts.
   Start with read-only exports for users, guests, economy ledgers, leaderboard,
   categories/questions metadata, daily rewards, and admin rows.

7. Document secrets and env.
   Record `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL`,
   `BASE44_APP_BASE_URL`, service/access tokens, VAPID, provider toggles, and
   email/push credentials in a private operational runbook.

8. Verify function deployment inventory.
   Mark which of the 41 entry files are deployed callables, scheduled/manual
   utilities, source-only legacy files, or deprecated.

9. Create native-build ownership plan.
   Decide whether Capacitor or Expo owns the future iOS/Android source of
   truth before replacing Base44 mobile export.

10. Keep current release path stable.
    Do not remove Base44 or change mobile export before an equivalent backend
    and native build pipeline is proven.

## Release Impact

Base44 exit work should not block the current release unless Base44 itself
blocks deployment. The safest release posture is:

* keep current Base44 backend/mobile generation for the near-term release,
* add adapter hardening in small PRs,
* create export/mirror tooling in parallel,
* migrate only after guest/economy/leaderboard/question contracts have live
  proof on the target backend.

The most likely App Store / Play Store blockers in an exit are not the React
frontend. They are native wrapper ownership, provider auth parity, push
configuration, icon/splash generation, deep links, and release-signing
artifacts currently handled outside the repo through Base44-generated outputs.

## Decision Summary

Kronox can become portable without rewriting the whole app, but it cannot exit
Base44 safely by deleting the SDK and pointing the frontend at a new API. The
correct first move is an adapter and data-contract hardening phase while Base44
continues to run production.

Best practical path:

1. Keep Vite React.
2. Introduce backend adapters.
3. Prefer Supabase for the first serious backend migration candidate, with
   Appwrite as the self-hostable alternative.
4. Use Capacitor for repo-owned mobile builds after backend contracts are
   stable.
5. Treat AI app builders only as editing tools, never as production source of
   truth.
