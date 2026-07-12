# Kronox Architecture Audit

Status: current audit and safe-fix record.

This document audits the current Kronox architecture against the target:
Feature-Based MVVM with MVI-style state machines for Solo gameplay, Online
lobby/start/reconnect, and friend/game invite notifications.

This is not a Base44 migration plan. Current Base44 production path remains active.
Base44 migration work is paused and tracked separately in
`docs/KRONOX_BASE44_EXIT_AUDIT.md`.

External references reviewed during this pass:

- Android app architecture: https://developer.android.com/topic/architecture
- React reducer/context scaling: https://react.dev/learn/scaling-up-with-reducer-and-context
- OWASP MASVS / MASTG: https://mas.owasp.org/MASVS/ and https://mas.owasp.org/MASTG/best-practices/
- Capacitor future wrapper awareness: https://capacitorjs.com/docs
- OpenAI Cookbook Codex modernization pattern: https://github.com/openai/openai-cookbook/blob/main/examples/codex/code_modernization.md
- Game design tooling reference: https://clickup.com/tr/blog/106626/oyun-tasarim-yazilimi

## Inventory Summary

Mechanical scan from this pass:

| Item | Current count / finding |
| --- | --- |
| Audited source/doc/script files in requested folders | 416 |
| Base44 entity schemas | 40 |
| Base44 function entry files | 50; all pass `npm run check:base44-functions` |
| Base44 function manifests in repo | 29 |
| Files touching `base44.` / SDK calls in source, backend, scripts, or Health | 151 |
| Existing DB gateway start | `src/lib/dbGateway/*`, plus many direct Base44 calls remain |
| Health coverage | Broad static and some executable cases; live two-account and device proof remain manual |

## Area Audit

