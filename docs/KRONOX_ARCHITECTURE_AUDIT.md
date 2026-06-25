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
| Base44 entity schemas | 34 |
| Base44 function entry files | 41 |
| Base44 function manifests in repo | 17 |
| Files touching `base44.` / SDK calls in source, backend, scripts, or Health | 134 |
| Existing DB gateway start | `src/lib/dbGateway/*`, plus many direct Base44 calls remain |
| Health coverage | Broad static and some executable cases; live two-account and device proof remain manual |

## Area Audit

| Area | Current entry points | Data source | State owner | Separation | Deterministic critical state | Direct Base44 spread | Security risks | Performance risks | Health coverage | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Solo | `src/pages/SoloChallenge.jsx`, `src/pages/Game.jsx`, `src/components/game/SoloLevelResult.jsx`, `SoloSuccessPopup.jsx` | `getQuestions`, `User.solo_progress`, guest payload, local engine helpers | Mostly `Game.jsx` hooks/state | Partial MVVM: helpers exist, page still owns much flow state | Partially deterministic; reducer/state machine not fully extracted | Yes: `auth.me`, progress writes, question fetch gateway | Raw question bank exposure is controlled by `getQuestions`; guest token proof must stay tight | `Game.jsx` is large; drag/drop must avoid heavy work | Strong static coverage for Solo rules, question exposure, records | Pilot MVI reducer for Solo attempt lifecycle after current Health stabilizes |
| Online | `LobbyRoom.jsx`, `WaitingRoomPanel.jsx`, `useWaitingRoomSync`, `useLobbySync`, `Game.jsx` | `Lobby`, `GameInvite`, `startLobbyGame`, `findLobbyByCode`, `updateLobbyGameState` | Mixed route state, lobby hooks, backend functions | Partial MVVM; `dbGateway/lobbyGateway` starts a service boundary | Improved by merge/retry, idempotent start, poll recovery | Yes: lobby page/hooks still read entities directly | Host/participant auth and public identity must stay backend enforced | Subscription plus polling can scale poorly without backoff and unified owner | Online lobby start regression suite exists | Next safe pilot: central Online ViewModel/state machine around lobby phase |
| Notifications | `useNotificationCenter`, `useHeaderNotifications`, `HeaderNotificationBell`, `GameInviteNotifier`, `IncomingInvitesPanel` | `FriendRequest`, `GameInvite`, push subscription APIs | Shared external store in `useNotificationCenter` | Good ViewModel direction; selectors separated | Merge helpers preserve valid pending rows through stale empty fetches | Yes: reads/subscriptions direct in hook | Public labels must stay username-only; push payloads must remain compact | Multiple subscriptions/focus refreshes need bounded cadence as usage grows | Strong lifecycle suite exists | Keep as MVI pilot; formalize event reducer for fetch/subscription/terminal states |
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
   exist, but the critical attempt lifecycle is not a standalone reducer.
3. Online lobby state is split across `LobbyRoom`, `useWaitingRoomSync`,
   `useLobbySync`, route state, and backend functions. Recent fixes reduced
   race risk, but the state model is still implicit.
4. Notifications are closest to the desired shape: shared store plus selectors
   and view model. The next step is to formalize this as an event reducer.
5. Data model uniqueness, indexes, and live RLS/BOLA behavior cannot be proven
   from repo source alone. They remain manual/platform proof gates.
6. Health contains many static contract checks. This is useful for drift, but
   real Online/realtime/push/security proof still needs simulation/live probes.

## Safe Fixes In This Pass

- Added architecture-audit Health coverage so the new target docs cannot drift
  silently.
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
