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
| Base44 entity schemas | 35 |
| Base44 function entry files | 52 |
| Base44 function manifests in repo | 22 |
| Files touching `base44.` / SDK calls in source, backend, scripts, or Health | 151 |
| Existing DB gateway start | `src/lib/dbGateway/*`, plus many direct Base44 calls remain |
| Health coverage | Broad static and some executable cases; live two-account and device proof remain manual |

## Area Audit

| Area | Current entry points | Data source | State owner | Separation | Deterministic critical state | Direct Base44 spread | Security risks | Performance risks | Health coverage | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Solo | `src/pages/SoloChallenge.jsx`, `src/pages/Game.jsx`, `src/components/game/SoloLevelResult.jsx`, `SoloSuccessPopup.jsx` | `getQuestions`, `User.solo_progress`, guest payload, local engine helpers | Mostly `Game.jsx` hooks/state | Partial MVVM: helpers exist, page still owns much flow state | Phase 1 reducer exists in `src/lib/soloAttemptReducer.js`; runtime effects still live in `Game.jsx` | Yes: `auth.me`, progress writes, question fetch gateway | Raw question bank exposure is controlled by `getQuestions`; guest token proof must stay tight | `Game.jsx` is large; drag/drop must avoid heavy work | Strong static/executable coverage for Solo rules, reducer, question exposure, records | Integrate reducer behind a Solo ViewModel in later small handoffs |
| Online | `LobbyRoom.jsx`, `WaitingRoomPanel.jsx`, `useWaitingRoomSync`, `useLobbySync`, `Game.jsx` | `Lobby`, `GameInvite`, `startLobbyGame`, `findLobbyByCode`, `updateLobbyGameState` | Mixed route state, lobby hooks, backend functions | Partial MVVM; `dbGateway/lobbyGateway` starts a service boundary | Phase 1 reducer exists in `src/lib/onlineLobbyReducer.js`; `useWaitingRoomSync` feeds subscription/poll events | Yes: lobby page/hooks still read entities directly | Host/participant auth and public identity must stay backend enforced | Subscription plus polling can scale poorly without backoff and unified owner | Online lobby start regression suite includes reducer simulation | Next safe pilot: route more lobby ViewModel commands through the reducer/gateway boundary |
| Notifications | `useNotificationCenter`, `useHeaderNotifications`, `HeaderNotificationBell`, `GameInviteNotifier`, `IncomingInvitesPanel` | `FriendRequest`, `GameInvite`, push subscription APIs | Shared external store in `useNotificationCenter` | Good ViewModel direction; selectors separated | Phase 1 reducer exists in `src/lib/notificationReducer.js`; transient empty fetches preserve pending actionable rows | Yes: reads/subscriptions direct in hook | Public labels must stay username-only; push payloads must remain compact | Multiple subscriptions/focus refreshes need bounded cadence as usage grows | Strong lifecycle suite includes reducer simulation | Keep reducer as lifecycle owner while moving backend calls toward a gateway |
| Social presence / player selection | `usePresenceHeartbeat`, `useFriendPresence`, Online player picker rows | `PlayerPresence`, `updatePlayerPresence`, `getFriendPresence`, `getOnlinePlayerSelection`, `createGameInvitesForTargets`, accepted `FriendRequest` rows | App heartbeat hook plus backend-owned selection helper | Focused service/helper boundary; UI consumes derived presence/player-selection rows only | Presence freshness is 75s TTL-based and best-effort; offline fallback is safe | Backend functions hide direct presence writes/reads and invite target resolution from UI | Linked actors derive identity from `auth.me`; guest actors require GuestProfile token proof; friend reads are accepted-friend scoped; player selection exposes username + opaque `u_`/`g_` target_ref only while recipient email remains backend-private for routable GameInvite creation; non-routable guest rows are visible but disabled for direct invite | Visible UI polling is bounded at short cadence; online discovery scans bounded fresh presence rows and preserves prior UI rows through transient failures | Focused invite/friend Health suite covers fake-online, username-only, target-ref ordering, heartbeat timing, guest proof, non-routable safety, safe retry copy, and no-email picker regressions | Keep presence best-effort; add live multi-account selection/invite proof before release claims |
| Profile / Settings / Account linking | `ProfilePage`, `SettingsPage`, `AuthContext`, guest/account helpers | Base44 auth `User`, `GuestProfile`, `linkGuestAccount`, `updateProfileSettings` | Auth context plus page-local state | Partial ViewModel; service helpers exist | Link flow guarded by backend token proof/idempotency | Yes | Account linking and deletion require two-account/manual privacy proof | Profile calls can repeat on mount/focus; acceptable at current scale | Strong onboarding/profile/account Health | Move more page auth/profile logic behind profile service boundary |
| Leaderboard | `LeaderboardPage`, `src/lib/leaderboard.js`, `getSoloLeaderboard` | `SoloLeaderboardEntry`, bounded server repair from `User`, guest proof | Page state plus leaderboard helpers | Service boundary exists | Public rank confidence/scope explicit | Some direct projection writes remain | Public response must never expose email/owner_key/raw guest id | Top-window list bounded; projection repair can grow cost | Strong public payload/privacy Health | Keep API compact; add DB/index proof later |
| Economy / Daily / Jokers | Market, Daily Wheel, Daily Quest, joker helpers/functions | `DiamondTransaction`, `DailyWheelSpin`, `UserDailyQuestProgress`, `UserJokerInventory`, `JokerTransaction` | Feature hooks/pages plus backend functions | Mixed; service helpers exist | Function-level idempotency guards; DB unique proof absent | Yes | Client must never set rewards/cost/user identity | Retry/double-tap paths need real parallel proof | Strong static/idempotency Health; race proof manual | Add DB uniqueness proof or transactional backend before scale |
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
2. `Game.jsx` still owns too much Solo gameplay orchestration. Pure helpers
   exist, and Phase 1 adds `src/lib/soloAttemptReducer.js`, but current
   runtime side effects have not yet been moved behind a Solo ViewModel.
3. Online lobby state is still split across `LobbyRoom`, `useWaitingRoomSync`,
   `useLobbySync`, route state, and backend functions, but Phase 1 now adds
   `src/lib/onlineLobbyReducer.js` and wires waiting-room subscription/poll
   events into it.
4. Notifications are closest to the desired shape: shared store plus selectors
   and view model. Phase 1 now adds `src/lib/notificationReducer.js` as the
   lifecycle owner for fetch, subscription, terminal, dismiss, accept, reject,
   expiry, and invalidation events.
5. Data model uniqueness, indexes, and live RLS/BOLA behavior cannot be proven
   from repo source alone. They remain manual/platform proof gates.
6. Health contains many static contract checks. This is useful for drift, but
   real Online/realtime/push/security proof still needs simulation/live probes.

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
  offline friends with username + opaque `u_`/`g_` `target_ref` only, supports
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