| Area | Current entry points | Data source | State owner | Separation | Deterministic critical state | Direct Base44 spread | Security risks | Performance risks | Health coverage | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Solo | `src/pages/SoloChallenge.jsx`, `src/pages/Game.jsx`, `src/components/game/SoloLevelResult.jsx`, `SoloSuccessPopup.jsx` | `getQuestions`, player `solo_progress`, local engine helpers | `useSoloAttemptViewModel` over `soloAttemptReducer`; page owns rendering and external effects | Phase 1 runtime handoff completed without route or scoring changes | Reducer owns evaluated moves, mistakes, remaining moves, terminal state, persistence status, and joker summary | Persistence is isolated in `features/solo/services/soloAttemptEffects.js`; question fetch remains gateway-owned | Raw question bank exposure is controlled by `getQuestions`; guest token proof stays backend-verified | `Game.jsx` remains large; further extraction must be incremental | Executable reducer plus runtime-connected ViewModel/effect/placement Health | Continue small render/effect extractions only after device proof |
| Online | `LobbyRoom.jsx`, `WaitingRoomPanel.jsx`, `useWaitingRoomSync`, `useLobbySync`, `Game.jsx` | `Lobby`, `GameInvite`, `OnlineMatchResult`, backend lobby functions | Client reducer/hook projection over backend authority | `lobbyGateway` owns commands and scoped snapshots; waiting-room DTO omits deck/question/player-card payload | Phase 1 reducer plus expected revision/fail-closed lock; one canonical start deck/result receipt | No direct client Lobby/result/profile-score/leaderboard mutation remains | Linked and token-proven guest actor proof, participant/host checks, max four, sanitized DTO | One shared non-overlapping adaptive poller per hook replaces duplicate fixed intervals; live scale proof remains manual | Executable poller/reducer plus source-connected authority/privacy/recovery Health | Keep live parallel multi-device join/start/result proof as release gate |
| Notifications | `useNotificationCenter`, `useHeaderNotifications`, `HeaderNotificationBell`, `GameInviteNotifier`, `IncomingInvitesPanel` | Backend social snapshot/invite functions plus push APIs | Shared external store in `useNotificationCenter` | Reducer is lifecycle owner; effects remain in hook/API | Transient empty/error fetches and `INVITE_OPENED` preserve actionable rows; confirmed terminal events close | Direct entity reads replaced on active social/invite paths | Username-safe labels; raw errors/private IDs stripped | Multiple subscriptions/focus refreshes need bounded cadence as usage grows | Executable nonterminal-open, transient preservation, terminal close, and safe-error cases | Keep reducer/store; live failed accept/decline proof remains manual |
| Social presence / player selection | `usePresenceHeartbeat`, `useFriendPresence`, Online player picker rows | `PlayerPresence`, `updatePlayerPresence`, `getOnlinePlayerSelection`, `createGameInvitesForTargets` | App heartbeat hook plus backend-owned snapshot | Focused boundary; one bounded User profile batch hydrates safe public rows | Presence freshness is 75s TTL-based and best-effort; offline fallback is safe | Backend hides direct presence/friend reads and recipient resolution | Linked/guest proof; username/safe avatar/status plus opaque target ref only | One bounded public-profile scan replaces per-friend profile reads; live scale/index proof remains manual | Batched-read/privacy/guest/presence/invite Health | Keep presence best-effort and prove multi-account selection/invite live |
| Profile / Settings / Account linking | `ProfilePage`, `SettingsPage`, `ProfileEditPage`, `AuthContext`, `useCurrentPlayerProfile` | Base44 auth `User`, `GuestProfile`, linking/settings functions | AuthContext is canonical identity owner; shared ViewModel maps linked/guest player | Profile and Leaderboard no longer duplicate auth/profile hydration | Link and guest inventory flows use token proof/idempotency | Direct Base44 auth duplication removed from Profile | Account linking/deletion still require two-account/manual privacy proof | Shared mapping removes repeated profile bootstrap; inventory cache remains scoped | Canonical actor, navigation, privacy, and guest inventory Health | Reuse the ViewModel in more read-only profile consumers when safe |
| Leaderboard | `LeaderboardPage`, `src/lib/leaderboard.js`, `getSoloLeaderboard` | Materialized `SoloLeaderboardEntry`, bounded backend maintenance fallback, guest proof | Page state plus leaderboard helper | Hot page path is read-only and projection/cache-first | Public rank confidence/scope explicit | Projection writes occur on score/progress mutation, not Leaderboard page read | Public response never exposes email/owner_key/raw guest id | Top-window reads are bounded; DB index proof remains manual | Read-purity plus public payload/privacy Health | Keep repairs in backend/admin/background paths and add DB/index proof later |
| Economy / Daily / Jokers | Market, Daily Wheel, Daily Calendar, joker/hint helpers/functions | Ledgers, current inventories, canonical `UserDailyQuestProgress` | Feature hooks over backend functions | Shared Joker helper supports linked and token-proven guest actors; Daily status policy is explicit | Fail-closed locks/reservations, canonical distinct Daily keys, source provenance; DB unique proof absent | No trusted client reward/progress amount | Guest actor keys stay internal; client cannot set reward/cost/progress; training consumables excluded | Daily summary writes only when values change; one guarded assignment repair remains; live parallel proof still needed | Source-connected canonical/provenance/idempotency/guest UX Health | Configure platform uniqueness after zero-duplicate proof; move remaining status repair to events only in a later migration |
| Questions / Categories | `useOfflineQuestions`, `soloQuestionEngine`, `getQuestions`, `getCategoryMetadata`, category preferences | Backend functions and Category/Question entities | Hooks plus engine helpers | Good model/service split in engine; UI still coordinates fetch state | Deck builder deterministic after prebuilt deck | Raw direct reads mostly admin/Health; gameplay uses function | Full question bank exposure remains P0 risk | Per-category fetch is bounded; cache invalidation guarded | Strong question exposure/category Health | Keep all gameplay behind `getQuestions`; avoid client fallback |
| Admin / Health | `AdminPage`, `SimulationPanel`, `src/components/game/health/*` | Static raw source imports, docs mirrors, admin functions | Health runner/report builder | Health panel already split | Health report deterministic; manual gates preserved | Health reads raw source only | Admin access remains backend AdminUser-bound | Health can be heavy; batching/yielding exists | Extensive | Add architecture-audit docs guard; do not treat Health PASS as release proof |
| Shared components | Layout, buttons, cards, top bars | Props and shared helpers | Component-local | Mostly View-only | N/A | Low | Public identity display must remain sanitized | Asset/image size and animations affect mobile | Mobile visual Health and docs | Keep reusable components presentational |
| Shared hooks | `useAuth`, lobby/game/notification hooks, realtime hooks | Base44 and browser APIs | Hook-owned state | Mixed ViewModel/service roles | Critical hooks need reducers | High | Hook side effects can bypass service boundaries | Subscription storms, repeated fetch on focus | Partial | Use hooks as ViewModels but move backend calls to services/gateways |
| Backend functions | `base44/functions/**/entry.ts` | Base44 auth/entities/service role | Function-local | Service/domain/backend mixed in entry files | Mostly explicit guards; some live proof manual | Backend is Base44-specific by design | BOLA/RLS/service-role mistakes are high risk | Function list reads must stay bounded | Compile gate plus security Health | Keep Base44; add adapter boundary only in later task |
| Entities / data model | `base44/entities/*.jsonc` | Base44 schemas | Platform | Data model docs exist | DB uniqueness/index proof not repo-proven | N/A | Privacy fields must not leak to public projections | Reporting needs event model growth | Data model Health exists | Add reporting-readiness doc; do not mutate schema broadly |
| Release/mobile | Base44 wrapper path, PWA manifest/SW, release docs | Base44 generated wrappers plus web source | Manual release process | Native source is not repo-owned | Manual gates only | N/A | Store privacy, Apple parity, push, wrapper security | Mobile asset sizes and heavy UI effects | Manual gates visible | Keep web/domain boundaries portable for future Capacitor/native ownership |

## Main Deviations From Target

1. Direct Base44 access remains spread through pages, hooks, shared libs, and
   scripts. This is acceptable for the current production path but blocks a
   clean MVVM/service boundary.
2. `Game.jsx` remains large, but evaluated-move/terminal attempt state now runs
   through `useSoloAttemptViewModel` and `soloAttemptReducer`; persistence is
   isolated in `soloAttemptEffects`. Rendering, timer presentation, inventory,
   Daily events, analytics, and record requests still need later small handoffs.
3. Online lobby state still spans route bootstrap, hooks, reducer, and backend
   authority. Waiting/game snapshot scopes now partition roster data from the
   active deck, and both lobby hooks use a shared adaptive polling fallback.
4. Notifications are closest to the desired shape: shared store plus selectors
   and view model. Phase 1 now adds `src/lib/notificationReducer.js` as the
   lifecycle owner for fetch, subscription, terminal, dismiss, accept, reject,
   expiry, and invalidation events.
5. Data model uniqueness, indexes, and live RLS/BOLA behavior cannot be proven
   from repo source alone. They remain manual/platform proof gates.
6. Health contains many static contract checks. Hamle 3 retargets the touched
   paths and adds an executable adaptive-poller probe, but Online/realtime/
   push/security and mobile performance still need live/device proof.

## Safe Fixes In This Pass

- Added architecture-audit Health coverage so the new target docs cannot drift
  silently.
- Added `src/lib/soloAttemptReducer.js` as the Phase 1 pure Solo attempt
  lifecycle reducer and locked current HAMLE/record-context behavior with
  targeted Health coverage.
- Added the Phase 1 `SoloLevelAttemptEvent` reporting contract without enabling
  broad analytics or client-owned event writes.
- Added `src/lib/onlineLobbyReducer.js` as the Phase 1 pure Online lobby
  lifecycle reducer and wired `useWaitingRoomSync` to feed authoritative
  subscription/poll events without changing route payloads.
- Added `src/lib/notificationReducer.js` as the Phase 1 pure notification
  lifecycle reducer and wired `useNotificationCenter` to preserve pending rows
  through transient empty fetches while closing only on terminal lifecycle
  events.
- Added backend-owned `PlayerPresence` plus current-user heartbeat and
  accepted-friend-scoped lookup so friend pickers/lists no longer fake every
  friend as online and no longer display emails as public names.
- Hardened presence freshness with 25s visible heartbeats, 75s backend TTL,
  runtime app-session ids, token-proven guest heartbeat support, focus/reconnect
  refresh, and previous-row preservation during transient fetch failures.
- Added backend-owned Online player selection and invite target creation:
  `getOnlinePlayerSelection` returns online friends, online non-friends, then
  offline friends with username + random opaque `social_*` `target_ref` only, supports
  completed guest actor proof for the picker, and
  `createGameInvitesForTargets` privately resolves routable refs to existing
  `GameInvite.to_email` rows while returning safe per-target failures for
  non-routable guest presence.
- Added backend-owned `sendFriendRequest` so Add Friend accepts email or
  username while username resolution, self/duplicate/pending guards, and
  target-email privacy stay server-side. The current duplicate-send race
  hardening is a function-level `FriendRequestOperationLock`, not DB unique
  proof.
- Aligned unified Kronox Puan scoring so Online writes only the Online
  component (`User.online_progress.score`) while visible Profile/Header/
  Leaderboard surfaces show Solo best-score plus Online score. Online winner
  scoring is exactly `+15`, loser scoring is exactly `-6` before checkpoint
  protection, and elapsed seconds are audit/display only with no Online speed
  bonus.
- Restored the root `@base44/sdk` package and lockfile contract to the exact
  `0.8.34` pin required by the security Health suite and current deployment
  docs; no runtime SDK upgrade work was attempted in this audit.
- Converted transient social/lobby/debug UI timers to ref-owned timers with
  previous-timer clearing and unmount cleanup in the Friends success banner,
  create-lobby auto-trim note, lobby copy-code state, and debug copy controls.
  A focused static Health guard now checks this cleanup pattern.
- Corrected invite navigation Health expectations from the older
  `lobby: updatedLobby` token to the current `verifiedLobby` / `joinedLobby`
  contract.
- Integrated `soloAttemptReducer` into production through
  `src/features/solo/viewModel/useSoloAttemptViewModel.js`, extracted pure
  runtime mapping/config in `features/solo/model`, and moved persistence behind
  `features/solo/services/soloAttemptEffects.js`. Scoring, level types,
  training-consumable rules, routes, and visible behavior remain unchanged.
- Added waiting-room/game snapshot scopes and one reusable adaptive poller.
  Waiting-room responses stop before active deck/question payload, and fixed
  interval/focus/visibility loop ownership was consolidated.
- Replaced Online player-selection per-friend profile reads with one bounded
  server-side profile batch. The client response remains username/avatar/
  presence plus opaque target references only.
- Reduced Daily status write-on-read work to one guarded idempotent assignment
  repair, same-day receipt reconciliation, and summary projection writes only
  when values change. The remaining repair is explicit and is not an event-log
  migration.
- Removed Leaderboard page repair/publish/backfill calls from its hot read path;
  it now reads cached/materialized projection snapshots only.
- Added `useCurrentPlayerProfile` as the shared linked/guest mapping used by
  Profile and Leaderboard. Completed guests now see and spend real backend-owned
  Joker/Hint balances; Store purchase remains explicitly login-gated.
- Reduced typecheck diagnostics from 1,260 to 370 by resolving Vite raw-module
  imports and the one untyped confetti package without changing runtime aliases.
  Remaining component-prop/inference errors are tracked for later cleanup.
- Added the runtime-connected `Architecture P1 Health Suite` and retargeted
  stale reducer, lobby polling, Leaderboard read, and guest inventory checks.
- No broad runtime refactor was attempted.
- No Base44 migration work was started.

## Dead Code Findings

No code was removed in this pass. Candidate areas for later removal need a
separate usage-proof pass:

- legacy docs/generated references that predate current Solo v3 rules
- old fixed-card Solo comments or aliases if not used by Health/manual docs
- duplicate direct lobby/invite fetch paths once Online/notification services
  are formalized
- older fake-rank placeholder helpers if no runtime, doc, or Health dependency
  remains

Removal rule: delete only after `rg` usage, dynamic import/string references,
Health dependencies, release docs, and manual workflows prove the code is safe
to remove.

## Decision Log

| Decision | Reason |
| --- | --- |
| Keep Base44 active | Current release path and mobile wrappers depend on it. |
| Do not restructure folders now | A broad move would raise regression risk without adding runtime proof. |
| Pilot future MVI reducers in Solo, Online, Notifications | These are the flows with the highest recurring bug cost. |
| Treat Health as contract guard, not release proof | Recent failures show static checks must be paired with runtime/manual probes. |
| Use docs plus targeted Health as this pass's safe fix | It closes architecture drift without destabilizing product behavior. |
